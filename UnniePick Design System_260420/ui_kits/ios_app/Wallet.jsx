// WalletCard — saved coupon with expiry progress

function WalletCard({ coupon, onUse, onCancel }) {
  const isUsed = coupon.status === 'used';
  const isExpired = coupon.status === 'expired';
  const pct = Math.max(0, Math.min(100, coupon.expiryPct || 80));
  const urgent = coupon.daysLeft <= 1;
  return (
    <div style={{
      background: '#fff', borderRadius: 16, margin: '12px 16px',
      overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
      opacity: isUsed || isExpired ? 0.55 : 1,
    }}>
      <div style={{
        background: isUsed ? 'var(--gray-500)' : isExpired ? 'var(--gray-400)' :
          urgent ? 'linear-gradient(135deg,#E53935,#FF6F0F)' : 'linear-gradient(135deg,#FF6F0F,#FF9A3D)',
        padding: '16px 18px', color: '#fff',
      }}>
        <div style={{ font: '700 11px/1 var(--font-sans)', opacity: 0.9, marginBottom: 6, display:'flex',justifyContent:'space-between' }}>
          <span>{coupon.store}</span>
          {isUsed && <span>✓ 사용완료</span>}
          {isExpired && <span>만료</span>}
        </div>
        <div style={{ font: '900 18px/1.2 var(--font-sans)', letterSpacing:'-0.4px', marginBottom: 8 }}>
          {coupon.title}
        </div>
        <div style={{ font: '400 11px/1 var(--font-sans)', opacity: 0.85 }}>
          ~{coupon.expiryDate} 까지
        </div>
      </div>
      {!isUsed && !isExpired && (
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ font: '700 11px/1 var(--font-sans)', color: 'var(--fg3)', marginBottom: 5, display: 'flex', justifyContent:'space-between' }}>
              <span>D-{coupon.daysLeft}</span><span>{pct}%</span>
            </div>
            <div style={{ height: 5, background: 'var(--gray-150)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: urgent ? '#E53935' : 'var(--orange-500)' }}/>
            </div>
          </div>
          <button className="up-btn up-btn-primary up-btn-small" onClick={()=>onUse(coupon.id)}>쿠폰 사용하기</button>
        </div>
      )}
    </div>
  );
}

function QRSheet({ coupon, onClose }) {
  if (!coupon) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: '#fff', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '50px 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ width: 40 }}/>
        <div style={{ font: '800 16px/1 var(--font-sans)', color: 'var(--fg1)' }}>QR 사용하기</div>
        <button onClick={onClose} style={{ background:'none',border:'none', font:'700 14px/1 var(--font-sans)', color: 'var(--fg2)' }}>닫기</button>
      </div>
      <div style={{ flex: 1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding: 20 }}>
        <div style={{ font: '800 22px/1.2 var(--font-sans)', textAlign:'center', marginBottom: 6 }}>{coupon.title}</div>
        <div style={{ font: '500 14px/1 var(--font-sans)', color: 'var(--fg3)', marginBottom: 28 }}>{coupon.store}</div>
        <div style={{ width: 240, height: 240, background: '#fff', borderRadius: 16, border: '8px solid #191F28', display: 'grid', gridTemplateColumns: 'repeat(21, 1fr)', gridTemplateRows: 'repeat(21, 1fr)', padding: 8 }}>
          {Array.from({length:441}).map((_,i)=>{
            const r = Math.floor(i/21), c = i%21;
            // corner squares
            const corner = (r<7&&c<7)||(r<7&&c>13)||(r>13&&c<7);
            const innerCorner = (r>=2&&r<=4&&(c>=2&&c<=4 || (c>=16&&c<=18))) || (r>=16&&r<=18&&c>=2&&c<=4);
            const outerCorner = ((r===0||r===6)&&c<7) || ((c===0||c===6)&&r<7) ||
                                ((r===0||r===6)&&c>13&&c<21) || ((c===14||c===20)&&r<7) ||
                                ((r===14||r===20)&&c<7) || ((c===0||c===6)&&r>13&&r<21);
            const filled = innerCorner || outerCorner || (!corner && ((r*13+c*7) % 3 === 0));
            return <div key={i} style={{ background: filled ? '#191F28' : 'transparent' }}/>;
          })}
        </div>
        <div style={{ marginTop: 24, padding: '10px 16px', background: 'var(--orange-50)', borderRadius: 10, font: '600 13px/1.4 var(--font-sans)', color: 'var(--orange-700)', textAlign: 'center' }}>
          사장님께 QR을 보여주세요<br/>화면 밝기가 자동 최대로 설정됩니다
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { WalletCard, QRSheet });
