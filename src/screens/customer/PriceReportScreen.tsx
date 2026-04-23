/**
 * PriceReportScreen — 고객 가격 제보
 *
 * 두 가지 제보 방식:
 *   A. 직접 입력: 메뉴명 + 가격 입력
 *   B. 영수증 촬영: Gemini Vision → JSON 구조화 → 항목 선택 → 일괄 제보
 *
 * route.params: { storeId: string, storeName: string }
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import { PALETTE } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

// ── 영수증 타입 ───────────────────────────────────────────────────
interface ReceiptItem {
  name:        string;
  quantity:    number;
  unit_price:  number;
  total_price: number;
  category:    string | null;
}

interface ReceiptData {
  store_name:            string | null;
  store_address:         string | null;
  store_phone:           string | null;
  store_business_number: string | null;
  receipt_date:          string | null;
  receipt_time:          string | null;
  receipt_number:        string | null;
  items:                 ReceiptItem[];
  subtotal:              number | null;
  discount:              number | null;
  tax:                   number | null;
  service_charge:        number | null;
  total:                 number | null;
  payment_method:        string | null;
  card_company:          string | null;
  card_last4:            string | null;
  approval_number:       string | null;
  installment:           string | null;
}

// ── 가격 프리셋 ───────────────────────────────────────────────────
const PRICE_PRESETS = [
  { label: '5,000원',  value: 5000  },
  { label: '6,000원',  value: 6000  },
  { label: '7,000원',  value: 7000  },
  { label: '8,000원',  value: 8000  },
  { label: '9,000원',  value: 9000  },
  { label: '10,000원', value: 10000 },
  { label: '12,000원', value: 12000 },
  { label: '15,000원', value: 15000 },
];


export default function PriceReportScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const insets     = useSafeAreaInsets();
  const { storeId, storeName } = route.params as { storeId: string; storeName: string };

  // ── 직접 입력 상태 ─────────────────────────────────────────────
  const [menuName,   setMenuName]   = useState('');
  const [priceStr,   setPriceStr]   = useState('');
  const [note,       setNote]       = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── 영수증 스캔 상태 ───────────────────────────────────────────
  const [scanLoading,      setScanLoading]      = useState(false);
  const [receiptData,      setReceiptData]       = useState<ReceiptData | null>(null);
  const [scanId,           setScanId]            = useState<string | null>(null);
  const [showReceiptSheet, setShowReceiptSheet]  = useState(false);
  const [selectedIdxs,     setSelectedIdxs]      = useState<Set<number>>(new Set());
  const [batchSubmitting,  setBatchSubmitting]   = useState(false);

  const price   = parseInt(priceStr.replace(/,/g, ''), 10);
  const isValid = menuName.trim().length > 0 && !isNaN(price) && price > 0;

  const handlePriceInput = (text: string) => {
    const nums = text.replace(/[^0-9]/g, '');
    if (!nums) { setPriceStr(''); return; }
    setPriceStr(Number(nums).toLocaleString());
  };

  // ── 중복 제보 체크 ─────────────────────────────────────────────
  const checkReportLimit = async (userId: string): Promise<boolean> => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('price_reports')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('user_id', userId)
      .gte('created_at', since);
    return (count ?? 0) < 10; // 영수증 제보는 10개까지
  };

  // ── A. 직접 제보 ───────────────────────────────────────────────
  const submitManual = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        Alert.alert('로그인 필요', '제보는 로그인 후 이용할 수 있어요.');
        return;
      }

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('price_reports')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .eq('user_id', session.user.id)
        .gte('created_at', since);

      if ((count ?? 0) >= 3) {
        Alert.alert('제보 한도 초과', '같은 가게에 24시간 내 최대 3회까지 제보할 수 있어요.');
        return;
      }

      const { error } = await supabase.from('price_reports').insert({
        store_id:  storeId,
        user_id:   session.user.id,
        menu_name: menuName.trim(),
        price,
        note:      note.trim() || null,
        status:    'active',
      });

      if (error) throw error;

      Alert.alert(
        '✅ 제보 완료!',
        '소중한 제보 감사해요 🙏\n검토 후 지도에 반영돼요.',
        [{ text: '확인', onPress: () => navigation.goBack() }],
      );
    } catch (e: any) {
      Alert.alert('오류', e?.message ?? '제보에 실패했어요. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── B. 영수증 촬영 ─────────────────────────────────────────────
  const openReceiptPicker = async () => {
    Alert.alert(
      '영수증 불러오기',
      '촬영하거나 갤러리에서 선택해주세요',
      [
        { text: '카메라 촬영', onPress: () => pickImage('camera') },
        { text: '갤러리 선택', onPress: () => pickImage('gallery') },
        { text: '취소', style: 'cancel' },
      ],
    );
  };

  const pickImage = async (source: 'camera' | 'gallery') => {
    let result: ImagePicker.ImagePickerResult;

    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('카메라 권한 필요', '설정에서 카메라 권한을 허용해주세요.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality:    0.4,  // 영수증 텍스트 인식에 충분, 토큰 절약
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('갤러리 권한 필요', '설정에서 사진 접근 권한을 허용해주세요.');
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality:    0.4,  // 영수증 텍스트 인식에 충분, 토큰 절약
      });
    }

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    if (!asset.uri) {
      Alert.alert('오류', '이미지를 불러올 수 없어요.');
      return;
    }

    await parseReceipt(asset.uri);
  };

  const parseReceipt = async (fileUri: string) => {
    setScanLoading(true);
    try {
      // 항상 세션 강제 갱신 — getSession()은 만료된 캐시 토큰을 반환할 수 있음
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr || !refreshed.session) {
        throw new Error('세션이 만료됐어요. 다시 로그인해주세요.');
      }
      const session = refreshed.session;

      // ── Storage에 이미지 업로드 ─────────────────────────────────
      const filePath   = `${session.user.id}/${Date.now()}.jpg`;
      const fileRes    = await fetch(fileUri);
      const arrayBuf   = await fileRes.arrayBuffer();

      const { error: uploadErr } = await supabase.storage
        .from('receipt-images')
        .upload(filePath, arrayBuf, { contentType: 'image/jpeg', upsert: false });

      if (uploadErr) throw new Error(`업로드 실패: ${uploadErr.message}`);

      // ── Edge Function에는 경로만 전달 (바디 크기 최소화) ─────────
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
      const { data, error } = await supabase.functions.invoke('parse-receipt', {
        body: {
          storagePath: filePath,
          store_id:    storeId,
          user_token:  session.access_token,
        },
        headers: { Authorization: `Bearer ${anonKey}` },
      });

      if (error) {
        // FunctionsHttpError → 실제 바디에서 에러 메시지 추출
        let errMsg = error.message ?? '알 수 없는 오류';
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) errMsg = body.error;
        } catch (_) {}
        throw new Error(errMsg);
      }
      if (!data?.receipt) throw new Error('영수증 인식에 실패했어요');

      const receipt: ReceiptData = data.receipt;

      // ── 7일 이내 영수증인지 검증 ──────────────────────────────
      if (receipt.receipt_date) {
        const receiptDate = new Date(receipt.receipt_date);
        const today       = new Date();
        today.setHours(23, 59, 59, 999);
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        if (receiptDate < sevenDaysAgo) {
          Alert.alert(
            '등록 불가',
            `발행일로부터 7일이 지난 영수증은 등록할 수 없어요.\n영수증 날짜: ${receipt.receipt_date}`,
          );
          return;
        }
        if (receiptDate > today) {
          Alert.alert('등록 불가', '영수증 날짜가 올바르지 않아요.');
          return;
        }
      }

      setReceiptData(receipt);
      setScanId(data.scan_id ?? null);

      // 기본적으로 전체 항목 선택
      const allIdxs = new Set<number>(receipt.items.map((_, i) => i));
      setSelectedIdxs(allIdxs);
      setShowReceiptSheet(true);
    } catch (e: any) {
      Alert.alert(
        '인식 실패',
        '영수증을 다시 촬영해주세요.\n' + (e?.message ?? ''),
      );
    } finally {
      setScanLoading(false);
    }
  };

  // ── B. 선택 항목 일괄 제보 ────────────────────────────────────
  const submitReceiptItems = async () => {
    if (!receiptData || selectedIdxs.size === 0) return;
    setBatchSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        Alert.alert('로그인 필요', '제보는 로그인 후 이용할 수 있어요.');
        return;
      }

      const ok = await checkReportLimit(session.user.id);
      if (!ok) {
        Alert.alert('제보 한도 초과', '같은 가게에 24시간 내 최대 10회까지 제보할 수 있어요.');
        return;
      }

      const selectedItems = Array.from(selectedIdxs).map(i => receiptData.items[i]);
      const menuNames     = selectedItems.map(i => i.name);

      // ── 기존 price_reports 조회 (같은 가게, 같은 메뉴) ──────────
      // created_at 기준으로 메뉴별 가장 최근 제보 날짜 확인
      const { data: existing } = await supabase
        .from('price_reports')
        .select('menu_name, created_at')
        .eq('store_id', storeId)
        .eq('status', 'active')
        .in('menu_name', menuNames)
        .order('created_at', { ascending: false });

      // 메뉴별 최신 created_at 맵
      const latestMap: Record<string, Date> = {};
      (existing ?? []).forEach(r => {
        if (!latestMap[r.menu_name]) {
          latestMap[r.menu_name] = new Date(r.created_at);
        }
      });

      // 영수증 날짜 (없으면 오늘)
      const receiptDateMs = receiptData.receipt_date
        ? new Date(receiptData.receipt_date).getTime()
        : Date.now();

      // 최신 날짜 우선: 기존 제보가 영수증보다 최신이면 제외
      const toInsert   = selectedItems.filter(item => {
        const existing = latestMap[item.name];
        return !existing || receiptDateMs >= existing.getTime();
      });
      const skipped    = selectedItems.filter(item => {
        const existing = latestMap[item.name];
        return existing && receiptDateMs < existing.getTime();
      });

      if (toInsert.length === 0) {
        Alert.alert(
          '등록 불가',
          `선택한 메뉴 모두 더 최신 가격 정보가 이미 등록되어 있어요.\n${skipped.map(i => `• ${i.name}`).join('\n')}`,
        );
        return;
      }

      const rows = toInsert.map(item => ({
        store_id:        storeId,
        user_id:         session.user.id,
        menu_name:       item.name,
        price:           item.unit_price,
        note:            null,
        status:          'active',
        receipt_scan_id: scanId ?? null,
      }));

      const { error } = await supabase.from('price_reports').insert(rows);
      if (error) throw error;

      setShowReceiptSheet(false);

      const skipMsg = skipped.length > 0
        ? `\n\n최신 정보 이미 존재 (${skipped.length}개 제외):\n${skipped.map(i => `• ${i.name}`).join('\n')}`
        : '';

      Alert.alert(
        '✅ 제보 완료!',
        `${toInsert.length}개 메뉴 제보 완료 🙏\n검토 후 지도에 반영돼요.${skipMsg}`,
        [{ text: '확인', onPress: () => navigation.goBack() }],
      );
    } catch (e: any) {
      Alert.alert('오류', e?.message ?? '제보에 실패했어요.');
    } finally {
      setBatchSubmitting(false);
    }
  };

  const toggleItem = (idx: number) => {
    setSelectedIdxs(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (!receiptData) return;
    if (selectedIdxs.size === receiptData.items.length) {
      setSelectedIdxs(new Set());
    } else {
      setSelectedIdxs(new Set(receiptData.items.map((_, i) => i)));
    }
  };

  // ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={s.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={s.headerMid}>
          <Text style={s.headerTitle}>가격 제보</Text>
          <Text style={s.headerSub}>{storeName}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 영수증 촬영 카드 */}
          <TouchableOpacity
            style={s.receiptCard}
            onPress={openReceiptPicker}
            activeOpacity={0.85}
            disabled={scanLoading}
          >
            {scanLoading ? (
              <>
                <ActivityIndicator color={PALETTE.orange500} size="small" />
                <View style={{ flex: 1 }}>
                  <Text style={s.receiptCardTitle}>영수증 분석 중...</Text>
                  <Text style={s.receiptCardDesc}>AI가 메뉴와 가격을 읽고 있어요</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={s.receiptCardEmoji}>🧾</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.receiptCardTitle}>영수증으로 제보</Text>
                  <Text style={s.receiptCardDesc}>촬영하면 AI가 메뉴·가격을 자동 추출해요</Text>
                </View>
                <View style={s.receiptCardBadge}>
                  <Text style={s.receiptCardBadgeText}>촬영</Text>
                </View>
              </>
            )}
          </TouchableOpacity>

          {/* 구분선 */}
          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>또는 직접 입력</Text>
            <View style={s.dividerLine} />
          </View>

          {/* 안내 */}
          <View style={s.infoCard}>
            <Text style={s.infoEmoji}>💰</Text>
            <Text style={s.infoDesc}>
              실제 방문 후 결제한 메뉴와 가격을 알려주세요.{'\n'}
              검토 후 지도에 반영돼요.
            </Text>
          </View>

          {/* 메뉴명 */}
          <View style={s.section}>
            <Text style={s.label}>메뉴명 <Text style={s.required}>*</Text></Text>
            <TextInput
              style={s.input}
              value={menuName}
              onChangeText={setMenuName}
              placeholder="예: 런치 세트, 아메리카노"
              placeholderTextColor={PALETTE.gray400}
              maxLength={50}
              returnKeyType="next"
            />
            <Text style={s.counter}>{menuName.length}/50</Text>
          </View>

          {/* 가격 */}
          <View style={s.section}>
            <Text style={s.label}>가격 <Text style={s.required}>*</Text></Text>
            <View style={s.priceInputWrap}>
              <TextInput
                style={[s.input, s.priceInput]}
                value={priceStr}
                onChangeText={handlePriceInput}
                placeholder="직접 입력"
                placeholderTextColor={PALETTE.gray400}
                keyboardType="number-pad"
                returnKeyType="done"
              />
              <Text style={s.priceUnit}>원</Text>
            </View>
            <View style={s.presetWrap}>
              {PRICE_PRESETS.map(p => {
                const active = priceStr === p.value.toLocaleString();
                return (
                  <TouchableOpacity
                    key={p.value}
                    style={[s.presetBtn, active && s.presetBtnActive]}
                    onPress={() => setPriceStr(p.value.toLocaleString())}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.presetText, active && s.presetTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 메모 */}
          <View style={s.section}>
            <Text style={s.label}>메모 <Text style={s.optional}>(선택)</Text></Text>
            <TextInput
              style={[s.input, s.textArea]}
              value={note}
              onChangeText={setNote}
              placeholder="예: 점심 특선 한정, 음료 포함 가격이에요"
              placeholderTextColor={PALETTE.gray400}
              multiline
              numberOfLines={3}
              maxLength={200}
              textAlignVertical="top"
            />
            <Text style={s.counter}>{note.length}/200</Text>
          </View>

          {/* 유의사항 */}
          <View style={s.noticeBox}>
            <Text style={s.noticeText}>
              • 허위/과장 제보는 반려될 수 있어요{'\n'}
              • 직접 입력: 24시간 내 최대 3회{'\n'}
              • 영수증 제보: 24시간 내 최대 10회{'\n'}
              • 검토 후 지도에 반영돼요 (보통 1일 이내)
            </Text>
          </View>
        </ScrollView>

        {/* 직접 제보 버튼 */}
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.submitBtn, (!isValid || submitting) && s.submitBtnDisabled]}
            onPress={submitManual}
            disabled={!isValid || submitting}
            activeOpacity={0.85}
          >
            <Text style={s.submitBtnText}>
              {submitting ? '제보 중...' : '💰 제보하기'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── 영수증 결과 바텀시트 (Modal) ── */}
      <Modal
        visible={showReceiptSheet}
        animationType="slide"
        transparent
        onRequestClose={() => setShowReceiptSheet(false)}
      >
        <View style={rs.overlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setShowReceiptSheet(false)}
          />
          <View style={[rs.sheet, { paddingBottom: insets.bottom + 16 }]}>
            {/* 드래그 핸들 */}
            <View style={rs.handle} />

            {/* 영수증 요약 헤더 */}
            {receiptData && (
              <View style={rs.receiptHeader}>
                <View style={rs.receiptHeaderLeft}>
                  <Text style={rs.storeName} numberOfLines={1}>
                    {receiptData.store_name ?? storeName}
                  </Text>
                  {receiptData.receipt_date && (
                    <Text style={rs.receiptDate}>
                      📅 {receiptData.receipt_date}
                      {receiptData.receipt_time ? `  ${receiptData.receipt_time}` : ''}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => setShowReceiptSheet(false)}
                  hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                >
                  <Text style={rs.closeBtn}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 전체 선택 토글 */}
            <View style={rs.selectAllRow}>
              <TouchableOpacity style={rs.selectAllBtn} onPress={toggleAll} activeOpacity={0.7}>
                <View style={[rs.checkbox, selectedIdxs.size === receiptData?.items.length && rs.checkboxChecked]}>
                  {selectedIdxs.size === receiptData?.items.length && (
                    <Text style={rs.checkmark}>✓</Text>
                  )}
                </View>
                <Text style={rs.selectAllText}>전체 선택</Text>
              </TouchableOpacity>
              <Text style={rs.selectedCount}>
                {selectedIdxs.size}/{receiptData?.items.length ?? 0}개 선택
              </Text>
            </View>

            {/* 항목 리스트 */}
            <ScrollView
              style={rs.itemList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {receiptData?.items.map((item, idx) => {
                const checked = selectedIdxs.has(idx);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[rs.itemRow, checked && rs.itemRowChecked]}
                    onPress={() => toggleItem(idx)}
                    activeOpacity={0.7}
                  >
                    <View style={[rs.checkbox, checked && rs.checkboxChecked]}>
                      {checked && <Text style={rs.checkmark}>✓</Text>}
                    </View>
                    <Text style={rs.itemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={rs.itemUnitPrice}>{item.unit_price.toLocaleString()}원</Text>
                  </TouchableOpacity>
                );
              })}

              <View style={{ height: 8 }} />
            </ScrollView>

            {/* 제보 버튼 */}
            <TouchableOpacity
              style={[
                rs.submitBtn,
                (selectedIdxs.size === 0 || batchSubmitting) && rs.submitBtnDisabled,
              ]}
              onPress={submitReceiptItems}
              disabled={selectedIdxs.size === 0 || batchSubmitting}
              activeOpacity={0.85}
            >
              <Text style={rs.submitBtnText}>
                {batchSubmitting
                  ? '제보 중...'
                  : `🧾 선택한 ${selectedIdxs.size}개 메뉴 제보하기`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── 메인 스타일 ───────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: PALETTE.gray100 },
  scroll: { flex: 1 },

  header: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: 8,
    paddingVertical:   8,
    backgroundColor:  '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.gray150,
  },
  backBtn: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 28, lineHeight: 32, color: PALETTE.gray900,
    fontFamily: 'WantedSans-Bold',
  },
  headerMid:  { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontFamily: 'WantedSans-ExtraBold', fontSize: 17,
    color: PALETTE.gray900, letterSpacing: -0.3,
  },
  headerSub: {
    fontFamily: 'WantedSans-Medium', fontSize: 12,
    color: PALETTE.gray500, marginTop: 2,
  },

  // 영수증 카드
  receiptCard: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:             12,
    margin:          16,
    padding:         16,
    backgroundColor: '#FFFFFF',
    borderRadius:    16,
    borderWidth:     2,
    borderColor:     PALETTE.orange500,
  },
  receiptCardEmoji: { fontSize: 32, lineHeight: 38 },
  receiptCardTitle: {
    fontFamily: 'WantedSans-ExtraBold', fontSize: 15,
    color: PALETTE.gray900, letterSpacing: -0.3,
  },
  receiptCardDesc: {
    fontFamily: 'WantedSans-Medium', fontSize: 12,
    color: PALETTE.gray500, marginTop: 2,
  },
  receiptCardBadge: {
    backgroundColor: PALETTE.orange500, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  receiptCardBadgeText: {
    fontFamily: 'WantedSans-Bold', fontSize: 13, color: '#FFFFFF',
  },

  // 구분선
  dividerRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8, gap: 8,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: PALETTE.gray200 },
  dividerText: {
    fontFamily: 'WantedSans-Medium', fontSize: 12, color: PALETTE.gray400,
  },

  // 안내 카드
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginHorizontal: 16, marginBottom: 12,
    padding: 14,
    backgroundColor: PALETTE.orange50,
    borderRadius: 12,
    borderWidth: 1, borderColor: PALETTE.orange500 + '33',
  },
  infoEmoji: { fontSize: 22, lineHeight: 28 },
  infoDesc: {
    fontFamily: 'WantedSans-Medium', fontSize: 12,
    color: PALETTE.gray700, lineHeight: 18, flex: 1,
  },

  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: PALETTE.gray150,
  },
  label: {
    fontFamily: 'WantedSans-ExtraBold', fontSize: 14,
    color: PALETTE.gray900, letterSpacing: -0.2, marginBottom: 10,
  },
  required: { color: PALETTE.orange500 },
  optional: {
    fontFamily: 'WantedSans-Medium', fontSize: 12,
    color: PALETTE.gray400, fontWeight: '400',
  },
  input: {
    borderWidth: 1.5, borderColor: PALETTE.gray200, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: PALETTE.gray900,
    fontFamily: 'WantedSans-Medium', backgroundColor: PALETTE.gray100,
  },
  textArea: { minHeight: 80, paddingTop: 12 },
  priceInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceInput:     { flex: 1 },
  priceUnit: {
    fontFamily: 'WantedSans-Bold', fontSize: 15,
    color: PALETTE.gray700, flexShrink: 0,
  },
  presetWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12,
  },
  presetBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: PALETTE.gray100,
    borderWidth: 1.5, borderColor: PALETTE.gray200,
  },
  presetBtnActive:  { backgroundColor: PALETTE.orange50, borderColor: PALETTE.orange500 },
  presetText:       { fontFamily: 'WantedSans-Bold', fontSize: 13, color: PALETTE.gray600 },
  presetTextActive: { color: PALETTE.orange500 },
  counter: {
    fontFamily: 'WantedSans-Medium', fontSize: 11,
    color: PALETTE.gray400, textAlign: 'right', marginTop: 6,
  },
  noticeBox: {
    marginHorizontal: 16, marginBottom: 16,
    padding: 14, backgroundColor: PALETTE.gray100, borderRadius: 10,
  },
  noticeText: {
    fontFamily: 'WantedSans-Medium', fontSize: 12,
    color: PALETTE.gray500, lineHeight: 20,
  },
  footer: {
    padding: 16, backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: PALETTE.gray150,
  },
  submitBtn: {
    backgroundColor: PALETTE.orange500, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: PALETTE.gray300 },
  submitBtnText: {
    fontFamily: 'WantedSans-ExtraBold', fontSize: 16,
    color: '#FFFFFF', letterSpacing: -0.3,
  },
});

// ── 영수증 바텀시트 스타일 ─────────────────────────────────────────
const rs = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12,
    maxHeight: '85%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#DEE2E6',
    alignSelf: 'center', marginBottom: 12,
  },

  // 영수증 요약 헤더
  receiptHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#F1F3F5',
    gap: 8,
  },
  receiptHeaderLeft: { flex: 1, gap: 4 },
  storeName: {
    fontFamily: 'WantedSans-ExtraBold', fontSize: 18,
    color: '#191F28', letterSpacing: -0.5,
  },
  receiptDate: {
    fontFamily: 'WantedSans-Medium', fontSize: 12, color: '#4E5968',
  },
  closeBtn: { fontSize: 18, color: '#8B95A1', paddingLeft: 4, paddingTop: 2 },

  // 전체 선택
  selectAllRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F1F3F5',
  },
  selectAllBtn:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectAllText: {
    fontFamily: 'WantedSans-Bold', fontSize: 14, color: '#333D4B',
  },
  selectedCount: {
    fontFamily: 'WantedSans-Medium', fontSize: 12, color: '#8B95A1',
  },

  // 항목 리스트
  itemList: { flex: 1 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECEF',
  },
  itemRowChecked: { backgroundColor: PALETTE.orange50 },
  itemName: {
    fontFamily: 'WantedSans-Bold', fontSize: 14, color: '#191F28',
    letterSpacing: -0.2, flex: 1,
  },
  itemUnitPrice: {
    fontFamily: 'WantedSans-ExtraBold', fontSize: 14, color: '#191F28', flexShrink: 0,
  },

  // 체크박스
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: '#DEE2E6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: PALETTE.orange500, borderColor: PALETTE.orange500,
  },
  checkmark: {
    fontSize: 13, fontWeight: '900', color: '#FFFFFF', lineHeight: 16,
  },

  // 제보 버튼
  submitBtn: {
    marginHorizontal: 16, marginTop: 8,
    backgroundColor: PALETTE.orange500,
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: '#CED4DA' },
  submitBtnText: {
    fontFamily: 'WantedSans-ExtraBold', fontSize: 16,
    color: '#FFFFFF', letterSpacing: -0.3,
  },
});
