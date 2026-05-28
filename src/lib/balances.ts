export const ZERO_THRESHOLD = 0.01;

export interface ExpenseForBalance {
  paidByUserId: string;
  amount: number;
}

export interface ParticipantForBalance {
  userId: string;
  shareAmount: number;
}

export interface SettlementForBalance {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

export interface SimplifiedDebt {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function isEffectivelyZero(net: number): boolean {
  return Math.abs(roundMoney(net)) < ZERO_THRESHOLD;
}

/** Sort participant ids by display name ascending (case-insensitive) */
export function sortParticipantIdsByName(
  participantIds: string[],
  nameByUserId: Record<string, string>,
): string[] {
  return [...participantIds].sort((a, b) =>
    (nameByUserId[a] ?? '')
      .trim()
      .toLowerCase()
      .localeCompare((nameByUserId[b] ?? '').trim().toLowerCase()),
  );
}

/**
 * Equal split with 2 decimal places; last participant (alphabetical by name) gets remainder.
 */
export function calculateEqualShares(
  amount: number,
  participantIds: string[],
  nameByUserId: Record<string, string>,
): Record<string, number> {
  if (participantIds.length === 0) {
    throw new Error('At least one participant is required');
  }

  const sorted = sortParticipantIdsByName(participantIds, nameByUserId);
  const n = sorted.length;
  const totalCents = Math.round(roundMoney(amount) * 100);
  const baseCents = Math.floor(totalCents / n);
  const remainderCents = totalCents - baseCents * n;

  const shares: Record<string, number> = {};
  for (let i = 0; i < n - 1; i++) {
    shares[sorted[i]] = baseCents / 100;
  }
  const lastId = sorted[n - 1];
  shares[lastId] = (baseCents + remainderCents) / 100;

  return shares;
}

export function calculateNetBalances(
  memberIds: string[],
  expenses: ExpenseForBalance[],
  participants: ParticipantForBalance[],
  settlements: SettlementForBalance[],
): Record<string, number> {
  const nets: Record<string, number> = {};
  for (const id of memberIds) {
    nets[id] = 0;
  }

  for (const expense of expenses) {
    if (nets[expense.paidByUserId] !== undefined) {
      nets[expense.paidByUserId] = roundMoney(
        nets[expense.paidByUserId] + expense.amount,
      );
    }
  }

  for (const row of participants) {
    if (nets[row.userId] !== undefined) {
      nets[row.userId] = roundMoney(nets[row.userId] - row.shareAmount);
    }
  }

  for (const settlement of settlements) {
    if (nets[settlement.fromUserId] !== undefined) {
      nets[settlement.fromUserId] = roundMoney(
        nets[settlement.fromUserId] - settlement.amount,
      );
    }
    if (nets[settlement.toUserId] !== undefined) {
      nets[settlement.toUserId] = roundMoney(
        nets[settlement.toUserId] + settlement.amount,
      );
    }
  }

  return nets;
}

/** Greedy: match largest creditor with largest debtor */
export function simplifyDebts(nets: Record<string, number>): SimplifiedDebt[] {
  const creditors: { id: string; net: number }[] = [];
  const debtors: { id: string; net: number }[] = [];

  for (const [id, rawNet] of Object.entries(nets)) {
    const net = roundMoney(rawNet);
    if (isEffectivelyZero(net)) continue;
    if (net > 0) creditors.push({ id, net });
    else debtors.push({ id, net: net });
  }

  creditors.sort((a, b) => b.net - a.net);
  debtors.sort((a, b) => a.net - b.net);

  const debts: SimplifiedDebt[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const transfer = roundMoney(
      Math.min(Math.abs(debtor.net), creditor.net),
    );

    if (transfer < ZERO_THRESHOLD) {
      if (Math.abs(debtor.net) <= Math.abs(creditor.net)) i++;
      else j++;
      continue;
    }

    debts.push({
      fromUserId: debtor.id,
      toUserId: creditor.id,
      amount: transfer,
    });

    debtor.net = roundMoney(debtor.net + transfer);
    creditor.net = roundMoney(creditor.net - transfer);

    if (isEffectivelyZero(debtor.net)) i++;
    if (isEffectivelyZero(creditor.net)) j++;
  }

  return debts;
}

/** Sum of amounts owed by debtors (absolute negative nets above threshold) */
export function totalOwedByDebtors(nets: Record<string, number>): number {
  return roundMoney(
    Object.values(nets)
      .filter((n) => roundMoney(n) < -ZERO_THRESHOLD)
      .reduce((sum, n) => sum + Math.abs(roundMoney(n)), 0),
  );
}

export function totalSimplifiedDebtAmount(debts: SimplifiedDebt[]): number {
  return roundMoney(debts.reduce((sum, d) => sum + d.amount, 0));
}
