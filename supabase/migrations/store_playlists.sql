-- ================================================================
-- Phase 5: 매장 AI 플레이리스트
-- 실행: Supabase Dashboard > SQL Editor
-- 전제: generated_tracks.sql 실행 완료
-- ================================================================

-- ── 1. playlists 에 store_id 추가 ────────────────────────────────
ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS store_id   UUID REFERENCES stores(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS gen_status TEXT DEFAULT 'done'
    CHECK (gen_status IN ('queued','generating','done','error'));

-- ── 2. generated_tracks 에 playlist_id 추가 ──────────────────────
ALTER TABLE generated_tracks
  ADD COLUMN IF NOT EXISTS playlist_id UUID REFERENCES playlists(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS position    INT DEFAULT 0;

-- ── 3. 인덱스 ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_playlists_store_id  ON playlists (store_id);
CREATE INDEX IF NOT EXISTS idx_gen_tracks_playlist ON generated_tracks (playlist_id, position);

-- ── 4. RLS: playlists에 store 오너 정책 추가 ─────────────────────
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "playlists_store_owner" ON playlists;
CREATE POLICY "playlists_store_owner" ON playlists
  FOR ALL USING (
    store_id IS NULL  -- 기존 글로벌 플레이리스트는 모두 읽기 가능
    OR store_id IN (
      SELECT id FROM stores WHERE owner_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  );

DROP POLICY IF EXISTS "playlists_read_public" ON playlists;
CREATE POLICY "playlists_read_public" ON playlists
  FOR SELECT USING (store_id IS NULL OR is_active = TRUE);
