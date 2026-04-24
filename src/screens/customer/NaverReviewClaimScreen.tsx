/**
 * NaverReviewClaimScreen — 네이버 리뷰 인증 쿠폰
 *
 * 2단계 플로우:
 *   1단계: 네이버 앱에서 리뷰 작성 (링크 배너)
 *   2단계: 스크린샷 갤러리에서 선택 → 제출
 *   완료:  즉시 등록 + 쿠폰 바로 발급
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

// ── 테마 ─────────────────────────────────────────────────────────
const C = {
  brand:    '#FF6F0F', brandBg: '#FFF3EB', brandBd: '#FFCBA4',
  g900: '#191F28', g800: '#333D4B', g700: '#4E5968', g600: '#6B7684',
  g500: '#8B95A1', g400: '#ADB5BD', g300: '#D1D6DB',
  g200: '#E5E8EB', g100: '#F2F4F6', g50: '#F9FAFB',
  green:      '#0AC86E', greenBg: '#EAFAF1', greenBd: '#A7ECC8', greenDark: '#0C5C2E',
  naverGreen: '#03C75A',
  red:   '#E53935', white: '#FFFFFF',
};

const NAVER_REVIEW_URL = 'https://m.place.naver.com/my/checkin';

// ── 이미지 전처리 ─────────────────────────────────────────────────
async function resizeForUpload(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1080 } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri;
  } catch {
    return uri;
  }
}

// ── Supabase Storage 업로드 ───────────────────────────────────────
async function uploadScreenshot(uri: string, userId: string): Promise<string> {
  const processed = await resizeForUpload(uri);
  const res        = await fetch(processed);
  const blob       = await res.blob();
  const path       = `${userId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from('review-screenshots')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });

  if (error) throw new Error(`업로드 실패: ${error.message}`);

  const { data } = supabase.storage.from('review-screenshots').getPublicUrl(path);
  return data.publicUrl;
}

// ── 메인 ─────────────────────────────────────────────────────────
type Step = 'main' | 'submitting' | 'done';

export default function NaverReviewClaimScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();

  const storeId     = route.params?.storeId    as string;
  const storeName   = route.params?.storeName  as string;
  const couponId    = route.params?.couponId   as string | undefined;
  const couponTitle = route.params?.couponTitle as string | undefined;

  const [step,          setStep]          = useState<Step>('main');
  const [screenshot,    setScreenshot]    = useState<string | null>(null);
  const [error,         setError]         = useState('');

  // ── 갤러리 선택 ───────────────────────────────────────────────
  const pickScreenshot = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setScreenshot(result.assets[0].uri);
    setError('');
  };

  // ── 제출 ─────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!screenshot) return;
    setStep('submitting');
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다');

      const screenshotUrl = await uploadScreenshot(screenshot, user.id);

      const ADMIN_URL = process.env.EXPO_PUBLIC_ADMIN_URL ?? 'https://unniepick.com';
      const res = await fetch(`${ADMIN_URL}/api/review-claims/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id:        user.id,
          store_id:       storeId,
          coupon_id:      couponId ?? null,
          screenshot_url: screenshotUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '제출 실패');

      setStep('done');
    } catch (e: unknown) {
      setError((e as Error).message ?? '오류가 발생했어요');
      setStep('main');
    }
  };

  // ── 완료 화면 ─────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.doneWrap}>
          <View style={s.doneIcon}>
            <Ionicons name="checkmark" size={42} color={C.white} />
          </View>
          <Text style={s.doneTitle}>리뷰 등록 완료!</Text>
          <Text style={s.doneDesc}>
            가게에 내 리뷰가 바로 등록됐어요 🎉
          </Text>
          {couponTitle && (
            <View style={s.couponBadge}>
              <Ionicons name="ticket-outline" size={16} color={C.brand} />
              <Text style={s.couponBadgeText}>{couponTitle} 발급 완료!</Text>
            </View>
          )}
          <TouchableOpacity style={s.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={s.doneBtnText}>확인</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── 업로드 중 ─────────────────────────────────────────────────
  if (step === 'submitting') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.doneWrap}>
          <ActivityIndicator size="large" color={C.brand} />
          <Text style={[s.doneDesc, { marginTop: 20 }]}>등록 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── 메인 화면 ─────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.g900} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>리뷰 인증 쿠폰</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* 쿠폰 프리뷰 */}
        {couponTitle && (
          <View style={s.couponPreview}>
            <Ionicons name="ticket-outline" size={16} color={C.brand} />
            <Text style={s.couponPreviewText}>리뷰 작성 시 <Text style={{ color: C.brand, fontWeight: '800' }}>{couponTitle}</Text> 발급</Text>
          </View>
        )}

        {/* ── STEP 1 ─────────────────────────────────────────── */}
        <View style={s.stepCard}>
          <View style={s.stepHeader}>
            <View style={s.stepNum}><Text style={s.stepNumText}>1</Text></View>
            <Text style={s.stepTitle}>네이버 리뷰 작성하기</Text>
          </View>
          <Text style={s.stepDesc}>
            네이버 지도에서 <Text style={{ fontWeight: '700' }}>{storeName}</Text>을 검색하고{'\n'}
            영수증 인증 리뷰를 작성해주세요.
          </Text>

          {/* 네이버 링크 배너 */}
          <TouchableOpacity
            style={s.naverBanner}
            activeOpacity={0.82}
            onPress={() => Linking.openURL(NAVER_REVIEW_URL)}
          >
            <View style={s.naverBannerLeft}>
              <View style={s.naverDot} />
              <Text style={s.naverBannerText}>네이버 앱에서 리뷰 작성하기</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={C.naverGreen} />
          </TouchableOpacity>
        </View>

        {/* ── STEP 2 ─────────────────────────────────────────── */}
        <View style={s.stepCard}>
          <View style={s.stepHeader}>
            <View style={s.stepNum}><Text style={s.stepNumText}>2</Text></View>
            <Text style={s.stepTitle}>리뷰 스크린샷 등록하기</Text>
          </View>
          <Text style={s.stepDesc}>
            작성 완료된 리뷰 화면을 캡처하고{'\n'}
            아래 버튼으로 등록해주세요.
          </Text>

          {/* 선택된 스크린샷 미리보기 */}
          {screenshot && (
            <Image
              source={{ uri: screenshot }}
              style={s.preview}
              resizeMode="cover"
            />
          )}

          {/* 선택 버튼 */}
          <TouchableOpacity
            style={[s.galleryBtn, screenshot && s.galleryBtnSecondary]}
            onPress={pickScreenshot}
            activeOpacity={0.85}
          >
            <Ionicons name={screenshot ? 'refresh-outline' : 'image-outline'} size={18} color={screenshot ? C.brand : C.white} />
            <Text style={[s.galleryBtnText, screenshot && s.galleryBtnTextSecondary]}>
              {screenshot ? '다른 스크린샷 선택' : '갤러리에서 선택'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 에러 */}
        {!!error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* 제출 버튼 — 스크린샷 선택 후 활성 */}
        {screenshot && (
          <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} activeOpacity={0.85}>
            <Ionicons name="checkmark-circle-outline" size={20} color={C.white} />
            <Text style={s.submitBtnText}>인증 완료하기</Text>
          </TouchableOpacity>
        )}

        <Text style={s.notice}>
          ※ 실제 네이버 영수증 리뷰 스크린샷이 아닌 경우 등록이 제한될 수 있어요.
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.g50 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.g200,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.g900 },
  scroll:      { flex: 1 },
  scrollContent:{ padding: 20, gap: 14, paddingBottom: 48 },

  // 쿠폰 프리뷰
  couponPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.brandBg, borderRadius: 12, borderWidth: 1,
    borderColor: C.brandBd, paddingVertical: 12, paddingHorizontal: 14,
  },
  couponPreviewText: { fontSize: 14, color: C.g900, flex: 1 },

  // 단계 카드
  stepCard: {
    backgroundColor: C.white, borderRadius: 20, padding: 20, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNum: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: C.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { fontSize: 13, fontWeight: '800', color: C.white },
  stepTitle:   { fontSize: 16, fontWeight: '800', color: C.g900 },
  stepDesc:    { fontSize: 14, color: C.g600, lineHeight: 22 },

  // 네이버 배너
  naverBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#EDFBF3', borderRadius: 12, borderWidth: 1,
    borderColor: '#A3E8BF', paddingVertical: 12, paddingHorizontal: 14,
  },
  naverBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  naverDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.naverGreen },
  naverBannerText: { fontSize: 14, fontWeight: '700', color: '#007A3A' },

  // 스크린샷 미리보기
  preview: {
    width: '100%', height: 260, borderRadius: 14,
    backgroundColor: C.g100,
  },

  // 갤러리 버튼
  galleryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.brand, borderRadius: 14, paddingVertical: 14,
  },
  galleryBtnSecondary: {
    backgroundColor: C.white, borderWidth: 1.5, borderColor: C.brandBd,
  },
  galleryBtnText:          { fontSize: 15, fontWeight: '700', color: C.white },
  galleryBtnTextSecondary: { color: C.brand },

  // 에러
  errorBox:  { backgroundColor: '#FFF0F0', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FFD0D0' },
  errorText: { fontSize: 13, color: C.red, textAlign: 'center' },

  // 제출 버튼
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.green, borderRadius: 16, paddingVertical: 16,
  },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: C.white },

  // 주의사항
  notice: { fontSize: 12, color: C.g400, textAlign: 'center', lineHeight: 18 },

  // 완료
  doneWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  doneIcon:  {
    width: 88, height: 88, borderRadius: 44, backgroundColor: C.green,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  doneTitle: { fontSize: 26, fontWeight: '800', color: C.g900, marginBottom: 12 },
  doneDesc:  { fontSize: 15, color: C.g600, textAlign: 'center', lineHeight: 24, marginBottom: 20 },
  couponBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.brandBg, borderRadius: 20, borderWidth: 1,
    borderColor: C.brandBd, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 24,
  },
  couponBadgeText: { fontSize: 14, fontWeight: '700', color: C.g900 },
  doneBtn:    { backgroundColor: C.brand, borderRadius: 16, paddingHorizontal: 48, paddingVertical: 16 },
  doneBtnText:{ fontSize: 16, fontWeight: '800', color: C.white },
});
