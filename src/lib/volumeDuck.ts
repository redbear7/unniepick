import TrackPlayer from 'react-native-track-player';

// ─── 상태 ────────────────────────────────────────────────────────
let _currentVol  = 1.0;
let _duckTimer: ReturnType<typeof setInterval> | null = null;

function _clearTimer() {
  if (_duckTimer) {
    clearInterval(_duckTimer);
    _duckTimer = null;
  }
}

async function _setVol(v: number) {
  try {
    await TrackPlayer.setVolume(Math.min(1, Math.max(0, v)));
  } catch {
    // 음악 재생 중이 아니면 무시
  }
}

// ─── 덕킹 (음악 볼륨 낮추기) ─────────────────────────────────────
// TTS 방송 시작 전 호출
export function duckMusicVolume(
  targetVol  = 0.12,   // 덕킹 목표 볼륨 (12%)
  durationMs = 350,    // 페이드 시간
) {
  _clearTimer();
  const start = _currentVol;
  const diff  = start - targetVol;
  if (diff <= 0) return;

  const STEPS  = 20;
  const stepMs = durationMs / STEPS;
  let   step   = 0;

  _duckTimer = setInterval(() => {
    step++;
    _currentVol = Math.max(targetVol, start - diff * (step / STEPS));
    _setVol(_currentVol);
    if (step >= STEPS) _clearTimer();
  }, stepMs);
}

// ─── 복원 (음악 볼륨 되돌리기) ───────────────────────────────────
// TTS 방송 종료 후 호출
export function unduckMusicVolume(
  durationMs = 600,    // 복원 페이드 시간 (부드럽게 올리기)
) {
  _clearTimer();
  const start  = _currentVol;
  const target = 1.0;
  const diff   = target - start;
  if (diff <= 0) return;

  const STEPS  = 25;
  const stepMs = durationMs / STEPS;
  let   step   = 0;

  _duckTimer = setInterval(() => {
    step++;
    _currentVol = Math.min(target, start + diff * (step / STEPS));
    _setVol(_currentVol);
    if (step >= STEPS) _clearTimer();
  }, stepMs);
}

// ─── 현재 덕킹 여부 (크로스페이드 충돌 방지용) ───────────────────
export function isDucked(): boolean {
  return _currentVol < 0.5;
}

// ─── 즉시 복원 (앱 종료 / 긴급용) ───────────────────────────────
export function resetMusicVolume() {
  _clearTimer();
  _currentVol = 1.0;
  _setVol(1.0);
}
