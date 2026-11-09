/**
 * F03 스토리 보기(RN `(modals)/story-viewer.tsx`) - 화면 위에 덮이는 면(시트 성격). 나가는 길은 ✕ 하나이고 하드웨어 뒤로 가기는 **이것만 닫는다**(`useBackHandler`).
 *
 * - 한 사람의 스토리(24시간 안)를 오래된 것부터 한 장씩. 오른쪽 절반을 누르면 다음, 왼쪽 절반은 이전, 마지막에서 다음은 닫기.
 * - 위 막대는 정지 표시(지금 · 지난 것은 밝게). **진행률이 차오르는 자동 넘김은 없다**(금지 모션).
 * - 올리기는 "고르면 바로 올린다"(R13-11 #6)라 이 화면에 편집 · 캡션이 없다.
 * - 값은 채팅 화면이 열기 직전에 넘기고(메모리), 사진은 `stories` 버킷 서명 URL로 읽는다.
 */
import { useMemo, useState } from 'react'
import { relativeAgeLabel } from '@/utils/chatMessages'
import { PhoneLayer } from '../../components/PhoneLayer'
import { useBackHandler } from '../../platform/backStack'
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

export function StoryViewer({ story, onClose, now = () => new Date() }: { story: StoryViewPayload; onClose: () => void; now?: () => Date }) {
  const [index, setIndex] = useState(0)
  useBackHandler(onClose)
  const paths = useMemo(() => story.items.map((i) => i.path), [story])
  const urls = useSignedMedia('stories', paths)

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
          {story.items.map((it, i) => <i key={it.id} className={i <= at ? 'on' : ''} />)}
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
