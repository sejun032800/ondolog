/**
 * `norm-synthetic-v2` DEF 데이터 검증 — 요약 필드만 틀렸나, 원자료가 틀렸나.
 *
 * 근거: docs/ONDOLOG_MASTER.md
 *   - Part 17-3 "애착 축 수치화" — DEF 애착 항 v2→v3 변경, 회피축 잔차 이력,
 *     "남은 물음은 `v2`의 `def.mean` 요약 필드만 틀렸는지, `def.sorted`
 *      데이터 자체가 틀렸는지다."
 *   - Part 10-2 (Q3 → 애착 불안축, Q5 → 애착 회피축, computeAttachment)
 *   - Part 10-8-1 / 10-8-3 (전수 열거 규격: Q1~Q5 3⁵ × MBTI 16 = 3,888 프로파일,
 *     규준집단 파일 규격)
 *
 * ── 무엇을 가르는 진단인가 ────────────────────────────────────────
 * `norm-synthetic-v2.json`의 DEF 평균이 이론 역산값과 `0.194444` 어긋난다는
 * 것이 직전 진단에서 확인됐다. 이 스크립트는 그 어긋남이
 *   (①) 파일의 `stats.def.mean` **요약 필드**에 있는지 — `stats.def.sorted`
 *       배열의 실제 산술평균과 저장된 `mean`이 다른지 —
 *   (②③) `stats.def.sorted` **원자료**에 있는지 — 현재(=v3) 코드에서
 *       `v2` 시절 DEF를 프로파일별로 역산해 정렬 배열과 원소별로 비교 —
 * 를 가른다. **수치만 산출한다. 원인·정오·재산출 필요 여부를 판단하지 않는다.**
 *
 * ── 이 스크립트는 아무것도 바꾸지 않는다 ─────────────────────────
 * `src/` 아래 어떤 파일도 만들거나 고치지 않는다. 규준집단 파일
 * (v1/v2/v3)도 건드리지 않는다. 기존 진단 스크립트 3개
 * (attachment-diagnostic / avoidance-residual-diagnostic /
 *  def-term-residual-diagnostic)도 수정하지 않는다. 하는 일은
 *   (1) `v2` 파일을 읽기 전용으로 열어 `stats.def.sorted`·`stats.def.mean`을
 *       그대로 옮기고,
 *   (2) 현재 순수 함수(`computeSixStats`·`inferLoveType`)를 호출해 `v2` 시절
 *       DEF를 프로파일별로 역산하고,
 *   (3) 두 배열을 원소별로 대조해 stdout에 출력하는 것뿐이다.
 *
 * ── 재구현하지 않는다 ───────────────────────────────────────────
 * DEF 계산은 `src/engine/leagueStats.ts`의 `computeSixStats`를 그대로
 * import해 호출한다. 축 값(attachAnxiety·attachAvoidance)은
 * `src/engine/loveTypeInference.ts`의 `inferLoveType`에서 얻는다 —
 * enumerate.ts / 기존 진단 스크립트와 완전히 동일한 호출 경로.
 * DEF 식이나 애착 항 식을 스크립트에 다시 적지 않는다.
 *
 * ── 회피축 보정량을 하드코딩하지 않는다 ─────────────────────────
 * `v2` 시절 DEF 애착 항은 `100 − (불안축 + 회피축)/2`, 현재(v3)는
 * `75 − 불안축/2`. 두 항의 차는 `25 − 회피축/2`이고 DEF에서 가중치 0.3이
 * 곱해지므로:
 *
 *     v2DEF_i = v3DEF_i + 0.3 × (25 − V_i / 2)
 *
 * `V_i`(= `inferLoveType(...).attachAvoidance`)는 {20, 50, 85} 세 값만
 * 갖지만, 그에 대응하는 보정량(4.5 / 0 / −5.25)을 미리 적어 넣지 않는다.
 * 위 식과 프로파일마다 실제로 얻은 `V_i`만으로 계산한다.
 * (이 역산은 `v2` 시절 코드의 애착 항이 `100 − (A + V)/2`였다는 것을
 *  전제한다. 그 전제는 위임 전에 확인됐다.)
 *
 * ── 파일 값은 그대로 읽는다 ──────────────────────────────────────
 * `stats.def.sorted`·`stats.def.mean`을 파일에서 읽은 그대로 쓴다.
 * 반올림하지 않고, `sorted` 배열로 `mean`을 대체하지 않는다(오히려 둘을
 * 비교하는 것이 ①의 목적이다).
 *
 * ── 정렬 방식 ───────────────────────────────────────────────────
 * 역산한 3,888개는 `v2` 파일의 `stats.def.sorted`가 만들어진 것과 동일하게
 * (`scripts/norm/distribution.ts :: toSortedRawScores`, RAW_SCORE_DECIMALS=10)
 * `src/engine/numeric.ts`의 `roundTo(v, 10)` 적용 후 오름차순(`a-b`) 정렬한다.
 * (역산값은 전부 0.25의 정수배라 10자리 반올림은 무영향이지만, "같은 방식"을
 *  명시적으로 지키기 위해 동일 절차를 그대로 따른다.)
 *
 * ── 결정론 ───────────────────────────────────────────────────────
 * Math.random / Date.now() / new Date() / process.env 미사용. 열거 순서
 * (MBTI_TYPES → Q1 → Q2 → Q3 → Q4 → Q5, 각 A,B,C)가 enumerate.ts와
 * 같으므로 몇 번을 돌려도 같은 수치가 나온다. 규준 파일 경로는 __dirname
 * 기준으로 해석한다(cwd 비의존).
 *
 * ── 재사용 목적 ─────────────────────────────────────────────────
 * 일회성 조사가 아니다. `v2` 파일이나 DEF 애착 항이 정정되면 같은
 * 스크립트로 전후를 비교하기 위해 재실행 가능한 형태로 남긴다.
 *
 * ── 실행 방법 (Windows / PowerShell) ────────────────────────────
 * 프로젝트에 TS 러너가 없고 Node 네이티브 TS 실행은 확장자 없는 상대
 * import를 해석하지 못하므로, `def-term-residual-diagnostic.ts`와 동일하게
 * 1회용 컴파일 후 실행한다 (의존성·설정 파일 변경 없음):
 *
 *   npx tsc scripts/norm/v2-def-storage-diagnostic.ts --ignoreConfig `
 *     --ignoreDeprecations 6.0 --outDir .norm-build `
 *     --module commonjs --moduleResolution node --target es2022 `
 *     --esModuleInterop --skipLibCheck --resolveJsonModule --types node
 *   node .norm-build/scripts/norm/v2-def-storage-diagnostic.js
 *   Remove-Item -Recurse -Force .norm-build
 *
 * `--ignoreConfig` / `--ignoreDeprecations 6.0`은 tsc 6.x에서 필요하다
 * (파일 지정 시 tsconfig.json 로드 거부 TS5112, moduleResolution=node10
 * 폐기 예고 TS5107 회피). `.norm-build/`는 임시 산출물이다(커밋 금지).
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { computeSixStats } from '../../src/engine/leagueStats'
import { inferLoveType } from '../../src/engine/loveTypeInference'
import { roundTo } from '../../src/engine/numeric'
import { MBTI_TYPES, type QuizChoice } from '../../src/constants/quizTypes'

/** Q1~Q5가 취하는 값. `enumerate.ts` / 기존 진단 스크립트와 동일한 열거 순서. */
const CHOICES: readonly QuizChoice[] = ['A', 'B', 'C'] as const

/** `v2` 파일의 `stats.def.sorted`가 만들어진 반올림 자리수 (distribution.ts RAW_SCORE_DECIMALS). */
const RAW_SCORE_DECIMALS = 10

/** 요약 통계 반올림 자리수 (distribution.ts SUMMARY_DECIMALS) — 참고 표시용. */
const SUMMARY_DECIMALS = 6

interface ReconObservation {
  /** 현재(=v3) 코드 computeSixStats(...).def — 그대로 호출. */
  readonly v3Def: number
  /** inferLoveType(...).attachAvoidance = V_i — 그대로 획득. */
  readonly avoidance: number
  /** v2DEF_i = v3Def + 0.3 × (25 − V_i/2). 식과 V_i만으로 계산 — 보정량 하드코딩 없음. */
  readonly v2DefReconstructed: number
}

/**
 * 3,888개 프로파일을 `enumerate.ts`의 `enumerateProfiles()`와 동일한
 * 순서·동일한 함수 호출로 열거하되, 이 진단에 필요한 세 값만 담는다.
 * 채점·스탯 재구현 없음 — 전부 위임한다.
 */
function enumerateReconstructions(): ReconObservation[] {
  const out: ReconObservation[] = []

  for (const mbti of MBTI_TYPES) {
    for (const q1 of CHOICES) {
      for (const q2 of CHOICES) {
        for (const q3 of CHOICES) {
          for (const q4 of CHOICES) {
            for (const q5 of CHOICES) {
              const inference = inferLoveType({ mbti, q1, q2, q3, q4, q5 })

              // v3DEF_i — 현재 코드의 DEF. computeSixStats를 그대로 호출.
              const v3Def = computeSixStats({
                big5: inference.big5,
                sternberg: inference.sternberg,
                q1,
                q2,
                attachAnxiety: inference.attachAnxiety,
                attachAvoidance: inference.attachAvoidance,
              }).def

              // V_i — 회피축 원점수. 채점 함수 출력에서 직접 얻는다.
              const avoidance = inference.attachAvoidance

              // v2 시절 DEF 역산. 식은 위임 프롬프트가 준 그대로, V_i만 대입.
              const v2DefReconstructed = v3Def + 0.3 * (25 - avoidance / 2)

              out.push({ v3Def, avoidance, v2DefReconstructed })
            }
          }
        }
      }
    }
  }

  return out
}

/** 정확 합계·표본 수·평균을 함께 담는다. 이 함수는 반올림하지 않는다. */
function meanBundle(values: readonly number[]): {
  exactSum: number
  sampleSize: number
  mean: number
  meanToFixed15: string
  meanToPrecision18: string
} {
  const n = values.length
  let sum = 0
  for (const v of values) sum += v
  const mean = n === 0 ? 0 : sum / n
  return {
    exactSum: sum,
    sampleSize: n,
    mean,
    meanToFixed15: mean.toFixed(15),
    meanToPrecision18: mean.toPrecision(18),
  }
}

/** 값 → 빈도 맵을 값 오름차순 엔트리 배열로. 값은 변형 없이 그대로 키가 된다. */
function frequencyByValueAscending(
  values: readonly number[],
): Array<{ value: number; count: number }> {
  const counts = new Map<number, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value - b.value)
}

/**
 * `v2` 파일에서 `stats.def.sorted`·`stats.def.mean`을 **그대로** 읽는다.
 * 경로는 __dirname(.norm-build/scripts/norm) 기준 → 프로젝트 루트는 ../../..
 */
function readV2DefData(): {
  file: string
  version: unknown
  engineVersions: unknown
  sampleSize: unknown
  storedSorted: number[]
  storedMean: number
  storedStdDev: unknown
} {
  const path = join(
    __dirname,
    '../../../src/engine/data',
    'norm-synthetic-v2.json',
  )
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
    version?: unknown
    engineVersions?: unknown
    sampleSize?: unknown
    stats: { def: { sorted: number[]; mean: number; stdDev?: unknown } }
  }
  return {
    file: 'src/engine/data/norm-synthetic-v2.json',
    version: parsed.version,
    engineVersions: parsed.engineVersions,
    sampleSize: parsed.sampleSize,
    // 파일에 있는 값 그대로 — 재계산·반올림 없음.
    storedSorted: parsed.stats.def.sorted,
    storedMean: parsed.stats.def.mean,
    storedStdDev: parsed.stats.def.stdDev,
  }
}

function main(): void {
  const v2 = readV2DefData()

  // ── ① v2 파일 내부 정합성 ─────────────────────────────────────
  // stats.def.sorted 3,888개를 직접 읽어 산술평균 → stats.def.mean과 비교.
  const computedFromSorted = meanBundle(v2.storedSorted)
  const internalDiff = computedFromSorted.mean - v2.storedMean

  // ── ② v2 시절 DEF의 프로파일별 역산 ──────────────────────────
  const recon = enumerateReconstructions()
  const reconSampleSize = recon.length

  // v2 파일의 stats.def.sorted와 같은 방식으로 정렬:
  // roundTo(v, RAW_SCORE_DECIMALS) 적용 후 오름차순(a-b). (toSortedRawScores 절차)
  const reconstructedSorted = recon
    .map((o) => roundTo(o.v2DefReconstructed, RAW_SCORE_DECIMALS))
    .slice()
    .sort((a, b) => a - b)

  // ── ③ 비교 결과 (불린 아님 — 넷 + 원소별 차 분포) ────────────
  const compareLen = Math.min(reconstructedSorted.length, v2.storedSorted.length)
  const perElementDiffs: number[] = []
  let maxAbsDiff = 0
  let mismatchCount = 0
  let diffSum = 0
  for (let i = 0; i < compareLen; i++) {
    const d = reconstructedSorted[i] - v2.storedSorted[i]
    perElementDiffs.push(d)
    const ad = Math.abs(d)
    if (ad > maxAbsDiff) maxAbsDiff = ad
    if (ad > 1e-9) mismatchCount++
    diffSum += d
  }
  const meanDiff = compareLen === 0 ? 0 : diffSum / compareLen
  const reconstructedMean = meanBundle(reconstructedSorted)

  // 원소별 차의 고유값·빈도 — meanDiff가 일정한 이동인지 원소별로 다른
  // 오류인지 구분할 근거. (판단은 하지 않는다 — 분포만 낸다.)
  const diffFrequencies = frequencyByValueAscending(perElementDiffs)
  const diffFrequenciesRounded12 = diffFrequencies.map((e) => ({
    value: roundTo(e.value, 12),
    count: e.count,
  }))

  // v3Def·V_i 자체의 분포 (참고 — 역산 입력이 몇 종인지).
  const v3DefFreq = frequencyByValueAscending(recon.map((o) => o.v3Def))
  const avoidanceFreq = frequencyByValueAscending(recon.map((o) => o.avoidance))
  const correctionFreq = frequencyByValueAscending(
    recon.map((o) => roundTo(0.3 * (25 - o.avoidance / 2), 12)),
  )

  const report = {
    meta: {
      script: 'scripts/norm/v2-def-storage-diagnostic.ts',
      basis:
        'computedFromSorted = mean(v2.stats.def.sorted) — 파일 배열 직접 산술평균. ' +
        'storedMean = v2.stats.def.mean — 파일 필드 그대로. ' +
        'v3Def = computeSixStats(...).def (현재=v3 코드). ' +
        'V_i = inferLoveType({mbti,q1..q5}).attachAvoidance. ' +
        'v2DefReconstructed = v3Def + 0.3 * (25 - V_i/2) — 식은 위임 그대로, ' +
        '보정량 하드코딩 없음. ' +
        '두 함수 모두 src/engine 구현을 그대로 import해 호출 — 식 재작성 없음. ' +
        'enumerate.ts와 동일 열거 순서. ' +
        '역산값 정렬은 v2 파일 stats.def.sorted와 동일 절차(roundTo(v,10) 후 오름차순).',
      reusedFunctions: {
        sixStats:
          'src/engine/leagueStats.ts :: computeSixStats(input: SixStatsInput): SixStats  (.def — 현재=v3 코드)',
        axisValues:
          'src/engine/loveTypeInference.ts :: inferLoveType(input: LoveTypeInput): LoveTypeInferenceResult  (.attachAvoidance = V_i, .big5, .sternberg, .attachAnxiety)',
        roundTo:
          'src/engine/numeric.ts :: roundTo(value: number, decimals: number): number  (v2 sorted 배열과 동일 절차용, RAW_SCORE_DECIMALS=10)',
      },
      enumerationOrder: 'MBTI_TYPES → Q1 → Q2 → Q3 → Q4 → Q5 (각 A,B,C)',
      rawScoreDecimals: RAW_SCORE_DECIMALS,
      summaryDecimals: SUMMARY_DECIMALS,
      mismatchThreshold: 1e-9,
      v2FileContext: {
        file: v2.file,
        version: v2.version,
        engineVersions: v2.engineVersions,
        sampleSize: v2.sampleSize,
        storedDefMean: v2.storedMean,
        storedDefStdDev: v2.storedStdDev,
        storedSortedLength: v2.storedSorted.length,
        storedSortedLengthIs3888: v2.storedSorted.length === 3888,
        storedSortedFirst5: v2.storedSorted.slice(0, 5),
        storedSortedLast5: v2.storedSorted.slice(-5),
      },
    },

    // ── ① v2 파일 내부 정합성 ────────────────────────────────────
    section1_v2InternalConsistency: {
      description:
        'computedMean = mean(v2.stats.def.sorted); storedMean = v2.stats.def.mean; 차 = computedMean − storedMean',
      arrayLength: v2.storedSorted.length,
      arrayLengthIs3888: v2.storedSorted.length === 3888,
      computedMean: {
        exactSum: computedFromSorted.exactSum,
        sampleSize: computedFromSorted.sampleSize,
        value: computedFromSorted.mean,
        toFixed15: computedFromSorted.meanToFixed15,
        toPrecision18: computedFromSorted.meanToPrecision18,
      },
      storedMean: {
        value: v2.storedMean,
        toFixed15: v2.storedMean.toFixed(15),
        toPrecision18: v2.storedMean.toPrecision(18),
      },
      computedMinusStored: {
        value: internalDiff,
        toFixed15: internalDiff.toFixed(15),
        toPrecision18: internalDiff.toPrecision(18),
      },
    },

    // ── ② v2 시절 DEF 프로파일별 역산 ───────────────────────────
    section2_v2EraReconstruction: {
      description:
        'v2DEF_i = v3DEF_i + 0.3 × (25 − V_i/2). v3DEF_i = computeSixStats(...).def, V_i = inferLoveType(...).attachAvoidance. 프로파일마다 V_i 실측.',
      sampleSize: reconSampleSize,
      sampleSizeIs3888: reconSampleSize === 3888,
      reconstructedSortedLength: reconstructedSorted.length,
      reconstructedSortedFirst5: reconstructedSorted.slice(0, 5),
      reconstructedSortedLast5: reconstructedSorted.slice(-5),
      inputDistributions: {
        v3DefDistinctValues: v3DefFreq.length,
        v3DefFrequencies: v3DefFreq,
        avoidanceFrequencies: avoidanceFreq,
        correctionTermFrequencies: correctionFreq,
        note:
          'correctionTerm = 0.3 × (25 − V_i/2), V_i에서 계산 — 하드코딩 아님. ' +
          'V_i 3종 → 보정량 3종.',
      },
    },

    // ── ③ 비교 결과 ────────────────────────────────────────────
    section3_comparison: {
      description:
        '역산 정렬 배열 vs v2 파일 stats.def.sorted, 원소별(index별) 비교. 불린 하나가 아님.',
      comparedElements: compareLen,
      maxAbsDiff: {
        value: maxAbsDiff,
        toFixed15: maxAbsDiff.toFixed(15),
        toPrecision18: maxAbsDiff.toPrecision(18),
      },
      mismatchCount,
      mismatchThreshold: 1e-9,
      meanDiff: {
        description: '(복원값 − 저장값)의 평균, 원소별 차 전체의 산술평균',
        value: meanDiff,
        toFixed15: meanDiff.toFixed(15),
        toPrecision18: meanDiff.toPrecision(18),
      },
      reconstructedMean: {
        description: '복원값 3,888개의 평균',
        exactSum: reconstructedMean.exactSum,
        sampleSize: reconstructedMean.sampleSize,
        value: reconstructedMean.mean,
        toFixed15: reconstructedMean.meanToFixed15,
        toPrecision18: reconstructedMean.meanToPrecision18,
      },
      perElementDiffDistribution: {
        description:
          '원소별 차(복원 − 저장)의 고유값과 빈도. 단일 값이면 일정한 이동, ' +
          '여러 값으로 흩어지면 원소별로 다른 오류. (구분만 제시 — 판단 안 함.)',
        distinctValueCount: diffFrequencies.length,
        frequenciesRaw: diffFrequencies,
        frequenciesRounded12: diffFrequenciesRounded12,
      },
    },
  }

  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
}

main()
