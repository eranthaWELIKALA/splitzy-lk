import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Button } from '@/components/ui/Button';

export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error';
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="card max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm break-words text-muted">{message}</p>
        <Button className="mt-4" onClick={() => window.location.assign('/')}>
          Back to home
        </Button>
      </div>
    </div>
  );
}
