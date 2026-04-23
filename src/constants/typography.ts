/**
 * 언니픽 타이포그래피 시스템
 *
 * RN은 iOS에서 커스텀 폰트를 반드시 fontFamily로 지정해야 웨이트가 렌더링됨.
 * fontWeight 단독 사용 금지 — 반드시 fontFamily + fontSize + lineHeight 세트.
 *
 * WantedSans 웨이트 매핑:
 *   400 → 'WantedSans-Regular'
 *   500 → 'WantedSans-Medium'
 *   600 → 'WantedSans-SemiBold'
 *   700 → 'WantedSans-Bold'
 *   800 → 'WantedSans-ExtraBold'
 *   900 → 'WantedSans-Black'
 */

// ── 폰트 패밀리 이름 상수 ─────────────────────────────────────────
export const F = {
  regular:   'WantedSans-Regular',
  medium:    'WantedSans-Medium',
  semiBold:  'WantedSans-SemiBold',
  bold:      'WantedSans-Bold',
  extraBold: 'WantedSans-ExtraBold',
  black:     'WantedSans-Black',
} as const;

// ── 타입 스케일 (AuthFlow.jsx 기준 추출) ─────────────────────────
// 이름을 'T'로 사용: 'type'은 TypeScript/Babel에서 type-only import 문법과 충돌
export const T = {
  // Splash
  splash:     { fontFamily: F.black,     fontSize: 72, lineHeight: 72, letterSpacing: -2.9 },
  splashTag:  { fontFamily: F.semiBold,  fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  splashVer:  { fontFamily: F.medium,    fontSize: 13, lineHeight: 18, letterSpacing: 0.5  },

  // Auth headings
  title28:    { fontFamily: F.black,     fontSize: 28, lineHeight: 37, letterSpacing: -0.8 },
  title26:    { fontFamily: F.black,     fontSize: 26, lineHeight: 34, letterSpacing: -0.8 },
  title24:    { fontFamily: F.black,     fontSize: 24, lineHeight: 31, letterSpacing: -0.8 },

  // Body / sub
  body15:     { fontFamily: F.medium,    fontSize: 16, lineHeight: 26, letterSpacing: -0.2 },
  body14:     { fontFamily: F.medium,    fontSize: 15, lineHeight: 23 },
  body13:     { fontFamily: F.medium,    fontSize: 14, lineHeight: 22 },

  // Input / label
  input28:    { fontFamily: F.extraBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  input16:    { fontFamily: F.bold,      fontSize: 17, lineHeight: 23 },
  label14:    { fontFamily: F.extraBold, fontSize: 15, lineHeight: 19 },
  label13:    { fontFamily: F.extraBold, fontSize: 14, lineHeight: 19 },
  label12:    { fontFamily: F.semiBold,  fontSize: 13, lineHeight: 18 },

  // OTP digit
  otp26:      { fontFamily: F.black,     fontSize: 26, lineHeight: 26 },

  // Button
  btn16:      { fontFamily: F.black,     fontSize: 17, lineHeight: 23, letterSpacing: -0.3 },
  btn14:      { fontFamily: F.bold,      fontSize: 15, lineHeight: 21 },
  btnSmall:   { fontFamily: F.bold,      fontSize: 14, lineHeight: 19 },

  // Store card
  storeName:  { fontFamily: F.extraBold, fontSize: 16, lineHeight: 20 },
  storeMeta:  { fontFamily: F.medium,    fontSize: 13, lineHeight: 18 },

  // Count
  countSmall: { fontFamily: F.extraBold, fontSize: 14, lineHeight: 14 },

  // Caption
  caption12:  { fontFamily: F.medium,    fontSize: 13, lineHeight: 18 },
  caption11:  { fontFamily: F.medium,    fontSize: 12, lineHeight: 17 },

  // Terms sheet
  terms20:    { fontFamily: F.black,     fontSize: 20, lineHeight: 26, letterSpacing: -0.5 },
  terms15:    { fontFamily: F.extraBold, fontSize: 16, lineHeight: 21 },
  terms14:    { fontFamily: F.medium,    fontSize: 15, lineHeight: 20, letterSpacing: -0.1 },
} as const;
