export interface Store {
  id: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  rating: number;
  reviewCount: number;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
  hasActiveCoupon: boolean;
  hasTimeSale: boolean;
  timeSaleEndsAt?: string;
  description: string;
  emoji: string;
  districtName?: string;
}

// 테스트 가맹점 데이터 (창원 상남동 / 봉곡동)
export const TEST_STORES: Store[] = [
  {
    id: 'store_001',
    name: '상남동 고깃집',
    category: '고깃집',
    address: '경남 창원시 의창구 상남동 123',
    phone: '055-1234-5678',
    latitude: 35.2241,
    longitude: 128.6824,
    rating: 4.8,
    reviewCount: 342,
    openTime: '11:30',
    closeTime: '22:00',
    isOpen: true,
    hasActiveCoupon: true,
    hasTimeSale: true,
    timeSaleEndsAt: '18:00',
    description: '인스타 팔로워 전용 혜택 제공!',
    emoji: '🍖',
    districtName: '상남동',
  },
  {
    id: 'store_002',
    name: '상남동 한식당',
    category: '한식',
    address: '경남 창원시 의창구 상남동 45',
    phone: '055-2345-6789',
    latitude: 35.2228,
    longitude: 128.6808,
    rating: 4.5,
    reviewCount: 187,
    openTime: '11:00',
    closeTime: '21:30',
    isOpen: true,
    hasActiveCoupon: true,
    hasTimeSale: false,
    description: '런치 특선 매일 운영!',
    emoji: '🥘',
    districtName: '상남동',
  },
  {
    id: 'store_003',
    name: '상남동 카페',
    category: '카페',
    address: '경남 창원시 의창구 상남동 78',
    phone: '055-3456-7890',
    latitude: 35.2250,
    longitude: 128.6835,
    rating: 4.6,
    reviewCount: 521,
    openTime: '09:00',
    closeTime: '23:00',
    isOpen: true,
    hasActiveCoupon: false,
    hasTimeSale: true,
    timeSaleEndsAt: '15:00',
    description: '시그니처 음료 타임세일 진행 중!',
    emoji: '☕',
    districtName: '상남동',
  },
  {
    id: 'store_004',
    name: '봉곡동 분식',
    category: '분식',
    address: '경남 창원시 의창구 봉곡동 22',
    phone: '055-4567-8901',
    latitude: 35.2461,
    longitude: 128.6518,
    rating: 4.3,
    reviewCount: 98,
    openTime: '10:00',
    closeTime: '20:00',
    isOpen: false,
    hasActiveCoupon: false,
    hasTimeSale: false,
    description: '수제 떡볶이 전문점',
    emoji: '🍢',
    districtName: '봉곡동',
  },
  {
    id: 'store_005',
    name: '봉곡동 치킨',
    category: '치킨',
    address: '경남 창원시 의창구 봉곡동 56',
    phone: '055-5678-9012',
    latitude: 35.2448,
    longitude: 128.6505,
    rating: 4.7,
    reviewCount: 210,
    openTime: '16:00',
    closeTime: '24:00',
    isOpen: true,
    hasActiveCoupon: true,
    hasTimeSale: false,
    description: '바삭한 수제 치킨 맛집!',
    emoji: '🍗',
    districtName: '봉곡동',
  },
];
