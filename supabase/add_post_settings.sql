-- ============================================================
-- 게시물 작성 시간 제한 설정
-- ① post_settings 싱글턴 테이블
-- ② create_store_post RPC 업데이트 (시간 창 + 쿨다운 검사)
-- ============================================================

-- ── 1. 설정 테이블 ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_settings (
  id                  integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  post_start_hour     integer NOT NULL DEFAULT 8  CHECK (post_start_hour BETWEEN 0 AND 23),
  post_end_hour       integer NOT NULL DEFAULT 20 CHECK (post_end_hour   BETWEEN 1 AND 24),
  post_cooldown_hours integer NOT NULL DEFAULT 12 CHECK (post_cooldown_hours BETWEEN 1 AND 168),
  updated_at          timestamptz DEFAULT now()
);

-- 초기 값 삽입 (중복 무시)
INSERT INTO public.post_settings (id, post_start_hour, post_end_hour, post_cooldown_hours)
VALUES (1, 8, 20, 12)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.post_settings ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능 (사장님/고객 화면에서 안내 목적)
CREATE POLICY "Anyone can read post_settings"
  ON public.post_settings FOR SELECT USING (true);

-- 수정은 시샵만 (service_role 또는 별도 RPC로 처리)
CREATE POLICY "Superadmin can update post_settings"
  ON public.post_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- ── 2. RPC: 게시물 작성 (시간 창 + 쿨다운 검사 포함) ──────────
CREATE OR REPLACE FUNCTION create_store_post(
  p_store_id         uuid,
  p_content          text,
  p_linked_coupon_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id            uuid;
  v_start_hour    integer;
  v_end_hour      integer;
  v_cooldown_hrs  integer;
  v_kst_hour      integer;
  v_last_post_at  timestamptz;
  v_elapsed_secs  integer;
  v_remain_secs   integer;
BEGIN
  -- 소유자 검사
  IF NOT EXISTS (
    SELECT 1 FROM public.stores WHERE id = p_store_id AND owner_id = auth.uid()
  ) THEN RAISE EXCEPTION 'unauthorized'; END IF;

  -- 설정 로드 (없으면 기본값 사용)
  SELECT
    COALESCE(post_start_hour, 8),
    COALESCE(post_end_hour,  20),
    COALESCE(post_cooldown_hours, 12)
  INTO v_start_hour, v_end_hour, v_cooldown_hrs
  FROM public.post_settings
  WHERE id = 1;

  -- 설정 행 없으면 기본값 적용
  IF NOT FOUND THEN
    v_start_hour   := 8;
    v_end_hour     := 20;
    v_cooldown_hrs := 12;
  END IF;

  -- KST 현재 시각 (시)
  v_kst_hour := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Asia/Seoul'))::integer;

  -- 운영 시간 외 검사
  IF v_kst_hour < v_start_hour OR v_kst_hour >= v_end_hour THEN
    RAISE EXCEPTION 'post_outside_hours:%:%', v_start_hour, v_end_hour;
  END IF;

  -- 쿨다운 검사: 이 가게의 최근 게시물 시각
  SELECT created_at INTO v_last_post_at
  FROM public.store_posts
  WHERE store_id = p_store_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last_post_at IS NOT NULL THEN
    v_elapsed_secs := EXTRACT(EPOCH FROM (NOW() - v_last_post_at))::integer;
    IF v_elapsed_secs < (v_cooldown_hrs * 3600) THEN
      v_remain_secs := (v_cooldown_hrs * 3600) - v_elapsed_secs;
      RAISE EXCEPTION 'post_cooldown_active:%', v_remain_secs;
    END IF;
  END IF;

  -- 게시물 삽입
  INSERT INTO public.store_posts (store_id, owner_id, content, linked_coupon_id)
  VALUES (p_store_id, auth.uid(), trim(p_content), p_linked_coupon_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;$$;

-- ── 3. RPC: 게시물 설정 조회 (공개) ────────────────────────
CREATE OR REPLACE FUNCTION get_post_settings()
RETURNS TABLE(post_start_hour integer, post_end_hour integer, post_cooldown_hours integer)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT post_start_hour, post_end_hour, post_cooldown_hours
  FROM public.post_settings WHERE id = 1;
$$;

-- ── 4. RPC: 게시물 설정 수정 (시샵 전용) ─────────────────
CREATE OR REPLACE FUNCTION update_post_settings(
  p_start_hour    integer,
  p_end_hour      integer,
  p_cooldown_hours integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin'
  ) THEN RAISE EXCEPTION 'unauthorized'; END IF;

  INSERT INTO public.post_settings (id, post_start_hour, post_end_hour, post_cooldown_hours, updated_at)
  VALUES (1, p_start_hour, p_end_hour, p_cooldown_hours, now())
  ON CONFLICT (id) DO UPDATE
    SET post_start_hour    = EXCLUDED.post_start_hour,
        post_end_hour      = EXCLUDED.post_end_hour,
        post_cooldown_hours = EXCLUDED.post_cooldown_hours,
        updated_at         = EXCLUDED.updated_at;
END;$$;
