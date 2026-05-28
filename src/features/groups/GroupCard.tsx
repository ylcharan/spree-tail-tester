import { Link } from 'react-router-dom';
import { formatINR } from '../../lib/format';
import type { GroupListItem } from '../../lib/groupsApi';

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'No activity yet';
  const date = new Date(iso);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface GroupCardProps {
  group: GroupListItem;
}

export function GroupCard({ group }: GroupCardProps) {
  return (
    <Link
      to={`/groups/${group.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md"
    >
      <h2 className="text-lg font-semibold text-slate-900">{group.name}</h2>
      {group.description && (
        <p className="mt-1 text-sm text-slate-500 line-clamp-1">
          {group.description}
        </p>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
        <div>
          <dt className="text-xs text-slate-400">Members</dt>
          <dd className="font-medium">{group.memberCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Total spend</dt>
          <dd className="font-medium">{formatINR(group.totalSpend)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-slate-400">
        Last activity: {formatRelativeTime(group.lastActivity)}
      </p>
    </Link>
  );
}
