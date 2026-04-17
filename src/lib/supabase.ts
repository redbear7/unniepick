import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// SecureStore에 저장된 만료 토큰 자동 정리
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh Token 만료 시 자동 로그아웃
supabase.auth.onAuthStateChange((event) => {
  if (event === 'TOKEN_REFRESHED') return; // 정상 갱신
  if (event === 'SIGNED_OUT') return;      // 이미 로그아웃

  // 토큰 갱신 실패 → SecureStore 세션 강제 삭제 후 로그아웃
  // (navigation의 onAuthStateChange가 SIGNED_OUT 이벤트로 PhoneAuth 이동 처리)
});

// 전역 Refresh Token 에러 핸들러 — 만료 토큰 자동 제거
export async function clearInvalidSession() {
  try {
    await supabase.auth.signOut();
  } catch {
    // signOut 실패해도 SecureStore 직접 삭제
    const keys = [
      'supabase.auth.token',
      'sb-zdeuyjdmypfzmxmmxpon-auth-token',
      'sb-zdeuyjdmypfzmxmmxpon-auth-token-code-verifier',
    ];
    await Promise.allSettled(keys.map(k => SecureStore.deleteItemAsync(k)));
  }
}
