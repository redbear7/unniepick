-- ────────────────────────────────────────────────────────────────────
-- 가게 스레드 게시물
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_posts (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id         uuid REFERENCES stores(id) ON DELETE CASCADE,
  owner_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content          text NOT NULL CHECK (length(trim(content)) > 0),
  linked_coupon_id uuid REFERENCES coupons(id) ON DELETE SET NULL,
  like_count       integer DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE store_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read posts"       ON store_posts FOR SELECT USING (true);
CREATE POLICY "Owners can insert own posts" ON store_posts FOR INSERT
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can delete own posts" ON store_posts FOR DELETE
  USING (auth.uid() = owner_id);

-- ────────────────────────────────────────────────────────────────────
-- 피드 좋아요 (게시물 + 쿠폰 공통)
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feed_likes (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('post','coupon')),
  target_id   uuid NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

ALTER TABLE feed_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read likes"        ON feed_likes FOR SELECT USING (true);
CREATE POLICY "Users can manage own likes"   ON feed_likes FOR ALL
  USING (auth.uid() = user_id);

-- ── RPC: 좋아요 토글 ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION toggle_feed_like(
  p_target_type text,
  p_target_id   uuid
) RETURNS TABLE(is_liked boolean, like_count bigint)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_exists boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'login_required'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM feed_likes
    WHERE user_id = v_uid AND target_type = p_target_type AND target_id = p_target_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM feed_likes
    WHERE user_id = v_uid AND target_type = p_target_type AND target_id = p_target_id;
    IF p_target_type = 'post' THEN
      UPDATE store_posts SET like_count = GREATEST(0, like_count - 1) WHERE id = p_target_id;
    END IF;
  ELSE
    INSERT INTO feed_likes (user_id, target_type, target_id)
    VALUES (v_uid, p_target_type, p_target_id);
    IF p_target_type = 'post' THEN
      UPDATE store_posts SET like_count = like_count + 1 WHERE id = p_target_id;
    END IF;
  END IF;

  RETURN QUERY
    SELECT
      (NOT v_exists) AS is_liked,
      (SELECT COUNT(*)::bigint FROM feed_likes
       WHERE target_type = p_target_type AND target_id = p_target_id) AS like_count;
END;$$;

-- ── RPC: 게시물 작성 ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_store_post(
  p_store_id         uuid,
  p_content          text,
  p_linked_coupon_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM stores WHERE id = p_store_id AND owner_id = auth.uid()
  ) THEN RAISE EXCEPTION 'unauthorized'; END IF;

  INSERT INTO store_posts (store_id, owner_id, content, linked_coupon_id)
  VALUES (p_store_id, auth.uid(), trim(p_content), p_linked_coupon_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;$$;

-- ── RPC: 게시물 삭제 ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION delete_store_post(p_post_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM store_posts WHERE id = p_post_id AND owner_id = auth.uid();
END;$$;
