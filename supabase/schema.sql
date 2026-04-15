-- ============================================================
-- 맛집픽 Supabase 전체 스키마 (push_tokens, push_history 포함)
-- Supabase Dashboard → SQL Editor → New Query → 전체 붙여넣기 → Run
-- ============================================================

-- ─── 1. users ────────────────────────────────────────────────
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  phone       text,
  instagram_id text,
  role        text not null default 'customer' check (role in ('customer', 'owner')),
  created_at  timestamptz not null default now()
);
alter table public.users enable row level security;
create policy "본인 조회" on public.users for select using (auth.uid() = id);
create policy "본인 수정" on public.users for update using (auth.uid() = id);

-- ─── 2. stores (가맹점) ──────────────────────────────────────
create table if not exists public.stores (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references public.users(id),
  name         text not null,
  description  text,
  address      text,
  phone        text,
  latitude     double precision,
  longitude    double precision,
  category     text default '한식',
  image_url    text,
  is_active    boolean default true,
  created_at   timestamptz not null default now()
);
alter table public.stores enable row level security;
create policy "가맹점 전체 조회" on public.stores for select using (true);
create policy "가맹점 등록" on public.stores for insert with check (true);
create policy "가맹점 수정" on public.stores for update using (true);

-- ─── 3. coupons ──────────────────────────────────────────────
create table if not exists public.coupons (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid references public.users(id),
  store_id       uuid references public.stores(id),
  title          text not null,
  description    text,
  discount_type  text not null check (discount_type in ('percent', 'amount')),
  discount_value integer not null,
  total_quantity integer not null default 100,
  issued_count   integer not null default 0,
  expires_at     timestamptz not null,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);
alter table public.coupons enable row level security;
create policy "쿠폰 전체 조회" on public.coupons for select using (true);
create policy "쿠폰 생성" on public.coupons for insert with check (true);
create policy "쿠폰 수정" on public.coupons for update using (true);

-- ─── 4. user_coupons ─────────────────────────────────────────
create table if not exists public.user_coupons (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id) on delete cascade,
  coupon_id   uuid references public.coupons(id) on delete cascade,
  status      text not null default 'available' check (status in ('available', 'used')),
  qr_token    text unique not null default gen_random_uuid()::text,
  received_at timestamptz not null default now(),
  used_at     timestamptz
);
alter table public.user_coupons enable row level security;
create policy "내 쿠폰 조회" on public.user_coupons for select using (auth.uid() = user_id);
create policy "쿠폰 수령" on public.user_coupons for insert with check (auth.uid() = user_id);
create policy "쿠폰 사용" on public.user_coupons for update using (true);

-- ─── 5. stamp_cards ──────────────────────────────────────────
create table if not exists public.stamp_cards (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.users(id) on delete cascade,
  store_id       uuid references public.stores(id),
  stamp_count    integer not null default 0,
  required_count integer not null default 10,
  created_at     timestamptz not null default now(),
  unique(user_id, store_id)
);
alter table public.stamp_cards enable row level security;
create policy "내 스탬프 조회" on public.stamp_cards for select using (auth.uid() = user_id);
create policy "스탬프 생성" on public.stamp_cards for insert with check (auth.uid() = user_id);
create policy "스탬프 수정" on public.stamp_cards for update using (true);

-- ─── 6. stamp_history ────────────────────────────────────────
create table if not exists public.stamp_history (
  id            uuid primary key default gen_random_uuid(),
  stamp_card_id uuid references public.stamp_cards(id) on delete cascade,
  stamped_at    timestamptz not null default now(),
  stamped_by    text
);
alter table public.stamp_history enable row level security;
create policy "스탬프 내역 조회" on public.stamp_history for select using (true);
create policy "스탬프 적립" on public.stamp_history for insert with check (true);

-- ─── 7. push_tokens ──────────────────────────────────────────
create table if not exists public.push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.users(id) on delete cascade unique,
  token      text not null,
  opt_in     boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
create policy "토큰 조회" on public.push_tokens for select using (true);
create policy "토큰 등록" on public.push_tokens for insert with check (true);
create policy "토큰 수정" on public.push_tokens for update using (true);

-- ─── 8. push_history ─────────────────────────────────────────
create table if not exists public.push_history (
  id           uuid primary key default gen_random_uuid(),
  sender_type  text not null check (sender_type in ('superadmin', 'owner')),
  sender_label text not null,
  title        text not null,
  body         text not null,
  sent_count   integer not null default 0,
  read_count   integer not null default 0,
  created_at   timestamptz not null default now()
);
alter table public.push_history enable row level security;
create policy "발송 히스토리 조회" on public.push_history for select using (true);
create policy "발송 히스토리 등록" on public.push_history for insert with check (true);
create policy "발송 히스토리 수정" on public.push_history for update using (true);

-- ─── 9. 읽음 수 증가 RPC 함수 ────────────────────────────────
create or replace function increment_push_read_count(history_id uuid)
returns void language plpgsql as $$
begin
  update public.push_history
  set read_count = read_count + 1
  where id = history_id;
end;
$$;

-- ─── 10. 테스트 가맹점 데이터 ────────────────────────────────
insert into public.stores
  (name, description, address, phone, latitude, longitude, category, is_active)
values
  ('우리동네 맛집 본점',   '40년 전통의 대표 맛집',    '서울시 마포구 합정동 123-4',  '02-1234-5678', 37.5500, 126.9100, '한식', true),
  ('우리동네 맛집 홍대점', '홍대 입구 핫플레이스',     '서울시 마포구 서교동 456-7',  '02-2345-6789', 37.5573, 126.9240, '한식', true),
  ('우리동네 맛집 강남점', '강남 직장인 단골 맛집',    '서울시 강남구 역삼동 789-1',  '02-3456-7890', 37.4979, 127.0276, '한식', true),
  ('우리동네 맛집 이태원점','이태원 글로벌 분위기',     '서울시 용산구 이태원동 234-5','02-4567-8901', 37.5340, 126.9940, '한식', true)
on conflict do nothing;
