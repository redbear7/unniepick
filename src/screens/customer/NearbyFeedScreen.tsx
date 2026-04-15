/**
 * NearbyFeedScreen — 위치 기반 가게 채팅 목록
 *
 * 모크업 v3 ① 위치 기반 채팅 목록을 React Native로 구현.
 * expo-location으로 현재 위치 취득 → Supabase get_nearby_stores RPC로 거리 정렬.
 * 각 가게 아이템 탭 → StoreFeedScreen으로 이동.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';

import { supabase } from '../../lib/supabase';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';
import { useMiniPlayerPadding } from '../../hooks/useMiniPlayerPadding';

// ── 테마 상수 ─────────────────────────────────────────────────────
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
  red:     '#FF6B6B',
};

// ── 거리 반경 옵션 ─────────────────────────────────────────────────
const RADIUS_OPTIONS = [1, 2, 5, 10] as const;
type RadiusKm = (typeof RADIUS_OPTIONS)[number];

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
}

// ── 쿠폰 종류 → 배지 ─────────────────────────────────────────────
const COUPON_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  timesale:   { label: '⚡ 타임세일', color: '#FF6B6B', bg: 'rgba(255,107,107,0.1)' },
  regular:    { label: '🎟 할인쿠폰', color: '#FFD93D', bg: 'rgba(255,217,61,0.12)' },
  service:    { label: '🎁 서비스',   color: '#2DB87A', bg: 'rgba(45,184,122,0.1)'  },
  experience: { label: '🌟 체험단',   color: '#D946B0', bg: 'rgba(217,70,176,0.1)'  },
};

// ── 거리 표시 포맷 ────────────────────────────────────────────────
function formatDist(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

// ── 거리별 색상 ───────────────────────────────────────────────────
function distColor(km: number): string {
  if (km < 0.5) return C.green;
  if (km < 2)   return '#FFD93D';
  return C.text3;
}

// ── 가게 아이템 ───────────────────────────────────────────────────
interface StoreItemProps {
  store: NearbyStore;
  onPress: () => void;
}

function StoreItem({ store, onPress }: StoreItemProps) {
  const badge = store.latest_coupon_kind
    ? COUPON_BADGES[store.latest_coupon_kind]
    : null;

  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.75}>
      {/* 아바타 */}
      <View style={styles.av}>
        <Text style={{ fontSize: 24 }}>🏪</Text>
        {/* 온라인 도트 (최근 포스트 있으면 활성) */}
        {store.unread_post_count > 0 && <View style={styles.onlineDot} />}
      </View>

      {/* 본문 */}
      <View style={styles.body}>
        {/* 1행: 가게명 + 쿠폰 뱃지 + 거리 */}
        <View style={styles.row1}>
          <Text style={styles.storeName} numberOfLines={1}>
            {store.store_name}
          </Text>
          {badge && (
            <View style={[styles.cpBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.cpBadgeText, { color: badge.color }]}>
                {badge.label}
              </Text>
            </View>
          )}
          <View style={styles.distCol}>
            <Text style={[styles.dist, { color: distColor(store.distance_km) }]}>
              {store.distance_km < 0.5 ? '🟢' : '🟡'} {formatDist(store.distance_km)}
            </Text>
            {store.unread_post_count > 0 && (
              <View style={styles.postBadge}>
                <Text style={styles.postBadgeText}>💬 {store.unread_post_count}</Text>
              </View>
            )}
          </View>
        </View>

        {/* 2행: 미리보기 텍스트 */}
        <Text style={styles.preview} numberOfLines={1}>
          {store.active_coupon_count > 0
            ? `🎟 쿠폰 ${store.active_coupon_count}개 발행 중`
            : '최근 소식을 확인해보세요'}
        </Text>

        {/* 3행: 태그 */}
        <View style={styles.row3}>
          {store.district_name && (
            <Text style={styles.tag}>{store.district_name}</Text>
          )}
          {store.active_coupon_count > 0 && (
            <View style={styles.yellowBadge}>
              <Text style={styles.yellowBadgeText}>쿠폰 {store.active_coupon_count}개</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ════════════════════════════════════════════════════════════════
//  메인 화면
// ════════════════════════════════════════════════════════════════
export default function NearbyFeedScreen() {
  const navigation = useNavigation<any>();
  const bottomPad = useMiniPlayerPadding(true); // 탭바 있는 화면

  const [stores, setStores]       = useState<NearbyStore[]>([]);
  const [loading, setLoading]     = useState(true);
  const [locating, setLocating]   = useState(true);
  const [radiusKm, setRadiusKm]   = useState<RadiusKm>(5);
  const [coords, setCoords]       = useState<{ lat: number; lng: number } | null>(null);
  const [myDong, setMyDong]       = useState('내 위치');
  const [distOpen, setDistOpen]   = useState(false);

  // ── 위치 취득 ────────────────────────────────────────────────
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
        const { latitude, longitude } = loc.coords;
        setCoords({ lat: latitude, lng: longitude });

        // 역지오코딩 (행정동 이름)
        const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
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

  // ── 가게 목록 로드 ───────────────────────────────────────────
  const loadStores = useCallback(async () => {
    if (!coords) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_nearby_stores', {
        user_lat:  coords.lat,
        user_lng:  coords.lng,
        radius_km: radiusKm,
        max_count: 30,
      });
      if (error) throw error;
      setStores((data ?? []) as NearbyStore[]);
    } catch (e) {
      console.error('get_nearby_stores error:', e);
    } finally {
      setLoading(false);
    }
  }, [coords, radiusKm]);

  useEffect(() => {
    if (coords) loadStores();
  }, [coords, loadStores]);

  // ── 가게 탭 → StoreFeedScreen ─────────────────────────────────
  const openStore = (store: NearbyStore) => {
    navigation.navigate('StoreFeed', {
      storeId:   store.store_id,
      storeName: store.store_name,
    });
  };

  // ════════════════════════════════════════════════════════════
  //  렌더
  // ════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={styles.root}>
      {/* ── 위치 헤더 바 ─────────────────────────────────── */}
      <View style={styles.locBar}>
        <View style={styles.locLeft}>
          <Text style={styles.locPin}>📍</Text>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.locDong}>{myDong}</Text>
              <Text style={styles.locArrow}>▾</Text>
            </View>
            {locating && (
              <Text style={styles.locSub}>위치 확인 중...</Text>
            )}
          </View>
        </View>
        {/* 거리 설정 버튼 */}
        <TouchableOpacity
          style={styles.distBtn}
          onPress={() => setDistOpen(p => !p)}
        >
          <Text style={styles.distBtnText}>
            📏 <Text style={{ color: C.yellow }}>{radiusKm}km</Text> 이내 ▾
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── 거리 필터 패널 ─────────────────────────────────── */}
      {distOpen && (
        <View style={styles.distPanel}>
          <Text style={styles.distPanelTitle}>📏 반경 거리 설정</Text>
          <View style={styles.distChips}>
            {RADIUS_OPTIONS.map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.chip, radiusKm === r && styles.chipOn]}
                onPress={() => { setRadiusKm(r); setDistOpen(false); }}
              >
                <Text style={[styles.chipText, radiusKm === r && styles.chipTextOn]}>
                  {r}km
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ── 정렬 헤더 ─────────────────────────────────────── */}
      <View style={styles.sortBar}>
        <Text style={styles.sortCount}>
          내 주변 <Text style={{ color: C.text2, fontWeight: '700' }}>{stores.length}곳</Text>
        </Text>
        <Text style={styles.sortLabel}>거리순</Text>
      </View>

      {/* ── 리스트 ────────────────────────────────────────── */}
      {locating || loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.brand} size="large" />
          <Text style={styles.loadingText}>
            {locating ? '위치를 확인하고 있어요...' : '주변 가게를 찾고 있어요...'}
          </Text>
        </View>
      ) : stores.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🗺</Text>
          <Text style={styles.emptyText}>
            반경 {radiusKm}km 이내에 가게가 없어요
          </Text>
          <TouchableOpacity
            style={styles.expandBtn}
            onPress={() => {
              const next = RADIUS_OPTIONS.find(r => r > radiusKm);
              if (next) setRadiusKm(next);
            }}
          >
            <Text style={styles.expandBtnText}>범위 넓히기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={stores}
          keyExtractor={item => item.store_id}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          onRefresh={loadStores}
          refreshing={loading}
          renderItem={({ item }) => (
            <StoreItem store={item} onPress={() => openStore(item)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════
//  스타일
// ════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },

  // 위치 헤더
  locBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: C.card,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  locLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locPin: { fontSize: 15 },
  locDong: { fontSize: 17, fontWeight: '900', color: C.text, letterSpacing: -0.3 },
  locArrow: { fontSize: 11, color: C.text3, marginTop: 1 },
  locSub: { fontSize: 10, color: C.text3, marginTop: 1 },
  distBtn: {
    backgroundColor: '#F2F4F6',
    borderWidth: 1, borderColor: C.border,
    borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5,
  },
  distBtnText: { fontSize: 11, fontWeight: '700', color: C.text2 },

  // 거리 패널
  distPanel: {
    backgroundColor: C.card,
    borderBottomWidth: 1, borderBottomColor: C.border,
    padding: 14,
  },
  distPanelTitle: { fontSize: 12, fontWeight: '700', color: C.text2, marginBottom: 10 },
  distChips: { flexDirection: 'row', gap: 6 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5, borderColor: C.border,
  },
  chipOn: { backgroundColor: C.yellow, borderColor: C.yellow },
  chipText: { fontSize: 12, fontWeight: '700', color: C.text3 },
  chipTextOn: { color: '#1A1200' },

  // 정렬 헤더
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 6,
  },
  sortCount: { fontSize: 12, color: C.text3 },
  sortLabel: {
    fontSize: 11, fontWeight: '700', color: C.brand,
    backgroundColor: 'rgba(255,111,15,0.08)',
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20,
  },

  // 리스트 아이템
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16, paddingVertical: 11,
    backgroundColor: C.card,
  },
  av: {
    width: 54, height: 54,
    borderRadius: 16,
    backgroundColor: '#F2F4F6',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1.5, borderColor: C.border,
    position: 'relative',
  },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 11, height: 11,
    borderRadius: 6,
    backgroundColor: C.green,
    borderWidth: 2, borderColor: C.card,
  },
  body: { flex: 1, minWidth: 0 },
  row1: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
    gap: 4,
  },
  storeName: {
    fontSize: 14, fontWeight: '700', color: C.text,
    flexShrink: 1,
  },
  cpBadge: {
    paddingHorizontal: 6, paddingVertical: 1.5,
    borderRadius: 6, flexShrink: 0,
  },
  cpBadgeText: { fontSize: 9, fontWeight: '800' },
  distCol: {
    marginLeft: 'auto',
    alignItems: 'flex-end',
    gap: 3, flexShrink: 0,
  },
  dist: { fontSize: 11, fontWeight: '700' },
  postBadge: {
    backgroundColor: C.brand,
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 9,
  },
  postBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  preview: {
    fontSize: 12, color: C.text2,
    marginBottom: 3,
  },
  row3: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tag: {
    fontSize: 10, color: C.text3,
    backgroundColor: '#F2F4F6',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10,
  },
  yellowBadge: {
    backgroundColor: 'rgba(254,229,0,0.12)',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10,
  },
  yellowBadgeText: { fontSize: 10, fontWeight: '700', color: '#B8A200' },

  divider: { height: 1, backgroundColor: C.border, marginHorizontal: 16 },

  // 빈 상태
  emptyText: { fontSize: 15, color: C.text3, textAlign: 'center' },
  expandBtn: {
    backgroundColor: C.brand,
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 20, marginTop: 8,
  },
  expandBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  loadingText: { fontSize: 13, color: C.text3, marginTop: 8 },
});
