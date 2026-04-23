// useMySummary — profiles + 카운트 3종 (핸드오프 Section 03 Query A·B)
// 5분 캐시 (staleAt ref), profiles 컬럼 없어도 안전한 fallback 포함

import { useCallback, useEffect, useRef, useState } from 'react';
import { differenceInDays } from '../../../lib/utils/date';
import { supabase } from '../../../lib/supabase';

export interface MySummary {
  nickname:      string;
  joinedDays:    number;
  level:         string;    // '브론즈' | '실버' | '골드'
  levelProgress: number;    // 0–1
  pointToNext:   number;
  nextLevel:     string;
  locationName:  string | null;
  birthMonth:    number | null;
  birthDay:      number | null;
  phone:         string | null;  // raw phone e.g. "+821012345678"
  inviteCount:   number;
  walletCount:   number;
  followingCount: number;
  usedCount:     number;
}

const STALE_MS = 5 * 60 * 1000; // 5분

const DEFAULT: MySummary = {
  nickname:      '언니님',
  joinedDays:    0,
  level:         '브론즈',
  levelProgress: 0,
  pointToNext:   100,
  nextLevel:     '실버',
  locationName:  null,
  birthMonth:    null,
  birthDay:      null,
  phone:         null,
  inviteCount:   0,
  walletCount:   0,
  followingCount: 0,
  usedCount:     0,
};

// 레벨 계산 — profiles.level 컬럼 없는 경우 point 기반 추정
function resolveLevel(raw: {
  level?: string | null;
  level_progress?: number | null;
  point_to_next?: number | null;
}): Pick<MySummary, 'level' | 'levelProgress' | 'pointToNext' | 'nextLevel'> {
  if (raw.level) {
    const lvl = raw.level;
    const next = lvl === '브론즈' ? '실버' : lvl === '실버' ? '골드' : '골드';
    return {
      level:         lvl,
      levelProgress: typeof raw.level_progress === 'number' ? raw.level_progress : 0,
      pointToNext:   typeof raw.point_to_next  === 'number' ? raw.point_to_next  : 0,
      nextLevel:     next,
    };
  }
  // 컬럼 없음 → 브론즈 기본
  return { level: '브론즈', levelProgress: 0, pointToNext: 100, nextLevel: '실버' };
}

export function useMySummary() {
  const [summary,  setSummary]  = useState<MySummary>(DEFAULT);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const staleAt    = useRef<number>(0);

  const load = useCallback(async (force = false) => {
    if (!force && Date.now() < staleAt.current) return; // 캐시 유효

    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) {
        setSummary(DEFAULT);
        return;
      }

      // ── Query A: profiles ───────────────────────────────────────
      const { data: prof } = await supabase
        .from('profiles')
        .select('nickname, created_at, level, level_progress, point_to_next, location_name, birth_month, birth_day, invite_count')
        .eq('id', uid)
        .maybeSingle();

      const metaNickname = session?.user?.user_metadata?.nickname as string | undefined;
      const nickname   = prof?.nickname || metaNickname || '언니님';
      const joinedDays = prof?.created_at
        ? differenceInDays(new Date(), new Date(prof.created_at))
        : 0;
      const levelInfo    = resolveLevel(prof ?? {});
      const locationName = prof?.location_name ?? null;
      const birthMonth   = typeof prof?.birth_month === 'number' ? prof.birth_month : null;
      const birthDay     = typeof prof?.birth_day   === 'number' ? prof.birth_day   : null;
      const inviteCount  = typeof prof?.invite_count === 'number' ? prof.invite_count : 0;
      const phone        = session?.user?.phone ?? null;

      // ── Query B: 카운트 3종 (병렬) ───────────────────────────────
      const [walletRes, followRes, usedRes] = await Promise.allSettled([
        supabase
          .from('user_coupons')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid)
          .eq('status', 'active'),
        supabase
          .from('follows')
          .select('store_id', { count: 'exact', head: true })
          .eq('user_id', uid),
        supabase
          .from('user_coupons')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid)
          .eq('status', 'used'),
      ]);

      const walletCount   = walletRes.status  === 'fulfilled' ? (walletRes.value.count  ?? 0) : 0;
      const followingCount = followRes.status === 'fulfilled' ? (followRes.value.count  ?? 0) : 0;
      const usedCount     = usedRes.status    === 'fulfilled' ? (usedRes.value.count    ?? 0) : 0;

      setSummary({
        nickname,
        joinedDays,
        ...levelInfo,
        locationName,
        birthMonth,
        birthDay,
        phone,
        inviteCount,
        walletCount,
        followingCount,
        usedCount,
      });
      staleAt.current = Date.now() + STALE_MS;
    } catch (e: any) {
      setError(e?.message ?? '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { summary, loading, error, refetch: () => load(true) };
}
