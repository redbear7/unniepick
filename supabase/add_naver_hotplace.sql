-- ============================================================
-- 네이버 업체정보 연동 · 핫플 등록 기능
-- ============================================================

-- 1. stores 테이블에 네이버 관련 컬럼 추가
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS naver_place_id   text    UNIQUE,
  ADD COLUMN IF NOT EXISTS naver_place_url  text,
  ADD COLUMN IF NOT EXISTS naver_thumbnail  text,
  ADD COLUMN IF NOT EXISTS is_closed        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS naver_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_hotplace      boolean NOT NULL DEFAULT false;

-- 2. 시샵 전용 핫플 직접 등록 RPC
--    (owner_id 없이 시샵이 직접 가게를 등록)
CREATE OR REPLACE FUNCTION public.register_hotplace(
  p_name          text,
  p_category      text,
  p_address       text,
  p_phone         text,
  p_latitude      double precision,
  p_longitude     double precision,
  p_naver_place_id text,
  p_naver_place_url text,
  p_naver_thumbnail text DEFAULT NULL,
  p_description   text  DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_store_id uuid;
BEGIN
  -- 이미 등록된 네이버 업체인지 확인
  IF p_naver_place_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.stores WHERE naver_place_id = p_naver_place_id
  ) THEN
    RAISE EXCEPTION '이미 등록된 업체예요 (네이버 ID: %)', p_naver_place_id;
  END IF;

  INSERT INTO public.stores (
    name, category, address, phone,
    latitude, longitude,
    naver_place_id, naver_place_url, naver_thumbnail,
    description, is_active, is_hotplace
  ) VALUES (
    p_name, p_category, p_address, p_phone,
    p_latitude, p_longitude,
    p_naver_place_id, p_naver_place_url, p_naver_thumbnail,
    p_description, true, true
  )
  RETURNING id INTO v_store_id;

  RETURN v_store_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.register_hotplace TO authenticated;

-- 3. 폐업 상태 업데이트 RPC
CREATE OR REPLACE FUNCTION public.update_store_closure(
  p_store_id  uuid,
  p_is_closed boolean
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.stores
  SET is_closed        = p_is_closed,
      is_active        = NOT p_is_closed,
      naver_checked_at = now()
  WHERE id = p_store_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_store_closure TO authenticated;

-- 4. 핫플 목록 조회 뷰 (시샵 전용)
CREATE OR REPLACE VIEW public.hotplace_stores AS
SELECT
  id, name, category, address, phone,
  latitude, longitude,
  naver_place_id, naver_place_url, naver_thumbnail,
  is_closed, is_hotplace, is_active,
  naver_checked_at, created_at
FROM public.stores
WHERE naver_place_id IS NOT NULL
ORDER BY created_at DESC;

GRANT SELECT ON public.hotplace_stores TO authenticated;
