/// <reference types="jest" />
import { runCornerModule, type CornerModule } from '../cornerPipeline.ts'
import { createLlmClient } from '../llmClient.ts'
import { saveCornerSuccess, type CornersTableClient } from '../saveCornerResult.ts'
import {
  CHAT_MESSAGES,
  DATE_RECALLED,
  DATE_THIS_1,
  DATE_THIS_2,
  MONTHLY_CONTEXT,
  PHOTOS,
} from '../testFixtures/cornerFixtures.ts'
import { dateArchiveModule } from './dateArchive.ts'
import { sweetWordsModule } from './sweetWords.ts'
import { thisMonthModule } from './thisMonth.ts'

/**
 * 코너 3종 -> 골격 -> `llmClient` -> 전송 본문 -> 저장 — 끝까지 한 번에 (MASTER 17-0-5-F, #14 3단계 완료 기준).
 * 위임: .claude/state/prompts/phase-7/38-corner-pipeline-three-corners.md.
 *
 * 증명: **코너가 표시한 캐시 지점이 `llmClient`가 보내는 요청 본문에 실제로 실린다.** 코너는 `cache_control`이라는
 * 이름을 모른다 - 이 테스트가 코너 모듈 -> 진짜 `createLlmClient`(가짜 `fetchImpl`) 경로로 확인한다.
 * 그리고 그 결과(`ValidatedContent`)가 저장 함수를 통과한다.
 */

interface WireBlock {
  text: string
  cache_control?: { type: string }
}
interface WireBody {
  system?: WireBlock[]
  messages: Array<{ content: WireBlock[] }>
}

const SWEET = {
  kind: 'excerpts',
  main: [{ context: '아침 출근길에 오간 대화', turns: [{ messageId: 'm-1' }, { messageId: 'm-2' }] }],
  sub: [{ messageId: 'm-3' }],
}

const DATES = {
  kind: 'articles',
  featuredDateId: 'd-1',
  articles: [DATE_THIS_1, DATE_THIS_2, DATE_RECALLED].map((d) => ({
    dateId: d.id,
    title: `제목 ${d.id}`,
    stopCaptions: [],
    tailoredQuestion: { text: '다음엔 어디 갈까?', basis: '그날의 동선' },
  })),
}

const THEME = {
  kind: 'theme',
  theme: {
    headline: '새로운 동네를 다닌 달',
    lead: '이번 달 기록이다.',
    polarity: 'neutral',
    signals: [{ kind: 'place', value: '연남동', evidence: [{ type: 'date', dateId: 'd-1' }] }],
  },
  articles: [
    { title: '하루', body: '본문', evidence: [{ type: 'photo', photoId: 'p-1' }] },
    { title: '아침', body: '본문', evidence: [{ type: 'message', messageId: 'm-1' }] },
  ],
  closing: '다음 달에도.',
}

function recordingCorners(): CornersTableClient & { updates: Array<Record<string, unknown>> } {
  const updates: Array<Record<string, unknown>> = []
  return {
    updates,
    from: () => ({
      update: (patch: Record<string, unknown>) => ({
        eq: () => {
          updates.push(patch)
          return Promise.resolve({ error: null })
        },
      }),
    }),
  }
}

async function runThroughRealClient<TInput, TLlm, TStored extends object>(
  corner: CornerModule<TInput, TLlm, TStored>,
  input: TInput,
  llmOutput: unknown,
) {
  const bodies: WireBody[] = []
  const fetchImpl = jest.fn((_url: unknown, init?: { body?: unknown }) => {
    bodies.push(JSON.parse(String(init?.body)) as WireBody)
    const body = { content: [{ type: 'text', text: JSON.stringify(llmOutput) }] }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') } as unknown as Response)
  })
  const llmClient = createLlmClient({
    apiKey: 'test-key',
    model: 'test-model',
    fetchImpl: fetchImpl as unknown as typeof fetch,
    sleepImpl: () => Promise.resolve(),
  })
  const result = await runCornerModule(corner, { input, context: MONTHLY_CONTEXT, llmClient })
  return { result, bodies, fetchImpl }
}

/** 코너 하나에 대해 같은 증명을 건다 - 코너마다 입력 타입이 달라 제네릭 함수로 묶는다(형변환 없이). */
function defineWireTests<TInput, TLlm, TStored extends object>(
  name: string,
  corner: CornerModule<TInput, TLlm, TStored>,
  input: TInput,
  otherInput: TInput,
  llmOutput: unknown,
): void {
  describe(`${name} - 코너 모듈 -> llmClient -> 전송 본문`, () => {
    it('캐시 표시는 전송 본문의 system 블록 둘에 실리고 user 블록에는 없다', async () => {
      const { bodies, fetchImpl } = await runThroughRealClient(corner, input, llmOutput)
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      const body = bodies[0]
      expect(body.system).toHaveLength(2)
      expect(body.system?.map((b) => b.cache_control)).toEqual([{ type: 'ephemeral' }, { type: 'ephemeral' }])
      expect(body.messages[0].content.length).toBeGreaterThan(0)
      expect(body.messages[0].content.some((b) => b.cache_control !== undefined)).toBe(false)
    })

    it('캐시 표시까지의 접두는 입력이 달라도 같은 본문이다', async () => {
      const first = (await runThroughRealClient(corner, input, llmOutput)).bodies[0]
      // 다른 입력이어도 시스템 블록은 같다 - 응답이 그 입력에 맞든 아니든 본문의 접두만 본다.
      const other = (await runThroughRealClient(corner, otherInput, llmOutput)).bodies[0]
      expect(other.system).toEqual(first.system)
      expect(other.messages[0].content).not.toEqual(first.messages[0].content)
    })

    it('성공하면 ValidatedContent가 저장 함수를 통과한다(status ready, content 저장)', async () => {
      const { result } = await runThroughRealClient(corner, input, llmOutput)
      expect(result.outcome).toBe('success')
      if (result.outcome !== 'success') return
      const client = recordingCorners()
      await saveCornerSuccess(client, {
        cornerId: 'corner-1',
        engineVersion: 'pipeline-v1',
        content: result.content,
        coeffBundle: result.coeffBundle,
        generationAttempts: result.llmCallAttempts,
      })
      expect(client.updates).toHaveLength(1)
      expect(client.updates[0]).toMatchObject({ status: 'ready', skip_reason: null, generation_attempts: 1 })
      const content = client.updates[0].content as { header: { cornerName: string; title: string } }
      expect(content.header.cornerName).toBe(corner.cornerName)
      expect(content.header.title).toBe(corner.pageTitle)
    })
  })
}

defineWireTests(
  '17-1 데이트 아카이브',
  dateArchiveModule,
  { dates: [DATE_THIS_1, DATE_THIS_2, DATE_RECALLED] },
  { dates: [DATE_THIS_1] },
  DATES,
)
defineWireTests(
  '17-4 다정한 말들',
  sweetWordsModule,
  { warmthIndex: null, messages: CHAT_MESSAGES },
  { warmthIndex: 10, messages: [CHAT_MESSAGES[0]] },
  SWEET,
)
defineWireTests(
  '17-5 이달의 우리',
  thisMonthModule,
  { messages: CHAT_MESSAGES, photos: PHOTOS, dates: [DATE_THIS_1] },
  { messages: [], photos: [PHOTOS[0]], dates: [] },
  THEME,
)
