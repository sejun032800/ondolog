/**
 * 채팅 탭 — Part 11-2: "채팅 | 미연결 시: 진입 즉시 초대 모달".
 *
 * Phase 5(docs/ONDOLOG_ROADMAP.md §Phase 5) — Supabase Realtime 1:1
 * 채팅(텍스트) + 스토리(작성 UI + 목록) 구현. 실제 로직은
 * `src/hooks/useRealtimeMessages.ts`에 있고, 이 화면은 그 결과를
 * docs/ONDOLOG_DESIGN.md §13-3 말풍선 규격대로 그리기만 한다.
 *
 * 게이팅은 기존 그대로 `<CoupleGate autoOpenInvite>`(Phase 4 산출물,
 * 변경 없음) — 미연결이면 진입 즉시 초대 모달로 이동한다.
 *
 * 이번 범위가 아닌 것(건드리지 않았다):
 *   - 이미지 실제 업로드(자리표시자만, `StoryStrip`/`ChatBubble` 참조)
 *   - 스토리 만료/보관 배치(Edge Function, `013_batch_functions.sql`
 *     `expire_stories`가 담당)
 *   - warmth_score/sentiment AI 감정 태깅(Phase 7)
 */
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '../../src/components/Button'
import { ChatBubble } from '../../src/components/ChatBubble'
import { ChatDateDivider } from '../../src/components/ChatDateDivider'
import { CoupleGate } from '../../src/components/CoupleGate'
import { PageHeader } from '../../src/components/PageHeader'
import { StoryStrip, type StoryItem } from '../../src/components/StoryStrip'
import { useTheme } from '../../src/theme'
import { useRealtimeMessages } from '../../src/hooks/useRealtimeMessages'
import { useSession } from '../../src/hooks/useSession'
import { fetchProfile } from '../../src/services/personalityApi'
import { useCoupleStore } from '../../src/store/coupleStore'
import { groupMessagesByDate, type ChatMessage } from '../../src/utils/chatMessages'

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
    <ChatScreenShell>
      <CoupleGate autoOpenInvite>
        <ChatConversation />
      </CoupleGate>
    </ChatScreenShell>
  )
}

function ChatScreenShell({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme()
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.paper, flex: 1 }}>
      <PageHeader left="채 팅" />
      {children}
    </SafeAreaView>
  )
}

function ChatConversation() {
  const { session } = useSession()
  const coupleId = useCoupleStore((s) => s.coupleId)
  const partnerId = useCoupleStore((s) => s.partnerId)
  const currentUserId = session?.user.id ?? null

  const [selfName, setSelfName] = useState<string | null>(null)
  const [partnerName, setPartnerName] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [caption, setCaption] = useState('')
  const [inputText, setInputText] = useState('')

  const { messages, loading, sendText, retryFailed, cancelPending, stories, postStory } =
    useRealtimeMessages(coupleId, currentUserId)

  const { colors, typography, spacing, lines, radius } = useTheme()
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

  const storyItems: StoryItem[] = stories.map((s) => ({
    id: s.id,
    authorName: s.author_id === currentUserId ? selfName ?? '나' : partnerName ?? '상대',
    isMine: s.author_id === currentUserId,
  }))

  const rows: ChatRow[] = groupMessagesByDate(messages).flatMap((group) => [
    { key: `divider:${group.dateKey}`, type: 'divider' as const, label: group.label },
    ...group.messages.map((message) => ({
      key: `message:${message.id}`,
      type: 'message' as const,
      message,
    })),
  ])

  const handleSend = () => {
    const body = inputText
    if (!body.trim()) return
    setInputText('')
    sendText(body)
  }

  const handlePostStory = async () => {
    await postStory(caption.trim() || null)
    setCaption('')
    setComposerOpen(false)
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <View style={{ borderBottomColor: colors.rule, borderBottomWidth: lines.hairline }}>
        <StoryStrip stories={storyItems} onAddPress={() => setComposerOpen((v) => !v)} />
      </View>

      {composerOpen ? (
        <View
          style={{
            borderBottomColor: colors.rule,
            borderBottomWidth: lines.hairline,
            flexDirection: 'row',
            gap: spacing.s2,
            padding: spacing.s3,
          }}
        >
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="캡션(선택)"
            placeholderTextColor={colors.inkFaint}
            style={[
              typography.body,
              {
                backgroundColor: colors.paperAlt,
                borderColor: colors.rule,
                borderRadius: radius.touch,
                borderWidth: 1,
                color: colors.inkFull,
                flex: 1,
                paddingHorizontal: spacing.s3,
                paddingVertical: spacing.s2,
              },
            ]}
          />
          <Button label="게시" onPress={handlePostStory} />
        </View>
      ) : null}

      {loading ? (
        <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={colors.inkFull} />
        </View>
      ) : messages.length === 0 ? (
        <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.s5 }}>
          <Text style={[typography.body, { color: colors.inkMute }]}>첫 마디를 남겨보세요</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={(row) => row.key}
          contentContainerStyle={{ gap: spacing.s2, padding: spacing.s4 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) =>
            item.type === 'divider' ? (
              <ChatDateDivider label={item.label} />
            ) : (
              <ChatBubble
                message={item.message}
                isMine={item.message.senderId === currentUserId}
                onRetry={retryFailed}
                onCancel={cancelPending}
              />
            )
          }
        />
      )}

      <View
        style={{
          borderTopColor: colors.rule,
          borderTopWidth: lines.hairline,
          flexDirection: 'row',
          gap: spacing.s2,
          padding: spacing.s3,
        }}
      >
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="메시지 입력"
          placeholderTextColor={colors.inkFaint}
          multiline
          style={[
            typography.body,
            {
              backgroundColor: colors.paper,
              borderColor: colors.rule,
              borderRadius: radius.touch,
              borderWidth: 1,
              color: colors.inkFull,
              flex: 1,
              maxHeight: 120,
              paddingHorizontal: spacing.s3,
              paddingVertical: spacing.s2,
            },
          ]}
        />
        <Pressable onPress={handleSend} disabled={!inputText.trim()}>
          <View
            style={{
              alignItems: 'center',
              backgroundColor: colors.inkFull,
              borderRadius: radius.touch,
              justifyContent: 'center',
              opacity: inputText.trim() ? 1 : 0.4,
              paddingHorizontal: spacing.s4,
              paddingVertical: spacing.s3,
            }}
          >
            <Text style={[typography.title, { color: colors.paper }]}>전송</Text>
          </View>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}
