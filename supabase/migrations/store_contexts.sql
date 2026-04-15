-- ================================================================
-- store_contexts 테이블 — Phase 1: 매장 컨텍스트 수집
-- 카카오 로컬 API + Open-Meteo + Claude Vision 결과 저장
-- ================================================================

CREATE TABLE IF NOT EXISTS public.store_contexts (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,

  -- 위치
  location_lat      float,
  location_lng      float,

  -- 날씨 (Open-Meteo)
  weather_zone      text,        -- 'hot-humid' | 'cold-dry' | 'mild-spring' | 'rainy' | 'snowy'
  weather_temp      float,       -- 현재 기온 (°C)
  weather_code      int,         -- Open-Meteo WMO 코드

  -- 상권 (카카오 로컬 API)
  district_type     text,        -- '번화가' | '주거지' | '오피스' | '골목상권' | '학교상권' | '관광지'
  district_detail   text,        -- 행정구역명 예: '서울 강남구 역삼동'
  nearby_counts     jsonb,       -- { restaurant: 12, cafe: 5, convenience: 3, ... }

  -- 메뉴 (사장님 입력 → 태그 변환)
  menu_tags         text[],      -- ['삼겹살', '소주', '된장찌개']

  -- 인테리어 (Claude Vision 분석)
  interior_tags     text[],      -- ['모던', '밝은', '화이트톤', '넓음']
  interior_style    text,        -- '인더스트리얼' | '미니멀' | '빈티지' 등
  energy_level      float,       -- 공간 에너지 레벨 0.0~1.0
  interior_analyzed boolean      DEFAULT false,

  updated_at        timestamptz  DEFAULT now(),

  UNIQUE (store_id)
);

-- RLS
ALTER TABLE public.store_contexts ENABLE ROW LEVEL SECURITY;

-- 사장님: 자신의 매장 컨텍스트만 읽기/쓰기
CREATE POLICY "owner_read_own_context" ON public.store_contexts
  FOR SELECT USING (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "owner_upsert_own_context" ON public.store_contexts
  FOR ALL USING (
    store_id IN (
      SELECT id FROM public.stores WHERE owner_id = auth.uid()
    )
  );

-- 시샵(superadmin): 전체 읽기
CREATE POLICY "superadmin_read_all_contexts" ON public.store_contexts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.update_store_contexts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_store_contexts_updated_at
  BEFORE UPDATE ON public.store_contexts
  FOR EACH ROW EXECUTE FUNCTION public.update_store_contexts_updated_at();
