// 외부 모듈은 any로 취급된다 — URL·npm: import 호출부의 타입 오류는 tsc가 못 잡는다.
// 우리 쪽 코드(브랜드 타입 포함)는 그대로 검사되므로 17-0-2는 성립한다.
// LLM 호출은 supabase/functions/_shared/llmClient.ts 한 곳으로만 통과하므로
// (규칙 C) 그 오류는 런타임에서 그 지점에 한정되어 드러난다.
declare module "https://*";
declare module "npm:*";
declare const Deno: any;
