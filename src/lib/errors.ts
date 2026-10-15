import { toast } from '@/stores/toastStore';

const FRIENDLY: Record<string, string> = {
  '23505': 'That email is already used by someone else.',
  '42501': 'You don’t have permission to do that.',
  PGRST116: 'That item no longer exists.',
};

/** Normalise Supabase/PostgREST/auth errors and thrown values into a readable message. */
export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object') {
    const { code, message } = e as { code?: string; message?: string };
    if (code && FRIENDLY[code]) return FRIENDLY[code];
    if (message === 'Failed to fetch') return 'Can’t reach the server. Check your connection.';
    if (message) return message;
  }
  return typeof e === 'string' ? e : 'Something went wrong.';
}

export function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(errorMessage(e));
}

type Outcome<T> = { ok: true; value: T } | { ok: false; error: string };

/** Run an async action, toasting the error (and optional success message). Never throws. */
export async function attempt<T>(fn: () => Promise<T>, success?: string): Promise<Outcome<T>> {
  try {
    const value = await fn();
    if (success) toast(success);
    return { ok: true, value };
  } catch (e) {
    const error = errorMessage(e);
    toast(error, 'error');
    return { ok: false, error };
  }
}
