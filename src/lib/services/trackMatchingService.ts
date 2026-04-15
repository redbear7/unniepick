// ================================================================
// Phase 3: pgvector 유사 곡 매칭 서비스
// mood_vector {energy, valence, danceability} → vector(3) 코사인 유사도 검색
// ================================================================

import { supabase } from '../supabase';
import type { MoodVector, ExtractedTags } from './musicReferenceService';
import { flattenTags } from './musicReferenceService';

// ─── 타입 정의 ────────────────────────────────────────────────

export interface GeneratedTrack {
  id:             string;
  store_id:       string;
  reference_id:   string | null;
  suno_id:        string | null;
  title:          string | null;
  style_prompt:   string | null;
  style_tags:     string[];
  bpm_estimate:   number | null;
  audio_url:      string | null;
  image_url:      string | null;
  duration:       number | null;
  mood_embedding: [number, number, number] | null;
  suno_status:    'generating' | 'done' | 'error';
  error_msg:      string | null;
  confirm_status: 'pending' | 'liked' | 'disliked';
  confirm_count:  number;
  created_at:     string;
  updated_at:     string;
}

export interface SimilarTrackResult {
  id:             string;
  store_id:       string;
  title:          string | null;
  style_tags:     string[];
  mood_embedding: [number, number, number] | null;
  bpm_estimate:   number | null;
  audio_url:      string | null;
  image_url:      string | null;
  duration:       number | null;
  similarity:     number;
}

// ─── 1. mood_vector 객체 → pgvector 배열 변환 ─────────────────

export function moodVectorToArray(mv: MoodVector): [number, number, number] {
  return [mv.energy, mv.valence, mv.danceability];
}

// ─── 2. 코사인 유사도 검색 ────────────────────────────────────

/**
 * DB에서 mood_embedding 기준 유사한 곡을 찾아 반환
 * @param moodVector   기준 mood_vector
 * @param excludeStoreId  본인 매장 제외 여부 (null = 포함)
 * @param threshold    코사인 유사도 최소값 (0~1, 기본 0.80)
 * @param limit        최대 반환 개수 (기본 5)
 */
export async function findSimilarTracks(
  moodVector:     MoodVector,
  excludeStoreId?: string,
  threshold = 0.80,
  limit     = 5,
): Promise<SimilarTrackResult[]> {
  const vec = moodVectorToArray(moodVector);

  const { data, error } = await supabase.rpc('find_similar_tracks', {
    query_vector:    vec,
    exclude_store:   excludeStoreId ?? null,
    match_threshold: threshold,
    match_count:     limit,
  });

  if (error) {
    console.warn('[trackMatching] 유사 곡 검색 실패:', error.message);
    return [];
  }
  return (data ?? []) as SimilarTrackResult[];
}

/**
 * 가장 유사한 곡 1개만 반환. 없으면 null.
 */
export async function findBestMatch(
  moodVector:      MoodVector,
  excludeStoreId?: string,
  threshold = 0.78,
): Promise<SimilarTrackResult | null> {
  const results = await findSimilarTracks(moodVector, excludeStoreId, threshold, 1);
  return results[0] ?? null;
}

// ─── 3. Generated Track CRUD ──────────────────────────────────

export async function saveGeneratedTrack(params: {
  storeId:      string;
  referenceId?: string;
  sunoId?:      string;
  title?:       string;
  stylePrompt?: string;
  styleTags:    string[];
  moodVector:   MoodVector;
  bpmEstimate?: number;
  audioUrl?:    string;
  imageUrl?:    string;
  duration?:    number;
  sunoStatus?:  'generating' | 'done' | 'error';
}): Promise<GeneratedTrack> {
  const { data, error } = await supabase
    .from('generated_tracks')
    .insert({
      store_id:       params.storeId,
      reference_id:   params.referenceId   ?? null,
      suno_id:        params.sunoId        ?? null,
      title:          params.title         ?? null,
      style_prompt:   params.stylePrompt   ?? null,
      style_tags:     params.styleTags,
      mood_embedding: moodVectorToArray(params.moodVector),
      bpm_estimate:   params.bpmEstimate   ?? null,
      audio_url:      params.audioUrl      ?? null,
      image_url:      params.imageUrl      ?? null,
      duration:       params.duration      ?? null,
      suno_status:    params.sunoStatus    ?? 'generating',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as GeneratedTrack;
}

export async function updateTrackSunoResult(
  trackId: string,
  params: {
    sunoId?:   string;
    title?:    string;
    audioUrl?: string;
    imageUrl?: string;
    duration?: number;
    status:    'done' | 'error';
    errorMsg?: string;
  },
): Promise<void> {
  await supabase
    .from('generated_tracks')
    .update({
      suno_id:     params.sunoId   ?? null,
      title:       params.title    ?? null,
      audio_url:   params.audioUrl ?? null,
      image_url:   params.imageUrl ?? null,
      duration:    params.duration ?? null,
      suno_status: params.status,
      error_msg:   params.errorMsg ?? null,
    })
    .eq('id', trackId);
}

// ─── 4. 사장님 컨펌 (좋아요 / 싫어요) ────────────────────────

/**
 * 컨펌 처리 후 업데이트된 confirm_count 반환
 * 싫어요 시 confirm_count < 3 이면 재시도 가능
 */
export async function confirmTrack(
  trackId: string,
  liked:   boolean,
): Promise<{ confirmCount: number; canRetry: boolean }> {
  const { data: current } = await supabase
    .from('generated_tracks')
    .select('confirm_count')
    .eq('id', trackId)
    .single();

  const newCount = (current?.confirm_count ?? 0) + 1;

  await supabase
    .from('generated_tracks')
    .update({
      confirm_status: liked ? 'liked' : 'disliked',
      confirm_count:  newCount,
    })
    .eq('id', trackId);

  return {
    confirmCount: newCount,
    canRetry:     !liked && newCount < 3,
  };
}

// ─── 5. 조회 ─────────────────────────────────────────────────

export async function fetchGeneratedTracks(storeId: string): Promise<GeneratedTrack[]> {
  const { data } = await supabase
    .from('generated_tracks')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });
  return (data ?? []) as GeneratedTrack[];
}

export async function fetchLikedTracks(storeId: string): Promise<GeneratedTrack[]> {
  const { data } = await supabase
    .from('generated_tracks')
    .select('*')
    .eq('store_id', storeId)
    .eq('confirm_status', 'liked')
    .eq('suno_status', 'done')
    .order('created_at', { ascending: false });
  return (data ?? []) as GeneratedTrack[];
}

// ─── 6. Suno 프롬프트 빌더 ───────────────────────────────────

/**
 * ExtractedTags + BPM → Suno custom_generate style 프롬프트 문자열
 * 최대 12개 태그 사용 (Suno 권장)
 */
export function buildSunoPrompt(tags: ExtractedTags, bpm?: number): string {
  const flat = flattenTags(tags).slice(0, 12);
  return bpm ? `${flat.join(', ')}, ${bpm} BPM` : flat.join(', ');
}

/**
 * 유사 곡의 style_tags 배열로 Suno 프롬프트 생성
 */
export function buildSunoPromptFromTags(styleTags: string[], bpm?: number): string {
  const tags = styleTags.slice(0, 12);
  return bpm ? `${tags.join(', ')}, ${bpm} BPM` : tags.join(', ');
}

// ─── 7. 매장 DNA 요약 (Phase 5 플레이리스트 생성용) ─────────

/**
 * 매장에서 좋아요한 곡들의 태그를 집계하여 빈도 순 DNA 배열 반환
 */
export async function buildStoreDNA(storeId: string): Promise<string[]> {
  const liked = await fetchLikedTracks(storeId);
  if (liked.length === 0) return [];

  const freq: Record<string, number> = {};
  for (const track of liked) {
    for (const tag of track.style_tags) {
      freq[tag] = (freq[tag] ?? 0) + 1;
    }
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
    .slice(0, 20);
}

/**
 * 매장 좋아요 곡들의 평균 mood_vector 계산
 */
export async function calcStoreMoodAverage(storeId: string): Promise<MoodVector | null> {
  const liked = await fetchLikedTracks(storeId);
  const withVec = liked.filter(t => t.mood_embedding);
  if (withVec.length === 0) return null;

  const sum = withVec.reduce(
    (acc, t) => ({
      energy:       acc.energy       + t.mood_embedding![0],
      valence:      acc.valence      + t.mood_embedding![1],
      danceability: acc.danceability + t.mood_embedding![2],
    }),
    { energy: 0, valence: 0, danceability: 0 },
  );

  const n = withVec.length;
  return {
    energy:       Math.round((sum.energy       / n) * 100) / 100,
    valence:      Math.round((sum.valence      / n) * 100) / 100,
    danceability: Math.round((sum.danceability / n) * 100) / 100,
  };
}
