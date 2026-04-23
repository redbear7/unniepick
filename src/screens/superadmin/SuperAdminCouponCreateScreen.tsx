import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
  ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';
import {
  CouponKind, COUPON_KIND_CONFIG,
  createCoupon, fetchAllStores, StoreSimple,
} from '../../lib/services/couponService';

type DiscountType = 'percent' | 'amount';

export default function SuperAdminCouponCreateScreen() {
  const navigation = useNavigation<any>();

  // 가게 선택
  const [stores,          setStores]          = useState<StoreSimple[]>([]);
  const [storesLoading,   setStoresLoading]   = useState(true);
  const [selectedStore,   setSelectedStore]   = useState<StoreSimple | null>(null);
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [storeSearch,     setStoreSearch]     = useState('');

  // 쿠폰 폼
  const [couponKind,        setCouponKind]        = useState<CouponKind>('regular');
  const [title,             setTitle]             = useState('');
  const [description,       setDescription]       = useState('');
  const [discountType,      setDiscountType]       = useState<DiscountType>('percent');
  const [discountValue,     setDiscountValue]     = useState('');
  const [quantity,          setQuantity]          = useState('');
  const [expiresAt,         setExpiresAt]         = useState('');
  const [experienceOffer,   setExperienceOffer]   = useState('');
  const [experienceMission, setExperienceMission] = useState('');
  const [saving,            setSaving]            = useState(false);

  const isExperience = couponKind === 'experience';

  useEffect(() => {
    fetchAllStores()
      .then(setStores)
      .catch(() => Alert.alert('오류', '가게 목록을 불러오지 못했어요'))
      .finally(() => setStoresLoading(false));
  }, []);

  const filteredStores = stores.filter(s =>
    s.name.includes(storeSearch) || s.category.includes(storeSearch)
  );

  const handleCreate = async () => {
    if (!selectedStore) { Alert.alert('가게를 선택해주세요'); return; }
    if (!title.trim())  { Alert.alert('쿠폰 제목을 입력해주세요'); return; }
    if (!quantity)      { Alert.alert('발급 수량을 입력해주세요'); return; }
    if (!expiresAt)     { Alert.alert('유효기간을 입력해주세요'); return; }
    if (!isExperience && !discountValue) {
      Alert.alert('할인 금액/율을 입력해주세요'); return;
    }
    if (isExperience && (!experienceOffer || !experienceMission)) {
      Alert.alert('체험단 제공 내용과 미션을 입력해주세요'); return;
    }

    setSaving(true);
    try {
      await createCoupon({
        ownerId:          selectedStore.owner_id,
        storeId:          selectedStore.id,
        couponKind,
        title:            title.trim(),
        description:      description.trim(),
        discountType,
        discountValue:    isExperience ? 0 : Number(discountValue),
        totalQuantity:    Number(quantity),
        expiresAt,
        experienceOffer:  isExperience ? experienceOffer : undefined,
        experienceMission:isExperience ? experienceMission : undefined,
      });
      Alert.alert('쿠폰 발행 완료!', `"${selectedStore.name}"에 "${title}" 쿠폰이 등록됐어요 🎉`, [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('오류', e.message ?? '쿠폰 발행에 실패했어요');
    } finally {
      setSaving(false);
    }
  };

  const kindColor = COUPON_KIND_CONFIG[couponKind];

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* 헤더 */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={s.backText}>← 뒤로</Text>
          </TouchableOpacity>
          <Text style={s.title}>🎟 쿠폰 발행</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.container}>

          {/* ── 가게 선택 ── */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>가게 선택 *</Text>
            <TouchableOpacity
              style={[s.storePicker, selectedStore && s.storePickerSelected]}
              onPress={() => setStorePickerOpen(true)}
              activeOpacity={0.8}
            >
              {storesLoading ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : selectedStore ? (
                <View style={s.storePickerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.storePickerName}>{selectedStore.name}</Text>
                    <Text style={s.storePickerCat}>{selectedStore.category}</Text>
                  </View>
                  <Text style={s.storePickerChange}>변경 ›</Text>
                </View>
              ) : (
                <Text style={s.storePickerPlaceholder}>가게를 선택하세요 ›</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ── 쿠폰 종류 ── */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>쿠폰 종류 *</Text>
            <View style={s.kindRow}>
              {(Object.entries(COUPON_KIND_CONFIG) as [CouponKind, typeof COUPON_KIND_CONFIG[CouponKind]][]).map(([key, cfg]) => (
                <TouchableOpacity
                  key={key}
                  style={[s.kindBtn, couponKind === key && { backgroundColor: cfg.bg, borderColor: cfg.bg }]}
                  onPress={() => setCouponKind(key)}
                >
                  <Text style={s.kindEmoji}>{cfg.emoji}</Text>
                  <Text style={[s.kindLabel, couponKind === key && { color: '#fff', fontFamily: 'WantedSans-ExtraBold', fontWeight: '800' }]}>
                    {cfg.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── 쿠폰 정보 ── */}
          <View style={[s.section, SHADOW.card]}>

            <Field label="쿠폰 제목 *">
              <TextInput style={s.input} value={title} onChangeText={setTitle}
                placeholder="예) 삼겹살 세트 20% 할인" placeholderTextColor={COLORS.textMuted} />
            </Field>

            <Field label="설명">
              <TextInput style={s.input} value={description} onChangeText={setDescription}
                placeholder="예) 2인 세트 메뉴 주문 시 적용" placeholderTextColor={COLORS.textMuted} />
            </Field>

            {isExperience ? (
              <>
                <Field label="체험단 제공 *">
                  <TextInput style={s.input} value={experienceOffer} onChangeText={setExperienceOffer}
                    placeholder="예) 2인 코스 메뉴 무료 제공 (7만원 상당)"
                    placeholderTextColor={COLORS.textMuted} maxLength={80} />
                  <Text style={s.charCount}>{experienceOffer.length}/80자</Text>
                </Field>
                <Field label="체험단 미션 *">
                  <TextInput style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
                    value={experienceMission} onChangeText={setExperienceMission}
                    placeholder={'예) 네이버 영수증 리뷰 + 인스타그램 스토리 태그 필수'}
                    placeholderTextColor={COLORS.textMuted} multiline maxLength={200} />
                  <Text style={s.charCount}>{experienceMission.length}/200자</Text>
                </Field>
              </>
            ) : (
              <>
                <Field label="할인 유형 *">
                  <View style={s.typeRow}>
                    {(['percent', 'amount'] as DiscountType[]).map(t => (
                      <TouchableOpacity key={t}
                        style={[s.typeBtn, discountType === t && s.typeBtnActive]}
                        onPress={() => setDiscountType(t)}
                      >
                        <Text style={[s.typeBtnText, discountType === t && s.typeBtnTextActive]}>
                          {t === 'percent' ? '% 할인' : '금액 할인'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Field>
                <Field label={discountType === 'percent' ? '할인율 (%) *' : '할인 금액 (원) *'}>
                  <TextInput style={s.input} value={discountValue} onChangeText={setDiscountValue}
                    placeholder={discountType === 'percent' ? '예) 20' : '예) 3000'}
                    placeholderTextColor={COLORS.textMuted} keyboardType="numeric" />
                </Field>
              </>
            )}

            <Field label="발급 수량 *">
              <TextInput style={s.input} value={quantity} onChangeText={setQuantity}
                placeholder="예) 100" placeholderTextColor={COLORS.textMuted} keyboardType="numeric" />
            </Field>

            <Field label="유효기간 * (YYYY-MM-DD)">
              <TextInput style={s.input} value={expiresAt} onChangeText={setExpiresAt}
                placeholder="예) 2026-12-31" placeholderTextColor={COLORS.textMuted} />
            </Field>
          </View>

          {/* 발행 버튼 */}
          <TouchableOpacity
            style={[s.createBtn, { backgroundColor: kindColor.bg }, saving && { opacity: 0.7 }]}
            onPress={handleCreate}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.createBtnText}>{kindColor.emoji} 쿠폰 발행하기</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── 가게 선택 모달 ── */}
      <Modal visible={storePickerOpen} animationType="slide" transparent>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <View style={m.sheetHeader}>
              <Text style={m.sheetTitle}>가게 선택</Text>
              <TouchableOpacity onPress={() => setStorePickerOpen(false)}>
                <Text style={m.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={m.search}
              value={storeSearch}
              onChangeText={setStoreSearch}
              placeholder="가게명 또는 업종 검색"
              placeholderTextColor="#aaa"
            />
            <FlatList
              data={filteredStores}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[m.storeItem, selectedStore?.id === item.id && m.storeItemSelected]}
                  onPress={() => { setSelectedStore(item); setStorePickerOpen(false); setStoreSearch(''); }}
                >
                  <Text style={m.storeItemName}>{item.name}</Text>
                  <Text style={m.storeItemCat}>{item.category}</Text>
                  {selectedStore?.id === item.id && <Text style={m.checkMark}>✓</Text>}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={m.emptyText}>
                  {storesLoading ? '불러오는 중...' : '가게가 없어요'}
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontFamily: 'WantedSans-Bold', fontWeight: '700', color: COLORS.text }}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#1A1A2E' },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
               padding: 20, paddingBottom: 8 },
  backText:  { fontSize: 16, color: '#4A90D9', fontFamily: 'WantedSans-SemiBold', fontWeight: '600' },
  title:     { fontSize: 18, fontFamily: 'WantedSans-ExtraBold', fontWeight: '800', color: '#fff' },
  container: { padding: 16, gap: 16, paddingBottom: 40 },

  section:   { backgroundColor: '#16213E', borderRadius: RADIUS.lg, padding: 16,
               gap: 14, borderWidth: 1, borderColor: '#0F3460' },
  sectionLabel: { fontSize: 13, fontFamily: 'WantedSans-Bold', fontWeight: '700', color: '#aaa' },

  // 가게 선택
  storePicker: { borderWidth: 1.5, borderColor: '#0F3460', borderRadius: RADIUS.md,
                 padding: 14, backgroundColor: '#0F3460', minHeight: 50, justifyContent: 'center' },
  storePickerSelected: { borderColor: '#4A90D9' },
  storePickerRow: { flexDirection: 'row', alignItems: 'center' },
  storePickerName: { fontSize: 15, fontFamily: 'WantedSans-ExtraBold', fontWeight: '800', color: '#fff' },
  storePickerCat:  { fontSize: 12, color: '#aaa', marginTop: 2 },
  storePickerChange:    { fontSize: 13, color: '#4A90D9', fontFamily: 'WantedSans-Bold', fontWeight: '700' },
  storePickerPlaceholder: { fontSize: 14, color: '#555' },

  // 쿠폰 종류
  kindRow: { flexDirection: 'row', gap: 8 },
  kindBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 4, borderRadius: RADIUS.md,
             alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: '#0F3460',
             backgroundColor: '#0F3460' },
  kindEmoji: { fontSize: 18 },
  kindLabel: { fontSize: 10, fontFamily: 'WantedSans-SemiBold', fontWeight: '600', color: '#aaa', textAlign: 'center' },

  // 입력
  input: { borderWidth: 1.5, borderColor: '#0F3460', borderRadius: RADIUS.md,
           padding: 12, fontSize: 15, color: '#fff', backgroundColor: '#0F3460' },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: { flex: 1, padding: 12, borderRadius: RADIUS.md, alignItems: 'center',
             borderWidth: 1.5, borderColor: '#0F3460', backgroundColor: '#0F3460' },
  typeBtnActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeBtnText:       { fontSize: 14, fontFamily: 'WantedSans-SemiBold', fontWeight: '600', color: '#aaa' },
  typeBtnTextActive: { color: '#fff' },
  charCount: { fontSize: 11, color: '#555', textAlign: 'right' },

  createBtn: { borderRadius: RADIUS.lg, padding: 18, alignItems: 'center', marginTop: 4 },
  createBtnText: { color: '#fff', fontSize: 17, fontFamily: 'WantedSans-ExtraBold', fontWeight: '800' },
});

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: '#16213E', borderTopLeftRadius: 20, borderTopRightRadius: 20,
             maxHeight: '75%', borderTopWidth: 1, borderColor: '#0F3460' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                 padding: 20, paddingBottom: 12 },
  sheetTitle: { fontSize: 17, fontFamily: 'WantedSans-ExtraBold', fontWeight: '800', color: '#fff' },
  sheetClose: { fontSize: 18, color: '#aaa', padding: 4 },
  search: { marginHorizontal: 16, marginBottom: 8, padding: 12,
            borderWidth: 1.5, borderColor: '#0F3460', borderRadius: RADIUS.md,
            backgroundColor: '#0F3460', color: '#fff', fontSize: 14 },
  storeItem: { flexDirection: 'row', alignItems: 'center', gap: 8,
               paddingHorizontal: 20, paddingVertical: 14,
               borderBottomWidth: 1, borderBottomColor: '#0F3460' },
  storeItemSelected: { backgroundColor: '#4A90D922' },
  storeItemName: { flex: 1, fontSize: 15, fontFamily: 'WantedSans-Bold', fontWeight: '700', color: '#fff' },
  storeItemCat:  { fontSize: 12, color: '#aaa' },
  checkMark: { fontSize: 16, color: '#4A90D9', fontFamily: 'WantedSans-ExtraBold', fontWeight: '800' },
  emptyText: { textAlign: 'center', color: '#555', padding: 24, fontSize: 14 },
});
