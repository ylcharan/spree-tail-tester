import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import { createGroupWithMembers } from '../../lib/groupsApi';

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateGroupModal({
  open,
  onClose,
  onCreated,
}: CreateGroupModalProps) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const addMember = () => {
    const trimmed = memberInput.trim();
    if (!trimmed) return;
    const exists = members.some(
      (m) => m.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) {
      setError('Member name already added');
      return;
    }
    setMembers((prev) => [...prev, trimmed]);
    setMemberInput('');
    setError(null);
  };

  const reset = () => {
    setName('');
    setDescription('');
    setMemberInput('');
    setMembers([]);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal title="Create group" open={open} onClose={handleClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          if (members.length < 2) {
            setError('Add at least 2 members');
            return;
          }
          setLoading(true);
          try {
            const groupId = await createGroupWithMembers({
              name,
              description,
              memberNames: members,
            });
            reset();
            onCreated();
            onClose();
            navigate(`/groups/${groupId}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create group');
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
          <span className="text-sm font-medium">Group name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Description (optional)</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <div>
          <span className="text-sm font-medium">Members</span>
          <p className="text-xs text-slate-500">Best for 2–8 people</p>
          <div className="mt-2 flex gap-2">
            <input
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addMember();
                }
              }}
              placeholder="Member name"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
            />
            <button
              type="button"
              onClick={addMember}
              className="rounded-lg border border-brand-600 px-3 py-2 text-brand-700"
            >
              Add
            </button>
          </div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {members.map((m) => (
              <li
                key={m}
                className="flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-800"
              >
                {m}
                <button
                  type="button"
                  className="text-brand-600"
                  onClick={() =>
                    setMembers((prev) => prev.filter((x) => x !== m))
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-600 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create group'}
        </button>
      </form>
    </Modal>
  );
}
