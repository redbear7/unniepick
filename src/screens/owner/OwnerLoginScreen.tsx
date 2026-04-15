import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet,
  TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { ownerLogin } from '../../lib/auth';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';

const STORAGE_KEY = 'owner_saved_password';

export default function OwnerLoginScreen() {
  const navigation = useNavigation<any>();
  const [password,    setPassword]    = useState('');
  const [loading,     setLoading]     = useState(false);
  const [saveEnabled, setSaveEnabled] = useState(false);
  const [hasSaved,    setHasSaved]    = useState(false);

  // 앱 시작 시 저장된 비밀번호 불러오기
  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync(STORAGE_KEY);
      if (saved) {
        setPassword(saved);
        setSaveEnabled(true);
        setHasSaved(true);
      }
    })();
  }, []);

  const handleLogin = async () => {
    if (!password.trim()) {
      Alert.alert('비밀번호를 입력해주세요');
      return;
    }
    setLoading(true);
    const success = await ownerLogin(password);
    setLoading(false);

    if (success) {
      // 저장 체크돼 있으면 저장, 해제돼 있으면 삭제
      if (saveEnabled) {
        await SecureStore.setItemAsync(STORAGE_KEY, password);
      } else {
        await SecureStore.deleteItemAsync(STORAGE_KEY);
      }
      navigation.replace('OwnerDashboard');
    } else {
      Alert.alert('비밀번호가 틀렸습니다', '다시 확인해주세요');
    }
  };

  const handleClearSaved = async () => {
    Alert.alert('저장된 비밀번호 삭제', '저장된 비밀번호를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await SecureStore.deleteItemAsync(STORAGE_KEY);
          setPassword('');
          setSaveEnabled(false);
          setHasSaved(false);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.top}>
          <Text style={styles.emoji}>🍖</Text>
          <Text style={styles.title}>사장님 로그인</Text>
          <Text style={styles.subtitle}>언니픽 관리자 전용</Text>
        </View>

        <View style={[styles.card, SHADOW.card]}>
          <Text style={styles.label}>관리자 비밀번호</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="비밀번호를 입력하세요"
            placeholderTextColor={COLORS.textMuted}
            secureTextEntry
            autoCapitalize="none"
            onSubmitEditing={handleLogin}
          />

          {/* 비밀번호 저장 체크박스 */}
          <TouchableOpacity
            style={styles.saveRow}
            onPress={() => setSaveEnabled(v => !v)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, saveEnabled && styles.checkboxOn]}>
              {saveEnabled && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <Text style={styles.saveLabel}>비밀번호 저장</Text>
            {hasSaved && (
              <TouchableOpacity onPress={handleClearSaved} style={styles.clearBtn}>
                <Text style={styles.clearText}>저장 삭제</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.loginBtnText}>
              {loading ? '확인 중...' : '로그인'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← 고객 화면으로</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 24 },
  top:       { alignItems: 'center', gap: 8 },
  emoji:     { fontSize: 56 },
  title:     { fontSize: 26, fontWeight: '800', color: COLORS.text },
  subtitle:  { fontSize: 14, color: COLORS.textMuted },
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 24, gap: 12,
  },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  input: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: 14, fontSize: 16, color: COLORS.text, backgroundColor: COLORS.background,
  },

  // 저장 체크박스 행
  saveRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  checkbox:    { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5,
                 borderColor: COLORS.border, backgroundColor: COLORS.background,
                 alignItems: 'center', justifyContent: 'center' },
  checkboxOn:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkMark:   { fontSize: 12, color: COLORS.white, fontWeight: '900' },
  saveLabel:   { fontSize: 14, color: COLORS.textMuted, flex: 1 },
  clearBtn:    { paddingHorizontal: 8, paddingVertical: 3,
                 backgroundColor: '#FEE2E2', borderRadius: 6 },
  clearText:   { fontSize: 11, color: '#DC2626', fontWeight: '700' },

  loginBtn:         { backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
                      padding: 16, alignItems: 'center', marginTop: 4 },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText:     { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  backBtn:          { alignItems: 'center' },
  backText:         { fontSize: 14, color: COLORS.textMuted },
});
