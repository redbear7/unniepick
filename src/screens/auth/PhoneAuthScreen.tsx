/**
 * PhoneAuthScreen — SMS OTP 인증 화면
 * E1(시작) → E2(번호입력 PIN스타일) → E3(OTP입력) → E4(닉네임) → 완료
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';

const C = {
  brand:  '#FF6F0F',
  brand2: '#FF9A3D',
  g900:   '#191F28',
  g800:   '#333D4B',
  g700:   '#4E5968',
  g600:   '#6B7684',
  g500:   '#8B95A1',
  g400:   '#ADB5BD',
  g200:   '#E5E8EB',
  g100:   '#F2F4F6',
  white:  '#FFFFFF',
};

type Step = 'E1' | 'E2' | 'E3' | 'E4';

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── 전화번호 표시용 포맷 (01085757863 → 010-8575-7863) ───────────
function formatDisplay(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export default function PhoneAuthScreen() {
  const navigation = useNavigation<any>();

  const [step,        setStep]        = useState<Step>('E1');
  // E2: 010 뒤 8자리만 관리
  const [digits,      setDigits]      = useState(['','','','','','','','']); // 8칸
  const [otp,         setOtp]         = useState(['','','','','','']);       // 6칸
  const [nickname,    setNickname]    = useState('');
  // E4: 닉네임 중복 검사
  const [nickAvailable,   setNickAvailable]   = useState<boolean | null>(null); // null=미검사
  const [nickChecking,    setNickChecking]     = useState(false);
  const nickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [timer,       setTimer]       = useState(180);
  const [timerActive, setTimerActive] = useState(false);

  const digitRefs  = useRef<Array<TextInput | null>>(Array(8).fill(null));
  const otpRefs    = useRef<Array<TextInput | null>>(Array(6).fill(null));
  const otpHiddenRef = useRef<TextInput | null>(null);
  const [otpRaw, setOtpRaw] = useState('');
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── 관리자 3탭 ───────────────────────────────────────────────────
  const adminTapCount = useRef(0);
  const adminTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleAdminTap = () => {
    adminTapCount.current += 1;
    if (adminTapTimer.current) clearTimeout(adminTapTimer.current);
    if (adminTapCount.current >= 3) {
      adminTapCount.current = 0;
      navigation.reset({ index: 0, routes: [{ name: 'CustomerTabs' }] });
      return;
    }
    adminTapTimer.current = setTimeout(() => { adminTapCount.current = 0; }, 1200);
  };

  // ── 타이머 ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerActive) return;
    setTimer(180);
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); setTimerActive(false); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive]);

  // ── 전화번호 계산 ─────────────────────────────────────────────────
  // digits = 010 뒤 8자리
  const fullDigits    = '010' + digits.join('');          // 01012345678
  const isPhoneComplete = digits.every(d => d !== '');    // 8자리 모두 입력
  const cleanNumber   = fullDigits;                       // 01012345678

  // OTP: 숨겨진 단일 input으로 받아서 6칸에 분배
  const otpString     = otpRaw.slice(0, 6);
  const otpDisplay    = Array(6).fill('').map((_, i) => otpString[i] ?? '');
  const isOtpComplete = otpString.length === 6;

  const handleOtpRawChange = (text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, 6);
    setOtpRaw(clean);
    setError('');
  };

  // ── E2: digit 입력 핸들러 ─────────────────────────────────────────
  const handleDigitChange = (text: string, index: number) => {
    const d = text.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = d;
    setDigits(next);
    setError('');
    if (d && index < 7) digitRefs.current[index + 1]?.focus();
  };

  const handleDigitKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      digitRefs.current[index - 1]?.focus();
    }
  };

  // ── E2: OTP 발송 ─────────────────────────────────────────────────
  const sendOtp = useCallback(async () => {
    if (!isPhoneComplete) return;
    setLoading(true);
    setError('');
    try {
      // 010XXXXXXXX → +8210XXXXXXXX
      const intlPhone = '+82' + cleanNumber.slice(1);
      const { error: e } = await supabase.auth.signInWithOtp({ phone: intlPhone });
      if (e) throw e;
      setStep('E3');
      setTimerActive(false);
      setTimeout(() => setTimerActive(true), 50);
    } catch (e: any) {
      setError(e?.message ?? '인증번호 발송에 실패했습니다');
    } finally {
      setLoading(false);
    }
  }, [isPhoneComplete, cleanNumber]);

  // ── E3: OTP 입력 핸들러 ──────────────────────────────────────────
  const handleOtpChange = (text: string, index: number) => {
    const d = text.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = d;
    setOtp(next);
    setError('');
    if (d && index < 5) otpRefs.current[index + 1]?.focus();
  };
  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      const next = [...otp];
      next[index - 1] = '';
      setOtp(next);
      otpRefs.current[index - 1]?.focus();
    }
  };

  // ── E3: OTP 검증 ─────────────────────────────────────────────────
  const verifyOtp = useCallback(async () => {
    if (!isOtpComplete) return;
    setLoading(true);
    setError('');
    try {
      const { error: e } = await supabase.auth.verifyOtp({
        phone: '+82' + cleanNumber.slice(1),
        token: otpRaw.slice(0, 6),
        type:  'sms',
      });
      if (e) throw e;
      setStep('E4');
    } catch (e: any) {
      setError(e?.message ?? '인증번호가 올바르지 않습니다');
    } finally {
      setLoading(false);
    }
  }, [isOtpComplete, cleanNumber, otpRaw]);

  // ── E4: 닉네임 중복 검사 (debounce 600ms) ────────────────────────
  const checkNickname = useCallback((value: string) => {
    if (nickTimerRef.current) clearTimeout(nickTimerRef.current);
    const trimmed = value.trim();
    if (!trimmed || trimmed.length < 2) {
      setNickAvailable(null);
      setNickChecking(false);
      return;
    }
    setNickChecking(true);
    setNickAvailable(null);
    nickTimerRef.current = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('nickname', trimmed)
          .maybeSingle();
        setNickAvailable(!data); // data 없으면 사용 가능
      } catch {
        setNickAvailable(null);
      } finally {
        setNickChecking(false);
      }
    }, 600);
  }, []);

  // ── E4: 닉네임 저장 ──────────────────────────────────────────────
  const saveNickname = useCallback(async () => {
    const trimmed = nickname.trim();
    // 닉네임 입력 시 중복이면 차단
    if (trimmed && nickAvailable === false) {
      setError('이미 사용 중인 닉네임이에요');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (trimmed) {
        const { error: e } = await supabase.auth.updateUser({ data: { nickname: trimmed } });
        if (e) throw e;
        // profiles 테이블에도 upsert (unique 제약)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('profiles')
            .upsert({ id: user.id, nickname: trimmed }, { onConflict: 'id' });
        }
      }
      navigation.reset({ index: 0, routes: [{ name: 'CustomerTabs' }] });
    } catch (e: any) {
      setError(e?.message ?? '닉네임 저장에 실패했습니다');
    } finally {
      setLoading(false);
    }
  }, [nickname, nickAvailable, navigation]);

  // ── E4: 사장님 가입 ─────────────────────────────────────────────
  const handleOwnerSignup = useCallback(async () => {
    const trimmed = nickname.trim();
    if (trimmed) {
      try {
        await supabase.auth.updateUser({ data: { nickname: trimmed } });
      } catch { /* 닉네임 저장 실패해도 계속 진행 */ }
    }
    navigation.navigate('StoreApply' as never);
  }, [nickname, navigation]);

  const ErrorMsg = () => error ? <Text style={s.errorText}>{error}</Text> : null;

  // ══════════════════════════════════════════════════════════════════
  //  E1 — 시작
  // ══════════════════════════════════════════════════════════════════
  if (step === 'E1') {
    return (
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleAdminTap}>
        <SafeAreaView style={s.e1Root}>
          <View style={s.e1Body}>
            <Text style={s.e1Emoji}>🎟</Text>
            <Text style={s.e1Title}>언니픽</Text>
            <Text style={s.e1Sub}>주변 가게 쿠폰을 한 번에!</Text>
          </View>
          <View style={s.e1Footer}>
            <TouchableOpacity style={s.e1Btn} onPress={() => setStep('E2')} activeOpacity={0.85}>
              <Text style={s.e1BtnText}>📱 휴대폰 번호로 시작</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </TouchableOpacity>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  //  E2 — 번호 입력 (PIN 스타일)
  // ══════════════════════════════════════════════════════════════════
  if (step === 'E2') {
    return (
      <SafeAreaView style={s.root}>
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={s.backBtn} onPress={() => setStep('E1')}>
            <Text style={s.backBtnText}>←</Text>
          </TouchableOpacity>

          <View style={s.body}>
            <Text style={s.stepTitle}>휴대폰 번호 입력</Text>
            <Text style={s.stepSub}>뒤 8자리를 입력해주세요</Text>

            {/* 010 + 8자리 PIN */}
            <View style={s.pinRow}>
              <Text style={s.prefixText}>010</Text>
              <Text style={s.pinDash}>-</Text>
              {digits.slice(0, 4).map((d, i) => (
                <TextInput
                  key={i}
                  ref={ref => { digitRefs.current[i] = ref; }}
                  style={[s.pinBox, d ? s.pinBoxFilled : null]}
                  value={d}
                  onChangeText={text => handleDigitChange(text, i)}
                  onKeyPress={({ nativeEvent }) => handleDigitKeyPress(nativeEvent.key, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                  selectTextOnFocus
                  autoFocus={i === 0}
                  textContentType="none"
                  autoComplete="off"
                />
              ))}
              <Text style={s.pinDash}>-</Text>
              {digits.slice(4, 8).map((d, i) => (
                <TextInput
                  key={i + 4}
                  ref={ref => { digitRefs.current[i + 4] = ref; }}
                  style={[s.pinBox, d ? s.pinBoxFilled : null]}
                  value={d}
                  onChangeText={text => handleDigitChange(text, i + 4)}
                  onKeyPress={({ nativeEvent }) => handleDigitKeyPress(nativeEvent.key, i + 4)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                  selectTextOnFocus
                  textContentType="none"
                  autoComplete="off"
                />
              ))}
            </View>

            <ErrorMsg />
          </View>

          <View style={s.footer}>
            <TouchableOpacity
              style={[s.primaryBtn, !isPhoneComplete && s.primaryBtnDisabled]}
              onPress={sendOtp}
              disabled={!isPhoneComplete || loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={C.white} />
                : <Text style={s.primaryBtnText}>인증번호 받기</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  //  E3 — OTP 입력
  // ══════════════════════════════════════════════════════════════════
  if (step === 'E3') {
    return (
      <SafeAreaView style={s.root}>
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={s.backBtn} onPress={() => setStep('E2')}>
            <Text style={s.backBtnText}>←</Text>
          </TouchableOpacity>

          <View style={s.body}>
            <Text style={s.stepTitle}>인증번호 입력</Text>
            <Text style={s.stepSub}>{formatDisplay(fullDigits)}로 전송된 6자리</Text>

            {/* 숨겨진 단일 TextInput — SMS 자동완성 수신 */}
            <TextInput
              ref={otpHiddenRef}
              style={s.otpHidden}
              value={otpRaw}
              onChangeText={handleOtpRawChange}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              caretHidden
            />

            {/* 시각적 OTP 박스 6칸 — 탭하면 숨겨진 input 포커스 */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => otpHiddenRef.current?.focus()}
              style={s.otpRow}
            >
              {otpDisplay.map((digit, i) => (
                <View key={i} style={[s.otpBox, digit ? s.otpBoxFilled : null, otpString.length === i && s.otpBoxActive]}>
                  <Text style={s.otpBoxText}>{digit}</Text>
                </View>
              ))}
            </TouchableOpacity>

            <View style={s.timerRow}>
              <Text style={s.timerText}>{formatTimer(timer)}</Text>
              <TouchableOpacity
                disabled={timerActive}
                onPress={() => { setOtpRaw(''); sendOtp(); }}
              >
                <Text style={[s.resendText, timerActive && s.resendTextDisabled]}>재발송</Text>
              </TouchableOpacity>
            </View>

            <ErrorMsg />
          </View>

          <View style={s.footer}>
            <TouchableOpacity
              style={[s.primaryBtn, !isOtpComplete && s.primaryBtnDisabled]}
              onPress={verifyOtp}
              disabled={!isOtpComplete || loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={C.white} />
                : <Text style={s.primaryBtnText}>확인</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── 닉네임 중복 상태 표시 ────────────────────────────────────────
  const nickStatus = (() => {
    const trimmed = nickname.trim();
    if (!trimmed || trimmed.length < 2) return null;
    if (nickChecking) return { ok: null, msg: '확인 중...' };
    if (nickAvailable === true)  return { ok: true,  msg: '✓ 사용 가능한 닉네임이에요' };
    if (nickAvailable === false) return { ok: false, msg: '✗ 이미 사용 중인 닉네임이에요' };
    return null;
  })();

  // ══════════════════════════════════════════════════════════════════
  //  E4 — 닉네임 + 완료
  // ══════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={s.flex}
          contentContainerStyle={s.e4Scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 인증 완료 아이콘 */}
          <View style={s.e4Circle}>
            <Text style={{ fontSize: 46 }}>✅</Text>
          </View>
          <Text style={s.e4Title}>인증 완료!</Text>
          <Text style={s.e4Phone}>{formatDisplay(fullDigits)}</Text>
          <Text style={s.e4PhoneSub}>로 로그인 됐어요</Text>

          <View style={{ height: 36 }} />

          {/* 닉네임 입력 */}
          <Text style={s.e4Label}>닉네임 (선택)</Text>
          <TextInput
            style={[
              s.e4NicknameInput,
              nickStatus?.ok === false && { borderColor: '#E53935' },
              nickStatus?.ok === true  && { borderColor: '#34C759' },
            ]}
            placeholder="닉네임을 입력해주세요"
            placeholderTextColor={C.g400}
            autoFocus
            maxLength={10}
            value={nickname}
            onChangeText={text => {
              setNickname(text);
              setError('');
              checkNickname(text);
            }}
          />

          {/* 중복 검사 상태 */}
          {nickStatus && (
            <Text style={[
              s.e4NickStatus,
              nickStatus.ok === true  && { color: '#34C759' },
              nickStatus.ok === false && { color: '#E53935' },
              nickStatus.ok === null  && { color: C.g500 },
            ]}>
              {nickStatus.msg}
            </Text>
          )}
          {!nickStatus && (
            <Text style={s.e4Hint}>나중에 언제든지 바꿀 수 있어요</Text>
          )}

          <ErrorMsg />

          <View style={{ height: 32 }} />

          {/* 언니픽 시작하기 */}
          <TouchableOpacity
            style={[
              s.primaryBtn,
              (loading || nickStatus?.ok === false) && s.primaryBtnDisabled,
            ]}
            onPress={saveNickname}
            disabled={loading || nickStatus?.ok === false}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={C.white} />
              : <Text style={s.primaryBtnText}>언니픽 시작하기 🎟</Text>
            }
          </TouchableOpacity>

          {/* 사장님 가입 */}
          <TouchableOpacity
            style={s.e4OwnerBtn}
            onPress={handleOwnerSignup}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={s.e4OwnerBtnText}>사장님이신가요? 가게 등록하기 →</Text>
          </TouchableOpacity>

          {/* 약관 */}
          <Text style={s.e4Terms}>
            {'시작하면 이용약관과 개인정보처리방침에\n동의한 것으로 간주합니다'}
          </Text>

          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  flex: { flex: 1 },

  // E1
  e1Root:  { flex: 1, backgroundColor: C.brand },
  e1Body:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  e1Emoji: { fontSize: 70, marginBottom: 8 },
  e1Title: { fontSize: 36, fontWeight: '900', color: C.white, letterSpacing: -1 },
  e1Sub:   { fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  e1Footer:{ paddingHorizontal: 24, paddingBottom: 40 },
  e1Btn:   { backgroundColor: C.white, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  e1BtnText: { fontSize: 16, fontWeight: '700', color: C.brand },

  // 공통
  root:    { flex: 1, backgroundColor: C.white },
  backBtn: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, alignSelf: 'flex-start' },
  backBtnText: { fontSize: 24, color: C.g800 },
  body:    { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  stepTitle: { fontSize: 24, fontWeight: '900', color: C.g900, marginBottom: 6, letterSpacing: -0.5 },
  stepSub:   { fontSize: 13, color: C.g500, marginBottom: 32 },
  footer:  { paddingHorizontal: 24, paddingBottom: 32 },

  // E2 — PIN 스타일
  prefixText: {
    fontSize: 28,
    fontWeight: '900',
    color: C.g900,
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 20,
  },
  pinDash: {
    fontSize: 28,
    fontWeight: '700',
    color: C.g400,
    marginHorizontal: 2,
  },
  pinBox: {
    width: 32,
    height: 44,
    borderRadius: 8,
    backgroundColor: C.g100,
    borderWidth: 0,
    fontSize: 28,
    fontWeight: '900',
    color: C.g900,
  },
  pinBoxFilled: {
    backgroundColor: 'rgba(255,111,15,0.08)',
  },

  // E3 — OTP
  otpHidden: {
    position: 'absolute',
    width: 1, height: 1,
    opacity: 0,
  },
  otpRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  otpBox: {
    flex: 1,
    height: 60,
    borderWidth: 1.5,
    borderColor: C.g200,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.g100,
  },
  otpBoxFilled:  { borderColor: C.brand, backgroundColor: C.white },
  otpBoxActive:  { borderColor: C.brand, borderWidth: 2 },
  otpBoxText:    { fontSize: 24, fontWeight: '800', color: C.g900 },
  timerRow:     { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
  timerText:    { fontSize: 14, fontWeight: '600', color: C.brand },
  resendText:   { fontSize: 13, fontWeight: '600', color: C.brand, textDecorationLine: 'underline' },
  resendTextDisabled: { color: C.g400, textDecorationLine: 'none' },

  // E4
  e4Scroll: {
    paddingHorizontal: 24,
    paddingTop: 48,
    alignItems: 'center',
  },
  e4Circle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(52,199,89,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  e4Title:    { fontSize: 26, fontWeight: '900', color: C.g900, marginTop: 16, letterSpacing: -0.5 },
  e4Phone:    { fontSize: 16, fontWeight: '700', color: C.g900, marginTop: 8 },
  e4PhoneSub: { fontSize: 14, color: C.g500, marginTop: 4 },
  e4Label:    { fontSize: 13, fontWeight: '700', color: C.g700, alignSelf: 'flex-start', marginBottom: 8 },
  e4NicknameInput: {
    borderWidth: 1.5, borderColor: C.brand, borderRadius: 12,
    fontSize: 16, paddingHorizontal: 14, paddingVertical: 14,
    width: '100%', color: C.g900,
  },
  e4NickStatus: {
    fontSize: 12, fontWeight: '600', marginTop: 6, alignSelf: 'flex-start',
  },
  e4Hint: { fontSize: 12, color: C.g500, marginTop: 6, alignSelf: 'flex-start' },
  e4OwnerBtn: {
    backgroundColor: 'transparent', borderWidth: 1, borderColor: C.g200,
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    width: '100%', marginTop: 10,
  },
  e4OwnerBtnText: { fontSize: 14, fontWeight: '600', color: C.g600 },
  e4Terms: { fontSize: 11, color: C.g400, textAlign: 'center', marginTop: 16, lineHeight: 17 },

  // 공통 버튼
  primaryBtn:         { backgroundColor: C.brand, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryBtnDisabled: { backgroundColor: C.g200 },
  primaryBtnText:     { fontSize: 16, fontWeight: '700', color: C.white },

  // 에러
  errorText: { fontSize: 12, color: '#E53935', marginTop: 8 },
});
