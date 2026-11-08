# 메인 세션 지시 — `51b-` 실기기 결함 일괄 수정 (재빌드 1회 + 기기에서 바로 확인)

> 대상: 클로드 코드 메인 세션 (개발 총괄)
> 보관 경로: `.claude/state/prompts/phase-7/51b-main-session-dispatch-device-fixes.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-11-08 (PM 지시 `51b-`, ROADMAP r65)
>
> 짝: `51b-ui-builder-native-bundle.md`(단계 A) · `51b-ui-builder-js-fixes.md`(단계 B) · `PM_directive_51b-device-fixes.md`(PM 원문)

---

**직접 구현하지 않습니다.** 위임하고, 검증하고, Proteur의 실기기 확인을 중계합니다. 커밋 · 빌드 · 푸시는 사람이 합니다. **마이그레이션 0 · 원격 쓰기 0.** 의존성 · 설정 변경은 단계 A에 적은 것만 1회 허가입니다.

진행은 세 단계이고, **각 단계 끝에서 멈춥니다.**

| 단계 | 내용 | 끝에서 |
|---|---|---|
| **A** | 네이티브 묶음 → 관문 | 멈춤 → Proteur 커밋 · **재빌드 1회** · 설치 |
| **B** | JS 수정, 묶음 1 → 2 → 3 | 묶음마다 멈춤 → Proteur 실기기 확인 · 커밋 |
| **C** | 두 동선 다시 녹화 → 판독 | 최종 보고 → 멈춤 |

---

## 0. 사전 점검

```powershell
git status --porcelain
Select-String -Path docs/ONDOLOG_ROADMAP.md -Pattern 'DOC_REVISION: 2026-11-08-r65'
git ls-files .claude/state/prompts/phase-7 | Select-String -Pattern '51b-'
git log --oneline -3
```

| 명령 | 기대 출력 |
|---|---|
| `git status --porcelain` | 빈 출력 |
| ROADMAP r65 | 한 줄(R47-3). **없으면 멈춥니다** |
| 위임 파일 | `51b-` 파일 4개(PM 지시서 포함) |

**남은 프로세스(전)**: 앞선 지시서와 같은 세 줄(playwright · render venv python · pgliteServer)로 셉니다.

**기준선**: tsc 0 / 0, jest **`Test Suites: 100 passed` · `Tests: 1765 passed`**, Python **277**. 출력 전체를 `scripts/ops/out/51b-*-pre.txt`에 남깁니다. 다르면 한 번 다시 돌립니다(R43-8).

---

# 단계 A — 네이티브 묶음

## A-1. 위임

```
아래 문서의 지시를 ui-builder 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/51b-ui-builder-native-bundle.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 그 파일이 지시의 전부입니다.

착수 전에 확인해주세요.
1. 바뀌어도 되는 파일: package.json · package-lock.json · app.json · 폴리필 1개 · 불러오는 한 줄 · 시험. 그 밖이 바뀌면 멈춤
2. 설치는 npx expo install expo-crypto / npx expo install expo-dev-client expo-image-picker 두 번뿐. 다른 패키지가 따라 바뀌면 멈춤
3. 폴리필은 digest · getRandomValues가 없을 때만 채움
4. 스플래시 · 내비게이션 바는 app.json만. 새 패키지가 필요하면 설치하지 말고 멈춤
5. CAMERA는 먼저 introspect로 확인 → 빼는 설정 → 다시 확인. android/ 폴더 만들지 않음
6. 관문에 npm ci --include=dev 포함. 정적 검사 시험 0

멈춤 조건에 걸리면 고치지 말고 그 지점에서 보고해주세요.
```

## A-2. 검증

```powershell
git status --porcelain
git diff --stat
git diff -- package.json app.json
npm ci --include=dev
npx expo install --check
```

| 확인 | 기대 |
|---|---|
| 바뀐 파일 | 위임서 허가 목록 안. **밖이면 멈추고 보고** |
| `package.json` | `dependencies`에 `expo-crypto` 한 줄 더함 · `expo-dev-client` · `expo-image-picker`가 `~57.0.21` · **다른 줄 변동 0** |
| `app.json` | 스플래시 바탕 · 내비게이션 바 · 권한 차단 설정만 |
| 폴리필 | "없을 때만" 조건이 코드에 있음 · Supabase 클라이언트 생성 전에 불러옴 |
| `npm ci` | ERESOLVE 0(R63-2) |
| `--check` | 남은 것 0 |
| 관문 | tsc 0 / 0 · jest(새 시험 포함, 요약 줄 그대로) · Python 277 — **메인 세션이 다시 돌립니다**. 출력은 `scripts/ops/out/51b-A-*.txt` |

## A-3. 보고 → 멈춤

```
## 단계 A
- 바뀐 파일(git diff --stat): {}
- A1 expo-crypto: {버전 · dependencies 확인} / 폴리필: {경로 · 불러오는 위치} / 시험: {}
- A2: {두 줄}
- A3: {app.json 키 · 근거 · 색 값과 토큰 이름 · edge-to-edge 여부}
- A4: {바꾸기 전 권한 줄 → 넣은 설정 → 바꾼 뒤 권한 줄}
- npm ci 마지막 줄: {} / --check 전문: {}
- 관문: tsc / tsc(functions) / Python / jest 요약 줄(그대로)
- 남은 프로세스(후): {}

## Proteur 할 일
- 커밋할 파일 목록(이름 하나씩): {}
- 빌드: npx eas-cli build --profile development --platform android (R61-3)

## git status --porcelain
- {전문}
```

**여기서 멈춥니다.** 빌드가 실패하면 그것은 `51b-` 결함이 아니라 **빌드 문제로 따로 보고**합니다(R61-3).

---

# 단계 B — JS 수정 (새 빌드를 설치한 뒤)

**전제**: Proteur가 새 빌드를 폰에 설치했고, `npx expo start --dev-client --lan`으로 Metro에 붙었습니다.

## B-1. 묶음마다 반복

1. 위임(묶음 번호만 바꿔서):

```
아래 문서의 지시를 ui-builder 역할로 직접 수행해주세요.
다른 에이전트를 호출하지 마세요.

.claude/state/prompts/phase-7/51b-ui-builder-js-fixes.md 를
전문 읽고 그 문서의 지시를 정확히 이행해주세요. 그 파일이 지시의 전부입니다.
이번 묶음: {1 / 2 / 3}  ·  jest 기준선: {요약 줄}
{묶음 2·3이면: 앞 묶음 실기기 확인에서 X가 난 항목과 Proteur 메모를 여기에 그대로}

착수 전에 확인해주세요.
1. 이번 묶음 항목만. 묶음 밖 결함은 목록으로만
2. 새 의존성 · 설정 파일 · 마이그레이션 · 원격 쓰기 0
3. 화면 · 로그에 오류 원문 · 코드 · 주소 · 이메일 · 생년월일 0
4. 디자인 보드가 기존 구현보다 우선. 대조 결과 보고
5. jest로 못 보는 것은 실기기 확인 항목으로. 정적 검사 시험 0
6. 산출에 Proteur 실기기 확인 순서(항목마다 한 줄)

멈춤 조건에 걸리면 고치지 말고 그 지점에서 보고해주세요.
```

2. **검증**: `git diff --stat`이 앱 코드와 시험만인지 확인합니다(`package.json` · `app.json` · `supabase/` · `docs/` 변동 0). 관문(tsc 둘 · jest)은 메인 세션이 다시 돌리고, 출력은 `scripts/ops/out/51b-B{n}-*.txt`에 남깁니다.
3. **Proteur에게 실기기 확인을 요청**합니다. ui-builder가 낸 확인 순서를 그대로 줍니다. Metro에서 `r`로 다시 불러온 뒤 진행합니다. 결과는 항목마다 O / X이고, X면 가린 캡처나 녹화 시각과 한 줄 설명을 받습니다.
4. X는 **같은 묶음 안에서** 다시 위임합니다(최대 2회). 2회 뒤에도 X면 고치지 말고 보고에 남깁니다.
5. 묶음 보고 → 멈춤 → Proteur가 커밋합니다(파일 이름 하나씩, `git add .` 금지).

## B-2. 묶음 보고

```
## 묶음 {n}
- 항목별: {# · 원인 파일:줄 · 바꾼 것 · 새 시험 · 실기기 O/X}
- 실기기에서 X로 남은 것: {}
- 묶음 밖에서 본 결함: {}
- 관문: tsc / tsc(functions) / jest 요약 줄(그대로)
- 커밋할 파일 목록: {}

## (묶음 1이면) 함께 보고할 것
- B8 대응표 + 16조합 결과: {}
- B3 원인 + 같은 원인을 가진 화면 목록(검색 명령 · 결과): {}
- B6 검색 결과(파일:줄): {}
- B18 마케팅 처음 값: {꺼짐 / 켜짐이었음 → 고침}
- B4 보드 I01 · F계열 대조: {보드 모양 · 다른 곳}

## (묶음 3이면) 함께 보고할 것
- R65-5 카카오 프로필 사진 저장 · 표시 위치: {파일:줄 / 없음 + 검색 근거}

## git status --porcelain
- {전문}
```

**묶음마다 여기서 멈춥니다.**

**B8이 어긋난 경우(대응표 오류)**: 묶음 1 보고 맨 위에 적고 PM 판단을 기다립니다. 이미 결과를 받은 시험 계정의 유형이 틀렸을 수 있기 때문입니다. 원격 데이터는 고치지 않습니다.

---

# 단계 C — 다시 녹화와 판독

1. Proteur에게 두 동선 녹화를 요청합니다(PM 지시서 §1).
   - ① **새 설치 상태**에서 온보딩 끝까지: 시작 → 기본정보 → MBTI 모름 4문항 → 연애 5문항 → 결과 → 동의 → 카카오 → 메인
   - ② 메인 → 채팅 탭 → 피드 → 매거진 → 설정의 모든 하위 화면 → 초대 코드 만들기 · 공유 · 코드 입력
   - 새 설치 상태는 앱 삭제 후 재설치(같은 APK) 또는 앱 데이터 삭제로 만듭니다. 방법은 Proteur에게 맡기고, 어떤 방법을 썼는지 기록합니다.
2. **녹화 파일은 저장소에 넣지 않습니다.** 판독은 프레임을 뽑아 저장소 밖 임시 폴더에서 합니다.
3. **0.3초 간격**으로 판독합니다(`ffmpeg`가 없으면 Proteur에게 묻고, 설치하지 않습니다).
   - 흰 프레임 수: 화면 전체 또는 아래 띠가 흰색인 프레임. 다른 앱(카카오 브라우저 · 공유 시트 · Gmail)으로 넘어간 구간은 빼고 셉니다
   - 404 수
   - 시트 반복 수
4. 결함 표 B1~B18과 P1~P4의 줄마다 **해소 / 남음**을 적습니다.

## C 최종 보고

```
## 녹화 판독 (동선 ① · ②)
- 새 설치 방법: {}
- 흰 프레임: {개수 · 시각} / 404: {} / 시트 반복: {}
| # | 결함 | 해소 / 남음 | 근거(시각) |
(B1~B18 · P1~P4 전부)

## PM 지시서 §4 여섯 가지
1. B8 대응표 + 16조합: {}
2. B3 원인 + 같은 원인 화면: {}
3. B6 검색 결과: {}
4. A4 매니페스트 확인: {}
5. R65-5 프로필 사진: {}
6. C 판독표: 위 표

## 완료 기준 (PM 지시서 §5)
- jest(요약 줄 그대로) / tsc 0 / Python 277 / npm ci --include=dev: {}
- 재빌드 1회 성공 + 설치: {}
- 흰 프레임 0 · 404 0 · 시트 반복 0: {}
- 마이그레이션 0 · 원격 쓰기 0 · 허가 밖 변경 0: {}
- 녹화 · 캡처 저장소 반입 0: {}

## git status --porcelain
- {전문}

## 판단이 필요한 지점
- {있으면}
```

**여기서 멈춥니다.**

## 하지 말 것

- 직접 구현, 위임 프롬프트 요약 · 보강(묶음 번호 · 기준선 · 앞 묶음 X 메모 전달만 허용)
- 단계 A 밖의 의존성 · 설정 변경, `npm audit fix`, `android/` · `ios/` 폴더 생성
- 빌드 · 설치 · 커밋 · 푸시 · `db push` · 원격 쓰기 · 원격 함수 호출(R34-3)
- 녹화 · 캡처 · 이메일 · 생년월일 · 초대 코드 · 키 · URL · 프로젝트 ref를 저장소 · 보고 · 로그에 넣는 것
- 두 번째 계정 항목 · D절 진행(이 빌드로 **다음에** — R65-1)
- 처리방침 · 약관 본문 수정(R64-6, PM이 따로 보냄)
- 검증에서 찾은 문제를 직접 고치는 것 — 보고가 먼저입니다
