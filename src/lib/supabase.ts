import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * SecureStore 청크 어댑터
 *
 * Supabase JWT 세션이 2048바이트를 초과하는 경우를 대비해
 * 큰 값을 1800바이트 단위 청크로 분할 저장합니다.
 * 각 청크는 `${key}__chunk_${i}` 키로, 총 청크 수는 `${key}__n` 키로 저장합니다.
 */
const CHUNK_SIZE = 1800;

// 첫 번째 잠금 해제 이후 백그라운드에서도 접근 가능
// (기본값 WHEN_UNLOCKED는 화면 잠금 시 접근 불가 → 자동 갱신 실패)
const STORE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const countStr = await SecureStore.getItemAsync(`${key}__n`, STORE_OPTS);
    if (!countStr) {
      return SecureStore.getItemAsync(key, STORE_OPTS);
    }
    const n = parseInt(countStr, 10);
    const chunks = await Promise.all(
      Array.from({ length: n }, (_, i) =>
        SecureStore.getItemAsync(`${key}__chunk_${i}`, STORE_OPTS),
      ),
    );
    if (chunks.some(c => c === null)) return null;
    return chunks.join('');
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value, STORE_OPTS);
      await SecureStore.deleteItemAsync(`${key}__n`);
      return;
    }
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await Promise.all(
      chunks.map((chunk, i) =>
        SecureStore.setItemAsync(`${key}__chunk_${i}`, chunk, STORE_OPTS),
      ),
    );
    await SecureStore.setItemAsync(`${key}__n`, String(chunks.length), STORE_OPTS);
    await SecureStore.deleteItemAsync(key);
  },

  removeItem: async (key: string): Promise<void> => {
    const countStr = await SecureStore.getItemAsync(`${key}__n`);
    if (countStr) {
      const n = parseInt(countStr, 10);
      await Promise.all([
        ...Array.from({ length: n }, (_, i) =>
          SecureStore.deleteItemAsync(`${key}__chunk_${i}`),
        ),
        SecureStore.deleteItemAsync(`${key}__n`),
      ]);
    }
    await SecureStore.deleteItemAsync(key);
  },
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
