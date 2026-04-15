import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';
import { getSession } from '../../lib/services/authService';
import {
  getFavoriteStoresWithCoupons,
  toggleFavorite,
  FavoriteStoreItem,
} from '../../lib/services/favoriteService';
import { COUPON_KIND_CONFIG, CouponKind } from '../../lib/services/couponService';
import { useMiniPlayerPadding } from '../../hooks/useMiniPlayerPadding';

type SortMode = 'favorite' | 'recent';

export default function InterestScreen() {
  const navigation = useNavigation<any>();
  const bottomPad = useMiniPlayerPadding(true);
  const [items, setItems]       = useState<FavoriteStoreItem[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('favorite');
  const [userId, setUserId]     = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [sortMode])
  );

  const loadData = async () => {
    try {
      const session = await getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);
      const data = await getFavoriteStoresWithCoupons(session.user.id, sortMode);
      setItems(data);
    } catch (e) {
      console.error('관심 가게 로드 오류:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleUnfavorite = async (storeId: string) => {
    if (!userId) return;
    await toggleFavorite(userId, storeId);
    setItems(prev => prev.filter(i => i.store.id !== storeId));
  };

  const renderItem = ({ item }: { item: FavoriteStoreItem }) => {
    const { store, coupons } = item;
    return (
      <TouchableOpacity
        style={[styles.storeCard, SHADOW.card]}
        onPress={() => navigation.navigate('StoreHome', { storeId: store.id })}
        activeOpacity={0.88}
      >
        {/* 상단 행: 가게 정보 + 찜 해제 버튼 */}
        <View style={styles.cardTop}>
          <View style={styles.storeEmojiBg}>
            <Text style={styles.storeEmoji}>{store.emoji || '🏪'}</Text>
          </View>

          <View style={styles.storeInfo}>
            <Text style={styles.storeName}>{store.name}</Text>
            <Text style={styles.storeMeta} numberOfLines={1}>
              {store.category}
              {store.address ? `  ·  ${store.address}` : ''}
            </Text>
            <View style={styles.openRow}>
              <View style={[styles.openDot, { backgroundColor: store.is_open ? COLORS.success : '#CCC' }]} />
              <Text style={[styles.openText, { color: store.is_open ? COLORS.success : COLORS.textMuted }]}>
                {store.is_open ? '영업중' : '영업종료'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.heartBtn}
            onPress={() => handleUnfavorite(store.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.heartIcon}>❤️</Text>
          </TouchableOpacity>
        </View>

        {/* 구분선 */}
        <View style={styles.divider} />

        {/* 발행 중인 쿠폰 */}
        {coupons.length > 0 ? (
          <View style={styles.couponArea}>
            <Text style={styles.couponAreaLabel}>발행 중인 쿠폰 {coupons.length}개</Text>
            <View style={styles.chipRow}>
              {coupons.slice(0, 3).map(c => {
                const cfg = COUPON_KIND_CONFIG[(c.coupon_kind as CouponKind)] ?? COUPON_KIND_CONFIG.regular;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, { backgroundColor: cfg.subBg, borderColor: cfg.bg + '44' }]}
                    onPress={() => navigation.navigate('CouponDetail', { coupon: c })}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.chipEmoji}>{cfg.emoji}</Text>
                    <Text style={[styles.chipLabel, { color: cfg.bg }]} numberOfLines={1}>
                      {c.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {coupons.length > 3 && (
                <View style={styles.moreChip}>
                  <Text style={styles.moreChipText}>+{coupons.length - 3}</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.noCouponArea}>
            <Text style={styles.noCouponText}>현재 발행된 쿠폰이 없어요</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>⭐ 찜 가게</Text>
        <TouchableOpacity
          style={[styles.sortBtn, sortMode === 'recent' && styles.sortBtnActive]}
          onPress={() => {
            setSortMode(prev => prev === 'favorite' ? 'recent' : 'favorite');
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.sortBtnText, sortMode === 'recent' && styles.sortBtnTextActive]}>
            {sortMode === 'recent' ? '✓ 최근 본 순' : '최근'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={COLORS.primary} />
      ) : items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>🐻</Text>
          <Text style={styles.emptyTitle}>찜한 가게가 없어요</Text>
          <Text style={styles.emptyDesc}>
            가게 페이지에서 ❤️를 눌러{'\n'}관심 가게를 찜해보세요
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => navigation.navigate('CouponList')}
          >
            <Text style={styles.emptyBtnText}>쿠폰 둘러보기 →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.store.id}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text },

  sortBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  sortBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sortBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  sortBtnTextActive: { color: '#fff' },

  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },

  // ── 가게 카드 ──
  storeCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  storeEmojiBg: {
    width: 52, height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
  },
  storeEmoji: { fontSize: 26 },
  storeInfo:  { flex: 1, gap: 3 },
  storeName:  { fontSize: 16, fontWeight: '800', color: COLORS.text },
  storeMeta:  { fontSize: 12, color: COLORS.textMuted },
  openRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  openDot:    { width: 6, height: 6, borderRadius: 3 },
  openText:   { fontSize: 11, fontWeight: '600' },

  heartBtn:  { padding: 4 },
  heartIcon: { fontSize: 20 },

  divider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: 16 },

  couponArea: { padding: 12, gap: 8 },
  couponAreaLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  chipRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1,
  },
  chipEmoji: { fontSize: 13 },
  chipLabel: { fontSize: 12, fontWeight: '700', maxWidth: 100 },
  moreChip: {
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
    justifyContent: 'center',
  },
  moreChipText: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },

  noCouponArea: {
    paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center',
  },
  noCouponText: { fontSize: 12, color: COLORS.textMuted },

  // ── 빈 상태 ──
  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  emptyDesc:  { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 8,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
