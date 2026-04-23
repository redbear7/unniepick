import { supabase } from '../supabase';
import { recordVisitAndAutoIssue } from './visitService';

// ─── 쿠폰 종류 ────────────────────────────────────────────────
export type CouponKind = 'regular' | 'timesale' | 'service' | 'experience';

export const COUPON_KIND_CONFIG: Record<
  CouponKind,
  { label: string; emoji: string; bg: string; subBg: string }
> = {
  regular:    { label: '상시할인', emoji: '🎟', bg: '#5B67CA', subBg: '#E8EAFD' },
  timesale:   { label: '타임세일', emoji: '⏰', bg: '#FF6B3D', subBg: '#FFF0EB' },
  service:    { label: '서비스',  emoji: '🎁', bg: '#2DB87A', subBg: '#E6F7F0' },
  experience: { label: '체험단',  emoji: '🌟', bg: '#D946B0', subBg: '#FCE8F7' },
};

export function getCouponKindConfig(kind?: string | null) {
  return COUPON_KIND_CONFIG[(kind as CouponKind) ?? 'regular'] ?? COUPON_KIND_CONFIG.regular;
}

// ─────────────────────────────────────────────────────────────

export interface StoreInfo {
  id: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  district_id?: string | null;
  district?: { id: string; name: string } | null;
}

export interface CouponRow {
  id: string;
  owner_id: string;
  store_id: string;
  coupon_kind: CouponKind;
  title: string;
  description: string;
  discount_type: 'percent' | 'amount';
  discount_value: number;
  total_quantity: number | null;      // null = 무제한
  issued_count: number;
  expires_at: string;
  is_active: boolean;
  created_at: string;
  click_count?: number;               // 쿠폰 클릭 수
  pick_count?: number;                // PICK 수
  // 체험단 전용 필드
  experience_offer?: string | null;   // 체험단 제공 내용
  experience_mission?: string | null; // 체험단 미션
  // 이미지 (최대 2장)
  image_url?:  string | null;
  image_url2?: string | null;
  store?: StoreInfo;
}

// 시샵 통계용
export interface CouponWithStats extends CouponRow {
  click_count: number;
  store_name?: string;
}

export interface UserCouponRow {
  id: string;
  user_id: string;
  coupon_id: string;
  status: 'available' | 'used' | 'cancelled' | 'noshow';
  qr_token: string;
  received_at: string;
  used_at: string | null;
  cancelled_at: string | null;
  coupon: CouponRow;
}

// 취소 가능 기한: 만료일 하루 전 23:59:59
export function getCancelDeadline(expiresAt: string): Date {
  const d = new Date(expiresAt);
  d.setDate(d.getDate() - 1);
  d.setHours(23, 59, 59, 999);
  return d;
}

// 지금 취소 가능한지 여부
export function canCancelCoupon(expiresAt: string): boolean {
  return new Date() <= getCancelDeadline(expiresAt);
}

// 취소 기한 표시 텍스트
export function cancelDeadlineText(expiresAt: string): string {
  const deadline = getCancelDeadline(expiresAt);
  const m = deadline.getMonth() + 1;
  const d = deadline.getDate();
  return `${m}/${d} 자정까지 취소 가능`;
}

const STORE_JOIN = `
  store:stores(
    id, name, latitude, longitude, district_id,
    district:districts(id, name)
  )
`;

// 활성 쿠폰 목록 (고객 화면 - 가게명·상권 조인 포함)
export async function fetchActiveCoupons(): Promise<CouponRow[]> {
  const { data, error } = await supabase
    .from('coupons')
    .select(`*, ${STORE_JOIN}`)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as CouponRow[];
}

// 내 쿠폰 목록 (고객 - 가게명·상권 조인 포함)
export async function fetchMyCoupons(userId: string): Promise<UserCouponRow[]> {
  const { data, error } = await supabase
    .from('user_coupons')
    .select(`
      *,
      coupon:coupons(*, ${STORE_JOIN})
    `)
    .eq('user_id', userId)
    .order('received_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as UserCouponRow[];
}

// ── A. 쿠폰 수령 자격 검사 ────────────────────────────────────
// target_segment에 따라 신규·재방문 조건을 검사합니다.
export async function checkCouponEligibility(
  userId:   string,
  couponId: string,
): Promise<{ eligible: boolean; reason?: string }> {
  const { data: coupon } = await supabase
    .from('coupons')
    .select('target_segment, min_visit_count, store_id')
    .eq('id', couponId)
    .single();

  if (!coupon) return { eligible: false, reason: '쿠폰을 찾을 수 없어요' };

  const seg = coupon.target_segment ?? 'all';

  if (seg === 'all') return { eligible: true };

  // 방문 횟수 조회
  const { data: visitCount } = await supabase.rpc('get_store_visit_count', {
    p_user_id:  userId,
    p_store_id: coupon.store_id,
  });
  const count = (visitCount as number) ?? 0;

  if (seg === 'new') {
    // 신규 전용: 방문 기록이 없어야 함
    if (count > 0) {
      return { eligible: false, reason: '첫 방문 고객 전용 쿠폰이에요' };
    }
  } else if (seg === 'returning') {
    // 재방문 전용: min_visit_count 이상이어야 함
    const required = coupon.min_visit_count ?? 2;
    if (count < required) {
      return {
        eligible: false,
        reason: `${required}회 이상 방문 고객 전용 쿠폰이에요 (현재 ${count}회)`,
      };
    }
  }

  return { eligible: true };
}

// 쿠폰 받기
export async function claimCoupon(userId: string, couponId: string): Promise<UserCouponRow> {
  // 수량 체크
  const { data: coupon } = await supabase
    .from('coupons')
    .select('issued_count, total_quantity')
    .eq('id', couponId)
    .single();

  if (!coupon) throw new Error('쿠폰을 찾을 수 없어요');
  // total_quantity가 null이면 무제한 — 수량 체크 생략
  if (coupon.total_quantity !== null && coupon.issued_count >= coupon.total_quantity) {
    throw new Error('쿠폰이 모두 소진됐어요');
  }

  // A. 대상 고객 자격 검사
  const eligibility = await checkCouponEligibility(userId, couponId);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason ?? '수령 조건을 충족하지 않아요');
  }

  const { data, error } = await supabase
    .from('user_coupons')
    .insert({ user_id: userId, coupon_id: couponId })
    .select(`*, coupon:coupons(*, ${STORE_JOIN})`)
    .single();

  if (error) {
    if (error.code === '23505') throw new Error('이미 받은 쿠폰이에요');
    throw error;
  }
  return data as UserCouponRow;
}

// 쿠폰 사용 처리 (QR 스캔 후 사장님이 호출)
export async function useCoupon(qrToken: string): Promise<{ success: boolean; message: string }> {
  const { data: userCoupon, error: findError } = await supabase
    .from('user_coupons')
    .select(`*, coupon:coupons(title, discount_type, discount_value, expires_at, store_id)`)
    .eq('qr_token', qrToken)
    .single();

  if (findError || !userCoupon) return { success: false, message: '유효하지 않은 쿠폰이에요' };
  if (userCoupon.status === 'used') return { success: false, message: '이미 사용된 쿠폰이에요' };

  const coupon = userCoupon.coupon as any;
  if (new Date(coupon.expires_at) < new Date()) {
    return { success: false, message: '만료된 쿠폰이에요' };
  }

  const { error: updateError } = await supabase
    .from('user_coupons')
    .update({ status: 'used', used_at: new Date().toISOString() })
    .eq('id', userCoupon.id);

  if (updateError) throw updateError;

  // 스탬프 + UNNI 자동 적립 + B·D 방문 기록 & 쿠폰 자동 발급 (best-effort)
  if (coupon.store_id && userCoupon.user_id) {
    try {
      await supabase.rpc('try_add_stamp', {
        p_user_id:  userCoupon.user_id,
        p_store_id: coupon.store_id,
        p_source:   'coupon_used',
      });
    } catch { /* 스탬프 실패는 무시 */ }
    try {
      await supabase.rpc('earn_unni', {
        p_user_id:    userCoupon.user_id,
        p_event_type: 'coupon',
        p_store_id:   coupon.store_id,
      });
    } catch { /* UNNI 적립 실패는 무시 */ }
    // B. 방문 기록 + D. 자동 발급 트리거
    recordVisitAndAutoIssue(userCoupon.user_id, coupon.store_id, 'coupon_used').catch(() => {});
  }

  const discountText = coupon.discount_type === 'percent'
    ? `${coupon.discount_value}% 할인`
    : `${coupon.discount_value.toLocaleString()}원 할인`;

  return { success: true, message: `${coupon.title} (${discountText}) 사용 완료!` };
}

// ── PIN 입력으로 쿠폰 사용 처리 ────────────────────────────────────────────
export interface PinUseResult {
  success:        boolean;
  message:        string;
  store_name?:    string;
  coupon_title?:  string;
  discount_type?: string;
  discount_value?:number;
  reason?:        string;
}

export async function useCouponByPin(
  userCouponId: string,
  userId:       string,
  pin:          string,
): Promise<PinUseResult> {
  const { data, error } = await supabase.rpc('use_coupon_by_pin', {
    p_user_coupon_id: userCouponId,
    p_user_id:        userId,
    p_pin:            pin,
  });

  if (error) throw new Error(error.message);
  return data as PinUseResult;
}

// ── 가게 PIN 조회 (사장님용) ─────────────────────────────────────────────────
export async function getStoreCouponPin(
  storeId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('stores')
    .select('coupon_pin')
    .eq('id', storeId)
    .single();

  if (error) return null;
  return (data as any)?.coupon_pin ?? null;
}

// ── 가게 PIN 설정/변경 (사장님용) ────────────────────────────────────────────
export async function setStoreCouponPin(
  storeId: string,
  pin?: string,       // undefined → 자동 생성
): Promise<string> {
  const { data, error } = await supabase.rpc('set_store_coupon_pin', {
    p_store_id: storeId,
    p_pin:      pin ?? null,
  });

  if (error) throw new Error(error.message);
  return data as string;
}

// 쿠폰 반납 (취소)
export async function cancelCoupon(userCouponId: string, userId: string): Promise<void> {
  // 쿠폰 조회 (만료일 확인용)
  const { data: uc, error: fetchErr } = await supabase
    .from('user_coupons')
    .select('status, coupon:coupons(expires_at)')
    .eq('id', userCouponId)
    .eq('user_id', userId)
    .single();

  if (fetchErr || !uc) throw new Error('쿠폰을 찾을 수 없어요');
  if (uc.status !== 'available') throw new Error('이미 사용되었거나 취소된 쿠폰이에요');

  const expiresAt = (uc.coupon as any)?.expires_at;
  if (expiresAt && !canCancelCoupon(expiresAt)) {
    throw new Error('당일 취소는 불가해요. 하루 전 자정까지만 취소할 수 있어요');
  }

  const { error } = await supabase
    .from('user_coupons')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', userCouponId)
    .eq('user_id', userId);

  if (error) throw error;
}

// 쿠폰 클릭 수 증가 (best-effort, fire-and-forget)
export async function incrementCouponClick(couponId: string): Promise<void> {
  await supabase.rpc('increment_coupon_click', { p_coupon_id: couponId });
}

// 시샵 - 전체 쿠폰 + 클릭 수 통계 (클릭 수 내림차순)
export async function fetchAllCouponsWithStats(): Promise<CouponWithStats[]> {
  const { data, error } = await supabase
    .from('coupons')
    .select('*, store:stores(id, name)')
    .order('click_count', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(c => ({
    ...c,
    click_count: c.click_count ?? 0,
    store_name: (c.store as any)?.name ?? undefined,
  })) as CouponWithStats[];
}

// 특정 가게의 활성 쿠폰 목록
export async function fetchStoreActiveCoupons(storeId: string): Promise<CouponRow[]> {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CouponRow[];
}

// 시샵용 - 전체 활성 가게 목록
export interface StoreSimple {
  id: string;
  owner_id: string;
  name: string;
  category: string;
}
export async function fetchAllStores(): Promise<StoreSimple[]> {
  const { data, error } = await supabase
    .from('stores')
    .select('id, owner_id, name, category')
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as StoreSimple[];
}

// 사장님 쿠폰 생성
export async function createCoupon(params: {
  ownerId: string;
  storeId: string;
  couponKind: CouponKind;
  title: string;
  description: string;
  discountType: 'percent' | 'amount';
  discountValue: number;
  totalQuantity: number | null;       // null = 무제한
  expiresAt: string;
  experienceOffer?: string;
  experienceMission?: string;
}): Promise<CouponRow> {
  const { data, error } = await supabase
    .from('coupons')
    .insert({
      owner_id: params.ownerId,
      store_id: params.storeId,
      coupon_kind: params.couponKind,
      title: params.title,
      description: params.description,
      discount_type: params.discountType,
      discount_value: params.discountValue,
      total_quantity: params.totalQuantity,
      expires_at: new Date(params.expiresAt).toISOString(),
      ...(params.couponKind === 'experience' && {
        experience_offer: params.experienceOffer ?? '',
        experience_mission: params.experienceMission ?? '',
      }),
    })
    .select()
    .single();

  if (error) throw error;
  return data as CouponRow;
}

// 사장님 쿠폰 목록
export async function fetchOwnerCoupons(ownerId: string): Promise<CouponRow[]> {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// 쿠폰 활성/비활성 토글
export async function toggleCouponActive(couponId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('coupons')
    .update({ is_active: isActive })
    .eq('id', couponId);
  if (error) throw error;
}

// 쿠폰 삭제
export async function deleteCoupon(couponId: string): Promise<void> {
  const { error } = await supabase.from('coupons').delete().eq('id', couponId);
  if (error) throw error;
}

// 쿠폰 이미지 URL 업데이트 (생성 직후 Storage 업로드 후 호출)
export async function updateCouponImages(
  couponId: string,
  imageUrl:  string | null,
  imageUrl2: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('coupons')
    .update({ image_url: imageUrl, image_url2: imageUrl2 })
    .eq('id', couponId);
  if (error) throw error;
}

// Supabase Storage에 이미지 업로드 후 공개 URL 반환
export async function uploadCouponImage(
  storeId:   string,
  couponId:  string,
  slot:      1 | 2,
  localUri:  string,
  mimeType:  string,
): Promise<string> {
  const ext  = mimeType.includes('png') ? 'png' : 'jpg';
  const path = `${storeId}/${couponId}/${slot}.${ext}`;

  const response = await fetch(localUri);
  const blob     = await response.blob();

  const { error } = await supabase.storage
    .from('coupon-images')
    .upload(path, blob, { contentType: mimeType, upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from('coupon-images').getPublicUrl(path);
  return data.publicUrl;
}
