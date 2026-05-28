import { formatINR } from './format';
import type { Expense, GroupMember, Settlement } from '../types/database';

export type ActivityItem =
  | {
      kind: 'expense';
      id: string;
      createdAt: string;
      expense: Expense;
      payerName: string;
    }
  | {
      kind: 'settlement';
      id: string;
      createdAt: string;
      settlement: Settlement;
      fromName: string;
      toName: string;
    };

export function buildActivityFeed(
  expenses: Expense[],
  settlements: Settlement[],
  members: GroupMember[],
): ActivityItem[] {
  const nameByUserId = Object.fromEntries(
    members.map((m) => [m.user_id, m.display_name]),
  );

  const items: ActivityItem[] = [
    ...expenses.map((expense) => ({
      kind: 'expense' as const,
      id: expense.id,
      createdAt: expense.created_at,
      expense,
      payerName: nameByUserId[expense.paid_by_user_id] ?? 'Unknown',
    })),
    ...settlements.map((settlement) => ({
      kind: 'settlement' as const,
      id: settlement.id,
      createdAt: settlement.created_at,
      settlement,
      fromName: nameByUserId[settlement.from_user_id] ?? 'Unknown',
      toName: nameByUserId[settlement.to_user_id] ?? 'Unknown',
    })),
  ];

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function activityLabel(item: ActivityItem): string {
  if (item.kind === 'expense') {
    return `${item.payerName} paid ${formatINR(Number(item.expense.amount))} for ${item.expense.description}`;
  }
  return `${item.fromName} paid ${item.toName} ${formatINR(Number(item.settlement.amount))}`;
}
