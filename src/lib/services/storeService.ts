import { supabase } from '../supabase';

export interface StoreRow {
  id: string;
  owner_id: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  rating: number;
  review_count: number;
  open_time: string;
  close_time: string;
  is_open: boolean;
  description: string;
  emoji: string;
  created_at: string;
  // 조인용 (쿠폰 존재 여부)
  has_active_coupon?: boolean;
}

// 전체 가맹점 조회
export async function fetchStores(): Promise<StoreRow[]> {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;

  // 쿠폰 보유 여부 체크
  const storesWithCoupon = await Promise.all(
    (data ?? []).map(async (store) => {
      const { count } = await supabase
        .from('coupons')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', store.id)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString());

      return { ...store, has_active_coupon: (count ?? 0) > 0 };
    })
  );

  return storesWithCoupon;
}

// 단일 가맹점 조회
export async function fetchStore(storeId: string): Promise<StoreRow | null> {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .single();

  if (error) return null;
  return data;
}
