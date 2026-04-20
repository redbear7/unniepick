/**
 * useUrgentCoupons — feedService Z1존 래핑
 * D-3 이하 + 잔여 > 0 긴급 쿠폰 조회
 */
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { UrgentCoupon } from '../screens/Home/UrgentCouponCard';

interface Options {
  lat?:    number;
  lng?:    number;
  radius?: number; // 미터, 기본 500
}

export function useUrgentCoupons({ lat, lng, radius = 500 }: Options = {}) {
  const [coupons,  setCoupons]  = useState<UrgentCoupon[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const now    = new Date().toISOString();
        const d3     = new Date(Date.now() + 3 * 24 * 3_600_000).toISOString();

        const { data, error: err } = await supabase
          .from('coupons')
          .select(`
            id, title, expires_at, total_quantity, issued_count,
            stores!inner ( id, name, emoji, latitude, longitude, category )
          `)
          .eq('is_active', true)
          .gt('expires_at', now)
          .lte('expires_at', d3)
          .order('expires_at', { ascending: true })
          .limit(8);

        if (err) throw err;
        if (cancelled) return;

        const mapped: UrgentCoupon[] = (data ?? [])
          .filter((c: any) => {
            const remain = c.total_quantity != null
              ? c.total_quantity - (c.issued_count ?? 0)
              : null;
            return remain == null || remain > 0;
          })
          .map((c: any) => {
            const store    = c.stores;
            const expiresMs = new Date(c.expires_at).getTime();
            const daysLeft  = Math.max(0, Math.ceil((expiresMs - Date.now()) / 86_400_000) - 1);
            const remain    = c.total_quantity != null
              ? c.total_quantity - (c.issued_count ?? 0)
              : null;

            // 거리 계산 (GPS 있을 때)
            let distance: number | undefined;
            if (lat != null && lng != null && store.latitude && store.longitude) {
              const R  = 6371000;
              const dLat = ((store.latitude  - lat) * Math.PI) / 180;
              const dLng = ((store.longitude - lng) * Math.PI) / 180;
              const a  = Math.sin(dLat / 2) ** 2
                + Math.cos((lat * Math.PI) / 180)
                * Math.cos((store.latitude * Math.PI) / 180)
                * Math.sin(dLng / 2) ** 2;
              distance = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
            }

            return {
              id:       c.id,
              store:    store.name,
              emoji:    store.emoji ?? undefined,
              title:    c.title,
              daysLeft,
              remain,
              distance,
            } satisfies UrgentCoupon;
          })
          // 반경 필터 (GPS 있을 때)
          .filter(c => radius == null || c.distance == null || c.distance <= radius);

        setCoupons(mapped);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [lat, lng, radius]);

  return { coupons, loading, error };
}
