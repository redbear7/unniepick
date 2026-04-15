import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';
import { fetchStore, StoreRow } from '../../lib/services/storeService';
import {
  fetchStoreActiveCoupons,
  getCouponKindConfig,
  CouponRow,
} from '../../lib/services/couponService';
import { getOrCreateStampCard, StampCardRow } from '../../lib/services/stampService';
import {
  isFavorite, toggleFavorite, recordStoreView,
} from '../../lib/services/favoriteService';
import { getSession } from '../../lib/services/authService';
import { useMiniPlayerPadding } from '../../hooks/useMiniPlayerPadding';

export default function StoreHomeScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const storeId: string = route.params?.storeId;
  const bottomPad = useMiniPlayerPadding();

  const [store,     setStore]     = useState<StoreRow | null>(null);
  const [coupons,   setCoupons]   = useState<CouponRow[]>([]);
  const [stampCard, setStampCard] = useState<StampCardRow | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [userId,    setUserId]    = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadAll(); }, [storeId]);

  const loadAll = async () => {
    try {
      const [storeData, couponData] = await Promise.all([
        fetchStore(storeId),
        fetchStoreActiveCoupons(storeId),
      ]);
      setStore(storeData);
      setCoupons(couponData);

      const session = await getSession();
      if (session) {
        setUserId(session.user.id);
        const [card, fav] = await Promise.all([
          getOrCreateStampCard(session.user.id, storeId),
          isFavorite(session.user.id, storeId),
        ]);
        setStampCard(card);
        setFavorited(fav);
        // 최근 본 가게 기록
        recordStoreView(session.user.id, storeId).catch(() => {});
      }
    } catch (e) {
      console.error('StoreHome 로드 오류:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const handleFavoriteToggle = async () => {
    if (!userId) {
      Alert.alert('로그인 필요', '찜 기능은 로그인 후 이용할 수 있어요');
      return;
    }
    const next = await toggleFavorite(userId, storeId);
    setFavorited(next);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ flex: 1 }} color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!store) {
    return (
      <SafeAreaView style={styles.safe}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>가게 정보를 불러올 수 없어요</Text>
        </View>
      </SafeAreaView>
    );
  }

  const stampCount    = stampCard?.stamp_count ?? 0;
  const requiredCount = stampCard?.required_count ?? 10;
  const stampPct      = Math.min(stampCount / requiredCount, 1);

  return (
    <SafeAreaView style={styles.safe}>
      {/* 네비게이션 바 */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.favBtn} onPress={handleFavoriteToggle}>
          <Text style={styles.favIcon}>{favorited ? '❤️' : '🤍'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: bottomPad }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── 가게 헤더 카드 ── */}
        <View style={[styles.storeCard, SHADOW.card]}>
          <View style={styles.storeTop}>
            <View style={styles.storeEmojiWrap}>
              <Text style={styles.storeEmoji}>{store.emoji || '🏪'}</Text>
            </View>
            <View style={styles.storeInfo}>
              <Text style={styles.storeName}>{store.name}</Text>
              <Text style={styles.storeCategory}>{store.category}</Text>
              <View style={styles.openRow}>
                <View style={[styles.openDot, { backgroundColor: store.is_open ? COLORS.success : '#CCC' }]} />
                <Text style={[styles.openLabel, { color: store.is_open ? COLORS.success : COLORS.textMuted }]}>
                  {store.is_open ? '영업중' : '영업종료'}
                </Text>
              </View>
            </View>
          </View>

          {/* 주소 */}
          {!!store.address && (
            <View style={styles.storeDetailRow}>
              <Text style={styles.storeDetailIcon}>📍</Text>
              <Text style={styles.storeDetailText}>{store.address}</Text>
            </View>
          )}

          {/* 영업시간 */}
          {(!!store.open_time || !!store.close_time) && (
            <View style={styles.storeDetailRow}>
              <Text style={styles.storeDetailIcon}>🕐</Text>
              <Text style={styles.storeDetailText}>
                {store.open_time ?? ''} ~ {store.close_time ?? ''}
              </Text>
            </View>
          )}

          {/* 전화 */}
          {!!store.phone && (
            <View style={styles.storeDetailRow}>
              <Text style={styles.storeDetailIcon}>📞</Text>
              <Text style={styles.storeDetailText}>{store.phone}</Text>
            </View>
          )}

          {/* 한줄 소개 */}
          {!!store.description && (
            <View style={[styles.storeDescBox]}>
              <Text style={styles.storeDescText}>{store.description}</Text>
            </View>
          )}
        </View>

        {/* ── 스탬프 카드 ── */}
        <View style={[styles.section, SHADOW.card]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🍀 내 스탬프</Text>
            {stampCard && (
              <Text style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeBig}>{stampCount}</Text>/{requiredCount}
              </Text>
            )}
          </View>

          {userId ? (
            <>
              {/* 프로그레스 바 */}
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${Math.round(stampPct * 100)}%` }]} />
              </View>

              {/* 스탬프 그리드 */}
              <View style={styles.stampGrid}>
                {Array.from({ length: requiredCount }).map((_, i) => (
                  <View
                    key={i}
                    style={[styles.stamp, i < stampCount && styles.stampFilled]}
                  >
                    {i < stampCount
                      ? <Text style={styles.stampDone}>🍖</Text>
                      : <Text style={styles.stampEmpty}>{i + 1}</Text>
                    }
                  </View>
                ))}
              </View>

              {/* 리워드 메시지 */}
              <Text style={styles.stampHint}>
                {stampCount >= requiredCount
                  ? '🎉 리워드 쿠폰이 발급됩니다!'
                  : `${requiredCount - stampCount}개 더 모으면 리워드 쿠폰 발급!`}
              </Text>

              {/* 적립 방법 */}
              <View style={styles.stampInfoBox}>
                <Text style={styles.stampInfoTitle}>📌 자동 적립 방법</Text>
                <Text style={styles.stampInfoItem}>• 이 가게의 쿠폰 사용 완료 시</Text>
                <Text style={styles.stampInfoItem}>• 방문 후 영수증 인증 시</Text>
                <Text style={styles.stampInfoNote}>* 동일 가게 12시간 이후 재적립 가능</Text>
              </View>
            </>
          ) : (
            <TouchableOpacity
              style={styles.loginPrompt}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.loginPromptText}>로그인하면 스탬프를 모을 수 있어요 →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── 발행 중인 쿠폰 ── */}
        <View style={styles.couponSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🎟 발행 중인 쿠폰</Text>
            <Text style={styles.sectionBadge}>{coupons.length}개</Text>
          </View>

          {coupons.length === 0 ? (
            <View style={styles.noCouponBox}>
              <Text style={styles.noCouponText}>현재 발행 중인 쿠폰이 없어요</Text>
            </View>
          ) : (
            <View style={styles.couponList}>
              {coupons.map(c => (
                <StoreCouponCard
                  key={c.id}
                  coupon={c}
                  onPress={() => navigation.navigate('CouponDetail', { coupon: c })}
                />
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── 쿠폰 미니 카드 ──────────────────────────────────────────────────
function StoreCouponCard({ coupon, onPress }: { coupon: CouponRow; onPress: () => void }) {
  const kind      = getCouponKindConfig(coupon.coupon_kind);
  const remaining = coupon.total_quantity - coupon.issued_count;
  const discountText =
    coupon.discount_type === 'percent'
      ? `${coupon.discount_value}% 할인`
      : coupon.discount_value > 0
        ? `${coupon.discount_value.toLocaleString()}원 할인`
        : '무료 제공';
  const expiryText = new Date(coupon.expires_at).toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric',
  });

  return (
    <TouchableOpacity
      style={[scc.card, SHADOW.card]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[scc.left, { backgroundColor: kind.bg }]}>
        <Text style={scc.leftEmoji}>{kind.emoji}</Text>
        <Text style={scc.leftLabel}>{kind.label}</Text>
      </View>
      <View style={scc.right}>
        <Text style={scc.title} numberOfLines={1}>{coupon.title}</Text>
        <View style={[scc.chip, { backgroundColor: kind.subBg }]}>
          <Text style={[scc.chipText, { color: kind.bg }]}>{discountText}</Text>
        </View>
        <View style={scc.meta}>
          <Text style={scc.expiry}>~{expiryText}</Text>
          <Text style={scc.qty}>잔여 {remaining}명</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const scc = StyleSheet.create({
  card:      { flexDirection: 'row', backgroundColor: COLORS.white,
               borderRadius: RADIUS.md, overflow: 'hidden' },
  left:      { width: 60, alignItems: 'center', justifyContent: 'center',
               paddingVertical: 12, gap: 3 },
  leftEmoji: { fontSize: 20 },
  leftLabel: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  right:     { flex: 1, padding: 10, gap: 4 },
  title:     { fontSize: 13, fontWeight: '700', color: COLORS.text },
  chip:      { alignSelf: 'flex-start', borderRadius: 6,
               paddingHorizontal: 7, paddingVertical: 2 },
  chipText:  { fontSize: 11, fontWeight: '800' },
  meta:      { flexDirection: 'row', justifyContent: 'space-between' },
  expiry:    { fontSize: 11, color: COLORS.primary },
  qty:       { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
});

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: COLORS.background },
  navBar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
  },
  backBtn:  { padding: 8 },
  backText: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  favBtn:   { padding: 8 },
  favIcon:  { fontSize: 26 },

  container: { paddingHorizontal: 16, paddingTop: 8, gap: 14 },

  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 15, color: COLORS.textMuted },

  // ── 가게 카드 ──
  storeCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 20, gap: 10,
  },
  storeTop: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  storeEmojiWrap: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
  },
  storeEmoji:    { fontSize: 32 },
  storeInfo:     { flex: 1, gap: 4 },
  storeName:     { fontSize: 20, fontWeight: '800', color: COLORS.text },
  storeCategory: { fontSize: 13, color: COLORS.textMuted },
  openRow:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  openDot:       { width: 7, height: 7, borderRadius: 4 },
  openLabel:     { fontSize: 12, fontWeight: '700' },

  storeDetailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  storeDetailIcon:{ fontSize: 14, marginTop: 1 },
  storeDetailText:{ flex: 1, fontSize: 13, color: COLORS.textMuted, lineHeight: 20 },

  storeDescBox: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm, padding: 10, marginTop: 4,
  },
  storeDescText: { fontSize: 13, color: COLORS.text, lineHeight: 20 },

  // ── 스탬프 섹션 ──
  section: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    padding: 20, gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  sectionBadge: { fontSize: 13, color: COLORS.textMuted },
  sectionBadgeBig: { fontSize: 22, fontWeight: '800', color: COLORS.primary },

  progressBg: {
    height: 8, backgroundColor: COLORS.secondary, borderRadius: 4, overflow: 'hidden',
  },
  progressFill: { height: 8, backgroundColor: COLORS.primary, borderRadius: 4 },

  stampGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  stamp: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: COLORS.secondary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.border,
  },
  stampFilled: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  stampDone:   { fontSize: 20 },
  stampEmpty:  { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },

  stampHint: { fontSize: 13, color: COLORS.primary, fontWeight: '700', textAlign: 'center' },

  stampInfoBox: {
    backgroundColor: COLORS.background, borderRadius: RADIUS.sm,
    padding: 12, gap: 4,
  },
  stampInfoTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  stampInfoItem:  { fontSize: 12, color: COLORS.textMuted, lineHeight: 20 },
  stampInfoNote:  { fontSize: 11, color: COLORS.textMuted, marginTop: 4, fontStyle: 'italic' },

  loginPrompt: {
    backgroundColor: COLORS.primary + '18',
    borderRadius: RADIUS.md, padding: 14, alignItems: 'center',
  },
  loginPromptText: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },

  // ── 쿠폰 섹션 ──
  couponSection: { gap: 10 },
  couponList:    { gap: 8 },
  noCouponBox:   {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    padding: 20, alignItems: 'center',
  },
  noCouponText: { fontSize: 13, color: COLORS.textMuted },
});
