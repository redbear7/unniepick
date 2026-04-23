-- ── 가격 제보 즉시 노출 + 투표 기능 ──────────────────────────────

-- 1. price_reports: agree/disagree 카운트 컬럼 추가, 기본 status를 'active'로
ALTER TABLE price_reports
  ADD COLUMN IF NOT EXISTS agree_count    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS disagree_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE price_reports
  ALTER COLUMN status SET DEFAULT 'active';

-- 기존 pending 제보 → active로 전환 (선택: 원하면 실행)
-- UPDATE price_reports SET status = 'active' WHERE status = 'pending';

-- 2. 기존 'approved_read' RLS 정책 교체 → 'active' 제보 전체 공개
DROP POLICY IF EXISTS "price_reports_approved_read" ON price_reports;

CREATE POLICY "price_reports_active_read" ON price_reports
  FOR SELECT USING (status = 'active');

-- 3. 투표 테이블
CREATE TABLE IF NOT EXISTS price_report_votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id  UUID NOT NULL REFERENCES price_reports(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  vote       TEXT NOT NULL CHECK (vote IN ('agree', 'disagree')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (report_id, user_id)   -- 1인 1투표
);

ALTER TABLE price_report_votes ENABLE ROW LEVEL SECURITY;

-- 본인 투표 CRUD
CREATE POLICY "votes_own" ON price_report_votes
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 투표 현황은 누구나 조회
CREATE POLICY "votes_read" ON price_report_votes
  FOR SELECT USING (true);

-- 4. 투표 집계 트리거 (INSERT / UPDATE / DELETE 모두 처리)
CREATE OR REPLACE FUNCTION update_vote_counts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_report_id UUID;
BEGIN
  v_report_id := COALESCE(NEW.report_id, OLD.report_id);
  UPDATE price_reports SET
    agree_count    = (SELECT COUNT(*) FROM price_report_votes WHERE report_id = v_report_id AND vote = 'agree'),
    disagree_count = (SELECT COUNT(*) FROM price_report_votes WHERE report_id = v_report_id AND vote = 'disagree')
  WHERE id = v_report_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_vote_counts ON price_report_votes;
CREATE TRIGGER trg_update_vote_counts
  AFTER INSERT OR UPDATE OR DELETE ON price_report_votes
  FOR EACH ROW EXECUTE FUNCTION update_vote_counts();

-- 5. 어드민: 모든 제보 조회 (status 무관)
-- superadmin 역할 정책은 기존 users 테이블 role 컬럼으로 처리
-- (이미 어드민 대시보드에서 service_role 키로 조회 중이면 불필요)

SELECT 'price_report_votes 테이블 + 즉시 노출 설정 완료' AS result;
