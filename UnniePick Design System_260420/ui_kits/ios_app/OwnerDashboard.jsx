// OwnerDashboard — 사장님 홈 화면

function OwnerDashboard({ onIssueCoupon }) {
  return (
    <div style={{ background: 'var(--gray-50)', minHeight: '100%' }}>
      {/* Stats header */}
      <div style={{
        background: 'linear-gradient(135deg,#FF6F0F,#FF9A3D)',
        padding: '50px 20px 20px', color: '#fff',
      }}>
        <div style={{ font: '500 12px/1 var(--font-sans)', opacity: 0.9, marginBottom: 4 }}>오늘의 현황</div>
        <div style={{ font: '900 28px/1 var(--font-sans)', letterSpacing: '-0.5px', marginBottom: 20 }}>카페봄날</div>
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { n: '1,230', l: '팔로워', d: '+12' },
            { n: '3', l: '발행 쿠폰', d: '활성' },
            { n: '47', l: '오늘 사용', d: '+8' },
          ].map((s,i)=>(
            <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
              <div style={{ font: '900 22px/1 var(--font-sans)', letterSpacing: '-0.5px' }}>{s.n}</div>
              <div style={{ font: '500 11px/1 var(--font-sans)', opacity: 0.9, marginTop: 6 }}>{s.l}</div>
              <div style={{ font: '700 10px/1 var(--font-sans)', marginTop: 4, opacity: 0.85 }}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Big CTA */}
      <div style={{ padding: '20px 20px 12px' }}>
        <button
          onClick={onIssueCoupon}
          style={{
            width: '100%', padding: 18, borderRadius: 18,
            background: 'var(--orange-500)', color: '#fff', border: 'none',
            font: '900 17px/1 var(--font-sans)', letterSpacing: '-0.3px',
            boxShadow: 'var(--shadow-brand)',
          }}
        >
          ⚡ 쿠폰 발행하기
        </button>
      </div>

      {/* Active coupons */}
      <div className="up-section-head">📋 발행 중인 쿠폰</div>
      {[
        { title: '아메리카노 1+1', days: 'D-0', saves: 128, uses: 47, rate: 37 },
        { title: '케이크 20% 할인', days: 'D-5', saves: 42, uses: 8, rate: 19 },
        { title: '커피 2잔 무료', days: 'D-14', saves: 15, uses: 0, rate: 0 },
      ].map((c,i)=>(
        <div key={i} style={{
          background: '#fff', margin: '0 16px 10px', borderRadius: 14, padding: 14,
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 10 }}>
            <div style={{ font: '800 15px/1.2 var(--font-sans)', letterSpacing: '-0.3px' }}>{c.title}</div>
            <span style={{ background: c.days === 'D-0' ? '#FFEAEA' : 'var(--gray-100)', color: c.days === 'D-0' ? '#E53935' : 'var(--gray-700)', padding: '3px 8px', borderRadius: 6, font: '700 11px/1 var(--font-sans)' }}>{c.days}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            <div><div style={{ font:'400 11px/1 var(--font-sans)',color:'var(--fg3)' }}>저장</div><div style={{ font:'800 16px/1 var(--font-sans)',marginTop:3 }}>{c.saves}명</div></div>
            <div><div style={{ font:'400 11px/1 var(--font-sans)',color:'var(--fg3)' }}>사용</div><div style={{ font:'800 16px/1 var(--font-sans)',marginTop:3,color:'var(--orange-500)' }}>{c.uses}명</div></div>
            <div><div style={{ font:'400 11px/1 var(--font-sans)',color:'var(--fg3)' }}>사용률</div><div style={{ font:'800 16px/1 var(--font-sans)',marginTop:3 }}>{c.rate}%</div></div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="up-btn up-btn-small up-btn-filled-gray" style={{ flex: 1 }}>수정</button>
            <button className="up-btn up-btn-small up-btn-filled-gray" style={{ flex: 1 }}>🔔 재알림</button>
          </div>
        </div>
      ))}
      <div style={{ height: 20 }}/>
    </div>
  );
}

Object.assign(window, { OwnerDashboard });
