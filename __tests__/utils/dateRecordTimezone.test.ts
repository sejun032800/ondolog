import { spawnSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'

/**
 * 데이트 기록 규칙 2·4·7 - 실행 환경의 시간대를 바꿔도 같은 결과가 나온다 (U2, `56-` 결정론 시험).
 *
 * `timeOfDayLabelTimezone.test.ts`와 같은 방법이다. jest 안에서 `TZ`를 바꿔도 프로세스 시간대는 바뀌지 않으므로
 * **시간대마다 별도 Node 프로세스**를 띄워 `src/utils/dateRecord.ts`의 실제 소스(import 없음)를 변환해 실행한다.
 * 자식이 그 시간대로 실제로 돌았는지(UTC 12:00의 현지 시)를 먼저 확인한다 - 아니면 비교가 아무것도 증명하지 못한다.
 */

const REPO_ROOT = path.join(__dirname, '..', '..')
const SOURCE = path.join(REPO_ROOT, 'src', 'utils', 'dateRecord.ts')

const ZONES: ReadonlyArray<{ readonly tz: string; readonly noonUtcLocalHour: number }> = [
  { tz: 'UTC', noonUtcLocalHour: 12 },
  { tz: 'Asia/Seoul', noonUtcLocalHour: 21 },
  { tz: 'America/Los_Angeles', noonUtcLocalHour: 5 },
  { tz: 'Pacific/Kiritimati', noonUtcLocalHour: 2 },
  { tz: 'Asia/Kolkata', noonUtcLocalHour: 17.5 },
]

function transpiledSource(): string {
  const source = fs.readFileSync(SOURCE, 'utf8')
  return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
    .outputText
}

/** 자식 프로세스에서 돌릴 계산. 모든 값은 순수 규칙의 결과 문자열/숫자다. */
const PROBE = `
  const m = mod.exports;
  const now = new Date('2026-10-24T15:00:00Z');
  const shots = [
    '2026-10-02T16:30:00Z', '2026-10-03T00:00:00+09:00', '2026-10-03T14:20:00+09:00',
    '2026-10-03T16:40:00+09:00', '2026-10-03T20:05:00+09:00', null,
  ];
  const plan = m.planStops([
    { name: '집 앞' },
    { name: '홍대 CGV', arrivalClock: '14:20' },
    { name: '연남동 디저트 카페', arrivalClock: '16:40' },
  ], '2026-10-03', shots);
  const stops = plan.stops;
  const out = {
    exif: m.parseExifDateTime('2026:10:03 14:20:11'),
    defaults: [
      m.defaultDateOn(shots, now),
      m.defaultDateOn([shots[0]], now),
      m.defaultDateOn([null], now),
      m.defaultDateOn([], new Date('2026-10-24T14:59:59Z')),
      m.defaultDateOn([], new Date('2026-10-24T15:00:00Z')),
    ],
    stops: stops,
    assigned: shots.map((s) => { const a = m.assignStop(s, stops); return a ? a.seq : null }),
    labels: stops.map((s) => m.kstTimeOf(s.arrivedAt)),
    derived: m.deriveDateFields(shots, 2, '2026-10-03'),
    range: m.timeRangeLabel(shots, '2026-10-03'),
    words: [m.formatDateWords('2026-10-03'), m.formatDateDotted('2026-10-03'), m.kstDateOf(shots[0]), m.kstTimeOf(shots[0])],
  };
`

interface ChildReport {
  readonly noonUtcLocalHour: number
  readonly result: unknown
}

function runInZone(tz: string, code: string): ChildReport {
  const script = `
    const mod = { exports: {} };
    new Function('module', 'exports', ${JSON.stringify(code)})(mod, mod.exports);
    ${PROBE}
    const noon = new Date(Date.UTC(2026, 7, 22, 12, 0, 0));
    process.stdout.write(JSON.stringify({ noonUtcLocalHour: noon.getHours() + noon.getMinutes() / 60, result: out }));
  `
  const run = spawnSync(process.execPath, ['-e', script], { env: { ...process.env, TZ: tz }, encoding: 'utf8' })
  if (run.status !== 0) throw new Error(`자식 프로세스 실패(TZ=${tz}): ${run.stderr}`)
  return JSON.parse(run.stdout) as ChildReport
}

describe('데이트 기록 규칙 - 실행 환경의 시간대에 기대지 않는다 (규칙 2·4·7)', () => {
  const code = transpiledSource()
  const reports = ZONES.map((zone) => ({ zone, report: runInZone(zone.tz, code) }))

  it.each(reports.map((r) => [r.zone.tz, r] as const))('%s - 자식이 그 시간대로 실제로 돌았다', (_tz, { zone, report }) => {
    expect(report.noonUtcLocalHour).toBe(zone.noonUtcLocalHour)
  })

  it('모든 시간대에서 결과가 같다', () => {
    const [first, ...rest] = reports
    for (const r of rest) expect(r.report.result).toEqual(first.report.result)
  })

  it('기준 시간대(UTC)의 결과가 기대값과 같다', () => {
    const result = reports[0].report.result as {
      defaults: string[]
      assigned: (number | null)[]
      labels: (string | null)[]
      range: string | null
    }
    // 가장 이른 촬영 = UTC 10-02 16:30 = KST 10-03 01:30
    expect(result.defaults).toEqual(['2026-10-03', '2026-10-03', '2026-10-25', '2026-10-24', '2026-10-25'])
    // stop 순서: 집 앞(시각 모름, 00:00) -> 홍대 CGV 14:20 -> 카페 16:40
    // 촬영: 10-03 01:30 / 00:00 / 14:20 / 16:40 / 20:05 / 시각 없음
    expect(result.assigned).toEqual([0, 0, 1, 2, 2, 0])
    expect(result.labels).toEqual(['00:00', '14:20', '16:40'])
    expect(result.range).toBe('00:00–20:05')
  })
})
