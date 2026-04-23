// ═══════════════════════════════════════════════════════════════
// Spec 02 · Screens — 스탬프 스캔 · 스탬프 카드 · 단골 라운지
// ═══════════════════════════════════════════════════════════════

// Hooks shortcuts — Spec 02 is self-contained (no shared scope with Spec 01)
const { useState, useEffect, useRef, useMemo } = React;

// ─────────── 1. Stamp Card 시각화 (10칸) ───────────
function StampCardVisual({ stamps, size = 'normal', color = '#FF6F0F', animate = false, highlightLast = false }) {
  const cellSize = size === 'small' ? 28 : size === 'large' ? 54 : 42;
  const gap = size === 'small' ? 6 : 10;
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: gap,
      padding: gap,
      background: '#FFF8F0',
      borderRadius: 16,
      border: '2px dashed ' + color + '40',
    }}>
      {Array.from({ length: 10 }).map((_, i) => {
        const filled = i < stamps;
        const isLast = i === stamps - 1;
        const isNewest = isLast && highlightLast;
        const isCrown = i === 9 && stamps >= 10;
        return (
          <div key={i} style={{
            width: cellSize, height: cellSize, borderRadius: cellSize / 2,
            background: filled ? (isCrown ? '#FFC93C' : color) : 'rgba(0,0,0,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: cellSize * 0.48,
            color: '#fff',
            position: 'relative',
            boxShadow: filled ? `0 2px 4px ${color}40` : 'inset 0 1px 2px rgba(0,0,0,0.06)',
            animation: isNewest && animate ? 'stamp-drop 0.6s var(--ease-spring)' : undefined,
            transform: isCrown ? 'scale(1.08)' : 'scale(1)',
          }}>
            {filled && (
              <span style={{
                fontWeight: 900, letterSpacing: '-0.5px',
                opacity: isCrown ? 1 : 0.95,
                transform: `rotate(${(i * 12) - 18}deg)`,
              }}>{isCrown ? '👑' : '✓'}</span>
            )}
            {!filled && (
              <span style={{ font: `900 ${cellSize * 0.35}px/1 var(--font-sans)`, color: 'rgba(0,0,0,0.12)' }}>
                {i + 1}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────── 2. Scan Entry Screen (지갑 탭 → 스탬프 카드 섹션) ───────────
function StampWalletScreen({ onOpenCard, onScan, onOpenSecret }) {
  const regulars = STAMP_CARDS.filter(c => c.tier === 'regular');
  const inProgress = STAMP_CARDS.filter(c => c.tier !== 'regular');
  const nearbyStore = STORES_02[0]; // 카페 봄날 — 반경 내라고 가정
  const nearbyCard = getStampCard(nearbyStore.id);

  return (
    <div style={{ height: '100%', background: '#F5F1EB', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '56px 20px 12px', background: '#F5F1EB' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
          <div style={{ font: '900 26px/1 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.8px' }}>
            내 단골 카드
          </div>
          <div style={{ font: '700 13px/1 var(--font-sans)', color: 'var(--orange-500)' }}>
            👑 {regulars.length}곳
          </div>
        </div>
        <div style={{ font: '500 13px/1.4 var(--font-sans)', color: 'var(--gray-600)' }}>
          도장을 찍을수록 내 단골이 되어가요
        </div>
      </div>

      {/* 반경 내 매장 - 스캔 CTA */}
      <div style={{ padding: '12px 16px 0' }}>
        <button onClick={onScan} style={{
          width: '100%', padding: 18, borderRadius: 18,
          background: 'linear-gradient(135deg, var(--orange-500) 0%, #FF9A3D 100%)',
          border: 'none', color: '#fff', textAlign: 'left',
          boxShadow: '0 8px 24px rgba(255,111,15,0.3)',
          display: 'flex', alignItems: 'center', gap: 14,
          cursor: 'pointer',
          animation: 'pulse-glow 2.4s ease-in-out infinite',
        }}>
          <div style={{
            width: 54, height: 54, borderRadius: 14,
            background: 'rgba(255,255,255,0.25)',
            backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, flexShrink: 0,
          }}>📍</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '800 14px/1.2 var(--font-sans)', opacity: 0.9, marginBottom: 4, letterSpacing: '-0.1px' }}>
              지금 {nearbyStore.name} · {nearbyStore.distance}m
            </div>
            <div style={{ font: '900 17px/1.2 var(--font-sans)', letterSpacing: '-0.4px', marginBottom: 6 }}>
              오늘 방문 도장 찍기
            </div>
            <div style={{ font: '600 12px/1.2 var(--font-sans)', opacity: 0.85 }}>
              {nearbyCard.stamps}/10 · 단골까지 {10 - nearbyCard.stamps}번 더
            </div>
          </div>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M7 5l5 5-5 5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px 100px' }} className="device-scroll">
        {/* 단골 매장 섹션 */}
        {regulars.length > 0 && (
          <React.Fragment>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 4px 10px' }}>
              <span style={{ fontSize: 16 }}>👑</span>
              <div style={{ font: '900 15px/1 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.3px' }}>
                내가 단골인 매장
              </div>
              <div style={{ font: '700 12px/1 var(--font-sans)', color: 'var(--orange-500)' }}>
                {regulars.length}곳 · 시크릿 혜택 {SECRET_COUPONS.filter(c => !c.locked).length}개
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
              {regulars.map(card => (
                <StampCardRow key={card.storeId} card={card} onPress={() => onOpenCard(card.storeId)}/>
              ))}
            </div>
          </React.Fragment>
        )}

        {/* 진행 중 섹션 */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 4px 10px' }}>
          <span style={{ fontSize: 16 }}>✨</span>
          <div style={{ font: '900 15px/1 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.3px' }}>
            진행 중
          </div>
          <div style={{ font: '700 12px/1 var(--font-sans)', color: 'var(--gray-500)' }}>
            {inProgress.length}곳
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {inProgress.map(card => (
            <StampCardRow key={card.storeId} card={card} onPress={() => onOpenCard(card.storeId)}/>
          ))}
        </div>

        {/* 시크릿 쿠폰 모음 */}
        <button onClick={onOpenSecret} style={{
          marginTop: 28, width: '100%', padding: '18px 20px',
          background: '#191F28', borderRadius: 16, border: 'none',
          color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
        }}>
          <div style={{ fontSize: 28 }}>🎁</div>
          <div style={{ flex: 1 }}>
            <div style={{ font: '900 14px/1.2 var(--font-sans)', letterSpacing: '-0.2px' }}>
              내 시크릿 쿠폰 {SECRET_COUPONS.filter(c => !c.locked).length}장
            </div>
            <div style={{ font: '500 11px/1.4 var(--font-sans)', opacity: 0.7, marginTop: 3 }}>
              단골만 볼 수 있는 혜택
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7 4l4 5-4 5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
    </div>
  );
}

// Stamp card row (list item)
function StampCardRow({ card, onPress }) {
  const store = findStore02(card.storeId);
  const info = tierInfo(card.tier);
  return (
    <button onClick={onPress} style={{
      width: '100%', textAlign: 'left', cursor: 'pointer',
      background: '#fff', border: 'none', borderRadius: 18,
      padding: 16, display: 'flex', gap: 14, alignItems: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        width: 54, height: 54, borderRadius: 14,
        background: store.color, fontSize: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>{store.emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <div style={{ font: '800 14px/1.2 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.2px' }}>
            {store.name}
          </div>
          <div style={{
            padding: '2px 7px', background: info.color + '20',
            borderRadius: 5, font: '900 10px/1 var(--font-sans)',
            color: info.color, letterSpacing: '0.2px',
          }}>{info.glyph} {info.label}</div>
        </div>
        <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 6, borderRadius: 3,
              background: i < card.stamps ? store.color : 'rgba(0,0,0,0.06)',
            }}/>
          ))}
        </div>
        <div style={{ font: '600 11px/1 var(--font-sans)', color: 'var(--gray-500)' }}>
          {card.stamps}/10 · {card.tier === 'regular' ? '단골 완성!' : `${10 - card.stamps}번 더`}
        </div>
      </div>
    </button>
  );
}

// ─────────── 3. 스캔 카메라 화면 ───────────
function ScannerScreen({ onCapture, onBack }) {
  const [scanning, setScanning] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => { setScanning(false); onCapture(); }, 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ height: '100%', background: '#000', display: 'flex', flexDirection: 'column', color: '#fff', position: 'relative' }}>
      {/* Fake camera preview - dark noise */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, #1A1A1A 0%, #000 80%)',
        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence baseFrequency=\'0.9\' /%3E%3C/filter%3E%3Crect width=\'100\' height=\'100\' filter=\'url(%23n)\' opacity=\'0.15\'/%3E%3C/svg%3E")',
      }}/>
      {/* Header */}
      <div style={{ position: 'relative', padding: '54px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
        <button onClick={onBack} style={{ background: 'rgba(0,0,0,0.4)', border: 'none', width: 40, height: 40, borderRadius: 20, color: '#fff', fontSize: 18, cursor: 'pointer' }}>✕</button>
        <div style={{ font: '800 14px/1 var(--font-sans)' }}>스탬프 스캔</div>
        <div style={{ width: 40 }}/>
      </div>

      {/* Viewfinder */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative', zIndex: 2 }}>
        <div style={{ font: '800 16px/1.3 var(--font-sans)', marginBottom: 6, textAlign: 'center' }}>
          {scanning ? '매장 QR을 프레임에 맞춰주세요' : '인식 중...'}
        </div>
        <div style={{ font: '500 12px/1.4 var(--font-sans)', opacity: 0.7, marginBottom: 32, textAlign: 'center' }}>
          카페 봄날 · 80m · GPS 확인됨
        </div>
        <div style={{ position: 'relative', width: 260, height: 260 }}>
          {/* 4 corners */}
          {[{ t: 0, l: 0, r1: 'tl' }, { t: 0, r: 0, r1: 'tr' }, { b: 0, l: 0, r1: 'bl' }, { b: 0, r: 0, r1: 'br' }].map((c, i) => (
            <div key={i} style={{
              position: 'absolute',
              top: c.t !== undefined ? c.t : undefined,
              bottom: c.b !== undefined ? c.b : undefined,
              left: c.l !== undefined ? c.l : undefined,
              right: c.r !== undefined ? c.r : undefined,
              width: 40, height: 40,
              borderTop: c.t !== undefined ? '4px solid var(--orange-500)' : undefined,
              borderBottom: c.b !== undefined ? '4px solid var(--orange-500)' : undefined,
              borderLeft: c.l !== undefined ? '4px solid var(--orange-500)' : undefined,
              borderRight: c.r !== undefined ? '4px solid var(--orange-500)' : undefined,
              borderRadius: c.r1 === 'tl' ? '10px 0 0 0' : c.r1 === 'tr' ? '0 10px 0 0' : c.r1 === 'bl' ? '0 0 0 10px' : '0 0 10px 0',
            }}/>
          ))}
          {/* Scanning line */}
          {scanning && (
            <div style={{
              position: 'absolute', left: 10, right: 10, top: 0, height: 2,
              background: 'linear-gradient(90deg, transparent, var(--orange-500), transparent)',
              boxShadow: '0 0 16px var(--orange-500)',
              animation: 'scan-line 1.6s ease-in-out infinite',
            }}/>
          )}
          {/* Fake QR (subtle) */}
          <div style={{
            position: 'absolute', inset: 30,
            opacity: 0.3,
            background: `repeating-linear-gradient(0deg, #fff 0, #fff 8px, transparent 8px, transparent 16px),
                         repeating-linear-gradient(90deg, #fff 0, #fff 8px, transparent 8px, transparent 16px)`,
            backgroundBlendMode: 'difference',
          }}/>
        </div>
        <div style={{ marginTop: 28, padding: '10px 18px', background: 'rgba(0,0,0,0.4)', borderRadius: 20, font: '600 12px/1 var(--font-sans)', backdropFilter: 'blur(8px)' }}>
          📍 GPS 반경 50m 내에서만 유효해요
        </div>
      </div>
    </div>
  );
}

// ─────────── 4. 도장 찍히는 애니메이션 화면 ───────────
function StampCelebrationScreen({ storeId, oldStamps, goto }) {
  const store = findStore02(storeId);
  const newStamps = oldStamps + 1;
  const becomesRegular = newStamps === 10;
  const [phase, setPhase] = useState('stamping'); // stamping | counter | regular

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(becomesRegular ? 'regular' : 'counter'), 1400);
    return () => clearTimeout(t1);
  }, []);

  if (phase === 'regular') {
    return <RegularCelebration storeId={storeId} goto={goto}/>;
  }

  return (
    <div style={{
      height: '100%', background: '#FFF8F0',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 32, color: 'var(--gray-900)', position: 'relative',
    }}>
      {phase === 'counter' && (
        <button onClick={() => goto('wallet')} style={{
          position: 'absolute', top: 54, right: 20,
          background: 'none', border: 'none', color: 'var(--gray-500)',
          font: '700 14px/1 var(--font-sans)', cursor: 'pointer',
        }}>완료</button>
      )}
      <div style={{ fontSize: 38, marginBottom: 12 }}>{store.emoji}</div>
      <div style={{ font: '800 14px/1 var(--font-sans)', color: 'var(--gray-700)', letterSpacing: '-0.2px', marginBottom: 6 }}>
        {store.name}
      </div>
      <div style={{ font: '900 28px/1.2 var(--font-sans)', letterSpacing: '-0.8px', marginBottom: 32, textAlign: 'center' }}>
        {phase === 'stamping' ? '도장 찍는 중…' : `${newStamps}/10`}
      </div>

      <div style={{ width: 300 }}>
        <StampCardVisual
          stamps={newStamps}
          size="large"
          color={store.color}
          animate={phase === 'stamping'}
          highlightLast={true}
        />
      </div>

      {phase === 'counter' && (
        <React.Fragment>
          <div style={{
            marginTop: 28, padding: '14px 20px',
            background: '#fff', borderRadius: 14,
            border: `2px solid ${store.color}30`,
            textAlign: 'center',
          }}>
            <div style={{ font: '800 14px/1.3 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.2px' }}>
              단골까지 <span style={{ color: store.color }}>{10 - newStamps}번</span> 더!
            </div>
            <div style={{ font: '500 12px/1.4 var(--font-sans)', color: 'var(--gray-500)', marginTop: 4 }}>
              다음 방문: 24시간 후부터 도장 찍기 가능
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button style={{
              padding: '12px 18px', borderRadius: 12,
              background: 'var(--gray-900)', color: '#fff',
              border: 'none', font: '700 13px/1 var(--font-sans)', cursor: 'pointer',
            }}>🗒 리뷰 남기기</button>
            <button style={{
              padding: '12px 18px', borderRadius: 12,
              background: '#fff', color: 'var(--gray-900)',
              border: '1.5px solid var(--gray-300)', font: '700 13px/1 var(--font-sans)', cursor: 'pointer',
            }}>📣 언니에게 자랑</button>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

// ─────────── 5. 단골 달성 축하 ───────────
function RegularCelebration({ storeId, goto }) {
  const store = findStore02(storeId);
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 800),
      setTimeout(() => setStage(2), 1800),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div style={{
      height: '100%', position: 'relative', overflow: 'hidden',
      background: `linear-gradient(160deg, ${store.color} 0%, #FFC93C 120%)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 32, color: '#fff',
    }}>
      {/* Confetti */}
      {stage >= 1 && Array.from({ length: 20 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', top: '-10px',
          left: `${(i * 5) + 5}%`,
          width: 8, height: 12,
          background: ['#fff', '#FFC93C', '#FF6F0F', '#FFE0C8'][i % 4],
          animation: `confetti-fall ${2 + (i % 3) * 0.5}s ${i * 0.05}s linear`,
          borderRadius: 2,
        }}/>
      ))}

      <div style={{ height: 60 }}/>
      <div style={{ fontSize: 72, marginBottom: 12, animation: 'pulse-dot 1.2s ease-in-out infinite' }}>
        👑
      </div>
      <div style={{ font: '700 13px/1 var(--font-sans)', opacity: 0.9, marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' }}>
        {store.name}
      </div>
      <div style={{
        font: '900 34px/1.15 var(--font-sans)',
        letterSpacing: '-1px', textAlign: 'center', marginBottom: 16,
        animation: 'fade-in 0.6s 0.3s both',
      }}>
        단골이<br/>되었습니다
      </div>
      <div style={{
        padding: '10px 16px', background: 'rgba(255,255,255,0.2)',
        backdropFilter: 'blur(10px)', borderRadius: 20,
        font: '700 12px/1 var(--font-sans)', letterSpacing: 0.2, marginBottom: 28,
        animation: 'fade-in 0.6s 0.5s both',
      }}>
        🎉 상남동 {regularsTotalCount() + 1}번째 단골 달성
      </div>

      {/* 해금된 혜택 */}
      {stage >= 2 && (
        <div style={{
          background: '#fff', color: 'var(--gray-900)',
          borderRadius: 20, padding: 20,
          width: '100%', maxWidth: 320,
          animation: 'slide-up-in 0.7s var(--ease-spring) both',
          boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
        }}>
          <div style={{ font: '700 11px/1 var(--font-sans)', color: 'var(--gray-500)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>
            해금된 혜택
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: '🎁', title: '시크릿 쿠폰 2장', desc: '일반 쿠폰보다 50% 더 할인' },
              { icon: '🍽️', title: '히든 메뉴 접근', desc: store.rewardDescription },
              { icon: '⚡', title: '우선 예약·대접', desc: '사장님이 바로 알아봐요' },
            ].map((b, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, alignItems: 'center',
                padding: '10px 0',
                borderBottom: i < 2 ? '1px solid var(--gray-100)' : 'none',
              }}>
                <div style={{ fontSize: 26 }}>{b.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '800 13px/1.2 var(--font-sans)', letterSpacing: '-0.2px' }}>{b.title}</div>
                  <div style={{ font: '500 11px/1.4 var(--font-sans)', color: 'var(--gray-500)', marginTop: 3 }}>
                    {b.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => goto('cardDetail')} style={{
            marginTop: 16, width: '100%', padding: 14,
            background: 'var(--gray-900)', color: '#fff', border: 'none',
            borderRadius: 12, font: '800 14px/1 var(--font-sans)', cursor: 'pointer',
          }}>혜택 지금 확인하기</button>
        </div>
      )}
      <div style={{ flex: 1 }}/>
    </div>
  );
}

// ─────────── 6. 스탬프 카드 상세 (한 매장) ───────────
function StampCardDetail({ storeId, onBack, onScan }) {
  const store = findStore02(storeId);
  const card = getStampCard(storeId);
  const info = tierInfo(card.tier);
  const secrets = getSecretCoupons(storeId);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F5F1EB' }}>
      {/* Hero */}
      <div style={{
        background: `linear-gradient(160deg, ${store.color}, ${store.color}DD)`,
        color: '#fff', padding: '54px 24px 32px',
        borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
      }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', width: 36, height: 36, borderRadius: 18, cursor: 'pointer', marginBottom: 20 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M12 5l-5 5 5 5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 42 }}>{store.emoji}</div>
          <div>
            <div style={{ font: '500 11px/1 var(--font-sans)', opacity: 0.85, marginBottom: 4, letterSpacing: 0.3, textTransform: 'uppercase' }}>
              {store.categoryLabel} · {store.distance}m
            </div>
            <div style={{ font: '900 22px/1.1 var(--font-sans)', letterSpacing: '-0.5px' }}>
              {store.name}
            </div>
          </div>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', background: 'rgba(255,255,255,0.2)', borderRadius: 999,
          font: '900 12px/1 var(--font-sans)', backdropFilter: 'blur(10px)',
        }}>
          <span>{info.glyph}</span>
          <span>{info.label}</span>
          <span style={{ opacity: 0.6 }}>·</span>
          <span>{card.stamps}/10</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 120px' }} className="device-scroll">
        {/* Stamp card visual */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ font: '900 16px/1.2 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.3px' }}>
              {store.stampCardTitle}
            </div>
            <div style={{ font: '700 12px/1 var(--font-sans)', color: 'var(--gray-500)' }}>
              {card.firstVisit.slice(5).replace('-','.')} 부터
            </div>
          </div>
          <StampCardVisual stamps={card.stamps} size="large" color={store.color}/>
          {card.tier !== 'regular' && (
            <div style={{
              marginTop: 14, padding: 12, background: 'var(--orange-50)',
              borderRadius: 10, font: '700 12px/1.4 var(--font-sans)', color: 'var(--orange-700)',
              textAlign: 'center',
            }}>
              단골까지 <span style={{ fontSize: 16 }}>{10 - card.stamps}번</span> 더 방문하면 시크릿 혜택 해금 🎁
            </div>
          )}
        </div>

        {/* 혜택 섹션 */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 20, marginBottom: 16 }}>
          <div style={{ font: '700 11px/1 var(--font-sans)', color: 'var(--gray-500)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>
            단골이 되면 이런게 열려요
          </div>
          {secrets.map(sc => {
            const locked = sc.locked && card.tier !== 'regular';
            return (
              <div key={sc.id} style={{
                display: 'flex', gap: 12, padding: '12px 0',
                borderBottom: '1px solid var(--gray-100)',
                opacity: locked ? 0.5 : 1,
                filter: locked ? 'grayscale(0.6)' : 'none',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: locked ? 'var(--gray-200)' : store.color + '20',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, flexShrink: 0,
                }}>{locked ? '🔒' : '🎁'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '800 13px/1.2 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.2px', marginBottom: 3 }}>
                    {sc.title}
                  </div>
                  <div style={{ font: '500 11px/1.3 var(--font-sans)', color: 'var(--gray-500)' }}>
                    {sc.conditions}
                  </div>
                </div>
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: 12, padding: '12px 0' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: card.tier === 'regular' ? '#FF6F0F20' : 'var(--gray-200)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
              opacity: card.tier === 'regular' ? 1 : 0.5,
            }}>{card.tier === 'regular' ? '⚡' : '🔒'}</div>
            <div style={{ flex: 1, opacity: card.tier === 'regular' ? 1 : 0.5 }}>
              <div style={{ font: '800 13px/1.2 var(--font-sans)', color: 'var(--gray-900)', marginBottom: 3 }}>
                우선 예약 · 줄 서기
              </div>
              <div style={{ font: '500 11px/1.3 var(--font-sans)', color: 'var(--gray-500)' }}>
                사장님 앱에 "단골이 오셨어요" 자동 알림
              </div>
            </div>
          </div>
        </div>

        {/* 매장 현황 */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 20 }}>
          <div style={{ font: '700 11px/1 var(--font-sans)', color: 'var(--gray-500)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>
            이 매장의 단골 커뮤니티
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <div>
              <div style={{ font: '900 22px/1 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.5px' }}>
                {store.regularsCount}명
              </div>
              <div style={{ font: '500 11px/1 var(--font-sans)', color: 'var(--gray-500)', marginTop: 4 }}>
                총 단골
              </div>
            </div>
            <div style={{ width: 1, background: 'var(--gray-150)' }}/>
            <div>
              <div style={{ font: '900 22px/1 var(--font-sans)', color: store.color, letterSpacing: '-0.5px' }}>
                {store.thisWeekVisits}명
              </div>
              <div style={{ font: '500 11px/1 var(--font-sans)', color: 'var(--gray-500)', marginTop: 4 }}>
                이번주 방문
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '16px 20px 40px', background: '#fff',
        borderTop: '1px solid var(--gray-150)',
      }}>
        <button onClick={onScan} style={{
          width: '100%', padding: 16, borderRadius: 14,
          background: store.color, color: '#fff', border: 'none',
          font: '800 15px/1 var(--font-sans)', cursor: 'pointer',
          boxShadow: `0 6px 16px ${store.color}40`,
        }}>
          오늘 도장 찍기
        </button>
      </div>
    </div>
  );
}

// ─────────── 7. 사장님 앱 — 단골 대시보드 ───────────
function OwnerDashboard({ onBack }) {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setPulse(p => !p), 2000);
    return () => clearInterval(t);
  }, []);

  const burger = STORES_02.find(s => s.id === 's_burger');
  const newRegularsThisWeek = 3;

  return (
    <div style={{ height: '100%', background: '#F4F2ED', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <div style={{ padding: '54px 20px 12px', background: '#191F28', color: '#fff' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', width: 36, height: 36, borderRadius: 18, cursor: 'pointer', marginBottom: 12 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M12 5l-5 5 5 5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div>
            <div style={{ font: '500 11px/1 var(--font-sans)', opacity: 0.6, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 6 }}>
              언니픽 사장님 · 뽀글이 수제버거
            </div>
            <div style={{ font: '900 22px/1.2 var(--font-sans)', letterSpacing: '-0.5px' }}>
              내 단골 손님
            </div>
          </div>
          <div style={{
            padding: '6px 12px', background: 'var(--orange-500)',
            borderRadius: 999, font: '900 12px/1 var(--font-sans)',
          }}>+{newRegularsThisWeek} 이번주</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 40px' }} className="device-scroll">
        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { label: '총 단골', value: '23', delta: '+3', color: '#FF6F0F' },
            { label: '자주감', value: '12', delta: '+5', color: '#FF9A3D' },
            { label: '이번주 방문', value: '8', delta: '+2', color: 'var(--gray-900)' },
            { label: '재방문율', value: '41%', delta: '+8%p', color: '#34C759' },
          ].map(s => (
            <div key={s.label} style={{
              background: '#fff', borderRadius: 14, padding: 16,
            }}>
              <div style={{ font: '600 11px/1 var(--font-sans)', color: 'var(--gray-500)', marginBottom: 8, letterSpacing: '-0.1px' }}>
                {s.label}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <div style={{ font: '900 24px/1 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.5px' }}>
                  {s.value}
                </div>
                <div style={{ font: '800 11px/1 var(--font-sans)', color: s.color }}>
                  {s.delta}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Real-time alert — someone just scanned */}
        <div style={{
          background: `linear-gradient(135deg, var(--orange-500), #FF9A3D)`,
          color: '#fff', borderRadius: 16, padding: 16, marginBottom: 16,
          boxShadow: pulse ? '0 0 0 4px rgba(255,111,15,0.3)' : '0 4px 12px rgba(255,111,15,0.2)',
          transition: 'box-shadow 0.5s',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: 23, background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, flexShrink: 0,
          }}>🌻</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '800 13px/1.2 var(--font-sans)', marginBottom: 3 }}>
              <span style={{ fontSize: 15 }}>소연님</span>이 방금 스캔했어요
            </div>
            <div style={{ font: '600 11px/1.4 var(--font-sans)', opacity: 0.9 }}>
              👑 단골 · 11번째 방문 · 히든 메뉴 자격 있음
            </div>
          </div>
          <div style={{
            padding: '6px 10px', background: 'rgba(255,255,255,0.25)',
            borderRadius: 8, font: '900 11px/1 var(--font-sans)',
            backdropFilter: 'blur(10px)',
          }}>인사하기</div>
        </div>

        {/* Regulars list */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ font: '900 14px/1 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.3px' }}>
              최근 방문 단골
            </div>
            <div style={{ font: '600 12px/1 var(--font-sans)', color: 'var(--gray-500)' }}>
              전체 보기
            </div>
          </div>
          {REGULARS_AT_BURGER.map((r, i) => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 0',
              borderBottom: i < REGULARS_AT_BURGER.length - 1 ? '1px solid var(--gray-100)' : 'none',
              background: r.justScanned ? 'linear-gradient(90deg, rgba(255,111,15,0.06), transparent)' : 'transparent',
              margin: r.justScanned ? '0 -16px' : '0',
              padding: r.justScanned ? '12px 16px' : '12px 0',
              borderRadius: r.justScanned ? 10 : 0,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 20,
                background: r.tier === '단골' ? 'var(--orange-50)' : 'var(--gray-100)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, flexShrink: 0,
              }}>{r.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <div style={{ font: '800 13px/1.2 var(--font-sans)', color: 'var(--gray-900)' }}>
                    {r.name}
                  </div>
                  <div style={{
                    padding: '2px 6px', background: r.tier === '단골' ? 'var(--orange-500)' : 'var(--gray-400)',
                    color: '#fff', borderRadius: 4, font: '900 9px/1 var(--font-sans)',
                    letterSpacing: 0.2,
                  }}>{r.tier}</div>
                </div>
                <div style={{ font: '500 11px/1.3 var(--font-sans)', color: 'var(--gray-500)' }}>
                  누적 {r.visits}회 · {r.lastVisit}
                </div>
              </div>
              {r.justScanned && (
                <div style={{
                  padding: '4px 8px', background: 'var(--orange-500)', color: '#fff',
                  borderRadius: 6, font: '900 10px/1 var(--font-sans)',
                  animation: 'pulse-dot 1.4s ease-in-out infinite',
                }}>입장 중</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────── 8. Live Activity — 스탬프 적립 결과 ───────────
function StampLiveActivity({ storeId, newStamps }) {
  const store = findStore02(storeId);
  const becomesRegular = newStamps === 10;
  return (
    <div style={{
      width: '100%', background: 'rgba(22,22,28,0.55)',
      backdropFilter: 'blur(40px) saturate(180%)',
      border: '0.5px solid rgba(255,255,255,0.15)',
      borderRadius: 20, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 18, height: 18, borderRadius: 5,
          background: becomesRegular ? '#FFC93C' : store.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10,
        }}>{becomesRegular ? '👑' : '📍'}</div>
        <span style={{ font: '700 12px/1 var(--font-sans)', color: 'rgba(255,255,255,0.7)', letterSpacing: '-0.1px' }}>
          언니픽
        </span>
        <div style={{ width: 3, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }}/>
        <span style={{ font: '600 12px/1 var(--font-sans)', color: 'rgba(255,255,255,0.55)' }}>방금</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: store.color, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 22, flexShrink: 0,
        }}>{store.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '800 14px/1.2 var(--font-sans)', color: '#fff', letterSpacing: '-0.2px', marginBottom: 3 }}>
            {becomesRegular ? `${store.name} 단골 달성!` : `${store.name}에 도장 찍었어요`}
          </div>
          <div style={{ font: '500 12px/1.3 var(--font-sans)', color: 'rgba(255,255,255,0.7)' }}>
            {becomesRegular ? '시크릿 혜택 해금 · 탭해서 확인' : `${newStamps}/10 · 단골까지 ${10 - newStamps}번 더`}
          </div>
        </div>
      </div>
      {/* Mini stamps */}
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 5, borderRadius: 3,
            background: i < newStamps ? (i === 9 && becomesRegular ? '#FFC93C' : store.color) : 'rgba(255,255,255,0.15)',
          }}/>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  StampCardVisual, StampWalletScreen, StampCardRow, ScannerScreen,
  StampCelebrationScreen, RegularCelebration, StampCardDetail,
  OwnerDashboard, StampLiveActivity,
});
