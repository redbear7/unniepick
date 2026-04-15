/**
 * HomeScreen — 언니픽 홈
 *
 * 최상단 1줄 공지 롤링 배너 유지 + 아래는 위치 기반 가게 채팅 목록
 * (모크업 v3 ① 위치 기반 채팅 목록 디자인 적용)
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  Animated,
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';

import { supabase } from '../../lib/supabase';
import { useMiniPlayerPadding } from '../../hooks/useMiniPlayerPadding';
import RollingBanner from '../../components/RollingBanner';

// ── 테마 ──────────────────────────────────────────────────────────
const C = {
  bg:      '#F0F2F5',
  card:    '#FFFFFF',
  border:  'rgba(0,0,0,0.08)',
  text:    '#191F28',
  text2:   '#4E5968',
  text3:   '#8B95A1',
  brand:   '#FF6F0F',
  yellow:  '#FEE500',
  green:   '#0AC86E',
};

// ── 거리 옵션 ─────────────────────────────────────────────────────
const RADIUS_OPTS = [
  { value: 1,  label: '1km'  },
  { value: 2,  label: '2km'  },
  { value: 5,  label: '5km'  },
  { value: 10, label: '10km' },
  { value: 50, label: '전체' },
];

// ── 카테고리 ──────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'all',     label: '전체',   emoji: '🗺' },
  { key: 'food',    label: '음식점', emoji: '🍜' },
  { key: 'cafe',    label: '카페',   emoji: '☕' },
  { key: 'beauty',  label: '뷰티',   emoji: '💄' },
  { key: 'shop',    label: '쇼핑',   emoji: '👗' },
  { key: 'fitness', label: '운동',   emoji: '🏋️' },
  { key: 'ent',     label: '엔터',   emoji: '🎮' },
];

// ── 정렬 ─────────────────────────────────────────────────────────
const SORT_OPTS = ['거리순', '최신순', '인기순'];

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

// ── 쿠폰 뱃지 ────────────────────────────────────────────────────
const COUPON_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  timesale:   { label: '⚡ 타임세일', color: '#FF6B6B', bg: 'rgba(255,107,107,0.1)' },
  regular:    { label: '🎟 할인쿠폰', color: '#B8A200', bg: 'rgba(254,229,0,0.12)'  },
  service:    { label: '🎁 서비스',   color: '#2DB87A', bg: 'rgba(45,184,122,0.1)'  },
  experience: { label: '🌟 체험단',   color: '#D946B0', bg: 'rgba(217,70,176,0.1)'  },
};

// ── 거리 포맷 ────────────────────────────────────────────────────
function formatDist(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}
function distColor(km: number): string {
  if (km < 1) return C.green;
  if (km < 3) return '#D4700A';
  return C.text3;
}
function distDot(km: number): string {
  if (km < 1) return '🟢';
  if (km < 3) return '🟡';
  return '⚪';
}

// ── 아바타 배경 ──────────────────────────────────────────────────
const STORE_COLORS = ['#3a2525','#1a2025','#1f2a1f','#2a1f2a','#25202a','#1f2520','#2a221f'];
function storeGrad(name: string): string {
  return STORE_COLORS[name.charCodeAt(0) % STORE_COLORS.length];
}
function fakeMemberCount(storeId: string): number {
  let h = 0;
  for (let i = 0; i < storeId.length; i++) h = (h * 31 + storeId.charCodeAt(i)) & 0xffffff;
  return 100 + (h % 1900);
}

// ── 미니맵 ───────────────────────────────────────────────────────
function MiniMap({ radiusKm, dong }: { radiusKm: number; dong: string }) {
  const PINS = [
    { x: '38%', y: '52%', emoji: '🍜', hot: true  },
    { x: '62%', y: '38%', emoji: '☕', hot: false },
    { x: '30%', y: '32%', emoji: '💄', hot: false },
    { x: '68%', y: '65%', emoji: '🥩', hot: false },
  ];
  return (
    <View style={mm.wrap}>
      <View style={mm.grid}>
        <View style={mm.radiusCircle} />
        <View style={[mm.roadH, { top: 55 }]} />
        <View style={[mm.roadH, { top: 72 }]} />
        <View style={[mm.roadV, { left: '35%' as any }]} />
        <View style={[mm.roadV, { left: '65%' as any }]} />
        <View style={mm.myPin}>
          <View style={mm.myDot} />
          <View style={mm.myLabel}>
            <Text style={mm.myLabelText}>📍 {dong} (나)</Text>
          </View>
        </View>
        {PINS.map((p, i) => (
          <View key={i} style={[mm.storePin, { left: p.x as any, top: p.y as any }]}>
            <View style={[mm.spBubble, p.hot && mm.spBubbleHot]}>
              <Text style={mm.spText}>{p.emoji}</Text>
            </View>
          </View>
        ))}
        <View style={mm.radiusLbl}>
          <Text style={mm.radiusLblText}>{radiusKm >= 50 ? '전체' : `${radiusKm}km`} 반경</Text>
        </View>
        <TouchableOpacity style={mm.expandBtn}>
          <Text style={mm.expandText}>지도 크게 보기 ↗</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const mm = StyleSheet.create({
  wrap: { height: 110, backgroundColor: '#1A1E24', overflow: 'hidden' },
  grid: {
    flex: 1, position: 'relative',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  roadH: { position: 'absolute', left: 0, right: 0, height: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
  roadV: { position: 'absolute', top: 0, bottom: 0, width: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
  radiusCircle: {
    position: 'absolute', width: 90, height: 90, borderRadius: 45,
    borderWidth: 1.5, borderColor: 'rgba(254,229,0,0.35)', borderStyle: 'dashed',
    left: '50%', top: '50%', marginLeft: -45, marginTop: -45,
  },
  myPin: {
    position: 'absolute', left: '50%', top: '50%', alignItems: 'center',
    transform: [{ translateX: -6 }, { translateY: -6 }],
  },
  myDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#4C9EFF', borderWidth: 2, borderColor: '#fff' },
  myLabel: {
    position: 'absolute', top: 14,
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, width: 90,
  },
  myLabelText: { fontSize: 8, color: '#fff', textAlign: 'center' },
  storePin: {
    position: 'absolute', alignItems: 'center',
    transform: [{ translateX: -14 }, { translateY: -10 }],
  },
  spBubble: {
    backgroundColor: 'rgba(30,34,40,0.85)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3,
  },
  spBubbleHot: { backgroundColor: 'rgba(255,107,107,0.2)', borderColor: 'rgba(255,107,107,0.5)' },
  spText: { fontSize: 12 },
  radiusLbl: {
    position: 'absolute', bottom: 6, left: 10,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
  },
  radiusLblText: { fontSize: 9, color: 'rgba(255,255,255,0.6)' },
  expandBtn: {
    position: 'absolute', bottom: 6, right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
  },
  expandText: { fontSize: 9, color: 'rgba(255,255,255,0.6)' },
});

// ── 가게 아이템 ───────────────────────────────────────────────────
function FadeSlideIn({ index, children }: { index: number; children: React.ReactNode }) {
  const opacity   = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

function StoreItem({ store, onPress, index = 0 }: { store: NearbyStore; onPress: () => void; index?: number }) {
  const badge = store.latest_coupon_kind ? COUPON_BADGES[store.latest_coupon_kind] : null;
  const members = fakeMemberCount(store.store_id);
  const catEntry = CATEGORIES.find(c => c.key === (store.category ?? 'all')) ?? CATEGORIES[0];

  return (
    <FadeSlideIn index={index}>
    <TouchableOpacity style={s.item} onPress={onPress} activeOpacity={0.75}>
      <View style={[s.av, { backgroundColor: storeGrad(store.store_name) }]}>
        <Text style={{ fontSize: 22 }}>{catEntry.emoji === '🗺' ? '🏪' : catEntry.emoji}</Text>
        {store.unread_post_count > 0 && <View style={s.onlineDot} />}
      </View>
      <View style={s.body}>
        <View style={s.r1}>
          <Text style={s.name} numberOfLines={1}>{store.store_name}</Text>
          {badge && (
            <View style={[s.cpBadge, { backgroundColor: badge.bg }]}>
              <Text style={[s.cpBadgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
          )}
          <View style={s.distCol}>
            <Text style={[s.dist, { color: distColor(store.distance_km) }]}>
              {distDot(store.distance_km)} {formatDist(store.distance_km)}
            </Text>
            {store.unread_post_count > 0 && (
              <View style={s.postBadge}>
                <Text style={s.postBadgeText}>💬 {store.unread_post_count}</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={s.preview} numberOfLines={1}>
          {store.active_coupon_count > 0
            ? `🎟 쿠폰 ${store.active_coupon_count}개 발행 중`
            : '최근 소식을 확인해보세요'}
        </Text>
        <View style={s.r3}>
          <View style={s.tag}><Text style={s.tagText}>{catEntry.label}</Text></View>
          {store.district_name && <Text style={s.dong}>{store.district_name}</Text>}
          <Text style={s.members}>👥 {members.toLocaleString()}명</Text>
        </View>
      </View>
    </TouchableOpacity>
    </FadeSlideIn>
  );
}

// ════════════════════════════════════════════════════════════════
//  메인 화면
// ════════════════════════════════════════════════════════════════
export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const bottomPad  = useMiniPlayerPadding(true);

  const [stores,    setStores]    = useState<NearbyStore[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [locating,  setLocating]  = useState(true);
  const [radiusKm,  setRadiusKm]  = useState(5);
  const [coords,    setCoords]    = useState<{ lat: number; lng: number } | null>(null);
  const [myDong,    setMyDong]    = useState('내 위치');
  const [distOpen,  setDistOpen]  = useState(false);
  const [activeCat, setActiveCat] = useState('all');
  const [sortIdx,   setSortIdx]   = useState(0);

  // ── 위치 취득 ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLocating(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocating(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        const [geo] = await Location.reverseGeocodeAsync(loc.coords);
        if (geo) setMyDong(geo.district ?? geo.subregion ?? geo.city ?? '내 위치');
      } catch {}
      finally { setLocating(false); }
    })();
  }, []);

  // ── 가게 로드 ────────────────────────────────────────────────
  const loadStores = useCallback(async () => {
    if (!coords) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_nearby_stores', {
        user_lat:  coords.lat,
        user_lng:  coords.lng,
        radius_km: radiusKm >= 50 ? 9999 : radiusKm,
        max_count: 50,
      });
      if (error) throw error;
      setStores((data ?? []) as NearbyStore[]);
    } catch (e) {
      console.error('HomeScreen get_nearby_stores error:', e);
    } finally {
      setLoading(false);
    }
  }, [coords, radiusKm]);

  useEffect(() => { if (coords) loadStores(); }, [coords, loadStores]);

  const filtered = activeCat === 'all'
    ? stores
    : stores.filter(st => (st.category ?? 'all') === activeCat);

  const openStore = (store: NearbyStore) =>
    navigation.navigate('StoreFeed', { storeId: store.store_id, storeName: store.store_name });

  const curRadius = RADIUS_OPTS.find(r => r.value === radiusKm) ?? RADIUS_OPTS[2];

  // ── Header + List sections (FlatList ListHeaderComponent) ───
  const ListHeader = () => (
    <>
      {/* 위치 헤더 */}
      <View style={s.locBar}>
        <View style={s.locLeft}>
          <Text style={{ fontSize: 15 }}>📍</Text>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={s.locDong}>{myDong}</Text>
              <Text style={s.locArrow}>▾</Text>
            </View>
            {locating && <Text style={s.locSub}>위치 확인 중...</Text>}
          </View>
        </View>
        <View style={s.locRight}>
          <TouchableOpacity style={s.distBtn} onPress={() => setDistOpen(p => !p)}>
            <Text style={s.distBtnText}>
              📏 <Text style={{ color: C.yellow }}>{curRadius.label}</Text> 이내 ▾
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.searchBtn} onPress={() => navigation.navigate('CouponList')}>
            <Text style={{ fontSize: 17 }}>🔍</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 거리 패널 */}
      {distOpen && (
        <View style={s.distPanel}>
          <Text style={s.distPanelTitle}>📏 반경 거리 설정</Text>
          <View style={s.distChips}>
            {RADIUS_OPTS.map(r => (
              <TouchableOpacity
                key={r.value}
                style={[s.chip, radiusKm === r.value && s.chipOn]}
                onPress={() => { setRadiusKm(r.value); setDistOpen(false); }}
              >
                <Text style={[s.chipText, radiusKm === r.value && s.chipTextOn]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.distPanelSub}>
            현재 반경 <Text style={{ fontWeight: '700' }}>{curRadius.label}</Text> 이내 가게{' '}
            <Text style={{ fontWeight: '700' }}>{stores.length}곳</Text> 표시 중
          </Text>
        </View>
      )}

      {/* 카테고리 탭 */}
      <View style={s.catWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 8, gap: 8 }}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={s.cat}
              onPress={() => setActiveCat(cat.key)}
            >
              <View style={[s.catIcon, activeCat === cat.key && s.catIconOn]}>
                <Text style={{ fontSize: 18 }}>{cat.emoji}</Text>
              </View>
              <Text style={[s.catLabel, activeCat === cat.key && s.catLabelOn]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 미니맵 */}
      <MiniMap radiusKm={radiusKm} dong={myDong} />

      {/* 정렬 바 */}
      <View style={s.sortBar}>
        <Text style={s.sortCount}>
          내 주변 <Text style={{ fontWeight: '700', color: C.text2 }}>{filtered.length}곳</Text>
        </Text>
        <View style={s.sortOpts}>
          {SORT_OPTS.map((opt, i) => (
            <TouchableOpacity key={opt} onPress={() => setSortIdx(i)}>
              <Text style={[s.sortOpt, sortIdx === i && s.sortOptOn]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </>
  );

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="dark" />

      {/* 공지 롤링 배너 (1줄 유지) */}
      <RollingBanner />

      {/* 로딩 상태 */}
      {(locating || loading) ? (
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
            <Text style={s.emptyText}>반경 {curRadius.label} 이내에 가게가 없어요</Text>
            <TouchableOpacity
              style={s.expandBtn}
              onPress={() => {
                const next = RADIUS_OPTS.find(r => r.value > radiusKm);
                if (next) setRadiusKm(next.value);
              }}
            >
              <Text style={s.expandBtnText}>범위 넓히기</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.store_id}
          ListHeaderComponent={<ListHeader />}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={s.divider} />}
          onRefresh={loadStores}
          refreshing={loading}
          renderItem={({ item, index }) => (
            <StoreItem store={item} onPress={() => openStore(item)} index={index ?? 0} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════
//  스타일
// ════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },

  locBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  locLeft:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locDong:  { fontSize: 16, fontWeight: '900', color: C.text, letterSpacing: -0.3 },
  locArrow: { fontSize: 11, color: C.text3 },
  locSub:   { fontSize: 10, color: C.text3, marginTop: 1 },
  locRight: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  distBtn: {
    backgroundColor: '#F2F4F6', borderWidth: 1, borderColor: C.border,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  distBtnText: { fontSize: 11, fontWeight: '700', color: C.text2 },
  searchBtn: { padding: 4 },

  distPanel: {
    backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, gap: 10,
  },
  distPanelTitle: { fontSize: 12, fontWeight: '700', color: C.text2 },
  distChips:      { flexDirection: 'row', gap: 6 },
  chip: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: C.border },
  chipOn:     { backgroundColor: C.yellow, borderColor: C.yellow },
  chipText:   { fontSize: 12, fontWeight: '700', color: C.text3 },
  chipTextOn: { color: '#1A1200' },
  distPanelSub: { fontSize: 11, color: C.text3 },

  catWrap: { backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  cat:     { alignItems: 'center', gap: 4 },
  catIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F2F4F6', alignItems: 'center', justifyContent: 'center' },
  catIconOn:  { backgroundColor: 'rgba(254,229,0,0.2)' },
  catLabel:   { fontSize: 10, color: C.text3, fontWeight: '600' },
  catLabelOn: { color: '#B8A200', fontWeight: '700' },

  sortBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 7, backgroundColor: C.bg,
  },
  sortCount: { fontSize: 12, color: C.text3 },
  sortOpts:  { flexDirection: 'row', gap: 4 },
  sortOpt: { fontSize: 11, fontWeight: '700', color: C.text3, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, overflow: 'hidden' },
  sortOptOn: { color: C.brand, backgroundColor: 'rgba(255,111,15,0.08)' },

  item: {
    flexDirection: 'row', gap: 12, alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: C.card,
  },
  av: {
    width: 54, height: 54, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, position: 'relative',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 11, height: 11, borderRadius: 6,
    backgroundColor: C.green, borderWidth: 2, borderColor: C.card,
  },
  body: { flex: 1, minWidth: 0 },
  r1:   { flexDirection: 'row', alignItems: 'center', marginBottom: 3, gap: 4 },
  name: { fontSize: 14, fontWeight: '700', color: C.text, flexShrink: 1 },
  cpBadge: { paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6, flexShrink: 0 },
  cpBadgeText: { fontSize: 9, fontWeight: '800' },
  distCol: { marginLeft: 'auto', alignItems: 'flex-end', gap: 3, flexShrink: 0 },
  dist:    { fontSize: 11, fontWeight: '700' },
  postBadge: { backgroundColor: C.brand, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 9 },
  postBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  preview: { fontSize: 12, color: C.text2, marginBottom: 3 },
  r3:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tag:     { backgroundColor: '#F2F4F6', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  tagText: { fontSize: 10, fontWeight: '600', color: C.text3 },
  dong:    { fontSize: 10, color: C.text3 },
  members: { fontSize: 10, color: C.text3, marginLeft: 'auto' },

  divider: { height: 1, backgroundColor: C.border, marginHorizontal: 14 },

  emptyText: { fontSize: 15, color: C.text3, textAlign: 'center' },
  expandBtn: { backgroundColor: C.brand, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 8 },
  expandBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  loadingText:   { fontSize: 13, color: C.text3, marginTop: 8 },
});
