/// <reference types="jest" />
/**
 * 51- ③ 두 폰 커플 실제 모드 길(ROADMAP r143 R143-4 · R141-3 · R140-5). 가짜 DB(메모리 저장소 · 가짜 포트) - 원격 0 · LLM 0.
 * 위임: .claude/state/prompts/phase-7/51-3-dispatch-phone-couple-live.md
 *
 *  ① 두 겹 잠금: 75- 허용 목록에 두 계정 + `--allow-phone-test-couple` 둘 다 · 하나라도 없으면 DB 쓰기 · LLM 전에 멈춤 · 84-f 길 그대로 · 문구에 id · 이메일 0
 *  ② 대상 고르기: 허용 목록 계정들로 이루어진 커플이 정확히 하나일 때만 · 0 · 2개면 개수만
 *  ③ 미리 보기: 쓰기 0 · 출력에 원문 · id 0 · 날짜는 YYYY-MM-DD
 *  ⑤ 한 줄 선택 날짜: 날짜 · 개수만
 */

import { ENTRIES_BUCKET } from '../../supabase/functions/_shared/mediaPath.ts'
import { COUPLE_ID, FIXTURE_YEAR, SEJUN_ID, SEOYOUNG_ID, buildTables } from './fixtures/m1-month/dataset.ts'
import { generateIssue, type GenerateParams, type LiveDeps } from './generateIssue.ts'
import { memoryMedia, memoryStore } from './opsMemoryStore.ts'
import { OpsStopError } from './opsGuards.ts'
import {
  DRY_RUN_FLAG,
  PHONE_TEST_COUPLE_FLAG,
  assertLiveTargetAllowed,
  phoneAllowlistEmails,
  phoneRunKind,
  resolvePhoneTestCouple,
  splitSwitches,
  type PhoneCouplePort,
  type PhoneCoupleRow,
} from './phoneTestCouple.ts'
import { dayCounts, kstDayOf, monthsBetween, previewPhoneCouple } from './phonePreview.ts'
import { sweetSubDateLines, sweetSubDays } from './sweetSubDates.ts'
import type { IssueRow } from './opsStore.ts'

const REF = 'abcdefghijklmnopqrst'
const URL_OK = `https://${REF}.supabase.co`
const A = 'phone-a@example.com'
const B = 'phone-b@example.com'
const C = 'other-c@example.com'
const AGREED = '2026-01-01T00:00:00+09:00'
const SONNET = { provider: 'anthropic', model: 'claude-sonnet-5-5' }
const allowlist = (...emails: string[]) => [`# 75- 목록`, `project=${REF}`, ...emails].join('\n')
const PARAMS: GenerateParams = { coupleId: COUPLE_ID, periodStart: `${FIXTURE_YEAR}-09-01`, periodEndExclusive: `${FIXTURE_YEAR}-10-01`, cadence: 'monthly', mode: 'live' }

/** 이메일 -> 계정 id · 커플 행. 계정 id는 바탕 데이터의 두 사람. */
function port(users: Record<string, string>, couples: PhoneCoupleRow[]): PhoneCouplePort & { reads: number } {
  const p = {
    reads: 0,
    async findUserIds(email: string) {
      p.reads += 1
      return users[email] !== undefined ? [users[email]] : []
    },
    async couplesWithAnyMember(ids: readonly string[]) {
      p.reads += 1
      return couples.filter((c) => ids.includes(c.user_a_id ?? '') || ids.includes(c.user_b_id ?? ''))
    },
  }
  return p
}
const USERS = { [A]: SEJUN_ID, [B]: SEOYOUNG_ID }
const PHONE: PhoneCoupleRow = { id: COUPLE_ID, status: 'active', user_a_id: SEJUN_ID, user_b_id: SEOYOUNG_ID }

function world(nickname = 'test-51-phone', llmProvider: unknown = SONNET) {
  const tables = buildTables()
  const store = memoryStore({
    tables,
    couple: { id: COUPLE_ID, status: 'active', nickname, members: [{ id: SEJUN_ID, ai_usage_agreed_at: AGREED }, { id: SEOYOUNG_ID, ai_usage_agreed_at: AGREED }] },
    llmProvider,
  })
  const media = memoryMedia(tables.data_entries.filter((e) => typeof e.storage_path === 'string').map((e) => `${ENTRIES_BUCKET}/${e.storage_path}`))
  return { tables, store, media }
}

function live(seed: ReadonlySet<string>, phone: string | null) {
  const created: string[] = []
  const deps: LiveDeps = {
    now: () => 1_000_000,
    seedCoupleIds: seed,
    phoneTestCoupleId: phone,
    createClient: (config) => {
      created.push(config.model)
      throw new Error('이 시험에서는 LLM 클라이언트를 만들면 안 된다')
    },
  }
  return { deps, created }
}

/** 멈춤 문구에 id · 이메일 · ref가 없다. */
function clean(message: string) {
  for (const v of [COUPLE_ID, SEJUN_ID, SEOYOUNG_ID, A, B, C, REF]) expect(message).not.toContain(v)
  expect(message).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/)
}

async function stopMessage(p: Promise<unknown> | (() => unknown)): Promise<string> {
  try {
    if (typeof p === 'function') p()
    else await p
  } catch (e) {
    expect(e).toBeInstanceOf(OpsStopError)
    return (e as Error).message
  }
  throw new Error('멈추지 않았다')
}

describe('51- ③ ① 플래그 조합(접속 전)', () => {
  it('값 없는 플래그를 떼어 내고 나머지는 --이름 값 쌍', () => {
    const s = splitSwitches(['--mode', 'live', PHONE_TEST_COUPLE_FLAG, '--period-start', '2026-11-01'], [PHONE_TEST_COUPLE_FLAG, DRY_RUN_FLAG])
    expect(s.rest).toEqual(['--mode', 'live', '--period-start', '2026-11-01'])
    expect([...s.on]).toEqual([PHONE_TEST_COUPLE_FLAG])
    expect(() => splitSwitches([DRY_RUN_FLAG, DRY_RUN_FLAG], [DRY_RUN_FLAG])).toThrow(OpsStopError)
  })

  it('플래그 없음 = 84-f 길 그대로 · --dry-run은 플래그와 함께만', () => {
    expect(phoneRunKind({ allowPhone: false, dryRun: false, mode: 'live', hasCoupleId: true })).toBe('seed')
    expect(phoneRunKind({ allowPhone: false, dryRun: false, mode: undefined, hasCoupleId: true })).toBe('seed')
    expect(() => phoneRunKind({ allowPhone: false, dryRun: true, mode: undefined, hasCoupleId: false })).toThrow(OpsStopError)
  })

  it('플래그 + --couple-id → 멈춤(대상은 허용 목록에서 찾는다) · 플래그 + 샘플 모드 → 멈춤 · 미리 보기는 --mode 없이', () => {
    expect(() => phoneRunKind({ allowPhone: true, dryRun: false, mode: 'live', hasCoupleId: true })).toThrow(/--couple-id를 함께 주지 않는다/)
    expect(() => phoneRunKind({ allowPhone: true, dryRun: false, mode: undefined, hasCoupleId: false })).toThrow(/--mode live 또는/)
    expect(() => phoneRunKind({ allowPhone: true, dryRun: false, mode: 'sample', hasCoupleId: false })).toThrow(OpsStopError)
    expect(() => phoneRunKind({ allowPhone: true, dryRun: true, mode: 'live', hasCoupleId: false })).toThrow(/--mode 없이/)
    expect(phoneRunKind({ allowPhone: true, dryRun: true, mode: undefined, hasCoupleId: false })).toBe('phone_dry_run')
    expect(phoneRunKind({ allowPhone: true, dryRun: false, mode: 'live', hasCoupleId: false })).toBe('phone_live')
  })
})

describe('51- ③ ① 허용 목록(75- 0-6과 같은 파일 · 같은 해석 · 접속 전)', () => {
  it('허용 목록 파일이 없거나 못 읽으면 멈춤', async () => {
    clean(await stopMessage(() => phoneAllowlistEmails(null, URL_OK)))
  })

  it('형식 오류(줄 번호만) · project= 없음 · 접속 주소 ref 불일치 · 이메일 0 → 멈춤', async () => {
    const m1 = await stopMessage(() => phoneAllowlistEmails(`project=${REF}\nnot-an-email`, URL_OK))
    expect(m1).toBe('허용 목록 파일 형식 오류 (2번째 줄)')
    clean(await stopMessage(() => phoneAllowlistEmails(A, URL_OK)))
    clean(await stopMessage(() => phoneAllowlistEmails(allowlist(A, B), 'https://zzzzzzzzzzzzzzzzzzzz.supabase.co')))
    clean(await stopMessage(() => phoneAllowlistEmails(allowlist(), URL_OK)))
  })

  it('통과하면 목록 이메일(소문자)을 돌려준다', () => {
    expect(phoneAllowlistEmails(allowlist('Phone-B@Example.com', A), URL_OK)).toEqual([A, B])
  })
})

describe('51- ③ ② 대상 고르기 - id를 치지 않게', () => {
  it('두 계정이 모두 목록에 있는 커플 1개 → 그 커플', async () => {
    expect(await resolvePhoneTestCouple(port(USERS, [PHONE]), [A, B])).toBe(COUPLE_ID)
  })

  it('0개 → 멈춤(개수만) - 계정 없음 · 한 계정만 목록에 · 해제 끝난 커플', async () => {
    clean(await stopMessage(resolvePhoneTestCouple(port({}, [PHONE]), [A, B])))
    // 한 계정만 목록에: 목록에는 A뿐 → 커플의 B가 목록 밖 → 후보 0
    const one = await stopMessage(resolvePhoneTestCouple(port(USERS, [PHONE]), [A]))
    expect(one).toBe('두 계정이 모두 허용 목록에 있는 커플이 0개다 - 정확히 1개일 때만 진행한다')
    clean(one)
    expect(await stopMessage(resolvePhoneTestCouple(port(USERS, [{ ...PHONE, status: 'dissolved' }]), [A, B]))).toContain('0개')
  })

  it('2개 → 멈춤(개수만)', async () => {
    const users = { ...USERS, [C]: 'user-c' }
    const two = [PHONE, { id: 'couple-2', status: 'pending', user_a_id: SEJUN_ID, user_b_id: 'user-c' }]
    const m = await stopMessage(resolvePhoneTestCouple(port(users, two), [A, B, C]))
    expect(m).toBe('두 계정이 모두 허용 목록에 있는 커플이 2개다 - 정확히 1개일 때만 진행한다')
    clean(m)
    expect(m).not.toContain('couple-2')
  })
})

describe('51- ③ ① 실제 모드 대상 잠금 - generateIssue(가짜 DB · LLM 0)', () => {
  it('목록만(플래그 없음) → 84-f 길: 시드 목록 밖이라 DB를 읽기 전에 멈춤 · 호 행 0 · LLM 0', async () => {
    const { store, media } = world()
    const { deps, created } = live(new Set(), null)
    const m = await stopMessage(generateIssue({ store, media, live: deps }, PARAMS))
    expect(m).toContain('로컬 시드 목록')
    clean(m)
    expect(store.issues).toHaveLength(0)
    expect(store.corners).toHaveLength(0)
    expect(created).toHaveLength(0)
  })

  it('플래그만(목록에 계정 없음) → 대상 커플 0개로 멈춤 - generateIssue까지 가지 않는다', async () => {
    const m = await stopMessage(resolvePhoneTestCouple(port(USERS, [PHONE]), [C]))
    expect(m).toContain('0개')
  })

  it('둘 다 → 잠금 통과: 다음 확인(모델 설정)까지 간다 · 그 전에 호 행 0 · LLM 0', async () => {
    const { store, media } = world('test-51-phone', null)
    const id = await resolvePhoneTestCouple(port(USERS, [PHONE]), [A, B])
    const { deps, created } = live(new Set(), id)
    const m = await stopMessage(generateIssue({ store, media, live: deps }, { ...PARAMS, coupleId: id }))
    expect(m).toContain('모델 설정이 생성을 허용하지 않는다')
    expect(store.issues).toHaveLength(0)
    expect(created).toHaveLength(0)
  })

  it('둘 다 + 별명 "test" 검사는 그대로 - 별명이 아니면 멈춤', async () => {
    const { store, media } = world('우리 커플')
    const { deps, created } = live(new Set(), COUPLE_ID)
    const m = await stopMessage(generateIssue({ store, media, live: deps }, PARAMS))
    expect(m).toContain("'test'")
    clean(m)
    expect(store.issues).toHaveLength(0)
    expect(created).toHaveLength(0)
  })

  it('시드 목록 길은 그대로 · 두 길을 섞지 않는다', () => {
    expect(() => assertLiveTargetAllowed('seed-g', new Set(['seed-g']), null)).not.toThrow()
    expect(() => assertLiveTargetAllowed('seed-g', new Set(['seed-g']), undefined)).not.toThrow()
    expect(() => assertLiveTargetAllowed('phone', new Set(['seed-g']), null)).toThrow(/로컬 시드 목록/)
    // 플래그 실행(폰 커플 id가 있음)에서 시드 커플을 대상으로 주면 멈춤
    expect(() => assertLiveTargetAllowed('seed-g', new Set(['seed-g']), 'phone')).toThrow(/허용 목록으로 찾은 커플이 아니다/)
    expect(() => assertLiveTargetAllowed('phone', new Set(), 'phone')).not.toThrow()
  })
})

describe('51- ③ ③ 미리 보기 - 쓰기 0 · LLM 0', () => {
  it('기간 후보(달) · 날짜별 개수 · 선행 검사 결과만 - 원문 · id · 이메일 0 · 쓰기 0', async () => {
    const { tables, store } = world()
    const lines = await previewPhoneCouple(store, { activityRange: async () => ({ first: `${FIXTURE_YEAR}-09-01`, last: `${FIXTURE_YEAR}-09-30` }) }, COUPLE_ID)
    const text = lines.join('\n')
    expect(text).toContain('선행 검사(P0): 별명 test 표시 있음 · 상태 active · AI 동의 2/2 -> 통과')
    expect(text).toContain('모델 설정(app_config.llm_provider): 허용 - claude-sonnet-5-5')
    expect(text).toContain(`## ${FIXTURE_YEAR}-09 - 기간 ${FIXTURE_YEAR}-09-01 ~ ${FIXTURE_YEAR}-09-30 (--period-start ${FIXTURE_YEAR}-09-01 --period-end ${FIXTURE_YEAR}-10-01)`)
    expect(text).toContain('- 그 달 호: 없음(새로 만든다)')
    expect(text).toMatch(/- 다정한 말들: 재료 있음 · 추정 입력 토큰 \d+ \(상한 40000 이내\)/)
    // 날짜별 줄은 YYYY-MM-DD + 숫자만
    const dayLines = lines.filter((l) => l.startsWith('  '))
    expect(dayLines.length).toBeGreaterThan(5)
    for (const l of dayLines) expect(l).toMatch(/^ {2}\d{4}-\d{2}-\d{2} {2}메시지 \d+ · 데이트 \d+ · 사진 \d+$/)
    expect(text).toContain(`${FIXTURE_YEAR}-09-16  메시지 `) // 다툰 날도 개수만(표시 0)
    expect(text).not.toMatch(/다툼|다툰|conflict/)
    // 원문 · 이름 · id 0
    for (const m of tables.messages) if (String(m.body).length >= 6) expect(text).not.toContain(String(m.body))
    for (const row of [...tables.messages, ...tables.dates, ...tables.data_entries]) expect(text).not.toContain(String(row.id))
    clean(text)
    // 쓰기 0
    expect(store.issues).toHaveLength(0)
    expect(store.corners).toHaveLength(0)
    expect(store.alerts).toHaveLength(0)
  })

  it('합계 = 날짜별 합 · 입력 조립 결과와 같다', async () => {
    const { store } = world()
    const lines = await previewPhoneCouple(store, { activityRange: async () => ({ first: `${FIXTURE_YEAR}-09-03`, last: `${FIXTURE_YEAR}-09-20` }) }, COUPLE_ID)
    const total = /- 합계: 메시지 (\d+) · 데이트 (\d+) · 사진 (\d+)/.exec(lines.join('\n'))
    const sums = lines.filter((l) => /^ {2}\d/.test(l)).map((l) => /메시지 (\d+) · 데이트 (\d+) · 사진 (\d+)/.exec(l)!.slice(1).map(Number))
    expect(total).not.toBeNull()
    expect([0, 1, 2].map((i) => sums.reduce((n, s) => n + s[i], 0))).toEqual(total!.slice(1).map(Number))
  })

  it('선행 검사 실패도 결과만 - 별명 · 모델 거부 · 발행된 달 · 기록 0', async () => {
    const { store } = world('우리 커플', null)
    store.issues.push({ id: 'i-1', couple_id: COUPLE_ID, issue_type: 'monthly', period_start: `${FIXTURE_YEAR}-09-01`, published_at: '2025-10-02T00:00:00Z' } as unknown as IssueRow)
    const text = (await previewPhoneCouple(store, { activityRange: async () => ({ first: `${FIXTURE_YEAR}-09-05`, last: `${FIXTURE_YEAR}-09-05` }) }, COUPLE_ID)).join('\n')
    expect(text).toContain("생성은 멈춘다(별명에 'test' 없음)")
    expect(text).toMatch(/모델 설정\(app_config.llm_provider\): 거부 코드 \d+/)
    expect(text).toContain('발행됨 - 다시 생성하지 않는다(멈춤)')
    expect(text).not.toContain('i-1')
    const empty = await previewPhoneCouple(world().store, { activityRange: async () => ({ first: null, last: null }) }, COUPLE_ID)
    expect(empty.at(-1)).toBe('기록 범위: 기록 0 - 기간 후보 없음')
  })

  it('달 목록 · KST 날짜', () => {
    expect(monthsBetween('2025-11-28', '2026-02-01')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(monthsBetween('2020-01-01', '2026-12-31')).toHaveLength(24)
    expect(kstDayOf(new Date('2026-11-19T15:30:00Z'))).toBe('2026-11-20')
    expect(dayCounts({ messages: [], photos: [], dates: [], records: [], exclusions: {} as never })).toEqual([])
  })
})

describe('51- ③ ⑤ 한 줄 선택 날짜 - 날짜 · 개수만', () => {
  const content = {
    payload: {
      main: [{ context: '정황', turns: [{ messageId: 'm-main', text: '대화 원문' }] }],
      sub: [
        { messageId: 'm-2', attribution: { display: 'x', at: '2026-11-20T23:30:00+09:00', source: 'chat' }, speaker: '이름', text: '두 번째 원문' },
        { messageId: 'm-1', attribution: { display: 'x', at: '2026-11-19T08:00:00+09:00', source: 'chat' }, speaker: '이름', text: '첫 원문' },
        { messageId: 'm-3', attribution: { display: 'x', at: 'not a time', source: 'chat' }, speaker: '이름', text: '깨진 항목' },
      ],
    },
  }

  it('sub의 보낸 날(KST) · 시각 순 · 대화(main)는 세지 않는다 · 깨진 항목은 건너뜀', () => {
    expect(sweetSubDays(content)).toEqual(['2026-11-19', '2026-11-20'])
    expect(sweetSubDays(null)).toEqual([])
    expect(sweetSubDays({ payload: {} })).toEqual([])
  })

  function fakeStore(published: string | null, nickname = 'test-51-phone', status = 'published') {
    return {
      async getIssue() {
        return { id: 'issue-x', couple_id: COUPLE_ID, published_at: published } as unknown as IssueRow
      },
      async getCouple() {
        return { id: COUPLE_ID, status: 'active', nickname, members: [] }
      },
      async listCorners() {
        return [{ id: 'c-1', corner_type: 'sweet_words', status, content }] as never
      },
    }
  }

  it('발행된 호 → 개수 + 날짜 줄만(원문 · 이름 · id 0)', async () => {
    const lines = await sweetSubDateLines(fakeStore('2026-11-21T00:00:00Z'), 'issue-x')
    expect(lines).toEqual(['다정한 말 한 줄 선택 2개 - 보낸 날(KST, 시각 순):', '  2026-11-19', '  2026-11-20'])
    const text = lines.join('\n')
    for (const v of ['원문', '이름', 'm-1', 'm-2', 'issue-x', 'c-1', COUPLE_ID]) expect(text).not.toContain(v)
  })

  it('발행 전 호 · 시험 커플 아님 → 멈춤 · 코너가 발행 안 됨 → 0개', async () => {
    expect(await stopMessage(sweetSubDateLines(fakeStore(null), 'issue-x'))).toContain('아직 발행되지 않은 호')
    expect(await stopMessage(sweetSubDateLines(fakeStore('2026-11-21T00:00:00Z', '우리 커플'), 'issue-x'))).toContain("'test'")
    expect(await sweetSubDateLines(fakeStore('2026-11-21T00:00:00Z', 'test-51-phone', 'ready'), 'issue-x')).toEqual(['다정한 말 코너가 발행되지 않았다 - 한 줄 선택 0개 (유성 후보 0)'])
  })
})
