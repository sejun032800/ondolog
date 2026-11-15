/**
 * F03 스토리 보기(RN `(modals)/story-viewer.tsx`) - 화면 위에 덮이는 면(시트 성격). 나가는 길은 ✕ 하나이고 하드웨어 뒤로 가기는 **이것만 닫는다**(`useBackHandler`).
 *
 * - 한 사람의 스토리(24시간 안)를 오래된 것부터 한 장씩. 오른쪽 절반을 누르면 다음, 왼쪽 절반은 이전, 마지막에서 다음은 닫기.
 * - 위 막대 = 스토리 수만큼, 지금 · 지난 것은 밝게. **시간으로 차오르는 막대 + 자동 넘김은 `STORY_AUTO_ADVANCE_MS`가 숫자일 때만 켜진다(A-16).**
 *   지금은 null(꺼짐): ONDOLOG_DESIGN §6 모션 허용표(화면 전환 · 모드 전환 · 버튼 눌림)에 이 연출이 없고 보드 F03은 정지 막대이며 시간 값이 어디에도 정해져 있지 않다 -
 *   PM이 값을 주면 이 한 줄만 바꾼다. 켜져도 `prefers-reduced-motion`이면 차오름 · 자동 넘김 없이 정지 막대 + 눌러 넘기기만 한다.
 * - 올리기는 "고르면 바로 올린다"(R13-11 #6)라 이 화면에 편집 · 캡션이 없다.
 * - 값은 채팅 화면이 열기 직전에 넘기고(메모리), 사진은 `stories` 버킷 서명 URL로 읽는다.
 */
import { useEffect, useMemo, useState } from 'react'
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

/** 스토리 한 장이 떠 있는 시간(ms). null = 자동 넘김 꺼짐(정지 막대). 값은 PM 결정 대기(A-16). */
export const STORY_AUTO_ADVANCE_MS: number | null = null

export function StoryViewer({ story, onClose, now = () => new Date(), autoAdvanceMs = STORY_AUTO_ADVANCE_MS }: {
  story: StoryViewPayload
  onClose: () => void
  now?: () => Date
  autoAdvanceMs?: number | null
}) {
  const [index, setIndex] = useState(0)
  useBackHandler(onClose)
  const paths = useMemo(() => story.items.map((i) => i.path), [story])
  const urls = useSignedMedia('stories', paths)
  const count = story.items.length
  const auto = autoAdvanceMs !== null && autoAdvanceMs > 0 && !prefersReducedMotion()
  const atNow = Math.min(index, Math.max(0, count - 1))
  const shown = count > 0 && urls[story.items[atNow].path] !== undefined
  // 자동 넘김: 사진이 뜬 순간부터 센다(아직 못 읽은 장은 넘기지 않는다). 마지막 장이 끝나면 닫는다.
  useEffect(() => {
    if (!auto || !shown || autoAdvanceMs === null) return
    const t = window.setTimeout(() => {
      if (atNow >= count - 1) onClose()
      else setIndex(atNow + 1)
    }, autoAdvanceMs)
    return () => window.clearTimeout(t)
  }, [auto, shown, autoAdvanceMs, atNow, count, onClose])

  if (story.items.length === 0) {
    return (
      <PhoneLayer>
        <div className="storyView" role="dialog" aria-modal="true" aria-label="스토리" data-testid="story-empty">
          <button type="button" className="storyClose press" aria-label="닫기" data-testid="story-close" onClick={onClose}>✕</button>
        </div>
      </PhoneLayer>
    )
  }
  const at = Math.min(index, story.items.length - 1)
  const item = story.items[at]
  const uri = urls[item.path]
  const last = at >= story.items.length - 1
  const next = () => (last ? onClose() : setIndex(at + 1))
  const prev = () => setIndex(Math.max(0, at - 1))

  return (
    <PhoneLayer>
      <div className="storyView" role="dialog" aria-modal="true" aria-label="스토리" data-testid="story-viewer">
        {uri ? <img className="storyImg" src={uri} alt="" draggable={false} data-testid="story-img" /> : null}
        <div className="storyScrim" aria-hidden="true" />
        <div className="storyTap">
          <button type="button" aria-label="이전 스토리" data-testid="story-prev" onClick={prev} />
          <button type="button" aria-label="다음 스토리" data-testid="story-next" onClick={next} />
        </div>
        <div className="storySegments" aria-hidden="true" data-testid="story-segments">
          {story.items.map((it, i) => {
            const filling = auto && i === at // 지금 장: 시간으로 차오른다(자동 넘김이 켜졌을 때만)
            return (
              <i
                key={filling ? `${it.id}:${at}` : it.id}
                className={filling ? `cur${shown ? ' fill' : ''}` : i <= at ? 'on' : ''}
                style={filling && autoAdvanceMs ? { animationDuration: `${autoAdvanceMs}ms` } : undefined}
              />
            )
          })}
        </div>
        <div className="storyWho">
          <span className="storyAvatar" aria-hidden="true">{uri ? <img src={uri} alt="" draggable={false} /> : null}</span>
          <span className="storyName" data-testid="story-author">{story.authorName}</span>
          <span className="storyAge">{relativeAgeLabel(item.createdAt, now())}</span>
          <button type="button" className="storyClose press" aria-label="닫기" data-testid="story-close" onClick={onClose}>✕</button>
        </div>
        <p className="storyFoot">{STORY_COPY.foot}</p>
      </div>
    </PhoneLayer>
  )
}
