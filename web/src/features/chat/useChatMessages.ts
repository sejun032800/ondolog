/**
 * 채팅 메시지 상태 훅(RN `hooks/useRealtimeMessages.ts`의 웹판) - Realtime 구독 + 로컬 상태 병합 + 오프라인 큐잉 · 재전송 + 읽음 처리 + 메우기 + 스토리.
 *
 * 같은 테이블 · 같은 채널 이름(`messages:{coupleId}`, `postgres_changes` `messages` `couple_id=eq.{id}`)이다. 규칙은 루트 순수 파일을 그대로 가져다 쓴다:
 *  - 중복 방지: 낙관적 말풍선 · 실시간 이벤트 · 전송 응답 · 메우기 조회가 전부 `mergeMessage`(`@/utils/chatMessages`)로 합쳐진다 - `clientMsgId`가 같으면 하나.
 *  - 메우기(R37-3, `@/utils/chatGapFill`): 실시간은 알림이고 진실은 조회다. 구독이 `SUBSCRIBED`가 될 때(다시 연결될 때도 같은 신호)와 화면이 다시 보일 때
 *    (`visibilitychange` = RN AppState `active`) 마지막으로 받은 서버 메시지 이후를 조회해 합친다. 같은 메시지가 두 번 와도 하나.
 *  - 읽음: 상대가 보낸 미확인 메시지가 있을 때만 `markMessagesRead`(발신자가 나인 행은 대상에서 뺀다).
 *  - 글 큐: `textQueueHub`(오프라인이면 쌓고 돌아오면 순서대로 · 중복 0). 사진 · 스토리: `photoQueueHub`(영속 큐). 큐는 허브가 갖고 이 훅은 화면 상태에 반영만 한다 - 탭을 떠나도 큐는 멈추지 않는다.
 *  - 복사본이 사라지거나 복사하지 못해 큐에서 빠진 사진 말풍선은 이 세션에서 실패로 보이고, 다시 보낼 수 없어 취소(길게 누르기)로 지운다.
 * `warmth_score` · `sentiment` · `analyzed_at`은 읽지도 쓰지도 않는다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatDb, MessageRow, StoryRow } from '@/services/chatCore'
import { fillMessageGap } from '@/utils/chatGapFill'
import {
  canSendBody, mergeMessage, mergeMessages, pickUnreadFromPartner, rowToChatMessage, syncQueuedMessages, type ChatMessage,
} from '@/utils/chatMessages'
import { syncPhotoMessages } from '@/utils/chatPhotoQueue'
import type { OutgoingMessage } from '@/utils/chatQueue'
import { generateUuidV4 } from '@/utils/uuid'
import { getSupabase } from '../../auth/client'
import { photoQueueHub, type PhotoQueueHub, type QueueablePhoto } from '../../photoQueue/photoQueueHub'
import { fetchMessages, fetchMessagesAfter, fetchStories, markMessagesRead } from './chatApi'
import { textQueueHub, type TextQueueHub } from './textQueueHub'

/** 고른 사진(선택기가 준 것) 중 큐에 필요한 것. */
export type ChatPhotoInput = QueueablePhoto

export interface ChatMessagesResult {
  messages: ChatMessage[]
  loading: boolean
  sendText: (body: string) => Promise<void>
  /** 전송 실패 말풍선의 [다시 보내기]. */
  retryFailed: (clientMsgId: string) => void
  /** 전송 중 · 실패 말풍선을 길게 눌렀을 때 - 전송 취소. */
  cancelPending: (clientMsgId: string) => void
  /** 글 · 사진 큐에 자동 재시도 중인 항목이 남아 있다(연결이 끊긴 것으로 본다 - F05 안내). */
  hasQueued: boolean
  /** 사진 한 장을 보낸다(복사 -> 영속 큐 -> 올린 뒤 메시지 한 줄). 앱이 꺼져도 다음에 열 때 이어서 보낸다. */
  sendPhoto: (photo: ChatPhotoInput) => Promise<void>
  stories: StoryRow[]
  storiesLoading: boolean
  /** 고른 사진을 바로 스토리로 올린다(R13-11 #6, 편집 화면 · 캡션 없음). 올렸거나 큐에서 이어 보내는 중이면 true, 복사하지 못했거나 영구 실패면 false(큐에 남기지 않는다). */
  postStory: (photo: ChatPhotoInput) => Promise<boolean>
}

export interface ChatHubs {
  text: TextQueueHub
  photo: PhotoQueueHub
}
const DEFAULT_HUBS: ChatHubs = { text: textQueueHub, photo: photoQueueHub }

export function useChatMessages(coupleId: string | null, currentUserId: string | null, hubs: ChatHubs = DEFAULT_HUBS): ChatMessagesResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [stories, setStories] = useState<StoryRow[]>([])
  const [storiesLoading, setStoriesLoading] = useState(true)
  /** 메우기가 "마지막으로 받은 메시지"를 읽는 자리(구독 콜백이 낡은 상태를 보지 않게). */
  const messagesRef = useRef<ChatMessage[]>([])
  const [hasTextQueued, setHasTextQueued] = useState(false)
  const [hasPhotoQueued, setHasPhotoQueued] = useState(false)
  const lostPhotoIdsRef = useRef<Set<string>>(new Set())
  const db = getSupabase() as unknown as ChatDb | null

  // 큐는 허브가 갖는다 - 같은 허브에 붙어(같은 커플 · 사용자면 아무 일도 없다) 확정 행 · 큐 변화를 화면 상태에 반영한다.
  useEffect(() => {
    if (!coupleId || !currentUserId) {
      setHasTextQueued(false)
      setHasPhotoQueued(false)
      return
    }
    hubs.text.attach(coupleId, currentUserId)
    hubs.photo.attach(coupleId, currentUserId)
    const offText = hubs.text.subscribe({
      onMessage: (row) => setMessages((prev) => mergeMessage(prev, rowToChatMessage(row))),
      onTextQueue: (queue) => {
        setMessages((prev) => syncQueuedMessages(prev, queue))
        // 자동 재시도 중인 항목만(소진 · 영구 실패는 말풍선의 [다시 보내기]가 맡는다).
        setHasTextQueued(queue.some((item) => item.status === 'pending'))
      },
    })
    const offPhoto = hubs.photo.subscribe({
      onMessage: (row) => setMessages((prev) => mergeMessage(prev, rowToChatMessage(row))),
      onStory: (story) => setStories((prev) => (prev.some((x) => x.id === story.id) ? prev : [story, ...prev])),
      onPhotoQueue: (items) => {
        setMessages((prev) => syncPhotoMessages(prev, items))
        setHasPhotoQueued(items.some((item) => item.status === 'pending'))
      },
      onPhotoLost: (item) => {
        if (item.kind !== 'message') return
        lostPhotoIdsRef.current.add(item.clientId)
        setMessages((prev) => prev.map((m) => (m.clientMsgId === item.clientId ? { ...m, pending: false, failed: true } : m)))
      },
    })
    return () => {
      offText()
      offPhoto()
    }
  }, [coupleId, currentUserId, hubs])

  // 초기 메시지 로드.
  useEffect(() => {
    if (!coupleId || !db) {
      setMessages([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchMessages(db, coupleId)
      .then((rows) => { if (!cancelled) setMessages((prev) => mergeMessages(prev, rows.map(rowToChatMessage))) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId, db])

  messagesRef.current = messages

  // Realtime 구독 - 상대(및 나 자신의 다른 기기)가 보낸 변경을 병합한다.
  useEffect(() => {
    const client = getSupabase()
    if (!coupleId || !client || !db) return
    const fillGap = () => {
      void fillMessageGap({
        getMessages: () => messagesRef.current,
        fetchAfter: (after) => fetchMessagesAfter(db, coupleId, after),
        apply: (update) => setMessages(update),
      })
    }
    const channel = client
      .channel(`messages:${coupleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `couple_id=eq.${coupleId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return
          setMessages((prev) => mergeMessage(prev, rowToChatMessage(payload.new as MessageRow)))
        },
      )
      // 실시간은 알림이고 진실은 조회다(R37-3): SUBSCRIBED(다시 연결될 때도 같은 신호)에서 마지막 메시지 이후를 조회해 합친다.
      .subscribe((status) => { if (status === 'SUBSCRIBED') fillGap() })
    const onVisible = () => { if (document.visibilityState === 'visible') fillGap() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      void client.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId, db])

  // 읽음 처리 - 상대가 보낸 미확인 메시지가 있을 때만 호출한다.
  useEffect(() => {
    if (!coupleId || !currentUserId || !db) return
    if (pickUnreadFromPartner(messages, currentUserId).length === 0) return
    markMessagesRead(db, coupleId, currentUserId)
      .then((rows) => setMessages((prev) => mergeMessages(prev, rows.map(rowToChatMessage))))
      .catch(() => {
        // 실패해도 unreadIds가 다음 렌더링까지 남아 있어 다시 시도된다.
      })
  }, [messages, coupleId, currentUserId, db])

  const sendText = useCallback(async (body: string) => {
    if (!coupleId || !currentUserId) return
    // 화면의 보내기 막음 · API의 거부와 같은 규칙(`canSendBody`, R21-5).
    if (!canSendBody(body)) return
    const trimmed = body.trim()
    const clientMsgId = generateUuidV4()
    const sentAt = new Date().toISOString()
    const outgoing: OutgoingMessage = { clientMsgId, coupleId, senderId: currentUserId, body: trimmed, sentAt }
    setMessages((prev) => mergeMessage(prev, {
      id: `local:${clientMsgId}`, clientMsgId, coupleId, senderId: currentUserId, body: trimmed, mediaPath: null, sentAt, readAt: null, pending: true,
    }))
    const result = await hubs.text.attemptText(outgoing)
    if (result.outcome === 'failed') hubs.text.getTextQueue()?.enqueueAfterInitialFailure(outgoing, result.errorClass)
  }, [coupleId, currentUserId, hubs])

  const sendPhoto = useCallback(async (photo: ChatPhotoInput) => {
    if (!coupleId || !currentUserId || !hubs.photo.getPhotoQueue()) return
    const queued = await hubs.photo.enqueue(photo, 'message')
    if (!queued) {
      // 복사하지 못했다 - 큐에 넣을 수 없어 실패로 보인다(길게 눌러 지운다).
      const clientMsgId = generateUuidV4()
      lostPhotoIdsRef.current.add(clientMsgId)
      setMessages((prev) => mergeMessage(prev, {
        id: `local:${clientMsgId}`, clientMsgId, coupleId, senderId: currentUserId, body: null, mediaPath: null, sentAt: new Date().toISOString(),
        readAt: null, pending: false, failed: true, localUri: photo.uri,
      }))
    }
  }, [coupleId, currentUserId, hubs])

  const retryFailed = useCallback((clientMsgId: string) => {
    if (hubs.photo.getPhotoQueue()?.has(clientMsgId)) {
      hubs.photo.getPhotoQueue()?.retryNow(clientMsgId)
      return
    }
    if (lostPhotoIdsRef.current.has(clientMsgId)) return // 복사본이 없어 다시 보낼 수 없다
    hubs.text.getTextQueue()?.retryNow(clientMsgId)
  }, [hubs])

  const cancelPending = useCallback((clientMsgId: string) => {
    if (hubs.photo.getPhotoQueue()?.has(clientMsgId)) {
      hubs.photo.getPhotoQueue()?.cancel(clientMsgId)
      setMessages((prev) => prev.filter((m) => m.clientMsgId !== clientMsgId))
      return
    }
    if (lostPhotoIdsRef.current.delete(clientMsgId)) {
      setMessages((prev) => prev.filter((m) => m.clientMsgId !== clientMsgId))
      return
    }
    hubs.text.getTextQueue()?.cancel(clientMsgId)
  }, [hubs])

  // 스토리 목록 로드(작성 UI + 목록 표시만 - 만료 · 보관 배치는 범위 밖).
  useEffect(() => {
    if (!coupleId || !db) {
      setStories([])
      setStoriesLoading(false)
      return
    }
    let cancelled = false
    setStoriesLoading(true)
    fetchStories(db, coupleId)
      .then((rows) => { if (!cancelled) setStories(rows) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setStoriesLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId, db])

  const postStory = useCallback(async (photo: ChatPhotoInput): Promise<boolean> => {
    if (!hubs.photo.getPhotoQueue()) return false
    const queued = await hubs.photo.enqueue(photo, 'story')
    if (!queued) return false
    const { item, outcome } = queued
    if (outcome === 'failed' || outcome === 'lost') {
      // 사람에게 실패를 알리는 경우 - 나중에 몰래 올라가지 않게 큐에서 뺀다.
      hubs.photo.getPhotoQueue()?.cancel(item.clientId)
      return false
    }
    return true
  }, [hubs])

  return { messages, loading, sendText, retryFailed, cancelPending, hasQueued: hasTextQueued || hasPhotoQueued, sendPhoto, stories, storiesLoading, postStory }
}
