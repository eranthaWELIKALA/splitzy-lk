/** Shown when the build has no Supabase credentials, instead of failing on every request. */
export function SetupNotice() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="card max-w-lg p-6">
        <h1 className="text-lg font-semibold">Splitzy isn’t connected to Supabase yet</h1>
        <p className="mt-2 text-sm text-muted">
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> — in{' '}
          <code>.env.local</code> for local development, or as GitHub Actions secrets for the Pages
          deployment — then rebuild.
        </p>
      </div>
    </div>
  );
}
