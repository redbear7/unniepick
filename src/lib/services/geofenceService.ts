/**
 * geofenceService.ts — Spec 01 Step 9  20개 우선순위 엔진
 *
 * • 활성 wallet 쿠폰 매장 좌표를 D-day + 거리 기준으로 정렬
 * • 상위 20개만 CLCircularRegion 등록 (iOS 최대값)
 * • 지오펜스 진입 → Live Activity 시작
 * • App Group 캐시 업데이트 → Widget 15분 갱신
 */

import { supabase } from '../supabase';
import { getAllWalletCoupons, WalletCoupon } from './couponWalletService';
import {
  configureGeofence,
  registerGeofenceRegions,
  onGeofenceEntered,
  GeofenceRegion,
  GeofenceEnteredEvent,
} from '../../native/UPGeofenceModule';
import {
  startLiveActivity,
  endLiveActivity,
  getCurrentActivityId,
} from '../../native/UPLiveActivityModule';

// ── 상수 ──────────────────────────────────────────────────────────
const SUPABASE_URL    = process.env.EXPO_PUBLIC_SUPABASE_URL    ?? '';
const SUPABASE_ANON   = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SHARED_SECRET   = process.env.EXPO_PUBLIC_GEOFENCE_SECRET ?? '';
const MAX_REGIONS     = 20;
const GEOFENCE_RADIUS = 150; // m

// ── 활성화 여부 추적 ──────────────────────────────────────────────
let _initialized      = false;
let _unsubEntered: (() => void) | null = null;
let _currentActId:  string | null = null;

// ════════════════════════════════════════════════════════════════
// MARK: – 초기화 (로그인 후 1회 호출)
// ════════════════════════════════════════════════════════════════

export async function initGeofenceEngine(): Promise<void> {
  if (_initialized) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return;

  // ── 1. 네이티브 모듈 구성 ─────────────────────────────────────
  configureGeofence({
    supabaseURL:  SUPABASE_URL,
    anonKey:      SUPABASE_ANON,
    accessToken:  session.access_token,
    sharedSecret: SHARED_SECRET,
  });

  // ── 2. 지오펜스 등록 ─────────────────────────────────────────
  await refreshGeofenceRegions(session.user.id, session.access_token);

  // ── 3. 진입 이벤트 핸들러 ────────────────────────────────────
  _unsubEntered = onGeofenceEntered(handleGeofenceEntered);

  // ── 4. 세션 갱신 시 토큰 업데이트 ────────────────────────────
  supabase.auth.onAuthStateChange((event, sess) => {
    if (event === 'TOKEN_REFRESHED' && sess?.access_token) {
      import('../../native/UPGeofenceModule').then(m =>
        m.setGeofenceToken(sess.access_token)
      );
    }
    if (event === 'SIGNED_OUT') {
      shutdownGeofenceEngine();
    }
  });

  _initialized = true;
  console.log('[geofenceService] initialized');
}

// ════════════════════════════════════════════════════════════════
// MARK: – 지오펜스 등록 갱신
// ════════════════════════════════════════════════════════════════

export async function refreshGeofenceRegions(
  userId: string,
  _accessToken?: string
): Promise<void> {
  // 현재 위치 (없어도 등록은 가능)
  let lat: number | undefined;
  let lng: number | undefined;
  try {
    const LocationModule = await import('expo-location');
    const { status } = await LocationModule.getForegroundPermissionsAsync();
    if (status === 'granted') {
      const pos = await LocationModule.getLastKnownPositionAsync();
      lat = pos?.coords.latitude;
      lng = pos?.coords.longitude;
    }
  } catch { /* ignore */ }

  const coupons = await getAllWalletCoupons(userId, lat, lng).catch(() => []);
  const active  = coupons.filter(c => c.status === 'active' && c.days_left > 0);

  // ── 우선순위: (거리 가까운 순) + (D-day 급한 순) ────────────────
  const ranked = active
    .slice()
    .sort((a, b) => {
      // 1. 거리 (가까울수록 우선)
      const distA = a.distance_m ?? 99999;
      const distB = b.distance_m ?? 99999;
      if (distA !== distB) return distA - distB;
      // 2. D-day (급할수록 우선)
      return a.days_left - b.days_left;
    })
    .slice(0, MAX_REGIONS);

  // ── 매장 좌표 조회 (ranked coupon의 store_id 목록) ────────────
  const storeIds = [...new Set(ranked.map(c => c.store_id))];
  if (!storeIds.length) return;

  const { data: stores } = await supabase
    .from('stores')
    .select('id, name, category_key, lat, lng')
    .in('id', storeIds)
    .eq('geo_discoverable', true);

  const storeMap = new Map(
    (stores ?? []).map(s => [s.id as string, s as {
      id: string; name: string; category_key: string; lat: number; lng: number;
    }])
  );

  const EMOJI_MAP: Record<string, string> = {
    cafe: '☕', food: '🍽', beauty: '✂️', nail: '💅',
  };

  // 지오펜스 배열 구성 (스토어 좌표가 있는 것만)
  const regions: GeofenceRegion[] = [];
  const seen = new Set<string>();

  for (const coupon of ranked) {
    const store = storeMap.get(coupon.store_id);
    if (!store || !store.lat || !store.lng) continue;
    if (seen.has(store.id)) continue; // 동일 매장 중복 제거
    seen.add(store.id);

    regions.push({
      store_id:    store.id,
      store_name:  store.name,
      store_emoji: EMOJI_MAP[store.category_key] ?? '🏪',
      lat:         store.lat,
      lng:         store.lng,
      radius_m:    GEOFENCE_RADIUS,
    });
  }

  registerGeofenceRegions(regions);
  console.log(`[geofenceService] registered ${regions.length} regions`);
}

// ════════════════════════════════════════════════════════════════
// MARK: – 지오펜스 진입 핸들러
// ════════════════════════════════════════════════════════════════

async function handleGeofenceEntered(event: GeofenceEnteredEvent): Promise<void> {
  console.log('[geofenceService] entered store:', event.store_id, `${event.distance_m}m`);

  // 이미 실행 중인 Live Activity 종료
  if (_currentActId) {
    await endLiveActivity(_currentActId).catch(() => {});
    _currentActId = null;
  }

  // 해당 매장의 쿠폰 조회
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return;

  const { data: coupons } = await supabase
    .from('user_coupons')
    .select(`
      id,
      coupon_id,
      coupons!inner (
        title,
        expires_at,
        store_id
      )
    `)
    .eq('user_id', session.user.id)
    .eq('status', 'active')
    .eq('coupons.store_id', event.store_id)
    .limit(3);

  if (!coupons?.length) return;

  const first   = coupons[0] as any;
  const title   = first.coupons?.title ?? '쿠폰';
  const expires = first.coupons?.expires_at;
  const dDay    = expires
    ? Math.max(0, Math.ceil((new Date(expires).getTime() - Date.now()) / 86400000))
    : 30;

  // Live Activity 시작
  const actId = await startLiveActivity({
    store_id:       event.store_id,
    user_coupon_id: first.id,
    store_emoji:    event.store_emoji,
    store_name:     event.store_name,
    coupon_title:   title,
    distance_m:     Math.round(event.distance_m),
    d_day:          dDay,
    coupon_count:   coupons.length,
  });

  if (actId) {
    _currentActId = actId;
  }
}

// ════════════════════════════════════════════════════════════════
// MARK: – 종료
// ════════════════════════════════════════════════════════════════

export function shutdownGeofenceEngine(): void {
  _unsubEntered?.();
  _unsubEntered = null;

  import('../../native/UPGeofenceModule').then(m => m.clearGeofenceRegions());

  if (_currentActId) {
    endLiveActivity(_currentActId).catch(() => {});
    _currentActId = null;
  }

  _initialized = false;
  console.log('[geofenceService] shutdown');
}
