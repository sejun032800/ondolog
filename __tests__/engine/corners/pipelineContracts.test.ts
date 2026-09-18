import {
  statusForSkipReason,
  SKIP_REASON_RETRY_POLICY,
  type SkipReason,
} from '../../../src/engine/corners/pipelineContracts'

/**
 * `SkipReason`/저장 상태 매핑/재시도 정책 — Part 17-0-5, 17-0-5-A, 17-0-5-B.
 * 위임: .claude/state/prompts/phase-7/20-engine-dev-pipeline-r3.md 5부.
 */

describe('statusForSkipReason — Part 17-0-5-B 저장 매핑', () => {
  it('insufficient_input → skipped (정상 동작)', () => {
    expect(statusForSkipReason('insufficient_input')).toBe('skipped')
  })

  it('generation_failed → failed', () => {
    expect(statusForSkipReason('generation_failed')).toBe('failed')
  })

  it('schema_invalid → failed', () => {
    expect(statusForSkipReason('schema_invalid')).toBe('failed')
  })

  it('forbidden_content → failed', () => {
    expect(statusForSkipReason('forbidden_content')).toBe('failed')
  })
})

describe('SKIP_REASON_RETRY_POLICY — Part 17-0-5-A', () => {
  it('4값이 전부 있고 이름이 그대로다', () => {
    const keys = Object.keys(SKIP_REASON_RETRY_POLICY).sort()
    expect(keys).toEqual(
      ['forbidden_content', 'generation_failed', 'insufficient_input', 'schema_invalid'].sort(),
    )
  })

  it('insufficient_input은 재시도하지 않는다', () => {
    expect(SKIP_REASON_RETRY_POLICY.insufficient_input.pipelineRetriesOnFailure).toBe(false)
  })

  it('forbidden_content는 재시도하지 않는다', () => {
    expect(SKIP_REASON_RETRY_POLICY.forbidden_content.pipelineRetriesOnFailure).toBe(false)
  })

  it('schema_invalid는 파이프라인이 최대 1회 재시도를 결정한다', () => {
    expect(SKIP_REASON_RETRY_POLICY.schema_invalid.pipelineRetriesOnFailure).toBe(true)
    expect(SKIP_REASON_RETRY_POLICY.schema_invalid.maxPipelineRetries).toBe(1)
  })

  it('generation_failed는 파이프라인 계층에서 추가 재시도를 결정하지 않는다(llmClient가 이미 예산 안에서 처리)', () => {
    expect(SKIP_REASON_RETRY_POLICY.generation_failed.pipelineRetriesOnFailure).toBe(false)
  })
})

describe('타입 층 강제 — SkipReason 밖의 값은 컴파일되지 않는다', () => {
  it('4값 각각이 SkipReason에 할당 가능하다(컴파일 시점 확인, 런타임은 항등 검사)', () => {
    const reasons: SkipReason[] = [
      'insufficient_input',
      'generation_failed',
      'schema_invalid',
      'forbidden_content',
    ]
    for (const r of reasons) {
      expect(typeof statusForSkipReason(r)).toBe('string')
    }
  })

  it('컴파일 시점 가드 — 4값 밖의 문자열은 SkipReason에 대입되지 않는다', () => {
    // @ts-expect-error 'validation_failed'는 SkipReason 4값이 아니다(r15가 시도했다가 r17에서 되돌린 병합안).
    const invalid: SkipReason = 'validation_failed'
    expect(invalid).toBe('validation_failed')
  })
})
