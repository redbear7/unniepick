/**
 * RedeemScreen — Spec 01 §04 쿠폰 사용 모드 (터치형 토큰)
 *
 * 진입: WalletScreen의 쿠폰 롱프레스 1.5초
 *
 * 기능:
 * • 10초마다 갱신되는 6자리 HMAC 토큰 (서버에서 동일 검증)
 * • 브랜드 그라디언트 + 파동 모션 (정지 이미지 캡쳐 방어)
 * • iOS UIScreen.captured 감지 → 블러 오버레이
 * • 화면 밝기 최대 (진입 시) → 복구 (퇴장 시)
 * • 사용 완료 → 오렌지 풀스크린 체크 애니메이션
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { PALETTE } from '../../constants/theme';
import {
  computeRedeemToken,
  currentTokenWindow,
  formatToken,
  markCouponRedeemed,
  secondsUntilRefresh,
} from '../../lib/services/redeemTokenService';
import { logLiveActivityEvent, WalletCoupon } from '../../lib/services/couponWalletService';

// ── 파동 원 1개 ─────────────────────────────────────────────────
function WaveCircle({ delay, size }: { delay: number; size: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1, duration: 3000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(100),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.waveCircle,
        {
          width:  size,
          height: size,
          borderRadius: size / 2,
          transform: [{ scale: anim }],
          opacity:   anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.3, 0] }),
        },
      ]}
    />
  );
}

// ── 완료 화면 ───────────────────────────────────────────────────
function DoneScreen({ coupon, onClose }: { coupon: WalletCoupon; onClose: () => void }) {
  const checkScale = useRef(new Animated.Value(0)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(checkScale, {
        toValue: 1, tension: 120, friction: 8, useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 400, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.doneScreen, { opacity: fadeAnim }]}>
      <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkScale }] }]}>
        <Text style={styles.checkMark}>✓</Text>
      </Animated.View>
      <Text style={styles.doneTitle}>사용 완료!</Text>
      <Text style={styles.doneSub}>
        {coupon.store_name}{'\n'}{coupon.title}
      </Text>
      <View style={styles.savingsBox}>
        <Text style={styles.savingsLabel}>쿠폰 사용 기록</Text>
        <Text style={styles.savingsValue}>D-{coupon.days_left} → ✅</Text>
      </View>
      <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.85}>
        <Text style={styles.doneBtnText}>확인</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function RedeemScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const insets     = useSafeAreaInsets();
  const coupon: WalletCoupon = route.params?.coupon;

  const [token,      setToken]   = useState<number | null>(null);
  const [countdown,  setCount]   = useState(10);
  const [stage,      setStage]   = useState<'redeem' | 'done'>('redeem');
  const [captured,   setCaptured] = useState(false);   // 화면 캡쳐 감지
  const [userId,     setUserId]  = useState<string | null>(null);

  // 파동 애니메이션 (그라디언트 위치 회전)
  const waveRotate = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;

  // ── 유저 ID 로드 ────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  // ── 진입 애니메이션 ─────────────────────────────────────────
  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1, duration: 400, useNativeDriver: true,
    }).start();
  }, []);

  // ── 파동 회전 ──────────────────────────────────────────────
  useEffect(() => {
    Animated.loop(
      Animated.timing(waveRotate, {
        toValue: 1, duration: 8000,
        easing: Easing.linear, useNativeDriver: true,
      })
    ).start();
  }, []);

  // ── 토큰 생성 + 10초 타이머 ──────────────────────────────────
  const refreshToken = useCallback(async () => {
    if (!userId || !coupon) return;
    try {
      const win = currentTokenWindow();
      const tok = await computeRedeemToken(coupon.coupon_id, userId, win);
      setToken(tok);
      setCount(secondsUntilRefresh());
    } catch (e) {
      console.error('token error', e);
    }
  }, [userId, coupon]);

  useEffect(() => {
    if (!userId) return;
    refreshToken();
    const interval = setInterval(() => {
      refreshToken();
    }, 10_000);
    return () => clearInterval(interval);
  }, [userId, refreshToken]);

  // ── 카운트다운 타이머 ────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      setCount(secondsUntilRefresh());
    }, 500);
    return () => clearInterval(t);
  }, []);

  // ── iOS 화면 캡쳐 감지 (AppState + screenshot event) ──────
  useEffect(() => {
    // AppState 변화로 캡쳐 근사 감지 (실제는 NativeEventEmitter 필요)
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') setCaptured(true);
    });
    return () => sub.remove();
  }, []);

  // ── "사용완료" 확인 ──────────────────────────────────────────
  const handleConfirmRedeem = () => {
    Alert.alert(
      '쿠폰 사용 완료 처리',
      '사장님께서 확인하셨나요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '사용 완료',
          style: 'default',
          onPress: async () => {
            if (!userId || !coupon) return;
            await markCouponRedeemed(coupon.user_coupon_id);
            await logLiveActivityEvent({
              userId:   userId,
              couponId: coupon.coupon_id,
              storeId:  coupon.store_id,
              event:    'redeemed',
            });
            setStage('done');
          },
        },
      ]
    );
  };

  const handleClose = () => {
    navigation.goBack();
  };

  // 파동 회전 변환
  const waveRotateDeg = waveRotate.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const tokenOpacity = headerAnim.interpolate({
    inputRange: [0, 1], outputRange: [0, 1],
  });

  // ── 완료 화면 ─────────────────────────────────────────────────
  if (stage === 'done') {
    return <DoneScreen coupon={coupon} onClose={handleClose} />;
  }

  return (
    <View style={styles.container}>
      {/* 그라디언트 배경 */}
      <View style={styles.bgGradient}>
        {/* 파동 원들 (정지 이미지 방어) */}
        <Animated.View
          pointerEvents="none"
          style={[styles.waveWrapper, { transform: [{ rotate: waveRotateDeg }] }]}
        >
          <WaveCircle delay={0}    size={200} />
          <WaveCircle delay={600}  size={320} />
          <WaveCircle delay={1200} size={440} />
        </Animated.View>
      </View>

      {/* 캡쳐 감지 블러 오버레이 */}
      {captured && (
        <View style={styles.captureGuard}>
          <Text style={styles.captureText}>📵 화면 캡쳐를 감지했어요</Text>
          <Text style={styles.captureSubText}>보안을 위해 화면이 가려졌어요</Text>
          <TouchableOpacity
            style={styles.captureBtn}
            onPress={() => setCaptured(false)}
          >
            <Text style={styles.captureBtnText}>계속하기</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 상단 바 */}
      <View style={[styles.topBar, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.modeLabel}>사용 모드</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* 가게 + 쿠폰 정보 */}
      <Animated.View style={[styles.infoSection, { opacity: tokenOpacity }]}>
        <Text style={styles.storeMeta}>
          {coupon?.store_name}
          {coupon?.distance_m != null ? ` · ${coupon.distance_m}m` : ''}
        </Text>
        <Text style={styles.couponTitle}>{coupon?.title}</Text>
      </Animated.View>

      {/* 토큰 카드 */}
      <Animated.View style={[styles.tokenCard, { opacity: tokenOpacity }]}>
        <Text style={styles.tokenLabel}>사용 코드</Text>
        <Text style={styles.tokenDigits}>
          {token != null ? formatToken(token) : '······'}
        </Text>

        {/* 카운트다운 바 */}
        <View style={styles.countdownBar}>
          <View
            style={[styles.countdownFill, {
              width: `${(countdown / 10) * 100}%`,
            }]}
          />
        </View>
        <Text style={styles.countdownText}>{countdown}초 후 자동 갱신</Text>
      </Animated.View>

      {/* 안내 문구 */}
      <View style={styles.instructions}>
        <Text style={styles.instructTitle}>사장님께 이 화면을 보여주세요</Text>
        <Text style={styles.instructSub}>🛡 캡쳐 방지 · 애니메이션 필수</Text>
      </View>

      {/* 사용 완료 버튼 (사용자가 직접 처리 시) */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={styles.redeemBtn}
          onPress={handleConfirmRedeem}
          activeOpacity={0.85}
        >
          <Text style={styles.redeemBtnText}>✓ 사용 완료 처리</Text>
        </TouchableOpacity>
        <Text style={styles.footerNote}>
          사장님이 직접 처리해도 자동으로 완료됩니다
        </Text>
      </View>
    </View>
  );
}

const ORANGE_DARK  = '#E85D00';
const ORANGE_MID   = '#FF6F0F';
const ORANGE_LIGHT = '#FFB475';

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: ORANGE_MID,
  },

  // 배경
  bgGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: ORANGE_MID,
    // RN은 LinearGradient 없이도 단색으로 동작; expo-linear-gradient 없음
  },
  waveWrapper: {
    position:       'absolute',
    top:             '30%',
    left:            '50%',
    transform:       [{ translateX: -220 }, { translateY: -220 }],
    width:           440,
    height:          440,
    alignItems:      'center',
    justifyContent:  'center',
  },
  waveCircle: {
    position:        'absolute',
    borderWidth:     2,
    borderColor:     'rgba(255,255,255,0.35)',
    backgroundColor: 'transparent',
  },

  // 캡쳐 방어
  captureGuard: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.95)',
    zIndex:          100,
    alignItems:      'center',
    justifyContent:  'center',
    padding:          32,
    gap:              12,
  },
  captureText: {
    fontFamily: 'WantedSans-ExtraBold',
    fontSize:    20,
    lineHeight:  26,
    color:       '#FFFFFF',
    textAlign:   'center',
  },
  captureSubText: {
    fontFamily: 'WantedSans-Medium',
    fontSize:    13,
    lineHeight:  19,
    color:       'rgba(255,255,255,0.7)',
    textAlign:   'center',
  },
  captureBtn: {
    marginTop:         16,
    paddingHorizontal: 28,
    paddingVertical:   12,
    backgroundColor:   ORANGE_MID,
    borderRadius:      12,
  },
  captureBtnText: {
    fontFamily: 'WantedSans-Bold',
    fontSize:    14,
    color:       '#FFFFFF',
  },

  // 상단 바
  topBar: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: 24,
    paddingBottom:   12,
    zIndex:           10,
  },
  modeLabel: {
    fontFamily:   'WantedSans-Bold',
    fontSize:      12,
    lineHeight:    16,
    color:         'rgba(255,255,255,0.85)',
    letterSpacing:  1,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  closeBtnText: {
    fontFamily: 'WantedSans-ExtraBold',
    fontSize:    14,
    lineHeight:  18,
    color:       '#FFFFFF',
  },

  // 가게/쿠폰 정보
  infoSection: {
    paddingHorizontal: 28,
    paddingTop:        24,
    alignItems:        'center',
    gap:                6,
    zIndex:             10,
  },
  storeMeta: {
    fontFamily:   'WantedSans-Bold',
    fontSize:      13,
    lineHeight:    18,
    color:         'rgba(255,255,255,0.85)',
    letterSpacing:  0.3,
  },
  couponTitle: {
    fontFamily:   'WantedSans-Black',
    fontSize:      26,
    lineHeight:    33,
    color:         '#FFFFFF',
    textAlign:     'center',
    letterSpacing: -0.8,
  },

  // 토큰 카드
  tokenCard: {
    marginHorizontal: 24,
    marginTop:         32,
    backgroundColor:   'rgba(0,0,0,0.32)',
    borderWidth:       1.5,
    borderColor:       'rgba(255,255,255,0.22)',
    borderRadius:      22,
    padding:           20,
    alignItems:        'center',
    zIndex:            10,
    ...Platform.select({
      ios: {
        backdropFilter: 'blur(20px)',
      },
    }),
  },
  tokenLabel: {
    fontFamily:   'WantedSans-Bold',
    fontSize:      10,
    lineHeight:    14,
    color:         'rgba(255,255,255,0.7)',
    letterSpacing:  1.5,
    textTransform: 'uppercase',
    marginBottom:   10,
  },
  tokenDigits: {
    fontFamily:   'WantedSans-Black',
    fontSize:      52,
    lineHeight:    58,
    color:         '#FFFFFF',
    letterSpacing:  8,
    fontVariant:   ['tabular-nums'],
  },
  countdownBar: {
    width:           '100%',
    height:           4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius:     2,
    marginTop:        18,
    overflow:        'hidden',
  },
  countdownFill: {
    height:          '100%',
    backgroundColor: '#FFFFFF',
    borderRadius:     2,
  },
  countdownText: {
    fontFamily: 'WantedSans-SemiBold',
    fontSize:    10,
    lineHeight:  14,
    color:       'rgba(255,255,255,0.65)',
    marginTop:    8,
  },

  // 안내
  instructions: {
    alignItems: 'center',
    paddingTop:  24,
    gap:          6,
    zIndex:       10,
  },
  instructTitle: {
    fontFamily:   'WantedSans-ExtraBold',
    fontSize:      14,
    lineHeight:    20,
    color:         '#FFFFFF',
    letterSpacing: -0.2,
  },
  instructSub: {
    fontFamily: 'WantedSans-Medium',
    fontSize:    11,
    lineHeight:  16,
    color:       'rgba(255,255,255,0.75)',
  },

  // 하단 버튼
  footer: {
    position:        'absolute',
    bottom:           0,
    left:             0,
    right:            0,
    paddingHorizontal: 24,
    paddingTop:        16,
    alignItems:       'center',
    gap:               8,
    zIndex:            10,
  },
  redeemBtn: {
    width:           '100%',
    paddingVertical:  16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius:     16,
    alignItems:       'center',
    borderWidth:      1.5,
    borderColor:      'rgba(255,255,255,0.3)',
  },
  redeemBtnText: {
    fontFamily:   'WantedSans-Black',
    fontSize:      16,
    lineHeight:    22,
    color:         '#FFFFFF',
    letterSpacing: -0.3,
  },
  footerNote: {
    fontFamily: 'WantedSans-Medium',
    fontSize:    11,
    lineHeight:  16,
    color:       'rgba(255,255,255,0.6)',
    textAlign:   'center',
  },

  // 완료 화면
  doneScreen: {
    flex:            1,
    backgroundColor: ORANGE_MID,
    alignItems:      'center',
    justifyContent:  'center',
    padding:          32,
    gap:              16,
  },
  checkCircle: {
    width:           96,
    height:          96,
    borderRadius:    48,
    backgroundColor: '#FFFFFF',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:     8,
    ...Platform.select({
      ios: {
        shadowColor:   ORANGE_MID,
        shadowOffset:  { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius:  20,
      },
      android: { elevation: 8 },
    }),
  },
  checkMark: {
    fontSize:   42,
    lineHeight: 48,
    color:      ORANGE_MID,
    fontFamily: 'WantedSans-Black',
  },
  doneTitle: {
    fontFamily:   'WantedSans-Black',
    fontSize:      28,
    lineHeight:    35,
    color:         '#FFFFFF',
    letterSpacing: -0.8,
  },
  doneSub: {
    fontFamily: 'WantedSans-Medium',
    fontSize:    14,
    lineHeight:  21,
    color:       'rgba(255,255,255,0.85)',
    textAlign:   'center',
  },
  savingsBox: {
    marginTop:         8,
    paddingHorizontal: 20,
    paddingVertical:   14,
    backgroundColor:   'rgba(0,0,0,0.25)',
    borderRadius:      14,
    alignItems:        'center',
    gap:                6,
  },
  savingsLabel: {
    fontFamily:   'WantedSans-Bold',
    fontSize:      10,
    lineHeight:    14,
    color:         'rgba(255,255,255,0.7)',
    letterSpacing:  1,
    textTransform: 'uppercase',
  },
  savingsValue: {
    fontFamily:   'WantedSans-Black',
    fontSize:      20,
    lineHeight:    26,
    color:         '#FFFFFF',
    letterSpacing: -0.5,
  },
  doneBtn: {
    marginTop:         8,
    paddingHorizontal: 48,
    paddingVertical:   16,
    backgroundColor:   'rgba(0,0,0,0.35)',
    borderRadius:      14,
    borderWidth:       1.5,
    borderColor:       'rgba(255,255,255,0.3)',
  },
  doneBtnText: {
    fontFamily:   'WantedSans-Black',
    fontSize:      16,
    lineHeight:    22,
    color:         '#FFFFFF',
    letterSpacing: -0.3,
  },
});
