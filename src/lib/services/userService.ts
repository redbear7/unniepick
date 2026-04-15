import { supabase } from '../supabase';

export type UserRole = 'customer' | 'owner' | 'superadmin';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  nickname?: string;
  phone?: string;
  role: UserRole;
  created_at: string;
  // 가게회원인 경우
  store?: {
    id: string;
    name: string;
    category: string;
    is_active: boolean;
  } | null;
}

// 전체 회원 목록 (role 기준 정렬)
export async function fetchAllUsers(): Promise<UserRow[]> {
  const { data, error } = await supabase
    .from('users')
    .select(`
      id, email, name, nickname, phone, role, created_at,
      store:stores(id, name, category, is_active)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // store 는 배열로 오므로 첫 번째 요소로 변환
  return (data ?? []).map(u => ({
    ...u,
    store: Array.isArray(u.store) ? (u.store[0] ?? null) : (u.store ?? null),
  })) as UserRow[];
}

// 회원 역할 변경 (시샵 전용)
export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', userId);
  if (error) throw error;
}
