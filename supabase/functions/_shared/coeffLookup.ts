/**
 * `app_config` 조회 — 코너 생성 파이프라인이 계수를 읽는 **유일한**
 * 경로 (docs/ONDOLOG_MASTER.md Part 17-0-3 규칙 D, 17-0-2).
 *
 * 위임 프롬프트: .claude/state/prompts/phase-7/20-engine-dev-pipeline-r3.md
 *
 * ── 경로 계약 ─────────────────────────────────────────────────────────
 * 이 파일의 경로(`supabase/functions/_shared/coeffLookup.ts`)는
 * `__tests__/engine/cornerPipelineStaticRules.test.ts`의
 * `APP_CONFIG_LOOKUP_MODULE` 상수와 정확히 같아야 한다. `.from('app_config')`
 * 패턴이 이 경로 밖에 나타나면 정적 규칙 D에 걸린다.
 *
 * ── 왜 `@supabase/supabase-js` 타입을 직접 import하지 않는가 ──────────
 * 필요한 것은 `.from('app_config').select(...).eq(...).maybeSingle()`
 * 형태의 메서드 체인뿐이다. 이것만 담은 최소 구조 타입
 * (`AppConfigQueryClient`)을 이 파일 안에서 직접 정의해 쓴다 — 실제
 * `SupabaseClient` 인스턴스는 구조적으로 이 타입을 만족하므로 호출부는
 * 그대로 넘기면 된다. 이 선택의 이점 둘:
 *   1. 이 파일이 Deno(Edge Function 실행 시점)·Node(Jest 테스트 시점)
 *      양쪽에서 동일하게 타입 검사·실행된다 — `npm:`/URL import 특유의
 *      "tsc 통과와 Deno 실행이 배타적"인 문제(17-0-3-A r23 실측)를
 *      아예 만들지 않는다.
 *   2. 테스트에서 가짜 클라이언트를 만들기 쉽다(진짜 Supabase 클라이언트
 *      생성 없이 이 좁은 인터페이스만 흉내 내면 된다).
 *
 * ── `CoeffBundle`의 `version`은 어디서 오는가 (구현 판단, 명시) ────────
 * `app_config` 스키마(`ONDOLOG_SCHEMA.md` 9-3)는 `key`/`value(jsonb)`
 * 두 컬럼뿐이고 버전 컬럼이 없다. 이 문서에 계수 조회의 "버전" 컬럼이
 * 명시돼 있지 않으므로, **`value` jsonb 자체가 `{ version: string, ...계수 }`
 * 형태를 갖는다고 본다** — `dna_scores.breakdown.coeffVersion`·
 * `corners.content.coeffVersion`이 이미 "버전을 값 옆에 함께 기록"하는
 * 관례를 쓰고 있어(Part 17-2, 17-0-5-B) 같은 관례를 `app_config.value`
 * 안쪽에도 적용한 것이다. 이 관례가 실제 코너별 계수 도입 시
 * (`#14`, 또는 17-2/17-3가 열릴 때) 다르면 그때 바로잡는다 — 지금은
 * MVP 3종(17-1·17-4·17-5)이 계수를 쓰지 않아 실전 검증이 안 된 채로
 * 골격만 놓는다.
 *
 * ── r25: `buildCoeffBundle`의 생성자가 이 파일에 있다 ───────────────────
 * `#13`에서 `buildCoeffBundle`이 `brandedTypes.ts`의 공개 export였다.
 * 이 파일(`lookupCoeffBundle`)을 거치지 않고도 `buildCoeffBundle({
 * version: 'x', ... })`을 리터럴로 직접 불러 유효한 `CoeffBundle`을 만들
 * 수 있었다 — 정적 규칙 D는 `.from('app_config')` 호출 위치만 제약할 뿐,
 * `buildCoeffBundle` 자체의 호출 위치는 보지 않기 때문이다. 마스터 문서
 * 17-0-2 r25는 "생성자가 사는 곳"을 `CoeffBundle`에 대해 이 파일로
 * 지정한다 — `app_config`를 실제로 읽는 그 모듈이기 때문이다. 그래서
 * `buildCoeffBundle`을 `brandedTypes.ts`에서 이 파일로 옮겼다.
 * `brandedTypes.ts`는 이제 타입 선언만 갖는다. 이 파일 안의
 * `as CoeffBundle` 캐스트는 정확히 한 곳(`buildCoeffBundle` 안)이며,
 * 정적 규칙 E의 예외 목록(`cornerPipelineStaticRules.test.ts`의
 * `APPROVED_BRAND_CONSTRUCTOR_MODULES`)에 이 파일 경로가 들어 있어야
 * 통과한다.
 */

import type { CoeffBundle } from '../../../src/engine/corners/brandedTypes.ts'

/**
 * `app_config` 조회에 필요한 최소 메서드만 담은 구조 타입. 실제
 * `SupabaseClient`(`@supabase/supabase-js`)는 이 타입을 구조적으로
 * 만족한다.
 */
export interface AppConfigQueryClient {
  from(table: 'app_config'): {
    select(columns: string): {
      eq(
        column: 'key',
        value: string,
      ): {
        maybeSingle(): Promise<{
          data: { key: string; value: unknown } | null
          error: { message: string } | null
        }>
      }
    }
  }
}

/**
 * 이미 조회된 원시 계수 값(바로 아래 `lookupCoeffBundle`이 `app_config`에서
 * 읽어온 값)을 받아 `CoeffBundle`로 조립한다. r25로 `brandedTypes.ts`에서
 * 이 파일로 옮겼다 — `app_config`를 실제로 읽는 모듈이 이 파일이기
 * 때문이다(마스터 문서 17-0-2 r25 표, 정적 규칙 D 지정 모듈과 동일).
 *
 * 이 함수 자신은 `app_config`를 직접 읽지 않는다 — 읽는 것은 바로 아래
 * `lookupCoeffBundle`의 책임이다. 이 함수는 그 결과를 받아 `version`
 * 필드가 실제로 있는지 최소한으로 검증한 뒤 캐스트만 한다(그래서
 * "조립 함수"이지 "조회 함수"가 아니다).
 *
 * `version`이 없거나 문자열이 아니면 캐스트하지 않고 던진다 — 버전 없는
 * `CoeffBundle`은 애초에 존재해선 안 되는 값이라, 여기서 막지 않으면
 * 타입이 보장하는 것("`coeffVersion` 없는 산출 저장 불가", 17-0-2)이
 * 거짓이 된다.
 *
 * 이 파일 안에서 정확히 한 번(바로 아래) `as CoeffBundle` 캐스트한다 —
 * 정적 규칙 E는 이 캐스트를 이 파일 경로에 한해 예외로 둔다(승인 모듈
 * 목록, 위 docblock 참조).
 */
export function buildCoeffBundle(raw: Record<string, unknown>): CoeffBundle {
  if (typeof raw.version !== 'string' || raw.version.length === 0) {
    throw new Error('buildCoeffBundle: version 필드가 없거나 문자열이 아닙니다')
  }
  return raw as CoeffBundle
}

/**
 * `app_config`에서 `configKey` 한 건을 읽어 `CoeffBundle`로 조립한다.
 *
 * 실패(행 없음·조회 오류·`value`가 `version` 필드를 갖춘 객체가 아님)는
 * 전부 던진다 — Part 17-0-5의 4값 중 어느 것도 "계수 조회 실패"를
 * 가리키지 않는다(`generation_failed`는 "LLM 오류"로 한정된 사유다).
 * 이 사유를 4값 중 하나로 욱여넣지 않고, 호출부(파이프라인)가 그대로
 * 전파하게 둔다 — 문서에 없는 사유를 지어내지 않기 위한 명시적 선택.
 * 17-2/17-3이 열려 계수 조회가 실전에 들어갈 때 마스터 PM이 이 경계를
 * 다시 판단해야 한다.
 */
export async function lookupCoeffBundle(client: AppConfigQueryClient, configKey: string): Promise<CoeffBundle> {
  const { data, error } = await client.from('app_config').select('value').eq('key', configKey).maybeSingle()

  if (error) {
    throw new Error(`coeffLookup: app_config 조회 실패 (key=${configKey}): ${error.message}`)
  }
  if (!data) {
    throw new Error(`coeffLookup: app_config에 key=${configKey} 행이 없음`)
  }
  if (data.value === null || typeof data.value !== 'object' || Array.isArray(data.value)) {
    throw new Error(`coeffLookup: app_config.value(key=${configKey})가 객체가 아님`)
  }

  return buildCoeffBundle(data.value as Record<string, unknown>)
}
