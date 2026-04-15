import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  signInWithGoogle,
  signInWithKakao,
  signInWithApple,
  ensureSocialProfile,
  isAppleSignInAvailable,
} from '../../lib/services/socialAuthService';

const A = {
  bg:      '#F2F2F7',
  surface: '#FFFFFF',
  fill:    '#E5E5EA',
  label:   '#1C1C1E',
  label2:  '#636366',
  label3:  '#8E8E93',
  sep:     '#C6C6C8',
  blue:    '#007AFF',
  green:   '#34C759',
  orange:  '#FF6F0F',
  red:     '#FF3B30',
};

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const [socialLoading, setSocialLoading] = useState<'google' | 'kakao' | 'apple' | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  // ── 소셜 로그인 공통 처리 ────────────────────────────────────────────
  const handleSocialLogin = async (provider: 'google' | 'kakao' | 'apple') => {
    setSocialLoading(provider);
    try {
      let session;
      if (provider === 'google')  session = await signInWithGoogle();
      else if (provider === 'kakao') session = await signInWithKakao();
      else session = await signInWithApple();

      const result = await ensureSocialProfile(session);

      if (result.isNew) {
        Alert.alert(
          '🎉 가입 완료!',
          `${result.name}님, 환영해요!\n언니픽과 함께 맛있는 혜택을 즐겨보세요.`,
          [{ text: '시작하기', onPress: () => navigation.replace('CustomerTabs') }],
        );
      } else {
        navigation.replace('CustomerTabs');
      }
    } catch (e: any) {
      if (e.message === 'CANCELLED') return;
      Alert.alert(
        '로그인 실패',
        e.message?.includes('not supported')
          ? 'Apple 로그인은 iPhone에서만 가능해요.'
          : (e.message ?? '잠시 후 다시 시도해주세요.'),
      );
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
          {/* 로고 */}
          <View style={styles.logoArea}>
            <Text style={styles.logoEmoji}>🐻</Text>
            <Text style={styles.logoTitle}>언니픽</Text>
            <Text style={styles.logoSub}>우리 동네 맛집 · 쿠폰 · 혜택 플랫폼</Text>
          </View>

          {/* ── 소셜 로그인 버튼 ── */}
          <View style={styles.socialGroup}>
            {/* 카카오 */}
            <SocialBtn
              loading={socialLoading === 'kakao'}
              onPress={() => handleSocialLogin('kakao')}
              style={styles.kakaoBtn}
              icon="K"
              iconStyle={styles.kakaoIcon}
              label="카카오로 시작하기"
              labelStyle={styles.kakaoBtnText}
            />

            {/* 구글 */}
            <SocialBtn
              loading={socialLoading === 'google'}
              onPress={() => handleSocialLogin('google')}
              style={styles.googleBtn}
              icon="G"
              iconStyle={styles.googleIcon}
              label="구글로 시작하기"
              labelStyle={styles.googleBtnText}
            />

            {/* 애플 — iOS 기기만 표시 */}
            {appleAvailable && (
              <SocialBtn
                loading={socialLoading === 'apple'}
                onPress={() => handleSocialLogin('apple')}
                style={styles.appleBtn}
                icon=""
                iconStyle={styles.appleIcon}
                label=" Apple로 시작하기"
                labelStyle={styles.appleBtnText}
              />
            )}
          </View>

          {/* 비로그인 계속 */}
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => navigation.replace('CustomerTabs')}
          >
            <Text style={styles.skipText}>로그인 없이 둘러보기</Text>
          </TouchableOpacity>
        </ScrollView>
    </SafeAreaView>
  );
}

// ── 소셜 버튼 공통 컴포넌트 ─────────────────────────────────────────────
function SocialBtn({
  loading, onPress, style, icon, iconStyle, label, labelStyle,
}: any) {
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
  safe: { flex: 1, backgroundColor: A.bg },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 40, gap: 14, justifyContent: 'center' },

  // 로고
  logoArea: { alignItems: 'center', paddingVertical: 20, gap: 6, marginBottom: 40 },
  logoEmoji: { fontSize: 72 },
  logoTitle: { fontSize: 32, fontWeight: '700', color: A.label, letterSpacing: -0.5 },
  logoSub: { fontSize: 15, color: A.label3 },

  // 소셜 버튼 그룹
  socialGroup: { gap: 10 },
  socialBtn: {
    height: 56, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10,
  },
  socialBtnIcon: { fontSize: 18, fontWeight: '900' },
  socialBtnLabel: { fontSize: 17, fontWeight: '600' },

  // 카카오
  kakaoBtn: { backgroundColor: '#FEE500' },
  kakaoIcon: { color: '#191600' },
  kakaoBtnText: { color: '#191600' },

  // 구글
  googleBtn: { backgroundColor: A.surface, borderWidth: 0.5, borderColor: A.sep },
  googleIcon: { color: '#4285F4', fontWeight: '900' },
  googleBtnText: { color: A.label },

  // 애플
  appleBtn: { backgroundColor: '#000' },
  appleIcon: { color: '#fff', fontSize: 20 },
  appleBtnText: { color: '#fff' },

  // 비로그인 스킵
  skipBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  skipText: { fontSize: 15, color: A.blue },
});
