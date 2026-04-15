-- push_tokens → users FK 추가 (없는 경우에만)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'push_tokens_user_id_fkey'
      AND table_name = 'push_tokens'
  ) THEN
    ALTER TABLE public.push_tokens
      ADD CONSTRAINT push_tokens_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;
