# 메인 세션 지시 — `#14` 후속 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/40-main-session-dispatch-followups.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-07
>
> 짝: `40-corner-pipeline-followups.md`

---

**직접 구현하지 않습니다.** `corner-pipeline`에 위임하고 검증합니다.

## 0. 사전 점검

**관문** — 하나라도 다르면 위임하지 않습니다.

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern 'DOC_REVISION: 2026-10-07-r46'
Select-String -Path docs/ONDOLOG_MASTER.md -Pattern '^#### 17-0-8\.'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '40-corner-pipeline-followups'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 — 3단계가 커밋됐다 |
| MASTER r46 / 17-0-8 | 각 한 줄 |
| 위임 파일 | 한 줄 |

**확인** — 기록만 하고 멈추지 않습니다. PM 요청입니다.

```powershell
git ls-files __tests__/functions
```

나온 파일마다 **무엇을 시험하는지, 왜 전용 tsconfig 쪽(`supabase/functions/`)에 두지
않았는지**를 파일을 열어 보고에 적습니다.

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기준선 **0 / 0 / 855 · 45**. 다르면 실측값을 기록하세요.

## 1. 위임

```
아래 문서의 지시를 corner-pipeline 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/40-corner-pipeline-followups.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에, 문서를 읽었음을 아래 세 가지로 먼저 확인해주세요.
1. 범위 넷
2. 저장 스키마에 계산을 두면 안 되는 이유
3. 언제 기다리고 언제 기다리지 않는지
```

## 2. 검증 — 직접 확인

**에이전트 보고를 신뢰 근거로 쓰지 마세요.**

| PM 항목 | 확인 |
|---|---|
| 파생값 | `src/types/corners/`의 저장 스키마에 `transform` 등 계산이 남았는지 **파일을 읽어** 확인. 파생값 단계가 필수인지(`@ts-expect-error` 등) |
| `periodLabel` | 받는 자리가 없고, `period`·`cadence`에서 함수 하나로 만드는지 |
| 대기 | 성공 뒤 재호출은 대기 없음, 전송 실패 뒤만 대기 — 각각 테스트가 있는지 |
| 규칙 F | 테스트 위치, 합성 입력(위반·정상), 저장소 실제 파일 통과 |
| 고친 assertion | 이유가 보고됐는가, diff로 대조 |
| 게이트 | 0 / 0, jest 기준선 대비 감소 없음 |

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}
- 확인 — __tests__/functions: {파일마다 무엇을 시험하는지, 왜 거기 있는지}

## PM 항목
| 항목 | 위치 | 확인 |
|---|---|---|

## 그 밖
- 고친 assertion과 이유: {}
- 게이트: {}
- git status --porcelain: {전문}

## 판단이 필요한 지점
- {있으면}
```

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약·보강
- 문서 편집 — `41-`에서 따로 합니다
- 커밋·푸시
