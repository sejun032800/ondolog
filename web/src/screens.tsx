/**
 * 온보딩 A01~A17 웹 이식판. 원본: app/index.tsx, app/(onboarding)/*.tsx, app/(modals)/legal-document.tsx.
 * 채점·규칙·문항·라벨은 저장소 정본(src/engine · constants · data · store · utils, 별칭 @/)를 수정 없이 쓴다. 서버 호출은 전부 뺐다 — 모든 값은 브라우저 메모리(zustand)에만 있다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { buildDescription } from './description'
import { useSessionStore, type Gender } from '@/store/sessionStore'
import type { MbtiType, QuizChoice } from '@/constants/quizTypes'
import type { QuickMbtiChoice } from '@/constants/quickMbti'
import { ONBOARDING_QUESTIONS } from '@/data/onboardingQuestions'
import { ENNEAGRAM_CORE_EN, ENNEAGRAM_CORE_KO, LOVE_TYPE_LABEL_BY_CODE } from '@/constants/loveTypeLabels'
import { MBTI_ENNEAGRAM_PREVALENCE } from '@/constants/enneagramPrevalence'
import { LEGAL_DOCUMENTS, type LegalDocumentKey } from '@/constants/legalDocuments'
import { COMPATIBILITY, COMPATIBILITY_FRAMING_TEXT } from '@/constants/compatibility'
import { COMPATIBILITY_START_TEMPERATURE_NOTICE } from '@/constants/resultDetailCopy'
import { ATTACHMENT_LABEL_KO } from '@/constants/attachment'
import type { EnneagramCore } from '@/constants/enneagram'
import { computeLoveTypeCode } from '@/engine/loveTypeInference'
import { getEnneagramCandidates } from '@/utils/enneagramCandidates'
import { sternbergGeometry } from '@/utils/sternbergGeometry'
import {
  canAgree, formatBirthInput, isAgeEligible, isAllConsented, parseBirthInput, toggleAllConsent, birthIsoToInput,
} from '@/utils/onboardingRules'
import { useBackHandler } from './platform/backStack'
import {
  BackArrow, ChoiceCard, CheckBox, ConsentRow, LinkButton, OnboardingScreen, PrimaryButton, StepBars, StepCounter,
  Wordmark, useAfter, useInView, useToast,
} from './ui'

export type ScreenName =
  | 'intro' | 'basic' | 'mbti' | 'quiz' | 'brief' | 'share' | 'consent' | 'underage' | 'auth' | 'detail' | 'invite' | 'end'

export interface Nav {
  push: (s: ScreenName) => void
  back: () => void
  reset: (s: ScreenName) => void
}

/* ═══ A01 · A02 스플래시 → 시작 ═══════════════════════════════ */
let introPlayed = false

export function IntroScreen({ nav, onPhase }: { nav: Nav; onPhase: (p: 'splash' | 'start') => void }) {
  const [phase, setPhase] = useState<'splash' | 'start'>(introPlayed ? 'start' : 'splash')
  const [orbit, setOrbit] = useState(false)
  const [dotOn, setDotOn] = useState(introPlayed)
  const dotRef = useRef<HTMLSpanElement>(null)
  const timers = useRef<number[]>([])

  useEffect(() => { onPhase(phase) }, [phase, onPhase])

  useEffect(() => {
    if (introPlayed) return
    const T = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))
    T(1900, () => setDotOn(true))
    T(2500, () => setOrbit(true))
    T(5300, () => { setPhase('start'); introPlayed = true })
    return () => timers.current.forEach(clearTimeout)
  }, [])

  // 가장 밝은 점이 글자표 주위를 한 바퀴 돈다(위 → 오른쪽 → 아래 → 왼쪽 → 위).
  useEffect(() => {
    if (!orbit) return
    const el = dotRef.current
    if (!el) return
    const DUR = 2600, RX = 132, RY = 46
    let raf = 0
    const t0 = performance.now()
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / DUR)
      const th = -Math.PI / 2 + ease(t) * Math.PI * 2
      const x = RX * Math.cos(th)
      const y = RY + RY * Math.sin(th)
      const glow = 1 + 0.6 * Math.sin(t * Math.PI)
      el.style.transform = `translate(${x}px, ${y}px) scale(${glow})`
      el.style.boxShadow = `0 0 ${14 + 10 * Math.sin(t * Math.PI)}px ${5 + 3 * Math.sin(t * Math.PI)}px rgba(244,185,200,${0.5 + 0.25 * Math.sin(t * Math.PI)})`
      if (t < 1) raf = requestAnimationFrame(step)
      else { el.style.transform = ''; el.style.boxShadow = '' }
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [orbit])

  const skip = () => {
    if (phase === 'start') return
    timers.current.forEach(clearTimeout)
    setDotOn(true)
    setPhase('start')
    introPlayed = true
  }

  const start = phase === 'start'
  const size = start ? 14 : 17
  return (
    <div className="screen" onClick={skip}>
      <div className="wm" style={{ top: start ? '29.4%' : '38.8%' }} aria-label="ONDOLOG">
        <span ref={dotRef} className={`dot ${dotOn && !introPlayed ? 'dotIn' : ''}`} style={{ opacity: dotOn ? 1 : 0 }} />
        <span className="word" style={{ fontSize: size, letterSpacing: size * 0.46, paddingLeft: size * 0.46 }}>
          {'ONDOLOG'.split('').map((ch, i) => (
            <span key={i} style={introPlayed && start ? { opacity: 1, animation: 'none' } : { animationDelay: `${300 + i * 120}ms` }}>{ch}</span>
          ))}
        </span>
        <span className="cap" style={{ opacity: start ? 0 : 1, animation: introPlayed ? undefined : 'fadeIn 900ms ease-out 1300ms both' }}>온도록</span>
      </div>
      {start ? (
        <>
          <h1 className="t-display c-text pre" style={{ position: 'absolute', left: 0, right: 0, top: 'calc(40% - 18px)', textAlign: 'center', animation: 'appear 900ms cubic-bezier(.2,.7,.2,1) 350ms both' }}>
            {'두 사람의 기록이\n한 권의 잡지가 돼요'}
          </h1>
          <div className="footer" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, gap: 4, paddingBottom: 'calc(var(--bot) + 40px)', animation: 'appear 800ms cubic-bezier(.2,.7,.2,1) 800ms both' }}>
            <PrimaryButton label="시작하기" onClick={() => { useSessionStore.getState().setExistingAccountPath(false); nav.push('basic') }} />
            <LinkButton label="이미 계정이 있어요" onClick={() => { useSessionStore.getState().setExistingAccountPath(true); nav.push('auth') }} />
          </div>
        </>
      ) : null}
    </div>
  )
}

/* ═══ A03 기본정보 ═══════════════════════════════════════════ */
const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: 'male', label: '남' }, { value: 'female', label: '여' }, { value: 'other', label: '기타' },
]

export function BasicInfoScreen({ nav }: { nav: Nav }) {
  const { name, gender, birthDate, setName, setGender, setBirthDate } = useSessionStore()
  const [birthText, setBirthText] = useState(birthIsoToInput(birthDate))
  const canProceed = name.trim().length > 0 && gender !== null && birthDate !== null
  const onBirth = (raw: string) => {
    const f = formatBirthInput(raw)
    setBirthText(f)
    setBirthDate(parseBirthInput(f, new Date()))
  }
  return (
    <OnboardingScreen
      onBack={nav.back}
      headerRight={<StepBars current={1} />}
      title="먼저 알려주세요"
      subtitle={'결과를 보고 가입할지 정해도 돼요.\n결과는 익명 통계로만 쓰여요.'}
      footer={<PrimaryButton label="다음" disabled={!canProceed} onClick={() => nav.push('mbti')} />}
    >
      <div className="group">
        <p className="t-sub c-mute label">이름</p>
        <input className="input" value={name} maxLength={20} placeholder="이름" onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="group">
        <p className="t-sub c-mute label">성별</p>
        <div className="seg">
          {GENDER_OPTIONS.map((o) => (
            <button key={o.value} className={`press ${gender === o.value ? 'on' : ''}`} onClick={() => setGender(o.value)}>{o.label}</button>
          ))}
        </div>
      </div>
      <div className="group">
        <p className="t-sub c-mute label">생년월일</p>
        <input className="input" value={birthText} inputMode="numeric" maxLength={10} placeholder="YYYY.MM.DD" onChange={(e) => onBirth(e.target.value)} />
        <p className="t-sub c-mute" style={{ marginTop: 10, textAlign: 'right', paddingRight: 4 }}>나이 확인에만 써요</p>
      </div>
    </OnboardingScreen>
  )
}

/* ═══ A04 · A05 · A06 MBTI ═══════════════════════════════════ */
type Axis = 'ei' | 'sn' | 'ft' | 'jp'
const MBTI_AXES: Array<{ key: Axis; left: { letter: string; name: string }; right: { letter: string; name: string } }> = [
  { key: 'ei', left: { letter: 'E', name: '외향' }, right: { letter: 'I', name: '내향' } },
  { key: 'sn', left: { letter: 'S', name: '감각' }, right: { letter: 'N', name: '직관' } },
  { key: 'ft', left: { letter: 'F', name: '감정' }, right: { letter: 'T', name: '사고' } },
  { key: 'jp', left: { letter: 'J', name: '판단' }, right: { letter: 'P', name: '인식' } },
]
/** MASTER 9-1 화면 3 "간이 4문항(초안)" 원문 — 앱 mbti.tsx 그대로. */
const QUICK_QUESTIONS: Array<{ axis: Axis; kicker: string; prompt: string; a: string; b: string }> = [
  { axis: 'ei', kicker: 'E · I', prompt: '친구들과의 모임에서 나는?', a: '여러 사람과 어울리며 에너지를 얻는다', b: '소수와 깊게 대화할 때 더 편하다' },
  { axis: 'sn', kicker: 'S · N', prompt: '새로운 걸 배울 때 나는?', a: '구체적인 사실과 경험을 먼저 확인한다', b: '전체 흐름과 가능성을 먼저 상상한다' },
  { axis: 'ft', kicker: 'F · T', prompt: '결정을 내릴 때 나는?', a: '사람들의 감정과 관계를 먼저 고려한다', b: '논리와 원칙을 먼저 고려한다' },
  { axis: 'jp', kicker: 'J · P', prompt: '계획을 세울 때 나는?', a: '미리 정해두고 그대로 진행하는 게 편하다', b: '상황에 따라 유연하게 바꾸는 게 편하다' },
]

export function MbtiScreen({ nav }: { nav: Nav }) {
  const { mbtiKnown, setMbtiKnown, mbti: storeMbti, mbtiSelfReported, setMbtiSelfReported, quickMbtiAnswers, setQuickMbtiAnswer } = useSessionStore()
  const [mode, setMode] = useState<'choose' | 'known' | 'unknown'>('choose')
  const [qi, setQi] = useState(0)
  const [letters, setLetters] = useState<Partial<Record<Axis, string>>>(() =>
    storeMbti && mbtiSelfReported ? { ei: storeMbti[0], sn: storeMbti[1], ft: storeMbti[2], jp: storeMbti[3] } : {})

  if (mode === 'choose') {
    return (
      <OnboardingScreen
        animKey="choose"
        onBack={nav.back}
        headerRight={<StepBars current={2} />}
        title={'MBTI를\n알고 있나요?'}
        footer={<PrimaryButton label="다음" disabled={mbtiKnown === null} onClick={() => { setQi(0); setMode(mbtiKnown ? 'known' : 'unknown') }} />}
      >
        <div className="stack12" style={{ marginTop: 36 }}>
          <ChoiceCard label="알아요" sub="MBTI를 직접 고를게요" selected={mbtiKnown === true} onClick={() => setMbtiKnown(true)} />
          <ChoiceCard label="몰라요" sub="네 가지만 물어볼게요" selected={mbtiKnown === false} onClick={() => setMbtiKnown(false)} />
        </div>
      </OnboardingScreen>
    )
  }

  if (mode === 'known') {
    const code = MBTI_AXES.map((ax) => letters[ax.key] ?? '').join('')
    const complete = code.length === 4
    return (
      <OnboardingScreen
        animKey="known"
        onBack={() => setMode('choose')}
        headerRight={<StepBars current={2} />}
        title="네 글자를 골라주세요"
        footer={<PrimaryButton label="다음" disabled={!complete} onClick={() => { setMbtiSelfReported(code as MbtiType); nav.push('quiz') }} />}
      >
        <p className="mbtiPreview">{MBTI_AXES.map((ax) => letters[ax.key] ?? '·').join('')}</p>
        <div className="grid">
          {MBTI_AXES.map((ax) => (
            <div key={ax.key}>
              {[ax.left, ax.right].map((opt) => (
                <button key={opt.letter} className={`letterBtn press ${letters[ax.key] === opt.letter ? 'on' : ''}`}
                  onClick={() => setLetters((p) => ({ ...p, [ax.key]: opt.letter }))}>
                  {opt.letter} {opt.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      </OnboardingScreen>
    )
  }

  const q = QUICK_QUESTIONS[qi]
  const picked = quickMbtiAnswers[q.axis]
  const choose = (c: QuickMbtiChoice) => {
    setQuickMbtiAnswer(q.axis, c)
    if (qi < QUICK_QUESTIONS.length - 1) window.setTimeout(() => setQi(qi + 1), 160)
    else window.setTimeout(() => nav.push('quiz'), 160)
  }
  return (
    <OnboardingScreen
      animKey={`q${qi}`}
      onBack={() => (qi > 0 ? setQi(qi - 1) : setMode('choose'))}
      headerRight={<StepCounter current={qi + 1} total={QUICK_QUESTIONS.length} />}
      footer={<p className="t-sub c-mute" style={{ textAlign: 'center' }}>하나를 고르면 다음 질문으로 넘어가요</p>}
    >
      <p className="t-kicker c-mute" style={{ marginTop: 4 }}>{q.kicker}</p>
      <h1 className="t-display c-text" style={{ marginTop: 20 }}>{q.prompt}</h1>
      <div className="stack12" style={{ marginTop: 36 }}>
        <ChoiceCard label={q.a} selected={picked === 'A'} onClick={() => choose('A')} />
        <ChoiceCard label={q.b} selected={picked === 'B'} onClick={() => choose('B')} />
      </div>
    </OnboardingScreen>
  )
}

/* ═══ A07 연애유형 5문항 ═════════════════════════════════════ */
export function LoveQuizScreen({ nav }: { nav: Nav }) {
  const s = useSessionStore()
  const [index, setIndex] = useState(0)
  if (!s.mbti) return null
  const questions = ONBOARDING_QUESTIONS[s.mbti]
  const question = questions[index]
  const answers: Record<number, QuizChoice | null> = { 1: s.q1, 2: s.q2, 3: s.q3, 4: s.q4, 5: s.q5 }
  const isLast = index === questions.length - 1
  const select = (c: QuizChoice) => {
    s.setQuizAnswer(question.q, c)
    window.setTimeout(() => {
      if (!isLast) { setIndex(index + 1); return }
      // 마지막 문항 — 앱과 같은 채점 파이프라인(sessionStore.computeResult → inferLoveType).
      if (useSessionStore.getState().computeResult()) { nav.push('brief') }
    }, 160)
  }
  return (
    <OnboardingScreen
      animKey={index}
      onBack={() => (index > 0 ? setIndex(index - 1) : nav.back())}
      headerRight={<StepCounter current={index + 1} total={questions.length} />}
      belowHeader={<div className="track"><div style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div>}
      footer={<p className="t-sub c-mute" style={{ textAlign: 'center' }}>정답은 없어요. 가장 가까운 쪽을 골라주세요</p>}
    >
      <h1 className="t-display c-text pre" style={{ marginTop: 8 }}>{question.prompt}</h1>
      <div className="stack12" style={{ marginTop: 32 }}>
        {question.options.map((o) => (
          <ChoiceCard key={o.choice} letter={o.choice} label={o.text} selected={answers[question.q] === o.choice} onClick={() => select(o.choice)} />
        ))}
      </div>
    </OnboardingScreen>
  )
}

/* ═══ A08 간략 결과 카드 ═════════════════════════════════════ */
function useLabel() {
  const result = useSessionStore((s) => s.result)
  const mbti = useSessionStore((s) => s.mbti)
  const label = result ? LOVE_TYPE_LABEL_BY_CODE[result.loveTypeCode] : undefined
  return { result, mbti, label }
}

export function ResultBriefScreen({ nav }: { nav: Nav }) {
  const { result, mbti, label } = useLabel()
  if (!result || !mbti) return null
  const isRare = MBTI_ENNEAGRAM_PREVALENCE[mbti]?.rare.includes(result.enneagramCore) ?? false
  const d = (ms: number) => ({ animationDelay: `${ms}ms` })
  return (
    <div className="screen">
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: 'calc(var(--top) + 40px) 28px 0' }}>
        <div className="glass appear" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '34px 24px', textAlign: 'center' }}>
          <p className="t-kicker c-mute appear" style={d(250)}>MY LOVE TYPE</p>
          <p className="t-kicker c-orchid appear" style={{ ...d(500), fontSize: 14, lineHeight: '20px', letterSpacing: 3.4, marginTop: 6 }}>{label?.labelEn ?? result.loveTypeCode}</p>
          <h1 className="t-display c-text appear" style={{ ...d(750), marginTop: 4, maxWidth: 220 }}>{label?.labelKo ?? result.loveTypeCode}</h1>
          {label?.copyKo ? <p className="t-body c-sub appear" style={{ ...d(1000), marginTop: 6 }}>{label.copyKo}</p> : null}
          <span className="appear" style={{ ...d(1150), width: 40, height: 1, background: 'rgba(243,239,247,.2)', marginTop: 12 }} />
          <p className="t-body c-sub appear" style={{ ...d(1250), marginTop: 6 }}>{mbti} · 애니어그램 {result.enneagramCore}</p>
          {isRare ? <p className="t-caption c-sub appear" style={d(1350)}>희귀 조합</p> : null}
          <p className="t-kicker c-mute appear" style={{ ...d(1400), fontWeight: 500, marginTop: 16 }}>ONDOLOG</p>
        </div>
      </div>
      <div className="footer appear" style={{ ...d(1500), gap: 10, paddingTop: 24 }}>
        <PrimaryButton label="공유하기" onClick={() => nav.push('share')} />
        <PrimaryButton label="이미지 저장" variant="ghost" onClick={() => nav.push('share')} />
        <LinkButton label="더 자세히 보기 →" onClick={() => { nav.push('consent') }} />
      </div>
    </div>
  )
}

/* ═══ A09 공유 카드 — 밤하늘 연출 ═══════════════════════════ */
export function ShareCardScreen({ nav }: { nav: Nav }) {
  const { result, mbti, label } = useLabel()
  useBackHandler(nav.back)
  if (!result || !mbti) return null
  const d = (ms: number, dur = 1200) => ({ animation: `appear ${dur}ms cubic-bezier(.2,.7,.2,1) ${ms}ms both` })
  const labelEn = label?.labelEn ?? result.loveTypeCode
  return (
    <div className="screen" onClick={nav.back} style={{ cursor: 'pointer' }}>
      <button aria-label="닫기" onClick={(e) => { e.stopPropagation(); nav.back() }} style={{ position: 'absolute', top: 'calc(var(--top) + 12px)', right: 20, width: 48, height: 48, fontSize: 18, color: 'rgba(243,239,247,.45)', ...d(4200, 800) }}>✕</button>
      <div style={{ position: 'absolute', left: 0, right: 0, top: '17.5%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 28px' }}>
        <p className="t-kicker c-sub" style={{ ...d(500), fontSize: 11, letterSpacing: 3.3 }}>MY LOVE TYPE</p>
        <p style={{ marginTop: 44, display: 'flex', fontWeight: 600, fontSize: 15, letterSpacing: 4.4, paddingLeft: 4.4, color: 'var(--orchid)' }}>
          {labelEn.split('').map((ch, i) => (
            <span key={i} style={{ display: 'inline-block', animation: `letterIn 1000ms cubic-bezier(.2,.7,.2,1) ${1100 + i * 70}ms both` }}>{ch}</span>
          ))}
        </p>
        <h1 style={{ ...d(1900, 1500), marginTop: 26, fontWeight: 600, fontSize: 38, lineHeight: '48px', letterSpacing: -0.8, maxWidth: 260, textShadow: '0 0 30px rgba(10,8,20,.6)' }}>
          {label?.labelKo ?? result.loveTypeCode}
        </h1>
        {label?.copyKo ? <p style={{ ...d(2900), marginTop: 24, fontSize: 17, lineHeight: '26px', color: 'var(--textSub)', letterSpacing: 0.4 }}>{label.copyKo}</p> : null}
        <p className="t-body c-sub" style={{ ...d(3500), marginTop: 30, opacity: 0.85 }}>{mbti} · 애니어그램 {result.enneagramCore}</p>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 'calc(var(--bot) + 64px)', ...d(4100, 1600) }}>
        <Wordmark size={13} />
      </div>
    </div>
  )
}

/* ═══ A10 약관 동의 · A12 전문 시트 ═════════════════════════ */
/** 화면에 보이는 AI 활용 설명 — 디자인 보드(A10) 문구. */
const AI_USAGE_HELPER_BOARD = '대화·사진·메모가 잡지를 만드는 데 쓰이고, 이때 외부 AI로 전송돼요'
const DOC_ORDER: Record<string, { n: number; tag: string }> = {
  terms: { n: 2, tag: '필수' }, privacy: { n: 3, tag: '필수' }, aiUsage: { n: 4, tag: '필수' }, marketing: { n: 5, tag: '선택' },
}

export function ConsentScreen({ nav }: { nav: Nav }) {
  const { birthDate, consent, setConsent } = useSessionStore()
  const [sheet, setSheet] = useState<LegalDocumentKey | null>(null)
  const ageEligible = isAgeEligible(birthDate, new Date())
  const enabled = canAgree(consent, ageEligible)
  const toggle = (k: 'terms' | 'privacy' | 'aiUsage' | 'marketing') => setConsent({ ...consent, [k]: !consent[k] })
  if (!ageEligible) return <UnderageScreen nav={nav} />
  return (
    <>
      <OnboardingScreen
        onBack={nav.back}
        title={'시작하기 전에\n확인해주세요'}
        subtitle="동의한 다음 계정을 골라요"
        footer={<PrimaryButton label="동의하고 시작하기" disabled={!enabled} onClick={() => nav.push('auth')} />}
      >
        <div className="card" style={{ marginTop: 32, padding: '8px 20px' }}>
          <ConsentRow label="전체 동의" strong checked={isAllConsented(consent)} onToggle={() => setConsent(toggleAllConsent(consent))} />
          <div className="rule" />
          <ConsentRow label="만 14세 이상입니다" checked={ageEligible} trailingNote="생년월일로 확인함" />
          <div className="rule" />
          <ConsentRow label="이용약관" tag="필수" checked={consent.terms} onToggle={() => toggle('terms')} onView={() => setSheet('terms')} />
          <div className="rule" />
          <ConsentRow label="개인정보 처리방침" tag="필수" checked={consent.privacy} onToggle={() => toggle('privacy')} onView={() => setSheet('privacy')} />
          <div className="rule" />
          <ConsentRow label="AI 콘텐츠 생성을 위한 데이터 활용" tag="필수" helper={AI_USAGE_HELPER_BOARD} checked={consent.aiUsage} onToggle={() => toggle('aiUsage')} onView={() => setSheet('aiUsage')} />
          <div className="rule" />
          <ConsentRow label="마케팅 정보 수신" tag="선택" checked={consent.marketing} onToggle={() => toggle('marketing')} onView={() => setSheet('marketing')} />
        </div>
      </OnboardingScreen>
      {sheet ? <LegalSheet docKey={sheet} onClose={() => setSheet(null)} /> : null}
    </>
  )
}

function LegalSheet({ docKey, onClose }: { docKey: LegalDocumentKey; onClose: () => void }) {
  const doc = LEGAL_DOCUMENTS[docKey]
  const [closing, setClosing] = useState(false)
  const close = () => { setClosing(true); window.setTimeout(onClose, 240) }
  useBackHandler(closing ? () => {} : close)
  const meta = DOC_ORDER[docKey]
  return (
    <>
      <div className="sheetBack" onClick={close} style={closing ? { opacity: 0, transition: 'opacity 240ms' } : undefined} />
      <div className={`sheet ${closing ? 'closing' : ''}`}>
        <div className="handle" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 18px 0' }}>
          <button aria-label="닫기" onClick={close} style={{ width: 48, height: 48, fontSize: 18, color: 'var(--textSub)' }}>✕</button>
        </div>
        <div className="content" style={{ paddingTop: 0 }}>
          {meta ? <p className="t-kicker c-mute" style={{ letterSpacing: 2 }}>{meta.tag} · {meta.n}</p> : null}
          <h1 className="t-display c-text" style={{ marginTop: 14 }}>{doc.title}</h1>
          {docKey === 'aiUsage' ? (
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {[
                ['무엇이 쓰이나요', '채팅 대화, 사진, 메모'],
                ['어디로 보내지나요', '잡지를 만드는 동안 외부 AI 서비스로 전송돼요'],
                ['어떤 서비스이고, 보관과 학습은', '[프로바이더명 · 보존 기간 · 학습 사용 여부 — 법무 확정 문구]'],
              ].map(([h, b]) => (
                <div key={h}><p className="t-title c-text" style={{ fontSize: 16.5 }}>{h}</p><p className="t-body c-sub" style={{ marginTop: 6, fontSize: 15.5 }}>{b}</p></div>
              ))}
              <div className="rule" />
            </div>
          ) : null}
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {doc.body.map((p, i) => <p key={i} className="t-sub c-mute">{p}</p>)}
          </div>
        </div>
        <div className="footer"><PrimaryButton label="확인" onClick={close} /></div>
      </div>
    </>
  )
}

/* ═══ A13 만 14세 미만 ═══════════════════════════════════════ */
export function UnderageScreen({ nav }: { nav: Nav }) {
  return (
    <OnboardingScreen
      onBack={nav.back}
      title={'시작하기 전에\n확인해주세요'}
      footer={
        <>
          <PrimaryButton label="동의하고 시작하기" disabled />
          <LinkButton label="처음으로" onClick={() => { useSessionStore.getState().resetSession(); nav.reset('intro') }} />
        </>
      }
    >
      <div className="card" style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 36 }}>
          <CheckBox checked={false} disabled />
          <span className="c-faint" style={{ fontSize: 15.5, lineHeight: '24px' }}>만 14세 이상입니다</span>
        </div>
        <p className="c-text" style={{ fontSize: 15.5, lineHeight: '24px' }}>만 14세 미만은 서비스를 이용할 수 없습니다</p>
        <p className="t-sub c-mute">입력한 생년월일로 확인했어요. 정보는 저장하지 않았어요.</p>
      </div>
    </OnboardingScreen>
  )
}

/* ═══ A11 로그인 — 묶음 1: 화면까지만. 카카오 왕복 · 저장은 묶음 2(73-)에서 연결한다. 지금은 버튼이 아무것도 하지 않는다 ═══ */
export function AuthScreen({ nav: _nav }: { nav: Nav }) {
  const existing = useSessionStore((s) => s.existingAccountPath)
  const go = () => { /* 묶음 2에서 로그인 왕복으로 대체 */ }
  return (
    <div className="screen">
      <div style={{ padding: 'calc(var(--top) + 12px) 24px 0', display: 'flex', alignItems: 'center', minHeight: 'calc(var(--top) + 60px)' }}>
        <p className="t-caption c-sub" style={{ fontSize: 12, letterSpacing: 5, paddingLeft: 4 }}>ONDOLOG</p>
      </div>
      <div style={{ flex: 1 }} />
      <div className="rise" style={{ padding: '0 24px calc(var(--bot) + 44px)', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <h1 className="t-display c-text pre" style={{ fontSize: 30, lineHeight: '40px' }}>{'어떤 계정으로\n시작할까요?'}</h1>
        <p className="t-sub c-sub" style={{ fontSize: 14.5, lineHeight: '23px', marginTop: -16 }}>
          {existing ? '이미 가입한 계정으로 로그인해요.' : '로그인하면 방금 본 결과가 계정에 저장돼요.'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <PrimaryButton label="카카오로 시작하기" variant="kakao" onClick={go} />
          <PrimaryButton label="Google로 계속하기" variant="ghost" onClick={go} />
          <PrimaryButton label="Apple로 계속하기" onClick={go} />
        </div>
        {existing ? null : <p className="t-caption c-mute" style={{ textAlign: 'center', lineHeight: '18px' }}>동의한 내용은 로그인이 실패해도 그대로 남아요</p>}
      </div>
    </div>
  )
}

/* ═══ A14 · A15 상세 결과 · A16 코어 고르기 ══════════════════ */
const ALL_CORES: EnneagramCore[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const BIG5_ORDER = [
  { key: 'bigO', label: '개방성' }, { key: 'bigC', label: '성실성' }, { key: 'bigE', label: '외향성' },
  { key: 'bigA', label: '우호성' }, { key: 'bigN', label: '신경성' },
] as const
const TRI_W = 260, TRI_H = 200

export function ResultDetailScreen({ nav }: { nav: Nav }) {
  const { result, mbti, q1 } = useSessionStore()
  const [override, setOverride] = useState<EnneagramCore | null>(null)
  const [view, setView] = useState<'detail' | 'override'>('detail')
  const [picked, setPicked] = useState<EnneagramCore | null>(null)
  const [round, setRound] = useState(0)
  if (!result || !mbti || !q1) return null

  const inferred = result.enneagramCore as EnneagramCore
  const effectiveCore = override ?? inferred
  const loveTypeCode = computeLoveTypeCode(effectiveCore, result.attachment) // 실효 코어 기준(R40-4)
  const label = LOVE_TYPE_LABEL_BY_CODE[loveTypeCode]
  const candidates = override ? [] : getEnneagramCandidates(q1, inferred)

  if (view === 'override') {
    const selected = picked ?? effectiveCore
    const confirm = () => {
      if (selected !== effectiveCore) { setOverride(selected === inferred ? null : selected); setRound((r) => r + 1); }
      setView('detail')
    }
    return (
      <OnboardingScreen
        animKey="override"
        onBack={() => { setPicked(null); setView('detail') }}
        title={'나에게 더 가까운\n코어를 골라주세요'}
        subtitle="코어만 바뀌어요. 빅5와 애착 결과는 그대로예요."
        footer={<PrimaryButton label="이 코어로 할게요" onClick={confirm} />}
      >
        <div className="card" style={{ marginTop: 28, padding: '8px 22px' }}>
          {ALL_CORES.map((core) => {
            const on = core === selected
            return (
              <button key={core} className="coreRow" role="radio" aria-checked={on} onClick={() => setPicked(core)}>
                <span className={`radio ${on ? 'on' : ''}`}>{on ? <i /> : null}</span>
                <span className="t-body c-text" style={{ flex: 1, fontSize: 15.5 }}>{core} · {ENNEAGRAM_CORE_EN[core]} {ENNEAGRAM_CORE_KO[core]}</span>
                {core === effectiveCore ? <span className="t-sub c-mute">지금 결과</span> : null}
              </button>
            )
          })}
        </div>
      </OnboardingScreen>
    )
  }

  const description = buildDescription({ core: effectiveCore, attachment: result.attachment, big5: result.big5, sternberg: result.sternberg })
  return (
    <DetailBody
      key={round}
      labelEn={label?.labelEn ?? loveTypeCode}
      labelKo={label?.labelKo ?? loveTypeCode}
      meta={`${mbti} · 애니어그램 ${effectiveCore} · ${ATTACHMENT_LABEL_KO[result.attachment]}`}
      description={description}
      big5={result.big5}
      sternberg={result.sternberg}
      core={effectiveCore}
      candidates={candidates}
      onMismatch={() => { setPicked(effectiveCore); setView('override') }}
      onNext={() => { nav.push('invite') }}
    />
  )
}

function DetailBody(props: {
  labelEn: string; labelKo: string; meta: string; description: string[]
  big5: Record<'bigE' | 'bigO' | 'bigA' | 'bigC' | 'bigN', number>
  sternberg: { intimacy: number; passion: number; commitment: number }
  core: EnneagramCore; candidates: EnneagramCore[]; onMismatch: () => void; onNext: () => void
}) {
  const { big5, sternberg, core } = props
  // 등장 순서(위 → 아래): 머리 0~0.5s → 빅5 0.8s(막대 1.1s부터 0.5초) → 스턴버그 1.9s(삼각형 2.2s부터) → 나머지(A15) 3.3s에 한 번에.
  const big5View = useInView<HTMLDivElement>()
  const triView = useInView<HTMLDivElement>()
  const barsGo = useAfter(1100) && big5View.seen
  const triGo = useAfter(2200) && triView.seen
  const restOn = useAfter(3300)
  const rest = restOn ? { animation: 'appear 900ms cubic-bezier(.2,.7,.2,1) both' } : { opacity: 0 }
  const a = (ms: number) => ({ animationDelay: `${ms}ms` })
  const geo = useMemo(() => sternbergGeometry(sternberg, TRI_W, TRI_H), [sternberg])
  const center = { x: TRI_W / 2, y: (TRI_H * 2) / 3 }
  const [k, setK] = useState(0)
  useEffect(() => {
    if (!triGo) return
    let raf = 0
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 900)
      setK(1 - Math.pow(1 - t, 3))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [triGo])
  const pts = (list: ReadonlyArray<{ x: number; y: number }>, f = 1) =>
    list.map((p) => `${center.x + (p.x - center.x) * f},${center.y + (p.y - center.y) * f}`).join(' ')
  const entry = COMPATIBILITY[core]

  return (
    <div className="screen solid">
      <div className="content" style={{ paddingTop: 'calc(var(--top) + 12px)' }}>
        <p className="t-kicker c-orchid appear" style={{ ...a(100), fontSize: 14, lineHeight: '20px', letterSpacing: 3.4 }}>{props.labelEn}</p>
        <h1 className="t-display c-text appear" style={{ ...a(220), marginTop: 8 }}>{props.labelKo}</h1>
        <p className="t-sub c-sub appear" style={{ ...a(340), marginTop: 8, fontSize: 14.5 }}>{props.meta}</p>
        <div className="appear" style={{ ...a(460), marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {props.description.map((para, i) => (
            <p key={i} className="t-body c-sub" style={{ fontSize: 15.5, lineHeight: '26px' }}>{para}</p>
          ))}
        </div>

        <div ref={big5View.ref} className="card appear" style={{ ...a(800), marginTop: 22, padding: 22 }}>
          <p className="t-kicker c-mute">BIG FIVE</p>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {BIG5_ORDER.map((ax, i) => (
              <div className="barRow" key={ax.key}>
                <span className="t-sub c-sub lab" style={{ fontSize: 14.5 }}>{ax.label}</span>
                <div className="tr"><div className="fl" style={{ width: barsGo ? `${Math.max(0, Math.min(100, big5[ax.key]))}%` : 0, transitionDelay: `${i * 40}ms` }} /></div>
                <span className="t-sub val metric" style={{ fontSize: 14.5, opacity: barsGo ? 1 : 0, transition: 'opacity 500ms' }}>{big5[ax.key]}</span>
              </div>
            ))}
          </div>
        </div>

        <div ref={triView.ref} className="card appear" style={{ ...a(1900), marginTop: 14, padding: 22 }}>
          <p className="t-kicker c-mute">STERNBERG</p>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 10 }}>
            <p className="t-sub c-sub" style={{ marginBottom: 8, fontSize: 14.5 }}>친밀 <span className="metric">{sternberg.intimacy}</span></p>
            <svg width={TRI_W} height={TRI_H} viewBox={`0 0 ${TRI_W} ${TRI_H}`} aria-label="스턴버그 삼각형">
              <polygon points={pts(geo.outer)} fill="#1C1829" />
              <polygon points={pts(geo.inner, k)} fill="rgba(244,185,200,0.4)" />
            </svg>
            <div style={{ display: 'flex', alignSelf: 'stretch', justifyContent: 'space-between', marginTop: -6 }}>
              <p className="t-sub c-sub" style={{ fontSize: 14.5 }}>열정 <span className="metric">{sternberg.passion}</span></p>
              <p className="t-sub c-sub" style={{ fontSize: 14.5 }}>헌신 <span className="metric">{sternberg.commitment}</span></p>
            </div>
          </div>
        </div>

        <div style={rest}>
          <div className="card" style={{ marginTop: 14, padding: 22 }}>
            <p className="t-kicker c-mute">ENNEAGRAM</p>
            <p className="t-title c-text" style={{ marginTop: 14 }}>{core} · {ENNEAGRAM_CORE_EN[core]} {ENNEAGRAM_CORE_KO[core]}</p>
            {props.candidates.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                {props.candidates.map((c) => <span key={c} className="chip t-sub c-sub" style={{ fontSize: 14.5 }}>{c}번일 수도 있어요</span>)}
              </div>
            ) : null}
            <button className="link press" style={{ justifyContent: 'flex-start', marginTop: 4 }} onClick={props.onMismatch}>결과와 달라요 →</button>
          </div>
          <div className="card" style={{ marginTop: 14, padding: 22 }}>
            <p className="t-sub c-mute" style={{ letterSpacing: 1.5 }}>온도가 잘 맞는 유형</p>
            {entry.best.map((it) => (
              <div className="compat" key={it.core}>
                <span className="core c-text">{it.core} {ENNEAGRAM_CORE_EN[it.core]}</span>
                <span className="t-body c-text" style={{ flex: 1, fontSize: 15.5, lineHeight: '25px' }}>{it.reason}</span>
              </div>
            ))}
          </div>
          <div className="card" style={{ marginTop: 14, padding: 22 }}>
            <p className="t-sub c-mute" style={{ letterSpacing: 1.5 }}>온도차가 있는 유형</p>
            <p className="t-sub c-sub" style={{ marginTop: 12, fontSize: 14.5, lineHeight: '23px' }}>{COMPATIBILITY_FRAMING_TEXT}</p>
            {entry.contrast.map((it) => (
              <div className="compat" key={it.core}>
                <span className="core c-text">{it.core} {ENNEAGRAM_CORE_EN[it.core]}</span>
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="t-body c-text" style={{ fontSize: 15.5 }}>{it.reason}</span>
                  <span className="t-sub c-mute">{it.tip}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="footer" style={{ ...rest, paddingTop: 14 }}>
        <p className="t-sub c-mute" style={{ textAlign: 'center' }}>{COMPATIBILITY_START_TEMPERATURE_NOTICE}</p>
        <PrimaryButton label="다음" onClick={props.onNext} />
      </div>
    </div>
  )
}

/* ═══ A17 연인 초대 ═════════════════════════════════════════ */
/** coupleApi.ts 생성 규칙 그대로(0/O, 1/I 제외 6자리). 서버에 쓰지 않는다. */
const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function generateInviteCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)]
  return code
}

export function InviteScreen({ nav }: { nav: Nav }) {
  const [code] = useState(generateInviteCode)
  const toast = useToast()
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); toast.show('코드를 복사했어요') } catch { toast.show(`내 코드: ${code}`) }
  }
  const share = async () => {
    const text = `온도록에서 우리 연결해요. 초대 코드: ${code}`
    if (navigator.share) { try { await navigator.share({ text }) } catch { /* 닫음 */ } } else copy()
  }
  return (
    <div className="screen solid">
      <div className="content" style={{ paddingTop: 'calc(var(--top) + 60px)' }}>
        <div className="rise">
          <h1 className="t-display c-text" style={{ fontSize: 30, lineHeight: '38px' }}>연인을 초대해요</h1>
          <p className="t-sub c-sub" style={{ marginTop: 10, fontSize: 14.5 }}>상대가 이 코드를 입력하면 두 사람이 연결돼요</p>
          <div className="codeBox">
            <p className="t-kicker c-mute" style={{ textAlign: 'center', fontSize: 11 }}>MY CODE</p>
            <p className="code c-text" style={{ userSelect: 'all' }}>{code.slice(0, 3)} {code.slice(3)}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <PrimaryButton label="복사하기" variant="ghost" onClick={copy} />
              <PrimaryButton label="공유하기" onClick={share} />
            </div>
          </div>
          <button className="rowBtn press" onClick={() => toast.show('체험판은 여기까지예요')}>
            <span className="t-body c-text" style={{ fontSize: 15.5 }}>상대에게 코드를 받았어요</span>
            <span className="c-mute">→</span>
          </button>
        </div>
      </div>
      <div className="footer" style={{ flexDirection: 'row', justifyContent: 'center', gap: 28 }}>
        <button className="link press" style={{ color: 'var(--textSub)' }} onClick={() => { nav.push('end') }}>나중에 할게요</button>
        <button className="link press" style={{ color: 'var(--textSub)' }} onClick={() => { nav.push('end') }}>솔로예요</button>
      </div>
      {toast.node}
    </div>
  )
}

/* ═══ 체험 끝 ═══════════════════════════════════════════════ */
export function EndScreen({ nav }: { nav: Nav }) {
  return (
    <div className="screen" style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 32px' }}>
      <div className="appear"><Wordmark size={14} /></div>
      <h1 className="t-display c-text pre appear" style={{ marginTop: 44, animationDelay: '300ms' }}>{'여기까지가\n온도록의 첫 만남이에요'}</h1>
      <p className="t-body c-sub appear" style={{ marginTop: 14, animationDelay: '600ms' }}>연결된 뒤에는 두 사람의 기록이{'\n'}매달 한 권의 잡지가 돼요.</p>
      <div className="appear" style={{ position: 'absolute', left: 20, right: 20, bottom: 'calc(var(--bot) + 40px)', animationDelay: '1000ms' }}>
        <PrimaryButton label="처음부터 다시 보기" variant="ghost" onClick={() => { useSessionStore.getState().resetSession(); nav.reset('intro') }} />
      </div>
    </div>
  )
}

export { BackArrow }
