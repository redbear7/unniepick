// ================================================================
// 날씨 서비스 — Open-Meteo (https://open-meteo.com)
// API 키 불필요 · 완전 무료 · 오픈소스 기상 데이터
// ================================================================

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

// 30분 캐시
const _cache: { key: string; data: WeatherContext; at: number } | null = null;
let weatherCache: typeof _cache = null;
const CACHE_MS = 30 * 60 * 1000;

export type WeatherCondition = 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'cold' | 'hot';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night';

export interface WeatherContext {
  condition:  WeatherCondition;
  tempC:      number;
  timeOfDay:  TimeOfDay;
  moodTags:   string[];   // 날씨 + 시간대 합산 무드 태그
  description: string;   // 사람이 읽을 수 있는 설명
}

// ── 시간대 판별 ───────────────────────────────────────────────
export function getTimeOfDay(hour?: number): TimeOfDay {
  const h = hour ?? new Date().getHours();
  if (h >= 5  && h < 10)  return 'morning';
  if (h >= 10 && h < 17)  return 'afternoon';
  if (h >= 17 && h < 21)  return 'evening';
  if (h >= 21 && h < 24)  return 'night';
  return 'late_night';
}

// ── 시간대 → 무드 태그 ───────────────────────────────────────
const TIME_MOOD_MAP: Record<TimeOfDay, string[]> = {
  morning:    ['morning-coffee', 'fresh', 'acoustic', 'bright'],
  afternoon:  ['upbeat', 'lo-fi', 'chill', 'study'],
  evening:    ['jazz', 'indie', 'warm', 'mellow'],
  night:      ['lounge', 'r&b', 'night', 'smooth'],
  late_night: ['ambient', 'minimal', 'deep', 'dark'],
};

// ── WMO 날씨 코드 → 상태 매핑 (Open-Meteo 표준) ─────────────
// https://open-meteo.com/en/docs#weathervariables
function mapWmoCode(code: number, tempC: number): WeatherCondition {
  if (code === 0)                          return tempC > 28 ? 'hot' : 'sunny';
  if (code <= 3)                           return 'cloudy';   // 1=mainly clear, 2=partly cloudy, 3=overcast
  if (code <= 48)                          return 'cloudy';   // 45/48 fog
  if (code <= 67)                          return 'rainy';    // 51~67 drizzle / rain
  if (code <= 77)                          return 'snowy';    // 71~77 snow
  if (code <= 82)                          return 'rainy';    // 80~82 rain showers
  if (code <= 86)                          return 'snowy';    // 85~86 snow showers
  if (code <= 99)                          return 'rainy';    // 95~99 thunderstorm
  if (tempC < 5)                           return 'cold';
  return 'sunny';
}

// ── 날씨 상태 → 무드 태그 ────────────────────────────────────
const WEATHER_MOOD_MAP: Record<WeatherCondition, string[]> = {
  sunny:  ['upbeat', 'bright', 'tropical', 'happy'],
  hot:    ['tropical', 'summer', 'energetic', 'vibrant'],
  cloudy: ['mellow', 'indie', 'lo-fi', 'thoughtful'],
  rainy:  ['jazz', 'rainy', 'cozy', 'lo-fi', 'melancholic'],
  snowy:  ['cozy', 'acoustic', 'warm', 'christmas'],
  cold:   ['cozy', 'warm', 'acoustic', 'fireplace'],
};

// ── 날씨 설명 텍스트 ─────────────────────────────────────────
function buildDescription(condition: WeatherCondition, timeOfDay: TimeOfDay, tempC: number): string {
  const weather: Record<WeatherCondition, string> = {
    sunny:  '맑은',
    hot:    `${Math.round(tempC)}°C 더운`,
    cloudy: '흐린',
    rainy:  '비 오는',
    snowy:  '눈 오는',
    cold:   `${Math.round(tempC)}°C 쌀쌀한`,
  };
  const time: Record<TimeOfDay, string> = {
    morning:    '아침',
    afternoon:  '오후',
    evening:    '저녁',
    night:      '밤',
    late_night: '심야',
  };
  return `${weather[condition]} ${time[timeOfDay]}`;
}

// ── 메인: 날씨 컨텍스트 조회 ──────────────────────────────────
export async function fetchWeatherContext(
  lat: number,
  lng: number,
): Promise<WeatherContext> {
  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;

  // 캐시 유효성 확인
  if (weatherCache && weatherCache.key === cacheKey &&
      Date.now() - weatherCache.at < CACHE_MS) {
    return weatherCache.data;
  }

  try {
    const url = `${BASE_URL}?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&timezone=auto`;
    const res  = await fetch(url);
    if (!res.ok) return buildFallback();

    const json  = await res.json();
    const code  = json.current?.weather_code ?? 0;
    const tempC = json.current?.temperature_2m ?? 20;

    const condition  = mapWmoCode(code, tempC);
    const timeOfDay  = getTimeOfDay();
    const weatherMoods = WEATHER_MOOD_MAP[condition];
    const timeMoods    = TIME_MOOD_MAP[timeOfDay];

    // 무드 합산 (중복 제거)
    const moodTags = Array.from(new Set([...weatherMoods, ...timeMoods]));

    const ctx: WeatherContext = {
      condition,
      tempC,
      timeOfDay,
      moodTags,
      description: buildDescription(condition, timeOfDay, tempC),
    };

    weatherCache = { key: cacheKey, data: ctx, at: Date.now() };
    return ctx;
  } catch {
    return buildFallback();
  }
}

// API 키 없거나 오류 시 시간대만 반영한 fallback
function buildFallback(): WeatherContext {
  const timeOfDay = getTimeOfDay();
  return {
    condition:   'sunny',
    tempC:       20,
    timeOfDay,
    moodTags:    TIME_MOOD_MAP[timeOfDay],
    description: { morning: '아침', afternoon: '오후', evening: '저녁', night: '밤', late_night: '심야' }[timeOfDay],
  };
}

// ── 가게 위치 없을 때 사용자 현재 위치로 ─────────────────────
export async function fetchWeatherByCurrentLocation(): Promise<WeatherContext> {
  try {
    // expo-location이 이미 HomeScreen에서 허용됐다고 가정
    // 직접 IP 기반 fallback (별도 허가 불필요)
    const res  = await fetch('https://ipapi.co/json/');
    const json = await res.json();
    if (json.latitude && json.longitude) {
      return fetchWeatherContext(json.latitude, json.longitude);
    }
  } catch {}
  return buildFallback();
}
