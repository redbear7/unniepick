// ExpiringCouponsCard — 당일 만료 쿠폰 리마인더 (Block B)
// 0개이면 null 렌더
import React from 'react';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { PALETTE } from '../../../constants/theme';
import type { ExpiringCoupon } from '../hooks/useExpiringCoupons';

interface Props {
  coupons:      ExpiringCoupon[];
  onPress:      () => void;  // → 쿠폰함 탭
}

export default function ExpiringCouponsCard({ coupons, onPress }: Props) {
  if (coupons.length === 0) return null;

  // 가게명 목록 (최대 3개, 초과 시 "+N")
  const names = coupons.map(c => c.storeName);
  const preview = names.slice(0, 3).join(' · ')
    + (names.length > 3 ? ` +${names.length - 3}` : '');

  return (
    <View style={s.wrap}>
      <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.85}>
        <Text style={s.emoji}>⏰</Text>
        <View style={s.body}>
          <Text style={s.title}>
            오늘 안에 써야 하는 쿠폰{' '}
            <Text style={s.count}>{coupons.length}개</Text>
          </Text>
          <Text style={s.sub} numberOfLines={1}>{preview} · 자정까지</Text>
        </View>
        <Text style={s.chevron}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop:        14,
    paddingBottom:      4,
  },
  card: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:             12,
    padding:         14,
    paddingHorizontal: 16,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     PALETTE.orange300,
    backgroundColor: PALETTE.orange50,  // LinearGradient 미지원 → orange50
  },
  emoji: { fontSize: 24 },
  body: { flex: 1, minWidth: 0 },
  title: {
    fontFamily:    'WantedSans-ExtraBold',
    fontSize:       14,
    fontWeight:     '800',
    color:          PALETTE.gray900,
    letterSpacing:  -0.3,
    lineHeight:     18,
  },
  count: {
    color: PALETTE.orange500,
  },
  sub: {
    fontFamily:  'WantedSans-Medium',
    fontSize:     11,
    fontWeight:   '500',
    color:        PALETTE.gray500,
    marginTop:    4,
    lineHeight:   14,
  },
  chevron: {
    fontFamily:  'WantedSans-Medium',
    fontSize:     22,
    fontWeight:   '300',
    color:        PALETTE.gray400,
    lineHeight:   26,
  },
});
