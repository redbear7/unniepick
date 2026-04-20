/**
 * NearbyStoreCard — 내 주변 가게 카드 (가로 스크롤)
 * 카테고리 컬러 그라데이션 + 이모지 + 거리 + 활성 쿠폰 수
 * HomeScreens.jsx:83 포팅
 */
import React from 'react';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

export interface NearbyStore {
  id:            string;
  name:          string;
  category:      string;
  emoji?:        string;
  distance:      number;
  activeCoupons: number;
  hot?:          boolean;
}

interface Props {
  s:       NearbyStore;
  onPress?: (id: string) => void;
}

const PALETTE = [
  '#FF6F0F', '#FF3D71', '#0AC86E', '#3D8EFF',
  '#9B5DE5', '#F15BB5', '#00BBF9', '#FEE440',
];

function storeColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export default function NearbyStoreCard({ s, onPress }: Props) {
  const color = storeColor(s.name);
  // 카테고리에서 "한식 >" 같은 prefix 제거
  const cat = s.category.replace(/^\S+\s/, '');

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(s.id)}
      activeOpacity={0.85}
    >
      {/* 이미지 영역 — 그라데이션 + 이모지 */}
      <View style={[styles.imgWrap, { backgroundColor: color }]}>
        <Text style={styles.emoji}>{s.emoji ?? '🏪'}</Text>
        {s.hot && (
          <View style={styles.hotBadge}>
            <Text style={styles.hotText}>🔥 HOT</Text>
          </View>
        )}
      </View>

      {/* 하단 정보 */}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
        <Text style={styles.meta}>{cat} · {s.distance}m</Text>
        <Text style={styles.coupons}>🎟 쿠폰 {s.activeCoupons}장</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width:           140,
    backgroundColor: '#FFFFFF',
    borderRadius:    14,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     '#EAECEF',
    shadowColor:     '#191F28',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.06,
    shadowRadius:    3,
    elevation:       2,
  },
  imgWrap: {
    height:         100,
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
  },
  emoji: { fontSize: 40 },
  hotBadge: {
    position:        'absolute',
    top:             8,
    left:            8,
    backgroundColor: '#FFFFFF',
    borderRadius:    8,
    paddingHorizontal: 6,
    paddingVertical:   3,
  },
  hotText: {
    fontSize:   9,
    fontWeight: '800',
    color:      '#E53935',
  },
  body: {
    padding: 10,
    gap:     4,
  },
  name: {
    fontSize:    13,
    fontWeight:  '800',
    color:       '#191F28',
    letterSpacing: -0.3,
  },
  meta: {
    fontSize:   11,
    fontWeight: '500',
    color:      '#6B7684',
  },
  coupons: {
    fontSize:   11,
    fontWeight: '700',
    color:      '#FF6F0F',
    marginTop:  2,
  },
});
