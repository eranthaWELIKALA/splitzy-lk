import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import type { ID } from '@/domain/types';
import { EMAIL_RE } from '@/stores/authStore';
import { useDataStore } from '@/stores/dataStore';
import { toast } from '@/stores/toastStore';
import { errorMessage } from '@/lib/errors';

export function AddFriendModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded?: (id: ID) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Add a friend" size="sm">
      {open && <AddFriendForm onClose={onClose} onAdded={onAdded} />}
    </Modal>
  );
}

function AddFriendForm({ onClose, onAdded }: { onClose: () => void; onAdded?: (id: ID) => void }) {
  const addFriend = useDataStore((s) => s.addFriend);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (email && !EMAIL_RE.test(email.trim())) return setError('Enter a valid email address.');
    setBusy(true);
    try {
      const id = await addFriend({ name, email });
      toast(`${useDataStore.getState().ws.people[id]?.name ?? name.trim()} added`);
      onAdded?.(id);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <TextInput
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        required
        maxLength={60}
      />
      <TextInput
        label="Email (optional)"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        hint="If they already use Splitzy, you’ll be connected. Otherwise they’ll see your shared expenses when they sign up with this email."
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
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? 'Adding…' : 'Add friend'}
        </Button>
      </div>
    </form>
  );
}
