# 메인 세션 위임 프롬프트 — `84-a2` LLM 요청 고치기 (샘플링 값 · prefill · 재요청 · 사고 블록)

> **함께 넣는 파일: 없음** — 정본은 저장소 안 **ROADMAP r131 R131-1~4** · 84-a 위임서 · HANDOFF "84-a" 절. 시작 전에 `DOC_REVISION`이 `r131` 이상인지 확인하고, 아니면 진행 전에 한 줄로 알림(R123-5 · R130-4)
> 보관 경로: `.claude/state/prompts/phase-7/84-a2-dispatch-llm-request-fix.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-11-19 (ROADMAP **r131 R131-1~4** · R124-5 · R124-6 · R125-1 · R112-3 · R119-5 · R121-5)
> 대상: 메인 세션. 방식: R75 — 한 지시서 · 끝에 한 번 보고
> **실제 커플 조건 아님**

---

## 왜

84-b 1차에서 18건이 모두 HTTP 400으로 실패했습니다. 오류 문구는 "`temperature` is deprecated for this model."입니다. 토큰과 비용은 0입니다.
- R131-1: temperature 0.5 결정은 철회합니다.
- 새 모델의 요청 규칙에 맞춰 요청 본문, 재요청, 응답 읽기를 고칩니다.

## 범위 · 허가

- **편집**: 공용 LLM 코드(`supabase/functions/_shared/` 안의 LLM 공급자 · 비용 계산 · 응답 읽기) · 하네스 `scripts/ops/m1QualityRun.ts`와 그 도우미 · 해당 시험 · `.claude/state/HANDOFF.md` · `PROGRESS.md`
- **LLM 호출 0**(실제 API 호출 금지 — 시험은 가짜 fetch로) · 원격 0(**이번 허용 질의: 없음**) · 마이그레이션 0 · 함수 배포 0 · 새 패키지 0 · `web/` 0 · `consent.ts` 0 · `demo_responses` 0 · R34-3 호출 0 · 커밋 0
- 키 · 요청 id · 생성 문장은 파일 · 로그 · 보고에 넣지 않음
- 모델 허용 목록 · 실패 시 닫힘 · 시험 커플 보호 장치 · 길이 상한 · 금지 표현 검사 · `corners.llm_usage` 기록은 **그대로**(84-a)
- 커밋 메시지(R121-5): `fix(engine): 84-a2 <설명>`
- 근거(R119-5): "지금은 이렇다"는 파일:줄과 함께, 없으면 "확인 필요"

## 공식 근거 (PE 확인 · 메인 세션이 다시 확인해 결정 기록에 주소와 함께)

출처: https://platform.claude.com/docs/models/opus-5-5/migration-guide

- Opus 5.5: "Omit `temperature`, `top_p`, and `top_k`."
- Opus 5.5: "Thinking runs on every Claude Opus 5.5 request." `thinking: {"type": "disabled"}`와 `budget_tokens`는 거절됩니다. `thinking` 필드를 아예 보내지 않거나 `{"type": "adaptive"}`를 보냅니다. 기본 effort는 `medium`입니다.
- Opus 5.5: "`max_tokens` remains a hard limit on total output, thinking plus response text." / "Thinking tokens are billed as output tokens even when the thinking text is not returned to you."
- Opus 5.5: "A response can start with one or more `thinking` blocks before the first `text` block." 그래서 블록을 순서가 아니라 `type`으로 골라야 합니다. 생각 내용(`thinking.display`)은 기본이 `"omitted"`라서 빈 값으로 옵니다.
- Sonnet 5 계열: "Manual extended thinking, sampling parameters, and assistant prefill return a 400 error". 생각 기능은 기본으로 켜져 있습니다.
- **확인 필요**: 위 안내는 **Sonnet 5** 기준입니다. **Sonnet 5.5**의 생각 기능 기본값, `max_tokens`에 생각 토큰이 포함되는지, 생각 토큰이 출력으로 청구되는지는 Sonnet 5.5 모델 문서에서 따로 확인해 결정 기록에 적습니다. 문서에서 찾지 못하면 **Opus 5.5와 같다고 보고**(가장 비싼 쪽) "확인 필요"로 표시합니다.

## 할 일

| # | 할 것 | 시험 |
|---|---|---|
| ① | 요청 본문에서 `temperature` · `top_p` · `top_k` · **끝의 assistant prefill** · 수동 사고 값(`budget_tokens` · `disabled`)을 **뺍니다**. `thinking` 필드는 보내지 않습니다(기본 adaptive). **effort도 보내지 않습니다**(기본 medium). effort를 바꿀지는 PM이 정합니다. prefill로 형식을 맞추던 곳이 있으면 시스템 프롬프트 지시와 지금의 형식 검사로 대신합니다 | 두 모델 각각 **요청 본문 고정 시험**: 위 값들과 prefill이 없음을 단언합니다. 허용된 키만 들어 있는지도 확인합니다 |
| ② | 재요청: **400 · 401 · 403 · 404는 다시 보내지 않고 바로 실패**합니다. 429 · 5xx · 시간 초과만 지금 규칙대로 다시 보냅니다 | 상태 코드별로 보낸 횟수를 단언합니다. **기록되는 호출 수(하네스 화면 · summary · review · `llm_usage`) = 실제로 보낸 수**여야 합니다. 84-b 1차의 `calls=3` 대 "호출 1" 차이의 원인을 파일:줄로 적습니다 |
| ③ | review.md 말투 칸을 "**합니다체 밖**"으로 바꿉니다(회차 칸 · 모델별 집계 줄 · 기준 문단 모두). 남은 "해요체" 문구를 검색해 판정 자료 안에서는 0으로 만듭니다 | review 생성 시험 |
| ④-a | 응답에서 **`type === "text"` 블록만** 이어 붙여 읽습니다. 첫 블록이 text라고 가정하지 않습니다. text 블록이 하나도 없으면 형식 오류로 처리합니다(지금 재요청 규칙을 따름) | thinking 블록이 앞에 있는 응답 · thinking만 있는 응답 · text가 여러 개인 응답 |
| ④-b | 생각 토큰이 `usage.output_tokens`에 포함되는지 공식 근거로 확인합니다. `llm_usage`와 CostMeter가 실제 청구와 맞게 계산하도록 고칩니다(따로 세서 두 번 더하지 않게) | 사용량 가짜 응답으로 비용 계산을 단언합니다 |
| ④-c | `max_tokens` 4096: 생각 토큰까지 합친 한도라서 **답이 잘릴 수 있는지** 판단합니다. `stop_reason`이 `max_tokens`이면 지금은 어떻게 처리되는지 파일:줄로 적습니다. 잘린 답은 **형식 오류(빠짐)로, 지면에 싣지 않음**이어야 합니다. 한도를 올리면 값과 근거를 적고 CostMeter 최악값을 다시 계산합니다 | `stop_reason: "max_tokens"` 응답 시험 |
| ⑤ | 결정 기록: 공식 문서 인용 + 주소 | — |

**CostMeter 다시 계산 (④-c에서 한도를 바꾼 경우)**
- 상한은 그대로 둡니다: **1호 $2 · 하네스 명령 1회 $10**.
- 새 `max_tokens`로 계산한 1회 호출 최악값이 Opus 단가(출력 $20 / MTok)에서 얼마인지, 1호(3코너 × 재시도 포함)의 최악값이 $2 안에 들어가는지 표로 보고합니다.
- **최악값 때문에 Opus 실행이 미리 막히면 멈추고 PM에게 보고합니다.** 상한을 올리거나 재시도를 줄이는 것은 PM이 정합니다.

## 84-b 실행 명령

HANDOFF "84-b 실행 명령"을 **84-a2에 맞게 다시 적습니다**. 실행 명령이 1차와 달라졌다면 그 줄만 보고에 적습니다.

## 완료 기준

1. Deno 시험(LLM · 하네스) 통과 · 루트 tsc · jest · PGlite · Python 회귀 0 · `npm run gate` 1회 통과(앱 변경이 없어도 회귀 확인)
2. LLM 호출 0 · 원격 0 · 마이그레이션 0 · 새 패키지 0
3. 위생 0 · 결정 기록(출처: R131-1~4 · 공식 문서 주소)

## 보고 (끝에 한 번)

1. 멈춘 것
2. ①~④ 표: 지금(파일:줄) → 고친 것 · 시험 이름
3. 공식 근거 표: Opus 5.5 / Sonnet 5.5 × (샘플링 값 · prefill · 생각 기본 · max_tokens 포함 · 출력 청구) — 각각 확인함 / 확인 필요
4. `max_tokens` 판단 · CostMeter 최악값 표(바꿨다면)
5. `calls=3` 대 "호출 1" 원인 한 줄
6. 84-b 실행 명령이 바뀐 줄(없으면 "그대로")
7. 커밋 명령 — 파일 이름 하나씩 `git add` · 끝에 "`git log --oneline -4` → docs: ROADMAP r131 줄 확인" · "`git status --short` → 비어 있으면 끝 · 남으면 그 목록만 PE에게"
8. 폰 확인: 없음
