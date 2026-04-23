# 🎵 뮤직탭 기획서 v1.0

> **핵심 철학**: 모든 가게가 고유한 음악 정체성을 가지도록.
> AI가 가게의 공간·날씨·사장 취향·시간대를 읽어 플레이리스트를 즉석에서 구성하거나, 시샵이 큐레이션한 플레이리스트를 상황별로 제공한다.

---

## 1. 개요

### 1.1 문제 정의

| 현황 문제 | 목표 상태 |
|---|---|
| 프랜차이즈·비슷한 업종끼리 같은 BGM 사용 | 가게마다 "우리 가게 음악"이 있다는 느낌 |
| 사장이 BGM 고르는 데 시간·노력 소모 | AI가 알아서 상황에 맞게 큐레이션 |
| 계절·날씨·시간대 무시한 정적 플레이리스트 | 실시간 컨텍스트 반영한 동적 플레이리스트 |
| 고객이 음악을 매개로 가게와 연결되지 않음 | 음악이 가게 브랜드 경험의 일부가 됨 |

### 1.2 두 가지 플레이리스트 모드

```
┌─────────────────────────────────────────────────────┐
│                   뮤직탭 플레이리스트                     │
├──────────────────────────┬──────────────────────────┤
│     🤖 AI 즉석 큐레이션      │   📚 시샵 큐레이션 플레이리스트  │
│   (Dynamic Playlist)     │   (Curated Playlist)     │
├──────────────────────────┼──────────────────────────┤
│ 등록된 트랙 풀에서            │ 시샵이 상황/장소/시간대별로      │
│ 실시간 컨텍스트 기반           │ 미리 제작해둔 플레이리스트       │
│ 매번 새로운 조합 생성           │ 전문 큐레이터 감수 보장         │
└──────────────────────────┴──────────────────────────┘
```

---

## 2. 취향 분석 데이터 소스

### 2.1 날씨 컨텍스트 (실시간)

**데이터 출처**: 기상청 API / OpenWeatherMap

| 날씨 상태 | 매핑 무드 태그 | BPM 범위 |
|---|---|---|
| ☀️ 맑음 (25°C+) | upbeat, tropical, bright | 110~130 |
| ⛅ 흐림 | mellow, indie, lo-fi | 80~100 |
| 🌧 비 | rainy, jazz, chill | 70~90 |
| ❄️ 눈 / 추위 | cozy, acoustic, warm | 75~95 |
| 🌅 일출 (5~8시) | morning, fresh, acoustic | 85~105 |
| 🌃 야간 (21시~) | night, ambient, lounge | 70~90 |

**구현 포인트**:
- 가게 위치 좌표(`latitude`, `longitude`)로 현재 날씨 조회
- 날씨 → 무드 태그 변환 후 `fetchTracksByMood()` 호출
- 캐시: 30분 단위 (날씨 API 호출 최소화)

---

### 2.2 매장 사진 분석 (AI Vision)

**데이터 출처**: 가게 등록 사진 (`store.image_url`, 추가 사진 업로드)
**분석 엔진**: Claude Vision API (claude-sonnet-4-6)

#### 분석 항목 및 예시 출력

```json
{
  "space_type": "카페",
  "ambiance": ["아늑한", "빈티지", "따뜻한 조명"],
  "interior_style": "인더스트리얼",
  "color_palette": ["갈색", "베이지", "원목"],
  "customer_flow": "소규모·조용한",
  "suggested_moods": ["lo-fi", "jazz", "acoustic", "cozy"],
  "avoid_moods": ["EDM", "heavy-metal", "tropical"]
}
```

#### 프롬프트 설계

```
이 매장 사진을 분석해서 배경음악 추천을 위한 무드 태그를 추출해줘.
분석 항목: 공간 분위기, 인테리어 스타일, 색감, 예상 고객층, 소음 수준
출력 형식: JSON { ambiance[], suggested_moods[], avoid_moods[] }
무드 태그는 Suno AI 스타일 태그를 사용할 것.
```

#### DB 저장 위치

```sql
ALTER TABLE stores ADD COLUMN music_dna JSONB;
-- music_dna: { suggested_moods, avoid_moods, analyzed_at }
-- 재분석: 사진 변경 시 또는 수동 요청 시
```

---

### 2.3 사장 YouTube 재생목록 분석 (YouTube API)

**목적**: 사장의 음악 취향을 간접 수집 → 트랙 선별 가이드로 활용

#### 연동 흐름

```
사장 마이페이지
  └─ "내 유튜브 음악 취향 등록" 버튼
      └─ OAuth 2.0 (Google 로그인)
          └─ YouTube Data API v3
              └─ playlists.list + playlistItems.list
                  └─ 영상 제목·채널명 수집
                      └─ Claude API로 무드 분석
                          └─ store.music_dna 업데이트
```

#### YouTube API 수집 항목

```typescript
interface YouTubeAnalysis {
  playlist_count: number;
  track_samples: string[];      // 영상 제목 최대 50개
  extracted_artists: string[];  // 아티스트명
  genre_hints: string[];        // 장르 추정
  mood_tags: string[];          // Claude 분석 결과
  analyzed_at: string;
}
```

#### Claude 분석 프롬프트

```
다음은 가게 사장의 유튜브 음악 재생목록 영상 제목들이야:
[영상 제목 목록]

이 사람의 음악 취향을 분석해서 매장 BGM 큐레이션을 위한 무드 태그를 추출해줘.
- Suno AI 스타일 태그 사용
- BPM 범위 추정
- 어울리는 업종/공간 타입
출력: JSON { mood_tags[], bpm_range, space_fit[] }
```

#### 주의사항

- YouTube API 일일 할당량: 10,000 units — 재생목록 분석은 1회당 ~50 units
- OAuth 토큰은 `expo-secure-store` 암호화 저장
- 연동 해제 시 수집 데이터 즉시 삭제

---

### 2.4 좋아요 기반 취향 등록

**두 가지 좋아요 이벤트**:

#### A. 음악 트랙 좋아요 (청취 중 실시간)

```
[음악 재생 중] → 사용자가 ❤️ 탭
  └─ music_likes 테이블에 기록
      └─ { user_id, track_id, liked_at, store_id, time_of_day, weather_condition }
```

- 좋아요 누른 **시점의 날씨 + 시간대**도 같이 저장 → 컨텍스트 취향 학습
- 예: "비 오는 날 저녁에 lo-fi를 좋아했다" → 다음 비 오는 날 lo-fi 우선 배치

#### B. 취향 태그 직접 등록 (온보딩 / 마이페이지)

```
[취향 등록 화면]
선호 분위기: ☕ 카페풍  🌙 감성야간  🎸 인디  💃 신나는  🎷 재즈  ...
선호 BPM:   ○ 느린(~80)  ○ 보통(80~110)  ○ 빠른(110~)
싫어하는 장르: (멀티 선택)
```

#### DB 스키마

```sql
-- 음악 좋아요
CREATE TABLE music_likes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users,
  track_id      UUID REFERENCES music_tracks,
  store_id      UUID REFERENCES stores,
  liked_at      TIMESTAMPTZ DEFAULT NOW(),
  time_of_day   TEXT,        -- 'morning' | 'afternoon' | 'evening' | 'night'
  weather       TEXT,        -- 'sunny' | 'cloudy' | 'rainy' | 'snowy'
  play_duration INT          -- 몇 초 듣고 좋아요 눌렀는지
);

-- 사용자 취향 프로필
CREATE TABLE user_music_profiles (
  user_id       UUID PRIMARY KEY REFERENCES auth.users,
  preferred_moods TEXT[],
  avoided_moods   TEXT[],
  bpm_min       INT DEFAULT 70,
  bpm_max       INT DEFAULT 130,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 2.5 시간대 자동 감지

| 시간대 | 구분 | 무드 바이어스 |
|---|---|---|
| 06:00 ~ 10:00 | 아침 | fresh, acoustic, morning-coffee |
| 10:00 ~ 14:00 | 오전 | upbeat, pop, bright |
| 14:00 ~ 17:00 | 오후 | lo-fi, chill, study |
| 17:00 ~ 20:00 | 저녁 | jazz, indie, warm |
| 20:00 ~ 23:00 | 야간 | lounge, r&b, night |
| 23:00 ~ 06:00 | 심야 | ambient, minimal, deep |

---

### 2.6 가게 카테고리 기본 무드

| 업종 | 기본 무드 태그 | 기피 태그 |
|---|---|---|
| 카페 | lo-fi, acoustic, jazz, cozy | EDM, heavy |
| 음식점 | upbeat, pop, bright | sad, slow-ballad |
| 뷰티샵 | trendy, k-pop, pop | metal, aggressive |
| 건강/헬스 | energetic, EDM, hip-hop | slow, sad |
| 마트/편의점 | neutral, ambient, easy-listening | loud, aggressive |
| 바/펍 | jazz, blues, indie, night | children-music |

---

## 3. AI 즉석 큐레이션 엔진

### 3.1 컨텍스트 수집 → 무드 합산 알고리즘

```typescript
interface CurationContext {
  storeId:     string;
  weatherMood: string[];    // 2.1
  photoDNA:    string[];    // 2.2
  ownerMood:   string[];    // 2.3
  userLikes:   string[];    // 2.4
  timeOfDay:   string[];    // 2.5
  categoryMood: string[];   // 2.6
}

function buildMoodVector(ctx: CurationContext): string[] {
  const score: Record<string, number> = {};

  const weights = {
    weatherMood:  1.5,   // 실시간 → 가중치 높음
    timeOfDay:    1.5,
    photoDNA:     1.2,   // 공간 정체성
    categoryMood: 1.0,
    ownerMood:    1.0,
    userLikes:    0.8,   // 개인화 (가게 BGM이므로 낮게)
  };

  for (const [source, tags] of Object.entries(ctx)) {
    const w = weights[source as keyof typeof weights] ?? 1;
    for (const tag of tags) {
      score[tag] = (score[tag] ?? 0) + w;
    }
  }

  // 점수 높은 순 정렬, 상위 5개 태그 반환
  return Object.entries(score)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([tag]) => tag);
}
```

### 3.2 트랙 선별 로직

```typescript
async function buildDynamicPlaylist(
  storeId: string,
  trackCount = 20,
): Promise<MusicTrack[]> {
  const ctx    = await buildCurationContext(storeId);
  const moods  = buildMoodVector(ctx);
  const tracks = await fetchTracksByMood(moods, trackCount * 2);

  // 중복 아티스트 제거 (같은 아티스트 최대 2곡)
  const artistCount: Record<string, number> = {};
  return tracks
    .filter(t => {
      artistCount[t.artist] = (artistCount[t.artist] ?? 0) + 1;
      return artistCount[t.artist] <= 2;
    })
    .slice(0, trackCount);
}
```

### 3.3 플레이리스트 이름 자동 생성

```typescript
// Claude API 호출
const playlistName = await generatePlaylistName({
  moods,
  timeOfDay,
  weather,
  storeName,
});
// 예시 결과: "비 오는 화요일 오후의 {카페이름}"
//           "토요일 저녁, 따뜻한 재즈"
//           "오늘 같은 날엔 이 음악"
```

---

## 4. 시샵 큐레이션 플레이리스트

### 4.1 분류 체계

```
시샵 큐레이션
├── 📍 장소별
│   ├── 카페 BGM 시리즈
│   ├── 음식점 다이닝 무드
│   └── 뷰티샵 트렌디 팝
├── ⏰ 시간대별
│   ├── 모닝 루틴 (06~10시)
│   ├── 런치타임 바이브
│   ├── 오후의 나른함
│   └── 나이트 무드
├── 🌦 날씨별
│   ├── 비 오는 날 재즈
│   ├── 맑은 날 드라이브
│   └── 눈 오는 날 코지
└── 🎭 상황별
    ├── 오픈 준비 에너지
    ├── 브레이크타임 릴랙스
    └── 클로징 타임 감성
```

### 4.2 시샵 어드민 관리 화면 (기획)

- 플레이리스트 생성: 이름 / 태그 / 커버 이모지 / 큐레이터 노트 입력
- 트랙 추가: 서버 등록 트랙에서 검색 & 드래그 정렬
- 발행 조건 설정:
  - 적용 시간대 (멀티 선택)
  - 적용 날씨 조건
  - 추천 업종 (멀티 선택)
- `is_curated: true` → 앱 CuratedSection에 노출

---

## 5. 앱 UI 구조

### 5.1 뮤직탭 화면 구성

```
┌─────────────────────────────────────┐
│  🎵 음악                        🔍  │  ← 헤더
├─────────────────────────────────────┤
│  [지금 이 가게 BGM]                   │  ← 현재 가게 재생 중 섹션
│  ┌─────────────────────────────┐   │
│  │ ☕ 비 오는 화요일 오후의 달다방  │   │
│  │ lo-fi · jazz · cozy        │   │
│  │ ▶ 20곡  🤖 AI 구성           │   │
│  └─────────────────────────────┘   │
├─────────────────────────────────────┤
│  📚 시샵 큐레이션                     │  ← 수평 스크롤
│  [비오는날재즈] [모닝루틴] [카페BGM]…   │
├─────────────────────────────────────┤
│  🏪 근처 가게 BGM                    │  ← 주변 가게별 현재 재생
│  ┌─────────┐ ┌─────────┐          │
│  │ 달다방   │ │ 맛도리   │  …      │
│  │ lo-fi  │ │ upbeat  │          │
│  └─────────┘ └─────────┘          │
├─────────────────────────────────────┤
│  ❤️ 내가 좋아한 곡                   │  ← 개인 취향 피드
│  [트랙 리스트]                       │
└─────────────────────────────────────┘
```

### 5.2 트랙 재생 카드 (미니 플레이어)

```
┌─────────────────────────────────────────┐
│  🎵  비 오는 날 재즈 피아노    ▶ ❤️  ›   │
│      Miles Davis · 달다방 AI 큐레이션    │
└─────────────────────────────────────────┘
```

### 5.3 취향 등록 온보딩 플로우

```
Step 1: 좋아하는 분위기 선택 (멀티)
  ☕ 카페풍  🌙 야간감성  🎸 인디  🎷 재즈  💃 신나는  🌿 힐링

Step 2: 유튜브 연동 (선택)
  "내 유튜브 재생목록으로 취향 분석"  [Google 로그인]  [건너뛰기]

Step 3: 완료
  "취향 분석 완료! 오늘 날씨에 맞는 플레이리스트를 준비했어요 🎵"
```

---

## 6. DB 스키마 추가/변경

```sql
-- 1. 트랙 테이블 확장
ALTER TABLE music_tracks
  ADD COLUMN bpm          INT,
  ADD COLUMN energy_level TEXT,   -- 'low' | 'medium' | 'high'
  ADD COLUMN time_tags    TEXT[]; -- ['morning', 'evening'] 등

-- 2. 플레이리스트 테이블 확장 (기존 테이블)
ALTER TABLE playlists
  ADD COLUMN is_curated   BOOLEAN DEFAULT FALSE,
  ADD COLUMN is_dynamic   BOOLEAN DEFAULT FALSE,
  ADD COLUMN mood_tags    TEXT[],
  ADD COLUMN time_tags    TEXT[],    -- 적용 시간대
  ADD COLUMN weather_tags TEXT[],    -- 적용 날씨
  ADD COLUMN category_tags TEXT[],   -- 추천 업종
  ADD COLUMN curator_note TEXT,
  ADD COLUMN curated_at   TIMESTAMPTZ;

-- 3. 가게 음악 DNA
ALTER TABLE stores
  ADD COLUMN music_dna    JSONB,     -- AI 사진 분석 결과
  ADD COLUMN youtube_mood JSONB;     -- 유튜브 분석 결과

-- 4. 음악 좋아요 (신규)
CREATE TABLE music_likes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users ON DELETE CASCADE,
  track_id     UUID REFERENCES music_tracks ON DELETE CASCADE,
  store_id     UUID REFERENCES stores,
  time_of_day  TEXT,
  weather      TEXT,
  play_duration INT,
  liked_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, track_id)
);

-- 5. 사용자 음악 취향 프로필 (신규)
CREATE TABLE user_music_profiles (
  user_id        UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  preferred_moods TEXT[] DEFAULT '{}',
  avoided_moods   TEXT[] DEFAULT '{}',
  bpm_min        INT DEFAULT 70,
  bpm_max        INT DEFAULT 130,
  youtube_linked  BOOLEAN DEFAULT FALSE,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 게시글 플레이리스트 연동 (기존 store_posts)
ALTER TABLE store_posts
  ADD COLUMN linked_playlist_id UUID REFERENCES playlists;
```

---

## 7. API 연동 목록

| API | 용도 | 인증 방식 | 비용/제한 |
|---|---|---|---|
| OpenWeatherMap | 실시간 날씨 | API Key | 무료 60 calls/min |
| YouTube Data API v3 | 재생목록 분석 | OAuth 2.0 | 10,000 units/day |
| Claude Vision API | 매장 사진 분석 | API Key | 토큰 기반 과금 |
| Claude API | 무드 분석 / 이름 생성 | API Key | 토큰 기반 과금 |
| Suno API (예정) | 가게 DNA 기반 음악 생성 | API Key (대기 중) | 생성당 과금 |

---

## 8. 구현 로드맵

### Phase 1 — 기반 (2주)
- [ ] DB 스키마 마이그레이션
- [ ] `music_tracks` 태그 시스템 정비 (BPM, energy, time_tags)
- [ ] 날씨 API 연동 + 무드 매핑 함수
- [ ] 시간대 자동 감지 로직
- [ ] AI 즉석 큐레이션 엔진 (컨텍스트 합산 → 트랙 선별)

### Phase 2 — 큐레이션 (2주)
- [ ] 시샵 어드민: 플레이리스트 관리 화면
- [ ] CuratedSection UI 완성
- [ ] 플레이리스트 이름 자동 생성 (Claude API)
- [ ] 미니 플레이어 연동

### Phase 3 — 개인화 (2주)
- [ ] 음악 좋아요 시스템 + 컨텍스트 저장
- [ ] 유저 취향 온보딩 화면
- [ ] 좋아요 기반 취향 학습 알고리즘

### Phase 4 — 고급 분석 (3주)
- [ ] 매장 사진 → Claude Vision 분석 → music_dna 저장
- [ ] YouTube OAuth 연동 + 재생목록 분석
- [ ] "근처 가게 BGM" 섹션 (주변 가게 현재 재생 공유)

### Phase 5 — Suno 연동 (API 공개 후)
- [ ] 가게 DNA → Suno 스타일 프롬프트 자동 생성
- [ ] 가게 전용 AI 생성 음악 제공
- [ ] "우리 가게 테마송" 기능

---

## 9. 차별화 포인트 요약

| 기능 | 일반 BGM 앱 | 우리 서비스 |
|---|---|---|
| 플레이리스트 구성 | 사람이 직접 선택 | AI가 실시간 자동 생성 |
| 날씨 반영 | ❌ | ✅ 실시간 날씨 연동 |
| 매장 공간 분석 | ❌ | ✅ 사진 AI 분석 |
| 사장 취향 반영 | ❌ | ✅ 유튜브 재생목록 분석 |
| 가게별 차별화 | ❌ 비슷한 플레이리스트 | ✅ 가게마다 고유한 DNA |
| 고객 취향 연동 | ❌ | ✅ 좋아요·컨텍스트 학습 |
| 전문 큐레이션 | 일부 | ✅ 시샵 큐레이션 병행 |
| AI 음악 생성 | ❌ | ✅ Suno 연동 예정 |
