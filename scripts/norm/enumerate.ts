/**
 * 응답 공간 전수 열거 — 규준집단 합성 데이터(`NORM_VERSION`, 현재
 * `synthetic-v2`) 생성 로직.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 10-8-1 / 10-8-2 / 10-8-3.
 *
 * ```
 * Q1~Q5 각 3지선다 = 3⁵ = 243  × MBTI 16종 = 3,888개 프로파일
 * ```
 *
 * ── 가장 중요한 제약 ──────────────────────────────────────────────
 * 채점·스탯 로직을 **재구현하지 않는다.** Phase 2에서 만들어진
 * `src/engine/loveTypeInference.ts`, `src/engine/leagueStats.ts`의
 * 기존 함수를 그대로 import해서 열거한다. 재구현하면 규준집단이
 * 실제 유저 채점과 다른 분포가 되고, 양쪽 다 결정론적이라 테스트는
 * 통과하는데 백분위 값만 조용히 틀린다.
 *
 * ── 원점수 기준 ──────────────────────────────────────────────────
 * 수축(shrinkage)을 적용하지 않은 **원점수**로 분포를 만든다
 * (Part 10-8-1 "백분위 기준 분포는 수축 전이다"). `leagueStats.shrinkage`는
 * `UNRESOLVED` 상태 그대로 두고 건드리지 않는다.
 *
 * ── 파일 I/O 없음 ───────────────────────────────────────────────
 * 이 모듈은 파일을 읽거나 쓰지 않는다. 순수 함수 `enumerateNormData()`가
 * 완성된 규준 데이터 객체를 반환하고, 파일 쓰기는 `scripts/generate-norm.ts`가
 * 담당한다. 드리프트 감지 테스트가 이 함수를 재호출해 커밋된 파일과
 * 대조한다.
 *
 * 결정론: Math.random / Date.now() / new Date() / process.env 미사용.
 * 각 응답 조합은 균등 가중(Part 10-8-1). 반복 실행 시 바이트 단위로
 * 동일한 객체를 반환한다.
 */

import {
  LOVE_TYPE_ENGINE_VERSION,
  inferLoveType,
} from '../../src/engine/loveTypeInference'
import {
  LEAGUE_STATS_ENGINE_VERSION,
  computeOvrRawScore,
  computeSixStats,
} from '../../src/engine/leagueStats'
import { roundTo } from '../../src/engine/numeric'
import { MBTI_TYPES, type QuizChoice } from '../../src/constants/quizTypes'
import {
  SIX_STAT_KEYS,
  type NormData,
  type NormEnneagramCoreSummary,
  type SixStatKey,
} from '../../src/engine/normPercentile'
import {
  RAW_SCORE_DECIMALS,
  SUMMARY_DECIMALS,
  summarizeDistribution,
  toSortedRawScores,
} from './distribution'

/**
 * 규준 버전 문자열 (Part 10-8-3, 절대 규칙 4 — ASCII, 날짜 없음).
 *
 * v1 → v2 (2026-09-02): `leagueStats`의 EMP 공식 갱신(순응형 보너스
 * 신설, Part 17-3)으로 채점 로직이 바뀌었으므로 규준집단을 재열거했다.
 * `norm-synthetic-v1.json`은 과거 발행물 재현을 위해 그대로 남아있고
 * 이 상수만 v2를 가리키도록 올린다 — 기존 파일은 수정하지 않는다.
 */
export const NORM_VERSION = 'synthetic-v2'

/** Q1~Q5가 취하는 값. 열거 순서를 고정한다. */
const CHOICES: readonly QuizChoice[] = ['A', 'B', 'C'] as const

/** 한 프로파일의 열거 결과 (내부용). */
interface EnumeratedProfile {
  readonly enneagramCore: number
  readonly stats: Readonly<Record<SixStatKey, number>>
  /** 6각 스탯의 산술평균 = 합성값(OVR 원점수). leagueStats.computeOvrRawScore 그대로. */
  readonly composite: number
}

/**
 * 3,888개 프로파일을 고정된 순서로 열거한다.
 * 순서: MBTI_TYPES 배열 순 → Q1 → Q2 → Q3 → Q4 → Q5 (각각 A,B,C).
 */
export function enumerateProfiles(): EnumeratedProfile[] {
  const profiles: EnumeratedProfile[] = []

  for (const mbti of MBTI_TYPES) {
    for (const q1 of CHOICES) {
      for (const q2 of CHOICES) {
        for (const q3 of CHOICES) {
          for (const q4 of CHOICES) {
            for (const q5 of CHOICES) {
              const inference = inferLoveType({ mbti, q1, q2, q3, q4, q5 })

              // 기존 스탯 함수를 그대로 사용 — 재구현 없음.
              const stats = computeSixStats({
                big5: inference.big5,
                sternberg: inference.sternberg,
                q1,
                q2,
                attachAnxiety: inference.attachAnxiety,
                attachAvoidance: inference.attachAvoidance,
              })

              // 합성값 = 6각 스탯 산술평균 (Part 10-8-2 ②). 기존 함수 그대로.
              const composite = computeOvrRawScore(stats)

              profiles.push({
                enneagramCore: inference.enneagramCore,
                stats: {
                  pus: stats.pus,
                  emp: stats.emp,
                  att: stats.att,
                  def: stats.def,
                  tac: stats.tac,
                  rea: stats.rea,
                },
                composite,
              })
            }
          }
        }
      }
    }
  }

  return profiles
}

/** 에니어그램 코어 1~9별 합성값 요약 (Part 10-8-2 검증 조건). */
function summarizeEnneagramCores(
  profiles: readonly EnumeratedProfile[],
): NormEnneagramCoreSummary[] {
  const summaries: NormEnneagramCoreSummary[] = []

  for (let core = 1; core <= 9; core++) {
    const values = profiles
      .filter((p) => p.enneagramCore === core)
      .map((p) => roundTo(p.composite, RAW_SCORE_DECIMALS))
      .slice()
      .sort((a, b) => a - b)

    const n = values.length
    let sum = 0
    for (const v of values) sum += v
    const meanExact = n === 0 ? 0 : sum / n

    let sqDevSum = 0
    for (const v of values) {
      const d = v - meanExact
      sqDevSum += d * d
    }
    const stdDevExact = n === 0 ? 0 : Math.sqrt(sqDevSum / n)

    summaries.push({
      core,
      mean: roundTo(meanExact, SUMMARY_DECIMALS),
      stdDev: roundTo(stdDevExact, SUMMARY_DECIMALS),
      min: n === 0 ? 0 : values[0],
      max: n === 0 ? 0 : values[n - 1],
      count: n,
    })
  }

  return summaries
}

/**
 * 전수 열거로 규준집단 데이터를 조립한다. 파일 I/O 없음 — 순수 함수.
 * 반복 호출 시 동일한 객체(deep-equal + 직렬화 바이트 동일)를 반환한다.
 */
export function enumerateNormData(): NormData {
  const profiles = enumerateProfiles()

  // ① 합성값 분포 (주 데이터) — 백분위를 재는 대상.
  const composite = summarizeDistribution(
    toSortedRawScores(
      profiles.map((p) => p.composite),
      RAW_SCORE_DECIMALS,
    ),
  )

  // ② 스탯별 분포 (PUS·EMP·ATT·DEF·TAC·REA) — ①과 동일 형식.
  const stats = {} as Record<SixStatKey, ReturnType<typeof summarizeDistribution>>
  for (const key of SIX_STAT_KEYS) {
    stats[key] = summarizeDistribution(
      toSortedRawScores(
        profiles.map((p) => p.stats[key]),
        RAW_SCORE_DECIMALS,
      ),
    )
  }

  // ③ 에니어그램 코어 9종별 합성값 요약.
  const enneagramCoreSummary = summarizeEnneagramCores(profiles)

  return {
    version: NORM_VERSION,
    // 값은 기존 상수를 그대로 읽어서 넣는다 — 문자열을 직접 타이핑하지 않는다.
    engineVersions: {
      loveTypeInference: LOVE_TYPE_ENGINE_VERSION,
      leagueStats: LEAGUE_STATS_ENGINE_VERSION,
    },
    sampleSize: profiles.length,
    composite,
    stats: {
      pus: stats.pus,
      emp: stats.emp,
      att: stats.att,
      def: stats.def,
      tac: stats.tac,
      rea: stats.rea,
    },
    enneagramCoreSummary,
  }
}
