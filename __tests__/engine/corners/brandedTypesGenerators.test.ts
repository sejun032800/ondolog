import { z } from 'zod'
import { validateCornerContent, buildCoeffBundle } from '../../../src/engine/corners/brandedTypes'

/**
 * `validateCornerContent`/`buildCoeffBundle` — 브랜드 값을 만드는 유일한
 * 경로(Part 17-0-2, 정적 규칙 E). 위임:
 * .claude/state/prompts/phase-7/20-engine-dev-pipeline-r3.md 3부.
 */

const SamplePayloadSchema = z.object({
  title: z.string(),
  note: z.string().optional(),
})

describe('validateCornerContent — 순서: Zod 파싱 → FORBIDDEN_KEYS (Part 17-0-4)', () => {
  it('둘 다 통과하면 ValidatedContent를 반환한다', () => {
    const result = validateCornerContent({ title: '한강 데이트', note: '자전거' }, SamplePayloadSchema)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.content).toEqual({ title: '한강 데이트', note: '자전거' })
    }
  })

  it('Zod 파싱 실패 → schema_invalid (FORBIDDEN_KEYS 검사는 실행되지 않는다)', () => {
    const result = validateCornerContent({ title: 42 }, SamplePayloadSchema)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('schema_invalid')
      expect(typeof result.detail).toBe('string')
    }
  })

  it('스키마는 통과하지만 FORBIDDEN_KEYS 위반 → forbidden_content', () => {
    const SchemaWithScore = z.object({ title: z.string(), score: z.number() })
    const result = validateCornerContent({ title: 'x', score: 100 }, SchemaWithScore)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('forbidden_content')
      expect(result.detail).toContain('score')
    }
  })

  it('스키마 통과 후 중첩 필드에 금지 키가 있어도 forbidden_content로 잡힌다', () => {
    const NestedSchema = z.object({
      title: z.string(),
      payload: z.object({ verdict: z.string() }),
    })
    const result = validateCornerContent({ title: 'x', payload: { verdict: 'good' } }, NestedSchema)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('forbidden_content')
  })

  it('raw가 완전히 다른 타입(배열)이어도 schema_invalid로 처리된다(throw하지 않는다)', () => {
    const result = validateCornerContent([1, 2, 3], SamplePayloadSchema)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('schema_invalid')
  })
})

describe('buildCoeffBundle — app_config에서 읽은 원시 값만 CoeffBundle이 된다', () => {
  it('version 필드가 있으면 CoeffBundle로 조립된다', () => {
    const bundle = buildCoeffBundle({ version: '1.0.0', someCoeff: 0.3 })
    expect(bundle.version).toBe('1.0.0')
  })

  it('version이 없으면 던진다', () => {
    expect(() => buildCoeffBundle({ someCoeff: 0.3 })).toThrow()
  })

  it('version이 문자열이 아니면 던진다', () => {
    expect(() => buildCoeffBundle({ version: 123 as unknown as string })).toThrow()
  })

  it('version이 빈 문자열이면 던진다', () => {
    expect(() => buildCoeffBundle({ version: '' })).toThrow()
  })
})

describe('결정론 — 동일 입력 100회 반복 → 100회 동일 결과', () => {
  it('validateCornerContent는 같은 입력에 항상 같은 결과를 낸다', () => {
    const input = { title: 'x', score: 1 }
    const SchemaWithScore = z.object({ title: z.string(), score: z.number() })
    const results = Array.from({ length: 100 }, () => validateCornerContent(input, SchemaWithScore))
    for (const r of results) {
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toBe('forbidden_content')
    }
  })

  it('buildCoeffBundle은 같은 입력에 항상 같은 결과를 낸다', () => {
    const raw = { version: '2.3.1', a: 1, b: 2 }
    const results = Array.from({ length: 100 }, () => buildCoeffBundle(raw))
    for (const r of results) {
      expect(r.version).toBe('2.3.1')
    }
  })
})
