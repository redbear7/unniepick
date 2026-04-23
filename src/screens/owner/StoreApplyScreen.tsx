/**
 * StoreApplyScreen — 사장님 가게 등록 (2단계)
 * Step 1: 가게 기본 정보
 * Step 2: 쿠폰 미리 등록 (선택)
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, KeyboardAvoidingView,
  Platform, Modal, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as Location from 'expo-location';
import { submitStoreApplication } from '../../lib/services/storeApplicationService';

// ── 테마 ──────────────────────────────────────────────────────────
const C = {
  brand:    '#FF6F0F',
  brand2:   '#FF9A3D',
  brandBg:  '#FFF3EB',
  g900:     '#191F28',
  g800:     '#333D4B',
  g700:     '#4E5968',
  g600:     '#6B7684',
  g500:     '#8B95A1',
  g400:     '#ADB5BD',
  g300:     '#D1D6DB',
  g200:     '#E5E8EB',
  g150:     '#EAECEF',
  g100:     '#F2F4F6',
  g50:      '#F9FAFB',
  white:    '#FFFFFF',
  red:      '#E53935',
  purple:   '#7B61FF',
  teal:     '#2D9CDB',
  green:    '#0AC86E',
};

// ── 카테고리 ──────────────────────────────────────────────────────
const CATEGORY_CHIPS = [
  { key: 'cafe',   emoji: '☕', label: '카페'  },
  { key: 'food',   emoji: '🍽', label: '음식'  },
  { key: 'beauty', emoji: '✂️', label: '미용'  },
  { key: 'nail',   emoji: '💅', label: '네일'  },
  { key: 'etc',    emoji: '🏪', label: '기타'  },
];

// ── 쿠폰 종류 ─────────────────────────────────────────────────────
const COUPON_KINDS = [
  { key: 'regular',    emoji: '🎟', label: '정기 할인',  color: C.brand  },
  { key: 'timesale',   emoji: '⚡', label: '타임세일',   color: '#E53935' },
  { key: 'service',    emoji: '🎁', label: '서비스 제공', color: C.green  },
  { key: 'experience', emoji: '✨', label: '무료 체험',  color: C.purple  },
];

// ── 다음 우편번호 HTML ─────────────────────────────────────────────
const POSTCODE_HTML = `
<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#f5f5f5}
#wrap{width:100%;height:100vh;overflow:hidden}
#close-btn{position:fixed;top:12px;right:12px;z-index:9999;background:#FF6F0F;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:14px;cursor:pointer}
</style></head><body>
<button id="close-btn" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type:'close'}))">✕ 닫기</button>
<div id="wrap"></div>
<script src="https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"></script>
<script>
new daum.Postcode({
  oncomplete:function(data){
    var fullAddr=data.roadAddress||data.jibunAddress;
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'address',postcode:data.zonecode,address:fullAddr}));
  },width:'100%',height:'100%'
}).embed(document.getElementById('wrap'));
</script></body></html>`;

// ── 쿠폰 타입 ─────────────────────────────────────────────────────
interface DraftCoupon {
  id:           string;
  title:        string;
  kind:         string;
  description:  string;
  expiryDays:   string; // 몇 일 후 만료
}

// ── 쿠폰 카드 컴포넌트 ───────────────────────────────────────────
function CouponDraftCard({
  coupon,
  onDelete,
}: {
  coupon: DraftCoupon;
  onDelete: () => void;
}) {
  const kindCfg = COUPON_KINDS.find(k => k.key === coupon.kind) ?? COUPON_KINDS[0];
  return (
    <View style={[cc.wrap, { borderLeftColor: kindCfg.color }]}>
      <View style={cc.row}>
        <Text style={cc.emoji}>{kindCfg.emoji}</Text>
        <View style={cc.body}>
          <Text style={cc.title} numberOfLines={1}>{coupon.title}</Text>
          <Text style={cc.meta}>
            {kindCfg.label} · {coupon.expiryDays ? `${coupon.expiryDays}일 후 만료` : '만료일 미설정'}
          </Text>
          {!!coupon.description && (
            <Text style={cc.desc} numberOfLines={1}>{coupon.description}</Text>
          )}
        </View>
        <TouchableOpacity style={cc.deleteBtn} onPress={onDelete}>
          <Text style={cc.deleteText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const cc = StyleSheet.create({
  wrap: {
    backgroundColor: C.white,
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  row:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  emoji:  { fontSize: 22, marginTop: 2 },
  body:   { flex: 1, gap: 3 },
  title:  { fontSize: 15, fontFamily: 'WantedSans-Bold', fontWeight: '700', color: C.g900 },
  meta:   { fontSize: 12, color: C.g500, fontFamily: 'WantedSans-Medium', fontWeight: '500' },
  desc:   { fontSize: 12, color: C.g600 },
  deleteBtn: { padding: 4 },
  deleteText: { fontSize: 16, color: C.g400 },
});

// ──────────────────────────────────────────────────────────────────
//  메인 화면
// ──────────────────────────────────────────────────────────────────
export default function StoreApplyScreen() {
  const navigation = useNavigation<any>();

  // ── Step ────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1);

  // ── Step 1: 가게 정보 ────────────────────────────────────────────
  const [storeName,         setStoreName]         = useState('');
  const [category,          setCategory]          = useState('cafe');
  const [address,           setAddress]           = useState('');
  const [postcode,          setPostcode]           = useState('');
  const [latitude,          setLatitude]           = useState<number | undefined>();
  const [longitude,         setLongitude]          = useState<number | undefined>();
  const [description,       setDescription]       = useState('');
  const [preferredCallTime, setPreferredCallTime] = useState('');
  const [focusedField,      setFocusedField]      = useState<string | null>(null);
  const [postcodeModal,     setPostcodeModal]     = useState(false);

  // ── Step 2: 쿠폰 등록 ────────────────────────────────────────────
  const [draftCoupons,  setDraftCoupons]  = useState<DraftCoupon[]>([]);
  const [couponModal,   setCouponModal]   = useState(false);
  // 쿠폰 추가 폼 상태
  const [newCouponTitle,   setNewCouponTitle]   = useState('');
  const [newCouponKind,    setNewCouponKind]    = useState('regular');
  const [newCouponDesc,    setNewCouponDesc]    = useState('');
  const [newCouponExpiry,  setNewCouponExpiry]  = useState('30');
  const [newCouponFocused, setNewCouponFocused] = useState<string | null>(null);

  // ── 제출 ────────────────────────────────────────────────────────
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // ── 우편번호 처리 ────────────────────────────────────────────────
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
    } catch { /* 무시 */ }
  };

  // ── 쿠폰 추가 ────────────────────────────────────────────────────
  const addCoupon = () => {
    if (!newCouponTitle.trim()) {
      Alert.alert('쿠폰 제목을 입력해주세요');
      return;
    }
    const coupon: DraftCoupon = {
      id:          Date.now().toString(),
      title:       newCouponTitle.trim(),
      kind:        newCouponKind,
      description: newCouponDesc.trim(),
      expiryDays:  newCouponExpiry.trim(),
    };
    setDraftCoupons(prev => [...prev, coupon]);
    // 폼 초기화
    setNewCouponTitle('');
    setNewCouponKind('regular');
    setNewCouponDesc('');
    setNewCouponExpiry('30');
    setCouponModal(false);
  };

  // ── Step 1 → Step 2 ──────────────────────────────────────────────
  const step1Valid = storeName.trim() && address.trim() && category;
  const goToStep2 = () => {
    if (!step1Valid) {
      Alert.alert('필수 항목을 입력해주세요', '가게 이름, 카테고리, 주소는 필수입니다.');
      return;
    }
    setStep(2);
  };

  // ── 최종 제출 ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const couponSummary = draftCoupons.length > 0
        ? '\n\n[사전 등록 쿠폰]\n' + draftCoupons.map((c, i) => {
            const k = COUPON_KINDS.find(k => k.key === c.kind);
            return `${i + 1}. ${c.title} (${k?.label}) - ${c.expiryDays}일 후 만료${c.description ? ` / ${c.description}` : ''}`;
          }).join('\n')
        : '';

      await submitStoreApplication({
        store_name:  storeName.trim(),
        category,
        description: description.trim() || undefined,
        address:     address.trim(),
        phone:       '',
        latitude,
        longitude,
        owner_name:  '',
        owner_phone: '',
        message:     (preferredCallTime.trim() || '') + couponSummary,
      });
      setSubmitted(true);
    } catch {
      Alert.alert('신청 실패', '잠시 후 다시 시도해주세요');
    } finally {
      setLoading(false);
    }
  };

  // ── 완료 화면 ────────────────────────────────────────────────────
  if (submitted) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.successWrap}>
          <Text style={{ fontSize: 72, marginBottom: 8 }}>🎉</Text>
          <Text style={s.successTitle}>가게 등록 신청 완료!</Text>
          <View style={s.successCallBox}>
            <Text style={s.successCallEmoji}>📞</Text>
            <Text style={s.successCallText}>해피콜 전화 드립니다</Text>
          </View>
          <Text style={s.successDesc}>
            {'담당자가 확인 후 연락드릴게요.\n보통 1~2일 내 처리됩니다.'}
          </Text>
          {draftCoupons.length > 0 && (
            <View style={s.successCouponBox}>
              <Text style={s.successCouponText}>
                🎟 쿠폰 {draftCoupons.length}개가 함께 등록됩니다
              </Text>
            </View>
          )}
          <TouchableOpacity style={s.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={s.doneBtnText}>확인</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── 헤더 ─────────────────────────────────────────────────────────
  const Header = () => (
    <>
      <View style={s.header}>
        <TouchableOpacity onPress={() => step === 2 ? setStep(1) : navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>사장님 가입</Text>
        <Text style={s.headerStep}>{step} / 2</Text>
      </View>
      {/* 진행바 */}
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: step === 1 ? '50%' : '100%' }]} />
      </View>
    </>
  );

  // ════════════════════════════════════════════════════════════════
  //  STEP 1: 가게 정보
  // ════════════════════════════════════════════════════════════════
  if (step === 1) {
    return (
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Header />
          <ScrollView
            contentContainerStyle={s.formContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={s.pageTitle}>{'가게 정보를\n입력해주세요'}</Text>
            <Text style={s.pageSubtitle}>나중에 수정할 수 있어요</Text>

            {/* 가게 이름 */}
            <Text style={s.fieldLabel}>가게 이름 *</Text>
            <TextInput
              style={[s.input, focusedField === 'name' && s.inputFocused]}
              value={storeName}
              onChangeText={setStoreName}
              placeholder="예) 카페봄날, 미용실언니"
              placeholderTextColor={C.g400}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
            />

            {/* 카테고리 */}
            <Text style={[s.fieldLabel, { marginTop: 22 }]}>카테고리 *</Text>
            <View style={s.chipWrap}>
              {CATEGORY_CHIPS.map(chip => {
                const on = category === chip.key;
                return (
                  <TouchableOpacity
                    key={chip.key}
                    style={[s.chip, on && s.chipOn]}
                    onPress={() => setCategory(chip.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.chipText, on && s.chipTextOn]}>
                      {chip.emoji} {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 주소 */}
            <Text style={[s.fieldLabel, { marginTop: 22 }]}>가게 주소 *</Text>
            <View style={[s.addressRow, !!address && s.addressRowFilled]}>
              <Text style={[s.addressText, !address && { color: C.g400 }]} numberOfLines={1}>
                {address || '주소를 검색해주세요'}
              </Text>
              <TouchableOpacity style={s.addressBtn} onPress={() => setPostcodeModal(true)}>
                <Text style={s.addressBtnText}>🔍 검색</Text>
              </TouchableOpacity>
            </View>

            {/* 한 줄 소개 */}
            <Text style={[s.fieldLabel, { marginTop: 22 }]}>한 줄 소개 (선택)</Text>
            <TextInput
              style={[s.input, s.inputMulti, focusedField === 'desc' && s.inputFocused]}
              value={description}
              onChangeText={setDescription}
              placeholder="가게의 매력을 한 줄로 알려주세요"
              placeholderTextColor={C.g400}
              multiline
              onFocus={() => setFocusedField('desc')}
              onBlur={() => setFocusedField(null)}
            />

            {/* 전화 편한 시간 */}
            <Text style={[s.fieldLabel, { marginTop: 22 }]}>전화통화 편한 시간대</Text>
            <TextInput
              style={[s.input, focusedField === 'callTime' && s.inputFocused]}
              value={preferredCallTime}
              onChangeText={setPreferredCallTime}
              placeholder="예) 오후 2시~5시"
              placeholderTextColor={C.g400}
              onFocus={() => setFocusedField('callTime')}
              onBlur={() => setFocusedField(null)}
            />

            {/* 다음 버튼 */}
            <TouchableOpacity
              style={[s.nextBtn, !step1Valid && { opacity: 0.5 }]}
              onPress={goToStep2}
              disabled={!step1Valid}
              activeOpacity={0.85}
            >
              <Text style={s.nextBtnText}>다음 — 쿠폰 등록 →</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.skipBtn} onPress={handleSubmit} disabled={!step1Valid || loading}>
              <Text style={s.skipBtnText}>쿠폰 없이 바로 신청</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* 우편번호 모달 */}
        <Modal visible={postcodeModal} animationType="slide" onRequestClose={() => setPostcodeModal(false)}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>주소 검색</Text>
              <TouchableOpacity onPress={() => setPostcodeModal(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <WebView
              source={{ html: POSTCODE_HTML, baseUrl: 'https://postcode.map.daum.net' }}
              onMessage={handlePostcodeMessage}
              javaScriptEnabled originWhitelist={['*']}
              mixedContentMode="always" domStorageEnabled
              style={{ flex: 1 }}
            />
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════
  //  STEP 2: 쿠폰 등록
  // ════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={s.safe}>
      <Header />
      <ScrollView
        contentContainerStyle={s.formContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* 제목 */}
        <Text style={s.pageTitle}>{'오픈 쿠폰을\n미리 등록해보세요'}</Text>
        <Text style={s.pageSubtitle}>등록된 쿠폰은 가게 승인 후 즉시 공개돼요 🚀</Text>

        {/* 가게 정보 요약 */}
        <View style={s.storeSummary}>
          <Text style={s.storeSummaryEmoji}>
            {CATEGORY_CHIPS.find(c => c.key === category)?.emoji ?? '🏪'}
          </Text>
          <View>
            <Text style={s.storeSummaryName}>{storeName}</Text>
            <Text style={s.storeSummaryAddr} numberOfLines={1}>{address}</Text>
          </View>
        </View>

        {/* 등록된 쿠폰 목록 */}
        {draftCoupons.length > 0 && (
          <View style={s.couponList}>
            {draftCoupons.map((c, idx) => (
              <CouponDraftCard
                key={c.id}
                coupon={c}
                onDelete={() => setDraftCoupons(prev => prev.filter(p => p.id !== c.id))}
              />
            ))}
          </View>
        )}

        {/* 쿠폰 추가 버튼 */}
        <TouchableOpacity style={s.addCouponBtn} onPress={() => setCouponModal(true)} activeOpacity={0.8}>
          <Text style={s.addCouponBtnText}>+ 쿠폰 추가하기</Text>
        </TouchableOpacity>

        {draftCoupons.length === 0 && (
          <View style={s.couponEmptyHint}>
            <Text style={s.couponEmptyText}>
              쿠폰을 등록하면 팔로워들에게 즉시 알림이 가요 🔔
            </Text>
          </View>
        )}

        {/* 제출 버튼 */}
        <TouchableOpacity
          style={[s.nextBtn, { marginTop: 32 }, loading && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={C.white} />
            : <Text style={s.nextBtnText}>
                {draftCoupons.length > 0
                  ? `쿠폰 ${draftCoupons.length}개와 함께 등록 신청 ✓`
                  : '가게 등록 신청 ✓'}
              </Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={s.skipBtn} onPress={() => setStep(1)}>
          <Text style={s.skipBtnText}>← 가게 정보 수정</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── 쿠폰 추가 모달 ── */}
      <Modal visible={couponModal} animationType="slide" transparent onRequestClose={() => setCouponModal(false)}>
        <View style={s.modalDim}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={s.couponModalSheet}>
              {/* 모달 헤더 */}
              <View style={s.couponModalHeader}>
                <Text style={s.couponModalTitle}>쿠폰 추가</Text>
                <TouchableOpacity onPress={() => setCouponModal(false)}>
                  <Text style={s.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerStyle={s.couponModalBody}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* 쿠폰 제목 */}
                <Text style={s.fieldLabel}>쿠폰 제목 *</Text>
                <TextInput
                  style={[s.input, newCouponFocused === 'title' && s.inputFocused]}
                  value={newCouponTitle}
                  onChangeText={setNewCouponTitle}
                  placeholder="예) 아메리카노 1+1, 첫 방문 20% 할인"
                  placeholderTextColor={C.g400}
                  autoFocus
                  onFocus={() => setNewCouponFocused('title')}
                  onBlur={() => setNewCouponFocused(null)}
                />

                {/* 쿠폰 종류 */}
                <Text style={[s.fieldLabel, { marginTop: 18 }]}>쿠폰 종류</Text>
                <View style={s.kindWrap}>
                  {COUPON_KINDS.map(k => {
                    const on = newCouponKind === k.key;
                    return (
                      <TouchableOpacity
                        key={k.key}
                        style={[s.kindChip, on && { backgroundColor: k.color, borderColor: k.color }]}
                        onPress={() => setNewCouponKind(k.key)}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.kindChipText, on && { color: C.white }]}>
                          {k.emoji} {k.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* 쿠폰 설명 */}
                <Text style={[s.fieldLabel, { marginTop: 18 }]}>쿠폰 설명 (선택)</Text>
                <TextInput
                  style={[s.input, newCouponFocused === 'desc' && s.inputFocused]}
                  value={newCouponDesc}
                  onChangeText={setNewCouponDesc}
                  placeholder="예) 음료 2잔 이상 주문 시"
                  placeholderTextColor={C.g400}
                  onFocus={() => setNewCouponFocused('desc')}
                  onBlur={() => setNewCouponFocused(null)}
                />

                {/* 유효 기간 */}
                <Text style={[s.fieldLabel, { marginTop: 18 }]}>유효 기간</Text>
                <View style={s.expiryRow}>
                  {['7', '14', '30', '60', '90'].map(d => (
                    <TouchableOpacity
                      key={d}
                      style={[s.expiryChip, newCouponExpiry === d && s.expiryChipOn]}
                      onPress={() => setNewCouponExpiry(d)}
                    >
                      <Text style={[s.expiryChipText, newCouponExpiry === d && s.expiryChipTextOn]}>
                        {d}일
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TextInput
                    style={[s.expiryInput, newCouponFocused === 'expiry' && s.inputFocused]}
                    value={newCouponExpiry}
                    onChangeText={setNewCouponExpiry}
                    placeholder="직접"
                    placeholderTextColor={C.g400}
                    keyboardType="number-pad"
                    onFocus={() => setNewCouponFocused('expiry')}
                    onBlur={() => setNewCouponFocused(null)}
                  />
                </View>

                {/* 추가 버튼 */}
                <TouchableOpacity
                  style={[s.nextBtn, { marginTop: 24 }, !newCouponTitle.trim() && { opacity: 0.5 }]}
                  onPress={addCoupon}
                  disabled={!newCouponTitle.trim()}
                  activeOpacity={0.85}
                >
                  <Text style={s.nextBtnText}>쿠폰 추가 완료 ✓</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.white },

  // 헤더
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn:     { padding: 4 },
  backArrow:   { fontSize: 22, color: C.g900 },
  headerTitle: { fontSize: 17, fontFamily: 'WantedSans-Bold', fontWeight: '700', color: C.g900 },
  headerStep:  { fontSize: 13, color: C.g500, fontFamily: 'WantedSans-SemiBold', fontWeight: '600' },

  // 진행바
  progressTrack: { height: 3, backgroundColor: C.g150 },
  progressFill:  { height: 3, backgroundColor: C.brand, borderRadius: 2 },

  // 폼 컨테이너
  formContainer: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 48 },

  pageTitle: {
    fontSize: 26, fontFamily: 'WantedSans-Black', fontWeight: '900', color: C.g900,
    letterSpacing: -0.5, lineHeight: 34,
  },
  pageSubtitle: { fontSize: 14, color: C.g500, marginTop: 6, marginBottom: 28 },

  // 필드
  fieldLabel: { fontSize: 13, fontFamily: 'WantedSans-Bold', fontWeight: '700', color: C.g900, marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: C.g200, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: C.g900,
    backgroundColor: C.white,
  },
  inputFocused: { borderColor: C.brand },
  inputMulti:   { minHeight: 80, textAlignVertical: 'top' },

  // 카테고리 칩
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22,
    backgroundColor: C.g100,
  },
  chipOn:     { backgroundColor: C.brand },
  chipText:   { fontSize: 14, fontFamily: 'WantedSans-SemiBold', fontWeight: '600', color: C.g700 },
  chipTextOn: { color: C.white },

  // 주소
  addressRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: C.g200, borderRadius: 12,
    backgroundColor: C.g50,
  },
  addressRowFilled: { backgroundColor: C.white, borderColor: C.g300 },
  addressText: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14, color: C.g900,
  },
  addressBtn: {
    paddingHorizontal: 14, paddingVertical: 13,
    borderLeftWidth: 1, borderLeftColor: C.g200,
  },
  addressBtnText: { fontSize: 13, fontFamily: 'WantedSans-Bold', fontWeight: '700', color: C.brand },

  // 다음 버튼
  nextBtn: {
    marginTop: 28, backgroundColor: C.brand, borderRadius: 14,
    paddingVertical: 17, alignItems: 'center',
    shadowColor: C.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextBtnText: { fontSize: 16, fontFamily: 'WantedSans-ExtraBold', fontWeight: '800', color: C.white },

  skipBtn: { marginTop: 14, alignItems: 'center', paddingVertical: 10 },
  skipBtnText: { fontSize: 14, color: C.g500, fontFamily: 'WantedSans-Medium', fontWeight: '500' },

  // 가게 요약
  storeSummary: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.g50, borderRadius: 12,
    padding: 14, marginBottom: 24,
  },
  storeSummaryEmoji: { fontSize: 28 },
  storeSummaryName:  { fontSize: 16, fontFamily: 'WantedSans-ExtraBold', fontWeight: '800', color: C.g900 },
  storeSummaryAddr:  { fontSize: 12, color: C.g500, marginTop: 2 },

  // 쿠폰 목록
  couponList: { gap: 10, marginBottom: 16 },

  // 쿠폰 추가 버튼
  addCouponBtn: {
    borderWidth: 2, borderColor: C.brand, borderStyle: 'dashed',
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    backgroundColor: C.brandBg,
  },
  addCouponBtnText: { fontSize: 15, fontFamily: 'WantedSans-Bold', fontWeight: '700', color: C.brand },

  couponEmptyHint: {
    marginTop: 14, paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: C.g50, borderRadius: 10,
  },
  couponEmptyText: { fontSize: 13, color: C.g500, textAlign: 'center', lineHeight: 20 },

  // 완료 화면
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  successTitle: { fontSize: 26, fontFamily: 'WantedSans-Black', fontWeight: '900', color: C.g900, textAlign: 'center' },
  successCallBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.brandBg, borderRadius: 14,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 4,
  },
  successCallEmoji: { fontSize: 24 },
  successCallText: { fontSize: 18, fontFamily: 'WantedSans-ExtraBold', fontWeight: '800', color: C.brand },
  successDesc: { fontSize: 14, color: C.g500, textAlign: 'center', lineHeight: 22, marginTop: 4 },
  successCouponBox: {
    backgroundColor: '#FFF0E6', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10, marginTop: 4,
  },
  successCouponText: { fontSize: 13, fontFamily: 'WantedSans-Bold', fontWeight: '700', color: C.brand, textAlign: 'center' },
  doneBtn: {
    marginTop: 20, backgroundColor: C.brand, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 52,
  },
  doneBtnText: { color: C.white, fontSize: 16, fontFamily: 'WantedSans-ExtraBold', fontWeight: '800' },

  // 주소 모달
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderColor: C.g200, backgroundColor: C.white,
  },
  modalTitle: { fontSize: 17, fontFamily: 'WantedSans-ExtraBold', fontWeight: '800', color: C.g900 },
  modalClose: { fontSize: 20, color: C.g500, padding: 4 },

  // 쿠폰 모달
  modalDim: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
  },
  couponModalSheet: {
    backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  couponModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 18, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.g150,
  },
  couponModalTitle: { fontSize: 18, fontFamily: 'WantedSans-ExtraBold', fontWeight: '800', color: C.g900 },
  couponModalBody: { padding: 20, paddingTop: 16, paddingBottom: 40 },

  // 쿠폰 종류 칩
  kindWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kindChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: C.g200, backgroundColor: C.white,
  },
  kindChipText: { fontSize: 13, fontFamily: 'WantedSans-SemiBold', fontWeight: '600', color: C.g700 },

  // 유효기간 선택
  expiryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  expiryChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: C.g100,
  },
  expiryChipOn: { backgroundColor: C.brand },
  expiryChipText: { fontSize: 13, fontFamily: 'WantedSans-SemiBold', fontWeight: '600', color: C.g700 },
  expiryChipTextOn: { color: C.white },
  expiryInput: {
    borderWidth: 1.5, borderColor: C.g200, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
    fontSize: 13, color: C.g900, width: 56, textAlign: 'center',
  },
});
