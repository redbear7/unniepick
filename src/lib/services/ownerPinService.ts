import * as Crypto from 'expo-crypto';
import { supabase } from '../supabase';

// ─── PIN 해싱 (어드민과 동일: SHA-256, prefix "unnipick:") ────────────
async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `unnipick:${pin}`,
  );
}

// ─── 이번 달 문자열 (YYYY-MM) ─────────────────────────────────────────
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ─── 결과 타입 ─────────────────────────────────────────────────────────
export interface ChangePinResult {
  success: boolean;
  remainingChanges: number | null;  // null = 무제한
  error?: string;
}

// ─── PIN 변경 ─────────────────────────────────────────────────────────
// phone    : 사장님 전화번호 (로그인 시 사용한 번호)
// currentPin : 현재 6자리 PIN
// newPin     : 새 6자리 PIN
export async function changeOwnerPin(
  phone: string,
  currentPin: string,
  newPin: string,
): Promise<ChangePinResult> {
  const MAX_CHANGES_PER_MONTH = 2;

  if (!/^\d{6}$/.test(newPin)) {
    return { success: false, remainingChanges: null, error: '새 PIN은 6자리 숫자여야 합니다.' };
  }
  if (currentPin === newPin) {
    return { success: false, remainingChanges: null, error: '현재 PIN과 동일한 PIN으로 변경할 수 없습니다.' };
  }

  // 1. 전화번호로 owner 사용자 조회
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone.trim())
    .eq('role', 'owner')
    .single();

  if (userErr || !user) {
    return { success: false, remainingChanges: null, error: '등록된 사장님 계정을 찾을 수 없습니다.' };
  }

  // 2. owner_pins 조회
  const { data: pinRow, error: pinErr } = await supabase
    .from('owner_pins')
    .select('id, pin_hash, pin_changes, pin_change_month, is_active')
    .eq('user_id', user.id)
    .single();

  if (pinErr || !pinRow) {
    return { success: false, remainingChanges: null, error: '계정 정보를 찾을 수 없습니다.' };
  }
  if (!pinRow.is_active) {
    return { success: false, remainingChanges: null, error: '비활성화된 계정입니다.' };
  }

  // 3. 현재 PIN 검증
  const currentHash = await hashPin(currentPin);
  if (pinRow.pin_hash !== currentHash) {
    return { success: false, remainingChanges: null, error: '현재 PIN이 올바르지 않습니다.' };
  }

  // 4. 월 변경 횟수 확인
  const month = currentMonth();
  const changes = pinRow.pin_change_month === month ? pinRow.pin_changes : 0;

  if (changes >= MAX_CHANGES_PER_MONTH) {
    return {
      success: false,
      remainingChanges: 0,
      error: `이번 달 PIN 변경 횟수(${MAX_CHANGES_PER_MONTH}회)를 모두 사용했습니다. 다음 달에 변경 가능합니다.`,
    };
  }

  // 5. 새 PIN 해시 후 업데이트
  const newHash = await hashPin(newPin);
  const { error: updErr } = await supabase
    .from('owner_pins')
    .update({
      pin_hash:         newHash,
      pin_changes:      changes + 1,
      pin_change_month: month,
      updated_at:       new Date().toISOString(),
    })
    .eq('id', pinRow.id);

  if (updErr) {
    return { success: false, remainingChanges: null, error: 'PIN 변경에 실패했습니다. 다시 시도해주세요.' };
  }

  return {
    success: true,
    remainingChanges: MAX_CHANGES_PER_MONTH - (changes + 1),
  };
}
