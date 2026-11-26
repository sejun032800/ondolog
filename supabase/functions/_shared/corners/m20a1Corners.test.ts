/// <reference types="jest" />
/**
 * 2.0-A1 새 LLM 코너 두 개의 응답 검사(가짜 응답 - LLM 0). 지금 3코너와 같은 검사(길이 · 정책어 · 유저/사용자 · 말투 · 숫자 · 요일)에
 * 코너 규칙(판정 낱말 · 실행 팁 조건 · 7번 한 줄 꼴)을 더한 것을 본다. 어기면 재요청 1회 → 그래도 어기면 실패(골격 그대로).
 */
import { runCornerModule } from '../cornerPipeline.ts'
import { MONTHLY_CONTEXT, message, scriptedLlmClient } from '../testFixtures/cornerFixtures.ts'
import { ATTACHMENT_REFRAME_FOR_PROMPT, loveDnaModule, type LoveDnaFactsInput } from './loveDna.ts'
import { BUSIEST_LINE_PATTERN, roughGuessModule, type RoughGuessFactsInput } from './roughGuess.ts'
import { ATTACHMENT_REFRAME_KO } from '../../../../src/constants/attachmentDisplay'

const FACTS: LoveDnaFactsInput = {
  score: { base: 65, chatDelta: null, chatApplied: false, total: 65, coeffVersion: 'dna_base_only', previousTotal: null, delta: null, firstIssue: true },
  partners: [
    { name: '세준', labelKo: '예시 라벨 가' },
    { name: '서영', labelKo: null },
  ],
  bigFive: [
    { key: 'o', label: '개방성', a: 60, b: 55, gap: 5, relation: 'close' },
    { key: 'c', label: '성실성', a: 70, b: 40, gap: 30, relation: 'apart' },
    { key: 'e', label: '외향성', a: 80, b: 20, gap: 60, relation: 'apart' },
    { key: 'a', label: '우호성', a: 50, b: 50, gap: 0, relation: 'close' },
    { key: 'n', label: '신경성', a: 40, b: 45, gap: 5, relation: 'close' },
  ],
  sternberg: { intimacy: { a: 70, b: 70, shared: 70 }, passion: { a: 60, b: 30, shared: 30 }, commitment: { a: 80, b: 60, shared: 60 } },
  attachment: { a: 'secure', b: 'avoidant' },
  actionTipsAllowed: false,
}

const good = {
  explain: '이번 일치율 65는 두 분의 성격 검사 결과만으로 냈습니다.',
  attachmentCombo: { headline: '자기 세계와 다정함', body: '한 분은 조용한 시간을 아끼고 한 분은 마음을 먼저 건넵니다.' },
  strengths: ['우호성 값이 같습니다.', '친밀감 값이 70으로 같습니다.'],
  complements: ['모이는 쪽과 쉬는 쪽이 번갈아 갑니다.', '계획을 세우는 속도가 서로 다릅니다.'],
  tryTogether: [],
}

async function runDna(...responses: unknown[]) {
  const client = scriptedLlmClient(responses.map((r) => JSON.stringify(r)))
  const result = await runCornerModule(loveDnaModule, { input: { facts: FACTS }, context: MONTHLY_CONTEXT, llmClient: client })
  return { result, calls: client.requests.length }
}

describe('두 사람의 결 - 응답 검사', () => {
  it('바른 응답은 저장 모양으로 - 숫자 칸은 엔진 값 그대로 · 실행 팁 []', async () => {
    const { result, calls } = await runDna(good)
    expect(calls).toBe(1)
    expect(result.outcome).toBe('success')
    if (result.outcome !== 'success') return
    expect(result.content.payload.score.total).toBe(65)
    expect(result.content.payload.actionTips).toEqual([])
    expect(result.content.header.title).toBe('두 사람의 결')
  })

  it.each([
    ['판정 낱말 「부족」', { ...good, complements: ['서로 대화가 부족합니다.', '속도가 다릅니다.'] }],
    ['입력에 없는 숫자', { ...good, explain: '이번 일치율은 72입니다.' }],
    ['반말 말투', { ...good, strengths: ['둘 다 약속을 잘 지킨다', '친밀감이 같습니다.'] }],
    ['일치율 60 초과인데 실행 팁', { ...good, tryTogether: ['다정한 한 마디를 더해 보세요'] }],
    ['애착 유형명(정책어)', { ...good, attachmentCombo: { headline: '회피형과 안정형', body: '두 분의 결이 다릅니다.' } }],
    ['"사용자"', { ...good, explain: '두 사용자의 검사 결과로 냈습니다.' }],
  ])('%s -> 재요청 1회 뒤 실패', async (_name, bad) => {
    const { result, calls } = await runDna(bad, bad)
    expect(calls).toBe(2)
    expect(result.outcome).toBe('failure')
  })

  it('재료 없음(성격 데이터 한쪽 없음) -> 호출 0 · insufficient_input', async () => {
    const client = scriptedLlmClient([])
    const result = await runCornerModule(loveDnaModule, { input: { facts: null }, context: MONTHLY_CONTEXT, llmClient: client })
    expect(client.requests).toHaveLength(0)
    expect(result).toMatchObject({ outcome: 'failure', reason: 'insufficient_input' })
  })

  it('프롬프트의 애착 결 말은 attachmentDisplay 표와 같다 · 프롬프트에 유형명 · 채팅 반영 전 안내', () => {
    expect(ATTACHMENT_REFRAME_FOR_PROMPT).toEqual(ATTACHMENT_REFRAME_KO)
    const req = loveDnaModule.buildRequest({ facts: FACTS }, MONTHLY_CONTEXT)
    const user = req.user.map((b) => b.text).join('\n')
    expect(user).toContain('채팅 반영 전')
    expect(user).not.toMatch(/avoidant|secure|회피형/)
  })
})

const GUESS: RoughGuessFactsInput = {
  disclaimer: '재미로만 봐주세요. 진짜로 재는 건 아닙니다.',
  footnote: '성격 검사와 이번 달 대화 기록으로 계산했습니다',
  items: [
    { no: 1, key: 'confess_first', label: '먼저 고백했을 확률', source: 'estimate', kind: 'probability', similar: false, subject: '세준', percent: 73, line: '세준님이 먼저 고백했을 확률 73%쯤' },
    { no: 2, key: 'conflict_step_back', label: '한발 먼저 물러서는 쪽', source: 'estimate', kind: 'probability', similar: true, subject: null, percent: null, line: '세준님과 서영님이 비슷합니다' },
    { no: 3, key: 'anniversary_care', label: '기념일 챙기는 정도', source: 'estimate', kind: 'probability', similar: false, subject: '서영', percent: 61, line: '서영님이 기념일을 먼저 챙길 확률 61%쯤' },
  ],
  busiestDay: { no: 7, date: '2026-08-14', count: 40, source: 'measured' },
  monthlyTopic: {
    id: 1,
    title: '여행 계획을 세운다면',
    item: { no: 8, key: 'topic_1', label: '여행 계획을 세운다면', source: 'estimate', kind: 'probability', similar: false, subject: '세준', percent: 89, line: '세준님이 숙소를 먼저 정할 확률 89%쯤' },
  },
}
const DAY = [message('m-1', '2026-08-14T09:00:00', '세준', '이사 날짜 정했어?'), message('m-2', '2026-08-14T09:05:00', '서영', '응 이사는 다음 주')]

async function runGuess(...responses: unknown[]) {
  const client = scriptedLlmClient(responses.map((r) => JSON.stringify(r)))
  const result = await runCornerModule(roughGuessModule, { input: { facts: GUESS, dayMessages: DAY }, context: MONTHLY_CONTEXT, llmClient: client })
  return { result, calls: client.requests.length, requests: client.requests }
}

describe('어림짐작 7번 - 응답 검사', () => {
  it('바른 한 줄 · null(날짜만)도 실린다', async () => {
    const ok = await runGuess({ line: '그날은 이사 얘기가 오갔습니다' })
    expect(ok.result.outcome).toBe('success')
    if (ok.result.outcome === 'success') expect(ok.result.content.payload.busiestDay?.line).toBe('그날은 이사 얘기가 오갔습니다')
    const none = await runGuess({ line: null })
    expect(none.result.outcome).toBe('success')
    if (none.result.outcome === 'success') expect(none.result.content.payload.busiestDay).toMatchObject({ date: '2026-08-14', line: null })
  })

  it.each([
    ['꼴이 다름', { line: '이사 이야기를 많이 했습니다' }],
    ['판정 낱말', { line: '그날은 다툼 얘기가 오갔습니다' }],
    ['20자 넘음', { line: '그날은 다음 주 이사 날짜와 짐 정리 얘기가 오갔습니다' }],
    ['합니다체 아님', { line: '그날은 이사 얘기가 오갔다' }],
  ])('%s -> 재요청 1회 뒤 실패', async (_name, bad) => {
    const { result, calls } = await runGuess(bad, bad)
    expect(calls).toBe(2)
    expect(result.outcome).toBe('failure')
  })

  it('LLM 입력은 그날 메시지뿐 · 꼴 정규식', async () => {
    const { requests } = await runGuess({ line: null })
    const user = requests[0].user.map((b) => b.text).join('\n')
    expect(user).toContain('m-1')
    expect(user).toContain('2026-08-14')
    expect(BUSIEST_LINE_PATTERN.test('그날은 저녁 메뉴 얘기가 오갔습니다')).toBe(true)
    expect(BUSIEST_LINE_PATTERN.test('그날은  얘기가 오갔습니다')).toBe(false)
  })
})
