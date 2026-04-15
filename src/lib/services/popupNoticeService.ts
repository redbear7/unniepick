import { supabase } from '../supabase';

export interface PopupNoticeRow {
  id: string;
  title: string;
  content: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

// 활성 팝업 공지 1건 조회 (가장 최근 등록순)
export async function fetchActivePopupNotice(): Promise<PopupNoticeRow | null> {
  const { data, error } = await supabase
    .from('popup_notices')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data as PopupNoticeRow;
}

// 전체 팝업 목록 (시샵 관리용)
export async function fetchAllPopupNotices(): Promise<PopupNoticeRow[]> {
  const { data } = await supabase
    .from('popup_notices')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  return (data ?? []) as PopupNoticeRow[];
}

// 팝업 등록
export async function createPopupNotice(title: string, content: string): Promise<void> {
  const { error } = await supabase
    .from('popup_notices')
    .insert({ title: title.trim(), content: content.trim(), is_active: true });
  if (error) throw error;
}

// 팝업 활성/비활성 토글
export async function togglePopupNotice(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('popup_notices')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// 팝업 삭제
export async function deletePopupNotice(id: string): Promise<void> {
  const { error } = await supabase
    .from('popup_notices')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
