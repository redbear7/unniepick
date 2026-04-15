import { supabase } from '../supabase';

export interface BannerRow {
  id:            string;
  title:         string;
  subtitle:      string | null;
  emoji:         string;
  bg_color:      string;
  text_color:    string;
  cta_text:      string;
  link_type:     'none' | 'store' | 'coupon' | 'external';
  link_value:    string | null;
  starts_at:     string;
  ends_at:       string | null;
  is_paused:     boolean;
  display_order: number;
  created_at:    string;
}

export type BannerInput = Omit<BannerRow, 'id' | 'created_at'>;

// ─── 고객용: 활성 배너만 (RLS 적용됨) ─────────────────────────────
export async function fetchActiveBanners(): Promise<BannerRow[]> {
  const { data, error } = await supabase
    .from('banner_ads')
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BannerRow[];
}

// ─── 시샵용: 전체 배너 ─────────────────────────────────────────────
export async function fetchAllBanners(): Promise<BannerRow[]> {
  const { data, error } = await supabase
    .from('all_banner_ads')
    .select('*');
  if (error) throw error;
  return (data ?? []) as BannerRow[];
}

// ─── 배너 생성 ─────────────────────────────────────────────────────
export async function createBanner(input: BannerInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_banner_ad', {
    p_title:         input.title,
    p_subtitle:      input.subtitle,
    p_emoji:         input.emoji,
    p_bg_color:      input.bg_color,
    p_text_color:    input.text_color,
    p_cta_text:      input.cta_text,
    p_link_type:     input.link_type,
    p_link_value:    input.link_value,
    p_starts_at:     input.starts_at,
    p_ends_at:       input.ends_at,
    p_display_order: input.display_order,
  });
  if (error) throw error;
  return data as string;
}

// ─── 배너 수정 ─────────────────────────────────────────────────────
export async function updateBanner(id: string, input: BannerInput): Promise<void> {
  const { error } = await supabase.rpc('update_banner_ad', {
    p_id:            id,
    p_title:         input.title,
    p_subtitle:      input.subtitle,
    p_emoji:         input.emoji,
    p_bg_color:      input.bg_color,
    p_text_color:    input.text_color,
    p_cta_text:      input.cta_text,
    p_link_type:     input.link_type,
    p_link_value:    input.link_value,
    p_starts_at:     input.starts_at,
    p_ends_at:       input.ends_at,
    p_display_order: input.display_order,
  });
  if (error) throw error;
}

// ─── 배너 일시중지 / 재개 ──────────────────────────────────────────
export async function pauseBanner(id: string):  Promise<void> {
  const { error } = await supabase.rpc('toggle_banner_pause', { p_id: id, p_pause: true });
  if (error) throw error;
}
export async function resumeBanner(id: string): Promise<void> {
  const { error } = await supabase.rpc('toggle_banner_pause', { p_id: id, p_pause: false });
  if (error) throw error;
}

// ─── 배너 삭제 ─────────────────────────────────────────────────────
export async function deleteBanner(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_banner_ad', { p_id: id });
  if (error) throw error;
}

// ─── 배너 상태 텍스트 ──────────────────────────────────────────────
export function bannerStatus(b: BannerRow): 'active' | 'paused' | 'scheduled' | 'expired' {
  const now = new Date();
  if (b.is_paused)                              return 'paused';
  if (b.ends_at && new Date(b.ends_at) < now)   return 'expired';
  if (new Date(b.starts_at) > now)              return 'scheduled';
  return 'active';
}
