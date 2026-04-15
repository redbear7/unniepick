/**
 * channelFollowService — 채널 팔로우 + 알림 설정
 *
 * 가게를 팔로우할 때 자동으로 chat_channel을 upsert하고
 * channel_follows에 구독 레코드를 생성한다.
 *
 * 팔로우 = store_favorites (기존) + channel_follows (신규) 동시 처리
 */

import { supabase } from '../supabase';

// ── 타입 ────────────────────────────────────────────────────────
export interface ChannelFollow {
  id:         string;
  channel_id: string;
  user_id:    string;
  notify:     boolean;
  created_at: string;
}

// ── 가게의 채팅 채널 가져오기 (없으면 생성) ──────────────────────
export async function getOrCreateChannel(storeId: string): Promise<string> {
  // 이미 채널이 있는지 확인
  const { data: existing } = await supabase
    .from('chat_channels')
    .select('id')
    .eq('store_id', storeId)
    .maybeSingle();

  if (existing) return existing.id;

  // 없으면 생성
  const { data: created, error } = await supabase
    .from('chat_channels')
    .insert({ store_id: storeId })
    .select('id')
    .single();

  if (error) throw error;
  return created.id;
}

// ── 채널 팔로우 여부 확인 ────────────────────────────────────────
export async function isChannelFollowing(
  userId: string,
  storeId: string
): Promise<boolean> {
  const channelId = await getOrCreateChannel(storeId).catch(() => null);
  if (!channelId) return false;

  const { data } = await supabase
    .from('channel_follows')
    .select('id')
    .eq('channel_id', channelId)
    .eq('user_id', userId)
    .maybeSingle();

  return !!data;
}

// ── 채널 팔로우 토글 (true = 팔로우됨, false = 취소됨) ───────────
export async function toggleChannelFollow(
  userId: string,
  storeId: string
): Promise<boolean> {
  const channelId = await getOrCreateChannel(storeId);
  const following = await isChannelFollowing(userId, storeId);

  if (following) {
    await supabase
      .from('channel_follows')
      .delete()
      .eq('channel_id', channelId)
      .eq('user_id', userId);
    return false;
  } else {
    const { error } = await supabase
      .from('channel_follows')
      .insert({ channel_id: channelId, user_id: userId, notify: true });

    if (error && error.code !== '23505') throw error; // 중복은 무시
    return true;
  }
}

// ── 알림 설정 변경 ───────────────────────────────────────────────
export async function setChannelNotify(
  userId: string,
  storeId: string,
  notify: boolean
): Promise<void> {
  const channelId = await getOrCreateChannel(storeId);

  const { error } = await supabase
    .from('channel_follows')
    .update({ notify })
    .eq('channel_id', channelId)
    .eq('user_id', userId);

  if (error) throw error;
}

// ── 내가 팔로우한 채널 목록 ──────────────────────────────────────
export async function fetchMyChannelFollows(userId: string): Promise<ChannelFollow[]> {
  const { data, error } = await supabase
    .from('channel_follows')
    .select('id, channel_id, user_id, notify, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ChannelFollow[];
}

// ── 채널 팔로워 수 ───────────────────────────────────────────────
export async function getChannelFollowerCount(storeId: string): Promise<number> {
  const channelId = await getOrCreateChannel(storeId).catch(() => null);
  if (!channelId) return 0;

  const { count } = await supabase
    .from('channel_follows')
    .select('id', { count: 'exact', head: true })
    .eq('channel_id', channelId);

  return count ?? 0;
}
