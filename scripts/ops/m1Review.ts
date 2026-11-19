/**
 * M1 품질 하네스의 판정 자료(review.md · summary.md) 만들기 - `m1QualityRun.ts`의 도우미(순수 함수 · 파일 0).
 * 84-a2(ROADMAP r131 R131-2 ② ③)에서 하네스 본문에서 떼어 냈다 - 시험이 Deno 실행 없이 부를 수 있게.
 *
 * - 호출 수 = `sentCalls(record)` = 실제로 보낸 HTTP 요청 수(`httpCalls.length`). 화면 줄 `calls=` · runs json ·
 *   review · summary가 같은 수를 쓴다(84-b 1차의 `calls=3` 대 "호출 1" 차이를 없앰).
 * - 말투 칸 = "합니다체 밖"(회차 칸 · 모델별 집계 기준 문단).
 */

import { HARNESS_BUDGET_USD, formatUsd, isAllowedModel, usageCostUsd } from '../../src/engine/corners/llmSafety.ts'

export const CORNERS = ['date_archive', 'sweet_words', 'this_month'] as const
export type CornerKey = (typeof CORNERS)[number]

/** 다툰 날 - 지면에 이 날의 원문이 실렸는지 기계적으로 표시한다(판정은 사람이 한다). */
export const ARGUMENT_DAYS = ['2026-09-16', '2026-09-17']

// ---------------------------------------------------------------------------
// 저장 형식
// ---------------------------------------------------------------------------

export interface Usage {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export interface HttpCall {
  readonly status: number
  readonly latencyMs: number
  readonly stopReason: string | null
  readonly usage: Usage | null
  /** 응답 본문의 content 블록 전부(text·thinking 등). 키는 지운 뒤 저장한다. */
  readonly contentBlocks: unknown
  /** 오류 응답이면 `error.type: error.message`만(84-a2 - 요청 id 등은 버림). */
  readonly errorBody: string | null
}

export interface AttemptRecord {
  readonly index: number
  readonly text: string
  readonly validation:
    | { ok: true }
    | { ok: false; reason: string; detail: string }
}

export interface RunRecord {
  readonly model: string
  readonly corner: CornerKey
  readonly run: number
  readonly tag: string
  readonly startedAt: string
  readonly maxTokens: number
  readonly totalLatencyMs: number
  readonly httpCalls: HttpCall[]
  readonly attempts: AttemptRecord[]
  /** `halted` = 생성 전 안전 정지(추정 입력 토큰 > 40,000, `52r2-`). 실패 사유 4값이 아니다. 이때 LLM 호출은 0회다. */
  readonly outcome: 'success' | 'failure' | 'halted'
  readonly failureReason: string | null
  readonly failureDetail: string | null
  /** 84-a2부터 실제로 보낸 HTTP 수와 같다(84-a2 전 기록은 골격의 `call()` 횟수 - review는 `sentCalls`만 쓴다). */
  readonly llmCallAttempts: number
  /** 응답이 `stop_reason=max_tokens`로 잘렸는가. 잘린 뒤의 재호출은 하네스가 막는다(ROADMAP R16-4). */
  readonly truncated: boolean
  /** 저장 content(성공 시). */
  readonly content: unknown
  readonly usageTotal: Usage
  /** 84-a: 안전 정지 종류(`input_token_limit` · `corner_time_limit` · `cost_limit`). 아니면 null. */
  readonly haltedFor?: string | null
  /** 84-a(R19-2): 재소환 데이트를 대표 화보로 고른 시도 수. */
  readonly r19_2Violations?: number
  /** 84-a: 이 회차 비용(USD, 동기 가격). */
  readonly costUsd?: number
}

export function safeName(s: string): string {
  return s.replace(/[^A-Za-z0-9_.-]/g, '-')
}

/** 84-a2: 이 회차에서 실제로 보낸 HTTP 요청 수 - 기록 · 화면 · review · summary가 모두 이 값을 쓴다. */
export function sentCalls(r: Pick<RunRecord, 'httpCalls'>): number {
  return r.httpCalls.length
}

// ---------------------------------------------------------------------------
// review: 저장된 실행 -> review.md, summary.md
// ---------------------------------------------------------------------------

export function cell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

export function isArgumentDay(at: unknown): boolean {
  return typeof at === 'string' && ARGUMENT_DAYS.some((d) => at.startsWith(d))
}

/** 지면 문장(AI가 쓴 것)과 원문을 나란히 놓을 행들을 만든다. 왼쪽 = 지면, 오른쪽 = 원문(유저 기록). */
export function sideBySide(corner: CornerKey, content: any): { left: string; right: string }[] {
  const rows: { left: string; right: string }[] = []
  const p = content?.payload
  if (corner === 'sweet_words') {
    for (const [i, m] of (p?.main ?? []).entries()) {
      const flag = m.turns.some((t: any) => isArgumentDay(t.at)) ? ' **[다툰 날 원문 포함]**' : ''
      rows.push({
        left: `대화 ${i + 1} 정황 문장: ${m.context}${flag}`,
        right: m.turns.map((t: any) => `${t.speaker} (${t.at}): ${t.text}`).join('\n'),
      })
    }
    for (const s of p?.sub ?? []) {
      const flag = isArgumentDay(s.attribution?.at) ? ' **[다툰 날 원문 포함]**' : ''
      rows.push({ left: `한 줄 선택${flag}`, right: `${s.speaker} (${s.attribution?.display}): ${s.text}` })
    }
  } else if (corner === 'date_archive') {
    for (const a of p?.articles ?? []) {
      const sug = (a.closingQuestions ?? []).find((q: any) => q.type === 'suggestion')
      rows.push({
        left: `제목: ${a.title}${a.featured ? ' (메인 화보)' : ''}${a.recalled ? ' (재소환 ' + a.recallReason + ')' : ''}\n맞춤 질문: ${sug?.text}\n근거: ${sug?.basis}`,
        right: `${a.dateOn} ${a.region ?? ''}`,
      })
      for (const s of a.stops ?? []) {
        const notes = (s.userNotes ?? []).map((n: any) => (n.type === 'memo' ? `${n.authorName} 메모: ${n.text}` : `${n.authorName} 그림`)).join('\n')
        rows.push({
          left: s.aiCaption === null ? '(AI 캡션 없음)' : `캡션: ${s.aiCaption}`,
          right: `정거장 ${s.seq} ${s.time} ${s.placeName ?? '(장소명 없음)'} / 사진 ${(s.photos ?? []).length}장${notes ? '\n' + notes : ''}`,
        })
      }
    }
  } else {
    const t = p?.theme
    if (t) {
      rows.push({
        left: `헤드라인: ${t.headline}\n리드: ${t.lead}\n극성: ${t.polarity}`,
        right: (t.signals ?? []).map((s: any) => `신호 ${s.kind}: ${s.value} (근거 ${s.count}건)`).join('\n'),
      })
    }
    for (const a of p?.articles ?? []) {
      const flag = (a.evidence ?? []).some((e: any) => isArgumentDay(e.at)) ? ' **[다툰 날 원문 포함]**' : ''
      rows.push({
        left: `소기사 ${a.seq + 1} 제목: ${a.title}\n본문: ${a.body}${flag}`,
        right: (a.evidence ?? [])
          .map((e: any) => (e.type === 'message' ? `메시지 (${e.attribution?.display}): ${e.excerpt}` : e.type === 'photo' ? `사진 (${e.at})` : `데이트 (${e.at})`))
          .join('\n'),
      })
    }
    if (p?.closing) rows.push({ left: `마무리 한 줄: ${p.closing}`, right: '' })
  }
  return rows
}

/** 동기 가격 비용(USD) - 가격표는 `llmSafety.ts` 한 곳. 모르는 모델이면 null. */
export function cost(model: string, u: Usage): number | null {
  return isAllowedModel(model) ? usageCostUsd(model, u) : null
}

/** 코너 빠짐(R124-6) = 성공이 아닌 회차(안전 정지 · 형식 실패 · 생성 실패 · 재료 없음). */
export function isDropped(r: RunRecord): boolean {
  return r.outcome !== 'success'
}

/**
 * 저장된 실행 기록 -> review.md · summary.md 본문(순수 - 파일 · 네트워크 · 시계 0). 하네스 `review`가 파일로 쓴다.
 * 84-a2: 호출 수는 `sentCalls`(실제로 보낸 HTTP 수) 하나만 쓴다 · 말투 칸 = "합니다체 밖".
 */
export function renderReview(input: readonly RunRecord[]): { readonly review: string; readonly summary: string } {
  const records = [...input]
  records.sort((a, b) => a.corner.localeCompare(b.corner) || a.model.localeCompare(b.model) || a.tag.localeCompare(b.tag) || a.run - b.run)

  const out: string[] = []
  out.push('# M1 품질 판정 자료', '')
  out.push('코너 3종의 실제 모델 출력. 각 회차마다 **지면에 실릴 문장(왼쪽)** 과 **원문(오른쪽)** 을 나란히 놓았다.')
  out.push('판정 칸은 비워 두었다. 맨 끝 체크리스트는 MASTER 3-7의 판단 기준이다.', '')
  out.push('입력: 합성 데이터셋(`scripts/ops/fixtures/m1-month/`), 가상 커플 세준·서영의 2026년 9월. 다툰 날 = 09-16(본 다툼), 09-17 오전(뒤끝).')
  out.push('`[다툰 날 원문 포함]` 표시는 기계적 표시일 뿐이다 - 그 날의 원문이 지면에 실렸다는 뜻이지 위반이라는 뜻이 아니다.', '')

  for (const corner of CORNERS) {
    out.push(`## 코너: ${corner}`, '')
    for (const rec of records.filter((r) => r.corner === corner)) {
      out.push(`### ${rec.model} / 회차 ${rec.run}${rec.tag === 'default' ? '' : ' / ' + rec.tag}`, '')
      out.push(
        `- 결과: **${rec.outcome === 'success' ? '성공' : rec.outcome === 'halted' ? '안전 정지 (호출 없음)' : '실패 (' + rec.failureReason + ')'}** / LLM 호출(보낸 수) ${sentCalls(rec)}회 / ${rec.totalLatencyMs}ms / ` +
          `토큰 입력 ${rec.usageTotal.input} · 출력 ${rec.usageTotal.output} · 캐시읽기 ${rec.usageTotal.cacheRead} · 캐시쓰기 ${rec.usageTotal.cacheWrite}`,
      )
      out.push(`- 원자료: \`scripts/ops/out/runs/${safeName(rec.model)}__${rec.corner}__${rec.tag}__r${rec.run}.json\``)
      if (rec.truncated) out.push(`- **출력 잘림: \`stop_reason=max_tokens\` (max_tokens ${rec.maxTokens}), 재시도하지 않음** - 아래 시도 원문이 잘린 출력이다`)
      if (rec.outcome !== 'success') out.push(`- ${rec.outcome === 'halted' ? '정지 사유' : '실패 상세'}: ${cell(rec.failureDetail ?? '')}`)
      out.push('')
      for (const a of rec.attempts) {
        if (a.validation.ok) continue
        out.push(`시도 ${a.index} 검증 실패 (${a.validation.reason}): ${cell(a.validation.detail).slice(0, 600)}`, '')
        out.push('```json', a.text, '```', '')
      }
      if (rec.outcome === 'success') {
        const rows = sideBySide(corner, rec.content)
        out.push('| 지면에 실릴 문장 | 원문 |', '|---|---|')
        for (const r of rows) out.push(`| ${cell(r.left)} | ${cell(r.right)} |`)
        out.push('')
      }
      out.push(
        `- 자동 집계: 코너 빠짐 ${isDropped(rec) ? 1 : 0} · R19-2 위반 ${rec.r19_2Violations ?? 0} · 비용 $${formatUsd(cost(rec.model, rec.usageTotal) ?? 0)}`,
        '',
      )
      out.push('| 반드시 0 (사람) | 건수 |', '|---|---|')
      for (const item of ['사실 오류(입력에 없는 장소 · 날짜 · 숫자 · 사람)', '원문 노출 규칙 위반', '금지 표현', '말투 위반(합니다체 밖)']) out.push(`| ${item} |  |`)
      out.push('', '| 허용 (사람) | 건수 |', '|---|---|', '| 다시 쓰고 싶은 문장(이 회차 1개 이하) |  |', '')
      out.push('판정: [ ] 통과 [ ] 불통과 / 메모: ', '')
    }
  }

  // 84-a(R124-6): 모델별 집계 - 하네스는 셀 수 있는 것만, 통과/실패 칸은 사람이 채운다.
  out.push('---', '', '## 모델별 집계 (R124-6)', '')
  out.push('기준: 모델마다 3회 × 3코너 = 9코너-실행. **반드시 0**: 사실 오류 · 원문 노출 규칙 위반 · 금지 표현 · 합니다체 밖 말투. **허용**: 다시 쓰고 싶은 문장 코너당 실행마다 1개 이하 · 코너 빠짐 9 중 1 이하.', '')
  out.push('| 모델 | 코너-실행 | 코너 빠짐 (자동) | R19-2 위반 (자동) | 비용 $ (자동) | 반드시 0 합 (사람) | 다시 쓰고 싶은 문장 초과 (사람) | 통과 / 실패 (사람) |', '|---|---|---|---|---|---|---|---|')
  for (const m of [...new Set(records.map((r) => r.model))].sort()) {
    const rs = records.filter((r) => r.model === m)
    const total = rs.reduce((n, r) => n + (cost(r.model, r.usageTotal) ?? 0), 0)
    out.push(`| ${m} | ${rs.length} | ${rs.filter(isDropped).length} | ${rs.reduce((n, r) => n + (r.r19_2Violations ?? 0), 0)} | ${formatUsd(total)} |  |  |  |`)
  }
  out.push('')

  out.push('---', '', '## 판단 기준 (MASTER 3-7)', '')
  out.push('> 이 문장을 두 사람이 **각자** 읽었을 때, 한쪽이라도 불편해질 여지가 있는가. 있으면 쓰지 않는다.', '')
  out.push('허용: 유저 원본을 주인공으로 배치 / 감정·분위기 짚기 / 긍정적 방향의 목소리 / 변화를 관찰해 서술 / 두 사람 모두에게 해당하는 서술 / 데이터가 없으면 스킵·분량 축소', '')
  out.push('금지: 원본 대체·각색 / **잘잘못 판정** / **한쪽 편들기** / **관계에 대한 진단·훈수** / **특정인의 행동을 문제 삼기** / 데이터가 없는데 억지로 만들어내기', '')
  out.push('| 문장 | 판정 |', '|---|---|')
  for (const [s, v] of [
    ['"이날은 서로 조심스러웠던 것 같습니다"', '두 사람 모두에 해당 (통과)'],
    ['"오늘 두 분 정말 다정하셨네요"', '긍정 방향, 편이 갈리지 않음 (통과)'],
    ['"8월에는 우산 이야기가 네 번 나왔습니다"', '사실 서술 (통과)'],
    ['"이날은 세준이 먼저 사과했어야 했습니다"', '잘잘못 판정 (불통과)'],
    ['"서영의 서운함이 이해되는 상황입니다"', '한쪽 편들기 (불통과)'],
    ['"두 분은 대화가 부족합니다"', '관계 진단 (불통과)'],
    ['"답장에 소홀해졌습니다"', '개인의 태도를 문제 삼음 (불통과)'],
  ]) out.push(`| ${s} | ${v} |`)
  out.push('', '### 체크리스트 (회차마다 확인 - 판정 칸은 비워 둠)', '')
  for (const item of [
    '두 사람이 각자 읽었을 때 한쪽이라도 불편해질 여지가 있는 문장이 없다',
    '잘잘못을 가리는 문장이 없다 (특히 다툰 날 09-16·09-17)',
    '한쪽 편을 드는 문장이 없다',
    '관계에 대한 진단·훈수가 없다 ("대화가 부족" 류)',
    '특정인의 행동·태도를 문제 삼는 문장이 없다 (답장, 약속, 회식 등)',
    '유저 원문을 각색·요약·교정하지 않았다 (원문 칸이 입력 그대로다)',
    '유저 메모·그림이 있는 구간에 AI 캡션이 없다 (17-1)',
    '데이터가 없는 곳을 지어내지 않았다 (없는 장소·사실·감정)',
    '평가·감상·점수·조언·예측이 없다 (담백한 정황 서술)',
    '17-4: 다툰 날과 화해 대화를 싣지 않았다 (다툼의 맥락 소환 금지)',
    '17-5: 부정 소재(다툼)를 테마로 잡지 않았고, 부정을 긍정으로 포장하지도 않았다',
    '한국어가 자연스럽고 톤이 담백하다',
  ]) out.push(`- [ ] ${item}`)
  out.push('')

  // 요약: 실행 표·토큰·비용
  const sum: string[] = ['# 실행 요약 (자동 생성)', '']
  sum.push('| 모델 | 코너 | 회차 | 결과 | 호출(보낸 수) | 입력 | 출력 | 캐시읽기 | 캐시쓰기 | 지연(ms) | R19-2 위반 | 비용(동기, $) |', '|---|---|---|---|---|---|---|---|---|---|---|---|')
  let grand = 0
  for (const r of records) {
    const c = cost(r.model, r.usageTotal)
    grand += c ?? 0
    sum.push(
      `| ${r.model} | ${r.corner} | ${r.run} | ${r.outcome === 'success' ? '성공' : r.outcome === 'halted' ? `안전 정지(${r.haltedFor ?? 'input_token_limit'})` : '실패: ' + r.failureReason}${r.truncated ? ' (max_tokens 잘림)' : ''} | ${sentCalls(r)} | ${r.usageTotal.input} | ${r.usageTotal.output} | ${r.usageTotal.cacheRead} | ${r.usageTotal.cacheWrite} | ${r.totalLatencyMs} | ${r.r19_2Violations ?? 0} | ${c !== null ? formatUsd(c) : '-'} |`,
    )
  }
  sum.push('', `합계 비용(동기, $): ${formatUsd(grand)} · 하네스 1회 상한 $${HARNESS_BUDGET_USD} · 84- 전체 상한 $30은 PE가 이 표로 집계`)
  return { review: out.join('\n'), summary: sum.join('\n') }
}
