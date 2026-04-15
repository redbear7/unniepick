import { supabase } from '../supabase';
import { User } from '../../types';
import { notifyAdmin } from './pushService';

// 회원가입 (닉네임 포함)
export async function signUp(
  email: string,
  password: string,
  name: string,
  nickname: string,
  phone?: string,
) {
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
  if (authError) throw authError;
  if (!authData.user) throw new Error('회원가입 실패');

  const uid = authData.user.id;

  // users 테이블에 프로필 저장
  const { error: profileError } = await supabase.from('users').insert({
    id: uid,
    email,
    name,
    nickname,
    phone,
    role: 'customer',
  });
  if (profileError) console.warn('users insert error:', profileError);

  // profiles 테이블에 닉네임 저장 (랭킹용)
  await supabase.from('profiles').upsert({
    id: uid,
    nickname,
    avatar_emoji: '🐻',
  });

  // 시샵에게 새 회원 가입 알림 (best-effort)
  notifyAdmin(
    '👤 새 회원이 가입했어요!',
    `${name}(${nickname}) 님이 언니픽에 가입했어요.`,
    { type: 'new_member', userId: uid },
  ).catch(() => {});

  return authData.user;
}

// 로그인
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

// 로그아웃
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// 현재 세션
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// 현재 사용자 프로필
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error) return null;
  return data as User;
}
