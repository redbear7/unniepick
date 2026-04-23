/**
 * ReceiptReviewScreen — 영수증 스캔 → 업체 매칭 → 방문 후기 + 포인트
 *
 * 플로우:
 *   1. 영수증 촬영 / 갤러리 선택
 *   2. AI 추출 (상호·메뉴·날짜)
 *   3. 언니픽 업체 매칭 결과 표시
 *   4. 후기 작성 (300자) + 사진 선택
 *   5. 제출 → 포인트 즉시 지급
 */

import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';

import { PALETTE } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

// ── 타입 ─────────────────────────────────────────────────────────
interface ReceiptItem {
  name:       string;
  unit_price: number;
}

interface ReceiptData {
  store_name:   string | null;
  store_address:string | null;
  store_phone:  string | null;
  receipt_date: string | null;
  receipt_time: string | null;
  items:        ReceiptItem[];
}

interface MatchedStore {
  id:      string;
  name:    string;
  address: string | null;
  phone:   string | null;
}

type Step = 'scan' | 'review' | 'done';

// ── 날짜·시간 포맷 헬퍼 ──────────────────────────────────────────
function formatReceiptDateTime(date: string | null, time: string | null): string {
  if (!date) return '';
  if (!time) return date;
  if (time.includes('오전') || time.includes('오후')) return `${date} ${time}`;
  // "HH:MM" → "오전/오후 H:MM"
  const parts = time.split(':');
  const h = parseInt(parts[0] ?? '0', 10);
  const m = parts[1] ?? '00';
  const period = h >= 12 ? '오후' : '오전';
  const h12    = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${date} ${period} ${h12}:${m}`;
}

// ── 영수증 이미지 전처리 ─────────────────────────────────────────
// 1200px 리사이즈 → 파일 크기 50~70% 감소, 업로드 속도 향상
// 흑백 변환은 expo-image-manipulator 미지원 → 서버(parse-receipt)에서 처리
async function preprocessForOCR(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri;
  } catch {
    return uri; // 전처리 실패 시 원본 그대로
  }
}

// ── base64 변환 헬퍼 ─────────────────────────────────────────────
async function uriToBase64(uri: string): Promise<string> {
  const res      = await fetch(uri);
  const buf      = await res.arrayBuffer();
  const bytes    = new Uint8Array(buf);
  let binary     = '';
  const CHUNK    = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// ── 컴포넌트 ─────────────────────────────────────────────────────
export default function ReceiptReviewScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const insets     = useSafeAreaInsets();

  // 가게 페이지에서 넘어온 경우 업체 정보 미리 세팅
  const prefilledStoreId   = route.params?.prefilledStoreId   as string | undefined;
  const prefilledStoreName = route.params?.prefilledStoreName as string | undefined;

  const [step,          setStep]          = useState<Step>('scan');
  const scrollRef = useRef<ScrollView>(null);

  // 마운트 시 카메라 자동 실행
  React.useEffect(() => {
    if (prefilledStoreId && prefilledStoreName) {
      setMatchedStore({ id: prefilledStoreId, name: prefilledStoreName, address: null, phone: null });
    }
    // 약간의 딜레이 후 카메라 바로 진입 (네비게이션 애니메이션 완료 후)
    const t = setTimeout(() => pickImage('camera'), 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [scanLoading,   setScanLoading]   = useState(false);
  const [submitting,    setSubmitting]    = useState(false);

  // 스캔 결과
  const [receipt,       setReceipt]       = useState<ReceiptData | null>(null);
  const [scanId,        setScanId]        = useState<string | null>(null);
  const [matchedStore,  setMatchedStore]  = useState<MatchedStore | null>(null);

  // 후기 폼
  const [content,       setContent]       = useState('');
  const [photoUri,      setPhotoUri]      = useState<string | null>(null);
  const [photoPath,     setPhotoPath]     = useState<string | null>(null); // Storage 경로

  // 완료 결과
  const [pointsAwarded, setPointsAwarded] = useState(0);
  const [totalPoints,   setTotalPoints]   = useState(0);
  const [pointReason,   setPointReason]   = useState<string | null>(null);

  // ── 세션 갱신 헬퍼 ──────────────────────────────────────────────
  const getFreshSession = async () => {
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (error || !refreshed.session) throw new Error('세션이 만료됐어요. 다시 로그인해주세요.');
    return refreshed.session;
  };

  // ── 1. 영수증 촬영 ───────────────────────────────────────────────
  const openPicker = () => {
    Alert.alert('영수증 불러오기', '촬영하거나 갤러리에서 선택해주세요', [
      { text: '카메라 촬영', onPress: () => pickImage('camera') },
      { text: '갤러리 선택', onPress: () => pickImage('gallery') },
      { text: '취소', style: 'cancel' },
    ]);
  };

  const pickImage = async (source: 'camera' | 'gallery') => {
    let result: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('카메라 권한 필요'); return; }
      result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('갤러리 권한 필요'); return; }
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    }
    if (result.canceled || !result.assets?.[0]?.uri) return;
    await parseReceipt(result.assets[0].uri);
  };

  // ── 2. 영수증 파싱 (parse-receipt Edge Function) ─────────────────
  // Storage 왕복 제거: 전처리 → base64 → Edge Function 직접 POST
  // 서버에서 흑백 변환 + sharp 리사이즈 추가 처리
  const parseReceipt = async (fileUri: string) => {
    setScanLoading(true);
    try {
      const session = await getFreshSession();

      // 클라이언트 전처리: 1200px 리사이즈 (파일 크기 50~70% 감소)
      const processedUri = await preprocessForOCR(fileUri);
      const imageBase64  = await uriToBase64(processedUri);

      const { data, error } = await supabase.functions.invoke('parse-receipt', {
        body:    { imageBase64, user_id: session.user.id, user_token: session.access_token },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        let msg = error.message ?? '알 수 없는 오류';
        try {
          const ctx = (error as any).context as Response | undefined;
          if (ctx) {
            const raw = await ctx.text();
            if (raw) {
              try { const j = JSON.parse(raw); msg = j.error || j.message || msg; }
              catch { msg = raw.slice(0, 200); }
            }
          }
        } catch {}
        console.error('[parse-receipt]', msg);
        throw new Error(msg);
      }
      if (!data?.receipt) throw new Error('영수증 인식에 실패했어요');

      const r: ReceiptData = data.receipt;

      setReceipt(r);
      setScanId(data.scan_id ?? null);
      setMatchedStore(data.matched_store ?? null);
      setStep('review');
    } catch (e: any) {
      Alert.alert('인식 실패', '영수증을 다시 촬영해주세요.\n' + (e?.message ?? ''));
    } finally {
      setScanLoading(false);
    }
  };

  // ── 3. 후기 사진 선택 ────────────────────────────────────────────
  const pickReviewPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('갤러리 권한 필요'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setPhotoUri(result.assets[0].uri);
    setPhotoPath(null); // 업로드는 제출 시점에
  };

  const removePhoto = () => { setPhotoUri(null); setPhotoPath(null); };

  // ── 4. 후기 제출 ────────────────────────────────────────────────
  const submitReview = async () => {
    if (!content.trim()) { Alert.alert('후기를 작성해주세요.'); return; }
    if (content.trim().length > 300) { Alert.alert('후기는 300자 이내로 작성해주세요.'); return; }

    setSubmitting(true);
    try {
      const session = await getFreshSession();
      let uploadedPhotoUrl: string | null = null;

      // 사진 업로드
      if (photoUri) {
        const ext      = 'jpg';
        const path     = `${session.user.id}/${Date.now()}.${ext}`;
        const fileRes  = await fetch(photoUri);
        const arrayBuf = await fileRes.arrayBuffer();
        const { error: photoErr } = await supabase.storage
          .from('review-photos')
          .upload(path, arrayBuf, { contentType: 'image/jpeg', upsert: false });
        if (photoErr) throw new Error(`사진 업로드 실패: ${photoErr.message}`);

        const { data: { publicUrl } } = supabase.storage
          .from('review-photos')
          .getPublicUrl(path);
        uploadedPhotoUrl = publicUrl;
        setPhotoPath(path);
      }

      // submit-review Edge Function 호출
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
      const { data, error } = await supabase.functions.invoke('submit-review', {
        body: {
          user_token:      session.access_token,
          store_id:        matchedStore?.id ?? null,
          receipt_scan_id: scanId,
          content:         content.trim(),
          photo_url:       uploadedPhotoUrl,
          receipt_date:    receipt?.receipt_date ?? null,
        },
        headers: { Authorization: `Bearer ${anonKey}` },
      });

      if (error) {
        let msg = error.message ?? '알 수 없는 오류';
        try {
          const ctx = (error as any).context as Response | undefined;
          if (ctx) {
            const raw = await ctx.text();
            if (raw) {
              try { const j = JSON.parse(raw); msg = j.error || j.message || msg; }
              catch { msg = raw.slice(0, 200); }
            }
          }
        } catch {}
        console.error('[submit-review]', msg);
        throw new Error(msg);
      }

      setPointsAwarded(data.points_awarded ?? 0);
      setTotalPoints(data.total_points ?? 0);
      setPointReason(data.point_reason ?? null);
      setStep('done');
    } catch (e: any) {
      Alert.alert('오류', e?.message ?? '제출에 실패했어요. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // 렌더
  // ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={s.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>영수증 후기 제보</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* ── STEP: scan ── */}
      {step === 'scan' && (
        <View style={s.centerWrap}>
          {scanLoading ? (
            <View style={s.loadingBox}>
              <ActivityIndicator size="large" color={PALETTE.orange500} />
              <Text style={s.loadingText}>AI가 영수증을 분석 중이에요...</Text>
              <Text style={s.loadingSubText}>상호·메뉴·가격 정보를 추출하고 있어요</Text>
            </View>
          ) : (
            <>
              <Text style={s.scanEmoji}>🧾</Text>
              <Text style={s.scanTitle}>영수증을 촬영해주세요</Text>
              <Text style={s.scanDesc}>
                AI가 방문 업체와 메뉴·가격을 자동으로 읽어드려요.{'\n'}
                제출하면 <Text style={s.highlight}>500 포인트</Text>를 드려요!
              </Text>
              <Text style={s.scanCond}>
                • 영수증 유효 기간 이내만 가능{'\n'}
                • 하루 1회 포인트 지급
              </Text>
              <TouchableOpacity style={s.scanBtn} onPress={openPicker} activeOpacity={0.85}>
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={s.scanBtnText}>영수증 촬영하기</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* ── STEP: review ── */}
      {step === 'review' && receipt && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── 업체 정보 카드 ── */}
            <View style={matchedStore ? s.storeCard : [s.storeCard, s.storeCardUnknown]}>
              <View style={[s.storeCardBadge, !matchedStore && s.badgeGray]}>
                <Text style={[s.storeCardBadgeText, !matchedStore && s.badgeGrayText]}>
                  {matchedStore ? '✅ 언니픽 등록 업체' : '미등록 업체'}
                </Text>
              </View>

              {/* 상호 */}
              <Text style={s.storeCardName}>
                {matchedStore?.name ?? receipt.store_name ?? '업체명 미확인'}
              </Text>

              {/* 주소 */}
              {(matchedStore?.address || receipt.store_address) ? (
                <View style={s.storeInfoRow}>
                  <Ionicons name="location-outline" size={13} color={PALETTE.gray400} />
                  <Text style={s.storeInfoText} numberOfLines={2}>
                    {matchedStore?.address ?? receipt.store_address}
                  </Text>
                </View>
              ) : null}

              {/* 전화번호 */}
              {(matchedStore?.phone || receipt.store_phone) ? (
                <View style={s.storeInfoRow}>
                  <Ionicons name="call-outline" size={13} color={PALETTE.gray400} />
                  <Text style={s.storeInfoText}>
                    {matchedStore?.phone ?? receipt.store_phone}
                  </Text>
                </View>
              ) : null}

              {!matchedStore && (
                <Text style={s.storeCardNote}>후기는 등록할 수 있지만 포인트 일부 조건이 제한될 수 있어요.</Text>
              )}
            </View>

            {/* ── 영수증 정보 ── */}
            <View style={s.receiptSummary}>
              <Text style={s.receiptSummaryTitle}>📋 영수증 정보</Text>

              {/* 발행일시 */}
              {receipt.receipt_date && (
                <View style={s.receiptDateRow}>
                  <Ionicons name="time-outline" size={13} color={PALETTE.gray500} />
                  <Text style={s.receiptDateText}>
                    {formatReceiptDateTime(receipt.receipt_date, receipt.receipt_time)}
                  </Text>
                </View>
              )}

              {/* 품목 테이블 */}
              {receipt.items.length > 0 && (
                <View style={s.itemsTable}>
                  {/* 헤더 */}
                  <View style={[s.itemRow, s.itemRowHeader]}>
                    <Text style={[s.itemCell, s.itemCellHeader, { flex: 1 }]}>품명</Text>
                    <Text style={[s.itemCell, s.itemCellHeader, s.itemCellRight]}>단가</Text>
                  </View>
                  {receipt.items.map((item, i) => (
                    <View key={i} style={[s.itemRow, i % 2 === 1 && s.itemRowAlt]}>
                      <Text style={[s.itemCell, { flex: 1 }]} numberOfLines={1}>{item.name}</Text>
                      <Text style={[s.itemCell, s.itemCellRight]}>
                        {item.unit_price > 0 ? item.unit_price.toLocaleString() : '–'}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* ── 방문 후기 ── */}
            <View style={s.section}>
              <Text style={s.label}>
                방문 후기 <Text style={s.required}>*</Text>
              </Text>
              <TextInput
                style={s.textArea}
                value={content}
                onChangeText={setContent}
                placeholder="음식 맛, 분위기, 서비스 등 솔직한 후기를 남겨주세요 (300자 이내)"
                placeholderTextColor={PALETTE.gray400}
                multiline
                maxLength={300}
                textAlignVertical="top"
                onFocus={() => {
                  // 키보드 올라온 뒤 잠깐 후 스크롤 — 텍스트 영역이 가려지지 않도록
                  setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
                }}
              />
              <Text style={[s.counter, content.length > 280 && s.counterWarn]}>
                {content.length}/300
              </Text>
            </View>

            {/* ── 사진 첨부 ── */}
            <View style={s.section}>
              <Text style={s.label}>사진 첨부 <Text style={s.optional}>(선택, 1장)</Text></Text>
              {photoUri ? (
                <View style={s.photoPreviewWrap}>
                  <Image source={{ uri: photoUri }} style={s.photoPreview} />
                  <TouchableOpacity style={s.photoRemoveBtn} onPress={removePhoto}>
                    <Ionicons name="close-circle" size={24} color={PALETTE.gray500} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={s.photoAddBtn} onPress={pickReviewPhoto} activeOpacity={0.7}>
                  <Ionicons name="image-outline" size={28} color={PALETTE.gray400} />
                  <Text style={s.photoAddText}>사진 추가</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── 포인트 안내 + 제출 버튼 (스크롤 내부) ── */}
            <View style={s.pointInfoBox}>
              <Text style={s.pointInfoText}>
                🎁 제출 완료 시 <Text style={s.pointHighlight}>500 포인트</Text> 즉시 지급{'\n'}
                영수증 유효 기간 이내 · 하루 1회 한정
              </Text>
            </View>

            <View style={s.submitWrap}>
              <TouchableOpacity
                style={[s.submitBtn, (!content.trim() || submitting) && s.submitBtnDisabled]}
                onPress={submitReview}
                disabled={!content.trim() || submitting}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.submitBtnText}>📝 후기 제출하기</Text>
                }
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ── STEP: done ── */}
      {step === 'done' && (
        <View style={s.centerWrap}>
          <Text style={s.doneEmoji}>{pointsAwarded > 0 ? '🎉' : '✅'}</Text>
          <Text style={s.doneTitle}>후기가 등록됐어요!</Text>

          {pointsAwarded > 0 ? (
            <>
              <View style={s.pointBadge}>
                <Text style={s.pointBadgeText}>+{pointsAwarded.toLocaleString()} P</Text>
              </View>
              <Text style={s.doneDesc}>포인트가 즉시 지급됐어요 🙌</Text>
              <Text style={s.totalPoints}>보유 포인트: {totalPoints.toLocaleString()} P</Text>
            </>
          ) : (
            <>
              <Text style={s.doneDesc}>
                {pointReason ?? '포인트 지급 조건이 충족되지 않았어요.'}
              </Text>
            </>
          )}

          <TouchableOpacity
            style={s.doneBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Text style={s.doneBtnText}>확인</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: PALETTE.gray100 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: PALETTE.gray150,
  },
  backBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 28, lineHeight: 32, color: PALETTE.gray900, fontFamily: 'WantedSans-Bold' },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontFamily: 'WantedSans-ExtraBold', fontSize: 17,
    color: PALETTE.gray900, letterSpacing: -0.3,
  },

  // 스캔 화면
  centerWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  loadingBox:    { alignItems: 'center', gap: 16 },
  loadingText:   { fontFamily: 'WantedSans-Bold', fontSize: 16, color: PALETTE.gray800 },
  loadingSubText: { fontFamily: 'WantedSans-Medium', fontSize: 13, color: PALETTE.gray500 },
  scanEmoji:  { fontSize: 64, marginBottom: 16 },
  scanTitle:  {
    fontFamily: 'WantedSans-ExtraBold', fontSize: 22,
    color: PALETTE.gray900, marginBottom: 12, letterSpacing: -0.5,
  },
  scanDesc: {
    fontFamily: 'WantedSans-Medium', fontSize: 14, color: PALETTE.gray600,
    textAlign: 'center', lineHeight: 22, marginBottom: 16,
  },
  scanCond: {
    fontFamily: 'WantedSans-Medium', fontSize: 12, color: PALETTE.gray400,
    textAlign: 'center', lineHeight: 20, marginBottom: 32,
  },
  highlight: { color: PALETTE.orange500, fontFamily: 'WantedSans-ExtraBold' },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: PALETTE.orange500, borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 32,
  },
  scanBtnText: { fontFamily: 'WantedSans-ExtraBold', fontSize: 16, color: '#fff' },

  // 후기 화면 — 업체 카드
  storeCard: {
    margin: 16, marginBottom: 8, padding: 16, backgroundColor: '#fff',
    borderRadius: 16, borderWidth: 2, borderColor: PALETTE.orange500,
    gap: 6,
  },
  storeCardUnknown: { borderColor: PALETTE.gray300 },
  storeCardBadge: {
    alignSelf: 'flex-start',
    backgroundColor: PALETTE.orange50, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeGray:     { backgroundColor: PALETTE.gray150 },
  storeCardBadgeText: {
    fontFamily: 'WantedSans-Bold', fontSize: 11, color: PALETTE.orange500,
  },
  badgeGrayText: { color: PALETTE.gray600 },
  storeCardName: {
    fontFamily: 'WantedSans-ExtraBold', fontSize: 18,
    color: PALETTE.gray900, letterSpacing: -0.4, marginTop: 2,
  },
  storeInfoRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 4,
  },
  storeInfoText: {
    fontFamily: 'WantedSans-Medium', fontSize: 12, color: PALETTE.gray500,
    flex: 1, lineHeight: 17,
  },
  storeCardNote: {
    fontFamily: 'WantedSans-Medium', fontSize: 11, color: PALETTE.gray400,
    lineHeight: 16, marginTop: 2,
  },

  // 영수증 정보 카드
  receiptSummary: {
    marginHorizontal: 16, marginBottom: 8,
    padding: 14, backgroundColor: PALETTE.gray100,
    borderRadius: 12,
  },
  receiptSummaryTitle: {
    fontFamily: 'WantedSans-Bold', fontSize: 13, color: PALETTE.gray700, marginBottom: 8,
  },
  receiptDateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10,
  },
  receiptDateText: {
    fontFamily: 'WantedSans-Medium', fontSize: 13, color: PALETTE.gray700,
  },

  // 품목 테이블
  itemsTable: {
    borderRadius: 8, overflow: 'hidden',
    borderWidth: 1, borderColor: PALETTE.gray200,
  },
  itemRow: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#fff',
  },
  itemRowHeader: { backgroundColor: PALETTE.gray800 },
  itemRowAlt:    { backgroundColor: PALETTE.gray50 },
  itemCell: {
    fontFamily: 'WantedSans-Medium', fontSize: 13, color: PALETTE.gray800,
  },
  itemCellHeader: {
    fontFamily: 'WantedSans-Bold', fontSize: 12, color: '#fff',
  },
  itemCellRight: { width: 72, textAlign: 'right' },

  section: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#fff', borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: PALETTE.gray150,
  },
  label: {
    fontFamily: 'WantedSans-ExtraBold', fontSize: 14,
    color: PALETTE.gray900, marginBottom: 10, letterSpacing: -0.2,
  },
  required: { color: PALETTE.orange500 },
  optional: { fontFamily: 'WantedSans-Medium', fontSize: 12, color: PALETTE.gray400 },
  textArea: {
    minHeight: 120, borderWidth: 1.5, borderColor: PALETTE.gray200,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: PALETTE.gray900,
    fontFamily: 'WantedSans-Medium', backgroundColor: PALETTE.gray100,
  },
  counter:     { fontFamily: 'WantedSans-Medium', fontSize: 11, color: PALETTE.gray400, textAlign: 'right', marginTop: 6 },
  counterWarn: { color: PALETTE.orange500 },

  photoAddBtn: {
    height: 100, borderWidth: 1.5, borderColor: PALETTE.gray200,
    borderRadius: 10, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: PALETTE.gray100,
  },
  photoAddText:    { fontFamily: 'WantedSans-Medium', fontSize: 12, color: PALETTE.gray400 },
  photoPreviewWrap: { position: 'relative', alignSelf: 'flex-start' },
  photoPreview:    { width: 100, height: 100, borderRadius: 10 },
  photoRemoveBtn:  { position: 'absolute', top: -8, right: -8 },

  pointInfoBox: {
    marginHorizontal: 16, marginBottom: 12,
    padding: 14, backgroundColor: PALETTE.orange50,
    borderRadius: 12, borderWidth: 1, borderColor: PALETTE.orange500 + '33',
  },
  pointInfoText:    { fontFamily: 'WantedSans-Medium', fontSize: 12, color: PALETTE.gray700, lineHeight: 20 },
  pointHighlight:   { fontFamily: 'WantedSans-ExtraBold', color: PALETTE.orange500 },

  submitWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  submitBtn: {
    backgroundColor: PALETTE.orange500, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  submitBtnDisabled: { backgroundColor: PALETTE.gray300 },
  submitBtnText: { fontFamily: 'WantedSans-ExtraBold', fontSize: 16, color: '#fff', letterSpacing: -0.3 },

  // 완료 화면
  doneEmoji:  { fontSize: 72, marginBottom: 16 },
  doneTitle:  {
    fontFamily: 'WantedSans-ExtraBold', fontSize: 24,
    color: PALETTE.gray900, marginBottom: 16, letterSpacing: -0.5,
  },
  pointBadge: {
    backgroundColor: PALETTE.orange500, borderRadius: 24,
    paddingHorizontal: 24, paddingVertical: 10, marginBottom: 12,
  },
  pointBadgeText: {
    fontFamily: 'WantedSans-ExtraBold', fontSize: 24, color: '#fff', letterSpacing: -0.5,
  },
  doneDesc: {
    fontFamily: 'WantedSans-Medium', fontSize: 14, color: PALETTE.gray600,
    textAlign: 'center', lineHeight: 22, marginBottom: 8,
  },
  totalPoints: {
    fontFamily: 'WantedSans-Bold', fontSize: 14, color: PALETTE.gray500, marginBottom: 32,
  },
  doneBtn: {
    backgroundColor: PALETTE.orange500, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 48,
  },
  doneBtnText: { fontFamily: 'WantedSans-ExtraBold', fontSize: 16, color: '#fff' },
});
