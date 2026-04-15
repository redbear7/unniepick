import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, useColorScheme,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import {
  fetchMusicTracks, fetchListeningHistory, MusicTrack,
  fetchCuratedPlaylists, Playlist,
} from '../../lib/services/musicService';
import {
  buildDynamicPlaylist, DynamicPlaylist,
  buildCurationContextFromLocation,
} from '../../lib/services/curationService';
import { fetchWeatherContext, WeatherContext } from '../../lib/services/weatherService';
import { useMusicPlayer } from '../../contexts/MusicPlayerContext';
import { MINI_PLAYER_HEIGHT } from '../../components/GlobalMiniPlayer';
import { TAB_BAR_HEIGHT } from '../../navigation';
import { supabase } from '../../lib/supabase';

// ─── 다크 테마 (뮤직탭은 항상 다크) ─────────────────────────────
const D = {
  bg:      '#0D0D0D',
  surface: '#181818',
  card:    '#242424',
  elevated:'#2A2A2A',
  text:    '#FFFFFF',
  sub:     '#B3B3B3',
  muted:   '#535353',
  accent:  '#FF6F0F',
  border:  '#2E2E2E',
};

// ─── 정적 플레이리스트 정의 ──────────────────────────────────────
interface PlaylistDef {
  id: string; name: string; emoji: string;
  description: string; bgColor: string; accentColor: string;
}
const PLAYLISTS: PlaylistDef[] = [
  { id: 'all',   name: '전체 음악',   emoji: '🎵', description: '언니픽 모든 트랙 모음',     bgColor: '#1A3A2A', accentColor: '#1DB954' },
  { id: '카페',   name: '카페 BGM',   emoji: '☕', description: '카페에 어울리는 감성 음악',   bgColor: '#3D2B1F', accentColor: '#C8860A' },
  { id: '음식점', name: '음식점 BGM', emoji: '🍽', description: '맛있는 식사를 위한 선곡',     bgColor: '#3A1A1A', accentColor: '#E94560' },
  { id: '미용',   name: '뷰티 살롱',  emoji: '💅', description: '뷰티 공간의 분위기 음악',     bgColor: '#2D1A3D', accentColor: '#D946B0' },
  { id: '쇼핑',   name: '쇼핑 BGM',  emoji: '🛍', description: '즐거운 쇼핑을 위한 음악',     bgColor: '#1A253D', accentColor: '#5B67CA' },
  { id: '헬스',   name: '운동 BGM',   emoji: '💪', description: '에너지 넘치는 워크아웃 음악', bgColor: '#3D1A1A', accentColor: '#FF4444' },
];

// ─── 유틸 ────────────────────────────────────────────────────────
function greeting() {
  const h = new Date().getHours();
  if (h < 6)  return '🌙 늦은 밤이에요';
  if (h < 11) return '☀️ 좋은 아침이에요';
  if (h < 14) return '🌤 점심 시간이에요';
  if (h < 18) return '🌇 오후 시간이에요';
  if (h < 22) return '🌆 저녁이 되었어요';
  return '🌃 오늘도 수고하셨어요';
}

// ─── 날씨 배너 ───────────────────────────────────────────────────
const WEATHER_ICONS: Record<string, string> = {
  sunny: '☀️', hot: '🌞', cloudy: '⛅', rainy: '🌧', snowy: '❄️', cold: '🥶',
};
function WeatherBanner({ weather }: { weather: WeatherContext }) {
  return (
    <View style={wb.wrap}>
      <Text style={wb.icon}>{WEATHER_ICONS[weather.condition] ?? '🌡'}</Text>
      <View>
        <Text style={wb.label}>{weather.description} · {Math.round(weather.tempC)}°C</Text>
        <Text style={wb.sub}>날씨에 맞는 음악을 골라드렸어요</Text>
      </View>
    </View>
  );
}
const wb = StyleSheet.create({
  wrap:  {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: D.surface, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: D.border,
  },
  icon:  { fontSize: 26 },
  label: { fontSize: 13, fontWeight: '700', color: D.text },
  sub:   { fontSize: 11, color: D.sub, marginTop: 1 },
});

// ─── AI 큐레이션 피처드 카드 ────────────────────────────────────
function AIDynamicCard({
  playlist, onPlay, onRefresh, loading,
}: {
  playlist: DynamicPlaylist | null;
  onPlay: () => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <View style={[ai.card, { justifyContent: 'center', alignItems: 'center', minHeight: 130 }]}>
        <ActivityIndicator color={D.accent} />
        <Text style={{ color: D.sub, fontSize: 12, marginTop: 8 }}>AI가 지금 분위기를 분석 중이에요…</Text>
      </View>
    );
  }
  if (!playlist) return null;

  return (
    <View style={ai.card}>
      <View style={ai.topRow}>
        <View style={ai.aiBadge}>
          <Text style={ai.aiBadgeText}>🤖 AI 큐레이션</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} activeOpacity={0.7}>
          <Text style={ai.refreshBtn}>↻ 새로 구성</Text>
        </TouchableOpacity>
      </View>
      <Text style={ai.name}>{playlist.name}</Text>
      <Text style={ai.context}>{playlist.context}</Text>
      <View style={ai.tagRow}>
        {playlist.moodTags.slice(0, 4).map(tag => (
          <View key={tag} style={ai.tag}>
            <Text style={ai.tagText}>{tag}</Text>
          </View>
        ))}
      </View>
      <View style={ai.footer}>
        <Text style={ai.trackCount}>{playlist.tracks.length}곡</Text>
        <TouchableOpacity style={ai.playBtn} onPress={onPlay} activeOpacity={0.85}>
          <Text style={ai.playBtnText}>▶ 지금 재생</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const ai = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#1A1A2E',
    borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: D.accent + '40',
    shadowColor: D.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  topRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  aiBadge:      { backgroundColor: D.accent + '22', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  aiBadgeText:  { fontSize: 11, fontWeight: '700', color: D.accent },
  refreshBtn:   { fontSize: 12, color: D.sub },
  name:         { fontSize: 20, fontWeight: '900', color: D.text, marginBottom: 4, letterSpacing: -0.4 },
  context:      { fontSize: 12, color: D.sub, marginBottom: 12 },
  tagRow:       { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 16 },
  tag:          { backgroundColor: D.card, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  tagText:      { fontSize: 11, color: D.sub },
  footer:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trackCount:   { fontSize: 12, color: D.muted },
  playBtn:      {
    backgroundColor: D.accent, borderRadius: 999,
    paddingHorizontal: 18, paddingVertical: 9,
  },
  playBtnText:  { fontSize: 13, fontWeight: '800', color: '#FFF' },
});

// ─── 시샵 큐레이션 카드 ─────────────────────────────────────────
function CuratedCard({ playlist, onPress }: { playlist: Playlist; onPress: () => void }) {
  const colors = ['#1A3A2A','#3D2B1F','#2D1A3D','#1A253D','#3A1A1A','#1A2A3D'];
  const bg = colors[(playlist.id.charCodeAt(0) ?? 0) % colors.length];
  return (
    <TouchableOpacity style={[cc.card, { backgroundColor: bg }]} onPress={onPress} activeOpacity={0.85}>
      <Text style={cc.emoji}>{playlist.cover_emoji ?? '🎵'}</Text>
      {playlist.is_dynamic && (
        <View style={cc.aiBadge}><Text style={cc.aiText}>AI</Text></View>
      )}
      <Text style={cc.name} numberOfLines={2}>{playlist.name}</Text>
      {playlist.mood_tags?.length > 0 && (
        <Text style={cc.mood} numberOfLines={1}>{playlist.mood_tags.slice(0, 2).join(' · ')}</Text>
      )}
      {playlist.track_count != null && (
        <Text style={cc.count}>{playlist.track_count}곡</Text>
      )}
    </TouchableOpacity>
  );
}
const cc = StyleSheet.create({
  card: {
    width: 130, borderRadius: 14, padding: 14, marginRight: 10,
    minHeight: 150,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  emoji:   { fontSize: 32, marginBottom: 8 },
  aiBadge: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: D.accent, borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  aiText:  { fontSize: 8, fontWeight: '900', color: '#fff' },
  name:    { fontSize: 13, fontWeight: '800', color: '#FFF', marginBottom: 4, lineHeight: 17 },
  mood:    { fontSize: 10, color: '#FFFFFF88', marginBottom: 4 },
  count:   { fontSize: 10, color: '#FFFFFF66' },
});

// ─── 플레이리스트 커버 모자이크 ─────────────────────────────────
function MiniCover({ tracks, bgColor, accentColor, size }: {
  tracks: MusicTrack[]; bgColor: string; accentColor: string; size: number;
}) {
  const emojis = [...new Set(tracks.map(t => t.cover_emoji))].slice(0, 4);
  const half = size / 2;
  if (emojis.length < 4) {
    return (
      <View style={[mc.wrap, { width: size, height: size, backgroundColor: bgColor, borderRadius: 8 }]}>
        <Text style={{ fontSize: size * 0.42 }}>{emojis[0] ?? '🎵'}</Text>
      </View>
    );
  }
  return (
    <View style={[mc.mosaic, { width: size, height: size, borderRadius: 8 }]}>
      {emojis.map((emoji, i) => (
        <View key={i} style={[mc.cell, {
          width: half, height: half,
          backgroundColor: i % 2 === 0 ? bgColor : accentColor + '55',
        }]}>
          <Text style={{ fontSize: half * 0.46 }}>{emoji}</Text>
        </View>
      ))}
    </View>
  );
}
const mc = StyleSheet.create({
  wrap:   { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  mosaic: { flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden' },
  cell:   { alignItems: 'center', justifyContent: 'center' },
});

// ─── 정적 플레이리스트 카드 (피처드) ────────────────────────────
function FeaturedCard({ playlist, tracks, onPress }: {
  playlist: PlaylistDef; tracks: MusicTrack[]; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[fc.card, { backgroundColor: playlist.bgColor }]} onPress={onPress} activeOpacity={0.85}>
      <View style={fc.left}>
        <Text style={fc.tag}>플레이리스트</Text>
        <Text style={fc.name}>{playlist.name}</Text>
        <Text style={fc.desc} numberOfLines={2}>{playlist.description}</Text>
        <Text style={fc.meta}>{tracks.length}곡</Text>
      </View>
      <MiniCover tracks={tracks} bgColor={playlist.bgColor} accentColor={playlist.accentColor} size={110} />
    </TouchableOpacity>
  );
}
const fc = StyleSheet.create({
  card: {
    marginHorizontal: 16, borderRadius: 14,
    padding: 20, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  left: { flex: 1, paddingRight: 16 },
  tag:  { fontSize: 10, fontWeight: '700', color: '#FFFFFF99', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  name: { fontSize: 22, fontWeight: '900', color: '#FFF', marginBottom: 6 },
  desc: { fontSize: 13, color: '#FFFFFF99', lineHeight: 18, marginBottom: 10 },
  meta: { fontSize: 12, color: '#FFFFFF77' },
});

// ─── 그리드 카드 ─────────────────────────────────────────────────
function GridCard({ playlist, tracks, onPress }: {
  playlist: PlaylistDef; tracks: MusicTrack[]; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[gc.card, { backgroundColor: playlist.bgColor }]} onPress={onPress} activeOpacity={0.85}>
      <MiniCover tracks={tracks} bgColor={playlist.bgColor} accentColor={playlist.accentColor} size={84} />
      <View style={gc.info}>
        <Text style={gc.name} numberOfLines={1}>{playlist.name}</Text>
        <Text style={gc.meta}>{tracks.length}곡</Text>
      </View>
    </TouchableOpacity>
  );
}
const gc = StyleSheet.create({
  card: {
    width: '47%', borderRadius: 12, padding: 14,
    alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4, minHeight: 160,
  },
  info: { alignItems: 'center', gap: 4 },
  name: { fontSize: 13, fontWeight: '800', color: '#FFF', textAlign: 'center' },
  meta: { fontSize: 11, color: '#FFFFFF88' },
});

// ─── 청취 기록 트랙 카드 ─────────────────────────────────────────
function HistoryTrackCard({ track, isActive, isPlaying, onPress }: {
  track: MusicTrack; isActive: boolean; isPlaying: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[hc.card, isActive && hc.cardActive]} onPress={onPress} activeOpacity={0.8}>
      <View style={[hc.cover, { backgroundColor: isActive ? D.accent + '22' : D.card }]}>
        <Text style={{ fontSize: 22 }}>{track.cover_emoji}</Text>
        {isActive && (
          <View style={hc.playOverlay}>
            <Text style={{ fontSize: 14, color: '#FFF' }}>{isPlaying ? '⏸' : '▶'}</Text>
          </View>
        )}
      </View>
      <View style={hc.info}>
        <Text style={[hc.title, isActive && { color: D.accent }]} numberOfLines={1}>{track.title}</Text>
        <Text style={hc.artist} numberOfLines={1}>{track.artist}</Text>
      </View>
    </TouchableOpacity>
  );
}
const hc = StyleSheet.create({
  card:        {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: D.surface, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    marginHorizontal: 16, marginBottom: 6,
  },
  cardActive:  { backgroundColor: D.accent + '18', borderWidth: 1, borderColor: D.accent + '44' },
  cover:       { width: 48, height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  playOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000066', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  info:        { flex: 1, gap: 3 },
  title:       { fontSize: 14, fontWeight: '700', color: D.text },
  artist:      { fontSize: 12, color: D.sub },
});

// ─── 메인 화면 ───────────────────────────────────────────────────
export default function MusicScreen() {
  const navigation  = useNavigation<any>();
  const insets      = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark      = colorScheme === 'dark';

  const [allTracks,      setAllTracks]      = useState<MusicTrack[]>([]);
  const [historyTracks,  setHistoryTracks]  = useState<MusicTrack[]>([]);
  const [curatedList,    setCuratedList]    = useState<Playlist[]>([]);
  const [dynamicPlaylist, setDynamicPlaylist] = useState<DynamicPlaylist | null>(null);
  const [weather,        setWeather]        = useState<WeatherContext | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [dynamicLoading, setDynamicLoading] = useState(true);
  const [userLoc,        setUserLoc]        = useState<{ lat: number; lng: number } | null>(null);

  const { currentTrack, isPlaying, play, playAll } = useMusicPlayer();

  // ── 초기 데이터 로드 ────────────────────────────────────────
  useEffect(() => {
    loadAll();
    loadLocation();
  }, []);

  // ── 위치 수집 → 날씨 + 동적 플레이리스트 ───────────────────
  const loadLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setUserLoc(coords);
        const w = await fetchWeatherContext(coords.lat, coords.lng).catch(() => null);
        setWeather(w);
        await loadDynamicPlaylist(coords.lat, coords.lng, w ?? undefined);
      } else {
        // 위치 권한 없으면 시간대 기반 fallback
        await loadDynamicPlaylist();
      }
    } catch {
      await loadDynamicPlaylist();
    }
  };

  const loadAll = async () => {
    try {
      const [tracks, curated] = await Promise.all([
        fetchMusicTracks(),
        fetchCuratedPlaylists().catch(() => []),
      ]);
      setAllTracks(tracks);
      setCuratedList(curated);
    } catch {} finally {
      setLoading(false);
    }
  };

  // ── 동적 플레이리스트 빌드 ───────────────────────────────────
  const loadDynamicPlaylist = async (
    lat?: number, lng?: number, weatherCtx?: WeatherContext,
  ) => {
    setDynamicLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id ?? null;
      const ctx = await buildCurationContextFromLocation(lat, lng, weatherCtx);
      ctx.userId = uid;
      const result = await buildDynamicPlaylist(ctx);
      setDynamicPlaylist(result);
    } catch {} finally {
      setDynamicLoading(false);
    }
  };

  // ── 청취 기록 ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const userId = data.session?.user.id;
        if (!userId) return;
        const history = await fetchListeningHistory(userId, 10);
        setHistoryTracks(history);
      } catch {}
    })();
  }, [currentTrack?.id]);

  const tracksFor = useCallback((id: string): MusicTrack[] => {
    if (id === 'all') return allTracks;
    return allTracks.filter(t => t.store_category === id || t.store_category === 'all');
  }, [allTracks]);

  const activePlaylists = PLAYLISTS.filter(p => tracksFor(p.id).length > 0);

  const openPlaylist = (p: PlaylistDef) => {
    navigation.navigate('PlaylistDetail', {
      id: p.id, name: p.name, emoji: p.emoji,
      description: p.description, bgColor: p.bgColor, accentColor: p.accentColor,
    });
  };

  const handlePlayDynamic = () => {
    if (dynamicPlaylist && dynamicPlaylist.tracks.length > 0) {
      playAll(dynamicPlaylist.tracks, 0);
    }
  };

  const handleRefreshDynamic = async () => {
    await loadDynamicPlaylist(userLoc?.lat, userLoc?.lng, weather ?? undefined);
  };

  const bottomPad = currentTrack
    ? TAB_BAR_HEIGHT + MINI_PLAYER_HEIGHT + insets.bottom + 8
    : TAB_BAR_HEIGHT + insets.bottom + 16;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad }}>

        {/* ── 헤더 ── */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{greeting()}</Text>
            <Text style={s.title}>🎵 뮤직</Text>
          </View>
          <View style={s.trackBadge}>
            <Text style={s.trackBadgeText}>{allTracks.length}곡</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={D.accent} style={{ marginTop: 60 }} />
        ) : allTracks.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 52 }}>🎵</Text>
            <Text style={s.emptyTitle}>아직 음악이 없어요</Text>
            <Text style={s.emptySub}>곧 업데이트 예정이에요!</Text>
          </View>
        ) : (
          <>
            {/* ── 날씨 배너 ── */}
            {weather && <WeatherBanner weather={weather} />}

            {/* ── AI 즉석 큐레이션 ── */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>✨ 지금 이 순간을 위한</Text>
              <AIDynamicCard
                playlist={dynamicPlaylist}
                loading={dynamicLoading}
                onPlay={handlePlayDynamic}
                onRefresh={handleRefreshDynamic}
              />
            </View>

            {/* ── 시샵 큐레이션 ── */}
            {curatedList.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitle}>📚 시샵 큐레이션</Text>
                  <Text style={s.sectionSub}>AI + 전문 큐레이터</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4 }}
                >
                  {curatedList.map(pl => (
                    <CuratedCard key={pl.id} playlist={pl} onPress={() => {}} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ── 정적 피처드 플레이리스트 ── */}
            {activePlaylists.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>🎧 업종별 플레이리스트</Text>
                <FeaturedCard
                  playlist={activePlaylists[0]}
                  tracks={tracksFor(activePlaylists[0].id)}
                  onPress={() => openPlaylist(activePlaylists[0])}
                />
              </View>
            )}

            {/* ── 최근 들은 음악 ── */}
            {historyTracks.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitle}>🕐 최근 들은 음악</Text>
                  <TouchableOpacity
                    onPress={() => playAll(historyTracks, 0)}
                    style={s.playAllBtn}
                    activeOpacity={0.8}
                  >
                    <Text style={s.playAllText}>▶ 전체 재생</Text>
                  </TouchableOpacity>
                </View>
                {historyTracks.map(track => (
                  <HistoryTrackCard
                    key={track.id}
                    track={track}
                    isActive={currentTrack?.id === track.id}
                    isPlaying={currentTrack?.id === track.id && isPlaying}
                    onPress={() => playAll(historyTracks, historyTracks.indexOf(track))}
                  />
                ))}
              </View>
            )}

            {/* ── 플레이리스트 그리드 ── */}
            {activePlaylists.length > 1 && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>📂 카테고리</Text>
                <View style={s.grid}>
                  {activePlaylists.slice(1).map(p => (
                    <GridCard
                      key={p.id}
                      playlist={p}
                      tracks={tracksFor(p.id)}
                      onPress={() => openPlaylist(p)}
                    />
                  ))}
                  {(activePlaylists.length - 1) % 2 !== 0 && <View style={{ flex: 1 }} />}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── 스타일 ──────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: D.bg },

  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20,
  },
  greeting:   { fontSize: 13, color: D.sub, marginBottom: 4 },
  title:      { fontSize: 28, fontWeight: '900', color: D.text },
  trackBadge: { backgroundColor: D.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 6 },
  trackBadgeText: { fontSize: 12, color: D.sub, fontWeight: '600' },

  section:      { paddingTop: 24, paddingBottom: 4 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: D.text, paddingHorizontal: 16, marginBottom: 12, letterSpacing: 1.2, textTransform: 'uppercase' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: D.text, letterSpacing: 1.2, textTransform: 'uppercase' },
  sectionSub:   { fontSize: 11, color: D.muted },
  playAllBtn:   { backgroundColor: D.accent, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  playAllText:  { fontSize: 11, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },

  grid:    {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 12,
  },
  empty:       { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle:  { fontSize: 18, fontWeight: '800', color: D.text },
  emptySub:    { fontSize: 14, color: D.sub },
});
