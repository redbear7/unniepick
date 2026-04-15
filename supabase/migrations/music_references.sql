-- ================================================================
-- music_references 테이블 — Phase 2: 레퍼런스 음악 분석
-- 사장님 유튜브 입력 → YouTube API + Claude 태그 추출 결과 저장
-- ================================================================

CREATE TABLE IF NOT EXISTS public.music_references (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,

  -- 유튜브 원본
  youtube_url      text        NOT NULL,
  youtube_id       text,                    -- 파싱된 video ID
  youtube_title    text,
  youtube_artist   text,
  youtube_channel  text,
  youtube_thumb    text,                    -- 썸네일 URL

  -- Claude 분석 결과
  extracted_tags   jsonb,                   -- { genre, mood, tempo, instrument, vocal, era }
  bpm_estimate     int,
  mood_vector      jsonb,                   -- { energy, valence, danceability } 0.0~1.0

  -- 상태
  status           text        DEFAULT 'pending',  -- 'pending' | 'analyzing' | 'done' | 'error'
  error_msg        text,

  created_at       timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.music_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_manage_own_references" ON public.music_references
  FOR ALL USING (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "superadmin_read_all_references" ON public.music_references
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );
