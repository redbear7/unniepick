/**
 * LoginScreen — 휴대폰 SMS 인증 전용
 *
 * 가입·로그인 모두 PhoneAuthScreen(OTP 플로우)으로 연결.
 * 비로그인 둘러보기 옵션 유지.
 */

import React from 'react';
import {
  View, Text, StyleSheet,
  TouchableOpacity, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { PALETTE } from '../../constants/theme';

export default function LoginScreen() {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      {/* 로고 */}
      <View style={s.logoArea}>
        <Text style={s.logoEmoji}>🐻</Text>
        <Text style={s.logoTitle}>언니픽</Text>
        <Text style={s.logoSub}>창원의 모든 핫플레이스</Text>
      </View>

      {/* 본문 */}
      <View style={s.body}>
        <Text style={s.headline}>휴대폰 번호로{'\n'}간편하게 시작해요</Text>
        <Text style={s.sub}>SMS 인증 한 번으로 가입과 로그인이 동시에!</Text>

        {/* 휴대폰 인증 버튼 */}
        <TouchableOpacity
          style={s.phoneBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('PhoneAuth')}
        >
          <Text style={s.phoneBtnIcon}>📱</Text>
          <Text style={s.phoneBtnLabel}>휴대폰으로 시작하기</Text>
        </TouchableOpacity>

        {/* 비로그인 둘러보기 */}
        <TouchableOpacity
          style={s.skipBtn}
          onPress={() => navigation.replace('CustomerTabs')}
        >
          <Text style={s.skipText}>지금은 둘러볼게요</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  logoArea: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 24,
    gap: 6,
  },
  logoEmoji: {
    fontSize: 64,
  },
  logoTitle: {
    fontSize: 30,
    fontFamily: 'WantedSans-Bold',
    color: PALETTE.orange500,
    letterSpacing: -0.5,
  },
  logoSub: {
    fontSize: 14,
    color: '#9097A0',
    fontFamily: 'WantedSans-Regular',
  },
  body: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 32,
    alignItems: 'center',
    gap: 12,
  },
  headline: {
    fontSize: 26,
    fontFamily: 'WantedSans-Bold',
    color: '#191F28',
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 4,
  },
  sub: {
    fontSize: 14,
    color: '#636E7C',
    fontFamily: 'WantedSans-Regular',
    textAlign: 'center',
    marginBottom: 16,
  },
  phoneBtn: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: PALETTE.orange500,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  phoneBtnIcon: {
    fontSize: 22,
  },
  phoneBtnLabel: {
    fontSize: 17,
    fontFamily: 'WantedSans-Bold',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  skipBtn: {
    marginTop: 8,
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 14,
    color: '#9097A0',
    fontFamily: 'WantedSans-Regular',
    textDecorationLine: 'underline',
  },
});
