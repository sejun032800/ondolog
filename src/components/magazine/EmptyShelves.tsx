/**
 * D14 첫 호 시작 · D16 미연결 - 서재가 비었을 때의 두 화면(디자인 `N-S-D2-Magazine` D14, `N-S-D3-Magazine` D16).
 *
 * 둘 다 표지 실루엣(150 x 212, 빈 지면)을 가운데에 둔다. 그림자·아이콘 없이 빈 지면이다(MASTER 9-5).
 * D14의 "제작 현황 →" 링크는 숨긴다(D02는 U5). D16의 버튼은 커플 게이트(초대 모달)로 간다.
 */
import { StyleSheet, Text, View } from 'react-native'
import { FIRST_ISSUE_COPY, UNCONNECTED_COPY } from '../../constants/magazineCopy'
import { ink, nocturne, type, withAlpha } from '../../theme/nocturne'
import { PrimaryButton } from '../nocturne/Buttons'
import { ProgressRule } from '../nocturne/ProgressRule'

function Silhouette() {
  return <View style={styles.silhouette} testID="issue-silhouette" />
}

export interface FirstIssueProps {
  /** 기간 경과율(0~100). 초안이 없으면 0. */
  percent: number
}

export function FirstIssue({ percent }: FirstIssueProps) {
  return (
    <View style={styles.center} testID="first-issue">
      <Silhouette />
      <View style={styles.titleBlock}>
        <Text style={styles.kicker}>{FIRST_ISSUE_COPY.kicker}</Text>
        <Text style={styles.title}>{FIRST_ISSUE_COPY.title}</Text>
      </View>
      <ProgressRule progress={percent / 100} style={styles.rule} />
      <Text style={styles.percent} testID="first-issue-percent">{`${percent}%`}</Text>
    </View>
  )
}

/** D14 아래 선반 문구. */
export function ShelfHint() {
  return (
    <View style={styles.hint}>
      <View style={styles.shelf} />
      <Text style={styles.hintText}>{FIRST_ISSUE_COPY.shelfHint}</Text>
    </View>
  )
}

export interface UnconnectedProps {
  onInvite: () => void
}

export function Unconnected({ onInvite }: UnconnectedProps) {
  return (
    <View style={styles.unconnected} testID="unconnected-library">
      <View style={styles.center}>
        <Silhouette />
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{UNCONNECTED_COPY.title}</Text>
          <Text style={styles.body}>{UNCONNECTED_COPY.body}</Text>
        </View>
      </View>
      <PrimaryButton label={UNCONNECTED_COPY.invite} onPress={onInvite} testID="unconnected-invite" />
    </View>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 20 },
  silhouette: {
    width: 150,
    height: 212,
    borderRadius: 4,
    backgroundColor: nocturne.inkRaise2,
    borderWidth: 1,
    borderColor: withAlpha(nocturne.text, 0.1),
  },
  titleBlock: { alignItems: 'center', gap: 6 },
  kicker: { ...type.kicker, color: nocturne.textMute },
  title: { fontFamily: type.title.fontFamily, fontSize: 20, lineHeight: 28, color: nocturne.text, textAlign: 'center' },
  body: { ...type.sub, color: nocturne.textSub, textAlign: 'center' },
  rule: { width: 220 },
  percent: { ...ink('metric'), fontFamily: type.body.fontFamily, fontSize: 18, lineHeight: 24 },
  hint: { gap: 12 },
  shelf: { height: 1, backgroundColor: withAlpha(nocturne.text, 0.14) },
  hintText: { ...type.caption, fontFamily: type.body.fontFamily, color: nocturne.textMute, textAlign: 'center' },
  unconnected: { flex: 1, justifyContent: 'space-between', gap: 24 },
})
