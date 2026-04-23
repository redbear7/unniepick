# 언니픽 (UnniePick) — Design System

**위치기반 쿠폰 피드 & 빠른알림 플랫폼**
*Location-based coupon feed & push notification platform for Korean neighborhood shops.*

---

## What is 언니픽?

UnniePick combines a Twitter/X-style social timeline with HotPepper-style coupon mechanics, tuned for small Korean neighborhood businesses (cafés, hair salons, nail shops, restaurants, convenience stores). The hero promise:

- **For shop owners:** "Publish a coupon to your followers in 30 seconds" — one-tap push notification to every follower, no algorithm, no SMS fees.
- **For customers:** "Never miss a deal from your favorite local shops" — a single feed of live coupons from every shop you follow, with D-1 expiry reminders.

The app ships as an iOS-first Expo app backed by Supabase. The customer side is a minimal 3-tab flow (Home Feed / My Coupons / Store Discovery). Owners have their own dashboard with coupon creation, QR scan, push announcements, TTS in-store announcements, and stamp rewards.

### Products represented in this system

| Product | What it is | UI kit |
|---|---|---|
| **iOS app (customer + owner)** | Single Expo app with customer 3-tab flow (홈 피드 · 내 쿠폰함 · 가게 탐색) plus owner-mode dashboard | `ui_kits/ios_app/` |

---

## Sources

All tokens, components, and copy were derived from these inputs (stored so a future reader can verify if they have access):

- **Codebase (attached via File System Access):** `unniepick/`
  - Design tokens: `unniepick/src/constants/theme.ts`
  - HTML design mockup: `unniepick/design-mockup.html`
  - Customer screens: `unniepick/src/screens/customer/` (23 screens)
  - Owner screens: `unniepick/src/screens/owner/` (8 screens)
  - PRD: `unniepick/PRD-unniepick.md`
  - Fonts: `unniepick/assets/fonts/` (KCC-Ganpan, Pretendard)
- **GitHub repo referenced:** `redbear7/unniepick` (not imported — codebase mirror is authoritative)
- **Fonts uploaded directly:** `uploads/KCC-Ganpan.otf`

---

## Content Fundamentals

### Language
Everything is in **Korean (한국어)**. The tone is warm, informal, and conversational — the brand name itself means "Unnie's Pick" (unnie = older sister / cool girl friend). Copy reads like a friend recommending their favorite spots, not like a corporate retail ad.

### Voice & tone
- **Informal but polite** — uses `-요` / `-해요` endings, never stiff `-합니다`. Example: "쿠폰 받기" (not "쿠폰을 수령하십시오"), "오늘 그만 보기" (not "금일 미표시").
- **Action-first buttons** — verbs at the end, never "Click to..." phrasing. `받기`, `저장됨`, `발급받기 →`, `쿠폰 발행하기`.
- **Numeric, confident in status lines** — "팔로워 1,230", "저장 128명 / 사용 47명", "잔여 10장". No hedging.
- **Urgency without pressure** — uses natural-sounding countdowns: `오늘 마감`, `내일 마감`, `D-2`, `오늘만`, `선착순 10명 마감 임박!`.
- **First-person where warm, second-person where action-oriented** — "내 쿠폰함" (My wallet), but "팔로우한 가게 혜택을 놓치지 마세요" (Don't miss deals from shops you follow).

### Casing & punctuation
- Korean has no case; English tokens (AD, NEW, D-7, QR) are **ALL CAPS**.
- Exclamation marks are welcome for celebratory moments (`스탬프 완성! 축하해요!`, `새 쿠폰이 왔어요!`) but never for CTAs.
- Mid-dot `·` separates metadata: `카페 · 팔로워 1,230명 · 3시간 전`.
- Tildes `~` for date ranges: `~12월 25일`.

### Emoji usage
**Emoji is a core part of the visual language** — not decorative but functional. They carry categorical meaning:
- Category icons: ☕ cafe · 🍽 food · ✂️ beauty · 💅 nail · 🏪 etc
- Status/time: ⏰ urgent, 📅 expiring, 🔥 hot/low stock, 🎟 coupon, ⚡ deal alert, 📍 location, 🗺 district
- Social: ❤️/🤍 like, ⭐/☆ pick, 🎉 celebrate, 💬 comment, 📤 share
- Brand mascot "Picki" uses 🐻 / 🐻‍❄️ / 🎉 for moods.

### Example copy (real, from the product)

> **Empty state:**
> 🎟
> 팔로우한 가게의
> 쿠폰이 여기 뜹니다
> 가게를 팔로우하면
> 새 쿠폰을 즉시 알려드려요

> **Feed card:**
> 🟠 카페봄날 · 방금
> ⚡ 오늘 오후 2-5시 아메리카노 1+1 쿠폰 발급 중!
> [쿠폰 받기 →]

> **Picki mascot bubble:**
> 오늘도 맛있겠다!
> 새 쿠폰이 왔어요!
> 스탬프 완성! 축하해요!

---

## Visual Foundations

### Colors
The palette is **Toss-inspired grays + a signature warm orange** (`#FF6F0F`). The orange is the *only* brand color — no secondary brand color, no purple, no teal. Everything else is neutral gray or semantic (red/green/yellow/blue for status, used sparingly).

- **Primary:** `#FF6F0F` (orange-500) — CTAs, active states, progress fills, badges that must pop
- **Primary background:** `#FFF3EB` (orange-50) — coupon card fills, soft chips
- **Neutrals:** 11-step Toss-style ramp (`gray-50` through `gray-900`), never drifting to cool/blue
- **Semantic:** red `#E53935` for expiry/urgent, green `#0AC86E` for success/distance, yellow `#FEE500` for Kakao/accent
- **Surfaces:** always white cards on `gray-100` background; the dark gradient `#191F28 → #333D4B` is reserved for the **owner dashboard** and QR-use fullscreen

### Typography
- **Body / UI:** Pretendard (Korean-optimized sans with Latin parity). The codebase uses `NotoSansKR` constants but Pretendard is shipped as the bundled font — Pretendard is preferred.
- **Display / playful:** KCC-Ganpan — a thick Korean display face used sparingly for hero moments (splash, celebratory titles, brand wordmark). Never for body.
- **Weights in play:** 400 (body), 500 (label), 600 (button label), 700 (heading), 800 (hero heading), 900 (display). 9-step TYPE scale (d1 → c2) from `theme.ts`.
- **Tight letter-spacing on large Korean** — d1 is `-0.8px`, headings trend negative. Buttons/labels are neutral or slightly positive.
- **Line heights are generous** — body b1 is 15/24 (1.6), matching Korean reading conventions.

### Spacing
10-step scale from `xxs: 2px` to `5xl: 48px`. Base rhythm is 4px. Cards use 16px horizontal padding, 14–16px vertical. List items are 14–16px vertical.

### Backgrounds
- **Flat and bright by default.** Customer feed is white cards on `gray-100`. No textures, no grain, no patterns.
- **Full-bleed gradients** only in two places:
  1. Wallet card tops — `var(--grad-brand)` (orange → lighter orange)
  2. Owner dashboard header — `var(--grad-dark)` (gray-900 → gray-800)
- **Protection gradients** under stickied headers when content scrolls — none by default; headers sit on solid white with a 1px divider.
- No hand-drawn illustrations, no stock photos in-app. The brand leans on emoji + solid color avatars instead.

### Store avatars
Category-colored rounded-square avatars (52×52, radius 14) with the first character of the store name in 900-weight white. Color is hash-assigned from an 8-color palette (`#FF6F0F`, `#FF9A3D`, `#5B67CA`, `#2DB87A`, `#D946B0`, `#FF6B6B`, `#4C9EFF`, `#F59E0B`). This is a signature move — no logo uploads, no photo.

### Animations & motion
- **Durations:** fast 150ms, normal 250ms, slow 400ms, slower 600ms
- **Easing:** standard ease out for UI; **spring** (`speed: 16, bounciness: 4`) for bottom-sheet entrances and selected-card slide-ups
- **Heart / pick micro-interaction:** scale to 1.35–1.4 in 100ms, spring back to 1.0
- **Entry stagger:** feed/coupon items fade in with 380ms opacity + 20px translateY, staggered 80ms apart
- **No page transitions** beyond React Navigation defaults
- **Countdown timers tick every 1s** for timesale badges

### Hover / press states (mobile-first)
- **Press:** `activeOpacity: 0.7–0.85` is the app standard — a gentle fade, never a scale-down
- **On web mocks:** hover raises elevation slightly (sm → md) and darkens fills 4–8%

### Borders
- Hairlines on dividers (`StyleSheet.hairlineWidth` ≈ 0.5px, `gray-200`)
- Card borders are generally absent — separation is by shadow or background color
- **Dashed orange border** is a signature for coupon-inline cards: `1.5px dashed var(--primary)` on `--primary-light` fill

### Shadow system
5-step elevation plus a brand-colored shadow:
| Token | Use |
|---|---|
| xs | Subtle chip lift |
| sm | Default card shadow |
| md | Elevated cards (coupon strip), wallet card |
| lg | Dropdown, bottom sheet |
| xl | Modal, QR fullscreen |
| brand | Primary CTA hover, loud attention cards |

Shadows always have `y-offset = 2 × blur / 4`, low opacity (4–12%), and use `gray-900` as the base color.

### Corner radii
- Chips & pills: `full` (9999px)
- Buttons: 20–22px (pill-ish) for primary CTAs; 12px for blocky "full-width" buttons
- Cards: 14–16px
- Bottom sheets: 24px (top corners only)
- Avatars: 14px (rounded square, not circle) for stores; 50% circle for users

### Transparency & blur
Minimal. Used for:
- Modal dim (`rgba(0,0,0,0.45)`)
- Subtle borders on colored backgrounds (`rgba(255,255,255,0.08–0.2)`)
- "Glassmorphism" tokens are defined in `theme.ts` but appear rarely — reserved for floating nav over rich backgrounds
- No backdrop-filter blur in the production app

### Imagery color vibe
Warm, daylight, no grain. When banner imagery is used, it leans saturated primary-orange or solid pastel backgrounds with bold Korean display text. No dark-mode imagery outside the owner dashboard header and QR screen.

### Card anatomy
- White fill, radius 16, shadow-sm (or shadow-md for elevated/wallet)
- Optional 1.5px colored border for "featured" state (orange, as on featured coupon books)
- Internal padding: 14–16px
- Header row: avatar + store meta + right-side action (follow button / menu)
- Body: text content, optional inline coupon strip
- Footer: actions row (like/pick/share) separated by a `gray-100` hairline

### Layout rules
- Fixed top app-bar (56–60px) with white fill
- Fixed bottom tab bar (5 tabs + safe-area padding)
- Floating CTAs appear above the tab bar when contextual (e.g., "쿠폰 발행하기" on owner tab)
- Content max-width on web is 420px centered (mobile-first)
- Sticky sort/filter bars between header and scroll content

---

## Iconography

**UnniePick uses emoji as its primary icon system**, with category emoji being semantically meaningful (not decorative). See the Content Fundamentals section above for the mapping. This is intentional — it matches the warm, personal, Korean-conversational voice and keeps the product feeling like a social feed rather than a retail catalog.

- **No custom icon font / no SVG set** in the codebase. `expo-barcode-scanner` and `react-native-qrcode-svg` ship their own functional icons; otherwise icon slots are filled with emoji or composed from text + background.
- **Unicode arrows** (`→`, `✓`, `⚡`, `✕`) appear in CTAs and status.
- **Status bar "icons"** in the design mockup are custom SVGs for battery/wifi — those are device-chrome, not app icons.
- **Logos** are stored in `unniepick/assets/` (icon.png, splash-icon.png, favicon.png, android foreground/background/monochrome).

### Icon policy for this design system
- Keep emoji-first for category, status, and social actions.
- If a UI needs a line icon not covered by emoji (e.g., chevron, close X, settings gear), use **Lucide** via CDN at 20px, stroke-width 2, color `var(--fg3)` or `var(--fg2)` — flagged as a substitution since the production app has no line-icon set.
- Never invent SVG illustrations. Use solid color + emoji + type.

---

## ⚠️ Font substitutions

- **Pretendard** ships from the codebase (`Pretendard-Regular/Bold/Black.ttf`). The theme file references `NotoSansKR_400/500/700` — Pretendard is effectively the shipped substitute and is what the bundled assets support. **No action needed**, but if you want exact `NotoSansKR` metrics, import from Google Fonts.
- **KCC-Ganpan** is provided as `.otf`. The 500 and 600 weights in the type scale are approximated by the 400 upright (this font ships as a single weight). Flag if you need heavier display variants.

---

## Folder manifest (index)

```
.
├── README.md                  ← you are here
├── SKILL.md                   ← portable skill manifest (read first when invoked)
├── colors_and_type.css        ← CSS vars mirroring theme.ts
├── fonts/
│   ├── KCC-Ganpan.otf         ← playful Korean display
│   ├── Pretendard-Regular.ttf
│   ├── Pretendard-Bold.ttf
│   └── Pretendard-Black.ttf
├── assets/
│   ├── icon.png               ← app icon
│   ├── splash-icon.png
│   ├── favicon.png
│   └── android-icon-*.png
├── preview/                   ← Design System tab cards
│   ├── colors-brand.html
│   ├── colors-neutral.html
│   ├── colors-semantic.html
│   ├── type-display.html
│   ├── type-headings.html
│   ├── type-body.html
│   ├── spacing.html
│   ├── radius.html
│   ├── shadows.html
│   ├── buttons.html
│   ├── chips.html
│   ├── avatars.html
│   ├── coupon-card.html
│   ├── feed-card.html
│   ├── wallet-card.html
│   ├── store-list-item.html
│   ├── badges.html
│   ├── logo.html
│   └── picki.html
└── ui_kits/
    └── ios_app/               ← iOS app (customer + owner) recreation
        ├── README.md
        ├── index.html
        ├── ios-frame.jsx
        ├── ui-kit.css
        ├── Primitives.jsx
        ├── FeedPost.jsx
        ├── Wallet.jsx
        ├── StoreRow.jsx
        ├── OwnerDashboard.jsx
        └── data.jsx
```
