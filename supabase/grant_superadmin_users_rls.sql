-- 시샵이 회원 목록을 조회할 수 있도록 RLS 정책 추가
-- Supabase 대시보드 > SQL Editor 에서 실행

-- users 테이블에 superadmin SELECT 정책 추가
DROP POLICY IF EXISTS "superadmin_read_all_users" ON public.users;

CREATE POLICY "superadmin_read_all_users"
  ON public.users FOR SELECT
  USING (
    -- 본인 데이터는 항상 조회 가능
    auth.uid() = id
    OR
    -- superadmin 은 전체 조회 가능
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'superadmin'
    )
  );

-- stores 테이블에서 owner_id 기준으로 users 조인이 가능하도록
-- (stores SELECT 정책은 이미 "전체 조회" 이므로 추가 불필요)

-- 결과 확인: 현재 users 테이블 역할별 통계
SELECT role, count(*) as cnt
FROM public.users
GROUP BY role
ORDER BY cnt DESC;
