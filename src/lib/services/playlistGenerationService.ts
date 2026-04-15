// ================================================================
// Phase 5: AI 플레이리스트 자동 생성 서비스
// Claude Haiku → 10곡 스타일 계획
// Suno REST API → 트랙 생성 (optional)
// ================================================================

import { supabase } from '../supabase';
import type { MoodVector } from './musicReferenceService';
import {
  buildStoreDNA, calcStoreMoodAverage, saveGeneratedTrack,
  updateTrackSunoResult,
} from './trackMatchingService';

const ANTHROPIC_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

// ─── 타입 ────────────────────────────────────────────────────

export interface PlannedTrack {
  position:    number;
  title:       string;
  stylePrompt: string;  // Suno 스타일 프롬프트
  styleTags:   string[];
  bpmEstimate: number;
  concept:     string;  // 곡 콘셉트 한 줄 (오너 UI 표시용)
}

export interface GeneratedPlaylist {
  id:         string;
  store_id:   string;
  name:       string;
  mood_tags:  string[];
  gen_status: 'queued' | 'generating' | 'done' | 'error';
  created_at: string;
  tracks:     GeneratedPlaylistTrack[];
}

export interface GeneratedPlaylistTrack {
  id:           string;
  playlist_id:  string;
  position:     number;
  title:        string | null;
  style_prompt: string | null;
  style_tags:   string[];
  bpm_estimate: number | null;
  audio_url:    string | null;
  image_url:    string | null;
  suno_status:  'generating' | 'done' | 'error';
  error_msg:    string | null;
}

// ─── 1. Claude → 10곡 스타일 계획 ────────────────────────────

const PLAN_PROMPT = (
  dna:      string[],
  mv:       MoodVector,
  category: string,
  count:    number,
) => `
당신은 매장 음악 큐레이터입니다. 아래 매장 정보를 바탕으로 Suno AI로 제작할 ${count}곡의 음악 스타일을 계획해 주세요.

매장 업종: ${category}
음악 DNA (좋아요한 곡 태그): ${dna.slice(0, 15).join(', ')}
무드 평균: 에너지 ${Math.round(mv.energy * 100)}, 밝음 ${Math.round(mv.valence * 100)}, 댄서블 ${Math.round(mv.danceability * 100)}

규칙:
- ${count}곡은 각기 다른 분위기/템포를 가져야 함 (너무 비슷한 곡 금지)
- Suno 호환 스타일 태그 사용 (최대 12개 per 곡)
- 매장 DNA와 어울리되 30~50% 변주를 줄 것
- stylePrompt는 영어로, concept는 한국어로

반드시 아래 JSON 배열로만 응답 (설명 없이):
[
  {
    "position": 1,
    "title": "곡 제목 (한국어 또는 영어)",
    "stylePrompt": "K-pop, upbeat, synth, female vocals, 120 BPM",
    "styleTags": ["K-pop", "upbeat", "synth", "female vocals"],
    "bpmEstimate": 120,
    "concept": "오전 활기찬 오픈 분위기"
  }
]
`.trim();

async function planPlaylistTracksWithClaude(
  dna:      string[],
  mv:       MoodVector,
  category: string,
  count     = 10,
): Promise<PlannedTrack[]> {
  if (!ANTHROPIC_KEY) throw new Error('Anthropic API 키가 없어요');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: PLAN_PROMPT(dna, mv, category, count) }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API 오류: ${res.status}`);
  const json    = await res.json();
  const rawText = json.content?.[0]?.text ?? '';
  const cleaned = rawText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

  const parsed: PlannedTrack[] = JSON.parse(cleaned);
  return parsed.map((t, i) => ({
    position:    t.position   ?? i + 1,
    title:       t.title      ?? `트랙 ${i + 1}`,
    stylePrompt: t.stylePrompt ?? '',
    styleTags:   t.styleTags   ?? [],
    bpmEstimate: t.bpmEstimate ?? 100,
    concept:     t.concept     ?? '',
  }));
}

// ─── 2. 플레이리스트 + 큐 생성 ───────────────────────────────

export async function createStorePlaylist(
  storeId:      string,
  storeCategory: string,
  options?: {
    name?:  string;
    count?: number;
    onProgress?: (msg: string) => void;
  },
): Promise<GeneratedPlaylist> {
  const { name, count = 10, onProgress } = options ?? {};

  // (a) 매장 DNA 수집
  onProgress?.('🧬 매장 음악 DNA 분석 중...');
  const [dna, mv] = await Promise.all([
    buildStoreDNA(storeId),
    calcStoreMoodAverage(storeId),
  ]);

  if (dna.length === 0) {
    throw new Error('먼저 레퍼런스 음악에서 좋아요를 눌러주세요!');
  }

  const moodVector = mv ?? { energy: 0.6, valence: 0.6, danceability: 0.5 };

  // (b) Claude로 10곡 계획
  onProgress?.('🤖 AI가 플레이리스트를 계획 중...');
  const planned = await planPlaylistTracksWithClaude(dna, moodVector, storeCategory, count);

  // (c) playlists 레코드 생성
  onProgress?.('💾 플레이리스트 저장 중...');
  const playlistName = name ?? `${new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} AI 플레이리스트`;

  const { data: playlist, error: plErr } = await supabase
    .from('playlists')
    .insert({
      store_id:    storeId,
      name:        playlistName,
      is_curated:  true,
      is_dynamic:  false,
      mood_tags:   dna.slice(0, 8),
      gen_status:  'queued',
      track_count: count,
      curated_at:  new Date().toISOString(),
    })
    .select()
    .single();

  if (plErr) throw new Error(plErr.message);

  // (d) generated_tracks 10개 생성 (suno_status='generating')
  onProgress?.('📋 곡 목록 저장 중...');
  const trackInserts = planned.map(t => ({
    store_id:     storeId,
    playlist_id:  playlist.id,
    position:     t.position,
    title:        t.title,
    style_prompt: t.stylePrompt,
    style_tags:   t.styleTags,
    mood_embedding: [moodVector.energy, moodVector.valence, moodVector.danceability],
    bpm_estimate: t.bpmEstimate,
    suno_status:  'generating',
  }));

  const { data: insertedTracks, error: trackErr } = await supabase
    .from('generated_tracks')
    .insert(trackInserts)
    .select();

  if (trackErr) throw new Error(trackErr.message);

  return {
    id:         playlist.id,
    store_id:   storeId,
    name:       playlistName,
    mood_tags:  dna.slice(0, 8),
    gen_status: 'queued',
    created_at: playlist.created_at,
    tracks:     (insertedTracks ?? []) as unknown as GeneratedPlaylistTrack[],
  };
}

// ─── 3. Suno REST API로 단일 트랙 생성 ───────────────────────

export async function generateTrackWithSuno(
  trackId:      string,
  stylePrompt:  string,
  title:        string,
  sunoApiUrl:   string,
): Promise<void> {
  // POST /api/custom_generate
  const genRes = await fetch(`${sunoApiUrl}/api/custom_generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt:     '',
      tags:       stylePrompt,
      title,
      make_instrumental: true,
      wait_audio: false,
    }),
  });

  if (!genRes.ok) {
    await updateTrackSunoResult(trackId, { status: 'error', errorMsg: `Suno API ${genRes.status}` });
    return;
  }

  const genJson = await genRes.json();
  const ids: string[] = (genJson ?? []).map((t: any) => t.id).filter(Boolean);
  if (ids.length === 0) {
    await updateTrackSunoResult(trackId, { status: 'error', errorMsg: 'Suno 생성 ID 없음' });
    return;
  }

  // 폴링: /api/get?ids=...  (최대 5분)
  const sunoId = ids[0];
  const start  = Date.now();
  while (Date.now() - start < 5 * 60_000) {
    await new Promise(r => setTimeout(r, 8000));
    const pollRes = await fetch(`${sunoApiUrl}/api/get?ids=${sunoId}`);
    if (!pollRes.ok) continue;

    const songs: any[] = await pollRes.json();
    const song = songs.find((s: any) => s.id === sunoId);
    if (!song) continue;

    if (song.status === 'complete' || song.audio_url) {
      await updateTrackSunoResult(trackId, {
        sunoId:   sunoId,
        title:    song.title ?? title,
        audioUrl: song.audio_url,
        imageUrl: song.image_url,
        duration: song.duration ? Math.round(song.duration) : undefined,
        status:   'done',
      });
      return;
    }
    if (song.status === 'error') {
      await updateTrackSunoResult(trackId, { status: 'error', errorMsg: 'Suno 생성 오류' });
      return;
    }
  }

  await updateTrackSunoResult(trackId, { status: 'error', errorMsg: '생성 시간 초과' });
}

// ─── 4. 플레이리스트 일괄 생성 (Suno API 있을 때) ────────────

export async function generatePlaylistTracks(
  playlist:    GeneratedPlaylist,
  sunoApiUrl:  string,
  onProgress?: (msg: string, done: number, total: number) => void,
): Promise<void> {
  const tracks = playlist.tracks.filter(t => t.suno_status === 'generating');

  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i];
    onProgress?.(`🎵 ${t.title ?? `트랙 ${i + 1}`} 생성 중...`, i, tracks.length);
    await generateTrackWithSuno(
      t.id,
      t.style_prompt ?? '',
      t.title ?? `트랙 ${i + 1}`,
      sunoApiUrl,
    );
  }

  // 플레이리스트 상태 완료로 업데이트
  await supabase
    .from('playlists')
    .update({ gen_status: 'done' })
    .eq('id', playlist.id);

  onProgress?.('✅ 플레이리스트 생성 완료!', tracks.length, tracks.length);
}

// ─── 5. 매장 플레이리스트 목록 조회 ─────────────────────────

export async function fetchStorePlaylists(storeId: string): Promise<GeneratedPlaylist[]> {
  const { data: playlists } = await supabase
    .from('playlists')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  if (!playlists || playlists.length === 0) return [];

  const playlistIds = playlists.map((p: any) => p.id);
  const { data: tracks } = await supabase
    .from('generated_tracks')
    .select('id, playlist_id, position, title, style_prompt, style_tags, bpm_estimate, audio_url, image_url, suno_status, error_msg')
    .in('playlist_id', playlistIds)
    .order('position');

  return playlists.map((p: any) => ({
    id:         p.id,
    store_id:   p.store_id,
    name:       p.name,
    mood_tags:  p.mood_tags ?? [],
    gen_status: p.gen_status ?? 'done',
    created_at: p.created_at,
    tracks:     (tracks ?? []).filter((t: any) => t.playlist_id === p.id) as GeneratedPlaylistTrack[],
  }));
}
