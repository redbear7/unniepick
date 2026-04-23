-- ══════════════════════════════════════════════════════════════════
-- 방문 후기 + 포인트 시스템
-- ══════════════════════════════════════════════════════════════════

-- ── 1. profiles에 포인트 잔액 컬럼 추가 ───────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0;

-- ── 2. 포인트 설정 테이블 (어드민에서 관리) ───────────────────────
CREATE TABLE IF NOT EXISTS public.point_settings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         varchar(100) UNIQUE NOT NULL,
  value       jsonb       NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 기본 설정값 삽입
INSERT INTO public.point_settings (key, value, description) VALUES
  ('receipt_review', '{
    "enabled": true,
    "amount": 500,
    "max_per_day": 1,
    "receipt_max_age_hours": 48
  }', '영수증 후기 제보 포인트 지급 조건')
ON CONFLICT (key) DO NOTHING;

-- RLS: 누구나 읽기 가능, 쓰기는 서비스롤만 (어드민에서 service_role로 처리)
ALTER TABLE public.point_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "point_settings_read_all"
  ON public.point_settings FOR SELECT USING (true);

-- ── 3. 포인트 트랜잭션 테이블 ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.point_transactions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount       integer     NOT NULL,          -- 양수: 적립, 음수: 사용
  type         varchar(50) NOT NULL,          -- 'receipt_review' | 'redeem' | 'admin_adjust'
  reference_id uuid,                          -- review_id 등 연관 레코드
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_point_tx_user_created
  ON public.point_transactions (user_id, created_at DESC);

-- RLS
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "point_tx_read_own"
  ON public.point_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- ── 4. 방문 후기 테이블 ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id        uuid        REFERENCES public.stores(id) ON DELETE SET NULL,
  receipt_scan_id uuid        REFERENCES public.receipt_scans(id) ON DELETE SET NULL,
  content         text        NOT NULL CHECK (char_length(content) <= 300),
  photo_url       text,                       -- Storage 경로
  receipt_date    date,                       -- 영수증 발행일 (포인트 조건 검증용)
  points_awarded  integer     NOT NULL DEFAULT 0,
  status          varchar(20) NOT NULL DEFAULT 'active', -- active | hidden | deleted
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_reviews_store    ON public.reviews (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_user     ON public.reviews (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_scan     ON public.reviews (receipt_scan_id);

-- RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 active 후기 읽기 가능
CREATE POLICY "reviews_read_active"
  ON public.reviews FOR SELECT
  USING (status = 'active');

-- 본인만 insert
CREATE POLICY "reviews_insert_own"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인만 수정 (내용 수정 / 삭제 처리)
CREATE POLICY "reviews_update_own"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = user_id);

-- ── 5. receipt_scans에 review_id 역참조 (선택) ────────────────────
ALTER TABLE public.receipt_scans
  ADD COLUMN IF NOT EXISTS review_id uuid REFERENCES public.reviews(id) ON DELETE SET NULL;

-- ── 6. Storage 버킷: review-photos ────────────────────────────────
-- Supabase Dashboard에서 수동 생성 필요:
--   버킷명: review-photos
--   Public: true (이미지 직접 URL 접근용)
--
-- 아래 정책은 버킷 생성 후 실행:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('review-photos', 'review-photos', true)
-- ON CONFLICT DO NOTHING;

-- Storage RLS (review-photos)
-- 업로드: 인증된 사용자, 본인 폴더만
INSERT INTO storage.buckets (id, name, public)
VALUES ('review-photos', 'review-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "review_photos_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'review-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 읽기: 전체 공개 (public 버킷)
CREATE POLICY "review_photos_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'review-photos');

-- 삭제: 본인 파일만
CREATE POLICY "review_photos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'review-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
