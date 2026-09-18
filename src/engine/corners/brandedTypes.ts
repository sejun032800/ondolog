/**
 * 브랜드 타입 정의 모듈 — 코너 생성 파이프라인 규격
 * (docs/ONDOLOG_MASTER.md Part 17-0-2, 17-0-3, 17-0-3-A, 17-0-4).
 *
 * 위임 프롬프트: .claude/state/prompts/phase-7/19-engine-dev-guardrails.md
 * (브랜드 타입 정의) + .claude/state/prompts/phase-7/20-engine-dev-pipeline-r3.md
 * (`#13` — 아래 두 생성 함수 추가).
 *
 * ── 이 모듈이 유일한 정의처다 ────────────────────────────────────────
 * `ValidatedContent<T>`·`CoeffBundle` 두 브랜드 타입은 **이 파일에만**
 * 있다. 여러 모듈에 나눠 정의하면 같은 이름이라도 서로 다른 브랜드
 * 심볼이 되어 의미가 없어진다(17-0-3-A "타입 복제는 허용하지 않는다").
 *
 * ── 왜 src/engine/ 아래인가 ──────────────────────────────────────────
 * `CoeffBundle`은 엔진 함수가 인자로 요구하는 타입이므로 엔진 쪽에
 * 있어야 자연스럽다. `supabase/functions/`(Deno) 아래에 두면 엔진이
 * Deno 디렉터리를 참조하게 되어 의존 방향이 뒤집힌다. Edge Function이
 * 이 모듈을 가져다 쓴다(17-0-3-A). 두 런타임(Deno / React Native)의
 * 모듈 해석 차이로 import가 막히면 구조를 바꾸지 말고 보고한다(같은
 * 문서).
 *
 * ── `#13`이 이 모듈 안에 추가한 생성 함수 둘 ──────────────────────────
 * 브랜드 심볼이 export되지 않으므로(아래 참조) 이 모듈 밖에서는 값을
 * 만들 수 없고, 캐스트로 우회하면 정적 규칙 E
 * (`__tests__/engine/cornerPipelineStaticRules.test.ts`)에 걸린다.
 * 아래 두 함수만이 각 브랜드 값을 만드는 유일한 경로다(17-0-2):
 *
 *   1. `validateCornerContent<T>` — `ValidatedContent<T>`를 반환하는
 *      파싱·검증 함수. LLM 출력에 Zod 파싱(17-0-4 순서 1) +
 *      `FORBIDDEN_KEYS` 검사(순서 2, `./forbiddenKeys`)를 모두 통과시킨
 *      뒤에만, 이 모듈 안에서 정확히 한 번 `as ValidatedContent<T>`
 *      캐스트해 반환한다. 하나라도 실패하면 캐스트하지 않고 실패 사유
 *      (`schema_invalid` | `forbidden_content`)를 반환한다.
 *   2. `buildCoeffBundle` — `CoeffBundle`을 반환하는 조립 함수. 지정된
 *      조회 모듈(정적 규칙 D, `supabase/functions/_shared/coeffLookup.ts`)이
 *      `app_config`에서 읽어온 원시 값(`version` 필드 포함)을 받아, 이
 *      모듈 안에서 정확히 한 번 `as CoeffBundle` 캐스트한다. **원시 계수
 *      값 자체는 여기서 조회하지 않는다** — 조회는 규칙 D가 지정한
 *      모듈 밖에서 일어나면 안 되므로, 이 함수는 이미 조회된 값을
 *      받기만 한다.
 *
 * ── 브랜드 심볼을 export하지 않는다 ──────────────────────────────────
 * 아래 두 타입은 `unique symbol` 타입의 프로퍼티를 인라인으로 선언한다
 * (마스터 문서 17-0-2 원문 그대로). 이 방식은 별도로 이름 붙은 심볼
 * 상수를 만들지 않으므로 애초에 "내보낼 심볼 자체가 없다" —
 * export하면 안 되는 대상이 존재하지 않는 형태로 요건을 만족한다.
 * `ValidatedContent`/`CoeffBundle` **타입 자체**는 호출부(저장 함수,
 * 엔진 함수 시그니처)가 참조해야 하므로 export한다.
 *
 * ── 캐스트 예외 (정적 규칙 E, r18) ───────────────────────────────────
 * `as ValidatedContent`·`as CoeffBundle` 캐스트는 **이 모듈 안에서만**
 * 허용된다 — 브랜드 값을 만드는 유일한 방법이 정의 모듈 안에서 정확히
 * 한 번 캐스트하는 것이기 때문이다. 이 파일 밖에서의 캐스트는 정적
 * 규칙 E가 잡는다. **`#13`부터 이 파일은 캐스트를 정확히 두 곳(아래 두
 * 함수 안)에 포함한다** — 그 밖의 자리에서 같은 캐스트가 나타나면 정적
 * 규칙 E 위반이다.
 */

import type { ZodType } from 'zod'
import { findForbiddenKeys } from './forbiddenKeys'

/**
 * LLM이 생성한 코너 콘텐츠 중 검증(Zod 파싱 + `FORBIDDEN_KEYS` 검사,
 * Part 17-0-4)을 **통과한 것만** 이 타입을 가질 수 있다.
 *
 * 저장 함수가 이 타입만 받도록 설계하면, 검증을 건너뛴 content는
 * 타입 층에서 이미 막힌다(17-0-2 "검증 안 된 LLM 출력 저장" 방지).
 *
 * 이 모듈 밖에서 이 타입의 값을 만드는 방법은 캐스트뿐이고, 그 캐스트는
 * 이 모듈 안에서만 허용된다(정적 규칙 E). 생성 함수는 아래
 * `validateCornerContent`다.
 */
export type ValidatedContent<T> = T & { readonly __validated: unique symbol }

/**
 * 엔진 함수가 인자로 요구하는 계수 묶음. `app_config`에서 읽은 값만 이
 * 타입을 가질 수 있다 — 호출부가 리터럴 객체로 직접 만들 수 없으므로,
 * 계수 조회는 반드시 지정된 조회 모듈(정적 규칙 D)을 거쳐야 한다(17-0-2
 * "호출부가 계수를 직접 박는 것" 방지).
 *
 * `version`은 이 타입에 분리 불가능하게 붙어 있다 — 계수 버전 없는
 * 산출을 막는다. `dna_scores.engine_version not null`이 DB 층에서
 * 강제하던 것과 같은 종류의 보장을 컴파일 시점으로 앞당긴 것이다.
 *
 * 구체 계수 필드는 아직 없다(코너별 요구사항은 `#14`가 정한다 — 이
 * 작업(`#13`)은 코너별 부분을 만들지 않는다) — 마스터 문서 17-0-2
 * 원문의 `/* 계수 *\/` 자리표시자를 그대로 남긴다. `version` 하나만
 * 고정 필드다.
 *
 * 이 모듈 밖에서 이 타입의 값을 만드는 방법은 캐스트뿐이고, 그 캐스트는
 * 이 모듈 안에서만 허용된다(정적 규칙 E). 생성 함수는 아래
 * `buildCoeffBundle`이다.
 */
export type CoeffBundle = {
  /* 계수 — 구체 필드는 #14가 코너별 요구사항에 맞춰 정한다 */
  readonly version: string
} & { readonly __fromConfig: unique symbol }

// ─────────────────────────────────────────────────────────────────────────
// 생성 함수 — 이 모듈 안에서만 캐스트한다 (정적 규칙 E)
// ─────────────────────────────────────────────────────────────────────────

/**
 * `validateCornerContent`의 실패 결과. 런타임 검사 순서(Part 17-0-4)와
 * 그대로 대응한다 — Zod 파싱 실패는 `schema_invalid`, 파싱은 통과했으나
 * `FORBIDDEN_KEYS`에 걸리면 `forbidden_content`. `insufficient_input`·
 * `generation_failed`는 이 함수가 판정하지 않는다(호출 전 선행 검사·LLM
 * 호출 실패는 각각 다른 계층의 책임, Part 17-0-5).
 */
export type CornerValidationFailureReason = 'schema_invalid' | 'forbidden_content'

export type CornerValidationResult<T> =
  | { readonly ok: true; readonly content: ValidatedContent<T> }
  | { readonly ok: false; readonly reason: CornerValidationFailureReason; readonly detail: string }

/**
 * LLM이 반환한 원시 값(JSON.parse까지 끝난 값)을 검증한다.
 *
 * 순서(Part 17-0-4, 반드시 이 순서를 지킨다):
 *   1. Zod 파싱 — 실패하면 `schema_invalid`를 반환하고 여기서 끝난다.
 *   2. `FORBIDDEN_KEYS` 검사 — 파싱된 값(파싱 후 형태, 즉 스키마가
 *      정제한 값) 전체를 재귀 검사한다. 위반이 있으면 `forbidden_content`.
 *
 * 둘 다 통과해야만 `ValidatedContent<T>`로 캐스트해 반환한다 — 그래야
 * "검증을 건너뛴 content는 저장 불가"가 타입 층에서 성립한다(17-0-2).
 *
 * `schema`는 코너별로 다르므로 호출부가 주입한다(`#14`) — 이 함수 자신은
 * 어떤 코너의 스키마인지 모른다. `FORBIDDEN_KEYS` 검사는 전 코너 공통이라
 * 주입받지 않고 `./forbiddenKeys`를 직접 쓴다.
 */
export function validateCornerContent<T>(raw: unknown, schema: ZodType<T>): CornerValidationResult<T> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, reason: 'schema_invalid', detail: parsed.error.message }
  }

  const violations = findForbiddenKeys(parsed.data)
  if (violations.length > 0) {
    return {
      ok: false,
      reason: 'forbidden_content',
      detail: `금지 키 발견: ${violations.join(', ')}`,
    }
  }

  return { ok: true, content: parsed.data as ValidatedContent<T> }
}

/**
 * 이미 조회된 원시 계수 값(`supabase/functions/_shared/coeffLookup.ts`가
 * `app_config`에서 읽어온 값)을 받아 `CoeffBundle`로 조립한다.
 *
 * 이 함수는 `app_config`를 직접 읽지 않는다 — 읽는 것은 정적 규칙 D가
 * 지정한 조회 모듈의 책임이다. 이 함수는 그 결과를 받아 `version`
 * 필드가 실제로 있는지 최소한으로 검증한 뒤 캐스트만 한다(그래서
 * "조립 함수"이지 "조회 함수"가 아니다).
 *
 * `version`이 없거나 문자열이 아니면 캐스트하지 않고 던진다 — 버전 없는
 * `CoeffBundle`은 애초에 존재해선 안 되는 값이라, 여기서 막지 않으면
 * 타입이 보장하는 것("`coeffVersion` 없는 산출 저장 불가", 17-0-2)이
 * 거짓이 된다.
 */
export function buildCoeffBundle(raw: Record<string, unknown>): CoeffBundle {
  if (typeof raw.version !== 'string' || raw.version.length === 0) {
    throw new Error('buildCoeffBundle: version 필드가 없거나 문자열이 아닙니다')
  }
  return raw as CoeffBundle
}
