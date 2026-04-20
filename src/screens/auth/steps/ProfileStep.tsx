// Step 3: 닉네임 + 생일 (선택)
// 한글 가중치(x1.6): 한글 5자 = 영문 8자, 닉네임 중복 확인 버튼
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { PALETTE, FONT_FAMILY } from '../../../constants/theme';
import BirthdayPicker from '../components/BirthdayPicker';

export interface ProfileData {
  nickname:   string;
  birthMonth: string;  // '01'–'12' or ''
  birthDay:   string;  // '01'–'31' or ''
  birthSkip:  boolean;
}

interface Props {
  profile:    ProfileData;
  setProfile: (p: ProfileData) => void;
  onCheckNick: (nick: string) => Promise<boolean>; // true = available
  onNext:     () => void;
  loading?:   boolean;
  error?:     string;
}

type CheckState = 'idle' | 'checking' | 'ok' | 'taken';

// ── 한글 가중치 길이 계산 ─────────────────────────────────────────
function nickWeight(s: string): number {
  let n = 0;
  for (const ch of s) {
    n += /[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/.test(ch) ? 1.6 : 1;
  }
  return n;
}

export default function ProfileStep({
  profile, setProfile, onCheckNick, onNext, loading, error,
}: Props) {
  const { nickname, birthMonth, birthDay, birthSkip } = profile;
  const [checking, setChecking] = useState<CheckState>('idle');
  const [pickerOpen, setPickerOpen] = useState(false);

  const hasHangul  = /[\uAC00-\uD7A3]/.test(nickname);
  const weight     = useMemo(() => nickWeight(nickname), [nickname]);
  const overLimit  = weight > 8;
  const tooShort   = nickname.trim().length < 2;
  const isValid    = checking === 'ok' && !overLimit && !tooShort;

  // 닉네임 변경 시 체크 초기화
  useEffect(() => { setChecking('idle'); }, [nickname]);

  const handleCheck = useCallback(async () => {
    if (tooShort || overLimit) return;
    setChecking('checking');
    try {
      const available = await onCheckNick(nickname.trim());
      setChecking(available ? 'ok' : 'taken');
    } catch {
      setChecking('idle');
    }
  }, [nickname, tooShort, overLimit, onCheckNick]);

  const handleBirthConfirm = (m: number, d: number) => {
    setProfile({
      ...profile,
      birthMonth: String(m).padStart(2, '0'),
      birthDay:   String(d).padStart(2, '0'),
    });
    setPickerOpen(false);
  };

  const toggleSkip = () => {
    const next = !birthSkip;
    setProfile({
      ...profile,
      birthSkip: next,
      birthMonth: next ? '' : birthMonth,
      birthDay:   next ? '' : birthDay,
    });
    if (next) setPickerOpen(false);
  };

  // 닉네임 상태 메시지
  const nickMsg = (() => {
    if (overLimit) return { ok: false, text: '✕ 한글 5자 · 영문 8자를 넘었어요' };
    if (checking === 'ok')       return { ok: true,  text: '✓ 사용 가능한 닉네임이에요' };
    if (checking === 'taken')    return { ok: false, text: '✕ 이미 사용 중인 닉네임이에요' };
    if (checking === 'checking') return { ok: null,  text: '중복 확인 중…' };
    return { ok: null as null | boolean, text: '이름·상호·욕설은 사용할 수 없어요' };
  })();

  const counterLabel = hasHangul
    ? `${[...nickname].filter(c => /[\uAC00-\uD7A3]/.test(c)).length}/5`
    : `${nickname.length}/8`;

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={s.body}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={s.title}>닉네임을{'\n'}정해주세요</Text>
      <Text style={s.sub}>피드에서 다른 분들에게 보여지는 이름이에요</Text>

      {/* 닉네임 + 중복확인 */}
      <View style={s.nickRow}>
        <TextInput
          style={[
            s.nickInput,
            checking === 'ok'    && s.nickInputOk,
            (checking === 'taken' || overLimit) && s.nickInputErr,
          ]}
          placeholder="한글 5자 · 영문 8자 이내"
          placeholderTextColor={PALETTE.gray400}
          value={nickname}
          onChangeText={v => setProfile({ ...profile, nickname: v })}
          maxLength={12}
          autoFocus
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[s.checkBtn, (tooShort || overLimit) && s.checkBtnDisabled]}
          onPress={handleCheck}
          disabled={tooShort || overLimit || checking === 'checking'}
          activeOpacity={0.8}
        >
          <Text style={[s.checkBtnText, (tooShort || overLimit) && s.checkBtnTextDisabled]}>
            {checking === 'checking' ? '확인 중…' : '중복 확인'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 상태 메시지 */}
      <View style={s.nickStatus}>
        <Text style={[
          s.nickMsg,
          nickMsg.ok === true  && s.nickMsgOk,
          nickMsg.ok === false && s.nickMsgErr,
        ]}>
          {nickMsg.text}
        </Text>
        <Text style={[s.counter, overLimit && s.counterErr]}>
          {counterLabel}
        </Text>
      </View>

      {/* 생일 (선택) */}
      <View style={s.birthSection}>
        <View style={s.birthLabelRow}>
          <Text style={s.birthLabel}>생일</Text>
          <Text style={s.birthOptional}> 선택</Text>
        </View>
        <Text style={s.birthHint}>생일엔 특별한 쿠폰을 받을 수도 있어요 🎂</Text>

        <TouchableOpacity
          style={[s.birthBtn, birthSkip && s.birthBtnSkipped]}
          onPress={() => { if (!birthSkip) setPickerOpen(true); }}
          disabled={birthSkip}
          activeOpacity={0.8}
        >
          <Text style={[s.birthBtnText, (birthMonth && birthDay && !birthSkip) && s.birthBtnTextFilled]}>
            {birthSkip
              ? '생일 입력을 건너뛰었어요'
              : (birthMonth && birthDay)
                ? `${+birthMonth}월 ${+birthDay}일`
                : '생일을 선택해주세요'}
          </Text>
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>

        {/* 건너뛰기 */}
        <TouchableOpacity style={s.skipRow} onPress={toggleSkip} activeOpacity={0.7}>
          <View style={[s.checkbox, birthSkip && s.checkboxActive]}>
            {birthSkip && <Text style={s.checkboxMark}>✓</Text>}
          </View>
          <Text style={[s.skipText, birthSkip && s.skipTextActive]}>
            생일 입력 안 함
          </Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      <View style={{ flex: 1, minHeight: 24 }} />

      <TouchableOpacity
        style={[s.btn, !isValid && s.btnDisabled]}
        onPress={onNext}
        disabled={!isValid || loading}
        activeOpacity={0.85}
      >
        <Text style={s.btnText}>다음</Text>
      </TouchableOpacity>

      {/* 생일 피커 */}
      {pickerOpen && (
        <BirthdayPicker
          initialMonth={birthMonth ? +birthMonth : 1}
          initialDay={birthDay   ? +birthDay   : 1}
          onConfirm={handleBirthConfirm}
          onCancel={() => setPickerOpen(false)}
        />
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  body: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
  },
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 26,
    fontWeight: '900',
    color: PALETTE.gray900,
    letterSpacing: -0.8,
    marginBottom: 10,
    lineHeight: 34,
  },
  sub: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    color: PALETTE.gray500,
    marginBottom: 28,
    lineHeight: 20,
  },

  // 닉네임
  nickRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  nickInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: PALETTE.gray200,
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    fontWeight: '700',
    color: PALETTE.gray900,
    backgroundColor: '#FFFFFF',
  },
  nickInputOk:  { borderColor: PALETTE.orange500 },
  nickInputErr: { borderColor: PALETTE.red500 },
  checkBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: PALETTE.gray900,
    justifyContent: 'center',
  },
  checkBtnDisabled: { backgroundColor: PALETTE.gray200 },
  checkBtnText: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  checkBtnTextDisabled: { color: PALETTE.gray500 },
  nickStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    minHeight: 18,
  },
  nickMsg: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '600',
    color: PALETTE.gray500,
    flex: 1,
  },
  nickMsgOk:  { color: PALETTE.orange500 },
  nickMsgErr: { color: PALETTE.red500 },
  counter: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '700',
    color: PALETTE.gray400,
    marginLeft: 8,
  },
  counterErr: { color: PALETTE.red500 },

  // 생일
  birthSection: { marginBottom: 24 },
  birthLabelRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 },
  birthLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    fontWeight: '800',
    color: PALETTE.gray900,
  },
  birthOptional: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    color: PALETTE.gray500,
  },
  birthHint: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    color: PALETTE.gray500,
    marginBottom: 10,
    lineHeight: 18,
  },
  birthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PALETTE.gray200,
    backgroundColor: '#FFFFFF',
  },
  birthBtnSkipped: {
    backgroundColor: PALETTE.gray100,
    borderColor: PALETTE.gray150,
    opacity: 0.6,
  },
  birthBtnText: {
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    color: PALETTE.gray400,
  },
  birthBtnTextFilled: {
    color: PALETTE.gray900,
    fontWeight: '700',
  },
  chevron: { color: PALETTE.gray400, fontSize: 16 },
  skipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingVertical: 4,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 6,
    borderWidth: 1.8,
    borderColor: PALETTE.gray300,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: PALETTE.orange500,
    borderColor: PALETTE.orange500,
  },
  checkboxMark: { fontSize: 11, color: '#FFFFFF', fontWeight: '700' },
  skipText: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: '600',
    color: PALETTE.gray600,
    letterSpacing: -0.2,
  },
  skipTextActive: { color: PALETTE.orange500, fontWeight: '700' },

  error: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    color: PALETTE.red500,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: PALETTE.orange500,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: PALETTE.orange500,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 16,
    elevation: 4,
  },
  btnDisabled: {
    backgroundColor: PALETTE.gray200,
    shadowOpacity: 0,
    elevation: 0,
  },
  btnText: {
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
});
