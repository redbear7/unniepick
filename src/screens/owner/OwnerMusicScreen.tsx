// ================================================================
// 사장님 음악 제작 화면
// 흐름: 스타일 구성 → Suno 생성 → 재생 → ❤️/😕 컨펌 → 라이브러리
// ================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { Audio } from 'expo-av';

import { supabase } from '../../lib/supabase';
import {
  buildStoreDNA, calcStoreMoodAverage, saveGeneratedTrack, confirmTrack,
  fetchLikedTracks, GeneratedTrack,
} from '../../lib/services/trackMatchingService';
import { generateTrackWithSuno } from '../../lib/services/playlistGenerationService';
import { updateStoreProfile } from '../../lib/services/propagationService';

const SUNO_URL_KEY = 'owner_suno_api_url';

// ─── 기본 스타일 팔레트 ──────────────────────────────────────────
const STYLE_PRESETS = [
  { label: 'K-pop 팝', tags: ['K-pop', 'upbeat', 'synth', 'female vocals', '120 BPM'] },
  { label: '카페 재즈', tags: ['jazz', 'acoustic', 'chill', 'piano', '80 BPM'] },
  { label: '편의점 BGM', tags: ['j-pop', 'bright', 'cute', 'light', '100 BPM'] },
  { label: '헬스장', tags: ['EDM', 'electronic', 'high energy', 'drops', '140 BPM'] },
  { label: '레스토랑', tags: ['bossa nova', 'smooth', 'elegant', 'guitar', '90 BPM'] },
  { label: '트렌디', tags: ['hip-hop', 'lo-fi', 'chill', 'trap beats', '95 BPM'] },
];

export default function OwnerMusicScreen() {
  const navigation = useNavigation<any>();
  const soundRef   = useRef<any>(null);

  // ── 매장 정보
  const [storeId,   setStoreId]   = useState<string | null>(null);
  const [storeDNA,  setStoreDNA]  = useState<string[]>([]);
  const [loading,   setLoading]   = useState(true);

  // ── Suno URL
  const [sunoUrl,    setSunoUrl]    = useState('');
  const [urlEditing, setUrlEditing] = useState(false);
  const [urlInput,   setUrlInput]   = useState('');

  // ── 스타일 태그 (선택 + 커스텀)
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customInput,  setCustomInput]  = useState('');
  const [bpm,          setBpm]          = useState('100');

  // ── 생성 상태
  const [genState,    setGenState]    = useState<'idle' | 'generating' | 'ready' | 'confirmed'>('idle');
  const [genProgress, setGenProgress] = useState('');
  const [currentTrack, setCurrentTrack] = useState<GeneratedTrack | null>(null);

  // ── 오디오
  const [playing,   setPlaying]   = useState(false);
  const [tryCount,  setTryCount]  = useState(1);

  // ── 라이브러리
  const [library,       setLibrary]       = useState<GeneratedTrack[]>([]);
  const [libPlaying,    setLibPlaying]    = useState<string | null>(null);
  const [libSound,      setLibSound]      = useState<any>(null);
  const [showLibrary,   setShowLibrary]   = useState(false);

  // ── 초기 로드
  useEffect(() => {
    initScreen();
    return () => { stopAll(); };
  }, []);

  const stopAll = async () => {
    try {
      await soundRef.current?.stopAsync();
      await soundRef.current?.unloadAsync();
    } catch (_) {}
    try {
      await libSound?.stopAsync();
      await libSound?.unloadAsync();
    } catch (_) {}
  };

  const initScreen = async () => {
    setLoading(true);
    try {
      // 1. Suno URL 불러오기
      const saved = await SecureStore.getItemAsync(SUNO_URL_KEY);
      if (saved) { setSunoUrl(saved); setUrlInput(saved); }

      // 2. 매장 ID + DNA
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: store } = await supabase
        .from('stores')
        .select('id, category')
        .eq('owner_id', session.user.id)
        .single();
      if (!store) return;

      setStoreId(store.id);

      // 3. DNA 태그 로드
      const dna = await buildStoreDNA(store.id);
      setStoreDNA(dna);
      if (dna.length > 0) setSelectedTags(dna.slice(0, 6));

      // 4. 라이브러리 로드
      const liked = await fetchLikedTracks(store.id);
      setLibrary(liked);
    } catch (e) {
      console.warn('initScreen 오류:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Suno URL 저장
  const handleSaveUrl = async () => {
    const url = urlInput.trim();
    setSunoUrl(url);
    await SecureStore.setItemAsync(SUNO_URL_KEY, url);
    setUrlEditing(false);
  };

  // ── 태그 토글
  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // ── 커스텀 태그 추가
  const addCustomTag = () => {
    const tag = customInput.trim();
    if (!tag || selectedTags.includes(tag)) { setCustomInput(''); return; }
    setSelectedTags(prev => [...prev, tag]);
    setCustomInput('');
  };

  // ── 프리셋 적용
  const applyPreset = (tags: string[]) => {
    setSelectedTags(tags);
    const bpmTag = tags.find(t => t.includes('BPM'));
    if (bpmTag) {
      const n = parseInt(bpmTag);
      if (!isNaN(n)) setBpm(String(n));
    }
  };

  // ── 음악 생성
  const handleGenerate = async () => {
    if (!storeId) { Alert.alert('매장 정보를 불러오는 중이에요'); return; }
    if (selectedTags.length === 0) { Alert.alert('스타일 태그를 1개 이상 선택해주세요'); return; }
    if (!sunoUrl) {
      Alert.alert('Suno API URL을 먼저 입력해주세요', '상단의 URL 입력란에 Suno 서버 주소를 입력하세요');
      return;
    }

    // 기존 재생 중지
    await stopAll();
    setPlaying(false);
    setLibPlaying(null);
    setLibSound(null);

    setGenState('generating');
    setGenProgress('🤖 스타일 프롬프트 구성 중...');
    setCurrentTrack(null);
    setTryCount(1);

    try {
      const bpmNum    = parseInt(bpm) || 100;
      const bpmTag    = `${bpmNum} BPM`;
      const allTags   = selectedTags.includes(bpmTag) ? selectedTags : [...selectedTags, bpmTag];
      const prompt    = allTags.slice(0, 12).join(', ');
      const title     = `AI Track ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
      const mv        = await calcStoreMoodAverage(storeId) ?? { energy: 0.6, valence: 0.6, danceability: 0.5 };

      setGenProgress('💾 트랙 레코드 생성 중...');
      const track = await saveGeneratedTrack({
        storeId,
        title,
        stylePrompt: prompt,
        styleTags:   allTags,
        moodVector:  mv,
        bpmEstimate: bpmNum,
        sunoStatus:  'generating',
      });

      setGenProgress('🎵 Suno에서 음악 제작 중... (최대 3~5분)');
      await generateTrackWithSuno(track.id, prompt, title, sunoUrl);

      // 완성된 트랙 조회
      setGenProgress('✅ 완성! 불러오는 중...');
      const { data: updated } = await supabase
        .from('generated_tracks')
        .select('*')
        .eq('id', track.id)
        .single();

      if (!updated || updated.suno_status === 'error') {
        throw new Error(updated?.error_msg ?? 'Suno 생성에 실패했어요');
      }

      setCurrentTrack(updated as GeneratedTrack);
      setGenState('ready');

      // 자동 재생
      if (updated.audio_url) {
        await playAudio(updated.audio_url);
      }
    } catch (e: any) {
      setGenState('idle');
      Alert.alert('생성 실패', e.message ?? '다시 시도해주세요');
    }
  };

  // ── 오디오 재생
  const playAudio = async (url: string) => {
    try {
      await soundRef.current?.stopAsync();
      await soundRef.current?.unloadAsync();
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
      soundRef.current = sound;
      setPlaying(true);
      sound.setOnPlaybackStatusUpdate((s: any) => {
        if (s.didJustFinish) setPlaying(false);
      });
    } catch (_) {}
  };

  const handlePlayPause = async () => {
    if (!soundRef.current) return;
    if (playing) { await soundRef.current.pauseAsync(); setPlaying(false); }
    else          { await soundRef.current.playAsync();  setPlaying(true);  }
  };

  // ── 컨펌 (좋아요 / 싫어요)
  const handleConfirm = async (liked: boolean) => {
    if (!currentTrack || !storeId) return;

    try {
      const { canRetry } = await confirmTrack(currentTrack.id, liked);

      if (liked) {
        // 라이브러리에 추가
        const { data: updated } = await supabase
          .from('generated_tracks')
          .select('*')
          .eq('id', currentTrack.id)
          .single();
        if (updated) setLibrary(prev => [updated as GeneratedTrack, ...prev]);

        // 프로필 업데이트 (비동기)
        updateStoreProfile(storeId).catch(() => {});

        setGenState('confirmed');
        setTimeout(() => {
          setGenState('idle');
          setCurrentTrack(null);
        }, 2500);
      } else if (canRetry && tryCount < 3) {
        // 다른 스타일로 재생성 (태그 살짝 변형)
        setTryCount(prev => prev + 1);
        await stopAll();
        setPlaying(false);
        setGenState('generating');
        setGenProgress('🔄 다른 스타일로 다시 만들어볼게요...');
        setCurrentTrack(null);

        // 태그 순서 섞기 + 재생성
        const shuffled = [...selectedTags].sort(() => Math.random() - 0.5);
        const bpmNum   = parseInt(bpm) || 100;
        const variant  = bpmNum + Math.round((Math.random() - 0.5) * 20);
        const bpmTag   = `${variant} BPM`;
        const allTags  = [bpmTag, ...shuffled].slice(0, 12);
        const title    = `AI Track v${tryCount + 1}`;
        const mv       = await calcStoreMoodAverage(storeId) ?? { energy: 0.6, valence: 0.6, danceability: 0.5 };

        const track = await saveGeneratedTrack({
          storeId, title,
          stylePrompt: allTags.join(', '),
          styleTags:   allTags,
          moodVector:  mv,
          bpmEstimate: variant,
          sunoStatus:  'generating',
        });

        setGenProgress('🎵 다른 스타일로 제작 중...');
        await generateTrackWithSuno(track.id, allTags.join(', '), title, sunoUrl);

        const { data: updated } = await supabase
          .from('generated_tracks')
          .select('*')
          .eq('id', track.id)
          .single();

        if (!updated || updated.suno_status === 'error') {
          throw new Error(updated?.error_msg ?? '재생성 실패');
        }

        setCurrentTrack(updated as GeneratedTrack);
        setGenState('ready');
        if (updated.audio_url) await playAudio(updated.audio_url);
      } else {
        Alert.alert('알겠어요 😊', 'AI가 계속 학습하고 있어요!\n태그를 바꿔서 다시 시도해보세요.');
        setGenState('idle');
        setCurrentTrack(null);
      }
    } catch (e: any) {
      Alert.alert('오류', e.message ?? '다시 시도해주세요');
      setGenState('idle');
    }
  };

  // ── 라이브러리 재생
  const handleLibPlay = async (track: GeneratedTrack) => {
    if (!track.audio_url) return;
    if (libPlaying === track.id) {
      await libSound?.pauseAsync();
      setLibPlaying(null);
      return;
    }
    try {
      await libSound?.stopAsync();
      await libSound?.unloadAsync();
      await soundRef.current?.stopAsync();
      setPlaying(false);
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: track.audio_url }, { shouldPlay: true });
      setLibSound(sound);
      setLibPlaying(track.id);
      sound.setOnPlaybackStatusUpdate((s: any) => {
        if (s.didJustFinish) setLibPlaying(null);
      });
    } catch (_) {}
  };

  // ─────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color={ORG} />
          <Text style={s.loadingText}>매장 정보 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>🎵 음악 제작</Text>
        <TouchableOpacity onPress={() => setShowLibrary(true)} style={s.libBtn}>
          <Text style={s.libBtnText}>라이브러리 {library.length > 0 ? `(${library.length})` : ''}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Suno API URL ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>🔗 Suno API URL</Text>
          {urlEditing ? (
            <View style={s.urlRow}>
              <TextInput
                style={[s.urlInput, { flex: 1 }]}
                value={urlInput}
                onChangeText={setUrlInput}
                placeholder="http://localhost:3000"
                placeholderTextColor="#555"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSaveUrl}
              />
              <TouchableOpacity style={s.urlSaveBtn} onPress={handleSaveUrl}>
                <Text style={s.urlSaveTxt}>저장</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={s.urlDisplay} onPress={() => { setUrlInput(sunoUrl); setUrlEditing(true); }}>
              <Text style={sunoUrl ? s.urlText : s.urlPlaceholder} numberOfLines={1}>
                {sunoUrl || '탭하여 Suno API URL 입력'}
              </Text>
              <Text style={s.urlEdit}>수정</Text>
            </TouchableOpacity>
          )}
          {!sunoUrl && (
            <Text style={s.urlHint}>Suno API 서버(suno-api 오픈소스)를 로컬에서 실행하거나, 배포된 URL을 입력하세요</Text>
          )}
        </View>

        {/* ── 스타일 프리셋 ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>🎨 스타일 프리셋</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.presetRow}>
              {STYLE_PRESETS.map(p => (
                <TouchableOpacity
                  key={p.label}
                  style={s.presetChip}
                  onPress={() => applyPreset(p.tags)}
                >
                  <Text style={s.presetText}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* ── 스타일 태그 ── */}
        <View style={s.card}>
          <View style={s.cardRow}>
            <Text style={s.cardTitle}>🏷 스타일 태그</Text>
            <Text style={s.cardHint}>{selectedTags.length}/12 선택됨</Text>
          </View>

          {/* DNA 태그 */}
          {storeDNA.length > 0 && (
            <>
              <Text style={s.tagGroupLabel}>매장 DNA</Text>
              <View style={s.tagWrap}>
                {storeDNA.slice(0, 16).map(tag => (
                  <TouchableOpacity
                    key={tag}
                    style={[s.tagChip, selectedTags.includes(tag) && s.tagChipOn]}
                    onPress={() => toggleTag(tag)}
                  >
                    <Text style={[s.tagText, selectedTags.includes(tag) && s.tagTextOn]}>{tag}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* 커스텀 태그 */}
          <View style={s.urlRow}>
            <TextInput
              style={[s.urlInput, { flex: 1 }]}
              value={customInput}
              onChangeText={setCustomInput}
              placeholder="직접 입력 (예: acoustic guitar)"
              placeholderTextColor="#555"
              returnKeyType="done"
              onSubmitEditing={addCustomTag}
            />
            <TouchableOpacity style={s.urlSaveBtn} onPress={addCustomTag}>
              <Text style={s.urlSaveTxt}>추가</Text>
            </TouchableOpacity>
          </View>

          {/* 선택된 태그 */}
          {selectedTags.length > 0 && (
            <View style={s.tagWrap}>
              {selectedTags.map(tag => (
                <TouchableOpacity key={tag} style={s.tagChipOn} onPress={() => toggleTag(tag)}>
                  <Text style={s.tagTextOn}>{tag} ✕</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* BPM */}
          <View style={[s.urlRow, { marginTop: 8 }]}>
            <Text style={s.tagGroupLabel}>BPM</Text>
            <TextInput
              style={[s.urlInput, { width: 80, marginLeft: 8 }]}
              value={bpm}
              onChangeText={v => setBpm(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={3}
            />
          </View>
        </View>

        {/* ── 생성 버튼 ── */}
        {genState === 'idle' && (
          <TouchableOpacity
            style={[s.genBtn, (!sunoUrl || selectedTags.length === 0) && s.genBtnDisabled]}
            onPress={handleGenerate}
            disabled={!sunoUrl || selectedTags.length === 0}
            activeOpacity={0.85}
          >
            <Text style={s.genBtnText}>🎵 음악 만들기</Text>
          </TouchableOpacity>
        )}

        {/* ── 생성 중 ── */}
        {genState === 'generating' && (
          <View style={s.genLoadBox}>
            <ActivityIndicator size="large" color={ORG} />
            <Text style={s.genLoadTitle}>
              {tryCount > 1 ? `다시 제작 중 (${tryCount}/3번째)` : '음악 제작 중'}
            </Text>
            <Text style={s.genLoadSub}>{genProgress}</Text>
            <Text style={s.genLoadHint}>Suno AI가 곡을 만들고 있어요{'\n'}보통 3~5분이 소요됩니다</Text>
          </View>
        )}

        {/* ── 생성 완료 ── */}
        {genState === 'ready' && currentTrack && (
          <View style={s.trackCard}>
            {/* 시도 횟수 dots */}
            <View style={s.tryDots}>
              {[1, 2, 3].map(n => (
                <View key={n} style={[s.tryDot, { backgroundColor: n <= tryCount ? ORG : '#374151' }]} />
              ))}
            </View>

            <Text style={s.trackTitle} numberOfLines={2}>{currentTrack.title ?? '새 트랙'}</Text>
            {currentTrack.bpm_estimate && (
              <Text style={s.trackBpm}>~{currentTrack.bpm_estimate} BPM</Text>
            )}

            {/* 태그 */}
            <View style={s.tagWrap}>
              {(currentTrack.style_tags ?? []).slice(0, 8).map(tag => (
                <View key={tag} style={s.trackTag}>
                  <Text style={s.trackTagText}>{tag}</Text>
                </View>
              ))}
            </View>

            {/* Mood bars */}
            {currentTrack.mood_embedding && (
              <View style={s.moodBars}>
                {[
                  { label: '에너지',  val: currentTrack.mood_embedding[0] },
                  { label: '밝음',    val: currentTrack.mood_embedding[1] },
                  { label: '댄서블', val: currentTrack.mood_embedding[2] },
                ].map(({ label, val }) => (
                  <View key={label} style={s.moodRow}>
                    <Text style={s.moodLabel}>{label}</Text>
                    <View style={s.moodBg}>
                      <View style={[s.moodFill, { width: `${Math.round(val * 100)}%` as any }]} />
                    </View>
                    <Text style={s.moodVal}>{Math.round(val * 100)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* 오디오 플레이어 */}
            {currentTrack.audio_url ? (
              <TouchableOpacity style={s.playBtn} onPress={handlePlayPause}>
                <Text style={s.playBtnIcon}>{playing ? '⏸' : '▶️'}</Text>
                <Text style={s.playBtnText}>{playing ? '일시정지' : '미리듣기'}</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.noAudio}>
                <Text style={s.noAudioText}>🔇 오디오 없음 (Suno 재시도 필요)</Text>
              </View>
            )}

            {/* 컨펌 버튼 */}
            <View style={s.confirmRow}>
              <TouchableOpacity style={s.dislikeBtn} onPress={() => handleConfirm(false)}>
                <Text style={s.confirmBtnIcon}>😕</Text>
                <Text style={s.confirmBtnText}>다른 스타일</Text>
                {tryCount >= 3 && <Text style={s.lastChance}>마지막</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.likeBtn} onPress={() => handleConfirm(true)}>
                <Text style={s.confirmBtnIcon}>❤️</Text>
                <Text style={s.confirmBtnText}>좋아요!</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── 확정 완료 ── */}
        {genState === 'confirmed' && (
          <View style={s.confirmedBox}>
            <Text style={{ fontSize: 48, textAlign: 'center' }}>❤️</Text>
            <Text style={s.confirmedTitle}>라이브러리에 추가됐어요!</Text>
            <Text style={s.confirmedSub}>이 곡의 DNA로 매장 음악이 학습됩니다</Text>
          </View>
        )}

        {/* ── 라이브러리 미리보기 ── */}
        {library.length > 0 && genState === 'idle' && (
          <View style={s.card}>
            <View style={s.cardRow}>
              <Text style={s.cardTitle}>❤️ 내 음악 라이브러리</Text>
              <Text style={s.cardHint}>{library.length}곡</Text>
            </View>
            {library.slice(0, 5).map(track => (
              <TouchableOpacity
                key={track.id}
                style={s.libRow}
                onPress={() => handleLibPlay(track)}
                disabled={!track.audio_url}
              >
                <View style={s.libInfo}>
                  <Text style={s.libTitle} numberOfLines={1}>{track.title ?? '제목 없음'}</Text>
                  {track.bpm_estimate && (
                    <Text style={s.libBpm}>{track.bpm_estimate} BPM</Text>
                  )}
                </View>
                <View style={[s.libPlayIcon, { backgroundColor: libPlaying === track.id ? ORG : '#1F2937' }]}>
                  <Text style={{ fontSize: 14 }}>{libPlaying === track.id ? '⏸' : track.audio_url ? '▶️' : '🔇'}</Text>
                </View>
              </TouchableOpacity>
            ))}
            {library.length > 5 && (
              <TouchableOpacity onPress={() => setShowLibrary(true)}>
                <Text style={{ color: ORG, textAlign: 'center', fontSize: 13, paddingTop: 8 }}>
                  + {library.length - 5}곡 더 보기
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── 전체 라이브러리 모달 ── */}
      <Modal visible={showLibrary} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.safe}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>❤️ 음악 라이브러리</Text>
            <TouchableOpacity onPress={() => setShowLibrary(false)}>
              <Text style={{ color: ORG, fontWeight: '700', fontSize: 15 }}>닫기</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
            {library.length === 0 && (
              <Text style={{ color: '#6B7280', textAlign: 'center', marginTop: 40 }}>
                아직 좋아요한 곡이 없어요{'\n'}음악을 만들고 ❤️를 눌러보세요!
              </Text>
            )}
            {library.map(track => (
              <TouchableOpacity
                key={track.id}
                style={s.libRow}
                onPress={() => handleLibPlay(track)}
                disabled={!track.audio_url}
              >
                <View style={s.libInfo}>
                  <Text style={s.libTitle} numberOfLines={1}>{track.title ?? '제목 없음'}</Text>
                  <Text style={s.libBpm}>
                    {track.bpm_estimate ? `${track.bpm_estimate} BPM · ` : ''}
                    {(track.style_tags ?? []).slice(0, 3).join(', ')}
                  </Text>
                </View>
                <View style={[s.libPlayIcon, { backgroundColor: libPlaying === track.id ? ORG : '#1F2937' }]}>
                  <Text style={{ fontSize: 14 }}>{libPlaying === track.id ? '⏸' : track.audio_url ? '▶️' : '🔇'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Design tokens ────────────────────────────────────────────────
const ORG  = '#FF6F0F';
const DARK = '#0D0F14';
const CARD = '#13161D';

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: DARK },
  scroll:        { padding: 16, gap: 14 },
  loadingBox:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:   { color: '#9CA3AF', fontSize: 14 },

  // Header
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  backBtn:      {},
  backText:     { color: ORG, fontWeight: '600', fontSize: 14 },
  headerTitle:  { color: '#F9FAFB', fontWeight: '800', fontSize: 17 },
  libBtn:       {},
  libBtnText:   { color: '#9CA3AF', fontSize: 13 },

  // Card
  card:         { backgroundColor: CARD, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: '#1F2937' },
  cardTitle:    { color: '#F9FAFB', fontWeight: '800', fontSize: 14 },
  cardHint:     { color: '#6B7280', fontSize: 12 },
  cardRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // URL
  urlRow:       { flexDirection: 'row', gap: 8, alignItems: 'center' },
  urlInput:     { backgroundColor: '#1F2937', color: '#F9FAFB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 },
  urlSaveBtn:   { backgroundColor: ORG, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  urlSaveTxt:   { color: '#fff', fontWeight: '700', fontSize: 13 },
  urlDisplay:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1F2937', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  urlText:      { color: '#F9FAFB', fontSize: 13, flex: 1 },
  urlPlaceholder: { color: '#555', fontSize: 13, flex: 1 },
  urlEdit:      { color: ORG, fontSize: 12, fontWeight: '700' },
  urlHint:      { color: '#4B5563', fontSize: 11, lineHeight: 16 },

  // Presets
  presetRow:    { flexDirection: 'row', gap: 8, paddingRight: 4 },
  presetChip:   { backgroundColor: '#1F2937', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  presetText:   { color: '#D1D5DB', fontSize: 12, fontWeight: '600' },

  // Tags
  tagGroupLabel: { color: '#6B7280', fontSize: 11, fontWeight: '600', marginBottom: -4 },
  tagWrap:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip:       { backgroundColor: '#1F2937', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: '#374151' },
  tagChipOn:     { backgroundColor: ORG + '22', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: ORG },
  tagText:       { color: '#9CA3AF', fontSize: 12 },
  tagTextOn:     { color: ORG, fontSize: 12, fontWeight: '700' },

  // Generate button
  genBtn:        { backgroundColor: ORG, borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 4 },
  genBtnDisabled: { backgroundColor: '#374151' },
  genBtnText:    { color: '#fff', fontWeight: '800', fontSize: 17 },

  // Generating state
  genLoadBox:    { backgroundColor: CARD, borderRadius: 16, padding: 28, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#1F2937' },
  genLoadTitle:  { color: '#F9FAFB', fontWeight: '800', fontSize: 16 },
  genLoadSub:    { color: ORG, fontSize: 14, textAlign: 'center' },
  genLoadHint:   { color: '#6B7280', fontSize: 12, textAlign: 'center', lineHeight: 18 },

  // Track card
  trackCard:     { backgroundColor: CARD, borderRadius: 20, padding: 20, gap: 14, borderWidth: 1, borderColor: '#1F2937' },
  tryDots:       { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  tryDot:        { width: 8, height: 8, borderRadius: 4 },
  trackTitle:    { color: '#F9FAFB', fontWeight: '800', fontSize: 18, textAlign: 'center' },
  trackBpm:      { color: '#6B7280', fontSize: 13, textAlign: 'center', marginTop: -8 },
  trackTag:      { backgroundColor: '#1F2937', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  trackTagText:  { color: '#9CA3AF', fontSize: 11 },

  // Mood bars
  moodBars:      { gap: 8 },
  moodRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  moodLabel:     { color: '#6B7280', fontSize: 11, width: 44 },
  moodBg:        { flex: 1, height: 5, backgroundColor: '#1F2937', borderRadius: 3 },
  moodFill:      { height: 5, backgroundColor: ORG, borderRadius: 3 },
  moodVal:       { color: '#6B7280', fontSize: 11, width: 24, textAlign: 'right' },

  // Play button
  playBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1F2937', borderRadius: 12, paddingVertical: 14 },
  playBtnIcon:   { fontSize: 20 },
  playBtnText:   { color: '#F9FAFB', fontWeight: '700', fontSize: 15 },
  noAudio:       { alignItems: 'center', paddingVertical: 10 },
  noAudioText:   { color: '#4B5563', fontSize: 13 },

  // Confirm
  confirmRow:    { flexDirection: 'row', gap: 10 },
  dislikeBtn:    { flex: 1, backgroundColor: '#1F2937', borderRadius: 14, paddingVertical: 16, alignItems: 'center', gap: 4 },
  likeBtn:       { flex: 1, backgroundColor: '#22C55E', borderRadius: 14, paddingVertical: 16, alignItems: 'center', gap: 4 },
  confirmBtnIcon: { fontSize: 22 },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  lastChance:    { color: '#6B7280', fontSize: 10 },

  // Confirmed
  confirmedBox:  { backgroundColor: CARD, borderRadius: 20, padding: 32, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#22C55E33' },
  confirmedTitle: { color: '#22C55E', fontWeight: '800', fontSize: 18 },
  confirmedSub:  { color: '#9CA3AF', fontSize: 13, textAlign: 'center' },

  // Library
  libRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1F2937', borderRadius: 12, padding: 12 },
  libInfo:       { flex: 1, gap: 2 },
  libTitle:      { color: '#F9FAFB', fontWeight: '700', fontSize: 13 },
  libBpm:        { color: '#6B7280', fontSize: 11 },
  libPlayIcon:   { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  // Modal
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  modalTitle:    { color: '#F9FAFB', fontWeight: '800', fontSize: 16 },
});
