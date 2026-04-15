-- ────────────────────────────────────────────────────────────────────
-- 1. 무제한 수량: total_quantity NULL 허용 (NULL = 무제한)
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE coupons ALTER COLUMN total_quantity DROP NOT NULL;
ALTER TABLE coupons ALTER COLUMN total_quantity SET DEFAULT NULL;

-- ────────────────────────────────────────────────────────────────────
-- 2. pick_count 컬럼 추가
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE coupons     ADD COLUMN IF NOT EXISTS pick_count integer DEFAULT 0;
ALTER TABLE store_posts ADD COLUMN IF NOT EXISTS pick_count integer DEFAULT 0;

-- ────────────────────────────────────────────────────────────────────
-- 3. PICK 테이블 (쿠폰/게시물 공통 북마크)
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feed_picks (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('post','coupon')),
  target_id   uuid NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

ALTER TABLE feed_picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read picks"       ON feed_picks FOR SELECT USING (true);
CREATE POLICY "Users can manage own picks"  ON feed_picks FOR ALL
  USING (auth.uid() = user_id);

-- ── RPC: PICK 토글 ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION toggle_feed_pick(
  p_target_type text,
  p_target_id   uuid
) RETURNS TABLE(is_picked boolean, pick_count bigint)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_exists boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'login_required'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM feed_picks
    WHERE user_id = v_uid AND target_type = p_target_type AND target_id = p_target_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM feed_picks
    WHERE user_id = v_uid AND target_type = p_target_type AND target_id = p_target_id;
    IF p_target_type = 'post' THEN
      UPDATE store_posts SET pick_count = GREATEST(0, pick_count - 1) WHERE id = p_target_id;
    ELSIF p_target_type = 'coupon' THEN
      UPDATE coupons SET pick_count = GREATEST(0, pick_count - 1) WHERE id = p_target_id;
    END IF;
  ELSE
    INSERT INTO feed_picks (user_id, target_type, target_id)
    VALUES (v_uid, p_target_type, p_target_id);
    IF p_target_type = 'post' THEN
      UPDATE store_posts SET pick_count = pick_count + 1 WHERE id = p_target_id;
    ELSIF p_target_type = 'coupon' THEN
      UPDATE coupons SET pick_count = pick_count + 1 WHERE id = p_target_id;
    END IF;
  END IF;

  RETURN QUERY
    SELECT
      (NOT v_exists) AS is_picked,
      (SELECT COUNT(*)::bigint FROM feed_picks
       WHERE target_type = p_target_type AND target_id = p_target_id) AS pick_count;
END;$$;

-- ── 쿠폰 수량 체크: NULL = 무제한 ─────────────────────────────────────
-- claimCoupon 로직은 프론트엔드에서 처리하므로 DB 함수 수정 불필요
-- 단, 기존 RPC가 있다면 아래 처럼 수정 필요:
-- IF coupon.total_quantity IS NOT NULL AND coupon.issued_count >= coupon.total_quantity THEN
--   RAISE EXCEPTION 'sold_out';
-- END IF;
