// ================================================================
// 레퍼런스 음악 분석 서비스 — Phase 2
// YouTube Data API v3 → 메타데이터 추출
// Claude (Anthropic) → 수노 스타일 태그 + mood_vector 생성
// ================================================================

import { supabase } from '../supabase';

const GOOGLE_KEY     = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const ANTHROPIC_KEY  = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

// ─── 타입 정의 ────────────────────────────────────────────────

export interface ExtractedTags {
  genre:      string[];   // ['K-pop', 'Pop']
  mood:       string[];   // ['upbeat', 'cheerful']
  tempo:      string[];   // ['128 BPM', 'danceable']
  instrument: string[];   // ['synth', 'drums']
  vocal:      string[];   // ['female vocals']
  era:        string[];   // ['2020s']
}

export interface MoodVector {
  energy:       number;   // 0.0~1.0
  valence:      number;   // 0.0~1.0  (밝음/슬픔)
  danceability: number;   // 0.0~1.0
}

export interface YoutubeMetadata {
  id:       string;
  title:    string;
  artist:   string;
  channel:  string;
  thumb:    string;
}

export interface MusicReference {
  id:              string;
  store_id:        string;
  youtube_url:     string;
  youtube_id:      string | null;
  youtube_title:   string | null;
  youtube_artist:  string | null;
  youtube_channel: string | null;
  youtube_thumb:   string | null;
  extracted_tags:  ExtractedTags | null;
  bpm_estimate:    number | null;
  mood_vector:     MoodVector | null;
  status:          'pending' | 'analyzing' | 'done' | 'error';
  error_msg:       string | null;
  created_at:      string;
}

// ─── 1. YouTube URL → Video ID 파싱 ──────────────────────────

export function parseYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,   // 순수 ID만 붙여넣은 경우
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// ─── 2. YouTube Data API v3 → 메타데이터 ─────────────────────

async function fetchYoutubeMetadata(videoId: string): Promise<YoutubeMetadata | null> {
  const url =
    `https://www.googleapis.com/youtube/v3/videos` +
    `?id=${videoId}&key=${GOOGLE_KEY}` +
    `&part=snippet`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const json = await res.json();
  const item = json.items?.[0]?.snippet;
  if (!item) return null;

  // 아티스트: "아티스트 - 제목" 형식이면 분리, 아니면 channel명 사용
  let artist  = item.channelTitle ?? '';
  let title   = item.title ?? '';
  const dash  = title.match(/^(.+?)\s*[-–]\s*(.+)$/);
  if (dash) {
    artist = dash[1].trim();
    title  = dash[2].trim();
  }

  // 최고화질 썸네일
  const thumbs = item.thumbnails;
  const thumb  =
    thumbs?.maxres?.url ??
    thumbs?.high?.url ??
    thumbs?.medium?.url ?? '';

  return { id: videoId, title, artist, channel: item.channelTitle ?? '', thumb };
}

// ─── 3. Claude → 수노 스타일 태그 추출 ───────────────────────

const TAG_PROMPT = (title: string, artist: string, channel: string) => `
당신은 음악 전문가입니다. 아래 음악 정보를 보고 Suno AI 음악 생성에 최적화된 스타일 태그와 무드 벡터를 추출해주세요.

음악 정보:
- 제목: ${title}
- 아티스트: ${artist}
- 채널: ${channel}

반드시 아래 JSON 형식으로만 응답하세요 (설명 없이):
{
  "genre":      ["K-pop"],
  "mood":       ["upbeat", "cheerful"],
  "tempo":      ["128 BPM", "danceable"],
  "instrument": ["synth", "electric guitar", "drums"],
  "vocal":      ["female vocals"],
  "era":        ["2020s"],
  "bpm_estimate": 128,
  "mood_vector": {
    "energy":       0.85,
    "valence":      0.90,
    "danceability": 0.80
  }
}

참고 - Suno 호환 태그 예시:
- 장르: K-pop, J-pop, pop, indie pop, R&B, hip-hop, jazz, lo-fi, acoustic, rock, ballad, EDM, house, synthwave, folk, classical
- 무드: upbeat, chill, melancholic, dreamy, romantic, dark, hopeful, energetic, cozy, emotional
- 템포: slow tempo, midtempo, upbeat, 80 BPM, 100 BPM, 120 BPM, 128 BPM
- 악기: piano, acoustic guitar, electric guitar, synth, bass, drums, violin, brass, ambient pads
- 보컬: female vocals, male vocals, soft vocal, powerful vocal, no vocals, harmonized
`.trim();

async function extractTagsWithClaude(
  title: string, artist: string, channel: string,
): Promise<{ tags: ExtractedTags; bpm: number; vector: MoodVector } | null> {
  if (!ANTHROPIC_KEY) return null;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',  // 빠르고 저렴한 Haiku 사용
        max_tokens: 400,
        messages: [{ role: 'user', content: TAG_PROMPT(title, artist, channel) }],
      }),
    });

    if (!res.ok) return null;

    const json    = await res.json();
    const rawText = json.content?.[0]?.text ?? '';
    const jsonStr = rawText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed  = JSON.parse(jsonStr);

    return {
      tags: {
        genre:      parsed.genre      ?? [],
        mood:       parsed.mood       ?? [],
        tempo:      parsed.tempo      ?? [],
        instrument: parsed.instrument ?? [],
        vocal:      parsed.vocal      ?? [],
        era:        parsed.era        ?? [],
      },
      bpm:    parsed.bpm_estimate ?? 0,
      vector: {
        energy:       parsed.mood_vector?.energy       ?? 0.5,
        valence:      parsed.mood_vector?.valence      ?? 0.5,
        danceability: parsed.mood_vector?.danceability ?? 0.5,
      },
    };
  } catch (e) {
    console.warn('[musicReference] Claude 분석 실패:', e);
    return null;
  }
}

// ─── 4. 메인: 레퍼런스 저장 + 분석 ──────────────────────────

export async function analyzeMusicReference(
  storeId:    string,
  youtubeUrl: string,
  onProgress?: (step: string) => void,
): Promise<MusicReference> {
  // 1. Video ID 파싱
  const videoId = parseYoutubeId(youtubeUrl.trim());
  if (!videoId) throw new Error('유튜브 URL 형식이 올바르지 않아요');

  // 2. DB에 pending 상태로 먼저 저장
  const { data: inserted, error: insertErr } = await supabase
    .from('music_references')
    .insert({
      store_id:    storeId,
      youtube_url: youtubeUrl.trim(),
      youtube_id:  videoId,
      status:      'analyzing',
    })
    .select()
    .single();

  if (insertErr) throw new Error(insertErr.message);
  const refId = inserted.id;

  try {
    // 3. YouTube 메타데이터 가져오기
    onProgress?.('📺 유튜브 정보 가져오는 중...');
    const meta = await fetchYoutubeMetadata(videoId);
    if (!meta) throw new Error('유튜브 영상을 찾을 수 없어요 (비공개 또는 삭제됨)');

    // 4. Claude 태그 분석
    onProgress?.('🎵 음악 스타일 분석 중...');
    const analysis = await extractTagsWithClaude(meta.title, meta.artist, meta.channel);

    // 5. DB 업데이트
    onProgress?.('💾 분석 결과 저장 중...');
    const { data: updated } = await supabase
      .from('music_references')
      .update({
        youtube_title:   meta.title,
        youtube_artist:  meta.artist,
        youtube_channel: meta.channel,
        youtube_thumb:   meta.thumb,
        extracted_tags:  analysis?.tags ?? null,
        bpm_estimate:    analysis?.bpm ?? null,
        mood_vector:     analysis?.vector ?? null,
        status:          'done',
      })
      .eq('id', refId)
      .select()
      .single();

    return updated as MusicReference;
  } catch (e: any) {
    // 오류 시 상태 업데이트
    await supabase
      .from('music_references')
      .update({ status: 'error', error_msg: e.message })
      .eq('id', refId);
    throw e;
  }
}

// ─── 5. 매장 레퍼런스 목록 조회 ──────────────────────────────

export async function fetchMusicReferences(storeId: string): Promise<MusicReference[]> {
  const { data } = await supabase
    .from('music_references')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });
  return (data ?? []) as MusicReference[];
}

// ─── 6. 레퍼런스 삭제 ────────────────────────────────────────

export async function deleteMusicReference(id: string): Promise<void> {
  await supabase.from('music_references').delete().eq('id', id);
}

// ─── 7. 태그 전체 flatten (수노 프롬프트용) ──────────────────

export function flattenTags(tags: ExtractedTags): string[] {
  return [
    ...tags.genre,
    ...tags.mood,
    ...tags.tempo,
    ...tags.instrument,
    ...tags.vocal,
    ...tags.era,
  ];
}
