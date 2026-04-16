-- profiles 테이블 (닉네임 중복 검사용)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nickname    text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- RLS
alter table public.profiles enable row level security;

-- 모든 사용자가 닉네임 존재 여부 조회 가능 (중복 검사)
create policy "profiles_read_all"
  on public.profiles for select using (true);

-- 본인만 insert/update
create policy "profiles_write_own"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);
