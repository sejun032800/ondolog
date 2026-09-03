/**
 * 애착축 진단 집계 — 회피축·불안축 수준별 및 애착 4유형별 합성값 분포.
 *
 * 근거: docs/ONDOLOG_MASTER.md
 *   - Part 10-2 (Q3 → 애착 불안축, Q5 → 애착 회피축 채점)
 *   - Part 10-2-3 (불안 × 회피 2×2 → 애착 4유형)
 *   - Part 17-3 ("애착 축 수치화" — Q3/Q5 응답별 수준값, 6각 스탯 공식)
 *   - Part 10-8-1 (전수 열거 규격: Q1~Q5 3⁵ × MBTI 16 = 3,888 프로파일)
 *
 * ── 이 스크립트는 규준집단을 바꾸지 않는다 ─────────────────────────
 * `src/engine/` 및 `src/engine/data/` 아래 어떤 파일도 만들거나 고치지
 * 않는다. 6각 스탯 공식도, 채점 로직도 바꾸지 않는다. 이 파일이 하는
 * 일은 **기존 순수 함수를 호출해 분포를 관측하고 stdout에 출력**하는
 * 것뿐이다. 파일 I/O 없음.
 *
 * ── 채점·축 판정을 재구현하지 않는다 ──────────────────────────────
 * 합성값은 `scripts/norm/enumerate.ts`의 `enumerateProfiles()`와
 * **완전히 동일한 호출 경로**로 얻는다:
 *   inferLoveType(input) → computeSixStats(...) → computeOvrRawScore(stats)
 * 축 수준(low/mid/high)은 `src/constants/attachment.ts`의 기존 룩업
 * (`Q3_ANXIETY_AXIS` / `Q5_AVOIDANCE_AXIS`)을 그대로 읽고, 애착 4유형은
 * `inferLoveType(...).attachment` 출력을 그대로 읽는다 — 어느 것도 이
 * 파일에서 다시 판정하지 않는다.
 *
 * ── 결정론 ────────────────────────────────────────────────────────
 * Math.random / Date.now() / new Date() / process.env 미사용. 열거 순서
 * (MBTI_TYPES → Q1 → Q2 → Q3 → Q4 → Q5, 각 A,B,C)와 반올림 지점
 * (`RAW_SCORE_DECIMALS` / `SUMMARY_DECIMALS`)이 `enumerate.ts`와 같으므로
 * 몇 번을 돌려도 같은 수치가 나온다.
 *
 * ── 재사용 목적 ──────────────────────────────────────────────────
 * 일회성 조사가 아니다. 회피축 조치(공식 조정 등) 후 **같은 스크립트로
 * 전후를 비교**하기 위해 재실행 가능한 형태로 남긴다.
 *
 * ── 실행 방법 (Windows / PowerShell) ─────────────────────────────
 * 프로젝트에 TS 러너(ts-node/tsx)가 없고 Node 네이티브 TS 실행은 확장자
 * 없는 상대 import를 해석하지 못하므로, `scripts/generate-norm.ts`와 같이
 * 1회용으로 컴파일 후 실행한다 (의존성·설정 파일 변경 없음):
 *
 *   npx tsc scripts/norm/attachment-diagnostic.ts --outDir .norm-build \
 *     --module commonjs --moduleResolution node --target es2022 \
 *     --esModuleInterop --skipLibCheck --resolveJsonModule --types node
 *   node .norm-build/scripts/norm/attachment-diagnostic.js
 *   Remove-Item -Recurse -Force .norm-build
 *
 * `.norm-build/`는 임시 산출물이다(커밋 금지).
 */

import {
  Q3_ANXIETY_AXIS,
  Q5_AVOIDANCE_AXIS,
  ATTACHMENT_LABEL_KO,
  type AttachmentType,
  type AxisLevel,
} from '../../src/constants/attachment'
import {
  computeOvrRawScore,
  computeSixStats,
} from '../../src/engine/leagueStats'
import { inferLoveType } from '../../src/engine/loveTypeInference'
import { roundTo } from '../../src/engine/numeric'
import { MBTI_TYPES, type QuizChoice } from '../../src/constants/quizTypes'
import { RAW_SCORE_DECIMALS, SUMMARY_DECIMALS } from './distribution'

/** Q1~Q5가 취하는 값. `enumerate.ts`와 동일한 열거 순서. */
const CHOICES: readonly QuizChoice[] = ['A', 'B', 'C'] as const

const AXIS_LEVELS: readonly AxisLevel[] = ['low', 'mid', 'high'] as const
const ATTACHMENT_TYPES: readonly AttachmentType[] = [
  'secure',
  'anxious',
  'avoidant',
  'fearful',
] as const

interface DiagnosticProfile {
  readonly anxietyLevel: AxisLevel
  readonly avoidanceLevel: AxisLevel
  readonly attachment: AttachmentType
  readonly composite: number
}

/**
 * 3,888개 프로파일을 `enumerate.ts`의 `enumerateProfiles()`와 동일한
 * 순서·동일한 함수 호출로 열거하되, 축 진단에 필요한 필드(축 수준·
 * 애착 4유형)를 추가로 담는다. 채점·스탯·축 판정 재구현 없음.
 */
function enumerateDiagnosticProfiles(): DiagnosticProfile[] {
  const profiles: DiagnosticProfile[] = []

  for (const mbti of MBTI_TYPES) {
    for (const q1 of CHOICES) {
      for (const q2 of CHOICES) {
        for (const q3 of CHOICES) {
          for (const q4 of CHOICES) {
            for (const q5 of CHOICES) {
              const inference = inferLoveType({ mbti, q1, q2, q3, q4, q5 })

              const stats = computeSixStats({
                big5: inference.big5,
                sternberg: inference.sternberg,
                q1,
                q2,
                attachAnxiety: inference.attachAnxiety,
                attachAvoidance: inference.attachAvoidance,
              })

              const composite = computeOvrRawScore(stats)

              profiles.push({
                // 축 수준: 기존 룩업 상수 그대로 (재판정 없음).
                anxietyLevel: Q3_ANXIETY_AXIS[q3],
                avoidanceLevel: Q5_AVOIDANCE_AXIS[q5],
                // 애착 4유형: inferLoveType 출력 그대로 (재판정 없음).
                attachment: inference.attachment,
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

/** 한 집단의 합성값 분포 요약 — `enumerate.ts`의 코어 9종 요약과 동일한 계산. */
interface GroupSummary {
  readonly mean: number
  readonly stdDev: number
  readonly min: number
  readonly max: number
  readonly n: number
}

/**
 * `enumerate.ts`의 `summarizeEnneagramCores()`와 바이트 동일한 절차:
 * 값을 RAW_SCORE_DECIMALS로 반올림·오름차순 정렬 → 정확 평균/모표준편차
 * 계산(중간 반올림 없음) → mean·stdDev만 SUMMARY_DECIMALS로 최종 반올림.
 */
function summarizeGroup(values: readonly number[]): GroupSummary {
  const sorted = values
    .map((v) => roundTo(v, RAW_SCORE_DECIMALS))
    .slice()
    .sort((a, b) => a - b)

  const n = sorted.length
  let sum = 0
  for (const v of sorted) sum += v
  const meanExact = n === 0 ? 0 : sum / n

  let sqDevSum = 0
  for (const v of sorted) {
    const d = v - meanExact
    sqDevSum += d * d
  }
  const stdDevExact = n === 0 ? 0 : Math.sqrt(sqDevSum / n)

  return {
    mean: roundTo(meanExact, SUMMARY_DECIMALS),
    stdDev: roundTo(stdDevExact, SUMMARY_DECIMALS),
    min: n === 0 ? 0 : sorted[0],
    max: n === 0 ? 0 : sorted[n - 1],
    n,
  }
}

/** ④ 교차표 한 칸 — 평균과 n만. */
function cellMeanAndN(values: readonly number[]): { mean: number; n: number } {
  const n = values.length
  let sum = 0
  for (const v of values) sum += roundTo(v, RAW_SCORE_DECIMALS)
  return { mean: n === 0 ? 0 : roundTo(sum / n, SUMMARY_DECIMALS), n }
}

function allEqual(ns: readonly number[]): boolean {
  return ns.every((x) => x === ns[0])
}

function main(): void {
  const profiles = enumerateDiagnosticProfiles()
  const compositeOf = (p: DiagnosticProfile) => p.composite

  // ① 회피축 3수준별 합성값 분포 (진단의 본체)
  const avoidanceByLevel: Record<AxisLevel, GroupSummary> = {
    low: summarizeGroup(
      profiles.filter((p) => p.avoidanceLevel === 'low').map(compositeOf),
    ),
    mid: summarizeGroup(
      profiles.filter((p) => p.avoidanceLevel === 'mid').map(compositeOf),
    ),
    high: summarizeGroup(
      profiles.filter((p) => p.avoidanceLevel === 'high').map(compositeOf),
    ),
  }

  // ② 불안축 3수준별 합성값 분포 (대조군)
  const anxietyByLevel: Record<AxisLevel, GroupSummary> = {
    low: summarizeGroup(
      profiles.filter((p) => p.anxietyLevel === 'low').map(compositeOf),
    ),
    mid: summarizeGroup(
      profiles.filter((p) => p.anxietyLevel === 'mid').map(compositeOf),
    ),
    high: summarizeGroup(
      profiles.filter((p) => p.anxietyLevel === 'high').map(compositeOf),
    ),
  }

  // ③ 애착 4유형별 합성값 분포
  const byAttachmentType = {} as Record<AttachmentType, GroupSummary>
  for (const t of ATTACHMENT_TYPES) {
    byAttachmentType[t] = summarizeGroup(
      profiles.filter((p) => p.attachment === t).map(compositeOf),
    )
  }

  // ④ 회피 × 불안 교차표 (3 × 3 = 9칸) — 평균과 n만
  const crossTab: Array<{
    avoidance: AxisLevel
    anxiety: AxisLevel
    mean: number
    n: number
  }> = []
  for (const avoidance of AXIS_LEVELS) {
    for (const anxiety of AXIS_LEVELS) {
      const cell = cellMeanAndN(
        profiles
          .filter(
            (p) => p.avoidanceLevel === avoidance && p.anxietyLevel === anxiety,
          )
          .map(compositeOf),
      )
      crossTab.push({ avoidance, anxiety, mean: cell.mean, n: cell.n })
    }
  }

  // ── n 균등 여부 점검 ──────────────────────────────────────────
  const avoidanceNs = AXIS_LEVELS.map((l) => avoidanceByLevel[l].n)
  const anxietyNs = AXIS_LEVELS.map((l) => anxietyByLevel[l].n)
  const crossNs = crossTab.map((c) => c.n)
  const attachmentNs = ATTACHMENT_TYPES.map((t) => byAttachmentType[t].n)

  const report = {
    meta: {
      sampleSize: profiles.length,
      expectedSampleSize: MBTI_TYPES.length * 3 ** 5,
      note:
        '합성값 = 6각 스탯 산술평균 = computeOvrRawScore(computeSixStats(...)). ' +
        'enumerate.ts와 동일 호출 경로. min/max는 RAW_SCORE_DECIMALS(=' +
        RAW_SCORE_DECIMALS +
        ') 반올림, mean/stdDev는 SUMMARY_DECIMALS(=' +
        SUMMARY_DECIMALS +
        ') 반올림. stdDev는 모표준편차(N).',
    },
    aggregate1_avoidanceByLevel: avoidanceByLevel,
    aggregate2_anxietyByLevel: anxietyByLevel,
    aggregate3_byAttachmentType: {
      secure: { ...byAttachmentType.secure, labelKo: ATTACHMENT_LABEL_KO.secure },
      anxious: {
        ...byAttachmentType.anxious,
        labelKo: ATTACHMENT_LABEL_KO.anxious,
      },
      avoidant: {
        ...byAttachmentType.avoidant,
        labelKo: ATTACHMENT_LABEL_KO.avoidant,
      },
      fearful: {
        ...byAttachmentType.fearful,
        labelKo: ATTACHMENT_LABEL_KO.fearful,
      },
    },
    aggregate4_avoidanceByAnxietyCrossTab: crossTab,
    sampleCounts: {
      avoidanceLevels: { low: avoidanceNs[0], mid: avoidanceNs[1], high: avoidanceNs[2] },
      avoidanceLevelsEqual: allEqual(avoidanceNs),
      anxietyLevels: { low: anxietyNs[0], mid: anxietyNs[1], high: anxietyNs[2] },
      anxietyLevelsEqual: allEqual(anxietyNs),
      crossTabCells: crossNs,
      crossTabCellsEqual: allEqual(crossNs),
      attachmentTypes: {
        secure: attachmentNs[0],
        anxious: attachmentNs[1],
        avoidant: attachmentNs[2],
        fearful: attachmentNs[3],
      },
      totals: {
        aggregate1: avoidanceNs.reduce((s, x) => s + x, 0),
        aggregate2: anxietyNs.reduce((s, x) => s + x, 0),
        aggregate3: attachmentNs.reduce((s, x) => s + x, 0),
        aggregate4: crossNs.reduce((s, x) => s + x, 0),
        allEqual3888:
          avoidanceNs.reduce((s, x) => s + x, 0) === 3888 &&
          anxietyNs.reduce((s, x) => s + x, 0) === 3888 &&
          attachmentNs.reduce((s, x) => s + x, 0) === 3888 &&
          crossNs.reduce((s, x) => s + x, 0) === 3888,
      },
    },
  }

  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
}

main()
