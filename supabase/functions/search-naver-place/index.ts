/**
 * Supabase Edge Function: search-naver-place
 *
 * 네이버 공식 Local Search API 사용
 * https://developers.naver.com/docs/serviceapi/search/local/local.md
 *
 * 환경변수 설정 (배포 전 1회):
 *   supabase secrets set NAVER_CLIENT_ID=your_id NAVER_CLIENT_SECRET=your_secret
 *
 * 배포:
 *   supabase functions deploy search-naver-place
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

// ── HTML 태그 제거 ('<b>업체명</b>' → '업체명') ───────────────────────────
function stripHtml(str: string): string {
  return str.replace(/<[^>]+>/g, '').trim();
}

// ── Naver 업체 URL에서 place_id 추출 ─────────────────────────────────────
function extractPlaceId(link: string): string | null {
  const patterns = [
    /map\.naver\.com\/v5\/entry\/place\/(\d+)/,
    /place\.naver\.com\/[^/]+\/(\d+)/,
    /m\.place\.naver\.com\/[^/]+\/(\d+)/,
  ];
  for (const p of patterns) {
    const m = link.match(p);
    if (m) return m[1];
  }
  return null;
}

// ── KATECH 좌표 → WGS84 (단순 /1e7 변환, 실용 정밀도 충분) ────────────────
function toLatLng(mapx: string, mapy: string) {
  return {
    latitude:  parseInt(mapy, 10) / 1e7,
    longitude: parseInt(mapx, 10) / 1e7,
  };
}

// ── 카테고리 정규화 ───────────────────────────────────────────────────────
function normalizeCategory(raw: string): string {
  if (!raw) return '기타';
  const map: Record<string, string> = {
    '한식': '한식', '일식': '일식', '중식': '중식', '양식': '양식',
    '분식': '분식', '카페': '카페', '베이커리': '카페', '커피': '카페',
    '치킨': '치킨/패스트푸드', '패스트푸드': '치킨/패스트푸드',
    '주점': '주점/이자카야', '이자카야': '주점/이자카야',
    '고기': '고기구이', '삼겹살': '고기구이', '갈비': '고기구이',
    '해산물': '해산물', '횟집': '해산물',
  };
  for (const [key, val] of Object.entries(map)) {
    if (raw.includes(key)) return val;
  }
  // '>' 구분자 마지막 항목만 (예: '음식점>한식>삼겹살' → '삼겹살')
  return raw.split('>').pop()?.trim() ?? raw;
}

// ── 메인 ─────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const clientId     = Deno.env.get('NAVER_CLIENT_ID');
    const clientSecret = Deno.env.get('NAVER_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 없어요\nsupabase secrets set 으로 설정해주세요' }),
        { status: 500, headers: CORS },
      );
    }

    const body  = await req.json();
    const query: string = (body.query ?? '').trim();
    if (!query) {
      return new Response(
        JSON.stringify({ error: '검색어(query)를 입력해주세요' }),
        { status: 400, headers: CORS },
      );
    }

    // ── 네이버 Local Search API 호출 ──────────────────────────────────────
    const apiUrl = `https://openapi.naver.com/v1/search/local.json` +
      `?query=${encodeURIComponent(query)}&display=5&sort=random`;

    const apiRes = await fetch(apiUrl, {
      headers: {
        'X-Naver-Client-Id':     clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return new Response(
        JSON.stringify({ error: `네이버 API 오류 (${apiRes.status}): ${errText}` }),
        { status: apiRes.status, headers: CORS },
      );
    }

    const json = await apiRes.json();
    const items = (json.items ?? []).map((item: any) => {
      const { latitude, longitude } = toLatLng(item.mapx, item.mapy);
      const placeId = extractPlaceId(item.link ?? '');
      return {
        name:            stripHtml(item.title),
        category:        normalizeCategory(item.category ?? ''),
        address:         item.roadAddress || item.address || '',
        phone:           item.telephone || '',
        latitude,
        longitude,
        link:            item.link ?? '',
        place_id:        placeId,
        naver_place_url: placeId
          ? `https://map.naver.com/v5/entry/place/${placeId}`
          : (item.link ?? ''),
      };
    });

    return new Response(
      JSON.stringify({ items }),
      { status: 200, headers: CORS },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message ?? '서버 오류가 발생했어요' }),
      { status: 500, headers: CORS },
    );
  }
});
