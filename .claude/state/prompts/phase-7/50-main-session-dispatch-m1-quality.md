# 메인 세션 지시 — M1 품질 실측 하네스 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/50-main-session-dispatch-m1-quality.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-19
>
> 짝: `50-corner-pipeline-m1-quality-harness.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 커밋하지 않습니다. `49-`가 커밋된 뒤에 돌립니다.

## 0. 사전 점검

**관문** — 하나라도 다르면 위임하지 않습니다.

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-19-r58'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-19-r15'
Select-String -Path package.json -Pattern '"test-renderer"'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '50-corner-pipeline-m1-quality-harness'
deno --version
[bool]$env:ONDOLOG_LLM_API_KEY
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r58 / ROADMAP r15 | 각 한 줄 |
| `test-renderer` | 한 줄 — `49-`가 커밋됐다 |
| 위임 파일 | 한 줄 |
| `deno --version` | 버전 출력 (사람 작업 M1-1) |
| `[bool]$env:ONDOLOG_LLM_API_KEY` | `True` (사람 작업 M1-1). **키 값 자체는 출력하지 않습니다** |

**비밀값 이름은 `ONDOLOG_LLM_API_KEY`입니다 (MASTER r58 §17-0-10-H).** `ANTHROPIC_API_KEY`는 쓰지 않습니다 — 그 이름이 있으면 Claude Code가 구독 로그인 대신 그 키로 인증합니다.

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

.claude/state/prompts/phase-7/50-corner-pipeline-m1-quality-harness.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 두 가지를 먼저 확인해주세요.
1. 이번 결과물과 고치면 안 되는 것
2. API 키를 다루는 규칙

골격이나 코너 코드를 고쳐야만 돌아가면 고치지 말고 그 지점에서 보고해주세요.
```

## 2. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- supabase/functions/_shared src docs supabase/migrations package.json package-lock.json tsconfig.json supabase/functions/tsconfig.json
```

- 마지막 명령은 **빈 출력**이어야 합니다 — 골격·코너·프롬프트·스키마·설정이 그대로여야 합니다
- 바뀐 것은 `supabase/functions/deno.json`(새 파일), `scripts/ops/` 아래(산출물 제외), `.gitignore` 한 줄, HANDOFF·PROGRESS뿐이어야 합니다
- `scripts/ops/out/`이 `git status`에 나오지 않아야 합니다 (`.gitignore`)

**API 키 누출 확인** — 출력이 비어 있어야 합니다. 키 값은 화면에 내지 않습니다.

```powershell
Get-ChildItem scripts/ops, supabase/functions/deno.json -Recurse -File | Select-String -SimpleMatch -Pattern $env:ONDOLOG_LLM_API_KEY
Get-ChildItem scripts/ops, supabase/functions/deno.json -Recurse -File | Select-String -Pattern 'sk-ant-'
```

| 확인 | 기대 |
|---|---|
| `deno.json` | zod `4.6.7`(supabase-js를 넣었다면 `2.118.0`), **범위 기호 없음**. 다른 항목도 `package-lock.json`에 실제로 설치된 버전과 같은가 |
| 데이터셋 | 보통·다정·다툼·대화 거의 없는 날이 모두 있는가. 데이트 3~4건(정거장·사진 메타·메모 있음/없음), 재소환 후보 1건 |
| 실행 | 2모델 × 3코너 × 3회. 실행마다 원문·검증 결과·content·사용량·지연이 저장됐는가 |
| `review.md` | 지면 문장과 원문이 나란히 있는가. 끝에 3-7 판단 기준 체크리스트가 있고 판정 칸이 비어 있는가 |
| 게이트 | 0 / 0, jest 986 대비 감소 없음 |

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}

## 결과물
- review.md: {경로}
- 모델 ID: {Sonnet ID / Opus ID} — 확인한 문서: {주소}
- deno.json 항목: {이름 버전}

## 실행 표
| 모델 | 코너 | 회차 | 결과 (성공 / 실패 사유) |
|---|---|---|---|

## 토큰·비용
- 한 달치 입력 토큰 총량: {}
- 코너별 분포: {}
- 코너별 비용 추정 / §6-7 대비: {}

## 변경
- git status --porcelain: {전문}
- 보호 경로 변경: {없음 / 있음}
- 키 누출 확인: {빈 출력 O / X}

## 게이트
- {}

## 판단이 필요한 지점 (제품 사실·범위·순서·외부 의존만)
- {있으면}
```

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약·보강
- API 키 값을 화면·파일·보고에 내는 것
- 에이전트가 멈춘 지점을 이어서 고치게 하는 것
- 커밋·푸시
