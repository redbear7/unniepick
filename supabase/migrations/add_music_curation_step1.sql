-- ================================================================
-- 뮤직 큐레이션 Step 1 — playlists 테이블 없이 실행 가능한 부분
-- ================================================================

-- ── 1. music_tracks 컬럼 추가 ──────────────────────────────────
ALTER TABLE music_tracks
  ADD COLUMN IF NOT EXISTS bpm          INT,
  ADD COLUMN IF NOT EXISTS energy_level TEXT CHECK (energy_level IN ('low','medium','high')),
  ADD COLUMN IF NOT EXISTS time_tags    TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mood_tags    TEXT[] DEFAULT '{}';

-- 기존 mood 단일 값 → mood_tags 배열로 마이그레이션
UPDATE music_tracks
SET mood_tags = ARRAY[mood]
WHERE mood IS NOT NULL
  AND (mood_tags IS NULL OR array_length(mood_tags, 1) IS NULL);

-- ── 2. stores 테이블: 음악 DNA 컬럼 추가 ──────────────────────
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS music_dna    JSONB,
  ADD COLUMN IF NOT EXISTS youtube_mood JSONB;

-- ── 3. 음악 좋아요 테이블 ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS music_likes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id      UUID        NOT NULL REFERENCES music_tracks(id) ON DELETE CASCADE,
  store_id      UUID        REFERENCES stores(id) ON DELETE SET NULL,
  time_of_day   TEXT,
  weather       TEXT,
  play_duration INT,
  liked_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, track_id)
);

-- ── 4. 사용자 음악 취향 프로필 ────────────────────────────────
CREATE TABLE IF NOT EXISTS user_music_profiles (
  user_id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_moods TEXT[]      DEFAULT '{}',
  avoided_moods   TEXT[]      DEFAULT '{}',
  bpm_min         INT         DEFAULT 70,
  bpm_max         INT         DEFAULT 130,
  youtube_linked  BOOLEAN     DEFAULT FALSE,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. RLS ────────────────────────────────────────────────────
ALTER TABLE music_likes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_music_profiles   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "music_likes_self" ON music_likes;
CREATE POLICY "music_likes_self" ON music_likes
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_music_profiles_self" ON user_music_profiles;
CREATE POLICY "user_music_profiles_self" ON user_music_profiles
  FOR ALL USING (auth.uid() = user_id);

-- ── 6. 인덱스 ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_music_tracks_mood_tags ON music_tracks USING GIN (mood_tags);
CREATE INDEX IF NOT EXISTS idx_music_tracks_time_tags ON music_tracks USING GIN (time_tags);

-- ── 7. toggle_music_like RPC ──────────────────────────────────
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
