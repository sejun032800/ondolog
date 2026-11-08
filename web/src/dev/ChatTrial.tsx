/**
 * 관문 G4용 채팅 시험 화면 - 정식 채팅이 아니다.
 * 가짜 메시지 500개 · 아래로 붙는 스크롤 · 입력창 · 보내기(목록 끝에 추가) · 키보드 열고 닫기 · 뒤로 가기.
 * 목록 가상화는 쓰지 않는다(말풍선 500개는 일반 DOM으로 충분한지 실기기에서 먼저 본다).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BackArrow } from '../ui'
import { useBackHandler } from '../platform/backStack'
import { makeFakeMessages, type FakeMessage } from './fakeMessages'

const MESSAGE_COUNT = 500
/** 맨 아래에서 이만큼 안이면 "붙어 있다"고 본다(px). */
const STICK_THRESHOLD = 48

export function ChatTrialScreen({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<FakeMessage[]>(() => makeFakeMessages(MESSAGE_COUNT))
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const stuck = useRef(true)
  useBackHandler(onBack)

  const scrollToEnd = useCallback(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  // 처음에는 맨 아래에서 시작한다.
  useLayoutEffect(scrollToEnd, [scrollToEnd])

  // 키보드가 열리고 닫혀 창 높이가 바뀌어도, 붙어 있던 경우 마지막 메시지가 그대로 보인다.
  useEffect(() => {
    const onResize = () => { if (stuck.current) scrollToEnd() }
    window.addEventListener('resize', onResize)
    const vv = window.visualViewport
    vv?.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      vv?.removeEventListener('resize', onResize)
    }
  }, [scrollToEnd])

  const onScroll = () => {
    const el = listRef.current
    if (el) stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_THRESHOLD
  }

  const text = draft.trim()
  const send = () => {
    if (text.length === 0) return
    const now = new Date()
    setMessages((prev) => [
      ...prev,
      { id: prev.length + 1, mine: true, text, time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` },
    ])
    setDraft('')
    stuck.current = true
  }

  // 새 메시지가 붙으면(내가 보낸 것) 끝으로 간다.
  useLayoutEffect(() => {
    if (stuck.current) scrollToEnd()
  }, [messages, scrollToEnd])

  return (
    <div className="screen solid chatTrial">
      <div className="header chatHeader">
        <BackArrow onClick={onBack} />
        <span className="t-title c-text">채팅 시험</span>
        <span style={{ width: 48 }} />
      </div>
      <div className="chatList" ref={listRef} onScroll={onScroll} data-testid="chat-list">
        {messages.map((m) => (
          <div key={m.id} className={`chatRow ${m.mine ? 'mine' : 'partner'}`} data-testid="chat-message">
            <span className="bubble">{m.text}</span>
            <span className="time">{m.time}</span>
          </div>
        ))}
      </div>
      <div className="composer">
        <input
          className="composerInput"
          value={draft}
          placeholder="메시지 보내기"
          enterKeyHint="send"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) send() }}
        />
        <button className={`sendBtn press ${text ? 'on' : ''}`} aria-label="보내기" disabled={!text} onClick={send}>↑</button>
      </div>
    </div>
  )
}
