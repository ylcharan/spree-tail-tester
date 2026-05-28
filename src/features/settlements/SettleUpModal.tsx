import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { formatINR } from '../../lib/format';
import type { SimplifiedDebt } from '../../lib/balances';
import { createSettlement } from '../../lib/settlementsApi';
import type { GroupMember } from '../../types/database';

interface SettleUpModalProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  debts: SimplifiedDebt[];
  members: GroupMember[];
  onSaved: () => void;
}

export function SettleUpModal({
  open,
  onClose,
  groupId,
  debts,
  members,
  onSaved,
}: SettleUpModalProps) {
  const nameByUserId = Object.fromEntries(
    members.map((m) => [m.user_id, m.display_name]),
  );
  const [selected, setSelected] = useState<SimplifiedDebt | null>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectDebt = (debt: SimplifiedDebt) => {
    setSelected(debt);
    setAmount(String(debt.amount));
    setError(null);
  };

  return (
    <Modal
      title="Settle up"
      open={open}
      onClose={() => {
        setSelected(null);
        setAmount('');
        setError(null);
        onClose();
      }}
    >
      {debts.length === 0 ? (
        <p className="text-center text-slate-600">All settled up! 🎉</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Select a debt to record payment:</p>
          <ul className="space-y-2">
            {debts.map((debt) => {
              const key = `${debt.fromUserId}-${debt.toUserId}`;
              const isActive =
                selected?.fromUserId === debt.fromUserId &&
                selected?.toUserId === debt.toUserId;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => selectDebt(debt)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                      isActive
                        ? 'border-brand-600 bg-brand-50'
                        : 'border-slate-200 hover:border-brand-300'
                    }`}
                  >
                    <span className="font-medium">
                      {nameByUserId[debt.fromUserId]}
                    </span>{' '}
                    owes{' '}
                    <span className="font-medium">
                      {nameByUserId[debt.toUserId]}
                    </span>{' '}
                    {formatINR(debt.amount)}
                  </button>
                </li>
              );
            })}
          </ul>

          {selected && (
            <form
              className="space-y-3 border-t border-slate-100 pt-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                const parsed = parseFloat(amount);
                if (Number.isNaN(parsed) || parsed < 0.01) {
                  setError('Amount must be at least ₹0.01');
                  return;
                }
                if (parsed > selected.amount + 0.001) {
                  setError(`Amount cannot exceed ${formatINR(selected.amount)}`);
                  return;
                }
                setLoading(true);
                try {
                  await createSettlement({
                    groupId,
                    fromUserId: selected.fromUserId,
                    toUserId: selected.toUserId,
                    amount: parsed,
                  });
                  setSelected(null);
                  setAmount('');
                  onSaved();
                  onClose();
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : 'Failed to record',
                  );
                } finally {
                  setLoading(false);
                }
              }}
            >
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}
              <label className="block">
                <span className="text-sm font-medium">Amount</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={selected.amount}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-brand-600 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {loading ? 'Recording…' : 'Confirm settlement'}
              </button>
            </form>
          )}
        </div>
      )}
    </Modal>
  );
}
