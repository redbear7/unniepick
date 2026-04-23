/**
 * ExploreScreen — 가게 탐색 탭
 *
 * 화면 구조 (위에서 아래):
 *   A. 상단 고정: SearchBar + CategoryGrid
 *   B. FilterBar (정렬 3종 + 필터 드롭다운)
 *   C. MiniMap (지도 토글 — 기본 숨김)
 *   D. 결과 카운트 텍스트
 *   E. 2열 ExploreCard 그리드
 *   F. 빈 상태 UI
 *
 * 엣지케이스:
 *   1. 검색 결과 0 → 빈 상태
 *   2. GPS 거부   → 거리순 비활성, 인기순 기본
 *   3. 카테고리+검색 동시 적용
 *   4. 팔로워 1000+ → K 축약 (ExploreCard)
 *   5. 쿠폰/영업중 필터 복합 적용
 *   6. 지도 ON → 스크롤 영역 180px 감소
 */
import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';

import { supabase } from '../../lib/supabase';
import { F } from '../../constants/typography';
import { PALETTE } from '../../constants/theme';

import SearchBar     from './SearchBar';
import CategoryGrid, { CATEGORIES, matchCategory } from './CategoryGrid';
import FilterBar, { type FilterState, type SortKey } from './FilterBar';
import MiniMap       from './MiniMap';
import ExploreCard   from './ExploreCard';

import {
  useExploreStores,
  type ExploreStore,
} from './hooks/useExploreStores';

// ── 결과 카운트 레이블 ───────────────────────────────────────────────
function resultLabel(
  count:    number,
  category: string,
  sort:     SortKey,
  priceMax: number | null,
): string {
  const catLabel   = category === '전체' ? '전체 카테고리' : category;
  const sortLabel  = sort === 'distance' ? '거리순' : sort === 'popular' ? '인기순' : '최신순';
  const priceLabel = priceMax != null ? ` · ~${(priceMax / 1000).toFixed(0)}천원` : '';
  return `${count}개 가게 · ${catLabel} · ${sortLabel}${priceLabel}`;
}

// ── 빈 상태 ──────────────────────────────────────────────────────────
function EmptyState({ query }: { query: string }) {
  return (
    <View style={es.wrap}>
      <Text style={es.icon}>🔍</Text>
      <Text style={es.title}>조건에 맞는 가게가 없어요</Text>
      <Text style={es.sub}>
        {query
          ? `"${query}"에 대한 결과가 없습니다.\n검색어를 바꿔보세요.`
          : '필터를 줄이거나 다른 카테고리를 선택해보세요'}
      </Text>
    </View>
  );
}

const es = StyleSheet.create({
  wrap:  { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  icon:  { fontSize: 40, marginBottom: 12 },
  title: { fontFamily: F.extraBold, fontSize: 16, color: PALETTE.gray800, marginBottom: 8 },
  sub:   { fontFamily: F.medium, fontSize: 13, color: PALETTE.gray500, textAlign: 'center', lineHeight: 20 },
});

// ── 로딩 스켈레톤 ────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <View style={sk.card}>
      <View style={sk.thumb} />
      <View style={sk.body}>
        <View style={sk.line1} />
        <View style={sk.line2} />
      </View>
    </View>
  );
}
function SkeletonGrid() {
  return (
    <View style={sk.grid}>
      {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
    </View>
  );
}

const SKELETON_BG = '#EAECEF';
const sk = StyleSheet.create({
  grid:  { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
  card:  { width: '47%', borderRadius: 14, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: PALETTE.gray150 },
  thumb: { height: 100, backgroundColor: SKELETON_BG },
  body:  { padding: 10, gap: 8 },
  line1: { height: 14, width: '80%', borderRadius: 4, backgroundColor: SKELETON_BG },
  line2: { height: 11, width: '60%', borderRadius: 4, backgroundColor: SKELETON_BG },
});

// ── 카테고리 필터 로직 ────────────────────────────────────────────────
/** "기타" = 앞 카테고리 중 어디에도 안 걸리는 경우 */
const NON_OTHER_KEYS = CATEGORIES
  .filter(c => c.key !== '전체' && c.key !== '기타')
  .map(c => c.key);

function matchesCategory(store: ExploreStore, key: string): boolean {
  if (key === '전체') return true;
  if (key === '기타') {
    // "기타" = 나머지 카테고리에 하나도 안 걸리는 가게
    return !NON_OTHER_KEYS.some(k => matchCategory(store.category, k));
  }
  return matchCategory(store.category, key);
}

// ── ExploreScreen ─────────────────────────────────────────────────────
export default function ExploreScreen() {
  const navigation = useNavigation<any>();

  // ── GPS ──────────────────────────────────────────────────────────────
  const [loc,       setLoc]       = useState<{ lat: number; lng: number } | null>(null);
  const [gpsOk,     setGpsOk]     = useState(false);
  const [locDenied, setLocDenied] = useState(false);

  // ── Auth ──────────────────────────────────────────────────────────────
  const [userId, setUserId] = useState<string | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────
  const [query,      setQuery]      = useState('');
  const [category,   setCategory]   = useState('전체');
  const [sort,       setSort]       = useState<SortKey>('distance');
  const [filter,     setFilter]     = useState<FilterState>({ couponOnly: false, openOnly: false, priceMax: null });
  const [mapVisible, setMapVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── 데이터 ───────────────────────────────────────────────────────────
  const { stores, loading, error, refresh, toggleFollow } = useExploreStores({
    lat:    loc?.lat,
    lng:    loc?.lng,
    userId,
  });

  // ── 초기화 ───────────────────────────────────────────────────────────
  useEffect(() => {
    // GPS
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocDenied(true);
        setGpsOk(false);
        // GPS 거부 → 인기순 기본
        setSort('popular');
        return;
      }
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsOk(true);
      } catch {
        setGpsOk(false);
        setSort('popular');
      }
    })();

    // Auth
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
  }, []);

  // ── Pull-to-refresh ───────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
    // 훅이 비동기라 짧게 대기 후 해제
    setTimeout(() => setRefreshing(false), 800);
  }, [refresh]);

  // ── 팔로우 토글 ───────────────────────────────────────────────────────
  const handleToggleFollow = useCallback(async (id: string) => {
    if (!userId) {
      Alert.alert('로그인이 필요해요', '팔로우하려면 로그인해주세요.');
      return;
    }
    await toggleFollow(id);
  }, [userId, toggleFollow]);

  // ── 매장 탭 ───────────────────────────────────────────────────────────
  const handleStorePress = useCallback((id: string) => {
    navigation.navigate('StoreHome', { storeId: id });
  }, [navigation]);

  // ── 필터/정렬/검색 로직 ───────────────────────────────────────────────
  const filtered = useMemo<ExploreStore[]>(() => {
    const q = query.trim().toLowerCase();

    let list = stores.filter(s => {
      // 검색
      if (q && !s.name.toLowerCase().includes(q) && !s.category.toLowerCase().includes(q)) {
        return false;
      }
      // 카테고리
      if (!matchesCategory(s, category)) return false;
      // 쿠폰 필터
      if (filter.couponOnly && s.activeCoupons <= 0) return false;
      // 영업 중 필터
      if (filter.openOnly && !s.isOpen) return false;
      // 가격 필터 (representative_price 있는 가게만 해당, 없으면 통과)
      if (filter.priceMax != null && s.representative_price != null) {
        if (s.representative_price > filter.priceMax) return false;
      }
      return true;
    });

    // 정렬
    list = [...list].sort((a, b) => {
      if (sort === 'distance') return (a.distance || Infinity) - (b.distance || Infinity);
      if (sort === 'popular')  return b.followers - a.followers;
      // newest: 기본 순서 유지 (insert 순)
      return 0;
    });

    return list;
  }, [stores, query, category, sort, filter]);

  // ── 렌더: 카드 열 ─────────────────────────────────────────────────────
  const renderItem = useCallback(({ item, index }: { item: ExploreStore; index: number }) => {
    // 2열 — 홀수 인덱스는 오른쪽 카드
    if (index % 2 !== 0) return null; // 짝수 인덱스만 행 렌더 트리거
    const left  = filtered[index];
    const right = filtered[index + 1];

    return (
      <View style={st.cardRow}>
        <ExploreCard
          store={left}
          onPress={handleStorePress}
          onToggleFollow={handleToggleFollow}
        />
        {right ? (
          <ExploreCard
            store={right}
            onPress={handleStorePress}
            onToggleFollow={handleToggleFollow}
          />
        ) : (
          <View style={st.cardPlaceholder} />
        )}
      </View>
    );
  }, [filtered, handleStorePress, handleToggleFollow]);

  // 짝수 인덱스만 추출 (FlatList keyExtractor용 배열)
  const evenItems = useMemo(
    () => filtered.filter((_, i) => i % 2 === 0),
    [filtered],
  );

  // ── 상단 헤더 (ListHeaderComponent) ─────────────────────────────────
  const ListHeader = (
    <View>
      {/* GPS 거부 배너 */}
      {locDenied && (
        <TouchableOpacity
          style={st.locBanner}
          onPress={() => {/* TODO: 설정 앱 열기 */}}
          activeOpacity={0.8}
        >
          <Text style={st.locBannerText}>
            📍 위치 권한을 허용하면 거리 정보를 볼 수 있어요
          </Text>
        </TouchableOpacity>
      )}

      {/* 카테고리 그리드 */}
      <CategoryGrid selected={category} onSelect={setCategory} />

      {/* 필터/정렬 바 */}
      <FilterBar
        sort={sort}
        onSort={setSort}
        filter={filter}
        onFilter={setFilter}
        gpsOk={gpsOk}
      />

      {/* 지도 영역 */}
      {mapVisible && (
        <MiniMap stores={filtered} storeCount={filtered.length} />
      )}

      {/* 결과 카운트 */}
      {!loading && (
        <View style={st.countRow}>
          <Text style={st.countText}>
            {resultLabel(filtered.length, category, sort, filter.priceMax)}
          </Text>
        </View>
      )}
    </View>
  );

  // ── 렌더 ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      {/* 상단 고정: SearchBar */}
      <View style={st.header}>
        <SearchBar
          value={query}
          onChange={setQuery}
          mapActive={mapVisible}
          onToggleMap={() => setMapVisible(v => !v)}
        />
      </View>

      {/* 에러 배너 */}
      {error && (
        <View style={st.errorBanner}>
          <Text style={st.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* 로딩 스켈레톤 */}
      {loading ? (
        <View style={{ flex: 1 }}>
          <CategoryGrid selected={category} onSelect={setCategory} />
          <SkeletonGrid />
        </View>
      ) : (
        <FlatList
          data={evenItems}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={<EmptyState query={query} />}
          contentContainerStyle={st.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PALETTE.orange500}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: PALETTE.gray50 },

  // 상단 고정 헤더 (SearchBar만 — 나머지는 FlatList 헤더로)
  header: {
    backgroundColor:  '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.gray150,
  },

  // GPS 거부 배너
  locBanner: {
    marginHorizontal:  16,
    marginTop:          8,
    backgroundColor:   PALETTE.orange50,
    borderRadius:      10,
    paddingVertical:   10,
    paddingHorizontal: 14,
    borderWidth:        1,
    borderColor:       PALETTE.orange100,
  },
  locBannerText: {
    fontFamily: F.semiBold,
    fontSize:   13,
    color:      PALETTE.orange600,
  },

  // 에러
  errorBanner: {
    marginHorizontal: 16,
    marginVertical:    4,
    backgroundColor:  '#FFF0F0',
    borderRadius:     10,
    paddingVertical:   8,
    paddingHorizontal: 12,
  },
  errorText: {
    fontFamily: F.medium,
    fontSize:   13,
    color:      PALETTE.red500,
  },

  // 결과 카운트
  countRow: {
    paddingHorizontal: 16,
    paddingVertical:    8,
  },
  countText: {
    fontFamily: F.semiBold,
    fontSize:   12,
    color:      PALETTE.gray500,
  },

  // FlatList 콘텐츠
  list: { paddingBottom: 32 },

  // 카드 행 (2열)
  cardRow: {
    flexDirection:     'row',
    paddingHorizontal: 12,
    gap:                8,
    marginBottom:       8,
  },
  cardPlaceholder: { flex: 1 },
});
