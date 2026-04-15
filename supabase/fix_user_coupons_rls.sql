-- user_coupons 테이블 RLS 정책 설정
-- Supabase 대시보드 > SQL Editor 에서 실행

-- RLS 활성화
ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;

-- 기존 정책 제거 후 재생성
DROP POLICY IF EXISTS "user_coupons_select_own"  ON public.user_coupons;
DROP POLICY IF EXISTS "user_coupons_insert_own"  ON public.user_coupons;
DROP POLICY IF EXISTS "user_coupons_update_own"  ON public.user_coupons;

-- 본인 쿠폰만 조회
CREATE POLICY "user_coupons_select_own"
  ON public.user_coupons FOR SELECT
  USING (auth.uid() = user_id);

-- 본인만 쿠폰 발급 (claim)
CREATE POLICY "user_coupons_insert_own"
  ON public.user_coupons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인 쿠폰 상태 변경 (사용/취소)
CREATE POLICY "user_coupons_update_own"
  ON public.user_coupons FOR UPDATE
  USING (auth.uid() = user_id);

-- 사장님(owner)도 자신의 가게 쿠폰 사용 처리 가능 (QR 스캔)
DROP POLICY IF EXISTS "user_coupons_update_owner" ON public.user_coupons;
CREATE POLICY "user_coupons_update_owner"
  ON public.user_coupons FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.coupons c
      JOIN public.stores s ON s.id = c.store_id
      WHERE c.id = user_coupons.coupon_id
        AND s.owner_id = auth.uid()
    )
  );

-- FK 관계가 없다면 추가 (이미 있으면 무시됨)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_coupons_coupon_id_fkey'
      AND table_name = 'user_coupons'
  ) THEN
    ALTER TABLE public.user_coupons
      ADD CONSTRAINT user_coupons_coupon_id_fkey
      FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_coupons_user_id_fkey'
      AND table_name = 'user_coupons'
  ) THEN
    ALTER TABLE public.user_coupons
      ADD CONSTRAINT user_coupons_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;
