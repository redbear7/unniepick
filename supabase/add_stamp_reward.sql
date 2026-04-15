-- 가게 테이블에 스탬프 리워드 설정 추가
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS stamp_goal   integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS stamp_reward text    DEFAULT NULL;

-- store_checkin RPC 업데이트:
--   영수증 인증과 당일 중복 불가 체크 추가
CREATE OR REPLACE FUNCTION public.store_checkin(
  p_user_id  uuid,
  p_store_id uuid,
  p_lat      double precision,
  p_lng      double precision
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_store        public.stores;
  v_wallet       public.wallets;
  v_dist_m       double precision;
  v_earn         integer;
  v_today        date := CURRENT_DATE;
  v_stamp_count  integer;
BEGIN
  -- 가게 정보 조회
  SELECT * INTO v_store FROM public.stores WHERE id = p_store_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'store_not_found');
  END IF;

  -- GPS 검증 (가게 좌표가 등록된 경우만)
  IF v_store.latitude IS NOT NULL AND v_store.longitude IS NOT NULL THEN
    v_dist_m := 111320 * sqrt(
      power(p_lat - v_store.latitude, 2) +
      power((p_lng - v_store.longitude) * cos(radians(v_store.latitude)), 2)
    );
    IF v_dist_m > 200 THEN
      RETURN jsonb_build_object(
        'success',    false,
        'reason',     'too_far',
        'distance_m', round(v_dist_m)
      );
    END IF;
  END IF;

  -- 오늘 이미 체크인했는지 확인
  IF EXISTS (
    SELECT 1 FROM public.store_checkins
    WHERE user_id = p_user_id AND store_id = p_store_id
      AND checkin_date = v_today
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_checked_today');
  END IF;

  -- 영수증 인증과 당일 중복 불가
  IF EXISTS (
    SELECT 1 FROM public.receipt_verifications
    WHERE user_id = p_user_id AND store_id = p_store_id
      AND verified_at::date = v_today
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'receipt_already_used_today');
  END IF;

  -- 적립 금액 조회
  SELECT amount INTO v_earn FROM public.earn_policies
  WHERE event_type = 'checkin' AND is_active = true;
  v_earn := COALESCE(v_earn, 50);

  -- 지갑 업데이트
  INSERT INTO public.wallets (user_id, balance, total_earned)
  VALUES (p_user_id, v_earn, v_earn)
  ON CONFLICT (user_id) DO UPDATE SET
    balance      = wallets.balance + v_earn,
    total_earned = wallets.total_earned + v_earn,
    updated_at   = now()
  RETURNING * INTO v_wallet;

  -- 트랜잭션 기록
  INSERT INTO public.wallet_transactions
    (user_id, type, amount, balance_after, store_id, description)
  VALUES
    (p_user_id, 'earn_checkin', v_earn, v_wallet.balance,
     p_store_id, v_store.name || ' 방문 스탬프 적립');

  -- 체크인(스탬프) 기록
  INSERT INTO public.store_checkins
    (user_id, store_id, checkin_date, latitude, longitude, earned)
  VALUES
    (p_user_id, p_store_id, v_today, p_lat, p_lng, v_earn);

  -- 이 가게 누적 스탬프 수
  SELECT COUNT(*) INTO v_stamp_count
  FROM public.store_checkins
  WHERE user_id = p_user_id AND store_id = p_store_id;

  RETURN jsonb_build_object(
    'success',      true,
    'earned',       v_earn,
    'balance',      v_wallet.balance,
    'store_name',   v_store.name,
    'stamp_count',  v_stamp_count,
    'stamp_goal',   COALESCE(v_store.stamp_goal, 10),
    'stamp_reward', v_store.stamp_reward
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.store_checkin TO authenticated;

-- 사장님이 stamp_reward 업데이트할 수 있도록 RPC
CREATE OR REPLACE FUNCTION public.update_stamp_reward(
  p_store_id    uuid,
  p_reward      text,
  p_goal        integer DEFAULT 10
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- 본인 가게만 수정 가능
  IF NOT EXISTS (
    SELECT 1 FROM public.stores WHERE id = p_store_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION '권한이 없어요';
  END IF;

  UPDATE public.stores
  SET stamp_reward = p_reward,
      stamp_goal   = COALESCE(p_goal, 10)
  WHERE id = p_store_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_stamp_reward TO authenticated;
