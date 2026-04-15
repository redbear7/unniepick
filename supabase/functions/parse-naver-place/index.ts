// Supabase Edge Function: parse-naver-place
// 네이버 업체 URL → 업체 정보 JSON 반환
// Deploy: supabase functions deploy parse-naver-place

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

// ── 네이버 플레이스 ID 추출 ─────────────────────────────────────────────────
function extractPlaceId(rawUrl: string): string | null {
  const patterns = [
    // https://map.naver.com/v5/entry/place/1234567890
    /map\.naver\.com\/v5\/entry\/place\/(\d+)/,
    // https://place.naver.com/restaurant/1234567890
    /place\.naver\.com\/[^/]+\/(\d+)/,
    // https://m.place.naver.com/restaurant/1234567890
    /m\.place\.naver\.com\/[^/]+\/(\d+)/,
    // 구형 https://map.naver.com/?dlevel=15&pinType=site&pinId=1234567890
    /pinId=(\d+)/,
  ];
  for (const p of patterns) {
    const m = rawUrl.match(p);
    if (m) return m[1];
  }
  return null;
}

// ── 네이버 플레이스 API 호출 ─────────────────────────────────────────────────
async function fetchNaverPlaceInfo(placeId: string): Promise<any> {
  // 1차: 모바일 API (summary)
  const summaryUrl =
    `https://map.naver.com/v5/api/sites/summary/${placeId}?lang=ko`;

  const res = await fetch(summaryUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)',
      Referer: 'https://map.naver.com/',
      Accept: 'application/json, */*',
    },
  });

  if (!res.ok) throw new Error(`Naver API ${res.status}`);
  return res.json();
}

// ── 폐업 여부 판정 ───────────────────────────────────────────────────────────
function detectClosed(data: any): boolean {
  const status = (data?.businessStatus?.status ?? '').toUpperCase();
  const closed  = data?.closed ?? false;
  const keywords = ['CLOSED', 'PERMANENTLY', 'BUSINESS_CLOSED', 'CEASE'];
  return closed || keywords.some(k => status.includes(k));
}

// ── 카테고리 정규화 ──────────────────────────────────────────────────────────
function normalizeCategory(raw: string | undefined): string {
  if (!raw) return '기타';
  const map: Record<string, string> = {
    '한식': '한식', '일식': '일식', '중식': '중식', '양식': '양식',
    '분식': '분식', '카페': '카페', '베이커리': '카페', '커피': '카페',
    '치킨': '치킨/패스트푸드', '패스트푸드': '치킨/패스트푸드',
    '주점': '주점/이자카야', '이자카야': '주점/이자카야',
    '고기': '고기구이', '삼겹살': '고기구이', '갈비': '고기구이',
    '해산물': '해산물', '횟집': '해산물', '회': '해산물',
  };
  for (const [key, val] of Object.entries(map)) {
    if (raw.includes(key)) return val;
  }
  return raw.split('>').pop()?.trim() ?? raw;
}

// ── 메인 핸들러 ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const body = await req.json();
    let inputUrl: string = body.url ?? '';
    if (!inputUrl) {
      return new Response(
        JSON.stringify({ error: 'url 파라미터가 필요해요' }),
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // naver.me 단축 URL 처리 → Location 리다이렉트 추적
    if (inputUrl.includes('naver.me')) {
      const r = await fetch(inputUrl, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      inputUrl = r.url;
    }

    const placeId = extractPlaceId(inputUrl);
    if (!placeId) {
      return new Response(
        JSON.stringify({
          error: '유효한 네이버 업체 링크가 아니에요\n예: https://map.naver.com/v5/entry/place/12345',
        }),
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const data = await fetchNaverPlaceInfo(placeId);

    // 필드 파싱 (네이버 API 버전에 따라 필드명이 다를 수 있어 fallback 처리)
    const name      = data.name ?? data.title ?? '';
    const address   = data.roadAddress ?? data.address ?? data.fullAddress ?? '';
    const phone     = data.tel ?? data.phone ?? '';
    const lat       = parseFloat(data.y ?? data.lat ?? data.coordinate?.y ?? '0');
    const lng       = parseFloat(data.x ?? data.lng ?? data.coordinate?.x ?? '0');
    const category  = normalizeCategory(
      data.categoryName ?? data.category ?? data.businessCategory ?? '',
    );
    const thumbnail = data.imageUrl ?? data.images?.[0]?.url ?? null;
    const hours     = data.businessStatus?.businessHours ?? null;
    const is_closed = detectClosed(data);

    return new Response(
      JSON.stringify({
        place_id:   placeId,
        name,
        category,
        address,
        phone,
        latitude:   lat,
        longitude:  lng,
        thumbnail,
        hours,
        is_closed,
        naver_place_url: `https://map.naver.com/v5/entry/place/${placeId}`,
      }),
      { status: 200, headers: CORS_HEADERS },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message ?? '업체 정보를 가져오지 못했어요' }),
      { status: 500, headers: CORS_HEADERS },
    );
  }
});
