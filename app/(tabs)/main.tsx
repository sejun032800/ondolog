/**
 * 메인 탭(U1, `61-`) - 디자인 `N-B-Main`(B01·B03·B04·B05·B06), MASTER 9-2. Nocturne 하늘 위에 커플의 상태에 맞는 화면 하나를 보인다.
 *
 * - **앱은 온도를 계산하지 않는다.** `daily_temperature` 저장값을 읽기만 하고(`coupleStore`), 값이 없을 때의 표시
 *   상태(MASTER 9-2 표 다섯 행)만 고른다(`utils/mainScreen.temperatureDisplay`). 일 배치(M3-3) 전이라 지금은
 *   연결된 커플이 "아직 온도를 잴 기록이 없어요" 또는 "첫 온도는 기록한 다음 날 나와요"를 본다.
 * - 상태 우선순위는 순수 함수 하나(`resolveMainState`): 미연결(B05) > 기념일 당일(B04) > 새 호 도착(B06) >
 *   기록 없음·저장값 없음(B03) > 온도 있음(B01). 히어로·칸 배치는 `layoutMain`.
 * - 미연결(B05)은 36.5° 고정(발광 없음)과 온보딩 결과 요약, [연인 초대하기](커플 게이트). 연결 전용 본문은
 *   `<CoupleGate>`로 감싼다(탭은 늘 보인다 - 잠긴 문을 보여 주는 것이 설계).
 * - MVP에서 뺀 것(MVP 조정표): "끌어내리면 우리의 하늘" 힌트·끌어내리기, "이번 주" 원문 인용 칸, "제작 현황 →" 링크,
 *   온도 옆 일 단위 증감, "오늘 할 수 있는 일" 칩.
 * - 새 호 도착(B06): 열어 본 적 없고 `published_at`부터 7일 이내인 호. 열었는지는 기기 저장(`services/issueSeen`).
 */
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CoupleGate } from '../../src/components/CoupleGate'
import {
  FirstStepBlock,
  InviteButton,
  IssueProgressCard,
  LastIssueCard,
  LoveTypeCard,
  NewIssueCard,
} from '../../src/components/main/MainBlocks'
import { MainHeader } from '../../src/components/main/MainHeader'
import {
  ConnectHintRow,
  DaysRow,
  MainHero,
  MilestoneTodayRow,
  VerticalDate,
} from '../../src/components/main/MainHero'
import { RiseIn } from '../../src/components/nocturne/RiseIn'
import { ScreenFrame } from '../../src/components/nocturne/ScreenFrame'
import { Skeleton } from '../../src/components/nocturne/Skeleton'
import { SkyBackground } from '../../src/components/nocturne/SkyBackground'
import { useLibrary } from '../../src/hooks/useLibrary'
import { useDisplayNames, useLoveTypeSummary, useMainFacts } from '../../src/hooks/useMainData'
import { useSession } from '../../src/hooks/useSession'
import type { PublishedIssue } from '../../src/services/magazineApi'
import { useCoupleStore } from '../../src/store/coupleStore'
import { shape } from '../../src/theme/nocturne'
import {
  formatKstDateLabel,
  layoutMain,
  milestoneChipLabel,
  pickNewIssueId,
  temperatureDisplay,
} from '../../src/utils/mainScreen'
import { computeDaysTogetherKst, getMilestoneStatus } from '../../src/utils/relationshipDays'

/** 머리 위쪽 여백(안전영역 아래). 보드의 머리 위치(위에서 96pt) = 상태 표시줄 47 + 49. */
const HEADER_TOP_OFFSET = 49
/** 세로 날짜의 위치 = 히어로 숫자 줄(보드 196pt) - 머리 줄(보드 96pt). */
const DATE_TOP = 100

export default function MainTab() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { session } = useSession()
  const userId = session?.user.id ?? null

  const status = useCoupleStore((s) => s.status)
  const coupleId = useCoupleStore((s) => s.coupleId)
  const partnerId = useCoupleStore((s) => s.partnerId)
  const nickname = useCoupleStore((s) => s.nickname)
  const storedTemperature = useCoupleStore((s) => s.temperature)
  const startDate = useCoupleStore((s) => s.relationshipStartDate)
  const refresh = useCoupleStore((s) => s.refresh)

  const connected = status === 'connected'
  const settled = connected || status === 'disconnected'

  useEffect(() => {
    if (userId) void refresh(userId)
  }, [userId, refresh])

  const names = useDisplayNames(userId, connected ? partnerId : null)
  const summary = useLoveTypeSummary(userId, status === 'disconnected')
  const library = useLibrary(connected ? coupleId : null)
  const facts = useMainFacts({
    userId,
    partnerId: connected ? partnerId : null,
    coupleId: connected ? coupleId : null,
    storedTemperature: connected ? storedTemperature : null,
    issueIds: library.issues.map((i) => i.id),
  })

  const bottom = insets.bottom + shape.tabBarGap + shape.tabBarHeight + 24
  const top = insets.top + HEADER_TOP_OFFSET
  const now = new Date()

  const openIssue = (issue: PublishedIssue) =>
    router.push({ pathname: '/magazine-viewer', params: { issueId: issue.id } })

  const disconnectedBody = (
    <DisconnectedBody
      selfName={names.selfName}
      summary={summary}
      dateLabel={formatKstDateLabel(now)}
      onInvite={() => router.push('/couple-gate')}
    />
  )

  const ready = connected && facts.hasActivity !== null && !library.loading

  const days = connected && startDate ? computeDaysTogetherKst(startDate, now) : null
  const milestone = days !== null ? getMilestoneStatus(days) : null
  const display = temperatureDisplay({
    connected,
    profilesComplete: facts.profilesComplete ?? true,
    hasActivity: facts.hasActivity ?? false,
    storedTemperature: connected ? storedTemperature : null,
  })
  const newIssueId = pickNewIssueId(library.issues, facts.openedIssueIds, now)
  const latest: PublishedIssue | null = library.issues[0] ?? null
  const newIssue = library.issues.find((i) => i.id === newIssueId) ?? null
  const layout = layoutMain({
    connected,
    temperature: display,
    milestoneToday: milestone?.isToday ?? false,
    milestoneUpcoming: milestone?.isUpcoming ?? false,
    hasNewIssue: newIssue !== null,
    publishedCount: library.issues.length,
    hasDraft: library.next !== null,
    hasLastIssueCard: latest !== null,
  })
  // 발행된 호·진행을 못 읽었으면(오류) 호 칸은 그리지 않는다 - 0권으로 오해하게 두지 않는다.
  const blocks = layout.blocks.filter(
    (b) => !(library.error && (b.key === 'newIssue' || b.key === 'lastIssue' || b.key === 'issueProgress')),
  )
  const temperatureValue = display.kind === 'value' || display.kind === 'fixed' ? display.value : 0

  const connectedBody = !ready ? (
    <ConnectedWait dateLabel={formatKstDateLabel(now)} />
  ) : (
    <View style={styles.wrap} testID={`main-state-${layout.state}`}>
      <RiseIn>
        <MainHeader connected selfName={names.selfName} partnerName={names.partnerName} nickname={nickname} />
      </RiseIn>
      <RiseIn delayMs={80} style={styles.heroGap}>
        <MainHero
          hero={layout.hero}
          connected
          temperature={temperatureValue}
          milestoneLabel={milestone?.isToday ? milestone.label : null}
        />
      </RiseIn>
      <VerticalDate label={formatKstDateLabel(now)} top={DATE_TOP} />
      <RiseIn delayMs={120}>
        {layout.hero === 'milestone' && milestone?.label ? (
          <MilestoneTodayRow
            label={milestone.label}
            temperature={layout.showTemperatureChip && display.kind === 'value' ? display.value : null}
          />
        ) : (
          <DaysRow
            days={days}
            chipLabel={layout.showMilestoneChip ? milestoneChipLabel(milestone) : null}
            startedToday={days === 1}
          />
        )}
      </RiseIn>
      <View style={styles.blocks}>
        {blocks.map((block, index) => (
          <RiseIn key={block.key} delayMs={160 + index * 40}>
            {block.key === 'firstStep' && block.number ? (
              <FirstStepBlock number={block.number} onChat={() => router.push('/chat')} />
            ) : null}
            {block.key === 'newIssue' && newIssue ? (
              <View style={styles.card}>
                <NewIssueCard
                  issue={newIssue}
                  coverUri={newIssue.coverPath ? library.coverUrls[newIssue.coverPath] : undefined}
                  onOpen={() => openIssue(newIssue)}
                />
              </View>
            ) : null}
            {block.key === 'lastIssue' && latest ? (
              <View style={styles.card}>
                <LastIssueCard
                  issue={latest}
                  coverUri={latest.coverPath ? library.coverUrls[latest.coverPath] : undefined}
                  onOpen={() => openIssue(latest)}
                />
              </View>
            ) : null}
            {block.key === 'issueProgress' && block.number ? (
              <View style={styles.card}>
                <IssueProgressCard
                  number={block.number}
                  first={library.issues.length === 0}
                  next={library.next}
                />
              </View>
            ) : null}
          </RiseIn>
        ))}
      </View>
    </View>
  )

  return (
    <ScreenFrame>
      <SkyBackground view="main" bottomVeil>
        <ScrollView
          contentContainerStyle={{ paddingTop: top, paddingBottom: bottom, paddingHorizontal: shape.space.screen }}
          showsVerticalScrollIndicator={false}
        >
          {settled ? (
            <CoupleGate fallback={disconnectedBody}>{connectedBody}</CoupleGate>
          ) : (
            <ConnectedWait dateLabel={formatKstDateLabel(now)} />
          )}
        </ScrollView>
      </SkyBackground>
    </ScreenFrame>
  )
}

/** B05 미연결: 36.5° 고정 · 연결 안내 · 02 MY LOVE TYPE · [연인 초대하기]. */
function DisconnectedBody(props: {
  selfName: string | null
  summary: ReturnType<typeof useLoveTypeSummary>
  dateLabel: string
  onInvite: () => void
}) {
  const layout = layoutMain({
    connected: false,
    temperature: temperatureDisplay({ connected: false, profilesComplete: false, hasActivity: false, storedTemperature: null }),
    milestoneToday: false,
    milestoneUpcoming: false,
    hasNewIssue: false,
    publishedCount: 0,
    hasDraft: false,
    hasLastIssueCard: false,
  })
  const love = layout.blocks.find((b) => b.key === 'loveType')
  return (
    <View style={styles.wrap} testID="main-state-B05">
      <RiseIn>
        <MainHeader connected={false} selfName={props.selfName} partnerName={null} nickname={null} />
      </RiseIn>
      <RiseIn delayMs={80} style={styles.heroGap}>
        <MainHero hero={layout.hero} connected={false} temperature={36.5} milestoneLabel={null} />
      </RiseIn>
      <RiseIn delayMs={120}>
        <ConnectHintRow />
      </RiseIn>
      <View style={styles.blocks}>
        <RiseIn delayMs={160}>
          <View style={styles.card}>
            <LoveTypeCard number={love?.number ?? '02'} summary={props.summary} />
          </View>
        </RiseIn>
        <RiseIn delayMs={200} style={styles.invite}>
          <InviteButton onPress={props.onInvite} />
        </RiseIn>
      </View>
      <VerticalDate label={props.dateLabel} top={DATE_TOP} />
    </View>
  )
}

/** 연결 여부·연결 뒤 사실을 읽는 동안: 머리와 뼈대. 값을 지어내지 않는다. */
function ConnectedWait(props: { dateLabel: string }) {
  return (
    <View style={styles.wrap} testID="main-wait">
      <Skeleton width="44%" height={34} />
      <View style={styles.waitHero}>
        <Skeleton width="62%" height={34} />
        <Skeleton width="48%" height={34} />
      </View>
      <VerticalDate label={props.dateLabel} top={DATE_TOP} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  heroGap: { marginTop: 44 },
  blocks: { marginTop: 24, gap: 12 },
  card: { marginHorizontal: -4 },
  invite: { marginTop: 24 },
  waitHero: { marginTop: 80, gap: 12 },
})
