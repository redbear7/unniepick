/**
 * HomeScreen — 언니픽 홈 피드 (디자인 목업 A1)
 *
 * feed-card 기반 피드: 팔로우 가게의 쿠폰을 피드 형태로 보여줌
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '../../lib/supabase';
import {
  getHomeFeed,
  FeedCoupon,
  HomeFeedResult,
  formatExpiry,
} from '../../lib/services/feedService';

const SCREEN_W = Dimensions.get('window').width;
const BANNER_SKIP_KEY = 'banner_skip_until';

// ── 배너 타입 ─────────────────────────────────────────────────────
interface Banner {
  id:            string;
  title:         string;
  subtitle:      string | null;
  image_url:     string | null;
  link_url:      string | null;
  bg_color:      string;
  display_order: number;
}

// ── 주변 가게 타입 ────────────────────────────────────────────────
interface NearbyStore {
  store_id:            string;
  store_name:          string;
  distance_km:         number;
  active_coupon_count: number;
  category?:           string;
  follower_count?:     number;
}

// ── 테마 ──────────────────────────────────────────────────────────
const C = {
  brand:    '#FF6F0F',
  brand2:   '#FF9A3D',
  brandBg:  '#FFF3EB',
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

// ── 카테고리 설정 ─────────────────────────────────────────────────
const CAT_EMOJI: Record<string, string> = {
  cafe: '☕', food: '🍽', beauty: '✂️', nail: '💅', etc: '🏪',
};
const THUMB_BG: Record<string, string> = {
  cafe: '#FFF0E6', food: '#FFF8E6', beauty: '#F0EEFF', nail: '#FFE6F5', etc: '#E6F5FF',
};

// ── 가게 아바타 그라디언트 색상 ───────────────────────────────────
const AVATAR_COLORS = [
  '#FF6F0F', '#FF9A3D', '#5B67CA', '#2DB87A',
  '#D946B0', '#FF6B6B', '#4C9EFF', '#F59E0B',
];
function avatarColor(name: string): string {
  const code = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[code];
}

// ── 쿠폰 뱃지 레이블 ─────────────────────────────────────────────
function urgencyBadgeLabel(coupon: FeedCoupon): string | null {
  if (!coupon.urgency_label) return null;
  const msLeft = new Date(coupon.expires_at).getTime() - Date.now();
  const hoursLeft = msLeft / 3_600_000;
  if (hoursLeft <= 24) return '오늘만';
  if (coupon.remaining !== null && coupon.remaining <= 10) return '인기';
  const daysSince = (Date.now() - new Date(coupon.created_at).getTime()) / 86_400_000;
  if (daysSince <= 2) return 'NEW';
  return null;
}

// ── 팔로우 버튼 (피드용) ─────────────────────────────────────────
function FollowButton({
  followed,
  onPress,
}: {
  followed: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[fbs.btn, followed && fbs.btnOn]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[fbs.text, followed && fbs.textOn]}>
        {followed ? '팔로잉' : '+ 팔로우'}
      </Text>
    </TouchableOpacity>
  );
}
const fbs = StyleSheet.create({
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.brand,
    backgroundColor: C.white,
  },
  btnOn: {
    backgroundColor: C.brand,
    borderColor: C.brand,
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    color: C.brand,
  },
  textOn: {
    color: C.white,
  },
});

// ── 쿠폰 인라인 카드 (목업 B 스타일) ─────────────────────────────
function CouponInline({
  coupon,
  saved,
  onClaim,
}: {
  coupon: FeedCoupon;
  saved: boolean;
  onClaim: () => void;
}) {
  const badge    = urgencyBadgeLabel(coupon);
  const remaining = coupon.remaining;
  const hasLimit  = coupon.total_quantity !== null && coupon.total_quantity > 0;
  const isUrgent  = remaining !== null && remaining <= 10;

  const msLeft    = new Date(coupon.expires_at).getTime() - Date.now();
  const dDay      = Math.ceil(msLeft / 86_400_000);
  const expiryStr = dDay <= 0 ? '오늘 마감' : dDay === 1 ? '내일 마감' : `D-${dDay}`;
  const isToday   = dDay <= 1;

  return (
    <View style={ci.wrap}>
      {/* 제목 행 + 뱃지 */}
      <View style={ci.titleRow}>
        <Text style={ci.title} numberOfLines={1}>{coupon.title}</Text>
        {badge && (
          <View style={ci.badge}>
            <Text style={ci.badgeText}>{badge}</Text>
          </View>
        )}
      </View>

      {/* 설명 */}
      {!!coupon.description && (
        <Text style={ci.desc} numberOfLines={1}>{coupon.description}</Text>
      )}

      {/* 하단 행 */}
      <View style={ci.footer}>
        <View style={ci.footerLeft}>
          <Text style={[ci.expiry, isToday && ci.expiryUrgent]}>
            {isToday ? '⏰' : '📅'} {expiryStr}
          </Text>
          {hasLimit && remaining !== null && (
            <Text style={[ci.remain, isUrgent && ci.remainUrgent]}>
              {isUrgent ? '🔥' : '·'} 잔여 {remaining}장
            </Text>
          )}
        </View>

        {/* 받기 / 저장됨 */}
        <TouchableOpacity
          style={[ci.claimBtn, saved && ci.claimBtnSaved]}
          onPress={onClaim}
          disabled={saved}
          activeOpacity={0.85}
        >
          <Text style={[ci.claimText, saved && ci.claimTextSaved]}>
            {saved ? '저장됨' : '받기'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const ci = StyleSheet.create({
  wrap: {
    marginTop: 10,
    marginHorizontal: 14,
    backgroundColor: C.brandBg,
    borderWidth: 1.5,
    borderColor: C.brand,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: C.g900,
    letterSpacing: -0.4,
  },
  badge: {
    backgroundColor: C.brand,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 0.3,
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
    marginTop: 2,
  },
  footerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  expiry: {
    fontSize: 13,
    color: C.g500,
    fontWeight: '500',
  },
  expiryUrgent: {
    color: C.g700,
  },
  remain: {
    fontSize: 13,
    color: C.g500,
    fontWeight: '500',
  },
  remainUrgent: {
    color: C.brand,
    fontWeight: '700',
  },
  claimBtn: {
    backgroundColor: C.brand,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 22,
    flexShrink: 0,
  },
  claimBtnSaved: {
    backgroundColor: C.g200,
  },
  claimText: {
    fontSize: 14,
    fontWeight: '800',
    color: C.white,
  },
  claimTextSaved: {
    color: C.g500,
  },
});

// ── 피드 카드 ─────────────────────────────────────────────────────
function FeedCard({
  coupon,
  followed,
  saved,
  onFollow,
  onClaim,
  onPress,
}: {
  coupon: FeedCoupon;
  followed: boolean;
  saved: boolean;
  onFollow: () => void;
  onClaim: () => void;
  onPress: () => void;
}) {
  const timeAgo = (() => {
    const diff = Date.now() - new Date(coupon.created_at).getTime();
    const mins  = Math.floor(diff / 60_000);
    if (mins < 1)   return '방금';
    if (mins < 60)  return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    if (hours < 48) return '어제';
    return `${Math.floor(hours / 24)}일 전`;
  })();

  // 카테고리 이모지 매핑
  const catKey    = (coupon.store_category ?? 'etc').toLowerCase();
  const catEmoji  = CAT_EMOJI[catKey] ?? '';
  const catLabel  = catEmoji ? `${catEmoji} ${coupon.store_category ?? ''}` : (coupon.store_category ?? '');

  return (
    <TouchableOpacity style={fcs.card} onPress={onPress} activeOpacity={0.97}>
      {/* 헤더 */}
      <View style={fcs.header}>
        {/* 사각형 아바타 */}
        <View style={[fcs.avatar, { backgroundColor: avatarColor(coupon.store_name) }]}>
          <Text style={fcs.avatarText}>
            {coupon.store_name.charAt(0)}
          </Text>
        </View>

        {/* 가게명 + 카테고리·시간 */}
        <View style={fcs.headerInfo}>
          <Text style={fcs.storeName}>{coupon.store_name}</Text>
          <Text style={fcs.storeMeta}>{catLabel} · {timeAgo}</Text>
        </View>

        {/* 팔로우 버튼 */}
        <FollowButton followed={followed} onPress={onFollow} />
      </View>

      {/* 캡션 */}
      {coupon.description ? (
        <Text style={fcs.caption} numberOfLines={2}>
          ⚡ {coupon.description}
        </Text>
      ) : null}

      {/* 쿠폰 카드 */}
      <CouponInline coupon={coupon} saved={saved} onClaim={onClaim} />

      {/* 액션 row */}
      <View style={fcs.actionRow}>
        <Text style={fcs.actionItem}>🎫 쿠폰 1개</Text>
        <Text style={fcs.actionItem}>❤️ {coupon.pick_count}</Text>
        <Text style={fcs.actionItem}>💬 {coupon.click_count}</Text>
      </View>
    </TouchableOpacity>
  );
}
const fcs = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    paddingTop: 16,
    paddingBottom: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.g200,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 8,
  },
  // 사각형 아바타 (목업 일치)
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '900',
    color: C.white,
  },
  headerInfo: {
    flex: 1,
    gap: 3,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '800',
    color: C.g900,
    letterSpacing: -0.3,
  },
  storeMeta: {
    fontSize: 13,
    color: C.g500,
    fontWeight: '400',
  },
  caption: {
    fontSize: 14,
    color: C.g700,
    lineHeight: 20,
    paddingHorizontal: 16,
    marginBottom: 2,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.g100,
  },
  actionItem: {
    fontSize: 13,
    color: C.g500,
    fontWeight: '500',
  },
});

// ── 바텀 배너 모달 ────────────────────────────────────────────────
function BannerModal({
  banners,
  onClose,
  onSkipToday,
}: {
  banners:      Banner[];
  onClose:      () => void;
  onSkipToday:  () => void;
}) {
  const slideY  = useRef(new Animated.Value(400)).current;
  const [page, setPage] = useState(0);
  const flatRef = useRef<FlatList<Banner>>(null);

  useEffect(() => {
    Animated.spring(slideY, {
      toValue: 0,
      useNativeDriver: true,
      speed: 16,
      bounciness: 4,
    }).start();
  }, []);

  const dismiss = (cb: () => void) => {
    Animated.timing(slideY, {
      toValue: 500,
      duration: 220,
      useNativeDriver: true,
    }).start(cb);
  };

  return (
    <Modal transparent animationType="none" statusBarTranslucent>
      {/* 딤 배경 */}
      <TouchableOpacity
        style={bm.dim}
        activeOpacity={1}
        onPress={() => dismiss(onClose)}
      />

      {/* 바텀 시트 */}
      <Animated.View style={[bm.sheet, { transform: [{ translateY: slideY }] }]}>
        {/* 캐러셀 */}
        <FlatList
          ref={flatRef}
          data={banners}
          keyExtractor={b => b.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={e => {
            setPage(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W));
          }}
          renderItem={({ item }) => (
            <View style={[bm.slide, { backgroundColor: item.bg_color, width: SCREEN_W }]}>
              {/* AD 뱃지 + 페이지 */}
              <View style={bm.topRow}>
                <View style={bm.adBadge}>
                  <Text style={bm.adText}>AD</Text>
                </View>
                <Text style={bm.pageText}>{page + 1} / {banners.length}</Text>
              </View>

              {/* 텍스트 */}
              <Text style={bm.title}>{item.title}</Text>
              {item.subtitle ? (
                <Text style={bm.subtitle}>{item.subtitle}</Text>
              ) : null}
            </View>
          )}
        />

        {/* 페이지 도트 */}
        {banners.length > 1 && (
          <View style={bm.dots}>
            {banners.map((_, i) => (
              <View key={i} style={[bm.dot, i === page && bm.dotActive]} />
            ))}
          </View>
        )}

        {/* 하단 버튼 */}
        <View style={bm.footer}>
          <TouchableOpacity onPress={() => dismiss(onSkipToday)} style={bm.footerBtn}>
            <Text style={bm.footerBtnText}>오늘 그만 보기</Text>
          </TouchableOpacity>
          <View style={bm.footerDivider} />
          <TouchableOpacity onPress={() => dismiss(onClose)} style={bm.footerBtn}>
            <Text style={[bm.footerBtnText, { color: C.g900, fontWeight: '700' }]}>닫기</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}
const bm = StyleSheet.create({
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  slide: {
    minHeight: 200,
    padding: 24,
    paddingTop: 20,
    justifyContent: 'flex-end',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  adBadge: {
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  adText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.white,
    letterSpacing: 1,
  },
  pageText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.4)',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: C.g900,
    lineHeight: 30,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: C.g600,
    lineHeight: 20,
    marginBottom: 8,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: C.white,
  },
  dot: {
    width: 6, height: 6,
    borderRadius: 3,
    backgroundColor: C.g300,
  },
  dotActive: {
    backgroundColor: C.brand,
    width: 16,
  },
  footer: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.g200,
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: C.g200,
  },
  footerBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: C.g500,
  },
});

// ── 주변 추천 가게 섹션 ───────────────────────────────────────────
const CAT_LABEL: Record<string, string> = {
  cafe: '카페', food: '음식', beauty: '미용', nail: '네일', etc: '기타',
};

function NearbySection({
  stores,
  followMap,
  onFollow,
  onPress,
}: {
  stores:    NearbyStore[];
  followMap: Record<string, boolean>;
  onFollow:  (id: string) => void;
  onPress:   (store: NearbyStore) => void;
}) {
  if (stores.length === 0) return null;
  return (
    <View style={ns.wrap}>
      <Text style={ns.title}>📍 주변 추천 가게</Text>
      {stores.map((store, idx) => {
        const catKey    = store.category ?? 'etc';
        const emoji     = CAT_EMOJI[catKey] ?? '🏪';
        const thumbBg   = THUMB_BG[catKey] ?? C.g100;
        const catLabel  = CAT_LABEL[catKey] ?? '기타';
        const followed  = !!followMap[store.store_id];
        const distText  = store.distance_km < 1
          ? `${Math.round(store.distance_km * 1000)}m`
          : `${store.distance_km.toFixed(1)}km`;
        const followers = store.follower_count ?? 0;

        return (
          <React.Fragment key={store.store_id}>
            <TouchableOpacity
              style={ns.item}
              onPress={() => onPress(store)}
              activeOpacity={0.8}
            >
              {/* 썸네일 */}
              <View style={[ns.thumb, { backgroundColor: thumbBg }]}>
                <Text style={ns.thumbEmoji}>{emoji}</Text>
              </View>

              {/* 본문 */}
              <View style={ns.body}>
                {/* 가게명 */}
                <Text style={ns.name} numberOfLines={1}>{store.store_name}</Text>

                {/* 카테고리 · 거리 */}
                <Text style={ns.meta}>{catLabel} · 📍 {distText}</Text>

                {/* 쿠폰 뱃지 + 팔로워 수 */}
                <View style={ns.statsRow}>
                  {store.active_coupon_count > 0 && (
                    <View style={ns.couponChip}>
                      <Text style={ns.couponChipText}>🎟 쿠폰 {store.active_coupon_count}개</Text>
                    </View>
                  )}
                  {followers > 0 && (
                    <Text style={ns.followers}>팔로워 {followers.toLocaleString()}</Text>
                  )}
                </View>
              </View>

              {/* 팔로우 버튼 (오렌지 pill) */}
              <TouchableOpacity
                style={[ns.followBtn, followed && ns.followBtnOn]}
                onPress={() => onFollow(store.store_id)}
                activeOpacity={0.8}
              >
                <Text style={[ns.followText, followed && ns.followTextOn]}>
                  {followed ? '팔로잉' : '+ 팔로우'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
            {idx < stores.length - 1 && <View style={ns.divider} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}
const ns = StyleSheet.create({
  wrap: {
    backgroundColor: C.white,
    marginTop: 8,
    paddingTop: 18,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.g150,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: C.g900,
    paddingHorizontal: 16,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  thumbEmoji: { fontSize: 34 },
  body: { flex: 1, minWidth: 0, gap: 4 },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: C.g900,
    letterSpacing: -0.3,
  },
  meta: {
    fontSize: 13,
    color: C.g500,
    fontWeight: '400',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  couponChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFEAEA',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  couponChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E53935',
  },
  followers: {
    fontSize: 13,
    color: C.g500,
    fontWeight: '400',
  },
  // 팔로우 버튼 — 오렌지 pill
  followBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.brand,
    backgroundColor: C.white,
    flexShrink: 0,
  },
  followBtnOn: {
    backgroundColor: C.brand,
    borderColor: C.brand,
  },
  followText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.brand,
  },
  followTextOn: {
    color: C.white,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.g200,
  },
});

// ── 빈 상태 ───────────────────────────────────────────────────────
function EmptyFeed({ onSearch }: { onSearch: () => void }) {
  return (
    <View style={es.wrap}>
      <Text style={es.emoji}>🎟</Text>
      <Text style={es.title}>팔로우한 가게의{'\n'}쿠폰이 여기 뜹니다</Text>
      <Text style={es.sub}>가게를 팔로우하면{'\n'}새 쿠폰을 즉시 알려드려요</Text>
      <TouchableOpacity style={es.btn} onPress={onSearch} activeOpacity={0.85}>
        <Text style={es.btnText}>🔍 주변 가게 찾기</Text>
      </TouchableOpacity>
    </View>
  );
}
const es = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 10,
  },
  emoji: {
    fontSize: 60,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: C.g900,
    textAlign: 'center',
    lineHeight: 32,
    letterSpacing: -0.4,
  },
  sub: {
    fontSize: 15,
    color: C.g500,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  btn: {
    backgroundColor: C.brand,
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 32,
    marginTop: 4,
  },
  btnText: {
    fontSize: 17,
    fontWeight: '700',
    color: C.white,
    letterSpacing: -0.2,
  },
});

// ══════════════════════════════════════════════════════════════════
//  메인 화면
// ══════════════════════════════════════════════════════════════════
export default function HomeScreen() {
  const navigation = useNavigation<any>();

  const [userId,        setUserId]        = useState<string | null>(null);
  const [feed,          setFeed]          = useState<HomeFeedResult | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [newBadge,      setNewBadge]      = useState(false);
  const [locationName,  setLocationName]  = useState<string>('');
  const [totalCoupons,  setTotalCoupons]  = useState<number>(0);
  const [myCoupons,     setMyCoupons]     = useState<number>(0);
  const [nearbyStores,  setNearbyStores]  = useState<NearbyStore[]>([]);
  const [nearbyFollowMap, setNearbyFollowMap] = useState<Record<string, boolean>>({});
  const [banners,       setBanners]       = useState<Banner[]>([]);
  const [bannerVisible, setBannerVisible] = useState(false);

  // 팔로우 상태 (store_id → boolean)
  const [followMap, setFollowMap] = useState<Record<string, boolean>>({});
  // 저장된 쿠폰 (coupon_id → boolean)
  const [savedMap,  setSavedMap]  = useState<Record<string, boolean>>({});

  const channelRef = useRef<RealtimeChannel | null>(null);
  const userIdRef  = useRef<string | null>(null);
  const followedStoreIdsRef = useRef<Set<string>>(new Set());

  // ── 인증 ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      userIdRef.current = data.user?.id ?? null;
    });
  }, []);

  // ── 현재 위치 + 주변 가게 fetch ─────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude: lat, longitude: lng } = loc.coords;

        // 위치명
        const [geo] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (geo) {
          const district = geo.district ?? geo.subregion ?? '';
          const city     = geo.city ?? geo.region ?? '';
          setLocationName(district ? `${city} ${district}`.trim() : city);
        }

        // 주변 가게 top 3
        const { data } = await supabase.rpc('get_nearby_stores', {
          user_lat:  lat,
          user_lng:  lng,
          radius_km: 9999,
          max_count: 3,
        });
        if (data && data.length > 0) {
          setNearbyStores(data as NearbyStore[]);
          // 팔로우 상태
          const { data: favData } = await supabase
            .from('store_favorites')
            .select('store_id')
            .in('store_id', (data as NearbyStore[]).map(s => s.store_id));
          const favSet = new Set((favData ?? []).map((r: any) => r.store_id));
          const fm: Record<string, boolean> = {};
          (data as NearbyStore[]).forEach(s => { fm[s.store_id] = favSet.has(s.store_id); });
          setNearbyFollowMap(fm);
        }
      } catch (_) {}
    })();
  }, []);

  // ── 배너 로드 + 오늘 그만보기 체크 ──────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        // 오늘 그만보기 체크
        const skipUntil = await AsyncStorage.getItem(BANNER_SKIP_KEY);
        if (skipUntil && new Date(skipUntil) > new Date()) return;

        const { data } = await supabase
          .from('banners')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (data && data.length > 0) {
          setBanners(data as Banner[]);
          // 0.8초 후 슬라이드업 (앱 로딩 후 자연스럽게)
          setTimeout(() => setBannerVisible(true), 800);
        }
      } catch (_) {}
    })();
  }, []);

  const handleBannerClose = () => setBannerVisible(false);
  const handleBannerSkipToday = async () => {
    const tomorrow = new Date();
    tomorrow.setHours(23, 59, 59, 999);
    await AsyncStorage.setItem(BANNER_SKIP_KEY, tomorrow.toISOString());
    setBannerVisible(false);
  };

  // ── 전체 쿠폰수 + 내 쿠폰수 ─────────────────────────────────────
  useEffect(() => {
    // 전체 활성 쿠폰수
    supabase
      .from('coupons')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .then(({ count }) => setTotalCoupons(count ?? 0));

    // 내 사용가능 쿠폰수 (로그인 시만)
    if (!userId) { setMyCoupons(0); return; }
    supabase
      .from('user_coupons')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'available')
      .then(({ count }) => setMyCoupons(count ?? 0));
  }, [userId]);

  // ── 피드 로드 ────────────────────────────────────────────────────
  const loadFeed = useCallback(async (silent = false) => {
    if (!userId) return;
    if (!silent) setLoading(true);
    try {
      const result = await getHomeFeed({ userId, limit: 60 });
      setFeed(result);
      setNewBadge(false);

      // 팔로우맵 + 팔로우 가게 ID 세트 업데이트
      const fm: Record<string, boolean> = {};
      const followed = new Set<string>();
      [...result.z1, ...result.z2, ...result.z3].forEach(c => {
        fm[c.store_id] = c.is_followed;
        if (c.is_followed) followed.add(c.store_id);
      });
      setFollowMap(fm);
      followedStoreIdsRef.current = followed;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) loadFeed();
  }, [userId, loadFeed]);

  // ── Supabase Realtime — 팔로우 가게 쿠폰 신규 발행 감지 ──────────
  useEffect(() => {
    if (!userId) return;

    // 기존 채널 정리
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`home-feed-${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'coupons',
          filter: 'is_active=eq.true',
        },
        (payload) => {
          const newCoupon = payload.new as { store_id: string; is_active: boolean };
          // 팔로우 가게에서 발행한 쿠폰이면 즉시 피드 갱신
          if (followedStoreIdsRef.current.has(newCoupon.store_id)) {
            setNewBadge(true);
            // 1초 딜레이 후 자동 갱신 (DB 반영 시간)
            setTimeout(() => {
              loadFeed(true);
            }, 1000);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'coupons',
        },
        () => {
          // 잔여 수량 변경 등 — 조용히 갱신
          loadFeed(true);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId, loadFeed]);

  const onRefresh = () => {
    setRefreshing(true);
    loadFeed(true);
  };

  // ── 팔로우 토글 ──────────────────────────────────────────────────
  const toggleFollow = async (storeId: string) => {
    if (!userId) return;
    const current = !!followMap[storeId];
    setFollowMap(prev => ({ ...prev, [storeId]: !current }));
    if (current) {
      await supabase
        .from('store_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('store_id', storeId);
    } else {
      await supabase
        .from('store_favorites')
        .insert({ user_id: userId, store_id: storeId });
    }
  };

  // ── 쿠폰 저장 토글 ───────────────────────────────────────────────
  const toggleSaved = async (couponId: string) => {
    if (!userId) return;
    const current = !!savedMap[couponId];
    setSavedMap(prev => ({ ...prev, [couponId]: !current }));
    if (current) {
      await supabase
        .from('coupon_picks')
        .delete()
        .eq('user_id', userId)
        .eq('coupon_id', couponId);
    } else {
      await supabase
        .from('coupon_picks')
        .insert({ user_id: userId, coupon_id: couponId });
    }
  };

  // ── 주변 가게 팔로우 토글 ────────────────────────────────────────
  const toggleNearbyFollow = async (storeId: string) => {
    if (!userId) return;
    const current = !!nearbyFollowMap[storeId];
    setNearbyFollowMap(prev => ({ ...prev, [storeId]: !current }));
    if (current) {
      await supabase.from('store_favorites').delete()
        .eq('user_id', userId).eq('store_id', storeId);
    } else {
      await supabase.from('store_favorites').insert({ user_id: userId, store_id: storeId });
    }
  };

  // ── 쿠폰 상세 이동 ───────────────────────────────────────────────
  const openCoupon = (coupon: FeedCoupon) => {
    navigation.navigate('CouponDetail', { couponId: coupon.id });
  };

  // ── 피드 아이템 조합 ─────────────────────────────────────────────
  const allCoupons: FeedCoupon[] = feed
    ? [...feed.z1, ...feed.z2, ...feed.z3]
    : [];

  // ── 앱바 ────────────────────────────────────────────────────────
  const AppBar = () => (
    <View style={s.appBar}>
      {/* 1행: 로고 + 현재위치 + 우측 아이콘 */}
      <View style={s.appBarRow1}>
        {/* 로고 + 위치 */}
        <View style={s.logoGroup}>
          <Text style={s.logo}>언니픽</Text>
          {locationName ? (
            <View style={s.locationChip}>
              <Text style={s.locationChipText}>📍 {locationName}</Text>
            </View>
          ) : null}
        </View>

        {/* 우측 버튼들 */}
        <View style={s.appBarRight}>
          {newBadge && (
            <TouchableOpacity
              style={s.newBadgeBtn}
              onPress={() => { setNewBadge(false); loadFeed(true); }}
            >
              <Text style={s.newBadgeText}>🎟 새 쿠폰 ↑</Text>
            </TouchableOpacity>
          )}
          {userId ? (
            <TouchableOpacity
              style={s.iconBtn}
              onLongPress={() => {
                Alert.alert('계정', '로그아웃 하시겠습니까?', [
                  { text: '취소', style: 'cancel' },
                  { text: '로그아웃', style: 'destructive', onPress: () => supabase.auth.signOut() },
                ]);
              }}
            >
              <Text style={{ fontSize: 16 }}>🔔</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={s.signupBtn}
              onPress={() => navigation.navigate('PhoneAuth')}
            >
              <Text style={s.signupBtnText}>회원가입</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.iconBtn} onPress={() => navigation.navigate('NearbyFeed')}>
            <Text style={{ fontSize: 16 }}>🔍</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2행: 쿠폰 카운트 (패셔너블 숫자) */}
      <View style={s.appBarRow2}>
        <View style={s.statBox}>
          <Text style={s.statNum}>{totalCoupons}</Text>
          <Text style={s.statLabel}>지역 쿠폰</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <Text style={[s.statNum, { color: C.brand }]}>{myCoupons}</Text>
          <Text style={s.statLabel}>내 쿠폰</Text>
        </View>
      </View>
    </View>
  );

  // ── 로딩 ─────────────────────────────────────────────────────────
  if (loading && !feed) {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar style="dark" />
        <AppBar />
        <View style={s.center}>
          <ActivityIndicator color={C.brand} size="large" />
          <Text style={s.loadingText}>쿠폰을 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="dark" />
      <AppBar />

      {/* 바텀 배너 모달 */}
      {bannerVisible && banners.length > 0 && (
        <BannerModal
          banners={banners}
          onClose={handleBannerClose}
          onSkipToday={handleBannerSkipToday}
        />
      )}

      {allCoupons.length === 0 ? (
        // 빈 피드: EmptyFeed + 주변 추천 가게
        <FlatList
          data={[]}
          keyExtractor={() => ''}
          renderItem={null}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />
          }
          ListHeaderComponent={
            <>
              <EmptyFeed onSearch={() => navigation.navigate('NearbyFeed')} />
              <NearbySection
                stores={nearbyStores}
                followMap={nearbyFollowMap}
                onFollow={toggleNearbyFollow}
                onPress={store => navigation.navigate('StoreFeed', { storeId: store.store_id, storeName: store.store_name, distanceKm: store.distance_km })}
              />
            </>
          }
        />
      ) : (
        <FlatList
          data={allCoupons}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />
          }
          ListFooterComponent={
            <NearbySection
              stores={nearbyStores}
              followMap={nearbyFollowMap}
              onFollow={toggleNearbyFollow}
              onPress={store => navigation.navigate('StoreFeed', { storeId: store.store_id, storeName: store.store_name, distanceKm: store.distance_km })}
            />
          }
          renderItem={({ item }) => (
            <FeedCard
              coupon={item}
              followed={!!followMap[item.store_id]}
              saved={!!savedMap[item.id]}
              onFollow={() => toggleFollow(item.store_id)}
              onClaim={() => toggleSaved(item.id)}
              onPress={() => openCoupon(item)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.g50,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: C.g500,
    marginTop: 8,
  },

  // 앱바
  appBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: C.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.g150,
    gap: 10,
  },

  // 1행
  appBarRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  logo: {
    fontSize: 30,
    fontWeight: '900',
    fontFamily: 'Pretendard-Black',
    color: C.brand,
    letterSpacing: -1,
  },
  locationChip: {
    backgroundColor: C.g100,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
  },
  locationChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.g700,
  },
  appBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.g100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signupBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: C.brand,
  },
  signupBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.white,
  },

  // 2행 — 쿠폰 카운트
  appBarRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
  },
  statNum: {
    fontSize: 28,
    fontWeight: '900',
    color: C.g900,
    letterSpacing: -1,
    lineHeight: 32,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: C.g500,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: C.g200,
    marginHorizontal: 8,
  },

  // 새 쿠폰 알림 뱃지
  newBadgeBtn: {
    backgroundColor: C.brand,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  newBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: C.white,
  },

  listContent: {
    paddingBottom: 24,
  },
});
