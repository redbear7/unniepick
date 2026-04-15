import { supabase } from '../supabase';

export interface DistrictRow {
  id: string;
  name: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  is_active: boolean;
  created_at: string;
  store_count?: number; // 조회 시 집계
}

export interface DistrictInput {
  name: string;
  description?: string;
  latitude?: number;
  longitude?: number;
}

// ─── 전체 상권 목록 조회 ──────────────────────────
export async function fetchDistricts(): Promise<DistrictRow[]> {
  const { data, error } = await supabase
    .from('districts')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ─── 상권별 가게 수 집계 ──────────────────────────
export async function fetchDistrictStats(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('stores')
    .select('district_id')
    .not('district_id', 'is', null);
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    if (row.district_id) {
      counts[row.district_id] = (counts[row.district_id] ?? 0) + 1;
    }
  }
  return counts;
}

// ─── 상권 등록 ────────────────────────────────────
export async function createDistrict(input: DistrictInput): Promise<DistrictRow> {
  const { data, error } = await supabase
    .from('districts')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── 상권 수정 ────────────────────────────────────
export async function updateDistrict(
  id: string,
  input: Partial<DistrictInput & { is_active: boolean }>
): Promise<void> {
  const { error } = await supabase
    .from('districts')
    .update(input)
    .eq('id', id);
  if (error) throw error;
}
