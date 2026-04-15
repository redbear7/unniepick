// ================================================================
// Phase 6: 학습 & 전파 엔진
// - 매장 음악 프로필 자동 집계 (트리거로도 동작)
// - 유사 업종 매장 DNA 탐색
// - 좋아요 트랙 추천 전파
// ================================================================

import { supabase } from '../supabase';
import type { MoodVector } from './musicReferenceService';
import { saveGeneratedTrack } from './trackMatchingService';

// ─── 타입 ────────────────────────────────────────────────────

export interface StoreMusicProfile {
  store_id:       string;
  avg_embedding:  [number, number, number] | null;
  top_tags:       string[];
  liked_count:    number;
  store_category: string | null;
  propagated_to:  number;
  updated_at:     string;
}

export interface SimilarStoreResult {
  store_id:      string;
  store_name:    string;
  category:      string | null;
  similarity:    number;
  liked_count:   number;
  top_tags:      string[];
  avg_embedding: [number, number, number] | null;
}

export interface PropagatedTrack {
  id:           string;
  from_store:   string;
  title:        string | null;
  style_tags:   string[];
  audio_url:    string | null;
  image_url:    string | null;
  similarity:   number;  // 출처 매장과의 유사도
}

// ─── 1. 매장 프로필 강제 재계산 (RPC 호출) ───────────────────

export async function updateStoreProfile(storeId: string): Promise<void> {
  const { error } = await supabase.rpc('update_store_music_profile', {
    p_store_id: storeId,
  });
  if (error) console.warn('[propagation] 프로필 업데이트 실패:', error.message);
}

export async function fetchStoreProfile(storeId: string): Promise<StoreMusicProfile | null> {
  const { data } = await supabase
    .from('store_music_profiles')
    .select('*')
    .eq('store_id', storeId)
    .single();
  return data as StoreMusicProfile | null;
}

// ─── 2. 유사 매장 검색 ───────────────────────────────────────

export async function findSimilarStores(
  storeId:   string,
  category?: string,
  threshold  = 0.75,
  limit      = 5,
): Promise<SimilarStoreResult[]> {
  const { data, error } = await supabase.rpc('find_similar_stores', {
    p_store_id:  storeId,
    p_category:  category ?? null,
    p_threshold: threshold,
    p_limit:     limit,
  });
  if (error) {
    console.warn('[propagation] 유사 매장 검색 실패:', error.message);
    return [];
  }
  return (data ?? []) as SimilarStoreResult[];
}

// ─── 3. 유사 매장의 좋아요 트랙 추천 ────────────────────────

/**
 * 유사 매장들의 좋아요 트랙 중 현재 매장에 없는 것을 추천
 * Phase 4 컨펌 루프에서 DB 미스 시 fallback으로 사용
 */
export async function getPropagationRecommendations(
  storeId:   string,
  category?: string,
  limit      = 10,
): Promise<PropagatedTrack[]> {
  // (a) 유사 매장 탐색
  const similarStores = await findSimilarStores(storeId, category, 0.72, 5);
  if (similarStores.length === 0) return [];

  const fromStoreIds = similarStores.map(s => s.store_id);

  // (b) 유사 매장의 좋아요 트랙 가져오기
  const { data: tracks } = await supabase
    .from('generated_tracks')
    .select('id, store_id, title, style_tags, audio_url, image_url, mood_embedding')
    .in('store_id', fromStoreIds)
    .eq('confirm_status', 'liked')
    .eq('suno_status', 'done')
    .not('audio_url', 'is', null)
    .limit(limit * 3);

  if (!tracks || tracks.length === 0) return [];

  // (c) 현재 매장이 이미 가진 스타일 태그 set
  const { data: myTracks } = await supabase
    .from('generated_tracks')
    .select('style_tags')
    .eq('store_id', storeId)
    .eq('confirm_status', 'liked');

  const myTagSet = new Set<string>(
    (myTracks ?? []).flatMap((t: any) => t.style_tags as string[]),
  );

  // (d) 겹치지 않는 추천 우선 정렬 + 유사도 붙이기
  const withSimilarity = (tracks as any[]).map(t => {
    const fromStore = similarStores.find(s => s.store_id === t.store_id);
    const overlap   = ((t.style_tags as string[]) ?? []).filter(tag => myTagSet.has(tag)).length;
    return {
      id:         t.id,
      from_store: t.store_id,
      title:      t.title,
      style_tags: t.style_tags ?? [],
      audio_url:  t.audio_url,
      image_url:  t.image_url,
      similarity: fromStore?.similarity ?? 0,
      overlap,
    };
  });

  // 유사도 높고 겹침 적은 순 정렬
  withSimilarity.sort((a, b) => b.similarity - a.similarity || a.overlap - b.overlap);

  return withSimilarity.slice(0, limit).map(({ overlap: _, ...rest }) => rest);
}

// ─── 4. 전파: 추천 트랙을 대상 매장 generated_tracks 에 복사 ─

/**
 * 유사 매장 추천 트랙을 현재 매장의 generated_tracks 에 저장
 * (confirm_status='pending' → 오너가 컨펌 루프 통해 확정)
 */
export async function propagateTracksToStore(
  toStoreId:    string,
  tracks:       PropagatedTrack[],
  referenceId?: string,
): Promise<void> {
  // 이미 전파된 트랙 중복 방지 (suno_id 기준)
  const { data: existing } = await supabase
    .from('generated_tracks')
    .select('suno_id')
    .eq('store_id', toStoreId);

  const existingIds = new Set((existing ?? []).map((t: any) => t.suno_id));

  const toInsert = tracks.filter(t => !existingIds.has(t.id));
  if (toInsert.length === 0) return;

  await Promise.allSettled(
    toInsert.map(t =>
      saveGeneratedTrack({
        storeId:     toStoreId,
        referenceId: referenceId,
        sunoId:      t.id,  // 원본 generated_track id 참조
        title:       t.title ?? undefined,
        styleTags:   t.style_tags,
        moodVector:  { energy: 0.5, valence: 0.5, danceability: 0.5 }, // placeholder
        audioUrl:    t.audio_url ?? undefined,
        imageUrl:    t.image_url ?? undefined,
        sunoStatus:  'done',
      }),
    ),
  );

  // 전파 이력 기록
  const fromStoreIds = [...new Set(toInsert.map(t => t.from_store))];
  await Promise.allSettled(
    fromStoreIds.map(fromId =>
      supabase
        .from('propagation_history')
        .upsert({
          from_store_id: fromId,
          to_store_id:   toStoreId,
          track_ids:     toInsert.filter(t => t.from_store === fromId).map(t => t.id),
          similarity:    toInsert.find(t => t.from_store === fromId)?.similarity ?? 0,
        })
        .onConflict('from_store_id, to_store_id'),
    ),
  );
}

// ─── 5. 관리자: 전체 프로필 재계산 ──────────────────────────

export async function rebuildAllProfiles(): Promise<number> {
  const { data, error } = await supabase.rpc('rebuild_all_store_profiles');
  if (error) throw new Error(error.message);
  return data as number;
}

// ─── 6. 관리자: 전파 현황 조회 ───────────────────────────────

export interface PropagationStat {
  store_id:       string;
  store_name:     string;
  liked_count:    number;
  top_tags:       string[];
  avg_energy:     number;
  avg_valence:    number;
  propagated_to:  number;
  store_category: string | null;
  updated_at:     string;
}

export async function fetchPropagationStats(): Promise<PropagationStat[]> {
  const { data } = await supabase
    .from('store_music_profiles')
    .select(`
      store_id, liked_count, top_tags, avg_embedding,
      propagated_to, store_category, updated_at,
      stores ( name )
    `)
    .order('liked_count', { ascending: false })
    .limit(100);

  return ((data ?? []) as any[]).map(row => ({
    store_id:       row.store_id,
    store_name:     row.stores?.name ?? '알 수 없음',
    liked_count:    row.liked_count,
    top_tags:       row.top_tags ?? [],
    avg_energy:     row.avg_embedding?.[0] ?? 0,
    avg_valence:    row.avg_embedding?.[1] ?? 0,
    propagated_to:  row.propagated_to ?? 0,
    store_category: row.store_category,
    updated_at:     row.updated_at,
  }));
}

export async function fetchPropagationHistory() {
  const { data } = await supabase
    .from('propagation_history')
    .select(`
      id, similarity, propagated_at, track_ids,
      from_store:stores!propagation_history_from_store_id_fkey ( name ),
      to_store:stores!propagation_history_to_store_id_fkey ( name )
    `)
    .order('propagated_at', { ascending: false })
    .limit(50);
  return (data ?? []) as any[];
}
