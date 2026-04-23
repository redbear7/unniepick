// ═══════════════════════════════════════════════════════════════
// LockScreen & DynamicIsland & Widget
// iOS 잠금화면 위의 Live Activity + Dynamic Island 표현
// ═══════════════════════════════════════════════════════════════

// 잠금화면 배경 (상남동 저녁 사진 분위기의 그라데이션)
function LockScreenBg({ children }) {
  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      background: `
        radial-gradient(ellipse at 30% 20%, #FF8A4D 0%, transparent 40%),
        radial-gradient(ellipse at 70% 80%, #6B3FA0 0%, transparent 50%),
        linear-gradient(180deg, #2C1B4E 0%, #1A0E2E 50%, #0A0515 100%)
      `,
    }}>
      {/* 실루엣 건물들 */}
      <svg width="100%" height="100%" viewBox="0 0 402 874" style={{ position: 'absolute', bottom: 0, opacity: 0.6 }} preserveAspectRatio="xMidYMax slice">
        <path d="M0 700 L0 874 L402 874 L402 650 L360 650 L360 620 L320 620 L320 680 L280 680 L280 640 L240 640 L240 700 L200 700 L200 660 L160 660 L160 720 L120 720 L120 690 L80 690 L80 740 L40 740 L40 710 L0 710 Z" fill="#0A0515"/>
      </svg>
      {/* 별 몇 개 */}
      {[{ x: 60, y: 180 }, { x: 280, y: 120 }, { x: 350, y: 240 }, { x: 150, y: 80 }].map((s, i) => (
        <div key={i} style={{
          position: 'absolute', left: s.x, top: s.y,
          width: 2, height: 2, borderRadius: 2,
          background: '#fff', opacity: 0.7,
          boxShadow: '0 0 4px rgba(255,255,255,0.8)',
        }}/>
      ))}
      {children}
    </div>
  );
}

// Live Activity 카드 (iOS lock screen 스타일)
function LiveActivityCard({ expanded = true, onTap }) {
  const pair = primaryNearbyCoupon(100);
  if (!pair) return null;
  const { c: coupon, s: store } = pair;
  const extraCount = WALLET.filter(x => x.isNearby && x.storeId !== store.id && findStore(x.storeId).distance <= 300).length;

  if (!expanded) {
    // Compact pill (Dynamic Island minimal state)
    return null;
  }

  return (
    <button onClick={onTap} style={{
      width: '100%', background: 'rgba(22,22,28,0.55)',
      backdropFilter: 'blur(40px) saturate(180%)',
      WebkitBackdropFilter: 'blur(40px) saturate(180%)',
      border: '0.5px solid rgba(255,255,255,0.15)',
      borderRadius: 20, padding: '14px 16px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
      animation: 'slide-up-in 0.6s var(--ease-spring)',
      cursor: 'pointer',
    }}>
      {/* Row 1: 앱 라벨 + 신호 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 18, height: 18, borderRadius: 5,
          background: 'var(--orange-500)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10,
        }}>🎟</div>
        <span style={{ font: '700 12px/1 var(--font-sans)', color: 'rgba(255,255,255,0.7)', letterSpacing: '-0.1px' }}>
          언니픽
        </span>
        <div style={{ width: 3, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }}/>
        <span style={{ font: '600 12px/1 var(--font-sans)', color: 'rgba(255,255,255,0.55)' }}>지금</span>
        <div style={{ flex: 1 }}/>
        <span style={{ font: '900 11px/1 var(--font-sans)', color: 'var(--orange-300)', letterSpacing: 0.3 }}>
          {store.distance}m
        </span>
      </div>

      {/* Row 2: 메인 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: store.color, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 26, flexShrink: 0,
          boxShadow: `0 4px 14px ${store.color}55`,
        }}>{store.emoji}</div>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={{ font: '800 14px/1.2 var(--font-sans)', color: '#fff', letterSpacing: '-0.2px', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {coupon.title}
          </div>
          <div style={{ font: '500 12px/1.3 var(--font-sans)', color: 'rgba(255,255,255,0.65)', letterSpacing: '-0.1px' }}>
            {store.name} · D-{coupon.daysLeft}
          </div>
        </div>
      </div>

      {/* Row 3: 추가 안내 */}
      {extraCount > 0 && (
        <div style={{
          marginTop: 2,
          padding: '8px 10px',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 10,
          font: '600 11px/1.2 var(--font-sans)',
          color: 'rgba(255,255,255,0.75)',
          letterSpacing: '-0.05px',
          textAlign: 'left',
        }}>
          📍 근처에 쿠폰 <b style={{ color: 'var(--orange-300)', fontWeight: 800 }}>{extraCount}장</b> 더 있어요
        </div>
      )}
    </button>
  );
}

// Dynamic Island expanded state (when user taps the pill)
function DynamicIslandExpanded({ visible = true }) {
  const pair = primaryNearbyCoupon(100);
  if (!pair || !visible) return null;
  const { c: coupon, s: store } = pair;
  return (
    <div style={{
      position: 'absolute', top: 8, left: 8, right: 8,
      background: '#000', borderRadius: 38,
      padding: '14px 18px 16px',
      display: 'flex', alignItems: 'center', gap: 14,
      color: '#fff', zIndex: 100,
      animation: 'fade-in 0.3s',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 11,
        background: store.color, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: 22, flexShrink: 0,
      }}>{store.emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '800 13px/1.2 var(--font-sans)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {coupon.title}
        </div>
        <div style={{ font: '600 11px/1 var(--font-sans)', color: 'rgba(255,255,255,0.6)' }}>
          {store.name} · {store.distance}m
        </div>
      </div>
      <div style={{
        padding: '8px 12px', background: 'var(--orange-500)',
        borderRadius: 999, font: '800 11px/1 var(--font-sans)',
        letterSpacing: '-0.1px',
      }}>사용</div>
    </div>
  );
}

// Dynamic Island minimal (pill) state — with leading/trailing indicators
function DynamicIslandPill({ onTap }) {
  const pair = primaryNearbyCoupon(100);
  if (!pair) return null;
  const { c: coupon, s: store } = pair;
  return (
    <button onClick={onTap} style={{
      position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)',
      width: 126, height: 37, borderRadius: 24, background: '#000',
      zIndex: 55, border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 12px 0 8px',
    }}>
      {/* leading */}
      <div style={{
        width: 22, height: 22, borderRadius: 6,
        background: store.color, display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 13,
      }}>{store.emoji}</div>
      {/* trailing: distance pulse */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{
          width: 5, height: 5, borderRadius: 3,
          background: 'var(--orange-500)',
          animation: 'pulse-dot 1.4s ease-in-out infinite',
        }}/>
        <span style={{ font: '800 11px/1 var(--font-sans)', color: '#fff' }}>
          {store.distance}m
        </span>
      </div>
    </button>
  );
}

// Widget — 홈스크린 위젯 (큰 사이즈, 작은 사이즈)
function HomeWidget({ size = 'medium' }) {
  const list = nearbyStoresWithCoupons(500);
  const total = list.reduce((a, x) => a + x.coupons.length, 0);

  if (size === 'small') {
    const pair = primaryNearbyCoupon(500);
    const coupon = pair ? pair.c : null;
    const store = pair ? pair.s : null;
    return (
      <div style={{
        width: 170, height: 170, borderRadius: 22,
        background: 'linear-gradient(160deg, #FF6F0F, #FF9A3D)',
        padding: 16, color: '#fff',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 10px 30px rgba(255,111,15,0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 16, height: 16, borderRadius: 5, background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9,
          }}>🎟</div>
          <span style={{ font: '700 10px/1 var(--font-sans)', opacity: 0.9, letterSpacing: '-0.1px' }}>
            언니픽
          </span>
        </div>
        <div style={{ flex: 1 }}/>
        {coupon ? (
          <React.Fragment>
            <div style={{ fontSize: 26, marginBottom: 6 }}>{store.emoji}</div>
            <div style={{ font: '900 13px/1.2 var(--font-sans)', letterSpacing: '-0.3px', marginBottom: 4 }}>
              {coupon.title.length > 14 ? coupon.title.slice(0, 14) + '…' : coupon.title}
            </div>
            <div style={{ font: '700 10px/1 var(--font-sans)', opacity: 0.85, letterSpacing: '-0.1px' }}>
              {store.distance}m · {store.name.slice(0, 8)}
            </div>
          </React.Fragment>
        ) : (
          <div style={{ font: '800 14px/1.3 var(--font-sans)' }}>근처에 쿠폰이 없어요</div>
        )}
      </div>
    );
  }

  // medium 4x2 style
  return (
    <div style={{
      width: 364, height: 170, borderRadius: 22,
      background: '#fff',
      padding: 16,
      boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 18, height: 18, borderRadius: 5,
          background: 'var(--orange-500)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
        }}>🎟</div>
        <span style={{ font: '800 11px/1 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.1px' }}>
          근처 쿠폰
        </span>
        <div style={{ flex: 1 }}/>
        <span style={{
          padding: '3px 8px', background: 'var(--orange-50)',
          borderRadius: 8, font: '900 10px/1 var(--font-sans)',
          color: 'var(--orange-700)', letterSpacing: 0.2,
        }}>{total}장</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, overflow: 'hidden' }}>
        {list.slice(0, 3).map(({ store, coupons }) => (
          <div key={store.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: store.color, fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>{store.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '700 11px/1.15 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {coupons[0].title}
              </div>
              <div style={{ font: '600 10px/1 var(--font-sans)', color: 'var(--gray-500)', marginTop: 2 }}>
                {store.name} · {store.distance}m
              </div>
            </div>
            {coupons[0].daysLeft <= 3 && (
              <div style={{
                padding: '2px 6px', background: '#FFEBEE',
                borderRadius: 5, font: '900 9px/1 var(--font-sans)',
                color: '#E53935', letterSpacing: 0.2,
              }}>D-{coupons[0].daysLeft}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Home screen mock (behind widget)
function HomeScreenBg({ children }) {
  const apps = ['💬','📷','🎵','📧','📅','🗺','🌤','📱','🏦','🛒','📺','⚙️'];
  return (
    <LockScreenBg>
      <div style={{
        position: 'absolute', inset: 0, padding: '70px 20px 100px',
        display: 'flex', flexDirection: 'column',
      }}>
        {children}
        <div style={{ flex: 1 }}/>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20,
          padding: '20px 0', marginBottom: 20,
        }}>
          {apps.slice(0, 8).map((e, i) => (
            <div key={i} style={{
              aspectRatio: '1/1', borderRadius: 18,
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28,
            }}>{e}</div>
          ))}
        </div>
      </div>
    </LockScreenBg>
  );
}

Object.assign(window, {
  LockScreenBg, LiveActivityCard, DynamicIslandExpanded, DynamicIslandPill,
  HomeWidget, HomeScreenBg,
});
