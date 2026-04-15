import { supabase } from '../supabase';

export interface AnnouncementRow {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
  sort_order: number;
  view_count: number;
  created_at: string;
}

// 활성 공지 목록 조회 (홈 배너용) → 제목만 반환 (제목 없으면 content fallback)
export async function fetchActiveAnnouncements(): Promise<string[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('title, content')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data ?? []).map(d => (d.title?.trim() ? d.title : d.content));
}

// 활성 공지 전체 조회 (공지 게시판용) → 전체 row
export async function fetchActiveAnnouncementRows(): Promise<AnnouncementRow[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, content, is_active, sort_order, view_count, created_at')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data ?? []) as AnnouncementRow[];
}

// 전체 공지 목록 (최고관리자용) — view_count 포함
export async function fetchAllAnnouncements(): Promise<AnnouncementRow[]> {
  const { data } = await supabase
    .from('announcements')
    .select('id, title, content, is_active, sort_order, view_count, created_at')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  return (data ?? []) as AnnouncementRow[];
}

// 공지 조회수 증가
export async function incrementViewCount(id: string): Promise<void> {
  await supabase.rpc('increment_announcement_view', { p_id: id });
}

// 공지 추가
export async function createAnnouncement(title: string, content: string): Promise<void> {
  const { error } = await supabase
    .from('announcements')
    .insert({ title: title.trim(), content: content.trim(), is_active: true });
  if (error) throw error;
}

// 공지 활성/비활성 토글
export async function toggleAnnouncement(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('announcements')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// 공지 삭제
export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// 공지 내용 수정
export async function updateAnnouncement(id: string, title: string, content: string): Promise<void> {
  const { error } = await supabase
    .from('announcements')
    .update({ title: title.trim(), content: content.trim(), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
