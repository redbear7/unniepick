import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { supabase } from '../supabase';
import { notifyAdmin } from './pushService';

WebBrowser.maybeCompleteAuthSession();

// ── Kakao 로그인 (Supabase OAuth + account_email 스코프 제거) ─────────────
// 카카오는 HTTPS Redirect URI만 허용 → Supabase 콜백 URL 사용
// Supabase가 생성한 URL에서 account_email 스코프를 제거 후 열기
export async function signInWithKakao() {
  // Expo Go / EAS 모두 앱 스킴으로 고정 (localhost 생성 방지)
  const redirectTo = 'unniepick://auth/callback';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      scopes: 'profile_nickname profile_image',
    },
  });

  if (error || !data?.url) throw error ?? new Error('OAuth URL 생성 실패');

  // Supabase가 account_email을 기본 추가하므로 URL에서 제거
  let oauthUrl = data.url;
  try {
    const parsed = new URL(oauthUrl);
    const rawScope = parsed.searchParams.get('scope') ?? '';
    const cleanScope = rawScope
      .split(/[\s+,]+/)
      .filter(s => s && s !== 'account_email')
      .join(' ');
    parsed.searchParams.set('scope', cleanScope);
    oauthUrl = parsed.toString();
  } catch {}

  const result = await WebBrowser.openAuthSessionAsync(oauthUrl, redirectTo);
  if (result.type !== 'success') throw new Error('CANCELLED');

  const hashPart = result.url.split('#')[1] ?? '';
  const params = new URLSearchParams(hashPart);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');

  if (!access_token || !refresh_token) {
    throw new Error('인증 토큰을 받지 못했어요. 다시 시도해주세요.');
  }

  const { data: { session }, error: sessionErr } =
    await supabase.auth.setSession({ access_token, refresh_token });

  if (sessionErr) throw sessionErr;
  return session;
}

// ── Google 로그인 (Supabase OAuth) ───────────────────────────────────────
export async function signInWithGoogle() {
  const redirectTo = 'unniepick://auth/callback';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error || !data.url) throw error ?? new Error('OAuth URL 생성 실패');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') throw new Error('CANCELLED');

  const hashPart = result.url.split('#')[1] ?? '';
  const params = new URLSearchParams(hashPart);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');

  if (!access_token || !refresh_token) {
    throw new Error('인증 토큰을 받지 못했어요. 다시 시도해주세요.');
  }

  const { data: { session }, error: sessionErr } =
    await supabase.auth.setSession({ access_token, refresh_token });

  if (sessionErr) throw sessionErr;
  return session;
}

// ── Apple 로그인 (iOS 전용, 네이티브 UI) ──────────────────────────────────
export async function signInWithApple() {
  if (Platform.OS !== 'ios') throw new Error('Apple 로그인은 iPhone에서만 가능해요.');

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) throw new Error('Apple 인증 토큰 없음');

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });

  if (error) throw error;
  return data.session;
}

// ── 소셜 로그인 후 프로필 자동 생성/확인 ─────────────────────────────────
export async function ensureSocialProfile(session: any): Promise<{ isNew: boolean; name: string }> {
  if (!session?.user) return { isNew: false, name: '' };

  const { user } = session;

  const { data: existing } = await supabase
    .from('users')
    .select('id, name')
    .eq('id', user.id)
    .single();

  if (existing) return { isNew: false, name: existing.name ?? '' };

  // 신규 사용자 → 프로필 생성
  const meta = user.user_metadata ?? {};
  const name: string =
    meta.full_name ?? meta.name ?? meta.nickname ??
    meta.preferred_username ?? '언니픽회원';

  // 이메일 없는 경우(카카오) → 고유 식별 이메일 자동 생성
  const email: string =
    user.email ?? `kakao_${user.id}@unniepick.app`;

  await supabase.from('users').insert({
    id: user.id,
    email,
    name,
    nickname: name,
    role: 'customer',
  });

  await supabase.from('profiles').upsert({
    id: user.id,
    nickname: name,
    avatar_emoji: '🐻',
  });

  notifyAdmin(
    '👤 새 회원이 가입했어요!',
    `${name} 님이 소셜 로그인으로 가입했어요.`,
    { type: 'new_member', userId: user.id },
  ).catch(() => {});

  return { isNew: true, name };
}

// Apple Sign In 가능 여부 (iOS + 기기 지원 확인)
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}
