/**
 * UPLiveActivityModule.ts — iOS UPLiveActivity Native Module 래퍼
 *
 * iOS 16.2+ Only. 하위 버전 및 Android에서는 no-op.
 * 실제 네이티브 모듈: ios/app/UPLiveActivity.swift + UPLiveActivityBridge.m
 */

import { NativeModules, Platform } from 'react-native';

export interface LiveActivityParams {
  store_id:       string;
  user_coupon_id: string;
  store_emoji:    string;
  store_name:     string;
  coupon_title:   string;
  distance_m:     number;
  d_day:          number;
  coupon_count:   number;
}

const { UPLiveActivity } = NativeModules;

// ── Public API ────────────────────────────────────────────────────

/** Live Activity 시작. activityId 반환. */
export async function startLiveActivity(params: LiveActivityParams): Promise<string | null> {
  if (Platform.OS !== 'ios' || !UPLiveActivity) return null;
  try {
    const id: string = await UPLiveActivity.startActivity(params);
    return id;
  } catch (e) {
    console.warn('[UPLiveActivity] start failed:', e);
    return null;
  }
}

/** Live Activity 업데이트 (거리 변화 등). */
export async function updateLiveActivity(
  activityId: string,
  params: Partial<LiveActivityParams>
): Promise<void> {
  if (Platform.OS !== 'ios' || !UPLiveActivity) return;
  try {
    await UPLiveActivity.updateActivity(activityId, params);
  } catch (e) {
    console.warn('[UPLiveActivity] update failed:', e);
  }
}

/** Live Activity 종료. */
export async function endLiveActivity(activityId: string): Promise<void> {
  if (Platform.OS !== 'ios' || !UPLiveActivity) return;
  try {
    await UPLiveActivity.endActivity(activityId);
  } catch (e) {
    console.warn('[UPLiveActivity] end failed:', e);
  }
}

/** 현재 실행 중인 Activity ID 조회. */
export async function getCurrentActivityId(): Promise<string | null> {
  if (Platform.OS !== 'ios' || !UPLiveActivity) return null;
  try {
    return await UPLiveActivity.getCurrentActivityId();
  } catch {
    return null;
  }
}

/** Live Activity 지원 여부 (iOS 16.2+ + 사용자 허용). */
export async function isLiveActivitySupported(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !UPLiveActivity) return false;
  try {
    return await UPLiveActivity.isSupported();
  } catch {
    return false;
  }
}
