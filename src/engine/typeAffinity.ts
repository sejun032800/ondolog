/**
 * 유형 궁합 판정 — 연애 온도(Part 10-7-2)와 연애 DNA 일치율(Part 17-2)이
 * **공유**하는 공용 판정 모듈. 결정론적 순수 함수.
 *
 * 근거: docs/ONDOLOG_MASTER.md **Part 10-6-5 유형별 매트릭스**(판정의 입력),
 * **Part 10-6-3 대칭/비대칭 규칙**, **Part 10-7-2**·**Part 17-2**(둘 다
 * "양방향 판정이 어긋나면 높은 쪽을 커플 기저로 삼는다"는 동일 규칙을
 * 참조한다).
 *
 * ── 왜 별도 모듈인가 ──
 * 이 판정은 원래 `src/engine/temperature.ts` 안에 있었다. 연애 DNA도 같은
 * 판정을 쓰므로 공용 모듈로 **순수 이동**했다(로직·이름·시그니처·동작
 * 무변경). `dnaScore.ts`가 `temperature.ts`를 import하는 형태를 피하기
 * 위함이다 — 그러면 DNA 산출이 온도 모듈에 의존하게 되고,
 * `TEMPERATURE_ENGINE_VERSION`이 오를 때 DNA 산출의 근거가 함께 흔들린다.
 * 두 지표는 재료(양 vs 질)가 다르므로 버전도 분리돼 있어야 한다.
 * `temperature.ts`는 하위 호환을 위해 `resolveTypeAffinity`와
 * `TypeAffinityCategory`를 이 모듈에서 그대로 재-export한다.
 *
 * 매트릭스 자체는 재작성하지 않고 `src/constants/compatibility.ts`의 기존
 * `COMPATIBILITY` 룩업을 그대로 조회한다(Part 10-6-7: 정적 룩업 테이블,
 * 계산·랜덤 요소 없음).
 */

import type { EnneagramCore } from '../constants/enneagram'
import { COMPATIBILITY } from '../constants/compatibility'

/**
 * 유형 궁합 범주. Part 10-7-1 식별자 규칙: `typeAffinity`는 온도 계열
 * 어근(`temperature`)과 다른 어근을 쓴다 — 이 타입·함수들의 이름에
 * "temperature"를 넣지 않는다.
 */
export type TypeAffinityCategory = 'best' | 'neutral' | 'contrast'

/** `TypeAffinityCategory`의 우열 순서 — 숫자가 클수록 "더 잘 맞음" 쪽. */
const TYPE_AFFINITY_RANK: Readonly<Record<TypeAffinityCategory, number>> = {
  contrast: 0,
  neutral: 1,
  best: 2,
}

/**
 * `ownerCore` 한 명의 관점에서, `partnerCore`가 `COMPATIBILITY[ownerCore]`의
 * 어느 목록에 속하는지 판정한다. 어느 목록에도 없으면 중립(Part 10-7-2).
 *
 * 매트릭스 자체는 재작성하지 않고 `src/constants/compatibility.ts`의
 * 기존 `COMPATIBILITY` 룩업을 그대로 조회한다.
 */
function resolveTypeAffinityFromPerspective(
  ownerCore: EnneagramCore,
  partnerCore: EnneagramCore,
): TypeAffinityCategory {
  const entry = COMPATIBILITY[ownerCore]
  if (entry.best.some((item) => item.core === partnerCore)) {
    return 'best'
  }
  if (entry.contrast.some((item) => item.core === partnerCore)) {
    return 'contrast'
  }
  return 'neutral'
}

/**
 * 두 사람의 애니어그램 코어로 유형 궁합 범주를 판정한다(Part 10-7-2).
 *
 * Part 10-6-3: 온도차(contrast) 관계는 반드시 상호적이지만, 잘 맞음(best)
 * 관계는 애니어그램 화살표의 방향성 때문에 비대칭을 허용한다. 그래서
 * 이 함수는 양방향(coreA→coreB 관점, coreB→coreA 관점)을 각각 판정한
 * 뒤, **어긋나면 더 잘 맞는 쪽(높은 순위)을 커플의 범주로 삼는다**
 * (Part 10-7-2 "양방향 판정이 어긋나면 높은 쪽을 커플 기저로 삼는다").
 * Part 17-2 연애 DNA도 "10-7-2와 동일 규칙"으로 이 함수를 그대로 쓴다.
 */
export function resolveTypeAffinity(
  coreA: EnneagramCore,
  coreB: EnneagramCore,
): TypeAffinityCategory {
  const fromA = resolveTypeAffinityFromPerspective(coreA, coreB)
  const fromB = resolveTypeAffinityFromPerspective(coreB, coreA)
  return TYPE_AFFINITY_RANK[fromA] >= TYPE_AFFINITY_RANK[fromB] ? fromA : fromB
}
