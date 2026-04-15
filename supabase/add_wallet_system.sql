-- ══════════════════════════════════════════════════════
-- 언니픽 로컬 전자화폐 (UNNI 코인) 시스템
-- Supabase SQL Editor 에서 실행
-- ══════════════════════════════════════════════════════

-- 1. 적립 정책 (시샵이 관리)
CREATE TABLE IF NOT EXISTS public.earn_policies (
  event_type  text PRIMARY KEY,
  amount      integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  label       text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.earn_policies (event_type, amount, label) VALUES
  ('checkin',    50,  '가게 방문'),
  ('coupon',     30,  '쿠폰 사용'),
  ('receipt',    30,  '영수증 인증'),
  ('review',     20,  '리뷰 작성'),
  ('checkin_daily', 5, '매일 출석'),
  ('referral',  200,  '친구 초대')
ON CONFLICT (event_type) DO NOTHING;

-- 2. 지갑 (1인 1지갑)
CREATE TABLE IF NOT EXISTS public.wallets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance      integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_earned integer NOT NULL DEFAULT 0,
  total_spent  integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallets_own" ON public.wallets
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wallets_admin_read" ON public.wallets FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin'
  ));

-- 3. 트랜잭션 내역
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          text NOT NULL CHECK (type IN (
                  'earn_checkin','earn_coupon','earn_receipt',
                  'earn_review','earn_checkin_daily','earn_referral','earn_event',
                  'spend_coupon','spend_payment','spend_gift','expire'
                )),
  amount        integer NOT NULL,
  balance_after integer NOT NULL,
  store_id      uuid REFERENCES public.stores(id),
  description   text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_tx_own" ON public.wallet_transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wallet_tx_admin" ON public.wallet_transactions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin'
  ));

-- 4. 가게 방문 체크인 (중복방지)
-- checkin_date 컬럼으로 하루 1회 제한 (IMMUTABLE 이슈 우회)
CREATE TABLE IF NOT EXISTS public.store_checkins (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id     uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  checkin_date date NOT NULL DEFAULT CURRENT_DATE,
  latitude     double precision,
  longitude    double precision,
  earned       integer NOT NULL DEFAULT 50,
  checked_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, store_id, checkin_date)
);

ALTER TABLE public.store_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checkins_own" ON public.store_checkins
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────
-- 5. RPC: 지갑 생성 또는 조회 (upsert)
-- ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_or_create_wallet(p_user_id uuid)
RETURNS public.wallets LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.wallets;
BEGIN
  INSERT INTO public.wallets (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM public.wallets WHERE user_id = p_user_id;
  RETURN w;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_or_create_wallet TO authenticated;

-- ──────────────────────────────────────────────────────
-- 6. RPC: 가게 방문 체크인 (GPS 검증 + 적립)
-- ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.store_checkin(
  p_user_id  uuid,
  p_store_id uuid,
  p_lat      double precision,
  p_lng      double precision
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_store        public.stores;
  v_policy       public.earn_policies;
  v_wallet       public.wallets;
  v_dist_m       double precision;
  v_earn         integer;
  v_new_balance  integer;
  v_today        date := CURRENT_DATE;
BEGIN
  -- 가게 정보 조회
  SELECT * INTO v_store FROM public.stores WHERE id = p_store_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'store_not_found');
  END IF;

  -- GPS 검증 (가게 좌표가 등록된 경우만)
  IF v_store.latitude IS NOT NULL AND v_store.longitude IS NOT NULL THEN
    -- Haversine 간소화 (평면 근사, 200m 반경)
    v_dist_m := 111320 * sqrt(
      power(p_lat - v_store.latitude, 2) +
      power((p_lng - v_store.longitude) * cos(radians(v_store.latitude)), 2)
    );
    IF v_dist_m > 200 THEN
      RETURN jsonb_build_object(
        'success', false,
        'reason', 'too_far',
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

  -- 적립 금액 조회
  SELECT amount INTO v_earn FROM public.earn_policies
  WHERE event_type = 'checkin' AND is_active = true;
  v_earn := COALESCE(v_earn, 50);

  -- 지갑 생성 or 잔액 업데이트
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
     p_store_id, v_store.name || ' 방문 적립');

  -- 체크인 기록
  INSERT INTO public.store_checkins
    (user_id, store_id, checkin_date, latitude, longitude, earned)
  VALUES
    (p_user_id, p_store_id, v_today, p_lat, p_lng, v_earn);

  RETURN jsonb_build_object(
    'success',      true,
    'earned',       v_earn,
    'balance',      v_wallet.balance,
    'store_name',   v_store.name
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.store_checkin TO authenticated;

-- ──────────────────────────────────────────────────────
-- 7. RPC: UNNI 적립 (쿠폰/영수증 등 범용)
-- ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.earn_unni(
  p_user_id    uuid,
  p_event_type text,
  p_store_id   uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_earn        integer;
  v_wallet      public.wallets;
  v_desc        text;
BEGIN
  SELECT amount, label INTO v_earn, v_desc FROM public.earn_policies
  WHERE event_type = p_event_type AND is_active = true;

  IF v_earn IS NULL OR v_earn = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'policy_not_found');
  END IF;

  INSERT INTO public.wallets (user_id, balance, total_earned)
  VALUES (p_user_id, v_earn, v_earn)
  ON CONFLICT (user_id) DO UPDATE SET
    balance      = wallets.balance + v_earn,
    total_earned = wallets.total_earned + v_earn,
    updated_at   = now()
  RETURNING * INTO v_wallet;

  INSERT INTO public.wallet_transactions
    (user_id, type, amount, balance_after, store_id, description)
  VALUES
    (p_user_id, 'earn_' || p_event_type, v_earn, v_wallet.balance,
     p_store_id, v_desc || ' 적립');

  RETURN jsonb_build_object(
    'success', true,
    'earned',  v_earn,
    'balance', v_wallet.balance
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.earn_unni TO authenticated;
