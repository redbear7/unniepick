// menuConfig.ts — MY 탭 12개 메뉴 상수
// 핸드오프 Section 02 완전 반영

export type BadgeType = 'count' | 'new' | null;

export interface MenuItem {
  icon:    string;
  label:   string;
  subKey?: string;   // 동적 서브텍스트 키 (useMySummary 값 참조)
  staticSub?: string | null;
  route:   string;
  badge?:  BadgeType;
  disabled?: boolean;
}

export interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export const MENU_GROUPS: MenuGroup[] = [
  {
    title: '활동',
    items: [
      {
        icon:      '🧾',
        label:     '영수증 리뷰',
        staticSub: '방문 후기 작성 · 포인트 지급',
        route:     'ReceiptReview',
        badge:     'new',
      },
      {
        icon:    '🎟',
        label:   '내 쿠폰함',
        subKey:  'wallet',        // "보유 N · 사용임박 M"
        route:   'Wallet',
        badge:   'count',
      },
      {
        icon:    '❤️',
        label:   '팔로잉 가게',
        subKey:  'following',     // "N곳"
        route:   'MyFollowing',
      },
      {
        icon:    '⭐',
        label:   '단골 스탬프',
        subKey:  'stamp',         // "N곳 모으는 중"
        route:   'MyStamps',
      },
      {
        icon:    '🕒',
        label:   '최근 본 가게',
        staticSub: null,
        route:   'MyRecent',
      },
    ],
  },
  {
    title: '혜택',
    items: [
      {
        icon:     '🎁',
        label:    '친구 초대하고 쿠폰받기',
        subKey:   'invite',       // 초대 이력 여부로 분기
        route:    'MyInvite',
        badge:    'new',
      },
      {
        icon:     '🎂',
        label:    '생일 쿠폰',
        subKey:   'birthday',     // 당월 여부로 분기
        route:    'MyBirthday',
        disabled: true,           // 당월이 아닐 때 disabled; 오케스트레이터에서 동적 오버라이드
      },
      {
        icon:      '🎫',
        label:     '이벤트·공지',
        staticSub: null,
        route:     'MyNotices',
      },
    ],
  },
  {
    title: '계정',
    items: [
      {
        icon:    '📍',
        label:   '내 위치 설정',
        subKey:  'location',      // location_name or "위치 설정 필요"
        route:   'MyLocation',
      },
      {
        icon:      '🔔',
        label:     '알림 설정',
        staticSub: null,
        route:     'MyNotif',
      },
      {
        icon:      '👤',
        label:     '프로필 수정',
        staticSub: null,
        route:     'MyEdit',
      },
      {
        icon:      '❓',
        label:     '고객센터·문의',
        staticSub: null,
        route:     'MyHelp',
      },
      {
        icon:      '📄',
        label:     '약관·개인정보',
        staticSub: null,
        route:     'MyTerms',
      },
    ],
  },
];
