// ═══════════════════════════════════════════════════════════════
// Primitives — 공통 컴포넌트
// ═══════════════════════════════════════════════════════════════

function StoreGlyph({ store, size = 44, radius = 14 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: radius,
      background: store.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.5, flexShrink: 0,
      boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
    }}>{store.emoji}</div>
  );
}

// Main coupon card used across Wallet and detail
function CouponRowCard({ coupon, store, onPress, urgent }) {
  const pct = Math.min(100, Math.max(0, 100 - (coupon.daysLeft / 30) * 100));
  return (
    <button onClick={onPress} style={{
      display: 'block', width: '100%', textAlign: 'left',
      background: '#fff', border: 'none', borderRadius: 18,
      padding: 0, overflow: 'hidden', cursor: 'pointer',
      boxShadow: '0 2px 6px rgba(25,31,40,0.06)',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{
        background: `linear-gradient(135deg, ${store.color}, ${store.color}DD)`,
        padding: '14px 16px', color: '#fff',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 22 }}>{store.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '800 13px/1.2 var(--font-sans)', letterSpacing: '-0.2px' }}>{store.name}</div>
          <div style={{ font: '500 11px/1 var(--font-sans)', opacity: 0.85, marginTop: 3 }}>
            {store.distance}m · {store.categoryLabel}
          </div>
        </div>
        {urgent && (
          <div style={{ background: '#fff', color: store.color, padding: '4px 8px', borderRadius: 6, font: '900 10px/1 var(--font-sans)', letterSpacing: 0.3 }}>
            D-{coupon.daysLeft}
          </div>
        )}
      </div>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ font: '800 15px/1.3 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.3px', marginBottom: 6 }}>
          {coupon.title}
        </div>
        <div style={{ font: '500 12px/1.4 var(--font-sans)', color: 'var(--gray-500)', letterSpacing: '-0.1px' }}>
          {coupon.conditions}
        </div>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 4, background: 'var(--gray-100)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: `${pct}%`, height: '100%',
              background: coupon.daysLeft <= 3 ? '#E53935' : 'var(--orange-500)',
            }}/>
          </div>
          <div style={{ font: '700 11px/1 var(--font-sans)', color: 'var(--gray-700)' }}>
            ~{coupon.expiresAt.slice(5).replace('-','.')}
          </div>
        </div>
      </div>
    </button>
  );
}

// Primary CTA button
function CTAButton({ children, onClick, variant = 'primary', fullWidth = true, style = {} }) {
  const styles = {
    primary: { background: 'var(--orange-500)', color: '#fff', boxShadow: '0 6px 16px rgba(255,111,15,0.3)' },
    dark: { background: 'var(--gray-900)', color: '#fff' },
    ghost: { background: 'transparent', color: 'var(--orange-500)', border: '1.5px solid var(--orange-500)' },
    light: { background: 'var(--gray-100)', color: 'var(--gray-900)' },
  };
  return (
    <button onClick={onClick} style={{
      width: fullWidth ? '100%' : 'auto',
      padding: '16px 24px',
      borderRadius: 14,
      border: 'none',
      font: '800 15px/1 var(--font-sans)',
      letterSpacing: '-0.2px',
      cursor: 'pointer',
      ...styles[variant],
      ...style,
    }}>{children}</button>
  );
}

Object.assign(window, { StoreGlyph, CouponRowCard, CTAButton });
