/**
 * Realtime 메시지 구독 + 로컬 상태 병합 + 오프라인 큐잉/재전송 + 읽음 처리.
 *
 * 근거: docs/ONDOLOG_ROADMAP.md §Phase 5, docs/ONDOLOG_MASTER.md Part 9-3,
 * 작업 지시 "채팅 전송 큐를 보완해주세요".
 *
 * 오프라인 큐 영속화(작업 지시 "1. 큐 영속화"): AsyncStorage 키
 * `chat_queue:{coupleId}`(`chatQueueStorageKey`)에 즉시 저장한다. 이미
 * 프로젝트 의존성에 있는 네이티브 모듈이라 신규 추가가 아니다. 이 규칙은
 * 온보딩 비로그인 구간(`app/(onboarding)` 화면 2~5)의 "AsyncStorage 금지"
 * 규칙과 무관하다 — 그 규칙은 그 화면들에만 적용된다.
 *
 * 재시도 정책(최대 5회, 지수 백오프, 에러 유형별 즉시 실패 분기)과
 * 실제 setTimeout 스케줄링은 `src/utils/chatRetryQueue.ts`
 * (`ChatRetryQueue`)에 위임한다 — 이 훅은 그 결과를 React state에
 * 반영하고 AsyncStorage와 연결할 뿐이다. 멱등 재전송의 실제 판단,
 * 에러 분류, 백오프 시간 계산은 전부 `src/utils/chatQueue.ts`의 순수
 * 함수다.
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
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../services/supabase'
import {
  createStory as apiCreateStory,
  fetchMessages,
  fetchStories,
  markMessagesRead,
  sendMessage as apiSendMessage,
  uploadChatMedia,
  type MessageRow,
  type StoryRow,
} from '../services/chatApi'
import { readLocalBytes } from '../services/photoPicker'
import {
  chatQueueStorageKey,
  parseQueuedMessages,
  type OutgoingMessage,
  type QueuedMessage,
} from '../utils/chatQueue'
import { ChatRetryQueue, type AttemptOutcome } from '../utils/chatRetryQueue'
import {
  canSendBody,
  mergeMessage,
  mergeMessages,
  pickUnreadFromPartner,
  rowToChatMessage,
  syncQueuedMessages,
  type ChatMessage,
} from '../utils/chatMessages'
import { entryStoragePath, type PickedPhoto } from '../utils/dateRecord'
import { generateUuidV4 } from '../utils/uuid'

const IMAGE_CONTENT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
}

function contentTypeOf(photo: PickedPhoto): string {
  return photo.mimeType ?? IMAGE_CONTENT_TYPE[photo.ext] ?? 'image/jpeg'
}

export interface UseRealtimeMessagesResult {
  messages: ChatMessage[]
  loading: boolean
  sendText: (body: string) => Promise<void>
  /** 전송 실패(§13-3) 말풍선의 "다시 시도" 캡션 탭 핸들러. */
  retryFailed: (clientMsgId: string) => void
  /** 전송 중/실패 말풍선을 길게 눌렀을 때 — 전송 취소. */
  cancelPending: (clientMsgId: string) => void
  /** 텍스트 오프라인 큐에 보내지 못한 메시지가 남아 있다(연결이 끊긴 것으로 본다 - F05 안내). */
  hasQueued: boolean
  /** 사진 한 장을 보낸다(올린 뒤 메시지 한 줄). 텍스트 큐와 별개로 이 세션 메모리에서만 재시도한다. */
  sendPhoto: (photo: PickedPhoto) => Promise<void>
  stories: StoryRow[]
  storiesLoading: boolean
  /** 고른 사진을 바로 스토리로 올린다(R13-11 #6, 편집 화면·캡션 없음). 성공 여부를 돌려준다. */
  postStory: (photo: PickedPhoto) => Promise<boolean>
}

export function useRealtimeMessages(
  coupleId: string | null,
  currentUserId: string | null,
): UseRealtimeMessagesResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [stories, setStories] = useState<StoryRow[]>([])
  const [storiesLoading, setStoriesLoading] = useState(true)
  const retryQueueRef = useRef<ChatRetryQueue | null>(null)
  const [hasQueued, setHasQueued] = useState(false)
  /** 사진 보내기 작업(이 세션 메모리). 성공하면 지운다. */
  const photoJobsRef = useRef<Map<string, { photo: PickedPhoto; sentAt: string }>>(new Map())

  /** 전송 1회 시도(최초 시도와 재시도가 공유) — 성공/중복이면 화면에 확정 행을 반영한다. */
  const attemptSend = useCallback(async (item: OutgoingMessage): Promise<AttemptOutcome> => {
    const result = await apiSendMessage(item)

    if (result.status === 'sent') {
      setMessages((prev) => mergeMessage(prev, rowToChatMessage(result.row)))
      return { outcome: 'sent' }
    }
    if (result.status === 'already_sent') {
      if (result.row) setMessages((prev) => mergeMessage(prev, rowToChatMessage(result.row!)))
      return { outcome: 'already_sent' }
    }
    return { outcome: 'failed', errorClass: result.errorClass }
  }, [])

  // 큐 복원 + 커플별 ChatRetryQueue 인스턴스화(완료 기준: 강제 종료 후
  // 재실행 시 pending 복원 + 재시도 재개).
  useEffect(() => {
    if (!coupleId) {
      retryQueueRef.current?.dispose()
      retryQueueRef.current = null
      setHasQueued(false)
      return
    }

    const storageKey = chatQueueStorageKey(coupleId)

    const onQueueChange = (queue: QueuedMessage[]) => {
      AsyncStorage.setItem(storageKey, JSON.stringify(queue)).catch(() => {
        // 저장 실패해도 이번 세션 메모리 큐는 계속 동작한다 — 다음 변경 때 다시 저장을 시도한다.
      })
      setMessages((prev) => syncQueuedMessages(prev, queue))
      // 자동 재시도 중인 항목만(소진·영구 실패는 말풍선의 "다시 보내기"가 맡는다).
      setHasQueued(queue.some((item) => item.status === 'pending'))
    }

    // 큐 인스턴스는 이 자리에서 동기적으로 만든다(AsyncStorage 읽기를
    // 기다리지 않는다) — `retryQueueRef.current`가 잠깐 비어 있는 창이
    // 생기면 그 사이 전송이 실패했을 때 큐에 아예 안 들어가고 조용히
    // 사라질 수 있기 때문이다. 복원된 항목은 나중에 `hydrate`로 합친다.
    const queue = new ChatRetryQueue({ attemptSend, onQueueChange })
    retryQueueRef.current = queue

    let cancelled = false
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (cancelled) return
        queue.hydrate(parseQueuedMessages(raw))
      })
      .catch(() => {
        // 복원 읽기 자체가 실패해도 이미 만들어진 빈 큐로 계속 동작한다.
      })

    return () => {
      cancelled = true
      queue.dispose()
      retryQueueRef.current = null
    }
  }, [coupleId, attemptSend])

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
      .subscribe()
      // 재연결 시점에 큐를 비우는 보조 트리거는 더 이상 쓰지 않는다 —
      // 이제 각 항목의 백오프 타이머(`ChatRetryQueue`)가 유일한 재시도
      // 스케줄 소스다(구 방식은 메모리 상주 4초 인터벌 + 재연결 트리거
      // 이중 구조였다).

    return () => {
      supabase.removeChannel(channel)
    }
  }, [coupleId])

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
      // 화면의 보내기 막음·API의 거부와 같은 규칙(`canSendBody`, R21-5).
      if (!canSendBody(body)) return
      const trimmed = body.trim()

      const clientMsgId = generateUuidV4()
      const sentAt = new Date().toISOString()
      const outgoing: OutgoingMessage = {
        clientMsgId,
        coupleId,
        senderId: currentUserId,
        body: trimmed,
        sentAt,
      }

      setMessages((prev) =>
        mergeMessage(prev, {
          id: `local:${clientMsgId}`,
          clientMsgId,
          coupleId,
          senderId: currentUserId,
          body: trimmed,
          mediaPath: null,
          sentAt,
          readAt: null,
          pending: true,
        }),
      )

      const result = await attemptSend(outgoing)
      if (result.outcome === 'failed') {
        retryQueueRef.current?.enqueueAfterInitialFailure(outgoing, result.errorClass)
      }
    },
    [coupleId, currentUserId, attemptSend],
  )

  /** 사진 한 건 보내기 - 올리고(경로는 `client_msg_id`에서 정해져 재시도해도 같은 파일), 메시지 한 줄을 멱등으로 넣는다. */
  const runPhotoJob = useCallback(
    async (clientMsgId: string) => {
      const job = photoJobsRef.current.get(clientMsgId)
      if (!job || !coupleId || !currentUserId) return
      const markFailed = () =>
        setMessages((prev) =>
          prev.map((m) => (m.clientMsgId === clientMsgId ? { ...m, pending: false, failed: true } : m)),
        )
      try {
        const path = entryStoragePath(coupleId, clientMsgId, job.photo.ext)
        const bytes = await readLocalBytes(job.photo.uri)
        const uploaded = await uploadChatMedia('messages', path, bytes, contentTypeOf(job.photo))
        if (!uploaded.ok) return markFailed()
        const result = await apiSendMessage({ clientMsgId, coupleId, senderId: currentUserId, body: null, mediaPath: path })
        if (result.status === 'failed') return markFailed()
        if (result.row) setMessages((prev) => mergeMessage(prev, rowToChatMessage(result.row!)))
        photoJobsRef.current.delete(clientMsgId)
      } catch {
        markFailed()
      }
    },
    [coupleId, currentUserId],
  )

  const sendPhoto = useCallback(
    async (photo: PickedPhoto) => {
      if (!coupleId || !currentUserId) return
      const clientMsgId = generateUuidV4()
      const sentAt = new Date().toISOString()
      photoJobsRef.current.set(clientMsgId, { photo, sentAt })
      setMessages((prev) =>
        mergeMessage(prev, {
          id: `local:${clientMsgId}`,
          clientMsgId,
          coupleId,
          senderId: currentUserId,
          body: null,
          mediaPath: null,
          sentAt,
          readAt: null,
          pending: true,
          localUri: photo.uri,
        }),
      )
      await runPhotoJob(clientMsgId)
    },
    [coupleId, currentUserId, runPhotoJob],
  )

  const retryFailed = useCallback(
    (clientMsgId: string) => {
      if (photoJobsRef.current.has(clientMsgId)) {
        setMessages((prev) =>
          prev.map((m) => (m.clientMsgId === clientMsgId ? { ...m, pending: true, failed: false } : m)),
        )
        void runPhotoJob(clientMsgId)
        return
      }
      retryQueueRef.current?.retryNow(clientMsgId)
    },
    [runPhotoJob],
  )

  const cancelPending = useCallback((clientMsgId: string) => {
    if (photoJobsRef.current.delete(clientMsgId)) {
      setMessages((prev) => prev.filter((m) => m.clientMsgId !== clientMsgId))
      return
    }
    retryQueueRef.current?.cancel(clientMsgId)
  }, [])

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
    async (photo: PickedPhoto): Promise<boolean> => {
      if (!coupleId || !currentUserId) return false
      try {
        const path = entryStoragePath(coupleId, generateUuidV4(), photo.ext)
        const bytes = await readLocalBytes(photo.uri)
        const uploaded = await uploadChatMedia('stories', path, bytes, contentTypeOf(photo))
        if (!uploaded.ok) return false
        const row = await apiCreateStory({ coupleId, authorId: currentUserId, mediaPath: path })
        setStories((prev) => [row, ...prev])
        return true
      } catch {
        return false
      }
    },
    [coupleId, currentUserId],
  )

  return {
    messages,
    loading,
    sendText,
    retryFailed,
    cancelPending,
    hasQueued,
    sendPhoto,
    stories,
    storiesLoading,
    postStory,
  }
}
