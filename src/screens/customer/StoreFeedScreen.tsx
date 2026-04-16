/**
 * StoreFeedScreen — 가게 프로필 (디자인 목업 B2)
 *
 * 헤더: ← 가게명
 * 1. 가게 정보 (썸네일·이름·카테고리·거리)
 * 2. 팔로워·쿠폰·평점 스탯 + 팔로우 버튼
 * 3. 쿠폰북 (NEW 뱃지, 받기/저장됨)
 * 4. 최근 공지
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { fetchStore, StoreRow } from '../../lib/services/storeService';
import { CouponRow, CouponKind } from '../../lib/services/couponService';
import { StorePostRow } from '../../lib/services/postService';
import { isFavorite, toggleFavorite } from '../../lib/services/favoriteService';

// ── 테마 ──────────────────────────────────────────────────────────
const C = {
  brand:    '#FF6F0F',
  brandBg:  '#FFF3EB',
  brandBd:  '#FFCBA4',
  g900:     '#191F28',
  g800:     '#333D4B',
  g700:     '#4E5968',
  g600:     '#6B7684',
  g500:     '#8B95A1',
  g400:     '#ADB5BD',
  g300:     '#D1D6DB',
  g200:     '#E5E8EB',
  g150:     '#EAECEF',
  g100:     '#F2F4F6',
  g50:      '#F9FAFB',
  green:    '#0AC86E',
  red:      '#E53935',
  white:    '#FFFFFF',
};

// ── 카테고리 ──────────────────────────────────────────────────────
const CAT_EMOJI: Record<string, string> = {
  cafe: '☕', food: '🍽', beauty: '✂️', nail: '💅', etc: '🏪',
};
const CAT_LABEL: Record<string, string> = {
  cafe: '카페', food: '음식', beauty: '미용', nail: '네일', etc: '기타',
};
const CAT_BG: Record<string, string> = {
  cafe: '#FFF0E6', food: '#FFF8E6', beauty: '#F0EEFF', nail: '#FFE6F5', etc: '#E6F5FF',
};

// ── 라우트 파라미터 타입 ──────────────────────────────────────────
type StoreFeedParams = {
  StoreFeed: {
    storeId:     string;
    storeName:   string;
    storeEmoji?: string;
    distanceKm?: number;
  };
};

// ── 거리 포맷 ─────────────────────────────────────────────────────
function formatDist(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

// ── 날짜 포맷 ─────────────────────────────────────────────────────
function expiryLabel(iso: string): string {
  const msLeft = new Date(iso).getTime() - Date.now();
  const dDay   = Math.ceil(msLeft / 86_400_000);
  if (dDay <= 0)  return '오늘 마감';
  if (dDay === 1) return '내일 마감';
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day   = d.getDate();
  if (dDay <= 7)  return `D-${dDay}`;
  return `${month}월말까지`;
}

function isNewCoupon(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 48 * 3600_000;
}

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 1)   return '방금';
  if (mins < 60)  return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

// ── 쿠폰 카드 ────────────────────────────────────────────────────
function CouponBookCard({
  coupon,
  claimed,
  onClaim,
  claiming,
}: {
  coupon:   CouponRow;
  claimed:  boolean;
  onClaim:  () => void;
  claiming: boolean;
}) {
  const isNew      = isNewCoupon(coupon.created_at);
  const remaining  = (coupon.total_quantity ?? 0) - (coupon.issued_count ?? 0);
  const hasLimit   = (coupon.total_quantity ?? 0) > 0;
  const expLabel   = expiryLabel(coupon.expires_at);
  const isUrgent   = expLabel === '오늘 마감';

  return (
    <View style={[cc.card, isNew && cc.cardNew]}>
      {/* NEW 뱃지 */}
      {isNew && (
        <View style={cc.newBadge}>
          <Text style={cc.newBadgeText}>NEW</Text>
        </View>
      )}

      {/* 제목 */}
      <Text style={cc.title}>{coupon.title}</Text>

      {/* 설명 */}
      {!!coupon.description && (
        <Text style={cc.desc} numberOfLines={1}>{coupon.description}</Text>
      )}

      {/* 하단 행: 만료 정보 + 버튼 */}
      <View style={cc.footer}>
        <View style={cc.footerInfo}>
          <Text style={[cc.expiry, isUrgent && { color: C.red }]}>
            {isUrgent ? '⏰' : '📅'} {expLabel}
          </Text>
          {hasLimit && (
            <Text style={cc.remain}>
              {remaining <= 10 ? '🔥' : '·'} 잔여 {remaining}장
            </Text>
          )}
          {!hasLimit && (
            <Text style={cc.remain}>· 수량 무제한</Text>
          )}
        </View>

        {/* 받기 / 저장됨 버튼 */}
        <TouchableOpacity
          style={[cc.claimBtn, claimed && cc.claimBtnDone]}
          onPress={onClaim}
          disabled={claimed || claiming}
          activeOpacity={0.85}
        >
          {claiming ? (
            <ActivityIndicator size="small" color={C.white} />
          ) : (
            <Text style={[cc.claimBtnText, claimed && cc.claimBtnTextDone]}>
              {claimed ? '저장됨' : '받기'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
const cc = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.g200,
    padding: 16,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardNew: {
    borderColor: C.brand,
    borderWidth: 1.5,
    backgroundColor: C.brandBg,
  },
  newBadge: {
    alignSelf: 'flex-start',
    backgroundColor: C.brand,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 4,
  },
  newBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: C.g900,
    letterSpacing: -0.3,
  },
  desc: {
    fontSize: 13,
    color: C.g600,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  expiry: {
    fontSize: 13,
    color: C.g500,
    fontWeight: '500',
  },
  remain: {
    fontSize: 13,
    color: C.g500,
    fontWeight: '500',
  },
  claimBtn: {
    backgroundColor: C.brand,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 22,
    minWidth: 68,
    alignItems: 'center',
    flexShrink: 0,
  },
  claimBtnDone: {
    backgroundColor: C.g100,
  },
  claimBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: C.white,
  },
  claimBtnTextDone: {
    color: C.g500,
  },
});

// ── 공지 아이템 ────────────────────────────────────────────────────
function PostItem({
  post,
  storeEmoji,
}: {
  post:       StorePostRow;
  storeEmoji: string;
}) {
  return (
    <View style={pi.wrap}>
      <Text style={pi.text}>{storeEmoji} {post.content}</Text>
      <Text style={pi.time}>{timeAgo(post.created_at)}</Text>
    </View>
  );
}
const pi = StyleSheet.create({
  wrap: {
    paddingVertical: 14,
    gap: 4,
  },
  text: {
    fontSize: 14,
    color: C.g800,
    lineHeight: 21,
  },
  time: {
    fontSize: 12,
    color: C.g400,
    fontWeight: '400',
  },
});

// ══════════════════════════════════════════════════════════════════
//  메인 화면
// ══════════════════════════════════════════════════════════════════
export default function StoreFeedScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<RouteProp<StoreFeedParams, 'StoreFeed'>>();
  const { storeId, storeName, storeEmoji = '🏪', distanceKm } = route.params;

  const [store,        setStore]        = useState<StoreRow | null>(null);
  const [coupons,      setCoupons]      = useState<CouponRow[]>([]);
  const [posts,        setPosts]        = useState<StorePostRow[]>([]);
  const [isFollowed,   setIsFollowed]   = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [claimedSet,   setClaimedSet]   = useState<Set<string>>(new Set());
  const [claimingId,   setClaimingId]   = useState<string | null>(null);
  const [userId,       setUserId]       = useState<string | null>(null);
  const [loading,      setLoading]      = useState(true);

  // ── 데이터 로드 ─────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: sessionData }, storeData] = await Promise.all([
        supabase.auth.getSession(),
        fetchStore(storeId),
      ]);
      const uid = sessionData.session?.user.id ?? null;
      setUserId(uid);
      setStore(storeData);

      // 쿠폰 (활성만)
      const now = new Date().toISOString();
      const { data: couponData } = await supabase
        .from('coupons')
        .select('*')
        .eq('store_id', storeId)
        .eq('is_active', true)
        .gt('expires_at', now)
        .order('created_at', { ascending: false });
      setCoupons((couponData ?? []) as CouponRow[]);

      // 최근 공지
      const { data: postData } = await supabase
        .from('store_posts')
        .select('id, store_id, owner_id, content, linked_coupon_id, like_count, pick_count, created_at')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(10);
      setPosts((postData ?? []) as StorePostRow[]);

      // 팔로워 수
      const { count: fCnt } = await supabase
        .from('store_favorites')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId);
      setFollowerCount(fCnt ?? 0);

      // 팔로우 상태
      if (uid) {
        const fav = await isFavorite(uid, storeId);
        setIsFollowed(fav);

        // 내가 받은 쿠폰
        const { data: myData } = await supabase
          .from('user_coupons')
          .select('coupon_id')
          .eq('user_id', uid);
        setClaimedSet(new Set((myData ?? []).map((r: any) => r.coupon_id)));
      }
    } catch (e) {
      console.error('StoreFeedScreen load error:', e);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  // ── 팔로우 토글 ─────────────────────────────────────────────────
  const handleFollow = async () => {
    if (!userId) {
      Alert.alert('로그인 필요', '팔로우하려면 로그인해주세요.');
      return;
    }
    const result = await toggleFavorite(userId, storeId);
    setIsFollowed(result);
    setFollowerCount(prev => result ? prev + 1 : Math.max(0, prev - 1));
  };

  // ── 쿠폰 받기 ───────────────────────────────────────────────────
  const handleClaim = async (couponId: string) => {
    if (!userId) {
      Alert.alert('로그인 필요', '쿠폰을 받으려면 로그인해주세요.');
      return;
    }
    if (claimingId || claimedSet.has(couponId)) return;
    setClaimingId(couponId);
    try {
      const { error } = await supabase
        .from('user_coupons')
        .insert({
          user_id:     userId,
          coupon_id:   couponId,
          status:      'available',
          received_at: new Date().toISOString(),
        });
      if (!error) {
        setClaimedSet(prev => new Set([...prev, couponId]));
      } else if (error.code === '23505') {
        setClaimedSet(prev => new Set([...prev, couponId]));
      }
    } catch (e) {
      console.error('claim error:', e);
    } finally {
      setClaimingId(null);
    }
  };

  // ── 가게 메타 ───────────────────────────────────────────────────
  const catKey    = (store?.category ?? 'etc') as string;
  const catEmoji  = CAT_EMOJI[catKey] ?? '🏪';
  const catLabel  = CAT_LABEL[catKey] ?? '기타';
  const thumbBg   = CAT_BG[catKey] ?? C.g100;
  const district  = store?.address?.split(' ').slice(-1)[0] ?? '';

  // 평점 (더미 — 실제 DB에 rating 컬럼 추가 후 대체)
  const rating = 4.7;

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>{storeName}</Text>
        </View>
        <View style={s.center}>
          <ActivityIndicator color={C.brand} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const claimedCount = coupons.filter(c => claimedSet.has(c.id)).length;

  return (
    <SafeAreaView style={s.safe}>
      {/* ── 헤더 ──────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{storeName}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── 가게 정보 ─────────────────────────────────────── */}
        <View style={s.storeSection}>
          <View style={s.storeRow}>
            {/* 썸네일 */}
            <View style={[s.thumb, { backgroundColor: thumbBg }]}>
              <Text style={s.thumbEmoji}>{catEmoji}</Text>
            </View>

            {/* 텍스트 */}
            <View style={s.storeInfo}>
              <Text style={s.storeName}>{storeName}</Text>
              <Text style={s.storeMeta}>
                {catEmoji} {catLabel}
                {district ? ` · 📍 ${district}` : ''}
                {distanceKm !== undefined ? ` · ${formatDist(distanceKm)}` : ''}
              </Text>
            </View>
          </View>

          {/* 구분선 */}
          <View style={s.divider} />

          {/* 스탯 3열 */}
          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Text style={s.statNum}>
                {followerCount >= 1000
                  ? `${(followerCount / 1000).toFixed(1)}k`
                  : followerCount.toLocaleString()}
              </Text>
              <Text style={s.statLabel}>팔로워</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBox}>
              <Text style={s.statNum}>{coupons.length}</Text>
              <Text style={s.statLabel}>쿠폰</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBox}>
              <Text style={s.statNum}>★{rating}</Text>
              <Text style={s.statLabel}>평점</Text>
            </View>
          </View>

          {/* 구분선 */}
          <View style={s.divider} />

          {/* 팔로우 버튼 */}
          <TouchableOpacity
            style={[s.followBtn, isFollowed && s.followBtnOn]}
            onPress={handleFollow}
            activeOpacity={0.85}
          >
            <Text style={[s.followBtnText, isFollowed && s.followBtnTextOn]}>
              {isFollowed ? '✓ 팔로잉' : '+ 팔로우'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── 쿠폰북 ────────────────────────────────────────── */}
        <View style={s.section}>
          {/* 섹션 헤더 */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>🎫 쿠폰북</Text>
            {claimedCount > 0 && (
              <Text style={s.sectionBadge}>{claimedCount}개 사용 가능</Text>
            )}
          </View>

          {coupons.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyText}>현재 발행 중인 쿠폰이 없어요</Text>
            </View>
          ) : (
            <View style={s.couponList}>
              {coupons.map(c => (
                <CouponBookCard
                  key={c.id}
                  coupon={c}
                  claimed={claimedSet.has(c.id)}
                  onClaim={() => handleClaim(c.id)}
                  claiming={claimingId === c.id}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── 최근 공지 ─────────────────────────────────────── */}
        {posts.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>📢 최근 공지</Text>
            </View>
            {posts.map((p, i) => (
              <React.Fragment key={p.id}>
                <PostItem post={p} storeEmoji={catEmoji} />
                {i < posts.length - 1 && <View style={s.postDivider} />}
              </React.Fragment>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.g50,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 헤더
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: C.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.g150,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 22,
    color: C.g900,
    fontWeight: '400',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: C.g900,
    textAlign: 'center',
    letterSpacing: -0.3,
  },

  // 가게 정보 섹션
  storeSection: {
    backgroundColor: C.white,
    marginBottom: 8,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 0,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  thumbEmoji: {
    fontSize: 36,
  },
  storeInfo: {
    flex: 1,
    gap: 6,
  },
  storeName: {
    fontSize: 20,
    fontWeight: '800',
    color: C.g900,
    letterSpacing: -0.5,
  },
  storeMeta: {
    fontSize: 13,
    color: C.g500,
    fontWeight: '400',
    lineHeight: 18,
  },

  // 구분선
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.g200,
    marginVertical: 16,
  },

  // 스탯
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statNum: {
    fontSize: 22,
    fontWeight: '800',
    color: C.g900,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    color: C.g500,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: C.g200,
  },

  // 팔로우 버튼
  followBtn: {
    backgroundColor: C.g100,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  followBtnOn: {
    backgroundColor: C.g100,
  },
  followBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.g700,
    letterSpacing: -0.2,
  },
  followBtnTextOn: {
    color: C.g600,
  },

  // 섹션 공통
  section: {
    backgroundColor: C.white,
    marginBottom: 8,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.g900,
    letterSpacing: -0.3,
  },
  sectionBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: C.brand,
  },

  // 쿠폰 리스트
  couponList: {
    gap: 10,
  },

  // 공지 구분선
  postDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.g150,
  },

  // 빈 상태
  emptyBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: C.g400,
  },
});
