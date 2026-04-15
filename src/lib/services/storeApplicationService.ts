import { supabase } from '../supabase';
import { notifyAdmin } from './pushService';

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface StoreApplicationRow {
  id: string;
  store_name: string;
  category: string;
  description?: string;
  address: string;
  phone: string;
  latitude?: number;
  longitude?: number;
  owner_name: string;
  owner_phone: string;
  owner_email?: string;
  message?: string;
  status: ApplicationStatus;
  admin_note?: string;
  reviewed_at?: string;
  store_id?: string;
  created_at: string;
  // 신규 필드
  instagram_url?: string;
  naver_place_url?: string;
  postcode?: string;
  address_detail?: string;
}

export interface StoreApplicationInput {
  store_name: string;
  category: string;
  description?: string;
  address: string;
  phone: string;
  latitude?: number;
  longitude?: number;
  owner_name: string;
  owner_phone: string;
  owner_email?: string;
  message?: string;
  // 신규 필드
  instagram_url?: string;
  naver_place_url?: string;
  postcode?: string;
  address_detail?: string;
}

// ─── 신청 등록 ───────────────────────────────────
export async function submitStoreApplication(
  input: StoreApplicationInput
): Promise<StoreApplicationRow> {
  const { data, error } = await supabase
    .from('store_applications')
    .insert({ ...input, status: 'pending' })
    .select()
    .single();
  if (error) throw error;

  // 시샵에게 가게 등록 신청 알림 (best-effort)
  notifyAdmin(
    '🏪 가게 등록 신청이 들어왔어요!',
    `"${input.store_name}" (${input.category}) · 신청자: ${input.owner_name}`,
    { type: 'store_application', applicationId: data.id },
  ).catch(() => {});

  return data;
}

// ─── 전체 신청 목록 조회 (최고관리자용) ──────────
export async function fetchAllApplications(
  status?: ApplicationStatus
): Promise<StoreApplicationRow[]> {
  let query = supabase
    .from('store_applications')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ─── 신청 건수 요약 ───────────────────────────────
export async function fetchApplicationStats(): Promise<{
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}> {
  const { data, error } = await supabase
    .from('store_applications')
    .select('status');
  if (error) throw error;

  const rows = data ?? [];
  return {
    pending:  rows.filter((r: { status: string }) => r.status === 'pending').length,
    approved: rows.filter((r: { status: string }) => r.status === 'approved').length,
    rejected: rows.filter((r: { status: string }) => r.status === 'rejected').length,
    total: rows.length,
  };
}

// ─── 승인 처리 → stores 테이블에 자동 등록 ────────
export async function approveApplication(
  appId: string,
  app: StoreApplicationRow,
  adminNote?: string,
  districtId?: string
): Promise<void> {
  // 1) stores 테이블에 가맹점 등록
  const { data: store, error: storeErr } = await supabase
    .from('stores')
    .insert({
      name:             app.store_name,
      category:         app.category,
      description:      app.description,
      address:          app.address,
      phone:            app.phone,
      latitude:         app.latitude,
      longitude:        app.longitude,
      is_active:        true,
      district_id:      districtId ?? null,
      instagram_url:    app.instagram_url ?? null,
      naver_place_url:  app.naver_place_url ?? null,
      postcode:         app.postcode ?? null,
      address_detail:   app.address_detail ?? null,
    })
    .select('id')
    .single();

  if (storeErr) throw storeErr;

  // 2) 신청 상태 → approved
  const { error } = await supabase
    .from('store_applications')
    .update({
      status:      'approved',
      store_id:    store.id,
      admin_note:  adminNote ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', appId);

  if (error) throw error;
}

// ─── 보류/반려 처리 ───────────────────────────────
export async function rejectApplication(
  appId: string,
  adminNote?: string
): Promise<void> {
  const { error } = await supabase
    .from('store_applications')
    .update({
      status:      'rejected',
      admin_note:  adminNote ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', appId);
  if (error) throw error;
}

// ─── 보류로 되돌리기 ─────────────────────────────
export async function pendingApplication(appId: string): Promise<void> {
  const { error } = await supabase
    .from('store_applications')
    .update({ status: 'pending', reviewed_at: null, admin_note: null })
    .eq('id', appId);
  if (error) throw error;
}
