-- ================================================================
-- Phase 3: pgvector 유사 곡 매칭 엔진
-- 실행: Supabase Dashboard > SQL Editor
-- ================================================================

-- ── 1. pgvector 익스텐션 활성화 ──────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── 2. generated_tracks 테이블 ───────────────────────────────────
CREATE TABLE IF NOT EXISTS generated_tracks (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID         NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  reference_id    UUID         REFERENCES music_references(id) ON DELETE SET NULL,

  -- Suno 생성 결과
  suno_id         TEXT,
  title           TEXT,
  style_prompt    TEXT,                          -- Suno 에 넘긴 프롬프트
  style_tags      TEXT[]       DEFAULT '{}',     -- 플랫 태그 배열
  bpm_estimate    INT,
  audio_url       TEXT,
  image_url       TEXT,
  duration        INT,                           -- 초

  -- 벡터 임베딩 (mood_vector → [energy, valence, danceability])
  mood_embedding  vector(3),

  -- 상태
  suno_status     TEXT         NOT NULL DEFAULT 'generating'
                               CHECK (suno_status IN ('generating','done','error')),
  error_msg       TEXT,

  -- 사장님 컨펌
  confirm_status  TEXT         NOT NULL DEFAULT 'pending'
                               CHECK (confirm_status IN ('pending','liked','disliked')),
  confirm_count   INT          NOT NULL DEFAULT 0,  -- 최대 3

  created_at      TIMESTAMPTZ  DEFAULT now(),
  updated_at      TIMESTAMPTZ  DEFAULT now()
);

-- ── 3. updated_at 트리거 ─────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at'
  ) THEN
    CREATE FUNCTION update_updated_at()
    RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $fn$;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS set_generated_tracks_updated_at ON generated_tracks;
CREATE TRIGGER set_generated_tracks_updated_at
  BEFORE UPDATE ON generated_tracks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 4. 인덱스 ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_gen_tracks_store    ON generated_tracks (store_id);
CREATE INDEX IF NOT EXISTS idx_gen_tracks_status   ON generated_tracks (suno_status, confirm_status);
CREATE INDEX IF NOT EXISTS idx_gen_tracks_embedding
  ON generated_tracks USING ivfflat (mood_embedding vector_cosine_ops)
  WITH (lists = 50);

-- ── 5. RLS ───────────────────────────────────────────────────────
ALTER TABLE generated_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gen_tracks_owner" ON generated_tracks;
CREATE POLICY "gen_tracks_owner" ON generated_tracks
  FOR ALL USING (
    store_id IN (
      SELECT id FROM stores WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "gen_tracks_superadmin" ON generated_tracks;
CREATE POLICY "gen_tracks_superadmin" ON generated_tracks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  );

-- ── 6. 코사인 유사도 검색 RPC ─────────────────────────────────────
-- 조건: suno_status='done' + confirm_status='liked' 인 곡만 대상
-- exclude_store: 본인 매장 제외 옵션 (타 매장 곡에서 찾는 경우)
CREATE OR REPLACE FUNCTION find_similar_tracks(
  query_vector    vector(3),
  exclude_store   UUID    DEFAULT NULL,
  match_threshold FLOAT   DEFAULT 0.80,
  match_count     INT     DEFAULT 5
)
RETURNS TABLE (
  id             UUID,
  store_id       UUID,
  title          TEXT,
  style_tags     TEXT[],
  mood_embedding vector(3),
  bpm_estimate   INT,
  audio_url      TEXT,
  image_url      TEXT,
  duration       INT,
  similarity     FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    gt.id,
    gt.store_id,
    gt.title,
    gt.style_tags,
    gt.mood_embedding,
    gt.bpm_estimate,
    gt.audio_url,
    gt.image_url,
    gt.duration,
    1 - (gt.mood_embedding <=> query_vector) AS similarity
  FROM generated_tracks gt
  WHERE
    gt.suno_status    = 'done'
    AND gt.confirm_status = 'liked'
    AND gt.mood_embedding IS NOT NULL
    AND (exclude_store IS NULL OR gt.store_id != exclude_store)
    AND 1 - (gt.mood_embedding <=> query_vector) >= match_threshold
  ORDER BY gt.mood_embedding <=> query_vector
  LIMIT match_count;
$$;

-- ── 7. 컨펌 통계 뷰 (어드민용) ───────────────────────────────────
CREATE OR REPLACE VIEW generated_tracks_stats AS
SELECT
  store_id,
  COUNT(*)                                          AS total,
  COUNT(*) FILTER (WHERE confirm_status = 'liked')  AS liked,
  COUNT(*) FILTER (WHERE confirm_status = 'disliked') AS disliked,
  COUNT(*) FILTER (WHERE confirm_status = 'pending')  AS pending,
  ROUND(AVG(confirm_count), 1)                      AS avg_confirm_count
FROM generated_tracks
WHERE suno_status = 'done'
GROUP BY store_id;
