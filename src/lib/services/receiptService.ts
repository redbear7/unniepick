import { supabase } from '../supabase';
import * as Location from 'expo-location';
import { extractReceiptData } from './ocrService';

export { extractReceiptData }; // 편의상 re-export

const MAX_RECEIPT_AGE_HOURS = 4;
const MAX_DISTANCE_METERS = 500;

// ──────────────────────────────────────────────────────────────
// 2. 영수증 시간 유효성 검사 (4시간 이내)
// ──────────────────────────────────────────────────────────────
export function validateReceiptTime(receiptDatetime: Date): { valid: boolean; message: string } {
  const now = new Date();
  const diffMs = now.getTime() - receiptDatetime.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 0) {
    return { valid: false, message: '영수증 날짜가 미래입니다. 확인해주세요.' };
  }
  if (diffHours > MAX_RECEIPT_AGE_HOURS) {
    const h = Math.floor(diffHours);
    return { valid: false, message: `${h}시간 전 영수증은 인증이 안 돼요. (4시간 이내만 가능)` };
  }
  return { valid: true, message: `${Math.floor(diffHours * 60)}분 전 영수증 확인됐어요 ✓` };
}

// ──────────────────────────────────────────────────────────────
// 4. 현재 위치 기준 가장 가까운 가맹점 찾기
// ──────────────────────────────────────────────────────────────
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface NearbyStore {
  id: string;
  name: string;
  businessName?: string; // 사업자 등록 상호명 (영수증에 표기되는 이름)
  districtId: string | null;
  districtName: string | null;
  distance: number;
}

// 현재 위치 기준 500m 이내 등록된 모든 가맹점 반환
export async function findNearbyStores(
  userLat: number,
  userLng: number
): Promise<NearbyStore[]> {
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name, latitude, longitude, district_id, districts(name)')
    .eq('is_active', true);

  if (!stores || stores.length === 0) return [];

  const nearby: NearbyStore[] = [];

  for (const s of stores) {
    if (!s.latitude || !s.longitude) continue;
    const dist = haversineDistance(userLat, userLng, s.latitude, s.longitude);
    if (dist <= MAX_DISTANCE_METERS) {
      nearby.push({
        id: s.id,
        name: s.name,
        districtId: s.district_id ?? null,
        districtName: (s.districts as any)?.name ?? null,
        distance: Math.round(dist),
      });
    }
  }

  // 가까운 순으로 정렬
  return nearby.sort((a, b) => a.distance - b.distance);
}

// ──────────────────────────────────────────────────────────────
// 4-2. 영수증 OCR 텍스트에서 등록된 가맹점명 매칭
// ──────────────────────────────────────────────────────────────
export interface StoreMatchResult {
  matched: boolean;
  store: NearbyStore | null;
  matchedKeyword: string | null;
}

export function matchStoreInReceipt(
  ocrText: string,
  nearbyStores: NearbyStore[]
): StoreMatchResult {
  // 공백·특수문자 제거 후 소문자 비교
  const normalizedText = ocrText.replace(/[\s\-_]/g, '').toLowerCase();

  for (const store of nearbyStores) {
    // 가게 이름에서 비교 키워드 생성
    const keywords = buildKeywords(store.name);

    for (const kw of keywords) {
      if (normalizedText.includes(kw)) {
        return { matched: true, store, matchedKeyword: kw };
      }
    }
  }

  return { matched: false, store: null, matchedKeyword: null };
}

// 가게명 → 검색 키워드 배열 생성
function buildKeywords(storeName: string): string[] {
  const base = storeName.replace(/[\s\-_]/g, '').toLowerCase();
  const keywords: string[] = [base];

  // 괄호 내용 제거한 버전 (예: "맛집(본점)" → "맛집")
  const withoutParens = storeName.replace(/\(.*?\)/g, '').trim()
    .replace(/[\s\-_]/g, '').toLowerCase();
  if (withoutParens && withoutParens !== base) keywords.push(withoutParens);

  // 공통 접미사 제거한 버전 (본점, 1호점, 지점 등)
  const noSuffix = base
    .replace(/(본점|지점|[0-9]+호점|직영점|가맹점)$/, '');
  if (noSuffix && noSuffix !== base && noSuffix.length >= 2) keywords.push(noSuffix);

  // 3글자 이상이면 앞 3글자도 시도 (마지막 수단)
  if (base.length >= 4) keywords.push(base.slice(0, 3));

  return [...new Set(keywords)].filter(k => k.length >= 2);
}

// ──────────────────────────────────────────────────────────────
// 5. 영수증 인증 최종 제출 (이미지 저장 없음)
// ──────────────────────────────────────────────────────────────
export interface ReceiptSubmitParams {
  userId: string;
  storeId: string;
  storeName: string;
  districtId: string | null;
  districtName: string | null;
  amount: number;
  receiptDatetime: Date;
  userLat: number;
  userLng: number;
}

export async function submitReceiptVerification(params: ReceiptSubmitParams) {
  const { error } = await supabase.from('receipt_verifications').insert({
    user_id: params.userId,
    store_id: params.storeId,
    district_id: params.districtId,
    store_name: params.storeName,
    district_name: params.districtName,
    amount: params.amount,
    receipt_datetime: params.receiptDatetime.toISOString(),
    user_lat: params.userLat,
    user_lng: params.userLng,
  });

  if (error) {
    if (error.code === '23505') { // unique violation
      throw new Error('이미 인증한 영수증이에요! (중복 인증 불가)');
    }
    throw error;
  }

  // 스탬프 자동 적립 (best-effort, 12시간 쿨다운 체크)
  if (params.storeId) {
    try {
      await supabase.rpc('try_add_stamp', {
        p_user_id:  params.userId,
        p_store_id: params.storeId,
        p_source:   'receipt',
      });
    } catch { /* 스탬프 실패는 무시 */ }
  }
}

// ──────────────────────────────────────────────────────────────
// 6. 랭킹 조회
// ──────────────────────────────────────────────────────────────
export interface RankingEntry {
  rankNo: number;
  userId: string;
  nickname: string;
  avatarEmoji: string;
  totalAmount: number;
  receiptCount: number;
  couponUsedCount: number;
}

export async function getDistrictRanking(districtId?: string): Promise<RankingEntry[]> {
  const { data, error } = await supabase.rpc('get_district_ranking', {
    p_district_id: districtId ?? null,
  });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    rankNo: Number(r.rank_no),
    userId: r.user_id,
    nickname: r.nickname,
    avatarEmoji: r.avatar_emoji ?? '🐻',
    totalAmount: Number(r.total_amount),
    receiptCount: Number(r.receipt_count),
    couponUsedCount: Number(r.coupon_used_count),
  }));
}

export async function getMyStats(userId: string): Promise<{
  totalAmount: number;
  receiptCount: number;
  couponUsedCount: number;
}> {
  const [receiptResult, couponResult] = await Promise.all([
    supabase
      .from('receipt_verifications')
      .select('amount')
      .eq('user_id', userId),
    supabase
      .from('user_coupons')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'used'),
  ]);

  const amounts = receiptResult.data ?? [];
  const coupons = couponResult.data ?? [];

  return {
    totalAmount: amounts.reduce((sum, r) => sum + r.amount, 0),
    receiptCount: amounts.length,
    couponUsedCount: coupons.length,
  };
}

// ──────────────────────────────────────────────────────────────
// 7. 프로필 닉네임 관리
// ──────────────────────────────────────────────────────────────
export async function upsertProfile(userId: string, nickname: string, avatarEmoji?: string) {
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    nickname,
    avatar_emoji: avatarEmoji ?? '🐻',
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function getProfile(userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('nickname, avatar_emoji')
    .eq('id', userId)
    .single();
  return data;
}
