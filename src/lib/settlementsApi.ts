import { supabase } from './supabase';

export async function createSettlement(input: {
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
}): Promise<void> {
  if (input.fromUserId === input.toUserId) {
    throw new Error('Payer and recipient must be different');
  }
  if (input.amount < 0.01) throw new Error('Amount must be at least ₹0.01');

  const { error } = await supabase.from('settlements').insert({
    group_id: input.groupId,
    from_user_id: input.fromUserId,
    to_user_id: input.toUserId,
    amount: input.amount,
  });
  if (error) throw new Error(error.message);
}
