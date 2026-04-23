# 어드민 대시보드 기반 iOS 앱 적용/수정 사항 보고서

> 작성일: 2026-04-09  
> 분석 대상: unniepick-admin (Next.js) ↔ unniepick (Expo/React Native)

---

## 1. 어드민 주요 기능 현황

### 대시보드 페이지 (`/app/dashboard/`)

| 페이지 | 주요 기능 | 구현 상태 |
|--------|---------|----------|
| `/dashboard` | 실시간 통계, DB 이용률, 날씨 BGM 추천 | ✅ 완료 |
| `/dashboard/stores` | 가게 CRUD, TTS 정책 할당, 가게 승인 | ✅ 완료 |
| `/dashboard/tracks` | 3,000+ 음악 관리, BPM/에너지/무드 태그 | ✅ 완료 |
| `/dashboard/playlists` | 수동/AI 큐레이션 플레이리스트 | ✅ 완료 |
| `/dashboard/tags` | mood/time/weather/category 태그 운영 | ✅ 완료 |
| `/dashboard/announcements` | Fish Audio TTS 생성, 고객 호출 시스템, 템플릿 | ✅ 완료 |
| `/dashboard/cardnews` | Gemini + Remotion 카드뉴스 영상 자동 생성 | ✅ 완료 |
| `/dashboard/shorts` | 음악 트랙 → 인스타/TikTok 숏폼 변환 | ✅ 완료 |
| `/dashboard/owners` | 사장님 PIN 관리, 월 변경 한도 | ✅ 완료 |
| `/dashboard/coupons` | 쿠폰 관리, 발급 현황, 지도 표시 | ✅ 완료 |
| `/dashboard/notices` | 공지사항 CRUD, 유형/고정/좋아요/조회수 | ✅ 완료 |
| `/dashboard/posts` | 게시물 삭제 요청 승인/반려 | ✅ 완료 |
| `/dashboard/users` | 회원 조회, 역할별 필터 | ✅ 완료 |
| `/dashboard/brands` | 브랜드/체인점 관리, 태그 연동 | ✅ 완료 |
| `/dashboard/map` | 매장 위치 시각화 (Leaflet) | ✅ 완료 |
| `/dashboard/ai-images` | AI 이미지 생성 | ✅ 완료 |
| `/dashboard/contexts` | 매장별 상세 컨텍스트 설정 | ✅ 완료 |
| `/dashboard/propagation` | 마케팅 데이터 추적 | ✅ 완료 |
| `/dashboard/references` | 제휴/외부 음악 소스 관리 | ✅ 완료 |

### API 엔드포인트 (`/app/api/`)

| 엔드포인트 | 기능 | iOS 연동 여부 |
|-----------|------|-------------|
| `POST /api/tts/generate` | Fish Audio TTS 생성 + 일일 한도 체크 | ❌ 미연동 (iOS는 OpenAI 직접 호출) |
| `GET /api/tts/usage` | 가게별 오늘 TTS 사용량 조회 | ❌ 미연동 |
| `GET /api/tts/voices` | Fish Audio 음성 목록 | ❌ 미연동 |
| `GET /api/weather` | Open-Meteo 날씨 + BGM 무드 추천 | ⚠️ iOS는 별도 구현 |
| `POST /api/cardnews/generate-cards` | Gemini로 카드 문구 자동 생성 | ❌ iOS 미구현 |
| `POST /api/cardnews/render` | Remotion 카드뉴스 비디오 렌더링 | ❌ iOS 미구현 |
| `POST /api/shorts/render` | 음악 → 숏폼 비디오 렌더링 | ❌ iOS 미구현 |
| `POST /api/owner/auth` | 사장님 PIN 로그인 | ✅ iOS 구현됨 |
| `POST /api/owner/change-pin` | PIN 변경 (월 2회 한도) | ❌ iOS 미구현 |
| `GET /api/notices` | 공지사항 목록 | ✅ iOS 구현됨 |

---

## 2. iOS 앱 현재 구현 상태

### 고객 화면 (`/src/screens/customer/`)

| 화면 | 기능 | 상태 |
|------|------|------|
| HomeScreen | 홈 피드, 배너, 무드 플레이리스트, 쿠폰 추천 | ✅ 구현됨 |
| MusicScreen | 플레이리스트 목록, 날씨+시간 기반 큐레이션 | ✅ 구현됨 |
| PlaylistDetailScreen | 곡 목록, 음악 재생 | ✅ 구현됨 |
| CouponListScreen | 쿠폰 피드/내쿠폰 탭, 정렬/필터링 | ✅ 구현됨 |
| CouponDetailScreen | 쿠폰 상세, QR 코드 표시 | ✅ 구현됨 |
| StoreHomeScreen | 가게 미니홈피 (쿠폰, 공지, BGM) | ✅ 구현됨 |
| AnnouncementBoardScreen | 공지사항 게시판 (제목+본문 기본만) | ⚠️ 부분 구현 |
| MapScreen | 지도 (Google Maps, 근처 가게) | ✅ 구현됨 |
| ReceiptScanScreen | 영수증 OCR 인증 (Claude Vision) | ✅ 구현됨 |
| WalletScreen | UNNI 적립금 내역 | ✅ 구현됨 |
| StampCardScreen | 스탬프 카드 현황 | ✅ 구현됨 |
| RankingScreen | 사용자 랭킹 | ✅ 구현됨 |
| StoreCheckinScreen | 가게 GPS 체크인 | ✅ 구현됨 |
| InterestScreen | 찜한 가게 | ✅ 구현됨 |
| MyPageScreen | 마이페이지, 설정 | ✅ 구현됨 |
| SpinWheelScreen | 스핀 휠 미니게임 | ✅ 구현됨 |
| **카드뉴스 화면** | 어드민 생성 카드뉴스 표시 | ❌ **없음** |
| **숏폼 화면** | 어드민 생성 숏폼 영상 표시 | ❌ **없음** |

### 사장님 화면 (`/src/screens/owner/`)

| 화면 | 기능 | 상태 |
|------|------|------|
| OwnerLoginScreen | PIN 로그인, 생체인증 | ✅ 구현됨 |
| OwnerDashboardScreen | 통계, 쿠폰, 게시물, TTS, 스탬프 (108KB) | ✅ 구현됨 |
| CouponCreateScreen | 쿠폰 생성 | ✅ 구현됨 |
| CouponManageScreen | 쿠폰 조회/수정 | ✅ 구현됨 |
| QRScannerScreen | QR 스캔 (쿠폰 사용 확인) | ✅ 구현됨 |
| StoreApplyScreen | 가게 신청 | ✅ 구현됨 |
| StoreQRScreen | 가게 QR 코드 | ✅ 구현됨 |
| OwnerMusicScreen | 배경음악 관리 | ✅ 구현됨 |
| **PIN 변경 화면** | PIN 변경 (월 2회 한도) | ❌ **없음** |

---

## 3. 어드민 완료 → iOS 미반영 기능 정리

### 🔴 긴급 (기능 불일치/누락)

#### 3-1. TTS 서비스 통합 불일치
- **어드민**: Fish Audio API + 일일 사용량 DB 추적 (`tts_daily_usage` 테이블)
- **iOS**: OpenAI TTS (어른) / Supertone·ElevenLabs (어린이) — 클라이언트 단 직접 호출, 사용량 추적 없음
- **문제**: iOS 사장님 TTS 사용량이 어드민에서 관리되는 `tts_policies` 한도와 완전히 별개로 동작
- **해결 방향**: iOS TTS 호출을 어드민 API(`/api/tts/generate`)로 프록시하거나, iOS에서 동일한 `tts_daily_usage` 테이블에 직접 기록하도록 수정

#### 3-2. 사장님 PIN 변경 기능 부재
- **어드민**: `POST /api/owner/change-pin` 구현 완료 (현재 무제한, 운영 전 월 2회로 변경 예정)
- **iOS**: PIN 변경 화면 없음. 사장님이 앱에서 PIN을 변경할 방법이 없음
- **해결 방향**: 사장님 대시보드에 "PIN 변경" 메뉴 추가, 어드민 API 연동

#### 3-3. 공지사항 표시 기능 미완성
- **어드민에서 관리하는 데이터**: `notice_type` (general/important/event), `is_pinned`, `like_count`, `author_name`, `author_emoji`, `image_url`
- **iOS에서 표시하는 데이터**: 제목, 본문, 날짜만 표시. 나머지 필드 무시
- **해결 방향**:
  - `notice_type`에 따른 배지 UI (일반/중요/이벤트)
  - `is_pinned` 공지 상단 고정 표시
  - `like_count` 좋아요 버튼 및 카운트 표시 (좋아요 누르기 기능)
  - `author_name` + `author_emoji` 작성자 정보 표시
  - `image_url` 이미지 표시

### 🟡 중요 (신규 기능 추가 필요)

#### 3-4. 카드뉴스/숏폼 영상 표시 화면 없음
- **어드민**: Gemini + Remotion으로 카드뉴스·숏폼 영상 생성 및 Supabase Storage 업로드 (`card_news` 테이블, `music-tracks/shorts/` 버킷)
- **iOS**: 생성된 영상을 볼 수 있는 화면 전혀 없음
- **해결 방향**:
  - 사장님 대시보드에 "내 콘텐츠" 탭 추가 (어드민에서 생성한 카드뉴스/숏폼 목록)
  - 영상 재생 기능 추가 (react-native-video 또는 expo-av)
  - 고객 화면에서 가게별 숏폼 콘텐츠 노출 (StoreHomeScreen 연동)

#### 3-5. 브랜드(체인점) 정보 미표시
- **어드민**: `brands` 테이블로 체인점/프랜차이즈 관리 (name, handle, color, tags, description)
- **iOS**: 브랜드 정보를 표시하는 화면 없음
- **해결 방향**: 가게 화면에서 체인점 브랜드 연결 표시, 브랜드별 필터링 기능 추가

### 🟢 개선 권장

#### 3-6. 날씨 BGM 추천 로직 개선
- **어드민**: 날씨 코드 + 기온만 반영한 무드 추천
- **iOS**: 날씨 + 시간대를 모두 반영한 더 세분화된 추천 (더 우수함)
- **현황**: iOS 구현이 어드민보다 우수하므로 현 상태 유지 권장. 어드민 쪽을 iOS 로직에 맞게 업데이트하는 것을 검토

#### 3-7. 사장님 TTS 음성 목록 동기화
- **어드민**: Fish Audio 기반 음성 목록 (`GET /api/tts/voices`)
- **iOS**: OpenAI/Supertone 기반 8가지 고정 음성 타입
- **개선 방향**: 음성 목록을 어드민 API에서 동적으로 받아 사용 (TTS 통합 후 자동 해결됨)

#### 3-8. 마스코트 추천 기능 노출
- **어드민**: `POST /api/owner/mascot-recommend` — 개인화 마스코트 추천 API
- **iOS**: `VrmViewer`, `MascotWidget` 컴포넌트 존재하지만 마스코트 추천 API 연동 여부 불명확
- **개선 방향**: 어드민 마스코트 추천 API를 iOS에서 호출하여 개인화된 마스코트 제공

---

## 4. iOS 앱 수정/추가 작업 목록

### 우선순위 1 — 즉시 처리 필요

| # | 작업 | 파일 | 예상 규모 |
|---|------|------|---------|
| 1 | TTS 사용량 어드민 DB와 연동 (tts_daily_usage 테이블 기록) | `src/lib/services/ttsService.ts` | 중 |
| 2 | 사장님 PIN 변경 화면 추가 | 신규 파일 or `OwnerDashboardScreen.tsx` | 소~중 |
| 3 | PIN 변경 API 연동 (`POST /api/owner/change-pin`) | `src/lib/services/` 신규 서비스 | 소 |
| 4 | 공지사항 유형 배지 UI 추가 (general/important/event) | `AnnouncementBoardScreen.tsx` | 소 |
| 5 | 공지사항 고정(is_pinned) 상단 표시 | `AnnouncementBoardScreen.tsx` + `announcementService.ts` | 소 |
| 6 | 공지사항 좋아요 버튼 + 카운트 표시 | `AnnouncementBoardScreen.tsx` + `announcementService.ts` | 소 |
| 7 | 공지사항 작성자 정보 (author_name, author_emoji) 표시 | `AnnouncementBoardScreen.tsx` | 소 |
| 8 | 공지사항 이미지(image_url) 표시 | `AnnouncementBoardScreen.tsx` | 소 |

### 우선순위 2 — 단기 처리 필요

| # | 작업 | 파일 | 예상 규모 |
|---|------|------|---------|
| 9 | 사장님 대시보드 "내 콘텐츠" 탭 추가 (카드뉴스/숏폼 목록) | `OwnerDashboardScreen.tsx` | 중 |
| 10 | card_news 테이블 조회 서비스 추가 | `src/lib/services/` 신규 | 소 |
| 11 | 영상 재생 컴포넌트 추가 (expo-av VideoView) | 신규 컴포넌트 | 소 |
| 12 | StoreHomeScreen에 가게 숏폼 영상 노출 | `StoreHomeScreen.tsx` | 중 |
| 13 | 공지사항 서비스 확장 (like_count 좋아요 토글 API) | `announcementService.ts` | 소 |

### 우선순위 3 — 중기 개선

| # | 작업 | 파일 | 예상 규모 |
|---|------|------|---------|
| 14 | 브랜드(brands) 테이블 연동, 가게 화면에 브랜드 정보 표시 | 신규 서비스 + StoreHomeScreen | 중 |
| 15 | 브랜드별 가게 필터링 기능 (MapScreen, HomeScreen) | `MapScreen.tsx`, `HomeScreen.tsx` | 중 |
| 16 | 마스코트 추천 API 연동 | 기존 마스코트 컴포넌트 | 소 |
| 17 | 어드민 TTS API 프록시로 전환 (Fish Audio 통합) | `ttsService.ts` | 대 |
| 18 | TTS 일일 사용량 UI 표시 (사장님 대시보드) | `OwnerDashboardScreen.tsx` | 소 |
| 19 | 소셜 로그인 실제 통합 (카카오/네이버/Apple) | `socialAuthService.ts`, 신규 화면 | 대 |
| 20 | Suno AI 플레이리스트 자동 생성 완성 | `playlistGenerationService.ts` | 대 |

---

## 5. 우선순위별 작업 요약

### 🔴 P1 — 긴급 (이번 주)

**목표**: 기능 불일치 해소, 사용자가 불편함을 느끼는 항목 해결

1. **공지사항 UI 개선** (작업 #4~8): 어드민에서 이미 세분화된 공지사항 데이터를 관리하고 있으나 iOS에서 미표시. 빠르게 반영 가능하고 사용자 경험 향상 효과가 큼
2. **사장님 PIN 변경 기능** (작업 #2~3): 현재 사장님이 앱에서 PIN을 변경할 방법이 전혀 없음. 어드민 API가 이미 완성되어 있으므로 iOS 화면만 추가하면 됨

### 🟡 P2 — 중요 (이번 달)

**목표**: 어드민에서 생성된 콘텐츠를 iOS에서 활용

3. **카드뉴스/숏폼 콘텐츠 표시** (작업 #9~12): 어드민에서 열심히 생성한 마케팅 콘텐츠가 고객에게 노출되지 않는 상태. 사장님과 고객 모두를 위한 기능
4. **TTS 사용량 DB 연동** (작업 #1): 어드민의 정책 시스템과 iOS TTS 사용이 완전히 분리되어 있어 사용량 관리가 불가능

### 🟢 P3 — 중기 (다음 분기)

5. **브랜드 기능 iOS 반영** (작업 #14~15): 체인점/프랜차이즈 사용자를 위한 기능
6. **TTS 어드민 API 완전 통합** (작업 #17~18): 어드민과 iOS TTS 시스템 일원화
7. **소셜 로그인 완성** (작업 #19): 사용자 편의성 향상
8. **Suno AI 플레이리스트** (작업 #20): 핵심 차별화 기능 완성

---

## 6. 데이터베이스 스키마 참고 (iOS 반영 필요 테이블)

| 테이블 | iOS 현재 연동 | 필요 작업 |
|--------|------------|---------|
| `tts_daily_usage` | ❌ 미연동 | TTS 사용량 기록/조회 |
| `tts_policies` | ❌ 미연동 | 가게별 한도 확인 |
| `card_news` | ❌ 미연동 | 카드뉴스 목록 조회 |
| `notices` (is_pinned, like_count, notice_type, author 필드) | ⚠️ 부분 연동 | 추가 필드 조회 및 표시 |
| `brands` | ❌ 미연동 | 브랜드 정보 연동 |

---

## 7. 참고 사항

### 어드민 운영 전 해야 할 것 (어드민 내 TODO 발견)

- `app/api/owner/change-pin/route.ts` 라인 9: `const MAX_CHANGES_PER_MONTH = Infinity; // TODO: 운영 전 2로 변경`
  → 운영 시작 전 `2`로 변경 필요

### iOS 앱이 어드민보다 더 발전된 부분

- **날씨+시간 통합 BGM 큐레이션**: iOS가 시간대 변수까지 반영하여 더 정교함. 어드민 대시보드에도 동일 로직 적용 권장
- **TTS 음성 다양성**: iOS 8가지 음성(어른 4 + 어린이 4) vs 어드민 Fish Audio 단일 API. 어린이 전용 음성은 iOS만의 차별화
- **영수증 OCR 인증**: 어드민에는 없는 iOS 전용 기능 (Claude Vision + GPS + 가게명 매칭)
- **스탬프 카드**: 어드민에서 설정하고 iOS에서 고객이 사용하는 구조로 잘 분리됨
