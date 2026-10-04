# 인수인계

> 서브에이전트는 컨텍스트가 격리되어 서로 대화할 수 없다.
> 이 파일이 유일한 인수인계 수단이다.
> **완료 항목은 `.claude/state/archive/`로 옮긴다** — 누적되면 컨텍스트가 오염된다.
> (예외: 아래 "DEF 애착 항 갱신" 작업 프롬프트는 선행 작업의 진단
> 수치를 보존하라고 명시해, 이번 세션은 완료 항목을 삭제하지 않았다.
> 프롬프트 #13도 상태 파일 기록 삭제·이동·재편을 금지해 유지한다.
> `#13-r4`(브랜드 생성자 이전)도 같은 이유로 `#13` 절을 그대로 두고
> 위에 새 절만 추가한다.)

## 열린 항목

> 완료 항목은 `.claude/state/archive/`로 옮긴다. 이 파일에는 열린 것만 둔다.
> 이 표는 원본을 가리키기만 한다. 본문을 옮겨 적지 않는다.

| 항목 | 상태 | 원본 |
|---|---|---|
| `#14` 코너 3종 + 규칙 F | 미실행 | `docs/ONDOLOG_MASTER.md` 17-0 · 규칙 F는 §17-0-3 |
| 모듈 경로 계약 | 유효 | `__tests__/engine/cornerPipelineStaticRules.test.ts`의 `LLM_CALL_MODULE` · `APP_CONFIG_LOOKUP_MODULE` · `APPROVED_BRAND_CONSTRUCTOR_MODULES` |
| 발행 시 테마 복사 트리거 | 미적용 (Phase 7 발행 묶음) | `docs/ONDOLOG_SCHEMA.md` §9-C-7 |
| 테마 잠금 DB 강제 | 미적용 (Phase 9, 그 전 공개 배포 금지) | `docs/ONDOLOG_SCHEMA.md` §9-C-8 |
| 루트 `include`가 `docs/`의 `.ts`까지 먹음 | 알려진 제약 | `tsconfig.json`의 `include` |
| `TYPE_AFFINITY_ENGINE_VERSION` 도입 + 산출 시 기록 | 미구현 | `docs/ONDOLOG_MASTER.md` §10-7-5 |

## `#14` 1부 — 코너 3종 설계 보고 (2026-10-04, corner-pipeline) — 코드 없음, 승인 대기

위임: `.claude/state/prompts/phase-7/29-corner-pipeline-corners-design.md`.
**코드를 쓰지 않았다.** 조사 중 r26 실현성 확인용 임시 테스트 파일 1개를
만들었다가 삭제했다(`git status` 클린 확인). 이 절 외 변경: `PROGRESS.md` 한 줄.
**2부(구현)는 아래 "승인 필요"가 정리되기 전에 시작하지 않는다.**

### A. 조사 결과 (파일을 열어 확인한 사실)

| 항목 | 사실 |
|---|---|
| `runCornerPipeline` | `params = { input, preconditionCheck(input)=>boolean, buildPrompt(input)=>string, schema: ZodType<TPayload>, llmClient, lookupCoeffBundle? }`. 코너가 주입하는 것은 이 셋(선행 검사·프롬프트·스키마)뿐이고, **커플·기간 맥락을 받는 자리가 없다** |
| `validateCornerContent(raw, schema)` | Zod `safeParse` → 실패 `schema_invalid` → **`findForbiddenKeys(parsed.data)`** → 위반 `forbidden_content` → `parsed.data as ValidatedContent<T>`. **브랜드가 붙는 값은 "LLM 출력 스키마의 파싱 결과"다.** 저장 스키마와 다른 형태(원문 채우기 후)를 만들 수 없다 |
| `llmClient` | `call(prompt: string)`. 본문 `messages: [{ role:'user', content: prompt }]` 한 덩어리. **캐시 지점·system 블록·블록 구조 없음.** 예산(3회)은 인스턴스 내부, SDK 없이 `fetch` |
| `APPROVED_BRAND_CONSTRUCTOR_MODULES` | `cornerPipeline.ts` · `coeffLookup.ts` 두 곳(테스트 상수가 원본). `LLM_CALL_MODULE`=`_shared/llmClient.ts`, `APP_CONFIG_LOOKUP_MODULE`=`_shared/coeffLookup.ts`. 수집 범위 `supabase/functions` · `src/services` · `src/engine/corners` |
| r26 (Deno 쪽 테스트) | **가능.** `supabase/functions/_shared/` 아래 `.test.ts`를 jest(`jest-expo`, 기본 testMatch)가 수집하고, **`./cornerPipeline.ts` 정적 import가 jest에서 해석된다.** 루트 tsc는 `exclude`로 그 파일을 보지 않아 0. **전용 tsconfig(`types: []`)에서는 jest 전역(`describe/it/expect`)이 없어 TS2593/2304** — 파일 맨 위 `/// <reference types="jest" />`(`@types/jest`는 직접 devDependency)로 해소됨(jest 통과 + 전용 tsc 0 + 루트 tsc 0 실측). `@jest/globals` import도 동작하나 `package.json`에 없는 전이 의존이라 쓰지 않는다. `tsconfig.json`·`package.json` 변경 불필요 |
| 규칙 F 사전 점검 | 추적 파일 355개 basename 전수 검사 → 위반 0건(`git ls-files`, `^[A-Za-z0-9._-]+$`). 루트 파일(`CLAUDE.md` 등)은 수집 범위 밖 |
| **골격의 구멍 (발견)** | **`findForbiddenKeys`가 Zod 파싱 *결과*에 걸린다.** Zod `object`는 선언 안 된 키를 **지운다**(실측: `parse({title,verdict})` → `{"title":"x"}`). LLM이 스스로 만든 `verdict` 같은 키는 **검사 전에 사라져 `forbidden_content`가 영영 발생하지 않는다.** 기존 테스트 3건은 전부 금지 키(`score`·`verdict`)를 **스키마에 선언해** 이 경로를 못 본다. §17-0-4가 막으려는 "그릇을 스스로 만든다"가 정확히 이 경우다 |

### B. 설계

#### B-1. 파일 배치 (2-1)

`supabase/functions/` 아래에 LLM·파이프라인 코드를 두고, **저장 스키마만** `src/types/corners/`(CLAUDE.md 디렉터리 구조: "Zod 스키마")에 둔다. 앱(렌더러·뷰어)이 저장 형태를 읽어야 하므로 앱이 import 가능한 쪽에 있어야 하기 때문이다. `src/engine/`에는 아무것도 두지 않는다.

```
src/types/corners/storedContent.ts              신규  저장 스키마 3종 + 공통 값 객체 (zod만 import하는 leaf 1파일)
supabase/functions/_shared/llmRequest.ts        신규  PromptBlock·LlmRequest (타입만)
supabase/functions/_shared/cornerModule.ts      신규  CornerContext·CornerModule·ScopedRecord·응답 결과 (타입만)
supabase/functions/_shared/referenceResolution.ts 신규 ID 해석 3조건 (순수, 브랜드 없음)
supabase/functions/_shared/cornerPipeline.ts    수정  runCornerPipeline 시그니처 + validateCornerResponse(유일한 ValidatedContent 생성자)
supabase/functions/_shared/llmClient.ts         수정  call(LlmRequest), 캐시 지점 → 전송 본문
supabase/functions/_shared/corners/dateArchive.ts  신규  17-1
supabase/functions/_shared/corners/sweetWords.ts   신규  17-4
supabase/functions/_shared/corners/thisMonth.ts    신규  17-5
```

`storedContent.ts`를 **한 파일**로 두는 이유: 이 파일은 Edge(`.ts` 확장자 import 규약)와 루트(`.ts` 확장자 금지, TS5097) **양쪽이 읽는다.** 파일끼리 relative import를 하면 둘 중 한쪽이 깨지므로(r22 "배타적") **다른 파일을 import하지 않는 leaf**여야 한다. `forbiddenKeys.ts`·`brandedTypes.ts`가 이미 그 형태다.

#### B-2. 코너마다 두 함수 + 선행 검사 (2-2)

```ts
// cornerModule.ts (타입만)
interface CornerContext {
  readonly coupleId: string               // 호출부가 corners/issues 행에서 가져온다. 입력 레코드에서 읽지 않는다
  readonly period: { readonly start: string; readonly end: string }   // ISO8601
  readonly periodLabel: string
}
interface ScopedRecord { readonly id: string; readonly coupleId: string; readonly occurredAt: string }  // 입력 레코드가 반드시 싣는 최소 필드
interface CornerModule<TInput, TStored extends object> {
  hasMaterial(input: TInput): boolean                                        // 선행 검사 — 재료가 0인가만
  buildRequest(input: TInput, ctx: CornerContext): LlmRequest                // 요청 만들기
  processResponse(raw: unknown, input: TInput, ctx: CornerContext): CornerResponseResult<TStored>   // 응답 처리
}
type CornerResponseResult<T> =
  | { ok: true; content: ValidatedContent<T> }
  | { ok: false; reason: 'schema_invalid' | 'forbidden_content' | 'insufficient_input'; detail: string }
```

- 세 메서드는 **동기 순수 함수**다. 반환 타입이 `Promise`가 아니므로 `async`로 짜면 인터페이스 불일치로 컴파일이 막힌다.
- **선행 검사의 자리는 코너의 `hasMaterial`**(17-1: 조립된 데이트 ≥1 / 17-4: 기간 내 채팅 ≥1 / 17-5: 채팅·사진·데이트 합 ≥1). 경계값 없음(§17-0-5-D). 호출은 골격이 한다(순서 ①, 시도 0).
- `processResponse`는 **직접 검사하지 않고** 골격이 export하는 `validateCornerResponse`에 코너 고유 부품(LLM 스키마·참조 조회표·채우기 함수·저장 스키마)을 넘긴다. 코너가 검사를 건너뛰거나 순서를 바꿀 수 없게 하기 위해서다(B-4).

**"코너가 전송을 모른다"를 확인하는 수단 — 셋을 겹친다.**

1. **타입**: 위 인터페이스가 동기라 `Promise`·`async`가 컴파일에서 막힌다.
2. **정적 검사(신규, 코너 디렉터리 한정)**: `_shared/corners/*.ts`를 `stripComments` 후 문자열로 읽어 `\basync\b`·`\bawait\b`·`\bPromise\b`·`\bfetch\b`·`setTimeout|setInterval`·`\bDeno\b`·`llmClient|createLlmClient|LlmClient` 식별자·`llmClient.ts` import가 **없음**을 단언한다. 허용 import는 `zod`와 `_shared`의 `cornerModule`·`llmRequest`·`cornerPipeline`·`referenceResolution`, `src/types/corners/storedContent`로 한정. 위반·정상 합성 입력 테스트를 함께 둔다. (MASTER 규칙 C·D·E·F 표에는 없는 **추가 검사**다 — 규칙으로 올릴지는 마스터 PM 판단.)
3. **행동**: 코너 테스트는 `llmClient` 없이 세 함수를 직접 호출해 통과한다(전송 객체를 만들 필요 자체가 없음).

#### B-3. 골격 변경 (2-3)

```ts
// llmRequest.ts — 벤더 중립. Zod·SDK·cache_control 필드명을 모른다
interface PromptBlock { readonly text: string; readonly cacheBreakpoint?: true }
interface LlmRequest { readonly system: readonly PromptBlock[]; readonly user: readonly PromptBlock[] }

// llmClient.ts
call(request: LlmRequest): Promise<LlmCallResult>      // 기존 call(prompt: string) 대체

// cornerPipeline.ts
interface CornerPipelineParams<TInput, TStored extends object> {
  readonly corner: CornerModule<TInput, TStored>
  readonly input: TInput
  readonly context: CornerContext
  readonly llmClient: LlmClient                         // 코너 1건당 인스턴스, 예산은 안에 (#13 형태 유지)
  readonly lookupCoeffBundle?: () => Promise<CoeffBundle>
}
```

- 골격이 `corner.hasMaterial` → (계수) → `corner.buildRequest` → `llmClient.call` 루프 → `JSON.parse` → `corner.processResponse`를 호출한다. 재시도 판단은 지금과 같다: `schema_invalid` 1회, `forbidden_content`·`insufficient_input` 0회, `generation_failed`는 `llmClient`가 소진.
- `insufficient_input`은 이제 **두 곳에서** 나온다. 호출 전(`hasMaterial` 거짓, 시도 0)과 호출 후(`processResponse`가 명시적 빈 결과 반환, 시도 ≥1, 재시도 없음).
- **프롬프트 캐싱**: 코너가 `cacheBreakpoint`를 **블록에 표시**하고, `llmClient`만 그것을 Anthropic 본문의 `cache_control`로 번역한다(`system` 블록 배열 / `messages[0].content` 블록 배열). 코너는 `cache_control`이라는 이름을 모른다. 코너 프롬프트 배치: **system = 역할·원칙·출력 형식(정적, 마지막 블록에 표시)**, **user = 조립된 입력(가변, 표시 없음)**. 표시 개수 상한(4)은 `llmClient`가 확인한다. 캐시 최소 길이 등 수치는 2부 착수 시 `claude-api` 문서로 확인하고 지어내지 않는다.
- **층 분리**: `llmClient`는 `LlmRequest`(문자열 블록)만 안다 — Zod·`FORBIDDEN_KEYS` 무지식. 골격은 HTTP·`cache_control`을 모른다. 규칙 C 두 패턴(SDK import·호스트 문자열)은 그대로 `llmClient.ts` 한 곳.
- **예산은 인자로 흐르지 않는다** — 인스턴스 안에 남는다. `call`의 인자가 `LlmRequest`로 바뀌어도 예산 로직은 건드리지 않는다.
- **기존 테스트 영향**: `runCornerPipeline`·`llmClient.call`의 공개 시그니처가 바뀌므로 `cornerPipeline.test.ts`·`llmClient.test.ts`, 그리고 `validateCornerContent`를 픽스처로 쓰는 `saveCornerResult.test.ts`는 호출부를 고쳐야 한다. **검사하는 동작(순서·사유·재시도·예산)은 같게 유지하고 assertion 의미를 줄이지 않는다.** "기존 assertion 무수정"은 이 세 파일에 한해 성립하지 않는다 — 미리 밝힌다.

#### B-4. 검사 순서와 `ValidatedContent`가 생기는 자리 (2-4)

```
Zod(LLM 출력 스키마) → FORBIDDEN_KEYS(LLM이 반환한 raw 객체) → [명시적 빈 결과?] → ID 해석 → 원문 채우기 → 저장 스키마 → 브랜드
```

**`validateCornerResponse`를 `cornerPipeline.ts`에 두고, 기존 `validateCornerContent`는 제거한다.**

```ts
function validateCornerResponse<TLlm extends { readonly kind: string }, TStored extends object>(a: {
  raw: unknown
  llmSchema: ZodType<TLlm>
  refLookups: Readonly<Record<string, (id: string) => ScopedRecord | undefined>>  // 참조 키 → 입력에서 만든 조회
  context: CornerContext
  fill: (llm: TLlm) => { ok: true; value: unknown } | { ok: false; detail: string }  // 원문 채우기, 순수
  storedSchema: ZodType<TStored>
}): CornerResponseResult<TStored>
```

- **브랜드 캐스트는 이 함수 안에서 정확히 한 번**(저장 스키마 통과 직후). `APPROVED_BRAND_CONSTRUCTOR_MODULES`는 **변경하지 않는다**(두 곳 그대로). 코너 모듈은 목록에 **없고**, 따라서 규칙 E가 코너 파일의 캐스트를 그대로 잡는다 — 목록을 늘릴 이유가 없다.
- **검증 없이 브랜드를 붙이는 공개 함수를 두지 않는다.** 브랜드를 만드는 유일한 export가 7단계를 전부 거치는 이 함수다. 기존 `validateCornerContent(raw, schema)`를 남기면 **그것이 새 구멍**이 된다: LLM 출력 스키마 결과에 곧바로 브랜드를 붙여 ID 해석·채우기를 건너뛴 값이 저장 함수를 통과한다. 그래서 이름만 바꾸지 않고 **제거**한다. 브랜드 대상도 달라진다 — `ValidatedContent<LLM 출력>`이 아니라 **`ValidatedContent<저장 내용>`**(저장되는 것이 검증을 통과했다는 뜻이어야 하므로).
- 단계: ① `llmSchema.safeParse(raw)` 실패 → `schema_invalid` ② **`findForbiddenKeys(raw)`** 위반 → `forbidden_content` ③ `parsed.kind === 'none'` → `insufficient_input`(코드 위치 이 한 곳) ④ ID 해석(B-7) 실패 → `schema_invalid` ⑤ `fill` 실패 → `schema_invalid` ⑥ `storedSchema.safeParse(filled)` 실패 → `schema_invalid` ⑦ 캐스트.
- **`FORBIDDEN_KEYS`를 어디에 거는가 — LLM이 반환한 객체(raw)에만.** 파이프라인이 채운 저장 내용(⑤ 결과)에는 걸지 않는다: 엔진 주입값·원문 텍스트·저장 스키마 고유 키가 오탐될 수 있고, §17-0-4 제목이 "LLM 출력에만"이다. **raw에 거는 것이 A절 구멍의 해법이다** — Zod가 지우기 전의 객체를 보므로 스스로 만든 키가 보인다. 순서(Zod 통과 후 FK)는 문서 그대로 유지한다. 이는 현재 골격(`parsed.data`)과 **동작이 달라지는 지점**이며, 선언 안 된 `verdict` 키가 `forbidden_content`가 되는 테스트를 2부에서 추가한다.
- ⑥ 실패를 `schema_invalid`로 둔 이유: 문서의 사유가 4값뿐이고 새 값을 만들 수 없다. 채우기 코드 버그도 같은 값으로 보이는 한계가 있다 — 코너 테스트가 정상 입력에서 ⑥을 통과함을 항상 확인한다.

#### B-5. LLM 출력 스키마 / 저장 스키마 (2-5)

공통: LLM 출력 스키마에는 **원문 텍스트 필드가 없다.** 객체는 Zod 기본(미선언 키 제거)이라, LLM이 `turns[].text`를 써서 보내도 **스키마가 버리고** 저장 내용은 입력의 원문으로만 채워진다. 키 이름은 `FORBIDDEN_KEYS` 부분 문자열에 걸리지 않게 짓는다(예: 맞춤 질문의 키를 `suggestion`으로 지으면 **키 자체가 금지어**다 → `tailoredQuestion`. 값 `'suggestion'`은 키가 아니라 무관). 테스트로 모든 LLM 스키마의 정상 샘플이 `findForbiddenKeys`를 통과함을 단언한다.

| 코너 | LLM 출력 (참조·AI 문장만) | 파이프라인이 채움 (입력에서) |
|---|---|---|
| 17-1 | `{ kind:'articles', featuredDateId, articles:[{ dateId, title≤20, stopCaptions:[{ seq, caption }], tailoredQuestion:{ text, basis } }] }` | `dateOn`·`region`·`recalled`·`recallReason`·`stops`(시간·장소·좌표·사진·`userNotes` 원문)·`summary`·`closingQuestions`의 고정 2종·`header` |
| 17-4 | `{ kind:'none' }` \| `{ kind:'excerpts', main:[{ context, messageIds[1..4] }], sub:[{ messageId }] }` | `turns[].speaker/text/at`·`attribution`·`sub[].speaker/text`·`warmthIndex`(입력 주입, Q4) |
| 17-5 | `{ kind:'none' }` \| `{ kind:'theme', theme:{ headline≤16, lead, polarity:'neutral'\|'positive', signals }, articles[2..4]:[{ title≤20, body, evidence:[…참조] min1 }], closing }` | `evidence`의 원문·시각·출처, `seq` (Q2·Q3 확정 전 미완) |

- 저장 스키마는 CORNER_CONTENT §2·§6·§7 그대로(봉투 §0-3 포함). `aiCaption` 배타·`featured` 유일·`closingQuestions` 3종 고정·`articles` 2~4·`evidence` ≥1·`polarity`에 `negative` 없음을 **저장 스키마의 `superRefine`/enum으로 한 번 더** 건다(채우기 코드가 틀려도 저장 전에 걸리도록).
- 17-1에서 `userNotes`가 있는 정거장에 LLM이 `caption`을 달면 **`fill`이 거부 → `schema_invalid`**(조용히 버리면 "AI가 물러난다"가 지켜진 것처럼 보이는 모델 오류가 숨는다 — §17-0-5-D의 "섞지 않는다"와 같은 취지). 입력의 모든 데이트가 정확히 한 번씩 기사가 되는지, `(dateId, seq)`가 입력에 있는지도 `fill`이 확인한다.
- **§9-7-2 길이 상한이 걸리는 자리** (단위: 코드포인트 `Array.from(s).length` — Q9 기본값)

| 필드 | 상한 | LLM 출력 스키마 | 저장 스키마 |
|---|---|---|---|
| `articles[].title` (17-1·17-5) | 20 | 걸림 (재시도 대상으로 잡기 위해) | 걸림 (재확인) |
| `theme.headline` (17-5) | 16 | 걸림 | 걸림 |
| 코너 제목 `header.title` | 7 | 해당 없음 (LLM이 쓰지 않음) | 걸림 — **Q5 선결** |
| `statChanges[].explanation` | 120 | 연애리그 — 이번 범위 밖 | — |

  문서에 길이 상한이 없는 필드(`context`·`body`·`lead`·`aiCaption`·`closing`)에는 **상한을 만들지 않는다.**

#### B-6. 명시적 빈 결과 (2-6)

| 코너 | 표현 | 비고 |
|---|---|---|
| 17-1 | **빈 결과 variant가 없다.** 스키마가 `kind:'articles'`만 허용하고 `articles`는 min 1 | 데이트가 있으면 만든다. `{kind:'none'}`이 오면 Zod 실패 → `schema_invalid` (막는 형태) |
| 17-4 | `{ kind:'none' }` | 허용하는 형태 |
| 17-5 | `{ kind:'none' }` | 허용하는 형태 (`articles` 편수는 2~4, 그 아래는 `none`으로만 표현) |

**섞이지 않는 보장:** ① 빈 결과 판정 코드 위치는 `validateCornerResponse` ③ **한 곳**이고, **Zod 파싱이 성공한 뒤에만** 도달한다. 파싱 실패(깨진 JSON·`{}`·`[]`·`kind` 오탈자·`articles: []`)는 ①에서 이미 `schema_invalid`다. ② 비어 있음은 **리터럴 `kind:'none'` 하나로만** 표현된다. 빈 배열·null·누락은 빈 결과가 아니다. ③ `none` + 부가 키는 Zod가 부가 키를 버려 `none`으로 읽힌다 — 모델이 명시적으로 "없음"이라 했으므로 만들지 않는 쪽(원칙 ②)이 안전하다. ④ 결과 타입 `reason`의 `insufficient_input`은 이 한 분기에서만 생성된다.

#### B-7. ID 해석 (2-7)

**세 조건을 입력의 소속과 별개로, 각각 명시적으로 검사한다.** `referenceResolution.ts`(순수, 브랜드 무관)가 다음을 이 순서로 하고, 실패 `detail`에 **어느 조건이 깨졌는지**를 적는다(사유 값은 `schema_invalid` 그대로, 새 값 없음).

| # | 조건 | 검사 |
|---|---|---|
| 1 | 존재한다 | 코너가 입력으로 만든 조회표 `refLookups[참조키](id)`가 레코드를 돌려준다 |
| 2 | **그 커플의 것이다** | `record.coupleId === context.coupleId`. **`context.coupleId`는 호출부가 corners/issues 행에서 넘기며, 입력 레코드에서 가져오지 않는다** |
| 3 | 해당 호의 기간 안이다 | `context.period.start <= record.occurredAt < context.period.end` (경계 규칙은 Q10) |

- **참조 필드를 코너가 "신고"하지 않는다.** 골격이 LLM 출력을 순회해 **키가 `Id`/`Ids`로 끝나는 모든 값**을 수집하고 전부 조회한다. 조회표에 없는 `*Id` 키는 **실패(fail-closed)**. 코너 작성자가 참조 하나를 검사 대상에서 빠뜨릴 수 없다.
- 입력 레코드(`ScopedRecord`)는 `id`·`coupleId`·`occurredAt`을 **반드시** 싣는다(타입 필수 필드).

**입력에 들어 있다는 것만으로 갈음하면 안 되는 이유:** 입력 조립은 `#14` 뒤의 **별도 작업**이고 아직 없다. 조립 쿼리가 커플 조건을 빠뜨리거나 기간을 잘못 잡으면 **다른 커플의 레코드가 입력 집합에 섞인다.** "입력에 있는가"만 보면 그 레코드는 존재 조건을 통과하고, LLM은 입력(프롬프트)에 그것이 보이므로 참조할 수 있다 — 그러면 **다른 커플의 메시지가 지면에 실린다**(§17-0-4-A: 가장 무거운 사고). 2·3번이 입력의 구성과 무관하게 **레코드 자체의 소속·시각**을 보기 때문에 조립 실수가 마지막 방어선에서 걸린다.

#### B-8. 규칙 F (2-8)

- 위치: **`__tests__/build/fileNameRule.test.ts`** (저장소 전체 위생 검사라 `engine/`이 아니라 `build/`, `edgeFunctionsTypecheck.test.ts`와 같은 자리). 판정은 순수 함수 `fileNameViolations(relPath)`: **basename만** `^[A-Za-z0-9._-]+$` 검사, 디렉터리명은 보지 않는다.
- 수집: `git ls-files --cached --others --exclude-standard -z` 결과 중 `docs/ src/ app/ scripts/ __tests__/ supabase/ .claude/ assets/` 아래만. **"커밋될 파일"과 정확히 같은 집합**이고, 아직 `git add` 전인 새 파일(위반이 처음 생기는 자리)도 잡힌다. `.gitignore`가 `node_modules/`·`.expo/` 등 비추적 경로를 이미 제외하므로 별도 제외 목록이 필요 없다. `-z`는 한글 경로의 따옴표 이스케이프를 피하려는 것이다. git이 없는 환경에서는 `fs` 재귀 + `node_modules`·`.git`·`.expo`·`.norm-build` 제외로 폴백한다.
- 합성 입력: 위반 — `a b.md`, `file (1).md`, `한글.md`, `x+y.ts`, `a(1).ts` / 정상 — `index.tsx`, `.gitkeep`, `a-b_c.d.ts`, **`app/(tabs)/index.tsx`·`app/(modals)/x.tsx`(디렉터리 괄호는 통과)**.
- 실제 저장소 검사: 위 수집 결과 전체에 위반 0건 단언(사전 점검 355개 위반 0 확인).

#### B-9. 테스트 배치 (2-9)

- **새 코너·골격 테스트는 대상과 같은 트리에 둔다**(`supabase/functions/_shared/*.test.ts`, `_shared/corners/*.test.ts`). `.ts` 확장자 **정적 import**, 파일 첫 줄 `/// <reference types="jest" />`. → `require(경로변수)` 우회가 **없어지고 타입 검사를 받는다**(`edgeFunctionsTypecheck.test.ts`가 이 파일들을 함께 검사). A절 실측으로 가능함을 확인했다.
- 고쳐야 하는 기존 세 파일(`cornerPipeline`·`llmClient`·`saveCornerResult`)은 **같은 트리로 옮기며 정적 import로 전환**하는 것을 제안한다(호출부를 어차피 고친다). `coeffLookup.test.ts`는 손대지 않는다면 `require` 우회가 한 곳 남는다 — **함께 옮길지 Q11.**
- 정적 규칙(C·D·E)은 `.test.ts`를 수집에서 제외하므로 새 테스트 위치가 규칙에 영향을 주지 않는다.
- Deno 런타임 해석: 코너 파일이 **런타임에서** `zod`를 쓰는 것은 이번이 처음이다(지금까지는 `import type`뿐이라 지워졌다). 베어 `zod`는 jest·tsc에서는 풀리나 **Deno 배포에는 import map이 필요하다**(`supabase/functions/deno.json` 같은 설정 파일 — 만들지 않았고 사람 몫). 입력 조립·배포 단계 전에 해소해야 한다.

### C. 2부에서 증명할 것 — 각각의 테스트

| 증명 | 테스트 |
|---|---|
| 코너 코드에 호출·대기 코드가 없다 | `_shared/corners/*.ts` 소스 문자열 검사(B-2-2) 위반·정상 합성 입력 + 실제 파일 통과 + 코너 테스트가 `llmClient` 없이 세 함수를 호출 |
| 캐시 지점이 `llmClient` 요청에 실제로 실린다 | `fetchImpl` 주입으로 본문을 캡처해 `cacheBreakpoint` 블록에만 `cache_control`이 붙고 나머지엔 없음을 단언 · 코너별 `buildRequest`가 표시 ≥1을 가지며 **표시 앞 블록에 입력 레코드 텍스트가 없고** 서로 다른 두 입력에서 표시까지의 접두가 동일 |
| 다른 커플 ID 참조 — (가) LLM이 입력에 없는 ID를 지어냄 | 조회표에 없는 id → `schema_invalid`, detail에 "존재" |
| (나) 입력에 다른 커플 레코드가 섞여 있고 LLM이 참조 | 레코드가 입력 조회표에 **있고 기간 안**인데 `coupleId`만 다름 → `schema_invalid`, detail에 "소속". 존재·기간은 만족하도록 만들어 조건 2 단독을 증명 |
| 기간 밖 ID | 존재·소속 만족, `occurredAt`만 기간 밖(양쪽 경계) → `schema_invalid`, detail에 "기간" |
| 매핑 없는 `*Id` 키 | fail-closed → `schema_invalid` |
| 명시적 빈 결과 ↔ 파싱 실패 분리 | `{kind:'none'}` → `insufficient_input`(시도 ≥1, 재시도 0). `{}`·`[]`·깨진 JSON·`kind` 오탈자·`articles:[]`·17-1의 `{kind:'none'}` → `schema_invalid` |
| 원문을 LLM이 써도 저장에 안 들어감 | LLM 출력에 변조한 `text`·`turns[].text`를 섞어 보내고, 저장 내용이 **입력 원문과 문자 단위 일치** |
| `FORBIDDEN_KEYS` 구멍 | **선언 안 된** `verdict` 키 → `forbidden_content`(현행 골격이면 통과해 버리는 사례) · 채워진 저장 내용에는 걸지 않음 |
| 규칙 C·D·E 유지 | 기존 합성 입력 그대로 + 실제 저장소 통과(코너 파일 포함). 승인 목록 불변이므로 합성 입력 갱신은 "코너 모듈 경로의 캐스트는 위반" 한 건 추가 |
| 규칙 F | 위반·정상 합성 입력 + 저장소 실제 파일 전수 통과 |
| 게이트 | `tsc -p .` 0 · `tsc -p supabase/functions/tsconfig.json` 0 · jest 556·35 대비 감소 없음 |

### D. 문서와 다르게 읽힌 자리 (문서가 원본, 이 보고가 아니라 문서를 고쳐야 할 후보)

1. **`CORNER_CONTENT.md` §0-2 다이어그램**: "Zod 실패 시 재시도, **3회 실패 시 failed** / 금지 키 검사 **위반 시 재시도**". §17-0-5-A는 `forbidden_content` **재시도 없음**, `schema_invalid` 1회. §9를 MASTER 포인터로 바꾸는 작업(`28`) 뒤에도 이 다이어그램이 남아 있다. 이 보고는 §17-0이 원본이라는 전제로 설계했다.
2. **§9-7-2 "코너 제목 7자" ↔ CORNER_CONTENT §6-3 예시 `header.title: "이달의 다정한 말들"`(10자)** · MASTER 17-4 "이달의 다정한 말들". 서로 충돌한다(Q5).
3. **§17-0-4-A 기간 조건 ↔ 17-1 "그때 그 시절" 재소환** (과거 데이트가 정의상 기간 밖) · 17-5 "극히 적음: 기간 확장해서라도" (Q1).
4. **CLAUDE.md 디렉터리 구조("Zod 스키마는 `src/types/corners/`") ↔ §17-0-0("코너 파이프라인 코드는 `supabase/functions/`")**: B-1에서 저장 스키마만 `src/types/corners/`, 나머지는 `supabase/functions/`로 갈라 둘을 함께 만족시켰다. 이 분할이 의도와 맞는지 확인 요청.
5. **MASTER 17-4(서브 4~6개) ↔ CORNER_CONTENT §6-1(`sub` 개수 미규정)**, **"main 월간 2~3 / 일간 1"**(Q8).
6. 17-1 "마무리 질문 유형 평점형·회상형은 **고정 질문**" ↔ 문구는 예시 열에만 있다(Q7).

### E. 승인 필요 — 결정 전에 2부를 시작하지 않는다

**문서 공백 (지어내지 않고 묻는다)**

- **Q1 재소환 데이트의 기간 조건(17-1).** 재소환 데이트는 정의상 과거라 "해당 호의 기간 안" 조건을 만족할 수 없다. (가) 재소환은 입력에 `recalled:true`로 표시된 레코드에 한해 조건 3 대신 "기간 **이전**"을 요구하고 조건 1·2는 그대로 / (나) 다른 규칙 — 어느 쪽인가? 17-5의 "기간 확장"은 호출부가 확장된 기간을 `context.period`로 넘기는 것으로 처리해도 되는가?
- **Q2 17-5 `Evidence`.** `type:'photo'`에 사진 경로·참조 필드가 없어(`at/excerpt/attribution/metric*`뿐) 사진 근거를 저장·렌더링할 수 없다. 데이트(`date`)를 근거로 삼는 타입도 없다. `metric`은 17-0-5-D 표의 17-5 입력(채팅·사진·데이트)에 포함되지 않는다. 사진 근거의 저장 형태와 `metric` 포함 여부는?
- **Q3 `theme.signals[].value/count` 출처.** `count`를 LLM이 쓰면 검증 불가능한 수치(지어낸 값)가 된다. 파이프라인이 계산하는 방식이 정해져 있는가? 없으면 `count`를 어떻게 다루는가?
- **Q4 `warmthIndex`.** CORNER_CONTENT §10이 "산출식 미결정"으로 열어 둔 항목이다. 이 설계는 **입력이 `warmthIndex: number | null`을 싣고 파이프라인이 그대로 주입**(LLM 출력 아님, `null` 허용)한다고 둔다. 맞는가?
- **Q5 `header.title`.** 누가 정하는가(코너별 고정 상수 vs LLM), 그리고 7자 상한이 예시·MASTER 문구("이달의 다정한 말들", 10자)와 충돌한다. 어느 쪽이 원본인가?
- **Q6 `Attribution.display`·시간대.** 예시 "2026.08.22 09:20, 아침 대화 중"의 "아침"을 만드는 규칙(시간대 구분)과 시각 표기 시간대(예시는 +09:00)가 문서에 없다.
- **Q7 17-1 고정 질문 문구·`mapInfographic`·기사 순서.** 평점형·회상형 문구를 예시 그대로 상수로 쓰는가? `pins`(`label`·`order`)와 `bounds`를 어떤 규칙으로 파생하는가(없으면 `null` 고정?)? 기사 순서는 입력 순서/날짜순/LLM 중 어느 것인가?
- **Q8 17-4 개수.** `main` 월간 2~3·일간 1, `sub` 4~6(MASTER)을 스키마 하한·상한으로 건다면, 다정한 대화가 1개뿐인 달은 `none`(`insufficient_input`)이 되는데 그것이 의도인가? 일간/월간은 `CornerContext.cadence`로 받아 스키마를 만들면 되는가?
- **Q10(→Q9 포함) 기간 경계·길이 단위.** `[start, end)`(끝 배타)로 두고 코드포인트 길이로 센다 — 문서에 없어 둔 **기본값**이다. 확인 요청.

**이 설계가 스스로 고른 것 (이의 없으면 그대로)**

- Q9 `FORBIDDEN_KEYS`를 Zod 결과가 아니라 **raw에** 건다(A절 구멍, 동작 변경).
- 기존 `validateCornerContent` 제거 → `validateCornerResponse`로 교체, 브랜드 대상이 저장 내용으로 바뀐다.
- "존재" = **입력 레코드 집합 기준**이다(DB 재조회 포트를 두지 않음). 입력 조립이 DB 스냅샷을 만들어 넘기는 구조라 `#14` 범위에서는 충분하다고 보았다. 다만 **입력에 다른 커플 레코드가 섞이면 LLM 요청 시점에 이미 외부로 전송된다** — 응답 검사는 지면 노출만 막는다. 호출 전 입력 소속 점검을 둘지(실패 사유 새 값이 필요해 문서 밖) 입력 조립 작업의 몫으로 넘길지는 마스터 PM 판단.
- 코너 디렉터리 정적 검사(B-2-2)를 신규로 둔다(규칙 번호 부여는 PM 판단).
- Q11 `coeffLookup.test.ts`도 같은 트리로 옮겨 `require` 우회를 모두 없앨지.

### F. 변경한 파일

- `.claude/state/HANDOFF.md`(이 절), `.claude/state/PROGRESS.md`(제목 아래 한 줄). 그 밖 변경 없음 — `package.json`·`tsconfig.json`·`app.json`·`eas.json` 무변경, 커밋·푸시 없음.
- 게이트 기준선 재확인: 루트 `tsc` 0 · 전용 `tsc` 0 (조사 중 실측). jest 전체는 이번 1부에서 다시 돌리지 않았다(코드 변경 없음, 기준 556·35 유지).

## node_modules 백업 (2026-09-12, main session)

node_modules 백업: ..\ondolog-node_modules-20260910.zip (219548890 bytes, 2026-09-10)
현재 node_modules는 lock으로 재현 불가 — npm install --legacy-peer-deps로
설치 후 lock만 되돌려진 상태. npm ci는 lock 내부 불일치로 거부됨.
이 백업은 폰 복귀 후 lock 재생성 시 폐기한다. 해결이 아니라 다리다.

## package.json ↔ package-lock.json 정합 — 목표 달성 불가로 중단 (2026-09-12, main session)

Phase 7 위임(`.claude/state/prompts/phase-7/15-main-session-package-align.md`).
**중단 — 목표 자체가 달성 불가능함을 확인.** `package.json`은
`git checkout -- package.json`으로 되돌렸다(`git status --porcelain` 클린
확인 완료). `CLAUDE.md`는 손대지 않았다. 커밋 없음.

1. **`package-lock.json`이 내부적으로 낡았다.** `expo@57.0.17`이 요구하는
   전이 의존 7건의 버전 요구가 lock에 고정된 버전보다 높다. `npm ci`는
   어떤 플래그로도 통과하지 않는다(`--legacy-peer-deps`는 peer 충돌만
   무시할 뿐, 이건 peer 충돌이 아니라 lock 자체 무결성 오류라 무시
   대상이 아니다):
   `expo-updates-interface`(57.0.1→57.0.2 요구), `expo-json-utils`
   (57.0.1→57.0.2), `@expo/metro-runtime`(57.0.14→57.0.15), `@expo/ui`
   (57.0.12→57.0.18), `expo-glass-effect`(57.0.1→57.0.3), `expo-symbols`
   (57.0.2→57.0.3), `@expo-google-fonts/material-symbols`
   (0.4.44→0.4.47).

   별도로, **`package.json` 대 lock 루트 선언 자체의 불일치도 5건** 확인됨
   (`node -e`로 `package.json` vs `package-lock.json`
   `packages[""].dependencies`를 직접 비교, 2026-09-12 확인):

   | 필드 | package.json | lock 루트 선언 |
   |---|---|---|
   | react-native | 0.86.3 | 0.86.2 |
   | expo-router | ~57.0.17 | ~57.0.15 |
   | expo-dev-client | ~57.0.16 | ~57.0.14 |
   | expo-linking | ~57.0.8 | ~57.0.7 |
   | expo-auth-session | ~57.0.10 | ~57.0.9 |

   이 5건은 이번 세션 산출물이 아니다 — `git diff c4e0231 11ce24b --
   package.json`으로 확인한 결과 **commit `11ce24b`("0831 시작 커밋",
   2026-08-31)에서 `package.json`의 이 5개 필드만 올라가고
   `package-lock.json`의 루트 선언은 그대로 남았다.** 그 뒤 `0904`·`0906`·
   `0909`×2·`0912` 커밋 전부 `package.json`/`package-lock.json`을
   건드리지 않아 그대로 이어졌다. `npm ci`를 한 번도 정상 실행하지 않아
   지금까지 발견되지 않았던 것으로 보인다.

2. **`CLAUDE.md` 45행은 여전히 잘못된 명령이다.** `npm install
   --legacy-peer-deps`는 lock을 덮어쓴다(절대 규칙 8 위반 소지). 대체안으로
   시도한 `npm ci`는 위 1번 때문에 작동하지 않는다. 45행은 손대지 않았다 —
   현재 맞는 명령이 없다.

3. **현재 동작 중인 `node_modules`를 만든 절차 — PSReadLine 히스토리로
   재구성(추측 아님, 하지만 불완전)**. 이번 세션(main session, 2026-09-12)
   대화 이전에 있었던 별도 라운드의 명령이라 이 세션은 직접 실행을
   지켜보지 못했다. 출처: `%APPDATA%\Microsoft\Windows\PowerShell\
   PSReadLine\ConsoleHost_history.txt`(줄 396~452 부근). **이 파일은
   타임스탬프를 남기지 않아 정확한 실행 시각은 전부 불명 — 순서(줄 번호
   순)만 확인 가능.**

   - `npm install --legacy-peer-deps` 실행 (416번째 줄 부근) —
     **이 시점에 `package-lock.json`이 다시 쓰였다.** `node_modules`도
     이때 갱신됨(→ 지금 설치돼 있는 `node_modules`의 실제 출처).
   - `Test-Path package-lock.json` / `Select-String package.json` /
     `git log --oneline -3 -- package.json package-lock.json` 등 확인성
     명령 다수.
   - **`git checkout -- package-lock.json`** — **이 시점에 방금 다시
     써진 lock을 커밋 상태로 되돌림.** `node_modules`는 그대로 두었다 —
     즉 이 순간부터 `node_modules`는 디스크상 lock이 선언하는 트리와
     달라졌다(lock으로 재현 불가능한 상태가 됨).
   - `npx jest --ci --watchAll=false` 실행 → 통과(348/26 기준선이 이
     시점 산출물로 추정 — 이 세션이 직접 목격하지 않아 "추정").
   - `Test-Path node_modules/@react-native/jest-preset` 확인.
   - `npx tsc --noEmit -p .` 실행 → 통과 추정(출력 미보존).
   - `package.json` vs lock 루트 선언 비교 PowerShell 스크립트(foreach
     dependencies/devDependencies) 실행 → 위 5건 발견한 것으로 추정.
     **이 스크립트의 실제 출력은 어디에도 저장되지 않아 그 결과 자체는
     불명** — 이번 세션이 2026-09-12에 동일 비교를 `node -e`로 독립
     재실행해 같은 5건을 확인했다(위 표).
   - `npm ci` 재실행 → 실패한 것으로 추정(오늘 이 세션이 동일 실패를
     재현함).

   **결론: 지금 `node_modules`는 그 `npm install --legacy-peer-deps`
   1회 실행의 산출물이고, 그 뒤 되돌려진 lock으로는 `npm ci`로 재현할
   방법이 없다. `node_modules`가 지금 지워지면(디스크 정리, 재클론 등)
   복구 경로가 없다.** 이 세션은 `npm ci`를 2회 실행했으나 둘 다
   의존성 해석 단계에서 실패해 `node_modules`를 건드리지 않았다(설치
   전 단계 실패 확인 — `npx jest`/`npx tsc`가 여전히 348/26·0에러로
   통과하는 것으로 재확인, 2026-09-12).

4. **해소 시점**: 폰 복귀 후 재빌드 때 `expo install --fix` + lock
   재생성 + EAS 빌드 + 실기기 검증을 한 벌로 다룬다(재빌드 대기 5종
   미검증 상태로는 네이티브 스택을 건드릴 수 없음).

## Phase 6 1~2단계(생체정보 동의 + 대표사진 등록) 산출 요약 — Phase 6 3단계(메인 세션)가 가져다 쓰는 용도

- **동의 상태의 단일 진실 소스는 `profiles.biometric_consent_at`/
  `biometric_consent_revoked_at`이다.** "현재 동의가 유효한가"는 어디서도
  직접 두 컬럼을 비교하지 말고 `src/utils/biometricConsent.ts`의
  `isBiometricConsentActive(consentAt, revokedAt)`를 불러 써라 — 재동의 시
  `revoked_at`을 `null`로 되돌리는 규칙(문서에 없는 자체 판단,
  `.claude/state/DECISIONS.md` 2026-08-27 항목 참조)이 이 함수 안에만
  있고 다른 곳에 중복돼 있지 않다.
- **`src/store/profileStore.ts`/`src/store/coupleStore.ts`가 대표사진
  경로(`referencePhotoPath`)까지 함께 들고 있다.**
  `setPersonalReferencePhoto(userId, localUri)`(profileStore)/
  `setReferencePhoto(localUri)`(coupleStore, 연결 상태에서만)가 업로드
  + DB 반영 + 로컬 상태 갱신을 한 번에 한다. 실제 업로드는
  `src/services/referencePhotoApi.ts`(`uploadReferencePhoto`,
  `getReferencePhotoSignedUrl`)에 있다 — Storage 경로 규칙은 아래
  참조.
- **⚠️ `019_avatars_storage_policies.sql`을 원격에 적용해야 대표사진
  업로드가 동작한다.** 개인 `{user_id}/reference`, 커플
  `{couple_id}/reference` 규칙으로 경로를 확정했다(015가 미확정으로
  남겨뒀던 부분). 적용 전까지는 `app/(modals)/reference-photo.tsx`의
  저장이 전부 RLS 거부(42501)로 실패한다 — `.claude/state/PROGRESS.md`
  "막힌 것" 참조.
- **화면 C(대표사진 등록)는 이미 완성돼 재사용 가능하다.**
  `src/components/ReferencePhotoSlot.tsx`(프레젠테이션, 개인/커플 공용) +
  `app/(modals)/reference-photo.tsx`(라우팅/스토어 연결). "사진 선택"만
  플레이스홀더다(`src/constants/referencePhotoPlaceholders.ts`) — 실제
  갤러리 연동 시 이 상수 파일의 소스를 `expo-image-picker` 결과로
  바꾸고, `ReferencePhotoSlot`에 넘기는 `onSave` 콜백 인자(로컬 URI)
  타입만 유지하면 나머지(미리보기·업로드·DB 반영)는 그대로 동작한다.
- **`profiles.photo_sync_enabled`/`photo_scan_completed_at`/
  `photo_scan_cursor`는 여전히 전혀 건드리지 않았다.** 피드 탭 안내
  카드(`app/(tabs)/feed.tsx`의 `PhotoSyncPromptCard`)는 생체정보 동의
  상태만으로 두 상태(미동의/동의완료)를 보여준다 — 화면 B(권한)·SDK
  연동 후에는 이 카드를 "동의 완료 → 권한 미허용 → 대표사진 등록
  완료 → 스캔 중"처럼 더 세분화해야 할 것이다.
- **⚠️ 철회 시 로컬 얼굴 데이터 삭제가 구현되지 않았다.** MASTER.md
  "철회 시 반드시 함께 일어나야 하는 일" 3번 — SDK 연동 시
  `revokeBiometricConsent`(`src/store/profileStore.ts`) 안에 온디바이스
  삭제 호출을 반드시 추가할 것. 자동 테스트로 강제할 수 없는 항목이라
  QA 체크리스트에 수동으로 남아 있다(`.claude/state/PROGRESS.md`
  "막힌 것" 참조).
- **(2026-09-02) `src/engine/faceMatch.ts`의 `threshold` 인자는 다섯 번째
  자리표시자였다** — 어느 문서에도 값이 없었고 자리표시자 목록에도 없었다.
  코드는 규칙을 정확히 지켰지만(인자로 받고 하드코딩하지 않음) 그래서
  아무도 추적하지 않았다. **판정 정책은 확정됐다** — MASTER Part 9-4:
  **오탐 회피 우선**, 판정이 애매한 구간은 매칭하지 않는다. 이중 임계값은
  범위 밖(분포 관측 후 Phase 10과 재검토).
  **값은 실기기 캘리브레이션 대기** → `UNRESOLVED('faceMatch.threshold')`.
  SDK 반환값이 유사도인지 거리인지, 정규화 범위가 무엇인지, 실제 커플
  사진에서 어느 대역에 분포하는지가 재빌드 후에만 관측된다. 측정은
  **온디바이스에서 하고 사람이 화면에서 읽어 손으로 기록한다** — 유사도
  로그나 특징 벡터를 서버로 보내면 절대 규칙 1 위반이다. 실기기
  작업이므로 위임 대상이 아니다.
- **법률 문구는 여전히 자리표시자다** — `src/constants/legalDocuments.ts`
  의 `biometric` 항목. 실제 법무 검토 텍스트로 교체 필요(다른 3개
  문서와 동일한 미해결 상태, "여전히 필요한 처리" 5번 항목에 함께
  추적).

## 여전히 필요한 처리 (사람 작업)

### 2026-09-02 추가

- **`docs/` 5종 교체** — MASTER·DESIGN·ROADMAP·SCHEMA·CORNER_CONTENT.
- **`ui-builder_phase6_guard.md` 내용을 `.claude/agents/ui-builder.md`
  끝에 이어 붙이기** — 새 파일이 아니다. Phase 6(생체정보 동의) +
  Phase 10(매거진 제작 탭) 주의사항.
- **마스터 PM 문서 / 프롬프트 엔지니어 인수인계서를 `docs/`에 넣을지 결정**
  — 현재 저장소 밖이라 버전 관리가 안 된다. 마스터 PM 문서는 "새 세션에서
  문서 하나로 복구"가 존재 이유라 특히 그렇다.
- **`018_realtime_publication.sql` 원격 적용 여부 확인** — 로컬 파일 존재와
  원격 적용은 별개다. 아래 1번과 같은 사안이며, 0831 대조 문서가 "다음
  확인 3가지"로 올렸으나 그 문서는 스냅샷이라 갱신되지 않는다.

### 기존

1. **`supabase_realtime` publication에 `messages`(및 필요 시 `stories`)가
   빠져 있다** — 원격 프로젝트에 직접 쿼리(`select * from
   pg_publication_tables where pubname = 'supabase_realtime'`)해 확인함,
   결과 0행. `alter publication supabase_realtime add table
   public.messages;`를 마이그레이션으로 적용해야 상대방 기기가 채팅을
   실시간으로 수신한다(현재는 화면 재진입 시에만 최신화됨). db-architect
   영역 — Phase 5는 읽기 전용 확인만 하고 적용하지 않았다(작업 지시 준수).
2. **`.env`의 `EXPO_PUBLIC_SUPABASE_ANON_KEY`가 플레이스홀더 상태** —
   Supabase 대시보드(Project Settings → API)에서 실제 anon public key를
   복사해 채워야 소셜 로그인/DB 저장 코드가 실제로 동작한다. Phase 3
   코드는 이 값이 채워지는 즉시 동작하도록 전부 작성돼 있다(anon
   key는 클라이언트 노출이 전제인 공개 키라 이 세션이 대신 채워도
   되는지 애매해 손대지 않았다 — 필요하면 다음 턴에 MCP로 조회해
   채워 넣을 수 있다).
3. **Supabase Auth 대시보드에 카카오/구글/애플 OAuth 프로바이더가
   설정돼 있는지 미확인** — `mcp__claude_ai_Supabase__list_projects`/
   `get_project`로는 Auth 프로바이더 설정이 노출되지 않아 이 세션에서
   확인 불가했다. Authentication → Providers에서 3종 활성화 + 각
   프로바이더 개발자 콘솔에 리다이렉트 URI
   (`https://<project-ref>.supabase.co/auth/v1/callback`) 등록 필요.
4. **iOS Dev Build 없음** — Apple 로그인은 iOS 실기기가 있어야 검증
   가능(Apple Developer 계정 대기 중). Android에서는 카카오/구글
   웹 리다이렉트 플로우를 안드로이드 Dev Build로 검증 가능할 수 있다.
5. **(2026-08-25 구현 완료) 017 마이그레이션 원격 미적용** — 화면 6
   약관 동의 UI는 구현 완료(`app/(onboarding)/auth.tsx`,
   `src/components/ConsentChecklist.tsx` 등). 단
   `supabase/migrations/017_profiles_marketing_consent.sql`
   (marketing_agreed_at 컬럼 추가 + terms/privacy_agreed_at
   default now() 제거)을 원격에 아직 push하지 않았다 — 사람이
   `npx supabase db push` 실행 후 `supabase gen types`로
   `src/types/database.ts` 재생성 필요(지금은 수동 패치 상태).
   미적용 상태에서는 marketing_agreed_at upsert가 실패한다.
   상세는 `.claude/state/DECISIONS.md` 2026-08-25 항목 참조.
   약관/개인정보처리방침/AI 활용 고지 **본문은 여전히 자리표시자**다
   (`src/constants/legalDocuments.ts`) — 출시 전 법무 검토 본문으로
   교체 필요. **(2026-08-27 추가)** 같은 파일의 `biometric`(생체정보
   동의) 항목도 동일하게 자리표시자 — 아래 "Phase 6 1단계" 절 참조.
6. **(2026-08-27 구현 완료, 원격 미적용) avatars Storage 버킷 정책** —
   경로 규칙을 개인 `{user_id}/reference` / 커플 `{couple_id}/reference`로
   확정하고 `supabase/migrations/019_avatars_storage_policies.sql`
   작성 완료(`app/(modals)/reference-photo.tsx` 대표사진 등록 화면이
   이 정책에 의존한다). **`npx supabase db push`로 원격 적용 필요** —
   적용 전까지는 대표사진 업로드가 전부 RLS 거부(42501)로 실패한다.
   적용 후 `supabase gen types typescript --linked`로
   `src/types/database.ts` 재생성은 불필요(테이블 컬럼이 아니라
   Storage 정책만 추가했다).
7. **연애 온도 결합 공식이 없다** (`src/engine/temperature.ts`) — Part 9-2
   "선행 프로젝트의 연애 일치율 로직 계승"의 원문이 저장소 어디에도
   없다. 기본값(36.5)·클램프만 구현된 상태. **(2026-08-25 갱신)** Phase
   4는 이미 완료됐다 — 메인 탭은 저장값이 없으면 숫자 대신 대기 문구를
   보여주는 방식으로 이 공식 없이도 구현 가능했다(`app/(tabs)/main.tsx`).
   다만 이 공식 자체는 **일 배치 Edge Function을 실제로 만드는 시점에는
   반드시 확정돼야 한다** — 그 전까지는 연결된 커플도 온도가 계속
   "측정 준비 중"으로만 보인다.
8. **DNA base_score 궁합 공식 + 애니어그램 9×9 매트릭스**
   (`src/engine/dnaScore.ts`) — Part 17-2 가중치 미확정. Phase 3의
   `src/constants/compatibility.ts`(애니어그램 코어 궁합, 화면 7용)와는
   **별개**다 — 그건 1인 상태에서 보는 구조적 참고 자료이고, 이건
   커플 연결 후 빅5·스턴버그·애착까지 결합한 실제 DNA 일치율 계산용.
9. **OVR 포지션 가중치 표 + 연애 포지션 네이밍이 없다**
   (`src/engine/leagueStats.ts`). 현재 6개 스탯 단순 평균.
10. **베이지안 수축(shrinkage) 보정 파라미터가 없다**
   (`src/engine/leagueStats.ts`).
11. **`daily_temperature.engine_version` 컬럼 부재** — db-architect 판단
    필요.
12. **화면 5 "이미지로 저장" 미구현** — `react-native-view-shot` 등 뷰
    캡처 라이브러리가 미설치라 안내 alert만 뜬다. 공유하기(OS 공유
    시트)는 실제로 동작한다.

