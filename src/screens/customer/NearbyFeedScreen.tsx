/**
 * NearbyFeedScreen — 가게 탐색 (디자인 목업 A2)
 *
 * 위치 기반 주변 가게 목록 + 카테고리 필터 + 정렬
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';

import { supabase } from '../../lib/supabase';

// ── 테마 ──────────────────────────────────────────────────────────
const C = {
  brand:   '#FF6F0F',
  brand2:  '#FF9A3D',
  brandBg: '#FFF3EB',
  g900:    '#191F28',
  g800:    '#333D4B',
  g700:    '#4E5968',
  g600:    '#6B7684',
  g500:    '#8B95A1',
  g400:    '#ADB5BD',
  g300:    '#D1D6DB',
  g200:    '#E5E8EB',
  g150:    '#EAECEF',
  g100:    '#F2F4F6',
  g50:     '#F9FAFB',
  green:   '#0AC86E',
  red:     '#E53935',
  white:   '#FFFFFF',
};

// ── 카테고리 ──────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'all',    label: '전체', emoji: '' },
  { key: 'cafe',   label: '카페', emoji: '☕' },
  { key: 'food',   label: '음식', emoji: '🍽' },
  { key: 'beauty', label: '미용', emoji: '✂️' },
  { key: 'nail',   label: '네일', emoji: '💅' },
  { key: 'etc',    label: '기타', emoji: '' },
];

// ── 정렬 옵션 ─────────────────────────────────────────────────────
const SORT_OPTS = [
  { key: 'distance', label: '거리순' },
  { key: 'coupon',   label: '쿠폰 많은 순' },
  { key: 'popular',  label: '인기순' },
];

// ── 서버 응답 타입 ────────────────────────────────────────────────
interface NearbyStore {
  store_id:            string;
  store_name:          string;
  latitude:            number;
  longitude:           number;
  district_id:         string | null;
  district_name:       string | null;
  distance_km:         number;
  active_coupon_count: number;
  latest_coupon_kind:  string;
  unread_post_count:   number;
  category?:           string;
}

// ── 카테고리 이모지 매핑 ─────────────────────────────────────────
const CAT_EMOJI: Record<string, string> = {
  cafe:   '☕',
  food:   '🍽',
  beauty: '✂️',
  nail:   '💅',
  etc:    '🏪',
  all:    '🏪',
};

// ── 아바타 배경색 (가게명 기반) ──────────────────────────────────
const AVATAR_COLORS = [
  '#FF6F0F', '#5B67CA', '#2DB87A', '#D946B0',
  '#FF6B6B', '#4C9EFF', '#F59E0B', '#FF9A3D',
];
function avatarColor(name: string): string {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

// ── 거리 포맷 ────────────────────────────────────────────────────
function formatDist(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

// ── 팔로워 수 (store_id 해시 기반 더미) ──────────────────────────
function fakeFollowers(storeId: string): number {
  let h = 0;
  for (let i = 0; i < storeId.length; i++) h = (h * 31 + storeId.charCodeAt(i)) & 0xffffff;
  return 12 + (h % 488);
}

// ── 팔로우 버튼 ───────────────────────────────────────────────────
function FollowButton({
  followed,
  onPress,
}: {
  followed: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[fbs.btn, followed && fbs.btnOn]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[fbs.text, followed && fbs.textOn]}>
        {followed ? '팔로잉' : '+ 팔로우'}
      </Text>
    </TouchableOpacity>
  );
}
const fbs = StyleSheet.create({
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.brand,
    backgroundColor: C.white,
    flexShrink: 0,
  },
  btnOn: {
    backgroundColor: C.brand,
    borderColor: C.brand,
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    color: C.brand,
  },
  textOn: {
    color: C.white,
  },
});

// ── 썸네일 배경색 (카테고리별 소프트 파스텔) ─────────────────────
const THUMB_BG: Record<string, string> = {
  cafe:   '#FFF0E6',
  food:   '#FFF8E6',
  beauty: '#F0EEFF',
  nail:   '#FFE6F5',
  etc:    '#E6F5FF',
  all:    '#F2F4F6',
};

// ── 가게 목록 아이템 ──────────────────────────────────────────────
function StoreItem({
  store,
  followed,
  onPress,
  onFollow,
}: {
  store: NearbyStore;
  followed: boolean;
  onPress: () => void;
  onFollow: () => void;
}) {
  const catKey   = store.category ?? 'all';
  const emoji    = CAT_EMOJI[catKey] ?? '🏪';
  const catLabel = CATEGORIES.find(c => c.key === catKey)?.label ?? '기타';
  const followers = fakeFollowers(store.store_id);
  const thumbBg  = THUMB_BG[catKey] ?? C.g100;

  return (
    <TouchableOpacity style={si.wrap} onPress={onPress} activeOpacity={0.8}>
      {/* 썸네일 */}
      <View style={[si.thumb, { backgroundColor: thumbBg }]}>
        <Text style={si.thumbEmoji}>{emoji}</Text>
      </View>

      {/* 본문 */}
      <View style={si.body}>
        {/* 가게명 */}
        <Text style={si.name} numberOfLines={1}>{store.store_name}</Text>

        {/* 카테고리 · 거리 */}
        <Text style={si.meta}>
          {catLabel} · 📍 {formatDist(store.distance_km)}
        </Text>

        {/* 쿠폰 칩 + 팔로워 */}
        <View style={si.chipRow}>
          {store.active_coupon_count > 0 && (
            <View style={si.couponChip}>
              <Text style={si.couponChipText}>
                🎟 쿠폰 {store.active_coupon_count}개
              </Text>
            </View>
          )}
          <Text style={si.followers}>
            팔로워 {followers.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* 팔로우 버튼 */}
      <FollowButton followed={followed} onPress={onFollow} />
    </TouchableOpacity>
  );
}
const si = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: C.white,
    gap: 12,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  thumbEmoji: {
    fontSize: 34,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: C.g900,
    letterSpacing: -0.3,
  },
  meta: {
    fontSize: 13,
    color: C.g500,
    fontWeight: '400',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  couponChip: {
    backgroundColor: '#FFEAEA',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  couponChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E53935',
  },
  followers: {
    fontSize: 13,
    color: C.g500,
    fontWeight: '400',
  },
});

// ══════════════════════════════════════════════════════════════════
//  메인 화면
// ══════════════════════════════════════════════════════════════════
export default function NearbyFeedScreen() {
  const navigation = useNavigation<any>();

  const [userId,     setUserId]     = useState<string | null>(null);
  const [stores,     setStores]     = useState<NearbyStore[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [locating,   setLocating]   = useState(true);
  const [coords,     setCoords]     = useState<{ lat: number; lng: number } | null>(null);
  const [myDong,     setMyDong]     = useState('역삼동');
  const [activeCat,  setActiveCat]  = useState('all');
  const [activeSort, setActiveSort] = useState('distance');
  const [couponOnly, setCouponOnly] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [followMap,  setFollowMap]  = useState<Record<string, boolean>>({});

  // ── 인증 ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  // ── 위치 취득 ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLocating(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('위치 권한', '주변 가게를 찾으려면 위치 권한이 필요해요.');
          setLocating(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        const [geo] = await Location.reverseGeocodeAsync(loc.coords);
        if (geo) {
          setMyDong(geo.district ?? geo.subregion ?? geo.city ?? '내 위치');
        }
      } catch (e) {
        console.error('location error:', e);
      } finally {
        setLocating(false);
      }
    })();
  }, []);

  // ── 가게 목록 로드 ────────────────────────────────────────────────
  const loadStores = useCallback(async () => {
    if (!coords) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_nearby_stores', {
        user_lat:  coords.lat,
        user_lng:  coords.lng,
        radius_km: 9999,
        max_count: 80,
      });
      if (error) throw error;
      const list = (data ?? []) as NearbyStore[];
      setStores(list);

      // 팔로우 상태 초기화
      if (userId) {
        const { data: favData } = await supabase
          .from('store_favorites')
          .select('store_id')
          .eq('user_id', userId);
        const favSet = new Set((favData ?? []).map((r: any) => r.store_id));
        const fm: Record<string, boolean> = {};
        list.forEach(st => { fm[st.store_id] = favSet.has(st.store_id); });
        setFollowMap(fm);
      }
    } catch (e) {
      console.error('get_nearby_stores error:', e);
    } finally {
      setLoading(false);
    }
  }, [coords, userId]);

  useEffect(() => {
    if (coords) loadStores();
  }, [coords, loadStores]);

  // ── 팔로우 토글 ──────────────────────────────────────────────────
  const toggleFollow = async (storeId: string) => {
    if (!userId) return;
    const current = !!followMap[storeId];
    setFollowMap(prev => ({ ...prev, [storeId]: !current }));
    if (current) {
      await supabase
        .from('store_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('store_id', storeId);
    } else {
      await supabase
        .from('store_favorites')
        .insert({ user_id: userId, store_id: storeId });
    }
  };

  // ── 필터 + 정렬 적용 ────────────────────────────────────────────
  const filtered = stores
    .filter(st => {
      const catOk = activeCat === 'all' || (st.category ?? 'etc') === activeCat;
      const couponOk = couponOnly ? st.active_coupon_count > 0 : true;
      const searchOk = searchText.trim() === '' ||
        st.store_name.toLowerCase().includes(searchText.trim().toLowerCase());
      return catOk && couponOk && searchOk;
    })
    .sort((a, b) => {
      if (activeSort === 'distance') return a.distance_km - b.distance_km;
      if (activeSort === 'coupon') return b.active_coupon_count - a.active_coupon_count;
      // popular: unread_post_count 기준 (MVP 대용)
      return b.unread_post_count - a.unread_post_count;
    });

  const openStore = (store: NearbyStore) =>
    navigation.navigate('StoreFeed', {
      storeId:    store.store_id,
      storeName:  store.store_name,
      distanceKm: store.distance_km,
    });

  // ════════════════════════════════════════════════════════════════
  //  헤더 컴포넌트
  // ════════════════════════════════════════════════════════════════
  const ListHeader = () => (
    <>
      {/* 위치 + 검색바 */}
      <View style={s.searchRow}>
        {/* 위치 칩 */}
        <TouchableOpacity style={s.locationChip}>
          <Text style={s.locationText}>
            📍 {locating ? '...' : myDong} ▾
          </Text>
        </TouchableOpacity>

        {/* 검색 입력 */}
        <View style={s.searchInputWrap}>
          <TextInput
            style={s.searchInput}
            placeholder="가게 이름 검색"
            placeholderTextColor={C.g400}
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* 카테고리 스크롤 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.catScroll}
        contentContainerStyle={s.catContent}
      >
        {CATEGORIES.map(cat => {
          const isOn = activeCat === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              style={[s.catChip, isOn && s.catChipOn]}
              onPress={() => setActiveCat(cat.key)}
            >
              <Text style={[s.catLabel, isOn && s.catLabelOn]}>
                {cat.emoji ? `${cat.emoji} ` : ''}{cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 정렬 바 */}
      <View style={s.sortBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={s.sortOpts}>
            {SORT_OPTS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setActiveSort(opt.key)}
              >
                <Text style={[s.sortOpt, activeSort === opt.key && s.sortOptOn]}>
                  {opt.label}{activeSort === opt.key ? '▾' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* 쿠폰 있는 가게만 토글 */}
        <TouchableOpacity
          style={[s.couponToggle, couponOnly && s.couponToggleOn]}
          onPress={() => setCouponOnly(p => !p)}
        >
          <Text style={[s.couponToggleText, couponOnly && s.couponToggleTextOn]}>
            🎟 쿠폰 있는 가게만
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // ════════════════════════════════════════════════════════════════
  //  렌더
  // ════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={s.root}>
      {/* 앱바 */}
      <View style={s.appBar}>
        <Text style={s.appBarTitle}>가게 탐색</Text>
      </View>


      {locating || (loading && stores.length === 0) ? (
        <>
          <ListHeader />
          <View style={s.center}>
            <ActivityIndicator color={C.brand} size="large" />
            <Text style={s.loadingText}>
              {locating ? '위치를 확인하고 있어요...' : '주변 가게를 찾고 있어요...'}
            </Text>
          </View>
        </>
      ) : filtered.length === 0 ? (
        <>
          <ListHeader />
          <View style={s.center}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🗺</Text>
            <Text style={s.emptyText}>주변에 가게가 없어요</Text>
            <TouchableOpacity
              style={s.emptyBtn}
              onPress={() => { setActiveCat('all'); setCouponOnly(false); }}
            >
              <Text style={s.emptyBtnText}>필터 초기화</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.store_id}
          ListHeaderComponent={<ListHeader />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          ItemSeparatorComponent={() => (
            <View style={s.divider} />
          )}
          onRefresh={loadStores}
          refreshing={loading}
          renderItem={({ item }) => (
            <StoreItem
              store={item}
              followed={!!followMap[item.store_id]}
              onPress={() => openStore(item)}
              onFollow={() => toggleFollow(item.store_id)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.g50,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: C.g500,
    marginTop: 8,
  },

  // 앱바
  appBar: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    paddingBottom: 12,
    backgroundColor: C.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.g150,
  },
  appBarTitle: {
    fontSize: 30,
    fontFamily: 'KCC-Ganpan',
    color: C.g900,
    letterSpacing: 0,
  },

  // 위치 + 검색바
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: C.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.g150,
  },
  locationChip: {
    flexShrink: 0,
    backgroundColor: C.g100,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.g800,
  },
  searchInputWrap: {
    flex: 1,
    backgroundColor: C.g100,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  searchInput: {
    fontSize: 13,
    color: C.g900,
    padding: 0,
    margin: 0,
  },

  // 카테고리 스크롤
  catScroll: {
    backgroundColor: C.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.g150,
    maxHeight: 52,
  },
  catContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'center',
    flexDirection: 'row',
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.g100,
    alignSelf: 'center',
  },
  catChipOn: {
    backgroundColor: C.brand,
  },
  catLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.g700,
  },
  catLabelOn: {
    color: C.white,
    fontWeight: '700',
  },

  // 정렬 바
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: C.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.g150,
    gap: 8,
  },
  sortOpts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortOpt: {
    fontSize: 13,
    fontWeight: '600',
    color: C.g500,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sortOptOn: {
    color: C.brand,
    fontWeight: '800',
  },
  couponToggle: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.g200,
    backgroundColor: C.white,
    flexShrink: 0,
  },
  couponToggleOn: {
    backgroundColor: C.brandBg,
    borderColor: C.brand,
  },
  couponToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.g500,
  },
  couponToggleTextOn: {
    color: C.brand,
    fontWeight: '700',
  },

  // 구분선
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.g200,
    marginHorizontal: 0,
  },

  // 빈 상태
  emptyText: {
    fontSize: 15,
    color: C.g500,
    textAlign: 'center',
  },
  emptyBtn: {
    backgroundColor: C.brand,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 8,
  },
  emptyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.white,
  },
});
