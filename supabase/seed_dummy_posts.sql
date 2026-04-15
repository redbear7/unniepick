-- ============================================================
-- 더미 게시물 4개 (뽀글이 수제버거 2개 / 봉곡 손칼국수 2개)
-- ※ seed_dummy_data.sql 실행 후 이 파일 실행
-- ============================================================

DO $$
DECLARE
  v_store1_id  uuid;   -- 뽀글이 수제버거 (상남동)
  v_store2_id  uuid;   -- 봉곡 손칼국수   (봉곡동)
  v_coupon_ts  uuid;   -- 타임세일 쿠폰
  v_coupon_svc uuid;   -- 서비스 쿠폰
  v_coupon_exp uuid;   -- 체험단 쿠폰
  v_coupon_reg uuid;   -- 상시할인 쿠폰
BEGIN
  -- 가게 ID 조회
  SELECT id INTO v_store1_id FROM public.stores WHERE name = '뽀글이 수제버거';
  SELECT id INTO v_store2_id FROM public.stores WHERE name = '봉곡 손칼국수';

  -- 쿠폰 ID 조회 (각 가게의 최신 쿠폰)
  SELECT id INTO v_coupon_ts
    FROM public.coupons
    WHERE store_id = v_store1_id AND coupon_kind = 'timesale'
    ORDER BY created_at DESC LIMIT 1;

  SELECT id INTO v_coupon_svc
    FROM public.coupons
    WHERE store_id = v_store1_id AND coupon_kind = 'service'
    ORDER BY created_at DESC LIMIT 1;

  SELECT id INTO v_coupon_exp
    FROM public.coupons
    WHERE store_id = v_store2_id AND coupon_kind = 'experience'
    ORDER BY created_at DESC LIMIT 1;

  SELECT id INTO v_coupon_reg
    FROM public.coupons
    WHERE store_id = v_store2_id AND coupon_kind = 'regular'
    ORDER BY created_at DESC LIMIT 1;

  -- ── 게시물 1: 뽀글이 수제버거 — 오늘의 메뉴 소개 ────────────────
  INSERT INTO public.store_posts
    (store_id, content, linked_coupon_id, like_count, pick_count, created_at)
  VALUES (
    v_store1_id,
    '오늘도 아침부터 직접 갈아 만든 수제 패티 준비 완료! 🍔' || chr(10) || chr(10) ||
    '오늘의 추천: 더블 스매시버거 + 감자튀김 세트' || chr(10) ||
    '두툼한 패티를 철판에 스매시해서 겉은 바삭, 속은 육즙 가득!' || chr(10) || chr(10) ||
    '오후 3~5시에는 30% 타임세일도 진행 중이에요 ⏰' || chr(10) ||
    '오늘도 맛있게 드시러 오세요 😋',
    v_coupon_ts,
    18, 7,
    now() - interval '2 hours'
  );

  -- ── 게시물 2: 뽀글이 수제버거 — 서비스 쿠폰 안내 ───────────────
  INSERT INTO public.store_posts
    (store_id, content, linked_coupon_id, like_count, pick_count, created_at)
  VALUES (
    v_store1_id,
    '버거 세트 주문하시면 탄산음료 무료로 드려요! 🥤' || chr(10) || chr(10) ||
    '언니픽 쿠폰 발급받고 방문하시면 음료 한 캔을 서비스로 드립니다.' || chr(10) ||
    '세트 메뉴 주문 시 적용되며 수량 제한 없이 매일 제공해요.' || chr(10) || chr(10) ||
    '가족, 친구, 연인과 함께 오세요! 언제나 환영합니다 🙌',
    v_coupon_svc,
    31, 14,
    now() - interval '1 day'
  );

  -- ── 게시물 3: 봉곡 손칼국수 — 가게 소개 ────────────────────────
  INSERT INTO public.store_posts
    (store_id, content, linked_coupon_id, like_count, pick_count, created_at)
  VALUES (
    v_store2_id,
    '30년 전통 봉곡동 손칼국수입니다 🍜' || chr(10) || chr(10) ||
    '매일 아침 직접 반죽하고 손으로 뽑은 면을 써요.' || chr(10) ||
    '닭 육수로 우려낸 맑고 깔끔한 국물, 쫄깃한 면발이 자랑이에요.' || chr(10) || chr(10) ||
    '추운 날씨에 뜨끈한 국물 한 그릇 어떠세요?' || chr(10) ||
    '동네 분들 많이 찾아주세요 💛',
    v_coupon_reg,
    45, 22,
    now() - interval '3 hours'
  );

  -- ── 게시물 4: 봉곡 손칼국수 — 체험단 모집 ──────────────────────
  INSERT INTO public.store_posts
    (store_id, content, linked_coupon_id, like_count, pick_count, created_at)
  VALUES (
    v_store2_id,
    '🌟 체험단 10명 모집 중! (잔여 7자리)' || chr(10) || chr(10) ||
    '저희 손칼국수를 아직 못 드셔보셨나요?' || chr(10) ||
    '2인 칼국수 + 수제 군만두 세트를 무료로 드리고,' || chr(10) ||
    '블로그 or 인스타그램 후기만 남겨주시면 됩니다 📸' || chr(10) || chr(10) ||
    '자리 마감 전에 언니픽 앱에서 바로 신청하세요!',
    v_coupon_exp,
    27, 19,
    now() - interval '5 hours'
  );

END $$;

-- 결과 확인
SELECT
  sp.content AS 게시물내용_앞50자,
  s.name     AS 가게명,
  sp.like_count,
  sp.pick_count,
  sp.created_at
FROM public.store_posts sp
JOIN public.stores s ON s.id = sp.store_id
WHERE s.name IN ('뽀글이 수제버거', '봉곡 손칼국수')
ORDER BY sp.created_at DESC;
