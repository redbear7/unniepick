// NOTE: run `npx expo install expo-image-picker` if not yet installed
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';
import {
  CouponKind, COUPON_KIND_CONFIG,
  createCoupon, updateCouponImages, uploadCouponImage,
} from '../../lib/services/couponService';
import { supabase } from '../../lib/supabase';

type DiscountType = 'percent' | 'amount';

interface PickedImage {
  uri:      string;
  mimeType: string;
}

export default function CouponCreateScreen() {
  const navigation = useNavigation<any>();
  const [couponKind,          setCouponKind]          = useState<CouponKind>('regular');
  const [title,               setTitle]               = useState('');
  const [description,         setDescription]         = useState('');
  const [discountType,        setDiscountType]        = useState<DiscountType>('percent');
  const [discountValue,       setDiscountValue]       = useState('');
  const [quantity,            setQuantity]            = useState('');
  const [isUnlimited,         setIsUnlimited]         = useState(false);
  const [expiresAt,           setExpiresAt]           = useState('');
  // 체험단 전용
  const [experienceOffer,     setExperienceOffer]     = useState('');
  const [experienceMission,   setExperienceMission]   = useState('');
  // 이미지 (최대 2장)
  const [photo1,              setPhoto1]              = useState<PickedImage | null>(null);
  const [photo2,              setPhoto2]              = useState<PickedImage | null>(null);
  const [saving,              setSaving]              = useState(false);

  const isExperience = couponKind === 'experience';

  // ── 이미지 선택 ──────────────────────────────────────────────────────────────
  async function pickImage(slot: 1 | 2) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('사진 접근 권한이 필요해요', '설정에서 권한을 허용해주세요');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled) return;
    const asset = result.assets[0];
    const picked: PickedImage = {
      uri:      asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
    };
    if (slot === 1) setPhoto1(picked);
    else            setPhoto2(picked);
  }

  async function takePhoto(slot: 1 | 2) {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('카메라 접근 권한이 필요해요', '설정에서 권한을 허용해주세요');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled) return;
    const asset = result.assets[0];
    const picked: PickedImage = {
      uri:      asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
    };
    if (slot === 1) setPhoto1(picked);
    else            setPhoto2(picked);
  }

  function showPhotoOptions(slot: 1 | 2) {
    Alert.alert('사진 추가', '', [
      { text: '갤러리에서 선택', onPress: () => pickImage(slot) },
      { text: '카메라로 촬영',  onPress: () => takePhoto(slot)  },
      slot === 1 && photo1 ? { text: '삭제', style: 'destructive', onPress: () => setPhoto1(null) } :
      slot === 2 && photo2 ? { text: '삭제', style: 'destructive', onPress: () => setPhoto2(null) } :
      null,
      { text: '취소', style: 'cancel' },
    ].filter(Boolean) as any[]);
  }

  // ── 쿠폰 생성 ────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!title || (!isUnlimited && !quantity) || !expiresAt) {
      Alert.alert('모든 항목을 입력해주세요');
      return;
    }
    if (!isExperience && !discountValue) {
      Alert.alert('할인 금액/율을 입력해주세요');
      return;
    }
    if (isExperience && (!experienceOffer || !experienceMission)) {
      Alert.alert('체험단 제공 내용과 미션을 입력해주세요');
      return;
    }

    // 날짜 유효성
    const expDate = new Date(expiresAt);
    if (isNaN(expDate.getTime()) || expDate <= new Date()) {
      Alert.alert('유효기간을 올바르게 입력해주세요 (예: 2026-12-31)');
      return;
    }

    setSaving(true);
    try {
      // 1. 로그인 세션에서 ownerId / storeId 조회
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요해요');

      const { data: store, error: storeErr } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', session.user.id)
        .eq('is_active', true)
        .single();

      if (storeErr || !store) throw new Error('가게 정보를 찾을 수 없어요');

      // 2. 쿠폰 생성
      const coupon = await createCoupon({
        ownerId:           session.user.id,
        storeId:           store.id,
        couponKind,
        title:             title.trim(),
        description:       description.trim(),
        discountType:      isExperience ? 'amount' : discountType,
        discountValue:     isExperience ? 0 : Number(discountValue),
        totalQuantity:     isUnlimited ? null : Number(quantity),
        expiresAt,
        experienceOffer:   isExperience ? experienceOffer.trim()   : undefined,
        experienceMission: isExperience ? experienceMission.trim() : undefined,
      });

      // 3. 이미지 업로드 (있을 때만)
      let url1: string | null = null;
      let url2: string | null = null;

      if (photo1) {
        url1 = await uploadCouponImage(store.id, coupon.id, 1, photo1.uri, photo1.mimeType);
      }
      if (photo2) {
        url2 = await uploadCouponImage(store.id, coupon.id, 2, photo2.uri, photo2.mimeType);
      }

      // 4. 이미지 URL 업데이트
      if (url1 || url2) {
        await updateCouponImages(coupon.id, url1, url2);
      }

      Alert.alert('쿠폰 생성 완료!', `"${title}" 쿠폰이 등록됐어요 🎉`, [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('오류', e?.message ?? '쿠폰 생성에 실패했어요');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← 뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.title}>쿠폰 생성</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.container}>
          <View style={[styles.card, SHADOW.card]}>

            {/* ── 쿠폰 종류 선택 ── */}
            <Field label="쿠폰 종류 *">
              <View style={styles.kindRow}>
                {(Object.entries(COUPON_KIND_CONFIG) as [CouponKind, typeof COUPON_KIND_CONFIG[CouponKind]][]).map(
                  ([key, cfg]) => {
                    const isActive = couponKind === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[
                          styles.kindBtn,
                          isActive && { backgroundColor: cfg.bg, borderColor: cfg.bg },
                        ]}
                        onPress={() => setCouponKind(key)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.kindBtnEmoji}>{cfg.emoji}</Text>
                        <Text style={[
                          styles.kindBtnLabel,
                          isActive && { color: '#fff', fontFamily: 'WantedSans-ExtraBold', fontWeight: '800' },
                        ]}>
                          {cfg.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                )}
              </View>

              {/* 선택된 종류 미리보기 */}
              <View style={[styles.kindPreview, { backgroundColor: COUPON_KIND_CONFIG[couponKind].subBg }]}>
                <View style={[styles.kindPreviewBadge, { backgroundColor: COUPON_KIND_CONFIG[couponKind].bg }]}>
                  <Text style={styles.kindPreviewEmoji}>{COUPON_KIND_CONFIG[couponKind].emoji}</Text>
                  <Text style={styles.kindPreviewLabel}>{COUPON_KIND_CONFIG[couponKind].label}</Text>
                </View>
                <Text style={[styles.kindPreviewDesc, { color: COUPON_KIND_CONFIG[couponKind].bg }]}>
                  {{
                    regular:    '항상 제공되는 기본 할인 쿠폰이에요',
                    timesale:   '특정 시간대에만 사용 가능한 쿠폰이에요',
                    service:    '무료 서비스·증정품 제공 쿠폰이에요',
                    experience: '체험단 모집 · 미션 완료 후 혜택을 드려요',
                  }[couponKind]}
                </Text>
              </View>
            </Field>

            <Field label="쿠폰 제목 *">
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="예) 삼겹살 세트 20% 할인"
                placeholderTextColor={COLORS.textMuted}
              />
            </Field>

            <Field label="설명">
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDescription}
                placeholder="예) 2인 세트 메뉴 주문 시 적용"
                placeholderTextColor={COLORS.textMuted}
              />
            </Field>

            {/* ── 체험단 전용 필드 ── */}
            {isExperience ? (
              <>
                <Field label="체험단 제공 *">
                  <TextInput
                    style={styles.input}
                    value={experienceOffer}
                    onChangeText={setExperienceOffer}
                    placeholder="예) 2인 코스 메뉴 무료 제공 (7만원 상당)"
                    placeholderTextColor={COLORS.textMuted}
                    maxLength={80}
                  />
                  <Text style={styles.charCount}>{experienceOffer.length}/80자</Text>
                </Field>

                <Field label="체험단 미션 *">
                  <TextInput
                    style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                    value={experienceMission}
                    onChangeText={setExperienceMission}
                    placeholder={
                      '예) 방문 후 A사 영수증 리뷰 + 인스타그램 스토리 태그 필수\n(#언니픽 #가게명)'
                    }
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                    maxLength={200}
                  />
                  <Text style={styles.charCount}>{experienceMission.length}/200자</Text>
                </Field>
              </>
            ) : (
              /* ── 일반 할인 필드 ── */
              <>
                <Field label="할인 유형 *">
                  <View style={styles.typeRow}>
                    {(['percent', 'amount'] as DiscountType[]).map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.typeBtn, discountType === t && styles.typeBtnActive]}
                        onPress={() => setDiscountType(t)}
                      >
                        <Text style={[styles.typeBtnText, discountType === t && styles.typeBtnTextActive]}>
                          {t === 'percent' ? '% 할인' : '금액 할인'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Field>

                <Field label={discountType === 'percent' ? '할인율 (%) *' : '할인 금액 (원) *'}>
                  <TextInput
                    style={styles.input}
                    value={discountValue}
                    onChangeText={setDiscountValue}
                    placeholder={discountType === 'percent' ? '예) 20' : '예) 3000'}
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="numeric"
                  />
                </Field>
              </>
            )}

            <Field label="발급 수량 *">
              <TouchableOpacity
                style={[styles.unlimitedBtn, isUnlimited && styles.unlimitedBtnActive]}
                onPress={() => { setIsUnlimited(p => !p); setQuantity(''); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.unlimitedBtnText, isUnlimited && styles.unlimitedBtnTextActive]}>
                  {isUnlimited ? '✓ 무제한' : '무제한'}
                </Text>
              </TouchableOpacity>
              {!isUnlimited && (
                <TextInput
                  style={styles.input}
                  value={quantity}
                  onChangeText={setQuantity}
                  placeholder="예) 100"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                />
              )}
              {isUnlimited && (
                <View style={styles.unlimitedInfo}>
                  <Text style={styles.unlimitedInfoText}>∞ 수량 제한 없이 발급됩니다</Text>
                </View>
              )}
            </Field>

            <Field label="유효기간 * (YYYY-MM-DD)">
              <TextInput
                style={styles.input}
                value={expiresAt}
                onChangeText={setExpiresAt}
                placeholder="예) 2026-12-31"
                placeholderTextColor={COLORS.textMuted}
              />
            </Field>

            {/* ── 사진 등록 (최대 2장) ── */}
            <Field label="사진 (선택, 최대 2장)">
              <View style={styles.photoRow}>
                {/* 슬롯 1 */}
                <PhotoSlot
                  photo={photo1}
                  label="대표 사진"
                  onPress={() => showPhotoOptions(1)}
                />
                {/* 슬롯 2 */}
                <PhotoSlot
                  photo={photo2}
                  label="추가 사진"
                  onPress={() => showPhotoOptions(2)}
                />
              </View>
              <Text style={styles.photoHint}>
                정사각형 비율로 자동 편집됩니다. 탭하여 갤러리/카메라에서 선택하세요.
              </Text>
            </Field>

          </View>

          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: COUPON_KIND_CONFIG[couponKind].bg }, saving && { opacity: 0.6 }]}
            onPress={handleCreate}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createBtnText}>
                {COUPON_KIND_CONFIG[couponKind].emoji} 쿠폰 생성하기
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── PhotoSlot 컴포넌트 ──────────────────────────────────────────────────────
function PhotoSlot({
  photo,
  label,
  onPress,
}: {
  photo:   PickedImage | null;
  label:   string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.photoSlot} onPress={onPress} activeOpacity={0.8}>
      {photo ? (
        <>
          <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
          <View style={styles.photoEditBadge}>
            <Text style={styles.photoEditBadgeText}>편집</Text>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.photoAddIcon}>📷</Text>
          <Text style={styles.photoAddLabel}>{label}</Text>
          <Text style={styles.photoAddSub}>탭하여 추가</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ── Field 컴포넌트 ──────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={fieldStyles.container}>
      <Text style={fieldStyles.label}>{label}</Text>
      {children}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  container: { gap: 8 },
  label:     { fontSize: 13, fontFamily: 'WantedSans-Bold', fontWeight: '700', color: COLORS.text },
});

const SLOT_SIZE = 140;

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, paddingBottom: 8,
  },
  backText: { fontSize: 16, color: COLORS.primary, fontFamily: 'WantedSans-SemiBold', fontWeight: '600' },
  title:    { fontSize: 18, fontFamily: 'WantedSans-ExtraBold', fontWeight: '800', color: COLORS.text },
  container:{ padding: 20, gap: 16, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 20, gap: 18,
  },
  input: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: 12, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.background,
  },

  // 쿠폰 종류 선택
  kindRow: { flexDirection: 'row', gap: 8 },
  kindBtn: {
    flex: 1, paddingVertical: 12, paddingHorizontal: 6,
    borderRadius: RADIUS.md, alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  kindBtnEmoji: { fontSize: 20 },
  kindBtnLabel: { fontSize: 11, fontFamily: 'WantedSans-SemiBold', fontWeight: '600', color: COLORS.textMuted, textAlign: 'center' },

  // 미리보기
  kindPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: RADIUS.md, padding: 12, marginTop: 4,
  },
  kindPreviewBadge: {
    width: 52, height: 52, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  kindPreviewEmoji: { fontSize: 20 },
  kindPreviewLabel: { fontSize: 9, fontFamily: 'WantedSans-ExtraBold', fontWeight: '800', color: '#fff', textAlign: 'center' },
  kindPreviewDesc:  { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: 'WantedSans-Medium', fontWeight: '500' },

  typeRow:         { flexDirection: 'row', gap: 10 },
  typeBtn: {
    flex: 1, padding: 12, borderRadius: RADIUS.md, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.background,
  },
  typeBtnActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeBtnText:       { fontSize: 14, fontFamily: 'WantedSans-SemiBold', fontWeight: '600', color: COLORS.textMuted },
  typeBtnTextActive: { color: COLORS.white },

  createBtn: {
    borderRadius: RADIUS.lg, padding: 18, alignItems: 'center',
  },
  createBtnText: { color: COLORS.white, fontSize: 17, fontFamily: 'WantedSans-ExtraBold', fontWeight: '800' },
  charCount:     { fontSize: 11, color: COLORS.textMuted, textAlign: 'right', marginTop: 2 },

  // 무제한 토글
  unlimitedBtn: {
    alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  unlimitedBtnActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  unlimitedBtnText:       { fontSize: 13, fontFamily: 'WantedSans-Bold', fontWeight: '700', color: COLORS.textMuted },
  unlimitedBtnTextActive: { color: '#fff' },
  unlimitedInfo: {
    backgroundColor: '#E8F5E9', borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  unlimitedInfoText: { fontSize: 13, color: '#2E7D32', fontFamily: 'WantedSans-SemiBold', fontWeight: '600' },

  // 사진 슬롯
  photoRow: { flexDirection: 'row', gap: 12 },
  photoSlot: {
    width: SLOT_SIZE, height: SLOT_SIZE,
    borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border,
    borderStyle: 'dashed', backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  photoPreview: { width: SLOT_SIZE, height: SLOT_SIZE, borderRadius: RADIUS.md },
  photoEditBadge: {
    position: 'absolute', bottom: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  photoEditBadgeText: { color: '#fff', fontSize: 11, fontFamily: 'WantedSans-Bold', fontWeight: '700' },
  photoAddIcon:  { fontSize: 28, marginBottom: 4 },
  photoAddLabel: { fontSize: 13, fontFamily: 'WantedSans-Bold', fontWeight: '700', color: COLORS.text },
  photoAddSub:   { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  photoHint:     { fontSize: 11, color: COLORS.textMuted, lineHeight: 16 },
});
