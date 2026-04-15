-- ============================================================
-- 쿠폰 사용 비밀번호 (4자리 가게 전용 PIN) 시스템
-- 타 가게와 PIN 중복 허용 — 해당 쿠폰의 가게 PIN과만 대조
-- ============================================================

-- 1. stores 테이블에 PIN 컬럼 추가 (중복 허용 — UNIQUE 없음)
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS coupon_pin char(4);

-- ──────────────────────────────────────────────────────────────
-- 2. PIN 자동 생성 함수 (단순 랜덤, 중복 체크 불필요)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_store_pin()
RETURNS char(4) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- 1000~9999 랜덤 4자리 (앞자리 0 없음)
  RETURN lpad(
    (floor(random() * 9000) + 1000)::int::text,
    4, '0'
  );
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 3. 사장님이 자신의 가게 PIN 설정/변경
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_store_coupon_pin(
  p_store_id uuid,
  p_pin      char(4) DEFAULT NULL   -- NULL 이면 자동 생성
)
RETURNS char(4) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pin char(4);
BEGIN
  -- 본인 가게만 수정 가능
  IF NOT EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = p_store_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION '권한이 없어요';
  END IF;

  IF p_pin IS NOT NULL THEN
    -- 형식만 검사 (타 가게 중복 허용)
    IF p_pin !~ '^[0-9]{4}$' THEN
      RAISE EXCEPTION 'PIN은 숫자 4자리여야 해요';
    END IF;
    v_pin := p_pin;
  ELSE
    v_pin := public.generate_store_pin();
  END IF;

  UPDATE public.stores
  SET coupon_pin = v_pin
  WHERE id = p_store_id;

  RETURN v_pin;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_store_coupon_pin TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- 4. 고객이 PIN 입력으로 쿠폰 사용
--    (해당 쿠폰의 가게 PIN과만 대조 — 타 가게 PIN과 무관)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.use_coupon_by_pin(
  p_user_coupon_id uuid,
  p_user_id        uuid,
  p_pin            char(4)
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uc     public.user_coupons;
  v_coupon public.coupons;
  v_store  public.stores;
BEGIN
  -- user_coupon 조회 (본인 확인)
  SELECT * INTO v_uc
  FROM public.user_coupons
  WHERE id = p_user_coupon_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_found',
      'message', '쿠폰을 찾을 수 없어요');
  END IF;

  IF v_uc.status = 'used' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_used',
      'message', '이미 사용된 쿠폰이에요');
  END IF;

  IF v_uc.status IN ('cancelled', 'noshow') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'cancelled',
      'message', '취소된 쿠폰이에요');
  END IF;

  -- 쿠폰 조회
  SELECT * INTO v_coupon FROM public.coupons WHERE id = v_uc.coupon_id;

  IF v_coupon.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'reason', 'expired',
      'message', '만료된 쿠폰이에요');
  END IF;

  -- 가게 PIN 검증
  IF v_coupon.store_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_store',
      'message', '가게 정보가 없는 쿠폰이에요');
  END IF;

  SELECT * INTO v_store FROM public.stores WHERE id = v_coupon.store_id;

  IF v_store.coupon_pin IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'pin_not_set',
      'message', '이 가게는 아직 비밀번호를 설정하지 않았어요\nQR 스캔으로 사용해주세요');
  END IF;

  -- 이 쿠폰의 가게 PIN과만 대조 (타 가게 PIN은 무관)
  IF v_store.coupon_pin <> p_pin THEN
    RETURN jsonb_build_object('success', false, 'reason', 'wrong_pin',
      'message', '비밀번호가 맞지 않아요 🔒\n다시 확인해주세요');
  END IF;

  -- 쿠폰 사용 처리
  UPDATE public.user_coupons
  SET status  = 'used',
      used_at = now()
  WHERE id = p_user_coupon_id;

  RETURN jsonb_build_object(
    'success',       true,
    'message',       v_coupon.title || ' 쿠폰 사용 완료!',
    'store_name',    v_store.name,
    'coupon_title',  v_coupon.title,
    'discount_type', v_coupon.discount_type,
    'discount_value',v_coupon.discount_value
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.use_coupon_by_pin TO authenticated;
