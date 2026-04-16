import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TextInput, TouchableOpacity, Alert, KeyboardAvoidingView,
  Platform, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as Location from 'expo-location';
import { submitStoreApplication } from '../../lib/services/storeApplicationService';

const C = {
  brand: '#FF6F0F', brandBg: '#FFF3EB',
  g900: '#191F28', g700: '#4E5968', g500: '#8B95A1', g400: '#ADB5BD',
  g300: '#D1D6DB', g200: '#E5E8EB', g150: '#EAECEF', g100: '#F2F4F6',
  white: '#FFFFFF', red: '#E53935',
};

const CATEGORY_CHIPS = [
  { key: 'cafe',   emoji: '☕', label: '카페'  },
  { key: 'food',   emoji: '🍽', label: '음식'  },
  { key: 'beauty', emoji: '✂️', label: '미용'  },
  { key: 'nail',   emoji: '💅', label: '네일'  },
  { key: 'etc',    emoji: '',    label: '기타'  },
];

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

  const [storeName,        setStoreName]        = useState('');
  const [category,         setCategory]         = useState('cafe');
  const [address,          setAddress]          = useState('');
  const [postcode,         setPostcode]         = useState('');
  const [latitude,         setLatitude]         = useState<number | undefined>();
  const [longitude,        setLongitude]        = useState<number | undefined>();
  const [description,      setDescription]      = useState('');
  const [preferredCallTime, setPreferredCallTime] = useState('');
  const [loading,          setLoading]          = useState(false);
  const [submitted,        setSubmitted]        = useState(false);
  const [postcodeModal,    setPostcodeModal]    = useState(false);

  // ─── 포커스 상태 ─────────────────────────────────────────────
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // ─── 우편번호 WebView 메시지 처리 ─────────────────────────
  const handlePostcodeMessage = async (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'close') { setPostcodeModal(false); return; }
      if (msg.type === 'address') {
        setPostcodeModal(false);
        setPostcode(msg.postcode ?? '');
        setAddress(msg.address ?? '');
        try {
          const results = await Location.geocodeAsync(msg.address);
          if (results.length > 0) {
            setLatitude(results[0].latitude);
            setLongitude(results[0].longitude);
          }
        } catch { /* 지오코딩 실패 무시 */ }
      }
    } catch { /* JSON 파싱 오류 무시 */ }
  };

  // ─── 유효성 검사 ──────────────────────────────────────────
  const isValid = storeName.trim() && address.trim() && category;

  // ─── 신청 제출 ────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!isValid) {
      Alert.alert('필수 항목을 입력해주세요', '가게 이름, 카테고리, 주소는 필수입니다.');
      return;
    }
    setLoading(true);
    try {
      await submitStoreApplication({
        store_name:   storeName.trim(),
        category,
        description:  description.trim() || undefined,
        address:      address.trim(),
        phone:        '',
        latitude,
        longitude,
        owner_name:   '',
        owner_phone:  '',
        message:      preferredCallTime.trim() || undefined,
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
          <Text style={{ fontSize: 64 }}>🎉</Text>
          <Text style={styles.successTitle}>가게 등록 신청 완료!</Text>
          <Text style={styles.successCallTitle}>해피콜 전화 드립니다 📞</Text>
          <Text style={styles.successDesc}>
            {'담당자가 확인 후 연락드릴게요.\n보통 1~2일 내 처리됩니다.'}
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.doneBtnText}>확인</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ fontSize: 22 }}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>사장님 가입</Text>
          <Text style={styles.headerStep}>2 / 2</Text>
        </View>
        {/* 진행바 */}
        <View style={styles.progressBar} />

        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* 제목 */}
          <Text style={styles.pageTitle}>{'가게 정보를\n입력해주세요'}</Text>
          <Text style={styles.pageSubtitle}>나중에 수정할 수 있어요</Text>

          {/* ① 가게 이름 */}
          <Text style={styles.fieldLabel}>가게 이름 *</Text>
          <TextInput
            style={[styles.input, focusedField === 'storeName' && styles.inputFocused]}
            value={storeName}
            onChangeText={setStoreName}
            placeholder="예) 역삼동 맛집"
            placeholderTextColor={C.g400}
            autoFocus
            onFocus={() => setFocusedField('storeName')}
            onBlur={() => setFocusedField(null)}
          />

          {/* ② 카테고리 */}
          <Text style={[styles.fieldLabel, { marginTop: 20 }]}>카테고리 *</Text>
          <View style={styles.chipWrap}>
            {CATEGORY_CHIPS.map(chip => {
              const selected = category === chip.key;
              return (
                <TouchableOpacity
                  key={chip.key}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setCategory(chip.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {chip.emoji ? `${chip.emoji} ${chip.label}` : chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ③ 가게 주소 */}
          <Text style={[styles.fieldLabel, { marginTop: 20 }]}>가게 주소 *</Text>
          <View style={styles.addressRow}>
            <Text style={[styles.addressText, !address && { color: C.g400 }]}>
              {address || '주소를 입력해주세요'}
            </Text>
            <TouchableOpacity
              style={styles.addressChangeBtn}
              onPress={() => setPostcodeModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.addressChangeBtnText}>변경</Text>
            </TouchableOpacity>
          </View>

          {/* ④ 한 줄 소개 */}
          <Text style={[styles.fieldLabel, { marginTop: 20 }]}>한 줄 소개 (선택)</Text>
          <TextInput
            style={[styles.input, styles.inputMulti, focusedField === 'description' && styles.inputFocused]}
            value={description}
            onChangeText={setDescription}
            placeholder="역삼동 감성 카페, 매일 신선한 원두"
            placeholderTextColor={C.g400}
            multiline
            onFocus={() => setFocusedField('description')}
            onBlur={() => setFocusedField(null)}
          />

          {/* ⑤ 전화통화 편한 시간대 */}
          <Text style={[styles.fieldLabel, { marginTop: 20 }]}>전화통화 편한 시간대</Text>
          <TextInput
            style={[styles.input, focusedField === 'callTime' && styles.inputFocused]}
            value={preferredCallTime}
            onChangeText={setPreferredCallTime}
            placeholder="예) 오후 2시~5시 사이"
            placeholderTextColor={C.g400}
            onFocus={() => setFocusedField('callTime')}
            onBlur={() => setFocusedField(null)}
          />

          {/* 제출 버튼 */}
          <TouchableOpacity
            style={[styles.submitBtn, (loading || !isValid) && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading || !isValid}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={C.white} />
              : <Text style={styles.submitBtnText}>가게 등록 완료 ✓</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 우편번호 검색 모달 */}
      <Modal
        visible={postcodeModal}
        animationType="slide"
        onRequestClose={() => setPostcodeModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: C.white }}>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.white },

  // 헤더
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.g900 },
  headerStep:  { fontSize: 13, color: C.g500 },
  progressBar: { height: 3, backgroundColor: C.brand, width: '100%' },

  // 폼
  container: {
    paddingHorizontal: 20, paddingTop: 28, paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 26, fontWeight: '900', color: C.g900,
    letterSpacing: -0.5, lineHeight: 34,
  },
  pageSubtitle: { fontSize: 14, color: C.g500, marginTop: 6, marginBottom: 28 },

  // 필드
  fieldLabel: { fontSize: 13, fontWeight: '700', color: C.g900, marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: C.g200, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: C.g900,
  },
  inputFocused: { borderColor: C.brand },
  inputMulti:   { minHeight: 52, textAlignVertical: 'top' },

  // 카테고리 칩
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: C.g100,
  },
  chipSelected:     { backgroundColor: C.brand },
  chipText:         { fontSize: 14, fontWeight: '600', color: C.g700 },
  chipTextSelected: { color: C.white },

  // 주소
  addressRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: C.g200, borderRadius: 12,
  },
  addressText: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: C.g900,
  },
  addressChangeBtn: {
    paddingHorizontal: 12, paddingVertical: 13,
    borderLeftWidth: 1, borderLeftColor: C.g200,
  },
  addressChangeBtnText: { fontSize: 14, fontWeight: '600', color: C.brand },

  // 제출 버튼
  submitBtn: {
    marginTop: 32, backgroundColor: C.brand, borderRadius: 14,
    paddingVertical: 17, alignItems: 'center',
  },
  submitBtnText: { fontSize: 17, fontWeight: '800', color: C.white },

  // 완료 화면
  successContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12,
  },
  successTitle:    { fontSize: 24, fontWeight: '900', color: C.g900 },
  successCallTitle: { fontSize: 18, fontWeight: '700', color: C.brand, marginTop: 8 },
  successDesc:     {
    fontSize: 14, color: C.g500, textAlign: 'center', lineHeight: 22, marginTop: 8,
  },
  doneBtn:     {
    marginTop: 16, backgroundColor: C.brand, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 48, alignItems: 'center',
  },
  doneBtnText: { color: C.white, fontSize: 16, fontWeight: '800' },

  // 모달
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderColor: C.g200, backgroundColor: C.white,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: C.g900 },
  modalClose: { fontSize: 20, color: C.g500, padding: 4 },
});
