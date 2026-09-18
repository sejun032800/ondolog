import { FORBIDDEN_KEYS, findForbiddenKeys } from '../../../src/engine/corners/forbiddenKeys'

/**
 * `FORBIDDEN_KEYS`/`findForbiddenKeys` — Part 17-0-4 런타임 검사 2단계.
 * 위임: .claude/state/prompts/phase-7/20-engine-dev-pipeline-r3.md
 */

describe('FORBIDDEN_KEYS 목록', () => {
  it('7개 갈래를 전부 포함한 비어있지 않은 목록이다(자리표시자가 아니다)', () => {
    expect(FORBIDDEN_KEYS.length).toBeGreaterThan(30)
    expect(FORBIDDEN_KEYS).toContain('score')
    expect(FORBIDDEN_KEYS).toContain('verdict')
    expect(FORBIDDEN_KEYS).toContain('advice')
    expect(FORBIDDEN_KEYS).toContain('problem')
    expect(FORBIDDEN_KEYS).toContain('blame')
    expect(FORBIDDEN_KEYS).toContain('prediction')
    expect(FORBIDDEN_KEYS).toContain('winner')
    expect(FORBIDDEN_KEYS).toContain('점수')
    expect(FORBIDDEN_KEYS).toContain('판정')
  })
})

describe('findForbiddenKeys — 위반 없음', () => {
  it('빈 객체는 위반이 없다', () => {
    expect(findForbiddenKeys({})).toEqual([])
  })

  it('금지 키와 무관한 일반 코너 payload는 위반이 없다', () => {
    const payload = {
      header: { title: '8월의 데이트', periodLabel: '2026년 8월' },
      payload: { entries: [{ text: '한강에서 자전거를 탔다', photoPath: 'p/1.jpg' }] },
    }
    expect(findForbiddenKeys(payload)).toEqual([])
  })

  it('엔진이 계산해 붙이는 필드명(온도·일치율 등)은 금지어를 포함하지 않는 한 걸리지 않는다', () => {
    expect(findForbiddenKeys({ temperature: 72.5, matchPercent: 88 })).toEqual([])
  })
})

describe('findForbiddenKeys — 위반 발견', () => {
  it('최상위 키가 금지어를 포함하면 걸린다', () => {
    expect(findForbiddenKeys({ score: 90 })).toEqual(['score'])
  })

  it('중첩 객체 안의 키도 걸린다(재귀 검사)', () => {
    const payload = { header: {}, payload: { summary: { verdict: '좋음' } } }
    expect(findForbiddenKeys(payload)).toEqual(['verdict'])
  })

  it('배열 원소 안의 키도 걸린다', () => {
    const payload = { entries: [{ text: 'a' }, { riskLevel: 'high' }] }
    expect(findForbiddenKeys(payload)).toEqual(['riskLevel'])
  })

  it('스네이크·캐멀 표기 차이를 무시하고 비교한다', () => {
    expect(findForbiddenKeys({ user_score: 1 })).toEqual(['user_score'])
    expect(findForbiddenKeys({ userScore: 1 })).toEqual(['userScore'])
  })

  it('대소문자를 무시하고 비교한다', () => {
    expect(findForbiddenKeys({ SCORE: 1 })).toEqual(['SCORE'])
    expect(findForbiddenKeys({ Verdict: 1 })).toEqual(['Verdict'])
  })

  it('여러 위반이 있으면 전부 보고한다', () => {
    const payload = { score: 1, advice: 'x', nested: { winner: 'A' } }
    const found = findForbiddenKeys(payload)
    expect(found).toHaveLength(3)
    expect(new Set(found)).toEqual(new Set(['score', 'advice', 'winner']))
  })

  it('7개 갈래를 각각 하나씩 실제로 잡는다', () => {
    expect(findForbiddenKeys({ grade: 1 })[0]).toBe('grade')
    expect(findForbiddenKeys({ diagnosis: 1 })[0]).toBe('diagnosis')
    expect(findForbiddenKeys({ suggestion: 1 })[0]).toBe('suggestion')
    expect(findForbiddenKeys({ weakness: 1 })[0]).toBe('weakness')
    expect(findForbiddenKeys({ fault: 1 })[0]).toBe('fault')
    expect(findForbiddenKeys({ outlook: 1 })[0]).toBe('outlook')
    expect(findForbiddenKeys({ loser: 1 })[0]).toBe('loser')
  })
})

describe('결정론 — 동일 입력 100회 반복 → 100회 동일 결과', () => {
  it('findForbiddenKeys는 같은 입력에 대해 항상 같은 결과를 낸다', () => {
    const payload = {
      header: { title: 'x' },
      payload: { items: [{ score: 1 }, { text: 'ok' }, { nested: { advice: 'y' } }] },
    }
    const results = Array.from({ length: 100 }, () => findForbiddenKeys(payload))
    const first = JSON.stringify(results[0])
    for (const r of results) {
      expect(JSON.stringify(r)).toBe(first)
    }
  })

  it('입력을 변형하지 않는다(순수 함수)', () => {
    const payload = { score: 1, nested: { a: 1 } }
    const snapshot = JSON.stringify(payload)
    findForbiddenKeys(payload)
    expect(JSON.stringify(payload)).toBe(snapshot)
  })
})
