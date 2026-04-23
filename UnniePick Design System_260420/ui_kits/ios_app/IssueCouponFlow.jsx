// IssueCouponFlow — 사장님 쿠폰 발행 4단계 플로우
// ① 유형 선택 → ② 내용 입력 → ③ 설정 → ④ 발행

const COUPON_TYPES = [
  { key: 'percent', icon: '🏷', title: '할인율', desc: '% 단위 할인 (예: 20% 할인)', example: '20%' },
  { key: 'amount', icon: '💸', title: '금액 할인', desc: '원 단위 할인 (예: 3,000원 할인)', example: '3,000원' },
  { key: 'free', icon: '🎁', title: '무료 증정', desc: '조건 충족 시 무료 제공 (1+1 등)', example: '1+1' },
];

const LIMIT_PRESETS = [
  { key: 'unlimited', label: '무제한', desc: '발행 기간 동안 계속' },
  { key: 'first_50', label: '선착순 50명', desc: 'SNS 공유에 효과적' },
  { key: 'first_10', label: '선착순 10명', desc: '희소성으로 긴급 효과' },
  { key: 'custom', label: '직접 입력', desc: '원하는 수량 설정' },
];

const PERIOD_PRESETS = [
  { key: 'today', label: '오늘만', days: 0, hot: true },
  { key: '3days', label: '3일', days: 3 },
  { key: '1week', label: '1주일', days: 7 },
  { key: '2weeks', label: '2주일', days: 14 },
];

function StepDots({ step, total = 4 }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '14px 0 2px' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i + 1 === step ? 24 : 6, height: 6, borderRadius: 3,
          background: i + 1 <= step ? 'var(--orange-500)' : 'var(--gray-200)',
          transition: 'width 180ms ease',
        }} />
      ))}
    </div>
  );
}

function FlowHeader({ step, onBack, onClose }) {
  const titles = ['쿠폰 유형 선택', '쿠폰 내용 입력', '발행 설정', '미리보기 & 발행'];
  return (
    <div style={{
      background: '#fff', padding: '50px 16px 10px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: '1px solid var(--gray-150)',
    }}>
      <button onClick={step === 1 ? onClose : onBack} style={{ background: 'none', border: 'none', padding: 8, fontSize: 20, color: 'var(--fg1)' }}>
        {step === 1 ? '✕' : '←'}
      </button>
      <div style={{ font: '800 16px/1 var(--font-sans)', color: 'var(--fg1)', letterSpacing: '-0.3px' }}>
        {titles[step - 1]}
      </div>
      <div style={{ font: '700 13px/1 var(--font-sans)', color: 'var(--fg3)', width: 40, textAlign: 'right' }}>
        {step}/4
      </div>
    </div>
  );
}

function Step1Type({ value, onChange }) {
  return (
    <div style={{ padding: '20px 20px 40px' }}>
      <div style={{ font: '900 22px/1.3 var(--font-sans)', color: 'var(--fg1)', letterSpacing: '-0.5px', marginBottom: 6 }}>
        어떤 쿠폰을 발행할까요?
      </div>
      <div style={{ font: '400 13px/1.5 var(--font-sans)', color: 'var(--fg3)', marginBottom: 20 }}>
        발행 후에는 유형을 바꿀 수 없어요
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {COUPON_TYPES.map(t => (
          <button key={t.key} onClick={() => onChange(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: 16,
            background: value === t.key ? 'var(--orange-50)' : '#fff',
            border: value === t.key ? '2px solid var(--orange-500)' : '1.5px solid var(--gray-150)',
            borderRadius: 16, textAlign: 'left', cursor: 'pointer',
          }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: value === t.key ? 'var(--orange-500)' : 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
              {t.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '800 16px/1.2 var(--font-sans)', color: 'var(--fg1)', letterSpacing: '-0.3px' }}>{t.title}</div>
              <div style={{ font: '400 12px/1.3 var(--font-sans)', color: 'var(--fg3)', marginTop: 4 }}>{t.desc}</div>
            </div>
            <div style={{ font: '900 18px/1 var(--font-sans)', color: value === t.key ? 'var(--orange-500)' : 'var(--gray-400)' }}>
              {t.example}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Step2Content({ data, onChange }) {
  const type = COUPON_TYPES.find(t => t.key === data.type);
  const valueSuffix = data.type === 'percent' ? '%' : data.type === 'amount' ? '원' : '';
  const valueLabel = data.type === 'percent' ? '할인율' : data.type === 'amount' ? '할인 금액' : '증정 내용';
  return (
    <div style={{ padding: '20px 20px 40px' }}>
      <div style={{ background: 'var(--orange-50)', borderRadius: 10, padding: '10px 14px', marginBottom: 18, font: '600 13px/1.4 var(--font-sans)', color: 'var(--orange-700)' }}>
        {type?.icon} {type?.title} 쿠폰
      </div>
      <Field label="쿠폰 제목" hint="손님 피드에 크게 보이는 제목이에요">
        <input type="text" value={data.title} onChange={e => onChange({ ...data, title: e.target.value })}
          placeholder="예: 아메리카노 1+1"
          style={inputStyle} />
      </Field>
      <Field label="대상 메뉴/서비스">
        <input type="text" value={data.target} onChange={e => onChange({ ...data, target: e.target.value })}
          placeholder="예: 모든 음료 / 컷트+염색"
          style={inputStyle} />
      </Field>
      {data.type !== 'free' && (
        <Field label={valueLabel}>
          <div style={{ position: 'relative' }}>
            <input type="text" inputMode="numeric" value={data.value} onChange={e => onChange({ ...data, value: e.target.value.replace(/\D/g, '') })}
              placeholder="예: 20"
              style={{ ...inputStyle, paddingRight: 48, font: '800 20px/1 var(--font-sans)', textAlign: 'right' }} />
            <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', font: '800 18px/1 var(--font-sans)', color: 'var(--fg3)' }}>
              {valueSuffix}
            </div>
          </div>
        </Field>
      )}
      <Field label="한줄 메모 (선택)" hint="피드에 함께 올라가는 간단한 설명">
        <textarea value={data.memo} onChange={e => onChange({ ...data, memo: e.target.value })}
          placeholder="예: 이번 주 한정! 놓치지 마세요"
          rows={3} style={{ ...inputStyle, resize: 'none', fontFamily: 'var(--font-sans)' }} />
      </Field>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 12,
  background: 'var(--gray-100)', border: '1.5px solid transparent',
  font: '500 15px/1.3 var(--font-sans)', color: 'var(--fg1)',
  outline: 'none', boxSizing: 'border-box',
};

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ font: '700 13px/1 var(--font-sans)', color: 'var(--fg2)', marginBottom: 8, letterSpacing: '-0.2px' }}>
        {label}
      </div>
      {children}
      {hint && <div style={{ font: '400 11px/1.3 var(--font-sans)', color: 'var(--fg3)', marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

function Step3Settings({ data, onChange }) {
  return (
    <div style={{ padding: '20px 20px 40px' }}>
      <Field label="수량 한도">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {LIMIT_PRESETS.map(p => (
            <button key={p.key} onClick={() => onChange({ ...data, limit: p.key })} style={{
              padding: '12px 14px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
              background: data.limit === p.key ? 'var(--orange-50)' : '#fff',
              border: data.limit === p.key ? '2px solid var(--orange-500)' : '1.5px solid var(--gray-150)',
            }}>
              <div style={{ font: '800 13px/1 var(--font-sans)', color: 'var(--fg1)', marginBottom: 4 }}>{p.label}</div>
              <div style={{ font: '400 11px/1.3 var(--font-sans)', color: 'var(--fg3)' }}>{p.desc}</div>
            </button>
          ))}
        </div>
      </Field>

      <Field label="발행 기간">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PERIOD_PRESETS.map(p => (
            <button key={p.key} onClick={() => onChange({ ...data, period: p.key })} style={{
              padding: '10px 14px', borderRadius: 20, cursor: 'pointer',
              background: data.period === p.key ? 'var(--orange-500)' : 'var(--gray-100)',
              color: data.period === p.key ? '#fff' : 'var(--fg2)',
              border: 'none',
              font: '700 13px/1 var(--font-sans)',
              position: 'relative',
            }}>
              {p.label}
              {p.hot && data.period !== p.key && (
                <span style={{ position: 'absolute', top: -4, right: -4, width: 6, height: 6, borderRadius: '50%', background: '#E53935' }} />
              )}
            </button>
          ))}
        </div>
      </Field>

      <Field label="팔로워 알림" hint="발행 즉시 팔로워 전원에게 푸시 알림이 발송돼요">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '14px 16px', background: 'var(--orange-50)', borderRadius: 12, border: '1.5px solid var(--orange-300)' }}>
          <div style={{ fontSize: 24 }}>🔔</div>
          <div style={{ flex: 1 }}>
            <div style={{ font: '800 14px/1.2 var(--font-sans)', color: 'var(--fg1)' }}>즉시 알림 발송</div>
            <div style={{ font: '400 12px/1.3 var(--font-sans)', color: 'var(--fg3)', marginTop: 3 }}>
              팔로워 <b style={{ color: 'var(--orange-500)' }}>1,230명</b>에게 푸시
            </div>
          </div>
          <Switch on={data.notify} onChange={v => onChange({ ...data, notify: v })} />
        </div>
      </Field>
    </div>
  );
}

function Switch({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      width: 44, height: 26, borderRadius: 13, padding: 2, border: 'none',
      background: on ? 'var(--orange-500)' : 'var(--gray-300)',
      display: 'flex', alignItems: 'center', cursor: 'pointer',
      transition: 'background 160ms ease',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', background: '#fff',
        marginLeft: on ? 18 : 0,
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        transition: 'margin 160ms ease',
      }}/>
    </button>
  );
}

function Step4Preview({ data, store }) {
  const periodLabel = PERIOD_PRESETS.find(p => p.key === data.period)?.label || '오늘만';
  const limitLabel = LIMIT_PRESETS.find(p => p.key === data.limit)?.label || '선착순 50명';
  const badgeText = data.period === 'today' ? '오늘만' : 'NEW';
  const valueText = data.type === 'percent' ? `${data.value || 0}% 할인`
                  : data.type === 'amount' ? `${Number(data.value || 0).toLocaleString()}원 할인`
                  : '무료 증정';
  return (
    <div style={{ padding: '16px 20px 40px' }}>
      <div style={{ font: '700 11px/1 var(--font-sans)', color: 'var(--fg3)', marginBottom: 8, letterSpacing: 0.3, textTransform: 'uppercase' }}>
        📱 손님 피드에서 이렇게 보여요
      </div>

      {/* Mock feed post preview */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--gray-150)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <StoreAvatar name={store.name} emoji={store.emoji} size="sm" />
          <div style={{ flex: 1 }}>
            <div style={{ font: '800 14px/1.2 var(--font-sans)', color: 'var(--fg1)' }}>{store.name}</div>
            <div style={{ font: '400 11px/1.2 var(--font-sans)', color: 'var(--fg3)' }}>{store.category} · 방금</div>
          </div>
        </div>
        {data.memo && (
          <div style={{ padding: '0 16px 12px', font: '400 13px/18px var(--font-sans)', color: 'var(--fg1)' }}>
            {data.memo}
          </div>
        )}
        <div style={{ padding: '0 16px 16px' }}>
          <div className="up-coupon">
            <div className="up-coupon-top">
              <div className="up-coupon-title">{data.title || '쿠폰 제목'}</div>
              <div className="up-coupon-badge" style={{ background: badgeText === '오늘만' ? '#E53935' : undefined }}>{badgeText}</div>
            </div>
            {data.target && (
              <div style={{ font: '500 13px/1.3 var(--font-sans)', color: 'var(--fg2)', marginBottom: 6 }}>
                대상: {data.target}
              </div>
            )}
            <div style={{ font: '900 20px/1 var(--font-sans)', color: 'var(--orange-500)', letterSpacing: '-0.5px', marginBottom: 8 }}>
              {valueText}
            </div>
            <div className="up-coupon-foot">
              <div className="up-coupon-meta">📅 {periodLabel} · 🎟 {limitLabel}</div>
              <button className="up-btn up-btn-small up-btn-primary">쿠폰받기</button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div style={{ marginTop: 18, padding: '14px 16px', background: 'var(--gray-50)', borderRadius: 12, border: '1px solid var(--gray-150)' }}>
        <SummaryRow label="쿠폰 제목" value={data.title || '—'} />
        <SummaryRow label="유형" value={COUPON_TYPES.find(t => t.key === data.type)?.title || '—'} />
        <SummaryRow label="수량" value={limitLabel} />
        <SummaryRow label="기간" value={periodLabel} />
        <SummaryRow label="알림" value={data.notify ? '🔔 팔로워 1,230명에게 즉시 발송' : '알림 없이 발행'} last />
      </div>
    </div>
  );
}

function SummaryRow({ label, value, last }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '8px 0', borderBottom: last ? 'none' : '1px solid var(--gray-150)',
      gap: 12,
    }}>
      <div style={{ font: '500 12px/1.2 var(--font-sans)', color: 'var(--fg3)', flexShrink: 0 }}>{label}</div>
      <div style={{ font: '700 13px/1.3 var(--font-sans)', color: 'var(--fg1)', textAlign: 'right', minWidth: 0, wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

function SuccessScreen({ data, onDone }) {
  const [count, setCount] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setCount(c => c < 127 ? c + Math.ceil((127 - c) / 8) : 127), 40);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, background: '#fff' }}>
      <div style={{
        width: 96, height: 96, borderRadius: '50%',
        background: 'linear-gradient(135deg,#FF6F0F,#FF9A3D)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 10px 30px rgba(255,111,15,0.35)',
        marginBottom: 24,
      }}>
        <div style={{ fontSize: 48 }}>✓</div>
      </div>
      <div style={{ font: '900 28px/1.2 var(--font-sans)', color: 'var(--fg1)', letterSpacing: '-0.6px', marginBottom: 10, textAlign: 'center' }}>
        쿠폰 발행 완료!
      </div>
      <div style={{ font: '500 14px/1.5 var(--font-sans)', color: 'var(--fg3)', textAlign: 'center', marginBottom: 30 }}>
        "{data.title || '쿠폰'}"이 팔로워에게 전달됐어요
      </div>
      <div style={{ background: 'var(--orange-50)', borderRadius: 16, padding: '16px 20px', display: 'flex', gap: 28, marginBottom: 30 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ font: '500 11px/1 var(--font-sans)', color: 'var(--fg3)', marginBottom: 6 }}>알림 발송</div>
          <div style={{ font: '900 22px/1 var(--font-sans)', color: 'var(--orange-500)', letterSpacing: '-0.5px' }}>1,230<span style={{ font: '700 13px/1 var(--font-sans)' }}>명</span></div>
        </div>
        <div style={{ width: 1, background: 'var(--orange-100)' }}/>
        <div style={{ textAlign: 'center' }}>
          <div style={{ font: '500 11px/1 var(--font-sans)', color: 'var(--fg3)', marginBottom: 6 }}>벌써 저장</div>
          <div style={{ font: '900 22px/1 var(--font-sans)', color: 'var(--orange-500)', letterSpacing: '-0.5px' }}>{count}<span style={{ font: '700 13px/1 var(--font-sans)' }}>명</span></div>
        </div>
      </div>
      <button onClick={onDone} className="up-btn up-btn-primary" style={{ width: '100%', maxWidth: 280, padding: 14, borderRadius: 14 }}>
        대시보드로 돌아가기
      </button>
    </div>
  );
}

function IssueCouponFlow({ onClose, store = { name: '카페봄날', emoji: '☕', category: '☕ 카페' } }) {
  const [step, setStep] = React.useState(1);
  const [done, setDone] = React.useState(false);
  const [data, setData] = React.useState({
    type: 'percent',
    title: '',
    target: '',
    value: '',
    memo: '',
    limit: 'first_50',
    period: 'today',
    notify: true,
  });

  if (done) return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 90, background: '#fff', display: 'flex', flexDirection: 'column' }}>
      <SuccessScreen data={data} onDone={onClose}/>
    </div>
  );

  const canAdvance =
    step === 1 ? !!data.type :
    step === 2 ? (data.title.trim() && (data.type === 'free' || data.value)) :
    step === 3 ? (data.limit && data.period) :
    true;

  const next = () => {
    if (step < 4) setStep(step + 1);
    else setDone(true);
  };
  const back = () => setStep(step - 1);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 90, background: 'var(--gray-50)', display: 'flex', flexDirection: 'column' }}>
      <FlowHeader step={step} onBack={back} onClose={onClose}/>
      <StepDots step={step}/>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {step === 1 && <Step1Type value={data.type} onChange={v => setData({ ...data, type: v })}/>}
        {step === 2 && <Step2Content data={data} onChange={setData}/>}
        {step === 3 && <Step3Settings data={data} onChange={setData}/>}
        {step === 4 && <Step4Preview data={data} store={store}/>}
      </div>
      <div style={{
        padding: '12px 16px 34px', background: '#fff',
        borderTop: '1px solid var(--gray-150)',
      }}>
        <button
          onClick={next}
          disabled={!canAdvance}
          style={{
            width: '100%', padding: 16, borderRadius: 14, border: 'none',
            background: canAdvance ? 'var(--orange-500)' : 'var(--gray-200)',
            color: canAdvance ? '#fff' : 'var(--gray-500)',
            font: '900 16px/1 var(--font-sans)', letterSpacing: '-0.3px',
            boxShadow: canAdvance ? 'var(--shadow-brand)' : 'none',
            cursor: canAdvance ? 'pointer' : 'not-allowed',
          }}
        >
          {step === 4 ? (data.notify ? '🔔 팔로워에게 즉시 알림' : '쿠폰 발행하기') : '다음'}
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { IssueCouponFlow });
