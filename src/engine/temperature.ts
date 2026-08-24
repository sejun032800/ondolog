/**
 * 연애 온도 — 결정론적 유틸리티 (부분 구현, 아래 "미구현" 항목 참고).
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-2 "연애 온도" 표,
 * `docs/ONDOLOG_SCHEMA.md` §8-1 `daily_temperature`.
 *
 * ⚠️ **핵심 결합 공식이 문서 어디에도 없다.** Part 9-2는 "로직 | 선행
 * 프로젝트의 연애 일치율 로직 계승, 명칭만 변경"이라고만 적혀 있고,
 * 그 "선행 프로젝트"의 실제 가중치·정규화 공식은 이 저장소의 어떤
 * 문서에도 원문이 없다(마스터 문서·SCHEMA·ORCHESTRATION·ROADMAP 전체
 * grep 확인). CLAUDE.md "문서에 없는 내용을 지어내지 말 것. 불명확하면
 * 작업을 멈추고 물어볼 것" 원칙에 따라, 대화량·응답속도·감정 톤을
 * 실제로 결합해 온도를 산출하는 함수(`computeDailyTemperature` 같은)는
 * **이 파일에 구현하지 않는다.** 대신 문서에 명시적으로 나온, 논쟁의
 * 여지가 없는 규칙(미연결 기본값 36.5, 범위 0~100, DB 소수 자릿수)만
 * 구현한다. 최종 보고서에 이 공식 부재를 질문 목록으로 보고한다.
 *
 * 문서에 확정된 것:
 *   - 미연결 커플: 36.5도 고정 (Part 9-2, SCHEMA.md temperature 컬럼 기본값)
 *   - 범위: 0~100 (SCHEMA.md check 제약)
 *   - 갱신: 일 단위 배치(자정 Edge Function)만. 앱은 저장값을 읽기만
 *     한다 — 실시간 계산 금지(CLAUDE.md 절대 규칙과 동일 원칙, Part 9-2).
 *     이 파일이 export하는 함수들은 그 배치 잡에서 쓰일 순수 계산
 *     유틸일 뿐, 이 함수를 앱 클라이언트에서 호출하는 코드는 절대
 *     작성하지 않는다.
 *   - DB 정밀도: `numeric(4,1)` — 소수 1자리.
 *
 * daily_temperature 테이블에는 `engine_version` 컬럼이 없다
 * (SCHEMA.md §8-1 — stat_snapshots/dna_scores/personality_assessments와
 * 달리 이 테이블만 없음). 그래도 감사 추적을 위해 이 모듈에도 버전
 * 상수를 둔다.
 */

import { roundAndClamp } from './numeric'

/** 이 유틸 묶음의 버전. daily_temperature 테이블 자체에는 대응 컬럼이 없다(위 설명 참고). */
export const TEMPERATURE_ENGINE_VERSION = '1.0.0'

/** 미연결 커플의 고정 기본 온도 (Part 9-2, SCHEMA.md 컬럼 기본값과 동일). */
export const DISCONNECTED_TEMPERATURE = 36.5

export const TEMPERATURE_MIN = 0
export const TEMPERATURE_MAX = 100
/** DB `numeric(4,1)`과 동일한 소수 자릿수. */
export const TEMPERATURE_DECIMALS = 1

/** 미연결 커플에게 표시할 고정 온도. 인자 없음 — 항상 같은 값. */
export function resolveDisconnectedTemperature(): number {
  return DISCONNECTED_TEMPERATURE
}

/**
 * 이미 계산된 원점수를 DB 저장 규격(0~100, 소수 1자리)으로 정규화한다.
 * 원점수를 만드는 결합 공식 자체는 위 설명대로 문서에 없어 이 파일에
 * 없다 — 이 함수는 "값을 만드는" 함수가 아니라 "값을 규격에 맞추는"
 * 함수다. 반올림은 이 함수 반환 직전 단 한 번만 적용한다.
 */
export function clampTemperature(rawScore: number): number {
  return roundAndClamp(
    rawScore,
    TEMPERATURE_DECIMALS,
    TEMPERATURE_MIN,
    TEMPERATURE_MAX,
  )
}
