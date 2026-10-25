/**
 * 메인 탭(U1) 순수 규칙 시험 - 온도 표시 상태 5가지 · 상태 우선순위 · 히어로·칸 배치 · 마일스톤(7일 전·당일, KST) ·
 * 새 호 도착(B06) 보임/숨김 조건.
 */
import { DISCONNECTED_TEMPERATURE } from '../../src/engine/temperature'
import {
  NEW_ISSUE_WINDOW_DAYS,
  formatKstDateLabel,
  isNewIssueArrival,
  layoutMain,
  milestoneChipLabel,
  pickNewIssueId,
  resolveMainState,
  splitMilestoneLabel,
  temperatureDisplay,
  type MainLayoutInput,
  type TemperatureDisplay,
} from '../../src/utils/mainScreen'
import { computeDaysTogetherKst, getMilestoneStatus } from '../../src/utils/relationshipDays'

describe('온도 표시 상태 (MASTER 9-2 표, 다섯 행)', () => {
  const base = { connected: true, profilesComplete: true, hasActivity: true, storedTemperature: 38.2 }

  it('1. 미연결 -> 36.5 고정', () => {
    expect(temperatureDisplay({ ...base, connected: false, storedTemperature: null })).toEqual({
      kind: 'fixed',
      reason: 'disconnected',
      value: DISCONNECTED_TEMPERATURE,
    })
  })

  it('2. 연결 + 성격 프로파일 미완 -> 36.5 고정(저장값이 있어도 기저 산출 불가)', () => {
    expect(temperatureDisplay({ ...base, profilesComplete: false })).toEqual({
      kind: 'fixed',
      reason: 'profileIncomplete',
      value: 36.5,
    })
  })

  it('3. 연결 + 활동 0일 -> "아직 온도를 잴 기록이 없어요"(noRecords)', () => {
    expect(temperatureDisplay({ ...base, hasActivity: false, storedTemperature: null })).toEqual({ kind: 'noRecords' })
  })

  it('4. 연결 + 활동 있음 + 저장된 온도 없음 -> "첫 온도는 기록한 다음 날 나와요"(awaitingBatch, r69)', () => {
    expect(temperatureDisplay({ ...base, storedTemperature: null })).toEqual({ kind: 'awaitingBatch' })
  })

  it('5. 연결 + 활동 있음 + 저장된 온도 있음 -> 저장값 그대로', () => {
    expect(temperatureDisplay(base)).toEqual({ kind: 'value', value: 38.2 })
    expect(temperatureDisplay({ ...base, storedTemperature: 0 })).toEqual({ kind: 'value', value: 0 })
  })

  it('입력만으로 정해진다(같은 입력 -> 같은 출력). 앱은 값을 만들어 내지 않는다', () => {
    const a = temperatureDisplay({ ...base, storedTemperature: 39.1 })
    const b = temperatureDisplay({ ...base, storedTemperature: 39.1 })
    expect(a).toEqual(b)
    // 저장값이 없으면 어떤 입력에서도 숫자가 나오지 않는다(36.5 고정 두 행 제외).
    for (const hasActivity of [true, false]) {
      const d = temperatureDisplay({ ...base, hasActivity, storedTemperature: null })
      expect(d.kind === 'value').toBe(false)
    }
  })
})

describe('상태 우선순위: B05 > B04 > B06 > B03 > B01', () => {
  const connectedValue: TemperatureDisplay = { kind: 'value', value: 38.2 }
  const noRecords: TemperatureDisplay = { kind: 'noRecords' }
  const fixed: TemperatureDisplay = { kind: 'fixed', reason: 'disconnected', value: 36.5 }

  it('미연결은 무엇이 겹쳐도 B05', () => {
    expect(resolveMainState({ connected: false, temperature: fixed, milestoneToday: true, hasNewIssue: true })).toBe('B05')
  })

  it('기념일 당일은 새 호보다 먼저(B04 > B06)', () => {
    expect(resolveMainState({ connected: true, temperature: connectedValue, milestoneToday: true, hasNewIssue: true })).toBe('B04')
  })

  it('새 호 도착은 기록 없음보다 먼저(B06 > B03)', () => {
    expect(resolveMainState({ connected: true, temperature: noRecords, milestoneToday: false, hasNewIssue: true })).toBe('B06')
  })

  it('기록 없음·저장값 없음은 B03, 온도 있음은 B01', () => {
    const none = { connected: true, milestoneToday: false, hasNewIssue: false }
    expect(resolveMainState({ ...none, temperature: noRecords })).toBe('B03')
    expect(resolveMainState({ ...none, temperature: { kind: 'awaitingBatch' } })).toBe('B03')
    expect(resolveMainState({ ...none, temperature: connectedValue })).toBe('B01')
    // 연결 + 프로파일 미완(36.5 고정)은 히어로 숫자 틀이라 B01.
    expect(resolveMainState({ ...none, temperature: { kind: 'fixed', reason: 'profileIncomplete', value: 36.5 } })).toBe('B01')
  })
})

describe('히어로·칸 배치 (보드를 따르고, 보드에 없는 겹침은 우선순위로 히어로를 고른다)', () => {
  const input = (over: Partial<MainLayoutInput> = {}): MainLayoutInput => ({
    connected: true,
    temperature: { kind: 'value', value: 38.2 },
    milestoneToday: false,
    milestoneUpcoming: false,
    hasNewIssue: false,
    publishedCount: 1,
    hasDraft: true,
    hasLastIssueCard: true,
    ...over,
  })
  const keys = (l: ReturnType<typeof layoutMain>) => l.blocks.map((b) => `${b.key}:${b.number ?? '-'}`)

  it('B01: 히어로 온도 / 지난 호 다시 읽기(번호 없음) / 02 다음 호 - "이번 주" 칸이 없어 번호를 당긴다', () => {
    const l = layoutMain(input())
    expect(l.state).toBe('B01')
    expect(l.hero).toBe('temperature')
    expect(keys(l)).toEqual(['lastIssue:-', 'issueProgress:02'])
  })

  it('B03(기록 없음): 히어로 문구 / 02 FIRST STEP / 03 FIRST ISSUE(발행 0권이면 초안이 없어도 카드)', () => {
    const l = layoutMain(
      input({ temperature: { kind: 'noRecords' }, publishedCount: 0, hasDraft: false, hasLastIssueCard: false }),
    )
    expect(l.state).toBe('B03')
    expect(l.hero).toBe('noRecords')
    expect(keys(l)).toEqual(['firstStep:02', 'issueProgress:03'])
  })

  it('B03(저장값 없음, r69): 같은 틀의 히어로 문구, 활동이 있으므로 FIRST STEP 권유는 없다', () => {
    const l = layoutMain(
      input({ temperature: { kind: 'awaitingBatch' }, publishedCount: 0, hasDraft: true, hasLastIssueCard: false }),
    )
    expect(l.state).toBe('B03')
    expect(l.hero).toBe('awaitingBatch')
    expect(keys(l)).toEqual(['issueProgress:02'])
  })

  it('B04: 히어로가 기념일 숫자로 바뀌고 온도 칩은 저장된 온도가 있을 때만', () => {
    const withTemp = layoutMain(input({ milestoneToday: true }))
    expect(withTemp.state).toBe('B04')
    expect(withTemp.hero).toBe('milestone')
    expect(withTemp.showTemperatureChip).toBe(true)
    const noTemp = layoutMain(input({ milestoneToday: true, temperature: { kind: 'awaitingBatch' } }))
    expect(noTemp.hero).toBe('milestone')
    expect(noTemp.showTemperatureChip).toBe(false)
  })

  it('B06: 히어로는 바꾸지 않고(보드), 새 호 카드가 "지난 호 다시 읽기" 자리를 차지하고 번호는 02부터', () => {
    const l = layoutMain(input({ hasNewIssue: true }))
    expect(l.state).toBe('B06')
    expect(l.hero).toBe('temperature')
    expect(keys(l)).toEqual(['newIssue:-', 'issueProgress:02'])
  })

  it('B04 + 새 호(보드에 없는 겹침): 우선순위로 히어로는 기념일, 새 호는 카드로 내린다', () => {
    const l = layoutMain(input({ milestoneToday: true, hasNewIssue: true }))
    expect(l.state).toBe('B04')
    expect(l.hero).toBe('milestone')
    expect(keys(l)).toEqual(['newIssue:-', 'issueProgress:02'])
  })

  it('B05: 36.5 고정 히어로 + 02 MY LOVE TYPE + 초대, 연결 전용 칸 없음', () => {
    const l = layoutMain(input({ connected: false, temperature: { kind: 'fixed', reason: 'disconnected', value: 36.5 } }))
    expect(l.state).toBe('B05')
    expect(l.hero).toBe('fixedTemperature')
    expect(keys(l)).toEqual(['loveType:02'])
    expect(l.showInvite).toBe(true)
    expect(l.showMilestoneChip).toBe(false)
  })

  it('R32-2: 발행 1권 이상 + 초안 없음이면 다음 호 카드가 없다. 발행 0권이면 첫 호 카드', () => {
    expect(keys(layoutMain(input({ hasDraft: false })))).toEqual(['lastIssue:-'])
    expect(keys(layoutMain(input({ publishedCount: 0, hasDraft: false, hasLastIssueCard: false })))).toEqual([
      'issueProgress:02',
    ])
  })

  it('"이번 주" 원문 인용 칸은 어떤 배치에도 없다(MVP 조정표)', () => {
    const all = [
      layoutMain(input()),
      layoutMain(input({ milestoneToday: true })),
      layoutMain(input({ hasNewIssue: true })),
      layoutMain(input({ temperature: { kind: 'noRecords' } })),
      layoutMain(input({ connected: false })),
    ]
    for (const l of all) {
      for (const b of l.blocks) expect(['loveType', 'firstStep', 'newIssue', 'lastIssue', 'issueProgress']).toContain(b.key)
    }
  })

  it('마일스톤 칩은 임박(7일 전부터)일 때만, 당일은 B04가 맡는다', () => {
    expect(layoutMain(input({ milestoneUpcoming: true })).showMilestoneChip).toBe(true)
    expect(layoutMain(input()).showMilestoneChip).toBe(false)
    expect(layoutMain(input({ milestoneToday: true })).showMilestoneChip).toBe(false)
  })
})

describe('마일스톤: 7일 전 칩 · 당일 B04 (시작일 = 1일차, KST)', () => {
  it('7일 전부터 칩 문구 "300일 · 2일 남았어요"', () => {
    expect(milestoneChipLabel(getMilestoneStatus(298))).toBe('300일 · 2일 남았어요')
    expect(milestoneChipLabel(getMilestoneStatus(293))).toBe('300일 · 7일 남았어요')
  })

  it('8일 전에는 칩이 없고, 당일에는 칩이 아니라 B04다', () => {
    expect(milestoneChipLabel(getMilestoneStatus(292))).toBeNull()
    expect(milestoneChipLabel(getMilestoneStatus(300))).toBeNull()
    expect(getMilestoneStatus(300).isToday).toBe(true)
    expect(milestoneChipLabel(null)).toBeNull()
  })

  it('연 단위: 358일차 -> "1주년 · 7일 남았어요", 365일 당일 라벨 "1주년"', () => {
    expect(milestoneChipLabel(getMilestoneStatus(358))).toBe('1주년 · 7일 남았어요')
    expect(getMilestoneStatus(365).label).toBe('1주년')
  })

  it('기념일 라벨을 히어로 숫자와 단위로 가른다', () => {
    expect(splitMilestoneLabel('300일')).toEqual({ number: '300', unit: '일' })
    expect(splitMilestoneLabel('1주년')).toEqual({ number: '1', unit: '주년' })
    expect(splitMilestoneLabel('이상한 라벨')).toBeNull()
  })

  it('D+N은 KST 날짜로 센다: 한국 시간 00:00~09:00(UTC 전날)에도 하루 늦지 않는다', () => {
    // 2026-01-01 시작 -> KST 2026-10-27 = 300일차. 그 날 KST 00:30 = UTC 10-26 15:30.
    expect(computeDaysTogetherKst('2026-01-01', new Date('2026-10-26T15:30:00Z'))).toBe(300)
    // 같은 KST 날짜의 늦은 시각(KST 23:30 = UTC 14:30)도 같은 값.
    expect(computeDaysTogetherKst('2026-01-01', new Date('2026-10-27T14:30:00Z'))).toBe(300)
    // 한 시간 뒤(KST 다음 날 00:30)는 301.
    expect(computeDaysTogetherKst('2026-01-01', new Date('2026-10-27T15:30:00Z'))).toBe(301)
  })

  it('KST D+N 경계: 시작일 당일 1, 미래 시작일 1, 같은 입력 -> 같은 결과', () => {
    expect(computeDaysTogetherKst('2026-10-27', new Date('2026-10-27T03:00:00Z'))).toBe(1)
    expect(computeDaysTogetherKst('2099-01-01', new Date('2026-10-27T03:00:00Z'))).toBe(1)
    const now = new Date('2026-10-27T03:00:00Z')
    expect(computeDaysTogetherKst('2025-01-10', now)).toBe(computeDaysTogetherKst('2025-01-10', now))
  })

  it('세로 날짜 장식은 KST 요일을 쓴다(UTC 전날 15시 = KST 다음 날 0시)', () => {
    expect(formatKstDateLabel(new Date('2026-10-20T15:30:00Z'))).toBe('10월 21일 수요일')
    expect(formatKstDateLabel(new Date('2026-10-21T14:59:00Z'))).toBe('10월 21일 수요일')
    expect(formatKstDateLabel(new Date('2026-10-21T15:00:00Z'))).toBe('10월 22일 목요일')
  })
})

describe('B06 새 호 도착: 연 적 없음 + published_at부터 7일 이내', () => {
  const published = '2026-10-01T00:00:00Z'
  const at = (ms: number) => new Date(Date.parse(published) + ms)
  const DAY = 24 * 60 * 60 * 1000

  it('윈도는 7일', () => {
    expect(NEW_ISSUE_WINDOW_DAYS).toBe(7)
  })

  it('안 열었고 7일 이내면 보인다', () => {
    expect(isNewIssueArrival({ publishedAt: published, now: at(0), opened: false })).toBe(true)
    expect(isNewIssueArrival({ publishedAt: published, now: at(6 * DAY + 23 * 3600 * 1000), opened: false })).toBe(true)
    expect(isNewIssueArrival({ publishedAt: published, now: at(7 * DAY), opened: false })).toBe(true)
  })

  it('7일이 지나면 숨는다', () => {
    expect(isNewIssueArrival({ publishedAt: published, now: at(7 * DAY + 1), opened: false })).toBe(false)
    expect(isNewIssueArrival({ publishedAt: published, now: at(30 * DAY), opened: false })).toBe(false)
  })

  it('열었으면 7일 이내여도 숨는다', () => {
    expect(isNewIssueArrival({ publishedAt: published, now: at(DAY), opened: true })).toBe(false)
  })

  it('발행 시각을 못 읽으면 보이지 않는다', () => {
    expect(isNewIssueArrival({ publishedAt: '', now: at(0), opened: false })).toBe(false)
    expect(isNewIssueArrival({ publishedAt: 'not-a-date', now: at(0), opened: false })).toBe(false)
  })

  it('여러 호 중 열지 않았고 7일 이내인 가장 최근 호를 고른다', () => {
    const issues = [
      { id: 'old', publishedAt: '2026-09-01T00:00:00Z' },
      { id: 'new', publishedAt: '2026-10-01T00:00:00Z' },
    ]
    expect(pickNewIssueId(issues, new Set(), at(DAY))).toBe('new')
    expect(pickNewIssueId(issues, new Set(['new']), at(DAY))).toBeNull()
    expect(pickNewIssueId(issues, new Set(), at(8 * DAY))).toBeNull()
    expect(pickNewIssueId([], new Set(), at(0))).toBeNull()
  })

  it('열어 본 기록은 호 단위다: 다른 호를 열었다고 이 호가 숨지 않는다', () => {
    const issues = [{ id: 'a', publishedAt: published }]
    expect(pickNewIssueId(issues, new Set(['b']), at(DAY))).toBe('a')
  })
})
