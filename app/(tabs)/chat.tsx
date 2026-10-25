/**
 * 채팅 탭 (F01 채팅 · F02 미연결 진입 · F04 첨부 · F05 보내는 중) - 디자인 `N-T-Tabs` F01, `N-S-F-Chat` F02~F06.
 * MASTER 9-3 / 11-2 "채팅 | 미연결 시: 진입 즉시 초대 모달".
 *
 * - 실시간·오프라인 큐·읽음·스토리의 동작은 `useRealtimeMessages`가 그대로 맡는다. 이 화면은 그 결과를 그리기만 한다.
 * - 게이팅은 `<CoupleGate autoOpenInvite>`: 미연결이면 진입 즉시 초대 시트(F02)가 뜨고, 뒤에는 "채팅" 머리만 비친다.
 * - 원문은 Pretendard 그대로다(MaruBuri는 인용에만). 읽음 = 숫자 1, 보내는 중·다시 보내기는 정지 표시(스피너 없음).
 * - 이 화면에는 공유 카드·잡지에 실린다는 예고·권유 문구를 두지 않는다(MASTER 9-5 r66, R24-2).
 * - 스토리·사진 크게 보기는 시트(`(modals)/story-viewer`·`photo-viewer`, ✕로 닫는다).
 */
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, FlatList, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AttachSheet, Composer, OfflineBanner } from '../../src/components/chat/Composer'
import { ChatMessageItem, DateDivider, MESSAGE_COPY } from '../../src/components/chat/Messages'
import { ChatHeader, StoryRow, type StoryPerson } from '../../src/components/chat/ChatTop'
import { CoupleGate } from '../../src/components/CoupleGate'
import { ScreenFrame } from '../../src/components/nocturne/ScreenFrame'
import { Skeleton } from '../../src/components/nocturne/Skeleton'
import { useRealtimeMessages } from '../../src/hooks/useRealtimeMessages'
import { useSession } from '../../src/hooks/useSession'
import { useSignedMedia } from '../../src/hooks/useSignedMedia'
import { fetchProfile } from '../../src/services/personalityApi'
import { pickPhotos } from '../../src/services/photoPicker'
import { useChatViewerStore, type StoryViewItem } from '../../src/store/chatViewerStore'
import { useCoupleStore } from '../../src/store/coupleStore'
import { fontFamily, nocturne, shape } from '../../src/theme/nocturne'
import { chatDateLabel, groupMessagesByDate, type ChatMessage } from '../../src/utils/chatMessages'
import { computeDaysTogetherKst } from '../../src/utils/relationshipDays'

type ChatRow =
  | { key: string; type: 'divider'; label: string }
  | { key: string; type: 'message'; message: ChatMessage }

export default function ChatTab() {
  const { session } = useSession()
  const refresh = useCoupleStore((s) => s.refresh)

  useEffect(() => {
    if (session) refresh(session.user.id)
  }, [session, refresh])

  return (
    <ScreenFrame>
      <CoupleGate autoOpenInvite inviteFrom="chat" fallback={<DisconnectedBackdrop />}>
        <ChatConversation />
      </CoupleGate>
    </ScreenFrame>
  )
}

/** F02 뒤에 비치는 면: "채팅" 머리만. */
function DisconnectedBackdrop() {
  const insets = useSafeAreaInsets()
  return (
    <View style={{ paddingTop: insets.top + 16, paddingHorizontal: shape.space.screen }} testID="chat-disconnected">
      <Text style={styles.backdropTitle}>채팅</Text>
    </View>
  )
}

function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const show = Keyboard.addListener(showEvent, () => setVisible(true))
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])
  return visible
}

function ChatConversation() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { session } = useSession()
  const coupleId = useCoupleStore((s) => s.coupleId)
  const partnerId = useCoupleStore((s) => s.partnerId)
  const startDate = useCoupleStore((s) => s.relationshipStartDate)
  const currentUserId = session?.user.id ?? null

  const [selfName, setSelfName] = useState<string | null>(null)
  const [partnerName, setPartnerName] = useState<string | null>(null)
  const [attachOpen, setAttachOpen] = useState(false)
  const [posting, setPosting] = useState(false)
  const keyboardVisible = useKeyboardVisible()

  const { messages, loading, sendText, sendPhoto, retryFailed, cancelPending, hasQueued, stories, postStory } =
    useRealtimeMessages(coupleId, currentUserId)
  const openStory = useChatViewerStore((s) => s.openStory)
  const openPhoto = useChatViewerStore((s) => s.openPhoto)
  const listRef = useRef<FlatList<ChatRow>>(null)

  useEffect(() => {
    if (!currentUserId) return
    let cancelled = false
    fetchProfile(currentUserId).then((p) => {
      if (!cancelled) setSelfName(p?.display_name ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [currentUserId])

  useEffect(() => {
    if (!partnerId) return
    let cancelled = false
    fetchProfile(partnerId).then((p) => {
      if (!cancelled) setPartnerName(p?.display_name ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [partnerId])

  const partnerLabel = partnerName ?? '상대'
  const selfLabel = selfName ?? '나'
  const days = startDate ? computeDaysTogetherKst(startDate) : null

  // 사진 서명 URL: 서버에 올라간 사진 메시지 + 스토리 사진.
  const messagePaths = useMemo(
    () => messages.map((m) => m.mediaPath).filter((p): p is string => p !== null),
    [messages],
  )
  const storyPaths = useMemo(() => stories.map((s) => s.media_path), [stories])
  const messageUrls = useSignedMedia('messages', messagePaths)
  const storyUrls = useSignedMedia('stories', storyPaths)

  // 스토리 줄: 사람별로 가장 최근 사진 하나(상대 먼저, 내 것 다음 - 보드 순서).
  const people: StoryPerson[] = useMemo(() => {
    const byAuthor = (authorId: string | null) =>
      authorId === null ? [] : stories.filter((s) => s.author_id === authorId).sort((a, b) => a.created_at.localeCompare(b.created_at))
    const build = (authorId: string | null, isMine: boolean, label: string): StoryPerson | null => {
      const list = byAuthor(authorId)
      if (list.length === 0) return null
      const items: StoryViewItem[] = list.map((s) => ({ id: s.id, path: s.media_path, createdAt: s.created_at }))
      return {
        key: isMine ? 'mine' : 'partner',
        label: isMine ? '나' : label,
        isMine,
        thumbUri: storyUrls[list[list.length - 1].media_path],
        onPress: () => {
          openStory({ authorName: isMine ? selfLabel : label, isMine, items })
          router.push('/story-viewer')
        },
      }
    }
    return [build(partnerId, false, partnerLabel), build(currentUserId, true, selfLabel)].filter(
      (p): p is StoryPerson => p !== null,
    )
  }, [stories, storyUrls, partnerId, currentUserId, partnerLabel, selfLabel, openStory, router])

  const rows: ChatRow[] = useMemo(() => {
    const year = new Date().getFullYear()
    return groupMessagesByDate(messages).flatMap((group) => [
      { key: `divider:${group.dateKey}`, type: 'divider' as const, label: chatDateLabel(group.dateKey, year) },
      ...group.messages.map((message) => ({ key: `message:${message.id}`, type: 'message' as const, message })),
    ])
  }, [messages])

  const pickAndSendPhotos = async () => {
    setAttachOpen(false)
    try {
      const picked = await pickPhotos()
      for (const photo of picked) await sendPhoto(photo)
    } catch {
      Alert.alert('사진을 고르지 못했어요', '다시 시도해 주세요')
    }
  }

  /** 고르면 바로 올린다(R13-11 #6) - 한 장, 편집 화면 없음. */
  const pickAndPostStory = async () => {
    if (posting) return
    try {
      const picked = await pickPhotos(1)
      if (picked.length === 0) return
      setPosting(true)
      const ok = await postStory(picked[0])
      if (!ok) Alert.alert('스토리를 올리지 못했어요', '연결을 확인하고 다시 시도해 주세요')
    } catch {
      Alert.alert('사진을 고르지 못했어요', '다시 시도해 주세요')
    } finally {
      setPosting(false)
    }
  }

  const composerBottom = keyboardVisible ? 12 : insets.bottom + shape.tabBarGap + shape.tabBarHeight + 14

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
      <View style={[styles.fill, { paddingTop: insets.top + 16 }]}>
        <ChatHeader name={partnerLabel} days={days} />
        <StoryRow people={people} onAdd={pickAndPostStory} posting={posting} />
        {hasQueued ? <OfflineBanner /> : null}

        {loading ? (
          <View style={styles.skeletons} testID="chat-loading">
            <Skeleton width="48%" height={44} />
            <Skeleton width="56%" height={44} style={styles.skeletonMine} />
            <Skeleton width="40%" height={44} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{MESSAGE_COPY.empty}</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={rows}
            keyExtractor={(row) => row.key}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) =>
              item.type === 'divider' ? (
                <DateDivider label={item.label} />
              ) : (
                <ChatMessageItem
                  message={item.message}
                  isMine={item.message.senderId === currentUserId}
                  senderName={item.message.senderId === currentUserId ? selfLabel : partnerLabel}
                  photoUri={item.message.mediaPath ? messageUrls[item.message.mediaPath] : undefined}
                  onRetry={retryFailed}
                  onCancel={cancelPending}
                  onOpenPhoto={(m) => {
                    if (!m.mediaPath) return
                    openPhoto({
                      path: m.mediaPath,
                      senderName: m.senderId === currentUserId ? selfLabel : partnerLabel,
                      sentAt: m.sentAt,
                    })
                    router.push('/photo-viewer')
                  }}
                />
              )
            }
          />
        )}

        <Composer onSend={(body) => void sendText(body)} onAttach={() => setAttachOpen(true)} bottomOffset={composerBottom} />
      </View>
      {attachOpen ? <AttachSheet onAlbum={pickAndSendPhotos} onClose={() => setAttachOpen(false)} /> : null}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdropTitle: { fontFamily: fontFamily.semiBold, fontSize: 24, lineHeight: 30, letterSpacing: -0.48, color: nocturne.textMute },
  listContent: { gap: 8, paddingTop: 14, paddingBottom: 12 },
  skeletons: { flex: 1, gap: 10, padding: 20 },
  skeletonMine: { alignSelf: 'flex-end' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 24, color: nocturne.textMute },
})
