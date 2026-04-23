/**
 * DiscoverySettingsScreen — Spec 01 §05 자동 발견 설정
 *
 * • 근처 쿠폰 알림 메인 토글
 * • 감지 반경 슬라이더 (50/100/200/300/500m)
 * • Live Activity / 홈 위젯 토글
 * • 하루 최대 알림 횟수 (3회 고정, 표시용)
 * • 방해금지 시간대 (22:00 – 09:00)
 * • 카테고리별 알림 필터
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
// @react-native-community/slider 미설치 → 커스텀 스텝 피커 사용
import { supabase } from '../../lib/supabase';
import {
  getLocationSetting,
  upsertLocationSetting,
  UserLocationSetting,
} from '../../lib/services/couponWalletService';
import { PALETTE } from '../../constants/theme';

// 카테고리 메타
const CATS = [
  { key: 'cafe',   label: '카페', emoji: '☕' },
  { key: 'food',   label: '음식', emoji: '🍽' },
  { key: 'beauty', label: '미용', emoji: '✂️' },
  { key: 'nail',   label: '네일', emoji: '💅' },
];

// 반경 고정 단계 (50~500m)
const RADIUS_STEPS = [50, 100, 200, 300, 500];

// ── 섹션 헤더 ────────────────────────────────────────────────────
function SectionHead({ label }: { label: string }) {
  return <Text style={s.sectionHead}>{label}</Text>;
}

// ── 설정 행 ──────────────────────────────────────────────────────
function SettingRow({
  icon, label, desc, value, onToggle,
}: {
  icon?: string;
  label: string;
  desc?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <View style={s.row}>
      {icon && <Text style={s.rowIcon}>{icon}</Text>}
      <View style={s.rowBody}>
        <Text style={s.rowLabel}>{label}</Text>
        {desc && <Text style={s.rowDesc}>{desc}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: PALETTE.gray200, true: PALETTE.orange500 }}
        thumbColor={'#FFFFFF'}
        ios_backgroundColor={PALETTE.gray200}
      />
    </View>
  );
}

export default function DiscoverySettingsScreen() {
  const navigation = useNavigation<any>();
  const [loading,   setLoading]  = useState(true);
  const [saving,    setSaving]   = useState(false);
  const [setting,   setSetting]  = useState<UserLocationSetting | null>(null);
  // 위젯/Live Activity 토글 (로컬 상태, 별도 설정 없으면 enabled 기준)
  const [liveActOn, setLiveAct]  = useState(true);
  const [widgetOn,  setWidget]   = useState(true);

  // ── 로드 ────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) { setLoading(false); return; }
    try {
      const s = await getLocationSetting(session.user.id);
      setSetting(s);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── 저장 ────────────────────────────────────────────────────
  const save = async (updated: UserLocationSetting) => {
    setSetting(updated);
    setSaving(true);
    try {
      await upsertLocationSetting(updated);
    } catch {
      Alert.alert('저장 실패', '다시 시도해주세요');
    } finally {
      setSaving(false);
    }
  };

  const update = (patch: Partial<UserLocationSetting>) => {
    if (!setting) return;
    save({ ...setting, ...patch });
  };

  const toggleCat = (key: string) => {
    if (!setting) return;
    const current = setting.enabled_cats ?? CATS.map(c => c.key);
    const next = current.includes(key)
      ? current.filter(c => c !== key)
      : [...current, key];
    update({ enabled_cats: next.length === CATS.length ? null : next });
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <ActivityIndicator style={{ flex: 1 }} color={PALETTE.orange500} />
      </SafeAreaView>
    );
  }

  if (!setting) return null;

  const activeCats = setting.enabled_cats ?? CATS.map(c => c.key);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>자동 발견</Text>
        {saving && <ActivityIndicator size="small" color={PALETTE.orange500} style={{ marginLeft: 8 }} />}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}>

        {/* 메인 토글 카드 */}
        <View style={s.heroCard}>
          <View style={s.heroLeft}>
            <Text style={s.heroTitle}>근처 쿠폰 알림</Text>
            <Text style={s.heroDesc}>
              매장 근처 지나갈 때{'\n'}잠금화면에 알려드려요
            </Text>
          </View>
          <Switch
            value={setting.enabled}
            onValueChange={v => update({ enabled: v })}
            trackColor={{ false: PALETTE.gray500, true: PALETTE.orange500 }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={PALETTE.gray500}
          />
        </View>

        {/* 알림 범위 */}
        <SectionHead label="알림 범위" />
        <View style={s.card}>
          {/* 반경 스텝 피커 */}
          <View style={s.sliderRow}>
            <View style={s.sliderLabelRow}>
              <Text style={s.sliderLabel}>감지 반경</Text>
              <Text style={s.sliderValue}>{setting.radius_m}m</Text>
            </View>
            <Text style={s.sliderDesc}>이 거리 안에 들어오면 Live Activity가 뜹니다</Text>
            <View style={s.stepRow}>
              {RADIUS_STEPS.map(r => {
                const active = setting.radius_m === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[s.stepBtn, active && s.stepBtnActive]}
                    onPress={() => update({ radius_m: r })}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.stepBtnText, active && s.stepBtnTextActive]}>
                      {r}m
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 하루 최대 */}
          <View style={[s.infoRow, { marginTop: 16 }]}>
            <Text style={s.infoLabel}>하루 최대</Text>
            <Text style={s.infoValue}>3회</Text>
          </View>

          {/* 방해금지 */}
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>방해금지</Text>
            <Text style={s.infoValue}>{setting.quiet_start} – {setting.quiet_end}</Text>
          </View>
        </View>

        {/* 기능 토글 */}
        <SectionHead label="알림 방식" />
        <View style={s.card}>
          <SettingRow
            icon="🔔"
            label="Live Activity"
            desc="잠금화면·Dynamic Island에 표시"
            value={liveActOn}
            onToggle={setLiveAct}
          />
          <View style={s.divider} />
          <SettingRow
            icon="📱"
            label="홈 위젯"
            desc="홈스크린 위젯 15분마다 업데이트"
            value={widgetOn}
            onToggle={setWidget}
          />
        </View>

        {/* 카테고리 필터 */}
        <SectionHead label="카테고리" />
        <View style={s.catWrap}>
          {CATS.map(cat => {
            const active = activeCats.includes(cat.key);
            return (
              <TouchableOpacity
                key={cat.key}
                style={[s.catChip, active && s.catChipActive]}
                onPress={() => toggleCat(cat.key)}
                activeOpacity={0.75}
              >
                <Text style={s.catEmoji}>{cat.emoji}</Text>
                <Text style={[s.catLabel, active && s.catLabelActive]}>
                  {cat.label}
                </Text>
                {active && <Text style={s.catCheck}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 개인정보 */}
        <Text style={s.privacy}>
          위치 정보는 기기 안에서만 처리돼요. 반경 밖에서는 서버로 보내지 않습니다.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: PALETTE.gray100 },
  scroll: { flex: 1 },

  // 헤더
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: 20,
    paddingVertical:  12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.gray150,
  },
  backBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    marginRight: 8,
  },
  backBtnText: {
    fontFamily: 'WantedSans-Bold',
    fontSize:    28,
    lineHeight:  32,
    color:       PALETTE.gray900,
  },
  headerTitle: {
    flex: 1,
    fontFamily:   'WantedSans-ExtraBold',
    fontSize:      18,
    lineHeight:    24,
    color:         PALETTE.gray900,
    letterSpacing: -0.4,
  },

  // 메인 토글 카드
  heroCard: {
    margin:          16,
    padding:         20,
    backgroundColor: PALETTE.gray900,
    borderRadius:    16,
    flexDirection:   'row',
    alignItems:      'center',
  },
  heroLeft: { flex: 1, marginRight: 16 },
  heroTitle: {
    fontFamily:   'WantedSans-ExtraBold',
    fontSize:      16,
    lineHeight:    22,
    color:         '#FFFFFF',
    letterSpacing: -0.2,
  },
  heroDesc: {
    fontFamily: 'WantedSans-Medium',
    fontSize:    11,
    lineHeight:  17,
    color:       'rgba(255,255,255,0.65)',
    marginTop:    4,
  },

  // 섹션 헤더
  sectionHead: {
    fontFamily:    'WantedSans-Bold',
    fontSize:       11,
    lineHeight:     16,
    color:          PALETTE.gray500,
    letterSpacing:  1,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingVertical:    10,
  },

  // 카드
  card: {
    marginHorizontal: 16,
    backgroundColor:  '#FFFFFF',
    borderRadius:     16,
    overflow:         'hidden',
    marginBottom:      16,
  },

  // 반경 피커
  sliderRow: { padding: 16 },
  sliderLabelRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'baseline',
    marginBottom:    4,
  },
  sliderLabel: {
    fontFamily:   'WantedSans-ExtraBold',
    fontSize:      15,
    lineHeight:    21,
    color:         PALETTE.gray900,
    letterSpacing: -0.2,
  },
  sliderValue: {
    fontFamily:   'WantedSans-Black',
    fontSize:      20,
    lineHeight:    26,
    color:         PALETTE.orange500,
    letterSpacing: -0.4,
  },
  sliderDesc: {
    fontFamily: 'WantedSans-Medium',
    fontSize:    12,
    lineHeight:  17,
    color:       PALETTE.gray500,
    marginBottom: 12,
  },
  stepRow: { flexDirection: 'row', gap: 8 },
  stepBtn: {
    flex:             1,
    paddingVertical:   9,
    alignItems:       'center',
    borderRadius:     10,
    backgroundColor:  PALETTE.gray100,
    borderWidth:      1.5,
    borderColor:      PALETTE.gray200,
  },
  stepBtnActive: {
    backgroundColor: PALETTE.orange50,
    borderColor:     PALETTE.orange500,
  },
  stepBtnText: {
    fontFamily: 'WantedSans-Bold',
    fontSize:    12,
    lineHeight:  17,
    color:       PALETTE.gray600,
  },
  stepBtnTextActive: { color: PALETTE.orange500 },

  // 정보 행
  infoRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingHorizontal: 16,
    paddingVertical:    13,
    borderTopWidth:     1,
    borderTopColor:    PALETTE.gray100,
  },
  infoLabel: {
    fontFamily: 'WantedSans-SemiBold',
    fontSize:    14,
    lineHeight:  20,
    color:       PALETTE.gray800,
  },
  infoValue: {
    fontFamily: 'WantedSans-Bold',
    fontSize:    13,
    lineHeight:  18,
    color:       PALETTE.gray600,
  },

  // 설정 행 (Switch)
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: 16,
    paddingVertical:    14,
    gap:               12,
  },
  rowIcon: { fontSize: 18 },
  rowBody: { flex: 1 },
  rowLabel: {
    fontFamily:   'WantedSans-ExtraBold',
    fontSize:      14,
    lineHeight:    20,
    color:         PALETTE.gray900,
  },
  rowDesc: {
    fontFamily: 'WantedSans-Medium',
    fontSize:    11,
    lineHeight:  16,
    color:       PALETTE.gray500,
    marginTop:    2,
  },
  divider: { height: 1, backgroundColor: PALETTE.gray100, marginHorizontal: 16 },

  // 카테고리 칩
  catWrap: {
    flexDirection:    'row',
    flexWrap:         'wrap',
    gap:               10,
    paddingHorizontal: 16,
    marginBottom:      16,
  },
  catChip: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:              6,
    paddingHorizontal: 14,
    paddingVertical:   9,
    backgroundColor: '#FFFFFF',
    borderRadius:    999,
    borderWidth:     1.5,
    borderColor:     PALETTE.gray200,
  },
  catChipActive: {
    backgroundColor: PALETTE.orange50,
    borderColor:     PALETTE.orange500,
  },
  catEmoji: { fontSize: 14 },
  catLabel: {
    fontFamily: 'WantedSans-Bold',
    fontSize:    13,
    lineHeight:  18,
    color:       PALETTE.gray700,
  },
  catLabelActive: { color: PALETTE.orange500 },
  catCheck: {
    fontFamily: 'WantedSans-Bold',
    fontSize:    11,
    color:       PALETTE.orange500,
  },

  // 개인정보
  privacy: {
    fontFamily:    'WantedSans-Medium',
    fontSize:       11,
    lineHeight:     17,
    color:          PALETTE.gray400,
    paddingHorizontal: 20,
    paddingBottom:   20,
  },
});
