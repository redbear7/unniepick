import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LogBox } from 'react-native';
import Navigation from './src/navigation';

LogBox.ignoreLogs([
  // expo-file-system legacy API 경고
  'Method readAsStringAsync',
  // React Navigation 직렬화 경고
  'Non-serializable values were found in the navigation state',
  // react-native-track-player 미지원 메서드 경고
  'setSleepTimer',
  'sleepWhenActiveTrackReachesEnd',
  'clearSleepTimer',
  'can not be found in the ObjecitveC definition',
  // 기타 서드파티 라이브러리 경고
  'Sending `onAnimatedValueUpdate`',
  'ReactImageView: Image source',
  'new NativeEventEmitter',
  'EventEmitter.removeListener',
]);

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Navigation />
    </SafeAreaProvider>
  );
}
