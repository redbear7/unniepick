import { supabase } from '../supabase';

export interface ReviewRow {
  id:         string;
  rating:     number;
  comment:    string | null;
  created_at: string;
}

// ─── 후기 등록 / 수정 ──────────────────────────────────────────────
export async function submitReview(
  userCouponId: string,
  rating: number,
  comment?: string,
): Promise<void> {
  const { error } = await supabase.rpc('submit_coupon_review', {
    p_user_coupon_id: userCouponId,
    p_rating:         rating,
    p_comment:        comment ?? null,
  });
  if (error) throw error;
}

// ─── 해당 쿠폰의 내 후기 조회 (있으면 수정, 없으면 신규) ─────────────
export async function getMyReview(userCouponId: string): Promise<ReviewRow | null> {
  const { data, error } = await supabase.rpc('get_my_review', {
    p_user_coupon_id: userCouponId,
  });
  if (error) throw error;
  return (data?.[0] as ReviewRow) ?? null;
}

// ─── 가게 전체 후기 ────────────────────────────────────────────────
export async function fetchStoreReviews(storeId: string): Promise<{
  reviews: (ReviewRow & { coupon_title?: string })[];
  avg_rating: number;
  review_count: number;
}> {
  const { data, error } = await supabase
    .from('coupon_reviews')
    .select(`
      id, rating, comment, created_at,
      coupon:coupon_id(title)
    `)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const reviews = (data ?? []).map((r: any) => ({
    id:           r.id,
    rating:       r.rating,
    comment:      r.comment,
    created_at:   r.created_at,
    coupon_title: r.coupon?.title,
  }));

  const avg = reviews.length > 0
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : 0;

  return { reviews, avg_rating: avg, review_count: reviews.length };
}
