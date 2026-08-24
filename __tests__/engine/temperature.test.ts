import {
  DISCONNECTED_TEMPERATURE,
  TEMPERATURE_MAX,
  TEMPERATURE_MIN,
  clampTemperature,
  resolveDisconnectedTemperature,
} from '../../src/engine/temperature'

describe('resolveDisconnectedTemperature — 미연결 커플 고정값 (Part 9-2)', () => {
  it('항상 36.5를 반환한다', () => {
    expect(resolveDisconnectedTemperature()).toBe(36.5)
    expect(resolveDisconnectedTemperature()).toBe(DISCONNECTED_TEMPERATURE)
  })

  it('동일 입력(무입력) 100회 반복 실행 → 100회 모두 동일 결과', () => {
    const results = Array.from({ length: 100 }, () => resolveDisconnectedTemperature())
    expect(new Set(results).size).toBe(1)
  })
})

describe('clampTemperature — 0~100 범위, 소수 1자리 (SCHEMA.md numeric(4,1))', () => {
  it('범위를 벗어나면 클램프한다', () => {
    expect(clampTemperature(-5)).toBe(TEMPERATURE_MIN)
    expect(clampTemperature(150)).toBe(TEMPERATURE_MAX)
  })

  it('소수 1자리로 반올림한다', () => {
    expect(clampTemperature(36.55)).toBeCloseTo(36.6, 5)
    expect(clampTemperature(36.54)).toBeCloseTo(36.5, 5)
  })

  it('동일 입력 100회 반복 실행 → 100회 모두 동일 결과', () => {
    const results = Array.from({ length: 100 }, () => clampTemperature(72.345))
    expect(new Set(results).size).toBe(1)
  })
})
