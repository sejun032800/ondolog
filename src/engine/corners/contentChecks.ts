/**
 * 84-c 매거진 AI 자동 검사 - 칸별 말투 · 숫자/시각 · 요일 (ROADMAP r133 R133-4 · R133-5).
 * 위임: .claude/state/prompts/phase-7/84-c-dispatch-auto-checks.md
 *
 * 순수 함수(시계 · 난수 · 환경변수 0). 걸리면 골격이 `schema_invalid`로 기록한다 → 기존 1회 재요청(검사 결과를 알려 줌)
 * → 또 걸리면 코너 빠짐(`cornerPipeline.ts`). 상세 문자열에는 **칸 · 규칙 · 짧은 표기(시각 · 요일 낱말)만** 넣고 문장은 넣지 않는다.
 *
 * 공통: 따옴표(" " ' ' “ ” ‘ ’ 「 」 『 』) 안의 글은 원문 인용으로 보고 **모든 검사에서 뺀다**.
 *
 * ① 말투(R133-4) - 문장 끝으로 분류한다.
 *   - 글 칸(text): 합니다체만.
 *   - 라벨 칸(label): 명사형 · 연결형("~있어서") · 합니다체. ~다체 · 반말 · 해요체는 안 됨.
 *   - 질문 칸(question): 해요체만("~요?" · "~까요?" · "~나요?" · "~가요?", 물음표 없어도 됨).
 * ② 숫자 · 시각 - 입력값 그대로. 시각 형식 "오전/오후 h시 m분"(정각 "h시") · "정오" · "자정". 24시 표기 · "HH:MM" · "반" ·
 *   오전/오후 없는 시각은 형식 위반. 값은 그 칸이 볼 수 있는 입력 시각과 같아야 한다(반올림 0). 날짜("9월 13일" · "13일" ·
 *   "9월")와 사진 장수("사진 n장")도 입력에 있는 값만. 그 밖의 아라비아 숫자는 입력에 나온 숫자만.
 *   한글 수사("두 곳" · "세 번" · "이틀 전" · "엿새 전")는 **사진 장수 말고는 검사하지 않는다**(HANDOFF 84-c 결정 기록 "확인 필요").
 * ③ 요일 - 요일 낱말(월요일~일요일 · 주말 · 평일)이 그 문장의 날짜(없으면 칸의 근거 날짜가 하나일 때 그 날짜)의 실제 요일과
 *   맞아야 한다. 날짜를 하나로 정할 수 없으면 실패.
 */

// ---------------------------------------------------------------------------
// 공통: 인용 빼기 · 문장 나누기
// ---------------------------------------------------------------------------

const QUOTE_PATTERNS: readonly RegExp[] = [/"[^"]*"/g, /'[^']*'/g, /“[^”]*”/g, /‘[^’]*’/g, /「[^」]*」/g, /『[^』]*』/g]

/** 따옴표 안의 글(원문 인용)을 지운다 - 검사 대상이 아니다. */
export function stripQuoted(text: string): string {
  let out = text
  for (const p of QUOTE_PATTERNS) out = out.replace(p, ' ')
  return out
}

/** 문장 나누기 - 마침표 · 물음표 · 느낌표 · 말줄임표 뒤의 공백이나 줄바꿈에서. 마지막 문장은 끝 부호가 없어도 된다. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!…？！])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

// ---------------------------------------------------------------------------
// ① 말투
// ---------------------------------------------------------------------------

export type FieldTone = 'text' | 'label' | 'question'
export type EndingClass = 'hapnida' | 'haeyo' | 'da' | 'banmal' | 'noun' | 'connective' | 'empty'

export const ENDING_LABEL: Readonly<Record<EndingClass, string>> = {
  hapnida: '합니다체',
  haeyo: '해요체',
  da: '~다체',
  banmal: '반말',
  noun: '명사형',
  connective: '연결형',
  empty: '빈 문장',
}

export const TONE_LABEL: Readonly<Record<FieldTone, string>> = { text: '글 칸', label: '라벨 칸', question: '질문 칸' }

/** 칸마다 허용되는 문장 끝(R133-4 표). */
export const ALLOWED_ENDINGS: Readonly<Record<FieldTone, readonly EndingClass[]>> = {
  text: ['hapnida'],
  label: ['noun', 'connective', 'hapnida'],
  question: ['haeyo'],
}

const HANGUL_BASE = 0xac00
const HANGUL_LAST = 0xd7a3

/** 한글 음절의 받침 번호(0 = 없음). 한글이 아니면 -1. */
function jongseong(ch: string | undefined): number {
  if (ch === undefined) return -1
  const c = ch.codePointAt(0) ?? 0
  if (c < HANGUL_BASE || c > HANGUL_LAST) return -1
  return (c - HANGUL_BASE) % 28
}

const J = { ㄱ: 1, ㄴ: 4, ㄶ: 6, ㄹ: 8, ㅁ: 16, ㅂ: 17, ㅄ: 18, ㅆ: 20, ㅌ: 25, ㅎ: 27 } as const
/** "~다" 앞 음절이 이 받침이면 용언의 끝으로 본다(했다 · 한다 · 없다 · 좋다 · 많다 · 같다 · 길다 · 남다 · 춥다 · 먹다). */
const DA_BATCHIM = new Set<number>([J.ㄱ, J.ㄴ, J.ㄶ, J.ㄹ, J.ㅁ, J.ㅂ, J.ㅄ, J.ㅆ, J.ㅌ, J.ㅎ])
/** 받침 없는 음절 + "다"로 용언이 되는 흔한 경우(이다 · 하다 · 되다 · 지다 · 리다 · 기다 · 시다 · 주다 · 치다 · 가다 · 오다 · 보다 · 나다 · 서다 · 쓰다). "바다"는 들지 않는다. */
const DA_OPEN_SYLLABLES = new Set(['이', '하', '되', '지', '리', '기', '시', '주', '치', '가', '오', '보', '나', '서', '쓰', '내', '해'])

function isDaEnding(t: string): boolean {
  if (!t.endsWith('다')) return false
  const chars = Array.from(t)
  const prev = chars[chars.length - 2]
  if (prev === undefined) return false
  if (prev === '니') return false // ~니다는 합니다체(앞에서 걸러짐)
  const j = jongseong(prev)
  if (j > 0) return DA_BATCHIM.has(j)
  return j === 0 && DA_OPEN_SYLLABLES.has(prev)
}

/** 반말 끝 - 용언 활용으로 확실한 것만(명사 라벨이 걸리지 않게). 물음표로 끝나는 문장은 따로 본다. */
function isBanmalEnding(t: string): boolean {
  const chars = Array.from(t)
  const last = chars[chars.length - 1]
  const prev = chars[chars.length - 2]
  // 했어 · 갔지 · 좋았네 · 있구나 · 봤잖아 · 했거든 (ㅆ · ㅄ 받침 + 반말 어미)
  if (/(어|지|네|구나|잖아|거든|군)$/.test(t)) {
    const before = Array.from(t.replace(/(어|지|네|구나|잖아|거든|군)$/, ''))
    const b = before[before.length - 1]
    const bj = jongseong(b)
    if (bj === J.ㅆ || bj === J.ㅄ) return true
  }
  // 볼까 · 할게 · 갈래 · 할걸 (ㄹ 받침 + 까/게/래/걸)
  if (last !== undefined && ['까', '게', '래', '걸'].includes(last) && jongseong(prev) === J.ㄹ) return true
  // 가자 · 먹자 · 해보자 · 걷자
  if (/(하|해|가|보|먹|걷|놀|쉬|타|오|만나|가보|해보|들르|들러보)자$/.test(t)) return true
  // 이야 · 거야 · 잖아 · 봐 · 줘 · 해봐 · 좋아 · 싫어 · 맞아 · 그래
  if (/(이야|거야|거지|잖아|구나|더라|던데|해봐|해줘|봐|줘|좋아|싫어|맞아|그래|몰라|알아)$/.test(t)) return true
  return false
}

/**
 * 연결형 끝("~있어서" · "~보내서" · "~하고" · "~면"). 명사 끝("최고" · "냉면")도 걸릴 수 있지만 라벨 칸에서는 명사형 · 연결형이
 * 모두 허용이고, 글 · 질문 칸에서는 둘 다 위반이라 판정이 달라지지 않는다.
 */
const CONNECTIVE = /(서|고|며|면|는데|은데|지만|도록|려고)$/

/** 문장 하나의 끝을 분류한다(따옴표 인용은 미리 지운 문장을 넘긴다). */
export function classifyEnding(sentence: string): EndingClass {
  let t = sentence.trim()
  const tail = (t.match(/[^\p{L}\p{N}]*$/u) ?? [''])[0]
  const question = /[?？]/.test(tail)
  // 끝의 괄호 덧말("(사진 3장)", 뒤에 마침표가 와도)은 문장 끝이 아니다.
  for (;;) {
    const next = t.replace(/[^\p{L}\p{N})\]）］]+$/u, '').replace(/\s*[(\[（［][^()\[\]（）［］]*[)\]）］]$/, '')
    if (next === t) break
    t = next
  }
  t = t.replace(/[^\p{L}\p{N}]+$/u, '')
  if (t.length === 0) return 'empty'
  if (/[A-Za-z0-9]$/.test(t)) return 'noun' // 영어 · 숫자로 끝남 = 이름 붙이는 말
  if (/(니다|니까)$/.test(t)) return 'hapnida'
  if (/(요|죠)$/.test(t)) return 'haeyo'
  if (question) return 'banmal' // 물음표로 끝나는데 해요체 · 합니다체가 아님("~의향은?" · "~볼까?" · "~꼽는다면?")
  if (isDaEnding(t)) return 'da'
  if (isBanmalEnding(t)) return 'banmal'
  if (CONNECTIVE.test(t)) return 'connective'
  return 'noun'
}

/** 칸 하나의 말투 위반(문장 끝 분류 이름, 중복 없음). 인용은 뺀다. */
export function toneViolations(value: string, tone: FieldTone): EndingClass[] {
  const found: EndingClass[] = []
  for (const s of splitSentences(stripQuoted(value))) {
    const c = classifyEnding(s)
    if (c === 'empty') continue
    if (!ALLOWED_ENDINGS[tone].includes(c) && !found.includes(c)) found.push(c)
  }
  return found
}

// ---------------------------------------------------------------------------
// ② 숫자 · 시각
// ---------------------------------------------------------------------------

/** 한 칸이 볼 수 있는 입력값들. `createNumberFacts`로 만든다. */
export interface NumberFacts {
  /** 하루 안의 분(0~1439) - 오전/오후 시각이 이 중 하나여야 한다. */
  readonly minutes: ReadonlySet<number>
  /** 'YYYY-MM-DD' (KST). */
  readonly dates: ReadonlySet<string>
  readonly photoCounts: ReadonlySet<number>
  /** 그 밖에 입력에 나온 숫자(원문 · 장수 · 날짜 조각 · 시각 조각). */
  readonly numbers: ReadonlySet<number>
}

export interface NumberFactsBuilder {
  /** ISO 시각(+09:00 등) - 분 · 날짜 · 숫자 조각. */
  addInstant(iso: string): void
  /** 'YYYY-MM-DD'. */
  addDate(date: string): void
  /** 'HH:MM'(정거장 표시 시각). */
  addClock(clock: string): void
  /** 원문(메시지 · 메모) - 안의 시각("7시" · "12시 반" · "11:20")과 숫자. 오전/오후를 모르므로 두 쪽 다 넣는다. */
  addText(text: string): void
  addPhotoCount(n: number): void
  addNumber(n: number): void
  build(): NumberFacts
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

const DAY_MS = 24 * 60 * 60 * 1000

/** 1970-01-01부터의 날 수 -> 'YYYY-MM-DD'(그레고리력, 순수 계산 - 엔진 결정론 규칙 A로 `Date` 객체를 만들지 않는다). */
function civilFromDays(days: number): string {
  const z = days + 719468
  const era = Math.floor(z / 146097)
  const doe = z - era * 146097
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365)
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1
  const m = mp < 10 ? mp + 3 : mp - 9
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0)
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** ISO 시각 -> KST 'YYYY-MM-DD' · 분. 해석할 수 없으면 null. */
export function kstParts(iso: string): { readonly date: string; readonly minute: number } | null {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  const local = ms + KST_OFFSET_MS
  const days = Math.floor(local / DAY_MS)
  const minute = Math.floor((local - days * DAY_MS) / 60000)
  return { date: civilFromDays(days), minute }
}

export function createNumberFacts(): NumberFactsBuilder {
  const minutes = new Set<number>()
  const dates = new Set<string>()
  const photoCounts = new Set<number>()
  const numbers = new Set<number>()
  const addDate = (date: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
    if (m === null) return
    dates.add(`${m[1]}-${m[2]}-${m[3]}`)
    numbers.add(Number(m[1]))
    numbers.add(Number(m[2]))
    numbers.add(Number(m[3]))
  }
  const addMinute = (minute: number) => {
    minutes.add(minute)
    const h = Math.floor(minute / 60)
    numbers.add(h)
    numbers.add(h % 12 === 0 ? 12 : h % 12)
    numbers.add(minute % 60)
  }
  return {
    addInstant(iso) {
      const p = kstParts(iso)
      if (p === null) return
      addDate(p.date)
      addMinute(p.minute)
    },
    addDate,
    addClock(clock) {
      const m = /^(\d{1,2}):(\d{2})/.exec(clock)
      if (m !== null) addMinute(Number(m[1]) * 60 + Number(m[2]))
    },
    addText(text) {
      for (const m of text.matchAll(/(\d{1,2})\s*:\s*(\d{2})/g)) addMinute(Number(m[1]) * 60 + Number(m[2]))
      for (const m of text.matchAll(/(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분|\s*(반))?/g)) {
        const h = Number(m[1])
        const min = m[2] !== undefined ? Number(m[2]) : m[3] !== undefined ? 30 : 0
        if (h <= 24) {
          addMinute((h % 24) * 60 + min)
          if (h < 12) addMinute((h + 12) * 60 + min)
        }
      }
      for (const m of text.matchAll(/\d+/g)) numbers.add(Number(m[0]))
    },
    addPhotoCount(n) {
      photoCounts.add(n)
      numbers.add(n)
    },
    addNumber(n) {
      numbers.add(n)
    },
    build: () => ({ minutes, dates, photoCounts, numbers }),
  }
}

const NATIVE_NUMERALS: Readonly<Record<string, number>> = {
  한: 1,
  두: 2,
  세: 3,
  네: 4,
  다섯: 5,
  여섯: 6,
  일곱: 7,
  여덟: 8,
  아홉: 9,
  열: 10,
}

function minuteLabel(minute: number): string {
  const h = Math.floor(minute / 60)
  const m = minute % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * 칸 하나의 숫자 · 시각 위반. 반환하는 것은 규칙과 그 표기 조각뿐이다("시각 24시 표기 「13시 10분」").
 */
export function numberViolations(value: string, facts: NumberFacts): string[] {
  const out: string[] = []
  let rest = stripQuoted(value)
  const consume = (match: string) => {
    rest = rest.replace(match, ' ')
  }

  // 시각 - "HH:MM"
  for (const m of [...rest.matchAll(/(\d{1,2}):(\d{2})/g)]) {
    out.push(`시각 숫자 표기 「${m[0]}」(오전/오후 h시 m분으로)`)
    consume(m[0])
  }
  // 시각 - "[앞말] h시 [m분|반]"
  const TIME = /(오전|오후|새벽|아침|낮|저녁|밤)?\s*(\d{1,2})\s*시(?![간각장청내작기절즌점대])(?:\s*(\d{1,2})\s*분|\s*(반))?/g
  for (const m of [...rest.matchAll(TIME)]) {
    const token = m[0].trim()
    const prefix = m[1]
    const h = Number(m[2])
    const min = m[3] !== undefined ? Number(m[3]) : 0
    consume(m[0])
    if (h >= 13 || h === 0 || h > 24) {
      out.push(`시각 24시 표기 「${token}」`)
      continue
    }
    if (prefix !== '오전' && prefix !== '오후') {
      out.push(`시각 형식 「${token}」(오전/오후 없음)`)
      continue
    }
    if (m[4] !== undefined) {
      out.push(`시각 형식 「${token}」("반" 대신 30분)`)
      continue
    }
    const minute = (prefix === '오전' ? h % 12 : (h % 12) + 12) * 60 + min
    if (!facts.minutes.has(minute)) out.push(`입력에 없는 시각 「${token}」(${minuteLabel(minute)})`)
  }
  for (const m of [...rest.matchAll(/정오|자정/g)]) {
    const minute = m[0] === '정오' ? 720 : 0
    consume(m[0])
    if (!facts.minutes.has(minute)) out.push(`입력에 없는 시각 「${m[0]}」`)
  }

  // 상대 기간("1년 전" · "3일 뒤" · "2주 만")은 기준일을 정할 수 없어 검사하지 않는다(결정 기록 "확인 필요").
  for (const m of [...rest.matchAll(/\d+\s*(?:년|개월|달|주|일|시간)\s*(?:전|후|뒤|만|동안|째)/g)]) consume(m[0])

  // 날짜
  const known = [...facts.dates]
  for (const m of [...rest.matchAll(/(\d{4})\s*년/g)]) {
    consume(m[0])
    if (!known.some((d) => d.startsWith(`${m[1]}-`))) out.push(`입력에 없는 연도 「${m[0]}」`)
  }
  for (const m of [...rest.matchAll(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/g)]) {
    consume(m[0])
    const md = `-${String(Number(m[1])).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}`
    if (!known.some((d) => d.endsWith(md))) out.push(`입력에 없는 날짜 「${m[0]}」`)
  }
  for (const m of [...rest.matchAll(/(\d{1,2})\s*일(?![간째])/g)]) {
    consume(m[0])
    const dd = `-${String(Number(m[1])).padStart(2, '0')}`
    if (!known.some((d) => d.endsWith(dd))) out.push(`입력에 없는 날짜 「${m[0]}」`)
  }
  for (const m of [...rest.matchAll(/(\d{1,2})\s*월/g)]) {
    consume(m[0])
    const mm = `-${String(Number(m[1])).padStart(2, '0')}-`
    if (!known.some((d) => d.includes(mm))) out.push(`입력에 없는 달 「${m[0]}」`)
  }

  // 사진 장수(아라비아 숫자 · 한글 수사 1~10)
  const PHOTO = /사진[^.?!\d]{0,8}?(\d+|다섯|여섯|일곱|여덟|아홉|한|두|세|네|열)\s*장(?![면소난기])/g
  for (const m of [...rest.matchAll(PHOTO)]) {
    const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NATIVE_NUMERALS[m[1]]
    consume(m[0])
    if (n !== undefined && !facts.photoCounts.has(n)) out.push(`입력에 없는 사진 장수 「${m[1]}장」`)
  }

  // 그 밖의 아라비아 숫자
  for (const m of [...rest.matchAll(/\d+(?:\.\d+)?/g)]) {
    if (!facts.numbers.has(Number(m[0]))) out.push(`입력에 없는 숫자 「${m[0]}」`)
  }
  return out
}

// ---------------------------------------------------------------------------
// ③ 요일
// ---------------------------------------------------------------------------

export const WEEKDAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'] as const

/** 'YYYY-MM-DD'의 요일(달력 날짜 그대로 - KST 날짜를 넘긴다). */
export function weekdayOf(date: string): (typeof WEEKDAY_NAMES)[number] {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  const days = Math.floor(Date.UTC(y, m - 1, d) / DAY_MS) // 1970-01-01 = 목요일(4)
  return WEEKDAY_NAMES[(((days + 4) % 7) + 7) % 7]
}

/** ISO 시각의 KST 요일. */
export function kstWeekdayOf(iso: string): (typeof WEEKDAY_NAMES)[number] | null {
  const p = kstParts(iso)
  return p === null ? null : weekdayOf(p.date)
}

const WEEKDAY_WORD = /([월화수목금토일])요일|주말|평일/g

function matchesWeekday(word: string, date: string): boolean {
  const w = weekdayOf(date)
  if (word === '주말') return w === '토요일' || w === '일요일'
  if (word === '평일') return w !== '토요일' && w !== '일요일'
  return w === word
}

/**
 * 칸 하나의 요일 위반. `contextDates` = 이 칸의 근거 날짜(기사 근거 · 대화 턴 · 데이트), `knownDates` = 입력 전체의 날짜.
 * 같은 문장에 날짜가 있으면 요일 낱말 바로 앞(없으면 뒤)의 날짜를, 없으면 근거 날짜가 하나일 때 그 날짜를 쓴다.
 */
export function weekdayViolations(value: string, contextDates: readonly string[], knownDates: readonly string[]): string[] {
  const out: string[] = []
  const context = [...new Set(contextDates.map((d) => d.slice(0, 10)))]
  const known = [...new Set([...knownDates, ...contextDates].map((d) => d.slice(0, 10)))]
  for (const sentence of splitSentences(stripQuoted(value))) {
    const words = [...sentence.matchAll(WEEKDAY_WORD)]
    if (words.length === 0) continue
    // 문장 안의 날짜(위치와 함께)
    const mentions: { index: number; dates: string[] }[] = []
    const md = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/g
    const covered: [number, number][] = []
    for (const m of sentence.matchAll(md)) {
      const suffix = `-${String(Number(m[1])).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}`
      const cands = known.filter((d) => d.endsWith(suffix))
      mentions.push({ index: m.index ?? 0, dates: cands.length > 0 ? cands : [] })
      covered.push([m.index ?? 0, (m.index ?? 0) + m[0].length])
    }
    for (const m of sentence.matchAll(/(\d{1,2})\s*일(?![간째])/g)) {
      const at = m.index ?? 0
      if (covered.some(([a, b]) => at >= a && at < b)) continue
      const suffix = `-${String(Number(m[1])).padStart(2, '0')}`
      const inContext = context.filter((d) => d.endsWith(suffix))
      const cands = inContext.length > 0 ? inContext : known.filter((d) => d.endsWith(suffix))
      mentions.push({ index: at, dates: cands })
    }
    for (const w of words) {
      const word = w[0]
      const at = w.index ?? 0
      let dates: string[]
      if (mentions.length > 0) {
        const before = mentions.filter((x) => x.index < at)
        const pick = before.length > 0 ? before[before.length - 1] : mentions.find((x) => x.index > at)!
        dates = pick.dates
      } else {
        dates = context
      }
      if (dates.length !== 1) {
        out.push(`요일 「${word}」의 날짜를 정할 수 없음`)
        continue
      }
      if (!matchesWeekday(word, dates[0])) out.push(`요일 「${word}」≠ ${dates[0]}(${weekdayOf(dates[0])})`)
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// 칸 묶음 실행
// ---------------------------------------------------------------------------

/** 검사할 칸 하나. 코너가 LLM 출력과 입력으로 만든다. */
export interface ContentTarget {
  /** 'articles[0].body' 꼴. */
  readonly field: string
  readonly tone: FieldTone
  readonly text: string
  readonly facts: NumberFacts
  readonly contextDates: readonly string[]
  readonly knownDates: readonly string[]
}

/** 칸 묶음의 위반 목록 - "칸: 규칙" 꼴(문장 0). 빈 배열이면 통과. */
export function runContentChecks(targets: readonly ContentTarget[]): string[] {
  const out: string[] = []
  for (const t of targets) {
    for (const c of toneViolations(t.text, t.tone)) {
      out.push(`${t.field}: 말투 ${ENDING_LABEL[c]} (${TONE_LABEL[t.tone]} 허용: ${ALLOWED_ENDINGS[t.tone].map((e) => ENDING_LABEL[e]).join('·')})`)
    }
    for (const v of numberViolations(t.text, t.facts)) out.push(`${t.field}: ${v}`)
    for (const v of weekdayViolations(t.text, t.contextDates, t.knownDates)) out.push(`${t.field}: ${v}`)
  }
  return out
}

/** 재요청 프롬프트에 붙이는 블록 - 어느 칸이 어떤 규칙을 어겼는지만(문장 0). */
export function retryHintText(violations: readonly string[]): string {
  return [
    '앞의 응답이 검사에 걸렸다. 아래 칸을 규칙에 맞게 고쳐 같은 형식의 JSON 전체를 처음부터 다시 낸다. 나머지 지시는 그대로 지킨다.',
    ...violations.map((v) => `- ${v}`),
  ].join('\n')
}
