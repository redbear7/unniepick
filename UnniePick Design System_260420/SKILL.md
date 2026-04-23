---
name: unniepick-design
description: Use this skill to generate well-branded interfaces and assets for 언니픽 (UnniePick) — a location-based coupon feed app for Korean neighborhood shops — either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

Quick map:
- `README.md` — Company context, Content Fundamentals, Visual Foundations, Iconography
- `colors_and_type.css` — All design tokens (colors, fonts, radii, shadows, spacing) as CSS variables + semantic classes (`.t-h1`, `.t-b2`, etc). Import this first in any artifact.
- `fonts/` — KCC-Ganpan (display, Korean signage feel) + Pretendard (UI)
- `assets/` — App icons, splash, favicon
- `preview/` — 19 small cards demonstrating each token / component in isolation
- `ui_kits/ios_app/` — React components + interactive demo of the 4 main screens (홈 피드 · 내 쿠폰함 · 가게 탐색 · 사장님 홈)

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Brand quick-reference
- **Primary color:** `#FF6F0F` (orange-500) — the only brand color; everything else is neutral
- **Display font:** KCC-Ganpan (Korean signage-style, used sparingly for logo / hero numbers)
- **UI font:** Pretendard (all body, labels, buttons)
- **Tone:** Warm, casual Korean; 해요체 (polite-informal); owner-to-customer relationship; emoji as category markers (🎟 coupons, ☕ café, 💇 hair, 🔥 urgent)
- **Signature components:** Dashed orange coupon card, Twitter-style feed post, expiry progress bar, full-screen QR sheet
- **Avoid:** Purple/blue gradients, western SaaS conventions, overly abstract iconography
