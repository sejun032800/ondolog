/**
 * LLM 요청의 벤더 중립 모양 (docs/ONDOLOG_MASTER.md Part 17-0-5-F, `#14` 1부 B-3).
 *
 * 코너는 프롬프트를 **블록 배열**로 만들고, 캐시해도 되는 지점에 `cacheBreakpoint`를 표시한다.
 * 그 표시를 전송 형식(`cache_control` 등)으로 옮기는 것은 `llmClient.ts` **한 곳뿐**이다 - 코너는
 * 전송 형식의 이름도, SDK·엔드포인트도 모른다(규칙 C, 17-0-5-C의 층 분리).
 *
 * 타입만 둔다. 실행 코드가 없으므로 이 파일은 어떤 규칙의 대상도 새로 만들지 않는다.
 */

/**
 * 프롬프트 한 덩어리. `cacheBreakpoint: true`는 "여기까지(이 블록 포함, 앞의 모든 블록 포함)를
 * 캐시해도 된다"는 표시다. 입력 레코드처럼 요청마다 달라지는 내용은 이 표시보다 **뒤**에 둔다.
 */
export interface PromptBlock {
  readonly text: string
  readonly cacheBreakpoint?: true
}

/**
 * - `system`: 역할·원칙·출력 형식 - 코너가 같으면 요청마다 같은 정적 부분.
 * - `user`: 조립된 입력 - 요청마다 달라지는 가변 부분.
 */
export interface LlmRequest {
  readonly system: readonly PromptBlock[]
  readonly user: readonly PromptBlock[]
}
