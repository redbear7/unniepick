// ================================================================
// 매장 컨텍스트 수집 서비스 — Phase 1
// 카카오 로컬 API (상권/행정구역) + Open-Meteo (날씨) + Claude Vision (인테리어)
// ================================================================

import * as Location from 'expo-location';
import { supabase } from '../supabase';

const KAKAO_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY ?? '';

// ─── 타입 정의 ────────────────────────────────────────────────

export interface NearbyPOICounts {
  restaurant:   number;   // FD6 음식점
  cafe:         number;   // CE7 카페
  convenience:  number;   // CS2 편의점
  subway:       number;   // SW8 지하철역
  school:       number;   // SC4 학교
  office:       number;   // PO3 공공기관/오피스
}

export interface StoreContextResult {
  location_lat:      number;
  location_lng:      number;
  weather_zone:      string;
  weather_temp:      number;
  weather_code:      number;
  district_type:     string;
  district_detail:   string;
  nearby_counts:     NearbyPOICounts;
}

// ─── 1. GPS 좌표 가져오기 ─────────────────────────────────────

export async function getCurrentCoords(): Promise<{ lat: number; lng: number }> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('위치 권한이 필요해요');

  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: loc.coords.latitude, lng: loc.coords.longitude };
}

// ─── 2. 카카오 로컬: 좌표 → 행정구역 ─────────────────────────

async function getRegionFromCoords(lat: number, lng: number): Promise<string> {
  const url = `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}`;
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
  });
  if (!res.ok) return '';

  const json = await res.json();
  const region = json.documents?.[0];
  if (!region) return '';

  // '서울특별시 강남구 역삼동' 형태
  const parts = [region.region_1depth_name, region.region_2depth_name, region.region_3depth_name]
    .filter(Boolean);
  return parts.join(' ');
}

// ─── 3. 카카오 로컬: 반경 내 POI 카운트 ─────────────────────

async function getPOICount(
  lat: number, lng: number,
  categoryCode: string,
  radius = 500,
): Promise<number> {
  const url =
    `https://dapi.kakao.com/v2/local/search/category.json` +
    `?category_group_code=${categoryCode}&x=${lng}&y=${lat}&radius=${radius}&size=1`;

  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
  });
  if (!res.ok) return 0;

  const json = await res.json();
  return json.meta?.total_count ?? 0;
}

async function getNearbyPOICounts(lat: number, lng: number): Promise<NearbyPOICounts> {
  const [restaurant, cafe, convenience, subway, school, office] = await Promise.all([
    getPOICount(lat, lng, 'FD6'),   // 음식점
    getPOICount(lat, lng, 'CE7'),   // 카페
    getPOICount(lat, lng, 'CS2'),   // 편의점
    getPOICount(lat, lng, 'SW8'),   // 지하철역
    getPOICount(lat, lng, 'SC4'),   // 학교
    getPOICount(lat, lng, 'PO3'),   // 공공기관
  ]);
  return { restaurant, cafe, convenience, subway, school, office };
}

// ─── 4. 상권 유형 분류 ────────────────────────────────────────

function classifyDistrictType(counts: NearbyPOICounts): string {
  const { restaurant, cafe, convenience, subway, school, office } = counts;
  const total = restaurant + cafe + convenience;

  if (subway >= 1 && total >= 30) return '번화가';
  if (office >= 10 && cafe >= 5)  return '오피스';
  if (school >= 3)                return '학교상권';
  if (total >= 20)                return '상업지구';
  if (total >= 5)                 return '골목상권';
  return '주거지';
}

// ─── 5. Open-Meteo 날씨 ───────────────────────────────────────

interface WeatherResult {
  zone: string;
  temp: number;
  code: number;
}

async function getWeather(lat: number, lng: number): Promise<WeatherResult> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,weathercode` +
    `&timezone=Asia%2FSeoul`;

  const res = await fetch(url);
  if (!res.ok) return { zone: 'mild-spring', temp: 20, code: 0 };

  const json = await res.json();
  const temp = json.current?.temperature_2m ?? 20;
  const code = json.current?.weathercode ?? 0;

  let zone: string;
  if ([51,53,55,61,63,65,80,81,82,95,96,99].includes(code)) {
    zone = 'rainy';
  } else if ([71,73,75,77,85,86].includes(code)) {
    zone = 'snowy';
  } else if (temp >= 27) {
    zone = 'hot-humid';
  } else if (temp <= 3) {
    zone = 'cold-dry';
  } else {
    zone = 'mild-spring';
  }

  return { zone, temp, code };
}

// ─── 6. 메인: 전체 컨텍스트 수집 ────────────────────────────

export async function collectStoreContext(
  storeId: string,
  coords?: { lat: number; lng: number },
): Promise<StoreContextResult> {
  const { lat, lng } = coords ?? await getCurrentCoords();

  // 병렬 호출
  const [weather, nearbyCounts, regionDetail] = await Promise.all([
    getWeather(lat, lng),
    getNearbyPOICounts(lat, lng),
    getRegionFromCoords(lat, lng),
  ]);

  const districtType = classifyDistrictType(nearbyCounts);

  const result: StoreContextResult = {
    location_lat:    lat,
    location_lng:    lng,
    weather_zone:    weather.zone,
    weather_temp:    weather.temp,
    weather_code:    weather.code,
    district_type:   districtType,
    district_detail: regionDetail,
    nearby_counts:   nearbyCounts,
  };

  // Supabase upsert
  await supabase
    .from('store_contexts')
    .upsert({
      store_id:        storeId,
      ...result,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'store_id' });

  return result;
}

// ─── 7. 인테리어 태그 저장 (Claude Vision 결과 연동) ──────────

export async function saveInteriorAnalysis(
  storeId: string,
  params: {
    interior_tags:   string[];
    interior_style:  string;
    energy_level:    number;
  },
): Promise<void> {
  await supabase
    .from('store_contexts')
    .upsert({
      store_id:          storeId,
      interior_tags:     params.interior_tags,
      interior_style:    params.interior_style,
      energy_level:      params.energy_level,
      interior_analyzed: true,
      updated_at:        new Date().toISOString(),
    }, { onConflict: 'store_id' });
}

// ─── 8. 메뉴 태그 저장 ───────────────────────────────────────

export async function saveMenuTags(
  storeId: string,
  menuTags: string[],
): Promise<void> {
  await supabase
    .from('store_contexts')
    .upsert({
      store_id:   storeId,
      menu_tags:  menuTags,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'store_id' });
}

// ─── 9. 컨텍스트 조회 ────────────────────────────────────────

export async function fetchStoreContext(storeId: string) {
  const { data } = await supabase
    .from('store_contexts')
    .select('*')
    .eq('store_id', storeId)
    .single();
  return data;
}

// ─── 날씨존 한글 라벨 ─────────────────────────────────────────

export const WEATHER_ZONE_LABEL: Record<string, string> = {
  'hot-humid':   '☀️ 더움',
  'cold-dry':    '🧊 추움',
  'mild-spring': '🌸 쾌적',
  'rainy':       '🌧 비',
  'snowy':       '❄️ 눈',
};

export const DISTRICT_TYPE_LABEL: Record<string, string> = {
  '번화가':   '🏙 번화가',
  '오피스':   '🏢 오피스',
  '학교상권': '🎓 학교상권',
  '상업지구': '🛒 상업지구',
  '골목상권': '🏘 골목상권',
  '주거지':   '🏠 주거지',
};
