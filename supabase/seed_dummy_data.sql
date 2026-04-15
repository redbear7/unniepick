-- ============================================================
-- 더미 데이터: 상권별 가게 1개씩 + 쿠폰 4개
-- Supabase Dashboard → SQL Editor → New Query → 실행
-- ============================================================

-- ── 0. 컬럼 누락 방지 (마이그레이션 미적용 환경 대비) ─────────────────
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS emoji        text             DEFAULT '🏪',
  ADD COLUMN IF NOT EXISTS is_open      boolean          DEFAULT true,
  ADD COLUMN IF NOT EXISTS open_time    text             DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS close_time   text             DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS rating       double precision DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS review_count integer          DEFAULT 0;

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS coupon_kind        text DEFAULT 'regular'
    CHECK (coupon_kind IN ('regular','timesale','service','experience')),
  ADD COLUMN IF NOT EXISTS experience_offer   text,
  ADD COLUMN IF NOT EXISTS experience_mission text,
  ADD COLUMN IF NOT EXISTS click_count        integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pick_count         integer DEFAULT 0;

-- total_quantity 를 NULL(무제한) 허용
ALTER TABLE public.coupons
  ALTER COLUMN total_quantity DROP NOT NULL;

-- ── 1. 상권별 더미 가게 + 쿠폰 4개 삽입 ─────────────────────────────
DO $$
DECLARE
  v_sangnam_id  uuid;
  v_bonggok_id  uuid;
  v_store1_id   uuid;   -- 상남동 뽀글이 수제버거
  v_store2_id   uuid;   -- 봉곡동 봉곡 손칼국수
BEGIN

  -- 상권 ID 조회
  SELECT id INTO v_sangnam_id FROM public.districts WHERE name = '상남동';
  SELECT id INTO v_bonggok_id FROM public.districts WHERE name = '봉곡동';

  -- ── 상남동 가게 ─────────────────────────────────────────────────
  INSERT INTO public.stores (
    name, description, address, phone,
    latitude, longitude, category,
    emoji, is_open, open_time, close_time,
    rating, review_count,
    is_active, district_id
  ) VALUES (
    '뽀글이 수제버거',
    '매일 직접 갈아 만드는 수제 패티로 만든 스매시버거 전문점',
    '경남 창원시 의창구 상남동 234-5',
    '055-111-2233',
    35.2221, 128.6808,
    '버거/양식',
    '🍔', true, '11:00', '21:00',
    4.7, 182,
    true, v_sangnam_id
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_store1_id;

  -- 이미 있으면 ID만 가져오기
  IF v_store1_id IS NULL THEN
    SELECT id INTO v_store1_id FROM public.stores WHERE name = '뽀글이 수제버거';
  END IF;

  -- ── 봉곡동 가게 ─────────────────────────────────────────────────
  INSERT INTO public.stores (
    name, description, address, phone,
    latitude, longitude, category,
    emoji, is_open, open_time, close_time,
    rating, review_count,
    is_active, district_id
  ) VALUES (
    '봉곡 손칼국수',
    '30년 전통 손으로 직접 뽑은 칼국수와 수제 군만두',
    '경남 창원시 의창구 봉곡동 112-3',
    '055-222-3344',
    35.2462, 128.6501,
    '한식',
    '🍜', true, '10:30', '20:00',
    4.5, 267,
    true, v_bonggok_id
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_store2_id;

  IF v_store2_id IS NULL THEN
    SELECT id INTO v_store2_id FROM public.stores WHERE name = '봉곡 손칼국수';
  END IF;

  -- ── 쿠폰 4개 ────────────────────────────────────────────────────

  -- 쿠폰 1: 타임세일 (상남동 뽀글이 수제버거)
  INSERT INTO public.coupons (
    store_id, title, description,
    coupon_kind, discount_type, discount_value,
    total_quantity, issued_count,
    expires_at, is_active
  ) VALUES (
    v_store1_id,
    '오후 3~5시 스매시버거 30% 타임세일',
    '매일 오후 3시~5시 한정! 전 메뉴 30% 할인 (음료 제외)',
    'timesale', 'percent', 30,
    50, 12,
    '2026-06-30 23:59:59+09',
    true
  );

  -- 쿠폰 2: 서비스 — 무제한 (상남동 뽀글이 수제버거)
  INSERT INTO public.coupons (
    store_id, title, description,
    coupon_kind, discount_type, discount_value,
    total_quantity, issued_count,
    expires_at, is_active
  ) VALUES (
    v_store1_id,
    '버거 세트 주문 시 음료 무료 서비스',
    '버거+감자튀김 세트 주문 고객께 탄산음료(355ml) 1캔 증정',
    'service', 'amount', 0,
    NULL, 34,           -- NULL = 무제한
    '2026-12-31 23:59:59+09',
    true
  );

  -- 쿠폰 3: 체험단 (봉곡동 봉곡 손칼국수)
  INSERT INTO public.coupons (
    store_id, title, description,
    coupon_kind, discount_type, discount_value,
    total_quantity, issued_count,
    experience_offer, experience_mission,
    expires_at, is_active
  ) VALUES (
    v_store2_id,
    '손칼국수 2인 코스 체험단 모집 (10명)',
    '30년 전통 손칼국수집을 방문해 솔직한 후기를 남겨주세요',
    'experience', 'amount', 0,
    10, 3,
    '손칼국수 + 수제 군만두 세트 2인분 (정가 22,000원)',
    '방문 후 네이버 지도 영수증 리뷰 or 인스타그램 스토리 태그 필수 (#언니픽 #봉곡손칼국수)',
    '2026-05-31 23:59:59+09',
    true
  );

  -- 쿠폰 4: 상시할인 — 무제한 (봉곡동 봉곡 손칼국수)
  INSERT INTO public.coupons (
    store_id, title, description,
    coupon_kind, discount_type, discount_value,
    total_quantity, issued_count,
    expires_at, is_active
  ) VALUES (
    v_store2_id,
    '칼국수 2인 세트 5,000원 할인',
    '칼국수 2그릇 + 군만두 1접시 세트 주문 시 5,000원 즉시 할인',
    'regular', 'amount', 5000,
    NULL, 89,           -- NULL = 무제한
    '2026-12-31 23:59:59+09',
    true
  );

END $$;

-- ── 2. 결과 확인 ─────────────────────────────────────────────────────
SELECT
  s.name       AS 가게명,
  d.name       AS 상권,
  s.emoji,
  s.category,
  s.rating,
  s.is_open
FROM public.stores s
LEFT JOIN public.districts d ON d.id = s.district_id
WHERE s.name IN ('뽀글이 수제버거', '봉곡 손칼국수')
ORDER BY s.name;

SELECT
  c.title       AS 쿠폰명,
  c.coupon_kind AS 종류,
  c.discount_type,
  c.discount_value,
  COALESCE(c.total_quantity::text, '무제한') AS 총수량,
  c.issued_count AS 발급수,
  c.expires_at   AS 만료일,
  s.name         AS 가게명
FROM public.coupons c
JOIN public.stores s ON s.id = c.store_id
WHERE s.name IN ('뽀글이 수제버거', '봉곡 손칼국수')
ORDER BY c.created_at DESC;
