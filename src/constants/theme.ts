// ══════════════════════════════════════════════════════════════
//  언니픽 디자인 토큰 v2 — 고급 테마 시스템
// ══════════════════════════════════════════════════════════════

// ── 색상 팔레트 ─────────────────────────────────────────────────
export const PALETTE = {
  // Brand
  orange50:  '#FFF3EB',
  orange100: '#FFE0C8',
  orange300: '#FFB07A',
  orange500: '#FF6F0F',  // 메인 브랜드
  orange600: '#E5620D',
  orange700: '#CC560B',

  // Neutral (Toss-inspired)
  gray50:  '#F9FAFB',
  gray100: '#F2F4F6',
  gray150: '#EAECEF',
  gray200: '#E5E8EB',
  gray300: '#D1D6DB',
  gray400: '#ADB5BD',
  gray500: '#8B95A1',
  gray600: '#6B7684',
  gray700: '#4E5968',
  gray800: '#333D4B',
  gray900: '#191F28',

  // Semantic
  red400:   '#FF6B6B',
  red500:   '#E53935',
  green400: '#2DB87A',
  green500: '#0AC86E',
  blue400:  '#4C9EFF',
  blue500:  '#1A73E8',
  yellow:   '#FEE500',
  yellowDim:'#FFF8C5',
  amber:    '#D4700A',

  // Base
  white: '#FFFFFF',
  black: '#000000',
};

// ── 색상 (시멘틱 레이어) ──────────────────────────────────────
export const COLORS = {
  // 브랜드
  primary:      PALETTE.orange500,
  primaryLight: PALETTE.orange50,
  primaryDim:   'rgba(255,111,15,0.10)',

  // 배경
  background:   PALETTE.gray100,
  surface:      PALETTE.white,
  surfaceElevated: PALETTE.white,
  card:         PALETTE.white,

  // 텍스트
  text:         PALETTE.gray900,
  textSub:      PALETTE.gray700,
  textMuted:    PALETTE.gray500,
  textDisabled: PALETTE.gray400,
  textOnBrand:  PALETTE.white,

  // 경계/구분
  border:       PALETTE.gray200,
  borderLight:  PALETTE.gray150,
  divider:      'rgba(0,0,0,0.05)',

  // 시멘틱
  success:      PALETTE.green500,
  danger:       PALETTE.red500,
  warning:      PALETTE.yellow,
  info:         PALETTE.blue500,

  // 레거시 호환
  secondary:    PALETTE.orange50,
  accent:       PALETTE.yellow,
  white:        PALETTE.white,
  textPrimary:  PALETTE.gray900,
};

// ── 타이포그래피 ───────────────────────────────────────────────
// 앱 전체 단일 폰트 — WantedSans Variable (가변 폰트, 모든 weight 지원)
export const FONT_FAMILY = 'WantedSans';

export const FONTS = {
  regular: FONT_FAMILY,
  medium:  FONT_FAMILY,
  bold:    FONT_FAMILY,
};

export const TYPE = {
  // Display
  d1: { fontFamily: FONT_FAMILY, fontSize: 28, fontWeight: '900' as const, letterSpacing: -0.8, lineHeight: 36 },
  d2: { fontFamily: FONT_FAMILY, fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.6, lineHeight: 32 },

  // Heading
  h1: { fontFamily: FONT_FAMILY, fontSize: 20, fontWeight: '800' as const, letterSpacing: -0.4, lineHeight: 28 },
  h2: { fontFamily: FONT_FAMILY, fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.3, lineHeight: 24 },
  h3: { fontFamily: FONT_FAMILY, fontSize: 15, fontWeight: '700' as const, letterSpacing: -0.2, lineHeight: 22 },

  // Body
  b1: { fontFamily: FONT_FAMILY, fontSize: 15, fontWeight: '400' as const, letterSpacing: -0.1, lineHeight: 24 },
  b2: { fontFamily: FONT_FAMILY, fontSize: 14, fontWeight: '400' as const, letterSpacing: -0.1, lineHeight: 22 },
  b3: { fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: '400' as const, letterSpacing: 0,    lineHeight: 20 },

  // Label
  l1: { fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: '600' as const, letterSpacing: 0,    lineHeight: 18 },
  l2: { fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: '600' as const, letterSpacing: 0,    lineHeight: 17 },
  l3: { fontFamily: FONT_FAMILY, fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.2,  lineHeight: 16 },

  // Caption
  c1: { fontFamily: FONT_FAMILY, fontSize: 11, fontWeight: '400' as const, letterSpacing: 0,    lineHeight: 16 },
  c2: { fontFamily: FONT_FAMILY, fontSize: 10, fontWeight: '500' as const, letterSpacing: 0,    lineHeight: 15 },
};

// ── 간격 ───────────────────────────────────────────────────────
export const SPACING = {
  xxs:  2,
  xs:   4,
  sm:   8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
};

// ── 보더 반경 ──────────────────────────────────────────────────
export const RADIUS = {
  xs:   6,
  sm:   8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  '3xl': 28,
  full: 9999,
};

// ── 쉐도우 시스템 (다층 레이어) ───────────────────────────────
export const SHADOW = {
  none: {},

  xs: {
    shadowColor: PALETTE.gray900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },

  sm: {
    shadowColor: PALETTE.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },

  md: {
    shadowColor: PALETTE.gray900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  lg: {
    shadowColor: PALETTE.gray900,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 8,
  },

  xl: {
    shadowColor: PALETTE.gray900,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 16,
  },

  // 브랜드 컬러 쉐도우
  brand: {
    shadowColor: PALETTE.orange500,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.30,
    shadowRadius: 16,
    elevation: 8,
  },

  // 카드 전용 (기존 호환)
  card: {
    shadowColor: PALETTE.gray900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
};

// ── 글래스모피즘 ───────────────────────────────────────────────
export const GLASS = {
  light: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  dark: {
    backgroundColor: 'rgba(25,31,40,0.80)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  brand: {
    backgroundColor: 'rgba(255,111,15,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,111,15,0.20)',
  },
};

// ── 그라디언트 색상 쌍 (LinearGradient용) ─────────────────────
export const GRADIENTS = {
  brand:    ['#FF6F0F', '#FF9A3D'] as const,
  brandSoft:['#FFF3EB', '#FFE0C8'] as const,
  dark:     ['#191F28', '#333D4B'] as const,
  success:  ['#0AC86E', '#2DB87A'] as const,
  premium:  ['#1A1A2E', '#16213E'] as const,
  sunset:   ['#FF6F0F', '#FF3D71'] as const,
};

// ── Z-인덱스 ───────────────────────────────────────────────────
export const Z = {
  base:    0,
  card:    10,
  header:  20,
  modal:   30,
  toast:   40,
  overlay: 50,
};

// ── 애니메이션 타이밍 ──────────────────────────────────────────
export const DURATION = {
  fast:   150,
  normal: 250,
  slow:   400,
  slower: 600,
};

// 레거시 호환
export const ADMIN_PASSWORD = '1111';
export const SUPER_ADMIN_EMAIL    = 'hozon@naver.com';
export const SUPER_ADMIN_PASSWORD = '9999';
