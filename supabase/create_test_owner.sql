-- ============================================================
-- 테스트용 사장님 계정 생성
-- 가장 최근에 등록된 더미 가게(우리동네 맛집 이태원점)에 연결
-- Supabase Dashboard → SQL Editor → 실행
-- ============================================================

DO $$
DECLARE
  v_user_id   uuid := gen_random_uuid();
  v_store_id  uuid;
  v_store_name text;
BEGIN

  -- 1. 가장 최근 더미 가게 조회 (owner_id가 없는 가게 중 최신)
  SELECT id, name
    INTO v_store_id, v_store_name
    FROM public.stores
   WHERE owner_id IS NULL
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION '연결할 가게가 없어요. owner_id 없는 가게를 확인해주세요.';
  END IF;

  -- 2. 이미 계정이 있으면 기존 ID 사용, 없으면 새로 생성
  SELECT id INTO v_user_id
    FROM auth.users
   WHERE email = 'testowner@unniepick.com'
   LIMIT 1;

  IF v_user_id IS NULL THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role,
      aud
    ) VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'testowner@unniepick.com',
      crypt('test1234', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"테스트 사장님"}',
      false,
      'authenticated',
      'authenticated'
    )
    RETURNING id INTO v_user_id;
  END IF;

  -- 3. public.users 에도 등록 (stores.owner_id FK가 public.users 참조)
  INSERT INTO public.users (id, email, name, phone, role, created_at)
  VALUES (v_user_id, 'testowner@unniepick.com', '테스트 사장님', '010-0000-0000', 'owner', now())
  ON CONFLICT (id) DO UPDATE SET role = 'owner', email = 'testowner@unniepick.com';

  -- 4. 가게의 owner_id를 테스트 계정으로 연결
  UPDATE public.stores
     SET owner_id = v_user_id
   WHERE id = v_store_id;

  -- 5. auth.identities 등록 (이메일 로그인 활성화)
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    created_at,
    updated_at,
    last_sign_in_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    'testowner@unniepick.com',
    jsonb_build_object(
      'sub',   v_user_id::text,
      'email', 'testowner@unniepick.com'
    ),
    'email',
    now(),
    now(),
    now()
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✅ 완료!';
  RAISE NOTICE '📧 이메일: testowner@unniepick.com';
  RAISE NOTICE '🔑 비밀번호: test1234';
  RAISE NOTICE '🏪 연결된 가게: % (id: %)', v_store_name, v_store_id;
  RAISE NOTICE '👤 user_id: %', v_user_id;

END $$;
