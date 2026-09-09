/**
 * DEF 반올림 효과 검증 — v2·v3 공식의 반올림 전/후 평균 대조.
 *
 * 위임: `.claude/state/prompts/phase-7/14-engine-dev-def-rounding.md`
 *
 * 근거: docs/ONDOLOG_MASTER.md
 *   - Part 17-3 "애착 축 수치화" — DEF 애착 항 v2→v3 변경, 잔차 추적 이력
 *   - Part 10-8-1 (전수 열거 규격: Q1~Q5 3^5 × MBTI 16 = 3,888 프로파일)
 *
 * ── 무엇을 가르는 진단인가 ────────────────────────────────────────
 * 규준집단 파일의 DEF 평균 차가 애착 항의 평균 차 × 가중치와 어긋난다는
 * 것이 이전 진단(`def-term-residual-diagnostic.ts`)에서 확인됐다. 반올림은
 * 비선형이므로(원소별 반올림 후 합/평균이 반올림 전 합/평균의 반올림과
 * 같지 않을 수 있다), 원소별 차분이 일정해도 반올림 후 평균 차는 반올림
 * 전 평균 차와 다를 수 있다. 이 스크립트는 그 가설이 관측된 차이를
 * 설명하는지를 **수치로만** 확인한다. 원인·정오·수정 필요 여부는
 * 판단하지 않는다.
 *
 * ── 이 스크립트는 아무것도 바꾸지 않는다 ─────────────────────────
 * `src/` 아래 어떤 파일도 만들거나 고치지 않는다. 규준집단 파일
 * (v1/v2/v3)도 건드리지 않는다. 기존 진단 스크립트 4개
 * (attachment-diagnostic / avoidance-residual-diagnostic /
 *  def-term-residual-diagnostic / v2-def-storage-diagnostic)도 수정하지
 * 않는다. 하는 일은 (1) 기존 순수 함수를 호출해 프로파일별
 * defV2raw·defV3raw를 재구성하고, (2) 코드에서 확인한 반올림을 그
 * 재구성값에 적용하고, (3) v2/v3 규준집단 파일의 `stats.def.sorted`를
 * 읽기 전용으로 열어 그대로 대조해 stdout에 출력하는 것뿐이다.
 *
 * ── 반올림 지점 (코드에서 확인, 추측 없음) ───────────────────────
 * ① `src/engine/leagueStats.ts` :: `computeSixStats()` 내부
 *    `def: roundAndClamp(def, 0, 0, 100)` — **decimals=0(정수)**,
 *    clamp[0,100]. DEF가 `computeSixStats`를 벗어나기 **전에** 적용되는
 *    유일한 반올림이다. (`src/engine/numeric.ts` ::
 *    `roundAndClamp(value,decimals,min,max) = clamp(roundTo(value,decimals),min,max)`.)
 * ② `scripts/norm/distribution.ts` ::
 *    `toSortedRawScores(values, RAW_SCORE_DECIMALS)` — `enumerateNormData()`가
 *    `stats.def` 배열을 만들 때 각 원소에 다시 `roundTo(v, 10)`을
 *    적용한다(`RAW_SCORE_DECIMALS = 10`, distribution.ts에서 그대로
 *    import — 재정의 없음). ①에서 이미 정수가 된 값에는 10자리 반올림이
 *    수치를 바꾸지 않지만(무영향), DEF 값이 배열에 들어가기까지 실제로
 *    거치는 반올림 호출이므로 이 스크립트도 함께 적용해 재현한다.
 * → 저장된 `stats.def.sorted` 원소는 전부 정수다(파일 직접 확인,
 *   `v2` first5=[13,13,13,13,13], `v3` first5=[19,19,19,19,19]) — ①의
 *   decimals=0과 형태가 일치한다. **어긋남 없음 — 진행한다.**
 *
 * ── 재구현하지 않는다 ───────────────────────────────────────────
 * N·A·V·big5·sternberg는 `inferLoveType()`에서, termV2·termV3는
 * `leagueStats.ts`의 `computeAttachmentStability`·
 * `computeDefAnxietyStability`를 그대로 import해 호출한다.
 * `positiveBonus` 판정(`q2 === 'B'` → 100, else 0 — Part 17-3
 * "긍정형(2,7,9) → DEF")은 `leagueStats.ts`의 `groupBonus(q2 === 'B')`가
 * export되지 않아 **동일 조건을 이 스크립트에 그대로 복제했다** — DEF
 * 가중합 자체(0.4×(100−N)+0.3×positiveBonus+0.3×term)는 위임 프롬프트가
 * 준 식 그대로이고 재작성하지 않았다.
 *
 * ── 결정론 ───────────────────────────────────────────────────────
 * Math.random / Date.now() / new Date() / process.env 미사용. 열거 순서
 * (MBTI_TYPES → Q1 → Q2 → Q3 → Q4 → Q5, 각 A,B,C)가 enumerate.ts와 같다.
 * 규준 파일 경로는 __dirname 기준(cwd 비의존). 몇 번을 돌려도 같은
 * 수치가 나온다(동일 입력 100회 반복 시 동일 결과 — CLAUDE.md 결정론 계약).
 *
 * ── 재사용 목적 ─────────────────────────────────────────────────
 * 일회성 조사가 아니다. DEF 애착 항이나 규준집단 파일이 정정되면 같은
 * 스크립트로 전후를 비교하기 위해 재실행 가능한 형태로 남긴다.
 *
 * ── 실행 방법 (Windows / PowerShell) ────────────────────────────
 * 프로젝트에 TS 러너가 없고 Node 네이티브 TS 실행은 확장자 없는 상대
 * import를 해석하지 못하므로, 기존 진단 스크립트와 동일하게 1회용
 * 컴파일 후 실행한다 (의존성·설정 파일 변경 없음):
 *
 *   npx tsc scripts/norm/def-rounding-effect-diagnostic.ts --ignoreConfig `
 *     --ignoreDeprecations 6.0 --outDir .norm-build `
 *     --module commonjs --moduleResolution node --target es2022 `
 *     --esModuleInterop --skipLibCheck --resolveJsonModule --types node
 *   node .norm-build/scripts/norm/def-rounding-effect-diagnostic.js
 *   Remove-Item -Recurse -Force .norm-build
 *
 * `--ignoreConfig` / `--ignoreDeprecations 6.0`은 tsc 6.x에서 필요하다
 * (파일 지정 시 tsconfig.json 로드 거부 TS5112, moduleResolution=node10
 * 폐기 예고 TS5107 회피). `.norm-build/`는 임시 산출물이다(커밋 금지).
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  computeAttachmentStability,
  computeDefAnxietyStability,
  computeSixStats,
} from '../../src/engine/leagueStats'
import { inferLoveType } from '../../src/engine/loveTypeInference'
import { roundAndClamp, roundTo } from '../../src/engine/numeric'
import { MBTI_TYPES, type QuizChoice } from '../../src/constants/quizTypes'
import { RAW_SCORE_DECIMALS, SUMMARY_DECIMALS } from './distribution'

/** Q1~Q5가 취하는 값. `enumerate.ts` / 기존 진단 스크립트와 동일한 열거 순서. */
const CHOICES: readonly QuizChoice[] = ['A', 'B', 'C'] as const

/** 저장 반올림 ①의 자리수 — computeSixStats 내부 roundAndClamp(def, 0, 0, 100). */
const STORAGE_ROUND_DECIMALS = 0
const STORAGE_CLAMP_MIN = 0
const STORAGE_CLAMP_MAX = 100

interface ProfileObservation {
  readonly defV2raw: number
  readonly defV3raw: number
  /** 검산 대상 — 현재 코드의 실제 저장값(이미 반올림됨). */
  readonly defV3Stored: number
}

/**
 * 3,888개 프로파일을 `enumerate.ts`의 `enumerateProfiles()`와 동일한
 * 순서·동일한 함수 호출로 열거하되, 이 진단에 필요한 값만 담는다.
 * 채점·스탯 재구현 없음(positiveBonus 판정만 예외 — 위 헤더 설명 참고).
 */
function enumerateObservations(): ProfileObservation[] {
  const out: ProfileObservation[] = []

  for (const mbti of MBTI_TYPES) {
    for (const q1 of CHOICES) {
      for (const q2 of CHOICES) {
        for (const q3 of CHOICES) {
          for (const q4 of CHOICES) {
            for (const q5 of CHOICES) {
              const inference = inferLoveType({ mbti, q1, q2, q3, q4, q5 })

              const N = inference.big5.bigN
              const A = inference.attachAnxiety
              const V = inference.attachAvoidance

              // computeSixStats가 쓰는 것과 같은 판정 — groupBonus(q2 === 'B')가
              // export되지 않아 동일 조건을 그대로 복제(헤더 설명 참고).
              const positiveBonus = q2 === 'B' ? 100 : 0

              // 두 항 함수는 leagueStats.ts에서 그대로 import해 호출 — 재구현 없음.
              const termV2 = computeAttachmentStability(A, V)
              const termV3 = computeDefAnxietyStability(A)

              // 위임 프롬프트가 준 식 그대로(재작성 없음).
              const defV2raw = 0.4 * (100 - N) + 0.3 * positiveBonus + 0.3 * termV2
              const defV3raw = 0.4 * (100 - N) + 0.3 * positiveBonus + 0.3 * termV3

              // 검산 대상 — computeSixStats를 그대로 호출한 현재(v3) 저장값.
              const defV3Stored = computeSixStats({
                big5: inference.big5,
                sternberg: inference.sternberg,
                q1,
                q2,
                attachAnxiety: A,
                attachAvoidance: V,
              }).def

              out.push({ defV2raw, defV3raw, defV3Stored })
            }
          }
        }
      }
    }
  }

  return out
}

/** ①·②에서 쓰는 "저장과 동일한 반올림" — 위 헤더의 반올림 지점 ①②를 순서대로 적용. */
function applyStorageRounding(raw: number): number {
  // ① computeSixStats 내부 roundAndClamp(def, 0, 0, 100).
  const stage1 = roundAndClamp(
    raw,
    STORAGE_ROUND_DECIMALS,
    STORAGE_CLAMP_MIN,
    STORAGE_CLAMP_MAX,
  )
  // ② distribution.ts toSortedRawScores의 roundTo(v, RAW_SCORE_DECIMALS) —
  // stage1이 이미 정수라 수치상 무영향이지만, 실제 저장 경로를 그대로 재현한다.
  const stage2 = roundTo(stage1, RAW_SCORE_DECIMALS)
  return stage2
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
 * `norm-{version}.json`에서 `stats.def.sorted`·`stats.def.mean`을
 * **그대로** 읽는다. 반올림·재계산 없음. 경로는 __dirname
 * (.norm-build/scripts/norm) 기준 → 프로젝트 루트는 ../../..
 */
function readStoredDef(versionFile: string): {
  file: string
  version: unknown
  engineVersions: unknown
  sampleSize: unknown
  storedSorted: number[]
  storedMean: number
  storedStdDev: unknown
} {
  const path = join(__dirname, '../../../src/engine/data', versionFile)
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
    version?: unknown
    engineVersions?: unknown
    sampleSize?: unknown
    stats: { def: { sorted: number[]; mean: number; stdDev?: unknown } }
  }
  return {
    file: `src/engine/data/${versionFile}`,
    version: parsed.version,
    engineVersions: parsed.engineVersions,
    sampleSize: parsed.sampleSize,
    storedSorted: parsed.stats.def.sorted,
    storedMean: parsed.stats.def.mean,
    storedStdDev: parsed.stats.def.stdDev,
  }
}

/**
 * 재구성 빈도표(③④)와 파일에서 읽은 빈도표(⑤)를 값 단위로 대조한다.
 * 값 집합의 합집합을 순회하며 각 값의 두 빈도를 나란히 낸다. 판단은
 * 하지 않는다 — 값·빈도·차이만 낸다.
 */
function compareFrequencyTables(
  reconstructed: readonly { value: number; count: number }[],
  fromFile: readonly { value: number; count: number }[],
): {
  valueSetsMatch: boolean
  allFrequenciesMatch: boolean
  rows: Array<{
    value: number
    reconstructedCount: number
    fileCount: number
    diff: number
  }>
} {
  const reconMap = new Map(reconstructed.map((e) => [e.value, e.count]))
  const fileMap = new Map(fromFile.map((e) => [e.value, e.count]))
  const allValues = [...new Set([...reconMap.keys(), ...fileMap.keys()])].sort(
    (a, b) => a - b,
  )

  const rows = allValues.map((value) => {
    const reconstructedCount = reconMap.get(value) ?? 0
    const fileCount = fileMap.get(value) ?? 0
    return {
      value,
      reconstructedCount,
      fileCount,
      diff: reconstructedCount - fileCount,
    }
  })

  const reconValueSet = new Set(reconMap.keys())
  const fileValueSet = new Set(fileMap.keys())
  const valueSetsMatch =
    reconValueSet.size === fileValueSet.size &&
    [...reconValueSet].every((v) => fileValueSet.has(v))
  const allFrequenciesMatch = rows.every((r) => r.diff === 0)

  return { valueSetsMatch, allFrequenciesMatch, rows }
}

function main(): void {
  const observations = enumerateObservations()
  const n = observations.length

  // ── 검산: defV3raw를 반올림한 값이 현재 computeSixStats(...).def와 일치하는가 ──
  let verifyMismatchCount = 0
  let verifyMaxAbsDiff = 0
  const verifyRawMinusStored: number[] = [] // defV3raw(무반올림) − defV3Stored(반올림됨) — 참고용
  for (const o of observations) {
    const rounded = applyStorageRounding(o.defV3raw)
    const d = rounded - o.defV3Stored
    const ad = Math.abs(d)
    if (ad > 1e-9) verifyMismatchCount++
    if (ad > verifyMaxAbsDiff) verifyMaxAbsDiff = ad
    verifyRawMinusStored.push(o.defV3raw - o.defV3Stored)
  }
  const verifyRawMinusStoredBundle = meanBundle(verifyRawMinusStored)

  // ── ① 반올림 없는 평균 둘 ──────────────────────────────────────
  const meanDefV2raw = meanBundle(observations.map((o) => o.defV2raw))
  const meanDefV3raw = meanBundle(observations.map((o) => o.defV3raw))
  const diffRaw = meanDefV3raw.mean - meanDefV2raw.mean

  // ── ② 반올림 후 평균 둘 ────────────────────────────────────────
  const roundedV2 = observations.map((o) => applyStorageRounding(o.defV2raw))
  const roundedV3 = observations.map((o) => applyStorageRounding(o.defV3raw))
  const meanRoundedV2 = meanBundle(roundedV2)
  const meanRoundedV3 = meanBundle(roundedV3)
  const diffRounded = meanRoundedV3.mean - meanRoundedV2.mean

  // ── ③④ 반올림 후 고유값·빈도 ──────────────────────────────────
  const freqV2 = frequencyByValueAscending(roundedV2)
  const freqV3 = frequencyByValueAscending(roundedV3)
  const freqV2Total = freqV2.reduce((s, e) => s + e.count, 0)
  const freqV3Total = freqV3.reduce((s, e) => s + e.count, 0)

  // ── ⑤ 파일과의 대조 (파일 값 그대로 읽음, 재계산 없음) ──────────
  const fileV2 = readStoredDef('norm-synthetic-v2.json')
  const fileV3 = readStoredDef('norm-synthetic-v3.json')
  const freqFileV2 = frequencyByValueAscending(fileV2.storedSorted)
  const freqFileV3 = frequencyByValueAscending(fileV3.storedSorted)
  const freqFileV2Total = freqFileV2.reduce((s, e) => s + e.count, 0)
  const freqFileV3Total = freqFileV3.reduce((s, e) => s + e.count, 0)

  const compareV2 = compareFrequencyTables(freqV2, freqFileV2)
  const compareV3 = compareFrequencyTables(freqV3, freqFileV3)

  const report = {
    meta: {
      script: 'scripts/norm/def-rounding-effect-diagnostic.ts',
      delegationPrompt:
        '.claude/state/prompts/phase-7/14-engine-dev-def-rounding.md',
      basis:
        'N = inferLoveType(...).big5.bigN; A = inferLoveType(...).attachAnxiety; ' +
        'V = inferLoveType(...).attachAvoidance; ' +
        'positiveBonus = (q2 === "B") ? 100 : 0 — leagueStats.ts groupBonus(q2==="B")와 ' +
        '동일 조건이나 그 헬퍼가 export되지 않아 복제(비-export 사실 명시). ' +
        'termV2 = computeAttachmentStability(A, V); termV3 = computeDefAnxietyStability(A) ' +
        '— 둘 다 leagueStats.ts에서 import해 호출, 재구현 없음. ' +
        'defV2raw = 0.4*(100-N) + 0.3*positiveBonus + 0.3*termV2; ' +
        'defV3raw = 0.4*(100-N) + 0.3*positiveBonus + 0.3*termV3 — 위임 식 그대로. ' +
        'defV3Stored = computeSixStats(...).def — 현재 코드의 실제 저장값(이미 반올림).',
      sampleSize: n,
      expectedSampleSize: MBTI_TYPES.length * 3 ** 5,
      sampleSizeIs3888: n === 3888,
      reusedFunctions: {
        inferLoveType:
          'src/engine/loveTypeInference.ts :: inferLoveType(input: LoveTypeInput): LoveTypeInferenceResult  (.big5.bigN, .attachAnxiety, .attachAvoidance, .big5, .sternberg)',
        computeAttachmentStability:
          'src/engine/leagueStats.ts :: computeAttachmentStability(attachAnxiety: number, attachAvoidance: number): number',
        computeDefAnxietyStability:
          'src/engine/leagueStats.ts :: computeDefAnxietyStability(attachAnxiety: number): number',
        computeSixStats:
          'src/engine/leagueStats.ts :: computeSixStats(input: SixStatsInput): SixStats  (.def — 검산 대상)',
        roundAndClamp:
          'src/engine/numeric.ts :: roundAndClamp(value: number, decimals: number, min: number, max: number): number',
        roundTo: 'src/engine/numeric.ts :: roundTo(value: number, decimals: number): number',
      },
      notExportedNote:
        'positiveBonus 판정 함수(groupBonus)는 leagueStats.ts에서 export되지 않음 — ' +
        '동일 조건(q2 === "B")을 이 스크립트에 복제했다. DEF 가중합·항 함수 자체는 재구현하지 않았다.',
      roundingPointsConfirmedInCode: {
        stage1: {
          location: 'src/engine/leagueStats.ts :: computeSixStats() — def: roundAndClamp(def, 0, 0, 100)',
          decimals: STORAGE_ROUND_DECIMALS,
          clampMin: STORAGE_CLAMP_MIN,
          clampMax: STORAGE_CLAMP_MAX,
          note: 'DEF가 computeSixStats를 벗어나기 전 적용되는 유일한 반올림.',
        },
        stage2: {
          location:
            'scripts/norm/distribution.ts :: toSortedRawScores(values, RAW_SCORE_DECIMALS) — enumerateNormData()가 stats.def 배열 조립 시 호출',
          decimals: RAW_SCORE_DECIMALS,
          note:
            'stage1에서 이미 정수가 된 값에는 수치상 무영향이지만, 배열에 들어가기까지 실제로 거치는 반올림 호출이라 함께 적용.',
        },
        summaryDecimalsForReference: {
          location:
            'scripts/norm/distribution.ts :: summarizeDistribution() — mean/stdDev 필드에만 적용, sorted 배열 원소에는 적용 안 됨',
          decimals: SUMMARY_DECIMALS,
        },
        fileShapeCheck:
          'v2/v3 stats.def.sorted 원소가 전부 정수로 확인됨(직접 로드) — stage1 decimals=0과 형태 일치. 어긋남 없음.',
      },
    },

    verification_defV3rawVsComputeSixStats: {
      description:
        'applyStorageRounding(defV3raw) vs computeSixStats(...).def(=defV3Stored), 원소별(|diff|>1e-9 기준) 비교. ' +
        '재구성식이 옳다면 전부 일치해야 한다.',
      mismatchCount: verifyMismatchCount,
      mismatchCountIsZero: verifyMismatchCount === 0,
      maxAbsDiff: {
        value: verifyMaxAbsDiff,
        toFixed15: verifyMaxAbsDiff.toFixed(15),
        toPrecision18: verifyMaxAbsDiff.toPrecision(18),
      },
      rawVsStoredBeforeRounding: {
        description:
          '참고용 — defV3raw(무반올림) − defV3Stored(이미 반올림됨)의 분포. ' +
          '반올림 자체 때문에 프로파일마다 어긋나는 것이 정상(비교 목적이 아니라 반올림 폭 참고용).',
        ...verifyRawMinusStoredBundle,
      },
      verdict: verifyMismatchCount === 0
        ? '반올림(stage1: decimals=0, clamp[0,100])으로 완전히 설명됨 — 재구성식이 computeSixStats 내부 계산과 반올림 전까지 일치한다.'
        : '반올림으로 설명되지 않는 잔차가 있다 — 수치만 보고, 판단 유보.',
    },

    section1_unroundedMeans: {
      description: 'E[defV2raw], E[defV3raw], 차 = E[defV3raw] - E[defV2raw]. 반올림 미적용.',
      meanDefV2raw: {
        ...meanDefV2raw,
        meanToFixed12: meanDefV2raw.mean.toFixed(12),
      },
      meanDefV3raw: {
        ...meanDefV3raw,
        meanToFixed12: meanDefV3raw.mean.toFixed(12),
      },
      diff: {
        value: diffRaw,
        toFixed12: diffRaw.toFixed(12),
        toFixed15: diffRaw.toFixed(15),
        toPrecision18: diffRaw.toPrecision(18),
      },
    },

    section2_roundedMeans: {
      description:
        'E[applyStorageRounding(defV2raw)], E[applyStorageRounding(defV3raw)], 차. ' +
        '적용한 반올림은 위 roundingPointsConfirmedInCode.stage1(decimals=0,clamp[0,100]) → stage2(decimals=10) 순.',
      meanRoundedV2: {
        ...meanRoundedV2,
        meanToFixed12: meanRoundedV2.mean.toFixed(12),
      },
      meanRoundedV3: {
        ...meanRoundedV3,
        meanToFixed12: meanRoundedV3.mean.toFixed(12),
      },
      diff: {
        value: diffRounded,
        toFixed12: diffRounded.toFixed(12),
        toFixed15: diffRounded.toFixed(15),
        toPrecision18: diffRounded.toPrecision(18),
      },
      diffOfDiffs_roundedMinusRaw: {
        description:
          '(반올림 후 차) − (반올림 전 차). 0이 아니면 반올림의 비선형 효과가 실제로 평균 차를 이동시켰다는 뜻(수치만 — 해석 안 함).',
        value: diffRounded - diffRaw,
        toFixed12: (diffRounded - diffRaw).toFixed(12),
      },
    },

    section3_v2RoundedFrequencies: {
      description: 'applyStorageRounding(defV2raw)의 값 오름차순 고유값·빈도.',
      distinctValueCount: freqV2.length,
      frequencies: freqV2,
      totalCount: freqV2Total,
      totalCountIs3888: freqV2Total === 3888,
    },

    section4_v3RoundedFrequencies: {
      description: 'applyStorageRounding(defV3raw)의 값 오름차순 고유값·빈도.',
      distinctValueCount: freqV3.length,
      frequencies: freqV3,
      totalCount: freqV3Total,
      totalCountIs3888: freqV3Total === 3888,
    },

    section5_fileComparison: {
      description:
        'norm-synthetic-v2.json / v3.json의 stats.def.sorted를 직접 읽어(재계산 없음) ' +
        '③④의 빈도표와 값·빈도 단위로 대조.',
      v2: {
        fileContext: {
          file: fileV2.file,
          version: fileV2.version,
          engineVersions: fileV2.engineVersions,
          sampleSize: fileV2.sampleSize,
          storedMean: fileV2.storedMean,
          storedStdDev: fileV2.storedStdDev,
          storedSortedLength: fileV2.storedSorted.length,
          storedSortedLengthIs3888: fileV2.storedSorted.length === 3888,
        },
        fileFrequencies: freqFileV2,
        fileFrequenciesTotal: freqFileV2Total,
        fileFrequenciesTotalIs3888: freqFileV2Total === 3888,
        comparisonToSection3: compareV2,
      },
      v3: {
        fileContext: {
          file: fileV3.file,
          version: fileV3.version,
          engineVersions: fileV3.engineVersions,
          sampleSize: fileV3.sampleSize,
          storedMean: fileV3.storedMean,
          storedStdDev: fileV3.storedStdDev,
          storedSortedLength: fileV3.storedSorted.length,
          storedSortedLengthIs3888: fileV3.storedSorted.length === 3888,
        },
        fileFrequencies: freqFileV3,
        fileFrequenciesTotal: freqFileV3Total,
        fileFrequenciesTotalIs3888: freqFileV3Total === 3888,
        comparisonToSection4: compareV3,
      },
    },
  }

  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
}

main()
