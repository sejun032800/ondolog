# 메인 세션 지시 — U2 피드·업로드 위임

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/56-main-session-dispatch-u2-feed-upload.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-24
>
> 짝: `56-ui-builder-u2-feed-upload.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 원격 **개발** DB·스토리지에는 씁니다(R13-7). 새 의존성·마이그레이션 없음. 커밋하지 않습니다.

## 0. 사전 점검

**관문** — 하나라도 다르면 위임하지 않습니다.

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-24-r67'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-24-r29'
git ls-files render/compose.py
Select-String -Path package.json -Pattern '"expo-image-picker"'
Select-String -Path .env -Pattern '^EXPO_PUBLIC_SUPABASE_ANON_KEY=.+' -Quiet
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '56-ui-builder-u2-feed-upload'
[bool]$env:ONDOLOG_SUPABASE_URL
[bool]$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r67 / ROADMAP r29 | 각 한 줄 |
| `render/compose.py` | 한 줄 — `55-2`가 커밋됐다 |
| `expo-image-picker` | 한 줄 — 이미 의존성에 있다. 없으면 멈추고 보고합니다(이번에 의존성 추가 허가 없음) |
| anon key | `True`. **값은 출력하지 않습니다.** `False`면 멈추고 보고합니다 — B의 사용자 권한 조회(완료 기준 2)에 필요합니다(M0-3 사람 작업) |
| 위임 파일 | 한 줄 |
| 환경변수 둘 | 각 `True`. **값은 출력하지 않습니다** |

**기준선**

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

기대 **0 / 0 / 1098 · 55**. Python 시험은 `55-1`이 쓴 명령(HANDOFF "렌더 배관 (55-1)" 절)으로 돌려 **122건**. 다르면 위임하지 말고 실제 숫자를 보고합니다.

## 1. 위임

```
아래 문서의 지시를 ui-builder 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/56-ui-builder-u2-feed-upload.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 이 메시지에는 요약이
없습니다. 그 파일이 지시의 전부입니다.

착수 전에 아래 네 가지를 먼저 확인해주세요.
1. 기록 규칙 1~8, 특히 규칙 4(사진을 stop에 붙이는 결정론)와 규칙 6(커플 행이 없으면 멈춤)
2. 앱이 지어내지 않는 값 (title·narrative·is_new_region, 그리고 규칙에 없는 arrived_at·region의 처리)
3. 상대의 기록은 읽기만, RLS 그대로
4. 색·서체 확인 항목 넷과 새 의존성·마이그레이션 없음

멈춤 조건에 걸리면 고치지 말고 그 지점에서 보고해주세요.
끝나면 게이트(tsc 둘, jest, Python)를 직접 돌려 보고에 넣어주세요.
```

## 2. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- supabase render docs package.json package-lock.json tsconfig.json app.json eas.json babel.config.js
```

- 셋째 명령은 **빈 출력**이어야 합니다 — 의존성·마이그레이션·렌더·설정이 그대로여야 합니다

**키 누출 확인** — 리터럴 검색입니다. 출력이 비어 있어야 합니다.

```powershell
Get-ChildItem src, app, scripts, __tests__, .claude/state -Recurse -File | Select-String -SimpleMatch -Pattern $env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY
Get-ChildItem src, app -Recurse -File | Select-String -SimpleMatch -Pattern 'ONDOLOG_SUPABASE_SERVICE_ROLE_KEY'
```

| 확인 | 기대 |
|---|---|
| 항목 0 | 그레인이 새 화면 공통 틀에만, 128pt. 비활성 버튼·ListRow 글자가 `textFaint`. `lilacText` 토큰이 더해지고 참여 대기 칩이 그것을 쓰는가 |
| 화면 | E01·E03·E11·E10·E15·E13 파일과 원본 보드가 보고됐는가. E03은 `app/date/[id]/index.tsx` 푸시 화면, E11은 `(modals)` 시트인가 |
| 피드 머리 | "데이트 N"이고 "✦ 별 N"이 없는가. 지도형 토글이 숨겨졌는가 |
| 규칙 1·2·4 | `source='manual'`·`user_confirmed=true`. 날짜 기본값·사진 배치의 결정론 시험이 있는가 |
| 규칙 3 | 원본 크기를 줄이지 않는가. `thumb_path`를 비우는가. `width`/`height`/`captured_at` 쿼리 출력이 붙었는가 |
| 규칙 6 | 커플 행 유무의 근거(파일·행). 없으면 커플을 만들지 않고 멈췄는가 — E13 기록 버튼 비활성 |
| 규칙 7 | 파생 칸 셋을 맞추는가. `title`·`narrative`·`is_new_region`을 쓰는 코드가 없는가 |
| 규칙 밖 두 칸 | `arrived_at` 처리 규칙이 보고됐고 화면에 지어낸 시각이 보이지 않는가. `region`을 채우지 않는가 |
| 삭제 | 본인 것만 지울 수 있는가. 지운 뒤 파생 칸이 맞는가 |
| RLS | B의 조회가 B의 사용자 권한으로 이뤄졌는가(service_role 아님) |
| 색·서체 | 보고된 명령을 **메인 세션이 다시 돌려** 하드코딩 색 0 · `fontWeight` 0 · `textFaint`는 비활성 컨트롤에만 · `lilac` 12pt 이하 0 |
| 모션 | 블러·카운트업·진행률 채움·스피너 없음 |
| 게이트 | tsc 0 / 0, jest 전부 통과, Python 122 — **메인 세션이 직접 다시 돌립니다** |

## 3. 보고

```
## 사전 점검
- 관문: {각 O/X} / 기준선: {}

## 산출
1. 항목 0~7: {파일·원본 보드}
2. 원격 실증 (출력 그대로): {A 기록 / B 조회(B 권한) / 사진 width·height·captured_at 쿼리}
3. 규칙 2·4 결정론 시험: {} / arrived_at·region 처리: {}
4. 규칙 6: {커플 행 있음 — 근거 / 없음 — 멈춤, E13 버튼 비활성}
5. 규칙 5 — E15 장소별 메모 칸: {있음 / 없음}
6. 색·서체 확인: {명령과 출력}
7. 51- 확인 목록에 더할 것: {}
8. 시험 데이터·내부 결정: {}

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

- 직접 구현, 위임 프롬프트 요약·보강
- 새 의존성, 마이그레이션, 허가 밖 설정 변경
- 키 값을 화면·파일·로그·보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋·푸시
