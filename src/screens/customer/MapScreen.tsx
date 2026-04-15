import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Platform,
  Animated, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';
import { TEST_STORES, Store } from '../../constants/stores';
import { sendNearbyStoreNotification } from '../../lib/notifications';
import { fetchDistricts, DistrictRow } from '../../lib/services/districtService';

const { height: SCREEN_H } = Dimensions.get('window');

// 창원 상남동 기본 좌표 (위치 권한 거부 시)
const DEFAULT_REGION = {
  latitude: 35.2340,
  longitude: 128.6668,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
};

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const mapRef = useRef<MapView>(null);
  const cardAnim = useRef(new Animated.Value(0)).current;
  const locationSub = useRef<Location.LocationSubscription | null>(null);

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [filter, setFilter] = useState<'all' | 'coupon' | 'timesale'>('all');
  const [districts, setDistricts] = useState<DistrictRow[]>([]);
  const [showDistricts, setShowDistricts] = useState(true);

  // 초기 로드
  useEffect(() => {
    Promise.all([requestLocation(), loadDistricts()]);
  }, []);

  // 탭 포커스: 실시간 위치 추적 ON/OFF
  useEffect(() => {
    if (isFocused) {
      // 포커스 진입 시 현재 위치로 이동
      if (location) {
        mapRef.current?.animateToRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }, 600);
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
      const roughLoc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });
      setLocation(roughLoc);
      mapRef.current?.animateToRegion({
        latitude: roughLoc.coords.latitude,
        longitude: roughLoc.coords.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 500);
    } catch { /* 1단계 실패 시 2단계에서 처리 */ }

    // 2단계: 정밀 GPS 위치 → 조용히 업데이트
    try {
      const preciseLoc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        maximumAge: 3000,
      });
      setLocation(preciseLoc);
      mapRef.current?.animateToRegion({
        latitude: preciseLoc.coords.latitude,
        longitude: preciseLoc.coords.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 400);
    } catch { /* 위치 실패 시 1단계 결과 또는 기본 좌표 사용 */ }

    setLoading(false);
  };

  const moveToMyLocation = () => {
    if (!location) return;
    mapRef.current?.animateToRegion({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 600);
  };

  const moveToDistrict = (d: DistrictRow) => {
    if (!d.latitude || !d.longitude) return;
    mapRef.current?.animateToRegion({
      latitude: d.latitude,
      longitude: d.longitude,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    }, 600);
  };

  const moveToStore = (store: Store) => {
    setSelectedStore(store);
    mapRef.current?.animateToRegion({
      latitude: store.latitude - 0.002,
      longitude: store.longitude,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008,
    }, 600);
  };

  const handleNearbyAlert = async (store: Store) => {
    await sendNearbyStoreNotification(store.name);
    Alert.alert('알림 발송!', `"${store.name}" 근처 알림을 테스트 발송했어요 📍`);
  };

  const filteredStores = TEST_STORES.filter((s) => {
    if (filter === 'coupon') return s.hasActiveCoupon;
    if (filter === 'timesale') return s.hasTimeSale;
    return true;
  });

  const getMarkerColor = (store: Store) => {
    if (store.hasTimeSale) return COLORS.accent;
    if (store.hasActiveCoupon) return COLORS.primary;
    return COLORS.textMuted;
  };

  const initialRegion = location
    ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }
    : DEFAULT_REGION;

  const cardTranslateY = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [260, 0],
  });

  return (
    <View style={styles.container}>
      {/* ── 지도 (풀스크린) ── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        onPress={() => setSelectedStore(null)}
        onMapReady={() => {
          if (location) {
            mapRef.current?.animateToRegion({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            }, 500);
          }
        }}
      >
        {/* 내 위치 반경 */}
        {location && (
          <Circle
            center={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            radius={300}
            strokeColor={COLORS.primary + '55'}
            fillColor={COLORS.primary + '18'}
          />
        )}

        {/* 상권 마커 */}
        {showDistricts && districts.map(d =>
          d.latitude && d.longitude ? (
            <Marker
              key={`district-${d.id}`}
              coordinate={{ latitude: d.latitude, longitude: d.longitude }}
              anchor={{ x: 0.5, y: 1 }}
              onPress={() => moveToDistrict(d)}
            >
              <View style={styles.distMarkerWrap}>
                <View style={styles.distMarker}>
                  <Text style={styles.distMarkerIcon}>🗺</Text>
                  <Text style={styles.distMarkerText}>{d.name}</Text>
                </View>
                <View style={styles.distMarkerTail} />
              </View>
            </Marker>
          ) : null
        )}

        {/* 가게 마커 */}
        {filteredStores.map((store) => (
          <Marker
            key={store.id}
            coordinate={{ latitude: store.latitude, longitude: store.longitude }}
            anchor={{ x: 0.5, y: 1 }}
            onPress={() => moveToStore(store)}
          >
            <View>
              <View style={[
                styles.marker,
                { backgroundColor: getMarkerColor(store) },
                selectedStore?.id === store.id && styles.markerSelected,
              ]}>
                <Text style={styles.markerEmoji}>{store.emoji}</Text>
                {(store.hasTimeSale || store.hasActiveCoupon) && (
                  <View style={styles.markerBadge}>
                    <Text style={styles.markerBadgeText}>
                      {store.hasTimeSale ? '⚡' : '🎟'}
                    </Text>
                  </View>
                )}
              </View>
              <View style={[styles.markerTail, { borderTopColor: getMarkerColor(store) }]} />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* ── 상단 오버레이 ── */}
      <View style={[styles.topOverlay, { top: insets.top + 8 }]}>
        {/* 타이틀 + 상권 토글 */}
        <View style={styles.topRow}>
          <View style={styles.titleBadge}>
            <Text style={styles.titleText}>📍 주변 가게</Text>
          </View>
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
              <Text style={styles.countText}>{filteredStores.length}곳</Text>
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
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.locLoadingText}>내 위치 확인 중...</Text>
        </View>
      )}

      {/* ── 내 위치 FAB ── */}
      {location && (
        <TouchableOpacity
          style={[styles.myLocFab, { bottom: selectedStore ? 260 : insets.bottom + 24 }]}
          onPress={moveToMyLocation}
          activeOpacity={0.85}
        >
          <Text style={styles.myLocFabText}>🎯</Text>
        </TouchableOpacity>
      )}

      {/* ── 선택된 가게 카드 (하단 슬라이드업) ── */}
      {selectedStore && (
        <Animated.View
          style={[
            styles.cardWrapper,
            { bottom: insets.bottom, transform: [{ translateY: cardTranslateY }] },
          ]}
        >
          <StoreCard
            store={selectedStore}
            onClose={() => setSelectedStore(null)}
            onNearbyAlert={handleNearbyAlert}
          />
        </Animated.View>
      )}
    </View>
  );
}

function StoreCard({
  store, onClose, onNearbyAlert,
}: {
  store: Store;
  onClose: () => void;
  onNearbyAlert: (store: Store) => void;
}) {
  return (
    <View style={[cardStyles.container, SHADOW.card]}>
      {/* 드래그 핸들 */}
      <View style={cardStyles.handle} />

      <View style={cardStyles.header}>
        <View style={cardStyles.headerLeft}>
          <Text style={cardStyles.emoji}>{store.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={cardStyles.name}>{store.name}</Text>
            <Text style={cardStyles.category}>
              {store.category}
              {store.districtName ? ` · ${store.districtName}` : ''}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <Text style={cardStyles.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={cardStyles.badgeRow}>
        <View style={[cardStyles.badge, store.isOpen ? cardStyles.badgeOpen : cardStyles.badgeClosed]}>
          <Text style={cardStyles.badgeText}>{store.isOpen ? '영업중' : '영업종료'}</Text>
        </View>
        <Text style={cardStyles.hours}>{store.openTime} ~ {store.closeTime}</Text>
        <View style={cardStyles.rating}>
          <Text style={cardStyles.ratingText}>⭐ {store.rating}</Text>
          <Text style={cardStyles.reviewText}>({store.reviewCount})</Text>
        </View>
      </View>

      <Text style={cardStyles.address}>📌 {store.address}</Text>

      {store.hasTimeSale && (
        <View style={cardStyles.timeSaleBanner}>
          <Text style={cardStyles.timeSaleText}>⚡ 타임세일 진행 중! ~{store.timeSaleEndsAt}까지</Text>
        </View>
      )}
      {store.hasActiveCoupon && (
        <View style={cardStyles.couponBanner}>
          <Text style={cardStyles.couponText}>🎟 팔로워 전용 쿠폰 있음</Text>
        </View>
      )}

      <View style={cardStyles.btnRow}>
        <TouchableOpacity style={cardStyles.alertBtn} onPress={() => onNearbyAlert(store)}>
          <Text style={cardStyles.alertBtnText}>📍 근처 알림 테스트</Text>
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
    backgroundColor: COLORS.white, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
    ...SHADOW.card,
  },
  locLoadingText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },

  // 상단 오버레이
  topOverlay: {
    position: 'absolute', left: 0, right: 0, gap: 8,
  },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16,
  },
  titleBadge: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 8,
    ...SHADOW.card,
  },
  titleText: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  topBtns: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  floatBtn: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1.5, borderColor: COLORS.border,
    ...SHADOW.card,
  },
  floatBtnActive: { backgroundColor: '#4CAF5018', borderColor: '#4CAF50' },
  floatBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  floatBtnTextActive: { color: '#2e7d32' },
  countBadge: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: 10, paddingVertical: 8,
    ...SHADOW.card,
  },
  countText: { fontSize: 12, fontWeight: '800', color: COLORS.white },

  // 상권 칩 바
  districtBar: { paddingHorizontal: 16, gap: 8 },
  districtChip: {
    backgroundColor: COLORS.white, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1.5, borderColor: '#4CAF50',
    ...SHADOW.card,
  },
  districtChipText: { fontSize: 13, fontWeight: '700', color: '#2e7d32' },

  // 필터
  filterRow: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    ...SHADOW.card,
  },
  filterBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  filterTextActive: { color: COLORS.white },

  // 내 위치 FAB
  myLocFab: {
    position: 'absolute', right: 16,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW.card,
    shadowOpacity: 0.18, elevation: 6,
  },
  myLocFabText: { fontSize: 26 },

  // 마커
  distMarkerWrap: { alignItems: 'center' },
  distMarker: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#4CAF50', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 2, borderColor: COLORS.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  distMarkerIcon: { fontSize: 13 },
  distMarkerText: { fontSize: 12, fontWeight: '800', color: COLORS.white },
  distMarkerTail: {
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: '#4CAF50',
    alignSelf: 'center', marginTop: -1,
  },
  marker: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: COLORS.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  markerSelected: { width: 54, height: 54, borderRadius: 27 },
  markerEmoji: { fontSize: 22 },
  markerBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: COLORS.white, borderRadius: 8,
    width: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  markerBadgeText: { fontSize: 10 },
  markerTail: {
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    alignSelf: 'center', marginTop: -1,
  },

  // 하단 카드 래퍼
  cardWrapper: {
    position: 'absolute', left: 0, right: 0,
  },
});

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 8, paddingHorizontal: 16, paddingBottom: 20, gap: 10,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center', marginBottom: 6,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  emoji: { fontSize: 34 },
  name: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  category: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  closeBtn: { fontSize: 18, color: COLORS.textMuted, padding: 4 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeOpen: { backgroundColor: '#4CAF5022' },
  badgeClosed: { backgroundColor: COLORS.border },
  badgeText: { fontSize: 11, fontWeight: '700', color: COLORS.text },
  hours: { fontSize: 12, color: COLORS.textMuted },
  rating: { flexDirection: 'row', gap: 2, marginLeft: 'auto' },
  ratingText: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  reviewText: { fontSize: 12, color: COLORS.textMuted },
  address: { fontSize: 12, color: COLORS.textMuted },
  timeSaleBanner: {
    backgroundColor: COLORS.accent + '22', borderRadius: RADIUS.sm, padding: 8,
    borderLeftWidth: 3, borderLeftColor: COLORS.accent,
  },
  timeSaleText: { fontSize: 13, fontWeight: '700', color: '#8B6914' },
  couponBanner: {
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm, padding: 8,
    borderLeftWidth: 3, borderLeftColor: COLORS.primary,
  },
  couponText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  alertBtn: {
    flex: 1, backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.md, padding: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.primary + '44',
  },
  alertBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
});
