/**
 * 84-h 시험판 전용 "유성 미리 보기"(ROADMAP R145-2). 이 파일은 시험판 상수가 켜진 쪽(`IS_TRIAL_BUILD` = true - Vitest 기본 DEV)이다.
 * 꺼진 쪽(출시 빌드)은 `meteorPreviewProd84h.vitest.tsx` · 번들 문자열은 `smoke/run.mjs`(출시 빌드 임시 폴더) + 아래 `web/dist` 정적 검사.
 *  - 설정 OUR SKY 맨 아래 줄 -> 하늘(C01)로 · 곧 하나(4~10초 기다림 0) · 기본 모션 = 지나가는 유성 · 줄인 모션 = 제자리 빛 5.2초 · 누르면 C03 · 놓치면 사라짐
 *  - C03 = 견본(긴 원문 + 짧은 원문) · 서버 읽기 · 쓰기 0(런타임 가짜) · 기기 저장 `meteor` 쓰기 0 · C08 둘러보기에서도 하나
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { IS_TRIAL_BUILD } from '../../config/env'
import { useAuthStore } from '../../auth/stores'
import { useCoupleStore } from '../../stores/coupleStore'
import { makeFakeNav } from '../../testSupport'
import type { DayRecord } from '../records/dayRecordRead'
import type { SkyData } from './skyData'
import { readMeteorMemory } from './meteorData'
import { EMPTY_MEMORY } from './meteorRules'
import { METEOR_TEXT, PREVIEW_COPY, PREVIEW_DELAY_MS, PREVIEW_LONG_TEXT, PREVIEW_WORDS, requestMeteorPreview, takeMeteorPreview } from './meteorPreview'
import { useSkyPrefStore } from './skyPrefs'
// @ts-expect-error - 스모크 표지 모듈(.mjs, 타입 없음)
import { PREVIEW_MARKERS, scanForMarkers } from '../../../smoke/markers.mjs'

const hoisted = vi.hoisted(() => ({ data: null as unknown, reduced: false, calls: [] as string[] }))
vi.mock('./skyData', () => ({
  useSky: () => hoisted.data,
  useSkyNames: () => ({ u1: '세준', p1: '서영' }),
  useSkyPhotoUrls: () => ({}),
}))
vi.mock('../../platform/motion', () => ({ prefersReducedMotion: () => hoisted.reduced }))
// 서버 - 어떤 표든 부르면 기록한다(미리 보기 동안 0이어야 한다)
vi.mock('../../auth/client', async (orig) => ({
  ...(await orig<object>()),
  getSupabase: () => ({
    from(table: string) { hoisted.calls.push(`from:${table}`); throw new Error('미리 보기는 서버를 부르지 않는다') },
    rpc(fn: string) { hoisted.calls.push(`rpc:${fn}`); throw new Error('미리 보기는 서버를 부르지 않는다') },
  }),
}))
vi.mock('../settings/useSettingsSummary', () => ({
  useSettingsSummary: () => ({ loaded: true, displayName: '세준', provider: 'kakao', loveTypeLabelEn: null, partnerName: '서영' }),
}))

const { SkyScreen } = await import('./SkyScreen')
const { SettingsView } = await import('../settings/SettingsView')

const ME = 'u1'
const YOU = 'p1'
const COUPLE = 'c1'
const NOW = new Date('2026-10-20T12:00:00+09:00')

const rec = (id: string, date: string): DayRecord => {
  const stops = [{ id: `${id}s`, seq: 1, arrivedAt: `${date}T10:00:00+09:00`, placeName: '망원' }]
  return { id, date, stops, photos: [], memos: [], counts: { stops: 1, photos: 0, memos: 0 } }
}
const sky = (): SkyData => ({
  loading: false, error: false, records: [rec('r0', '2026-09-14'), rec('r1', '2026-10-03')], allLoaded: true, temps: {}, tempStatus: {}, moons: [],
  draftPeriodStart: null, ensureTemps: vi.fn(),
})

async function flush(ms = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  hoisted.data = sky()
  hoisted.reduced = false
  hoisted.calls = []
  takeMeteorPreview() // 앞 시험의 남은 요청 비움
  useAuthStore.setState({ userId: ME })
  useCoupleStore.setState({ status: 'connected', coupleId: COUPLE, partnerId: YOU, relationshipStartDate: '2026-01-01', grace: false, graceCoupleId: null, gracePartnerId: null })
  useSkyPrefStore.getState().load(ME)
})
afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); useSkyPrefStore.setState({ userId: null }) })

/** 기기 저장소 전체에 견본 · 유성 기록이 남지 않았다. */
function expectNoDeviceTrace() {
  expect(readMeteorMemory(ME, COUPLE)).toEqual(EMPTY_MEMORY)
  const all = Object.keys(localStorage).map((k) => `${k}=${localStorage.getItem(k)}`).join('\n')
  expect(all).not.toContain('preview')
  expect(all).not.toContain('퇴근길')
  expect(all).not.toContain('고생 많았어')
  expect(Object.keys(localStorage).filter((k) => /meteor/.test(k) && !/skypref/.test(k))).toEqual([])
}

describe('84-h 설정 줄(시험판 상수 켬)', () => {
  it('시험 환경은 시험판 상수가 켜져 있다(이 파일의 전제)', () => {
    expect(IS_TRIAL_BUILD).toBe(true)
  })

  it('OUR SKY 묶음 맨 아래 한 줄 · 누르면 하늘로 + 미리 보기 요청 한 번', () => {
    const nav = makeFakeNav()
    render(<SettingsView nav={nav} />)
    const group = screen.getByTestId('settings-oursky')
    const row = screen.getByTestId('settings-row-sky-meteor-preview')
    expect(row.textContent).toContain(PREVIEW_COPY.row)
    expect(row.textContent).toContain(PREVIEW_COPY.rowDesc)
    const rows = Array.from(group.querySelectorAll('[data-testid^="settings-row-"]')).map((el) => el.getAttribute('data-testid'))
    expect(rows).toEqual(['settings-row-sky-meteor', 'settings-row-sky-twinkle', 'settings-row-sky-meteor-preview'])
    fireEvent.click(row)
    expect(nav.push).toHaveBeenCalledWith('sky')
    expect(takeMeteorPreview()).toBe(true)
    expect(takeMeteorPreview()).toBe(false) // 한 번 쓰고 지운다
    expect(hoisted.calls).toEqual([])
  })
})

describe('84-h 하늘 - 미리 보기', () => {
  it('기본 모션: 곧(0.7초) 지나가는 유성 · 누르면 C03 긴 원문 · ‹ 이전 말 = 짧은 견본 · 서버 0 · 기기 저장 0', async () => {
    requestMeteorPreview()
    render(<SkyScreen nav={makeFakeNav()} />)
    await flush(PREVIEW_DELAY_MS - 1)
    expect(screen.queryByTestId('sky-meteor')).toBeNull()
    await flush(1)
    const m = screen.getByTestId('sky-meteor')
    expect(m.getAttribute('data-mode')).toBe('fall')
    fireEvent.click(m)
    await flush()
    expect(screen.getByTestId('sky-fallen')).toBeTruthy()
    expect(screen.getByTestId('sky-fallen-text').textContent).toBe(PREVIEW_LONG_TEXT)
    expect(screen.getByTestId('sky-fallen-count').textContent).toBe(`${PREVIEW_WORDS.length} / ${PREVIEW_WORDS.length}`)
    expect(screen.getByTestId('sky-fallen-meta').textContent).toBe('도담 · 10월 11일 밤 11시 42분')
    // 긴 원문은 스크롤 영역 안(자르지 않음)
    expect(screen.getByTestId('sky-fallen-body').contains(screen.getByTestId('sky-fallen-text'))).toBe(true)
    fireEvent.click(screen.getByTestId('sky-fallen-prev'))
    expect(screen.getByTestId('sky-fallen-text').textContent).toBe(METEOR_TEXT)
    expect(screen.getByTestId('sky-fallen-meta').textContent).toBe('이랑 · 10월 3일 밤 10시 10분')
    fireEvent.click(screen.getByTestId('sky-fallen-close'))
    expect(screen.queryByTestId('sky-fallen')).toBeNull()
    expect(hoisted.calls).toEqual([])
    expectNoDeviceTrace()
  })

  it('줄인 모션: 제자리 빛 · 5.2초 누를 수 있음 · 놓치면 사라짐(기록 0)', async () => {
    hoisted.reduced = true
    requestMeteorPreview()
    render(<SkyScreen nav={makeFakeNav()} />)
    await flush(PREVIEW_DELAY_MS)
    expect(screen.getByTestId('sky-meteor').getAttribute('data-mode')).toBe('still')
    await flush(5199)
    expect(screen.getByTestId('sky-meteor')).toBeTruthy()
    await flush(1)
    expect(screen.queryByTestId('sky-meteor-layer')).toBeNull()
    expect(hoisted.calls).toEqual([])
    expectNoDeviceTrace()
  })

  it('기본 모션 놓침 - 3초 뒤 사라짐', async () => {
    requestMeteorPreview()
    render(<SkyScreen nav={makeFakeNav()} />)
    await flush(PREVIEW_DELAY_MS)
    await flush(2999)
    expect(screen.getByTestId('sky-meteor')).toBeTruthy()
    await flush(1)
    expect(screen.queryByTestId('sky-meteor')).toBeNull()
  })

  it('누를 때마다 - 하루 1번 규칙과 무관(같은 날 다시 열어도 또 떨어진다)', async () => {
    for (let i = 0; i < 2; i++) {
      requestMeteorPreview()
      render(<SkyScreen nav={makeFakeNav()} />)
      await flush(PREVIEW_DELAY_MS)
      fireEvent.click(screen.getByTestId('sky-meteor'))
      await flush()
      expect(screen.getByTestId('sky-fallen-count').textContent).toBe('2 / 2') // 실제 {n}/{N}에 쌓이지 않는다
      cleanup()
    }
    expectNoDeviceTrace()
  })

  it('C08 둘러보기에 들어가면 하나 더', async () => {
    requestMeteorPreview()
    render(<SkyScreen nav={makeFakeNav()} />)
    await flush(PREVIEW_DELAY_MS)
    await flush(3000) // 첫 유성은 놓침
    expect(screen.queryByTestId('sky-meteor')).toBeNull()
    fireEvent.click(screen.getByTestId('sky-tour-open'))
    await flush()
    expect(screen.getByTestId('sky-tour')).toBeTruthy()
    await flush(PREVIEW_DELAY_MS)
    fireEvent.click(screen.getByTestId('sky-meteor'))
    await flush()
    expect(screen.getByTestId('sky-fallen-text').textContent).toBe(PREVIEW_LONG_TEXT)
    expect(hoisted.calls).toEqual([])
  })

  it('요청 없이 연 하늘에는 미리 보기 0', async () => {
    useSkyPrefStore.getState().setMeteor(false) // 실제 유성도 끔 - 미리 보기만 본다
    render(<SkyScreen nav={makeFakeNav()} />)
    await flush(12_000)
    expect(screen.queryByTestId('sky-meteor-layer')).toBeNull()
  })

  it('빈 하늘(별 0)에서는 실제 유성처럼 떨어지지 않는다', async () => {
    hoisted.data = { ...sky(), records: [] }
    requestMeteorPreview()
    render(<SkyScreen nav={makeFakeNav()} />)
    await flush(3000)
    expect(screen.queryByTestId('sky-meteor-layer')).toBeNull()
  })
})

describe('84-h 정적', () => {
  const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), 'utf8')

  it('미리 보기 코드에 서버 · 기기 저장 쓰기가 없다', () => {
    for (const f of ['meteorPreview.tsx', 'meteorPreviewSample.ts']) {
      const src = read(f)
      expect(src).not.toMatch(/\.(insert|update|upsert|delete|rpc|from)\(/)
      expect(src).not.toMatch(/getSupabase|writeCache|writeMeteorMemory|useMeteorCandidates|fetchMeteorCandidates|useFallenWords/)
    }
    expect(read('meteorPreviewSample.ts')).not.toMatch(/^import /m) // 글자 파일(스모크 시험 쪽이 화면 코드를 끌어오지 않게)
  })

  it('부르는 곳은 시험판 상수 분기 안에서만', () => {
    const sky = read('SkyScreen.tsx')
    expect(sky).toMatch(/IS_TRIAL_BUILD \? takeMeteorPreview\(\) : false/)
    expect(sky).toMatch(/\{IS_TRIAL_BUILD && previewOn \? \(\s*<MeteorPreviewHost/)
    expect(sky.match(/MeteorPreviewHost|takeMeteorPreview/g)).toHaveLength(4) // import 2 + 분기 안 2
    const settings = read('../settings/SettingsView.tsx')
    expect(settings).toMatch(/\{IS_TRIAL_BUILD \? \(\s*<ListRow\s+label=\{PREVIEW_COPY\.row\}/)
    expect(settings.match(/PREVIEW_COPY|requestMeteorPreview/g)).toHaveLength(5) // import 2 + 분기 안 3
  })

  it('번들 검사 표지(smoke/markers.mjs)가 지금 견본 · 줄 이름과 맞는다', () => {
    const src = [read('meteorPreview.tsx'), read('meteorPreviewSample.ts'), read('../settings/SettingsView.tsx')].join('\n')
    expect((PREVIEW_MARKERS as string[]).length).toBeGreaterThanOrEqual(5)
    for (const m of PREVIEW_MARKERS as string[]) expect(src, m).toContain(m)
    expect(PREVIEW_LONG_TEXT.startsWith((PREVIEW_MARKERS as string[])[3])).toBe(true)
  })

  it('web/dist(마지막 앱 빌드)가 출시 빌드면 미리 보기 0', () => {
    const dist = path.resolve(__dirname, '../../../dist')
    if (!fs.existsSync(path.join(dist, 'index.html'))) return // 빌드 전 - smoke:webkit이 출시 빌드를 따로 내서 검사한다
    // 시험 빌드 구분 = 시험판 진단 표시(TrialDiag)의 시험 id가 번들에 있는가. 시험 빌드면 여기서는 보지 않는다
    // (시험 빌드에 표지가 모두 있는지 = 검사가 살아 있는지는 smoke/run.mjs가 새로 낸 시험 빌드로 본다 - 여기 dist는 옛 빌드일 수 있다).
    if ((scanForMarkers(dist, ['trial-diag']) as unknown[]).length > 0) return
    expect(scanForMarkers(dist, PREVIEW_MARKERS)).toEqual([])
  })
})
