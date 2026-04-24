/**
 * NaverReviewClaimScreen — 네이버 리뷰 인증 쿠폰 신청
 *
 * 플로우:
 *   1. 안내 화면 (네이버 앱에서 영수증 리뷰 작성 안내)
 *   2. 스크린샷 갤러리에서 선택
 *   3. 업로드 + 제출
 *   4. 완료 (심사 대기 안내)
 *
 * route.params:
 *   storeId:    string
 *   storeName:  string
 *   couponId?:  string  (naver_review 타입 쿠폰 id)
 *   couponTitle?: string
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
  brand: '#FF6F0F', brandBg: '#FFF3EB', brandBd: '#FFCBA4',
  g900: '#191F28', g800: '#333D4B', g700: '#4E5968', g600: '#6B7684',
  g500: '#8B95A1', g400: '#ADB5BD', g300: '#D1D6DB',
  g200: '#E5E8EB', g100: '#F2F4F6', g50: '#F9FAFB',
  green: '#0AC86E', red: '#E53935', white: '#FFFFFF',
  naverGreen: '#03C75A',
};

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

  const res       = await fetch(processed);
  const blob      = await res.blob();
  const ext       = 'jpg';
  const path      = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('review-screenshots')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });

  if (error) throw new Error(`업로드 실패: ${error.message}`);

  const { data } = supabase.storage.from('review-screenshots').getPublicUrl(path);
  return data.publicUrl;
}

// ── 메인 ─────────────────────────────────────────────────────────
type Step = 'guide' | 'select' | 'submitting' | 'done';

export default function NaverReviewClaimScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();

  const storeId    = route.params?.storeId    as string;
  const storeName  = route.params?.storeName  as string;
  const couponId   = route.params?.couponId   as string | undefined;
  const couponTitle = route.params?.couponTitle as string | undefined;

  const [step,       setStep]       = useState<Step>('guide');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [error,      setError]      = useState('');

  // ── 갤러리에서 스크린샷 선택 ─────────────────────────────────────
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
    setScreenshotUri(result.assets[0].uri);
    setStep('select');
  };

  // ── 제출 ─────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!screenshotUri) return;
    setStep('submitting');
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다');

      const screenshotUrl = await uploadScreenshot(screenshotUri, user.id);

      const ADMIN_URL = process.env.EXPO_PUBLIC_ADMIN_URL ?? 'https://unniepick.com';
      const res = await fetch(`${ADMIN_URL}/api/review-claims/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          store_id: storeId,
          coupon_id: couponId ?? null,
          screenshot_url: screenshotUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '제출 실패');

      setStep('done');
    } catch (e: unknown) {
      setError((e as Error).message ?? '오류가 발생했어요');
      setStep('select');
    }
  };

  // ── 완료 화면 ─────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.doneWrap}>
          <View style={s.doneIcon}>
            <Ionicons name="checkmark" size={40} color={C.white} />
          </View>
          <Text style={s.doneTitle}>인증 신청 완료!</Text>
          <Text style={s.doneDesc}>
            스크린샷을 확인하고 있어요.{'\n'}
            승인되면 쿠폰이 자동으로 발급돼요 🎉
          </Text>
          {couponTitle && (
            <View style={s.couponPreview}>
              <Text style={s.couponPreviewText}>🎟 {couponTitle}</Text>
            </View>
          )}
          <TouchableOpacity style={s.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={s.doneBtnText}>확인</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── 제출 중 ───────────────────────────────────────────────────────
  if (step === 'submitting') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.doneWrap}>
          <ActivityIndicator size="large" color={C.brand} />
          <Text style={[s.doneDesc, { marginTop: 16 }]}>업로드 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

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

        {step === 'guide' && (
          <>
            {/* 안내 카드 */}
            <View style={s.guideCard}>
              <Text style={s.guideEmoji}>📸</Text>
              <Text style={s.guideTitle}>{storeName}에{'\n'}네이버 리뷰를 남겨주세요!</Text>
              <Text style={s.guideDesc}>
                네이버 지도 앱에서 영수증 인증 리뷰를 작성하고{'\n'}
                스크린샷을 올려주시면 쿠폰을 드려요
              </Text>
            </View>

            {/* 쿠폰 미리보기 */}
            {couponTitle && (
              <View style={s.couponPreview}>
                <Text style={s.couponPreviewLabel}>받을 수 있는 쿠폰</Text>
                <Text style={s.couponPreviewText}>🎟 {couponTitle}</Text>
              </View>
            )}

            {/* 단계 안내 */}
            <View style={s.stepsCard}>
              <Text style={s.stepsTitle}>인증 방법</Text>
              {[
                { step: '1', icon: '🗺', text: '네이버 지도 앱 실행' },
                { step: '2', icon: '🔍', text: `"${storeName}" 검색` },
                { step: '3', icon: '🧾', text: '영수증 인증 리뷰 작성' },
                { step: '4', icon: '📸', text: '리뷰 완료 스크린샷 찍기' },
                { step: '5', icon: '✅', text: '아래 버튼으로 스크린샷 제출' },
              ].map(({ step: n, icon, text }) => (
                <View key={n} style={s.stepRow}>
                  <View style={s.stepNum}><Text style={s.stepNumText}>{n}</Text></View>
                  <Text style={s.stepIcon}>{icon}</Text>
                  <Text style={s.stepText}>{text}</Text>
                </View>
              ))}
            </View>

            {/* 스크린샷 선택 버튼 */}
            <TouchableOpacity style={s.primaryBtn} onPress={pickScreenshot} activeOpacity={0.85}>
              <Ionicons name="image-outline" size={20} color={C.white} />
              <Text style={s.primaryBtnText}>스크린샷 선택하기</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'select' && screenshotUri && (
          <>
            {/* 선택된 스크린샷 미리보기 */}
            <View style={s.previewCard}>
              <Text style={s.previewLabel}>선택된 스크린샷</Text>
              <Image source={{ uri: screenshotUri }} style={s.previewImage} resizeMode="contain" />
            </View>

            {/* 에러 */}
            {!!error && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            {/* 다시 선택 */}
            <TouchableOpacity style={s.secondaryBtn} onPress={pickScreenshot} activeOpacity={0.85}>
              <Ionicons name="refresh-outline" size={18} color={C.brand} />
              <Text style={s.secondaryBtnText}>다른 스크린샷 선택</Text>
            </TouchableOpacity>

            {/* 제출 */}
            <TouchableOpacity style={s.primaryBtn} onPress={handleSubmit} activeOpacity={0.85}>
              <Ionicons name="paper-plane-outline" size={20} color={C.white} />
              <Text style={s.primaryBtnText}>인증 신청하기</Text>
            </TouchableOpacity>

            <Text style={s.notice}>
              ※ 실제 영수증 리뷰 스크린샷이 아닌 경우 승인이 거절될 수 있어요.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.g50 },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.g200 },
  backBtn:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:{ fontSize: 17, fontWeight: '700', color: C.g900 },
  scroll:     { flex: 1 },
  scrollContent:{ padding: 20, gap: 16, paddingBottom: 40 },

  // 안내 카드
  guideCard:  { backgroundColor: C.brandBg, borderRadius: 20, borderWidth: 1, borderColor: C.brandBd, padding: 24, alignItems: 'center' },
  guideEmoji: { fontSize: 48, marginBottom: 12 },
  guideTitle: { fontSize: 20, fontWeight: '800', color: C.g900, textAlign: 'center', marginBottom: 8 },
  guideDesc:  { fontSize: 14, color: C.g600, textAlign: 'center', lineHeight: 22 },

  // 쿠폰 미리보기
  couponPreview:     { backgroundColor: C.white, borderRadius: 16, borderWidth: 1.5, borderColor: C.brandBd, borderStyle: 'dashed', padding: 16 },
  couponPreviewLabel:{ fontSize: 11, fontWeight: '600', color: C.brand, marginBottom: 4 },
  couponPreviewText: { fontSize: 15, fontWeight: '700', color: C.g900 },

  // 단계 카드
  stepsCard:  { backgroundColor: C.white, borderRadius: 20, padding: 20 },
  stepsTitle: { fontSize: 15, fontWeight: '700', color: C.g900, marginBottom: 16 },
  stepRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  stepNum:    { width: 24, height: 24, borderRadius: 12, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  stepNumText:{ fontSize: 12, fontWeight: '700', color: C.white },
  stepIcon:   { fontSize: 20 },
  stepText:   { fontSize: 14, color: C.g800, flex: 1 },

  // 버튼
  primaryBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.brand, borderRadius: 16, paddingVertical: 16 },
  primaryBtnText:   { fontSize: 16, fontWeight: '800', color: C.white },
  secondaryBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 16, borderWidth: 1.5, borderColor: C.brandBd, paddingVertical: 14 },
  secondaryBtnText: { fontSize: 15, fontWeight: '700', color: C.brand },

  // 스크린샷 미리보기
  previewCard:  { backgroundColor: C.white, borderRadius: 20, padding: 16 },
  previewLabel: { fontSize: 13, fontWeight: '600', color: C.g600, marginBottom: 12 },
  previewImage: { width: '100%', height: 400, borderRadius: 12 },

  // 에러
  errorBox:  { backgroundColor: '#FFF0F0', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FFD0D0' },
  errorText: { fontSize: 13, color: C.red, textAlign: 'center' },

  // 완료
  doneWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  doneIcon:  { width: 80, height: 80, borderRadius: 40, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  doneTitle: { fontSize: 24, fontWeight: '800', color: C.g900, marginBottom: 12 },
  doneDesc:  { fontSize: 15, color: C.g600, textAlign: 'center', lineHeight: 24, marginBottom: 20 },
  doneBtn:   { backgroundColor: C.brand, borderRadius: 16, paddingHorizontal: 40, paddingVertical: 16 },
  doneBtnText:{ fontSize: 16, fontWeight: '800', color: C.white },

  notice:    { fontSize: 12, color: C.g400, textAlign: 'center', lineHeight: 18 },
});
