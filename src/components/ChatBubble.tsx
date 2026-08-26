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
 */
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useTheme } from '../theme'
import type { ChatMessage } from '../utils/chatMessages'

const MAX_WIDTH_RATIO = 0.76

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
}

export function ChatBubble({ message, isMine }: ChatBubbleProps) {
  const { colors, typography, spacing, radius } = useTheme()
  const { width } = useWindowDimensions()

  return (
    <View style={[styles.row, { justifyContent: isMine ? 'flex-end' : 'flex-start' }]}>
      <View
        style={{
          alignItems: isMine ? 'flex-end' : 'flex-start',
          gap: spacing.s1,
          maxWidth: width * MAX_WIDTH_RATIO,
        }}
      >
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isMine ? colors.inkFull : colors.paperAlt,
              borderColor: isMine ? 'transparent' : colors.rule,
              borderRadius: radius.touch,
              borderWidth: isMine ? 0 : 1,
              paddingHorizontal: spacing.s3,
              paddingVertical: spacing.s2,
            },
          ]}
        >
          <Text style={[typography.body, { color: isMine ? colors.paper : colors.inkFull }]}>
            {message.body}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.s2 }}>
          {isMine && message.readAt ? (
            <Text style={[typography.caption, { color: colors.inkFaint }]}>읽음</Text>
          ) : null}
          <Text style={[typography.caption, { color: colors.inkFaint }]}>
            {message.pending ? '전송 중…' : formatTime(message.sentAt)}
          </Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bubble: {},
  row: { flexDirection: 'row', width: '100%' },
})
