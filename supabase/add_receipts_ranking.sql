-- ============================================================
-- 맛집픽 영수증 인증 + 랭킹 시스템
-- ============================================================

-- 1. 프로필 테이블 (닉네임 포함)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nickname text NOT NULL DEFAULT '맛집러',
  avatar_emoji text DEFAULT '🐻',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. 영수증 인증 이력 (이미지 절대 저장 안 함)
CREATE TABLE IF NOT EXISTS public.receipt_verifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  store_id uuid REFERENCES public.stores(id),
  district_id uuid REFERENCES public.districts(id),
  store_name text,       -- 가맹점 이름 (스냅샷)
  district_name text,    -- 상권 이름 (스냅샷)
  amount integer NOT NULL CHECK (amount > 0),  -- 영수증 금액(원)
  receipt_datetime timestamptz NOT NULL,       -- 영수증상 날짜/시간
  user_lat double precision,  -- 인증 시 사용자 위도 (개인정보 주의)
  user_lng double precision,  -- 인증 시 사용자 경도
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.receipt_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "receipt_select_own" ON public.receipt_verifications;
DROP POLICY IF EXISTS "receipt_insert_own" ON public.receipt_verifications;
DROP POLICY IF EXISTS "receipt_select_all" ON public.receipt_verifications;
CREATE POLICY "receipt_select_own" ON public.receipt_verifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "receipt_insert_own" ON public.receipt_verifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);
-- 랭킹 집계를 위해 전체 조회 허용 (금액/닉네임만 공개)
CREATE POLICY "receipt_select_all" ON public.receipt_verifications
  FOR SELECT USING (true);

-- users 테이블에 nickname 컬럼 추가 (기존 테이블 호환)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nickname text;

-- 3. RPC: 상권별 랭킹 집계 함수
CREATE OR REPLACE FUNCTION public.get_district_ranking(p_district_id uuid DEFAULT NULL)
RETURNS TABLE (
  rank_no bigint,
  user_id uuid,
  nickname text,
  avatar_emoji text,
  total_amount bigint,
  receipt_count bigint,
  coupon_used_count bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(rv.amount), 0) DESC) as rank_no,
    p.id as user_id,
    p.nickname,
    p.avatar_emoji,
    COALESCE(SUM(rv.amount), 0)::bigint as total_amount,
    COUNT(DISTINCT rv.id)::bigint as receipt_count,
    COALESCE(
      (SELECT COUNT(*) FROM public.user_coupons uc
       WHERE uc.user_id = p.id AND uc.status = 'used'),
      0
    )::bigint as coupon_used_count
  FROM public.profiles p
  LEFT JOIN public.receipt_verifications rv
    ON rv.user_id = p.id
    AND (p_district_id IS NULL OR rv.district_id = p_district_id)
  GROUP BY p.id, p.nickname, p.avatar_emoji
  HAVING COALESCE(SUM(rv.amount), 0) > 0
  ORDER BY total_amount DESC;
$$;

-- 4. RPC: 내 랭킹 순위 조회
CREATE OR REPLACE FUNCTION public.get_my_rank(p_user_id uuid, p_district_id uuid DEFAULT NULL)
RETURNS TABLE (
  rank_no bigint,
  total_amount bigint,
  receipt_count bigint,
  coupon_used_count bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT rank_no, total_amount, receipt_count, coupon_used_count
  FROM public.get_district_ranking(p_district_id)
  WHERE user_id = p_user_id;
$$;

-- 5. 영수증 중복 인증 방지: 같은 금액 + 같은 날짜/시간 조합 방지
CREATE UNIQUE INDEX IF NOT EXISTS receipt_dedup
  ON public.receipt_verifications (user_id, amount, receipt_datetime);

SELECT 'receipt_ranking_system_ready' as status;
