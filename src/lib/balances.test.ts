import { describe, expect, it } from 'vitest';
import {
  calculateEqualShares,
  calculateNetBalances,
  simplifyDebts,
  totalOwedByDebtors,
  totalSimplifiedDebtAmount,
} from './balances';

const names: Record<string, string> = {
  a: 'Zara',
  b: 'Amy',
  c: 'Mike',
};

describe('calculateEqualShares', () => {
  it('splits evenly when amount divides exactly', () => {
    const shares = calculateEqualShares(1200, ['a', 'b', 'c'], names);
    expect(shares.a).toBe(400);
    expect(shares.b).toBe(400);
    expect(shares.c).toBe(400);
    expect(Object.values(shares).reduce((s, v) => s + v, 0)).toBe(1200);
  });

  it('assigns remainder to last participant alphabetically by name', () => {
    // Sorted: Amy (b), Mike (c), Zara (a) -> last is Zara (a)
    const shares = calculateEqualShares(100, ['a', 'b', 'c'], names);
    expect(shares.b).toBe(33.33);
    expect(shares.c).toBe(33.33);
    expect(shares.a).toBe(33.34);
    expect(Object.values(shares).reduce((s, v) => s + v, 0)).toBe(100);
  });
});

describe('calculateNetBalances + settlements', () => {
  it('updates balances correctly when a settlement is recorded', () => {
    const members = ['payer', 'other'];
    const before = calculateNetBalances(
      members,
      [{ paidByUserId: 'payer', amount: 100 }],
      [
        { userId: 'payer', shareAmount: 50 },
        { userId: 'other', shareAmount: 50 },
      ],
      [],
    );
    expect(before.payer).toBe(50);
    expect(before.other).toBe(-50);

    const after = calculateNetBalances(
      members,
      [{ paidByUserId: 'payer', amount: 100 }],
      [
        { userId: 'payer', shareAmount: 50 },
        { userId: 'other', shareAmount: 50 },
      ],
      [{ fromUserId: 'other', toUserId: 'payer', amount: 30 }],
    );
    expect(after.payer).toBe(80);
    expect(after.other).toBe(-80);
    expect(after.other - before.other).toBe(-30);
    expect(after.payer - before.payer).toBe(30);
  });
});

describe('simplifyDebts', () => {
  it('simplified debt total equals total owed by debtors', () => {
    const nets = {
      u1: 150,
      u2: -90,
      u3: -40,
      u4: -20,
    };
    const debts = simplifyDebts(nets);
    const owed = totalOwedByDebtors(nets);
    const simplifiedTotal = totalSimplifiedDebtAmount(debts);
    expect(simplifiedTotal).toBe(owed);
    expect(simplifiedTotal).toBe(150);
  });

  it('returns empty when all nets are near zero', () => {
    const debts = simplifyDebts({ u1: 0.005, u2: -0.005 });
    expect(debts).toHaveLength(0);
  });
});
