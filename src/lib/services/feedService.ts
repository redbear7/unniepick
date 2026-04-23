/**
 * feedService — 홈 피드 3존 알고리즘
 *
 * Z1 긴급존: 오늘 마감 / 잔여 10장 이하 / 3시간 이내 발행
 * Z2 팔로우존: 팔로우 가게의 쿠폰 (시간 역순)
 * Z3 추천존: 취향 기반 미팔로우 가게 쿠폰
 *
 * 스코어 공식 (MVP 단순화):
 *   Score = F×0.40 + T×0.35 + Q×0.15 + D×0.10
 *   F=팔로우, T=시간긴박도, Q=품질(pick/click), D=거리
 */

import { supabase } from '../supabase';
import { CouponKind } from './couponService';
import { getStoreVisitCount } from './visitService';

// ── 타입 ──────────────────────────────────────────────────────────
export type FeedZone = 'Z1' | 'Z2' | 'Z3';

export interface FeedCoupon {
  // 쿠폰 기본 정보
  id:              string;
  store_id:        string;
  store_name:      string;
  store_category:  string;
  coupon_kind:     CouponKind;
  title:           string;
  description:     string;
  discount_type:   'percent' | 'amount';
  discount_value:  number;
  total_quantity:  number | null;
  remaining:       number | null;   // total_quantity - issued_count
  expires_at:      string;
  created_at:      string;
  image_url?:      string | null;
  pick_count:      number;
  click_count:     number;
  // 대상 고객 세그먼트
  target_segment:  'all' | 'new' | 'returning' | null;
  min_visit_count: number | null;
  // 피드 계산 필드
  zone:            FeedZone;
  score:           number;
  is_followed:     boolean;
  urgency_label?:  string;          // "오늘마감" | "잔여N장" | "방금발행"
  hours_until_expire: number;
  distance_km?:    number;
  // 자격 여부 (앱에서 필터용)
  is_eligible?:    boolean;
}

export interface HomeFeedResult {
  z1: FeedCoupon[];   // 긴급 (가로 스크롤)
  z2: FeedCoupon[];   // 팔로우 피드
  z3: FeedCoupon[];   // 추천 피드
  total: number;
}

// ── 상수 ──────────────────────────────────────────────────────────
const Z1_EXPIRE_HOURS      = 24;   // 24시간 이내 마감
const Z1_REMAIN_THRESHOLD  = 10;   // 잔여 10장 이하
const Z1_ISSUED_HOURS      = 3;    // 3시간 이내 발행

// ── 시간 긴박도 점수 (0~1) ────────────────────────────────────────
function calcUrgency(coupon: {
  expires_at:    string;
  created_at:    string;
  total_quantity: number | null;
  remaining:     number | null;
}): { score: number; label?: string } {
  const now       = Date.now();
  const expiresMs = new Date(coupon.expires_at).getTime();
  const createdMs = new Date(coupon.created_at).getTime();
  const hoursLeft = (expiresMs - now) / 3_600_000;
  const hoursAgo  = (now - createdMs) / 3_600_000;

  // 만료됨
  if (hoursLeft <= 0) return { score: 0 };

  let score = 0;
  let label: string | undefined;

  // 마감 임박 (24시간 이내 → 0.5~1.0)
  if (hoursLeft <= 24) {
    score = Math.max(score, 0.5 + (24 - hoursLeft) / 48);
    label = hoursLeft < 6 ? `${Math.floor(hoursLeft)}시간 후 마감` : '오늘마감';
  }

  // 잔여수량 부족 (20% 이하 → 추가 boost)
  if (coupon.total_quantity && coupon.remaining !== null) {
    const ratio = coupon.remaining / coupon.total_quantity;
    if (ratio <= 0.2) {
      score = Math.min(1.0, score * 1.5);
      if (!label && coupon.remaining <= 10) {
        label = `잔여 ${coupon.remaining}장`;
      }
    }
  }

  // 방금 발행 (3시간 이내 → 신선도)
  if (hoursAgo <= 3) {
    score = Math.max(score, 0.3);
    if (!label) label = '방금 발행';
  }

  return { score: Math.min(1.0, score), label };
}

// ── 품질 점수 (0~1) ───────────────────────────────────────────────
function calcQuality(pick: number, click: number): number {
  const raw = pick * 2 + Math.sqrt(click);
  return Math.min(1.0, raw / 20);
}

// ── 거리 점수 (0~1, 가까울수록 높음) ─────────────────────────────
function calcDistance(km?: number): number {
  if (km === undefined || km === null) return 0.3; // 모름 = 중간
  if (km < 0.3) return 1.0;
  if (km < 1)   return 0.85;
  if (km < 3)   return 0.65;
  if (km < 5)   return 0.45;
  if (km < 10)  return 0.25;
  return 0.1;
}

// ── Z1 판별 ───────────────────────────────────────────────────────
function isZ1(coupon: FeedCoupon): boolean {
  const hoursLeft = coupon.hours_until_expire;
  const isUrgentExpiry  = hoursLeft <= Z1_EXPIRE_HOURS;
  const isLowStock      = coupon.remaining !== null && coupon.remaining <= Z1_REMAIN_THRESHOLD;
  const isJustPublished = (Date.now() - new Date(coupon.created_at).getTime()) / 3_600_000 <= Z1_ISSUED_HOURS;
  return isUrgentExpiry || isLowStock || isJustPublished;
}

// ── 메인: 홈 피드 조회 ────────────────────────────────────────────
export async function getHomeFeed(params: {
  userId: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  categoryFilter?: string;   // 'all' | 카테고리 키
  limit?: number;
}): Promise<HomeFeedResult> {
  const { userId, lat, lng, radiusKm = 5, categoryFilter = 'all', limit = 60 } = params;

  try {
    // 1. 팔로우 가게 목록
    const followedIds = await getFollowedStoreIds(userId);
    const followedSet = new Set(followedIds);

    // 2-pre. 방문한 가게 visit count 맵 (returning 쿠폰 자격 판별용)
    // 단일 쿼리로 user의 모든 방문 집계
    const { data: visitRows } = await supabase
      .from('store_visits')
      .select('store_id')
      .eq('user_id', userId);
    const visitCountMap = new Map<string, number>();
    (visitRows ?? []).forEach((r: { store_id: string }) => {
      visitCountMap.set(r.store_id, (visitCountMap.get(r.store_id) ?? 0) + 1);
    });

    // 2. 쿠폰 조회 (위치기반 + 카테고리 필터)
    const rawCoupons = await fetchActiveCoupons({
      lat, lng, radiusKm, categoryFilter, limit, followedIds,
    });

    // 3. 스코어 계산 + 존 분류
    const now = Date.now();
    const scored: FeedCoupon[] = rawCoupons.map(raw => {
      const remaining = raw.total_quantity !== null
        ? raw.total_quantity - (raw.issued_count ?? 0)
        : null;
      const expiresMs     = new Date(raw.expires_at).getTime();
      const hoursLeft     = (expiresMs - now) / 3_600_000;
      const isFollowed    = followedSet.has(raw.store_id);
      const urgency       = calcUrgency({ ...raw, remaining });
      const quality       = calcQuality(raw.pick_count ?? 0, raw.click_count ?? 0);
      const distScore     = calcDistance(raw.distance_km);
      const followScore   = isFollowed ? 1.0 : 0.0;

      // MVP 스코어 공식
      const score =
        followScore * 0.40 +
        urgency.score * 0.35 +
        quality * 0.15 +
        distScore * 0.10;

      // A. 대상 고객 자격 판별
      const seg        = (raw as any).target_segment ?? 'all';
      const minVisit   = (raw as any).min_visit_count ?? null;
      const visitCount = visitCountMap.get(raw.store_id) ?? 0;
      let isEligible   = true;
      if (seg === 'new')       isEligible = visitCount === 0;
      if (seg === 'returning') isEligible = minVisit !== null && visitCount >= minVisit;

      const coupon: FeedCoupon = {
        id:              raw.id,
        store_id:        raw.store_id,
        store_name:      raw.store_name,
        store_category:  raw.store_category ?? 'food',
        coupon_kind:     raw.coupon_kind,
        title:           raw.title,
        description:     raw.description,
        discount_type:   raw.discount_type,
        discount_value:  raw.discount_value,
        total_quantity:  raw.total_quantity,
        remaining,
        expires_at:      raw.expires_at,
        created_at:      raw.created_at,
        image_url:       raw.image_url,
        pick_count:      raw.pick_count ?? 0,
        click_count:     raw.click_count ?? 0,
        target_segment:  seg,
        min_visit_count: minVisit,
        zone:            'Z3',   // 기본값, 아래서 재분류
        score,
        is_followed:     isFollowed,
        urgency_label:   urgency.label,
        hours_until_expire: hoursLeft,
        distance_km:     raw.distance_km,
        is_eligible:     isEligible,
      };

      return coupon;
    });

    // 4. 존 분류
    const z1: FeedCoupon[] = [];
    const z2: FeedCoupon[] = [];
    const z3: FeedCoupon[] = [];

    for (const c of scored) {
      if (isZ1(c)) {
        c.zone = 'Z1';
        z1.push(c);
      } else if (c.is_followed) {
        c.zone = 'Z2';
        z2.push(c);
      } else {
        c.zone = 'Z3';
        z3.push(c);
      }
    }

    // 5. 각 존 정렬
    // Z1: 긴박도 내림차순
    z1.sort((a, b) => b.score - a.score);
    // Z2: 발행 최신순 (팔로우 가게는 시간 중요)
    z2.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    // Z3: 스코어 내림차순
    z3.sort((a, b) => b.score - a.score);

    return { z1, z2, z3, total: scored.length };
  } catch (e) {
    console.error('getHomeFeed error:', e);
    return { z1: [], z2: [], z3: [], total: 0 };
  }
}

// ── 팔로우 가게 ID 목록 ───────────────────────────────────────────
async function getFollowedStoreIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('follows')
    .select('store_id')
    .eq('user_id', userId);
  return (data ?? []).map(r => r.store_id);
}

// ── 팔로우 가게 기본 정보 (쿠폰 없는 가게 표시용) ─────────────────
export interface FollowedStoreMeta {
  id:       string;
  name:     string;
  category: string;
  emoji?:   string;
}

export async function getFollowedStoresMeta(
  userId: string,
  excludeStoreIds: string[] = [],
): Promise<FollowedStoreMeta[]> {
  const followedIds = await getFollowedStoreIds(userId);
  const withoutCoupon = followedIds.filter(id => !excludeStoreIds.includes(id));
  if (!withoutCoupon.length) return [];

  const { data } = await supabase
    .from('stores')
    .select('id, name, category, emoji')
    .in('id', withoutCoupon)
    .eq('is_active', true);

  return (data ?? []) as FollowedStoreMeta[];
}

// ── 활성 쿠폰 조회 ────────────────────────────────────────────────
interface RawCoupon {
  id:             string;
  store_id:       string;
  store_name:     string;
  store_category: string;
  coupon_kind:    CouponKind;
  title:          string;
  description:    string;
  discount_type:  'percent' | 'amount';
  discount_value: number;
  total_quantity: number | null;
  issued_count:   number;
  expires_at:     string;
  created_at:     string;
  image_url?:     string | null;
  pick_count?:    number;
  click_count?:   number;
  distance_km?:   number;
}

async function fetchActiveCoupons(params: {
  lat?: number;
  lng?: number;
  radiusKm: number;
  categoryFilter: string;
  limit: number;
  followedIds: string[];
}): Promise<RawCoupon[]> {
  const { lat, lng, radiusKm, categoryFilter, limit, followedIds } = params;

  // RPC 사용 (위치 기반) or 일반 쿼리 fallback
  if (lat !== undefined && lng !== undefined) {
    const { data, error } = await supabase.rpc('get_home_feed_coupons', {
      user_lat:       lat,
      user_lng:       lng,
      radius_km:      radiusKm >= 50 ? 9999 : radiusKm,
      category_filter: categoryFilter === 'all' ? null : categoryFilter,
      max_count:      limit,
    });
    if (!error && data) return data as RawCoupon[];
  }

  // Fallback: 위치 정보 없을 때 팔로우 가게 쿠폰만
  let query = supabase
    .from('coupons')
    .select(`
      id, store_id, coupon_kind, title, description,
      discount_type, discount_value, total_quantity, issued_count,
      expires_at, created_at, image_url, pick_count, click_count,
      target_segment, min_visit_count,
      stores!inner(id, name, category)
    `)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(limit);

  if (categoryFilter !== 'all') {
    query = query.eq('stores.category', categoryFilter);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as any[]).map(row => ({
    id:             row.id,
    store_id:       row.store_id,
    store_name:     row.stores?.name ?? '',
    store_category: row.stores?.category ?? 'food',
    coupon_kind:    row.coupon_kind,
    title:          row.title,
    description:    row.description,
    discount_type:  row.discount_type,
    discount_value: row.discount_value,
    total_quantity: row.total_quantity,
    issued_count:   row.issued_count,
    expires_at:     row.expires_at,
    created_at:     row.created_at,
    image_url:       row.image_url,
    pick_count:      row.pick_count ?? 0,
    click_count:     row.click_count ?? 0,
    target_segment:  row.target_segment ?? 'all',
    min_visit_count: row.min_visit_count ?? null,
  }));
}

// ── 유틸: 할인 표시 텍스트 ────────────────────────────────────────
export function formatDiscount(type: 'percent' | 'amount', value: number): string {
  if (type === 'percent') return `${value}% 할인`;
  return `${value.toLocaleString()}원 할인`;
}

// ── 유틸: 만료까지 남은 시간 표시 ────────────────────────────────
export function formatExpiry(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return '만료됨';
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}시간 후 만료`;
  const days = Math.floor(hours / 24);
  if (days <= 7) return `${days}일 후 만료`;
  return new Date(expiresAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) + ' 만료';
}
