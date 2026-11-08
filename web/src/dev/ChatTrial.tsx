/**
 * 관문 G4용 채팅 시험 화면 - 정식 채팅이 아니다.
 * 가짜 메시지 500개 · 아래로 붙는 스크롤 · 입력창 · 보내기(목록 끝에 추가) · 키보드 열고 닫기 · 뒤로 가기.
 * 목록 가상화는 쓰지 않는다(말풍선 500개는 일반 DOM으로 충분한지 실기기에서 먼저 본다).
 */
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { BackArrow } from '../ui'
import { useBackHandler } from '../platform/backStack'
import { useChatComposer } from '../platform/useChatComposer'
import { useStickToEnd } from '../platform/useStickToEnd'
import { makeFakeMessages, type FakeMessage } from './fakeMessages'

const MESSAGE_COUNT = 500

type TrialMessage = FakeMessage & { fresh?: boolean }

const nowLabel = () => {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export function ChatTrialScreen({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<TrialMessage[]>(() => makeFakeMessages(MESSAGE_COUNT))
  const listRef = useRef<HTMLDivElement>(null)
  const lastMine = useRef(false)
  const { onScroll, jump, followAppend, userTouch } = useStickToEnd(listRef)
  useBackHandler(onBack)

  const append = useCallback((mine: boolean, text: string) => {
    lastMine.current = mine
    setMessages((prev) => [...prev, { id: prev.length + 1, mine, text, time: nowLabel(), fresh: true }])
  }, [])

  const { hasText, inputProps, sendButtonProps, keepFocusProps } = useChatComposer(
    useCallback((text: string) => append(true, text), [append]),
  )

  // 처음에는 맨 아래에서 시작한다.
  useLayoutEffect(jump, [jump])

  // 새 메시지가 붙으면: 내가 보낸 것은 끝으로, 상대 것은 붙어 있을 때만.
  const count = useRef(messages.length)
  useLayoutEffect(() => {
    if (messages.length === count.current) return
    count.current = messages.length
    followAppend(lastMine.current)
  }, [messages, followAppend])

  return (
    <div className="screen solid chatTrial">
      <div className="header chatHeader">
        <BackArrow onClick={onBack} />
        <span className="t-title c-text">채팅 시험</span>
        {/* 시험 전용: 상대 메시지 흉내(위로 올린 상태에서 위치 유지를 보려는 용도). 이 화면은 시험 빌드 · 개발 서버에만 있다. */}
        <button className="partnerBtn press" data-testid="fake-partner" {...keepFocusProps} onClick={() => append(false, '(상대) 답장이 왔어요')}>상대</button>
      </div>
      <div
        className="chatList"
        ref={listRef}
        onScroll={onScroll}
        onTouchStart={userTouch}
        onWheel={userTouch}
        data-testid="chat-list"
      >
        {messages.map((m) => (
          <div key={m.id} className={`chatRow ${m.mine ? 'mine' : 'partner'}${m.fresh ? ' enter' : ''}`} data-testid="chat-message">
            <span className="bubble">{m.text}</span>
            <span className="time">{m.time}</span>
          </div>
        ))}
      </div>
      <div className="composer">
        <input className="composerInput" placeholder="메시지 보내기" {...inputProps} />
        <button className={`sendBtn press ${hasText ? 'on' : ''}`} aria-label="보내기" aria-disabled={!hasText} {...sendButtonProps}>↑</button>
      </div>
    </div>
  )
}
