import { spawnSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'

/**
 * `timeOfDayLabel` — 실행 환경의 시간대를 바꿔도 같은 라벨이 나온다 (MASTER §17-0-7, r45 / PM 완료 기준).
 * 위임: .claude/state/prompts/phase-7/38-corner-pipeline-three-corners.md 범위 4.
 *
 * ── 어떻게 시험하는가 ────────────────────────────────────────────────────
 * jest 안에서 `process.env.TZ`를 바꿔도 실제 프로세스의 시간대는 바뀌지 않는다(jest가 `process`를 복제해 준다 -
 * 처음 시도에서 확인했다). 그래서 **시간대마다 별도 Node 프로세스**를 `TZ` 환경변수와 함께 띄운다.
 * 자식 프로세스는 `supabase/functions/_shared/timeOfDayLabel.ts`의 **실제 소스**를 TypeScript로 변환(import 없음,
 * 지워지는 타입만 있다)해 실행하고, 같은 순간 목록의 라벨을 돌려준다.
 *
 * **시험 자체의 유효성도 확인한다.** 자식 프로세스가 그 시간대로 실제로 돌았는지 - 순간 12:00Z의 현지 시(時)가
 * 그 시간대의 오프셋과 맞는지 - 먼저 본다. 맞지 않으면 아래 비교는 시간대 독립성을 증명하지 못하므로 실패시킨다.
 */

const REPO_ROOT = path.join(__dirname, '..', '..')
const SOURCE = path.join(REPO_ROOT, 'supabase', 'functions', '_shared', 'timeOfDayLabel.ts')

/** 서로 오프셋이 크게 다른 시간대. 한국(+9)과 같은 오프셋은 한국 하나뿐이다. */
const ZONES: ReadonlyArray<{ readonly tz: string; readonly noonUtcLocalHour: number }> = [
  { tz: 'UTC', noonUtcLocalHour: 12 },
  { tz: 'Asia/Seoul', noonUtcLocalHour: 21 },
  { tz: 'America/Los_Angeles', noonUtcLocalHour: 5 }, // 2026-08은 일광 절약 시간(PDT, -7)
  { tz: 'Pacific/Kiritimati', noonUtcLocalHour: 2 }, // +14, 날짜가 하루 넘어간다
  { tz: 'Asia/Kolkata', noonUtcLocalHour: 17.5 }, // +5:30
]

/** 한국 시간 2026-08-22 00:00부터 48시간, 30분 간격 + 경계 양쪽 1ms. */
function instants(): number[] {
  const start = Date.parse('2026-08-22T00:00:00+09:00')
  const list: number[] = []
  for (let i = 0; i <= 96; i++) list.push(start + i * 30 * 60 * 1000)
  for (const hour of [5, 11, 17, 21]) {
    const boundary = Date.parse(`2026-08-22T${String(hour).padStart(2, '0')}:00:00+09:00`)
    list.push(boundary - 1, boundary)
  }
  return list.sort((a, b) => a - b)
}

function transpiledSource(): string {
  const source = fs.readFileSync(SOURCE, 'utf8')
  return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
    .outputText
}

interface ChildReport {
  readonly noonUtcLocalHour: number
  readonly labels: string[]
}

function runInZone(tz: string, code: string, epochs: readonly number[]): ChildReport {
  const script = `
    const mod = { exports: {} };
    new Function('module', 'exports', ${JSON.stringify(code)})(mod, mod.exports);
    const noon = new Date(Date.UTC(2026, 7, 22, 12, 0, 0));
    const epochs = ${JSON.stringify(epochs)};
    process.stdout.write(JSON.stringify({
      noonUtcLocalHour: noon.getHours() + noon.getMinutes() / 60,
      labels: epochs.map((ms) => mod.exports.timeOfDayLabel(new Date(ms))),
    }));
  `
  const result = spawnSync(process.execPath, ['-e', script], {
    env: { ...process.env, TZ: tz },
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(`자식 프로세스 실패(TZ=${tz}): ${result.stderr}`)
  }
  return JSON.parse(result.stdout) as ChildReport
}

describe('timeOfDayLabel - 실행 환경의 시간대에 기대지 않는다 (PM 완료 기준)', () => {
  const code = transpiledSource()
  const epochs = instants()

  const reports = ZONES.map((zone) => ({ zone, report: runInZone(zone.tz, code, epochs) }))

  it.each(reports)('시험의 유효성 - TZ=$zone.tz 로 실제로 돌았다(순간 12:00Z의 현지 시가 그 시간대와 맞는다)', ({ zone, report }) => {
    expect(report.noonUtcLocalHour).toBe(zone.noonUtcLocalHour)
  })

  it('다섯 시간대 모두에서 같은 순간 목록의 라벨 열이 같다', () => {
    const [first, ...rest] = reports
    for (const { report } of rest) expect(report.labels).toEqual(first.report.labels)
  })

  it('그 라벨 열은 한국 시간 기준이다 - §17-0-7 표와 일치하고 다섯 라벨이 모두 나온다', () => {
    const expected = epochs.map((ms) => {
      // 시간대와 무관하게 한국 시간의 시를 계산하는 시험용 독립 계산(+09:00을 더해 UTC 시를 읽는다).
      const hour = new Date(ms + 9 * 3600 * 1000).getUTCHours()
      if (hour < 5) return '새벽'
      if (hour < 11) return '아침'
      if (hour < 17) return '낮'
      if (hour < 21) return '저녁'
      return '밤'
    })
    for (const { report } of reports) expect(report.labels).toEqual(expected)
    expect(new Set(expected)).toEqual(new Set(['새벽', '아침', '낮', '저녁', '밤']))
  })
})

// ---------------------------------------------------------------------------
// 시각 변환 모듈(`kstTime.ts`) - MASTER §17-0-9-E: 이 모듈의 함수도 같은 시간대 5곳 자식 프로세스에서 시험한다.
// 위 케이스는 건드리지 않고 더한 것이다.
// ---------------------------------------------------------------------------

const KST_TIME_SOURCE = path.join(REPO_ROOT, 'supabase', 'functions', '_shared', 'kstTime.ts')

const DATE_ON_VALUES = ['2026-08-22', '2026-02-28', '2024-02-29', '2026-12-31', '2026-01-01']
const SHIFT_MONTHS = [-6, -12, 6, 1]

function transpiledKstTime(): string {
  const source = fs.readFileSync(KST_TIME_SOURCE, 'utf8')
  return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
    .outputText
}

interface KstChildReport {
  readonly noonUtcLocalHour: number
  readonly dateStrings: string[]
  readonly clocks: string[]
  readonly isos: string[]
  readonly stamps: string[]
  readonly upperBounds: string[]
  readonly fromDateOn: string[]
  readonly shifted: string[][]
}

function runKstInZone(tz: string, code: string, epochs: readonly number[]): KstChildReport {
  const script = `
    const mod = { exports: {} };
    new Function('module', 'exports', ${JSON.stringify(code)})(mod, mod.exports);
    const m = mod.exports;
    const noon = new Date(Date.UTC(2026, 7, 22, 12, 0, 0));
    const epochs = ${JSON.stringify(epochs)};
    const dates = epochs.map((ms) => new Date(ms));
    process.stdout.write(JSON.stringify({
      noonUtcLocalHour: noon.getHours() + noon.getMinutes() / 60,
      dateStrings: dates.map((d) => m.kstDateString(d)),
      clocks: dates.map((d) => m.kstClockHHmm(d)),
      isos: dates.map((d) => m.kstIsoString(d)),
      stamps: dates.map((d) => m.kstDisplayStamp(d)),
      upperBounds: dates.map((d) => m.kstDateExclusiveUpperBound(d)),
      fromDateOn: ${JSON.stringify(DATE_ON_VALUES)}.map((s) => m.kstDateToInstant(s).toISOString()),
      shifted: ${JSON.stringify(SHIFT_MONTHS)}.map((n) => dates.map((d) => m.kstShiftMonths(d, n).toISOString())),
    }));
  `
  const result = spawnSync(process.execPath, ['-e', script], { env: { ...process.env, TZ: tz }, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`자식 프로세스 실패(TZ=${tz}): ${result.stderr}`)
  }
  return JSON.parse(result.stdout) as KstChildReport
}

describe('kstTime - 실행 환경의 시간대에 기대지 않는다 (MASTER §17-0-9-E)', () => {
  const code = transpiledKstTime()
  // 같은 순간 목록 + 연말·윤년·월말 경계.
  const kstEpochs = [
    ...instants(),
    Date.parse('2026-12-31T23:59:59.999+09:00'),
    Date.parse('2027-01-01T00:00:00+09:00'),
    Date.parse('2024-02-29T08:30:00+09:00'),
    Date.parse('2026-08-31T10:00:00.250+09:00'),
    Date.parse('2026-03-01T00:00:00+09:00'),
    Date.parse('2026-01-05T03:07:00+09:00'),
  ].sort((a, b) => a - b)

  const kstReports = ZONES.map((zone) => ({ zone, report: runKstInZone(zone.tz, code, kstEpochs) }))

  it.each(kstReports)('시험의 유효성 - TZ=$zone.tz 로 실제로 돌았다', ({ zone, report }) => {
    expect(report.noonUtcLocalHour).toBe(zone.noonUtcLocalHour)
  })

  it('다섯 시간대 모두에서 모든 함수의 결과가 같다', () => {
    const [first, ...rest] = kstReports
    for (const { report } of rest) expect(report).toEqual({ ...first.report, noonUtcLocalHour: report.noonUtcLocalHour })
  })

  it('결과는 한국 시간 기준이다 - 독립 계산(+09:00을 더해 UTC 필드를 읽는다)과 일치한다', () => {
    const pad = (n: number, w = 2) => String(n).padStart(w, '0')
    const shifted = kstEpochs.map((ms) => new Date(ms + 9 * 3600 * 1000))
    const expectedDates = shifted.map((k) => `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())}`)
    const expectedClocks = shifted.map((k) => `${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`)
    const expectedStamps = shifted.map(
      (k) => `${k.getUTCFullYear()}.${pad(k.getUTCMonth() + 1)}.${pad(k.getUTCDate())} ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`,
    )
    for (const { report } of kstReports) {
      expect(report.dateStrings).toEqual(expectedDates)
      expect(report.clocks).toEqual(expectedClocks)
      expect(report.stamps).toEqual(expectedStamps)
      // ISO 문자열은 오프셋 +09:00이고, 되읽으면 같은 순간이다.
      report.isos.forEach((iso, i) => {
        expect(iso).toMatch(/\+09:00$/)
        expect(Date.parse(iso)).toBe(kstEpochs[i])
      })
      expect(report.fromDateOn).toEqual(DATE_ON_VALUES.map((s) => new Date(`${s}T00:00:00+09:00`).toISOString()))
    }
  })

  it('kstDisplayStamp: 월·일·시·분 두 자리, 앞에 "— "가 없다 (MASTER §17-0-9-F, r50) - 한 자리 값(1월 5일 03:07)으로 시험', () => {
    const i = kstEpochs.indexOf(Date.parse('2026-01-05T03:07:00+09:00'))
    expect(i).toBeGreaterThanOrEqual(0)
    for (const { report } of kstReports) {
      expect(report.stamps[i]).toBe('2026.01.05 03:07')
      for (const stamp of report.stamps) {
        expect(stamp).toMatch(/^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}$/)
        expect(stamp.startsWith('—')).toBe(false)
      }
    }
  })

  it('kstShiftMonths: KST 달력 기준(일자가 없으면 말일로), kstDateExclusiveUpperBound: 자정이면 그 날짜 아니면 다음 날짜', () => {
    const { report } = kstReports[0]
    const idx = (iso: string) => kstEpochs.indexOf(Date.parse(iso))
    const aug31 = idx('2026-08-31T10:00:00.250+09:00')
    // -6개월: 2026-02-28 10:00:00.250 KST (말일로 맞춤), 6개월 뒤: 2027-02-28
    expect(report.shifted[0][aug31]).toBe(new Date('2026-02-28T10:00:00.250+09:00').toISOString())
    expect(report.shifted[2][aug31]).toBe(new Date('2027-02-28T10:00:00.250+09:00').toISOString())
    const leap = idx('2024-02-29T08:30:00+09:00')
    expect(report.shifted[1][leap]).toBe(new Date('2023-02-28T08:30:00+09:00').toISOString())
    const midnight = idx('2026-03-01T00:00:00+09:00')
    expect(report.upperBounds[midnight]).toBe('2026-03-01')
    expect(report.upperBounds[aug31]).toBe('2026-09-01')
    expect(report.upperBounds[idx('2026-12-31T23:59:59.999+09:00')]).toBe('2027-01-01')
  })
})
