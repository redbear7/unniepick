import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMusicPlayer } from '../contexts/MusicPlayerContext';
import { navigationRef } from '../navigation/navigationRef';
import { TAB_BAR_HEIGHT } from '../navigation';
import { toggleMusicLike } from '../lib/services/curationService';
import { supabase } from '../lib/supabase';

// ─── 유틸 ────────────────────────────────────────────────────────
function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── 색상 ────────────────────────────────────────────────────────
const D = {
  bg:     '#1E1E1E',
  border: '#2C2C2C',
  accent: '#FF6F0F',
  text:   '#FFFFFF',
  sub:    '#9E9E9E',
  btnBg:  '#333333',
  liked:  '#E94560',
};

export const MINI_PLAYER_HEIGHT = 64;

// ─── 컴포넌트 ────────────────────────────────────────────────────
export default function GlobalMiniPlayer() {
  const { currentTrack, isPlaying, progress, elapsed, duration, toggle, stop } = useMusicPlayer();
  const insets = useSafeAreaInsets();

  const [isLiked,   setIsLiked]   = useState(false);
  const [userId,    setUserId]    = useState<string | null>(null);
  const likeScale = useRef(new Animated.Value(1)).current;

  // 세션 한 번만 가져오기
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
    });
  }, []);

  // 트랙 바뀔 때 좋아요 상태 초기화 + DB 확인
  useEffect(() => {
    if (!currentTrack || !userId) { setIsLiked(false); return; }
    supabase
      .from('music_likes')
      .select('id')
      .eq('user_id', userId)
      .eq('track_id', currentTrack.id)
      .maybeSingle()
      .then(({ data }) => setIsLiked(!!data));
  }, [currentTrack?.id, userId]);

  // 슬라이드 애니메이션
  const slideY = useRef(new Animated.Value(MINI_PLAYER_HEIGHT + 20)).current;
  const prevHasTrack = useRef(false);

  useEffect(() => {
    const hasTrack = currentTrack !== null;
    if (hasTrack === prevHasTrack.current) return;
    prevHasTrack.current = hasTrack;
    Animated.spring(slideY, {
      toValue: hasTrack ? 0 : MINI_PLAYER_HEIGHT + 20,
      useNativeDriver: true,
      tension: 80, friction: 10,
    }).start();
  }, [currentTrack]);

  const handleLike = useCallback(async () => {
    if (!userId || !currentTrack) return;

    // 애니메이션
    Animated.sequence([
      Animated.timing(likeScale, { toValue: 1.5, duration: 80, useNativeDriver: true }),
      Animated.spring(likeScale,  { toValue: 1,   useNativeDriver: true }),
    ]).start();

    const next = !isLiked;
    setIsLiked(next);
    try {
      await toggleMusicLike(currentTrack.id, { playDuration: Math.floor(elapsed) });
    } catch {
      setIsLiked(!next); // rollback
    }
  }, [userId, currentTrack, isLiked, elapsed]);

  if (!currentTrack) return null;

  const handleTapInfo = () => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('Music' as never);
    }
  };

  return (
    <Animated.View
      style={[
        gmp.container,
        { bottom: TAB_BAR_HEIGHT, transform: [{ translateY: slideY }] },
      ]}
    >
      <View style={gmp.row}>
        {/* 트랙 정보 */}
        <TouchableOpacity style={gmp.infoArea} onPress={handleTapInfo} activeOpacity={0.75}>
          <Text style={gmp.emoji}>{currentTrack.cover_emoji}</Text>
          <View style={gmp.textWrap}>
            <Text style={gmp.title} numberOfLines={1}>{currentTrack.title}</Text>
            <Text style={gmp.sub} numberOfLines={1}>
              {currentTrack.artist}
              {'  '}
              <Text style={gmp.time}>{fmtTime(elapsed)} / {fmtTime(duration)}</Text>
            </Text>
          </View>
        </TouchableOpacity>

        {/* ❤️ 좋아요 */}
        <TouchableOpacity style={gmp.btn} onPress={handleLike} activeOpacity={0.7}>
          <Animated.Text style={[gmp.btnIcon, { transform: [{ scale: likeScale }] }]}>
            {isLiked ? '❤️' : '🤍'}
          </Animated.Text>
        </TouchableOpacity>

        {/* ▶ 재생/일시정지 */}
        <TouchableOpacity style={gmp.btn} onPress={toggle} activeOpacity={0.7}>
          <Text style={gmp.btnIcon}>{isPlaying ? '⏸' : '▶'}</Text>
        </TouchableOpacity>

        {/* ✕ 닫기 */}
        <TouchableOpacity style={gmp.btn} onPress={stop} activeOpacity={0.7}>
          <Text style={gmp.btnIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* 진행 바 */}
      <View style={gmp.progressBg}>
        <View style={[gmp.progressFill, { width: `${Math.floor(progress * 100)}%` as any }]} />
      </View>
    </Animated.View>
  );
}

// ─── 스타일 ──────────────────────────────────────────────────────
const gmp = StyleSheet.create({
  container: {
    position: 'absolute', left: 0, right: 0,
    backgroundColor: D.bg,
    borderTopWidth: 1, borderTopColor: D.border,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.35, shadowRadius: 10 },
      android: { elevation: 20 },
    }),
    zIndex: 9999,
  },
  progressBg:   { height: 2, backgroundColor: '#333333' },
  progressFill: { height: 2, backgroundColor: D.accent },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 11,
    gap: 8, height: MINI_PLAYER_HEIGHT,
  },
  infoArea: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    gap: 10, overflow: 'hidden',
  },
  emoji:    { fontSize: 28, lineHeight: 34 },
  textWrap: { flex: 1 },
  title:    { fontSize: 14, fontWeight: '700', color: D.text, lineHeight: 18 },
  sub:      { fontSize: 11, color: D.sub, marginTop: 2, lineHeight: 15 },
  time:     { color: D.accent, fontWeight: '600' },
  btn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: D.btnBg,
    alignItems: 'center', justifyContent: 'center',
  },
  btnIcon:  { fontSize: 15, color: D.text },
});
