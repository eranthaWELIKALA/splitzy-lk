// @vitest-environment node
/**
 * Runs the real migration in PGlite (Postgres compiled to WASM) against a minimal stub of
 * Supabase's auth schema, then exercises RLS policies, triggers and RPCs as different users.
 */
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const AUTH_STUB = `
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique not null,
    raw_user_meta_data jsonb not null default '{}'
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`;

const migrationsDir = join(__dirname, 'migrations');
let db: PGlite;

/** Run statements as the given auth user (or as the superuser when `uid` is null). */
async function as<T = Record<string, unknown>>(
  uid: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? '']);
  if (uid) await db.exec('set role authenticated');
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec('reset role');
  }
}

/** Create an auth user, as any app sharing the project would. */
async function createAuthUser(email: string, name: string): Promise<string> {
  const [user] = await as<{ id: string }>(
    null,
    `insert into auth.users (email, raw_user_meta_data) values ($1, jsonb_build_object('name', $2::text)) returning id`,
    [email, name],
  );
  return user!.id;
}

/** Create an auth user and open Splitzy as them (which creates their Splitzy profile). */
async function signUp(email: string, name: string): Promise<{ uid: string; pid: string }> {
  const uid = await createAuthUser(email, name);
  const [row] = await as<{ ensure_profile: string }>(uid, 'select ensure_profile()');
  return { uid, pid: row!.ensure_profile };
}

const expense = (
  groupId: string | null,
  amount: number,
  paidBy: [string, number][],
  splits: [string, number][],
) => [
  groupId,
  amount,
  JSON.stringify(paidBy.map(([personId, a]) => ({ personId, amount: a }))),
  JSON.stringify(splits.map(([personId, a]) => ({ personId, amount: a }))),
];
const INSERT_EXPENSE = `
  insert into expenses (group_id, description, amount, currency, paid_by, split_method, splits)
  values ($1, 'Dinner', $2, 'LKR', $3::jsonb, 'exact', $4::jsonb) returning id`;

let alice: { uid: string; pid: string };
let bob: { uid: string; pid: string };
let carol: { uid: string; pid: string };
let groupId: string;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(AUTH_STUB);
  // Run migrations with Supabase's default search path, as the SQL Editor does, so any
  // unqualified reference to the splitzy schema fails here too.
  await db.exec('set search_path to "$user", public, extensions');
  for (const file of readdirSync(migrationsDir).sort()) {
    await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
  }
  // Unqualified table names in the tests themselves refer to the splitzy schema.
  await db.exec('set search_path to splitzy, public');
  alice = await signUp('alice@example.com', 'Alice');
  carol = await signUp('carol@example.com', 'Carol');
}, 30_000);

describe('accounts', () => {
  it('ignores users of other apps in the same project until they open Splitzy', async () => {
    const before = await as(null, 'select count(*)::int as n from persons');
    const uid = await createAuthUser('other-app@example.com', 'Other');
    expect(await as(null, 'select count(*)::int as n from persons')).toEqual(before);
    expect(await as(uid, 'select * from profiles')).toEqual([]);
  });

  it('creates the profile once, even when called repeatedly', async () => {
    const [again] = await as<{ ensure_profile: string }>(alice.uid, 'select ensure_profile()');
    expect(again!.ensure_profile).toBe(alice.pid);
    expect(
      await as(null, 'select count(*)::int as n from profiles where user_id = $1', [alice.uid]),
    ).toEqual([{ n: 1 }]);
  });

  it('creates a person and profile when a user first opens Splitzy', async () => {
    const rows = await as(alice.uid, 'select default_currency, person_id from profiles');
    expect(rows).toEqual([{ default_currency: 'LKR', person_id: alice.pid }]);
  });

  it('links a placeholder friend to their account when they sign up', async () => {
    const [{ add_friend: placeholder }] = await as<{ add_friend: string }>(
      alice.uid,
      `select add_friend('Bobby', 'BOB@example.com')`,
    );
    bob = await signUp('bob@example.com', 'Bob');
    expect(bob.pid).toBe(placeholder);
    const friends = await as(bob.uid, 'select friend_id from friendships where owner_id = $1', [
      bob.pid,
    ]);
    expect(friends).toEqual([{ friend_id: alice.pid }]);
  });

  it('hides strangers from each other', async () => {
    const seen = await as<{ name: string }>(carol.uid, 'select name from persons order by name');
    expect(seen.map((p) => p.name)).toEqual(['Carol']);
  });

  it('only lets people edit their own or their placeholder persons', async () => {
    await as(carol.uid, `update persons set name = 'Hacked' where id = $1`, [alice.pid]);
    const [row] = await as<{ name: string }>(null, 'select name from persons where id = $1', [
      alice.pid,
    ]);
    expect(row!.name).toBe('Alice');
    await expect(
      as(alice.uid, 'update persons set user_id = null where id = $1', [alice.pid]),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('groups and expenses', () => {
  it('creates a group with members via RPC', async () => {
    const [row] = await as<{ create_group: string }>(
      alice.uid,
      `select create_group('Trip', 'trip', 'LKR', true, array[$1]::uuid[])`,
      [bob.pid],
    );
    groupId = row!.create_group;
    const members = await as(bob.uid, 'select person_id from group_members where group_id = $1', [
      groupId,
    ]);
    expect(members).toHaveLength(2);
    expect(await as(carol.uid, 'select * from groups')).toEqual([]);
  });

  it('accepts a balanced expense and notifies participants with their net amount', async () => {
    const [row] = await as<{ id: string }>(
      alice.uid,
      INSERT_EXPENSE,
      expense(
        groupId,
        1000,
        [[alice.pid, 1000]],
        [
          [alice.pid, 500],
          [bob.pid, 500],
        ],
      ),
    );
    expect(row!.id).toBeTruthy();
    const [stored] = await as<{ created_by: string; participants: string[] }>(
      bob.uid,
      'select created_by, participants from expenses',
    );
    expect(stored!.created_by).toBe(alice.pid);
    expect([...stored!.participants].sort()).toEqual([alice.pid, bob.pid].sort());

    const bobFeed = await as<{ kind: string; data: { net: number; actor_name: string } }>(
      bob.uid,
      `select kind, data from activity where kind = 'expense_added'`,
    );
    expect(bobFeed[0]!.data).toMatchObject({ net: -500, actor_name: 'Alice' });
    const aliceFeed = await as<{ data: { net: number } }>(
      alice.uid,
      `select data from activity where kind = 'expense_added'`,
    );
    expect(aliceFeed[0]!.data.net).toBe(500);
  });

  it('rejects unbalanced expenses', async () => {
    await expect(
      as(
        alice.uid,
        INSERT_EXPENSE,
        expense(groupId, 1000, [[alice.pid, 900]], [[alice.pid, 1000]]),
      ),
    ).rejects.toThrow(/add up/);
  });

  it('rejects group expenses involving non-members', async () => {
    await expect(
      as(
        alice.uid,
        INSERT_EXPENSE,
        expense(groupId, 1000, [[alice.pid, 1000]], [[carol.pid, 1000]]),
      ),
    ).rejects.toThrow(/member/);
  });

  it('stops outsiders adding expenses or payments to a group', async () => {
    await expect(
      as(carol.uid, INSERT_EXPENSE, expense(groupId, 100, [[carol.pid, 100]], [[carol.pid, 100]])),
    ).rejects.toThrow();
    await expect(
      as(
        carol.uid,
        `insert into settlements (group_id, from_id, to_id, amount, currency) values ($1, $2, $3, 100, 'LKR')`,
        [groupId, bob.pid, alice.pid],
      ),
    ).rejects.toThrow();
  });

  it('lets a member record a settlement and notifies both sides', async () => {
    await as(
      bob.uid,
      `insert into settlements (group_id, from_id, to_id, amount, currency) values ($1, $2, $3, 500, 'LKR')`,
      [groupId, bob.pid, alice.pid],
    );
    const feed = await as<{ data: { from_name: string } }>(
      alice.uid,
      `select data from activity where kind = 'settlement_added'`,
    );
    expect(feed[0]!.data.from_name).toBe('Bob');
  });

  it('keeps non-group expenses private to participants', async () => {
    await as(
      alice.uid,
      INSERT_EXPENSE,
      expense(
        null,
        300,
        [[bob.pid, 300]],
        [
          [alice.pid, 150],
          [bob.pid, 150],
        ],
      ),
    );
    expect(await as(bob.uid, 'select id from expenses where group_id is null')).toHaveLength(1);
    expect(await as(carol.uid, 'select id from expenses')).toEqual([]);
    // Carol can't split with Alice, who isn't her friend.
    await expect(
      as(carol.uid, INSERT_EXPENSE, expense(null, 100, [[carol.pid, 100]], [[alice.pid, 100]])),
    ).rejects.toThrow(/friends/);
  });

  it('summarises a group delete as one notification instead of one per expense', async () => {
    await as(bob.uid, 'delete from groups where id = $1', [groupId]);
    const kinds = await as<{ kind: string }>(
      alice.uid,
      `select kind from activity where kind in ('group_deleted', 'expense_deleted')`,
    );
    expect(kinds.map((k) => k.kind)).toEqual(['group_deleted']);
    expect(await as(alice.uid, 'select id from expenses where group_id is not null')).toEqual([]);
  });
});

describe('activity and privileges', () => {
  it('shows each user only their own activity and lets them mark it read', async () => {
    const mine = await as<{ recipient_id: string }>(bob.uid, 'select recipient_id from activity');
    expect(mine.every((a) => a.recipient_id === bob.uid)).toBe(true);
    await as(bob.uid, 'update activity set read = true');
    expect(await as(bob.uid, 'select id from activity where not read')).toEqual([]);
    await expect(as(bob.uid, `update activity set kind = 'x'`)).rejects.toThrow(
      /permission denied/,
    );
  });

  it('does not let clients write activity directly', async () => {
    await expect(
      as(carol.uid, `select notify_people(array[$1]::uuid[], 'x', null, '{}')`, [alice.pid]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(carol.uid, `insert into activity (recipient_id, kind) values ($1, 'x')`, [alice.uid]),
    ).rejects.toThrow(/permission denied/);
  });

  it('syncs a changed auth email on the next load', async () => {
    await as(null, `update auth.users set email = 'alice.new@example.com' where id = $1`, [
      alice.uid,
    ]);
    await as(alice.uid, 'select ensure_profile()');
    const [row] = await as<{ email: string }>(null, 'select email from persons where id = $1', [
      alice.pid,
    ]);
    expect(row!.email).toBe('alice.new@example.com');
    // Clients can't change a registered user's email directly.
    await as(alice.uid, `update persons set email = 'spoof@example.com' where id = $1`, [
      alice.pid,
    ]);
    const [after] = await as<{ email: string }>(null, 'select email from persons where id = $1', [
      alice.pid,
    ]);
    expect(after!.email).toBe('alice.new@example.com');
  });

  it('leaving Splitzy keeps the shared login and friends’ history, and rejoining relinks it', async () => {
    await as(carol.uid, 'select leave_splitzy()');
    expect(await as(null, 'select id from auth.users where id = $1', [carol.uid])).toHaveLength(1);
    const [row] = await as<{ user_id: string | null; name: string }>(
      null,
      'select user_id, name from persons where id = $1',
      [carol.pid],
    );
    expect(row).toEqual({ user_id: null, name: 'Carol' });
    expect(await as(carol.uid, 'select * from profiles')).toEqual([]);

    const [back] = await as<{ ensure_profile: string }>(carol.uid, 'select ensure_profile()');
    expect(back!.ensure_profile).toBe(carol.pid);
  });
});
