import { useState, type FormEvent } from 'react';
import { Check, Download, Monitor, Moon, Sparkles, Sun } from 'lucide-react';
import { InstallCard } from '@/components/InstallCard';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { SelectInput, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Segmented';
import { Switch } from '@/components/ui/Switch';
import { categoryMeta } from '@/domain/categories';
import { useCurrentAccount, useWorkspace } from '@/hooks/useWorkspace';
import { cn } from '@/lib/cn';
import { AVATAR_COLORS } from '@/lib/colors';
import { downloadFile, toCsv } from '@/lib/download';
import { CURRENCIES, fromCents } from '@/lib/money';
import { useAuthStore } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';
import type { NotificationPrefs } from '@/domain/types';
import { attempt, errorMessage } from '@/lib/errors';
import { loadSampleData } from '@/lib/sampleData';
import { PALETTES, useThemeStore, type ThemeMode } from '@/stores/themeStore';
import { toast } from '@/stores/toastStore';

type Tab = 'account' | 'appearance' | 'notifications' | 'data';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('account');
  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your account and preferences." />
      <Segmented
        ariaLabel="Settings sections"
        className="mb-6"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'account', label: 'Account' },
          { value: 'appearance', label: 'Appearance' },
          { value: 'notifications', label: 'Notifications' },
          { value: 'data', label: 'Data' },
        ]}
      />
      {tab === 'account' && <AccountSettings />}
      {tab === 'appearance' && <AppearanceSettings />}
      {tab === 'notifications' && <NotificationSettings />}
      {tab === 'data' && <DataSettings />}
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card mb-6 p-5">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function AccountSettings() {
  const account = useCurrentAccount()!;
  const updateProfile = useDataStore((s) => s.updateProfile);
  const changePassword = useAuthStore((s) => s.changePassword);
  const changeEmail = useAuthStore((s) => s.changeEmail);
  const [name, setName] = useState(account.name);
  const [phone, setPhone] = useState(account.phone ?? '');
  const [color, setColor] = useState(account.avatarColor);
  const [currency, setCurrency] = useState(account.defaultCurrency);
  const [savingProfile, setSavingProfile] = useState(false);
  const [email, setEmail] = useState(account.email);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    await attempt(
      () => updateProfile({ name, phone, avatarColor: color, defaultCurrency: currency }),
      'Profile saved',
    );
    setSavingProfile(false);
  };

  const saveEmail = async (e: FormEvent) => {
    e.preventDefault();
    const res = await attempt(() => changeEmail(email));
    if (res.ok)
      setEmailNotice(
        `Check ${email.trim().toLowerCase()} (and your current inbox) to confirm the change.`,
      );
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== confirm) return setPwError('New passwords don’t match.');
    try {
      await changePassword(current, next);
      setPwError(null);
      setCurrent('');
      setNext('');
      setConfirm('');
      toast('Password changed');
    } catch (err) {
      setPwError(errorMessage(err));
    }
  };

  return (
    <>
      <Section title="Profile" description="How you appear to friends and in groups.">
        <form onSubmit={saveProfile} className="space-y-4" noValidate>
          <div className="flex items-center gap-4">
            <Avatar name={name || account.name} color={color} size="lg" />
            <div role="radiogroup" aria-label="Avatar colour" className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={`Colour ${c}`}
                  onClick={() => setColor(c)}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 ring-offset-surface',
                    color === c && 'ring-2 ring-fg',
                  )}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check size={14} className="text-white" />}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <TextInput
              label="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
            <TextInput
              label="Phone (optional)"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
            <SelectInput
              label="Default currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.label}
                </option>
              ))}
            </SelectInput>
          </div>
          <Button type="submit" disabled={savingProfile}>
            {savingProfile ? 'Saving…' : 'Save profile'}
          </Button>
        </form>
      </Section>

      <Section title="Email" description="Friends can add you by this address.">
        <form onSubmit={saveEmail} className="flex flex-wrap items-end gap-3" noValidate>
          <TextInput
            label="Email"
            type="email"
            className="min-w-60 flex-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={email.trim().toLowerCase() === account.email}
          >
            Change email
          </Button>
        </form>
        {emailNotice && <p className="mt-2 text-sm text-muted">{emailNotice}</p>}
      </Section>

      <Section title="Password">
        <form onSubmit={savePassword} className="grid gap-3 sm:grid-cols-3" noValidate>
          <TextInput
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <TextInput
            label="New password"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <TextInput
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {pwError && (
            <p role="alert" className="text-sm text-danger sm:col-span-3">
              {pwError}
            </p>
          )}
          <div className="sm:col-span-3">
            <Button type="submit" variant="secondary" disabled={!current || !next}>
              Change password
            </Button>
          </div>
        </form>
      </Section>

      <Section
        title="Leave Splitzy"
        description="Removes your Splitzy profile, settings and notifications. Expenses you shared stay with your friends so their balances remain correct, and signing in again with this email restores your access to them."
      >
        <Button variant="danger" onClick={() => setDeleting(true)}>
          Leave Splitzy
        </Button>
      </Section>
      <DeleteAccountModal open={deleting} onClose={() => setDeleting(false)} />
    </>
  );
}

function DeleteAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const leaveSplitzy = useAuthStore((s) => s.leaveSplitzy);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await leaveSplitzy(password);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Leave Splitzy" size="sm">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-muted">Enter your password to confirm.</p>
        <TextInput
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" disabled={busy || !password}>
            {busy ? 'Leaving…' : 'Leave Splitzy'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const MODES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

function AppearanceSettings() {
  const { mode, palette, density, setMode, setPalette, setDensity } = useThemeStore();
  return (
    <>
      <Section
        title="Install app"
        description="Add Splitzy to your home screen or dock like a native app."
      >
        <InstallCard />
      </Section>
      <Section title="Theme" description="Choose light, dark, or follow your device.">
        <div role="radiogroup" aria-label="Theme mode" className="grid grid-cols-3 gap-3">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="radio"
              aria-checked={mode === id}
              onClick={() => setMode(id)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition',
                mode === id
                  ? 'border-primary bg-primary-soft text-fg'
                  : 'border-border text-muted hover:text-fg',
              )}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Accent colour" description="Used for buttons, highlights and links.">
        <div
          role="radiogroup"
          aria-label="Accent colour"
          className="grid grid-cols-3 gap-3 sm:grid-cols-6"
        >
          {PALETTES.map((p) => (
            <button
              key={p.id}
              role="radio"
              aria-checked={palette === p.id}
              onClick={() => setPalette(p.id)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border p-3 text-xs transition',
                palette === p.id
                  ? 'border-primary bg-primary-soft'
                  : 'border-border text-muted hover:text-fg',
              )}
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: p.swatch }}
              >
                {palette === p.id && <Check size={16} className="text-white" />}
              </span>
              {p.label}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Density">
        <Segmented
          ariaLabel="Density"
          className="max-w-xs"
          value={density}
          onChange={setDensity}
          options={[
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'compact', label: 'Compact' },
          ]}
        />
      </Section>
    </>
  );
}

function NotificationSettings() {
  const ws = useWorkspace();
  const setPrefs = useDataStore((s) => s.setPrefs);
  const supported = typeof Notification !== 'undefined';
  const [permission, setPermission] = useState(supported ? Notification.permission : 'denied');
  const save = (patch: Partial<NotificationPrefs>) => void attempt(() => setPrefs(patch));

  const toggleBrowser = async (on: boolean) => {
    if (!on) return save({ browser: false });
    if (!supported) return toast('Your browser doesn’t support notifications.', 'error');
    const result =
      Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
    setPermission(result);
    if (result !== 'granted')
      return toast('Notifications are blocked in your browser settings.', 'error');
    save({ browser: true });
    new Notification('Splitzy', {
      body: 'Desktop notifications are on.',
      icon: `${import.meta.env.BASE_URL}favicon.svg`,
    });
  };

  return (
    <>
      <Section
        title="Notify me about"
        description="Muted categories are still logged in Activity, but won’t count as unread."
      >
        <div className="divide-y divide-border">
          <Switch
            label="Expenses"
            description="When expenses you’re in are added, edited or deleted."
            checked={ws.prefs.expenses}
            onChange={(v) => save({ expenses: v })}
          />
          <Switch
            label="Payments"
            description="When someone settles up with you."
            checked={ws.prefs.settlements}
            onChange={(v) => save({ settlements: v })}
          />
          <Switch
            label="Groups"
            description="Group changes and member updates."
            checked={ws.prefs.groups}
            onChange={(v) => save({ groups: v })}
          />
          <Switch
            label="Friends"
            description="New friends and reminders to settle up."
            checked={ws.prefs.friends}
            onChange={(v) => save({ friends: v })}
          />
        </div>
      </Section>
      <Section title="Desktop notifications">
        <Switch
          label="Show browser notifications"
          description={
            !supported
              ? 'Not supported in this browser.'
              : permission === 'denied'
                ? 'Blocked — allow notifications for this site in your browser settings.'
                : 'Get a system notification when friends add expenses or payments. Works while Splitzy is open in a tab.'
          }
          checked={ws.prefs.browser && permission === 'granted'}
          disabled={!supported || permission === 'denied'}
          onChange={toggleBrowser}
        />
      </Section>
    </>
  );
}

function DataSettings() {
  const ws = useWorkspace();
  const [loading, setLoading] = useState(false);

  const exportJson = () =>
    downloadFile(
      `splitzy-export-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), ...ws }, null, 2),
      'application/json',
    );

  const exportCsv = () => {
    const name = (id: string) => ws.people[id]?.name ?? 'Unknown';
    const rows: (string | number)[][] = [
      ['Date', 'Description', 'Group', 'Category', 'Amount', 'Currency', 'Paid by', 'Split'],
      ...Object.values(ws.expenses)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((e) => [
          e.date,
          e.description,
          e.groupId ? (ws.groups[e.groupId]?.name ?? '') : '',
          categoryMeta(e.category).label,
          fromCents(e.amount),
          e.currency,
          e.paidBy.map((p) => `${name(p.personId)} ${fromCents(p.amount)}`).join('; '),
          e.splits.map((s) => `${name(s.personId)} ${fromCents(s.amount)}`).join('; '),
        ]),
    ];
    downloadFile('splitzy-expenses.csv', toCsv(rows), 'text/csv');
  };

  return (
    <>
      <Section title="Export" description="Download a copy of everything you can see.">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportJson}>
            <Download size={16} /> All data (JSON)
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={!Object.keys(ws.expenses).length}>
            <Download size={16} /> Expenses (CSV)
          </Button>
        </div>
      </Section>
      <Section
        title="Sample data"
        description="Adds three example friends (not real accounts), two groups and a few expenses so you can try things out."
      >
        <Button
          variant="secondary"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            await attempt(loadSampleData, 'Sample data loaded');
            setLoading(false);
          }}
        >
          <Sparkles size={16} /> {loading ? 'Loading…' : 'Load sample data'}
        </Button>
      </Section>
    </>
  );
}
