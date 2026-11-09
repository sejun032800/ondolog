/**
 * 메인 탭 본문(B01 · B03 · B04 · B05 · B06) - 보드 `N-B-Main`, RN `app/(tabs)/main.tsx` + `components/main/*`의 웹판.
 * 데이터를 받아 그리기만 한다(저장소 · 서버 조회 없음 - `MainTab`이 훅으로 읽어 넘긴다). 그래서 상태별 시험이 값만 바꿔 넣는다.
 *
 *  - **온도는 계산하지 않는다.** 저장값(`daily_temperature`, `coupleStore`)이 있으면 그대로, 없으면 표시 상태(`temperatureDisplay`)만 고른다.
 *    미연결 · 프로파일 미완은 36.5 고정(발광 없음).
 *  - 상태 우선순위 · 히어로 · 칸 배치는 `@/utils/mainScreen`(순수 함수, RN과 같은 파일)이 정한다.
 *  - 연결 전용 본문은 `<CoupleGate>`로 감싼다. 탭은 늘 보인다(잠긴 문을 보여 주는 것이 설계).
 *  - MVP에서 뺀 것: "끌어내리면 우리의 하늘" 힌트 · 끌어내리기, "이번 주" 원문 인용 칸, "제작 현황 →", 온도 옆 일 단위 증감, "오늘 할 수 있는 일" 칩.
 *  - 불러오는 중에는 I03 뼈대. 연결 여부 · 연결 뒤 사실 · 호 목록이 다 읽히기 전에는 어떤 상태도 확정해 그리지 않는다(빈 상태 깜빡임 0).
 */
import type { CSSProperties, ReactNode } from 'react'
import { FIRST_ISSUE_COPY, NEXT_ISSUE_COPY } from '@/constants/magazineCopy'
import { LOVE_TYPE_LABEL_BY_CODE } from '@/constants/loveTypeLabels'
import type { PublishedIssue } from '@/services/magazineApi'
import {
  formatKstDateLabel,
  layoutMain,
  milestoneChipLabel,
  pickNewIssueId,
  splitMilestoneLabel,
  temperatureDisplay,
  type MainHero,
} from '@/utils/mainScreen'
import { issueMonthLabel } from '@/utils/magazine'
import { computeDaysTogetherKst, getMilestoneStatus } from '@/utils/relationshipDays'
import { CoupleGate } from '../../components/CoupleGate'
import { Skeleton } from '../../components/Skeleton'
import type { CoupleState } from '../../stores/coupleStore'
import { PrimaryButton } from '../../ui'
import type { LibraryState, LoveTypeSummary, MainFacts, NextIssueData } from './useMainData'

export const MAIN_COPY = {
  firstStepBody: '대화가 쌓이면 이 자리에\n두 사람의 온도가 떠요',
  firstStepLink: '채팅에서 첫 대화 남기기 →',
  loveTypeKicker: 'MY LOVE TYPE',
  invite: '연인 초대하기',
  lastIssue: '지난 호 다시 읽기',
  read: '읽기',
  newIssueFallbackTitle: '새 호가 꽂혔어요',
  noRecords: '아직 온도를 잴\n기록이 없어요',
  awaitingBatch: '첫 온도는 기록한\n다음 날 나와요',
  connectHint: '연인과 연결하면 두 사람의 온도로 바뀌어요',
  today: '오늘로 함께한 지',
  startedToday: '오늘 시작했어요',
} as const

const HERO_SIZE = 168
const DECIMAL_RATIO = 0.42

/** 한 칸씩 80ms 간격으로 떠오른다(보드 02_X1: 카드가 80ms 간격으로 차례로, ease `cubic-bezier(.2,.8,.2,1)` 0.7~0.8초). */
function Rise({ order, children, className }: { order: number; children: ReactNode; className?: string }) {
  return <div className={`mainRise ${className ?? ''}`} style={{ animationDelay: `${order * 80}ms` }}>{children}</div>
}

// ---------------------------------------------------------------------------
// 부품
// ---------------------------------------------------------------------------

/** 온도 숫자 - 정수 · 소수(42%)를 나눠 그린다. 카운트업 없음. 저장값이면 rose + 발광, 36.5 고정이면 textSub 발광 없음(R36-1). */
export function GlowNumeral({ value, size = HERO_SIZE, connected = true }: { value: number; size?: number; connected?: boolean }) {
  const [integer, decimal] = value.toFixed(1).split('.')
  const decimalSize = Math.round(size * DECIMAL_RATIO)
  return (
    <div className={`numeral ${connected ? 'glow' : 'dim'}`} role="img" aria-label={`${integer}.${decimal}도`} style={{ fontSize: size }}>
      <span aria-hidden="true">{integer}</span>
      <span aria-hidden="true" className="dec" style={{ fontSize: decimalSize, marginTop: Math.round((4 * size) / 92) }}>{`.${decimal}°`}</span>
    </div>
  )
}

function Kicker({ number, label }: { number: string; label: string }) {
  return (
    <div className="mainKicker">
      <span className="num">{number}</span>
      <span>{label}</span>
    </div>
  )
}

function Chip({ label, tone = 'rose' }: { label: string; tone?: 'rose' | 'temp' }) {
  return <span className={`mainChip ${tone}`}>{label}</span>
}

/** 오른쪽 가장자리의 세로 날짜(장식, 접근성 트리에서 뺀다). 부모는 position: relative. */
function VerticalDate({ label }: { label: string }) {
  return (
    <div className="mainVDate" aria-hidden="true" data-testid="main-vertical-date">
      <span>{label}</span>
    </div>
  )
}

export function headerLines(input: { connected: boolean; selfName: string | null; partnerName: string | null; nickname: string | null }): { title: string; subtitle: string } {
  if (!input.connected) return { title: input.selfName ?? '나', subtitle: '아직 혼자예요' }
  const names = [input.selfName, input.partnerName].filter((n): n is string => !!n).join(' · ')
  if (input.nickname) return { title: input.nickname, subtitle: names }
  return { title: names || '두 사람', subtitle: '' }
}

function MainHeader(props: { connected: boolean; selfName: string | null; partnerName: string | null; nickname: string | null }) {
  const { title, subtitle } = headerLines(props)
  return (
    <div className="mainHeader" data-testid="main-header">
      <div className="avatars">
        <i className="me" />
        {props.connected ? <i className="partner" /> : <i className="empty" data-testid="main-empty-slot" />}
      </div>
      <div className="names">
        <div className="title">{title}</div>
        {subtitle ? <div className="sub">{subtitle}</div> : null}
      </div>
    </div>
  )
}

function Hero({ hero, connected, temperature, milestoneLabel }: { hero: MainHero; connected: boolean; temperature: number; milestoneLabel: string | null }) {
  const label = hero === 'milestone' ? 'TODAY' : connected ? 'OUR TEMPERATURE' : 'MY TEMPERATURE'
  let body: ReactNode
  switch (hero) {
    case 'temperature': body = <GlowNumeral value={temperature} connected />; break
    case 'fixedTemperature': body = <GlowNumeral value={temperature} connected={false} />; break
    case 'noRecords': body = <p className="heroText pre">{MAIN_COPY.noRecords}</p>; break
    case 'awaitingBatch': body = <p className="heroText pre">{MAIN_COPY.awaitingBatch}</p>; break
    case 'milestone': {
      const parts = milestoneLabel ? splitMilestoneLabel(milestoneLabel) : null
      if (!parts) { body = <p className="heroText">{milestoneLabel ?? ''}</p>; break }
      const size = parts.number.length > 3 ? 128 : HERO_SIZE
      body = (
        <div className="milestoneHero metric" role="img" aria-label={`${parts.number}${parts.unit}`} style={{ fontSize: size }}>
          <span aria-hidden="true">{parts.number}</span>
          <span aria-hidden="true" className="unit" style={{ fontSize: Math.round(size * 0.31) }}>{parts.unit}</span>
        </div>
      )
      break
    }
  }
  return (
    <div data-testid={`main-hero-${hero}`}>
      <Kicker number="01" label={label} />
      <div className="heroBox">{body}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 번호 칸 · 카드
// ---------------------------------------------------------------------------

function monthOf(issue: PublishedIssue): string {
  return issueMonthLabel({ periodStart: issue.periodStart, issueType: issue.issueType, title: issue.title })
}

export function formatVol(volume: number): string {
  return `VOL.${String(Math.max(0, Math.trunc(volume))).padStart(2, '0')}`
}

/** 새 호 카드 제목: "10월호가\n꽂혔어요". 호 이름을 못 읽으면 이름 없는 문구. */
export function newIssueTitle(month: string): string {
  return month ? `${month}가\n꽂혔어요` : MAIN_COPY.newIssueFallbackTitle
}

export function materialLines(counts: NextIssueData['counts']): [string, string] | null {
  if (!counts) return null
  return [`대화 ${counts.messages} · 사진 ${counts.photos}`, `데이트 ${counts.dates}`]
}

function Cover({ uri, width, height, glowing }: { uri: string | undefined; width: number; height: number; glowing?: boolean }) {
  const style: CSSProperties = { width, height }
  return (
    <span className={`mainCover ${glowing ? 'glowing' : ''}`} style={style} data-testid="main-issue-cover">
      {uri ? <img src={uri} alt="" draggable={false} /> : null}
    </span>
  )
}

function FirstStepBlock({ number, onChat }: { number: string; onChat: () => void }) {
  return (
    <div className="mainFirstStep" data-testid="main-first-step">
      <Kicker number={number} label="FIRST STEP" />
      <p className="body pre">{MAIN_COPY.firstStepBody}</p>
      <button type="button" className="link press" onClick={onChat} data-testid="main-first-step-link" aria-label="채팅에서 첫 대화 남기기">{MAIN_COPY.firstStepLink}</button>
    </div>
  )
}

function LoveTypeCard({ number, summary }: { number: string; summary: LoveTypeSummary | null }) {
  const label = summary ? LOVE_TYPE_LABEL_BY_CODE[summary.loveTypeCode] : undefined
  return (
    <div className="mainCard loveCard" data-testid="main-love-type">
      <Kicker number={number} label={MAIN_COPY.loveTypeKicker} />
      {summary ? (
        <div className="loveBody">
          <div className="en">{label?.labelEn ?? summary.loveTypeCode}</div>
          <div className="ko">{label?.labelKo ?? summary.loveTypeCode}</div>
          {label?.copyKo ? <p className="copy">{label.copyKo}</p> : null}
          <p className="meta">{`${summary.mbti} · 애니어그램 ${summary.enneagramCore}유형`}</p>
        </div>
      ) : null}
    </div>
  )
}

function NewIssueCard({ issue, coverUri, onOpen }: { issue: PublishedIssue; coverUri: string | undefined; onOpen: () => void }) {
  return (
    <div className="mainCard newCard" data-testid="main-new-issue">
      <Cover uri={coverUri} width={84} height={116} glowing />
      <div className="text">
        <div className="vol big">{formatVol(issue.issueNumber)}</div>
        <div className="newTitle pre">{newIssueTitle(monthOf(issue))}</div>
        <button type="button" className="readBtn press" onClick={onOpen} data-testid="main-new-issue-read">{MAIN_COPY.read}</button>
      </div>
    </div>
  )
}

function LastIssueCard({ issue, coverUri, onOpen }: { issue: PublishedIssue; coverUri: string | undefined; onOpen: () => void }) {
  const month = monthOf(issue)
  return (
    <button type="button" className="mainCard lastCard press" onClick={onOpen} data-testid="main-last-issue" aria-label={MAIN_COPY.lastIssue}>
      <Cover uri={coverUri} width={28} height={40} />
      <span className="text">
        <span className="vol">{month ? `${formatVol(issue.issueNumber)} · ${month}` : formatVol(issue.issueNumber)}</span>
        <span className="lastTitle">{MAIN_COPY.lastIssue}</span>
      </span>
      <span className="arrow" aria-hidden="true">→</span>
    </button>
  )
}

/** NEXT ISSUE / FIRST ISSUE - 진행률은 기간 경과율(R18-6), 정지 값. "제작 현황 →"은 숨긴다(D02는 범위 밖). */
function IssueProgressCard({ number, first, next }: { number: string; first: boolean; next: NextIssueData | null }) {
  const percent = next?.percent ?? 0
  const lines = next ? materialLines(next.counts) : null
  const title = first || !next ? FIRST_ISSUE_COPY.title : `${next.monthLabel}를 ${NEXT_ISSUE_COPY.status}`
  const kicker = first ? FIRST_ISSUE_COPY.kicker : NEXT_ISSUE_COPY.kicker
  return (
    <div className="mainCard progressCard" data-testid="main-issue-progress">
      <div className="top">
        <Kicker number={number} label={kicker} />
        <span className="percent metric" data-testid="main-issue-percent">{`${percent}%`}</span>
      </div>
      <div className="progressTitle">{title}</div>
      <div className="progressRule"><div style={{ width: `${percent}%` }} /></div>
      {lines ? <div className="counts" data-testid="main-issue-counts">{`${lines[0]} · ${lines[1]}`}</div> : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 상태별 본문
// ---------------------------------------------------------------------------

/** 읽는 동안: 머리와 뼈대. 값을 지어내지 않는다(I03). */
function Wait({ dateLabel }: { dateLabel: string }) {
  return (
    <div className="mainWrap" data-testid="main-wait">
      <Skeleton width="44%" height={34} />
      <div className="waitHero">
        <Skeleton width="62%" height={34} />
        <Skeleton width="48%" height={34} />
      </div>
      <VerticalDate label={dateLabel} />
    </div>
  )
}

/** B05 미연결: 36.5° 고정 · 연결 안내 · 02 MY LOVE TYPE · [연인 초대하기]. */
function DisconnectedBody({ selfName, summary, dateLabel, onInvite }: { selfName: string | null; summary: LoveTypeSummary | null; dateLabel: string; onInvite: () => void }) {
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
    <div className="mainWrap" data-testid="main-state-B05">
      <Rise order={0}><MainHeader connected={false} selfName={selfName} partnerName={null} nickname={null} /></Rise>
      <Rise order={1} className="heroGap"><Hero hero={layout.hero} connected={false} temperature={36.5} milestoneLabel={null} /></Rise>
      <Rise order={2}>
        <div className="mainRule" />
        <p className="connectHint">{MAIN_COPY.connectHint}</p>
      </Rise>
      <div className="mainBlocks">
        <Rise order={3}><LoveTypeCard number={love?.number ?? '02'} summary={summary} /></Rise>
        <Rise order={4} className="inviteGap">
          <PrimaryButton label={MAIN_COPY.invite} onClick={onInvite} />
        </Rise>
      </div>
      <VerticalDate label={dateLabel} />
    </div>
  )
}

export interface MainViewProps {
  now: Date
  status: CoupleState['status']
  nickname: string | null
  /** `daily_temperature` 저장값(읽기만). 미연결은 36.5, 연결인데 값이 없으면 null. */
  storedTemperature: number | null
  startDate: string | null
  selfName: string | null
  partnerName: string | null
  facts: MainFacts
  library: LibraryState
  summary: LoveTypeSummary | null
  onInvite: () => void
  onChat: () => void
  onOpenIssue: (issue: PublishedIssue) => void
}

export function MainView(props: MainViewProps) {
  const { now, status, facts, library } = props
  const connected = status === 'connected'
  const settled = connected || status === 'disconnected'
  const dateLabel = formatKstDateLabel(now)

  const issueKey = library.issues.map((i) => i.id).join(',')
  // 사실(활동 · 프로파일 · 열어 봄)과 호 목록이 둘 다 이번 호 목록 기준으로 읽혀야 그린다 - 새 호 카드가 떴다 사라지지 않게.
  const ready = connected && facts.hasActivity !== null && !library.loading && facts.openedFor === issueKey

  const days = connected && props.startDate ? computeDaysTogetherKst(props.startDate, now) : null
  const milestone = days !== null ? getMilestoneStatus(days) : null
  const display = temperatureDisplay({
    connected,
    profilesComplete: facts.profilesComplete ?? true,
    hasActivity: facts.hasActivity ?? false,
    storedTemperature: connected ? props.storedTemperature : null,
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
  // 발행된 호 · 진행을 못 읽었으면(오류) 호 칸은 그리지 않는다 - 0권으로 오해하게 두지 않는다.
  const blocks = layout.blocks.filter((b) => !(library.error && (b.key === 'newIssue' || b.key === 'lastIssue' || b.key === 'issueProgress')))
  const temperatureValue = display.kind === 'value' || display.kind === 'fixed' ? display.value : 0

  const connectedBody = !ready ? (
    <Wait dateLabel={dateLabel} />
  ) : (
    <div className="mainWrap" data-testid={`main-state-${layout.state}`}>
      <Rise order={0}><MainHeader connected selfName={props.selfName} partnerName={props.partnerName} nickname={props.nickname} /></Rise>
      <Rise order={1} className="heroGap">
        <Hero hero={layout.hero} connected temperature={temperatureValue} milestoneLabel={milestone?.isToday ? milestone.label : null} />
      </Rise>
      <VerticalDate label={dateLabel} />
      <Rise order={2}>
        <div className="mainRule" />
        {layout.hero === 'milestone' && milestone?.label ? (
          <div className="daysRow">
            <span className="todayText">{`${MAIN_COPY.today} ${milestone.label}이에요`}</span>
            {layout.showTemperatureChip && display.kind === 'value' ? (
              <span data-testid="main-temperature-chip"><Chip tone="temp" label={`${display.value.toFixed(1)}°`} /></span>
            ) : null}
          </div>
        ) : days !== null ? (
          <div className="daysRow">
            <span className="days" data-testid="main-days">{`D+${days}`}</span>
            {layout.showMilestoneChip && milestoneChipLabel(milestone) ? (
              <Chip label={milestoneChipLabel(milestone) as string} />
            ) : days === 1 ? (
              <Chip label={MAIN_COPY.startedToday} />
            ) : null}
          </div>
        ) : null}
      </Rise>
      <div className="mainBlocks">
        {blocks.map((block, index) => (
          <Rise key={block.key} order={3 + index}>
            {block.key === 'firstStep' && block.number ? <FirstStepBlock number={block.number} onChat={props.onChat} /> : null}
            {block.key === 'newIssue' && newIssue ? (
              <NewIssueCard issue={newIssue} coverUri={newIssue.coverPath ? library.coverUrls[newIssue.coverPath] : undefined} onOpen={() => props.onOpenIssue(newIssue)} />
            ) : null}
            {block.key === 'lastIssue' && latest ? (
              <LastIssueCard issue={latest} coverUri={latest.coverPath ? library.coverUrls[latest.coverPath] : undefined} onOpen={() => props.onOpenIssue(latest)} />
            ) : null}
            {block.key === 'issueProgress' && block.number ? (
              <IssueProgressCard number={block.number} first={library.issues.length === 0} next={library.next} />
            ) : null}
          </Rise>
        ))}
      </div>
    </div>
  )

  return settled ? (
    <CoupleGate fallback={<DisconnectedBody selfName={props.selfName} summary={props.summary} dateLabel={dateLabel} onInvite={props.onInvite} />}>
      {connectedBody}
    </CoupleGate>
  ) : (
    <Wait dateLabel={dateLabel} />
  )
}
