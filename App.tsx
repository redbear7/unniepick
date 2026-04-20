import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LogBox, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import Navigation from './src/navigation';

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
    'WantedSans': require('./assets/fonts/WantedSans-1.0.3/variable/WantedSansVariable.ttf'),
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
