/**
 * MyLocationScreen — 내 위치(동네) 설정
 *
 * 1. GPS 감지 → 가장 가까운 상권 자동 추천
 * 2. 상권 목록에서 선택
 * 3. profiles.location_name 저장
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';

import { PALETTE } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { fetchDistricts, DistrictRow } from '../../lib/services/districtService';

// 두 좌표 사이 거리 (m)
function distanceM(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function MyLocationScreen() {
  const navigation = useNavigation<any>();

  const [districts,    setDistricts]    = useState<DistrictRow[]>([]);
  const [selected,     setSelected]     = useState<string | null>(null); // district.name
  const [current,      setCurrent]      = useState<string | null>(null); // 현재 저장된 값
  const [nearestId,    setNearestId]    = useState<string | null>(null); // GPS 추천
  const [loadingDist,  setLoadingDist]  = useState(true);
  const [loadingGPS,   setLoadingGPS]   = useState(false);
  const [saving,       setSaving]       = useState(false);

  // ── 상권 로드 + 현재 설정 로드 ────────────────────────────────
  const load = useCallback(async () => {
    setLoadingDist(true);
    try {
      const [distRows, sessRes] = await Promise.all([
        fetchDistricts(),
        supabase.auth.getSession(),
      ]);

      const active = distRows.filter(d => d.is_active);
      setDistricts(active);

      const uid = sessRes.data.session?.user?.id;
      if (uid) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('location_name')
          .eq('id', uid)
          .maybeSingle();
        if (prof?.location_name) {
          setCurrent(prof.location_name);
          setSelected(prof.location_name);
        }
      }
    } catch (e) {
      console.error('위치 설정 로드 실패:', e);
    } finally {
      setLoadingDist(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── GPS로 가장 가까운 상권 추천 ───────────────────────────────
  const detectNearest = async () => {
    setLoadingGPS(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('위치 권한 필요', '현재 위치를 감지하려면 위치 권한이 필요해요.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude: lat, longitude: lon } = loc.coords;

      // 상권 중 좌표 있는 것만
      const withCoords = districts.filter(d => d.latitude && d.longitude);
      if (!withCoords.length) return;

      let best: DistrictRow | null = null;
      let bestDist = Infinity;
      for (const d of withCoords) {
        const dm = distanceM(lat, lon, d.latitude!, d.longitude!);
        if (dm < bestDist) { bestDist = dm; best = d; }
      }

      if (best) {
        setNearestId(best.id);
        setSelected(best.name);
        Alert.alert(
          '📍 현재 위치 감지',
          `가장 가까운 상권: ${best.name}\n(${Math.round(bestDist)}m)\n\n이 상권으로 설정할까요?`,
          [
            { text: '취소', style: 'cancel', onPress: () => setNearestId(null) },
            { text: '설정', onPress: () => setSelected(best!.name) },
          ],
        );
      }
    } catch {
      Alert.alert('오류', '위치를 가져오지 못했어요. 수동으로 선택해주세요.');
    } finally {
      setLoadingGPS(false);
    }
  };

  // ── 저장 ─────────────────────────────────────────────────────
  const save = async () => {
    if (!selected) {
      Alert.alert('알림', '상권을 선택해주세요.');
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) throw new Error('로그인이 필요합니다.');

      const { error } = await supabase
        .from('profiles')
        .update({ location_name: selected })
        .eq('id', uid);
      if (error) throw error;

      Alert.alert('✅ 저장 완료', `"${selected}"이 내 동네로 설정됐어요!`, [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message ?? '다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  // ── 렌더 ─────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: DistrictRow }) => {
    const isSelected = selected === item.name;
    const isNearest  = nearestId === item.id;

    return (
      <TouchableOpacity
        style={[s.row, isSelected && s.rowSelected]}
        onPress={() => setSelected(item.name)}
        activeOpacity={0.7}
      >
        <View style={[s.radio, isSelected && s.radioSelected]}>
          {isSelected && <View style={s.radioDot} />}
        </View>
        <View style={s.rowText}>
          <Text style={[s.rowLabel, isSelected && s.rowLabelSelected]}>
            {item.name}
            {isNearest ? '  📍' : ''}
          </Text>
          {item.description ? (
            <Text style={s.rowDesc} numberOfLines={1}>{item.description}</Text>
          ) : null}
        </View>
        {isSelected && (
          <View style={s.checkBadge}>
            <Text style={s.checkText}>선택됨</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loadingDist) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <ActivityIndicator style={{ flex: 1 }} color={PALETTE.orange500} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={s.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>내 위치 설정</Text>
        {saving
          ? <ActivityIndicator size="small" color={PALETTE.orange500} style={{ marginLeft: 8 }} />
          : <View style={{ width: 44 }} />
        }
      </View>

      {/* GPS 감지 버튼 */}
      <View style={s.gpsWrap}>
        <TouchableOpacity
          style={[s.gpsBtn, loadingGPS && { opacity: 0.6 }]}
          onPress={detectNearest}
          disabled={loadingGPS}
          activeOpacity={0.8}
        >
          {loadingGPS
            ? <ActivityIndicator size="small" color={PALETTE.orange500} />
            : <Text style={s.gpsIcon}>📍</Text>
          }
          <Text style={s.gpsBtnText}>
            {loadingGPS ? '위치 감지 중...' : '현재 위치로 자동 찾기'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 현재 설정값 안내 */}
      {current && (
        <View style={s.currentWrap}>
          <Text style={s.currentLabel}>현재 설정</Text>
          <Text style={s.currentValue}>{current}</Text>
        </View>
      )}

      {/* 상권 목록 */}
      <Text style={s.listTitle}>상권 선택</Text>
      {districts.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>등록된 상권이 없어요.</Text>
        </View>
      ) : (
        <FlatList
          data={districts}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={s.divider} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* 저장 버튼 */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.saveBtn, !selected && s.saveBtnDisabled]}
          onPress={save}
          disabled={!selected || saving}
          activeOpacity={0.8}
        >
          <Text style={s.saveBtnText}>
            {selected ? `"${selected}" 로 설정하기` : '상권을 선택해주세요'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.gray100 },

  // 헤더
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: 16,
    paddingVertical:  12,
    backgroundColor: '#FFFFFF',
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
  headerTitle: {
    fontFamily:   'WantedSans-ExtraBold',
    fontSize:      18,
    color:         PALETTE.gray900,
    letterSpacing: -0.4,
  },

  // GPS 감지
  gpsWrap: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.gray150,
  },
  gpsBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:              8,
    backgroundColor: PALETTE.orange50,
    borderRadius:    12,
    borderWidth:     1.5,
    borderColor:     PALETTE.orange500,
    paddingHorizontal: 16,
    paddingVertical:   12,
    justifyContent:  'center',
  },
  gpsIcon: { fontSize: 18 },
  gpsBtnText: {
    fontFamily:  'WantedSans-Bold',
    fontSize:     14,
    color:        PALETTE.orange500,
    letterSpacing: -0.2,
  },

  // 현재 설정
  currentWrap: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: 20,
    paddingVertical:   12,
    backgroundColor: PALETTE.gray100,
    gap: 8,
  },
  currentLabel: {
    fontFamily:  'WantedSans-Medium',
    fontSize:     12,
    color:        PALETTE.gray500,
  },
  currentValue: {
    fontFamily:  'WantedSans-Bold',
    fontSize:     13,
    color:        PALETTE.orange500,
  },

  // 목록 제목
  listTitle: {
    fontFamily:    'WantedSans-Bold',
    fontSize:       11,
    color:          PALETTE.gray500,
    letterSpacing:  0.5,
    paddingHorizontal: 20,
    paddingTop:     16,
    paddingBottom:   8,
  },

  // 목록
  list: {
    backgroundColor: '#FFFFFF',
    borderTopWidth:    1,
    borderBottomWidth: 1,
    borderColor:       PALETTE.gray150,
  },
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: 20,
    paddingVertical:   16,
    gap:               12,
    backgroundColor: '#FFFFFF',
  },
  rowSelected: { backgroundColor: PALETTE.orange50 },

  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: PALETTE.gray300,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  radioSelected: { borderColor: PALETTE.orange500 },
  radioDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: PALETTE.orange500,
  },

  rowText: { flex: 1, minWidth: 0 },
  rowLabel: {
    fontFamily:   'WantedSans-Bold',
    fontSize:      15,
    color:         PALETTE.gray900,
    letterSpacing: -0.2,
  },
  rowLabelSelected: { color: PALETTE.orange500 },
  rowDesc: {
    fontFamily: 'WantedSans-Medium',
    fontSize:    12,
    color:       PALETTE.gray500,
    marginTop:   2,
  },
  checkBadge: {
    backgroundColor:   PALETTE.orange500,
    borderRadius:      8,
    paddingHorizontal: 8,
    paddingVertical:   3,
    flexShrink:        0,
  },
  checkText: {
    fontFamily:  'WantedSans-Bold',
    fontSize:     10,
    color:        '#FFFFFF',
    letterSpacing: 0.2,
  },

  divider: { height: 1, backgroundColor: PALETTE.gray100, marginLeft: 54 },

  // 빈 목록
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 14, color: PALETTE.gray500 },

  // 하단 버튼
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth:  1,
    borderTopColor:  PALETTE.gray150,
  },
  saveBtn: {
    backgroundColor: PALETTE.orange500,
    borderRadius:    14,
    paddingVertical: 16,
    alignItems:      'center',
  },
  saveBtnDisabled: {
    backgroundColor: PALETTE.gray300,
  },
  saveBtnText: {
    fontFamily:   'WantedSans-ExtraBold',
    fontSize:      16,
    color:         '#FFFFFF',
    letterSpacing: -0.3,
  },
});
