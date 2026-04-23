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
]);

export default function App() {
  const [fontsLoaded] = useFonts({
    // 가변 폰트 — 레거시 호환 (기존 코드 대부분이 'WantedSans' 사용)
    'WantedSans': require('./assets/fonts/WantedSans-1.0.3/variable/WantedSansVariable.ttf'),

    // 웨이트별 개별 폰트 — typography.ts의 F.* 상수와 1:1 대응
    // iOS는 fontWeight 단독 지정만으로 커스텀 폰트 웨이트가 나오지 않아 개별 등록 필수
    'WantedSans-Regular':   require('./assets/fonts/WantedSans-Regular.ttf'),
    'WantedSans-Medium':    require('./assets/fonts/WantedSans-Medium.ttf'),
    'WantedSans-SemiBold':  require('./assets/fonts/WantedSans-SemiBold.ttf'),
    'WantedSans-Bold':      require('./assets/fonts/WantedSans-Bold.ttf'),
    'WantedSans-ExtraBold': require('./assets/fonts/WantedSans-ExtraBold.ttf'),
    'WantedSans-Black':     require('./assets/fonts/WantedSans-Black.ttf'),
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
