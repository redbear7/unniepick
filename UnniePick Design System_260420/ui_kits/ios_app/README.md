# UnniePick iOS App — UI Kit

**Pixel-faithful recreation of the 언니픽 Expo/React Native app, based on `unniepick/src/constants/theme.ts` and the PRD's 3-tab UX.**

## Preview
Open `index.html` for an interactive demo. Four toolbar buttons switch between entry screens:

- **홈 피드** — Twitter/X-style timeline of store posts with embedded coupons
- **내 쿠폰함** — Wallet with segmented tabs (사용 가능 / 완료 / 만료), expiry progress bars, full-screen QR sheet
- **가게 탐색** — GPS-radius store list with category chips and follow toggle
- **사장님 홈** — Owner dashboard with stats gradient header, big "⚡ 쿠폰 발행하기" CTA, active-coupon performance cards

## Component files
| File | Contains |
|---|---|
| `ios-frame.jsx` | iPhone device bezel (starter component) |
| `Primitives.jsx` | `StoreAvatar`, `CouponInline`, `Header`, `TabBar`, `ChipRow`, `Segment` |
| `FeedPost.jsx` | `FeedPost` — the signature card |
| `Wallet.jsx` | `WalletCard` (gradient top + progress) + `QRSheet` (full-screen QR modal) |
| `StoreRow.jsx` | `StoreRow` — discovery list item |
| `OwnerDashboard.jsx` | `OwnerDashboard` — owner-mode home |
| `data.jsx` | `SAMPLE_POSTS`, `SAMPLE_WALLET`, `SAMPLE_STORES` |
| `ui-kit.css` | Screen-specific classes layered on `colors_and_type.css` |

## What's interactive
- Tab bar navigation between 4 primary tabs
- "쿠폰 받기" on any feed post toggles saved state
- "+ 팔로우" / "팔로잉" toggles
- Wallet segments switch between sets
- QR 사용하기 → full-screen QR modal
- Category chips filter feed + explore

## What's cosmetic-only
- Location change, search, notifications (icons render but do nothing)
- Owner dashboard performance numbers are static
- QR "code" is a decorative grid, not a real scannable QR

## Known gaps vs. the live app
- **Picki mascot illustrations** are emoji placeholders. The real app has custom bear-character renders — user should provide them.
- **Banners / rolling ads** from `BannerSlider.tsx` + `RollingBanner.tsx` aren't wired (they depend on Supabase data).
- **Music tab** & **stamp rewards** (referenced in `docs/music-tab-spec.md`) are out of scope — MVP 3-tab structure prioritized.
