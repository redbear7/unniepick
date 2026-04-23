/**
 * visitService — 가게 방문 횟수 추적
 *
 * store_visits 테이블에 방문을 기록하고 방문 횟수를 조회합니다.
 * - 하루 1회 중복 방지 (DB 함수에서 처리)
 * - 쿠폰 사용·스탬프 적립 시 자동 호출
 * - 방문 횟수 기반으로 신규·재방문 쿠폰 자동 발급 트리거
 */

import { supabase } from '../supabase';

export type VisitSource = 'coupon_used' | 'stamp' | 'manual';

// ── 방문 기록 (best-effort, 실패해도 본 기능 차단 안 함) ──────
export async function recordStoreVisit(
  userId:  string,
  storeId: string,
  source:  VisitSource = 'coupon_used',
): Promise<void> {
  try {
    await supabase.rpc('record_store_visit', {
      p_user_id:  userId,
      p_store_id: storeId,
      p_source:   source,
    });
  } catch (e) {
    console.warn('[visitService] record_store_visit 실패:', e);
  }
}

// ── 방문 횟수 조회 ────────────────────────────────────────────
export async function getStoreVisitCount(
  userId:  string,
  storeId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('get_store_visit_count', {
    p_user_id:  userId,
    p_store_id: storeId,
  });
  if (error) return 0;
  return (data as number) ?? 0;
}

// ── D. 쿠폰 자동 발급 트리거 (방문 후 호출) ──────────────────
// 신규(1회) / 재방문(N회) 달성 시 해당 쿠폰 자동 발급
// 반환: 발급된 쿠폰 수
export async function autoIssueCoupons(
  userId:  string,
  storeId: string,
): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('auto_issue_coupons', {
      p_user_id:  userId,
      p_store_id: storeId,
    });
    if (error) return 0;
    return (data as number) ?? 0;
  } catch {
    return 0;
  }
}

// ── 방문 기록 + 자동 발급 통합 호출 ──────────────────────────
// 쿠폰 사용·스탬프 적립 후 이 함수 하나만 호출하면 됨
export async function recordVisitAndAutoIssue(
  userId:  string,
  storeId: string,
  source:  VisitSource = 'coupon_used',
): Promise<{ issuedCount: number }> {
  await recordStoreVisit(userId, storeId, source);
  const issuedCount = await autoIssueCoupons(userId, storeId);
  return { issuedCount };
}
