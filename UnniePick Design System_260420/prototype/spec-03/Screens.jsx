// ═══════════════════════════════════════════════════════════════
// Spec 03 · 월드컵 딜 소싱 — data + screens
// ═══════════════════════════════════════════════════════════════
const { useState, useEffect, useRef, useMemo } = React;

// ─── DATA ────────────────────────────────────────────────────
// 상남동 카페 월드컵 (16강)
const CAFES_16 = [
  { id: 'c1',  name: '카페 봄날',        emoji: '☕', color: '#FF6F0F', tagline: '상남동 대표 로스터리',       votes: 1284, seed: 1 },
  { id: 'c2',  name: '밤바 커피',        emoji: '🌙', color: '#6B4FCF', tagline: '심야 카페 · 22시 이후',       votes: 947,  seed: 2 },
  { id: 'c3',  name: '봄날 베이커리',    emoji: '🥐', color: '#E8A947', tagline: '구움과자 전문',                votes: 812,  seed: 3 },
  { id: 'c4',  name: '후엘고 라떼',      emoji: '🍵', color: '#2E8B57', tagline: '말차 스페셜티',                votes: 703,  seed: 4 },
  { id: 'c5',  name: '민트 브루',        emoji: '🌿', color: '#4AB38F', tagline: '드립 오마카세',                votes: 624,  seed: 5 },
  { id: 'c6',  name: '오후 5시',         emoji: '🌅', color: '#FF8C69', tagline: '시그니처 드링크 15종',         votes: 567,  seed: 6 },
  { id: 'c7',  name: '뜨레쥬르 상남점',  emoji: '🧁', color: '#F4A6C3', tagline: '디저트 셋트',                  votes: 498,  seed: 7 },
  { id: 'c8',  name: '노티드 창원',      emoji: '🍩', color: '#E74C3C', tagline: '도넛 & 콜드브루',              votes: 421,  seed: 8 },
  { id: 'c9',  name: '모나카페',         emoji: '🐈', color: '#8B6F47', tagline: '고양이 테마 · 반려동물 동반',  votes: 378,  seed: 9 },
  { id: 'c10', name: '디어마이커피',     emoji: '💌', color: '#C47AC0', tagline: '북카페 · 커피 구독',           votes: 342,  seed: 10 },
  { id: 'c11', name: '빛의 자리',        emoji: '🌻', color: '#F5C518', tagline: '루프탑 · 뷰 맛집',             votes: 298,  seed: 11 },
  { id: 'c12', name: '한 템포 쉬어',     emoji: '🍃', color: '#6BAF5A', tagline: '조용한 1인 카페',              votes: 276,  seed: 12 },
  { id: 'c13', name: '오리지널 봄',      emoji: '🌸', color: '#EE6FB0', tagline: '벚꽃 시즌 시그니처',           votes: 231,  seed: 13 },
  { id: 'c14', name: '깊은 원두',        emoji: '☕', color: '#5D4037', tagline: '싱글오리진 3종',               votes: 189,  seed: 14 },
  { id: 'c15', name: '커피 베이',        emoji: '🌊', color: '#3498DB', tagline: '해변 느낌 인테리어',           votes: 145,  seed: 15 },
  { id: 'c16', name: '일상 커피',        emoji: '📖', color: '#A0785E', tagline: '책 + 커피',                    votes: 112,  seed: 16 },
];

// 현재 진행 중인 월드컵 매치 (16강 첫 경기)
const CURRENT_MATCH = { left: CAFES_16[0], right: CAFES_16[7] };

// 유저 (소연) 의 주간 참여 현황
const USER_03 = {
  name: '소연',
  weeklyVotes: 23,
  myPickBadges: [
    { storeId: 'c1', weekRank: 1, week: '2026 W15' },
    { storeId: 'c3', weekRank: 2, week: '2026 W15' },
  ],
};

// 지난주 결과 — 상위 8위 (사장님 리포트용)
const LAST_WEEK_RESULTS = [
  { rank: 1, storeId: 'c1',  totalVotes: 2847, winRate: 94, change: +2, winner: true },
  { rank: 2, storeId: 'c4',  totalVotes: 2103, winRate: 78, change: -1 },
  { rank: 3, storeId: 'c2',  totalVotes: 1892, winRate: 72, change: 0 },
  { rank: 4, storeId: 'c3',  totalVotes: 1654, winRate: 68, change: +3 },
  { rank: 5, storeId: 'c5',  totalVotes: 1387, winRate: 61, change: +1 },
  { rank: 6, storeId: 'c6',  totalVotes: 1120, winRate: 54, change: -2 },
  { rank: 7, storeId: 'c7',  totalVotes: 892,  winRate: 48, change: -1 },
  { rank: 8, storeId: 'c9',  totalVotes: 723,  winRate: 42, change: +5 },
];

// 사장님 (준호) — 카페 봄날 운영
const OWNER_03 = { name: '준호', myStoreId: 'c1' };

// 사장님 앱에 표시되는 투표자 페르소나 인사이트
const VOTER_INSIGHTS = {
  ageGender: [
    { label: '20-24 여성', pct: 38 },
    { label: '25-29 여성', pct: 29 },
    { label: '30-34 여성', pct: 14 },
    { label: '20-24 남성', pct: 8 },
    { label: '기타',       pct: 11 },
  ],
  distance: { mostCommon: '1.5km 이내', pct: 67 },
  time: { mostCommon: '저녁 20-22시', pct: 43 },
  referrer: [
    { label: '월드컵 플레이', pct: 72 },
    { label: '지도',          pct: 18 },
    { label: '친구 공유',     pct: 10 },
  ],
};

// 프리미엄 슬롯 상품
const SLOT_PRODUCTS = [
  { id: 'map_pin',   title: '지도 프리미엄 핀',        desc: '상위 10% 매장에 7일간 금색 핀 노출', price: 15000, discount: 0,     bestValue: false },
  { id: 'home_hero', title: '홈 Hero 슬롯',            desc: '월요일 홈 화면 상단 7일 노출',       price: 39000, discount: 15000, bestValue: true },
  { id: 'wc_seeded', title: '월드컵 시드 #1 고정',     desc: '다음 시즌 1번 시드 배정',            price: 25000, discount: 0,     bestValue: false },
];

// ─── HELPERS ──────────────────────────────────────────────────
function findCafe(id) { return CAFES_16.find(c => c.id === id); }

// ─── PRIMITIVES ───────────────────────────────────────────────
function MatchCard({ store, onVote, position = 'left', voted = null, bigMode = false }) {
  const isWinner = voted === store.id;
  const isLoser = voted && voted !== store.id;
  return (
    <button onClick={() => !voted && onVote(store.id)} disabled={!!voted} style={{
      flex: 1, border: 'none', padding: 0, cursor: voted ? 'default' : 'pointer',
      background: `linear-gradient(${position === 'left' ? '160deg' : '200deg'}, ${store.color}, ${store.color}CC)`,
      borderRadius: bigMode ? 0 : 24,
      minHeight: bigMode ? 340 : 280,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, position: 'relative', overflow: 'hidden',
      opacity: isLoser ? 0.35 : 1,
      transform: isWinner ? 'scale(1.02)' : 'scale(1)',
      transition: 'all 0.4s var(--ease-spring)',
      boxShadow: isWinner ? '0 20px 40px rgba(255,111,15,0.4)' : 'none',
    }}>
      <div style={{ fontSize: 84, marginBottom: 14, filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.2))' }}>
        {store.emoji}
      </div>
      <div style={{
        color: '#fff', font: '900 22px/1.2 var(--font-sans)',
        letterSpacing: '-0.5px', textAlign: 'center', marginBottom: 6,
        textShadow: '0 2px 8px rgba(0,0,0,0.25)',
      }}>{store.name}</div>
      <div style={{
        color: 'rgba(255,255,255,0.85)', font: '600 12px/1.4 var(--font-sans)',
        textAlign: 'center', letterSpacing: '-0.1px',
      }}>{store.tagline}</div>
      {isWinner && (
        <div style={{
          position: 'absolute', top: 16, right: 16,
          background: '#fff', color: store.color,
          padding: '6px 12px', borderRadius: 999,
          font: '900 11px/1 var(--font-sans)', letterSpacing: 0.3,
        }}>✓ 내 픽</div>
      )}
    </button>
  );
}

function RankBadge({ rank, size = 'normal' }) {
  const big = size === 'large';
  const bg = rank === 1 ? '#FFC93C' : rank === 2 ? '#C5C5C5' : rank === 3 ? '#CD7F32' : 'var(--gray-100)';
  const fg = rank <= 3 ? '#fff' : 'var(--gray-600)';
  return (
    <div style={{
      width: big ? 48 : 28, height: big ? 48 : 28, borderRadius: 999,
      background: bg, color: fg,
      font: `900 ${big ? 18 : 12}px/1 var(--font-sans)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: rank <= 3 ? '0 3px 10px rgba(0,0,0,0.15)' : 'none',
    }}>{rank}</div>
  );
}

// ─── SCREEN 1: 월드컵 메인 (진행 중) ────────────────────────────
function WorldcupMatchScreen({ round = 8, onVote, voted }) {
  const { left, right } = CURRENT_MATCH;
  return (
    <div style={{ height: '100%', background: '#0D0E0F', display: 'flex', flexDirection: 'column', color: '#fff' }}>
      {/* Header */}
      <div style={{ padding: '54px 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ font: '700 11px/1 var(--font-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>
            상남동 카페 월드컵 · W16
          </div>
          <div style={{ font: '900 22px/1 var(--font-sans)', letterSpacing: '-0.6px' }}>
            {round}강 · 1 / {round / 2}
          </div>
        </div>
        <div style={{
          padding: '6px 12px', background: 'rgba(255,255,255,0.08)',
          borderRadius: 999, font: '700 11px/1 var(--font-sans)', color: 'rgba(255,255,255,0.8)',
        }}>👤 23명 참여 중</div>
      </div>

      {/* Progress */}
      <div style={{ padding: '0 20px 16px' }}>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: '12.5%', height: '100%', background: 'var(--orange-500)' }}/>
        </div>
      </div>

      {/* VS Match */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 20px 20px', gap: 16 }}>
        <MatchCard store={left} onVote={onVote} voted={voted} position="left" bigMode/>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 60, height: 60, borderRadius: 999, background: '#fff', color: '#0D0E0F',
          font: '900 18px/1 var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', letterSpacing: '-0.2px',
        }}>VS</div>
        <MatchCard store={right} onVote={onVote} voted={voted} position="right" bigMode/>
      </div>

      {/* Hint */}
      <div style={{
        padding: '10px 20px 50px', textAlign: 'center',
        font: '500 12px/1.4 var(--font-sans)', color: 'rgba(255,255,255,0.5)',
      }}>
        {voted ? '✨ 다음 매치로 넘어가는 중…' : '두 카페 중 마음에 드는 쪽을 탭'}
      </div>
    </div>
  );
}

// ─── SCREEN 2: My Pick 결과 알림 ────────────────────────────────
function MyPickResultScreen({ onContinue }) {
  const myPick = findCafe('c1');
  return (
    <div style={{
      height: '100%', background: `linear-gradient(160deg, ${myPick.color}, ${myPick.color}DD 60%, #D55A1F)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 32, color: '#fff', textAlign: 'center', position: 'relative', overflow: 'hidden',
    }}>
      {/* Confetti */}
      {Array.from({ length: 30 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', top: -20,
          left: `${(i * 7) % 100}%`,
          width: 8, height: 12, borderRadius: 2,
          background: ['#FFC93C', '#fff', '#FF6F0F', '#D946B0'][i % 4],
          animation: `confetti-fall ${2 + (i % 4) * 0.4}s linear ${i * 0.05}s infinite`,
        }}/>
      ))}

      <div style={{
        padding: '6px 16px', background: 'rgba(0,0,0,0.25)',
        borderRadius: 999, font: '700 11px/1 var(--font-sans)',
        letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 24,
      }}>🏆 내 픽이 우승</div>

      <div style={{ fontSize: 100, marginBottom: 16, filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.3))' }}>
        {myPick.emoji}
      </div>
      <div style={{ font: '900 30px/1.1 var(--font-sans)', letterSpacing: '-0.8px', marginBottom: 10 }}>
        {myPick.name}이<br/>1등 먹었어요!
      </div>
      <div style={{ font: '500 14px/1.55 var(--font-sans)', opacity: 0.9, marginBottom: 32, maxWidth: 280 }}>
        지난주 상남동 카페 월드컵에서 소연님이 뽑은 카페가 우승했어요. 축하 쿠폰을 보관함에 담았어요.
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)',
        padding: '20px 22px', borderRadius: 18, width: '100%', maxWidth: 320,
        border: '1px solid rgba(255,255,255,0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>🎟</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ font: '800 14px/1.2 var(--font-sans)', marginBottom: 3 }}>시그니처 라떼 2,000원 할인</div>
            <div style={{ font: '500 11px/1 var(--font-sans)', opacity: 0.85 }}>
              {myPick.name} · 7일간 유효
            </div>
          </div>
        </div>
      </div>

      <button onClick={onContinue} style={{
        marginTop: 32, background: '#fff', color: myPick.color,
        padding: '16px 44px', borderRadius: 14, border: 'none',
        font: '800 15px/1 var(--font-sans)', cursor: 'pointer',
        boxShadow: '0 10px 24px rgba(0,0,0,0.15)',
      }}>쿠폰 확인하기</button>
    </div>
  );
}

// ─── SCREEN 3: 월드컵 시즌 결과 차트 (유저) ──────────────────────
function WorldcupLeaderboardScreen({ onBack }) {
  return (
    <div style={{ height: '100%', background: '#F8F9FA', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '54px 20px 16px', background: '#fff', borderBottom: '1px solid var(--gray-200)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M18 7l-7 7 7 7" stroke="#191F28" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ font: '700 11px/1 var(--font-sans)', color: 'var(--gray-500)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
              지난주 결과 · W15
            </div>
            <div style={{ font: '900 20px/1 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.5px' }}>
              상남동 카페 월드컵
            </div>
          </div>
        </div>
        <div style={{
          display: 'flex', gap: 8, padding: '10px 14px',
          background: 'var(--orange-50)', borderRadius: 12, alignItems: 'center',
        }}>
          <span style={{ fontSize: 16 }}>✨</span>
          <span style={{ font: '700 12px/1.3 var(--font-sans)', color: 'var(--orange-700)', letterSpacing: '-0.1px' }}>
            소연님의 픽 2개가 TOP 4에 올랐어요
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 40px' }}>
        {LAST_WEEK_RESULTS.map(r => {
          const cafe = findCafe(r.storeId);
          const myPick = USER_03.myPickBadges.some(b => b.storeId === r.storeId);
          return (
            <div key={r.rank} style={{
              background: '#fff', borderRadius: 14, padding: '14px 16px',
              marginBottom: 8, display: 'flex', alignItems: 'center', gap: 14,
              border: myPick ? '1.5px solid var(--orange-500)' : '1px solid transparent',
              boxShadow: myPick ? '0 4px 16px rgba(255,111,15,0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
              position: 'relative',
            }}>
              <RankBadge rank={r.rank}/>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: cafe.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, flexShrink: 0,
              }}>{cafe.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ font: '800 14px/1.2 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.2px' }}>
                    {cafe.name}
                  </div>
                  {myPick && (
                    <span style={{
                      padding: '2px 6px', background: 'var(--orange-500)',
                      borderRadius: 5, font: '900 9px/1 var(--font-sans)', color: '#fff',
                    }}>MY PICK</span>
                  )}
                </div>
                <div style={{ font: '500 11px/1.3 var(--font-sans)', color: 'var(--gray-500)', marginTop: 3 }}>
                  {r.totalVotes.toLocaleString()}표 · 승률 {r.winRate}%
                </div>
              </div>
              <div style={{
                font: '800 11px/1 var(--font-sans)',
                color: r.change > 0 ? '#2E8B57' : r.change < 0 ? '#E53935' : 'var(--gray-400)',
              }}>
                {r.change > 0 ? `↑${r.change}` : r.change < 0 ? `↓${Math.abs(r.change)}` : '−'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SCREEN 4: 사장님 주간 리포트 ────────────────────────────────
function OwnerWeeklyReportScreen({ onOpenSlot }) {
  const myStore = findCafe('c1');
  return (
    <div style={{ height: '100%', background: '#F4F2ED', overflow: 'auto' }}>
      {/* Top greeting */}
      <div style={{ padding: '54px 20px 20px', background: '#fff' }}>
        <div style={{ font: '700 11px/1 var(--font-sans)', color: 'var(--gray-500)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>
          사장님 대시보드 · 월요일 아침
        </div>
        <div style={{ font: '900 22px/1.2 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.5px' }}>
          준호 사장님,<br/>지난주 <em style={{ color: 'var(--orange-500)', fontStyle: 'normal' }}>1등</em> 하셨어요.
        </div>
      </div>

      {/* Hero scoreboard card */}
      <div style={{ padding: 20 }}>
        <div style={{
          background: `linear-gradient(160deg, ${myStore.color}, ${myStore.color}DD)`,
          borderRadius: 22, padding: 24, color: '#fff',
          boxShadow: '0 12px 32px rgba(255,111,15,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{
              padding: '5px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 999,
              font: '800 11px/1 var(--font-sans)', letterSpacing: 0.5,
            }}>W15 · 상남동 카페 월드컵</div>
            <div style={{ fontSize: 28 }}>🏆</div>
          </div>
          <div style={{ font: '900 54px/1 var(--font-sans)', letterSpacing: '-2px', marginBottom: 4 }}>
            1위
          </div>
          <div style={{ font: '600 13px/1.3 var(--font-sans)', opacity: 0.85, marginBottom: 20 }}>
            상남동 카페 27곳 중 · 지난주 대비 ↑2계단
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, padding: '14px 0 0', borderTop: '1px solid rgba(255,255,255,0.25)' }}>
            {[
              { label: '총 투표수', val: '2,847', sub: '+18%' },
              { label: '승률',      val: '94%',   sub: '+6%p' },
              { label: '결승 진출', val: '3주',   sub: '연속' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ font: '600 10px/1 var(--font-sans)', opacity: 0.75, letterSpacing: 0.3, marginBottom: 6 }}>{s.label}</div>
                <div style={{ font: '900 20px/1 var(--font-sans)', letterSpacing: '-0.5px' }}>{s.val}</div>
                <div style={{ font: '700 10px/1 var(--font-sans)', opacity: 0.85, marginTop: 4 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Reward offer */}
        <div style={{
          marginTop: 16, padding: 20, background: '#fff', borderRadius: 18,
          border: '1.5px dashed var(--orange-500)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 24 }}>🎁</span>
            <div style={{ font: '800 14px/1.2 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.2px' }}>
              이번주 무료 홈 Hero 슬롯
            </div>
          </div>
          <div style={{ font: '500 13px/1.55 var(--font-sans)', color: 'var(--gray-700)', marginBottom: 14 }}>
            월드컵 1위 보상 — 월요일 오후 언니픽 홈 최상단에 카페 봄날이 자동 노출됩니다. 추가 비용 0원.
          </div>
          <button onClick={onOpenSlot} style={{
            width: '100%', padding: '12px', background: 'var(--orange-500)', color: '#fff',
            borderRadius: 10, border: 'none', font: '800 13px/1 var(--font-sans)', cursor: 'pointer',
          }}>프리미엄 슬롯 미리 예약</button>
        </div>

        {/* Voter insights */}
        <div style={{ marginTop: 22, font: '700 12px/1 var(--font-sans)', color: 'var(--gray-700)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
          투표자 인사이트
        </div>
        <div style={{ background: '#fff', borderRadius: 18, padding: 20 }}>
          <div style={{ font: '700 11px/1 var(--font-sans)', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
            연령·성별 분포
          </div>
          {VOTER_INSIGHTS.ageGender.map(s => (
            <div key={s.label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ font: '600 12px/1 var(--font-sans)', color: 'var(--gray-700)', letterSpacing: '-0.1px' }}>{s.label}</span>
                <span style={{ font: '800 12px/1 var(--font-sans)', color: 'var(--gray-900)' }}>{s.pct}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--gray-100)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${s.pct * 2.5}%`, height: '100%', background: 'var(--orange-500)', borderRadius: 3 }}/>
              </div>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--gray-100)' }}>
            <div>
              <div style={{ font: '600 10px/1 var(--font-sans)', color: 'var(--gray-500)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>주거리</div>
              <div style={{ font: '800 14px/1.2 var(--font-sans)', color: 'var(--gray-900)' }}>{VOTER_INSIGHTS.distance.mostCommon}</div>
              <div style={{ font: '600 11px/1 var(--font-sans)', color: 'var(--gray-500)', marginTop: 3 }}>{VOTER_INSIGHTS.distance.pct}%</div>
            </div>
            <div>
              <div style={{ font: '600 10px/1 var(--font-sans)', color: 'var(--gray-500)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>피크 타임</div>
              <div style={{ font: '800 14px/1.2 var(--font-sans)', color: 'var(--gray-900)' }}>{VOTER_INSIGHTS.time.mostCommon}</div>
              <div style={{ font: '600 11px/1 var(--font-sans)', color: 'var(--gray-500)', marginTop: 3 }}>{VOTER_INSIGHTS.time.pct}%</div>
            </div>
          </div>
        </div>

        <div style={{ height: 20 }}/>
      </div>
    </div>
  );
}

// ─── SCREEN 5: 프리미엄 슬롯 구매 ─────────────────────────────────
function PremiumSlotScreen({ onBack, onPurchase }) {
  const myStore = findCafe('c1');
  const [selected, setSelected] = useState('home_hero');
  const product = SLOT_PRODUCTS.find(p => p.id === selected);

  return (
    <div style={{ height: '100%', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '54px 20px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M18 7l-7 7 7 7" stroke="#191F28" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ font: '800 17px/1 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.3px' }}>
          프리미엄 슬롯
        </div>
      </div>

      <div style={{ padding: '0 20px', flex: 1, overflowY: 'auto' }}>
        <div style={{
          padding: 18, background: 'var(--orange-50)', borderRadius: 14, marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: myStore.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            {myStore.emoji}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ font: '800 13px/1.2 var(--font-sans)', color: 'var(--gray-900)' }}>{myStore.name}</div>
            <div style={{ font: '700 11px/1 var(--font-sans)', color: 'var(--orange-700)', marginTop: 3 }}>
              🏆 월드컵 1위 · 15,000원 크레딧 보유
            </div>
          </div>
        </div>

        {SLOT_PRODUCTS.map(p => (
          <button key={p.id} onClick={() => setSelected(p.id)} style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: 18, marginBottom: 10, borderRadius: 16,
            background: '#fff',
            border: '1.5px solid ' + (selected === p.id ? 'var(--orange-500)' : 'var(--gray-200)'),
            boxShadow: selected === p.id ? '0 4px 14px rgba(255,111,15,0.15)' : 'none',
            cursor: 'pointer', position: 'relative',
          }}>
            {p.bestValue && (
              <div style={{
                position: 'absolute', top: -8, right: 12,
                padding: '4px 10px', background: 'var(--orange-500)', color: '#fff',
                borderRadius: 6, font: '900 10px/1 var(--font-sans)', letterSpacing: 0.3,
              }}>추천</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ font: '800 14px/1.2 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.2px' }}>
                {p.title}
              </div>
              <div style={{
                width: 20, height: 20, borderRadius: 10,
                border: '2px solid ' + (selected === p.id ? 'var(--orange-500)' : 'var(--gray-300)'),
                background: selected === p.id ? 'var(--orange-500)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {selected === p.id && <div style={{ width: 8, height: 8, borderRadius: 4, background: '#fff' }}/>}
              </div>
            </div>
            <div style={{ font: '500 12px/1.5 var(--font-sans)', color: 'var(--gray-600)', marginBottom: 10 }}>
              {p.desc}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              {p.discount > 0 && (
                <span style={{ font: '700 12px/1 var(--font-sans)', color: 'var(--gray-400)', textDecoration: 'line-through' }}>
                  {p.price.toLocaleString()}원
                </span>
              )}
              <span style={{ font: '900 16px/1 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.3px' }}>
                {(p.price - p.discount).toLocaleString()}원
              </span>
              {p.discount > 0 && (
                <span style={{
                  padding: '2px 6px', background: '#FFEBEE', borderRadius: 5,
                  font: '900 10px/1 var(--font-sans)', color: '#E53935',
                }}>월드컵 1위 -{Math.round(p.discount / p.price * 100)}%</span>
              )}
            </div>
          </button>
        ))}

        <div style={{
          marginTop: 20, padding: 16, background: 'var(--gray-100)',
          borderRadius: 12, font: '500 11px/1.55 var(--font-sans)', color: 'var(--gray-600)',
        }}>
          💡 광고 크레딧(15,000원)은 월드컵 성적에 따라 매주 자동 지급됩니다. 별도 예산 책정 없이 슬롯 구매 가능.
        </div>
      </div>

      <div style={{ padding: 16, borderTop: '1px solid var(--gray-150)' }}>
        <button onClick={() => onPurchase(product)} style={{
          width: '100%', padding: 16, background: 'var(--orange-500)', color: '#fff',
          border: 'none', borderRadius: 14, font: '800 15px/1 var(--font-sans)',
          cursor: 'pointer', letterSpacing: '-0.1px',
          boxShadow: '0 6px 16px rgba(255,111,15,0.3)',
        }}>{(product.price - product.discount).toLocaleString()}원 결제하기</button>
      </div>
    </div>
  );
}

// ─── SCREEN 6: 결제 완료 ──────────────────────────────────────
function PurchaseDoneScreen({ onBack }) {
  return (
    <div style={{
      height: '100%', background: 'linear-gradient(160deg, #2E8B57, #3FA968)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 32, color: '#fff', textAlign: 'center',
    }}>
      <div style={{
        width: 96, height: 96, borderRadius: '50%', background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
      }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M12 24l9 9 16-18" stroke="#2E8B57" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div style={{ font: '900 26px/1.2 var(--font-sans)', letterSpacing: '-0.8px', marginBottom: 10 }}>
        슬롯 예약 완료
      </div>
      <div style={{ font: '500 14px/1.5 var(--font-sans)', opacity: 0.9, marginBottom: 40, maxWidth: 260 }}>
        월요일 오후부터 7일간 카페 봄날이 언니픽 홈 최상단에 노출됩니다.
      </div>
      <button onClick={onBack} style={{
        background: 'var(--gray-900)', color: '#fff',
        padding: '14px 40px', borderRadius: 14, border: 'none',
        font: '700 14px/1 var(--font-sans)', cursor: 'pointer',
      }}>대시보드로 돌아가기</button>
    </div>
  );
}

// ─── SCREEN 7: Push notification · 리포트 도착 ────────────────
function ReportPushScreen() {
  const myStore = findCafe('c1');
  return (
    <div style={{
      height: '100%', position: 'relative',
      background: `
        radial-gradient(ellipse at 30% 20%, #FF8A4D 0%, transparent 40%),
        radial-gradient(ellipse at 70% 80%, #6B3FA0 0%, transparent 50%),
        linear-gradient(180deg, #2C1B4E 0%, #1A0E2E 50%, #0A0515 100%)
      `,
    }}>
      <div style={{ padding: '72px 0 0', textAlign: 'center', color: '#fff' }}>
        <div style={{ font: '500 20px/1 var(--font-sans)', opacity: 0.9, marginBottom: 6 }}>
          월요일, 4월 20일
        </div>
        <div style={{ font: '200 86px/1 var(--font-sans)', letterSpacing: '-4px' }}>
          9:02
        </div>
      </div>

      <div style={{ position: 'absolute', left: 16, right: 16, top: 260, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { app: '언니픽', icon: '🎟', title: '지난주 월드컵 결과가 도착했어요', body: `${myStore.name}이 상남동 카페 1위! 홈 Hero 슬롯 무료 이용권이 도착했어요.`, time: '방금', priority: true },
          { app: '날씨', icon: '🌤', title: '오늘의 날씨', body: '창원시 맑음 · 최고 22°C', time: '8:45' },
          { app: 'KB페이', icon: '💳', title: '입금 알림', body: '카페 봄날 매출 325,000원', time: '어제' },
        ].map((n, i) => (
          <div key={i} style={{
            background: 'rgba(22,22,28,0.6)', backdropFilter: 'blur(40px) saturate(180%)',
            border: '0.5px solid rgba(255,255,255,0.15)',
            borderRadius: 20, padding: '12px 14px', color: '#fff',
            animation: n.priority ? 'slide-up-in 0.6s var(--ease-spring)' : 'fade-in 0.4s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 20, height: 20, borderRadius: 6,
                background: n.priority ? 'var(--orange-500)' : 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
              }}>{n.icon}</div>
              <span style={{ font: '700 12px/1 var(--font-sans)', color: 'rgba(255,255,255,0.75)', letterSpacing: '-0.1px' }}>{n.app}</span>
              <div style={{ flex: 1 }}/>
              <span style={{ font: '500 11px/1 var(--font-sans)', color: 'rgba(255,255,255,0.5)' }}>{n.time}</span>
            </div>
            <div style={{ font: '800 13px/1.3 var(--font-sans)', marginBottom: 3, letterSpacing: '-0.2px' }}>{n.title}</div>
            <div style={{ font: '500 12px/1.4 var(--font-sans)', color: 'rgba(255,255,255,0.75)' }}>{n.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  CAFES_16, LAST_WEEK_RESULTS, SLOT_PRODUCTS, USER_03, findCafe,
  WorldcupMatchScreen, MyPickResultScreen, WorldcupLeaderboardScreen,
  OwnerWeeklyReportScreen, PremiumSlotScreen, PurchaseDoneScreen, ReportPushScreen,
});
