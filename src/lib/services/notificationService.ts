import { supabase } from '../supabase';
import * as ExpoNotifications from 'expo-notifications';
import { getNotificationOptIn } from '../notifications';

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
