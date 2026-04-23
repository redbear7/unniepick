// UnniePick — primitive components (buttons, avatar, tabs, coupon card, etc)

const STORE_COLORS = ['#FF6F0F','#FF9A3D','#5B67CA','#2DB87A','#D946B0','#FF6B6B','#4C9EFF','#F59E0B'];
const storeColor = (name) => STORE_COLORS[(name || '가').charCodeAt(0) % STORE_COLORS.length];

function StoreAvatar({ name, size = 'md', emoji }) {
  return (
    <div className={`up-avatar ${size}`} style={{ background: storeColor(name) }}>
      {emoji || (name ? name[0] : '가')}
    </div>
  );
}

function CouponInline({ title, badge = 'NEW', meta = '📅 D-0 · 🔥 잔여 12장', saved, onSave }) {
  return (
    <div className="up-coupon">
      <div className="up-coupon-top">
        <div className="up-coupon-title">{title}</div>
        <div className="up-coupon-badge" style={{ background: badge === '오늘만' ? '#E53935' : undefined }}>{badge}</div>
      </div>
      <div className="up-coupon-foot">
        <div className="up-coupon-meta">{meta}</div>
        <button className={`up-btn up-btn-small ${saved ? 'up-btn-filled-gray' : 'up-btn-primary'}`} onClick={onSave}>
          {saved ? '✓ 저장됨' : '쿠폰받기'}
        </button>
      </div>
    </div>
  );
}

function Header({ title = '언니픽', location, onNotif, onSearch, onLocation, dark }) {
  return (
    <div className="up-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="up-header-brand">{title}</div>
        {location && (
          <button
            onClick={onLocation}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'var(--gray-100)', border: 'none',
              padding: '6px 10px', borderRadius: 10, cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 13 }}>📍</span>
            <span style={{ font: '700 13px/1 var(--font-sans)', color: 'var(--fg1)', letterSpacing: '-0.2px' }}>{location}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M7 10l5 5 5-5" stroke="#4E5968" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
      </div>
      <div className="up-header-actions">
        <button className="up-icon-btn" onClick={onSearch} aria-label="검색">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="#4E5968" strokeWidth="2"/><path d="M20 20l-3.5-3.5" stroke="#4E5968" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
        <button className="up-icon-btn" onClick={onNotif} aria-label="알림" style={{ position: 'relative' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 3a6 6 0 00-6 6v3.5L4 15h16l-2-2.5V9a6 6 0 00-6-6zM9.5 18a2.5 2.5 0 005 0" stroke="#4E5968" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span style={{ position:'absolute', top:4, right:4, width:8,height:8,borderRadius:'50%',background:'#FF6F0F',border:'1.5px solid #fff' }}/>
        </button>
      </div>
    </div>
  );
}

function TabBar({ active, onChange }) {
  const tabs = [
    { key: 'home', label: '홈', icon: '🏠' },
    { key: 'wallet', label: '내 쿠폰함', icon: '🎟' },
    { key: 'explore', label: '가게 탐색', icon: '🔍' },
    { key: 'profile', label: 'MY', icon: '👤' },
  ];
  return (
    <div className="up-tabbar">
      {tabs.map(t => (
        <button key={t.key} className={`up-tab ${active===t.key?'active':''}`} onClick={()=>onChange(t.key)}>
          <span className="up-tab-icon">{t.icon}</span>
          <span className="up-tab-label">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

function ChipRow({ items, active, onChange }) {
  return (
    <div className="up-chip-row">
      {items.map(i => (
        <button key={i} className={`up-chip ${active===i?'on':''}`} onClick={()=>onChange(i)}>{i}</button>
      ))}
    </div>
  );
}

function Segment({ items, active, onChange }) {
  return (
    <div className="up-segment">
      {items.map(i => (
        <button key={i.key} className={`up-seg ${active===i.key?'on':''}`} onClick={()=>onChange(i.key)}>
          {i.label}{i.count!==undefined && ` (${i.count})`}
        </button>
      ))}
    </div>
  );
}

Object.assign(window, { StoreAvatar, CouponInline, Header, TabBar, ChipRow, Segment, storeColor });
