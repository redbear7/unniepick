// ================================================================
// AI 즉석 큐레이션 엔진 — Phase 1
// 날씨 + 시간대 + 업종 + 가게 DNA → 무드 벡터 → 트랙 선별
// ================================================================

import { supabase } from '../supabase';
import { MusicTrack, fetchMusicTracks } from './musicService';
import { fetchWeatherContext, WeatherContext, getTimeOfDay, TimeOfDay } from './weatherService';

// ── 업종별 기본 무드 ─────────────────────────────────────────
const CATEGORY_MOOD_MAP: Record<string, string[]> = {
  cafe:     ['lo-fi', 'acoustic', 'jazz', 'cozy', 'chill'],
  food:     ['upbeat', 'pop', 'bright', 'warm'],
  beauty:   ['trendy', 'k-pop', 'pop', 'bright'],
  health:   ['energetic', 'EDM', 'hip-hop', 'motivational'],
  mart:     ['neutral', 'ambient', 'easy-listening'],
  bar:      ['jazz', 'blues', 'indie', 'night', 'lounge'],
  etc:      ['pop', 'acoustic', 'chill'],
  all:      ['pop', 'acoustic', 'chill'],
};

// 업종별 기피 태그
const CATEGORY_AVOID_MAP: Record<string, string[]> = {
  cafe:     ['EDM', 'heavy-metal', 'aggressive'],
  food:     ['sad', 'slow-ballad', 'dark'],
  beauty:   ['metal', 'aggressive', 'dark'],
  health:   ['slow', 'sad', 'ambient'],
  mart:     ['loud', 'aggressive', 'heavy'],
  bar:      ['children-music', 'bright-pop'],
  etc:      [],
  all:      [],
};

export interface CurationContext {
  storeId?:      string;
  storeName?:    string;
  storeCategory: string;
  lat?:          number;
  lng?:          number;
  weather?:      WeatherContext;
  musicDna?:     StoreMusicDna | null;
  userId?:       string | null;   // 개인화 큐레이션용
}

export interface StoreMusicDna {
  suggested_moods: string[];
  avoid_moods:     string[];
  analyzed_at?:    string;
}

export interface DynamicPlaylist {
  name:       string;       // AI 생성 이름 (혹은 fallback)
  moodTags:   string[];     // 최종 사용 무드 태그
  tracks:     MusicTrack[];
  context:    string;       // "비 오는 저녁" 등 설명
  isDynamic:  true;
}

// ── 가중치 설정 ──────────────────────────────────────────────
const WEIGHTS = {
  weather:   1.5,   // 실시간 날씨 (가장 중요)
  timeOfDay: 1.5,   // 시간대
  musicDna:  1.2,   // AI 사진 분석 결과
  category:  1.0,   // 업종 기본 무드
};

// ── 무드 벡터 생성 ───────────────────────────────────────────
function buildMoodVector(
  weatherTags:  string[],
  categoryTags: string[],
  dnaTags:      string[],
  avoidTags:    string[],
): string[] {
  const score: Record<string, number> = {};

  const add = (tags: string[], weight: number) => {
    for (const tag of tags) {
      score[tag] = (score[tag] ?? 0) + weight;
    }
  };

  add(weatherTags,  WEIGHTS.weather);
  add(categoryTags, WEIGHTS.category);
  add(dnaTags,      WEIGHTS.musicDna);

  // 기피 태그 제거
  for (const tag of avoidTags) {
    delete score[tag];
  }

  // 점수 높은 순 → 상위 6개
  return Object.entries(score)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([tag]) => tag);
}

// ── 아티스트 중복 제거 (같은 아티스트 최대 2곡) ──────────────
function deduplicateArtists(tracks: MusicTrack[], maxPerArtist = 2): MusicTrack[] {
  const count: Record<string, number> = {};
  return tracks.filter(t => {
    count[t.artist] = (count[t.artist] ?? 0) + 1;
    return count[t.artist] <= maxPerArtist;
  });
}

// ── 무드 태그로 트랙 검색 (mood_tags 배열 컬럼 사용) ─────────
async function fetchTracksByMoodTags(
  moods: string[],
  limit: number,
): Promise<MusicTrack[]> {
  if (moods.length === 0) {
    return fetchMusicTracks();
  }

  try {
    // mood_tags 배열에 겹치는 항목이 있는 트랙 검색 (GIN 인덱스 활용)
    const { data } = await supabase
      .from('music_tracks')
      .select('*')
      .eq('is_active', true)
      .overlaps('mood_tags', moods)  // mood_tags && moods (배열 겹침 연산자)
      .limit(limit);

    if (data && data.length >= 5) {
      return data as MusicTrack[];
    }
  } catch {}

  // fallback: 기존 mood 단일 컬럼으로 검색
  try {
    const { data } = await supabase
      .from('music_tracks')
      .select('*')
      .eq('is_active', true)
      .in('mood', moods)
      .limit(limit);
    if (data && data.length > 0) return data as MusicTrack[];
  } catch {}

  // 최종 fallback: 전체 트랙
  return fetchMusicTracks();
}

// ── Claude API 플레이리스트 이름 생성 ───────────────────────
const ANTHROPIC_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

async function generatePlaylistNameAI(
  context: string,
  moodTags: string[],
  storeName?: string,
): Promise<string> {
  if (!ANTHROPIC_KEY) return generatePlaylistNameFallback(context, storeName, moodTags);
  try {
    const prompt = storeName
      ? `가게 "${storeName}"의 배경음악 플레이리스트 이름을 지어줘. 지금은 "${context}"이고 무드 태그는 [${moodTags.slice(0,4).join(', ')}]야. 감성적이고 짧게 (15자 이내), 한국어로, 이름만 출력해.`
      : `지금 "${context}"에 어울리는 음악 플레이리스트 이름을 지어줘. 무드 태그: [${moodTags.slice(0,4).join(', ')}]. 감성적이고 짧게 (15자 이내), 한국어로, 이름만 출력해.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 40,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return generatePlaylistNameFallback(context, storeName, moodTags);
    const json = await res.json();
    const name = (json.content?.[0]?.text ?? '').trim().replace(/["']/g, '');
    return name || generatePlaylistNameFallback(context, storeName, moodTags);
  } catch {
    return generatePlaylistNameFallback(context, storeName, moodTags);
  }
}

function generatePlaylistNameFallback(
  context: string,
  storeName?: string,
  moodTags?: string[],
): string {
  const templates = [
    storeName ? `${context}의 ${storeName}` : `${context} 플레이리스트`,
    `오늘 같은 ${context}엔`,
    `${context}에 어울리는 음악`,
    moodTags?.[0] ? `${moodTags[0]} 바이브` : `${context} 무드`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

// 외부에서 직접 호출 가능 (테스트·재사용)
function generatePlaylistName(context: string, storeName?: string, moodTags?: string[]): string {
  return generatePlaylistNameFallback(context, storeName, moodTags);
}

// ── 메인: 동적 플레이리스트 빌드 ────────────────────────────
export async function buildDynamicPlaylist(
  ctx: CurationContext,
  trackCount = 20,
): Promise<DynamicPlaylist> {
  // 1. 날씨 컨텍스트 수집
  const weather = ctx.weather ?? (
    ctx.lat != null && ctx.lng != null
      ? await fetchWeatherContext(ctx.lat, ctx.lng).catch(() => null)
      : null
  );

  const weatherTags  = weather?.moodTags ?? [];
  const timeLabel    = weather?.description ?? '';

  // 2. 업종 기본 무드
  const category     = ctx.storeCategory || 'all';
  const categoryTags = CATEGORY_MOOD_MAP[category]  ?? CATEGORY_MOOD_MAP.all;
  const avoidTags    = CATEGORY_AVOID_MAP[category] ?? [];

  // 3. 가게 음악 DNA (사진 분석 결과 — Phase 4에서 채워짐)
  const dnaTags   = ctx.musicDna?.suggested_moods ?? [];
  const dnaAvoid  = ctx.musicDna?.avoid_moods ?? [];

  // 4. 사용자 취향 (user_music_profiles + 좋아요 이력)
  let userPreferred: string[] = [];
  let userAvoided:   string[] = [];
  if (ctx.userId) {
    try {
      const { data: profile } = await supabase
        .from('user_music_profiles')
        .select('preferred_moods, avoided_moods')
        .eq('user_id', ctx.userId)
        .maybeSingle();
      if (profile) {
        userPreferred = profile.preferred_moods ?? [];
        userAvoided   = profile.avoided_moods ?? [];
      }
      // 좋아요 이력 기반 무드 (낮은 가중치)
      const likeMoods = await getMoodTagsFromLikeHistory(ctx.userId);
      userPreferred   = Array.from(new Set([...userPreferred, ...likeMoods]));
    } catch {}
  }

  // 5. 무드 벡터 합산 (사용자 취향 가중치 추가)
  const moodTags = buildMoodVector(
    weatherTags,
    categoryTags,
    [...dnaTags, ...userPreferred],
    [...avoidTags, ...dnaAvoid, ...userAvoided],
  );

  // 5. 트랙 검색 (여유 있게 2배 fetch → 아티스트 중복 제거 후 자름)
  const rawTracks  = await fetchTracksByMoodTags(moodTags, trackCount * 2);
  const tracks     = deduplicateArtists(rawTracks).slice(0, trackCount);

  // 6. 플레이리스트 이름 (Claude API → fallback)
  const name = await generatePlaylistNameAI(timeLabel || '지금 이 순간', moodTags, ctx.storeName);

  return {
    name,
    moodTags,
    tracks,
    context:   timeLabel || '지금 이 순간',
    isDynamic: true,
  };
}

// ── 위치 기반 컨텍스트 (뮤직탭 — 가게 무관) ─────────────────
export async function buildCurationContextFromLocation(
  lat?: number,
  lng?: number,
  weather?: WeatherContext,
): Promise<CurationContext> {
  return {
    storeCategory: 'all',
    lat,
    lng,
    weather: weather ?? undefined,
  };
}

// ── 가게 컨텍스트 자동 수집 (storeId 기반) ──────────────────
export async function buildCurationContextForStore(
  storeId: string,
): Promise<CurationContext> {
  try {
    const { data } = await supabase
      .from('stores')
      .select('id, name, store_category, latitude, longitude, music_dna')
      .eq('id', storeId)
      .single();

    if (!data) return { storeCategory: 'all' };

    return {
      storeId:       data.id,
      storeName:     data.name,
      storeCategory: data.store_category ?? 'all',
      lat:           data.latitude,
      lng:           data.longitude,
      musicDna:      data.music_dna as StoreMusicDna | null,
    };
  } catch {
    return { storeCategory: 'all' };
  }
}

// ── 사용자 음악 취향 저장 ────────────────────────────────────
export async function saveUserMusicProfile(
  userId: string,
  params: {
    preferred_moods?: string[];
    avoided_moods?:   string[];
    bpm_min?:         number;
    bpm_max?:         number;
  },
): Promise<void> {
  await supabase
    .from('user_music_profiles')
    .upsert({ user_id: userId, ...params, updated_at: new Date().toISOString() });
}

// ── 음악 좋아요 토글 ─────────────────────────────────────────
export interface MusicLikeContext {
  storeId?:     string;
  playDuration?: number; // 재생 후 몇 초에 좋아요 눌렀는지
  lat?:          number;
  lng?:          number;
}

export async function toggleMusicLike(
  trackId: string,
  ctx?: MusicLikeContext,
): Promise<{ is_liked: boolean }> {
  // 날씨 / 시간 컨텍스트
  let weather: string | null = null;
  if (ctx?.lat != null && ctx?.lng != null) {
    const w = await fetchWeatherContext(ctx.lat, ctx.lng).catch(() => null);
    weather = w?.condition ?? null;
  }
  const timeOfDay = getTimeOfDay();

  const { data, error } = await supabase.rpc('toggle_music_like', {
    p_track_id:     trackId,
    p_store_id:     ctx?.storeId ?? null,
    p_time_of_day:  timeOfDay,
    p_weather:      weather,
    p_play_duration: ctx?.playDuration ?? null,
  });

  if (error) throw error;
  return data[0] as { is_liked: boolean };
}

// ── 사용자 좋아요한 트랙 목록 ────────────────────────────────
export async function fetchLikedTracks(userId: string): Promise<MusicTrack[]> {
  const { data, error } = await supabase
    .from('music_likes')
    .select('track_id, music_tracks(*)')
    .eq('user_id', userId)
    .order('liked_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return ((data ?? []) as any[]).map(r => r.music_tracks).filter(Boolean) as MusicTrack[];
}

// ── 좋아요 이력 기반 추천 무드 태그 ──────────────────────────
export async function getMoodTagsFromLikeHistory(
  userId: string,
): Promise<string[]> {
  // 최근 30일 좋아요한 트랙의 mood_tags 수집
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();

  const { data } = await supabase
    .from('music_likes')
    .select('track_id, time_of_day, weather, music_tracks(mood_tags, mood)')
    .eq('user_id', userId)
    .gte('liked_at', since)
    .limit(50);

  if (!data) return [];

  const currentTime    = getTimeOfDay();
  const score: Record<string, number> = {};

  for (const row of data as any[]) {
    const tags: string[] = row.music_tracks?.mood_tags ?? (row.music_tracks?.mood ? [row.music_tracks.mood] : []);
    // 현재 시간대와 같은 컨텍스트에서 좋아요한 곡에 가중치
    const w = row.time_of_day === currentTime ? 1.5 : 1.0;
    for (const tag of tags) {
      score[tag] = (score[tag] ?? 0) + w;
    }
  }

  return Object.entries(score)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([tag]) => tag);
}
