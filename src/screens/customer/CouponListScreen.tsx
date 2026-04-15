import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MotiView } from 'moti';
import {
  View, Text, StyleSheet, Animated, TextInput, Share,
  TouchableOpacity, ScrollView, ActivityIndicator,
  RefreshControl, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import * as Location from 'expo-location';
import { COLORS, RADIUS } from '../../constants/theme';
import {
  fetchActiveCoupons, fetchMyCoupons,
  getCouponKindConfig, incrementCouponClick,
  canCancelCoupon, cancelDeadlineText,
  CouponRow, UserCouponRow,
} from '../../lib/services/couponService';
import { getSession } from '../../lib/services/authService';
import { fetchActiveBanners, BannerRow } from '../../lib/services/bannerService';
import { getMyReview, submitReview } from '../../lib/services/reviewService';
import {
  fetchStorePosts, toggleLike, getLikedSet, getCouponLikeCounts,
  togglePick, getPickedSet, getCouponPickCounts,
  StorePostRow,
} from '../../lib/services/postService';
import { useMiniPlayerPadding } from '../../hooks/useMiniPlayerPadding';

type Tab      = 'feed' | 'mine';
type SortMode = 'recent' | 'nearest' | 'likes' | 'pick';

// ─── 유니온 피드 아이템 ──────────────────────────────────────────────
type FeedItem =
  | { kind: 'coupon'; data: CouponRow;     key: string }
  | { kind: 'post';   data: StorePostRow;  key: string };

// ─── 거리 계산 ──────────────────────────────────────────────────────
function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
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
function formatDist(m: number): string {
  if (m < 100)  return '100m 이내';
  if (m < 1000) return `${Math.round(m / 10) * 10}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

// ─── 시간 경과 ──────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 1)  return '방금';
  if (m < 60) return `${m}분`;
  if (h < 24) return `${h}시간`;
  return `${d}일`;
}

// ─── 스토어 아바타 ──────────────────────────────────────────────────
function StoreAvatar({ name, color, size = 42 }: { name: string; color: string; size?: number }) {
  return (
    <View style={[av.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[av.text, { fontSize: size * 0.42 }]}>{name.slice(0, 1)}</Text>
    </View>
  );
}
const av = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontWeight: '800' },
});

// ─── 타임세일 카운트다운 ─────────────────────────────────────────────
function CountdownBadge({ expiresAt, color }: { expiresAt: string; color: string }) {
  const [parts, setParts] = useState({ d: 0, h: 0, m: 0, s: 0, ended: false });
  useEffect(() => {
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setParts({ d: 0, h: 0, m: 0, s: 0, ended: true }); return; }
      setParts({ ended: false,
        d: Math.floor(diff / 86_400_000),
        h: Math.floor((diff % 86_400_000) / 3_600_000),
        m: Math.floor((diff % 3_600_000)  / 60_000),
        s: Math.floor((diff % 60_000)     / 1_000),
      });
    };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [expiresAt]);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (parts.ended) return <Text style={[cc.text, { color: '#999' }]}>⏰ 세일 종료</Text>;
  const str = parts.d > 0
    ? `${parts.d}일 ${pad(parts.h)}:${pad(parts.m)}:${pad(parts.s)}`
    : `${pad(parts.h)}:${pad(parts.m)}:${pad(parts.s)}`;
  return <Text style={[cc.text, { color }]}>⏰ {str} 남음</Text>;
}
const cc = StyleSheet.create({ text: { fontSize: 12, fontWeight: '700' } });

// ─── 하트 버튼 ──────────────────────────────────────────────────────
function HeartBtn({ isLiked, count, onPress, size = 22 }: {
  isLiked: boolean; count: number; onPress: () => void; size?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const tap = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.4, duration: 100, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    onPress();
  };
  return (
    <TouchableOpacity style={hb.wrap} onPress={tap} activeOpacity={0.7}>
      <Animated.Text style={[{ fontSize: size }, { transform: [{ scale }] }]}>
        {isLiked ? '❤️' : '🤍'}
      </Animated.Text>
      <Text style={[hb.count, isLiked && { color: '#E94560' }]}>{count}</Text>
    </TouchableOpacity>
  );
}
const hb = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  count: { fontSize: 13, fontWeight: '700', color: '#999' },
});

// ─── 찜 버튼 ────────────────────────────────────────────────────────
function PickBtn({ isPicked, count, onPress }: {
  isPicked: boolean; count: number; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const tap = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.35, duration: 100, useNativeDriver: true }),
      Animated.spring(scale,  { toValue: 1,    useNativeDriver: true }),
    ]).start();
    onPress();
  };
  return (
    <TouchableOpacity style={pk.wrap} onPress={tap} activeOpacity={0.7}>
      <Animated.View style={[pk.inner, isPicked && pk.innerActive, { transform: [{ scale }] }]}>
        <Text style={pk.star}>{isPicked ? '⭐' : '☆'}</Text>
        <Text style={[pk.label, isPicked && pk.labelActive]}>
          찜{count > 0 ? `  ${count}` : ''}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}
const pk = StyleSheet.create({
  wrap:        { flexDirection: 'row', alignItems: 'center' },
  inner:       { flexDirection: 'row', alignItems: 'center', gap: 3,
                 backgroundColor: '#F5F5F5', borderRadius: 999,
                 paddingHorizontal: 10, paddingVertical: 4 },
  innerActive: { backgroundColor: '#FFF8E1' },
  star:        { fontSize: 13 },
  label:       { fontSize: 12, fontWeight: '800', color: '#999' },
  labelActive: { color: '#F5A623' },
});

// ─── 쿠폰 정보 스트립 (게시물 하단 / 단독 쿠폰 공통) ───────────────
interface CouponStripProps {
  coupon:    CouponRow;
  isUsed?:   boolean;
  onPress:   () => void;
  onShare?:  () => void;
  index?:    number;
}
function CouponStrip({ coupon, isUsed = false, onPress, onShare, index = 0 }: CouponStripProps) {
  const kind       = getCouponKindConfig(coupon.coupon_kind);
  const color      = isUsed ? '#BBBBBB' : kind.bg;
  const disc       = coupon.discount_type === 'percent'
    ? `${coupon.discount_value}% 할인`
    : coupon.discount_value > 0
      ? `${coupon.discount_value.toLocaleString()}원 할인`
      : '무료 제공';
  const isTimesale = coupon.coupon_kind === 'timesale';

  // 마감일 강조
  const diffMs   = new Date(coupon.expires_at).getTime() - Date.now();
  const diffH    = diffMs / 3_600_000;
  const expiryColor = isUsed ? '#BBBBBB' : diffH <= 24 ? '#E53935' : diffH <= 72 ? '#FF6F0F' : '#8B95A1';
  const expiryLabel = diffH <= 24
    ? `⏰ ${Math.max(0, Math.ceil(diffH))}시간 남음`
    : diffH <= 72
    ? `⚡ D-${Math.ceil(diffH / 24)}`
    : `~${new Date(coupon.expires_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`;
  const progress   = coupon.total_quantity
    ? Math.min(coupon.issued_count / coupon.total_quantity, 1) : 0;
  const remaining  = coupon.total_quantity !== null
    ? coupon.total_quantity - coupon.issued_count : null;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 20, scale: 0.97 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: 'timing', duration: 380, delay: index * 80 }}
    >
    <TouchableOpacity
      style={[cs.wrap, { borderColor: color + '44' }, isUsed && cs.wrapUsed]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* 상단: 종류 배지 + 할인 + 발급 버튼 */}
      <View style={cs.topRow}>
        <View style={[cs.kindBadge, { backgroundColor: color + '1A' }]}>
          <Text style={[cs.kindText, { color }]}>{kind.emoji} {kind.label}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Text style={[cs.getBtn, { color: isUsed ? '#666' : color }]}>
          {isUsed ? '사용됨' : '발급받기 →'}
        </Text>
      </View>

      {/* 할인 크기 + 만료일 */}
      <View style={cs.discRow}>
        <Text style={[cs.discText, { color: isUsed ? '#BBBBBB' : '#101010' }]}>{disc}</Text>
        <Text style={[cs.expiry, { color: expiryColor }]}>{expiryLabel}</Text>
      </View>

      {/* 수량 프로그레스 */}
      {!isUsed && coupon.total_quantity !== null && (
        <View style={cs.progressWrap}>
          <View style={cs.progressBg}>
            <View style={[cs.progressFill, {
              width: `${progress * 100}%` as any,
              backgroundColor: color,
            }]} />
          </View>
          <View style={cs.progressMeta}>
            <Text style={cs.progressText}>
              {coupon.issued_count}/{coupon.total_quantity} 발급
            </Text>
            {remaining !== null && remaining > 0 && (
              <Text style={[cs.progressText, { color }]}>잔여 {remaining}</Text>
            )}
            {remaining !== null && remaining <= 0 && (
              <Text style={[cs.progressText, { color: '#E94560' }]}>소진</Text>
            )}
          </View>
        </View>
      )}

      {/* 타임세일 카운트다운 */}
      {isTimesale && !isUsed && (
        <CountdownBadge expiresAt={coupon.expires_at} color={color} />
      )}
    </TouchableOpacity>
    </MotiView>
  );
}

const cs = StyleSheet.create({
  wrap: {
    borderWidth: 1, borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14, paddingVertical: 12,
    marginTop: 10, gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  wrapUsed:     { opacity: 0.5 },
  topRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kindBadge:    { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  kindText:     { fontSize: 11, fontWeight: '800' },
  getBtn:       { fontSize: 12, fontWeight: '800' },
  discRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  discText:     { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  expiry:       { fontSize: 13, fontWeight: '700' },
  progressWrap: { gap: 5 },
  progressBg:   { height: 3, borderRadius: 2, backgroundColor: '#F0F0F0' },
  progressFill: { height: 3, borderRadius: 2 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { fontSize: 11, color: '#8B95A1', fontWeight: '600' },
});

// ─── 게시물 피드 아이템 (텍스트 메인, 쿠폰은 하단 스트립) ─────────────
interface PostFeedItemProps {
  post:           StorePostRow;
  likeCount:      number;
  pickCount:      number;
  isLast:         boolean;
  isLiked:        boolean;
  isPicked:       boolean;
  distText?:      string | null;
  onLike:         () => void;
  onPick:         () => void;
  onCouponPress?: (coupon: CouponRow) => void;
  onCouponShare?: (coupon: CouponRow) => void;
  onStorePress?:  () => void;
}
function PostFeedItem({
  post, likeCount, pickCount, isLast, isLiked, isPicked, distText,
  onLike, onPick, onCouponPress, onCouponShare, onStorePress,
}: PostFeedItemProps) {
  const storeName = post.store?.name ?? '가게';

  return (
    <View style={fi.wrap}>
      {/* 아바타 + 스레드 라인 */}
      <View style={fi.left}>
        <TouchableOpacity onPress={onStorePress} disabled={!onStorePress} activeOpacity={0.8}>
          <StoreAvatar name={storeName} color={COLORS.primary} />
        </TouchableOpacity>
        {!isLast && <View style={fi.line} />}
      </View>

      {/* 오른쪽 */}
      <View style={fi.right}>
        {/* 헤더: 가게명 + 시간 */}
        <View style={fi.header}>
          <TouchableOpacity onPress={onStorePress} disabled={!onStorePress} activeOpacity={0.8}>
            <Text style={fi.storeName}>{storeName}</Text>
          </TouchableOpacity>
          {post.store?.district?.name && (
            <Text style={fi.districtInline}>🗺 {post.store.district.name}</Text>
          )}
          <Text style={fi.time}>{timeAgo(post.created_at)}</Text>
        </View>

        {/* ★ 게시물 본문 — 메인 콘텐츠 ★ */}
        <Text style={fi.postContent}>{post.content}</Text>

        {/* 쿠폰 스트립 (첨부된 경우만) */}
        {post.linked_coupon && (
          <CouponStrip
            coupon={post.linked_coupon}
            onPress={() => onCouponPress?.(post.linked_coupon!)}
            onShare={() => onCouponShare?.(post.linked_coupon!)}
          />
        )}

        {/* 거리 */}
        {distText && <Text style={fi.distText}>📍 {distText}</Text>}

        {/* 액션 바 */}
        <View style={fi.actions}>
          <HeartBtn isLiked={isLiked} count={likeCount} onPress={onLike} />
          <View style={fi.sep} />
          <PickBtn isPicked={isPicked} count={pickCount} onPress={onPick} />
          {post.linked_coupon && onCouponShare && (
            <>
              <View style={fi.sep} />
              <TouchableOpacity style={fi.actionBtn}
                onPress={() => onCouponShare(post.linked_coupon!)} activeOpacity={0.7}>
                <Text style={fi.actionIcon}>📤</Text>
                <Text style={fi.actionLabel}>공유</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {!isLast && <View style={fi.divider} />}
      </View>
    </View>
  );
}

// ─── 단독 쿠폰 피드 아이템 (게시물 없이 쿠폰만 등록된 경우) ──────────
interface CouponFeedItemProps {
  coupon:        CouponRow;
  distText:      string | null;
  isLast:        boolean;
  isLiked:       boolean;
  likeCount:     number;
  isPicked:      boolean;
  pickCount:     number;
  isUsed?:       boolean;
  userStatus?:   string;
  onPress:       () => void;
  onStorePress?: () => void;
  onLike:        () => void;
  onPick:        () => void;
  onShare:       () => void;
}
function CouponFeedItem({
  coupon, distText, isLast, isLiked, likeCount, isPicked, pickCount,
  isUsed = false, userStatus,
  onPress, onStorePress, onLike, onPick, onShare,
}: CouponFeedItemProps) {
  const kind      = getCouponKindConfig(coupon.coupon_kind);
  const color     = isUsed ? '#BBBBBB' : kind.bg;
  const storeName = coupon.store?.name ?? '가게';

  return (
    <View style={fi.wrap}>
      {/* 아바타 + 스레드 라인 */}
      <View style={fi.left}>
        <TouchableOpacity onPress={onStorePress} disabled={!onStorePress} activeOpacity={0.8}>
          <StoreAvatar name={storeName} color={color} />
        </TouchableOpacity>
        {!isLast && <View style={fi.line} />}
      </View>

      {/* 오른쪽 */}
      <View style={fi.right}>
        {/* 헤더: 가게명 + 시간 */}
        <View style={fi.header}>
          <TouchableOpacity onPress={onStorePress} disabled={!onStorePress} activeOpacity={0.8}>
            <Text style={fi.storeName}>{storeName}</Text>
          </TouchableOpacity>
          {coupon.store?.district?.name && (
            <Text style={fi.districtInline}>🗺 {coupon.store.district.name}</Text>
          )}
          <Text style={fi.time}>{timeAgo(coupon.created_at)}</Text>
        </View>

        {/* 사용 완료 태그 */}
        {isUsed && (
          <View style={fi.usedTag}>
            <Text style={fi.usedTagText}>
              {userStatus === 'noshow' ? '⚠️ 노쇼 처리됨' : '✓ 사용완료'}
            </Text>
          </View>
        )}

        {/* ★ 쿠폰 제목 — 메인 헤드라인 ★ */}
        <Text style={[fi.couponTitle, isUsed && fi.titleGray]}>{coupon.title}</Text>

        {/* 설명 */}
        {!!coupon.description && (
          <Text style={fi.couponDesc} numberOfLines={2}>{coupon.description}</Text>
        )}
        {!!coupon.experience_offer && (
          <Text style={fi.couponDesc} numberOfLines={1}>
            <Text style={{ fontWeight: '800', color }}>제공  </Text>
            {coupon.experience_offer}
          </Text>
        )}
        {!!coupon.experience_mission && (
          <Text style={fi.couponDesc} numberOfLines={1}>
            <Text style={{ fontWeight: '800', color }}>미션  </Text>
            {coupon.experience_mission}
          </Text>
        )}

        {/* 쿠폰 스트립 */}
        <CouponStrip coupon={coupon} isUsed={isUsed} onPress={onPress} onShare={onShare} />

        {/* 거리 */}
        {distText && <Text style={fi.distText}>📍 {distText}</Text>}

        {/* 액션 바 */}
        <View style={fi.actions}>
          <HeartBtn isLiked={isLiked} count={likeCount} onPress={onLike} />
          <View style={fi.sep} />
          <PickBtn isPicked={isPicked} count={pickCount} onPress={onPick} />
          <View style={fi.sep} />
          <TouchableOpacity style={fi.actionBtn} onPress={onShare} activeOpacity={0.7}>
            <Text style={fi.actionIcon}>📤</Text>
            <Text style={fi.actionLabel}>공유</Text>
          </TouchableOpacity>
        </View>

        {!isLast && <View style={fi.divider} />}
      </View>
    </View>
  );
}

// ─── 공통 피드 스타일 ────────────────────────────────────────────────
const fi = StyleSheet.create({
  wrap:     { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16 },
  left:     { alignItems: 'center', marginRight: 12, width: 42 },
  line:     { flex: 1, width: 2, backgroundColor: '#EBEBEB', marginTop: 6, borderRadius: 1 },
  right:    { flex: 1, paddingBottom: 16 },

  header:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  storeName:      { fontSize: 15, fontWeight: '800', color: '#101010', letterSpacing: -0.3 },
  districtInline: { fontSize: 11, color: '#AAAAAA' },
  time:           { fontSize: 12, color: '#AAAAAA', marginLeft: 'auto' },

  usedTag:    { backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
               alignSelf: 'flex-start', marginBottom: 6 },
  usedTagText:{ fontSize: 11, color: '#6B7280', fontWeight: '700' },

  // 게시물 본문 (크고 읽기 편하게)
  postContent: { fontSize: 17, color: '#111111', lineHeight: 26, marginBottom: 2, letterSpacing: -0.2 },

  // 쿠폰 단독 제목 (헤드라인)
  couponTitle: { fontSize: 18, fontWeight: '800', color: '#101010', lineHeight: 26,
                 letterSpacing: -0.4, marginBottom: 4 },
  titleGray:   { color: '#AAAAAA' },
  couponDesc:  { fontSize: 14, color: '#555555', lineHeight: 20, marginBottom: 2 },
  distText:    { fontSize: 12, color: '#2DB87A', fontWeight: '600', marginTop: 6 },

  actions:    { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 2 },
  actionBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: 4 },
  actionIcon: { fontSize: 14, color: '#888' },
  actionLabel:{ fontSize: 12, color: '#888', fontWeight: '600' },
  sep:        { width: 1, height: 14, backgroundColor: '#EBEBEB', marginHorizontal: 8 },

  divider:    { height: 1, backgroundColor: '#F5F5F5', marginTop: 16 },
});

// ─── 플로팅 배너 ─────────────────────────────────────────────────────
function FloatingBanner({ banners, onClose, onPress }: {
  banners: BannerRow[]; onClose: () => void; onPress: (b: BannerRow) => void;
}) {
  const [idx, setIdx] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (banners.length <= 1) return;
    const id = setInterval(() => {
      Animated.sequence([
        Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
      setIdx(p => (p + 1) % banners.length);
    }, 4000);
    return () => clearInterval(id);
  }, [banners.length]);
  if (!banners.length) return null;
  const b = banners[idx];
  return (
    <Animated.View style={[fb.wrap, { backgroundColor: b.bg_color, opacity: fade }]}>
      <TouchableOpacity style={fb.inner} onPress={() => onPress(b)} activeOpacity={0.85}>
        <Text style={fb.emoji}>{b.emoji}</Text>
        <View style={fb.texts}>
          <Text style={[fb.title, { color: b.text_color }]} numberOfLines={1}>{b.title}</Text>
          {b.subtitle && <Text style={[fb.sub, { color: b.text_color + 'CC' }]} numberOfLines={1}>{b.subtitle}</Text>}
        </View>
        <View style={[fb.cta, { borderColor: b.text_color + '55' }]}>
          <Text style={[fb.ctaText, { color: b.text_color }]}>{b.cta_text}</Text>
        </View>
      </TouchableOpacity>
      <View style={fb.footer}>
        {banners.length > 1 && (
          <View style={fb.dots}>
            {banners.map((_, i) => (
              <TouchableOpacity key={i} onPress={() => setIdx(i)}>
                <View style={[fb.dot, { backgroundColor: b.text_color, opacity: i === idx ? 1 : 0.3 }]} />
              </TouchableOpacity>
            ))}
          </View>
        )}
        <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
          <Text style={[fb.closeX, { color: b.text_color + '99' }]}>✕</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
const fb = StyleSheet.create({
  wrap:    { marginHorizontal: 12, marginBottom: 10, borderRadius: 14, overflow: 'hidden' },
  inner:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 14, gap: 10 },
  emoji:   { fontSize: 26 },
  texts:   { flex: 1 },
  title:   { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  sub:     { fontSize: 12, marginTop: 2 },
  cta:     { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  ctaText: { fontSize: 12, fontWeight: '700' },
  footer:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
             paddingHorizontal: 12, paddingBottom: 10, paddingTop: 6 },
  dots:    { flex: 1, flexDirection: 'row', gap: 5 },
  dot:     { width: 5, height: 5, borderRadius: 3 },
  closeX:  { fontSize: 14, fontWeight: '700' },
});

// ─── 별점 후기 모달 ──────────────────────────────────────────────────
interface ReviewModalProps {
  visible: boolean; couponTitle: string; storeName: string;
  userCouponId: string; existingRating?: number; existingComment?: string;
  onClose: () => void; onSubmit: () => void;
}
function ReviewModal({ visible, couponTitle, storeName, userCouponId,
  existingRating, existingComment, onClose, onSubmit }: ReviewModalProps) {
  const [rating,  setRating]  = useState(existingRating ?? 0);
  const [comment, setComment] = useState(existingComment ?? '');
  const [saving,  setSaving]  = useState(false);
  const scales = useRef([0,1,2,3,4].map(() => new Animated.Value(1))).current;
  const bounce = (i: number) => {
    Animated.sequence([
      Animated.timing(scales[i], { toValue: 1.4, duration: 100, useNativeDriver: true }),
      Animated.spring(scales[i], { toValue: 1, useNativeDriver: true }),
    ]).start();
  };
  const submit = async () => {
    if (!rating) { Alert.alert('별점을 선택해주세요'); return; }
    setSaving(true);
    try {
      await submitReview(userCouponId, rating, comment.trim() || undefined);
      onSubmit();
    } catch (e: any) { Alert.alert('등록 실패', e.message); }
    finally { setSaving(false); }
  };
  const labels = ['','별로예요','그저 그래요','괜찮아요','좋아요','최고예요!'];
  if (!visible) return null;
  return (
    <View style={rv.overlay}>
      <TouchableOpacity style={rv.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={rv.sheet}>
        <View style={rv.handle} />
        <Text style={rv.store}>{storeName}</Text>
        <Text style={rv.coupon}>{couponTitle}</Text>
        <Text style={rv.prompt}>방문은 어떠셨나요?</Text>
        <View style={rv.stars}>
          {[1,2,3,4,5].map(i => (
            <TouchableOpacity key={i} onPress={() => { setRating(i); bounce(i - 1); }} activeOpacity={0.75}>
              <Animated.Text style={[rv.star, { transform: [{ scale: scales[i - 1] }] }]}>
                {i <= rating ? '⭐' : '☆'}
              </Animated.Text>
            </TouchableOpacity>
          ))}
        </View>
        {rating > 0 && <Text style={rv.label}>{labels[rating]}</Text>}
        <TextInput style={rv.input} value={comment} onChangeText={setComment}
          placeholder="후기를 남겨주세요 (선택)" placeholderTextColor="#BBB"
          multiline numberOfLines={3} maxLength={200} />
        <Text style={rv.count}>{comment.length}/200</Text>
        <View style={rv.btns}>
          <TouchableOpacity style={rv.skip} onPress={onClose}>
            <Text style={rv.skipText}>나중에</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[rv.submit, (!rating || saving) && { opacity: 0.5 }]}
            onPress={submit} disabled={!rating || saving}>
            {saving ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={rv.submitText}>⭐ 후기 등록</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
const rv = StyleSheet.create({
  overlay:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#00000055' },
  sheet:    { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff',
              borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 6 },
  handle:   { width: 36, height: 4, backgroundColor: '#E8E8E8', borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  store:    { fontSize: 13, color: '#999', fontWeight: '600', textAlign: 'center' },
  coupon:   { fontSize: 16, fontWeight: '800', color: '#101010', textAlign: 'center', marginBottom: 4 },
  prompt:   { fontSize: 15, color: '#444', textAlign: 'center', marginBottom: 8 },
  stars:    { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 4 },
  star:     { fontSize: 38 },
  label:    { textAlign: 'center', fontSize: 14, color: COLORS.primary, fontWeight: '700', marginBottom: 8 },
  input:    { borderWidth: 1, borderColor: '#EBEBEB', borderRadius: 12, padding: 12,
              fontSize: 14, color: '#101010', minHeight: 80, textAlignVertical: 'top', marginTop: 4 },
  count:    { textAlign: 'right', fontSize: 11, color: '#BBB', marginBottom: 4 },
  btns:     { flexDirection: 'row', gap: 10, marginTop: 4 },
  skip:     { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F5F5F5', alignItems: 'center' },
  skipText: { fontSize: 15, fontWeight: '700', color: '#999' },
  submit:   { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: '#5B67CA', alignItems: 'center' },
  submitText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});

// ─── 메인 화면 ──────────────────────────────────────────────────────
export default function CouponListScreen() {
  const bottomPad = useMiniPlayerPadding(true);
  const [activeTab,   setActiveTab]   = useState<Tab>('feed');
  const [sortMode,    setSortMode]    = useState<SortMode>('nearest');
  const [coupons,     setCoupons]     = useState<CouponRow[]>([]);
  const [posts,       setPosts]       = useState<StorePostRow[]>([]);
  const [myCoupons,   setMyCoupons]   = useState<UserCouponRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [userId,      setUserId]      = useState<string | null>(null);
  const [userLoc,     setUserLoc]     = useState<{ lat: number; lng: number } | null>(null);
  const [locationDong, setLocationDong] = useState<string | null>(null);

  // 배너
  const [banners,          setBanners]          = useState<BannerRow[]>([]);
  const [bannerDismissed,  setBannerDismissed]  = useState(false);

  // 좋아요
  const [likedPosts,   setLikedPosts]   = useState<Set<string>>(new Set());
  const [likedCoupons, setLikedCoupons] = useState<Set<string>>(new Set());
  const [couponLikes,  setCouponLikes]  = useState<Record<string, number>>({});
  const [postLikes,    setPostLikes]    = useState<Record<string, number>>({});

  // PICK
  const [pickedPosts,   setPickedPosts]   = useState<Set<string>>(new Set());
  const [pickedCoupons, setPickedCoupons] = useState<Set<string>>(new Set());
  const [couponPicks,   setCouponPicks]   = useState<Record<string, number>>({});
  const [postPicks,     setPostPicks]     = useState<Record<string, number>>({});

  // 후기 모달
  const [reviewTarget, setReviewTarget] = useState<{
    userCouponId: string; couponTitle: string; storeName: string;
    existingRating?: number; existingComment?: string;
  } | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());

  const navigation = useNavigation<any>();
  const isFocused  = useIsFocused();

  useEffect(() => { init(); }, []);
  useEffect(() => {
    if (isFocused && userId) fetchMyCoupons(userId).then(setMyCoupons).catch(() => {});
  }, [isFocused, userId]);

  const init = async () => {
    let session = await getSession();
    if (!session) { await new Promise(r => setTimeout(r, 800)); session = await getSession(); }
    const uid = session?.user.id ?? null;
    if (uid) setUserId(uid);

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLoc({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      try {
        const [geo] = await Location.reverseGeocodeAsync(loc.coords);
        const dong = geo?.district || geo?.subregion || geo?.city || null;
        setLocationDong(dong);
      } catch { /* 무시 */ }
    } else {
      setSortMode('recent'); // 위치 권한 없으면 최신순으로 폴백
    }
    await loadFeed(uid ?? undefined);
    setLoading(false);
  };

  const loadFeed = async (uid?: string) => {
    const [activeCoupons, feedPosts, activeBanners] = await Promise.all([
      fetchActiveCoupons().catch(() => [] as CouponRow[]),
      fetchStorePosts().catch(() => [] as StorePostRow[]),
      fetchActiveBanners().catch(() => [] as BannerRow[]),
    ]);
    setCoupons(activeCoupons);
    setPosts(feedPosts);
    setBanners(activeBanners);

    if (uid) {
      fetchMyCoupons(uid).then(setMyCoupons).catch(() => {});
      // 좋아요 + PICK 상태 로드
      const cids = activeCoupons.map(c => c.id);
      const pids = feedPosts.map(p => p.id);
      const [lc, lp, clikes, pc, pp, cpicks] = await Promise.all([
        getLikedSet(uid, 'coupon', cids).catch(() => new Set<string>()),
        getLikedSet(uid, 'post',   pids).catch(() => new Set<string>()),
        getCouponLikeCounts(cids).catch(() => ({} as Record<string, number>)),
        getPickedSet(uid, 'coupon', cids).catch(() => new Set<string>()),
        getPickedSet(uid, 'post',   pids).catch(() => new Set<string>()),
        getCouponPickCounts(cids).catch(() => ({} as Record<string, number>)),
      ]);
      setLikedCoupons(lc);
      setLikedPosts(lp);
      setCouponLikes(clikes);
      setPickedCoupons(pc);
      setPickedPosts(pp);
      setCouponPicks(cpicks);
      // 게시물 좋아요/픽 수는 DB cached
      const plcounts: Record<string, number> = {};
      const ppcounts: Record<string, number> = {};
      feedPosts.forEach(p => { plcounts[p.id] = p.like_count; ppcounts[p.id] = p.pick_count; });
      setPostLikes(plcounts);
      setPostPicks(ppcounts);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFeed(userId ?? undefined);
    setRefreshing(false);
  }, [userId]);

  // 좋아요 토글 (낙관적 업데이트)
  const handleLike = async (type: 'post' | 'coupon', id: string) => {
    if (!userId) { Alert.alert('로그인이 필요해요', '', [
      { text: '취소', style: 'cancel' },
      { text: '로그인', onPress: () => navigation.navigate('Login') },
    ]); return; }

    const isLiked = type === 'post' ? likedPosts.has(id) : likedCoupons.has(id);
    const delta   = isLiked ? -1 : 1;

    // 낙관적 업데이트
    if (type === 'post') {
      setLikedPosts(prev => { const s = new Set(prev); isLiked ? s.delete(id) : s.add(id); return s; });
      setPostLikes(prev => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));
    } else {
      setLikedCoupons(prev => { const s = new Set(prev); isLiked ? s.delete(id) : s.add(id); return s; });
      setCouponLikes(prev => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));
    }

    // 서버 반영
    try {
      const res = await toggleLike(type, id);
      if (type === 'post')   setPostLikes(prev => ({ ...prev, [id]: res.like_count }));
      else                   setCouponLikes(prev => ({ ...prev, [id]: res.like_count }));
    } catch { /* 낙관적 업데이트 유지 */ }
  };

  // PICK 토글 (낙관적 업데이트)
  const handlePick = async (type: 'post' | 'coupon', id: string) => {
    if (!userId) { Alert.alert('로그인이 필요해요', '', [
      { text: '취소', style: 'cancel' },
      { text: '로그인', onPress: () => navigation.navigate('Login') },
    ]); return; }

    const isPicked = type === 'post' ? pickedPosts.has(id) : pickedCoupons.has(id);
    const delta    = isPicked ? -1 : 1;

    if (type === 'post') {
      setPickedPosts(prev => { const s = new Set(prev); isPicked ? s.delete(id) : s.add(id); return s; });
      setPostPicks(prev => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));
    } else {
      setPickedCoupons(prev => { const s = new Set(prev); isPicked ? s.delete(id) : s.add(id); return s; });
      setCouponPicks(prev => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));
    }

    try {
      const res = await togglePick(type, id);
      if (type === 'post')   setPostPicks(prev => ({ ...prev, [id]: res.pick_count }));
      else                   setCouponPicks(prev => ({ ...prev, [id]: res.pick_count }));
    } catch { /* 낙관적 업데이트 유지 */ }
  };

  // 쿠폰 공유
  const handleShare = async (coupon: CouponRow) => {
    const kind = getCouponKindConfig(coupon.coupon_kind);
    const disc = coupon.discount_type === 'percent'
      ? `${coupon.discount_value}% 할인`
      : coupon.discount_value > 0
        ? `${coupon.discount_value.toLocaleString()}원 할인`
        : '무료 제공';
    const expiry = new Date(coupon.expires_at).toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const msg = [
      `${kind.emoji} [${kind.label}] ${coupon.title}`,
      ``,
      `🏪 ${coupon.store?.name ?? ''}`,
      coupon.store?.district?.name ? `📍 ${coupon.store.district.name}` : '',
      `💰 ${disc}`,
      `📅 마감: ${expiry}`,
      ``,
      `언니픽 앱에서 무료로 받아보세요!`,
    ].filter(Boolean).join('\n');

    try {
      await Share.share(
        Platform.OS === 'ios'
          ? { title: coupon.title, message: msg }
          : { message: msg },
      );
    } catch { /* 취소 */ }
  };

  // 후기 열기
  const openReview = async (uc: UserCouponRow) => {
    try {
      const existing = await getMyReview(uc.id);
      setReviewTarget({
        userCouponId:    uc.id,
        couponTitle:     uc.coupon.title,
        storeName:       uc.coupon.store?.name ?? '가게',
        existingRating:  existing?.rating,
        existingComment: existing?.comment ?? undefined,
      });
    } catch {
      setReviewTarget({ userCouponId: uc.id, couponTitle: uc.coupon.title, storeName: uc.coupon.store?.name ?? '가게' });
    }
  };

  const getStoreDistText = (store?: { latitude?: number | null; longitude?: number | null } | null) => {
    if (!userLoc || !store) return null;
    const { latitude: lat, longitude: lng } = store;
    if (lat == null || lng == null) return null;
    return formatDist(distanceM(userLoc.lat, userLoc.lng, lat, lng));
  };

  const getDistText = (coupon: CouponRow) => getStoreDistText(coupon.store);

  // 피드 병합 (쿠폰 + 게시물)
  const feedItems: FeedItem[] = useMemo(() => [
    ...coupons.map(c => ({ kind: 'coupon' as const, data: c, key: `coupon-${c.id}` })),
    ...posts.map(p => ({ kind: 'post'   as const, data: p, key: `post-${p.id}`   })),
  ], [coupons, posts]);

  // 거리 helper (meter)
  const getDistM = (item: FeedItem): number | null => {
    if (!userLoc) return null;
    const store = item.kind === 'coupon'
      ? (item.data as CouponRow).store
      : (item.data as StorePostRow).store;
    const lat = store?.latitude;
    const lng = store?.longitude;
    if (lat == null || lng == null) return null;
    return distanceM(userLoc.lat, userLoc.lng, lat, lng);
  };

  // 정렬된 피드
  const sortedFeedItems: FeedItem[] = useMemo(() => {
    const base = [...feedItems].sort((a, b) =>
      new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime()
    );
    switch (sortMode) {
      case 'nearest':
        return base.sort((a, b) => {
          const da = getDistM(a), db = getDistM(b);
          if (da == null && db == null) return 0;
          if (da == null) return 1;
          if (db == null) return -1;
          return da - db;
        });
      case 'likes':
        return base.sort((a, b) => {
          const la = a.kind === 'post'
            ? (postLikes[a.data.id]   ?? (a.data as StorePostRow).like_count)
            : (couponLikes[a.data.id] ?? 0);
          const lb = b.kind === 'post'
            ? (postLikes[b.data.id]   ?? (b.data as StorePostRow).like_count)
            : (couponLikes[b.data.id] ?? 0);
          return lb - la;
        });
      case 'pick':
        return base.sort((a, b) => {
          const pa = a.kind === 'post'
            ? (postPicks[a.data.id]   ?? (a.data as StorePostRow).pick_count ?? 0)
            : (couponPicks[a.data.id] ?? (a.data as CouponRow).pick_count ?? 0);
          const pb = b.kind === 'post'
            ? (postPicks[b.data.id]   ?? (b.data as StorePostRow).pick_count ?? 0)
            : (couponPicks[b.data.id] ?? (b.data as CouponRow).pick_count ?? 0);
          return pb - pa;
        });
      default: // 'recent'
        return base;
    }
  }, [feedItems, sortMode, userLoc, postLikes, couponLikes, postPicks, couponPicks]);

  // 내 쿠폰 정렬
  const sortedMyCoupons: UserCouponRow[] = useMemo(() => {
    const base = [...myCoupons].sort((a, b) =>
      new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
    );
    switch (sortMode) {
      case 'nearest':
        return base.sort((a, b) => {
          const da = getStoreDistText(a.coupon.store) ? distanceM(userLoc!.lat, userLoc!.lng, a.coupon.store!.latitude!, a.coupon.store!.longitude!) : null;
          const db = getStoreDistText(b.coupon.store) ? distanceM(userLoc!.lat, userLoc!.lng, b.coupon.store!.latitude!, b.coupon.store!.longitude!) : null;
          if (da == null && db == null) return 0;
          if (da == null) return 1;
          if (db == null) return -1;
          return da - db;
        });
      case 'likes':
        return base.sort((a, b) =>
          (couponLikes[b.coupon.id] ?? 0) - (couponLikes[a.coupon.id] ?? 0)
        );
      case 'pick':
        return base.sort((a, b) =>
          (couponPicks[b.coupon.id] ?? b.coupon.pick_count ?? 0) -
          (couponPicks[a.coupon.id] ?? a.coupon.pick_count ?? 0)
        );
      default:
        return base;
    }
  }, [myCoupons, sortMode, userLoc, couponLikes, couponPicks]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator style={{ flex: 1 }} color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* 헤더 */}
      <View style={s.header}>
        <Text style={s.headerTitle}>쿠폰함</Text>
        {(locationDong || userLoc) && (
          <Text style={s.locBadge}>📍 {locationDong ?? '내 위치'}</Text>
        )}
      </View>

      {/* 내 쿠폰 섹션 헤더 */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>내 쿠폰</Text>
        {myCoupons.length > 0 && (
          <View style={s.sectionBadge}>
            <Text style={s.sectionBadgeText}>{myCoupons.length}</Text>
          </View>
        )}
      </View>

      {/* 정렬 바 고정 (양쪽 탭 공통) */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        stickyHeaderIndices={[0]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* ── 정렬 바 — sticky 헤더 ── */}
        <View style={s.sortBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.sortBarInner}>
            {([
              { key: 'recent',  label: '최신순' },
              { key: 'nearest', label: '가까운순' },
              { key: 'likes',   label: '❤️ 좋아요' },
              { key: 'pick',    label: '⭐ 찜순' },
            ] as { key: SortMode; label: string }[]).map(opt => {
              const isActive = sortMode === opt.key;
              const disabled = opt.key === 'nearest' && !userLoc;
              return (
                <TouchableOpacity key={opt.key}
                  style={[s.sortChip, isActive && s.sortChipActive, disabled && s.sortChipDisabled]}
                  onPress={() => {
                    if (disabled) { Alert.alert('위치 정보가 없어요', '위치 권한을 허용해주세요'); return; }
                    setSortMode(opt.key);
                  }} activeOpacity={0.75}>
                  <Text style={[s.sortChipText, isActive && s.sortChipTextActive, disabled && { color: '#CCC' }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── 내 쿠폰 ── */}
        {sortedMyCoupons.length === 0
          ? <EmptyState message={'받은 쿠폰이 없어요\n가게에서 쿠폰을 받아보세요!'} />
          : sortedMyCoupons.map((uc, i) => {
              const isOver    = uc.status === 'used' || uc.status === 'cancelled' || uc.status === 'noshow';
              const canCancel = uc.status === 'available' && canCancelCoupon(uc.coupon.expires_at);
              return (
                <MotiView
                  key={uc.id}
                  from={{ opacity: 0, translateY: 24, scale: 0.97 }}
                  animate={{ opacity: 1, translateY: 0, scale: 1 }}
                  transition={{ type: 'timing', duration: 400, delay: i * 80 }}
                >
                  <CouponFeedItem
                    coupon={uc.coupon} distText={getDistText(uc.coupon)}
                    isLast={i === sortedMyCoupons.length - 1}
                    isLiked={likedCoupons.has(uc.coupon.id)} likeCount={couponLikes[uc.coupon.id] ?? 0}
                    isPicked={pickedCoupons.has(uc.coupon.id)} pickCount={couponPicks[uc.coupon.id] ?? uc.coupon.pick_count ?? 0}
                    isUsed={isOver} userStatus={uc.status}
                    onPress={() => uc.status === 'available' && navigation.navigate('MyCouponQR', { userCoupon: uc })}
                    onStorePress={uc.coupon.store?.id ? () => navigation.navigate('StoreHome', { storeId: uc.coupon.store!.id }) : undefined}
                    onLike={() => handleLike('coupon', uc.coupon.id)}
                    onPick={() => handlePick('coupon', uc.coupon.id)}
                    onShare={() => handleShare(uc.coupon)}
                  />
                  {/* 후기 */}
                  {uc.status === 'used' && (
                    <TouchableOpacity
                      style={[s.reviewBtn, reviewedIds.has(uc.id) && s.reviewBtnDone]}
                      onPress={() => openReview(uc)} activeOpacity={0.8}>
                      <Text style={[s.reviewBtnText, reviewedIds.has(uc.id) && { color: '#999' }]}>
                        {reviewedIds.has(uc.id) ? '⭐ 후기 수정하기' : '⭐ 후기 남기기'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {/* 취소 기한 */}
                  {uc.status === 'available' && (
                    <View style={[s.cancelBanner, !canCancel && s.cancelBannerExp]}>
                      <Text style={[s.cancelText, !canCancel && s.cancelTextExp]}>
                        {canCancel
                          ? `🚫 ${cancelDeadlineText(uc.coupon.expires_at)} · 당일 취소 불가`
                          : '🚫 취소 기한 초과 · 노쇼 적용'}
                      </Text>
                    </View>
                  )}
                </MotiView>
              );
            })
        }

        {/* 배너 */}
        {!bannerDismissed && banners.length > 0 && (
          <FloatingBanner banners={banners} onClose={() => setBannerDismissed(true)}
            onPress={b => {
              if (b.link_type === 'store'  && b.link_value) navigation.navigate('StoreHome', { storeId: b.link_value });
              if (b.link_type === 'coupon' && b.link_value) navigation.navigate('CouponDetail', { couponId: b.link_value });
            }} />
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* 후기 모달 */}
      {reviewTarget && (
        <ReviewModal visible={!!reviewTarget}
          couponTitle={reviewTarget.couponTitle} storeName={reviewTarget.storeName}
          userCouponId={reviewTarget.userCouponId}
          existingRating={reviewTarget.existingRating} existingComment={reviewTarget.existingComment}
          onClose={() => setReviewTarget(null)}
          onSubmit={() => {
            setReviewedIds(prev => new Set([...prev, reviewTarget.userCouponId]));
            setReviewTarget(null);
            Alert.alert('감사해요! 🙏', '후기가 등록됐어요');
          }} />
      )}
    </SafeAreaView>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyEmoji}>🎟</Text>
      <Text style={s.emptyText}>{message}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#F0F2F5' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                 paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10,
                 backgroundColor: '#F0F2F5' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#191F28', letterSpacing: -0.5 },
  locBadge:    { fontSize: 12, color: '#2DB87A', fontWeight: '600' },

  sectionHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8,
                       paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#F0F2F5' },
  sectionTitle:      { fontSize: 16, fontWeight: '800', color: '#191F28' },
  sectionBadge:      { backgroundColor: '#FF6F0F', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  sectionBadgeText:  { fontSize: 12, fontWeight: '800', color: '#fff' },

  // 정렬 바 — sticky header이므로 배경색 + 그림자 필수
  sortBar: {
    backgroundColor: '#F0F2F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EAED',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 10,
  },
  sortBarInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  sortChip:      { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
                   backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8EAED' },
  sortChipActive:{ backgroundColor: '#FF6F0F', borderColor: '#FF6F0F' },
  sortChipDisabled: { opacity: 0.45 },
  sortChipText:  { fontSize: 12, fontWeight: '700', color: '#8B95A1' },
  sortChipTextActive: { color: '#fff' },

  reviewBtn:     { marginHorizontal: 16, marginTop: -4, marginBottom: 8, paddingVertical: 9,
                   borderRadius: 8, backgroundColor: '#F8F7FF', borderWidth: 1, borderColor: '#5B67CA33', alignItems: 'center' },
  reviewBtnDone: { backgroundColor: '#F5F5F5', borderColor: '#E8E8E8' },
  reviewBtnText: { fontSize: 13, fontWeight: '700', color: '#5B67CA' },

  cancelBanner:  { marginHorizontal: 16, marginTop: -4, marginBottom: 8, backgroundColor: '#FFFBEB',
                   borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#FDE68A' },
  cancelBannerExp: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  cancelText:    { fontSize: 11, color: '#92400E', fontWeight: '600' },
  cancelTextExp: { color: '#991B1B' },

  empty:      { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyText:  { fontSize: 14, color: '#AAAAAA', textAlign: 'center', lineHeight: 22 },
});
