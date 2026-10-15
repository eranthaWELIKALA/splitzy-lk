import { Link } from 'react-router';
import { EmptyState } from '@/components/ui/EmptyState';

export default function NotFoundPage() {
  return (
    <div className="card">
      <EmptyState
        title="Page not found"
        description="This page doesn't exist or the item was deleted."
        action={
          <Link to="/" className="text-sm font-medium text-primary">
            Back to dashboard
          </Link>
        }
      />
    </div>
  );
}
