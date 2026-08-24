/**
 * 엔진 전역 반올림/클램프 유틸 — 순수 함수, 상태 없음.
 *
 * 부동소수점 누적 오차가 결과를 바꾸지 않도록, 각 산출 필드는 이 파일의
 * 함수를 딱 한 번(최종 출력 직전)만 호출해 반올림한다. 중간 계산에서는
 * 절대 호출하지 않는다 — 이 원칙은 이 파일을 사용하는 모든 엔진 모듈
 * (leagueStats.ts, temperature.ts, dnaScore.ts)의 계약이다.
 */

/** 소수 `decimals`자리로 반올림. `Number.EPSILON` 보정으로 0.005 같은 경계값의 부동소수점 오류를 방지한다. */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/** [min, max] 범위로 클램프. 반올림은 하지 않는다(별도 호출). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** 반올림 + 클램프를 한 번에. 이 파일을 쓰는 모듈들의 "유일한 반올림 지점"으로 쓴다. */
export function roundAndClamp(
  value: number,
  decimals: number,
  min: number,
  max: number,
): number {
  return clamp(roundTo(value, decimals), min, max)
}
