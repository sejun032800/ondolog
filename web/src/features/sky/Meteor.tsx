/**
 * 84-e 유성(C01 · C08) · 떨어진 말(C03) - MASTER 9-8-4 r80 · 보드 N-R17-Our-Sky-2 17-b · 17-d · 03_Y1-Our-Sky "하늘 · 떨어진 말".
 *
 *  - 유성: 오른쪽 위 가장자리 -> 왼쪽 아래, 각도 25~35° · 흰 꼬리 · 흰 점 머리 + rose 후광. 머리 이동 2.4초 `cubic-bezier(.3,0,.7,1)` ·
 *    꼬리는 처음 0.4초에 끝 길이까지 · 사라짐 0.6초 `ease-in`(투명도 1 -> 0, 꼬리는 머리 쪽으로 줄어듦) · 누를 수 있는 시간 3초.
 *    누르는 범위 = 머리를 따라다니는 지름 64pt 원. 애니메이션은 transform · opacity만(V40에서 끊김 없이) · 한 번에 하나 · 화면이 가려지면 멈춘다.
 *  - 줄인 모션: 꼬리 · 이동 없이 제자리 빛(흰 점 + rose 후광 + 바깥 고리) - 나타남 0.6 · 머묾 4 · 사라짐 0.6 = 누를 수 있는 시간 5.2초. 자리는 유성이 지났을 길의 중간.
 *  - C03: FALLEN WORDS · "{n} / {N}"(지금까지 잡은 말 전체 중 위치 - 방금 잡은 말이 N) · 원문(자르지 않음 · 길면 이 화면 안에서 스크롤) ·
 *    출처 "{이름} · {M}월 {D}일 {HH:MM}" · ‹ 이전 말 / 다음 말 ›(끝이면 흐림) · "지나가는 유성을 누르면 떠요" · ✕.
 *    "채팅에서 보기"는 **숨김**(84-e 결정 - 지운 · 아직 불러오지 않은 옛 메시지로 갈 때의 동작이 정해진 곳이 없다, HANDOFF 84-d0 열린 질문 6).
 *  - 하늘은 읽기 전용 - 이 파일은 서버에 쓰지 않는다. 기기에는 메시지 id · 날짜만(`meteorData.ts`).
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useBackHandler } from '../../platform/backStack'
import { readMeteorMemory, useFallenWords, useMeteorCandidates, writeMeteorMemory } from './meteorData'
import { fallenMeta, markCaught, markDropped, planMeteor, pressableMs, type MeteorCandidate, type MeteorPlan } from './meteorRules'

export const METEOR_COPY = {
  a11y: '떨어지는 유성 - 누르면 떨어진 말이 열려요',
  kicker: 'FALLEN WORDS',
  prev: '‹ 이전 말',
  next: '다음 말 ›',
  hint: '지나가는 유성을 누르면 떠요',
  close: '닫기',
} as const

// ---------------------------------------------------------------------------
// 떨어뜨리는 일 - 언제 · 무엇을(규칙은 meteorRules) · 잡음 · 놓침
// ---------------------------------------------------------------------------

export interface MeteorDropInput {
  readonly userId: string | null
  readonly coupleId: string | null
  /** OUR SKY "유성 떨어뜨리기". */
  readonly enabled: boolean
  /** 하늘 화면이 준비됐다(별 읽기가 끝났다). */
  readonly ready: boolean
  /** 지금 떨어져도 되는 화면인가 - C01 이번 달 · C08(둘러보기). 지난 하늘(showPast) · 별 시트 · 사진 · 빈 하늘이면 false. */
  readonly canShow: boolean
  /** 앱이 보이는가(가려지면 멈춘다). */
  readonly visible: boolean
  readonly names: Readonly<Record<string, string>>
  readonly namesReady: boolean
  /** 시험이 시계를 넣는다(76-j · 85- 방식). */
  readonly now?: () => Date
}

export interface MeteorDrop {
  /** 지금 떨어지는 유성(없으면 null). */
  readonly falling: MeteorPlan | null
  /** C03에 열 잡은 말 목록(메시지 id, 잡은 순서). 열려 있지 않으면 null. */
  readonly fallenOpen: readonly string[] | null
  readonly catchIt: () => void
  readonly ended: () => void
  readonly closeFallen: () => void
}

export function useMeteorDrop(input: MeteorDropInput): MeteorDrop {
  const { userId, coupleId, enabled, ready, canShow, visible } = input
  const nowRef = useRef(input.now ?? (() => new Date()))
  nowRef.current = input.now ?? (() => new Date())
  const source = useMeteorCandidates({ enabled, coupleId, names: input.names, namesReady: input.namesReady })
  const [plan, setPlan] = useState<MeteorPlan | null>(null)
  const [due, setDue] = useState(false)
  const [falling, setFalling] = useState<MeteorPlan | null>(null)
  const [fallenOpen, setFallenOpen] = useState<readonly string[] | null>(null)

  // 오늘의 유성 하나(꺼짐 · 오늘 이미 떨어짐 · 후보 0이면 없음)
  useEffect(() => {
    if (!ready || !source.loaded || !coupleId || !userId) { setPlan(null); return }
    setPlan(planMeteor({ candidates: source.candidates, memory: readMeteorMemory(userId, coupleId), now: nowRef.current(), coupleId, userId, enabled }))
  }, [ready, source.loaded, source.candidates, coupleId, userId, enabled])

  // 하늘이 준비된 뒤 4~10초
  useEffect(() => {
    setDue(false)
    if (!plan) return
    const t = window.setTimeout(() => setDue(true), plan.delayMs)
    return () => window.clearTimeout(t)
  }, [plan])

  // 때가 됐고 보여도 되는 화면이면 떨어진다 - 그날은 끝(놓쳐도 다음 날 다시 후보)
  useEffect(() => {
    if (!due || !plan || falling || !canShow || !visible || !enabled || !userId || !coupleId) return
    writeMeteorMemory(userId, coupleId, markDropped(readMeteorMemory(userId, coupleId), plan.day))
    setFalling(plan)
    setPlan(null)
    setDue(false)
  }, [due, plan, falling, canShow, visible, enabled, userId, coupleId])

  // 떨어지는 중에 지난 하늘 · 시트로 가거나 끄면 그 유성은 사라진다(놓친 것과 같다)
  useEffect(() => {
    if (falling && (!canShow || !enabled)) setFalling(null)
  }, [falling, canShow, enabled])

  const catchIt = useCallback(() => {
    if (!falling || !userId || !coupleId) return
    const memory = markCaught(readMeteorMemory(userId, coupleId), falling.candidate.id)
    writeMeteorMemory(userId, coupleId, memory)
    setFalling(null)
    setFallenOpen(memory.caught)
  }, [falling, userId, coupleId])
  const ended = useCallback(() => setFalling(null), [])
  const closeFallen = useCallback(() => setFallenOpen(null), [])
  return { falling, fallenOpen, catchIt, ended, closeFallen }
}

// ---------------------------------------------------------------------------
// 유성 그림
// ---------------------------------------------------------------------------

/** 보드 C01_meteor - 꼬리 시작 y 98pt(✕ · 칩 아래). 머리가 지나는 길이 = 화면 폭의 70%. */
const START_Y = 98
const TRAVEL_RATIO = 0.7
const TAIL = 140

export function MeteorLayer(props: { plan: MeteorPlan; reduced: boolean; paused: boolean; onCatch: () => void; onEnd: () => void }) {
  const { plan, reduced, paused, onCatch, onEnd } = props
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(390)
  useEffect(() => { const w = ref.current?.clientWidth; if (w) setWidth(w) }, [])
  // 누를 수 있는 시간이 끝나면 사라진다(놓침). 가려진 동안은 시간이 흐르지 않게 다시 잰다.
  const left = useRef(pressableMs(reduced))
  const startedAt = useRef(0)
  useEffect(() => {
    if (paused) return
    startedAt.current = Date.now()
    const t = window.setTimeout(onEnd, left.current)
    return () => { window.clearTimeout(t); left.current = Math.max(0, left.current - (Date.now() - startedAt.current)) }
  }, [paused, onEnd])

  const rad = (plan.angleDeg * Math.PI) / 180
  const dist = width * TRAVEL_RATIO / Math.cos(rad)
  const dx = -dist * Math.cos(rad)
  const dy = dist * Math.sin(rad)
  const style = { '--dx': `${dx.toFixed(1)}px`, '--dy': `${dy.toFixed(1)}px`, '--ang': `${-plan.angleDeg}deg`, '--tail': `${TAIL}px`, top: `${START_Y}px` } as CSSProperties
  const stillStyle = { left: `${(width + dx / 2).toFixed(1)}px`, top: `${(START_Y + dy / 2).toFixed(1)}px` } as CSSProperties
  return (
    <div ref={ref} className={`meteorLayer ${paused ? 'paused' : ''}`} data-testid="sky-meteor-layer" aria-live="off">
      {reduced ? (
        <button type="button" className="meteorStill" style={stillStyle} onClick={onCatch} aria-label={METEOR_COPY.a11y} data-testid="sky-meteor" data-mode="still">
          <i className="meteorRing" aria-hidden="true" />
          <i className="meteorHeadDot" aria-hidden="true" />
        </button>
      ) : (
        <div className="meteorPath" style={style} aria-hidden="false">
          <button type="button" className="meteorHead" onClick={onCatch} aria-label={METEOR_COPY.a11y} data-testid="sky-meteor" data-mode="fall">
            <i className="meteorTail" aria-hidden="true" />
            <i className="meteorHeadDot" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// C03 떨어진 말
// ---------------------------------------------------------------------------

export function FallenWords(props: { coupleId: string | null; caught: readonly string[]; names: Readonly<Record<string, string>>; onClose: () => void }) {
  const { loaded, words } = useFallenWords({ open: true, coupleId: props.coupleId, caught: props.caught })
  const [index, setIndex] = useState<number | null>(null)
  useBackHandler(props.onClose)
  // 처음에는 방금 잡은 말(마지막)
  useEffect(() => { if (loaded) setIndex(words.length > 0 ? words.length - 1 : null) }, [loaded, words.length])
  const word: MeteorCandidate | null = index !== null ? words[index] ?? null : null
  const n = index !== null ? index + 1 : 0
  const total = words.length
  return (
    <div className="fallen" role="dialog" aria-label={METEOR_COPY.kicker} data-testid="sky-fallen">
      <div className="fallenHead">
        <div className="fallenHeadText">
          <div className="skyKicker">{METEOR_COPY.kicker}</div>
          {total > 0 ? <div className="fallenCount" data-testid="sky-fallen-count">{`${n} / ${total}`}</div> : null}
        </div>
        <button type="button" className="skyClose press" aria-label={METEOR_COPY.close} data-testid="sky-fallen-close" onClick={props.onClose}>✕</button>
      </div>
      <div className="fallenArt" aria-hidden="true"><i className="fallenTrail" /><i className="meteorHeadDot" /></div>
      <div className="fallenBody" data-testid="sky-fallen-body">
        {word ? (
          <>
            <p className="fallenText" data-testid="sky-fallen-text">{word.body}</p>
            <p className="fallenMeta" data-testid="sky-fallen-meta">{fallenMeta(props.names[word.senderId] ?? '', word.sentAt)}</p>
          </>
        ) : null}
      </div>
      <div className="fallenFoot">
        <div className="fallenNav">
          <button type="button" className="fallenNavBtn press" disabled={!word || n <= 1} onClick={() => setIndex((i) => (i !== null && i > 0 ? i - 1 : i))} data-testid="sky-fallen-prev">{METEOR_COPY.prev}</button>
          <button type="button" className="fallenNavBtn press" disabled={!word || n >= total} onClick={() => setIndex((i) => (i !== null && i < total - 1 ? i + 1 : i))} data-testid="sky-fallen-next">{METEOR_COPY.next}</button>
        </div>
        <p className="fallenHint">{METEOR_COPY.hint}</p>
      </div>
    </div>
  )
}
