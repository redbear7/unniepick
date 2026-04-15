import React, { useState } from 'react';
import {
  View, Text, Image, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getCouponKindConfig, claimCoupon, cancelDeadlineText } from '../../lib/services/couponService';
import { getSession } from '../../lib/services/authService';
import { scheduleCouponExpiryReminder } from '../../lib/notifications';
import { useMiniPlayerPadding } from '../../hooks/useMiniPlayerPadding';

const { width: SW } = Dimensions.get('window');

// ─── 팔레트 (Stripe 원칙 + 다크 테마) ───────────────────────────
const D = {
  bg:       '#0F0F0F',
  surface:  '#1A1A1A',
  card:     '#1E1E1E',
  border:   '#2A2A2A',
  text:     '#F5F5F5',
  sub:      '#9A9A9A',
  muted:    '#555555',
  accent:   '#FF6F0F',
};

const STORE_COLORS = ['#5B67CA','#FF6B3D','#2DB87A','#D946B0','#F5A623','#0EA5E9'];

// Stripe 블루-틴트 그림자
const stripeShadow = {
  shadowColor: 'rgba(50,50,93,1)',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.25,
  shadowRadius: 16,
  elevation: 10,
};

export default function CouponDetailScreen() {
  const navigation  = useNavigation<any>();
  const route       = useRoute<any>();
  const insets      = useSafeAreaInsets();
  const bottomPad   = useMiniPlayerPadding();
  const { coupon }  = route.params;

  const [claiming,   setClaiming]   = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  const kind         = getCouponKindConfig(coupon.coupon_kind);
  const isExperience = coupon.coupon_kind === 'experience';
  const remaining    = coupon.total_quantity !== null
    ? coupon.total_quantity - coupon.issued_count : null;

  const discountText =
    coupon.discount_type === 'percent'
      ? `${coupon.discount_value}%`
      : coupon.discount_value > 0
        ? `${coupon.discount_value.toLocaleString()}원`
        : '무료';
  const discountSuffix =
    coupon.discount_type === 'percent' ? ' 할인'
    : coupon.discount_value > 0 ? ' 할인' : ' 제공';

  const photos: string[] = [
    ...(coupon.image_url  ? [coupon.image_url]  : []),
    ...(coupon.image_url2 ? [coupon.image_url2] : []),
  ];

  const storeName  = coupon.store?.name ?? '가게';
  const storeColor = STORE_COLORS[storeName.charCodeAt(0) % STORE_COLORS.length];
  const expiryStr  = new Date(coupon.expires_at).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const progress = coupon.total_quantity
    ? Math.min(coupon.issued_count / coupon.total_quantity, 1) : 0;

  const handleReceive = async () => {
    const session = await getSession();
    if (!session) {
      Alert.alert('로그인 필요', '쿠폰을 받으려면 로그인이 필요해요', [
        { text: '취소', style: 'cancel' },
        { text: '로그인', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }
    if (remaining !== null && remaining <= 0) {
      Alert.alert('알림', '쿠폰이 모두 소진됐어요 😢');
      return;
    }
    setClaiming(true);
    try {
      const userCoupon = await claimCoupon(session.user.id, coupon.id);
      scheduleCouponExpiryReminder(
        userCoupon.id, coupon.title, storeName, coupon.expires_at,
      ).catch(() => {});
      Alert.alert('쿠폰 발급 완료!', '내 쿠폰함에 저장됐어요 🎉\n만료 하루 전에 알림을 드릴게요!', [
        { text: '확인', onPress: () => navigation.navigate('MyCouponQR', { userCoupon }) },
      ]);
    } catch (e: any) {
      Alert.alert('오류', e.message ?? '쿠폰 발급에 실패했어요');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <View style={s.root}>
      {/* ── 커버 이미지 ── */}
      <View style={s.photoWrap}>
        {photos.length > 0 ? (
          <>
            <Image source={{ uri: photos[photoIndex] }} style={s.photo} resizeMode="cover" />
            {photos.length > 1 && (
              <>
                <View style={s.photoBadge}>
                  <Text style={s.photoBadgeText}>{photoIndex + 1}/{photos.length}</Text>
                </View>
                <View style={s.photoNav}>
                  {photos.map((_, i) => (
                    <TouchableOpacity key={i} onPress={() => setPhotoIndex(i)} style={s.photoNavDot}>
                      <View style={[s.dot, i === photoIndex && s.dotActive]} />
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </>
        ) : (
          <View style={[s.photoPlaceholder, { backgroundColor: storeColor + '22' }]}>
            <Text style={s.photoEmoji}>{kind.emoji}</Text>
            <Text style={s.photoStoreName}>{storeName}</Text>
            <View style={[s.kindPill, { backgroundColor: kind.bg }]}>
              <Text style={s.kindPillText}>{kind.label}</Text>
            </View>
          </View>
        )}
        {/* 상단 오버레이 */}
        <View style={[s.photoOverlay, { top: insets.top + 8 }]}>
          <TouchableOpacity style={s.photoBtn} onPress={() => navigation.goBack()}>
            <Text style={s.photoBtnText}>←</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <TouchableOpacity style={s.photoBtn}>
              <Text style={s.photoBtnText}>⬆</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── 콘텐츠 ── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: bottomPad + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 가게 행 ── */}
        <View style={s.storeRow}>
          <View style={[s.storeAvatar, { backgroundColor: storeColor + '33' }]}>
            <Text style={s.storeAvatarText}>{storeName.slice(0, 1)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.storeName}>{storeName}</Text>
            {coupon.store?.district?.name && (
              <Text style={s.storeMeta}>📍 {coupon.store.district.name}</Text>
            )}
          </View>
          <View style={[s.kindBadge, { backgroundColor: kind.bg + '20', borderColor: kind.bg + '55' }]}>
            <Text style={[s.kindBadgeText, { color: kind.bg }]}>{kind.emoji} {kind.label}</Text>
          </View>
        </View>

        {/* ── Stripe 스타일 가격 카드 ── */}
        <View style={[s.priceCard, stripeShadow]}>
          {/* 할인율/금액 — 큰 숫자 */}
          <View style={s.priceTop}>
            <Text style={s.priceBig}>{discountText}</Text>
            <Text style={s.priceSuffix}>{discountSuffix}</Text>
          </View>
          <Text style={s.priceTitle}>{coupon.title}</Text>
          {coupon.description ? (
            <Text style={s.priceDesc}>{coupon.description}</Text>
          ) : null}

          {/* 수량 프로그레스 바 */}
          {coupon.total_quantity !== null && (
            <View style={s.progressWrap}>
              <View style={s.progressBg}>
                <View style={[s.progressFill, {
                  width: `${progress * 100}%` as any,
                  backgroundColor: kind.bg,
                }]} />
              </View>
              <Text style={s.progressLabel}>
                {coupon.issued_count}
                {coupon.total_quantity !== null ? `/${coupon.total_quantity}` : ''} 발급됨
                {remaining !== null && remaining > 0 && (
                  <Text style={{ color: kind.bg }}> · 잔여 {remaining}{isExperience ? '명' : '장'}</Text>
                )}
                {remaining !== null && remaining <= 0 && (
                  <Text style={{ color: '#E94560' }}> · 소진</Text>
                )}
              </Text>
            </View>
          )}
        </View>

        {/* ── 체험단 전용 ── */}
        {isExperience && (coupon.experience_offer || coupon.experience_mission) && (
          <View style={[s.infoCard, stripeShadow]}>
            <Text style={s.infoCardTitle}>체험단 정보</Text>
            {!!coupon.experience_offer && (
              <View style={s.expRow}>
                <Text style={[s.expIcon, { color: kind.bg }]}>📦</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.expLabel, { color: kind.bg }]}>제공 혜택</Text>
                  <Text style={s.expBody}>{coupon.experience_offer}</Text>
                </View>
              </View>
            )}
            {!!coupon.experience_mission && (
              <View style={[s.expRow, { marginTop: 12 }]}>
                <Text style={[s.expIcon, { color: kind.bg }]}>📋</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.expLabel, { color: kind.bg }]}>미션</Text>
                  <Text style={s.expBody}>{coupon.experience_mission}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── 상세 정보 테이블 (Stripe 인보이스 스타일) ── */}
        <View style={[s.infoCard, stripeShadow]}>
          <Text style={s.infoCardTitle}>상세 정보</Text>
          <InfoRow label="유효기간" value={`~${expiryStr}`} valueColor={kind.bg} />
          <InfoRow
            label={isExperience ? '신청 / 모집' : '발급 / 잔여'}
            value={coupon.total_quantity !== null
              ? `${coupon.issued_count} / ${coupon.total_quantity}`
              : `${coupon.issued_count} / 무제한`}
            valueColor={kind.bg}
          />
          <InfoRow label="쿠폰 종류" value={`${kind.emoji} ${kind.label}`} last />
        </View>

        {/* ── 취소 정책 ── */}
        <View style={s.cancelCard}>
          <Text style={s.cancelIcon}>⚠️</Text>
          <Text style={s.cancelText}>
            {cancelDeadlineText(coupon.expires_at)} · 당일 취소 불가
          </Text>
        </View>

        {/* ── 사용 방법 ── */}
        <View style={[s.infoCard, stripeShadow]}>
          <Text style={s.infoCardTitle}>사용 방법</Text>
          {['매장 방문 후 직원에게 QR코드를 보여주세요',
            '쿠폰은 1회만 사용 가능합니다',
            '다른 할인과 중복 적용 불가합니다'].map((t, i) => (
            <View key={i} style={s.noticeRow}>
              <View style={[s.noticeDot, { backgroundColor: kind.bg }]} />
              <Text style={s.noticeText}>{t}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ── 하단 CTA ── */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[s.claimBtn, { backgroundColor: kind.bg }, claiming && { opacity: 0.65 }]}
          onPress={handleReceive}
          activeOpacity={0.88}
          disabled={claiming}
        >
          {claiming ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={s.claimBtnEmoji}>
                {isExperience ? '🌟' : kind.emoji}
              </Text>
              <Text style={s.claimBtnText}>
                {isExperience ? '체험단 신청하기' : '쿠폰 발급받기'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── InfoRow ─────────────────────────────────────────────────────
function InfoRow({ label, value, valueColor, last = false }: {
  label: string; value: string; valueColor?: string; last?: boolean;
}) {
  return (
    <View style={[ir.row, last && { borderBottomWidth: 0 }]}>
      <Text style={ir.label}>{label}</Text>
      <Text style={[ir.value, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}
const ir = StyleSheet.create({
  row:   {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#2A2A2A',
  },
  label: { fontSize: 14, color: '#7A7A7A', fontWeight: '500' },
  value: { fontSize: 14, fontWeight: '700', color: D.text, textAlign: 'right', flex: 1, marginLeft: 12 },
});

// ─── 스타일 ──────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },

  // 커버
  photoWrap: { width: SW, height: SW * 0.72, backgroundColor: '#111', position: 'relative' },
  photo:     { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  photoEmoji:       { fontSize: 72 },
  photoStoreName:   { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  kindPill:         { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6 },
  kindPillText:     { fontSize: 13, fontWeight: '800', color: '#fff' },

  photoOverlay:     { position: 'absolute', left: 0, right: 0, flexDirection: 'row',
                      justifyContent: 'space-between', paddingHorizontal: 12 },
  photoBtn:         { width: 36, height: 36, borderRadius: 18,
                      backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  photoBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  photoBadge:       { position: 'absolute', bottom: 12, right: 14,
                      backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12,
                      paddingHorizontal: 10, paddingVertical: 4 },
  photoBadgeText:   { color: '#fff', fontSize: 12, fontWeight: '700' },
  photoNav:         { position: 'absolute', bottom: 14, left: 0, right: 0,
                      flexDirection: 'row', justifyContent: 'center', gap: 6 },
  photoNavDot:      { padding: 4 },
  dot:              { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive:        { backgroundColor: '#fff', width: 18 },

  // 스크롤
  scroll: { flex: 1 },

  // 가게 행
  storeRow:       { flexDirection: 'row', alignItems: 'center', gap: 12,
                    paddingHorizontal: 16, paddingVertical: 16 },
  storeAvatar:    { width: 46, height: 46, borderRadius: 23,
                    alignItems: 'center', justifyContent: 'center' },
  storeAvatarText:{ fontSize: 20, fontWeight: '900' },
  storeName:      { fontSize: 16, fontWeight: '700', color: D.text, letterSpacing: -0.3 },
  storeMeta:      { fontSize: 12, color: D.sub, marginTop: 2 },
  kindBadge:      { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  kindBadgeText:  { fontSize: 11, fontWeight: '700' },

  // Stripe 가격 카드
  priceCard: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: D.card, borderRadius: 16,
    padding: 20,
    borderWidth: 1, borderColor: D.border,
  },
  priceTop:    { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 8 },
  priceBig:    { fontSize: 48, fontWeight: '900', color: D.text, letterSpacing: -2, lineHeight: 52 },
  priceSuffix: { fontSize: 20, fontWeight: '700', color: D.sub, marginBottom: 6 },
  priceTitle:  { fontSize: 17, fontWeight: '700', color: D.text, letterSpacing: -0.3, marginBottom: 6 },
  priceDesc:   { fontSize: 14, color: D.sub, lineHeight: 22 },

  // 프로그레스
  progressWrap: { marginTop: 16, gap: 6 },
  progressBg:   { height: 4, borderRadius: 2, backgroundColor: D.border },
  progressFill: { height: 4, borderRadius: 2 },
  progressLabel:{ fontSize: 12, color: D.sub, fontWeight: '500' },

  // 정보 카드
  infoCard: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: D.card, borderRadius: 16,
    padding: 20,
    borderWidth: 1, borderColor: D.border,
  },
  infoCardTitle: {
    fontSize: 11, fontWeight: '700', color: D.muted,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12,
  },

  // 체험단
  expRow:   { flexDirection: 'row', gap: 10 },
  expIcon:  { fontSize: 18, marginTop: 2 },
  expLabel: { fontSize: 11, fontWeight: '800', marginBottom: 4 },
  expBody:  { fontSize: 14, color: D.text, lineHeight: 22 },

  // 취소 정책
  cancelCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#1C1400',
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#3D2E00',
  },
  cancelIcon: { fontSize: 14, marginTop: 1 },
  cancelText: { flex: 1, fontSize: 13, color: '#F59E0B', fontWeight: '600', lineHeight: 20 },

  // 사용 방법
  noticeRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  noticeDot:  { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  noticeText: { flex: 1, fontSize: 14, color: D.sub, lineHeight: 22 },

  // 하단 CTA
  bottomBar: {
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: D.surface,
    borderTopWidth: 1, borderTopColor: D.border,
  },
  claimBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, borderRadius: 999, gap: 8,
    shadowColor: '#FF6F0F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  claimBtnEmoji: { fontSize: 20 },
  claimBtnText:  { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
});
