/**
 * chatService — Supabase Realtime 채팅 채널
 *
 * - subscribeChannel: Realtime Broadcast로 새 메시지 구독
 * - sendMessage: 메시지 DB 저장 + Broadcast 트리거
 * - getPresenceCount: Presence로 현재 접속자 수 추적
 * - getChatHistory: 이전 메시지 페이지네이션
 * - unsubscribeChannel: 채널 구독 해제
 */

import { supabase } from '../supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getOrCreateChannel } from './channelFollowService';

// ── 타입 ────────────────────────────────────────────────────────
export type MessageRole = 'owner' | 'system';
export type MessageType = 'text' | 'coupon' | 'notice';

export interface ChatMessage {
  id:         string;
  channel_id: string;
  sender_id:  string;
  role:       MessageRole;
  type:       MessageType;
  content:    string;
  coupon_id:  string | null;
  created_at: string;
}

export interface SendMessageParams {
  storeId:   string;
  senderId:  string;
  role:      MessageRole;
  type?:     MessageType;
  content:   string;
  couponId?: string;
}

// ── 채팅 히스토리 ────────────────────────────────────────────────
export async function getChatHistory(
  storeId: string,
  limit = 30,
  before?: string          // ISO timestamp — 이 시점 이전 메시지
): Promise<ChatMessage[]> {
  const channelId = await getOrCreateChannel(storeId);

  let query = supabase
    .from('chat_messages')
    .select('id, channel_id, sender_id, role, type, content, coupon_id, created_at')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) throw error;

  // 오래된 것부터 표시하도록 역순
  return ((data ?? []) as ChatMessage[]).reverse();
}

// ── 메시지 전송 ──────────────────────────────────────────────────
export async function sendMessage(params: SendMessageParams): Promise<ChatMessage> {
  const { storeId, senderId, role, type = 'text', content, couponId } = params;
  const channelId = await getOrCreateChannel(storeId);

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      channel_id: channelId,
      sender_id:  senderId,
      role,
      type,
      content:    content.trim(),
      coupon_id:  couponId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ChatMessage;
}

// ── Realtime 구독 ─────────────────────────────────────────────────
/**
 * 채널 메시지 실시간 구독.
 * DB INSERT 이벤트를 listen해서 새 메시지가 들어오면 onMessage 콜백 호출.
 *
 * @returns cleanup 함수 (언마운트 시 호출)
 */
export function subscribeChannel(
  storeId: string,
  onMessage: (msg: ChatMessage) => void
): () => void {
  let channel: RealtimeChannel | null = null;

  // 비동기로 channelId 확보 후 subscribe
  getOrCreateChannel(storeId)
    .then(channelId => {
      channel = supabase
        .channel(`chat:${channelId}`)
        .on(
          'postgres_changes',
          {
            event:  'INSERT',
            schema: 'public',
            table:  'chat_messages',
            filter: `channel_id=eq.${channelId}`,
          },
          (payload) => {
            onMessage(payload.new as ChatMessage);
          }
        )
        .subscribe();
    })
    .catch(console.error);

  return () => {
    if (channel) supabase.removeChannel(channel);
  };
}

// ── Presence (라이브 뷰어 수) ─────────────────────────────────────
/**
 * Supabase Realtime Presence로 현재 화면을 보는 사용자 수 추적.
 *
 * @param storeId
 * @param userId - 현재 사용자 ID (익명이면 임시 UUID)
 * @param onCount - 접속자 수 변경 콜백
 * @returns cleanup 함수
 */
export function trackPresence(
  storeId: string,
  userId: string,
  onCount: (count: number) => void
): () => void {
  const channel = supabase.channel(`presence:${storeId}`, {
    config: { presence: { key: userId } },
  });

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      onCount(Object.keys(state).length);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user_id: userId, online_at: new Date().toISOString() });
      }
    });

  return () => {
    channel.untrack().then(() => supabase.removeChannel(channel));
  };
}
