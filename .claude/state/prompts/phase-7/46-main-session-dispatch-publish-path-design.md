# 메인 세션 지시 — 발행 경로 설계 보고 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/46-main-session-dispatch-publish-path-design.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-09
>
> 짝: `46-corner-pipeline-publish-path-design.md`

---

**직접 설계하지 않습니다.** 위임하고 보고를 검증합니다. **코드가 생기면 안 됩니다.** 커밋하지 않습니다.

## 0. 사전 점검

**관문** — 하나라도 다르면 위임하지 않습니다.

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-09-r51'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-09-r10'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '46-corner-pipeline-publish-path-design'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r51 / ROADMAP r10 | 각 한 줄 |
| 위임 파일 | 한 줄 |

**확인** — 결과를 보고에 적습니다. 위임은 막지 않습니다.

```powershell
Select-String -Path docs/ONDOLOG_SCHEMA.md -Pattern '9-C-7', '9-C-8'
```

**기준선**

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기대 **0 / 0 / 986 · 49**.

## 1. 위임

```
아래 문서의 지시를 corner-pipeline 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/46-corner-pipeline-publish-path-design.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 두 가지를 먼저 확인해주세요.
1. 이번 작업이 어디까지인지
2. 보고할 것 여섯 가지와 확인 하나

확인 후 조사와 설계를 진행하고, 보고한 뒤 멈춰주세요.
```

## 2. 검증

| 확인 | 기대 |
|---|---|
| `git status --porcelain` | **HANDOFF·PROGRESS 외 변경 없음.** 코드·테스트·마이그레이션이 생기면 범위 이탈 |
| 보고 1 | 단계마다 **실패 시 되돌아가는 곳과 남는 것**이 있는가 |
| 보고 2 | "발행 성공"이 **한 줄**로 정의됐는가 |
| 보고 3 | ROADMAP r10 Phase 7 행의 발행 경로 항목이 **빠짐없이** 1의 단계에 붙었는가 — 항목 수를 세어 대조 |
| 보고 4 | 마이그레이션마다 SCHEMA 절이 있는가 |
| 보고 5·6 | 문서에 없는 값을 지어내지 않고 질문으로 올렸는가. 채팅 입력량 상한에 **값이 없고 실측 방법만** 있는가 |
| 17-4 확인 | 첫 턴을 고르는 코드 위치와 테스트 유무가 있는가 |

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X} / 확인(SCHEMA 9-C-7·9-C-8): {} / 기준선: {}

## 범위
- git status --porcelain: {전문}

## 설계 요약
1. 발행 흐름과 상태 전이: {단계 | 실패 시 되돌아가는 곳 | 남는 것}
2. "발행 성공" 정의: {한 줄}
3. 항목 → 단계: {항목 | 단계} — ROADMAP 항목 {N}개 중 {N}개 배치
4. 마이그레이션: {항목 | SCHEMA 절}
5. 사람 작업: {}
6. 문서에 없는 값 (에이전트가 올린 그대로): {}

## 17-4 첫 턴 표기 확인
- {고름 / 안 고름} — 위치: {} / 테스트: {}

## 판단이 필요한 지점
- {있으면}
```

## 하지 말 것

- 직접 설계, 위임 프롬프트 요약·보강
- 구현으로 넘어가는 것
- 실제 DB·외부 API 접속
- 커밋·푸시
