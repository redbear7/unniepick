/**
 * WalletScreen — 쿠폰함
 * 탭: 알림 | 보유 | 완료 | 만료
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl,
  Animated, Dimensions,
} from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
const TAB_ITEM_W = SCREEN_W / 4; // 탭 4개
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { getCouponKindConfig, UserCouponRow, CouponKind } from '../../lib/services/couponService';

// ── 테마 ──────────────────────────────────────────────────────────
const C = {
  brand:   '#FF6F0F',
  brandBg: '#FFF3EB',
  g900:    '#191F28',
  g800:    '#333D4B',
  g700:    '#4E5968',
  g600:    '#6B7684',
  g500:    '#8B95A1',
  g400:    '#ADB5BD',
  g300:    '#D1D6DB',
  g200:    '#E5E8EB',
  g150:    '#EAECEF',
  g100:    '#F2F4F6',
  g50:     '#F9FAFB',
  green:   '#0AC86E',
  red:     '#E53935',
  white:   '#FFFFFF',
};

const KIND_GRADIENT: Record<string, [string, string]> = {
  regular:    ['#5B67CA', '#7B84D9'],
  timesale:   ['#FF6F0F', '#FF9A3D'],
  service:    ['#0AC86E', '#06A85B'],
  experience: ['#a855f7', '#7c3aed'],
};

const AVATAR_COLORS = [
  '#FF6F0F','#5B67CA','#2DB87A','#D946B0','#FF6B6B','#4C9EFF','#F59E0B','#FF9A3D',
];
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

// ── 탭 정의 ──────────────────────────────────────────────────────
type TabKey = 'noti' | 'available' | 'used' | 'expired';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'noti',      label: '알림' },
  { key: 'available', label: '보유' },
  { key: 'used',      label: '완료' },
  { key: 'expired',   label: '만료' },
];

// ── 알림 아이템 타입 ──────────────────────────────────────────────
interface NotiItem {
  id:         string;
  store_id:   string;
  store_name: string;
  category:   string | null;
  title:      string;
  coupon_kind: string;
  created_at: string;
  is_active:  boolean;
  // 내가 이미 받았는지
  claimed:    boolean;
}

// ── 헬퍼 ─────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 60)  return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}
function formatExpiry(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} 만료`;
}
function dDayInfo(iso: string) {
  const msLeft  = new Date(iso).getTime() - Date.now();
  const dDay    = Math.ceil(msLeft / 86_400_000);
  const fraction = Math.max(0, Math.min(1, msLeft / (30 * 86_400_000)));
  return { dDay, fraction };
}

const CAT_EMOJI: Record<string, string> = {
  cafe:'☕', food:'🍽', beauty:'✂️', nail:'💅', etc:'🏪',
};

// ══════════════════════════════════════════════════════════════════
//  알림 아이템 카드
// ══════════════════════════════════════════════════════════════════
function NotiCard({
  item,
  onClaim,
  claiming,
}: {
  item:     NotiItem;
  onClaim:  () => void;
  claiming: boolean;
}) {
  const isNew   = Date.now() - new Date(item.created_at).getTime() < 24 * 3600_000;
  const catKey  = item.category ?? 'etc';
  const emoji   = CAT_EMOJI[catKey] ?? '🏪';
  const kindCfg = getCouponKindConfig((item.coupon_kind ?? 'regular') as CouponKind);

  return (
    <View style={nc.wrap}>
      {/* 가게 아바타 */}
      <View style={[nc.avatar, { backgroundColor: avatarColor(item.store_name) }]}>
        <Text style={nc.avatarText}>{item.store_name.charAt(0)}</Text>
        {isNew && <View style={nc.newDot} />}
      </View>

      {/* 내용 */}
      <View style={nc.body}>
        <View style={nc.topRow}>
          <Text style={nc.storeName} numberOfLines={1}>{item.store_name}</Text>
          <Text style={nc.time}>{timeAgo(item.created_at)}</Text>
        </View>

        <View style={nc.kindRow}>
          <Text style={nc.kindEmoji}>{kindCfg.emoji}</Text>
          <Text style={nc.couponTitle} numberOfLines={2}>{item.title}</Text>
        </View>

        {isNew && (
          <View style={nc.newBadge}>
            <Text style={nc.newBadgeText}>새 쿠폰</Text>
          </View>
        )}
      </View>

      {/* 받기 버튼 */}
      <TouchableOpacity
        style={[nc.claimBtn, item.claimed && nc.claimBtnDone]}
        onPress={onClaim}
        disabled={item.claimed || claiming}
        activeOpacity={0.8}
      >
        {claiming
          ? <ActivityIndicator size="small" color={C.white} />
          : <Text style={[nc.claimBtnText, item.claimed && nc.claimBtnTextDone]}>
              {item.claimed ? '보유중' : '받기'}
            </Text>
        }
      </TouchableOpacity>
    </View>
  );
}
const nc = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.white,
    gap: 12,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: C.white },
  newDot: {
    position: 'absolute', top: 0, right: 0,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: C.red,
    borderWidth: 2, borderColor: C.white,
  },
  body: { flex: 1, gap: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storeName: { fontSize: 13, fontWeight: '800', color: C.g900, flex: 1 },
  time:      { fontSize: 11, color: C.g400, marginLeft: 8 },
  kindRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  kindEmoji: { fontSize: 13 },
  couponTitle: { flex: 1, fontSize: 13, color: C.g700, lineHeight: 18 },
  newBadge: {
    alignSelf: 'flex-start',
    backgroundColor: C.brandBg,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 8, marginTop: 2,
  },
  newBadgeText: { fontSize: 10, fontWeight: '700', color: C.brand },
  claimBtn: {
    backgroundColor: C.brand,
    borderRadius: 20,
    paddingVertical: 8, paddingHorizontal: 16,
    flexShrink: 0,
    minWidth: 56,
    alignItems: 'center',
  },
  claimBtnDone: { backgroundColor: C.g150 },
  claimBtnText: { fontSize: 12, fontWeight: '800', color: C.white },
  claimBtnTextDone: { color: C.g500 },
});

// ══════════════════════════════════════════════════════════════════
//  쿠폰 카드 (보유)
// ══════════════════════════════════════════════════════════════════
function CouponCard({ item, onPress }: { item: UserCouponRow; onPress: () => void }) {
  const coupon  = item.coupon;
  const kind    = (coupon.coupon_kind ?? 'regular') as CouponKind;
  const [from, to] = KIND_GRADIENT[kind] ?? KIND_GRADIENT.regular;
  const storeName  = (coupon.store as any)?.name ?? '';
  const { dDay, fraction } = dDayInfo(coupon.expires_at);
  const isUrgent = dDay <= 0;

  return (
    <View style={s.card}>
      <View style={[s.cardTop, { backgroundColor: from }]}>
        <View style={[s.cardGlow, { backgroundColor: to }]} />
        <Text style={s.cardStoreName}>{storeName}</Text>
        <Text style={s.cardTitle}>{coupon.title}</Text>
        <Text style={s.cardExpiry}>{formatExpiry(coupon.expires_at)}</Text>
      </View>
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
              width: `${fraction * 100}%`,
              backgroundColor: isUrgent ? C.red : C.brand,
            }]} />
          </View>
        </View>
        <TouchableOpacity style={s.useBtn} onPress={onPress} activeOpacity={0.85}>
          <Text style={s.useBtnText}>사용하기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── 비활성 카드 (완료/만료) ──────────────────────────────────────
function InactiveCard({ item }: { item: UserCouponRow }) {
  const coupon = item.coupon;
  const kind   = (coupon.coupon_kind ?? 'regular') as CouponKind;
  const [from, to] = KIND_GRADIENT[kind] ?? KIND_GRADIENT.regular;
  const storeName  = (coupon.store as any)?.name ?? '';
  return (
    <View style={[s.card, s.cardInactive]}>
      <View style={[s.cardTop, { backgroundColor: from, opacity: 0.5 }]}>
        <View style={[s.cardGlow, { backgroundColor: to }]} />
        <Text style={s.cardStoreName}>{storeName}</Text>
        <Text style={s.cardTitle}>{coupon.title}</Text>
        <Text style={s.cardExpiry}>{formatExpiry(coupon.expires_at)}</Text>
      </View>
      <View style={s.cardBottom}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardBarLabel}>
            {item.status === 'used'
              ? `사용일: ${item.used_at ? new Date(item.used_at).toLocaleDateString('ko-KR') : '-'}`
              : '만료됨'}
          </Text>
        </View>
        <View style={[s.useBtn, { backgroundColor: C.g150 }]}>
          <Text style={[s.useBtnText, { color: C.g500 }]}>
            {item.status === 'used' ? '사용 완료' : '만료'}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── 빈 상태 ──────────────────────────────────────────────────────
const EMPTY_MSG: Record<TabKey, { emoji: string; title: string; desc: string }> = {
  noti:      { emoji: '🔔', title: '팔로우한 가게의 알림이 없어요', desc: '가게를 팔로우하면 새 쿠폰을 즉시 알려드려요' },
  available: { emoji: '🎟', title: '보유한 쿠폰이 없어요',       desc: '가게를 팔로우하고 쿠폰을 받아보세요' },
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
//  메인 화면
// ══════════════════════════════════════════════════════════════════
export default function WalletScreen() {
  const navigation = useNavigation<any>();

  const [tab,        setTab]        = useState<TabKey>('noti');
  const [coupons,    setCoupons]    = useState<UserCouponRow[]>([]);
  const [notis,      setNotis]      = useState<NotiItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claiming,   setClaiming]   = useState<string | null>(null);
  const [userId,     setUserId]     = useState<string | null>(null);
  const [claimedSet, setClaimedSet] = useState<Set<string>>(new Set());

  // 탭 언더라인 애니메이션 (픽셀 기반)
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
    if (uid) {
      await Promise.all([loadCoupons(uid), loadNotis(uid)]);
    }
    setLoading(false);
  };

  // ── 내 쿠폰 로드 ──────────────────────────────────────────────
  const loadCoupons = async (uid: string) => {
    const { data } = await supabase
      .from('user_coupons')
      .select('*, coupon:coupons(*, store:stores(id,name,category))')
      .eq('user_id', uid)
      .order('received_at', { ascending: false });
    if (data) setCoupons(data as unknown as UserCouponRow[]);
  };

  // ── 팔로우한 가게 알림 로드 ───────────────────────────────────
  const loadNotis = async (uid: string) => {
    // 팔로우한 가게의 최근 쿠폰 (활성)
    const { data: favData } = await supabase
      .from('store_favorites')
      .select('store_id')
      .eq('user_id', uid);

    if (!favData || favData.length === 0) { setNotis([]); return; }
    const storeIds = favData.map((f: any) => f.store_id);

    const { data: couponData } = await supabase
      .from('coupons')
      .select('id, title, coupon_kind, created_at, is_active, store_id, store:stores(id, name, category)')
      .in('store_id', storeIds)
      .order('created_at', { ascending: false })
      .limit(60);

    // 내가 이미 받은 쿠폰 ID 세트
    const { data: myData } = await supabase
      .from('user_coupons')
      .select('coupon_id')
      .eq('user_id', uid);
    const myIds = new Set((myData ?? []).map((r: any) => r.coupon_id));
    setClaimedSet(myIds);

    const items: NotiItem[] = (couponData ?? []).map((c: any) => ({
      id:          c.id,
      store_id:    c.store_id,
      store_name:  c.store?.name ?? '알 수 없음',
      category:    c.store?.category ?? null,
      title:       c.title,
      coupon_kind: c.coupon_kind ?? 'regular',
      created_at:  c.created_at,
      is_active:   c.is_active,
      claimed:     myIds.has(c.id),
    }));
    setNotis(items);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (userId) await Promise.all([loadCoupons(userId), loadNotis(userId)]);
    setRefreshing(false);
  }, [userId]);

  // ── 쿠폰 받기 ─────────────────────────────────────────────────
  const handleClaim = async (item: NotiItem) => {
    if (!userId || item.claimed || claiming) return;
    setClaiming(item.id);
    try {
      const { error } = await supabase
        .from('user_coupons')
        .insert({
          user_id:     userId,
          coupon_id:   item.id,
          status:      'available',
          received_at: new Date().toISOString(),
        });
      if (!error) {
        setClaimedSet(prev => new Set([...prev, item.id]));
        setNotis(prev => prev.map(n => n.id === item.id ? { ...n, claimed: true } : n));
      }
    } finally {
      setClaiming(null);
    }
  };

  // ── 탭별 카운트 ────────────────────────────────────────────────
  const notiUnread  = notis.filter(n => !n.claimed && Date.now() - new Date(n.created_at).getTime() < 48 * 3600_000).length;
  const countAvail  = coupons.filter(c => c.status === 'available' && new Date(c.coupon.expires_at) >= new Date()).length;
  const countUsed   = coupons.filter(c => c.status === 'used' || c.status === 'noshow').length;
  const countExpired = coupons.filter(c => c.status === 'cancelled' || (c.status === 'available' && new Date(c.coupon.expires_at) < new Date())).length;
  const tabCounts: Record<TabKey, number> = {
    noti: notiUnread, available: countAvail, used: countUsed, expired: countExpired,
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
      {/* 앱바 */}
      <View style={s.appBar}>
        <Text style={s.appBarTitle}>쿠폰함</Text>
      </View>

      {/* 탭 바 */}
      <View style={s.tabBar}>
        {TABS.map((t, i) => {
          const active = tab === t.key;
          const cnt    = tabCounts[t.key];
          return (
            <TouchableOpacity
              key={t.key}
              style={s.tabItem}
              onPress={() => {
                setTab(t.key);
                animateTab(i);
              }}
              activeOpacity={0.7}
            >
              <View style={s.tabLabelRow}>
                <Text style={[s.tabText, active && s.tabTextActive]}>{t.label}</Text>
                {cnt > 0 && (
                  <View style={[s.tabBadge, active && s.tabBadgeActive]}>
                    <Text style={[s.tabBadgeText, active && s.tabBadgeTextActive]}>
                      {cnt > 99 ? '99+' : cnt}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* 슬라이딩 언더라인 */}
        <Animated.View
          style={[
            s.tabUnderline,
            {
              width: TAB_ITEM_W,
              transform: [{ translateX: tabAnim }],
            },
          ]}
        />
      </View>

      {/* 콘텐츠 */}
      {tab === 'noti' ? (
        /* ── 알림 탭 ── */
        <FlatList
          data={notis}
          keyExtractor={n => n.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          ListEmptyComponent={<EmptyState tab="noti" />}
          contentContainerStyle={notis.length === 0 ? { flex: 1 } : { paddingBottom: 24 }}
          renderItem={({ item }) => (
            <NotiCard
              item={{ ...item, claimed: claimedSet.has(item.id) }}
              onClaim={() => handleClaim(item)}
              claiming={claiming === item.id}
            />
          )}
        />
      ) : (
        /* ── 쿠폰 탭 (보유/완료/만료) ── */
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
      )}
    </SafeAreaView>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.g50 },

  appBar: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.g150,
  },
  appBarTitle: { fontSize: 20, fontWeight: '900', color: C.g900, letterSpacing: -0.5 },

  // ── 탭바 ──────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.g200,
    position: 'relative',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.g400,
  },
  tabTextActive: {
    color: C.g900,
    fontWeight: '800',
  },
  tabBadge: {
    backgroundColor: C.g200,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: C.brand,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.g500,
  },
  tabBadgeTextActive: {
    color: C.white,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2,
    backgroundColor: C.g900,
    borderRadius: 1,
  },

  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.g150,
    marginHorizontal: 0,
  },

  listContent: {
    padding: 14,
    paddingBottom: 32,
    gap: 10,
  },

  // ── 쿠폰 카드 ─────────────────────────────────────────────────
  card: {
    backgroundColor: C.white,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardInactive: { opacity: 0.72 },
  cardTop: {
    padding: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  cardGlow: {
    position: 'absolute', width: 120, height: 120,
    borderRadius: 60, right: -30, top: -30, opacity: 0.5,
  },
  cardStoreName: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)', marginBottom: 4 },
  cardTitle:     { fontSize: 16, fontWeight: '900', color: C.white, marginBottom: 6, lineHeight: 22 },
  cardExpiry:    { fontSize: 10, color: 'rgba(255,255,255,0.8)' },
  cardBottom: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16, gap: 12,
  },
  cardBarSection: { flex: 1, gap: 5 },
  cardBarRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardBarLabel:   { fontSize: 10, color: C.g500, fontWeight: '500' },
  cardDDay:       { fontSize: 11, fontWeight: '600', color: C.g700 },
  cardBarTrack:   { height: 5, backgroundColor: C.g150, borderRadius: 3, overflow: 'hidden' },
  cardBarFill:    { height: 5, borderRadius: 3 },
  useBtn: {
    backgroundColor: C.brand, borderRadius: 20,
    paddingVertical: 8, paddingHorizontal: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  useBtnText: { fontSize: 12, fontWeight: '800', color: C.white },

  // ── 빈 상태 ───────────────────────────────────────────────────
  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.g700, textAlign: 'center' },
  emptyDesc:  { fontSize: 13, color: C.g500, textAlign: 'center', lineHeight: 20 },
});
