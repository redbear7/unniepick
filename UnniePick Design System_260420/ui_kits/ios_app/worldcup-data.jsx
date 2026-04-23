// WorldCup game data — 창원 로컬 맛집 16개 + 8가지 상황
// 이미지는 placeholder gradient + 음식 이모지 (실제 사진 없음)

const SITUATIONS = [
  { key: 'solo_lunch', emoji: '🍜', title: '혼자 조용히 점심', hint: '1인석 · 빠른 식사' },
  { key: 'date_night', emoji: '🕯️', title: '분위기 있는 데이트', hint: '무드 · 와인' },
  { key: 'late_snack', emoji: '🌙', title: '야근 후 야식', hint: '든든 · 배달 가능' },
  { key: 'family', emoji: '👨‍👩‍👧', title: '가족 외식', hint: '넓은 공간 · 주차' },
  { key: 'with_friends', emoji: '🍻', title: '친구들이랑 한잔', hint: '안주 · 시끌벅적' },
  { key: 'healthy', emoji: '🥗', title: '가볍고 건강하게', hint: '샐러드 · 저칼로리' },
  { key: 'rainy', emoji: '🌧️', title: '비 오는 날 뜨끈하게', hint: '국물 · 찜' },
  { key: 'special', emoji: '🎂', title: '오늘은 특별한 날', hint: '코스 · 예약제' },
];

// 16개 창원 맛집 (가상 데이터 · 실제 상호명 아님)
const WORLDCUP_STORES = [
  { id: 1,  name: '창원돼지국밥', cat: '국밥',   rating: 4.7, district: '의창구', grad: ['#8B4513','#D2691E'], emoji: '🍜' },
  { id: 2,  name: '가로수 파스타', cat: '양식',   rating: 4.6, district: '성산구', grad: ['#C2185B','#E91E63'], emoji: '🍝' },
  { id: 3,  name: '상남동 야장',   cat: '주점',   rating: 4.5, district: '성산구', grad: ['#5D4037','#795548'], emoji: '🍻' },
  { id: 4,  name: '해양공원횟집', cat: '회·해산물', rating: 4.8, district: '진해구', grad: ['#006064','#00ACC1'], emoji: '🐟' },
  { id: 5,  name: '진해벚꽃카페', cat: '카페',   rating: 4.4, district: '진해구', grad: ['#F8BBD0','#F06292'], emoji: '☕' },
  { id: 6,  name: '용호동 곱창',   cat: '곱창',   rating: 4.7, district: '의창구', grad: ['#BF360C','#FF5722'], emoji: '🔥' },
  { id: 7,  name: '명곡동 피자집', cat: '피자',   rating: 4.5, district: '의창구', grad: ['#E65100','#FFA726'], emoji: '🍕' },
  { id: 8,  name: '반송동 쌀국수', cat: '아시안', rating: 4.6, district: '성산구', grad: ['#2E7D32','#66BB6A'], emoji: '🍲' },
  { id: 9,  name: '중앙동 족발',   cat: '족발·보쌈', rating: 4.7, district: '성산구', grad: ['#4E342E','#8D6E63'], emoji: '🐖' },
  { id: 10, name: '마산어묵',     cat: '분식',   rating: 4.3, district: '마산합포', grad: ['#E64A19','#FF7043'], emoji: '🍢' },
  { id: 11, name: '팔용동 삼겹살', cat: '고기',   rating: 4.8, district: '의창구', grad: ['#880E4F','#EC407A'], emoji: '🥩' },
  { id: 12, name: '봉곡동 비건', cat: '샐러드', rating: 4.4, district: '성산구', grad: ['#1B5E20','#81C784'], emoji: '🥗' },
  { id: 13, name: '양덕동 초밥',   cat: '일식',   rating: 4.6, district: '마산회원', grad: ['#0D47A1','#42A5F5'], emoji: '🍣' },
  { id: 14, name: '석전동 떡볶이', cat: '분식',   rating: 4.5, district: '마산회원', grad: ['#BF360C','#F4511E'], emoji: '🌶️' },
  { id: 15, name: '내서읍 닭강정', cat: '치킨',   rating: 4.7, district: '마산회원', grad: ['#F57F17','#FFD54F'], emoji: '🍗' },
  { id: 16, name: '귀곡동 브런치', cat: '브런치', rating: 4.5, district: '진해구', grad: ['#6A1B9A','#BA68C8'], emoji: '🥐' },
];

// Helper: shuffle into bracket pairs
function makeBracket(stores) {
  const arr = [...stores];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

Object.assign(window, { SITUATIONS, WORLDCUP_STORES, makeBracket });
