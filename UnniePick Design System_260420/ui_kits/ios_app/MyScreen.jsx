// MyScreen — 사용자용 MY 탭 (사장님 대시보드와 분리)

function MyScreen({ onOpenWallet, onOpenFollowing, onOpenSettings }) {
  const user = {
    nickname: '창원언니',
    joinedDays: 42,
    stamp: 7,
    location: '창원시 의창구 팔용동',
    level: '브론즈',
    levelProgress: 0.45,
    nextLevel: '실버',
    pointToNext: 280,
  };

  const stats = [
    { n: 12, l: '보유 쿠폰', key: 'wallet' },
    { n: 18, l: '팔로잉', key: 'following' },
    { n: 34, l: '사용 완료', key: 'used' },
  ];

  const menuGroups = [
    {
      title: '활동',
      items: [
        { icon: '🎟', label: '내 쿠폰함', sub: '보유 12 · 사용임박 2', badge: '2' },
        { icon: '❤️', label: '팔로잉 가게', sub: '18곳' },
        { icon: '⭐', label: '단골 스탬프', sub: '3곳 모으는 중' },
        { icon: '🕒', label: '최근 본 가게', sub: null },
      ],
    },
    {
      title: '혜택',
      items: [
        { icon: '🎁', label: '친구 초대하고 쿠폰받기', sub: '최대 5,000원', badge: 'NEW' },
        { icon: '🎂', label: '생일 쿠폰', sub: '10월 생일 · 준비중' },
        { icon: '🎫', label: '이벤트·공지', sub: null },
      ],
    },
    {
      title: '계정',
      items: [
        { icon: '📍', label: '내 위치 설정', sub: user.location },
        { icon: '🔔', label: '알림 설정', sub: null },
        { icon: '👤', label: '프로필 수정', sub: null },
        { icon: '❓', label: '고객센터·문의', sub: null },
        { icon: '📄', label: '약관·개인정보', sub: null },
      ],
    },
  ];

  return (
    <div style={{ flex: 1, background: 'var(--gray-50)', overflow: 'auto', paddingBottom: 24 }}>
      {/* 프로필 헤더 */}
      <div style={{
        background: '#fff',
        padding: '50px 20px 20px',
        borderBottom: '1px solid var(--gray-150)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--orange-300), var(--orange-500))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            font: '900 28px/1 var(--font-sans)', color: '#fff',
            boxShadow: '0 4px 12px rgba(255,111,15,0.25)',
          }}>
            {user.nickname[0]}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ font: '900 19px/1 var(--font-sans)', color: 'var(--fg1)', letterSpacing: '-0.4px' }}>
                {user.nickname}
              </div>
              <span style={{
                font: '800 10px/1 var(--font-sans)', color: '#A46A2B',
                background: '#FFE8C9', padding: '4px 7px', borderRadius: 6, letterSpacing: '0.3px',
              }}>
                {user.level}
              </span>
            </div>
            <div style={{ font: '500 12px/1.3 var(--font-sans)', color: 'var(--fg3)' }}>
              언니픽과 함께한 지 {user.joinedDays}일째
            </div>
          </div>
          <button style={{
            background: 'var(--gray-100)', border: 'none', borderRadius: 10,
            padding: '8px 12px', font: '700 12px/1 var(--font-sans)', color: 'var(--fg2)',
          }}>프로필 수정</button>
        </div>

        {/* 레벨 진행 */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ font: '600 11px/1 var(--font-sans)', color: 'var(--fg3)' }}>
              {user.nextLevel}까지 <b style={{ color: 'var(--orange-500)' }}>{user.pointToNext}P</b>
            </span>
            <span style={{ font: '700 11px/1 var(--font-sans)', color: 'var(--fg2)' }}>{Math.round(user.levelProgress * 100)}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--gray-150)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${user.levelProgress * 100}%`,
              background: 'linear-gradient(90deg, var(--orange-300), var(--orange-500))',
              borderRadius: 3,
            }}/>
          </div>
        </div>

        {/* 요약 카운트 3종 */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0,
          marginTop: 18, padding: '14px 0 4px', borderTop: '1px solid var(--gray-150)',
        }}>
          {stats.map((s, i) => (
            <button key={s.key} style={{
              background: 'transparent', border: 'none', borderLeft: i > 0 ? '1px solid var(--gray-150)' : 'none',
              padding: '4px 0', textAlign: 'center', cursor: 'pointer',
            }}>
              <div style={{ font: '900 22px/1 var(--font-sans)', color: 'var(--fg1)', letterSpacing: '-0.5px' }}>{s.n}</div>
              <div style={{ font: '600 11px/1 var(--font-sans)', color: 'var(--fg3)', marginTop: 6 }}>{s.l}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 긴급 쿠폰 리마인더 */}
      <div style={{ padding: '14px 16px 4px' }}>
        <button style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', borderRadius: 14, border: '1px solid var(--orange-300)',
          background: 'linear-gradient(180deg, #FFF3EB 0%, #fff 70%)',
          textAlign: 'left', cursor: 'pointer',
        }}>
          <div style={{ fontSize: 24 }}>⏰</div>
          <div style={{ flex: 1 }}>
            <div style={{ font: '800 14px/1.2 var(--font-sans)', color: 'var(--fg1)', letterSpacing: '-0.3px' }}>
              오늘 안에 써야하는 쿠폰 2개
            </div>
            <div style={{ font: '500 11px/1.3 var(--font-sans)', color: 'var(--fg3)', marginTop: 4 }}>
              팔용빵집 · 의창김밥 · 자정까지
            </div>
          </div>
          <div style={{ font: '300 22px/1 var(--font-sans)', color: 'var(--fg3)' }}>›</div>
        </button>
      </div>

      {/* 메뉴 그룹 */}
      {menuGroups.map((g, gi) => (
        <div key={gi} style={{ marginTop: 14 }}>
          <div style={{ padding: '6px 20px 8px', font: '700 11px/1 var(--font-sans)', color: 'var(--fg3)', letterSpacing: '0.3px' }}>
            {g.title}
          </div>
          <div style={{ background: '#fff', borderTop: '1px solid var(--gray-150)', borderBottom: '1px solid var(--gray-150)' }}>
            {g.items.map((it, i) => (
              <button key={i} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 18px', background: '#fff', border: 'none',
                borderBottom: i < g.items.length - 1 ? '1px solid var(--gray-100)' : 'none',
                textAlign: 'left', cursor: 'pointer',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, background: 'var(--gray-100)',
                }}>{it.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '700 14px/1.2 var(--font-sans)', color: 'var(--fg1)', letterSpacing: '-0.3px' }}>{it.label}</div>
                  {it.sub && <div style={{ font: '500 11px/1.3 var(--font-sans)', color: 'var(--fg3)', marginTop: 3 }}>{it.sub}</div>}
                </div>
                {it.badge && (
                  <span style={{
                    font: '800 10px/1 var(--font-sans)', color: '#fff',
                    background: 'var(--red-500)', padding: '4px 7px', borderRadius: 10, letterSpacing: '0.2px',
                  }}>{it.badge}</span>
                )}
                <div style={{ font: '300 20px/1 var(--font-sans)', color: 'var(--fg4)' }}>›</div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* 하단 사장님 진입 + 로그아웃 */}
      <div style={{ padding: '20px 20px 8px', textAlign: 'center' }}>
        <div style={{
          padding: '12px 14px', borderRadius: 12,
          background: '#fff', border: '1px solid var(--gray-150)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          font: '600 12px/1.4 var(--font-sans)', color: 'var(--fg3)',
        }}>
          <span>가게 사장님이신가요?</span>
          <span style={{ color: 'var(--orange-500)', fontWeight: 800 }}>사장님 앱 다운로드 ›</span>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 14, padding: '14px 20px 20px' }}>
        <button style={{ background: 'transparent', border: 'none', font: '500 12px/1 var(--font-sans)', color: 'var(--fg3)' }}>로그아웃</button>
        <span style={{ color: 'var(--fg4)' }}>·</span>
        <button style={{ background: 'transparent', border: 'none', font: '500 12px/1 var(--font-sans)', color: 'var(--fg3)' }}>회원탈퇴</button>
      </div>
      <div style={{ font: '500 10px/1 var(--font-sans)', color: 'var(--fg4)', textAlign: 'center', paddingBottom: 16 }}>
        UnniePick v1.0.0
      </div>
    </div>
  );
}
