import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { saveUserMusicProfile } from '../../lib/services/curationService';
import { fetchLikedTracks } from '../../lib/services/curationService';

// ─── 다크 테마 ────────────────────────────────────────────────────
const D = {
  bg:       '#0D0D0D',
  surface:  '#181818',
  card:     '#222222',
  border:   '#2E2E2E',
  text:     '#F5F5F5',
  sub:      '#9A9A9A',
  muted:    '#5A5A5A',
  accent:   '#FF6F0F',
  accentDim:'rgba(255,111,15,0.15)',
  success:  '#22C55E',
  error:    '#F87171',
};

// ─── 무드 옵션 ───────────────────────────────────────────────────
const MOOD_OPTIONS = [
  { tag: 'lo-fi',           label: '☕ 카페 로파이',    desc: '집중되고 아늑한' },
  { tag: 'jazz',            label: '🎷 재즈',           desc: '감성적이고 세련된' },
  { tag: 'acoustic',        label: '🎸 어쿠스틱',       desc: '따뜻하고 자연스러운' },
  { tag: 'upbeat',          label: '💃 신나는',         desc: '활기차고 에너지 넘치는' },
  { tag: 'chill',           label: '🌊 칠',             desc: '편안하고 여유로운' },
  { tag: 'indie',           label: '🎵 인디',           desc: '감성적이고 독창적인' },
  { tag: 'k-pop',           label: '🎤 케이팝',         desc: '트렌디하고 신나는' },
  { tag: 'ambient',         label: '🌙 앰비언트',       desc: '조용하고 몽환적인' },
  { tag: 'EDM',             label: '🔊 EDM',            desc: '강렬하고 폭발적인' },
  { tag: 'r&b',             label: '🎶 R&B',            desc: '감미롭고 리드미컬한' },
  { tag: 'classical',       label: '🎹 클래식',         desc: '우아하고 정갈한' },
  { tag: 'hip-hop',         label: '🎤 힙합',           desc: '강렬하고 개성 있는' },
];

// ─── 기피 장르 옵션 ──────────────────────────────────────────────
const AVOID_OPTIONS = [
  { tag: 'EDM',        label: '🔊 EDM' },
  { tag: 'hip-hop',    label: '🎤 힙합' },
  { tag: 'heavy',      label: '🤘 헤비/메탈' },
  { tag: 'trot',       label: '🎺 트로트' },
  { tag: 'classical',  label: '🎹 클래식' },
  { tag: 'ambient',    label: '🌙 앰비언트' },
  { tag: 'ballad',     label: '💔 발라드' },
  { tag: 'children',   label: '🧒 동요' },
];

// ─── BPM 구간 ────────────────────────────────────────────────────
const BPM_OPTIONS = [
  { label: '🐢 느리게',   desc: '~80 BPM',     min: 60,  max: 80  },
  { label: '🚶 보통',     desc: '80~110 BPM',  min: 80,  max: 110 },
  { label: '🏃 빠르게',   desc: '110~130 BPM', min: 110, max: 130 },
  { label: '⚡ 매우 빠름', desc: '130+ BPM',    min: 130, max: 180 },
];

// ─── 선택 칩 ─────────────────────────────────────────────────────
function SelectChip({ label, desc, active, onPress }: {
  label: string; desc?: string; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[chip.wrap, active && chip.wrapActive]}
    >
      <Text style={[chip.label, active && chip.labelActive]}>{label}</Text>
      {desc && <Text style={[chip.desc, active && { color: D.accent }]}>{desc}</Text>}
    </TouchableOpacity>
  );
}
const chip = StyleSheet.create({
  wrap:        { borderRadius: 14, borderWidth: 1.5, borderColor: D.border, backgroundColor: D.card, padding: 12, flex: 1, minWidth: '45%', maxWidth: '50%' },
  wrapActive:  { borderColor: D.accent, backgroundColor: D.accentDim },
  label:       { fontSize: 14, fontWeight: '700', color: D.sub },
  labelActive: { color: D.accent },
  desc:        { fontSize: 11, color: D.muted, marginTop: 3 },
});

// ─── 작은 기피 칩 ────────────────────────────────────────────────
function AvoidChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[av.wrap, active && av.wrapActive]}
    >
      <Text style={[av.label, active && av.labelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}
const av = StyleSheet.create({
  wrap:        { borderRadius: 999, borderWidth: 1, borderColor: D.border, paddingHorizontal: 14, paddingVertical: 8 },
  wrapActive:  { borderColor: D.error, backgroundColor: 'rgba(248,113,113,0.12)' },
  label:       { fontSize: 13, fontWeight: '600', color: D.sub },
  labelActive: { color: D.error },
});

// ─── 좋아요한 트랙 미리보기 카드 ────────────────────────────────
function LikedTrackMini({ emoji, title, artist }: { emoji: string; title: string; artist: string }) {
  return (
    <View style={lk.row}>
      <Text style={lk.emoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={lk.title} numberOfLines={1}>{title}</Text>
        <Text style={lk.artist} numberOfLines={1}>{artist}</Text>
      </View>
    </View>
  );
}
const lk = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  emoji:  { fontSize: 24, width: 34, textAlign: 'center' },
  title:  { fontSize: 13, fontWeight: '600', color: D.text },
  artist: { fontSize: 11, color: D.sub, marginTop: 1 },
});

// ─── 메인 ────────────────────────────────────────────────────────
export default function MusicTasteScreen() {
  const navigation = useNavigation<any>();

  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [userId,    setUserId]    = useState<string | null>(null);

  // 취향 상태
  const [preferredMoods, setPreferredMoods] = useState<string[]>([]);
  const [avoidedMoods,   setAvoidedMoods]   = useState<string[]>([]);
  const [bpmRange,       setBpmRange]        = useState<{ min: number; max: number }>({ min: 70, max: 130 });
  const [autoLearn,      setAutoLearn]       = useState(true);

  // 좋아요 이력 미리보기
  const [likedTracks, setLikedTracks] = useState<any[]>([]);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id ?? null;
      setUserId(uid);

      if (uid) {
        // 기존 취향 프로필 로드
        const { data: profile } = await supabase
          .from('user_music_profiles')
          .select('*')
          .eq('user_id', uid)
          .maybeSingle();

        if (profile) {
          setPreferredMoods(profile.preferred_moods ?? []);
          setAvoidedMoods(profile.avoided_moods ?? []);
          setBpmRange({ min: profile.bpm_min ?? 70, max: profile.bpm_max ?? 130 });
        }

        // 좋아요한 트랙 최근 5개
        const liked = await fetchLikedTracks(uid).catch(() => []);
        setLikedTracks(liked.slice(0, 5));
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMood = (tag: string) => {
    setPreferredMoods(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
    // 선호에 추가하면 기피에서 제거
    setAvoidedMoods(prev => prev.filter(t => t !== tag));
  };

  const toggleAvoid = (tag: string) => {
    setAvoidedMoods(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
    // 기피에 추가하면 선호에서 제거
    setPreferredMoods(prev => prev.filter(t => t !== tag));
  };

  const handleSave = async () => {
    if (!userId) {
      Alert.alert('로그인이 필요해요', '', [
        { text: '취소', style: 'cancel' },
        { text: '로그인', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }
    setSaving(true);
    try {
      await saveUserMusicProfile(userId, {
        preferred_moods: preferredMoods,
        avoided_moods:   avoidedMoods,
        bpm_min:         bpmRange.min,
        bpm_max:         bpmRange.max,
      });
      Alert.alert('✅ 저장 완료', '취향이 반영됐어요. 다음 AI 큐레이션부터 적용돼요!', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('저장 실패', '잠시 후 다시 시도해주세요');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar style="light" />
        <ActivityIndicator color={D.accent} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />

      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>‹ 뒤로</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>🎵 내 음악 취향</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={s.saveBtn}>
          <Text style={[s.saveBtnText, saving && { opacity: 0.5 }]}>
            {saving ? '저장 중…' : '저장'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>

        {/* ── 설명 ── */}
        <View style={s.heroBanner}>
          <Text style={s.heroEmoji}>🎧</Text>
          <Text style={s.heroTitle}>취향을 알려주세요</Text>
          <Text style={s.heroDesc}>
            선택한 정보로 AI가 날씨·시간대·가게 분위기에{'\n'}딱 맞는 플레이리스트를 만들어드려요
          </Text>
        </View>

        {/* ── 좋아하는 분위기 ── */}
        <Text style={s.sectionTitle}>좋아하는 분위기 <Text style={s.sectionSub}>(복수 선택)</Text></Text>
        <View style={s.moodGrid}>
          {MOOD_OPTIONS.map(opt => (
            <SelectChip
              key={opt.tag}
              label={opt.label}
              desc={opt.desc}
              active={preferredMoods.includes(opt.tag)}
              onPress={() => toggleMood(opt.tag)}
            />
          ))}
        </View>

        {/* ── BPM 범위 ── */}
        <Text style={s.sectionTitle}>선호 템포</Text>
        <View style={s.bpmRow}>
          {BPM_OPTIONS.map(opt => {
            const active = bpmRange.min === opt.min && bpmRange.max === opt.max;
            return (
              <TouchableOpacity
                key={opt.label}
                onPress={() => setBpmRange({ min: opt.min, max: opt.max })}
                activeOpacity={0.8}
                style={[bpm.btn, active && bpm.btnActive]}
              >
                <Text style={[bpm.label, active && bpm.labelActive]}>{opt.label}</Text>
                <Text style={[bpm.desc, active && { color: D.accent }]}>{opt.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── 기피 장르 ── */}
        <Text style={s.sectionTitle}>
          싫어하는 장르 <Text style={s.sectionSub}>(해당 없으면 건너뛰세요)</Text>
        </Text>
        <View style={s.avoidRow}>
          {AVOID_OPTIONS.map(opt => (
            <AvoidChip
              key={opt.tag}
              label={opt.label}
              active={avoidedMoods.includes(opt.tag)}
              onPress={() => toggleAvoid(opt.tag)}
            />
          ))}
        </View>

        {/* ── 자동 학습 ── */}
        <View style={s.learnRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.learnTitle}>🤖 청취 기록으로 자동 학습</Text>
            <Text style={s.learnDesc}>
              좋아요 누른 곡·시간대·날씨를 학습해{'\n'}점점 더 정확한 추천을 드려요
            </Text>
          </View>
          <Switch
            value={autoLearn}
            onValueChange={setAutoLearn}
            trackColor={{ false: D.border, true: D.accent }}
            thumbColor="#fff"
            ios_backgroundColor={D.border}
          />
        </View>

        {/* ── 좋아요한 곡 미리보기 ── */}
        {likedTracks.length > 0 && (
          <View style={s.likedSection}>
            <Text style={s.sectionTitle}>❤️ 내가 좋아요 한 곡</Text>
            <View style={s.likedCard}>
              {likedTracks.map((track, i) => (
                <View key={track.id}>
                  <LikedTrackMini
                    emoji={track.cover_emoji}
                    title={track.title}
                    artist={track.artist}
                  />
                  {i < likedTracks.length - 1 && <View style={s.divider} />}
                </View>
              ))}
            </View>
            <Text style={s.likedHint}>
              좋아요한 곡의 무드가 AI 추천에 자동 반영돼요
            </Text>
          </View>
        )}

        {/* ── 현재 취향 요약 ── */}
        {preferredMoods.length > 0 && (
          <View style={s.summaryCard}>
            <Text style={s.summaryTitle}>📋 현재 취향 요약</Text>
            <View style={s.summaryTags}>
              {preferredMoods.map(tag => (
                <View key={tag} style={s.summaryTag}>
                  <Text style={s.summaryTagText}>{tag}</Text>
                </View>
              ))}
            </View>
            {avoidedMoods.length > 0 && (
              <Text style={s.summaryAvoid}>
                기피: {avoidedMoods.join(', ')}
              </Text>
            )}
          </View>
        )}

        {/* ── 저장 버튼 ── */}
        <TouchableOpacity
          style={[s.saveFullBtn, saving && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={s.saveFullBtnText}>
            {saving ? '저장 중…' : '✅ 취향 저장하기'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── BPM 버튼 스타일 ─────────────────────────────────────────────
const bpm = StyleSheet.create({
  btn:        { flex: 1, backgroundColor: D.card, borderRadius: 12, borderWidth: 1.5, borderColor: D.border, padding: 10, alignItems: 'center', gap: 3 },
  btnActive:  { borderColor: D.accent, backgroundColor: D.accentDim },
  label:      { fontSize: 13, fontWeight: '700', color: D.sub },
  labelActive:{ color: D.accent },
  desc:       { fontSize: 10, color: D.muted },
});

// ─── 스타일 ──────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: D.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: D.border,
  },
  backBtn:     { paddingRight: 12 },
  backText:    { fontSize: 17, color: '#60A5FA' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: D.text },
  saveBtn:     { paddingLeft: 12 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: D.accent },

  body: { padding: 20, gap: 0 },

  heroBanner: { alignItems: 'center', paddingVertical: 24, gap: 8, marginBottom: 8 },
  heroEmoji:  { fontSize: 48 },
  heroTitle:  { fontSize: 22, fontWeight: '900', color: D.text, letterSpacing: -0.5 },
  heroDesc:   { fontSize: 13, color: D.sub, textAlign: 'center', lineHeight: 20 },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: D.text, marginTop: 24, marginBottom: 12, letterSpacing: -0.2 },
  sectionSub:   { fontSize: 12, fontWeight: '400', color: D.muted },

  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bpmRow:   { flexDirection: 'row', gap: 8 },
  avoidRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  learnRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: D.surface, borderRadius: 14, padding: 16,
    marginTop: 24, borderWidth: 1, borderColor: D.border,
  },
  learnTitle: { fontSize: 14, fontWeight: '700', color: D.text, marginBottom: 4 },
  learnDesc:  { fontSize: 12, color: D.sub, lineHeight: 18 },

  likedSection: { marginTop: 24 },
  likedCard:    { backgroundColor: D.surface, borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: D.border },
  divider:      { height: StyleSheet.hairlineWidth, backgroundColor: D.border },
  likedHint:    { fontSize: 11, color: D.muted, marginTop: 8, textAlign: 'center' },

  summaryCard: {
    marginTop: 24, backgroundColor: D.surface, borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: D.accentDim, gap: 10,
  },
  summaryTitle:   { fontSize: 13, fontWeight: '700', color: D.sub },
  summaryTags:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  summaryTag:     { backgroundColor: D.accentDim, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  summaryTagText: { fontSize: 12, fontWeight: '600', color: D.accent },
  summaryAvoid:   { fontSize: 12, color: D.error },

  saveFullBtn: {
    backgroundColor: D.accent, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 28,
    shadowColor: D.accent, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  saveFullBtnText: { fontSize: 16, fontWeight: '900', color: '#fff' },
});
