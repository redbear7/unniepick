import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { COLORS, RADIUS } from '../../constants/theme';
import { getSession } from '../../lib/services/authService';
import { storeCheckin } from '../../lib/services/walletService';

export default function StoreCheckinScreen() {
  const navigation = useNavigation<any>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned,    setScanned]    = useState(false);
  const [processing, setProcessing] = useState(false);
  const [userId,     setUserId]     = useState<string | null>(null);

  useEffect(() => {
    getSession().then(s => setUserId(s?.user.id ?? null));
  }, []);

  const handleScan = async ({ data }: { data: string }) => {
    if (scanned || processing || !userId) return;
    setScanned(true);
    setProcessing(true);

    try {
      // QR 파싱: unniepick://checkin?store=STORE_ID
      const storeId = parseStoreQR(data);
      if (!storeId) {
        Alert.alert('잘못된 QR', '언니픽 가게 QR이 아니에요', [
          { text: '확인', onPress: () => setScanned(false) },
        ]);
        return;
      }

      // GPS 위치 획득
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('위치 권한 필요', '가게 방문 인증을 위해 위치 권한이 필요해요', [
          { text: '확인', onPress: () => setScanned(false) },
        ]);
        return;
      }

      // 1단계: 빠른 위치 획득 (UI 반응성)
      let loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });

      // 2단계: 고정밀 GPS (캐시 3초 이내만 허용)
      try {
        const preciseL = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          maximumAge: 3000,
        });
        loc = preciseL;
      } catch { /* 고정밀 실패 시 1단계 결과 사용 */ }

      // 서버 체크인 (GPS 검증 + 적립)
      const result = await storeCheckin(
        userId,
        storeId,
        loc.coords.latitude,
        loc.coords.longitude,
      );

      if (result.success) {
        // 스탬프 완성 여부 확인
        const stampDone =
          result.stamp_count != null &&
          result.stamp_goal  != null &&
          result.stamp_count >= result.stamp_goal;

        const stampLine = result.stamp_count != null
          ? `\n🍀 스탬프 ${result.stamp_count}/${result.stamp_goal ?? 10}개`
          : '';

        const rewardLine = stampDone && result.stamp_reward
          ? `\n🎁 리워드: ${result.stamp_reward}`
          : stampDone
          ? '\n🎉 스탬프 완성! 가게에 리워드를 문의하세요'
          : '';

        Alert.alert(
          stampDone ? '🎉 스탬프 완성!' : '✅ 방문 스탬프 적립!',
          `${result.store_name}\n+${result.earned} UNNI 적립됐어요!\n잔액: ${result.balance.toLocaleString()} UNNI${stampLine}${rewardLine}`,
          [{ text: '확인', onPress: () => navigation.goBack() }],
        );
      } else {
        const msgs: Record<string, string> = {
          too_far:
            `가게에서 너무 멀어요 😅\n(현재 ${result.distance_m}m)\n가게 앞에서 스캔해주세요`,
          already_checked_today:
            '오늘은 이미 방문 스탬프를 받았어요 😊\n내일 다시 방문해주세요!',
          receipt_already_used_today:
            '오늘 이미 영수증 인증을 하셨어요 🧾\n방문 스탬프와 영수증 인증은\n같은 날 중복 사용이 불가해요.',
          store_not_found:
            '등록된 가게를 찾을 수 없어요',
        };
        Alert.alert(
          result.reason === 'receipt_already_used_today' ? '중복 인증 불가' : '적립 불가',
          msgs[result.reason] ?? '다시 시도해주세요',
          [{ text: '확인', onPress: () => setScanned(false) }],
        );
      }
    } catch (e: any) {
      Alert.alert('오류', e.message ?? '처리 중 오류가 발생했어요', [
        { text: '확인', onPress: () => setScanned(false) },
      ]);
    } finally {
      setProcessing(false);
    }
  };

  if (!permission) return <View style={s.safe} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Text style={s.permText}>카메라 권한이 필요해요</Text>
          <TouchableOpacity style={s.permBtn} onPress={requestPermission}>
            <Text style={s.permBtnText}>권한 허용하기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={s.title}>방문 적립</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.camera}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleScan}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />

        {/* 스캔 오버레이 */}
        <View style={s.overlay}>
          <View style={s.frame}>
            <View style={[s.corner, s.TL]} />
            <View style={[s.corner, s.TR]} />
            <View style={[s.corner, s.BL]} />
            <View style={[s.corner, s.BR]} />
          </View>
          <Text style={s.hint}>
            {processing ? '처리 중...' : '가게에 붙어있는 QR을 스캔하세요'}
          </Text>
        </View>

        {processing && (
          <View style={s.processingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={s.processingText}>GPS 정밀 위치 확인 중...</Text>
          </View>
        )}
      </View>

      {/* 하단 안내 */}
      <View style={s.infoBox}>
        <Text style={s.infoTitle}>📍 방문 스탬프 적립 안내</Text>
        <Text style={s.infoText}>• 가게 카운터의 QR코드를 스캔하세요</Text>
        <Text style={s.infoText}>• 하루 1회 · 가게당 +50 UNNI + 스탬프 1개 적립</Text>
        <Text style={s.infoText}>• 가게 반경 200m 이내에서만 가능</Text>
        <Text style={s.infoText}>• 영수증 인증과 당일 중복 사용 불가</Text>
        <Text style={s.infoText}>• 스탬프 목표 달성 시 가게 리워드 제공</Text>
      </View>
    </SafeAreaView>
  );
}

function parseStoreQR(data: string): string | null {
  try {
    // 형식 1: unniepick://checkin?store=UUID
    if (data.startsWith('unniepick://checkin')) {
      const url = new URL(data.replace('unniepick://', 'https://x.x/'));
      return url.searchParams.get('store');
    }
    // 형식 2: https://unniepick.app/checkin?store=UUID
    if (data.includes('/checkin?store=')) {
      const url = new URL(data);
      return url.searchParams.get('store');
    }
    return null;
  } catch {
    return null;
  }
}

const CORNER = 22;
const THICK  = 3;

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#111' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            padding: 20, paddingBottom: 12 },
  backText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  title:    { fontSize: 18, fontWeight: '800', color: '#fff' },
  camera:   { flex: 1, position: 'relative' },
  overlay:  { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: 24 },
  frame:    { width: 230, height: 230, position: 'relative' },
  corner:   { position: 'absolute', width: CORNER, height: CORNER,
              borderColor: COLORS.primary, borderWidth: THICK },
  TL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  TR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  BL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  BR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  hint: { color: '#fff', fontSize: 14, fontWeight: '500', textAlign: 'center', paddingHorizontal: 24 },
  processingOverlay: { position: 'absolute', inset: 0, backgroundColor: '#00000077',
                       alignItems: 'center', justifyContent: 'center', gap: 12 },
  processingText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  infoBox:  { backgroundColor: '#1a1a1a', padding: 20, gap: 6 },
  infoTitle:{ fontSize: 13, fontWeight: '800', color: '#fff', marginBottom: 4 },
  infoText: { fontSize: 12, color: '#aaa', lineHeight: 18 },
  permText: { color: '#fff', fontSize: 16 },
  permBtn:  { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 14 },
  permBtnText: { color: '#fff', fontWeight: '700' },
});
