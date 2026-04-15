-- ────────────────────────────────────────────────────────────────
-- 배너 광고 테이블
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS banner_ads (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title         text NOT NULL,
  subtitle      text,
  emoji         text DEFAULT '🎉',
  bg_color      text DEFAULT '#5B67CA',
  text_color    text DEFAULT '#FFFFFF',
  cta_text      text DEFAULT '자세히 보기',
  -- 링크 타입: 'none' | 'store' | 'coupon' | 'external'
  link_type     text DEFAULT 'none',
  link_value    text,                        -- store_id / coupon_id / URL
  starts_at     timestamptz DEFAULT now(),
  ends_at       timestamptz,
  is_paused     boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE banner_ads ENABLE ROW LEVEL SECURITY;

-- 고객: 활성 배너만 조회
CREATE POLICY "Public read active banners" ON banner_ads
  FOR SELECT USING (
    NOT is_paused
    AND (ends_at IS NULL OR ends_at > now())
    AND starts_at <= now()
  );

-- 시샵: 전체 관리 (SECURITY DEFINER 함수로 우회)
-- (별도 RPC로 처리)

-- ── RPC: 배너 생성 ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_banner_ad(
  p_title         text,
  p_subtitle      text         DEFAULT NULL,
  p_emoji         text         DEFAULT '🎉',
  p_bg_color      text         DEFAULT '#5B67CA',
  p_text_color    text         DEFAULT '#FFFFFF',
  p_cta_text      text         DEFAULT '자세히 보기',
  p_link_type     text         DEFAULT 'none',
  p_link_value    text         DEFAULT NULL,
  p_starts_at     timestamptz  DEFAULT now(),
  p_ends_at       timestamptz  DEFAULT NULL,
  p_display_order integer      DEFAULT 0
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO banner_ads (title, subtitle, emoji, bg_color, text_color,
                          cta_text, link_type, link_value, starts_at, ends_at, display_order)
  VALUES (p_title, p_subtitle, p_emoji, p_bg_color, p_text_color,
          p_cta_text, p_link_type, p_link_value, p_starts_at, p_ends_at, p_display_order)
  RETURNING id INTO v_id;
  RETURN v_id;
END;$$;

-- ── RPC: 배너 일시중지 / 재개 ──────────────────────────────────────
CREATE OR REPLACE FUNCTION toggle_banner_pause(p_id uuid, p_pause boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE banner_ads SET is_paused = p_pause WHERE id = p_id;
END;$$;

-- ── RPC: 배너 삭제 ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION delete_banner_ad(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM banner_ads WHERE id = p_id;
END;$$;

-- ── RPC: 배너 수정 ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_banner_ad(
  p_id            uuid,
  p_title         text,
  p_subtitle      text         DEFAULT NULL,
  p_emoji         text         DEFAULT '🎉',
  p_bg_color      text         DEFAULT '#5B67CA',
  p_text_color    text         DEFAULT '#FFFFFF',
  p_cta_text      text         DEFAULT '자세히 보기',
  p_link_type     text         DEFAULT 'none',
  p_link_value    text         DEFAULT NULL,
  p_starts_at     timestamptz  DEFAULT now(),
  p_ends_at       timestamptz  DEFAULT NULL,
  p_display_order integer      DEFAULT 0
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE banner_ads
  SET title = p_title, subtitle = p_subtitle, emoji = p_emoji,
      bg_color = p_bg_color, text_color = p_text_color, cta_text = p_cta_text,
      link_type = p_link_type, link_value = p_link_value,
      starts_at = p_starts_at, ends_at = p_ends_at,
      display_order = p_display_order
  WHERE id = p_id;
END;$$;

-- ── 시샵 전체 배너 조회 뷰 ────────────────────────────────────────
CREATE OR REPLACE VIEW all_banner_ads AS
  SELECT * FROM banner_ads ORDER BY display_order ASC, created_at DESC;
