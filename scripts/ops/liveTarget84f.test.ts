/// <reference types="jest" />
/**
 * 84-f ④ 실제 모드 대상 잠금(ROADMAP r141 R141-2 · R140-4). 메모리 저장소 위에서 `generateIssue`를 그대로 돌린다 - 원격 0 · LLM 0.
 * 위임: .claude/state/prompts/phase-7/84-f-dispatch-seed-2025-couple.md
 *
 *  - 로컬 시드 목록(`scripts/ops/out/seed-m2b*.json`)에 있는 커플 id + 별명 "test" 둘 다일 때만 실제 모드가 돈다
 *  - 별명은 test인데 목록에 없는 커플(= 51- 두 폰 커플 경우)은 DB를 읽기 전에 멈춘다 - LLM 0 · 호 행 0
 *  - 멈춤 문구에 커플 id 0(`assertLiveTarget` · `assertTestCouple`)
 */

import { ENTRIES_BUCKET } from '../../supabase/functions/_shared/mediaPath.ts'
import { COUPLE_ID, FIXTURE_YEAR, SEJUN_ID, SEOYOUNG_ID, buildTables } from './fixtures/m1-month/dataset.ts'
import { generateIssue, type GenerateParams, type LiveDeps } from './generateIssue.ts'
import { memoryMedia, memoryStore } from './opsMemoryStore.ts'
import { OpsStopError, assertLiveTarget, assertTestCouple, isSeedListFile, seedListCoupleIds } from './opsGuards.ts'

const AGREED = '2026-01-01T00:00:00+09:00'
const LIVE: GenerateParams = { coupleId: COUPLE_ID, periodStart: `${FIXTURE_YEAR}-09-01`, periodEndExclusive: `${FIXTURE_YEAR}-10-01`, cadence: 'monthly', mode: 'live' }
const SONNET = { provider: 'anthropic', model: 'claude-sonnet-5-5' }

function world(nickname = 'test-51-phone-couple') {
  const tables = buildTables()
  const store = memoryStore({
    tables,
    couple: { id: COUPLE_ID, status: 'active', nickname, members: [{ id: SEJUN_ID, ai_usage_agreed_at: AGREED }, { id: SEOYOUNG_ID, ai_usage_agreed_at: AGREED }] },
    llmProvider: SONNET,
  })
  const media = memoryMedia(tables.data_entries.filter((e) => typeof e.storage_path === 'string').map((e) => `${ENTRIES_BUCKET}/${e.storage_path}`))
  return { store, media }
}

function liveDeps(seedCoupleIds: ReadonlySet<string>) {
  const created: string[] = []
  const deps: LiveDeps = {
    now: () => 1_000_000,
    seedCoupleIds,
    createClient: (config) => {
      created.push(config.model)
      throw new Error('이 시험에서는 LLM 클라이언트를 만들면 안 된다')
    },
  }
  return { deps, created }
}

const list = (couples: unknown[]) => JSON.stringify({ users: [], couples })

describe('84-f 시드 목록 읽기', () => {
  it('seed-m2b*.json만 목록이다 - 실패 기록(.failed.json) · 다른 파일은 아니다', () => {
    expect(isSeedListFile('seed-m2b.json')).toBe(true)
    expect(isSeedListFile('seed-m2b-2025.json')).toBe(true)
    expect(isSeedListFile('seed-m2b-2025.failed.json')).toBe(false)
    expect(isSeedListFile('seed-m2b.failed.json')).toBe(false)
    expect(isSeedListFile('generate-x.json')).toBe(false)
    expect(isSeedListFile('my-seed-m2b.json')).toBe(false)
  })

  it('목록의 커플 중 별명에 test가 있는 id만 모은다 · 깨진 파일은 건너뛴다', () => {
    const ids = seedListCoupleIds([
      { name: 'seed-m2b.json', text: list([{ id: 'a', nickname: 'test-m2b-A' }, { id: 'x', nickname: '실제 커플' }]) },
      { name: 'seed-m2b-2025.json', text: list([{ id: 'g', nickname: 'test-m2b-G' }]) },
      { name: 'seed-m2b-2025.failed.json', text: list([{ id: 'half', nickname: 'test-m2b-G' }]) },
      { name: 'seed-m2b-broken.json', text: '{깨짐' },
      { name: 'other.json', text: list([{ id: 'o', nickname: 'test-o' }]) },
    ])
    expect([...ids].sort()).toEqual(['a', 'g'])
  })
})

describe('84-f 실제 모드 대상 잠금 - 목록 + 별명 둘 다', () => {
  it('목록에 있는 시험 커플 id는 잠금을 지난다(다음 단계인 클라이언트 만들기까지 간다)', async () => {
    const { store, media } = world('test-m2b-G')
    const live = liveDeps(new Set([COUPLE_ID]))
    await expect(generateIssue({ store, media, live: live.deps }, LIVE)).rejects.toThrow('이 시험에서는 LLM 클라이언트를 만들면 안 된다')
    expect(live.created).toEqual(['claude-sonnet-5-5'])
  })

  it('별명은 test인데 목록에 없는 커플(= 51- 폰 커플 경우)은 DB를 읽기 전에 멈춘다 - LLM 0 · 호 행 0 · 문구에 id 0', async () => {
    const { store, media } = world('test-51-phone-couple')
    const live = liveDeps(new Set(['some-other-seed-couple']))
    const err = await generateIssue({ store, media, live: live.deps }, LIVE).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(OpsStopError)
    expect(String((err as Error).message)).toContain('로컬 시드 목록')
    expect(String((err as Error).message)).not.toContain(COUPLE_ID)
    expect(live.created).toEqual([])
    expect(store.issues).toHaveLength(0)
  })

  it('목록이 비어 있으면(파일을 못 읽음) 실제 모드는 늘 멈춘다 - fail-closed', async () => {
    const { store, media } = world('test-m2b-G')
    const live = liveDeps(new Set())
    await expect(generateIssue({ store, media, live: live.deps }, LIVE)).rejects.toBeInstanceOf(OpsStopError)
    expect(live.created).toEqual([])
  })

  it('목록에 있어도 별명에 test가 없으면 멈춘다(둘 다 맞아야 한다) · 문구에 id 0', async () => {
    const { store, media } = world('실제 커플')
    const live = liveDeps(new Set([COUPLE_ID]))
    const err = await generateIssue({ store, media, live: live.deps }, LIVE).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(OpsStopError)
    expect(String((err as Error).message)).not.toContain(COUPLE_ID)
    expect(live.created).toEqual([])
  })

  it('샘플 모드는 잠금을 보지 않는다(기존 그대로 - 별명만)', async () => {
    const { store, media } = world('test-51-phone-couple')
    const report = await generateIssue({ store, media }, { ...LIVE, mode: 'sample' })
    expect(report.mode).toBe('sample')
  })

  it('가드 문구 두 개 모두 id 0', () => {
    expect(() => assertLiveTarget('c-uuid-1234', new Set())).toThrow(OpsStopError)
    try { assertLiveTarget('c-uuid-1234', new Set()) } catch (e) { expect(String(e)).not.toContain('c-uuid-1234') }
    try { assertTestCouple({ id: 'c-uuid-1234', nickname: 'x' }) } catch (e) { expect(String(e)).not.toContain('c-uuid-1234') }
  })
})
