// Step 1: 휴대폰 번호 입력
// "010" 고정 + 뒤 8자리, borderBottom 강조형 입력 (AuthFlow.jsx L91)
import React, { useRef } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { PALETTE, FONT_FAMILY } from '../../../constants/theme';

interface Props {
  phone:    string;           // '010' + 뒤8자리
  setPhone: (v: string) => void;
  onNext:   () => void;
  loading?: boolean;
  error?:   string;
}

export default function PhoneStep({ phone, setPhone, onNext, loading, error }: Props) {
  const inputRef = useRef<TextInput>(null);

  // "010" 이후 최대 8자리
  const rest    = phone.replace(/\D/g, '').replace(/^010/, '').slice(0, 8);
  const isValid = rest.length === 8;

  // 표시용: 1234 - 5678 (공백 포함)
  const display = rest.length > 4
    ? `${rest.slice(0, 4)} - ${rest.slice(4)}`
    : rest;

  const handleChange = (text: string) => {
    const d = text.replace(/[^\d]/g, '').slice(0, 8);
    setPhone('010' + d);
  };

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={s.body}>
        <Text style={s.title}>휴대폰 번호</Text>
        <Text style={s.sub}>쿠폰 사용 · 본인 확인에 사용돼요</Text>

        {/* 010 + 입력 */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => inputRef.current?.focus()}
          style={[s.inputRow, rest.length > 0 && s.inputRowActive]}
        >
          <Text style={s.prefix}>010</Text>
          <Text style={s.dash}> - </Text>
          <TextInput
            ref={inputRef}
            keyboardType="number-pad"
            placeholder="1234 - 5678"
            placeholderTextColor={PALETTE.gray400}
            value={display}
            onChangeText={handleChange}
            autoFocus
            style={s.input}
            maxLength={11} // "1234 - 5678"
          />
        </TouchableOpacity>

        {error ? <Text style={s.error}>{error}</Text> : null}
      </View>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.btn, !isValid && s.btnDisabled]}
          onPress={onNext}
          disabled={!isValid || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={s.btnText}>인증번호 받기</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:  { flex: 1 },
  body:  { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  footer: { paddingHorizontal: 24, paddingBottom: 32 },

  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 26,
    fontWeight: '900',
    color: PALETTE.gray900,
    letterSpacing: -0.8,
    marginBottom: 10,
  },
  sub: {
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    color: PALETTE.gray500,
    marginBottom: 36,
    lineHeight: 21,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingVertical: 18,
    borderBottomWidth: 2,
    borderBottomColor: PALETTE.gray200,
  },
  inputRowActive: { borderBottomColor: PALETTE.orange500 },
  prefix: {
    fontFamily: FONT_FAMILY,
    fontSize: 28,
    fontWeight: '800',
    color: PALETTE.gray900,
    letterSpacing: -0.5,
  },
  dash: {
    fontFamily: FONT_FAMILY,
    fontSize: 28,
    fontWeight: '700',
    color: PALETTE.gray400,
    letterSpacing: -0.5,
  },
  input: {
    flex: 1,
    fontFamily: FONT_FAMILY,
    fontSize: 28,
    fontWeight: '800',
    color: PALETTE.gray900,
    letterSpacing: -0.5,
    padding: 0,
  },
  error: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    color: PALETTE.red500,
    marginTop: 12,
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
