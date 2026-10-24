/**
 * 데이트 기록(U2, `56-`)의 순수 규칙 - 저장소·화면에 접근하지 않는다.
 *
 * 기록 규칙(위임 프롬프트 56-):
 *   2. 날짜 기본값 = 고른 사진 중 가장 이른 EXIF 촬영 시각의 날짜(KST). 없으면 오늘.
 *   4. 사진은 촬영 시각으로 stop에 붙인다 - 도착 시각이 촬영 시각 이하인 stop 중 가장 늦은 것, 없으면 첫 stop.
 *      결정론이다(시간·난수·실행 환경 시간대에 기대지 않는다).
 *   7. `dates`의 파생 칸(photo_count · duration_minutes · has_user_note)을 맞춘다.
 *      `title` · `narrative` · `is_new_region`은 앱이 쓰지 않는다 - 이 파일에도 그 값을 만드는 코드가 없다.
 *
 * 시각은 전부 KST(+09:00) 기준 문자열 산수로 다룬다. `Date`의 지역 시간 함수(getHours 등)는 쓰지 않는다 -
 * 기기 시간대가 달라도 같은 입력이 같은 출력을 내야 한다.
 *
 * ── arrived_at 규칙(규칙에 없는 칸, 내부 결정) ──────────────────────────────
 * `date_stops.arrived_at`은 NOT NULL이다. 유저가 도착 시각을 넣지 않은 stop은 **그 날짜의 KST 00:00:00**
 * (`kstMidnightIso`)으로 저장하고, 이 값을 "시각 모름" 표지로 읽는다(`isTimeKnown`). 화면은 표지인 stop의 시각을
 * 그리지 않는다 - 타임라인에 실제와 다른 시각이 보이지 않는다. 유저가 "00:00"을 직접 넣어도 같은 값이라 시각을
 * 그리지 않는다(숨길 뿐 거짓을 보이지 않는다).
 * 표지 값은 어떤 촬영 시각 이하이므로 규칙 4에서는 "그날의 처음부터 있던 stop"처럼 동작한다.
 */

const MS_PER_MINUTE = 60_000
const KST_OFFSET_MS = 9 * 60 * 60_000

// ---------------------------------------------------------------------------
// 시각 - KST 산수
// ---------------------------------------------------------------------------

const EXIF_DATETIME = /^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/
const OFFSET = /^([+-])(\d{2}):(\d{2})$/

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

function isValidCalendar(y: number, mo: number, d: number, h: number, mi: number, s: number): boolean {
  if (mo < 1 || mo > 12 || d < 1 || h > 23 || mi > 59 || s > 59) return false
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  return d <= days
}

/**
 * EXIF `DateTimeOriginal`("2026:10:03 14:20:11")을 ISO 시각으로 바꾼다. EXIF 값에는 시간대가 없으므로
 * 기본은 KST(+09:00)로 읽는다(규칙 2). 같은 사진의 `OffsetTimeOriginal`("+09:00")이 있으면 그 값을 쓴다.
 * 읽을 수 없으면 null - 값을 지어내지 않는다.
 */
export function parseExifDateTime(raw: unknown, offset?: unknown): string | null {
  if (typeof raw !== 'string') return null
  const m = EXIF_DATETIME.exec(raw.trim())
  if (!m) return null
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number)
  if (!isValidCalendar(y, mo, d, h, mi, s)) return null
  let zone = '+09:00'
  if (typeof offset === 'string') {
    const o = OFFSET.exec(offset.trim())
    if (o && Number(o[2]) <= 14 && Number(o[3]) <= 59) zone = `${o[1]}${o[2]}:${o[3]}`
  }
  return `${pad(y, 4)}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}${zone}`
}

/** ISO 시각 -> epoch ms. 읽을 수 없으면 null. */
export function toEpochMs(iso: string | null | undefined): number | null {
  if (typeof iso !== 'string') return null
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : t
}

/** KST 달력 날짜 `YYYY-MM-DD`. */
export function kstDateOf(iso: string): string | null {
  const t = toEpochMs(iso)
  if (t === null) return null
  return new Date(t + KST_OFFSET_MS).toISOString().slice(0, 10)
}

/** KST 시각 `HH:MM`. */
export function kstTimeOf(iso: string): string | null {
  const t = toEpochMs(iso)
  if (t === null) return null
  return new Date(t + KST_OFFSET_MS).toISOString().slice(11, 16)
}

/** 지금의 KST 날짜. `now`를 받는다(시계를 직접 읽지 않는다). */
export function todayKst(now: Date): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10)
}

export const DATE_ON = /^\d{4}-\d{2}-\d{2}$/

export function isValidDateOn(value: string): boolean {
  if (!DATE_ON.test(value)) return false
  const [y, mo, d] = value.split('-').map(Number)
  return isValidCalendar(y, mo, d, 0, 0, 0)
}

/** 규칙 2 - 사진의 가장 이른 촬영 시각의 KST 날짜. 촬영 시각이 하나도 없으면 오늘. */
export function defaultDateOn(capturedAts: readonly (string | null)[], now: Date): string {
  let earliest: number | null = null
  for (const c of capturedAts) {
    const t = toEpochMs(c)
    if (t !== null && (earliest === null || t < earliest)) earliest = t
  }
  if (earliest === null) return todayKst(now)
  return new Date(earliest + KST_OFFSET_MS).toISOString().slice(0, 10)
}

/** 그 날짜의 KST 00:00:00 - "도착 시각 모름" 표지(위 docblock). */
export function kstMidnightIso(dateOn: string): string {
  return `${dateOn}T00:00:00+09:00`
}

/** `HH:MM`(24시간) 형식 확인. */
export function isValidClock(value: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(value.trim())
  return m !== null && Number(m[1]) <= 23 && Number(m[2]) <= 59
}

/** 유저가 넣은 도착 시각을 그 날짜의 ISO 시각으로. 비었거나 형식이 틀리면 null. */
export function arrivalIso(dateOn: string, clock: string | null | undefined): string | null {
  if (typeof clock !== 'string' || !isValidClock(clock)) return null
  return `${dateOn}T${clock.trim()}:00+09:00`
}

// ---------------------------------------------------------------------------
// stop
// ---------------------------------------------------------------------------

export interface PlaceInput {
  name: string
  /** `HH:MM` 또는 비어 있음. */
  arrivalClock?: string | null
}

export interface PlannedStop {
  seq: number
  placeName: string | null
  arrivedAt: string
}

/** stop의 도착 시각이 유저가 말한 시각인가(표지 값이 아닌가). */
export function isTimeKnown(arrivedAt: string, dateOn: string): boolean {
  const a = toEpochMs(arrivedAt)
  const m = toEpochMs(kstMidnightIso(dateOn))
  return a !== null && m !== null && a !== m
}

/** E03 타임라인에 그릴 시각. 모르면 null(그리지 않는다). */
export function stopTimeLabel(arrivedAt: string, dateOn: string): string | null {
  return isTimeKnown(arrivedAt, dateOn) ? kstTimeOf(arrivedAt) : null
}

/**
 * 규칙 4 - 유저가 입력한 장소 하나가 stop 하나. 장소가 하나도 없으면 이름 없는 stop 하나.
 * 도착 시각 순으로 seq 0부터. 같은 시각(모름 포함)은 입력 순서를 지킨다.
 */
export function buildStops(places: readonly PlaceInput[], dateOn: string): PlannedStop[] {
  const named = places
    .map((p, inputIndex) => ({ name: p.name.trim(), clock: p.arrivalClock ?? null, inputIndex }))
    .filter((p) => p.name.length > 0)
  if (named.length === 0) {
    return [{ seq: 0, placeName: null, arrivedAt: kstMidnightIso(dateOn) }]
  }
  const withTime = named.map((p) => ({
    placeName: p.name,
    arrivedAt: arrivalIso(dateOn, p.clock) ?? kstMidnightIso(dateOn),
    inputIndex: p.inputIndex,
  }))
  return sequenceStops(withTime).map(({ placeName, arrivedAt }, seq) => ({ seq, placeName, arrivedAt }))
}

/** 도착 시각 -> 입력(또는 기존) 순서로 안정 정렬. */
export function sequenceStops<T extends { arrivedAt: string; inputIndex: number }>(stops: readonly T[]): T[] {
  return [...stops].sort((a, b) => {
    const ta = toEpochMs(a.arrivedAt) ?? 0
    const tb = toEpochMs(b.arrivedAt) ?? 0
    return ta !== tb ? ta - tb : a.inputIndex - b.inputIndex
  })
}

/**
 * 규칙 4 - 사진을 stop에 붙인다. 도착 시각이 촬영 시각 이하인 stop 중 가장 늦은 것,
 * 없거나 촬영 시각을 모르면 첫 stop. 같은 도착 시각이면 seq가 큰 쪽. stop이 없으면 null.
 */
export function assignStop<T extends { arrivedAt: string; seq: number }>(
  capturedAt: string | null,
  stops: readonly T[],
): T | null {
  if (stops.length === 0) return null
  const ordered = [...stops].sort((a, b) => {
    const ta = toEpochMs(a.arrivedAt) ?? 0
    const tb = toEpochMs(b.arrivedAt) ?? 0
    return ta !== tb ? ta - tb : a.seq - b.seq
  })
  const t = toEpochMs(capturedAt)
  if (t === null) return ordered[0]
  let chosen: T | null = null
  for (const stop of ordered) {
    const at = toEpochMs(stop.arrivedAt)
    if (at !== null && at <= t) chosen = stop
  }
  return chosen ?? ordered[0]
}

// ---------------------------------------------------------------------------
// dates 파생 칸 (규칙 7)
// ---------------------------------------------------------------------------

export interface DateDerivedFields {
  photo_count: number
  duration_minutes: number | null
  has_user_note: boolean
}

/** 그 날짜(KST)에 찍힌 사진의 촬영 시각(epoch ms) 최소·최대. 둘 이상 없으면 null 쌍. */
function timedSpan(capturedAts: readonly (string | null)[], dateOn: string): { min: number; max: number; count: number } | null {
  const times: number[] = []
  for (const c of capturedAts) {
    if (c === null) continue
    const t = toEpochMs(c)
    if (t !== null && kstDateOf(c) === dateOn) times.push(t)
  }
  if (times.length === 0) return null
  return { min: Math.min(...times), max: Math.max(...times), count: times.length }
}

/**
 * 규칙 7 - 지금 남아 있는 사진·메모로 파생 칸을 다시 계산한다.
 * duration_minutes = 그 날짜 안의 첫~마지막 촬영 시각 폭(분). 촬영 시각이 둘 미만이면 null(지어내지 않는다).
 * has_user_note = 메모가 하나라도 있는가.
 */
export function deriveDateFields(
  photoCapturedAts: readonly (string | null)[],
  memoCount: number,
  dateOn: string,
): DateDerivedFields {
  const span = timedSpan(photoCapturedAts, dateOn)
  const duration =
    span !== null && span.count >= 2 ? Math.round((span.max - span.min) / MS_PER_MINUTE) : null
  return {
    photo_count: photoCapturedAts.length,
    duration_minutes: duration,
    has_user_note: memoCount > 0,
  }
}

/** E03 머리의 "14:20–20:05". 촬영 시각이 하나면 그 시각, 없으면 null. */
export function timeRangeLabel(photoCapturedAts: readonly (string | null)[], dateOn: string): string | null {
  const span = timedSpan(photoCapturedAts, dateOn)
  if (span === null) return null
  const from = kstTimeOf(new Date(span.min).toISOString())
  const to = kstTimeOf(new Date(span.max).toISOString())
  if (from === null || to === null) return null
  return from === to ? from : `${from}–${to}`
}

// ---------------------------------------------------------------------------
// 날짜 말로 · 월 묶음
// ---------------------------------------------------------------------------

const WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'] as const
const MONTHS_EN = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
] as const

function parts(dateOn: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateOn.split('-').map(Number)
  return { y, m, d }
}

export function weekdayKo(dateOn: string): string {
  const { y, m, d } = parts(dateOn)
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

/** "2026.10.03 토요일" */
export function formatDateDotted(dateOn: string): string {
  const { y, m, d } = parts(dateOn)
  return `${pad(y, 4)}.${pad(m)}.${pad(d)} ${weekdayKo(dateOn)}`
}

/** "10월 3일 토요일" - 제목이 비었을 때 머리를 만드는 말. */
export function formatDateWords(dateOn: string): string {
  const { m, d } = parts(dateOn)
  return `${m}월 ${d}일 ${weekdayKo(dateOn)}`
}

/** "10.03" */
export function formatDateShort(dateOn: string): string {
  const { m, d } = parts(dateOn)
  return `${pad(m)}.${pad(d)}`
}

export function englishMonth(month: number): string {
  return MONTHS_EN[month - 1] ?? ''
}

export interface MonthChapter<T extends { date_on: string }> {
  /** `YYYY-MM` */
  key: string
  month: number
  year: number
  dates: T[]
}

/** 최근 달이 먼저. 같은 달 안에서도 최근 날짜가 먼저. */
export function groupByMonth<T extends { date_on: string }>(dates: readonly T[]): MonthChapter<T>[] {
  const sorted = [...dates].sort((a, b) => (a.date_on < b.date_on ? 1 : a.date_on > b.date_on ? -1 : 0))
  const chapters: MonthChapter<T>[] = []
  for (const d of sorted) {
    const key = d.date_on.slice(0, 7)
    const last = chapters[chapters.length - 1]
    if (last && last.key === key) {
      last.dates.push(d)
    } else {
      const { y, m } = parts(d.date_on)
      chapters.push({ key, month: m, year: y, dates: [d] })
    }
  }
  return chapters
}

/** 메모의 첫 줄(공백 줄은 건너뛴다). 없으면 null. */
export function firstLine(text: string | null | undefined): string | null {
  if (typeof text !== 'string') return null
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (t.length > 0) return t
  }
  return null
}

// ---------------------------------------------------------------------------
// 사진 고르기 결과 -> 기록 입력
// ---------------------------------------------------------------------------

export interface PickedPhoto {
  uri: string
  width: number | null
  height: number | null
  byteSize: number | null
  mimeType: string | null
  /** 확장자(소문자, 점 없음). `entries` 경로의 끝이 된다. */
  ext: string
  capturedAt: string | null
  lat: number | null
  lng: number | null
}

/** `expo-image-picker`의 에셋에서 우리가 쓰는 모양만 읽는다. 타입 의존 없이 구조로 받는다. */
export interface PickerAssetLike {
  uri: string
  width?: number | null
  height?: number | null
  fileSize?: number | null
  mimeType?: string | null
  fileName?: string | null
  exif?: Record<string, unknown> | null
}

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/webp': 'webp',
}

function extFrom(asset: PickerAssetLike): string {
  if (asset.mimeType) {
    const e = MIME_EXT[asset.mimeType.toLowerCase()]
    if (e) return e
  }
  for (const name of [asset.fileName, asset.uri.split('?')[0]]) {
    if (!name) continue
    const m = /\.([A-Za-z0-9]{1,8})$/.exec(name)
    if (m) return m[1].toLowerCase()
  }
  return 'jpg'
}

function signedCoordinate(value: unknown, ref: unknown, negativeRef: string, limit: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const magnitude = Math.abs(value)
  const signed = typeof ref === 'string' && ref.trim().toUpperCase() === negativeRef ? -magnitude : value
  return Math.abs(signed) <= limit ? signed : null
}

/** EXIF의 위·경도. 둘 다 읽혀야 쓴다(`chk_entry_latlng`). 부호는 Ref(S·W)를 따른다. */
export function exifGps(exif: Record<string, unknown> | null | undefined): { lat: number; lng: number } | null {
  if (!exif) return null
  const lat = signedCoordinate(exif.GPSLatitude, exif.GPSLatitudeRef, 'S', 90)
  const lng = signedCoordinate(exif.GPSLongitude, exif.GPSLongitudeRef, 'W', 180)
  if (lat === null || lng === null) return null
  return { lat, lng }
}

/** 크기를 줄이지 않는다 - picker가 준 가로·세로를 그대로 기록한다(MASTER 9-5 표지 규칙이 원본을 본다). */
export function photoFromPickerAsset(asset: PickerAssetLike): PickedPhoto {
  const exif = asset.exif ?? null
  const gps = exifGps(exif)
  const intOrNull = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : null
  return {
    uri: asset.uri,
    width: intOrNull(asset.width),
    height: intOrNull(asset.height),
    byteSize: intOrNull(asset.fileSize),
    mimeType: asset.mimeType ?? null,
    ext: extFrom(asset),
    capturedAt: parseExifDateTime(exif?.DateTimeOriginal ?? exif?.DateTimeDigitized ?? exif?.DateTime, exif?.OffsetTimeOriginal),
    lat: gps?.lat ?? null,
    lng: gps?.lng ?? null,
  }
}

/** `entries` 버킷 경로 - `{couple_id}/{entry_id}.{ext}` (SCHEMA §12). */
export function entryStoragePath(coupleId: string, entryId: string, ext: string): string {
  const segment = /^[A-Za-z0-9_-]+$/
  if (!segment.test(coupleId) || !segment.test(entryId)) throw new Error('entryStoragePath: 경로 한 칸으로 쓸 수 없는 ID')
  if (!/^[A-Za-z0-9]{1,8}$/.test(ext)) throw new Error('entryStoragePath: 확장자가 올바르지 않다')
  return `${coupleId}/${entryId}.${ext.toLowerCase()}`
}

// ---------------------------------------------------------------------------
// 화면 문구 - 앱이 지어내지 않는다(제목은 생성 단계의 값이다)
// ---------------------------------------------------------------------------

export interface DateHeadInput {
  date_on: string
  title: string | null
  region: string | null
}

function clean(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t.length > 0 ? t : null
}

/**
 * E03 머리. `dates.title`은 생성 단계가 쓰는 값이라 **앱이 지어내지 않는다** -
 * 제목이 비어 있으면 날짜(말로)로 머리를 만들고, 지역은 있을 때만 붙인다(`dates.region`도 앱이 채우지 않는다).
 */
export function buildDateHead(
  date: DateHeadInput,
  photoCapturedAts: readonly (string | null)[],
  photoCount: number,
  memoCount: number,
): { kicker: string | null; title: string; meta: string } {
  const title = clean(date.title)
  const region = clean(date.region)
  const kicker = title !== null ? [formatDateDotted(date.date_on), region].filter((v) => v !== null).join(' \u00B7 ') : region
  const meta = [timeRangeLabel(photoCapturedAts, date.date_on), `사진 ${photoCount}`, `메모 ${memoCount}`]
    .filter((v) => v !== null)
    .join(' \u00B7 ')
  return { kicker, title: title ?? formatDateWords(date.date_on), meta }
}

/** 피드 카드 문구. 큰 카드 "2026.10.15 · 성수", 작은 카드 "10.11 · 성수". 제목이 비면 날짜 말로. */
export function buildCardTexts(
  date: { dateOn: string; title: string | null; region: string | null },
  compact: boolean,
): { dateLabel: string; title: string } {
  const region = clean(date.region)
  const head = compact ? formatDateShort(date.dateOn) : date.dateOn.replace(/-/g, '.')
  return {
    dateLabel: [head, region].filter((v) => v !== null).join(' \u00B7 '),
    title: clean(date.title) ?? formatDateWords(date.dateOn),
  }
}

// ---------------------------------------------------------------------------
// 입력 칸 - 날짜 피커·시간 피커 의존성이 없어 글자로 받는다
// ---------------------------------------------------------------------------

/** 숫자만 남기고 `HH:MM` 모양으로. 네 자리까지. */
export function formatClockInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`
}

/** 숫자만 남기고 `YYYY-MM-DD` 모양으로. 여덟 자리까지. */
export function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 4) return digits
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`
}
