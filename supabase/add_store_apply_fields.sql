-- ══════════════════════════════════════════════════════════════
-- 가게 신청 폼 추가 필드: 인스타그램, 네이버 플레이스, 우편번호, 상세주소
-- ══════════════════════════════════════════════════════════════

-- store_applications 테이블에 신규 컬럼 추가
ALTER TABLE public.store_applications
  ADD COLUMN IF NOT EXISTS instagram_url    text,
  ADD COLUMN IF NOT EXISTS naver_place_url  text,
  ADD COLUMN IF NOT EXISTS postcode         text,
  ADD COLUMN IF NOT EXISTS address_detail   text;

-- stores 테이블에도 동일 컬럼 추가 (승인 시 복사)
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS instagram_url    text,
  ADD COLUMN IF NOT EXISTS naver_place_url  text,
  ADD COLUMN IF NOT EXISTS postcode         text,
  ADD COLUMN IF NOT EXISTS address_detail   text;
