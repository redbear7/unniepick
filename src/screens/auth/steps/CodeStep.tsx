// Step 2: SMS 인증번호 6자리
// 숨겨진 단일 TextInput + 시각적 6칸 박스, 자동완성(oneTimeCode), 타이머 3분
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { PALETTE, FONT_FAMILY } from '../../../constants/theme';

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
    <View style={s.body}>
      <Text style={s.title}>인증번호를{'\n'}입력해주세요</Text>
      <Text style={s.sub}>
        <Text style={s.subBold}>{maskPhone(phone)}</Text>
        {' '}으로 6자리 인증번호를{'\n'}발송했어요
      </Text>

      {/* 숨겨진 input — SMS 자동완성 */}
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

      {/* 시각적 6칸 */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => hiddenRef.current?.focus()}
        style={[s.boxRow, shake && s.shake]}
      >
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
              {loading && i === 0
                ? <ActivityIndicator size="small" color={PALETTE.orange500} />
                : <Text style={s.boxText}>{ch}</Text>
              }
              {isActive && !ch && <View style={s.cursor} />}
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
  );
}

const s = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
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
  subBold: { fontWeight: '700', color: PALETTE.gray900 },
  hiddenInput: {
    position: 'absolute',
    width: 1, height: 1, opacity: 0,
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
    fontFamily: FONT_FAMILY,
    fontSize: 24,
    fontWeight: '900',
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
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    fontWeight: '700',
    color: PALETTE.orange500,
  },
  timerExpired: { color: PALETTE.red500 },
  resend: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: '700',
    color: PALETTE.orange500,
    textDecorationLine: 'underline',
  },
  error: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    color: PALETTE.red500,
    marginTop: 4,
  },
});
