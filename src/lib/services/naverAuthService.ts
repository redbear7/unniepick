/**
 * 네이버 로그인 서비스
 *
 * 흐름:
 *  1. expo-auth-session → 네이버 OAuth 인증
 *  2. 인증 코드 → 액세스 토큰 교환
 *  3. 네이버 사용자 정보 조회 (이름, 이메일, 닉네임, 프로필이미지)
 *  4. Supabase 계정 생성/로그인 (이메일+결정론적 패스워드)
 *  5. profiles 테이블에 닉네임 upsert
 */

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { supabase } from '../supabase';

WebBrowser.maybeCompleteAuthSession();

// ── 환경변수 ──
const NAVER_CLIENT_ID     = process.env.EXPO_PUBLIC_NAVER_CLIENT_ID ?? '';
const NAVER_CLIENT_SECRET = process.env.EXPO_PUBLIC_NAVER_CLIENT_SECRET ?? '';
// 네이버 계정을 Supabase 비밀번호 생성에 쓰는 솔트 (앱 고유값)
const PW_SALT = 'unniepick_naver_2025';

// 네이버 OAuth 엔드포인트
const discovery = {
  authorizationEndpoint: 'https://nid.naver.com/oauth2.0/authorize',
  tokenEndpoint:         'https://nid.naver.com/oauth2.0/token',
};

export interface NaverUserInfo {
  id: string;
  nickname: string;
  name: string;
  email: string | null;
  profileImage: string | null;
}

// ──────────────────────────────────────────────────────────────
// redirect URI (Expo Go / 빌드 공통)
// ──────────────────────────────────────────────────────────────
export function makeNaverRedirectUri() {
  return AuthSession.makeRedirectUri({
    scheme: 'com.bangju.unniepick',
    path: 'naver-auth',
  });
}

// ──────────────────────────────────────────────────────────────
// 1. 네이버 OAuth 코드 요청
// ──────────────────────────────────────────────────────────────
export async function requestNaverAuthCode(): Promise<string> {
  if (!NAVER_CLIENT_ID) throw new Error('EXPO_PUBLIC_NAVER_CLIENT_ID 환경변수가 없어요.');

  const redirectUri = makeNaverRedirectUri();
  const state = Math.random().toString(36).substring(2, 15);

  const authUrl =
    `${discovery.authorizationEndpoint}` +
    `?response_type=code` +
    `&client_id=${NAVER_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}`;

  const result = await AuthSession.startAsync({
    authUrl,
    returnUrl: redirectUri,
  });

  if (result.type !== 'success') {
    if (result.type === 'cancel' || result.type === 'dismiss') {
      throw new Error('CANCELLED');
    }
    throw new Error('네이버 로그인을 완료하지 못했어요.');
  }

  const code = (result.params as any).code;
  if (!code) throw new Error('인증 코드를 받지 못했어요.');
  return code;
}

// ──────────────────────────────────────────────────────────────
// 2. 인증 코드 → 액세스 토큰
// ──────────────────────────────────────────────────────────────
async function exchangeCodeForToken(code: string): Promise<string> {
  const redirectUri = makeNaverRedirectUri();
  const url =
    `${discovery.tokenEndpoint}` +
    `?grant_type=authorization_code` +
    `&client_id=${NAVER_CLIENT_ID}` +
    `&client_secret=${NAVER_CLIENT_SECRET}` +
    `&code=${code}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  const res = await fetch(url, { method: 'GET' });
  const data = await res.json();

  if (!data.access_token) {
    throw new Error(`토큰 교환 실패: ${data.error_description ?? '알 수 없는 오류'}`);
  }
  return data.access_token;
}

// ──────────────────────────────────────────────────────────────
// 3. 네이버 사용자 정보 조회
// ──────────────────────────────────────────────────────────────
async function fetchNaverUserInfo(accessToken: string): Promise<NaverUserInfo> {
  const res = await fetch('https://openapi.naver.com/v1/nid/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();

  if (data.resultcode !== '00') {
    throw new Error('네이버 사용자 정보를 가져오지 못했어요.');
  }

  const r = data.response;
  return {
    id:           r.id,
    nickname:     r.nickname ?? r.name ?? '맛집러',
    name:         r.name ?? '',
    email:        r.email ?? null,
    profileImage: r.profile_image ?? null,
  };
}

// ──────────────────────────────────────────────────────────────
// 4. Supabase 계정 연동 (네이버 ID 기반)
// ──────────────────────────────────────────────────────────────
async function upsertSupabaseUser(naverUser: NaverUserInfo) {
  // 이메일: 네이버 이메일 우선, 없으면 synthetic
  const email = naverUser.email ?? `naver_${naverUser.id}@unniepick.app`;

  // 결정론적 패스워드 (네이버 ID + 솔트 해시)
  const pwBase   = `${PW_SALT}_${naverUser.id}`;
  const password = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pwBase
  );

  // 로그인 시도
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (signInData.session) {
    // 기존 계정 로그인 성공 → 프로필만 최신화
    await upsertProfile(signInData.session.user.id, naverUser);
    return signInData.session;
  }

  // 계정 없음 → 신규 가입
  if (signInError?.message.includes('Invalid login credentials')) {
    const { data: signUpData, error: signUpError } =
      await supabase.auth.signUp({ email, password });

    if (signUpError) throw signUpError;
    if (!signUpData.session && !signUpData.user) {
      throw new Error('회원가입에 실패했어요. 잠시 후 다시 시도해주세요.');
    }

    const uid = signUpData.user!.id;

    // users 테이블 insert
    await supabase.from('users').upsert({
      id:       uid,
      email,
      name:     naverUser.name || naverUser.nickname,
      nickname: naverUser.nickname,
      role:     'customer',
    });

    await upsertProfile(uid, naverUser);
    return signUpData.session;
  }

  throw signInError ?? new Error('로그인 처리 중 오류가 발생했어요.');
}

async function upsertProfile(userId: string, naverUser: NaverUserInfo) {
  await supabase.from('profiles').upsert({
    id:           userId,
    nickname:     naverUser.nickname,
    avatar_emoji: '🐻',
    updated_at:   new Date().toISOString(),
  });
}

// ──────────────────────────────────────────────────────────────
// 5. 전체 로그인 플로우 (외부 호출 진입점)
// ──────────────────────────────────────────────────────────────
export async function signInWithNaver(): Promise<{ user: NaverUserInfo; isNew: boolean }> {
  const code        = await requestNaverAuthCode();
  const accessToken = await exchangeCodeForToken(code);
  const naverUser   = await fetchNaverUserInfo(accessToken);
  const session     = await upsertSupabaseUser(naverUser);

  const isNew = !session; // signUp은 이메일 인증 전 session이 null일 수 있음
  return { user: naverUser, isNew };
}

// ──────────────────────────────────────────────────────────────
// 6. 현재 로그인된 사용자 정보
// ──────────────────────────────────────────────────────────────
export async function getCurrentUserProfile() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return null;

  const uid = sessionData.session.user.id;
  const { data } = await supabase
    .from('profiles')
    .select('nickname, avatar_emoji')
    .eq('id', uid)
    .single();

  return data
    ? { uid, nickname: data.nickname, avatarEmoji: data.avatar_emoji }
    : { uid, nickname: '맛집러', avatarEmoji: '🐻' };
}

// ──────────────────────────────────────────────────────────────
// 7. 프로필 업데이트 (닉네임 + 캐릭터)
// ──────────────────────────────────────────────────────────────
export async function updateProfile(nickname: string, avatarEmoji: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) throw new Error('로그인이 필요해요');

  const uid = sessionData.session.user.id;

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: uid, nickname: nickname.trim(), avatar_emoji: avatarEmoji })
    .eq('id', uid);

  if (error) throw error;

  // users 테이블 nickname도 동기화
  await supabase
    .from('users')
    .update({ nickname: nickname.trim() })
    .eq('id', uid);
}

// ──────────────────────────────────────────────────────────────
// 8. 로그아웃
// ──────────────────────────────────────────────────────────────
export async function signOut() {
  await supabase.auth.signOut();
}
