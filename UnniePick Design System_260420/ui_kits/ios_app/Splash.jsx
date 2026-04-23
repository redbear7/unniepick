// Splash — V1 런칭용 스플래시 스크린
// 6개 variant — 모두 화이트 배경 + 오렌지 워드마크 + 페이드인/스케일 모션
// 지속시간 1800ms (표준), 태그라인: "창원의 모든 언니픽", 하단 v1.0.0

const SPLASH_DURATION = 1800;
const SPLASH_TAGLINE = '창원의 모든 핫플레이스';
const SPLASH_VERSION = 'v1.0.0';
const ORANGE = '#FF6F0F';

// ─── 모션 훅: enter → hold → exit ─────────────────────────────
// onDone이 없으면 hold에서 정지 (툴바 미리보기 모드)
function useSplashPhase(duration = SPLASH_DURATION, onDone) {
  const [phase, setPhase] = React.useState('enter');
  React.useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 450);
    if (!onDone) return () => clearTimeout(t1);
    const t2 = setTimeout(() => setPhase('exit'), duration - 300);
    const t3 = setTimeout(() => { onDone(); }, duration);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [duration, onDone]);
  return phase;
}

// 공통 화이트 베이스 컨테이너
function SplashShell({ phase, children, version = true, bg = '#FFFFFF' }) {
  const opacity = phase === 'exit' ? 0 : 1;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 200,
      background: bg,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      opacity, transition: 'opacity 300ms ease',
      overflow: 'hidden',
    }}>
      {children}
      {version && (
        <div style={{
          position: 'absolute', bottom: 36, left: 0, right: 0, textAlign: 'center',
          font: '500 11px/1 var(--font-sans)',
          color: 'rgba(25,31,40,0.28)',
          letterSpacing: '0.5px',
          opacity: phase === 'hold' ? 1 : 0,
          transition: 'opacity 400ms ease 500ms',
        }}>
          {SPLASH_VERSION}
        </div>
      )}
    </div>
  );
}

// 공통 워드마크 — 페이드인 + 스케일
function Wordmark({ phase, size = 56, delay = 0, color = ORANGE, letterSpacing = -2.4 }) {
  const opacity = phase === 'enter' ? 0 : 1;
  const scale = phase === 'enter' ? 0.92 : 1;
  return (
    <div style={{
      font: `900 ${size}px/1 var(--font-sans)`,
      color,
      letterSpacing: `${letterSpacing}px`,
      opacity,
      transform: `scale(${scale})`,
      transition: `all 600ms cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
    }}>
      언니픽
    </div>
  );
}

// 공통 태그라인
function Tagline({ phase, delay = 250, color = 'rgba(25,31,40,0.55)', size = 13 }) {
  const opacity = phase === 'enter' ? 0 : 1;
  const y = phase === 'enter' ? 6 : 0;
  return (
    <div style={{
      font: `600 ${size}px/1.4 var(--font-sans)`,
      color,
      letterSpacing: '-0.1px',
      opacity,
      transform: `translateY(${y}px)`,
      transition: `all 600ms cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
    }}>
      {SPLASH_TAGLINE}
    </div>
  );
}

// ─── V1. Centered — 중앙 워드마크 + 아래 태그라인 ─────────────
function SplashCentered({ onDone }) {
  const phase = useSplashPhase(SPLASH_DURATION, onDone);
  return (
    <SplashShell phase={phase}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <Wordmark phase={phase} size={60} />
        <Tagline phase={phase} delay={300} />
      </div>
    </SplashShell>
  );
}

// ─── V2. Top-aligned — 상단 1/3, 태그라인 중앙 ────────────────
function SplashTop({ onDone }) {
  const phase = useSplashPhase(SPLASH_DURATION, onDone);
  return (
    <SplashShell phase={phase}>
      <div style={{ height: '34%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 20 }}>
        <Wordmark phase={phase} size={52} />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Tagline phase={phase} delay={320} />
      </div>
    </SplashShell>
  );
}

// ─── V3. Bottom-anchored — 워드마크 하단 고정 (iOS 부팅 느낌) ─
function SplashBottom({ onDone }) {
  const phase = useSplashPhase(SPLASH_DURATION, onDone);
  return (
    <SplashShell phase={phase}>
      <div style={{ flex: 1 }}/>
      <div style={{ paddingBottom: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <Wordmark phase={phase} size={44} />
        <Tagline phase={phase} delay={320} size={12} />
      </div>
    </SplashShell>
  );
}

// ─── V4. Symbol + Wordmark — 말풍선 심볼 + 워드마크 ───────────
function SplashSymbol({ onDone }) {
  const phase = useSplashPhase(SPLASH_DURATION, onDone);
  const opacity = phase === 'enter' ? 0 : 1;
  const scale = phase === 'enter' ? 0.8 : 1;
  return (
    <SplashShell phase={phase}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
        {/* 오렌지 말풍선 심볼 */}
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: ORANGE,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity, transform: `scale(${scale})`,
          transition: 'all 550ms cubic-bezier(0.34,1.56,0.64,1)',
          boxShadow: '0 10px 24px rgba(255,111,15,0.30)',
          position: 'relative',
        }}>
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
            <path d="M7 11c0-2.2 1.8-4 4-4h8c2.2 0 4 1.8 4 4v5c0 2.2-1.8 4-4 4h-5l-4 3v-3H11c-2.2 0-4-1.8-4-4v-5z" fill="#fff"/>
          </svg>
          {/* tail */}
          <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: 12, height: 12, background: ORANGE, borderRadius: 2 }}/>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <Wordmark phase={phase} size={48} delay={150} />
          <Tagline phase={phase} delay={350} />
        </div>
      </div>
    </SplashShell>
  );
}

// ─── V5. Character — 🐻 + 워드마크 (화이트 배경으로) ──────────
function SplashCharacter({ onDone }) {
  const phase = useSplashPhase(SPLASH_DURATION, onDone);
  const charScale = phase === 'enter' ? 0.7 : 1;
  const charRot = phase === 'enter' ? -8 : 0;
  return (
    <SplashShell phase={phase}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        {/* 🐻 캐릭터 */}
        <div style={{
          width: 112, height: 112, borderRadius: '50%',
          background: 'linear-gradient(160deg,#FFF3EB,#FFE0C8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 72, lineHeight: 1,
          boxShadow: '0 12px 32px rgba(255,111,15,0.18), inset 0 -4px 12px rgba(255,111,15,0.08)',
          transform: `scale(${charScale}) rotate(${charRot}deg)`,
          transition: 'transform 650ms cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          🐻
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <Wordmark phase={phase} size={44} delay={200} />
          <Tagline phase={phase} delay={400} />
        </div>
      </div>
    </SplashShell>
  );
}

// ─── V6. Hero — 극대형 워드마크 단독 (미니멀 극단) ────────────
function SplashHero({ onDone }) {
  const phase = useSplashPhase(SPLASH_DURATION, onDone);
  return (
    <SplashShell phase={phase}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        <Wordmark phase={phase} size={88} letterSpacing={-4} />
      </div>
    </SplashShell>
  );
}

// ─── Default export: 기본 = Centered ──────────────────────────
function Splash(props) {
  const variant = props.variant || 'centered';
  const Cmp = {
    centered: SplashCentered,
    top: SplashTop,
    bottom: SplashBottom,
    symbol: SplashSymbol,
    character: SplashCharacter,
    hero: SplashHero,
  }[variant] || SplashCentered;
  return <Cmp {...props} />;
}

const SPLASH_VARIANTS = [
  { key: 'centered', label: 'V1 중앙', caption: '워드마크 중앙 + 하단 태그라인 · 가장 표준적인 레이아웃' },
  { key: 'top', label: 'V2 상단', caption: '상단 1/3 워드마크 + 중앙 태그라인 · 에디토리얼 느낌' },
  { key: 'bottom', label: 'V3 하단', caption: '하단 고정 워드마크 · iOS 시스템 부팅 화면 같은 여백감' },
  { key: 'symbol', label: 'V4 심볼', caption: '오렌지 말풍선 심볼 + 워드마크 · 브랜드 아이덴티티 강화' },
  { key: 'character', label: 'V5 캐릭터', caption: 'Picki(🐻) + 워드마크 · 친근한 마스코트 중심' },
  { key: 'hero', label: 'V6 히어로', caption: '극대형 워드마크 단독 · 미니멀 극단, 글자 자체가 주인공' },
];

Object.assign(window, { Splash, SPLASH_VARIANTS });
