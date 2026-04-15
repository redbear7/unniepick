// ================================================================
// 쿠폰 추천 서비스 — Phase 1
// 위치 + 시간대 + 날씨 + 즐겨찾기 + 사용 이력 기반 개인화 추천
// ================================================================

import { supabase } from '../supabase';
import { CouponRow } from './couponService';
import { fetchWeatherContext, WeatherContext, getTimeOfDay, TimeOfDay } from './weatherService';

// ── 거리 계산 (Haversine) ────────────────────────────────────
function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── 거리 점수 ─────────────────────────────────────────────────
function distScore(m: number): number {
  if (m < 200)   return 10.0;
  if (m < 500)   return 8.0;
  if (m < 1000)  return 6.0;
  if (m < 2000)  return 4.0;
  if (m < 3000)  return 2.5;
  return 1.0;
}

// ── 긴급성 점수 ───────────────────────────────────────────────
function urgencyScore(coupon: CouponRow): number {
  let score = 0;
  if (coupon.expires_at) {
    const days = (new Date(coupon.expires_at).getTime() - Date.now()) / 86_400_000;
    if (days < 1) score += 3.0;
    else if (days < 3) score += 2.0;
    else if (days < 7) score += 1.0;
  }
  if (coupon.total_quantity != null) {
    const remaining = coupon.total_quantity - (coupon.issued_count ?? 0);
    const ratio = coupon.total_quantity > 0 ? remaining / coupon.total_quantity : 1;
    if (ratio < 0.1)  score += 3.0;
    else if (ratio < 0.2) score += 1.5;
  }
  return score;
}

// ── 시간대 → 추천 업종 ────────────────────────────────────────
const TIME_CATEGORY_MAP: Record<TimeOfDay, string[]> = {
  morning:    ['cafe', '카페', 'bakery', '베이커리'],
  afternoon:  ['cafe', '카페', 'dessert', '디저트'],
  evening:    ['food', '음식점', 'restaurant', '레스토랑', 'bar'],
  night:      ['food', '음식점', 'bar', '술집', 'mart', '마트'],
  late_night: ['mart', '마트', 'convenience', '편의점'],
};

// ── 날씨 → 추천 업종 ─────────────────────────────────────────
const WEATHER_CATEGORY_MAP: Record<string, string[]> = {
  sunny:  ['cafe', '카페', 'food', '음식점', 'beauty', '뷰티'],
  hot:    ['cafe', '카페', 'dessert', '디저트', 'mart', '마트'],
  cloudy: ['cafe', '카페', 'food', '음식점'],
  rainy:  ['cafe', '카페', 'food', '음식점', 'mart', '마트'],
  snowy:  ['cafe', '카페', 'food', '음식점'],
  cold:   ['cafe', '카페', 'food', '음식점'],
};

// ── 시간대·날씨 적합도 점수 ───────────────────────────────────
function contextScore(coupon: CouponRow, timeOfDay: TimeOfDay, weather: string): number {
  const cat = coupon.store?.store_category ?? '';
  const timeCategories    = TIME_CATEGORY_MAP[timeOfDay] ?? [];
  const weatherCategories = WEATHER_CATEGORY_MAP[weather] ?? [];
  const timeMatch    = timeCategories.some(c => cat.includes(c)) ? 2.0 : 0;
  const weatherMatch = weatherCategories.some(c => cat.includes(c)) ? 1.5 : 0;
  return timeMatch + weatherMatch;
}

// ── 신선도 점수 (최근 발행일수록 높음) ───────────────────────
function freshnessScore(coupon: CouponRow): number {
  const days = (Date.now() - new Date(coupon.created_at).getTime()) / 86_400_000;
  if (days < 1)  return 2.0;
  if (days < 3)  return 1.5;
  if (days < 7)  return 1.0;
  if (days < 14) return 0.5;
  return 0;
}

// ── 추천 이유 텍스트 ─────────────────────────────────────────
export function getRecommendReason(
  coupon: CouponRow,
  distM: number | null,
  timeOfDay: TimeOfDay,
  weather: string,
  isFavorite: boolean,
): string {
  if (isFavorite) return '⭐ 즐겨찾기 가게 쿠폰';
  if (distM != null && distM < 200) return '📍 바로 근처';
  const days = coupon.expires_at
    ? (new Date(coupon.expires_at).getTime() - Date.now()) / 86_400_000
    : 999;
  if (days < 1) return '⏰ 오늘 마감';
  if (days < 3) return `⏰ ${Math.ceil(days)}일 남음`;
  const weatherLabels: Record<string, string> = {
    rainy: '🌧 비 오는 날 추천', hot: '☀️ 더운 날 추천', cold: '🥶 추운 날 추천',
  };
  if (weatherLabels[weather]) return weatherLabels[weather];
  const timeLabels: Record<TimeOfDay, string> = {
    morning: '☀️ 아침 추천', afternoon: '☕ 오후 추천',
    evening: '🌆 저녁 추천', night: '🌙 야간 추천', late_night: '🌃 심야 추천',
  };
  return timeLabels[timeOfDay] ?? '💡 맞춤 추천';
}

// ── 점수 계산된 쿠폰 ─────────────────────────────────────────
export interface ScoredCoupon {
  coupon:    CouponRow;
  score:     number;
  distM:     number | null;
  reason:    string;
}

// ── 유효한 쿠폰 전체 조회 (가게 정보 포함) ───────────────────
async function fetchActiveCouponsWithStore(): Promise<CouponRow[]> {
  const { data, error } = await supabase
    .from('coupons')
    .select(`
      *,
      store:store_id(id, name, store_category, latitude, longitude,
        district:district_id(id, name))
    `)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return [];
  return (data ?? []) as CouponRow[];
}

// ── 즐겨찾기 가게 ID 세트 ────────────────────────────────────
async function getFavoriteStoreIds(userId: string): Promise<Set<string>> {
  try {
    const { data } = await supabase
      .from('favorites')
      .select('store_id')
      .eq('user_id', userId);
    return new Set((data ?? []).map((r: any) => r.store_id as string));
  } catch {
    return new Set();
  }
}

// ── 메인: 개인화 추천 쿠폰 목록 ─────────────────────────────
export async function fetchRecommendedCoupons(params: {
  userId:  string | null;
  lat:     number;
  lng:     number;
  limit?:  number;
}): Promise<ScoredCoupon[]> {
  const { userId, lat, lng, limit = 30 } = params;

  const [coupons, weather, favoriteIds] = await Promise.all([
    fetchActiveCouponsWithStore(),
    fetchWeatherContext(lat, lng).catch(() => null),
    userId ? getFavoriteStoreIds(userId) : Promise.resolve(new Set<string>()),
  ]);

  const timeOfDay   = getTimeOfDay();
  const weatherCond = weather?.condition ?? 'sunny';

  const scored: ScoredCoupon[] = coupons.map(coupon => {
    const storeLat = (coupon.store as any)?.latitude;
    const storeLng = (coupon.store as any)?.longitude;
    const distM    = (storeLat != null && storeLng != null)
      ? distanceM(lat, lng, storeLat, storeLng)
      : null;
    const isFavorite = userId ? favoriteIds.has(coupon.store_id) : false;

    const score =
      (distM != null ? distScore(distM) : 0) * 2.5 +
      contextScore(coupon, timeOfDay, weatherCond) * 1.5 +
      urgencyScore(coupon) * 1.2 +
      freshnessScore(coupon) * 1.0 +
      (isFavorite ? 5.0 : 0);

    return {
      coupon,
      score,
      distM,
      reason: getRecommendReason(coupon, distM, timeOfDay, weatherCond, isFavorite),
    };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ── 섹션별 추천 (홈 화면용) ──────────────────────────────────
export interface CouponSections {
  nearby:    ScoredCoupon[];  // 거리 기반 (1km 이내)
  timeMatch: ScoredCoupon[];  // 현재 시간대 매칭
  urgent:    ScoredCoupon[];  // 만료 임박 (3일 이내)
  favorites: ScoredCoupon[];  // 즐겨찾기 가게
}

export async function fetchCouponSections(params: {
  userId: string | null;
  lat:    number;
  lng:    number;
}): Promise<CouponSections> {
  const all = await fetchRecommendedCoupons({ ...params, limit: 100 });
  const timeOfDay = getTimeOfDay();

  return {
    nearby:    all.filter(s => s.distM != null && s.distM < 1000).slice(0, 8),
    timeMatch: all.filter(s => {
      const cat = (s.coupon.store as any)?.store_category ?? '';
      return (TIME_CATEGORY_MAP[timeOfDay] ?? []).some(c => cat.includes(c));
    }).slice(0, 8),
    urgent: all.filter(s => {
      if (!s.coupon.expires_at) return false;
      const days = (new Date(s.coupon.expires_at).getTime() - Date.now()) / 86_400_000;
      return days < 3;
    }).slice(0, 6),
    favorites: all.filter(s => s.reason.startsWith('⭐')).slice(0, 6),
  };
}

// ── 행동 로깅 (추천 학습용 — Step 2에서 테이블 추가 후 활성화) ─
export async function logCouponInteraction(
  userId: string,
  couponId: string,
  action: 'view' | 'click' | 'save' | 'use' | 'dismiss',
  ctx: { lat?: number; lng?: number },
): Promise<void> {
  try {
    const weather = ctx.lat && ctx.lng
      ? await fetchWeatherContext(ctx.lat, ctx.lng).then(w => w.condition).catch(() => null)
      : null;

    await supabase.from('coupon_interactions').insert({
      user_id:         userId,
      coupon_id:       couponId,
      action,
      context_time:    getTimeOfDay(),
      context_weather: weather,
    });
  } catch {}  // 테이블 없으면 조용히 실패
}
