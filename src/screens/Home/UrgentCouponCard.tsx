/**
 * UrgentCouponCard — 긴급 쿠폰 카드 (가로 스크롤용)
 * D-0 = 🔥 오늘만 배지, D-N = 날짜 배지
 * HomeScreens.jsx:62 포팅
 */
import React from 'react';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import StoreAvatar from '../../components/StoreAvatar';

export interface UrgentCoupon {
  id:       string;
  store:    string;
  emoji?:   string;
  title:    string;
  daysLeft: number;
  remain:   number | null;
  distance?: number;
}

interface Props {
  c:       UrgentCoupon;
  onSave?: (id: string) => void;
}

export default function UrgentCouponCard({ c, onSave }: Props) {
  const urgent = c.daysLeft === 0;

  return (
    <View style={[styles.card, urgent && styles.cardNow]}>
      {/* 상단: 배지 + 잔여 */}
      <View style={styles.top}>
        <View style={[styles.badge, urgent ? styles.badgeUrgent : styles.badgeSoft]}>
          <Text style={[styles.badgeText, urgent ? styles.badgeTextUrgent : styles.badgeTextSoft]}>
            {urgent ? '🔥 오늘만' : `D-${c.daysLeft}`}
          </Text>
        </View>
        {c.remain != null && (
          <Text style={styles.remain}>잔여 {c.remain}장</Text>
        )}
      </View>

      {/* 쿠폰 제목 */}
      <Text style={styles.title} numberOfLines={2}>{c.title}</Text>

      {/* 매장 정보 */}
      <View style={styles.store}>
        <StoreAvatar name={c.store} emoji={c.emoji} size="sm" />
        <View>
          <Text style={styles.storeName}>{c.store}</Text>
          {c.distance != null && (
            <Text style={styles.dist}>🚶 {c.distance}m</Text>
          )}
        </View>
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={styles.btn}
        onPress={() => onSave?.(c.id)}
        activeOpacity={0.8}
      >
        <Text style={styles.btnText}>쿠폰받기</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width:           220,
    backgroundColor: '#FFFFFF',
    borderRadius:    16,
    padding:         14,
    gap:             10,
    borderWidth:     1,
    borderColor:     '#EAECEF',
    shadowColor:     '#191F28',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.06,
    shadowRadius:    3,
    elevation:       2,
  },
  cardNow: {
    backgroundColor: '#FFF3EB',
    borderColor:     '#FFD4A8',
  },
  top: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      12,
  },
  badgeUrgent:     { backgroundColor: '#E53935' },
  badgeSoft:       { backgroundColor: '#F2F4F6' },
  badgeText:       { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  badgeTextUrgent: { color: '#FFFFFF' },
  badgeTextSoft:   { color: '#4E5968' },
  remain: {
    fontSize:    12,
    fontWeight:  '700',
    color:       '#FF6F0F',
  },
  title: {
    fontFamily:   'WantedSans-ExtraBold',
    fontSize:     17,
    fontWeight:   '800',
    color:        '#191F28',
    letterSpacing: -0.4,
    minHeight:    42,
  },
  store: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  storeName: {
    fontSize:   13,
    fontWeight: '700',
    color:      '#191F28',
  },
  dist: {
    fontSize:   12,
    fontWeight: '500',
    color:      '#6B7684',
    marginTop:  3,
  },
  btn: {
    backgroundColor: '#FF6F0F',
    borderRadius:    10,
    paddingVertical: 11,
    alignItems:      'center',
  },
  btnText: {
    color:       '#FFFFFF',
    fontSize:    14,
    fontWeight:  '800',
    letterSpacing: -0.2,
  },
});
