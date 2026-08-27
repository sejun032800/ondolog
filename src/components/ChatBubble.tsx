/**
 * 채팅 말풍선 — docs/ONDOLOG_DESIGN.md §13-3.
 *
 *   말풍선   radius-touch(2), 둥글게 하지 않는다
 *   내 메시지  ink-full 배경 / paper 글자, 우측
 *   상대 메시지 paper-alt 배경 / ink-full 글자, 좌측, rule 테두리 1px
 *   최대 폭   화면의 76%
 *   시각     caption, ink-faint, 말풍선 밖
 *
 * 읽음 표시(완료 기준 3, 시각 규격은 문서에 명시 없어 caption 톤으로
 * 통일한 자체 판단)는 내 메시지의 read_at이 채워졌을 때만 시각 옆에
 * "읽음" 캡션을 덧붙인다.
 *
 * 전송 상태(§13-3 "전송 상태" 표, 작업 지시 "4. 표시 규격"):
 *   전송 중  opacity 0.5 / "전송 중…"
 *   전송 실패 opacity 0.5 / "전송 실패 · 다시 시도"(탭 가능, hitSlop 44,
 *            ink-mute — 에러색 금지, 스피너·아이콘 금지)
 *   전송 완료 정상 / 시각
 * 말풍선을 길게 누르면(아직 큐에 있는, 즉 pending/failed 메시지에 한해)
 * 전송을 취소한다 — "3. 사용자 조작".
 */
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useTheme } from '../theme'
import type { ChatMessage } from '../utils/chatMessages'

const MAX_WIDTH_RATIO = 0.76
/** §14 "최소 터치 영역 44×44" — 캡션 텍스트 자체는 그보다 작아 hitSlop으로 보강한다. */
const RETRY_CAPTION_HIT_SLOP = 16

function formatTime(iso: string): string {
  const d = new Date(iso)
  const hours = d.getHours()
  const minutes = d.getMinutes()
  const period = hours < 12 ? '오전' : '오후'
  const displayHour = hours % 12 === 0 ? 12 : hours % 12
  return `${period} ${displayHour}:${minutes.toString().padStart(2, '0')}`
}

interface ChatBubbleProps {
  message: ChatMessage
  isMine: boolean
  /** 전송 실패 캡션("다시 시도") 탭 핸들러. */
  onRetry?: (clientMsgId: string) => void
  /** 아직 큐에 있는(pending/failed) 말풍선을 길게 눌렀을 때 — 전송 취소. */
  onCancel?: (clientMsgId: string) => void
}

export function ChatBubble({ message, isMine, onRetry, onCancel }: ChatBubbleProps) {
  const { colors, typography, spacing, radius } = useTheme()
  const { width } = useWindowDimensions()

  const isQueued = Boolean(message.pending || message.failed)

  return (
    <View style={[styles.row, { justifyContent: isMine ? 'flex-end' : 'flex-start' }]}>
      <View
        style={{
          alignItems: isMine ? 'flex-end' : 'flex-start',
          gap: spacing.s1,
          maxWidth: width * MAX_WIDTH_RATIO,
        }}
      >
        <Pressable
          disabled={!isQueued}
          onLongPress={
            isQueued && message.clientMsgId ? () => onCancel?.(message.clientMsgId!) : undefined
          }
        >
          <View
            style={[
              styles.bubble,
              {
                backgroundColor: isMine ? colors.inkFull : colors.paperAlt,
                borderColor: isMine ? 'transparent' : colors.rule,
                borderRadius: radius.touch,
                borderWidth: isMine ? 0 : 1,
                opacity: isQueued ? 0.5 : 1,
                paddingHorizontal: spacing.s3,
                paddingVertical: spacing.s2,
              },
            ]}
          >
            <Text style={[typography.body, { color: isMine ? colors.paper : colors.inkFull }]}>
              {message.body}
            </Text>
          </View>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: spacing.s2 }}>
          {isMine && message.readAt ? (
            <Text style={[typography.caption, { color: colors.inkFaint }]}>읽음</Text>
          ) : null}
          {message.failed ? (
            <Pressable
              hitSlop={RETRY_CAPTION_HIT_SLOP}
              onPress={() => message.clientMsgId && onRetry?.(message.clientMsgId)}
            >
              <Text style={[typography.caption, { color: colors.inkMute }]}>
                전송 실패 · 다시 시도
              </Text>
            </Pressable>
          ) : (
            <Text style={[typography.caption, { color: colors.inkFaint }]}>
              {message.pending ? '전송 중…' : formatTime(message.sentAt)}
            </Text>
          )}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bubble: {},
  row: { flexDirection: 'row', width: '100%' },
})
