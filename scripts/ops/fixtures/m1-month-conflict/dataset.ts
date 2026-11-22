/**
 * 84-g ④(ROADMAP r143 R143-3 ④) 자기 점검 시험 데이터 `m1-month-conflict` - **다정한 말 코너만** 이 데이터로 돈다
 * (하네스 `--fixture m1-month-conflict --corner sweet_words`). 전부 지어낸 대화다. 실제 사람의 대화가 아니다.
 *
 * 바탕 = `../m1-month/`(그 파일은 그대로 - 이 파일이 행을 **더할** 뿐). 더하는 것: 다툰 날(09-16 · 09-17)과 화해 직후(09-18 아침)의
 * **다정해 보이는 줄** - 표현만 보면 다정하지만 다툼 맥락은 앞뒤 메시지에만 있다. 다른 날의 다정한 말 후보(09-05 · 09-12 · 09-20 ·
 * 09-28)는 바탕 그대로 남는다(고를 것이 충분해야 "다툰 날을 고르지 않는 것"을 잴 수 있다).
 *
 * 집계(`selfCheckTally.ts`)가 쓰는 "다툰 날 · 화해 줄" = 다툰 날(09-16 · 09-17)의 모든 메시지 + 아래 화해 직후 줄(09-18 표시분).
 */

import { buildTables, COUPLE_ID, FIXTURE_YEAR, SEJUN_ID, SEOYOUNG_ID } from '../m1-month/dataset.ts'

export const CONFLICT_FIXTURE = 'm1-month-conflict'

/** 다툰 날(월-일). 바탕 `m1Review.ts` `ARGUMENT_DAYS`와 같다. */
export const CONFLICT_DAYS = ['09-16', '09-17'] as const

/**
 * 더하는 줄 - `## MM-DD` 다음 `HH:MM 준|영 본문`(바탕 `chat.ts`와 같은 형식). `[화해]`로 시작하는 줄은 다툰 날 밖이지만 화해 맥락이다
 * (표시는 행에 들어가지 않는다 - 지운다).
 */
export const CONFLICT_EXTRA_SCRIPT = `
## 09-16
13:32 준 그래도 서운한 거 말해줘서 고마워
21:38 준 고마워 들어줘서
21:39 영 응 나도 고마워 잘 자
21:40 준 사랑해 내일 얘기하자

## 09-17
09:37 영 미안해 그리고 고마워
09:38 준 나도 미안해 먼저 말 꺼내줘서 고마워
20:01 영 역시 너랑 얘기하면 풀려서 좋다
20:03 준 고마워 오늘 하루 버틸 수 있었어

## 09-18
08:40 영 [화해] 어제 먼저 미안하다고 해줘서 고마웠어
08:42 준 [화해] 나도. 우리 서운한 거 있으면 바로 말하기
`

type Row = Record<string, unknown>

const RECONCILE_MARK = '[화해] '

interface ExtraLine {
  readonly id: string
  readonly monthDay: string
  readonly hhmm: string
  readonly sender: string
  readonly body: string
  readonly reconcile: boolean
}

function parseExtra(): ExtraLine[] {
  const out: ExtraLine[] = []
  let monthDay = ''
  for (const raw of CONFLICT_EXTRA_SCRIPT.split('\n')) {
    const line = raw.trimEnd()
    if (line.trim() === '') continue
    const header = /^## (\d{2}-\d{2})$/.exec(line)
    if (header !== null) {
      monthDay = header[1]
      continue
    }
    const m = /^(\d{2}:\d{2}) (준|영) (.+)$/.exec(line)
    if (m === null || monthDay === '') throw new Error(`채팅 줄 형식 오류: ${line}`)
    const reconcile = m[3].startsWith(RECONCILE_MARK)
    out.push({
      id: `msg-c${String(out.length + 1).padStart(3, '0')}`,
      monthDay,
      hhmm: m[1],
      sender: m[2] === '준' ? SEJUN_ID : SEOYOUNG_ID,
      body: reconcile ? m[3].slice(RECONCILE_MARK.length) : m[3],
      reconcile,
    })
  }
  return out
}

/** 바탕 표 + 더한 줄. 바탕 행은 그대로(같은 id · 같은 원문). `year`는 바탕과 같은 뜻. */
export function buildConflictTables(year: number = FIXTURE_YEAR): Record<string, readonly Row[]> {
  const base = buildTables(year)
  const extra: Row[] = parseExtra().map((l) => ({
    id: l.id,
    couple_id: COUPLE_ID,
    sender_id: l.sender,
    body: l.body,
    sent_at: `${year}-${l.monthDay}T${l.hhmm}:00+09:00`,
    deleted_at: null,
  }))
  return { ...base, messages: [...base.messages, ...extra] }
}

/** 더한 줄의 id(시험 · 문서용). */
export function conflictExtraIds(): string[] {
  return parseExtra().map((l) => l.id)
}

/**
 * "다툰 날 · 화해 줄"의 메시지 id - 다툰 날(KST 월-일) 메시지 전부 + 화해 직후로 표시한 더한 줄. 집계가 이 목록으로 센다.
 * 표(`buildConflictTables`)를 받아 계산한다(연도와 무관 - 월-일로 본다).
 */
export function conflictContextIds(tables: Record<string, readonly Row[]> = buildConflictTables()): Set<string> {
  const ids = new Set<string>()
  for (const row of tables.messages ?? []) {
    const at = String(row.sent_at ?? '')
    if ((CONFLICT_DAYS as readonly string[]).includes(at.slice(5, 10))) ids.add(String(row.id))
  }
  for (const l of parseExtra()) if (l.reconcile) ids.add(l.id)
  return ids
}
