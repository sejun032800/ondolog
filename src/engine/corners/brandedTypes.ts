/**
 * 브랜드 타입 정의 모듈 — 코너 생성 파이프라인 규격
 * (docs/ONDOLOG_MASTER.md Part 17-0-2, 17-0-3, 17-0-3-A, 17-0-4).
 *
 * 위임 프롬프트: .claude/state/prompts/phase-7/19-engine-dev-guardrails.md
 * (브랜드 타입 정의) + .claude/state/prompts/phase-7/20-engine-dev-pipeline-r3.md
 * (`#13` — 한때 이 파일에 생성 함수 추가) + .claude/state/prompts/
 * phase-7/21-engine-dev-brand-constructors.md (r25 — 그 생성 함수를
 * 이 모듈 밖 승인 모듈로 이전, 아래 참조).
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
 * ── r25: 생성자는 이 모듈에 없다 (전면 개정) ──────────────────────────
 * `#13`은 `validateCornerContent`·`buildCoeffBundle` 두 생성 함수를 이
 * 모듈 안에 **공개 export**로 두었다. 그 결과 `buildCoeffBundle`이
 * `coeffLookup.ts`를 거치지 않고도 호출 가능해져, 리터럴 객체
 * (`buildCoeffBundle({ version: 'x', ... })`)를 넘겨도 유효한
 * `CoeffBundle`이 만들어졌다 — **브랜드 심볼을 비공개로 둬도 생성 함수가
 * 공개되면 아무 의미가 없다**(심볼을 가져올 필요 없이 함수만 부르면
 * 되기 때문이다).
 *
 * 마스터 문서 17-0-2 r25는 이 구멍을 "생성자의 배치"로 막는다.
 * **이 모듈은 이제 타입 선언만 갖는다.** 생성자는 각각 그 값을 만들
 * 자격이 있는 모듈 안으로 옮겼다:
 *
 * | 브랜드 | 생성자가 사는 곳 | 함수 |
 * |---|---|---|
 * | `CoeffBundle` | `supabase/functions/_shared/coeffLookup.ts` — 정적 규칙 D가 지정한, `app_config`를 읽는 그 모듈 | `buildCoeffBundle` |
 * | `ValidatedContent<T>` | `supabase/functions/_shared/cornerPipeline.ts` — Zod 파싱(17-0-4 순서 ④) + `FORBIDDEN_KEYS` 검사(순서 ⑤)를 실제로 거치는 그 자리 | `validateCornerContent` |
 *
 * 각 생성자는 그 모듈 안에서 **정확히 한 번**만 캐스트한다 — `CoeffBundle`은
 * 조회 결과로부터, `ValidatedContent`는 Zod·`FORBIDDEN_KEYS` 통과 후에만.
 * 이 모듈은 이제 브랜드 심볼을 만드는 캐스트를 하나도 갖지 않는다.
 *
 * `CornerValidationFailureReason`·`CornerValidationResult<T>`는 브랜드
 * 타입이 아니라 `validateCornerContent`의 결과를 기술하는 평범한 타입이다
 * (캐스트로 만드는 값이 아니라 문자열 리터럴 유니온 + 그 유니온을 담는
 * 판별 유니온일 뿐 — `pipelineContracts.ts`가 `SkipReason`을 이 파일에
 * 두지 않은 것과 같은 논리). 생성자와 함께 `cornerPipeline.ts`로
 * 옮겼다 — 이 모듈 밖에서 이 두 타입을 이름으로 import하는 곳이
 * 없음을 확인했다(r25 1부 조사).
 *
 * ── 브랜드 심볼을 export하지 않는다 ──────────────────────────────────
 * 아래 두 타입은 `unique symbol` 타입의 프로퍼티를 인라인으로 선언한다
 * (마스터 문서 17-0-2 원문 그대로). 이 방식은 별도로 이름 붙은 심볼
 * 상수를 만들지 않으므로 애초에 "내보낼 심볼 자체가 없다" —
 * export하면 안 되는 대상이 존재하지 않는 형태로 요건을 만족한다.
 * `ValidatedContent`/`CoeffBundle` **타입 자체**는 호출부(저장 함수,
 * 엔진 함수 시그니처, 각 생성자 모듈)가 참조해야 하므로 export한다.
 *
 * ── 캐스트는 이 모듈에 없다 (정적 규칙 E, r25) ────────────────────────
 * `as ValidatedContent`·`as CoeffBundle` 캐스트는 r25부터 이 모듈 안에
 * 하나도 없다. 정적 규칙 E의 예외가 "브랜드 정의 모듈"에서 "승인된 생성
 * 모듈 목록"(`__tests__/engine/cornerPipelineStaticRules.test.ts`의
 * `APPROVED_BRAND_CONSTRUCTOR_MODULES`)으로 바뀌면서, 이 파일 경로는
 * 그 목록에서 **빠졌다** — 이 모듈이 이제 규칙 E의 감시 대상이라는
 * 뜻이다(캐스트가 여기 다시 나타나면 규칙 E가 그대로 잡는다).
 */

/**
 * LLM이 생성한 코너 콘텐츠 중 검증(Zod 파싱 + `FORBIDDEN_KEYS` 검사,
 * Part 17-0-4)을 **통과한 것만** 이 타입을 가질 수 있다.
 *
 * 저장 함수가 이 타입만 받도록 설계하면, 검증을 건너뛴 content는
 * 타입 층에서 이미 막힌다(17-0-2 "검증 안 된 LLM 출력 저장" 방지).
 *
 * 이 타입의 값을 만드는 유일한 방법은 캐스트뿐이고, 그 캐스트는
 * `supabase/functions/_shared/cornerPipeline.ts`(정적 규칙 E 승인
 * 모듈) 안에서만 허용된다. 생성 함수는 그 모듈의 `validateCornerContent`다.
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
 * 구체 계수 필드는 아직 없다(코너별 요구사항은 `#14`가 정한다) — 마스터
 * 문서 17-0-2 원문의 `/* 계수 *\/` 자리표시자를 그대로 남긴다. `version`
 * 하나만 고정 필드다.
 *
 * 이 타입의 값을 만드는 유일한 방법은 캐스트뿐이고, 그 캐스트는
 * `supabase/functions/_shared/coeffLookup.ts`(정적 규칙 E 승인 모듈,
 * 정적 규칙 D가 지정한 그 조회 모듈과 동일) 안에서만 허용된다. 생성
 * 함수는 그 모듈의 `buildCoeffBundle`이다.
 */
export type CoeffBundle = {
  /* 계수 — 구체 필드는 #14가 코너별 요구사항에 맞춰 정한다 */
  readonly version: string
} & { readonly __fromConfig: unique symbol }
