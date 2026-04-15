-- ============================================================
-- 게시물 수정 로그 + 삭제 요청 시스템
-- ① store_post_edit_logs  — 수정 이력
-- ② store_post_delete_requests — 삭제 요청 (사장님 → 시샵)
-- ③ edit_store_post RPC   — 수정 + 로그
-- ④ request_post_delete RPC — 삭제 요청 제출
-- ⑤ process_post_delete_request RPC — 시샵 승인/반려
-- ⑥ post_settings 기본 쿨다운 24h로 변경
-- ============================================================

-- ── 0. post_settings 쿨다운 24h 로 수정 ─────────────────────
UPDATE public.post_settings SET post_cooldown_hours = 24 WHERE id = 1;

-- ── 1. 게시물 수정 로그 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.store_post_edit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid REFERENCES public.store_posts(id) ON DELETE CASCADE,
  store_id    uuid REFERENCES public.stores(id)      ON DELETE CASCADE,
  editor_id   uuid REFERENCES auth.users(id)         ON DELETE SET NULL,
  old_content text NOT NULL,
  new_content text NOT NULL,
  edited_at   timestamptz DEFAULT now()
);

ALTER TABLE public.store_post_edit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read edit logs"
  ON public.store_post_edit_logs FOR SELECT USING (true);

CREATE POLICY "Owners can insert own edit logs"
  ON public.store_post_edit_logs FOR INSERT
  WITH CHECK (auth.uid() = editor_id);

-- ── 2. 게시물 삭제 요청 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.store_post_delete_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      uuid REFERENCES public.store_posts(id) ON DELETE CASCADE,
  store_id     uuid REFERENCES public.stores(id)      ON DELETE CASCADE,
  owner_id     uuid REFERENCES auth.users(id)         ON DELETE SET NULL,
  reason       text NOT NULL CHECK (length(trim(reason)) > 0),
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note   text,
  has_active_coupon boolean NOT NULL DEFAULT false,
  requested_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.store_post_delete_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read delete requests"
  ON public.store_post_delete_requests FOR SELECT USING (true);

CREATE POLICY "Owners can insert own delete requests"
  ON public.store_post_delete_requests FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Superadmin can update delete requests"
  ON public.store_post_delete_requests FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin')
  );

-- ── 3. RPC: 게시물 수정 (수정 로그 자동 기록) ────────────────
CREATE OR REPLACE FUNCTION edit_store_post(
  p_post_id  uuid,
  p_content  text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_store_id  uuid;
  v_old_text  text;
BEGIN
  -- 소유자 확인
  SELECT sp.store_id, sp.content
  INTO   v_store_id, v_old_text
  FROM   public.store_posts sp
  JOIN   public.stores s ON s.id = sp.store_id
  WHERE  sp.id = p_post_id AND s.owner_id = auth.uid();

  IF NOT FOUND THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF trim(p_content) = '' THEN RAISE EXCEPTION 'empty_content'; END IF;
  IF v_old_text = trim(p_content) THEN RAISE EXCEPTION 'no_change'; END IF;

  -- 수정
  UPDATE public.store_posts
  SET content = trim(p_content)
  WHERE id = p_post_id;

  -- 로그 기록
  INSERT INTO public.store_post_edit_logs
    (post_id, store_id, editor_id, old_content, new_content)
  VALUES
    (p_post_id, v_store_id, auth.uid(), v_old_text, trim(p_content));
END;$$;

-- ── 4. RPC: 게시물 삭제 요청 ─────────────────────────────────
CREATE OR REPLACE FUNCTION request_post_delete(
  p_post_id uuid,
  p_reason  text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_store_id         uuid;
  v_has_active_coupon boolean;
  v_req_id           uuid;
BEGIN
  -- 소유자 확인
  SELECT sp.store_id
  INTO   v_store_id
  FROM   public.store_posts sp
  JOIN   public.stores s ON s.id = sp.store_id
  WHERE  sp.id = p_post_id AND s.owner_id = auth.uid();

  IF NOT FOUND THEN RAISE EXCEPTION 'unauthorized'; END IF;

  -- 이미 대기 중인 요청 있으면 중복 방지
  IF EXISTS (
    SELECT 1 FROM public.store_post_delete_requests
    WHERE post_id = p_post_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'request_already_pending';
  END IF;

  -- 현재 활성 쿠폰 여부 확인
  SELECT EXISTS(
    SELECT 1 FROM public.coupons
    WHERE store_id = v_store_id
      AND is_active = true
      AND expires_at > now()
  ) INTO v_has_active_coupon;

  INSERT INTO public.store_post_delete_requests
    (post_id, store_id, owner_id, reason, has_active_coupon)
  VALUES
    (p_post_id, v_store_id, auth.uid(), trim(p_reason), v_has_active_coupon)
  RETURNING id INTO v_req_id;

  RETURN v_req_id;
END;$$;

-- ── 5. RPC: 삭제 요청 처리 (시샵 전용) ───────────────────────
CREATE OR REPLACE FUNCTION process_post_delete_request(
  p_request_id uuid,
  p_action     text,   -- 'approved' | 'rejected'
  p_note       text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_post_id uuid;
BEGIN
  -- 시샵 권한 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin'
  ) THEN RAISE EXCEPTION 'unauthorized'; END IF;

  IF p_action NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  SELECT post_id INTO v_post_id
  FROM public.store_post_delete_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;

  -- 상태 업데이트
  UPDATE public.store_post_delete_requests
  SET
    status       = p_action,
    admin_note   = p_note,
    processed_at = now()
  WHERE id = p_request_id;

  -- 승인이면 게시물 실제 삭제
  IF p_action = 'approved' THEN
    DELETE FROM public.store_posts WHERE id = v_post_id;
  END IF;
END;$$;
