/**
 * LocationPickerSheet — 위치 선택 바텀시트
 *
 * · 현재 GPS 위치 (실시간)
 * · 저장된 위치 최대 4개 (이름 수정 / 삭제)
 * · "현재 위치 저장" → 이름 입력 → DB 저장
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../lib/supabase';
import { PALETTE } from '../../constants/theme';

const MAX_SAVED = 4;
const ORANGE    = '#FF6F0F';
const GRAY900   = '#191F28';
const GRAY500   = '#8B95A1';
const GRAY150   = '#EAECEF';
const GRAY100   = '#F2F4F6';

// 역지오코딩 → 동 이름 반환
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const [r] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    return r?.district ?? r?.subregion ?? r?.city ?? '현재 위치';
  } catch {
    return '현재 위치';
  }
}

export interface SavedLocation {
  id:           string;
  label:        string;
  latitude:     number;
  longitude:    number;
  address_hint: string | null;
  display_order: number;
}

export interface SelectedLocation {
  type:      'current' | 'saved';
  label:     string;
  lat:       number;
  lng:       number;
  savedId?:  string;
}

interface Props {
  visible:        boolean;
  onClose:        () => void;
  currentGPS:     { lat: number; lng: number } | null;
  onSelect:       (loc: SelectedLocation) => void;
  selectedLocId?: string | null;  // 현재 선택된 저장 위치 ID ('current'면 null)
}

export default function LocationPickerSheet({
  visible, onClose, currentGPS, onSelect, selectedLocId,
}: Props) {
  const slideAnim = useRef(new Animated.Value(500)).current;
  const scrollRef = useRef<ScrollView>(null);

  const [savedLocs,   setSavedLocs]   = useState<SavedLocation[]>([]);
  const [currentName, setCurrentName] = useState('현재 위치');
  const [loadingGPS,  setLoadingGPS]  = useState(false);

  // 저장 폼 상태
  const [saveMode,    setSaveMode]    = useState(false);
  const [savingLabel, setSavingLabel] = useState('');
  const [saving,      setSaving]      = useState(false);

  // 이름 수정 상태
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [editLabel,   setEditLabel]   = useState('');

  // ── 슬라이드 애니메이션 ─────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue:       0,
        useNativeDriver: true,
        speed:         20,
        bounciness:    4,
      }).start();
      loadSaved();
    } else {
      Animated.timing(slideAnim, {
        toValue:         500,
        duration:        200,
        useNativeDriver: true,
      }).start();
      setSaveMode(false);
      setEditingId(null);
    }
  }, [visible]);

  // 현재 위치 이름
  useEffect(() => {
    if (!currentGPS) return;
    reverseGeocode(currentGPS.lat, currentGPS.lng).then(setCurrentName);
  }, [currentGPS]);

  // ── 저장 위치 로드 ─────────────────────────────────────────────
  const loadSaved = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('user_saved_locations')
      .select('*')
      .eq('user_id', session.user.id)
      .order('display_order', { ascending: true });
    setSavedLocs(data ?? []);
  }, []);

  // ── 현재 위치 저장 ─────────────────────────────────────────────
  const handleSaveCurrent = async () => {
    if (!currentGPS) {
      Alert.alert('위치 정보 없음', 'GPS 위치를 먼저 확인해주세요.');
      return;
    }
    if (savedLocs.length >= MAX_SAVED) {
      Alert.alert('저장 한도', `최대 ${MAX_SAVED}개까지 저장할 수 있어요.\n기존 위치를 삭제 후 다시 시도해주세요.`);
      return;
    }
    setSavingLabel(currentName);
    setSaveMode(true);
    // 키보드가 올라와도 입력폼이 보이도록 스크롤
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const confirmSave = async () => {
    const label = savingLabel.trim();
    if (!label) { Alert.alert('이름을 입력해주세요'); return; }
    if (!currentGPS) return;

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('user_saved_locations')
        .insert({
          user_id:       session.user.id,
          label,
          latitude:      currentGPS.lat,
          longitude:     currentGPS.lng,
          address_hint:  currentName,
          display_order: savedLocs.length,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          Alert.alert('이미 같은 이름이 있어요', '다른 이름을 입력해주세요.');
        } else {
          throw error;
        }
        return;
      }

      setSaveMode(false);
      await loadSaved();
      // 저장 후 바로 선택
      onSelect({ type: 'saved', label, lat: currentGPS.lat, lng: currentGPS.lng, savedId: data.id });
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message ?? '다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  // ── 이름 수정 ──────────────────────────────────────────────────
  const startEdit = (loc: SavedLocation) => {
    setEditingId(loc.id);
    setEditLabel(loc.label);
  };

  const confirmEdit = async (id: string) => {
    const label = editLabel.trim();
    if (!label) return;
    try {
      await supabase
        .from('user_saved_locations')
        .update({ label })
        .eq('id', id);
      setEditingId(null);
      await loadSaved();
    } catch (e: any) {
      Alert.alert('수정 실패', e?.message);
    }
  };

  // ── 삭제 ──────────────────────────────────────────────────────
  const handleDelete = (loc: SavedLocation) => {
    Alert.alert(
      `"${loc.label}" 삭제`,
      '저장된 위치를 삭제할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제', style: 'destructive',
          onPress: async () => {
            await supabase.from('user_saved_locations').delete().eq('id', loc.id);
            await loadSaved();
          },
        },
      ],
    );
  };

  // ── 위치 선택 ─────────────────────────────────────────────────
  const selectCurrent = () => {
    if (!currentGPS) {
      Alert.alert('위치 정보 없음', 'GPS 권한을 허용해주세요.');
      return;
    }
    onSelect({ type: 'current', label: currentName, lat: currentGPS.lat, lng: currentGPS.lng });
    onClose();
  };

  const selectSaved = (loc: SavedLocation) => {
    onSelect({
      type: 'saved', label: loc.label,
      lat: loc.latitude, lng: loc.longitude, savedId: loc.id,
    });
    onClose();
  };

  // 아이콘 매핑
  const labelIcon = (label: string) => {
    if (label.includes('집') || label.includes('home')) return '🏠';
    if (label.includes('근무') || label.includes('회사') || label.includes('직장')) return '🏢';
    if (label.includes('단골') || label.includes('카페')) return '☕';
    if (label.includes('학교')) return '🏫';
    return '📌';
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      {/* 딤 배경 */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* 핸들 */}
        <View style={s.handle} />

        {/* 헤더 */}
        <View style={s.header}>
          <Text style={s.headerTitle}>위치 선택</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Ionicons name="close" size={22} color={GRAY500} />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
            {/* ── 현재 위치 ── */}
            <TouchableOpacity
              style={[s.locRow, !selectedLocId && s.locRowSelected]}
              onPress={selectCurrent}
              activeOpacity={0.7}
            >
              <View style={[s.iconCircle, { backgroundColor: '#E8F5E9' }]}>
                <Text style={s.iconText}>📍</Text>
              </View>
              <View style={s.locInfo}>
                <Text style={s.locLabel}>현재 위치</Text>
                <Text style={s.locAddr}>{currentName}</Text>
              </View>
              {!selectedLocId && (
                <Ionicons name="checkmark-circle" size={22} color={ORANGE} />
              )}
            </TouchableOpacity>

            <View style={s.divider} />

            {/* ── 저장된 위치 목록 ── */}
            {savedLocs.map(loc => (
              <View key={loc.id}>
                {editingId === loc.id ? (
                  // 이름 수정 모드
                  <View style={s.editRow}>
                    <Text style={{ fontSize: 20 }}>{labelIcon(loc.label)}</Text>
                    <TextInput
                      style={s.editInput}
                      value={editLabel}
                      onChangeText={setEditLabel}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={() => confirmEdit(loc.id)}
                    />
                    <TouchableOpacity
                      style={s.editConfirmBtn}
                      onPress={() => confirmEdit(loc.id)}
                    >
                      <Text style={s.editConfirmText}>완료</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditingId(null)}>
                      <Ionicons name="close" size={20} color={GRAY500} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[s.locRow, selectedLocId === loc.id && s.locRowSelected]}
                    onPress={() => selectSaved(loc)}
                    activeOpacity={0.7}
                  >
                    <View style={[s.iconCircle, { backgroundColor: '#FFF3EB' }]}>
                      <Text style={s.iconText}>{labelIcon(loc.label)}</Text>
                    </View>
                    <View style={s.locInfo}>
                      <Text style={s.locLabel}>{loc.label}</Text>
                      {loc.address_hint && (
                        <Text style={s.locAddr} numberOfLines={1}>{loc.address_hint}</Text>
                      )}
                    </View>
                    <View style={s.locActions}>
                      {selectedLocId === loc.id && (
                        <Ionicons name="checkmark-circle" size={22} color={ORANGE} style={{ marginRight: 8 }} />
                      )}
                      <TouchableOpacity
                        style={s.actionIcon}
                        onPress={() => startEdit(loc)}
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                      >
                        <Ionicons name="pencil-outline" size={16} color={GRAY500} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.actionIcon}
                        onPress={() => handleDelete(loc)}
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF5350" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                )}
                <View style={s.divider} />
              </View>
            ))}

            {/* ── 현재 위치 저장 ── */}
            {savedLocs.length < MAX_SAVED && !saveMode && (
              <TouchableOpacity style={s.addBtn} onPress={handleSaveCurrent} activeOpacity={0.7}>
                <Ionicons name="add-circle-outline" size={20} color={ORANGE} />
                <Text style={s.addBtnText}>현재 위치 저장하기</Text>
                <Text style={s.addBtnCount}>{savedLocs.length}/{MAX_SAVED}</Text>
              </TouchableOpacity>
            )}

            {/* ── 저장 이름 입력 폼 ── */}
            {saveMode && (
              <View style={s.saveForm}>
                <Text style={s.saveFormTitle}>위치 이름 입력</Text>
                <Text style={s.saveFormAddr}>{currentName}</Text>
                <View style={s.saveInputRow}>
                  <TextInput
                    style={s.saveInput}
                    value={savingLabel}
                    onChangeText={setSavingLabel}
                    placeholder="예: 집, 근무지, 단골1"
                    placeholderTextColor={GRAY500}
                    autoFocus
                    maxLength={10}
                    returnKeyType="done"
                    onSubmitEditing={confirmSave}
                  />
                </View>
                <View style={s.saveFormBtns}>
                  <TouchableOpacity
                    style={s.cancelBtn}
                    onPress={() => setSaveMode(false)}
                  >
                    <Text style={s.cancelBtnText}>취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.confirmBtn, saving && { opacity: 0.6 }]}
                    onPress={confirmSave}
                    disabled={saving}
                  >
                    <Text style={s.confirmBtnText}>{saving ? '저장 중...' : '저장'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={{ height: 32 }} />
          </ScrollView>
        </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    maxHeight:       '92%',
    paddingBottom:   Platform.OS === 'ios' ? 44 : 24,
  },
  handle: {
    width: 40, height: 4, borderRadius: 4,
    backgroundColor: GRAY150,
    alignSelf: 'center',
    marginTop:    12,
    marginBottom: 4,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingVertical:   12,
    borderBottomWidth: 1,
    borderBottomColor: GRAY150,
  },
  headerTitle: {
    fontSize: 18, fontWeight: '800', color: GRAY900,
    fontFamily: 'WantedSans-ExtraBold',
  },

  // 위치 행
  locRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingVertical:   16,
    gap:               12,
    backgroundColor:   '#FFFFFF',
  },
  locRowSelected: {
    backgroundColor: '#FFF8F4',
  },
  iconCircle: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: { fontSize: 22 },
  locInfo: { flex: 1, minWidth: 0 },
  locLabel: {
    fontSize: 16, fontWeight: '700', color: GRAY900,
    fontFamily: 'WantedSans-Bold',
  },
  locAddr: {
    fontSize: 13, fontWeight: '500', color: GRAY500,
    marginTop: 3, fontFamily: 'WantedSans-Medium',
  },
  locActions: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  actionIcon: {
    width: 32, height: 32,
    alignItems: 'center', justifyContent: 'center',
  },

  divider: { height: 1, backgroundColor: GRAY100, marginLeft: 78 },

  // 수정 모드
  editRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingVertical:   12,
    gap:               10,
    backgroundColor:   '#FFFBF7',
  },
  editInput: {
    flex:            1,
    height:          44,
    backgroundColor: GRAY100,
    borderRadius:    8,
    paddingHorizontal: 12,
    fontSize:        15,
    fontWeight:      '600',
    color:           GRAY900,
    borderWidth:     1.5,
    borderColor:     ORANGE,
  },
  editConfirmBtn: {
    backgroundColor: ORANGE,
    borderRadius:    8,
    paddingHorizontal: 14,
    paddingVertical:    10,
  },
  editConfirmText: {
    fontSize: 14, fontWeight: '700', color: '#FFFFFF',
  },

  // 추가 버튼
  addBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 20,
    paddingVertical:   18,
  },
  addBtnText: {
    flex:       1,
    fontSize:   15, fontWeight: '700', color: ORANGE,
    fontFamily: 'WantedSans-Bold',
  },
  addBtnCount: {
    fontSize: 13, fontWeight: '600', color: GRAY500,
  },

  // 저장 폼
  saveForm: {
    margin:          16,
    padding:         18,
    backgroundColor: '#FFF8F4',
    borderRadius:    16,
    borderWidth:     1.5,
    borderColor:     ORANGE + '44',
    gap:             12,
  },
  saveFormTitle: {
    fontSize: 16, fontWeight: '800', color: GRAY900,
    fontFamily: 'WantedSans-ExtraBold',
  },
  saveFormAddr: {
    fontSize: 13, fontWeight: '500', color: GRAY500,
    fontFamily: 'WantedSans-Medium',
  },
  saveInputRow: { flexDirection: 'row', gap: 8 },
  saveInput: {
    flex:            1,
    height:          48,
    backgroundColor: '#FFFFFF',
    borderRadius:    10,
    paddingHorizontal: 14,
    fontSize:        15,
    fontWeight:      '600',
    color:           GRAY900,
    borderWidth:     1.5,
    borderColor:     ORANGE,
  },
  saveFormBtns: {
    flexDirection: 'row', gap: 8,
  },
  cancelBtn: {
    flex: 1, height: 46, borderRadius: 10,
    backgroundColor: GRAY100,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15, fontWeight: '700', color: GRAY500,
  },
  confirmBtn: {
    flex: 1, height: 46, borderRadius: 10,
    backgroundColor: ORANGE,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 15, fontWeight: '700', color: '#FFFFFF',
  },
});
