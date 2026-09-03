/**
 * 미해결 상수 규격 — `docs/ONDOLOG_MASTER.md` Part 16-2 "미해결 상수 규격".
 *
 * 이 프로젝트에는 실사용 데이터·실기기 측정 없이는 정할 수 없는 계수가
 * 존재한다. 과거에는 이 상태를 코드가 표현할 수단이 없어서 그럴듯한
 * 자리표시자 값이 채워진 채 테스트가 전부 통과한 사고가 있었다(Phase 2).
 * 자리표시자도 결정론적이기 때문에 결정론 테스트를 통과해버려, "테스트
 * 통과"가 "정확성"을 뜻하지 않게 됐다.
 *
 * 이 파일은 그 사고를 막는 수단이다. 미확정 계수는 값이 아니라
 * `UNRESOLVED({ key })` — 호출 즉시 폭발하는 표식으로 선언한다.
 *
 * **키 목록 선언은 이 파일에만 존재한다.** 다른 파일에 흩어지면 Part 16-2
 * 목록과 1:1 대조가 불가능해진다. Part 16-2 원문 발췌:
 *
 * > `UNRESOLVED` 키는 이 목록과 **1:1로 대응한다** — 코드에만 있고 목록에
 * > 없는 키는 그 자체가 감사 위반이다.
 *
 * 결정론 계약: 이 파일 전체가 순수 함수다. Math.random / Date.now() /
 * new Date() / process.env를 쓰지 않는다. `UNRESOLVED`는 항상 같은 키에
 * 대해 항상 같은(내용이 동일한) 에러를 던진다 — "동일 입력 → 동일 출력"
 * 계약은 여기서 "동일 입력 → 동일 throw"로 나타난다.
 */

/**
 * 등록된 미해결 계수 하나의 메타데이터.
 *
 * `phase`는 **이 키를 소비하는 Phase**를 뜻한다 — 계수가 해소되는
 * 시점이 아니다. Part 16-2가 일부 키를 "Phase 7 선행"으로 묶은 것은
 * 해소 작업에 착수하는 시점 기준이고, 이 레지스트리의 `phase`는 각
 * 계수가 실제로 코드에서 쓰이는(소비되는) Phase다. 두 기준은 서로
 * 다른 축이며 모순되지 않는다.
 *
 * `doc`은 이 계수의 근거·해소 조건이 적힌 마스터 문서 절 번호다.
 */
export interface UnresolvedConstantMeta {
  /** 이 키를 소비하는 Phase 번호. */
  readonly phase: number
  /** 근거 문서 절 번호 (`docs/ONDOLOG_MASTER.md` 기준). */
  readonly doc: string
  /** 해소 조건 — 무엇이 갖춰져야 값을 정할 수 있는지. */
  readonly resolutionCondition: string
}

/**
 * 미해결 상수 레지스트리. Part 16-2 "`UNRESOLVED` 레지스트리 (코드와 1:1
 * 대응)" 표의 4개 항목과 1:1 대응한다.
 *
 * 새 미해결 계수가 생기면 이 객체에 항목을 추가하는 것으로 등록이
 * 끝난다 — 호출부는 `phase`/`doc`을 따로 적지 않고 `key`만 넘긴다.
 */
export const UNRESOLVED_REGISTRY = {
  'temperature.activityScore': {
    phase: 7,
    doc: 'MASTER Part 10-7-3',
    resolutionCondition:
      '하루치 활동 점수 정의(채팅·피드 건수 → 점수). 실사용 데이터',
  },
  'leagueStats.shrinkage': {
    phase: 7,
    doc: 'MASTER Part 10-8-3',
    resolutionCondition:
      '베이지안 수축 강도. 채팅 사후확률 갱신의 관측 분산 확보 후(사전 분산만으로는 부족 — 10-8-3 참조)',
  },
  'faceMatch.threshold': {
    phase: 6,
    doc: 'MASTER Part 9-4',
    resolutionCondition:
      '얼굴 매칭 임계값. 판정 정책은 확정, 값만 실기기 캘리브레이션',
  },
  'dnaScore.chatDelta': {
    phase: 7,
    doc: 'MASTER Part 17-2',
    resolutionCondition:
      '채팅 질 → 점수 변환. 범위 [−10, +25]는 확정, 산출식이 실사용 데이터 대기',
  },
} as const satisfies Record<string, UnresolvedConstantMeta>

/**
 * 레지스트리에서 파생된 리터럴 유니온 타입. 등록되지 않은 키로
 * `UNRESOLVED`를 호출하면 `npx tsc --noEmit`에서 먼저 걸린다.
 */
export type UnresolvedKey = keyof typeof UNRESOLVED_REGISTRY

/**
 * **등록된** 키로 `UNRESOLVED`를 호출했을 때 던지는 에러.
 * 메시지에 `phase`와 `doc`을 실어, 이 계수를 만난 사람이나 에이전트가
 * 참조할 절 번호를 그 자리에서 보게 한다.
 */
export class UnresolvedConstantError extends Error {
  readonly key: UnresolvedKey
  readonly phase: number
  readonly doc: string

  constructor(key: UnresolvedKey, meta: UnresolvedConstantMeta) {
    super(
      `UNRESOLVED constant "${key}" — Phase ${meta.phase}에서 소비 예정, ` +
        `근거 문서 ${meta.doc}. 해소 조건: ${meta.resolutionCondition}. ` +
        '이 값을 지어내지 말고, 해소 전까지 호출부에서 이 계수를 실사용하지 말 것.',
    )
    this.name = 'UnresolvedConstantError'
    this.key = key
    this.phase = meta.phase
    this.doc = meta.doc
  }
}

/**
 * **미등록** 키로 `UNRESOLVED`를 호출했을 때 던지는 에러.
 * `UnresolvedConstantError`와 반드시 다른 에러 타입이어야 한다 — 둘이
 * 구분되지 않으면 "등록된 키의 throw와 미등록 키의 throw가 서로 다른
 * 에러 타입이어야 한다"는 요구사항 자체를 테스트할 수 없다.
 */
export class UnknownUnresolvedKeyError extends Error {
  readonly key: string

  constructor(key: string) {
    super(
      `UNRESOLVED: "${key}"는 등록되지 않은 키다. 키 목록 선언은 ` +
        'src/engine/constants/unresolved.ts의 UNRESOLVED_REGISTRY 한 곳에만 ' +
        '존재한다 — 새 미해결 계수라면 그 레지스트리에 먼저 등록할 것.',
    )
    this.name = 'UnknownUnresolvedKeyError'
    this.key = key
  }
}

/**
 * 미확정 계수를 만난 자리에 값 대신 두는 표식. 호출 즉시 throw하고
 * 절대 반환하지 않는다(`never`).
 *
 * 호출부는 `key`만 넘긴다. `phase`와 `doc`은 레지스트리가 소유하며,
 * 에러 메시지를 통해서만 드러난다 — 호출부마다 메타데이터를 같이
 * 적으면 선언이 코드 전역에 복제된다.
 *
 * 타입 레벨에서 `key`는 `UnresolvedKey`(레지스트리 파생 리터럴 유니온)
 * 이므로 미등록 키 리터럴은 `tsc --noEmit`이 먼저 잡는다. 그와 별개로,
 * 타입을 우회해 호출된 경우(예: 검증되지 않은 외부 문자열)를 대비해
 * 런타임에서도 레지스트리 존재 여부를 확인하고, 미등록 키는 등록 키와
 * 다른 에러 타입(`UnknownUnresolvedKeyError`)으로 던진다.
 */
export function UNRESOLVED(args: { key: UnresolvedKey }): never {
  const { key } = args
  const registry: Record<string, UnresolvedConstantMeta | undefined> =
    UNRESOLVED_REGISTRY
  const meta = registry[key]

  if (meta === undefined) {
    throw new UnknownUnresolvedKeyError(key)
  }

  throw new UnresolvedConstantError(key, meta)
}
