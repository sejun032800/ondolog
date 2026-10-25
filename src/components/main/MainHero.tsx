/**
 * 메인 히어로 - 번호 머리글 · 온도 표시 상태(MASTER 9-2) · 기념일 당일 숫자 · 세로 날짜 · D+N 줄.
 *
 * - 저장된 온도가 있을 때만 rose + 발광(metric). 36.5 고정은 발광 없음(`GlowNumeral connected={false}`).
 * - 카운트업 없음: 받은 값을 그대로 그린다. 앱은 온도를 계산하지 않는다.
 * - 날짜 장식은 접근성 트리에서 뺀다(장식).
 */
import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { fontFamily, ink, nocturne, type, withAlpha } from '../../theme/nocturne'
import { splitMilestoneLabel, type MainHero as MainHeroKind } from '../../utils/mainScreen'
import { MilestoneChip } from '../nocturne/Chips'
import { GlowNumeral } from '../nocturne/GlowNumeral'

const HERO_SIZE = 168

/** "01  OUR TEMPERATURE" - 번호 + 영문 대문자 머리글. */
export function NumberedKicker({ number, label }: { number: string; label: string }) {
  return (
    <View style={styles.kickerRow}>
      <Text style={styles.kickerNumber}>{number}</Text>
      <Text style={styles.kickerLabel}>{label}</Text>
    </View>
  )
}

export const HERO_COPY = {
  noRecords: '아직 온도를 잴\n기록이 없어요',
  awaitingBatch: '첫 온도는 기록한\n다음 날 나와요',
  connectHint: '연인과 연결하면 두 사람의 온도로 바뀌어요',
  today: '오늘로 함께한 지',
  startedToday: '오늘 시작했어요',
} as const

export interface MainHeroProps {
  hero: MainHeroKind
  /** 연결 전이면 "MY TEMPERATURE", 연결 후면 "OUR TEMPERATURE". */
  connected: boolean
  /** 온도 숫자(hero가 temperature/fixedTemperature일 때). */
  temperature: number
  /** 기념일 당일 라벨("300일"·"1주년"). */
  milestoneLabel: string | null
}

export function MainHero({ hero, connected, temperature, milestoneLabel }: MainHeroProps) {
  const label = hero === 'milestone' ? 'TODAY' : connected ? 'OUR TEMPERATURE' : 'MY TEMPERATURE'
  return (
    <View testID={`main-hero-${hero}`}>
      <NumberedKicker number="01" label={label} />
      <View style={styles.heroBox}>{renderHero(hero, temperature, milestoneLabel)}</View>
    </View>
  )
}

function renderHero(hero: MainHeroKind, temperature: number, milestoneLabel: string | null): ReactNode {
  switch (hero) {
    case 'temperature':
      return <GlowNumeral value={temperature} size={HERO_SIZE} connected />
    case 'fixedTemperature':
      return <GlowNumeral value={temperature} size={HERO_SIZE} connected={false} />
    case 'noRecords':
      return <Text style={styles.heroText}>{HERO_COPY.noRecords}</Text>
    case 'awaitingBatch':
      return <Text style={styles.heroText}>{HERO_COPY.awaitingBatch}</Text>
    case 'milestone': {
      const parts = milestoneLabel ? splitMilestoneLabel(milestoneLabel) : null
      if (!parts) return <Text style={styles.heroText}>{milestoneLabel ?? ''}</Text>
      const size = parts.number.length > 3 ? 128 : HERO_SIZE
      return (
        <View style={styles.milestoneRow} accessible accessibilityLabel={`${parts.number}${parts.unit}`}>
          <Text
            importantForAccessibility="no"
            style={[
              ink('metric'),
              {
                fontFamily: type.hero.fontFamily,
                fontSize: size,
                lineHeight: Math.round(size * 0.94),
                letterSpacing: -0.07 * size,
              },
            ]}
          >
            {parts.number}
          </Text>
          <Text
            importantForAccessibility="no"
            style={[ink('metric'), styles.milestoneUnit, { fontSize: Math.round(size * 0.31) }]}
          >
            {parts.unit}
          </Text>
        </View>
      )
    }
    default: {
      const _exhaustive: never = hero
      return _exhaustive
    }
  }
}

/** 오른쪽 가장자리의 세로 날짜(장식). 부모는 position: relative여야 한다. */
export function VerticalDate({ label, top }: { label: string; top: number }) {
  return (
    <View
      style={[styles.dateBox, { top }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="main-vertical-date"
    >
      <Text numberOfLines={1} style={styles.dateText}>
        {label}
      </Text>
    </View>
  )
}

export interface DaysRowProps {
  /** D+N. 시작일을 모르면 null. */
  days: number | null
  /** 마일스톤 7일 전 칩 문구("300일 · 2일 남았어요"). */
  chipLabel: string | null
  /** D+1일 때 "오늘 시작했어요" 칩. */
  startedToday: boolean
}

/** 규칙선 + "D+298 [300일 · 2일 남았어요]" 줄. */
export function DaysRow({ days, chipLabel, startedToday }: DaysRowProps) {
  return (
    <View>
      <View style={styles.rule} />
      {days !== null ? (
        <View style={styles.daysRow}>
          <Text style={styles.days} testID="main-days">{`D+${days}`}</Text>
          {chipLabel ? (
            <MilestoneChip label={chipLabel} />
          ) : startedToday ? (
            <MilestoneChip label={HERO_COPY.startedToday} />
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

/** B04 줄: "오늘로 함께한 지 300일이에요 [38.4°]". 온도 칩은 저장된 온도가 있을 때만. */
export function MilestoneTodayRow({ label, temperature }: { label: string; temperature: number | null }) {
  return (
    <View>
      <View style={styles.rule} />
      <View style={styles.daysRow}>
        <Text style={styles.todayText}>{`${HERO_COPY.today} ${label}이에요`}</Text>
        {temperature !== null ? (
          <View style={styles.tempChip} testID="main-temperature-chip">
            <Text style={styles.tempChipLabel}>{`${temperature.toFixed(1)}°`}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

/** B05 줄: 규칙선 + "연인과 연결하면 두 사람의 온도로 바뀌어요". */
export function ConnectHintRow() {
  return (
    <View>
      <View style={styles.rule} />
      <Text style={styles.connectHint}>{HERO_COPY.connectHint}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  kickerRow: { flexDirection: 'row', alignItems: 'center' },
  kickerNumber: { ...type.kicker, letterSpacing: 0.4, color: nocturne.textMute, marginRight: 8 },
  kickerLabel: { ...type.kicker, color: nocturne.textMute },
  heroBox: { marginTop: 6, minHeight: 172, justifyContent: 'flex-start' },
  heroText: {
    marginTop: 10,
    fontFamily: fontFamily.semiBold,
    fontSize: 34,
    lineHeight: 46,
    letterSpacing: -1.02,
    color: nocturne.text,
  },
  milestoneRow: { flexDirection: 'row', alignItems: 'flex-start' },
  milestoneUnit: { fontFamily: fontFamily.regular, letterSpacing: -1.5, marginTop: 16, marginLeft: 4 },
  dateBox: { position: 'absolute', right: 14, width: 16, height: 150 },
  dateText: {
    position: 'absolute',
    width: 150,
    left: -67,
    top: 66,
    ...type.tab,
    letterSpacing: 0.88,
    color: nocturne.textMute,
    transform: [{ rotate: '90deg' }],
  },
  rule: { height: 1, backgroundColor: withAlpha(nocturne.text, 0.14), marginRight: 16 },
  daysRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, marginRight: 16 },
  days: { fontFamily: fontFamily.medium, fontSize: 17, lineHeight: 24, color: nocturne.text },
  todayText: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 22, color: nocturne.text, flexShrink: 1 },
  tempChip: {
    height: 26,
    paddingHorizontal: 11,
    borderRadius: 999,
    justifyContent: 'center',
    backgroundColor: withAlpha(nocturne.rose, 0.12),
  },
  tempChipLabel: { fontFamily: fontFamily.semiBold, fontSize: 12, color: nocturne.rose },
  connectHint: { ...type.sub, fontSize: 14, lineHeight: 20, color: nocturne.textMute, marginTop: 14, marginRight: 16 },
})
