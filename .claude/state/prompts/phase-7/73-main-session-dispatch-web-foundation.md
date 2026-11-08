# 메인 세션 지시 — `73-` 웹 앱 기반 · 관문

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/73-main-session-dispatch-web-foundation.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-11-08 (PM 지시 `73-`, ROADMAP r69)
>
> 짝: `73-ui-builder-web-foundation.md` · `PM_directive_73-web-foundation.md`(PM 원문)

---

**직접 구현하지 않습니다.** 위임하고, 검증하고, Proteur의 실기기 관문을 중계합니다. 커밋 · 푸시 · Android 빌드 · 설치는 사람이 합니다. **마이그레이션 0 · 원격 스키마 변경 0 · 루트 `package.json` · `app.json` · `eas.json` 변경 0 · RN 앱 수정 · 삭제 0.**

진행은 세 단계이고, **각 단계 끝에서 멈춥니다.**

| 단계 | 내용 | 끝에서 |
|---|---|---|
| **0** | 사전 점검 · 충돌 확인(위임 전) | 막힘이 있으면 멈춤 |
| **1** | 묶음 1(껍질과 손맛) → Proteur 빌드 · 설치 → **관문 G1 · G2(흰 프레임) · G4** | 멈춤. **G4가 안 되면 여기서 끝**(PM이 다시 정함) |
| **2** | 묶음 2(로그인과 저장) → 관문 G2(404 · 시트) · G3 · G5 → 최종 보고 | 멈춤 |

순서 근거: PM 지시서 §4는 "G4가 안 되면 멈춘다"고 했습니다. 그래서 가장 위험한 손맛(G4)을 **로그인 작업보다 먼저** 판정합니다. G4가 안 되면 묶음 2에 들일 작업을 아낍니다.

---

## 0. 사전 점검 (위임 전, 메인 세션 — 읽기만)

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-11-08-r69'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '73-'
git log --oneline -3
```

| 확인 | 기대 |
|---|---|
| `git status` | 빈 출력 |
| ROADMAP r69 | 한 줄(R47-3). **없으면 멈춥니다** |
| 위임 파일 | `73-` 파일 3개(PM 지시서 포함) |

**기준선**: tsc 0 / 0, jest **`Test Suites: 101 passed` · `Tests: 1769 passed`**, Python **277**. 출력은 `scripts/ops/out/73-*-pre.txt`에 남깁니다. 다르면 한 번 다시 돌립니다(R43-8).

**충돌 확인** — 아래 넷 중 하나라도 걸리면 위임하지 말고 보고합니다. 고치려면 루트 설정을 바꿔야 해서 PM 허가가 필요합니다.

1. **루트 jest**: 설정(`package.json`의 `jest` 키 또는 `jest.config.*`)의 `roots` · `testMatch` · `testPathIgnorePatterns` · `modulePathIgnorePatterns`. `web/` 아래의 `*.test.tsx`(Vitest 시험)와 `web/node_modules`를 루트 jest가 **집게 되는지**를 판정합니다.
2. **루트 tsc**: 루트 `tsconfig.json`의 `include` · `exclude`. `tsc -p .`이 `web/`을 집게 되는지 판정합니다.
3. **`.gitignore`**: `web/.env` · `web/node_modules` · `web/dist` · `web/android/build` · `web/android/.gradle` · `web/android/local.properties`가 무시되는지 판정합니다. `git check-ignore -v`에 가상의 경로를 넣어 확인합니다.
4. **파일 이름 시험**(`__tests__/build/fileNameRule.test.ts`): 지금 수집 방식과, `web/`을 넣고 빌드 산출물을 빼려면 이 파일만 고치면 되는지 판정합니다.

1 · 2에 걸리면, 막는 방법을 둘 이상 적어 보고합니다. 예: Vitest 시험 이름 규칙을 바꾸는 방법(`web/` 쪽에서 해결 — 허가 안), 루트 설정을 바꾸는 방법(허가 밖). **`web/` 쪽에서 해결할 수 있으면 그 방법을 위임 메시지에 넣고 진행합니다.**

3에 빠진 항목이 있으면 `.gitignore`에 넣을 줄을 보고합니다. `.gitignore`는 설정 파일이라 **사람이 넣습니다**. 그 전에는 묶음 1을 위임하지 않습니다.

**웹 데모 소스**: Proteur가 저장소 밖에 둔 zip 경로를 받아, 저장소 밖 임시 폴더(`%TEMP%`, OneDrive 밖)에 풉니다. 파일 목록 · `package.json` 의존성 · `core/` 목록 · `track.ts` 위치를 보고에 적습니다. **키 · 주소 값은 적지 않습니다.**

**Proteur 결정 두 가지**(PE가 Proteur에게 받아 위임 메시지에 넣습니다):
- `appId`(패키지 이름)
- 콜백 scheme

---

# 단계 1 — 묶음 1 (껍질과 손맛)

## 1-1. 위임

```
아래 문서의 지시를 ui-builder 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/73-ui-builder-web-foundation.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 그 파일이 지시의 전부입니다.
이번 묶음: 1
웹 데모 소스(저장소 밖, 읽기만): {경로}
appId: {Proteur 결정} / 콜백 scheme: {Proteur 결정}
충돌 확인 결과와 해결 방법: {0단계 결과}
jest 기준선: Test Suites: 101 passed · Tests: 1769 passed

착수 전에 확인해주세요.
1. web/ 밖에서 바꿀 수 있는 것은 파일 이름 시험의 수집 범위뿐
2. web/ 의존성은 PM 지시서 §2 P2 목록만 · 정확한 버전 고정 · 목록 밖이 필요하면 멈춤
3. core/ 사본 대신 정본을 별칭으로 · 루트 코드 수정 0
4. track.ts 제외 · 주소 · 키는 VITE_ 환경 변수로만
5. 흰 프레임 0을 위한 바탕색은 index.html 인라인부터 네이티브 테마까지 전부 · cap sync 뒤 리소스 대조(R68-3)
6. 채팅 시험 화면은 개발용 경로로만 · 가짜 데이터 · 원격 0
7. 루트 jest · tsc가 web/을 집어 실패하면 루트 설정을 고치지 말고 멈춤

멈춤 조건에 걸리면 고치지 말고 그 지점에서 보고해주세요.
```

## 1-2. 검증

```powershell
git status --porcelain
git diff --stat
git diff --stat -- package.json package-lock.json app.json eas.json tsconfig.json babel.config.js app src supabase render docs
Select-String -Path web/package.json -Pattern '"\^|"~'
```

| 확인 | 기대 |
|---|---|
| 셋째 줄 | **빈 출력.** 루트 · RN · 서버 · 렌더러 변경 0 |
| 넷째 줄 | **0줄.** `web/` 의존성이 모두 정확한 버전 |
| 바뀐 루트 파일 | `__tests__/build/fileNameRule.test.ts` 하나(+ PROGRESS · HANDOFF) |
| `web/` 안 | 엔진 사본 0(`core/` 폴더 없음) · `track.ts` 없음 · 코드에서 `supabase.co` · `eyJ` 같은 주소 · 키 문자열 검색 0줄 |
| `web/.env` | git 밖(`git check-ignore -v web/.env`) |
| 바탕색 | ui-builder가 보고한 모든 자리(파일:줄)를 직접 열어 **보고한 한 색과 모두 같은지** 확인한다(데모 `body` `#05040A` · Nocturne `ink` `#0A0814` 중 고른 값과 근거 포함). `index.html` `<head>`에 인라인 바탕이 있는지 |
| `track` | `web/` 안에 `track(` · `newTrackingSession` · `demo_responses` 검색 0줄 · `stats.sql` 없음 |
| 관문 | `web/`: `npm ci` · tsc · Vitest(수) · build · `cap sync`. 루트: tsc 0 / 0 · jest(요약 줄 그대로) · **Python 277** — **메인 세션이 다시 돌립니다.** 출력은 `scripts/ops/out/73-1-*.txt` |

## 1-3. Proteur 빌드 · 설치 · 관문

1. HANDOFF에 적힌 명령으로 **Proteur가** Android 빌드와 설치를 합니다.
   - 전제: Android Studio(JDK · Android SDK 포함) 설치, 폰의 USB 디버깅 켜기 · PC 연결
   - 이 전제는 PE가 Proteur에게 안내합니다. 막히면 그 출력을 받습니다.
2. 관문(ui-builder가 낸 확인 순서를 그대로 Proteur에게 줍니다):
   - **G1**: 반입한 온보딩(시작 → 기본정보 → MBTI → 5문항 → 결과 → 동의, 로그인 직전까지)의 연출이 **브라우저의 웹 데모와 같은지**. 같은 폰에서 두 개를 차례로 녹화합니다.
   - **G2(흰 프레임)**: 앱 완전 종료 후 실행 · 화면 전환 · 뒤로 가기에서 흰 프레임 0
   - **G4**: 채팅 시험 화면. 500개 빠른 스크롤 끊김 · 키보드 열고 닫기 · 입력창과 마지막 메시지 가림 · 뒤로 가기. **Proteur 체감(좋음 / 보통 / 나쁨)과 녹화를 함께** 받습니다.
3. 녹화는 **저장소에 넣지 않습니다.** 판독은 저장소 밖 임시 폴더에서 0.1초 간격으로 합니다(`ffmpeg`가 없으면 Proteur에게 묻고, 설치하지 않습니다).

## 1-4. 단계 1 보고 → 멈춤

```
## 0단계
- 기준선: tsc / jest 요약 줄 / Python
- 충돌 확인 1~4: {결과 · 택한 해결}
- 웹 데모 소스: {파일 수 · 의존성 · core/ 목록 · track.ts 위치(값 없이)}

## 묶음 1 산출
- 라우터 · 의존성(정확한 버전): {}
- ① 대조표(사본 · 정본 · 같음/다름/정본 없음): {}
- RN 의존으로 못 쓰는 정본: {}
- ④ 바탕색 자리(파일:줄) · cap sync 리소스 대조 · https 출처: {}
- ⑨ 채팅 시험 화면: {경로 · 가상화 · 키보드 처리}
- 허가 밖이라 멈춘 지점: {}

## 관문 (실기기)
| G | 결과 | 근거(녹화 시각 · Proteur 체감) |
| G1 | | |
| G2 흰 프레임 | | |
| G4 | | |

## 변경 · 관문 출력
- git diff --stat: {}
- web/: npm ci · tsc · Vitest 요약 · build · cap sync
- 루트: tsc / tsc(functions) / Python / jest 요약 줄(그대로)
- 커밋할 파일 목록: {}

## git status --porcelain
- {전문}

## 판단이 필요한 지점
- {있으면}
```

**여기서 멈춥니다.** G4가 "나쁨"이거나 G1 · G2를 통과하지 못하면 **묶음 2로 가지 않습니다**(PM 지시서 §4).

---

# 단계 2 — 묶음 2 (로그인과 저장) — PM이 단계 1을 통과시킨 뒤

## 2-1. 위임

1-1과 같은 형식으로 하되, `이번 묶음: 2`로 바꾸고 단계 1 관문에서 X가 난 항목과 Proteur 메모를 그대로 붙입니다.

## 2-2. 검증 (1-2에 더해)

| 확인 | 기대 |
|---|---|
| 콜백 | 콜백 화면이 성공 · 실패를 모두 받음 · 화면 · `console`에 코드 · 주소 출력 0 · 교환 뒤 경로 교체 |
| 세션 | `@capacitor/preferences` 어댑터 · 주소에서 세션 자동 읽기 꺼짐 · `flowType: 'pkce'` |
| 저장 | RPC 이름 · 인자가 RN 서비스와 같다는 시험 · 기존 계정 판정이 정본 출처 |
| B8 | 대응표 · 16조합 결과. **어긋남이 있으면 보고 맨 위 + 멈춤**(원격 데이터 수정 0) |

## 2-3. 관문 (실기기)

- **G2**: 로그인 뒤 404 0 · 시트 반복 0
- **G3**: 카카오 왕복 → 저장 → 앱 완전 종료 후 재실행해도 로그인 유지 · 기존 계정이면 알림
- **G5**: B2 · B3 · B7 · B8 · B9가 처음부터 없음(녹화 판독)

카카오 로그인 때 인앱 브라우저의 흰 화면은 다른 앱 화면이므로 흰 프레임 집계에서 뺍니다.

## 2-4. 최종 보고 → 멈춤

단계 1 보고 형식에 아래를 더합니다.
- ③ 대응표 · 16조합 · 웹 데모와 RN 대응 비교
- ⑤⑥⑦ 결과
- **G1~G5 최종 판정표와 녹화 판독표**
- ⑩ HANDOFF 명령 · **CLAUDE.md 단락 초안(사람이 넣음)**
- PM 지시서 §5 완료 기준 다섯 줄 각각의 충족 여부

**여기서 멈춥니다.**

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약 · 보강(묶음 번호 · 경로 · Proteur 결정 · 충돌 해결 · 앞 관문 X 메모 전달만 허용)
- 루트 `package.json` · `app.json` · `eas.json` · 루트 jest/tsc 설정 · `.gitignore` · CLAUDE.md 직접 수정
- RN 앱(`app/` · `src/components` · RN 훅 · 서비스) 수정 · 삭제, 루트 정본 코드 수정
- 허가 목록 밖 의존성 설치, `npm audit fix`
- 빌드 · 설치 · 커밋 · 푸시 · `db push` · 원격 스키마 변경 · 원격 함수 호출(R34-3) · `demo_responses` 쓰기
- 웹 데모 zip · 녹화 · 캡처 · 키 · 주소 · ref · 이메일 · 생년월일 · 초대 코드를 저장소 · 보고 · 로그에 넣는 것
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
