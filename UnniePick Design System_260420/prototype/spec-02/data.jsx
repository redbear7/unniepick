// ═══════════════════════════════════════════════════════════════
// Spec 02 · 방문 스탬프 × 단골 등급 — 더미 데이터
// seed_dummy_data.sql 기반 매장 × 스탬프 카드 확장
// ═══════════════════════════════════════════════════════════════

const USER_02 = {
  id: 'u_jiyoon',
  name: '지윤',
  lat: 35.2235,
  lng: 128.6795,
};

// 매장 (Spec 01의 매장에 스탬프 카드 정보 추가)
const STORES_02 = [
  {
    id: 's_cafe',
    name: '카페 봄날',
    emoji: '☕',
    category: 'cafe',
    categoryLabel: '카페',
    address: '창원시 의창구 상남동 198-2',
    color: '#FF6F0F',
    distance: 80,
    // 스탬프 카드 설정 (사장님이 설정)
    stampCardTitle: '봄날 단골 스탬프',
    rewardDescription: '시그니처 라떼 1잔 · 비공개 시즌 원두 구매권',
    regularsCount: 47,
    thisWeekVisits: 12,
  },
  {
    id: 's_burger',
    name: '뽀글이 수제버거',
    emoji: '🍔',
    category: 'food',
    categoryLabel: '버거/양식',
    address: '창원시 의창구 상남동 234-5',
    color: '#D55A1F',
    distance: 160,
    stampCardTitle: '뽀글이 단골 증명',
    rewardDescription: '히든 메뉴 ‘치즈 폭포 버거’ · 감자튀김 사이즈업',
    regularsCount: 23,
    thisWeekVisits: 8,
  },
  {
    id: 's_nail',
    name: '네일룸 하루',
    emoji: '💅',
    category: 'nail',
    categoryLabel: '네일',
    address: '창원시 의창구 상남동 256-1',
    color: '#D946B0',
    distance: 220,
    stampCardTitle: '하루 단골 라운지',
    rewardDescription: '단골 전용 5분 케어 · 우선 예약 · 신메뉴 베타',
    regularsCount: 18,
    thisWeekVisits: 5,
  },
  {
    id: 's_beauty',
    name: '미용실 언니',
    emoji: '✂️',
    category: 'beauty',
    categoryLabel: '미용',
    address: '창원시 의창구 상남동 201-3',
    color: '#7B61FF',
    distance: 190,
    stampCardTitle: '언니 단골 카드',
    rewardDescription: '컷 + 트리트먼트 30% · 신메뉴 먼저 체험',
    regularsCount: 32,
    thisWeekVisits: 9,
  },
  {
    id: 's_bake',
    name: '상남 베이커리',
    emoji: '🥐',
    category: 'cafe',
    categoryLabel: '베이커리',
    address: '창원시 의창구 상남동 310-4',
    color: '#E8A947',
    distance: 140,
    stampCardTitle: '상남 베이커리 단골',
    rewardDescription: '오늘의 시그니처 디저트 1개 · 당일 빵 10% 할인',
    regularsCount: 54,
    thisWeekVisits: 14,
  },
];

// 유저의 스탬프 카드 — 매장별 진행 상황
const STAMP_CARDS = [
  // 카페 봄날 — 단골 달성 직전 (9/10)
  {
    storeId: 's_cafe',
    stamps: 9,
    tier: 'frequent', // new | frequent | regular
    tierLabel: '자주감',
    firstVisit: '2026-02-14',
    lastVisit: '2026-04-18',
    unlockedRewards: [],
  },
  // 뽀글이 — 단골 달성 완료 (10/10)
  {
    storeId: 's_burger',
    stamps: 10,
    tier: 'regular',
    tierLabel: '단골',
    firstVisit: '2026-01-08',
    lastVisit: '2026-04-16',
    unlockedRewards: ['히든 메뉴 치즈 폭포 버거', '감자튀김 사이즈업 무료'],
  },
  // 네일룸 하루 — 진행 중 (4/10)
  {
    storeId: 's_nail',
    stamps: 4,
    tier: 'new',
    tierLabel: '첫방문',
    firstVisit: '2026-03-02',
    lastVisit: '2026-04-12',
    unlockedRewards: [],
  },
  // 미용실 언니 — 진행 중 (6/10)
  {
    storeId: 's_beauty',
    stamps: 6,
    tier: 'frequent',
    tierLabel: '자주감',
    firstVisit: '2026-02-28',
    lastVisit: '2026-04-10',
    unlockedRewards: [],
  },
  // 상남 베이커리 — 새로 시작 (1/10)
  {
    storeId: 's_bake',
    stamps: 1,
    tier: 'new',
    tierLabel: '첫방문',
    firstVisit: '2026-04-15',
    lastVisit: '2026-04-15',
    unlockedRewards: [],
  },
];

// 시크릿 쿠폰 — 단골만 보임
const SECRET_COUPONS = [
  {
    id: 'sc1',
    storeId: 's_burger',
    title: '히든 메뉴 치즈 폭포 버거 30% OFF',
    kindLabel: '시크릿',
    locked: false, // 이미 단골이라 해금됨
    expiresAt: '2026-05-20',
    daysLeft: 30,
    conditions: '주문 시 "단골이에요"라고 말하기',
  },
  {
    id: 'sc2',
    storeId: 's_cafe',
    title: '시그니처 라떼 무료',
    kindLabel: '시크릿',
    locked: true, // 아직 잠김 (9/10)
    requiredTier: 'regular',
    expiresAt: '2026-05-30',
    daysLeft: 40,
    conditions: '단골 등급 달성 후 7일 내 사용',
  },
  {
    id: 'sc3',
    storeId: 's_nail',
    title: '신메뉴 베타 체험권',
    kindLabel: '시크릿',
    locked: true,
    requiredTier: 'regular',
    expiresAt: '2026-05-30',
    daysLeft: 40,
    conditions: '예약 시 자동 적용',
  },
];

// 사장님 앱 용 — 이 매장의 단골 손님 리스트
const REGULARS_AT_BURGER = [
  { id: 'r1', name: '지윤', emoji: '🌸', tier: '단골', visits: 10, lastVisit: '2시간 전', justScanned: false },
  { id: 'r2', name: '수민', emoji: '🌼', tier: '단골', visits: 14, lastVisit: '어제', justScanned: false },
  { id: 'r3', name: '소연', emoji: '🌻', tier: '단골', visits: 11, lastVisit: '지금 ✨', justScanned: true },
  { id: 'r4', name: '주현', emoji: '🌺', tier: '자주감', visits: 7, lastVisit: '3일 전', justScanned: false },
  { id: 'r5', name: '민지', emoji: '🌷', tier: '자주감', visits: 5, lastVisit: '5일 전', justScanned: false },
  { id: 'r6', name: '예린', emoji: '🌹', tier: '단골', visits: 12, lastVisit: '1주 전', justScanned: false },
];

// 헬퍼 함수들
function findStore02(id) {
  return STORES_02.find(s => s.id === id);
}

function getStampCard(storeId) {
  return STAMP_CARDS.find(c => c.storeId === storeId);
}

function getSecretCoupons(storeId) {
  return SECRET_COUPONS.filter(c => c.storeId === storeId);
}

function tierInfo(tier) {
  const map = {
    new: { label: '첫방문', color: '#8B95A1', glyph: '🌱', min: 1 },
    frequent: { label: '자주감', color: '#FF9A3D', glyph: '⭐', min: 5 },
    regular: { label: '단골', color: '#FF6F0F', glyph: '👑', min: 10 },
  };
  return map[tier] || map.new;
}

function tierForStamps(n) {
  if (n >= 10) return 'regular';
  if (n >= 5) return 'frequent';
  return 'new';
}

// 전체 단골인 매장 수
function regularsTotalCount() {
  return STAMP_CARDS.filter(c => c.tier === 'regular').length;
}

Object.assign(window, {
  USER_02, STORES_02, STAMP_CARDS, SECRET_COUPONS, REGULARS_AT_BURGER,
  findStore02, getStampCard, getSecretCoupons, tierInfo, tierForStamps, regularsTotalCount,
});
