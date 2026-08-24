import * as fs from 'fs'
import * as path from 'path'
import {
  DNA_SCORE_MAX,
  DNA_SCORE_MIN,
  clampDnaScore,
  computeTotalScore,
} from '../../src/engine/dnaScore'

describe('clampDnaScore — 절대평가, 하한 50 (Part 17-2, SCHEMA.md check 제약)', () => {
  it('50 미만으로 절대 내려가지 않는다', () => {
    expect(clampDnaScore(0)).toBe(DNA_SCORE_MIN)
    expect(clampDnaScore(-1000)).toBe(50)
    expect(clampDnaScore(49.99)).toBe(50)
  })

  it('100을 초과하지 않는다', () => {
    expect(clampDnaScore(1000)).toBe(DNA_SCORE_MAX)
    expect(clampDnaScore(100.01)).toBe(100)
  })

  it('소수 2자리로 반올림한다', () => {
    expect(clampDnaScore(77.126)).toBeCloseTo(77.13, 5)
  })

  it('동일 입력 100회 반복 실행 → 100회 모두 동일 결과', () => {
    const results = Array.from({ length: 100 }, () => clampDnaScore(63.456))
    expect(new Set(results).size).toBe(1)
  })
})

describe('computeTotalScore — base + chat_delta, 50~100 클램프', () => {
  it('아무리 낮은 chat_delta라도 총점이 50 밑으로 내려가지 않는다', () => {
    expect(computeTotalScore(50, -1000)).toBe(50)
    expect(computeTotalScore(60, -30)).toBe(50)
  })

  it('아무리 높은 chat_delta라도 총점이 100을 넘지 않는다', () => {
    expect(computeTotalScore(90, 1000)).toBe(100)
  })

  it('정상 범위에서는 base + delta를 그대로 반영한다', () => {
    expect(computeTotalScore(70, 5)).toBe(75)
  })

  it('동일 입력 100회 반복 실행 → 100회 모두 동일 결과', () => {
    const results = Array.from({ length: 100 }, () => computeTotalScore(72.5, 3.25))
    expect(new Set(results).size).toBe(1)
  })
})

describe('dnaScore.ts 소스 정적 검사 — 절대평가 원칙 (백분위·상위% 금지)', () => {
  const rawSource = fs.readFileSync(
    path.join(__dirname, '../../src/engine/dnaScore.ts'),
    'utf8',
  )
  // 이 파일 자체가 "왜 percentile/population을 안 쓰는지"를 TSDoc
  // 주석으로 설명하며 그 단어를 인용하므로, 실행 코드만 검사한다.
  const source = rawSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

  it('percentile/백분위 관련 계산 코드가 없다', () => {
    expect(source).not.toMatch(/function\s+\w*[Pp]ercentile/)
    expect(source).not.toMatch(/export\s+(const|function)\s+\w*[Pp]ercentile/)
  })

  it('population/모집단 파라미터를 받는 함수가 없다', () => {
    expect(source).not.toMatch(/population/i)
  })
})
