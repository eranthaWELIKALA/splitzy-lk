import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { pickColor } from '@/lib/colors';
import { errorMessage, toError } from '@/lib/errors';
import { appUrl, supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { toast } from './toastStore';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: Status;
  session: Session | null;
  /** True after following a password-reset link, until a new password is set. */
  recovery: boolean;
  init: () => () => void;
  signUp: (input: {
    name: string;
    email: string;
    password: string;
  }) => Promise<{ needsConfirmation: boolean }>;
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  setNewPassword: (password: string) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  changeEmail: (email: string) => Promise<void>;
  /** Remove the user's Splitzy profile. The login itself is shared with other apps and kept. */
  leaveSplitzy: (password: string) => Promise<void>;
}

function validatePassword(pw: string) {
  if (pw.length < 8) throw new Error('Password must be at least 8 characters.');
}

/** Remove auth params (`code`, `type`, errors) from the URL, keeping the hash route. */
function cleanAuthParams() {
  const url = new URL(window.location.href);
  const keys = ['code', 'type', 'error', 'error_code', 'error_description'];
  if (!keys.some((k) => url.searchParams.has(k))) return;
  keys.forEach((k) => url.searchParams.delete(k));
  window.history.replaceState(window.history.state, '', url.toString());
}

export const useAuthStore = create<AuthState>()((set, get) => {
  const reauthenticate = async (password: string) => {
    const email = get().session?.user.email;
    if (!email) throw new Error('Not signed in.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Password is incorrect.');
  };

  return {
    status: 'loading',
    session: null,
    recovery: false,

    init() {
      const params = new URLSearchParams(window.location.search);
      const hadCode = params.has('code');
      if (params.get('type') === 'recovery') set({ recovery: true });
      const urlError = params.get('error_description');

      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        // Keep this callback synchronous: calling Supabase from inside it can deadlock.
        if (event === 'PASSWORD_RECOVERY') set({ recovery: true });
        set({ session, status: session ? 'signedIn' : 'signedOut' });
      });

      void supabase.auth.getSession().then(({ data: { session } }) => {
        set({ session, status: session ? 'signedIn' : 'signedOut' });
        if (urlError) toast(urlError.replace(/\+/g, ' '), 'error');
        else if (hadCode && !session)
          toast(
            'Your email is confirmed. Please log in — the link was opened in a different browser or expired.',
            'info',
          );
        cleanAuthParams();
      });

      return () => data.subscription.unsubscribe();
    },

    async signUp({ name, email, password }) {
      const mail = email.trim().toLowerCase();
      if (!name.trim()) throw new Error('Name is required.');
      if (!EMAIL_RE.test(mail)) throw new Error('Enter a valid email address.');
      validatePassword(password);
      const { data, error } = await supabase.auth.signUp({
        email: mail,
        password,
        options: {
          data: { name: name.trim(), avatar_color: pickColor(mail) },
          emailRedirectTo: appUrl(),
        },
      });
      if (error) throw toError(error);
      // With email confirmation on, Supabase returns a user with no identities for an existing email.
      if (data.user && data.user.identities?.length === 0)
        throw new Error('An account with this email already exists.');
      return { needsConfirmation: !data.session };
    },

    async logIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        throw new Error(
          error.code === 'email_not_confirmed'
            ? 'Confirm your email first — check your inbox.'
            : 'Incorrect email or password.',
        );
      }
    },

    async logOut() {
      const { error } = await supabase.auth.signOut();
      if (error) toast(errorMessage(error), 'error');
      set({ recovery: false });
    },

    async sendPasswordReset(email) {
      const mail = email.trim().toLowerCase();
      if (!EMAIL_RE.test(mail)) throw new Error('Enter a valid email address.');
      const { error } = await supabase.auth.resetPasswordForEmail(mail, {
        redirectTo: `${appUrl()}?type=recovery`,
      });
      if (error) throw toError(error);
    },

    async setNewPassword(password) {
      validatePassword(password);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw toError(error);
      set({ recovery: false });
    },

    async changePassword(current, next) {
      validatePassword(next);
      await reauthenticate(current);
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw toError(error);
    },

    async changeEmail(email) {
      const mail = email.trim().toLowerCase();
      if (!EMAIL_RE.test(mail)) throw new Error('Enter a valid email address.');
      const { error } = await supabase.auth.updateUser(
        { email: mail },
        { emailRedirectTo: appUrl() },
      );
      if (error) throw toError(error);
    },

    async leaveSplitzy(password) {
      await reauthenticate(password);
      await api.leaveSplitzy();
      await supabase.auth.signOut({ scope: 'local' });
    },
  };
});

export const useUserId = () => useAuthStore((s) => s.session?.user.id ?? null);
