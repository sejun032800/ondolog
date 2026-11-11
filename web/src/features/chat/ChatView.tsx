/**
 * 채팅 탭 화면(F01 채팅 · F02 미연결 · F03 스토리 · F04 첨부 · F05 보내는 중/다시 보내기 · F06 사진 크게 보기) - 보드 `N-T-Tabs` F01 · `N-S-F-Chat` F02~F06(patch7이 F02 둘째 문장을 지움).
 * RN `app/(tabs)/chat.tsx` + `components/chat/*`의 웹판. 상태(실시간 · 읽음 · 큐 · 스토리)는 `useChatMessages`가 맡고, 이 파일은 그리기와 눌렀을 때의 연결만 한다.
 *
 * - 미연결(F02): 화면 안 안내 카드(`CoupleGate fallback`) - 시트가 저절로 뜨지 않는다(B4). 두 버튼은 바로 초대로 간다(B12).
 * - 원문은 Pretendard 그대로(MaruBuri는 인용에만). 읽음 = 숫자 1(내 메시지를 상대가 아직 안 읽었을 때 rose). 보내는 중 · 다시 보내기는 정지 표시(스피너 0).
 * - 이 화면에는 공유 카드 · 잡지에 실린다는 예고 · 권유 문구를 두지 않는다(MASTER 9-5 r66, R24-2). F02 둘째 문장("잡지의 재료")도 뺐다.
 * - 입력창 처리(포커스 유지 · 한글 조합)는 `platform/useChatComposer`, 끝에 붙기 · 부드러운 이동은 `platform/useStickToEnd`를 그대로 쓴다.
 * - 말풍선: 보낸 글을 길게 누르면 앱이 그리는 작은 메뉴의 [복사](1b 웹뷰 처리의 예외 - 글자 선택 · 시스템 메뉴는 여전히 0), 보내는 중 · 실패 말풍선을 길게 누르면 전송 취소(RN 그대로).
 * - 스토리 · 사진 크게 보기 · 첨부 · 복사 메뉴는 탭 바 위로 올라오는 면이고(`PhoneLayer`), 하드웨어 뒤로 가기는 열린 것 하나만 닫는다.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { groupMessagesByDate, chatDateLabel, chatTimeLabel, canSendBody, photoStampLabel, type ChatMessage } from '@/utils/chatMessages'
import { computeDaysTogetherKst } from '@/utils/relationshipDays'
import { useAuthStore } from '../../auth/stores'
import { CoupleGate, CoupleNeeded } from '../../components/CoupleGate'
import { PhoneLayer } from '../../components/PhoneLayer'
import { PhotoSourceSheet, PHOTO_CAMERA_ENABLED, PHOTO_SOURCE_COPY } from '../../components/PhotoSourceSheet'
import { PhotoViewer } from '../../components/PhotoViewer'
import { Sheet, useSheetClose } from '../../components/Sheet'
import { Skeleton } from '../../components/Skeleton'
import type { NativeBridge } from '../../platform/bridge'
import { useChatComposer } from '../../platform/useChatComposer'
import { useKeyboardOpen } from '../../platform/useKeyboardOpen'
import { useStickToEnd } from '../../platform/useStickToEnd'
import { useCoupleStore } from '../../stores/coupleStore'
import { showToast } from '../../stores/toastStore'
import { pickPhotos, releasePhotoUrls } from '../feed/photoPicker'
import { usePartnerName } from '../main/useMainData'
import { saveChatPhoto, shareChatPhoto } from './chatPhotoActions'
import { saveNotice } from '../../platform/imageSave'
import { useQueuedPreviews } from './localPreview'
import { StoryViewer, type StoryViewItem, type StoryViewPayload } from './StoryViewer'
import { useChatMessages, type ChatHubs } from './useChatMessages'
import { useSignedMedia } from './useSignedMedia'

export const MESSAGE_COPY = {
  sending: '보내는 중',
  retry: '다시 보내기',
  empty: '첫 마디를 남겨보세요',
  offline: '연결이 끊겼어요. 다시 연결되면 이어서 보내요',
} as const

export const COMPOSER_COPY = { placeholder: '메시지 보내기', album: PHOTO_SOURCE_COPY.album, camera: PHOTO_SOURCE_COPY.camera, attach: '첨부', send: '보내기' } as const
export const CHAT_COPY = { addStory: '올리기', posting: '올리는 중', myStory: '나', copy: '복사', copied: '복사했어요', copyFailed: '복사하지 못했어요' } as const

/** F02 - 보드의 둘째 문장("여기서 나눈 대화가 온도와 잡지의 재료가 돼요")은 patch7 · 규칙 9로 뺐다. */
export const CHAT_DISCONNECTED_COPY = { title: '상대만 있으면 돼요', body: '채팅은 연인과 연결되면 열려요.' } as const

/** F04 [카메라]: 웹 입력 `capture`로 연다. 기기에서 안 열리면 이 값만 false로(버튼이 사라진다). 결정 기록 [74-5] 카메라. */
export const CHAT_CAMERA_ENABLED = PHOTO_CAMERA_ENABLED

/** 길게 누르기(ms). */
export const LONG_PRESS_MS = 500

// ---------------------------------------------------------------------------
// 길게 누르기
// ---------------------------------------------------------------------------

/** 포인터를 `LONG_PRESS_MS` 넘게 누르고 있으면 한 번 부른다. 움직이거나 떼면 취소. */
function useLongPress(onLong: (() => void) | undefined) {
  const timer = useRef<number | undefined>(undefined)
  const start = useRef<{ x: number; y: number } | null>(null)
  const cancel = () => {
    window.clearTimeout(timer.current)
    timer.current = undefined
    start.current = null
  }
  useEffect(() => cancel, [])
  if (!onLong) return {}
  return {
    onPointerDown: (e: React.PointerEvent) => {
      cancel()
      start.current = { x: e.clientX, y: e.clientY }
      timer.current = window.setTimeout(() => { timer.current = undefined; onLong() }, LONG_PRESS_MS)
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = start.current
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
  }
}

// ---------------------------------------------------------------------------
// 머리 · 스토리 줄 · 날짜 구분
// ---------------------------------------------------------------------------

export function ChatHeader({ name, days }: { name: string; days: number | null }) {
  return (
    <div className="chatHead" data-testid="chat-header">
      <h1 className="chatName">{name}</h1>
      {days !== null ? <span className="chatDays" data-testid="chat-days">{`D+${days}`}</span> : null}
    </div>
  )
}

export interface StoryPerson {
  key: string
  /** 줄에 적는 이름. 내 것은 "나". */
  label: string
  isMine: boolean
  /** 가장 최근 스토리 사진의 서명 URL. 아직 못 받았으면 빈 면. */
  thumbUri: string | undefined
  onPress: () => void
}

export function StoryStrip({ people, onAdd, posting }: { people: StoryPerson[]; onAdd: () => void; posting?: boolean }) {
  return (
    <div className="storyStripWrap">
      <div className="storyStrip" data-testid="chat-story-row">
        <button type="button" className="storyPerson press" aria-label="스토리 올리기" disabled={posting} data-testid="chat-story-add" onClick={onAdd}>
          <span className="storyRingPad"><span className="storyAdd">+</span></span>
          <span className="storyLabel mute">{posting ? CHAT_COPY.posting : CHAT_COPY.addStory}</span>
        </button>
        {people.map((p) => (
          <button key={p.key} type="button" className="storyPerson press" aria-label={`${p.label}의 스토리`} data-testid={`chat-story-${p.isMine ? 'mine' : 'partner'}`} onClick={p.onPress}>
            <span className={`storyRingPad ${p.isMine ? '' : 'ring'}`}>
              <span className="storyThumb">{p.thumbUri ? <img src={p.thumbUri} alt="" draggable={false} /> : null}</span>
            </span>
            <span className={`storyLabel ${p.isMine ? 'mute' : 'strong'}`}>{p.label}</span>
          </button>
        ))}
      </div>
      <div className="chatRule" />
    </div>
  )
}

export function DateDivider({ label }: { label: string }) {
  return (
    <div className="chatDivider" data-testid="chat-date-divider">
      <i /><span>{label}</span><i />
    </div>
  )
}

/** F05: 연결이 끊겨 자동으로 다시 보내는 중인 메시지가 있을 때 머리 아래에 한 줄. 정지 점 - 스피너 없음. */
export function OfflineBanner() {
  return (
    <div className="chatOffline" role="alert" data-testid="chat-offline-banner">
      <span className="dot" />
      <span>{MESSAGE_COPY.offline}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 말풍선 · 사진 메시지
// ---------------------------------------------------------------------------

export interface MessageItemProps {
  message: ChatMessage
  isMine: boolean
  /** 보낸 사람 이름(사진 아래 줄). */
  senderName: string
  /** 사진 메시지의 그릴 주소(서버에 올라간 사진은 서명 URL, 올리는 중인 사진은 복사본 미리보기). */
  photoUri: string | undefined
  /** 새로 들어온 말풍선이면 등장 연출. */
  fresh?: boolean
  onRetry: (clientMsgId: string) => void
  onCancel: (clientMsgId: string) => void
  onOpenPhoto: (message: ChatMessage) => void
  onCopy?: (text: string) => void
}

/** 시각 칸: 상태에 따라 "보내는 중" · "다시 보내기" · (읽음 1 +) 시각. */
function Meta({ message, isMine, onRetry }: Pick<MessageItemProps, 'message' | 'isMine' | 'onRetry'>) {
  if (message.failed) {
    return (
      <button type="button" className="chatRetry press" data-testid="chat-retry" onClick={() => message.clientMsgId && onRetry(message.clientMsgId)}>
        {MESSAGE_COPY.retry}
      </button>
    )
  }
  if (message.pending) return <span className="time right" data-testid="chat-sending">{MESSAGE_COPY.sending}</span>
  const unread = isMine && message.readAt === null
  return (
    <span className={`time ${isMine ? 'right' : ''}`} data-testid="chat-time">
      {unread ? <><span className="unread" data-testid="chat-unread">1</span><br /></> : null}
      {chatTimeLabel(message.sentAt)}
    </span>
  )
}

export function TextMessage({ message, isMine, fresh, onRetry, onCancel, onCopy }: MessageItemProps) {
  const queued = Boolean(message.pending || message.failed)
  // 보내는 중 · 실패 = 길게 눌러 전송 취소(RN), 보낸 글 = 길게 눌러 [복사].
  const long = useLongPress(
    queued ? (message.clientMsgId ? () => onCancel(message.clientMsgId as string) : undefined) : (onCopy && message.body ? () => onCopy(message.body as string) : undefined),
  )
  return (
    <div className={`chatRow ${isMine ? 'mine' : 'partner'} ${message.failed ? 'center' : ''} ${fresh ? 'enter' : ''}`} data-testid="chat-message">
      <span className={`bubble ${queued ? 'queued' : ''}`} {...long}>{message.body}</span>
      <Meta message={message} isMine={isMine} onRetry={onRetry} />
    </div>
  )
}

export function PhotoMessage({ message, isMine, senderName, photoUri, fresh, onRetry, onCancel, onOpenPhoto }: MessageItemProps) {
  const queued = Boolean(message.pending || message.failed)
  const long = useLongPress(queued && message.clientMsgId ? () => onCancel(message.clientMsgId as string) : undefined)
  const photo = (
    <span className={`chatPhoto ${queued ? 'queued' : ''}`}>
      {photoUri ? <img src={photoUri} alt="" draggable={false} /> : null}
    </span>
  )
  return (
    <div className={`chatPhotoItem ${fresh ? 'enter' : ''}`} data-testid="chat-photo-message">
      {queued ? (
        <div {...long}>{photo}</div>
      ) : (
        <button type="button" className="chatPhotoBtn press" aria-label={`${senderName}이 보낸 사진 크게 보기`} data-testid="chat-photo" onClick={() => onOpenPhoto(message)}>
          {photo}
        </button>
      )}
      <div className="chatPhotoCaption">
        <span className="who">{senderName}</span>
        {queued ? <Meta message={message} isMine={isMine} onRetry={onRetry} /> : <span className="time">{chatTimeLabel(message.sentAt)}</span>}
      </div>
    </div>
  )
}

export function ChatMessageItem(props: MessageItemProps) {
  return props.message.mediaPath !== null || props.message.localUri ? <PhotoMessage {...props} /> : <TextMessage {...props} />
}

// ---------------------------------------------------------------------------
// 입력창 · 첨부 시트(F04) · 복사 메뉴
// ---------------------------------------------------------------------------

export function Composer({ onSend, onAttach, keyboardOpen }: { onSend: (body: string) => void; onAttach: () => void; keyboardOpen: boolean }) {
  const { hasText, inputProps, sendButtonProps } = useChatComposer(onSend)
  return (
    <div className={`composer ${keyboardOpen ? 'kbOpen' : ''}`} data-testid="chat-composer">
      <div className="composerPill">
        <button type="button" className="attachBtn press" aria-label={COMPOSER_COPY.attach} data-testid="chat-attach" onClick={onAttach}>+</button>
        <input className="composerInput" placeholder={COMPOSER_COPY.placeholder} aria-label={COMPOSER_COPY.placeholder} data-testid="chat-input" {...inputProps} />
        <button type="button" className={`sendBtn press ${hasText ? 'on' : ''}`} aria-label={COMPOSER_COPY.send} aria-disabled={!hasText} data-testid="chat-send" {...sendButtonProps}>↑</button>
      </div>
    </div>
  )
}

function CopyMenuBody({ onCopy }: { onCopy: () => void }) {
  const close = useSheetClose()
  return (
    <div className="attachBody" data-testid="chat-copy-menu-body">
      <button type="button" className="attachOption press" data-testid="chat-copy" onClick={() => { close(); onCopy() }}>{CHAT_COPY.copy}</button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 화면
// ---------------------------------------------------------------------------

type ChatRow =
  | { key: string; type: 'divider'; label: string }
  | { key: string; type: 'message'; message: ChatMessage }

export interface ChatConversationProps {
  bridge: NativeBridge
  /** 시험이 큐 허브를 바꿔 끼운다. */
  hubs?: ChatHubs
  now?: () => Date
}

export function ChatConversation({ bridge, hubs, now = () => new Date() }: ChatConversationProps) {
  const currentUserId = useAuthStore((s) => s.userId)
  const coupleId = useCoupleStore((s) => s.coupleId)
  const partnerId = useCoupleStore((s) => s.partnerId)
  const startDate = useCoupleStore((s) => s.relationshipStartDate)
  const selfName = usePartnerName(currentUserId)
  const partnerName = usePartnerName(partnerId)
  const keyboardOpen = useKeyboardOpen()

  const [attachOpen, setAttachOpen] = useState(false)
  const [copyText, setCopyText] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const [storyView, setStoryView] = useState<StoryViewPayload | null>(null)
  const [photoView, setPhotoView] = useState<{ path: string; senderName: string; sentAt: string } | null>(null)

  const chat = useChatMessages(coupleId, currentUserId, hubs)
  const { messages, loading, stories } = chat

  const partnerLabel = partnerName ?? '상대'
  const selfLabel = selfName ?? '나'
  const days = startDate ? computeDaysTogetherKst(startDate, now()) : null

  // 사진 주소: 서버에 올라간 사진 메시지 + 스토리 사진은 서명 URL, 올리는 중인 사진은 복사본 미리보기.
  const messagePaths = useMemo(() => messages.map((m) => m.mediaPath).filter((p): p is string => p !== null), [messages])
  const storyPaths = useMemo(() => stories.map((s) => s.media_path), [stories])
  const messageUrls = useSignedMedia('messages', messagePaths)
  const storyUrls = useSignedMedia('stories', storyPaths)
  const previews = useQueuedPreviews(messages)

  // 스토리 줄: 사람별로 가장 최근 사진 하나(상대 먼저, 내 것 다음 - 보드 순서).
  const people: StoryPerson[] = useMemo(() => {
    const build = (authorId: string | null, isMine: boolean, label: string): StoryPerson | null => {
      if (authorId === null) return null
      const list = stories.filter((s) => s.author_id === authorId).sort((a, b) => a.created_at.localeCompare(b.created_at))
      if (list.length === 0) return null
      const items: StoryViewItem[] = list.map((s) => ({ id: s.id, path: s.media_path, createdAt: s.created_at }))
      return {
        key: isMine ? 'mine' : 'partner',
        label: isMine ? CHAT_COPY.myStory : label,
        isMine,
        thumbUri: storyUrls[list[list.length - 1].media_path],
        onPress: () => setStoryView({ authorName: isMine ? selfLabel : label, isMine, items }),
      }
    }
    return [build(partnerId, false, partnerLabel), build(currentUserId, true, selfLabel)].filter((p): p is StoryPerson => p !== null)
  }, [stories, storyUrls, partnerId, currentUserId, partnerLabel, selfLabel])

  const rows: ChatRow[] = useMemo(() => {
    const year = now().getFullYear()
    return groupMessagesByDate(messages).flatMap((group) => [
      { key: `divider:${group.dateKey}`, type: 'divider' as const, label: chatDateLabel(group.dateKey, year) },
      // 서버가 확정해 id가 바뀌어도 같은 말풍선이도록 `clientMsgId`가 있으면 그것으로 키를 잡는다(등장 연출을 다시 하지 않는다).
      ...group.messages.map((message) => ({ key: `message:${message.clientMsgId ?? message.id}`, type: 'message' as const, message })),
    ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  // 등장 연출: 처음 불러온 말풍선에는 없고, 그 뒤에 새로 들어온 말풍선에만 붙는다(한 번 정해지면 그대로).
  const freshByKey = useRef(new Map<string, boolean>())
  const loaded = useRef(false)
  for (const row of rows) if (row.type === 'message' && !freshByKey.current.has(row.key)) freshByKey.current.set(row.key, loaded.current)
  useEffect(() => { if (!loading) loaded.current = true }, [loading])

  // 끝에 붙기: 처음엔 맨 아래, 새 말풍선은 내가 보낸 것이면 끝으로 · 상대 것은 붙어 있을 때만.
  const listRef = useRef<HTMLDivElement>(null)
  const { onScroll, jump, followAppend, userTouch } = useStickToEnd(listRef)
  const wasLoading = useRef(true)
  const rowCount = useRef(0)
  useLayoutEffect(() => {
    if (loading) return
    if (wasLoading.current) {
      wasLoading.current = false
      rowCount.current = rows.length
      jump()
      return
    }
    if (rows.length <= rowCount.current) { rowCount.current = rows.length; return }
    rowCount.current = rows.length
    const last = messages[messages.length - 1]
    followAppend(last?.senderId === currentUserId)
  }, [loading, rows.length, messages, currentUserId, jump, followAppend])

  const pickAndSendPhotos = async (capture: boolean) => {
    try {
      const picked = await pickPhotos(capture ? 1 : undefined, { capture })
      for (const photo of picked) await chat.sendPhoto(photo)
      releasePhotoUrls(picked)
    } catch {
      showToast('사진을 고르지 못했어요. 다시 시도해 주세요')
    }
  }

  /** 고르면 바로 올린다(R13-11 #6) - 한 장, 편집 화면 없음. */
  const pickAndPostStory = async () => {
    if (posting) return
    try {
      const picked = await pickPhotos(1)
      if (picked.length === 0) return
      setPosting(true)
      const ok = await chat.postStory(picked[0])
      releasePhotoUrls(picked)
      if (!ok) showToast('스토리를 올리지 못했어요. 연결을 확인하고 다시 시도해 주세요')
    } catch {
      showToast('사진을 고르지 못했어요. 다시 시도해 주세요')
    } finally {
      setPosting(false)
    }
  }

  const copyBubble = async () => {
    const text = copyText
    setCopyText(null)
    if (text === null) return
    try {
      await navigator.clipboard.writeText(text)
      showToast(CHAT_COPY.copied)
    } catch {
      showToast(CHAT_COPY.copyFailed)
    }
  }

  const viewerUrl = photoView ? (messageUrls[photoView.path] ?? previews[photoView.path]) : undefined
  const savePhoto = async () => {
    if (!viewerUrl) return
    const r = await saveChatPhoto(bridge, viewerUrl)
    const notice = saveNotice(r, '사진을 저장했어요', '사진을 저장하지 못했어요. 다시 시도해 주세요')
    if (notice) showToast(notice)
  }
  const sharePhoto = async () => {
    if (!viewerUrl) return
    const r = await shareChatPhoto(bridge, viewerUrl)
    if (r === 'failed') showToast('사진을 공유하지 못했어요. 다시 시도해 주세요')
  }

  return (
    <div className={`chatConversation ${keyboardOpen ? 'kbOpen' : ''}`} data-testid="chat-conversation">
      <ChatHeader name={partnerLabel} days={days} />
      <StoryStrip people={people} onAdd={pickAndPostStory} posting={posting} />
      {chat.hasQueued ? <OfflineBanner /> : null}

      <div className="chatList" ref={listRef} onScroll={onScroll} onTouchStart={userTouch} onWheel={userTouch} data-testid="chat-list">
        {loading ? (
          <div className="chatSkeletons" data-testid="chat-loading">
            <Skeleton width="48%" height={44} radius={20} />
            <Skeleton width="56%" height={44} radius={20} style={{ alignSelf: 'flex-end' }} />
            <Skeleton width="40%" height={44} radius={20} />
          </div>
        ) : messages.length === 0 ? (
          <p className="chatEmpty" data-testid="chat-empty">{MESSAGE_COPY.empty}</p>
        ) : (
          rows.map((row) => {
            if (row.type === 'divider') return <DateDivider key={row.key} label={row.label} />
            const m = row.message
            const mine = m.senderId === currentUserId
            const path = m.mediaPath
            return (
              <ChatMessageItem
                key={row.key}
                message={m}
                isMine={mine}
                senderName={mine ? selfLabel : partnerLabel}
                photoUri={path ? messageUrls[path] : m.localUri ? previews[m.localUri] : undefined}
                fresh={freshByKey.current.get(row.key) === true}
                onRetry={chat.retryFailed}
                onCancel={chat.cancelPending}
                onCopy={setCopyText}
                onOpenPhoto={(msg) => {
                  if (!msg.mediaPath) return
                  setPhotoView({ path: msg.mediaPath, senderName: msg.senderId === currentUserId ? selfLabel : partnerLabel, sentAt: msg.sentAt })
                }}
              />
            )
          })
        )}
      </div>

      <Composer onSend={(body) => { if (canSendBody(body)) void chat.sendText(body) }} onAttach={() => setAttachOpen(true)} keyboardOpen={keyboardOpen} />

      {attachOpen ? (
        <PhotoSourceSheet testId="chat-attach-sheet" onAlbum={() => void pickAndSendPhotos(false)} onCamera={() => void pickAndSendPhotos(true)} onClosed={() => setAttachOpen(false)} />
      ) : null}
      {copyText !== null ? (
        <PhoneLayer>
          <Sheet variant="auto" testId="chat-copy-menu" onClosed={() => setCopyText(null)}>
            <CopyMenuBody onCopy={() => void copyBubble()} />
          </Sheet>
        </PhoneLayer>
      ) : null}
      {storyView ? <StoryViewer story={storyView} onClose={() => setStoryView(null)} /> : null}
      {photoView ? (
        <PhoneLayer>
          <PhotoViewer
            photos={[{ id: photoView.path, url: viewerUrl, label: `${photoView.senderName}이 보낸 사진` }]}
            heading={<><span className="vName" data-testid="photo-sender">{photoView.senderName}</span><span className="vStamp">{photoStampLabel(photoView.sentAt)}</span></>}
            footer={
              <>
                <button type="button" className="viewerAction press" data-testid="photo-save" disabled={!viewerUrl} onClick={() => void savePhoto()}>저장</button>
                <button type="button" className="viewerAction press" data-testid="photo-share" disabled={!viewerUrl} onClick={() => void sharePhoto()}>공유</button>
              </>
            }
            onClose={() => setPhotoView(null)}
          />
        </PhoneLayer>
      ) : null}
    </div>
  )
}

/** F02: 미연결이면 "채팅" 머리 + 화면 안 안내 카드(시트 0). */
export function ChatDisconnected() {
  return (
    <div className="chatDisconnected" data-testid="chat-disconnected">
      <h1 className="chatBackdropTitle">채팅</h1>
      <CoupleNeeded copy={CHAT_DISCONNECTED_COPY} />
    </div>
  )
}

export function ChatScreen({ bridge, hubs }: { bridge: NativeBridge; hubs?: ChatHubs }) {
  return (
    <CoupleGate fallback={<ChatDisconnected />}>
      <ChatConversation bridge={bridge} hubs={hubs} />
    </CoupleGate>
  )
}
