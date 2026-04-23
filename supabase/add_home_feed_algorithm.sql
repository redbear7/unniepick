-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  언니픽 홈 피드 알고리즘 v1
--  실행 순서: 1) 테이블 → 2) RPC
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ── 1. 사용자 취향 테이블 ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,
  score       INTEGER NOT NULL DEFAULT 0,
  interaction INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, category)
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_preferences" ON user_preferences;
CREATE POLICY "own_preferences" ON user_preferences
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_preferences_user_id_idx
  ON user_preferences(user_id);

-- ── 2. 행동 이벤트 로그 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  coupon_id   UUID REFERENCES coupons(id) ON DELETE SET NULL,
  store_id    UUID REFERENCES stores(id) ON DELETE SET NULL,
  category    TEXT,
  score_delta INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_events" ON user_events;
CREATE POLICY "own_events" ON user_events
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_events_user_id_idx
  ON user_events(user_id, created_at DESC);

-- ── 3. 홈 피드 쿠폰 RPC ──────────────────────────────────────────
-- 위치 기반 활성 쿠폰 조회 (거리 포함)
CREATE OR REPLACE FUNCTION get_home_feed_coupons(
  user_lat        FLOAT,
  user_lng        FLOAT,
  radius_km       FLOAT DEFAULT 5,
  category_filter TEXT  DEFAULT NULL,
  max_count       INT   DEFAULT 80
)
RETURNS TABLE (
  id             UUID,
  store_id       UUID,
  store_name     TEXT,
  store_category TEXT,
  coupon_kind    TEXT,
  title          TEXT,
  description    TEXT,
  discount_type  TEXT,
  discount_value NUMERIC,
  total_quantity INT,
  issued_count   INT,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ,
  pick_count     INT,
  click_count    INT,
  distance_km    FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id,
    c.store_id,
    s.name            AS store_name,
    s.category        AS store_category,
    c.coupon_kind::TEXT,
    c.title,
    c.description,
    c.discount_type::TEXT,
    c.discount_value,
    c.total_quantity,
    c.issued_count,
    c.expires_at,
    c.created_at,
    COALESCE(c.pick_count, 0)  AS pick_count,
    COALESCE(c.click_count, 0) AS click_count,
    -- 하버사인 거리 (km)
    (
      6371 * acos(
        LEAST(1.0,
          cos(radians(user_lat)) * cos(radians(s.latitude))
          * cos(radians(s.longitude) - radians(user_lng))
          + sin(radians(user_lat)) * sin(radians(s.latitude))
        )
      )
    ) AS distance_km
  FROM coupons c
  INNER JOIN stores s ON s.id = c.store_id
  WHERE
    c.is_active = TRUE
    AND c.expires_at > NOW()
    AND (c.total_quantity IS NULL OR c.issued_count < c.total_quantity)
    AND s.latitude  IS NOT NULL
    AND s.longitude IS NOT NULL
    -- 반경 필터 (9999 = 전체)
    AND (
      radius_km >= 9999
      OR (
        6371 * acos(
          LEAST(1.0,
            cos(radians(user_lat)) * cos(radians(s.latitude))
            * cos(radians(s.longitude) - radians(user_lng))
            + sin(radians(user_lat)) * sin(radians(s.latitude))
          )
        )
      ) <= radius_km
    )
    -- 카테고리 필터
    AND (category_filter IS NULL OR s.category = category_filter)
  ORDER BY c.created_at DESC
  LIMIT max_count;
$$;

-- ── 4. 취향 일괄 집계 함수 (선택적 배치 잡용) ───────────────────
-- 각 유저의 최근 30일 이벤트로 user_preferences 갱신
CREATE OR REPLACE FUNCTION refresh_user_preferences(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- 기존 삭제 후 재집계
  DELETE FROM user_preferences WHERE user_id = target_user_id;

  INSERT INTO user_preferences (user_id, category, score, interaction)
  SELECT
    user_id,
    category,
    SUM(score_delta)  AS score,
    COUNT(*)           AS interaction
  FROM user_events
  WHERE
    user_id    = target_user_id
    AND category IS NOT NULL
    AND created_at > NOW() - INTERVAL '30 days'
  GROUP BY user_id, category
  ON CONFLICT (user_id, category) DO UPDATE
    SET score       = EXCLUDED.score,
        interaction = EXCLUDED.interaction,
        updated_at  = NOW();
END;
$$;

-- ── 코멘트 ────────────────────────────────────────────────────────
COMMENT ON TABLE user_preferences IS
  '사용자 카테고리별 취향 점수. feedService.ts의 getCategoryScoreMap()에서 참조.';

COMMENT ON TABLE user_events IS
  '행동 시그널 로그. userPreferenceService.ts의 trackEvent()에서 INSERT.
   event_type: coupon_used(+10) | coupon_saved(+5) | store_followed(+5)
              | store_viewed(+2) | coupon_read(+1) | category_tapped(+1)
              | coupon_scrolled(-1) | store_unfollowed(-3)';

COMMENT ON FUNCTION get_home_feed_coupons IS
  '홈 피드용 위치기반 활성 쿠폰 조회.
   feedService.ts의 fetchActiveCoupons()에서 호출.
   클라이언트에서 Z1/Z2/Z3 존 분류 및 스코어링 수행.';
