import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, TextInput, Animated, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';
import {
  cancelCoupon, canCancelCoupon, cancelDeadlineText,
  useCouponByPin,
} from '../../lib/services/couponService';
import { cancelCouponExpiryReminder } from '../../lib/notifications';
import { getSession } from '../../lib/services/authService';
import { submitReview } from '../../lib/services/reviewService';

type ViewMode = 'qr' | 'pin';

// ── 4자리 PIN 입력 박스 ──────────────────────────────────────────────────────
function PinInput({
  value,
  onChange,
}: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<TextInput>(null);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => inputRef.current?.focus()}
      style={pi.wrap}
    >
      {/* 숨겨진 실제 입력창 */}
      <TextInput
        ref={inputRef}
        style={pi.hidden}
        value={value}
        onChangeText={v => onChange(v.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad"
        maxLength={4}
        caretHidden
      />

      {/* 시각적 박스 4개 */}
      {[0, 1, 2, 3].map(i => {
        const char    = value[i] ?? '';
        const focused = value.length === i;
        return (
          <View key={i} style={[pi.box, focused && pi.boxFocused, char && pi.boxFilled]}>
            <Text style={pi.digit}>{char ? '●' : ''}</Text>
            {focused && <View style={pi.cursor} />}
          </View>
        );
      })}
    </TouchableOpacity>
  );
}

// ── 메인 화면 ────────────────────────────────────────────────────────────────
export default function MyCouponQRScreen() {
  const navigation   = useNavigation<any>();
  const route        = useRoute<any>();
  const { userCoupon } = route.params;
  const coupon       = userCoupon.coupon;
  const qrToken      = userCoupon.qr_token ?? `UNNIEPICK_${coupon.id}_${userCoupon.id}`;

  const [viewMode,     setViewMode]     = useState<ViewMode>('qr');
  const [pin,          setPin]          = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [cancelling,   setCancelling]   = useState(false);
  const [pinSuccess,   setPinSuccess]   = useState(false);
  // 후기 모달
  const [reviewModal,  setReviewModal]  = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment,setReviewComment]= useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const starAnims = useRef([0,1,2,3,4].map(() => new Animated.Value(1))).current;

  const bounceStar = (i: number) => {
    Animated.sequence([
      Animated.timing(starAnims[i], { toValue: 1.5, duration: 100, useNativeDriver: true }),
      Animated.spring(starAnims[i], { toValue: 1, useNativeDriver: true }),
    ]).start();
  };

  const handleReviewSubmit = async () => {
    if (reviewRating === 0) { Alert.alert('별점을 선택해주세요'); return; }
    setReviewSaving(true);
    try {
      await submitReview(userCoupon.id, reviewRating, reviewComment.trim() || undefined);
      setReviewModal(false);
      Alert.alert('감사해요! 🙏', '후기가 등록됐어요', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('등록 실패', e.message ?? '다시 시도해주세요');
    } finally {
      setReviewSaving(false);
    }
  };

  const isAvailable   = userCoupon.status === 'available';
  const canCancel     = isAvailable && canCancelCoupon(coupon.expires_at);
  const deadlineLabel = cancelDeadlineText(coupon.expires_at);

  // ── PIN 제출 ──────────────────────────────────────────────────────────────
  const handlePinSubmit = async () => {
    if (pin.length !== 4) {
      Alert.alert('4자리 비밀번호를 모두 입력해주세요');
      return;
    }
    setSubmitting(true);
    try {
      const session = await getSession();
      if (!session) throw new Error('로그인이 필요해요');

      const result = await useCouponByPin(userCoupon.id, session.user.id, pin);

      if (result.success) {
        setPinSuccess(true);
        // 후기 모달 띄우기
        setReviewRating(0);
        setReviewComment('');
        setReviewModal(true);
      } else {
        setPin('');
        Alert.alert('사용 불가', result.message);
      }
    } catch (e: any) {
      setPin('');
      Alert.alert('오류', e.message ?? '처리 중 문제가 생겼어요');
    } finally {
      setSubmitting(false);
    }
  };

  // ── 쿠폰 취소 ─────────────────────────────────────────────────────────────
  const handleCancel = () => {
    Alert.alert(
      '쿠폰 취소',
      `"${coupon.title}" 쿠폰을 취소할까요?\n\n취소된 쿠폰은 복구되지 않아요.\n노쇼 발생 시 불이익이 적용될 수 있어요.`,
      [
        { text: '유지', style: 'cancel' },
        {
          text: '취소하기', style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              const session = await getSession();
              if (!session) throw new Error('로그인이 필요해요');
              await cancelCoupon(userCoupon.id, session.user.id);
              cancelCouponExpiryReminder(userCoupon.id).catch(() => {});
              Alert.alert('취소 완료', '쿠폰이 취소됐어요', [
                { text: '확인', onPress: () => navigation.goBack() },
              ]);
            } catch (e: any) {
              Alert.alert('오류', e.message ?? '취소에 실패했어요');
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
        <Text style={s.backText}>← 뒤로</Text>
      </TouchableOpacity>

      <View style={s.container}>
        <Text style={s.title}>내 쿠폰</Text>
        <Text style={s.subtitle}>직원에게 보여주거나 비밀번호로 사용하세요</Text>

        {/* ── 모드 탭 ── */}
        <View style={s.tabRow}>
          <TouchableOpacity
            style={[s.tab, viewMode === 'qr' && s.tabActive]}
            onPress={() => { setViewMode('qr'); setPin(''); }}
          >
            <Text style={[s.tabText, viewMode === 'qr' && s.tabTextActive]}>
              📷 QR 코드
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, viewMode === 'pin' && s.tabActive]}
            onPress={() => { setViewMode('pin'); setPin(''); }}
          >
            <Text style={[s.tabText, viewMode === 'pin' && s.tabTextActive]}>
              🔢 비밀번호 입력
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── QR 모드 ── */}
        {viewMode === 'qr' && (
          <View style={[s.card, SHADOW.card]}>
            <Text style={s.couponTitle}>{coupon.title}</Text>
            <Text style={s.discount}>
              {coupon.discount_type === 'percent'
                ? `${coupon.discount_value}% 할인`
                : `${coupon.discount_value.toLocaleString()}원 할인`}
            </Text>
            <View style={s.qrWrapper}>
              <QRCode
                value={qrToken}
                size={200}
                color={COLORS.text}
                backgroundColor={COLORS.white}
              />
            </View>
            <View style={s.expiryRow}>
              <Text style={s.expiryLabel}>유효기간</Text>
              <Text style={s.expiryValue}>~{coupon.expires_at}</Text>
            </View>
          </View>
        )}

        {/* ── PIN 입력 모드 ── */}
        {viewMode === 'pin' && (
          <View style={[s.card, SHADOW.card]}>
            <Text style={s.couponTitle}>{coupon.title}</Text>
            <Text style={s.discount}>
              {coupon.discount_type === 'percent'
                ? `${coupon.discount_value}% 할인`
                : `${coupon.discount_value.toLocaleString()}원 할인`}
            </Text>

            <View style={s.pinSection}>
              <Text style={s.pinGuide}>
                💬 직원에게 가게 비밀번호를 물어보고{'\n'}4자리를 입력해주세요
              </Text>

              <PinInput value={pin} onChange={setPin} />

              <TouchableOpacity
                style={[s.pinBtn, (pin.length < 4 || submitting) && s.pinBtnDisabled]}
                onPress={handlePinSubmit}
                disabled={pin.length < 4 || submitting}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.pinBtnText}>✅ 쿠폰 사용하기</Text>}
              </TouchableOpacity>
            </View>

            <View style={s.pinInfoBox}>
              <Text style={s.pinInfoText}>
                🔒 비밀번호는 가게마다 달라요{'\n'}
                직원에게 직접 물어봐야 해요
              </Text>
            </View>
          </View>
        )}

        {/* 취소 정책 안내 */}
        <View style={s.cancelPolicyBox}>
          <Text style={s.cancelPolicyTitle}>🚫 취소 정책</Text>
          <Text style={s.cancelPolicyText}>
            {canCancel ? `• 취소 가능: ${deadlineLabel}` : '• 당일 취소 불가 (취소 기한 초과)'}
          </Text>
          <Text style={s.cancelPolicyText}>• 당일 취소 불가 · 노쇼 시 불이익 적용</Text>
        </View>

        <View style={s.warningBox}>
          <Text style={s.warningText}>⚠️ 사용 후 QR 및 비밀번호는 자동으로 만료됩니다</Text>
        </View>

        {/* 취소 버튼 */}
        {isAvailable && (
          <TouchableOpacity
            style={[s.cancelBtn, !canCancel && s.cancelBtnDisabled]}
            onPress={canCancel ? handleCancel : undefined}
            disabled={!canCancel || cancelling}
            activeOpacity={0.8}
          >
            {cancelling
              ? <ActivityIndicator color={canCancel ? '#DC2626' : '#999'} />
              : <Text style={[s.cancelBtnText, !canCancel && s.cancelBtnTextDisabled]}>
                  {canCancel ? '쿠폰 취소하기' : '취소 기한 초과'}
                </Text>}
          </TouchableOpacity>
        )}
      </View>

      {/* ── 후기 모달 (쿠폰 사용 완료 직후) ── */}
      <Modal visible={reviewModal} transparent animationType="slide" onRequestClose={() => {
        setReviewModal(false); navigation.goBack();
      }}>
        <View style={rv.overlay}>
          <TouchableOpacity style={rv.backdrop} activeOpacity={1} onPress={() => {
            setReviewModal(false); navigation.goBack();
          }} />
          <View style={rv.sheet}>
            <View style={rv.handle} />

            {/* 완료 메시지 */}
            <Text style={rv.doneIcon}>🎉</Text>
            <Text style={rv.doneTitle}>쿠폰 사용 완료!</Text>
            <Text style={rv.storeName}>{coupon.store?.name ?? '가게'}</Text>
            <Text style={rv.couponName}>{coupon.title}</Text>

            <Text style={rv.prompt}>방문은 어떠셨나요?</Text>

            {/* 별점 */}
            <View style={rv.stars}>
              {[1,2,3,4,5].map(i => (
                <TouchableOpacity key={i} onPress={() => { setReviewRating(i); bounceStar(i - 1); }} activeOpacity={0.75}>
                  <Animated.Text style={[rv.star, { transform: [{ scale: starAnims[i - 1] }] }]}>
                    {i <= reviewRating ? '⭐' : '☆'}
                  </Animated.Text>
                </TouchableOpacity>
              ))}
            </View>
            {reviewRating > 0 && (
              <Text style={rv.ratingLabel}>
                {['','별로예요','그저 그래요','괜찮아요','좋아요','최고예요!'][reviewRating]}
              </Text>
            )}

            <TextInput
              style={rv.input}
              value={reviewComment}
              onChangeText={setReviewComment}
              placeholder="후기를 남겨주세요 (선택)"
              placeholderTextColor="#BBBBBB"
              multiline
              maxLength={200}
            />

            <View style={rv.btnRow}>
              <TouchableOpacity style={rv.skipBtn} onPress={() => { setReviewModal(false); navigation.goBack(); }}>
                <Text style={rv.skipText}>나중에</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[rv.submitBtn, (reviewRating === 0 || reviewSaving) && { opacity: 0.5 }]}
                onPress={handleReviewSubmit}
                disabled={reviewRating === 0 || reviewSaving}
              >
                {reviewSaving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={rv.submitText}>⭐ 후기 등록</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const rv = StyleSheet.create({
  overlay:    { flex: 1, justifyContent: 'flex-end' },
  backdrop:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#00000055' },
  sheet:      {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 28, paddingBottom: 44, alignItems: 'center', gap: 4,
  },
  handle:     { width: 36, height: 4, backgroundColor: '#E8E8E8', borderRadius: 2, marginBottom: 8 },
  doneIcon:   { fontSize: 48, marginBottom: 4 },
  doneTitle:  { fontSize: 20, fontWeight: '800', color: '#101010' },
  storeName:  { fontSize: 13, color: '#999', fontWeight: '600' },
  couponName: { fontSize: 15, fontWeight: '700', color: '#444', marginBottom: 8 },
  prompt:     { fontSize: 15, color: '#666', marginBottom: 6 },
  stars:      { flexDirection: 'row', gap: 6, marginBottom: 4 },
  star:       { fontSize: 40 },
  ratingLabel:{ fontSize: 14, color: COLORS.primary, fontWeight: '700', marginBottom: 8 },
  input:      {
    width: '100%', borderWidth: 1, borderColor: '#EBEBEB', borderRadius: 12,
    padding: 12, fontSize: 14, color: '#101010', minHeight: 70, textAlignVertical: 'top',
    marginTop: 4, marginBottom: 4,
  },
  btnRow:     { flexDirection: 'row', gap: 10, width: '100%', marginTop: 4 },
  skipBtn:    { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F5F5F5', alignItems: 'center' },
  skipText:   { fontSize: 15, fontWeight: '700', color: '#999' },
  submitBtn:  { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center' },
  submitText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});

// ── PIN 입력 스타일 ───────────────────────────────────────────────────────────
const pi = StyleSheet.create({
  wrap: {
    flexDirection: 'row', gap: 12, justifyContent: 'center',
    paddingVertical: 8,
  },
  hidden: {
    position: 'absolute', width: 1, height: 1, opacity: 0,
  },
  box: {
    width: 56, height: 64, borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  boxFocused: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight + '20' },
  boxFilled:  { borderColor: COLORS.primary },
  digit:      { fontSize: 28, fontWeight: '900', color: COLORS.text },
  cursor: {
    position: 'absolute', bottom: 14, width: 2, height: 24,
    backgroundColor: COLORS.primary, borderRadius: 1,
  },
});

// ── 화면 스타일 ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.background },
  backBtn: { padding: 20, paddingBottom: 8 },
  backText:{ fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  container:{ flex: 1, padding: 20, alignItems: 'center', gap: 14 },

  title:   { fontSize: 24, fontWeight: '800', color: COLORS.text },
  subtitle:{ fontSize: 13, color: COLORS.textMuted },

  // 탭
  tabRow: {
    flexDirection: 'row', backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg, padding: 4, gap: 4,
    borderWidth: 1, borderColor: COLORS.border, width: '100%',
  },
  tab:     { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, alignItems: 'center' },
  tabActive:{ backgroundColor: COLORS.white, ...({ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 } as any) },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  tabTextActive:{ fontSize: 13, fontWeight: '800', color: COLORS.primary },

  // 카드
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    padding: 24, alignItems: 'center', gap: 12, width: '100%',
  },
  couponTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  discount:    { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  qrWrapper: {
    padding: 16, backgroundColor: COLORS.white,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
  },
  expiryRow: {
    flexDirection: 'row', gap: 8,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border, width: '100%',
    justifyContent: 'center',
  },
  expiryLabel:{ fontSize: 13, color: COLORS.textMuted },
  expiryValue:{ fontSize: 13, fontWeight: '600', color: COLORS.primary },

  // PIN 섹션
  pinSection:  { width: '100%', alignItems: 'center', gap: 16 },
  pinGuide:    { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  pinBtn: {
    width: '100%', backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center',
  },
  pinBtnDisabled: { backgroundColor: COLORS.textMuted },
  pinBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  pinInfoBox: {
    backgroundColor: '#F0F7FF', borderRadius: RADIUS.md,
    padding: 12, width: '100%',
    borderWidth: 1, borderColor: '#BFD7FF',
  },
  pinInfoText: { fontSize: 12, color: '#2563EB', lineHeight: 18, textAlign: 'center' },

  // 하단 박스
  cancelPolicyBox: {
    backgroundColor: '#FFF3CD', borderRadius: RADIUS.md,
    padding: 14, width: '100%', gap: 4,
    borderLeftWidth: 3, borderLeftColor: '#F59E0B',
  },
  cancelPolicyTitle:{ fontSize: 13, fontWeight: '800', color: '#92400E', marginBottom: 2 },
  cancelPolicyText: { fontSize: 12, color: '#92400E', lineHeight: 18 },
  warningBox: {
    backgroundColor: COLORS.accent + '33',
    borderRadius: RADIUS.md, padding: 12, width: '100%',
  },
  warningText:{ fontSize: 13, color: COLORS.text, fontWeight: '500', textAlign: 'center' },
  cancelBtn: {
    width: '100%', borderRadius: RADIUS.md,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#DC2626', backgroundColor: '#FFF5F5',
  },
  cancelBtnDisabled: { borderColor: COLORS.border, backgroundColor: COLORS.background },
  cancelBtnText:         { fontSize: 15, fontWeight: '700', color: '#DC2626' },
  cancelBtnTextDisabled: { fontSize: 15, fontWeight: '700', color: COLORS.textMuted },
});
