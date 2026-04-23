/**
 * HomeV1Standard — 언니픽 홈 V1 표준형
 *
 * 섹션 구조 (위→아래):
 *   0. HomeLocationBar  — 상단 고정 위치바
 *   1. UrgentCouponCard — ⚡ 긴급 쿠폰 가로 스크롤
 *   2. NearbyStoreCard  — 📍 내 주변 가게 가로 스크롤
 *   3. FeedPost (인라인) — 👥 팔로우한 가게 소식 수직 피드
 *
 * HomeScreens.jsx:268 포팅 · Phase 1 · 월드컵 배너 미이식
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';

import { supabase } from '../../lib/supabase';
import {
  getHomeFeed,
  FeedCoupon,
  getFollowedStoresMeta,
  FollowedStoreMeta,
} from '../../lib/services/feedService';
import { useUrgentCoupons } from '../../hooks/useUrgentCoupons';
import { useNearbyStores }  from '../../hooks/useNearbyStores';

import HomeLocationBar  from './HomeLocationBar';
import LocationPickerSheet, { SelectedLocation } from './LocationPickerSheet';
import SectionHead      from './SectionHead';
import UrgentCouponCard from './UrgentCouponCard';
import NearbyStoreCard  from './NearbyStoreCard';

// ── 인라인 FeedPost (기존 HomeScreen 렌더링 패턴 재사용) ──────────
import StoreAvatar from '../../components/StoreAvatar';
import { Ionicons } from '@expo/vector-icons';

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

interface FeedPostProps {
  coupon:        FeedCoupon;
  onSaveCoupon?: (id: string) => void;
  onFollow?:     (storeId: string) => void;
}

function FeedPost({ coupon, onSaveCoupon, onFollow }: FeedPostProps) {
  return (
    <View style={fp.card}>
      {/* 매장 헤더 */}
      <View style={fp.header}>
        <StoreAvatar name={coupon.store_name} size="md" />
        <View style={fp.headerText}>
          <Text style={fp.storeName}>{coupon.store_name}</Text>
          <Text style={fp.time}>{formatTimeAgo(coupon.created_at)}</Text>
        </View>
        <TouchableOpacity
          style={fp.followBtn}
          onPress={() => onFollow?.(coupon.store_id)}
          activeOpacity={0.7}
        >
          <Text style={fp.followText}>팔로우</Text>
        </TouchableOpacity>
      </View>

      {/* 쿠폰 카드 */}
      <View style={fp.couponBox}>
        <Text style={fp.couponTitle}>{coupon.title}</Text>
        {coupon.description ? (
          <Text style={fp.couponDesc} numberOfLines={2}>{coupon.description}</Text>
        ) : null}
        {coupon.urgency_label ? (
          <View style={fp.urgencyRow}>
            <Text style={fp.urgencyLabel}>{coupon.urgency_label}</Text>
          </View>
        ) : null}
      </View>

      {/* 액션 바 */}
      <View style={fp.actions}>
        <TouchableOpacity
          style={fp.saveBtn}
          onPress={() => onSaveCoupon?.(coupon.id)}
          activeOpacity={0.8}
        >
          <Ionicons name="ticket-outline" size={14} color="#FFFFFF" />
          <Text style={fp.saveBtnText}>쿠폰받기</Text>
        </TouchableOpacity>
        <View style={fp.stats}>
          {coupon.remaining != null && (
            <Text style={fp.stat}>잔여 {coupon.remaining}장</Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ── 카테고리 이모지 ───────────────────────────────────────────────
const CAT_EMOJI: Record<string, string> = {
  cafe: '☕', food: '🍽', beauty: '✂️', nail: '💅', etc: '🏪',
};

// ── 팔로우 가게 2열 그리드 ────────────────────────────────────────
interface FollowedStoreCard {
  id:           string;
  name:         string;
  emoji:        string;
  category:     string;
  coupon_count: number;
}

const CARD_GAP = 10;
const CARD_PAD = 20;
const CARD_W   = (SCREEN_W - CARD_PAD * 2 - CARD_GAP) / 2;

function FollowedStoreGrid({
  stores,
  onPress,
}: {
  stores:   FollowedStoreCard[];
  onPress:  (id: string) => void;
}) {
  // 2열 짝 맞추기 (홀수면 마지막 빈 카드 삽입)
  const rows: (FollowedStoreCard | null)[][] = [];
  for (let i = 0; i < stores.length; i += 2) {
    rows.push([stores[i], stores[i + 1] ?? null]);
  }

  return (
    <View style={fg.container}>
      {rows.map((row, ri) => (
        <View key={ri} style={fg.row}>
          {row.map((store, ci) =>
            store ? (
              <TouchableOpacity
                key={store.id}
                style={fg.card}
                onPress={() => onPress(store.id)}
                activeOpacity={0.85}
              >
                {/* 이모지 썸네일 */}
                <View style={fg.thumb}>
                  <Text style={fg.thumbEmoji}>{store.emoji}</Text>
                </View>

                {/* 가게 정보 */}
                <Text style={fg.name} numberOfLines={1}>{store.name}</Text>
                <Text style={fg.category}>{store.category}</Text>

                {/* 쿠폰 배지 */}
                {store.coupon_count > 0 ? (
                  <View style={fg.couponBadge}>
                    <Text style={fg.couponText}>🎟 쿠폰 {store.coupon_count}장</Text>
                  </View>
                ) : (
                  <View style={fg.noCouponBadge}>
                    <Text style={fg.noCouponText}>쿠폰없음</Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : (
              // 홀수일 때 빈 자리
              <View key={`empty-${ci}`} style={fg.cardEmpty} />
            )
          )}
        </View>
      ))}
    </View>
  );
}

const fg = StyleSheet.create({
  container: {
    paddingHorizontal: CARD_PAD,
    paddingTop:        12,
    paddingBottom:     24,
    gap:               CARD_GAP,
    backgroundColor:   '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    gap:           CARD_GAP,
  },
  card: {
    width:           CARD_W,
    backgroundColor: '#FFFFFF',
    borderRadius:    16,
    padding:         14,
    borderWidth:     1,
    borderColor:     '#EAECEF',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.06,
    shadowRadius:    6,
    elevation:       2,
    gap:             4,
  },
  cardEmpty: {
    width: CARD_W,
  },
  thumb: {
    width:           56,
    height:          56,
    borderRadius:    14,
    backgroundColor: '#F9FAFB',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    6,
  },
  thumbEmoji: { fontSize: 28 },
  name: {
    fontSize:      14,
    fontWeight:    '800',
    color:         '#191F28',
    letterSpacing: -0.3,
  },
  category: {
    fontSize:   12,
    fontWeight: '500',
    color:      '#8B95A1',
  },
  couponBadge: {
    marginTop:       4,
    backgroundColor: '#FFF3EB',
    borderRadius:    8,
    paddingHorizontal: 8,
    paddingVertical:   4,
    alignSelf:       'flex-start',
  },
  couponText: {
    fontSize:   11,
    fontWeight: '800',
    color:      '#FF6F0F',
  },
  noCouponBadge: {
    marginTop:       4,
    backgroundColor: '#F2F4F6',
    borderRadius:    8,
    paddingHorizontal: 8,
    paddingVertical:   4,
    alignSelf:       'flex-start',
  },
  noCouponText: {
    fontSize:   11,
    fontWeight: '700',
    color:      '#ADB5BD',
  },
});

// ── 빈 상태 컴포넌트 ──────────────────────────────────────────────
function EmptyFeed({ onDiscover }: { onDiscover?: () => void }) {
  return (
    <View style={styles.emptyFeed}>
      <Text style={styles.emptyEmoji}>👋</Text>
      <Text style={styles.emptyTitle}>팔로우한 가게가 없어요</Text>
      <Text style={styles.emptySub}>내 주변 가게를 팔로우하면{'\n'}새 쿠폰 소식이 여기 보여요</Text>
      {onDiscover && (
        <TouchableOpacity style={styles.discoverBtn} onPress={onDiscover} activeOpacity={0.8}>
          <Text style={styles.discoverText}>추천 가게 보기</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── 가성비 픽 카드 ────────────────────────────────────────────────
interface ValueStore {
  id: string;
  name: string;
  emoji: string;
  category: string;
  representative_price: number;
  price_label: string | null;
  coupon_count: number;
}

function ValuePickCard({
  store,
  onPress,
}: {
  store: ValueStore;
  onPress: (id: string) => void;
}) {
  return (
    <TouchableOpacity style={vp.card} onPress={() => onPress(store.id)} activeOpacity={0.85}>
      <View style={vp.priceTag}>
        <Text style={vp.priceText}>
          {store.price_label ?? `${store.representative_price.toLocaleString()}원~`}
        </Text>
      </View>
      <Text style={vp.emoji}>{store.emoji}</Text>
      <Text style={vp.name} numberOfLines={1}>{store.name}</Text>
      <Text style={vp.category}>{store.category}</Text>
      {store.coupon_count > 0 && (
        <View style={vp.couponBadge}>
          <Text style={vp.couponText}>🎟 쿠폰 {store.coupon_count}개</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const vp = StyleSheet.create({
  card: {
    width: 130,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: '#EAECEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  priceTag: {
    backgroundColor: '#FFF3EB',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  priceText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF6F0F',
    letterSpacing: -0.2,
  },
  emoji: { fontSize: 30, marginBottom: 2 },
  name: {
    fontSize: 13,
    fontWeight: '800',
    color: '#191F28',
    letterSpacing: -0.3,
  },
  category: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8B95A1',
  },
  couponBadge: {
    marginTop: 4,
    backgroundColor: '#FFF3EB',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  couponText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FF6F0F',
  },
});

// ── HomeV1Standard ────────────────────────────────────────────────
export default function HomeV1Standard() {
  const navigation = useNavigation<any>();

  // GPS 위치
  const [loc, setLoc]       = useState<{ lat: number; lng: number } | null>(null);
  const [dong, setDong]     = useState('내 주변');
  const [locDenied, setLocDenied] = useState(false);

  // 선택된 위치 (null = GPS 현재위치)
  const [selectedLoc,      setSelectedLoc]      = useState<SelectedLocation | null>(null);
  const [locPickerVisible, setLocPickerVisible]  = useState(false);

  // 훅에 전달할 좌표 (저장위치 선택 시 해당 좌표, 아니면 GPS)
  const activeCoords = selectedLoc
    ? { lat: selectedLoc.lat, lng: selectedLoc.lng }
    : loc;
  // 위치바에 표시할 이름
  const displayDong = selectedLoc?.label ?? dong;

  // 팔로우 피드
  const [feedCoupons,      setFeedCoupons]      = useState<FeedCoupon[]>([]);
  const [noCouponStores,   setNoCouponStores]   = useState<FollowedStoreMeta[]>([]);
  const [feedLoading,      setFeedLoading]      = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);

  // 팔로우 가게 2열 그리드 (쿠폰 있는 가게 우선)
  const followedStoreCards = useMemo<FollowedStoreCard[]>(() => {
    const map = new Map<string, FollowedStoreCard>();

    // 쿠폰 있는 가게: 같은 store_id 등장 횟수 = 쿠폰 수
    feedCoupons.forEach(c => {
      const existing = map.get(c.store_id);
      map.set(c.store_id, {
        id:           c.store_id,
        name:         c.store_name,
        emoji:        CAT_EMOJI[(c.store_category ?? 'etc').toLowerCase()] ?? '🏪',
        category:     c.store_category ?? '',
        coupon_count: (existing?.coupon_count ?? 0) + 1,
      });
    });

    // 쿠폰 없는 팔로우 가게
    noCouponStores.forEach(s => {
      if (!map.has(s.id)) {
        map.set(s.id, {
          id:           s.id,
          name:         s.name,
          emoji:        s.emoji ?? CAT_EMOJI[(s.category ?? 'etc').toLowerCase()] ?? '🏪',
          category:     s.category ?? '',
          coupon_count: 0,
        });
      }
    });

    // 쿠폰 있는 가게 먼저
    return Array.from(map.values()).sort((a, b) => b.coupon_count - a.coupon_count);
  }, [feedCoupons, noCouponStores]);

  // 가성비 픽
  const [valueStores, setValueStores] = useState<ValueStore[]>([]);

  // 긴급 쿠폰 + 내 주변 (선택된 위치 기준)
  const { coupons: urgentCoupons, loading: urgentLoading } = useUrgentCoupons({
    lat: activeCoords?.lat, lng: activeCoords?.lng,
  });
  const { stores: nearbyStores, isFallback, loading: nearbyLoading } = useNearbyStores({
    lat: activeCoords?.lat, lng: activeCoords?.lng,
  });

  // ── GPS 요청 ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocDenied(true);
        setDong('창원 전체');
        return;
      }
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        // 역지오코딩 → 동 이름
        const geo = await Location.reverseGeocodeAsync({
          latitude:  pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (geo[0]) setDong(geo[0].district ?? geo[0].subregion ?? '내 주변');
      } catch {
        setDong('내 주변');
      }
    })();
  }, []);

  // ── 가성비 픽 로드 ───────────────────────────────────────────
  const loadValueStores = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      const { data: rows } = await supabase
        .from('stores')
        .select('id, name, emoji, category, representative_price, price_label')
        .eq('is_active', true)
        .not('representative_price', 'is', null)
        .order('representative_price', { ascending: true })
        .limit(10);

      if (!rows?.length) return;

      // 쿠폰 수 조회
      const ids = rows.map(r => r.id);
      const { data: couponRows } = await supabase
        .from('coupons')
        .select('store_id')
        .in('store_id', ids)
        .eq('is_active', true)
        .gt('expires_at', now);

      const couponMap: Record<string, number> = {};
      (couponRows ?? []).forEach(c => {
        couponMap[c.store_id] = (couponMap[c.store_id] ?? 0) + 1;
      });

      setValueStores(rows.map(r => ({
        id:                   r.id,
        name:                 r.name,
        emoji:                r.emoji ?? '🏪',
        category:             r.category ?? '',
        representative_price: r.representative_price,
        price_label:          r.price_label ?? null,
        coupon_count:         couponMap[r.id] ?? 0,
      })));
    } catch { /* 가성비 픽 실패해도 앱 동작 유지 */ }
  }, []);

  // ── 팔로우 피드 로드 ─────────────────────────────────────────
  const loadFeed = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setFeedLoading(false); return; }

      const result   = await getHomeFeed({ userId: user.id, limit: 10 });
      const coupons  = [...result.z2, ...result.z3].slice(0, 10);
      setFeedCoupons(coupons);

      // 쿠폰이 없는 팔로우 가게 조회
      const couponStoreIds = [...new Set(coupons.map(c => c.store_id))];
      const empties = await getFollowedStoresMeta(user.id, couponStoreIds);
      setNoCouponStores(empties);
    } catch (e) {
      console.warn('[HomeV1] 피드 로드 실패:', e);
    } finally {
      setFeedLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadFeed(); loadValueStores(); }, [loadFeed, loadValueStores]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadFeed(), loadValueStores()]);
  }, [loadFeed, loadValueStores]);

  // ── 쿠폰 저장 ────────────────────────────────────────────────
  const handleSaveCoupon = useCallback(async (couponId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { Alert.alert('로그인이 필요해요'); return; }

    const { error } = await supabase.from('user_coupons').insert({
      user_id:   user.id,
      coupon_id: couponId,
      status:    'available',
    });
    if (error) {
      Alert.alert('이미 받은 쿠폰이에요');
    } else {
      Alert.alert('✅ 쿠폰을 저장했어요!');
    }
  }, []);

  // ── 팔로우 ───────────────────────────────────────────────────
  const handleFollow = useCallback(async (storeId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { Alert.alert('로그인이 필요해요'); return; }

    await supabase.from('follows').upsert(
      { user_id: user.id, store_id: storeId },
      { onConflict: 'user_id,store_id', ignoreDuplicates: true },
    );
    await loadFeed();
  }, [loadFeed]);

  // ── 섹션 제목 — 내 주변 fallback 처리 ──────────────────────
  const nearbyTitle = isFallback
    ? '📍 창원 전체 추천'
    : `📍 내 주변 가게`;
  const nearbySub = isFallback
    ? '반경 내 매장이 적어 창원 전체로 확장했어요'
    : `${displayDong} 반경 500m`;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* 위치바 — SafeArea 밖에서 고정 */}
      <HomeLocationBar
        loc={displayDong}
        showBrand
        onChange={() => setLocPickerVisible(true)}
        onSearch={() => navigation.navigate('CustomerTabs', { screen: 'NearbyFeed' })}
        onAlarm={() => navigation.navigate('Notification')}
        hasAlarm
        savedLocLabel={selectedLoc?.type === 'saved' ? selectedLoc.label : null}
        onResetToGPS={() => setSelectedLoc(null)}
      />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6F0F" />
        }
      >
        {/* ── 섹션 1: 긴급 쿠폰 ── */}
        {!urgentLoading && urgentCoupons.length > 0 && (
          <>
            <SectionHead
              title="⚡ 지금 받아야 할 쿠폰"
              sub="곧 마감 · 내 주변 500m"
              action="전체"
              onAction={() => navigation.navigate('CouponList', { filter: 'urgent' })}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hscroll}
              snapToInterval={230}
              decelerationRate="fast"
            >
              {urgentCoupons.map(c => (
                <UrgentCouponCard key={c.id} c={c} onSave={handleSaveCoupon} />
              ))}
            </ScrollView>
          </>
        )}

        {/* GPS 거부 안내 */}
        {locDenied && (
          <TouchableOpacity
            style={styles.locBanner}
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.8}
          >
            <Text style={styles.locBannerText}>📍 위치를 허용하면 내 주변 쿠폰을 볼 수 있어요</Text>
          </TouchableOpacity>
        )}

        {/* ── 섹션 2: 내 주변 가게 ── */}
        {!nearbyLoading && nearbyStores.length > 0 && (
          <>
            <SectionHead
              title={nearbyTitle}
              sub={nearbySub}
              action="지도"
              onAction={() => navigation.navigate('Map')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hscroll}
              snapToInterval={150}
              decelerationRate="fast"
            >
              {nearbyStores.map(s => (
                <NearbyStoreCard
                  key={s.id}
                  s={s}
                  onPress={id => navigation.navigate('StoreHome', { storeId: id })}
                />
              ))}
            </ScrollView>
          </>
        )}

        {/* ── 섹션 2.5: 가성비 픽 ── */}
        {valueStores.length > 0 && (
          <>
            <SectionHead
              title="💰 가성비 픽"
              sub="가격 착하고 쿠폰까지"
              action="더보기"
              onAction={() => navigation.navigate('NearbyFeed')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hscroll}
              snapToInterval={140}
              decelerationRate="fast"
            >
              {valueStores.map(s => (
                <ValuePickCard
                  key={s.id}
                  store={s}
                  onPress={id => navigation.navigate('StoreHome', { storeId: id })}
                />
              ))}
            </ScrollView>
          </>
        )}

        {/* ── 섹션 3: 팔로우한 가게 소식 ── */}
        <SectionHead title="👥 팔로우한 가게 소식" />

        {feedLoading ? (
          <ActivityIndicator style={styles.feedLoader} color="#FF6F0F" />
        ) : followedStoreCards.length === 0 ? (
          <EmptyFeed onDiscover={() => navigation.navigate('NearbyFeed')} />
        ) : (
          <FollowedStoreGrid
            stores={followedStoreCards}
            onPress={id => navigation.navigate('StoreHome', { storeId: id })}
          />
        )}

        {/* 피드 끝 여백 */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 위치 선택 바텀시트 */}
      <LocationPickerSheet
        visible={locPickerVisible}
        onClose={() => setLocPickerVisible(false)}
        currentGPS={loc}
        selectedLocId={selectedLoc?.type === 'saved' ? selectedLoc.savedId : null}
        onSelect={(picked) => {
          setSelectedLoc(picked);
          setLocPickerVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  hscroll: {
    paddingHorizontal: 20,
    paddingVertical:   4,
    gap:               10,
    paddingBottom:     12,
  },
  locBanner: {
    marginHorizontal: 20,
    marginTop:        8,
    backgroundColor:  '#FFF3EB',
    borderRadius:     10,
    paddingVertical:  10,
    paddingHorizontal: 14,
    borderWidth:      1,
    borderColor:      '#FFD4A8',
  },
  locBannerText: {
    fontSize:   13,
    fontWeight: '600',
    color:      '#FF6F0F',
  },
  feedLoader: { marginTop: 32 },
  emptyFeed: {
    alignItems:   'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyEmoji:  { fontSize: 40, marginBottom: 12 },
  emptyTitle: {
    fontSize:    17,
    fontWeight:  '800',
    color:       '#191F28',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  emptySub: {
    fontSize:   13,
    fontWeight: '500',
    color:      '#6B7684',
    textAlign:  'center',
    lineHeight: 20,
  },
  discoverBtn: {
    marginTop:       20,
    backgroundColor: '#FF6F0F',
    borderRadius:    12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  discoverText: {
    color:      '#FFFFFF',
    fontSize:   14,
    fontWeight: '800',
  },
});

// ── FeedPost 스타일 ───────────────────────────────────────────────
const fp = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 0,
    marginBottom:    1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F6',
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            10,
    marginBottom:   12,
  },
  headerText: { flex: 1 },
  storeName: {
    fontSize:    14,
    fontWeight:  '800',
    color:       '#191F28',
    letterSpacing: -0.3,
  },
  time: {
    fontSize:   11,
    fontWeight: '500',
    color:      '#8B95A1',
    marginTop:  2,
  },
  followBtn: {
    borderWidth:     1,
    borderColor:     '#EAECEF',
    borderRadius:    8,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  followText: {
    fontSize:   12,
    fontWeight: '700',
    color:      '#4E5968',
  },
  couponBox: {
    backgroundColor: '#FFF3EB',
    borderRadius:    12,
    padding:         14,
    marginBottom:    12,
    borderWidth:     1,
    borderColor:     '#FFD4A8',
  },
  couponTitle: {
    fontSize:    16,
    fontWeight:  '800',
    color:       '#191F28',
    letterSpacing: -0.4,
  },
  couponDesc: {
    fontSize:   13,
    fontWeight: '500',
    color:      '#4E5968',
    marginTop:  6,
    lineHeight: 19,
  },
  urgencyRow: { marginTop: 8 },
  urgencyLabel: {
    fontSize:   11,
    fontWeight: '700',
    color:      '#E53935',
  },
  actions: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  saveBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    backgroundColor:   '#FF6F0F',
    borderRadius:      8,
    paddingVertical:   8,
    paddingHorizontal: 14,
  },
  saveBtnText: {
    color:      '#FFFFFF',
    fontSize:   13,
    fontWeight: '800',
  },
  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    fontSize:   12,
    fontWeight: '600',
    color:      '#8B95A1',
  },
});
