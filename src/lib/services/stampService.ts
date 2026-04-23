import { supabase } from '../supabase';
import { recordVisitAndAutoIssue } from './visitService';

// ── 스탬프 자동 적립 결과 ─────────────────────────────────────────
export interface StampResult {
  success: boolean;
  reason?: 'cooldown';
  stamp_count?: number;
  is_reward?: boolean;
  next_available?: string; // ISO string
}

// 12시간 쿨다운 체크 후 스탬프 적립 (try_add_stamp RPC)
// B·D: 스탬프 성공 시 방문 기록 + 신규·재방문 쿠폰 자동 발급
export async function tryAddStamp(
  userId: string,
  storeId: string,
  source: 'coupon_used' | 'receipt' | 'owner_scan' = 'owner_scan'
): Promise<StampResult> {
  const { data, error } = await supabase.rpc('try_add_stamp', {
    p_user_id:  userId,
    p_store_id: storeId,
    p_source:   source,
  });
  if (error) throw error;

  const result = data as StampResult;
  // 스탬프 성공(쿨다운 아님)인 경우에만 방문 기록 + 쿠폰 자동 발급
  if (result.success) {
    recordVisitAndAutoIssue(userId, storeId, 'stamp').catch(() => {});
  }
  return result;
}

export interface StampCardRow {
  id: string;
  user_id: string;
  store_id: string;
  stamp_count: number;
  required_count: number;
  created_at: string;
}

// 내 스탬프 카드 조회 (없으면 자동 생성)
export async function getOrCreateStampCard(
  userId: string,
  storeId: string
): Promise<StampCardRow> {
  const { data: existing } = await supabase
    .from('stamp_cards')
    .select('*')
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .single();

  if (existing) return existing as StampCardRow;

  // 없으면 새로 생성
  const { data, error } = await supabase
    .from('stamp_cards')
    .insert({ user_id: userId, store_id: storeId })
    .select()
    .single();

  if (error) throw error;
  return data as StampCardRow;
}

// 스탬프 목록 (내 모든 가게)
export async function fetchMyStampCards(userId: string): Promise<StampCardRow[]> {
  const { data, error } = await supabase
    .from('stamp_cards')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return data ?? [];
}

// 스탬프 적립 (QR 스캔 후 사장님이 호출)
export async function addStamp(
  userId: string,
  storeId: string,
  stampedBy: string
): Promise<{ stampCard: StampCardRow; isRewardIssued: boolean }> {
  // 스탬프 카드 조회 또는 생성
  const card = await getOrCreateStampCard(userId, storeId);
  const prevCount = card.stamp_count;
  const newCount = prevCount + 1;

  // 스탬프 +1 업데이트 (트리거가 리워드 처리)
  const { data: updatedCard, error: updateError } = await supabase
    .from('stamp_cards')
    .update({ stamp_count: newCount })
    .eq('id', card.id)
    .select()
    .single();

  if (updateError) throw updateError;

  // 스탬프 히스토리 기록
  await supabase.from('stamp_history').insert({
    stamp_card_id: card.id,
    stamped_by: stampedBy,
  });

  // 리워드 발급 여부 (트리거가 stamp_count를 0으로 리셋함)
  const isRewardIssued = (updatedCard as StampCardRow).stamp_count === 0 && prevCount + 1 >= card.required_count;

  return { stampCard: updatedCard as StampCardRow, isRewardIssued };
}

// QR 토큰으로 사용자 조회 (사장님 QR 스캔용)
export async function getUserByQrToken(qrToken: string): Promise<{ userId: string } | null> {
  // MVP: user_coupon qr_token에서 user_id 추출
  const { data } = await supabase
    .from('user_coupons')
    .select('user_id')
    .eq('qr_token', qrToken)
    .single();

  if (!data) return null;
  return { userId: data.user_id };
}
