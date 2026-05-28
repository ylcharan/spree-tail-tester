import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SummaryCard } from '../../components/SummaryCard';
import { useApp } from '../../contexts/AppContext';
import { activityLabel, buildActivityFeed } from '../../lib/activity';
import {
  calculateNetBalances,
  isEffectivelyZero,
  simplifyDebts,
} from '../../lib/balances';
import { formatINR, namesMatch } from '../../lib/format';
import {
  addMemberToGroup,
  deleteGroup,
  fetchGroupDetail,
  removeMemberFromGroup,
  type GroupDetailData,
} from '../../lib/groupsApi';
import { deleteExpense } from '../../lib/expensesApi';
import { isSupabaseConfigured } from '../../lib/supabase';
import { ExpenseModal } from '../expenses/ExpenseModal';
import { SettleUpModal } from '../settlements/SettleUpModal';

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUserName } = useApp();
  const [data, setData] = useState<GroupDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [memberInput, setMemberInput] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const load = useCallback(async () => {
    if (!id || !isSupabaseConfigured()) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchGroupDetail(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load group');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const memberIds = useMemo(
    () => data?.members.map((m) => m.user_id) ?? [],
    [data?.members],
  );

  const nets = useMemo(() => {
    if (!data) return {};
    return calculateNetBalances(
      memberIds,
      data.expenses.map((e) => ({
        paidByUserId: e.paid_by_user_id,
        amount: Number(e.amount),
      })),
      data.participants.map((p) => ({
        userId: p.user_id,
        shareAmount: Number(p.share_amount),
      })),
      data.settlements.map((s) => ({
        fromUserId: s.from_user_id,
        toUserId: s.to_user_id,
        amount: Number(s.amount),
      })),
    );
  }, [data, memberIds]);

  const simplifiedDebts = useMemo(() => simplifyDebts(nets), [nets]);
  const nameByUserId = useMemo(
    () =>
      Object.fromEntries(
        data?.members.map((m) => [m.user_id, m.display_name]) ?? [],
      ),
    [data?.members],
  );

  const totalSpend = useMemo(
    () => data?.expenses.reduce((s, e) => s + Number(e.amount), 0) ?? 0,
    [data?.expenses],
  );

  const yourBalance = useMemo(() => {
    if (!data || !currentUserName) return null;
    const me = data.members.find((m) =>
      namesMatch(m.display_name, currentUserName),
    );
    if (!me) return null;
    return nets[me.user_id] ?? 0;
  }, [data, currentUserName, nets]);

  const activity = useMemo(
    () =>
      data
        ? buildActivityFeed(data.expenses, data.settlements, data.members)
        : [],
    [data],
  );

  if (loading) {
    return <p className="text-slate-500">Loading group…</p>;
  }

  if (error || !data) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {error ?? 'Group not found'}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-brand-600 hover:underline">
          ← Back to groups
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{data.group.name}</h1>
            {data.group.description && (
              <p className="text-sm text-slate-500">{data.group.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setDeleteConfirm(true)}
            className="text-sm text-red-600 hover:underline"
          >
            Delete group
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Total spend" value={formatINR(totalSpend)} />
        <SummaryCard
          label="Your balance"
          value={
            yourBalance === null
              ? 'Not in this group'
              : isEffectivelyZero(yourBalance)
                ? 'Settled'
                : formatINR(Math.abs(yourBalance))
          }
          subtext={
            yourBalance === null
              ? undefined
              : isEffectivelyZero(yourBalance)
                ? undefined
                : yourBalance > 0
                  ? 'you are owed'
                  : 'you owe'
          }
        />
        <SummaryCard
          label="Expenses"
          value={String(data.expenses.length)}
        />
      </div>

      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setExpenseOpen(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Add expense
        </button>
        <button
          type="button"
          onClick={() => setSettleOpen(true)}
          className="rounded-lg border border-brand-600 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
        >
          Settle up
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Members</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {data.members.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                {m.display_name.charAt(0).toUpperCase()}
              </span>
              {m.display_name}
              <button
                type="button"
                className="text-slate-400 hover:text-red-600"
                title="Remove member"
                onClick={async () => {
                  try {
                    await removeMemberFromGroup(m, data);
                    void load();
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Failed');
                  }
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input
            value={memberInput}
            onChange={(e) => setMemberInput(e.target.value)}
            placeholder="Add member"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            className="rounded-lg border border-brand-600 px-3 py-2 text-sm text-brand-700"
            onClick={async () => {
              try {
                await addMemberToGroup(id!, memberInput, data.members);
                setMemberInput('');
                void load();
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Failed');
              }
            }}
          >
            Add
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Balances</h2>
        {simplifiedDebts.length === 0 ? (
          <p className="mt-3 text-center text-slate-600">All settled up! 🎉</p>
        ) : (
          <>
            <ul className="mt-3 space-y-2">
              {data.members.map((m) => {
                const net = nets[m.user_id] ?? 0;
                if (isEffectivelyZero(net)) return null;
                return (
                  <li key={m.id} className="flex justify-between text-sm">
                    <span>{m.display_name}</span>
                    <span
                      className={
                        net > 0 ? 'text-green-700' : 'text-red-600'
                      }
                    >
                      {net > 0 ? 'gets back ' : 'owes '}
                      {formatINR(Math.abs(net))}
                    </span>
                  </li>
                );
              })}
            </ul>
            <h3 className="mt-4 text-sm font-medium text-slate-700">
              Simplified debts
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {simplifiedDebts.map((d) => (
                <li key={`${d.fromUserId}-${d.toUserId}`}>
                  {nameByUserId[d.fromUserId]} owes {nameByUserId[d.toUserId]}{' '}
                  {formatINR(d.amount)}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Activity</h2>
        {activity.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No activity yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {activity.map((item) => (
              <li
                key={`${item.kind}-${item.id}`}
                className="flex items-start justify-between gap-2 py-3 text-sm"
              >
                <div>
                  <p className="text-slate-800">{activityLabel(item)}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(item.createdAt).toLocaleString('en-IN')}
                  </p>
                </div>
                {item.kind === 'expense' && (
                  <button
                    type="button"
                    className="shrink-0 text-xs text-red-600 hover:underline"
                    onClick={async () => {
                      if (!confirm('Delete this expense?')) return;
                      try {
                        await deleteExpense(item.expense.id);
                        void load();
                      } catch (err) {
                        alert(err instanceof Error ? err.message : 'Failed');
                      }
                    }}
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ExpenseModal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        groupId={data.group.id}
        members={data.members}
        onSaved={() => void load()}
      />

      <SettleUpModal
        open={settleOpen}
        onClose={() => setSettleOpen(false)}
        groupId={data.group.id}
        debts={simplifiedDebts}
        members={data.members}
        onSaved={() => void load()}
      />

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="font-semibold">Delete group?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This permanently deletes all members, expenses, and settlements.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-slate-300 py-2 text-sm"
                onClick={() => setDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white"
                onClick={async () => {
                  try {
                    await deleteGroup(data.group.id);
                    navigate('/');
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Failed');
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
