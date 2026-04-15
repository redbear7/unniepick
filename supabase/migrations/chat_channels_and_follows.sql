-- ══════════════════════════════════════════════════════════════
--  chat_channels — 가게당 1개 채팅 채널
--  channel_follows — 채널 팔로우 + 알림 설정
--  (Step 3 & 4: Realtime 채팅 기반)
-- ══════════════════════════════════════════════════════════════

-- ── 채팅 채널 ──────────────────────────────────────────────────
create table if not exists chat_channels (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null unique references stores(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists chat_channels_store_id_idx
  on chat_channels (store_id);

alter table chat_channels enable row level security;

-- 전체 공개 읽기
create policy "chat_channels_public_read"
  on chat_channels for select
  using (true);

-- 사장님(인증된 사용자)만 채널 생성 가능 — 실제로는 서버사이드에서 생성
create policy "chat_channels_auth_insert"
  on chat_channels for insert
  with check (auth.uid() is not null);


-- ── 채널 팔로우 ────────────────────────────────────────────────
create table if not exists channel_follows (
  id          uuid primary key default gen_random_uuid(),
  channel_id  uuid not null references chat_channels(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  notify      boolean not null default true,   -- 푸시 알림 수신 여부
  created_at  timestamptz not null default now(),

  unique (channel_id, user_id)   -- 중복 팔로우 방지
);

create index if not exists channel_follows_user_id_idx
  on channel_follows (user_id, created_at desc);

create index if not exists channel_follows_channel_id_idx
  on channel_follows (channel_id);

alter table channel_follows enable row level security;

-- 본인 팔로우 목록 읽기
create policy "channel_follows_self_read"
  on channel_follows for select
  using (auth.uid() = user_id);

-- 본인이 직접 팔로우
create policy "channel_follows_self_insert"
  on channel_follows for insert
  with check (auth.uid() = user_id);

-- 알림 설정 변경
create policy "channel_follows_self_update"
  on channel_follows for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 언팔로우
create policy "channel_follows_self_delete"
  on channel_follows for delete
  using (auth.uid() = user_id);


-- ── 팔로워 수 집계 뷰 (채널별) ────────────────────────────────
create or replace view channel_follower_counts as
  select channel_id, count(*) as follower_count
  from channel_follows
  group by channel_id;
