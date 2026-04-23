-- card_news 테이블: 가게 카드뉴스/숏폼 영상 생성 작업 관리
CREATE TABLE IF NOT EXISTS public.card_news (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  store_name    text        NOT NULL,
  description   text,
  category      text,
  cards         jsonb       NOT NULL DEFAULT '[]'::jsonb,
  template      text        NOT NULL DEFAULT 'modern',
  status        text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'rendering', 'done', 'error')),
  video_url     text,
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS card_news_status_idx  ON public.card_news (status);
CREATE INDEX IF NOT EXISTS card_news_created_idx ON public.card_news (created_at DESC);

ALTER TABLE public.card_news ENABLE ROW LEVEL SECURITY;

-- service_role 은 모든 행에 접근 가능
CREATE POLICY service_role_all ON public.card_news
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
