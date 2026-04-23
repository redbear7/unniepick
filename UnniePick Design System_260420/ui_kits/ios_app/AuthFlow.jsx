// AuthFlow — V1 회원가입 플로우 (4스텝)
// Step1: 휴대폰 번호 → Step2: SMS 인증 → Step3: 닉네임(+생일) → Step4: 위치+업체10 팔로우+약관
// Variants: 'basic' (기본형 · 깔끔 iOS) | 'enhanced' (강화형 · 친근 보조 메시지·오렌지 포인트)

// ─── 데이터: 창원 팔용동 주변 가상 업체 10개 ───────────────
// 사용자 위치(창원시 의창구 팔용동) 기준 가까운 가게 10개 — 거리 오름차순
const NEARBY_STORES_PALYONG = [
  { id: 'n1', name: '팔용동카페봄', emoji: '☕', cat: '카페', distance: 80 },
  { id: 'n2', name: '의창편의점', emoji: '🏪', cat: '편의점', distance: 90 },
  { id: 'n3', name: '의창김밥', emoji: '🍙', cat: '분식', distance: 120 },
  { id: 'n4', name: '언니네네일', emoji: '💅', cat: '네일', distance: 180 },
  { id: 'n5', name: '봄날미용실', emoji: '💇', cat: '미용', distance: 240 },
  { id: 'n6', name: '창원돈까스', emoji: '🍱', cat: '음식', distance: 310 },
  { id: 'n7', name: '팔용빵집', emoji: '🥐', cat: '베이커리', distance: 360 },
  { id: 'n8', name: '언니네떡볶이', emoji: '🌶', cat: '분식', distance: 420 },
  { id: 'n9', name: '팔용꽃집', emoji: '💐', cat: '생활', distance: 470 },
  { id: 'n10', name: '창원치킨', emoji: '🍗', cat: '음식', distance: 550 },
];

// 중복 닉네임 시뮬레이션
const TAKEN_NICKNAMES = ['언니', '창원언니', 'picki', '팔용동', 'admin'];

// ─── 공통 버튼 ────────────────────────────────────────────────
function primaryButton(enabled) {
  return {
    width: '100%', padding: 16, borderRadius: 14, border: 'none',
    background: enabled ? 'var(--orange-500)' : 'var(--gray-200)',
    color: enabled ? '#fff' : 'var(--gray-500)',
    font: '900 16px/1 var(--font-sans)', letterSpacing: '-0.3px',
    boxShadow: enabled ? '0 8px 20px rgba(255,111,15,0.26)' : 'none',
    cursor: enabled ? 'pointer' : 'not-allowed',
    transition: 'all 180ms ease',
  };
}

// ─── 도트 인디케이터 ●●○○ ────────────────────────────────────
function DotIndicator({ step, total }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '18px 0 6px' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i + 1 === step ? 22 : 7, height: 7, borderRadius: 4,
          background: i + 1 <= step ? 'var(--orange-500)' : 'var(--gray-200)',
          transition: 'all 280ms cubic-bezier(0.22,1,0.36,1)',
        }}/>
      ))}
    </div>
  );
}

// ─── 헤더 (뒤로가기 + 도트) ───────────────────────────────────
function AuthHeader({ step, total, onBack, canBack = true }) {
  return (
    <div style={{
      background: '#fff', padding: '14px 8px 0',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
        <button onClick={onBack} disabled={!canBack} style={{
          background: 'none', border: 'none', padding: 8,
          color: canBack ? 'var(--fg1)' : 'transparent',
          cursor: canBack ? 'pointer' : 'default',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ width: 40 }}/>
      </div>
      <DotIndicator step={step} total={total} />
    </div>
  );
}

// ─── 친근 보조 메시지 (강화형 전용) ───────────────────────────
function HelperMsg({ text, tone = 'tip' }) {
  const bg = tone === 'warn' ? 'var(--orange-50)' : 'var(--gray-100)';
  const color = tone === 'warn' ? 'var(--orange-700)' : 'var(--fg2)';
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 14px', borderRadius: 12, background: bg,
      font: '600 12px/1.5 var(--font-sans)', color,
      marginTop: 12,
    }}>
      <span style={{ fontSize: 16, lineHeight: 1, marginTop: -1 }}>🐻</span>
      <span style={{ flex: 1 }}>{text}</span>
    </div>
  );
}

// ─── Step 1: 휴대폰 번호 ──────────────────────────────────────
function PhoneStep({ phone, setPhone, onNext, variant }) {
  // "010-" prefix는 고정; 사용자는 뒤 8자리만 입력
  const rest = phone.replace(/\D/g, '').replace(/^010/, '').slice(0, 8);
  const digits = '010' + rest;
  const isValid = rest.length === 8;
  const inputRef = React.useRef(null);

  // 뒤 8자리를 0000-0000 형식으로 표시
  const restDisplay = rest.length > 4
    ? `${rest.slice(0, 4)}-${rest.slice(4)}`
    : rest;

  return (
    <div style={{ padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{
        font: `900 ${variant === 'enhanced' ? 30 : 26}px/1.3 var(--font-sans)`,
        color: 'var(--fg1)', letterSpacing: '-0.8px', marginBottom: 10,
      }}>
        휴대폰 번호
      </div>
      <div style={{ font: '500 14px/1.5 var(--font-sans)', color: 'var(--fg3)', marginBottom: 36 }}>
        쿠폰 사용 · 본인 확인에 사용돼요
      </div>

      <div
        onClick={() => inputRef.current?.focus()}
        style={{
          display: 'flex', alignItems: 'baseline', gap: 6,
          padding: '18px 0',
          borderBottom: `2px solid ${rest.length > 0 ? 'var(--orange-500)' : 'var(--gray-200)'}`,
          cursor: 'text',
          transition: 'border-color 180ms',
        }}
      >
        <span style={{
          font: '800 28px/1.2 var(--font-sans)',
          color: 'var(--fg1)', letterSpacing: '-0.5px',
        }}>010</span>
        <span style={{
          font: '800 28px/1.2 var(--font-sans)',
          color: 'var(--fg4)', letterSpacing: '-0.5px',
        }}>-</span>
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          autoFocus
          placeholder="0000-0000"
          value={restDisplay}
          onChange={e => {
            const d = e.target.value.replace(/\D/g, '').slice(0, 8);
            setPhone('010' + d);
          }}
          style={{
            flex: 1, minWidth: 0,
            padding: 0, border: 'none', background: 'transparent',
            font: '800 28px/1.2 var(--font-sans)',
            color: 'var(--fg1)', letterSpacing: '-0.5px',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {variant === 'enhanced' && (
        <HelperMsg text="인증번호가 담긴 문자는 광고가 아니에요! 안심하고 받아주세요" />
      )}

      <div style={{ flex: 1 }}/>

      <button onClick={onNext} disabled={!isValid} style={primaryButton(isValid)}>
        인증번호 받기
      </button>
    </div>
  );
}

// ─── Step 2: SMS 인증 (iOS 자동완성 테마) ─────────────────────
function CodeStep({ phone, onNext, variant }) {
  const [code, setCode] = React.useState('');
  const [seconds, setSeconds] = React.useState(180);
  const [shake, setShake] = React.useState(false);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (seconds <= 0) return;
    const t = setInterval(() => setSeconds(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [seconds]);

  React.useEffect(() => {
    if (code.length === 6) {
      if (/^\d{6}$/.test(code)) {
        setTimeout(() => onNext(), 350);
      } else {
        setShake(true);
        setTimeout(() => { setShake(false); setCode(''); }, 500);
      }
    }
  }, [code, onNext]);

  const mm = String(Math.floor(seconds / 60));
  const ss = String(seconds % 60).padStart(2, '0');
  const digits = phone.replace(/\D/g, '');
  const masked = digits.length === 11 ? `${digits.slice(0,3)}-****-${digits.slice(7)}` : phone;

  return (
    <div style={{ padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{
        font: `900 ${variant === 'enhanced' ? 30 : 26}px/1.3 var(--font-sans)`,
        color: 'var(--fg1)', letterSpacing: '-0.8px', marginBottom: 10,
      }}>
        인증번호를<br/>입력해주세요
      </div>
      <div style={{ font: '500 13px/1.5 var(--font-sans)', color: 'var(--fg3)', marginBottom: 28 }}>
        <b style={{ color: 'var(--fg1)' }}>{masked}</b> 으로 6자리 인증번호를 발송했어요
      </div>

      {/* 6자리 박스 */}
      <div
        onClick={() => inputRef.current?.focus()}
        style={{
          display: 'flex', gap: 8, marginBottom: 16, cursor: 'text',
          animation: shake ? 'shake 400ms ease' : 'none',
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => {
          const ch = code[i] || '';
          const isActive = i === code.length;
          return (
            <div key={i} style={{
              flex: 1, height: 60, borderRadius: 12,
              background: '#fff',
              border: `2px solid ${shake ? '#E53935' : ch ? 'var(--orange-500)' : isActive ? 'var(--orange-300)' : 'var(--gray-200)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              font: '900 26px/1 var(--font-sans)', color: 'var(--fg1)',
              transition: 'border-color 160ms',
            }}>
              {ch}
              {isActive && !ch && <div style={{ width: 2, height: 26, background: 'var(--orange-500)', animation: 'blink 1s infinite' }}/>}
            </div>
          );
        })}
      </div>
      <input
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        autoFocus
        style={{ position: 'absolute', left: -9999, opacity: 0 }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ font: '700 13px/1 var(--font-sans)', color: seconds < 30 ? '#E53935' : 'var(--fg2)' }}>
          {mm}:{ss}
        </div>
        <button onClick={() => { setSeconds(180); setCode(''); }} style={{
          background: 'none', border: 'none', font: '700 13px/1 var(--font-sans)',
          color: 'var(--orange-500)', cursor: 'pointer', padding: 4,
        }}>
          다시 받기
        </button>
      </div>

      {shake && (
        <div style={{ font: '600 12px/1.4 var(--font-sans)', color: '#E53935', marginTop: 14 }}>
          인증번호가 올바르지 않아요
        </div>
      )}

      {variant === 'enhanced' && (
        <HelperMsg text="아무 6자리 숫자나 넣어도 다음으로 넘어가요 (데모)" />
      )}

      <div style={{ flex: 1 }}/>

      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
        @keyframes blink { 0%,50%{opacity:1} 51%,100%{opacity:0} }
      `}</style>
    </div>
  );
}

// ─── Step 3: 닉네임 + 생일 ────────────────────────────────────
function ProfileStep({ profile, setProfile, onNext, variant }) {
  const [checking, setChecking] = React.useState('idle'); // idle | checking | ok | taken
  const nickname = profile.nickname;

  // 한글 5자 = 영문 8자 기준 길이 계산 (한글 가중치 1.6)
  const nickLen = React.useMemo(() => {
    let n = 0;
    for (const ch of nickname) {
      n += /[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/.test(ch) ? 1.6 : 1;
    }
    return n;
  }, [nickname]);
  const hasHangul = /[\uAC00-\uD7A3]/.test(nickname);
  const overLimit = nickLen > 8;

  const onCheck = () => {
    if (nickname.trim().length < 2 || overLimit) return;
    setChecking('checking');
    setTimeout(() => {
      setChecking(TAKEN_NICKNAMES.includes(nickname.toLowerCase()) ? 'taken' : 'ok');
    }, 500);
  };

  // 닉네임 변경 시 체크 초기화
  React.useEffect(() => { setChecking('idle'); }, [nickname]);

  const isValid = checking === 'ok' && nickname.trim().length >= 2 && !overLimit;

  // 생일 (월·일)
  const [birthMonth, setBirthMonth] = React.useState(profile.birthMonth || '');
  const [birthDay, setBirthDay] = React.useState(profile.birthDay || '');
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [birthSkip, setBirthSkip] = React.useState(!!profile.birthSkip);

  React.useEffect(() => {
    setProfile(p => ({ ...p, birthMonth, birthDay, birthSkip }));
  }, [birthMonth, birthDay, birthSkip]);

  return (
    <div style={{ padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto' }}>
      <div style={{
        font: `900 ${variant === 'enhanced' ? 30 : 26}px/1.3 var(--font-sans)`,
        color: 'var(--fg1)', letterSpacing: '-0.8px', marginBottom: 10,
      }}>
        닉네임을<br/>정해주세요
      </div>
      <div style={{ font: '500 13px/1.5 var(--font-sans)', color: 'var(--fg3)', marginBottom: 28 }}>
        피드에서 다른 분들에게 보여지는 이름이에요
      </div>

      {/* 닉네임 + 중복확인 */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            maxLength={8}
            placeholder="한글 5자 · 영문 8자 이내"
            value={nickname}
            onChange={e => setProfile({ ...profile, nickname: e.target.value })}
            style={{
              flex: 1, padding: '14px 16px', borderRadius: 12,
              background: '#fff',
              border: `2px solid ${checking === 'ok' ? 'var(--orange-500)' : (checking === 'taken' || overLimit) ? '#E53935' : 'var(--gray-200)'}`,
              font: '700 16px/1 var(--font-sans)', color: 'var(--fg1)',
              outline: 'none', boxSizing: 'border-box',
              transition: 'border-color 180ms',
            }}
          />
          <button onClick={onCheck} disabled={nickname.trim().length < 2 || overLimit || checking === 'checking'} style={{
            padding: '14px 14px', borderRadius: 12,
            background: (nickname.trim().length >= 2 && !overLimit) ? 'var(--fg1)' : 'var(--gray-200)',
            color: (nickname.trim().length >= 2 && !overLimit) ? '#fff' : 'var(--gray-500)',
            font: '800 13px/1 var(--font-sans)', border: 'none',
            cursor: (nickname.trim().length >= 2 && !overLimit) ? 'pointer' : 'not-allowed',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            {checking === 'checking' ? '확인중…' : '중복 확인'}
          </button>
        </div>
        <div style={{
          font: '600 12px/1.4 var(--font-sans)',
          color: checking === 'ok' ? 'var(--orange-500)' : (checking === 'taken' || overLimit) ? '#E53935' : 'var(--fg3)',
          marginTop: 8, minHeight: 16,
          display: 'flex', justifyContent: 'space-between', gap: 8,
        }}>
          <span>
            {overLimit && '✕ 한글 5자 · 영문 8자를 넘었어요'}
            {!overLimit && checking === 'ok' && '✓ 사용 가능한 닉네임이에요'}
            {!overLimit && checking === 'taken' && '✕ 이미 사용 중인 닉네임이에요'}
            {!overLimit && checking === 'idle' && (variant === 'enhanced' ? '이름 · 상호 · 욕설은 사용할 수 없어요' : '한글 5자 · 영문 8자 이내')}
            {!overLimit && checking === 'checking' && '중복 확인 중…'}
          </span>
          <span style={{ color: overLimit ? '#E53935' : 'var(--fg4)', fontWeight: 700, flexShrink: 0 }}>
            {hasHangul ? `${[...nickname].filter(c => /[\uAC00-\uD7A3]/.test(c)).length}/5` : `${nickname.length}/8`}
          </span>
        </div>
      </div>

      {/* 생일 (선택) */}
      <div>
        <div style={{ font: '800 14px/1 var(--font-sans)', color: 'var(--fg1)', marginBottom: 6 }}>
          생일 <span style={{ color: 'var(--fg3)', fontWeight: 600, fontSize: 12 }}>선택</span>
        </div>
        <div style={{ font: '500 12px/1.5 var(--font-sans)', color: 'var(--fg3)', marginBottom: 12 }}>
          생일엔 특별한 쿠폰을 받을 수도 있어요 🎂
        </div>
        <button
          onClick={() => !birthSkip && setPickerOpen(true)}
          disabled={birthSkip}
          style={{
            width: '100%', textAlign: 'left',
            padding: '14px 16px', borderRadius: 12,
            background: birthSkip ? 'var(--gray-50)' : '#fff',
            border: `1.5px solid ${birthSkip ? 'var(--gray-150)' : birthMonth && birthDay ? 'var(--orange-500)' : 'var(--gray-200)'}`,
            font: `${!birthSkip && birthMonth && birthDay ? '700' : '500'} 16px/1 var(--font-sans)`,
            color: birthSkip ? 'var(--fg4)' : (birthMonth && birthDay) ? 'var(--fg1)' : 'var(--fg4)',
            cursor: birthSkip ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            opacity: birthSkip ? 0.6 : 1,
            transition: 'opacity 180ms, border-color 180ms, background 180ms',
          }}
        >
          <span>
            {birthSkip ? '생일 입력을 건너뛰었어요'
              : birthMonth && birthDay ? `${+birthMonth}월 ${+birthDay}일`
              : '생일을 선택해주세요'}
          </span>
          <span style={{ color: 'var(--fg4)', fontSize: 13 }}>›</span>
        </button>

        {/* 입력 안 함 토글 */}
        <button
          onClick={() => {
            const next = !birthSkip;
            setBirthSkip(next);
            if (next) { setBirthMonth(''); setBirthDay(''); setPickerOpen(false); }
          }}
          style={{
            width: '100%', marginTop: 10, padding: '10px 14px',
            background: 'transparent', border: 'none',
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          }}
        >
          <div style={{
            width: 20, height: 20, borderRadius: 6,
            background: birthSkip ? 'var(--orange-500)' : 'transparent',
            border: birthSkip ? 'none' : '1.8px solid var(--gray-300)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'all 180ms',
          }}>
            {birthSkip && <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
          </div>
          <span style={{
            font: `${birthSkip ? '700' : '600'} 13px/1 var(--font-sans)`,
            color: birthSkip ? 'var(--orange-500)' : 'var(--fg2)',
            letterSpacing: '-0.2px',
          }}>
            생일 입력 안 함
          </span>
        </button>
      </div>

      {pickerOpen && (
        <BirthdayPicker
          initialMonth={birthMonth ? +birthMonth : 1}
          initialDay={birthDay ? +birthDay : 1}
          onConfirm={(m, d) => {
            setBirthMonth(String(m).padStart(2,'0'));
            setBirthDay(String(d).padStart(2,'0'));
            setPickerOpen(false);
          }}
          onCancel={() => setPickerOpen(false)}
        />
      )}

      {variant === 'enhanced' && (
        <HelperMsg text="닉네임은 피드·댓글에 계속 보여요. 신중하게!" tone="warn" />
      )}

      <div style={{ flex: 1, minHeight: 20 }}/>

      <button onClick={onNext} disabled={!isValid} style={primaryButton(isValid)}>
        다음
      </button>
    </div>
  );
}

function BirthdayPicker({ initialMonth, initialDay, onConfirm, onCancel }) {
  const [month, setMonth] = React.useState(initialMonth);
  const [day, setDay] = React.useState(initialDay);

  const daysInMonth = (m) => {
    return [1,3,5,7,8,10,12].includes(m) ? 31 : m === 2 ? 29 : 30;
  };
  const maxDay = daysInMonth(month);
  React.useEffect(() => { if (day > maxDay) setDay(maxDay); }, [month, maxDay]);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      background: 'rgba(0,0,0,0.35)',
    }} onClick={onCancel}>
      <style>{`.hide-scroll::-webkit-scrollbar{display:none}.hide-scroll{scrollbar-width:none}`}</style>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#F2F2F7',
        borderTopLeftRadius: 14, borderTopRightRadius: 14,
        paddingBottom: 'env(safe-area-inset-bottom, 16px)',
      }}>
        {/* 툴바 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 16px', background: '#F9F9F9',
          borderBottom: '1px solid rgba(0,0,0,0.1)',
        }}>
          <button onClick={onCancel} style={{
            background: 'none', border: 'none', color: '#007AFF',
            font: '500 17px/1 var(--font-sans)', cursor: 'pointer', padding: 4,
          }}>취소</button>
          <div style={{ font: '600 15px/1 var(--font-sans)', color: 'var(--fg1)' }}>
            {month}월 {day}일
          </div>
          <button onClick={() => onConfirm(month, day)} style={{
            background: 'none', border: 'none', color: '#007AFF',
            font: '700 17px/1 var(--font-sans)', cursor: 'pointer', padding: 4,
          }}>확인</button>
        </div>

        {/* 휠 피커 */}
        <div style={{ display: 'flex', position: 'relative', height: 216 }}>
          {/* 중앙 하이라이트 바 */}
          <div style={{
            position: 'absolute', left: 12, right: 12, top: 'calc(50% - 18px)', height: 36,
            background: 'rgba(120,120,128,0.12)', borderRadius: 8, pointerEvents: 'none',
          }}/>
          <Wheel values={Array.from({length:12}, (_,i)=>i+1)} value={month} onChange={setMonth} suffix="월" />
          <Wheel values={Array.from({length:maxDay}, (_,i)=>i+1)} value={day} onChange={setDay} suffix="일" />
        </div>
      </div>
    </div>
  );
}

function Wheel({ values, value, onChange, suffix }) {
  const ITEM_H = 36;
  const ref = React.useRef(null);
  const scrollTimeout = React.useRef(null);
  const isProgrammatic = React.useRef(false);

  // 외부 value 변경 시 스크롤 이동 (clamp)
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = values.indexOf(value);
    if (idx < 0) return;
    isProgrammatic.current = true;
    el.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' });
    setTimeout(() => { isProgrammatic.current = false; }, 300);
  }, [value, values.length]);

  const handleScroll = () => {
    if (isProgrammatic.current) return;
    clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const idx = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(values.length - 1, idx));
      el.scrollTo({ top: clamped * ITEM_H, behavior: 'smooth' });
      const next = values[clamped];
      if (next !== value) onChange(next);
    }, 120);
  };

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      style={{
        flex: 1, height: 216, overflowY: 'scroll',
        scrollSnapType: 'y mandatory',
        WebkitOverflowScrolling: 'touch',
        maskImage: 'linear-gradient(to bottom, transparent 0%, #000 30%, #000 70%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 30%, #000 70%, transparent 100%)',
      }}
      className="hide-scroll"
    >
      <div style={{ height: 90 }}/>
      {values.map(v => (
        <div key={v} style={{
          height: ITEM_H, display: 'flex', alignItems: 'center', justifyContent: 'center',
          scrollSnapAlign: 'center',
          font: `${v === value ? '600' : '400'} 22px/1 var(--font-sans)`,
          color: v === value ? 'var(--fg1)' : 'var(--fg4)',
          transition: 'color 120ms, font-weight 120ms',
        }}>
          {v}{suffix}
        </div>
      ))}
      <div style={{ height: 90 }}/>
    </div>
  );
}

// ─── Step 4: 위치 + 업체 10개 팔로우 + 약관 바텀시트 ──────────
function NearbyStoresStep({ onNext, variant, followed, setFollowed }) {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [toastVisible, setToastVisible] = React.useState(false);
  const autoTriggeredRef = React.useRef(false); // 5번째 순간 1회만 자동 트리거

  const toggleFollow = (id) => {
    setFollowed(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      // 처음으로 5개에 도달한 순간 → 토스트 + 1초 후 약관 시트 자동 오픈
      if (!autoTriggeredRef.current && prev.length < 5 && next.length === 5) {
        autoTriggeredRef.current = true;
        setToastVisible(true);
        setTimeout(() => {
          setToastVisible(false);
          setSheetOpen(true);
        }, 1000);
      }
      return next;
    });
  };

  const hasMin = followed.length >= 5;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--gray-50)' }}>
      <div style={{ padding: '12px 24px 16px', background: '#fff', borderBottom: '1px solid var(--gray-150)' }}>
        <div style={{
          font: `900 ${variant === 'enhanced' ? 28 : 24}px/1.3 var(--font-sans)`,
          color: 'var(--fg1)', letterSpacing: '-0.8px', marginBottom: 6,
        }}>
          내 주변 가까운 가게를<br/>팔로우 해보세요
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 14 }}>📍</span>
          <span style={{ font: '700 13px/1 var(--font-sans)', color: 'var(--orange-500)' }}>창원시 의창구 팔용동</span>
          <span style={{ font: '500 12px/1 var(--font-sans)', color: 'var(--fg3)' }}>· 가까운 순</span>
        </div>

        {/* 진행 인디케이터 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--gray-150)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: hasMin ? 'var(--orange-500)' : 'var(--orange-300)',
              width: `${Math.min(followed.length, 5) / 5 * 100}%`,
              transition: 'all 300ms ease',
            }}/>
          </div>
          <div style={{
            font: '800 13px/1 var(--font-sans)',
            color: hasMin ? 'var(--orange-500)' : 'var(--fg2)',
            minWidth: 32, textAlign: 'right',
          }}>
            {followed.length}/5
          </div>
        </div>
        <div style={{ font: '500 12px/1.4 var(--font-sans)', color: 'var(--fg3)', marginTop: 8 }}>
          {hasMin ? '좋아요! 더 팔로우해도 돼요' : '언니픽에서 둘러볼 가게를 5곳 선택해주세요'}
        </div>
      </div>

      {/* 업체 리스트 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px 20px' }}>
        {NEARBY_STORES_PALYONG.map(s => {
          const isFollowed = followed.includes(s.id);
          return (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 12px', background: '#fff',
              borderRadius: 14, marginBottom: 8,
              border: isFollowed ? '1.5px solid var(--orange-500)' : '1.5px solid transparent',
              transition: 'border-color 180ms',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: isFollowed ? 'var(--orange-50)' : 'var(--gray-100)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, flexShrink: 0,
                transition: 'background 180ms',
              }}>{s.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '800 15px/1.2 var(--font-sans)', color: 'var(--fg1)', marginBottom: 3 }}>
                  {s.name}
                </div>
                <div style={{ font: '500 12px/1 var(--font-sans)', color: 'var(--fg3)' }}>
                  {s.cat} · {s.distance}m
                </div>
              </div>
              <button onClick={() => toggleFollow(s.id)} style={{
                padding: '9px 14px', borderRadius: 999,
                background: isFollowed ? 'var(--orange-500)' : '#fff',
                color: isFollowed ? '#fff' : 'var(--fg1)',
                border: `1.5px solid ${isFollowed ? 'var(--orange-500)' : 'var(--gray-200)'}`,
                font: '800 13px/1 var(--font-sans)', cursor: 'pointer',
                flexShrink: 0, transition: 'all 180ms',
              }}>
                {isFollowed ? '팔로잉' : '+ 팔로우'}
              </button>
            </div>
          );
        })}
      </div>

      {/* 하단 고정 CTA — 5개 선택 시에만 활성화 → 홈으로 이동 */}
      <div style={{ padding: '12px 24px 24px', background: '#fff', borderTop: '1px solid var(--gray-150)' }}>
        <button
          onClick={() => hasMin && setSheetOpen(true)}
          disabled={!hasMin}
          style={primaryButton(hasMin)}
        >
          {hasMin ? `팔로우 완료 (${followed.length})` : `${5 - followed.length}곳 더 선택해주세요`}
        </button>
      </div>

      {/* 약관 바텀시트 */}
      {sheetOpen && (
        <TermsSheet onClose={() => setSheetOpen(false)} onAgree={() => { setSheetOpen(false); setTimeout(onNext, 200); }}/>
      )}

      {/* 5곳 완료 토스트 (1초) */}
      {toastVisible && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 120,
          transform: 'translateX(-50%)',
          background: 'rgba(20,20,20,0.92)', color: '#fff',
          padding: '12px 20px', borderRadius: 999,
          font: '800 14px/1 var(--font-sans)', letterSpacing: '-0.2px',
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          animation: 'toast-pop 260ms cubic-bezier(0.22,1,0.36,1)',
          zIndex: 50,
        }}>
          <span style={{ fontSize: 16 }}>✨</span>
          5곳 팔로우 완료!
        </div>
      )}
      <style>{`
        @keyframes toast-pop {
          from { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.96); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0)    scale(1); }
        }
      `}</style>
    </div>
  );
}

// ─── 약관 바텀시트 ────────────────────────────────────────────
function TermsSheet({ onClose, onAgree }) {
  const [agreed, setAgreed] = React.useState({ all: false, tos: false, privacy: false, marketing: false });
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

  const toggleAll = () => {
    const v = !agreed.all;
    setAgreed({ all: v, tos: v, privacy: v, marketing: v });
  };
  const toggleOne = (key) => {
    const next = { ...agreed, [key]: !agreed[key] };
    next.all = next.tos && next.privacy && next.marketing;
    setAgreed(next);
  };
  const canAgree = agreed.tos && agreed.privacy;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 300,
      background: mounted ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)',
      transition: 'background 260ms ease',
      display: 'flex', alignItems: 'flex-end',
    }}
    onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', background: '#fff',
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        padding: '10px 24px 28px',
        transform: mounted ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 300ms cubic-bezier(0.22,1,0.36,1)',
      }}>
        {/* grabber */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--gray-200)', margin: '4px auto 14px' }}/>

        <div style={{ font: '900 20px/1.3 var(--font-sans)', color: 'var(--fg1)', letterSpacing: '-0.5px', marginBottom: 6 }}>
          약관에 동의해주세요
        </div>
        <div style={{ font: '500 13px/1.5 var(--font-sans)', color: 'var(--fg3)', marginBottom: 16 }}>
          서비스 이용을 위해 아래 약관에 동의가 필요해요
        </div>

        <div style={{ background: 'var(--gray-50)', borderRadius: 14, padding: '4px 14px', marginBottom: 20 }}>
          <TermRow checked={agreed.all} onChange={toggleAll} label="전체 동의" bold />
          <div style={{ height: 1, background: 'var(--gray-150)', margin: '0 -14px' }}/>
          <TermRow checked={agreed.tos} onChange={() => toggleOne('tos')} label="이용약관 동의" required />
          <TermRow checked={agreed.privacy} onChange={() => toggleOne('privacy')} label="개인정보 수집·이용 동의" required />
          <TermRow checked={agreed.marketing} onChange={() => toggleOne('marketing')} label="마케팅 알림 수신 동의" />
        </div>

        <button onClick={onAgree} disabled={!canAgree} style={primaryButton(canAgree)}>
          동의하고 시작하기
        </button>
      </div>
    </div>
  );
}

function TermRow({ checked, onChange, label, required, bold }) {
  return (
    <button onClick={onChange} style={{
      width: '100%', padding: '12px 0', border: 'none', background: 'none',
      display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        background: checked ? 'var(--orange-500)' : 'transparent',
        border: checked ? 'none' : '2px solid var(--gray-300)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {checked && <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
      </div>
      <div style={{
        font: bold ? '800 15px/1.3 var(--font-sans)' : '500 14px/1.3 var(--font-sans)',
        color: 'var(--fg1)', flex: 1, textAlign: 'left',
      }}>
        {required && <span style={{ color: 'var(--orange-500)', marginRight: 4 }}>[필수]</span>}
        {!required && !bold && <span style={{ color: 'var(--fg3)', marginRight: 4 }}>[선택]</span>}
        {label}
      </div>
      {!bold && <div style={{ font: '500 12px/1 var(--font-sans)', color: 'var(--fg3)' }}>보기 ›</div>}
    </button>
  );
}

// ─── Step 4: 위치 권한 요청 (풀스크린 · 거부 시 재요청 강제) ────
function LocationPermissionStep({ onNext, variant }) {
  const [denied, setDenied] = React.useState(false);

  const request = () => {
    // 프로덕션: navigator.geolocation.getCurrentPosition(success, err => setDenied(true))
    // 데모: 항상 성공으로 진행
    setDenied(false);
    setTimeout(onNext, 450);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', padding: '20px 24px 28px' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 28, paddingBottom: 40 }}>
        {/* 아이콘 */}
        <div style={{
          width: 128, height: 128, borderRadius: 36,
          background: 'linear-gradient(135deg, var(--orange-100), var(--orange-50))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 10px 30px rgba(255,111,15,0.15)',
        }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <path d="M12 21s-7-6.5-7-12a7 7 0 1114 0c0 5.5-7 12-7 12z" stroke="var(--orange-500)" strokeWidth="2" strokeLinejoin="round"/>
            <circle cx="12" cy="9" r="2.5" fill="var(--orange-500)"/>
          </svg>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ font: `900 ${variant === 'enhanced' ? 28 : 24}px/1.3 var(--font-sans)`, color: 'var(--fg1)', letterSpacing: '-0.8px', marginBottom: 14 }}>
            내 주변 가게를 찾으려면<br/>위치 정보가 필요해요
          </div>
          <div style={{ font: '500 15px/1.55 var(--font-sans)', color: 'var(--fg2)', letterSpacing: '-0.2px', maxWidth: 300, margin: '0 auto' }}>
            내 동네의 카페, 식당, 미용실 쿠폰을<br/>받아보려면 위치 권한이 필요해요.
          </div>
        </div>

        {/* 용도 리스트 */}
        <div style={{ width: '100%', background: 'var(--gray-50)', borderRadius: 16, padding: '18px 20px', display: 'grid', gap: 12 }}>
          {[
            ['📍', '반경 500m 가게 표시', '내 주변 핫플레이스 찾기'],
            ['🎟️', '긴급 쿠폰 알림', '가까운 가게의 실시간 딜'],
            ['🏃', '자동 매장 감지', '도장 적립 · 쿠폰 자동 사용'],
          ].map(([emo, t, d]) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{emo}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '800 14px/1.2 var(--font-sans)', color: 'var(--fg1)', marginBottom: 2 }}>{t}</div>
                <div style={{ font: '500 12px/1.3 var(--font-sans)', color: 'var(--fg3)' }}>{d}</div>
              </div>
            </div>
          ))}
        </div>

        {denied && (
          <div style={{ width: '100%', padding: '12px 16px', background: 'var(--orange-50)', border: '1.5px solid var(--orange-200)', borderRadius: 12, font: '600 13px/1.4 var(--font-sans)', color: 'var(--orange-700)', textAlign: 'center' }}>
            위치 권한을 허용해야 계속할 수 있어요.<br/>설정 앱에서 권한을 켜주세요.
          </div>
        )}
      </div>

      <button onClick={request} style={primaryButton(true)}>
        위치 권한 허용하기
      </button>
      <div style={{ font: '500 11.5px/1.4 var(--font-sans)', color: 'var(--fg3)', textAlign: 'center', marginTop: 10 }}>
        언제든지 설정 › 언니픽에서 변경할 수 있어요
      </div>
    </div>
  );
}

// ─── Step 6: 푸시 알림 권한 (풀스크린 · 거부해도 진행 허용) ────
function PushPermissionStep({ onDone, variant }) {
  const request = () => {
    // 프로덕션: Notification.requestPermission() → 결과 기록, 무조건 진행
    setTimeout(onDone, 350);
  };
  const skip = () => {
    // 거부/나중에 → 무조건 진행
    setTimeout(onDone, 200);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', padding: '20px 24px 28px' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 28, paddingBottom: 40 }}>
        <div style={{
          width: 128, height: 128, borderRadius: 36,
          background: 'linear-gradient(135deg, var(--orange-100), var(--orange-50))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 10px 30px rgba(255,111,15,0.15)',
          position: 'relative',
        }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9z" stroke="var(--orange-500)" strokeWidth="2" strokeLinejoin="round"/>
            <path d="M10 21a2 2 0 004 0" stroke="var(--orange-500)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <div style={{ position: 'absolute', top: 18, right: 20, width: 18, height: 18, borderRadius: 9, background: 'var(--orange-500)', border: '3px solid #fff' }}/>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ font: `900 ${variant === 'enhanced' ? 28 : 24}px/1.3 var(--font-sans)`, color: 'var(--fg1)', letterSpacing: '-0.8px', marginBottom: 14 }}>
            좋은 쿠폰을 놓치지 마세요
          </div>
          <div style={{ font: '500 15px/1.55 var(--font-sans)', color: 'var(--fg2)', letterSpacing: '-0.2px', maxWidth: 300, margin: '0 auto' }}>
            팔로우한 가게의 새 쿠폰과<br/>만료 임박 알림을 받아보세요.
          </div>
        </div>

        <div style={{ width: '100%', background: 'var(--gray-50)', borderRadius: 16, padding: '18px 20px', display: 'grid', gap: 12 }}>
          {[
            ['🎁', '새 쿠폰 알림', '팔로우 가게가 쿠폰 발행 시'],
            ['⏰', '만료 임박 알림', '저장한 쿠폰 만료 3일 · 1일 전'],
            ['🔥', '긴급 딜 알림', '내 주변 한정 수량 오픈'],
          ].map(([emo, t, d]) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{emo}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '800 14px/1.2 var(--font-sans)', color: 'var(--fg1)', marginBottom: 2 }}>{t}</div>
                <div style={{ font: '500 12px/1.3 var(--font-sans)', color: 'var(--fg3)' }}>{d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={request} style={primaryButton(true)}>
        알림 받기
      </button>
      <button onClick={skip} style={{
        width: '100%', padding: 14, marginTop: 8, border: 'none', background: 'none',
        font: '700 14px/1 var(--font-sans)', color: 'var(--fg3)', cursor: 'pointer',
      }}>
        나중에 설정할게요
      </button>
    </div>
  );
}

// ─── AuthFlow orchestrator ────────────────────────────────────
function AuthFlow({ onDone, onClose, variant = 'basic', initialStep = 1 }) {
  const [step, setStep] = React.useState(initialStep);
  const [phone, setPhone] = React.useState(initialStep >= 2 ? '01012345678' : '');
  const [profile, setProfile] = React.useState({ nickname: initialStep >= 4 ? '언니픽' : '', birthMonth: '', birthDay: '' });
  const [followed, setFollowed] = React.useState(initialStep >= 6 ? ['s1','s2','s3','s4','s5'] : []);
  const total = 6;

  const back = () => {
    if (step === 1) { onClose && onClose(); return; }
    setStep(step - 1);
  };
  const next = () => setStep(step + 1);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 100, background: '#fff', display: 'flex', flexDirection: 'column' }}>
      <AuthHeader step={step} total={total} onBack={back}/>
      {step === 1 && <PhoneStep phone={phone} setPhone={setPhone} onNext={next} variant={variant}/>}
      {step === 2 && <CodeStep phone={phone} onNext={next} variant={variant}/>}
      {step === 3 && <ProfileStep profile={profile} setProfile={setProfile} onNext={next} variant={variant}/>}
      {step === 4 && <LocationPermissionStep onNext={next} variant={variant}/>}
      {step === 5 && <NearbyStoresStep onNext={next} variant={variant} followed={followed} setFollowed={setFollowed}/>}
      {step === 6 && <PushPermissionStep onDone={onDone} variant={variant}/>}
    </div>
  );
}

Object.assign(window, { AuthFlow });
