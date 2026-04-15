-- ─────────────────────────────────────────────────────────────
-- 언니픽 뮤직 + TTS 안내방송 테이블
-- ─────────────────────────────────────────────────────────────

-- 1. 음악 트랙
CREATE TABLE IF NOT EXISTS public.music_tracks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text NOT NULL,
  artist         text NOT NULL DEFAULT '언니픽',
  mood           text,              -- 'lofi' | 'jazz' | 'bossa' | 'edm' | 'pop' | 'rb' | 'classical'
  store_category text DEFAULT 'all', -- 'cafe' | 'food' | 'beauty' | 'health' | 'mart' | 'all'
  audio_url      text NOT NULL,
  duration_sec   int  DEFAULT 0,
  cover_emoji    text DEFAULT '🎵',
  is_active      boolean DEFAULT true,
  created_at     timestamptz DEFAULT now()
);

-- 2. 가게별 플레이리스트
CREATE TABLE IF NOT EXISTS public.store_playlists (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  track_id   uuid REFERENCES public.music_tracks(id) ON DELETE CASCADE,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(store_id, track_id)
);

-- 3. 고객 감상 이력 (적립금 차감)
CREATE TABLE IF NOT EXISTS public.user_music_plays (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id     uuid REFERENCES public.music_tracks(id),
  points_spent int DEFAULT 0,
  played_at    timestamptz DEFAULT now()
);

-- 4. TTS 안내방송
CREATE TABLE IF NOT EXISTS public.store_announcements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  text          text NOT NULL,
  audio_url     text,
  voice_type    text DEFAULT 'female_bright',
  play_mode     text DEFAULT 'immediate',  -- 'immediate' | 'between_tracks' | 'scheduled'
  repeat_count  int  DEFAULT 1,
  play_interval int  DEFAULT 3,            -- 곡간 삽입 시 N곡마다
  scheduled_at  timestamptz,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- ─── RLS 활성화 ─────────────────────────────────────────────────
ALTER TABLE public.music_tracks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_playlists    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_music_plays   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_announcements ENABLE ROW LEVEL SECURITY;

-- music_tracks: 모든 사람 읽기 가능 (활성 곡만)
CREATE POLICY "music_tracks_public_read"
  ON public.music_tracks FOR SELECT
  TO public USING (is_active = true);

-- store_playlists: 모든 사람 읽기 가능
CREATE POLICY "store_playlists_public_read"
  ON public.store_playlists FOR SELECT
  TO public USING (true);

-- user_music_plays: 본인만 삽입/조회
CREATE POLICY "user_music_plays_insert"
  ON public.user_music_plays FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_music_plays_select"
  ON public.user_music_plays FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- store_announcements: 가게 소유자만 전체 권한
CREATE POLICY "store_announcements_owner_all"
  ON public.store_announcements FOR ALL
  TO authenticated
  USING (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = auth.uid()
    )
  );

-- ─── Supabase Storage 버킷 안내 ─────────────────────────────────
-- Dashboard > Storage 에서 아래 2개 버킷을 수동으로 생성하세요:
--   1. music-tracks  (Public)  : 음악 MP3 파일
--   2. announcements (Public)  : TTS 생성 MP3 파일
