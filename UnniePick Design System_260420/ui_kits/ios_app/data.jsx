// Sample data for the UI kit demo

const SAMPLE_POSTS = [
  {
    id: 'p1', store: '카페봄날', emoji: '☕', category: '☕ 카페', time: '방금',
    following: true, likes: 47, comments: 12,
    body: '⚡ 오늘 오후 2-5시 아메리카노 1+1 쿠폰 발급 중이에요! 날씨가 좋아서 테이크아웃 손님이 많을 것 같아요 ☀️',
    coupon: { title: '아메리카노 1+1', badge: '오늘만', meta: '📅 D-0 · 🔥 잔여 12장', saved: false }
  },
  {
    id: 'p2', store: '미용실언니', emoji: '✂️', category: '💇 미용', time: '3시간 전',
    following: true, likes: 28, comments: 5,
    body: '이번 주 컷트+염색 동시 예약하시면 20% 할인됩니다! 선착순 10명 한정이에요 🎨',
    coupon: { title: '컷트+염색 20% 할인', badge: '인기', meta: '📅 D-3 · 🔥 잔여 4장', saved: false }
  },
  {
    id: 'p3', store: '네일룸', emoji: '💅', category: '💅 네일', time: '어제',
    following: false, likes: 102, comments: 34,
    body: '단골 고객 감사 이벤트! 젤네일 기본 30% 할인 쿠폰 드려요. 팔로우하고 받아가세요 🙏',
    coupon: { title: '젤네일 기본 30% 할인', badge: 'NEW', meta: '📅 D-7 · 잔여 25장', saved: false }
  },
  {
    id: 'p4', store: '분식집', emoji: '🍜', category: '🍜 음식', time: '어제',
    following: true, likes: 19, comments: 3,
    body: '점심시간 라면+김밥 세트 1,000원 할인해드려요. 평일 11:30~14:00만 해당됩니다!',
    coupon: { title: '라면+김밥 세트 1,000원 할인', badge: 'NEW', meta: '📅 D-14 · 무제한', saved: true }
  },
];

const SAMPLE_WALLET = [
  { id: 'w1', store: '카페봄날', title: '아메리카노 1+1', expiryDate: '4월 25일', daysLeft: 0, expiryPct: 95, status: 'active' },
  { id: 'w2', store: '미용실언니', title: '컷트+염색 20% 할인', expiryDate: '4월 28일', daysLeft: 3, expiryPct: 60, status: 'active' },
  { id: 'w3', store: '분식집', title: '라면+김밥 세트 1,000원 할인', expiryDate: '5월 2일', daysLeft: 14, expiryPct: 30, status: 'active' },
  { id: 'w4', store: '편의점', title: '전 품목 10% 할인', expiryDate: '4월 10일', daysLeft: -8, expiryPct: 100, status: 'used' },
];

const SAMPLE_STORES = [
  { id: 's1', name: '카페봄날', emoji: '☕', category: '☕ 카페', distance: 120, followers: 1230, activeCoupons: 3, following: true, hot: true },
  { id: 's2', name: '미용실언니', emoji: '✂️', category: '💇 미용', distance: 340, followers: 880, activeCoupons: 1, following: true },
  { id: 's3', name: '네일룸', emoji: '💅', category: '💅 네일', distance: 520, followers: 642, activeCoupons: 2, following: false },
  { id: 's4', name: '분식집', emoji: '🍜', category: '🍜 음식', distance: 180, followers: 2103, activeCoupons: 2, following: true, hot: true },
  { id: 's5', name: '편의점24', emoji: '🏪', category: '🏪 편의점', distance: 80, followers: 340, activeCoupons: 1, following: false },
  { id: 's6', name: '치킨공장', emoji: '🍗', category: '🍜 음식', distance: 760, followers: 1580, activeCoupons: 0, following: false },
  { id: 's7', name: '서점봄', emoji: '📚', category: '📚 기타', distance: 910, followers: 215, activeCoupons: 1, following: false },
  { id: 's8', name: '빵집굽는언니', emoji: '🥐', category: '🍜 음식', distance: 430, followers: 1842, activeCoupons: 4, following: true, hot: true },
];

Object.assign(window, { SAMPLE_POSTS, SAMPLE_WALLET, SAMPLE_STORES });
