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
 * 사진(메시지 · 스토리)은 **영속 큐**로 보낸다(R37-2): 고른 사진을 앱 문서 폴더에 복사하고(`photoQueueFs`), 큐 항목(클라이언트 id · 종류 ·
 * 복사본 경로)을 기기에 저장(`photoQueueStore`)하며, 성공하면 항목과 복사본을 지운다. 앱을 다시 열면(이 훅이 붙을 때) 남은 항목을 이어서
 * 보낸다. 다시 보내도 Storage 객체 · 행이 각 하나인 이유는 `chatPhotoCore.ts` 머리 주석. 복사본이 사라진 항목은 실패로 보이고 큐에서 빠진다.
 *
 * `warmth_score`/`sentiment`/`analyzed_at`은 이 훅에서 읽거나 쓰지
 * 않는다(Phase 7 담당).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../services/supabase'
import {
  attemptQueuedPhoto,
  fetchMessages,
  fetchMessagesAfter,
  fetchStories,
  markMessagesRead,
  sendMessage as apiSendMessage,
  type MessageRow,
  type StoryRow,
} from '../services/chatApi'
import { photoQueueFs } from '../services/photoQueueFs'
import { loadPhotoQueue, savePhotoQueue } from '../services/photoQueueStore'
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
import { ChatPhotoQueue } from '../utils/chatPhotoQueueRunner'
import { syncPhotoMessages, type QueuedPhoto } from '../utils/chatPhotoQueue'
import type { PickedPhoto } from '../utils/dateRecord'
import { generateUuidV4 } from '../utils/uuid'
import { fillMessageGap } from '../utils/chatGapFill'

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
  /** 사진 한 장을 보낸다(복사 -> 영속 큐 -> 올린 뒤 메시지 한 줄). 앱이 꺼져도 다음에 열 때 이어서 보낸다. */
  sendPhoto: (photo: PickedPhoto) => Promise<void>
  stories: StoryRow[]
  storiesLoading: boolean
  /**
   * 고른 사진을 바로 스토리로 올린다(R13-11 #6, 편집 화면·캡션 없음). 영속 큐로 보낸다.
   * 올렸거나 연결이 불안정해 큐에서 이어 보내는 중이면 true, 복사하지 못했거나 영구 실패(권한 거부 등)면 false(이 경우 큐에 남기지 않는다).
   */
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
  /** 메우기가 "마지막으로 받은 메시지"를 읽는 자리(구독 콜백이 낡은 상태를 보지 않게). */
  const messagesRef = useRef<ChatMessage[]>([])
  const [hasTextQueued, setHasTextQueued] = useState(false)
  const [hasPhotoQueued, setHasPhotoQueued] = useState(false)
  const hasQueued = hasTextQueued || hasPhotoQueued
  /** 사진 영속 큐(메시지 · 스토리). */
  const photoQueueRef = useRef<ChatPhotoQueue | null>(null)
  /** 복사본이 사라지거나 복사하지 못해 큐에서 빠진 사진 말풍선(이 세션에서 실패로 보인다). 다시 보낼 수 없고 취소(길게 누르기)로 지운다. */
  const lostPhotoIdsRef = useRef<Set<string>>(new Set())

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
      setHasTextQueued(false)
      return
    }

    const storageKey = chatQueueStorageKey(coupleId)

    const onQueueChange = (queue: QueuedMessage[]) => {
      AsyncStorage.setItem(storageKey, JSON.stringify(queue)).catch(() => {
        // 저장 실패해도 이번 세션 메모리 큐는 계속 동작한다 — 다음 변경 때 다시 저장을 시도한다.
      })
      setMessages((prev) => syncQueuedMessages(prev, queue))
      // 자동 재시도 중인 항목만(소진·영구 실패는 말풍선의 "다시 보내기"가 맡는다).
      setHasTextQueued(queue.some((item) => item.status === 'pending'))
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

  // 사진 영속 큐 복원 + 인스턴스화 - 앱을 다시 열면 남은 항목을 이어서 보낸다(R37-2).
  useEffect(() => {
    if (!coupleId || !currentUserId) {
      photoQueueRef.current?.dispose()
      photoQueueRef.current = null
      setHasPhotoQueued(false)
      return
    }

    const queue = new ChatPhotoQueue({
      attempt: async (item) => {
        const result = await attemptQueuedPhoto(item)
        if (result.outcome === 'done') {
          const message = result.message
          const story = result.story
          if (message) setMessages((prev) => mergeMessage(prev, rowToChatMessage(message)))
          if (story) setStories((prev) => (prev.some((x) => x.id === story.id) ? prev : [story, ...prev]))
        }
        return result
      },
      onChange: (items) => {
        void savePhotoQueue(coupleId, currentUserId, items)
        setMessages((prev) => syncPhotoMessages(prev, items))
        setHasPhotoQueued(items.some((item) => item.status === 'pending'))
      },
      discard: (item) => {
        void photoQueueFs.remove(item.localUri)
      },
      onLost: (item) => {
        if (item.kind !== 'message') return
        lostPhotoIdsRef.current.add(item.clientId)
        setMessages((prev) =>
          prev.map((m) => (m.clientMsgId === item.clientId ? { ...m, pending: false, failed: true } : m)),
        )
      },
    })
    photoQueueRef.current = queue

    let cancelled = false
    void loadPhotoQueue(coupleId, currentUserId).then((items) => {
      if (!cancelled) queue.hydrate(items)
    })

    return () => {
      cancelled = true
      queue.dispose()
      photoQueueRef.current = null
    }
  }, [coupleId, currentUserId])

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

  messagesRef.current = messages

  // Realtime 구독 — 상대(및 나 자신의 다른 기기)가 보낸 변경을 병합한다.
  useEffect(() => {
    if (!coupleId) return

    const fillGap = () => {
      void fillMessageGap({
        getMessages: () => messagesRef.current,
        fetchAfter: (after) => fetchMessagesAfter(coupleId, after),
        apply: (update) => setMessages(update),
      })
    }

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
      // 실시간은 알림이고 진실은 조회다(R37-3): 구독이 SUBSCRIBED가 될 때(다시 연결될 때도 같은 신호)
      // 마지막으로 받은 메시지 이후를 조회해 합친다. 같은 메시지가 두 번 와도 mergeMessage가 하나로 만든다.
      // (재연결 때 큐를 비우는 보조 트리거는 쓰지 않는다 - 재시도는 `ChatRetryQueue`의 백오프 타이머가 맡는다.)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') fillGap()
      })

    // 앱이 앞으로 돌아올 때도 같은 메우기.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fillGap()
    })

    return () => {
      appStateSub.remove()
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

  /** 고른 사진을 앱 문서 폴더에 복사해 큐 항목으로 만든다. 복사하지 못하면 null. */
  const toQueuedPhoto = useCallback(
    async (photo: PickedPhoto, kind: QueuedPhoto['kind']): Promise<QueuedPhoto | null> => {
      if (!coupleId || !currentUserId) return null
      const clientId = generateUuidV4()
      try {
        const localUri = await photoQueueFs.copyIn(photo.uri, clientId, photo.ext)
        return {
          clientId,
          kind,
          coupleId,
          userId: currentUserId,
          localUri,
          ext: photo.ext,
          contentType: contentTypeOf(photo),
          sentAt: new Date().toISOString(),
          retryCount: 0,
          status: 'pending',
        }
      } catch {
        return null
      }
    },
    [coupleId, currentUserId],
  )

  const sendPhoto = useCallback(
    async (photo: PickedPhoto) => {
      if (!coupleId || !currentUserId || !photoQueueRef.current) return
      const item = await toQueuedPhoto(photo, 'message')
      if (!item) {
        // 복사하지 못했다 - 큐에 넣을 수 없어 실패로 보인다(길게 눌러 지운다).
        const clientMsgId = generateUuidV4()
        lostPhotoIdsRef.current.add(clientMsgId)
        setMessages((prev) =>
          mergeMessage(prev, {
            id: `local:${clientMsgId}`,
            clientMsgId,
            coupleId,
            senderId: currentUserId,
            body: null,
            mediaPath: null,
            sentAt: new Date().toISOString(),
            readAt: null,
            pending: false,
            failed: true,
            localUri: photo.uri,
          }),
        )
        return
      }
      await photoQueueRef.current.add(item)
    },
    [coupleId, currentUserId, toQueuedPhoto],
  )

  const retryFailed = useCallback((clientMsgId: string) => {
    if (photoQueueRef.current?.has(clientMsgId)) {
      photoQueueRef.current.retryNow(clientMsgId)
      return
    }
    if (lostPhotoIdsRef.current.has(clientMsgId)) return // 복사본이 없어 다시 보낼 수 없다
    retryQueueRef.current?.retryNow(clientMsgId)
  }, [])

  const cancelPending = useCallback((clientMsgId: string) => {
    if (photoQueueRef.current?.has(clientMsgId)) {
      photoQueueRef.current.cancel(clientMsgId)
      setMessages((prev) => prev.filter((m) => m.clientMsgId !== clientMsgId))
      return
    }
    if (lostPhotoIdsRef.current.delete(clientMsgId)) {
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
      if (!photoQueueRef.current) return false
      const item = await toQueuedPhoto(photo, 'story')
      if (!item) return false
      const outcome = await photoQueueRef.current.add(item)
      if (outcome === 'failed' || outcome === 'lost') {
        // 사람에게 실패를 알리는 경우 - 나중에 몰래 올라가지 않게 큐에서 뺀다.
        photoQueueRef.current.cancel(item.clientId)
        return false
      }
      return true
    },
    [toQueuedPhoto],
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
