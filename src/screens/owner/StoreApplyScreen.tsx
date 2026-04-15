import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TextInput, TouchableOpacity, Alert, KeyboardAvoidingView,
  Platform, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as Location from 'expo-location';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';
import { submitStoreApplication } from '../../lib/services/storeApplicationService';

const CATEGORIES = ['한식', '중식', '일식', '양식', '카페', '분식', '치킨', '피자', '기타'];

// ─── 다음 우편번호 서비스 HTML ────────────────────────────────
const POSTCODE_HTML = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#f5f5f5; }
  #wrap { width:100%; height:100vh; overflow:hidden; }
  #close-btn {
    position:fixed; top:12px; right:12px; z-index:9999;
    background:#5B67CA; color:#fff; border:none;
    padding:8px 16px; border-radius:8px;
    font-size:14px; cursor:pointer;
  }
</style>
</head>
<body>
<button id="close-btn" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type:'close'}))">✕ 닫기</button>
<div id="wrap"></div>
<script src="https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"></script>
<script>
new daum.Postcode({
  oncomplete: function(data) {
    var fullAddr = data.roadAddress || data.jibunAddress;
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'address',
      postcode: data.zonecode,
      address: fullAddr,
    }));
  },
  width:'100%',
  height:'100%',
}).embed(document.getElementById('wrap'));
</script>
</body>
</html>
`;

export default function StoreApplyScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // 가게 정보
  const [storeName, setStoreName]         = useState('');
  const [category, setCategory]           = useState('한식');
  const [description, setDescription]     = useState('');
  const [postcode, setPostcode]           = useState('');
  const [address, setAddress]             = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [phone, setPhone]                 = useState('');
  const [instagramUrl, setInstagramUrl]   = useState('');
  const [naverPlaceUrl, setNaverPlaceUrl] = useState('');

  // 좌표 (우편번호 → 자동 지오코딩)
  const [latitude, setLatitude]   = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();

  // 신청자 정보
  const [ownerName, setOwnerName]   = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [message, setMessage]       = useState('');

  // 우편번호 모달
  const [postcodeModal, setPostcodeModal] = useState(false);
  const [geocoding, setGeocoding]         = useState(false);

  // ─── 우편번호 WebView 메시지 처리 ─────────────────────────
  const handlePostcodeMessage = async (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'close') {
        setPostcodeModal(false);
        return;
      }
      if (msg.type === 'address') {
        setPostcodeModal(false);
        setPostcode(msg.postcode ?? '');
        setAddress(msg.address ?? '');
        setAddressDetail('');
        // 지오코딩
        setGeocoding(true);
        try {
          const results = await Location.geocodeAsync(msg.address);
          if (results.length > 0) {
            setLatitude(results[0].latitude);
            setLongitude(results[0].longitude);
          }
        } catch {
          // 지오코딩 실패는 무시 (직접 주소만 저장)
        } finally {
          setGeocoding(false);
        }
      }
    } catch { /* JSON 파싱 오류 무시 */ }
  };

  // ─── 유효성 검사 ──────────────────────────────────────────
  const validate = () => {
    if (!storeName.trim())      { Alert.alert('가게 이름을 입력해주세요'); return false; }
    if (!address.trim())        { Alert.alert('주소를 검색해주세요'); return false; }
    if (!phone.trim())          { Alert.alert('가게 전화번호를 입력해주세요'); return false; }
    if (!ownerName.trim())      { Alert.alert('대표자 이름을 입력해주세요'); return false; }
    if (!ownerPhone.trim())     { Alert.alert('대표자 연락처를 입력해주세요'); return false; }
    return true;
  };

  // ─── 신청 제출 ────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await submitStoreApplication({
        store_name:      storeName.trim(),
        category,
        description:     description.trim() || undefined,
        address:         address.trim(),
        phone:           phone.trim(),
        latitude,
        longitude,
        owner_name:      ownerName.trim(),
        owner_phone:     ownerPhone.trim(),
        owner_email:     ownerEmail.trim() || undefined,
        message:         message.trim() || undefined,
        instagram_url:   instagramUrl.trim() || undefined,
        naver_place_url: naverPlaceUrl.trim(),
        postcode:        postcode || undefined,
        address_detail:  addressDetail.trim() || undefined,
      });
      setSubmitted(true);
    } catch {
      Alert.alert('신청 실패', '잠시 후 다시 시도해주세요');
    } finally {
      setLoading(false);
    }
  };

  // ─── 완료 화면 ────────────────────────────────────────────
  if (submitted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successContainer}>
          <Text style={styles.successEmoji}>🎉</Text>
          <Text style={styles.successTitle}>신청이 완료됐어요!</Text>
          <Text style={styles.successDesc}>
            최고관리자 검토 후{'\n'}승인 결과를 안내해 드릴게요.{'\n'}보통 1~3일 내 처리됩니다.
          </Text>
          <View style={styles.successCard}>
            <Row label="가게명" value={storeName} />
            <Row label="주소" value={postcode ? `[${postcode}] ${address}` : address} />
            <Row label="대표자" value={ownerName} />
            <Row label="연락처" value={ownerPhone} />
          </View>
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.doneBtnText}>확인</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← 뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>사장님 가입신청</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.banner}>
            <Text style={styles.bannerEmoji}>🍖</Text>
            <View>
              <Text style={styles.bannerTitle}>가게 등록 신청</Text>
              <Text style={styles.bannerSub}>최고관리자 승인 후 앱에 등록됩니다</Text>
            </View>
          </View>

          {/* ── 가게 정보 ─────────────────────────────── */}
          <SectionCard title="📍 가게 정보">

            <Field label="가게 이름 *" hint="네이버 업체정보 상호와 동일하게 입력해주세요">
              <TextInput
                style={styles.input}
                value={storeName}
                onChangeText={setStoreName}
                placeholder="예) 우리동네 맛집"
                placeholderTextColor={COLORS.textMuted}
              />
            </Field>

            <Field label="업종 카테고리 *">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.categoryRow}>
                  {CATEGORIES.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.categoryBtn, category === c && styles.categoryBtnActive]}
                      onPress={() => setCategory(c)}
                    >
                      <Text style={[styles.categoryText, category === c && styles.categoryTextActive]}>
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </Field>

            <Field label="가게 소개">
              <TextInput
                style={[styles.input, styles.inputMulti]}
                value={description}
                onChangeText={setDescription}
                placeholder="가게를 간단히 소개해주세요"
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
              />
            </Field>

            {/* 주소 – 우편번호 검색 */}
            <Field label="주소 *">
              <TouchableOpacity
                style={[styles.input, styles.addressSearchBtn]}
                onPress={() => setPostcodeModal(true)}
                activeOpacity={0.7}
              >
                {postcode ? (
                  <View style={{ gap: 2 }}>
                    <Text style={styles.postcodeText}>[{postcode}]</Text>
                    <Text style={styles.addressText}>{address}</Text>
                  </View>
                ) : (
                  <Text style={styles.addressPlaceholder}>🔍 우편번호 검색</Text>
                )}
                {geocoding && (
                  <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 8 }} />
                )}
              </TouchableOpacity>
              {address ? (
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={addressDetail}
                  onChangeText={setAddressDetail}
                  placeholder="상세주소 (동, 호수 등)"
                  placeholderTextColor={COLORS.textMuted}
                />
              ) : null}
              {latitude !== undefined && (
                <Text style={styles.geoTag}>
                  📍 위치 등록됨 ({latitude.toFixed(5)}, {longitude?.toFixed(5)})
                </Text>
              )}
            </Field>

            <Field label="가게 전화번호 *">
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="예) 02-1234-5678"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
              />
            </Field>

            {/* 네이버 업체정보 (필수) */}
            <Field label="네이버 업체정보 링크 (선택)" hint="네이버 지도에서 업체 페이지 링크를 복사해주세요">
              <TextInput
                style={styles.input}
                value={naverPlaceUrl}
                onChangeText={setNaverPlaceUrl}
                placeholder="https://naver.me/..."
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                keyboardType="url"
              />
            </Field>

            {/* 인스타그램 (선택) */}
            <Field label="인스타그램 링크 (선택)">
              <TextInput
                style={styles.input}
                value={instagramUrl}
                onChangeText={setInstagramUrl}
                placeholder="https://instagram.com/..."
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                keyboardType="url"
              />
            </Field>

          </SectionCard>

          {/* ── 대표자 정보 ───────────────────────────── */}
          <SectionCard title="👤 대표자 정보">
            <Field label="대표자 이름 *">
              <TextInput
                style={styles.input}
                value={ownerName}
                onChangeText={setOwnerName}
                placeholder="예) 홍길동"
                placeholderTextColor={COLORS.textMuted}
              />
            </Field>

            <Field label="대표자 연락처 *">
              <TextInput
                style={styles.input}
                value={ownerPhone}
                onChangeText={setOwnerPhone}
                placeholder="예) 010-1234-5678"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
              />
            </Field>

            <Field label="이메일 (선택)">
              <TextInput
                style={styles.input}
                value={ownerEmail}
                onChangeText={setOwnerEmail}
                placeholder="예) owner@email.com"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </Field>

            <Field label="하고 싶은 말 (선택)">
              <TextInput
                style={[styles.input, styles.inputMulti]}
                value={message}
                onChangeText={setMessage}
                placeholder="관리자에게 전하고 싶은 말을 자유롭게 작성해주세요"
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
              />
            </Field>
          </SectionCard>

          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              📌 신청 후 최고관리자 검토를 거쳐 1~3일 내 처리됩니다.{'\n'}
              승인 시 앱 지도에 가게가 등록됩니다.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.submitBtnText}>
              {loading ? '신청 중...' : '🍖 가입 신청하기'}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── 우편번호 검색 모달 ─────────────────────────── */}
      <Modal
        visible={postcodeModal}
        animationType="slide"
        onRequestClose={() => setPostcodeModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>우편번호 검색</Text>
            <TouchableOpacity onPress={() => setPostcodeModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <WebView
            source={{ html: POSTCODE_HTML, baseUrl: 'https://postcode.map.daum.net' }}
            onMessage={handlePostcodeMessage}
            javaScriptEnabled
            originWhitelist={['*']}
            mixedContentMode="always"
            domStorageEnabled
            style={{ flex: 1 }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── 서브 컴포넌트 ────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={[sectionStyles.card, SHADOW.card]}>
      <Text style={sectionStyles.title}>{title}</Text>
      {children}
    </View>
  );
}

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      {hint ? <Text style={fieldStyles.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  );
}

// ─── StyleSheets ─────────────────────────────────────────────

const sectionStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 20,
    gap: 16,
  },
  title: { fontSize: 15, fontWeight: '800', color: COLORS.text },
});

const fieldStyles = StyleSheet.create({
  wrap:  { gap: 4 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  hint:  { fontSize: 11, color: COLORS.textMuted, lineHeight: 16 },
});

const rowStyles = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  label: { fontSize: 13, color: COLORS.textMuted },
  value: { fontSize: 13, fontWeight: '600', color: COLORS.text, flex: 1, textAlign: 'right' },
});

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.background },
  header:      {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, paddingBottom: 8,
  },
  backText:    { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  container:   { padding: 20, gap: 16 },
  banner:      {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.lg, padding: 16,
  },
  bannerEmoji: { fontSize: 36 },
  bannerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  bannerSub:   { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  input: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: 12, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.background,
  },
  inputMulti:       { minHeight: 80, textAlignVertical: 'top' },
  addressSearchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 48,
  },
  postcodeText:     { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  addressText:      { fontSize: 15, color: COLORS.text },
  addressPlaceholder: { fontSize: 15, color: COLORS.textMuted },
  geoTag:           { fontSize: 11, color: '#2DB87A', marginTop: 4 },

  categoryRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  categoryBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md,
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
  },
  categoryBtnActive:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryText:        { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  categoryTextActive:  { color: COLORS.white },

  notice: {
    backgroundColor: COLORS.secondary, borderRadius: RADIUS.md, padding: 14,
  },
  noticeText: { fontSize: 12, color: COLORS.textMuted, lineHeight: 20 },

  submitBtn:         {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, padding: 18, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText:     { color: COLORS.white, fontSize: 17, fontWeight: '800' },

  // 완료 화면
  successContainer: {
    flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  successEmoji: { fontSize: 64 },
  successTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  successDesc:  { fontSize: 15, color: COLORS.textMuted, textAlign: 'center', lineHeight: 24 },
  successCard:  {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    padding: 20, width: '100%', gap: 4, ...SHADOW.card,
  },
  doneBtn:     {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    padding: 16, alignItems: 'center', width: '100%',
  },
  doneBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },

  // 모달
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  modalClose: { fontSize: 20, color: COLORS.textMuted, padding: 4 },
});
