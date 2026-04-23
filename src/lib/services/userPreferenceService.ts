/**
 * userPreferenceService — 사용자 취향 분석 및 반영
 *
 * 행동 시그널 가중치:
 *   쿠폰 사용:    +10 (가장 강한 신호)
 *   쿠폰 저장:    +5
 *   가게 팔로우:  +5
 *   가게 조회:    +2
 *   카드 3초 읽기: +1
 *   카테고리 탭:  +1
 *   빠른 스크롤:  -1
 *   언팔로우:     -3
 */

import { supabase } from '../supabase';

// ── 이벤트 타입 ───────────────────────────────────────────────────
export type PreferenceEventType =
  | 'coupon_used'        // +10
  | 'coupon_saved'       // +5
  | 'store_followed'     // +5
  | 'store_viewed'       // +2
  | 'coupon_read'        // +1 (카드 3초 이상)
  | 'category_tapped'    // +1
  | 'coupon_scrolled'    // -1 (빠른 스크롤)
  | 'store_unfollowed';  // -3

const EVENT_SCORES: Record<PreferenceEventType, number> = {
  coupon_used:      10,
  coupon_saved:     5,
  store_followed:   5,
  store_viewed:     2,
  coupon_read:      1,
  category_tapped:  1,
  coupon_scrolled:  -1,
  store_unfollowed: -3,
};

// ── 카테고리 취향 프로필 ──────────────────────────────────────────
export interface CategoryPreference {
  category:    string;
  score:       number;
  interaction: number;   // 총 상호작용 횟수
}

export interface UserPreferenceProfile {
  userId:       string;
  categories:   CategoryPreference[];
  topCategory?: string;
  updatedAt:    string;
}

// ── 행동 이벤트 기록 ──────────────────────────────────────────────
export async function trackEvent(params: {
  userId:    string;
  eventType: PreferenceEventType;
  storeId?:  string;
  couponId?: string;
  category?: string;
}): Promise<void> {
  const { userId, eventType, storeId, couponId, category } = params;
  const delta = EVENT_SCORES[eventType];

  try {
    // 1. 이벤트 로그 저장
    await supabase.from('user_events').insert({
      user_id:     userId,
      event_type:  eventType,
      store_id:    storeId ?? null,
      coupon_id:   couponId ?? null,
      category:    category ?? null,
      score_delta: delta,
    });

    // 2. 카테고리 점수 업데이트 (카테고리가 있을 때만)
    if (category) {
      await upsertCategoryScore(userId, category, delta);
    }
  } catch (e) {
    // 취향 추적 실패는 무시 (UX 영향 없어야 함)
    console.warn('trackEvent failed (non-critical):', e);
  }
}

// ── 카테고리 점수 증감 ────────────────────────────────────────────
async function upsertCategoryScore(
  userId: string,
  category: string,
  delta: number
): Promise<void> {
  // Supabase에 user_preferences 테이블 있으면 사용, 없으면 무시
  const { data: existing } = await supabase
    .from('user_preferences')
    .select('id, score, interaction')
    .eq('user_id', userId)
    .eq('category', category)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('user_preferences')
      .update({
        score:       Math.max(0, existing.score + delta),
        interaction: (existing.interaction ?? 0) + 1,
        updated_at:  new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('user_preferences')
      .insert({
        user_id:     userId,
        category,
        score:       Math.max(0, delta),
        interaction: 1,
      });
  }
}

// ── 취향 프로필 조회 ──────────────────────────────────────────────
export async function getUserPreferences(userId: string): Promise<UserPreferenceProfile> {
  try {
    const { data } = await supabase
      .from('user_preferences')
      .select('category, score, interaction, updated_at')
      .eq('user_id', userId)
      .order('score', { ascending: false });

    const categories: CategoryPreference[] = (data ?? []).map(row => ({
      category:    row.category,
      score:       row.score,
      interaction: row.interaction ?? 0,
    }));

    const topCategory = categories.length > 0 ? categories[0].category : undefined;

    return {
      userId,
      categories,
      topCategory,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return { userId, categories: [], updatedAt: new Date().toISOString() };
  }
}

// ── 선호 카테고리 점수 맵 (피드 스코어링용) ──────────────────────
export async function getCategoryScoreMap(
  userId: string
): Promise<Record<string, number>> {
  try {
    const { data } = await supabase
      .from('user_preferences')
      .select('category, score')
      .eq('user_id', userId);

    const map: Record<string, number> = {};
    const maxScore = Math.max(...(data ?? []).map(r => r.score), 1);
    for (const row of data ?? []) {
      map[row.category] = row.score / maxScore;  // 0~1 정규화
    }
    return map;
  } catch {
    return {};
  }
}

// ── 쿠폰 카드 노출 시간 추적 (3초 이상 → 읽기 카운트) ───────────
const readTimers = new Map<string, NodeJS.Timeout>();

export function startReadTimer(params: {
  userId:   string;
  couponId: string;
  storeId:  string;
  category: string;
}): void {
  const key = `${params.userId}-${params.couponId}`;
  if (readTimers.has(key)) return;

  const timer = setTimeout(() => {
    trackEvent({
      userId:    params.userId,
      eventType: 'coupon_read',
      storeId:   params.storeId,
      couponId:  params.couponId,
      category:  params.category,
    });
    readTimers.delete(key);
  }, 3000);

  readTimers.set(key, timer);
}

export function cancelReadTimer(userId: string, couponId: string): void {
  const key = `${userId}-${couponId}`;
  const timer = readTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    readTimers.delete(key);
  }
}
