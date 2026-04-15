-- ================================================================
-- 뮤직 큐레이션 Phase 1 마이그레이션
-- 실행: Supabase Dashboard > SQL Editor 에서 실행
-- ================================================================

-- ── 1. music_tracks 컬럼 추가 ──────────────────────────────────
ALTER TABLE music_tracks
  ADD COLUMN IF NOT EXISTS bpm          INT,
  ADD COLUMN IF NOT EXISTS energy_level TEXT CHECK (energy_level IN ('low','medium','high')),
  ADD COLUMN IF NOT EXISTS time_tags    TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mood_tags    TEXT[] DEFAULT '{}';

-- mood 컬럼(기존 단일 문자열)을 mood_tags 배열로 마이그레이션
UPDATE music_tracks
SET mood_tags = ARRAY[mood]
WHERE mood IS NOT NULL AND array_length(mood_tags, 1) IS NULL;

-- ── 2. playlists 테이블 확장 ───────────────────────────────────
ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS is_curated    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_dynamic    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mood_tags     TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS time_tags     TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS weather_tags  TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS category_tags TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS curator_note  TEXT,
  ADD COLUMN IF NOT EXISTS curated_at    TIMESTAMPTZ;

-- ── 3. stores 테이블: 음악 DNA 컬럼 추가 ──────────────────────
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS music_dna    JSONB,
  ADD COLUMN IF NOT EXISTS youtube_mood JSONB;

-- ── 4. store_posts: 플레이리스트 연동 ─────────────────────────
ALTER TABLE store_posts
  ADD COLUMN IF NOT EXISTS linked_playlist_id UUID REFERENCES playlists(id) ON DELETE SET NULL;

-- ── 5. 음악 좋아요 테이블 ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS music_likes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id      UUID        NOT NULL REFERENCES music_tracks(id) ON DELETE CASCADE,
  store_id      UUID        REFERENCES stores(id) ON DELETE SET NULL,
  time_of_day   TEXT,       -- 'morning' | 'afternoon' | 'evening' | 'night'
  weather       TEXT,       -- 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'cold'
  play_duration INT,        -- 좋아요 누를 때까지 재생한 초
  liked_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, track_id)
);

-- ── 6. 사용자 음악 취향 프로필 ────────────────────────────────
CREATE TABLE IF NOT EXISTS user_music_profiles (
  user_id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_moods TEXT[]      DEFAULT '{}',
  avoided_moods   TEXT[]      DEFAULT '{}',
  bpm_min         INT         DEFAULT 70,
  bpm_max         INT         DEFAULT 130,
  youtube_linked  BOOLEAN     DEFAULT FALSE,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. RLS 설정 ───────────────────────────────────────────────
ALTER TABLE music_likes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_music_profiles   ENABLE ROW LEVEL SECURITY;

-- music_likes: 본인만 조회/삽입/삭제
DROP POLICY IF EXISTS "music_likes_self" ON music_likes;
CREATE POLICY "music_likes_self" ON music_likes
  FOR ALL USING (auth.uid() = user_id);

-- user_music_profiles: 본인만 조회/수정
DROP POLICY IF EXISTS "user_music_profiles_self" ON user_music_profiles;
CREATE POLICY "user_music_profiles_self" ON user_music_profiles
  FOR ALL USING (auth.uid() = user_id);

-- ── 8. mood_tags 검색 인덱스 ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_music_tracks_mood_tags   ON music_tracks   USING GIN (mood_tags);
CREATE INDEX IF NOT EXISTS idx_music_tracks_time_tags   ON music_tracks   USING GIN (time_tags);
CREATE INDEX IF NOT EXISTS idx_playlists_mood_tags      ON playlists      USING GIN (mood_tags);
CREATE INDEX IF NOT EXISTS idx_playlists_is_curated     ON playlists      (is_curated) WHERE is_curated = TRUE;

-- ── 9. toggle_music_like RPC ──────────────────────────────────
CREATE OR REPLACE FUNCTION toggle_music_like(
  p_track_id UUID,
  p_store_id UUID DEFAULT NULL,
  p_time_of_day TEXT DEFAULT NULL,
  p_weather TEXT DEFAULT NULL,
  p_play_duration INT DEFAULT NULL
)
RETURNS TABLE(is_liked BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user UUID := auth.uid();
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM music_likes WHERE user_id = v_user AND track_id = p_track_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM music_likes WHERE user_id = v_user AND track_id = p_track_id;
    RETURN QUERY SELECT FALSE AS is_liked;
  ELSE
    INSERT INTO music_likes (user_id, track_id, store_id, time_of_day, weather, play_duration)
    VALUES (v_user, p_track_id, p_store_id, p_time_of_day, p_weather, p_play_duration)
    ON CONFLICT (user_id, track_id) DO NOTHING;
    RETURN QUERY SELECT TRUE AS is_liked;
  END IF;
END;
$$;

-- ── 10. 샘플 시샵 큐레이션 플레이리스트 시드 ─────────────────
-- (playlists 테이블이 있고 owner_id 컬럼이 없는 경우 조정 필요)
-- INSERT INTO playlists (name, mood_tags, cover_emoji, is_curated, curator_note, curated_at, time_tags, weather_tags, category_tags)
-- VALUES
--   ('비 오는 날 재즈', ARRAY['jazz','rainy','lo-fi'], '🌧', TRUE, '비 오는 날엔 재즈', NOW(), ARRAY['afternoon','evening'], ARRAY['rainy'], ARRAY['cafe','bar']),
--   ('모닝 루틴', ARRAY['morning','acoustic','fresh'], '🌅', TRUE, '상쾌한 아침 시작', NOW(), ARRAY['morning'], ARRAY['sunny','cloudy'], ARRAY['cafe','all']),
--   ('저녁 감성', ARRAY['chill','indie','evening'], '🌙', TRUE, '퇴근 후 감성', NOW(), ARRAY['evening','night'], ARRAY['sunny','cloudy'], ARRAY['cafe','restaurant']);
