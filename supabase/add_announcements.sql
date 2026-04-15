-- ============================================================
-- 공지 롤링 배너 테이블
-- ============================================================

CREATE TABLE IF NOT EXISTS public.announcements (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content    text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 기존 테이블에 view_count 컬럼 추가 (이미 존재하면 무시)
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "공지 전체 조회" ON public.announcements;
DROP POLICY IF EXISTS "공지 관리"     ON public.announcements;
CREATE POLICY "공지 전체 조회" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "공지 관리"     ON public.announcements FOR ALL   USING (true);

-- ============================================================
-- 공지 조회수 증가 RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_announcement_view(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.announcements
  SET view_count = view_count + 1
  WHERE id = p_id;
$$;

-- 샘플 공지
INSERT INTO public.announcements (content, sort_order) VALUES
  ('🎉 언니픽 앱 출시! 영수증 인증하고 랭킹 1위에 도전하세요!', 1),
  ('🎟 이번 주 가맹점 쿠폰 대방출! 지금 확인하세요.', 2)
ON CONFLICT DO NOTHING;

SELECT 'announcements_ready' AS status;
