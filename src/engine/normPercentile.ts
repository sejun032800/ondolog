/**
 * 규준집단 백분위 조회 — 순수 함수. 규준 데이터를 **인자로 주입**받는다.
 *
 * 근거: docs/ONDOLOG_MASTER.md
 *   - Part 10-8-1 (전수 열거 합성 규준)
 *   - Part 10-8-2 (OVR 산출 순서: ① 6스탯 원점수 → ② 6개의 산술평균으로
 *     합성값 → ③ 규준집단 백분위 변환 → ④ 매핑 테이블로 최종 OVR).
 *     **백분위를 재는 대상은 이 합성값 분포다.**
 *   - Part 10-8-3 (규준 데이터는 인자로 주입한다. 엔진 함수가 특정 버전
 *     파일을 정적 import하지 않는다 — 버전 교체가 코드 변경이 되면
 *     과거 버전으로 재계산할 수단이 사라진다).
 *
 * 결정론 계약 (CLAUDE.md 절대 규칙 2): 이 파일 전체가 순수 함수다.
 *   Math.random / Date.now() / new Date() / process.env를 쓰지 않고,
 *   인자로 받은 값만 사용한다. 동일 입력 → 동일 출력.
 *
 * ⚠️ 이 모듈은 `norm-synthetic-v1.json`(또는 다른 어떤 버전 파일)도
 *   정적 import하지 않는다. 파일을 고르는 것은 호출부(배치 잡)의
 *   책임이고, 엔진은 받은 분포로 계산만 한다 — `app_config` 계수를
 *   호출부가 주입하는 것과 같은 구조(Part 10-7-5).
 */

import { percentileRank } from './leagueStats'

/** 6각 스탯 키. leagueStats.SixStats와 동일 순서. */
export type SixStatKey = 'pus' | 'emp' | 'att' | 'def' | 'tac' | 'rea'

/** 6각 스탯 키의 정규 순서 — 규준 파일과 보고서가 공유하는 유일한 순서. */
export const SIX_STAT_KEYS: readonly SixStatKey[] = [
  'pus',
  'emp',
  'att',
  'def',
  'tac',
  'rea',
] as const

/**
 * 규준 파일에 담기는 분위수 키 — 최소(p0)부터 최대(p100)까지.
 * nearest-rank 방식으로 산출된다(NORM_QUANTILE_KEYS와 1:1).
 */
export const NORM_QUANTILE_KEYS: readonly string[] = [
  'p0',
  'p1',
  'p5',
  'p10',
  'p25',
  'p50',
  'p75',
  'p90',
  'p95',
  'p99',
  'p100',
] as const

/** 한 분포(합성값 또는 스탯 1종)의 전량 + 요약. */
export interface NormDistribution {
  /** 오름차순 정렬된 원점수 전체 (요약 통계가 아니라 전량). */
  readonly sorted: readonly number[]
  /** 산술평균 (베이지안 수축의 사전평균으로 쓰인다 — Part 10-8-1). */
  readonly mean: number
  /** 모표준편차 (N으로 나눔; 표본이 아니라 전수다). 수축 강도·분산 지배 점검의 입력. */
  readonly stdDev: number
  /** nearest-rank 분위수. 키는 NORM_QUANTILE_KEYS. */
  readonly quantiles: Readonly<Record<string, number>>
}

/** 에니어그램 코어 1종(1~9)의 합성값 요약 — 규준집단 자체의 편향을 설명한다(Part 10-8-2 검증 조건). */
export interface NormEnneagramCoreSummary {
  readonly core: number
  readonly mean: number
  readonly stdDev: number
  readonly min: number
  readonly max: number
  /** 표본 수 (이 코어에 배정된 프로파일 개수). */
  readonly count: number
}

/** 애착축 한 수준(low/mid/high)의 합성값 요약 — 코어 9종 요약과 같은 형식. */
export interface NormAttachmentAxisLevelSummary {
  readonly level: 'low' | 'mid' | 'high'
  readonly mean: number
  readonly stdDev: number
  readonly min: number
  readonly max: number
  /** 표본 수 (이 축 수준에 배정된 프로파일 개수). */
  readonly count: number
}

/**
 * 애착 두 축(회피·불안)의 3수준별 합성값 요약.
 *
 * **`synthetic-v3`부터 포함된다** (Part 17-3 DEF 애착 항이 회피축을
 * 빼도록 갱신되면서, 규준 파일이 축별 분포를 스스로 문서화하도록 한 것).
 * v1·v2 파일에는 이 필드가 없으므로 옵셔널이다 — 과거 발행물 재현 시
 * 그 버전 파일을 그대로 주입해야 하기 때문에 필수로 두지 않는다.
 */
export interface NormAttachmentAxisSummary {
  /** 회피축(Q5) 3수준: low → mid → high 순. */
  readonly avoidance: readonly NormAttachmentAxisLevelSummary[]
  /** 불안축(Q3) 3수준: low → mid → high 순. */
  readonly anxiety: readonly NormAttachmentAxisLevelSummary[]
}

/**
 * 규준집단 데이터 파일(`norm-{version}.json`)의 스키마.
 * 생성기(scripts/norm)와 이 조회 함수가 공유하는 유일한 형 정의다.
 */
export interface NormData {
  /** `{출처}-v{정수}` — 초기 합성 규준은 `synthetic-v1` (Part 10-8-3). */
  readonly version: string
  /**
   * 생성 시점의 엔진 코드 버전 **맵**. 문자열 하나가 아니다 —
   * 규준집단은 채점(loveTypeInference)과 6각 스탯 산출(leagueStats)을
   * 연달아 거쳐 나오므로, 열거가 import한 모든 엔진 모듈의 버전을
   * 각각 기록한다(Part 10-8-3).
   */
  readonly engineVersions: Readonly<Record<string, string>>
  /** 열거한 프로파일 수 (= 3,888). */
  readonly sampleSize: number
  /** ① 합성값(6각 스탯 산술평균) 분포 — 백분위를 재는 주 데이터. */
  readonly composite: NormDistribution
  /** ② 스탯별 분포 — 기각된 (b) 방식의 대조 데이터 + 수축 사전평균/강도의 입력. */
  readonly stats: Readonly<Record<SixStatKey, NormDistribution>>
  /** ③ 에니어그램 코어 9종별 합성값 요약. */
  readonly enneagramCoreSummary: readonly NormEnneagramCoreSummary[]
  /**
   * ④ 애착 두 축(회피·불안) 3수준별 합성값 요약. **`synthetic-v3`부터 포함.**
   * v1·v2에는 없다(옵셔널). 에니어그램 코어 9종 요약과 같은 위치·형식.
   */
  readonly attachmentAxisSummary?: NormAttachmentAxisSummary
}

/**
 * 합성값(6각 스탯 산술평균) 원점수를 규준 분포에 대고 백분위로 변환한다.
 * Part 10-8-2 처리 순서 ③. 반환값은 0~100, 소수 2자리(`ovr_percentile
 * numeric(5,2)`) — 반올림은 percentileRank 내부에서 단 한 번.
 *
 * `compositeRawScore`는 leagueStats.computeOvrRawScore(stats)의 출력이며,
 * `norm`은 호출부가 골라 주입한 규준 데이터다. 이 함수는 어떤 파일도
 * 스스로 읽지 않는다.
 */
export function lookupCompositePercentile(
  compositeRawScore: number,
  norm: NormData,
): number {
  return percentileRank(compositeRawScore, norm.composite.sorted)
}

/**
 * 스탯 1종의 원점수를 그 스탯의 규준 분포에 대고 백분위로 변환한다.
 *
 * ⚠️ 이것은 **기각된** (b) 방식(스탯별 백분위 6개 → 평균)의 대조용이다
 * (Part 10-8-2). OVR 파이프라인은 이 함수를 쓰지 않는다 — OVR은
 * `lookupCompositePercentile` 한 번만 거친다. 스탯별 분포가 규준
 * 파일에 남아 있으므로(② 데이터) 대조가 필요할 때 쓸 수 있게 열어둔다.
 */
export function lookupStatPercentile(
  stat: SixStatKey,
  statRawScore: number,
  norm: NormData,
): number {
  return percentileRank(statRawScore, norm.stats[stat].sorted)
}
