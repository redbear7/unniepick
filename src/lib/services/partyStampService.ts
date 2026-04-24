/**
 * partyStampService — 동반자 스탬프 공유
 *
 * 영수증 인증 후 메뉴 개수 기반으로 동반자 스탬프 세션 생성/참가
 */

const ADMIN_URL = process.env.EXPO_PUBLIC_ADMIN_URL ?? 'https://unniepick.com';

// ── 파티 세션 생성 (영수증 인증자) ───────────────────────────────
export async function createPartySession(params: {
  userId:    string;
  storeId:   string;
  maxJoins:  number; // 동반자 최대 인원 (호스트 제외)
}): Promise<{ code: string; expiresAt: string } | null> {
  try {
    const res = await fetch(`${ADMIN_URL}/api/stamp/party/create`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        user_id:   params.userId,
        store_id:  params.storeId,
        max_joins: params.maxJoins,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { code: data.code, expiresAt: data.expires_at };
  } catch {
    return null;
  }
}

// ── 파티 세션 참가 (동반자) ─────────────────────────────────────
export interface PartyJoinResult {
  success:    boolean;
  reason?:    string;      // 'cooldown' 등
  stampCount?: number;
  isReward?:  boolean;
  storeName?: string;
  remaining?: number;      // 남은 동반자 슬롯
  errorMsg?:  string;
}

export async function joinPartySession(params: {
  code:   string;
  userId: string;
}): Promise<PartyJoinResult> {
  try {
    const res = await fetch(`${ADMIN_URL}/api/stamp/party/join`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        code:    params.code.toUpperCase().trim(),
        user_id: params.userId,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, errorMsg: data.error ?? '오류가 발생했어요' };
    return {
      success:    data.success,
      reason:     data.reason,
      stampCount: data.stamp_count,
      isReward:   data.is_reward,
      storeName:  data.store_name,
      remaining:  data.remaining,
    };
  } catch (e: any) {
    return { success: false, errorMsg: e.message ?? '네트워크 오류' };
  }
}

// ── 코드 표시용 포맷 (ABC DEF) ──────────────────────────────────
export function formatPartyCode(code: string): string {
  const c = code.toUpperCase().replace(/\s/g, '');
  return c.length === 6 ? `${c.slice(0, 3)} ${c.slice(3)}` : c;
}
