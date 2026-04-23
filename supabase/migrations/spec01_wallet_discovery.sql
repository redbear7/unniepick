-- ═══════════════════════════════════════════════════════════════
-- Spec 01 · 지갑 자동 발견 — DB 마이그레이션
-- ═══════════════════════════════════════════════════════════════

-- 0. PostGIS 활성화
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. stores 테이블에 지리 정보 필드 추가
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS geo_point        GEOGRAPHY(POINT, 4326),
  ADD COLUMN IF NOT EXISTS geo_discoverable BOOLEAN  DEFAULT true,
  ADD COLUMN IF NOT EXISTS category_key     VARCHAR(20);

-- 기존 latitude/longitude → geo_point 마이그레이션
UPDATE stores
SET geo_point = ST_SetSRID(ST_MakePoint(longitude::double precision, latitude::double precision), 4326)::geography
WHERE geo_point IS NULL
  AND latitude  IS NOT NULL
  AND longitude IS NOT NULL;

-- 공간 인덱스
CREATE INDEX IF NOT EXISTS idx_stores_geo ON stores USING GIST (geo_point);

-- 2. 사용자별 자동 발견 설정
CREATE TABLE IF NOT EXISTS user_location_setting (
  user_id       UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled       BOOLEAN     DEFAULT true,
  radius_m      INT         DEFAULT 500,
  daily_cap     SMALLINT    DEFAULT 3,
  quiet_start   TIME        DEFAULT '22:00',
  quiet_end     TIME        DEFAULT '09:00',
  enabled_cats  TEXT[],
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- 3. Live Activity 이벤트 로그
--    coupon_id nullable (진입 시점엔 특정 쿠폰 없을 수 있음)
--    user_coupon_id: 특정 user_coupon 연결
--    payload: 유연한 메타데이터 (JSONB)
CREATE TABLE IF NOT EXISTS live_activity_event (
  id             BIGSERIAL   PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id       UUID        NOT NULL,
  user_coupon_id UUID,
  event_type     VARCHAR(24),
  payload        JSONB,
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lae_user_day
  ON live_activity_event(user_id, created_at DESC);

-- 4. 쿠폰 사용 토큰 로그 (재사용·멱등성 방지)
--    token_key = "${coupon_id}:${user_id}:${window}"  UNIQUE WHERE success
CREATE TABLE IF NOT EXISTS redeem_token_log (
  id             BIGSERIAL   PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_coupon_id UUID        NOT NULL,
  coupon_id      UUID        NOT NULL,
  token_key      TEXT        NOT NULL,
  status         VARCHAR(16) DEFAULT 'success',
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- 동일 token_key 성공 2번 불가 (멱등성)
CREATE UNIQUE INDEX IF NOT EXISTS ux_rtl_token_success
  ON redeem_token_log(token_key)
  WHERE status = 'success';

CREATE INDEX IF NOT EXISTS idx_rtl_user ON redeem_token_log(user_id, created_at DESC);

-- 5. profiles 테이블에 push token 컬럼 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- 6. RLS 정책
ALTER TABLE user_location_setting ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS uls_owner ON user_location_setting;
CREATE POLICY uls_owner ON user_location_setting
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE live_activity_event ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lae_owner ON live_activity_event;
CREATE POLICY lae_owner ON live_activity_event
  USING (user_id = auth.uid());

ALTER TABLE redeem_token_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rtl_owner ON redeem_token_log;
CREATE POLICY rtl_owner ON redeem_token_log
  USING (user_id = auth.uid());

-- 7. PostGIS 기반 근처 쿠폰 조회 함수
CREATE OR REPLACE FUNCTION get_nearby_wallet_coupons(
  p_user_id  UUID,
  p_lat      DOUBLE PRECISION,
  p_lng      DOUBLE PRECISION,
  p_radius_m INT DEFAULT 500
)
RETURNS TABLE (
  coupon_id      UUID,
  user_coupon_id UUID,
  title          TEXT,
  coupon_kind    TEXT,
  discount_type  TEXT,
  discount_value NUMERIC,
  expires_at     TIMESTAMPTZ,
  days_left      INT,
  store_id       UUID,
  store_name     TEXT,
  store_category TEXT,
  distance_m     INT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id                   AS coupon_id,
    uc.id                  AS user_coupon_id,
    c.title,
    c.coupon_kind,
    c.discount_type,
    c.discount_value,
    c.expires_at,
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (c.expires_at - now())) / 86400))::INT AS days_left,
    s.id                   AS store_id,
    s.name                 AS store_name,
    COALESCE(s.category_key, s.category) AS store_category,
    ST_Distance(
      s.geo_point,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    )::INT                 AS distance_m
  FROM user_coupons uc
  JOIN coupons       c  ON c.id  = uc.coupon_id
  JOIN stores        s  ON s.id  = c.store_id
  WHERE uc.user_id   = p_user_id
    AND uc.status    IN ('available', 'issued', 'active')
    AND c.is_active   = true
    AND c.expires_at  > now()
    AND s.geo_point IS NOT NULL
    AND ST_DWithin(
      s.geo_point,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
  ORDER BY distance_m ASC, days_left ASC;
$$;

-- 8. 전체 쿠폰 조회 함수 (거리 포함)
--    user_coupons 실제 컬럼: used_at (redeemed_at 아님)
--    출력은 redeemed_at 으로 alias → TS 인터페이스 유지
CREATE OR REPLACE FUNCTION get_wallet_coupons_with_distance(
  p_user_id  UUID,
  p_lat      DOUBLE PRECISION,
  p_lng      DOUBLE PRECISION
)
RETURNS TABLE (
  coupon_id      UUID,
  user_coupon_id UUID,
  status         TEXT,
  title          TEXT,
  coupon_kind    TEXT,
  discount_type  TEXT,
  discount_value NUMERIC,
  expires_at     TIMESTAMPTZ,
  redeemed_at    TIMESTAMPTZ,   -- used_at alias
  days_left      INT,
  store_id       UUID,
  store_name     TEXT,
  store_category TEXT,
  distance_m     INT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id                   AS coupon_id,
    uc.id                  AS user_coupon_id,
    uc.status,
    c.title,
    c.coupon_kind,
    c.discount_type,
    c.discount_value,
    c.expires_at,
    uc.used_at             AS redeemed_at,   -- 실제 컬럼명: used_at
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (c.expires_at - now())) / 86400))::INT AS days_left,
    s.id                   AS store_id,
    s.name                 AS store_name,
    COALESCE(s.category_key, s.category)    AS store_category,
    CASE
      WHEN s.geo_point IS NOT NULL THEN
        ST_Distance(
          s.geo_point,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
        )::INT
      ELSE NULL
    END                    AS distance_m
  FROM user_coupons uc
  JOIN coupons c ON c.id = uc.coupon_id
  JOIN stores  s ON s.id = c.store_id
  WHERE uc.user_id = p_user_id
  ORDER BY
    CASE uc.status
      WHEN 'available' THEN 0 WHEN 'active' THEN 0 WHEN 'issued' THEN 0
      WHEN 'redeemed' THEN 1 WHEN 'used' THEN 1
      ELSE 2
    END,
    days_left ASC NULLS LAST;
$$;
