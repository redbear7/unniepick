-- ================================================================
-- Phase 6: 학습 & 전파 엔진
-- store_music_profiles: 매장별 음악 DNA 프로필 집계
-- 실행: Supabase Dashboard > SQL Editor
-- 전제: generated_tracks.sql + store_playlists.sql 실행 완료
-- ================================================================

-- ── 1. store_music_profiles 테이블 ───────────────────────────────
CREATE TABLE IF NOT EXISTS store_music_profiles (
  store_id       UUID         PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  avg_embedding  vector(3),                    -- 좋아요 곡 평균 mood_vector
  top_tags       TEXT[]       DEFAULT '{}',    -- 빈도 top 20 태그
  liked_count    INT          NOT NULL DEFAULT 0,
  store_category TEXT,
  propagated_to  INT          NOT NULL DEFAULT 0,  -- 전파된 매장 수
  updated_at     TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_profiles_embedding
  ON store_music_profiles USING ivfflat (avg_embedding vector_cosine_ops)
  WITH (lists = 20);

CREATE INDEX IF NOT EXISTS idx_store_profiles_category
  ON store_music_profiles (store_category);

-- RLS
ALTER TABLE store_music_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_read"  ON store_music_profiles;
DROP POLICY IF EXISTS "profiles_admin" ON store_music_profiles;

CREATE POLICY "profiles_read" ON store_music_profiles
  FOR SELECT USING (TRUE);  -- 읽기는 공개 (유사 매장 추천용)

CREATE POLICY "profiles_admin" ON store_music_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  );

-- ── 2. 전파 이력 테이블 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS propagation_history (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  from_store_id UUID         NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  to_store_id   UUID         NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  track_ids     UUID[]       DEFAULT '{}',  -- 전파된 generated_tracks IDs
  similarity    FLOAT,
  propagated_at TIMESTAMPTZ  DEFAULT now(),
  UNIQUE(from_store_id, to_store_id)
);

ALTER TABLE propagation_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prop_history_admin" ON propagation_history
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  );

-- ── 3. 매장 프로필 재계산 함수 ───────────────────────────────────
CREATE OR REPLACE FUNCTION update_store_music_profile(p_store_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_category TEXT;
  v_count    INT;
  v_avg      vector(3);
  v_tags     TEXT[];
BEGIN
  -- 매장 카테고리
  SELECT category INTO v_category FROM stores WHERE id = p_store_id;

  -- 좋아요한 완료 트랙 수
  SELECT COUNT(*) INTO v_count
  FROM generated_tracks
  WHERE store_id = p_store_id
    AND confirm_status = 'liked'
    AND suno_status    = 'done';

  IF v_count = 0 THEN RETURN; END IF;

  -- 평균 mood_embedding
  SELECT AVG(mood_embedding) INTO v_avg
  FROM generated_tracks
  WHERE store_id        = p_store_id
    AND confirm_status  = 'liked'
    AND suno_status     = 'done'
    AND mood_embedding IS NOT NULL;

  -- 빈도 top 20 태그
  SELECT ARRAY_AGG(tag ORDER BY cnt DESC) INTO v_tags
  FROM (
    SELECT UNNEST(style_tags) AS tag, COUNT(*) AS cnt
    FROM generated_tracks
    WHERE store_id       = p_store_id
      AND confirm_status = 'liked'
    GROUP BY tag
    ORDER BY cnt DESC
    LIMIT 20
  ) sub;

  INSERT INTO store_music_profiles
    (store_id, avg_embedding, top_tags, liked_count, store_category, updated_at)
  VALUES
    (p_store_id, v_avg, COALESCE(v_tags, '{}'), v_count, v_category, now())
  ON CONFLICT (store_id) DO UPDATE SET
    avg_embedding  = EXCLUDED.avg_embedding,
    top_tags       = EXCLUDED.top_tags,
    liked_count    = EXCLUDED.liked_count,
    store_category = EXCLUDED.store_category,
    updated_at     = now();
END;
$$;

-- ── 4. 트랙 컨펌 시 자동 프로필 업데이트 트리거 ─────────────────
CREATE OR REPLACE FUNCTION trigger_profile_on_confirm()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.confirm_status = 'liked' AND OLD.confirm_status != 'liked' THEN
    PERFORM update_store_music_profile(NEW.store_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_update_store_profile ON generated_tracks;
CREATE TRIGGER auto_update_store_profile
  AFTER UPDATE ON generated_tracks
  FOR EACH ROW EXECUTE FUNCTION trigger_profile_on_confirm();

-- ── 5. 유사 매장 검색 RPC ────────────────────────────────────────
CREATE OR REPLACE FUNCTION find_similar_stores(
  p_store_id  UUID,
  p_category  TEXT    DEFAULT NULL,
  p_threshold FLOAT   DEFAULT 0.75,
  p_limit     INT     DEFAULT 5
)
RETURNS TABLE (
  store_id       UUID,
  store_name     TEXT,
  category       TEXT,
  similarity     FLOAT,
  liked_count    INT,
  top_tags       TEXT[],
  avg_embedding  vector(3)
)
LANGUAGE sql STABLE AS $$
  SELECT
    smp.store_id,
    s.name,
    s.category,
    1 - (smp.avg_embedding <=>
         (SELECT avg_embedding FROM store_music_profiles WHERE store_id = p_store_id)
        ) AS similarity,
    smp.liked_count,
    smp.top_tags,
    smp.avg_embedding
  FROM store_music_profiles smp
  JOIN stores s ON s.id = smp.store_id
  WHERE smp.store_id    != p_store_id
    AND smp.avg_embedding IS NOT NULL
    AND smp.liked_count   >= 3
    AND (p_category IS NULL OR s.category = p_category)
    AND 1 - (smp.avg_embedding <=>
             (SELECT avg_embedding FROM store_music_profiles WHERE store_id = p_store_id)
            ) >= p_threshold
  ORDER BY smp.avg_embedding <=>
           (SELECT avg_embedding FROM store_music_profiles WHERE store_id = p_store_id)
  LIMIT p_limit;
$$;

-- ── 6. 전체 매장 프로필 일괄 재계산 (관리자용) ──────────────────
CREATE OR REPLACE FUNCTION rebuild_all_store_profiles()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  v_store UUID;
  v_count INT := 0;
BEGIN
  FOR v_store IN
    SELECT DISTINCT store_id FROM generated_tracks WHERE confirm_status = 'liked'
  LOOP
    PERFORM update_store_music_profile(v_store);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
