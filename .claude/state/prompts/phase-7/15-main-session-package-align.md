# 메인 세션 작업 — `package.json`을 lock에 정합

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/15-main-session-package-align.md`
> 작성: 마스터 PM 세션 / 2026-09-04

---

**이것은 위임 작업이 아닙니다. 메인 세션이 직접 수행합니다.**
의존성·환경 복구는 서브에이전트 범위 밖입니다.

## 배경

`node_modules`가 비어 재설치가 필요해졌는데 `npm ci`가 `ERESOLVE`로
거부합니다. **`package.json`의 선언 범위가 `package-lock.json`이
만들어진 시점보다 앞서 있기 때문**입니다. 확인된 첫 항목은
`react-native`이고(`package.json` `0.86.3` 대 lock `0.86.2`), 다른 항목이
더 있을 수 있습니다.

`CLAUDE.md` 45행이 권장하는 `npm install --legacy-peer-deps`는
**lock을 다시 씁니다.** `--legacy-peer-deps`는 peer 충돌만 무시하고 범위
불일치는 무시하지 않아, 앞선 선언을 최신 range로 재해석합니다. 그래서 이
명령은 쓰지 않습니다.

**의존성을 올리는 것이 아니라 선언을 현실에 맞춰 내리는 작업입니다.**
동작 변화가 없어야 합니다.

## 절대 규칙 8 예외 승인

이 작업은 `package.json`과 `CLAUDE.md`를 수정합니다. **마스터 PM이 이 두
파일에 한해 명시적으로 승인했습니다.** 다른 설정 파일(`app.json`·
`eas.json`·`tsconfig.json`·`package-lock.json`)은 그대로 둡니다.

---

## 절차

### 1. 작업 트리 확인

```powershell
git status --porcelain
```

출력이 있으면 **멈추고 보고하십시오.**

### 2. 터미널 재시작

업데이트가 설치됐으나 적용되지 않은 상태입니다. 재시작 후 진행하십시오.
실패 원인이 섞이는 것을 막기 위함입니다.

### 3. 불일치 항목 수정 — 한 번에 하나씩

```powershell
npm ci
```

`ERESOLVE`가 나오면 에러 본문의 이 형태를 읽으십시오.

```
Found: <패키지>@<lock 버전>
<패키지>@"<package.json 범위>" from the root project
```

`package.json`의 해당 값을 **lock 버전에 맞춰 내립니다.** 범위
접두사(`~`·`^`)는 lock 루트 선언과 동일하게 맞춥니다. lock 루트 선언은
파일 앞부분의 `packages` 아래 빈 키 `""` 블록에 있습니다.

```powershell
Get-Content package-lock.json -TotalCount 80
```

수정 후 매번 확인합니다.

```powershell
git diff package.json
git status --short package-lock.json
```

- `git diff`에 `dependencies`/`devDependencies` 값 외의 변경이 있으면
  **멈추고 보고**
- `package-lock.json`에 출력이 있으면
  **`git checkout -- package-lock.json`으로 되돌리고 멈추고 보고**

`npm ci`가 통과할 때까지 반복합니다. npm은 한 번에 한 항목만 보여주므로
여러 차례 돌 수 있습니다.

### 4. 게이트 — 여기가 유일한 합격 기준

```powershell
npx jest --ci --watchAll=false
npx tsc --noEmit -p .
```

**`348 tests / 26 suites` · `tsc 0 에러`.**
하나라도 다르면 **커밋하지 말고 보고하십시오.**

### 5. `CLAUDE.md` 45행 정정

45행의 `npm install --legacy-peer-deps`를 `npm ci`로 바꾸십시오.
정합 후에는 `npm ci`가 정상 작동하며, **기존 문구는 절대 규칙 8이
금지하는 lock 변경을 유발합니다.**

### 6. 보고 후 대기

**커밋하지 마십시오(절대 규칙 6).** 아래 형식으로 보고하고, 사람의
지시를 기다립니다.

---

## 보고 형식

```
## 작업 트리
- 시작 시: {clean / 변경 N건}

## 수정한 항목
| 패키지 | package.json (전) | package.json (후) | lock 루트 선언 |
|---|---|---|---|

- npm ci 반복 횟수: {N}
- package-lock.json 변경: {없음 / 있었음 — 되돌림}

## git diff package.json 전문
{그대로}

## 게이트
- jest: {N} tests / {N} suites  (기준선 348 / 26)
- tsc: {N} 에러

## CLAUDE.md 45행
- 수정 전: {그대로}
- 수정 후: {그대로}

## git status --porcelain -uall
{그대로}

## 판단이 필요한 지점
- {있으면}
```

---

## 하지 말 것

- **`npm install`** — 플래그와 무관하게 lock을 다시 씁니다.
  이번 사고의 원인입니다
- **`npm audit fix`** — 의존성 트리가 바뀌어 기준선이 무효화됩니다
- **lock을 `package.json`에 맞춰 올리는 것** — `react-native`가
  올라갑니다. 재빌드 대기 5종이 검증되지 않은 상태라 폰 없이 네이티브
  스택을 건드릴 수 없습니다. **업그레이드는 폰 복귀 후 재빌드 검증과
  함께 별건으로 다룹니다**
- **`@react-native/jest-preset`을 직접 추가하는 것** — 의존성 구성을
  바꾸는 결정입니다. `react-native`를 lock 버전으로 내리면 이 문제는
  저절로 해소됩니다
- `package-lock.json` 수정
- `app.json`·`eas.json`·`tsconfig.json` 수정
- 커밋·푸시
- 게이트가 실패했는데 진행하는 것
- `src/`·`docs/`·`scripts/` 아래 무엇이든 수정하는 것
