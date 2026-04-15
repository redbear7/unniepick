import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';
import {
  signInWithGoogle,
  signInWithKakao,
  signInWithApple,
  ensureSocialProfile,
  isAppleSignInAvailable,
} from '../../lib/services/socialAuthService';

export default function SignUpScreen() {
  const navigation = useNavigation<any>();
  const [socialLoading, setSocialLoading] = useState<'google' | 'kakao' | 'apple' | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  // ── 소셜 가입/로그인 ────────────────────────────────────────────────
  const handleSocialSignUp = async (provider: 'google' | 'kakao' | 'apple') => {
    setSocialLoading(provider);
    try {
      let session;
      if (provider === 'google')     session = await signInWithGoogle();
      else if (provider === 'kakao') session = await signInWithKakao();
      else                           session = await signInWithApple();

      const result = await ensureSocialProfile(session);

      Alert.alert(
        result.isNew ? '🎉 가입 완료!' : '✅ 로그인 완료!',
        `${result.name}님, 환영해요!\n언니픽과 함께 맛있는 혜택을 즐겨보세요.`,
        [{ text: '시작하기', onPress: () => navigation.replace('CustomerTabs') }],
      );
    } catch (e: any) {
      if (e.message === 'CANCELLED') return;
      Alert.alert('오류', e.message ?? '잠시 후 다시 시도해주세요.');
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* 헤더 */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backBtn}>← 뒤로</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>회원가입</Text>
            <View style={{ width: 60 }} />
          </View>

          {/* 안내 */}
          <View style={styles.tipBox}>
            <Text style={styles.tipText}>
              소셜 계정으로 가입하면{'\n'}
              별도 비밀번호 없이 간편하게 로그인할 수 있어요 🎉
            </Text>
          </View>

          {/* ── 소셜 가입 버튼 ── */}
          <View style={styles.socialGroup}>
            <SocialBtn
              loading={socialLoading === 'kakao'}
              onPress={() => handleSocialSignUp('kakao')}
              style={styles.kakaoBtn}
              icon="K"
              iconStyle={styles.kakaoIcon}
              label="카카오로 간편 가입"
              labelStyle={styles.kakaoBtnText}
            />
            <SocialBtn
              loading={socialLoading === 'google'}
              onPress={() => handleSocialSignUp('google')}
              style={styles.googleBtn}
              icon="G"
              iconStyle={styles.googleIcon}
              label="구글로 간편 가입"
              labelStyle={styles.googleBtnText}
            />
            {appleAvailable && (
              <SocialBtn
                loading={socialLoading === 'apple'}
                onPress={() => handleSocialSignUp('apple')}
                style={styles.appleBtn}
                icon=""
                iconStyle={styles.appleIcon}
                label=" Apple로 간편 가입"
                labelStyle={styles.appleBtnText}
              />
            )}
          </View>

          {/* 로그인 링크 */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>이미 계정이 있으신가요?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>로그인</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
    </SafeAreaView>
  );
}

// ── 소셜 버튼 공통 ──────────────────────────────────────────────────────
function SocialBtn({ loading, onPress, style, icon, iconStyle, label, labelStyle }: any) {
  return (
    <TouchableOpacity
      style={[styles.socialBtn, style, loading && { opacity: 0.7 }]}
      onPress={onPress}
      disabled={!!loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={labelStyle?.color ?? '#000'} />
      ) : (
        <>
          <Text style={[styles.socialBtnIcon, iconStyle]}>{icon}</Text>
          <Text style={[styles.socialBtnLabel, labelStyle]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: { flexGrow: 1, padding: 20, gap: 14, paddingBottom: 40 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 4,
  },
  backBtn: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },

  // 안내 박스
  tipBox: {
    backgroundColor: COLORS.primaryLight ?? '#FFF0EC',
    borderRadius: RADIUS.md, padding: 14,
    borderLeftWidth: 3, borderLeftColor: COLORS.primary,
  },
  tipText: { fontSize: 13, color: COLORS.text, lineHeight: 20 },

  // 소셜 버튼
  socialGroup: { gap: 10 },
  socialBtn: {
    height: 52, borderRadius: RADIUS.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, ...SHADOW.card,
  },
  socialBtnIcon: { fontSize: 18, fontWeight: '900' },
  socialBtnLabel: { fontSize: 16, fontWeight: '700' },

  kakaoBtn: { backgroundColor: '#FEE500' },
  kakaoIcon: { color: '#3A1D1D' },
  kakaoBtnText: { color: '#3A1D1D' },

  googleBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#DADCE0' },
  googleIcon: { color: '#4285F4', fontWeight: '900' },
  googleBtnText: { color: '#3C4043' },

  appleBtn: { backgroundColor: '#000' },
  appleIcon: { color: '#fff', fontSize: 20 },
  appleBtnText: { color: '#fff' },

  // 로그인 링크
  loginRow: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  loginText: { fontSize: 14, color: COLORS.textMuted },
  loginLink: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
});
