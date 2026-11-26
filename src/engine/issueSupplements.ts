/**
 * 부록 · 부속 지면 — 순수 함수 · 결정론 · LLM 0 (기획서 2절 11. · 부속 지면 · ROADMAP R157-6 · R157-7, 위임 `m20-a1` ④ ⑤ ⑥).
 *
 * 만드는 것: 다음 달 달력(부록 1면) · 사진 엽서(부록 2면) · 사진 한 장(쪽 수 맞춤) · 「다음 달」(사실만) · 「판권과 정오」 ·
 * 발행 노트 새 재료 줄의 숫자.
 *
 * ── 기념일 (R157-6) ────────────────────────────────────────────────────
 * **관계 기념일만** — 사귄 날부터 100일 단위와 365일 단위. **생일은 쓰지 않는다**(생년월일은 "나이 확인용"으로만 고지됐다).
 * 이 파일은 생년월일을 받는 인자가 없다. 날 세기는 앱(`src/utils/relationshipDays.ts`)과 같다: 사귄 날 = 1일째,
 * 100의 배수 날 = "N일", 365의 배수 날 = "N주년"(둘이 겹치면 주년). 사귄 날짜가 없으면 표시 0(달력만).
 *
 * ── 사진 고르기 (결정론 · 근거) ───────────────────────────────────────────
 * 후보 = 그 호 입력 조립이 실은 그달 사진(목적지 경로 · 크기 있음) 중 **위치 정보 0인 것**(`data_entries.lat/lng`가 비었음 —
 * 저장 파일은 업로드 때 위치를 지운 사본이다). 정렬 = 찍은 시각 → 항목 id.
 * - 엽서 2장: **그달 첫 사진과 마지막 사진**(한 달의 처음과 끝). 다른 코너(데이트 아카이브 등)에 실린 사진과 겹쳐도 된다 —
 *   엽서는 잘라 쓰는 부록이라 본문과 따로 남을 사진이 필요하다. 1장뿐이면 엽서 1장으로 싣는다(메인 세션 제안), 0장이면 엽서 면만 빠진다.
 * - 사진 한 장(최대 2면, 쪽 수 맞춤용): 엽서로 쓰지 않은 사진 중 **다른 코너에 실리지 않은 사진 먼저**, 그다음 실린 사진,
 *   각 무리 안에서는 찍은 시각 순. 캡션 = 그 사진에 사용자가 남긴 글 원문(있으면, 자르지 않음) → 없으면 "MM.DD · 장소" → 장소도 없으면 "MM.DD".
 *
 * ── 「다음 달」(R157-7) ────────────────────────────────────────────────
 * 날짜 · 기념일 같은 달력 사실만 싣는다. "다음 호에서 …" 같은 약속 문장은 0(`promiseCheck.ts`). 열릴 코너(특별 게스트)는
 * 그 코너가 아직 만들어지지 않아(2.0-C) 지금은 늘 비어 있다 — 없는 코너를 "열린다"고 쓰지 않는다.
 * 기념일이 하나도 없으면 이 면은 빠진다(빈 지면 0 — 메인 세션 제안).
 */

export interface PhotoCandidate {
  /** `data_entries.id` — 정렬 동점 깨기 · 지면에는 쓰지 않는다. */
  readonly entryId: string
  /** 목적지 경로 `{couple}/{issue}/{entry}.{ext}`. */
  readonly path: string
  readonly width: number
  readonly height: number
  /** ISO8601. */
  readonly capturedAt: string
  /** 위치 값이 하나라도 있으면 true → 후보에서 뺀다. */
  readonly hasLocation: boolean
  /** 사진에 남긴 글 원문(없으면 null). */
  readonly note: string | null
  /** 사진이 속한 데이트 구간의 장소 이름(없으면 null). */
  readonly placeName: string | null
}

export interface PrintedPhoto {
  readonly path: string
  readonly width: number
  readonly height: number
  readonly capturedAt: string
}

export interface PhotoBreak {
  readonly photo: PrintedPhoto
  /** 사용자 글이면 원문 그대로(`captionSource = 'note'`), 아니면 날짜 · 장소. */
  readonly caption: string
  readonly captionSource: 'note' | 'date_place'
}

export interface CalendarMark {
  /** 'YYYY-MM-DD'. */
  readonly date: string
  readonly label: string
}

export interface MonthCalendar {
  /** 'YYYY-MM'. */
  readonly month: string
  readonly year: number
  readonly monthNumber: number
  readonly days: number
  /** 1일의 요일(0 = 일요일). */
  readonly firstWeekday: number
  readonly marks: readonly CalendarMark[]
}

const MILESTONE_DAY_STEP = 100
const MILESTONE_YEAR_DAYS = 365
/** 사진 한 장 최대 면 수(기획서 3절 "최대 2면"). */
export const PHOTO_BREAK_MAX = 2
/** 엽서 최대 장 수(기획서 2절 11.). */
export const POSTCARD_MAX = 2

// ---------------------------------------------------------------------------
// 날짜 (Date 객체 0 - 엔진 결정론 규칙)
// ---------------------------------------------------------------------------

function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y
  const era = Math.floor(yy / 400)
  const yoe = yy - era * 400
  const mp = (m + 9) % 12
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

function civilFromDays(n: number): [number, number, number] {
  const z = n + 719468
  const era = Math.floor(z / 146097)
  const doe = z - era * 146097
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365)
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1
  const m = mp < 10 ? mp + 3 : mp - 9
  return [yoe + era * 400 + (m <= 2 ? 1 : 0), m, d]
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function parseDay(date: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  if (m === null) throw new RangeError(`날짜는 YYYY-MM-DD여야 한다 (${date})`)
  return daysFromCivil(Number(m[1]), Number(m[2]), Number(m[3]))
}

function dayKey(n: number): string {
  const [y, m, d] = civilFromDays(n)
  return `${y}-${pad2(m)}-${pad2(d)}`
}

/** 기간 끝(포함, 'YYYY-MM-DD')의 다음 달 'YYYY-MM'. */
export function nextMonthOf(periodEndInclusive: string): string {
  const [y, m] = civilFromDays(parseDay(periodEndInclusive) + 1)
  return `${y}-${pad2(m)}`
}

function monthBounds(month: string): { first: number; days: number; year: number; monthNumber: number } {
  const mm = /^(\d{4})-(\d{2})$/.exec(month)
  if (mm === null) throw new RangeError(`달은 YYYY-MM이어야 한다 (${month})`)
  const year = Number(mm[1])
  const monthNumber = Number(mm[2])
  const first = daysFromCivil(year, monthNumber, 1)
  const next = monthNumber === 12 ? daysFromCivil(year + 1, 1, 1) : daysFromCivil(year, monthNumber + 1, 1)
  return { first, days: next - first, year, monthNumber }
}

/**
 * 그 달 안의 관계 기념일(R157-6 — 생일 0). `relationshipStart`가 null이면 빈 목록.
 * 날 세기 = 사귄 날 1일째(`computeDaysTogetherKst`와 같음).
 */
export function relationshipMilestonesInMonth(relationshipStart: string | null, month: string): CalendarMark[] {
  if (relationshipStart === null) return []
  const start = parseDay(relationshipStart)
  const { first, days } = monthBounds(month)
  const marks: CalendarMark[] = []
  for (let n = first; n < first + days; n += 1) {
    const dayCount = n - start + 1
    if (dayCount <= 0) continue
    if (dayCount % MILESTONE_YEAR_DAYS === 0) marks.push({ date: dayKey(n), label: `${dayCount / MILESTONE_YEAR_DAYS}주년` })
    else if (dayCount % MILESTONE_DAY_STEP === 0) marks.push({ date: dayKey(n), label: `${dayCount}일` })
  }
  return marks
}

export function monthCalendar(month: string, relationshipStart: string | null): MonthCalendar {
  const { first, days, year, monthNumber } = monthBounds(month)
  // 1970-01-01(day 0)은 목요일(4).
  const firstWeekday = (((first + 4) % 7) + 7) % 7
  return { month, year, monthNumber, days, firstWeekday, marks: relationshipMilestonesInMonth(relationshipStart, month) }
}

// ---------------------------------------------------------------------------
// 사진
// ---------------------------------------------------------------------------

function sortedCandidates(photos: readonly PhotoCandidate[]): PhotoCandidate[] {
  return photos
    .filter((p) => !p.hasLocation)
    .sort((x, y) => {
      const dx = Date.parse(x.capturedAt)
      const dy = Date.parse(y.capturedAt)
      return dx - dy || (x.entryId < y.entryId ? -1 : x.entryId > y.entryId ? 1 : 0)
    })
}

function printed(p: PhotoCandidate): PrintedPhoto {
  return { path: p.path, width: p.width, height: p.height, capturedAt: p.capturedAt }
}

/** KST 'MM.DD'. */
function kstMmDd(iso: string): string {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) throw new RangeError(`시각을 해석할 수 없다 (${iso})`)
  const [, m, d] = civilFromDays(Math.floor((ms + 9 * 3600 * 1000) / 86400000))
  return `${pad2(m)}.${pad2(d)}`
}

export function choosePostcards(photos: readonly PhotoCandidate[]): PrintedPhoto[] {
  const c = sortedCandidates(photos)
  if (c.length === 0) return []
  if (c.length === 1) return [printed(c[0])]
  return [printed(c[0]), printed(c[c.length - 1])]
}

/**
 * 사진 한 장 후보(쪽 수 맞춤에서 앞에서부터 쓴다). `shownElsewhere` = 다른 코너 content에 실린 목적지 경로.
 */
export function choosePhotoBreaks(
  photos: readonly PhotoCandidate[],
  postcards: readonly PrintedPhoto[],
  shownElsewhere: ReadonlySet<string>,
): PhotoBreak[] {
  const used = new Set(postcards.map((p) => p.path))
  const rest = sortedCandidates(photos).filter((p) => !used.has(p.path))
  const ordered = [...rest.filter((p) => !shownElsewhere.has(p.path)), ...rest.filter((p) => shownElsewhere.has(p.path))]
  return ordered.slice(0, PHOTO_BREAK_MAX).map((p) => {
    const note = p.note !== null && p.note.trim() !== '' ? p.note : null
    if (note !== null) return { photo: printed(p), caption: note, captionSource: 'note' as const }
    const day = kstMmDd(p.capturedAt)
    return { photo: printed(p), caption: p.placeName !== null && p.placeName.trim() !== '' ? `${day} · ${p.placeName}` : day, captionSource: 'date_place' as const }
  })
}

// ---------------------------------------------------------------------------
// 다음 달 · 판권
// ---------------------------------------------------------------------------

export interface NextMonthFacts {
  readonly month: string
  readonly monthNumber: number
  readonly milestones: readonly CalendarMark[]
  /** 다음 달에 발행 조건이 생길 수 있는 코너(지금 0 - 특별 게스트는 2.0-C). */
  readonly openingCorners: readonly string[]
}

/** 기념일이 하나도 없으면 null(면이 빠진다). */
export function nextMonthFacts(periodEndInclusive: string, relationshipStart: string | null): NextMonthFacts | null {
  const month = nextMonthOf(periodEndInclusive)
  const milestones = relationshipMilestonesInMonth(relationshipStart, month)
  if (milestones.length === 0) return null
  return { month, monthNumber: Number(month.slice(5, 7)), milestones, openingCorners: [] }
}

export interface ColophonFacts {
  /** "2026년 9월호". */
  readonly editionLabel: string
  /** `issues.issue_number`(없으면 null). */
  readonly editionNumber: number | null
  readonly periodStart: string
  readonly periodEnd: string
  readonly maker: string
  /** "가람 · 나래". */
  readonly names: string
  readonly nickname: string | null
  readonly correction: { readonly path: string; readonly email: string }
}

export const COLOPHON_MAKER = '온도록'
/** 정정 창구 — 앱 설정 › 앱 정보 › 문의하기(기획서 "설정 › 문의"). */
export const COLOPHON_CORRECTION_PATH = '설정 › 문의'

export function colophonFacts(params: {
  readonly periodStart: string
  readonly periodEnd: string
  readonly editionNumber: number | null
  readonly names: readonly [string, string]
  readonly nickname: string | null
  /** 운영 문의 상수(`web/src/legal/consent.ts` `LEGAL_CONTACT_EMAIL`)를 호출부가 넘긴다 - 값을 이 파일에 쓰지 않는다. */
  readonly contactEmail: string
}): ColophonFacts {
  const [y, m] = civilFromDays(parseDay(params.periodStart))
  return {
    editionLabel: `${y}년 ${m}월호`,
    editionNumber: params.editionNumber,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
    maker: COLOPHON_MAKER,
    names: `${params.names[0]} · ${params.names[1]}`,
    nickname: params.nickname,
    correction: { path: COLOPHON_CORRECTION_PATH, email: params.contactEmail },
  }
}
