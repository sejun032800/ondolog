/**
 * H14 연결 해제 - 7일 유예 중 화면 본문. 디자인 `N-S-H3-Settings`(H14). 개시자와 상대가 같은 본문을 보고,
 * [해제 취소하기]는 화면(`settings-couple`)이 개시자에게만 아래에 붙인다(`canCancelDissolution`).
 *
 * 남은 날짜는 서버의 `purge_scheduled_at`에서 센다(`graceDaysLeft`, KST) - 앱이 7일을 더하지 않는다. 숫자는 바로 보이고 세는 모션이 없다.
 * 보드의 "밤 12시"는 서버 값(요청 시각 + 7일)과 맞지 않아 쓰지 않고 날짜만 보인다(보고).
 * 상대 쪽 화면은 보드가 없어 개시자 화면에서 [취소]를 뺀 형태에 문장만 상대 시점으로 바꿨다(보고).
 */
import { StyleSheet, Text, View } from 'react-native'
import { GlassCard, SoftCard } from '../nocturne/GlassCard'
import { ListGroup, ListRow } from '../nocturne/ListGroup'
import { nocturne, type } from '../../theme/nocturne'
import { graceDateLabel, graceDaysLeft, type DissolutionState } from '../../utils/dissolution'

export const GRACE_COPY = {
  kicker: 'DISCONNECTING',
  noNewIssue: '해제 예정 기간에는 새 호를 만들지 않아요',
  keepIssues: '발행된 잡지는 한쪽이 남아 있으면 보존돼요',
  pdf: '발행된 호 PDF로 받아두기',
  cancel: '해제 취소하기',
} as const

export function graceBullets(state: DissolutionState, partnerName: string | null): string[] {
  const name = partnerName ?? '상대'
  if (state.initiatedByMe) {
    return [
      `${name}에게 해제 요청을 알렸어요`,
      GRACE_COPY.noNewIssue,
      `해제되면 내가 남긴 사진·글·대화가 지워지고, ${name}의 기록은 남아요`,
      GRACE_COPY.keepIssues,
    ]
  }
  return [
    state.reason === 'withdrawal' ? `${name}님이 탈퇴를 요청했어요` : `${name}님이 연결 해제를 요청했어요`,
    GRACE_COPY.noNewIssue,
    `해제되면 ${name}님이 남긴 사진·글·대화가 지워지고, 내 기록은 남아요`,
    GRACE_COPY.keepIssues,
  ]
}

export interface DissolutionGraceBodyProps {
  state: DissolutionState
  partnerName: string | null
  onOpenPdf: () => void
  now?: Date
}

export function DissolutionGraceBody({ state, partnerName, onOpenPdf, now }: DissolutionGraceBodyProps) {
  const days = graceDaysLeft(state.purgeScheduledAt, now)
  return (
    <>
      <GlassCard style={styles.card}>
        <Text style={styles.kicker}>{GRACE_COPY.kicker}</Text>
        <Text style={styles.days} testID="grace-days">
          {days > 0 ? `${days}일` : '오늘'}
        </Text>
        <Text style={styles.date} testID="grace-date">
          {`${graceDateLabel(state.purgeScheduledAt)}에 연결이 해제돼요`}
        </Text>
      </GlassCard>

      <SoftCard style={styles.bullets}>
        {graceBullets(state, partnerName).map((line) => (
          <View key={line} style={styles.bulletRow}>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.bulletText}>{line}</Text>
          </View>
        ))}
      </SoftCard>

      <ListGroup>
        <ListRow label={GRACE_COPY.pdf} onPress={onOpenPdf} testID="grace-pdf-row" />
      </ListGroup>
    </>
  )
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: 8, paddingVertical: 32 },
  kicker: { ...type.kicker, color: nocturne.textMute },
  days: { fontFamily: type.hero.fontFamily, fontSize: 56, lineHeight: 64, letterSpacing: -2, color: nocturne.text },
  date: { ...type.body, color: nocturne.textSub },
  bullets: { gap: 12 },
  bulletRow: { flexDirection: 'row', gap: 12 },
  dot: { ...type.body, color: nocturne.textMute },
  bulletText: { ...type.body, flex: 1, color: nocturne.textSub },
})
