import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { createExpense } from '../../lib/expensesApi';
import type { GroupMember } from '../../types/database';

interface ExpenseModalProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  members: GroupMember[];
  onSaved: () => void;
}

export function ExpenseModal({
  open,
  onClose,
  groupId,
  members,
  onSaved,
}: ExpenseModalProps) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState('');
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && members.length > 0) {
      setPayerId(members[0].user_id);
      setParticipantIds(members.map((m) => m.user_id));
    }
  }, [open, members]);

  const reset = () => {
    setDescription('');
    setAmount('');
    setError(null);
  };

  const toggleParticipant = (userId: string) => {
    setParticipantIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  return (
    <Modal
      title="Add expense"
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          const parsed = parseFloat(amount);
          if (Number.isNaN(parsed) || parsed < 0.01) {
            setError('Enter an amount of at least ₹0.01');
            return;
          }
          setLoading(true);
          try {
            await createExpense({
              groupId,
              description,
              amount: parsed,
              paidByUserId: payerId,
              participantUserIds: participantIds,
              members,
            });
            reset();
            onSaved();
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
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
          <span className="text-sm font-medium">Description</span>
          <input
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Amount (INR)</span>
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Paid by</span>
          <select
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.display_name}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className="text-sm font-medium">Split between</legend>
          <ul className="mt-2 space-y-2">
            {members.map((m) => (
              <li key={m.user_id}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={participantIds.includes(m.user_id)}
                    onChange={() => toggleParticipant(m.user_id)}
                  />
                  {m.display_name}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-600 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save expense'}
        </button>
      </form>
    </Modal>
  );
}
