import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
  Animated, Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import { sendNearbyStoreNotification } from '../../lib/notifications';
import { fetchDistricts, DistrictRow } from '../../lib/services/districtService';
import { supabase } from '../../lib/supabase';
import { buildKakaoMapHtml } from './mapHtml';

const KAKAO_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? '';

// ── 지도 전용 가게 타입 (Supabase 실데이터) ──────────────────────
interface MapStore {
  id: string;
  name: string;
  emoji: string;
  category: string;
  address: string;
  phone: string | null;
  latitude: number;
  longitude: number;
  open_time: string | null;
  close_time: string | null;
  is_open: boolean;
  description: string | null;
  rating: number | null;
  review_count: number | null;
  naver_place_url: string | null;
  district_name: string | null;
  coupon_count:         number;         // 활성 쿠폰 수
  has_timesale:         boolean;        // 타임세일 진행 중
  timesale_ends_at:     string | null;
  representative_price: number | null;  // 대표 메뉴 가격
  price_label:          string | null;  // "런치 7,000원~"
}

const { height: SCREEN_H } = Dimensions.get('window');

// ── 두 좌표 간 거리 (미터) ───────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const STORE_SHEET_HEIGHT = 280;

// 목업 디자인 색상 상수
const C = {
  brand: '#FF6F0F',
  brandBg: '#FFF3EB',
  g900: '#191F28',
  g800: '#333D4B',
  g700: '#4E5968',
  g500: '#8B95A1',
  g400: '#ADB5BD',
  g200: '#E5E8EB',
  g150: '#EAECEF',
  g100: '#F2F4F6',
  g50: '#F9FAFB',
  white: '#FFFFFF',
  green: '#0AC86E',
  red: '#E53935',
};

// 창원 상남동 기본 좌표 (위치 권한 거부 시)
const DEFAULT_REGION = {
  latitude: 35.2340,
  longitude: 128.6668,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
};

export default function MapScreen() {
  const insets     = useSafeAreaInsets();
  const isFocused  = useIsFocused();
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const canGoBack  = navigation.canGoBack();
  const mapRef             = useRef<WebView>(null);
  const mapReadyRef        = useRef(false);   // MAP_READY 메시지 이후 true
  const pendingQueue       = useRef<string[]>([]);  // MAP_READY 전 쌓인 명령 큐
  const lastMarkerPressRef = useRef(0);
  const mapHtml            = useMemo(() => buildKakaoMapHtml(KAKAO_JS_KEY), []);

  /* WebView injectJavaScript 헬퍼 — MAP_READY 전이면 큐에 저장 */
  const injectJS = useCallback((code: string) => {
    if (!mapReadyRef.current) {
      pendingQueue.current.push(code);
      return;
    }
    mapRef.current?.injectJavaScript(code + '; true;');
  }, []);

  /* 큐 플러시 (MAP_READY 수신 시 호출) */
  const flushQueue = useCallback(() => {
    const q = pendingQueue.current.splice(0);
    q.forEach(code => mapRef.current?.injectJavaScript(code + '; true;'));
  }, []);
  const cardAnim = useRef(new Animated.Value(0)).current;
  const locationSub = useRef<Location.LocationSubscription | null>(null);

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<MapStore | null>(null);
  const [filter, setFilter] = useState<'all' | 'coupon' | 'timesale'>('all');
  const [districts,     setDistricts]  = useState<DistrictRow[]>([]);
  const [showDistricts, setShowDistricts] = useState(true);
  const [realStores, setRealStores] = useState<MapStore[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [mapRegion,    setMapRegion]    = useState(DEFAULT_REGION);
  const [sheetVisible, setSheetVisible] = useState(true);

  // 초기 로드
  useEffect(() => {
    Promise.all([requestLocation(), loadDistricts(), loadRealStores()]);
  }, []);

  // 가게 상세 → 지도 진입 시: focusStore 파라미터로 해당 가게 위치로 이동 + 카드 선택
  useEffect(() => {
    const { focusLat, focusLng, focusStore } = route.params ?? {};
    if (!focusLat || !focusLng) return;

    const delay = mapReadyRef.current ? 150 : 900;
    const animTimer = setTimeout(() => {
      injectJS(`window.panMap(${focusLat - 0.002}, ${focusLng}, 4)`);
    }, delay);

    let selectTimer: ReturnType<typeof setInterval> | null = null;
    if (focusStore) {
      const trySelect = (stores: MapStore[]) => {
        const target = stores.find(s => String(s.id) === String(focusStore));
        if (target) setSelectedStore(target);
      };
      if (realStores.length > 0) {
        trySelect(realStores);
      } else {
        selectTimer = setInterval(() => {
          setRealStores(prev => {
            if (prev.length > 0) {
              trySelect(prev);
              if (selectTimer) clearInterval(selectTimer);
            }
            return prev;
          });
        }, 300);
      }
    }

    return () => {
      clearTimeout(animTimer);
      if (selectTimer) clearInterval(selectTimer);
    };
  }, [route.params]);

  // ── Supabase 실데이터 fetch ──────────────────────────────────────
  const loadRealStores = useCallback(async () => {
    try {
      setStoresLoading(true);

      // 가게 목록 + 활성 쿠폰 수 함께 조회
      const { data: storeRows, error } = await supabase
        .from('stores')
        .select(`
          id, name, emoji, category, address, phone,
          latitude, longitude, open_time, close_time, is_open,
          description, rating, review_count, naver_place_url,
          representative_price, price_label
        `)
        .eq('is_active', true)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (error) throw error;
      if (!storeRows?.length) { setStoresLoading(false); return; }

      // 활성 쿠폰 수 일괄 조회
      const storeIds = storeRows.map(s => s.id);
      const now = new Date().toISOString();

      const { data: couponRows } = await supabase
        .from('coupons')
        .select('store_id')
        .in('store_id', storeIds)
        .eq('is_active', true)
        .gt('expires_at', now);

      // 타임세일 조회 (테이블 없으면 조용히 스킵)
      let timesaleRows: Array<{ store_id: string; ends_at: string }> | null = null;
      try {
        const { data } = await supabase
          .from('time_sales')
          .select('store_id, ends_at')
          .in('store_id', storeIds)
          .eq('is_active', true)
          .gt('ends_at', now);
        timesaleRows = data;
      } catch { /* time_sales 테이블 없으면 스킵 */ }

      // 가게별 쿠폰 수 집계
      const couponMap: Record<string, number> = {};
      (couponRows ?? []).forEach(c => {
        couponMap[c.store_id] = (couponMap[c.store_id] ?? 0) + 1;
      });

      // 가게별 타임세일 정보
      const timesaleMap: Record<string, string> = {};
      (timesaleRows ?? []).forEach(t => {
        timesaleMap[t.store_id] = t.ends_at;
      });

      const mapped: MapStore[] = storeRows.map(s => ({
        id:               s.id,
        name:             s.name,
        emoji:            s.emoji ?? '🏪',
        category:         s.category ?? '',
        address:          s.address ?? '',
        phone:            s.phone ?? null,
        latitude:         s.latitude,
        longitude:        s.longitude,
        open_time:        s.open_time ?? null,
        close_time:       s.close_time ?? null,
        is_open:          s.is_open ?? false,
        description:      s.description ?? null,
        rating:           s.rating ?? null,
        review_count:     s.review_count ?? null,
        naver_place_url:  s.naver_place_url ?? null,
        district_name:    null,
        coupon_count:         couponMap[s.id] ?? 0,
        has_timesale:         !!timesaleMap[s.id],
        timesale_ends_at:     timesaleMap[s.id] ?? null,
        representative_price: s.representative_price ?? null,
        price_label:          s.price_label ?? null,
      }));

      setRealStores(mapped);
    } catch (e) {
      console.error('지도 가게 로드 실패:', e);
    } finally {
      setStoresLoading(false);
    }
  }, []);

  // 탭 포커스: 실시간 위치 추적 ON/OFF
  useEffect(() => {
    if (isFocused) {
      const { focusLat, focusLng } = route.params ?? {};
      if (!focusLat && !focusLng && location) {
        injectJS(`window.panMap(${location.coords.latitude}, ${location.coords.longitude}, 5)`);
      }
      // 실시간 추적 시작 (3초 간격 or 10m 이동)
      Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 10,
        },
        (loc) => setLocation(loc),
      ).then(sub => { locationSub.current = sub; });
    } else {
      // 다른 탭 이동 시 추적 중단 (배터리 절약)
      locationSub.current?.remove();
      locationSub.current = null;
    }
    return () => {
      locationSub.current?.remove();
      locationSub.current = null;
    };
  }, [isFocused]);

  // 가게 카드 슬라이드 애니메이션
  useEffect(() => {
    Animated.spring(cardAnim, {
      toValue: selectedStore ? 1 : 0,
      useNativeDriver: true,
      speed: 16,
      bounciness: 4,
    }).start();
  }, [selectedStore]);

  const loadDistricts = async () => {
    try {
      const data = await fetchDistricts();
      setDistricts(data.filter(d => d.is_active && d.latitude && d.longitude));
    } catch { /* 상권 없어도 지도 동작 */ }
  };

  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('위치 권한 필요', '주변 가게를 보려면 위치 권한이 필요해요');
      setLoading(false);
      return;
    }

    // 1단계: 빠른 위치 (셀타워/WiFi) → 지도 즉시 이동
    try {
      const roughLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      setLocation(roughLoc);
      injectJS(`window.panMap(${roughLoc.coords.latitude}, ${roughLoc.coords.longitude}, 5)`);
    } catch { /* 1단계 실패 시 2단계에서 처리 */ }

    // 2단계: 정밀 GPS 위치 → 조용히 업데이트
    try {
      const preciseLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(preciseLoc);
      injectJS(`window.panMap(${preciseLoc.coords.latitude}, ${preciseLoc.coords.longitude}, 5)`);
    } catch { /* 위치 실패 시 1단계 결과 또는 기본 좌표 사용 */ }

    setLoading(false);

  };


  const moveToMyLocation = () => {
    if (!location) return;
    injectJS(`window.panMap(${location.coords.latitude}, ${location.coords.longitude}, 5)`);
  };

  const moveToDistrict = (d: DistrictRow) => {
    if (!d.latitude || !d.longitude) return;
    injectJS(`window.panMap(${d.latitude}, ${d.longitude}, 5)`);
  };

  const moveToStore = (store: MapStore) => {
    lastMarkerPressRef.current = Date.now();
    setSelectedStore(store);
    injectJS(`window.panMap(${store.latitude - 0.002}, ${store.longitude}, 4)`);
  };

  const handleNearbyAlert = async (store: MapStore) => {
    await sendNearbyStoreNotification(store.name);
    Alert.alert('알림 발송!', `"${store.name}" 근처 알림을 테스트 발송했어요 📍`);
  };

  const filteredStores = realStores.filter((s) => {
    if (filter === 'coupon')    return s.coupon_count > 0;
    if (filter === 'timesale')  return s.has_timesale;
    return true;
  });

  // 지도 화면 내 언니픽 가게들 — 쿠폰 있는 가게 먼저, 이후 거리순
  const visibleStores = useMemo(() => {
    const { latitude, longitude, latitudeDelta, longitudeDelta } = mapRegion;
    const latPad = latitudeDelta  / 2;
    const lngPad = longitudeDelta / 2;
    const userLat = location?.coords.latitude  ?? latitude;
    const userLng = location?.coords.longitude ?? longitude;

    return filteredStores
      .filter(s =>
        Math.abs(s.latitude  - latitude)  <= latPad &&
        Math.abs(s.longitude - longitude) <= lngPad,
      )
      .map(s => ({
        ...s,
        distM: Math.round(haversine(userLat, userLng, s.latitude, s.longitude)),
      }))
      .sort((a, b) => {
        // 1순위: 쿠폰/타임세일 있는 가게 먼저
        const aBenefit = (a.coupon_count > 0 || a.has_timesale) ? 0 : 1;
        const bBenefit = (b.coupon_count > 0 || b.has_timesale) ? 0 : 1;
        if (aBenefit !== bBenefit) return aBenefit - bBenefit;
        // 2순위: 거리 가까운 순
        return a.distM - b.distM;
      });
  }, [mapRegion, filteredStores, location]);

  /* ── WebView ↔ RN 동기화 ── */

  // 마커 데이터 동기화
  const syncStoresToMap = useCallback(() => {
    if (!mapReadyRef.current) return;
    const payload = filteredStores.map(s => ({
      id: s.id, emoji: s.emoji,
      latitude: s.latitude, longitude: s.longitude,
      coupon_count: s.coupon_count, has_timesale: s.has_timesale,
      label: getMarkerLabel(s),
    }));
    injectJS(`window.setStores(${JSON.stringify(payload)}, ${JSON.stringify(selectedStore?.id ?? null)})`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredStores, selectedStore, injectJS]);

  useEffect(() => { syncStoresToMap(); }, [syncStoresToMap]);

  // 내 위치 동기화
  useEffect(() => {
    if (!mapReadyRef.current || !location) return;
    injectJS(`window.setMyLocation(${location.coords.latitude}, ${location.coords.longitude})`);
  }, [location, injectJS]);

  // 상권 동기화
  useEffect(() => {
    if (!mapReadyRef.current) return;
    injectJS(`window.setDistricts(${JSON.stringify(showDistricts ? districts : [])})`);
  }, [districts, showDistricts, injectJS]);

  // WebView → RN 메시지 처리
  const handleMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      switch (msg.type) {
        case 'DEBUG':
          console.log('[KakaoMap DEBUG]', JSON.stringify(msg));
          break;
        case 'MAP_ERROR':
          console.warn('[KakaoMap ERROR]', msg.message);
          break;
        case 'MAP_READY':
          mapReadyRef.current = true;
          flushQueue();  // 큐에 쌓인 명령 먼저 처리
          if (location) injectJS(`window.setMyLocation(${location.coords.latitude}, ${location.coords.longitude})`);
          injectJS(`window.setDistricts(${JSON.stringify(showDistricts ? districts : [])})`);
          syncStoresToMap();
          break;
        case 'REGION_CHANGE':
          setMapRegion({
            latitude:      msg.lat,
            longitude:     msg.lng,
            latitudeDelta: msg.latitudeDelta,
            longitudeDelta: msg.longitudeDelta,
          });
          break;
        case 'MARKER_PRESS': {
          const store = realStores.find(s => s.id === msg.storeId);
          if (store) moveToStore(store);
          break;
        }
        case 'DISTRICT_PRESS': {
          const d = districts.find(x => x.id === msg.id);
          if (d) moveToDistrict(d);
          break;
        }
        case 'MAP_PRESS':
          if (Date.now() - lastMarkerPressRef.current > 200) setSelectedStore(null);
          break;
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, districts, showDistricts, realStores, syncStoresToMap, injectJS]);

  const getMarkerColor = (store: MapStore) => {
    if (store.has_timesale)    return C.red;
    if (store.coupon_count > 0) return C.brand;
    return C.g400;
  };

  // 마커 칩 레이블 (가격 우선)
  const getMarkerLabel = (store: MapStore) => {
    if (store.has_timesale) return '⚡ 타임세일';
    // 가격 있으면 가격 우선 표시
    if (store.representative_price != null) {
      return store.price_label ?? `${(store.representative_price / 1000).toFixed(0)}천원~`;
    }
    if (store.coupon_count > 0) return `🎟 쿠폰 ${store.coupon_count}개`;
    return store.name.length > 6 ? store.name.slice(0, 5) + '…' : store.name;
  };

  const cardTranslateY = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [260, 0],
  });

  return (
    <View style={styles.container}>
      {/* ── 카카오맵 WebView (풀스크린) ── */}
      <WebView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        source={{ html: mapHtml, baseUrl: 'http://localhost' }}
        // ⚠️ baseUrl이 Kakao 플랫폼에 등록된 도메인과 일치해야 함
        // 카카오 콘솔: https://developers.kakao.com/console/app/1416561/config/platform
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mixedContentMode="always"
        scrollEnabled={false}
        onMessage={handleMessage}
        onError={e => console.warn('[KakaoMap] WebView error', e.nativeEvent)}
        onHttpError={e => console.warn('[KakaoMap] HTTP error', e.nativeEvent)}
      />

      {/* ── 상단 오버레이 ── */}
      <View style={[styles.topOverlay, { top: insets.top + 8 }]}>
        {/* 타이틀 + 상권 토글 */}
        <View style={styles.topRow}>
          {/* 뒤로가기 버튼 — 스택에서 진입 시만 표시 */}
          {canGoBack ? (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.backBtnText}>‹</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.backBtnPlaceholder} />
          )}
          <View style={styles.titleBadge}>
            <Text style={styles.titleText}>📍 지도</Text>
          </View>
          <View style={{ flex: 1 }} />
          <View style={styles.topBtns}>
            <TouchableOpacity
              style={[styles.floatBtn, showDistricts && styles.floatBtnActive]}
              onPress={() => setShowDistricts(v => !v)}
            >
              <Text style={[styles.floatBtnText, showDistricts && styles.floatBtnTextActive]}>
                🗺 상권
              </Text>
            </TouchableOpacity>
            <View style={styles.countBadge}>
              {storesLoading
                ? <ActivityIndicator size="small" color={C.white} style={{ width: 30 }} />
                : <Text style={styles.countText}>{filteredStores.length}곳</Text>
              }
            </View>
          </View>
        </View>

        {/* 상권 빠른 이동 칩 */}
        {showDistricts && districts.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.districtBar}
          >
            {districts.map(d => (
              <TouchableOpacity
                key={d.id}
                style={styles.districtChip}
                onPress={() => moveToDistrict(d)}
              >
                <Text style={styles.districtChipText}>🗺 {d.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* 필터 탭 */}
        <View style={styles.filterRow}>
          {([
            { key: 'all', label: '전체' },
            { key: 'coupon', label: '🎟 쿠폰' },
            { key: 'timesale', label: '⚡ 타임세일' },
          ] as const).map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── 위치 로딩 인디케이터 (지도 위 오버레이) ── */}
      {loading && (
        <View style={[styles.locLoadingBadge, { top: insets.top + 8 }]}>
          <ActivityIndicator size="small" color={C.brand} />
          <Text style={styles.locLoadingText}>내 위치 확인 중...</Text>
        </View>
      )}

      {/* ── 내 위치 FAB ── */}
      {location && (
        <TouchableOpacity
          style={[
            styles.myLocFab,
            {
              bottom: selectedStore
                ? insets.bottom + 16
                : sheetVisible
                  ? insets.bottom + STORE_SHEET_HEIGHT + 12
                  : insets.bottom + 24,
            },
          ]}
          onPress={moveToMyLocation}
          activeOpacity={0.85}
        >
          <Text style={styles.myLocFabText}>🎯 내 위치</Text>
        </TouchableOpacity>
      )}

      {/* ── 바텀시트 숨김 상태: 펼치기 FAB ── */}
      {!selectedStore && !sheetVisible && (
        <TouchableOpacity
          style={[styles.sheetToggleFab, { bottom: insets.bottom + 24 }]}
          onPress={() => setSheetVisible(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.sheetToggleFabText}>🏪 가게 목록</Text>
        </TouchableOpacity>
      )}

      {/* ── 언니픽 가게들 바텀시트 (가게 미선택 시) ── */}
      {!selectedStore && sheetVisible && (
        <View style={[styles.storeListSheet, { bottom: 0, height: STORE_SHEET_HEIGHT + insets.bottom }]}>
          <View style={styles.sheetHandle} />
          {/* 헤더 */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderLeft}>
              <Text style={styles.sheetTitle}>🏪 언니픽 가게들</Text>
              <View style={styles.sheetCountBadge}>
                <Text style={styles.sheetCountText}>{visibleStores.length}곳</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setSheetVisible(false)}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              style={styles.sheetHideBtn}
            >
              <Text style={styles.sheetHideBtnText}>접기 ∨</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sheetSub}>쿠폰 가게 우선 · 가까운 순</Text>
          {/* 리스트 */}
          {visibleStores.length === 0 ? (
            <View style={styles.sheetEmpty}>
              <Text style={styles.sheetEmptyText}>
                {storesLoading ? '가게 불러오는 중...' : '이 지역에 등록된 가게가 없어요'}
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {visibleStores.map((s, idx) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.sheetRow, idx === visibleStores.length - 1 && styles.sheetRowLast]}
                  onPress={() => moveToStore(s)}
                  activeOpacity={0.75}
                >
                  {/* 이모지 */}
                  <View style={styles.sheetRowEmoji}>
                    <Text style={{ fontSize: 22 }}>{s.emoji}</Text>
                  </View>
                  {/* 정보 */}
                  <View style={styles.sheetRowInfo}>
                    <Text style={styles.sheetRowName} numberOfLines={1}>{s.name}</Text>
                    <Text style={styles.sheetRowMeta}>
                      {s.category}
                      {s.distM < 1000
                        ? ` · ${s.distM}m`
                        : ` · ${(s.distM / 1000).toFixed(1)}km`}
                    </Text>
                  </View>
                  {/* 배지: 혜택 있을 때만 표시 */}
                  <View style={styles.sheetRowBadges}>
                    {s.has_timesale && (
                      <View style={[styles.sheetBadge, styles.sheetBadgeRed]}>
                        <Text style={styles.sheetBadgeRedText}>⚡ 타임세일</Text>
                      </View>
                    )}
                    {s.coupon_count > 0 && (
                      <View style={styles.sheetBadge}>
                        <Text style={styles.sheetBadgeText}>🎟 {s.coupon_count}</Text>
                      </View>
                    )}
                    {!s.is_open && (
                      <View style={[styles.sheetBadge, styles.sheetBadgeClosed]}>
                        <Text style={styles.sheetBadgeClosedText}>영업종료</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
              <View style={{ height: 8 + insets.bottom }} />
            </ScrollView>
          )}
        </View>
      )}

      {/* ── 선택된 가게 카드 (하단 슬라이드업) ── */}
      {selectedStore && (
        <Animated.View
          style={[
            styles.cardWrapper,
            { bottom: 0, transform: [{ translateY: cardTranslateY }] },
          ]}
        >
          <StoreCard
            store={selectedStore}
            onClose={() => setSelectedStore(null)}
            onNearbyAlert={handleNearbyAlert}
            safeBottom={insets.bottom}
          />
        </Animated.View>
      )}
    </View>
  );
}

function StoreCard({
  store, onClose, onNearbyAlert, safeBottom = 0,
}: {
  store: MapStore;
  onClose: () => void;
  onNearbyAlert: (store: MapStore) => void;
  safeBottom?: number;
}) {
  const navigation = useNavigation();

  const handleGoDetail = () => {
    onClose();
    (navigation as any).navigate('StoreHome', { storeId: store.id });
  };

  const timeLabel = (t: string | null) => t?.slice(0, 5) ?? '-';

  return (
    <View style={[cardStyles.container, { paddingBottom: 20 + safeBottom }]}>
      {/* 드래그 핸들 */}
      <View style={cardStyles.handle} />

      <View style={cardStyles.header}>
        <View style={cardStyles.headerLeft}>
          <Text style={cardStyles.emoji}>{store.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={cardStyles.name}>{store.name}</Text>
            <Text style={cardStyles.category}>
              {store.category}
              {store.district_name ? ` · ${store.district_name}` : ''}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <Text style={cardStyles.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={cardStyles.badgeRow}>
        <View style={[cardStyles.badge, store.is_open ? cardStyles.badgeOpen : cardStyles.badgeClosed]}>
          <Text style={store.is_open ? cardStyles.badgeOpenText : cardStyles.badgeClosedText}>
            {store.is_open ? '영업중' : '영업종료'}
          </Text>
        </View>
        <Text style={cardStyles.hours}>{timeLabel(store.open_time)} ~ {timeLabel(store.close_time)}</Text>
        {store.rating != null && (
          <View style={cardStyles.rating}>
            <Text style={cardStyles.ratingText}>⭐ {store.rating.toFixed(1)}</Text>
            <Text style={cardStyles.reviewText}>({store.review_count ?? 0})</Text>
          </View>
        )}
      </View>

      <Text style={cardStyles.address}>📌 {store.address}</Text>

      {store.has_timesale && (
        <View style={cardStyles.timeSaleBanner}>
          <Text style={cardStyles.timeSaleText}>
            ⚡ 타임세일 진행 중!{store.timesale_ends_at ? ` ~${store.timesale_ends_at.slice(11, 16)}까지` : ''}
          </Text>
        </View>
      )}
      {store.coupon_count > 0 && (
        <View style={cardStyles.couponBanner}>
          <Text style={cardStyles.couponText}>🎟 쿠폰 {store.coupon_count}개 사용 가능</Text>
        </View>
      )}

      <View style={cardStyles.btnRow}>
        <TouchableOpacity style={cardStyles.detailBtn} onPress={handleGoDetail} activeOpacity={0.8}>
          <Text style={cardStyles.detailBtnText}>가게 상세보기 →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={cardStyles.alertBtn} onPress={() => onNearbyAlert(store)} activeOpacity={0.8}>
          <Text style={cardStyles.alertBtnText}>📍</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e8f0e9' },
  locLoadingBadge: {
    position: 'absolute', alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.white, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  locLoadingText: { fontSize: 13, color: C.g500, fontWeight: '600' },

  // 상단 오버레이
  topOverlay: {
    position: 'absolute', left: 0, right: 0, gap: 8,
  },
  topRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
    flexShrink: 0,
  },
  backBtnPlaceholder: { width: 36, height: 36, flexShrink: 0 },
  backBtnText: {
    fontSize: 24, fontWeight: '400', color: C.g900, lineHeight: 28, marginTop: -1,
  },
  titleBadge: {
    backgroundColor: C.white, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  titleText: { fontSize: 16, fontWeight: '800', color: C.g900 },
  topBtns: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  floatBtn: {
    backgroundColor: C.white, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1.5, borderColor: C.g150,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  floatBtnActive: { backgroundColor: C.brandBg, borderColor: C.brand },
  floatBtnText: { fontSize: 12, fontWeight: '700', color: C.g700 },
  floatBtnTextActive: { color: C.brand },
  countBadge: {
    backgroundColor: C.brand, borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  countText: { fontSize: 12, fontWeight: '800', color: C.white },

  // 상권 칩 바
  districtBar: { paddingHorizontal: 16, gap: 8 },
  districtChip: {
    backgroundColor: C.white, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1.5, borderColor: C.brand,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  districtChipText: { fontSize: 13, fontWeight: '700', color: C.brand },

  // 필터
  filterRow: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: C.white, borderWidth: 1.5, borderColor: C.g150,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  filterBtnActive: { backgroundColor: C.brand, borderColor: C.brand },
  filterText: { fontSize: 13, fontWeight: '600', color: C.g700 },
  filterTextActive: { color: C.white },

  // 내 위치 FAB
  myLocFab: {
    position: 'absolute', right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.brand, borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18, shadowRadius: 8, elevation: 6,
  },
  myLocFabText: { fontSize: 14, fontWeight: '700', color: C.white },

  // 마커는 카카오맵 HTML CustomOverlay 로 렌더링됨

  // 하단 카드 래퍼
  cardWrapper: {
    position: 'absolute', left: 0, right: 0,
  },

  // ── 쿠폰 업체 리스트 바텀시트 ──
  storeListSheet: {
    position: 'absolute', left: 0, right: 0,
    height: STORE_SHEET_HEIGHT,
    backgroundColor: C.white,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.10, shadowRadius: 12, elevation: 10,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: C.g200,
    alignSelf: 'center', marginTop: 10, marginBottom: 0,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.g150,
    gap: 8,
  },
  sheetHeaderLeft: {
    flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1,
  },
  sheetHideBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: C.g100, borderRadius: 12,
  },
  sheetHideBtnText: {
    fontSize: 12, fontWeight: '700', color: C.g500,
  },
  sheetToggleFab: {
    position: 'absolute', alignSelf: 'center', left: '50%',
    transform: [{ translateX: -52 }],
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.white,
    borderRadius: 24, borderWidth: 1.5, borderColor: C.brand,
    paddingHorizontal: 16, paddingVertical: 9,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 5,
  },
  sheetToggleFabText: { fontSize: 13, fontWeight: '800', color: C.brand },
  sheetTitle: {
    fontSize: 15, fontWeight: '800', color: C.g900, letterSpacing: -0.3,
  },
  sheetCountBadge: {
    backgroundColor: C.brand, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  sheetCountText: {
    fontSize: 11, fontWeight: '800', color: C.white,
  },
  sheetSub: {
    fontSize: 11, fontWeight: '500', color: C.g500,
    paddingHorizontal: 16, paddingBottom: 6,
  },
  sheetEmpty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24,
  },
  sheetEmptyText: {
    fontSize: 13, color: C.g500, fontWeight: '500',
  },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 11,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.g150,
  },
  sheetRowLast: { borderBottomWidth: 0 },
  sheetRowEmoji: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: C.g100,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  sheetRowInfo: { flex: 1, minWidth: 0 },
  sheetRowName: {
    fontSize: 14, fontWeight: '800', color: C.g900, letterSpacing: -0.3,
  },
  sheetRowMeta: {
    fontSize: 12, fontWeight: '500', color: C.g500, marginTop: 2,
  },
  sheetRowBadges: {
    flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0,
  },
  sheetBadge: {
    backgroundColor: C.brandBg, borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  sheetBadgeText: {
    fontSize: 11, fontWeight: '700', color: C.brand,
  },
  sheetBadgeRed: { backgroundColor: '#FFEBEE' },
  sheetBadgeRedText: { fontSize: 11, fontWeight: '700', color: C.red },
  sheetBadgeClosed: { backgroundColor: C.g100 },
  sheetBadgeClosedText: { fontSize: 11, fontWeight: '600', color: C.g500 },
});

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: C.white,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 8, paddingHorizontal: 16, paddingBottom: 20, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  handle: {
    width: 36, height: 4, borderRadius: 4,
    backgroundColor: C.g200,
    alignSelf: 'center', marginBottom: 6,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  emoji: { fontSize: 34 },
  name: { fontSize: 16, fontWeight: '800', color: C.g900 },
  category: { fontSize: 12, color: C.g500, marginTop: 2 },
  closeBtn: { fontSize: 18, color: C.g500, padding: 4 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeOpen: { backgroundColor: C.green + '22' },
  badgeClosed: { backgroundColor: C.g100 },
  badgeText: { fontSize: 11, fontWeight: '700', color: C.g800 },
  badgeOpenText: { fontSize: 11, fontWeight: '700', color: C.green },
  badgeClosedText: { fontSize: 11, fontWeight: '700', color: C.g500 },
  hours: { fontSize: 12, color: C.g500 },
  rating: { flexDirection: 'row', gap: 2, marginLeft: 'auto' },
  ratingText: { fontSize: 12, fontWeight: '700', color: C.g900 },
  reviewText: { fontSize: 12, color: C.g500 },
  address: { fontSize: 12, color: C.g500 },
  timeSaleBanner: {
    backgroundColor: C.red + '1A', borderRadius: 8, padding: 8,
    borderLeftWidth: 3, borderLeftColor: C.red,
  },
  timeSaleText: { fontSize: 13, fontWeight: '700', color: C.red },
  couponBanner: {
    backgroundColor: C.brandBg, borderRadius: 8, padding: 8,
    borderLeftWidth: 3, borderLeftColor: C.brand,
  },
  couponText: { fontSize: 13, fontWeight: '700', color: C.brand },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  detailBtn: {
    flex: 1, backgroundColor: C.brand,
    borderRadius: 12, padding: 12, alignItems: 'center',
  },
  detailBtnText: { fontSize: 13, fontWeight: '800', color: C.white },
  alertBtn: {
    backgroundColor: C.brandBg,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: C.brand + '44',
  },
  alertBtnText: { fontSize: 16 },
});
