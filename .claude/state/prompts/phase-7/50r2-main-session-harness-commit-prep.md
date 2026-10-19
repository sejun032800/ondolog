# 메인 세션 작업 — `50-` 하네스 커밋 준비 (r2)

> 대상: 클로드 코드 메인 세션 (직접 수행, 위임 없음)
> 보관 경로: `.claude/state/prompts/phase-7/50r2-main-session-harness-commit-prep.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-19
> 기준선: MASTER r58 · ROADMAP r16 · jest 986 · 49

---

## 목표 (PM)

`50-` 하네스를 **게이트를 통과한 상태로** 커밋할 수 있게 한다. (ROADMAP r16 R16-3·R16-4·R16-5)

## 0. 사전 점검

**관문**

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-19-r58'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-19-r16'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | **`50-`의 미커밋 변경만** — `.gitignore`, `scripts/ops/`, `supabase/functions/deno.json`, HANDOFF, PROGRESS. 그 밖의 변경이 있으면 멈추고 보고 |
| MASTER r58 / ROADMAP r16 | 각 한 줄 |

## 1. 루트 tsc에서 `scripts/ops` 빼기 — 1회 허가 (R16-3)

**대상: 루트 `tsconfig.json`의 `exclude`에 `"scripts/ops"` 한 항목 추가. 그 밖은 바꾸지 않습니다.** Node로 읽고 씁니다.
Deno 코드는 `supabase/functions/tsconfig.json` 쪽이 봅니다 — `supabase/functions`를 이미 뺀 것과 같은 이유입니다.

## 2. 출력 잘림 기록 (R16-4)

**`stop_reason`이 `max_tokens`이면 재시도하지 않고 판정 자료로 기록합니다.** `maxTokens`는 4096 그대로입니다.

- 하네스에 이미 있으면 그대로 두고 위치를 보고합니다
- 없으면 **이 한 가지만** 하네스(`scripts/ops/`)에 추가합니다
- **골격(`supabase/functions/_shared/`)을 고쳐야만 되는 경우**(예: 골격 안의 재시도를 막아야 하는 경우)에는 고치지 말고 그 지점을 보고합니다

## 3. 데이터셋 (R16-5)

PM이 해석을 승인했습니다. **바꾸지 않습니다.**

## 4. 게이트

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기대 **0 / 0 / 986 · 49**.

## 하지 말 것

- 위 1·2 밖의 변경. 특히 `supabase/functions/_shared/`, 프롬프트·스키마, `app_config`
- 실제 API 호출
- 커밋·푸시 — 사람이 합니다

## 완료 후

- `PROGRESS.md` 제목 바로 아래에 한 줄
- 2에서 정한 것이 있으면 HANDOFF에 한 줄 (끝에 붙이지 말고 "열린 항목"이나 새 섹션에)

## 보고

```
## 사전 점검
- 관문: {각 O/X}

## 1. tsconfig
- diff: {전문}

## 2. 잘림 기록
- {이미 있음 — 위치 / 추가함 — 위치 / 골격 수정이 필요해 멈춤 — 지점}

## 게이트
- {tsc / tsc(functions) / jest}

## git status --porcelain
- {전문}

## 판단이 필요한 지점 (제품 사실·범위·순서·외부 의존만)
- {있으면}
```
