// ═══════════════════════════════════════════════════════════════
// Screens — 모든 in-app 화면 (Onboarding, Map, Wallet, Detail, Settings)
// ═══════════════════════════════════════════════════════════════

// Hooks shortcuts (declared once here — this file loads first among babel scripts)
const { useState, useEffect, useRef, useMemo } = React;

// ═════ 1. Onboarding ═════
function Onboarding({ step = 0, onNext }) {
  const steps = [
    {
      emoji: '📍',
      title: '동네를 걸을 때\n지갑이 먼저 반응해요',
      body: '매장 앞 100m 안에 들어가면 저장해둔 쿠폰이 잠금화면으로 살며시 올라와요. 앱을 다시 열 필요 없이.',
      cta: '위치 권한 허용',
      permission: '항상 허용 (백그라운드에서도)',
      permissionDesc: '매장 근처일 때만 조용히 알려줘요. 위치 기록은 서버로 보내지 않아요.',
    },
    {
      emoji: '🔔',
      title: '쿠폰 만료 직전에도\n살짝 알려드려요',
      body: '하루에 최대 2번만. 광고 알림은 절대 없어요. 필요할 때만 나타나는 조용한 알림.',
      cta: '알림 허용',
      permission: '위치 기반 알림만',
      permissionDesc: '잠금화면과 Dynamic Island에만 표시돼요.',
    },
    {
      emoji: '✨',
      title: '이제 준비 완료!',
      body: '상남동의 쿠폰 5장이 지갑에 있어요. 가게 근처를 지나가면 자동으로 알려드릴게요.',
      cta: '지도 둘러보기',
      permission: null,
    },
  ];
  const s = steps[step];
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      padding: '100px 32px 50px', background: '#fff',
    }}>
      {/* 진행 도트 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 48 }}>
        {steps.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= step ? 'var(--orange-500)' : 'var(--gray-200)',
            transition: 'background 0.3s',
          }}/>
        ))}
      </div>
      <div style={{
        fontSize: 100, marginBottom: 28,
        animation: 'fade-in 0.5s var(--ease-spring)',
      }}>{s.emoji}</div>
      <div style={{
        font: '900 28px/1.25 var(--font-sans)',
        color: 'var(--gray-900)',
        letterSpacing: '-0.8px',
        marginBottom: 16,
        whiteSpace: 'pre-line',
      }}>{s.title}</div>
      <div style={{
        font: '500 15px/1.55 var(--font-sans)',
        color: 'var(--gray-700)',
        letterSpacing: '-0.2px',
        marginBottom: 28,
      }}>{s.body}</div>
      {s.permission && (
        <div style={{
          padding: 16, background: 'var(--orange-50)',
          borderRadius: 12, marginBottom: 20,
          border: '1px solid var(--orange-100)',
        }}>
          <div style={{ font: '800 13px/1.2 var(--font-sans)', color: 'var(--orange-700)', letterSpacing: '-0.2px', marginBottom: 6 }}>
            {s.permission}
          </div>
          <div style={{ font: '500 12px/1.5 var(--font-sans)', color: 'var(--gray-700)', letterSpacing: '-0.1px' }}>
            {s.permissionDesc}
          </div>
        </div>
      )}
      <div style={{ flex: 1 }}/>
      <CTAButton onClick={onNext}>{s.cta}</CTAButton>
      {step < 2 && (
        <button onClick={onNext} style={{
          marginTop: 14, background: 'none', border: 'none',
          font: '600 13px/1 var(--font-sans)', color: 'var(--gray-500)',
          letterSpacing: '-0.1px', cursor: 'pointer',
        }}>나중에 설정하기</button>
      )}
    </div>
  );
}

// ═════ 2. Map Screen — 지도 + 진입 감지 ═════
function MapScreen({ userPos = { lat: 35.2235, lng: 128.6795 }, radius = 100, onTapStore, onOpenWallet, onOpenSettings }) {
  // 지도 변환: 위도/경도 → px 좌표 (간단 선형 맵핑, 중심=userPos)
  const SCALE = 60000; // 1도 ≈ 60000px 정도로 잡고
  const mapW = 402, mapH = 620;
  const toPx = (lat, lng) => ({
    x: mapW / 2 + (lng - userPos.lng) * SCALE * Math.cos(userPos.lat * Math.PI / 180),
    y: mapH / 2 - (lat - userPos.lat) * SCALE,
  });
  // 반경 px: 위도 1도 ≈ 111km, 100m = 0.0009도
  const radiusPx = (radius / 1000) * (60000 / 111);
  const nearbyList = nearbyStoresWithCoupons(radius);

  return (
    <div style={{
      height: '100%', width: '100%', position: 'relative',
      background: '#E8E8EC', overflow: 'hidden',
    }}>
      {/* 지도 배경 (스타일된 SVG로 대체) */}
      <svg width={mapW} height={mapH} style={{ position: 'absolute', inset: 0 }} viewBox={`0 0 ${mapW} ${mapH}`}>
        <defs>
          <pattern id="road-grid" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <rect width="80" height="80" fill="#E8E8EC"/>
            <rect x="38" y="0" width="4" height="80" fill="#D1D6DB" opacity="0.6"/>
            <rect x="0" y="38" width="80" height="4" fill="#D1D6DB" opacity="0.6"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#road-grid)"/>
        {/* 큰 도로 */}
        <rect x="0" y={mapH/2 - 8} width={mapW} height="16" fill="#fff" opacity="0.9"/>
        <rect x={mapW/2 - 8} y="0" width="16" height={mapH} fill="#fff" opacity="0.9"/>
        {/* 건물 블록 */}
        <rect x="40" y="80" width="120" height="100" fill="#F4F2ED" rx="4"/>
        <rect x="250" y="60" width="100" height="130" fill="#F4F2ED" rx="4"/>
        <rect x="60" y="400" width="140" height="110" fill="#F4F2ED" rx="4"/>
        <rect x="230" y="430" width="130" height="120" fill="#F4F2ED" rx="4"/>
        {/* 공원 */}
        <circle cx="320" cy="230" r="38" fill="#C8E6C9" opacity="0.7"/>
        <text x="320" y="234" textAnchor="middle" font-size="10" fill="#4E5968" fontWeight="600">용지공원</text>
        {/* 지역명 */}
        <text x="40" y="40" font-size="13" fill="#8B95A1" fontWeight="700" letterSpacing="-0.3">상남동</text>
      </svg>

      {/* 반경 링 (유저 주변) */}
      {(() => {
        const u = toPx(userPos.lat, userPos.lng);
        return (
          <React.Fragment>
            {/* 바깥 ring pulse */}
            <div style={{
              position: 'absolute', left: u.x - radiusPx, top: u.y - radiusPx,
              width: radiusPx * 2, height: radiusPx * 2, borderRadius: '50%',
              border: '2px solid var(--orange-500)',
              background: 'rgba(255,111,15,0.08)',
              pointerEvents: 'none',
            }}/>
            <div style={{
              position: 'absolute', left: u.x - radiusPx, top: u.y - radiusPx,
              width: radiusPx * 2, height: radiusPx * 2, borderRadius: '50%',
              border: '2px solid var(--orange-500)',
              opacity: 0.5,
              animation: 'pulse-ring 2.4s ease-out infinite',
              pointerEvents: 'none',
            }}/>
            {/* 유저 점 */}
            <div style={{
              position: 'absolute', left: u.x - 12, top: u.y - 12,
              width: 24, height: 24, borderRadius: '50%',
              background: 'var(--orange-500)',
              boxShadow: '0 0 0 4px #fff, 0 2px 8px rgba(255,111,15,0.4)',
              animation: 'pulse-dot 2s ease-in-out infinite',
              zIndex: 3,
            }}/>
          </React.Fragment>
        );
      })()}

      {/* 매장 핀들 */}
      {STORES.map(s => {
        const p = toPx(s.lat, s.lng);
        if (p.x < -60 || p.x > mapW + 60 || p.y < -60 || p.y > mapH + 60) return null;
        const coupons = walletByStore(s.id);
        const inRange = s.distance <= radius && coupons.length > 0;
        return (
          <button key={s.id} onClick={() => onTapStore && onTapStore(s.id)} style={{
            position: 'absolute', left: p.x - 22, top: p.y - 44,
            background: 'none', border: 'none', padding: 0,
            cursor: 'pointer', zIndex: 4,
          }}>
            <div style={{
              width: 44, height: 54, position: 'relative',
              filter: inRange ? 'none' : 'saturate(0.5) opacity(0.7)',
              transform: inRange ? 'scale(1.1)' : 'scale(1)',
              transition: 'transform 0.3s',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50% 50% 50% 4px',
                transform: 'rotate(-45deg)',
                background: s.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
              }}>
                <span style={{ transform: 'rotate(45deg)', fontSize: 22 }}>{s.emoji}</span>
              </div>
              {coupons.length > 0 && (
                <div style={{
                  position: 'absolute', top: -4, right: -4,
                  minWidth: 20, height: 20, borderRadius: 10, padding: '0 6px',
                  background: '#E53935', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  font: '900 11px/1 var(--font-sans)',
                  border: '2px solid #fff',
                }}>{coupons.length}</div>
              )}
            </div>
          </button>
        );
      })}

      {/* 상단 검색바 */}
      <div style={{
        position: 'absolute', top: 58, left: 16, right: 16, zIndex: 10,
        display: 'flex', gap: 10,
      }}>
        <div style={{
          flex: 1, background: '#fff', borderRadius: 14,
          padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <span style={{ font: '600 14px/1 var(--font-sans)', color: 'var(--gray-500)', letterSpacing: '-0.2px' }}>
            매장 또는 쿠폰 검색
          </span>
        </div>
        <button onClick={onOpenSettings} style={{
          width: 44, height: 44, borderRadius: 14, background: '#fff',
          border: 'none', fontSize: 20, cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>⚙️</button>
      </div>

      {/* 하단 시트: 근처 쿠폰 */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: '10px 0 40px',
        boxShadow: '0 -8px 24px rgba(0,0,0,0.08)',
        maxHeight: 280, overflow: 'hidden',
        zIndex: 8,
      }}>
        <div style={{
          width: 36, height: 4, background: 'var(--gray-300)',
          borderRadius: 2, margin: '6px auto 14px',
        }}/>
        <div style={{ padding: '0 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ font: '900 17px/1.2 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.4px' }}>
              지금 {radius}m 안에
            </div>
            <div style={{ font: '600 12px/1.4 var(--font-sans)', color: 'var(--gray-500)', marginTop: 2 }}>
              쿠폰 {nearbyList.reduce((a, x) => a + x.coupons.length, 0)}장 · 매장 {nearbyList.length}곳
            </div>
          </div>
          <button onClick={onOpenWallet} style={{
            background: 'var(--gray-100)', border: 'none',
            padding: '8px 14px', borderRadius: 20,
            font: '700 12px/1 var(--font-sans)', color: 'var(--gray-900)',
            letterSpacing: '-0.1px', cursor: 'pointer',
          }}>지갑 전체 →</button>
        </div>
        <div style={{
          display: 'flex', gap: 12, padding: '0 20px 12px',
          overflowX: 'auto',
        }} className="device-scroll">
          {nearbyList.slice(0, 4).map(({ store, coupons }) => (
            <button key={store.id} onClick={() => onTapStore && onTapStore(store.id)} style={{
              background: '#fff', border: '1px solid var(--gray-200)',
              borderRadius: 14, padding: 14, minWidth: 200, flexShrink: 0,
              textAlign: 'left', cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <StoreGlyph store={store} size={32} radius={10}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '800 13px/1.2 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {store.name}
                  </div>
                  <div style={{ font: '500 11px/1 var(--font-sans)', color: 'var(--gray-500)', marginTop: 3 }}>
                    {store.distance}m
                  </div>
                </div>
              </div>
              <div style={{ font: '700 12px/1.35 var(--font-sans)', color: 'var(--orange-600)', letterSpacing: '-0.1px' }}>
                {coupons[0].title}
              </div>
              {coupons.length > 1 && (
                <div style={{ font: '600 11px/1 var(--font-sans)', color: 'var(--gray-500)', marginTop: 4 }}>
                  +{coupons.length - 1}장 더
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═════ 3. Wallet Screen — 지갑 전체 쿠폰 리스트 ═════
function WalletScreen({ onBack, onOpenCoupon }) {
  const [tab, setTab] = useState('nearby');
  const nearby = WALLET.filter(c => findStore(c.storeId).distance <= 300 && c.isNearby);
  const all = WALLET.filter(c => c.daysLeft > 0);
  const list = tab === 'nearby' ? nearby : all;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--gray-100)' }}>
      {/* Nav */}
      <div style={{
        padding: '54px 20px 10px', background: '#fff',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M18 7l-7 7 7 7" stroke="#191F28" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ flex: 1, font: '800 18px/1 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.4px' }}>
          내 쿠폰함
        </div>
      </div>
      {/* Segment */}
      <div style={{ display: 'flex', background: '#fff', padding: '4px 20px 8px', gap: 0, borderBottom: '1px solid var(--gray-200)' }}>
        {[
          { key: 'nearby', label: `근처 (${nearby.length})` },
          { key: 'all', label: `전체 (${all.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '12px 0', background: 'none',
            border: 'none', borderBottom: '2.5px solid ' + (tab === t.key ? 'var(--orange-500)' : 'transparent'),
            font: '700 14px/1 var(--font-sans)',
            color: tab === t.key ? 'var(--orange-500)' : 'var(--gray-500)',
            letterSpacing: '-0.2px', cursor: 'pointer',
          }}>{t.label}</button>
        ))}
      </div>
      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 100px' }} className="device-scroll">
        {list.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎟</div>
            <div style={{ font: '800 16px/1.3 var(--font-sans)', color: 'var(--gray-900)', marginBottom: 6 }}>
              근처에 쿠폰이 없어요
            </div>
            <div style={{ font: '500 13px/1.5 var(--font-sans)', color: 'var(--gray-500)' }}>
              반경을 넓히거나 이동해보세요
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {list.map(c => {
              const store = findStore(c.storeId);
              return (
                <CouponRowCard key={c.id} coupon={c} store={store} onPress={() => onOpenCoupon(c.id)} urgent={c.daysLeft <= 3}/>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ═════ 4. Coupon Detail → QR → Done ═════
function CouponDetail({ couponId, onBack, onUsed }) {
  const [stage, setStage] = useState('detail'); // detail | qr | done
  const coupon = WALLET.find(c => c.id === couponId);
  const store = findStore(coupon.storeId);

  if (stage === 'done') {
    return (
      <div style={{
        height: '100%', background: 'linear-gradient(160deg, #FF6F0F, #FF9A3D)',
        color: '#fff', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 32,
        animation: 'fade-in 0.5s',
      }}>
        <div style={{
          width: 96, height: 96, borderRadius: '50%',
          background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 24, animation: 'pulse-dot 1.2s ease-in-out',
        }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <path d="M12 24l9 9 16-18" stroke="#FF6F0F" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div style={{ font: '900 26px/1.2 var(--font-sans)', textAlign: 'center', letterSpacing: '-0.8px', marginBottom: 10 }}>
          사용 완료!
        </div>
        <div style={{ font: '500 14px/1.5 var(--font-sans)', textAlign: 'center', opacity: 0.85, marginBottom: 40 }}>
          {store.name}<br/>{coupon.title}
        </div>
        <CTAButton variant="dark" onClick={onUsed}>완료</CTAButton>
      </div>
    );
  }

  if (stage === 'qr') {
    return (
      <div style={{ height: '100%', background: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '54px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => setStage('detail')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M18 7l-7 7 7 7" stroke="#191F28" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div style={{ font: '800 16px/1 var(--font-sans)', color: 'var(--gray-900)' }}>사장님께 보여주세요</div>
          <div style={{ width: 28 }}/>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ font: '800 20px/1.2 var(--font-sans)', color: 'var(--gray-900)', textAlign: 'center', letterSpacing: '-0.4px', marginBottom: 6 }}>
            {coupon.title}
          </div>
          <div style={{ font: '500 13px/1 var(--font-sans)', color: 'var(--gray-500)', marginBottom: 28 }}>
            {store.name}
          </div>
          <div style={{ width: 240, height: 240, background: '#fff', borderRadius: 16, border: '8px solid #191F28', display: 'grid', gridTemplateColumns: 'repeat(21, 1fr)', padding: 8 }}>
            {Array.from({ length: 441 }).map((_, i) => {
              const r = Math.floor(i / 21), c = i % 21;
              const outerCorner = ((r === 0 || r === 6) && c < 7) || ((c === 0 || c === 6) && r < 7) ||
                ((r === 0 || r === 6) && c > 13) || ((c === 14 || c === 20) && r < 7) ||
                ((r === 14 || r === 20) && c < 7) || ((c === 0 || c === 6) && r > 13);
              const innerCorner = (r >= 2 && r <= 4 && (c >= 2 && c <= 4 || c >= 16 && c <= 18)) || (r >= 16 && r <= 18 && c >= 2 && c <= 4);
              const corner = (r < 7 && c < 7) || (r < 7 && c > 13) || (r > 13 && c < 7);
              const filled = innerCorner || outerCorner || (!corner && ((r * 13 + c * 7 + couponId.length) % 3 === 0));
              return <div key={i} style={{ background: filled ? '#191F28' : 'transparent' }}/>;
            })}
          </div>
          <div style={{
            marginTop: 28, padding: '12px 18px', background: 'var(--orange-50)',
            borderRadius: 12, font: '700 13px/1.4 var(--font-sans)', color: 'var(--orange-700)',
            textAlign: 'center',
          }}>
            화면 밝기 자동 최대 · 30초 후 코드 갱신
          </div>
          <button onClick={() => setStage('done')} style={{
            marginTop: 32, background: 'var(--gray-900)', color: '#fff',
            border: 'none', padding: '14px 40px', borderRadius: 14,
            font: '700 14px/1 var(--font-sans)', cursor: 'pointer',
          }}>사용 완료 처리</button>
        </div>
      </div>
    );
  }

  // Detail
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      {/* 헤더 (브랜드 컬러) */}
      <div style={{
        background: `linear-gradient(160deg, ${store.color}, ${store.color}DD)`,
        color: '#fff', padding: '54px 24px 32px',
        borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
      }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', width: 36, height: 36, borderRadius: 18, cursor: 'pointer', marginBottom: 20 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M12 5l-5 5 5 5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ fontSize: 40, marginBottom: 12 }}>{store.emoji}</div>
        <div style={{ font: '700 12px/1 var(--font-sans)', opacity: 0.85, marginBottom: 6, letterSpacing: 0.3 }}>
          {store.name} · {store.distance}m
        </div>
        <div style={{ font: '900 24px/1.25 var(--font-sans)', letterSpacing: '-0.6px', marginBottom: 4 }}>
          {coupon.title}
        </div>
        <div style={{ font: '600 13px/1.4 var(--font-sans)', opacity: 0.85, marginTop: 10 }}>
          {coupon.conditions}
        </div>
      </div>
      {/* 내용 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 120px' }} className="device-scroll">
        {/* 만료 */}
        <div style={{ padding: 16, background: 'var(--gray-50)', borderRadius: 14, marginBottom: 12 }}>
          <div style={{ font: '700 11px/1 var(--font-sans)', color: 'var(--gray-500)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
            유효기간
          </div>
          <div style={{ font: '800 15px/1.3 var(--font-sans)', color: coupon.daysLeft <= 3 ? '#E53935' : 'var(--gray-900)' }}>
            {coupon.expiresAt.replace(/-/g, '.')}까지 · D-{coupon.daysLeft}
          </div>
        </div>
        {/* 사용방법 */}
        <div style={{ padding: 16, background: 'var(--gray-50)', borderRadius: 14, marginBottom: 12 }}>
          <div style={{ font: '700 11px/1 var(--font-sans)', color: 'var(--gray-500)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
            사용 방법
          </div>
          {['매장 도착 후 "쿠폰 사용하기" 탭', '사장님께 QR 코드 제시', '주문 완료 시 자동 처리'].map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0' }}>
              <div style={{ width: 20, height: 20, borderRadius: 10, background: 'var(--orange-500)', color: '#fff', font: '900 11px/20px var(--font-sans)', textAlign: 'center', flexShrink: 0 }}>{i + 1}</div>
              <div style={{ font: '500 13px/1.5 var(--font-sans)', color: 'var(--gray-700)' }}>{s}</div>
            </div>
          ))}
        </div>
        {/* 매장 정보 */}
        <div style={{ padding: 16, background: 'var(--gray-50)', borderRadius: 14 }}>
          <div style={{ font: '700 11px/1 var(--font-sans)', color: 'var(--gray-500)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
            매장 정보
          </div>
          <div style={{ font: '500 13px/1.7 var(--font-sans)', color: 'var(--gray-700)' }}>
            <div>📍 {store.address}</div>
            <div>🕐 {store.openTime} - {store.closeTime} · {store.isOpen ? '영업 중' : '영업 종료'}</div>
            <div>⭐ {store.rating} ({store.reviewCount}개 리뷰)</div>
          </div>
        </div>
      </div>
      {/* 하단 CTA */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '16px 20px 40px', background: '#fff',
        borderTop: '1px solid var(--gray-150)',
      }}>
        <CTAButton onClick={() => setStage('qr')}>쿠폰 사용하기 (QR)</CTAButton>
      </div>
    </div>
  );
}

// ═════ 5. Settings Screen ═════
function SettingsScreen({ onBack, radius, setRadius, liveActivity, setLiveActivity, widget, setWidget, onReplay }) {
  return (
    <div style={{ height: '100%', background: 'var(--gray-100)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '54px 20px 10px', background: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M18 7l-7 7 7 7" stroke="#191F28" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ flex: 1, font: '800 18px/1 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.4px' }}>
          알림 설정
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }} className="device-scroll">
        {/* 반경 슬라이더 */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <div style={{ font: '800 15px/1.2 var(--font-sans)', color: 'var(--gray-900)', letterSpacing: '-0.2px' }}>
              감지 반경
            </div>
            <div style={{ font: '900 18px/1 var(--font-sans)', color: 'var(--orange-500)', letterSpacing: '-0.4px' }}>
              {radius}m
            </div>
          </div>
          <div style={{ font: '500 12px/1.5 var(--font-sans)', color: 'var(--gray-500)', marginBottom: 16 }}>
            이 거리 안에 들어오면 Live Activity가 뜹니다
          </div>
          <input type="range" min="50" max="500" step="50" value={radius}
            onChange={e => setRadius(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--orange-500)' }}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: '500 11px/1 var(--font-sans)', color: 'var(--gray-400)', marginTop: 4 }}>
            <span>50m</span><span>500m</span>
          </div>
        </div>
        {/* 기능 토글 */}
        <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden' }}>
          {[
            { label: 'Live Activity', desc: '잠금화면·Dynamic Island 표시', val: liveActivity, set: setLiveActivity },
            { label: '홈 위젯', desc: '홈스크린 위젯 업데이트', val: widget, set: setWidget },
          ].map((item, i) => (
            <div key={item.label} style={{
              padding: 16, display: 'flex', alignItems: 'center',
              borderTop: i > 0 ? '1px solid var(--gray-100)' : 'none',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ font: '800 14px/1.2 var(--font-sans)', color: 'var(--gray-900)' }}>{item.label}</div>
                <div style={{ font: '500 11px/1.4 var(--font-sans)', color: 'var(--gray-500)', marginTop: 3 }}>{item.desc}</div>
              </div>
              <button onClick={() => item.set(!item.val)} className={`tw-switch ${item.val ? 'on' : ''}`} style={{ background: item.val ? 'var(--orange-500)' : '#CFD4D9' }}/>
            </div>
          ))}
        </div>
        {/* 온보딩 다시 */}
        <div style={{ marginTop: 20 }}>
          <button onClick={onReplay} style={{
            width: '100%', padding: 14, background: '#fff',
            border: '1px solid var(--gray-200)', borderRadius: 14,
            font: '700 13px/1 var(--font-sans)', color: 'var(--gray-700)',
            cursor: 'pointer',
          }}>온보딩 다시 보기</button>
        </div>
        {/* 프라이버시 */}
        <div style={{ padding: '16px 4px', font: '500 11px/1.6 var(--font-sans)', color: 'var(--gray-500)' }}>
          위치 정보는 휴대폰 안에서만 처리돼요. 반경 밖에서는 서버로 보내지 않습니다.
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Onboarding, MapScreen, WalletScreen, CouponDetail, SettingsScreen });
