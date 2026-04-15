-- ══════════════════════════════════════════════════════════════════
-- 관심 가게 기능 + 스탬프 자동 적립 (12시간 쿨다운)
-- ══════════════════════════════════════════════════════════════════

-- ── 1. 찜한 가게 ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.store_favorites (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id   uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, store_id)
);

ALTER TABLE public.store_favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fav_all" ON public.store_favorites;
CREATE POLICY "fav_all" ON public.store_favorites
  FOR ALL USING (auth.uid() = user_id);

-- ── 2. 최근 본 가게 (upsert viewed_at on each visit) ────────────
CREATE TABLE IF NOT EXISTS public.store_views (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id  uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, store_id)
);

ALTER TABLE public.store_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "views_all" ON public.store_views;
CREATE POLICY "views_all" ON public.store_views
  FOR ALL USING (auth.uid() = user_id);

-- ── 3. 스탬프 적립 로그 (12시간 쿨다운 추적) ─────────────────────
CREATE TABLE IF NOT EXISTS public.stamp_logs (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id   uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  source     text NOT NULL DEFAULT 'owner_scan'
               CHECK (source IN ('coupon_used', 'receipt', 'owner_scan')),
  stamped_at timestamptz DEFAULT now()
);

ALTER TABLE public.stamp_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stamp_logs_read" ON public.stamp_logs;
CREATE POLICY "stamp_logs_read" ON public.stamp_logs
  FOR SELECT USING (auth.uid() = user_id);
-- INSERT는 SECURITY DEFINER RPC 에서만

-- ── 4. try_add_stamp RPC ──────────────────────────────────────────
--   12시간 쿨다운 체크 → 스탬프 적립 → 로그 기록
--   반환: { success, reason?, stamp_count?, is_reward?, next_available? }
CREATE OR REPLACE FUNCTION public.try_add_stamp(
  p_user_id  uuid,
  p_store_id uuid,
  p_source   text DEFAULT 'owner_scan'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_stamp     timestamptz;
  v_card_id        uuid;
  v_stamp_count    integer := 0;
  v_required_count integer := 10;
  v_new_count      integer;
  v_is_reward      boolean := false;
BEGIN
  -- 12시간 쿨다운 체크
  SELECT stamped_at INTO v_last_stamp
  FROM public.stamp_logs
  WHERE user_id = p_user_id AND store_id = p_store_id
  ORDER BY stamped_at DESC
  LIMIT 1;

  IF v_last_stamp IS NOT NULL AND (now() - v_last_stamp) < interval '12 hours' THEN
    RETURN jsonb_build_object(
      'success',        false,
      'reason',         'cooldown',
      'next_available', to_char(
        v_last_stamp + interval '12 hours',
        'YYYY-MM-DD"T"HH24:MI:SS"Z"'
      )
    );
  END IF;

  -- 스탬프 카드 조회 또는 생성
  SELECT id, stamp_count, COALESCE(required_count, 10)
  INTO   v_card_id, v_stamp_count, v_required_count
  FROM   public.stamp_cards
  WHERE  user_id = p_user_id AND store_id = p_store_id;

  IF v_card_id IS NULL THEN
    INSERT INTO public.stamp_cards (user_id, store_id, stamp_count)
    VALUES (p_user_id, p_store_id, 0)
    RETURNING id, stamp_count, COALESCE(required_count, 10)
    INTO v_card_id, v_stamp_count, v_required_count;
  END IF;

  v_new_count := v_stamp_count + 1;

  -- 리워드 도달 시 리셋
  IF v_new_count >= v_required_count THEN
    v_new_count := 0;
    v_is_reward := true;
  END IF;

  UPDATE public.stamp_cards
  SET    stamp_count = v_new_count
  WHERE  id = v_card_id;

  INSERT INTO public.stamp_logs (user_id, store_id, source)
  VALUES (p_user_id, p_store_id, p_source);

  RETURN jsonb_build_object(
    'success',     true,
    'stamp_count', v_new_count,
    'is_reward',   v_is_reward
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_add_stamp TO authenticated;
