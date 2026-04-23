import { supabase } from '../supabase';
import * as ExpoNotifications from 'expo-notifications';
import { getNotificationOptIn } from '../notifications';

// ── 타입 ────────────────────────────────────────────────────────────
export type NotifType = 'coupon' | 'stamp' | 'coin' | 'expiry' | 'nearby' | 'event';

export interface NotifRow {
  id:         string;
  user_id:    string;
  type:       NotifType;
  title:      string;
  body:       string;
  data:       Record<string, string> | null;
  is_read:    boolean;
  created_at: string;
}

export interface NotifSetting {
  user_id:    string;
  coupon:     boolean;
  stamp:      boolean;
  coin:       boolean;
  expiry:     boolean;
  nearby_fav: boolean;
  nearby_new: boolean;
  event:      boolean;
}

export const NOTIF_META: Record<NotifType, { emoji: string; label: string; color: string }> = {
  coupon:  { emoji: '🎟', label: '쿠폰',     color: '#FF6F0F' },
  stamp:   { emoji: '🍀', label: '스탬프',   color: '#10B981' },
  coin:    { emoji: '🎯', label: '포인트',     color: '#F59E0B' },
  expiry:  { emoji: '⏰', label: '만료 임박', color: '#EF4444' },
  nearby:  { emoji: '📍', label: '주변 매장', color: '#3B82F6' },
  event:   { emoji: '📣', label: '이벤트',   color: '#8B5CF6' },
};

export function formatNotifTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}일 전`;
  const date = new Date(iso);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

// ── 알림 목록 ────────────────────────────────────────────────────────
export async function fetchNotifications(userId: string): Promise<NotifRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as NotifRow[];
}

// ── 미읽음 개수 ──────────────────────────────────────────────────────
export async function fetchUnreadCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  return count ?? 0;
}

// ── 읽음 처리 ────────────────────────────────────────────────────────
export async function markAsRead(notifId: string): Promise<void> {
  await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
}

export async function markAllAsRead(userId: string): Promise<void> {
  await supabase.from('notifications').update({ is_read: true })
    .eq('user_id', userId).eq('is_read', false);
}

// ── 삭제 ─────────────────────────────────────────────────────────────
export async function deleteNotif(notifId: string): Promise<void> {
  await supabase.from('notifications').delete().eq('id', notifId);
}

// ── 알림 설정 ────────────────────────────────────────────────────────
export async function fetchNotifSetting(userId: string): Promise<NotifSetting> {
  const { data } = await supabase
    .from('notification_settings')
    .select('*').eq('user_id', userId).single();
  return data ?? {
    user_id: userId, coupon: true, stamp: true, coin: true,
    expiry: true, nearby_fav: true, nearby_new: true, event: true,
  };
}

export async function upsertNotifSetting(s: NotifSetting): Promise<void> {
  await supabase.from('notification_settings').upsert(s, { onConflict: 'user_id' });
}

// 푸시 토큰 저장/업데이트
export async function savePushToken(userId: string, optIn: boolean): Promise<void> {
  let token = '';
  try {
    const tokenData = await ExpoNotifications.getExpoPushTokenAsync();
    token = tokenData.data;
  } catch {
    // 시뮬레이터에서는 토큰 발급 안됨
    token = 'simulator-no-token';
  }

  await supabase
    .from('notification_tokens')
    .upsert({ user_id: userId, token, opt_in: optIn }, { onConflict: 'user_id' });
}

// 알림 수신 동의한 사용자 토큰 목록 (사장님용)
export async function fetchOptInTokens(): Promise<string[]> {
  const { data, error } = await supabase
    .from('notification_tokens')
    .select('token')
    .eq('opt_in', true)
    .neq('token', 'simulator-no-token');

  if (error) return [];
  return (data ?? []).map((d) => d.token);
}

// Expo Push 서버로 알림 발송
export async function sendPushToOptInUsers(params: {
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<{ sent: number }> {
  const tokens = await fetchOptInTokens();
  if (tokens.length === 0) return { sent: 0 };

  const messages = tokens.map((token) => ({
    to: token,
    title: params.title,
    body: params.body,
    data: params.data ?? {},
    sound: 'default',
  }));

  // Expo Push API 호출
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });

  const result = await response.json();
  return { sent: tokens.length };
}
