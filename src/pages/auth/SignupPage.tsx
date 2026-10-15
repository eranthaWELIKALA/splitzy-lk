import { useState, type FormEvent } from 'react';
import { MailCheck } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { errorMessage } from '@/lib/errors';
import { useAuthStore } from '@/stores/authStore';
import { AuthLayout } from './AuthLayout';

export default function SignupPage() {
  const signUp = useAuthStore((s) => s.signUp);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { needsConfirmation } = await signUp({ name, email, password });
      if (needsConfirmation) setSentTo(email.trim().toLowerCase());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <>
      Already have an account?{' '}
      <Link to="/login" className="font-medium text-primary">
        Log in
      </Link>
    </>
  );

  if (sentTo)
    return (
      <AuthLayout
        title="Check your email"
        subtitle="One more step to finish signing up."
        footer={footer}
      >
        <div className="card flex gap-3 p-4 text-sm">
          <MailCheck className="shrink-0 text-primary" size={20} />
          <p>
            We sent a confirmation link to <strong>{sentTo}</strong>. Open it on this device to sign
            in. If friends already added you by this email, their shared expenses will be waiting.
          </p>
        </div>
      </AuthLayout>
    );

  return (
    <AuthLayout title="Create your account" subtitle="It takes less than a minute." footer={footer}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextInput
          label="Full name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextInput
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="At least 8 characters."
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Creating account…' : 'Sign up'}
        </Button>
      </form>
    </AuthLayout>
  );
}
