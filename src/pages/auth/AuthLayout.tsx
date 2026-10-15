import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-12 text-primary-fg lg:flex">
        <div className="[&_a]:text-primary-fg [&_span:first-child]:bg-primary-fg/15">
          <Logo />
        </div>
        <div>
          <h2 className="text-4xl leading-tight font-bold">
            Less awkward money talk.
            <br />
            More good times.
          </h2>
          <p className="mt-4 max-w-md opacity-85">
            Track shared bills, split them any way you like, and settle up with friends, flatmates
            and travel buddies.
          </p>
        </div>
        <p className="text-sm opacity-70">Equal · Exact · Percent · Shares · Adjustment splits</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 mb-6 text-sm text-muted">{subtitle}</p>
          {children}
          <p className="mt-6 text-center text-sm text-muted">{footer}</p>
        </div>
      </div>
    </div>
  );
}
