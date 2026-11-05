# 메인 세션 지시 — `72c-` 확인 요청 시간 제한 · 헤더 시험 · Python 측정 래퍼 · 상태 확인 한 번

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/72c-main-session-dispatch-probe-timeout.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-11-05
>
> 짝: `72c-ui-builder-probe-timeout.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 커밋하지 않습니다. **마이그레이션 · 원격 쓰기 · 새 의존성 · 설정 파일 변경은 모두 0입니다.** 원격에는 Proteur가 상태 확인 GET을 한 번 보냅니다(§2). 메인 세션은 보내지 않습니다.

## 0. 사전 점검

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-11-05-r59'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '72c-'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력(`72b-` 커밋 완료) |
| ROADMAP r59 | 한 줄(R47-3). **없으면 멈춥니다** |
| 위임 파일 | 두 줄 이상 |

**남은 프로세스(전)** — `72-` §0-1과 같은 세 줄로 셉니다.

**기준선**: tsc 0 / 0, jest(`72b-` 커밋 뒤 값 — **요약 줄 그대로** 적습니다), Python 277. 출력 전체를 `scripts/ops/out/72c-*-pre.txt`에 남깁니다. 다르면 실패한 시험 이름과 마지막 40줄을 보고하고 한 번 다시 돌립니다(R43-8).

## 1. 위임

ui-builder에게 두 가지를 넘깁니다: `72b-` scratchpad 래퍼의 경로, 그리고 `72b-` 2회차 상위 10개 표(R59-4 기준 기록).

```
아래 문서의 지시를 ui-builder 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/72c-ui-builder-probe-timeout.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 그 파일이 지시의 전부입니다.
72b- 측정 래퍼 경로: {scratchpad 경로}
R59-4 기준 기록(72b- 2회차): 전체 347.2초 · 상위 10개 {표}

착수 전에 확인해주세요.
1. 8초 제한은 확인 요청에만(AbortController), fetch 감싸기는 그대로, 화면이 사라질 때 진행 중 요청 취소
2. 헤더 시험은 supabase.ts가 실제로 등록한 함수를 불러서 — 경로·GET·헤더 0·본문 0·signal
3. 시간 초과 시험은 가짜 타이머로 8초 취소 → 띠 유지 → 15초 뒤 재시도
4. 래퍼는 scripts/ops/에 표준 라이브러리만, 결과는 scripts/ops/out/, 시험 판정은 바꾸지 않음
5. 새 의존성·설정·마이그레이션·원격 0, 정적 검사 시험 0

멈춤 조건에 걸리면 고치지 말고 그 지점에서 보고해주세요.
끝나면 게이트(tsc 둘, jest, Python)를 직접 돌려 보고에 넣어주세요. jest는 요약 줄 그대로.
```

## 2. 사람 확인 — 상태 확인 GET 한 번 (Proteur가 실행)

Proteur에게 **PowerShell 한 줄**을 줍니다. 조건은 이렇습니다.

- 주소는 **환경 변수 `ONDOLOG_SUPABASE_URL`**에서 읽고, 화면에 내지 않습니다
- 경로는 `/auth/v1/health`, 메서드는 GET, **헤더 0**(키 · 토큰 0), 본문 0
- 출력은 **상태 코드 숫자 하나만**입니다. 주소 · ref · 본문 · 헤더는 출력하지 않습니다
- Windows PowerShell 5.1에서 4xx 응답은 예외로 던져지므로, **예외 안의 응답에서 상태 코드를 꺼내도록** 씁니다. 응답 자체가 없는 연결 오류일 때만 `NO_RESPONSE`처럼 숫자가 아닌 한 단어를 냅니다
- 시간 제한은 10초 정도로 둡니다

**판정**
- 숫자(401이든 200이든)가 나오면: 띠 설계의 전제가 맞습니다
- `NO_RESPONSE`면: **`51-`로 가지 않고** PM에게 올립니다. 보고에 그대로 적습니다

## 3. Python 측정 (R59-4)

ui-builder가 옮긴 래퍼로 **한 번** 잽니다(위임 작업이 끝난 뒤). R59-4 기준으로 판정합니다.
- 상위 10개 중 한 시험이 기준 기록(`72b-` 2회차)의 **2배 초과**인가
- 전체가 347.2초의 **1.5배(520.8초) 초과**인가

둘 다 아니면 "재측정 불필요"입니다. 하나라도 맞으면 그 사실만 보고합니다(렌더러 수정 0).

## 4. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- package.json package-lock.json app.json tsconfig.json babel.config.js supabase docs render src/services/connectionMonitor.ts
git ls-files --others --exclude-standard
```

- 셋째: **빈 출력**. `connectionMonitor.ts`(`fetch` 감싸기)도 바뀌지 않아야 합니다
- 넷째: 새 파일은 래퍼(`scripts/ops/…`)와 시험 파일뿐이어야 합니다

| 확인 | 기대 |
|---|---|
| ① | `AbortController`가 확인 요청에만 · 8초 · 정리 때 `abort()` + 타이머 해제 · 진행 중 건너뛰기 유지 |
| ② | 헤더 시험이 **등록된 실제 함수**를 부르는지(같은 함수를 시험 안에서 새로 만들지 않는지) · 경로 · GET · 헤더 0 · 본문 0 · `signal` · 8초 취소 · 15초 뒤 재시도 · 정리 때 취소 |
| ③ | 래퍼가 표준 라이브러리만 쓰는지 · 시험 판정을 바꾸지 않는지(전체 277 OK를 그대로 내는지) · 결과가 `scripts/ops/out/`에만 쓰이는지 |
| HANDOFF | 래퍼 실행 명령 한 줄 + R59-4 기준 기록 표 |
| 게이트 | tsc 0 / 0 · jest 기준선 + 새 시험 · 실패 0 · Python 277 — **메인 세션이 직접 다시 돌립니다.** 출력 전체를 `scripts/ops/out/72c-*.txt`에 남깁니다 |
| 남은 프로세스 | 후 = 전 |

## 5. 보고

```
## 사전 점검
- 관문: {} / 기준선 jest 요약 줄(그대로): {} / 남은 프로세스(전): {}

## 산출
1. ① 시간 제한: {파일·줄 · 정리 방식}
2. ② 새 시험: {목록 · 수}
3. ③ 래퍼: {경로 · 실행 명령}
4. 내부 결정: {}

## 사람 확인 (Proteur)
- 준 명령: {한 줄}
- 결과: {숫자 / NO_RESPONSE}

## Python (래퍼 1회)
- 전체: {}초 · 277 {OK}
- 상위 10개: {표}
- R59-4 판정: {재측정 불필요 / 해당 항목}

## 변경
- git diff --stat: {} / 설정·의존성·마이그레이션·원격 쓰기·fetch 감싸기: {0}

## 게이트 (메인 세션 재실행)
- tsc: {} / tsc(functions): {} / Python: {}
- jest 요약 줄 (그대로, 두 줄):
  Test Suites: …
  Tests: …
- 남은 프로세스(후): {}

## git status --porcelain
- {전문}

## 판단이 필요한 지점
- {있으면}
```

**jest 요약 두 줄과 `git status`는 줄이 잘리지 않게 그대로 붙입니다.** 보고가 길면 산출 쪽을 줄이고, 이 둘은 줄이지 않습니다. **여기서 멈춥니다.**

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약 · 보강
- 메인 세션이 원격에 요청을 보내는 것(상태 확인은 Proteur가)
- `fetch` 감싸기(`connectionMonitor.ts`) 변경 · 다른 요청에 시간 제한
- 새 의존성 · 설정 파일 · 마이그레이션 · 렌더러 수정
- 키 · 토큰 · URL · 프로젝트 ref를 화면 · 파일 · 로그 · 보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋 · 푸시
