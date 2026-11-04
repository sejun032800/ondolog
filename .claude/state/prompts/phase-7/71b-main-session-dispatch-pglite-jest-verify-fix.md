# 메인 세션 지시 — `71b-` PGlite 배치 시험을 저장소로 · `verifyPurge68` 기대값

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/71b-main-session-dispatch-pglite-jest-verify-fix.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-11-04
>
> 짝: `71b-db-architect-pglite-jest-verify-fix.md`

---

**직접 구현하지 않습니다.** 위임하고 검증합니다. 커밋하지 않습니다. **원격 접속 0**(쓰기도 읽기도 하지 않습니다). 순서는 셋입니다.

- **A (지금)**: 사전 점검 → PGlite 버전 확인 → Proteur에게 설치 명령 한 줄 → **멈춥니다.**
- **Proteur**: 설치 → 확인 → 의존성 커밋 → "설치했다"고 알립니다.
- **B (그 뒤)**: 위임 → 검증 → 보고 → **멈춥니다.**

---

# A — 설치 명령 만들기

## 0. 사전 점검

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-11-04-r55'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '71b-'
Select-String -Path package.json -SimpleMatch -Pattern '@electric-sql/pglite'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력. 타입 재생성(R55-4) 커밋이 아직이면 `src/types/database.ts` 한 줄이 보일 수 있습니다. 그 경우 그 파일만 보고에 적고 진행합니다 |
| ROADMAP r55 | 한 줄(R47-3). **없으면 멈춥니다** |
| 위임 파일 | 두 줄 |
| PGlite | 빈 출력(아직 설치 전) |

**기준선**: tsc 0 / 0, jest **1686 · 95**, Python **277**. 출력 전체를 `scripts/ops/out/71b-*-pre.txt`에 남깁니다. 다르면 실패한 시험 이름과 마지막 40줄을 보고하고 한 번 다시 돌립니다(R43-8).

## 1. 버전 확인

```powershell
npm view @electric-sql/pglite dist-tags.latest
```

나온 값이 **정확한 버전 번호**(예: `0.x.y`)인지 확인합니다. 그 값을 아래 `<버전>` 자리에 넣어 Proteur에게 **한 줄로** 줍니다. **설치는 하지 않습니다.**

```powershell
npm install -D --save-exact @electric-sql/pglite@<버전> --legacy-peer-deps
```

## 2. A 보고

```
## 사전 점검
- 관문: {} / 기준선: {} / git status: {}

## Proteur가 실행할 명령
npm install -D --save-exact @electric-sql/pglite@<버전> --legacy-peer-deps

## 설치 뒤 Proteur가 확인할 것
- git diff --stat — package.json · package-lock.json 둘만
- package.json의 devDependencies에만 "@electric-sql/pglite": "<버전>"(^ · ~ 없음)
```

**여기서 멈춥니다.**

---

# B — Proteur가 "설치하고 의존성 커밋을 했다"고 알린 뒤

## 3. 설치 확인

```powershell
git status --porcelain
git log -1 --stat
Select-String -Path package.json -SimpleMatch -Pattern '@electric-sql/pglite'
```

- `git status`: 빈 출력
- 마지막 커밋: `package.json` · `package-lock.json` 둘만
- `package.json`: 한 줄이 `devDependencies` 안에 정확한 버전으로 있어야 합니다(`dependencies` 0)

하나라도 다르면 멈추고 보고합니다.

## 4. 위임

```
아래 문서의 지시를 db-architect 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/71b-db-architect-pglite-jest-verify-fix.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 그 파일이 지시의 전부입니다.

착수 전에 확인해주세요.
1. verifyPurge68 기대값: 동의 시각이 있으면 철회 시각 있음, 없으면 null — 출력은 null 여부만
2. 71- 34단언을 jest로 빠짐없이 — 옮긴 수 보고
3. 마이그레이션은 저장소 파일을 읽어 적용(SQL 복사 금지), 없는 것은 시험 쪽 스텁만, (c)는 스텁에 기록된 cron 명령 그대로
4. jest 설정 변경 금지 — 필요하면 멈추고 보고(파일 머리 @jest-environment 주석은 허용·보고)
5. 고의 실패 확인 한 번(013식 덮어쓰기 → (a) 실패), 저장소에 남기지 않음
6. 원격 접속 0

멈춤 조건에 걸리면 고치지 말고 그 지점에서 보고해주세요.
끝나면 게이트(tsc 둘, jest, Python)를 직접 돌려 보고에 넣어주세요.
```

## 5. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- supabase/migrations docs src app package.json package-lock.json tsconfig.json babel.config.js
git ls-files --others --exclude-standard
Get-ChildItem -Recurse -File -Path (git ls-files --others --exclude-standard) | Where-Object { $_.Name -match '[^\x00-\x7F]' }
```

- 셋째 · 다섯째: **빈 출력**. 셋째에 나오는 파일이 있으면 금지 대상입니다. 저장소에 `babel.config.js`가 없으면 그 이름은 무시됩니다
- 넷째: 새 파일은 시험 파일 · 헬퍼 · 스텁뿐이어야 합니다

| 확인 | 기대 |
|---|---|
| ① `verifyPurge68` | 바뀐 단언이 하나뿐이고 조건부 기대값이 맞는지 직접 읽습니다. 출력에 시각 값 · id가 없는지도 확인합니다 |
| ② 단언 수 | (a) 7 · (b) 3 · (c) 11 · (d) 13 = 34와 대조합니다. 다르면 이유가 보고됐는지 봅니다 |
| ③ 마이그레이션 읽기 | 시험이 `supabase/migrations/`를 읽어 번호 순서로 적용하는지, 시험 · 헬퍼에 마이그레이션 SQL 본문이 복사돼 있지 않은지 직접 봅니다 |
| ④ 스텁 | 스텁이 PGlite에 없는 것만 채우는지, `cron` 스텁이 실행하지 않고 기록만 하는지, (c)가 기록된 명령 문자열을 그대로 실행하는지 확인합니다 |
| ⑤ 한 번에 | `npx jest` 한 번으로 새 시험이 함께 도는지 확인합니다(별도 명령 0) |
| jest 설정 | 설정 파일 diff 0 · `@jest-environment` 주석을 썼으면 그것이 보고됐는지 |
| 고의 실패 | 결과가 보고됐고, 시험 파일에 013식 정의가 남아 있지 않은지(`Select-String`으로 그 파일에서 `coalesce(biometric_consent_revoked_at, now())`가 조건 없이 나오는 곳이 없는지) |
| 영향받는 verify 기대값(R55-5) | 목록이 보고됐는지 |
| 게이트 | tsc 0 / 0 · jest 1686 + 새 시험 · 실패 0 · Python 277. **메인 세션이 직접 다시 돌립니다.** 출력 전체를 `scripts/ops/out/71b-*.txt`에 남깁니다. 새 시험 파일의 시간을 적습니다 |
| 원격 접속 | 0 |

## 6. B 보고

```
## 설치 확인
- 커밋: {해시 · 파일} / 버전: {}

## 산출
1. verifyPurge68: {이전 → 이후}
2. 시험 파일 · 헬퍼 · 스텁: {경로 · 하는 일}
3. 옮긴 단언: (a) {} · (b) {} · (c) {} · (d) {} = {} / 34
4. jest 설정: {변경 0 · 파일 머리 지정 있으면 내용}
5. 고의 실패 확인: {실패한 단언 · 메시지 앞부분 · 저장소에 남지 않음}
6. 시험 시간: {파일별}
7. 영향받는 verify 기대값(R55-5): {목록 / 없음}
8. 내부 결정: {}

## 변경
- git diff --stat: {} / 금지 대상: {0} / 새 파일: {}

## 게이트 (메인 세션 재실행)
- tsc / tsc(functions) / Python / jest 마지막 요약 줄

## git status --porcelain
- {전문}

## 판단이 필요한 지점
- {있으면}
```

**여기서 멈춥니다.**

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약 · 보강
- **의존성 설치를 메인 세션이 하는 것** · PGlite 말고 다른 의존성 추가 · jest 설정 변경
- 원격 접속(MCP 포함) · 마이그레이션 추가 · 수정 · 타입 파일 수정
- 키 · 토큰 · URL · 프로젝트 ref를 화면 · 파일 · 로그 · 보고에 내는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
- 커밋 · 푸시
