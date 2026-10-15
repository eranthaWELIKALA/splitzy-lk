import { Link } from 'react-router';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      className="flex items-center gap-2 font-bold tracking-tight"
      aria-label="Splitzy home"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-fg">
        <svg viewBox="0 0 512 512" className="h-5 w-5" aria-hidden>
          <path
            d="M330 182C310 154 282 140 250 140C206 140 174 164 174 199C174 236 206 249 256 259C309 269 340 284 340 321C340 356 305 376 258 376C218 376 186 362 168 336"
            fill="none"
            stroke="currentColor"
            strokeWidth="52"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {!compact && <span className="text-lg">Splitzy</span>}
    </Link>
  );
}
