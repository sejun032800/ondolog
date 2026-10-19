# 메인 세션 작업 — M0 환경 재현과 정의 동기화

> 대상: 클로드 코드 메인 세션 (직접 수행, 위임 없음)
> 보관 경로: `.claude/state/prompts/phase-7/49-main-session-m0-env-sync.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-19
> 기준선: MASTER r57 · ROADMAP r14 · jest 986 · 49

---

## 목표 (PM)

**저장소만으로 개발 환경이 다시 세워진다.** (ROADMAP r14 §3 M0-5, 근거 `docs/ONDOLOG_REVIEW_20261019.md` 3-9)

## 0. 사전 점검

**관문** — 하나라도 다르면 시작하지 않습니다.

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_MASTER.md  -Pattern 'DOC_REVISION: 2026-10-19-r57'
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-10-19-r14'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '49-main-session-m0-env-sync'
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| MASTER r57 / ROADMAP r14 | 각 한 줄 |
| 이 지시서 | 한 줄 |

**변경 전 기준선** — 기록만 합니다.

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

---

## A. 환경 재현

**설정 파일 변경 1회 허가 — 대상: `package.json`, `package-lock.json`.** 아래 범위 밖은 바꾸지 않습니다.

1. `package.json`을 Node로 읽고 써서 **이 세 곳만** 바꿉니다
   - `devDependencies`에 `"@react-native/jest-preset": "0.86.2"` 추가 (`jest-expo`의 피어. lock에 이미 있는 버전)
   - `devDependencies`에 `"test-renderer": "1.2.0"` 추가 (`@testing-library/react-native`의 피어. lock에 이미 있는 버전)
   - `dependencies`에서 `@react-native-kakao/map` 제거 (지도는 출시 후, R13 M0-6)
2. `node_modules`와 `package-lock.json`을 삭제합니다
3. `npm install --legacy-peer-deps`
4. 게이트: **tsc 0 / tsc(functions) 0 / jest 986 · 49**

**멈춤 조건**
- 게이트가 기준선과 다르면 **고치지 말고** 보고합니다 (예: 지도 패키지를 쓰는 코드가 있어 tsc가 깨지는 경우)
- `npm install`이 실패하면 다른 플래그·다른 방법으로 다시 시도하지 말고 오류 전문을 보고합니다

## B. 정의 동기화

**1회 허가 — 대상은 아래 세 파일의 해당 줄뿐입니다.** 각 대상이 정확히 한 곳에서만 일치할 때만 바꿉니다.
일치하는 곳이 없거나 여러 곳이면 바꾸지 말고 찾은 결과를 보고합니다. 파일은 Node로 읽고 씁니다.

| 파일 | 대상 | 바꿀 내용 |
|---|---|---|
| `CLAUDE.md` | "config화 필수" 항목 안의 **발행 주기** 줄 | `발행 주기·생성 기간: 설정값(하드코딩 금지). MVP 매일 발행은 폐기(MASTER r57)` |
| `.claude/agents/db-architect.md` | "001~016 순서" | `SCHEMA §13 순서(현재 022까지)` |
| `.claude/agents/ui-builder.md` | 끝에 **두 번** 붙은 Phase 6 주의사항 | 중복된 하나를 지웁니다 |
| `.claude/agents/ui-builder.md` | Phase 10 절 | 한 줄로: `Phase 11·v5에 흡수, 원본은 v5 명세` |

## C. 하지 말 것

- 재빌드 (폰 확보 후 `51-`)
- 화면 수정, `docs/` 수정
- 위 허가 범위 밖의 설정 파일·에이전트 정의 변경
- `Set-Content`·`Out-File`·`>`로 파일 쓰기
- 커밋·푸시

## 완료 후

- `PROGRESS.md` 제목 바로 아래에 한 줄
- 이번에 메인 세션이 스스로 정한 것이 있으면 HANDOFF에 한 줄 (끝에 붙이지 말고 "열린 항목"이나 새 섹션에)

## 보고

```
## 사전 점검
- 관문: {각 O/X}
- 변경 전 기준선: {tsc / tsc(functions) / jest}

## A. 환경 재현
- package.json diff: {전문}
- lock에서 버전이 바뀐 패키지: {이름 이전 → 이후} — 특히 expo-*, react-native-*
- npm install: {성공 / 실패 — 오류 전문}
- 게이트: {tsc / tsc(functions) / jest}

## B. 정의 동기화
- CLAUDE.md: {바꾼 줄 이전 → 이후 / 못 찾음}
- db-architect.md: {}
- ui-builder.md: {중복 제거 위치 / Phase 10 절 이전 → 이후}

## git status --porcelain
- {전문}

## 판단이 필요한 지점 (제품 사실·범위·순서·외부 의존만)
- {있으면}
```
