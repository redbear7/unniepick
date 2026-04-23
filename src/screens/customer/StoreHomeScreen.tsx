import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Linking,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
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
import { supabase } from '../../lib/supabase';
import { notifyAdmin } from '../../lib/services/pushService';

interface PriceReport {
  id:             string;
  menu_name:      string;
  price:          number;
  note:           string | null;
  created_at:     string;
  agree_count:    number;
  disagree_count: number;
  myVote?:        'agree' | 'disagree' | null;  // 현재 유저 투표
}

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
  const [priceReports,  setPriceReports]  = useState<PriceReport[]>([]);
  const [voteToast,     setVoteToast]     = useState(false);
  const [votingId,      setVotingId]      = useState<string | null>(null);

  useEffect(() => { loadAll(); }, [storeId]);

  const loadPriceReports = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;

      // 제보 목록 (active만)
      const { data: reports } = await supabase
        .from('price_reports')
        .select('id, menu_name, price, note, created_at, agree_count, disagree_count')
        .eq('store_id', storeId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!reports?.length) { setPriceReports([]); return; }

      // 내 투표 일괄 조회
      let myVoteMap: Record<string, 'agree' | 'disagree'> = {};
      if (uid) {
        const reportIds = reports.map(r => r.id);
        const { data: votes } = await supabase
          .from('price_report_votes')
          .select('report_id, vote')
          .eq('user_id', uid)
          .in('report_id', reportIds);
        (votes ?? []).forEach((v: any) => { myVoteMap[v.report_id] = v.vote; });
      }

      setPriceReports(reports.map(r => ({
        ...r,
        agree_count:    r.agree_count    ?? 0,
        disagree_count: r.disagree_count ?? 0,
        myVote: myVoteMap[r.id] ?? null,
      })));
    } catch { /* 조용히 실패 */ }
  }, [storeId]);

  // 맞아요 / 틀려요 투표
  const handleVote = useCallback(async (reportId: string, vote: 'agree' | 'disagree') => {
    if (!userId) {
      Alert.alert('로그인 필요', '투표는 로그인 후 이용할 수 있어요.');
      return;
    }

    setVotingId(reportId);

    // 낙관적 업데이트
    setPriceReports(prev => prev.map(r => {
      if (r.id !== reportId) return r;
      const wasAgree    = r.myVote === 'agree';
      const wasDisagree = r.myVote === 'disagree';
      const isSame      = r.myVote === vote;

      // 같은 버튼 재클릭 → 취소
      if (isSame) {
        return {
          ...r,
          myVote:         null,
          agree_count:    vote === 'agree'    ? Math.max(0, r.agree_count - 1)    : r.agree_count,
          disagree_count: vote === 'disagree' ? Math.max(0, r.disagree_count - 1) : r.disagree_count,
        };
      }
      return {
        ...r,
        myVote:         vote,
        agree_count:    vote === 'agree'
          ? r.agree_count + 1
          : wasAgree ? Math.max(0, r.agree_count - 1) : r.agree_count,
        disagree_count: vote === 'disagree'
          ? r.disagree_count + 1
          : wasDisagree ? Math.max(0, r.disagree_count - 1) : r.disagree_count,
      };
    }));

    try {
      const existing = priceReports.find(r => r.id === reportId);
      const isSame   = existing?.myVote === vote;

      if (isSame) {
        // 취소 (삭제)
        await supabase
          .from('price_report_votes')
          .delete()
          .eq('report_id', reportId)
          .eq('user_id', userId);
      } else {
        // 신규 or 변경 (upsert)
        await supabase
          .from('price_report_votes')
          .upsert({ report_id: reportId, user_id: userId, vote }, { onConflict: 'report_id,user_id' });
      }

      // 관리자 알림 (틀려요 or 처음 맞아요)
      const report = priceReports.find(r => r.id === reportId);
      if (report) {
        const storeName = store?.name ?? '가게';
        const voteLabel = vote === 'agree' ? '✅ 맞아요' : '❌ 틀려요';
        notifyAdmin(
          `💰 가격 제보 ${voteLabel}`,
          `${storeName} · ${report.menu_name} ${report.price.toLocaleString()}원`,
          { type: 'price_vote', storeId, reportId, vote },
        ).catch(() => {}); // best-effort
      }

      // 토스트: 관리자에게 알렸습니다
      setVoteToast(true);
      setTimeout(() => setVoteToast(false), 2500);
    } catch {
      // 실패 시 낙관적 업데이트 롤백
      await loadPriceReports();
    } finally {
      setVotingId(null);
    }
  }, [userId, priceReports, storeId, store]);

  const loadAll = async () => {
    try {
      const [storeData, couponData] = await Promise.all([
        fetchStore(storeId),
        fetchStoreActiveCoupons(storeId),
        loadPriceReports(),
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
      {/* 관리자 알림 토스트 */}
      {voteToast && (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>📣 관리자에게 알렸습니다</Text>
        </View>
      )}

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

          {/* 위치 지도 썸네일 → 언니픽 지도로 이동 */}
          {!!store.latitude && !!store.longitude && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate('CustomerTabs', {
                screen:  'MapTab',
                params: {
                  focusLat:   store.latitude,
                  focusLng:   store.longitude,
                  focusStore: store.id,
                },
              })}
            >
              <View style={styles.mapWrap}>
                <MapView
                  provider={PROVIDER_DEFAULT}
                  style={styles.mapView}
                  initialRegion={{
                    latitude: store.latitude,
                    longitude: store.longitude,
                    latitudeDelta: 0.004,
                    longitudeDelta: 0.004,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  pointerEvents="none"
                >
                  <Marker
                    coordinate={{ latitude: store.latitude, longitude: store.longitude }}
                    title={store.name}
                  />
                </MapView>
                <View style={styles.mapOverlay}>
                  <Text style={styles.mapOverlayText}>🗺 언니픽 지도로 보기</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* A사 플레이스 링크 */}
          {!!store.naver_place_url && (
            <TouchableOpacity
              style={styles.naverBtn}
              onPress={() => Linking.openURL(store.naver_place_url!)}
              activeOpacity={0.75}
            >
              <Text style={styles.naverBtnText}>A사 업체정보</Text>
            </TouchableOpacity>
          )}

          {/* 한줄 소개 */}
          {!!store.description && (
            <View style={[styles.storeDescBox]}>
              <Text style={styles.storeDescText}>{store.description}</Text>
            </View>
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

        {/* ── 가격 정보 ── */}
        <View style={[styles.section, SHADOW.card]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>💰 가격 정보</Text>
            <TouchableOpacity
              style={styles.reportBtn}
              onPress={() => navigation.navigate('ReceiptReview', {
                prefilledStoreId:   storeId,
                prefilledStoreName: store.name,
              })}
              activeOpacity={0.8}
            >
              <Text style={styles.reportBtnText}>🧾 영수증 리뷰</Text>
            </TouchableOpacity>
          </View>

          {/* 대표 가격 (DB 직접 설정값) */}
          {store.representative_price != null && (
            <View style={styles.repPriceRow}>
              <View style={styles.repPriceBadge}>
                <Text style={styles.repPriceLabel}>대표 메뉴</Text>
                <Text style={styles.repPriceValue}>
                  {store.price_label ?? `${store.representative_price.toLocaleString()}원~`}
                </Text>
              </View>
              {store.price_range && (
                <View style={styles.rangeBadge}>
                  <Text style={styles.rangeBadgeText}>{store.price_range}</Text>
                </View>
              )}
            </View>
          )}

          {/* 고객 제보 목록 */}
          {priceReports.length > 0 ? (
            <View style={styles.reportList}>
              <Text style={styles.reportListTitle}>👥 고객 제보</Text>
              {priceReports.map((r) => {
                const isVoting = votingId === r.id;
                return (
                  <View key={r.id} style={styles.reportRow}>
                    {/* 메뉴 + 가격 */}
                    <View style={styles.reportTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reportMenu}>{r.menu_name}</Text>
                        {r.note ? (
                          <Text style={styles.reportNote} numberOfLines={1}>{r.note}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.reportPrice}>
                        {r.price.toLocaleString()}원
                      </Text>
                    </View>
                    {/* 맞아요 / 틀려요 */}
                    <View style={styles.voteRow}>
                      <TouchableOpacity
                        style={[
                          styles.voteBtn,
                          r.myVote === 'agree' && styles.voteBtnAgreeActive,
                        ]}
                        onPress={() => handleVote(r.id, 'agree')}
                        disabled={isVoting}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.voteBtnText,
                          r.myVote === 'agree' && styles.voteBtnTextAgreeActive,
                        ]}>
                          👍 맞아요 {r.agree_count > 0 ? r.agree_count : ''}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.voteBtn,
                          r.myVote === 'disagree' && styles.voteBtnDisagreeActive,
                        ]}
                        onPress={() => handleVote(r.id, 'disagree')}
                        disabled={isVoting}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.voteBtnText,
                          r.myVote === 'disagree' && styles.voteBtnTextDisagreeActive,
                        ]}>
                          👎 틀려요 {r.disagree_count > 0 ? r.disagree_count : ''}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            store.representative_price == null && (
              <TouchableOpacity
                style={styles.emptyReport}
                onPress={() => navigation.navigate('PriceReport', {
                  storeId,
                  storeName: store.name,
                })}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyReportText}>
                  아직 가격 정보가 없어요.{'\n'}첫 번째로 제보해보세요! 💪
                </Text>
              </TouchableOpacity>
            )
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

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── 쿠폰 미니 카드 ──────────────────────────────────────────────────
function StoreCouponCard({ coupon, onPress }: { coupon: CouponRow; onPress: () => void }) {
  const kind      = getCouponKindConfig(coupon.coupon_kind);
  const remaining = (coupon.total_quantity ?? 0) - coupon.issued_count;
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

  // ── 지도 썸네일 ──
  mapWrap: {
    width: '100%',
    height: 140,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginTop: 2,
  },
  mapView: {
    width: '100%',
    height: '100%',
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.38)',
    paddingVertical: 6,
    alignItems: 'center',
  },
  mapOverlayText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },

  naverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#03C75A18',
    borderWidth: 1,
    borderColor: '#03C75A40',
    borderRadius: RADIUS.sm,
    paddingVertical: 9,
    paddingHorizontal: 14,
    marginTop: 2,
  },
  naverBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#03C75A',
    letterSpacing: -0.2,
  },

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

  // ── 가격 정보 섹션 ──
  reportBtn: {
    backgroundColor: COLORS.primary,
    borderRadius:    8,
    paddingHorizontal: 10,
    paddingVertical:    5,
  },
  reportBtnText: {
    fontSize: 12, fontWeight: '700', color: '#FFFFFF',
  },
  repPriceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.secondary,
    borderRadius: 10, padding: 12,
  },
  repPriceBadge: { flex: 1 },
  repPriceLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  repPriceValue: { fontSize: 18, fontWeight: '800', color: COLORS.primary, marginTop: 2 },
  rangeBadge: {
    backgroundColor: COLORS.primary + '22',
    borderRadius:    6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  rangeBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  reportList: { gap: 8, marginTop: 4 },
  reportListTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, marginBottom: 4 },
  reportRow: {
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: COLORS.background,
    borderRadius: 8, gap: 8,
  },
  reportTop: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  reportMenu: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  reportNote: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  reportPrice: { fontSize: 15, fontWeight: '800', color: COLORS.primary, flexShrink: 0 },

  // 맞아요 / 틀려요
  voteRow: { flexDirection: 'row', gap: 8 },
  voteBtn: {
    flex: 1, paddingVertical: 7, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  voteBtnAgreeActive: {
    backgroundColor: '#E8F5E9', borderColor: '#4CAF50',
  },
  voteBtnDisagreeActive: {
    backgroundColor: '#FFEBEE', borderColor: '#EF5350',
  },
  voteBtnText: {
    fontSize: 12, fontWeight: '700', color: COLORS.textMuted,
  },
  voteBtnTextAgreeActive:    { color: '#2E7D32' },
  voteBtnTextDisagreeActive: { color: '#C62828' },

  // 관리자 알림 토스트
  toast: {
    position: 'absolute', top: 60, alignSelf: 'center',
    zIndex: 999,
    backgroundColor: 'rgba(30,30,30,0.88)',
    borderRadius: 24,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  toastText: {
    fontSize: 13, fontWeight: '700', color: '#FFFFFF',
  },

  emptyReport: {
    backgroundColor: COLORS.background,
    borderRadius: 10, padding: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  emptyReportText: {
    fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20,
  },
});
