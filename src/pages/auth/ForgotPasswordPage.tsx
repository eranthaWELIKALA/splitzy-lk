import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { errorMessage } from '@/lib/errors';
import { useAuthStore } from '@/stores/authStore';
import { AuthLayout } from './AuthLayout';

export default function ForgotPasswordPage() {
  const sendPasswordReset = useAuthStore((s) => s.sendPasswordReset);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We’ll email you a link to choose a new one."
      footer={
        <Link to="/login" className="font-medium text-primary">
          Back to log in
        </Link>
      }
    >
      {sent ? (
        <p className="card p-4 text-sm">
          If an account exists for <strong>{email.trim().toLowerCase()}</strong>, a reset link is on
          its way. Open it on this device.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <TextInput
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy || !email}>
            {busy ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
