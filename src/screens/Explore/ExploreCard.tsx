/**
 * ExploreCard — 2열 그리드 가게 카드
 *
 * 구조:
 *   썸네일 영역 (100px) — 카테고리 배경색 + 이모지 + HOT 배지 + 쿠폰 배지
 *   정보 영역 — 가게명 · 카테고리+거리 · 팔로워+팔로우 버튼
 */
import React, { useCallback } from 'react';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { F } from '../../constants/typography';
import { PALETTE } from '../../constants/theme';
import type { ExploreStore } from './hooks/useExploreStores';

// ── 카테고리 배경색 ────────────────────────────────────────────────
const CAT_BG_MAP: [string, string][] = [
  ['카페',    '#5C3D1E'], ['커피',    '#5C3D1E'],
  ['한식',    '#B94040'], ['분식',    '#C75C00'],
  ['치킨',    '#C77A00'], ['고기',    '#8B3A3A'],
  ['중식',    '#3A6B8B'], ['일식',    '#2D5A4E'],
  ['양식',    '#4A3A8B'], ['음식',    '#CC5800'],
  ['미용',    '#6B3A8B'], ['헤어',    '#6B3A8B'],
  ['네일',    '#8B3A6B'],
  ['편의점',  '#2B5CB8'],
  ['베이커리', '#8B5E00'], ['빵',     '#8B5E00'],
];

function catBg(category: string): string {
  const c = category.toLowerCase();
  for (const [key, color] of CAT_BG_MAP) {
    if (c.includes(key)) return color;
  }
  return '#4E5968';
}

// ── 팔로워 축약 ────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000)  return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ── 거리 표시 ─────────────────────────────────────────────────────
function dist(m: number): string {
  if (m <= 0)       return '';
  if (m >= 1000)    return `${(m / 1000).toFixed(1)}km`;
  return `${m}m`;
}

// ── 스마트 배지 계산 ──────────────────────────────────────────────
function getSmartBadge(store: ExploreStore): { label: string; color: string } | null {
  if (store.activeCoupons >= 3) return { label: '🎟 혜택 풍부',    color: '#FF6F0F' };
  if (store.review_count >= 50) return { label: '⭐ 검증된 맛집',  color: '#F59E0B' };
  if (store.followers >= 200)   return { label: '💜 인기 가게',    color: '#8B5CF6' };
  if (store.activeCoupons >= 1) return { label: '🎟 쿠폰 있음',   color: '#FF6F0F' };
  return null;
}

// ── 컴포넌트 ─────────────────────────────────────────────────────
interface Props {
  store:          ExploreStore;
  onPress:        (id: string) => void;
  onToggleFollow: (id: string) => void;
}

export default function ExploreCard({ store, onPress, onToggleFollow }: Props) {
  const bg = catBg(store.category);

  const handleFollow = useCallback((e: any) => {
    e.stopPropagation?.();
    onToggleFollow(store.id);
  }, [store.id, onToggleFollow]);

  const distLabel  = dist(store.distance);
  const metaParts  = [store.category, distLabel].filter(Boolean).join(' · ');
  const smartBadge = getSmartBadge(store);

  return (
    <TouchableOpacity
      style={s.card}
      onPress={() => onPress(store.id)}
      activeOpacity={0.87}
    >
      {/* ── 썸네일 영역 ── */}
      <View style={[s.thumb, { backgroundColor: bg }]}>
        <Text style={s.emoji}>{store.emoji}</Text>

        {/* HOT 배지 (좌상) */}
        {store.hot && (
          <View style={s.hotBadge}>
            <Text style={s.hotText}>🔥 HOT</Text>
          </View>
        )}

        {/* 쿠폰 배지 (우상) */}
        {store.activeCoupons > 0 && (
          <View style={s.couponBadge}>
            <Text style={s.couponText}>🎟 {store.activeCoupons}</Text>
          </View>
        )}
      </View>

      {/* ── 정보 영역 ── */}
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>{store.name}</Text>
        <Text style={s.meta} numberOfLines={1}>{metaParts}</Text>

        {/* 가격 표시 */}
        {store.representative_price != null && (
          <Text style={s.price}>
            💰 {store.price_label ?? `${store.representative_price.toLocaleString()}원~`}
          </Text>
        )}

        {/* 스마트 배지 */}
        {smartBadge && (
          <View style={[s.smartBadge, { backgroundColor: smartBadge.color + '18', borderColor: smartBadge.color + '44' }]}>
            <Text style={[s.smartBadgeText, { color: smartBadge.color }]}>{smartBadge.label}</Text>
          </View>
        )}

        {/* 팔로워 + 팔로우 버튼 */}
        <View style={s.footer}>
          <Text style={s.followers}>
            {fmt(store.followers)} 팔로워
          </Text>
          <TouchableOpacity
            onPress={handleFollow}
            activeOpacity={0.75}
            style={[s.followBtn, store.following && s.followingBtn]}
          >
            <Text style={[s.followTxt, store.following && s.followingTxt]}>
              {store.following ? '팔로잉' : '+ 팔로우'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    flex:            1,
    backgroundColor: '#FFFFFF',
    borderRadius:    14,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     PALETTE.gray150,
    shadowColor:     PALETTE.gray900,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.07,
    shadowRadius:    6,
    elevation:       3,
  },

  // 썸네일
  thumb: {
    height:         100,
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
  },
  emoji: { fontSize: 44 },

  hotBadge: {
    position:        'absolute',
    top:              7,
    left:             7,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius:     7,
    paddingHorizontal: 5,
    paddingVertical:   2,
  },
  hotText: {
    ...F.bold,
    fontSize:    9,
    color:      PALETTE.red500,
  },

  couponBadge: {
    position:        'absolute',
    top:              7,
    right:            7,
    backgroundColor: PALETTE.orange500,
    borderRadius:     7,
    paddingHorizontal: 5,
    paddingVertical:   2,
  },
  couponText: {
    ...F.bold,
    fontSize:    9,
    color:      '#FFFFFF',
  },

  // 정보
  info: {
    paddingHorizontal: 10,
    paddingVertical:   10,
    gap:                4,
  },
  price: {
    ...F.bold,
    fontSize:      11,
    color:         '#2D7A3A',
    letterSpacing: -0.1,
  },
  smartBadge: {
    alignSelf:          'flex-start',
    borderRadius:        6,
    borderWidth:         1,
    paddingHorizontal:   6,
    paddingVertical:     2,
    marginTop:           1,
  },
  smartBadgeText: {
    ...F.bold,
    fontSize:   9,
  },
  name: {
    ...F.extraBold,
    fontSize:      14,
    color:         PALETTE.gray900,
    letterSpacing: -0.3,
    lineHeight:    18,
  },
  meta: {
    ...F.medium,
    fontSize:   11,
    color:      PALETTE.gray500,
    lineHeight: 15,
  },

  // 하단 팔로워 + 버튼
  footer: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:       4,
  },
  followers: {
    ...F.semiBold,
    fontSize:   10,
    color:      PALETTE.gray400,
  },

  followBtn: {
    paddingHorizontal:  8,
    paddingVertical:    4,
    borderRadius:       8,
    borderWidth:        1,
    borderColor:        PALETTE.orange500,
    backgroundColor:    PALETTE.orange500,
  },
  followingBtn: {
    backgroundColor: 'transparent',
    borderColor:     PALETTE.gray300,
  },
  followTxt: {
    ...F.bold,
    fontSize:   10,
    color:      '#FFFFFF',
  },
  followingTxt: {
    color: PALETTE.gray500,
  },
});
