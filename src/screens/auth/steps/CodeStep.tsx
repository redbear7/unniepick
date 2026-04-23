// Step 2: SMS 인증번호 6자리
// 숨겨진 단일 TextInput + 시각적 6칸 박스, 자동완성(oneTimeCode), 타이머 3분
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { PALETTE } from '../../../constants/theme';
import { T } from '../../../constants/typography';

interface Props {
  phone:   string;           // 마스킹 표시용
  onNext:  (code: string) => void;
  onResend: () => void;
  loading?: boolean;
  error?:  string;
}

function formatTimer(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function maskPhone(phone: string) {
  const d = phone.replace(/\D/g, '');
  return d.length === 11
    ? `${d.slice(0, 3)}-****-${d.slice(7)}`
    : phone;
}

export default function CodeStep({ phone, onNext, onResend, loading, error }: Props) {
  const [code,    setCode]    = useState('');
  const [seconds, setSeconds] = useState(180);
  const [shake,   setShake]   = useState(false);
  const hiddenRef = useRef<TextInput>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // 타이머
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { clearInterval(timerRef.current!); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // 백그라운드에서 복귀 시 포커스 복원 (키보드 재표시)
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setTimeout(() => hiddenRef.current?.focus(), 150);
      }
    });
    return () => sub.remove();
  }, []);

  // 6자리 완성 시 자동 제출
  useEffect(() => {
    if (code.length === 6) {
      onNext(code);
    }
  }, [code, onNext]);

  const handleChange = useCallback((text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, 6);
    setCode(clean);
  }, []);

  const handleResend = () => {
    setCode('');
    setSeconds(180);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { clearInterval(timerRef.current!); return 0; }
        return s - 1;
      });
    }, 1000);
    onResend();
  };

  // 에러 발생 시 shake
  useEffect(() => {
    if (error) {
      setShake(true);
      setCode('');
      const t = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(t);
    }
  }, [error]);

  const timerExpired = seconds === 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={false}
      >
    <View style={s.body}>
      <Text style={s.title}>인증번호를{'\n'}입력해주세요</Text>
      <View style={s.subBox}>
        <Text style={s.subBold}>{maskPhone(phone)}</Text>
        <Text style={s.sub}>으로 6자리 인증번호를 발송했어요</Text>
      </View>

      {/* 시각적 6칸 + SMS 자동완성 input 오버레이 */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => hiddenRef.current?.focus()}
        style={[s.boxRow, shake && s.shake]}
      >
        {/* SMS 자동완성 input — 박스 위에 덮어씌워 iOS QuickType 인식 */}
        <TextInput
          ref={hiddenRef}
          value={code}
          onChangeText={handleChange}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          caretHidden
          style={s.hiddenInput}
        />
        {Array.from({ length: 6 }).map((_, i) => {
          const ch       = code[i] || '';
          const isActive = i === code.length && !loading;
          return (
            <View
              key={i}
              style={[
                s.box,
                ch       && s.boxFilled,
                isActive && s.boxActive,
                shake    && s.boxShake,
              ]}
            >
              {loading && i === 0 ? (
                <ActivityIndicator size="small" color={PALETTE.orange500} />
              ) : isActive && !ch ? (
                <View style={s.cursor} />
              ) : (
                <Text style={s.boxText}>{ch}</Text>
              )}
            </View>
          );
        })}
      </TouchableOpacity>

      {/* 타이머 + 재발송 */}
      <View style={s.timerRow}>
        <Text style={[s.timer, timerExpired && s.timerExpired]}>
          {formatTimer(seconds)}
        </Text>
        <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
          <Text style={s.resend}>다시 받기</Text>
        </TouchableOpacity>
      </View>

      {/* 에러 */}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  title: {
    ...T.title26,
    color: PALETTE.gray900,
    marginBottom: 10,
  },
  subBox: {
    marginBottom: 28,
    gap: 2,
  },
  sub: {
    ...T.body13,
    color: PALETTE.gray500,
  },
  subBold: { ...T.label13, color: PALETTE.gray900 },
  hiddenInput: {
    // iOS SMS 자동완성: 실제 크기가 있어야 QuickType 바에 제안이 뜸
    // opacity:0 이면 iOS가 무시 → 0.01로 설정해 투명하게 유지
    position:   'absolute',
    top:        0, left: 0, right: 0, bottom: 0,
    opacity:    0.01,
    color:      'transparent',
    fontSize:   1,
  },
  boxRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  shake: {
    // React Native doesn't support CSS animations natively;
    // for production add Reanimated shake here
  },
  box: {
    flex: 1,
    height: 60,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PALETTE.gray200,
    backgroundColor: PALETTE.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: {
    borderColor: PALETTE.orange500,
    backgroundColor: '#FFFFFF',
  },
  boxActive: {
    borderColor: PALETTE.orange500,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  boxShake: { borderColor: PALETTE.red500 },
  boxText: {
    ...T.otp26,
    color: PALETTE.gray900,
  },
  cursor: {
    width: 2, height: 24,
    backgroundColor: PALETTE.orange500,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  timer: {
    ...T.btn14,
    color: PALETTE.orange500,
  },
  timerExpired: { color: PALETTE.red500 },
  resend: {
    ...T.btnSmall,
    color: PALETTE.orange500,
    textDecorationLine: 'underline',
  },
  error: {
    ...T.caption12,
    color: PALETTE.red500,
    marginTop: 4,
  },
});
