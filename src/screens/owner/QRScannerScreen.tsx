import React, { useState } from 'react';
import {
  View, Text, StyleSheet,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, RADIUS } from '../../constants/theme';
import { useCoupon } from '../../lib/services/couponService';
import { addStamp } from '../../lib/services/stampService';
import { fetchStores } from '../../lib/services/storeService';

type ScanMode = 'coupon' | 'stamp';

export default function QRScannerScreen() {
  const navigation = useNavigation<any>();
  const [mode, setMode] = useState<ScanMode>('coupon');
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true);

    try {
      if (mode === 'coupon') {
        // QR 토큰으로 쿠폰 사용 처리
        const result = await useCoupon(data);
        Alert.alert(
          result.success ? '✅ 쿠폰 사용 완료' : '❌ 사용 불가',
          result.message,
          [{ text: '확인', onPress: () => setScanned(false) }]
        );
      } else {
        // 스탬프 적립 (QR 토큰에서 userId 파싱)
        // 형식: MATZIP_STAMP_{userId}
        const userId = data.replace('MATZIP_STAMP_', '');
        const stores = await fetchStores();
        if (stores.length === 0) throw new Error('가맹점 정보 없음');

        const { stampCard, isRewardIssued } = await addStamp(userId, stores[0].id, 'owner');

        Alert.alert(
          isRewardIssued ? '🎉 리워드 발급!' : '🍀 스탬프 적립 완료',
          isRewardIssued
            ? `스탬프 완성! 리워드 쿠폰이 자동 발급됐어요`
            : `현재 스탬프: ${stampCard.stamp_count}/${stampCard.required_count}개`,
          [{ text: '확인', onPress: () => setScanned(false) }]
        );
      }
    } catch (e: any) {
      Alert.alert('오류', e.message ?? 'QR 처리 중 오류가 발생했어요', [
        { text: '확인', onPress: () => setScanned(false) },
      ]);
    } finally {
      setProcessing(false);
    }
  };

  // 카메라 권한 없음
  if (!permission) return <View style={styles.safe} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>카메라 권한이 필요해요</Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>권한 허용하기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.title}>QR 스캔</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* 모드 선택 */}
      <View style={styles.modeRow}>
        {(['coupon', 'stamp'] as ScanMode[]).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
            onPress={() => { setMode(m); setScanned(false); }}
          >
            <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
              {m === 'coupon' ? '🎟 쿠폰 사용' : '🍀 스탬프 적립'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 카메라 */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />

        {/* 스캔 프레임 오버레이 */}
        <View style={styles.overlay}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <Text style={styles.scanHint}>
            {processing
              ? '처리 중...'
              : mode === 'coupon'
              ? '고객의 쿠폰 QR을 프레임에 맞추세요'
              : '고객의 스탬프 QR을 프레임에 맞추세요'}
          </Text>
        </View>

        {processing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color={COLORS.white} />
          </View>
        )}
      </View>

      {/* 재스캔 버튼 */}
      {scanned && !processing && (
        <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)}>
          <Text style={styles.rescanText}>다시 스캔하기</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#111' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, paddingBottom: 12,
  },
  backText: { fontSize: 16, color: COLORS.white, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  modeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 16 },
  modeBtn: {
    flex: 1, padding: 12, borderRadius: RADIUS.md,
    alignItems: 'center', backgroundColor: '#333',
  },
  modeBtnActive: { backgroundColor: COLORS.primary },
  modeBtnText: { fontSize: 14, fontWeight: '600', color: '#999' },
  modeBtnTextActive: { color: COLORS.white },
  cameraContainer: { flex: 1, position: 'relative' },
  camera: { flex: 1 },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', gap: 24,
  },
  scanFrame: {
    width: 220, height: 220, position: 'relative',
  },
  corner: {
    position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE,
    borderColor: COLORS.primary, borderWidth: CORNER_THICKNESS,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanHint: { color: COLORS.white, fontSize: 14, fontWeight: '500', textAlign: 'center' },
  processingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#00000077', alignItems: 'center', justifyContent: 'center',
  },
  rescanBtn: {
    margin: 20, backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md, padding: 16, alignItems: 'center',
  },
  rescanText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  permissionContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  permissionText: { color: COLORS.white, fontSize: 16 },
  permissionBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 14,
  },
  permissionBtnText: { color: COLORS.white, fontWeight: '700' },
});
