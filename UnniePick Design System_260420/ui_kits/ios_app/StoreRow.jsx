// StoreRow — discovery tab list item

function StoreRow({ store, onToggleFollow }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 20px', background: '#fff', borderBottom: '1px solid var(--gray-100)',
    }}>
      <StoreAvatar name={store.name} emoji={store.emoji} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ font: '800 15px/1.2 var(--font-sans)', letterSpacing: '-0.3px', color: 'var(--fg1)' }}>{store.name}</div>
          {store.hot && <span style={{ background:'#FFEAEA',color:'#E53935',padding:'2px 6px',borderRadius:6,font:'700 10px/1 var(--font-sans)' }}>🔥 HOT</span>}
        </div>
        <div style={{ font: '400 12px/1.2 var(--font-sans)', color: 'var(--fg3)', marginTop: 3 }}>
          {store.category} · 📍 {store.distance}m · 팔로워 {store.followers.toLocaleString()}
        </div>
        {store.activeCoupons > 0 && (
          <div style={{ marginTop: 6 }}>
            <span style={{ background:'var(--orange-50)',color:'var(--orange-500)',padding:'3px 9px',borderRadius:20,font:'700 11px/1 var(--font-sans)' }}>
              🎟 쿠폰 {store.activeCoupons}개 사용 가능
            </span>
          </div>
        )}
      </div>
      <button
        className={`up-btn up-btn-small ${store.following ? 'up-btn-filled-gray' : 'up-btn-primary'}`}
        onClick={()=>onToggleFollow(store.id)}
      >
        {store.following ? '팔로잉' : '+ 팔로우'}
      </button>
    </div>
  );
}

Object.assign(window, { StoreRow });
