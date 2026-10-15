import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { errorMessage } from '@/lib/errors';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { AuthLayout } from './AuthLayout';

export default function ResetPasswordPage() {
  const setNewPassword = useAuthStore((s) => s.setNewPassword);
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError('Passwords don’t match.');
    setBusy(true);
    try {
      await setNewPassword(password);
      toast('Password updated');
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="You’re signed in from your reset link."
      footer={null}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextInput
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="At least 8 characters."
          autoFocus
        />
        <TextInput
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy || !password}>
          {busy ? 'Saving…' : 'Set password'}
        </Button>
      </form>
    </AuthLayout>
  );
}
