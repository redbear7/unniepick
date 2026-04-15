import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Pressable, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Props ────────────────────────────────────────────────────────
interface Props {
  /** 자동으로 올라올 때까지 기다릴 시간 (ms). 기본 2000 */
  delayMs?: number;
  /** 닫기 버튼 누르면 호출 (없으면 자동 닫힘) */
  onDismiss?: () => void;
  /** 배너 누르면 호출 */
  onPress?: () => void;
  emoji?: string;
  title?: string;
  desc?: string;
  ctaLabel?: string;
  accentColor?: string;
}

// ─── Component ────────────────────────────────────────────────────
export default function BottomSheetBanner({
  delayMs   = 2000,
  onDismiss,
  onPress,
  emoji      = '🎟',
  title      = '새 쿠폰이 도착했어요!',
  desc       = '상남동·봉곡동 맛집 최대 20% 할인 쿠폰을 확인하세요.',
  ctaLabel   = '쿠폰 받으러 가기',
  accentColor = '#5B67CA',
}: Props) {
  const insets   = useSafeAreaInsets();
  const slideY   = useRef(new Animated.Value(220)).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
      Animated.spring(slideY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 14,
        bounciness: 5,
      }).start();
    }, delayMs);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.timing(slideY, {
      toValue: 300,
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      onDismiss?.();
    });
  };

  if (!visible) return null;

  return (
    <>
      {/* 반투명 배경 */}
      <Pressable style={styles.backdrop} onPress={dismiss} />

      {/* 바텀시트 */}
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 16 },
          { transform: [{ translateY: slideY }] },
        ]}
      >
        {/* 상단 핸들 바 */}
        <View style={styles.handle} />

        {/* 닫기 버튼 */}
        <TouchableOpacity style={styles.closeBtn} onPress={dismiss} activeOpacity={0.7}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>

        {/* 내용 */}
        <View style={styles.body}>
          <View style={[styles.emojiWrap, { backgroundColor: accentColor + '22' }]}>
            <Text style={styles.emoji}>{emoji}</Text>
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.desc}>{desc}</Text>
          </View>
        </View>

        {/* CTA 버튼 */}
        <TouchableOpacity
          style={[styles.cta, { backgroundColor: accentColor }]}
          onPress={() => { dismiss(); onPress?.(); }}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>{ctaLabel} →</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
    zIndex: 80,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 81,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 20,
  },
  handle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
    alignSelf: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 20, right: 20,
    width: 30, height: 30,
    borderRadius: 15,
    backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontSize: 13, color: '#888', fontWeight: '700' },

  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  emojiWrap: {
    width: 56, height: 56,
    borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 28 },
  textWrap: { flex: 1, gap: 4 },
  title: { fontSize: 17, fontWeight: '800', color: '#222' },
  desc: { fontSize: 13, color: '#888', lineHeight: 19 },

  cta: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  ctaText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
