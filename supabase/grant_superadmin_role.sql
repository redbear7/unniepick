-- hozon@naver.com 계정에 시샵(superadmin) 권한 부여
-- Supabase 대시보드 > SQL Editor 에서 실행

-- 1. users 테이블 role 컬럼에 'superadmin' 추가
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('customer', 'owner', 'superadmin'));

-- 2. hozon@naver.com 을 superadmin으로 변경
UPDATE public.users
SET role = 'superadmin'
WHERE email = 'hozon@naver.com';

-- 3. 결과 확인
SELECT id, email, name, role, created_at
FROM public.users
WHERE email = 'hozon@naver.com';
