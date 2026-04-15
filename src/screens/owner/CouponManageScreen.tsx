import React, { useState } from 'react';
import {
  View, Text, StyleSheet,
  TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';

const MOCK_COUPONS = [
  {
    id: '1', title: '삼겹살 세트 20% 할인',
    coupon_kind: 'regular',
    discount_type: 'percent', discount_value: 20,
    total_quantity: 100, issued_count: 34,
    expires_at: '2026-12-31', is_active: true,
  },
  {
    id: '2', title: '런치 특선 3,000원 할인',
    coupon_kind: 'regular',
    discount_type: 'amount', discount_value: 3000,
    total_quantity: 50, issued_count: 50,
    expires_at: '2026-09-30', is_active: false,
  },
  {
    id: '3', title: '오후 3~5시 스매시버거 30% 타임세일',
    coupon_kind: 'timesale',
    discount_type: 'percent', discount_value: 30,
    total_quantity: 50, issued_count: 12,
    expires_at: '2026-06-30', is_active: true,
  },
  {
    id: '4', title: '버거 세트 주문 시 음료 무료 서비스',
    coupon_kind: 'service',
    discount_type: 'amount', discount_value: 0,
    total_quantity: null, issued_count: 34,    // null = 무제한
    expires_at: '2026-12-31', is_active: true,
  },
  {
    id: '5', title: '손칼국수 2인 코스 체험단 모집',
    coupon_kind: 'experience',
    discount_type: 'amount', discount_value: 0,
    total_quantity: 10, issued_count: 3,
    expires_at: '2026-05-31', is_active: true,
  },
  {
    id: '6', title: '칼국수 2인 세트 5,000원 할인',
    coupon_kind: 'regular',
    discount_type: 'amount', discount_value: 5000,
    total_quantity: null, issued_count: 89,    // null = 무제한
    expires_at: '2026-12-31', is_active: true,
  },
];

export default function CouponManageScreen() {
  const navigation = useNavigation<any>();
  const [coupons, setCoupons] = useState(MOCK_COUPONS);

  const toggleActive = (id: string) => {
    setCoupons((prev) =>
      prev.map((c) => c.id === id ? { ...c, is_active: !c.is_active } : c)
    );
  };

  const handleDelete = (id: string, title: string) => {
    Alert.alert('쿠폰 삭제', `"${title}"을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: () => setCoupons((prev) => prev.filter((c) => c.id !== id)),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.title}>쿠폰 관리</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CouponCreate')}>
          <Text style={styles.addText}>+ 추가</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {coupons.map((coupon) => (
          <View key={coupon.id} style={[styles.card, SHADOW.card]}>
            <View style={styles.cardTop}>
              <View style={[styles.badge, coupon.is_active ? styles.badgeActive : styles.badgeInactive]}>
                <Text style={styles.badgeText}>{coupon.is_active ? '활성' : '종료'}</Text>
              </View>
              <Text style={styles.couponTitle}>{coupon.title}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>할인</Text>
              <Text style={styles.infoValue}>
                {coupon.discount_type === 'percent'
                  ? `${coupon.discount_value}%`
                  : `${coupon.discount_value.toLocaleString()}원`}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>발급 현황</Text>
              <Text style={styles.infoValue}>
                {coupon.issued_count}/{coupon.total_quantity != null ? `${coupon.total_quantity}개` : '∞ (무제한)'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>유효기간</Text>
              <Text style={styles.infoValue}>~{coupon.expires_at}</Text>
            </View>

            {/* 발급 진행률 */}
            <View style={styles.progressBg}>
              <View style={[
                styles.progressFill,
                { width: `${(coupon.issued_count / coupon.total_quantity) * 100}%` },
              ]} />
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.btn, coupon.is_active ? styles.btnStop : styles.btnStart]}
                onPress={() => toggleActive(coupon.id)}
              >
                <Text style={styles.btnText}>{coupon.is_active ? '중단' : '재시작'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnDelete]}
                onPress={() => handleDelete(coupon.id, coupon.title)}
              >
                <Text style={styles.btnText}>삭제</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, paddingBottom: 8,
  },
  backText: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  addText: { fontSize: 16, color: COLORS.primary, fontWeight: '700' },
  list: { padding: 20, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, gap: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeActive: { backgroundColor: '#4CAF5022' },
  badgeInactive: { backgroundColor: COLORS.border },
  badgeText: { fontSize: 11, fontWeight: '700', color: COLORS.text },
  couponTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.text },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { fontSize: 13, color: COLORS.textMuted },
  infoValue: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  progressBg: {
    height: 6, backgroundColor: COLORS.secondary,
    borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: COLORS.primary, borderRadius: 3 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btn: { flex: 1, padding: 10, borderRadius: RADIUS.md, alignItems: 'center' },
  btnStart: { backgroundColor: '#4CAF5022' },
  btnStop: { backgroundColor: COLORS.primaryLight },
  btnDelete: { backgroundColor: '#FF000011' },
  btnText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
});
