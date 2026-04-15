import { supabase } from '../supabase';
import { StoreRow } from './storeService';
import { CouponRow } from './couponService';

export interface FavoriteStoreItem {
  store: StoreRow;
  coupons: CouponRow[];
  favorited_at: string;
  viewed_at?: string;
}

// ── 찜 여부 확인 ───────────────────────────────────────────────────
export async function isFavorite(userId: string, storeId: string): Promise<boolean> {
  const { data } = await supabase
    .from('store_favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .maybeSingle();
  return !!data;
}

// ── 찜 토글 (true = 찜됨, false = 취소됨) ──────────────────────────
export async function toggleFavorite(userId: string, storeId: string): Promise<boolean> {
  const fav = await isFavorite(userId, storeId);
  if (fav) {
    await supabase
      .from('store_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('store_id', storeId);
    return false;
  } else {
    await supabase
      .from('store_favorites')
      .insert({ user_id: userId, store_id: storeId });
    return true;
  }
}

// ── 최근 본 가게 기록 (upsert) ─────────────────────────────────────
export async function recordStoreView(userId: string, storeId: string): Promise<void> {
  await supabase
    .from('store_views')
    .upsert(
      { user_id: userId, store_id: storeId, viewed_at: new Date().toISOString() },
      { onConflict: 'user_id,store_id' }
    );
}

// ── 찜한 가게 목록 + 활성 쿠폰 ─────────────────────────────────────
export async function getFavoriteStoresWithCoupons(
  userId: string,
  sortBy: 'favorite' | 'recent' = 'favorite'
): Promise<FavoriteStoreItem[]> {
  // 1. 찜 목록 (가게 정보 조인)
  const { data: favs, error } = await supabase
    .from('store_favorites')
    .select('store_id, created_at, store:stores(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !favs || favs.length === 0) return [];

  const storeIds = favs.map(f => f.store_id);

  // 2. 최근 본 시각 (recent 정렬 시에만)
  const viewMap = new Map<string, string>();
  if (sortBy === 'recent') {
    const { data: views } = await supabase
      .from('store_views')
      .select('store_id, viewed_at')
      .eq('user_id', userId)
      .in('store_id', storeIds);
    (views ?? []).forEach(v => viewMap.set(v.store_id, v.viewed_at));
  }

  // 3. 활성 쿠폰 (찜한 가게 전체)
  const { data: coupons } = await supabase
    .from('coupons')
    .select('*')
    .in('store_id', storeIds)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  const couponsByStore = new Map<string, CouponRow[]>();
  (coupons ?? []).forEach(c => {
    const list = couponsByStore.get(c.store_id) ?? [];
    list.push(c as CouponRow);
    couponsByStore.set(c.store_id, list);
  });

  // 4. 조합
  let items: FavoriteStoreItem[] = favs.map(f => ({
    store: f.store as unknown as StoreRow,
    coupons: couponsByStore.get(f.store_id) ?? [],
    favorited_at: f.created_at,
    viewed_at: viewMap.get(f.store_id),
  }));

  // 5. 정렬
  if (sortBy === 'recent') {
    items.sort((a, b) => {
      const ta = a.viewed_at ?? a.favorited_at;
      const tb = b.viewed_at ?? b.favorited_at;
      return tb.localeCompare(ta);
    });
  }

  return items;
}
