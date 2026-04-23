-- banners 테이블
create table if not exists public.banners (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  subtitle       text,
  image_url      text,
  link_url       text,
  bg_color       text default '#EEF2FF',
  is_active      boolean not null default true,
  display_order  integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- RLS
alter table public.banners enable row level security;
create policy "banners_read_all" on public.banners for select using (true);
create policy "banners_admin_all" on public.banners for all using (auth.role() = 'service_role');

-- 샘플 데이터
insert into public.banners (title, subtitle, bg_color, display_order)
values
  ('🎟 언니픽 오픈 이벤트!', '지금 팔로우하면 쿠폰 즉시 적립', '#FFF3EB', 0),
  ('📍 주변 가게 쿠폰 탐색', '내 위치 기반으로 혜택을 찾아보세요', '#EEF2FF', 1);

-- 배너 위치 타입 추가
alter table public.banners
  add column if not exists banner_type text not null default 'home_bottom';

-- 체크 제약
alter table public.banners
  add constraint banners_type_check check (
    banner_type in ('home_bottom', 'home_top', 'explore_top', 'coupon_top')
  );
