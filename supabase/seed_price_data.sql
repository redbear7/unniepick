-- ─────────────────────────────────────────────────────────────────
-- 가격 테스트 데이터 삽입 (거지맵 벤치마킹 P2)
-- 실행: supabase db query --linked < supabase/seed_price_data.sql
-- ─────────────────────────────────────────────────────────────────

UPDATE stores SET
  representative_price = 4500,
  price_label = '아메리카노 4,500원~'
WHERE id = '4e2d9506-b05c-44f1-82ad-e68d95172d0f'; -- 투썸플레이스

UPDATE stores SET
  representative_price = 9900,
  price_label = '뷔페 9,900원~'
WHERE id = '2817acd8-1a08-4973-996a-cec9b8ad143c'; -- 밥짓는부엌

UPDATE stores SET
  representative_price = 15000,
  price_label = '삼겹살 15,000원~'
WHERE id = 'a0444942-871d-4b70-a13f-b6fb45441ba5'; -- 우리동네 맛집 본점

UPDATE stores SET
  representative_price = 8000,
  price_label = '한식 백반 8,000원~'
WHERE id = 'a1f998c2-1be6-4790-8e68-cabdf2ccad70'; -- 우리동네 맛집 2호점

UPDATE stores SET
  representative_price = 12000,
  price_label = '포차 안주 12,000원~'
WHERE id = 'd1000000-0000-0000-0000-000000000019'; -- 퓨전 포차 달빛

UPDATE stores SET
  representative_price = 7500,
  price_label = '돈가스 정식 7,500원~'
WHERE id = '0667cdf2-15f5-43eb-be83-65999603be70'; -- 쿠마키친

UPDATE stores SET
  representative_price = 6000,
  price_label = '돌판 구이 6,000원~'
WHERE id = 'a441249c-15ae-4653-af3d-d5bece10d961'; -- 돌판상회

UPDATE stores SET
  representative_price = 4000,
  price_label = '분식 4,000원~'
WHERE id = 'f61d3b9e-6c4d-4626-994f-7a3ce649382f'; -- 우리동네 분식

UPDATE stores SET
  representative_price = 9000,
  price_label = '국수 9,000원~'
WHERE id = 'd1000000-0000-0000-0000-000000000009'; -- 국수나무

UPDATE stores SET
  representative_price = 11000,
  price_label = '피자 슬라이스 11,000원~'
WHERE id = 'd1000000-0000-0000-0000-000000000010'; -- 피자 에디션

UPDATE stores SET
  representative_price = 13000,
  price_label = '태국 정식 13,000원~'
WHERE id = 'd1000000-0000-0000-0000-000000000011'; -- 태국 오리진

-- 결과 확인
SELECT name, category, representative_price, price_label, price_range
FROM stores
WHERE representative_price IS NOT NULL
ORDER BY representative_price;
