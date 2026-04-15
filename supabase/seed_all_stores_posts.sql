-- ============================================================
-- 우리동네 맛집 4개 가게: 쿠폰 + 게시물 1개씩
-- (뽀글이 수제버거, 봉곡 손칼국수는 이미 게시물 있음 — 생략)
-- ※ seed_dummy_data.sql 실행 후 이 파일 실행
-- ============================================================

-- 0. 컬럼 안전 추가 (미적용 환경 대비)
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

ALTER TABLE public.coupons
  ALTER COLUMN total_quantity DROP NOT NULL;

ALTER TABLE public.store_posts
  ADD COLUMN IF NOT EXISTS pick_count integer DEFAULT 0;

DO $$
DECLARE
  v_bonjeom_id   uuid;   -- 우리동네 맛집 본점
  v_hongdae_id   uuid;   -- 우리동네 맛집 홍대점
  v_gangnam_id   uuid;   -- 우리동네 맛집 강남점
  v_itaewon_id   uuid;   -- 우리동네 맛집 이태원점

  v_c1 uuid; v_c2 uuid; v_c3 uuid; v_c4 uuid;
  v_expires timestamptz := now() + interval '30 days';
BEGIN
  -- 가게 ID 조회
  SELECT id INTO v_bonjeom_id  FROM public.stores WHERE name = '우리동네 맛집 본점';
  SELECT id INTO v_hongdae_id  FROM public.stores WHERE name = '우리동네 맛집 홍대점';
  SELECT id INTO v_gangnam_id  FROM public.stores WHERE name = '우리동네 맛집 강남점';
  SELECT id INTO v_itaewon_id  FROM public.stores WHERE name = '우리동네 맛집 이태원점';

  -- ── 본점 쿠폰 ─────────────────────────────────────────────────────
  INSERT INTO public.coupons (
    store_id, title, description,
    discount_type, discount_value,
    coupon_kind, total_quantity, issued_count,
    is_active, expires_at, created_at
  ) VALUES (
    v_bonjeom_id,
    '단골 감사 20% 할인',
    '40년 전통 본점에서 감사함을 전합니다. 모든 메뉴 20% 할인!',
    'percent', 20,
    'regular', NULL, 0,
    true, v_expires, now() - interval '3 days'
  ) RETURNING id INTO v_c1;

  -- ── 홍대점 쿠폰 ──────────────────────────────────────────────────
  INSERT INTO public.coupons (
    store_id, title, description,
    discount_type, discount_value,
    coupon_kind, total_quantity, issued_count,
    is_active, expires_at, created_at
  ) VALUES (
    v_hongdae_id,
    '홍대 오픈기념 무료 사이드',
    '홍대점 방문 시 사이드 메뉴 1종 무료 제공!',
    'amount', 0,
    'service', NULL, 0,
    true, v_expires, now() - interval '2 days'
  ) RETURNING id INTO v_c2;

  -- ── 강남점 쿠폰 ──────────────────────────────────────────────────
  INSERT INTO public.coupons (
    store_id, title, description,
    discount_type, discount_value,
    coupon_kind, total_quantity, issued_count,
    is_active, expires_at, created_at
  ) VALUES (
    v_gangnam_id,
    '점심 타임세일 15%',
    '평일 낮 12시~2시 모든 메뉴 15% 할인 타임세일!',
    'percent', 15,
    'timesale', 100, 0,
    true, v_expires, now() - interval '1 day'
  ) RETURNING id INTO v_c3;

  -- ── 이태원점 쿠폰 ──────────────────────────────────────────────────
  INSERT INTO public.coupons (
    store_id, title, description,
    discount_type, discount_value,
    coupon_kind, total_quantity, issued_count,
    is_active, expires_at, created_at
  ) VALUES (
    v_itaewon_id,
    '체험단 5명 모집',
    '이태원 분위기 맛집 체험단! 2인 코스 무료 + 후기 작성',
    'amount', 0,
    'experience', 5, 0,
    true, v_expires, now() - interval '6 hours'
  ) RETURNING id INTO v_c4;

  -- ── 본점 게시물 ──────────────────────────────────────────────────
  INSERT INTO public.store_posts
    (store_id, content, linked_coupon_id, like_count, pick_count, created_at)
  VALUES (
    v_bonjeom_id,
    '안녕하세요! 40년 전통 우리동네 맛집 본점입니다 🍖' || chr(10) || chr(10) ||
    '오늘도 새벽부터 정성껏 육수를 우려냈어요.' || chr(10) ||
    '변함없는 맛, 변함없는 정성으로 찾아뵙겠습니다.' || chr(10) || chr(10) ||
    '단골 고객님 감사 이벤트 중이에요 — 20% 할인 쿠폰 발급 받아가세요! 🎟',
    v_c1,
    52, 23,
    now() - interval '1 hour'
  );

  -- ── 홍대점 게시물 ─────────────────────────────────────────────────
  INSERT INTO public.store_posts
    (store_id, content, linked_coupon_id, like_count, pick_count, created_at)
  VALUES (
    v_hongdae_id,
    '홍대 핫플에서 우리동네 맛집을 만나보세요 🎉' || chr(10) || chr(10) ||
    '본점의 레시피 그대로, 홍대 분위기에 맞게 새롭게 오픈했어요.' || chr(10) ||
    '사이드 메뉴 무료 서비스 쿠폰 발급 중이니 꼭 챙겨가세요!' || chr(10) || chr(10) ||
    '인스타 감성 가득한 공간에서 만나요 📸',
    v_c2,
    38, 17,
    now() - interval '2 hours'
  );

  -- ── 강남점 게시물 ─────────────────────────────────────────────────
  INSERT INTO public.store_posts
    (store_id, content, linked_coupon_id, like_count, pick_count, created_at)
  VALUES (
    v_gangnam_id,
    '강남 직장인분들 주목! ⚡ 점심 타임세일 진행 중' || chr(10) || chr(10) ||
    '평일 낮 12시~2시, 모든 메뉴 15% 할인이에요.' || chr(10) ||
    '빠른 서비스로 점심 시간을 알차게 드세요.' || chr(10) || chr(10) ||
    '쿠폰 발급 후 방문하시면 바로 적용됩니다 😊',
    v_c3,
    61, 29,
    now() - interval '4 hours'
  );

  -- ── 이태원점 게시물 ───────────────────────────────────────────────
  INSERT INTO public.store_posts
    (store_id, content, linked_coupon_id, like_count, pick_count, created_at)
  VALUES (
    v_itaewon_id,
    '이태원에서 즐기는 특별한 한 끼 🌍' || chr(10) || chr(10) ||
    '글로벌한 분위기 속에서 정통 한식의 깊은 맛을 경험해보세요.' || chr(10) ||
    '지금 체험단 5명을 모집합니다!' || chr(10) ||
    '2인 코스 무료 + 간단한 후기만 남겨주시면 돼요 📸' || chr(10) || chr(10) ||
    '자리 마감 전 서둘러 신청해주세요 ✨',
    v_c4,
    44, 21,
    now() - interval '30 minutes'
  );

END $$;

-- 결과 확인
SELECT
  s.name    AS 가게명,
  COUNT(c.id) AS 쿠폰수,
  COUNT(sp.id) AS 게시물수
FROM public.stores s
LEFT JOIN public.coupons    c  ON c.store_id  = s.id AND c.is_active = true
LEFT JOIN public.store_posts sp ON sp.store_id = s.id
WHERE s.name LIKE '우리동네%'
GROUP BY s.name
ORDER BY s.name;
