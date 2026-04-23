-- ── receipt_scans: 영수증 OCR 결과 저장 ─────────────────────────
CREATE TABLE IF NOT EXISTS public.receipt_scans (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id     uuid        REFERENCES public.stores(id)       ON DELETE SET NULL,
  receipt_json jsonb       NOT NULL,
  scanned_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.receipt_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_insert_own_scans"
  ON public.receipt_scans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_select_own_scans"
  ON public.receipt_scans FOR SELECT
  USING (auth.uid() = user_id);

-- ── price_reports에 receipt_scan_id 컬럼 추가 ────────────────────
ALTER TABLE public.price_reports
  ADD COLUMN IF NOT EXISTS receipt_scan_id uuid
    REFERENCES public.receipt_scans(id) ON DELETE SET NULL;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_receipt_scans_user_id
  ON public.receipt_scans (user_id);
CREATE INDEX IF NOT EXISTS idx_price_reports_receipt_scan
  ON public.price_reports (receipt_scan_id);
