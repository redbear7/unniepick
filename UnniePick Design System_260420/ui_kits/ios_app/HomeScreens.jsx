// HomeScreens — 사용자 홈화면 3가지 변형
// V1 Standard: 위치바 + 긴급쿠폰 스트립 + 내 주변 가로스크롤 + 팔로우 피드 + 월드컵 배너
// V2 Discovery: 대형 히어로 쿠폰(오늘의 Pick) + 에디터 추천 + 지도 미리보기 + 카테고리 그리드
// V3 Social: 스토리 릴 + 팔로우 업그레이드 피드(코멘트·대댓 강조) + 단골 스탬프 진행

// ─── 공용 블록 ────────────────────────────────────────────────

function HomeLocationBar({ loc = '상남동', onChange, showBrand = false }) {
  return (
    <div className="home-loc-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {showBrand && (
          <div style={{
            font: '900 20px/1 var(--font-sans)', color: 'var(--orange-500)',
            letterSpacing: '-0.8px', whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            언니픽
          </div>
        )}
        <div className="home-loc-left" onClick={onChange} style={showBrand ? { marginLeft: 0 } : undefined}>
          <span className="home-loc-pin">📍</span>
          <span className="home-loc-name">{loc}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M7 10l5 5 5-5" stroke="#4E5968" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </div>
      <div className="home-loc-right">
        <button className="up-icon-btn" aria-label="검색">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="#4E5968" strokeWidth="2"/><path d="M20 20l-3.5-3.5" stroke="#4E5968" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
        <button className="up-icon-btn" aria-label="알림" style={{ position: 'relative' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 3a6 6 0 00-6 6v3.5L4 15h16l-2-2.5V9a6 6 0 00-6-6zM9.5 18a2.5 2.5 0 005 0" stroke="#4E5968" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span style={{ position:'absolute', top:4, right:4, width:8,height:8,borderRadius:'50%',background:'#FF6F0F',border:'1.5px solid #fff' }}/>
        </button>
      </div>
    </div>
  );
}

function SectionHead({ title, sub, action, onAction }) {
  return (
    <div className="home-sec-head">
      <div>
        <div className="home-sec-title">{title}</div>
        {sub && <div className="home-sec-sub">{sub}</div>}
      </div>
      {action && <button className="home-sec-action" onClick={onAction}>{action} ›</button>}
    </div>
  );
}

// 긴급 쿠폰 카드 (가로 스크롤용) — 핵심: 잔여·D-0
function UrgentCouponCard({ c, onSave }) {
  const urgent = c.daysLeft === 0;
  return (
    <div className={`home-urgent-card ${urgent ? 'now' : ''}`}>
      <div className="home-urgent-top">
        {urgent ? <span className="home-urgent-badge">🔥 오늘만</span> : <span className="home-urgent-badge soft">D-{c.daysLeft}</span>}
        <span className="home-urgent-remain">잔여 {c.remain}장</span>
      </div>
      <div className="home-urgent-title">{c.title}</div>
      <div className="home-urgent-store">
        <StoreAvatar name={c.store} emoji={c.emoji} size="sm"/>
        <div>
          <div className="home-urgent-store-name">{c.store}</div>
          <div className="home-urgent-dist">🚶 {c.distance}m</div>
        </div>
      </div>
      <button className="home-urgent-btn" onClick={() => onSave && onSave(c.id)}>쿠폰받기</button>
    </div>
  );
}

// 내 주변 가게 카드 (가로 스크롤)
function NearbyStoreCard({ s, onFollow }) {
  return (
    <div className="home-nearby-card">
      <div className="home-nearby-img" style={{ background: `linear-gradient(135deg, ${storeColor(s.name)}, ${storeColor(s.name)}cc)` }}>
        <span style={{ fontSize: 44 }}>{s.emoji}</span>
        {s.hot && <span className="home-nearby-hot">🔥 HOT</span>}
      </div>
      <div className="home-nearby-body">
        <div className="home-nearby-name">{s.name}</div>
        <div className="home-nearby-meta">{s.category.replace(/^\S+\s/,'')} · {s.distance}m</div>
        <div className="home-nearby-coupons">🎟 쿠폰 {s.activeCoupons}장</div>
      </div>
    </div>
  );
}

// 월드컵 / 기능 배너
function HomeFeatureBanner({ title, sub, emoji, bg, onClick }) {
  return (
    <div className="home-feat-banner" style={{ background: bg }} onClick={onClick}>
      <div>
        <div className="home-feat-title">{title}</div>
        <div className="home-feat-sub">{sub}</div>
      </div>
      <div className="home-feat-emoji">{emoji}</div>
    </div>
  );
}

// 스토리 릴 아이템 (V3)
function StoryItem({ s, isMe }) {
  return (
    <div className="home-story-item">
      <div className={`home-story-ring ${s.hasNew ? 'new' : ''} ${isMe ? 'me' : ''}`}>
        <div className="home-story-inner" style={{ background: storeColor(s.name || '나') }}>
          {isMe ? '+' : s.emoji}
        </div>
      </div>
      <div className="home-story-name">{isMe ? '내 스토리' : s.name}</div>
    </div>
  );
}

// 대형 히어로 쿠폰 (V2)
function HeroCoupon({ c, onSave }) {
  return (
    <div className="home-hero-coupon">
      <div className="home-hero-ribbon">⚡ 오늘의 Pick</div>
      <div className="home-hero-title">{c.title}</div>
      <div className="home-hero-store">
        <StoreAvatar name={c.store} emoji={c.emoji} size="sm"/>
        <div>
          <div className="home-hero-store-name">{c.store}</div>
          <div className="home-hero-dist">{c.category} · 🚶 {c.distance}m</div>
        </div>
      </div>
      <div className="home-hero-stats">
        <div className="home-hero-stat"><b>🔥 {c.remain}</b><span>잔여</span></div>
        <div className="home-hero-stat-div"/>
        <div className="home-hero-stat"><b>D-{c.daysLeft}</b><span>마감</span></div>
        <div className="home-hero-stat-div"/>
        <div className="home-hero-stat"><b>{c.saved}+</b><span>받음</span></div>
      </div>
      <button className="home-hero-btn" onClick={() => onSave && onSave(c.id)}>지금 쿠폰받기 →</button>
    </div>
  );
}

// 카테고리 그리드 (V2)
function CategoryGrid({ onPick }) {
  const cats = [
    { k: 'cafe', label: '카페', emoji: '☕', bg: '#FFF3EB' },
    { k: 'food', label: '음식', emoji: '🍜', bg: '#FFEDD6' },
    { k: 'beauty', label: '미용', emoji: '💇', bg: '#FDE4F1' },
    { k: 'nail', label: '네일', emoji: '💅', bg: '#EBE5FC' },
    { k: 'cvs', label: '편의점', emoji: '🏪', bg: '#E3F3FF' },
    { k: 'dessert', label: '디저트', emoji: '🍰', bg: '#FFF7E0' },
    { k: 'bar', label: '술집', emoji: '🍻', bg: '#E4F6E9' },
    { k: 'etc', label: '전체', emoji: '⋯', bg: 'var(--gray-100)' },
  ];
  return (
    <div className="home-cat-grid">
      {cats.map(c => (
        <button key={c.k} className="home-cat-item" onClick={() => onPick && onPick(c.k)}>
          <div className="home-cat-icon" style={{ background: c.bg }}>{c.emoji}</div>
          <div className="home-cat-label">{c.label}</div>
        </button>
      ))}
    </div>
  );
}

// 지도 미리보기 (V2)
function MapPreview({ onOpen }) {
  return (
    <div className="home-map-preview" onClick={onOpen}>
      <div className="home-map-bg">
        <svg width="100%" height="100%" viewBox="0 0 320 140" preserveAspectRatio="none">
          <rect width="320" height="140" fill="#E8F1F7"/>
          <path d="M0 80 Q60 60 120 85 T240 70 T320 95" stroke="#D1E2EC" strokeWidth="10" fill="none"/>
          <path d="M40 0 L60 140" stroke="#D1E2EC" strokeWidth="6"/>
          <path d="M200 0 Q210 80 250 140" stroke="#D1E2EC" strokeWidth="6" fill="none"/>
          <rect x="20" y="20" width="50" height="40" rx="4" fill="#F2E8DC"/>
          <rect x="130" y="15" width="60" height="35" rx="4" fill="#F2E8DC"/>
          <rect x="240" y="100" width="60" height="30" rx="4" fill="#F2E8DC"/>
        </svg>
        <div className="home-map-pin" style={{ left: '40%', top: '45%' }}>
          <div className="home-map-pin-dot"/>
          <div className="home-map-pin-pulse"/>
        </div>
        <div className="home-map-marker" style={{ left: '22%', top: '30%' }}>☕</div>
        <div className="home-map-marker" style={{ left: '62%', top: '55%' }}>🍜</div>
        <div className="home-map-marker" style={{ left: '78%', top: '28%' }}>💅</div>
        <div className="home-map-marker" style={{ left: '30%', top: '68%' }}>🥐</div>
      </div>
      <div className="home-map-cta">
        <div>
          <div className="home-map-title">지도로 탐색하기</div>
          <div className="home-map-sub">500m 내 쿠폰 가게 12곳</div>
        </div>
        <div className="home-map-arrow">›</div>
      </div>
    </div>
  );
}

// 단골 스탬프 진행 (V3)
function StampProgress({ s }) {
  return (
    <div className="home-stamp-card">
      <div className="home-stamp-head">
        <StoreAvatar name={s.store} emoji={s.emoji} size="sm"/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="home-stamp-store">{s.store}</div>
          <div className="home-stamp-goal">{s.goal}</div>
        </div>
        <div className="home-stamp-count">{s.current}/{s.total}</div>
      </div>
      <div className="home-stamp-dots">
        {Array.from({ length: s.total }).map((_, i) => (
          <div key={i} className={`home-stamp-dot ${i < s.current ? 'on' : ''} ${i === s.current ? 'next' : ''}`}>
            {i < s.current ? '✓' : i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}

// 에디터 pick 카드 (V2) — 큰 썸 + 에디터 코멘트
function EditorPick({ p }) {
  return (
    <div className="home-editor-card">
      <div className="home-editor-img" style={{ background: `linear-gradient(135deg, ${storeColor(p.store)}, ${storeColor(p.store)}aa)` }}>
        <span style={{ fontSize: 64 }}>{p.emoji}</span>
        <span className="home-editor-tag">에디터 Pick</span>
      </div>
      <div className="home-editor-body">
        <div className="home-editor-store">{p.store} <span className="home-editor-dist">· {p.distance}m</span></div>
        <div className="home-editor-quote">"{p.quote}"</div>
        <div className="home-editor-author">— {p.author}</div>
      </div>
    </div>
  );
}

// ─── 데이터 ───────────────────────────────────────────────────
const URGENT_COUPONS = [
  { id: 'u1', store: '카페봄날', emoji: '☕', title: '아메리카노 1+1', daysLeft: 0, remain: 12, distance: 120 },
  { id: 'u2', store: '분식집', emoji: '🍜', title: '라면+김밥 1,000원↓', daysLeft: 0, remain: 8, distance: 180 },
  { id: 'u3', store: '미용실언니', emoji: '✂️', title: '컷+염색 20% 할인', daysLeft: 3, remain: 4, distance: 340 },
  { id: 'u4', store: '네일룸', emoji: '💅', title: '젤네일 30% 할인', daysLeft: 7, remain: 25, distance: 520 },
];

const STAMP_CARDS = [
  { store: '카페봄날', emoji: '☕', goal: '10잔 방문 시 무료 아메리카노', current: 7, total: 10 },
  { store: '분식집', emoji: '🍜', goal: '5회 주문 시 세트 무료', current: 3, total: 5 },
];

const EDITOR_PICKS = [
  { store: '카페봄날', emoji: '☕', distance: 120, quote: '창동에서 가장 편한 작업 카페, 콘센트도 많아요', author: '언니픽 에디터 지영' },
  { store: '빵집굽는언니', emoji: '🥐', distance: 430, quote: '오전 10시 갓 나온 크루아상은 꼭 드셔보세요', author: '언니픽 에디터 수진' },
];

const STORIES = [
  { name: '카페봄날', emoji: '☕', hasNew: true },
  { name: '분식집', emoji: '🍜', hasNew: true },
  { name: '미용실언니', emoji: '✂️', hasNew: true },
  { name: '빵집굽는언니', emoji: '🥐', hasNew: false },
  { name: '네일룸', emoji: '💅', hasNew: true },
  { name: '치킨공장', emoji: '🍗', hasNew: false },
];

// ─── V1 표준형: 위치 → 긴급 쿠폰 스트립 → 내 주변 → 팔로우 피드 → 월드컵 ───
function HomeV1Standard({ posts, onSaveCoupon, onFollow }) {
  return (
    <div className="home-scroll">
      <HomeLocationBar showBrand />

      {/* 긴급 쿠폰 스트립 */}
      <SectionHead title="⚡ 지금 받아야 할 쿠폰" sub="곧 마감 · 내 주변 500m" action="전체"/>
      <div className="home-hscroll">
        {URGENT_COUPONS.map(c => <UrgentCouponCard key={c.id} c={c} onSave={()=>{}}/>)}
      </div>

      {/* 내 주변 */}
      <SectionHead title="📍 내 주변 가게" sub="상남동 반경 500m · 8곳" action="지도"/>
      <div className="home-hscroll">
        {SAMPLE_STORES.slice(0, 6).map(s => <NearbyStoreCard key={s.id} s={s}/>)}
      </div>

      {/* 팔로우 피드 */}
      <SectionHead title="👥 팔로우한 가게 소식"/>
      <div>
        {posts.slice(0, 3).map(p => <FeedPost key={p.id} post={p} onSaveCoupon={onSaveCoupon} onFollow={onFollow}/>)}
      </div>
    </div>
  );
}

// ─── V2 발견형: 히어로 쿠폰 + 카테고리 + 에디터 pick + 지도 ───
function HomeV2Discovery({ onSaveCoupon }) {
  const hero = { id: 'h1', store: '카페봄날', emoji: '☕', category: '카페', title: '아메리카노 1+1', distance: 120, daysLeft: 0, remain: 12, saved: 84 };
  return (
    <div className="home-scroll v2">
      <HomeLocationBar />

      {/* 오늘의 Pick */}
      <div style={{ padding: '12px 20px 4px' }}>
        <HeroCoupon c={hero} onSave={onSaveCoupon}/>
      </div>

      {/* 카테고리 그리드 */}
      <SectionHead title="뭘 찾으세요?"/>
      <div style={{ padding: '0 12px 8px' }}>
        <CategoryGrid />
      </div>

      {/* 에디터 Pick */}
      <SectionHead title="✨ 이번 주 에디터 Pick" sub="창원 현지 에디터가 직접 다녀왔어요" action="더보기"/>
      <div className="home-hscroll">
        {EDITOR_PICKS.map((p,i) => <EditorPick key={i} p={p}/>)}
      </div>

      {/* 지도 */}
      <div style={{ padding: '8px 20px 0' }}>
        <MapPreview />
      </div>

      {/* 월드컵 배너 */}
      <div style={{ padding: '16px 20px 24px' }}>
        <HomeFeatureBanner
          title="맛집 월드컵"
          sub="상황별 16강 → 우승 가게 추천"
          emoji="🏆"
          bg="linear-gradient(135deg, #191F28, #333D4B)"
        />
      </div>
    </div>
  );
}

// ─── V3 소셜형: 스토리 릴 + 피드(좋아요·댓글 강조) + 단골 스탬프 ───
function HomeV3Social({ posts, onSaveCoupon, onFollow }) {
  return (
    <div className="home-scroll">
      <HomeLocationBar />

      {/* 스토리 릴 */}
      <div className="home-story-rail">
        <StoryItem s={{ name: '나' }} isMe/>
        {STORIES.map((s,i) => <StoryItem key={i} s={s}/>)}
      </div>

      {/* 단골 스탬프 진행 */}
      <SectionHead title="🎯 단골 스탬프 진행 중" sub="앞으로 조금만 더!" action="전체"/>
      <div style={{ padding: '0 20px 4px' }}>
        {STAMP_CARDS.map((s,i) => <StampProgress key={i} s={s}/>)}
      </div>

      {/* 팔로우 피드 — 전체 피드 확장 */}
      <SectionHead title="👥 팔로우한 가게 소식"/>
      <div>
        {posts.map(p => <FeedPost key={p.id} post={p} onSaveCoupon={onSaveCoupon} onFollow={onFollow}/>)}
      </div>
    </div>
  );
}

Object.assign(window, {
  HomeV1Standard, HomeV2Discovery, HomeV3Social,
  HomeLocationBar, SectionHead, UrgentCouponCard, NearbyStoreCard,
  HomeFeatureBanner, StoryItem, HeroCoupon, CategoryGrid, MapPreview,
  StampProgress, EditorPick,
});
