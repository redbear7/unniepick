// Step 1: 휴대폰 번호 입력
// 중앙 정렬 레이아웃, +82 pill + "010 1234 5678" 3-4-4 포맷 (AuthFlow.jsx L92~ 반영)
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { F, T } from '../../../constants/typography';
import LegalSheet, { LegalTab } from '../components/LegalSheet';

interface Props {
  phone:    string;           // 전체 11자리 숫자 문자열 ex) "01012345678"
  setPhone: (v: string) => void;
  onNext:   () => void;
  loading?: boolean;
  error?:   string;
  // 소셜 로그인
  onKakaoLogin?:  () => void;
  onGoogleLogin?: () => void;
  onAppleLogin?:  () => void;
  showApple?:     boolean;    // iOS 기기 + AppleAuth 가능 여부
  socialLoading?: boolean;
}

/** 숫자만 추출 후 3-4-4 공백 포맷: "010 1234 5678" */
function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3)  return d;
  if (d.length <= 7)  return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7)}`;
}

export default function PhoneStep({
  phone, setPhone, onNext, loading, error,
  onKakaoLogin, onGoogleLogin, onAppleLogin,
  showApple = false, socialLoading = false,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const [legalTab, setLegalTab] = useState<LegalTab | null>(null);

  const digits  = phone.replace(/\D/g, '');
  const isValid = digits.length === 11 && digits.startsWith('010');
  const display = formatPhone(digits);

  const handleChange = (text: string) => {
    const d = text.replace(/\D/g, '').slice(0, 11);
    setPhone(d);
  };

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={false}
      >
        {/* ── 중앙 콘텐츠 ── */}
        <View style={s.center}>
          <Text style={s.title}>전화번호를 알려주세요.</Text>

          {/* +82 pill + 번호 입력 */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => inputRef.current?.focus()}
            style={s.inputRow}
          >
            <View style={s.pill}>
              <Text style={s.pillText}>+82</Text>
            </View>
            <TextInput
              ref={inputRef}
              keyboardType="number-pad"
              placeholder="010 1234 5678"
              placeholderTextColor={PALETTE.gray400}
              value={display}
              onChangeText={handleChange}
              autoFocus
              style={s.input}
              maxLength={13} // "010 1234 5678" = 13자
            />
          </TouchableOpacity>

          {error ? <Text style={s.error}>{error}</Text> : null}
        </View>

        {/* ── 소셜 로그인 ── */}
        {(onKakaoLogin || onGoogleLogin) && (
          <View style={s.social}>
            {/* 구분선 */}
            <View style={s.divRow}>
              <View style={s.divLine} />
              <Text style={s.divText}>또는</Text>
              <View style={s.divLine} />
            </View>

            {/* 카카오 버튼 */}
            {onKakaoLogin && (
              <TouchableOpacity
                style={[s.socialBtn, s.kakaoBg]}
                onPress={onKakaoLogin}
                disabled={socialLoading || loading}
                activeOpacity={0.85}
              >
                {socialLoading
                  ? <ActivityIndicator color="#3C1E1E" size="small" />
                  : <>
                      <Text style={s.socialIcon}>💬</Text>
                      <Text style={[s.socialText, { color: '#3C1E1E' }]}>카카오로 시작하기</Text>
                    </>
                }
              </TouchableOpacity>
            )}

            {/* 구글 버튼 */}
            {onGoogleLogin && (
              <TouchableOpacity
                style={[s.socialBtn, s.googleBg]}
                onPress={onGoogleLogin}
                disabled={socialLoading || loading}
                activeOpacity={0.85}
              >
                <Text style={s.socialIcon}>G</Text>
                <Text style={[s.socialText, { color: PALETTE.gray900 }]}>Google로 시작하기</Text>
              </TouchableOpacity>
            )}

            {/* Apple 버튼 (iOS 전용) */}
            {showApple && onAppleLogin && (
              <TouchableOpacity
                style={[s.socialBtn, s.appleBg]}
                onPress={onAppleLogin}
                disabled={socialLoading || loading}
                activeOpacity={0.85}
              >
                <Text style={[s.socialIcon, { color: '#fff' }]}></Text>
                <Text style={[s.socialText, { color: '#fff' }]}>Apple로 시작하기</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── 하단 영역: 약관 + 버튼 ── */}
        <View style={s.footer}>
          {/* 약관 동의 문구 */}
          <Text style={s.termsText}>
            {'인증을 요청하면 14세 이상이며, 언니픽의 '}
            <Text
              style={s.termsLink}
              onPress={() => setLegalTab('privacy')}
            >
              개인정보처리방침
            </Text>
            {' 및 '}
            <Text
              style={s.termsLink}
              onPress={() => setLegalTab('terms')}
            >
              이용약관
            </Text>
            {'에 동의한 것으로 간주합니다.'}
          </Text>

          {/* CTA */}
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
      </ScrollView>

      {/* 약관 바텀시트 */}
      <LegalSheet
        visible={legalTab !== null}
        initTab={legalTab ?? 'privacy'}
        onClose={() => setLegalTab(null)}
      />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },

  scroll: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },

  // ── 중앙 콘텐츠 ──────────────────────────────────────────
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
  },

  title: {
    ...T.title24,
    color: PALETTE.gray900,
    textAlign: 'center',
    marginBottom: 32,
  },

  // +82 pill + input 한 줄
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },

  pill: {
    backgroundColor: PALETTE.gray100,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pillText: {
    ...T.body14,
    fontFamily: undefined,   // medium 500 weight 그대로
    color: PALETTE.gray700,
  },

  input: {
    flex: 1,
    ...T.body15,
    fontSize: 20,
    color: PALETTE.gray900,
    padding: 0,
  },

  error: {
    ...T.caption12,
    color: PALETTE.red500,
    marginTop: 12,
    textAlign: 'center',
  },

  // ── 하단 ─────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 14,
  },

  termsText: {
    ...T.caption12,
    color: PALETTE.gray600,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: PALETTE.gray700,
    textDecorationLine: 'underline',
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
    ...T.btn16,
    color: '#FFFFFF',
  },

  // ── 소셜 로그인 ──────────────────────────────────────────
  social: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    gap: 10,
  },

  divRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  divLine: {
    flex: 1,
    height: 1,
    backgroundColor: PALETTE.gray200,
  },
  divText: {
    fontSize: 12,
    color: PALETTE.gray400,
    fontWeight: '500',
  },

  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  kakaoBg: {
    backgroundColor: '#FEE500',
  },
  googleBg: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: PALETTE.gray200,
  },
  appleBg: {
    backgroundColor: '#000',
  },
  socialIcon: {
    fontSize: 18,
    lineHeight: 22,
  },
  socialText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
