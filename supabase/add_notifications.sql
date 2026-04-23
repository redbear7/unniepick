-- ═══════════════════════════════════════════════════════════════
-- 언니픽 알림 시스템
-- ═══════════════════════════════════════════════════════════════

-- 1. 알림 목록 테이블
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        text        NOT NULL CHECK (type IN ('coupon','stamp','coin','expiry','nearby','event')),
  title       text        NOT NULL,
  body        text        NOT NULL,
  data        jsonb,
  is_read     boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at DESC);

-- 30일 지난 알림 자동 삭제 (RLS 없이 서버에서 cron 처리 or pg_cron)
-- 필요 시 Supabase Dashboard > Database > Scheduled Functions 에서 추가

-- 2. 알림 설정 테이블
CREATE TABLE IF NOT EXISTS notification_settings (
  user_id     uuid    PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  coupon      boolean NOT NULL DEFAULT true,
  stamp       boolean NOT NULL DEFAULT true,
  coin        boolean NOT NULL DEFAULT true,
  expiry      boolean NOT NULL DEFAULT true,
  nearby_fav  boolean NOT NULL DEFAULT true,
  nearby_new  boolean NOT NULL DEFAULT false,
  event       boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 3. RLS 설정
ALTER TABLE notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings  ENABLE ROW LEVEL SECURITY;

-- notifications: 본인 것만 읽기/삭제
CREATE POLICY "notif_select" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notif_update" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "notif_delete" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

-- 서버(service role)에서 INSERT 허용 (Edge Function 발송용)
CREATE POLICY "notif_insert_service" ON notifications
  FOR INSERT WITH CHECK (true);

-- notification_settings: 본인 것만
CREATE POLICY "notif_setting_all" ON notification_settings
  FOR ALL USING (auth.uid() = user_id);

-- 4. 테스트 데이터 (실행 후 삭제 가능)
-- INSERT INTO notifications (user_id, type, title, body)
-- VALUES (
--   (SELECT id FROM users LIMIT 1),
--   'coupon', '🎟 새 쿠폰 도착!', '[홀리베어버거] 수제버거 10% 할인 쿠폰이 도착했어요'
-- );

