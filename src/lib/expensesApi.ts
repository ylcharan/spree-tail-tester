import { calculateEqualShares } from './balances';
import { supabase } from './supabase';
import type { GroupMember } from '../types/database';

export async function createExpense(input: {
  groupId: string;
  description: string;
  amount: number;
  paidByUserId: string;
  participantUserIds: string[];
  members: GroupMember[];
}): Promise<void> {
  if (input.amount < 0.01) throw new Error('Amount must be at least ₹0.01');
  if (input.participantUserIds.length === 0) {
    throw new Error('Select at least one participant');
  }

  const nameByUserId = Object.fromEntries(
    input.members.map((m) => [m.user_id, m.display_name]),
  );
  const shares = calculateEqualShares(
    input.amount,
    input.participantUserIds,
    nameByUserId,
  );

  const { data: expense, error: expenseError } = await supabase
    .from('expenses')
    .insert({
      group_id: input.groupId,
      description: input.description.trim(),
      amount: input.amount,
      paid_by_user_id: input.paidByUserId,
    })
    .select('id')
    .single();

  if (expenseError) throw new Error(expenseError.message);

  const rows = Object.entries(shares).map(([userId, shareAmount]) => ({
    expense_id: expense.id,
    user_id: userId,
    share_amount: shareAmount,
  }));

  const { error: partError } = await supabase
    .from('expense_participants')
    .insert(rows);
  if (partError) throw new Error(partError.message);
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
  if (error) throw new Error(error.message);
}
