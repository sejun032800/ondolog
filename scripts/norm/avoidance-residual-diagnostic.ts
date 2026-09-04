/**
 * 회피축 잔차 진단 — `attachAvoidance` 원점수의 실제 분포 집계.
 *
 * 근거: docs/ONDOLOG_MASTER.md
 *   - Part 10-2 / 10-2-3 (Q5 → 애착 회피축 채점, computeAttachment)
 *   - Part 17-3 "애착 축 수치화" — 회피축 잔차 미해결 항목
 *     ("다음 열거에 함께 산출할 것 — ① attachAvoidance 전체 평균,
 *       ② Q5 응답별(A/B/C 각 1,296) attachAvoidance의 서로 다른 값과 빈도")
 *   - Part 10-8-1 (전수 열거 규격: Q1~Q5 3⁵ × MBTI 16 = 3,888 프로파일)
 *
 * ── 이 스크립트는 아무것도 바꾸지 않는다 ──────────────────────────
 * `src/engine/` 및 그 하위 어떤 파일도 만들거나 고치지 않는다. 공식도,
 * 규준집단 파일(v1/v2/v3)도, 축 정의도 건드리지 않는다. 기존 진단
 * 스크립트(`attachment-diagnostic.ts`)도 수정하지 않는다. 이 파일이 하는
 * 일은 **기존 순수 함수를 호출해 분포를 관측하고 stdout에 출력**하는
 * 것뿐이다. 파일 I/O 없음.
 *
 * ── 채점·축 판정을 재구현하지 않는다 ──────────────────────────────
 * `attachAvoidance` 원점수는 `scripts/norm/enumerate.ts`의
 * `enumerateProfiles()` / `scripts/norm/attachment-diagnostic.ts`의
 * `enumerateDiagnosticProfiles()`와 **완전히 동일한 호출 경로**로 얻는다:
 *   inferLoveType({ mbti, q1..q5 }) → 결과의 .attachAvoidance
 * enumerate.ts의 `enumerateProfiles()`는 `EnumeratedProfile`에
 * `attachAvoidance`를 노출하지 않으므로 직접 호출할 수 없다. 커밋된 참조
 * `attachment-diagnostic.ts`가 이 상황을 처리하는 방식(같은 순서·같은
 * 함수 호출로 루프를 다시 돌리되 필요한 필드만 추가)을 그대로 따른다.
 * 루프는 반복일 뿐이고, 채점은 전부 `inferLoveType`에 위임한다.
 *
 * ── 값을 반올림하지 않는다 ────────────────────────────────────────
 * 집계 ②는 `inferLoveType(...).attachAvoidance`가 반환한 값을 **그대로**
 * 집계한다. 이 스크립트는 어떤 반올림도 추가하지 않는다
 * (loveTypeInference 내부의 clampInt는 기존 채점 함수의 일부다).
 * 집계 ①의 평균만 표시 목적으로 자리수를 지정해 출력하되, 정확 합계와
 * 표본 수를 함께 실어 역산이 가능하게 한다.
 *
 * ── 결정론 ────────────────────────────────────────────────────────
 * Math.random / Date.now() / new Date() / process.env 미사용. 열거 순서
 * (MBTI_TYPES → Q1 → Q2 → Q3 → Q4 → Q5, 각 A,B,C)가 enumerate.ts와
 * 같으므로 몇 번을 돌려도 같은 수치가 나온다.
 *
 * ── 재사용 목적 ──────────────────────────────────────────────────
 * 일회성 조사가 아니다. 회피축 축 수치화 정의가 정정되면 **같은
 * 스크립트로 전후를 비교**하기 위해 재실행 가능한 형태로 남긴다.
 *
 * ── 실행 방법 (Windows / PowerShell) ─────────────────────────────
 * 프로젝트에 TS 러너(ts-node/tsx)가 없고 Node 네이티브 TS 실행은 확장자
 * 없는 상대 import를 해석하지 못하므로, `scripts/generate-norm.ts` 및
 * `scripts/norm/attachment-diagnostic.ts`와 같이 1회용으로 컴파일 후
 * 실행한다 (의존성·설정 파일 변경 없음):
 *
 *   npx tsc scripts/norm/avoidance-residual-diagnostic.ts --outDir .norm-build `
 *     --module commonjs --moduleResolution node --target es2022 `
 *     --esModuleInterop --skipLibCheck --resolveJsonModule --types node
 *   node .norm-build/scripts/norm/avoidance-residual-diagnostic.js
 *   Remove-Item -Recurse -Force .norm-build
 *
 * `.norm-build/`는 임시 산출물이다(커밋 금지).
 */

import { Q5_AVOIDANCE_AXIS, type AxisLevel } from '../../src/constants/attachment'
import { inferLoveType } from '../../src/engine/loveTypeInference'
import { MBTI_TYPES, type QuizChoice } from '../../src/constants/quizTypes'

/** Q1~Q5가 취하는 값. `enumerate.ts` / `attachment-diagnostic.ts`와 동일한 열거 순서. */
const CHOICES: readonly QuizChoice[] = ['A', 'B', 'C'] as const

interface AvoidanceObservation {
  /** Q5 응답 그대로 (A/B/C). 그룹 키. */
  readonly q5: QuizChoice
  /** Q5 → 회피축 3단계 라벨 (표시용, 채점 미사용). */
  readonly q5Level: AxisLevel
  /** inferLoveType 결과의 attachAvoidance 원점수 — 반올림 없이 그대로. */
  readonly attachAvoidance: number
}

/**
 * 3,888개 프로파일을 `enumerate.ts`의 `enumerateProfiles()`와 동일한
 * 순서·동일한 함수 호출로 열거하되, 회피축 잔차 진단에 필요한 필드
 * (Q5 응답 · attachAvoidance 원점수)만 담는다. 채점·축 판정 재구현 없음.
 */
function enumerateAvoidanceObservations(): AvoidanceObservation[] {
  const observations: AvoidanceObservation[] = []

  for (const mbti of MBTI_TYPES) {
    for (const q1 of CHOICES) {
      for (const q2 of CHOICES) {
        for (const q3 of CHOICES) {
          for (const q4 of CHOICES) {
            for (const q5 of CHOICES) {
              const inference = inferLoveType({ mbti, q1, q2, q3, q4, q5 })

              observations.push({
                q5,
                q5Level: Q5_AVOIDANCE_AXIS[q5],
                // 기존 채점 함수 출력 그대로 — 이 스크립트는 반올림하지 않는다.
                attachAvoidance: inference.attachAvoidance,
              })
            }
          }
        }
      }
    }
  }

  return observations
}

/**
 * 값 → 빈도 맵을 만든 뒤 값 오름차순으로 정렬된 엔트리 배열을 돌려준다.
 * 값은 어떤 변형도 없이 그대로 키가 된다 (반올림·양자화 없음).
 */
function frequencyByValueAscending(
  values: readonly number[],
): Array<{ value: number; count: number }> {
  const counts = new Map<number, number>()
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value - b.value)
}

function main(): void {
  const observations = enumerateAvoidanceObservations()
  const all = observations.map((o) => o.attachAvoidance)

  // ── ① attachAvoidance 전체 평균 (3,888개 산술평균) ──────────────
  const n = all.length
  let sum = 0
  for (const v of all) sum += v
  const meanExact = n === 0 ? 0 : sum / n

  // ── ② Q5 응답별 attachAvoidance 값 빈도표 (값 오름차순, 반올림 없음) ──
  const byQ5: Record<
    QuizChoice,
    {
      q5Level: AxisLevel
      count: number
      distinctValueCount: number
      frequencies: Array<{ value: number; count: number }>
      /** 참고용 — 폭만 보이므로 빈도가 본체다. */
      min: number
      max: number
    }
  > = {} as never

  for (const q5 of CHOICES) {
    const groupValues = observations
      .filter((o) => o.q5 === q5)
      .map((o) => o.attachAvoidance)
    const frequencies = frequencyByValueAscending(groupValues)
    byQ5[q5] = {
      q5Level: Q5_AVOIDANCE_AXIS[q5],
      count: groupValues.length,
      distinctValueCount: frequencies.length,
      frequencies,
      min: groupValues.length === 0 ? 0 : Math.min(...groupValues),
      max: groupValues.length === 0 ? 0 : Math.max(...groupValues),
    }
  }

  const perLevelCountsOk =
    byQ5.A.count === 1296 && byQ5.B.count === 1296 && byQ5.C.count === 1296
  const totalCount = byQ5.A.count + byQ5.B.count + byQ5.C.count

  const report = {
    meta: {
      script: 'scripts/norm/avoidance-residual-diagnostic.ts',
      basis:
        'attachAvoidance = inferLoveType({ mbti, q1..q5 }).attachAvoidance. ' +
        'enumerate.ts / attachment-diagnostic.ts와 동일 호출 경로. ' +
        '이 스크립트는 어떤 반올림도 추가하지 않는다.',
      sampleSize: n,
      expectedSampleSize: MBTI_TYPES.length * 3 ** 5,
      documentedAxisDefinition: 'Q5 응답 → { A: 20, B: 50, C: 85 } (Part 17-3)',
      documentedNominalMean: (20 + 50 + 85) / 3,
    },
    aggregate1_overallMean: {
      // 정확 역산이 가능하도록 합계와 표본 수를 함께 싣는다.
      exactSum: sum,
      sampleSize: n,
      mean: meanExact,
      meanToFixed12: meanExact.toFixed(12),
      meanToPrecision18: meanExact.toPrecision(18),
    },
    aggregate2_frequencyByQ5: {
      'Q5=A': byQ5.A,
      'Q5=B': byQ5.B,
      'Q5=C': byQ5.C,
    },
    checks: {
      perLevelCounts: { A: byQ5.A.count, B: byQ5.B.count, C: byQ5.C.count },
      perLevelCountsAll1296: perLevelCountsOk,
      totalCount,
      totalCountIs3888: totalCount === 3888,
      distinctValueCountByLevel: {
        A: byQ5.A.distinctValueCount,
        B: byQ5.B.distinctValueCount,
        C: byQ5.C.distinctValueCount,
      },
    },
  }

  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
}

main()
