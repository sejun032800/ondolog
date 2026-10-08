/// <reference types="jest" />
import { periodLabelOf } from '../periodLabel.ts'
import {
  CoupleMembershipError,
  findMissingReferencePaths,
  processCornerResponse,
  runCornerModule,
} from '../cornerPipeline.ts'
import { findForbiddenKeys } from '../../../../src/engine/corners/forbiddenKeys.ts'
import { sweetWordsStoredSchema } from '../../../../src/types/corners/storedContent.ts'
import {
  CHAT_MESSAGES,
  COUPLE_B,
  DAILY_CONTEXT,
  MONTHLY_CONTEXT,
  message,
  scriptedLlmClient,
} from '../testFixtures/cornerFixtures.ts'
import { sweetWordsLlmSchema, sweetWordsModule, SWEET_WORDS_REFERENCES, type SweetWordsInput } from './sweetWords.ts'

/**
 * 17-4 다정한 말들 — 요청 만들기·응답 처리 (MASTER 17-4, §17-0-4-A, §17-0-5-D, §17-0-7 / CORNER_CONTENT §6).
 * 위임: .claude/state/prompts/phase-7/38-corner-pipeline-three-corners.md.
 *
 * 입력은 픽스처다(`../testFixtures/cornerFixtures.ts`). 코너 함수는 `llmClient` 없이 직접 부른다 -
 * 코너 코드가 전송 방식을 모른다는 것(17-0-5-F)의 행동 증거이기도 하다.
 */

const INPUT: SweetWordsInput = { warmthIndex: null, messages: CHAT_MESSAGES }

/** 정상 응답 - 대화 하나(m-1, m-2)와 한 줄 하나(m-3). */
const GOOD_OUTPUT = {
  kind: 'excerpts',
  main: [{ context: '아침 출근길에 오간 대화', turns: [{ messageId: 'm-1' }, { messageId: 'm-2' }] }],
  sub: [{ messageId: 'm-3' }],
}

function run(output: unknown, input: SweetWordsInput = INPUT, context = MONTHLY_CONTEXT) {
  const raw = typeof output === 'string' ? output : JSON.stringify(output)
  return processCornerResponse(sweetWordsModule, raw, input, context)
}

describe('17-4 코너 상수 (r41·r45)', () => {
  it('코너 이름과 지면 제목은 "다정한 말들"이다 ("이달의 다정한 말들"은 월간판의 지면 헤드 문구이지 코너 이름이 아니다)', () => {
    expect(sweetWordsModule.cornerName).toBe('다정한 말들')
    expect(sweetWordsModule.pageTitle).toBe('다정한 말들')
  })
})

describe('17-4 요청 만들기', () => {
  it('시스템 블록은 캐시 표시를 가진다(공통 원칙 + 코너 지시)', () => {
    const request = sweetWordsModule.buildRequest(INPUT, MONTHLY_CONTEXT)
    expect(request.system).toHaveLength(2)
    expect(request.system.every((b) => b.cacheBreakpoint === true)).toBe(true)
    expect(request.user.some((b) => b.cacheBreakpoint === true)).toBe(false)
  })

  it('캐시 표시 앞 블록에는 입력 레코드의 텍스트·id가 없다 - 가변 입력은 표시 뒤에만 있다', () => {
    const request = sweetWordsModule.buildRequest(INPUT, MONTHLY_CONTEXT)
    const cacheable = request.system.map((b) => b.text).join('\n')
    for (const m of CHAT_MESSAGES) {
      expect(cacheable).not.toContain(m.source.text)
      expect(cacheable).not.toContain(`"id":"${m.id}"`)
    }
    expect(cacheable).not.toContain(periodLabelOf(MONTHLY_CONTEXT))
    const user = request.user.map((b) => b.text).join('\n')
    for (const m of CHAT_MESSAGES) expect(user).toContain(JSON.stringify(m.source.text))
  })

  it('서로 다른 두 입력·두 주기에서 캐시 표시까지의 접두가 같다 - 캐시가 실제로 재사용될 수 있다', () => {
    const a = sweetWordsModule.buildRequest(INPUT, MONTHLY_CONTEXT)
    const b = sweetWordsModule.buildRequest({ warmthIndex: 50, messages: [CHAT_MESSAGES[0]] }, DAILY_CONTEXT)
    expect(b.system).toEqual(a.system)
    expect(b.user).not.toEqual(a.user)
  })

  it('주기에 따른 main 개수 규칙은 가변부(user)에 있다 - 월간 1~3, 일간 정확히 1', () => {
    const monthly = sweetWordsModule.buildRequest(INPUT, MONTHLY_CONTEXT).user.map((b) => b.text).join('\n')
    const daily = sweetWordsModule.buildRequest(INPUT, DAILY_CONTEXT).user.map((b) => b.text).join('\n')
    expect(monthly).toContain('main은 1~3개')
    expect(daily).toContain('main은 정확히 1개')
  })

  it('입력 레코드 순서가 달라도 같은 요청이다(결정론)', () => {
    const shuffled: SweetWordsInput = { warmthIndex: null, messages: [...CHAT_MESSAGES].reverse() }
    expect(sweetWordsModule.buildRequest(shuffled, MONTHLY_CONTEXT)).toEqual(sweetWordsModule.buildRequest(INPUT, MONTHLY_CONTEXT))
  })
})

describe('17-4 LLM 출력 스키마 (r44)', () => {
  it.each(['monthly', 'daily'] as const)('선언된 path가 전부 %s 스키마에 있다', (cadence) => {
    expect(findMissingReferencePaths(sweetWordsLlmSchema(cadence), SWEET_WORDS_REFERENCES)).toEqual([])
  })

  it('정상 샘플의 키는 FORBIDDEN_KEYS에 걸리지 않는다', () => {
    expect(findForbiddenKeys(GOOD_OUTPUT)).toEqual([])
    expect(findForbiddenKeys({ kind: 'none' })).toEqual([])
  })

  it('원문을 담을 필드가 없다 - LLM이 text·speaker·at·attribution을 써 보내도 스키마가 버린다', () => {
    const parsed = sweetWordsLlmSchema('monthly').parse({
      kind: 'excerpts',
      main: [{ context: 'c', turns: [{ messageId: 'm-1', text: '변조', speaker: '누구', at: 'x', attribution: {} }] }],
      sub: [{ messageId: 'm-3', text: '변조' }],
    })
    expect(JSON.stringify(parsed)).not.toContain('변조')
  })
})

describe('17-4 응답 처리 - 저장 내용', () => {
  it('정상 응답은 CORNER_CONTENT §6-3 예시와 같은 모양으로 저장된다', () => {
    const result = run(GOOD_OUTPUT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.content).toEqual({
      schemaVersion: '1.0',
      header: { cornerName: '다정한 말들', title: '다정한 말들', periodLabel: '2026년 8월' },
      payload: {
        warmthIndex: null,
        main: [
          {
            context: '아침 출근길에 오간 대화',
            attribution: { display: '2026.08.22 09:20, 아침 대화 중', at: '2026-08-22T09:20:00+09:00', source: 'chat' },
            turns: [
              { speaker: '세준', text: '오늘 비 온대. 우산 챙겼어?', at: '2026-08-22T09:20:00+09:00' },
              { speaker: '서영', text: '응 챙겼어. 너도 감기 조심해', at: '2026-08-22T09:21:30+09:00' },
            ],
          },
        ],
        sub: [
          {
            attribution: { display: '2026.08.11 23:40, 밤 대화 중', at: '2026-08-11T23:40:00+09:00', source: 'chat' },
            speaker: '서영',
            text: '오늘 고생했어 진짜',
          },
        ],
      },
    })
  })

  it('원문은 LLM이 써도 저장에 들어가지 않는다 - 입력 원문과 문자 단위로 일치한다(공백·개행 포함)', () => {
    const tampered = {
      kind: 'excerpts',
      main: [
        {
          context: '새벽 한 줄',
          turns: [{ messageId: 'm-6', text: '변조된 원문', speaker: '가짜', at: '1999-01-01T00:00:00+09:00' }],
        },
      ],
      sub: [{ messageId: 'm-3', text: '변조된 서브', speaker: '가짜' }],
    }
    const result = run(tampered)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const m6 = CHAT_MESSAGES.find((m) => m.id === 'm-6')!
    expect(result.content.payload.main[0].turns[0].text).toBe(m6.source.text)
    expect(result.content.payload.main[0].turns[0].speaker).toBe('세준')
    expect(result.content.payload.main[0].attribution.display).toBe('2026.08.03 03:30, 새벽 대화 중')
    expect(result.content.payload.sub[0].text).toBe('오늘 고생했어 진짜')
    expect(JSON.stringify(result.content)).not.toContain('변조')
  })

  it('대화의 턴은 시각 순서로 놓이고 출처 표기는 첫 턴의 것이다(LLM이 순서·표기를 정하지 않는다)', () => {
    const result = run({
      kind: 'excerpts',
      main: [{ context: 'c', turns: [{ messageId: 'm-2' }, { messageId: 'm-1' }] }],
      sub: [],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.content.payload.main[0].turns.map((t) => t.speaker)).toEqual(['세준', '서영'])
    expect(result.content.payload.main[0].attribution.at).toBe('2026-08-22T09:20:00+09:00')
  })

  it('warmthIndex는 입력의 값이 그대로 주입된다(LLM 출력에 없다) - null도 그대로', () => {
    const withIndex = run(GOOD_OUTPUT, { ...INPUT, warmthIndex: 72 })
    expect(withIndex.ok && withIndex.content.payload.warmthIndex).toBe(72)
    const without = run(GOOD_OUTPUT)
    expect(without.ok && without.content.payload.warmthIndex).toBeNull()
    // LLM이 써 보낸 값은 쓰이지 않는다.
    const llmWrote = run({ ...GOOD_OUTPUT, warmthIndex: 99 })
    expect(llmWrote.ok && llmWrote.content.payload.warmthIndex).toBeNull()
  })

  it('입력의 warmthIndex가 범위(0~100) 밖이면 저장 스키마가 막는다', () => {
    const result = run(GOOD_OUTPUT, { ...INPUT, warmthIndex: 101 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('schema_invalid')
  })

  it('이 코너가 쓰는 AI 문장은 context 하나뿐이다 - 저장된 main 항목의 AI 쓴 키는 context뿐', () => {
    const result = run(GOOD_OUTPUT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Object.keys(result.content.payload.main[0]).sort()).toEqual(['attribution', 'context', 'turns'])
    expect(Object.keys(result.content.payload.sub[0]).sort()).toEqual(['attribution', 'speaker', 'text'])
  })
})

describe('17-4 응답 처리 - 개수 (17-0-7)', () => {
  const turn = (id: string) => ({ messageId: id })
  const item = (n: number) => ({
    context: 'c',
    turns: ['m-1', 'm-2', 'm-3', 'm-4'].slice(0, n).map(turn),
  })

  it('월간: main 1~3개는 통과, 0개·4개는 schema_invalid', () => {
    for (const n of [1, 2, 3]) {
      const r = run({ kind: 'excerpts', main: Array.from({ length: n }, () => item(1)), sub: [] })
      expect(r.ok).toBe(true)
    }
    for (const n of [0, 4]) {
      const r = run({ kind: 'excerpts', main: Array.from({ length: n }, () => item(1)), sub: [] })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toBe('schema_invalid')
    }
  })

  it('일간: main은 정확히 1개 - 1개만 통과, 2개는 schema_invalid', () => {
    const one = run({ kind: 'excerpts', main: [item(1)], sub: [] }, INPUT, DAILY_CONTEXT)
    expect(one.ok).toBe(true)
    const two = run({ kind: 'excerpts', main: [item(1), item(1)], sub: [] }, INPUT, DAILY_CONTEXT)
    expect(two.ok).toBe(false)
    if (!two.ok) expect(two.reason).toBe('schema_invalid')
  })

  it('"하한을 1로 낮춘다" - 다정한 대화가 하나뿐인 달도 싣는다(빈 결과가 아니다)', () => {
    const result = run({ kind: 'excerpts', main: [item(1)], sub: [] })
    expect(result.ok).toBe(true)
  })

  it('turns는 1~4턴, sub는 0~6개', () => {
    expect(run({ kind: 'excerpts', main: [item(4)], sub: [] }).ok).toBe(true)
    expect(run({ kind: 'excerpts', main: [{ context: 'c', turns: [] }], sub: [] }).ok).toBe(false)
    expect(
      run({ kind: 'excerpts', main: [{ context: 'c', turns: ['m-1', 'm-2', 'm-3', 'm-4', 'm-5'].map(turn) }], sub: [] }).ok,
    ).toBe(false)
    const six = ['m-1', 'm-2', 'm-3', 'm-4', 'm-5', 'm-6'].map(turn)
    expect(run({ kind: 'excerpts', main: [item(1)], sub: six }).ok).toBe(true)
    expect(run({ kind: 'excerpts', main: [item(1)], sub: [...six, turn('m-1')] }).ok).toBe(false)
  })
})

describe('17-4 응답 처리 - 명시적 빈 결과 (§17-0-5-D)', () => {
  it('{ "kind": "none" }은 insufficient_input이다(다정한 발화를 찾지 못함)', () => {
    const result = run({ kind: 'none' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('insufficient_input')
  })

  it.each([
    ['깨진 JSON', '{"kind":'],
    ['빈 문자열', ''],
    ['빈 객체', '{}'],
    ['배열', '[]'],
    ['kind 오탈자', '{"kind":"nonee"}'],
    ['main이 빈 배열', '{"kind":"excerpts","main":[],"sub":[]}'],
    ['null', 'null'],
  ])('파싱 실패와 섞이지 않는다 - %s는 schema_invalid다', (_name, raw) => {
    const result = run(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('schema_invalid')
  })
})

describe('17-4 응답 처리 - 금지 키 (원본 객체에, 파이프라인 전체 순서로)', () => {
  it('스키마에 없는 금지 키(verdict)를 LLM이 스스로 만들면 forbidden_content다', () => {
    const result = run({
      ...GOOD_OUTPUT,
      main: [{ ...GOOD_OUTPUT.main[0], verdict: '정말 다정하다' }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('forbidden_content')
      expect(result.detail).toContain('verdict')
    }
  })

  it('평가 필드(rating·comment류)를 스키마가 갖지 않는다 - rating을 만들면 forbidden_content', () => {
    const result = run({ ...GOOD_OUTPUT, rating: 5 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('forbidden_content')
  })
})

describe('17-4 응답 처리 - ID 해석 (r43·r44, 판정은 골격)', () => {
  it('입력에 없는 messageId는 schema_invalid(존재하지 않는 ID)', () => {
    const result = run({ kind: 'excerpts', main: [{ context: 'c', turns: [{ messageId: 'm-없음' }] }], sub: [] })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('schema_invalid')
      expect(result.detail).toContain('존재하지 않는 ID')
    }
  })

  it('입력 집합에 다른 커플의 메시지가 섞여 있고 LLM이 그것을 참조해도 막는다(두 번째 방어선)', () => {
    const foreign = message('m-foreign', '2026-08-20T10:00:00', '남', '남의 대화', { coupleId: COUPLE_B })
    const result = run(
      { kind: 'excerpts', main: [{ context: 'c', turns: [{ messageId: 'm-foreign' }] }], sub: [] },
      { ...INPUT, messages: [...CHAT_MESSAGES, foreign] },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('schema_invalid')
      expect(result.detail).toContain('다른 커플')
    }
  })

  it('기간 밖(끝 배타) 메시지를 참조하면 막는다', () => {
    const outside = message('m-late', '2026-09-01T00:00:00', '세준', '다음 달 첫 순간')
    const result = run(
      { kind: 'excerpts', main: [{ context: 'c', turns: [{ messageId: 'm-late' }] }], sub: [] },
      { ...INPUT, messages: [...CHAT_MESSAGES, outside] },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.detail).toContain('기간 밖')
  })

  it('다른 종류(photo·date)의 id로는 메시지를 가리킬 수 없다 - 종류가 맞아야 한다', () => {
    // 'd-1'은 입력 메시지에 없으므로 존재하지 않는 ID로 처리된다.
    const result = run({ kind: 'excerpts', main: [{ context: 'c', turns: [{ messageId: 'd-1' }] }], sub: [] })
    expect(result.ok).toBe(false)
  })
})

describe('17-4 골격 실행 (runCornerModule) - 호출 전·후 시점', () => {
  it('선행 검사: 기간 내 채팅 0건이면 LLM을 부르지 않고 insufficient_input(시도 0)', async () => {
    const llmClient = scriptedLlmClient([JSON.stringify(GOOD_OUTPUT)])
    const result = await runCornerModule(sweetWordsModule, {
      input: { warmthIndex: null, messages: [] },
      context: MONTHLY_CONTEXT,
      llmClient,
    })
    expect(result).toMatchObject({ outcome: 'failure', reason: 'insufficient_input', llmCallAttempts: 0 })
    expect(llmClient.requests).toHaveLength(0)
  })

  it('호출 후 빈 결과: 시도 1, 재시도 없음, insufficient_input', async () => {
    const llmClient = scriptedLlmClient([JSON.stringify({ kind: 'none' })])
    const result = await runCornerModule(sweetWordsModule, { input: INPUT, context: MONTHLY_CONTEXT, llmClient })
    expect(result).toMatchObject({ outcome: 'failure', reason: 'insufficient_input', llmCallAttempts: 1 })
    expect(llmClient.requests).toHaveLength(1)
  })

  it('정상: 성공하고 요청에 캐시 표시가 실린다', async () => {
    const llmClient = scriptedLlmClient([JSON.stringify(GOOD_OUTPUT)])
    const result = await runCornerModule(sweetWordsModule, { input: INPUT, context: MONTHLY_CONTEXT, llmClient })
    expect(result.outcome).toBe('success')
    expect(llmClient.requests[0].system.some((b) => b.cacheBreakpoint === true)).toBe(true)
  })

  it('schema_invalid는 1회 재시도한다 - 두 번째에 맞으면 성공(시도 2)', async () => {
    const llmClient = scriptedLlmClient(['{"kind":"excerpts"}', JSON.stringify(GOOD_OUTPUT)])
    const result = await runCornerModule(sweetWordsModule, { input: INPUT, context: MONTHLY_CONTEXT, llmClient })
    expect(result.outcome).toBe('success')
    expect(llmClient.requests).toHaveLength(2)
  })

  it('forbidden_content는 재시도하지 않는다(시도 1)', async () => {
    const llmClient = scriptedLlmClient([JSON.stringify({ ...GOOD_OUTPUT, verdict: 'x' }), JSON.stringify(GOOD_OUTPUT)])
    const result = await runCornerModule(sweetWordsModule, { input: INPUT, context: MONTHLY_CONTEXT, llmClient })
    expect(result).toMatchObject({ outcome: 'failure', reason: 'forbidden_content', llmCallAttempts: 1 })
  })

  it('입력에 다른 커플 레코드가 섞이면 LLM을 한 번도 부르지 않고 호 전체가 멈춘다(17-0-4-B)', async () => {
    const llmClient = scriptedLlmClient([JSON.stringify(GOOD_OUTPUT)])
    const foreign = message('m-foreign', '2026-08-20T10:00:00', '남', '남의 대화', { coupleId: COUPLE_B })
    await expect(
      runCornerModule(sweetWordsModule, {
        input: { ...INPUT, messages: [...CHAT_MESSAGES, foreign] },
        context: MONTHLY_CONTEXT,
        llmClient,
      }),
    ).rejects.toBeInstanceOf(CoupleMembershipError)
    expect(llmClient.requests).toHaveLength(0)
  })
})

describe('17-4 저장 스키마는 모양만 본다 (17-0-8)', () => {
  it('저장된 내용은 입력과 무관하게 저장 스키마로 다시 검증된다 - 앱이 읽을 때와 같은 조건', () => {
    const result = run(GOOD_OUTPUT)
    if (!result.ok) throw new Error('정상 응답이 실패')
    const withoutInput = sweetWordsModule.responseSpec({ warmthIndex: null, messages: [] }, MONTHLY_CONTEXT)
    expect(withoutInput.storedSchema.safeParse(result.content).success).toBe(true)
    expect(sweetWordsStoredSchema('monthly').safeParse(JSON.parse(JSON.stringify(result.content))).success).toBe(true)
  })

  it('대화의 턴 순서와 출처 표기는 파생값 단계가 만든다 - 저장 스키마는 순서를 고치지 않는다', () => {
    const spec = sweetWordsModule.responseSpec(INPUT, MONTHLY_CONTEXT)
    const att = (display: string, at: string) => ({ display, at, source: 'chat' as const })
    const derived = spec.derive({
      kind: 'excerpts',
      main: [
        {
          context: 'c',
          turns: [
            { messageId: 'b', speaker: '서영', text: '둘째', at: '2026-08-22T09:21:00+09:00', attribution: att('둘째 표기', '2026-08-22T09:21:00+09:00') },
            { messageId: 'a', speaker: '세준', text: '첫째', at: '2026-08-22T09:20:00+09:00', attribution: att('첫째 표기', '2026-08-22T09:20:00+09:00') },
          ],
        },
      ],
      sub: [],
    })
    if (!derived.ok) throw new Error(derived.detail)
    const main = (derived.value as { payload: { main: Array<{ attribution: { display: string }; turns: Array<{ text: string }> }> } }).payload.main
    expect(main[0].turns.map((t) => t.text)).toEqual(['첫째', '둘째'])
    expect(main[0].attribution.display).toBe('첫째 표기')
  })
})
