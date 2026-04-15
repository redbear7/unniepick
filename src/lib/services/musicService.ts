import { supabase } from '../supabase';

// ─── 타입 ────────────────────────────────────────────────────────
export interface MusicTrack {
  id:             string;
  title:          string;
  artist:         string;
  mood:           string;      // 기존 단일 무드 (하위 호환)
  mood_tags:      string[];    // 다중 무드 태그 배열 (Phase 1+)
  time_tags:      string[];    // 시간대 태그 ['morning', 'evening', ...]
  bpm?:           number | null;
  energy_level?:  'low' | 'medium' | 'high' | null;
  store_category: string;
  audio_url:      string;
  duration_sec:   number;
  cover_emoji:    string;
  is_active:      boolean;
  created_at:     string;
}

export interface StoreAnnouncement {
  id:            string;
  store_id:      string;
  text:          string;
  audio_url:     string | null;
  voice_type:    string;
  play_mode:     'immediate' | 'between_tracks' | 'scheduled';
  repeat_count:  number;
  play_interval: number;
  scheduled_at:  string | null;
  is_active:     boolean;
  created_at:    string;
}

// ─── 음악 트랙 ──────────────────────────────────────────────────
export async function fetchMusicTracks(category?: string): Promise<MusicTrack[]> {
  let query = supabase
    .from('music_tracks')
    .select('*')
    .eq('is_active', true);

  if (category && category !== 'all') {
    query = query.or(`store_category.eq.${category},store_category.eq.all`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MusicTrack[];
}

// ─── 어드민: 음악 트랙 관리 ──────────────────────────────────────
export async function fetchAllMusicTracksAdmin(): Promise<MusicTrack[]> {
  const { data, error } = await supabase
    .from('music_tracks')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MusicTrack[];
}

export interface MusicTrackInput {
  title:          string;
  artist:         string;
  mood:           string;
  mood_tags?:     string[];
  time_tags?:     string[];
  bpm?:           number | null;
  energy_level?:  'low' | 'medium' | 'high' | null;
  store_category: string;
  audio_url:      string;
  duration_sec:   number;
  cover_emoji:    string;
  is_active:      boolean;
}

export async function createMusicTrack(params: MusicTrackInput): Promise<MusicTrack> {
  const { data, error } = await supabase
    .from('music_tracks')
    .insert([params])
    .select()
    .single();
  if (error) throw error;
  return data as MusicTrack;
}

export async function updateMusicTrack(id: string, params: Partial<MusicTrackInput>): Promise<void> {
  const { error } = await supabase.from('music_tracks').update(params).eq('id', id);
  if (error) throw error;
}

export async function toggleMusicTrackActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('music_tracks').update({ is_active: isActive }).eq('id', id);
  if (error) throw error;
}

export async function deleteMusicTrack(id: string): Promise<void> {
  const { error } = await supabase.from('music_tracks').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadMusicFile(
  base64: string,
  filename: string,
): Promise<string> {
  // base64 → Uint8Array
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const { error } = await supabase.storage
    .from('music-tracks')
    .upload(filename, bytes, { contentType: 'audio/mpeg', upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from('music-tracks').getPublicUrl(filename);
  return data.publicUrl;
}

// ─── 안내방송 ───────────────────────────────────────────────────
export async function fetchMyAnnouncements(storeId: string): Promise<StoreAnnouncement[]> {
  const { data, error } = await supabase
    .from('store_announcements')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as StoreAnnouncement[];
}

export async function saveAnnouncement(
  storeId: string,
  params: {
    text:          string;
    audio_url:     string;
    voice_type:    string;
    play_mode:     string;
    repeat_count:  number;
    play_interval: number;
  },
): Promise<StoreAnnouncement> {
  const { data, error } = await supabase
    .from('store_announcements')
    .insert({ store_id: storeId, ...params })
    .select()
    .single();
  if (error) throw error;
  return data as StoreAnnouncement;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase
    .from('store_announcements')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ─── 청취 기록 ──────────────────────────────────────────────────

/** 트랙 재생 시작을 기록 (중복 억제: 60초 이내 동일 트랙은 저장 안 함) */
export async function logListeningHistory(
  userId: string,
  trackId: string,
): Promise<void> {
  try {
    // 60초 이내 동일 트랙 중복 방지
    const since = new Date(Date.now() - 60_000).toISOString();
    const { data: recent } = await supabase
      .from('listening_history')
      .select('id')
      .eq('user_id', userId)
      .eq('track_id', trackId)
      .gte('played_at', since)
      .limit(1);
    if (recent && recent.length > 0) return;

    await supabase
      .from('listening_history')
      .insert({ user_id: userId, track_id: trackId });
  } catch { /* silent */ }
}

/** 최근 청취 기록 (최대 limit 건, 중복 트랙 제거) */
export async function fetchListeningHistory(
  userId: string,
  limit = 20,
): Promise<MusicTrack[]> {
  const { data, error } = await supabase
    .from('listening_history')
    .select('track_id, played_at, track:music_tracks(*)')
    .eq('user_id', userId)
    .order('played_at', { ascending: false })
    .limit(limit * 3); // 중복 제거 여유분
  if (error) throw error;

  // track_id 기준 중복 제거 후 최대 limit개
  const seen = new Set<string>();
  const result: MusicTrack[] = [];
  for (const row of data ?? []) {
    const t = Array.isArray(row.track) ? row.track[0] : row.track;
    if (t && !seen.has(t.id)) {
      seen.add(t.id);
      result.push(t as MusicTrack);
      if (result.length >= limit) break;
    }
  }
  return result;
}

// ─── 플레이리스트 타입 ─────────────────────────────────────────
export interface Playlist {
  id:            string;
  name:          string;
  description?:  string;
  mood_tags:     string[];
  cover_emoji?:  string;
  track_count?:  number;
  curator_note?: string;
  is_curated?:   boolean;
  is_dynamic?:   boolean;   // AI-generated from track pool
}

// ─── 시샵 큐레이션 플레이리스트 조회 ──────────────────────────
// Requires DB columns: is_curated BOOLEAN, mood_tags TEXT[], curated_at TIMESTAMPTZ
// Falls back silently if columns don't exist yet
export async function fetchCuratedPlaylists(): Promise<Playlist[]> {
  try {
    const { data, error } = await supabase
      .from('playlists')
      .select('id, name, description, mood_tags, cover_emoji, curator_note')
      .eq('is_curated', true)
      .order('created_at', { ascending: false })
      .limit(8);
    if (error) return [];
    return (data ?? []) as Playlist[];
  } catch {
    return [];
  }
}

// ─── 무드 태그로 동적 플레이리스트 생성 ───────────────────────
export async function fetchTracksByMood(
  moods: string[],
  limit = 20,
): Promise<MusicTrack[]> {
  if (moods.length === 0) return fetchMusicTracks();
  const { data } = await supabase
    .from('music_tracks')
    .select('*')
    .eq('is_active', true)
    .in('mood', moods)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as MusicTrack[];
}
