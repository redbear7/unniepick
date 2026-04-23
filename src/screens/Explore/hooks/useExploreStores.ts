/**
 * useExploreStores — 가게 탐색 탭 데이터 훅
 *
 * - stores 전체 조회 (is_active=true, is_closed=false)
 * - coupons 활성 개수 per store
 * - follows 팔로워 수 + 내가 팔로우 중인지 여부
 * - GPS 좌표로 haversine 거리 계산 (클라이언트)
 * - Phase 2: PostGIS RPC로 교체 예정
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

// ── 유틸 ────────────────────────────────────────────────────────────
function haversine(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R    = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180)
    * Math.cos((lat2 * Math.PI) / 180)
    * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// 카테고리 → 이모지
const CAT_EMOJI_MAP: [string, string][] = [
  ['카페', '☕'], ['커피', '☕'],
  ['한식', '🍜'], ['분식', '🍢'], ['치킨', '🍗'],
  ['고기', '🍖'], ['중식', '🥡'], ['일식', '🍱'],
  ['양식', '🍝'], ['패스트푸드', '🍔'], ['음식', '🍜'],
  ['미용', '✂️'], ['헤어', '✂️'],
  ['네일', '💅'],
  ['편의점', '🏪'],
  ['베이커리', '🥐'], ['빵', '🥐'],
];

function resolveEmoji(category: string): string {
  for (const [key, emoji] of CAT_EMOJI_MAP) {
    if (category.includes(key)) return emoji;
  }
  return '📦';
}

// ── 타입 ─────────────────────────────────────────────────────────────
export interface ExploreStore {
  id:                   string;
  name:                 string;
  category:             string;
  address:              string | null;
  latitude:             number | null;
  longitude:            number | null;
  naver_thumbnail:      string | null;
  review_count:         number;
  representative_price: number | null;   // 대표 메뉴 가격 (원)
  price_label:          string | null;   // "런치 7,000원~"
  price_range:          string | null;   // '~6000'|'~8000'|'~12000'|'~20000'|'20000+'
  // computed
  distance:             number;          // m, 0 if no GPS
  followers:            number;
  activeCoupons:        number;
  following:            boolean;
  hot:                  boolean;         // activeCoupons >= 2
  isOpen:               boolean;
  emoji:                string;
}

interface Options {
  lat?:    number;
  lng?:    number;
  userId?: string | null;
}

// ── 훅 ───────────────────────────────────────────────────────────────
export function useExploreStores({ lat, lng, userId }: Options = {}) {
  const [stores,  setStores]  = useState<ExploreStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [tick,    setTick]    = useState(0);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  // 팔로우 토글 (낙관적 업데이트 + Supabase 동기화)
  const toggleFollow = useCallback(async (storeId: string) => {
    if (!userId) return;

    setStores(prev => prev.map(s =>
      s.id === storeId
        ? {
            ...s,
            following:  !s.following,
            followers:  s.following ? s.followers - 1 : s.followers + 1,
          }
        : s,
    ));

    const { data: existing } = await supabase
      .from('follows')
      .select('id')
      .eq('user_id', userId)
      .eq('store_id', storeId)
      .maybeSingle();

    if (existing) {
      await supabase.from('follows').delete()
        .eq('user_id', userId).eq('store_id', storeId);
    } else {
      await supabase.from('follows').upsert(
        { user_id: userId, store_id: storeId },
        { onConflict: 'user_id,store_id', ignoreDuplicates: true },
      );
    }
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const now = new Date().toISOString();

        // 1. 가게 목록 (가격 필드 포함)
        const { data: storeData, error: storeErr } = await supabase
          .from('stores')
          .select(
            'id, name, category, address, latitude, longitude, naver_thumbnail, review_count, is_active, is_closed, representative_price, price_label, price_range',
          )
          .eq('is_active', true);

        if (storeErr) throw storeErr;
        if (cancelled) return;

        const storeRows = storeData ?? [];

        // 2. 활성 쿠폰 수 per store
        const { data: couponData } = await supabase
          .from('coupons')
          .select('store_id')
          .eq('is_active', true)
          .gt('expires_at', now);

        const couponMap: Record<string, number> = {};
        for (const c of couponData ?? []) {
          couponMap[c.store_id] = (couponMap[c.store_id] ?? 0) + 1;
        }

        // 3. 팔로워 수 per store
        const { data: followData } = await supabase
          .from('follows')
          .select('store_id');

        const followerMap: Record<string, number> = {};
        for (const f of followData ?? []) {
          followerMap[f.store_id] = (followerMap[f.store_id] ?? 0) + 1;
        }

        // 4. 내가 팔로우 중인 가게
        const followingSet = new Set<string>();
        if (userId) {
          const { data: myFollows } = await supabase
            .from('follows')
            .select('store_id')
            .eq('user_id', userId);
          for (const f of myFollows ?? []) followingSet.add(f.store_id);
        }

        if (cancelled) return;

        const result: ExploreStore[] = storeRows.map(s => {
          const distance = (lat != null && lng != null && s.latitude != null && s.longitude != null)
            ? haversine(lat, lng, s.latitude, s.longitude)
            : 0;
          const activeCoupons = couponMap[s.id]   ?? 0;
          const followers     = followerMap[s.id]  ?? 0;

          return {
            id:                   s.id,
            name:                 s.name,
            category:             s.category ?? '기타',
            address:              s.address  ?? null,
            latitude:             s.latitude ?? null,
            longitude:            s.longitude ?? null,
            naver_thumbnail:      s.naver_thumbnail ?? null,
            review_count:         s.review_count ?? 0,
            representative_price: s.representative_price ?? null,
            price_label:          s.price_label ?? null,
            price_range:          s.price_range ?? null,
            distance,
            followers,
            activeCoupons,
            following:  followingSet.has(s.id),
            hot:        activeCoupons >= 2,
            isOpen:     !(s.is_closed ?? false),
            emoji:      resolveEmoji(s.category ?? ''),
          };
        });

        if (!cancelled) setStores(result);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [lat, lng, userId, tick]);

  return { stores, loading, error, refresh, toggleFollow };
}
