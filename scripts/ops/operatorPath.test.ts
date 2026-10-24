/// <reference types="jest" />
/**
 * 운영자 경로 (M2-b) 시험 - 위임: .claude/state/prompts/phase-7/54-corner-pipeline-operator-path.md
 *
 * 메모리 저장소 위에서 `generateSampleIssue`·`publishIssue`를 그대로 돌린다. 검증기·골격·코너는 고치지 않은 실제 코드다 -
 * 샘플 JSON이 그 검증기를 통과해야 코너가 `ready`가 된다.
 */

import { INPUT_TOKEN_STOP_BAND, INPUT_TOKEN_STOP_LIMIT, estimateRequestTokens } from '../../supabase/functions/_shared/tokenEstimate.ts'
import { assembleCornerInput } from '../../supabase/functions/_shared/inputAssembly.ts'
import { MAGAZINE_BUCKET, ENTRIES_BUCKET, parseMagazineMediaPath } from '../../supabase/functions/_shared/mediaPath.ts'
import { thisMonthModule } from '../../supabase/functions/_shared/corners/thisMonth.ts'
import { sweetWordsModule } from '../../supabase/functions/_shared/corners/sweetWords.ts'
import { COUPLE_ID, PERIOD, SEJUN_ID, SEOYOUNG_ID, buildTables } from './fixtures/m1-month/dataset.ts'
import { CORNER_TABLE, generateSampleIssue, inclusiveEndDate, type GenerateParams } from './generateIssue.ts'
import { mediaPathsOf } from './mediaCopy.ts'
import { memoryMedia, memoryStore } from './opsMemoryStore.ts'
import {
  OpsStopError,
  assertDevelopmentProject,
  assertTestCouple,
  parseLinkedProject,
  redactSecrets,
} from './opsGuards.ts'
import { publishIssue } from './publishIssue.ts'
import { SAMPLE_ENGINE_VERSION } from './sampleOutputs.ts'

const AGREED = '2026-01-01T00:00:00+09:00'
const PARAMS: GenerateParams = {
  coupleId: COUPLE_ID,
  periodStart: '2026-09-01',
  periodEndExclusive: '2026-10-01',
  cadence: 'monthly',
}

const testCouple = (over: Partial<{ status: string; nickname: string | null; agreed: boolean }> = {}) => ({
  id: COUPLE_ID,
  status: over.status ?? 'active',
  nickname: over.nickname === undefined ? 'test-m2b-couple' : over.nickname,
  members: [
    { id: SEJUN_ID, ai_usage_agreed_at: AGREED },
    { id: SEOYOUNG_ID, ai_usage_agreed_at: over.agreed === false ? null : AGREED },
  ],
})

function datasetWorld(tables = buildTables(), couple = testCouple()) {
  const store = memoryStore({ tables, couple })
  const sources = tables.data_entries
    .filter((e) => typeof e.storage_path === 'string')
    .map((e) => `${ENTRIES_BUCKET}/${e.storage_path}`)
  const media = memoryMedia(sources)
  return { store, media, tables }
}

describe('생성 - 샘플 출력 모드, 기존 검증기 그대로', () => {
  it('시험 데이터 한 달: 코너 3종이 ready가 되고 미디어가 목적지로 복제된다', async () => {
    const { store, media } = datasetWorld()
    const report = await generateSampleIssue({ store, media }, PARAMS)

    expect(report.mode).toBe('sample')
    expect(report.realApiCalls).toBe(0)
    expect(report.corners.map((c) => [c.cornerType, c.outcome])).toEqual([
      ['date_archive', 'ready'],
      ['sweet_words', 'ready'],
      ['this_month', 'ready'],
    ])
    // P0: 초안 행, 압축 모드, 번호 없음 / 기간의 끝은 포함 날짜
    expect(store.issues).toHaveLength(1)
    expect(store.issues[0]).toMatchObject({ publish_mode: 'compressed', published_at: null, issue_number: null, period_end: '2026-09-30' })
    // 저장: 샘플 표시와 요청 수 0
    for (const c of store.corners) {
      expect(c.status).toBe('ready')
      expect(c.engine_version).toBe(SAMPLE_ENGINE_VERSION)
      expect(c.generation_attempts).toBe(0)
    }
    // 17-0-10-E: 실린 데이트는 17-1 코너의 source_date_ids
    const archive = store.corners.find((c) => c.corner_type === 'date_archive')
    expect([...(archive?.source_date_ids ?? [])].sort()).toEqual(['date-0913', 'date-0927', 'date-2025-0920'])

    // P7: content의 모든 사진 경로가 목적지에 있고, 경로는 {couple}/{issue}/{entry}.{ext}
    const paths = store.corners.flatMap((c) => mediaPathsOf(c.corner_type, c.content))
    expect(paths.length).toBeGreaterThan(0)
    for (const p of paths) {
      expect(parseMagazineMediaPath(p)).toMatchObject({ coupleId: COUPLE_ID, issueId: report.issueId })
      expect(media.objects.has(`${MAGAZINE_BUCKET}/${p}`)).toBe(true)
    }
    expect(report.media.copied).toBe(new Set(paths).size)
    expect(report.media.missingSources).toEqual([])
    // 제외 건수와 추정 토큰이 보고에 있다
    expect(report.exclusions).toEqual(expect.objectContaining({ trivialMessages: 0, messagesWithoutBody: 0 }))
    for (const c of report.corners) expect(c.estimatedInputTokens).toBeGreaterThan(0)
  })

  it('다시 돌려도 같다 - 초안 행·코너 행이 늘지 않고, 성공한 코너는 다시 만들지 않으며, 복제는 건너뛴다', async () => {
    const { store, media } = datasetWorld()
    await generateSampleIssue({ store, media }, PARAMS)
    const second = await generateSampleIssue({ store, media }, PARAMS)
    expect(store.issues).toHaveLength(1)
    expect(store.corners).toHaveLength(3)
    expect(second.issueCreated).toBe(false)
    expect(second.corners.every((c) => c.outcome === 'kept_ready')).toBe(true)
    expect(second.media.copied).toBe(0)
    expect(second.media.alreadyPresent).toBeGreaterThan(0)
  })

  it('저장된 content의 사진 경로는 입력 조립이 처음부터 싣은 경로 그대로다 - 저장 뒤에 고치지 않는다', async () => {
    const { store, media, tables } = datasetWorld()
    const report = await generateSampleIssue({ store, media }, PARAMS)
    const assembled = await assembleCornerInput(
      memoryStore({ tables, couple: testCouple() }).assemblyClient,
      { coupleId: COUPLE_ID, period: PERIOD, cadence: 'monthly' },
      report.issueId,
    )
    const fromInput = new Set([
      ...assembled.photos.map((p) => p.source.path),
      ...assembled.dates.flatMap((d) => d.source.stops.flatMap((s) => s.photos.map((p) => p.path))),
    ])
    const saved = store.corners.flatMap((c) => mediaPathsOf(c.corner_type, c.content))
    for (const p of saved) expect(fromInput.has(p)).toBe(true)
  })

  it('재료가 없는 코너는 만들지 않는다 - 호출 전 선행 검사로 skipped(insufficient_input)', async () => {
    const empty = { ...buildTables(), messages: [], dates: [], date_stops: [], data_entries: [] }
    const { store, media } = datasetWorld(empty)
    const report = await generateSampleIssue({ store, media }, PARAMS)
    expect(report.corners.map((c) => c.outcome)).toEqual([
      'skipped_insufficient_input',
      'skipped_insufficient_input',
      'skipped_insufficient_input',
    ])
    expect(report.corners.every((c) => c.sampleResponses === 0)).toBe(true)
    expect(store.corners.every((c) => c.status === 'skipped' && c.skip_reason === 'insufficient_input')).toBe(true)
  })

  it('샘플 출력은 입력이 바뀌어도(코너마다) 기존 검증기를 통과한다 - 입력 한 건짜리도', async () => {
    const t = buildTables()
    const tiny = {
      ...t,
      messages: t.messages.slice(0, 1),
      dates: t.dates.filter((d) => d.id === 'date-0927'),
      date_stops: t.date_stops.filter((s) => s.date_id === 'date-0927'),
      data_entries: t.data_entries.filter((e) => e.date_id === 'date-0927'),
    }
    const { store, media } = datasetWorld(tiny)
    const report = await generateSampleIssue({ store, media }, PARAMS)
    // 17-1은 재소환까지 거쳐 기사가 되고, 17-4·17-5는 입력에서 만들 수 있는 만큼만 만든다(억지로 채우지 않는다).
    expect(report.corners.find((c) => c.cornerType === 'date_archive')?.outcome).toBe('ready')
    for (const c of report.corners) expect(['ready', 'skipped_insufficient_input']).toContain(c.outcome)
  })
})

describe('시험 커플·P0 조건 확인 (R13-7, 17-0-10-B)', () => {
  it.each([
    ['이름에 test가 없는 커플', { nickname: '우리' }, /시험 커플/],
    ['이름이 없는 커플', { nickname: null }, /시험 커플/],
    ['active가 아닌 커플', { status: 'dissolving' }, /active/],
    ['ai_usage_agreed_at이 없는 구성원', { agreed: false }, /ai_usage_agreed_at/],
  ])('%s: 거부하고 아무 행도 만들지 않는다', async (_label, over, message) => {
    const { store, media } = datasetWorld(buildTables(), testCouple(over))
    await expect(generateSampleIssue({ store, media }, PARAMS)).rejects.toThrow(message)
    expect(store.issues).toHaveLength(0)
    expect(store.corners).toHaveLength(0)
    expect(media.copies).toHaveLength(0)
  })

  it('assertTestCouple: test가 있으면(대소문자 무시) 통과한다', () => {
    expect(() => assertTestCouple({ id: 'c', nickname: 'TEST-couple' })).not.toThrow()
    expect(() => assertTestCouple({ id: 'c', nickname: 'x' })).toThrow(OpsStopError)
  })

  it('이미 발행된 호는 다시 생성하지 않는다', async () => {
    const { store, media } = datasetWorld()
    const first = await generateSampleIssue({ store, media }, PARAMS)
    const i = store.issues.findIndex((x) => x.id === first.issueId)
    store.issues[i] = { ...store.issues[i], published_at: '2026-10-22T00:00:00Z' }
    await expect(generateSampleIssue({ store, media }, PARAMS)).rejects.toThrow(/이미 발행/)
  })

  it('기간 인수가 틀리면 멈춘다', async () => {
    const { store, media } = datasetWorld()
    await expect(generateSampleIssue({ store, media }, { ...PARAMS, periodStart: '2026-9-1' })).rejects.toThrow(OpsStopError)
    await expect(generateSampleIssue({ store, media }, { ...PARAMS, periodEndExclusive: '2026-09-01' })).rejects.toThrow(/시작이 끝/)
    expect(inclusiveEndDate('2026-10-01')).toBe('2026-09-30')
    expect(inclusiveEndDate('2026-03-01')).toBe('2026-02-28')
  })
})

/** `n`건의 긴 채팅으로 바꾼 한 달. 한 건은 한글 60자 안팎이다. */
function chatOf(n: number): Record<string, unknown>[] {
  const body = '오늘은 날이 맑아서 산책을 오래 했고 저녁에는 같이 장을 보고 요리를 해서 먹었다 그리고 일찍 쉬었다 내일도 비슷할 것 같다'
  return Array.from({ length: n }, (_, i) => ({
    id: `big-${String(i).padStart(5, '0')}`,
    couple_id: COUPLE_ID,
    sender_id: i % 2 === 0 ? SEJUN_ID : SEOYOUNG_ID,
    body,
    sent_at: `2026-09-${String(1 + (i % 28)).padStart(2, '0')}T${String(8 + Math.floor(i / 28) % 12).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00+09:00`,
    deleted_at: null,
  }))
}

async function tokensFor(n: number): Promise<{ sweet: number; month: number }> {
  const tables = { ...buildTables(), messages: chatOf(n) }
  const store = memoryStore({ tables, couple: testCouple() })
  const context = { coupleId: COUPLE_ID, period: PERIOD, cadence: 'monthly' as const }
  const a = await assembleCornerInput(store.assemblyClient, context, 'issue-probe')
  return {
    sweet: estimateRequestTokens(sweetWordsModule.buildRequest({ warmthIndex: null, messages: a.messages }, context), INPUT_TOKEN_STOP_BAND),
    month: estimateRequestTokens(
      thisMonthModule.buildRequest({ messages: a.messages, photos: a.photos, dates: a.dates }, context),
      INPUT_TOKEN_STOP_BAND,
    ),
  }
}

describe('R20-2 안전 정지 - pending + usage_over 경보, 호출 0건, 발행 거부', () => {
  it('기준을 넘긴 코너 하나: 호출 0건 · pending · 경보 1건 · 그 호의 발행 명령이 거부된다', async () => {
    // 17-5(사진·데이트 줄이 더 있다)만 기준을 넘고 17-4는 넘지 않는 건수를 찾는다.
    let lo = 100
    let hi = 2000
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2)
      const t = await tokensFor(mid)
      if (t.month > INPUT_TOKEN_STOP_LIMIT) hi = mid
      else lo = mid
    }
    const probe = await tokensFor(hi)
    expect(probe.month).toBeGreaterThan(INPUT_TOKEN_STOP_LIMIT)
    expect(probe.sweet).toBeLessThanOrEqual(INPUT_TOKEN_STOP_LIMIT) // 시험의 전제 - 아니면 건수 탐색이 틀렸다

    const tables = { ...buildTables(), messages: chatOf(hi) }
    const store = memoryStore({ tables, couple: testCouple() })
    const media = memoryMedia(tables.data_entries.filter((e) => typeof e.storage_path === 'string').map((e) => `${ENTRIES_BUCKET}/${e.storage_path}`))
    const report = await generateSampleIssue({ store, media }, PARAMS)

    const month = report.corners.find((c) => c.cornerType === 'this_month')
    expect(month).toMatchObject({ outcome: 'halted_pending', status: 'pending', sampleResponses: 0 }) // 호출 0건
    expect(store.corners.find((c) => c.corner_type === 'this_month')).toMatchObject({ status: 'pending', skip_reason: null, content: {} })
    // 나머지 코너는 그대로 만들어진다(안전 정지는 그 코너만)
    expect(report.corners.filter((c) => c.outcome === 'ready').map((c) => c.cornerType)).toEqual(['date_archive', 'sweet_words'])

    // 경보 1건 - 숫자와 종류뿐
    expect(store.alerts).toHaveLength(1)
    expect(store.alerts[0]).toMatchObject({ kind: 'usage_over', couple_id: COUPLE_ID, issue_id: report.issueId, resolved_at: null })
    expect(store.alerts[0].detail).toEqual({
      stage: 'input_halt',
      cornerType: 'this_month',
      estimatedInputTokens: month?.estimatedInputTokens,
      limit: INPUT_TOKEN_STOP_LIMIT,
    })
    expect(JSON.stringify(store.alerts[0].detail)).not.toContain('산책') // 원문 없음

    // 그 호의 발행 명령은 함수를 부르기 전에 거부된다
    await expect(publishIssue({ store, media }, report.issueId)).rejects.toThrow(/열린 운영 경보/)
    expect(store.publishCalls).toBe(0)

    // 다시 생성해도 경보 처리 전에는 돌지 않고, 경보가 늘지 않는다
    await expect(generateSampleIssue({ store, media }, PARAMS)).rejects.toThrow(/열린 운영 경보/)
    expect(store.alerts).toHaveLength(1)

    // 사람이 경보를 처리하면(resolved_at) 발행 명령이 다시 길을 연다 - 경보 하나가 막고 있었다는 증명
    store.alerts[0] = { ...store.alerts[0], resolved_at: '2026-10-22T00:00:00Z' }
    store.markRendered(report.issueId) // 55-1 가드 ①: 렌더된 호만 발행한다 - 이 시험의 관심은 경보이므로 렌더된 것으로 둔다
    await publishIssue({ store, media }, report.issueId)
    expect(store.publishCalls).toBe(1)
  })

  it('두 코너가 모두 넘으면 코너마다 경보 한 건이다', async () => {
    const tables = { ...buildTables(), messages: chatOf(1500) }
    const store = memoryStore({ tables, couple: testCouple() })
    const media = memoryMedia(tables.data_entries.filter((e) => typeof e.storage_path === 'string').map((e) => `${ENTRIES_BUCKET}/${e.storage_path}`))
    const report = await generateSampleIssue({ store, media }, PARAMS)
    expect(report.corners.filter((c) => c.outcome === 'halted_pending').map((c) => c.cornerType)).toEqual(['sweet_words', 'this_month'])
    expect(store.alerts.map((a) => (a.detail as { cornerType: string }).cornerType)).toEqual(['sweet_words', 'this_month'])
    expect(store.corners.filter((c) => c.status === 'pending').map((c) => c.corner_type)).toEqual(['sweet_words', 'this_month'])
  })
})

describe('발행 명령 - 함수를 부르기 전의 확인', () => {
  it('정상: 미디어가 목적지에 다 있으면 함수를 한 번 부른다', async () => {
    const { store, media } = datasetWorld()
    const { issueId } = await generateSampleIssue({ store, media }, PARAMS)
    store.markRendered(issueId) // 55-1 가드 ①: 렌더된 호만 발행한다
    await publishIssue({ store, media }, issueId)
    expect(store.publishCalls).toBe(1)
  })

  it('원본이 그 사이 지워졌으면(사본이 있어도) 발행하지 않고 그 코너를 pending으로 되돌린다 - 다시 준비 중', async () => {
    const { store, media, tables } = datasetWorld()
    const { issueId } = await generateSampleIssue({ store, media }, PARAMS)
    // 17-5가 근거로 실은 독립 사진 하나의 원본을 지운다
    const photoPath = store.corners
      .filter((c) => c.corner_type === 'this_month')
      .flatMap((c) => mediaPathsOf(c.corner_type, c.content))[0]
    const entryId = parseMagazineMediaPath(photoPath)?.entryId as string
    const entry = tables.data_entries.find((e) => e.id === entryId)
    media.objects.delete(`${ENTRIES_BUCKET}/${entry?.storage_path}`)

    await expect(publishIssue({ store, media }, issueId)).rejects.toThrow(/다시 준비 중/)
    expect(store.publishCalls).toBe(0)
    const reset = store.corners.filter((c) => c.status === 'pending')
    expect(reset.length).toBeGreaterThan(0)
    expect(reset.every((c) => c.last_error === 'source_media_missing')).toBe(true)
    // 원본은 지우지 않는다 - 이미 복제된 사본도 건드리지 않았다
    expect(media.objects.has(`${MAGAZINE_BUCKET}/${photoPath}`)).toBe(true)
  })

  it('시험 커플의 호가 아니면 발행 명령도 거부한다', async () => {
    const { store, media } = datasetWorld()
    const { issueId } = await generateSampleIssue({ store, media }, PARAMS)
    const other = memoryStore({ tables: buildTables(), couple: testCouple({ nickname: '우리' }) })
    other.issues.push(store.issues[0])
    await expect(publishIssue({ store: other, media }, issueId)).rejects.toThrow(/시험 커플/)
  })
})

describe('발행 가드 (55-1, R23-3) - 렌더되지 않은 호는 발행하지 않는다', () => {
  const rendered = (issueId: string) => ({
    pdf_digital_path: `c/${issueId}/render/issue.pdf`,
    page_count: 1,
    cover_path: `c/${issueId}/render/page-01.jpg`,
  })

  it('① 렌더 세 필드가 모두 비었으면 함수를 부르기 전에 거부한다', async () => {
    const { store, media } = datasetWorld()
    const { issueId } = await generateSampleIssue({ store, media }, PARAMS)
    expect(store.issues[0]).toMatchObject({ pdf_digital_path: null, page_count: null, cover_path: null })
    await expect(publishIssue({ store, media }, issueId)).rejects.toThrow(/렌더되지 않은 호/)
    expect(store.publishCalls).toBe(0)
    expect(store.issues[0].published_at).toBeNull()
  })

  it('① 세 필드 중 하나라도 비면 거부한다 - 하나씩 비워 본다', async () => {
    for (const missing of ['pdf_digital_path', 'page_count', 'cover_path'] as const) {
      const { store, media } = datasetWorld()
      const { issueId } = await generateSampleIssue({ store, media }, PARAMS)
      store.issues[0] = { ...store.issues[0], ...rendered(issueId), [missing]: null }
      await expect(publishIssue({ store, media }, issueId)).rejects.toThrow(/렌더되지 않은 호/)
      expect(store.publishCalls).toBe(0)
    }
    // 쪽 수 0도 렌더된 것이 아니다
    const { store, media } = datasetWorld()
    const { issueId } = await generateSampleIssue({ store, media }, PARAMS)
    store.issues[0] = { ...store.issues[0], ...rendered(issueId), page_count: 0 }
    await expect(publishIssue({ store, media }, issueId)).rejects.toThrow(/렌더되지 않은 호/)
  })

  it('① 세 필드가 모두 있으면 발행한다', async () => {
    const { store, media } = datasetWorld()
    const { issueId } = await generateSampleIssue({ store, media }, PARAMS)
    store.issues[0] = { ...store.issues[0], ...rendered(issueId) }
    await publishIssue({ store, media }, issueId)
    expect(store.publishCalls).toBe(1)
  })

  it('② 코너가 다시 생성되면(pending -> 새 결과) 그 호의 렌더 세 필드를 비운다 - 다시 렌더해야 발행된다', async () => {
    const { store, media } = datasetWorld()
    const { issueId } = await generateSampleIssue({ store, media }, PARAMS)
    store.markRendered(issueId)
    expect(store.issues[0].page_count).toBe(1)

    // 변화 없는 재실행(모든 코너가 kept_ready)은 렌더를 무효로 하지 않는다
    await generateSampleIssue({ store, media }, PARAMS)
    expect(store.issues[0].page_count).toBe(1)

    // 코너 하나가 pending으로 돌아가 다시 생성된다 - 렌더 세 필드가 비워진다
    const index = store.corners.findIndex((c) => c.corner_type === 'sweet_words')
    store.corners[index] = { ...store.corners[index], status: 'pending', content: {} }
    const again = await generateSampleIssue({ store, media }, PARAMS)
    expect(again.corners.find((c) => c.cornerType === 'sweet_words')?.outcome).toBe('ready')
    expect(store.issues[0]).toMatchObject({ pdf_digital_path: null, page_count: null, cover_path: null })

    // 다시 렌더하기 전에는 발행되지 않고, 렌더하면 발행된다
    await expect(publishIssue({ store, media }, issueId)).rejects.toThrow(/렌더되지 않은 호/)
    expect(store.publishCalls).toBe(0)
    store.markRendered(issueId)
    await publishIssue({ store, media }, issueId)
    expect(store.publishCalls).toBe(1)
  })

  it('② 원본 재확인 실패: 원본 하나 삭제 -> 발행 거부 · 코너 pending · 렌더 필드 빈 값 · 호 미발행', async () => {
    const { store, media, tables } = datasetWorld()
    const { issueId } = await generateSampleIssue({ store, media }, PARAMS)
    store.markRendered(issueId) // 렌더까지 마친 호 - 가드 ①만으로는 통과하는 호다
    expect(store.issues[0].cover_path).not.toBeNull()

    const photoPath = store.corners.flatMap((c) => mediaPathsOf(c.corner_type, c.content))[0]
    const entryId = parseMagazineMediaPath(photoPath)?.entryId as string
    const entry = tables.data_entries.find((e) => e.id === entryId)
    media.objects.delete(`${ENTRIES_BUCKET}/${entry?.storage_path}`)

    await expect(publishIssue({ store, media }, issueId)).rejects.toThrow(/다시 준비 중/)
    expect(store.publishCalls).toBe(0) // 호 미발행
    expect(store.issues[0].published_at).toBeNull()
    const reset = store.corners.filter((c) => c.status === 'pending')
    expect(reset.length).toBeGreaterThan(0) // 코너 pending
    expect(reset.every((c) => c.last_error === 'source_media_missing')).toBe(true) // 실패 사유 4값은 늘리지 않는다
    expect(store.issues[0]).toMatchObject({ pdf_digital_path: null, page_count: null, cover_path: null }) // 렌더 필드 빈 값
  })

  it('② (57-) 작성자가 지운 항목: 저장소 원본 파일·목적지 사본이 그대로 있어도 같게 처리한다', async () => {
    const { store, media, tables } = datasetWorld()
    const { issueId } = await generateSampleIssue({ store, media }, PARAMS)
    store.markRendered(issueId)

    const photoPath = store.corners.flatMap((c) => mediaPathsOf(c.corner_type, c.content))[0]
    const entryId = parseMagazineMediaPath(photoPath)?.entryId as string
    const entry = tables.data_entries.find((e) => e.id === entryId) as Record<string, unknown>
    // fn_delete_own_entry가 하는 일: deleted_at만 찬다. 파일은 남는다.
    entry.deleted_at = '2026-10-24T00:00:00+09:00'
    expect(media.objects.has(`${ENTRIES_BUCKET}/${entry.storage_path}`)).toBe(true)
    expect(media.objects.has(`${MAGAZINE_BUCKET}/${photoPath}`)).toBe(true)

    await expect(publishIssue({ store, media }, issueId)).rejects.toThrow(/다시 준비 중/)
    expect(store.publishCalls).toBe(0)
    expect(store.issues[0].published_at).toBeNull()
    const reset = store.corners.filter((c) => c.status === 'pending')
    expect(reset.length).toBeGreaterThan(0)
    expect(reset.every((c) => c.last_error === 'source_media_missing')).toBe(true) // 실패 사유 4값은 늘리지 않는다
    expect(store.issues[0]).toMatchObject({ pdf_digital_path: null, page_count: null, cover_path: null })
    // 파일은 지우지 않는다
    expect(media.objects.has(`${ENTRIES_BUCKET}/${entry.storage_path}`)).toBe(true)
    expect(media.objects.has(`${MAGAZINE_BUCKET}/${photoPath}`)).toBe(true)
  })

  it('② (57-) 이미 발행된 호의 content는 바꾸지 않는다 - 발행된 호는 함수 앞에서 거부되고 코너는 그대로다', async () => {
    const { store, media, tables } = datasetWorld()
    const { issueId } = await generateSampleIssue({ store, media }, PARAMS)
    store.markRendered(issueId)
    await publishIssue({ store, media }, issueId)
    store.issues[0] = { ...store.issues[0], published_at: '2026-10-24T00:00:00Z' } // 발행된 상태
    const before = JSON.stringify([store.corners, store.issues])

    const photoPath = store.corners.flatMap((c) => mediaPathsOf(c.corner_type, c.content))[0]
    const entryId = parseMagazineMediaPath(photoPath)?.entryId as string
    ;(tables.data_entries.find((e) => e.id === entryId) as Record<string, unknown>).deleted_at = '2026-10-25T00:00:00+09:00'

    await expect(publishIssue({ store, media }, issueId)).rejects.toThrow(/이미 발행/)
    expect(JSON.stringify([store.corners, store.issues])).toBe(before)
  })

  it('② 발행된 호의 렌더 필드는 비우지 않는다', async () => {
    const { store, media } = datasetWorld()
    const { issueId } = await generateSampleIssue({ store, media }, PARAMS)
    store.markRendered(issueId)
    store.issues[0] = { ...store.issues[0], published_at: '2026-10-22T00:00:00Z' }
    await store.clearRender(issueId)
    expect(store.issues[0].page_count).toBe(1)
  })
})

describe('개발 프로젝트 확인 (service_role 접속 전)', () => {
  const REF = 'abcdefghijklmnopqrst'
  const linked = (name: string, ref = REF) => parseLinkedProject(JSON.stringify({ ref, name }))

  it('URL의 ref가 연결된 ondolog 프로젝트와 같을 때만 통과한다', () => {
    expect(assertDevelopmentProject(`https://${REF}.supabase.co`, linked('ondolog'))).toBe(REF)
  })

  it.each([
    ['연결 정보 없음', `https://${REF}.supabase.co`, null],
    ['이름이 다른 프로젝트', `https://${REF}.supabase.co`, linked('ondolog-prod')],
    ['ref가 다른 URL', 'https://zzzzzzzzzzzzzzzzzzzz.supabase.co', linked('ondolog')],
    ['supabase.co가 아닌 호스트', `https://${REF}.example.com`, linked('ondolog')],
    ['http', `http://${REF}.supabase.co`, linked('ondolog')],
  ])('%s: 멈춘다', (_label, url, l) => {
    expect(() => assertDevelopmentProject(url, l)).toThrow(OpsStopError)
  })

  it('연결 정보 파일이 깨졌으면 멈춘다', () => {
    expect(() => parseLinkedProject('not json')).toThrow(OpsStopError)
    expect(() => parseLinkedProject('{"ref":1}')).toThrow(OpsStopError)
  })

  it('redactSecrets는 비밀값이 어디에 섞여도 지운다', () => {
    expect(redactSecrets('a SECRETVALUE123 b SECRETVALUE123', ['SECRETVALUE123'])).toBe('a [REDACTED] b [REDACTED]')
  })
})

describe('샘플 모드는 네트워크·모델·키를 모른다', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path') as typeof import('path')
  const read = (file: string) => fs.readFileSync(path.join(__dirname, file), 'utf8')

  it('샘플·생성·발행 모듈에 fetch·엔드포인트·LLM 키·모델 설정 읽기가 없다', () => {
    for (const file of ['sampleOutputs.ts', 'generateIssue.ts', 'publishIssue.ts', 'mediaCopy.ts']) {
      const code = read(file)
        .split('\n')
        .filter((line) => !/^\s*(\/\*\*|\*|\/\/)/.test(line))
        .join('\n')
      expect(code).not.toMatch(/\bfetch\b|api\.anthropic|ONDOLOG_LLM_API_KEY|createLlmClient|corner_llm_model|llm_provider|app_config/)
    }
  })

  it('코너 모듈 3종은 CORNER_TABLE 순서대로다', () => {
    expect(CORNER_TABLE.map((c) => c.kind)).toEqual(['date_archive', 'sweet_words', 'this_month'])
  })
})
