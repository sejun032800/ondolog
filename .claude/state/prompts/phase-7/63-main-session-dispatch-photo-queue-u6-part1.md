# 메인 세션 지시 — 사진 영속 큐 + U6 온보딩 1부 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/63-main-session-dispatch-photo-queue-u6-part1.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-25
>
> 짝: `63-ui-builder-photo-queue-u6-part1.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 새 의존성 · 마이그레이션 없음. 커밋하지 않습니다. Deno를 쓰면 `--no-lock`.

## 0. 사전 점검

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-25-r69'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-25-r37'
Select-String -Path package.json -Pattern '"expo-file-system"'
Select-String -Path package.json -Pattern '"@react-native-async-storage/async-storage"'
git ls-files scripts/ops/verifyU4Chat.ts
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '63-ui-builder-photo-queue-u6-part1'
[bool]$env:ONDOLOG_SUPABASE_URL
[bool]$env:ONDOLOG_SUPABASE_ANON_KEY
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r69 / ROADMAP r37 | 각 한 줄 |
| `expo-file-system` | 한 줄이면 §0 a 진행. **빈 출력이면 위임은 하되 §0 a는 하지 않게 하고, 보고 첫 줄에 적습니다**(설정 파일 허가는 사람이 따로 정합니다) |
| AsyncStorage | 한 줄 |
| `verifyU4Chat.ts` | 한 줄 — `62-`가 커밋됐다 |
| 위임 파일 | 한 줄 |
| 환경변수 둘 | 각 `True`. **값은 출력하지 않습니다** |

**기준선**: tsc 0 / 0, jest **1404 · 71**, Python **122**. 다르면 위임하지 말고 실제 숫자를 보고합니다.

## 1. 위임

```
아래 문서의 지시를 ui-builder 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/63-ui-builder-photo-queue-u6-part1.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 다섯 가지를 먼저 확인해주세요.
1. §0(사진 큐·메우기·코드 복사)을 가장 먼저 하고 다른 변경과 섞지 않음 — 사람이 따로 먼저 커밋한다
2. expo-file-system 사전 점검 결과: {한 줄 있음 / 없음 — 없으면 §0 a는 하지 않음}
3. 동의 → 로그인 순서를 기존 라우트에서 먼저 읽고, 고치기 전 순서를 보고에 남김
4. 로그인 전 답은 메모리에만, 동의+로그인 전 서버 호출 0건
5. 동의·약관 문장을 새로 쓰지 않음, 새 의존성·마이그레이션 없음, 정적 검사 시험을 만들지 않음

멈춤 조건에 걸리면 고치지 말고 그 지점에서 보고해주세요.
끝나면 게이트(tsc 둘, jest, Python)를 직접 돌려 보고에 넣어주세요.
```

2번의 `{…}`는 사전 점검 결과로 **채워서** 보냅니다.

## 2. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- supabase render docs package.json package-lock.json app.json eas.json babel.config.js
Get-ChildItem src, app -Recurse -File | Select-String -SimpleMatch -Pattern 'ONDOLOG_SUPABASE_SERVICE_ROLE_KEY'
```

- 셋째 · 넷째 명령은 **빈 출력**이어야 합니다

| 확인 | 기대 |
|---|---|
| §0 묶음 | 다른 변경과 **따로** 보고됐는가. 파일 목록이 §1과 겹치지 않는가 |
| §0 a | 복사본 → 큐 항목 → 성공 시 둘 다 삭제. 재시작 뒤 이어 보내기. Storage 경로가 클라이언트 id에서 정해지고, "이미 있음"을 성공으로 보는가. 행 중복 방지 방식 |
| §0 b | `SUBSCRIBED` · 재연결 · AppState `active` 세 곳에서 메우는가(이미 있었으면 위치) |
| §0 c | 코드 글자 `selectable`, 새 의존성 없음 |
| 규칙 10 | 고치기 전 실제 순서(파일 · 줄)가 보고됐는가. 동의 없이 로그인 화면에 갈 수 없는가 |
| 규칙 11 | 온보딩 답이 AsyncStorage에 쓰이지 않는가. 로그인 전 서버 호출 0건 시험이 있는가 |
| 규칙 12 | 기존 저장 경로를 썼는가. 저장 실패 시 넘어가지 않는가 |
| 문장 | 약관 · 동의 문장이 바뀌지 않았는가 — 그 문장이 들어 있는 파일의 diff를 직접 봅니다 |
| A07 | 연애유형 엔진 코드 diff 없음 |
| A11 | 숨긴 버튼이 보고됐는가 |
| 원격 실증 | 사진 큐 객체 1 · 행 1(두 번 다시 보내도), 새 시험 계정 동의 시각이 저장 뒤에만. **사용자 권한**, 출력에 키 · 토큰 · URL 없음 |
| 정적 검사 시험 | 색 · 서체 · 문자열을 코드에서 찾는 시험이 새로 생기지 않았는가(R32-3) |
| 색 · 서체 | 보고된 명령을 **메인 세션이 다시 돌려** `56-`과 같은 네 항목 확인 |
| 게이트 | tsc 0 / 0, jest 전부 통과, Python 122 — **메인 세션이 직접 다시 돌립니다** |

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X} / expo-file-system: {있음 / 없음} / 기준선: {}

## §0 채팅 마무리 (따로 커밋할 묶음)
- 파일 목록: {}
- a / a-중복 방식 / b(새로 / 이미 있음 — 위치) / c: {}

## U6 온보딩 1부
1. 항목 1~13: {파일·원본 보드}
2. 규칙 10 — 고치기 전 순서: {파일·줄} / 바꾼 것: {}
3. 규칙 12 — 저장 경로: {} / 이미 동의한 계정 재로그인: {코드가 하는 그대로}
4. 원격 실증 (출력 그대로): {사진 큐 / 새 시험 계정 동의 시각}
5. 숨긴 버튼 · 넣지 않은 문장: {}
6. 로그인 뒤 기존 화면 · 남은 옛 테마: {}
7. 색·서체 확인: {명령과 출력}
8. 51- 확인 목록 (최종 개수): {}
9. 내부 결정: {}

## 변경
- git diff --stat: {}
- 기존 시험 변경: {없음 / 파일·줄·이전 → 이후}
- 금지 대상 변경: {없음 / 있음 — 내용}
- 키 누출 확인: {빈 출력 O / X}

## 게이트 (메인 세션 재실행)
- tsc: {} / tsc(functions): {} / Python: {}
- jest 마지막 요약 줄 (그대로):
{Test Suites: … / Tests: …}

## git status --porcelain
- {전문}

## 판단이 필요한 지점 (제품 사실·범위·순서·외부 의존만)
- {있으면}
```

**보고는 줄이 잘리지 않게 씁니다.** 표가 넓으면 목록으로 바꿉니다.

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약 · 보강
- 새 의존성, 마이그레이션, 허가 밖 설정 변경
- 키 값을 화면 · 파일 · 로그 · 보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋 · 푸시
