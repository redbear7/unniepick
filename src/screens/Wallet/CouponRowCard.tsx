/**
 * CouponRowCard — Spec 01 §05 지갑 쿠폰 행 카드
 *
 * • D-day 만료 게이지 (프로그레스바)
 * • D-3 이하 빨간 뱃지
 * • 롱프레스 1.5초 → RedeemScreen 진입
 * • 거리 배지 (distance_m 있을 때)
 */
import React, { useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Platform,
} from 'react-native';
import { PALETTE } from '../../constants/theme';
import { catColor, catEmoji, formatDDay, WalletCoupon } from '../../lib/services/couponWalletService';

interface Props {
  coupon:      WalletCoupon;
  onPress:     () => void;
  onLongPress: () => void;
  urgent?:     boolean;  // D-3 이하
}

export default function CouponRowCard({ coupon, onPress, onLongPress, urgent }: Props) {
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const longTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired  = useRef(false);

  const color   = catColor(coupon.store_category);
  const emoji   = catEmoji(coupon.store_category);
  const isUrgent = urgent ?? coupon.days_left <= 3;

  // 만료 진행률 (30일 기준, 최소 4%)
  const fraction = Math.max(0.04, Math.min(1, coupon.days_left / 30));
  const gaugeW   = `${Math.round(fraction * 100)}%` as `${number}%`;

  // 롱프레스: 1.5초 홀드
  const onPressIn = () => {
    longFired.current = false;
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, tension: 200, friction: 10 }).start();
    longTimer.current = setTimeout(() => {
      longFired.current = true;
      onLongPress();
    }, 1500);
  };
  const onPressOut = () => {
    if (longTimer.current) clearTimeout(longTimer.current);
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 200, friction: 10 }).start();
  };
  const handlePress = () => {
    if (!longFired.current) onPress();
  };

  return (
    <Animated.View style={[s.wrap, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={s.card}
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        {/* 왼쪽: 가게 아이콘 */}
        <View style={[s.avatar, { backgroundColor: `${color}22` }]}>
          <Text style={s.avatarEmoji}>{emoji}</Text>
        </View>

        {/* 중앙: 정보 */}
        <View style={s.body}>
          <View style={s.topRow}>
            <Text style={s.storeName} numberOfLines={1}>{coupon.store_name}</Text>
            {isUrgent && (
              <View style={s.urgentBadge}>
                <Text style={s.urgentBadgeText}>D-{coupon.days_left}</Text>
              </View>
            )}
          </View>
          <Text style={s.title} numberOfLines={1}>{coupon.title}</Text>

          {/* D-day 게이지 */}
          <View style={s.gaugeRow}>
            <View style={s.gaugeTrack}>
              <View style={[s.gaugeFill, {
                width: gaugeW,
                backgroundColor: isUrgent ? PALETTE.red500 : color,
              }]} />
            </View>
            <Text style={[s.dday, isUrgent && s.ddayUrgent]}>
              {formatDDay(coupon.days_left)}
            </Text>
          </View>
        </View>

        {/* 오른쪽: 거리 + 사용 힌트 */}
        <View style={s.right}>
          {coupon.distance_m != null && (
            <View style={[s.distBadge, { backgroundColor: `${color}18` }]}>
              <Text style={[s.distText, { color }]}>
                {coupon.distance_m < 1000
                  ? `${coupon.distance_m}m`
                  : `${(coupon.distance_m / 1000).toFixed(1)}km`}
              </Text>
            </View>
          )}
          <Text style={s.hint}>🫳 꾹</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { borderRadius: 16 },
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    padding:         14,
    backgroundColor: '#FFFFFF',
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     PALETTE.gray150,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0,0,0,0.06)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  avatar: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarEmoji: { fontSize: 24 },
  body: { flex: 1, minWidth: 0, gap: 4 },
  topRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:             6,
    marginBottom:    1,
  },
  storeName: {
    fontFamily: 'WantedSans-ExtraBold',
    fontSize:    13,
    lineHeight:  17,
    color:       PALETTE.gray900,
    flex:        1,
    letterSpacing: -0.2,
  },
  urgentBadge: {
    paddingHorizontal: 6,
    paddingVertical:   2,
    backgroundColor:   '#FFEBEE',
    borderRadius:      999,
    flexShrink: 0,
  },
  urgentBadgeText: {
    fontFamily: 'WantedSans-ExtraBold',
    fontSize:    9,
    color:       '#E53935',
    lineHeight:  14,
    letterSpacing: 0.2,
  },
  title: {
    fontFamily:   'WantedSans-Medium',
    fontSize:      12,
    lineHeight:    17,
    color:         PALETTE.gray600,
    letterSpacing: -0.1,
  },
  gaugeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:            8,
    marginTop:      2,
  },
  gaugeTrack: {
    flex:         1,
    height:       4,
    borderRadius: 2,
    backgroundColor: PALETTE.gray150,
    overflow:     'hidden',
  },
  gaugeFill: {
    height:       '100%',
    borderRadius: 2,
  },
  dday: {
    fontFamily:   'WantedSans-SemiBold',
    fontSize:      10,
    lineHeight:    14,
    color:         PALETTE.gray500,
    flexShrink:    0,
  },
  ddayUrgent: { color: '#E53935' },
  right: {
    alignItems:  'flex-end',
    gap:          6,
    flexShrink:   0,
  },
  distBadge: {
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderRadius:      999,
  },
  distText: {
    fontFamily:   'WantedSans-Bold',
    fontSize:      10,
    lineHeight:    14,
    letterSpacing: -0.1,
  },
  hint: {
    fontFamily: 'WantedSans-Medium',
    fontSize:    10,
    lineHeight:  14,
    color:       PALETTE.gray400,
  },
});
