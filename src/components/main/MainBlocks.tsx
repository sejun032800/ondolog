/**
 * 메인 번호 칸·카드들(디자인 `N-B-Main`).
 *
 * - FirstStep(B03 "02 FIRST STEP") · LoveTypeCard(B05 "02 MY LOVE TYPE")
 * - NewIssueCard(B06 "VOL.NN 꽂혔어요 [읽기]") · LastIssueCard("지난 호 다시 읽기")
 * - IssueProgressCard("NEXT ISSUE" / "FIRST ISSUE") - 진행률은 기간 경과율(R18-6), 정지 값. **"제작 현황 →"은 숨긴다**(D02는 U5).
 * "이번 주" 원문 인용 칸은 MVP에 없다(MVP 조정표).
 */
import { Image, StyleSheet, Text, View } from 'react-native'
import { FIRST_ISSUE_COPY, NEXT_ISSUE_COPY } from '../../constants/magazineCopy'
import { LOVE_TYPE_LABEL_BY_CODE } from '../../constants/loveTypeLabels'
import type { NextIssueData } from '../../hooks/useLibrary'
import type { LoveTypeSummary } from '../../hooks/useMainData'
import type { PublishedIssue } from '../../services/magazineApi'
import { fontFamily, ink, nocturne, shape, type, withAlpha } from '../../theme/nocturne'
import { issueMonthLabel } from '../../utils/magazine'
import { materialLines } from '../magazine/NextIssueCard'
import { PrimaryButton } from '../nocturne/Buttons'
import { formatVol } from '../nocturne/Chips'
import { GlassCard } from '../nocturne/GlassCard'
import { PressScale } from '../nocturne/PressScale'
import { ProgressRule } from '../nocturne/ProgressRule'
import { NumberedKicker } from './MainHero'

export const MAIN_COPY = {
  firstStepBody: '대화가 쌓이면 이 자리에\n두 사람의 온도가 떠요',
  firstStepLink: '채팅에서 첫 대화 남기기 →',
  loveTypeKicker: 'MY LOVE TYPE',
  invite: '연인 초대하기',
  lastIssue: '지난 호 다시 읽기',
  read: '읽기',
  newIssueFallbackTitle: '새 호가 꽂혔어요',
} as const

/** 새 호 카드 제목: "10월호가\n꽂혔어요". 호 이름을 못 읽으면 이름 없는 문구. */
export function newIssueTitle(month: string): string {
  return month ? `${month}가\n꽂혔어요` : MAIN_COPY.newIssueFallbackTitle
}

function monthOf(issue: PublishedIssue): string {
  return issueMonthLabel({ periodStart: issue.periodStart, issueType: issue.issueType, title: issue.title })
}

function Cover({ uri, width, height, glowing }: { uri: string | undefined; width: number; height: number; glowing?: boolean }) {
  return (
    <View
      style={[styles.cover, { width, height }, glowing ? styles.coverGlow : null]}
      testID="main-issue-cover"
    >
      {uri ? (
        <Image source={{ uri }} style={styles.coverImage} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : null}
    </View>
  )
}

// ---------------------------------------------------------------------------
// B03 02 FIRST STEP
// ---------------------------------------------------------------------------

export function FirstStepBlock({ number, onChat }: { number: string; onChat: () => void }) {
  return (
    <View style={styles.blockGap} testID="main-first-step">
      <NumberedKicker number={number} label="FIRST STEP" />
      <Text style={styles.firstStepBody}>{MAIN_COPY.firstStepBody}</Text>
      <PressScale onPress={onChat} accessibilityLabel="채팅에서 첫 대화 남기기" hitSlop={10} testID="main-first-step-link">
        <Text style={styles.link}>{MAIN_COPY.firstStepLink}</Text>
      </PressScale>
    </View>
  )
}

// ---------------------------------------------------------------------------
// B05 02 MY LOVE TYPE
// ---------------------------------------------------------------------------

export function LoveTypeCard({ number, summary }: { number: string; summary: LoveTypeSummary | null }) {
  const label = summary ? LOVE_TYPE_LABEL_BY_CODE[summary.loveTypeCode] : undefined
  return (
    <GlassCard style={styles.loveCard}>
      <View testID="main-love-type">
        <NumberedKicker number={number} label={MAIN_COPY.loveTypeKicker} />
        {summary ? (
          <View style={styles.loveBody}>
            <Text style={styles.loveEn}>{label?.labelEn ?? summary.loveTypeCode}</Text>
            <Text style={styles.loveKo}>{label?.labelKo ?? summary.loveTypeCode}</Text>
            {label?.copyKo ? <Text style={styles.loveCopy}>{label.copyKo}</Text> : null}
            <Text style={styles.loveMeta}>{`${summary.mbti} · 애니어그램 ${summary.enneagramCore}유형`}</Text>
          </View>
        ) : null}
      </View>
    </GlassCard>
  )
}

export function InviteButton({ onPress }: { onPress: () => void }) {
  return <PrimaryButton label={MAIN_COPY.invite} onPress={onPress} style={styles.pill} testID="main-invite" />
}

// ---------------------------------------------------------------------------
// B06 새 호 도착 · 지난 호 다시 읽기
// ---------------------------------------------------------------------------

export interface IssueCardProps {
  issue: PublishedIssue
  coverUri: string | undefined
  onOpen: () => void
}

/** B06: 표지 + "VOL.03" + "10월호가 꽂혔어요" + [읽기]. */
export function NewIssueCard({ issue, coverUri, onOpen }: IssueCardProps) {
  return (
    <GlassCard style={styles.newCard}>
      <View style={styles.newRow} testID="main-new-issue">
        <Cover uri={coverUri} width={84} height={116} glowing />
        <View style={styles.newText}>
          <Text style={styles.volBig}>{formatVol(issue.issueNumber)}</Text>
          <Text style={styles.newTitle}>{newIssueTitle(monthOf(issue))}</Text>
          <PrimaryButton label={MAIN_COPY.read} onPress={onOpen} style={styles.readButton} testID="main-new-issue-read" />
        </View>
      </View>
    </GlassCard>
  )
}

/** "VOL.02 · 9월호 / 지난 호 다시 읽기 →" 한 줄 카드. */
export function LastIssueCard({ issue, coverUri, onOpen }: IssueCardProps) {
  const month = monthOf(issue)
  return (
    <PressScale onPress={onOpen} accessibilityLabel={MAIN_COPY.lastIssue} testID="main-last-issue">
      <GlassCard style={styles.lastCard}>
        <View style={styles.lastRow}>
          <Cover uri={coverUri} width={28} height={40} />
          <View style={styles.lastText}>
            <Text style={styles.volSmall}>{month ? `${formatVol(issue.issueNumber)} · ${month}` : formatVol(issue.issueNumber)}</Text>
            <Text style={styles.lastTitle}>{MAIN_COPY.lastIssue}</Text>
          </View>
          <Text style={styles.arrow}>{'→'}</Text>
        </View>
      </GlassCard>
    </PressScale>
  )
}

// ---------------------------------------------------------------------------
// NEXT ISSUE / FIRST ISSUE
// ---------------------------------------------------------------------------

export interface IssueProgressCardProps {
  number: string
  /** 발행된 호가 0권이면 FIRST ISSUE, 1권 이상이면 NEXT ISSUE. */
  first: boolean
  /** 초안이 없으면 null(진행률 0, 재료 수 없음). */
  next: NextIssueData | null
}

export function IssueProgressCard({ number, first, next }: IssueProgressCardProps) {
  const percent = next?.percent ?? 0
  const lines = next ? materialLines(next.counts) : null
  const title = first || !next ? FIRST_ISSUE_COPY.title : `${next.monthLabel}를 ${NEXT_ISSUE_COPY.status}`
  const kicker = first ? FIRST_ISSUE_COPY.kicker : NEXT_ISSUE_COPY.kicker
  return (
    <GlassCard style={styles.progressCard}>
      <View style={styles.progressBody} testID="main-issue-progress">
        <View style={styles.progressTop}>
          <NumberedKicker number={number} label={kicker} />
          <Text style={styles.percent} testID="main-issue-percent">{`${percent}%`}</Text>
        </View>
        <Text style={styles.progressTitle}>{title}</Text>
        <ProgressRule progress={percent / 100} />
        {lines ? (
          <Text style={styles.counts} testID="main-issue-counts">{`${lines[0]} · ${lines[1]}`}</Text>
        ) : null}
      </View>
    </GlassCard>
  )
}

const styles = StyleSheet.create({
  blockGap: { gap: 8, marginRight: 16 },
  firstStepBody: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 25, color: nocturne.textSub },
  link: { fontFamily: fontFamily.medium, fontSize: 13.5, lineHeight: 20, color: nocturne.mist },

  loveCard: { padding: 18 },
  loveBody: { gap: 8, marginTop: 8 },
  loveEn: { fontFamily: fontFamily.semiBold, fontSize: 12, lineHeight: 16, letterSpacing: 1.44, color: nocturne.ember },
  loveKo: { ...type.title, color: nocturne.text },
  loveCopy: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 20, color: nocturne.textSub },
  loveMeta: { ...type.caption, color: nocturne.textMute },
  pill: { borderRadius: shape.radius.pill },

  cover: {
    borderRadius: 3,
    backgroundColor: nocturne.inkRaise2,
    overflow: 'hidden',
  },
  coverGlow: { boxShadow: `0 0 24px ${withAlpha(nocturne.moon, 0.35)}` },
  coverImage: { width: '100%', height: '100%' },

  newCard: { padding: 16 },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  newText: { flex: 1, gap: 8 },
  volBig: { fontFamily: fontFamily.semiBold, fontSize: 11.5, lineHeight: 16, letterSpacing: 0.92, color: nocturne.moon },
  newTitle: { fontFamily: fontFamily.semiBold, fontSize: 19, lineHeight: 26, color: nocturne.text },
  readButton: { height: 42, borderRadius: shape.radius.pill },

  lastCard: { borderRadius: 18, paddingVertical: 9, paddingLeft: 10, paddingRight: 16 },
  lastRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lastText: { flex: 1, gap: 2 },
  volSmall: { fontFamily: fontFamily.semiBold, fontSize: 11, lineHeight: 15, letterSpacing: 0.66, color: nocturne.moon },
  lastTitle: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: nocturne.text },
  arrow: { ...type.body, color: nocturne.textMute },

  progressCard: { paddingVertical: 18, paddingHorizontal: 20 },
  progressBody: { gap: 11 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  percent: {
    ...ink('metric'),
    fontFamily: fontFamily.regular,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.78,
  },
  progressTitle: { fontFamily: fontFamily.semiBold, fontSize: 17, lineHeight: 24, color: nocturne.text },
  counts: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: nocturne.textMute },
})

