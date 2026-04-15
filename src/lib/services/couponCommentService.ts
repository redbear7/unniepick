/**
 * couponCommentService — 사장님 전용 쿠폰 댓글 CRUD
 *
 * DB: coupon_comments 테이블
 * 정책: 읽기 전체 공개 / 쓰기·수정·삭제는 owner_id 본인만
 */

import { supabase } from '../supabase';

// ── 타입 ────────────────────────────────────────────────────────
export interface CouponComment {
  id:         string;
  coupon_id:  string;
  owner_id:   string;
  store_id:   string;
  content:    string;
  created_at: string;
  updated_at: string;
}

// ── 쿠폰별 댓글 목록 조회 ────────────────────────────────────────
export async function fetchCouponComments(couponId: string): Promise<CouponComment[]> {
  const { data, error } = await supabase
    .from('coupon_comments')
    .select('id, coupon_id, owner_id, store_id, content, created_at, updated_at')
    .eq('coupon_id', couponId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as CouponComment[];
}

// ── 댓글 추가 (사장님 전용) ──────────────────────────────────────
export async function addCouponComment(params: {
  couponId: string;
  ownerId:  string;
  storeId:  string;
  content:  string;
}): Promise<CouponComment> {
  const { couponId, ownerId, storeId, content } = params;
  const trimmed = content.trim();

  if (!trimmed) throw new Error('댓글 내용을 입력해주세요');
  if (trimmed.length > 500) throw new Error('댓글은 500자 이내로 작성해주세요');

  const { data, error } = await supabase
    .from('coupon_comments')
    .insert({
      coupon_id: couponId,
      owner_id:  ownerId,
      store_id:  storeId,
      content:   trimmed,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CouponComment;
}

// ── 댓글 수정 (본인만) ───────────────────────────────────────────
export async function updateCouponComment(
  commentId: string,
  content: string
): Promise<void> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('댓글 내용을 입력해주세요');

  const { error } = await supabase
    .from('coupon_comments')
    .update({ content: trimmed })
    .eq('id', commentId);

  if (error) throw error;
}

// ── 댓글 삭제 (본인만) ───────────────────────────────────────────
export async function deleteCouponComment(commentId: string): Promise<void> {
  const { error } = await supabase
    .from('coupon_comments')
    .delete()
    .eq('id', commentId);

  if (error) throw error;
}
