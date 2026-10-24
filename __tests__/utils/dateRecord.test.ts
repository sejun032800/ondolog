/**
 * 데이트 기록 순수 규칙 (U2, `56-`) - 규칙 2(날짜 기본값) · 규칙 4(사진 -> stop 배치, 결정론) · 규칙 7(파생 칸)과
 * stop 도착 시각 규칙(R30-2 - 늘 실제 시각), 제목이 비었을 때의 머리.
 */
import {
  assignStop,
  arrivalIso,
  buildCardTexts,
  buildDateHead,
  defaultDateOn,
  deriveDateFields,
  entryStoragePath,
  exifGps,
  firstLine,
  formatClockInput,
  formatDateDotted,
  formatDateInput,
  formatDateWords,
  groupByMonth,
  isValidDateOn,
  kstDateOf,
  kstTimeOf,
  parseExifDateTime,
  photoFromPickerAsset,
  sequenceStops,
  earliestCaptureOn,
  planStops,
  resolveStopArrival,
  stopTimeErrorMessage,
  type StopPlan,
  timeRangeLabel,
  todayKst,
} from '../../src/utils/dateRecord'

function okStops(plan: StopPlan) {
  if (!plan.ok) throw new Error(`계획 실패: ${JSON.stringify(plan.error)}`)
  return plan.stops
}

describe('규칙 2 - 날짜 기본값', () => {
  it('EXIF 촬영 시각(시간대 없음)은 KST로 읽는다', () => {
    expect(parseExifDateTime('2026:10:03 14:20:11')).toBe('2026-10-03T14:20:11+09:00')
    expect(parseExifDateTime('2026-10-03 14:20:11')).toBe('2026-10-03T14:20:11+09:00')
  })

  it('OffsetTimeOriginal이 있으면 그 시간대로 읽는다', () => {
    expect(parseExifDateTime('2026:10:03 14:20:11', '+02:00')).toBe('2026-10-03T14:20:11+02:00')
    expect(parseExifDateTime('2026:10:03 14:20:11', 'garbage')).toBe('2026-10-03T14:20:11+09:00')
  })

  it('읽을 수 없는 값은 null이다(지어내지 않는다)', () => {
    expect(parseExifDateTime(undefined)).toBeNull()
    expect(parseExifDateTime('')).toBeNull()
    expect(parseExifDateTime('0000:00:00 00:00:00')).toBeNull()
    expect(parseExifDateTime('2026:02:30 10:00:00')).toBeNull()
    expect(parseExifDateTime('2026:10:03 25:00:00')).toBeNull()
  })

  it('가장 이른 촬영 시각의 KST 날짜를 쓴다', () => {
    const now = new Date('2026-10-24T03:00:00Z')
    expect(
      defaultDateOn(['2026-10-05T10:00:00+09:00', '2026-10-03T14:20:11+09:00', null], now),
    ).toBe('2026-10-03')
  })

  it('UTC로는 전날이어도 KST 날짜를 쓴다', () => {
    const now = new Date('2026-10-24T03:00:00Z')
    // UTC 10-02 16:30 = KST 10-03 01:30
    expect(defaultDateOn(['2026-10-02T16:30:00Z'], now)).toBe('2026-10-03')
    // 시간대 표기가 달라도 같은 순간이면 같은 날짜
    expect(defaultDateOn(['2026-10-03T01:30:00+09:00'], now)).toBe('2026-10-03')
  })

  it('촬영 시각이 하나도 없으면 오늘(KST)이다', () => {
    expect(defaultDateOn([null, null], new Date('2026-10-24T14:59:59Z'))).toBe('2026-10-24')
    expect(defaultDateOn([], new Date('2026-10-24T15:00:00Z'))).toBe('2026-10-25')
    expect(todayKst(new Date('2026-10-24T15:00:00Z'))).toBe('2026-10-25')
  })

  it('같은 입력은 같은 출력이다', () => {
    const now = new Date('2026-10-24T00:00:00Z')
    const input = ['2026-10-04T09:00:00+09:00', '2026-10-03T23:59:59+09:00']
    expect(defaultDateOn(input, now)).toBe(defaultDateOn([...input].reverse(), now))
  })
})

describe('규칙 4 - 사진을 촬영 시각으로 stop에 붙인다', () => {
  const dateOn = '2026-10-03'
  const stops = okStops(
    planStops(
      [
        { name: '홍대 CGV', arrivalClock: '14:20' },
        { name: '연남동 디저트 카페', arrivalClock: '16:40' },
      ],
      dateOn,
      [],
    ),
  ).map((s) => ({ ...s }))

  it('유저가 입력한 장소 하나가 stop 하나이고 seq는 0부터, 도착 시각 순이다', () => {
    expect(stops.map((s) => [s.seq, s.placeName, s.arrivedAt])).toEqual([
      [0, '홍대 CGV', '2026-10-03T14:20:00+09:00'],
      [1, '연남동 디저트 카페', '2026-10-03T16:40:00+09:00'],
    ])
  })

  it('입력 순서와 시각 순서가 달라도 시각 순으로 번호를 매긴다', () => {
    const reversed = okStops(
      planStops(
        [
          { name: '카페', arrivalClock: '16:40' },
          { name: '영화관', arrivalClock: '14:20' },
        ],
        dateOn,
        [],
      ),
    )
    expect(reversed.map((s) => s.placeName)).toEqual(['영화관', '카페'])
    expect(reversed.map((s) => s.seq)).toEqual([0, 1])
  })

  it('도착 시각이 촬영 시각 이하인 stop 중 가장 늦은 것에 붙는다', () => {
    expect(assignStop('2026-10-03T14:20:00+09:00', stops)?.seq).toBe(0) // 같은 시각은 포함(이하)
    expect(assignStop('2026-10-03T15:00:00+09:00', stops)?.seq).toBe(0)
    expect(assignStop('2026-10-03T16:39:59+09:00', stops)?.seq).toBe(0)
    expect(assignStop('2026-10-03T16:40:00+09:00', stops)?.seq).toBe(1)
    expect(assignStop('2026-10-03T20:05:00+09:00', stops)?.seq).toBe(1)
  })

  it('첫 stop보다 이른 사진은 첫 stop에 붙는다', () => {
    expect(assignStop('2026-10-03T09:00:00+09:00', stops)?.seq).toBe(0)
  })

  it('촬영 시각을 모르는 사진은 첫 stop에 붙는다', () => {
    expect(assignStop(null, stops)?.seq).toBe(0)
  })

  it('stop이 없으면 null이다', () => {
    expect(assignStop('2026-10-03T09:00:00+09:00', [])).toBeNull()
  })

  it('같은 입력이면 입력 배열의 순서와 무관하게 같은 stop이 나온다', () => {
    const shuffled = [stops[1], stops[0]]
    for (const at of ['2026-10-03T13:00:00+09:00', '2026-10-03T17:00:00+09:00', null]) {
      expect(assignStop(at, shuffled)?.seq).toBe(assignStop(at, stops)?.seq)
    }
  })

  it('도착 시각을 바꾸면 배치가 바뀐다(E15)', () => {
    const edited = stops.map((s) => (s.seq === 1 ? { ...s, arrivedAt: arrivalIso(dateOn, '14:00') as string } : s))
    expect(assignStop('2026-10-03T14:10:00+09:00', stops)?.seq).toBe(0)
    expect(assignStop('2026-10-03T14:10:00+09:00', edited)?.seq).toBe(1)
  })

  it('같은 시각의 stop은 seq가 큰 쪽에 붙는다', () => {
    const tie = [
      { seq: 0, arrivedAt: '2026-10-03T14:00:00+09:00' },
      { seq: 1, arrivedAt: '2026-10-03T14:00:00+09:00' },
    ]
    expect(assignStop('2026-10-03T15:00:00+09:00', tie)?.seq).toBe(1)
  })
})

describe('R30-2 - stop 도착 시각은 늘 실제 시각이다', () => {
  const dateOn = '2026-10-03'
  const shots = ['2026-10-03T15:30:10+09:00', '2026-10-03T14:05:40+09:00', null]

  it('장소 1 · 시각 없음 · 사진 있음 -> 가장 이른 촬영 시각으로 저장한다', () => {
    const stops = okStops(planStops([{ name: '홍대 CGV' }], dateOn, shots))
    expect(stops).toEqual([{ seq: 0, placeName: '홍대 CGV', arrivedAt: '2026-10-03T14:05:40+09:00' }])
    expect(kstTimeOf(stops[0].arrivedAt)).toBe('14:05')
  })

  it('장소 1 · 시각 있음 -> 입력한 시각(사진이 있어도 입력이 이긴다)', () => {
    const stops = okStops(planStops([{ name: '홍대 CGV', arrivalClock: '14:20' }], dateOn, shots))
    expect(stops[0].arrivedAt).toBe('2026-10-03T14:20:00+09:00')
  })

  it('장소 2 · 둘째 시각 없음 -> 저장할 수 없다(둘째 장소를 가리킨다)', () => {
    const plan = planStops([{ name: 'A', arrivalClock: '10:00' }, { name: 'B' }], dateOn, shots)
    expect(plan).toEqual({ ok: false, error: { kind: 'time_required', index: 1, first: false } })
    if (plan.ok) throw new Error('unreachable')
    expect(stopTimeErrorMessage(plan.error)).toBe('장소 2의 도착 시각을 써 주세요')
  })

  it('장소 2 · 첫 장소 시각 없음 · 사진 있음 -> 첫 장소는 가장 이른 촬영 시각', () => {
    const stops = okStops(planStops([{ name: 'A' }, { name: 'B', arrivalClock: '16:40' }], dateOn, shots))
    expect(stops.map((s) => [s.seq, s.placeName, kstTimeOf(s.arrivedAt)])).toEqual([
      [0, 'A', '14:05'],
      [1, 'B', '16:40'],
    ])
  })

  it('사진도 시각도 없으면 저장할 수 없다', () => {
    expect(planStops([{ name: 'A' }], dateOn, [])).toEqual({
      ok: false,
      error: { kind: 'time_required', index: 0, first: true },
    })
    expect(planStops([{ name: 'A' }], dateOn, [null, null]).ok).toBe(false)
  })

  it('다른 날짜에 찍힌 사진의 시각은 쓰지 않는다', () => {
    const other = ['2026-10-02T23:00:00+09:00']
    expect(earliestCaptureOn(other, dateOn)).toBeNull()
    expect(planStops([{ name: 'A' }], dateOn, other).ok).toBe(false)
  })

  it('실제 00:00을 입력하면 00:00으로 저장하고 00:00으로 보인다(값을 가리지 않는다)', () => {
    const stops = okStops(planStops([{ name: '자정 산책', arrivalClock: '00:00' }], dateOn, []))
    expect(stops[0].arrivedAt).toBe('2026-10-03T00:00:00+09:00')
    expect(kstTimeOf(stops[0].arrivedAt)).toBe('00:00')
  })

  it('형식이 틀린 시각은 저장하지 않는다(다른 값으로 바꾸지 않는다)', () => {
    expect(planStops([{ name: 'A', arrivalClock: '25:99' }], dateOn, shots)).toEqual({
      ok: false,
      error: { kind: 'invalid_clock', index: 0 },
    })
    expect(planStops([{ name: 'B', arrivalClock: '14' }], dateOn, shots).ok).toBe(false)
    expect(arrivalIso(dateOn, '14:20')).toBe('2026-10-03T14:20:00+09:00')
    expect(arrivalIso(dateOn, '')).toBeNull()
  })

  it('장소가 없으면: 사진이 있을 때만 이름 없는 stop 하나(가장 이른 촬영 시각), 사진도 없으면 stop이 없다', () => {
    expect(okStops(planStops([], dateOn, shots))).toEqual([
      { seq: 0, placeName: null, arrivedAt: '2026-10-03T14:05:40+09:00' },
    ])
    expect(okStops(planStops([{ name: '   ', arrivalClock: '14:20' }], dateOn, shots))).toHaveLength(1)
    expect(okStops(planStops([], dateOn, []))).toEqual([])
    expect(planStops([], dateOn, [null]).ok).toBe(false)
  })

  it('E15 - 첫 stop만 비울 수 있고, 둘째부터는 필수다', () => {
    const first = resolveStopArrival({ dateOn, clock: '', isFirst: true, photoCapturedAts: shots })
    expect(first).toEqual({ ok: true, arrivedAt: '2026-10-03T14:05:40+09:00' })
    expect(resolveStopArrival({ dateOn, clock: '', isFirst: false, photoCapturedAts: shots }).ok).toBe(false)
    expect(resolveStopArrival({ dateOn, clock: '', isFirst: true, photoCapturedAts: [] }).ok).toBe(false)
    expect(resolveStopArrival({ dateOn, clock: '17:00', isFirst: false, photoCapturedAts: [] })).toEqual({
      ok: true,
      arrivedAt: '2026-10-03T17:00:00+09:00',
    })
  })

  it('같은 시각이면 입력 순서를 지킨다', () => {
    const stops = okStops(
      planStops(
        [
          { name: 'A', arrivalClock: '10:00' },
          { name: 'B', arrivalClock: '10:00' },
        ],
        dateOn,
        [],
      ),
    )
    expect(stops.map((s) => s.placeName)).toEqual(['A', 'B'])
    expect(
      sequenceStops([
        { arrivedAt: '2026-10-03T10:00:00+09:00', inputIndex: 1, id: 'b' },
        { arrivedAt: '2026-10-03T10:00:00+09:00', inputIndex: 0, id: 'a' },
      ]).map((s) => s.id),
    ).toEqual(['a', 'b'])
  })
})

describe('규칙 7 - dates 파생 칸', () => {
  const dateOn = '2026-10-03'

  it('사진 수 · 촬영 폭(분) · 메모 유무를 계산한다', () => {
    expect(
      deriveDateFields(
        ['2026-10-03T14:20:00+09:00', '2026-10-03T20:05:00+09:00', null],
        2,
        dateOn,
      ),
    ).toEqual({ photo_count: 3, duration_minutes: 345, has_user_note: true })
  })

  it('촬영 시각이 둘 미만이면 duration_minutes는 null이다(지어내지 않는다)', () => {
    expect(deriveDateFields(['2026-10-03T14:20:00+09:00'], 0, dateOn).duration_minutes).toBeNull()
    expect(deriveDateFields([null, null], 0, dateOn)).toEqual({
      photo_count: 2,
      duration_minutes: null,
      has_user_note: false,
    })
    expect(deriveDateFields([], 0, dateOn)).toEqual({ photo_count: 0, duration_minutes: null, has_user_note: false })
  })

  it('그 날짜가 아닌 날 찍힌 사진은 촬영 폭에서 뺀다', () => {
    expect(
      deriveDateFields(['2026-09-01T09:00:00+09:00', '2026-10-03T14:00:00+09:00', '2026-10-03T15:30:00+09:00'], 0, dateOn),
    ).toEqual({ photo_count: 3, duration_minutes: 90, has_user_note: false })
  })

  it('파생 값에는 title · narrative · is_new_region이 없다', () => {
    expect(Object.keys(deriveDateFields([], 0, dateOn)).sort()).toEqual(['duration_minutes', 'has_user_note', 'photo_count'])
  })

  it('E03 머리의 시간 범위', () => {
    expect(timeRangeLabel(['2026-10-03T14:20:00+09:00', '2026-10-03T20:05:00+09:00'], dateOn)).toBe('14:20–20:05')
    expect(timeRangeLabel(['2026-10-03T14:20:00+09:00'], dateOn)).toBe('14:20')
    expect(timeRangeLabel([null], dateOn)).toBeNull()
  })
})

describe('제목이 비어 있을 때 - 앱이 지어내지 않는다', () => {
  const date = { date_on: '2026-10-03', title: null as string | null, region: null as string | null }

  it('제목도 지역도 없으면 날짜 말로만 머리를 만든다', () => {
    const head = buildDateHead(date, [], 0, 0)
    expect(head.title).toBe('10월 3일 토요일')
    expect(head.kicker).toBeNull()
    expect(head.meta).toBe('사진 0 · 메모 0')
  })

  it('제목은 없고 지역만 있으면 지역을 머리 위 줄에 둔다', () => {
    const head = buildDateHead({ ...date, region: '연남동' }, [], 2, 1)
    expect(head.title).toBe('10월 3일 토요일')
    expect(head.kicker).toBe('연남동')
  })

  it('제목이 있으면 그대로 쓰고 날짜·지역은 머리 위 줄이다', () => {
    const head = buildDateHead(
      { date_on: '2026-10-03', title: '스파이더맨과 케이크 사이', region: '연남동' },
      ['2026-10-03T14:20:00+09:00', '2026-10-03T20:05:00+09:00'],
      11,
      2,
    )
    expect(head.title).toBe('스파이더맨과 케이크 사이')
    expect(head.kicker).toBe('2026.10.03 토요일 · 연남동')
    expect(head.meta).toBe('14:20–20:05 · 사진 11 · 메모 2')
  })

  it('공백뿐인 제목·지역은 비어 있는 것으로 본다', () => {
    const head = buildDateHead({ date_on: '2026-10-03', title: '  ', region: ' ' }, [], 0, 0)
    expect(head.title).toBe('10월 3일 토요일')
    expect(head.kicker).toBeNull()
  })

  it('피드 카드 문구도 같은 규칙이다', () => {
    expect(buildCardTexts({ dateOn: '2026-10-15', title: null, region: null }, false)).toEqual({
      dateLabel: '2026.10.15',
      title: '10월 15일 목요일',
    })
    expect(buildCardTexts({ dateOn: '2026-10-11', title: '밤 산책', region: '망원 한강' }, true)).toEqual({
      dateLabel: '10.11 · 망원 한강',
      title: '밤 산책',
    })
  })
})

describe('날짜 말·월 묶음·입력 칸', () => {
  it('요일은 실행 환경과 무관하게 계산한다', () => {
    expect(formatDateDotted('2026-10-03')).toBe('2026.10.03 토요일')
    expect(formatDateWords('2026-10-15')).toBe('10월 15일 목요일')
    expect(formatDateWords('2026-01-01')).toBe('1월 1일 목요일')
  })

  it('월 묶음은 최근 달이 먼저이고 같은 달에서도 최근 날짜가 먼저다', () => {
    const chapters = groupByMonth([
      { date_on: '2026-09-20', id: 'a' },
      { date_on: '2026-10-03', id: 'b' },
      { date_on: '2026-10-15', id: 'c' },
      { date_on: '2025-12-31', id: 'd' },
    ])
    expect(chapters.map((c) => c.key)).toEqual(['2026-10', '2026-09', '2025-12'])
    expect(chapters[0].dates.map((d) => d.id)).toEqual(['c', 'b'])
    expect(chapters[0].month).toBe(10)
  })

  it('메모 첫 줄은 빈 줄을 건너뛴다', () => {
    expect(firstLine('\n  \n창밖 보면서 한참 있었다.\n둘째 줄')).toBe('창밖 보면서 한참 있었다.')
    expect(firstLine('')).toBeNull()
    expect(firstLine(null)).toBeNull()
  })

  it('날짜·시각 입력은 숫자만 받아 모양을 맞춘다', () => {
    expect(formatDateInput('20261003')).toBe('2026-10-03')
    expect(formatDateInput('2026.10')).toBe('2026-10')
    expect(formatClockInput('1420')).toBe('14:20')
    expect(formatClockInput('14')).toBe('14')
    expect(isValidDateOn('2026-10-03')).toBe(true)
    expect(isValidDateOn('2026-02-30')).toBe(false)
    expect(isValidDateOn('2026-1-3')).toBe(false)
  })

  it('kstDateOf · kstTimeOf', () => {
    expect(kstDateOf('2026-10-02T16:30:00Z')).toBe('2026-10-03')
    expect(kstTimeOf('2026-10-02T16:30:00Z')).toBe('01:30')
    expect(kstDateOf('nope')).toBeNull()
  })
})

describe('사진 고르기 결과 -> 기록 입력', () => {
  const asset = {
    uri: 'file:///photos/IMG_0001.HEIC',
    width: 4032,
    height: 3024,
    fileSize: 2_345_678,
    mimeType: 'image/heic',
    exif: {
      DateTimeOriginal: '2026:10:03 14:20:11',
      GPSLatitude: 37.5563,
      GPSLatitudeRef: 'N',
      GPSLongitude: 126.9236,
      GPSLongitudeRef: 'E',
    },
  }

  it('가로세로는 줄이지 않고 그대로 기록한다', () => {
    const p = photoFromPickerAsset(asset)
    expect(p.width).toBe(4032)
    expect(p.height).toBe(3024)
    expect(p.byteSize).toBe(2_345_678)
    expect(p.capturedAt).toBe('2026-10-03T14:20:11+09:00')
    expect(p.lat).toBeCloseTo(37.5563, 4)
    expect(p.lng).toBeCloseTo(126.9236, 4)
    expect(p.ext).toBe('heic')
  })

  it('EXIF가 없으면 시각·좌표는 null이다(지어내지 않는다)', () => {
    const p = photoFromPickerAsset({ uri: 'file:///a/b.jpg', width: 100, height: 50 })
    expect(p.capturedAt).toBeNull()
    expect(p.lat).toBeNull()
    expect(p.lng).toBeNull()
    expect(p.ext).toBe('jpg')
  })

  it('위도와 경도 중 하나만 읽히면 둘 다 버린다(chk_entry_latlng)', () => {
    expect(exifGps({ GPSLatitude: 37.5 })).toBeNull()
    expect(exifGps({ GPSLatitude: 37.5, GPSLongitude: 'x' })).toBeNull()
  })

  it('남반구·서반구는 Ref의 부호를 따른다', () => {
    expect(exifGps({ GPSLatitude: 33.8, GPSLatitudeRef: 'S', GPSLongitude: 151.2, GPSLongitudeRef: 'W' })).toEqual({
      lat: -33.8,
      lng: -151.2,
    })
  })

  it('0이거나 없는 가로세로는 null이다', () => {
    const p = photoFromPickerAsset({ uri: 'file:///a.jpg', width: 0, height: 0 })
    expect(p.width).toBeNull()
    expect(p.height).toBeNull()
  })

  it('entries 경로는 {couple_id}/{entry_id}.{ext}이다', () => {
    expect(entryStoragePath('c1', 'e-1', 'JPG')).toBe('c1/e-1.jpg')
    expect(() => entryStoragePath('c/1', 'e', 'jpg')).toThrow()
    expect(() => entryStoragePath('c', 'e', '')).toThrow()
  })
})
