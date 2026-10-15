import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';
import { cn } from '@/lib/cn';

const icons = { success: CheckCircle2, error: XCircle, info: Info };

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
    >
      {toasts.map((t) => {
        const Icon = icons[t.tone];
        return (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className="pointer-events-auto flex max-w-md items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-lg"
          >
            <Icon
              size={18}
              className={cn(
                t.tone === 'success' && 'text-positive',
                t.tone === 'error' && 'text-danger',
                t.tone === 'info' && 'text-primary',
              )}
            />
            {t.message}
          </button>
        );
      })}
    </div>
  );
}
