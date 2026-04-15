import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, StatusBar, Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { fetchMusicTracks, MusicTrack } from '../../lib/services/musicService';
import { useMusicPlayer } from '../../contexts/MusicPlayerContext';
import { MINI_PLAYER_HEIGHT } from '../../components/GlobalMiniPlayer';

// ─── 라우트 타입 ─────────────────────────────────────────────────
type PlaylistRouteParams = {
  PlaylistDetail: {
    id:          string;
    name:        string;
    emoji:       string;
    description: string;
    bgColor:     string;
    accentColor: string;
  };
};

// ─── 색상 ────────────────────────────────────────────────────────
const D = {
  bg:      '#121212',
  surface: '#1f1f1f',
  card:    '#282828',
  text:    '#ffffff',
  sub:     '#b3b3b3',
  muted:   '#535353',
  accent:  '#FF6F0F',
};

// ─── 유틸 ────────────────────────────────────────────────────────
function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function fmtTotalMin(sec: number) {
  const m = Math.floor(sec / 60);
  return m < 60 ? `${m}분` : `${Math.floor(m / 60)}시간 ${m % 60}분`;
}

// ─── 재생 중 애니메이션 바 ────────────────────────────────────────
function PlayingBars({ color = D.accent }: { color?: string }) {
  const a1 = useRef(new Animated.Value(0.4)).current;
  const a2 = useRef(new Animated.Value(1)).current;
  const a3 = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const anim = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: 1,   duration: 400, delay, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.2, duration: 400, useNativeDriver: true }),
        ])
      );
    const a = [anim(a1, 0), anim(a2, 150), anim(a3, 300)];
    a.forEach(x => x.start());
    return () => a.forEach(x => x.stop());
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 16 }}>
      {[a1, a2, a3].map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: 3, height: 14, borderRadius: 2,
            backgroundColor: color,
            transform: [{ scaleY: v }],
          }}
        />
      ))}
    </View>
  );
}

// ─── 커버 아트 (모자이크) ────────────────────────────────────────
function PlaylistCover({
  tracks, bgColor, accentColor, size,
}: {
  tracks: MusicTrack[]; bgColor: string; accentColor: string; size: number;
}) {
  const emojis = [...new Set(tracks.map(t => t.cover_emoji))].slice(0, 4);
  const half   = size / 2;

  if (emojis.length === 0) {
    return (
      <View style={[pc.wrap, { width: size, height: size, backgroundColor: bgColor }]}>
        <Text style={{ fontSize: size * 0.4 }}>🎵</Text>
      </View>
    );
  }
  if (emojis.length < 4) {
    return (
      <View style={[pc.wrap, { width: size, height: size, backgroundColor: bgColor, borderRadius: 12 }]}>
        <Text style={{ fontSize: size * 0.42 }}>{emojis[0]}</Text>
      </View>
    );
  }
  return (
    <View style={[pc.mosaic, { width: size, height: size, borderRadius: 12 }]}>
      {emojis.slice(0, 4).map((emoji, i) => (
        <View key={i} style={[pc.mosaicCell, {
          width: half, height: half,
          backgroundColor: i % 2 === 0 ? bgColor : accentColor + '66',
        }]}>
          <Text style={{ fontSize: half * 0.48 }}>{emoji}</Text>
        </View>
      ))}
    </View>
  );
}
const pc = StyleSheet.create({
  wrap:       { borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  mosaic:     { flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden' },
  mosaicCell: { alignItems: 'center', justifyContent: 'center' },
});

// ─── 트랙 행 ─────────────────────────────────────────────────────
function TrackRow({
  track, index, isActive, isPlaying, onPress,
}: {
  track: MusicTrack; index: number; isActive: boolean; isPlaying: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[tr.row, isActive && tr.rowActive]} onPress={onPress} activeOpacity={0.6}>
      {/* 번호 / 재생 인디케이터 */}
      <View style={tr.idx}>
        {isActive && isPlaying
          ? <PlayingBars />
          : isActive
          ? <Text style={tr.playing}>▶</Text>
          : <Text style={tr.num}>{index + 1}</Text>}
      </View>

      {/* 커버 */}
      <View style={tr.cover}>
        <Text style={{ fontSize: 22 }}>{track.cover_emoji}</Text>
      </View>

      {/* 정보 */}
      <View style={tr.info}>
        <Text style={[tr.title, isActive && { color: D.accent }]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={tr.artist} numberOfLines={1}>{track.artist}</Text>
      </View>

      {/* 시간 */}
      <Text style={tr.dur}>{fmtTime(track.duration_sec)}</Text>
    </TouchableOpacity>
  );
}
const tr = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 14 },
  rowActive:{ backgroundColor: '#FFFFFF0A' },
  idx:      { width: 24, alignItems: 'center', justifyContent: 'center' },
  num:      { fontSize: 15, color: D.muted, fontWeight: '500' },
  playing:  { fontSize: 14, color: D.accent },
  cover:    {
    width: 48, height: 48, borderRadius: 4,
    backgroundColor: D.card,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
  info:     { flex: 1, gap: 4 },
  title:    { fontSize: 15, fontWeight: '600', color: D.text },
  artist:   { fontSize: 12, color: D.sub },
  dur:      { fontSize: 12, color: D.muted },
});

// ─── 메인 화면 ───────────────────────────────────────────────────
export default function PlaylistDetailScreen() {
  const navigation = useNavigation();
  const route      = useRoute<RouteProp<PlaylistRouteParams, 'PlaylistDetail'>>();
  const { id, name, emoji, description, bgColor, accentColor } = route.params;
  const insets     = useSafeAreaInsets();

  const [tracks,  setTracks]  = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);

  const { currentTrack, isPlaying, play, playAll } = useMusicPlayer();

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchMusicTracks(id === 'all' ? undefined : id);
        setTracks(data);
      } catch {}
      finally { setLoading(false); }
    })();
  }, [id]);

  const totalSec  = tracks.reduce((s, t) => s + t.duration_sec, 0);
  const bottomPad = currentTrack ? MINI_PLAYER_HEIGHT + insets.bottom + 16 : insets.bottom + 24;

  const handlePlayAll = useCallback(() => {
    if (tracks.length) playAll(tracks, 0);
  }, [tracks, playAll]);

  const handleShuffle = useCallback(() => {
    if (!tracks.length) return;
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    playAll(shuffled, 0);
  }, [tracks, playAll]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        {/* ── 히어로 헤더 ── */}
        <View style={[s.hero, { paddingTop: insets.top + 16 }]}>
          {/* 배경 색상 블록 */}
          <View style={[s.heroBg, { backgroundColor: bgColor }]} />
          {/* 아래로 페이드 오버레이 */}
          <View style={s.heroFade} />

          {/* 뒤로 가기 */}
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={s.backIcon}>‹</Text>
          </TouchableOpacity>

          {/* 커버 아트 */}
          <View style={s.coverWrap}>
            <PlaylistCover
              tracks={tracks}
              bgColor={bgColor}
              accentColor={accentColor}
              size={210}
            />
          </View>

          {/* 플레이리스트 정보 */}
          <Text style={s.playlistLabel}>PLAYLIST</Text>
          <Text style={s.playlistName}>{name}</Text>
          <Text style={s.playlistDesc}>{description}</Text>
          <Text style={s.playlistMeta}>
            {loading ? '로딩 중…' : `${tracks.length}곡 · ${fmtTotalMin(totalSec)}`}
          </Text>
        </View>

        {/* ── 액션 버튼 ── */}
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.shuffleBtn]}
            onPress={handleShuffle}
            disabled={tracks.length === 0}
            activeOpacity={0.7}
          >
            <Text style={s.shuffleText}>🔀</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.playBtn, { opacity: tracks.length === 0 ? 0.4 : 1 }]}
            onPress={handlePlayAll}
            disabled={tracks.length === 0}
            activeOpacity={0.85}
          >
            <Text style={s.playBtnIcon}>▶</Text>
          </TouchableOpacity>
        </View>

        {/* ── 구분선 ── */}
        <View style={s.divider} />

        {/* ── 트랙 리스트 ── */}
        {loading ? (
          <ActivityIndicator color={D.accent} style={{ marginTop: 48 }} />
        ) : tracks.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>{emoji}</Text>
            <Text style={s.emptyText}>아직 트랙이 없어요</Text>
          </View>
        ) : (
          tracks.map((track, i) => (
            <TrackRow
              key={track.id}
              track={track}
              index={i}
              isActive={currentTrack?.id === track.id}
              isPlaying={currentTrack?.id === track.id && isPlaying}
              onPress={() => playAll(tracks, i)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ─── 스타일 ──────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },

  // 히어로
  hero: {
    alignItems: 'center',
    paddingBottom: 28,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  heroBg: {
    ...StyleSheet.absoluteFillObject,
    bottom: 80,
  },
  heroFade: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: 120,
    // 반투명 그라데이션 흉내 (위→투명, 아래→#121212)
    backgroundColor: '#121212',
    opacity: 0.85,
  },

  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 24,
    width: 32, height: 32,
    borderRadius: 16,
    backgroundColor: '#00000055',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 1,
  },
  backIcon: { fontSize: 24, color: '#FFF', lineHeight: 30 },

  coverWrap: {
    marginBottom: 28,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 24,
  },

  playlistLabel: {
    zIndex: 1,
    fontSize: 11, fontWeight: '700', color: '#FFFFFF88',
    letterSpacing: 2.5, marginBottom: 10,
    textTransform: 'uppercase',
  },
  playlistName:  {
    zIndex: 1,
    fontSize: 26, fontWeight: '900', color: D.text,
    textAlign: 'center', marginBottom: 8,
  },
  playlistDesc:  {
    zIndex: 1,
    fontSize: 13, color: D.sub, textAlign: 'center', marginBottom: 8, lineHeight: 18,
  },
  playlistMeta:  {
    zIndex: 1,
    fontSize: 12, color: D.muted,
  },

  // 액션
  actions: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'flex-end',
    paddingHorizontal: 20,
    paddingVertical:   16,
    gap: 16,
  },
  playBtn: {
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: D.accent,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     D.accent,
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.5,
    shadowRadius:    16,
    elevation:       12,
  },
  playBtnIcon: { fontSize: 22, color: '#FFF', fontWeight: '900', marginLeft: 3 },
  shuffleBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    alignItems:      'center',
    justifyContent:  'center',
  },
  shuffleText: { fontSize: 22 },

  divider: {
    height: 1,
    backgroundColor: '#FFFFFF0A',
    marginHorizontal: 16,
    marginBottom: 8,
  },

  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyEmoji: { fontSize: 52 },
  emptyText:  { fontSize: 15, color: D.muted },
});
