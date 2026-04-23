/**
 * UPGeofenceModule.ts — iOS UPGeofence Native Module 래퍼
 *
 * iOS Only. Android에서는 no-op으로 동작합니다.
 * 실제 네이티브 모듈: ios/app/UPGeofence.swift + UPGeofenceBridge.m
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

// ── 타입 ──────────────────────────────────────────────────────────
export interface GeofenceRegion {
  store_id:    string;
  store_name:  string;
  store_emoji: string;
  lat:         number;
  lng:         number;
  radius_m?:   number;   // 기본 150m
}

export interface GeofenceEnteredEvent {
  store_id:    string;
  store_name:  string;
  store_emoji: string;
  distance_m:  number;
  lat:         number;
  lng:         number;
}

// ── 네이티브 모듈 참조 ─────────────────────────────────────────────
const { UPGeofence } = NativeModules;

// ── 이벤트 이미터 (iOS only) ──────────────────────────────────────
const emitter = Platform.OS === 'ios' && UPGeofence
  ? new NativeEventEmitter(UPGeofence)
  : null;

// ── Public API ────────────────────────────────────────────────────

/**
 * 지오펜스 엔진 초기화.
 * Supabase 세션 획득 후 앱 시작 시 1회 호출.
 */
export function configureGeofence(params: {
  supabaseURL:  string;
  anonKey:      string;
  accessToken:  string;
  sharedSecret?: string;
}): void {
  if (Platform.OS !== 'ios' || !UPGeofence) return;
  UPGeofence.configure(
    params.supabaseURL,
    params.anonKey,
    params.accessToken,
    params.sharedSecret ?? ''
  );
}

/**
 * JWT 갱신 시 새 토큰 전달.
 */
export function setGeofenceToken(token: string): void {
  if (Platform.OS !== 'ios' || !UPGeofence) return;
  UPGeofence.setAccessToken(token);
}

/**
 * 활성 wallet 쿠폰의 매장 좌표를 지오펜스로 등록 (최대 20개).
 */
export function registerGeofenceRegions(regions: GeofenceRegion[]): void {
  if (Platform.OS !== 'ios' || !UPGeofence) return;
  UPGeofence.registerRegions(regions.slice(0, 20));
}

/**
 * 모든 지오펜스 해제.
 */
export function clearGeofenceRegions(): void {
  if (Platform.OS !== 'ios' || !UPGeofence) return;
  UPGeofence.clearRegions();
}

/**
 * 지오펜스 진입 이벤트 구독.
 * @returns unsubscribe 함수
 */
export function onGeofenceEntered(
  callback: (event: GeofenceEnteredEvent) => void
): () => void {
  if (!emitter) return () => {};
  const sub = emitter.addListener('UPGeofence:entered', callback);
  return () => sub.remove();
}

/**
 * 지오펜스 이탈 이벤트 구독.
 */
export function onGeofenceExited(
  callback: (event: { store_id: string }) => void
): () => void {
  if (!emitter) return () => {};
  const sub = emitter.addListener('UPGeofence:exited', callback);
  return () => sub.remove();
}
