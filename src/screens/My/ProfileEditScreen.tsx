/**
 * ProfileEditScreen — 닉네임 · 생일 수정
 *
 * - 현재 프로필을 로드해 초기값 세팅
 * - 닉네임 중복 확인 (본인 제외)
 * - 생일(월/일) 선택 피커
 * - 저장 성공 시 goBack
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { PALETTE } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import BirthdayPicker from '../auth/components/BirthdayPicker';

type CheckState = 'idle' | 'checking' | 'ok' | 'taken' | 'same';

function nickWeight(s: string): number {
  let n = 0;
  for (const ch of s) {
    n += /[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/.test(ch) ? 1.6 : 1;
  }
  return n;
}

export default function ProfileEditScreen() {
  const navigation = useNavigation<any>();
  const insets     = useSafeAreaInsets();

  // ── 현재 프로필 로드 상태 ───────────────────────────────────────
  const [initLoading, setInitLoading] = useState(true);
  const [userId,      setUserId]      = useState<string | null>(null);
  const [origNick,    setOrigNick]    = useState('');

  // ── 수정 폼 상태 ────────────────────────────────────────────────
  const [nickname,    setNickname]    = useState('');
  const [birthMonth,  setBirthMonth]  = useState<number | null>(null);
  const [birthDay,    setBirthDay]    = useState<number | null>(null);
  const [pickerOpen,  setPickerOpen]  = useState(false);
  const [checkState,  setCheckState]  = useState<CheckState>('idle');

  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState('');

  // ── 프로필 초기 로드 ────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        if (!uid) { navigation.goBack(); return; }
        setUserId(uid);

        const { data: prof } = await supabase
          .from('profiles')
          .select('nickname, birth_month, birth_day')
          .eq('id', uid)
          .maybeSingle();

        const metaNick = session?.user?.user_metadata?.nickname as string | undefined;
        const nick = prof?.nickname || metaNick || '';
        setNickname(nick);
        setOrigNick(nick);
        setBirthMonth(prof?.birth_month ?? null);
        setBirthDay(prof?.birth_day   ?? null);
      } catch {
        navigation.goBack();
      } finally {
        setInitLoading(false);
      }
    })();
  }, []);

  // ── 닉네임 변경 시 체크 초기화 ──────────────────────────────────
  useEffect(() => {
    if (nickname === origNick) {
      setCheckState('same'); // 원래 값 → 중복 확인 불필요
    } else {
      setCheckState('idle');
    }
  }, [nickname, origNick]);

  // ── 유효성 ──────────────────────────────────────────────────────
  const weight    = useMemo(() => nickWeight(nickname), [nickname]);
  const overLimit = weight > 8;
  const tooShort  = nickname.trim().length < 2;
  const nickOk    = checkState === 'ok' || checkState === 'same';
  const canSave   = nickOk && !overLimit && !tooShort;

  // ── 중복 확인 ───────────────────────────────────────────────────
  const handleCheck = useCallback(async () => {
    if (tooShort || overLimit || !userId) return;
    setCheckState('checking');
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('nickname', nickname.trim())
        .neq('id', userId)
        .maybeSingle();
      setCheckState(data ? 'taken' : 'ok');
    } catch {
      setCheckState('idle');
    }
  }, [nickname, tooShort, overLimit, userId]);

  // ── 닉네임 상태 메시지 ──────────────────────────────────────────
  const nickMsg = (() => {
    if (overLimit)                 return { ok: false, text: '✕ 한글 5자 · 영문 8자를 넘었어요' };
    if (checkState === 'ok')       return { ok: true,  text: '✓ 사용 가능한 닉네임이에요' };
    if (checkState === 'same')     return { ok: true,  text: '현재 사용 중인 닉네임이에요' };
    if (checkState === 'taken')    return { ok: false, text: '✕ 이미 사용 중인 닉네임이에요' };
    if (checkState === 'checking') return { ok: null,  text: '중복 확인 중…' };
    return { ok: null as null | boolean, text: '이름·상호·욕설은 사용할 수 없어요' };
  })();

  const hasHangul = /[\uAC00-\uD7A3]/.test(nickname);
  const counterLabel = hasHangul
    ? `${[...nickname].filter(c => /[\uAC00-\uD7A3]/.test(c)).length}/5`
    : `${nickname.length}/8`;

  // ── 저장 ────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!canSave || !userId) return;
    setSaving(true);
    setSaveErr('');
    try {
      const trimmed = nickname.trim();

      // auth metadata 업데이트 (실패 무시)
      try {
        await supabase.auth.updateUser({ data: { nickname: trimmed } });
      } catch { /* ignore */ }

      // profiles 닉네임 + 생일
      await supabase.from('profiles').upsert(
        {
          id:          userId,
          nickname:    trimmed || null,
          birth_month: birthMonth,
          birth_day:   birthDay,
          updated_at:  new Date().toISOString(),
        },
        { onConflict: 'id' },
      );

      Alert.alert('저장 완료', '프로필이 업데이트되었어요 🎉', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      setSaveErr(e?.message ?? '저장에 실패했어요');
    } finally {
      setSaving(false);
    }
  }, [canSave, userId, nickname, birthMonth, birthDay, navigation]);

  // ── 로딩 ────────────────────────────────────────────────────────
  if (initLoading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <ActivityIndicator style={s.loader} color={PALETTE.orange500} />
      </SafeAreaView>
    );
  }

  const birthLabel = (birthMonth && birthDay)
    ? `${birthMonth}월 ${birthDay}일`
    : '생일을 선택해주세요';

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* 헤더 */}
      <View style={[s.header, { paddingTop: insets.top > 0 ? 0 : 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={PALETTE.gray900} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>프로필 수정</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={!canSave || saving}
          style={[s.saveBtn, (!canSave || saving) && s.saveBtnDisabled]}
        >
          {saving
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Text style={s.saveBtnText}>저장</Text>
          }
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={s.flex}
          contentContainerStyle={s.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── 닉네임 ── */}
          <Text style={s.sectionLabel}>닉네임</Text>
          <View style={s.nickRow}>
            <TextInput
              style={[
                s.input,
                checkState === 'ok'   && s.inputOk,
                checkState === 'same' && s.inputOk,
                (checkState === 'taken' || overLimit) && s.inputErr,
              ]}
              value={nickname}
              onChangeText={v => setNickname(v)}
              maxLength={12}
              placeholder="한글 5자 · 영문 8자 이내"
              placeholderTextColor={PALETTE.gray400}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[s.checkBtn, (tooShort || overLimit || checkState === 'same') && s.checkBtnDisabled]}
              onPress={handleCheck}
              disabled={tooShort || overLimit || checkState === 'checking' || checkState === 'same'}
              activeOpacity={0.8}
            >
              <Text style={[s.checkBtnText, (tooShort || overLimit || checkState === 'same') && s.checkBtnTextDisabled]}>
                {checkState === 'checking' ? '확인 중…' : '중복 확인'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={s.nickStatus}>
            <Text style={[
              s.nickMsg,
              nickMsg.ok === true  && s.nickMsgOk,
              nickMsg.ok === false && s.nickMsgErr,
            ]}>{nickMsg.text}</Text>
            <Text style={[s.counter, overLimit && s.counterErr]}>{counterLabel}</Text>
          </View>

          {/* ── 생일 ── */}
          <Text style={[s.sectionLabel, { marginTop: 24 }]}>생일</Text>
          <Text style={s.sectionHint}>생일엔 특별한 쿠폰을 받을 수도 있어요 🎂</Text>
          <TouchableOpacity
            style={s.birthBtn}
            onPress={() => setPickerOpen(true)}
            activeOpacity={0.8}
          >
            <Text style={[s.birthBtnText, (birthMonth && birthDay) && s.birthBtnTextFilled]}>
              {birthLabel}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={PALETTE.gray400} />
          </TouchableOpacity>
          {(birthMonth && birthDay) ? (
            <TouchableOpacity
              style={s.clearBirthBtn}
              onPress={() => { setBirthMonth(null); setBirthDay(null); }}
            >
              <Text style={s.clearBirthText}>생일 삭제</Text>
            </TouchableOpacity>
          ) : null}

          {saveErr ? <Text style={s.errText}>{saveErr}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 생일 피커 */}
      {pickerOpen && (
        <BirthdayPicker
          initialMonth={birthMonth ?? 1}
          initialDay={birthDay ?? 1}
          onConfirm={(m, d) => { setBirthMonth(m); setBirthDay(d); setPickerOpen(false); }}
          onCancel={() => setPickerOpen(false)}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#FFFFFF' },
  flex:   { flex: 1 },
  loader: { flex: 1, marginTop: 80 },

  // 헤더
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: 16,
    paddingVertical:   12,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.gray150,
    backgroundColor:   '#FFFFFF',
  },
  headerTitle: {
    flex:          1,
    textAlign:     'center',
    fontFamily:    'WantedSans-Bold',
    fontSize:       17,
    fontWeight:    '700',
    color:          PALETTE.gray900,
    letterSpacing: -0.3,
  },
  saveBtn: {
    backgroundColor:  PALETTE.orange500,
    borderRadius:     10,
    paddingHorizontal: 16,
    paddingVertical:   8,
    minWidth:          52,
    alignItems:        'center',
  },
  saveBtnDisabled: { backgroundColor: PALETTE.gray200 },
  saveBtnText: {
    fontFamily:  'WantedSans-Bold',
    fontSize:     14,
    fontWeight:  '700',
    color:        '#FFFFFF',
  },

  // 본문
  body: {
    paddingHorizontal: 24,
    paddingTop:        24,
    paddingBottom:     40,
  },
  sectionLabel: {
    fontFamily:    'WantedSans-Bold',
    fontSize:       14,
    fontWeight:    '700',
    color:          PALETTE.gray900,
    marginBottom:   8,
    letterSpacing: -0.2,
  },
  sectionHint: {
    fontFamily:  'WantedSans-Medium',
    fontSize:     13,
    fontWeight:  '500',
    color:        PALETTE.gray500,
    marginBottom: 8,
    marginTop:   -4,
  },

  // 닉네임
  nickRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  input: {
    flex:             1,
    paddingHorizontal: 14,
    paddingVertical:   14,
    borderRadius:      12,
    borderWidth:       2,
    borderColor:       PALETTE.gray200,
    fontFamily:        'WantedSans-Medium',
    fontSize:          16,
    color:             PALETTE.gray900,
    backgroundColor:   '#FFFFFF',
  },
  inputOk:  { borderColor: PALETTE.orange500 },
  inputErr: { borderColor: PALETTE.red500 },
  checkBtn: {
    paddingHorizontal: 14,
    paddingVertical:   14,
    borderRadius:      12,
    backgroundColor:   PALETTE.gray900,
    justifyContent:    'center',
  },
  checkBtnDisabled:    { backgroundColor: PALETTE.gray200 },
  checkBtnText:        { fontFamily: 'WantedSans-Bold', fontSize: 13, color: '#FFFFFF' },
  checkBtnTextDisabled: { color: PALETTE.gray500 },
  nickStatus: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4, minHeight: 18,
  },
  nickMsg:    { fontFamily: 'WantedSans-Medium', fontSize: 12, color: PALETTE.gray500, flex: 1 },
  nickMsgOk:  { color: PALETTE.orange500 },
  nickMsgErr: { color: PALETTE.red500 },
  counter:    { fontFamily: 'WantedSans-Medium', fontSize: 12, color: PALETTE.gray400, marginLeft: 8 },
  counterErr: { color: PALETTE.red500 },

  // 생일
  birthBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderRadius:      12,
    borderWidth:       1.5,
    borderColor:       PALETTE.gray200,
    backgroundColor:   '#FFFFFF',
  },
  birthBtnText:       { fontFamily: 'WantedSans-Medium', fontSize: 16, color: PALETTE.gray400 },
  birthBtnTextFilled: { color: PALETTE.gray900 },
  clearBirthBtn:      { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 4 },
  clearBirthText:     { fontFamily: 'WantedSans-Medium', fontSize: 13, color: PALETTE.red500 },

  errText: {
    fontFamily:  'WantedSans-Medium',
    fontSize:     13,
    color:        PALETTE.red500,
    marginTop:    16,
    textAlign:   'center',
  },
});
