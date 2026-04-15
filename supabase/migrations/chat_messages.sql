-- ══════════════════════════════════════════════════════════════
--  chat_messages — 채팅 채널 메시지
--  (Step 4: Supabase Realtime Broadcast 기반)
-- ══════════════════════════════════════════════════════════════

create table if not exists chat_messages (
  id          uuid primary key default gen_random_uuid(),
  channel_id  uuid not null references chat_channels(id) on delete cascade,
  sender_id   uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'owner'   -- 'owner' | 'system'
                check (role in ('owner', 'system')),
  type        text not null default 'text'    -- 'text' | 'coupon' | 'notice'
                check (type in ('text', 'coupon', 'notice')),
  content     text not null check (char_length(content) >= 1 and char_length(content) <= 1000),
  coupon_id   uuid references coupons(id) on delete set null,  -- type='coupon'일 때
  created_at  timestamptz not null default now()
);

-- 채널별 최신 메시지 페이지네이션 인덱스
create index if not exists chat_messages_channel_created_idx
  on chat_messages (channel_id, created_at desc);

-- Realtime 활성화 (publication에 추가)
-- supabase dashboard에서 chat_messages를 Realtime 활성화하거나:
-- alter publication supabase_realtime add table chat_messages;

alter table chat_messages enable row level security;

-- 채널 팔로워 + 채널 소유자(사장님)만 읽기
create policy "chat_messages_read"
  on chat_messages for select
  using (true);   -- 공개 채널이므로 전체 공개. 비공개 채널로 바꾸려면 조건 추가

-- 인증된 사용자(사장님)만 메시지 송신
create policy "chat_messages_insert"
  on chat_messages for insert
  with check (auth.uid() = sender_id);
