// SplashScreen — V1 Centered
// useSplashPhase: enter(0ms) → hold(450ms) → exit(1500ms) → done(1800ms)
// 완료 후 세션 상태에 따라 CustomerTabs or PhoneAuth 로 reset

import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase, clearInvalidSession } from '../../lib/supabase';
import { FONT_FAMILY, PALETTE } from '../../constants/theme';

const SPLASH_DURATION = 1800;
const SPLASH_TAGLINE  = '창원의 모든 핫플레이스';
const SPLASH_VERSION  = 'v1.0.0';

// ── 모션 훅: enter → hold → exit ──────────────────────────────────
type SplashPhase = 'enter' | 'hold' | 'exit';

function useSplashPhase(duration: number, onDone: () => void): SplashPhase {
  const [phase, setPhase] = React.useState<SplashPhase>('enter');
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 450);
    const t2 = setTimeout(() => setPhase('exit'), duration - 300);
    const t3 = setTimeout(() => onDone(), duration);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return phase;
}

// ── SplashCentered — V1 ───────────────────────────────────────────
export default function SplashScreen() {
  const navigation  = useNavigation<any>();
  const routeRef    = useRef<string | null>(null);   // 세션 확인 결과
  const animDoneRef = useRef(false);                 // 애니메이션 완료 여부

  // Animated values
  const wordmarkOpacity  = useRef(new Animated.Value(0)).current;
  const wordmarkScale    = useRef(new Animated.Value(0.92)).current;
  const taglineOpacity   = useRef(new Animated.Value(0)).current;
  const taglineY         = useRef(new Animated.Value(6)).current;
  const versionOpacity   = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  // ── navigate (둘 다 완료됐을 때만 실행) ──────────────────────────
  const tryNavigate = useCallback(() => {
    if (!animDoneRef.current || !routeRef.current) return;
    navigation.reset({ index: 0, routes: [{ name: routeRef.current }] });
  }, [navigation]);

  // ── 세션 확인 (애니메이션과 병렬) ────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (error?.message?.includes('Refresh Token')) {
        await clearInvalidSession();
        routeRef.current = 'PhoneAuth';
      } else {
        routeRef.current = data.session ? 'CustomerTabs' : 'PhoneAuth';
      }
      tryNavigate();
    });
  }, [tryNavigate]);

  // ── 애니메이션 시퀀스 ────────────────────────────────────────────
  const handleAnimDone = useCallback(() => {
    animDoneRef.current = true;
    tryNavigate();
  }, [tryNavigate]);

  useSplashPhase(SPLASH_DURATION, handleAnimDone);

  useEffect(() => {
    // hold (450ms): 워드마크 페이드인 + 스케일
    const t1 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(wordmarkOpacity, {
          toValue: 1, duration: 600, useNativeDriver: true,
        }),
        Animated.spring(wordmarkScale, {
          toValue: 1, tension: 60, friction: 8, useNativeDriver: true,
        }),
      ]).start();

      // 태그라인: 300ms 딜레이
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(taglineOpacity, {
            toValue: 1, duration: 600, useNativeDriver: true,
          }),
          Animated.timing(taglineY, {
            toValue: 0, duration: 600, useNativeDriver: true,
          }),
        ]).start();
      }, 300);

      // 버전: 500ms 딜레이
      setTimeout(() => {
        Animated.timing(versionOpacity, {
          toValue: 1, duration: 400, useNativeDriver: true,
        }).start();
      }, 500);
    }, 450);

    // exit (1500ms): 컨테이너 페이드아웃
    const t2 = setTimeout(() => {
      Animated.timing(containerOpacity, {
        toValue: 0, duration: 300, useNativeDriver: true,
      }).start();
    }, SPLASH_DURATION - 300);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[s.container, { opacity: containerOpacity }]}>
      {/* 중앙 콘텐츠 */}
      <View style={s.center}>
        <Animated.Text
          style={[s.wordmark, { opacity: wordmarkOpacity, transform: [{ scale: wordmarkScale }] }]}
        >
          언니픽
        </Animated.Text>
        <Animated.Text
          style={[s.tagline, { opacity: taglineOpacity, transform: [{ translateY: taglineY }] }]}
        >
          {SPLASH_TAGLINE}
        </Animated.Text>
      </View>

      {/* 버전 */}
      <Animated.Text style={[s.version, { opacity: versionOpacity }]}>
        {SPLASH_VERSION}
      </Animated.Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  wordmark: {
    fontFamily: FONT_FAMILY,
    fontSize: 60,
    fontWeight: '900',
    color: PALETTE.orange500,
    letterSpacing: -2.4,
  },
  tagline: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(25,31,40,0.55)',
    letterSpacing: -0.1,
  },
  version: {
    position: 'absolute',
    bottom: 36,
    fontFamily: FONT_FAMILY,
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(25,31,40,0.28)',
    letterSpacing: 0.5,
  },
});
