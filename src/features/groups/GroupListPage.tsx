import { useCallback, useEffect, useState } from 'react';
import { isSupabaseConfigured } from '../../lib/supabase';
import { fetchGroupList, type GroupListItem } from '../../lib/groupsApi';
import { GroupCard } from './GroupCard';
import { CreateGroupModal } from './CreateGroupModal';

export function GroupListPage() {
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setError('Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setGroups(await fetchGroupList());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Your groups</h1>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          New group
        </button>
      </div>

      {loading && <p className="text-slate-500">Loading groups…</p>}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!loading && !error && groups.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          Create your first group to start splitting expenses.
        </p>
      )}

      <ul className="space-y-3">
        {groups.map((group) => (
          <li key={group.id}>
            <GroupCard group={group} />
          </li>
        ))}
      </ul>

      <CreateGroupModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void load()}
      />
    </div>
  );
}
