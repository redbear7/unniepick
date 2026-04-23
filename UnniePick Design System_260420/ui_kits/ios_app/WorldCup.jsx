// WorldCup — 맛집 월드컵 16강 게임
// 화면: 상황 선택 → 대결 → 라운드 전환 → 결승 → 결과
// 브랜드: 오렌지 #FF6F0F · 게임 에너지 · SF Pro

// ═══════════════════════════════════════════════════════════
// 1. SituationSelect — 오늘 어떤 상황이에요?
// ═══════════════════════════════════════════════════════════
function SituationSelect({ onPick, onRandom, onExit }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#FFF8F2 0%,#FFEDD9 100%)', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ padding: '50px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onExit} style={{ background: 'none', border: 'none', padding: 8, fontSize: 22, color: 'var(--fg1)', cursor: 'pointer' }}>←</button>
        <div style={{ font: '800 14px/1 var(--font-sans)', color: 'var(--fg2)' }}>맛집 월드컵</div>
        <div style={{ width: 38 }}/>
      </div>

      <div style={{ padding: '16px 24px 10px' }}>
        <div style={{ font: '900 28px/1.25 var(--font-sans)', color: 'var(--fg1)', letterSpacing: '-0.7px', marginBottom: 8 }}>
          오늘 어떤 상황이에요? 🍽️
        </div>
        <div style={{ font: '500 13px/1.5 var(--font-sans)', color: 'var(--fg3)' }}>
          상황에 맞춰 창원 맛집 16곳을 대결시켜 드려요
        </div>
      </div>

      {/* Grid */}
      <div style={{ padding: '20px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {SITUATIONS.map((s, i) => (
          <button key={s.key} onClick={() => onPick(s)} style={{
            background: '#fff', border: '1.5px solid var(--gray-150)', borderRadius: 18,
            padding: '16px 14px', textAlign: 'left', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', gap: 8,
            boxShadow: '0 2px 6px rgba(255,111,15,0.04)',
            transition: 'transform 160ms ease, box-shadow 160ms ease',
            animation: `popIn 400ms cubic-bezier(0.34,1.56,0.64,1) ${i * 40}ms both`,
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
          onMouseUp={e => e.currentTarget.style.transform = ''}
          onMouseLeave={e => e.currentTarget.style.transform = ''}
          >
            <div style={{ fontSize: 34, lineHeight: 1 }}>{s.emoji}</div>
            <div style={{ font: '800 14px/1.3 var(--font-sans)', color: 'var(--fg1)', letterSpacing: '-0.3px' }}>
              {s.title}
            </div>
            <div style={{ font: '500 11px/1.3 var(--font-sans)', color: 'var(--fg3)' }}>
              {s.hint}
            </div>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 12 }}/>

      {/* AI Random button */}
      <div style={{ padding: '12px 20px 34px', background: 'transparent' }}>
        <button onClick={onRandom} style={{
          width: '100%', padding: 16, border: 'none', borderRadius: 16,
          background: 'linear-gradient(135deg,#FF9F4F 0%,#FF6F0F 60%,#FF5A00 100%)',
          color: '#fff',
          font: '900 15px/1 var(--font-sans)', letterSpacing: '-0.3px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(255,111,15,0.35)',
          position: 'relative', overflow: 'hidden',
        }}>
          <span style={{ fontSize: 18, animation: 'sparkle 1.8s ease-in-out infinite' }}>✨</span>
          AI 랜덤 추천
          <span style={{ fontSize: 18, animation: 'sparkle 1.8s ease-in-out 0.6s infinite' }}>✨</span>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.4) 50%, transparent 60%)',
            animation: 'shimmer 2.5s linear infinite',
          }}/>
        </button>
      </div>

      <style>{`
        @keyframes popIn { from { opacity: 0; transform: scale(0.85) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes sparkle { 0%,100% { transform: scale(1) rotate(0); opacity: 1; } 50% { transform: scale(1.3) rotate(15deg); opacity: 0.7; } }
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 2. StoreCard — 풀블리드 대결 카드
// ═══════════════════════════════════════════════════════════
function StoreCard({ store, side, onPick, state }) {
  // state: 'idle' | 'picked' | 'eliminated'
  const isPicked = state === 'picked';
  const isElim = state === 'eliminated';

  return (
    <button onClick={() => state === 'idle' && onPick(store)} style={{
      flex: 1, border: 'none', padding: 0, cursor: state === 'idle' ? 'pointer' : 'default',
      background: `linear-gradient(165deg, ${store.grad[0]} 0%, ${store.grad[1]} 100%)`,
      position: 'relative', overflow: 'hidden',
      transform: isPicked ? 'scale(1.04)' : isElim ? 'scale(0.96)' : 'scale(1)',
      filter: isElim ? 'grayscale(0.7) brightness(0.55)' : 'none',
      transition: 'all 340ms cubic-bezier(0.34,1.56,0.64,1)',
      zIndex: isPicked ? 2 : 1,
      boxShadow: isPicked ? '0 0 0 4px #FF6F0F, 0 18px 40px rgba(255,111,15,0.4)' : 'none',
    }}>
      {/* Big food emoji (image placeholder) */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 110, opacity: 0.85, filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.25))',
      }}>
        {store.emoji}
      </div>

      {/* Dark gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 85%, rgba(0,0,0,0.75) 100%)',
      }}/>

      {/* Side label (A / B) */}
      <div style={{
        position: 'absolute', top: 14, left: side === 'left' ? 14 : 'auto', right: side === 'right' ? 14 : 'auto',
        width: 28, height: 28, borderRadius: '50%',
        background: 'rgba(255,255,255,0.9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        font: '900 13px/1 var(--font-sans)', color: 'var(--fg1)',
      }}>{side === 'left' ? 'A' : 'B'}</div>

      {/* Picked check badge */}
      {isPicked && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 84, height: 84, borderRadius: '50%',
          background: 'var(--orange-500)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          animation: 'pickPop 400ms cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          <svg width="44" height="44" viewBox="0 0 24 24"><path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
        </div>
      )}

      {/* Info panel */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '12px 14px 16px',
        color: '#fff', textAlign: 'left',
      }}>
        <div style={{
          display: 'inline-block',
          padding: '3px 8px', borderRadius: 6,
          background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
          font: '700 10px/1 var(--font-sans)', color: '#fff',
          marginBottom: 8,
        }}>
          {store.cat}
        </div>
        <div style={{ font: '900 17px/1.2 var(--font-sans)', color: '#fff', letterSpacing: '-0.4px', marginBottom: 4, textShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
          {store.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: '600 11px/1 var(--font-sans)', color: 'rgba(255,255,255,0.9)' }}>
          <span style={{ color: '#FFD54F' }}>★</span>
          <span style={{ font: '800 12px/1 var(--font-sans)' }}>{store.rating}</span>
          <span style={{ opacity: 0.7 }}>·</span>
          <span>{store.district}</span>
        </div>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════
// 3. MatchScreen — 좌/우 대결
// ═══════════════════════════════════════════════════════════
function MatchScreen({ round, matchIdx, totalMatches, pair, onPick, situation, onExit }) {
  const [picked, setPicked] = React.useState(null); // store.id of picked
  const roundLabels = { 16: '16강', 8: '8강', 4: '4강', 2: '결승' };
  const progressPct = ((matchIdx) / totalMatches) * 100;

  const handlePick = (store) => {
    if (picked) return;
    setPicked(store.id);
    setTimeout(() => { onPick(store); setPicked(null); }, 700);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '50px 16px 14px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={onExit} style={{ background: 'none', border: 'none', padding: 8, fontSize: 22, color: '#fff', cursor: 'pointer' }}>✕</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{situation?.emoji || '🍽️'}</span>
            <span style={{ font: '800 14px/1 var(--font-sans)', color: '#fff' }}>
              {roundLabels[round]} <span style={{ color: 'var(--orange-300)' }}>{matchIdx + 1}/{totalMatches}</span>
            </span>
          </div>
          <div style={{ width: 38 }}/>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progressPct}%`,
            background: 'linear-gradient(90deg, #FF9F4F, #FF6F0F)',
            transition: 'width 400ms cubic-bezier(0.22,1,0.36,1)',
            boxShadow: '0 0 8px rgba(255,111,15,0.6)',
          }}/>
        </div>
      </div>

      {/* Stacked cards + VS */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <StoreCard
          store={pair[0]}
          side="left"
          state={!picked ? 'idle' : picked === pair[0].id ? 'picked' : 'eliminated'}
          onPick={handlePick}
        />

        {/* VS badge */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)', zIndex: 5,
          pointerEvents: 'none',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, #FF9F4F, #FF5A00)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5), inset 0 -3px 8px rgba(0,0,0,0.2), 0 0 0 4px #000',
            font: '900 18px/1 var(--font-sans)', color: '#fff', letterSpacing: '-0.5px',
            animation: picked ? 'vsShrink 300ms forwards' : 'vsPulse 2s ease-in-out infinite',
          }}>
            VS
          </div>
        </div>

        <StoreCard
          store={pair[1]}
          side="right"
          state={!picked ? 'idle' : picked === pair[1].id ? 'picked' : 'eliminated'}
          onPick={handlePick}
        />
      </div>

      {/* Bottom hint */}
      <div style={{
        padding: '10px 20px 34px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)',
        font: '600 12px/1.4 var(--font-sans)', color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
      }}>
        취향에 맞는 곳을 탭하세요 👆
      </div>

      <style>{`
        @keyframes vsPulse { 0%,100% { transform: translate(-50%, -50%) scale(1); } 50% { transform: translate(-50%, -50%) scale(1.08); } }
        @keyframes vsShrink { to { transform: translate(-50%, -50%) scale(0); opacity: 0; } }
        @keyframes pickPop { 0% { transform: translate(-50%, -50%) scale(0) rotate(-90deg); } 100% { transform: translate(-50%, -50%) scale(1) rotate(0); } }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 4. RoundTransition
// ═══════════════════════════════════════════════════════════
function RoundTransition({ fromRound, toRound, survivors, onNext }) {
  const labels = { 16: '16강', 8: '8강', 4: '4강', 2: '결승' };
  const message = toRound === 2 ? '결승 진출!' : `${labels[toRound]} 진출!`;

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(180deg, #FF9F4F 0%, #FF6F0F 50%, #FF5A00 100%)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Confetti-ish blobs */}
      <div style={{ position: 'absolute', top: '10%', left: '-10%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.25), transparent 70%)' }}/>
      <div style={{ position: 'absolute', bottom: '5%', right: '-15%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,220,180,0.35), transparent 70%)' }}/>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px 20px', position: 'relative', zIndex: 1 }}>
        {/* Celebration icon */}
        <div style={{
          fontSize: 72, marginBottom: 16,
          animation: 'celebrate 800ms cubic-bezier(0.34,1.56,0.64,1)',
        }}>🎉</div>

        <div style={{
          font: '900 40px/1.1 var(--font-sans)', color: '#fff',
          letterSpacing: '-1.2px', textAlign: 'center', marginBottom: 10,
          textShadow: '0 4px 16px rgba(0,0,0,0.2)',
          animation: 'slideUp 500ms cubic-bezier(0.22,1,0.36,1) 200ms both',
        }}>
          {message}
        </div>
        <div style={{
          font: '600 14px/1.4 var(--font-sans)', color: 'rgba(255,255,255,0.9)',
          textAlign: 'center', marginBottom: 40,
          animation: 'slideUp 500ms cubic-bezier(0.22,1,0.36,1) 320ms both',
        }}>
          {survivors.length}곳이 살아남았어요
        </div>

        {/* Survivor thumbnails */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: survivors.length <= 2 ? '1fr 1fr' : survivors.length <= 4 ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: 10,
          width: '100%', maxWidth: 340,
        }}>
          {survivors.map((s, i) => (
            <div key={s.id} style={{
              aspectRatio: '1',
              borderRadius: 14, overflow: 'hidden', position: 'relative',
              background: `linear-gradient(165deg, ${s.grad[0]}, ${s.grad[1]})`,
              boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
              animation: `thumbIn 400ms cubic-bezier(0.34,1.56,0.64,1) ${400 + i * 80}ms both`,
            }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42 }}>
                {s.emoji}
              </div>
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '14px 6px 6px',
                background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.7))',
                font: '800 10px/1.2 var(--font-sans)', color: '#fff', textAlign: 'center',
                letterSpacing: '-0.2px',
              }}>
                {s.name}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 24px 34px', position: 'relative', zIndex: 1 }}>
        <button onClick={onNext} style={{
          width: '100%', padding: 16, border: 'none', borderRadius: 16,
          background: '#fff', color: 'var(--orange-500)',
          font: '900 16px/1 var(--font-sans)', letterSpacing: '-0.3px',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          animation: 'slideUp 500ms cubic-bezier(0.22,1,0.36,1) 800ms both',
        }}>
          다음 라운드 시작 →
        </button>
      </div>

      <style>{`
        @keyframes celebrate { 0% { transform: scale(0) rotate(-180deg); opacity: 0; } 60% { transform: scale(1.2) rotate(10deg); opacity: 1; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes thumbIn { from { opacity: 0; transform: scale(0.6) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 5. ResultScreen — 우승!
// ═══════════════════════════════════════════════════════════
function ResultScreen({ winner, situation, onRestart, onExit }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(180deg, #FFF8F2 0%, #FFEDD9 50%, #FFD4A8 100%)',
      display: 'flex', flexDirection: 'column', overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{ padding: '50px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onExit} style={{ background: 'none', border: 'none', padding: 8, fontSize: 22, color: 'var(--fg1)', cursor: 'pointer' }}>✕</button>
        <div style={{ font: '800 14px/1 var(--font-sans)', color: 'var(--fg2)' }}>맛집 월드컵 결과</div>
        <div style={{ width: 38 }}/>
      </div>

      <div style={{ padding: '10px 24px 20px', textAlign: 'center' }}>
        {/* Trophy */}
        <div style={{
          fontSize: 80, marginBottom: 8,
          animation: 'trophyBounce 1.2s ease-in-out infinite',
          filter: 'drop-shadow(0 8px 16px rgba(255,111,15,0.35))',
        }}>🏆</div>

        <div style={{ font: '900 28px/1.2 var(--font-sans)', color: 'var(--fg1)', letterSpacing: '-0.7px', marginBottom: 6 }}>
          오늘의 내 맛집!
        </div>
        <div style={{ font: '600 12px/1.4 var(--font-sans)', color: 'var(--fg3)' }}>
          {situation?.emoji} {situation?.title}에 딱이에요
        </div>
      </div>

      {/* Winner card */}
      <div style={{ padding: '0 20px', marginBottom: 20 }}>
        <div style={{
          borderRadius: 24, overflow: 'hidden', position: 'relative',
          background: `linear-gradient(165deg, ${winner.grad[0]}, ${winner.grad[1]})`,
          aspectRatio: '1 / 1',
          boxShadow: '0 20px 50px rgba(255,111,15,0.25), 0 0 0 3px rgba(255,111,15,0.15)',
          animation: 'winnerIn 700ms cubic-bezier(0.34,1.56,0.64,1) 200ms both',
        }}>
          {/* Crown sparkle */}
          <div style={{
            position: 'absolute', top: 16, right: 16, zIndex: 3,
            background: 'linear-gradient(135deg,#FFD54F,#FFA726)',
            padding: '6px 12px', borderRadius: 20,
            font: '900 11px/1 var(--font-sans)', color: '#4A2C00',
            letterSpacing: '-0.2px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
          }}>👑 WINNER</div>

          {/* Big emoji */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 160, filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.25))',
          }}>{winner.emoji}</div>

          {/* Info */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '50px 20px 20px',
            background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.7))',
            color: '#fff',
          }}>
            <div style={{
              display: 'inline-block',
              padding: '4px 10px', borderRadius: 8,
              background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)',
              font: '700 11px/1 var(--font-sans)',
              marginBottom: 10,
            }}>{winner.cat}</div>
            <div style={{ font: '900 24px/1.2 var(--font-sans)', letterSpacing: '-0.5px', marginBottom: 8, textShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
              {winner.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: '600 12px/1 var(--font-sans)' }}>
              <span style={{ color: '#FFD54F' }}>★★★★★</span>
              <span style={{ font: '800 13px/1 var(--font-sans)' }}>{winner.rating}</span>
              <span style={{ opacity: 0.6 }}>·</span>
              <span>창원시 {winner.district}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14, animation: 'slideUp 500ms ease 500ms both' }}>
        <button style={{
          width: '100%', padding: 15, border: 'none', borderRadius: 14,
          background: 'var(--orange-500)', color: '#fff',
          font: '900 15px/1 var(--font-sans)', letterSpacing: '-0.3px',
          cursor: 'pointer',
          boxShadow: '0 8px 20px rgba(255,111,15,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <span>📍</span> 가게 상세 보기
        </button>

        <button style={{
          width: '100%', padding: 14, border: '1.5px solid var(--orange-200)', borderRadius: 14,
          background: '#fff', color: 'var(--orange-700)',
          font: '800 14px/1.2 var(--font-sans)', letterSpacing: '-0.3px',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          📤 <span>결과 공유하기</span>
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 10 }}/>

      {/* Restart link */}
      <div style={{ padding: '0 20px 34px', textAlign: 'center' }}>
        <button onClick={onRestart} style={{
          background: 'none', border: 'none',
          font: '700 14px/1 var(--font-sans)', color: 'var(--fg2)',
          textDecoration: 'underline', textUnderlineOffset: 4,
          cursor: 'pointer', padding: 8,
        }}>
          다시 하기 ↻
        </button>
      </div>

      <style>{`
        @keyframes trophyBounce { 0%, 100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-8px) rotate(3deg); } }
        @keyframes winnerIn { 0% { transform: scale(0.7) rotate(-5deg); opacity: 0; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// WorldCupFlow — orchestrator
// ═══════════════════════════════════════════════════════════
function WorldCupFlow({ onExit }) {
  const [phase, setPhase] = React.useState('situation'); // situation | match | transition | result
  const [situation, setSituation] = React.useState(null);
  const [bracket, setBracket] = React.useState([]); // flat list of competitors for current round
  const [round, setRound] = React.useState(16);
  const [matchIdx, setMatchIdx] = React.useState(0);
  const [winners, setWinners] = React.useState([]); // winners within current round
  const [champion, setChampion] = React.useState(null);

  const startGame = (sit) => {
    setSituation(sit);
    setBracket(makeBracket(WORLDCUP_STORES));
    setRound(16);
    setMatchIdx(0);
    setWinners([]);
    setChampion(null);
    setPhase('match');
  };

  const pickRandom = () => {
    const sit = SITUATIONS[Math.floor(Math.random() * SITUATIONS.length)];
    startGame(sit);
  };

  const onMatchPick = (winner) => {
    const newWinners = [...winners, winner];
    const totalMatches = round / 2;
    const nextIdx = matchIdx + 1;

    if (nextIdx >= totalMatches) {
      // Round complete
      if (newWinners.length === 1) {
        setChampion(newWinners[0]);
        setPhase('result');
      } else {
        setBracket(newWinners);
        setWinners([]);
        setMatchIdx(0);
        setRound(round / 2);
        // Show transition before next round starts
        setPhase('transition');
      }
    } else {
      setWinners(newWinners);
      setMatchIdx(nextIdx);
    }
  };

  const restart = () => {
    setPhase('situation');
    setSituation(null);
    setBracket([]);
    setRound(16);
    setMatchIdx(0);
    setWinners([]);
    setChampion(null);
  };

  if (phase === 'situation') {
    return <SituationSelect onPick={startGame} onRandom={pickRandom} onExit={onExit}/>;
  }

  if (phase === 'match') {
    const pair = [bracket[matchIdx * 2], bracket[matchIdx * 2 + 1]];
    return (
      <MatchScreen
        round={round}
        matchIdx={matchIdx}
        totalMatches={round / 2}
        pair={pair}
        situation={situation}
        onPick={onMatchPick}
        onExit={onExit}
      />
    );
  }

  if (phase === 'transition') {
    return (
      <RoundTransition
        fromRound={round * 2}
        toRound={round}
        survivors={bracket}
        onNext={() => setPhase('match')}
      />
    );
  }

  if (phase === 'result' && champion) {
    return <ResultScreen winner={champion} situation={situation} onRestart={restart} onExit={onExit}/>;
  }

  return null;
}

Object.assign(window, { WorldCupFlow, SituationSelect, MatchScreen, RoundTransition, ResultScreen });
