/**
 * SuperAdminPointSettingsScreen — 포인트 지급 조건 관리
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';

// ── 다크 테마 (슈퍼어드민 스타일) ─────────────────────────────────
const SA = {
  bg:      '#0F1117',
  card:    '#1A1D27',
  border:  '#2A2D3A',
  text:    '#F1F3F5',
  muted:   '#8B95A1',
  accent:  '#FF6F0F',
  success: '#2ECC71',
  warn:    '#F39C12',
  danger:  '#E74C3C',
};

interface PointSetting {
  enabled:               boolean;
  amount:                number;
  max_per_day:           number;
  receipt_max_age_hours: number;
}

export default function SuperAdminPointSettingsScreen() {
  const navigation = useNavigation<any>();

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [setting,  setSetting]  = useState<PointSetting>({
    enabled: true, amount: 500, max_per_day: 1, receipt_max_age_hours: 48,
  });

  // 최근 포인트 지급 내역
  const [recentTx, setRecentTx] = useState<any[]>([]);

  useEffect(() => {
    loadSettings();
    loadRecentTx();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('point_settings')
        .select('value')
        .eq('key', 'receipt_review')
        .single();
      if (data?.value) setSetting(data.value as PointSetting);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentTx = async () => {
    const { data } = await supabase
      .from('point_transactions')
      .select('id, user_id, amount, type, description, created_at, profiles(nickname)')
      .order('created_at', { ascending: false })
      .limit(20);
    setRecentTx(data ?? []);
  };

  const saveSettings = async () => {
    if (setting.amount <= 0) { Alert.alert('포인트 금액을 1 이상 입력해주세요.'); return; }
    if (setting.max_per_day <= 0) { Alert.alert('일일 지급 횟수를 1 이상 입력해주세요.'); return; }
    if (setting.receipt_max_age_hours <= 0) { Alert.alert('유효 시간을 1 이상 입력해주세요.'); return; }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('point_settings')
        .upsert({
          key:         'receipt_review',
          value:       setting,
          description: '영수증 후기 제보 포인트 지급 조건',
          updated_at:  new Date().toISOString(),
        }, { onConflict: 'key' });

      if (error) throw error;
      Alert.alert('✅ 저장 완료', '포인트 설정이 업데이트됐어요.');
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message);
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator color={SA.accent} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>포인트 설정</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

          {/* ── 영수증 후기 포인트 설정 ── */}
          <View style={s.card}>
            <Text style={s.cardTitle}>🧾 영수증 후기 제보 포인트</Text>

            {/* 활성화 토글 */}
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>포인트 지급 활성화</Text>
                <Text style={s.rowDesc}>비활성화 시 제출해도 포인트가 지급되지 않아요</Text>
              </View>
              <Switch
                value={setting.enabled}
                onValueChange={v => setSetting(p => ({ ...p, enabled: v }))}
                trackColor={{ false: SA.border, true: SA.accent }}
                thumbColor="#fff"
              />
            </View>

            <View style={s.divider} />

            {/* 포인트 금액 */}
            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>지급 포인트 (P)</Text>
              <View style={s.inputRow}>
                <TextInput
                  style={s.input}
                  value={String(setting.amount)}
                  onChangeText={v => setSetting(p => ({ ...p, amount: parseInt(v.replace(/[^0-9]/g, '')) || 0 }))}
                  keyboardType="number-pad"
                  placeholderTextColor={SA.muted}
                />
                <Text style={s.inputUnit}>P</Text>
              </View>
            </View>

            {/* 일일 최대 횟수 */}
            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>일일 최대 지급 횟수</Text>
              <Text style={s.fieldDesc}>사용자 1명이 하루에 받을 수 있는 최대 횟수</Text>
              <View style={s.inputRow}>
                <TextInput
                  style={s.input}
                  value={String(setting.max_per_day)}
                  onChangeText={v => setSetting(p => ({ ...p, max_per_day: parseInt(v.replace(/[^0-9]/g, '')) || 1 }))}
                  keyboardType="number-pad"
                  placeholderTextColor={SA.muted}
                />
                <Text style={s.inputUnit}>회/일</Text>
              </View>
            </View>

            {/* 영수증 유효 시간 */}
            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>영수증 유효 시간</Text>
              <Text style={s.fieldDesc}>발행일로부터 이 시간이 지난 영수증은 포인트 지급 불가</Text>
              <View style={s.inputRow}>
                <TextInput
                  style={s.input}
                  value={String(setting.receipt_max_age_hours)}
                  onChangeText={v => setSetting(p => ({ ...p, receipt_max_age_hours: parseInt(v.replace(/[^0-9]/g, '')) || 1 }))}
                  keyboardType="number-pad"
                  placeholderTextColor={SA.muted}
                />
                <Text style={s.inputUnit}>시간 이내</Text>
              </View>
            </View>

            {/* 현재 설정 요약 */}
            <View style={s.summary}>
              <Text style={s.summaryText}>
                현재 설정: {setting.enabled ? '✅ 활성' : '❌ 비활성'}{'\n'}
                영수증 발행 {setting.receipt_max_age_hours}시간 이내 →{' '}
                하루 최대 {setting.max_per_day}회 → {setting.amount.toLocaleString()}P 지급
              </Text>
            </View>
          </View>

          {/* 저장 버튼 */}
          <TouchableOpacity
            style={[s.saveBtn, saving && s.saveBtnDisabled]}
            onPress={saveSettings}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.saveBtnText}>💾 설정 저장</Text>
            }
          </TouchableOpacity>

          {/* ── 최근 포인트 지급 내역 ── */}
          <View style={s.card}>
            <Text style={s.cardTitle}>📋 최근 지급 내역</Text>
            {recentTx.length === 0 ? (
              <Text style={s.emptyText}>지급 내역이 없어요</Text>
            ) : (
              recentTx.map(tx => (
                <View key={tx.id} style={s.txRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.txNickname}>
                      {(tx.profiles as any)?.nickname ?? '사용자'}
                    </Text>
                    <Text style={s.txDesc} numberOfLines={1}>{tx.description}</Text>
                    <Text style={s.txDate}>
                      {new Date(tx.created_at).toLocaleDateString('ko-KR', {
                        month: 'numeric', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <Text style={[s.txAmount, tx.amount > 0 ? s.txPlus : s.txMinus]}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}P
                  </Text>
                </View>
              ))
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: SA.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 8,
    backgroundColor: SA.card,
    borderBottomWidth: 1, borderBottomColor: SA.border,
  },
  backBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 28, lineHeight: 32, color: SA.text },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 17, fontWeight: '700', color: SA.text,
  },

  card: {
    margin: 16, marginBottom: 0,
    backgroundColor: SA.card, borderRadius: 16,
    padding: 20, borderWidth: 1, borderColor: SA.border,
    gap: 0,
  },
  cardTitle: {
    fontSize: 16, fontWeight: '700', color: SA.text,
    marginBottom: 16, letterSpacing: -0.3,
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 4, gap: 12,
  },
  rowLabel: { fontSize: 14, fontWeight: '600', color: SA.text, marginBottom: 2 },
  rowDesc:  { fontSize: 11, color: SA.muted, lineHeight: 16 },
  divider:  { height: 1, backgroundColor: SA.border, marginVertical: 16 },

  fieldWrap: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: SA.text, marginBottom: 4 },
  fieldDesc:  { fontSize: 11, color: SA.muted, marginBottom: 8, lineHeight: 16 },
  inputRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1, backgroundColor: SA.bg, borderWidth: 1, borderColor: SA.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, fontWeight: '600', color: SA.text,
  },
  inputUnit: { fontSize: 13, color: SA.muted, flexShrink: 0 },

  summary: {
    marginTop: 4, padding: 12,
    backgroundColor: SA.accent + '15', borderRadius: 10,
    borderWidth: 1, borderColor: SA.accent + '44',
  },
  summaryText: { fontSize: 12, color: SA.text, lineHeight: 20 },

  saveBtn: {
    margin: 16, backgroundColor: SA.accent, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  emptyText: { fontSize: 13, color: SA.muted, textAlign: 'center', paddingVertical: 20 },
  txRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: SA.border,
    gap: 12,
  },
  txNickname: { fontSize: 13, fontWeight: '600', color: SA.text },
  txDesc:     { fontSize: 11, color: SA.muted },
  txDate:     { fontSize: 10, color: SA.border },
  txAmount:   { fontSize: 15, fontWeight: '700', flexShrink: 0 },
  txPlus:     { color: SA.success },
  txMinus:    { color: SA.danger },
});
