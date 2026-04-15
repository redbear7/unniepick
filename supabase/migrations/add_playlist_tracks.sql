-- ================================================================
-- playlist_tracks 테이블 — 플레이리스트-트랙 연결
-- Step 2 (playlists 테이블 생성 후) 실행
-- ================================================================

CREATE TABLE IF NOT EXISTS playlist_tracks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id    UUID NOT NULL REFERENCES music_tracks(id) ON DELETE CASCADE,
  position    INT  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(playlist_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks (playlist_id, position);

-- RLS: 읽기는 누구나, 쓰기는 인증된 사용자 (시샵 RLS는 별도 role 정책으로)
ALTER TABLE playlist_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "playlist_tracks_read"  ON playlist_tracks;
DROP POLICY IF EXISTS "playlist_tracks_write" ON playlist_tracks;

CREATE POLICY "playlist_tracks_read" ON playlist_tracks
  FOR SELECT USING (TRUE);

CREATE POLICY "playlist_tracks_write" ON playlist_tracks
  FOR ALL USING (auth.role() = 'authenticated');
