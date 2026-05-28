import { normalizeName } from './format';
import { supabase } from './supabase';
import type {
  Expense,
  ExpenseParticipant,
  Group,
  GroupMember,
  Settlement,
} from '../types/database';

export interface GroupListItem extends Group {
  memberCount: number;
  totalSpend: number;
  lastActivity: string | null;
}

export interface GroupDetailData {
  group: Group;
  members: GroupMember[];
  expenses: Expense[];
  participants: ExpenseParticipant[];
  settlements: Settlement[];
}

export async function fetchGroupList(): Promise<GroupListItem[]> {
  const [groupsRes, membersRes, expensesRes, settlementsRes] = await Promise.all([
    supabase.from('groups').select('*').order('created_at', { ascending: false }),
    supabase.from('group_members').select('group_id'),
    supabase.from('expenses').select('group_id, amount, created_at'),
    supabase.from('settlements').select('group_id, created_at'),
  ]);

  if (groupsRes.error) throw new Error(groupsRes.error.message);
  if (membersRes.error) throw new Error(membersRes.error.message);
  if (expensesRes.error) throw new Error(expensesRes.error.message);
  if (settlementsRes.error) throw new Error(settlementsRes.error.message);

  const groups = groupsRes.data ?? [];
  const members = membersRes.data ?? [];
  const expenses = expensesRes.data ?? [];
  const settlements = settlementsRes.data ?? [];

  return groups.map((group) => {
    const groupExpenses = expenses.filter((e) => e.group_id === group.id);
    const groupSettlements = settlements.filter((s) => s.group_id === group.id);
    const activities = [
      ...groupExpenses.map((e) => e.created_at),
      ...groupSettlements.map((s) => s.created_at),
    ];
    return {
      ...group,
      memberCount: members.filter((m) => m.group_id === group.id).length,
      totalSpend: groupExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
      lastActivity:
        activities.length > 0
          ? activities.sort((a, b) => b.localeCompare(a))[0]
          : null,
    };
  }).sort((a, b) => {
    const aTime = a.lastActivity ?? a.created_at;
    const bTime = b.lastActivity ?? b.created_at;
    return bTime.localeCompare(aTime);
  });
}

export async function fetchGroupDetail(groupId: string): Promise<GroupDetailData> {
  const [groupRes, membersRes, expensesRes, settlementsRes] = await Promise.all([
    supabase.from('groups').select('*').eq('id', groupId).single(),
    supabase
      .from('group_members')
      .select('*')
      .eq('group_id', groupId)
      .order('display_name'),
    supabase
      .from('expenses')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false }),
    supabase
      .from('settlements')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false }),
  ]);

  if (groupRes.error) throw new Error(groupRes.error.message);
  if (membersRes.error) throw new Error(membersRes.error.message);
  if (expensesRes.error) throw new Error(expensesRes.error.message);
  if (settlementsRes.error) throw new Error(settlementsRes.error.message);

  const expenses = expensesRes.data ?? [];
  const expenseIds = expenses.map((e) => e.id);

  let participants: ExpenseParticipant[] = [];
  if (expenseIds.length > 0) {
    const partRes = await supabase
      .from('expense_participants')
      .select('*')
      .in('expense_id', expenseIds);
    if (partRes.error) throw new Error(partRes.error.message);
    participants = partRes.data ?? [];
  }

  return {
    group: groupRes.data,
    members: membersRes.data ?? [],
    expenses,
    participants,
    settlements: settlementsRes.data ?? [],
  };
}

export async function createGroupWithMembers(input: {
  name: string;
  description?: string;
  memberNames: string[];
}): Promise<string> {
  const trimmedNames = input.memberNames
    .map((n) => n.trim())
    .filter(Boolean);

  if (trimmedNames.length < 2) {
    throw new Error('Add at least 2 members to create a group');
  }

  const normalized = trimmedNames.map(normalizeName);
  if (new Set(normalized).size !== normalized.length) {
    throw new Error('Member names must be unique (case-insensitive)');
  }

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      currency: 'INR',
    })
    .select('id')
    .single();

  if (groupError) throw new Error(groupError.message);

  for (const displayName of trimmedNames) {
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({ name: displayName })
      .select('id')
      .single();
    if (userError) throw new Error(userError.message);

    const { error: memberError } = await supabase.from('group_members').insert({
      group_id: group.id,
      user_id: user.id,
      display_name: displayName,
    });
    if (memberError) throw new Error(memberError.message);
  }

  return group.id;
}

export async function addMemberToGroup(
  groupId: string,
  displayName: string,
  existingMembers: GroupMember[],
): Promise<void> {
  const trimmed = displayName.trim();
  if (!trimmed) throw new Error('Name is required');

  const duplicate = existingMembers.some((m) =>
    normalizeName(m.display_name) === normalizeName(trimmed),
  );
  if (duplicate) throw new Error('A member with this name already exists in the group');

  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({ name: trimmed })
    .select('id')
    .single();
  if (userError) throw new Error(userError.message);

  const { error: memberError } = await supabase.from('group_members').insert({
    group_id: groupId,
    user_id: user.id,
    display_name: trimmed,
  });
  if (memberError) throw new Error(memberError.message);
}

export async function removeMemberFromGroup(
  member: GroupMember,
  data: GroupDetailData,
): Promise<void> {
  const userId = member.user_id;
  const hasHistory =
    data.expenses.some((e) => e.paid_by_user_id === userId) ||
    data.participants.some((p) => p.user_id === userId) ||
    data.settlements.some(
      (s) => s.from_user_id === userId || s.to_user_id === userId,
    );

  if (hasHistory) {
    throw new Error('Cannot remove a member with transaction history');
  }

  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('id', member.id);
  if (error) throw new Error(error.message);
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.from('groups').delete().eq('id', groupId);
  if (error) throw new Error(error.message);
}
