import { supabase } from '../supabase';

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  total_earned: number;
  total_spent: number;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  store_id?: string;
  description?: string;
  created_at: string;
}

export type CheckinResult =
  | {
      success:      true;
      earned:       number;
      balance:      number;
      store_name:   string;
      stamp_count?: number;
      stamp_goal?:  number;
      stamp_reward?:string | null;
    }
  | {
      success:    false;
      reason:     'too_far' | 'already_checked_today' | 'store_not_found' | 'receipt_already_used_today';
      distance_m?:number;
    };

export type EarnResult =
  | { success: true;  earned: number; balance: number }
  | { success: false; reason: string };

// 지갑 조회 (없으면 생성)
export async function getOrCreateWallet(userId: string): Promise<Wallet> {
  const { data, error } = await supabase.rpc('get_or_create_wallet', { p_user_id: userId });
  if (error) throw error;
  return data as Wallet;
}

// 지갑 잔액만 빠르게 조회
export async function getWalletBalance(userId: string): Promise<number> {
  const { data } = await supabase
    .from('wallets')
    .select('balance')
    .eq('user_id', userId)
    .single();
  return data?.balance ?? 0;
}

// 트랜잭션 내역 조회
export async function getWalletTransactions(userId: string, limit = 30): Promise<WalletTransaction[]> {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as WalletTransaction[];
}

// 가게 방문 체크인 (GPS 검증 포함)
export async function storeCheckin(
  userId: string,
  storeId: string,
  lat: number,
  lng: number,
): Promise<CheckinResult> {
  const { data, error } = await supabase.rpc('store_checkin', {
    p_user_id:  userId,
    p_store_id: storeId,
    p_lat:      lat,
    p_lng:      lng,
  });
  if (error) throw error;
  return data as CheckinResult;
}

// UNNI 적립 (쿠폰·영수증·리뷰 등)
export async function earnUnni(
  userId: string,
  eventType: 'coupon' | 'receipt' | 'review' | 'checkin_daily' | 'referral',
  storeId?: string,
): Promise<EarnResult> {
  const { data, error } = await supabase.rpc('earn_unni', {
    p_user_id:    userId,
    p_event_type: eventType,
    p_store_id:   storeId ?? null,
  });
  if (error) throw error;
  return data as EarnResult;
}

// 트랜잭션 타입 한글 변환
export function txTypeLabel(type: string): string {
  const map: Record<string, string> = {
    earn_checkin:       '🏪 가게 방문',
    earn_coupon:        '🎟 쿠폰 사용',
    earn_receipt:       '🧾 영수증 인증',
    earn_review:        '✍️ 리뷰 작성',
    earn_checkin_daily: '📅 출석 체크',
    earn_referral:      '👥 친구 초대',
    earn_event:         '🎉 이벤트 적립',
    spend_coupon:       '🎟 쿠폰 교환',
    spend_payment:      '💳 가게 결제',
    spend_gift:         '🎁 선물하기',
    expire:             '⏰ 만료 소각',
  };
  return map[type] ?? type;
}
