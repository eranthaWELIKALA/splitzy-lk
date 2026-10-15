-- Splitzy schema: people, friendships, groups, expenses, settlements and per-user activity feed.
-- Money is stored as bigint minor units (cents). All tables use row level security.
--
-- Everything lives in its own `splitzy` schema so the app can share a Supabase project with other
-- apps. Auth users are shared across the project, so nothing here hooks into auth.users: a Splitzy
-- profile is created lazily by ensure_profile() the first time a user opens Splitzy.

create schema splitzy;

-- ───────────────────────────── Tables ─────────────────────────────

-- A person is anyone who can take part in an expense: a registered user (user_id set) or a friend
-- who was added by name/email and hasn't signed up yet. When that email signs up, the existing
-- person row is linked to the new account so their history carries over.
create table splitzy.persons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  email text unique check (email is null or email = lower(email)),
  avatar_color text not null default '#64748b' check (avatar_color ~ '^#[0-9a-fA-F]{6}$'),
  created_by uuid references splitzy.persons (id) on delete set null,
  created_at timestamptz not null default now()
);

create table splitzy.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  person_id uuid not null unique references splitzy.persons (id),
  phone text check (char_length(phone) <= 30),
  default_currency text not null default 'LKR' check (default_currency ~ '^[A-Z]{3}$'),
  notification_prefs jsonb not null default
    '{"expenses": true, "settlements": true, "groups": true, "friends": true, "browser": false}',
  created_at timestamptz not null default now()
);

create table splitzy.friendships (
  owner_id uuid not null references splitzy.persons (id) on delete cascade,
  friend_id uuid not null references splitzy.persons (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, friend_id),
  check (owner_id <> friend_id)
);
create index friendships_friend_idx on splitzy.friendships (friend_id);

create table splitzy.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  type text not null default 'other' check (type in ('home', 'trip', 'couple', 'work', 'other')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  simplify_debts boolean not null default true,
  created_by uuid references splitzy.persons (id) on delete set null,
  created_at timestamptz not null default now()
);

create table splitzy.group_members (
  group_id uuid not null references splitzy.groups (id) on delete cascade,
  person_id uuid not null references splitzy.persons (id),
  created_at timestamptz not null default now(),
  primary key (group_id, person_id)
);
create index group_members_person_idx on splitzy.group_members (person_id);

create table splitzy.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references splitzy.groups (id) on delete cascade,
  description text not null check (char_length(description) between 1 and 120),
  amount bigint not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  category text not null default 'general',
  date date not null default current_date,
  -- [{ "personId": uuid, "amount": cents }]
  paid_by jsonb not null,
  split_method text not null check (split_method in ('equal', 'exact', 'percent', 'shares', 'adjustment')),
  -- [{ "personId": uuid, "amount": cents, "input"?: number }]
  splits jsonb not null,
  -- Derived from paid_by + splits by trigger; used for access control and lookups.
  participants uuid[] not null default '{}',
  notes text check (char_length(notes) <= 500),
  created_by uuid references splitzy.persons (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expenses_group_idx on splitzy.expenses (group_id);
create index expenses_participants_idx on splitzy.expenses using gin (participants);

create table splitzy.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references splitzy.groups (id) on delete cascade,
  from_id uuid not null references splitzy.persons (id),
  to_id uuid not null references splitzy.persons (id),
  amount bigint not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  date date not null default current_date,
  note text check (char_length(note) <= 120),
  created_by uuid references splitzy.persons (id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_id <> to_id)
);
create index settlements_group_idx on splitzy.settlements (group_id);
create index settlements_people_idx on splitzy.settlements (from_id, to_id);

-- One row per recipient. `data` holds a snapshot (names, amounts) so entries still read
-- correctly after the underlying expense or group is deleted.
create table splitzy.activity (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid references splitzy.persons (id) on delete set null,
  kind text not null,
  group_id uuid,
  data jsonb not null default '{}',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index activity_recipient_idx on splitzy.activity (recipient_id, created_at desc);

-- ───────────────────────────── Access helpers ─────────────────────────────
-- SECURITY DEFINER so policies can consult other tables without recursive RLS checks.

create function splitzy.my_person_id() returns uuid
language sql stable security definer set search_path = splitzy as $$
  select id from persons where user_id = auth.uid()
$$;

create function splitzy.is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = splitzy as $$
  select exists (select 1 from group_members where group_id = gid and person_id = my_person_id())
$$;

create function splitzy.can_see_person(pid uuid) returns boolean
language sql stable security definer set search_path = splitzy as $$
  with me as (select my_person_id() as id)
  select pid = (select id from me)
    or exists (select 1 from persons p where p.id = pid and p.created_by = (select id from me))
    or exists (select 1 from friendships f where f.owner_id = (select id from me) and f.friend_id = pid)
    or exists (select 1 from friendships f where f.friend_id = (select id from me) and f.owner_id = pid)
    or exists (
      select 1 from group_members a join group_members b using (group_id)
      where a.person_id = (select id from me) and b.person_id = pid)
    or exists (
      select 1 from expenses e
      where e.group_id is null and (select id from me) = any (e.participants) and pid = any (e.participants))
    or exists (
      select 1 from settlements s
      where s.group_id is null and (select id from me) in (s.from_id, s.to_id) and pid in (s.from_id, s.to_id))
$$;

-- Inserts one activity row per registered recipient (plus the actor), stamped with the actor.
create function splitzy.notify_people(p_people uuid[], p_kind text, p_group uuid, p_data jsonb) returns void
language sql security definer set search_path = splitzy as $$
  insert into activity (recipient_id, actor_id, kind, group_id, data)
  select distinct p.user_id, my_person_id(), p_kind, p_group,
    p_data || jsonb_build_object('actor_name', (select name from persons where id = my_person_id()))
  from persons p
  where p.user_id is not null and (p.id = any (p_people) or p.id = my_person_id())
$$;

-- ───────────────────────────── Account lifecycle ─────────────────────────────

-- Creates (or links) the caller's Splitzy person and profile, and keeps their email in sync with
-- auth. Called by the app on every load; safe to call repeatedly and concurrently.
create function splitzy.ensure_profile() returns uuid
language plpgsql security definer set search_path = splitzy as $$
declare
  uid uuid := auth.uid();
  u record;
  pid uuid;
  mail text;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  perform pg_advisory_xact_lock(hashtext('splitzy.ensure_profile:' || uid::text));
  select email, raw_user_meta_data as meta into u from auth.users where id = uid;
  mail := lower(u.email);

  select id into pid from persons where user_id = uid;
  if pid is null then
    -- Claim a placeholder created by a friend who added this email, if there is one.
    select id into pid from persons where email = mail and user_id is null for update;
    if pid is null then
      insert into persons (user_id, name, email, avatar_color)
      values (
        uid,
        coalesce(nullif(trim(u.meta ->> 'name'), ''), split_part(mail, '@', 1)),
        mail,
        coalesce(substring(u.meta ->> 'avatar_color' from '^#[0-9a-fA-F]{6}$'), '#10b981'))
      returning id into pid;
    else
      update persons
      set user_id = uid,
          name = coalesce(nullif(trim(u.meta ->> 'name'), ''), name),
          avatar_color = coalesce(substring(u.meta ->> 'avatar_color' from '^#[0-9a-fA-F]{6}$'), avatar_color)
      where id = pid;
    end if;
  elsif (select email from persons where id = pid) is distinct from mail then
    -- The auth email changed: free it from any placeholder, then update ours.
    update persons set email = null where email = mail and user_id is null;
    update persons set email = mail where id = pid;
  end if;

  insert into profiles (user_id, person_id) values (uid, pid) on conflict (user_id) do nothing;
  return pid;
end $$;

-- Registered users' emails come from auth (via ensure_profile); clients may only edit
-- placeholder emails directly.
create function splitzy.persons_guard() returns trigger
language plpgsql as $$
begin
  if old.user_id is not null and current_user = 'authenticated' then
    new.email := old.email;
  end if;
  return new;
end $$;

create trigger persons_guard before update on splitzy.persons
  for each row execute function splitzy.persons_guard();

-- Leaves Splitzy without touching the shared login. The person row becomes a placeholder so
-- friends' expenses and balances stay intact; signing in again relinks it by email.
create function splitzy.leave_splitzy() returns void
language plpgsql security definer set search_path = splitzy as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from activity where recipient_id = auth.uid();
  delete from profiles where user_id = auth.uid();
  update persons set user_id = null where user_id = auth.uid();
end $$;

-- ───────────────────────────── Friend & group RPCs ─────────────────────────────

create function splitzy.add_friend(p_name text, p_email text default null, p_color text default '#64748b')
returns uuid
language plpgsql security definer set search_path = splitzy as $$
declare
  me uuid := my_person_id();
  mail text := nullif(lower(trim(p_email)), '');
  pid uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if mail is not null then
    select id into pid from persons where email = mail;
  end if;
  if pid = me then raise exception 'You can''t add yourself as a friend'; end if;
  if pid is null then
    if coalesce(trim(p_name), '') = '' then raise exception 'Name is required'; end if;
    insert into persons (name, email, avatar_color, created_by)
    values (trim(p_name), mail, p_color, me)
    returning id into pid;
  end if;
  insert into friendships (owner_id, friend_id) values (me, pid), (pid, me) on conflict do nothing;
  perform notify_people(array[pid], 'friend_added', null,
    jsonb_build_object('target_id', pid, 'target_name', (select name from persons where id = pid)));
  return pid;
end $$;

create function splitzy.remove_friend(p_friend uuid) returns void
language sql security definer set search_path = splitzy as $$
  delete from friendships
  where (owner_id = my_person_id() and friend_id = p_friend)
     or (owner_id = p_friend and friend_id = my_person_id())
$$;

create function splitzy.create_group(
  p_name text, p_type text, p_currency text, p_simplify boolean, p_member_ids uuid[]
) returns uuid
language plpgsql security definer set search_path = splitzy as $$
declare
  me uuid := my_person_id();
  gid uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  insert into groups (name, type, currency, simplify_debts, created_by)
  values (trim(p_name), p_type, p_currency, p_simplify, me)
  returning id into gid;
  insert into group_members (group_id, person_id)
  select gid, m from (select me as m union select unnest(p_member_ids)) ids
  where m = me or can_see_person(m);
  perform notify_people(
    array(select person_id from group_members where group_id = gid), 'group_created', gid,
    jsonb_build_object('group_name', trim(p_name)));
  return gid;
end $$;

create function splitzy.send_reminder(p_person uuid) returns void
language plpgsql security definer set search_path = splitzy as $$
begin
  if not can_see_person(p_person) then raise exception 'Person not found'; end if;
  perform notify_people(array[p_person], 'reminder_sent', null,
    jsonb_build_object('target_id', p_person, 'target_name', (select name from persons where id = p_person)));
end $$;

-- ───────────────────────────── Integrity triggers ─────────────────────────────

create function splitzy.expenses_prepare() returns trigger
language plpgsql set search_path = splitzy as $$
declare
  paid_total bigint;
  split_total bigint;
begin
  if jsonb_typeof(new.paid_by) <> 'array' or jsonb_typeof(new.splits) <> 'array'
     or jsonb_array_length(new.paid_by) = 0 or jsonb_array_length(new.splits) = 0 then
    raise exception 'An expense needs at least one payer and one person to split with' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from jsonb_array_elements(new.paid_by || new.splits) x
    where (x ->> 'amount')::bigint < 0 or (x ->> 'personId') is null) then
    raise exception 'Invalid payer or split entry' using errcode = 'check_violation';
  end if;
  select coalesce(sum((x ->> 'amount')::bigint), 0) into paid_total from jsonb_array_elements(new.paid_by) x;
  select coalesce(sum((x ->> 'amount')::bigint), 0) into split_total from jsonb_array_elements(new.splits) x;
  if paid_total <> new.amount or split_total <> new.amount then
    raise exception 'Paid amounts and splits must both add up to the expense amount' using errcode = 'check_violation';
  end if;

  new.participants := array(
    select distinct (x ->> 'personId')::uuid from jsonb_array_elements(new.paid_by || new.splits) x);

  if new.group_id is not null then
    if exists (
      select 1 from unnest(new.participants) p
      where not exists (select 1 from group_members gm where gm.group_id = new.group_id and gm.person_id = p)) then
      raise exception 'Everyone in a group expense must be a member of the group' using errcode = 'check_violation';
    end if;
  elsif exists (select 1 from unnest(new.participants) p where not can_see_person(p)) then
    raise exception 'You can only split with your friends' using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(my_person_id(), new.created_by);
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger expenses_prepare before insert or update on splitzy.expenses
  for each row execute function splitzy.expenses_prepare();

create function splitzy.settlements_prepare() returns trigger
language plpgsql set search_path = splitzy as $$
begin
  if new.group_id is not null and (
    not exists (select 1 from group_members where group_id = new.group_id and person_id = new.from_id) or
    not exists (select 1 from group_members where group_id = new.group_id and person_id = new.to_id)) then
    raise exception 'Both people must be members of the group' using errcode = 'check_violation';
  end if;
  new.created_by := coalesce(my_person_id(), new.created_by);
  new.created_at := now();
  return new;
end $$;

create trigger settlements_prepare before insert on splitzy.settlements
  for each row execute function splitzy.settlements_prepare();

-- Everyone in a group becomes friends with each other, as in Splitwise.
create function splitzy.group_members_befriend() returns trigger
language plpgsql security definer set search_path = splitzy as $$
begin
  insert into friendships (owner_id, friend_id)
  select new.person_id, gm.person_id from group_members gm
  where gm.group_id = new.group_id and gm.person_id <> new.person_id
  union all
  select gm.person_id, new.person_id from group_members gm
  where gm.group_id = new.group_id and gm.person_id <> new.person_id
  on conflict do nothing;
  return null;
end $$;

create trigger group_members_befriend after insert on splitzy.group_members
  for each row execute function splitzy.group_members_befriend();

-- ───────────────────────────── Activity triggers ─────────────────────────────
-- Rows removed by a group delete cascade are summarised by the single group_deleted entry.
-- Cascaded AFTER triggers fire once the group row is already gone, so "group no longer exists"
-- identifies them (pg_trigger_depth() can't, as queued AFTER triggers run at top level).

create function splitzy.expenses_activity() returns trigger
language plpgsql security definer set search_path = splitzy as $$
declare
  e expenses;
  k text;
  recipients uuid[];
  gname text;
  actor_name text := (select name from persons where id = my_person_id());
begin
  if tg_op = 'DELETE' and old.group_id is not null
     and not exists (select 1 from groups where id = old.group_id) then
    return null;
  end if;
  if tg_op = 'DELETE' then
    e := old; k := 'expense_deleted'; recipients := old.participants;
  elsif tg_op = 'INSERT' then
    e := new; k := 'expense_added'; recipients := new.participants;
  else
    e := new; k := 'expense_updated';
    recipients := array(select distinct unnest(old.participants || new.participants));
  end if;
  select name into gname from groups where id = e.group_id;

  insert into activity (recipient_id, actor_id, kind, group_id, data)
  select p.user_id, my_person_id(), k, e.group_id, jsonb_build_object(
    'expense_id', e.id,
    'description', e.description,
    'amount', e.amount,
    'currency', e.currency,
    'group_name', gname,
    'actor_name', actor_name,
    'net',
      coalesce((select sum((x ->> 'amount')::bigint) from jsonb_array_elements(e.paid_by) x where x ->> 'personId' = p.id::text), 0)
      - coalesce((select sum((x ->> 'amount')::bigint) from jsonb_array_elements(e.splits) x where x ->> 'personId' = p.id::text), 0))
  from persons p
  where p.user_id is not null and (p.id = any (recipients) or p.id = my_person_id());
  return null;
end $$;

create trigger expenses_activity after insert or update or delete on splitzy.expenses
  for each row execute function splitzy.expenses_activity();

create function splitzy.settlements_activity() returns trigger
language plpgsql security definer set search_path = splitzy as $$
declare
  s settlements;
begin
  s := case when tg_op = 'DELETE' then old else new end;
  if s.group_id is not null and not exists (select 1 from groups where id = s.group_id) then
    return null;
  end if;
  perform notify_people(array[s.from_id, s.to_id],
    case when tg_op = 'DELETE' then 'settlement_deleted' else 'settlement_added' end,
    s.group_id,
    jsonb_build_object(
      'amount', s.amount, 'currency', s.currency, 'note', s.note,
      'from_id', s.from_id, 'from_name', (select name from persons where id = s.from_id),
      'to_id', s.to_id, 'to_name', (select name from persons where id = s.to_id),
      'group_name', (select name from groups where id = s.group_id)));
  return null;
end $$;

create trigger settlements_activity after insert or delete on splitzy.settlements
  for each row execute function splitzy.settlements_activity();

create function splitzy.groups_activity() returns trigger
language plpgsql security definer set search_path = splitzy as $$
declare
  g groups := case when tg_op = 'DELETE' then old else new end;
begin
  perform notify_people(array(select person_id from group_members where group_id = g.id),
    case when tg_op = 'DELETE' then 'group_deleted' else 'group_updated' end,
    g.id, jsonb_build_object('group_name', g.name));
  return case when tg_op = 'DELETE' then old else null end;
end $$;

-- BEFORE delete so the member list still exists when we notify.
create trigger groups_deleted_activity before delete on splitzy.groups
  for each row execute function splitzy.groups_activity();
create trigger groups_updated_activity after update on splitzy.groups
  for each row execute function splitzy.groups_activity();

create function splitzy.group_members_activity() returns trigger
language plpgsql security definer set search_path = splitzy as $$
declare
  m group_members := case when tg_op = 'DELETE' then old else new end;
  g groups;
begin
  select * into g from groups where id = m.group_id;
  -- Members added while creating the group are covered by the group_created entry.
  if g.id is null or (tg_op = 'INSERT' and g.created_at = now()) then return null; end if;
  perform notify_people(
    array(select person_id from group_members where group_id = m.group_id) || m.person_id,
    case when tg_op = 'DELETE' then 'member_removed' else 'member_added' end,
    m.group_id,
    jsonb_build_object('group_name', g.name, 'target_id', m.person_id,
      'target_name', (select name from persons where id = m.person_id)));
  return null;
end $$;

create trigger group_members_activity after insert or delete on splitzy.group_members
  for each row execute function splitzy.group_members_activity();

-- ───────────────────────────── Row level security ─────────────────────────────

alter table splitzy.persons enable row level security;
alter table splitzy.profiles enable row level security;
alter table splitzy.friendships enable row level security;
alter table splitzy.groups enable row level security;
alter table splitzy.group_members enable row level security;
alter table splitzy.expenses enable row level security;
alter table splitzy.settlements enable row level security;
alter table splitzy.activity enable row level security;

create policy "visible persons" on splitzy.persons for select to authenticated
  using (splitzy.can_see_person(id));
create policy "edit self or own placeholders" on splitzy.persons for update to authenticated
  using (user_id = auth.uid() or (user_id is null and created_by = splitzy.my_person_id()));

create policy "own profile" on splitzy.profiles for select to authenticated using (user_id = auth.uid());
create policy "update own profile" on splitzy.profiles for update to authenticated using (user_id = auth.uid());

create policy "own friendships" on splitzy.friendships for select to authenticated
  using (owner_id = splitzy.my_person_id() or friend_id = splitzy.my_person_id());

create policy "members see group" on splitzy.groups for select to authenticated using (splitzy.is_group_member(id));
create policy "members update group" on splitzy.groups for update to authenticated using (splitzy.is_group_member(id));
create policy "members delete group" on splitzy.groups for delete to authenticated using (splitzy.is_group_member(id));

create policy "members see members" on splitzy.group_members for select to authenticated
  using (splitzy.is_group_member(group_id));
create policy "members add members" on splitzy.group_members for insert to authenticated
  with check (splitzy.is_group_member(group_id) and splitzy.can_see_person(person_id));
create policy "members remove members" on splitzy.group_members for delete to authenticated
  using (splitzy.is_group_member(group_id));

create policy "involved see expenses" on splitzy.expenses for select to authenticated using (
  case when group_id is not null then splitzy.is_group_member(group_id) else splitzy.my_person_id() = any (participants) end);
create policy "involved add expenses" on splitzy.expenses for insert to authenticated with check (
  case when group_id is not null then splitzy.is_group_member(group_id) else splitzy.my_person_id() = any (participants) end);
create policy "involved edit expenses" on splitzy.expenses for update to authenticated
  using (case when group_id is not null then splitzy.is_group_member(group_id) else splitzy.my_person_id() = any (participants) end)
  with check (case when group_id is not null then splitzy.is_group_member(group_id) else splitzy.my_person_id() = any (participants) end);
create policy "involved delete expenses" on splitzy.expenses for delete to authenticated using (
  case when group_id is not null then splitzy.is_group_member(group_id) else splitzy.my_person_id() = any (participants) end);

create policy "involved see settlements" on splitzy.settlements for select to authenticated using (
  case when group_id is not null then splitzy.is_group_member(group_id) else splitzy.my_person_id() in (from_id, to_id) end);
create policy "involved add settlements" on splitzy.settlements for insert to authenticated with check (
  case when group_id is not null then splitzy.is_group_member(group_id) else splitzy.my_person_id() in (from_id, to_id) end);
create policy "involved delete settlements" on splitzy.settlements for delete to authenticated using (
  case when group_id is not null then splitzy.is_group_member(group_id) else splitzy.my_person_id() in (from_id, to_id) end);

create policy "own activity" on splitzy.activity for select to authenticated using (recipient_id = auth.uid());
create policy "mark own activity" on splitzy.activity for update to authenticated using (recipient_id = auth.uid());
create policy "clear own activity" on splitzy.activity for delete to authenticated using (recipient_id = auth.uid());

-- ───────────────────────────── Privileges ─────────────────────────────
-- RLS decides which rows; these grants decide which operations and columns.
-- Grant explicitly rather than relying on project defaults for newly created tables.

grant usage on schema splitzy to authenticated, service_role;
grant select, insert, update, delete on all tables in schema splitzy to authenticated;
grant all on all tables in schema splitzy to service_role;

revoke all on all tables in schema splitzy from anon;
revoke insert, update on splitzy.persons, splitzy.profiles, splitzy.friendships, splitzy.groups, splitzy.activity
  from authenticated;
revoke update on splitzy.group_members, splitzy.settlements from authenticated;
grant update (name, email, avatar_color) on splitzy.persons to authenticated;
grant update (phone, default_currency, notification_prefs) on splitzy.profiles to authenticated;
grant update (name, type, currency, simplify_debts) on splitzy.groups to authenticated;
grant update (read) on splitzy.activity to authenticated;

revoke execute on all functions in schema splitzy from public, anon;
revoke execute on function splitzy.notify_people(uuid[], text, uuid, jsonb) from authenticated;
grant execute on function
  splitzy.my_person_id(), splitzy.is_group_member(uuid), splitzy.can_see_person(uuid),
  splitzy.add_friend(text, text, text), splitzy.remove_friend(uuid), splitzy.create_group(text, text, text, boolean, uuid[]),
  splitzy.send_reminder(uuid), splitzy.ensure_profile(), splitzy.leave_splitzy()
  to authenticated;

-- ───────────────────────────── Realtime ─────────────────────────────

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table splitzy.activity;
  end if;
end $$;
