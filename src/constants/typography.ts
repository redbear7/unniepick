/**
 * 언니픽 타이포그래피 시스템
 *
 * WantedSans Variable 폰트 사용 (단일 파일로 전 웨이트 커버)
 * fontFamily + fontWeight 조합으로 렌더링 — F.xxx는 스타일 객체로 spread해서 사용.
 *
 * 사용법:
 *   { ...F.black, fontSize: 20 }          ✅
 *   { fontFamily: F.black, fontSize: 20 }  ❌ (F.xxx는 문자열이 아님)
 *
 * WantedSans 웨이트 매핑:
 *   400 → F.regular
 *   500 → F.medium
 *   600 → F.semiBold
 *   700 → F.bold
 *   800 → F.extraBold
 *   900 → F.black
 */

// Variable 폰트 패밀리명 (app.json expo-font 플러그인에 등록된 이름)
const VF = 'Wanted Sans Variable';

// ── 폰트 웨이트별 스타일 객체 (fontFamily + fontWeight 세트) ────────
export const F = {
  regular:   { fontFamily: VF, fontWeight: '400' as const },
  medium:    { fontFamily: VF, fontWeight: '500' as const },
  semiBold:  { fontFamily: VF, fontWeight: '600' as const },
  bold:      { fontFamily: VF, fontWeight: '700' as const },
  extraBold: { fontFamily: VF, fontWeight: '800' as const },
  black:     { fontFamily: VF, fontWeight: '900' as const },
} as const;

// ── 타입 스케일 ───────────────────────────────────────────────────
export const T = {
  // Splash
  splash:     { ...F.black,     fontSize: 72, lineHeight: 72, letterSpacing: -2.9 },
  splashTag:  { ...F.semiBold,  fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  splashVer:  { ...F.medium,    fontSize: 13, lineHeight: 18, letterSpacing: 0.5  },

  // Auth headings
  title28:    { ...F.black,     fontSize: 28, lineHeight: 37, letterSpacing: -0.8 },
  title26:    { ...F.black,     fontSize: 26, lineHeight: 34, letterSpacing: -0.8 },
  title24:    { ...F.black,     fontSize: 24, lineHeight: 31, letterSpacing: -0.8 },

  // Body / sub
  body15:     { ...F.medium,    fontSize: 16, lineHeight: 26, letterSpacing: -0.2 },
  body14:     { ...F.medium,    fontSize: 15, lineHeight: 23 },
  body13:     { ...F.medium,    fontSize: 14, lineHeight: 22 },

  // Input / label
  input28:    { ...F.extraBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  input16:    { ...F.bold,      fontSize: 17, lineHeight: 23 },
  label14:    { ...F.extraBold, fontSize: 15, lineHeight: 19 },
  label13:    { ...F.extraBold, fontSize: 14, lineHeight: 19 },
  label12:    { ...F.semiBold,  fontSize: 13, lineHeight: 18 },

  // OTP digit
  otp26:      { ...F.black,     fontSize: 26, lineHeight: 26 },

  // Button
  btn16:      { ...F.black,     fontSize: 17, lineHeight: 23, letterSpacing: -0.3 },
  btn14:      { ...F.bold,      fontSize: 15, lineHeight: 21 },
  btnSmall:   { ...F.bold,      fontSize: 14, lineHeight: 19 },

  // Store card
  storeName:  { ...F.extraBold, fontSize: 16, lineHeight: 20 },
  storeMeta:  { ...F.medium,    fontSize: 13, lineHeight: 18 },

  // Count
  countSmall: { ...F.extraBold, fontSize: 14, lineHeight: 14 },

  // Caption
  caption12:  { ...F.medium,    fontSize: 13, lineHeight: 18 },
  caption11:  { ...F.medium,    fontSize: 12, lineHeight: 17 },

  // Terms sheet
  terms20:    { ...F.black,     fontSize: 20, lineHeight: 26, letterSpacing: -0.5 },
  terms15:    { ...F.extraBold, fontSize: 16, lineHeight: 21 },
  terms14:    { ...F.medium,    fontSize: 15, lineHeight: 20, letterSpacing: -0.1 },
} as const;
