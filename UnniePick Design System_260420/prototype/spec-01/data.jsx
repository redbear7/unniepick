// ═══════════════════════════════════════════════════════════════
// Spec 01 · Wallet Auto-Discovery — 더미 데이터
// unniepick/supabase/seed_dummy_data.sql 기반 + 확장
// ═══════════════════════════════════════════════════════════════

const USER = {
  id: 'u_minjee',
  name: '민지',
  // 상남동 한가운데에 있다고 가정 (스타트 좌표)
  lat: 35.2235,
  lng: 128.6795,
};

// 창원 상남동 + 봉곡동 기반 매장 데이터
// 좌표는 대략적인 실제 위치 (seed SQL 기반)
const STORES = [
  {
    id: 's_burger',
    name: '뽀글이 수제버거',
    emoji: '🍔',
    category: 'food',
    categoryLabel: '버거/양식',
    address: '창원시 의창구 상남동 234-5',
    lat: 35.2221, lng: 128.6808,
    // 민지로부터 대략 160m
    distance: 160,
    rating: 4.7,
    reviewCount: 182,
    isOpen: true,
    openTime: '11:00', closeTime: '21:00',
    district: '상남동',
    color: '#D55A1F',
  },
  {
    id: 's_kalguksu',
    name: '봉곡 손칼국수',
    emoji: '🍜',
    category: 'food',
    categoryLabel: '한식',
    address: '창원시 의창구 봉곡동 112-3',
    lat: 35.2462, lng: 128.6501,
    distance: 2840,
    rating: 4.5,
    reviewCount: 267,
    isOpen: true,
    openTime: '10:30', closeTime: '20:00',
    district: '봉곡동',
    color: '#C57617',
  },
  {
    id: 's_cafe',
    name: '카페 봄날',
    emoji: '☕',
    category: 'cafe',
    categoryLabel: '카페',
    address: '창원시 의창구 상남동 198-2',
    lat: 35.2240, lng: 128.6801,
    distance: 80,
    rating: 4.8,
    reviewCount: 412,
    isOpen: true,
    openTime: '08:00', closeTime: '22:00',
    district: '상남동',
    color: '#FF6F0F',
  },
  {
    id: 's_nail',
    name: '네일룸 하루',
    emoji: '💅',
    category: 'nail',
    categoryLabel: '네일',
    address: '창원시 의창구 상남동 256-1',
    lat: 35.2228, lng: 128.6787,
    distance: 220,
    rating: 4.6,
    reviewCount: 94,
    isOpen: true,
    openTime: '10:00', closeTime: '21:00',
    district: '상남동',
    color: '#D946B0',
  },
  {
    id: 's_beauty',
    name: '미용실 언니',
    emoji: '✂️',
    category: 'beauty',
    categoryLabel: '미용',
    address: '창원시 의창구 상남동 201-3',
    lat: 35.2242, lng: 128.6815,
    distance: 190,
    rating: 4.4,
    reviewCount: 156,
    isOpen: true,
    openTime: '10:00', closeTime: '20:00',
    district: '상남동',
    color: '#7B61FF',
  },
];

// 민지가 "지갑에 담아둔" 쿠폰 (user_coupons join)
const WALLET = [
  {
    id: 'wc1',
    storeId: 's_cafe',
    title: '아메리카노 1+1',
    kind: 'timesale',
    kindLabel: '타임세일',
    discountType: 'percent',
    discountValue: 100,
    savedAt: '2026-04-15',
    expiresAt: '2026-04-25',
    daysLeft: 5,
    conditions: '오후 2시~5시 방문 시',
    // Live Activity 트리거 여부
    isNearby: true,
  },
  {
    id: 'wc2',
    storeId: 's_burger',
    title: '스매시버거 30% 타임세일',
    kind: 'timesale',
    kindLabel: '타임세일',
    discountType: 'percent',
    discountValue: 30,
    savedAt: '2026-04-10',
    expiresAt: '2026-06-30',
    daysLeft: 71,
    conditions: '매일 오후 3시~5시 한정',
    isNearby: true,
  },
  {
    id: 'wc3',
    storeId: 's_burger',
    title: '버거 세트 음료 무료 서비스',
    kind: 'service',
    kindLabel: '서비스',
    discountType: 'amount',
    discountValue: 0,
    savedAt: '2026-04-12',
    expiresAt: '2026-12-31',
    daysLeft: 255,
    conditions: '버거+감자튀김 세트 주문 시',
    isNearby: true,
  },
  {
    id: 'wc4',
    storeId: 's_nail',
    title: '젤네일 기본 30% 할인',
    kind: 'regular',
    kindLabel: '할인',
    discountType: 'percent',
    discountValue: 30,
    savedAt: '2026-04-01',
    expiresAt: '2026-04-30',
    daysLeft: 10,
    conditions: '첫 방문 고객 한정',
    isNearby: true,
  },
  {
    id: 'wc5',
    storeId: 's_kalguksu',
    title: '칼국수 2인 세트 5,000원 할인',
    kind: 'regular',
    kindLabel: '할인',
    discountType: 'amount',
    discountValue: 5000,
    savedAt: '2026-03-28',
    expiresAt: '2026-12-31',
    daysLeft: 255,
    conditions: '칼국수 2그릇 + 군만두 1접시 세트',
    isNearby: false, // 봉곡동이라 반경 밖
  },
  {
    id: 'wc6',
    storeId: 's_beauty',
    title: '컷 + 염색 20% 할인',
    kind: 'regular',
    kindLabel: '할인',
    discountType: 'percent',
    discountValue: 20,
    savedAt: '2026-04-05',
    expiresAt: '2026-04-22',
    daysLeft: 2,
    conditions: '선착순 10명, 이번주 한정',
    isNearby: true,
  },
];

// 매장 ID로 매장 찾기
function findStore(id) {
  return STORES.find(s => s.id === id);
}

// 특정 매장의 쿠폰들
function walletByStore(storeId) {
  return WALLET.filter(c => c.storeId === storeId);
}

// 반경 내 매장 (walletNearby)
function nearbyStoresWithCoupons(radius = 300) {
  const storeIds = [...new Set(WALLET.filter(c => c.isNearby && findStore(c.storeId).distance <= radius).map(c => c.storeId))];
  return storeIds.map(id => ({
    store: findStore(id),
    coupons: walletByStore(id).filter(c => c.isNearby),
  })).sort((a, b) => a.store.distance - b.store.distance);
}

// Live Activity에 보여줄 "지금 발견된" 쿠폰 1순위
// 우선순위: (1) 가까운 거리, (2) 만료 임박, (3) 최근 저장
function primaryNearbyCoupon(radius = 100) {
  const cands = WALLET
    .filter(c => c.isNearby)
    .map(c => ({ c, s: findStore(c.storeId) }))
    .filter(x => x.s.distance <= radius)
    .sort((a, b) => {
      if (a.c.daysLeft !== b.c.daysLeft) return a.c.daysLeft - b.c.daysLeft;
      return a.s.distance - b.s.distance;
    });
  return cands[0] || null;
}

function discountText(coupon) {
  if (coupon.discountType === 'percent') return `${coupon.discountValue}% 할인`;
  if (coupon.discountType === 'amount') return `${coupon.discountValue.toLocaleString()}원 할인`;
  return '';
}

Object.assign(window, {
  USER, STORES, WALLET,
  findStore, walletByStore, nearbyStoresWithCoupons, primaryNearbyCoupon,
  discountText,
});
