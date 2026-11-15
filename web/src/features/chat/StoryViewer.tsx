/**
 * F03 스토리 보기(RN `(modals)/story-viewer.tsx`) - 화면 위에 덮이는 면(시트 성격). 나가는 길은 ✕ 하나이고 하드웨어 뒤로 가기는 **이것만 닫는다**(`useBackHandler`).
 *
 * - 한 사람의 스토리(24시간 안)를 오래된 것부터 한 장씩. 오른쪽 절반을 누르면 다음, 왼쪽 절반은 이전, 마지막에서 다음은 닫기.
 * - **자동 넘김(R94-6, Proteur 요구가 보드 F03의 정지 막대보다 우선)**: 한 장 `STORY_AUTO_ADVANCE_MS`(5000ms). 위 막대 = 스토리 수만큼, 지금 장은 시간만큼 차오르고 다 차면 다음 장,
 *   마지막 장이 다 차면 닫는다. 좌우 탭 = 앞 · 뒤(다음 장은 시간을 처음부터 센다). **누르고 있으면 멈추고(막대도 멈춤) 떼면 이어서** 간다 - 짧게 누르고 뗀 것만 탭으로 센다.
 *   사진이 아직 안 뜬 장은 세지 않는다.
 * - 줄인 모션(`prefers-reduced-motion`): **시간 계산 · 자동 넘김은 그대로**, 차오르는 애니메이션만 뺀다(지금 장은 가득 찬 막대로 보임). 시간을 건드리면 사용자의 요구(5초 넘김)가 깨져서다.
 * - 모션 허용표(ONDOLOG_DESIGN §6)에 추가된 연출 두 줄: "스토리 진행 막대 - 선형, 장당 `STORY_AUTO_ADVANCE_MS` (R94-6)" · "스토리 열림 · 닫힘 - 0.92배 <-> 1배 + 투명, 닫힘 `STORY_CLOSE_MS`(0.22초) (R98-7)". 이 밖의 모션은 없다.
 * - 열림 · 닫힘(R98-7, 76-D1): 열릴 때 0.92배 -> 1배 + 나타남, 닫힐 때 0.22초 동안 0.92배로 줄며 투명해진 **뒤에** 닫는다(즉시 언마운트 아님). ✕ · 자동 닫힘(마지막 장 · 마지막에서 다음 탭) ·
 *   하드웨어 뒤로 가기 · 아래로 밀기가 모두 같은 닫힘 연출(`requestClose`)을 지난다. 줄인 모션(`prefers-reduced-motion`)이면 크기는 그대로 투명만 `STORY_CLOSE_REDUCED_MS`(0.15초).
 * - 아래로 밀기: 화면을 누른 채 아래로 `STORY_SWIPE_DOWN_PX` 넘게 끌고 떼면 닫는다(탭 · 멈춤으로 세지 않는다).
 * - 올리기는 "고르면 바로 올린다"(R13-11 #6)라 이 화면에 편집 · 캡션이 없다.
 * - 값은 채팅 화면이 열기 직전에 넘기고(메모리), 사진은 `stories` 버킷 서명 URL로 읽는다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { relativeAgeLabel } from '@/utils/chatMessages'
import { PhoneLayer } from '../../components/PhoneLayer'
import { useBackHandler } from '../../platform/backStack'
import { prefersReducedMotion } from '../../platform/motion'
import { useSignedMedia } from './useSignedMedia'

export interface StoryViewItem {
  id: string
  /** `stories` 버킷 경로. */
  path: string
  createdAt: string
}

export interface StoryViewPayload {
  authorName: string
  isMine: boolean
  /** 오래된 것부터. */
  items: StoryViewItem[]
}

export const STORY_COPY = { foot: '스토리는 24시간 동안 보여요' } as const

/** 스토리 한 장이 떠 있는 시간(ms)(R94-6). null이면 자동 넘김 꺼짐(정지 막대). */
export const STORY_AUTO_ADVANCE_MS: number | null = 5000
/** 이 시간(ms)보다 오래 눌렀다 떼면 "멈춤"이지 탭이 아니다(떼도 넘어가지 않는다). */
export const STORY_HOLD_MS = 250
/** 닫힘 연출 시간(ms) · 줄인 모션일 때(투명만). 열림은 CSS가 같은 시간(R98-7). */
export const STORY_CLOSE_MS = 220
export const STORY_CLOSE_REDUCED_MS = 150
/** 이만큼(px) 넘게 아래로 끌고 떼면 닫는다. */
export const STORY_SWIPE_DOWN_PX = 80

export function StoryViewer({ story, onClose, now = () => new Date(), autoAdvanceMs = STORY_AUTO_ADVANCE_MS }: {
  story: StoryViewPayload
  onClose: () => void
  now?: () => Date
  autoAdvanceMs?: number | null
}) {
  const [index, setIndex] = useState(0)
  const [held, setHeld] = useState(false)
  // 닫힘 연출(R98-7): 모든 닫는 길이 `requestClose`를 지난다. 연출이 끝난 뒤에야 부모의 `onClose`(= 언마운트)를 부른다.
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)
  const closeTimer = useRef<number | undefined>(undefined)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const requestClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    closeTimer.current = window.setTimeout(() => onCloseRef.current(), prefersReducedMotion() ? STORY_CLOSE_REDUCED_MS : STORY_CLOSE_MS)
  }, [])
  useEffect(() => () => window.clearTimeout(closeTimer.current), [])
  useBackHandler(requestClose)
  const paths = useMemo(() => story.items.map((i) => i.path), [story])
  const urls = useSignedMedia('stories', paths)
  const count = story.items.length
  const auto = autoAdvanceMs !== null && autoAdvanceMs > 0
  const reduced = prefersReducedMotion()
  const atNow = Math.min(index, Math.max(0, count - 1))
  const shown = count > 0 && urls[story.items[atNow].path] !== undefined
  // 자동 넘김: 사진이 뜬 순간부터 센다(아직 못 읽은 장은 넘기지 않는다). 누르고 있는 동안은 센 시간을 쥐고 멈췄다가 떼면 남은 시간만큼 이어서 간다. 마지막 장이 끝나면 닫는다.
  const progress = useRef({ at: -1, elapsed: 0 })
  useEffect(() => {
    if (!auto || !shown || held || closing || autoAdvanceMs === null) return
    if (progress.current.at !== atNow) progress.current = { at: atNow, elapsed: 0 }
    const startedAt = Date.now()
    const t = window.setTimeout(() => {
      if (atNow >= count - 1) requestClose()
      else setIndex(atNow + 1)
    }, Math.max(0, autoAdvanceMs - progress.current.elapsed))
    return () => {
      window.clearTimeout(t)
      progress.current.elapsed += Date.now() - startedAt
    }
  }, [auto, shown, held, closing, autoAdvanceMs, atNow, count, requestClose])
  // 누름: 누르는 순간 멈추고, 뗄 때 이어서 간다. 오래 눌렀다 뗀 것은 탭이 아니다(뒤따르는 click을 삼킨다).
  const pressAt = useRef(0)
  const pressY = useRef<number | null>(null)
  const swallowClick = useRef(false)
  const press = (e?: { clientY?: number }) => {
    pressY.current = typeof e?.clientY === 'number' ? e.clientY : null
    pressAt.current = Date.now()
    swallowClick.current = false
    setHeld(true)
  }
  const release = (e?: { clientY?: number }) => {
    const swipedDown = pressAt.current > 0 && pressY.current !== null && typeof e?.clientY === 'number' && e.clientY - pressY.current > STORY_SWIPE_DOWN_PX
    if (pressAt.current > 0 && (swipedDown || Date.now() - pressAt.current >= STORY_HOLD_MS)) swallowClick.current = true
    pressAt.current = 0
    pressY.current = null
    setHeld(false)
    if (swipedDown) requestClose()
  }
  const cancelPress = () => {
    pressAt.current = 0
    pressY.current = null
    swallowClick.current = false
    setHeld(false)
  }
  const holdHandlers = { onPointerDown: press, onPointerUp: release, onPointerCancel: cancelPress, onPointerLeave: (e: { clientY?: number }) => { if (pressAt.current > 0 && !(pressY.current !== null && typeof e.clientY === 'number' && e.clientY - pressY.current > STORY_SWIPE_DOWN_PX)) cancelPress() }, onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault() }
  const tap = (go: () => void) => () => {
    if (swallowClick.current) { swallowClick.current = false; return }
    go()
  }

  if (story.items.length === 0) {
    return (
      <PhoneLayer>
        <div className={`storyView${closing ? ' closing' : ''}`} role="dialog" aria-modal="true" aria-label="스토리" data-testid="story-empty">
          <button type="button" className="storyClose press" aria-label="닫기" data-testid="story-close" onClick={requestClose}>✕</button>
        </div>
      </PhoneLayer>
    )
  }
  const at = Math.min(index, story.items.length - 1)
  const item = story.items[at]
  const uri = urls[item.path]
  const last = at >= story.items.length - 1
  const next = tap(() => (last ? requestClose() : setIndex(at + 1)))
  const prev = tap(() => setIndex(Math.max(0, at - 1)))

  return (
    <PhoneLayer>
      <div className={`storyView${closing ? ' closing' : ''}`} role="dialog" aria-modal="true" aria-label="스토리" data-testid="story-viewer">
        {uri ? <img className="storyImg" src={uri} alt="" draggable={false} data-testid="story-img" /> : null}
        <div className="storyScrim" aria-hidden="true" />
        <div className="storyTap">
          <button type="button" aria-label="이전 스토리" data-testid="story-prev" onClick={prev} {...holdHandlers} />
          <button type="button" aria-label="다음 스토리" data-testid="story-next" onClick={next} {...holdHandlers} />
        </div>
        <div className="storySegments" aria-hidden="true" data-testid="story-segments">
          {story.items.map((it, i) => {
            const filling = auto && !reduced && i === at // 지금 장: 시간으로 차오른다(자동 넘김이 켜졌고 줄인 모션이 아닐 때. 줄인 모션이면 가득 찬 막대)
            return (
              <i
                key={filling ? `${it.id}:${at}` : it.id}
                className={filling ? `cur${shown ? ' fill' : ''}${held ? ' hold' : ''}` : i <= at ? 'on' : ''}
                style={filling && autoAdvanceMs ? { animationDuration: `${autoAdvanceMs}ms` } : undefined}
              />
            )
          })}
        </div>
        <div className="storyWho">
          <span className="storyAvatar" aria-hidden="true">{uri ? <img src={uri} alt="" draggable={false} /> : null}</span>
          <span className="storyName" data-testid="story-author">{story.authorName}</span>
          <span className="storyAge">{relativeAgeLabel(item.createdAt, now())}</span>
          <button type="button" className="storyClose press" aria-label="닫기" data-testid="story-close" onClick={requestClose}>✕</button>
        </div>
        <p className="storyFoot">{STORY_COPY.foot}</p>
      </div>
    </PhoneLayer>
  )
}
