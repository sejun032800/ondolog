import {
  cosineSimilarity,
  isMatch,
  matchAgainstReferences,
  type ReferenceEmbedding,
} from '../../src/engine/faceMatch'

describe('cosineSimilarity — 표준 공식 (A·B)/(‖A‖‖B‖)', () => {
  it('동일 벡터를 비교하면 유사도 1.0이다', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBe(1)
    expect(cosineSimilarity([5, 0, 0], [5, 0, 0])).toBe(1)
  })

  it('완전 반대 벡터를 비교하면 유사도 -1.0이다', () => {
    expect(cosineSimilarity([1, 2, 3], [-1, -2, -3])).toBe(-1)
  })

  it('직교(orthogonal) 벡터의 유사도는 0이다', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0)
  })

  it('알려진 벡터 쌍(3-4-5 직각삼각형 성분)으로 공식을 검증한다', () => {
    // a=[3,4](‖a‖=5), b=[4,3](‖b‖=5) → dot=24, 24/(5*5)=0.96
    expect(cosineSimilarity([3, 4], [4, 3])).toBeCloseTo(0.96, 10)
  })

  it('벡터 차원이 다르면 에러를 던진다(값을 지어내지 않는다)', () => {
    expect(() => cosineSimilarity([1, 2, 3], [1, 2])).toThrow(
      /dimensions must match/,
    )
  })

  it('빈 벡터는 에러를 던진다', () => {
    expect(() => cosineSimilarity([], [])).toThrow(/must not be empty/)
  })

  it('영벡터는 에러를 던진다(코사인 유사도가 정의되지 않음)', () => {
    expect(() => cosineSimilarity([0, 0, 0], [1, 2, 3])).toThrow(/zero vector/)
    expect(() => cosineSimilarity([1, 2, 3], [0, 0, 0])).toThrow(/zero vector/)
  })

  it('동일 입력 100회 반복 실행 → 100회 모두 동일 결과(결정론)', () => {
    const results = Array.from({ length: 100 }, () =>
      cosineSimilarity([0.12, 0.98, -0.5, 3.3], [0.9, -0.2, 1.1, 0.4]),
    )
    expect(new Set(results).size).toBe(1)
  })
})

describe('isMatch — 임계값은 항상 매개변수로 받는다(하드코딩 금지)', () => {
  it('유사도가 임계값 이상이면 true다(경계값 포함)', () => {
    expect(isMatch(0.8, 0.8)).toBe(true)
    expect(isMatch(0.9, 0.8)).toBe(true)
  })

  it('유사도가 임계값 미만이면 false다', () => {
    expect(isMatch(0.79, 0.8)).toBe(false)
  })

  it('같은 유사도라도 임계값을 다르게 주면 결과가 달라진다(하드코딩이 아님을 보여준다)', () => {
    expect(isMatch(0.75, 0.7)).toBe(true)
    expect(isMatch(0.75, 0.9)).toBe(false)
  })
})

describe('matchAgainstReferences — 여러 기준 중 가장 가까운 매칭', () => {
  const personal: ReferenceEmbedding = { id: 'personal', embedding: [1, 0, 0] }
  const couple: ReferenceEmbedding = { id: 'couple', embedding: [0, 1, 0] }

  it('가장 유사도가 높은 기준을 bestMatchId로 반환한다', () => {
    const result = matchAgainstReferences([0.9, 0.1, 0], [personal, couple], 0.5)
    expect(result.bestMatchId).toBe('personal')
    expect(result.bestSimilarity).toBeGreaterThan(0.9)
    expect(result.isMatch).toBe(true)
  })

  it('가장 높은 유사도도 임계값 미만이면 isMatch는 false지만 bestMatchId는 채워진다', () => {
    const result = matchAgainstReferences([0.9, 0.1, 0], [personal, couple], 0.999)
    expect(result.isMatch).toBe(false)
    expect(result.bestMatchId).toBe('personal')
  })

  it('references가 비어 있으면 에러 없이 "매칭 없음"을 반환한다(대표사진 미등록은 정상 상태)', () => {
    const result = matchAgainstReferences([1, 0, 0], [], 0.5)
    expect(result).toEqual({ isMatch: false, bestMatchId: null, bestSimilarity: null })
  })

  it('기준 중 하나라도 차원이 다르면 에러를 던진다(값을 지어내지 않는다)', () => {
    const mismatched: ReferenceEmbedding = { id: 'bad', embedding: [1, 0] }
    expect(() => matchAgainstReferences([1, 0, 0], [mismatched], 0.5)).toThrow(
      /dimensions must match/,
    )
  })

  it('동점이면 먼저 나온 기준이 채택된다(입력 순서가 같으면 항상 같은 결과)', () => {
    const a: ReferenceEmbedding = { id: 'a', embedding: [1, 0, 0] }
    const b: ReferenceEmbedding = { id: 'b', embedding: [1, 0, 0] }
    const result = matchAgainstReferences([1, 0, 0], [a, b], 0.5)
    expect(result.bestMatchId).toBe('a')
  })

  it('동일 입력 100회 반복 실행 → 100회 모두 동일 결과(결정론)', () => {
    const results = Array.from({ length: 100 }, () =>
      JSON.stringify(matchAgainstReferences([0.9, 0.1, 0], [personal, couple], 0.5)),
    )
    expect(new Set(results).size).toBe(1)
  })
})
