import * as fs from 'fs'
import * as path from 'path'
import type { ChatMetrics } from '../../src/engine/chatMetrics'
import type { PersonProfile } from '../../src/engine/coupleProfile'
import { DNA_BASE_COEFFICIENTS, DNA_COEFF_VERSION_BASE_ONLY, computeLoveDnaFacts } from '../../src/engine/loveDna'
import { ROUGH_GUESS_V0, computeRoughGuess, durationLabel, fnv1a32, selectMonthlyTopic } from '../../src/engine/roughGuess'
import { ROUGH_GUESS_TOPICS } from '../../src/constants/roughGuessTopics'
import {
  choosePhotoBreaks,
  choosePostcards,
  colophonFacts,
  monthCalendar,
  nextMonthFacts,
  nextMonthOf,
  relationshipMilestonesInMonth,
  type PhotoCandidate,
} from '../../src/engine/issueSupplements'
import { computeDaysTogetherKst, getMilestoneStatus } from '../../src/utils/relationshipDays'

/** 2.0-A1 ② ③ ④ ⑤ 엔진 - 합성 성격 데이터(실제 사람 0). */

function person(over: Partial<PersonProfile> & { name: string }): PersonProfile {
  return {
    userId: `u-${over.name}`,
    labelKo: '예시 라벨',
    enneagramCore: 9,
    mbti: 'INFP',
    bigFive: { o: 50, c: 50, e: 50, a: 50, n: 50 },
    sternberg: { intimacy: 50, passion: 50, commitment: 50 },
    attachAnxiety: 50,
    attachAvoidance: 50,
    attachment: 'secure',
    ...over,
  }
}

const GARAM = person({ name: '가람', enneagramCore: 7, mbti: 'ENTJ', bigFive: { o: 70, c: 80, e: 90, a: 40, n: 30 }, sternberg: { intimacy: 60, passion: 90, commitment: 80 } })
const NARAE = person({ name: '나래', enneagramCore: 5, mbti: 'INFP', bigFive: { o: 60, c: 30, e: 20, a: 80, n: 60 }, sternberg: { intimacy: 70, passion: 40, commitment: 50 }, attachAvoidance: 70, attachment: 'avoidant' })

function metrics(over: Partial<ChatMetrics> = {}): ChatMetrics {
  return {
    version: 'chat_metrics_v0',
    messageCount: 120,
    sessionCount: 20,
    replyGap: { all: { count: 50, q1: 30, median: 120, q3: 600 }, byResponder: { a: { count: 25, q1: 20, median: 48, q3: 100 }, b: { count: 25, q1: 60, median: 720, q3: 900 } } },
    turnTaking: 0.5,
    initiator: { a: 0.58, b: 0.42 },
    emoji: { a: 0.3, b: 0.35 },
    busiestDay: { date: '2026-09-14', count: 40 },
    ...over,
  }
}

describe('③ 어림짐작', () => {
  const ok = computeRoughGuess({ profiles: { a: GARAM, b: NARAE }, metrics: metrics(), coupleId: 'couple-x', period: '2026-09' })

  it('8항목: 추정 1~3 · 실측 4~6 · 7(날짜) · 8(주제) - source로 구분', () => {
    if (!ok.ok) throw new Error('skip')
    expect(ok.facts.items.map((i) => [i.no, i.source])).toEqual([
      [1, 'estimate'],
      [2, 'estimate'],
      [3, 'estimate'],
      [4, 'measured'],
      [5, 'measured'],
      [6, 'measured'],
    ])
    expect(ok.facts.busiestDay).toEqual({ no: 7, date: '2026-09-14', count: 40, source: 'measured' })
    expect(ok.facts.monthlyTopic.item.source).toBe('estimate')
    expect(ok.facts.disclaimer).toBe('재미로만 봐주세요. 진짜로 재는 건 아닙니다.')
  })

  it('1번 v0 식: P(A) = 50 + 50(s_A − s_B) · 50 미만은 주어를 바꾼다', () => {
    if (!ok.ok) throw new Error('skip')
    // 가람 s = (0.9 + 1 + 0.9)/3 · 나래 s = (0.2 + 0 + 0.4)/3 -> 50 + 50 × 2.2/3 = 86.67 -> 87
    expect(ok.facts.items[0]).toMatchObject({ subject: '가람', percent: 87, similar: false, line: '가람님이 먼저 고백했을 확률 87%' })
    // 2번 갈등 회피: 가람 (0.4 + 0.5 + 0)/3 · 나래 (0.8 + 0.7 + 1)/3 -> P(가람) = 50 + 50(0.3 − 0.8333) = 23.3 -> 나래 77
    expect(ok.facts.items[1]).toMatchObject({ subject: '나래', percent: 77 })
  })

  it('비슷함: 차이 10%p 미만 -> "비슷합니다"(이모지 30% · 35%) · 10%p면 아님', () => {
    if (!ok.ok) throw new Error('skip')
    const emoji = ok.facts.items.find((i) => i.no === 6)
    expect(emoji).toMatchObject({ similar: true, subject: null, line: '가람님과 나래님이 비슷합니다' })
    const talk = ok.facts.items.find((i) => i.no === 5)
    expect(talk).toMatchObject({ similar: false, subject: '가람', line: '먼저 말을 거는 쪽 — 가람님' }) // 58 · 42 = 16%p
    const edge = computeRoughGuess({ profiles: { a: GARAM, b: NARAE }, metrics: metrics({ initiator: { a: 0.55, b: 0.45 } }), coupleId: 'c', period: '2026-09' })
    if (!edge.ok) throw new Error('skip')
    expect(edge.facts.items.find((i) => i.no === 5)?.similar).toBe(false) // 55 · 45 = 10%p - 미만이 아님
  })

  it('같은 성격이면 확률 항목은 비슷합니다(50)', () => {
    const same = computeRoughGuess({ profiles: { a: GARAM, b: { ...GARAM, name: '나래' } }, metrics: metrics(), coupleId: 'c', period: '2026-09' })
    if (!same.ok) throw new Error('skip')
    expect(same.facts.items[0]).toMatchObject({ similar: true, percent: null, subject: null })
  })

  it('4번 답장 속도 = 답한 사람별 중앙값 · 상대 차이 10% 미만이면 비슷', () => {
    if (!ok.ok) throw new Error('skip')
    expect(ok.facts.items.find((i) => i.no === 4)).toMatchObject({ kind: 'compare', line: '가람님 48초 · 나래님 12분', subject: '가람' })
    expect(durationLabel(48)).toBe('48초')
    expect(durationLabel(3900)).toBe('1시간 5분')
    expect(durationLabel(7200)).toBe('2시간')
  })

  it('지표가 없으면 그 항목만 빠진다', () => {
    const r = computeRoughGuess({ profiles: { a: GARAM, b: NARAE }, metrics: metrics({ emoji: { a: 0.2, b: null } }), coupleId: 'c', period: '2026-09' })
    if (!r.ok) throw new Error('skip')
    expect(r.facts.items.map((i) => i.no)).toEqual([1, 2, 3, 4, 5])
  })

  it('빠짐: 성격 데이터 한쪽 없음 -> no_personality · 채팅 30건 미만 -> little_chat', () => {
    expect(computeRoughGuess({ profiles: { a: GARAM, b: null }, metrics: metrics(), coupleId: 'c', period: '2026-09' })).toEqual({ ok: false, skip: 'no_personality' })
    expect(computeRoughGuess({ profiles: { a: GARAM, b: NARAE }, metrics: metrics({ messageCount: ROUGH_GUESS_V0.minMessages - 1 }), coupleId: 'c', period: '2026-09' })).toEqual({ ok: false, skip: 'little_chat' })
  })

  it('8번 주제 = fnv1a32(couple_id + period) % 12 - 결정론 · 커플마다 다름', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5)
    expect(fnv1a32('a')).toBe(0xe40c292c) // FNV-1a 32 공개 시험값
    const t1 = selectMonthlyTopic('couple-x', '2026-09')
    expect(selectMonthlyTopic('couple-x', '2026-09')).toBe(t1)
    expect(t1).toBe(ROUGH_GUESS_TOPICS[fnv1a32('couple-x2026-09') % 12])
    const ids = new Set(Array.from({ length: 12 }, (_, i) => selectMonthlyTopic('couple-x', `2026-${String(i + 1).padStart(2, '0')}`).id))
    expect(ids.size).toBeGreaterThan(1)
    expect(ROUGH_GUESS_TOPICS.map((t) => t.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('결정론: 두 번 계산 같음', () => {
    const args = { profiles: { a: GARAM, b: NARAE }, metrics: metrics(), coupleId: 'couple-x', period: '2026-09' }
    expect(computeRoughGuess(args)).toEqual(computeRoughGuess(args))
  })
})

describe('② 두 사람의 결 - 숫자 칸', () => {
  it('기저만(채팅 반영 전): total = base · chatDelta null · coeffVersion dna_base_only · 첫 호', () => {
    const r = computeLoveDnaFacts({ a: GARAM, b: NARAE }, null)
    if (!r.ok) throw new Error('skip')
    expect([61, 65, 69]).toContain(r.facts.score.base)
    expect(r.facts.score).toMatchObject({ chatDelta: null, chatApplied: false, total: r.facts.score.base, coeffVersion: DNA_COEFF_VERSION_BASE_ONLY, previousTotal: null, delta: null, firstIssue: true })
    expect(DNA_BASE_COEFFICIENTS).toEqual({ contrast: 61, neutral: 65, best: 69 })
  })

  it('지난 호 대비 = total − 지난 코너 값', () => {
    const r = computeLoveDnaFacts({ a: GARAM, b: NARAE }, 60.5)
    if (!r.ok) throw new Error('skip')
    expect(r.facts.score.delta).toBe(Math.round((r.facts.score.total - 60.5) * 100) / 100)
    expect(r.facts.score.firstIssue).toBe(false)
  })

  it('빅5 차이 · 가까움(15 미만)/다름 · 스턴버그 겹침 = 작은 값', () => {
    const r = computeLoveDnaFacts({ a: GARAM, b: NARAE }, null)
    if (!r.ok) throw new Error('skip')
    expect(r.facts.bigFive.map((x) => [x.key, x.gap, x.relation])).toEqual([
      ['o', 10, 'close'],
      ['c', 50, 'apart'],
      ['e', 70, 'apart'],
      ['a', 40, 'apart'],
      ['n', 30, 'apart'],
    ])
    expect(r.facts.sternberg.passion).toEqual({ a: 90, b: 40, shared: 40 })
  })

  it('실행 팁은 60 이하에서만 - 기저만으로는 늘 61 이상이라 꺼져 있다', () => {
    const r = computeLoveDnaFacts({ a: GARAM, b: NARAE }, null)
    if (!r.ok) throw new Error('skip')
    expect(r.facts.actionTipsAllowed).toBe(false)
  })

  it('한쪽이라도 성격 데이터가 없으면 빠짐', () => {
    expect(computeLoveDnaFacts({ a: null, b: NARAE }, null)).toEqual({ ok: false, skip: 'no_personality' })
  })

  it('UNRESOLVED chatDelta를 부르지 않는다(throw 없음) - ⑨ 승인 전', () => {
    expect(() => computeLoveDnaFacts({ a: GARAM, b: NARAE }, null)).not.toThrow()
  })
})

describe('④ 부록 · ⑤ 부속', () => {
  it('관계 기념일만 - 앱(relationshipDays)과 같은 날 세기 · 100일 단위 · 365일 단위', () => {
    // 사귄 날 2024-06-01 = 1일째 -> 500일 = 2025-10-13 · 1주년(365일) = 2025-05-31
    expect(relationshipMilestonesInMonth('2024-06-01', '2025-10')).toEqual([{ date: '2025-10-13', label: '500일' }])
    expect(relationshipMilestonesInMonth('2024-06-01', '2025-05')).toEqual([{ date: '2025-05-31', label: '1주년' }])
    expect(computeDaysTogetherKst('2024-06-01', new Date('2025-10-13T12:00:00+09:00'))).toBe(500)
    expect(getMilestoneStatus(365).label).toBe('1주년')
  })

  it('사귄 날짜가 없으면 달력만(표시 0)', () => {
    expect(monthCalendar('2025-10', null)).toEqual({ month: '2025-10', year: 2025, monthNumber: 10, days: 31, firstWeekday: 3, marks: [] })
    expect(monthCalendar('2024-02', null).days).toBe(29)
    expect(nextMonthOf('2025-12-31')).toBe('2026-01')
  })

  it('생일은 0 - 엔진 · 입력 조립이 birth_date를 읽지 않는다(R157-6)', () => {
    const root = path.join(__dirname, '../..')
    for (const f of ['src/engine/issueSupplements.ts', 'src/engine/roughGuess.ts', 'src/engine/loveDna.ts', 'supabase/functions/_shared/extrasAssembly.ts', 'scripts/ops/generateIssue.ts']) {
      const code = fs.readFileSync(path.join(root, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
      expect(code).not.toMatch(/birth_date|birthDate|생일/)
    }
  })

  const photo = (id: string, at: string, over: Partial<PhotoCandidate> = {}): PhotoCandidate => ({
    entryId: id,
    path: `c/i/${id}.jpg`,
    width: 1600,
    height: 1200,
    capturedAt: `${at}+09:00`,
    hasLocation: false,
    note: null,
    placeName: null,
    ...over,
  })

  it('엽서 = 그달 첫 · 마지막 사진(위치 정보 있는 사진 제외) · 1장이면 1장 · 0장이면 없음', () => {
    const ps = [photo('p3', '2025-09-20T10:00:00'), photo('p1', '2025-09-02T10:00:00'), photo('p2', '2025-09-10T10:00:00'), photo('p9', '2025-09-30T10:00:00', { hasLocation: true })]
    expect(choosePostcards(ps).map((p) => p.path)).toEqual(['c/i/p1.jpg', 'c/i/p3.jpg'])
    expect(choosePostcards([photo('p1', '2025-09-02T10:00:00')])).toHaveLength(1)
    expect(choosePostcards([])).toEqual([])
  })

  it('사진 한 장 = 엽서 아닌 사진 중 다른 코너에 안 실린 것 먼저 · 캡션 = 사용자 글 원문 → 날짜 · 장소', () => {
    const ps = [
      photo('p1', '2025-09-02T10:00:00'),
      photo('p2', '2025-09-05T10:00:00', { note: '  첫눈 온 날, 자르지 않는 원문입니다  ' }),
      photo('p3', '2025-09-07T10:00:00', { placeName: '예시 공원' }),
      photo('p4', '2025-09-30T10:00:00'),
    ]
    const cards = choosePostcards(ps)
    const breaks = choosePhotoBreaks(ps, cards, new Set(['c/i/p2.jpg']))
    expect(breaks.map((b) => [b.photo.path, b.caption, b.captionSource])).toEqual([
      ['c/i/p3.jpg', '09.07 · 예시 공원', 'date_place'],
      ['c/i/p2.jpg', '  첫눈 온 날, 자르지 않는 원문입니다  ', 'note'],
    ])
  })

  it('「다음 달」: 기념일이 있으면 사실만 · 없으면 면이 빠진다(null) · 열릴 코너 0', () => {
    expect(nextMonthFacts('2025-09-30', '2024-06-01')).toEqual({ month: '2025-10', monthNumber: 10, milestones: [{ date: '2025-10-13', label: '500일' }], openingCorners: [] })
    expect(nextMonthFacts('2025-10-31', '2024-06-01')).toBeNull()
    expect(nextMonthFacts('2025-09-30', null)).toBeNull()
  })

  it('판권: 호 라벨 · 정정 창구 경로 · 문의 메일은 호출부가 넘긴 값 그대로', () => {
    expect(colophonFacts({ periodStart: '2025-09-01', periodEnd: '2025-09-30', editionNumber: 3, names: ['세준', '서영'], nickname: null, contactEmail: 'x@example.invalid' })).toEqual({
      editionLabel: '2025년 9월호',
      editionNumber: 3,
      periodStart: '2025-09-01',
      periodEnd: '2025-09-30',
      maker: '온도록',
      names: '세준 · 서영',
      nickname: null,
      correction: { path: '설정 › 문의', email: 'x@example.invalid' },
    })
  })
})
