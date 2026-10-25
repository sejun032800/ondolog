/**
 * 채팅 말풍선 · 사진 메시지 · 날짜 구분 - 디자인 `N-T-Tabs` F01, `N-S-F-Chat` F05, Components(CHAT).
 *
 * - 원문은 Pretendard 그대로다. MaruBuri는 "인용"에만 쓰고 채팅 자체는 인용이 아니다.
 * - 내 말풍선 = `text` 면 + `ink` 글자(오른쪽, 아래 오른쪽 모서리 6), 상대 = `inkRaise2` 면 + `text` 글자(왼쪽, 아래 왼쪽 모서리 6).
 * - 읽음 표시는 숫자 1: 내 메시지를 상대가 아직 읽지 않았을 때만 시각 위에 rose로 붙고, 읽으면 사라진다.
 * - 보내는 중(F05): 말풍선 .55 + 글자 "보내는 중" - **정지 표시, 스피너 없음**.
 *   실패: 말풍선 .55 + 테두리만 있는 "다시 보내기"(rose). 길게 누르면 보내기 취소(기존 동작).
 * - 사진 메시지는 화면 끝까지 붙는다(좌우 여백 없음). 그 아래 "보낸 사람 · 시각" 한 줄. 누르면 크게 보기(F06).
 */
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { fontFamily, nocturne, shape, withAlpha } from '../../theme/nocturne'
import { chatTimeLabel, type ChatMessage } from '../../utils/chatMessages'
import { PressScale } from '../nocturne/PressScale'

export const MESSAGE_COPY = {
  sending: '보내는 중',
  retry: '다시 보내기',
  empty: '첫 마디를 남겨보세요',
  offline: '연결이 끊겼어요. 다시 연결되면 이어서 보내요',
} as const

const BUBBLE_MAX_WIDTH = 236
const PHOTO_HEIGHT = 220
const QUEUED_OPACITY = 0.55

export function DateDivider({ label }: { label: string }) {
  return (
    <View style={styles.divider} testID="chat-date-divider">
      <View style={styles.dividerLine} />
      <Text style={styles.dividerLabel}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
  )
}

export interface MessageItemProps {
  message: ChatMessage
  isMine: boolean
  /** 보낸 사람 이름(사진 아래 줄). */
  senderName: string
  /** 사진 메시지의 서명 URL(서버에 올라간 사진). */
  photoUri: string | undefined
  onRetry: (clientMsgId: string) => void
  onCancel: (clientMsgId: string) => void
  onOpenPhoto: (message: ChatMessage) => void
}

/** 시각 칸: 상태에 따라 "보내는 중" · "다시 보내기" · (읽음 1 +) 시각. */
function Meta({ message, isMine, onRetry }: Pick<MessageItemProps, 'message' | 'isMine' | 'onRetry'>) {
  if (message.failed) {
    return (
      <Pressable
        onPress={() => message.clientMsgId && onRetry(message.clientMsgId)}
        accessibilityRole="button"
        accessibilityLabel={MESSAGE_COPY.retry}
        hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
        style={styles.retry}
        testID="chat-retry"
      >
        <Text style={styles.retryLabel}>{MESSAGE_COPY.retry}</Text>
      </Pressable>
    )
  }
  if (message.pending) {
    return (
      <Text style={[styles.time, styles.right]} testID="chat-sending">
        {MESSAGE_COPY.sending}
      </Text>
    )
  }
  const unread = isMine && message.readAt === null
  return (
    <Text style={[styles.time, isMine ? styles.right : null]} testID="chat-time">
      {unread ? (
        <>
          <Text style={styles.unread} testID="chat-unread">
            1
          </Text>
          {'\n'}
        </>
      ) : null}
      {chatTimeLabel(message.sentAt)}
    </Text>
  )
}

export function TextMessage({ message, isMine, onRetry, onCancel }: MessageItemProps) {
  const queued = Boolean(message.pending || message.failed)
  const bubble = (
    <View
      style={[
        styles.bubble,
        isMine ? styles.bubbleMine : styles.bubblePartner,
        queued ? { opacity: QUEUED_OPACITY } : null,
      ]}
    >
      <Text style={[styles.bubbleText, isMine ? styles.textMine : styles.textPartner]}>{message.body}</Text>
    </View>
  )
  return (
    <View style={[styles.row, isMine ? styles.rowMine : null, message.failed ? styles.rowCenter : null]} testID="chat-message">
      {isMine ? <Meta message={message} isMine={isMine} onRetry={onRetry} /> : null}
      {queued ? (
        <Pressable
          onLongPress={() => message.clientMsgId && onCancel(message.clientMsgId)}
          accessibilityHint="길게 누르면 보내기를 취소해요"
        >
          {bubble}
        </Pressable>
      ) : (
        bubble
      )}
      {isMine ? null : <Meta message={message} isMine={isMine} onRetry={onRetry} />}
    </View>
  )
}

export function PhotoMessage({ message, isMine, senderName, photoUri, onRetry, onCancel, onOpenPhoto }: MessageItemProps) {
  const queued = Boolean(message.pending || message.failed)
  const uri = message.localUri ?? photoUri
  const photo = (
    <View style={[styles.photo, queued ? { opacity: QUEUED_OPACITY } : null]}>
      {uri ? (
        <Image source={{ uri }} style={styles.photoImage} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : null}
    </View>
  )
  return (
    <View testID="chat-photo-message">
      {queued ? (
        <Pressable
          onLongPress={() => message.clientMsgId && onCancel(message.clientMsgId)}
          accessibilityHint="길게 누르면 보내기를 취소해요"
        >
          {photo}
        </Pressable>
      ) : (
        <PressScale
          onPress={() => onOpenPhoto(message)}
          accessibilityLabel={`${senderName}이 보낸 사진 크게 보기`}
          testID="chat-photo"
        >
          {photo}
        </PressScale>
      )}
      <View style={styles.photoCaption}>
        <Text style={styles.photoName} numberOfLines={1}>
          {senderName}
        </Text>
        {message.failed || message.pending ? (
          <Meta message={message} isMine={isMine} onRetry={onRetry} />
        ) : (
          <Text style={styles.photoTime}>{chatTimeLabel(message.sentAt)}</Text>
        )}
      </View>
    </View>
  )
}

export function ChatMessageItem(props: MessageItemProps) {
  return props.message.mediaPath !== null || props.message.localUri ? <PhotoMessage {...props} /> : <TextMessage {...props} />
}

const styles = StyleSheet.create({
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginVertical: 14 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: nocturne.hairline },
  dividerLabel: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: nocturne.textMute },

  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginHorizontal: 16 },
  rowMine: { justifyContent: 'flex-end' },
  rowCenter: { alignItems: 'center' },
  bubble: { maxWidth: BUBBLE_MAX_WIDTH, paddingVertical: 11, paddingHorizontal: 15, borderRadius: 20 },
  bubblePartner: { backgroundColor: nocturne.inkRaise2, borderBottomLeftRadius: 6 },
  bubbleMine: { backgroundColor: nocturne.text, borderBottomRightRadius: 6 },
  bubbleText: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22 },
  textPartner: { color: nocturne.text },
  textMine: { color: nocturne.ink },
  time: { fontFamily: fontFamily.regular, fontSize: 10.5, lineHeight: 14, color: nocturne.textMute },
  right: { textAlign: 'right' },
  unread: { fontFamily: fontFamily.semiBold, color: nocturne.rose },

  retry: {
    height: 28,
    paddingHorizontal: 11,
    borderRadius: shape.radius.pill,
    borderWidth: 1,
    borderColor: withAlpha(nocturne.rose, 0.45),
    justifyContent: 'center',
  },
  retryLabel: { fontFamily: fontFamily.semiBold, fontSize: 12, lineHeight: 16, color: nocturne.rose },

  photo: { height: PHOTO_HEIGHT, backgroundColor: nocturne.inkRaise2 },
  photoImage: { width: '100%', height: '100%' },
  photoCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 6,
  },
  photoName: { flexShrink: 1, fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: nocturne.textMute },
  photoTime: { fontFamily: fontFamily.regular, fontSize: 10.5, lineHeight: 14, color: nocturne.textMute },
})
