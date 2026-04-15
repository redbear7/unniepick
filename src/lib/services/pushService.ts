import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from '../supabase';
import { SUPER_ADMIN_EMAIL } from '../../constants/theme';

export type SenderType = 'superadmin' | 'owner';

export interface PushHistoryRow {
  id: string;
  sender_type: SenderType;
  sender_label: string;      // '최고관리자' | '우리동네 맛집'
  title: string;
  body: string;
  sent_count: number;
  read_count: number;
  created_at: string;
}

// ─── 푸시 토큰 등록 ─────────────────────────────
export async function registerPushToken(userId: string): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  // Supabase에 토큰 저장 (upsert)
  await supabase.from('push_tokens').upsert(
    { user_id: userId, token, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );

  return token;
}

// ─── 전체 사용자 토큰 조회 ───────────────────────
export async function getAllPushTokens(): Promise<string[]> {
  const { data, error } = await supabase
    .from('push_tokens')
    .select('token')
    .not('token', 'is', null);

  if (error) throw error;
  return (data ?? []).map((r: { token: string }) => r.token);
}

// ─── 알림 수신 opt-in 토큰만 조회 ───────────────
export async function getOptInPushTokens(): Promise<string[]> {
  const { data, error } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('opt_in', true)
    .not('token', 'is', null);

  if (error) throw error;
  return (data ?? []).map((r: { token: string }) => r.token);
}

// ─── Expo 푸시 API 직접 발송 ────────────────────
async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<number> {
  if (tokens.length === 0) return 0;

  // Expo 푸시 알림은 100개씩 배치 발송
  const chunks: string[][] = [];
  for (let i = 0; i < tokens.length; i += 100) {
    chunks.push(tokens.slice(i, i + 100));
  }

  let successCount = 0;

  for (const chunk of chunks) {
    const messages = chunk.map((token) => ({
      to: token,
      sound: 'default' as const,
      title,
      body,
      data: data ?? {},
    }));

    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const result = await res.json();
      const tickets = result.data ?? [];
      successCount += tickets.filter((t: { status: string }) => t.status === 'ok').length;
    } catch (e) {
      console.error('Expo Push 발송 실패:', e);
    }
  }

  return successCount;
}

// ─── 최고관리자: 전체 사용자 푸시 발송 ──────────
export async function sendSuperAdminPush(
  title: string,
  body: string
): Promise<{ sentCount: number; historyId: string }> {
  const tokens = await getAllPushTokens();
  const sentCount = await sendExpoPush(tokens, title, body, { type: 'superadmin' });

  // 히스토리 저장
  const { data, error } = await supabase
    .from('push_history')
    .insert({
      sender_type: 'superadmin',
      sender_label: '최고관리자',
      title,
      body,
      sent_count: sentCount,
      read_count: 0,
    })
    .select('id')
    .single();

  if (error) throw error;
  return { sentCount, historyId: data.id };
}

// ─── 사장님: 알림 수신 고객 푸시 발송 ──────────
export async function sendOwnerPush(
  storeName: string,
  title: string,
  body: string
): Promise<{ sentCount: number; historyId: string }> {
  const tokens = await getOptInPushTokens();
  const sentCount = await sendExpoPush(tokens, title, body, { type: 'owner' });

  const { data, error } = await supabase
    .from('push_history')
    .insert({
      sender_type: 'owner',
      sender_label: storeName,
      title,
      body,
      sent_count: sentCount,
      read_count: 0,
    })
    .select('id')
    .single();

  if (error) throw error;
  return { sentCount, historyId: data.id };
}

// ─── 시샵 전용: 관리자 기기로 알림 발송 ──────────
// 회원가입·가게신청 등 이벤트 발생 시 관리자에게 즉시 알림
export async function notifyAdmin(
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  try {
    // superadmin 역할을 가진 users의 push_token 조회
    const { data: rows } = await supabase
      .from('push_tokens')
      .select('token, user:users!inner(role)')
      .eq('user.role', 'superadmin')
      .not('token', 'is', null);

    const tokens = (rows ?? []).map((r: any) => r.token as string).filter(Boolean);

    if (tokens.length === 0) return; // 관리자가 앱에 로그인한 기록 없으면 스킵

    await sendExpoPush(tokens, title, body, { type: 'admin_alert', ...data });
  } catch { /* best-effort — 알림 실패가 본 기능을 막으면 안 됨 */ }
}

// ─── 푸시 읽음 처리 (+1) ─────────────────────────
export async function incrementReadCount(historyId: string): Promise<void> {
  await supabase.rpc('increment_push_read_count', { history_id: historyId });
}

// ─── 푸시 히스토리 조회 ──────────────────────────
export async function fetchPushHistory(
  senderType?: SenderType
): Promise<PushHistoryRow[]> {
  let query = supabase
    .from('push_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (senderType) query = query.eq('sender_type', senderType);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ─── 히스토리 통계 요약 ──────────────────────────
export async function fetchPushStats(): Promise<{
  totalSent: number;
  totalRead: number;
  superAdminCount: number;
  ownerCount: number;
}> {
  const { data, error } = await supabase
    .from('push_history')
    .select('sender_type, sent_count, read_count');

  if (error) throw error;

  const rows = data ?? [];
  return {
    totalSent: rows.reduce((s: number, r: { sent_count: number }) => s + r.sent_count, 0),
    totalRead: rows.reduce((s: number, r: { read_count: number }) => s + r.read_count, 0),
    superAdminCount: rows.filter((r: { sender_type: string }) => r.sender_type === 'superadmin').length,
    ownerCount: rows.filter((r: { sender_type: string }) => r.sender_type === 'owner').length,
  };
}
