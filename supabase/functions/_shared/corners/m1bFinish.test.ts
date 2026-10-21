/// <reference types="jest" />
import { runCornerModule } from '../cornerPipeline.ts'
import {
  DATE_RECALLED,
  DATE_THIS_1,
  DATE_THIS_2,
  MONTHLY_CONTEXT,
  dateRecord,
  message,
  scriptedLlmClient,
} from '../testFixtures/cornerFixtures.ts'
import { DATE_ARCHIVE_REFERENCES, dateArchiveModule, type DateArchiveInput } from './dateArchive.ts'
import { sweetWordsModule } from './sweetWords.ts'
import { thisMonthModule } from './thisMonth.ts'

/**
 * M1b 마무리 (위임 52r2-): 17-4 문구 복원, 17-1 데이트 단위 맥락, 재소환 데이트의 대표 화보 자격(MASTER r59).
 */

const systemText = (req: { system: readonly { text: string }[] }) => req.system.map((b) => b.text).join('\n')
const userText = (req: { user: readonly { text: string }[] }) => req.user.map((b) => b.text).join('\n')

describe('17-4 프롬프트 문구 (MASTER 17-4 "덮인 것을 다시 꺼내주는 것")', () => {
  it('"다툼에 덮인"을 쓰지 않고 17-4 문구로 돌아왔다', () => {
    const req = sweetWordsModule.buildRequest(
      { warmthIndex: null, messages: [message('m-1', '2026-08-10T09:00:00', '세준', '안녕')] },
      MONTHLY_CONTEXT,
    )
    const sys = systemText(req)
    expect(sys).toContain('덮인 것을 다시 꺼내주는 것')
    expect(sys).not.toContain('다툼에 덮인')
  })
})

const ARTICLE = (dateId: string) => ({
  dateId,
  title: '하루',
  stopCaptions: [],
  tailoredQuestion: { text: '다음엔 어디 갈까?', basis: '입력의 장소' },
})

function output(featuredDateId: string, ids: readonly string[]) {
  return JSON.stringify({ kind: 'articles', featuredDateId, articles: ids.map(ARTICLE) })
}

describe('17-1 대표 화보 자격 (17-0-7 표, r59) - 코드로 강제한다', () => {
  const WITH_PERIOD: DateArchiveInput = { dates: [DATE_THIS_1, DATE_THIS_2, DATE_RECALLED] }
  const IDS = ['d-1', 'd-2', 'd-old']

  it('이번 달 데이트가 있는데 재소환 데이트를 featured로 고른 응답은 schema_invalid다', async () => {
    const llm = scriptedLlmClient([output('d-old', IDS)])
    const r = await runCornerModule(dateArchiveModule, { input: WITH_PERIOD, context: MONTHLY_CONTEXT, llmClient: llm })
    // schema_invalid는 최대 1회 재시도(17-0-5-A) - 같은 응답이 반복되므로 두 번째에도 실패한다.
    expect(r).toMatchObject({ outcome: 'failure', reason: 'schema_invalid', llmCallAttempts: 2 })
    if (r.outcome === 'failure') expect(r.detail).toContain('재소환 데이트가 대표 화보')
  })

  it('다른 데이트로 바꿔 끼우지 않는다 - 재시도에서 LLM이 이번 달 데이트를 고르면 그 선택이 그대로 저장된다', async () => {
    const llm = scriptedLlmClient([output('d-old', IDS), output('d-2', IDS)])
    const r = await runCornerModule(dateArchiveModule, { input: WITH_PERIOD, context: MONTHLY_CONTEXT, llmClient: llm })
    expect(r.outcome).toBe('success')
    if (r.outcome === 'success') {
      expect(r.llmCallAttempts).toBe(2)
      expect(r.content.payload.articles.filter((a) => a.featured).map((a) => a.dateId)).toEqual(['d-2'])
    }
  })

  it('이번 달 데이트가 1건뿐이어도 재소환은 featured가 될 수 없다', async () => {
    const llm = scriptedLlmClient([output('d-old', ['d-1', 'd-old'])])
    const r = await runCornerModule(dateArchiveModule, {
      input: { dates: [DATE_THIS_1, DATE_RECALLED] },
      context: MONTHLY_CONTEXT,
      llmClient: llm,
    })
    expect(r).toMatchObject({ outcome: 'failure', reason: 'schema_invalid' })
  })

  it('이번 달 데이트가 0건이면 재소환에서 고른다', async () => {
    const llm = scriptedLlmClient([output('d-old', ['d-old'])])
    const r = await runCornerModule(dateArchiveModule, {
      input: { dates: [DATE_RECALLED] },
      context: MONTHLY_CONTEXT,
      llmClient: llm,
    })
    expect(r.outcome).toBe('success')
    if (r.outcome === 'success') expect(r.content.payload.articles[0].featured).toBe(true)
  })

  it('이번 달 데이트를 featured로 고르면 재소환이 같이 있어도 통과한다', async () => {
    const llm = scriptedLlmClient([output('d-1', IDS)])
    const r = await runCornerModule(dateArchiveModule, { input: WITH_PERIOD, context: MONTHLY_CONTEXT, llmClient: llm })
    expect(r.outcome).toBe('success')
  })

  it('프롬프트의 선별 순서 문구도 같은 규칙을 말한다', () => {
    const sys = systemText(dateArchiveModule.buildRequest(WITH_PERIOD, MONTHLY_CONTEXT))
    expect(sys).toContain('recalled가 false인 데이트가 하나라도 있으면 그중에서만 고른다')
    expect(sys).toContain('하나도 없을 때만 고를 수 있다')
  })
})

describe('17-1 데이트 단위 메모·사진 (F-2) - 읽기 전용 맥락', () => {
  const base = dateRecord('d-lv', '2026-08-12', '망원동', [
    { seq: 0, time: '13:00', placeName: '망원 시장', lat: null, lng: null, photos: [], userNotes: [] },
  ])
  const LEVEL = {
    photos: [
      { path: 'p/a.jpg', width: 100, height: 80 },
      { path: 'p/b.jpg', width: 100, height: 80 },
    ],
    userNotes: [
      { authorId: 'u1', authorName: '세준', type: 'memo' as const, text: '시장에서 호떡 먹음' },
      { authorId: 'u2', authorName: '서영', type: 'drawing' as const, path: 'd/x.png' },
    ],
  }
  const dated: DateArchiveInput = { dates: [{ ...base, source: { ...base.source, dateLevel: LEVEL } }] }

  it('user 블록의 데이트 줄에 dateLevel(사진 장수, 메모는 글, 그림은 종류만)이 실린다', () => {
    const req = dateArchiveModule.buildRequest(dated, MONTHLY_CONTEXT)
    const line = userText(req)
      .split('\n')
      .find((l) => l.startsWith('{"id":"d-lv"'))
    expect(line).toBeDefined()
    const parsed = JSON.parse(line as string)
    expect(parsed.dateLevel).toEqual({
      photoCount: 2,
      userNotes: [{ type: 'memo', text: '시장에서 호떡 먹음' }, { type: 'drawing' }],
    })
    // 구간 쪽은 그대로다.
    expect(parsed.stops[0]).toMatchObject({ seq: 0, photoCount: 0, userNotes: [] })
    // 사진 경로·작성자 ID는 싣지 않는다 - 참조할 수 있는 ID가 아니다.
    expect(line).not.toContain('p/a.jpg')
    expect(line).not.toContain('authorId')
  })

  it('dateLevel이 없는 레코드에는 키가 없다', () => {
    const text = userText(dateArchiveModule.buildRequest({ dates: [DATE_THIS_1] }, MONTHLY_CONTEXT))
    expect(text).not.toContain('dateLevel')
  })

  it('system 블록이 읽기 전용 맥락으로 다루라고 말한다', () => {
    const sys = systemText(dateArchiveModule.buildRequest(dated, MONTHLY_CONTEXT))
    expect(sys).toContain('dateLevel')
    expect(sys).toContain('읽기 전용 맥락')
  })

  it('출력은 바뀌지 않는다 - dateLevel의 글·경로가 저장 내용에 새지 않는다', async () => {
    const llm = scriptedLlmClient([output('d-lv', ['d-lv'])])
    const r = await runCornerModule(dateArchiveModule, { input: dated, context: MONTHLY_CONTEXT, llmClient: llm })
    expect(r.outcome).toBe('success')
    if (r.outcome === 'success') {
      const json = JSON.stringify(r.content)
      expect(json).not.toContain('호떡')
      expect(json).not.toContain('p/a.jpg')
    }
  })

  it('ID 참조 선언은 그대로다 - 데이트만 참조하고 사진은 참조 대상이 아니다', () => {
    if (DATE_ARCHIVE_REFERENCES.kind !== 'fields') throw new Error('선언이 바뀌었다')
    expect(DATE_ARCHIVE_REFERENCES.fields.map((f) => [f.path, f.kind])).toEqual([
      ['featuredDateId', 'date'],
      ['articles[].dateId', 'date'],
    ])
  })

  it('17-5(이달의 우리)의 프롬프트에는 dateLevel이 실리지 않는다', () => {
    const req = thisMonthModule.buildRequest({ messages: [], photos: [], dates: dated.dates }, MONTHLY_CONTEXT)
    expect(userText(req)).not.toContain('dateLevel')
  })
})
