// useExpiringCoupons — 당일 만료 쿠폰 (핸드오프 Section 03 Query C)
// expires_at <= 오늘 23:59:59 + status='active'
// 0개이면 ExpiringCouponsCard 를 렌더하지 않음

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export interface ExpiringCoupon {
  id:         string;
  storeName:  string;
  expiresAt:  string;
}

export function useExpiringCoupons() {
  const [coupons, setCoupons] = useState<ExpiringCoupon[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) { setCoupons([]); return; }

      // 오늘 자정 (23:59:59)
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data } = await supabase
        .from('user_coupons')
        .select(`
          id,
          expires_at,
          coupons!inner ( store_id, stores!inner ( name ) )
        `)
        .eq('user_id', uid)
        .eq('status', 'active')
        .lte('expires_at', todayEnd.toISOString())
        .order('expires_at', { ascending: true })
        .limit(5);

      const mapped: ExpiringCoupon[] = (data ?? []).map((r: any) => ({
        id:        r.id,
        storeName: r.coupons?.stores?.name ?? '알 수 없는 가게',
        expiresAt: r.expires_at,
      }));

      setCoupons(mapped);
    } catch {
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { coupons, loading, refetch: load };
}
