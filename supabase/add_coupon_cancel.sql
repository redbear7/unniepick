-- ============================================================
-- 쿠폰 취소 기능 마이그레이션
-- 실행 위치: Supabase SQL Editor
-- ============================================================

-- 1. user_coupons: cancelled_at, noshow_at 컬럼 추가
ALTER TABLE public.user_coupons
  ADD COLUMN IF NOT EXISTS cancelled_at  timestamptz,
  ADD COLUMN IF NOT EXISTS noshow_at     timestamptz;

-- 2. status 제약 조건 업데이트 (cancelled, noshow 추가)
ALTER TABLE public.user_coupons
  DROP CONSTRAINT IF EXISTS user_coupons_status_check;

ALTER TABLE public.user_coupons
  ADD CONSTRAINT user_coupons_status_check
  CHECK (status IN ('available', 'used', 'cancelled', 'noshow'));

-- 3. 쿠폰 취소 RPC (당일 취소 방지 서버 사이드 검증)
CREATE OR REPLACE FUNCTION public.cancel_user_coupon(
  p_user_coupon_id uuid,
  p_user_id        uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uc       record;
  v_deadline timestamptz;
BEGIN
  -- 쿠폰 조회
  SELECT uc.id, uc.status, c.expires_at
  INTO v_uc
  FROM user_coupons uc
  JOIN coupons c ON c.id = uc.coupon_id
  WHERE uc.id = p_user_coupon_id
    AND uc.user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_found');
  END IF;

  IF v_uc.status <> 'available' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_available');
  END IF;

  -- 취소 가능 기한: 만료일 하루 전 23:59:59 KST
  v_deadline := (v_uc.expires_at AT TIME ZONE 'Asia/Seoul')::date
                  - interval '1 day'
                  + interval '23 hours 59 minutes 59 seconds';
  v_deadline := v_deadline AT TIME ZONE 'Asia/Seoul';

  IF now() > v_deadline THEN
    RETURN jsonb_build_object('success', false, 'reason', 'deadline_passed');
  END IF;

  -- 취소 처리
  UPDATE user_coupons
  SET status = 'cancelled', cancelled_at = now()
  WHERE id = p_user_coupon_id AND user_id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_user_coupon TO authenticated;

-- 4. 노쇼 처리 RPC (사장님 또는 관리자가 호출)
CREATE OR REPLACE FUNCTION public.mark_noshow(
  p_user_coupon_id uuid,
  p_owner_id       uuid   -- 쿠폰 소유 사장님만 처리 가능
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uc record;
BEGIN
  SELECT uc.id, uc.status, c.owner_id
  INTO v_uc
  FROM user_coupons uc
  JOIN coupons c ON c.id = uc.coupon_id
  WHERE uc.id = p_user_coupon_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_found');
  END IF;

  IF v_uc.owner_id <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'unauthorized');
  END IF;

  IF v_uc.status <> 'available' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_available');
  END IF;

  UPDATE user_coupons
  SET status = 'noshow', noshow_at = now()
  WHERE id = p_user_coupon_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_noshow TO authenticated;
