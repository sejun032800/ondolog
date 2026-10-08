# 메인 세션 지시 — 입력 조립 1부 위임 (설계 보고까지)

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/43-main-session-dispatch-input-design.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-08
>
> 짝: `43-corner-pipeline-input-assembly-design.md`

---

**직접 설계하지 않습니다.** 위임하고 보고를 검증합니다. **코드가 생기면 안 됩니다.**
`42-`가 커밋된 뒤에 돌립니다.

## 0. 사전 점검

**관문**

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-07-r47'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-07-r6'
git ls-files .claude/state/archive | Select-String -Pattern 'handoff-20261008'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '43-corner-pipeline-input-assembly-design'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r47 / ROADMAP r6 | 각 한 줄 |
| `#14` 아카이브 | 한 줄 — `42-`가 커밋됐다 |
| 위임 파일 | 한 줄 |

기준선을 기록합니다.

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

## 1. 위임

```
아래 문서의 지시를 corner-pipeline 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/43-corner-pipeline-input-assembly-design.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 두 가지를 먼저 확인해주세요.
1. 이번 작업이 어디까지인지
2. 입력 계약의 원본이 어디인지

확인 후 조사와 설계를 진행하고, 보고한 뒤 멈춰주세요.
```

## 2. 검증

| 확인 | 기대 |
|---|---|
| `git status --porcelain` | **HANDOFF·PROGRESS 외 변경 없음** — 코드가 생기면 범위 이탈 |
| PM 요구 넷 | 각각에 답과 증명 방법이 있는가 |
| 4번(조회 단계의 커플 보장) | 보장 방법과 시험 방법이 **구체적으로** 있는가 |
| 문서에 없는 값 | 지어내지 않고 질문으로 올렸는가 |

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}

## 범위
- git status --porcelain: {전문}

## 설계 요약 — PM 요구별
| 요구 | 설계 | 증명 방법 |
|---|---|---|

## 질문 (에이전트가 올린 그대로)
- {}

## 판단이 필요한 지점
- {있으면}
```

## 하지 말 것

- 직접 설계, 위임 프롬프트 요약·보강
- 구현으로 넘어가는 것
- 커밋·푸시
