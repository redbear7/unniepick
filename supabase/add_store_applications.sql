-- ============================================================
-- 사장님 가입신청 테이블 추가
-- Supabase Dashboard → SQL Editor → New Query → 실행
-- ============================================================

create table if not exists public.store_applications (
  id            uuid primary key default gen_random_uuid(),
  -- 가게 정보
  store_name    text not null,
  category      text not null default '한식',
  description   text,
  address       text not null,
  phone         text not null,
  latitude      double precision,
  longitude     double precision,
  -- 신청자 정보
  owner_name    text not null,
  owner_phone   text not null,
  owner_email   text,
  message       text,            -- 사장님이 남기는 한마디
  -- 상태 관리
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected')),
  admin_note    text,            -- 최고관리자 메모
  reviewed_at   timestamptz,
  -- 승인 시 생성된 store_id
  store_id      uuid references public.stores(id),
  created_at    timestamptz not null default now()
);

alter table public.store_applications enable row level security;
drop policy if exists "신청 전체 조회" on public.store_applications;
drop policy if exists "신청 등록"     on public.store_applications;
drop policy if exists "신청 수정"     on public.store_applications;
create policy "신청 전체 조회" on public.store_applications for select using (true);
create policy "신청 등록"     on public.store_applications for insert with check (true);
create policy "신청 수정"     on public.store_applications for update using (true);
