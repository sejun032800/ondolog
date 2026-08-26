/**
 * Realtime 메시지 구독 + 로컬 상태 병합 + 오프라인 큐잉/재전송 + 읽음 처리.
 *
 * 근거: docs/ONDOLOG_ROADMAP.md §Phase 5, docs/ONDOLOG_MASTER.md Part 9-3.
 *
 * 오프라인 큐잉 방식(작업 지시 "완료 기준 2" 주의사항 그대로): 새 네이티브
 * 모듈(`@react-native-community/netinfo` 등)을 쓰지 않는다. 대신
 *   1) 전송 실패 시 로컬 큐(`useRef` 배열, 메모리 상주)에 적재
 *   2) 재시도 타이머(4초 간격)로 큐를 다시 시도
 *   3) Realtime 채널이 `SUBSCRIBED`로 (재)연결되는 순간에도 큐를 한 번
 *      비운다("연결 상태 이벤트" 기반 재전송)
 * 순수 JS만으로 구현했다(네이티브 모듈 추가 없음).
 *
 * 멱등 재전송의 실제 판단(어떤 결과면 큐에서 빼는지)은
 * `src/utils/chatQueue.ts`의 순수 함수(`shouldDequeueAfterSendOutcome`)에
 * 위임한다 — 이 훅은 그 판단 결과에 따라 React 상태/ref만 갱신한다.
 *
 * 중복 렌더링 방지(완료 기준 1): 로컬 낙관적 추가와 Realtime 구독
 * 이벤트(및 이 훅 스스로의 전송 응답)를 전부 `mergeMessage`
 * (`src/utils/chatMessages.ts`)로 병합한다 — clientMsgId가 같으면
 * 하나의 항목으로 취급한다.
 *
 * `warmth_score`/`sentiment`/`analyzed_at`은 이 훅에서 읽거나 쓰지
 * 않는다(Phase 7 담당).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'
import {
  createStory as apiCreateStory,
  fetchMessages,
  fetchStories,
  markMessagesRead,
  sendMessage as apiSendMessage,
  type MessageRow,
  type StoryRow,
} from '../services/chatApi'
import {
  dequeueOutgoing,
  enqueueOutgoing,
  shouldDequeueAfterSendOutcome,
  type OutgoingMessage,
} from '../utils/chatQueue'
import {
  mergeMessage,
  mergeMessages,
  pickUnreadFromPartner,
  rowToChatMessage,
  type ChatMessage,
} from '../utils/chatMessages'
import { generateUuidV4 } from '../utils/uuid'

const RETRY_INTERVAL_MS = 4000

export interface UseRealtimeMessagesResult {
  messages: ChatMessage[]
  loading: boolean
  sendText: (body: string) => Promise<void>
  stories: StoryRow[]
  storiesLoading: boolean
  postStory: (caption: string | null) => Promise<void>
}

export function useRealtimeMessages(
  coupleId: string | null,
  currentUserId: string | null,
): UseRealtimeMessagesResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [stories, setStories] = useState<StoryRow[]>([])
  const [storiesLoading, setStoriesLoading] = useState(true)
  const queueRef = useRef<OutgoingMessage[]>([])

  /** 전송 1회 시도 — 결과에 따라 화면 상태와 큐를 함께 갱신한다. */
  const attemptSend = useCallback(async (item: OutgoingMessage) => {
    const result = await apiSendMessage(item)

    if (result.status === 'sent') {
      const confirmed = rowToChatMessage(result.row)
      setMessages((prev) => mergeMessage(prev, confirmed))
    } else if (result.status === 'already_sent' && result.row) {
      const confirmed = rowToChatMessage(result.row)
      setMessages((prev) => mergeMessage(prev, confirmed))
    }

    queueRef.current = shouldDequeueAfterSendOutcome(result.status)
      ? dequeueOutgoing(queueRef.current, item.clientMsgId)
      : enqueueOutgoing(queueRef.current, item)

    return result
  }, [])

  const flushQueue = useCallback(() => {
    for (const item of queueRef.current) {
      attemptSend(item)
    }
  }, [attemptSend])

  // 초기 메시지 로드.
  useEffect(() => {
    if (!coupleId) {
      setMessages([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchMessages(coupleId)
      .then((rows) => {
        if (cancelled) return
        setMessages((prev) => mergeMessages(prev, rows.map(rowToChatMessage)))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [coupleId])

  // Realtime 구독 — 상대(및 나 자신의 다른 기기)가 보낸 변경을 병합한다.
  useEffect(() => {
    if (!coupleId) return

    const channel = supabase
      .channel(`messages:${coupleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `couple_id=eq.${coupleId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return
          setMessages((prev) => mergeMessage(prev, rowToChatMessage(payload.new as MessageRow)))
        },
      )
      .subscribe((status) => {
        // 재연결 순간("복구 시") 큐를 한 번 비운다 — 오프라인 큐잉의
        // 두 번째 트리거(첫 번째는 아래 재시도 타이머).
        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          flushQueue()
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [coupleId, flushQueue])

  // 재시도 타이머 — 네트워크 이벤트 없이도 주기적으로 큐를 비운다.
  useEffect(() => {
    const timer = setInterval(() => {
      if (queueRef.current.length > 0) flushQueue()
    }, RETRY_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [flushQueue])

  // 읽음 처리 — 상대가 보낸 미확인 메시지가 있을 때만 호출한다.
  useEffect(() => {
    if (!coupleId || !currentUserId) return
    const unreadIds = pickUnreadFromPartner(messages, currentUserId)
    if (unreadIds.length === 0) return
    markMessagesRead(coupleId, currentUserId)
      .then((rows) => {
        setMessages((prev) => mergeMessages(prev, rows.map(rowToChatMessage)))
      })
      .catch(() => {
        // 실패해도 unreadIds가 다음 렌더링까지 남아있어 재시도된다.
      })
  }, [messages, coupleId, currentUserId])

  const sendText = useCallback(
    async (body: string) => {
      if (!coupleId || !currentUserId) return
      const trimmed = body.trim()
      if (!trimmed) return

      const clientMsgId = generateUuidV4()
      const optimistic: ChatMessage = {
        id: `local:${clientMsgId}`,
        clientMsgId,
        coupleId,
        senderId: currentUserId,
        body: trimmed,
        mediaPath: null,
        sentAt: new Date().toISOString(),
        readAt: null,
        pending: true,
      }
      setMessages((prev) => mergeMessage(prev, optimistic))

      await attemptSend({ clientMsgId, coupleId, senderId: currentUserId, body: trimmed })
    },
    [coupleId, currentUserId, attemptSend],
  )

  // 스토리 목록 로드(작성 UI + 목록 표시만 — 만료/보관 배치는 이번 범위 아님).
  useEffect(() => {
    if (!coupleId) {
      setStories([])
      setStoriesLoading(false)
      return
    }
    let cancelled = false
    setStoriesLoading(true)
    fetchStories(coupleId)
      .then((rows) => {
        if (!cancelled) setStories(rows)
      })
      .finally(() => {
        if (!cancelled) setStoriesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [coupleId])

  const postStory = useCallback(
    async (caption: string | null) => {
      if (!coupleId || !currentUserId) return
      const row = await apiCreateStory({ coupleId, authorId: currentUserId, caption })
      setStories((prev) => [row, ...prev])
    },
    [coupleId, currentUserId],
  )

  return { messages, loading, sendText, stories, storiesLoading, postStory }
}
