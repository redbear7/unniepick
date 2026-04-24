import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LogBox, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import Navigation from './src/navigation';

// ── 포그라운드 알림 핸들러 (앱 실행 중에도 알림 표시) ──────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
  }),
});

LogBox.ignoreLogs([
  'Method readAsStringAsync',
  'Non-serializable values were found in the navigation state',
  'setSleepTimer',
  'sleepWhenActiveTrackReachesEnd',
  'clearSleepTimer',
  'can not be found in the ObjecitveC definition',
  'Sending `onAnimatedValueUpdate`',
  'ReactImageView: Image source',
  'new NativeEventEmitter',
  'EventEmitter.removeListener',
  // Supabase SDK 내부: 만료된 refresh token 자동 갱신 실패 — navigation에서 처리됨
  'Invalid Refresh Token',
  'Refresh Token Not Found',
  'AuthApiError',
]);

export default function App() {
  const [fontsLoaded] = useFonts({
    // Variable 폰트 — 단일 파일로 400~900 전 웨이트 커버
    // typography.ts의 F.xxx는 fontFamily: 'Wanted Sans Variable' + fontWeight 조합으로 동작
    'Wanted Sans Variable': require('./assets/fonts/WantedSans-1.0.3/variable/WantedSansVariable.ttf'),
  });

  // 폰트 로드 전 스플래쉬 유지
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Navigation />
    </SafeAreaProvider>
  );
}
