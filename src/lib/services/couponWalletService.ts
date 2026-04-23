/**
 * couponWalletService — Spec 01 지갑 자동 발견
 *
 * 기존 walletService(UNNI 포인트)와 독립.
 * 이 파일은 user_coupons 기반 쿠폰지갑 CRUD를 담당.
 */
import { supabase } from '../supabase';

// ── 타입 ─────────────────────────────────────────────────────────
export interface WalletCoupon {
  coupon_id:      string;
  user_coupon_id: string;
  status:         'active' | 'redeemed' | 'expired';
  title:          string;
  coupon_kind:    string;
  discount_type:  'percent' | 'amount';
  discount_value: number;
  expires_at:     string;
  redeemed_at:    string | null;
  days_left:      number;
  store_id:       string;
  store_name:     string;
  store_category: string;
  distance_m:     number | null;
  is_nearby?:     boolean;          // 반경 내 여부 (클라이언트 판정)
}

export interface UserLocationSetting {
  user_id:       string;
  enabled:       boolean;
  radius_m:      number;
  daily_cap:     number;
  quiet_start:   string;
  quiet_end:     string;
  enabled_cats:  string[] | null;
}

// ── 반경 내 쿠폰 조회 (PostGIS RPC) ────────────────────────────
export async function getNearbyWalletCoupons(
  userId: string,
  lat: number,
  lng: number,
  radiusM = 300,
): Promise<WalletCoupon[]> {
  const { data, error } = await supabase.rpc('get_nearby_wallet_coupons', {
    p_user_id:  userId,
    p_lat:      lat,
    p_lng:      lng,
    p_radius_m: radiusM,
  });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ ...r, is_nearby: true }));
}

// ── 전체 쿠폰 조회 (거리 포함) ────────────────────────────────
export async function getAllWalletCoupons(
  userId: string,
  lat?: number | null,
  lng?: number | null,
): Promise<WalletCoupon[]> {
  if (lat != null && lng != null) {
    const { data, error } = await supabase.rpc('get_wallet_coupons_with_distance', {
      p_user_id: userId,
      p_lat:     lat,
      p_lng:     lng,
    });
    // RPC 성공 시 반환 (마이그레이션 미실행 시 fallback으로)
    if (!error) return data ?? [];
    console.warn('[couponWallet] RPC fallback:', error.message);
  }

  // fallback: 좌표 없거나 RPC 미존재 시 직접 조회
  // user_coupons 실제 컬럼: used_at (redeemed_at 아님)
  const { data, error } = await supabase
    .from('user_coupons')
    .select(`
      id,
      status,
      used_at,
      coupon:coupons (
        id, title, coupon_kind, discount_type, discount_value, expires_at,
        store:stores ( id, name, category )
      )
    `)
    .eq('user_id', userId)
    .order('received_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((uc: any) => {
    const c = uc.coupon;
    const s = c?.store;
    const msLeft    = new Date(c?.expires_at).getTime() - Date.now();
    const days_left = Math.max(0, Math.ceil(msLeft / 86_400_000));
    return {
      coupon_id:      c?.id ?? '',
      user_coupon_id: uc.id,
      status:         uc.status,
      title:          c?.title ?? '',
      coupon_kind:    c?.coupon_kind ?? 'regular',
      discount_type:  c?.discount_type ?? 'percent',
      discount_value: c?.discount_value ?? 0,
      expires_at:     c?.expires_at ?? '',
      redeemed_at:    uc.used_at ?? null,   // used_at → redeemed_at alias
      days_left,
      store_id:       s?.id ?? '',
      store_name:     s?.name ?? '',
      store_category: s?.category ?? '',
      distance_m:     null,
    };
  });
}

// ── 설정 로드 ─────────────────────────────────────────────────
export async function getLocationSetting(userId: string): Promise<UserLocationSetting> {
  const { data } = await supabase
    .from('user_location_setting')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  return data ?? {
    user_id:      userId,
    enabled:      true,
    radius_m:     500,
    daily_cap:    3,
    quiet_start:  '22:00',
    quiet_end:    '09:00',
    enabled_cats: null,
  };
}

// ── 설정 저장 ─────────────────────────────────────────────────
export async function upsertLocationSetting(
  setting: UserLocationSetting,
): Promise<void> {
  const { error } = await supabase
    .from('user_location_setting')
    .upsert({ ...setting, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ── Live Activity 이벤트 로깅 ─────────────────────────────────
export async function logLiveActivityEvent(params: {
  userId:   string;
  couponId: string;
  storeId:  string;
  event:    'started' | 'tapped' | 'dismissed' | 'expired' | 'redeemed';
  distanceM?: number;
  lat?: number;
  lng?: number;
}): Promise<void> {
  await supabase.from('live_activity_event').insert({
    user_id:     params.userId,
    coupon_id:   params.couponId,
    store_id:    params.storeId,
    event_type:  params.event,
    distance_m:  params.distanceM ?? null,
    trigger_lat: params.lat ?? null,
    trigger_lng: params.lng ?? null,
  });
  // 로깅 실패는 무시
}

// ── D-day 포맷 헬퍼 ──────────────────────────────────────────
export function formatDDay(daysLeft: number): string {
  if (daysLeft <= 0) return 'D-day';
  if (daysLeft === 1) return 'D-1 내일 마감';
  return `D-${daysLeft}`;
}

// ── 카테고리 이모지 ──────────────────────────────────────────
export const CAT_EMOJI: Record<string, string> = {
  cafe:   '☕',
  food:   '🍽',
  beauty: '✂️',
  nail:   '💅',
  burger: '🍔',
  etc:    '🏪',
};

export const CAT_COLOR: Record<string, string> = {
  cafe:   '#FF6F0F',
  food:   '#2D9CDB',
  beauty: '#7B61FF',
  nail:   '#D946B0',
  burger: '#D55A1F',
  etc:    '#5B67CA',
};

export function catColor(cat: string): string {
  return CAT_COLOR[cat] ?? CAT_COLOR.etc;
}

export function catEmoji(cat: string): string {
  return CAT_EMOJI[cat] ?? CAT_EMOJI.etc;
}
