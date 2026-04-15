import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, Image, StyleSheet, ScrollView, Animated,
  TouchableOpacity, ActivityIndicator, RefreshControl,
  Modal, Pressable, Dimensions, useColorScheme,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import RollingBanner from '../../components/RollingBanner';
import BannerSlider from '../../components/BannerSlider';
import { fetchActivePopupNotice, PopupNoticeRow } from '../../lib/services/popupNoticeService';
import {
  fetchHomeFeed, HomeFeedPost, toggleLike, getLikedSet,
  togglePick, getPickedSet, AttachedPlaylist,
} from '../../lib/services/postService';
import { getCouponKindConfig, incrementCouponClick, CouponRow } from '../../lib/services/couponService';
import { getSession } from '../../lib/services/authService';
import { fetchCuratedPlaylists, Playlist } from '../../lib/services/musicService';
import { fetchCouponSections, ScoredCoupon, CouponSections } from '../../lib/services/couponRecommendService';
import { Alert } from 'react-native';
import { useMiniPlayerPadding } from '../../hooks/useMiniPlayerPadding';

// ─── 다크 / 라이트 테마 ───────────────────────────────────────────
const darkTheme = {
  bg:       '#111111',
  surface:  '#1C1C1C',
  elevated: '#242424',
  border:   '#2E2E2E',
  text:     '#F5F5F5',
  sub:      '#9A9A9A',
  muted:    '#5A5A5A',
  bodyText: '#CCCCCC',
  accent:   '#FF6F0F',
  accentBg: 'rgba(255,111,15,0.12)',
  cardShadowOpacity: 0.28,
  overlayBg: 'rgba(0,0,0,0.75)',
  playlistBg: '#1E1E1E',
  playlistBorder: '#2A2A2A',
};

const lightTheme = {
  bg:       '#F7F7F7',
  surface:  '#FFFFFF',
  elevated: '#FFFFFF',
  border:   '#EBEBEB',
  text:     '#1A1A1A',
  sub:      '#717171',
  muted:    '#BABABA',
  bodyText: '#484848',
  accent:   '#FF6F0F',
  accentBg: 'rgba(255,111,15,0.08)',
  cardShadowOpacity: 0.07,
  overlayBg: 'rgba(0,0,0,0.55)',
  playlistBg: '#FAFAFA',
  playlistBorder: '#EBEBEB',
};

type Theme = typeof darkTheme;

// ─── 상수 ───────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');
const todayKey = () => new Date().toISOString().slice(0, 10);

// ─── 무드 플레이리스트 로컬 fallback (DB 컬럼 추가 전) ──────────
const LOCAL_MOODS: Playlist[] = [
  { id: 'local-1', name: '카페 감성', cover_emoji: '☕', mood_tags: ['lo-fi', 'cozy', '75bpm'], track_count: 12, is_dynamic: true },
  { id: 'local-2', name: '활기찬 오전', cover_emoji: '🌅', mood_tags: ['upbeat', 'bright', '120bpm'], track_count: 10, is_dynamic: true },
  { id: 'local-3', name: '저녁 감성', cover_emoji: '🌙', mood_tags: ['chill', 'indie', '90bpm'], track_count: 14, is_dynamic: false },
  { id: 'local-4', name: '맛집 분위기', cover_emoji: '🍽', mood_tags: ['jazz', 'warm', '95bpm'], track_count: 9, is_dynamic: false },
  { id: 'local-5', name: '뷰티샵 BGM', cover_emoji: '💅', mood_tags: ['pop', 'trendy', '110bpm'], track_count: 11, is_dynamic: true },
  { id: 'local-6', name: '편의점 야간', cover_emoji: '🏪', mood_tags: ['ambient', 'night', '80bpm'], track_count: 8, is_dynamic: false },
];

// ─── 유틸 ────────────────────────────────────────────────────────
function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function formatDist(m: number): string {
  if (m < 100)  return '100m 이내';
  if (m < 1000) return `${Math.round(m / 10) * 10}m`;
  return `${(m / 1000).toFixed(1)}km`;
}
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 1)  return '방금';
  if (m < 60) return `${m}분 전`;
  if (h < 24) return `${h}시간 전`;
  return `${d}일 전`;
}

// ─── 스토어 아바타 컬러 ─────────────────────────────────────────
const STORE_COLORS = ['#5B67CA','#FF6B3D','#2DB87A','#D946B0','#F5A623','#0EA5E9','#8B5CF6'];
function storeColor(name: string) {
  return STORE_COLORS[name.charCodeAt(0) % STORE_COLORS.length];
}

// ─── 카테고리 목록 ────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'all',    label: '전체',   emoji: '' },
  { key: 'food',   label: '음식점', emoji: '🍽' },
  { key: 'cafe',   label: '카페',   emoji: '☕' },
  { key: 'beauty', label: '뷰티',   emoji: '💅' },
  { key: 'health', label: '건강',   emoji: '💪' },
  { key: 'mart',   label: '마트',   emoji: '🛒' },
  { key: 'etc',    label: '기타',   emoji: '✨' },
];

// ─── 큐레이션 무드 카드 ──────────────────────────────────────────
function MoodCard({ playlist, theme, onPress }: {
  playlist: Playlist;
  theme: Theme;
  onPress: () => void;
}) {
  const color = STORE_COLORS[(playlist.id.charCodeAt(playlist.id.length - 1) || 0) % STORE_COLORS.length];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={[mc.card, {
        backgroundColor: theme.surface,
        borderColor: theme.border,
        shadowOpacity: theme.cardShadowOpacity,
      }]}
    >
      <View style={[mc.cover, { backgroundColor: color + '22' }]}>
        <Text style={mc.emoji}>{playlist.cover_emoji ?? '🎵'}</Text>
        {playlist.is_dynamic && (
          <View style={[mc.aiBadge, { backgroundColor: theme.accent }]}>
            <Text style={mc.aiBadgeText}>AI</Text>
          </View>
        )}
      </View>
      <View style={mc.info}>
        <Text style={[mc.name, { color: theme.text }]} numberOfLines={1}>{playlist.name}</Text>
        <Text style={[mc.count, { color: theme.sub }]}>{playlist.track_count ?? 0}곡</Text>
      </View>
    </TouchableOpacity>
  );
}
const mc = StyleSheet.create({
  card: {
    width: 120, borderRadius: 14, borderWidth: 1,
    overflow: 'hidden', marginRight: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },
  cover:      { height: 90, alignItems: 'center', justifyContent: 'center' },
  emoji:      { fontSize: 36 },
  aiBadge:    {
    position: 'absolute', top: 7, right: 7,
    borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2,
  },
  aiBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  info:        { padding: 9, gap: 2 },
  name:        { fontSize: 12, fontWeight: '700', letterSpacing: -0.2 },
  count:       { fontSize: 11, fontWeight: '400' },
});

// ─── 큐레이션 섹션 ───────────────────────────────────────────────
function CuratedSection({ playlists, theme }: { playlists: Playlist[]; theme: Theme }) {
  return (
    <View style={[cs.wrap, { backgroundColor: theme.bg }]}>
      <View style={cs.header}>
        <Text style={[cs.title, { color: theme.text }]}>🎵 무드 플레이리스트</Text>
        <Text style={[cs.sub, { color: theme.sub }]}>AI + 시샵 큐레이션</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
      >
        {playlists.map(pl => (
          <MoodCard key={pl.id} playlist={pl} theme={theme} onPress={() => {}} />
        ))}
      </ScrollView>
    </View>
  );
}
const cs = StyleSheet.create({
  wrap:   { paddingTop: 16 },
  header: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 10,
  },
  title: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  sub:   { fontSize: 12, fontWeight: '500' },
});

// ─── 플레이리스트 첨부 카드 ─────────────────────────────────────
function PlaylistAttachCard({ playlist, theme }: { playlist: AttachedPlaylist; theme: Theme }) {
  const color = STORE_COLORS[(playlist.id.charCodeAt(0) || 0) % STORE_COLORS.length];
  return (
    <View style={[pa.card, { backgroundColor: theme.playlistBg, borderColor: theme.playlistBorder }]}>
      <View style={[pa.left, { backgroundColor: color + '22' }]}>
        <Text style={pa.emoji}>{playlist.cover_emoji ?? '🎵'}</Text>
        {playlist.is_dynamic && (
          <View style={[pa.aiBadge, { backgroundColor: theme.accent }]}>
            <Text style={pa.aiText}>AI</Text>
          </View>
        )}
      </View>
      <View style={pa.info}>
        <Text style={[pa.name, { color: theme.text }]} numberOfLines={1}>{playlist.name}</Text>
        <View style={pa.tagsRow}>
          {playlist.mood_tags.slice(0, 3).map(tag => (
            <View key={tag} style={[pa.tag, { backgroundColor: theme.accentBg }]}>
              <Text style={[pa.tagText, { color: theme.accent }]}>{tag}</Text>
            </View>
          ))}
        </View>
        <Text style={[pa.count, { color: theme.sub }]}>{playlist.track_count}곡</Text>
      </View>
      <View style={pa.playBtn}>
        <Text style={pa.playIcon}>▶</Text>
        <Text style={[pa.playText, { color: theme.sub }]}>듣기</Text>
      </View>
    </View>
  );
}
const pa = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 12, overflow: 'hidden',
    marginTop: 8,
  },
  left:    { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  emoji:   { fontSize: 26 },
  aiBadge: {
    position: 'absolute', top: 4, right: 4,
    borderRadius: 5, paddingHorizontal: 4, paddingVertical: 1,
  },
  aiText:  { fontSize: 8, fontWeight: '900', color: '#fff' },
  info:    { flex: 1, paddingVertical: 10, paddingHorizontal: 10, gap: 4 },
  name:    { fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  tagsRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  tag:     { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: '600' },
  count:   { fontSize: 11, fontWeight: '400' },
  playBtn: { paddingHorizontal: 14, alignItems: 'center', gap: 3 },
  playIcon:{ fontSize: 14, color: '#FF6F0F' },
  playText:{ fontSize: 10, fontWeight: '600' },
});

// ─── 쿠폰 첨부 카드 ─────────────────────────────────────────────
function CouponAttachCard({ coupon, onPress }: { coupon: CouponRow; onPress: () => void }) {
  const kind = getCouponKindConfig(coupon.coupon_kind);
  const disc = coupon.discount_type === 'percent'
    ? `${coupon.discount_value}% 할인`
    : coupon.discount_value > 0
      ? `${coupon.discount_value.toLocaleString()}원 할인`
      : '무료 제공';
  const remaining = coupon.total_quantity != null
    ? coupon.total_quantity - (coupon.issued_count ?? 0)
    : null;
  const expiry = coupon.expires_at
    ? new Date(coupon.expires_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[ca.card, { borderColor: kind.bg + '40' }]}
    >
      <View style={[ca.bar, { backgroundColor: kind.bg }]} />
      <View style={ca.body}>
        <View style={ca.top}>
          <Text style={[ca.emoji]}>{kind.emoji}</Text>
          <Text style={[ca.title]} numberOfLines={1}>{coupon.title}</Text>
          {remaining != null && remaining < 10 && (
            <View style={ca.urgentBadge}>
              <Text style={ca.urgentText}>잔여 {remaining}</Text>
            </View>
          )}
        </View>
        <View style={ca.bottom}>
          <Text style={[ca.disc, { color: kind.bg }]}>{disc}</Text>
          {expiry && <Text style={ca.expiry}>~ {expiry}</Text>}
        </View>
      </View>
      <Text style={[ca.arrow, { color: kind.bg }]}>›</Text>
    </TouchableOpacity>
  );
}
const ca = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 12, overflow: 'hidden',
    marginTop: 8, backgroundColor: '#fff',
  },
  bar:  { width: 4, alignSelf: 'stretch', minHeight: 56 },
  body: { flex: 1, paddingVertical: 10, paddingHorizontal: 11, gap: 3 },
  top:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  emoji:{ fontSize: 14 },
  title:{ flex: 1, fontSize: 13, fontWeight: '600', color: '#1A1A1A', letterSpacing: -0.2 },
  urgentBadge: { backgroundColor: '#FF3B30', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  urgentText:  { fontSize: 9, fontWeight: '700', color: '#fff' },
  bottom:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  disc:  { fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
  expiry:{ fontSize: 11, color: '#9A9A9A' },
  arrow: { fontSize: 22, fontWeight: '300', paddingHorizontal: 12 },
});

// ─── 액션 버튼 ──────────────────────────────────────────────────
function ActionBtn({
  icon, activeIcon, count, isActive, onPress, activeColor, theme,
}: {
  icon: string; activeIcon: string; count: number; isActive: boolean;
  onPress: () => void; activeColor: string; theme: Theme;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const tap = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.4, duration: 80, useNativeDriver: true }),
      Animated.spring(scale,  { toValue: 1,   useNativeDriver: true }),
    ]).start();
    onPress();
  };
  return (
    <TouchableOpacity style={ab.wrap} onPress={tap} activeOpacity={0.7}>
      <Animated.Text style={[ab.icon, { transform: [{ scale }] }]}>
        {isActive ? activeIcon : icon}
      </Animated.Text>
      <Text style={{ fontSize: 12, fontWeight: '600', color: isActive ? activeColor : theme.sub }}>
        {count}
      </Text>
    </TouchableOpacity>
  );
}
const ab = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  icon: { fontSize: 16 },
});

// ─── 포스트 카드 (X/Threads 스타일) ──────────────────────────────
function PostCard({
  post, isLiked, likeCount, isPicked, pickCount, distText,
  onLike, onPick, onPress, onCouponPress, theme,
}: {
  post:          HomeFeedPost;
  isLiked:       boolean;
  likeCount:     number;
  isPicked:      boolean;
  pickCount:     number;
  distText?:     string | null;
  onLike:        () => void;
  onPick:        () => void;
  onPress:       () => void;
  onCouponPress: (c: CouponRow) => void;
  theme:         Theme;
}) {
  const storeName  = post.store?.name ?? '가게';
  const district   = post.store?.district?.name;
  const color      = storeColor(storeName);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.97}
      style={[pc.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      {/* ── 상단: 아바타 + 가게 정보 ── */}
      <View style={pc.header}>
        <View style={[pc.avatar, { backgroundColor: color + '33' }]}>
          <Text style={[pc.avatarText, { color }]}>{storeName.slice(0, 1)}</Text>
          <View style={[pc.avatarDot, { backgroundColor: color }]} />
        </View>
        <View style={pc.meta}>
          <Text style={[pc.storeName, { color: theme.text }]} numberOfLines={1}>{storeName}</Text>
          <Text style={[pc.metaSub, { color: theme.sub }]}>
            {[district, distText ? `📍 ${distText}` : null, timeAgo(post.created_at)]
              .filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

      {/* ── 본문 ── */}
      <Text style={[pc.content, { color: theme.bodyText }]}>{post.content}</Text>

      {/* ── 플레이리스트 첨부 ── */}
      {post.linked_playlist && (
        <PlaylistAttachCard playlist={post.linked_playlist} theme={theme} />
      )}

      {/* ── 쿠폰 첨부 ── */}
      {post.latest_coupon && (
        <CouponAttachCard
          coupon={post.latest_coupon}
          onPress={() => onCouponPress(post.latest_coupon!)}
        />
      )}

      {/* ── 액션 바 ── */}
      <View style={[pc.actions, { borderTopColor: theme.border }]}>
        <ActionBtn
          icon="🤍" activeIcon="❤️"
          count={likeCount} isActive={isLiked}
          onPress={onLike}
          activeColor="#E94560" theme={theme}
        />
        <View style={[ab.wrap, { opacity: 0.5 }]}>
          <Text style={ab.icon}>💬</Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.sub }}>0</Text>
        </View>
        <ActionBtn
          icon="🔖" activeIcon="🔖"
          count={pickCount} isActive={isPicked}
          onPress={onPick}
          activeColor={theme.accent} theme={theme}
        />
        <TouchableOpacity style={[ab.wrap, { marginLeft: 'auto' }]} activeOpacity={0.7}>
          <Text style={{ fontSize: 14, color: theme.muted }}>↗</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
const pc = StyleSheet.create({
  card: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingTop: 14, paddingHorizontal: 16, paddingBottom: 0,
  },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar:     {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: '800' },
  avatarDot:  {
    position: 'absolute', bottom: 0, right: 0,
    width: 11, height: 11, borderRadius: 6,
    borderWidth: 2, borderColor: '#fff',
  },
  meta:       { flex: 1 },
  storeName:  { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  metaSub:    { fontSize: 12, fontWeight: '400', marginTop: 1 },
  content:    { fontSize: 14, lineHeight: 22, letterSpacing: -0.1, marginBottom: 10 },
  actions:    {
    flexDirection: 'row', alignItems: 'center', gap: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10, marginTop: 4,
  },
});

// ─── 추천 쿠폰 미니 카드 ─────────────────────────────────────────
function RecommendCouponCard({ item, onPress, theme }: {
  item: ScoredCoupon; onPress: () => void; theme: Theme;
}) {
  const { coupon, distM, reason } = item;
  const kind = getCouponKindConfig(coupon.coupon_kind);
  const disc = coupon.discount_type === 'percent'
    ? `${coupon.discount_value}%`
    : coupon.discount_value > 0
      ? `${coupon.discount_value.toLocaleString()}원`
      : '무료';
  const storeName = (coupon.store as any)?.name ?? '가게';
  const distLabel = distM != null
    ? distM < 1000 ? `${Math.round(distM)}m` : `${(distM / 1000).toFixed(1)}km`
    : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[rcc.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={[rcc.top, { backgroundColor: kind.bg + '18' }]}>
        <Text style={rcc.emoji}>{kind.emoji}</Text>
        <Text style={[rcc.disc, { color: kind.bg }]}>{disc} 할인</Text>
      </View>
      <View style={rcc.body}>
        <Text style={[rcc.store, { color: theme.text }]} numberOfLines={1}>{storeName}</Text>
        <Text style={[rcc.title, { color: theme.sub }]} numberOfLines={1}>{coupon.title}</Text>
        <View style={rcc.footer}>
          <Text style={[rcc.reason, { color: theme.accent }]}>{reason}</Text>
          {distLabel && <Text style={[rcc.dist, { color: theme.muted }]}>{distLabel}</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}
const rcc = StyleSheet.create({
  card:   { width: 140, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  top:    { height: 72, alignItems: 'center', justifyContent: 'center', gap: 4 },
  emoji:  { fontSize: 26 },
  disc:   { fontSize: 15, fontWeight: '900' },
  body:   { padding: 10, gap: 2 },
  store:  { fontSize: 13, fontWeight: '700' },
  title:  { fontSize: 11, fontWeight: '400' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  reason: { fontSize: 10, fontWeight: '600' },
  dist:   { fontSize: 10 },
});

// ─── 추천 쿠폰 섹션 (수평 스크롤) ───────────────────────────────
function RecommendSection({ title, items, onPressItem, theme }: {
  title: string; items: ScoredCoupon[];
  onPressItem: (c: CouponRow) => void; theme: Theme;
}) {
  if (items.length === 0) return null;
  return (
    <View style={{ paddingTop: 20 }}>
      <Text style={[rs.title, { color: theme.text }]}>{title}</Text>
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 4 }}
      >
        {items.map(item => (
          <RecommendCouponCard
            key={item.coupon.id}
            item={item}
            theme={theme}
            onPress={() => onPressItem(item.coupon)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
const rs = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3, paddingHorizontal: 16, marginBottom: 10 },
});

// ─── 동적 스타일 생성 ────────────────────────────────────────────
function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },

    // 헤더
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12, backgroundColor: t.bg,
    },
    locationText:  { fontSize: 20, fontWeight: '800', color: t.text, letterSpacing: -0.44 },
    locationArrow: { fontSize: 12, color: t.sub, marginTop: 2 },

    // 카테고리 바
    catBar:    { backgroundColor: t.bg, paddingTop: 4 },
    catChip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 999, borderWidth: 1.5,
      borderColor: t.border, backgroundColor: t.surface,
    },
    catChipActive:  { borderColor: t.accent, backgroundColor: t.accentBg },
    catLabel:       { fontSize: 13, fontWeight: '600', color: t.sub },
    catLabelActive: { color: t.accent, fontWeight: '700' },
    catDivider:     { height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginTop: 2 },

    // 섹션 헤더
    sectionTitle: { fontSize: 17, fontWeight: '800', color: t.text, letterSpacing: -0.3 },
    sectionCount: { fontSize: 13, color: t.muted, fontWeight: '500' },

    // 피드 컨테이너
    feedContainer: { backgroundColor: t.surface, borderRadius: 0 },

    // 빈 상태
    emptyTitle: { fontSize: 18, fontWeight: '800', color: t.text, letterSpacing: -0.3 },
    emptySub:   { fontSize: 14, color: t.sub, textAlign: 'center', lineHeight: 22 },
    emptyBtn: {
      backgroundColor: t.accent, borderRadius: 999,
      paddingHorizontal: 24, paddingVertical: 13, marginTop: 4,
      shadowColor: t.accent, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
    },

    // 팝업
    overlay:          { flex: 1, backgroundColor: t.overlayBg,
                        justifyContent: 'center', alignItems: 'center', padding: 32 },
    popupCard:        { width: '100%', backgroundColor: t.elevated, borderRadius: 24, overflow: 'hidden' },
    popupTitle:       { fontSize: 18, fontWeight: '800', color: t.text,
                        textAlign: 'center', lineHeight: 26, letterSpacing: -0.3 },
    popupContent:     { fontSize: 14, color: t.sub, textAlign: 'center', lineHeight: 22 },
    popupBtnRow:      { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
    popupBtnSkip:     { flex: 1, paddingVertical: 16, alignItems: 'center',
                        borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: t.border },
    popupBtnSkipText: { fontSize: 13, color: t.sub },
  });
}

// ─── 메인 화면 ─────────────────────────────────────────────────
export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const bottomPad  = useMiniPlayerPadding(true);

  // ── 다크/라이트 모드 ──────────────────────────────────────────
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const T = isDark ? darkTheme : lightTheme;
  const s = useMemo(() => makeStyles(T), [isDark]);

  // ── 상태 ───────────────────────────────────────────────────
  const [feed,           setFeed]           = useState<HomeFeedPost[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [userId,         setUserId]         = useState<string | null>(null);
  const [likedPosts,     setLikedPosts]     = useState<Set<string>>(new Set());
  const [postLikes,      setPostLikes]      = useState<Record<string, number>>({});
  const [pickedPosts,    setPickedPosts]    = useState<Set<string>>(new Set());
  const [postPicks,      setPostPicks]      = useState<Record<string, number>>({});
  const [activeCategory, setActiveCategory] = useState('all');
  const [locationDong,   setLocationDong]   = useState('내 동네');
  const [userLoc,        setUserLoc]        = useState<{ lat: number; lng: number } | null>(null);
  const [popup,          setPopup]          = useState<PopupNoticeRow | null>(null);
  const [showPopup,      setShowPopup]      = useState(false);
  const [curatedList,    setCuratedList]    = useState<Playlist[]>(LOCAL_MOODS);
  const [couponSections, setCouponSections] = useState<CouponSections | null>(null);

  useEffect(() => {
    init();
    loadLocation();
    loadCurated();
  }, []);

  const loadLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setUserLoc(coords);
      const addr = await Location.reverseGeocodeAsync(loc.coords);
      if (addr[0]) {
        const dong = addr[0].district ?? addr[0].subregion ?? addr[0].city ?? '내 동네';
        setLocationDong(dong);
      }
      // 위치 확보 후 추천 쿠폰 로드
      loadRecommendedCoupons(coords.lat, coords.lng);
    } catch {}
  };

  const loadRecommendedCoupons = async (lat: number, lng: number) => {
    const session = await getSession().catch(() => null);
    const uid = session?.user.id ?? null;
    const sections = await fetchCouponSections({ userId: uid, lat, lng }).catch(() => null);
    if (sections) setCouponSections(sections);
  };

  const loadCurated = async () => {
    const remote = await fetchCuratedPlaylists().catch(() => []);
    if (remote.length > 0) setCuratedList(remote);
  };

  const init = async () => {
    const session = await getSession();
    const uid = session?.user.id ?? null;
    setUserId(uid);
    await loadFeed(uid);
    setLoading(false);
    loadPopup();
  };

  const loadFeed = async (uid: string | null) => {
    const posts = await fetchHomeFeed().catch(() => [] as HomeFeedPost[]);
    setFeed(posts);
    const plikes: Record<string, number> = {};
    const ppicks: Record<string, number> = {};
    posts.forEach(p => { plikes[p.id] = p.like_count; ppicks[p.id] = p.pick_count; });
    setPostLikes(plikes);
    setPostPicks(ppicks);
    if (uid && posts.length > 0) {
      const ids = posts.map(p => p.id);
      const [liked, picked] = await Promise.all([
        getLikedSet(uid, 'post', ids).catch(() => new Set<string>()),
        getPickedSet(uid, 'post', ids).catch(() => new Set<string>()),
      ]);
      setLikedPosts(liked);
      setPickedPosts(picked);
    }
  };

  const loadPopup = async () => {
    const notice = await fetchActivePopupNotice().catch(() => null);
    if (!notice) return;
    const skipped = await SecureStore.getItemAsync(`popup_skip_${notice.id}_${todayKey()}`);
    if (skipped === '1') return;
    setPopup(notice);
    setShowPopup(true);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFeed(userId);
    setRefreshing(false);
  }, [userId]);

  const handleLike = async (postId: string) => {
    if (!userId) {
      Alert.alert('로그인이 필요해요', '', [
        { text: '취소', style: 'cancel' },
        { text: '로그인', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }
    const isLiked = likedPosts.has(postId);
    const delta   = isLiked ? -1 : 1;
    setLikedPosts(prev => { const s = new Set(prev); isLiked ? s.delete(postId) : s.add(postId); return s; });
    setPostLikes(prev => ({ ...prev, [postId]: Math.max(0, (prev[postId] ?? 0) + delta) }));
    try {
      const res = await toggleLike('post', postId);
      setPostLikes(prev => ({ ...prev, [postId]: res.like_count }));
    } catch {}
  };

  const handlePick = async (postId: string) => {
    if (!userId) {
      Alert.alert('로그인이 필요해요', '', [
        { text: '취소', style: 'cancel' },
        { text: '로그인', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }
    const isPicked = pickedPosts.has(postId);
    const delta    = isPicked ? -1 : 1;
    setPickedPosts(prev => { const s = new Set(prev); isPicked ? s.delete(postId) : s.add(postId); return s; });
    setPostPicks(prev => ({ ...prev, [postId]: Math.max(0, (prev[postId] ?? 0) + delta) }));
    try {
      const res = await togglePick('post', postId);
      setPostPicks(prev => ({ ...prev, [postId]: res.pick_count }));
    } catch {}
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <RollingBanner />
        <ActivityIndicator style={{ flex: 1 }} color={T.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* 공지 롤링 배너 */}
      <RollingBanner />

      {/* ── 헤더 ── */}
      <View style={s.header}>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 15 }}>📍</Text>
          <Text style={s.locationText}>{locationDong}</Text>
          <Text style={s.locationArrow}>▾</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <TouchableOpacity style={{ padding: 8 }} onPress={() => navigation.navigate('CouponList')}>
            <Text style={{ fontSize: 22 }}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ padding: 8 }} onPress={() => navigation.navigate('MyPage')}>
            <Text style={{ fontSize: 22 }}>🔔</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />
        }
        stickyHeaderIndices={[3]}
      >
        {/* 0: 배너 슬라이더 */}
        <BannerSlider />

        {/* 1: 무드 플레이리스트 큐레이션 섹션 */}
        <CuratedSection playlists={curatedList} theme={T} />

        {/* 2: 추천 쿠폰 섹션 */}
        {couponSections && (
          <View style={{ backgroundColor: T.bg }}>
            <RecommendSection
              title="📍 지금 내 근처 쿠폰"
              items={couponSections.nearby}
              onPressItem={c => {
                incrementCouponClick(c.id).catch(() => {});
                navigation.navigate('CouponDetail', { coupon: c });
              }}
              theme={T}
            />
            <RecommendSection
              title={`⏰ 지금 이 시간 추천`}
              items={couponSections.timeMatch}
              onPressItem={c => {
                incrementCouponClick(c.id).catch(() => {});
                navigation.navigate('CouponDetail', { coupon: c });
              }}
              theme={T}
            />
            <RecommendSection
              title="🔥 마감 임박 쿠폰"
              items={couponSections.urgent}
              onPressItem={c => {
                incrementCouponClick(c.id).catch(() => {});
                navigation.navigate('CouponDetail', { coupon: c });
              }}
              theme={T}
            />
            {couponSections.favorites.length > 0 && (
              <RecommendSection
                title="⭐ 즐겨찾기 가게 쿠폰"
                items={couponSections.favorites}
                onPressItem={c => {
                  incrementCouponClick(c.id).catch(() => {});
                  navigation.navigate('CouponDetail', { coupon: c });
                }}
                theme={T}
              />
            )}
            <View style={{ height: 8 }} />
          </View>
        )}

        {/* 3: 카테고리 칩 (sticky) */}
        <View style={s.catBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.key}
                style={[s.catChip, activeCategory === cat.key && s.catChipActive]}
                onPress={() => setActiveCategory(cat.key)}
                activeOpacity={0.75}
              >
                {cat.emoji ? <Text style={{ fontSize: 13 }}>{cat.emoji}</Text> : null}
                <Text style={[s.catLabel, activeCategory === cat.key && s.catLabelActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={s.catDivider} />
        </View>

        {/* 3: 섹션 타이틀 */}
        {feed.length > 0 && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
            backgroundColor: T.bg,
          }}>
            <Text style={s.sectionTitle}>
              {activeCategory === 'all'
                ? '🏪 근처 가게 소식'
                : `${CATEGORIES.find(c => c.key === activeCategory)?.emoji ?? ''} 가게 소식`}
            </Text>
            <Text style={s.sectionCount}>{feed.length}개</Text>
          </View>
        )}

        {/* 4: 피드 */}
        {feed.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 14 }}>
            <Text style={{ fontSize: 56 }}>📭</Text>
            <Text style={s.emptyTitle}>아직 게시물이 없어요</Text>
            <Text style={s.emptySub}>가맹점이 소식을 올리면{'\n'}피드가 채워져요!</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('CouponList')}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>
                🎟 쿠폰 피드 보기
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[s.feedContainer, { borderTopColor: T.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            {feed.map(post => (
              <PostCard
                key={post.id}
                post={post}
                isLiked={likedPosts.has(post.id)}
                likeCount={postLikes[post.id] ?? post.like_count}
                isPicked={pickedPosts.has(post.id)}
                pickCount={postPicks[post.id] ?? post.pick_count}
                distText={(() => {
                  if (!userLoc || !post.store) return null;
                  const lat = post.store.latitude, lng = post.store.longitude;
                  if (lat == null || lng == null) return null;
                  return formatDist(distanceM(userLoc.lat, userLoc.lng, lat, lng));
                })()}
                onLike={() => handleLike(post.id)}
                onPick={() => handlePick(post.id)}
                onPress={() =>
                  post.store?.id && navigation.navigate('StoreHome', { storeId: post.store.id })
                }
                onCouponPress={c => {
                  incrementCouponClick(c.id).catch(() => {});
                  navigation.navigate('CouponDetail', { coupon: c });
                }}
                theme={T}
              />
            ))}
          </View>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── 팝업 공지 ── */}
      {popup && (
        <Modal visible={showPopup} transparent animationType="fade" statusBarTranslucent
          onRequestClose={() => setShowPopup(false)}>
          <Pressable style={s.overlay} onPress={() => setShowPopup(false)}>
            <Pressable style={s.popupCard} onPress={() => {}}>
              <View style={{ height: 5, backgroundColor: T.accent }} />
              <View style={{ padding: 28, alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 40 }}>📢</Text>
                <Text style={s.popupTitle}>{popup.title}</Text>
                {!!popup.content && (
                  <Text style={s.popupContent}>{popup.content}</Text>
                )}
              </View>
              <View style={s.popupBtnRow}>
                <TouchableOpacity style={s.popupBtnSkip}
                  onPress={async () => {
                    await SecureStore.setItemAsync(`popup_skip_${popup.id}_${todayKey()}`, '1');
                    setShowPopup(false);
                  }}>
                  <Text style={s.popupBtnSkipText}>오늘 하루 보지 않기</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 16, alignItems: 'center', backgroundColor: T.accent }}
                  onPress={() => setShowPopup(false)}
                >
                  <Text style={{ fontSize: 14, color: '#fff', fontWeight: '800' }}>닫기</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </SafeAreaView>
  );
}
