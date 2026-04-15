import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const { width: SCREEN_W } = Dimensions.get('window');
const SLIDE_MS = 3800; // 자동 넘김 간격

// ─── 샘플 배너 데이터 ────────────────────────────────────────────
const BANNERS = [
  {
    id: '1',
    emoji: '🎟',
    badge: 'NEW',
    title: '이번 주 특별 쿠폰',
    subtitle: '상남동·봉곡동 맛집 최대 20% 할인',
    bg: '#5B67CA',
    badgeBg: 'rgba(255,255,255,0.25)',
    route: 'CouponList',
  },
  {
    id: '2',
    emoji: '🌟',
    badge: '모집중',
    title: '체험단 신청 받아요',
    subtitle: '시그니처 코스 무료 체험 · 5명 한정',
    bg: '#D946B0',
    badgeBg: 'rgba(255,255,255,0.25)',
    route: 'CouponList',
  },
  {
    id: '3',
    emoji: '🏆',
    badge: '랭킹',
    title: '매출 랭킹 1위 도전!',
    subtitle: '영수증 인증하고 이번 달 선물 받기',
    bg: '#FF6B3D',
    badgeBg: 'rgba(255,255,255,0.25)',
    route: 'Ranking',
  },
] as const;

type BannerItem = (typeof BANNERS)[number];

export default function BannerSlider() {
  const navigation  = useNavigation<any>();
  const listRef     = useRef<FlatList<BannerItem>>(null);
  const [current, setCurrent] = useState(0);
  const currentRef  = useRef(0);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      const next = (currentRef.current + 1) % BANNERS.length;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      currentRef.current = next;
      setCurrent(next);
    }, SLIDE_MS);
  };

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const onScrollEnd = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    currentRef.current = idx;
    setCurrent(idx);
    // 수동 스크롤 후 타이머 리셋
    if (timerRef.current) clearInterval(timerRef.current);
    startTimer();
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={BANNERS as unknown as BannerItem[]}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, index) => ({
          length: SCREEN_W,
          offset: SCREEN_W * index,
          index,
        })}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.slide, { backgroundColor: item.bg, width: SCREEN_W }]}
            onPress={() => navigation.navigate(item.route)}
            activeOpacity={0.9}
          >
            <View style={styles.slideInner}>
              {/* 뱃지 */}
              <View style={[styles.badge, { backgroundColor: item.badgeBg }]}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
              {/* 텍스트 */}
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
              <Text style={styles.cta}>자세히 보기 →</Text>
            </View>
            {/* 장식 이모지 */}
            <Text style={styles.deco}>{item.emoji}</Text>
          </TouchableOpacity>
        )}
      />

      {/* 페이지 인디케이터 */}
      <View style={styles.dots}>
        {BANNERS.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, current === i && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { marginHorizontal: -20 },   // 부모 패딩 탈출
  slide: {
    height: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  slideInner:  { flex: 1, paddingHorizontal: 24, gap: 6 },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 2,
  },
  badgeText:   { fontSize: 11, fontWeight: '800', color: '#fff' },
  title:       { fontSize: 18, fontWeight: '800', color: '#fff' },
  subtitle:    { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  cta:         { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  deco:        { fontSize: 72, marginRight: 20, opacity: 0.35 },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#DDD',
  },
  dotActive: {
    width: 18,
    backgroundColor: '#5B67CA',
  },
});
