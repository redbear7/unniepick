import { supabase } from '../supabase';

// ── 타입 ─────────────────────────────────────────────────────────────────────
export interface NaverSearchResult {
  name:            string;
  category:        string;
  address:         string;
  phone:           string;
  latitude:        number;
  longitude:       number;
  place_id:        string | null;
  naver_place_url: string;
}

export interface NaverPlaceForm {
  place_id:        string;
  naver_place_url: string;
  name:            string;
  category:        string;
  address:         string;
  phone:           string;
  latitude:        string;
  longitude:       string;
  description:     string;
}

export interface HotplaceRow {
  id:               string;
  name:             string;
  category:         string;
  address:          string;
  phone:            string;
  latitude:         number;
  longitude:        number;
  naver_place_id:   string;
  naver_place_url:  string;
  naver_thumbnail:  string | null;
  is_closed:        boolean;
  is_hotplace:      boolean;
  is_active:        boolean;
  naver_checked_at: string | null;
  created_at:       string;
}

// ── Edge Function URL 헬퍼 ───────────────────────────────────────────────────
function edgeFnUrl(path: string): string {
  const base = (supabase as any).supabaseUrl as string;
  return `${base}/functions/v1/${path}`;
}

// ── 1. 네이버 공식 Local Search API — 업체 검색 ──────────────────────────────
export async function searchNaverPlace(
  query: string,
): Promise<NaverSearchResult[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? '';

  const res = await fetch(edgeFnUrl('search-naver-place'), {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });

  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error ?? '검색에 실패했어요');
  return (json.items ?? []) as NaverSearchResult[];
}

// ── 2. URL에서 place_id 클라이언트 추출 (보조 기능) ──────────────────────────
export function extractNaverPlaceId(rawUrl: string): string | null {
  const patterns = [
    /map\.naver\.com\/v5\/entry\/place\/(\d+)/,
    /place\.naver\.com\/[^/]+\/(\d+)/,
    /m\.place\.naver\.com\/[^/]+\/(\d+)/,
  ];
  for (const p of patterns) {
    const m = rawUrl.match(p);
    if (m) return m[1];
  }
  return null;
}

export function buildNaverPlaceUrl(placeId: string): string {
  return `https://map.naver.com/v5/entry/place/${placeId}`;
}

// ── 검색 결과 → NaverPlaceForm 변환 헬퍼 ─────────────────────────────────────
export function resultToForm(r: NaverSearchResult): NaverPlaceForm {
  return {
    place_id:        r.place_id ?? '',
    naver_place_url: r.naver_place_url,
    name:            r.name,
    category:        r.category,
    address:         r.address,
    phone:           r.phone,
    latitude:        r.latitude ? String(r.latitude) : '',
    longitude:       r.longitude ? String(r.longitude) : '',
    description:     '',
  };
}

// ── 3. 핫플 등록 ──────────────────────────────────────────────────────────────
export async function registerHotplace(form: NaverPlaceForm): Promise<string> {
  const lat = parseFloat(form.latitude);
  const lng = parseFloat(form.longitude);

  const { data, error } = await supabase.rpc('register_hotplace', {
    p_name:            form.name.trim(),
    p_category:        form.category.trim(),
    p_address:         form.address.trim(),
    p_phone:           form.phone.trim(),
    p_latitude:        isNaN(lat) ? null : lat,
    p_longitude:       isNaN(lng) ? null : lng,
    p_naver_place_id:  form.place_id || null,
    p_naver_place_url: form.naver_place_url,
    p_naver_thumbnail: null,
    p_description:     form.description.trim() || null,
  });

  if (error) throw new Error(error.message);
  return data as string;
}

// ── 4. 핫플 목록 조회 ──────────────────────────────────────────────────────────
export async function fetchHotplaces(): Promise<HotplaceRow[]> {
  const { data, error } = await supabase
    .from('hotplace_stores')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as HotplaceRow[];
}

// ── 5. 폐업 상태 수동 토글 ───────────────────────────────────────────────────
export async function toggleStoreClosure(
  storeId:  string,
  isClosed: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('update_store_closure', {
    p_store_id:  storeId,
    p_is_closed: isClosed,
  });
  if (error) throw new Error(error.message);
}
