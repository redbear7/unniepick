-- ────────────────────────────────────────────────────────────────
-- 쿠폰 사용 후기 테이블
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupon_reviews (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_coupon_id uuid REFERENCES user_coupons(id) ON DELETE CASCADE,
  user_id        uuid REFERENCES auth.users(id)   ON DELETE CASCADE,
  coupon_id      uuid REFERENCES coupons(id)       ON DELETE CASCADE,
  store_id       uuid REFERENCES stores(id)        ON DELETE CASCADE,
  rating         smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        text,
  created_at     timestamptz DEFAULT now(),
  UNIQUE(user_coupon_id)   -- 쿠폰 1개당 후기 1개
);

-- RLS
ALTER TABLE coupon_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reviews"       ON coupon_reviews FOR SELECT USING (true);
CREATE POLICY "Users can insert own review"   ON coupon_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own review"   ON coupon_reviews FOR UPDATE
  USING (auth.uid() = user_id);

-- ── RPC: 후기 등록 / 수정 ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION submit_coupon_review(
  p_user_coupon_id uuid,
  p_rating         smallint,
  p_comment        text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id  uuid;
  v_coupon_id uuid;
  v_store_id  uuid;
  v_status    text;
BEGIN
  SELECT uc.user_id, uc.coupon_id, c.store_id, uc.status
    INTO v_user_id, v_coupon_id, v_store_id, v_status
    FROM user_coupons uc
    JOIN coupons c ON c.id = uc.coupon_id
    WHERE uc.id = p_user_coupon_id;

  IF v_user_id IS NULL     THEN RAISE EXCEPTION 'coupon_not_found'; END IF;
  IF v_user_id != auth.uid() THEN RAISE EXCEPTION 'unauthorized';   END IF;
  IF v_status  != 'used'   THEN RAISE EXCEPTION 'coupon_not_used';  END IF;

  INSERT INTO coupon_reviews
    (user_coupon_id, user_id, coupon_id, store_id, rating, comment)
  VALUES
    (p_user_coupon_id, v_user_id, v_coupon_id, v_store_id, p_rating, p_comment)
  ON CONFLICT (user_coupon_id) DO UPDATE
    SET rating = p_rating, comment = p_comment;
END;$$;

-- ── RPC: 특정 user_coupon 후기 조회 ──────────────────────────────
CREATE OR REPLACE FUNCTION get_my_review(p_user_coupon_id uuid)
RETURNS TABLE (
  id             uuid,
  rating         smallint,
  comment        text,
  created_at     timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT r.id, r.rating, r.comment, r.created_at
    FROM coupon_reviews r
    WHERE r.user_coupon_id = p_user_coupon_id
      AND r.user_id = auth.uid();
END;$$;

-- ── 가게별 평균 평점 뷰 (StoreHome 등에서 활용) ────────────────────
CREATE OR REPLACE VIEW store_review_stats AS
  SELECT
    store_id,
    COUNT(*)::integer                    AS review_count,
    ROUND(AVG(rating)::numeric, 1)       AS avg_rating
  FROM coupon_reviews
  GROUP BY store_id;
