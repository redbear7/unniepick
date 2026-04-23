/**
 * WalletScreen — 내 쿠폰함 (디자인 목업 A3)
 * 탭: 사용 가능 | 사용 완료 | 만료
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl,
  Animated, Dimensions,
} from 'react-native';

const SCREEN_W    = Dimensions.get('window').width;
const TAB_COUNT   = 3;
const TAB_ITEM_W  = SCREEN_W / TAB_COUNT;

import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { UserCouponRow } from '../../lib/services/couponService';

// ── 테마 ──────────────────────────────────────────────────────────
const C = {
  brand:   '#FF6F0F',
  brandBg: '#FFF3EB',
  g900:    '#191F28',
  g700:    '#4E5968',
  g600:    '#6B7684',
  g500:    '#8B95A1',
  g400:    '#ADB5BD',
  g300:    '#D1D6DB',
  g200:    '#E5E8EB',
  g150:    '#EAECEF',
  g100:    '#F2F4F6',
  g50:     '#F9FAFB',
  red:     '#E53935',
  white:   '#FFFFFF',
};

// ── 카테고리별 카드 색상 ─────────────────────────────────────────
const CAT_CARD_COLOR: Record<string, string> = {
  cafe:   '#FF6F0F',
  food:   '#2D9CDB',
  beauty: '#7B61FF',
  nail:   '#D946B0',
  etc:    '#5B67CA',
};
const CAT_EMOJI: Record<string, string> = {
  cafe: '☕', food: '🍽', beauty: '✂️', nail: '💅', etc: '🏪',
};

function cardColor(store: any): string {
  const cat = store?.category ?? 'etc';
  return CAT_CARD_COLOR[cat] ?? CAT_CARD_COLOR.etc;
}

// ── 탭 정의 ──────────────────────────────────────────────────────
type TabKey = 'available' | 'used' | 'expired';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'available', label: '사용 가능' },
  { key: 'used',      label: '사용 완료' },
  { key: 'expired',   label: '만료' },
];

// ── 헬퍼 ─────────────────────────────────────────────────────────
function formatExpiryLabel(iso: string): string {
  const d    = new Date(iso);
  const msLeft = d.getTime() - Date.now();
  const dDay   = Math.ceil(msLeft / 86_400_000);
  if (dDay <= 0) return '⏰ 오늘 마감';
  if (dDay === 1) return '⏰ 내일 마감';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `📅 ~${y}.${m}.${dd}`;
}

function dDayInfo(iso: string) {
  const msLeft   = new Date(iso).getTime() - Date.now();
  const dDay     = Math.ceil(msLeft / 86_400_000);
  // 30일 기준 진행률 (받은 날 기준이 없으므로 30일 max)
  const fraction = Math.max(0, Math.min(1, msLeft / (30 * 86_400_000)));
  return { dDay, fraction };
}

// ── 빈 상태 ──────────────────────────────────────────────────────
const EMPTY_MSG: Record<TabKey, { emoji: string; title: string; desc: string }> = {
  available: { emoji: '🎟', title: '사용 가능한 쿠폰이 없어요',  desc: '가게를 팔로우하고 쿠폰을 받아보세요' },
  used:      { emoji: '✅', title: '사용한 쿠폰이 없어요',       desc: '쿠폰을 사용하면 여기에 기록돼요' },
  expired:   { emoji: '⏰', title: '만료된 쿠폰이 없어요',       desc: '' },
};
function EmptyState({ tab }: { tab: TabKey }) {
  const m = EMPTY_MSG[tab];
  return (
    <View style={s.emptyWrap}>
      <Text style={s.emptyEmoji}>{m.emoji}</Text>
      <Text style={s.emptyTitle}>{m.title}</Text>
      {m.desc ? <Text style={s.emptyDesc}>{m.desc}</Text> : null}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════
//  쿠폰 카드 (사용 가능)
// ══════════════════════════════════════════════════════════════════
function CouponCard({ item, onPress }: { item: UserCouponRow; onPress: () => void }) {
  const coupon    = item.coupon;
  const store     = (coupon.store as any);
  const storeName = store?.name ?? '';
  const catKey    = store?.category ?? 'etc';
  const emoji     = CAT_EMOJI[catKey] ?? '🏪';
  const bgColor   = cardColor(store);
  const { dDay, fraction } = dDayInfo(coupon.expires_at);
  const isUrgent  = dDay <= 1;
  const expiryLabel = formatExpiryLabel(coupon.expires_at);

  return (
    <View style={s.card}>
      {/* ── 상단 컬러 배너 ── */}
      <View style={[s.cardTop, { backgroundColor: bgColor }]}>
        {/* 장식 원 */}
        <View style={s.cardCircle1} />
        <View style={s.cardCircle2} />

        {/* 가게 이모지 + 이름 */}
        <Text style={s.cardStoreName}>{emoji} {storeName}</Text>
        {/* 쿠폰 제목 */}
        <Text style={s.cardTitle} numberOfLines={2}>{coupon.title}</Text>
        {/* 만료일 */}
        <Text style={[s.cardExpiry, isUrgent && s.cardExpiryUrgent]}>
          {expiryLabel}
        </Text>
      </View>

      {/* ── 하단 흰 영역 ── */}
      <View style={s.cardBottom}>
        <View style={s.cardBarSection}>
          <View style={s.cardBarRow}>
            <Text style={s.cardBarLabel}>만료까지</Text>
            <Text style={[s.cardDDay, isUrgent && { color: C.red }]}>
              {dDay <= 0 ? 'D-0' : `D-${dDay}`}
            </Text>
          </View>
          <View style={s.cardBarTrack}>
            <View style={[s.cardBarFill, {
              width: `${Math.max(4, fraction * 100)}%`,
              backgroundColor: isUrgent ? C.red : bgColor,
            }]} />
          </View>
        </View>

        <TouchableOpacity style={[s.useBtn, { backgroundColor: bgColor }]} onPress={onPress} activeOpacity={0.85}>
          <Text style={s.useBtnText}>사용하기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── 비활성 카드 (완료/만료) ──────────────────────────────────────
function InactiveCard({ item }: { item: UserCouponRow }) {
  const coupon    = item.coupon;
  const store     = (coupon.store as any);
  const storeName = store?.name ?? '';
  const catKey    = store?.category ?? 'etc';
  const emoji     = CAT_EMOJI[catKey] ?? '🏪';
  const bgColor   = cardColor(store);

  return (
    <View style={[s.card, s.cardInactive]}>
      <View style={[s.cardTop, { backgroundColor: bgColor }]}>
        <View style={s.cardCircle1} />
        <View style={s.cardCircle2} />
        <Text style={s.cardStoreName}>{emoji} {storeName}</Text>
        <Text style={s.cardTitle} numberOfLines={2}>{coupon.title}</Text>
        <Text style={s.cardExpiry}>{formatExpiryLabel(coupon.expires_at)}</Text>
      </View>
      <View style={s.cardBottom}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardBarLabel}>
            {item.status === 'used'
              ? `사용일: ${item.used_at ? new Date(item.used_at).toLocaleDateString('ko-KR') : '-'}`
              : '만료됨'}
          </Text>
        </View>
        <View style={[s.useBtn, { backgroundColor: C.g200 }]}>
          <Text style={[s.useBtnText, { color: C.g500 }]}>
            {item.status === 'used' ? '사용 완료' : '만료'}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════
//  메인 화면
// ══════════════════════════════════════════════════════════════════
export default function WalletScreen() {
  const navigation = useNavigation<any>();

  const [tab,        setTab]        = useState<TabKey>('available');
  const [coupons,    setCoupons]    = useState<UserCouponRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId,     setUserId]     = useState<string | null>(null);

  // 탭 언더라인 애니메이션
  const tabAnim = useRef(new Animated.Value(0)).current;
  const animateTab = (idx: number) => {
    Animated.spring(tabAnim, {
      toValue: idx * TAB_ITEM_W,
      useNativeDriver: true,
      speed: 20,
      bounciness: 0,
    }).start();
  };

  useFocusEffect(useCallback(() => { init(); }, []));

  const init = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id ?? null;
    setUserId(uid);
    if (uid) await loadCoupons(uid);
    setLoading(false);
  };

  const loadCoupons = async (uid: string) => {
    const { data } = await supabase
      .from('user_coupons')
      .select('*, coupon:coupons(*, store:stores(id,name,category))')
      .eq('user_id', uid)
      .order('received_at', { ascending: false });
    if (data) setCoupons(data as unknown as UserCouponRow[]);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (userId) await loadCoupons(userId);
    setRefreshing(false);
  }, [userId]);

  // ── 탭별 카운트 ────────────────────────────────────────────────
  const countAvail   = coupons.filter(c => c.status === 'available' && new Date(c.coupon.expires_at) >= new Date()).length;
  const countUsed    = coupons.filter(c => c.status === 'used' || c.status === 'noshow').length;
  const countExpired = coupons.filter(c => c.status === 'cancelled' || (c.status === 'available' && new Date(c.coupon.expires_at) < new Date())).length;
  const tabCounts: Record<TabKey, number> = {
    available: countAvail, used: countUsed, expired: countExpired,
  };

  // ── 쿠폰 필터 ─────────────────────────────────────────────────
  const filteredCoupons = coupons.filter(c => {
    if (tab === 'available') return c.status === 'available' && new Date(c.coupon.expires_at) >= new Date();
    if (tab === 'used')      return c.status === 'used' || c.status === 'noshow';
    if (tab === 'expired')   return c.status === 'cancelled' || (c.status === 'available' && new Date(c.coupon.expires_at) < new Date());
    return false;
  });

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator style={{ flex: 1 }} color={C.brand} />
      </SafeAreaView>
    );
  }

  const tabIdx = TABS.findIndex(t => t.key === tab);

  return (
    <SafeAreaView style={s.safe}>
      {/* ── 앱바 ── */}
      <View style={s.appBar}>
        <Text style={s.appBarTitle}>내 쿠폰함</Text>
        <TouchableOpacity style={s.appBarIcon}>
          <Text style={{ fontSize: 20 }}>📋</Text>
        </TouchableOpacity>
      </View>

      {/* ── 탭 바 ── */}
      <View style={s.tabBar}>
        {TABS.map((t, i) => {
          const active = tab === t.key;
          const cnt    = tabCounts[t.key];
          return (
            <TouchableOpacity
              key={t.key}
              style={s.tabItem}
              onPress={() => { setTab(t.key); animateTab(i); }}
              activeOpacity={0.7}
            >
              <Text style={[s.tabText, active && s.tabTextActive]}>
                {t.label}{cnt > 0 ? ` (${cnt})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* 슬라이딩 언더라인 */}
        <Animated.View
          style={[s.tabUnderline, {
            width: TAB_ITEM_W,
            transform: [{ translateX: tabAnim }],
          }]}
        />
      </View>

      {/* ── 쿠폰 리스트 ── */}
      <FlatList
        data={filteredCoupons}
        keyExtractor={c => c.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={filteredCoupons.length === 0 ? { flex: 1 } : s.listContent}
        ListEmptyComponent={<EmptyState tab={tab} />}
        renderItem={({ item }) =>
          tab === 'available' ? (
            <CouponCard
              item={item}
              onPress={() => navigation.navigate('MyCouponQR', { userCouponId: item.id })}
            />
          ) : (
            <InactiveCard item={item} />
          )
        }
      />
    </SafeAreaView>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.g50 },

  // ── 앱바 ────────────────────────────────────────────────────
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.g150,
  },
  appBarTitle: {
    fontSize: 28,
    fontFamily: 'KCC-Ganpan',
    color: C.g900,
    letterSpacing: 0,
  },
  appBarIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.g100,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── 탭바 ────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.g200,
    position: 'relative',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.g400,
  },
  tabTextActive: {
    color: C.brand,
    fontWeight: '800',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2.5,
    backgroundColor: C.brand,
    borderRadius: 2,
  },

  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },

  // ── 쿠폰 카드 ───────────────────────────────────────────────
  card: {
    backgroundColor: C.white,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 4,
  },
  cardInactive: { opacity: 0.65 },

  cardTop: {
    padding: 20,
    paddingBottom: 22,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 140,
    justifyContent: 'flex-end',
  },
  // 장식 원
  cardCircle1: {
    position: 'absolute',
    width: 140, height: 140,
    borderRadius: 70,
    right: -30, top: -50,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  cardCircle2: {
    position: 'absolute',
    width: 90, height: 90,
    borderRadius: 45,
    right: 40, top: -20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  cardStoreName: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: C.white,
    letterSpacing: -0.5,
    lineHeight: 34,
    marginBottom: 10,
  },
  cardExpiry: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  cardExpiryUrgent: {
    color: C.white,
    fontWeight: '800',
  },

  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 14,
    backgroundColor: C.white,
  },
  cardBarSection: { flex: 1, gap: 7 },
  cardBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardBarLabel: {
    fontSize: 12,
    color: C.g500,
    fontWeight: '500',
  },
  cardDDay: {
    fontSize: 13,
    fontWeight: '700',
    color: C.g700,
  },
  cardBarTrack: {
    height: 6,
    backgroundColor: C.g150,
    borderRadius: 4,
    overflow: 'hidden',
  },
  cardBarFill: {
    height: 6,
    borderRadius: 4,
  },

  useBtn: {
    backgroundColor: C.brand,
    borderRadius: 24,
    paddingVertical: 11,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  useBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: C.white,
  },

  // ── 빈 상태 ─────────────────────────────────────────────────
  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.g700, textAlign: 'center' },
  emptyDesc:  { fontSize: 13, color: C.g500, textAlign: 'center', lineHeight: 20 },
});
