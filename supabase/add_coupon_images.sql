-- ============================================================
-- 쿠폰 이미지 컬럼 추가 (최대 2장)
-- ============================================================
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS image_url  text,
  ADD COLUMN IF NOT EXISTS image_url2 text;

-- Supabase Storage 버킷 생성 (Dashboard → Storage에서 수동 생성 가능)
-- bucket name: coupon-images
-- public: true (공개 읽기 허용)
-- insert/update: 인증된 사용자만
