-- ══════════════════════════════════════════════════════════════
--  coupon_comments — 사장님 전용 쿠폰 댓글
--  (모크업 v3 ② 공지피드 → 쿠폰 하단 댓글 블록)
-- ══════════════════════════════════════════════════════════════

create table if not exists coupon_comments (
  id          uuid primary key default gen_random_uuid(),
  coupon_id   uuid not null references coupons(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  store_id    uuid not null references stores(id) on delete cascade,
  content     text not null check (char_length(content) >= 1 and char_length(content) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 인덱스: 쿠폰별 댓글 조회 성능
create index if not exists coupon_comments_coupon_id_idx
  on coupon_comments (coupon_id, created_at desc);

-- updated_at 자동 갱신 트리거
create or replace function update_coupon_comment_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_coupon_comment_updated_at on coupon_comments;
create trigger trg_coupon_comment_updated_at
  before update on coupon_comments
  for each row execute function update_coupon_comment_updated_at();

-- ── Row Level Security ─────────────────────────────────────────
alter table coupon_comments enable row level security;

-- 전체 공개 읽기 (고객이 댓글 볼 수 있도록)
create policy "coupon_comments_public_read"
  on coupon_comments for select
  using (true);

-- 사장님만 자신의 가게 쿠폰에 댓글 추가 가능
create policy "coupon_comments_owner_insert"
  on coupon_comments for insert
  with check (auth.uid() = owner_id);

-- 작성자 본인만 수정 가능
create policy "coupon_comments_owner_update"
  on coupon_comments for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- 작성자 본인만 삭제 가능
create policy "coupon_comments_owner_delete"
  on coupon_comments for delete
  using (auth.uid() = owner_id);
