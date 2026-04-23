import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Switch, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { fetchAllMusicTracksAdmin, MusicTrack } from '../../lib/services/musicService';

// ─── 테마 (시샵 어드민 다크) ─────────────────────────────────────
const SA = {
  bg:          '#0D0F14',
  card:        '#16181D',
  elevated:    '#1E2025',
  border:      'rgba(255,255,255,0.08)',
  borderMid:   'rgba(255,255,255,0.12)',
  text:        '#F7F8F8',
  sub:         '#9EA3AD',
  muted:       '#62666D',
  accent:      '#FF6F0F',
  accentDim:   'rgba(255,111,15,0.15)',
  success:     '#22C55E',
  successDim:  'rgba(34,197,94,0.18)',
  error:       '#F87171',
  errorDim:    'rgba(248,113,113,0.18)',
  blue:        '#60A5FA',
  indigo:      '#818CF8',
  indigoDim:   'rgba(129,140,248,0.15)',
};

// ─── 타입 ────────────────────────────────────────────────────────
interface PlaylistRow {
  id:            string;
  name:          string;
  cover_emoji:   string | null;
  is_curated:    boolean;
  is_dynamic:    boolean;
  mood_tags:     string[];
  time_tags:     string[];
  weather_tags:  string[];
  category_tags: string[];
  curator_note:  string | null;
  track_count:   number;
  is_active:     boolean;
  created_at:    string;
}

interface PlaylistTrack {
  id:       string;
  track_id: string;
  position: number;
  track:    MusicTrack;
}

// ─── 태그 옵션 ───────────────────────────────────────────────────
const MOOD_OPTIONS   = ['lo-fi','jazz','acoustic','cozy','chill','upbeat','bright','pop','indie','ambient','lounge','r&b','tropical','morning-coffee','fresh','warm','night','energetic','EDM','k-pop','study'];
const TIME_OPTIONS   = ['morning','afternoon','evening','night','late_night'];
const WEATHER_OPTIONS= ['sunny','hot','cloudy','rainy','snowy','cold'];
const CATEGORY_OPTIONS=['cafe','food','beauty','health','mart','bar','all'];

const TIME_KO: Record<string, string>    = { morning:'아침', afternoon:'오후', evening:'저녁', night:'밤', late_night:'심야' };
const WEATHER_KO: Record<string, string> = { sunny:'맑음', hot:'더위', cloudy:'흐림', rainy:'비', snowy:'눈', cold:'추위' };
const CAT_KO: Record<string, string>     = { cafe:'카페', food:'음식점', beauty:'뷰티', health:'건강', mart:'마트', bar:'바', all:'전체' };

// ─── 태그 토글 칩 ────────────────────────────────────────────────
function TagChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[tc.chip, active && tc.chipActive]}
    >
      <Text style={[tc.label, active && tc.labelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}
const tc = StyleSheet.create({
  chip:        { borderRadius: 999, borderWidth: 1, borderColor: SA.border, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 6 },
  chipActive:  { borderColor: SA.accent, backgroundColor: SA.accentDim },
  label:       { fontSize: 12, fontFamily: 'WantedSans-SemiBold', fontWeight: '600', color: SA.sub },
  labelActive: { color: SA.accent },
});

// ─── 트랙 선택 행 ────────────────────────────────────────────────
function TrackSelectRow({ track, selected, onToggle }: {
  track: MusicTrack; selected: boolean; onToggle: () => void;
}) {
  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.8} style={[tsr.row, selected && tsr.rowSelected]}>
      <Text style={tsr.emoji}>{track.cover_emoji}</Text>
      <View style={tsr.info}>
        <Text style={tsr.title} numberOfLines={1}>{track.title}</Text>
        <Text style={tsr.sub} numberOfLines={1}>{track.artist} · {track.mood}</Text>
      </View>
      <View style={[tsr.check, selected && tsr.checkActive]}>
        {selected && <Text style={tsr.checkIcon}>✓</Text>}
      </View>
    </TouchableOpacity>
  );
}
const tsr = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SA.border },
  rowSelected: { backgroundColor: SA.accentDim },
  emoji:       { fontSize: 24, width: 36, textAlign: 'center' },
  info:        { flex: 1 },
  title:       { fontSize: 13, fontFamily: 'WantedSans-SemiBold', fontWeight: '600', color: SA.text },
  sub:         { fontSize: 11, color: SA.sub, marginTop: 2 },
  check:       { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: SA.border, alignItems: 'center', justifyContent: 'center' },
  checkActive: { borderColor: SA.accent, backgroundColor: SA.accent },
  checkIcon:   { fontSize: 12, color: '#fff', fontFamily: 'WantedSans-ExtraBold', fontWeight: '800' },
});

// ─── 메인 화면 ───────────────────────────────────────────────────
export default function SuperAdminPlaylistScreen() {
  const navigation = useNavigation<any>();

  const [playlists,    setPlaylists]    = useState<PlaylistRow[]>([]);
  const [allTracks,    setAllTracks]    = useState<MusicTrack[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [trackModal,   setTrackModal]   = useState(false);
  const [editId,       setEditId]       = useState<string | null>(null);
  const [saving,       setSaving]       = useState(false);

  // 폼 상태
  const [name,          setName]          = useState('');
  const [emoji,         setEmoji]         = useState('🎵');
  const [isDynamic,     setIsDynamic]     = useState(false);
  const [moodTags,      setMoodTags]      = useState<string[]>([]);
  const [timeTags,      setTimeTags]      = useState<string[]>([]);
  const [weatherTags,   setWeatherTags]   = useState<string[]>([]);
  const [categoryTags,  setCategoryTags]  = useState<string[]>([]);
  const [curatorNote,   setCuratorNote]   = useState('');
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [trackSearch,   setTrackSearch]   = useState('');

  // 현재 편집 중인 플레이리스트의 트랙 목록
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrack[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: pls }, tracks] = await Promise.all([
        supabase
          .from('playlists')
          .select('*')
          .eq('is_curated', true)
          .order('created_at', { ascending: false }),
        fetchAllMusicTracksAdmin().catch(() => [] as MusicTrack[]),
      ]);
      setPlaylists((pls ?? []) as PlaylistRow[]);
      setAllTracks(tracks);
    } finally {
      setLoading(false);
    }
  };

  // 플레이리스트 트랙 로드 (편집 시)
  const loadPlaylistTracks = async (playlistId: string) => {
    try {
      const { data } = await supabase
        .from('playlist_tracks')
        .select('id, track_id, position, music_tracks(*)')
        .eq('playlist_id', playlistId)
        .order('position');
      if (data) {
        const pts = data.map((r: any) => ({
          id: r.id, track_id: r.track_id, position: r.position, track: r.music_tracks,
        }));
        setPlaylistTracks(pts);
        setSelectedTracks(new Set(pts.map((pt: PlaylistTrack) => pt.track_id)));
      }
    } catch {}
  };

  const resetForm = () => {
    setEditId(null);
    setName(''); setEmoji('🎵'); setIsDynamic(false);
    setMoodTags([]); setTimeTags([]); setWeatherTags([]); setCategoryTags([]);
    setCuratorNote(''); setSelectedTracks(new Set()); setPlaylistTracks([]);
  };

  const openCreate = () => { resetForm(); setModalVisible(true); };

  const openEdit = async (pl: PlaylistRow) => {
    setEditId(pl.id);
    setName(pl.name); setEmoji(pl.cover_emoji ?? '🎵');
    setIsDynamic(pl.is_dynamic); setMoodTags(pl.mood_tags ?? []);
    setTimeTags(pl.time_tags ?? []); setWeatherTags(pl.weather_tags ?? []);
    setCategoryTags(pl.category_tags ?? []); setCuratorNote(pl.curator_note ?? '');
    await loadPlaylistTracks(pl.id);
    setModalVisible(true);
  };

  const toggleTag = (tag: string, tags: string[], setTags: (t: string[]) => void) => {
    setTags(tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag]);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('이름을 입력해주세요'); return; }
    setSaving(true);
    try {
      const payload = {
        name:          name.trim(),
        cover_emoji:   emoji,
        is_curated:    true,
        is_dynamic:    isDynamic,
        mood_tags:     moodTags,
        time_tags:     timeTags,
        weather_tags:  weatherTags,
        category_tags: categoryTags,
        curator_note:  curatorNote.trim() || null,
        track_count:   selectedTracks.size,
        curated_at:    new Date().toISOString(),
      };

      let playlistId = editId;

      if (editId) {
        await supabase.from('playlists').update(payload).eq('id', editId);
      } else {
        const { data, error } = await supabase
          .from('playlists').insert({ ...payload }).select().single();
        if (error) throw error;
        playlistId = data.id;
      }

      // 트랙 연결 (playlist_tracks 테이블)
      if (playlistId) {
        // 기존 트랙 삭제 후 재삽입
        await supabase.from('playlist_tracks').delete().eq('playlist_id', playlistId);
        const trackRows = Array.from(selectedTracks).map((trackId, idx) => ({
          playlist_id: playlistId,
          track_id:    trackId,
          position:    idx + 1,
        }));
        if (trackRows.length > 0) {
          await supabase.from('playlist_tracks').insert(trackRows);
        }
      }

      await loadData();
      setModalVisible(false);
      resetForm();
      Alert.alert('✅ 저장 완료', editId ? '플레이리스트가 수정됐어요' : '새 플레이리스트가 등록됐어요');
    } catch (e: any) {
      Alert.alert('오류', e.message ?? '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (pl: PlaylistRow) => {
    await supabase.from('playlists').update({ is_active: !pl.is_active }).eq('id', pl.id);
    loadData();
  };

  const handleDelete = (pl: PlaylistRow) => {
    Alert.alert('플레이리스트 삭제', `"${pl.name}"을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        await supabase.from('playlists').delete().eq('id', pl.id);
        loadData();
      }},
    ]);
  };

  const filteredTracks = allTracks.filter(t =>
    t.title.includes(trackSearch) || t.artist.includes(trackSearch) || t.mood.includes(trackSearch)
  );

  // ─── 플레이리스트 카드 ────────────────────────────────────────
  const renderPlaylist = (pl: PlaylistRow) => (
    <View key={pl.id} style={s.card}>
      {/* 헤더 */}
      <View style={s.cardHeader}>
        <Text style={s.cardEmoji}>{pl.cover_emoji ?? '🎵'}</Text>
        <View style={s.cardInfo}>
          <View style={s.cardTitleRow}>
            <Text style={s.cardName}>{pl.name}</Text>
            {pl.is_dynamic && (
              <View style={s.aiBadge}><Text style={s.aiBadgeText}>AI</Text></View>
            )}
          </View>
          <Text style={s.cardMeta}>{pl.track_count}곡 · {pl.curator_note ?? '노트 없음'}</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: pl.is_active ? SA.successDim : SA.errorDim }]}>
          <Text style={[s.statusText, { color: pl.is_active ? SA.success : SA.error }]}>
            {pl.is_active ? '● 게시 중' : '○ 숨김'}
          </Text>
        </View>
      </View>

      {/* 태그들 */}
      <View style={s.tagSection}>
        {pl.mood_tags?.slice(0, 5).map(t => (
          <View key={t} style={s.tag}><Text style={[s.tagText, { color: SA.accent }]}>{t}</Text></View>
        ))}
        {pl.time_tags?.map(t => (
          <View key={t} style={[s.tag, { backgroundColor: SA.indigoDim }]}>
            <Text style={[s.tagText, { color: SA.indigo }]}>{TIME_KO[t] ?? t}</Text>
          </View>
        ))}
        {pl.weather_tags?.map(t => (
          <View key={t} style={[s.tag, { backgroundColor: SA.successDim }]}>
            <Text style={[s.tagText, { color: SA.success }]}>{WEATHER_KO[t] ?? t}</Text>
          </View>
        ))}
        {pl.category_tags?.map(t => (
          <View key={t} style={s.tag}>
            <Text style={s.tagText}>{CAT_KO[t] ?? t}</Text>
          </View>
        ))}
      </View>

      {/* 액션 */}
      <View style={s.cardActions}>
        <TouchableOpacity style={s.actionBtn} onPress={() => openEdit(pl)} activeOpacity={0.8}>
          <Text style={s.actionBtnText}>✏️ 편집</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: pl.is_active ? SA.errorDim : SA.successDim }]}
          onPress={() => handleToggleActive(pl)}
          activeOpacity={0.8}
        >
          <Text style={[s.actionBtnText, { color: pl.is_active ? SA.error : SA.success }]}>
            {pl.is_active ? '숨기기' : '게시하기'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, { backgroundColor: SA.errorDim }]} onPress={() => handleDelete(pl)} activeOpacity={0.8}>
          <Text style={[s.actionBtnText, { color: SA.error }]}>🗑 삭제</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>‹ 뒤로</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>🎵 플레이리스트 관리</Text>
        <TouchableOpacity onPress={openCreate} style={s.addBtn} activeOpacity={0.85}>
          <Text style={s.addBtnText}>＋ 새로 만들기</Text>
        </TouchableOpacity>
      </View>

      {/* 목록 */}
      {loading ? (
        <ActivityIndicator color={SA.accent} style={{ marginTop: 60 }} />
      ) : playlists.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 48 }}>🎶</Text>
          <Text style={s.emptyText}>큐레이션 플레이리스트가 없어요</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={openCreate}>
            <Text style={s.emptyBtnText}>첫 플레이리스트 만들기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {/* 요약 */}
          <View style={s.summary}>
            <View style={s.summaryItem}>
              <Text style={s.summaryVal}>{playlists.length}</Text>
              <Text style={s.summaryLabel}>전체</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={[s.summaryVal, { color: SA.success }]}>{playlists.filter(p => p.is_active).length}</Text>
              <Text style={s.summaryLabel}>게시 중</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={[s.summaryVal, { color: SA.accent }]}>{playlists.filter(p => p.is_dynamic).length}</Text>
              <Text style={s.summaryLabel}>AI 동적</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={[s.summaryVal, { color: SA.indigo }]}>{playlists.filter(p => !p.is_dynamic).length}</Text>
              <Text style={s.summaryLabel}>수동 큐레이션</Text>
            </View>
          </View>

          {playlists.map(renderPlaylist)}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── 편집/생성 모달 ── */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={s.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>

            {/* 모달 헤더 */}
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                <Text style={s.modalCancel}>취소</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>{editId ? '플레이리스트 편집' : '새 플레이리스트'}</Text>
              <TouchableOpacity onPress={handleSave} disabled={saving}>
                <Text style={[s.modalSave, saving && { opacity: 0.4 }]}>
                  {saving ? '저장 중…' : '저장'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.modalBody} showsVerticalScrollIndicator={false}>

              {/* 이름 */}
              <Text style={s.label}>플레이리스트 이름 *</Text>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder="예: 비 오는 날 재즈"
                placeholderTextColor={SA.muted}
              />

              {/* 커버 이모지 */}
              <Text style={s.label}>커버 이모지</Text>
              <View style={s.emojiRow}>
                {['🎵','☕','🌙','🌅','💅','🍽','🌧','❄️','☀️','🎷','🎸','🎹','🎺','🎻','🥁'].map(e => (
                  <TouchableOpacity
                    key={e}
                    onPress={() => setEmoji(e)}
                    style={[s.emojiBtn, emoji === e && s.emojiBtnActive]}
                  >
                    <Text style={{ fontSize: 22 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* AI 동적 여부 */}
              <View style={s.switchRow}>
                <View>
                  <Text style={s.label}>🤖 AI 동적 플레이리스트</Text>
                  <Text style={s.switchSub}>ON: 무드 태그로 트랙 자동 조합 · OFF: 선택한 트랙 고정</Text>
                </View>
                <Switch
                  value={isDynamic}
                  onValueChange={setIsDynamic}
                  trackColor={{ false: SA.border, true: SA.accent }}
                  thumbColor="#fff"
                />
              </View>

              {/* 무드 태그 */}
              <Text style={s.label}>무드 태그 (Suno 스타일)</Text>
              <View style={s.tagWrap}>
                {MOOD_OPTIONS.map(t => (
                  <TagChip key={t} label={t} active={moodTags.includes(t)}
                    onPress={() => toggleTag(t, moodTags, setMoodTags)} />
                ))}
              </View>

              {/* 시간대 태그 */}
              <Text style={s.label}>추천 시간대</Text>
              <View style={s.tagWrap}>
                {TIME_OPTIONS.map(t => (
                  <TagChip key={t} label={TIME_KO[t]} active={timeTags.includes(t)}
                    onPress={() => toggleTag(t, timeTags, setTimeTags)} />
                ))}
              </View>

              {/* 날씨 태그 */}
              <Text style={s.label}>추천 날씨</Text>
              <View style={s.tagWrap}>
                {WEATHER_OPTIONS.map(t => (
                  <TagChip key={t} label={WEATHER_KO[t]} active={weatherTags.includes(t)}
                    onPress={() => toggleTag(t, weatherTags, setWeatherTags)} />
                ))}
              </View>

              {/* 업종 태그 */}
              <Text style={s.label}>추천 업종</Text>
              <View style={s.tagWrap}>
                {CATEGORY_OPTIONS.map(t => (
                  <TagChip key={t} label={CAT_KO[t]} active={categoryTags.includes(t)}
                    onPress={() => toggleTag(t, categoryTags, setCategoryTags)} />
                ))}
              </View>

              {/* 큐레이터 노트 */}
              <Text style={s.label}>큐레이터 노트 (선택)</Text>
              <TextInput
                style={[s.input, s.inputMulti]}
                value={curatorNote}
                onChangeText={setCuratorNote}
                placeholder="예: 비 내리는 창가에서 듣기 좋은 재즈 모음"
                placeholderTextColor={SA.muted}
                multiline
                numberOfLines={3}
              />

              {/* 트랙 선택 (수동 모드일 때만) */}
              <View style={s.trackHeader}>
                <Text style={s.label}>
                  {isDynamic ? '🤖 AI가 무드 태그로 자동 구성합니다' : `트랙 선택 (${selectedTracks.size}곡 선택됨)`}
                </Text>
                {!isDynamic && (
                  <TouchableOpacity onPress={() => setTrackModal(true)} style={s.trackSelectBtn}>
                    <Text style={s.trackSelectBtnText}>트랙 선택 →</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* 선택된 트랙 미리보기 */}
              {!isDynamic && selectedTracks.size > 0 && (
                <View style={s.selectedPreview}>
                  {allTracks
                    .filter(t => selectedTracks.has(t.id))
                    .slice(0, 5)
                    .map(t => (
                      <View key={t.id} style={s.previewTrack}>
                        <Text style={{ fontSize: 16 }}>{t.cover_emoji}</Text>
                        <Text style={s.previewTitle} numberOfLines={1}>{t.title}</Text>
                        <TouchableOpacity onPress={() => {
                          const s = new Set(selectedTracks); s.delete(t.id); setSelectedTracks(s);
                        }}>
                          <Text style={{ color: SA.error, fontSize: 14, paddingHorizontal: 8 }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  {selectedTracks.size > 5 && (
                    <Text style={s.moreText}>외 {selectedTracks.size - 5}곡 더 선택됨</Text>
                  )}
                </View>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ── 트랙 선택 모달 ── */}
      <Modal visible={trackModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTrackModal(false)}>
        <SafeAreaView style={s.modalSafe}>
          <View style={s.modalHeader}>
            <View />
            <Text style={s.modalTitle}>트랙 선택 ({selectedTracks.size}곡)</Text>
            <TouchableOpacity onPress={() => setTrackModal(false)}>
              <Text style={s.modalSave}>완료</Text>
            </TouchableOpacity>
          </View>
          <View style={s.searchWrap}>
            <TextInput
              style={s.searchInput}
              value={trackSearch}
              onChangeText={setTrackSearch}
              placeholder="제목, 아티스트, 무드 검색…"
              placeholderTextColor={SA.muted}
            />
          </View>
          <ScrollView>
            {filteredTracks.map(track => (
              <TrackSelectRow
                key={track.id}
                track={track}
                selected={selectedTracks.has(track.id)}
                onToggle={() => {
                  const ns = new Set(selectedTracks);
                  ns.has(track.id) ? ns.delete(track.id) : ns.add(track.id);
                  setSelectedTracks(ns);
                }}
              />
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── 스타일 ──────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: SA.bg },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SA.border },
  backBtn:     { paddingVertical: 4, paddingRight: 12 },
  backText:    { fontSize: 17, color: SA.blue },
  headerTitle: { fontSize: 16, fontFamily: 'WantedSans-ExtraBold', fontWeight: '800', color: SA.text },
  addBtn:      { backgroundColor: SA.accent, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText:  { fontSize: 13, fontFamily: 'WantedSans-ExtraBold', fontWeight: '800', color: '#fff' },

  list:        { padding: 16, gap: 12 },

  summary:     { flexDirection: 'row', backgroundColor: SA.card, borderRadius: 14, padding: 16, marginBottom: 4, borderWidth: 1, borderColor: SA.border },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryVal:  { fontSize: 22, fontFamily: 'WantedSans-Black', fontWeight: '900', color: SA.text },
  summaryLabel:{ fontSize: 11, color: SA.sub },

  card:        { backgroundColor: SA.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: SA.border, gap: 12 },
  cardHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardEmoji:   { fontSize: 32 },
  cardInfo:    { flex: 1 },
  cardTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardName:    { fontSize: 16, fontFamily: 'WantedSans-ExtraBold', fontWeight: '800', color: SA.text },
  cardMeta:    { fontSize: 12, color: SA.sub, marginTop: 3 },
  aiBadge:     { backgroundColor: SA.accentDim, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  aiBadgeText: { fontSize: 10, fontFamily: 'WantedSans-Black', fontWeight: '900', color: SA.accent },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText:  { fontSize: 11, fontFamily: 'WantedSans-Bold', fontWeight: '700' },

  tagSection:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag:         { backgroundColor: SA.accentDim, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  tagText:     { fontSize: 10, fontFamily: 'WantedSans-SemiBold', fontWeight: '600', color: SA.sub },

  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn:   { flex: 1, backgroundColor: SA.elevated, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  actionBtnText:{ fontSize: 12, fontFamily: 'WantedSans-Bold', fontWeight: '700', color: SA.sub },

  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  emptyText:    { fontSize: 16, color: SA.sub },
  emptyBtn:     { backgroundColor: SA.accent, borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { fontSize: 14, fontFamily: 'WantedSans-ExtraBold', fontWeight: '800', color: '#fff' },

  // 모달
  modalSafe:   { flex: 1, backgroundColor: SA.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SA.border },
  modalCancel: { fontSize: 16, color: SA.sub },
  modalTitle:  { fontSize: 16, fontFamily: 'WantedSans-ExtraBold', fontWeight: '800', color: SA.text },
  modalSave:   { fontSize: 16, fontFamily: 'WantedSans-ExtraBold', fontWeight: '800', color: SA.accent },
  modalBody:   { padding: 20, gap: 4 },

  label:       { fontSize: 13, fontFamily: 'WantedSans-Bold', fontWeight: '700', color: SA.sub, marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: SA.card, borderRadius: 12, borderWidth: 1, borderColor: SA.border,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: SA.text,
  },
  inputMulti:  { minHeight: 80, textAlignVertical: 'top' },

  emojiRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiBtn:    { width: 44, height: 44, borderRadius: 10, backgroundColor: SA.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: SA.border },
  emojiBtnActive: { borderColor: SA.accent, backgroundColor: SA.accentDim },

  switchRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: SA.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: SA.border, marginTop: 16 },
  switchSub:   { fontSize: 11, color: SA.muted, marginTop: 3, maxWidth: '85%' },

  tagWrap:     { flexDirection: 'row', flexWrap: 'wrap' },

  trackHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  trackSelectBtn:    { backgroundColor: SA.accentDim, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  trackSelectBtnText:{ fontSize: 12, fontFamily: 'WantedSans-Bold', fontWeight: '700', color: SA.accent },

  selectedPreview: { backgroundColor: SA.card, borderRadius: 12, borderWidth: 1, borderColor: SA.border, overflow: 'hidden', marginTop: 8 },
  previewTrack:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SA.border },
  previewTitle:    { flex: 1, fontSize: 13, color: SA.text },
  moreText:        { fontSize: 12, color: SA.sub, padding: 10, textAlign: 'center' },

  searchWrap:  { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SA.border },
  searchInput: { backgroundColor: SA.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: SA.text, borderWidth: 1, borderColor: SA.border },
});
