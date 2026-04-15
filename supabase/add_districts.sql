-- ============================================================
-- 상권(Districts) 테이블 추가 + stores에 district_id 컬럼
-- Supabase Dashboard → SQL Editor → New Query → 실행
-- ============================================================

-- 1) 상권 테이블 생성
create table if not exists public.districts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  latitude    double precision,
  longitude   double precision,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.districts enable row level security;
drop policy if exists "상권 전체 조회" on public.districts;
drop policy if exists "상권 등록"     on public.districts;
drop policy if exists "상권 수정"     on public.districts;
create policy "상권 전체 조회" on public.districts for select using (true);
create policy "상권 등록"     on public.districts for insert with check (true);
create policy "상권 수정"     on public.districts for update using (true);

-- 2) stores 테이블에 district_id 컬럼 추가
alter table public.stores
  add column if not exists district_id uuid references public.districts(id);

-- 3) 샘플 상권 2곳 등록 (창원 상남동 / 봉곡동)
insert into public.districts (name, description, latitude, longitude)
values
  ('상남동', '창원 상남동 먹자골목 상권', 35.2234, 128.6816),
  ('봉곡동', '창원 봉곡동 상권',         35.2456, 128.6512)
on conflict (name) do nothing;
