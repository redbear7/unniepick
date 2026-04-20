/**
 * useNearbyStores — GPS 기준 반경 내 가게 + 활성 쿠폰 수 조회
 * 반경 미달 시 창원 전체 fallback (엣지케이스 처리)
 */
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { NearbyStore } from '../screens/Home/NearbyStoreCard';

interface Options {
  lat?:    number;
  lng?:    number;
  radius?: number; // 미터, 기본 500
  limit?:  number; // 기본 6
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180)
    * Math.cos((lat2 * Math.PI) / 180)
    * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function useNearbyStores({ lat, lng, radius = 500, limit = 6 }: Options = {}) {
  const [stores,  setStores]  = useState<NearbyStore[]>([]);
  const [isFallback, setIsFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        // 가게 목록 조회 (활성 여부)
        const { data: storeData, error: err } = await supabase
          .from('stores')
          .select('id, name, category, emoji, latitude, longitude')
          .eq('is_active', true);

        if (err) throw err;
        if (cancelled) return;

        const now = new Date().toISOString();

        // 활성 쿠폰 수 일괄 조회
        const { data: couponCounts } = await supabase
          .from('coupons')
          .select('store_id')
          .eq('is_active', true)
          .gt('expires_at', now);

        const couponMap: Record<string, number> = {};
        for (const c of couponCounts ?? []) {
          couponMap[c.store_id] = (couponMap[c.store_id] ?? 0) + 1;
        }

        // 거리 계산 + 정렬
        let candidates = (storeData ?? []).map(s => {
          const distance = (lat != null && lng != null && s.latitude && s.longitude)
            ? haversine(lat, lng, s.latitude, s.longitude)
            : undefined;
          const activeCoupons = couponMap[s.id] ?? 0;
          const hot = activeCoupons >= 3;

          return {
            id:            s.id,
            name:          s.name,
            category:      s.category ?? '기타',
            emoji:         s.emoji ?? undefined,
            distance:      distance ?? 0,
            activeCoupons,
            hot,
          } satisfies NearbyStore;
        });

        // 반경 필터
        if (lat != null && lng != null) {
          const inRadius = candidates.filter(s => s.distance <= radius);
          // 엣지케이스: 반경 내 3곳 미만 → 창원 전체 fallback
          if (inRadius.length < 3) {
            setIsFallback(true);
            candidates = candidates
              .sort((a, b) => b.activeCoupons - a.activeCoupons || a.distance - b.distance)
              .slice(0, Math.max(limit, 6));
          } else {
            setIsFallback(false);
            candidates = inRadius
              .sort((a, b) => b.activeCoupons - a.activeCoupons || a.distance - b.distance)
              .slice(0, limit);
          }
        } else {
          // GPS 없음 → 쿠폰 많은 순
          setIsFallback(true);
          candidates = candidates
            .sort((a, b) => b.activeCoupons - a.activeCoupons)
            .slice(0, limit);
        }

        if (!cancelled) setStores(candidates);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [lat, lng, radius, limit]);

  return { stores, isFallback, loading, error };
}
