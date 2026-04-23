-- ─────────────────────────────────────────────────────────────────
-- 가격 정보 필드 추가 (거지맵 벤치마킹 P2)
-- 실행: supabase db query --linked < supabase/add_price_fields.sql
-- ─────────────────────────────────────────────────────────────────

-- 1. stores 테이블에 가격 필드 추가
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS representative_price  INTEGER,        -- 대표 메뉴 가격 (원)
  ADD COLUMN IF NOT EXISTS price_label           VARCHAR(50),    -- "런치 7,000원~", "커피 4,500원~"
  ADD COLUMN IF NOT EXISTS price_range           VARCHAR(10)     -- '~6000'|'~8000'|'~12000'|'~20000'|'20000+'
    CHECK (price_range IN ('~6000','~8000','~12000','~20000','20000+'));

-- 2. 인덱스 (가격 필터 성능)
CREATE INDEX IF NOT EXISTS idx_stores_price_range
  ON stores (price_range)
  WHERE is_active = true AND price_range IS NOT NULL;

-- 3. representative_price → price_range 자동 분류 함수
CREATE OR REPLACE FUNCTION compute_price_range(price INTEGER)
RETURNS VARCHAR(10) AS $$
BEGIN
  IF price IS NULL   THEN RETURN NULL; END IF;
  IF price <= 6000   THEN RETURN '~6000'; END IF;
  IF price <= 8000   THEN RETURN '~8000'; END IF;
  IF price <= 12000  THEN RETURN '~12000'; END IF;
  IF price <= 20000  THEN RETURN '~20000'; END IF;
  RETURN '20000+';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. representative_price 입력 시 price_range 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION trg_update_price_range()
RETURNS TRIGGER AS $$
BEGIN
  NEW.price_range := compute_price_range(NEW.representative_price);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stores_price_range ON stores;
CREATE TRIGGER trg_stores_price_range
  BEFORE INSERT OR UPDATE OF representative_price ON stores
  FOR EACH ROW EXECUTE FUNCTION trg_update_price_range();

-- 5. 기존 데이터 일괄 갱신 (이미 값 있는 경우)
UPDATE stores
SET price_range = compute_price_range(representative_price)
WHERE representative_price IS NOT NULL;
