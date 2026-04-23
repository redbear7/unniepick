-- ── 고객 가격 제보 테이블 ──────────────────────────────────────────
-- 사용자가 가게의 메뉴 가격을 직접 제보
-- status: pending → approved / rejected (어드민 검토)
-- 승인 시 자동으로 stores.representative_price 최신화

CREATE TABLE IF NOT EXISTS price_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_name   TEXT NOT NULL,
  price       INTEGER NOT NULL CHECK (price > 0 AND price < 1000000),
  note        TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_price_reports_store    ON price_reports (store_id, status);
CREATE INDEX IF NOT EXISTS idx_price_reports_user     ON price_reports (user_id);

-- RLS
ALTER TABLE price_reports ENABLE ROW LEVEL SECURITY;

-- 본인 제보 조회/삽입
CREATE POLICY "price_reports_own" ON price_reports
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 승인된 제보는 모두 조회 가능
CREATE POLICY "price_reports_approved_read" ON price_reports
  FOR SELECT USING (status = 'approved');

-- ── 승인 시 stores.representative_price 자동 최신화 트리거 ───────────
-- 같은 가게의 승인된 제보 중 최빈 가격(mode)을 대표 가격으로 설정
CREATE OR REPLACE FUNCTION sync_representative_price()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_price INTEGER;
BEGIN
  -- 승인됐을 때만 실행
  IF NEW.status = 'approved' THEN
    -- 같은 가게 승인 제보에서 최빈 가격
    SELECT price INTO v_price
    FROM price_reports
    WHERE store_id = NEW.store_id AND status = 'approved'
    GROUP BY price
    ORDER BY COUNT(*) DESC, price ASC
    LIMIT 1;

    IF v_price IS NOT NULL THEN
      UPDATE stores
      SET representative_price = v_price
      WHERE id = NEW.store_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_rep_price ON price_reports;
CREATE TRIGGER trg_sync_rep_price
  AFTER INSERT OR UPDATE OF status ON price_reports
  FOR EACH ROW EXECUTE FUNCTION sync_representative_price();

-- 확인
SELECT 'price_reports 테이블 생성 완료' AS result;
