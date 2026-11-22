/// <reference types="jest" />
/**
 * 84-g ① "유저" · "사용자" 지면 0 (ROADMAP r143 R143-3 ①) - 프롬프트 한 줄 + 값 검사 금지 표현.
 * 위임: .claude/state/prompts/phase-7/84-g-dispatch-first-issue-polish.md
 * 원문 인용(따옴표)은 검사 밖(84-c 따옴표 제외와 같은 규칙). LLM 호출 0 - 가짜 클라이언트. 예문은 시험용 짧은 문장이다.
 */
import { processCornerResponse, runCornerModule } from '../cornerPipeline.ts'
import { stripQuoted } from '../../../../src/engine/corners/contentChecks.ts'
import {
  FORBIDDEN_PERSON_EXPRESSIONS,
  THIS_MONTH_VALUE_RULES,
  findValueViolations,
  withoutQuoted,
} from '../../../../src/engine/corners/valueChecks.ts'
import { COMMON_PRINCIPLES_BLOCK } from './cornerCommon.ts'
import { dateArchiveModule, type DateArchiveInput } from './dateArchive.ts'
import { sweetWordsModule, type SweetWordsInput } from './sweetWords.ts'
import { thisMonthModule, type ThisMonthInput } from './thisMonth.ts'
import { CHAT_MESSAGES, DATE_RECALLED, DATE_THIS_1, DATE_THIS_2, MONTHLY_CONTEXT, PHOTOS, scriptedLlmClient } from '../testFixtures/cornerFixtures.ts'

const TM_INPUT: ThisMonthInput = { messages: CHAT_MESSAGES, photos: PHOTOS, dates: [DATE_THIS_1, DATE_THIS_2] }
const DA_INPUT: DateArchiveInput = { dates: [DATE_THIS_1, DATE_THIS_2, DATE_RECALLED] }
const SW_INPUT: SweetWordsInput = { warmthIndex: null, messages: CHAT_MESSAGES }

function tm(body0: string) {
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
  }
}

const rules = [{ path: 'closing', maxLength: 42 }]

describe('84-g ① 값 검사 - "유저" · "사용자"', () => {
  it('목록은 둘', () => {
    expect([...FORBIDDEN_PERSON_EXPRESSIONS]).toEqual(['유저', '사용자'])
  })

  it('AI 문장 "유저가 남긴" → 걸림', () => {
    expect(findValueViolations({ closing: '유저가 남긴 기록이 붙어 있습니다.' }, rules)).toEqual(['closing: 금지 표현 「유저」(두 사람 · 두 분으로)'])
  })

  it('"사용자 이름"처럼 붙은 말도 걸림(부분 문자열)', () => {
    expect(findValueViolations({ closing: '사용자 이름이 적힌 기록입니다.' }, rules)).toEqual(['closing: 금지 표현 「사용자」(두 사람 · 두 분으로)'])
    expect(findValueViolations({ closing: '사용자들이 남긴 기록입니다.' }, rules)).toEqual(['closing: 금지 표현 「사용자」(두 사람 · 두 분으로)'])
  })

  it('원문 인용(따옴표) 안의 "사용자" · "유저" → 통과 · 따옴표 밖에 또 있으면 걸림', () => {
    for (const q of ['"사용자 설정 바꿨어"', '“유저 많더라”', '「사용자」', '『유저』', "'사용자'", '‘유저’']) {
      expect(findValueViolations({ closing: `${q}라는 말이 오갔습니다.` }, rules)).toEqual([])
    }
    expect(findValueViolations({ closing: '"사용자" 이야기를 한 유저입니다.' }, rules)).toEqual(['closing: 금지 표현 「유저」(두 사람 · 두 분으로)'])
  })

  it('"두 사람" · "두 분"은 통과', () => {
    expect(findValueViolations({ closing: '두 사람이 남긴 기록이 붙어 있습니다.' }, rules)).toEqual([])
    expect(findValueViolations({ closing: '두 분이 남긴 기록이 붙어 있습니다.' }, rules)).toEqual([])
  })

  it('따옴표 빼기는 84-c `stripQuoted`와 같다(이 폴더 파일은 서로 가져오지 않아 사본)', () => {
    const s = `앞 "가" 'ㄴ' “다” ‘라’ 「마」 『바』 뒤`
    expect(withoutQuoted(s)).toBe(stripQuoted(s))
  })

  it('이달의 우리 본문 칸이 규칙 안에 있다(최종 실측 r2의 칸)', () => {
    expect(THIS_MONTH_VALUE_RULES.map((r) => r.path)).toContain('articles[].body')
  })
})

describe('84-g ① 코너 응답 처리 · 골격', () => {
  it('이달의 우리: 본문 "유저가 남긴" → schema_invalid(칸 · 표현만, 문장 0)', () => {
    const r = processCornerResponse(thisMonthModule, JSON.stringify(tm('8월 19일 카페 칸에는 유저가 남긴 기록이 붙어 있습니다.')), TM_INPUT, MONTHLY_CONTEXT)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('schema_invalid')
      expect(r.detail).toBe('값 검사: articles[].body: 금지 표현 「유저」(두 사람 · 두 분으로)')
      expect(r.detail).not.toContain('카페 칸')
    }
  })

  it('이달의 우리: 따옴표 안 원문 "사용자" → 통과', () => {
    const r = processCornerResponse(thisMonthModule, JSON.stringify(tm('8월 19일에는 "사용자 설정"이라는 말이 오갔습니다.')), TM_INPUT, MONTHLY_CONTEXT)
    expect(r.ok).toBe(true)
  })

  it('데이트 아카이브 캡션 · 다정한 말 정황도 걸린다', () => {
    const da = {
      kind: 'articles',
      featuredDateId: 'd-1',
      articles: [
        { dateId: 'd-old', title: '합정 산책', stopCaptions: [], tailoredQuestion: { text: '올해도 합정에 가볼까요?', basis: '합정 공원 방문' } },
        { dateId: 'd-2', title: '성수동 카페', stopCaptions: [{ seq: 0, caption: '사용자 기록 없는 오후 1시 카페' }], tailoredQuestion: { text: '저녁도 먹어볼까요?', basis: '낮 카페 방문' } },
        { dateId: 'd-1', title: '영화와 저녁', stopCaptions: [{ seq: 1, caption: '영화 다음 식당' }], tailoredQuestion: { text: '다음에 또 영화 보러 갈까요?', basis: '영화관 구간이 있어서' } },
      ],
    }
    const r1 = processCornerResponse(dateArchiveModule, JSON.stringify(da), DA_INPUT, MONTHLY_CONTEXT)
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.detail).toContain('articles[].stopCaptions[].caption: 금지 표현 「사용자」')
    const sw = { kind: 'excerpts', main: [{ context: '유저 둘이 아침에 오간 대화', turns: [{ messageId: 'm-1' }, { messageId: 'm-2' }], conflict: false }], sub: [] }
    const r2 = processCornerResponse(sweetWordsModule, JSON.stringify(sw), SW_INPUT, MONTHLY_CONTEXT)
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.detail).toContain('main[].context: 금지 표현 「유저」')
  })

  it('지금의 재요청 → 빠짐: 첫 응답 "유저" → 안내 블록에 칸 · 표현 → 둘 다 걸리면 schema_invalid · 보낸 수 2', async () => {
    const bad = JSON.stringify(tm('8월 19일 카페 칸에는 유저가 남긴 기록이 붙어 있습니다.'))
    const fixed = JSON.stringify(tm('8월 19일 카페 칸에는 두 사람이 남긴 기록이 붙어 있습니다.'))
    const ok = scriptedLlmClient([bad, fixed])
    const r = await runCornerModule(thisMonthModule, { input: TM_INPUT, context: MONTHLY_CONTEXT, llmClient: ok })
    expect(r.outcome).toBe('success')
    const hint = ok.requests[1].user[ok.requests[1].user.length - 1].text
    expect(hint).toContain('- articles[].body: 금지 표현 「유저」(두 사람 · 두 분으로)')
    const twice = scriptedLlmClient([bad, bad, bad])
    const f = await runCornerModule(thisMonthModule, { input: TM_INPUT, context: MONTHLY_CONTEXT, llmClient: twice })
    expect(f.outcome).toBe('failure')
    if (f.outcome === 'failure') expect(f.reason).toBe('schema_invalid')
    expect(twice.requests).toHaveLength(2)
  })
})

describe('84-g ① 프롬프트', () => {
  it('공통 원칙에 한 줄 · 세 코너 system에 같은 블록', () => {
    expect(COMMON_PRINCIPLES_BLOCK.text).toContain('- 두 사람을 가리킬 때는 "두 사람" 또는 "두 분"이라고 씁니다. "유저" · "사용자"는 쓰지 않습니다.')
    for (const req of [
      thisMonthModule.buildRequest(TM_INPUT, MONTHLY_CONTEXT),
      dateArchiveModule.buildRequest(DA_INPUT, MONTHLY_CONTEXT),
      sweetWordsModule.buildRequest(SW_INPUT, MONTHLY_CONTEXT),
    ]) {
      expect(req.system[0]).toBe(COMMON_PRINCIPLES_BLOCK)
    }
  })

  it('프롬프트 지시문 자체는 그 한 줄 말고 "유저" · "사용자"를 쓰지 않는다(R134-1 - 예문 · 지시가 검사 기준과 같게)', () => {
    const rule = '"유저" · "사용자"는 쓰지 않습니다.'
    for (const req of [
      thisMonthModule.buildRequest(TM_INPUT, MONTHLY_CONTEXT),
      dateArchiveModule.buildRequest(DA_INPUT, MONTHLY_CONTEXT),
      sweetWordsModule.buildRequest(SW_INPUT, MONTHLY_CONTEXT),
    ]) {
      const sys = req.system.map((b) => b.text).join('\n').replace(rule, '')
      expect(sys).not.toMatch(/유저|사용자/)
    }
  })
})
