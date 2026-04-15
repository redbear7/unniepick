import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import {
  superAdminLogin,
  superAdminLoginWithBiometric,
  isBiometricAvailable,
  isBiometricEnrolledForAdmin,
  enrollBiometricForAdmin,
} from '../../lib/auth';
import { COLORS, RADIUS, SHADOW, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD } from '../../constants/theme';

const SAVED_EMAIL_KEY = 'superadmin_saved_email';
const SAVED_PW_KEY    = 'superadmin_saved_pw';

export default function SuperAdminLoginScreen() {
  const navigation  = useNavigation<any>();
  const [email,    setEmail]    = useState(SUPER_ADMIN_EMAIL);
  const [password, setPassword] = useState(SUPER_ADMIN_PASSWORD);
  const [loading,  setLoading]  = useState(false);
  const [bioBtnVisible, setBioBtnVisible] = useState(false);
  const pwRef = React.useRef<any>(null);

  useEffect(() => {
    (async () => {
      // 저장된 자격증명 불러오기 (없으면 기본값 유지)
      const savedEmail = await SecureStore.getItemAsync(SAVED_EMAIL_KEY);
      const savedPw    = await SecureStore.getItemAsync(SAVED_PW_KEY);
      if (savedEmail) setEmail(savedEmail);
      if (savedPw)    setPassword(savedPw);

      // 생체인증 버튼 표시 조건: 기기 지원 + 이전에 등록
      const available = await isBiometricAvailable();
      const enrolled  = await isBiometricEnrolledForAdmin();
      setBioBtnVisible(available && enrolled);
    })();
  }, []);

  // 자격증명 저장
  const handleSaveCredentials = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('이메일과 비밀번호를 입력해주세요');
      return;
    }
    await SecureStore.setItemAsync(SAVED_EMAIL_KEY, email.trim());
    await SecureStore.setItemAsync(SAVED_PW_KEY, password);
    Alert.alert('✅ 저장 완료', '다음 번에 자동으로 입력됩니다');
  };

  // 이메일 + 비밀번호 로그인
  const handleLogin = async () => {
    if (!email.trim())    { Alert.alert('이메일을 입력해주세요'); return; }
    if (!password.trim()) { Alert.alert('비밀번호를 입력해주세요'); return; }
    setLoading(true);
    const ok = await superAdminLogin(email, password);
    setLoading(false);
    if (ok) {
      // 로그인 성공 → 생체인증 등록 권유
      promptEnrollBiometric();
    } else {
      Alert.alert('로그인 실패', '이메일 또는 비밀번호를 확인해주세요');
    }
  };

  // 생체인증 로그인
  const handleBiometricLogin = async () => {
    setLoading(true);
    const ok = await superAdminLoginWithBiometric();
    setLoading(false);
    if (ok) {
      navigation.replace('SuperAdminDashboard');
    } else {
      Alert.alert('인증 실패', '생체인증에 실패했어요.\n비밀번호로 로그인해주세요');
    }
  };

  // 로그인 성공 후 생체인증 등록 권유 (최초 1회)
  const promptEnrollBiometric = async () => {
    const available = await isBiometricAvailable();
    const enrolled  = await isBiometricEnrolledForAdmin();
    if (available && !enrolled) {
      Alert.alert(
        '생체인증 등록',
        'Face ID / Touch ID로 다음 로그인을 빠르게 할까요?',
        [
          { text: '나중에', style: 'cancel', onPress: () => navigation.replace('SuperAdminDashboard') },
          {
            text: '등록하기',
            onPress: async () => {
              await enrollBiometricForAdmin();
              navigation.replace('SuperAdminDashboard');
            },
          },
        ],
      );
    } else {
      navigation.replace('SuperAdminDashboard');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.top}>
          <Text style={styles.emoji}>🛡️</Text>
          <Text style={styles.title}>시샵</Text>
          <Text style={styles.subtitle}>언니픽 슈퍼 어드민</Text>
        </View>

        {/* 생체인증 버튼 (등록된 경우에만 표시) */}
        {bioBtnVisible && (
          <TouchableOpacity
            style={[styles.bioBtn, loading && styles.disabled]}
            onPress={handleBiometricLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.bioBtnEmoji}>
              {Platform.OS === 'ios' ? '🔒' : '👆'}
            </Text>
            <Text style={styles.bioBtnText}>
              {Platform.OS === 'ios' ? 'Face ID / Touch ID로 로그인' : '지문으로 로그인'}
            </Text>
          </TouchableOpacity>
        )}

        <View style={[styles.card, SHADOW.card]}>
          {bioBtnVisible && (
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>또는 비밀번호로</Text>
              <View style={styles.dividerLine} />
            </View>
          )}

          <Text style={styles.label}>이메일</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="관리자 이메일"
            placeholderTextColor="#555"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => pwRef.current?.focus()}
          />
          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            ref={pwRef}
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="관리자 비밀번호"
            placeholderTextColor="#555"
            secureTextEntry
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />
          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.disabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.loginBtnText}>{loading ? '확인 중...' : '🛡️ 로그인'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSaveCredentials}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnText}>💾 자격증명 저장</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1A1A2E' },
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 20 },
  top: { alignItems: 'center', gap: 8 },
  emoji: { fontSize: 56 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.white },
  subtitle: { fontSize: 14, color: '#aaa' },

  // 생체인증 버튼
  bioBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#0F3460', borderRadius: RADIUS.lg,
    paddingVertical: 18, borderWidth: 1.5, borderColor: '#4A90D9',
  },
  bioBtnEmoji: { fontSize: 26 },
  bioBtnText: { color: '#4A90D9', fontSize: 16, fontWeight: '800' },

  // 구분선
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#0F3460' },
  dividerText: { fontSize: 12, color: '#555', fontWeight: '600' },

  card: {
    backgroundColor: '#16213E', borderRadius: RADIUS.lg,
    padding: 24, gap: 12, borderWidth: 1, borderColor: '#0F3460',
  },
  label: { fontSize: 14, fontWeight: '700', color: '#ccc' },
  input: {
    borderWidth: 1.5, borderColor: '#0F3460', borderRadius: RADIUS.md,
    padding: 14, fontSize: 16, color: COLORS.white, backgroundColor: '#0F3460',
  },
  loginBtn: {
    backgroundColor: '#E94560', borderRadius: RADIUS.md,
    padding: 16, alignItems: 'center', marginTop: 4,
  },
  disabled: { opacity: 0.6 },
  loginBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  saveBtn: {
    borderWidth: 1.5, borderColor: '#4A90D9', borderRadius: RADIUS.md,
    padding: 14, alignItems: 'center',
  },
  saveBtnText: { color: '#4A90D9', fontSize: 14, fontWeight: '700' },
  backBtn: { alignItems: 'center' },
  backText: { fontSize: 14, color: '#888' },
});
