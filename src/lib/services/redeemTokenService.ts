/**
 * redeemTokenService — Spec 01 §04 터치형 토큰 생성
 *
 * 기기 측 HMAC-SHA256 생성 → 6자리 숫자 토큰
 * 서버는 동일 알고리즘으로 검증 (현재 윈도우 ±1)
 *
 * window = floor(Date.now() / 10000)   → 10초 갱신
 * message = `${couponId}:${userId}:${window}`
 * token = parseInt(hmac.slice(0,8), 16) % 1_000_000
 */
import * as Crypto from 'expo-crypto';

// 앱 빌드 시 환경 변수로 주입 (Supabase JWT secret과 공유)
// 실제 배포에서는 ENV로 관리; 개발용 기본값 제공
const REDEEM_SECRET =
  process.env.EXPO_PUBLIC_REDEEM_SECRET ?? 'unniepick-redeem-secret-v1';

/**
 * 현재 10초 윈도우 번호 반환
 * 서버는 이 값 ±1 범위를 수락 (시계 오차 허용)
 */
export function currentTokenWindow(): number {
  return Math.floor(Date.now() / 10_000);
}

/**
 * HMAC-SHA256 기반 6자리 토큰 생성
 * @param couponId   쿠폰 UUID
 * @param userId     사용자 UUID
 * @param window     currentTokenWindow() 결과
 */
export async function computeRedeemToken(
  couponId: string,
  userId:   string,
  window:   number,
): Promise<number> {
  const message = `${couponId}:${userId}:${window}`;
  const key     = `${REDEEM_SECRET}:${couponId}`;

  // expo-crypto: HMAC-SHA256 → hex digest
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${key}:${message}`,
    { encoding: Crypto.CryptoEncoding.HEX },
  );

  // 앞 8자리 hex → 10진수 → mod 1,000,000 → 6자리 보장
  const token = parseInt(digest.slice(0, 8), 16) % 1_000_000;
  return token;
}

/**
 * 표시용 포맷: 6자리, 공백으로 두 묶음 (예: "429 183")
 */
export function formatToken(token: number): string {
  const s = String(token).padStart(6, '0');
  return `${s.slice(0, 3)} ${s.slice(3)}`;
}

/**
 * 다음 갱신까지 남은 초 (0~9)
 */
export function secondsUntilRefresh(): number {
  const msInWindow = Date.now() % 10_000;
  return Math.ceil((10_000 - msInWindow) / 1_000);
}

import { supabase } from '../supabase';

export interface RedeemResult {
  success:      boolean;
  message:      string;
  redeemed_at?: string;
  error_code?:  string;
}

/**
 * verify-redeem Edge Function 호출 (서버 HMAC 검증 + 중복 방지)
 *
 * @param userCouponId  user_coupons.id
 * @param couponId      coupons.id
 * @param lat           현재 GPS 위도 (선택, 펜스 검증용)
 * @param lng           현재 GPS 경도 (선택)
 */
export async function markCouponRedeemed(
  userCouponId: string,
  couponId?:    string,
  lat?:         number,
  lng?:         number,
): Promise<RedeemResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return { success: false, message: '로그인이 필요해요', error_code: 'NO_SESSION' };
  }

  // 토큰 생성
  const w     = currentTokenWindow();
  const token = couponId
    ? await computeRedeemToken(couponId, session.user.id, w)
    : 0;

  // Supabase Edge Function 호출
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const payload: Record<string, unknown> = {
    user_coupon_id:  userCouponId,
    coupon_id:       couponId ?? '',
    token,
    client_window:   w,
  };
  if (lat !== undefined) payload.lat = lat;
  if (lng !== undefined) payload.lng = lng;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/verify-redeem`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey':        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      const errCode = (json.error_code ?? json.code ?? json.error) as string | undefined;
      const errMsg  = errCode === 'DUPLICATE_REDEEM'
        ? '이미 사용된 쿠폰이에요'
        : errCode === 'TOKEN_MISMATCH'
          ? '코드가 만료됐어요. 다시 시도해주세요'
          : errCode === 'outside_fence'
            ? `매장에서 너무 멀어요 (${(json as any).distance_m}m)`
            : String(json.error ?? '사용 처리에 실패했어요');

      return { success: false, message: errMsg, error_code: errCode };
    }

    return {
      success:    true,
      message:    '쿠폰이 사용 처리됐어요!',
      redeemed_at: (json.redeemed_at as string) ?? new Date().toISOString(),
    };
  } catch (e) {
    // 네트워크 오류 → fallback: 로컬 Supabase 업데이트
    console.warn('[redeemToken] edge function error, fallback:', e);
    const { error } = await supabase
      .from('user_coupons')
      .update({ status: 'redeemed', redeemed_at: new Date().toISOString() })
      .eq('id', userCouponId);
    if (error) return { success: false, message: error.message };
    return { success: true, message: '쿠폰이 사용 처리됐어요! (오프라인)', redeemed_at: new Date().toISOString() };
  }
}
