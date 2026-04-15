import { supabase } from '../supabase';
import { CouponRow } from './couponService';

// ── 타입 ────────────────────────────────────────────────────────────
export interface StorePostRow {
  id:               string;
  store_id:         string;
  owner_id:         string;
  content:          string;
  linked_coupon_id: string | null;
  like_count:       number;
  pick_count:       number;
  created_at:       string;
  store?: {
    id: string;
    name: string;
    latitude?:  number | null;
    longitude?: number | null;
    district?: { id: string; name: string } | null;
  } | null;
  linked_coupon?: CouponRow | null;
}

const POST_SELECT = `
  id, store_id, owner_id, content, linked_coupon_id, like_count, pick_count, created_at,
  store:store_id(
    id, name, latitude, longitude,
    district:district_id(id, name)
  ),
  linked_coupon:linked_coupon_id(
    id, coupon_kind, title, description,
    discount_type, discount_value,
    total_quantity, issued_count, expires_at, is_active, created_at,
    experience_offer, experience_mission,
    store:store_id(id, name, latitude, longitude, district:district_id(id, name))
  )
`;

// ── 홈 피드 전용: 게시물 + 가게별 최신 쿠폰 1개 + 쿠폰 수 ─────────────
export interface AttachedPlaylist {
  id:          string;
  name:        string;
  mood_tags:   string[];    // e.g. ['lo-fi', 'cozy', '85bpm']
  track_count: number;
  is_dynamic:  boolean;     // true = AI-curated from tracks, false = pre-made
  cover_emoji?: string;
}

export interface HomeFeedPost extends StorePostRow {
  coupon_count:     number;
  latest_coupon:    CouponRow | null;
  linked_playlist?: AttachedPlaylist | null;
}

export async function fetchHomeFeed(): Promise<HomeFeedPost[]> {
  // 1. 전체 게시물
  const posts = await fetchStorePosts();
  if (posts.length === 0) return [];

  // 2. 고유 store_id 수집
  const storeIds = [...new Set(posts.map(p => p.store_id))];

  // 3. 해당 가게들의 활성 쿠폰 일괄 조회 (최신순)
  const { data: coupons } = await supabase
    .from('coupons')
    .select(`
      id, store_id, coupon_kind, title, description,
      discount_type, discount_value,
      total_quantity, issued_count, expires_at,
      is_active, created_at, pick_count,
      experience_offer, experience_mission,
      store:store_id(id, name, latitude, longitude, district:district_id(id, name))
    `)
    .in('store_id', storeIds)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  // 4. 가게별 쿠폰 그룹
  const couponMap: Record<string, CouponRow[]> = {};
  for (const c of (coupons ?? []) as CouponRow[]) {
    if (!couponMap[c.store_id]) couponMap[c.store_id] = [];
    couponMap[c.store_id].push(c);
  }

  // 5. 쿠폰이 있는 가게의 게시물만 + latest_coupon / coupon_count 추가
  return posts
    .filter(p => (couponMap[p.store_id]?.length ?? 0) > 0)
    .map(p => ({
      ...p,
      coupon_count:  couponMap[p.store_id]?.length ?? 0,
      latest_coupon: couponMap[p.store_id]?.[0] ?? null,
    }));
}

// ── 피드 전체 게시물 ─────────────────────────────────────────────────
export async function fetchStorePosts(): Promise<StorePostRow[]> {
  const { data, error } = await supabase
    .from('store_posts')
    .select(POST_SELECT)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as StorePostRow[];
}

// ── 특정 가게 게시물 (사장님용) ──────────────────────────────────────
export async function fetchMyPosts(storeId: string): Promise<StorePostRow[]> {
  const { data, error } = await supabase
    .from('store_posts')
    .select('id, content, linked_coupon_id, like_count, created_at')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as StorePostRow[];
}

// ── 게시물 설정 (운영 시간 / 쿨다운) ────────────────────────────────
export interface PostSettings {
  post_start_hour:    number;
  post_end_hour:      number;
  post_cooldown_hours: number;
}

export async function fetchPostSettings(): Promise<PostSettings> {
  const { data, error } = await supabase.rpc('get_post_settings');
  if (error || !data?.[0]) return { post_start_hour: 8, post_end_hour: 20, post_cooldown_hours: 12 };
  return data[0] as PostSettings;
}

export async function updatePostSettings(settings: PostSettings): Promise<void> {
  const { error } = await supabase.rpc('update_post_settings', {
    p_start_hour:     settings.post_start_hour,
    p_end_hour:       settings.post_end_hour,
    p_cooldown_hours: settings.post_cooldown_hours,
  });
  if (error) throw error;
}

// ── 게시물 작성 에러 파싱 ─────────────────────────────────────────────
export interface PostCreateError {
  code: 'outside_hours' | 'cooldown_active' | 'unauthorized' | 'unknown';
  /** 운영 시작 시각 (시) */
  startHour?: number;
  /** 운영 종료 시각 (시) */
  endHour?: number;
  /** 쿨다운 남은 초 */
  remainSeconds?: number;
  message: string;
}

export function parsePostError(raw: string): PostCreateError {
  if (raw.startsWith('post_outside_hours:')) {
    const [, sh, eh] = raw.split(':');
    const startHour = parseInt(sh, 10);
    const endHour   = parseInt(eh, 10);
    return {
      code: 'outside_hours',
      startHour,
      endHour,
      message: `게시물은 ${startHour}시~${endHour}시에만 작성할 수 있어요`,
    };
  }
  if (raw.startsWith('post_cooldown_active:')) {
    const secs = parseInt(raw.split(':')[1], 10);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const label = h > 0 ? `${h}시간 ${m}분` : `${m}분`;
    return {
      code: 'cooldown_active',
      remainSeconds: secs,
      message: `다음 게시물까지 ${label} 남았어요`,
    };
  }
  if (raw === 'unauthorized') {
    return { code: 'unauthorized', message: '게시물 작성 권한이 없어요' };
  }
  return { code: 'unknown', message: raw };
}

// ── 게시물 작성 ──────────────────────────────────────────────────────
export async function createPost(
  storeId: string,
  content: string,
  linkedCouponId?: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc('create_store_post', {
    p_store_id:         storeId,
    p_content:          content,
    p_linked_coupon_id: linkedCouponId ?? null,
  });
  if (error) throw parsePostError(error.message);
  return data as string;
}

// ── 게시물 수정 ──────────────────────────────────────────────────────
export async function editPost(postId: string, content: string): Promise<void> {
  const { error } = await supabase.rpc('edit_store_post', {
    p_post_id: postId,
    p_content: content,
  });
  if (error) throw error;
}

// ── 게시물 삭제 (직접 삭제, 내부용 / 시샵 승인 후 호출됨) ────────────
export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_store_post', { p_post_id: postId });
  if (error) throw error;
}

// ── 게시물 삭제 요청 ────────────────────────────────────────────────
export async function requestPostDelete(postId: string, reason: string): Promise<string> {
  const { data, error } = await supabase.rpc('request_post_delete', {
    p_post_id: postId,
    p_reason:  reason,
  });
  if (error) {
    if (error.message === 'request_already_pending') throw new Error('이미 삭제 요청이 접수되어 있어요');
    if (error.message === 'unauthorized') throw new Error('삭제 요청 권한이 없어요');
    throw error;
  }
  return data as string;
}

// ── 삭제 요청 타입 ───────────────────────────────────────────────────
export interface PostDeleteRequest {
  id:                string;
  post_id:           string;
  store_id:          string;
  owner_id:          string;
  reason:            string;
  status:            'pending' | 'approved' | 'rejected';
  admin_note:        string | null;
  has_active_coupon: boolean;
  requested_at:      string;
  processed_at:      string | null;
  post?: { content: string } | null;
  store?: { name: string } | null;
}

// ── 수정 로그 타입 ───────────────────────────────────────────────────
export interface PostEditLog {
  id:          string;
  post_id:     string;
  store_id:    string;
  editor_id:   string;
  old_content: string;
  new_content: string;
  edited_at:   string;
  store?: { name: string } | null;
}

// ── 내 삭제 요청 목록 (사장님용) ────────────────────────────────────
export async function fetchMyPostDeleteRequests(storeId: string): Promise<PostDeleteRequest[]> {
  const { data, error } = await supabase
    .from('store_post_delete_requests')
    .select('*, post:post_id(content)')
    .eq('store_id', storeId)
    .order('requested_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as PostDeleteRequest[];
}

// ── 전체 삭제 요청 (시샵용) ─────────────────────────────────────────
export async function fetchAllPostDeleteRequests(): Promise<PostDeleteRequest[]> {
  const { data, error } = await supabase
    .from('store_post_delete_requests')
    .select('*, post:post_id(content), store:store_id(name)')
    .order('requested_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as PostDeleteRequest[];
}

// ── 삭제 요청 처리 (시샵용) ─────────────────────────────────────────
export async function processPostDeleteRequest(
  requestId: string,
  action: 'approved' | 'rejected',
  note?: string,
): Promise<void> {
  const { error } = await supabase.rpc('process_post_delete_request', {
    p_request_id: requestId,
    p_action:     action,
    p_note:       note ?? null,
  });
  if (error) throw error;
}

// ── 전체 수정 로그 (시샵용) ─────────────────────────────────────────
export async function fetchAllPostEditLogs(): Promise<PostEditLog[]> {
  const { data, error } = await supabase
    .from('store_post_edit_logs')
    .select('*, store:store_id(name)')
    .order('edited_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as PostEditLog[];
}

// ── 좋아요 토글 ──────────────────────────────────────────────────────
export async function toggleLike(
  targetType: 'post' | 'coupon',
  targetId: string,
): Promise<{ is_liked: boolean; like_count: number }> {
  const { data, error } = await supabase.rpc('toggle_feed_like', {
    p_target_type: targetType,
    p_target_id:   targetId,
  });
  if (error) throw error;
  return data[0] as { is_liked: boolean; like_count: number };
}

// ── 좋아요 상태 일괄 조회 ────────────────────────────────────────────
export async function getLikedSet(
  userId: string,
  targetType: 'post' | 'coupon',
  targetIds: string[],
): Promise<Set<string>> {
  if (targetIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('feed_likes')
    .select('target_id')
    .eq('user_id', userId)
    .eq('target_type', targetType)
    .in('target_id', targetIds);
  if (error) throw error;
  return new Set((data ?? []).map((r: any) => r.target_id as string));
}

// ── 쿠폰 좋아요 수 일괄 조회 ─────────────────────────────────────────
export async function getCouponLikeCounts(
  couponIds: string[],
): Promise<Record<string, number>> {
  if (couponIds.length === 0) return {};
  const { data, error } = await supabase
    .from('feed_likes')
    .select('target_id')
    .eq('target_type', 'coupon')
    .in('target_id', couponIds);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const r of data ?? []) {
    counts[r.target_id] = (counts[r.target_id] ?? 0) + 1;
  }
  return counts;
}

// ── PICK 토글 ────────────────────────────────────────────────────────
export async function togglePick(
  targetType: 'post' | 'coupon',
  targetId: string,
): Promise<{ is_picked: boolean; pick_count: number }> {
  const { data, error } = await supabase.rpc('toggle_feed_pick', {
    p_target_type: targetType,
    p_target_id:   targetId,
  });
  if (error) throw error;
  return data[0] as { is_picked: boolean; pick_count: number };
}

// ── PICK 상태 일괄 조회 ───────────────────────────────────────────────
export async function getPickedSet(
  userId: string,
  targetType: 'post' | 'coupon',
  targetIds: string[],
): Promise<Set<string>> {
  if (targetIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('feed_picks')
    .select('target_id')
    .eq('user_id', userId)
    .eq('target_type', targetType)
    .in('target_id', targetIds);
  if (error) throw error;
  return new Set((data ?? []).map((r: any) => r.target_id as string));
}

// ── 쿠폰 PICK 수 일괄 조회 ───────────────────────────────────────────
export async function getCouponPickCounts(
  couponIds: string[],
): Promise<Record<string, number>> {
  if (couponIds.length === 0) return {};
  const { data, error } = await supabase
    .from('feed_picks')
    .select('target_id')
    .eq('target_type', 'coupon')
    .in('target_id', couponIds);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const r of data ?? []) {
    counts[r.target_id] = (counts[r.target_id] ?? 0) + 1;
  }
  return counts;
}
