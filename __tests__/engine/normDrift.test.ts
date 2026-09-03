import * as fs from 'fs'
import * as path from 'path'

import { enumerateNormData, NORM_VERSION } from '../../scripts/norm/enumerate'
import { serializeNormData } from '../../scripts/norm/serialize'
import type { NormData } from '../../src/engine/normPercentile'

/**
 * 드리프트 감지 — 현재 엔진 함수로 전수 열거를 **다시 돌려**
 * 커밋된 `norm-synthetic-v2.json`과 대조한다.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 10-8-3, 위임 프롬프트
 * "드리프트 감지 테스트 (필수)".
 *
 * `engineVersions` 기록만으로는 부족하다 — 채점을 고치고 버전 상수를
 * 올리지 않으면 파일은 옛 버전을 주장한 채 조용히 무효가 된다.
 * 이 테스트는 **버전 상수를 올리는 것을 잊어도** 깨진다.
 *
 * 불일치 시 실패는 곧 "규준집단을 재산출하고 (채점이 바뀌었다면)
 * 엔진 버전 상수를 올려라"는 신호다.
 *
 * 3,888개는 순수 룩업·산술이라 테스트에서 즉시 계산된다. 캐싱·샘플링하지 않는다.
 *
 * v1 → v2 (2026-09-02): `leagueStats`의 EMP 공식 갱신(Part 17-3, 순응형
 * 보너스 신설)으로 채점이 바뀌어 `norm-synthetic-v1.json`을 대조하던
 * 이 테스트가 예정대로 깨졌다 — 대조 대상을 v2로 갱신한다. v1은
 * 과거 발행물 재현용 데이터로 그대로 남아있고, 현재 코드로 v1이
 * 재현되지 않는 것이 정상이므로 v1을 대조하는 테스트는 남기지 않는다.
 */

const NORM_FILE = path.join(
  __dirname,
  '../../src/engine/data',
  `norm-${NORM_VERSION}.json`,
)

describe('규준집단 드리프트 감지 — 열거 재실행 vs 커밋된 파일', () => {
  const committedText = fs.readFileSync(NORM_FILE, 'utf8')
  const committed = JSON.parse(committedText) as NormData

  it('열거를 다시 돌린 직렬화 결과가 커밋된 파일과 바이트 단위로 동일하다', () => {
    const recomputedText = serializeNormData(enumerateNormData())
    expect(recomputedText).toBe(committedText)
  })

  it('enumerateNormData()는 반복 호출해도 동일한 직렬화를 낸다 (결정론)', () => {
    const a = serializeNormData(enumerateNormData())
    const b = serializeNormData(enumerateNormData())
    expect(a).toBe(b)
  })

  it('커밋된 파일: version이 synthetic-v2이다', () => {
    expect(committed.version).toBe('synthetic-v2')
  })

  it('커밋된 파일: engineVersions가 맵이고 열거가 import한 두 엔진 모듈을 담는다', () => {
    expect(typeof committed.engineVersions).toBe('object')
    expect(Object.keys(committed.engineVersions).sort()).toEqual([
      'leagueStats',
      'loveTypeInference',
    ])
    for (const v of Object.values(committed.engineVersions)) {
      expect(typeof v).toBe('string')
      expect(v.length).toBeGreaterThan(0)
    }
  })

  it('커밋된 파일: 분포 배열 7개(합성값 1 + 스탯 6)의 길이가 정확히 3,888', () => {
    expect(committed.sampleSize).toBe(3888)
    expect(committed.composite.sorted).toHaveLength(3888)
    for (const key of ['pus', 'emp', 'att', 'def', 'tac', 'rea'] as const) {
      expect(committed.stats[key].sorted).toHaveLength(3888)
    }
  })

  it('커밋된 파일: 에니어그램 코어 9종 요약이 모두 있고 표본 합이 3,888', () => {
    expect(committed.enneagramCoreSummary).toHaveLength(9)
    const cores = committed.enneagramCoreSummary.map((c) => c.core).sort((a, b) => a - b)
    expect(cores).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    const total = committed.enneagramCoreSummary.reduce((s, c) => s + c.count, 0)
    expect(total).toBe(3888)
  })

  it('커밋된 파일: 각 분포의 sorted 배열이 실제로 오름차순이다', () => {
    const arrays = [
      committed.composite.sorted,
      ...(['pus', 'emp', 'att', 'def', 'tac', 'rea'] as const).map(
        (k) => committed.stats[k].sorted,
      ),
    ]
    for (const arr of arrays) {
      for (let i = 1; i < arr.length; i++) {
        expect(arr[i]).toBeGreaterThanOrEqual(arr[i - 1])
      }
    }
  })
})
