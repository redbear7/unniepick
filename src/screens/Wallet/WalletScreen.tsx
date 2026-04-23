/**
 * WalletScreen — Spec 01 §04 통합 지갑
 *
 * 탭 1: 근처  — 현재 위치 반경 300m 내 활성 쿠폰
 * 탭 2: 전체  — 모든 활성 쿠폰 (거리 포함)
 * 탭 3: 사용완료 — 사용/노쇼/리딤 처리된 쿠폰 히스토리
 * 탭 4: 만료  — 취소·만료된 쿠폰
 *
 * 활성 탭: D-day 게이지 · D-3 빨간 뱃지 · 롱프레스 → Redeem
 * 히스토리 탭: 기존 카드 디자인 (컬러 배너 + 상태 표시)
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import {
  getAllWalletCoupons,
  getNearbyWalletCoupons,
  WalletCoupon,
  CAT_EMOJI,
  CAT_COLOR,
} from '../../lib/services/couponWalletService';
import { PALETTE } from '../../constants/theme';
import CouponRowCard from './CouponRowCard';

const SCREEN_W      = Dimensions.get('window').width;
const NEARBY_RADIUS = 300;

// ── 탭 정의 ───────────────────────────────────────────────────────
type TabKey = 'nearby' | 'all' | 'used' | 'expired';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'nearby',  label: '근처' },
  { key: 'all',     label: '전체' },
  { key: 'used',    label: '사용완료' },
  { key: 'expired', label: '만료' },
];
const TAB_W = SCREEN_W / TABS.length;

// ── 히스토리 쿠폰 타입 ────────────────────────────────────────────
interface HistoryCoupon {
  id:       string;
  status:   string;
  used_at:  string | null;
  coupon: {
    id:         string;
    title:      string;
    expires_at: string;
    store: { id: string; name: string; category: string } | null;
  };
}

// ── 카드 색상 헬퍼 ────────────────────────────────────────────────
function cardBg(category: string | undefined): string {
  return CAT_COLOR[category ?? ''] ?? CAT_COLOR.etc ?? '#5B67CA';
}

function dDayFraction(expiresAt: string): { dDay: number; fraction: number } {
  const msLeft   = new Date(expiresAt).getTime() - Date.now();
  const dDay     = Math.ceil(msLeft / 86_400_000);
  const fraction = Math.max(0, Math.min(1, msLeft / (30 * 86_400_000)));
  return { dDay, fraction };
}

function expiryLabel(iso: string): string {
  const d       = new Date(iso);
  const msLeft  = d.getTime() - Date.now();
  const dDay    = Math.ceil(msLeft / 86_400_000);
  if (dDay <= 0) return '⏰ 오늘 마감';
  if (dDay === 1) return '⏰ 내일 마감';
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `📅 ~${d.getFullYear()}.${m}.${dd}`;
}

// ── 히스토리 카드 ─────────────────────────────────────────────────
function HistoryCard({ item }: { item: HistoryCoupon }) {
  const store    = item.coupon.store;
  const cat      = store?.category ?? 'etc';
  const emoji    = CAT_EMOJI[cat] ?? '🏪';
  const bg       = cardBg(cat);
  const isUsed   = ['used', 'noshow', 'redeemed'].includes(item.status);
  const usedDate = item.used_at
    ? new Date(item.used_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
    : null;

  return (
    <View style={[hc.card, { opacity: 0.7 }]}>
      {/* 컬러 배너 */}
      <View style={[hc.top, { backgroundColor: bg }]}>
        <View style={hc.circle1} />
        <View style={hc.circle2} />
        <Text style={hc.storeName}>{emoji} {store?.name ?? ''}</Text>
        <Text style={hc.title} numberOfLines={2}>{item.coupon.title}</Text>
        <Text style={hc.expiry}>{expiryLabel(item.coupon.expires_at)}</Text>
      </View>
      {/* 하단 상태 */}
      <View style={hc.bottom}>
        <Text style={hc.statusText}>
          {isUsed
            ? usedDate ? `✅ 사용일 ${usedDate}` : '✅ 사용 완료'
            : '⏰ 만료됨'}
        </Text>
        <View style={[hc.badge, { backgroundColor: isUsed ? '#E8F5E9' : PALETTE.gray200 }]}>
          <Text style={[hc.badgeText, { color: isUsed ? '#2E7D32' : PALETTE.gray500 }]}>
            {isUsed ? '사용 완료' : '만료'}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── 빈 상태 ──────────────────────────────────────────────────────
const EMPTY: Record<TabKey, { emoji: string; title: string; sub: string }> = {
  nearby:  { emoji: '📍', title: '근처에 쿠폰이 없어요',    sub: '반경을 넓히거나 이동해보세요' },
  all:     { emoji: '🎟', title: '저장된 쿠폰이 없어요',    sub: '가게를 팔로우하고 쿠폰을 받아보세요' },
  used:    { emoji: '✅', title: '사용한 쿠폰이 없어요',     sub: '쿠폰을 사용하면 여기에 기록돼요' },
  expired: { emoji: '⏰', title: '만료된 쿠폰이 없어요',    sub: '' },
};
function EmptyState({ tab, onBrowse }: { tab: TabKey; onBrowse?: () => void }) {
  const m = EMPTY[tab];
  return (
    <View style={s.empty}>
      <Text style={s.emptyEmoji}>{m.emoji}</Text>
      <Text style={s.emptyTitle}>{m.title}</Text>
      {m.sub ? <Text style={s.emptySub}>{m.sub}</Text> : null}
      {tab === 'nearby' && onBrowse && (
        <TouchableOpacity style={s.emptyBtn} onPress={onBrowse}>
          <Text style={s.emptyBtnText}>전체 쿠폰 보기</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════
//  메인 화면
// ══════════════════════════════════════════════════════════════════
export default function WalletScreen() {
  const navigation  = useNavigation<any>();
  const [tab,        setTab]      = useState<TabKey>('nearby');
  const [nearby,     setNearby]   = useState<WalletCoupon[]>([]);
  const [all,        setAll]      = useState<WalletCoupon[]>([]);
  const [usedList,   setUsed]     = useState<HistoryCoupon[]>([]);
  const [expiredList,setExpired]  = useState<HistoryCoupon[]>([]);
  const [loading,    setLoading]  = useState(true);
  const [refreshing, setRefresh]  = useState(false);
  const [userLoc,    setUserLoc]  = useState<{ lat: number; lng: number } | null>(null);

  // 탭 인디케이터 (0~3)
  const tabAnim = useRef(new Animated.Value(0)).current;

  // ── 위치 획득 ─────────────────────────────────────────────────
  const acquireLocation = useCallback(async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return { lat: loc.coords.latitude, lng: loc.coords.longitude };
    } catch {
      return null;
    }
  }, []);

  // ── 데이터 로드 ────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) { setLoading(false); return; }

    const loc = await acquireLocation();
    if (loc) setUserLoc(loc);

    // 활성 쿠폰 (근처/전체)
    const [nearbyRes, allRes] = await Promise.allSettled([
      loc
        ? getNearbyWalletCoupons(uid, loc.lat, loc.lng, NEARBY_RADIUS)
        : Promise.resolve([]),
      getAllWalletCoupons(uid, loc?.lat, loc?.lng),
    ]);
    if (nearbyRes.status === 'fulfilled') setNearby(nearbyRes.value);
    if (allRes.status   === 'fulfilled') {
      setAll(allRes.value.filter(c =>
        ['active', 'issued', 'available'].includes(c.status)
      ));
    }

    // 히스토리 쿠폰 (사용완료 + 만료) — 직접 조회
    const { data: hist } = await supabase
      .from('user_coupons')
      .select('id, status, used_at, coupon:coupons(id, title, expires_at, store:stores(id, name, category))')
      .eq('user_id', uid)
      .not('status', 'in', '("issued","available","active")')
      .order('received_at', { ascending: false });

    const histList = (hist ?? []) as unknown as HistoryCoupon[];

    setUsed(histList.filter(c =>
      ['used', 'noshow', 'redeemed'].includes(c.status)
    ));
    setExpired(histList.filter(c => {
      if (['cancelled', 'expired'].includes(c.status)) return true;
      // available 상태인데 만료된 경우
      if (c.status === 'available' && new Date(c.coupon.expires_at) < new Date()) return true;
      return false;
    }));

    setLoading(false);
  }, [acquireLocation]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

  const onRefresh = async () => {
    setRefresh(true);
    await load();
    setRefresh(false);
  };

  // ── 탭 전환 ───────────────────────────────────────────────────
  const switchTab = (t: TabKey) => {
    setTab(t);
    const idx = TABS.findIndex(x => x.key === t);
    Animated.spring(tabAnim, {
      toValue:         idx,
      useNativeDriver: false,
      tension:         200,
      friction:        20,
    }).start();
  };

  // ── 카운트 ────────────────────────────────────────────────────
  const counts: Record<TabKey, number> = {
    nearby:  nearby.length,
    all:     all.length,
    used:    usedList.length,
    expired: expiredList.length,
  };

  const activeN = all.length;

  // ── 사용하기 / 상세 ──────────────────────────────────────────
  const openRedeem = (c: WalletCoupon) => navigation.navigate('Redeem', { coupon: c });
  const openDetail = (c: WalletCoupon) => navigation.navigate('CouponDetail', { couponId: c.coupon_id });

  // ── 현재 탭 리스트 ────────────────────────────────────────────
  const isHistoryTab = tab === 'used' || tab === 'expired';
  const historyList  = tab === 'used' ? usedList : expiredList;
  const activeList   = tab === 'nearby' ? nearby : all;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>

      {/* 헤더 */}
      <View style={s.header}>
        <Text style={s.headerTitle}>내 쿠폰함</Text>
        <Text style={s.headerSub}>사용 가능 {activeN}장</Text>
      </View>

      {/* 탭 바 */}
      <View style={s.tabBar}>
        {TABS.map((t, i) => {
          const active = tab === t.key;
          const cnt    = counts[t.key];
          return (
            <TouchableOpacity
              key={t.key}
              style={s.tabItem}
              onPress={() => switchTab(t.key)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>
                {t.label}{cnt > 0 ? ` (${cnt})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
        {/* 슬라이딩 인디케이터 */}
        <Animated.View style={[s.tabIndicator, {
          left: tabAnim.interpolate({
            inputRange:  [0, 1, 2, 3],
            outputRange: ['0%', '25%', '50%', '75%'],
          }),
        }]} />
      </View>

      {/* 리스트 */}
      {loading ? (
        <View style={s.loadBox}>
          <ActivityIndicator color={PALETTE.orange500} />
        </View>
      ) : isHistoryTab ? (
        // ── 히스토리 탭 (FlatList) ────────────────────────────
        <FlatList
          data={historyList}
          keyExtractor={c => c.id}
          contentContainerStyle={historyList.length === 0 ? { flex: 1 } : s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PALETTE.orange500} />
          }
          ListEmptyComponent={<EmptyState tab={tab} />}
          renderItem={({ item }) => <HistoryCard item={item} />}
        />
      ) : (
        // ── 활성 탭 (ScrollView + CouponRowCard) ─────────────
        <FlatList
          data={activeList}
          keyExtractor={c => c.user_coupon_id}
          contentContainerStyle={activeList.length === 0 ? { flex: 1 } : s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PALETTE.orange500} />
          }
          ListHeaderComponent={tab === 'nearby' && userLoc && activeList.length > 0 ? (
            <View style={s.radiusBadge}>
              <Text style={s.radiusBadgeText}>
                📍 반경 {NEARBY_RADIUS}m 이내 · {nearby.length}장
              </Text>
            </View>
          ) : null}
          ListEmptyComponent={<EmptyState tab={tab} onBrowse={() => switchTab('all')} />}
          renderItem={({ item }) => (
            <CouponRowCard
              coupon={item}
              onPress={() => openDetail(item)}
              onLongPress={() => openRedeem(item)}
              urgent={item.days_left <= 3}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════
//  히스토리 카드 스타일
// ══════════════════════════════════════════════════════════════════
const hc = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  top: {
    padding: 20,
    paddingBottom: 22,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 120,
    justifyContent: 'flex-end',
  },
  circle1: {
    position: 'absolute', width: 140, height: 140,
    borderRadius: 70, right: -30, top: -50,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  circle2: {
    position: 'absolute', width: 90, height: 90,
    borderRadius: 45, right: 40, top: -20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  storeName: {
    fontSize: 12, fontFamily: 'WantedSans-Bold',
    color: 'rgba(255,255,255,0.9)', marginBottom: 4,
  },
  title: {
    fontSize: 20, fontFamily: 'WantedSans-Black',
    color: '#FFFFFF', letterSpacing: -0.4,
    lineHeight: 26, marginBottom: 8,
  },
  expiry: {
    fontSize: 12, fontFamily: 'WantedSans-Medium',
    color: 'rgba(255,255,255,0.8)',
  },
  bottom: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 16,
  },
  statusText: {
    fontSize: 13, fontFamily: 'WantedSans-SemiBold',
    color: PALETTE.gray600,
  },
  badge: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12, fontFamily: 'WantedSans-Bold',
  },
});

// ══════════════════════════════════════════════════════════════════
//  메인 스타일
// ══════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.gray100 },

  header: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontFamily: 'WantedSans-ExtraBold', fontSize: 22,
    lineHeight: 28, color: PALETTE.gray900, letterSpacing: -0.6,
  },
  headerSub: {
    fontFamily: 'WantedSans-Medium', fontSize: 12,
    lineHeight: 17, color: PALETTE.gray500, marginTop: 3,
  },

  tabBar: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: PALETTE.gray200,
    position: 'relative',
  },
  tabItem: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
  },
  tabLabel: {
    fontFamily: 'WantedSans-Bold', fontSize: 13,
    lineHeight: 18, color: PALETTE.gray500, letterSpacing: -0.2,
  },
  tabLabelActive: { color: PALETTE.orange500 },
  tabIndicator: {
    position: 'absolute', bottom: 0,
    width: '25%',   // 4탭 기준
    height: 2.5, backgroundColor: PALETTE.orange500, borderRadius: 2,
  },

  loadBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  listContent: {
    padding: 16, paddingBottom: 100,
  },

  radiusBadge: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: PALETTE.orange50, borderRadius: 999,
    alignSelf: 'flex-start', marginBottom: 10,
  },
  radiusBadgeText: {
    fontFamily: 'WantedSans-SemiBold', fontSize: 11,
    lineHeight: 16, color: PALETTE.orange500, letterSpacing: -0.1,
  },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 60, gap: 8,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 8 },
  emptyTitle: {
    fontFamily: 'WantedSans-ExtraBold', fontSize: 16,
    lineHeight: 22, color: PALETTE.gray900, textAlign: 'center',
  },
  emptySub: {
    fontFamily: 'WantedSans-Medium', fontSize: 13,
    lineHeight: 19, color: PALETTE.gray500, textAlign: 'center',
  },
  emptyBtn: {
    marginTop: 12, paddingVertical: 10, paddingHorizontal: 24,
    backgroundColor: PALETTE.gray100, borderRadius: 999,
  },
  emptyBtnText: {
    fontFamily: 'WantedSans-Bold', fontSize: 13,
    lineHeight: 18, color: PALETTE.gray700,
  },
});
