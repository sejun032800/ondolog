/// <reference types="jest" />
/**
 * 84-c 코너 연결 - 칸별 말투 · 숫자/시각 · 요일 검사가 코너 3종 · 골격(재요청 1회 + 안내 → 빠짐)에 붙었는지, 프롬프트 고정.
 * 위임: .claude/state/prompts/phase-7/84-c-dispatch-auto-checks.md (ROADMAP r133 R133-4 · R133-5)
 * LLM 호출 0 - 가짜 클라이언트(`scriptedLlmClient`). 예문은 시험용 짧은 문장이다.
 */
import { processCornerResponse, runCornerModule } from '../cornerPipeline.ts'
import { toneViolations, weekdayOf } from '../../../../src/engine/corners/contentChecks.ts'
import { COMMON_PRINCIPLES_BLOCK, dateLine, messageLine } from './cornerCommon.ts'
import { DATE_ARCHIVE_FIXED_QUESTIONS, dateArchiveModule, type DateArchiveInput } from './dateArchive.ts'
import { sweetWordsModule, type SweetWordsInput } from './sweetWords.ts'
import { thisMonthModule, type ThisMonthInput } from './thisMonth.ts'
import {
  CHAT_MESSAGES,
  DATE_RECALLED,
  DATE_THIS_1,
  DATE_THIS_2,
  MONTHLY_CONTEXT,
  PHOTOS,
  scriptedLlmClient,
} from '../testFixtures/cornerFixtures.ts'

const TM_INPUT: ThisMonthInput = { messages: CHAT_MESSAGES, photos: PHOTOS, dates: [DATE_THIS_1, DATE_THIS_2] }
const DA_INPUT: DateArchiveInput = { dates: [DATE_THIS_1, DATE_THIS_2, DATE_RECALLED] }
const SW_INPUT: SweetWordsInput = { warmthIndex: null, messages: CHAT_MESSAGES }

/** 이달의 우리 - 검사를 통과하는 출력(본문만 바꿔 쓴다). d-1 = 2026-08-19. */
function tm(body0: string, extra: Record<string, unknown> = {}) {
  return {
    kind: 'theme',
    theme: {
      headline: '새로운 동네를 다닌 달',
      lead: '이번 달에는 연남동과 성수동에 다녀온 기록이 남았습니다.',
      polarity: 'neutral',
      signals: [{ kind: 'place', value: '연남동', evidence: [{ type: 'date', dateId: 'd-1' }] }],
    },
    articles: [
      { title: '연남동의 하루', body: body0, evidence: [{ type: 'date', dateId: 'd-1' }] },
      { title: '아침 인사', body: '비가 오던 아침에 오간 대화가 있었습니다.', evidence: [{ type: 'message', messageId: 'm-1' }] },
    ],
    closing: '다음 달에도 새로운 곳을 찾아가 봅니다.',
    ...extra,
  }
}

/** 데이트 아카이브 - d-1(14:20 · 16:40) · d-2(13:00 · 15:00) · d-old(11:00). */
function da(captionD2: string, questionD1 = '다음에 또 영화 보러 갈까요?') {
  return {
    kind: 'articles',
    featuredDateId: 'd-1',
    articles: [
      { dateId: 'd-old', title: '합정 산책', stopCaptions: [], tailoredQuestion: { text: '올해도 합정에 가볼까요?', basis: '합정 공원 방문' } },
      { dateId: 'd-2', title: '성수동 카페', stopCaptions: [{ seq: 0, caption: captionD2 }], tailoredQuestion: { text: '저녁도 먹어볼까요?', basis: '낮 카페 방문' } },
      { dateId: 'd-1', title: '영화와 저녁', stopCaptions: [{ seq: 1, caption: '영화 다음 식당' }], tailoredQuestion: { text: questionD1, basis: '영화관 구간이 있어서' } },
    ],
  }
}

describe('84-c 고정 질문 2개 - 해요체(R133-4 ③)', () => {
  it('문구와 말투', () => {
    expect(DATE_ARCHIVE_FIXED_QUESTIONS).toEqual({
      rating: '이날의 데이트는 10점 만점에 몇 점인가요?',
      recall: '이날 중 가장 기억에 남는 건 무엇인가요?',
    })
    for (const q of Object.values(DATE_ARCHIVE_FIXED_QUESTIONS)) expect(toneViolations(q, 'question')).toEqual([])
  })
})

describe('84-c 프롬프트 고정', () => {
  it('공통 원칙: 칸별 말투 · 시각 형식 · 반올림 금지 · 요일은 weekday 칸에서만', () => {
    const t = COMMON_PRINCIPLES_BLOCK.text
    expect(t).toContain('글 칸(리드, 본문, 마무리): 모든 문장을 합니다체')
    expect(t).toContain('라벨 칸(헤드라인, 제목, 신호 값, 캡션, 정황, 근거)')
    expect(t).toContain('질문 칸(맞춤 질문): 해요체')
    expect(t).toContain('반올림하거나 어림하지 않는다')
    expect(t).toContain('앞말은 "오전"/"오후", 또는 시간대 "새벽"(00:00~05:59) · "아침"(06:00~10:59) · "낮"(11:00~16:59) · "저녁"(17:00~20:59) · "밤"(21:00~02:59)')
    expect(t).toContain('12:30 -> "낮 12시 30분"')
    expect(t).toContain('묶음("평일", "주말", "토요일마다")은 그 문장의 날짜나 그 칸의 근거 레코드 날짜가 모두')
    expect(t).toContain('24시 표기')
    expect(t).toContain('요일은 입력 레코드의 weekday 칸에서만')
  })

  it('입력 줄에 요일 칸(KST) - 메시지 · 데이트 · 사진', () => {
    const m = JSON.parse(messageLine(CHAT_MESSAGES[0]))
    expect(m.weekday).toBe(weekdayOf('2026-08-22'))
    const d = JSON.parse(dateLine(DATE_THIS_1, false))
    expect(d.weekday).toBe(weekdayOf('2026-08-19'))
    const req = thisMonthModule.buildRequest(TM_INPUT, MONTHLY_CONTEXT)
    const photoLines = req.user.map((b) => b.text).find((t) => t.startsWith('사진('))!.split('\n').slice(1)
    expect(photoLines.length).toBeGreaterThan(0)
    for (const line of photoLines) expect(JSON.parse(line).weekday).toMatch(/요일$/)
  })

  it('이달의 우리: 마무리 42자 안내 · R52-3 셀 수 있는 신호 · 칸별 말투', () => {
    const sys = thisMonthModule.buildRequest(TM_INPUT, MONTHLY_CONTEXT).system.map((b) => b.text).join('\n')
    expect(sys).toContain('closing(글 칸): 다음 기간으로 이어지는 한 줄. 공백과 부호를 포함해 42자 이내')
    expect(sys).toContain('셀 수 있는 신호는 place 하나다')
    expect(sys).toContain('신호는 셀 수 있는 place를 먼저 고른다')
    expect(sys).toContain('body(글 칸, 모든 문장을 합니다체로 끝냄)')
  })

  it('데이트 아카이브: 맞춤 질문 좋은 예가 해요체 · 반말 예는 나쁜 쪽에만', () => {
    const sys = dateArchiveModule.buildRequest(DA_INPUT, MONTHLY_CONTEXT).system.map((b) => b.text).join('\n')
    expect(sys).toContain('좋은 예: text "다음에 롯데월드 갈 때 교복 데이트 해볼까요?"')
    expect(sys).not.toContain('해볼 의향은?",')
  })

  it('다정한 말들: 정황 좋은 예에 날짜 없는 요일 낱말이 없다', () => {
    const sys = sweetWordsModule.buildRequest(SW_INPUT, MONTHLY_CONTEXT).system.map((b) => b.text).join('\n')
    expect(sys).not.toContain('주말 아침에 오간 대화')
    expect(sys).toContain('context(라벨 칸)')
  })
})

describe('84-c 코너 응답 처리 - 검사가 걸리는 자리', () => {
  it('이달의 우리: 본문 ~다체는 schema_invalid(칸 · 규칙만)', () => {
    const r = processCornerResponse(thisMonthModule, JSON.stringify(tm('8월 19일에는 연남동에 다녀왔다.')), TM_INPUT, MONTHLY_CONTEXT)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('schema_invalid')
      expect(r.detail).toBe('내용 검사: articles[0].body: 말투 ~다체 (글 칸 허용: 합니다체)')
      expect(r.detail).not.toContain('연남동에 다녀왔다')
    }
  })

  it('이달의 우리: 요일 - 근거 데이트(8월 19일)의 요일과 맞으면 통과, 틀리면 실패', () => {
    const right = weekdayOf('2026-08-19')
    const wrong = right === '토요일' ? '일요일' : '토요일'
    expect(processCornerResponse(thisMonthModule, JSON.stringify(tm(`8월 19일 ${right}에 연남동에 다녀왔습니다.`)), TM_INPUT, MONTHLY_CONTEXT).ok).toBe(true)
    const r = processCornerResponse(thisMonthModule, JSON.stringify(tm(`${wrong} 저녁에 연남동에 다녀왔습니다.`)), TM_INPUT, MONTHLY_CONTEXT)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.detail).toContain(`요일 「${wrong}」≠ 2026-08-19`)
  })

  it('데이트 아카이브: 시각은 그 데이트의 시각만 - 다른 날의 시각(오전 11시)으로 반올림이 가려지지 않는다', () => {
    // d-2 정거장 13:00 · 15:00. 11:00은 d-old의 시각이다.
    expect(processCornerResponse(dateArchiveModule, JSON.stringify(da('오후 1시 카페')), DA_INPUT, MONTHLY_CONTEXT).ok).toBe(true)
    const r = processCornerResponse(dateArchiveModule, JSON.stringify(da('오전 11시 카페')), DA_INPUT, MONTHLY_CONTEXT)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.detail).toBe('내용 검사: articles[1].stopCaptions[0].caption: 입력에 없는 시각 「오전 11시」(11:00)')
  })

  it('데이트 아카이브: 맞춤 질문 반말은 schema_invalid', () => {
    const r = processCornerResponse(dateArchiveModule, JSON.stringify(da('오후 1시 카페', '다음에 또 영화 보러 갈까?')), DA_INPUT, MONTHLY_CONTEXT)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.detail).toBe('내용 검사: articles[2].tailoredQuestion.text: 말투 반말 (질문 칸 허용: 해요체)')
  })

  it('다정한 말들: 정황 ~다체 · 날짜 없는 요일(턴 날짜와 다름)은 실패', () => {
    const turnsDay = weekdayOf('2026-08-22')
    const other = turnsDay === '월요일' ? '화요일' : '월요일'
    const out = (context: string) => ({ kind: 'excerpts', main: [{ context, turns: [{ messageId: 'm-1' }, { messageId: 'm-2' }], conflict: false }], sub: [] })
    expect(processCornerResponse(sweetWordsModule, JSON.stringify(out(`${turnsDay} 아침에 오간 대화`)), SW_INPUT, MONTHLY_CONTEXT).ok).toBe(true)
    const bad = processCornerResponse(sweetWordsModule, JSON.stringify(out(`${other} 아침에 대화가 오갔다`)), SW_INPUT, MONTHLY_CONTEXT)
    expect(bad.ok).toBe(false)
    if (!bad.ok) {
      expect(bad.detail).toContain('main[0].context: 말투 ~다체')
      expect(bad.detail).toContain(`요일 「${other}」≠ 2026-08-22`)
    }
  })
})

describe('84-c 골격 - 재요청 1회(안내 블록) → 또 걸리면 빠짐', () => {
  it('첫 응답 ~다체 → 재요청에 안내 블록 하나(칸 · 규칙, 문장 0) → 둘째 정상이면 성공 · 보낸 수 2', async () => {
    const client = scriptedLlmClient([JSON.stringify(tm('8월 19일에는 연남동에 다녀왔다.')), JSON.stringify(tm('8월 19일에는 연남동에 다녀왔습니다.'))])
    const result = await runCornerModule(thisMonthModule, { input: TM_INPUT, context: MONTHLY_CONTEXT, llmClient: client })
    expect(result.outcome).toBe('success')
    expect(result.llmCallAttempts).toBe(2)
    const [first, second] = client.requests
    expect(second.system).toEqual(first.system) // 캐시 접두 그대로
    expect(second.user.slice(0, first.user.length)).toEqual(first.user)
    expect(second.user).toHaveLength(first.user.length + 1)
    const hint = second.user[second.user.length - 1].text
    expect(hint).toContain('앞의 응답이 검사에 걸렸다')
    expect(hint).toContain('- articles[0].body: 말투 ~다체 (글 칸 허용: 합니다체)')
    expect(hint).not.toContain('다녀왔다')
  })

  it('두 번 다 걸리면 빠짐(schema_invalid) - 재요청 한도는 그대로 1회', async () => {
    const bad = JSON.stringify(tm('8월 19일에는 연남동에 다녀왔다.'))
    const client = scriptedLlmClient([bad, bad, bad])
    const result = await runCornerModule(thisMonthModule, { input: TM_INPUT, context: MONTHLY_CONTEXT, llmClient: client })
    expect(result.outcome).toBe('failure')
    if (result.outcome === 'failure') expect(result.reason).toBe('schema_invalid')
    expect(client.requests).toHaveLength(2)
  })

  it('값 검사(길이)에 걸리면 내용 검사 결과도 함께 알린다', async () => {
    const both = JSON.stringify(tm('8월 19일에는 연남동에 다녀왔다.', { closing: '가'.repeat(43) + '입니다.' }))
    const client = scriptedLlmClient([both, JSON.stringify(tm('8월 19일에는 연남동에 다녀왔습니다.'))])
    await runCornerModule(thisMonthModule, { input: TM_INPUT, context: MONTHLY_CONTEXT, llmClient: client })
    const hint = client.requests[1].user[client.requests[1].user.length - 1].text
    expect(hint).toContain('closing: 길이 47 > 상한 42')
    expect(hint).toContain('articles[0].body: 말투 ~다체')
  })

  it('구조 오류(JSON 아님)의 재요청은 안내 없이 같은 요청(84-a까지와 같다)', async () => {
    const client = scriptedLlmClient(['{깨진', JSON.stringify(tm('8월 19일에는 연남동에 다녀왔습니다.'))])
    const result = await runCornerModule(thisMonthModule, { input: TM_INPUT, context: MONTHLY_CONTEXT, llmClient: client })
    expect(result.outcome).toBe('success')
    expect(client.requests[1]).toEqual(client.requests[0])
  })
})
