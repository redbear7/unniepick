import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { ADMIN_PASSWORD, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD } from '../constants/theme';
import { supabase } from './supabase';

const BIOMETRIC_ENROLLED_KEY = 'super_admin_biometric_enrolled';

// ─── 생체인증 ────────────────────────────────────────────────
// 기기가 생체인증을 지원하는지 확인
export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

// 생체인증 등록 여부 (시샵이 최초 로그인 후 등록했는지)
export async function isBiometricEnrolledForAdmin(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(BIOMETRIC_ENROLLED_KEY);
  return val === 'true';
}

// 생체인증 등록 (로그인 성공 후 "생체인증 등록" 선택 시)
export async function enrollBiometricForAdmin(): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_ENROLLED_KEY, 'true');
}

// 생체인증 등록 해제
export async function unenrollBiometricForAdmin(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_ENROLLED_KEY);
}

// 생체인증으로 시샵 로그인 시도
export async function superAdminLoginWithBiometric(): Promise<boolean> {
  const enrolled = await isBiometricEnrolledForAdmin();
  if (!enrolled) return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: '시샵 관리자 인증',
    fallbackLabel: '비밀번호로 로그인',
    cancelLabel: '취소',
    disableDeviceFallback: false,
  });

  if (result.success) {
    const existing = await SecureStore.getItemAsync(SUPER_ADMIN_SESSION_KEY);
    if (existing) {
      await SecureStore.setItemAsync(SUPER_ADMIN_SESSION_KEY, new Date().toISOString());
      // Supabase 세션도 갱신 시도
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        await supabase.auth.signInWithPassword({
          email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASSWORD,
        }).catch(() => {});
      }
      return true;
    }
  }
  return false;
}

const OWNER_SESSION_KEY = 'owner_session';
const SUPER_ADMIN_SESSION_KEY = 'super_admin_session';

// ─── 사장님 로그인 ───────────────────────────────
export async function ownerLogin(password: string): Promise<boolean> {
  if (password === ADMIN_PASSWORD) {
    await SecureStore.setItemAsync(OWNER_SESSION_KEY, 'true');
    return true;
  }
  return false;
}

export async function ownerLogout(): Promise<void> {
  await SecureStore.deleteItemAsync(OWNER_SESSION_KEY);
}

export async function isOwnerLoggedIn(): Promise<boolean> {
  const session = await SecureStore.getItemAsync(OWNER_SESSION_KEY);
  return session === 'true';
}

// ─── 최고관리자 로그인 ───────────────────────────
export async function superAdminLogin(email: string, password: string): Promise<boolean> {
  const emailMatch    = email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const passwordMatch = password === SUPER_ADMIN_PASSWORD;
  if (emailMatch && passwordMatch) {
    // SecureStore 세션 저장
    await SecureStore.setItemAsync(SUPER_ADMIN_SESSION_KEY, new Date().toISOString());
    // Supabase auth 도 함께 로그인 (쿠폰 발행 등 DB 작업에 필요)
    try {
      await supabase.auth.signInWithPassword({ email: email.trim(), password });
    } catch { /* Supabase 로그인 실패해도 시샵 세션은 유지 */ }
    return true;
  }
  return false;
}

export async function superAdminLogout(): Promise<void> {
  await SecureStore.deleteItemAsync(SUPER_ADMIN_SESSION_KEY);
}

export async function isSuperAdminLoggedIn(): Promise<boolean> {
  const session = await SecureStore.getItemAsync(SUPER_ADMIN_SESSION_KEY);
  return !!session; // 'true' 또는 ISO 문자열 모두 true
}

// 시샵 로그인 시각 반환 (ISO string, null if not logged in or old 'true' value)
export async function getSuperAdminLoginTime(): Promise<string | null> {
  const v = await SecureStore.getItemAsync(SUPER_ADMIN_SESSION_KEY);
  if (!v || v === 'true') return null;
  return v;
}
