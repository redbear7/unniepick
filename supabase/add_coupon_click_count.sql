-- ══════════════════════════════════════════════════════════════
-- 쿠폰 클릭 수 집계
-- ══════════════════════════════════════════════════════════════

-- 1. 쿠폰 테이블에 click_count 컬럼 추가
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0;

-- 2. 클릭 수 증가 RPC (비로그인 사용자도 호출 가능 → anon 권한)
CREATE OR REPLACE FUNCTION public.increment_coupon_click(p_coupon_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.coupons
  SET    click_count = click_count + 1
  WHERE  id = p_coupon_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_coupon_click TO anon, authenticated;
