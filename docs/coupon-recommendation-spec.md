# 🎟 쿠폰 추천 알고리즘 기획서 v1.0

> **핵심 철학**: 접속할 때마다 사용자의 지금 상황(위치·시간·날씨·행동 패턴)을 읽어,
> 지금 당장 사용할 가능성이 가장 높은 쿠폰을 먼저 보여준다.

---

## 1. 문제 정의

| 현재 문제 | 목표 상태 |
|---|---|
| 모든 사용자에게 동일한 쿠폰 피드 노출 | 사용자마다 다른 개인화 피드 |
| 만료 임박·거리 먼 쿠폰이 상단 노출 | 지금 쓸 수 있는 쿠폰 최우선 |
| 취향과 무관한 쿠폰 추천 | 과거 행동·선호 업종 기반 추천 |
| 날씨·시간대 무시 | 비 오는 날엔 카페 쿠폰, 점심엔 음식점 쿠폰 |

---

## 2. 취향 분석 데이터 소스 (7가지)

### 2.1 실시간 위치 (가장 강력한 신호)

```
현재 위치 ──→ 반경 N km 내 가게 필터링
              └─ 거리 가중치: 200m 이내 ★★★, ~500m ★★, ~1km ★, ~3km ○
```

- 앱 실행 시 `expo-location`으로 현재 좌표 수집
- 쿠폰의 가게 위치와 Haversine 거리 계산
- **거리가 가까울수록 점수 대폭 가산**

---

### 2.2 시간대 (자동 감지)

| 시간대 | 추천 업종 | 추천 쿠폰 종류 |
|---|---|---|
| 07~10시 (아침) | 카페, 베이커리 | 음료 할인, 아침식사 |
| 11~14시 (점심) | 음식점, 분식 | 점심 세트, 식사 할인 |
| 14~17시 (오후) | 카페, 디저트 | 음료 1+1, 케이크 |
| 17~21시 (저녁) | 음식점, 술집 | 저녁 식사, 치킨 |
| 21~24시 (야간) | 편의점, 야식 | 야식 할인, 소주 |
| 주말 전일 | 뷰티, 레저 | 헤어, 네일, 마사지 |

---

### 2.3 날씨 (OpenWeatherMap API)

| 날씨 | 추천 업종/쿠폰 | 기피 |
|---|---|---|
| 비 | 카페, 실내 식당, 편의점 우산 | 야외 활동, 세차 |
| 더위 (30°C+) | 빙수, 아이스크림, 냉면 | 뜨거운 음식 |
| 추위 | 핫초코, 국물류, 실내 뷰티 | 아이스 음료 |
| 맑음 | 야외 카페, 산책 코스 카페 | 배달 쿠폰 |
| 눈 | 실내 카페, 핫도그, 붕어빵 | 멀리 있는 가게 |

---

### 2.4 쿠폰 클릭·저장·사용 이력

```typescript
// 행동 신호 가중치
const ACTION_WEIGHTS = {
  used:    5.0,  // 실제 사용 (가장 강한 신호)
  saved:   3.0,  // 저장(픽)
  clicked: 1.5,  // 클릭
  viewed:  0.5,  // 노출 (스크롤로 지나침)
};
```

- 같은 업종 쿠폰에 지속적으로 반응 → 해당 업종 점수 상승
- 사용하지 않고 만료된 쿠폰 업종 → 점수 하락

---

### 2.5 즐겨찾기 가게 (favorites 테이블)

- 즐겨찾기한 가게의 쿠폰 → 점수 +2.0 보너스
- 즐겨찾기 가게 새 쿠폰 발행 시 → 푸시 알림 + 피드 상단 고정

---

### 2.6 음악 취향과의 연계 (크로스 시그널)

```
음악 무드 태그 → 연관 업종 추천
───────────────────────────────
lo-fi / cozy / acoustic  →  카페 쿠폰 ↑
energetic / EDM           →  헬스장·스포츠 쿠폰 ↑
jazz / lounge             →  바·레스토랑 쿠폰 ↑
k-pop / trendy            →  뷰티·패션 쿠폰 ↑
```

- 음악 탭에서 좋아요 누른 트랙의 무드 → 쿠폰 추천에도 반영
- "이 분위기 좋아하시죠? 어울리는 카페 쿠폰이에요"

---

### 2.7 구매력 신호 (스탬프·포인트 보유량)

| 상황 | 추천 전략 |
|---|---|
| 포인트 많음 (5,000P+) | 프리미엄 쿠폰 / 고가 할인 쿠폰 |
| 포인트 소액 | 소액 할인 / 무료 제공 쿠폰 |
| 스탬프 n-1개 (완성 직전) | 해당 가게 쿠폰 최상단 고정 |
| 쿠폰 만료 3일 전 | 해당 쿠폰 다시 상단 노출 |

---

## 3. 추천 점수 계산 알고리즘

### 3.1 쿠폰별 최종 점수 공식

```typescript
interface CouponScore {
  couponId:    string;
  baseScore:   number;   // 기본 품질 점수
  distScore:   number;   // 거리 점수
  timeScore:   number;   // 시간대 적합도
  weatherScore:number;   // 날씨 적합도
  prefScore:   number;   // 취향 적합도
  urgencyScore:number;   // 긴급성 (만료 임박, 잔여 적음)
  freshScore:  number;   // 신선도 (최근 발행)
  totalScore:  number;
}

function calcTotalScore(s: CouponScore): number {
  return (
    s.distScore    * 2.5 +  // 거리 (가장 중요)
    s.timeScore    * 2.0 +  // 시간대 적합
    s.weatherScore * 1.5 +  // 날씨 적합
    s.prefScore    * 1.5 +  // 사용자 선호
    s.urgencyScore * 1.2 +  // 긴급성
    s.freshScore   * 1.0    // 신선도
  );
}
```

### 3.2 거리 점수 계산

```typescript
function calcDistScore(distM: number): number {
  if (distM < 200)   return 10.0;
  if (distM < 500)   return 8.0;
  if (distM < 1000)  return 6.0;
  if (distM < 2000)  return 4.0;
  if (distM < 3000)  return 2.0;
  return 1.0;  // 3km 이상은 기본 점수만
}
```

### 3.3 긴급성 점수

```typescript
function calcUrgencyScore(coupon: CouponRow): number {
  let score = 0;
  // 만료 임박
  if (coupon.expires_at) {
    const daysLeft = (new Date(coupon.expires_at).getTime() - Date.now()) / 86400_000;
    if (daysLeft < 1)  score += 3.0;  // 오늘 만료
    if (daysLeft < 3)  score += 2.0;  // 3일 이내
    if (daysLeft < 7)  score += 1.0;  // 일주일 이내
  }
  // 잔여 수량 부족
  if (coupon.total_quantity != null) {
    const remaining = coupon.total_quantity - (coupon.issued_count ?? 0);
    const ratio = remaining / coupon.total_quantity;
    if (ratio < 0.1)   score += 3.0;  // 10% 미만 남음
    if (ratio < 0.2)   score += 1.5;
  }
  return score;
}
```

---

## 4. 추천 피드 구성

### 4.1 홈 화면 쿠폰 추천 섹션 레이아웃

```
┌─────────────────────────────────────────┐
│  📍 지금 내 근처 쿠폰                     │  ← 거리 기반
│  [달다방 10% ↓] [맛도리 1+1] [네일 20%]   │  수평 스크롤
├─────────────────────────────────────────┤
│  ⏰ 점심 시간 특별 쿠폰                   │  ← 시간대 기반
│  [불고기 점심 세트] [파스타 할인]…         │
├─────────────────────────────────────────┤
│  🌧 비 오는 날 추천                      │  ← 날씨 기반
│  [실내 카페 쿠폰] [우산 무료] …           │
├─────────────────────────────────────────┤
│  ❤️ 취향 기반 추천                       │  ← 개인화
│  "lo-fi 좋아하시죠? 근처 카페 쿠폰"       │
│  [달다방] [브루클린커피] …                │
├─────────────────────────────────────────┤
│  ⭐ 즐겨찾기 가게 쿠폰                    │  ← favorites
│  [새 쿠폰 발행!] [만료 3일 전 알림]        │
└─────────────────────────────────────────┘
```

### 4.2 쿠폰 카드에 추천 이유 표시

```
┌──────────────────────────────┐
│ ☕ 달다방                     │
│ 아메리카노 10% 할인           │
│ 📍 150m · ⏰ 오늘 마감        │
│ 💡 "비 오는 날 카페 추천"      │  ← 추천 이유
└──────────────────────────────┘
```

---

## 5. DB 추가 스키마

```sql
-- 쿠폰 노출/클릭 행동 기록 (추천 학습용)
CREATE TABLE coupon_interactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users ON DELETE CASCADE,
  coupon_id    UUID REFERENCES coupons(id) ON DELETE CASCADE,
  action       TEXT NOT NULL CHECK (action IN ('view','click','save','use','dismiss')),
  context_time TEXT,      -- 'morning' | 'afternoon' | 'evening' | 'night'
  context_weather TEXT,   -- 'sunny' | 'rainy' | ...
  dist_m       INT,       -- 노출 시점의 거리(m)
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 사용자 업종 선호도 (누적 계산)
CREATE TABLE user_category_preferences (
  user_id    UUID REFERENCES auth.users ON DELETE CASCADE,
  category   TEXT NOT NULL,
  score      FLOAT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, category)
);

-- RLS
ALTER TABLE coupon_interactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_category_preferences  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_interactions"  ON coupon_interactions       FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_preferences"   ON user_category_preferences FOR ALL USING (auth.uid() = user_id);
```

---

## 6. 추천 엔진 서비스 함수 (couponRecommendService.ts)

```typescript
// 핵심 함수 시그니처

// 접속 시 개인화 쿠폰 추천 (메인 엔트리)
async function fetchRecommendedCoupons(params: {
  userId:      string | null;
  lat:         number;
  lng:         number;
  limit?:      number;    // default 20
}): Promise<ScoredCoupon[]>

// 섹션별 추천 (홈 화면용)
async function fetchCouponSections(params: {
  userId: string | null;
  lat:    number;
  lng:    number;
}): Promise<{
  nearby:     CouponRow[];  // 거리 기반
  timeMatch:  CouponRow[];  // 시간대 매칭
  weather:    CouponRow[];  // 날씨 매칭
  personal:   CouponRow[];  // 취향 기반
  favorites:  CouponRow[];  // 즐겨찾기 가게
}>

// 행동 로깅 (추천 학습)
async function logCouponInteraction(
  userId: string,
  couponId: string,
  action: 'view' | 'click' | 'save' | 'use' | 'dismiss',
  ctx: { lat?: number; lng?: number }
): Promise<void>
```

---

## 7. 개인정보·투명성

- 추천 이유를 카드에 항상 노출 ("비 오는 날 카페 추천", "150m 거리", "즐겨찾기 가게")
- 마이페이지 → "추천 설정" 에서 각 신호 on/off 가능
  - 위치 기반 추천 on/off
  - 음악 취향 연계 on/off
  - 행동 이력 학습 on/off
- 수집 데이터는 추천 목적으로만 사용, 제3자 제공 없음

---

## 8. 구현 로드맵

### Phase 1 — 위치+시간+날씨 기반 (1주)
- [ ] `couponRecommendService.ts` 기본 구현
- [ ] 거리 점수 + 시간대 점수 + 날씨 점수 계산
- [ ] 홈 화면 쿠폰 섹션 UI (Near Me / 지금 이 시간)

### Phase 2 — 행동 학습 (1주)
- [ ] `coupon_interactions` 테이블 마이그레이션
- [ ] 클릭/노출/저장 이벤트 로깅
- [ ] 업종 선호도 점수 누적 계산

### Phase 3 — 음악 취향 연계 (1주)
- [ ] 뮤직 무드 태그 → 업종 매핑 테이블
- [ ] 음악 좋아요 기반 쿠폰 점수 반영
- [ ] "취향 기반 추천" 섹션 UI

### Phase 4 — 스탬프·포인트 연계 (3일)
- [ ] 스탬프 완성 임박 가게 쿠폰 상단 고정
- [ ] 만료 임박 쿠폰 재알림 로직
