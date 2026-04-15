-- ================================================================
-- 뮤직 큐레이션 Step 2 — playlists 테이블 생성 후 실행
-- (Step 1 완료 후 실행할 것)
-- ================================================================

-- ── 1. playlists 테이블 생성 (없는 경우) ──────────────────────
CREATE TABLE IF NOT EXISTS playlists (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  description   TEXT,
  cover_emoji   TEXT,
  is_active     BOOLEAN     DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. playlists 컬럼 추가 (큐레이션용) ───────────────────────
ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS is_curated    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_dynamic    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mood_tags     TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS time_tags     TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS weather_tags  TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS category_tags TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS curator_note  TEXT,
  ADD COLUMN IF NOT EXISTS track_count   INT     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS curated_at    TIMESTAMPTZ;

-- ── 3. store_posts: 플레이리스트 연동 ─────────────────────────
ALTER TABLE store_posts
  ADD COLUMN IF NOT EXISTS linked_playlist_id UUID REFERENCES playlists(id) ON DELETE SET NULL;

-- ── 4. 인덱스 ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_playlists_mood_tags  ON playlists USING GIN (mood_tags);
CREATE INDEX IF NOT EXISTS idx_playlists_is_curated ON playlists (is_curated) WHERE is_curated = TRUE;

-- ── 5. 시샵 큐레이션 샘플 데이터 ─────────────────────────────
INSERT INTO playlists (name, cover_emoji, is_curated, is_dynamic, mood_tags, time_tags, weather_tags, category_tags, curator_note, track_count, curated_at)
VALUES
  ('비 오는 날 재즈',    '🌧', TRUE, FALSE, ARRAY['jazz','rainy','lo-fi','cozy'],         ARRAY['afternoon','evening'],         ARRAY['rainy'],          ARRAY['cafe','bar'],        '비 내리는 창가에서 듣기 좋은 재즈',    0, NOW()),
  ('모닝 루틴',          '🌅', TRUE, FALSE, ARRAY['morning','acoustic','fresh','bright'],   ARRAY['morning'],                     ARRAY['sunny','cloudy'], ARRAY['cafe','all'],        '상쾌한 아침을 여는 음악',              0, NOW()),
  ('저녁 감성',          '🌙', TRUE, FALSE, ARRAY['chill','indie','evening','mellow'],      ARRAY['evening','night'],             ARRAY['sunny','cloudy'], ARRAY['cafe','restaurant'], '퇴근 후 감성을 채워주는 플레이리스트', 0, NOW()),
  ('카페 집중 모드',     '☕', TRUE, TRUE,  ARRAY['lo-fi','study','chill','focus'],         ARRAY['morning','afternoon'],         ARRAY['cloudy','rainy'], ARRAY['cafe'],              'AI가 lo-fi 트랙을 즉석 구성',         0, NOW()),
  ('여름 바이브',        '☀️', TRUE, TRUE,  ARRAY['upbeat','tropical','summer','bright'],   ARRAY['afternoon'],                   ARRAY['hot','sunny'],    ARRAY['all'],               '더운 날 에너지 올려주는 AI 큐레이션', 0, NOW()),
  ('뷰티샵 트렌디',      '💅', TRUE, FALSE, ARRAY['k-pop','trendy','pop','upbeat'],         ARRAY['morning','afternoon','evening'], ARRAY['sunny','cloudy'], ARRAY['beauty'],           '뷰티샵 필수 BGM 모음',                0, NOW())
ON CONFLICT DO NOTHING;
