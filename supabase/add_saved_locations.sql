-- ── 사용자 저장 위치 테이블 ──────────────────────────────────────
-- 현재위치 외 최대 4개 저장 (집, 근무지, 단골1, 단골2 등)

CREATE TABLE IF NOT EXISTS user_saved_locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,               -- '집', '근무지', '단골1' 등
  latitude      DOUBLE PRECISION NOT NULL,
  longitude     DOUBLE PRECISION NOT NULL,
  address_hint  TEXT,                        -- 역지오코딩 결과 (표시용)
  display_order INTEGER NOT NULL DEFAULT 0,  -- 정렬 순서
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, label)                    -- 같은 사용자에게 중복 이름 불가
);

CREATE INDEX IF NOT EXISTS idx_saved_locations_user ON user_saved_locations (user_id, display_order);

ALTER TABLE user_saved_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_loc_own" ON user_saved_locations
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

SELECT '저장 위치 테이블 생성 완료' AS result;
