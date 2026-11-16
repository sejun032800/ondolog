/// <reference types="jest" />
/**
 * 76-f (b) 남은 파일 정리 시험 - 가짜 접속만(원격 0). 경로 · id는 가짜 값이고 출력에 나오지 않는지 단언한다.
 */
import fs from 'fs'
import path from 'path'
import {
  MIN_FILE_AGE_MS,
  ISSUE_BUCKETS,
  PATH_COLUMNS,
  SWEEP_BUCKETS,
  classifyFiles,
  makeProjectGate,
  makeSweepPort,
  parseSweepArgs,
  runSweep,
  type StoredFile,
  type SweepBucket,
  type SweepPort,
} from './sweepOrphanFiles.ts'

const DEV_REF = 'fakedevref000000aaaa'
const DEV_URL = `https://${DEV_REF}.supabase.co`
const LIST = `project=${DEV_REF}\n`
const NOW = Date.parse('2026-11-16T00:00:00Z')
const OLD = '2026-11-10T00:00:00Z'
const YOUNG = '2026-11-15T12:00:00Z' // 12시간 전
const gate = makeProjectGate({ allowlistText: LIST, url: DEV_URL })

function fakePort(files: Partial<Record<SweepBucket, StoredFile[]>>, live: string[], failRemove = false, issueCouples: string[] = ['c-1']) {
  const calls = { list: [] as string[], remove: [] as { bucket: string; paths: readonly string[] }[] }
  const port: SweepPort = {
    async listFiles(bucket) {
      calls.list.push(bucket)
      return files[bucket] ?? []
    },
    async livePaths() {
      return new Set(live)
    },
    async issueCoupleIds() {
      return new Set(issueCouples)
    },
    async removeFiles(bucket, paths) {
      calls.remove.push({ bucket, paths })
      return failRemove ? { removed: 0, failed: paths.length } : { removed: paths.length, failed: 0 }
    },
  }
  return { port, calls }
}

const FILES: Partial<Record<SweepBucket, StoredFile[]>> = {
  entries: [
    { path: 'c-1/e-live.jpg', createdAt: OLD },
    { path: 'c-1/e-orphan.jpg', createdAt: OLD },
    { path: 'c-1/e-young.jpg', createdAt: YOUNG },
    { path: 'c-1/e-unknown.jpg', createdAt: null },
  ],
  stories: [{ path: 'c-1/s-archived.jpg', createdAt: OLD }],
  avatars: [{ path: 'u-1/reference', createdAt: OLD }],
}
// stories 버킷 경로를 data_entries 가 가리키는 경우(스토리 아카이브)도 "가리키는 행"이다.
const LIVE = ['c-1/e-live.jpg', 'c-1/s-archived.jpg', 'u-1/reference']

describe('판정', () => {
  it('행 있는 파일은 남기고 행 없는 파일만 남은 파일 · 24시간 안 · 시각 모름은 건너뜀', () => {
    const r = classifyFiles(FILES.entries as StoredFile[], new Set(LIVE), NOW)
    expect(r.orphans).toEqual(['c-1/e-orphan.jpg'])
    expect(r.skippedYoung).toBe(2)
  })
  it('24시간 경계: 정확히 24시간이면 지울 수 있고 1초 모자라면 건너뜀', () => {
    const at = (ms: number) => new Date(NOW - ms).toISOString()
    expect(classifyFiles([{ path: 'a', createdAt: at(MIN_FILE_AGE_MS) }], new Set(), NOW).orphans).toEqual(['a'])
    expect(classifyFiles([{ path: 'a', createdAt: at(MIN_FILE_AGE_MS - 1000) }], new Set(), NOW).skippedYoung).toBe(1)
  })
  it('경로 칸 지도: 소프트 삭제 표는 지우지 않은 행만 본다', () => {
    expect(PATH_COLUMNS.filter(([, , soft]) => soft).map(([t, c]) => `${t}.${c}`)).toEqual([
      'data_entries.storage_path', 'data_entries.thumb_path', 'data_entries.drawing_path', 'messages.media_path',
    ])
  })
})

describe('흐름', () => {
  it('미리 보기: 삭제 호출 0 · 버킷별 숫자', async () => {
    const { port, calls } = fakePort(FILES, LIVE)
    const out = await runSweep(async () => port, { apply: false }, gate, NOW)
    expect(out.kind).toBe('previewed')
    expect(calls.remove).toEqual([])
    expect(out.lines).toContain('entries: 검사 4 · 남은 파일 1 · 건너뜀(24시간) 2 · 지움 0 · 실패 0')
    expect(out.lines).toContain('stories: 검사 1 · 남은 파일 0 · 건너뜀(24시간) 0 · 지움 0 · 실패 0')
  })

  it('적용: 남은 파일만 지운다(행 있는 파일 · 24시간 안은 남김)', async () => {
    const { port, calls } = fakePort(FILES, LIVE)
    const out = await runSweep(async () => port, { apply: true }, gate, NOW)
    expect(out.kind).toBe('applied')
    expect(calls.remove).toEqual([{ bucket: 'entries', paths: ['c-1/e-orphan.jpg'] }])
    expect(out.lines).toContain('entries: 검사 4 · 남은 파일 1 · 건너뜀(24시간) 2 · 지움 1 · 실패 0')
  })

  it('지우기 실패는 숫자로 · 다음 실행 때 다시', async () => {
    const { port } = fakePort(FILES, LIVE, true)
    const out = await runSweep(async () => port, { apply: true }, gate, NOW)
    expect(out.lines).toContain('entries: 검사 4 · 남은 파일 1 · 건너뜀(24시간) 2 · 지움 0 · 실패 1')
    expect(out.lines[out.lines.length - 1]).toContain('실패 1')
  })

  it('76-g P3 매거진 버킷: 호 행이 있는 커플 파일 0건 · 호 행 없는 커플(둘 다 떠남)만 · 24시간 보호', async () => {
    const MAG: Partial<Record<SweepBucket, StoredFile[]>> = {
      ...FILES,
      magazine: [
        { path: 'c-1/i-1/cover.jpg', createdAt: OLD }, // 호 행 있는 커플
        { path: 'c-gone/i-9/cover.jpg', createdAt: OLD }, // 둘 다 떠난 커플
        { path: 'c-gone/i-9/page-01.jpg', createdAt: YOUNG }, // 24시간 안
      ],
      'magazine-print': [{ path: 'c-1/i-1/print.pdf', createdAt: OLD }, { path: 'c-gone/i-9/print.pdf', createdAt: OLD }],
    }
    const pre = fakePort(MAG, LIVE)
    const preview = await runSweep(async () => pre.port, { apply: false }, gate, NOW)
    expect(pre.calls.remove).toEqual([]) // 미리 보기 삭제 0
    expect(preview.lines).toContain('magazine: 검사 3 · 남은 파일 1 · 건너뜀(24시간) 1 · 지움 0 · 실패 0')
    const run = fakePort(MAG, LIVE)
    const out = await runSweep(async () => run.port, { apply: true }, gate, NOW)
    expect(run.calls.remove).toEqual([
      { bucket: 'entries', paths: ['c-1/e-orphan.jpg'] }, // 다른 버킷 규칙 회귀 0
      { bucket: 'magazine', paths: ['c-gone/i-9/cover.jpg'] },
      { bucket: 'magazine-print', paths: ['c-gone/i-9/print.pdf'] },
    ])
    expect(out.lines).toContain('magazine-print: 검사 2 · 남은 파일 1 · 건너뜀(24시간) 0 · 지움 1 · 실패 0')
  })

  it('매거진 버킷은 행 경로(livePaths)가 아니라 호 행으로만 판정한다 - 호 행이 있으면 경로가 어디에도 없어도 0건', async () => {
    const { port, calls } = fakePort({ magazine: [{ path: 'c-1/i-1/x.jpg', createdAt: OLD }] }, [], false, ['c-1'])
    await runSweep(async () => port, { apply: true }, gate, NOW)
    expect(calls.remove).toEqual([])
    expect(calls.list).toEqual([...SWEEP_BUCKETS])
    expect([...ISSUE_BUCKETS]).toEqual(['magazine', 'magazine-print'])
  })

  it('실제 포트는 여섯 밖 버킷 요청을 거부한다(저장소 호출 0)', async () => {
    const storageFrom = jest.fn()
    const port = makeSweepPort({ storage: { from: storageFrom }, from: jest.fn() })
    await expect(port.listFiles('exports' as SweepBucket)).rejects.toThrow()
    await expect(port.removeFiles('other' as SweepBucket, ['x'])).rejects.toThrow()
    expect(storageFrom).not.toHaveBeenCalled()
  })

  it('출력에 경로 · id · 주소 · ref가 없다(숫자만)', async () => {
    const { port } = fakePort(FILES, LIVE)
    const out = await runSweep(async () => port, { apply: true }, gate, NOW)
    const text = out.lines.join('\n')
    for (const bad of ['c-1', 'u-1', '.jpg', 'reference', DEV_REF, 'supabase.co']) expect(text).not.toContain(bad)
  })
})

describe('개발 프로젝트 가드(허용 목록의 project=)', () => {
  it('맞지 않으면 접속 0 · 아무것도 하지 않음', async () => {
    for (const g of [
      makeProjectGate({ allowlistText: null, url: DEV_URL }),
      makeProjectGate({ allowlistText: 'tester@example.com\n', url: DEV_URL }),
      makeProjectGate({ allowlistText: LIST, url: 'https://fakeprodref00000bbbb.supabase.co' }),
      makeProjectGate({ allowlistText: LIST, url: undefined }),
    ]) {
      const connect = jest.fn()
      const out = await runSweep(connect, { apply: true }, g, NOW)
      expect(out.kind).toBe('refused')
      expect(connect).not.toHaveBeenCalled()
      expect(out.lines.join('')).not.toContain('fakeprodref')
    }
  })
  it('이메일 줄은 보지 않는다(project만 맞으면 통과)', () => {
    expect(makeProjectGate({ allowlistText: `${LIST}tester@example.com\n`, url: DEV_URL })()).toBeNull()
  })
})

describe('인수 · 금지', () => {
  it('--apply 하나만 · 그 밖은 거부', () => {
    expect(parseSweepArgs([])).toEqual({ apply: false })
    expect(parseSweepArgs(['--apply'])).toEqual({ apply: true })
    expect(() => parseSweepArgs(['--force'])).toThrow()
  })
  it('코드(주석 밖)에 demo_responses · 서버 파괴 함수 · magazine 버킷 문자열 호출이 없다', () => {
    const src = fs.readFileSync(path.join(__dirname, 'sweepOrphanFiles.ts'), 'utf8')
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).filter((l) => !l.trim().startsWith('//')).join('\n')
    expect(code).not.toMatch(/demo_responses|execute_dissolution|apply_retention_policy|run_due_dissolutions/)
    expect(code).not.toMatch(/\.rpc\(/)
  })
})
