/**
 * DEF 애착 항 잔차 진단 — 두 항의 전수 평균 vs 규준집단 파일의 DEF 평균.
 *
 * 근거: docs/ONDOLOG_MASTER.md
 *   - Part 17-3 "애착 축 수치화" — DEF 애착 항 v2→v3 변경, 회피축 잔차 미해결
 *   - Part 10-2 (Q3 → 애착 불안축, Q5 → 애착 회피축 채점, computeAttachment)
 *   - Part 10-8-1 (전수 열거 규격: Q1~Q5 3⁵ × MBTI 16 = 3,888 프로파일)
 *
 * ── 무엇을 가르는 진단인가 ────────────────────────────────────────
 * DEF의 애착 항이 두 번 바뀌었다.
 *   v2 : computeAttachmentStability(A, V) = 100 − (A + V) / 2
 *   v3 : computeDefAnxietyStability(A)    = 75 − A / 2
 * DEF의 나머지 항(정서안정성, 긍정형 보너스)은 두 판에서 동일하므로,
 * DEF 평균의 변화는 오직 (이 항의 평균 차이 × 0.3)이어야 한다.
 * 규준집단 파일에서 읽은 DEF 평균의 변화가 그 값과 어긋나는지를 본다.
 * 이 스크립트는 수치만 산출한다 — 원인·정오를 판단하지 않는다.
 *
 * ── 이 스크립트는 아무것도 바꾸지 않는다 ─────────────────────────
 * `src/` 아래 어떤 파일도 만들거나 고치지 않는다. 공식도, 규준집단
 * 파일(v1/v2/v3)도 건드리지 않는다. 하는 일은 (1) 기존 순수 함수를
 * 호출해 두 항의 전수 평균을 관측하고, (2) 규준집단 JSON 세 개를
 * 읽기 전용으로 열어 저장된 DEF 평균을 그대로 옮기고, (3) 현재
 * computeSixStats의 DEF 전수 평균을 관측해 stdout에 출력하는 것뿐이다.
 *
 * ── 항을 재구현하지 않는다 ───────────────────────────────────────
 * `computeAttachmentStability` / `computeDefAnxietyStability`를
 * `src/engine/leagueStats.ts`에서 그대로 import해 호출한다. 식을 다시
 * 적으면 문서 정의대로 계산하게 되어, 이 진단이 찾으려는 차이(구현 ↔
 * 저장된 수치)가 사라진다. 축 값(attachAnxiety·attachAvoidance)은
 * `inferLoveType`에서 얻는다 — enumerate.ts / 기존 진단 스크립트와
 * 완전히 동일한 호출 경로.
 *
 * ── 규준집단 파일 값은 그대로 옮긴다 ─────────────────────────────
 * `stats.def.mean` 필드를 읽어 그대로 보고한다. 반올림하지 않고,
 * `stats.def.sorted` 배열로 재계산하지 않는다.
 *
 * ── 결정론 ───────────────────────────────────────────────────────
 * Math.random / Date.now() / new Date() / process.env 미사용. 열거 순서
 * (MBTI_TYPES → Q1 → Q2 → Q3 → Q4 → Q5, 각 A,B,C)가 enumerate.ts와
 * 같으므로 몇 번을 돌려도 같은 수치가 나온다. 규준 파일 경로는
 * __dirname 기준으로 해석한다(cwd 비의존).
 *
 * ── 재사용 목적 ─────────────────────────────────────────────────
 * 일회성 조사가 아니다. DEF 애착 항이나 규준집단 파일이 정정되면
 * 같은 스크립트로 전후를 비교하기 위해 재실행 가능한 형태로 남긴다.
 *
 * ── 실행 방법 (Windows / PowerShell) ────────────────────────────
 * 프로젝트에 TS 러너가 없고 Node 네이티브 TS 실행은 확장자 없는 상대
 * import를 해석하지 못하므로, 기존 진단 스크립트와 동일하게 1회용
 * 컴파일 후 실행한다 (의존성·설정 파일 변경 없음):
 *
 *   npx tsc scripts/norm/def-term-residual-diagnostic.ts --ignoreConfig `
 *     --ignoreDeprecations 6.0 --outDir .norm-build `
 *     --module commonjs --moduleResolution node --target es2022 `
 *     --esModuleInterop --skipLibCheck --resolveJsonModule --types node
 *   node .norm-build/scripts/norm/def-term-residual-diagnostic.js
 *   Remove-Item -Recurse -Force .norm-build
 *
 * `--ignoreConfig` / `--ignoreDeprecations 6.0`은 tsc 6.x에서 필요하다
 * (파일 지정 시 tsconfig.json 로드 거부 TS5112, moduleResolution=node10
 * 폐기 예고 TS5107 회피). 기존 두 진단 스크립트가 문서화한 명령은 더
 * 낮은 tsc에서 작성된 것으로, 그 파일들은 이 작업에서 수정하지 않는다.
 * `.norm-build/`는 임시 산출물이다(커밋 금지).
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  computeAttachmentStability,
  computeDefAnxietyStability,
  computeSixStats,
} from '../../src/engine/leagueStats'
import { inferLoveType } from '../../src/engine/loveTypeInference'
import { MBTI_TYPES, type QuizChoice } from '../../src/constants/quizTypes'

/** Q1~Q5가 취하는 값. `enumerate.ts` / 기존 진단 스크립트와 동일한 열거 순서. */
const CHOICES: readonly QuizChoice[] = ['A', 'B', 'C'] as const

interface Observation {
  /** v2 항: computeAttachmentStability(attachAnxiety, attachAvoidance) — 구현 그대로 호출. */
  readonly termV2: number
  /** v3 항: computeDefAnxietyStability(attachAnxiety) — 구현 그대로 호출. */
  readonly termV3: number
  /** 현재 computeSixStats(...).def — 구현 그대로 호출. */
  readonly defNow: number
}

/**
 * 3,888개 프로파일을 `enumerate.ts`의 `enumerateProfiles()`와 동일한
 * 순서·동일한 함수 호출로 열거하되, 이 진단에 필요한 세 값만 담는다.
 * 채점·스탯 재구현 없음 — 전부 위임한다.
 */
function enumerateObservations(): Observation[] {
  const observations: Observation[] = []

  for (const mbti of MBTI_TYPES) {
    for (const q1 of CHOICES) {
      for (const q2 of CHOICES) {
        for (const q3 of CHOICES) {
          for (const q4 of CHOICES) {
            for (const q5 of CHOICES) {
              const inference = inferLoveType({ mbti, q1, q2, q3, q4, q5 })

              // 축 값은 채점 함수 출력 그대로. 두 항 함수는 leagueStats에서
              // import한 구현을 그대로 호출한다 — 식 재작성 없음.
              const termV2 = computeAttachmentStability(
                inference.attachAnxiety,
                inference.attachAvoidance,
              )
              const termV3 = computeDefAnxietyStability(inference.attachAnxiety)

              // 현재 코드의 DEF — computeSixStats도 그대로 호출.
              const stats = computeSixStats({
                big5: inference.big5,
                sternberg: inference.sternberg,
                q1,
                q2,
                attachAnxiety: inference.attachAnxiety,
                attachAvoidance: inference.attachAvoidance,
              })

              observations.push({ termV2, termV3, defNow: stats.def })
            }
          }
        }
      }
    }
  }

  return observations
}

/** 정확 합계·표본 수·평균을 함께 담아 역산이 가능하게 한다. 이 함수는 반올림하지 않는다. */
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

/**
 * 규준집단 JSON에서 `stats.def.mean`을 **그대로** 읽는다. 반올림·재계산 없음.
 * 경로는 __dirname(.norm-build/scripts/norm) 기준 → 프로젝트 루트는 ../../..
 */
function readStoredDefMean(versionFile: string): {
  file: string
  version: unknown
  engineVersions: unknown
  sampleSize: unknown
  storedDefMean: number
  storedDefStdDev: unknown
} {
  const path = join(__dirname, '../../../src/engine/data', versionFile)
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
    version?: unknown
    engineVersions?: unknown
    sampleSize?: unknown
    stats: { def: { mean: number; stdDev?: unknown } }
  }
  return {
    file: `src/engine/data/${versionFile}`,
    version: parsed.version,
    engineVersions: parsed.engineVersions,
    sampleSize: parsed.sampleSize,
    // 파일에 있는 값 그대로 — 재계산·반올림 없음.
    storedDefMean: parsed.stats.def.mean,
    storedDefStdDev: parsed.stats.def.stdDev,
  }
}

function main(): void {
  const observations = enumerateObservations()
  const n = observations.length

  // ── ① 두 항의 전수 평균 ────────────────────────────────────────
  const termV2 = meanBundle(observations.map((o) => o.termV2))
  const termV3 = meanBundle(observations.map((o) => o.termV3))
  // termDiff = v3항 − v2항  (부호·순서 고정 — 뒤집으면 ④(d) 역산이 반대로 나온다)
  const termDiff = termV3.mean - termV2.mean

  // ── ② 규준집단 파일의 DEF 평균 재추출 (저장된 값 그대로) ────────
  const fileV1 = readStoredDefMean('norm-synthetic-v1.json')
  const fileV2 = readStoredDefMean('norm-synthetic-v2.json')
  const fileV3 = readStoredDefMean('norm-synthetic-v3.json')

  // ── ③ 현재 코드로 계산한 DEF 평균 ────────────────────────────
  const defNow = meanBundle(observations.map((o) => o.defNow))

  // ── ④ 대조 넷 (전부 위 수의 산술) ────────────────────────────
  const a_fileChange = fileV3.storedDefMean - fileV2.storedDefMean
  const b_termPredictedChange = 0.3 * termDiff
  const c_nowVsFileV3 = defNow.mean - fileV3.storedDefMean
  const d_backCalcV2MinusFileV2 =
    defNow.mean - 0.3 * termDiff - fileV2.storedDefMean

  const report = {
    meta: {
      script: 'scripts/norm/def-term-residual-diagnostic.ts',
      basis:
        'termV2 = computeAttachmentStability(attachAnxiety, attachAvoidance); ' +
        'termV3 = computeDefAnxietyStability(attachAnxiety); ' +
        'defNow = computeSixStats(...).def. 세 함수 모두 src/engine/leagueStats.ts ' +
        '구현을 그대로 import해 호출 — 식 재작성 없음. ' +
        '축 값(attachAnxiety·attachAvoidance)은 inferLoveType({mbti,q1..q5})에서 획득. ' +
        'enumerate.ts와 동일 열거 순서. ' +
        '② 값은 규준집단 JSON의 stats.def.mean 필드를 그대로 옮긴 것(반올림·재계산 없음).',
      sampleSize: n,
      expectedSampleSize: MBTI_TYPES.length * 3 ** 5,
      sampleSizeIs3888: n === 3888,
      termDiffDirection: 'termDiff = termV3mean − termV2mean  (v3항 − v2항)',
      reusedFunctions: {
        v2Term:
          'src/engine/leagueStats.ts :: computeAttachmentStability(attachAnxiety: number, attachAvoidance: number): number',
        v3Term:
          'src/engine/leagueStats.ts :: computeDefAnxietyStability(attachAnxiety: number): number',
        sixStats:
          'src/engine/leagueStats.ts :: computeSixStats(input: SixStatsInput): SixStats  (.def)',
        axisValues:
          'src/engine/loveTypeInference.ts :: inferLoveType(input: LoveTypeInput): LoveTypeInferenceResult  (.attachAnxiety / .attachAvoidance)',
      },
    },

    aggregate1_termMeans: {
      termV2mean: termV2,
      termV3mean: termV3,
      termDiff,
      termDiffToFixed15: termDiff.toFixed(15),
      termDiffToPrecision18: termDiff.toPrecision(18),
    },

    aggregate2_storedDefMeans: {
      v1: fileV1,
      v2: fileV2,
      v3: fileV3,
      v1EqualsV2: fileV1.storedDefMean === fileV2.storedDefMean,
    },

    aggregate3_defMeanNow: defNow,

    aggregate4_contrasts: {
      'a__fileV3_minus_fileV2  (파일 기준 DEF 평균 변화)': {
        value: a_fileChange,
        toFixed15: a_fileChange.toFixed(15),
      },
      'b__0.3_x_termDiff  (항 변화가 예측하는 DEF 평균 변화)': {
        value: b_termPredictedChange,
        toFixed15: b_termPredictedChange.toFixed(15),
      },
      'c__defNow_minus_fileV3  (현재 코드와 v3 파일의 일치 여부)': {
        value: c_nowVsFileV3,
        toFixed15: c_nowVsFileV3.toFixed(15),
      },
      'd__(defNow - 0.3*termDiff) - fileV2  (현재 코드에서 v2 시절 DEF 평균 역산 - v2 파일값)':
        {
          value: d_backCalcV2MinusFileV2,
          toFixed15: d_backCalcV2MinusFileV2.toFixed(15),
        },
    },
  }

  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
}

main()
