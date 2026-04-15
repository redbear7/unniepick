import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Easing, Alert, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { getSession } from '../../lib/services/authService';

const { width: SCREEN_W } = Dimensions.get('window');
const WHEEL_SIZE = Math.min(SCREEN_W - 48, 320);

// ── 돌림판 세그먼트 ──────────────────────────────────────────────────────────
const SEGMENTS = [
  { label: '꽝',         emoji: '😢', color: '#E0E0E0', coins: 0   },
  { label: '10코인',     emoji: '🪙', color: '#FFC107', coins: 10  },
  { label: '꽝',         emoji: '😢', color: '#E0E0E0', coins: 0   },
  { label: '30코인',     emoji: '💰', color: '#FF9800', coins: 30  },
  { label: '5코인',      emoji: '🪙', color: '#FFE082', coins: 5   },
  { label: '50코인',     emoji: '🎉', color: '#FF6B6B', coins: 50  },
  { label: '20코인',     emoji: '💫', color: '#AB47BC', coins: 20  },
  { label: '스탬프 보너스', emoji: '🍀', color: '#4CAF50', coins: 15 },
];

const SEGMENT_ANGLE = 360 / SEGMENTS.length; // 45도

// ── SVG 없이 순수 View로 돌림판 그리기 ──────────────────────────────────────
// 각 세그먼트를 삼각형 + 텍스트로 배치
function WheelSegment({
  index, total, size, segment,
}: { index: number; total: number; size: number; segment: typeof SEGMENTS[0] }) {
  const angle      = (360 / total) * index;
  const halfAngle  = 360 / total / 2;
  const radius     = size / 2;

  return (
    <View
      style={[
        sw.segment,
        {
          width: size, height: size,
          position: 'absolute',
          transform: [{ rotate: `${angle}deg` }],
        },
      ]}
      pointerEvents="none"
    >
      {/* 배경 조각 (Border trick으로 부채꼴 근사) */}
      <View style={[
        sw.segBg,
        {
          borderTopColor: segment.color,
          borderWidth: radius,
          borderRightColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: index % 2 === 0 ? segment.color + 'CC' : segment.color,
        },
      ]} />

      {/* 텍스트 */}
      <View style={[sw.segLabel, { width: radius * 0.7, top: radius * 0.18, left: radius * 0.6 }]}>
        <Text style={sw.segEmoji}>{segment.emoji}</Text>
        <Text style={sw.segText} numberOfLines={1}>{segment.label}</Text>
      </View>
    </View>
  );
}

// ── 메인 화면 ────────────────────────────────────────────────────────────────
export default function SpinWheelScreen() {
  const navigation = useNavigation<any>();
  const spinAnim   = useRef(new Animated.Value(0)).current;
  const [spinning, setSpinning]   = useState(false);
  const [result,   setResult]     = useState<typeof SEGMENTS[0] | null>(null);
  const [canSpin,  setCanSpin]    = useState(true);
  const totalRotation             = useRef(0);

  const spin = async () => {
    if (spinning || !canSpin) return;

    // 로그인 확인
    const session = await getSession();
    if (!session) {
      Alert.alert('로그인 필요', '로그인 후 이용할 수 있어요', [
        { text: '취소', style: 'cancel' },
        { text: '로그인', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }

    setSpinning(true);
    setResult(null);

    // 랜덤 세그먼트 선택
    const segIdx    = Math.floor(Math.random() * SEGMENTS.length);
    const segAngle  = SEGMENT_ANGLE * segIdx;
    // 화살표가 위쪽 고정 → 해당 세그먼트가 위에 오도록 역방향 계산
    const landAngle = 360 - segAngle - SEGMENT_ANGLE / 2;
    const extraSpins = (5 + Math.floor(Math.random() * 3)) * 360; // 5~7바퀴

    const target = totalRotation.current + extraSpins + landAngle;
    totalRotation.current = target;

    Animated.timing(spinAnim, {
      toValue:        target,
      duration:       4000,
      easing:         Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(async () => {
      const won = SEGMENTS[segIdx];
      setResult(won);
      setSpinning(false);
      setCanSpin(false); // 하루 1번 (간단 구현: 화면 내 1번)

      // 코인 지급
      if (won.coins > 0) {
        try {
          await supabase.rpc('earn_unni', {
            p_user_id:    session.user.id,
            p_event_type: 'checkin_daily', // 일간 이벤트 타입 재활용
          });
        } catch {}
      }

      // 결과 알럿
      setTimeout(() => {
        if (won.coins > 0) {
          Alert.alert(
            `${won.emoji} ${won.label} 당첨!`,
            `언니코인 ${won.coins}개가 지갑에 적립됐어요!`,
            [{ text: '확인' }],
          );
        } else {
          Alert.alert('😢 꽝!', '다음 기회에 도전해보세요!', [{ text: '확인' }]);
        }
      }, 300);
    });
  };

  const rotate = spinAnim.interpolate({
    inputRange:  [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaView style={s.safe}>
      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backBtnText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>🎡 행운 돌림판</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={s.container}>
        {/* 안내 */}
        <Text style={s.desc}>하루 1회 · 언니코인 적립 찬스!</Text>

        {/* 화살표 (고정) */}
        <View style={s.arrowWrap}>
          <Text style={s.arrow}>▼</Text>
        </View>

        {/* 돌림판 */}
        <View style={[s.wheelContainer, { width: WHEEL_SIZE, height: WHEEL_SIZE }]}>
          <Animated.View
            style={[
              s.wheel,
              { width: WHEEL_SIZE, height: WHEEL_SIZE, borderRadius: WHEEL_SIZE / 2 },
              { transform: [{ rotate }] },
            ]}
          >
            {SEGMENTS.map((seg, i) => (
              <WheelSegment
                key={i}
                index={i}
                total={SEGMENTS.length}
                size={WHEEL_SIZE}
                segment={seg}
              />
            ))}
            {/* 중앙 원 */}
            <View style={[s.centerDot, {
              width: WHEEL_SIZE * 0.2,
              height: WHEEL_SIZE * 0.2,
              borderRadius: WHEEL_SIZE * 0.1,
            }]}>
              <Text style={s.centerText}>GO!</Text>
            </View>
          </Animated.View>
        </View>

        {/* 결과 표시 */}
        {result && (
          <View style={[s.resultBox, SHADOW.card]}>
            <Text style={s.resultEmoji}>{result.emoji}</Text>
            <Text style={s.resultLabel}>{result.label}</Text>
            {result.coins > 0 && (
              <Text style={s.resultCoins}>+{result.coins} 언니코인 🪙</Text>
            )}
          </View>
        )}

        {/* 스핀 버튼 */}
        <TouchableOpacity
          style={[s.spinBtn, (spinning || !canSpin) && s.spinBtnDisabled]}
          onPress={spin}
          disabled={spinning || !canSpin}
          activeOpacity={0.85}
        >
          <Text style={s.spinBtnText}>
            {spinning ? '⏳ 돌아가는 중...' : canSpin ? '🎡 돌리기!' : '✅ 오늘 완료'}
          </Text>
        </TouchableOpacity>

        {/* 상금표 */}
        <View style={[s.prizeTable, SHADOW.card]}>
          <Text style={s.prizeTableTitle}>🎁 상금 구성</Text>
          <View style={s.prizeRow}>
            {SEGMENTS.filter(s => s.coins > 0).map((seg, i) => (
              <View key={i} style={[s.prizeItem, { backgroundColor: seg.color + '30' }]}>
                <Text style={s.prizeEmoji}>{seg.emoji}</Text>
                <Text style={s.prizeLabel}>{seg.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const sw = StyleSheet.create({
  segment: { alignItems: 'flex-start', justifyContent: 'flex-start' },
  segBg: {
    position: 'absolute', top: 0, left: 0,
    width: 0, height: 0,
  },
  segLabel: {
    position: 'absolute',
    alignItems: 'center', gap: 1,
    transform: [{ rotate: '22.5deg' }],
  },
  segEmoji: { fontSize: 16 },
  segText:  { fontSize: 9, fontWeight: '800', color: '#333', textAlign: 'center' },
});

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  headerTitle:  { fontSize: 18, fontWeight: '800', color: COLORS.text },
  backBtn:      { paddingVertical: 6, paddingHorizontal: 4 },
  backBtnText:  { fontSize: 14, color: COLORS.primary, fontWeight: '700' },

  container: { flex: 1, alignItems: 'center', paddingTop: 8, gap: 16 },

  desc:     { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },

  arrowWrap:{ alignItems: 'center', zIndex: 10, marginBottom: -16 },
  arrow:    { fontSize: 32, color: COLORS.primary },

  wheelContainer: { alignItems: 'center', justifyContent: 'center' },
  wheel: {
    overflow: 'hidden',
    borderWidth: 4, borderColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  centerDot: {
    position: 'absolute',
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: COLORS.primary, zIndex: 10,
  },
  centerText: { fontSize: 13, fontWeight: '900', color: COLORS.primary },

  resultBox: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    paddingHorizontal: 32, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 2, borderColor: COLORS.primary,
  },
  resultEmoji: { fontSize: 28 },
  resultLabel: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  resultCoins: { fontSize: 14, fontWeight: '700', color: '#FF9800' },

  spinBtn:         { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
                     paddingHorizontal: 48, paddingVertical: 16, ...SHADOW.card },
  spinBtnDisabled: { backgroundColor: COLORS.textMuted },
  spinBtnText:     { fontSize: 18, fontWeight: '900', color: '#fff' },

  prizeTable:      { backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
                     padding: 14, width: '90%' },
  prizeTableTitle: { fontSize: 13, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  prizeRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  prizeItem:       { borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 6,
                     alignItems: 'center', gap: 2 },
  prizeEmoji:      { fontSize: 16 },
  prizeLabel:      { fontSize: 10, fontWeight: '700', color: COLORS.text },
});
