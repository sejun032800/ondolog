/**
 * 84-h 시험판 전용 "유성 미리 보기"(ROADMAP R145-2) - 폰에서만 확인되는 유성 5항목(V40 끊김 · 64pt 잡기 · 제자리 빛 · C03 긴 원문 스크롤 · 기기 뒤로 가기)을
 * 실제 커플의 첫 유성 날보다 먼저 보려고 둔 길. **`IS_TRIAL_BUILD` 분기 안에서만** 이 파일을 부른다 - 출시 빌드(`build`)에서는 분기가 상수로 잘려
 * 이 파일 전체(견본 문장 · 줄 이름 포함)가 번들에서 빠진다(`smoke/run.mjs` 출시 빌드 검사 · `smoke/markers.mjs` `PREVIEW_MARKERS`).
 *
 *  - 견본은 기기 안 고정값 - 서버 읽기 · 쓰기 0(후보 읽기 함수를 부르지 않는다) · 실제 대화 원문 0 · 이름 · 시각도 견본.
 *  - 기기 저장 `meteor` 범주 쓰기 0 - 실제 "잡은 말" 기록 · {n}/{N} · 마지막으로 떨어진 날짜에 남지 않는다. 하루 1번 규칙과 무관(누를 때마다).
 *  - 견본 문장은 `meteorPreviewSample.ts`(가져오는 것 0인 글자 파일) - 짧은 견본은 스모크 `?meteor=1`과 같은 재료(`smoke/seed.ts`도 그 파일에서 가져온다).
 *  - 이름에 스모크 표지(`smoke/markers.mjs` - 스모크 이름)를 쓰지 않는다 - 시험 빌드 새지 않음 검사가 그 이름을 찾는다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { FallenWords, MeteorLayer } from './Meteor'
import type { MeteorCandidate, MeteorPlan } from './meteorRules'
import { METEOR_TEXT, PREVIEW_LONG_TEXT } from './meteorPreviewSample'

export { METEOR_TEXT, PREVIEW_LONG_TEXT }

/** 설정 → OUR SKY 맨 아래 줄(시험판만). */
export const PREVIEW_COPY = {
  row: '유성 미리 보기 · 시험판',
  rowDesc: '견본 말 하나를 바로 떨어뜨려요 · 기록에 남지 않아요',
} as const

const SENDER_A = 'preview-sender-a'
const SENDER_B = 'preview-sender-b'

/** 견본 이름(실제 이름 0 · 스모크 이름과 다른 값). */
export const PREVIEW_NAMES: Readonly<Record<string, string>> = { [SENDER_A]: '도담', [SENDER_B]: '이랑' }

/** C03에 여는 견본 말 - 잡은 순서. 마지막(긴 원문)이 방금 잡은 말 - C03은 긴 원문으로 열리고 ‹ 이전 말로 짧은 견본. */
export const PREVIEW_WORDS: readonly MeteorCandidate[] = [
  { id: 'preview-word-short', senderId: SENDER_B, body: METEOR_TEXT, sentAt: '2026-10-03T22:10:00+09:00' },
  { id: 'preview-word-long', senderId: SENDER_A, body: PREVIEW_LONG_TEXT, sentAt: '2026-10-11T23:42:00+09:00' },
]

/** 하늘 화면이 열린 뒤 견본이 떨어지기까지(화면 전환이 끝난 뒤 곧 - 4~10초 기다림 없음). */
export const PREVIEW_DELAY_MS = 700

const PLAN: MeteorPlan = { candidate: PREVIEW_WORDS[PREVIEW_WORDS.length - 1], delayMs: PREVIEW_DELAY_MS, angleDeg: 30, day: 'preview' }

// ---------------------------------------------------------------------------
// 설정 줄 -> 하늘 화면 신호(한 번 쓰고 지운다 - 주소에 남지 않는다)
// ---------------------------------------------------------------------------

let requested = false

/** 설정 줄을 눌렀다 - 다음에 열리는 하늘 화면이 견본 하나를 곧 떨어뜨린다. */
export function requestMeteorPreview(): void {
  requested = true
}

/** 하늘 화면이 열릴 때 한 번 - 요청이 있었으면 true를 돌려주고 지운다. */
export function takeMeteorPreview(): boolean {
  const was = requested
  requested = false
  return was
}

// ---------------------------------------------------------------------------
// 훅 - 기기 저장 · 네트워크를 건드리지 않는다
// ---------------------------------------------------------------------------

export interface MeteorPreview {
  readonly falling: MeteorPlan | null
  readonly fallenOpen: boolean
  readonly catchIt: () => void
  readonly ended: () => void
  readonly closeFallen: () => void
}

/**
 * 미리 보기 한 번. `on`이 true인 하늘 화면에서 - 열리고 곧 하나, C08(둘러보기)에 들어갈 때마다 하나 더.
 * 떨어지는 조건은 실제 유성과 같다(`canShow` · `visible`): 지난 하늘 · 별 시트 · 빈 하늘이면 기다리고, 떨어지는 중에 그런 화면으로 가면 사라진다.
 */
export function useMeteorPreview(input: { on: boolean; touring: boolean; canShow: boolean; visible: boolean }): MeteorPreview {
  const { on, touring, canShow, visible } = input
  const [due, setDue] = useState(false)
  const [falling, setFalling] = useState<MeteorPlan | null>(null)
  const [fallenOpen, setFallenOpen] = useState(false)
  const started = useRef(false)
  const wasTouring = useRef(touring)

  // 처음 열림 · 둘러보기에 들어갈 때마다 곧 하나(둘러보기에서 나올 때는 아님)
  useEffect(() => {
    if (!on) return
    const first = !started.current
    const entered = touring && !wasTouring.current
    started.current = true
    wasTouring.current = touring
    if (!first && !entered) return
    const t = window.setTimeout(() => setDue(true), PREVIEW_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [on, touring])

  useEffect(() => {
    if (!due || falling || fallenOpen || !canShow || !visible) return
    setDue(false)
    setFalling(PLAN)
  }, [due, falling, fallenOpen, canShow, visible])

  useEffect(() => {
    if (falling && !canShow) setFalling(null)
  }, [falling, canShow])

  const catchIt = useCallback(() => {
    setFalling(null)
    setFallenOpen(true)
  }, [])
  const ended = useCallback(() => setFalling(null), [])
  const closeFallen = useCallback(() => setFallenOpen(false), [])
  return { falling, fallenOpen, catchIt, ended, closeFallen }
}

/**
 * 하늘 화면이 `{IS_TRIAL_BUILD && previewOn ? <MeteorPreviewHost /> : null}`로만 그린다 - 출시 빌드에서는 이 컴포넌트를 부르는 곳이 상수로 잘려 파일째 빠진다.
 * 유성 그림 · C03은 실제 것(`Meteor.tsx`)을 그대로 쓰고, C03에는 견본 말을 넘긴다(서버 읽기 0).
 */
export function MeteorPreviewHost(props: { touring: boolean; canShow: boolean; visible: boolean; reduced: boolean }) {
  const preview = useMeteorPreview({ on: true, touring: props.touring, canShow: props.canShow, visible: props.visible })
  return (
    <>
      {preview.falling ? (
        <MeteorLayer key="meteor-preview" plan={preview.falling} reduced={props.reduced} paused={!props.visible} onCatch={preview.catchIt} onEnd={preview.ended} />
      ) : null}
      {preview.fallenOpen ? (
        <FallenWords coupleId={null} caught={[]} names={PREVIEW_NAMES} onClose={preview.closeFallen} preset={PREVIEW_WORDS} />
      ) : null}
    </>
  )
}
