import React, { useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';
import {
  extractReceiptData,
  validateReceiptTime,
  findNearbyStores,
  matchStoreInReceipt,
  submitReceiptVerification,
  NearbyStore,
} from '../../lib/services/receiptService';
import { ExtractedReceiptData } from '../../lib/services/ocrService';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');

type Step = 'guide' | 'camera' | 'processing' | 'confirm' | 'success';

export default function ReceiptScanScreen() {
  const navigation = useNavigation<any>();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<Step>('guide');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  // OCR 추출 데이터
  const [parsed, setParsed] = useState<ExtractedReceiptData | null>(null);
  const [nearbyStore, setNearbyStore] = useState<NearbyStore | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [manualAmount, setManualAmount] = useState('');
  const [timeWarning, setTimeWarning] = useState('');
  const [showManual, setShowManual] = useState(false);

  // 안내 화면
  const GuideStep = () => (
    <ScrollView contentContainerStyle={styles.guideCont}>
      <View style={styles.guideHero}>
        <Text style={styles.guideEmoji}>🧾</Text>
        <Text style={styles.guideTitle}>영수증 인증으로{'\n'}매출 랭킹에 도전!</Text>
        <Text style={styles.guideSub}>방문한 가맹점 종이 영수증을 촬영하면{'\n'}금액만큼 랭킹에 반영돼요</Text>
      </View>

      {/* 개인정보 안내 박스 */}
      <View style={styles.privacyBox}>
        <Text style={styles.privacyIcon}>🔒</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.privacyTitle}>영수증 이미지 비저장 안내</Text>
          <Text style={styles.privacyDesc}>
            촬영된 영수증 이미지는 텍스트 인식 후 즉시 삭제되며,{'\n'}
            서버에 저장되지 않아요. 인증된 금액만 기록돼요.
          </Text>
        </View>
      </View>

      {/* 조건 목록 */}
      <View style={styles.conditionBox}>
        <Text style={styles.conditionTitle}>✅ 인증 조건</Text>
        {[
          '🏪 앱에 등록된 가맹점 영수증만 인증 가능',
          '📍 가맹점 500m 이내 위치',
          '⏱ 영수증 발행 4시간 이내',
          '🧾 종이 영수증 (POS 출력본, 상호명 필수)',
          '💳 중복 인증 불가 (1회 1장)',
        ].map((t, i) => (
          <Text key={i} style={styles.conditionItem}>{t}</Text>
        ))}
      </View>

      <TouchableOpacity
        style={styles.startBtn}
        onPress={handleStartScan}
      >
        <Text style={styles.startBtnText}>📷 영수증 촬영 시작</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const handleStartScan = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('카메라 권한 필요', '영수증 촬영을 위해 카메라 권한이 필요해요.');
        return;
      }
    }
    setStep('camera');
  };

  const handleTakePhoto = async () => {
    if (!cameraRef.current) return;
    setLoading(true);
    setLoadingMsg('📷 촬영 중...');

    try {
      // 1. 사진 촬영 (base64)
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        skipProcessing: true,
      });
      if (!photo?.base64) throw new Error('사진 촬영 실패');

      setStep('processing');
      setLoadingMsg('📍 현재 위치 확인 중...');

      // 2. 현재 위치 확인
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('위치 권한이 필요해요.');
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setUserLocation({ lat, lng });

      // 3. 주변 가맹점 목록 확인 (500m 이내 전체)
      setLoadingMsg('🏪 주변 가맹점 확인 중...');
      const nearbyList = await findNearbyStores(lat, lng);
      if (nearbyList.length === 0) {
        throw new Error(
          '500m 이내에 등록된 가맹점이 없어요.\n가맹점 근처에서 인증해주세요.'
        );
      }

      // 4. Claude Vision OCR — 구조화 데이터 한 번에 추출
      setLoadingMsg('🤖 AI로 영수증 분석 중... (이미지는 저장되지 않아요)');
      const extracted = await extractReceiptData(photo.base64);
      setParsed(extracted);

      // 5. 등록된 가맹점 영수증인지 이름 매칭
      setLoadingMsg('🏪 가맹점 확인 중...');
      const matchResult = matchStoreInReceipt(
        extracted.storeName ?? extracted.rawText,
        nearbyList
      );
      if (!matchResult.matched || !matchResult.store) {
        const storeNames = nearbyList.map(s => `· ${s.name}`).join('\n');
        const detected = extracted.storeName ? `\n인식된 상호: "${extracted.storeName}"` : '';
        throw new Error(
          `등록된 가맹점의 영수증만 인증할 수 있어요.${detected}\n\n주변 등록 가맹점:\n${storeNames}\n\n영수증에 가맹점 상호명이 명확히 보이도록 다시 촬영해주세요.`
        );
      }
      setNearbyStore(matchResult.store);

      // 6. 시간 검증
      if (extracted.datetime) {
        const timeCheck = validateReceiptTime(extracted.datetime);
        if (!timeCheck.valid) throw new Error(timeCheck.message);
        setTimeWarning(timeCheck.message);
      } else {
        setTimeWarning('⚠️ 날짜를 인식하지 못했어요. 금액만 확인해주세요.');
      }

      setStep('confirm');
    } catch (e: any) {
      Alert.alert('인증 실패', e.message ?? '다시 시도해주세요.', [
        { text: '재촬영', onPress: () => setStep('camera') },
        { text: '취소', onPress: () => setStep('guide') },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!nearbyStore || !userLocation) return;

    const finalAmount = parsed?.amount
      ? parsed.amount
      : parseInt(manualAmount.replace(/,/g, ''));

    if (!finalAmount || finalAmount <= 0) {
      Alert.alert('금액 확인', '인증할 금액을 입력해주세요.');
      return;
    }

    setLoading(true);
    setLoadingMsg('✅ 인증 처리 중...');

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('로그인이 필요해요.');

      await submitReceiptVerification({
        userId: session.session.user.id,
        storeId: nearbyStore.id,
        storeName: nearbyStore.name,
        districtId: nearbyStore.districtId,
        districtName: nearbyStore.districtName,
        amount: finalAmount,
        receiptDatetime: parsed?.datetime ?? new Date(),
        userLat: userLocation.lat,
        userLng: userLocation.lng,
      });

      setStep('success');
    } catch (e: any) {
      Alert.alert('인증 실패', e.message ?? '잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // 카메라 화면
  if (step === 'camera') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
          {/* 안내 오버레이 */}
          <View style={styles.camOverlay}>
            <SafeAreaView style={{ flex: 1 }}>
              <TouchableOpacity style={styles.camBack} onPress={() => setStep('guide')}>
                <Text style={styles.camBackText}>← 뒤로</Text>
              </TouchableOpacity>

              <View style={styles.camGuide}>
                <Text style={styles.camGuideText}>영수증 전체가 프레임 안에 오도록{'\n'}맞춰주세요</Text>
              </View>

              {/* 촬영 프레임 */}
              <View style={styles.camFrame}>
                <View style={[styles.camCorner, styles.camCornerTL]} />
                <View style={[styles.camCorner, styles.camCornerTR]} />
                <View style={[styles.camCorner, styles.camCornerBL]} />
                <View style={[styles.camCorner, styles.camCornerBR]} />
                <View style={styles.camFrameInner}>
                  <Text style={styles.camFrameText}>🧾 영수증</Text>
                </View>
              </View>

              {/* 개인정보 안내 배너 */}
              <View style={styles.camPrivacyBanner}>
                <Text style={styles.camPrivacyText}>🔒 이미지는 서버에 저장되지 않아요</Text>
              </View>

              {/* 촬영 버튼 */}
              <View style={styles.camBtnArea}>
                <TouchableOpacity
                  style={styles.camBtn}
                  onPress={handleTakePhoto}
                  disabled={loading}
                >
                  <View style={styles.camBtnInner} />
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        </CameraView>
      </View>
    );
  }

  // 처리 중
  if (step === 'processing') {
    return (
      <View style={styles.processingCont}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.processingTitle}>처리 중...</Text>
        <Text style={styles.processingMsg}>{loadingMsg}</Text>
        <View style={styles.privacySmall}>
          <Text style={styles.privacySmallText}>🔒 영수증 이미지는 서버에 저장되지 않아요</Text>
        </View>
      </View>
    );
  }

  // 확인 화면
  if (step === 'confirm') {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView contentContainerStyle={styles.confirmCont}>
            <Text style={styles.confirmTitle}>📋 영수증 인증 확인</Text>

            {/* 가맹점 정보 */}
            <View style={[styles.infoCard, SHADOW.card]}>
              <Text style={styles.infoLabel}>🏪 인증 가맹점</Text>
              <View style={styles.storeMatchRow}>
                <Text style={styles.infoValue}>{nearbyStore?.name}</Text>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedBadgeText}>✓ 등록 가맹점</Text>
                </View>
              </View>
              {nearbyStore?.districtName && (
                <Text style={styles.infoSub}>{nearbyStore.districtName} 상권 · {nearbyStore.distance}m</Text>
              )}
            </View>

            {/* 영수증 시간 */}
            <View style={[styles.infoCard, SHADOW.card]}>
              <Text style={styles.infoLabel}>⏱ 영수증 날짜/시간</Text>
              {parsed?.datetime ? (
                <Text style={styles.infoValue}>
                  {parsed.datetime.toLocaleDateString('ko-KR')} {parsed.datetime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              ) : (
                <Text style={[styles.infoValue, { color: COLORS.textMuted }]}>인식 실패</Text>
              )}
              <Text style={[styles.infoSub, { color: '#4CAF50' }]}>{timeWarning}</Text>
            </View>

            {/* 금액 */}
            <View style={[styles.infoCard, SHADOW.card]}>
              <Text style={styles.infoLabel}>💰 인증 금액</Text>
              {parsed?.amount ? (
                <Text style={styles.infoValueLarge}>
                  {parsed.amount.toLocaleString()}원
                </Text>
              ) : (
                <>
                  <Text style={[styles.infoSub, { color: COLORS.accent, marginBottom: 8 }]}>
                    ⚠️ 금액을 인식하지 못했어요. 직접 입력해주세요.
                  </Text>
                  <TextInput
                    style={styles.amountInput}
                    value={manualAmount}
                    onChangeText={setManualAmount}
                    placeholder="예) 15000"
                    keyboardType="numeric"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </>
              )}
            </View>

            {/* 개인정보 고지 */}
            <View style={styles.privacyBox}>
              <Text style={styles.privacyIcon}>🔒</Text>
              <Text style={[styles.privacyDesc, { flex: 1 }]}>
                영수증 이미지는 텍스트 인식 즉시 삭제됐어요.{'\n'}
                인증된 금액과 가맹점 정보만 저장돼요.
              </Text>
            </View>

            {/* 버튼 */}
            <View style={styles.confirmBtns}>
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={() => setStep('camera')}
              >
                <Text style={styles.retakeBtnText}>재촬영</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, loading && { opacity: 0.7 }]}
                onPress={handleConfirm}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.confirmBtnText}>✅ 인증하기</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // 성공 화면
  if (step === 'success') {
    const amount = parsed?.amount ?? parseInt(manualAmount.replace(/,/g, ''));
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successCont}>
          <Text style={styles.successEmoji}>🎉</Text>
          <Text style={styles.successTitle}>영수증 인증 완료!</Text>
          <Text style={styles.successSub}>{nearbyStore?.districtName} 상권 랭킹에 반영됐어요</Text>

          <View style={[styles.successAmountCard, SHADOW.card]}>
            <Text style={styles.successAmountLabel}>인증된 금액</Text>
            <Text style={styles.successAmount}>+{amount?.toLocaleString()}원</Text>
            <Text style={styles.successStore}>{nearbyStore?.name}</Text>
          </View>

          <View style={styles.successBtns}>
            <TouchableOpacity
              style={styles.rankingBtn}
              onPress={() => navigation.replace('Ranking')}
            >
              <Text style={styles.rankingBtnText}>🏆 랭킹 확인하기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.homeBtn}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.homeBtnText}>홈으로</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // 안내 화면 (default)
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>영수증 인증</Text>
        <View style={{ width: 60 }} />
      </View>
      <GuideStep />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },

  // 안내 화면
  guideCont: { padding: 24, gap: 16, paddingBottom: 40 },
  guideHero: { alignItems: 'center', paddingVertical: 20 },
  guideEmoji: { fontSize: 64, marginBottom: 12 },
  guideTitle: {
    fontSize: 24, fontWeight: '900', color: COLORS.text,
    textAlign: 'center', lineHeight: 32, marginBottom: 8,
  },
  guideSub: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },
  privacyBox: {
    flexDirection: 'row', gap: 10, backgroundColor: '#EBF5FB',
    borderRadius: RADIUS.md, padding: 14,
    borderWidth: 1, borderColor: '#AED6F1',
    alignItems: 'flex-start',
  },
  privacyIcon: { fontSize: 22 },
  privacyTitle: { fontSize: 13, fontWeight: '800', color: '#1A5276', marginBottom: 4 },
  privacyDesc: { fontSize: 12, color: '#2980B9', lineHeight: 18 },
  conditionBox: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: 16,
    gap: 8, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.card,
  },
  conditionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  conditionItem: { fontSize: 13, color: COLORS.text, lineHeight: 22 },
  startBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  startBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.white },

  // 카메라
  camOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  camBack: { padding: 16 },
  camBackText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  camGuide: { alignItems: 'center', paddingVertical: 8 },
  camGuideText: { color: COLORS.white, textAlign: 'center', fontSize: 13, lineHeight: 20 },
  camFrame: {
    marginHorizontal: 32, height: 260, borderRadius: 4,
    position: 'relative', justifyContent: 'center', alignItems: 'center',
    marginTop: 16,
  },
  camFrameInner: { alignItems: 'center' },
  camFrameText: { color: 'rgba(255,255,255,0.5)', fontSize: 18 },
  camCorner: {
    position: 'absolute', width: 24, height: 24,
    borderColor: COLORS.primary, borderWidth: 3,
  },
  camCornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  camCornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  camCornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  camCornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  camPrivacyBanner: {
    backgroundColor: 'rgba(0,0,0,0.6)', marginHorizontal: 32,
    borderRadius: RADIUS.sm, padding: 8, alignItems: 'center', marginTop: 12,
  },
  camPrivacyText: { color: COLORS.white, fontSize: 12 },
  camBtnArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 40 },
  camBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: COLORS.white,
  },
  camBtnInner: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: COLORS.white,
  },

  // 처리 중
  processingCont: {
    flex: 1, backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32,
  },
  processingTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  processingMsg: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },
  privacySmall: {
    backgroundColor: '#EBF5FB', borderRadius: RADIUS.sm, padding: 12, marginTop: 8,
  },
  privacySmallText: { fontSize: 12, color: '#2980B9', textAlign: 'center' },

  // 확인
  confirmCont: { padding: 20, gap: 12, paddingBottom: 40 },
  confirmTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  infoCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    padding: 16, gap: 4,
  },
  infoLabel: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  infoValue: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  infoValueLarge: { fontSize: 24, fontWeight: '900', color: COLORS.primary },
  infoSub: { fontSize: 12, color: COLORS.textMuted },
  storeMatchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  verifiedBadge: {
    backgroundColor: '#4CAF5022', borderRadius: 6, borderWidth: 1, borderColor: '#4CAF50',
    paddingHorizontal: 7, paddingVertical: 2,
  },
  verifiedBadgeText: { fontSize: 11, fontWeight: '700', color: '#4CAF50' },
  amountInput: {
    borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: RADIUS.sm,
    padding: 12, fontSize: 18, fontWeight: '700', color: COLORS.text,
  },
  confirmBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  retakeBtn: {
    flex: 1, backgroundColor: COLORS.secondary, borderRadius: RADIUS.md,
    padding: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  retakeBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.textMuted },
  confirmBtn: {
    flex: 2, backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    padding: 14, alignItems: 'center',
  },
  confirmBtnText: { fontSize: 15, fontWeight: '800', color: COLORS.white },

  // 성공
  successCont: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 12,
  },
  successEmoji: { fontSize: 72 },
  successTitle: { fontSize: 26, fontWeight: '900', color: COLORS.text },
  successSub: { fontSize: 14, color: COLORS.textMuted },
  successAmountCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    padding: 24, alignItems: 'center', gap: 6, width: '100%',
    marginTop: 8,
  },
  successAmountLabel: { fontSize: 13, color: COLORS.textMuted },
  successAmount: { fontSize: 32, fontWeight: '900', color: COLORS.primary },
  successStore: { fontSize: 14, color: COLORS.textMuted },
  successBtns: { width: '100%', gap: 12, marginTop: 16 },
  rankingBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    padding: 16, alignItems: 'center',
  },
  rankingBtnText: { fontSize: 15, fontWeight: '800', color: COLORS.white },
  homeBtn: {
    backgroundColor: COLORS.secondary, borderRadius: RADIUS.md,
    padding: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  homeBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.textMuted },
});
