# 인수인계

> 서브에이전트는 컨텍스트가 격리되어 서로 대화할 수 없다.
> 이 파일이 유일한 인수인계 수단이다.
> **완료 항목은 `.claude/state/archive/`로 옮긴다** — 누적되면 컨텍스트가 오염된다.
> (예외: 아래 "DEF 애착 항 갱신" 작업 프롬프트는 선행 작업의 진단
> 수치를 보존하라고 명시해, 이번 세션은 완료 항목을 삭제하지  않았다.
> 프롬프트 #13도 상태 파일 기록 삭제·이동·재편을 금지해 유지한다.
> `#13-r4`(브랜드 생성자 이전)도 같은 이유로 `#13` 절을 그대로 두고
> 위에 새 절만 추가한다.)
HANDOFF에 무언가를 더할 때는 끝에 붙이지 말고 "열린 항목"이나 새 섹션에 넣는다.
> **HANDOFF는 사람이 덮어쓰지 않는다**(R112-4) — 메인 세션이 고친 것을 커밋만.

## `85-b` 둘러보기 센서 안정화 - 튐 · 상하/좌우 섞임 (메인 세션, 2026-11-23, 위임문 `phase-7/85-b-dispatch-tour-sensor-stability.md` · 출처 ROADMAP r147 R147-3) - 완료 · 멈춤 0 (미커밋)

> 이 컴퓨터(Windows)의 Playwright WebKit ≠ iOS Safari · WKWebView - 실기기 대체 아님.

원인 판정(85- 코드, 고치기 전):

| # | 물음 | 판정 | 근거(고치기 전 파일:줄) |
|---|---|---|---|
| 가 | 세 각도를 그대로 화면 회전에 쓰나 | **맞음 - 주원인.** 방위 = `360 − alpha`, 높이 = `beta − 90`, gamma는 읽지도 않음. 폰을 세운 자세(beta ≈ 90)는 alpha · gamma가 같은 축(짐벌 잠김)이라 alpha 혼자 크게 흔들리고, 손이 조금 비틀린 채 지평선을 지나면 표현이 바뀌어 alpha가 180° 뒤집힘 -> 방위 띠 튐 · 위아래 기울임이 방위에 섞임 | `tourMath.ts:88-94` · `useSkyOrientation.ts:330` |
| 나 | 평활이 0/360 경계에서 먼 쪽으로 도나 | **아님.** `smoothView`는 `wrap180`(짧은 쪽) · 멈춤 판정도 짧은 쪽. 다만 입력 자체가 180° 뛰면 짧은 쪽으로도 몇 틱에 걸쳐 크게 돎("북 → 북동 → 남") | `tourMath.ts:97-102` · `useSkyOrientation.ts:322` |
| 다 | 화면 방향(세로 · 가로) 보정 | **없음**(`screen.orientation` · `window.orientation` 0건) | `web/src/features/sky/` 전체 |
| 라 | `absolute` / `webkitCompassHeading` | `absolute` 처리 0(`deviceorientationabsolute` 안 들음 - 그대로 둠). iOS는 `webkitCompassHeading`을 **방위로 그대로** 씀(나침반 값의 튐도 그대로 화면에) | `tourMath.ts:89-91` · `useSkyOrientation.ts:329-330` |

고친 곳:
- `tourMath.ts` `lookFromOrientation`: W3C R = Rz(alpha)·Rx(beta)·Ry(gamma) -> 시선(기기 −Z) · 화면 위쪽(기기 축을 화면 방향만큼 돌림). 방위 = atan2(시선 수평 + max(0, 시선 높이)·(−화면 위쪽 수평)) - 지평선 쪽은 시선만(비틀림 무관), 꼭대기 쪽은 화면 위쪽이 이어 받음(높이 90에서도 끊기지 않음), 순수 위아래 기울임은 두 성분이 같은 방위라 방위 그대로. 높이 = asin(시선 높이). `viewFromOrientation`은 이것 + `clampPitch`.
- iOS 나침반: `nextCompass` · `withCompass` - alpha 기준(iOS 임의)과 북의 **차이만** 천천히(0.1) 따라감 · 높이 −30°~75°에서만 받음 · 차이에서 30° 넘게 튄 값은 버림 · 15번(0.5초) 이어지면 받아들임. 첫 값은 바로 받음(85- 시험 "나침반 270 -> 서" 그대로 통과).
- 평활: **각도별 최단 경로**(slerp 아님) - 입력이 이제 연속이고 화면이 쓰는 건 방위 · 높이 두 숫자뿐. α 0.2 · 30Hz 그대로.
- `useSkyOrientation.ts`: gamma 넘김 · `TourEnv.screenAngle`(기본 `screen.orientation.angle` -> `window.orientation` -> 0, 주입 가능) · 나침반 상태는 효과 안 지역 변수(저장 · 전송 0 그대로).
- 85- 단위 시험 1건 계약 변경: `viewFromOrientation({alpha: 90, beta: 200, compassHeading: 45})`(W3C 범위 밖 beta · 나침반 인자) 줄을 뺌 -> 나침반은 새 시험에서. 나머지 85- 시험 수정 0.
- 그대로: 사진 층 고정 · 방위 글자 · 칩 동작 · 모션표 · C08-alt 끌기 · C09 · 화면 모양(`SkyTour.tsx` · `SkyScreen.tsx` · css 변경 0).

시험 `tourSensor85b.vitest.ts`(값 열 = 실제 자세 -> W3C 세 각도, 기기가 고르는 표현 그대로 · 같은 값 열을 85- 계산에 넣어 튐을 보이는 증인 포함 · 문턱 15°/틱 = 450°/초: 둘러보기 회전(≤ 3°/틱)보다 크고 녹화 튐(≥ 30°/틱)보다 작음):
(a) 세운 채 한 바퀴(비틀림 ±2° · 높이 ±3°) - 틱마다 ≤ 15° · 합 350~362° · 되돌아 도는 틱 0(85-는 > 90° 튐) · (b) β 85↔95 · α · γ 뒤집힘(자연 표현 + 한 틱 걸러 정확히 180° 다른 표현) - 방위 40° ± 1° · (c) 355 ↔ 5 - 북 ±12° 밖 0 · (d) 위아래만 −10 → 85 → −10 - 방위 변화 < 0.5° · (d′) 같은 기울임에 비틀림 2° - < 3°(85-는 180° 뒤집힘) · 가로 화면 90° · 꼭대기 근처 연속 · 같은 자세 다른 표현 = 같은 시선 · iOS 나침반(차이 · 튄 값 버림 · 0.5초 뒤 받음 · 나침반 180° 튐 섞인 한 바퀴).

검증: **`npm run gate` 통과 146.4초**(web tsc 8.1 · Vitest 73 파일 1234 + 1 건너뜀 24.8 · 법무 8/8 4.4 · smoke 42/42 109.1) · 루트 tsc 0 · jest 130 스위트 / 2280 · `build` · `build:trial` · `cap sync android`(맨 끝 한 번). 새 패키지 0 · 서버 0 · LLM 0 · 원격 0 · 새 파일 이름 ASCII.

열린 것: 실기기(폰A S21 · 폰B V40 · iOS) 확인 - 위임문 보고 7번 목록. Android `deviceorientation` alpha가 기기에 따라 상대 기준일 수 있음(`absolute` 미처리 - 85-와 같음, 방위 글자 정확도 문제이지 튐은 아님).

## `84-h` 시험판 전용 유성 미리 보기 · 0인 조각 빼기 (메인 세션, 2026-11-22, 위임문 `phase-7/84-h-dispatch-meteor-preview-zero-fragments.md` · 출처 ROADMAP r145 R145-1~6) - 완료 · 멈춤 0 (미커밋)

> 이 컴퓨터(Windows)의 Playwright WebKit ≠ iOS Safari · WKWebView — 실기기 대체 아님

시작 확인: `DOC_REVISION: 2026-11-22-r145` - 통과. 위임 0(메인 세션 직접). LLM 0 · 원격 0(허용 질의 없음) · 마이그레이션 0 · 새 패키지 0 · 엔진 · `scripts/ops/` · `consent.ts` · `demo_responses` 0 · 디자인 틀(`render/issue/`) 0 · `package.json` · `vite.config.ts` · `capacitor.config.ts` 0 · 커밋 0.

### ① 시험판 전용 "유성 미리 보기" (R145-2)
| 항목 | 고친 곳 | 시험 |
|---|---|---|
| 설정 줄(OUR SKY 맨 아래 · 시험판만) | `web/src/features/settings/SettingsView.tsx:147-154` `{IS_TRIAL_BUILD ? <ListRow …/> : null}` - "유성 미리 보기 · 시험판" / "견본 말 하나를 바로 떨어뜨려요 · 기록에 남지 않아요" · 누르면 `requestMeteorPreview()` + `nav.push('sky')` | `meteorPreview84h.vitest.tsx` "OUR SKY 묶음 맨 아래 한 줄 · …" · `meteorPreviewProd84h.vitest.tsx` "설정 OUR SKY에 미리 보기 줄 0 - 실제 두 줄만" |
| 하늘(C01 · C08) | `SkyScreen.tsx:136` 열 때 한 번 요청을 읽음(출시 = 상수 false) · `:255` 미리 보기로 연 하늘은 실제 유성 쉼(`enabled && !previewOn` - 한 번에 하나 · 기록 섞임 0) · `:406-407` `{IS_TRIAL_BUILD && previewOn ? <MeteorPreviewHost/> : null}` | "기본 모션: 곧(0.7초) 지나가는 유성 …" · "줄인 모션: 제자리 빛 · 5.2초 …" · "기본 모션 놓침 - 3초 뒤 사라짐" · "C08 둘러보기에 들어가면 하나 더" · "요청 없이 연 하늘에는 미리 보기 0" · "빈 하늘(별 0)에서는 …" · 출시 쪽 "미리 보기 요청이 남아 있어도 하늘에 떨어지지 않는다" |
| 미리 보기 본체 | `web/src/features/sky/meteorPreview.tsx` - `:37` 0.7초 뒤 곧 · `:75` `useMeteorPreview`(처음 열림 + 둘러보기 진입마다 하나 · 조건은 실제 유성과 같은 `canShow` · `visible`) · `:118` `MeteorPreviewHost`(유성 그림 · C03은 `Meteor.tsx` 그대로) · 기기 저장 · 서버 호출 0 | "미리 보기 코드에 서버 · 기기 저장 쓰기가 없다"(정적) · 런타임: 가짜 서버가 부르면 기록 → 0 · `localStorage`에 견본 · `meteor` 키 0 |
| C03 견본 | `Meteor.tsx:167-170` `FallenWords`에 `preset`(견본을 그대로 · 서버 읽기 0) · 견본 = `meteorPreviewSample.ts`(가져오기 0인 글자 파일 · 짧은 견본 = 스모크 `?meteor=1`과 같은 값 · 긴 견본 1개 = 390폭 두 화면 넘음) · `smoke/seed.ts`가 같은 파일에서 가져옴 · 이름 "도담" · "이랑"(스모크 표지 이름과 다르게) | "누를 때마다 - 하루 1번 규칙과 무관 …"(두 번 열어도 `2 / 2`) |
| 출시 번들 검사 | `smoke/markers.mjs:21` `PREVIEW_MARKERS`(줄 이름 · 설명 · 견본 두 문장 · 견본 id · 줄 test id) · `smoke/run.mjs:71-79` 출시 빌드(`vite build`, 가짜 연결 값 - 실제 값 0)를 임시 폴더에 내 표지 0 · 시험 빌드에는 표지 모두(검사 살아 있음) · `meteorPreview84h.vitest.tsx` "web/dist(마지막 앱 빌드)가 출시 빌드면 미리 보기 0" · "번들 검사 표지가 지금 견본 · 줄 이름과 맞는다" · "부르는 곳은 시험판 상수 분기 안에서만" | 게이트 안 smoke 단계 |
| 스모크 | `smoke/run.mjs:59` 스모크를 `--mode trial`로 한 벌 더(`dist-trial` · 같은 빈 환경 폴더) · `playwright.config.ts:16` 두 번째 서버 4180 · `screens.smoke.ts:366` "설정 줄 -> C01 제자리 빛(곧) -> C03 긴 원문 스크롤 · 390 / 360"(스크롤 높이 > 화면 2배 · ‹ 이전 말 = 짧은 견본 · 기기 저장 견본 0) · `:396` "움직이는 유성(기본 모션) -> 누르면 C03" | chromium · webkit 4건 통과 |

**폰에서만 확인되는 것**(PE 합친 폰 확인 2차): V40 끊김 · 64pt 잡기(움직이는 유성) · 애니메이션 삭제 때 제자리 빛 · C03 긴 원문 스크롤 관성 · 기기 뒤로 가기(C03 닫기 → C01).

### ② 0인 조각 빼기 (R145-3 · 렌더러 · 개발 임시 수정 · 디자인 판으로 확정 예정)
| 자리 | 고친 곳 | 전 → 후(두 폰 커플 11월호) |
|---|---|---|
| 데이트 아카이브 오프너 `@da.lead`(3쪽) | `render/compose.py:293` `lead_text` · `:472` | "…6곳을 거치며 남긴 1장의 사진과 0개의 메모를 그대로 실었습니다." → "…6곳을 거치며 남긴 1장의 사진을 그대로 실었습니다." (메모만 · 둘 다 0이면 "…N곳을 거쳤습니다." · 장소 0이면 "N곳을 거치며" 뺌) |
| 장소 지도 머리 `@da.routeSummary`(5쪽) | `compose.py:310` `route_summary` · `:536` | "0개 지역 · 6개 장소" → "6개 장소" |
| (같은 종류) 오프너 `@da.records`(3쪽) | `compose.py:316` `records_line` · `:477` | "남긴 기록 · 메모 0 · AI 캡션 6" → "남긴 기록 · AI 캡션 6" |
| (같은 종류) 발행 노트 '싣지 않은 것' 사진 `dropped_stops` | `compose.py:961` | "구간 N곳(사진 0장) — 타임라인 …" → "구간 N곳 — 타임라인 …"(메모 쪽 `article_dropped_stops`와 같은 모양) |

같은 종류로 찾았지만 고치지 않은 자리(이유): `photo_note`(0이면 이미 빈 값) · `timeline_totals`(이미 0 조각 뺌 · R51-5) · `recalledPhotosLine`(0이면 줄 없음) · `@da.photoCount`(0이면 칸째 빠짐) · 근거 줄 "사진 N장"(사진이 있을 때만 생김) · 메모 쪽 `article_dropped_stops`(이미 처리) · 발행 노트 '문장의 출처' `sentencesPeople/Ondolog` "{n}개"(표 칸 값 - 0도 뜻 있는 값) · 오프너 첫 문장 "{n}번"(데이트 아카이브가 있으면 1 이상) · `@da.stopCount`(숫자 칸).
시험: Python `render/tests/test_h84_zero_fragments.py` - `LeadText`(둘 다 · 메모 0 · 사진 0 · 둘 다 0 · 장소 0 · 0 조각 전수) · `RouteSummary` · `SameKind`(records · 사진 0장) · `WholeIssue`(메모 0 · 지역 0 호 / 둘 다 있는 호는 그대로) 11건. **시드 6권 기대값 변화 0**(6권 모두 사진 · 메모 · 지역 · 장소 · 메모 합 > 0 - 바뀐 함수의 입력에 0이 없음).

임시 수정 목록(표시 주석 `개발 임시 수정 · 84-h · 디자인 판으로 확정 예정`): `compose.py:290-291`(세 함수 머리) · `:961`. 틀 변경 0.

### 렌더 (LLM 0 · 원격 0)
| 권 | 쪽 | safe · 잘림 · 넘침 | 사실 어긋남 | 시간 |
|---|---|---|---|---|
| vol1-photos | 14 | 0 | 0 | 33.2초 |
| vol2-opener-fallback | 12 | 0 | 0 | 21.8초 |
| vol2b-opener-typeonly | 12 | 0 | 0 | 19.3초 |
| vol3-long-original | 15 | 0 | 0 | 37.5초 |
| vol4-timeline-overflow | 14 | 0 | 0 | 26.9초 |
| vol5-batch2 | 15 | 0 | 0 | 30.0초 |
| vol3-fail | - | - | - | 기대대로 멈춤(한 대화 1185px > 938px) |
| G 1호(로컬 재렌더) | 14 | 0(디자인 5항목 같음) | - | 19.7초 |
| 두 폰 커플 11월호(로컬 재렌더) | 9 | 0(디자인 5항목 같음) | - | 9.7초 |

- 출력(git 밖): 시드 `render\out\84-h-local\` · G `render\out\84-h-G1\` · 11월호 `render\out\84-h-phone-nov\`(`issue.pdf` · `page-NN.jpg` · `audit.json` - 슬롯 전/후 기록 포함). 84-g와 같은 방식: 남은 채운 지면(`render\out\<호 id>\work\pages`) + 지금 `prepare_work` CSS + 지금 렌더러 함수가 만든 값으로 세 슬롯만 교체(스크립트는 저장소 밖 스크래치). G 1호는 0 조각이 없어 바뀐 슬롯 0. 원격의 발행 호 · PDF는 그대로 → 다음 실제 커플 호부터 정식 렌더 경로로 반영.
- 11월호 3쪽 · 5쪽(폴리오 03 · 05)이 위 "후" 문장으로 바뀐 것 쪽 그림으로 확인.

### 디자인 정정 묶음(R139-3)에 더할 한 줄씩 (84-h)
- "데이트 아카이브 오프너 `@da.lead` · `@da.records`와 장소 지도 머리 `@da.routeSummary`에서 0인 조각(‘0개의 메모’ · ‘메모 0’ · ‘0개 지역’)은 문장에서 빼는 것을 규칙으로 확정해 주세요(사진만 · 메모만 · 둘 다 0이면 ‘N곳을 거쳤습니다.’ - 렌더러가 임시로 그렇게 씀)."
- "발행 노트 '싣지 않은 것'의 ‘구간 N곳(사진 0장)’도 같은 규칙(괄호째 뺌)으로 확정해 주세요."
- (관찰만 · 고치지 않음) 오프너 본문 `.body`는 84-g 제목 임시 규칙 밖이라 11월호 3쪽 "실 / 었습니다"처럼 낱말 중간 줄바꿈이 남음 - 본문에도 `keep-all`을 둘지 디자인 판단.

### 결정 기록 (출처 R145-1~6)
1. C08에서도 띄움: 미리 보기로 연 하늘에서 둘러보기에 들어갈 때마다 하나(첫 C01 하나 + 진입마다). 나올 때는 아님.
2. C03 "미리 보기" 작은 표시: **넣지 않음**(보드에 없는 요소 - 위임 기본값). 견본 이름 · 설정 줄로 구분.
3. 미리 보기로 연 하늘은 실제 유성을 쉬게 함 - 한 번에 하나 · 실제 기록(`meteor` 범주)에 미리 보기 동안의 떨어짐이 섞이지 않게. 유성 설정이 꺼져 있어도 미리 보기는 뜸(확인 도구).
4. 빈 하늘 · 지난 하늘 · 시트 위에서는 실제 유성과 같은 조건으로 떨어지지 않음(조건 공유 `meteorCanShow`).
5. 설정 → 하늘 신호는 한 번 쓰고 지우는 모듈 값(주소 매개변수 아님 - 뒤로/앞으로 때 다시 뜨지 않게 · 하늘 시험이 라우터 없이 그리므로).
6. 출시 빌드 검사는 가짜 연결 값으로 운영 모드 빌드를 임시 폴더에 내서(실제 값 0 · 검사 뒤 지움) 표지를 찾음. 시험판 스모크는 같은 스모크 설정을 `--mode trial`로 한 벌 더(빈 환경 폴더 그대로 - 원격 값 0).
7. ② 같은 종류 중 고친 것 2건(`records` · 사진 0장 줄)은 위임 "같은 규칙으로 고칠 수 있으면 고침"에 따름. 표 칸 숫자(문장의 출처 "0개")는 문장 조각이 아니라 값이라 그대로.

검증: **`npm run gate` 통과 154.7초**(web tsc 8.2 · Vitest 26.3(72 파일 · 1222 통과 · 1 건너뜀) · 법무 4.5 · smoke 115.7(42/42 - 84-h 4건 포함 · 출시 빌드 미리 보기 표지 0 · 시험 빌드 표지 모두)) · 루트 tsc 0 · jest **130/2280** · Python **373 OK**(이전 362 · +11 · 516초) · `build`(실제 출시 빌드 `dist` 미리 보기 표지 0/6 · 스모크 표지 0) · `build:trial`(표지 6/6) · `cap sync`(맨 끝 1회 · android - 시험판 산출물). 키 · 주소 · id · 이메일 0 · 새 파일 이름 ASCII.

## `51- ③` 두 폰 커플 실제 모드 길 - 허용 목록 + 명시 플래그 (메인 세션, 2026-11-22, 위임문 `phase-7/51-3-dispatch-phone-couple-live.md` · 출처 ROADMAP r143 R143-4 · R141-3 · R140-5) - 길 완료 · 멈춤 0 · 실행은 Proteur (미커밋)

시작 확인: `DOC_REVISION: 2026-11-20-r143` · 84-g 커밋(`9e07e07`) 들어감 · 작업 트리 깨끗 - 통과. 위임 0(메인 세션 직접). **원격 0** · LLM 0 · 마이그레이션 0 · 새 패키지 0 · `web/` · `render/` · 엔진 0 · `demo_responses` 0 · 커밋 0. **저장소 밖 75- 허용 목록 파일은 열지도 고치지도 않음**(코드가 실행 때 읽기만 - 이 세션에서 읽은 적 0).

| # | 고친 곳 | 시험(jest `scripts/ops/phoneCouple513.test.ts` 21건 · 가짜 DB = 메모리 저장소 + 가짜 포트) |
|---|---|---|
| ① 두 겹 잠금 | 새 `scripts/ops/phoneTestCouple.ts` - `:22` 플래그 `--allow-phone-test-couple` · `:49` `phoneRunKind`(플래그 없으면 84-f 길 · `--couple-id`와 함께면 멈춤 · `--mode live` 또는 `--dry-run`만) · `:72` `phoneAllowlistEmails`(75- `resetAllowlist.ts`의 `parseAllowlist` · `makeResetGate` **그대로** - 파일 없음/못 읽음 · 형식 오류 · project= 없음 · 접속 주소 ref 불일치 · 이메일 0 → 멈춤, 접속 전) · `:122` `assertLiveTargetAllowed`(폰 커플 id가 있으면 그 커플만, 없으면 84-f `assertLiveTarget` 그대로 - 두 길을 섞지 않음). `generateIssue.ts:127` `LiveDeps.phoneTestCoupleId` · `:225` 잠금(DB를 읽기 전 · 아래 별명 "test" · active · AI 동의 · 모델 확인은 그대로) | "플래그 + --couple-id → 멈춤 …" · "허용 목록 파일이 없거나 못 읽으면 멈춤" · "형식 오류(줄 번호만) · project= 없음 · 접속 주소 ref 불일치 · 이메일 0 → 멈춤" · "목록만(플래그 없음) → 84-f 길: … 호 행 0 · LLM 0" · "플래그만(목록에 계정 없음) → 대상 커플 0개로 멈춤" · "둘 다 → 잠금 통과: 다음 확인(모델 설정)까지 간다 · 그 전에 호 행 0 · LLM 0" · "둘 다 + 별명 \"test\" 검사는 그대로" · "시드 목록 길은 그대로 · 두 길을 섞지 않는다" · 모든 멈춤 문구 id · 이메일 · ref 0(`clean`) |
| ② 대상 고르기(id 치기 0) | `phoneTestCouple.ts:101` `resolvePhoneTestCouple` - 허용 목록 이메일 → 계정 id → 두 구성원이 **모두** 그 계정인 커플(`dissolved` 제외) **정확히 1개**만 · 0 · 2개 이상은 개수만 담아 멈춤 · 읽기 = 새 `phoneOpsAdapter.ts:21`(75- `findUserIds`와 같은 방법 + `couples` 조회) · CLI `generateIssueCli.ts:91`(찾은 id는 어느 화면 줄에도 넣지 않음) · `:128` 대상 | "두 계정이 모두 목록에 있는 커플 1개 → 그 커플" · "0개 → 멈춤(개수만) - 계정 없음 · 한 계정만 목록에 · 해제 끝난 커플" · "2개 → 멈춤(개수만)" |
| ③ 미리 보기 `--dry-run` | 새 `scripts/ops/phonePreview.ts:83` `previewPhoneCouple` - 기록 범위(`phoneOpsAdapter.ts:61`) 안의 달마다 입력 조립(읽기) → 합계 · 날짜별(`YYYY-MM-DD 메시지 n · 데이트 n · 사진 n`) · 그 달 호 상태 · 코너별 재료 유무 · 추정 입력 토큰/정지 상한 + 선행 검사(P0 · 모델 설정). 다툰 날 표시 0 · 원문 · id 0 · 쓰기 0. CLI `generateIssueCli.ts:96` | "기간 후보(달) · 날짜별 개수 · 선행 검사 결과만 - 원문 · id · 이메일 0 · 쓰기 0" · "합계 = 날짜별 합" · "선행 검사 실패도 결과만 - …" · "달 목록 · KST 날짜" |
| ⑤ 한 줄 선택 날짜 | 새 `scripts/ops/sweetSubDates.ts:18` `sweetSubDays` · `:31` `sweetSubDateLines`(개발 프로젝트 · 별명 "test" · **발행된 호**만 · sub의 보낸 날 KST · 시각 순 · 날짜와 개수만) | "sub의 보낸 날(KST) · 시각 순 · 대화(main)는 세지 않는다 …" · "발행된 호 → 개수 + 날짜 줄만(원문 · 이름 · id 0)" · "발행 전 호 · 시험 커플 아님 → 멈춤 · …" |

**허용 목록을 읽는 곳**: `generateIssueCli.ts:55` `readAllowlistText`(경로 = 75- `resetAllowlist.ts` `resolveAllowlistPath` - 초기화 스크립트와 같은 규칙 · 경로 출력 0) → `:73` `phoneAllowlistEmails`. 플래그가 없으면 읽지 않는다. 읽은 이메일은 화면 출력 지울 값 목록에 더한다(`:86`).

### 51- ③ 실행 명령 (Proteur · 시작 메뉴 PowerShell · 저장소 맨 위 · **한 창** · 한 줄씩)

**1) 창 준비 · 보안 입력** - "최종 실측 실행 명령" 0) · 1) · 3-0)과 같다:
```
[Console]::OutputEncoding = [Text.Encoding]::UTF8
function m { process { "$_" -replace '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}','<id>' -replace '[\w.+-]+@[\w-]+\.[\w.-]+','<email>' } }
$s = Read-Host -AsSecureString "LLM 키"
$env:ONDOLOG_LLM_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)); Remove-Variable s
$env:ONDOLOG_LLM_API_KEY.StartsWith('sk-ant-')
$env:ONDOLOG_SUPABASE_URL = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString)).Password
$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString)).Password
$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY.StartsWith('sb_secret_')
$h = ([Uri]$env:ONDOLOG_SUPABASE_URL).Host
$al = Join-Path $env:USERPROFILE '.ondolog\reset-allowlist.txt'
Test-Path $al
```
→ 확인 줄 셋(`sk-ant-` · `sb_secret_` · `Test-Path`) 모두 `True`일 때만. 키는 운영용 **`ops_2026_11`**. 75- 목록을 다른 곳에 뒀으면 `$al = $env:ONDOLOG_RESET_ALLOWLIST`. 그 목록에 **두 폰 계정 이메일 둘 다**가 있어야 한다(없으면 "커플이 0개다"로 멈춤 - 목록은 Proteur가 직접 고친다).

**2) 84-g ④ 자기 점검 하네스 1회 → review → recheck** (원격 0 · 다정한 말만 · Sonnet 5.5):
```
deno run --no-lock --config supabase/functions/deno.json --allow-env=ONDOLOG_LLM_API_KEY --allow-net=api.anthropic.com --allow-read=. --allow-write=scripts/ops/out scripts/ops/m1QualityRun.ts run --model claude-sonnet-5-5 --fixture m1-month-conflict --corner sweet_words --runs 1 --tag selfcheck 2>&1 | m
deno run --no-lock --config supabase/functions/deno.json --allow-read=. --allow-write=scripts/ops/out scripts/ops/m1QualityRun.ts review 2>&1 | m
deno run --no-lock --config supabase/functions/deno.json --allow-read=. --allow-write=scripts/ops/out scripts/ops/m1QualityRun.ts recheck 2>&1 | m
```
→ `scripts/ops/out/review.md` · `recheck.md`의 "자기 점검 시험 (84-g ④ …)" 절 3칸(고른 줄 중 다툰 날 · 화해 줄 / 그중 conflict 표시 / 표시 없이 남아 실림 = 실패)을 PE에게.

**3) 두 폰 커플 미리 보기** (쓰기 0 · LLM 0 · 커플 id 치기 0):
```
deno run --no-lock --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_RESET_ALLOWLIST,USERPROFILE,HOME --allow-net=$h --allow-read="supabase/.temp/linked-project.json,$al" scripts/ops/generateIssueCli.ts --allow-phone-test-couple --dry-run 2>&1 | m
```
→ "두 폰 커플 길(51- ③): … 1개 - 확인됨" · 선행 검사 `통과` · 모델 `허용 - claude-sonnet-5-5` · 달마다 `## YYYY-MM` + 날짜별 개수 · 코너 재료. Proteur가 **기간 한 달**(3일치 기록이 있는 달 · 그 달 호 "없음" 또는 "초안 있음")을 정해 그 줄의 `--period-start` · `--period-end` 값을 아래 변수에 넣는다:
```
$ps = '2026-11-01'; $pe = '2026-12-01'
```

**4) 생성 → 렌더 → 발행** (렌더는 발행 전 - "최종 실측" 4) 순서 정정 그대로)

4-1. 생성(실제 모드 · Sonnet 5.5는 `app_config.llm_provider` · 플래그):
```
deno run --no-lock --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_LLM_API_KEY,ONDOLOG_RESET_ALLOWLIST,USERPROFILE,HOME --allow-net="$h,api.anthropic.com" --allow-read="supabase/.temp/linked-project.json,scripts/ops/out,$al" --allow-write=scripts/ops/out scripts/ops/generateIssueCli.ts --allow-phone-test-couple --mode live --period-start $ps --period-end $pe 2>&1 | m
$iid = (Get-ChildItem scripts\ops\out\generate-*.json | Sort-Object LastWriteTime | Select-Object -Last 1).BaseName -replace '^generate-',''
$g = Get-Content "scripts\ops\out\generate-$iid.json" -Raw -Encoding UTF8 | ConvertFrom-Json; $g.mode -eq 'live' -and $g.period.start -eq $ps
```
→ 마지막 줄 `True`(방금 만든 이 기간의 실제 모드 결과). 코너 셋 `ready`가 아니면 아래 "떨어지면".

4-2. 렌더(키를 렌더용 **`render_2026_11`**로):
```
$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString)).Password
$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY.StartsWith('sb_secret_')
render\.venv\Scripts\python.exe render\render_issue.py --issue-id $iid 2>&1 | m
Invoke-Item "render\out\$iid\issue.pdf"
```
- 렌더 · 발행은 별명 "test"만 본다(`render_issue.py:746` · `publishIssue.ts:50`) - 폰 커플 별명이 시험 이름이라 통과(84-f 7) 절). 두 겹 잠금은 **LLM을 부르는 생성에만** 있다.

4-3. 발행(키를 다시 `ops_2026_11`로):
```
$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString)).Password
$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY.StartsWith('sb_secret_')
deno run --no-lock --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY --allow-net=$h --allow-read=supabase/.temp/linked-project.json --allow-write=scripts/ops/out scripts/ops/publishIssueCli.ts --issue-id $iid 2>&1 | m
```

4-4. 유성 날짜 계산용(⑤ · 읽기만 · 발행 뒤):
```
deno run --no-lock --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY --allow-net=$h --allow-read=supabase/.temp/linked-project.json scripts/ops/sweetSubDates.ts --issue-id $iid 2>&1 | m
```
→ "다정한 말 한 줄 선택 N개 - 보낸 날(KST, 시각 순):" + 날짜 줄. 이 줄만 PE에게(유성은 7일 지난 말부터 - `meteorRules.ts` `MIN_AGE_MS`). 0개면 그대로 PE에게.

**5) 끝내기**: 창을 닫고 새 창에서
```
[bool]$env:ONDOLOG_LLM_API_KEY; [bool]$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY; [bool]$env:ONDOLOG_SUPABASE_URL
```
→ 셋 다 `False`.

### 원격에 쓰는 것 · 비용 상한
| 명령 | 원격에 쓰는 것 | 상한 |
|---|---|---|
| 2) 하네스 · review · recheck | **0**(권한이 `api.anthropic.com`뿐 · 결과는 로컬 `scripts/ops/out`) | 명령 1회 $10(`HARNESS_BUDGET_USD`) · 예상 **약 $0.07**(최종 실측 다정한 말 1회 $0.056~0.070) |
| 3) 미리 보기 | **0**(인증 계정 목록 · `couples` · `profiles` · `messages` · `dates` · `date_stops` · `data_entries` · `issues` · `app_config` 읽기만) | LLM 0 |
| 4-1) 생성 | 두 폰 커플의 그 달 `issues` 초안 행 1(있으면 재사용) · `corners` 행 3(insert · 내용 · status · `llm_usage` · `source_date_ids`) · `ops_alerts`(정지 · 상한 때만) · 스토리지 `entries` → `magazine` 사진 복사 - 모두 그 호 · 그 커플 | **1호 $2**(`ISSUE_BUDGET_USD`) · 예상 **약 $0.2**(G 1호 $0.216 · 3일치라 더 적을 수 있음) |
| 4-2) 렌더 | 스토리지 `magazine/{커플}/{호}/render/`(디지털 PDF + 쪽 그림 - 인쇄용 0) · 그 호 `issues` 렌더 세 칸 | LLM 0 |
| 4-3) 발행 | RPC `fn_publish_issue` → 그 호 발행 칸 · 그 호 `corners` `ready → published` · 그 커플 `dates` 재소환 칸. **발행 뒤 두 폰 앱에 호가 보인다**(의도) | LLM 0 |
| 4-4) 한 줄 선택 날짜 | 0(읽기만) | LLM 0 |

### 떨어지면
- 하네스: 2) 첫 줄을 태그 `selfcheck2`로 다시(이번 결과를 덮지 않음).
- 생성: **4-1 첫 줄을 그대로 다시**(같은 초안 재사용 · `ready` 코너는 다시 만들지 않음 · 떨어진 코너만 LLM). 다시 생성하면 렌더 칸이 비워지므로 4-2 · 4-3도 다시. 발행된 호는 다시 생성하지 않는다(멈춤).
- 미리 보기 · 생성이 "허용 목록 …"이나 "커플이 N개다"로 멈추면 그 줄만 PE에게(목록 · 폰 계정 확인).

### 결정 기록 (출처 R141-3 · R143-4)
1. 허용 목록 = 75- 0-6 초기화 스크립트 목록 **그 파일 · 그 해석 함수**(`resetAllowlist.ts`) - 새 목록 0(R141-3 "이미 사람이 관리하는 단일 근거"). project= 줄 · 접속 주소 대조도 같은 문(gate).
2. 플래그가 있으면 `--couple-id`를 받지 않는다 - 대상은 목록에서만 정한다(id 치기 · 보기 0). 플래그 실행에서 시드 커플, 시드 실행에서 폰 커플은 멈춤(두 길 섞지 않음).
3. 후보 = 두 구성원이 **모두** 목록 계정인 커플 · `dissolved` 제외 · 정확히 1개. active · 별명 "test" · AI 동의는 생성의 기존 확인이 그대로 본다(미리 보기도 결과를 보여 줌).
4. 플래그는 `--mode live` 또는 `--dry-run`과만(샘플 출력을 폰 커플에 쓰지 않는다). 미리 보기는 LLM 키 없이 돈다.
5. 목록 이메일은 화면 · 결과 파일의 지울 값 목록에 넣는다. 찾은 커플 id는 어느 화면 줄에도 넣지 않는다(미리 보기 · 결과 줄은 개수 · 호 id만 - 호 id는 `m`이 가림). 로컬 결과 파일(`generate-<호>.json`, git 밖)은 84-f와 같은 모양(A-27 시험 `opsCliOutput.test.ts`의 `writeJson(file, report, hidden)` 그대로).
6. 두 겹 잠금은 LLM을 부르는 생성에만 둔다 - 렌더 · 발행 · ⑤는 기존 별명 "test" 확인 그대로(LLM 0).
7. 미리 보기 달 수 상한 24(마지막 달부터) · 입력 조립 호 id는 자리 값(쓰기 · 출력 0).

검증: **`npm run gate` 통과 197.9초**(smoke 38/38 · `web/` 변경 0) · 루트 tsc 0 · jest **130/2280**(이전 129/2259 · 새 파일 1개 21건 · PGlite 포함 - 첫 전체 실행에서 `seed2025_84f.test.ts` 첫 시험이 부하로 5초 한도를 넘어 뒤 2건이 이어 실패, 그 파일만 다시 8/8 · 전체 다시 130/2280 통과 - 84-g까지의 흔들림 종류) · deno check(`generateIssueCli.ts` · `sweetSubDates.ts` · `phonePreview.ts` · `phoneTestCouple.ts` · `phoneOpsAdapter.ts` · `publishIssueCli.ts` · `resetTestAccount.ts` · `m1QualityRun.ts` · `seedTestData.ts` · `push-send/index.ts`) 통과 · deno test `resetTestAccountCheck.ts` 28 통과(75- 잠금 그대로). 키 · 주소 · ref · id · 이메일 0(시험 이메일 꼴만) · 새 파일 이름 ASCII · 허용 목록 파일 열람 · 변경 0.

## `84-g` 실제 커플 첫 호 전 손질 - "유저" 0 · 근거 날짜 · 조판 2 · 자기 점검 시험 데이터 (메인 세션, 2026-11-22, 위임문 `phase-7/84-g-dispatch-first-issue-polish.md` · 출처 ROADMAP r143 R143-1~6) - 완료 · 멈춤 0 (미커밋)

시작 확인: `DOC_REVISION: 2026-11-20-r143` - 통과. 위임 0(메인 세션 직접 · 앞 세션이 중간에 멈춘 작업 트리를 이어 받아 검토 · 확인). LLM 0 · 원격 0(허용 질의 없음) · 마이그레이션 0 · 새 패키지 0 · `web/` 0 · `demo_responses` 0 · 실제 데이터 0 · 디자인 틀(`render/issue/`) 0 · 커밋 0.

| # | 고친 곳 | 시험 |
|---|---|---|
| ① "유저" · "사용자" 지면 0 | 프롬프트 공통 원칙 한 줄 `cornerCommon.ts:117`(+ `:112` 원칙 문장 · `dateArchive.ts:281-296` · `thisMonth.ts:250-251`의 지시문 "유저" → "두 사람" - R134-1 프롬프트도 검사 기준과 같게) · 값 검사 `valueChecks.ts:48` `FORBIDDEN_PERSON_EXPRESSIONS` · `:56` `withoutQuoted`(84-c 따옴표 여섯 쌍) · `:98-101` 검사(부분 문자열 · 따옴표 밖) → 지금의 재요청 1 → 빠짐 · 문서 `ONDOLOG_CORNER_CONTENT.md` 값 검사 절 | jest `supabase/functions/_shared/corners/personWords84g.test.ts` 13건: "AI 문장 \"유저가 남긴\" → 걸림" · "\"사용자 이름\"처럼 붙은 말도 걸림" · "원문 인용(따옴표) 안의 … → 통과" · "따옴표 빼기는 84-c `stripQuoted`와 같다" · "지금의 재요청 → 빠짐 … 보낸 수 2" · "프롬프트 지시문 자체는 그 한 줄 말고 … 쓰지 않는다" |
| ② 근거 날짜 여러 날 | 렌더러 `render/compose.py:668` `evidence_line` - `:687` 메시지 근거 날짜가 둘 이상이면 발췌마다 그 날짜(`09.25 “…” · 09.26 “…”`) · `:688` 날짜만 서는 긴 발췌는 같은 날짜가 이미 발췌 앞에 있으면 다시 쓰지 않음 · 한 날이면 전과 같음 | Python `render/tests/test_g84_polish.py` `EvidenceDays`: `test_one_day_is_unchanged` · `test_two_days_date_each_excerpt` · `test_three_days` · `test_other_evidence_and_year_rules_kept` |
| ③ 조판 2건(개발 임시 수정 · R50-6) | 틀은 그대로 · 렌더러가 작업 폴더 `base.css` 사본 끝에 붙임: `render_issue.py:370-379` `DEV_TEMP_CSS_84G` · `:396` `prepare_work`. (a) 제목 `h1,h2,h3,.h-display,.h-art,.h-lead,.h-sec{word-break:keep-all;overflow-wrap:break-word}` (b) 발행 노트 막대 `[data-slot="@note.ratioPeople"],[data-slot="@note.ratioOndolog"]{margin-left:.3em}` | `test_g84_polish.py` `DevTempCss`: `test_appended_only_to_work_copy`(원본 틀에 84-g 0 · 사본만) · `test_rules`(높이 표가 잰 칸 선택자 0) |
| ④ 자기 점검 시험 데이터 | 새 `scripts/ops/fixtures/m1-month-conflict/dataset.ts`(바탕 `m1-month` 그대로 + 다툰 날 09-16 · 17 · 화해 직후 09-18 아침의 다정해 보이는 줄 10 - `:23` · `:81` `buildConflictTables` · `:103` `conflictContextIds`) · 새 `scripts/ops/selfCheckTally.ts`(`:28` `resolveRunFixture` = `--fixture`는 `--corner sweet_words`와만 · 키 읽기 전 멈춤 · `:83` `tallySelfCheck` 3칸 · `:106` 표) · 하네스 `m1QualityRun.ts:267` 인자 · `:404` 파일 이름 · `m1Review.ts:93` `runFileName`(기본 데이터는 84-g 전 이름 그대로) · `:241` review 따로 묶음 · `m1Recheck.ts:50` `tablesOf` · `:178` recheck 따로 묶음 + 집계 | jest `scripts/ops/selfCheck84g.test.ts` 10건: "바탕 데이터는 그대로" · "없음 = 기본 m1-month(84-g 전과 같음)" · "자기 점검 데이터는 --corner sweet_words와 함께만" · "기록 파일 이름 - 기본은 84-g 전 그대로" · "고른 줄 중 다툰 날 · 화해 2 / 그중 conflict 표시 1 / 표시 없이 남아 실림 1(= 실패)" · "다툰 날 줄을 고르지 않으면 0 · 0 · 0" · "review · recheck가 따로 묶는다" |
| 함께 | recheck가 값 검사(길이 · 금지 표현)도 돌림 - 골격과 같은 함수(`m1Recheck.ts:147`) · 표에 `길이` · `금지` 칸 · 상세 줄에 태그(84b · final) | 위 jest |

### recheck (`m1QualityRun.ts recheck` · LLM 0 · 원격 0)
- 합계 **시도 30 · 위반 40**. 84-g 줄: **「유저」 시도 2(그중 실림 1) · 줄 2 · 「사용자」 0**.
  - 잡혀야 할 것: **이달의 우리 r2(final) 시도2(실림) `articles[].body` 「유저」**(따옴표 밖 AI 문장 - 원문 확인) - 최종 실측의 "다시 쓰고 싶은 문장 1"(R143-1). 같은 종류로 r1(84b) 시도1(안 실림)도 잡힘.
  - 새 `길이` 3 = 84b this_month r1 시도1 · 2(closing 48 · 43 > 42) · r2 시도1(theme.lead 128 > 126) - **실행 때 골격이 이미 그 이유로 거절한 시도와 값까지 같음**(기록 `validation.detail` 대조) → 오탐 0.
  - final 줄: r2 시도1 요일(알려진 재요청 1) · r2 시도2 「유저」 - 그 밖 0. 다른 오탐 0.

### 렌더 (LLM 0 · 원격 0)
| 권 | 쪽 | safe | 잘림(원문/기록) · 넘침 | 사실 어긋남 | 환경 경고 | 타임라인 과소 | 시간 |
|---|---|---|---|---|---|---|---|
| vol1-photos | 14 | 0 | 0 · 0 | 0 | 0 | 0 | 69.5초 |
| vol2-opener-fallback | 12 | 0 | 0 · 0 | 0 | 0 | 0 | 36.5초 |
| vol2b-opener-typeonly | 12 | 0 | 0 · 0 | 0 | 0 | 0 | 30.2초 |
| vol3-long-original | 15 | 0 | 0 · 0 | 0 | 0 | 0 | 64.2초 |
| vol4-timeline-overflow | 14 | 0 | 0 · 0 | 0 | 0 | 0 | 44.4초 |
| vol5-batch2 | 15 | 0 | 0 · 0 | 0 | 0 | 0 | 60.0초 |
| vol3-fail | - | - | - | - | - | - | 기대대로 멈춤(한 대화 1185px > 938px) |
| **G 1호(로컬 재렌더)** | 14 | 0 | 0 · 0(기록 clipped 0) | - | - | - | 25.3초 |

- **G 1호 PDF: `render\out\84-g-G1\issue.pdf`**(쪽 그림 `page-NN.jpg` · `audit.json` 같은 폴더 · git 밖). 11-20 렌더(`render\out\daf34aa9-…\`)가 남긴 채운 지면 HTML · 사진을 그대로 쓰고, 스타일은 지금 `prepare_work`(③), 이달의 우리 근거 줄은 지금 `evidence_line`으로 다시 만듦(②) - 근거 메시지 날짜는 G에 시드된 `m1-month` 원문 날짜(`chat.ts:298` 09-25 · `:313` 09-26). 전체 다시 짜기는 원격 읽기가 필요해 하지 않음 → **51- ③ 뒤 실제 커플 첫 호는 정식 렌더 경로 그대로**.
  - 2쪽 막대 "두 사람 48%" · "온도록 52%" 띄어 씀. 3쪽 제목 "카페에서 서울숲, 뚝섬 / 저녁집까지"(전 "뚝섬 저 / 녁집까지"). 12쪽 소기사 3 "근거 · 09.25 “9시 40분 어때” · 09.26 “응 용산역 개찰구 앞”"(전 "근거 · 09.25 · “9시 40분 어때” · “응 용산역 개찰구 앞”") · 소기사 1(한 날 09.07)은 그대로.
- **③(a) 줄 수 비교**: 시드 6권 + G 1호의 모든 지면에서 제목 · 모든 `data-slot` 칸 높이를 84-g CSS 켠 것 / 끈 것으로 재어 비교 → **높이 차이 0 · clamp로 잘린 제목 0**(G 3쪽 제목은 줄바꿈 자리만 바뀌고 두 줄 그대로). 높이 표 `measure.json`이 잰 칸(메모 · 캡션 · 장소 · 인용)은 임시 CSS 선택자 밖이고 `measure.py`는 원본 틀 CSS로 잰다 → 줄 수가 바뀌지 않아 무작위 견본 과소 예측 재확인 조건에 해당 없음(84-d2 값 70개 과소 0 유지).

### 개발 임시 수정 목록 (R50-6 · 디자인 판으로 확정 예정)
1. `render/render_issue.py:370` `DEV_TEMP_CSS_84G` (a) 제목 낱말 단위 줄바꿈 - 표시 주석 `개발 임시 수정 · 84-g · 디자인 판으로 확정 예정`(코드 주석 + 붙이는 CSS 주석 둘 다).
2. 같은 곳 (b) 발행 노트 "문장의 출처" 막대 라벨 · 비율 사이 띄어쓰기.
- 틀 파일(`render/issue/`) 변경 0 - 렌더러 쪽에서 처리.

### 디자인에 보낼 조판 정정 2건 (R139-3 묶음에 PM이 더함 - 한 줄씩)
- "제목 활자(`h1 · h2 · h3 · .h-display · .h-art · .h-lead · .h-sec`)에 `word-break: keep-all; overflow-wrap: break-word`를 넣어 한국어 제목이 낱말 중간에서 줄바꿈되지 않게 해 주세요(시험 1호 3쪽 '뚝섬 저 / 녁집까지' - 렌더러가 임시로 붙여 둠)."
- "`note.html` '문장의 출처' 막대의 라벨과 비율 사이가 flex 안에서 붙어 '두 사람48%'로 보입니다 - `@note.ratioPeople` · `@note.ratioOndolog` 앞에 간격(렌더러 임시 `margin-left: .3em`)을 틀에 넣어 주세요."

### ④ 51- ③ 때 칠 하네스 명령 (키 입력은 위 "최종 실측 실행 명령" 0) · 1) 그대로)
```
deno run --no-lock --config supabase/functions/deno.json --allow-env=ONDOLOG_LLM_API_KEY --allow-net=api.anthropic.com --allow-read=. --allow-write=scripts/ops/out scripts/ops/m1QualityRun.ts run --model claude-sonnet-5-5 --fixture m1-month-conflict --corner sweet_words --runs 3 --tag selfcheck 2>&1 | m
```
그다음 `review` · `recheck`(위 2) 그대로) → `review.md` · `recheck.md`의 "자기 점검 시험 (84-g ④ …)" 절의 3칸. 결과 파일 `claude-sonnet-5-5__sweet_words__selfcheck__m1-month-conflict__r1~3.json`(기본 실행 파일을 덮지 않음). 예상 비용: 최종 실측 다정한 말 1회 $0.056~0.070(입력 약 1.9~2.2만 토큰) → **3회 약 $0.20 · 재요청이 모두 나도 약 $0.45** · 명령 1회 상한 $10(`HARNESS_BUDGET_USD`).

### 결정 기록 (출처 R143-1~6)
1. 금지 낱말은 부분 문자열로 찾는다("사용자 이름" · "사용자들" 걸림) · 따옴표 밖만 - 84-c `stripQuoted`와 같은 여섯 쌍을 `valueChecks.ts` 안에 사본(이 폴더 파일은 서로 가져오지 않음 · 두 함수 결과가 같은지 시험이 봄). 84-a 정책어 목록은 따옴표 제외를 새로 더하지 않음(동작 변화 0).
2. 프롬프트 공통 원칙 한 줄에 더해, 지시문에 있던 "유저" 낱말도 "두 사람"으로 바꿈(R134-1 - 예문 · 지시가 검사 기준과 같게). 한 줄 자체 말고는 프롬프트에 "유저" · "사용자" 0(시험).
3. 근거 날짜: "여러 날" 판정은 메시지 근거의 날짜만 센다(사진 · 데이트 근거는 전과 같음). 여러 날이면 날짜만 서는 긴 발췌는 같은 날짜가 이미 발췌 앞에 있으면 빼서 같은 날짜를 두 번 쓰지 않음.
4. 조판은 틀을 고치지 않고 렌더러가 작업 폴더 사본에 CSS를 붙임(R50-6 "렌더러 쪽 먼저"). 높이 표가 잰 칸은 선택자 밖.
5. 자기 점검 데이터는 다정한 말만(`--fixture m1-month-conflict`는 다른 코너 · `all`과 함께면 키 읽기 전 멈춤). 기본값 · 기본 파일 이름은 84-g 전과 같음. 세는 단위 = 고른 항목(대화 하나 · 한 줄), 고른 수 · 표시 수는 마지막 응답, 실린 수는 저장 내용(성공 회차).
6. G 1호는 원격 0 조건이라 11-20 채운 지면 + 지금 CSS + 지금 근거 줄 함수로 로컬 재렌더(위 렌더 절). 원격의 G 1호 행 · PDF는 그대로.

검증: **`npm run gate` 통과 198.8초**(smoke 38/38 · `web/` 변경 0) · 루트 tsc 0 · jest **129/2259**(이전 127/2236 · 새 시험 파일 2개 23건 · PGlite 포함) · deno check(`m1QualityRun.ts` · `m1Recheck.ts` · `m1Review.ts` · `selfCheckTally.ts` · `fixtures/m1-month-conflict/dataset.ts` · `generateIssueCli.ts` · `seedTestData.ts` · `publishIssueCli.ts` · `push-send/index.ts`) 통과 · Python **362 OK**(이전 356 · +6 · 922초) · recheck 위 숫자 · 렌더 위 표. 키 · 주소 · id · 이메일 · 생성 문장 0(위 지면 인용은 시험 데이터 합성 대화 · 제목) · 새 파일 이름 ASCII.

## `84-f` 2025년 시험 커플 G 시드 · 실제 모드 대상 잠금 (메인 세션, 2026-11-20, 위임문 `phase-7/84-f-dispatch-seed-2025-couple.md` · 허가 ROADMAP r141 R141-2 · 출처 R140-4 · R134-6) - 완료 · 멈춤 0 (미커밋)

시작 확인: `DOC_REVISION: 2026-11-20-r141` - 통과. 위임 0(메인 세션 직접). **원격 실행 0**(시드는 Proteur 사람 실행 - "최종 실측 실행 명령" 3)) · LLM 0 · 마이그레이션 0 · 새 패키지 0 · `web/` · `render/` · 엔진 0 · `demo_responses` 0 · 커밋 0. 기존 A/B/C/F · `seed-m2b.json` · 51- 폰 커플은 읽지도 바꾸지도 않음(코드가 찾는 것은 G의 두 이메일과 초대 코드 `TESTG001`뿐).

| # | 고친 곳 | 시험 |
|---|---|---|
| ① 새 실행 `run-2025` = 2025 합성 데이터로 새 시험 커플 G 하나 | 새 `scripts/ops/seedCouple2025.ts`(본체 · `SeedPort` - `:21` `SEED_2025` · `:91` `seedCouple2025`) · `seedTestData.ts:355` 실행 이름 · `:359` Supabase 어댑터 · `:409` `run-2025`. 계정 `test-m2b-g1/g2@example.com`(비밀번호 없음) · 별명 `test-m2b-G` · 초대 코드 `TESTG001` · 데이터셋 `fixtures/m1-month` 그대로(2025 · 다툰 날 포함) · 프로필에 AI 동의(생성 P0 조건 - 기존 시드와 같음) · 목록 새 파일 `scripts/ops/out/seed-m2b-2025.json` | PGlite `scripts/ops/seed2025_84f.test.ts`: "새 커플 하나 · … · 기존 커플 A 행 수 변화 0" · "메시지 날짜는 2025-09(KST) · 다툰 날 2025-09-16 · 09-17 대화가 들어 있다"(09-16 32건) |
| ② 다시 쳐도 안전 | `seedCouple2025.ts:99-113` - 초대 코드로 G를 찾아 표 4개 행 수가 데이터셋과 같으면 **건너뜀(쓰기 0)** · 계정만 남았으면 이어 씀 · G가 있는데 데이터가 일부만 있으면 **쓰지 않고 멈춤**(중복 행 0) · 초대 코드가 G가 아닌 커플에 있으면 멈춤 | "다시 쳐도 안전 - … 쓰기 0 · 행 수 같음" · "데이터 일부만 가진 흔적이면 쓰지 않고 멈춘다" · "계정만 남은 경우 이어 쓴다" · "초대 코드가 G가 아닌 커플에 쓰여 있으면 멈춘다" |
| ③ 실패 때 목록 덮어쓰기 결함 | `seedCouple2025.ts:219` `recordSeedOutcome`(성공 때만 목록 파일 · 실패 → 목록 그대로 + `*.failed.json` · 건너뜀 → 파일 0) · `:211` `failedListPath`. **기존 `run`도 같은 규칙으로**(`seedTestData.ts:425` - 전 `:418-420` `finally`가 실패 때 `seed-m2b.json`을 덮어썼다) | "중간 실패 → 목록 파일 그대로 · … .failed.json" · "성공 → 목록 파일을 새 값으로 · 건너뜀 → 아무 파일도 쓰지 않음" |
| ④ 실제 모드 대상 잠금 | `opsGuards.ts:93` `isSeedListFile` · `:100` `seedListCoupleIds`(목록 중 별명 test인 커플 id) · `:122` `assertLiveTarget`(문구에 id 0) · `generateIssue.ts:120` `LiveDeps.seedCoupleIds` · `:215` 실제 모드면 **DB를 읽기 전에** 잠금 → 그다음 기존 별명 검사(둘 다) · `generateIssueCli.ts:51` 로컬 `scripts/ops/out/seed-m2b*.json` 읽기(못 읽으면 빈 목록 → 멈춤) · `opsGuards.ts:88` 멈춤 문구에서 커플 id 뺌(전 `:83`) | jest `scripts/ops/liveTarget84f.test.ts` 8건: 목록에 있는 id 통과 · "별명은 test인데 목록에 없는 커플(= 51- 폰 커플 경우)은 DB를 읽기 전에 멈춘다 - LLM 0 · 호 행 0 · 문구에 id 0" · 목록 비면 멈춤 · 목록에 있어도 별명 아니면 멈춤 · 샘플 모드는 그대로 · 두 문구 id 0 / `liveMode84a.test.ts`(LiveDeps에 목록) |
| ⑤ HANDOFF "최종 실측 실행 명령" 갱신 | 3) 시드 = `run-2025`(3-0 접속 · 3-1 이미 있는지 `Test-Path` · 3-2 명령 · 멈추면 `.failed.json`) · 4) 대상 = G(`$cid`는 `seed-m2b-2025.json`의 `G` · `test-m2b-G`) · 기간 2025-09 · 생성 → 렌더 → 발행 · 가리개 `m` · `migration list` 그대로 · 생성 `--allow-read`에 `scripts/ops/out`(잠금이 목록을 읽음) · 5) 표에 시드 행 · 7) 잠금 근거 · 8) 9) G | - |
| 함께 | `seedTestData.ts` 접속 줄이 프로젝트 ref를 출력하던 것 → `CONNECTED_LINE`(ref 출력 0 · 지울 값 목록에 ref) - 생성 명령(A-27)과 같게. 출력 가리개 `m`은 ref를 못 가린다 | deno check |

### 시드가 원격에 쓰는 것 (`run-2025`, 처음 한 번)
인증 계정 2 · `profiles` 2 · `couples` 1 · `dates` 4 · `date_stops` 9 · `data_entries` 18 · `messages` 302 · 스토리지 `entries/{커플 G}/*.png` 15(사진 14 · 그림 1) - 모두 새 커플 G의 것. 다시 치면 0.

### 결정 기록 (출처 R140-4 · R134-6 · R141-2)
1. 새 커플 이름 · 코드: `test-m2b-G` · `TESTG001` · `test-m2b-g1/g2@example.com`(저장소 안 다른 사용처 0 확인).
2. "이미 있음" 판정 = 초대 코드 `TESTG001`의 커플이 있고 표 4개 행 수가 데이터셋과 같을 때. 일부만 있으면 정리 전에는 쓰지 않는다(다시 넣으면 중복 행).
3. 실패 기록은 목록과 다른 파일 `*.failed.json`(성공 목록을 덮지 않으면서 정리할 행 · 파일은 남김). `.failed.json`은 잠금의 목록이 아니다(반쯤 만든 커플로 실제 모드가 돌지 않게).
4. 잠금은 실제 모드에만 · DB를 읽기 전에 · 목록 + 별명 둘 다. 샘플 모드는 그대로(별명만). 폰 커플 실제 모드의 길(R141-3)은 이 위임 밖.
5. 옛 `run`의 본문은 그대로(들여쓰기만) - 목록 쓰기 규칙만 고침. 옛 `run`은 다시 치지 않는다(HANDOFF 최종 실측 3)).
6. PGlite 시험은 `scripts/ops/`에 둔다(`__tests__/db`에 두면 Deno식 `.ts` 가져오기 때문에 루트 tsc가 `scripts/ops`를 끌어들여 깨진다 - 다른 ops 시험과 같은 자리 · jest가 돌림).

검증: **`npm run gate` 통과 137.1초**(smoke 38/38 · `web/` 변경 0) · 루트 tsc 0 · jest **127/2236**(이전 125/2220 · 새 시험 파일 2개 16건 · PGlite 포함) · deno check(`seedTestData.ts` · `generateIssueCli.ts` · `publishIssueCli.ts` · `m1QualityRun.ts` · `m1Recheck.ts` · `m1Review.ts` · `push-send/index.ts`) 통과. 키 · 주소 · ref · id · 이메일 값 0(시험 이메일 꼴만) · 새 파일 이름 ASCII.

## 최종 실측 실행 명령 (R135-4 · R140-4 · 84-f 갱신 R141-2, 메인 세션 2026-11-20 - 명령만 · 원격 실행은 Proteur)

> Proteur · 시작 메뉴에서 연 PowerShell · 저장소 맨 위 폴더 · **한 줄씩**. 키 · 주소 · id · 이메일은 명령에 0. 출력은 아래 `m`(가리개)을 거쳐 id · 이메일이 `<id>` · `<email>`로 보인다.
> 판정 · 체크리스트는 `phase-7/final-measure-guide-for-proteur.md` 5절.

### 3) 시드 - 84-f로 풀림
- 0단계 멈춤(원격 시험 커플 A/B/C/F = 10-22의 **2026년** 날짜 · 기존 `run` 재실행은 중복으로 멈추고 목록을 덮어씀)은 84-f로 풀었다: **새 실행 `run-2025`**가 2025년 합성 데이터로 **새 시험 커플 G 하나**만 만든다(`scripts/ops/seedCouple2025.ts` · HANDOFF "`84-f`"). 기존 A/B/C/F · `seed-m2b.json`은 읽지도 바꾸지도 않는다.
- 다시 쳐도 안전(이미 있으면 쓰기 0) · 목록은 새 파일 `scripts/ops/out/seed-m2b-2025.json`(성공했을 때만 씀) · 실제 모드는 시드 목록에 있는 커플만(아래 7).
- **`seedTestData.ts run`(옛 실행)은 치지 않는다.**

### 0) 창 준비 (한 번)
```
[Console]::OutputEncoding = [Text.Encoding]::UTF8
function m { process { "$_" -replace '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}','<id>' -replace '[\w.+-]+@[\w-]+\.[\w.-]+','<email>' } }
```
- 첫 줄: Deno · Python의 한글 출력이 파이프에서 깨지지 않게(HANDOFF 77- 0-2와 같은 문제). 둘째 줄: 화면에 나오는 id(uuid) · 이메일을 가린다(`generateIssueCli.ts:69` 등이 호 id를 출력하고, 멈춤 문구에 커플 id가 들어가서 - `opsGuards.ts:83`).

### 1) LLM 키 보안 입력 (이 창의 환경 변수만)
```
$s = Read-Host -AsSecureString "LLM 키"
$env:ONDOLOG_LLM_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)); Remove-Variable s
$env:ONDOLOG_LLM_API_KEY.StartsWith('sk-ant-')
```
→ `True`일 때만 계속. 값이 화면에 찍히는 줄 0(사용자 · 시스템 범위 저장 0 - R87-6).

### 2) 하네스 Sonnet 5.5 × 3 → review → recheck (원격 0)
```
deno run --no-lock --config supabase/functions/deno.json --allow-env=ONDOLOG_LLM_API_KEY --allow-net=api.anthropic.com --allow-read=. --allow-write=scripts/ops/out scripts/ops/m1QualityRun.ts run --model claude-sonnet-5-5 --runs 3 --tag final 2>&1 | m
deno run --no-lock --config supabase/functions/deno.json --allow-read=. --allow-write=scripts/ops/out scripts/ops/m1QualityRun.ts review 2>&1 | m
deno run --no-lock --config supabase/functions/deno.json --allow-read=. --allow-write=scripts/ops/out scripts/ops/m1QualityRun.ts recheck 2>&1 | m
```
- 결과: `scripts/ops/out/runs/claude-sonnet-5-5__*__final__r1~3.json` · `review.md` · `summary.md` · `recheck.md`(git 밖).
- recheck는 2차(`84b`)와 이번(`final`)을 함께 본다 - `final` 줄만 판정에 쓴다. 옛 `84b` 다정한 말 6줄은 "자기 점검 칸 없음" 표시가 정상(84-e).
- 하네스는 합성 데이터셋을 이 PC 안에서 조립한다(원격 DB 0). 다툰 날 09-16 · 09-17이 들어 있다(9번) → `conflict` 표시는 여기서도 잰다.

### 3) 시험 커플 G 시드 (2025년 · 사람 실행 · 원격 개발 DB에 씀)
3-0. 접속 값(보안 입력 - 4)도 이 값을 쓴다). 키는 운영용 **`ops_2026_11`**(HANDOFF 74-k2 표):
```
$env:ONDOLOG_SUPABASE_URL = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString)).Password
$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString)).Password
$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY.StartsWith('sb_secret_')
$h = ([Uri]$env:ONDOLOG_SUPABASE_URL).Host
```
→ 확인 줄 `True`일 때만.

3-1. 이미 들어가 있는지(로컬 목록 - 원격을 읽지 않음):
```
Test-Path scripts\ops\out\seed-m2b-2025.json
```
→ `True`면 3-2를 건너뛴다(이미 들어가 있음). `False`면 3-2. 헷갈리면 3-2를 그냥 쳐도 된다 - 이미 다 있으면 "건너뜀(쓰기 0)"으로 끝난다.

3-2. 시드(새 시험 커플 G - 2025-09 · 다툰 날 포함):
```
deno run --no-lock --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY --allow-net=$h --allow-read=supabase/.temp/linked-project.json --allow-write=scripts/ops/out scripts/ops/seedTestData.ts run-2025 2>&1 | m
```
→ 끝 줄 "시험 커플 G를 만들었다 - 계정 2 · dates 4 · date_stops 9 · data_entries 18 · messages 302 · 스토리지 15" + "목록 파일: scripts/ops/out/seed-m2b-2025.json". 다시 치면 "시험 커플 G가 이미 있다 - 건너뜀(쓰기 0)".
- 멈추면(`SeedStopError` · 원격 오류): 목록 파일은 쓰지 않고 그때까지 만든 행 · 파일을 `scripts/ops/out/seed-m2b-2025.failed.json`에 남긴다 → 그 파일 이름과 멈춤 줄만 PE에게. "데이터가 데이터셋과 다르다"는 앞 실행이 중간에 멈춘 흔적이라 다시 쳐도 쓰지 않는다(정리 먼저).

### 4) 시험 커플 G 실제 모드 1호 - 생성 → 렌더 → 발행
**순서 정정**: 렌더는 **발행 전**이다 - 렌더가 발행된 호를 거부한다(`render_issue.py:748-749` "이미 발행된 호다 - 렌더는 발행 전에 한 번"). 안내서의 "생성 → 발행 → 렌더"가 아니라 **생성 → 렌더 → 발행**.

4-0. 대상 커플을 새 시드 목록에서 변수로(id를 치지도 보지도 않는다 - 접속 값은 3-0 그대로):
```
$cid = ((Get-Content scripts\ops\out\seed-m2b-2025.json -Raw -Encoding UTF8 | ConvertFrom-Json).couples | Where-Object { $_.label -eq 'G' -and $_.nickname -eq 'test-m2b-G' }).id
[bool]$cid
```
- `[bool]$cid` `True`일 때만. 창을 새로 열었으면 3-0을 다시(키 `ops_2026_11`).
- `--mode live` 앞 확인(읽기만): `npx supabase migration list 2>&1 | m` → `20261118120000_m1_llm_provider`가 원격 칸에 있어야 한다. 없으면 생성이 호 행을 만들기 **전에** 거부 코드 2로 멈춘다(fail-closed - 84-a) → db push 먼저(HANDOFF 84-a "db push 순서").
- 84-f 대상 잠금: 생성 명령의 `--allow-read`에 `scripts/ops/out`이 들어가야 한다(아래 4-1에 넣어 둠). 빠지면 시드 목록을 못 읽어 "실제 모드는 로컬 시드 목록 … 에 있는 시험 커플에만 돈다"로 멈춘다(정상 - 다시 치면 됨).

4-1. 생성(실제 모드 · Sonnet 5.5는 `app_config.llm_provider`가 정함 · 기간 2025-09 = `[2025-09-01, 2025-10-01)` KST):
```
deno run --no-lock --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_LLM_API_KEY --allow-net="$h,api.anthropic.com" --allow-read=supabase/.temp/linked-project.json,scripts/ops/out --allow-write=scripts/ops/out scripts/ops/generateIssueCli.ts --couple-id $cid --period-start 2025-09-01 --period-end 2025-10-01 --mode live 2>&1 | m
$iid = (Get-ChildItem scripts\ops\out\generate-*.json | Sort-Object LastWriteTime | Select-Object -Last 1).BaseName -replace '^generate-',''
(Get-Content "scripts\ops\out\generate-$iid.json" -Raw -Encoding UTF8 | ConvertFrom-Json).coupleId -eq $cid
```
→ 마지막 줄 `True`(방금 만든 파일이 이 커플의 것). 코너 셋 `success`가 아니면 6).

4-2. 렌더(v1.2.3 · 키를 렌더용 **`render_2026_11`**로 바꾼다):
```
$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString)).Password
$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY.StartsWith('sb_secret_')
render\.venv\Scripts\python.exe render\render_issue.py --issue-id $iid 2>&1 | m
Invoke-Item "render\out\$iid\issue.pdf"
```
- **PDF 위치**: `render\out\<호 id>\issue.pdf`(쪽 그림 `page-NN.jpg` · `audit.json` · `compose.json` 같은 폴더 · git 밖). 마지막 줄이 id를 치지 않고 연다. 렌더 시작 때 높이 표 환경 경고가 있으면 `경고:` 줄로 나온다(84-d2 - 이 PC면 0).

4-3. 발행(키를 다시 `ops_2026_11`로):
```
$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString)).Password
$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY.StartsWith('sb_secret_')
deno run --no-lock --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY --allow-net=$h --allow-read=supabase/.temp/linked-project.json --allow-write=scripts/ops/out scripts/ops/publishIssueCli.ts --issue-id $iid 2>&1 | m
```
끝: 창을 닫고 새 창에서 `[bool]$env:ONDOLOG_LLM_API_KEY` · `[bool]$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY` → 둘 다 `False`.

### 5) 각 명령이 원격에 쓰는 것 · 비용 상한
| 명령 | 원격에 쓰는 것 | 상한 |
|---|---|---|
| 2) 하네스 `run` | **원격 DB · 스토리지 0** - 권한이 `--allow-net=api.anthropic.com`뿐(DB 주소에 갈 수 없다) · 결과는 로컬 `scripts/ops/out` | **명령 1회 $10**: `llmSafety.ts:30` `HARNESS_BUDGET_USD` → `m1QualityRun.ts:268` `CostMeter` - 다음 호출 전 "지금까지 + 이번 최악"이 넘으면 부르지 않음 |
| 2) `review` · `recheck` | 0(네트워크 권한 없음) | - |
| 4-1) 생성 | `issues` 초안 행 1(같은 커플 · 같은 기간 초안이 있으면 재사용 - `generateIssue.ts:239`) · `corners` 행 3(insert · 내용 · status · `llm_usage` · `source_date_ids` update) · `ops_alerts`(정지 · 상한 때만) · 스토리지 `entries` → `magazine` 사진 복사(`mediaCopy.ts:121`) - 모두 그 호 · 그 커플 | **1호 $2**: `llmSafety.ts:31` `ISSUE_BUDGET_USD` → 시도 직전마다 `generateIssue.ts:350`(+ 코너 8분 · 1호 20분 · 1회 120초). 넘으면 그 코너 안전 정지(`usage_over` 경보) |
| 4-2) 렌더 | 스토리지 `magazine/{커플}/{호}/render/`(디지털 PDF + 쪽 그림 - 인쇄용 0) · `issues` 그 행의 `pdf_digital_path` · `page_count` · `cover_path`(`render_issue.py:805-817`, 조건 `published_at is null`) | LLM 0 |
| 4-3) 발행 | RPC `fn_publish_issue` → 그 호 `issues` 발행 칸 · 그 호 `corners` `ready → published` · 그 커플 `dates` 재소환 칸(`022_publish_path.sql:149-157`) | LLM 0 |
| 3-2) 시드 `run-2025` | 인증 계정 2(`test-m2b-g1/g2@example.com` · 비밀번호 없음) · `profiles` 2 · `couples` 1(`test-m2b-G` · `TESTG001`) · `dates` 4 · `date_stops` 9 · `data_entries` 18 · `messages` 302 · 스토리지 `entries/{커플 G}/` PNG 15(사진 14 · 그림 1) - 모두 새 커플 G의 것. 이미 있으면 0 | LLM 0 |

### 6) 떨어지면 - 떨어진 코너만 다시 (R135-5)
- 하네스: `--corner`로 그 코너만(값 `date_archive` · `sweet_words` · `this_month` - `m1QualityRun.ts:24` · `:258`). 태그는 `final2`로 바꿔 이번 결과를 덮지 않는다:
```
deno run --no-lock --config supabase/functions/deno.json --allow-env=ONDOLOG_LLM_API_KEY --allow-net=api.anthropic.com --allow-read=. --allow-write=scripts/ops/out scripts/ops/m1QualityRun.ts run --model claude-sonnet-5-5 --corner sweet_words --runs 3 --tag final2 2>&1 | m
```
- 생성: **4-1 첫 줄을 그대로 다시**. 같은 초안을 다시 쓰고(`generateIssue.ts:239`), `ready` · `published` 코너는 다시 만들지 않는다(`generateIssue.ts:310`) → 떨어진 코너만 LLM을 부른다. 다시 생성하면 렌더 칸이 비워지므로(`generateIssue.ts:474` `clearRender`) 4-2 · 4-3을 다시. 발행된 호는 다시 생성하지 않는다(`generateIssue.ts:240-241` - 멈춤).

### 7) 키 · URL · id · 이메일 0 · 원격 쓰기가 시험 커플 행뿐인 근거
- 명령: 키는 보안 입력 → 이 창의 환경 변수만 · URL은 변수 · 호스트는 `$h` · 커플 id는 로컬 목록에서 `$cid` · 호 id는 생성 결과 파일 이름에서 `$iid`(치지도 보지도 않음). 출력: 각 명령이 키 · ref를 지울 값 목록으로 가림(`generateIssueCli.ts:43-44` · `render_issue.py:854-857` `redact`) + 남는 uuid · 이메일은 `m`이 가림.
- 개발 프로젝트만: `opsGuards.ts:56-66` `assertDevelopmentProject`(linked-project 이름 `ondolog`) · `render_issue.py:98` · `--allow-net`이 그 호스트 하나.
- 시험 커플만: 생성 `generateIssue.ts:215` · 발행 `publishIssue.ts:50` · 렌더 `render_issue.py:746` - `couples.nickname`에 `test`(`opsGuards.ts:71-83`). 이 가드는 51- 두 폰 커플(시험 이름)도 통과시킨다 → **84-f 실제 모드 대상 잠금**: `--mode live`는 별명에 더해 **로컬 시드 목록(`scripts/ops/out/seed-m2b*.json`)에 있는 커플 id**일 때만(`generateIssue.ts` `assertLiveTarget` - DB를 읽기 전 · `opsGuards.ts` `seedListCoupleIds`). 폰 커플 id는 시드 목록에 없으므로 실제 모드가 장치로 막힌다. 멈춤 문구에 커플 id 0(84-f에서 `opsGuards.ts:83` 고침). 생성 · 렌더 · 발행이 쓰는 행은 그 커플 · 그 호의 것뿐(5) 표).
- 실제 커플 0 · `demo_responses` 0(어느 명령도 그 표를 읽거나 쓰지 않음).

### 8) 시드가 들어갈 커플 (R140-4)
- **시드 전용 시험 계정이다 - Proteur의 두 폰 커플이 아니다.** `run-2025`는 자기 계정 둘을 만든다(이미 있으면 이어 씀): `test-m2b-g1@example.com` · `test-m2b-g2@example.com`(`seedCouple2025.ts` `SEED_2025`) · 비밀번호 없음(로그인 불가) · 커플은 새로 insert(별명 `test-m2b-G` · 초대 코드 `TESTG001` - 기존 `TESTA001` 등과 겹치지 않음). 찾는 것은 그 두 이메일과 초대 코드뿐 - 다른 커플을 읽거나 쓰는 코드 0.
- 4)의 대상 = **`test-m2b-G`**(2025-09 · 활성 · 두 구성원 AI 동의 = P0 조건). `$cid`는 `seed-m2b-2025.json`에서만 - 두 폰 커플(51-)에는 합성 대화를 넣지 않고, 실제 모드도 들어가지 않는다(84-f 잠금).

### 9) 다툰 날 대화 (R140-4 ②)
- **들어 있다.** `scripts/ops/fixtures/m1-month/chat.ts:11`(날 종류 주석 "다툰 날: 09-16 · 09-17 아침") · `:191-223`(09-16, 32건 - 잘잘못 · 사과 · "미안하다고 하면 끝인 거야?") · `:225-236`(09-17 - 뒤끝 · 화해 "고마워" · "오늘은 좀 풀린 것 같…" = 표현은 다정하지만 화해 맥락 → `conflict` 시험). 연도 `FIXTURE_YEAR = 2025`(`dataset.ts:24`, 날짜 줄 `:48`) → **2025-09-16 · 09-17**. 메시지로 들어가는 길: `dataset.ts:214` `messages: parseChat()` → 하네스 입력 · 시드 `seedTestData.ts:278-279` `insertRows('messages', …)`.
- `run-2025`가 이 대화를 **2025-09-16 · 17** 날짜로 커플 G에 넣는다(PGlite 시험 `scripts/ops/seed2025_84f.test.ts` "메시지 날짜는 2025-09 · 다툰 날 …": 09-16 32건 · 09-17 있음). 옛 A/B/C/F의 것은 2026 날짜 그대로(쓰지 않음).

## `84-e` 다정한 말 자기 점검 · 메시지 id 저장 · 유성(C01 · C08 · C03) (메인 세션, 2026-11-20, 위임문 `phase-7/84-e-dispatch-selfcheck-id-meteor.md` · 출처 ROADMAP r137 R137-1~5 · MASTER r80 9-8-4) - 완료 · 멈춤 0 (미커밋)

**이 컴퓨터(Windows)의 Playwright WebKit ≠ iOS Safari · WKWebView - 실기기 대체 아님.**
시작 확인: `DOC_REVISION: 2026-11-20-r138` · 84-d · 84-d2 커밋 들어감(작업 트리 깨끗) - 통과. 위임 0(메인 세션 직접). LLM 0 · 원격 0(허용 질의 없음) · **마이그레이션 0** · 함수 배포 0 · 새 패키지 0 · `consent.ts` 0 · `demo_responses` 0 · R34-3 0 · 커밋 0 · **하늘 서버 쓰기 0**.

### ① 다정한 말 자기 점검 (R137-3 ①)
| 무엇 | 고친 곳 | 시험 |
|---|---|---|
| 응답 형식: 고른 대화(main) · 한 줄(sub)마다 `conflict: boolean`(**필수**) - 같은 호출 안 · 추가 호출 0 | `supabase/functions/_shared/corners/sweetWords.ts:71`(`ConflictFlag`) · 스키마 main/sub | `sweetWords.test.ts` "84-e 자기 점검" 6건 |
| 엔진이 표시(true)된 줄을 뺀다 - **Zod 바로 뒤, 값 · 내용 검사 · ID 해석 · 저장보다 먼저**(뺀 줄은 검사도 저장도 0) | 골격 훅 `cornerPipeline.ts:340`(`dropFlagged`) · `:572` · `:787` · `:898` / 코너 `sweetWords.ts:101` `dropConflictLines` | "표시된 대화 · 한 줄은 빠지고 나머지만 저장" · "뺀 줄은 검사하지 않는다" |
| 표시 칸이 빠진 줄 = 형식 오류(`schema_invalid` → 지금 재요청 1회 → 빠짐) | Zod(필수 boolean) · 재요청 정책은 그대로(`cornerPipeline.ts` `SKIP_REASON_RETRY_POLICY`) | "표시 칸이 빠진 줄 = 형식 오류" · "골격: 두 번 빠지면 재요청 1회 뒤 schema_invalid" |
| 빼고 남은 대화 0개 = 최소 분량(대화 1개, CORNER_CONTENT §6-1 · 저장 스키마 `storedContent.ts` `main.min(1)`) 미달 → 지금의 "모자라면" 규칙 = 명시적 빈 결과와 같은 `insufficient_input`(`cornerPipeline.ts:582-583` 경로) · 한 줄이 남아도 | `sweetWords.ts:107` `isSweetWordsEmpty` · `:266` | "대화가 모두 표시되면 … insufficient_input" · 골격 "재요청 없이 insufficient_input" |
| 프롬프트: 지시 한 줄 + 출력 형식 예에 `"conflict":false` · "확신이 서지 않으면 true" | `sweetWords.ts:206` · 출력 형식 줄 | "프롬프트: 표시 칸 지시와 출력 형식" |
| 가짜 출력 · 샘플 출력에 칸 추가 | `scripts/ops/sampleOutputs.ts` · 시험 4파일 | jest 전체 |
| 문서 | `docs/ONDOLOG_CORNER_CONTENT.md` §6-2 "자기 점검" 줄 · §6-1 `messageId` | - |
- 예문 규칙(R134-1): 새 예문 문장 0(JSON 형식 줄만) · 금지 키 검사에 `conflict` 안 걸림(`forbiddenKeys.ts` 부분 문자열 목록 밖).

### recheck (2차 결과 · ① 칸 없음 처리)
- 결과: **시도 20 · 위반 34 - 84-c2 · 84-d와 같음.** 더한 줄: "84-e 자기 점검 칸 없는 옛 다정한 말 시도: **6(그중 실림 6)** - 지금 검증기로는 형식 오류(schema_invalid → 재요청 1 → 빠짐)".
- 결정: 옛 결과는 **건너뛰지 않고 표시**한다(`legacyNoFlag`). 84-c 내용 검사가 계속 보이도록 빠진 칸만 `false`로 채워 읽는다 - 이 표 안에서만, 저장 · 판정에 쓰지 않는다(`scripts/ops/m1Recheck.ts:66` `withLegacySelfCheck` · `:109`). 시험 `scripts/ops/recheck84e.test.ts` 3건.
- 뜻: 2차 결과를 지금 엔진에 다시 넣으면 다정한 말 6회 모두 첫 응답이 형식 오류 → 재요청. 최종 실측(R135-4)에서 새 프롬프트로 다시 잰다.

### ② 코너 내용에 메시지 id (R137-1)
- 다정한 말 저장 내용 `turns[].messageId` · `sub[].messageId`(`sweetWords.ts:166` · sub 줄) + 원문을 싣는 이달의 우리 근거 `evidence[type=message].messageId`(`thisMonth.ts:195`). 저장 스키마는 **선택 칸**(`src/types/corners/storedContent.ts:63` · `:192` · `:228` - 84-e 전 호에는 없다).
- **마이그레이션 0 확인**: `corners.content`는 jsonb(`supabase/migrations/009_magazine.sql:67`). 앱 읽기 권한도 그대로 - `corners_select`(커플 · `status='published'`, `012_rls_policies.sql:184-186`, 발행 때 `022_publish_path.sql:149`가 published로) · `messages_select`(커플 · `deleted_at is null`, `012:142-143`). 새 RPC 0.
- 옛 호(id 없음): **보낸 사람(이름) + 시각(그 초 안)**으로 찾고 못 찾으면 건너뜀(`web/src/features/sky/meteorData.ts:79` `findLegacyMessage`). 시험 `meteor84e.vitest.tsx` "id로 읽고 · 옛 호는 …".
- 저장 모양 시험 갱신: `sweetWords.test.ts` §6-3 예시 · sub 키 · `thisMonth.test.ts` 근거.

### ③ 유성 (R137-1 · R137-2 · MASTER 9-8-4 r80 · 보드 17-b · 17-d)
| 항목 | 고친 곳 | 시험 |
|---|---|---|
| 규칙(순수): 한 줄 선택만 · 7일 지난 말 · 하루(KST) 1번 · 놓친 말 다음 날 다시 · 잡은 말 다시 0 · 후보 0 → 없음 · 설정 끔 → 없음 · 고르기 = (커플+사람+날짜) 해시(난수 0) · 4~10초 · 25~35° · 누를 수 있는 시간 3초 / 줄인 모션 5.2초 | 새 `web/src/features/sky/meteorRules.ts`(`MIN_AGE_MS` :31 · `planMeteor` :103) | `meteor84e.vitest.tsx` 규칙 6건(7일 경계 · KST 자정 · 결정적) |
| 읽기: 발행된 다정한 말 코너의 `sub[]`만 → **지금 살아 있는 메시지 행**(코너 사본 원문 0) · 숨김 · 탈퇴로 행이 없으면 건너뜀 · 질의는 select뿐 | 새 `meteorData.ts:90` `fetchMeteorCandidates` | 읽기 2건 · 화면 "숨김 · 탈퇴로 행이 없으면 건너뜀" · "네트워크 쓰기 0(런타임)" · 정적 "서버 쓰기 · RPC 0" |
| 떨어뜨리기: 하늘이 준비된 뒤(별 읽기 끝) 4~10초 · 그때 보여도 되는 화면이면(C01 이번 달 · C08/C08-alt) · 지난 하늘 · 별 시트 · 사진 · 권한 앞 화면 · 빈 하늘이면 0 · 떨어지는 중 그쪽으로 가면 사라짐(놓침) · 앱이 가려지면 멈춤 | 새 `Meteor.tsx:58` `useMeteorDrop` · `SkyScreen.tsx:247` · `:389` | "4~10초 안에 떨어지고 …" · "놓치면(3초) … 다음 날 … 잡은 말 0" · "지난 하늘 0" · "C08 둘러보기에서도" |
| 모양 · 모션(보드 17-d): 오른쪽 위 → 왼쪽 아래 · 흰 꼬리 · 흰 점 + rose 후광 · 머리 2.4초 `cubic-bezier(.3,0,.7,1)` · 꼬리 0.4초 · 사라짐 0.6초 ease-in(꼬리는 머리 쪽으로) · 누르는 범위 지름 64pt 원이 머리를 따라감 · 줄인 모션 = 제자리 빛(흰 점 + 후광 + 바깥 고리) 0.6/4/0.6 · transform · opacity만 · 한 번에 하나 | `Meteor.tsx:117` `MeteorLayer` · `web/src/styles.css` 끝 "84-e" 묶음 | "줄인 모션 - 제자리 빛 5.2초" |
| C03 떨어진 말(새로): FALLEN WORDS · "{n} / {N}"(지금 살아 있는 잡은 말 전체 중 위치 · 방금 잡은 말이 N) · 원문(자르지 않음 · 길면 스크롤) · 출처 "{이름} · {M}월 {D}일 {HH:MM}"(앱 하늘 화면 24시간 표기 `SkyScreen.tsx` `fmtTime`) · ‹ 이전 말 / 다음 말 ›(끝이면 흐림) · "지나가는 유성을 누르면 떠요" · ✕ · 뒤로 | `Meteor.tsx:161` `FallenWords` | 화면 1건 · 스모크 2건 |
| 설정: OUR SKY 첫 줄 "유성 떨어뜨리기 · 다정한 말이 유성으로 떨어져요"(현재 H01 보드 `screens/H01.jpg`) · 기본 켬 · `skyPrefs` 키 하나(`skypref:meteor`, 기기에만) | `SettingsView.tsx:125` · `skyPrefs.ts` | `settings.vitest.tsx` OUR SKY 시험 · 스모크 |
| 기기 저장: 새 범주 `meteor`(81- 모양 버전 1 · 읽을 때 검사, scope = 커플 id) = **잡은 말의 메시지 id(잡은 순서) + 마지막으로 떨어진 날짜만 · 원문 0** · `COUPLE_KINDS`에 넣음 → 로그아웃 · 탈퇴 요청 · 계정 전환 · 해제 요청/완료 때 지워짐 · `clearCoupleCache` 정확 일치(`skypref:meteor` 토글은 남음) | `deviceCache.ts:23` · `:25` · `cacheShapes.ts`(`meteorMemory` · `CACHE_VERSION.meteor`) · `meteorData.ts:115` | "기기 저장" 3건 · `cacheShape81.vitest.tsx` 범주 2건 · 화면 시험 "원문이 기기 저장소에 0" |
| 성능 | transform · opacity · 보일 때만 · 한 번에 하나 · `paused` | **V40에서만 확인됨(폰)** |
- 스모크(`web/smoke/screens.smoke.ts`): "84-e 유성: C01 제자리 빛(줄인 모션) -> C03 · 390 / 360 폭" · "움직이는 유성(기본 모션) -> 누르면 C03" · "84-e 설정 H01 유성 줄" - chromium · webkit 모두 통과. 유성 재료는 `?meteor=1`일 때만(`smoke/seed.ts` `METEOR_TEXT` · 8일 전 메시지 + 발행된 다정한 말 코너) - 다른 스모크 화면에 유성이 끼지 않게.

### 폰에서만 확인되는 것
- V40 실기기에서 유성이 끊김 없이 지나가는지(웹뷰 합성 · 꼬리 그라디언트) · 움직이는 머리를 손가락으로 잡을 수 있는지(64pt 원) · Android "애니메이션 삭제"(줄인 모션)에서 제자리 빛 · C03 안 긴 원문 스크롤 · 기기 뒤로 가기로 C03 닫힘 · iOS(WKWebView)는 Mac 뒤.

### 결정 기록 (출처 R137-1~5 · MASTER 9-8-4 r80)
1. 자기 점검 칸 이름 `conflict`(boolean, 필수) · "확신이 서지 않으면 true"(빼는 쪽 - "다정한지 확신이 서지 않는 발화는 고르지 않는다"와 같은 방향) · 표시 칸은 저장하지 않는다.
2. 빼기는 골격의 선택 훅(`dropFlagged`) - Zod 직후. 다른 코너는 쓰지 않는다(없으면 그대로).
3. 대화가 다 빠지면 한 줄이 남아도 `insufficient_input`(최소 분량 = 대화 1개).
4. recheck는 옛 결과를 표시(건너뜀 아님) · 빠진 칸만 false로 채워 내용 검사를 계속 본다.
5. 메시지 id는 다정한 말 턴 · 한 줄 + 이달의 우리 메시지 근거. 옛 호는 보낸 사람 이름 + 그 초 안의 시각으로 찾는다(이름은 지금 프로필 이름 - 이름을 바꾼 사람의 옛 호 말은 못 찾고 건너뛴다).
6. 유성 기록은 **커플 자료 범주**(`COUPLE_KINDS`)로 둔다 - 위임서 "사람 설정과 같은 기본"은 로그아웃 · 계정 전환 삭제는 같고, 메시지 id가 커플 자료라 해제 때도 지운다(MASTER "계정 전환 때 처음부터"보다 넓게 지움 - PE 판단으로 사람 범주로 바꾸려면 `COUPLE_KINDS`에서 한 단어).
7. **설정 줄은 줄인 모션에서도 켜고 끌 수 있게 둔다** - 위임서는 "반짝임 줄과 같은 비활성 규칙"이라 했지만, MASTER 9-8-4 · 보드 17-b는 줄인 모션에서도 유성이 제자리 빛으로 **떨어진다**고 정해 줄을 끈 모양으로 두면 화면과 어긋난다. PE 확인 필요(바꾸려면 `SettingsView.tsx` 한 줄).
8. C03 "채팅에서 보기"는 **숨김**(지운 · 불러오지 않은 옛 메시지로 갈 때의 동작이 정해진 곳이 없다 - HANDOFF 84-d0 열린 질문 6).
9. C03 "{n} / {N}" = 잡은 말 중 **지금 행이 살아 있는 것**만 센다(숨김 · 탈퇴로 지워진 말은 C03에도 나오지 않는다).
10. C03 시각 = 앱 하늘 화면의 24시간 `HH:MM`(위임서 "앱 규칙") - 보드 그림의 "밤 11시 12분"과 다르다(디자인 확인 필요 시 `meteorRules.ts` `fallenMeta` 한 곳).
11. C03 전환 = 앱에 1단계 C03이 없어 C05(사진)와 같은 fadeIn 260ms.
12. 유성 시각 기준 = "하늘이 준비된 뒤" = 별 읽기가 끝나고(`allLoaded`) 후보 읽기가 끝난 때부터 4~10초.

검증: **`npm run gate` 통과 136.2초**(web tsc · Vitest **70 파일** · 법무 · smoke **38/38**) - 그 앞 1회는 온보딩 스모크 1건 보임 시간 초과(84-e와 무관한 화면 · 다음 회 통과, R123-4 흔들림 목록과 같은 종류) · 루트 tsc 0 · jest **125/2220**(이전 124/2211 · PGlite 포함) · deno check 6개 통과 · `recheck` 위 숫자 · Python **356 OK**(445초, 회귀 0) · `build` · `build:trial` · `cap sync android`(맨 끝 한 번 · `web/android` 추적 변경 0). 키 · 주소 · id · 이메일 · 생성 문장 0 · 새 파일 이름 ASCII.

## `84-d2` 높이 표 환경 실측 · 이름 없는 경유지 (메인 세션, 2026-11-20, 위임문 `phase-7/84-d2-dispatch-measure-env-unnamed-stop.md` · 출처 ROADMAP r138 R138-1~6) - 완료 · 멈춤 0 (미커밋)

시작 확인: `DOC_REVISION: 2026-11-20-r138` · 84-d 2묶음 커밋 들어감(`render/heights.py` · `valueChecks.ts` 30자 추적 중, 작업 트리 깨끗) - 통과. LLM 0 · 원격 0(허용 질의 없음) · 마이그레이션 0 · 새 패키지 0 · `web/` 0 · 엔진 0 · 커밋 0 · **디자인 도구 변경 0**(`render/issue/tools/measure.py` 해시 `66e6a79` 그대로, 실행만) · `render/issue/` 다른 틀 파일 0 · **여유 줄 0** · `docs/design/nocturne/render/issue/` 사본 0(디자인 원본 그대로).

### ① 환경 실측 (`render/.venv/Scripts/python.exe -B render/issue/tools/measure.py`, README §12 방법 그대로)
- 결과는 84-d 시험 실행 때와 **바이트 단위로 같음**(결정적) → `render/issue/measure.json` 갱신.
- 전 → 후: 줄 수 표 칸 **308개**(타임라인 메모 41/84 · AI 캡션 28/84 · 장소 9/20 · 인용 턴 홀수 48/84 · 짝수 52/84 · 정황 3/32 · 글만 있는 기사 메모 46/84 · 사진 아래 메모 10 · 22 · 26/60, 대부분 한 줄 크게) + 값 **21개**.
- 대표 값: 인용 가용 높이 **940 / 841 / 778 → 938 / 843 / 780** · 사진 아래 메모 칸 104 → 106px · 타임라인 왼쪽 단 67/40/41/14 → 68/43/42/17 · 대화 고정 100.6 → 99.6 · 턴 65.9 → 64.9 · 글만 있는 기사 AI 캡션 상자 직선 아님(잰 값 그대로 씀 - `heights.box`).

### ② 환경 기록 · 경고
- 기록 파일: **`render/issue/measure.env.json`**(`measure.py` 출력 형식은 그대로 - 옆 파일). 칸: OS `Windows` · OS 판 `10` · Chromium(Playwright) `156.0.8078.4` · 글꼴 7개 sha256 · `measure.json` sha256(줄끝 무관) · 참고 `Windows-10-10.0.26200-SP0` · Playwright 1.64.0.
- 쓰기 · 비교: 새 `render/measure_env.py`(`env_warnings` :74 · `write_env` :95 · 명령 `render/.venv/Scripts/python.exe -B render/measure_env.py --write`). 브라우저를 띄우지 않음(Chromium 판은 Playwright `browsers.json`).
- 렌더러: `render_issue.py:483` `note_measure_env` - 렌더 시작(지면 짠 직후, `:760`)에 다르면 **경고만**: 로그 `경고: 높이 표를 잰 환경과 {OS · OS 판 · Chromium(Playwright) 판 · 글꼴 파일 · 높이 표 파일(measure.json)}이(가) 다르다 (…) - 줄 수 어림이 실제와 다를 수 있다(넘친 지면은 지면 검사가 막는다)` · `compose.json`의 `report.measureEnvWarnings` · 렌더 결과 요약 `measureEnvWarnings`(`:834`). 기록 파일이 없으면 "기록이 없다" 한 줄. 로컬 권도 같은 함수(`local_volumes.py:187` · report.txt 줄 · summary).
- 시험 `render/tests/test_d2_env_unnamed.py` `MeasureEnv` 4건: 같은 환경 경고 0 · 글꼴 해시 하나 바꾼 가짜 환경 경고 1 · Chromium 판 다름 경고 1 · 기록 없음 경고 1 · 렌더러는 경고만(멈춤 0).

### ③ 과소 예측 0 다시 확인
- `measure.py`의 무작위 견본 확인(README §12) = 타임라인 40 + 인용 대화 30 = **70개 · 실제보다 작게 예측 0** · 가장 큰 과대 **타임라인 +29.0px · 인용 +44.7px**(최소 -0.0 · +0.2). 디자인 환경 값은 +29.0 · +56.6.
- 시드 6권 타임라인 어림 - 실제: 전부 0 이상(+1~+4px).

### ④ vol4
- 새 표로 384 · 394자 메모 = 10줄(실제와 같음) → 구간 623 · 381px 어림(실제 622 · 380) → 타임라인 **2면**, 렌더 통과 **14쪽 · safe 0**. `test_v122.py:661` `test_timeline_overflow_volume_passes_and_no_estimate_is_below_the_actual`의 `@unittest.expectedFailure` **뗌**.

### ⑤ 이름 없는 경유지(R138-4) - README 345줄 정본 · 282줄 `@da.route` "null stop 건너뜀"은 옛 줄
| 곳 | 84-d까지 | 84-d2 | 시험 |
|---|---|---|---|
| 타임라인 | 보기 사본이 `placeName: null` 그대로 → 틀의 장소 줄(`da-timeline.html:25` data-optional)째 빠짐(`compose.py:395` 보기 사본 만들기, 84-d 커밋) | 보기 사본 `placeName = place_label(s)`(`compose.py:398`) - 구간 높이도 그 글자로 잰다(`stop_height`가 보기 사본을 잼) | `UnnamedStop.test_timeline_prints_the_line_with_its_other_cells`(시각 19:00 · 사진 칸 "2" · AI 캡션 그대로) |
| 장소 목록 | 이미 `UNNAMED_PLACE`(`facts.py:352` `place_label`) | 그대로 | `test_places_list_and_routes_use_the_same_words` |
| 경로(`@da.route` · `@da.articleRoute`) | 이미 `UNNAMED_PLACE`(같은 사실 `route`) | 그대로 | 같은 시험(경로 · 장소 수 5) |
| (함께) 글만 있는 기사 구간 목록 | 84-d 새 지면 - `placeName: null` → 장소 줄 빠짐(`facts.py:208`, 84-d 커밋) | `place = place_label(s)`(`facts.py:203`) · 높이도 그 글자 | `test_hero_none_stop_list_uses_the_same_words`(18:20 · AI 캡션 그대로) |
"함께" 줄은 위임서 세 곳 밖이지만 README 345줄 "모두 같은 말" · R136-2 "기록은 글로라도 싣는다"와 같은 자리(구간 목록)라 맞췄다 - PE가 보고 아니라면 되돌리기는 한 줄.

### ⑥ D14
- README §10 ③ D14 = 단위 시험 → 84-d 절 ⑤가 D14 목록의 실패 46건 전부 "옛 → 새" · 지운 2건(규칙 없어짐) · 새 `test_v123.py` 18건으로 덮었고, 84-d2에서 남아 있던 기대 실패 1건(vol4)이 풀려 **D14 = D1~D13 + 시험으로 다 덮였다.**

### 시험 갱신 (표가 이 환경 값이 되어 디자인 환경 숫자를 박았던 것만 - 기댓값을 느슨하게 한 것 0)
- `test_v122` Quotes: `test_conversation_height_matches_the_readme_table` → `test_conversation_height_follows_the_measure_formula`(README 격자 ±px 비교 → 같은 식을 시험이 `measure.json`으로 따로 계산해 **같음**) · `test_pack_boundary_940_...` / `..._841_..._778_...` → `test_pack_boundary_without_short_quotes` / `test_pack_boundary_with_one_to_three_and_four_or_more_short_quotes`(박은 숫자 → 표의 가용 높이, 경계 정확히 · +1) · 새 `test_quote_capacities_come_from_the_table_and_narrow_with_short_quotes` · `test_conversations_are_never_split_across_pages` · `test_overlong_...`(940 → 표 값) · TimelineMemo `test_stop_height_follows_the_measure_table`(README 격자 → 같은 식).
- `test_r51` `test_the_overflow_volume_still_fits_one_page_by_the_estimate` → `test_the_overflow_volume_is_split_into_two_pages_by_the_estimate`(vol4 어림 한 면 → 두 면).
- `test_h5_hero` `SeedRegression` vol4 13 → 14쪽 · `test_render_issue` 넘침 대화 1081px · 940px → 표 식 값(이 환경 1185px · 938px).
- 시험 수: Python 348(기대 실패 1) → **356 OK · 기대 실패 0** · jest 124/2211 그대로.

### 시드 6권 렌더 (`render/local_volumes.py`, 출력은 저장소 밖 스크래치)
| 권 | 쪽 | safe | 원문 잘림 · 넘침 | 사실 어긋남 | 디자인 audit 같음 | 환경 경고 | 시간 |
|---|---|---|---|---|---|---|---|
| vol1-photos | 14 | 0 | 0 · 0 | 0 | 같음 | 0 | 32.7초 |
| vol2-opener-fallback | 12 | 0 | 0 · 0 | 0 | 같음 | 0 | 21.4초 |
| vol2b-opener-typeonly | 12 | 0 | 0 · 0 | 0 | 같음 | 0 | 19.3초 |
| vol3-long-original | 15 | 0 | 0 · 0 | 0 | 같음 | 0 | 32.9초 |
| vol4-timeline-overflow | 14 | 0 | 0 · 0 | 0 | 같음 | 0 | 26.5초 |
| vol5-batch2 | 15 | 0 | 0 · 0 | 0 | 같음 | 0 | 29.0초 |
| (vol3-fail) | - | - | 렌더 실패가 기대(대화 1185px > 938px) | | | | |

### 결정 기록 (출처 R138-1~6)
- 높이 표 = 렌더가 실제로 도는 환경(이 PC)에서 디자인 `measure.py`를 그대로 돌린 값(R138-2 (나)). 측정 도구 · 방법 · 칸 정의는 디자인 것 - 바꾼 것 0. 여유 줄 0.
- **`render/issue/measure.json`(환경 실측판)과 `docs/design/nocturne/render/issue/measure.json`(디자인이 넘긴 판 보관본)은 일부러 다르다.**
- **렌더가 서버로 옮겨 가면 그 환경에서 `measure.py`를 다시 돌리고 `render/measure_env.py --write`로 기록을 다시 쓴다(R138-2 ③ · M4).** 그 전에 렌더하면 환경 경고가 뜬다(멈춤 아님 - 넘침은 지면 검사가 막는다).
- 이름 없는 경유지 = "이름을 남기지 않은 곳"(README 345줄 정본, R138-4) - 타임라인 · 장소 목록 · 경로 · 글만 있는 기사 구간 목록.
- **디자인에 알릴 한 줄(전달은 PM)**: "`render/issue/measure.json`을 렌더 환경(Windows 10.0.26200 · Chromium 156.0.8078.4 · Playwright 1.64.0 · 글꼴 render/issue/fonts 7개)에서 `measure.py` 그대로 다시 잰 환경 실측판으로 갱신했습니다 - 줄 수가 대체로 한 줄 크고 인용 가용 938/843/780 · 견본 70개 과소 0. 잰 환경은 `measure.env.json`. 그리고 README 282줄 `@da.route` 'null stop 건너뜀'은 345줄(이름을 남기지 않은 곳)과 어긋나 정정 부탁드립니다."

검증: 루트 tsc 0 · jest **124/2211** · Python **356 OK**(423초, 기대 실패 0) · `npm run gate` **1회 통과 126.5초**(smoke 32/32 · `web/` 변경 0). 키 · 주소 · id · 생성 문장 0 · 새 파일 이름 ASCII(`render/measure_env.py` · `render/issue/measure.env.json` · `render/tests/test_d2_env_unnamed.py`) · `__pycache__` 0.

## `84-d` 조판 v1.2.3 반입 + 렌더러 D1~D14 + 이달의 우리 사진(R44-9) (메인 세션, 2026-11-19~20, 위임문 `phase-7/84-d-dispatch-render-v1_2_3.md` · 출처 ROADMAP r136 R136-1~7 · r137) - 완료 · **멈춤 1(⑥ 실측 표 · vol4)** (미커밋)

시작 확인: `DOC_REVISION: 2026-11-19-r137` · 첨부 2개(`phase-7/dev_reference_v1_2_3.diff` · `test_failures_v1_2_3.txt` - 저장소에 이미 커밋돼 있음 `ce84e72`) · 새 `render/issue/README.md` v1.2.3 - 통과. LLM 호출 0 · 원격 0(허용 질의 없음) · 마이그레이션 0 · 함수 배포 0 · 새 패키지 0 · `web/` 0 · `consent.ts` 0 · `demo_responses` 0 · 실제 데이터 0 · 커밋 0. **틀(`render/issue/`) 변경 0**(git 깨끗 - `measure.py` 시험 실행 뒤 `measure.json`을 원래 바이트로 되돌림).

### 멈춘 것 - ⑥ `measure.json`이 이 저장소 환경에서 다시 재면 바뀐다 (표는 디자인 몫)
- `render/.venv/Scripts/python.exe render/issue/tools/measure.py`(Chromium · Playwright 1.64.0 · Windows) 결과가 넘겨받은 표와 다름: 줄 수 표가 거의 모든 활자 칸에서 **한 줄씩 크게**(예 `timeline.memoLines` 84칸 중 41칸 · `quotes.turnLines.odd` 48칸 · `even` 52칸 · `article.stopMemoLines` 46칸 · 기사 사진 메모 칸 10/22/26칸) · 상자 고정값 ±1~3px · 인용 가용 940/841/778 → 938/843/780 · 사진 아래 칸 104 → 106 · `article.stopCaption.straight` true → false. 다시 잰 파일은 저장소 밖(스크래치)에만 두었다 - **틀은 그대로**.
- 결과: **vol4(긴 메모 384 · 394자) 렌더가 지면 검사에서 멈춘다** - 표는 9줄, 이 환경 Chromium은 10줄(290px) → 타임라인 실제 1003px > 953px(`render_issue.gate_failure` - "넘친 지면은 나가지 않는다" 그대로 작동). 다른 5권은 어림 ≥ 실제(1~4px 크게).
- 렌더러는 표를 그대로 읽는다(값을 코드에 옮기지 않음 - README §12). 디자인이 이 환경(또는 렌더가 실제로 도는 환경)에서 표를 다시 재 넘기면 풀린다. 표시: `render/tests/test_v122.py` `test_timeline_overflow_volume_passes_and_no_estimate_is_below_the_actual`(`@unittest.expectedFailure` - 표가 고쳐지면 "뜻밖의 통과"로 알린다 → 표시를 뗀다) + 대신 지키는 시험 `test_timeline_overflow_volume_never_ships_an_overflowing_page`.
- PE에게: 표를 누가 · 어느 환경에서 다시 잴지(디자인 환경 = 렌더 환경이어야 한다) 결정 필요.

### ① 틀 반입 대조 (README §8 50파일)
| | 결과 |
|---|---|
| `render/issue/` | 50 = §8 목록 그대로(루트 4 · pages 13 · themes 6 · tools 6 · fonts 8 · images/sample 13). 빠짐 0 · 남는 옛 파일 0 · `__pycache__` 0 → **정리한 옛 파일 없음** |
| `docs/design/nocturne/render/issue/` 사본 | 반입 전 47(`.gitignore` · `measure.json` · `tools/measure.py` 없음, 16파일 내용 옛 판) → 50파일 복사 후 **sha1 50/50 일치** · 남는 파일 0 |

### ② D1~D14 (11/15 사본 diff를 그대로 붙이지 않고 지금 렌더러 위에 뜻대로)
| D | 뜻 | 고친 곳 | 시험 | 84-c2까지 임시 수정 |
|---|---|---|---|---|
| D1 | `hero-photo` / `hero-none` | `render/compose.py:1009-1012` `choose_variant` | `test_v123` `Rendered.test_batch2_passes_the_page_checks` · `test_h5_hero.KeepPhotoless` | - |
| D2 | `@da.articleHero` · `@da.articleStops`(가용 592.5px까지, 넘친 구간은 노트 "싣지 않은 것") · 히어로 구간 앞당기기 삭제 | `compose.py:519-549` · `facts.py:187` `article_stops_view` · `facts.py:455-470`(노트 줄) · `compose.py` `not_used_text` `article_dropped_stops` | `test_v123.Edge.test_d2_...` | R84-1 보기 사본 구간 순서 바꾸기 → **디자인 판으로 대체됨**(삭제) |
| D3 | 사진 0 일반 기사도 싣는다 | `compose.py:375-378`(`droppedArticles` 늘 0) | `test_h5_hero.KeepPhotoless` 5건 · `test_v122` `..._printed_as_hero_none...` | R84-2 빼기 → **대체됨**(삭제) |
| D4 | 사진 캡션 = 그 구간 첫 사진에만 그 구간 메모 / AI 캡션 · 항목 `aiCaption` · 기사 지면 메모 · AI 캡션 수 · 사진 AI 캡션은 온도록 문장 | `facts.py:146` `article_photo_view` · `facts.py:363-375`(기사 사실) · `compose.py:541-548`(문장 출처) | `test_compose.Lead` · `test_facts.ArticleCell` · `test_v122` `test_caption_is_the_stops_memo_or_its_ai_caption...` | R48-3 ② "기사 첫 사진 아래 기사 첫 메모 · AI 캡션 0" → **대체됨** |
| D5 | 사진 아래 메모가 칸(104px, 5줄)에 안 들면 싣지 않고 노트에 | `render/heights.py` `photo_caption_fits` · `facts.py:146-176` · 노트 줄 `caption_overflow` | `test_v123.Edge.test_d5_...` · `Heights.test_photo_caption_room_holds_five_lines` | - |
| D6 | R44-9 이달의 우리 사진(③) | `compose.py:622-628` · `compose.py:639` `photo_ai_caption` · `compose.py:715-719`(실린 사진) · `facts.py:227` `this_month_photo` · `facts.py:407-412`(노트 셈) | `test_v123.ThisMonthPhotos` 4건 · `test_compose.ThisMonth` | R44-9 `a.pop('photo')` → **대체됨** |
| D7 | 막대 폭 경로 `@note.ratio*Width` · `aiNotice` 슬롯 | `compose.py:956-985` · `width_compare.py:29` · `local_volumes.py` 사실 확인 | `test_v122.Width` · `DataWidthStrings` · `Browser` 2건 · `test_c2_note` | 84-c2 `add_note_ai_notice`(렌더러가 끼움) → **대체됨**(삭제). 문장은 **`compose.NOTE_AI_NOTICE` 한 곳 그대로**(`compose.py:936`) → 틀 슬롯 `@note.aiNotice` |
| D8 | `add_note_recalled_line` · `drop_empty_count_cells` 호출 삭제 | `render_issue.py:350-354`(함수 삭제 · 대체 주석) | `test_r51.RecalledPhotosLine` · `ZeroCells` | R51-2 · R50-4/R51-5(55-3b/c) → **대체됨**(틀 `data-optional` · 흐르는 한 단) |
| D9 | safe에서 `[data-margin]` 뺌 | `page_audit.py:127` · `:134` | 6권 safe 0 | - |
| D10 | 높이 = `measure.json` | 새 `render/heights.py`(표만 읽음) · `compose.py:186-246`(대화 · 인용 3단 · 구간) | `test_v122.Quotes` · `TimelineMemo` · `test_compose.Timeline` · `test_v123.Heights` | 옛 고정표 · 50자/29px · 35자/22px · 844/781 → **대체됨** |
| D11 | 두 면이면 높이 차 최소로 다시 나눔 | `compose.py:277-287` | `test_compose.Timeline` · `test_v122` `..._two_pages_are_balanced` | - |
| D12 | 표지 이 달의 말 두 줄 넘으면 줄째 삭제 | `render_issue.py:383` `COVER_QUOTE_MAX_LINES` · `:405-418`(줄 윗변 셈) | `test_v123.Rendered.test_d12_...` · `test_a_short_cover_quote_stays` | - |
| D13 | `local_volumes` 경로 · vol4 통과 권 · 어림 ≥ 실제 · `batch2` | `local_volumes.py:12-18` · `:55` · `:253` `timeline_under` · `:293-296`(safe도 실패 기준) · 권마다 걸린 시간 | 6권 렌더(아래) | `OVERFLOW_VOLUME` · `overflow_verdict`("멈춰야 통과") → 삭제 |
| D14 | 시험 갱신 | 아래 ⑤ | | |
| 함께 | **겹친 `data-optional`** - 안쪽 optional을 지울 때 빈 슬롯을 부모에 올린다(디자인 `resolve.js`는 바깥을 안의 모든 슬롯으로 판정) - 이것이 없으면 "줄의 칸이 다 빠지면 줄도 빠진다"가 서지 않고 빈 줄 틀이 남았다 | `render/slot_fill.py:266-271` | `test_v123.NestedOptional` · `test_r51.ZeroCells.test_empty_row_goes_with_its_last_cell` | - |
| 함께 | 목차 사진은 데이트 아카이브 사진 중 첫 사진(소기사 사진 제외) · 데이트 아카이브 없는 호도 소기사 사진을 받아 온다(발견한 결함 - 사진 경로 멈춤) | `compose.py:715-732` `_da_paths` | `test_v123.BackAndContentsPhoto` | - |
84-c2 개발 임시 수정 중 **남은 것 0**(고정 질문 해요체는 디자인 확정 - 시험 자료 맞춤 질문 견본도 해요체로 `tests/fixtures.py` `questions`).

### ③ ④ 결과
- ③ R44-9: 근거가 사진인 소기사에만(`photoPath` 첫 항목) · 사진 위 한 줄 = 그 구간 AI 캡션(메모 있는 구간이면 빈 값) · 섞인 지면 `grid-4`(사진 2 · 큰 순번 2) · 근거 없는 소기사에 사진 0 · 소기사 사진은 실린 사진(뒤표지 집합 · 노트 게재)으로 센다.
- ④ R136-2: ① 사진 0 기사 = `hero-none`(대표 기사는 활자 오프너 그대로) ② 뒤표지 = 실린 사진 중 마지막 - vol1 · 시드 대부분에서 소기사 사진 `e12`(`test_v123.BackAndContentsPhoto`) ③ 표지 이 달의 말 두 줄: 시험 `edge` 권 3줄 → 삭제 · vol3 160자 첫 발화 4줄 → 삭제(원문은 인용면 그대로).

### ⑤ 시험 - 46건 "옛 규칙 → 새 규칙" (이름이 바뀐 것은 → 새 이름)
| # | 시험 | 옛 → 새 |
|---|---|---|
| 1 | a23 `Compose.test_photoless_date_is_left_out...` → `..._printed_as_hero_none_...` | R84-2 빼기 → hero-none로 싣기 |
| 2 | compose `Lead.test_places_questions_and_article_values` | 캡션 메모만 · AI 캡션 칸 빈 값 → 구간 첫 사진에 메모 / AI 캡션 · AI 캡션 칸 1 |
| 3 | compose `PhotoSets.test_contents_back_and_sweet_words_opener_photos` | 실린 사진 = 데이트 아카이브 → + 소기사 사진(정의 그대로, 시험 고침 없이 통과) |
| 4 | compose `ThisMonth.test_no_photo_is_bound_to_tm_articles` → `test_photo_is_bound_only_where_the_evidence_is_a_photo` | 소기사 사진 0 → 사진 근거만 |
| 5 | compose `Timeline.test_compose_makes_two_timeline_pages...` | 2+1 → 균형 1+2 |
| 6 | compose `Timeline.test_drawing_only_notes...` | 101(표) → AI 캡션 칸 식 높이 |
| 7 | compose `Timeline.test_existing_p5...` | 합 944 고정 → 953 이하 |
| 8 | compose `Timeline.test_table_heights` | 고정표 8값 → `measure.json` 식 |
| 9 | compose `Timeline.test_three_stops_with_photos...` | [2,1] → [1,2] |
| 10 | facts `ArticleCell.test_ai_caption_cell_is_removed_whole...` | 렌더러 칸 삭제 · 기사 AI 캡션 0 → 틀 data-optional, 메모만 있는 기사로 |
| 11 | facts `ArticleCell.test_ai_captions_counted_only...` | 기사 지면 AI 캡션 0 → 실린 칸 수 1 |
| 12 | facts `ArticleCell.test_article_memo_sits_under_the_first_photo...` → `..._its_own_stops_first_photo...` | 기사 첫 사진 아래 기사 첫 메모 → 그 구간 첫 사진 아래 |
| 13 | facts `DesignEditsAreMarked.test_each_edited_page_carries_the_marker_comment` → `test_no_development_temporary_edit_is_left_in_the_templates` | 틀에 "R50-6 임시" 주석 → 틀은 디자인 판(임시 주석 0) |
| 14 | facts `NoteEquation.test_every_local_volume_balances` | `OVERFLOW_VOLUME` → VOLUMES(vol4 · vol5) + edge, 권의 모은 양 |
| 15 | facts `SourceDateAndBack.test_back_cover_has_no_next_issue_line` | 틀에 `nextMonth` 글자 0 → 주석 밖 0 |
| 16~20 | h5_hero `DropPhotoless` 5건 → `KeepPhotoless`(이름 3건 바뀜) | 빼고 세지 않음 → 싣고 셈(목차 · 경로 · 노트) |
| 21 | r51 `OpenerTypeVariant.test_the_template_edit_is_marked` | **삭제** - 개발 임시 주석 규칙이 없어짐(13번이 대신) |
| 22 | r51 `PrintedOriginalsAreRecords.test_local_volumes_too` | `OVERFLOW_VOLUME` → VOLUMES + edge |
| 23 | r51 `RecalledPhotosLine.test_period_plus_recalled...` | 노트 = 기사 → + 소기사(고침 없이 통과) |
| 24 | r51 `RecalledPhotosLine.test_the_line_is_added_to_the_note_only` → `test_the_line_slot_is_in_the_note_template_only` | 렌더러가 끼움 → 틀 슬롯 |
| 25 | r51 `RecalledPhotosLine.test_with_the_line_the_two_blocks_below_move_down_together` → `test_the_line_flows_in_the_column...` | top 36px 내림 → 흐르는 한 단 |
| 26 | r51 `RecalledPhotosLine.test_without_a_recalled_article_there_is_no_line` | top:520 그대로 → 슬롯째 빠짐 |
| 27 | r51 `ZeroCells.test_article_without_a_memo_has_no_memo_cell` | 시험 자료 캡션 None(AI 캡션이 이제 실림) |
| 28 | render_issue `Render.test_a_conversation_over_one_page...` | 1337px · 844px → 1081px · 940px |
| 29 | render_issue `WholeRender.test_an_overlong_conversation...` | 1337px → 1081px |
| 30 | v122 `Bindings.test_photo_note_on_the_page...` | HTML 글자 → 보이는 글자(틀 주석) |
| 31 · 32 | v122 `Browser.test_data_width_*` | `@note.ratioPeople` → `@note.ratioPeopleWidth`(`width_compare.py`) |
| 33 | v122 `DataWidthStrings.test_note_page_bars_come_from_numbers...` | widths 키 → `*Width` + 숫자 경로 비움 |
| 34 | v122 `OriginalOversetGate.test_timeline_overflow_volume_stops_the_render` → 둘로 | "멈춰야" → 통과 권(`expectedFailure` - 멈춤 항목) + "넘친 지면은 안 나감" |
| 35 | v122 `Quotes.test_conversation_height_matches_the_readme_table` | 옛 표 4×5 → v1.2.3 격자 6×8(올림 +0~6px) |
| 36 | v122 `Quotes.test_conversations_are_never_split...` | 844/781 → 940/841/778 |
| 37 | v122 `Quotes.test_overlong_conversation_failure...` | 1337/844 → 계산값/940 |
| 38 | v122 `Quotes.test_pack_boundary_781...` → `test_pack_boundary_841_..._778_...` | 단문 3개 이상 781 → 1~3개 841 · 4개 이상 778 |
| 39 | v122 `Quotes.test_pack_boundary_844` → `test_pack_boundary_940_without_short_quotes` | 844 → 940 |
| 40 | v122 `R48Temporary.test_article_without_any_photo_is_left_out...` → `..._printed_as_hero_none...` | 빼기 → hero-none |
| 41 | v122 `R48Temporary.test_caption_is_the_users_memo_never_the_ai_caption` → `test_caption_is_the_stops_memo_or_its_ai_caption...` | 메모만 → 메모 / AI 캡션(라벨 줄) |
| 42 | v122 `TimelineMemo.test_a_long_memo_moves...` → `..._and_two_pages_are_balanced` | [2,1] → [1,2] |
| 43 | v122 `TimelineMemo.test_each_50_chars_beyond_adds_29px` → `test_line_breaks_and_long_place_names_are_counted` | 50자/29px **규칙 없어짐** → 줄바꿈 조각 · 긴 장소 |
| 44 | v122 `TimelineMemo.test_memo_up_to_50_chars_is_the_table_value` → `test_stop_height_follows_the_measure_table` | 50자 표값 → README 격자(20~200자) |
| 45 | v122 `Width.test_no_sentences_means_no_ratio_and_no_bars` | 글자 속 `data-width` → 속성 · 숫자 경로 |
| 46 | v122 `Width.test_note_page_bars_follow_the_data` | 막대 경로 → `*Width` |
- 46건 밖에서 같이 고친 것: v122 `Quotes.test_lines`(`text_lines` 없어짐 → `heights.table_lines`) · `test_two_conversations...`(844 → 940) · `test_tm_articles_...one_column` 이름 · `LeadEqualsNote.check`(노트 = 기사 + 소기사 사진) · compose `Note.test_material_rows...`(+ 소기사 사진) · facts `test_cell_stays...`(렌더러 함수 → 틀) · r51 `test_empty_row_goes_with_its_last_cell`(렌더러 함수 → 틀) · render_issue `WholeRender.test_a_clean_issue...`(표지 이 달의 말 4줄 → 삭제가 맞음) · c2_note 3건(줄 위치 정정 요청 **위** · 틀 슬롯 · `test_stops_when_the_anchor_is_not_unique` **삭제** → `test_empty_value_removes_the_line`) · h5_hero 사진 모은 양 3(소기사 사진).
- **지운 시험(규칙이 없어진 것만)**: r51 `OpenerTypeVariant.test_the_template_edit_is_marked`(개발 임시 주석) · c2_note `NoticeLine.test_stops_when_the_anchor_is_not_unique`(렌더러가 줄을 끼우던 자리 찾기). 나머지는 같은 자리에서 새 규칙으로 바뀜.
- 새 시험: `render/tests/test_v123.py` 18건(높이 표 · 겹친 optional · R44-9 · 뒤표지/목차 사진 · D2 · D5 · D12 렌더 · batch2 렌더) · jest `llmSafety84a.test.ts` 1건(캡션 30자).
- 시험 수: Python 324(틀만 v1.2.3로 바뀐 상태, 60 실패/오류) → **348 OK(기대 실패 1 = 멈춤 항목)** · jest 124/2210 → **124/2211**.

### ⑥ ⑦ ⑧
- ⑥ `measure.json`: **바뀐다 → 멈춤**(위). 렌더러는 규칙 문장이 아니라 표를 읽는다(`render/heights.py` - 표 끝 너머만 표의 마지막 칸 비율로 늘림, 보간 없음).
- ⑦ AI 캡션 상한 50 → **30**: 엔진 `src/engine/corners/valueChecks.ts:90-96` · 프롬프트 `supabase/functions/_shared/corners/dateArchive.ts:288`("공백과 부호를 포함해 30자 이내") · `docs/ONDOLOG_CORNER_CONTENT.md` §2-2 길이 줄 · 하네스 길이 표는 같은 `DATE_ARCHIVE_VALUE_RULES`를 읽음(따로 표 없음). 프롬프트 캡션 예문 최장 18자 - 고칠 것 0. **2차 결과(84b json, date_archive 6시도) AI 캡션 24개 중 30자 초과 0**(최장 30자). `recheck` 다시 실행 = **시도 20 · 위반 34(84-c2와 같음, 파일 동일)**.
- ⑧ R136-5 판정: **이 저장소의 vol1에서는 "4곳"이 맞다.** vol1 = `many_photos_scenario`, 연남동 이번 기간 경유지 4곳(홍대입구역 · 연남동 카페 · 연남동 식당 · 경의선숲길) - 11/15 사본(`b2a849a`)부터 지금까지 같음 · 본문 숫자는 기록에서 센 값(`fixtures.stops_in_region` = `facts.signal` 정의) · 이번 렌더 vol1 13쪽 "경유지는 4곳". "3곳"은 대표 기사 경유지가 3곳인 권(`photo_scenario` · `batch2`)의 값 - 디자인 대조 그림이 다른 권(또는 디자인 쪽에서 고친 재료)을 vol1로 적은 것으로 보임, 시험 권 데이터가 바뀐 것은 아님. 84-c 숫자 검사는 LLM 출력 대상이라 이 시험 문장에는 걸리지 않음(시험 문장 숫자는 기록에서 셈).

### 시드 6권 렌더 (`render/local_volumes.py` - 출력은 저장소 밖 스크래치)
| 권 | 테마 | 쪽 | safe | 원문 잘림 · 넘침 | 사실 어긋남 | 디자인 audit 같음 | 시간 |
|---|---|---|---|---|---|---|---|
| vol1-photos | basic | 14 | 0 | 0 · 0 | 0 | 같음 | 91.1초(첫 Chromium 포함) |
| vol2-opener-fallback | night | 12 | 0 | 0 · 0 | 0 | 같음 | 43.8초 |
| vol2b-opener-typeonly | hip | 12 | 0 | 0 · 0 | 0 | 같음 | 23.7초 |
| vol3-long-original | ondol | 15 | 0 | 0 · 0 | 0 | 같음 | 40.0초 |
| vol4-timeline-overflow | basic | - | - | **멈춤**(5쪽 da-timeline 내용 1003 / 상자 953px · 원문 `.userNotes[0].text`) | - | - | - |
| vol5-batch2 | lovely | 15 | 0 | 0 · 0 | 0 | 같음 | 38.9초 |
| (vol3-fail) | ondol | - | - | 렌더 실패가 기대(대화 1081px > 940px) | | | |
타임라인 어림 - 실제(5권): +1~+4px(작게 어림 0). 전체 4분 37초.

### 결정 기록 (출처 R136-1~7)
- 높이 표는 `render/heights.py` 한 곳에서 읽는다(`compose` · `facts`가 같이 씀) - 값 복사 0.
- 노트 "실제 게재" 사진 = 데이트 아카이브 기사 + 이달의 우리 소기사(재소환 기사 사진은 표 아래 줄) · 오프너 리드 사진 수 = 기사에 실린 것만(README §11 ⑩).
- 노트 "싣지 않은 것" 새 줄 3: `메모 n개 — 대표가 아닌 기사에는 실린 사진 · 구간마다 메모 하나만 싣습니다`(옛 "하나만") · `메모 n개 — 사진 아래 칸에 들어가지 않아 줄이지 않고 뺐습니다`(D5) · `구간 n곳(메모 m개) — 글만 있는 기사 한 면에 들어가지 않았습니다`(D2, 메모 0이면 괄호 없음).
- 글만 있는 기사의 구간은 순서대로 - 하나가 안 들어가면 그 뒤는 모두 싣지 않음(건너뛰어 채우지 않음).
- 표지 이 달의 말 줄 수 = 인용 글자 줄 상자 윗변 개수(렌더 결과).
- 열린 것(PE): ① 위 멈춤 ② README §10 ② #7은 "발행 노트는 호 전체(재소환 포함)를 센다"고 적었지만 지금 렌더러는 R51-2대로 표에서 재소환을 빼고 표 아래 줄로 따로 둔다 - 바꾸지 않음(지시 범위 밖) ③ README §10 ① "이름 없는 경유지 → '이름을 남기지 않은 곳' 타임라인 · 장소 목록 · 경로 모두"인데 타임라인 구간은 지금도 장소 줄째 빠짐(`da-timeline.html:25` data-optional) - 경로 · 장소 목록은 그 말로 실림. 바꾸지 않음.

검증: 루트 tsc 0 · jest **124/2211** · deno check(`m1QualityRun.ts` · `m1Recheck.ts` · `m1Review.ts` · `generateIssueCli.ts` · `publishIssueCli.ts` · `push-send/index.ts`) 통과 · `recheck` 시도 20 · 위반 34(변화 0) · Python **348 OK(기대 실패 1)** 551초 · `npm run gate` **1회 통과 124.5초**(Vitest 69 파일 · 법무 · smoke 32/32 · `web/` 변경 0). 키 · 주소 · id · 생성 문장 0 · 새 파일 이름 ASCII(`render/heights.py` · `render/tests/test_v123.py`).

## `84-d0` 유성 후보 풀 조사 (메인 세션, 2026-11-19, 위임문 `phase-7/84-d0-meteor-pool-audit.md` · 출처 ROADMAP r135 R135-3 ③) - 조사만 · 멈춤 0

시작 확인: `DOC_REVISION: 2026-11-19-r135` - 통과. 코드 · 시험 · 설정 · 마이그레이션 · 문서 변경 0(이 절 · PROGRESS 한 줄만) · LLM 호출 0 · 원격 0(허용 질의 없음 - 표 구조는 마이그레이션 파일로 읽음) · 커밋 0. 메시지 원문 · 생성 문장 0.

### 1. 지금 다정한 말 후보가 만들어지는 길
| 단계 | 하는 것 | 곳 |
|---|---|---|
| 조회 | 기간 안 · 커플 · `deleted_at is null` 메시지만 | `supabase/functions/_shared/inputAssembly.ts:372-384` |
| 규칙 전처리(유일) | 본문 없는(사진만) 메시지 빼고 셈 · 빈/공백 본문 빼고 셈. **내용 기준 규칙 없음** | `inputAssembly.ts:508-522` · `_shared/inputPrefilter.ts`(`isTrivialMessageText`) · 근거 MASTER §17-0-9-F-2(r61, 5266-5274줄 "다툼 어휘로 날을 지우는 규칙 · 다정 단서만 남기는 규칙은 쓰지 않는다 · 내용 선별은 Haiku 태깅 몫") |
| 고르기 | **LLM(Sonnet 5.5)이 한 달 메시지 전체에서** 대화(main 1~3, 각 1~4턴)와 한 줄(sub 0~6)을 id로 고르고 정황 문장(context)을 씀 | `corners/sweetWords.ts:162-189`(프롬프트) · 출력 스키마 `:59-80` |
| 다툰 날 · 화해 빼기 | **프롬프트 지시뿐**(LLM 판단) - 엔진 검사 없음. 84-c 내용 검사도 이 맥락은 보지 않음 | `sweetWords.ts:171-172` · 근거 MASTER 17-4(6051줄~ "제외: 다툼·비난·냉담") |
| 엔진이 하는 것 | id 존재 · 커플 · 기간 판정 · 원문 옮겨 적기 · 길이 · 금지 표현 · 말투/숫자/요일 검사 | `cornerPipeline.ts` `validateCornerResponse` · `valueChecks.ts` · `contentChecks.ts` |
| 숨긴 메시지 | 조회에서 빠짐(`deleted_at`) · 24시간 뒤 행 삭제 | `inputAssembly.ts:379` · `scripts/ops/purgeWithdrawn.ts:116-128`(`HIDDEN_TABLES` · `HIDDEN_GRACE_MS`) |
| 탈퇴 · 떠난 사람 | 그 사람이 보낸 메시지 행 삭제 | `purgeWithdrawn.ts:118` · `:172` · `013_batch_functions.sql:133` · `030_dissolution_batch_fix.sql:39` |
| 저장 | `corners.content`에 **원문 사본(speaker · text · at)** - **메시지 id는 저장하지 않음** | `src/types/corners/storedContent.ts:61-65` · `:182-192` |
| 앱 읽기 | 코너는 `status = 'published'`일 때만 | `supabase/migrations/012_rls_policies.sql:184-186` |
- `scripts/ops/m1InputCandidates.ts`는 **하네스 전용**(운영 경로에서 부르지 않음, 파일 머리 1-14줄) - 후보 측정용.
- 태깅 칸은 이미 있다: `messages.warmth_score` · `sentiment` · `analyzed_at` · 색인 `idx_messages_warmth` · `idx_messages_unanalyzed`(`007_chat.sql:15-38`) - **채우는 코드 0**(앱 두 곳이 "읽지도 쓰지도 않는다" 주석: `web/src/features/chat/chatApi.ts:7` · `useChatMessages.ts:11`).

### 2. 유성 규칙을 결정적으로 할 수 있나
- **규칙의 움직임은 전부 결정적**: 7일 지남(`sent_at ≤ 지금 - 7일`) · 하루 최대 1번 · 놓친 말 다음 날 다시 · 잡은 말 다시 0 · 후보 0이면 표시 없음 - 후보 목록이 있으면 기기에서 순수 함수로 된다(예: 커플 id + KST 날짜 해시로 "아직 안 잡은 후보" 중 하나).
- **후보(어느 말이 다정한가)는 결정적으로 하면 안 된다**: MASTER §17-0-9-F-2(r61)가 낱말 규칙 선별 · 다툼 어휘 규칙을 명시적으로 금지(같은 날 화해 · 다정한 말까지 지우거나, 다툼 맥락을 놓침). 내용 판단은 LLM(태깅 또는 코너)의 몫.
- **월 1회 매거진 결과 재쓰기**: 가능. 시간 차 = 그 달 말이 다음 달 발행 뒤에 유성 후보가 됨 → 실제 지연 약 1~8주(7일 "이상"은 늘 지켜짐 · 9-7 결정 5의 "유성을 만들려 말을 고르는" 위험은 더 약해짐). 첫 호 발행 전에는 후보 0(= 표시 없음). 걸리는 것: 저장 내용에 메시지 id가 없어 `sent_at` 일치로 찾거나 앞으로 id를 저장해야 함.

### 3. 방식 후보
| 방식 | 고르는 곳 · 시점 | LLM 호출 · 1커플 1달 비용 | 저장 · 마이그레이션 | 빼는 규칙 | 잡은/놓친 상태 · 두 사람 | 삭제 약속 · 고칠 문서 |
|---|---|---|---|---|---|---|
| **A. 발행된 호의 다정한 말 재사용** (추천) | 발행된 다정한 말들 코너의 main 턴 + sub. 앱이 읽을 때 메시지 행을 `sent_at`(+본문)으로 다시 찾음 | **추가 0** | 새 표 0 · 마이그레이션 0(기존 `corners` · `messages` 읽기) · 앞으로 id를 저장하려면 `corners.content` 모양(§6) 한 칸 - jsonb라 DB 변경 0 | 다툰 날 = 매거진과 같은 LLM 판단(사람 판정 거친 결과) · 숨김 · 탈퇴 = 메시지 행이 없으면 건너뜀 | 기기(새 기기 저장 범주) · 후보는 같고 잡은 기록은 각자 | 맞음(사본 글이 아니라 살아 있는 행을 다시 읽을 때). MASTER 9-8-1 데이터 칸(`warmth_score` → 발행된 다정한 말) |
| B. 메시지 태깅(MASTER 6-7 원설계) | 서버 배치가 매일 새 메시지에 `warmth_score`(+ 다툼 표시) · 후보 = 점수 높고 7일 지난 말 | Haiku 5.5 매일 배치: **약 $0.02/달(어림)** - 입력 약 8만 토큰 · 출력 약 1.7만(생각 포함) · Sonnet 5.5로 하면 약 $0.3/달(어림) | 기존 칸(007) 씀 · **마이그레이션 필요**: `messages_update`가 커플 누구나 모든 칸을 고칠 수 있음(`012:151-154`) → 태깅 칸 보호 + 예약 실행(cron) · **함수 배포 필요** | 다툼 표시를 태깅이 함께 내야 함(날 단위) · 숨김 · 탈퇴 = 같은 행이라 같이 사라짐 | 기기 · 같은 후보 | 맞음. **AI 활용 안내 · 처리방침 4번 "잡지 문장 생성" 목적에 "다정한 말 고르기" 추가(법무 M4-7)** · MASTER 6-7 모델 이름 · CLAUDE.md "채팅 태깅 코드 0" 줄 |
| C. 결정적 규칙(낱말 · 이모지 · 길이) | 기기 또는 서버 | 0 | 0 | **다툼 맥락을 못 뺌** | 기기 | MASTER §17-0-9-F-2(r61) 위반 - **추천 안 함** |
| D. 다정한 말 코너가 "후보 풀"도 함께 냄 | 월 생성 때 sweet_words 출력에 후보 id 목록(예: 20개) 추가 · 또는 별도 호출 | 같은 호출에 얹으면 출력 약 +200토큰 ≈ **+$0.002/달** · 따로 부르면 약 $0.06/달(2차 실측 다정한 말 1회) | 코너 content에 두면 0(단, 발행 뒤에만 읽힘) · 발행 전에도 쓰려면 새 표 + RLS | 다정한 말과 같은 지시 | 기기 · 같은 후보 | 맞음(id만 · 행 다시 읽기). 프롬프트가 바뀌어 **최종 실측에 함께 넣어야 함**(R135-3) · CORNER_CONTENT §6 |
- 추천(메인 세션): **A** - LLM · 마이그레이션 · 법무 문서 변경 없이 바로 열 수 있고, 후보가 이미 사람 판정을 거친 매거진 선택이라 다툼 맥락 위험이 가장 낮다. 후보가 모자라면(한 달 약 10~20개) 다음 단계로 **D(얹기)**. B는 "일간 다정한 말들"(MASTER 17-4 정식 운영)과 함께 정할 때.
- 비용 단가: 84-b 2차 실측(Sonnet 5.5 다정한 말 1회 $0.0558~0.0644 · 입력 약 1.9만 토큰) · Haiku 5.5 $0.10/$0.50 per MTok(공식 가격표 - MASTER 6-7은 아직 Haiku 4.5 $1/$5).

### 4. 화면 연결점
- 유성 층: `web/src/features/sky/SkyScreen.tsx` C01 머리 · ✕(316-326줄) 아래 · 이번 달 패널(`MonthPanel` 393줄~, `ready`가 켜질 때 414줄)에서 "처음 연 뒤 4~10초" 시작 · 지난 하늘(`showPast` 226줄)에서는 안 떨어짐 · 둘러보기 `SkyTour.tsx`(보드 17-b는 C08에서도 떨어진다고 함).
- **C03 떨어진 말 화면은 앱에 없다**(웹에 C03 코드 0 - 77-에서 유성과 함께 제외, HANDOFF "85-" 표 307줄) - 새로 만들어야 함.
- 설정 "유성 떨어뜨리기" 줄: `features/settings/SettingsView.tsx`(OUR SKY 묶음, 머리 주석 8줄) · 값은 `skyPrefs.ts`(`skypref` 범주)에 키 하나.
- 모션표 빠진 3줄(보드 `N-R17-Our-Sky-2.dc.html` 17-b 312-315줄): ① 유성 지나감 - 오른쪽 위 → 왼쪽 아래 · 각도 25~35° · 머리 이동 2.4s · 꼬리는 처음 0.4s · cubic-bezier(.3,0,.7,1) / 줄인 모션 = 제자리 빛 나타남 0.6s · 머묾 4s · 사라짐 0.6s ② 유성 사라짐 - 투명도 1→0 0.6s · 꼬리는 머리 쪽으로 줄어듦 ease-in · 흔적 없음 ③ 유성 누름 → C03 - 1단계 C03 전환 그대로 · 잡은 말이 N번째로 열림.
- 기기 저장: **새 범주 필요**(잡은 말 = 메시지 id + 잡은 때 · 그날 보인 후보) - 81- 모양 버전 · 읽을 때 검사(`cache/cacheShapes.ts:92` 버전 표). 원문은 저장하지 않고 id만(삭제 약속). 지울 때 규칙은 열린 질문 8.

### 5. 열린 질문 (서로 다르게 말하는 곳 · 정해지지 않은 곳)
1. 후보 원천: MASTER 9-8-1(2115줄)은 `warmth_score` · R124-9는 "다정한 말들 코너 후보를 쓸지 · 별도 태깅" - PM 결정 대상.
2. 누를 수 있는 시간: MASTER 9-8-4(2148줄) "3초 · 줄인 모션 제자리 4초 빛" ↔ 보드 17-b "3초(줄인 모션 5.2초)" + 모션 0.6 · 4 · 0.6초.
3. 떨어지는 화면: MASTER "하늘을 연 지 4~10초"(C01) ↔ 보드 "그날 C01 · C08을 처음 연 뒤 · C02 제외".
4. 유성 한 개의 단위: C03은 "문장 하나 · 이름 · 시각"(보드 17-b) - main 대화(최대 4턴 · 두 사람 · 짧은 반응 "응" 포함)를 턴마다 후보로 쓸지, sub(단문)만 쓸지 정해진 곳 없음.
5. 두 사람이 같은 유성을 보는지: 잡은 기록이 기기에만(R125-5)이라 한쪽이 잡으면 다음 날부터 서로 다를 수 있음 - 정해진 곳 없음.
6. C03 "채팅에서 보기": 대상 메시지가 숨김 · 삭제(24시간 정리)됐거나 채팅에 아직 안 불러온 옛 메시지일 때 동작 - 정해진 곳 없음.
7. MASTER 9-8 머리(2102줄) "하늘은 읽기 전용 · 새 테이블 · 서버 쓰기 · 마이그레이션 0" ↔ B · D(발행 전 사용)는 서버 쓰기가 필요(하늘 밖 생성 단계라면 모순은 아님 - 확인 필요).
8. 잡은 말 기록의 지울 때: 메시지 id는 커플 자료 → 81- 규칙(`deviceCache.ts:22-23` `COUPLE_KINDS`)대로면 로그아웃 · 계정 전환 때 지워져 {n}/{N}이 처음부터 - 의도인지 정해진 곳 없음.
9. 다툰 날 · 화해 빼기는 지금 **프롬프트뿐**(`sweetWords.ts:171-172`) - 유성은 잡지 맥락 없이 한 줄만 떠서 위험이 더 큼. 위임서가 적은 "R19-2"는 데이트 대표 화보 규칙(ROADMAP 386줄)이라 이 규칙의 출처가 아님 - 출처는 MASTER 17-4 · §17-0-9-F-2.
10. 태깅 모델: MASTER 6-7(609줄) Haiku 4.5 ↔ CLAUDE.md "채팅 태깅 LLM 코드 0(R124-2)" ↔ 지금 모델표(Haiku 5.5).
11. `messages_update` 정책(`012:151-154`)이 칸을 가리지 않아 커플 누구나 `warmth_score`를 쓸 수 있음 - B를 고르면 막아야 함.
12. 후보 0: **정해져 있음** - MASTER 9-8-4 · 보드 17-b 262줄 "유성 없음, 아무 표시 없음". 다만 "유성 떨어뜨리기" 줄을 "유성이 열릴 때부터" 보이는 기준이 기능 켜짐인지 후보 1개 이상인지는 정해지지 않음.

## `84-c2` 시각 앞말 · 요일 묶음 · 발행 노트 AI 안내 한 줄 (메인 세션, 2026-11-19, 위임문 `phase-7/84-c2-dispatch-time-weekday-note.md` · 출처 ROADMAP r134 R134-1~7) - 완료 · 멈춤 0 (미커밋)

시작 확인: `DOC_REVISION: 2026-11-19-r134` · 84-c 커밋 들어감(작업 트리 깨끗) - 통과. LLM 호출 0 · 원격 0(허용 질의 없음 - 실행 0) · 마이그레이션 0 · 함수 배포 0 · 새 패키지 0 · `web/` 0 · 디자인 틀 0(`render/issue/` 파일 변경 0 · `da-places.html` 0) · MASTER 0 · `demo_responses` 0 · 커밋 0.

### ①~⑦ 지금(84-c 커밋 기준 파일:줄) → 고친 것
| # | 고치기 전 | 고친 것 · 시험 |
|---|---|---|
| ① 시각 앞말 | 오전/오후만 허용 - 그 밖은 "오전/오후 없음" 실패(`src/engine/corners/contentChecks.ts:316-319`) | `TIME_BANDS`(R134-2 구간) · `inTimeBand` - 앞말 + 12시간제 숫자를 그 구간에 드는 쪽(h · h+12)으로 읽고, 둘 다 아니면 "시간대와 어긋남" 실패. 값 검사(입력 시각과 같음) 그대로. 시험 `__tests__/engine/corners/contentChecks84c.test.ts` "84-c2 ① 시각 앞말 구간"(경계 통과 15 · 어긋남 6 · "저녁 19시" · 반올림) |
| ② 앞말 없는 시각 | 실패. 따옴표 제외는 **이미 적용**: 숫자 · 시각 검사 맨 앞 `let rest = stripQuoted(value)`(`contentChecks.ts:294`) | 동작 그대로 · 문구만 "앞말 없음"으로. 시험 "84-c2 ② 앞말 없는 시각"("7시" 실패 · '7시에 거기서 보자'라는 말 통과 · 큰따옴표도) |
| ③ 요일 묶음 | "평일" · "주말"도 낱개처럼 날짜 하나가 필요(`contentChecks.ts:392-399` · `:430-446`) | 묶음("평일" · "주말" · "X요일마다") = 문장의 날짜(없으면 칸의 근거 날짜) **모두** 맞아야 통과 · 하나라도 어긋나면 어긋난 날짜를 적고 실패 · 근거 없음 실패. 낱개 요일 84-c 그대로. 시험 "84-c2 ③ 요일 묶음"(모두 평일 · 하나 주말 · 근거 없음 · 토요일마다 2개) |
| 프롬프트 | 공통 원칙 시각 줄 = 오전/오후만 · 요일 줄 = "요일을 쓸 때는 그 날짜를 같은 문장에"(`cornerCommon.ts:134` · `:136`) | 시간대 앞말 구간 · 예("낮 12시 30분" · "저녁 7시") · 앞말 없는 시각 금지 / 낱개는 같은 문장에 날짜 · 묶음은 근거가 모두 맞을 때만(R134-1 예문도 규칙과 같게). 시험 `_shared/corners/contentChecks84c.test.ts` "공통 원칙" |
| ④ 다시 검사 | - | 아래 표 |
| ⑤ 발행 노트 한 줄 | 없음 | 문장 상수 `render/compose.py` `NOTE_AI_NOTICE`(한 곳) → 노트 값 `aiNotice` → 슬롯 `@note.aiNotice`. 렌더러가 노트 틀의 **정정 요청 문단 바로 뒤**(페이지 맨 아래 블록 = 노트의 끝)에 한 줄을 끼움(`render/render_issue.py` `add_note_ai_notice` · `fill_page`) - 틀 파일은 고치지 않음. 시험 `render/tests/test_c2_note.py`(문장 한 곳 · 끝에 한 번 · 다른 지면 0 · 틀 그대로 · 자리 못 찾으면 멈춤 · 판면 검사 새 위반 0 - 사진 많은 호 포함) |
| ⑥ 옛 고정 질문 | `render/tests/fixtures.py:73-74` 옛 문구 | 84-c 정본(해요체)으로. 시험 "test_fixed_questions_match_the_engine" + 렌더 회귀 |
| ⑦ CORNER_CONTENT | §2-3 예시 옛 문구 · §0-5에 구간표 · 묶음 규칙 없음 | §2-3 고정 질문 2개 해요체 + 같은 예시의 맞춤 질문 "가볼까?" → "가볼까요?"(R134-1 예문 기준) · §0-5에 시각 앞말 구간 한 줄 · 요일 묶음 한 줄 |

### ④ 다시 검사 (2차 json 18개 · 시도 20 · 84-c 대비 바뀐 것만)
| 항목 | 84-c | 84-c2 |
|---|---|---|
| Sonnet 이달 r2 실린 시도 "낮 12시 30분"(입력 12:30) | 실패(형식) | **통과** |
| 같은 시도 "7시" | 실패 | **실패 유지**(앞말 없음) |
| Sonnet 이달 r1 둘째 시도(안 실림) "평일" 2곳 | 실패(날짜 못 정함) | **통과** - 근거 날짜 2026-09-04(금) · 09-11(금) 모두 평일 |
| Opus 다정 r3 "평일" · Opus 이달 r1 "평일" 2곳 | 실패(날짜 못 정함 · ≠) | 실패 유지 - 사유만 "≠ 2026-09-12(토)" · "≠ 2026-09-05(토)"(근거에 토요일이 섞임) |
- 잡혀야 하는 것(84-c 목록) 전부 그대로 잡힘: ~다체 · 반올림 3 · 24시 1 · 반말 7 · 요일 13. 합계 위반 37 → **34**. 날짜 · 숫자 오탐 0.

### 결정 기록 (출처 R134-1~7)
1. 0시대: R134-2 구간대로 **"밤"(00:00~02:59)과 "새벽"(00:00~05:59) 둘 다 허용** - "밤 12시 30분" · "새벽 12시 30분" 모두 통과. "정오"(12:00) · "자정"(00:00) 낱말과 "오전 12시"(00:00) · "오후 12시"(12:00)는 84-c 그대로 허용.
2. 앞말 + 숫자 읽기: 앞말 구간에 드는 쪽(h시 · h+12시)으로 읽는다(밤 1시 = 01:00 · 낮 1시 = 13:00). 어느 쪽도 구간 밖이면 "어긋남" 실패, 그다음 값 검사.
3. 요일 묶음의 날짜: 문장에 날짜가 있으면 그 날짜 전부, 없으면 칸의 근거 날짜 전부. 근거 날짜가 없는 칸(헤드라인 · 리드 · 신호 · 마무리)에서 묶음을 쓰려면 같은 문장에 날짜가 있어야 한다.
4. 발행 노트 안내 줄은 **틀 문구처럼 "온도록이 쓴 문장" 수에 넣지 않았다**(R26-5가 세는 것은 `@da.lead` 같은 기사 쪽 조립 문장 - 노트의 안내 · 정정 요청 문구는 세지 않음). PM이 세라고 하면 `compose._note_values`에서 한 줄.
5. 발행 노트 줄 = **개발 임시 수정**(R50-6 · R51-2와 같은 방식): 지면 HTML 파일은 그대로, 렌더러가 끼운다. 디자인 19번 · v1.2.3이 자리 · 크기를 정하면 디자인이 이기고, 그때 `NOTE_AI_NOTICE_LINE`(자리)과 `NOTE_AI_NOTICE`(문장)만 옮긴다. 맨 아래 블록은 `bottom:118px`로 붙어 있어 줄이 위로 자란다.
6. 렌더러 틀에 박힌 옛 고정 질문 문구: `render/issue/pages/da-places.html:52`("이날의 데이트는<br>10점 만점에 몇 점?") - **틀의 자리 글자(견본)**이고 렌더 때 content의 `closingQuestions[].text`로 바뀐다. 고치지 않음(디자인 26번). 같은 견본이 `docs/design/nocturne/render/issue/pages/da-places.html:52`에도.
7. 렌더 시험 자료의 맞춤 질문 견본("…어디에 가볼까?", `render/tests/fixtures.py:69`)은 고정 질문이 아니라 손대지 않았다(⑥ 범위 = 고정 질문).

### 84-b 3차 실행 명령
84-c 절 "84-b 3차 실행 명령" **그대로**(`--tag 84b3` · 끝에 `recheck`).

검증: 루트 tsc 0 · jest **124/2210**(이전 124/2180 · PGlite 포함) · deno check 5개 통과 · `recheck` 다시 실행(위 표) · Python **330 OK**(이전 324 · 새 `test_c2_note.py` 6건 - 브라우저 판면 검사 포함, 386.1초) · `npm run gate` **1회 통과 119초**(Vitest 69/1181 + 1 건너뜀 · 법무 8/8 · smoke 32/32 · `web/` 변경 0). 키 · 주소 · 요청 id · 생성 문장 0 · 새 파일 이름 ASCII.

## `84-c` 매거진 AI 자동 검사 - 칸별 말투 · 숫자/시각 · 요일 · 시험 데이터 연도 (메인 세션, 2026-11-19, 위임문 `phase-7/84-c-dispatch-auto-checks.md` · 출처 ROADMAP r133 R133-1~6) - 완료 · **⑥ 발행 노트 한 줄만 멈춤** (미커밋)

시작 확인: `DOC_REVISION: 2026-11-19-r133` - 통과. **LLM 호출 0**(시험 · 다시 검사 모두 가짜 응답 · 저장된 실행) · 원격 0(허용 질의 없음 - 실행 0) · 마이그레이션 0 · 함수 배포 0 · 새 패키지 0 · `web/` 0 · `consent.ts` 0 · `demo_responses` 0 · 실제 데이터 0 · R34-3 0 · 커밋 0.

### 멈춘 것
- **⑥ 발행 노트 끝 AI 안내 한 줄**: 발행 노트는 `web/`이 아니라 **렌더러**(`render/compose.py:769` 노트 쪽 · `:927` 노트 문장 · 틀 `render/issue/note.html`)에 있다 - 이번 편집 범위(`_shared` · `src/engine/corners` · `scripts/ops` · CORNER_CONTENT) 밖이라 그 항목만 멈춤. 문장은 위임서 그대로 준비됨: "온도록이 쓴 문장은 두 분의 기록을 바탕으로 AI가 만들었습니다. 두 분이 남긴 말과 사진은 고치지 않았습니다." 참고: 앱 쪽 비슷한 문구가 `src/constants/magazineCopy.ts:10`(해요체)에 있다.

### ①~⑦ 지금(HEAD 파일:줄) → 고친 것
| # | 고치기 전 | 고친 것 · 시험 |
|---|---|---|
| ① 칸별 말투 | 검사 없음. 값 검사는 길이 · 금지 표현뿐(`src/engine/corners/valueChecks.ts:69-81`). 재요청은 같은 요청 그대로(`cornerPipeline.ts:767-770`) | 새 `src/engine/corners/contentChecks.ts`(순수) - 문장 끝 분류(합니다체 · 해요체 · ~다체 · 반말 · 명사형 · 연결형) · 인용(따옴표 6종) 제외 · 칸 3종(R133-4 표). 코너가 칸 목록을 만듦(새 `_shared/corners/contentTargets.ts` · 코너 3종 `contentChecksFor`). 골격 7단계(저장 스키마 뒤)에서 보고 걸리면 `schema_invalid` + **재요청 안내 블록**(칸 · 규칙만) → 기존 1회 재요청 → 또 걸리면 빠짐. 시험 `__tests__/engine/corners/contentChecks84c.test.ts` · `_shared/corners/contentChecks84c.test.ts` |
| ② 숫자 · 시각 | 검사 없음. 프롬프트에 시각 형식 없음 | 프롬프트 공통 원칙에 "입력 값 그대로 · 오전/오후 h시 m분 · 24시 표기 0"(`cornerCommon.ts` 공통 원칙). 출력 검사: "HH:MM" · 24시 · 오전/오후 없음 · "반" = 형식 위반 / 오전 · 오후 · 정오 · 자정 값이 그 칸이 볼 수 있는 입력 시각과 같아야 함(데이트 아카이브는 **그 데이트의 시각만**) / "N월 N일" · "N일" · "N월" · "N년" 입력 날짜 / "사진 n장"(숫자 · 한글 수사 1~10) 입력 장수 / 그 밖의 아라비아 숫자는 입력에 나온 숫자. "본문 숫자 대조"는 여기 합침 |
| ③ 요일 | 입력에 요일 없음 - 모델이 메시지 문맥으로 짐작 | 메시지 · 데이트 · 사진 줄에 `weekday`(KST, 엔진 계산 - `cornerCommon.ts` `messageLine` · `dateLine` · `thisMonth.ts` 사진 줄). 프롬프트 "요일은 weekday 칸에서만 · 같은 문장에 날짜". 출력 검사: 요일 낱말(월~일요일 · 주말 · 평일)의 날짜 = 같은 문장의 날짜, 없으면 칸 근거 날짜(하나일 때) - 못 정하면 실패 · 인용 제외 |
| ④ 데이터 연도 | `fixtures/m1-month/dataset.ts` 2026년(요일 · 추석 문구는 2025년 달력) | 날짜만 1년 앞(37곳 · 재소환 2024-09-20 · 파주 2025-03-08) · 문구 · ID 그대로 · `FIXTURE_YEAR` · `periodOf(year)` · `buildTables(year)`(2차 다시 검사용 2026). 시험 `scripts/ops/fixtureYear84c.test.ts`(요일 메시지 20건 · 요일 낱말 22개 · 추석 · 2026 옮김) |
| ⑤ 마무리 42자 | 프롬프트에 글자 수 없음(`thisMonth.ts:263`) | "공백과 부호를 포함해 42자 이내, 합니다체 한 문장"(상한 42 그대로). 시험 "이달의 우리: 마무리 42자 안내" |
| ⑥ R52-3 · 발행 노트 | 숨김은 이미 렌더러(`render/compose.py:654-667` · `render/facts.py:224-240`). 프롬프트에는 없음 | 프롬프트에 "셀 수 있는 신호 = place(지역 · 장소명 그대로) · 셀 수 없는 신호는 숨겨짐 · place를 먼저"(`thisMonth.ts` signals). 시험 "R52-3 셀 수 있는 신호". **발행 노트 한 줄은 멈춤**(위) |
| ⑦ CORNER_CONTENT | 칸별 말투 표 없음 | `docs/ONDOLOG_CORNER_CONTENT.md` §0-5 "칸별 말투"(출처 R133-4) |

함께 고친 것: 고정 질문 2개(아래) · 데이트 아카이브 맞춤 질문 좋은 예("~의향은?" → "~해볼까요?" - 2차 Opus 반말이 이 예를 닮았다) · 다정한 말들 정황 좋은 예("주말 아침에 오간 대화" → "점심시간에 오간 대화" - 날짜 없는 요일 예) · 샘플 출력(`scripts/ops/sampleOutputs.ts` - 캡션 "HH:MM" → "오전/오후 h시 m분" · 본문 · 리드 · 마무리 합니다체 · 질문 해요체) · 옛 시험의 가짜 LLM 출력 문장(~다체 · 반말 → 규칙대로).

### 고정 질문 2개 (R133-4 ③)
| | 전 | 후 |
|---|---|---|
| rating | 이날의 데이트는 10점 만점에 몇 점? | 이날의 데이트는 10점 만점에 몇 점인가요? |
| recall | 이날 중 가장 기억에 남는 건? | 이날 중 가장 기억에 남는 건 무엇인가요? |
- 옛 문구가 남은 곳(편집 범위 밖 - PE/PM): `docs/ONDOLOG_MASTER.md:5520-5521` · `docs/ONDOLOG_CORNER_CONTENT.md` §2-3 예시 JSON · `docs/design/nocturne/render/issue/pages/da-places.html:52` · `render/issue/pages/da-places.html:52`(틀의 자리 글자 - 렌더는 content 값으로 바꿔 넣음) · `render/tests/fixtures.py:73-74`(렌더 시험 자료). 이미 저장된 호의 content는 옛 문구 그대로(스냅샷).

### 다시 검사 (84-b 2차 json 18개 · 시도 20 · 2026년 날짜 그대로 · `scripts/ops/out/recheck.md`)
| 잡혀야 하는 것 | 잡힌 것 |
|---|---|
| Opus this_month r3 리드 · 본문 ~다체 | 5칸(리드 1 · 본문 4) |
| Opus date_archive r1 · r2 반올림 시각 | 3곳 - r1 "오후 1시"(13:10) · r2 "오후 1시"(13:10) · **r2 "오전 11시"(11:20)** - 위임서는 2곳, r2의 11:20도 반올림이라 함께 잡힘 |
| Sonnet date_archive "13시 10분" | 1(r1) |
| 맞춤 질문 반말 5곳(Opus r1 · r2) | Opus 6(r1 3 · r2 3) + Sonnet r2 1 - 더 잡힌 2곳은 "~의향은?" · "~꼽는다면?"으로 위임서 표가 반말 예로 든 끝 |
| Sonnet this_month r1 두 번째 시도 ~다체 | 4칸(리드 · 본문 3) |
| 요일 13곳(2026년 날짜 기준이면 틀림) | 13(Opus 다정 r3 2 · Opus 이달 r1 6 · r3 3 · Sonnet 이달 r2 1 · r3 1) |

목록 밖에서 잡힌 것(오탐 아님 - 규칙 그대로, **PM 판단용**): Sonnet this_month r2 실린 시도 - "낮 12시 30분"(값은 입력 12:30과 같음 · 형식이 오전/오후 아님) · "7시"(메시지 원문 "7시에 거기서 보자"의 시각 · 오전/오후 없음) / Sonnet this_month r1 두 번째 시도(안 실림) - "평일" 2곳(근거 날짜 여럿). 날짜 · 숫자 검사 걸림 0(오탐 0). 합계 위반 37.

### 숫자 검사가 하지 않는 범위 ("확인 필요")
1. 한글 수사(사진 장수 밖): "두 곳" · "세 번" · "한 끼" · "두 날" · "두 번째".
2. 상대 날짜 · 기간: "이틀 전" · "엿새 전" · "1년 전" · "다음 날" · "전날" · "3일 뒤".
3. 숫자 없는 시간대 말: "점심 무렵" · "저녁" · "낮" · "아침"이 실제 시각과 맞는지.
4. 서수 · 계산된 날: "첫 일요일" · "둘째 주" - 요일 낱말이 있으면 ③이 날짜를 못 정해 실패로 잡지만, 요일 없는 서수는 보지 않음.
5. 사진 밖의 개수(메시지 n건 · n곳 · n번)는 아라비아 숫자가 **입력 어딘가에 나온 숫자인지**만 본다(뜻까지 대조 안 함).
6. 홀로 쓴 "N일"은 입력 날짜 중 그 일(日)이 있는지만(달이 여럿이면 어느 달인지 안 봄).

### 결정 기록 (출처 R133-1~6)
1. 검사 자리: 값 검사(84-a, Zod 직후)는 그대로. 내용 검사는 **저장 스키마까지 통과한 뒤(7단계)** - 구조 · ID 오류가 먼저 보이게. 값 검사에 걸리면 그때 내용 검사 결과도 함께 알린다(재요청 1회 안에서 다 고치게).
2. 재요청 안내: 값 · 내용 검사에 걸렸을 때만, 원래 요청 **끝에 user 블록 하나**(system · 앞 user 블록 · 캐시 지점 그대로). 그 밖의 `schema_invalid`(JSON · Zod · ID · 파생값)는 84-a까지처럼 같은 요청. 한도는 그대로 1회.
3. 시각 형식은 위임서 문구대로 **오전/오후 · 정오 · 자정만** 허용 - "낮 12시 30분" · "저녁 7시"도 형식 위반(PM 판단 항목: 낮 · 저녁 같은 앞말을 허용할지).
4. 라벨 칸의 해요체는 R133-4 허용 목록에 없어 위반으로 본다.
5. 데이트 아카이브 기사는 그 데이트의 입력값만 본다(다른 날 11:00이 있어 11:20의 반올림이 가려지던 것을 막음). 이달의 우리 · 다정한 말들은 입력 전체.
6. 시험 데이터 ID(`date-2025-0920` · `date-2026-0308` · `ph-2025-*` · `stop-2025-*` · `memo-2025-1`)는 날짜가 아니라 이름이라 그대로 두었다(위임서 "날짜만").
7. 다정한 말들 해설 문장은 지금 스키마에 없다(정황 `context`만 - 라벨 칸).
8. 엔진 결정론 규칙 A(`new Date(` 금지)에 맞춰 KST 날짜 · 요일은 `Date.parse` · `Date.UTC` + 날 수 계산으로 한다.

### ④ 영향받은 것
- 바꾼 시험 데이터: `scripts/ops/fixtures/m1-month/dataset.ts`(날짜 37곳 · `FIXTURE_YEAR` · `periodOf` · `buildTables(year)`) · `chat.ts`(머리 주석만 - 날짜는 `dataset.ts`가 붙임).
- 기댓값이 바뀐 시험: `scripts/ops/operatorPath.test.ts`(기간 인수 · `period_end` 2025-09-30 · 큰 입력 합성 메시지 연도 · "시작이 끝" 경우의 끝 날짜) · `scripts/ops/liveMode84a.test.ts`(기간 인수 · 조립 기간). 숫자 · 결과 단언은 그대로.
- 이 데이터를 쓰는 곳: 하네스 `m1QualityRun.ts` · `m1InputCandidates.ts`(연도를 `FIXTURE_YEAR`로) · `m1Review.ts`(다툰 날을 월-일로) · `m1Recheck.ts` · `seedTestData.ts`(**원격 시험 커플 시드 - 다음에 돌리면 2025년 날짜로 들어간다**, 이번에 실행 0 · 코드 변경 0).
- 다른 시험 데이터(`cornerFixtures.ts` 2026-08 등) · 실제 데이터 · `demo_responses` 변경 0.

### 84-b 3차 실행 명령
84-a 절 "84-b 실행 명령"의 키 넣기 · `run` 두 줄 · `review` · 창 닫기 **그대로**(태그만 새로: `--tag 84b3` 권장 - 2차 json과 나란히 남는다). 더한 줄 하나(키 · 네트워크 불필요):
```
deno run --no-lock --config supabase/functions/deno.json --allow-read=. --allow-write=scripts/ops/out scripts/ops/m1QualityRun.ts recheck
```
→ `scripts/ops/out/recheck.md`(2차 · 3차 모든 시도를 새 검사로 - 3차 json에는 `fixtureYear: 2025`가 남는다).

검증: 루트 tsc 0 · jest **124/2180**(이전 121/2089 · 새 시험 파일 3개 · PGlite 포함) · deno check(`m1QualityRun.ts` · `m1Recheck.ts` · `m1Review.ts` · `generateIssueCli.ts` · `publishIssueCli.ts` · `push-send/index.ts`) 통과 · `recheck` 실행(2차 json, 오프라인) · Python **324 OK**(340.0초) · `npm run gate` **1회 통과 119초**(Vitest 69/1181 + 1 건너뜀 · 법무 8/8 · smoke 32/32 · `web/` 변경 0). 키 · 주소 · 요청 id · 생성 문장 0 · 새 파일 이름 ASCII.

## `84-a2` LLM 요청 고치기 - 샘플링 값 · prefill · 재요청 · 사고 블록 (메인 세션, 2026-11-19, 위임문 `phase-7/84-a2-dispatch-llm-request-fix.md` · 출처 ROADMAP r131 R131-1~4) - 완료 (미커밋)

시작 확인: `DOC_REVISION: 2026-11-19-r131`(ROADMAP 15줄) - 통과. 멈춤 0. **LLM 호출 0**(시험은 가짜 fetch) · 원격 0(허용 질의 없음 - 실행 0) · 마이그레이션 0 · 함수 배포 0 · 새 패키지 0 · `web/` 0 · `consent.ts` 0 · `demo_responses` 0 · R34-3 0 · 커밋 0.

### 바꾼 파일
| 파일 | 내용 |
|---|---|
| `supabase/functions/_shared/llmClient.ts` | 본문에서 `temperature` 뺌(허용 키 `REQUEST_BODY_KEYS` = model · max_tokens · system · messages) · 재요청은 408 · 429 · 5xx · 응답 없음(시간 초과 · 네트워크 예외)만(`isRetryableStatus`) · 응답은 text 블록만 이어 붙임(`extractResponseText`) · `stop_reason=max_tokens`면 빈 텍스트(형식 오류) · 오류 본문은 `error.type: error.message`만(`summarizeErrorBody` - 요청 id 버림) · 기본 `max_tokens` = `LLM_MAX_TOKENS` |
| `src/engine/corners/llmSafety.ts` | `LLM_TEMPERATURE` 지움 · `LLM_MAX_TOKENS` 16,000 새로 · `WORST_OUTPUT_TOKENS` = 그 값(옛 4096). 위임서 편집 범위의 "비용 계산"이 실제로 이 파일에 있어 고침(84-a 결정 기록 1과 같은 사정) |
| `scripts/ops/m1QualityRun.ts` | 기본 `--max-tokens` 16000 · 오류 본문 요약 저장 · 잘린 회차는 잘린 text 블록을 판정 자료로 · runs json의 `llmCallAttempts` = 보낸 HTTP 수 · review 부분을 도우미로 뺌 |
| `scripts/ops/m1Review.ts`(신규 · 도우미) | 저장 형식 · `renderReview`(순수) · `sentCalls` = `httpCalls.length` - review · summary 호출 칸이 이 값 하나 · 말투 칸 "합니다체 밖"(회차 칸 · 모델별 집계 기준 문단) |
| 시험 | 새 `supabase/functions/_shared/llmRequest84a2.test.ts`(25) · 새 `scripts/ops/m1Review84a2.test.ts`(4) · `safety84a.test.ts`(temperature 단언 → 없음 단언) · `__tests__/engine/corners/llmSafety84a.test.ts`(최악값 16,000) · `scripts/ops/liveMode84a.test.ts`(샘플링 값 0 단언 · 400/429 보낸 수 = `llm_usage.attempts` 2건) |

### ①~④ 지금(고치기 전, HEAD 기준 파일:줄) → 고친 것
| # | 고치기 전 | 고친 것 · 시험 |
|---|---|---|
| ① | `llmClient.ts:242` 본문에 `temperature`(값 `llmSafety.ts:24` 0.5). prefill · `thinking` · effort · top_p/top_k는 원래 0(`llmClient.ts:239-245` - messages는 user 하나) | temperature 뺌 · 허용 키 목록. `llmRequest84a2.test.ts` "① 요청 본문 고정 - 두 모델 각각"(키 집합 = 허용 목록 · 금지 키 8개 없음 · user 하나) |
| ② | `llmClient.ts:248-251` 2xx 아니면 모두 "전송 실패" → `:284-306`에서 예산 3번까지 다시 보냄(400도 3번) | 408 · 429 · 5xx · 응답 없음만 다시. 그 밖은 1번에 실패. "② 재요청 - 상태 코드별 보낸 횟수"(400 · 401 · 403 · 404 = 1 / 429 · 500 · 503 · 529 = 3 / 시간 초과 → 2 / 429 → 400 = 2) · `liveMode84a` "84-a2 … 보낸 수"(llm_usage.attempts = fetch 수) · `m1Review84a2` "② 호출 수" |
| ③ | `m1QualityRun.ts:573` 회차 칸 "말투 위반(해요체 밖)" · `:581` 기준 문단 "해요체 밖 말투" | "합니다체 밖"(두 곳). 판정 자료 생성 코드의 "해요체" 0. `m1Review84a2` "③ review.md 말투 칸" |
| ④-a | `llmClient.ts:265` `find(type === 'text')` - type으로 고르긴 했으나 **첫 text 블록 하나만** | text 블록 전부 순서대로 이어 붙임 · 없으면 빈 텍스트 → 파이프라인 `schema_invalid`(기존 재요청 규칙). "④-a"(thinking 앞 · thinking만 · text 여러 개 · 파이프라인까지) |
| ④-b | `llmClient.ts:176-185` `usage.output_tokens` 그대로 - 생각 토큰을 따로 세지 않음(이미 맞음) | 코드 동작 그대로 · 주석과 시험만. "④-b"(`thinking_tokens` 같은 칸이 와도 더하지 않음 · 비용 = 출력 단가 × output_tokens) |
| ④-c | `stop_reason=max_tokens`여도 `llmClient.ts:265-269`가 잘린 글을 돌려줌 → 골격 JSON 검사가 보통 `schema_invalid`(생성 경로는 재요청) · 하네스만 `m1QualityRun.ts:382-391`에서 재요청 막고 표시. 잘린 글이 우연히 검사를 통과하면 실릴 길이 있었음 | 잘리면 글이 있어도 빈 텍스트 = 형식 오류(지면 0). 하네스 잘림 표시 · 재요청 막기는 그대로. "④-c"(빈 텍스트 · 파이프라인 실패) |

### 결정 기록 (출처 R131-1~4 · 공식 문서)
1. 근거 문서(2026-11-19 확인): https://platform.claude.com/docs/en/models/opus-5-5/migration-guide · https://platform.claude.com/docs/en/build-with-claude/thinking
   - Opus 5.5: "Omit `temperature`, `top_p`, and `top_k`." / "Don't end `messages` with a prefilled assistant turn: it is rejected." / effort "the default is `medium`" / "`max_tokens` remains a hard limit on total output, thinking plus response text" / "Thinking tokens are billed as output tokens even when the thinking text is not returned to you" / "A response can start with one or more `thinking` blocks before the first `text` block … Select content blocks by their `type` field".
   - Sonnet 5.5(thinking 문서 표): 요청에 `thinking` 없음 = "Adaptive thinking" · `budget_tokens` = 400 · `disabled` = 400. "non-default `temperature`, `top_p`, or `top_k` values return a 400 error on every request"(Sonnet 5.5 포함 목록) · "Claude 4.6 and later models … reject a prefilled final assistant turn with a 400 error" · 모든 모델 공통 "the tokens Claude spends reasoning are billed as output tokens … and they count toward `max_tokens` alongside the response text" · "`max_tokens`, which includes all thinking Claude generates in the current turn, is enforced as a strict limit".
   - `usage.output_tokens`에 생각 토큰 포함: 직접 문장은 "The progress update counts toward `usage.output_tokens` at its full length" · "The billed output token count does not match the count of tokens you see in the response" - **청구 = output_tokens**로 읽음(생각만 따로 적은 문장은 못 찾음 → 이 한 칸은 "간접 근거").
2. effort는 보내지 않음(Opus 기본 medium · Sonnet 기본 high) - 바꿀지는 PM.
3. 재요청 허용 = 응답 없음 · 408 · 429 · 5xx. 위임서의 "시간 초과"에 네트워크 예외(응답 없음)와 408을 함께 넣었다. 그 밖 4xx(409 · 413 · 422 등)도 바로 실패.
4. `max_tokens` 4096 → **16,000**. 이유: 두 모델 다 생각이 늘 켜져 있고 한도는 생각 + 답 합계 - 4096은 생각 없던 때 크기(MASTER §17-0-10-H)라 이달의 우리처럼 입력이 큰 코너(추정 상한 약 2.2만 토큰)에서 생각에 먹혀 잘릴 수 있다. 16,000은 스트리밍 없는 요청의 공식 권장 기본. 잘리면 형식 오류.
5. 호출 120초 상한은 그대로(R124-3). 16,000 토큰을 다 쓰면 120초를 넘을 수 있어, 실제 상한은 시간 쪽이 먼저 걸릴 수 있다(시간 초과 = 전송 실패 → 기존 재시도). **PM 판단 항목**: 120초 유지 · effort 낮추기 · 스트리밍 중 하나가 필요한지 84-b 2차 지연 숫자로 판단.
6. 84-b 1차 `calls=3` 대 "호출 1": 하네스 화면 줄은 HTTP 수(`m1QualityRun.ts:449` `httpCalls.length`), review · summary는 골격의 `llmClient.call()` 횟수(`:550` · `:630` `rec.llmCallAttempts` ← `cornerPipeline.ts:745`). 400이 `llmClient.ts:284-306` 안에서 3번 보내졌지만 골격은 call() 1번으로 셌다. 지금은 넷(화면 · runs json · review · summary) 모두 보낸 HTTP 수. 생성 경로 `llm_usage.attempts`는 원래 시도 직전 판정 통과 수(= 보낸 수, `generateIssue.ts:367-368`) - 그대로.
7. 오류 본문의 요청 id: 84-b 1차 `scripts/ops/out/review.md` · `runs/*.json`(추적 안 함)에 요청 id가 들어가 있다 - 이번 코드부터는 저장 0. 옛 파일은 2차를 같은 `--tag 84b`로 돌리면 18개 json이 덮이고 review가 다시 만들어진다(지우기는 사람 판단).

### CostMeter 최악값 (상한 그대로: 1호 $2 · 하네스 명령 1회 $10)
입력 추정 상한(`estimateRequestTokens(…, 'high')`, 1차 dry 요청 기준): 데이트 3,882 · 다정한 말들 20,616 · 이달의 우리 22,359 토큰. 1회 최악 = 입력 × max(입력, 캐시 쓰기 단가) + max_tokens × 출력 단가.

| 모델 | max_tokens | 1회 최악(데이트 / 다정 / 이달) | 1호 이론 최악(3코너 × 3번) |
|---|---|---|---|
| Sonnet 5.5 | 4096 | $0.051 / $0.093 / $0.097 | $0.72 |
| Sonnet 5.5 | **16,000** | $0.170 / $0.212 / $0.216 | **$1.79** |
| Opus 5.5 | 4096 | $0.101 / $0.185 / $0.194 | $1.44 |
| Opus 5.5 | **16,000** | $0.339 / $0.423 / $0.432 | **$3.58** |

- 계량기는 "지금까지 실제 + **이번 1회** 최악"으로 시도마다 본다 → Opus 첫 시도 최악 $0.43 < $2라 **미리 막히지 않음**(멈춤 조건 해당 없음). 실제 지출이 약 $1.57을 넘은 뒤의 시도만 막힌다(안전 정지 · 코너 pending).
- Opus 1호 이론 최악($3.58)은 $2를 넘는다 - 아홉 번 모두 16,000을 다 쓰는 경우에만. 하네스(명령 1회 9코너-실행 × 최대 3번 = 27번)도 이론 최악 약 $11.6로 $10을 넘지만 같은 방식이라 미리 막히지 않음. **PM 판단 항목**(상한 올리기 · 재시도 줄이기 아님 - 정보만).

### 84-b 실행 명령 (84-a2 뒤) - 1차와 **그대로**
84-a 절 "84-b 실행 명령"의 키 넣기 · 세 줄 · 창 닫기 그대로. 달라진 것은 명령 줄이 아니라 기본값뿐: `max_tokens` 16,000(인자 `--max-tokens` 안 줌) · 샘플링 값 0. 같은 `--tag 84b`면 1차 json 18개를 덮는다.

검증: 루트 tsc 0 · jest **121/2089**(이전 119/2060 · 새 파일 2개 29건) · PGlite(jest 안) · deno check(`m1QualityRun.ts` · `m1Review.ts` · `generateIssueCli.ts` · `publishIssueCli.ts` · `push-send/index.ts`) 통과 · Python **324 OK**(331.6초) · `npm run gate` **1회 통과 152초**(Vitest 69/1181 + 1 건너뜀 · 법무 8/8 · smoke 32/32 · `web/` 변경 0). 하네스 인자 검사 실행(키 없이 `run`)은 이 세션 권한에서 막혀 못 돌림 - deno check만. 키 · 주소 · 요청 id · 생성 문장 0 · 새 파일 이름 ASCII.

## `86-b` 시험 안정화 4바퀴째 (메인 세션, 2026-11-19, 위임문 `phase-7/86-b-dispatch-round4.md` · 출처 ROADMAP r129 R129-1~5 · R128-4) - **20회 연속 통과로 86- 닫힘 · 게이트 통과 1회는 못 받음(기기 느림)** (미커밋)

> 이 컴퓨터(Windows)의 Playwright WebKit ≠ iOS Safari · WKWebView — 실기기 대체 아님

- 시작 확인(R123-5): 86- 커밋 들어감(`bbeedd5`) · `DOC_REVISION`은 아직 `r128`(R129 줄 없음) - 위임서 본문만으로 진행 가능해 진행.
- 바꾼 파일: `web/scripts/stress-vitest.mjs` 하나 - 부하 조건 기본을 R129-2로(두 벌 모두 `--maxWorkers` 안 줌 = 설정값 9 · 합계 18). 86- 첫 조건(두 벌 모두 코어 수)은 `--workers-max`로 남김. 앱 · 시험 · 설정 변경 0 · 새 패키지 0 · 원격 0 · retry/skip/only/todo 0.

### 4바퀴째 (워커 9 + 같은 Vitest 한 벌 동시 워커 9 = 18, 20회)
| 회 | 결과 | 시간 |
|---|---|---|
| 1~20 | **전부 통과**(1181 + 1 건너뜀) | 45.4~72.3초(14회 72.3초가 가장 김) |
- 가장 긴 연속 **20** · 실패한 시험 0 → **86- 닫힘**. 5바퀴째 · (나) 한도 늘리기 적용 0(실패 파일 없음).

### 게이트 (부하 없음 · gate 스크립트 무변경) - **4회 시도, 통과 0**
| 회 | web tsc | Vitest | 법무 | smoke | 합 | 실패 |
|---|---|---|---|---|---|---|
| 1 | 10.2 | 34.4 | 4.7 | 3.5분(Playwright) | - | smoke 9건(WebKit 7 · Chromium 2 - 클릭 "stable" 기다림 45초 · 첫 화면 1초) |
| 2 | 32.5 | - | - | - | 84초 | Vitest 2 파일 - `vitestSetup.ts` `beforeAll`(Capacitor 웹 플러그인 미리 읽기) 10초 한도 |
| 3 | 13.0 | 34.6 | 5.7 | 2.1분 | 238초 | smoke WebKit 3건(동의 · 설정 · 깨진 기기 저장값) |
| 4 | 28.6 | 35.8 | 10.0 | 1.6분 | 220초 | smoke WebKit 1건(온보딩) |
- 회마다 다른 곳이 넘어짐 + 같은 일의 시간이 86- 때의 2~6배(web tsc 8 → 13~32초 · 스모크 빌드 6 → 12초 · Python 약 2분 → **793초**) · CPU 클럭 1.2GHz(최대 3.6GHz) 고정으로 읽힘 · 20회 부하 직후. **기기 상태(열 · 전원 모드)로 판단** - 시험 · 한도는 건드리지 않음. 기기가 정상 속도일 때 사람이 `npm run gate`를 한 번 더 돌려 확인 필요.

### 함께 한 것
- `feedPhotoStage` "[카메라] -> 한 장"(실제 FileReader · 86- 1바퀴 1/20): 86-에서 찾기 한도를 `STAGE_WAIT = { timeout: 3000 }`으로 **명시**(이유: 실제 FileReader 읽기 + 복사본 쓰기는 시계 주입 불가 · 같은 파일 저장 진단 기다림 4초보다 앞 단계 값) - 86-b 4바퀴째 0/20, 바꾼 것 없음.
- 작은 결함 목록(R123-4)에 한 줄 추가(R129-4) - 아래 86- 절 "작은 결함 목록" 끝.

검증: 4바퀴째 20/20 · 루트 tsc 0 · jest **119/2060** · Python **324 OK**(793.5초) · `npm run gate` **통과 0/4**(위 표). 시험 개수 전후 같음(Vitest 1181 + 1 건너뜀 · smoke 32). 키 · 주소 · ref · id · 이메일 0 · 새 파일 0.

## `86-` 시험 안정화 (메인 세션, 2026-11-18, 위임문 `phase-7/86-dispatch-test-stabilization.md` · ROADMAP r128 R128-4 · R126-5 · R123-4) - **멈춤(3바퀴 기준 미달) + 부분 완료** (미커밋)

> 이 컴퓨터(Windows)의 Playwright WebKit ≠ iOS Safari · WKWebView — 실기기 대체 아님

앱 코드 변경 0(시험 · 시험 설정 · 측정 스크립트만) · 새 패키지 0 · 원격 0 · `scripts/ops` · `supabase` · 루트 시험 편집 0 · 커밋 0.

### 멈춘 것
- **완료 기준 1(부하 상태 Vitest 20회 연속)을 3바퀴 안에 못 닿음** - 바퀴별 가장 긴 연속: 9 → 18 → 17. 남은 실패 모양은 하나: **부하가 몰린 한 회차에 "앱 전체 흐름" 시험 하나가 5초 한도를 넘고, 끝나지 않은 그 시험이 같은 파일의 뒤 시험을 연쇄로 무너뜨림**(2바퀴 `hotfix74h1` 11건 · 3바퀴 `settingsFlow` 9건 - 각 20회 중 1회). `settingsFlow` 그 시험은 부하 없이 114ms라 시험 자체 문제가 아니라 워커 굶김(측정 조건 = 코어 18에 Vitest 워커 18 × 2벌 = 36). PM 판단 필요: (가) 부하 조건을 "워커 최대 + 한 벌 더"에서 "설정값(9) + 한 벌 더"로 바꿀지 · (나) 앱 전체 흐름 파일들에 이유 있는 한도(정상의 10배 안팎)를 줄지 · (다) 한도를 넘은 시험의 연쇄를 막는 장치(파일 단위 격리)를 더 볼지.

### 0단계 설정 값 (전 → 후)
| 값 | 전 | 후 |
|---|---|---|
| Vitest `pool` | 기본 forks(`web/vite.config.ts:37-42`에 값 없음) | `forks` 명시 |
| `maxWorkers` · `minWorkers` | 기본(논리 코어 − 1 = 17) | **9** · 1 |
| `testTimeout` · `hookTimeout` | 기본 5000 · 10000 | 같은 값 명시(키우지 않음) |
| `retry` | 기본 0 | 0 명시 |
| 전역 setup | 없음 | `src/vitestSetup.ts` |
| Playwright `workers` · `retries` · `timeout` · `expect.timeout` | 4 · 0 · 45000 · 기본 5000(`smoke/playwright.config.ts:24-26`) | 그대로 |
| 기존 건너뜀 | `legal.vitest.tsx:129` `describe.skipIf(!LEGAL_CHECK)` 1건 | 그대로 |
- 전역 상태를 다루는 시험 도우미: 공용 setup 없이 파일마다 `afterEach`(정리 범위가 파일마다 다름). 논리 코어 18.

### 1단계 분류표 (부하 = Vitest 워커 18 + 같은 시각 Vitest 전체 한 벌 더, `web/scripts/stress-vitest.mjs`)
| 시험 파일 · 이름 | 실패 / 20 | 모양 | 분류 | 근거 |
|---|---|---|---|---|
| `feedPhotoStage` 진단 "실패 안내 토스트…" | 2/20(고치기 전) | 단언("사진 읽기") | **C** | 시험마다 `urlSeq = 0` -> 주소 `blob:own-1`이 겹치고 고른 사진 출처(`feedPhotoStage.ts` `sources`)는 모듈 전역 - 앞 시험의 끝나지 않은 저장이 다음 시험 사진을 놓음(섞은 순서에서 `revoked`에 앞 시험 주소가 보임) |
| `feedPhotoStage` "[카메라] -> 한 장" | 1/20(1바퀴) | 찾기 시간(1초) | **B** | 실제 FileReader 읽기(시계 주입 불가) |
| `main` "하늘 · 탭 바(Shell)" | 5/20(1바퀴) | 5초 한도 | **E** | 시험 안에서 `await import('../../App')` - 앱 전체 모듈 읽기가 한도 안에 들어감 |
| `hotfix74h1` 파일 전체(11~8건) | 1/20 · 1/20 | 찾기 · 한도 | **E** | ① D1 흐름이 가짜 시간 6.1초+를 돌리는 CPU 일(부하 없이 0.8~1.2초) -> 한도 초과 뒤 연쇄. 웹 플러그인 첫 사용의 동적 `import()`(실제 읽기)도 가짜 시간과 따로 놂 |
| `legal` "온보딩 [보기]와 설정…" | 1/20(1바퀴) | 5초 한도 | E(굶김) | 부하 없이 175ms - 한 회차 66.8초 몰림 때 |
| `settingsFlow` 파일 9건 | 1/20(3바퀴) | 한도 + 연쇄 | E(굶김) | 그 시험 부하 없이 114ms - **남음** |
| 섞은 순서 `hotfix74h2` "세션이 없을 때만 실패 화면…" | 시드 4242 | 단언(#2) | **C** | `useTrialDiag.clear()`가 `linkSeq`를 되돌리지 않음 |
| 섞은 순서 `connection` A-17 "올리기가 아닌 요청의 거부…" | 시드 4242 | 단언 | **C** | 앞 시험의 끝나지 않는 업로드가 모듈 `uploadsInFlight`를 1로 남김 |
| 섞은 순서 `feed` E03 "[취소]는 아무것도…" | 시드 31337 | 단언(RPC 1건) | **C** | 오류 기록 모듈의 보내기 타이머 · 모아 둔 건수가 다음 시험으로 |
| 85- 여섯 곳 · 76-j 채팅 머리 | 0/20 | - | 위험 요소: `feedFlow` 실제 380ms 대기 × 여러 번(A) · `feed` 길게 누르기 실제 560ms(A) · 고정 30ms 대기(A) · 설정 탈퇴 입력 · 피드 파일 고르기(스모크, 1초 찾기) · 76-j는 이미 고침 | 아래 처리 |

### 고친 것
| 시험 | 분류 | 처리 | 상한을 키웠다면 이유 |
|---|---|---|---|
| `feedPhotoStage.vitest.tsx` | C · B | 시험마다 주소 앞머리(`blob:t{n}-own-`) · 단언은 그대로 정확히 · `afterEach`가 저장이 끝나길 기다림 · "1장 골랐어요" 찾기 3초 | 3초: 실제 FileReader 읽기 + 복사본 쓰기(시계 주입 불가) - 같은 파일 진단 기다림 4초보다 앞 단계 값 |
| `feed.vitest.tsx` | A | 길게 누르기를 가짜 setTimeout(`shouldAdvanceTime`) + `advanceTimersByTimeAsync(560)` · 고정 30ms -> 시트 상태 `waitFor` | `waitFor` 2초: 시트가 열리는 상태 변화를 기다림(기본 1초는 부하에서 짧음) |
| `feedFlow.vitest.tsx` | A | 연타 막기(`Date.now()`)를 가짜 Date로 넘김(실제 380ms × 9회 대기 0) | - |
| `main.vitest.tsx` | E | 앱을 정적 import(모듈 읽기를 시험 밖으로) | - |
| `hotfix74h1.vitest.tsx` | E | ① D1 묶음만 시험 한도 15초 | 앱 전체를 가짜 6.1초+ 돌리는 CPU 일 - 부하 없이 0.8~1.2초, 15초 = 약 12배 |
| `hotfix74h2.vitest.tsx` | C | 시험마다 `linkSeq` 0 | - |
| `connection.vitest.tsx` | C | 도는 중 업로드를 시험 끝에 끝냄 | - |
| `src/vitestSetup.ts`(신규) | C · E | 시험마다 끝에 DOM · 타이머 · 전역 바꿔치기 · 감시 · 기기 저장 · 오류 기록 모듈 초기화 / 파일 처음에 Capacitor 웹 플러그인 7개 미리 읽기 | - |
| `vite.config.ts` | 워커 | 위 표 | 워커 9: 부하 없이 17개 22.1/22.8초 · 12개 23.8/24.2초 · 9개 25.3/25.7초 · 6개 29.6/30.5초 - 절반은 같은 PC의 다른 일과 겹쳐도 코어가 남음(약 3초 비용) |
| `web/scripts/stress-vitest.mjs`(신규) | 측정 | 부하 반복기(Node 기본만 · 기록은 `os.tmpdir()/ondolog-stress`) | - |

- 섞은 순서(`--sequence.shuffle`) 시드 9개(1186 · 4242 · 77 · 9001 · 31337 · 2024 · 555 · 8080 · 13) - 고친 뒤 마지막 확인 4개(555 · 31337 · 4242 · 9001) 모두 1181 통과.
- 앱 쪽 경쟁 상태(버그)로 보이는 것: 없음. 모두 시험 쪽 순서 · 정리 · 시계 의존.

### 20회 결과 · 시험 개수
| 바퀴 | 가장 긴 연속 | 실패 회차 |
|---|---|---|
| 고치기 전(기준) | 8 | 4 · 13회(`feedPhotoStage` 2/20) |
| 1 | 9 | 여러 회(위 표) |
| 2 | **18** | 19회(`hotfix74h1` 파일 연쇄) |
| 3 | **17** | 18회(`settingsFlow` 파일 연쇄) |
- 시험 개수: 전 Vitest 1181 + 1 건너뜀 · smoke 32 → 후 **같음**(새 skip · only · todo · retry 0 - `retry: 0` 명시만).

### 게이트 3회 (부하 없음 · gate 스크립트 무변경)
| 회 | web tsc | Vitest | 법무 | smoke | 합 |
|---|---|---|---|---|---|
| 1 | 8.1 | 29.3 | 4.7 | 98.1 | **140.1초** |
| 2 | 7.9 | 27.6 | 4.3 | 86.6 | **126.4초** |
| 3 | 8.9 | 28.8 | 4.2 | 87.8 | **129.7초** |
- 목표 180초 안. 가장 큰 단계는 smoke(타입 검사 · 빌드 2벌 · Playwright 2엔진).

검증: `npm run gate` 3회 통과 · 루트 tsc 0 · jest **119/2060**(PGlite 포함) · Python **324 OK** · `build` · `build:trial`(앱 변경 0이라 cap sync 생략). 키 · 주소 · ref · id · 이메일 0 · 새 파일 이름 ASCII.

### 작은 결함 목록(R123-4)
- **게이트 시간 - 닫음**(3회 126~140초, 180초 안)
- **`feedPhotoStage` - 닫음**(원인 C 확인 · 고친 뒤 부하 60회 중 이 파일 실패 1회는 B(찾기 1초) - 그것도 고침, 2 · 3바퀴 0)
- 번들 나누기 - 범위 밖(그대로)
- **새로 남김**: 부하 몰림 때 앱 전체 흐름 시험 한도 초과 → 같은 파일 연쇄(위 "멈춘 것" PM 판단 3갈래)
- (86-b · R129-4) 한도를 넘은 시험이 같은 파일 뒤 시험까지 무너뜨림(실패 1회가 9~11건으로 보임) — 86-에서 범위 밖

## `85-` 우리의 하늘 2단계 - 둘러보기 + 별 반짝임 토글 (메인 세션, 2026-11-18, 위임문 `phase-7/85-dispatch-sky-stage2.md` · ROADMAP r127 R127-1~5 · MASTER r77 9-8-4 · 보드 `N-R17-Our-Sky-2` patch9b) - 완료 (미커밋)

> 이 컴퓨터(Windows)의 Playwright WebKit ≠ iOS Safari · WKWebView — 실기기 대체 아님

### 0. 디자인 반입 정리 (Proteur 허가 · 커밋 0)
압축의 맨 위 `docs/`가 `docs/` 안에 풀려 `docs/docs/`가 됐던 것을 한 단계 걷어 냄.
- `git mv` 보드 `docs/docs/design/nocturne/N-R17-Our-Sky-2.dc.html` → `docs/design/nocturne/N-R17-Our-Sky-2.dc.html`(canvas 아님 - 글꼴 경로 `../../../assets/fonts/` 기준)
- `git mv` 그림 24장 → `docs/design/nocturne/screens/`(새 `C01.jpg`가 옛 그림을 덮음 - R127-6)
- `git rm` `screens_index_patch9b_rows.csv` - 12줄 모두 `screens_index.csv`에 있음을 대조(빠진 줄 0). `CHANGES_patch9b.md` · `CURRENT_patch9b_rows.md`는 `docs/docs/` 안에 없었음(저장소에 커밋된 적 없음 - 지울 것 0)
- 빈 `docs/docs/` 지움
- 정적 확인: 보드의 상대 경로 - `@font-face` 5개 모두 가리키는 파일 1개 이상 있음(otf/ttf) · `sky_world.jpg` 후보 4개 중 `assets/sky_world.jpg` 있음 · 보드 안 `screens/` 그림 참조 0 / 색인 patch9b 12줄의 그림 12장 모두 있음

### 1. 보드 대조 (patch9b 화면 · 모션표 → 지금 앱과 다른 곳)
| 보드 | 지금 앱(77-) | 85- |
|---|---|---|
| C01 [둘러보기] 칩(✕ 왼쪽 · 높이 40 · 8pt) | 없음 | 만듦 · **380pt 미만 = 40pt 원 아이콘 · 읽기 이름 "하늘 둘러보기"(정정 적용 R127-2)** |
| C01 안내 "위로 끌면 지난 하늘 · 놓으면 오늘로" | "위로 끌면 지난 하늘" | 앱 문구 유지(**정정 적용 R127-3**) |
| C09 iOS 권한 앞 화면 | 없음 | 코드만(iOS일 때만 - 플랫폼으로 가름) · 실행 확인 Mac 뒤 |
| C10 처음 한 번(센서 · 끌기 두 문구) | 없음 | 만듦 · 봤음 = 기기에만 |
| C08 센서 · C08 화면 밖 칩 · C08-alt 끌기 | 없음 | 만듦 · 층 분리(사진 고정 · 하늘 층 회전 · 방위 층 가로) |
| H01 OUR SKY "별 반짝임 · 배경 별이 천천히 숨 쉬어요" | 묶음 없음 | 만듦 · 보조 문구 **"하늘의 별이 천천히 숨 쉬어요"(정정 적용 R127-2)** · 끄면 배경 + 데이트 별 모두 멈춤 |
| H01 줄인 모션 비활성 + 문구 | 없음 | 만듦 |
| C01 반짝임 끔(표시 없음) | 반짝임 늘 켬(줄인 모션만 멈춤) | 만듦 |
| C01 유성 · C03 떨어진 말 · "유성 떨어뜨리기" 줄 | - | **제외**(후보 풀 뒤 - R124-9) |

모션표 12줄: 배경 별 숨(1단계 값 그대로 .35↔.75 · 18개 ≤ 20) · 데이트 별 반짝임(1단계 그대로) · 층 분리 · 들어가기 페이드 240ms(줄인 150ms) · 나가기 180ms(줄인 120ms, 리스너는 나가기 시작 때 해제) · 센서 α 0.2 · 30Hz 솎음 · rAF · 끌기 즉시 + 관성 600ms cubic-bezier(.2,.8,.2,1)(줄인 모션 관성 0) · C10 닫힘 240ms · 끌기 힌트 300ms · "이번 달 별 ›" 200ms · 누르면 600ms 회전 · 유성 3줄은 제외.

### 고친 곳
- `web/src/features/sky/tourMath.ts`(신규, 순수) · `useSkyOrientation.ts`(신규, 센서 - `deviceorientation`만, 새 패키지 0) · `SkyTour.tsx`(신규, C08 · C08-alt · C10 · 칩 · 방위 층) · `skyPrefs.ts`(신규, 기기 설정)
- `SkyScreen.tsx`: 칩 · C09 시트 · 들어가기 / 나가기 · ✕ · 뒤로 = C01 · 반짝임 끔 클래스
- `features/settings/SettingsView.tsx`: OUR SKY 묶음(COUPLE 다음)
- `cache/deviceCache.ts` · `cacheShapes.ts`: 새 범주 `skypref`(81- 모양 버전 · 읽을 때 검사) · **`clearCoupleCache` 접두사 결함 수정**(아래)
- `styles.css`: 85- 블록(칩 380pt 경계 · 둘러보기 · 방위 · C10 · C09 · 반짝임 끔 · OUR SKY)

### 결정 기록 (출처 R127-1~5 · MASTER 9-8-4)
1. **C09는 iOS 플랫폼에서만**(`Capacitor.getPlatform() === 'ios'` + `requestPermission` 있음). 스모크에서 Playwright Chromium(Pixel 7)도 `DeviceOrientationEvent.requestPermission`을 갖고 있어 함수만으로 가르면 Android에 C09가 뜸 - MASTER "Android는 이 화면 없음"에 맞춤.
2. 센서가 1.2초 안에 값을 한 번도 안 주면 센서 없음 → 끌기(C08-alt). 데스크톱 · 센서 없는 기기.
3. 화면 가로 = 방위 130°(보드 C08 방위 글자 간격에서 셈) · 정면(북 · 높이 0)에서 C01 배치 그대로 · 위아래 −10°~90°. 하늘 층 별은 이번 달 것만(C08 머리 "{M}월의 하늘"), 달 = 이번 달 달.
4. 화면 밖 칩: 가로로 벗어나면 좌우(왼쪽은 "‹ 이번 달 별"), 가로는 안인데 위아래로 벗어나면 위 · 아래. 별 0개면 달을 가리킴.
5. C10 끌기 모드 아랫줄: 보드는 "같은 틀, 문구 '손가락으로 하늘을 끌어 보세요'"만 줌 → 센서판 둘째 줄 "별을 누르면 그날 기록을 볼 수 있어요."만 둠(새 문장 0).
6. 반짝임 토글 범위 = **하늘 화면(C01 · C02 · C08)**의 배경 별 + 데이트 별. 메인 화면 배경 별은 그대로(OUR SKY 설정 · 보드 C01만 보임) - 넓히려면 PM.
7. 기기 저장 `skypref`(반짝임 · 안내 봤음 · 끌기 힌트 봤음 · iOS 거부): 사용자 키 → 로그아웃 · 탈퇴 요청 · 계정 전환 때 지움(사람 설정), 해제 완료 때 남김(커플 자료 아님). 센서 값은 저장 0.
8. **결함 수정**: `clearCoupleCache`가 키 접두사로 범주를 골라 `sky`가 `skypref` 키까지 지웠음(새 범주를 넣다 시험에서 발견). 범주 이름이 정확히 같을 때(뒤가 끝 또는 `:`)만 지우게 고침 - 기존 범주 동작 그대로.
9. 칩은 C01(이번 달 보기)에서만 - 빈 하늘(C06) · 별 시트 · 지난 하늘(C02)에서는 없음. 둘러보기 중 D+ · "위로 끌면" 안내는 숨김(보드 C08 ③).
10. 실행한 원격 질의: 없음.

### 시험
- `features/sky/skyTour85.vitest.tsx` 32건: 순수 계산 9 · 센서(보일 때만 리스너 붙임/해제 횟수 · 30Hz · α 0.2 · 1.2초 센서 없음 · **런타임 저장소 · 네트워크 0** · **정적 단언**) · C01 칩(읽기 이름 · ✕ 왼쪽 · 빈/시트/지난 하늘 0 · CSS 380pt) · C08-alt(C10 끌기 문구 · 봤음 기기에만 · 첫 끌기에 힌트 사라짐 · **사진 층 그대로 · 별 층만 이동** · 줄인 모션 관성 0) · C08(방위 정면 글자 · 화면 밖 칩 → 600ms 회전 · C10 20° 닫힘 · 센서 없음 → 끌기 · 별 → C04 · ✕ → C01 · 나가기 시작 때 리스너 해제) · C09(허용 · 거부 기록 → 다음엔 바로 끌기 · 손가락 · Android는 C09 0) · 반짝임(끔 → noTwinkle · 기기 저장 규칙)
- `features/settings/settings.vitest.tsx` +3: OUR SKY 순서 · 문구 · 기본 켬 · 유성 줄 0 / 끄면 기기에만(서버 쓰기 0) / 줄인 모션 → 비활성 + 문구 · 값 보존
- `cache/cacheShape81.vitest.tsx` +4 범주(skypref 네 scope - 81- 규칙)
- 스모크 +2(× WebKit · Chromium): C01 칩 **390 = 글자 칩 · 360 = 40pt 원** · ✕와 세로 중심 같음 · C08-alt 끌기(Playwright 센서 없음 → 끌기) · ✕ → C01 / H01 OUR SKY 줄

검증: **`npm run gate` 통과 122.2초**(Vitest 69 파일 1181 + 1 건너뜀 · 법무 8/8 · smoke **32/32**) · 루트 tsc 0 · jest **119/2060** · PGlite(jest 안) · Python 324 OK · `build` · `build:trial` · `cap sync android`(맨 끝 한 번 · `web/android` 변경 0). 게이트는 이 세션에서 5번 돌렸고 앞 4번은 회마다 **다른 한 곳**이 시간 초과(피드 사진 · 채팅 · 메인 · 매거진 · 설정 탈퇴 입력 · 피드 파일 고르기 - 85-와 무관한 곳, 단독으로는 모두 통과) - 마지막 1회 전부 통과. 게이트 시간 · 흔들림은 R123-4 작은 결함 목록과 같은 항목. 키 · 주소 · ref · id · 이메일 0 · 새 파일 이름 ASCII.

### Mac 뒤 목록에 한 줄
- C09 iOS 움직임 권한: [움직임 사용하기] → OS 권한 창 · 허용 → C08 센서 · 거부 → C08-alt + 다음엔 C09 없이 · `webkitCompassHeading` 방위.

### 폰에서만 확인되는 것 (짧은 폰 확인 1회 - R127-5)
녹화 규칙: 카카오 · 로그인 장면 0 · 끝나면 모든 녹화 파일 삭제.
1. 하늘(C01): 360dp대 폰이면 [둘러보기]가 **원 아이콘**으로 ✕ 왼쪽에 보임
2. 처음 누르면 C10 "폰을 하늘 쪽으로 들어 보세요" → 폰을 20° 넘게 돌리면(또는 [알겠어요]) 닫힘 → 다시 들어가면 안 나옴
3. 폰을 좌우 · 위아래로 돌리면 **별 · 달 · 라벨 · 방위 글자가 따라 돌고, 은하수 사진은 그대로**인지
4. 이번 달 별이 안 보이게 돌리면 가장자리 "이번 달 별 ›" → 누르면 그쪽으로 돌아옴
5. 별 누르면 그날 시트 · ✕는 C01로(메인 아님)
6. **V40 끊김**: 둘러보기 + 반짝임 켬에서 끊김이 보이는지(보드 기준 55fps)
7. 설정 → OUR SKY "별 반짝임" 끔 → 하늘의 별(배경 · 데이트) 반짝임이 멈춤 · 켜면 다시

## `84-a` 매거진 AI 안전장치 (메인 세션, 2026-11-18, 위임문 `phase-7/84-a-dispatch-llm-safety.md` · 함께 `84-status-check-for-pm.md` · ROADMAP r124 R124-2~6 · R21-1) - 완료 (미커밋 · db push 전)

> 이 컴퓨터(Windows)의 Playwright WebKit ≠ iOS Safari · WKWebView — 실기기 대체 아님

LLM 호출 0(하네스는 인자 검사 단계까지만) · 원격 0 · `demo_responses` 0 · 새 패키지 0 · `web/` 0 · 마이그레이션 1개(`84-a-m1` = `supabase/migrations/20261118120000_m1_llm_provider.sql`).

### 고친 곳
| 항목 | 위치 | 내용 |
|---|---|---|
| 상수 · 순수 계산 | `src/engine/corners/llmSafety.ts`(신규) | 허용 모델 2개 · 거부 코드(1 값 없음 · 2 tbd · 3 모르는 모델 · 4 형식 오류 · 5 모르는 공급자) · temperature 0.5 · 120초 / 8분 / 20분 · 가격표 · `CostMeter` · `callBudgetMs` |
| 값 검사 | `src/engine/corners/valueChecks.ts`(신규) | AI 문장 칸만 길이 상한 · 금지 표현(아래 표) |
| llmClient | `supabase/functions/_shared/llmClient.ts` | 본문에 `temperature` · 호출별 중단 신호(넘으면 전송 실패 → 기존 재시도) · `beforeAttempt`(막히면 요청 0 · 예산 그대로 · `stop`) · `onResponse`(상태 · 사용량 · stop_reason · 지연) · 시계/타이머 주입 |
| 골격 | `cornerPipeline.ts` | `valueRules`를 Zod 직후 검사(`schema_invalid`) · `stop`이면 `halted`(`CornerSafetyLimitHalt`) |
| 코너 3개 | `corners/dateArchive.ts` · `sweetWords.ts` · `thisMonth.ts` | `responseSpec`에 `valueRules` 한 줄씩(프롬프트 · 스키마 무변경) |
| 설정 읽기 | `coeffLookup.ts` `lookupLlmProviderValue` | 규칙 D · MASTER H Q15 - app_config 읽기는 여기만 |
| 생성 경로 | `scripts/ops/generateIssue.ts` · `generateIssueCli.ts` · `opsStore.ts` · `supabaseOps.ts` · `opsMemoryStore.ts` | `--mode live`(없으면 샘플) · 가드(시험 커플 · P0) 먼저 · fail-closed는 **호 행 만들기 전** · 코너 8분 · 1호 20분 · 1호 $2 · `corners.llm_usage`(숫자 · 코드만) · 경보 `usage_over`(stage = 정지 코드) |
| 하네스 | `scripts/ops/m1QualityRun.ts` | `--model` 허용 목록(키 읽기 전에 멈춤) · 실행 전체 $10 · 코너 8분 · R19-2 위반 칸 · 실행별 · 합계 비용(소수 넷째) · review.md R124-6 판정 칸 |
| 마이그레이션 | `20261118120000_m1_llm_provider.sql` | `app_config.llm_provider` = `{"provider":"anthropic","model":"claude-sonnet-5-5"}`만. `corners.llm_usage`는 이미 있음(`022_publish_path.sql:39`) - 추가 0 |
| CLAUDE.md | 환경 · LLM 한 줄 | Proteur 1회 허가로 정정(Sonnet 5.5 기본 · Opus 5.5 비교 · 채팅 태깅 코드 0) |

### 결정 기록 (출처 R124-2~6 · R21-1)
1. 위임서 편집 범위의 `src/engine/(llmClient · cornerPipeline · 코너)`는 실제로 `supabase/functions/_shared/`에 있다 - 그 파일을 고쳤다. 새 순수 모듈 둘만 `src/engine/corners/`.
2. 코너 8분 · 비용 정지는 "실패"가 아니라 **안전 정지**(`halted` · 코너 pending · 경보 `usage_over`)로 했다 - 기존 입력 토큰 정지(R20-2)와 같은 층, 실패 사유 4값을 늘리지 않음. 1호 20분은 남은 코너를 시작하지 않고 같은 경보.
3. 비용 "이번 호출 최악" = 입력 추정 **상한**(`estimateRequestTokens(…, 'high')`) × max(입력, 캐시 쓰기) 단가 + 출력 4096 × 출력 단가. 같으면 허용.
4. 하네스 비용 상한은 **명령 1회(`run`)** 단위 $10 - Sonnet · Opus를 따로 돌리면 각자 $10. 84- 전체 $30은 PE가 `summary.md` 합계로 본다(코드 0).
5. 하네스는 1호 20분을 두지 않았다(코너 회차마다 8분 · 호출 120초) - 위임서 표의 1호 상한은 생성 경로 것.
6. `operatorPath.test.ts`의 옛 단언(생성 모듈에 모델 설정 읽기 0)은 **"fetch · 엔드포인트 · 키 · 실제 클라이언트 만들기는 여전히 0 / 모델 설정은 저장소(`llmProviderConfig`)로만, `app_config` 직접 읽기 0"**으로 바꿨다. 동작 시험은 `liveMode84a.test.ts`.
7. 값 검사 대상은 LLM 출력의 AI 칸뿐(유저 원문 · 고정 문구 제외). 말투 검사는 84-c.
8. 84-0 보고 정정: "문자열 최대 길이 없음"은 틀렸다 - 제목 20 · 헤드라인 16은 이미 `stringMaxCodePoints`로 있었다(`dateArchive.ts:73` · `thisMonth.ts:81` · `:101`). 이번 표는 그 둘에 나머지 AI 칸을 더한 것.
9. CLI 실제 모드 인수는 `--mode live`(기존 인자 해석기가 값 쌍만 받음 - `opsCli.ts:16-26`).
10. 실행한 원격 질의: 없음.

### 길이 상한 (코드포인트)
| 코너 · 칸 | 상한 | 근거 |
|---|---|---|
| 데이트 `articles[].title` | 20 | MASTER §9-7-2(확정) |
| 데이트 `stopCaptions[].caption` | 50 | AI 캡션은 메모 자리에 대신 그려짐(README §3-1) · 그 칸 높이표 = 메모 50자 기준(README §5 · §12, `compose.py:51`) |
| 데이트 `tailoredQuestion.text` | 60 | **임시**(문서 근거 없음 - 84-b 뒤 PM 확정) |
| 데이트 `tailoredQuestion.basis` | 100 | **임시** |
| 다정한 말들 `main[].context` | 70 | 인용 한 줄 35자(README §12 457줄) × 2줄 |
| 이달의 우리 `theme.headline` | 16 | MASTER §9-7-2(확정) |
| 이달의 우리 `theme.lead` | 126 | 본문 한 줄 38~42자(CORNER_LAYOUT 47줄) × 리드 3줄(같은 문서 161줄) |
| 이달의 우리 `theme.signals[].value` | 20 | 숫자 칸 라벨은 렌더가 다시 만듦(`compose.py:654-667`) - 제목과 같게 |
| 이달의 우리 `articles[].title` | 20 | MASTER §9-7-2(확정) |
| 이달의 우리 `articles[].body` | 240 | **임시** |
| 이달의 우리 `closing` | 42 | 마무리 한 줄 = 한 줄 42자(CORNER_LAYOUT 47줄) |

### 금지 표현 (값 안 · 부분 문자열)
| 표현 | 근거 |
|---|---|
| 불안형 · 회피형 · 혼란형 | MASTER §10-5-3 2992줄 "애착 유형명(불안형·회피형·혼란형)을 그대로 쓰면 … 이름은 전부 재프레이밍" |
| 잘잘못 · 편들기 · 진단 · 훈수 | MASTER §3-7 418~420줄 금지 칸 |
| 판정 · 평가 · 점수 · 등급 · 순위 | MASTER §17-0-4 금지 키 표의 한국어 항목(`forbiddenKeys.ts:35-36`) - 원칙 ① "AI가 판정하지 않는다"를 값에도 |

### 시험
- `__tests__/engine/corners/llmSafety84a.test.ts` · `supabase/functions/_shared/safety84a.test.ts`(합 37): 허용 두 모델 · tbd · 빈 값 · 모르는 id · 형식 오류 · 하네스 인자 · 가격(캐시 포함) · 상한 직전 허용/넘으면 거부 · 마감 직전/순간/직후 · temperature 0.5 본문 · 120초 중단 → 재시도 · 판정 시간 · 막히면 fetch 0 · 사용량 알림 · 길이 경계 · 금지 표현 → 재요청 1 → 실패 · 정상 통과 · 정지는 halted
- `scripts/ops/liveMode84a.test.ts`(14): 인수 없음 → 샘플 · 가드 밖 → 거부(호출 0 · 호 행 0) · fail-closed 4종 + 조회 오류 → 호 행 전에 거부 · 가드 안 → 실제 클라이언트(진짜 `createLlmClient` + 가짜 fetch) · 1호 $2 · 코너 8분 직전/넘음 · 1호 20분

### 84-b 실행 명령 (Proteur · 맨 위 폴더 · PowerShell 한 줄씩)
```
$s = Read-Host -AsSecureString "LLM 키"
$env:ONDOLOG_LLM_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)); Remove-Variable s
$env:ONDOLOG_LLM_API_KEY.StartsWith('sk-ant-')
```
→ `True`이면 계속(아니면 창을 닫고 처음부터).
```
deno run --no-lock --config supabase/functions/deno.json --allow-env=ONDOLOG_LLM_API_KEY --allow-net=api.anthropic.com --allow-read=. --allow-write=scripts/ops/out scripts/ops/m1QualityRun.ts run --model claude-sonnet-5-5 --runs 3 --tag 84b
deno run --no-lock --config supabase/functions/deno.json --allow-env=ONDOLOG_LLM_API_KEY --allow-net=api.anthropic.com --allow-read=. --allow-write=scripts/ops/out scripts/ops/m1QualityRun.ts run --model claude-opus-5-5 --runs 3 --tag 84b
deno run --no-lock --config supabase/functions/deno.json --allow-read=. --allow-write=scripts/ops/out scripts/ops/m1QualityRun.ts review
```
- 출력: `scripts/ops/out/runs/*.json` · `scripts/ops/out/review.md` · `scripts/ops/out/summary.md`(추적 안 함 · 키 지운 뒤 저장). PE에는 `summary.md` 숫자와 review 판정만(생성 문장 전문은 붙이지 않음).
- 끝나면 **창을 닫고** 새 창에서 `[bool]$env:ONDOLOG_LLM_API_KEY` → `False`.
- 하네스는 앱 설정(`app_config`)을 읽지 않는다 - 모델은 인자. db push와 무관하게 돈다.
- Deno 확인(84-0 확인 필요 6번): 이 PC Deno 2.9.7에서 인자 검사 단계까지 실행함 - 모델 인자 없음 → "멈춤 … 거부 코드 1 - 호출 0" · 모르는 모델 → 코드 3 · 허용 모델 + 키 권한 없음 → 키 읽기에서 멈춤(네트워크 0).

### db push 순서 (사람)
1. `supabase db push --dry-run` → 목록에 **`20261118120000_m1_llm_provider.sql` 한 파일만**인지 확인(다른 것이 보이면 멈추고 PE에).
2. `supabase db push`
3. 생성 경로 실제 모드(`--mode live`)는 이 뒤에만 모델을 찾는다(전에는 `tbd` → 거부 코드 2로 멈춤 - 정상).

검증: 루트 tsc 0 · jest **119/2060**(이전 기록 116/1994 · 새 시험 파일 3개 51건 + 바뀐 시험 1건) · PGlite **10/129** · deno check(`m1QualityRun.ts` · `generateIssueCli.ts` · `publishIssueCli.ts` · `push-send/index.ts`) 통과 · Python 324 OK · `npm run gate` 통과 112.5초(smoke 28/28 · `web/` 변경 0). 첫 게이트 1회는 Python과 동시 실행 중 `feedPhotoStage.vitest.tsx` "사진 행 저장이 실패하면 행 저장" 1건 실패(단독 3회 중 2회 통과 · web 변경 0 → 부하 때 흔들리는 시험으로 보임, 작은 결함 목록 후보). 키 · 주소 · ref · id · 이메일 · 생성 문장 0 · 새 파일 이름 ASCII.

- 2026-11-18, 메인 세션, `84-0` 조사 완료(읽기 전용 · 코드 변경 0 · LLM 호출 0 · 렌더 0 · 원격 0 · 커밋 0) - 결과는 대화 보고로만.

## `83-` 계정 전환 때 이전 주인 사진 폴더째 삭제 + 로그아웃 창 "보내는 중" 수 (메인 세션, 2026-11-18, 위임문 `phase-7/83-dispatch-photo-folder-purge.md` · 근거 `82-pm-report.md` §4-2 · R121-3 · R121-5 · R120-4 · 덧붙임 = 81-b 폰 확인 11번) - 완료 (미커밋)

> 이 컴퓨터(Windows)의 Playwright WebKit ≠ iOS Safari · WKWebView — 실기기 대체 아님

**1단계 판정 = 사용자별 폴더 아님**: 83- 이전 사진 복사본 = `chat-photo-queue/{clientId}.{ext}`(`web/src/photoQueue/webPhotoFs.ts` 옛 45줄 `copyIn`) - 사용자 구분 없는 한 폴더. → 위임서 표 둘째 줄(새 파일은 사용자 폴더 · 기존 파일 옮김).

수정:
- 새 사진 = `chat-photo-queue/{userId}/{clientId}.{ext}`(`webPhotoFs.ts` `copyInFor` · 허브 `enqueue`가 씀). 공통 `PhotoFs`(루트 `src/services/chatPhotoCore.ts`) 모양은 그대로.
- 기존 파일 옮기기(`photoQueueStore.ts` `legacyPhotoMover` · `queueStorage.ts` `migrate`): 지금 사용자 항목 중 옛 자리 것만 - 복사(읽어서 씀 · 생겼는지 확인) → 저장값 경로 갱신 → **그 뒤에** 원본 지움. 복사 실패 = 그 항목 옛 경로 그대로(원본으로 보냄 · 다음 읽기 때 다시). 저장값 못 씀 = 새 복사본만 지우고 전부 옛 경로. `held` 키(81- 보존 실패)는 옮기지 않음. 옮기기는 **읽기 잠금 안**에서 돌아 그동안 새 항목 저장이 덮지 않음. 남의 항목은 옮기지 않음.
- 계정 전환 정리(`cache/queueOwner.ts` `purgePhotoFolders` - 82- 항목 정리 뒤): 지금 사용자가 아닌 폴더 **폴더째** 삭제(저장값 깨져도). 지금 사용자 폴더는 손대지 않음. 옛 자리 파일(주인 모름)은 남은 사진 대기열 저장값 전부 + 지금 사용자 보존 칸(`deviceCache.ts` `readQueueOriginalsStrict`) 어디에도 이름이 없고 **전부 읽혔을 때만** 지움 - 하나라도 못 읽거나 깨지면 하나도 안 지움(결정 기록).
- 덧붙임(로그아웃 창): **원인 = 후보 ① 메모리의 보내는 중 항목을 세지 않음** + ③의 일부(창이 열릴 때 한 번만 셈). 근거: 채팅 보내기는 말풍선을 "보내는 중"으로 먼저 그리고(`useChatMessages.ts` `sendText` - `pending: true`) 첫 시도(`textQueueHub.attemptText`)가 **실패한 뒤에야** 큐에 넣으며(`enqueueAfterInitialFailure`) 기기 저장은 그다음 비동기(`textQueueHub.ts` `onQueueChange` → `queueStorage.saveQueue`). 창의 수(`unsentCount.ts` 옛 45~57줄)는 **기기 저장만** 창이 열릴 때 한 번 읽었다 → 첫 시도 진행 중 · 저장 전이면 0. 수정 전 코드로 재현 시험 3건 실패 확인(아래). 후보 ② 주인 판정은 해당 없음(`senderId` = 지금 사용자 - 같은 시험에서 저장된 뒤엔 1로 셈). 수정: 허브가 시도 중인 글을 들고(`textQueueHub.ts` `sending` · `unsent()` · `onSending`) · 사진 허브 `unsent()` · 새 `features/settings/unsentSource.ts` · 수 = 저장 + 메모리를 id로 합쳐 한 번씩(주인 = 지금 사용자 · 같은 커플) · 창이 열려 있는 동안 바뀌면 다시 셈(`ProfileScreen.tsx`). 동작(R39-5 b) 그대로 · 문구 그대로.

시험: `web/src/photoFolder83.vitest.tsx` 14건(판정 · 새 사진 자리 · 정상/깨진 저장값 전환 · 저장값 없음 · 폴더 못 읽음 · 같은 계정 각 1번 · 옮긴 뒤 1번 · 옮기다 실패 → 원본 남음 → 이어서 · 저장값 못 씀 · 남의 항목 안 옮김 · 옛 자리 파일 3갈래) · `web/src/logoutUnsent83.vitest.tsx` 6건(요청 안 끝남 · 바로 연결 오류 + 저장 전 · 창 연 뒤 보냄 · 중복 0 · 남의 항목 0 · 확정되면 줄 사라짐). 앞 3건은 수정 전 코드에서 실패(창의 줄 `[]`).

검증: **`npm run gate` 통과 257.4초**(Vitest **68/1134** + 1 건너뜀 · 법무 통과 · `smoke:webkit` **28/28**) · 루트 tsc 0 · jest **116/1994**(PGlite 포함) · Python **324 OK** · `build` · `build:trial` · `cap sync android`(맨 끝 한 번 · `web/android` 변경 0). 마이그레이션 0 · 원격 0 · 새 패키지 0 · 네이티브 0 · `demo_responses` 0 · R34-3 0. 키 · 주소 · ref · id · 이메일 · 토큰 · 내용 0 · 새 파일 이름 ASCII.

결정 기록(출처 R121-3 · R120-4): ① 옮기기 = 복사 후 저장값 갱신 후 원본 삭제(어느 순간에도 저장값이 가리키는 파일 있음). ② 주인 모르는 옛 자리 파일 = 위 조건에서만 삭제, 아니면 남김(다음 로그인 때 다시 판정). ③ 폴더 정리는 매 로그인 때 돌지만 같은 계정이면 지울 폴더 0. ④ 위임서가 가리킨 `81-b-phone-check-pm-report.md`는 저장소에 없음 - 덧붙임 증상은 Proteur 메시지 문장 그대로 사용.

폰에서만 확인되는 것: 업데이트 덮어 설치 전 비행기 모드로 사진 1장 남김 → 설치 → 연결 → 상대에게 1번 도착(옛 자리 → 사용자 폴더 옮기기 실기기 파일 API) · A 사진 남김 → B 로그인 → (기기 파일 직접 볼 수 없음 - 동작으로만) B 화면 A 사진 0 · 비행기 모드 글 1 → 바로 로그아웃 창에 "1개" 줄.

## `82-` 계정 전환 대기열 규칙 + 채팅 진입 때 서랍 알림 지우기 (메인 세션, 2026-11-17, 위임문 `phase-7/82-dispatch-account-switch-queue.md` · 근거 `81-b-pm-report.md` §5 · R120-2 · R120-4 · R118-2 · R119-2 · R39-5 b) - 완료 (커밋됨 · build · cap sync 완료)

> 이 컴퓨터(Windows)의 Playwright WebKit ≠ iOS Safari · WKWebView — 실기기 대체 아님

범위: 새 `web/src/cache/queueOwner.ts` · `web/src/cache/queueStorage.ts` · `web/src/features/chat/textQueueHub.ts` · `web/src/photoQueue/photoQueueStore.ts` · `web/src/photoQueue/photoQueueHub.ts` · `web/src/app/useAccountData.ts` · `web/src/features/settings/unsentCount.ts` · `web/src/push/pushPort.ts` · `web/src/push/pushCore.ts` · `web/src/tabs/ChatTab.tsx` · 새 `web/src/accountSwitch82.vitest.tsx` · `web/src/offlineBoot81b.vitest.tsx`(문구 기대값) · `web/smoke/screens.smoke.ts`(문구 기대값) · HANDOFF · PROGRESS. **멈춤 0 · 마이그레이션 0 · 원격 접속 0(허용 질의 없음 - 실행한 원격 질의 0) · 함수 0 · 새 패키지 0 · 네이티브 0 · `consent.ts` 0 · RN 0 · `demo_responses` 0 · R34-3 호출 0 · 커밋 0 · db push 0.**

### 1단계 판정 - **경로 있음 → 실제 커플 조건(R120-4 ④)** · 이번에 고침
- 글 대기열 저장 키가 **사용자로 나뉘지 않는다**: `chat_queue:{coupleId}`(`src/utils/chatQueue.ts:152-154`). 허브는 (커플, 지금 사용자)로 붙어 그 키를 통째로 읽고(`textQueueHub.ts` 82- 전 36줄 · 93-96줄) 항목을 그대로 보낸다.
- 보낼 때 보낸 사람 = **항목에 저장된 `senderId`**(지금 세션 아님): `src/services/chatCore.ts:62-69`(`sender_id: input.senderId`).
- 그래서 A가 대기열을 남기고 로그아웃 → **같은 커플의 B**가 이 폰에 로그인하면 B 세션으로 A 이름의 글 삽입을 시도한다. 서버 RLS(`supabase/migrations/012_rls_policies.sql:146-148` `sender_id = auth.uid()`)가 거부(42501 → 영구 실패 → B 채팅에 실패 말풍선)하지만 **판정은 앱이 보내려 하는지로** = 경로 있음.
- 재현 시험: `accountSwitch82.vitest.tsx` "B 세션으로 붙은 허브가 A 항목을 보내려 하지 않는다" - **82- 수정 전 코드에서 실패(A 이름으로 1번 시도) 확인 후** 고침.
- 경로 없음: 사진 대기열(키 `chat_photo_queue:{커플}:{사용자}` - `src/utils/chatPhotoQueue.ts:45-47`, B는 B 키만 읽음) · 81- 보존 원본(`qkeep` - 사용자 키 · 보내지 않음 `queueStorage.ts` 머리 · 로그아웃 `clearAllDeviceCache` · 전환 `purgeOtherUsers`가 지움) · 다른 커플(키가 다름 - 보내지 않지만 **기기에 남았음**).
- `purgeOtherUsers`(`ondolog.dc1:` 키만)는 대기열(Preferences `chat_queue:` · `chat_photo_queue:`)을 건드리지 않았고, 로그아웃이 `dc1`을 이미 지우므로(`accountActions.ts` `resetAccountMemory`) 로그아웃 뒤 다른 계정 로그인에서는 전환 신호가 0이었다.

### 82- 결정 기록 (출처: R120-4 · R120-2 · R118-2 · R119-2 · R39-5 b)
- **① 주인 표시 = 이미 있는 칸**: 글 `senderId` · 사진 `userId`(새 칸 0 · `QUEUE_VERSION` 1 그대로 - 81- 저장 모양 변경 0). 사진 항목에 `userId`가 없으면 처음 읽을 때의 세션 주인으로 채움(81- `convertPhotoItem` 그대로) · 정리 때는 그 키의 사용자로 판정. 글 항목은 `senderId`가 없으면 81-부터 변환 불가(보존 원본 - 보내지 않음). 세션이 없으면 대기열을 읽지 않고(돌려주는 것 0 · 키 덮어쓰기 0) 다음 로그인 때 판정.
- **② 보내기 막음 두 겹**(서버 거부에 기대지 않음): (가) 읽기(`loadQueue` `ownerOf`)가 주인 = 지금 세션 사용자인 항목만 큐에 넣는다 (나) 허브 시도 직전 항목 주인 ≠ `useAuthStore` 사용자면 서버를 부르지 않는다(글 = 일시 실패 · 사진 = `retry` - 주인의 항목을 영구 실패로 바꾸지 않음 · 오류 기록 0).
- **③ 다른 계정 로그인 순간 지움**: `useAccountData`(로그인 확인 직후 · `purgeOtherUsers` 옆)에서 `startQueueOwnerPurge(userId)` - 이 기기의 모든 `chat_queue:*` · `chat_photo_queue:*`에서 주인 ≠ 지금 사용자 항목을 지우고 그 사진 파일도 지움. 비면 키 삭제. 읽을 수 없는 글자: 사진 키는 키 주인이 다르면 키 삭제(파일 경로는 모름 - 그 파일은 남을 수 있음) · 글 키는 주인을 몰라 그대로(보내지 않는 원본). 지운 건수는 반환값 숫자뿐(오류 기록 0 · 로그 줄 0). **로그아웃이 `dc1`을 지운 뒤에도 항목 주인으로 판정하므로 전환을 놓치지 않는다.** 대기열 읽기는 정리가 끝난 뒤(정리 · 저장이 겹쳐 새 항목을 잃지 않게 - 시험).
- **④ 같은 계정 재로그인**: 지울 것 0 → 글 · 사진 이어서 각 1번(R39-5 b 유지 - 시험).
- **⑤ 로그아웃 문구**: 대기열이 있을 때만 "다른 계정으로 로그인하면 이 폰에서 사라져요."를 대기열 줄 **바로 뒤** 별도 줄로(R119-2 순서: 대기열 → 전환 → 보존 원본). 대기열 수는 이 사용자가 주인인 항목만(같은 커플 글 키에 상대 항목이 있어도).
- **R120-2 채팅 진입 서랍 지우기**: `ChatTab`이 연결된 커플 id로 `clearCoupleMessageNoticesHere` - 플러그인 기존 기능 `getDeliveredNotifications` → `isCoupleMessageNotice`로 고른 것만 `removeDeliveredNotifications`. 판정 = 태그(Android) 또는 요청 식별자(iOS = `apns-collapse-id`)가 `ondolog-m-{커플}`이거나 `ondolog-m-{커플}-`로 시작(78- 묶음 이름 + 81-b `burstTag` 모두 · 서버 `pushTag` · `burstTag`를 시험에서 직접 가져와 대조). 변경 안내(`ondolog-c-…`) · 다른 커플 · 다른 앱 남김. 다리가 목록 · 골라 지우기를 못 하면 아무것도 안 함("모두 지우기" 대체 0). 미연결로 들어오면 0.
- 원격 질의: 이번 허용 질의 없음 - 실행한 원격 질의 0.

### 항목별
| 항목 | 고친 곳 | 시험 | 폰에서만 확인 |
|---|---|---|---|
| 1단계 경로(같은 커플 B가 A 글을 보냄) | `queueStorage.ts` `ownerOf` · `textQueueHub.ts` load · `attemptText` | `accountSwitch82` 판정 재현 · 보내기 막음 | 시험 계정 둘(같은 커플) - A 대기열 → 로그아웃 → B 로그인 → B 채팅에 A 글 · 실패 말풍선 0 |
| ② 보내기 막음 | `textQueueHub.ts` · `photoQueueHub.ts` `sessionUserId` | 보내기 막음(글 · 사진) | - |
| ③ 다른 계정 로그인 때 지움 | 새 `queueOwner.ts` · `useAccountData.ts` | B 로그인 정리 · 겹침 · 앱 경로(`useAccountData`) · 깨진 저장 · 막힌 저장소 | 사진 파일 삭제(실제 Filesystem) |
| ④ 같은 계정 재로그인 | (변경 0 - 지울 것 0) | A 재로그인 각 1번 | 기존 R39-5 b 녹화 그대로 |
| ① 표시 없는 항목 | (기존 `convertPhotoItem` + 정리의 키 주인) | 표시 없는 사진 → 지금 주인 → 정상 전송 / B 로그인 때 지움 | - |
| ⑤ 로그아웃 문구 | `unsentCount.ts` | 4갈래 · 주인 것만 셈 · `offlineBoot81b` 3건 기대값 · 스모크 `logout-unsent` | 로그아웃 [취소] 화면 두 줄 |
| R120-2 서랍 | `pushPort.ts` · `pushCore.ts` · `ChatTab.tsx` | 그 커플 것만 · 두 번 진입 · 서버 태그 대조 · iOS 모양 · 미지원 다리 · 채팅 탭 렌더 · 미연결 | 삼성: 알림 여럿 쌓인 채 채팅 탭 → 메시지 알림만 사라지고 변경 안내 남음 · iOS(Mac 뒤) |

검증: **`npm run gate` 통과 124.2초**(web tsc 8.5초 → Vitest **66/1114** + 1 건너뜀 25.8초 → 법무 8/8 5.6초 → `smoke:webkit` **28/28** 84.3초) · 루트 tsc 0 · jest **116/1994** · PGlite **10/129** · Python **324 OK** · `build` · `build:trial` · `cap sync android` 완료(2026-11-18, 81-b 녹화 끝난 뒤 · 82- 커밋 뒤 한 번). 키 · 주소 · ref · id · 이메일 · 토큰 · 내용 0 · 새 파일 이름 ASCII.

## `81-b` 알림 다시 울림 + 로그아웃 확인 문구 + 오프라인 첫 실행 (메인 세션, 2026-11-17, 위임문 `phase-7/81-b-dispatch-realert-logout-warning.md` + 보충 지시(R119-1~4) · 근거 `81-and-phone-check-3-pm-report.md` §B · R118-2~5 · R109-2 · R119-1~5) - 완료 (미커밋 · 함수 배포 전)

> 이 컴퓨터(Windows)의 Playwright WebKit ≠ iOS Safari · WKWebView — 실기기 대체 아님

범위: `supabase/functions/_shared/pushSend.ts` · `pushSend.test.ts` · `supabase/functions/push-send/index.ts` · `web/src/auth/useBootSession.ts` · 새 `web/src/auth/storedSession.ts` · `web/src/components/AccountProblem.tsx` · `web/src/components/ConfirmDialog.tsx` · `web/src/stores/coupleStore.ts` · `web/src/app/useAccountData.ts` · `web/src/features/chat/useChatMessages.ts` · `web/src/cache/deviceCache.ts` · `web/src/cache/cacheShapes.ts` · `web/src/features/settings/ProfileScreen.tsx` · 새 `web/src/features/settings/unsentCount.ts` · 새 `web/src/offlineBoot81b.vitest.tsx` · `web/smoke/fakeClient.ts` · `web/smoke/screens.smoke.ts` · HANDOFF · PROGRESS. **멈춤 0 · 마이그레이션 0 · 원격 접속 0(허용 질의 없음 - 실행한 원격 질의 0) · 새 패키지 0 · 네이티브 0 · `consent.ts` 0 · RN 0 · `demo_responses` 0 · R34-3 호출 0 · 커밋 0 · db push 0 · 함수 배포 0(사람).** `web/android/.idea/deploymentTargetSelector.xml`은 시작 때 바뀌어 있었으나(Android Studio) 건드리지 않았고, 끝날 때는 변경이 없었다.

검증: **`npm run gate` 통과 122.5초**(web tsc 8.2초 → Vitest **65/1096** + 1 건너뜀 23.6초 → 법무 8/8 5.2초 → `smoke:webkit` **28/28** 85.5초) · 루트 tsc 0 · jest **116/1994**(함수 시험 +7) · PGlite 10/129 · `deno check supabase/functions/push-send/index.ts` 통과 · Python 324 OK · `build` · `build:trial` · `cap sync android`(맨 끝 한 번). 키 · 주소 · ref · id · 이메일 · 토큰 · 내용 0 · 새 파일 이름 ASCII.

### 원인 판정 (보충 3 · 오프라인 첫 실행에서 "계정 정보를 불러오지 못했어요" → [다시 시도] → 시작 화면 · 온보딩 · 카카오 로그인)
| 후보 | 판정 | 근거 |
|---|---|---|
| ① 81-가 계정 쪽 저장값을 버림 | **아님** | 계정 판정(세션 · 진행 단계)은 기기 저장 범주에 원래 없다(②). 81-은 버전 없는 이전 값을 검사 통과 시 받아들인다 - `web/src/cache/deviceCache.ts` `judgeStored`(버전 없음 + 지금 버전 1 → 검사) · 시험 `cacheShape81` "버전 없는 81- 이전 값(지금 모양)은 받아들인다". 메인 요약은 `coupleStore`가 일곱 칸을 늘 다 써서 검사를 지난다 |
| ② 계정 정보가 원래 기기에 저장되지 않음 | **맞음(원인)** | 81-b 전 `useBootSession.ts`: 세션 확인 뒤 들어갈 화면을 **서버** `profiles.onboarding_step`로만 정했다(`fetchProfile` → `resolveWebRoute` → `enterAccount`). 기기에 "어느 계정 화면인가"가 없어 서버를 못 읽으면 계정 화면에 들어갈 수 없었다 |
| ③ [다시 시도]가 "세션 없음"으로 잘못 판정 | **맞음(원인, 두 갈래)** | (a) `AccountProblemHost`의 [다시 시도]가 **안내 화면을 먼저 걷었다**(81-b 전 `AccountProblem.tsx` `onRetry={() => { clear(); problem.retry() }}`). 부팅이 계정 화면에 들어간 적이 없어 그 아래는 첫 화면(intro)이었다 → 걷히는 순간 시작 화면 → 온보딩 → 로그인. (b) 접근 토큰이 만료된 채 오프라인이면 `auth.getSession()`이 갱신에 실패해 **세션 null + 오류**를 돌려주는데, 81-b 전 코드는 오류를 보지 않고 "저장된 로그인 없음"으로 조용히 첫 화면으로 보냈다(주석 "세션 자체를 못 읽었으면 저장된 로그인 없음으로 본다"). supabase-js는 이때 저장분을 지우지 않는다 - 세션은 살아 있었다(R119-3 관찰과 맞음) |
| (함께) 커플 상태 "미연결" 오판 | **맞음(같은 원칙 위반)** | 81-b 전 `coupleStore.refresh`: 처음 읽기가 오류로 끝나면 `disconnected`(미연결)로 둠 → 오프라인 + 저장값 없음이면 메인이 "상대만 있으면 돼요" 쪽으로 판정될 수 있었다 |
| 채팅 오프라인 회색 틀(76-A1 회귀 의심) | **76-A1 저장 자체는 정상 · 읽는 순서 결함 둘** | (1) `useChatMessages`가 기기 저장분을 **첫 그림 한 번만** 읽었다 - 그때 커플 id가 아직 없으면 빈 목록이 굳어 오프라인에서 서버 읽기도 실패 → 회색 틀/빈 채팅. (2) `coupleStore.hydrate`(저장 요약으로 커플 id 채움)가 `status === 'unknown'`일 때만 돌았는데, 화면(자식)의 첫 `refresh`가 먼저 `loading`으로 바꿔 **채우기가 건너뛰어졌다** → 오프라인에서는 커플 id가 끝내 null. 시험 `offlineBoot81b` "저장값 있음"이 이 순서 결함을 잡았다(처음 실행에서 메인이 자리 표시로 굳음). 언제부터인지(회귀 시점)는 판정하지 않음 - 76-A1 시험은 `hydrate`를 직접 불러 이 순서를 지나지 않았다 |

### 81-b 결정 기록 (출처: R118-2~5 · R109-2 · R119-1~5)
- **다시 울림 구현(R118-4)**: 같은 태그 갈아 끼우기는 삼성에서 소리 · 팝업이 없으므로(§B 관찰) **태그를 바꾸는 것**으로 울림을 보장한다. 알림 태그 = 묶음 이름(78- `pushTag`) + "공백 뒤 첫 알림 시각"(초, 36진수). 10분 **이하** 간격 연타 = 같은 시작 시각 = 같은 태그 → 조용히 갈아 끼움(R109-2 유지) · 10분을 **넘은** 공백 뒤 첫 알림 = 새 시작 시각 = 새 태그 → 새 알림(울림). 경계: 정확히 10분은 같은 태그(조용히), 10분 + 1ms부터 새 태그.
- **"직전 시각"의 출처**: 이미 있는 행 **`messages.sent_at`**. 메시지 알림의 받는 사람은 보낸 사람의 상대 하나뿐이라 묶음(받는 사람 · 커플 · 종류) = (커플, 보낸 사람)이고, 그 묶음의 직전 알림 = 보낸 사람의 직전 메시지다. 함수가 기존 함수 전용 키로 `messages`에서 `sent_at` 한 칸만 읽는다(couple_id · sender_id 조건 · sent_at 내림차순 · 최대 200 - 기존 색인 `idx_messages_thread`). 본문 · 다른 칸 0. **마이그레이션 0 · 트리거 · RPC 변경 0.** 200건 넘게 10분 안 간격으로 이어진 대화는 가장 오래 본 것을 시작으로 본다(그 지점에서 한 번 더 울릴 수 있음 - 받아들임). 지운 메시지 행도 그때 알림이 갔으므로 거르지 않는다.
- **시각을 못 읽으면**(조회 오류): 78- 묶음 이름 그대로 보낸다(조용히 갈아 끼움 - 발송은 막지 않음) · 로그에 `realert=err`만. 받는 사람이 없거나(설정 끔 등) 인증 실패면 시각을 읽지 않는다(시험).
- **변경 안내(날짜 · 닉네임)**: 직전 변경 시각을 기존 행에서 종류별로 얻을 수 없어 **매번 울림**으로 단순화(태그 = 묶음 이름 + 보낸 시각). 함수 시계는 주입(`nowMs`), 시험은 고정 시계. 메시지 묶음과 서로 영향 0(시험).
- **서랍에 몇 개**: 같은 연타 안에서는 하나(갈아 끼움). **공백 뒤에는 새 알림이 하나 더 생겨 서랍에 둘 이상이 될 수 있다**(이전 연타의 읽지 않은 알림 + 새 알림) - 태그를 바꿔야 울리므로. 변경 안내도 바뀔 때마다 하나씩. 로그아웃 · 계정 전환 때 서랍 지우기(76-i)는 태그와 무관(`removeAllDeliveredNotifications`)이라 그대로.
- **iOS 값**: `apns-collapse-id` = 알림 태그(연타 안에서 갈아 끼움 · 공백 뒤 새 알림), `thread-id` = 묶음 이름(서랍에서 한 줄기로 모임). Android `collapse_key`도 알림 태그와 같게(78- 시험 "collapse key = 태그" 그대로). **Mac 뒤 목록에 한 줄**: "iOS에서 같은 collapse id 갈아 끼우기가 울리는지 · 새 collapse id가 울리는지 · thread-id 묶음 표시".
- 로드맵 줄 확인: R118-4가 ROADMAP에 두 판(1481 "태그에 10분 구간" + "채팅 탭 진입 때 서랍 지움" / 1492 "직전 알림 뒤 10분")으로 있다. **위임서는 1492판(직전 알림 기준 · 서랍 지움 없음)** - 위임서대로 했다. "채팅 진입 때 메시지 알림 서랍 지움"은 위임서에 없어 하지 않았다(PM이 원하면 다음 위임).
- **로그아웃 확인 문구(R119-1 · R119-2 확정안 그대로, 동작 변경 0 - R39-5 b)**: 대기열 n개 → "아직 보내지 못한 메시지 {n}개가 있어요. 같은 계정으로 다시 로그인하면 이어서 보내요." · 81- 보존 원본 m개 → "보내지 못한 메시지 {m}개는 로그아웃하면 이 폰에서 사라져요." · 둘 다 0이면 지금 문장 그대로. n = 지금 커플의 글 대기열 + 사진 대기열(사진 메시지 · 이야기 모두 "메시지"로 셈 · 자동 재시도가 멈춘 것 포함) · m = 이 사용자의 보존 칸 원본(모든 커플 · 같은 원본 한 번). 읽기 전용(변환 · 보존 · 다시 쓰기 0).
- **"다른 계정으로 로그인하면 이 폰에서 사라져요." 줄은 넣지 않았다** - 계정 전환이 대기열을 지우는 코드가 없다. 근거: `web/src/cache/deviceCache.ts` `purgeOtherUsers`는 `removeWhere`로 `ondolog.dc1:` 접두 키만 지운다(대기열은 Preferences `chat_queue:{커플}` · `chat_photo_queue:{커플}:{사용자}` - 접두 밖) · `logoutToStart`(`accountActions.ts`)도 대기열을 건드리지 않음 · 시험 `settingsFlow.vitest.tsx` (303~311줄: 로그아웃 뒤 `chat_queue:c1` · `chat_photo_queue:c1:me` 그대로) · 시험 `offlineBoot81b` "[로그아웃] 확인 -> ... 대기열 키는 남김".
- **계정 전환 경로 판정: 로그아웃만이 길.** 로그인 화면(`auth` · `callback`)은 온보딩 구간에만 있고, 계정 구간에서 그리로 가는 길은 `nav.reset('intro')`뿐 - 부르는 곳: `logoutToStart`(로그아웃 · 탈퇴 유예 화면 ←) · `InviteScreen` · `StartDateScreen`(로그인이 없을 때만) · 온보딩 안 "처음으로". `enterAccount` 뒤에는 온보딩 화면 뒤로 가기가 앱 종료로 잠긴다(`navigation.tsx` `accountLocked`). 그러므로 "다른 계정으로 들어가는 길"도 로그아웃 확인 창을 거친다.
- **탈퇴 요청 · 해제 요청(확인만)**: 탈퇴 요청 = `clearAllDeviceCache`(`WithdrawScreen.tsx` 76줄) - 대기열은 남고 보존 원본은 지워짐. 해제 요청 · 완료 = `clearCoupleCache` - 대기열 · 보존 원본 모두 남음. 두 확인 창에는 이번에 문구를 더하지 않았다(범위 밖).
- **오프라인 첫 실행(R119-3) - 부팅 규칙**: ① 세션 확인이 "세션 null + 오류"이거나 기기가 오프라인이면, 저장소(Preferences, 클라이언트와 같은 키)의 세션 글자에서 **사용자 id만** 읽는다(`auth/storedSession.ts` - 토큰 값은 꺼내지도 남기지도 않음, 갱신 토큰 없는 저장분은 없음으로 봄). 있으면 계정으로 들어간다. ② 세션은 있는데 서버 읽기가 연결 때문에 실패 → 같은 길. ③ 들어갈 화면 = 서버가 마지막으로 정해 준 화면(새 기기 저장 `route:boot`, 81- 모양 검사 · 삭제 규칙 그대로 - 로그아웃 · 계정 전환 때 지워짐) → 없으면(81-b 첫 실행 · 버전 변경) **메인** · 메인이면 76-0-2 마지막 탭 복원 그대로. ④ 끊김 띠를 켠다(연결 상태 = 끊김). ⑤ 연결이 돌아오면(끊김 → 풀림) 서버로 다시 확인해 **다른 화면이어야 할 때만** 옮긴다(메인 ↔ 탭은 그대로 - 보던 탭을 빼앗지 않음) · 프로필 · 커플 · 해제 상태도 다시 읽는다. 연결 뒤 서버가 "세션 없음"이면 그때 첫 화면.
- **시작 화면 · 로그인은 저장된 로그인이 정말 없을 때만**: 오류 없는 "세션 없음"(연결됨) · 저장분 없음. 부팅 4초 시간 제한도 저장된 로그인이 있으면 첫 화면 대신 계정 화면(저장값)으로 - 저장분은 시작 때 한 번 미리 읽어 둔다. 시간 제한은 첫 확인이 끝난 뒤에는 아무것도 하지 않는다.
- **세션 없음 알림**: `onAuthStateChange`의 "세션 없음"은 `SIGNED_OUT`(로그아웃 · 갱신 토큰 무효)일 때만 받아들인다 - 시작 때 오프라인 갱신 실패로 오는 `INITIAL_SESSION`(null)이 저장된 로그인을 지우지 않게.
- **[다시 시도]는 다시 시도만**: 안내 화면을 먼저 걷지 않는다 · 성공하면 부른 쪽(부팅)이 걷는다 · 실패가 이어지면 그대로(시험: 누른 순간 · 실패 뒤에도 안내 화면 그대로, 그 아래 첫 화면 노출 0). 연결 실패면 안내 화면 대신 위 오프라인 길(안내 화면은 연결은 되는데 서버가 오류일 때만).
- **커플 상태**: 처음 읽기가 **연결 때문에** 실패하면 미연결로 두지 않고 자리 표시(`loading`)를 유지 · 연결이 돌아오면 다시 읽음. `hydrate`(저장 요약)는 `unknown`뿐 아니라 아직 아는 값이 없는 `loading`에서도 채운다. 연결은 되는데 서버 오류면 이전 규칙(RN과 같이 미연결) 그대로.
- **채팅**: 사용자 · 커플 id가 정해지거나 바뀌면 그 저장분을 다시 읽어 바로 그린다(자리 표시 0).
- **스모크 가짜 클라이언트**: 기기가 오프라인이라 하면(`navigator.onLine = false`) 모든 요청 · RPC가 연결 오류 값으로 끝나고, 세션 확인은 "갱신 실패(세션 null + 오류)" - 가장 나쁜 경우. 저장된 세션 키를 갖는다. 다른 스모크(온라인)는 그대로(28/28). Playwright의 `setOffline`은 스모크 서버(같은 컴퓨터)까지 끊어 첫 화면을 못 받으므로 기기 신호(`navigator.onLine`)로 오프라인을 만든다.
- 로드맵 근거 번호: 보충 지시 R119-1~4는 시작 때 내가 찾지 못했다가(검색이 막힘) 작업 중 `docs/ONDOLOG_ROADMAP.md` 1500~1504줄에서 확인 - 처음 구현한 로그아웃 문구(위임서 문장 "로그아웃하면 이 폰에서 사라져요")를 **R119-2 확정안으로 바꿨다**(시험 · 스모크도). R119-5(근거를 파일:줄 · 시험 이름과 함께)를 이 결정 기록에 따랐다.
- 원격 질의: 이번 허용 질의 없음 - 실행한 원격 질의 0.

### 계정 상태표 (R79 "빈 화면 0" 상태표 + 81-b 두 줄)
| 세션 | 연결 | 기기 저장값 | 가는 화면 | 시험 |
|---|---|---|---|---|
| 있음(확인됨) | 됨 | - | 서버 진행 단계 화면(74-h2 7조합 그대로) | `hotfix74h2` 상태표 |
| 있음 | 됨 · 서버 오류 | - | 안내 화면([다시 시도] · [로그아웃]) · [다시 시도]는 다시 시도만 | `hotfix74h2` · `offlineBoot81b` "[다시 시도]는 다시 시도만" |
| **있음(저장분 · 갱신 실패 포함)** | **끊김** | **있음** | **마지막 화면(메인)을 저장값으로 + 끊김 띠** · 온보딩 · 로그인 0 | `offlineBoot81b` "저장값 있음" |
| **있음(저장분 · 갱신 실패 포함)** | **끊김** | **없음(버전 변경 · 첫 실행)** | **메인 자리 표시 + 끊김 띠** · 미연결 판정 0 · 온보딩 · 로그인 0 | `offlineBoot81b` "저장값 비었음" · 스모크 "오프라인 첫 실행(81-b)" |
| 없음 | 상관없음 | - | 첫 화면 | `offlineBoot81b` "세션 정말 없음" |

### 시험
| 묶음 | 시험 | 결과 |
|---|---|---|
| 함수(가짜 FCM · `pushSend.test.ts` +7) | 10분 안 연타 3건 → 같은 태그 · collapse key · APNs collapse id 같음 · 다시 울림 표시 0 / 10분 1초 뒤 → 새 태그 · 그 뒤 10분 안은 그 태그 / 정확히 10분 = 같음 · 10분 + 1ms = 새 / 긴 대화 · 시각 순서 섞임 · 빈 목록 · 깨진 시각 / 메시지 ↔ 변경 안내 영향 0 · 변경 안내 매번 새 태그 / 시각 못 읽음 → 78- 태그 · 로그 `realert=err`만 / 태그 64바이트 안 · 받지 않는 요청에서 시각 읽기 0 | 18/18(78- 11건 그대로 통과 - 본문 규칙 · 원문 0 · 설정 끔 0 · 잘못된 토큰 정리 · 로그) |
| Vitest(`offlineBoot81b` 11) | 저장값 있음 / 비었음 / 세션 확인 뒤 오프라인 → 연결 돌아오면 다시 읽음 / [다시 시도] / 세션 정말 없음(온라인 · 오프라인) / 채팅 커플 id 늦게 와도 저장 대화 · 오프라인 읽기 실패에도 그대로 / 로그아웃 문구: 수 세기 · n=0 · n=1 · n=3(글 2 + 사진 1) + [취소] 대기열 그대로 · [로그아웃] 확인 → 기존 삭제 규칙(보존 원본 · 기기 저장 지움, 대기열 남김) | 11/11 · 기존 시험 전부 통과(74-h2 상태표 포함) |
| 스모크(WebKit · Chromium) | **로그아웃 확인(81-b)**: 대기열 글 2 + 사진 1 → "…3개가 있어요. 같은 계정으로 다시 로그인하면 이어서 보내요." · [취소] 뒤 대기열 그대로 / **오프라인 첫 실행(81-b)**: 저장된 로그인 + 기기 저장값 0 + 기기 오프라인 + 갱신 실패 → 메인 · 끊김 띠 · 안내 화면 0 · 시작 · 온보딩 · 로그인 화면 0 | 28/28(새 2 × 2 엔진) |

### 함수 배포 명령 (사람 · 맨 위 폴더에서)
```
npx supabase functions deploy push-send --no-verify-jwt
```
비밀 · Vault 값 변경 0(기존 그대로). 배포 뒤 확인(대시보드 함수 로그, 숫자만): 메시지 한 건 보낸 뒤 `push-send status=200 sent=1 dropped=0 failed=0` 한 줄 · `realert=err`가 붙으면 그 줄만 PE에(함수 키의 `messages` 읽기가 막혔다는 뜻 - 이때도 알림은 78-처럼 감).

### 커밋 명령 (맨 위 폴더에서)
```
git add supabase/functions/_shared/pushSend.ts supabase/functions/_shared/pushSend.test.ts supabase/functions/push-send/index.ts
git commit -m "81-b push re-alert: new tag after a 10-minute gap, change notices always alert"
git add web/src/auth/useBootSession.ts web/src/auth/storedSession.ts web/src/components/AccountProblem.tsx web/src/stores/coupleStore.ts web/src/app/useAccountData.ts web/src/features/chat/useChatMessages.ts web/src/cache/deviceCache.ts web/src/cache/cacheShapes.ts
git add web/src/components/ConfirmDialog.tsx web/src/features/settings/ProfileScreen.tsx web/src/features/settings/unsentCount.ts web/src/offlineBoot81b.vitest.tsx web/smoke/fakeClient.ts web/smoke/screens.smoke.ts
git add .claude/state/HANDOFF.md .claude/state/PROGRESS.md
git commit -m "81-b offline first run keeps the account, retry never drops to start, logout confirm counts unsent messages"
```
(위임서 · `81-and-phone-check-3-pm-report.md`는 이미 추적됨.)

### Proteur 다음 순서
1. 커밋(위 두 묶음).
2. **함수 배포**(위 명령 하나 · `--no-verify-jwt` 유지). db push 없음.
3. **빌드 · 덮어 설치 필요**(앱 코드 변경): `cap sync android`는 메인 세션이 맨 끝에 한 번 돌림 → Android Studio 빌드 → 두 폰에 **앱 삭제 없이** 덮어 설치.
4. 폰 확인(녹화 위생 R118-6: 두 폰 방해 금지 · 온도록만 예외 · 서랍 열기 전 다른 알림 지우기 · 폰 설정 첫 화면 지나지 않기 · 판독 뒤 삭제):
   - **업데이트 · 오프라인 첫 실행**: 설치 **전** 비행기 모드로 글 1 · 사진 1 남김 → 덮어 설치 → **비행기 모드 그대로 열기 → 메인 + 끊김 띠 · 시작 화면 · 로그인 0 · 채팅에 저장된 대화 보임 · 보내는 중 말풍선 그대로** → 비행기 모드 끄기 → 상대 폰에 글 · 사진 **각 1번씩** 도착.
   - **변경 안내 끔**: 설정 → 알림에서 변경 안내 끔 → 상대가 날짜를 바꿔도 알림 0 → 다시 켬.
   - **다시 울림 두 경우**(함수 배포 뒤): ① 받는 폰 서랍에 읽지 않은 온도록 알림을 둔 채 **10분 넘게** 기다린 뒤 상대가 메시지 → 소리 · 팝업(서랍에 둘이 될 수 있음 - 설계대로) ② 10분 안 연타 3건 → 하나로 · 조용히.
   - **로그아웃 문구**: 비행기 모드에서 글 하나 보내 두고 설정 → 프로필 → 로그아웃 → "아직 보내지 못한 메시지 1개가 있어요. 같은 계정으로 다시 로그인하면 이어서 보내요." 확인 → [취소].
5. Mac 뒤 목록에 한 줄: iOS 다시 울림(collapse id 갈아 끼우기 · 새 collapse id 울림 · thread-id 묶음).

## `81-` 기기 저장값 모양 검사(실제 커플 조건) + `ensureDate` 시험 한 건 (메인 세션, 2026-11-17, 위임문 `phase-7/81-dispatch-device-cache-shape.md` · 근거 `80-pm-report.md` §5 · R117-2 · R117-3 · R113-1(→ 실제 R113-2) · R116-4) - 완료 (미커밋)

> 이 컴퓨터(Windows)의 Playwright WebKit ≠ iOS Safari · WKWebView — 실기기 대체 아님

범위: `web/src/cache/`(새 3파일 `cacheShapes.ts` · `queueShapes.ts` · `queueStorage.ts` + `deviceCache.ts`) · `web/src/features/chat/textQueueHub.ts` · `web/src/photoQueue/photoQueueStore.ts` · `web/src/components/AccountProblem.tsx`(RenderGuard) · `web/src/app/useAccountData.ts`(시작 훑기) · `web/src/errorLog/errorLog.ts`(깨진 저장분 1건 · 화면 이름 읽기) · 시험(새 `web/src/cache/cacheShape81.vitest.tsx` + 기존 3파일 고정값) · `web/smoke/screens.smoke.ts` · `__tests__/services/dateRecordApi.test.ts`(한 건) · HANDOFF · PROGRESS. **멈춤 0 · 마이그레이션 0 · 원격 접속 0 · 새 패키지 0 · 함수 0 · 렌더 0 · 네이티브 0 · `consent.ts` 0 · RN 0 · `demo_responses` 0 · R34-3 호출 0 · 커밋 0 · db push 0 · package.json · app.json · eas.json · tsconfig 변경 0.** 루트 `src/utils`의 대기열 순수 규칙은 그대로(웹 저장소가 감쌈).

검증: **`npm run gate` 통과 153초**(web tsc 8.6초 → Vitest **64/1085** + 1 건너뜀 21.6초 → 법무 8/8 5.2초 → `smoke:webkit` **24/24** 117.6초) · 루트 tsc 0 · jest **116/1987**(+1) · PGlite 10/129 · Python 324 OK · `build` · `build:trial` · `cap sync android`(맨 끝 한 번). 빌드 결과물 스모크 표지 0. 키 · 주소 · ref · id · 이메일 · 토큰 · 내용 0 · 새 파일 이름 ASCII.

### 범주별 시험 (`web/src/cache/cacheShape81.vitest.tsx` 62건)
| 범주 | 올바른 값(버전 붙여 저장 · 그대로 읽음) | 81- 이전 버전 없는 값 | 깨짐(JSON 아님 · 칸 빠짐 · 타입 다름 · 버전 없는 깨진 값) | 옛 버전 · 모르는 새 버전 | 화면 · 서버 다시 채움 |
|---|---|---|---|---|---|
| main 요약 · library · facts · start | 통과 | 받아들임 · 기록 0 | 그 키만 지움 · 옆 범주 그대로 · `cache_fail` 1(다시 읽어도 1) | 같음 | 메인 요약 깨짐 -> 스토어 unknown(서버 읽기 대기) · 스모크 메인 정상 |
| 안내 표시(nickNotice · dateNotice) · push:asked | 통과 | 받아들임 | 같음 | 같음 | - |
| name | 통과 | 받아들임 | 같음 | 같음 | - |
| chat · chat:head | 통과 | 받아들임 | 같음 | 같음 | 깨짐 -> 빈 목록(서버 읽기가 채움) |
| feed · feed:trash | 통과 | 받아들임 | 같음 | 같음 | **80- 모양(`dates` 글자) -> 대체 화면 0 · 서버 카드 · 새 모양으로 다시 씀**(Vitest · 스모크 둘 다) |
| sky | 통과 | 받아들임 | 같음 | 같음 | 깨짐 -> 자리 표시로 시작 |
| route | 통과 | 받아들임 | 같음 | 같음 | - |
| 오류 건수 `err1` | - | - | 빈 값으로 다시 시작 · `cache_fail` 1 | - | - |
| **글 대기열** | 새 모양 `{__v:1,items}` | **옛 배열 -> 변환 · 다시 씀 · 정상 전송**(빠진 칸만: 횟수 0 · 대기 · 시각 · 커플) | **변환 불가 항목 -> 원본 보존 · 보내기에서 빠짐 · 나머지 정상 · 기록 1** / 전체 깨짐 · 모르는 버전 -> 원본 글자 보존 · 같은 원본 두 번 넣지 않음 | 보존 칸에 못 쓰면 원래 키를 덮어쓰지 않음 · 읽기 전 저장은 읽기 뒤로 | - |
| **사진 대기열** | 새 모양 | **옛 모양 -> 변환(확장자 · 형식 · 커플 · 사용자 · 시각 · 횟수 · 상태) · 정상 전송** | **변환 불가 -> 원본 보존 · 보내기에서 빠짐 · 사진 파일 남음(지운 것 0)** | 같음 | - |
| 시작 훑기 | 깨진 · 옛 버전 키 3개만 버림 · 올바른 값 · 보존 칸 · 모르는 scope · 다른 사람 키 그대로 · 두 번째 0 · 저장소 막혀도 던지지 않음 | | | | |
| [다시 시도] | 대체 화면 -> 한 번에 정상 · 지우기 대기열 · 보존 칸 · 대기열 · 안내 표시 남음 · 모르는 화면 0 | | | | |
| 삭제 규칙 | 로그아웃 · 탈퇴 요청 -> 보존 원본까지 지움 · 계정 전환 -> 다른 사람 보존 원본 지움(내 것 남음) · 해제 완료 -> 커플 자료 지우고 보존 원본은 대기열처럼 남김 · 기존 76-/78-/76-i/80- 삭제 시험 그대로 통과 | | | | |

기존 시험 고친 것(시험 쪽 고정값만): `dayDelete76d`(하늘 저장 고정값을 온전한 하루 기록으로) · `skyScreen`(`{x:1}` -> 빈 하늘 값) · `photoQueue`(저장 글자가 버전 감싸기). 제품 동작 기대는 그대로.

`ensureDate`(R113-2): `__tests__/services/dateRecordApi.test.ts` "지운 뒤 새 행" - 숨긴 하루 행(AI 칸 채워짐)이 정리로 없어진 뒤 같은 날 기록 -> 새 행(`createdDate` true · 다른 id) · title · narrative · region 비어 있음 · is_new_region false · 그 칸들을 쓰지 않음. 통과.

### 스모크
| 시험 | WebKit(iPhone 14 Pro) | Chromium(Pixel 7) |
|---|---|---|
| 기존 화면 11 | 11/11 | 11/11 |
| **깨진 기기 저장값(81-)**: 피드(80- 모양) + 메인 요약 · 서재 깨짐 -> 대체 화면 없이 바로 메인 · 피드 정상 · `log_app_error`는 `cache_fail`만 합계 3(키마다 1) · 보낸 값 내용 0 · 피드 저장분 새 모양으로 다시 채움 | 통과(7.3초) | 통과(11.8초) |
| 합계 | **24/24** · `smoke:webkit` 117.6초 · `npm run gate` 153초 | |

(80-의 "오류 경계" 스모크는 이 시험으로 바뀜 - 결정 기록 참조.)

### 커밋 명령 (맨 위 폴더에서)
```
git add web/src/cache/cacheShapes.ts web/src/cache/queueShapes.ts web/src/cache/queueStorage.ts web/src/cache/deviceCache.ts web/src/cache/cacheShape81.vitest.tsx
git add web/src/features/chat/textQueueHub.ts web/src/photoQueue/photoQueueStore.ts web/src/components/AccountProblem.tsx web/src/app/useAccountData.ts web/src/errorLog/errorLog.ts
git add web/src/features/feed/dayDelete76d.vitest.tsx web/src/features/sky/skyScreen.vitest.tsx web/src/photoQueue/photoQueue.vitest.tsx web/smoke/screens.smoke.ts
git add __tests__/services/dateRecordApi.test.ts
git add .claude/state/HANDOFF.md .claude/state/PROGRESS.md
git commit -m "81- device cache shape versions: per-category checks, queue conversion and preservation, RenderGuard retry clears cache"
```
(위임서 `81-dispatch-device-cache-shape.md` · `80-pm-report.md`는 이미 추적됨 - 따로 넣을 것 없음.)

### Proteur 다음 순서
1. 커밋(위 명령). db push 없음(마이그레이션 0).
2. 폰 덮어 설치: **필요**(앱 코드 변경). `npx cap sync android`는 메인 세션이 맨 끝에 한 번 돌림 -> Android Studio 빌드 -> 두 폰에 **앱 삭제 없이** 덮어 설치.
3. 폰에서만 확인되는 것: **업데이트 덮어 설치 뒤 기존 대화가 그대로 보이는지 · 보내지 못한 메시지(비행기 모드에서 보낸 글 · 사진)가 남아 있다가 연결 뒤 한 번만 가는지**. 순서: 설치 전에 비행기 모드로 글 1 · 사진 1 보내기(보내는 중으로 남김) -> 덮어 설치 -> 앱 열기(아직 비행기 모드) -> 대화 · 보내는 중 말풍선 그대로 -> 비행기 모드 끄기 -> 둘 다 한 번씩 감(상대 폰에서도 한 번).
4. 월요일 9번 질의에서 `cache_fail` 건수: 이번 업데이트 첫 실행은 0이 정상(81- 이전 값은 받아들임). 0이 아니면 숫자만 PE에.

### 81- 결정 기록 (출처: R117-2 · R117-3 · R113-1 · R116-4)
- **80- 4단계 닫힘(R116-4)**: 오류 기록 표(`app_error_daily`)는 처리방침 변경 0으로 닫혔다 - 사람 · 기기 · 내용을 알아볼 칸 0이라 개인정보 아님. **칸이 하나라도 늘면 멈추고 PM에게.** (이번 81-은 그 표 · RPC를 건드리지 않는다 - 칸 변경 0.)
- **업데이트 규칙(R117-2)**: 범주 모양을 바꾸면 버전을 올리고, 대기열은 변환 함수를 함께 둔다. (일반 범주 = `web/src/cache/cacheShapes.ts`의 `CACHE_VERSION` + 검사 · 대기열 = `web/src/cache/queueShapes.ts`의 `QUEUE_VERSION` + `convertTextItem` · `convertPhotoItem`.)
- **저장 모양**: 일반 범주(`ondolog.dc1:` 키) = `{"__v": 버전, "d": 값}` · 대기열(Preferences `chat_queue:` · `chat_photo_queue:`) = `{"__v": 1, "items": [...]}`. 지금 버전은 모두 1.
- **버전 없는 값(81- 이전 앱이 쓴 것)**: 일반 범주는 지금 버전이 1이고 검사를 지나면 **그대로 받는다**(`cache_fail` 0). 이유: 81- 직전 모양 = 지금 모양이라, 버리면 이번 업데이트 첫 실행에 모든 사용자의 화면이 오프라인에서 비고 `cache_fail`이 한꺼번에 튄다. 버전이 2가 되면 버전 없는 값도 옛 버전으로 버린다. 대기열의 버전 없는 배열은 옛 모양으로 보고 항목마다 변환해 새 모양으로 다시 쓴다.
- **읽을 때 검사**(손 검사, 새 패키지 0): 화면이 그 값으로 바로 그리는 칸의 타입까지(배열 원소 포함). 깨짐 · 칸 빠짐 · 타입 다름 · 옛 버전 · 모르는 새 버전 -> **그 키만** 지우고 null(읽는 곳은 원래대로 자리 표시 -> 서버 읽기 -> 새 모양으로 다시 씀). 선택 칸(피드 `region` · `title`, 채팅 `pending` 등)은 없어도 통과(없음 = null과 같이 그려짐).
- **`cache_fail` 1회**: 키마다 이 실행에서 1번(메모리 집합). 지운 뒤에는 다시 읽어도 값이 없으므로 다음 실행에도 반복 0. 대기열 키 · 오류 건수 저장분도 같은 규칙.
- **대기열은 버리지 않는다**: 변환 = 빠진 칸 중 **기본값(재시도 0 · 대기) · 저장 키에서 아는 값(커플 · 사용자) · 파일 이름에서 아는 값(확장자 · 형식) · 시각(없으면 읽은 때)**만 채운다. 본문 · 메시지 id · 보낸 사람 · 사진 종류 · 파일 경로처럼 지어낼 수 없는 칸이 없으면 **변환 불가** -> 원본 글자 그대로 보존 칸(`ondolog.dc1:{u}:qkeep:{text|photo}:{커플}`)에 넣고, 보내기에서만 빠진다. 사진 파일은 이 경로에서 지우지 않는다(지우는 곳은 기존 러너의 성공 · 취소 · 사라짐뿐). 같은 원본은 한 번만 넣는다.
- **보존 칸 자체는 버리지 않는다**: 시작 훑기 · [다시 시도] 대상에서 뺌. 보존 칸이 깨져 있으면 그 글자도 원본 한 건으로 함께 남긴다.
- **보존 칸에 쓰지 못하면**(저장 막힘 · 로그인 전 userId 없음) 이 실행 동안 원래 대기열 키를 **덮어쓰지 않는다** - 원본이 원래 자리에 남는다(이번 실행의 새 항목은 메모리 큐로는 전송된다 - 앱을 끄기 전에 못 보낸 새 항목은 다음 실행에 없을 수 있음: 저장이 막힌 기기의 기존 한계와 같음). Preferences 읽기 자체가 실패해도 같은 규칙.
- **읽기 전 저장 금지**: 대기열 저장은 같은 키의 읽기가 끝난 뒤에 쓴다(앱을 켜자마자 보낸 글이 아직 읽지 않은 원본을 덮어쓰던 틈을 막음 - 기존 틈, 이번에 함께 막음).
- **삭제 규칙**: 76- · 78- · 76-i · 80- 규칙 그대로(시험). 보존 칸은 `dc1:` 사용자 키라 로그아웃 · 탈퇴 요청(`clearAllDeviceCache`) · 계정 전환(`purgeOtherUsers`)에서 같이 지워진다. 해제(유예 · 완료)의 `clearCoupleCache`에는 넣지 않았다 - 기존 규칙상 대기열 자체가 해제로 지워지지 않으므로(R39-5 b) 그 원본도 대기열처럼 남긴다. 계정 전환 신호(`purgeOtherUsers` > 0)는 다른 사람의 보존 칸이 있을 때도 1 이상 - 뜻이 같다(다른 사람 것이 있었음).
- **보내지 못한 메시지 · 사진 자체는 어떤 경로에서도 지우지 않는다**(Proteur 지시). 위 삭제 규칙이 지우는 것은 "변환하지 못해 이미 보내기에서 빠진 원본 글자"뿐이고, 위임서 1단계 · 2단계가 로그아웃 · 계정 전환 때 지우라고 정한 것이다. 다르게 하려면 PM 판단.
- **[다시 시도](RenderGuard)**: 지금 화면 이름(80- 오류 기록의 그리기 중 화면 이름)으로 그 화면의 일반 범주를 비운 뒤 다시 그린다. 화면 -> 범주: main(main · name) · chat(chat · name) · feed(feed · name) · date-detail(feed · sky) · sky(sky · name) · magazine(main) · push-permission · nickname-recheck · start-date-recheck(name). 비우지 않음: 대기열 · 보존 칸 · `feed:trash`(지우기 대기열) · 안내 표시(nickNotice · dateNotice · asked). 모르는 화면이면 아무것도 지우지 않고 다시 그림.
- **앱 시작 훑기**: `useAccountData`에서 계정 전환 정리(`purgeOtherUsers`) 바로 뒤 `sweepDeviceCache(userId)` - 이 사용자의 키를 훑어 깨진 · 옛 버전을 버림. 모르는 scope · 보존 칸 · 다른 사람 키는 건드리지 않음. 던지지 않음(시험: 저장소 막힘).
- **오류 건수 저장분(`ondolog.err1`)**: 원래 버전(`v:1`) + 칸 정리가 있었다. 81-: 버전이 다르거나 깨졌으면 빈 값으로 다시 시작하고 `cache_fail` 1건을 센다(이 실행에서 1번 - 이후는 메모리).
- **버전 칸을 붙이지 않은 범주(예외)**: 기기 id `ondolog.push.device` · 푸시 등록 표시 `ondolog.push.registered` · 호 열어 봄 `ondolog.issueOpened.*` - 날 글자 하나(JSON 아님)이고 지금 검사(8자 이상 · `=== '1'` · 값 있음)로 깨져도 그리기가 깨지지 않는다. 기기 id 저장 모양을 바꾸면 모든 폰이 새 id로 다시 등록되므로 손대지 않았다. 로그인 세션(supabase-js 소관)도 범위 밖.
- **스모크 "오류 경계(80-)" 시험을 "깨진 기기 저장값(81-)"으로 바꿈**: 80-에서 대체 화면을 일부러 내던 깨진 피드 저장값이 이제는 검사에서 버려져 화면이 바로 정상이므로, 같은 값 + 메인 깨진 값 둘로 "대체 화면 0 · `cache_fail`만 · 내용 0 · 새 모양으로 다시 채움"을 본다. RenderGuard 대체 화면 · `render_crash` 기록 · [다시 시도]는 Vitest(`cacheShape81` · `errorLog`)가 맡는다(앱에 시험 모드를 넣지 않는 80- 원칙 그대로).
- **근거 번호**: 위임서는 `ensureDate` 시험 근거를 R113-1로 적었으나 ROADMAP상 그 한 건을 정한 줄은 **R113-2**("`ensureDate` 가짜 저장소 시험 '지운 뒤 새 행' 한 건은 그 폴더를 여는 다음 위임에서")다. 시험 이름에 R113-2로 적었다. R117-3도 R113-2를 가리킨다.
- **원격 질의**: 이번 허용 질의 없음 - 실행한 원격 질의 0.

### 0단계 표 - 손대기 전(81- 시작 시점 코드 그대로)
| 범주 | 저장 위치 | 담는 것 | 지금 모양 검사 | 깨지면 지금 어떻게 되나 | 사용자가 쓴 것인가(대기열) |
|---|---|---|---|---|---|
| main(요약) `dc1:{u}:main` | localStorage | 커플 id · 상대 id · 이름 · 온도 · 사귄 날 · 대표 사진 경로 | `coupleId` · `partnerId` 있음만 | 칸 타입이 틀려도 그대로 스토어에 들어감 → 메인 그리기에서 깨질 수 있음 · [다시 시도]도 같은 값 | 아님 |
| main:library | localStorage | 발행 호 목록 · 다음 호(월 · % · 건수) | 커플 id 같음 · `issues` 배열만(원소 검사 0) | 원소가 틀리면 메인 서재 카드에서 깨질 수 있음 | 아님 |
| main:facts | localStorage | 활동 유무 · 프로필 완성 · 열어 본 호 id | 커플 id · `openedFor` 글자만 | 불리언 자리에 다른 값 → 잘못된 표시 | 아님 |
| main:start | localStorage | 시작 온도 표시값 · 활동 유무 | 커플 id · `value` 숫자 | 대체로 안전 | 아님 |
| main:nickNotice · main:dateNotice (F1 · 닉네임 안내 표시) | localStorage | 이미 보인 안내의 키 | `.key ===` 비교 | 다시 한 번 보임(깨지지 않음) | 아님 |
| name:{상대 id} | localStorage | 상대 표시 이름 | 없음(`?.name`) | 이름 자리에 객체가 오면 글자로 이어 붙음 · 일부 화면에서 그리기 오류 가능 | 아님 |
| chat:{커플 id} | localStorage | 확정 메시지 100건 | 커플 id · `messages` 배열 · 원소의 커플 id · `sentAt`만 | 다른 칸이 틀린 원소가 채팅에 그려져 깨질 수 있음 | 아님(서버에 이미 있는 것) |
| chat:{커플 id}:head | localStorage | 채팅 머리 상대 이름 | 칸 셋 모두 | 안전(무시) | 아님 |
| feed | localStorage | 월 묶음 · 날짜 카드 · 작성자 이름 | `chapters` 배열만 | **80- 관찰**: `dates`가 글자면 피드 그리기 깨짐 → [다시 시도]도 다시 깨짐 · [로그아웃]만 탈출 | 아님 |
| feed:trash | localStorage | 지우지 못한 내 파일 경로 대기열(76-g) | 배열 · 글자 원소 거름 | 안전(빈 대기열 → 남은 파일은 월요일 정리) | 아님(삭제 대기) |
| sky:{커플 id} | localStorage | 하루 기록 · 온도 · 달 · 다음 호 기간 | 커플 id · `records` 배열만 | 기록 원소가 틀리면 하늘 그리기 깨질 수 있음 | 아님 |
| route(마지막 탭) | localStorage | 탭 이름 · 시각 | 칸 둘 타입 · 탭 이름 목록 | 안전(메인으로) | 아님 |
| push:asked (78- 권한 안내 보임) | localStorage | `{asked:true}` | `=== true` | 안내가 다시 한 번 | 아님 |
| 오류 건수 `ondolog.err1`(80-) | localStorage | (화면 · 종류)별 건수 · 보낸 시각 | **버전(`v:1`) + 칸 정리(`sanitizeState`)** 있음 | 조용히 빈 값으로 다시 시작(기록 0) | 아님 |
| 기기 id `ondolog.push.device` | localStorage | 이 기기 무작위 id(사람 0) | 8자 이상 | 새 id를 만듦(서버 토큰 행은 기존 규칙대로) | 아님 |
| 푸시 등록 표시 `ondolog.push.registered` | localStorage | `'1'` | `=== '1'` | 등록 안 됨으로 보고 다시 등록 | 아님 |
| 호 열어 봄 `ondolog.issueOpened.{u}.{호}` | Preferences | `'1'` | 값 있음이면 열어 봄 | 안전 | 아님 |
| **글 대기열** `chat_queue:{커플}`(`textQueueHub`) | Preferences(Android SharedPreferences · 웹 localStorage) | 보내지 못한 메시지(본문 · client_msg_id · 횟수 · 상태) | 원소별 칸 검사(`parseQueuedMessages`) | **JSON이 깨지거나 배열이 아니면 빈 큐 · 칸이 틀린 원소는 빠짐 → 다음 저장이 덮어써 원본을 잃음** | **예** |
| **사진 대기열** `chat_photo_queue:{커플}:{u}`(`photoQueueHub`) + 파일 `Data/chat-photo-queue/` | Preferences + Filesystem | 보내지 못한 사진 메시지 · 이야기(파일 경로 · 형식 · 횟수) | 원소별 칸 검사(`parseQueuedPhotos`) | **글 대기열과 같음(항목 유실)** · 파일은 지우는 곳이 없어 남음(고아 파일) | **예**(파일 포함) |
| 로그인 세션 `sb-…-auth-token` | Preferences | Supabase 세션 | supabase-js가 검사 | 로그인 안 됨으로 보고 첫 화면 | 아님 - 라이브러리 소관(이번 범위 밖) |
| 사진 고르기 · 피드 기록 임시 파일 | Filesystem `Cache` | 고른 사진 복사본 | 목록 저장 0(한 번 쓰고 지움) | 해당 없음 | 기록 시트 진행 중 것뿐(저장 목록 없음) |
| 서명 URL | 메모리만 | 사진 주소(45분) | - | 해당 없음(기기 저장 0) | 아님 |
| 서랍 알림(76-i) | OS 알림 서랍 | 받은 푸시 | - | 기기 저장 0(앱 저장소 아님) | 아님 |
| 온보딩 답(로그인 전) | 메모리만(영속 저장 금지) | - | - | 해당 없음 | - |

## `80-` 앱 오류 기록 - 우리 서버 · 개인정보 0 · 외부 서비스 0 (메인 세션, 2026-11-17, 위임문 `phase-7/80-dispatch-app-error-log.md` · 근거 `79-pm-report.md` §5 · R114-3 ② · R115-1~4 · R112-3) - 완료 (미커밋)

> 이 컴퓨터(Windows)의 Playwright WebKit ≠ iOS Safari · WKWebView — 실기기 대체 아님

범위: `supabase/migrations/` 새 파일 1(`80-m1` = `20261117120000_m1_app_error_log.sql`) · `__tests__/db/appErrorLog80m1.test.ts` · `scripts/ops/purgeWithdrawn.ts` + 시험(90일 정리 단계) · `web/src/errorLog/`(새 3파일) · `web/src/` 연결 지점 9파일 · `web/smoke/`(79-덧붙임 3줄 + 오류 경계 시험 · `gate.mjs`) · `web/package.json`(script `gate` 한 줄) · HANDOFF · PROGRESS. **마이그레이션 1 · 원격 접속 0(이번 허용 질의 없음 - 실행한 원격 질의 0) · 새 패키지 0 · 외부 서비스 0 · 함수 0 · 네이티브 0 · 렌더 0 · `consent.ts` 0 · `demo_responses` 0 · R34-3 호출 0 · 커밋 0 · db push 0.**

검증: web tsc 0 · 스모크 tsc 0 · Vitest 62/1000 → **63/1023** + 1 건너뜀 · `LEGAL_CHECK=1` 법무 8/8 · **`npm run smoke:webkit` 24/24(WebKit 12 · Chromium 12)** · `npm run gate`(순서대로) 102초 · 루트 tsc 0 · jest 115/1971 → **116/1986** · PGlite 9/118 → **10/129** · `deno check` `purgeWithdrawn.ts` · Python 324 OK · `build` · `build:trial` · `cap sync android`(맨 끝 한 번, `web/android` 변경 0). 두 빌드 결과물 스모크 표지 0. 키 · 주소 · ref · id · 이메일 · 토큰 · 내용 0 · 파일 이름 ASCII.

### 결정 기록
- **집계표 하나(`app_error_daily`)** - 행 = 묶음(KST 하루 · 화면 · 종류 · 앱 버전 · 플랫폼), 칸 = 건수뿐. 사용자 · 커플 · 기기 id · IP · 메시지 · 스택 · 자유 글 칸 0(PGlite 정적 단언: 칸 목록). 날짜는 **서버가 정한다**(보낸 때의 KST 날짜 - 앱은 날짜를 보내지 않음). 오프라인으로 모았다가 다음 날 보낸 건수는 보낸 날로 들어간다(내용 칸을 늘리지 않으려는 선택).
- **넣기는 RPC 하나(`log_app_error`)** - anon · authenticated 실행 가능(로그인 전 온보딩 오류도 받음) · PUBLIC 0. 화면 · 종류는 허용 목록 밖이면 `other` · 버전은 `^[0-9]{1,4}(\.[0-9]{1,4}){0,3}$` · 20자 이하(밖이면 `other`) · 플랫폼은 android / ios / web(밖이면 `other`) · 기기가 모아 보낸 건수는 1~1000으로 자름 · 묶음 하루 상한 **10,000**(넘으면 더하지 않음). 표 직접 읽기 · 쓰기 · 고치기 · 지우기는 앱 역할 0(RLS 켬 · 정책 0 · 권한 0) · service_role은 select · delete만(기본 권한을 걷고 둘만 줌).
- **90일 보존**: 월요일 `purgeWithdrawn`에 "오류 기록 90일 정리" 단계(76-i 숨긴 행 정리 뒤). 기준 = KST 오늘 - 90일보다 앞선 날짜. 표가 없으면(80-m1 전) "확인 못 함(80-m1 전이면 정상)" 한 줄로 넘어가고 다른 단계는 그대로(시험). 멱등(시험 · PGlite).
- **앱 기기 규칙**(`web/src/errorLog/`): 기기 묶음 = (화면, 종류) · 같은 묶음은 **1시간에 1번** 보내고 사이 건수는 기기에서 세어 다음 전송에 합침 · 기기 전체 **1시간 30번** · 오프라인 · 연결 값 없음 · 실패면 모아 두었다가 다음 온라인(`online` 이벤트) · 시작 5초 뒤 · 오류 뒤 2초에 보냄. 보내는 인자는 `p_screen · p_kind · p_version · p_platform · p_count` 다섯뿐(시험이 키 목록 · 값 · 비밀 글자 0을 단언).
- **화면 이름 = 라우트 이름**(`ALL_ROUTES` + `unknown`). 서버 허용 목록과 같은지 Vitest가 마이그레이션 파일을 읽어 비교한다. **그리기 중에** 갱신한다(effect로 하면 새 화면이 그리다 깨질 때 이전 화면 이름이 남는다 - 스모크 "오류 경계"가 처음에 `main`으로 잡은 것을 고침).
- **기기 저장 키 `ondolog.err1`**(사용자에 묶이지 않음 - 로그인 전 오류도 셈, 건수뿐). 규칙을 맞춰 로그아웃 · 탈퇴 요청(`clearAllDeviceCache`) · 계정 전환(`purgeOtherUsers`가 다른 사람 것을 지웠을 때만) 때 지운다. `dc1:` 접두 밖에 둔 이유: `purgeOtherUsers`의 "지운 수 > 0 = 계정 전환" 신호(76-i 서랍 알림 지우기)를 바꾸지 않으려고. 저장이 막히면 메모리로만 셈.
- **기록 실패 무해 · 반복 0**: 보내기 · 저장 실패는 모두 그 안에서 삼키고 세지 않는다(처리 안 된 거부도 만들지 않음 - 시험). `ResizeObserver loop` 경고는 세지 않는다(글자는 거르는 데만 읽고 남기지 않음).
- **큐 재시도 한계(`queue_giveup`)**: 채팅 글 · 사진 큐에서 항목이 `failed`(자동 재시도 멈춤)가 될 때 한 번. 기기에서 읽어 온 이미 멈춘 항목은 빼고 센다(`prime`). 루트 `src/utils` 순수 큐는 변경 0(웹 허브의 변경 알림에서 봄).
- **사진 올리기 실패(`upload_fail`)**: 채팅 사진 · 이야기 큐의 시도가 `done`이 아닐 때 · 피드 기록의 `storage.upload`가 오류를 돌려주거나 던질 때(이 감싸기는 원래 시험 빌드 전용이었는데 운영에서도 감싸도록 바꿈 - 시험 빌드 진단 글자는 그대로 `IS_TRIAL_BUILD` 안).
- **79-덧붙임 3줄**(`79-pm-report.md` §5 = 위임서 3단계): ① 스모크 실패 때 `runs/<회차>/failures.md`에 엔진 · 시험 · 화면 이름(`data-screen`) · 걸린 요소(오류 줄의 선택자) · 스크린샷 경로 한 줄 + 그 스크린샷(회차 폴더 - 덮어쓰기 0, 저장소 밖) ② `npm run gate`(`smoke/gate.mjs`) = web tsc → Vitest → 법무 → `smoke:webkit` **순서대로** · 스모크 실행기는 잠금 파일로 겹쳐 돌지 않음 ③ **스모크 빌드만 console 호출을 남김**(앱 설정을 합친 뒤 `esbuild.drop = []` - mergeConfig가 배열을 이어 붙여서). 운영 · 시험 빌드는 그대로 지움(A-7). console을 남긴 뒤에도 기존 화면 22건 콘솔 오류 0.
- **오류 경계 스모크**: 앱에 시험 모드를 넣지 않고 **데이터로** 일부러 깨뜨린다 - 피드가 첫 그림에 쓰는 기기 저장분(`feed` 범주)의 날짜 목록을 배열 대신 글자로 둔다 → 피드 화면이 그리다 깨짐 → 기존 오류 경계(`RenderGuard`)가 대체 화면 · 가짜 클라이언트에 `log_app_error` **1회** `{p_screen: 'feed', p_kind: 'render_crash', p_count: 1}` · 보낸 값에 내용 0. 메인 머리의 이름 저장분은 객체가 와도 글자로 이어 붙여 깨지지 않았다(좋은 쪽).
- 관찰(고치지 않음 - 범위 밖): 피드 기기 저장분이 깨지면(위 모양) 대체 화면의 [다시 시도]도 같은 저장분을 다시 읽어 다시 깨진다 - [로그아웃]이 저장분을 지워 벗어난다. 실제로는 저장 손상 때만 생김. 고치려면 `initialFeedState`의 모양 검사 보강(작은 앱 수정) - PM 판단.
- `79-pm-report.md`는 작업을 시작할 때 폴더에 없었다(다른 곳에서 찾지 않음). 위임서 3단계의 세 줄로 진행했고, 작업 중에 생긴 파일을 마지막에 읽어 §5와 대조함 - 같음.
- 운영 번들의 `console.error(` 글자 1건은 Capacitor 코어 내부(`t.console.error`, 속성 호출이라 drop 대상 아님) - 이번 변경과 무관(원래 있음).

### 허용 목록 · 상한
| 구분 | 값 |
|---|---|
| 화면 이름(37) | intro · basic · mbti · quiz · brief · share-card · consent · underage · auth · callback · detail · invite · start-date · main · chat · feed · magazine · settings · couple-invite · start-date-recheck · date-detail · stop-edit · settings-profile · settings-couple · settings-unlink · settings-personality · settings-result · retest · settings-privacy · settings-about · settings-withdraw · withdraw-cancel · sky · push-permission · settings-notify · nickname-recheck · unknown (밖 → other) |
| 오류 종류(8) | uncaught · unhandled_rejection · render_crash · upload_fail · queue_giveup · push_register_fail · cache_fail · auth_return_fail (밖 → other) |
| 버전 · 플랫폼 | `^[0-9]{1,4}(\.[0-9]{1,4}){0,3}$` · 20자 / android · ios · web (밖 → other) |
| 서버 상한 | 한 번 1~1000 · 묶음 하루 10,000 |
| 기기 상한 | 같은 묶음 1시간 1번 · 전체 1시간 30번 · 기기에 모아 두는 묶음당 10,000 |
| 보존 | 90일(월요일 정리) |

### 항목별
| 잡는 곳 | 고친 곳 | 시험 | 폰에서만 확인되는 것 |
|---|---|---|---|
| 처리 안 된 예외 · 거부 | `main.tsx`(+ 스모크 진입점 같은 순서) `installErrorCapture(window)` | Vitest uncaught · unhandled_rejection · ResizeObserver 0 | 웹뷰가 실제로 이벤트를 넘기는지(월요일 건수) |
| 화면 그리기 오류 | `components/AccountProblem.tsx` `RenderGuard.componentDidCatch` · `App.tsx` 화면 이름 | Vitest · **스모크 오류 경계(WebKit · Chromium)** | 없음(스모크로 확인) |
| 사진 올리기 실패 | `photoQueue/photoQueueHub.ts` · `features/feed/feedSave.ts` | Vitest(피드 upload 오류) | 실제 끊김 · 큰 사진에서의 건수 |
| 큐 재시도 한계 | `features/chat/textQueueHub.ts` · `photoQueue/photoQueueHub.ts` | Vitest(읽어 온 멈춘 항목 0 · 새 멈춤 1) | 비행기 모드 재시도 소진 |
| 알림 토큰 등록 실패 | `push/pushCore.ts` `registerToken` | Vitest | Android FCM · iOS APNs 실제 등록 |
| 기기 저장 실패 | `cache/deviceCache.ts` `writeCache` | Vitest(가득 참) · 스모크 "저장소 막힘" | 실제 용량 부족 |
| 로그인 복귀 실패 | `auth/callback.ts` `exchangeCodeOnce` | Vitest | 카카오 로그인 복귀 실패 |

### 스모크 결과 (화면 × 엔진)
| 화면 | WebKit(iPhone 14 Pro) | Chromium(Pixel 7) |
|---|---|---|
| 온보딩 · 동의 · 메인 · 하늘 2 · 채팅 · 피드 기록 · 서재 · 뷰어 · 설정 · 저장소 막힘 · 법무 | 11/11 통과 | 11/11 통과 |
| **오류 경계(80-)** | 처음 실패(화면 이름 `main`) → 고친 뒤 통과 | 같음 |
| 합계 · 소요 | **24/24** · Playwright 51초 · `smoke:webkit` 71초 · `npm run gate` 102초 | |

이번 회차 실패 기록(덧붙임 ①이 남긴 것): 처음 오류 경계 시험 2건 - `runs/<회차>/failures.md`에 화면 `main` · 요소 `getByTestId('account-problem')` · 스크린샷 경로가 남음(메인 머리는 깨지지 않아 피드 저장분으로 바꿈).

### 월요일 운영에 더한 줄
76-f 월요일 운영 절 9번(아래 절에 넣음): 지난 7일 (화면 · 종류 · 플랫폼)별 건수 상위 10 - 대시보드 SQL Editor(읽기만, 건수만):

```
select screen, kind, platform, sum(count)::int as n
from public.app_error_daily
where day >= (now() at time zone 'Asia/Seoul')::date - 6
group by screen, kind, platform
order by n desc, screen, kind, platform
limit 10;
```

0줄이 아니면 그 줄들(화면 · 종류 · 플랫폼 · 숫자)만 PE에. `purgeWithdrawn` 미리 보기에 "오류 기록 90일 정리: n" · 적용에 "오류 기록 지움: n" 줄이 더해짐(80-m1 전에는 "확인 못 함").

### 커밋 명령 (맨 위 폴더에서)
```
git add supabase/migrations/20261117120000_m1_app_error_log.sql __tests__/db/appErrorLog80m1.test.ts
git add scripts/ops/purgeWithdrawn.ts scripts/ops/purgeWithdrawn.test.ts
git add web/src/errorLog/errorLog.ts web/src/errorLog/errorLogRules.ts web/src/errorLog/errorLog.vitest.tsx
git add web/src/main.tsx web/src/App.tsx web/src/components/AccountProblem.tsx web/src/cache/deviceCache.ts web/src/auth/callback.ts web/src/push/pushCore.ts web/src/features/feed/feedSave.ts web/src/photoQueue/photoQueueHub.ts web/src/features/chat/textQueueHub.ts
git add web/smoke/entry.tsx web/smoke/fakeClient.ts web/smoke/playwright.config.ts web/smoke/run.mjs web/smoke/screens.smoke.ts web/smoke/vite.smoke.config.ts web/smoke/gate.mjs web/package.json
git add .claude/state/HANDOFF.md .claude/state/PROGRESS.md
git commit -m "80- app error log: daily aggregate table, RPC, device rate limits, smoke error boundary"
```
(`.claude/state/prompts/phase-7/79-pm-report.md`는 PE가 넣은 파일 - 이 묶음에 넣을지는 Proteur 판단.)

### db push 순서 (`80-m1` 한 파일)
```
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
npx supabase migration list
```
dry-run에 `20261117120000_m1_app_error_log.sql` **하나만** 보여야 한다. 다른 것이 보이면 멈추고 보고. 그 뒤 대시보드 SQL(읽기만): `select count(*) from public.app_error_daily;` -> 0(새 표).

### Proteur 다음 순서
1. 커밋(위 명령) → db push(위 순서).
2. 폰 덮어 설치: **필요**(앱 코드 변경 - 오류 기록). `npm run build:trial` → `npx cap sync android`(메인 세션이 맨 끝에 한 번 돌림) → Android Studio 빌드 → 두 폰에 덮어 설치(앱 삭제 불필요 - 기기 저장 · 로그인 그대로).
3. 폰 확인: 평소처럼 앱을 쓰면 된다(오류를 일부러 낼 길은 앱에 넣지 않음). **월요일 9번 질의의 건수 0 확인**으로 대신 - 0이 아니면 숫자만 PE에. (db push 전에 설치해도 앱은 멈추지 않음 - RPC 실패는 기기에 모아 두었다가 push 뒤 보냄.)
4. PM 확인 목록: 아래.

### PM 확인 목록 (보고에 적기만)
- 처리방침 1번 "서비스 운영 중 자동으로 생기는 기록: 로그인 · 접속 기록"에 이 기록(사람 · 기기를 가릴 수 없는 하루 화면 · 오류 종류 · 앱 버전 · 플랫폼별 건수, 90일 보존)이 들어가는지 · 문구 보강이 필요한지. `consent.ts` 변경 0.
- (관찰) 피드 기기 저장분 손상 때 [다시 시도]가 다시 깨지는 점 - 모양 검사 보강을 할지.

## `79-` WebKit 공통 호환 - Mac 없이 iPhone 차이 미리 잡기 (메인 세션, 2026-11-17, 위임문 `phase-7/79-dispatch-webkit-compat.md` · R114-1~3 · R114-6 · R112-3) - 완료 (미커밋)

범위: `web/smoke/`(새 폴더 9파일) · `web/src/app/smokeIsolation.vitest.ts` · `web/vite.config.ts`(build.target 한 줄) · `web/package.json`(devDependency 1 · script 1) · `web/package-lock.json` · HANDOFF · PROGRESS. **앱 화면 코드 변경 0 · 마이그레이션 0 · 원격 접속 0(Supabase 질의 0 - 이번 허용 질의 없음) · `cap add ios` 0 · 네이티브 0 · `consent.ts` 0 · `demo_responses` 0 · R34-3 호출 0 · 커밋 0.** 밖으로 나간 것은 허가된 npm 레지스트리(설치)와 Playwright 브라우저 내려받기뿐.

검증: web tsc 0 · 스모크 tsc 0 · Vitest 61/997 → **62/1000** + 1 건너뜀 · `LEGAL_CHECK=1` 법무 8/8 · **`npm run smoke:webkit` 22/22(WebKit 11 · Chromium 11)** · 루트 tsc 0 · jest 115/1971 · PGlite 9/118 · Python 324 OK · `build` · `build:trial` · `cap sync android`(맨 끝 한 번, `web/android` 변경 0). 두 빌드 결과물 스모크 표지 0. 키 · 주소 · ref · id · 이메일 · 실제 이름 0 · 파일 이름 ASCII.

### 결정 기록
- **Playwright WebKit은 실기기 대체가 아니다**(R114-6). iOS Safari · WKWebView와 같은 엔진 계열이지만 Windows 빌드(WebKit 27.2, playwright webkit 2370)는 같은 것이 아니다. 키보드 · 안전 영역 실제 값(여기서는 0) · 사진 선택기 · 카메라 · 푸시 · 앱 링크 · 스크롤 관성 · 프레임 성능은 못 본다 → Mac 도착 뒤 실기기 한 바퀴가 대체 불가(아래 "Mac 뒤").
- 설치(Proteur 허가 범위 그대로): `@playwright/test` **1.64.1**(1.64.x 최신 패치, `--save-exact`) devDependency 한 줄 · WebKit 브라우저 한 번(`%LOCALAPPDATA%\ms-playwright\webkit-2370`, 171MB, 저장소 밖). Chromium 1248은 이미 있던 것을 같이 씀(새로 받지 않음). lock 추가는 `@playwright/test` · `playwright` · `playwright-core`(+ 선택 fsevents)뿐. render/.venv Python 길 미사용.
- **"빌드 산출물 위에서" = "같은 코드 · 같은 설정으로 따로 빌드"**(Proteur 결정 2-①). `smoke/vite.smoke.config.ts`가 앱 `vite.config.ts`를 그대로 불러 세 가지만 바꾼다: ① 같은 `index.html`에서 진입 줄(`./src/main.tsx` → `./smoke/entry.tsx`)만 ② 출력 = 저장소 밖(`%TEMP%\ondolog-smoke\dist`) ③ envDir = 비어 있는 `smoke/`(원격 값이 스모크 번들에 안 들어감 - 스모크 번들의 `supabase.co`는 라이브러리 기본 문자열 1건뿐). build.target · 별칭 · console 제거 · base는 앱과 같음. mode는 `smoke`(운영처럼 시험 빌드 표시 0).
- 스모크 진입점(`smoke/entry.tsx`)은 앱 `main.tsx`와 같은 세 줄(installWebFeel · installKeyboardFocus · `<App/>`)을 같은 순서로 하고, 다른 것은 데이터 연결부(`setSupabaseForTest(가짜 클라이언트)`)와 `?world=` · `?path=`(App이 원래 받는 `initialPath`)뿐. 화면 · 라우트 · 스타일 복사본 0.
- 가짜 클라이언트(`smoke/fakeClient.ts`)는 vi 0인 메모리 표 하나(select · eq · in · is · lt · gte · or · not · order · range · count · single · rpc · Storage 서명 · Realtime · auth). 만든 데이터(`smoke/seed.ts`)는 지어낸 이름(가온 · 나래 · 솜사탕) · 문장 · 그림(SVG 그라데이션) · 손으로 쓴 빈 PDF뿐. **서버 시각은 PostgREST 모양(UTC · 소수 6자리 · `+00:00`)**으로 넣어 WebKit `Date.parse`를 실제 모양으로 시험.
- ② 새지 않음: 표지 목록 한 벌(`smoke/markers.mjs`). `smoke:webkit`이 앱 시험 빌드를 임시 폴더에 따로 내 표지 0을 확인하고(확인 뒤 그 사본은 지움 - 원격 값이 들어 있을 수 있어서), 스모크 결과물에는 표지가 있는지(검사가 살아 있는지)도 본다. Vitest `smokeIsolation`이 정적으로: 앱 입구 = `index.html` → `./src/main.tsx` 하나 · `src/` 앱 파일의 smoke import 0 · `vite.config.ts`에 smoke 0 · `web/dist`(있으면) 표지 0. 이번 마지막 `build` · `build:trial` 결과물 각각 표지 0.
- 시험 파일 이름 `*.smoke.ts`(루트 jest 기본 `*.spec|*.test`에 안 걸리게 · `web/tsconfig` include가 `src`라 web tsc에도 안 걸림 - 스모크 타입은 `smoke/tsconfig.json`으로 `smoke:webkit` 첫 단계에서 검사).
- **build.target = `['chrome107', 'edge107', 'firefox104', 'safari16.4']`**(Proteur 결정 3). Vite 7 기본(baseline-widely-available)에서 safari16 → 16.4만 올림 - Android 웹뷰 기준(chrome107) 그대로. 시험 빌드 메인 번들 크기 전 900,368바이트 → 뒤 900.37kB(같음 - 내려 쓰던 문법이 없었음).
- 스모크 대기 규칙: 앱은 이동 직후 `NAV_COOLDOWN_MS`(350ms, `src/navigation.tsx` 연타 방지) 동안 다음 이동을 받지 않는다 → 시험은 이동마다 400ms 쉰다. 모양 단언은 유한한 연출(시트 380ms 등)이 끝난 뒤 잰다(반짝임 같은 무한 반복은 기다리지 않음).
- console 오류 단언의 한계: 빌드가 console 호출을 지우므로(A-7) 앱 · 라이브러리의 console.error는 스모크에서 안 보인다. 잡는 것 = 처리 안 된 예외(pageerror) · 처리 안 된 Promise 거부(시험이 심은 리스너) · 브라우저 자체 오류(자원 실패 등).
- 상시 게이트 소요: `npm run smoke:webkit` 69~103초(타입 7~11 · 스모크 빌드 5~8 · 시험 빌드 5~6 · Playwright 51~78). **다른 시험(jest · Vitest)과 동시에 돌리지 않는다** - 동시에 돌린 1회에서 WebKit 2건(온보딩 · 동의)이 1초 안 보임 단언에 걸렸고(그 실패 기록은 다음 실행이 덮어써 어느 요소인지 못 남김), 부하 없이 같은 2건 4회 반복 8/8 · 전체 3회 22/22.

### 스모크 결과 (화면 × 엔진)
| 화면 | WebKit(iPhone 14 Pro) 처음 → 고친 뒤 | Chromium(Pixel 7) 처음 → 고친 뒤 | 처음 실패 원인 |
|---|---|---|---|
| 온보딩(첫 화면 · 이름 · 생년월일 · 성별 · 검사 한 문항) | 통과 → 통과 | 통과 → 통과 | - |
| 동의(5개 · [보기] 처리방침 전문 스크롤) | 실패 → 통과 | 실패 → 통과 | 시험 틀: 동의 화면은 생년월일이 있어야 열림(온보딩을 거치게) · 시트 연출 중에 잼 |
| 메인(온도 · 문구 · D+ · 매거진 % · 탭 · KST 날짜) | 통과 → 통과 | 실패 → 통과 | 시험 틀: 선택자 · 초안 진행 행(`fn_issue_progress`) seed 없음 |
| 하늘(B02 끌기 · C01 · 별 · C02 · 줄인 모션) | 통과 → 통과 | 실패 → 통과 | 시험 틀: 끌 대상(`.mainScroll`) · 이동 350ms 쿨다운 |
| 채팅(목록 · 입력창 · 사진 칸 비율 · 맨 아래 · 서버 시각 표시) | 통과 → 통과 | 통과 → 통과 | - |
| 피드 기록(카드 · 하루 지우기 밀기 · 장소 · 메모 · 사진 선택기 열림) | 통과 → 통과 | 실패 → 통과 | 시험 틀: 사진 + 뒤 [앨범] 시트 한 단계 |
| 서재 · 뷰어(목록 · 앞장 · 쪽 보기) | 통과 → 통과 | 통과 → 통과 | - |
| 설정(알림 H10 · 개인정보 & 약관 · 해제 · 탈퇴 진입) | 통과 → 통과 | 실패 → 통과 | 시험 틀: 이동 350ms 쿨다운 |
| 법무(세 문서 전문 · 자리표시자 0) | 실패 → 통과 | 실패 → 통과 | 시험 틀: 쿨다운 · 시트 연출 중에 [확인] 위치를 잼 |
| 저장소 막힘(localStorage · IndexedDB 예외) - 추가 | 통과 | 통과 | - |
| 공통: 원격 요청 0 · 가로 스크롤 0 · 고정 버튼 화면 안 · 1초 첫 프레임 · 제목 넘침 0 | 전 화면 통과 | 전 화면 통과 | - |

**WebKit에서만 실패한 것: 0.** 처음 실패는 모두 시험 틀(선택자 · 대기 · 경로) - 앱 결함 0. 화면별 스크린샷은 저장소 밖(`%TEMP%\ondolog-smoke\shots\{webkit,chromium}`) - 커밋 0.

### 고친 곳
| 원인 | 고친 곳 | Android 영향 | 폰에서 다시 볼 것 |
|---|---|---|---|
| 빌드 대상이 iOS 16.0(Vite 기본) - 기준 iOS 16.4로 | `web/vite.config.ts` build.target | 0(chrome107 그대로 · 번들 크기 같음) | 없음(화면 변화 0). 다음 설치 때 평소 확인만 |

정적 검색(2단계 후보): iOS 16.4 밖 API · 문법 0(`Object.groupBy` · `Promise.withResolvers` · `requestIdleCallback` · `AbortSignal.any` · `checkVisibility` · 정규식 lookbehind · `text-wrap` · `@container` 등 0 · `:has()`는 15.4+). `100vh` 0 · `type="date"` 0(날짜는 글자 입력 YYYY.MM.DD) · `backdrop-filter` 0 · `viewport-fit=cover` + `env(safe-area-inset-*)` 있음 · 파일 입력 `accept="image/*"` · `multiple`(스모크가 선택기 열림까지 확인). `-webkit-overflow-scrolling: touch` 1곳(`styles.css` `.skyScroll`) - iOS 13부터 효과 없는 잔재, 걸린 것이 아니라 그대로 둠.

### Mac 뒤 (실기기 · Xcode가 있어야 보는 것)
| 항목 | 왜 Mac 뒤 | 무엇을 볼지 |
|---|---|---|
| 키보드 | WKWebView 키보드 · 화면 줄어듦은 데스크톱 WebKit에 없음 | 채팅 입력창이 키보드 위에 붙는지 · 탭 바 숨김 · 기록 시트 메모 칸 가림 |
| 안전 영역 실제 값 | Playwright는 inset 0 | 노치 · Dynamic Island 아래 머리 · 홈 표시줄 위 탭 바 · 시트 [확인] 여백 |
| 사진 선택(HEIC · GPS) | 시스템 선택기 · HEIC 변환은 iOS 전용 | HEIC 고르기 · 촬영 시각 · 위치 칸 0(stripLocation) · 여러 장 |
| 카메라 | 권한 · 촬영 화면 | 채팅 · 기록 [카메라] → 찍고 돌아오기 |
| 앱 링크 · 카카오 로그인 복귀 | 유니버설 링크 · URL 스킴은 iOS 앱 설정 | 로그인 뒤 앱으로 돌아와 세션이 잡히는지 |
| 푸시(APNs) | iOS 인증서 · 권한 · 앱 설정 | 권한 묻기(I08) · 받기 · 눌러 열기 · 서랍 지우기 |
| 스크롤 관성 · 끌기 | 터치 관성 · 고무줄 효과는 실기기만 | 하늘 B02 끌어내리기 · C02 위로 · 피드 하루 지우기 밀기 · 76- R99-3 기기 기본 스크롤 |
| 하늘 성능(프레임) | GPU · 프레임은 실기기만 | 별 반짝임 · 줄인 모션 설정 반영 |
| 오프라인 저장 실제 | WKWebView 저장소 정책(용량 · 지움) | 비행기 모드 채팅 큐 · 다시 켜면 보내짐 · 앱 다시 열기 |
| Info.plist 권한 문구 | iOS 앱 프로젝트 필요(`cap add ios` = Mac 뒤) | 사진 · 카메라 · 알림 문구 |
| 앱 ID `com.ondolog.app`(R114-2) | Apple 개발자 계정 · 서명 | 번들 ID · 푸시 · 앱 링크와 같은 ID |

### 커밋 명령 (맨 위 폴더에서)
```
git add web/package.json web/package-lock.json web/vite.config.ts
git add web/smoke/entry.tsx web/smoke/fakeClient.ts web/smoke/markers.mjs web/smoke/playwright.config.ts web/smoke/run.mjs web/smoke/screens.smoke.ts web/smoke/seed.ts web/smoke/tsconfig.json web/smoke/vite.smoke.config.ts
git add web/src/app/smokeIsolation.vitest.ts
git add .claude/state/HANDOFF.md .claude/state/PROGRESS.md
git commit -m "79- WebKit smoke on iPhone 14 Pro profile, build target safari16.4"
```

### Proteur 다음 순서
1. 커밋(위 명령).
2. 폰 다시 설치: **필요 없음**(앱 화면 코드 변경 0 · build.target만, 번들 크기 같음). 다음 정기 설치 때 함께 들어감. `cap sync android`는 맨 끝에 돌렸고 `web/android` 변경 0.
3. 새 컴퓨터 · 새로 받은 저장소에서는 `cd web` → `npm ci` → `npx playwright install webkit`(한 번) → `npm run smoke:webkit`.
4. 다음: `80-` 앱 오류 기록(R114-3 ②).

## `76-j` 흔들리는 시험 잡기 + 숨긴 "하루" 행 실제 삭제 (메인 세션, 2026-11-16, 위임문 `76-j-dispatch-dates-and-flaky.md` · 근거 `76-i-pm-report.md` · R112-2 · R112-3 · R112-5 · R112-6) - 완료 (미커밋)

범위: `scripts/ops/purgeWithdrawn.ts` + 시험 · `__tests__/db/hiddenRows76i.test.ts` · 흔들리는 시험 1파일(`web/src/features/chat/chatHead76r.vitest.tsx`, 시험만) · HANDOFF · PROGRESS. **마이그레이션 0 · 원격 접속 0(R112-3 - 이번 허용 질의 없음, 실행한 원격 질의 0) · 새 패키지 0 · 네이티브 0 · `consent.ts` 0 · 030 0 · 렌더 0 · 함수 0 · `demo_responses` 0 · R34-3 호출 0** · 스크립트 실행 0 · 커밋 0 · db push 0. **web 앱 코드 변경 0 -> build · cap sync 안 돌림**(위임서: web 코드를 고쳤을 때만). `ensureDate`(앱) 변경 0.

검증: 루트 tsc 0 · jest 115/1960 → **115/1971** · PGlite 9/113 → **9/118** · `deno check` `purgeWithdrawn.ts` · Deno 초기화 28/28 · web tsc 0 · **Vitest 고친 뒤 10회 연속 61/997 + 1 건너뜀** · 법무 관문 8/8. 키 · 주소 · ref · id · 이메일 · 토큰 · 내용 0.

### 멈춘 것

없음.

### ① 흔들리는 시험 (R112-5)

| 회차 | 결과 | 실패 |
|---|---|---|
| 1~10 | 10/10 통과 | - |
| 11~20 | 7/10 통과 | 12 · 15 · 19회: `chatHead76r.vitest.tsx` "F5 채팅 머리 이름 > 온라인에서 받은 상대 이름을 채팅 저장분에 남긴다" - `AssertionError: expected null to be '<상대 이름>'` |
| 고친 뒤 21~30 | **10/10 연속 통과** | - |

- 원인(한 줄): 시험이 화면에 이름이 보이자마자(`waitFor`) 기기 저장분을 **바로** 읽는데, 저장은 이름을 그린 뒤의 effect(`ChatView.tsx:300` `useEffect` -> `writeChatHeadName`)라 화면보다 몇 ms 늦을 수 있다 - 기계가 바쁠 때 effect가 늦게 돌면 `null`. (76-i 때 1회 실패도 루트 jest와 겹쳐 돈 때였다.)
- 제품 결함 아님: 저장은 곧바로 이어서 일어나고, 저장분은 다음 오프라인 진입 때만 쓰인다(앱을 그 몇 ms 안에 닫는 경우만 이번 이름이 안 남고, 그때도 전에 저장된 이름이 보인다). PM 판단 불필요.
- 고친 곳: 그 시험 한 줄 - 저장분 읽기도 `waitFor`로 기다린다. 제품 코드 0.
- 회차별 결과 파일(JSON)은 스크래치 폴더에만 두었다(저장소 밖).

### ② 숨긴 "하루"(`dates`) 행 실제 삭제 (R112-2 · (가)안)

- 76-i "숨긴 행 정리"에 `dates` 추가(`HIDDEN_TABLES` = data_entries -> messages -> **dates** 순서로 지움). 숨긴 지 24시간 지난 행을 **행째** 삭제 -> AI 제목 · 서사 · 지역이 DB에 남지 않음.
- 되살린 행 보호: 삭제 문장 자체에 "아직 숨겨져 있음(`deleted_at is not null`) · 숨긴 시각 <= 기준"을 건다 - 고른 뒤 앱의 `ensureDate`가 되살린 행은 지워지지 않는다.
- 안전 조건: 그 날짜를 가리키는 **살아 있는** 기록(숨기지 않은 사진 · 메모 · 그림, 장소 - 장소는 숨김 칸이 없어 있으면 살아 있음)이 하나라도 있으면 지우지 않고 "건너뜀"(실패 아님). **고를 때 한 번 · 지우기 직전 한 번** 본다 -> cascade로 살아 있는 장소가 지워지는 일 0.
- 같은 단계 안에서 숨긴 `data_entries`가 먼저 지워지므로, 숨긴 기록만 남은 날은 그 뒤 지워진다.
- 남는 좁은 틈(받아들임 - R112-2): 정리가 행을 지운 **바로 그 순간** 앱이 같은 날을 되살리려 하면 앱의 그 한 번 저장이 실패하고(행 없음), 다시 저장하면 새 행을 만들어 정상.

| 시험 | 어디 | 결과 |
|---|---|---|
| 24시간 안 숨긴 날 0건 · 지난 것만 행째 삭제 · AI 제목 · 서사 남지 않음 | 둘 다 | 통과 |
| 24시간 안에 되살아난 날 대상 밖 | 둘 다 | 통과 |
| 고른 뒤 지우기 전에 되살아난 날 0건(경쟁 상태) | 둘 다 | 통과 |
| 고른 뒤 살아 있는 장소가 생긴 날 -> 지울 때 건너뜀 · 장소 그대로 | 둘 다 | 통과 |
| 상대 기록이 있는 날 · 살아 있는 장소가 있는 날 0건(건너뜀 수) | 둘 다 | 통과 |
| 지운 뒤 같은 날 다시 기록 -> 앱 `ensureDate`와 같은 질의가 새 행(AI 칸 빈) · 기록이 붙음 | `hiddenRows76i.test.ts`(PGlite, 앱 질의 그대로 재현) | 통과 |
| 외래 키 = `date_stops` cascade · `data_entries` set null 둘뿐 · 삭제 트리거 0 | `hiddenRows76i.test.ts` | 통과 |
| 두 사람 모두 떠난 커플의 날은 76-g cascade가 맡음(두 번 세지 않음) · 멱등 · 미리 보기 삭제 0 · 출력 숫자만 | `purgeWithdrawn.test.ts` | 통과 |
| 발행된 호 · 매거진 파일 0건 · 76-g · 76-h · 76-i 회귀 0 | 둘 다 · 기존 시험 | 통과 |

시험 메모: `ensureDate`의 가짜 저장소 시험은 `__tests__/services/`(이번 편집 범위 밖)라, PGlite에서 `ensureDate`와 같은 질의(찾기 -> 숨겨져 있으면 되살리기 / 없으면 만들기)를 SQL로 그대로 재현해 확인했다.

### 바뀐 미리 보기 출력 줄 (숫자 자리만)

```
숨긴 행 정리: n                    (합 - dates 포함)
숨긴 행 정리 data_entries: n
숨긴 행 정리 messages: n
숨긴 행 정리 dates: n              <- 76-j 새 줄
건너뜀(살아 있는 기록): n          <- 76-j 새 줄(0 기대)
실제로 지우려면 --apply
```

`--apply`일 때 끝에 `건너뜀(지울 때 살아 있는 기록): n`(76-j 새 줄, 0 기대)이 더해진다.

### 76-j 결정 기록 (출처: R112-2 · R112-3 · R112-5 · R112-6)

| 결정 | 근거 |
|---|---|
| `dates`도 숨긴 지 24시간 뒤 행 삭제 · 앱은 그대로 | R112-2 (가) |
| 삭제 문장에 숨김 · 기준 조건 + 살아 있는 기록 확인 두 번(고를 때 · 지우기 직전) · 살아 있으면 "건너뜀" | 위임서 ② |
| `dates`는 같은 단계의 마지막(숨긴 기록이 먼저 지워진 뒤) | 위임서 ② 순서 |
| 원격 질의 0(이번 허용 질의 없음) | R112-3 |
| 흔들리는 시험은 시험 쪽 순서 의존(effect 저장을 기다리지 않음)만 고침 | R112-5 |

### 76-j 커밋 명령 (Proteur, 맨 위 폴더에서 · 한 줄씩)

1) 운영 스크립트 - 숨긴 하루 행 정리

```
git add scripts/ops/purgeWithdrawn.ts
git add scripts/ops/purgeWithdrawn.test.ts
git add __tests__/db/hiddenRows76i.test.ts
git commit -m "76-j ops: hard-delete hidden day rows after 24 hours, skip days with live records"
```

2) 흔들리는 시험

```
git add web/src/features/chat/chatHead76r.vitest.tsx
git commit -m "76-j test: wait for the saved chat head name instead of reading it right after render"
```

3) 상태 파일

```
git add .claude/state/HANDOFF.md
git add .claude/state/PROGRESS.md
git commit -m "76-j state: handoff and progress"
```

### Proteur 다음 순서

1. 커밋(위 1 · 2 · 3). **빌드 · 설치 불필요**(앱 코드 변경 0 - 76-i 빌드 그대로). db push · 함수 배포 없음
2. 폰 확인(76-i ④⑤ + 78- 남은 4개)은 76-i 절 그대로
3. **11/23(월) 첫 행 삭제 정리** - 76-f 월요일 운영 절 명령 그대로:
   1. `purgeWithdrawn` **미리 보기**만 -> 숫자 줄 전체(특히 "숨긴 행 정리" 4줄 · "건너뜀(살아 있는 기록)")를 PE에 보냄
   2. PE 확인을 받은 뒤에만 `--apply`(행 삭제는 되돌릴 수 없음) -> 적용 출력 숫자도 PE에
   3. 그다음 `sweepOrphanFiles` 미리 보기 -> 적용
   4. 같은 날 8번 알림 건강 확인: 대시보드 Logs 지난 7일 `push-send` 상태별 건수 - **11/16의 503 22건이 보이면 로그 7일 보존 확인**, 안 보이면 볼 수 있는 기간을 PE에
4. HANDOFF는 덮어쓰지 않고 메인 세션이 고친 것을 커밋만(R112-4). `b49c64c` 원인 한 줄을 PE · 메인 세션에 알려 주면 PROGRESS에 그대로 적음

## `76-i` 숨긴 행 실제 삭제 + 로그아웃 때 서랍 알림 지우기 + 변경 알림 뒤 새로 읽기 + 운영 규칙 2 (메인 세션, 2026-11-16, 위임문 `76-i-dispatch-hard-delete-hidden.md` · 근거 `78-pm-report.md` §4-2 · `78-phone-check-2-pm-report.md` P1 · P2 · R110-4 · R111-2~5) - 완료 (미커밋)

범위: `scripts/ops/purgeWithdrawn.ts` + 시험 · `__tests__/db/` 시험 1 · `web/src/`(④ · ⑤만: `push/` 3 · `app/useAccountData.ts` · `cache/deviceCache.ts` + 시험 2) · HANDOFF · PROGRESS. **마이그레이션 0 · 새 패키지 0 · 네이티브 0 · `consent.ts` 0 · `demo_responses` 0 · R34-3 호출 0** · 030 0 · 렌더 0 · 함수 0 · 스크립트 실행 0 · db push 0 · 커밋 0. 위임 0(메인 세션 직접). 원격은 **읽기 질의만**(⑥ 사실 확인: `pg_settings` · 로그 건수) - 숫자만 적음.

검증: 루트 tsc 0 · jest 114/1951 → **115/1960** · PGlite 8/110 → **9/113** · 함수 tsc 0 · `deno check` `purgeWithdrawn.ts` · Deno 초기화 시험 28/28 · web tsc 0 · Vitest 60/986 → **61/997** + 1 건너뜀 · `LEGAL_CHECK=1` 법무 관문 8/8(998/998) · `build` · `build:trial` · `cap sync android`(맨 끝 한 번). Vitest 5회 중 1회 시험 1건 실패 · 4회 통과(어느 시험인지 그 출력에서 못 잡음 - 이번 시험 파일은 단독 2회 통과). 키 · 주소 · ref · id · 이메일 · 토큰 · 내용 0 · 파일 이름 ASCII.

### 멈춘 것

- **`dates`(하루) 숨긴 행 - 멈춤(대상 밖).** 앱에 되살리는 기능이 있다: 같은 날 다시 기록하면 `ensureDate`(`src/services/dateRecordApi.ts`, 웹도 같은 함수)가 숨긴 `dates` 행의 `deleted_at`을 비워 **그 행을 되살린다**(R105-1 재검토 조건). 되살아나는 것은 날짜 칸뿐이고 지운 사진 · 메모(`data_entries`)는 되살아나지 않는다. 남는 내용 칸: `region` · `title` · `narrative`(AI 생성) · `last_featured_at` · `feature_count`. PM 선택지:
  - (가) `dates`도 24시간 뒤 행 삭제 - 앱은 행이 없으면 새로 만들어 동작은 같다(마이그레이션 0). 아주 좁은 경합(정리 순간 같은 날 재기록) 하나
  - (나) 행은 두고 내용 칸(`region` · `title` · `narrative`)만 24시간 뒤 비우기(마이그레이션 0)
  - (다) 지금처럼 유지(날짜 칸만 남음, 기록 내용은 이번 단계로 지워짐)
- 그 밖 멈춤 0. 숨긴 행 삭제를 막는 외래 키 0 · 삭제 트리거 0(PGlite 시험으로 확인) -> 마이그레이션 0.

### ① 소프트 삭제 테이블 표 (손대기 전)

| 테이블 | 숨김 표시 칸 | 숨겨도 남는 내용 칸 | 앱에서 숨기는 경로 | 가리키는 다른 행(외래 키 · on delete) | 행 삭제 가능? |
|---|---|---|---|---|---|
| `data_entries`(사진 · 메모 · 그림) | `deleted_at` | `text_content`(메모 글) · `storage_path` · `thumb_path` · `drawing_path` · `captured_at` · `lat` · `lng` · `place_name` · `hashtags` · `ai_tags` 등 | 사진 · 메모 하나 지우기 `fn_delete_own_entry`(023) · 하루 지우기 `fn_delete_my_day`(76-m3) | `stories.archived_entry_id` -> **set null**(하나뿐) | **예 - 이번 대상** |
| `messages` | `deleted_at` | `body`(대화 원문) · `media_path` · `sentiment` · `warmth_score` | **없음** - 앱(웹 · RN)에 메시지 지우기 기능 0, `deleted_at`을 쓰는 코드 0 | 없음 | **예 - 대상**(지금은 0건 예상, 생기면 같은 규칙) |
| `dates` | `deleted_at` | `region` · `title` · `narrative` · `last_featured_at` · `feature_count` | 하루 지우기에서 그날 남은 것이 0일 때 | `date_stops.date_id` cascade · `data_entries.date_id` set null | 막힘은 없으나 **앱이 되살림 -> 멈춤 · 대상 밖**(위) |
| `date_stops` | 없음 | - | 이미 행 삭제(장소 지우기 · 하루 지우기) | `data_entries.date_stop_id` set null | 해당 없음 |
| `stories` | **없음** | - | 사용자 지우기 = 행 삭제(`stories_delete` 정책) | - | 해당 없음. **만료와 사용자 삭제 구분**: 삭제는 행이 없어지고, 만료는 `resolved_at` · `resolution`('archived' = 아카이브 편입 / 'discarded')으로 남는다 -> 만료 스토리는 이 단계가 건드릴 칸이 없음(0건) |
| `profiles` | `deleted_at` · `purge_scheduled_at` | 탈퇴 유예 | 탈퇴 요청 | (76-g 표) | 대상 밖 - 76-f · 76-g 탈퇴 최종 삭제가 맡음 |

### 시험 표

| # | 시험 | 어디 | 결과 |
|---|---|---|---|
| ② | 미리 보기: 숫자만 · 지난 것만 셈 · 삭제 0 | `purgeWithdrawn.test.ts` | 통과 |
| ③ | 24시간 안 0건 · 정확히 24시간은 지남 · 숨기지 않은 행 · 상대 행 0건 | 둘 다 | 통과 |
| ③ | 만료 · 편입된 스토리 행 0건(편입 칸만 비워짐) | `hiddenRows76i.test.ts` | 통과 |
| ③ | 발행된 호 · 매거진 파일 0건 | 둘 다 | 통과 |
| ③ | 외래 키 = ① 표(스토리 set null · 날짜 · 장소 그대로 · 숨긴 `dates` 행 그대로) · 막는 외래 키 · 삭제 트리거 0 | `hiddenRows76i.test.ts` | 통과 |
| ③ | 76-g · 76-h 단계 뒤에 돈다 · 그 단계가 맡은 행(통째로 지울 커플 · 떠난 사람 기록) 두 번 세지 않음 | `purgeWithdrawn.test.ts` | 통과 |
| ③ | 한 표 막힘 -> 그 행 수만 실패 · 다른 표 계속 · 다음 실행에 마무리 · 멱등 | 둘 다 | 통과 |
| ③ | 76-g · 76-h · R108-2 회귀 0 · 출력 숫자만 · R34-3 · `demo_responses` 0 | 기존 시험 전부 | 통과 |
| ④ | 5자리(로그아웃 · 탈퇴 요청 · 해제 요청 · 해제 유예/완료 · 계정 전환) 각각 서랍 지우기 1 | `push76i.vitest.tsx` | 통과 |
| ④ | 순서 서랍 -> 토큰 -> 세션 · 서랍 실패해도 토큰 삭제 · 로그아웃 진행 · 두 번 불려도 오류 0 · 웹 미리보기 0 | `push76i.vitest.tsx` | 통과 |
| ④ | 같은 사람의 앱 시작에는 서랍 0(계정 전환일 때만) | `push76i.vitest.tsx` | 통과 |
| ⑤ | 날짜 변경 안내 -> 새로 읽기 1 · D+ 근원 · 기기 저장값 갱신 / 닉네임 -> 1 · 이름 갱신 / 메시지 -> 0 / 연달아 3건 -> 2회 이하 | `push76i.vitest.tsx` | 통과 |
| - | 78- 푸시 시험 회귀 0(가짜 다리에 `clearDelivered` 한 줄) | `push78.vitest.tsx` | 통과 |

### 76-i 결정 기록 (출처: R110-4 · R111-2~5)

| 결정 | 근거 |
|---|---|
| 숨긴 행 정리 대상 = `data_entries` · `messages`. 숨긴 지 24시간(`deleted_at <= 지금 - 24시간`) 지난 행을 **행째** 삭제. 지울 때 같은 조건을 다시 건다 | R110-4 ② · 위임서 ② |
| `dates`는 대상 밖 - 앱의 되살리기(`ensureDate`) 때문에 멈춤 · PM 선택 | 위임서 멈춤 조건 · R105-1 |
| 순서 = 76-h 해제 정리 -> 76-g 탈퇴(사용자별) -> **76-i 숨긴 행**. 통째로 지울 커플 · 떠난 사람 기록 행은 76-i가 세지 않음 | 위임서 ② |
| 파일은 다루지 않음 - 행이 사라지면 다음 `sweepOrphanFiles`가 받는다(소프트 삭제 행은 이미 "가리키는 행"이 아님, R105-1) | 위임서 ② |
| 실패 = 100행 묶음 단위로 그 수만 "숨긴 행 실패" 줄에 셈(사용자 "실패" 줄과 따로) · 다음 실행 때 다시 | 위임서 ② |
| ④ 서랍 지우기 = 플러그인 기존 `removeAllDeliveredNotifications`(새 패키지 · 네이티브 0). `forgetThisDevicePush` 맨 앞(등록 표시와 상관없이) -> 4자리 자동. 계정 전환은 `purgeOtherUsers`가 다른 사람 저장분을 지웠을 때만(같은 사람의 앱 시작에는 서랍을 건드리지 않음) -> 그다음 `push_claim_device` | R111-2 |
| ⑤ 앞에서 받은 `date` · `nickname` 알림 -> `coupleStore.refresh`(화면 + 기기 저장값). 읽는 중에 또 오면 끝난 뒤 한 번 더(최대 2회). 띠는 그대로 | R111-3 |
| ⑥ 알림 건강 확인은 `net._http_response`가 아니라 로그(보존 6시간 실측) | R111-5 · 사실 확인 |

### 바뀐 미리 보기 출력 줄 (숫자 자리만)

```
… (76-h까지 그대로)
떠난 사람의 장소: n
빈 날 정리: n
숨긴 행 정리: n                    <- 76-i 새 줄(합)
숨긴 행 정리 data_entries: n       <- 76-i
숨긴 행 정리 messages: n           <- 76-i
실제로 지우려면 --apply
```

적용(`--apply`)일 때 끝에 `숨긴 행 지움: n` · `숨긴 행 실패(다음 실행 때 다시): n` 두 줄이 더해진다. 마지막 줄은 실패가 있으면 `완료(실패한 것은 다음 실행 때 다시)`.

다음 월요일 운영에서 달라지는 점: 명령은 76-f 절 그대로. **첫 실행은 미리 보기 숫자(숨긴 행 정리 3줄)를 PE에 보내고 확인 뒤 적용**(행 삭제는 되돌릴 수 없음 - 76-f 첫 실행과 같은 규칙). 그 뒤 `sweepOrphanFiles`가 지운 사진의 남은 파일을 받는다(이미 지워졌다면 0). 그리고 8번 알림 건강 확인 한 줄(76-f 월요일 운영 절).

### 76-i 커밋 명령 (Proteur, 맨 위 폴더에서 · 한 줄씩)

1) 운영 스크립트 - 숨긴 행 정리

```
git add scripts/ops/purgeWithdrawn.ts
git add scripts/ops/purgeWithdrawn.test.ts
git add __tests__/db/hiddenRows76i.test.ts
git commit -m "76-i ops: hard-delete rows hidden for over 24 hours in the Monday purge"
```

2) 앱 - 서랍 알림 지우기 · 변경 안내 뒤 새로 읽기

```
git add web/src/push/pushPort.ts
git add web/src/push/pushCore.ts
git add web/src/push/usePushSetup.ts
git add web/src/app/useAccountData.ts
git add web/src/cache/deviceCache.ts
git add web/src/push/push76i.vitest.tsx
git add web/src/push/push78.vitest.tsx
git commit -m "76-i web: clear delivered notifications on sign-out and account changes, refresh couple on change notices"
```

3) 상태 파일

```
git add .claude/state/HANDOFF.md
git add .claude/state/PROGRESS.md
git commit -m "76-i state: handoff, progress, restore 78 handoff section, ops rules"
```

### HANDOFF 복구 (알림)

직전 커밋 `b49c64c`에서 HANDOFF의 **`78-` 절 전체(222줄)가 빠지고** 그 자리에 `cd "…"` 한 줄이 들어가 있었다. 같은 커밋에서 허용 목록 경로 한 줄의 `\r`이 줄바꿈으로 바뀌어 두 줄로 깨져 있었다. `6e10c83`의 내용으로 되살리고(`cd` 줄은 뺌) 깨진 줄을 고쳤다 - 되살린 뒤 내용이 `6e10c83`과 글자 단위로 같았다(줄 끝만 지금 커밋 그대로 LF). ⑥이 가리키는 "78- 3번 명령"이 그 절에 있다.

### Proteur 다음 순서

1. 커밋(위 1 · 2 · 3). db push 없음 · 함수 배포 없음
2. 빌드 · 덮어 설치: `cd web` -> `npm run build:trial` -> `npx cap sync android`(메인 세션이 이미 한 번 돌림 - 그 뒤 코드 변경 0) -> Android Studio 빌드 -> 두 폰 덮어 설치(데이터 유지)
3. 폰 확인(녹화 · 방해 금지 + 온도록만 예외):
   - 서랍에 온도록 알림이 있는 채로 로그아웃 -> **서랍에 온도록 0**(다른 앱 알림은 그대로)
   - A가 메인을 보는 중 B가 사귄 날짜 변경 -> 띠와 함께 **메인 D+가 바로 바뀜**(설정에 가지 않고) · 닉네임 변경 -> 커플 이름 바로 바뀜
   - 78- 남은 1분 확인 4개: A가 홈(앱 뒤)일 때 B가 날짜 · 닉네임 변경 -> 서랍 알림 -> 누르면 메인 -> 안내 1회 / V40이 받는 쪽 / 설정 "변경 안내 끔" -> 변경 알림 0 / 방해 금지 예외 목록에 온도록이 보이는지
4. 다음 월요일(11/23): 76-f 월요일 운영 - 미리 보기의 "숨긴 행 정리" 3줄을 PE에 보내고 확인 뒤 적용 · 8번 알림 건강 확인(11/16의 503 22건이 보이면 7일 보존 확인)
5. PM: 위 "멈춘 것"의 `dates` (가) · (나) · (다)

## `78-` 푸시 알림(Android) + 닉네임 변경 안내 + 처리방침 v1.2 + R108 남은 것 (메인 세션, 2026-11-16, 위임문 `78-dispatch-push.md` · 근거 `78-pm-report-before-dispatch.md` · `PM_legal_minimal_v1.md` v1.2 · R100-4 · R101-5 · R108-2 · R108-3 · R109-1~3) - 완료 (미커밋)

범위: `supabase/migrations/` 새 파일 1(`78-m1`) · `supabase/functions/` 새 함수 1(`push-send`) + `_shared/pushSend.ts` · `__tests__/db/` · `web/`(앱 · `web/android/` 매니페스트 · 알림 아이콘만) · `.gitignore` · HANDOFF · PROGRESS. 새 패키지 `@capacitor/push-notifications@8.1.3` 하나(package.json 한 줄 · lock은 그 패키지만). `consent.ts`는 v1.2 반영만(R109-3 허가). 위임 0(메인 세션 직접). 원격 0 · db push 0 · 함수 배포 0 · 비밀 설정 0 · 커밋 0. `demo_responses` 0 · R34-3 0 · 렌더 0 · RN 0. `web/android/app/build.gradle`은 **변경 0**(Capacitor 템플릿에 `google-services.json`이 있을 때만 플러그인을 적용하는 `try` 블록과 루트 classpath가 이미 있었다). `capacitor.build.gradle` · `capacitor.settings.gradle`은 `cap sync`가 새 플러그인을 등록하며 다시 만든 것(손수정 0). `scripts/ops/` 시험 발송 스크립트는 만들지 않음(폰 확인으로 충분).

검증: web tsc 0 · Vitest 59/961 → **60/986** + 1 건너뜀 · `LEGAL_CHECK=1` 법무 관문 7/7 → **8/8**(v1.2 원본 대조 1건 추가) · `build` · `build:trial` · `cap sync android`(맨 끝 한 번 · `google-services.json` 없이 통과) · 루트 tsc 0 · jest 112/1924 → **114/1951** · PGlite 7/94 → **8/110** · 함수 tsc(`-p supabase/functions/tsconfig.json`) 0 · `deno check` `push-send/index.ts` 통과 · Deno 초기화 시험 28/28 · Python(PROGRESS 줄). 키 · 주소 · ref · id · 이메일 · 토큰 0 · 파일 이름 ASCII · `google-services.json` 추적 0(`.gitignore`).

### 멈춘 것

없음. 판단으로 좁힌 것 하나: **H10 "폰 설정에서 켜기"의 이동** - 앱의 알림 설정 화면을 바로 여는 것은 네이티브 코드(인텐트)가 필요해 허가(아이콘 · 채널 · 권한 · google-services) 밖이다. 대신 권한 창을 다시 띄워 보고(Android가 다시 물을 수 있을 때), 그래도 꺼져 있으면 "폰 설정 > 애플리케이션 > 온도록 > 알림에서 켜 주세요" 글을 보인다. 바로 이동이 필요하면 PM 결정(네이티브 몇 줄 또는 플러그인 하나).

### 0단계

- **R108-2 결과: 막히지 않음.** `__tests__/db/departedPlaces76h.test.ts`에 1건 - 그날(그 장소)을 가리키는 소프트 삭제된 사진 · 메모(남은 사람 것)가 있는 빈 날을 지워도 외래 키(`data_entries.date_id` · `date_stop_id` = set null)에 막히지 않고, 숨겨진 행은 날짜 · 장소 칸만 비워진 채 남는다. 스크립트 수정 0.
- **R108-3**: PROGRESS에 첫 정기 정리 한 줄(경로 · id 0).
- **설계 메모**
  - 토큰 저장: `push_tokens`(사람 · 앱이 만든 기기 id · 토큰 · android/ios · 마지막 확인 시각). 본인만 읽기 · 지우기(RLS), 쓰기는 `push_register` RPC만(같은 토큰 · 같은 기기의 다른 사람 행 정리 = 계정 전환). 사람 삭제 cascade. 설정은 별도 표 `notification_settings`(본인만 - profiles 칸에 두면 상대가 읽을 수 있어서). 행 없음 = 둘 다 켬.
  - 발송 트리거: `messages` AFTER INSERT · `couples` AFTER UPDATE(이미 있던 날짜 · 닉네임이 바뀔 때만) -> `push_enqueue` -> `push_recipient`(active 커플의 상대 · 탈퇴 유예 아님 · 그 알림 켬) + 토큰 있음 -> `net.http_post`(Vault의 `ondolog_push_url` · `ondolog_push_secret`). 넘기는 것은 종류 · 커플 · 보낸 사람 · 사진 여부뿐(원문 0). 어떤 오류도 메시지 저장을 막지 않는다(예외 삼킴). 앱이 직접 발송을 부르는 길 0.
  - 함수 인증: `--no-verify-jwt` 배포 + 비밀 헤더 `x-ondolog-push`. 헤더가 없으면 401, 있으면 `push_context(비밀, …)`(service_role 전용 RPC)가 Vault 값과 대조 -> 다르면 401. 앱 키(publishable · 사용자 JWT)로 불러도 헤더가 없거나 틀려 거부. 비밀은 DB 안에서 무작위로 만들어 화면 · 파일에 나오지 않는다. 함수의 DB 접근은 전용 secret key(`push_2026_11` 제안, 함수 비밀 `ONDOLOG_PUSH_DB_KEY`) - legacy service_role이 꺼져 있어(74-k2) 플랫폼 기본 값에 기대지 않는다.
  - **iOS 확장 지점**: 서버는 그대로(FCM V1이 APNs로 보냄 - 메시지에 `apns-collapse-id` · `thread-id` = 같은 태그를 이미 싣는다). 더 필요한 것: APNs 인증 키(.p8)를 Firebase에 등록 + iOS 앱을 Firebase에 등록(`GoogleService-Info.plist`) + Xcode Push Notifications capability + `AppDelegate` 두 메서드(플러그인 README) + iOS 권한 창(같은 I08 흐름). 앱 코드는 `pushPort.platform = 'ios'`로 이미 갈라 둠 · 채널 만들기는 Android만. **즉 "APNs 키 등록만"으로는 부족하고 iOS 빌드 쪽 설정이 더 든다.**

### 항목별 표

| # | 고친 곳 | 시험 | 폰에서만 확인되는 것 |
|---|---|---|---|
| 서버 m1 | `supabase/migrations/20261116180000_m1_push_notify.sql` - pg_net(있을 때만 켬) · `push_tokens` · `notification_settings` · `couples.nickname_changed_by`(트리거만 채움 · set null) · `push_recipient` · `push_enqueue` · 트리거 2 · `push_context` · `push_drop_token` · `push_register` · `push_claim_device` · 실행 권한 | `__tests__/db/pushNotify78m1.test.ts` 15건(pg_net · Vault는 시험 안 스텁): 본인 토큰만 · 직접 쓰기 거부 · 상대 토큰 읽기 0 · 토큰 갱신 · 계정 전환 이동 · claim · 사람 삭제 -> 토큰 · 설정 0 · 메시지 -> 호출 1 · 원문 0 · 사진 · 설정 끔 0 · 유예 · 해제 · 탈퇴 유예 0 · Vault 없음 0 · pg_net 실패해도 저장 · 처음 정하기 0 · 변경 -> 상대에게만 · 바꾼 사람 칸 · 앱 직접 쓰기 거부 · RPC 비밀 대조 · 앱 역할 실행 거부. `withdrawalPurge76g` 외래 키 표에 새 칸 3줄 | 원격 pg_net · Vault 실제 호출 |
| 함수 | `supabase/functions/push-send/index.ts`(연결만) · `_shared/pushSend.ts`(판단 전부) | `_shared/pushSend.test.ts` 11건(가짜 FCM): 본문 4문장 · 원문 · 새 값 0 · 사진 · 누름 경로 · **연속 3건 태그 · collapse key 같음 · 변경 안내 태그 다름 · 채널 다름** · 401(헤더 없음 · 앱 키 · 틀린 비밀) · 405 · 400 · 받는 사람 없음 0 · 404 · UNREGISTERED · SENDER_ID_MISMATCH -> 행 삭제 / 500 · 400 남김 · 로그에 토큰 · 본문 · 이름 · id · 비밀 0 · RS256 서명 검증 · 접근 토큰 캐시 | 실제 FCM 전달 · 서비스 계정 토큰 발급 |
| I08 | `web/src/push/PushPermissionScreen.tsx` · `usePushSetup.ts` | `push78.vitest.tsx`: 처음 메인 한 번 · 다시 0 · 유예 · 미연결 0 · 처음부터 허용(V40) = 안내 없이 등록 · 허용 · 거부 · 나중에 | S21 OS 권한 창 · V40 바로 등록 |
| 등록 | `push/pushCore.ts`(기기 id · 등록 표시 · RPC) · `pushPort.ts`(플러그인 다리) | 토큰 저장 · 바뀐 토큰 재저장 · 받을 수 없을 때 0 | 토큰이 실제로 서버에 생김 |
| 삭제 5자리 | 로그아웃(`accountActions.logoutToStart`, 세션 지우기 전) · 탈퇴 요청(`WithdrawScreen`) · 해제 요청(`UnlinkScreen`) · 해제 유예/완료(`coupleStore.refresh`의 `clearCoupleCache` 옆) · 계정 전환(`useAccountData`의 `purgeOtherUsers` 옆 -> `push_claim_device`). 서버 행 + FCM `unregister` | 5자리 각각 동작 단언 · 등록한 적 없으면 0 · 두 번 불려도 한 번 | 로그아웃 뒤 알림 0 |
| I07 | `push/PushBand.tsx` · `capacitor.config.ts` `PushNotifications.presentationOptions: []` | 앞에 있을 때 띠 · 누르면 채팅 · 4초 닫힘 · **보고 있는 채팅이면 메시지 띠 0** · 변경 안내는 띠 | 앞에 있을 때 OS 알림이 안 뜨는지 |
| 누름 | `usePushSetup` 3) | 메시지 = 채팅 · 변경 = 메인 · 시작 끝난 뒤 한 번 | 앱이 꺼진 상태 · 뒤에 있는 상태에서 누름 |
| H10 | `features/settings/NotifySettingsScreen.tsx` · `SettingsView.tsx`(NOTIFICATIONS > 알림 - 보드 H02 자리, 루트 `SETTINGS_GROUPS`는 그대로) · 라우트 3(`push-permission` · `settings-notify` · `nickname-recheck`) | 기본 켬 · upsert · 실패 되돌림 · 폰 권한 꺼짐 안내 | - |
| R101-5 | `couple/useNicknameNotice.ts` · `features/couple/NicknameNoticeScreen.tsx` · `App.tsx` | 판정 · 한 번 · 새 값이면 다시 · 화면 문구 · 둘째 줄 값 · 메인으로 | 상대 폰에서 바꾼 뒤 내 폰 |
| 네이티브 | `AndroidManifest.xml`(POST_NOTIFICATIONS · 기본 아이콘 · 기본 채널 meta-data) · `res/drawable/ic_stat_ondolog.xml`(흰 실루엣 벡터) · `.gitignore` | `cap sync` · 빌드(파일 없이 통과) | 알림 아이콘이 흰 네모가 아닌지 |
| v1.2 | `web/src/legal/consent.ts` - 1번 · 4번 표(Google LLC) · 5번 줄 · 시행일 **2026년 11월 16일**(Proteur 답) | `legal.vitest.tsx` 원본 "(v1.2)" 세 줄 대조 + 기존 7 · `push78.vitest.tsx` 문장 = 동작 | 설정 > 개인정보 & 약관 |
| 시험 보조 | `testSupportCouple.ts` delete · upsert · `settings.vitest.tsx`('알림'이 이제 있음) · `settingsFlow.vitest.tsx`(로그인 때 claim RPC가 탈퇴 취소로 오인되지 않게) · `backRules.vitest.ts`(새 라우트 3) | - | - |

### 보드 대조표(H10 · I07 · I08)

| 보드 | 따른 것 | 다른 것 · 이유 |
|---|---|---|
| H10 | ← 알림 머리 · 줄 + 토글 · "채팅" 라벨 | 발행 · 기념일 · CORNERS · 셋로그 시각 줄 뺌(보낼 알림 없음 - R42-5) · "변경 안내" 줄 더함 · 폰 권한 꺼짐 안내 묶음 |
| I07 | 카드 모양(점 아이콘 · "온도록" · 본문 · "지금") | 화면 위 띠 한 장(서랍 목록이 아님) |
| I08 | 미리보기 카드 두 장 · "중요한 순간만 알려드릴게요" · [알림 받기] · [나중에] | 본문 · 카드 문장을 지금 실제로 오는 알림(메시지 · 변경 안내)으로 - 보드의 발행 · 답변 · 기념일은 아직 없음 |

### 78- 결정 기록 (출처: R100-4 · R101-5 · R108-2 · R108-3 · R109-1~3)

| 결정 | 근거 |
|---|---|
| 설정은 profiles 칸이 아니라 본인 전용 표(상대가 내 알림 설정을 읽지 못하게) | R109-1 ① · 본인만 |
| 받는 사람 판정을 트리거와 함수가 같은 SQL 함수(`push_recipient`)로 - 트리거에서 거르고(호출 0) 함수가 다시 확인 | 위임서 "설정 끔 -> 호출 0" + "함수가 확인" |
| 트리거 비밀 = Vault, 함수는 비밀 값을 갖지 않고 DB에 대조를 맡김 - 사람이 값을 두 곳에 넣지 않고, 값이 화면에 나오지 않음 | R109-1 ④ |
| 함수 DB 키 = 전용 secret key(`ONDOLOG_PUSH_DB_KEY`) - legacy service_role 비활성 | 74-k2 |
| 메시지 태그 = `ondolog-m-{커플}` = collapse key, 변경 안내는 `ondolog-c-d-` / `ondolog-c-n-`(날짜 · 닉네임 서로도 따로) | R109-2 |
| 변경 안내는 "이미 있던 값이 바뀔 때"만(온보딩 처음 정하기 0) · 바꾼 사람 = 요청 사용자 | R101-5 · F1 |
| 닉네임 바꾼 사람 칸은 트리거만 채우고 되돌리지 않음(set null이 되돌려지면 외래 키가 깨짐 - 76-g m3 교훈) | 76-g |
| Android 10처럼 처음부터 허용이면 I08을 보이지 않고 바로 등록(물을 것이 없는 안내는 거짓 선택) | 위임서 "V40은 권한 창 없이 바로 등록" |
| 토큰 삭제 = 서버 행 + FCM `unregister` - 오프라인이라 행을 못 지워도 FCM이 UNREGISTERED -> 함수가 행 삭제 | 처리방침 5번 |
| 계정 전환 = 로그인마다 `push_claim_device`(이전 사람이 로그아웃 못 한 기기) | 위임서 삭제 규칙 |
| 알림 채널 가시성 = 잠금 화면에서 내용 숨김(private) - 본문에 상대 이름이 있어서 | 판단 |
| 발송 함수의 HTTP는 주입된 `transport`로만(규칙 C의 LLM 경계 밖 - Google OAuth · FCM) | `cornerPipelineStaticRules` 규칙 C |
| 법무 관문 7 -> 8(v1.2 원본 대조 1건) | R109-3 |

### 78- 커밋 명령 (Proteur, 맨 위 폴더에서 · 한 줄씩)

1) R108-2 시험

```
git add __tests__/db/departedPlaces76h.test.ts
git commit -m "78 R108-2 test: emptied-day delete is not blocked by soft-deleted entries"
```

2) 서버 - 토큰 · 설정 · 트리거

```
git add supabase/migrations/20261116180000_m1_push_notify.sql
git add __tests__/db/pushNotify78m1.test.ts
git add __tests__/db/withdrawalPurge76g.test.ts
git commit -m "78 db: push tokens, notification settings, message and change triggers via pg_net"
```

3) 발송 함수

```
git add supabase/functions/_shared/pushSend.ts
git add supabase/functions/_shared/pushSend.test.ts
git add supabase/functions/push-send/index.ts
git commit -m "78 function: push-send via FCM v1 with collapse tags and dead token cleanup"
```

4) 웹 - 푸시 · H10 · I07 · I08 · 닉네임 안내

```
git add web/package.json
git add web/package-lock.json
git add web/capacitor.config.ts
git add web/android/app/src/main/AndroidManifest.xml
git add web/android/app/src/main/res/drawable/ic_stat_ondolog.xml
git add web/android/app/capacitor.build.gradle
git add web/android/capacitor.settings.gradle
git add web/src/push
git add web/src/couple/useNicknameNotice.ts
git add web/src/features/couple/NicknameNoticeScreen.tsx
git add web/src/features/settings/NotifySettingsScreen.tsx
git add web/src/features/settings/SettingsView.tsx
git add web/src/features/settings/accountActions.ts
git add web/src/features/settings/WithdrawScreen.tsx
git add web/src/features/settings/UnlinkScreen.tsx
git add web/src/features/settings/settings.vitest.tsx
git add web/src/features/settings/settingsFlow.vitest.tsx
git add web/src/stores/coupleStore.ts
git add web/src/app/useAccountData.ts
git add web/src/app/routes.ts
git add web/src/app/routeTable.tsx
git add web/src/app/backRules.ts
git add web/src/app/backRules.vitest.ts
git add web/src/cache/deviceCache.ts
git add web/src/testSupportCouple.ts
git add web/src/styles.css
git add web/src/App.tsx
git add .gitignore
git commit -m "78 web: Android push notifications, notification settings, in-app band, nickname change notice"
```

5) 처리방침 v1.2

```
git add web/src/legal/consent.ts
git add web/src/legal/legal.vitest.tsx
git commit -m "78 legal: privacy policy v1.2 for push tokens, effective 2026-11-16"
```

6) 상태 파일

```
git add .claude/state/HANDOFF.md
git add .claude/state/PROGRESS.md
git commit -m "78 state: handoff and progress"
```

### Proteur 할 일 순서 (맨 위 폴더 · PowerShell · 값 출력 0)

1. **`google-services.json`**: 다운로드 폴더의 파일을 `web\android\app\`에 끌어다 놓는다. 확인:

```
git status --short web/android/app
git check-ignore web/android/app/google-services.json
```

첫 줄은 아무것도 안 나와야 하고, 둘째 줄은 경로 한 줄(무시됨).

2. **db push** (`78-m1` 한 파일)

```
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
npx supabase migration list
```

dry-run에 `20261116180000_m1_push_notify.sql` **하나만** 보여야 한다(76-g 두 파일이 아직 원격에 없다면 그것도 보인다 - 그 경우 76-g 절 순서대로 먼저). 다른 것이 보이면 멈추고 보고. 그 뒤 대시보드 SQL(읽기만): `select extname from pg_extension where extname = 'pg_net';` -> 한 줄. 0줄이면 Database > Extensions에서 pg_net을 켠다.

3. **함수 비밀** - 먼저 대시보드 Settings > API Keys에서 새 secret key `push_2026_11`을 만든다(복사 버튼으로만 옮긴다). 그다음 한 줄씩:

```
$k = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString)).Password
$k.StartsWith('sb_secret_')
$sa = @(Get-ChildItem "$env:USERPROFILE\.ondolog\*.json" | Where-Object { (Get-Content -Raw -LiteralPath $_.FullName) -match '"type"\s*:\s*"service_account"' })
$sa.Count
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($sa[0].FullName))
$f = Join-Path $env:TEMP ("ondolog-push-" + [guid]::NewGuid().ToString('N') + ".env")
Set-Content -LiteralPath $f -Encoding ascii -Value @("ONDOLOG_PUSH_DB_KEY=$k", "ONDOLOG_FCM_SERVICE_ACCOUNT_B64=$b64")
npx supabase secrets set --env-file $f
Remove-Item -LiteralPath $f
Remove-Variable k, b64, sa
npx supabase secrets list
```

둘째 줄 `True`, 넷째 줄 `1`일 때만 계속. 마지막 줄은 이름(`ONDOLOG_PUSH_DB_KEY` · `ONDOLOG_FCM_SERVICE_ACCOUNT_B64`)과 값 대신 digest만.

4. **트리거 비밀 · 함수 주소(Vault)** - 대시보드 SQL Editor에서. 비밀은 DB가 무작위로 만들어 어디에도 보이지 않는다. 주소의 `<ref>`는 대시보드 주소창의 프로젝트 ref를 그 자리에서만 친다(터미널 · 기록에 쓰지 않음):

```
select vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'ondolog_push_secret');
select vault.create_secret('https://<ref>.supabase.co/functions/v1/push-send', 'ondolog_push_url');
select name, length(decrypted_secret) > 0 as filled from vault.decrypted_secrets where name like 'ondolog_push_%';
```

마지막 줄: 두 줄 모두 `true`.

5. **함수 배포**

```
npx supabase functions deploy push-send --no-verify-jwt
```

6. **빌드 · 설치**: `cd web` -> `npm run build:trial` -> `npx cap sync android`(메인 세션이 맨 끝에 한 번 돌림 - `google-services.json`을 넣은 뒤라면 한 번 더) -> Android Studio 빌드 -> 두 폰 덮어 설치(데이터 유지).

7. 끝나면 PowerShell 창을 닫고, 새 창에서 `[bool]$k` -> `False`.

함수 로그(대시보드 Edge Functions > push-send > Logs)에는 `push-send status=200 sent=1 dropped=0 failed=0` 꼴만 보여야 한다. `status=503 config`면 3번 비밀, `status=401`이면 4번 Vault 비밀이 없거나 두 번 만들어진 것 - 보고.

### 폰 확인 순서

1. 새 계정 첫 가입은 R79-3 ①이 가능하면 함께(v1.2 문장으로 가입)
2. 연결 뒤 첫 메인 -> I08 -> S21 [알림 받기] -> 허용 / (다른 계정이면) 거부. V40은 I08 없이 바로 등록되는지
3. 상대 폰에서 메시지: 앱 꺼진 상태 · 뒤에 있는 상태(서랍 알림) · 앞에 있는 상태(위쪽 띠, OS 알림 0)
4. 메시지 5건 연달아 -> 알림 서랍에 하나(본문은 마지막 것)(R109-2)
5. 설정 > 개인정보 & 약관 -> 처리방침에 알림 토큰 줄 · Google LLC 행 · 5번 토큰 줄 · 시행일 2026년 11월 16일
6. 그 채팅을 보고 있을 때 메시지 -> 띠 0 · 알림 0
7. 알림 누름: 메시지 -> 채팅 탭 · 변경 안내 -> 메인(이어 F1 · 닉네임 안내)
8. 설정 > 알림 -> 채팅 끔 -> 메시지 알림 0 / 변경 안내 끔 -> 변경 알림 0
9. 상대가 닉네임 · 날짜 변경 -> 알림 + 앱 안 안내 한 번(내가 바꾼 것은 0)
10. 로그아웃 -> 상대가 메시지 -> 알림 0

### 다음

| 항목 | 다음 |
|---|---|
| iOS(실제 커플) | PM 결정 - 빌드 · 서명 · TestFlight · APNs · 카카오 iOS · 51- iOS 한 바퀴. 푸시는 위 "iOS 확장 지점" |
| 매거진 발행 알림 | 렌더 수정 필요 - 다음 |
| 알림 조용한 시간 | 실제 커플 사용 뒤 |
| H10 폰 설정 바로 열기 | PM 결정(네이티브 허가) |

## `76-h` 떠난 사람이 남긴 장소 지우기 (메인 세션, 2026-11-16, 위임문 `76-h-dispatch-departed-places.md` · 근거 `76-g-pm-report.md` §5 · R106-1~4) - 완료 (미커밋)

범위: `scripts/ops/purgeWithdrawn.ts` + 시험 · `__tests__/db/` 시험 1 · HANDOFF(월요일 운영 한 줄 포함) · PROGRESS. **마이그레이션 0 · 030 수정 0 · `web/` 0**(빌드 불필요) · `sweepOrphanFiles.ts` 변경 0 · 새 패키지 0 · `demo_responses` 0 · R34-3 함수 호출 0 · 원격 0 · 스크립트 실행 0. 위임 0(메인 세션 직접).

검증: 루트 tsc 0 · jest 111/1912 → **112/1924** · PGlite 6/90 → **7/94** · Deno 초기화 시험 28/28 · `deno check` 스크립트 2개. 키 · 주소 · ref · id · 이메일 · 경로 0 · 파일 이름 ASCII.

### 멈춘 것

없음. 장소 작성자는 m3 작성자 칸(`date_stops.author_id`)만으로 가른다 - 다른 근거 불필요.

### ②를 넣은 곳 · ③ 데이트 행 테이블

- **② 해제 정리 = `purgeWithdrawn.ts`의 "해제된 커플 정리" 단계**(권고 그대로). 행을 지우는 규칙이라 파일만 다루는 `sweepOrphanFiles`에 넣지 않았다. 매주 월요일 같은 명령에서 돈다.
  - **탈퇴 단계보다 먼저** 돈다: 요청자가 같은 실행에서 탈퇴 최종 삭제되면 m1이 작성자 칸을 비워 더는 가를 수 없어서.
  - 대상 = `couple_dissolutions.initiated_by`(실제 칸 이름 확인) - 실행됨(`executed_at` 있음) · 취소 안 됨 · 칸이 비지 않음 + 그 커플 `status = 'dissolved'`.
- **③ 데이트 행 = `public.dates`**(006). 그 사람 것을 빼고 그날 남은 것(`date_stops` - 작성자 빈 옛 장소 포함 · 지우지 않은 `data_entries`, 두 사람 모두)이 0이면 그 `dates` 행을 지운다(행 삭제 - `date_stops` cascade · 소프트 삭제된 기록의 `date_id`는 비워짐). 하나라도 남으면 유지.

### 시험 표

| 시험 | 어디 | 결과 |
|---|---|---|
| 떠난 사람(탈퇴) 장소만 지움 · 남은 사람 장소 · 사진 · 메모 0건 영향 | `purgeWithdrawn.test.ts` · `departedPlaces76h.test.ts` | 통과 |
| 해제: 요청자 장소만 · 요청받은 사람 장소 남음 · 해제 실행 전(유예 중) · 취소된 해제 0건 | 둘 다 | 통과 |
| 빈 날: 남은 것 0 -> 그날 행 정리 / 남은 것 있음 -> 유지(옛 장소 · 상대 사진도 "남은 것") | 둘 다 | 통과 |
| 작성자 null 장소 0건 | 둘 다 | 통과 |
| 탈퇴 순서: 장소 -> 빈 날 -> 로그인 계정 · 계정 삭제가 장소 때문에 막히지 않음 | 둘 다 | 통과 |
| 해제 정리가 탈퇴 단계보다 먼저 · 같은 장소를 두 번 세지 않음 | `purgeWithdrawn.test.ts` | 통과 |
| 해제 실행 대기 커플은 장소도 0건 | `purgeWithdrawn.test.ts` | 통과 |
| 미리 보기 삭제 0 · 출력 숫자만 · R34-3 · `demo_responses` 0 | `purgeWithdrawn.test.ts` | 통과 |
| 다시 돌려도 같은 결과(멱등) | 둘 다 | 통과 |
| 76-g 시험 회귀 0 | `purgeWithdrawn.test.ts` · `withdrawalPurge76g.test.ts` | 통과 |

### 76-h 결정 기록 (출처: R106-1~4)

| 결정 | 근거 |
|---|---|
| ② 해제 정리는 `purgeWithdrawn`의 첫 단계 - 행을 지우는 규칙(파일 스크립트와 나눔) · 같은 월요일 명령 | R106-2 · 위임서 권고 |
| 해제 정리를 탈퇴 단계보다 먼저 - 요청자가 같은 실행에서 지워지면 작성자 칸이 비어 가를 수 없음. 같은 (사람, 커플)을 두 단계가 함께 맡으면 해제 정리만 센다 | 시험으로 확인 |
| 탈퇴 ①은 상대가 남은 커플(해제 끝남)에서만 - 통째로 지울 커플은 커플 행 cascade로 장소 · 날짜가 함께 지워짐. "해제 실행 대기" 규칙 그대로 | R106-2 · 76-g |
| 빈 날 판정에는 작성자 빈 옛 장소도 "남은 것"(④ 0건 영향) · 소프트 삭제된 기록은 남은 것이 아님(76-f 해석과 같음) | R106-2 ③ ④ · R105-1 |
| 빈 날은 `dates` 행 **삭제**(76-d의 소프트 삭제가 아님) - 떠난 사람만 남긴 날이라 되살릴 사람이 없고, 처리방침 "지웁니다"와 맞춤 | R106-2 |
| 해제 정리의 실패는 "실패" 숫자에 함께 셈 · 다음 실행 때 다시(멱등) | 76-f 규칙 |

### 바뀐 미리 보기 출력 줄 (숫자 자리만)

```
미리 보기(지우지 않음): 탈퇴 최종 삭제
유예 끝난 사용자: n
처리 대상: n
해제 실행 대기(다음 실행 때): n
상대가 남은 커플(커플 · 호 · 상대 기록 남김): n
couples: n
… (표마다 한 줄 - 76-g와 같음)
떠난 사람 data_entries(상대가 남은 커플): n
떠난 사람 messages(상대가 남은 커플): n
떠난 사람 stories(상대가 남은 커플): n
auth 사용자: n
Storage: n
매거진 파일(magazine · magazine-print): n
떠난 사람의 장소: n        <- 76-h 새 줄(해제 정리 + 탈퇴 합)
빈 날 정리: n              <- 76-h 새 줄
실제로 지우려면 --apply
```

### 76-h 커밋 명령 (Proteur, 맨 위 폴더에서 · 한 줄씩)

1) 운영 스크립트 - 떠난 사람이 남긴 장소

```
git add scripts/ops/purgeWithdrawn.ts
git add scripts/ops/purgeWithdrawn.test.ts
git add __tests__/db/departedPlaces76h.test.ts
git commit -m "76-h ops: delete places left by withdrawn users and dissolution initiators, clean up emptied days"
```

2) 상태 파일

```
git add .claude/state/HANDOFF.md
git add .claude/state/PROGRESS.md
git commit -m "76-h state: handoff and progress"
```

### Proteur 다음 순서

1. 커밋(위 1 · 2). db push 없음 · 빌드 없음
2. 월요일 운영은 76-f 절 명령 그대로(`purgeWithdrawn` -> `sweepOrphanFiles`, 미리 보기 -> 적용). 미리 보기에 "떠난 사람의 장소" · "빈 날 정리" 두 줄이 더해짐
3. **운영 신호(R106-4)**: "해제 실행 대기" 숫자가 **두 주 연속 줄지 않으면** PE에 알림(매일 해제 실행 일정이 멈췄다는 신호) - 76-f 월요일 운영 절에도 한 줄 넣음

## `76-g` 탈퇴 최종 삭제 완성 · 잡지 파일 정리 · 앱 즉시 파일 삭제 (메인 세션, 2026-11-16, 위임문 `76-g-dispatch-withdrawal-purge.md` · 근거 `76-f-pm-report.md` · R105-1~6) - 완료 (미커밋)

범위: `supabase/migrations/` 새 파일 2개(사전 허가) · `__tests__/db/` 시험 1 · `scripts/ops/`(`sweepOrphanFiles.ts` · `purgeWithdrawn.ts` + 시험) · `web/src/`(앱 즉시 삭제) · HANDOFF(옛 `$al` 줄 포함) · PROGRESS. 위임 0(메인 세션 직접). 새 패키지 0 · 네이티브 · RN 0 · `consent.ts` 0 · `demo_responses` 0 · R34-3 함수 호출 0 · **030 본문 수정 0** · 렌더(`supabase/functions/` · `render/`) 수정 0 · 원격 0 · 스크립트 실행 0.

검증: web tsc 0 · Vitest 58/953 → **59/961** + 1 건너뜀 · `LEGAL_CHECK=1` 법무 관문 7/7 · `build` · `build:trial` · `cap sync android`(맨 끝 한 번) · 루트 tsc 0 · jest 110/1898 → **111/1912** · PGlite 5/80 → **6/90** · Deno 초기화 시험 28/28 · `deno check` 스크립트 2개 · Python(PROGRESS 줄). 키 · 주소 · ref · id · 이메일 · 경로 0 · 파일 이름 ASCII.

### 멈춘 것

없음. ④ 번짐 기준(앱 고칠 파일 10개 초과 · 렌더 수정 · 030 본문 수정) 어디에도 걸리지 않음 - P2 앱 수정 0 · 렌더 0 · 030 0. 다만 m1 안에서 **막는 곳 둘을 더 찾아 같은 원칙으로** 고쳤다(아래 ① 끝 두 줄 · PGlite 시험으로 찾음).

### ① 외래 키 표 (`profiles` · `auth.users`를 가리키는 것 전부, 마이그레이션에서)

| 테이블.칸 | 가리키는 곳 | 지금 on delete | 비움 허용? | 탈퇴 최종 삭제를 막는가 | 바꿀 동작(76-g-m1) |
|---|---|---|---|---|---|
| `profiles.id` | auth.users | cascade | - | 아니오 | 그대로(인증 사용자 삭제 -> 프로필 삭제) |
| `personality_assessments.user_id`(재검사 행 포함) | profiles | cascade | 아니오 | 아니오 | 그대로(따라 지워짐) |
| `personality_profiles.user_id` | profiles | cascade | 아니오 | 아니오 | 그대로 |
| `stat_snapshots.user_id` | profiles | cascade | 아니오 | 아니오 | 그대로 |
| **`couples.user_a_id`** | profiles | **restrict** | **아니오(not null)** | **예** | **null 허용 · set null** |
| **`couples.user_b_id`** | profiles | **restrict** | 예 | **예** | **set null** |
| **`couples.start_date_set_by`** | profiles | **no action** | 예 | **예** | **set null** |
| **`couples.start_date_confirmed_by`** | profiles | **no action** | 예 | **예** | **set null** |
| **`couple_dissolutions.initiated_by`** | profiles | **no action** | **아니오(not null)** | **예** | **null 허용 · set null** |
| `data_entries.author_id` | profiles | restrict | 아니오 | 예(행이 남으면) | **그대로** - 떠난 사람의 기록 행은 지운다: 요청자 것은 030, 그 밖은 `purgeWithdrawn`이 인증 삭제 **전에** 지움. restrict는 빠뜨린 행이 있으면 계정 삭제를 막는 안전망 |
| `messages.sender_id` | profiles | restrict | 아니오 | 예(행이 남으면) | 그대로(위와 같음) |
| `stories.author_id` | profiles | restrict | 아니오 | 예(행이 남으면) | 그대로(위와 같음) |
| `date_stops.author_id`(76-m3) | profiles | set null | 예 | 아니오 | 그대로 - 떠난 사람의 장소는 "옛 장소"로 남음(작성자만 비움) |
| `issues` · `corners` · `dates` | (사람 칸 없음, couples만) | - | - | 아니오 | - |
| (검사) **`couples.chk_start_date_owner`** "사귄 날짜가 있으면 정한 사람이 있다" | - | - | - | **예**(정한 사람이 비면 위반) | **해제 끝난(dissolved) 커플에서만** 비어도 됨. 연결 · 유예 중에는 그대로 걸림 |
| (트리거) **76-m3 `tg_date_stops_author`** UPDATE 때 작성자를 원래 값으로 되돌림 | - | - | - | **예**(set null이 되돌려져 지워진 사람을 가리키는 값이 남음) | **가리키던 프로필이 이미 없을 때만** 비움 허용. 앱이 살아 있는 사람의 작성자를 바꾸는 길은 그대로 막힘 |

저장소(`storage.objects.owner`)는 Supabase 관리 칸이라 마이그레이션 밖 - 떠난 사람이 올린 파일이 남아 있으면 인증 사용자 삭제가 거부될 수 있어 `purgeWithdrawn`이 먼저 지운다(아래 ③).

### ② 견딤 표 (두 사람 칸이 빈 커플 = 해제가 끝난 커플)

칸이 비는 커플은 **status `dissolved`뿐**이다: `purgeWithdrawn`은 상대가 남은 커플이 아직 해제 실행 전이면 기다린다(③).

| 곳 | 결과 | 근거 |
|---|---|---|
| 앱 메인 · 채팅 · 피드 · 하늘 · 설정 · 매거진 | **그대로 됨** | 앱은 `pending` · `active` · `dissolving` 커플만 읽는다(`coupleStore` · `coupleApi` · `dissolutionCore`는 `executed_at is null`만). 해제 끝난 커플은 이미 "혼자" 화면 - 상대 이름 자리가 없다 |
| `issues_public` | 그대로 됨 | 사람 칸을 읽지 않고 `is_couple_member`로만 거른다 |
| 권한 도우미(011) `is_couple_member` · `current_couple_id` · `partner_id` | 그대로 됨 | `status <> 'dissolved'` 조건 - 해제 끝난 커플은 이미 거짓 · null 비교는 거짓 |
| `fn_connect_couple`(026 · 75-m1) | 그대로 됨 | `pending` · `user_b_id is null` 초대만 본다. 혼자 초대 행은 탈퇴 최종 삭제가 통째로 지운다(칸이 비지 않음) |
| 탈퇴 · 해제 요청 함수(027) | 그대로 됨 | `active`만 본다 |
| 해제 실행(030) | 그대로 됨(**본문 수정 0**) | 칸을 비우는 것은 실행이 끝난 뒤뿐(③ 대기 규칙). 실행 전에 비웠다면 "상대 없음 = 둘 다 떠남"으로 읽어 남은 사람 기록까지 지울 수 있어 그 순서를 스크립트가 막는다 |
| 렌더(`render/render_issue.py` · `supabase/functions/`) | 그대로 됨(읽기만 확인) | 렌더는 발행 전 · 시험 커플(`test` 표시)에만 돈다. 입력 조립(`inputAssembly.ts`)은 사람 칸을 읽지 않는다 |
| 커플 정책(012) `couples_update`의 `user_b_id is null and status = 'pending'` | 그대로 됨 | 해제 끝난 커플은 `pending`이 아니다 |

상대 이름 자리에 새 문구는 필요 없음(PM 확인 0).

### ③ 항목별 표

| # | 고친 곳 | 시험 | 폰 · 원격에서만 확인되는 것 |
|---|---|---|---|
| P2 m1 | `supabase/migrations/20261116170000_g1_member_set_null.sql` - ① 표 굵은 줄 다섯 칸 + 검사 하나 + m3 트리거 하나 | `__tests__/db/withdrawalPurge76g.test.ts`: 외래 키 표 그대로 · 기록 행이 남으면 계정 삭제 막힘(안전망) · 상대가 남은 탈퇴자 최종 삭제 -> 인증 · 프로필 · 성격 결과(재검사 행) · 기록 · 메시지 0 · 장소는 작성자만 비움 · 남은 사람 커플 행(떠난 칸만 비움) · 발행된 호 · 자기 기록 · 장소 · 메시지 그대로 · 남은 사람 = 해제 완료 상태 · 나중에 남은 사람도 떠나면 커플 · 호까지 · 검사는 연결 커플에 그대로 · 둘 다 떠난 경우 회귀 0 | - |
| P2 스크립트 | `scripts/ops/purgeWithdrawn.ts`: "보류" 없앰. 상대가 남은 커플(해제 끝남)은 남기고 **떠난 사람 기록의 파일 · 그 커플의 남은 파일(24시간 지남) · avatars -> 떠난 사람 기록 행 -> 인증 사용자**. 상대가 남은 커플이 아직 해제 실행 전이면 "해제 실행 대기"(다음 실행 때) | `purgeWithdrawn.test.ts`: "보류" 0 · 순서 · 커플 · 호 · 상대 기록 · 커플 파일 그대로 · 해제 실행 전 대기 · 상대 유예 중 = 남음 · 중간 실패 뒤 재실행 · 둘 다 떠남 회귀 0 · 출력 숫자만 | 인증 사용자 삭제가 저장소 소유 파일 때문에 거부되지 않는지(실패 수로 보임 - 다음 실행 때 다시) |
| P3 | `scripts/ops/sweepOrphanFiles.ts`: `magazine` · `magazine-print`는 **그 커플(첫 폴더)에 호 행이 하나도 없을 때만** 남은 파일(24시간 · 시각 모름 건너뜀). 그 밖 버킷 규칙 그대로 | `sweepOrphanFiles.test.ts`: 호 행 있는 커플 0건 · 둘 다 떠난 커플만 · 24시간 · 미리 보기 삭제 0 · 다른 버킷 회귀 0 · 여섯 밖 버킷 거부 | 첫 미리 보기의 magazine 숫자(지금 시험 호가 있는 커플은 0이어야 함) |
| P1 m2 | `supabase/migrations/20261116170100_g2_storage_own_delete.sql` - `storage.objects` 삭제 정책: `entries` · `messages` · `stories` + 올린 사람 본인(`owner = auth.uid()`) + 같은 커플 경로 | PGlite: 본인 파일 3버킷 지움 · 상대 파일 0 · 매거진 0 · avatars 0 · 비로그인 0 | 실제 저장소가 `owner`를 업로더로 채우는지(폰 확인 아래) |
| P1 앱 | `web/src/features/feed/fileDelete.ts`(지우기 · 기기 대기열 · 다시 지우기) · `DateDetailScreen.tsx`(사진 하나) · `tabs/FeedTab.tsx`(하루 - 지우기 전에 내 경로를 읽어 둠) · `App.tsx`(앱 시작 · 복귀 · 다시 연결 때 대기열) · `feedTestSupport.ts`(가짜 저장소 지우기) | `fileDelete76g.vitest.tsx` 8건: 성공 -> 호출 1 · 실패 -> 대기열 -> 재시도 · 대기열 지우는 때 3가지 · 사진 하나 성공 1 / 행 실패 0 · 하루 지우기 내 파일만(상대 0) / RPC 실패 0 / 파일 실패 -> 대기열 | 사진 하나 지우기 -> 다음 미리 보기에서 그 파일이 "남은 파일"로 잡히지 않음 |
| 4단계 | HANDOFF 74-0 절 명령 2-1 `$al` 줄(경로 속 `\r`이 줄바꿈 문자로 깨짐) -> 바른 경로 | - | - |

### 76-g 결정 기록 (출처: R105-1~6)

| 결정 | 근거 |
|---|---|
| 기록 칸(`data_entries` · `messages` · `stories`의 작성자)은 restrict 그대로 - "비움"이 아니라 행을 지운다(처리방침 "올린 기록을 지웁니다"). 비움으로 바꾸면 작성자 없는 기록을 앱이 다뤄야 해 번짐 | R105-2 ① 원칙 · ④ |
| m1에 검사 하나(`chk_start_date_owner`)와 m3 트리거 하나를 더 넣음 - 둘 다 "떠난 사람 칸 비움"을 막던 곳(PGlite 시험으로 찾음). 같은 마이그레이션 · 같은 원칙(지시 ①) | R105-2 ① |
| 상대가 남은 커플이 해제 실행 전(`dissolving` 등)이면 탈퇴 최종 삭제는 **기다린다** - 030이 칸 빈 커플을 "둘 다 떠남"으로 읽어 남은 사람 기록까지 지우지 않게(030 본문 수정 0). 탈퇴 요청이 같은 7일 해제를 만들어 보통 같은 날 풀림 | R105-2 · 030 0 |
| 떠난 사람이 올린 파일: 그 사람 기록 행이 가리키는 파일(`data_entries` 경로는 아카이브된 스토리면 stories 버킷이라 두 곳) + 그 커플 접두의 남은 파일(24시간 지남, 030이 행만 지운 것) + avatars 접두를 **인증 삭제 전에** 지움 - 저장소 소유 파일이 남으면 인증 삭제가 거부될 수 있어서. 상대 파일은 행이 살아 있어 남음 | R105-2 ③ |
| 떠난 사람의 장소(`date_stops`)는 지우지 않고 작성자만 비움(m3 설계 그대로) - 남은 사람의 그날 기록이 장소를 잃지 않게 | m3 |
| P3: 매거진 두 버킷은 "그 커플에 호 행이 하나도 없음"으로 판정(경로 첫 폴더 = 커플, `magazineMediaPath` · 렌더 저장 경로). 행 경로 규칙과 섞지 않음 | R105-3 |
| P1 m2: `owner = auth.uid()`(storage.objects의 업로더 칸 - PGlite 스텁에 있는 칸). 대상 = 앱이 올리는 세 버킷. avatars는 웹 앱이 올리지 않아 제외 | R105-4 |
| P1 앱: 사진 하나 = `deleteOwnEntry`가 true(이번에 지움)일 때만 그 사진 경로를 지움 · 하루 = RPC 전에 내 항목 경로를 읽어 두고 RPC 성공 뒤 지움(m3 수정 · 새 마이그레이션 0). 경로 읽기가 실패해도 행 삭제는 하고 파일은 월요일 정리가 받음 | R105-4 |
| 파일 지우기 대기열 = 기기 저장 `feed` 범주 scope `trash`(새 범주 0). **로그아웃 · 탈퇴 요청 · 해제 요청 · 해제 완료 · 계정 전환 때 지워짐** - 남은 파일은 행이 이미 지워져 있어 월요일 정리가 받음. 계정이 바뀐 사이에 끝난 재시도는 쓰지 않음 | R105-4 |
| 저장소 API는 권한 밖 파일을 오류 없이 0건으로 끝낸다 - 앱은 오류일 때만 대기열에 넣음(권한 거부는 월요일 정리가 받음) | 저장소 동작 |

### 76-g 커밋 명령 (Proteur, 맨 위 폴더에서 · 한 줄씩)

1) 서버 - 탈퇴 칸 비움 · 저장소 본인 파일 삭제

```
git add supabase/migrations/20261116170000_g1_member_set_null.sql
git add supabase/migrations/20261116170100_g2_storage_own_delete.sql
git add __tests__/db/withdrawalPurge76g.test.ts
git commit -m "76-g db: set null on member columns for withdrawn users, storage delete policy for own files"
```

2) 운영 스크립트 - 상대가 남은 탈퇴자 · 잡지 파일

```
git add scripts/ops/purgeWithdrawn.ts
git add scripts/ops/purgeWithdrawn.test.ts
git add scripts/ops/sweepOrphanFiles.ts
git add scripts/ops/sweepOrphanFiles.test.ts
git commit -m "76-g ops: purge withdrawn users even when partner remains, sweep magazine files of couples with no issue rows"
```

3) 웹 - 지운 순간 내 파일도 지움

```
git add web/src/features/feed/fileDelete.ts
git add web/src/features/feed/fileDelete76g.vitest.tsx
git add web/src/features/feed/DateDetailScreen.tsx
git add web/src/features/feed/feedTestSupport.ts
git add web/src/tabs/FeedTab.tsx
git add web/src/App.tsx
git commit -m "76-g web: delete my storage file right after a photo or day is deleted, retry queue on device"
```

4) 상태 파일

```
git add .claude/state/HANDOFF.md
git add .claude/state/PROGRESS.md
git commit -m "76-g state: handoff and progress"
```

### 76-g `db push` 순서 (Proteur · 맨 위 폴더 · 값 출력 0)

키 필요 없음(link된 CLI). 비밀번호를 물으면 화면 입력 칸에만.

1. `npx supabase migration list` → `20261116170000` · `20261116170100` 두 개만 Local에만 있고 그 앞(`20261116120000` m3 포함)은 Local · Remote 같아야 한다.
2. `npx supabase db push --dry-run` → **`20261116170000_g1_member_set_null.sql` · `20261116170100_g2_storage_own_delete.sql` 두 개만**. 다른 것이 보이면 멈추고 보고.
3. `npx supabase db push`
4. `npx supabase migration list` → 양쪽에 있으면 끝. (선택) 대시보드 SQL 읽기만: `select policyname, cmd from pg_policies where schemaname = 'storage' and policyname = 'storage_own_delete';` → 한 줄 `DELETE`.

**순서 주의**: m2를 올리기 전에 새 앱으로 사진을 지우면 행은 지워지고 파일은 그대로(오류 없음) - 월요일 정리가 받는다. 새 `purgeWithdrawn`은 m1 **뒤에만** 돌린다(m1 전에는 상대가 남은 탈퇴자에서 인증 삭제가 막혀 "실패"로 셈).

### Proteur 다음 순서

1. 커밋(위 1~4)
2. db push(위 순서, 두 파일)
3. `cd web` → `npm run build:trial` → `npx cap sync android`(메인 세션이 맨 끝에 한 번 돌림 - 그 뒤 코드 변경 없으면 생략 가능) → Android Studio 빌드
4. 두 폰 덮어 설치(데이터 유지)
5. 폰 확인: **사진 하나 지우기**(오늘 새로 남긴 것) → 24시간 뒤(또는 다음 월요일) `sweepOrphanFiles` 미리 보기에서 entries "남은 파일"이 **그 사진만큼 늘지 않음**(앱이 이미 지웠음). 늘었다면 저장소가 `owner`를 채우지 않는 것 - 보고(월요일 정리가 대신 지우므로 약속은 지켜짐)
6. 월요일 운영(76-f 절 명령 그대로): `purgeWithdrawn` → `sweepOrphanFiles` 미리 보기 → 적용. 미리 보기 줄이 바뀜: "보류" 줄 대신 "해제 실행 대기" · "상대가 남은 커플" · "떠난 사람 …" 줄, sweep에 magazine · magazine-print 줄이 더해짐. **첫 실행은 미리 보기 숫자를 PE에 보내고 확인 뒤 적용**(R105-6)

## `76-f` 파일까지 지우기 (메인 세션, 2026-11-16, 위임문 `76-f-dispatch-file-deletion.md` · R104-3 · R104-4 · R104-5 · R104-6) - 완료(일부 멈춤, 미커밋)

범위: `scripts/ops/` 새 파일 4개(`sweepOrphanFiles.ts` · `purgeWithdrawn.ts` + 시험 2) · HANDOFF · PROGRESS. **`web/` 변경 0**((a) 멈춤) · `resetTestAccount.ts` 변경 0(공용 부분은 export를 그대로 가져다 씀) · 마이그레이션 0 · `consent.ts` 0 · 새 패키지 0 · 네이티브 · RN 0 · `demo_responses` 0 · R34-3 함수 호출 0 · 원격 0 · 스크립트 실행 0. 위임 0(메인 세션 직접).

검증: web tsc 0 · Vitest 58/953 + 1 건너뜀(변화 없음) · `LEGAL_CHECK=1` 법무 관문 7/7 · `build` · `build:trial` · `cap sync android`(맨 끝 한 번) · 루트 tsc 0 · jest 108/1874 → **110/1898**(새 시험 2 파일 · 24건) · Deno 초기화 시험 28/28(회귀 0) · `deno check` 새 스크립트 2개 통과 · PGlite 5/80(변화 없음) · Python(PROGRESS 줄). 키 · 주소 · ref · id · 이메일 · 파일 경로 0 · 파일 이름 ASCII.

### 멈춘 것

| 항목 | 이유(코드 근거) | 선택지 |
|---|---|---|
| **(a) 앱이 지운 순간 내 파일 지우기 - 전부**(사진 하나 · 하루 지우기 둘 다) | `storage.objects`에 **DELETE 정책이 어느 마이그레이션에도 없다**(015는 entries · messages · stories · magazine에 select · insert만, 019 avatars는 select · insert · update만). 로그인 사용자의 저장소 `remove()`는 정책이 없으면 오류 없이 0건으로 끝난다 -> 앱에서 지우려면 정책 마이그레이션이 필요. 하루 지우기만이 아니라 사진 하나도 같은 이유 | (1) 마이그레이션 1개: `entries` · `messages` · `stories` 버킷에 `for delete to authenticated using (bucket_id in (...) and owner_id = auth.uid()::text and is_couple_member(첫 폴더))` - 업로더 본인 파일만(상대 파일은 정책이 막음) + 앱 (a) 구현(대기열 재시도) (2) 서버 함수(Edge Function, service_role)로 지우기 - 배포 필요 (3) 앱은 그대로 두고 (b) 월요일 정리로 약속을 채움(지금 상태, 최대 7일 + 다음 월요일 지연) |
| **(c) 상대가 남아 있는 탈퇴자의 계정 행 · 인증 사용자** | `couples.user_a_id` · `user_b_id`가 `profiles`를 **ON DELETE RESTRICT**로 가리킨다(005). 상대의 기록이 그 커플 행 아래(cascade)에 있어 커플 행을 지울 수 없고, 커플 행이 있으면 프로필 · 인증 사용자를 지울 수 없다. `couple_dissolutions.initiated_by`도 NO ACTION | (1) 마이그레이션: 두 칸을 null 허용 + `on delete set null`(+ `initiated_by` · `start_date_*` 도) - 그다음 `purgeWithdrawn`이 그대로 처리 (2) 그 사이: 이 사용자는 "보류"로 셈만 함. 기록 행은 해제 실행(030, 같은 7일)이 지우고 파일은 `sweepOrphanFiles`가 지움 - **남는 것은 프로필(이름 · 생년월일 · 동의 시각) · 성격 결과 · 인증 사용자(이메일)** |

그 밖 멈춤 0. `purge_scheduled_at`은 실제 스키마(003)에 있고 뜻이 같다(탈퇴 요청 함수 027이 `deleted_at` · `purge_scheduled_at`을 함께 씀).

### (d) 판정 - 해제 실행 뒤 파일

**남는다.** `execute_dissolution`(030)은 요청한 사람의 `data_entries` · `messages` · `stories` 행을 **지우고**(소프트 아님) `profiles.reference_photo_path`를 비우기만 한다. 저장소 API를 부르지 않으므로 `entries` · `messages` · `stories` · `avatars` 파일이 남는다. 행이 사라졌으니 **가리키는 행이 없는 파일**이 되어 `sweepOrphanFiles`가 다음 월요일에 지운다(해제 요청 7일 + 다음 월요일 = 약속 기간 안). 해제 실행 함수는 고치지도 부르지도 않았다(R34-3).

그 밖에 파일이 남는 경로(목록):

| 경로 | 남는 파일 | 정리 |
|---|---|---|
| 사진 하나 지우기(023 `fn_delete_own_entry`, 소프트 삭제) | entries | (b) - 지운 행은 "가리키는 행"이 아니다 |
| 하루 지우기(76-m3, 소프트 삭제 · 장소 삭제) | entries | (b) |
| 해제 실행(030) - 요청자 행 삭제 | entries · messages · stories · avatars | (b) |
| 해제 실행(030) - **두 사람 모두 떠남**: 커플 · 호 행 삭제 | **magazine · magazine-print** | **정리되지 않음** - (b)는 매거진 버킷을 열거하지 않고(지시), (c)는 커플 행이 이미 없어 접두를 모른다. 선택지: (b)에 "그 접두의 커플 행이 없을 때만" 매거진 정리를 허용(PM 결정) |
| 탈퇴 - 상대 남음(위 멈춤) | 위와 같음(해제 실행 경로) | (b) |
| 스토리 소멸(013 `expire_stories`, 사진 연동 사용자 'discarded') | stories | 정리되지 않음 - 스토리 행이 남아 있어 "가리키는 행 있음"(보수적). 지금 웹 사용자는 사진 연동이 없어 'archived'(파일을 data_entries가 가리킴)로만 감 |
| 채팅 사진 · 스토리 · 프로필 사진 바꾸기 - **웹 앱에 지우는 길 없음**(메시지 삭제 · 스토리 삭제 · 대표 사진 바꾸기 화면 0) | - | 해당 없음 |

### 76-f 결정 기록 (출처: R104-3 · R104-4 · R104-5 · R104-6)

| 결정 | 근거 |
|---|---|
| (a) 전부 멈춤 - 사진 하나도 저장소 DELETE 정책이 없어 하루 지우기와 같은 이유. "하루 지우기만 멈춤"으로 나누지 않음 | 015 · 019 정책 목록 |
| 상대 파일은 지우지 않는다: 지금은 클라이언트 DELETE 정책이 없어 어떤 파일도 못 지움. (a)를 연다면 정책에 `owner_id = auth.uid()`를 넣어 저장소가 막게 한다(선택지 1) | R104-4 |
| (b) "가리키는 행" = **지우지 않은** 행. `data_entries`(storage · thumb · drawing) · `messages.media_path`는 `deleted_at is null`인 행만, `stories.media_path` · `profiles` · `couples`의 `reference_photo_path`는 모든 행. 소프트 삭제된 사진 · 메시지의 파일은 지운다 - 처리방침 "언제든 지울 수 있습니다"를 (a) 멈춤 동안 (b)가 채운다 | R104-3 · R104-4 |
| (b) 버킷을 가리지 않고 모든 경로 칸을 한 집합으로 본다 - 스토리가 아카이브되면 `data_entries.storage_path`가 stories 버킷 경로를 가리킨다(013). 겹치면 남기는 쪽 | 보수적 |
| (b) 만든 시각을 모르는 파일도 24시간 안처럼 건너뜀 | 보수적 |
| (b) magazine · magazine-print: 실행 흐름이 열거하지 않고, 실제 포트도 그 이름을 받으면 저장소를 부르기 전에 멈춘다(시험 단언) | R104-4 |
| 가드: 초기화 허용 목록(저장소 밖 `reset-allowlist.txt`)의 `project=` 줄만 본다(이메일 줄 무시) - `resetAllowlist.parseAllowlist`를 그대로 씀. 접속 전 판정 | R104-4 |
| (c) 대상 = `deleted_at is not null and purge_scheduled_at <= now()`. 상대 "남아 있음" = 상대 프로필이 있고 탈퇴 요청이 없거나 **유예가 아직 안 끝남**(유예 중에는 탈퇴를 취소할 수 있으므로 함께 지우지 않음 - 030의 "deleted_at만 보면 떠남"보다 좁게) | 처리방침 "두 사람이 모두 떠났을 때만" |
| (c) 처리 가능한 사용자: 커플 접두 6개 버킷(매거진 포함 - 둘 다 떠남) + 사용자 avatars 접두 -> 커플 행(cascade로 호 · 기록) -> 인증 사용자(profiles 등 cascade). 순서 · 접속 부분은 `resetTestAccount.makePort` 그대로 | R104-4 · 초기화 동작 변화 0 |
| (c) 한 사용자 실패 -> 그 사용자는 다음 실행 때 다시 · 다른 사용자는 계속 · 실패 수 출력. 같은 커플을 두 사용자가 함께 가지면 앞 사용자가 지운 뒤 뒤 사용자는 빈 작업(멱등) | R104-4 |
| 월요일 순서: `purgeWithdrawn` 먼저(커플 · 사용자 접두째 지움) -> `sweepOrphanFiles`(남은 낱개). 반대로 하면 (b)가 아직 지울 차례가 아닌 파일을 보지 않으므로 결과는 같지만 숫자가 겹치지 않게 | R104-5 |
| 로그아웃 · 계정 전환 때 파일 삭제 대기열 규칙: (a) 멈춤으로 대기열을 만들지 않았다 - (a)를 열 때 정함 | - |
| HANDOFF 옛 절(74-0 명령 "2-1")의 `$al` 줄은 경로 속 `\r`이 줄바꿈 문자로 깨져 있다(`.ondolog` 뒤). 아래 76-f 명령은 바른 경로 - 옛 절은 고치지 않음 | 발견만 |

### 76-f 커밋 명령 (Proteur, 맨 위 폴더에서 · 한 줄씩)

1) 운영 스크립트 - 남은 파일 정리 · 탈퇴 최종 삭제

```
git add scripts/ops/sweepOrphanFiles.ts
git add scripts/ops/sweepOrphanFiles.test.ts
git add scripts/ops/purgeWithdrawn.ts
git add scripts/ops/purgeWithdrawn.test.ts
git commit -m "76-f ops: weekly orphan file sweep and withdrawn account purge scripts (preview by default, numbers only)"
```

2) 상태 파일

```
git add .claude/state/HANDOFF.md
git add .claude/state/PROGRESS.md
git commit -m "76-f state: handoff and progress"
```

### 76-f 월요일 운영 (Proteur · 매주 월요일 · 맨 위 폴더 · R104-5)

순서: **`purgeWithdrawn` 미리 보기 -> 적용 -> `sweepOrphanFiles` 미리 보기 -> 적용.** 결과 숫자는 PROGRESS에 "날짜 + 숫자"만(경로 · id 0).

0. 새 PowerShell 창. 키 · 주소는 보안 입력(화면 · 파일 · 보고에 쓰지 않음). 키는 **`ops_2026_11`**:

```
$env:ONDOLOG_SUPABASE_URL = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString)).Password
$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString)).Password
$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY.StartsWith('sb_secret_')
```

   마지막 줄이 `True`일 때만 다음으로.

1. 호스트 · 허용 목록 경로(값을 적지 않고 변수로만):

```
$h = ([Uri]$env:ONDOLOG_SUPABASE_URL).Host
$al = Join-Path $env:USERPROFILE '.ondolog\reset-allowlist.txt'
```

2. 탈퇴 최종 삭제 - 미리 보기:

```
deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_RESET_ALLOWLIST,USERPROFILE,HOME --allow-net=$h --allow-read="supabase/.temp/linked-project.json,$al" scripts/ops/purgeWithdrawn.ts
```

3. 탈퇴 최종 삭제 - 적용(미리 보기 숫자가 맞을 때만):

```
deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_RESET_ALLOWLIST,USERPROFILE,HOME --allow-net=$h --allow-read="supabase/.temp/linked-project.json,$al" scripts/ops/purgeWithdrawn.ts --apply
```

4. 남은 파일 정리 - 미리 보기:

```
deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_RESET_ALLOWLIST,USERPROFILE,HOME --allow-net=$h --allow-read="supabase/.temp/linked-project.json,$al" scripts/ops/sweepOrphanFiles.ts
```

5. 남은 파일 정리 - 적용:

```
deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_RESET_ALLOWLIST,USERPROFILE,HOME --allow-net=$h --allow-read="supabase/.temp/linked-project.json,$al" scripts/ops/sweepOrphanFiles.ts --apply
```

6. 창을 닫고 새 창에서 `[bool]$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY` -> `False`.

7. (76-h · R106-4) `purgeWithdrawn` 미리 보기의 **"해제 실행 대기" 숫자가 두 주 연속 줄지 않으면 PE에 알림** - 매일 해제 실행 일정(cron)이 멈췄다는 신호.

8. (76-i · R111-5) **알림 건강 확인 - 지난 7일 `push-send` 응답을 상태별 건수로만**(값 · 토큰 · 본문 · 주소 0). 대시보드 **Logs**(왼쪽 메뉴) -> 왼쪽 **Time Range**를 지난 7일로 -> **Log Type**은 Edge Function 하나만 -> **Pathname** 필터에 `push-send` -> **Status** 필터로 200 / 그 밖을 나눠 건수만 본다(행을 열어 내용을 보지 않는다). **200이 아닌 것이 한 건이라도 있으면 PE에 건수만 알림**(503 = 함수 비밀 빠짐 · 401 = Vault 비밀).
   - `net._http_response`(pg_net 응답 표)로는 셀 수 없다: **보존 6시간**(`pg_net.ttl` = 6 hours 실측, pg_net 0.20.4 · 문서 기본값과 같음 · 바꾸려면 Supabase 지원 요청 필요). 마이그레이션 0으로 되는 쪽(로그)을 쓴다.
   - 로그 보존 실측(2026-11-16, Free 플랜): 같은 로그 저장소에 11/9(7일 전) API 요청 로그 · 11/7(9일 전) DB 로그가 남아 있음 -> 7일은 볼 수 있다. `push-send` 기록은 11/16부터라 **11/23 첫 확인에서 11/16의 503 22건(78- 1차 폰 확인 - 함수 비밀 누락)이 보이면 7일 보존이 확인된 것**(그 22건은 이미 원인을 안다 - 알림 불필요). 보이지 않으면 PE에 "볼 수 있는 기간"을 알림 -> 대안은 날짜별 숫자만 남기는 작은 표(마이그레이션 · PM 결정).
   - (메인 세션이 대신 볼 때) 로그 질의 - 24시간 창으로 7번:
     `select toString(log_attributes['response.status_code']) as status, count(*) as n from logs where source = 'function_edge_logs' and toString(log_attributes['request.pathname']) like '%/push-send%' group by status order by status`

9. (80- · R114-3 ②) **앱 오류 건수 - 지난 7일 (화면 · 종류 · 플랫폼)별 상위 10**(건수만 · 내용 0 - 표에 내용 칸이 없다). 대시보드 **SQL Editor**에서 읽기만:

```
select screen, kind, platform, sum(count)::int as n
from public.app_error_daily
where day >= (now() at time zone 'Asia/Seoul')::date - 6
group by screen, kind, platform
order by n desc, screen, kind, platform
limit 10;
```

   **0줄이 아니면 그 줄들(화면 · 종류 · 플랫폼 · 숫자)만 PE에.** 90일 지난 행은 2 · 3번 `purgeWithdrawn`이 지운다(미리 보기 "오류 기록 90일 정리: n" · 적용 "오류 기록 지움: n", 80-m1 전에는 "확인 못 함").

`--allow-net`은 프로젝트 호스트 하나, `--allow-env`는 위 이름만, `--allow-read`는 연결 정보 파일과 허용 목록 하나. 허용 목록의 `project=`가 접속 주소와 다르면 두 스크립트 모두 **접속 전에** "거부: …" 한 줄로 끝난다.

**첫 실행(이번 한 번)**: 2 · 4 미리 보기만 돌리고 숫자 줄을 PE에 보낸다 -> PE 확인 뒤 3 · 5 적용. `--apply`는 그 뒤부터 월요일마다.

### Proteur 다음 순서 (R104-6)

1. 커밋(위 1 · 2)
2. 앱 변경 없음 - 빌드 · 설치는 지금 앱 그대로(메인 세션이 `build:trial` · `cap sync`를 한 번 돌렸지만 웹 코드 변화 0)
3. 폰 확인: 사진 하나 지우기 -> 24시간 뒤 `sweepOrphanFiles` 미리 보기에서 entries "남은 파일"이 **1 늘어난다**(지금은 앱이 파일을 못 지우므로 늘어나는 것이 맞음 - (a) 멈춤) -> 적용하면 지움 1. (a)가 열린 뒤에는 늘지 않아야 한다
4. PM 결정: (a) 선택지 · (c) 계정 행 선택지 · 해제 실행(둘 다 떠남) 뒤 매거진 파일 정리 허용 여부

## `76-r` 폰 확인 수정(F1~F8 · S1 · G1) + `76-d` 하루 지우기(D2) (메인 세션, 2026-11-16, 위임문 `76-r-dispatch-fix-and-day-delete.md` · R101-4 · R102-1~5 · R103-3 · R103-5 · MASTER r76 9-8-2) - 완료 (미커밋)

범위: `web/src/` · `supabase/migrations/` 새 파일 1개(`76-m3`, 사전 허가) · `__tests__/db/` 시험 1개 · `.gitignore` 한 줄 · HANDOFF · PROGRESS. 서브에이전트 위임 0(메인 세션 직접). 새 패키지 0 · 네이티브 손수정 0 · RN · 보호 파일 0 · 루트 `src/` 0 · `demo_responses` 0 · R34-3 함수 호출 0 · 원격 0(db push · 커밋 0).

검증(메인 세션 직접): web tsc 0 · Vitest 54/921 → **58/953** + 1 건너뜀 · `LEGAL_CHECK=1` 법무 관문 7/7 · `build` · `build:trial`(dist는 시험 빌드) · `cap sync android` · 루트 tsc 0 · jest 107/1858 → **108/1874**(PGlite 4/64 → **5/80**) · Python(PROGRESS 줄). 키 · 주소 · ref · id · 이메일 0 · 새 파일 이름 ASCII · 줄 끝은 원래 파일 그대로.

### 멈춘 것

| 항목 | 이유 | 선택지 |
|---|---|---|
| F2 옛 문구 "코드 전체 0" 중 **RN 쪽 5곳** | 위임서가 RN · 루트 `src/` 편집을 막음. 웹(`web/src` 앱 · 시험 · 상수)은 0이고 정적 검색 시험이 지킨다 | RN 파일: `src/components/main/MainHero.tsx:29`(문구 상수) · `src/utils/mainScreen.ts:24`(주석) · `app/(tabs)/main.tsx:6`(주석) · `__tests__/components/u1Main.test.tsx:199,205` · `__tests__/utils/mainScreen.test.ts:44`. (a) RN은 출시 경로가 아니니 그대로 둔다 (b) 다음 위임서에서 RN 편집 허가 |

그 밖 멈춤 0. F1은 서버 쓰기 · 마이그레이션 없이 됨(아래). m3 밖 마이그레이션 필요 0.

### F1 원인 판정 (보고 맨 앞)

**(c) 그 밖 - 확인 시점 누락.** `useStartDateRecheck`는 "탭 화면이 처음 열릴 때"(`enabled` 거짓 -> 참)와 `visibilitychange`에서만 확인했다. 탭끼리 옮길 때는 `enabled`(= 탭 화면인가)가 계속 참이라 다시 보지 않는다. 폰 B는 2:20.0 설정 -> 2:41.6 메인으로 **앱 안에서 탭만 옮겼고**, 값은 `useCoupleRefresh`(탭 진입마다 다시 읽기)로 333이 됐지만 안내 확인은 돌지 않았다. Capacitor `resume`도 듣지 않았다.
- (a) 아님: 이 훅은 처음 연결 흐름과 무관하게 탭 화면에서 돈다(처음 연결 흐름은 `StartDateScreen` 온보딩 길).
- (b) 아님: "봤음"은 이번 실행 메모리에만 있었고 키에 정한 사람이 들어 있다. 판정(`needsStartDateConfirm`)은 정한 사람 = 상대일 때만 참이라 내 변경 · 상대 변경을 가른다. 서버 쓰기(`updateStartDateByMe`)도 정한 사람 = 바꾼 사람 · 확인 = null로 맞다.
- 수정: 메인 탭으로 돌아올 때(`screen === 'main'` 거짓 -> 참) · 앱 복귀(`onAppResume` = Capacitor `resume` + `visibilitychange`) · 앱 시작에 확인. 띄운 순간 기기에 "봤음"(`main:dateNotice`, 키 = 커플 · 정한 사람 · 날짜)을 남겨 같은 값으로는 다시 안 뜸(뒤로 닫아도). 오프라인이면 읽기 실패 -> 조용히 넘어가고 다음 메인 복귀 · 열기 때. **서버 쓰기 · 마이그레이션 0**([확인했어요]의 `start_date_confirmed_by`는 기존 쓰기 그대로).

### 항목별 표

| # | 고친 곳 | 시험 | 폰에서만 확인되는 것 |
|---|---|---|---|
| F2 | `features/main/startTemperature.ts`(`TEMPERATURE_CAPTION` · `temperatureCaption` 순수) · `MainView.tsx` Hero: 상태마다 **정확히 한 문장**. 옛 보조 문구 상수 삭제 | `temperatureCopy76r.vitest.ts`(web/src 전체 옛 문구 0 정적 검색 · 고르기 3경우) · `startTemperature.vitest.tsx` · `startTemperatureV0.vitest.tsx` · `main.vitest.tsx`(두 상태 각각 한 문장 · 저장값 상태 한 문장) | 두 폰 44.7° 아래 "최근 2주의…" 한 줄 |
| F1 | `couple/useStartDateRecheck.ts`(메인 복귀 · 앱 복귀 · 기기 "봤음") · `App.tsx` 한 줄 · `StartDateScreen.tsx`(제목 이름을 저장된 상대 이름으로 먼저) | `couple.vitest.tsx` +3: 상대 변경 -> 메인 복귀 때 1회 · 다시 메인 0 · 앱 다시 열기 0 / 내 변경 0 / 오프라인 -> 다음 메인 복귀 때 1회 | A가 바꾸고 B에서 (가) 앱 켜 둔 채 설정 -> 메인 (나) 홈 -> 복귀 |
| F3 · F4 | `features/main/useMainData.ts`: `main` 범주의 scope `library`(호 목록 · 다음 호 = 매거진 %, 표지 서명 URL 0) · `facts` · `start`를 남기고 첫 그림에 먼저 씀. 오프라인 실패는 저장값을 덮지 않음 · 서재 오류는 보일 값이 있으면 그대로. `startTemperature.ts` 훅도 저장값 먼저 | `main.vitest.tsx` +3: 재진입 첫 프레임 자리 표시 0 · 오프라인 온도 · 이름 · D+ · % · 저장값 없으면 자리 표시 | 비행기 모드 메인(A 0:15.5 재현) · 메인 탭 재진입 0.3~0.8초 회색 0 |
| F5 | `chat/chatCache.ts`(`chat` 범주 scope `{커플}:head` 마지막 상대 이름) · `ChatView.tsx` 머리 = 서버 이름 -> 저장 이름 -> "상대" | `chatHead76r.vitest.tsx`: 온라인 저장 · 오프라인 · 상대 id 모름에도 이름 · 다른 커플 0 + **지우는 때 4가지**(로그아웃 · 탈퇴 요청 · 해제 요청(유예 시작) · 해제 완료 · 계정 전환) | 비행기 모드 채팅 머리 이름 |
| F6 | `chat/useChatQueueResume.ts`: `online` · `navigator.connection` `change`에서 즉시 + 1 · 2 · 4초 뒤 한 번씩 더(첫 시도가 경로 준비 전에 실패해 백오프로 밀리던 것) | `offlineCache76.vitest.tsx` +2: 첫 시도 실패해도 1초 안 · connection change | 비행기 모드 끔 -> 전송 시각(목표 1~2초) |
| F7 | `ChatView.tsx` 사진 칸 `waiting`(자리 표시 맥박) -> `ready`(흐려 나타남 0.26초) · `styles.css` | `lowFixes76r.vitest.tsx` F7 | B 0:55.6 빈칸 느낌 |
| F8 | `screens.tsx` 결과 상세 머리 4개 `appear`(시작 투명 0 · 지연 0.1~0.46초) -> `appearTop`(시작 .55 · 지연 0~0.12초) · `styles.css`. 아래 카드 연출은 그대로 | `lowFixes76r.vitest.tsx` F8 · `scrollReveal76` 회귀 0 | B 2:08.2 진입 첫 프레임 |
| S1 | `sky/SkyScreen.tsx` C01 안내 "위로 끌면 지난 하늘"만 · C02 "아래로 내리면 이번 달 ↓" 그대로. 놓기 동작 77- 그대로 | `skyScreen.vitest.tsx` +1(두 문구 · 옛 뒷말 0) | 하늘 C01 · C02 안내 |
| G1 | `.gitignore` 한 줄. **이 파일은 이미 추적 중이라** 커밋 때 `git rm --cached` 한 줄 필요(아래 명령) | - | - |
| D2 서버 | `supabase/migrations/20261116120000_m3_day_delete.sql` | `__tests__/db/dayDelete76m3.test.ts` 16건 | - |
| D2 앱 | `features/feed/dayDelete.ts`(RPC 하나 · 뒤처리) · `FeedView.tsx`(`SwipeRow`) · `feedData.ts`(`dropDay` · `dropDayFromChapters`) · `tabs/FeedTab.tsx`(I05 확인 · 오프라인 막기) · `feedTestSupport.ts`(가짜 RPC) · `styles.css` | `dayDelete76d.vitest.tsx` 10건: 밀기 · 세로 먼저면 아님 · 미연결 없음 · 확인 문구 · 취소 · 내 것만 -> 카드 사라짐(기기 저장분도) · 상대 것 남음 -> 남은 것만 · 서버 실패 그대로 · 오프라인 막힘 · 하늘 저장분 | 손가락 밀기 감 · 세로 스크롤과 겹침 0 · 하늘 별 변화 |

77- 하늘(`sky`)과 같은 장치인가: **같은 장치 하나**(`cache/deviceCache`). F3 · F4는 `main`, F5는 `chat` 범주의 scope로 넣어 새 범주가 생기지 않았다 - 삭제 규칙(`COUPLE_KINDS`)이 그대로 덮는다.

### 76-r · 76-d 결정 기록 (출처: R101-4 · R102-2~5 · R103-3 · R103-5)

| 결정 | 근거 |
|---|---|
| **저장된 일간 온도가 있으면 "활동분 > 0"으로 본다** -> "최근 2주의…" 한 문장. 저장값은 배치가 기록을 본 뒤에 생기고 그 뒤로 하루 한 번 바뀌는 값이라 "시작 온도"가 아니다(저장값이 기저와 같아도) | R102-2 |
| 시작 온도 표시 중 활동분 판정 = v0 표시 값 > 기저(76- 그대로). 활동은 있는데 14일 창 밖이면 활동분 0 -> "시작 온도예요…" | R100-1 · R102-2 |
| 시작 온도를 못 구했고(프로필 한쪽 없음) 활동은 있는 B03: 숫자 없이 "최근 2주의…" 한 문장. 활동 없음이면 기존 "아직 온도를 잴 기록이 없어요"(온도 아래 문장이 아니라 숫자 자리 글) | 지어내지 않기 |
| 날짜 변경 "봤음"은 띄운 순간 기기에 남긴다(확인 버튼 전). 뒤로 닫아도 같은 값으로는 다시 안 뜸 - "한 번 보면 다시 안 뜸" | R102-3 |
| `date_stops.author_id`: 새 행은 BEFORE INSERT 트리거가 `auth.uid()`로 덮음(앱 값 무시) · BEFORE UPDATE는 원래 값 유지 · service_role 넣기는 null(옛 장소와 같게 취급) · 프로필 삭제 시 null(on delete set null - 탈퇴 배치를 막지 않음) | R101-4 |
| 정책: `date_stops_all` 하나를 넷으로. **넣기만 본인**, 읽기 · 고치기 · 지우기는 커플 구성원 그대로(두 앱이 서로의 장소 순서를 다시 매김 - `resequenceStops`) | R101-4 · 기존 동작 유지 |
| RPC `fn_delete_my_day(p_date_id)`: 내 항목(사진 · 메모 · 그림) 소프트 삭제 · 내 장소 삭제 · 남은 것(상대 항목 · 작성자 있는 장소) 0이면 옛 장소 삭제 + `dates` 소프트 삭제(같은 날 다시 기록하면 앱이 되살리는 기존 규칙) · 남으면 파생 칸 재계산(023과 같은 식) · 해제 완료 거부 · **유예 중 허용**(`is_couple_member`) · 이미 지운 날 멱등 | R101-4 · R98-8 |
| 상대 사진이 내 장소에 붙어 있었어도 내 장소는 지운다(위임서 문언). 상대 사진은 남고 화면은 시각 규칙(규칙 4)으로 남은 장소에 다시 놓는다(FK `on delete set null`) | R98-8 "내가 남긴 장소" |
| **저장된 사진 파일(storage)은 지우지 않는다** - 기존 사진 삭제 경로(023 `fn_delete_own_entry`)와 같음(보관 정책 §11-2) | 위임서 "기존 사진 삭제 경로를 따름" |
| 앱 밀기: 카드 전체(가로 사진 줄 없음 - E01) · 첫 이동 8px에서 가로/세로를 가름 · `touch-action: pan-y` · [지우기] 폭 88 · 절반 넘으면 열림 · 열린 카드를 누르면 닫힘 · 한 번에 한 장만 열림 · 닫힌 동안 [지우기] 비활성 | R98-8 · 76- E01 |
| [지우기] 색 `#D64550`(디자인 토큰에 빨강 없음 - 위임서 "빨간") | PM 확인 1 |
| 오프라인 안내 "연결되면 지울 수 있어요" · 실패 안내 "지우지 못했어요. 다시 시도해 주세요"(위임서에 문구 없음 - 짧은 안내) | PM 확인 2 |
| 지운 뒤: 피드는 즉시 카드 빼기(내 것만이면) + 다시 읽기 · 하늘 저장분에서 그날 기록 빼고 그 달부터 그날 온도 비움 · 기록 신호(`useFeedSignal`)로 메인 시작 온도 · 활동 유무 · 하늘 · 상세 다시 읽기 | R101-4 "바로 반영" |
| 지우기는 연결 또는 해제 유예 중에만(서버와 같음) | 서버 규칙과 일치 |
| `src/types/database.ts`(루트 생성 타입)에 `author_id` · 새 RPC 없음 - 앱은 이 타입을 거치지 않고 부름. 다음 타입 생성 때 반영 | 루트 `src/` 편집 0 |

### 76-r 커밋 명령 (Proteur, 맨 위 폴더에서 · 한 줄씩)

1) 서버 - 하루 지우기(m3)

```
git add supabase/migrations/20261116120000_m3_day_delete.sql
git add __tests__/db/dayDelete76m3.test.ts
git commit -m "76-m3 db: date_stops author column set by server, self-only insert policy, fn_delete_my_day atomic day delete"
```

2) 웹 - 온도 문구(F2)

```
git add web/src/features/main/startTemperature.ts
git add web/src/features/main/MainView.tsx
git add web/src/features/main/temperatureCopy76r.vitest.ts
git add web/src/features/main/startTemperature.vitest.tsx
git add web/src/features/main/startTemperatureV0.vitest.tsx
git commit -m "76-r web: one caption under temperature (start vs last two weeks), old first-temperature line removed"
```

3) 웹 - 날짜 변경 안내(F1)

```
git add web/src/couple/useStartDateRecheck.ts
git add web/src/App.tsx
git add web/src/features/couple/StartDateScreen.tsx
git add web/src/features/couple/couple.vitest.tsx
git commit -m "76-r web: partner date change notice on return to main and app resume, shown once per value"
```

4) 웹 - 저장 장치(F3 · F4 · F5) · 큐 즉시(F6)

```
git add web/src/features/main/useMainData.ts
git add web/src/features/main/main.vitest.tsx
git add web/src/features/chat/chatCache.ts
git add web/src/features/chat/ChatView.tsx
git add web/src/features/chat/chatHead76r.vitest.tsx
git add web/src/features/chat/useChatQueueResume.ts
git add web/src/features/chat/offlineCache76.vitest.tsx
git commit -m "76-r web: saved main summary first offline and on re-entry, last partner name in chat header, immediate queue flush on network change"
```

5) 웹 - 낮음(F7 · F8 · S1)

```
git add web/src/screens.tsx
git add web/src/styles.css
git add web/src/lowFixes76r.vitest.tsx
git add web/src/features/sky/SkyScreen.tsx
git add web/src/features/sky/skyScreen.vitest.tsx
git commit -m "76-r web: photo slot placeholder fade, result detail header visible from first frame, sky hint copy"
```

6) 웹 - 하루 지우기(D2)

```
git add web/src/features/feed/dayDelete.ts
git add web/src/features/feed/FeedView.tsx
git add web/src/features/feed/feedData.ts
git add web/src/features/feed/feedTestSupport.ts
git add web/src/features/feed/dayDelete76d.vitest.tsx
git add web/src/tabs/FeedTab.tsx
git commit -m "76-d web: swipe a feed day card to delete only my places, photos and memos"
```

7) G1 - 추적 해제 + 무시(파일은 디스크에 남음)

```
git rm --cached web/android/.idea/deploymentTargetSelector.xml
git add .gitignore
git commit -m "76-r chore: stop tracking android studio deployment target selector"
```

8) 상태 파일

```
git add .claude/state/HANDOFF.md
git add .claude/state/PROGRESS.md
git commit -m "76-r state: handoff and progress"
```

(`styles.css`는 F7 · F8 · D2가 함께 고쳐 5)에 한 번 넣는다.)

### 76-r `db push` 순서 (Proteur · 맨 위 폴더 · 값 출력 0)

키 필요 없음(link된 CLI). 비밀번호를 물으면 화면 입력 칸에만.

1. `npx supabase migration list` → `20261116120000`만 Local에만 있고 그 앞(`20261115160000` 포함)은 Local · Remote 같아야 한다. 76- m2가 아직 Remote에 없으면 76- 순서(m2)를 먼저 끝낸다.
2. `npx supabase db push --dry-run` → **`20261116120000_m3_day_delete.sql` 하나만**. 다른 것이 보이면 멈추고 보고.
3. `npx supabase db push`
4. `npx supabase migration list` → 양쪽에 있으면 끝. (선택) 대시보드 SQL 읽기만: `select policyname from pg_policies where tablename = 'date_stops' order by 1;` → `date_stops_delete` · `date_stops_insert` · `date_stops_select` · `date_stops_update` 넷.

**순서 주의**: m3를 올리기 **전에** 새 앱을 깔아 지우기를 누르면 "지우지 못했어요"(RPC 없음)만 뜨고 아무것도 안 지워진다. 옛 앱은 m3 뒤에도 그대로 동작(장소 넣기는 트리거가 작성자를 채워 정책 통과).

### Proteur 다음 순서 (R102-5)

1. 커밋(위 1~8)
2. db push(위 순서, m3 한 파일)
3. `cd web` → `npm run build:trial` → `npx cap sync android`(메인 세션이 이미 한 번 돌림 - 그 뒤 코드 변경 없으면 생략 가능)
4. 두 폰 덮어 설치(데이터 유지)
5. 폰 확인 순서(녹화 · 방해 금지 모드 · 상태 표시줄 날짜 한 번 보이기 - D+ 셈 확정):
   1. **온도 문구**: 두 폰 메인 온도 아래 "최근 2주의 대화와 기록으로 하루에 한 번 바뀌어요." 한 줄(옛 문구 · 둘째 줄 0)
   2. **날짜 변경 안내**: A가 설정 > 커플에서 사귄 날짜 변경 → B (가) 앱 켜 둔 채 설정 → 메인 탭: "폰A…님이 사귄 날짜를 바꿨어요" + 새 날짜 한 번 → [확인했어요] (나) 같은 값으로 다시 메인 · 홈 → 복귀: 0 (다) A 폰에는 0
   3. **비행기 모드 메인 · 채팅 머리**: 메인에 마지막 온도 · 이름 · D+ · % (회색 틀 0) · 채팅 머리 상대 이름
   4. **메인 재진입**: 다른 탭 → 메인 3번, 회색 틀 0프레임
   5. **큐 즉시**: 비행기 모드에서 글 1개 → 모드 끔 → 상대 폰 수신까지 시각(목표 1~2초)
   6. **하루 지우기**(db push 뒤): (가) 내 것만 있는 날 카드 왼쪽으로 밀기 → [지우기] → 확인 문구 → [취소] 그대로 → 다시 [지우기] → 카드 사라짐 · 하늘 그 별 사라짐 (나) 둘이 함께 남긴 날 → 내 것만 지움 → 카드 남고 상대 사진 · 메모만 · 상대 폰에서도 같음 · 하늘 별 그대로(크기만 바뀔 수 있음) (다) 비행기 모드에서 [지우기] → 짧은 안내 · 확인 창 0 (라) 세로 스크롤 중 카드가 옆으로 안 밀림
   7. (함께) 받은 사진 칸 빈칸 느낌 · 결과 상세 진입 첫 프레임 · 하늘 C01 안내 "위로 끌면 지난 하늘" · 상세 손 떼고 3초(B4 판정)

## `77-` 우리의 하늘 1단계 (메인 세션, 2026-11-16, 위임문 `77-dispatch-our-sky-1.md` · R99-4 · R100-3 · R101-2 · R101-6 · MASTER r75 9-8) - 완료 (미커밋)

범위: `src/engine/`("함께한 하루" 판정 + 온도 v0 입력) · `web/src/` · HANDOFF(0-1 명령 정정) · PROGRESS. 위임: engine-dev 1 · ui-builder 1. **마이그레이션 0 · 서버 쓰기 0**(하늘 코드에 insert · update · upsert · delete · rpc · `issues` 직접 조회 0) · 새 패키지 0 · 네이티브 0 · 원격 0.
검증(메인 세션 직접 재실행): web tsc 0 · Vitest 51/863 → **54/921** + 1 건너뜀 · 법무 관문 7/7 · `build` · `build:trial`(dist는 시험 빌드) · `cap sync android` · 루트 tsc 0 · jest 106/1834 → **107/1858** · PGlite 4/64(회귀 0) · Python(PROGRESS 줄). 키 · 주소 · 이메일 0 · 파일 이름 ASCII.

멈춘 것: 없음.

### 0단계

| # | 결과 |
|---|---|
| 0-1 | `src/engine/togetherDay.ts` - `DayRecordCounts{stops,photos,memos}`(지운 것 제외) · `isTogetherDay`(하나라도 1 이상 → 함께한 하루, **장소만 있는 날도 1**) · `togetherDates`(합산 · 오름차순). 온도 v0 입력 `recordDates` → **`recordDays`**로 바꾸고 recordPart가 이 함수를 거침(문자열 목록 길 삭제, 엔진 1.3.0). 웹은 날짜별 수 읽기를 `web/src/features/records/dayRecordRead.ts` 한 곳에서 하고 메인 온도와 하늘이 같이 씀. **온도 v0 예시 값 변화 없음**: 22.8 · 64.8(예시 입력이 사진 있는 날이라 판정이 같음). 바뀌는 것은 실제 데이터에서 "장소만 있는 날"이 이제 0.4를 받는 것뿐 |
| 0-2 | 아래 "`76-` 0-1 명령"을 고침: 메시지 정렬 `created_at` → **`sent_at`**(`messages`에 `created_at` 없음 - `007_chat.sql`), `deleted_at`은 `messages` · `data_entries` 둘 다 실제 열(그대로) · 실패 문구에 오류 코드 + 짧은 메시지(80자) · 출력 영어. 고친 판을 키 없이 실행해 문법 확인("URL or key variable is empty") |
| 0-3 | 보드 대조표 아래 |

### 보드 대조 (03_Y1-Our-Sky · B02 · C01~C07) - 다른 곳은 보드를 따름

| 화면 | 보드에 있고 9-8에 없음 | 9-8에 있고 보드에 없음 / 다를 때 |
|---|---|---|
| B02 | 손잡이 + "놓으면 하늘이 열려요" · 위로 하늘이 비치는 구도(따름) | "스크롤 중이면 끌기 아님"(9-8) |
| C01 | 달 옆 "VOL.nn · M월호" · 별 위 월 라벨 "10월 · 별 5" · 가장 따뜻한 별 라벨(따름) · **유성 선(2단계라 안 그림)** | 0.22초 켜짐 · 60초 흐름(구현) |
| C02 | "지난 하늘 · M월부터 · 별 n · 달 n" · "이번 달" 라벨 · "200일" 고리 · 흐린 초안 달 · "아래로 내리면 이번 달 ↓"(따름) | 놓으면 이번 달(아래 결정) · 가장 오래된 달 = 첫 함께한 하루의 달 |
| C04 | 제목 "바람 좋던 산책"(AI 제목 모양) → **9-8대로 첫 구간 장소 이름**(지어내지 않음) · 메모 + "사람 · 시각"(시각은 `HH:MM`) · 구체 모양 확대 별(따름) | 잠금 사진 표시(9-4 E12) → C05에서 |
| C05 | 머리 날짜 · 장소 · "i / n" · 사진 아래 시각 · 구간 장소 · 메모 · 썸네일 줄(따름) | `access_locked` 사진은 "잠긴 사진" 표시만 |
| C06 | 머리 · 점선 원 · 문구 · 버튼(따름) · **"유성은 오늘 밤에도 지나가요"는 넣지 않음**(유성 없음 - PM 확인) | - |
| C07 | "ANNIVERSARY" · "{n}일" · 장소 · 사진 · 메모 · 버튼 둘(따름) | 별 없는 기념일 = 고리만(누를 수 없음) |

### 77- 결정 기록

| 결정 | 출처 |
|---|---|
| "함께한 하루" 판정은 엔진 한 곳(`togetherDay.ts`) - 별과 온도 v0 recordPart가 같은 함수. 76-의 `photo_count>0 \|\| has_user_note`(장소만 있는 날 0)를 고침 | R101-2 · MASTER r75 9-8-1 |
| 별 크기 = 그날 온도(저장값, 없으면 v0를 그날 끝 기준 - `todayKst` = 다음 날)의 그 달 안 순위 → 4 · 5 · 8px, 상위 1/3이 8px(31개 = 11 · 10 · 10), 같은 값은 이른 날짜가 위. 온도를 못 읽으면 그 달 별 모두 5px · "가장 따뜻했던 날" 라벨 없음(모르는 것을 짓지 않음) · 읽는 동안도 5px | 9-8-1 |
| 별 자리 · 반짝임 주기(2.8~5.2초) = `dates.id` 결정론 해시. 선 0. 별은 DOM, 움직임은 transform · opacity만, 배경은 기존 `SkyLayer` 한 장을 60초 흐름 | 9-8-1 · 9-8-3 |
| 달 = `issues_public`(발행 = moon 색, 초안 = 흐림) - 기존 `magazineApi` 재사용 | 9-8-1 · 절대 규칙 3 |
| C01 · C02 = 한 세로 스크롤(오래된 달이 위, 이번 달이 맨 아래에서 시작). 이번 달 근처(화면 35% 안)에서 놓으면 이번 달로 돌아오고, 더 먼 지난 달에서는 머묾(돌아가면 지난 별을 못 누름). "아래로 내리면 이번 달 ↓"는 누르면 돌아오는 버튼 겸. 네이티브 스크롤 가로채기 0 - **PM 확인** | 9-8-2 · 보드 · R99-3 |
| 기념일 = 메인 마일스톤과 같은 함수(`getMilestoneStatus`) - D+100 단위 · D+365 단위(라벨 "1주년"…), 시작일 = 1일차. 달력 날짜 대신 D+365n(메인과 갈리지 않게) | 9-8-1 |
| 그날 온도용 메시지는 화면에 들어온 달만, 달마다 한 번(창 14일 전부터) - `activityRead` 방식(1000행 페이지) 재사용 | 9-8-3 성능 |
| C04 제목 = 첫 구간(`seq` 최소) 장소 이름, 없으면 제목 생략 · 메모 = 그날 첫 메모 + 남긴 사람 + KST `HH:MM` · 온도를 모르면 그 줄 생략 · 사진 0이면 [사진 보기] 숨김 | 9-8-2 |
| C05는 `useDateDetail`을 쓰지 않음(그 훅은 서버 쓰기 `syncOwnPlacement`를 함 - 하늘은 읽기 전용) · 서명 URL은 메모리만 | 9-8 |
| 해제 유예 중: `coupleStore`에 `graceCoupleId` · `gracePartnerId`(이미 읽던 dissolving 행 값, 연결 판정에 쓰지 않음)로 하늘을 엶. 유예 중 기기 저장 0(R101-3), 시작일이 없어 D+ · 기념일 표시 0. RLS: `is_couple_member`가 `status <> 'dissolved'`만 막아(`011_rls_helpers.sql:16`) 유예 중 읽기 허용 - 메인 세션 확인 | 9-8-3 · R101-3 |
| 연결 전(혼자) B02 열지 않음 · 경로로 들어와도 뒤로 보냄(`skyOpenable`, CoupleGate는 유예 규칙이 달라 쓰지 않음) | 9-8-3 |
| 기기 저장 `'sky'`(기록 행 + 온도 + 달 목록, 사진 URL · 파일 0)를 `COUPLE_KINDS`에 넣음 → 로그아웃 · 탈퇴 요청 · 해제 요청 · 해제 완료 · 계정 전환 때 삭제(시험) | R98-1 · R101-3 |
| **PM 확인**: 배경 별 반짝임 설정 토글(9-7 결정 4)이 앱에 아직 없음 → 새 설정 화면을 만들지 않고 기본 켬 · 줄인 모션이면 정지 하늘 | 9-7 · 9-8-3 |
| `web/android/.idea/deploymentTargetSelector.xml` 변경은 Android Studio가 만든 것(이번 작업 아님) - 커밋하지 않음 | 메인 세션 |

### 77- 커밋 명령 (Proteur, 맨 위 폴더에서 · 한 줄씩)

1) 엔진 - 함께한 하루 판정

```
git add src/engine/togetherDay.ts
git add src/engine/temperature.ts
git add src/engine/dnaScore.ts
git add __tests__/engine/togetherDay.test.ts
git add __tests__/engine/temperatureActivityV0.test.ts
git commit -m "77 engine: one together-day rule for sky stars and temperature v0 record part (place-only day counts)"
```

2) 웹 - 우리의 하늘

```
git add web/src/features/records/dayRecordRead.ts
git add web/src/features/main/activityRead.ts
git add web/src/features/main/startTemperatureV0.vitest.tsx
git add web/src/features/sky/skyMath.ts
git add web/src/features/sky/skyData.ts
git add web/src/features/sky/useSkyPull.ts
git add web/src/features/sky/SkyScreen.tsx
git add web/src/features/sky/skyMath.vitest.ts
git add web/src/features/sky/skyScreen.vitest.tsx
git add web/src/features/sky/skyData.vitest.tsx
git add web/src/tabs/MainTab.tsx
git add web/src/stores/coupleStore.ts
git add web/src/cache/deviceCache.ts
git add web/src/app/routes.ts
git add web/src/app/routeTable.tsx
git add web/src/app/backRules.ts
git add web/src/app/backRules.vitest.ts
git add web/src/styles.css
git commit -m "77 web: our sky stage 1 - pull down from main, month sky, past skies, star day sheet, day photos, empty sky, anniversary stars"
```

3) 상태

```
git add .claude/state/HANDOFF.md
git add .claude/state/PROGRESS.md
git commit -m "77 state: decisions, board comparison, fixed photo gps command, phone check order"
```

마지막 `git status --short`에는 `web/android/.idea/deploymentTargetSelector.xml` 한 줄만 남는다(커밋하지 않음 - 되돌리려면 `git restore web/android/.idea/deploymentTargetSelector.xml`).

### 77- 폰 확인 순서 (Proteur · 녹화 · 방해 금지 모드)

1. `cd web; npm run build:trial; npx cap sync android` → Android Studio 빌드 → 두 폰 **앱 위에 덮어 설치**(데이터 유지)
2. 메인 맨 위에서 아래로 끌어내리기 - "놓으면 하늘이 열려요" · 덜 끌면 제자리 · 메인을 스크롤하다 맨 위에 닿는 순간 오작동 0 · 보통 스크롤 감각 그대로
3. 이달의 하늘 - 별이 날짜 순서로 0.22초 간격 켜짐 · 60초 흐름 · 장소만 적은 날도 별 · D+n · 달(발행 호 · 초안)
4. 별 누르기 - 다가가며 나머지 흐려짐 · 시트(장소 · 그날의 온도 · 첫 구간 장소 제목 · 메모 · 사진/메모 수 · "{M}월의 {k}번째 별") · [그날 기록 →]이 피드 상세로
5. [사진 보기] - 그날 사진만 · 좌우 넘기기 · 썸네일 줄
6. 지난 하늘 - 위로 끌기 · 달마다 "{M}월 · 별 n" · 이번 달 근처에서 놓으면 돌아옴 · 먼 달에서는 머묾(손맛 PM 판단)
7. 기념일 - D+100 · D+200 고리(그날 별이 있으면 고리 별 → 누르면 ANNIVERSARY 시트)
8. 빈 하늘 - 다음 커플 모드 초기화 직후 첫 연결에서(C06 · [데이트 기록하기])
9. 줄인 모션 - 폰 설정 "애니메이션 제거" 켜고 정지 하늘인지
10. 폰 B(LG V40) - 별 많은 달 · 지난 하늘 스크롤에서 끊김 없는지(녹화 0.1초 판독)

 위임문 `76-dispatch-fix.md` · 대기 목록 `76-next-fix-backlog.md` · R98 · R99 · R100 · MASTER r74 10-7-3) - 완료 (미커밋)

범위: `web/src/` · `src/engine/temperature.ts`(+ 레지스트리) · 마이그레이션 1개(`20261115160000_m2_unschedule_retention.sql`) · PGlite 시험 1개 · 엔진 시험 · 디자인 백로그 §16 · §17 · HANDOFF · PROGRESS. 위임: engine-dev 1 · db-architect 1 · ui-builder 2. 원격 0 · 새 패키지 0 · 네이티브 손수정 0 · RN 0.
검증(메인 세션 직접 재실행): web tsc 0 · Vitest 44/796 → **51/863** + 1 건너뜀 · `LEGAL_CHECK=1` 법무 관문 7/7 · `build` · `build:trial`(dist는 시험 빌드 상태) · `cap sync android`(web/android 추적 변경 0) · 루트 tsc 0 · jest 104/1805 → **106/1834**(PGlite 포함) · PGlite 3/60 → **4/64** · Python(아래 PROGRESS 줄). 키 · 주소 · 이메일 · ref 0(동의 상수 파일 밖 운영자 · 문의 메일 0) · 파일 이름 ASCII.

### 멈춘 것

| 항목 | 이유 | 다음 |
|---|---|---|
| **D2 하루 지우기(76-m3 RPC + 피드 밀기)** | 범위 "그날 내가 남긴 **장소** · 사진 · 메모"인데 `date_stops`에 작성자 칸이 없다(`006_archive.sql:53~74`). 사진 · 메모는 `data_entries.author_id`로 가를 수 있으나 장소는 누가 넣었는지 서버가 모른다 → m3 "RPC" 밖 스키마 변경(작성자 칸 + 기존 행 처리)이 필요. Proteur 확인으로 멈춤. m3 파일 없음 | PM 결정: ① `date_stops.created_by` 추가(기존 장소는 작성자 모름 → 남김) ② 스키마 그대로, 내 사진 · 메모를 지운 뒤 항목이 0인 장소만 지움(상대가 사진 없이 넣은 장소도 지워질 수 있음) ③ 사진 · 메모만 지우고 장소는 남김. E01 대조 결과 카드 안 가로 사진 줄은 없어 밀기 영역 충돌은 없음 |
| C4 일부 "{상대}님이 커플 닉네임을 바꿨어요" | 설정의 닉네임 변경은 `nickname`만 쓰고 표시 칸(`start_date_set_by` · 확인)을 남기지 않음, 재표시 화면은 날짜 변경에서만 열림 → 구분할 데이터 · 화면 없음(새 화면은 Part 9 밖) | PM 판단(데이터 칸이 필요하면 마이그레이션) |
| C5 저장 지역 | 멈춤 아님 - Proteur가 이미 넣음(`consent.ts:13` "대한민국 서울", 커밋 `3e3e253`) · 법무 관문 7/7 재실행 통과 | 닫음 |

### 0단계

| # | 결과 |
|---|---|
| 0-1 B2 GPS | **Proteur 명령 준비됨** - 아래 "0-1 명령". 메모리로만 내려받아 "GPS 있음/없음 · 방향 태그 있음/없음 · 형식 · 픽셀 크기"만 출력(파일 쓰기 0 → 지울 파일 없음, id · 경로 · 주소 출력 0). 판독기는 Pillow로 만든 GPS + 방향 JPEG · PNG · 표본 JPEG로 로컬 확인 |
| 0-2 카메라 복귀 | **앱 재시작(웹뷰 다시 불러오기)**. 경로 복원 코드는 없었음 - `App.tsx` `MemoryRouter initialEntries=[initialPath]` 기본 `/intro`, 재시작 뒤 `useBootSession`이 `resolveWebRoute` → 'main'. 머리 "상대"는 재시작으로 스토어가 빈 첫 마운트(`usePartnerName` 초기 null). 카메라는 웹 `<input capture>`라 `appRestoredResult` 해당 없음. 고침: 마지막 탭 기기 저장 · 10분 안 재시작이면 그 탭으로(부작용: 카메라가 아니어도 10분 안 재실행은 마지막 탭에서 시작). 녹화의 "설정 탭 0.3초"는 코드로 재현 안 됨 → 폰 확인 |
| 0-3 스크롤 | 사용자 정의 관성 · CSS `scroll-behavior: smooth` · `touchmove` 가로채기 **0**. 덧씌운 것은 결과 상세의 등장 연출(IntersectionObserver `ui.tsx` · 시간 기반 막대 · 삼각형 · 카드 지연 `screens.tsx`)과 상세 화면 스크롤 앵커링 → 고침. 기능상 남김: 채팅 맨 아래 붙기(`useStickToEnd`, 손대면 멈춤) · 피드 월 칩 smooth 이동(누를 때만) · 키보드 입력 칸 보이기 · `overscroll-behavior`(바운스만) · 확대 · 스토리 `touch-action` |
| 0-4 잠긴 행 | **Proteur 명령 준비됨** - 아래 "0-4 명령"(건수만) |

### 보드 대조 (다른 곳만)

| 보드 | 차이 |
|---|---|
| E01 | 카드 안 **가로 사진 줄 없음**(보드 · 앱 모두 사진 한 장 카드) → D2 밀기 영역 충돌 없음. 피드형/지도형 토글 숨김(지도 범위 밖) · 월 머리 요약 "메모 · 사진 · 데이트"(CURRENT.md 변경, 별 0). 나머지 구성 같음 |
| F03 | 아래 안내 문구가 약 15px 높음 · 아바타 위치 약 3px · 보드는 둘째 막대가 셋째보다 밝아 보임(앱은 남은 칸 모두 25%, 의도 불분명) · 배경 질감은 시험 사진 차이. ✕ · 이름 · 시간 · 막대 두께 · 간격 같음. 열림 · 닫힘 연출은 보드에 없는 R98-7 결정 |

### 76- 결정 기록

| 결정 | 출처 |
|---|---|
| 온도 v0 `activity_v0_provisional`을 `src/engine/temperature.ts` 한 곳에(엔진 1.2.0). 계수 0.6 · 0.4 · 60 · 0.5 · 14 · 55 · 0은 `ACTIVITY_V0_PROVISIONAL_COEFFICIENTS` 한 곳, 호출부 주입. "오늘"은 인자(`todayKst`), 엔진은 시계 0. 진입점 `computeDailyTemperatureV0` · `computeActivityDeltaV0` · `kstDayKey`. `UNRESOLVED('temperature.activityScore')` 레지스트리에서 제거 | R100-1 · MASTER r74 10-7-3 |
| **throw 기대 시험 교체**(MASTER 10-7-3 · 16-2 예외): `__tests__/engine/temperatureBaseline.test.ts` 157 · 161 · 229 · 240줄 근처 4건을 v0 기대값으로, `unresolved.test.ts`의 activityScore throw → "레지스트리에 없음" | MASTER 10-7-3 · 16-2 |
| 문서 후속(편집 범위 밖, PM): MASTER 16-2 레지스트리 표 · "Phase 7 선행" 체크리스트에 `temperature.activityScore`가 남아 코드와 어긋남. `src/engine/dnaScore.ts` 184 · 196줄 주석이 옛 `DailyActivityRaw` 이름(동작 무관) | 보고 |
| 앱 표시: 저장된 `daily_temperature`가 있으면 저장값, 없으면 v0(기저 + 활동). 읽기만 - 어제까지 14일(KST) 메시지(지운 것 제외 · 사진 포함 · 오늘 제외)를 1000행 페이지로, 30페이지 넘으면 (날짜 × 사람) 건수 28요청으로. 하나라도 실패하면 기저만. 값은 다 읽은 뒤 한 번만 바뀜 | R100-1 · R83-7 |
| "데이트 기록 있음" = 지우지 않은 `dates` 중 `photo_count > 0` 또는 `has_user_note`(삭제 RPC 023이 dates 행을 남기고 파생 칸만 맞추므로 행 존재로는 부족). **PM 확인**: 장소만 있고 사진 · 메모가 없는 날은 기록 없음으로 셈 | R100-1 |
| **PM 확인**: "시작 온도예요. 기록이 쌓이면 다음 날부터 움직여요."는 활동분 0일 때만(표시 = 기저). 활동분이 있으면 숨김. 그때 기존 보조 문구 "첫 온도는 기록한 다음 날 나와요"는 남음 | 메인 세션 |
| `76-m2`: `select cron.unschedule('retention-policy')` 한 문장. 함수 · 다른 cron · 데이터 0. 다시 켜기는 M4(구독 · E12 · 사전 고지와 함께 새 마이그레이션). PGlite 스텁에 `cron.unschedule` 추가(**허가 밖 파일** `scripts/db/pgliteMigrations.ts` +2줄 - 없으면 새 파일 적용에서 모든 PGlite 시험이 깨짐) | R100-2 |
| A1 기기 저장 = `localStorage`(동기 - 첫 그림에 "상대" 0), 키에 사용자 id(`ondolog.dc1:{userId}:…`). 채팅 최근 100건(보내는 중 · 실패 · 미리보기 제외) · 상대 이름 · 메인 요약 · 피드. 사진은 경로만, 서명 URL은 메모리 45분만. 지움: 로그아웃 · 탈퇴 요청 → 전부, 계정 전환 → 다른 사용자 것, **해제 완료 또는 해제 유예 진입** → 커플 자료(유예 진입 때 지우는 것은 R98-1보다 이른 시점 - 보수 쪽) | R98-1 · R99-2 P3 · P5 |
| A2 원인: 띠는 연결 모니터가 아니라 채팅 큐 안내(F05)였음 - 사진이 올라가기 시작하자마자 큐 `pending`으로 세어 "끊겼어요"가 뜸. 지금 시도 중인 항목은 세지 않음 + 거부된 업로드는 `navigator.onLine` + 짧은 확인 요청으로만 판정 | R98-2 |
| B1 스토리 실시간: `stories`는 이미 realtime publication(018)에 있어 마이그레이션 0, 폴링 0. 채팅 탭에서만 구독 | R98-3 |
| B3: 메시지 행에 width/height 칸 없음, 사진 칸은 이미 고정 높이(220px) → "높이 변화" 가설은 코드로 확인 안 됨. 맨 아래 붙기 재시도 · 서명 URL 재사용만. 튐 원인은 폰 확인 | R99-2 P1 |
| B4: 상세 경로에 코드 스크롤 0(시험 고정). 스크롤 앵커링 끔 · 히어로 `contain` · 한 장 사진 칸은 `width/height` 비율(0.75~1.78). 저절로 내려감 원인은 폰 확인 | R99-2 P2 |
| B2 0%: 초안이 없으면 이번 달(KST 1일~말일)을 `features/magazine/monthProgress.ts` `monthPeriodOf` 한 곳에서 만들어 같은 `periodElapsedPercent`로. 초안이 있으면 초안 값. 기간을 주는 설정이 없어(`app_config.issue_cycle`은 압축 시뮬레이션 값) 이 함수 한 곳에 둠 - 주기를 바꿀 때 여기만 | R98-4 (a) |
| C4: 처음 연결/설정 변경 구분 = `StartDateScreen` `mode`(onboarding/recheck). 제목 "{상대}님이 커플 닉네임을/사귄 날짜를/먼저 정했어요" · 재표시 "{상대}님이 사귄 날짜를 바꿨어요" + 둘째 줄 새 날짜. **PM 확인**: 제목과 겹치던 본문 "상대가 먼저 '…'로 정했어요" 제거 · 재표시에서 큰 날짜 줄 숨김 | R99-1 |
| D1 스토리 연출: 닫힘 0.22초 · 0.92배 + 투명, 열림 반대, ✕ · 자동 닫힘 · 아래로 밀기(80px) 같음, 줄인 모션 투명 0.15초. 디자인 백로그 §16에 기록 · §17 하늘 둘러보기 요청 기록(둘 다 미발송) | R98-7 · R99-5 |
| C3: 원인 코드로 확정 못함 - 본문은 페이드인데 아래 고정 버튼은 즉시 보여 "버튼만" 순간이 생기는 구조 → 버튼도 같은 0.26초 페이드(온보딩 전체, 줄인 모션 제외) | R98-3 |

### 온도 v0 예시 (시험 출력 그대로)

`__tests__/engine/temperatureActivityV0.test.ts` - "하루 30건 · 두 사람 다 · 14일 중 4일 데이트 기록": **활동분 22.8**(합 5.8 / 14 × 55 = 22.79, 문서 "≈ +22.9"와 근사) · 기저 42(1 · 7 잘 맞음) + 22.8 = **64.8**.

### 0-1 명령 (Proteur · 맨 위 폴더 · 키 줄 다음 확인 줄)

`ops_2026_11` secret key를 보안 입력하고(`ONDOLOG_SUPABASE_SERVICE_ROLE_KEY`), 주소 변수 `ONDOLOG_SUPABASE_URL`은 "키 넣는 안내" 그대로. 확인 줄 `$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY.StartsWith('sb_secret_')` → `True`일 때만. 그다음 아래 한 덩어리를 그대로 붙여 넣는다(파일을 만들지 않고 표준 입력으로 실행). 출력은 두 줄 "chat photo: JPEG | GPS none | orientation tag present | 4032x3024" 꼴(77- 0-2 정정: 메시지 정렬 `sent_at` · 오류 코드 표시 · 영어 출력 - PowerShell 파이프 한글 깨짐) - 그 두 줄만 PM에 전달. 끝나면 창을 닫고 새 창에서 `[bool]$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY` → `False`.

```
@'
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
type Info = { gps: boolean; orientation: boolean; size: string; kind: string }
function inspect(b: Uint8Array): Info {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  if (b[0] === 0x89 && b[1] === 0x50) {
    let p = 8, size = '?', gps = false
    while (p + 8 <= b.length) {
      const len = dv.getUint32(p); const t = String.fromCharCode(...b.subarray(p + 4, p + 8))
      if (t === 'IHDR') size = `${dv.getUint32(p + 8)}x${dv.getUint32(p + 12)}`
      if (t === 'eXIf') gps = gps || tiff(b, p + 8).gps
      p += 12 + len
    }
    return { gps, orientation: false, size, kind: 'PNG' }
  }
  if (b[0] !== 0xff || b[1] !== 0xd8) return { gps: false, orientation: false, size: '?', kind: 'unknown format' }
  let p = 2, gps = false, orientation = false, size = '?'
  while (p + 4 <= b.length && b[p] === 0xff) {
    const m = b[p + 1]
    if (m === 0xd9 || m === 0xda) break
    const len = dv.getUint16(p + 2)
    if (m === 0xe1 && String.fromCharCode(...b.subarray(p + 4, p + 8)) === 'Exif') { const r = tiff(b, p + 10); gps ||= r.gps; orientation ||= r.orientation }
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) size = `${dv.getUint16(p + 7)}x${dv.getUint16(p + 5)}`
    p += 2 + len
  }
  return { gps, orientation, size, kind: 'JPEG' }
}
function tiff(b: Uint8Array, s: number): { gps: boolean; orientation: boolean } {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const le = b[s] === 0x49
  const u16 = (o: number) => dv.getUint16(s + o, le), u32 = (o: number) => dv.getUint32(s + o, le)
  const ifd0 = u32(4); const n = u16(ifd0)
  let gps = false, orientation = false
  for (let i = 0; i < n; i++) {
    const e = ifd0 + 2 + i * 12; const tag = u16(e)
    if (tag === 0x0112) orientation = true
    if (tag === 0x8825) { const g = u32(e + 8); gps = u16(g) > 0 }
  }
  return { gps, orientation }
}
function line(label: string, i: Info | null): void {
  if (!i) { console.log(`${label}: no photo`); return }
  console.log(`${label}: ${i.kind} | GPS ${i.gps ? 'present' : 'none'} | orientation tag ${i.orientation ? 'present' : 'none'} | ${i.size}`)
}
const url = Deno.env.get('ONDOLOG_SUPABASE_URL'), key = Deno.env.get('ONDOLOG_SUPABASE_SERVICE_ROLE_KEY')
if (!url || !key) throw new Error('URL or key variable is empty')
const db = createClient(url, key, { auth: { persistSession: false } })
const get = async (bucket: string, path: string | null | undefined): Promise<Info | null> => {
  if (!path) return null
  const { data, error } = await db.storage.from(bucket).download(path)
  if (error || !data) { console.log(`${bucket}: download failed (${String((error as { statusCode?: string })?.statusCode ?? '')} ${String(error?.message ?? '').slice(0, 80)})`); return null }
  return inspect(new Uint8Array(await data.arrayBuffer()))
}
const m = await db.from('messages').select('media_path').not('media_path', 'is', null).is('deleted_at', null).order('sent_at', { ascending: false }).limit(1)
if (m.error) throw new Error(`messages read failed: ${m.error.code ?? ''} ${String(m.error.message ?? '').slice(0, 80)}`)
line('chat photo', await get('messages', m.data?.[0]?.media_path))
const e = await db.from('data_entries').select('storage_path').eq('entry_type', 'photo').is('deleted_at', null).order('created_at', { ascending: false }).limit(1)
if (e.error) throw new Error(`data_entries read failed: ${e.error.code ?? ''} ${String(e.error.message ?? '').slice(0, 80)}`)
line('feed photo', await get('entries', e.data?.[0]?.storage_path))
'@ | deno run --no-lock --allow-net --allow-env --allow-read -
```

### 0-4 명령 (Proteur · 대시보드 SQL 편집기 · 읽기만 · db push **전에**)

키 필요 없음. 결과 숫자 하나만 PM에 전달(값 · id 0):

```
select count(*) as locked_rows from public.data_entries where access_locked;
```

(`access_locked`는 `data_entries`에만 있다. m2는 이미 잠긴 행을 풀지 않는다 - 0이 아니면 PM 판단.)

### 76- `db push` 순서 (Proteur · 맨 위 폴더 · 값 출력 0)

키 필요 없음(link된 CLI). 비밀번호를 물으면 화면 입력 칸에만.

1. `npx supabase migration list` → `20261115160000`만 Local에만 있고 그 앞(`20261115150000` 포함)은 Local · Remote 같아야 한다.
2. `npx supabase db push --dry-run` → **`20261115160000_m2_unschedule_retention.sql` 하나만**. 다른 것이 보이면 멈추고 보고. (m3는 D2 멈춤으로 **없다** - 위임서의 "두 파일"이 아니라 한 파일)
3. `npx supabase db push`
4. `npx supabase migration list` → 양쪽에 있으면 끝. (선택) 대시보드 SQL 읽기만: `select jobname from cron.job order by 1;` → `retention-policy`가 없고 `execute-dissolutions` · `expire-stories`만.

### 76- 커밋 명령 (Proteur, 맨 위 폴더에서 · 한 줄씩)

1) 엔진 - 온도 v0

```
git add src/engine/temperature.ts
git add src/engine/constants/unresolved.ts
git add __tests__/engine/temperatureBaseline.test.ts
git add __tests__/engine/unresolved.test.ts
git add __tests__/engine/temperatureActivityV0.test.ts
git commit -m "76-T engine: temperature activity v0 provisional (chat 0.6 + record 0.4, KST days, 14 days to yesterday)"
```

2) 서버 - 보관 정책 일정 끄기(m2)

```
git add supabase/migrations/20261115160000_m2_unschedule_retention.sql
git add __tests__/db/retentionUnschedule76m2.test.ts
git add scripts/db/pgliteMigrations.ts
git commit -m "76-m2 db: unschedule retention-policy cron during trial; pglite cron.unschedule stub"
```

3) 웹 - 기기 저장 · 연결 · 채팅 · 스토리

```
git add web/src/cache/deviceCache.ts
git add web/src/cache/signedUrlCache.ts
git add web/src/features/chat/chatCache.ts
git add web/src/connection/queueNotice.ts
git add web/src/connection/connectionMonitor.ts
git add web/src/connection/connection.vitest.tsx
git add web/src/photoQueue/photoQueueHub.ts
git add web/src/App.tsx
git add web/src/auth/useBootSession.ts
git add web/src/bootRestore76.vitest.tsx
git add web/src/app/useAccountData.ts
git add web/src/stores/coupleStore.ts
git add web/src/features/settings/accountActions.ts
git add web/src/features/settings/WithdrawScreen.tsx
git add web/src/features/chat/ChatView.tsx
git add web/src/features/chat/StoryViewer.tsx
git add web/src/features/chat/useChatMessages.ts
git add web/src/features/chat/useChatQueueResume.ts
git add web/src/features/chat/useSignedMedia.ts
git add web/src/features/chat/chat.vitest.tsx
git add web/src/features/chat/chatData.vitest.tsx
git add web/src/features/chat/storyViewer.vitest.tsx
git add web/src/features/chat/offlineCache76.vitest.tsx
git add web/src/features/feed/feedData.ts
git add web/src/features/feed/feed.vitest.tsx
git add web/src/features/feed/feedCache76.vitest.tsx
git add web/src/features/main/useMainData.ts
git commit -m "76 web: device cache for offline chat and main, honest offline banner during uploads, story realtime, last tab restore, story open close motion"
```

4) 웹 - 온도 표시 · 진행률 · 상세 · 결과 스크롤 · 문구 (styles.css는 두 묶음이 함께 고침 → 여기서 한 번)

```
git add web/src/features/main/activityRead.ts
git add web/src/features/main/startTemperature.ts
git add web/src/features/main/startTemperatureV0.vitest.tsx
git add web/src/features/main/MainView.tsx
git add web/src/features/main/main.vitest.tsx
git add web/src/tabs/MainTab.tsx
git add web/src/features/magazine/monthProgress.ts
git add web/src/features/magazine/monthProgress.vitest.ts
git add web/src/features/magazine/LibraryView.tsx
git add web/src/features/magazine/magazine.vitest.tsx
git add web/src/features/feed/DateDetailScreen.tsx
git add web/src/features/feed/photoBox.ts
git add web/src/features/feed/detailPhotoBox76.vitest.tsx
git add web/src/ui.tsx
git add web/src/screens.tsx
git add web/src/scrollReveal76.vitest.tsx
git add web/src/couple/coupleApi.ts
git add web/src/features/couple/StartDateScreen.tsx
git add web/src/features/couple/couple.vitest.tsx
git add web/src/features/couple/coupleApi.vitest.ts
git add web/src/styles.css
git commit -m "76 web: show temperature v0 when no stored value, month progress without draft, fixed detail photo boxes, reveal passed elements, shared value notice titles"
```

5) 문서 · 상태

```
git add .claude/state/prompts/phase-7/PM_request_design_render_issue_v1_2_3.md
git add .claude/state/HANDOFF.md
git add .claude/state/PROGRESS.md
git commit -m "76 state: decisions, db push order, ops commands, design backlog 16 and 17"
```

마지막에 `git status --short`가 빈 출력이어야 한다.

### Proteur 다음 순서 (R100-3)

1. 0-4 건수 읽기(위, db push 전) · 0-1 GPS 두 줄(아무 때나)
2. 커밋(위 다섯 묶음)
3. `db push`(m2, 위 순서)
4. `cd web; npm run build:trial; npx cap sync android` → Android Studio 빌드
5. 두 폰 **앱 위에 설치(삭제하지 않음) - 데이터 유지, 3일치 기록 이어짐**
6. 76- 폰 확인(녹화 · 방해 금지 모드 · 메일 · 카카오 화면 일시정지): 비행기 모드로 채팅 · 메인 열기(마지막 대화 · 이름 · 온도 · D+) · 카메라 촬영 후 복귀(채팅으로 · 머리 "상대" 0) · 로그아웃 → 다른 계정 로그인 시 이전 대화 0 · 사진 · 스토리 올리는 중 끊김 띠 0 · 비행기 모드 끄는 즉시 큐 전송 · 채팅 탭에 머문 채 상대 스토리 바로 뜸 · 스토리 닫힘/열림 연출 · 채팅 진입 목록 튐 · 상세 큰 사진 밀림/저절로 내려감 · 상세 → 피드 회색 자리 0 · 결과 상세 빠른 튕김 빈 화면 0 · 메인/매거진 퍼센트 = 이번 달 경과율 · 다음 날 온도가 움직이는지 · 설정에서 날짜 바꿀 때 상대 폰 제목 "…님이 사귄 날짜를 바꿨어요" · (연결 전 상태가 생기면) 연결 순간 버튼만 남는 화면 0
7. `51-` 남은 것: 시드 호 · 서재(B11 · B12) · 해제 · 탈퇴(맨 끝) · D2(PM 결정 뒤) · B21 재설치 · C12

## `75-b` 빌드 전 보충 (메인 세션, 2026-11-15, 위임문 `75-b-dispatch-prebuild.md` · R94-0~10) - 완료 (미커밋)

범위: `web/` · 마이그레이션 1개(`supabase/migrations/20261115150000_m1_grace_invite_block.sql`, R94-1 승인) · PGlite 시험 1개 · 디자인 백로그 16번 한 줄 · HANDOFF · PROGRESS. 원격 0 · 새 패키지 0 · 네이티브 손수정 0 · RN · 루트 `src/` 0. 검증: web tsc 0 · Vitest 43/766 → 44/796 + 1 건너뜀 · `LEGAL_CHECK=1` 법무 관문 7/7 · `build` · `build:trial` · `cap sync android` · 루트 tsc 0 · jest 103/1789 → 104/1805 · PGlite 2 suite → 3 suite / 57(+16) · Python 324. 동의 상수 파일 밖 운영자 이름 · 문의 이메일 0건.

멈춘 것: 없음.

### 75-b 결정 기록

| 결정 | 출처 |
|---|---|
| 서버 거부 고정 코드: **OG001** = 해제 유예(dissolving 커플의 user_a · user_b 어느 쪽이든) · **OG002** = 탈퇴 유예(`profiles.deleted_at` 있음). 둘 다면 OG002 먼저(탈퇴 요청이 커플도 dissolving으로 만듦) | R94-1 |
| 초대 발급 거부 = `couples` BEFORE INSERT 트리거 `tg_couples_block_grace_invite`. `auth.uid()`가 없으면(service_role · 운영 시드) 검사하지 않음 - `seedTestData.ts`의 active 커플 직접 삽입을 깨지 않으려고 | R94-1 |
| `fn_connect_couple`은 026 본문 그대로 + "이미 커플" 23505 앞에 부르는 사람 · 초대한 사람의 OG002 → OG001 검사. 권한 authenticated만 재선언. 해제 · 탈퇴 · 취소 함수와 `execute_dissolution`은 변경 0. 해제 취소 뒤에는 커플이 active로 돌아가 기존 23505, 탈퇴 취소 뒤 커플 없던 사용자는 다시 발급 · 연결 가능(시험) | R94-1 |
| active 커플 user_b의 pending 초대 행: insert는 서버가 막지 않음(고유 인덱스는 user_a만 봄). 그러나 그 코드로 연결은 불가 - `fn_connect_couple` 9)가 코드 주인(`v_row.user_a_id`)과 입력한 사람(`v_uid`)을 양쪽 열(user_a · user_b)에서 active · dissolving으로 검사해 23505(m1 파일 132~138줄, 026 원본 113줄). 앱은 연결 상태에서 초대 입구가 없음 → **낮음(M3)**. 75-t1 PGlite 시험으로 확인: 코드 주인이 active면 23505 · dissolving이면 OG001 · 새 커플 0(`__tests__/db/graceInviteBlock75m1.test.ts:209`~) | R95-3 · R96-2 |
| 앱 연결: 발급 · 코드 입력의 오류 `code`로 분기 - OG001 → "해제 예정 기간에는 새로 연결할 수 없어요"(`GRACE_NO_INVITE`) · OG002 → "지금은 연결할 수 없는 계정이에요"(새 문구, 탈퇴 사실을 드러내지 않음). `web/src/couple/graceCopy.ts`. 루트 `coupleConnectCore`는 `code`를 보존해 변경 0 | R94-1 · A-24 |
| HEIC 막기: 파일 앞 바이트(`ftyp` 브랜드)로만 판정 - heic · heix · hevc · hevx · heim · heis · hevm · hevs · heif, 또는 주 브랜드 mif1 · msf1이면서 avif · avis가 없을 때. AVIF는 막지 않음. 판정은 `web/src/photo/heicGuard.ts` 한 곳, 거르는 입구는 `photoPicker.ts` `chooseFiles` 한 곳(채팅 · 스토리 · 피드 · 카메라 · 갤러리 플러그인 모두 지남). 여러 장 중 일부면 그 장만 빼고 "… 골라 주세요. N장은 뺐어요." | R94-2 |
| 스토리 자동 넘김: 한 장 5000ms · 막대 채움 · 좌우 탭 앞뒤 · 누르면 멈춤(250ms 이상 누른 뒤 뗀 것은 탭이 아님) · 마지막 뒤 닫힘. 줄인 모션이면 채우는 움직임만 빼고 5초 넘김은 유지. 모션 허용 한 줄은 `StoryViewer.tsx` 머리 주석(DESIGN §6 문서는 이번 편집 범위 밖) · 디자인 백로그 16번 = `PM_request_design_render_issue_v1_2_3.md` §16(미발송 묶음 파일, 번호를 이어 붙이는 규칙) | R94-6 |
| 매거진 0% 문장 "이번 달이 흐르는 만큼 차올라요. 달이 끝나면 두 사람의 호를 만들어요." - 탭 빈 상태 · 메인 첫 호 카드가 같은 상수. 계산 변경 0, 75- 후보 삭제 | R94-7 |
| [솔로예요] 아래 작은 글 "나중에 메인에서 언제든 연인을 초대할 수 있어요."(온보딩 모양에만) | R94-4 |
| 마케팅 동의 v1.1 §5를 네 번째 문서로 `consent.ts`에(문장 그대로, 메인 세션 대조 - 빠진 문장 0) · 동의 화면 ⑤ [보기] 되살림 · 설정 → 개인정보 & 약관에 "마케팅 정보 수신 동의 안내" 행. 버전 = `web/package.json` 값(75-에서 이미 그렇고 "최신" 없음 - 확인만) | R94-9 |
| 피드 날짜 카드 눌림 연출 제거, 길게 눌러 지우기는 상세 항목만(이미 그랬음) | R94-8 |
| A-2-1은 M3로(안내문 위치만 받음) · 새 문구는 잠정 승인 → `51-` 녹화로 PM 확정 | R94-3 · R94-9 |

### 카메라 스위치 (R94-5)

- 위치: `web/src/photo/galleryPlugin.ts`의 `export const GALLERY_MODE` (`galleryModeFor(IS_TRIAL_BUILD)`).
- `npm run build:trial`(`--mode trial`) · `npm run dev` → `'plugin'`(켜짐). `npm run build`(운영) → `'input'`(꺼짐).
- 시험 빌드에서도 끄려면: `export const GALLERY_MODE: GalleryMode = 'input'`으로 고정 → `npm run build:trial` → `npx cap sync android` → 다시 설치.
- 확인: `51-` B1 · B14에서 폰 B로 지난달 사진을 골라 기록 날짜(촬영 시각)가 남는지. 남으면 PM이 확정, 안 남으면 위처럼 끄고 보고.

### 75-m1 `db push` 순서 (Proteur · 맨 위 폴더 · 값 출력 0)

키는 필요 없다(link된 CLI로 한다). CLI가 데이터베이스 비밀번호를 물으면 화면 입력 칸에만 넣는다. 혹시 secret key를 넣어야 하는 경우에만: 보안 입력 → `$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY.StartsWith('sb_secret_')` 확인 줄 `True` → 끝나면 창을 닫고 새 창에서 `[bool]$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY` → `False`(R92-3).

1. 무엇이 올라갈지 보기:

```
npx supabase migration list
npx supabase db push --dry-run
```

   - `migration list`: `20261115150000`이 Local에만 있고, 그 앞은 Local · Remote가 같아야 한다.
   - `--dry-run`: `20261115150000_m1_grace_invite_block.sql` **하나만** 보여야 한다. 다른 것이 보이면 멈추고 보고.

2. 실제 적용:

```
npx supabase db push
```

3. 적용 확인(값 출력 0):

```
npx supabase migration list
```

   - `20261115150000`이 Local · Remote 양쪽에 있으면 끝. (선택) 대시보드 SQL 편집기에서 읽기 전용으로 아래를 돌려 둘 다 `true`인지:

```
select exists(select 1 from pg_trigger where tgname='tg_couples_block_grace_invite' and not tgisinternal) as trigger_ok,
       (select prosrc like '%OG001%' from pg_proc where proname='fn_connect_couple' and pronamespace='public'::regnamespace) as connect_ok;
```

4. 폰 확인은 `51-` ⑬ 해제 · 탈퇴 단계에서(아래 8번).

### 75-b 커밋 명령 (Proteur, 맨 위 폴더에서 · 한 줄씩)

`75-` 파일은 모두 이미 커밋됨: `b2a849a` · `206a846` · `111f5d1` · `f6b9d88` · `706c1a3`. 아래는 아직 커밋되지 않은 것 전부다.

1) 서버 규칙(m1)

```
git add supabase/migrations/20261115150000_m1_grace_invite_block.sql
git add __tests__/db/graceInviteBlock75m1.test.ts
git commit -m "75-m1 db: reject invite issue and couple connect during dissolution or withdrawal grace with fixed codes OG001 OG002"
```

2) 웹 앱

```
git add web/src/couple/graceCopy.ts
git add web/src/couple/coupleApi.ts
git add web/src/app/inviteEntry.ts
git add web/src/features/couple/InviteScreen.tsx
git add web/src/features/couple/couple.vitest.tsx
git add web/src/photo/heicGuard.ts
git add web/src/photo/heicGuard.vitest.ts
git add web/src/photo/stripLocation.ts
git add web/src/photo/galleryPlugin.ts
git add web/src/photo/galleryPlugin.vitest.ts
git add web/src/features/feed/photoPicker.ts
git add web/src/features/feed/FeedView.tsx
git add web/src/features/feed/feed.vitest.tsx
git add web/src/features/chat/StoryViewer.tsx
git add web/src/features/chat/storyViewer.vitest.tsx
git add web/src/features/chat/chat.vitest.tsx
git add web/src/features/magazine/firstIssueHint.ts
git add web/src/features/magazine/magazine.vitest.tsx
git add web/src/features/main/main.vitest.tsx
git add web/src/features/settings/PrivacyScreen.tsx
git add web/src/legal/consent.ts
git add web/src/legal/legal.vitest.tsx
git add web/src/screens.tsx
git add web/src/styles.css
git commit -m "75-b web: block heic by file bytes, story auto advance, marketing consent text, grace error codes, camera plugin on trial builds only"
```

3) 문서 · 상태

```
git add .claude/state/prompts/phase-7/PM_request_design_render_issue_v1_2_3.md
git add .claude/state/HANDOFF.md
git add .claude/state/PROGRESS.md
git commit -m "75-b state: decisions, db push order, design backlog 16, phone check order"
```

### Proteur 다음 순서 (R94-10)

1. 커밋(위 세 묶음)
2. `db push`(m1, 위 순서)
3. `cd web; npm run build:trial; npx cap sync android` → Android Studio 빌드
4. **11월 15일**(시행일과 같은 날 · R95-4로 앞당김) 두 폰 앱 삭제 후 설치
5. 허용 목록 파일(아래 `75-` "0-6 잠금" 형식, 저장소 밖)
6. 커플 모드 초기화(`ops_2026_11` · 보안 입력 · `sb_secret_` 확인 줄 · `$al` · `--with-issues` · 끝나면 새 창 `False`)
7. 두 폰 새 계정 첫 가입
8. `51-` 49항목: **A-15 · A-4 · A-19 먼저, 0.5초 판독** · m1은 ⑬ 해제 · 탈퇴 단계에서 유예 중 초대 발급 · 코드 입력이 거부되고 안내가 뜨는지 · HEIC는 B3(안내 문장 · 섞인 묶음) · 카메라 플러그인은 B1 · B14(폰 B 촬영 시각) · 스토리 5초 넘김 · 누름 멈춤 · C13 마케팅 문서
9. 두 폰으로 3일치 기록
10. 시드 호 1권(B11 · B12)

## `75-` 최종 수정 (메인 세션, 2026-11-15, 위임문 `75-dispatch-final-fix.md` · 분류 `PM_triage_75-final-fix.md` · R93-1~8) - 완료 (커밋됨: b2a849a · 206a846 · 111f5d1 · f6b9d88 · 706c1a3)

범위: `web/` · `scripts/ops/` · `render/tests/` · `docs/74-exploration-guide.md` · `docs/51-device-checklist.md` · HANDOFF · PROGRESS. 마이그레이션 0 · 원격 0 · 커밋 0 · RN · 루트 `src/` · `supabase/` 변경 0 · 새 패키지 `@capacitor/camera` 8.2.6 1개(사전 허가 R76-7). 검증: web tsc 0 · Vitest 43 파일 / 766 통과 + 1 건너뜀(법무 값 관문, 기준 33 / 665) · `build` · `build:trial` · `cap sync android` 통과 · 루트 tsc 0 · jest 103 / 1789(기준 101 / 1771) · Python 324(기준 316) · Deno 초기화 시험 28(기준 24).

### 멈춘 것 (PM 결정 → 작은 후속 지시)

| 무엇 | 왜 | 필요한 변경(말로) | 그 사이 화면 쪽에서 한 것 |
|---|---|---|---|
| A-24 서버 부분(0-4) | `fn_connect_couple`은 active · dissolving 커플 소속이면 막는다. 그러나 ① 해제 유예(dissolving) 커플의 **user_b**는 초대 행(pending, user_a = 본인)을 새로 넣을 수 있다(고유 인덱스 `uq_couple_active_user_a`는 user_a 열만 본다 - 넣으면 같은 사람이 pending + dissolving 두 행에 걸려 `fetchExistingInvite`의 단일 행 읽기가 깨질 수 있음) ② **탈퇴 유예**(`profiles.deleted_at` 있음) 사용자가 커플이 없으면 초대 발급 · 연결 둘 다 막히지 않는다 | 초대 행 insert 정책(`couples_insert`)과 `fn_connect_couple`에 "부르는 사람 · 초대한 사람이 dissolving 커플의 어느 쪽이든 구성원이면 거부, `profiles.deleted_at`이 있으면 거부" 규칙 추가 | 메인 · 피드 · 매거진 · 게이트의 [연인 초대하기] 숨김, `openInvite` 중앙 차단, `getOrCreateInvite`가 유예 중이면 insert 전에 거부(23505 다섯 번 재시도 없음) |
| 0-1 HEIC | 브라우저에서 HEIC 위치 구획을 안전하게 떼는 방법을 표본 없이 검증할 수 없음 | PM: JPEG 변환 여부 결정 | JPEG(제자리 GPS 제거) · PNG(청크 제거) · 그 밖(캔버스 재인코딩, 픽셀 크기 그대로)은 제거됨. **HEIC는 지금 위치가 그대로 올라간다** |
| A-2-1 장소마다 [사진 더하기] | 사진의 장소는 루트 `assignStop`(규칙 4)과 `syncOwnPlacement`가 정하고 화면도 규칙 4로 다시 계산한다. 손 배치가 이기려면 루트 서비스 변경 + "손으로 넣음" 표시 저장(스키마 가능성) 필요 | `data_entries`에 손 배치 표시 칸(또는 동등한 규칙) + 루트 배치 함수가 그 표시를 존중 | 규칙 안내문만 사진 칸 바로 아래로 옮김(③) |
| A17 [솔로예요] | 위임서 지시 - 의도만 PM에게 | — | 변경 0 |

### 결정 기록

| 결정 | 출처 |
|---|---|
| 동의 상수 파일은 `web/src/legal/consent.ts`. 루트 `src/constants/consent.ts` · `legalDocuments.ts`는 RN이 읽는 파일이라 건드리지 않음(편집 허가 `web/`). 문의 메일(설정 → 앱 정보 → 문의하기)도 이 파일의 `LEGAL_CONTACT_EMAIL`을 읽는다 - 루트 `SUPPORT_EMAIL`은 웹에서 더 안 씀 | R38-2 · R93-5 · 위임서 범위 |
| 법무 값 4개(`LEGAL_OPERATOR` · `LEGAL_CONTACT_EMAIL` · `LEGAL_STORAGE_REGION` · `LEGAL_EFFECTIVE_DATE`): 운영자 · 문의 이메일 · 저장 지역은 Proteur가 직접 넣음, 시행일은 Proteur 확인으로 메인 세션이 넣음(2026-11-15, 첫 설치일 11월 17일 → R95-4로 11월 15일) - 네 값 모두 들어감, 관문 통과(6/6), 동의 상수 파일 밖 운영자 이름 · 문의 이메일 0건. 빌드 관문 = `cd web; $env:LEGAL_CHECK='1'; npx vitest run src/legal` (값이 비면 실패) | R93-5 · 위임서 0-7 |
| 세 문서 문장은 PM v1 그대로(굵은 표시 · 줄바꿈만 구조로). 메인 세션이 PM 원본과 문장 단위 대조 - 빠진 문장 0 | R93-5 |
| 마케팅 수신 동의는 PM 문장이 없어 동의 화면의 [보기]를 숨김(문장을 짓지 않음) | 위임서 "문장 수정 0" |
| 0-1 사진 위치 제거는 고르는 단계에서 한 번(`web/src/photo/stripLocation.ts`) - 채팅 · 피드 · 스토리 모두 그 바이트를 올림. 촬영 시각은 원본에서 먼저 읽음. GIF는 통과(재인코딩하면 움직임이 사라짐 - PM 확인) | R93-4 |
| 0-3 PDF: 누를 때마다 새 서명 주소 · 600초 · magazine 버킷 비공개(015) - 이미 충족, 시험만 추가 | R87-4 |
| 0-5 커플 공용 값: 조건부 update 한 번(`relationship_start_date is null`일 때만) + 저장된 행 반환. 기존 칸 권한 · RLS(026) 그대로 - 마이그레이션 0 | R90-4 |
| 0-8 RN ↔ 웹 서버 쓰기 대응: RN 쓰기 경로 전부 웹 대응 있음. 웹에 없는 것은 얼굴 인식 · 대표사진(`referencePhotoApi` · 생체 동의 칸) - 웹 범위 밖(R13-2) | R93-3 |
| A-21 `@capacitor/camera` 8.2.6 설치, `GALLERY_MODE = 'input'`(지금 방식 유지) - 플러그인 갤러리 경로의 EXIF 촬영 시각 보존을 기기 없이 확인 못 함. 켜도 같은 GPS 제거 경로를 탄다. 매니페스트 변경 0. `cap sync`가 gradle 두 파일에 플러그인 줄을 더함 | R86-2 · R76-7 · 위임서 A-21 조건 |
| A-16 스토리 자동 넘김은 만들고 꺼 둠(`STORY_AUTO_ADVANCE_MS = null`) - DESIGN §6 모션 허용표에 없고 보드 F03은 정지 막대. 막대 수 = 스토리 수 · 눌러 넘기기는 켜짐 | ONDOLOG_DESIGN §6 |
| A-7 네이티브 로그 끔(`capacitor.config.ts` `loggingBehavior: 'none'`) · 빌드에서 console 제거(`vite.config.ts`). 부작용: 시험 빌드의 logcat 진단도 줄어듦 | R80-2 |
| A-2-5 시작 온도는 엔진 입력 단위(애니어그램 9코어)대로 9x9 전수 시험 - "16×16"은 엔진 단위와 다름 | R83-7 |
| A-2-2 길게 누르기 삭제는 상세(사진 · 메모 항목)에 둠 - 삭제 RPC가 항목 단위. 피드 날짜 카드는 손대지 않음 | R83-4 |
| A-1 키보드 시험 화면 · "영문으로 바꿔 입력" 줄 삭제 | R80-3 |
| A-2-3 문장 후보 = "기록과 대화가 쌓여 코너가 하나씩 준비되면 오르는 숫자예요"(PM 확인 전 후보, `firstIssueHint.ts`). **주의**: 앱의 %는 지금 기간 경과율(R18-6)이라 후보 문장과 어긋남 | R83-5 |
| 저장소 키 모양 문자열: 새 시험의 가짜 JWT를 실행 때 조립으로 바꿈 → 추적 대상 키 모양 3 → 3(기존 ops 가짜 값만) | R87-6 |

### PM 확인 필요 (문구 · 값)

탈퇴 완료 한 장 "탈퇴를 요청했어요. {M}월 {D}일까지 다시 로그인하면 취소할 수 있어요."(날짜 없으면 "7일 안에") · 유예 게이트 "연결 해제를 기다리고 있어요" / "해제 예정 기간에는 새로 연결할 수 없어요. 설정 > 커플에서 확인할 수 있어요." · 유예 토스트 "해제 예정 기간에는 새로 연결할 수 없어요" · 로그아웃 확인 "로그아웃할까요?" / "다시 로그인하면 기록은 그대로 볼 수 있어요." · 시작 온도 문구 아래 기존 보조 문구 곁들임 · 시각 칸 "예 14:20" · A-2-3 후보 · A-16 자동 넘김 시간 · 탭 바 활성 표시(E01 아이콘+발광 vs I02~I06 점, 지금 E01) · 마케팅 문서 필요 여부 · 길게 누르기만이면 TalkBack 삭제 불가(대안 여부) · 버전 기준(지금 `web/package.json` 0.1.0) · GIF 통과.

### 75- 커밋 명령 (Proteur, 맨 위 폴더에서 · 한 줄씩)

1) 운영 스크립트 · 렌더 시험 · 문서
```
git add scripts/ops/resetAllowlist.ts
git add scripts/ops/resetAllowlist.test.ts
git add scripts/ops/opsCliOutput.test.ts
git add scripts/ops/resetTestAccount.ts
git add scripts/ops/resetTestAccountCheck.ts
git add scripts/ops/opsCli.ts
git add scripts/ops/generateIssueCli.ts
git add scripts/ops/publishIssueCli.ts
git add render/tests/test_a23_real_usage.py
git add docs/74-exploration-guide.md
git add docs/51-device-checklist.md
git commit -m "75- ops: lock reset script to an out-of-repo allow-list and dev project, hide project ref in cli output, add real-usage render samples, web notes in 51- checklist"
```
2) 웹 앱
```
git add web/package.json
git add web/package-lock.json
git add web/capacitor.config.ts
git add web/vite.config.ts
git add web/android/app/capacitor.build.gradle
git add web/android/capacitor.settings.gradle
git add web/src
git commit -m "75- web: strip photo location, conditional couple values, legal text v1, grace-aware main, refresh on resume, board and backlog fixes"
```
(`git add web/src`는 이 폴더의 바뀐 · 새 · 지운 파일만 담는다 - 지운 파일 `web/src/features/settings/KeyboardTestScreen.tsx` 포함. 이름 하나씩이 필요하면 아래 PROGRESS 목록 참고.)
3) 상태 파일
```
git add .claude/state/HANDOFF.md
git add .claude/state/PROGRESS.md
git commit -m "75- state: decisions, stopped items, phone check order"
```

### Proteur 다음 순서 = `51-` 한 바퀴 (R93-6)

1. 법무 값 4개 **들어감**(관문 통과) · `npm run build:trial` · `npx cap sync android` **메인 세션이 마침**(2026-11-15) → Android Studio에서 빌드 → **11월 15일**(R95-4) 두 폰 앱 삭제 후 설치(시행일과 같은 날). (`@capacitor/camera`가 새 네이티브 의존성 `ioncamera-android`를 가져오므로 첫 Gradle 빌드에서 받아오기 확인)
2. 허용 목록 파일을 만든다(위 "0-6 잠금" 형식, 저장소 밖) → 커플 모드 초기화(`ops_2026_11` · 보안 입력 · `sb_secret_` 확인 줄 · `$al` · `--with-issues` · 끝나면 새 창 `False`). 남아 있는 시드 시험 호도 이때 정리된다.
3. **R79-3 두 폰 새 계정 첫 가입**(법무 문장이 들어간 빌드).
4. `51-` 49항목 - M0 §7 순서 · 멈춤 조건 4가지. 끼워 볼 것: A-19 · A-20 · A-21(스위치 꺼짐 - 지금 방식) · A-26 → ⑦ 채팅 / A-21 · 0-1(GPS 0 · 방향 · 픽셀 크기, B2 · B3 · B4) → ⑨ 피드 / A-24(해제 · 탈퇴 유예 중 메인 · 피드 · 매거진에 초대 없음, 닉네임 보임) · A-25 → ⑬ / D5 문의 받는 사람 · C13 문장 같음 → ⑫ / A-2-4 두 폰 동시(1초 안) · 순차 저장 / A-4 첫 진입 0.1초 판독 / A-3 모든 탭 / A-7 로그인 한 바퀴 logcat · 화면 · 녹화에 토큰 0 / A-17 큰 사진 여러 장 보낼 때 띠 없음 / D10 · W2 토스트 위치.
5. 두 폰으로 3일치 기록 → 시드 호 1권 생성 · 렌더 · 발행(샘플 모드 · LLM 0 · 생성 · 발행 `ops_2026_11` · 렌더 `render_2026_11` · R84-7 입력 조립 확인 먼저). B11 · B12는 이 호로.
6. 준비물: HEIC 사진(0-1 멈춤 - 위치가 남는지 그대로 기록) · 지난달 사진(B9) · 재설치용 기존 계정(B21) · 메일 앱 비활성(C12) · 약한 신호 장소(D7).
7. 녹화: 두 폰 동시 · 시작 메시지로 시각 맞춤 · 카카오 계정 · 공유 시트 연락처 · 메일 앱 화면 제외 · 판독 0.5초 이하.

## `74-` 앱 전체를 웹으로 (메인 세션 진행, 2026-11-09 시작) - 새 세션은 이 절만 보고 다음 묶음부터

지시: `.claude/state/prompts/phase-7/PM_directive_74-web-full-app.md`(원본, 우선) · `74-ui-builder-full-app.md`(묶음별 할 일) · `74-main-session-dispatch-full-app.md`(진행 방식). 멈춤 조건은 셋(절대 규칙 · 마이그레이션 · 허가 밖 의존성/네이티브 파일)뿐, 나머지는 아래 "결정 기록"에 한 줄.

### 진행 상태

| 묶음 | 상태 | 커밋할 파일 |
|---|---|---|
| 74-0 초기화 스크립트 | 완료 | `scripts/ops/resetTestAccount.ts` · `scripts/ops/resetTestAccountCheck.ts` · `.claude/state/HANDOFF.md` · `.claude/state/PROGRESS.md` |
| 74-1 앱 뼈대 | 완료 | `web/src/app/routes.ts` · `web/src/app/backRules.ts` · `web/src/app/backRules.vitest.ts` · `web/src/app/routeTable.tsx` · `web/src/app/sheets.tsx` · `web/src/app/inviteEntry.ts` · `web/src/app/useAccountData.ts` · `web/src/app/shell.vitest.tsx` · `web/src/tabs/TabBar.tsx` · `web/src/tabs/TabIcons.tsx` · `web/src/tabs/TabFrame.tsx` · `web/src/tabs/MainTab.tsx` · `web/src/tabs/ChatTab.tsx` · `web/src/tabs/FeedTab.tsx` · `web/src/tabs/MagazineTab.tsx` · `web/src/tabs/SettingsTab.tsx` · `web/src/components/Sheet.tsx` · `web/src/components/ConfirmDialog.tsx` · `web/src/components/Skeleton.tsx` · `web/src/components/EmptyState.tsx` · `web/src/components/ToastHost.tsx` · `web/src/components/ConnectionBanner.tsx` · `web/src/components/CoupleGate.tsx` · `web/src/components/components.vitest.tsx` · `web/src/connection/connectionMonitor.ts` · `web/src/connection/useOfflineProbe.ts` · `web/src/connection/chatQueueSignal.ts` · `web/src/connection/connection.vitest.tsx` · `web/src/stores/toastStore.ts` · `web/src/stores/sheetStore.ts` · `web/src/stores/coupleStore.ts` · `web/src/stores/profileStore.ts` · `web/src/stores/stores.vitest.ts` · `web/src/platform/motion.ts` · `web/src/App.tsx` · `web/src/navigation.tsx` · `web/src/screens.tsx` · `web/src/styles.css` · `web/src/testSupport.ts` · `web/src/appFlow.vitest.tsx` · `web/src/auth/client.ts` · `web/src/auth/finalize.ts` · `web/src/auth/finalize.vitest.ts` · `web/src/config/env.ts` · `web/src/dev/ChatTrial.tsx` (삭제) · `web/src/dev/chatFeel.vitest.tsx` (삭제) · `web/src/dev/chatTrial.vitest.tsx` (삭제) · `web/src/dev/chatTrialGate.ts` (삭제) · `web/src/dev/fakeMessages.ts` (삭제) · `.claude/state/HANDOFF.md` · `.claude/state/PROGRESS.md` |
| 74-2 온보딩 2부 | 완료 | 새 파일 + 74-1 파일 중 다시 바뀐 것을 합친 목록(이름 하나씩): `web/src/couple/coupleApi.ts` · `web/src/couple/useStartDateRecheck.ts` · `web/src/features/couple/InviteScreen.tsx` · `web/src/features/couple/CodeBoxes.tsx` · `web/src/features/couple/StartDateScreen.tsx` · `web/src/features/couple/coupleApi.vitest.ts` · `web/src/features/couple/couple.vitest.tsx` · `web/src/testSupportCouple.ts` · `web/src/app/routes.ts` · `web/src/app/backRules.ts` · `web/src/app/backRules.vitest.ts` · `web/src/app/routeTable.tsx` · `web/src/app/inviteEntry.ts` · `web/src/app/shell.vitest.tsx` · `web/src/App.tsx` · `web/src/appFlow.vitest.tsx` · `web/src/auth/finalize.ts` · `web/src/auth/useAccountFinalize.ts` · `web/src/auth/useBootSession.ts` · `web/src/codeInput.tsx` · `web/src/platform/bridge.ts` · `web/src/screens.tsx` · `web/src/screens.vitest.tsx` · `web/src/styles.css` · `web/src/testSupport.ts` · `.claude/state/HANDOFF.md` · `.claude/state/PROGRESS.md` |
| 74-3 메인 | 완료 | 새 파일: `web/src/features/main/MainView.tsx` · `web/src/features/main/useMainData.ts` · `web/src/features/main/issueSeen.ts` · `web/src/features/main/main.vitest.tsx` · `web/src/app/viewerEntry.ts` / 다시 바뀐 74-1~2 파일: `web/src/tabs/MainTab.tsx` · `web/src/app/routeTable.tsx` · `web/src/App.tsx` · `web/src/styles.css` · `.claude/state/HANDOFF.md` · `.claude/state/PROGRESS.md` |
| 74-4 피드 · 업로드 | 완료 | 새 파일: `web/src/features/feed/exifr.d.ts` · `web/src/features/feed/photoPicker.ts` · `web/src/features/feed/feedData.ts` · `web/src/features/feed/FeedView.tsx` · `web/src/features/feed/DateDetailScreen.tsx` · `web/src/features/feed/StopEditScreen.tsx` · `web/src/features/feed/RecordSheet.tsx` · `web/src/features/feed/feedTestSupport.ts` · `web/src/features/feed/feed.vitest.tsx` · `web/src/features/feed/feedFlow.vitest.tsx` · `web/src/features/feed/photoPicker.vitest.ts` · `web/src/components/PhotoViewer.tsx` · `web/src/components/zoomMath.ts` · `web/src/components/zoom.vitest.tsx` · `web/src/photoQueue/webPhotoFs.ts` · `web/src/photoQueue/photoQueueStore.ts` · `web/src/photoQueue/photoQueueHub.ts` · `web/src/photoQueue/usePhotoQueueResume.ts` · `web/src/photoQueue/photoQueue.vitest.tsx` · `web/public/fonts/MaruBuri-Regular.ttf` / 다시 바뀐 74-1~3 파일: `web/src/tabs/FeedTab.tsx` · `web/src/app/routes.ts` · `web/src/app/routeTable.tsx` · `web/src/app/backRules.ts` · `web/src/app/backRules.vitest.ts` · `web/src/app/sheets.tsx` · `web/src/stores/sheetStore.ts` · `web/src/navigation.tsx` · `web/src/App.tsx` · `web/src/styles.css` / 새 의존성: `web/package.json` · `web/package-lock.json`(`exifr@7.1.3` 한 줄) / `.claude/state/HANDOFF.md` · `.claude/state/PROGRESS.md` |
| 74-5 채팅 | 완료 | 새 파일: `web/src/features/chat/ChatView.tsx` · `useChatMessages.ts` · `chatApi.ts` · `textQueueHub.ts` · `useChatQueueResume.ts` · `useSignedMedia.ts` · `localPreview.ts` · `StoryViewer.tsx` · `chatPhotoActions.ts` · `chatTestSupport.ts` · `chat.vitest.tsx` · `chatData.vitest.tsx` · `web/src/platform/useKeyboardOpen.ts` · `web/src/platform/chatComposer.vitest.tsx` · `web/src/components/PhoneLayer.tsx` / 다시 바뀐 파일: `web/src/platform/useChatComposer.ts`(300ms 시간 방식 삭제, 입력 이벤트 방식) · `web/src/tabs/ChatTab.tsx` · `web/src/app/routeTable.tsx` · `web/src/App.tsx` · `web/src/styles.css` · `web/src/components/CoupleGate.tsx` · `web/src/components/PhotoViewer.tsx` · `web/src/features/feed/photoPicker.ts` · `web/src/features/feed/feedTestSupport.ts` · `.claude/state/HANDOFF.md` · `.claude/state/PROGRESS.md` (새 경로 0 - 스토리 · 사진 뷰어는 화면 위 덮개라 규칙표 변경 없음, 새 의존성 0, `web/android` 변경 0) |
| 74-6 서재 · 뷰어 | 완료 | 새 파일: `web/src/features/magazine/libraryData.ts` · `LibraryView.tsx` · `viewerData.ts` · `IssueViewer.tsx` · `ViewerHost.tsx` · `magazineTestSupport.ts` · `magazine.vitest.tsx` · `web/src/stores/viewerOpenStore.ts` / 다시 바뀐 파일: `web/src/tabs/MagazineTab.tsx`(빈 틀 -> 서재) · `web/src/App.tsx`(`<ViewerHost>` 한 줄) · `web/src/components/PhotoViewer.tsx`(`ZoomableImage`에 `onError`) · `web/src/features/main/issueSeen.ts`(`useIssueOpenedSignal`) · `web/src/features/main/useMainData.ts`(그 번호를 보면 "열어 봄"을 다시 읽음) · `web/src/styles.css` · `.claude/state/HANDOFF.md` · `.claude/state/PROGRESS.md` (새 경로 0 - 뷰어는 덮개라 규칙표 변경 없음, 새 의존성 0, `web/android` 변경 0, 루트 · RN 변경 0) |
| 74-7 설정 | 완료 | 새 파일: `web/src/features/settings/parts.tsx` · `web/src/features/settings/SettingsView.tsx` · `web/src/features/settings/useSettingsSummary.ts` · `web/src/features/settings/settingsData.ts` · `web/src/features/settings/accountActions.ts` · `web/src/features/settings/appInfo.ts` · `web/src/features/settings/ProfileScreen.tsx` · `web/src/features/settings/CoupleScreen.tsx` · `web/src/features/settings/DissolutionGrace.tsx` · `web/src/features/settings/PhraseConfirm.tsx` · `web/src/features/settings/UnlinkScreen.tsx` · `web/src/features/settings/WithdrawScreen.tsx` · `web/src/features/settings/WithdrawCancelScreen.tsx` · `web/src/features/settings/PersonalityScreen.tsx` · `web/src/features/settings/SettingsResultScreen.tsx` · `web/src/features/settings/RetestScreen.tsx` · `web/src/features/settings/PrivacyScreen.tsx` · `web/src/features/settings/AboutScreen.tsx` · `web/src/features/settings/useDissolutionNotice.ts` · `web/src/features/settings/settingsTestSupport.ts` · `web/src/features/settings/settings.vitest.tsx` · `web/src/features/settings/settingsFlow.vitest.tsx` · `web/src/stores/dissolutionStore.ts` / 다시 바뀐 74-1~6 파일: `web/src/tabs/SettingsTab.tsx` · `web/src/app/routes.ts` · `web/src/app/routeTable.tsx` · `web/src/app/backRules.ts` · `web/src/app/backRules.vitest.ts` · `web/src/app/useAccountData.ts` · `web/src/App.tsx` · `web/src/navigation.tsx` · `web/src/screens.tsx` · `web/src/auth/finalize.ts` · `web/src/auth/useBootSession.ts` · `web/src/auth/useAccountFinalize.ts` · `web/src/stores/profileStore.ts` · `web/src/platform/bridge.ts` · `web/src/testSupport.ts` · `web/src/testSupportCouple.ts` · `web/src/styles.css` / `.claude/state/HANDOFF.md` · `.claude/state/PROGRESS.md` (새 경로 10개 · 새 의존성 0 · `web/android` 변경 0 · 루트 · RN 변경 0 · 서버 새 RPC 0) |
| 74-8 마무리 | 완료 | 새 파일: `web/src/platform/imageSave.ts` · `web/src/platform/imageSave.vitest.ts` · `docs/74-exploration-guide.md` / 다시 바뀐 파일: `web/src/platform/bridge.ts`(`saveImage` 공유 시트 방식 · `SaveResult`에 `cancelled`) · `web/src/features/chat/chatPhotoActions.ts` · `web/src/features/chat/ChatView.tsx` · `web/src/features/chat/chat.vitest.tsx` · `web/src/screens.tsx` / `.claude/state/HANDOFF.md` · `.claude/state/PROGRESS.md` (새 경로 0 · 새 의존성 0 · `web/android` 변경 0 · 루트 · RN 변경 0) |
| 74-h1 급한 수정 | 완료 (미커밋) | 아래 "74-h1 커밋 명령"의 파일 목록. 범위: ① 재로그인 상태 비움 ② 혼자 기록 닫기(R30-3) ③ 애착 이름 ④ 코드 칸 ⑤ 기존 계정 알림 ⑥ 탐방 안내. 새 경로 0 · 새 의존성 0 · 마이그레이션 0 · 원격 0 · `web/android` · 루트 · RN 변경 0 |

| 74-h2 급한 수정 | 완료 (미커밋, 폰 확인 대기) | 아래 "74-h2 커밋 명령"의 파일 목록. 범위: ⓪ 새 계정 첫 로그인 뒤 빈 화면(R79-1) ① D1 리스너 · 세션 안전장치 · 진단 표시 ② 연결 전 기록 반응 ③ 키보드 시험 ④ 초기화 스크립트 공개 키 안내 ⑤ 애착 칸(정본이 빈 값). 마이그레이션 0 · `supabase/` 0 · 원격 0 · 새 패키지 0 · `web/android` · 루트 · RN 변경 0 |

| 74-h4 피드 사진 F1 · B1 | 완료 (미커밋, 폰 확인 대기) | 아래 "74-h4 커밋 명령"의 파일 목록. 범위: 피드 사진 입구(채팅과 같은 [앨범]/[카메라] 시트) · 고르는 단계에서 File 자체 읽기 + 앱 캐시 복사본 · 썸네일 / "다시 고르기" · 카메라 시각 · 시험 빌드 사진 진단. 마이그레이션 0 · `supabase/` 0 · 원격 쓰기 0(원격은 edge 로그 읽기 2회) · 새 패키지 0 · `web/android` · 루트 · RN 변경 0 |

| 74-h5 렌더 대표 사진 대체 · 사진 없는 기사 빼기 | 완료 (미커밋) | 아래 "74-h5 커밋 명령"의 파일 목록. 범위: `render/` Python과 시험만. 마이그레이션 0 · 원격 0 · 새 패키지 0 · `supabase/` · `src/` · `web/` · RN · 보호 파일 변경 0 · 생성 재실행 0 · LLM 0 |

| 74-h5b 렌더 사진 크기 · 메타데이터 · PDF 한도 | 완료 (미커밋) | 아래 "74-h5b 커밋 명령"의 파일 목록. 범위: `render/` Python · 설정 파일 · 시험 + Pillow 1개(R86-1). 마이그레이션 0 · 버킷 설정 0 · 원격 쓰기 0(11-11 로컬 조판은 읽기만) · `supabase/` · `src/` · `web/` · RN · 보호 파일 변경 0 · 생성 재실행 0 · LLM 0 |

| 74-k1 새 secret key 렌더 헤더 | 완료 (미커밋) | 아래 "74-k1 커밋 명령"의 파일 목록. 범위: `render/` Python과 시험 · scripts/ops는 확인만(변경 0). 마이그레이션 0 · 원격 0(읽기도 0) · 새 패키지 0 · `web/` · `supabase/` · 보호 파일 0 · 시험은 가짜 키로만 |

| 74-k2 키 교체 마무리 - HANDOFF 키 안내 정리 | 완료 (미커밋) | `.claude/state/HANDOFF.md` · `.claude/state/PROGRESS.md`. 범위: 아래 "키 넣는 안내" 갱신(legacy 비활성화 · JWT 비밀 폐기 · 목적별 secret 2 · `web/.env` 이름과 값) · 키 넣는 모든 안내 아래 `sb_secret_` 확인 줄 · 작업 끝 `False` 확인 줄 · legacy 전제 문장 표시. 코드 · `docs/` · 원격 0 |

시작 지점: 커밋 `17222d1`(작업 트리 깨끗, ROADMAP `2026-11-09-r75`, PM 지시서 · 두 프롬프트 커밋됨 확인).

### 74-k1 결정 기록 (메인 세션, 2026-11-12, 위임문 `74-k1-dispatch-render-key-header.md` · R89-3 · R89-4)

| 결정 | 출처 |
|---|---|
| render의 원격 요청은 모두 `render/render_issue.py`의 `Api._request` 한 곳을 지난다(REST 조회 · 갱신 · Storage 내려받기 · 올리기 · 목록 · 지우기, `seed_render_tests.py`의 `SeedApi` 삽입 · Auth 관리자 계정도 같은 길). 사용자 토큰을 쓰는 경로는 render에 없다 | §1 확인 |
| 키가 `sb_`로 시작하면(새 API 키) `apikey` 헤더에만 싣고 `Authorization`은 보내지 않는다. 그 밖(legacy JWT 키)은 지금 방식 그대로 `apikey` + `Authorization: Bearer <키>`. 판정은 접두어로만(`key_kind` · `auth_headers`). **74-k2: legacy 키는 2026-11-12 비활성화 · JWT 비밀 폐기됨 - legacy 분기는 코드에 남아 있으나 쓰는 키는 새 키뿐** | R89-3 · Supabase API 키 마이그레이션 문서(새 키는 JWT가 아니라 `apikey` 헤더) |
| 인증 거부(401 · 403)일 때만 오류 문구 끝에 `키 형태: legacy / new`를 붙인다. 키 · 접두어 뒤 글자는 어디에도 없다(시험) | 위임문 §2 ③ |
| scripts/ops는 **변경 0**: 운영 경로 · 검증 스크립트 모두 `npm:@supabase/supabase-js@2.118.0`(루트 `node_modules`도 2.118.0)으로 `createClient(url, key)`만 쓰고 직접 쓴 인증 헤더 0. 이 판은 `sb_secret_` · `sb_publishable_`를 새 키로 인식한다(`dist/index.mjs`의 `isNewApiKey` · 형식 경고 대상 아님 · Edge Functions 요청엔 Bearer로 키를 싣지 않는 `omitApiKeyAsBearer`). REST · Storage · Auth 요청은 SDK가 키를 `apikey`와 `Authorization` 둘 다에 싣는다 - SDK가 정한 동작이라 판 올리기 없이 둔다. 운영 스크립트는 Edge Function을 부르지 않는다 | 위임문 §2 ② · supabase-js 2.118.0 소스(변경 기록 파일은 node_modules에 없음) |
| 검증 스크립트(`verify*.ts`)의 공개 키 `ONDOLOG_SUPABASE_ANON_KEY`도 같은 `createClient` - publishable 키를 넣어도 같은 판정. 로그인 뒤 요청은 사용자 토큰이 Bearer. **74-k2: legacy anon 키는 비활성화됨 - 이 변수에는 publishable만 넣는다** | §1 확인 |
| 환경 변수 이름은 그대로(`ONDOLOG_SUPABASE_SERVICE_ROLE_KEY`). 렌더 때와 운영 스크립트 때 넣는 키만 다르다(아래 표) | R89-4 |

### 키 넣는 안내 (Proteur) - 74-k2 갱신: 키 교체 완료 2026-11-12

**지금 상태**: legacy API 키(anon · service_role) **비활성화** · legacy JWT 비밀(HS256) **폐기됨(Revoked)**, 현재 서명 키는 ECC P-256. 쓰는 키는 새 키뿐이다 - publishable 1 · secret 2(`render_2026_11` · `ops_2026_11`). legacy 키를 넣으면 401 · 403으로 멈춘다(렌더 오류 문구 끝 `키 형태: legacy`). RN 동결 앱은 legacy를 끈 뒤 동작하지 않는다(R88-4 ①, 수용).

같은 변수 이름에 **실행하는 일에 맞는 secret key**를 보안 입력한다(`[Net.NetworkCredential]::new('', (Read-Host -AsSecureString)).Password`). 값은 화면 · 파일 · 보고 어디에도 쓰지 않는다.

| 실행하는 일 | 넣는 키 (secret key 이름) | 변수 이름 |
|---|---|---|
| 렌더 (`render/render_issue.py` · `render/seed_render_tests.py`) | `render_2026_11` | `ONDOLOG_SUPABASE_SERVICE_ROLE_KEY` |
| 운영 스크립트 - 초기화 (`resetTestAccount.ts`) · 생성 (`generateIssueCli.ts`) · 발행 (`publishIssueCli.ts`) · 검증 (`verify*.ts`) | `ops_2026_11` | `ONDOLOG_SUPABASE_SERVICE_ROLE_KEY` |
| 검증 스크립트의 공개 키 | publishable | `ONDOLOG_SUPABASE_ANON_KEY` (이름은 그대로, 값은 publishable) |
| 웹 앱 빌드 (`web/.env`, git 밖) | publishable | `VITE_SUPABASE_ANON_KEY` (**이름은 그대로, 값은 publishable**) |

- 실행 위치: deno · python 명령은 **저장소 맨 위 폴더**에서 친다(`O:\web`에서 실행해 `deno.json`을 못 찾은 일이 있었다).
- 키를 넣은 바로 다음 줄에 **확인 줄**을 친다. `True`일 때만 진행한다(publishable을 넣으면 오류 없이 빈 결과만 나온다 - 74-s2에서 실제로 일어남):

```
$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY.StartsWith('sb_secret_')
```

- **키 안내는 어디에 쓰든 키 줄 바로 다음에 확인 줄을 반드시 함께 싣는다**(렌더 · 생성 · 발행 · 초기화 · 검증 모두, 75- A-27 상시화). publishable 키를 넣으면 **오류 없이 빈 결과만** 나온다(74-s2 실제 사례). 키 줄만 다시 칠 때도 확인 줄을 같이 친다.
- (75- A-27) 생성 · 발행 명령의 첫 줄은 이제 "접속 대상: 개발 프로젝트 ondolog - 확인됨 (프로젝트 ref는 출력하지 않는다)"이다. ref가 보이면 멈추고 보고.
- 렌더와 운영 스크립트 사이에 키를 바꿀 때는 키 줄과 확인 줄만 다시 친다(주소 · `$h`는 그대로).
- 작업이 끝나면 **PowerShell 창을 닫고**, 새 창에서 아래가 `False`인지 확인한다:

```
[bool]$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY
```

- 키 · 주소는 **그 창의 환경 변수에만** 넣는다. 사용자 범위 · 시스템 범위에 영구 저장하지 않는다(`setx` · `[Environment]::SetEnvironmentVariable(..., 'User'/'Machine')` · 시스템 속성 화면 모두 금지, R87-6).

- **(76-i · R111-5) 푸시 함수 키 회전**: secret key `push_2026_11`을 바꾸면(새로 만들고 옛 것 지움) **함수 비밀 `ONDOLOG_PUSH_DB_KEY`를 다시 넣는다** - "`78-` Proteur 할 일 순서" 3번 명령 그대로(같은 명령이 `ONDOLOG_FCM_SERVICE_ACCOUNT_B64`도 다시 넣는다). FCM 서비스 계정 키를 바꿀 때도 같은 3번 명령. 끝 줄 `npx supabase secrets list`로 **두 이름이 있는지**만 본다(값 · digest는 보고에 쓰지 않음). 이걸 빠뜨리면 함수가 `503 config`로 멈추고 **알림만 조용히 0**이 된다(메시지는 정상 - 78- 1차 폰 확인에서 실제로 일어남).

### 74-k1 커밋 명령 (Proteur, 74-k1 뒤)

**저장소 맨 위 폴더에서 친다.** 한 줄씩:

```
git add render/render_issue.py
git add render/seed_render_tests.py
git add render/tests/test_k1_key_header.py
git add .claude/state/HANDOFF.md
git add .claude/state/PROGRESS.md
git commit -m "74-k1 render: send new sb_ secret keys only in the apikey header, keep legacy jwt headers, report only the key kind on auth failures"
```


### 74-h5b 결정 기록 (메인 세션, 2026-11-11, 위임문 `74-h5b-dispatch-render-photo-size.md` · R85-2 · R85-3 · R86-1 · R86-2)

| 결정 | 출처 |
|---|---|
| 이미지 처리 라이브러리가 렌더 환경에 없어 한 번 멈춤 → Pillow **12.3.0** 하나를 `render/requirements.txt` · `render/.venv`에 정확히 고정. 이유: 줄이기 · EXIF 방향 · 색 프로필 변환(littlecms 포함) · 메타데이터 없이 다시 저장을 표준 방식으로 하고, 결과를 시험으로 단언할 수 있다. 13.0.0은 나온 지 오래되지 않았을 수 있어 그 앞 판(Python 3.11 지원) | R86-1 |
| 사진은 **놓이는 칸 크기 × 디지털 DPI**로 줄인다. 칸 크기는 렌더와 같은 뷰포트의 Chromium에서 `<img>`마다 잰다(CSS px, 1in = 96px). `object-fit` cover는 큰 배율, contain은 작은 배율. 원본이 더 작으면 키우지 않는다. 같은 사진이 크기가 다른 칸에 놓이면 칸마다 다른 파일. 다 바꾼 뒤 받아 둔 원본은 작업 폴더에서 지운다 | MASTER 9-5 이중 렌더링 `digital` · PDF 화질 방어 |
| DPI는 `app_config.pdf_profiles.digital.dpi`를 읽기만(`read_digital_dpi`). 못 읽거나 양수가 아니면 작업 폴더를 만들기 전에 멈춘다. `print` 값은 읽지 않는다 | R86-1 · SCHEMA 9-C-5("dpi는 리샘플링 기준으로 실제로 소비하는지 확인") |
| 다시 압축은 JPEG, 품질 **85** = 쪽 이미지와 같은 값(이미 쓰던 품질 - 화면 열람에 충분하고 새 값을 지어내지 않는다). EXIF 방향을 픽셀에 반영한 뒤 **픽셀만 새 이미지로 옮겨** 저장 - EXIF · GPS · XMP · ICC · IPTC · 주석을 쓰지 않는다. 색 프로필이 있으면 sRGB로 바꾼 뒤 뺀다(프로필만 빼면 넓은 색역 사진의 색이 바랜다). 결과마다 표지 검사(`metadata_found`)로 남은 것이 있으면 멈춘다 | R85-2 · R76-4 |
| 설정 파일 하나 `render/render_config.json`: 쪽 이미지 1170px · 쪽 이미지 품질 85(기존 값 그대로 → 동작 변화 0) · 사진 품질 85 · 디지털 PDF 한도 30MB. 값이 빠지거나 양수가 아니면 멈춘다(기본값으로 메우지 않음) | R86-2 |
| 호 단위 검사 추가: 디지털 PDF가 한도를 넘으면 **업로드 전에** 멈춘다(문구에 실제 크기 · 한도 MB, 1MB = 1024², 로컬 산출물은 남김). 업로드 실패는 응답 본문의 `code · error · message`만 짧게(주소 · id 지움), 경로 대신 파일 이름만. 예외 종류가 RuntimeError → StopError(종료 코드 2 + 멈춤 문구) | 위임문 §1 ④ ⑤ |
| 쪽 이미지는 지금처럼 Chromium 스크린샷(가로 1170px ≈ 141DPI, A4 폭 기준)이라 DPI 설정과 따로다 - 값은 바꾸지 않았다. 스크린샷 JPEG에 메타데이터 0(시험) | 위임문 §1 ③ · R86-2 |
| 인쇄용 프로필: 저장소에 인쇄용 렌더 경로가 없다(`render/`에 `print` 프로필 코드 0). 줄인 사진은 디지털 렌더 작업 폴더에만 있어 인쇄용이 축소본을 쓰는 경로가 생기지 않는다 | 위임문 §1 ⑥ |
| `render/local_volumes.py`(로컬 시험 권, 원격 없음)는 사진 맞춤을 거치지 않는다 - DPI를 DB에서 읽는 경로라 손대지 않았다. 지면 구조 시험용이라 영향 없음 | 범위 |

### 74-h5b 커밋 명령 (Proteur, 74-h5b 뒤)

**저장소 맨 위 폴더에서 친다.** 한 줄씩:

```
git add render/requirements.txt
git add render/render_config.json
git add render/photo_fit.py
git add render/render_issue.py
git add render/tests/test_render_issue.py
git add render/tests/test_h5b_photo.py
git add .claude/state/HANDOFF.md
git add .claude/state/PROGRESS.md
git commit -m "74-h5b render: fit page photos to slot size x digital dpi, strip all photo metadata, stop before upload over the pdf size limit, summarize storage errors"
```

다른 PC에서 렌더하려면 커밋 뒤 한 번: `render/.venv/Scripts/python.exe -m pip install -r render/requirements.txt`

### 74-h5b 다음 실행 (커밋 뒤 Proteur가 따로 지시할 때만 - R53-6 · R84-7, 위임문 §5)

"74-h5 다음 실행"과 같은 명령(11-11 초안 `render_issue.py` → 성공하면 `publishIssueCli.ts`). 렌더 출력의 `sizes`(PDF MB · 쪽 이미지 · 사진)를 보고에 더한다. 크기 한도를 넘으면 업로드 전에 멈춘다.

### 74-h5 결정 기록 (메인 세션, 2026-11-11, 위임문 `74-h5-dispatch-render-hero.md` · R84-1~4)

| 결정 | 출처 |
|---|---|
| 기사 히어로 = 구간을 순서대로 보다가 사진이 있는 첫 구간의 첫 사진(`facts.hero_photo_path` · `hero_stop_index`). 대표 기사 오프너 사진(`first_photo_any`)과 같은 사슬이라 대표 · 일반 기사가 같은 규칙 | R84-1 |
| "시간순" = content의 구간 순서(seq) 그대로. 앱이 seq를 도착 시각(날짜 포함) 순으로 매기고(`src/services/dateRecordApi.ts` `resequenceStops`), 생성도 seq로 정렬(`dateArchive.ts:179`). 구간 `time`(`HH:mm`)으로 다시 정렬하지 않는다 - 자정을 넘긴 데이트에서 뒤집힌다. 시각이 없는 구간도 같은 seq 규칙 | R84-1 |
| MASTER 표지 대표 사진 규칙(§9-5 r64, 1758행: featured 첫 stop의 첫 사진 → 그 코너 전체의 첫 사진)과 방향이 같다 - 첫 구간에 없으면 멈추지 않고 뒤 사진으로 넘어간다. 표지 사슬(`_cover_photo_ref`)은 손대지 않았다 | R84-1 |
| 지면 HTML은 히어로를 `stops[0].photos[0].path`로 읽는다(R23-2, 구조 변경 금지) → da-article **보기 사본에서만** 히어로 구간을 맨 앞에 둔다. 이 지면에서 구간 목록을 읽는 칸은 히어로 하나뿐이고 경로 · 구간 수 · 사진 수는 호의 사실(원래 순서)에서 온다 | R84-1 · R23-2 |
| **임시 규칙**(디자인 v1.2.3의 글만 있는 기사 지면이 오면 그쪽 우선): 사진이 하나도 없는 데이트는 기사에서 뺀다(재소환 포함). 뺀 content로 지면 · 목차 · 타임라인 · 경로 · 합계 · 발행 노트를 모두 짠다 - 실린 기사만 센다. 빠진 날 · 메모는 발행 노트 "싣지 않은 것"(기사로 고르지 않은 날 · 기사에 담기지 않은 메모)으로 맞아떨어진다. DB 행은 건드리지 않는다 | R84-2 · R50-4 |
| **대표 기사(featured)는 빼지 않는다** - 사진 없는 대표 기사는 기존 type-only 오프너로 싣는다(README §10, `opener_type_only_scenario`, 기존 시험 `test_featured_article_without_photos_is_not_affected`). 대표를 빼면 새 대표를 고르는 규칙이 문서에 없다. 그래서 대표가 늘 남아 "남는 기사 0"은 생기지 않는다 - 빈 코너 규칙(코너가 ready가 아니면 지면 · 목차에서 빠지고 발행 노트 "비어 있는 코너", `compose.py` `compose_issue` · `_note_values`)은 이 규칙으로는 닿지 않는다. 위임문 §2 "대표 기사가 위 모양일 때 같은 규칙" 중 '사진 0'만 이렇게 달리 했다 - PM 확인 항목 | R84-2 · README §10 |
| R48-3 ① 멈춤 문구와 경로를 없앴다. 기사 하나로 호를 멈추지 않는다 | R84-3 |
| 렌더 보고에 숫자만 둘: `droppedArticles`(뺀 기사 수) · `heroFallbackArticles`(첫 구간에 사진이 없어 뒤 구간 사진을 쓴 기사 수, 대표 기사 포함). compose.json `report`와 렌더 출력 `compose`에 든다. 날짜 · id · 파일 이름 0 | R84-1 · R84-2 |

### 74-h5 커밋 명령 (Proteur, 74-h5 뒤)

**저장소 맨 위 폴더에서 친다.** 한 줄씩:

```
git add render/compose.py
git add render/facts.py
git add render/render_issue.py
git add render/tests/test_v122.py
git add render/tests/test_h5_hero.py
git add .claude/state/HANDOFF.md
git add .claude/state/PROGRESS.md
git commit -m "74-h5 render: article hero falls back to the first stop with photos, leave photo-less dates out of the date archive, report counts only"
```

### 74-h5 다음 실행 (커밋 뒤 Proteur가 따로 지시할 때만 - R53-6 · R84-7, 위임문 §5)

저장소 맨 위 폴더의 PowerShell에서. 키가 터미널에 없으면 먼저 두 줄(값이 화면에 찍히지 않는다):

```
$env:ONDOLOG_SUPABASE_URL = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString)).Password
$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString)).Password
$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY.StartsWith('sb_secret_')
```

(74-k2: 키 줄에는 렌더용 `render_2026_11`을 넣는다. 확인 줄이 `True`일 때만 진행 - "키 넣는 안내" 참조.)

1. 11-11 ready 초안을 **다시 렌더만** 한다(생성 재실행 0 · LLM 0). 호 id는 `scripts/ops/out/`의 11-11 생성 결과 파일 이름(`generate-<id>.json`)에서 읽고, 출력 파일 · 보고에 적지 않는다.
   `render\.venv\Scripts\python.exe render\render_issue.py --issue-id <11-11 초안 id>`
2. 렌더 보고: 성공/실패 · `compose.droppedArticles` · `compose.heroFallbackArticles` · `pageCount`
3. 성공하면 발행 전에 키를 운영용 `ops_2026_11`로 바꾸고 확인한다(키 줄 + 확인 줄만 다시):

```
$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString)).Password
$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY.StartsWith('sb_secret_')
```

   발행: `deno run --no-lock --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY --allow-net="<ref>.supabase.co" --allow-read=supabase/.temp/linked-project.json --allow-write=scripts/ops/out scripts/ops/publishIssueCli.ts --issue-id <같은 id>` (`<ref>`는 `supabase/.temp/project-ref`, 출력에서 지운다)
4. 보고: "발행됨 · 매거진 파일 수 N · 인쇄용 PDF 앱 노출 경로 0" - 렌더는 디지털 PDF + 쪽 이미지만 `magazine` 버킷 `render/`에 올린다(인쇄용 PDF를 만들지 않는다). 호 id · 커플 id · 주소 0
5. 끝나면 **PowerShell 창을 닫고**, 새 창에서 `[bool]$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY` → `False` 확인. 사용자 · 시스템 범위 영구 저장 금지(R87-6)

### 74-h4 결정 기록 (메인 세션 · ui-builder, 2026-11-11, 위임문 `74-h4-dispatch-feed-photo.md` · R82-1)

| 결정 | 출처 |
|---|---|
| 원인 = ② 읽기. 피드 저장(UTC 08:48:43)에 `POST dates` 201 · `POST data_entries` 201(메모 1) · `PATCH dates` 204만 있고 `entries` 버킷 업로드 요청 0건(3회 재시도 모두 네트워크 전). 같은 폰 1분 전 `messages` · `stories` 업로드 200. → `readLocalBytes`(`fetch(blob:)`)가 던짐. 썸네일 빈 칸도 같은 선택기 `blob:` 주소 | 원격 edge 로그 읽기(메인 세션) · `photoPicker.ts:172` · `RecordSheet.tsx`(이전 196) |
| ⑤ Storage 정책은 원인 아님(entries · messages 정책 동형) → 마이그레이션 없이 진행 | `015_storage_policies.sql` |
| 웹 피드만 선택기 참조를 저장 순간까지 들고 있다가 읽었다. 채팅(`copyIn`) · RN(`expo-image-picker` 캐시 복사)은 고른 직후 앱 소유 사본을 만든다 → 피드도 고르는 단계에서 File 자체를 읽고(`arrayBuffer` → FileReader) 앱 캐시 `feed-photo-picks/`에 복사, 업로드는 복사본만 읽음. WebView 내부 메커니즘은 코드로 확정 불가 — 폰 확인 몫 | R82-1 · 위임문 §2 ① |
| 복사 실패 시 그 사진만 메모리 바이트로 대체(사진을 잃지 않음) | ui-builder 판단(위임문에 없음) |
| 입구: 채팅 시트를 `components/PhotoSourceSheet.tsx`로 빼 공용. 채팅 testid · 문구 그대로 | 위임문 §2 ② |
| 카메라 사진은 EXIF 촬영 시각이 없으면 지금 시각 | 위임문 §2 ④ |
| 영속 큐 없음(RN 피드에도 없음). `recordDate` 그대로 | 위임문 §2 ① |
| 진단: 고르기 / 읽기 / 압축 / 올리기 / 행 저장 + `safeKind`. 압축은 RN이 원본 그대로라 발생 0. "사진"이 든 토스트 아래에도 진단 줄 | 위임문 §2 ⑤ · ui-builder 판단(토스트 조건) |
| B1: 앨범 입력은 채팅과 같은 `accept=image/*` + multiple. 네이티브 · `@capacitor/camera` 우회는 넣지 않음 — 폰 B에서 여전히 문서 선택기가 뜨면 그때 판단 | 위임문 §2 ② · 머리말 |

### 74-h4 커밋 명령 (Proteur, 74-h4 뒤)

**저장소 맨 위 폴더에서 친다.** 한 줄씩:

```
git add web/src/components/PhotoDiag.tsx
git add web/src/components/PhotoSourceSheet.tsx
git add web/src/components/ToastHost.tsx
git add web/src/features/chat/ChatView.tsx
git add web/src/features/feed/DateDetailScreen.tsx
git add web/src/features/feed/RecordSheet.tsx
git add web/src/features/feed/feed.vitest.tsx
git add web/src/features/feed/feedPhotoDiagProd.vitest.tsx
git add web/src/features/feed/feedPhotoStage.ts
git add web/src/features/feed/feedPhotoStage.vitest.tsx
git add web/src/features/feed/feedSave.ts
git add web/src/platform/trialDiag.ts
git add .claude/state/HANDOFF.md
git add .claude/state/PROGRESS.md
git commit -m "74-h4 feed photo: read picked files at pick time into app cache copies, shared album/camera entry sheet, retry tile, trial-only photo diagnostics"
```

**Proteur 폰 확인 순서 (`npm run build:trial` → `npx cap sync android`, 두 폰에 각각 설치 — USB는 한 대씩)**

1. 폰 A: 피드 + → [앨범] → 사진 1장 → 썸네일 보임 → 저장 → 사진 1장으로 저장됨
2. 폰 A: 피드 + → [카메라] → 찍기 → 저장
3. 폰 B: 피드 + → [앨범] → **문서 선택기가 아니라 갤러리** → 사진 → 저장
4. 상대 폰 피드에 사진이 보이는지
5. 날짜가 사진 촬영일로 채워졌는지
6. 실패하면 화면 아래 진단 글자를 그대로 적어 보내기

### 74-h1 커밋 명령 (Proteur, 74-h1 뒤 - 지시서 `PM_directive_74-h1-hotfix.md` · R77-2)

커밋 파일(이름 하나씩, 명령은 한 줄씩):

```
git add docs/74-exploration-guide.md
git add web/src/App.tsx
git add web/src/attachmentNames.ts
git add web/src/auth/callback.ts
git add web/src/features/couple/CodeBoxes.tsx
git add web/src/features/couple/InviteScreen.tsx
git add web/src/features/couple/couple.vitest.tsx
git add web/src/features/feed/DateDetailScreen.tsx
git add web/src/features/feed/FeedView.tsx
git add web/src/features/feed/RecordSheet.tsx
git add web/src/features/feed/feed.vitest.tsx
git add web/src/features/feed/feedData.ts
git add web/src/features/settings/PersonalityScreen.tsx
git add web/src/features/settings/SettingsResultScreen.tsx
git add web/src/features/settings/accountActions.ts
git add web/src/features/settings/settings.vitest.tsx
git add web/src/hotfix74h1.vitest.tsx
git add web/src/screens.tsx
git add web/src/styles.css
git add web/src/tabs/FeedTab.tsx
git add scripts/ops/resetTestAccount.ts
git add scripts/ops/resetTestAccountCheck.ts
git add .claude/state/HANDOFF.md
git add .claude/state/PROGRESS.md
git commit -m "74-h1 급한 수정: 재로그인 상태 비움 · 혼자 기록 닫기 · 애착 이름 · 코드 칸 · 기존 계정 알림"
```

(`scripts/ops/resetTestAccount.ts` · `resetTestAccountCheck.ts`는 74-h1 §1 - 메인 세션이 위임문 허가대로 미리 보기에 상대 사용자 · 탈퇴 유예 · 유예 시작일 줄만 더함. 지우는 동작 같음. `deno test` 10 통과.)

### 74-h2 커밋 명령 (Proteur, 74-h2 뒤 - 덧붙임 `docs/74-h2-addendum-new-account-blank.md` · 위임문 `74-h2-dispatch-hotfix.md` · R78 · R79-1)

**저장소 맨 위 폴더에서 친다.** 한 줄씩:

```
git add scripts/ops/resetTestAccount.ts
git add scripts/ops/resetTestAccountCheck.ts
git add web/src/App.tsx
git add web/src/app/backRules.ts
git add web/src/app/backRules.vitest.ts
git add web/src/app/routeTable.tsx
git add web/src/app/routes.ts
git add web/src/appFlow.vitest.tsx
git add web/src/auth/callback.ts
git add web/src/auth/callback.vitest.ts
git add web/src/auth/useAccountFinalize.ts
git add web/src/auth/useBootSession.ts
git add web/src/auth/useOnboardingResult.ts
git add web/src/components/AccountProblem.tsx
git add web/src/components/TrialDiag.tsx
git add web/src/config/env.ts
git add web/src/features/couple/CodeBoxes.tsx
git add web/src/features/couple/couple.vitest.tsx
git add web/src/features/feed/DateDetailScreen.tsx
git add web/src/features/feed/FeedView.tsx
git add web/src/features/feed/feed.vitest.tsx
git add web/src/features/feed/feedFlow.vitest.tsx
git add web/src/features/settings/KeyboardTestScreen.tsx
git add web/src/features/settings/SettingsView.tsx
git add web/src/hotfix74h1.vitest.tsx
git add web/src/hotfix74h2.vitest.tsx
git add web/src/platform/trialDiag.ts
git add web/src/screens.tsx
git add web/src/stores/accountProblemStore.ts
git add web/src/styles.css
git add web/src/tabs/FeedTab.tsx
git add .claude/state/HANDOFF.md
git add .claude/state/PROGRESS.md
git commit -m "74-h2 hotfix: server-backed result detail for new accounts, no-blank account states, link listener once, pre-connect record reaction, keyboard trial screen, reset script key hint"
```

(74-h1 커밋 파일과 겹치는 것은 이미 커밋돼 있으면 `M`으로 표시된다. 운영 번들에는 진단 표시 · 키보드 시험 문자열이 0 - `dist` 검색. 폰 확인은 `npm run build:trial` -> `npx cap sync android`.)

**Proteur 폰 확인 순서 (시험 빌드 `build:trial`)**

1. 초기화 스크립트 미리 보기 -> `--apply`로 시험 계정을 다시 지운다(반쪽 계정 정리)
2. 앱 삭제 -> 재설치 -> 처음 가입하는 사람 흐름 -> 카카오 -> **빈 화면 없이 결과 상세** -> [다음] -> 초대
3. 앱 완전 종료 -> 재실행 -> 같은 화면(초대)
4. 성격 프로필(설정)에 방금 고른 결과가 저장돼 있음
5. 로그인 -> 로그아웃 -> 같은 실행에서 로그인, 두 번 반복. 실패하면 화면 아래 작은 글씨(진단)를 그대로 적어 보내기
6. 피드에서 흐린 + 버튼 -> "연인과 연결되면 기록할 수 있어요" + [초대하러 가기]
7. 설정 맨 아래 -> 키보드 시험: 네 칸 중 영문 자판으로 열리는 칸 번호(삼성 키보드 / Gboard 각각)
8. 초대 -> 코드 입력: 칸 아래 "영문으로 바꿔 입력해 주세요" 보임, 영문 자판으로 열리는지
9. 성격 프로필 애착 칸: 안정이면 이름 칸이 없는 것이 정상(정본 표에 안정 항목 없음)

### 디자인 · 기준 자료 위치 (단계 0-3)

| 자료 | 위치 | 비고 |
|---|---|---|
| Nocturne v5 보드 | `docs/design/nocturne/` — 화면 `screens/*.jpg` 109장 · 목록 `screens_index.csv` · 보드 `boards/*.jpg` 13장 · 현재판 판정 `CURRENT.md` | 캔버스 HTML은 `canvas/N-R44-Voice.dc.html`(patch8) · `nocturne/canvas/N-R43-App-States.dc.html`(patch7) · `nocturne/canvas/Tokens.dc.html`(patch7) 셋만 있음. `CURRENT.md`가 말하는 `Components` · `N-R31-App-Fixes` · `P1-Cover-Note` · `N-S-D3-Magazine` HTML은 저장소에 없음 → 해당 화면은 JPG + 웹 데모 값 |
| patch3~8 | `docs/design/nocturne/CHANGES.md`(patch1~5 포함 여부는 본문) · `CHANGES_patch3.md` · `CHANGES_patch8.md` · `nocturne/CHANGES_patch6.md` · `nocturne/CHANGES_patch7.md` · `nocturne/CURRENT.md` | patch4 · patch5 별도 파일 없음(`CHANGES.md` · `CURRENT.md` 표로 대신) |
| 모션 명세 v2 | **저장소에 없음.** 가까운 것: `docs/ONDOLOG_DESIGN.md` §6 모션 · `boards/02_X1-Motion-Main.jpg` | 결정 기록 참조 — 웹 데모 값(이미 `web/`에 들어온 이징 · 시간)으로 대신 |
| 웹 데모 | 소스 zip은 저장소 밖(`73-`에서 `web/`로 반입 완료). 연출 값은 `web/src/styles.css` · `web/src/ui.tsx` · `web/src/navigation.tsx` | |
| `51-device-checklist.md` | `docs/51-device-checklist.md` | |
| `51b-` 결함 표 B1~B18 | `.claude/state/prompts/phase-7/PM_directive_51b-device-fixes.md` 37~54행 | F1~F3는 ROADMAP R75-5 · PM 지시서 §1(F1 뒤로 가기 · F2 이미지 저장 · F3 데모 끝 화면/기존 계정 알림) |
| 토큰 · UI 킷 | `docs/design/tokens/*.v2.ts.txt` · `docs/design/ui-kit/` · 탭 아이콘 `docs/design/nocturne/nocturne/icons/` | |

### 묶음 나누는 방식

`74-ui-builder-full-app.md` §2 표 그대로(74-0 → 74-8). 루트 관문(jest · tsc · Python)은 74-0 · 74-3 · 74-6 · 74-8 끝에.

### 74-0 명령 (Proteur가 먼저 써 볼 수 있음) - 74-h2 ④로 바뀜

**저장소 맨 위 폴더에서 친다**(PowerShell). 이 PC에서만 도는 스크립트다. 키는 화면에 보이지 않게 넣는다.

1. 값 넣기(PC에 이미 있으면 생략). 붙여넣기는 **마우스 오른쪽 클릭**이다:

```
$env:ONDOLOG_SUPABASE_URL = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString)).Password
$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString)).Password
$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY.StartsWith('sb_secret_')
```

   (줄을 칠 때마다 입력 칸이 나온다. 첫 줄에는 프로젝트 주소, 둘째 줄에는 운영용 **secret key `ops_2026_11`**을 넣는다 - 74-k2: legacy service_role 키는 비활성화됨. 셋째 줄(확인)이 `True`일 때만 진행한다. 공개 키(publishable)를 넣으면 "서비스 키가 아니에요" 안내가 나온다.)

2. 네트워크 허용 범위를 주소에서 읽는다(ref를 직접 적지 않는다):

```
$h = ([Uri]$env:ONDOLOG_SUPABASE_URL).Host
```

2-1. (75- 0-6) 허용 목록 파일 위치를 읽는다 - 아래 "0-6 잠금" 참조:

```
$al = Join-Path $env:USERPROFILE '.ondolog\reset-allowlist.txt'
```

   (`ONDOLOG_RESET_ALLOWLIST`에 다른 경로를 넣었으면 `$al = $env:ONDOLOG_RESET_ALLOWLIST`.)

3. 미리 보기(아무것도 지우지 않음):

```
deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_RESET_ALLOWLIST,USERPROFILE,HOME --allow-net=$h --allow-read="supabase/.temp/linked-project.json,$al" scripts/ops/resetTestAccount.ts <카카오 이메일>
```

4. 실제 삭제:

```
deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_RESET_ALLOWLIST,USERPROFILE,HOME --allow-net=$h --allow-read="supabase/.temp/linked-project.json,$al" scripts/ops/resetTestAccount.ts <카카오 이메일> --apply
```
5. 커플 모드(시험 커플 두 계정을 함께 지움 — R81-1). 이메일 2개를 주면 커플 모드다:

미리 보기(아무것도 지우지 않음):

deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_RESET_ALLOWLIST,USERPROFILE,HOME --allow-net=$h --allow-read="supabase/.temp/linked-project.json,$al" scripts/ops/resetTestAccount.ts <이메일1> <이메일2>


실제 삭제:

deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_RESET_ALLOWLIST,USERPROFILE,HOME --allow-net=$h --allow-read="supabase/.temp/linked-project.json,$al" scripts/ops/resetTestAccount.ts <이메일1> <이메일2> --apply


발행 호까지 지울 때(발행 호가 있으면 이 플래그 없이는 거부된다):

deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_RESET_ALLOWLIST,USERPROFILE,HOME --allow-net=$h --allow-read="supabase/.temp/linked-project.json,$al" scripts/ops/resetTestAccount.ts <이메일1> <이메일2> --with-issues --apply


잠금(75- 0-6 · R76-9 · R78-5 · 완료): 단독 · 커플 모드 · `--with-issues` 모두 아래 허용 목록을 지나야 한다.

#### 0-6 잠금 — 저장소 밖 허용 목록 (75-, R76-9 · R78-5)
초기화 스크립트(`resetTestAccount.ts`, 단독 · 커플 모드 · `--with-issues` 모두)는 **저장소 밖 허용 목록 파일**에 있는 이메일만 받는다. 판정은 접속 전(네트워크 0)이고, 미리 보기도 같다.
- 위치: 환경 변수 `ONDOLOG_RESET_ALLOWLIST`(파일 경로)가 있으면 그 파일, 없으면 `%USERPROFILE%\.ondolog
eset-allowlist.txt`. 저장소 안에 두지 않는다.
- 형식: UTF-8 텍스트, 한 줄에 하나. `#` 뒤는 주석, 빈 줄 무시.
  - `project=<개발 프로젝트 ref>` 줄 1개 이상(필수) — 접속 주소의 ref가 이 중 하나가 아니면 "개발 프로젝트가 아니다"로 거부
  - 나머지 줄 = 초기화를 허용할 시험 계정 이메일(대소문자 무시)
  - 그 밖의 모양은 "허용 목록 파일 형식 오류 (N번째 줄)"로 거부
- 거부(아무것도 조회 · 삭제하지 않음): 파일 없음/못 읽음 · `project=` 없음 · 주소 없음/모양 틀림 · ref 불일치 · 목록 밖 이메일(커플 모드에서 한 명만 밖이어도). 문구에 이메일 · ref · 경로가 나오지 않는다.
- 기존 확인(`linked-project.json`의 이름 · ref 대조)은 그대로 두고 그 앞에 이 확인을 더했다. 둘 다 통과해야 한다.
- 시험(원격 없음): Deno 28개 · 루트 jest `scripts/ops/resetAllowlist.test.ts` 14개.
끝나면 **PowerShell 창을 닫는다**(창 안의 환경 변수에 키가 남아 있다). 새 창에서 `[bool]$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY` → `False` 확인. 사용자 · 시스템 범위 영구 저장 금지(R87-6).

시험(원격 없음): `deno test --no-check --no-lock --unstable-sloppy-imports scripts/ops/resetTestAccountCheck.ts` (28개 통과 - 75- 0-6 시험 4개 추가)

### 누적 표 (묶음마다 자기 행을 더한다 — 74-8이 끝 보고로 묶는다)

**화면 대응표** — 화면 ID · 웹 파일 위치 · 보드 대조(같음 / 다름 + 이유)

| 화면 ID | 웹 파일 | 보드 대조 |
|---|---|---|
| 탭 바 | `web/src/tabs/TabBar.tsx` · `TabIcons.tsx` | 같음(보드 `tab_icons.md` 경로 · 값). 바 바탕만 불투명 `#0A0814`(B5) |
| 탭 5개 빈 틀 | `web/src/tabs/*Tab.tsx` · `TabFrame.tsx` | 자리 표시(각 묶음이 채움) |
| I01 커플 게이트 | `web/src/components/CoupleGate.tsx` · `app/sheets.tsx` | 같음(문구 · 두 원 · 버튼 둘). PNG + RN 값 기준 |
| I02 연결 끊김 띠 | `web/src/components/ConnectionBanner.tsx` · `connection/*` | 같음 |
| I03 불러오는 중 | `web/src/components/Skeleton.tsx` | 같음(.06~.12 · 1.6초) |
| I04 빈 상태 | `web/src/components/EmptyState.tsx` | 같음 |
| I05 되돌릴 수 없는 확인 | `web/src/components/ConfirmDialog.tsx` | 같음 |
| I06 토스트 | `web/src/components/ToastHost.tsx` · `stores/toastStore.ts` | 같음 |
| 공용 시트 부품 | `web/src/components/Sheet.tsx` | A12 법적 문서 시트가 이것으로 옮겨 감 |
| A17 연인 초대 | `web/src/features/couple/InviteScreen.tsx`(`mode='onboarding'`) | 같음(제목 · 부제 · MY CODE · [복사하기] · [공유하기] · "상대에게 코드를 받았어요 →" · 아래 "나중에 할게요 · 솔로예요"). 코드는 서버 발급. 발급 전 상태(코드 자리에 [초대 코드 만들기])는 보드에 없어 RN 문구로 |
| A18 초대 코드 입력 | 같은 파일 + `CodeBoxes.tsx` | 같음(← · 두 줄 제목 · 6칸 · 안내 문장 · [연결하기]). 오류 문구는 patch7 A18 ⓒ(자기 코드만 따로, 나머지 무효는 한 문구) |
| 커플 초대(I01에서) | 같은 `InviteScreen`(`mode='gate'`) · 경로 `couple-invite` | RN `couple-gate` 모달 -> 웹은 스택 화면. A17/A18과 같은 모양에 ←를 더하고 건너뛰기를 뺌 |
| A19 사귄 날짜 + 커플 닉네임 | `web/src/features/couple/StartDateScreen.tsx` | 같음(두 원 · "…과 연결됐어요" · 날짜 · 닉네임 · [시작하기]). 날짜 칸 오른쪽 → 화살표는 보드에만 있고 입력 칸이라 뺌(RN 동일) |
| A20 상대가 정한 날짜 확인 | 같은 파일(`mode='onboarding'` · `'recheck'`) · 경로 `start-date-recheck` | 같음(SINCE 카드 · 안내 · [확인했어요]) |
| B03 메인 - 아직 잴 기록 없음 | `web/src/features/main/MainView.tsx`(`layout.state='B03'`) | 같음(01 OUR TEMPERATURE 자리에 "아직 온도를 잴 기록이 없어요" · D+N · 02 FIRST STEP -> 채팅 · 03 FIRST ISSUE). 활동 있음 + 저장값 없음은 같은 틀에 "첫 온도는 기록한 다음 날 나와요"(r69). 보드의 상단 "끌어내리면 우리의 하늘" 힌트는 MVP 조정표대로 뺌 |
| B04 메인 - 기념일 당일 | 같은 파일(`'B04'`) | 같음(TODAY 히어로 "300일" · "오늘로 함께한 지 300일이에요" · 온도 칩은 저장값이 있을 때만) |
| B05 메인 - 미연결 | 같은 파일(`DisconnectedBody`) · `<CoupleGate fallback>` | 같음(36.5° 발광 없음 · "연인과 연결하면 두 사람의 온도로 바뀌어요" · 02 MY LOVE TYPE 카드 · [연인 초대하기]). 보드 카드의 "결과 자세히 보기 →"는 RN에도 없어 뺌 · 힌트 줄 뺌 |
| B06 메인 - 새 호 도착 | 같은 파일(`NewIssueCard`) | 같음(표지 글로우 · VOL.NN · "N월호가 꽂혔어요" · [읽기] · 03 NEXT ISSUE). 보드의 "0% →"는 누르는 곳이 없는 카드로 둠("제작 현황"은 범위 밖) |
| B01 메인 - 연결(온도) | 같은 파일(`'B01'`) | 같음(rose 발광 숫자 · D+N · 마일스톤 칩 · 지난 호 다시 읽기 · 다음 호 카드). 보드의 02 THIS WEEK 인용 칸은 MVP 조정표대로 뺌 |
| 하늘(메인 배경) | `web/src/App.tsx`(`skyFor('main')`) · `ui.tsx SkyLayer` | 같음(offset `viewOffsetPt.main` · 장막 .42 · 하단 장막 460px). 끌어내리기 · 하늘(C) · 유성은 범위 밖이라 0 |
| 온도 | `web/src/features/main/MainView.tsx`(`GlowNumeral`) · `stores/coupleStore.ts` | 저장값 읽기만(계산 0). 미연결 · 프로파일 미완 = 36.5 고정(발광 없음, textSub) |
| A09 공유 카드 | (화면 없음) | 이미지로만 존재(A08 [공유하기]가 `share/resultCard.ts`로 생성). 전체 화면 미리보기는 지움 |
| A10 약관 동의 문구(R74-10) | `web/src/screens.tsx`의 `ALL_CONSENT_NOTE` | 보드 A10에 문구가 없어 지시서 문구 그대로 |
| E01 피드 | `web/src/tabs/FeedTab.tsx` · `features/feed/FeedView.tsx`(`FeedChapterView` · `MonthChapterHeader` · `DateCard`) · `feedData.ts`(`useFeed`) | 같음(월 머리 112 숫자 · 영문 달 · 대표 카드 + 원문 한 줄 + 2열 · 오른쪽 월 바로 가기 · + 버튼). CURRENT.md 바뀐 점대로 머리는 "메모 N · 사진 N · 데이트 N"(별 0). 피드형/지도형 토글은 지도가 범위 밖이라 뺌. PNG는 옛 판이라 CURRENT.md 표 우선 |
| E13 피드 - 혼자 기록 | 같은 파일(`SoloBanner`) · `<CoupleGate fallback>` | 같음(두 원 · "혼자서도 기록할 수 있어요" · 초대 →). 기록할 커플 행이 없으면 문구가 "초대 코드를 만들면 기록할 수 있어요"로 바뀌고 + 버튼은 비활성(RN 그대로). [초대 →]는 I01 시트 한 번. 커플 행을 읽기 전에는 배너 자체가 없다(문구가 번쩍 바뀌지 않게) |
| E03 데이트 상세 | `features/feed/DateDetailScreen.tsx`(경로 `date-detail?id=`) | 같음(위 사진 + 장막 · 머리 · 메모 · stop 타임라인 · [사진 더하기]). CURRENT.md대로 내 사진 · 메모에 `⋯` 삭제 진입점 + 확인 시트(남의 기록에는 0). 사진을 누르면 크게 보기(RN에는 없던 것 - 74-4 지시) |
| E10 사진 직접 추가 | (화면 없음) | CURRENT.md "없앤다 - 시스템 사진 선택기로 대체". E03 [사진 더하기]가 바로 선택기를 열고 고른 사진을 그 데이트에 올린다(RN `/upload?dateId=`와 같은 `recordDate` 호출 - 날짜 고정 · 장소 · 메모 없음) |
| E11 데이트 기록 쓰기 | `features/feed/RecordSheet.tsx`(시트 `record`, `app/sheets.tsx`) | 같음(✕ · PHOTOS · 날짜/시간/장소 목록 · MEMO · [기록 남기기]). CURRENT.md대로 **시간 칸은 조건부**(이름 있는 장소 0 + 고른 사진에 촬영 시각 전무일 때만)와 안내 문구 2종. 칸의 모양은 보드 자료가 PNG(옛 판)뿐이라 해석했다 - 결정 기록 [74-4] 시간 칸 |
| E15 장소 고치기 | `features/feed/StopEditScreen.tsx`(경로 `stop-edit?id=&stop=`) | 같음(← · "장소" · 이름 입력 · 도착 시각). 보드의 검색 결과 · "FROM PHOTO" 위치 제안은 지도(범위 밖)라 없음 - RN과 같다 |
| F01 채팅 | `web/src/tabs/ChatTab.tsx` · `features/chat/ChatView.tsx`(`ChatConversation` · `ChatHeader` · `StoryStrip` · `TextMessage` · `PhotoMessage` · `Composer`) · `useChatMessages.ts` | 같음(이름 · D+N · 스토리 줄 · 날짜 구분 · 말풍선 · 끝까지 붙는 사진 · 입력 알약). 말풍선 등장 220ms · 끝 유지는 73-1c 값. 읽음 = 숫자 1(rose) |
| F02 채팅 미연결 | 같은 파일(`ChatDisconnected`) · `CoupleGate fallback` | 같음(patch7 대로 둘째 문장 "잡지의 재료" 없음). 시트가 아니라 화면 안 카드(B4), 두 버튼은 바로 초대(B12) |
| F03 스토리 보기 | `features/chat/StoryViewer.tsx` | 같음(위 막대 정지 표시 · 이름 + 몇 시간 전 · ✕ · 좌우 절반 넘기기 · "스토리는 24시간 동안 보여요"). 시트가 아니라 폰 틀 위 덮개, 뒤로 가기 = 닫기만 |
| F04 첨부 | `ChatView.tsx`(`AttachSheetBody`) | [앨범] + [카메라](웹 입력 `capture`). "최근 사진" 격자는 없음(사진 라이브러리를 훑지 않는다 R13-2) - 결정 기록 |
| F05 보내는 중 · 다시 보내기 | `ChatView.tsx`(`Meta` · `OfflineBanner`) | 같음(말풍선 .55 · "보내는 중" · rose 테두리 [다시 보내기] · 안내 줄 · 스피너 0) |
| F06 사진 크게 보기 | `ChatView.tsx` + 공용 `components/PhotoViewer.tsx`(`heading` · `footer`) | 같음(✕ · 이름 + 날짜시각 · [저장] [공유]). 저장은 `chatPhotoActions.saveChatPhoto` 한 곳(74-8이 바꿔 끼움) |
| 말풍선 복사 | `ChatView.tsx`(`CopyMenuBody`) | 보낸 글 길게 누르기 -> 앱이 그리는 [복사] 시트 -> `navigator.clipboard` |
| 사진 크게 보기 | `web/src/components/PhotoViewer.tsx` · `zoomMath.ts` | 보드 F06(채팅 사진)의 ✕ · 이름 · 사진 틀을 따른 공용 부품. 74-6 서재 뷰어도 `ZoomableImage` · `zoomMath`를 쓸 수 있다 |
| D01 매거진 서재 | `web/src/tabs/MagazineTab.tsx` · `features/magazine/LibraryView.tsx`(`LibraryShelf` · `NextIssueCard`) · `libraryData.ts` | 같음(머리 "매거진" · NEXT ISSUE 카드(큰 월 숫자 · 실루엣 · 정지 진행선 · % · 재료 두 줄) · LIBRARY N권 · 2열 표지 + 표지 밖 "VOL.NN" + "N월호"). 보드 PNG의 표지 안 글자(ONDOLOG · 문장)는 표지 이미지가 그린다 - 표지 위에 얹는 것 0(R21-3). "제작 현황 →"는 D02가 범위 밖이라 뺌 |
| D14 서재 - 첫 호 시작 | 같은 파일(`FirstIssue` · `ShelfHint`) | 같음(실루엣 · FIRST ISSUE · "첫 호를 만들기 시작했어요" · 진행선 · % · "발행한 호가 여기에 꽂혀요"). 초안이 없으면 0% |
| D16 매거진 - 미연결 | 같은 파일(`Unconnected`) · `<CoupleGate fallback>` | 같음(실루엣 · "두 사람의 첫 호가 들어갈 자리" · 안내 · [연인 초대하기] -> `openInvite('intro')`) |
| D10 속표지 | `features/magazine/IssueViewer.tsx`(`FrontMatter`) | 종이 바탕(#F1ECE4) · 워드마크 · 닉네임 · 표지 · "N월호" · 이름 · 실린 코너(지면 제목) · [읽기] · [PDF 내려받기] · 고지. **고지 문구는 CURRENT.md §1 / R31-9의 교체 문장**(`magazineCopy.FRONT_MATTER_NOTICE`, 보드 PNG의 옛 문장은 쓰지 않음). 표지 이미지는 보드의 가로 그림이 아니라 RN대로 1 : 1.414 세로 표지 |
| D11 뷰어 | 같은 파일(`PageReader`) | 밤 바탕 · ← · "N월호" · "8 / 19" · 쪽 이미지 한 장. 보드의 [목차] 버튼 · 아래 쪽 썸네일 띠는 **뺌**(D12 숨김 R31-8 + RN도 없음) |
| D12 목차 | (없음) | **숨김** - 쪽 번호 매니페스트가 없다(R48-1이 지움). `@/services/issueManifest`는 늘 null, 진입 버튼 0. 시험이 null · 버튼 없음을 지킴 |
| 쪽 넘기기 · 확대 | `IssueViewer.tsx`(`PageReader`) + 공용 `components/PhotoViewer.tsx`(`ZoomableImage`) · `zoomMath.ts` | 배율 1에서 옆으로 밀면 앞뒤 쪽(220ms 슬라이드 + 페이드 CSS, `prefers-reduced-motion` 즉시) · 두 번 누르기 2.5배 · 핀치 1~4배 · 끌기 · 방향키. 직접 구현, 라이브러리 0 |
| PDF 열기 | `IssueViewer.tsx` | [PDF 내려받기] -> 디지털 PDF 새 서명 주소(10분) -> 다리 `bridge.openBrowser`(앱의 시스템 브라우저). 앱 안에서 PDF를 그리지 않음 - 결정 기록 [74-6] [허가 요청] |
| H01 · H02 설정 목록 | `web/src/tabs/SettingsTab.tsx` · `features/settings/SettingsView.tsx` · `useSettingsSummary.ts` | 같음(ACCOUNT · COUPLE · PERSONALITY · PRIVACY · ETC 그룹, 값 + → 줄). 갈 곳이 없는 항목은 보드에 있어도 숨김(RN `HIDDEN_SETTINGS_ITEMS` 그대로: OUR SKY · 구독 · 사진 · 알림 · 데이터 · 생체정보 등). 값은 읽히기 전 I03 뼈대(B14), 다녀오면 직전 값 먼저. 해제 유예 중에는 연인 줄이 "해제 예정"(RN은 "연결 전") |
| H03 프로필 | `features/settings/ProfileScreen.tsx` · 경로 `settings-profile` | 같음(이름 · 성별 · 생년월일(읽기) · 연결된 계정 · 로그아웃 · 회원 탈퇴 · 머리 [저장]). 보드의 "사진 바꾸기"는 프로필 사진 칸이 없어 뺌(RN 동일) |
| H04 커플 | `features/settings/CoupleScreen.tsx` · 경로 `settings-couple` | 같음(연결 카드 · 사귄 날짜 · 커플 닉네임 · [연결 해제] + 안내). patch7 ⓓ대로 날짜 안내를 **날짜 줄 바로 아래**에(RN은 입력 모습에만). 미연결 = I01 카드 |
| H14 연결 해제 - 유예 중 | 같은 파일 + `DissolutionGrace.tsx`(`DissolutionGraceBody`) | 같음(DISCONNECTING · N일 · 날짜 · 안내 4줄 · PDF 줄). 보드의 "밤 12시"는 서버 값과 안 맞아 날짜만. 상대 쪽은 patch7 ⓔ(주어 바뀜 · 취소 버튼 자리에 이유 문장) |
| H14 연결 해제 - 문구 입력 | `features/settings/UnlinkScreen.tsx` + `PhraseConfirm.tsx`(I05 문구 입력) · 경로 `settings-unlink` | 같음(patch7 ⓖ: 확인어 `해제합니다`, 안내 + PDF 저장 안내 + 입력이 한 화면). 틀리면 [해제 요청하기] 꺼짐 |
| H05 성격 프로필 | `features/settings/PersonalityScreen.tsx` · 경로 `settings-personality` | 같음(결과 카드 + 세 줄). patch7 H05의 애착 슬롯대로 카드에 애착 이름(안정형 등)을 보임 - RN은 MASTER 10-5-3을 이유로 뺐으나 웹 A14가 이미 같은 이름을 보인다(결정 기록 [74-7]) |
| A14 · A15 · A16 설정 모드 | `features/settings/SettingsResultScreen.tsx` · 경로 `settings-result`(`?view=override`) + `screens.tsx`의 `DetailBody`(`onBack` 있고 `onNext` 없음) · `CoreOverrideView` | 같음(온보딩 A14~A16 본문 부품 재사용, 값은 서버 저장 결과, [다음] 없이 ← ). B17: 코어 목록 아래 여백 |
| H06 재검사 확인 · 흐름 | `PersonalityScreen.tsx`(`RetestConfirmBody` 시트) + `features/settings/RetestScreen.tsx` · 경로 `retest` | 확인 시트 문장은 보드 그대로(RN RetestConfirm과 같음). 시트는 가운데 카드가 아니라 공용 `Sheet`(R18-2 "확인은 시트"). A04~A07은 한 경로 안의 두 단계로 재사용, 마지막 문항 뒤 바로 저장 |
| H11 개인정보 & 약관 | `features/settings/PrivacyScreen.tsx` · 경로 `settings-privacy` | 같음(문서 3줄 + 마케팅 토글). 생체정보 · 데이터 내려받기 줄과 보드의 "3개월" 안내는 뺌(RN 동일). 문서는 A12 `LegalSheet`(공용 `Sheet`) |
| H16 회원 탈퇴 | `features/settings/WithdrawScreen.tsx` + `PhraseConfirm.tsx` · 경로 `settings-withdraw` | 같음(7일 뒤 지워지는 것 · 남는 것(커플일 때만) · "연결도 함께 해제돼요" · PDF 안내 · 확인어 `탈퇴합니다`) |
| 탈퇴 유예 화면(RN `withdraw-cancel`) | `features/settings/WithdrawCancelScreen.tsx` · 경로 `withdraw-cancel` | 보드에 없어 H14 유예 화면 형식을 빌림(RN 동일): WITHDRAWING · 남은 날짜 · 안내 3줄 · [탈퇴 취소하기] · [로그아웃]. 로그인 · 앱 시작 때 단계보다 먼저 |
| H19 앱 정보 · 문의 | `features/settings/AboutScreen.tsx` · 경로 `settings-about` | 같음(글자표 + 버전 · 문의하기 · 이용약관 · 개인정보 처리방침). "· 최신"과 오픈소스 라이선스는 뺌(RN 동일). 버전 = `web/package.json` |
| 해제 알림 | `features/settings/useDissolutionNotice.ts`(Shell, 탭 화면에서만) | RN `useDissolutionNotice`와 같음(상대가 요청했으면 앱에 들어올 때 처음 한 번 H14 유예 화면, 내가 개시자면 0, 같은 해제 id는 한 번) |
| 본인 기록 삭제 | `features/feed/DateDetailScreen.tsx`(`⋯` + 확인 시트) · RPC `fn_delete_own_entry` | E03 행 참조. 내 사진 · 메모에만 진입점, 확인 전 호출 0 |
| 사진 큐 | `web/src/photoQueue/*`(`photoQueueHub` · `photoQueueStore` · `webPhotoFs` · `usePhotoQueueResume`) | 보드 화면 없음(채팅 사진 · 스토리의 영속 큐). 앱을 다시 켜면 이어 보냄 |
| EXIF | `features/feed/photoPicker.ts`(`exifr@7.1.3` lite) | 보드 화면 없음. 촬영 시각만 읽고 위치는 읽지 않음([74-4]) |
| 닉네임 | A19 행 참조 | 사귄 날짜와 한 화면(`StartDateScreen`)에서 정함. 별도 화면 만들지 않음([74-2]) |
| 채팅 실시간 · 읽음 | `features/chat/useChatMessages.ts` · `chatApi.ts` | F01 행 참조. 채널 구독 + 읽음 `neq` 갱신 |
| 채팅 사진 | `features/chat/ChatView.tsx`(`PhotoMessage`) + `photoQueue/*` | F01 · F06 행 참조 |
| 채팅 스토리 | `features/chat/StoryViewer.tsx` · `ChatView.tsx`(`StoryStrip`) | F03 행 참조 |
| 전송 큐 | `features/chat/textQueueHub.ts` · `useChatQueueResume.ts` | F05 행 참조. 앱 시작 · 복귀 때 이어 보냄 |
| 메우기 | `features/chat/useChatMessages.ts`(구독 확정 뒤 빠진 메시지 채움) | 루트 `chatGapFill` 규칙 그대로 |
| E10 (사진 직접 추가) | (화면 없음) | **만들지 않음** - CURRENT.md "시스템 선택기로 대체". E03 [사진 더하기]가 같은 일을 함 |
| D12 (목차) | (화면 없음) | **만들지 않음(숨김)** - 쪽 번호 매니페스트가 없음([74-6]) |

**PM 지시서 §1 대조 결과(74-8)** - 대조한 항목 **58개**: 온보딩 마무리 A17 · A18 · A19 · A20 · 사귄 날짜 · 닉네임(6) / B03 · B05 · B06 · B04 · 하늘 · 온도(6) / E01 · E03 · E10 · E11 · E13 · E15 · 본인 기록 삭제 · 사진 큐 · EXIF(9) / D01 · D10 · D11 · D12 · D14 · D16 · 넘김 · 확대 · PDF(9) / F01~F06(6) · 실시간 · 읽음 · 사진 · 스토리 · 전송 큐 · 메우기(6) = 12 / H01~H06(6) · H11 · H14 · H16 · H19 = 10 / I01~I06(6). 웹에 있음 **56**, 화면 없음 **2**(E10 대체 · D12 숨김, 이유는 위 두 행). 빠진 행 0.

**RN 행동 단언 이전표** — 묶음 · RN 시험 파일 · 행동 단언 수 · 옮긴 수 · 옮긴 Vitest 파일 · 못 옮긴 것과 이유

| 묶음 | RN 시험 | 단언 수 | 옮긴 수 | Vitest | 못 옮긴 것 · 이유 |
|---|---|---|---|---|---|
| 74-2 | `__tests__/services/coupleConnect.test.ts` | 4 | 4(+RPC 오류 3종 웹 경로 1) | `features/couple/coupleApi.vitest.ts` | - |
| 74-2 | `__tests__/services/coupleStartApi.test.ts` | 7 | 7 | 같은 파일 | - |
| 74-2 | `__tests__/services/onboardingStep.test.ts` | 3 | 3(완료 3 불변 · 순서대로 올라감 · 나중에 뒤 2로 안 내려감) | 같은 파일 | "길이 4 이하 모든 순서 1000+ 조합"은 웹 함수가 정본 `advanceOnboardingStep`을 그대로 부르므로(조건 `.lt`) 루트 jest가 계속 지킴 |
| 74-2 | `__tests__/utils/coupleStart.test.ts` | 순수 규칙 14 | 3(묶음 단언) | 같은 파일 | 웹이 `@/utils/coupleStart`를 그대로 가져다 쓰므로 세부(조합 · 형식 오류)는 루트 jest가 지킴 |
| 74-2 | `__tests__/utils/afterLogin.test.ts`(`resumePathFor`) | 1 | 1 + 웹 판정 5 | 같은 파일 | `decideAfterLogin`은 이전 묶음 `finalize.vitest.ts`가 이미 지킴 |
| 74-2 | `__tests__/utils/settingsRules.test.ts`(`needsStartDateConfirm`) | 4 | 1(묶음) | 같은 파일 | - |
| 74-2 | `__tests__/components/u6Onboarding2.test.tsx`(A17 · A18 · A19 · A20 · 재개) | 약 30 | 약 30 | `features/couple/couple.vitest.tsx` | A14~A16(상세 결과 · 코어 고치기)과 "공유 버튼 없음"은 74-2 범위 밖(웹 A08 공유가 정식); `invite-code` 길게 눌러 복사(`selectable`)는 웹에선 [복사하기] 버튼 + `user-select: all`로 대체 |
| 74-2 | `__tests__/components/u7Settings.test.tsx`(A20 재표시 4) | 4 | 4 | `features/couple/couple.vitest.tsx` | H04 설정 > 커플 단언은 74-7 몫 |
| 74-2 | `__tests__/components/u6ExistingAccount.test.tsx`(단계별 재개) | 7 | 7 | `features/couple/couple.vitest.tsx`(`앱을 닫았다 열면` 표) + `appFlow.vitest.tsx`(F3) | A11 로그인 길 단언은 이전 묶음에서 이미 옮김 |
| 74-3 | `__tests__/components/u1Main.test.tsx` | 약 28 | 약 28(상태 넷 + B04 + B06 보임/숨김 + 36.5 발광 없음 + MVP 뺀 것) | `features/main/main.vitest.tsx` | 하단 장막 스타일 값 단언은 CSS 값이라 App 시험이 `.veil` .42 · `.bottomVeil` 켜짐으로 대신. RN `useFocusEffect`는 마운트 + `visibilitychange` 재읽기로 바뀜 |
| 74-3 | `__tests__/services/issueSeen.test.ts` | 5 | 5 | 같은 파일(Preferences 메모리 사본) | - |
| 74-3 | `mainScreen` · `relationshipDays` · `magazine` · `mainApi` · `magazineApi` 시험 | - | 0 | - | 웹이 `@/utils` · `@/services`를 그대로 가져다 쓰므로(사본 0) 루트 jest가 계속 지킴. 웹 시험은 가짜 클라이언트로 훅까지 상태 4가지를 돌림 |
| 74-4 | `__tests__/components/u2Feed.test.tsx` | 15 | 9(월 머리 문구 · 대표 카드 원문 한 줄 · E13 배너 둘 · FAB 비활성 · 타임라인 시각 · 장소 줄 -> E15 · 00:00 · 지우기는 내 것만 · 확인 문구) | `features/feed/feed.vitest.tsx` | U0 손질 5(그레인 크기 · textFaint · lilacText)는 RN 스타일 값이라 안 옮김 · I05 "보이지 않으면 안 그린다"는 웹 시트가 눌렀을 때만 생겨 따로 없음 |
| 74-4 | `__tests__/services/dateRecordApi.test.ts` | 38 | 웹 경로로 약 20(기록 순서 · manual/확인됨 · stop · 사진 행 · 메모 · 파생 칸 · 메모만/같은 날짜 더하기 · 업로드 실패 · 규칙 6 · 삭제 RPC만 · stop 시각 R30-2) | `feed.vitest.tsx` | 웹이 `@/services/dateRecordApi`를 그대로 가져다 쓰므로(사본 0) 38건 전체는 루트 jest가 계속 지킨다. 웹은 가짜 클라이언트로 화면 경로를 지나며 같은 결과가 나오는지만 본다 |
| 74-4 | `__tests__/utils/dateRecord.test.ts` · `dateRecordTimezone.test.ts`(EXIF 날짜 규칙 포함) | 50 | 0(순수 규칙은 루트 jest) + 웹 새 12 | `features/feed/photoPicker.vitest.ts` | 웹 쪽 새 시험: 손으로 만든 EXIF JPEG에서 촬영 시각 · 시간대 · DateTimeDigitized/DateTime 대체 · EXIF 없음 = null(수정 시각 안 씀) · GPS 파일에서도 lat/lng null · 가로세로 · 방향 · 확장자 · 30장 제한 |
| 74-4 | `__tests__/hooks/chatPhotoQueue.test.tsx` | 6 | 6(메시지 끊김 -> 재시작 객체 1 · 행 1(+한 번 더) · 올리기 끊김 · 스토리 응답 끊김 · 스토리 올리기 끊김 · 복사본 사라짐 · 취소) | `web/src/photoQueue/photoQueue.vitest.tsx` | 말풍선 목록 · `hasQueued` 같은 채팅 화면 상태 단언은 74-5(채팅 화면)가 이어받는다 - 여기서는 허브 · 서버 · 기기 저장으로 확인 |
| 74-4 | `__tests__/hooks/chatQueueResume.test.tsx` | 5 | 5(앱 시작 이어 보내기 · 복귀 즉시 재개 · 동시 업로드 0 · 커플 아님은 안 돎 · 로그아웃해도 큐 유지 -> 다음 로그인에 이어 감) + 커플 확인 중(loading)에는 큐를 끊지 않음 1 | 같은 파일 | 글(텍스트) 큐 단언은 74-5 - 사진 쪽만 옮김 |
| 74-4 | `__tests__/utils/chatPhotoQueue.test.ts` | 10 | 0 | - | 웹이 `@/utils/chatPhotoQueue` · `chatPhotoQueueRunner`를 그대로 가져다 쓰므로 루트 jest가 계속 지킴. 웹 새 시험: 기기 저장 키(RN과 같음) · 깨진 저장 = 빈 큐 · 파일 복사/읽기/지우기(Filesystem 가짜) 3 |
| 74-5 | `__tests__/components/u4Chat.test.tsx` | 약 25 | 약 22(F02 게이팅 3 · F01 상태 · 보내기 · 안내 줄 · F05 5종 · 사진 · F04 · 스토리 올리기 · 사진 뷰어 · 스토리 뷰어) | `features/chat/chat.vitest.tsx`(25) | RN 스타일 값(색 · 폰트 이름) 단언은 CSS라 안 옮김. InviteSheet(F02 시트) 단언은 시트가 화면 안 카드로 바뀌어 74-2 `couple.vitest.tsx`가 지킴 |
| 74-5 | `__tests__/hooks/useRealtimeGapFill.test.tsx` · `chatQueueResume.test.tsx`(글 쪽) · `chatPhotoQueue.test.tsx`(채팅 말풍선 쪽) | 약 12 | 약 12 + 웹 새(채널 이름 · 읽음 neq · 지운 행 거름 · 취소 · 소진 후 다시 보내기) | `features/chat/chatData.vitest.tsx`(30) | - |
| 74-5 | `__tests__/services/chatCore.test.ts` · `utils/chatMessages.test.ts` · `chatRetryQueue.test.ts` · `chatQueue.test.ts` · `chatGapFill.test.ts` | - | 0(웹 허브를 거친 행동은 위 파일) | - | 웹이 `@/services/chatCore` · `@/utils/*`를 그대로 가져다 쓰므로 루트 jest가 계속 지킴 |
| 74-5 | (신규) 한글 조합 R73-2 | - | 18 | `platform/chatComposer.vitest.tsx` | 삼성형 · Gboard형 이벤트 순서 흉내: "ㅋㅋ" 바로 보내기 · "안녕" 뒤 0ms "ㅎ" · 조합 중 엔터 한 번 · 연속 세 번 · 포커스 유지 |
| 74-6 | `__tests__/components/u3Library.test.tsx` | 약 19 | 약 18(VOL 라벨 · 표지 위 글자 0 · moon은 Vol만 · 표지 누르기 · 다음 호 카드(정지 값 · 재료 줄 · 못 셌으면 없음 · 제작 현황 0) · D14 · D16 · 본문 분기 3 · 오류 · 뼈대 · 속표지 값 · 고지 문장 · 종이 · 읽기 · 닫기 · PDF 경로 없음 · 목차 없음) | `features/magazine/magazine.vitest.tsx` | `pageFromOffset`(스크롤 위치 -> 쪽 번호)은 웹이 스크롤이 아니라 밀기 단위라 해당 없음 -> 밀기 시험으로 대체 |
| 74-6 | `__tests__/components/u3MagazineTab.test.tsx` | 5 | 5(D16 + 초대 · 연결 전 미확정 · D14 · 서재 + 다음 호 카드 + 뷰어로 · 로딩 뼈대) | 같은 파일 | 뷰어로 가는 길은 RN `router.push` -> 웹 `openIssueViewer` 입구 |
| 74-6 | `__tests__/components/u3ViewerModal.test.tsx` | 9 | 9(속표지 -> 읽기 -> 뒤로 · 닫기 · 1쪽 서명 · 열어 봄 기록 · 보던 쪽 기억 · PDF 열기 3종 · 못 읽은 호) | 같은 파일 | AsyncStorage -> Preferences 키 같음. `Linking.openURL` -> `bridge.openBrowser` |
| 74-6 | `__tests__/services/magazineApi.test.ts` · `utils/magazine.test.ts` · `hooks` | - | 0(루트 순수 파일을 `@/`로 가져다 쓰고 루트 jest 1771이 계속 지킴) | - | 화면이 그것을 부르는 호출 수준(issues_public만 · published_at 조건 · 인쇄 칸 · 버킷 0 · 서명 경로)만 위 파일에서 다시 확인 |
| 74-6 | (신규) B13 서재 상태 순서 · 뷰어 입구 · 넘기기 | - | 12 | `magazine.vitest.tsx` | 뼈대 -> 서재 / 뼈대 -> D14 한 방향 · 연결 전 미확정 · 다시 읽기 중 · 실패 · 탭 돌아옴 · 호 늘어남에서 상태 안 오감 / 입구 -> 덮개 · 뒤로 가기는 덮개만 · 경로 바뀌면 닫힘 / 밀기 · 방향키 · 확대 중 안 넘어감 · 이미지 오류 한 번 재시도 |
| 74-4 | `__tests__/` 본인 기록 삭제 · stop 시각 · 피드 묶음 | - | 위 표에 포함 | `feed.vitest.tsx` | 삭제: `fn_delete_own_entry` RPC만(직접 update 0) · 확인 전 호출 0 · 취소 0 · 실패 토스트 · 남의 기록 진입점 0 |
| 74-7 | `__tests__/components/u7Settings.test.tsx`(H01~H06 · H11) | 약 45 | 약 40(숨김 항목 없음 · 남은 줄 모두 갈 곳 · 생년월일 읽기 전용 · 이름 0 · 21자 · 사귄 날짜 한 번의 UPDATE(set_by 나 · confirmed null) · 미래 날짜 불가 · 닉네임 0 · 1 · 20 · 21 · 오버라이드가 쓰는 칸 · 재검사 1회 비활성 · 재검사가 함수 호출 하나 · 23505 = 이미 사용 · 로그아웃 · 마케팅 켜기 · 끄기 · 실패 되돌림) | `features/settings/settings.vitest.tsx`(81건 중) | 상대 쪽 A20 재표시 4건은 74-2 `couple.vitest.tsx`가 이미 지킴 · RN 스타일 값(색 · 서체) 단언은 CSS라 안 옮김 |
| 74-7 | `__tests__/components/u7Dissolution.test.tsx`(H14 · H16 · 유예) | 약 30 | 약 28(양쪽 유예 화면 · 개시자 취소 있음 · 상대 취소 없음 + 이유 · 서버 값 기준 남은 날짜 · 문구 일치 · 서로 다른 확인어 · 요청/취소 함수 호출 하나 · 직접 쓰기 0 · 오류 문구 · 유예 로그인 먼저 · 탈퇴 취소 뒤 원래 단계) | 같은 파일 + `settingsFlow.vitest.tsx`(21건) | `useFocusEffect` -> 마운트 + `visibilitychange` |
| 74-7 | `__tests__/services/settingsCore.test.ts` · `dissolutionCore.test.ts` · `utils/dissolution.test.ts` · `settingsRules.test.ts` · `supportMail.test.ts` | - | 0(루트 순수 파일을 `@/`로 가져다 쓰고 루트 jest가 계속 지킴) | - | 화면이 그것을 부르는 호출 수준(쓰는 칸 · 함수 이름 · 인자 · 오류 코드 처리)만 위 파일에서 다시 확인. 실행 함수(`execute_dissolution` 등) 호출 0은 한 흐름에서 부른 함수 이름 전체를 모아 단언 |
| 74-7 | `__tests__/hooks/useDissolutionNotice.test.tsx` · `resolveResumePath.test.ts`(유예 먼저) | 약 8 | 약 10(상대가 요청했을 때 한 번 · 같은 id 재복귀 0 · 내가 개시자 0 · 요청 없음 0 · 탭이 아니면 읽지도 않음 · 읽기 실패 조용 · 앱 전체에서 메인 위 한 번 · 유예 시각이 있으면 단계 무관 withdraw-cancel · 서버 더 부르지 않음 · 앱 시작과 로그인 직후 모두) | `settingsFlow.vitest.tsx` | AppState `active` -> `visibilitychange` |
| 74-7 | `__tests__/app/settingsAbout.test.tsx`(H19) | 약 8 | 8(버전 값 · "최신" 0 · 오픈소스 0 · mailto 주소 = 상수 · 제목 · 본문 세 줄 · 계정 id · 커플 id · 이름 · 이메일 0 · 열 수 없을 때 토스트 · 약관 시트) | `settings.vitest.tsx` | 버전 출처가 Expo 설정에서 `web/package.json`으로 바뀜 |
| 74-7 | (신규) 웹 뒤로 가기 · 로그아웃 | - | 신규 약 14 | `backRules.vitest.ts`(경로 10 더함) · `settingsFlow.vitest.tsx` | 설정 -> 프로필 -> 탈퇴 한 단계씩 · 시트만 닫기 · 재검사 단계 · 유예 화면 하드웨어 뒤로 = 종료 / ← = 로그아웃 · 로그아웃 뒤 계정 잠금 풀림 · 채팅 큐 키 유지(Preferences 가짜) · 서버 로그아웃 실패 시 scope local |
| 74-8 | (신규) F2 이미지 저장 | - | 신규 4 | `platform/imageSave.vitest.ts` + `chat.vitest.tsx`(저장 시험 2) | 이름이 매번 다름(같은 밀리초여도 무작위 칸) · 결과 카드와 채팅 사진이 같은 다리 함수 · 실패 = `failed`만 + 안내 문장 + 로그 0 · 앱 저장은 캐시 쓰기 + 공유 시트 |
| **합계** | 위 RN 시험 파일 전체(행동 단언만) | 약 392 | **약 283** | - | 나머지 약 109는 루트 순수 파일을 `@/`로 가져다 쓰므로 루트 jest 101파일 1771건이 계속 지킨다(묶음별 행 참조). "약"은 RN 시험이 "약 N"으로 센 값의 합. 묶음별 옮긴 수 / 전체: 74-2 60/74 · 74-3 33/33 · 74-4 40/124 · 74-5 34/37 · 74-6 32/33 · 74-7 84/91 |

**B1~B18 · F1~F3 막는 위치** — 번호 · 막는 시험 또는 확인 위치

| 번호 | 위치 |
|---|---|
| B4 · B12 (채팅) | `features/chat/chat.vitest.tsx`(F02 시트 저절로 0 · 두 버튼 바로 초대 · 시트 안 열림) |
| B4 | `components/components.vitest.tsx`(시트 한 번 · 카드엔 손잡이 없음 · 조회 전 0) · `app/shell.vitest.tsx`(탭을 옮기면 시트 닫힘) · `stores/stores.vitest.ts`(시트 한 칸) |
| B5 | `styles.css`의 탭 바 · 탭 화면 · 시트 면 단색 `#0A0814`(시험 아닌 확인 항목 - 전환 중 흰 프레임은 실기기 녹화로) |
| B12 | `components/components.vitest.tsx`(카드 버튼은 시트를 다시 열지 않고 `openInvite`로 바로) |
| F1 | `app/backRules.vitest.ts`(규칙표 · 경로별 결과표) · `app/shell.vitest.tsx` |
| B6 | `features/couple/couple.vitest.tsx`(공유 문구 "온도록에서 연결해요! 초대 코드: CODE" · 옛 이름 0) |
| B9 | `features/couple/couple.vitest.tsx`(코드 칸 `autocapitalize=characters` · 대문자 변환 · 열리면 포커스). 키보드가 칸을 가리지 않는 것은 실기기 확인(`platform/keyboardFocus`) |
| B12 | `features/couple/couple.vitest.tsx`(I01 -> 초대에서 같은 문구 시트 없이 바로 코드 발급 · 입구 중복 쌓임 0) |
| B18 | `screens.vitest.tsx`(마케팅 기본 꺼짐 · 전체 동의 해제 시 꺼짐) |
| F3 | `appFlow.vitest.tsx`(알림 원문 · 메인 위 한 번 · 결과 없으면 0 · `/end` 없음) |
| B13/B14(메인) | `features/main/main.vitest.tsx`(연결 여부 · 사실 · 호 목록이 읽히기 전에는 뼈대만, 새 호 카드가 떴다 사라지지 않음, 조회 중에도 미연결 B05는 바로) |
| R74-10 | `screens.vitest.tsx`(정확한 문장 · "전체 동의" 줄 바로 아래 · 누르기 전부터) |
| B4(기록 시트) | `features/feed/feed.vitest.tsx`(+ 버튼 두 번 눌러도 시트 하나) · `feedFlow.vitest.tsx`(뒤로 가기는 시트만 닫음 · 탭을 옮기면 닫힘) |
| B5(피드 · 상세 · 장소 면) | 시험 아닌 확인 항목 - `.screen.solid`(`#0A0814`) · 시트 면 `var(--ink)`. 사진 크게 보기 면도 단색. 전환 중 흰 프레임은 실기기 녹화로 |
| B9(E11 · E15 입력 칸) | 실기기 확인 항목 - 칸마다 `platform/keyboardFocus`(전역)가 키보드 위로 스크롤. 장소 · 날짜 · 도착 시각 · 메모 칸이 가려지지 않는지 |
| B10(피드 맨 위) | 실기기 확인 항목 - `.feedTab::before`가 맨 위 안전 영역을 바탕색으로 덮는다(스크롤한 내용이 상태 표시줄 아래로 비치지 않는지) |
| B13/B14(피드) | `feed.vitest.tsx`(불러오는 동안 I03 뼈대 · 커플 행을 읽기 전에는 E13 배너도 I01 카드도 없음 · 오류는 [다시 불러오기]) |
| F1(스택 화면) | `app/backRules.vitest.ts`(`date-detail` · `stop-edit` 경로표) · `feedFlow.vitest.tsx`(카드 -> 상세 -> 장소 -> ← -> ← -> 피드 · 하드웨어 뒤로 가기 · 사진 크게 보기 열림 중에는 그것만 닫음) |
| B13(매거진) | `features/magazine/magazine.vitest.tsx`("B13 로드 상태가 오가지 않는다" 6건: 서재 상태를 MutationObserver로 순서 기록 -> `loading -> shelf` / `loading -> first`만 · 연결 전 D16 · D14 미확정 · 다시 읽기 중 · 실패해도 서재 유지 · 탭 돌아와도 뼈대 안 거침). 원인(RN): 연결 여부 · 조회 상태 · 호 수가 따로 바뀌며 화면이 중간 상태를 그림 -> 웹은 한 방향 단계(`idle -> loaded | failed`) + 직전 값 기억 |
| B5(서재 · 뷰어) | 시험 아닌 확인 항목 - 탭 화면 `.screen.solid` · 덮개 바탕은 단색(종이 `#F1ECE4` / 밤 `var(--ink)`). 전환 중 흰 프레임은 실기기 녹화로 |
| B10(서재 맨 위) | 실기기 확인 항목 - `.magazineTab::before`가 맨 위 안전 영역을 바탕색으로 덮는다 |
| F1(뷰어) | `magazine.vitest.tsx`(하드웨어 뒤로 가기 = 덮개만 닫음, 앞 화면 · 앱 종료로 안 샘 · 닫은 뒤 평소 뒤로 가기 복귀 · 경로 바뀌면 닫힘) |
| B14(설정) | `features/settings/settings.vitest.tsx`(H01 값 자리 뼈대 -> 사라짐 · 다녀오면 직전 값 먼저 · H03 · H04 · H14 · 탈퇴 유예 읽는 동안 뼈대, 미연결 카드가 번쩍이지 않음) |
| B15 | `settings.vitest.tsx` · `settingsFlow.vitest.tsx`(탈퇴 취소 -> 토스트 "탈퇴를 취소했어요" + 원래 단계 · 해제 취소 -> "해제를 취소했어요") |
| B10(설정) | 실기기 확인 항목 - 푸시 화면 머리(`.pushHeader`)가 맨 위 안전 영역 아래에서 시작하고 본문만 스크롤 · 설정 탭 머리(`.tabHeader`)는 스크롤 밖 |
| B9(H14 · H16 · H03 · H04 입력 칸) | 실기기 확인 항목 - 입력 칸이 모두 스크롤 본문(`.setBody`) 안에 있어 `platform/keyboardFocus`가 키보드 위로 올림. 확인 버튼은 본문 밖 아래 고정(`.setFooter`)이라 창이 줄면 키보드 위에 남는다 |
| B17 | `settings.vitest.tsx`(코어 목록 아래 여백 >= 54). 목록과 버튼은 따로 배치라 가려질 일이 없지만 여백도 둠. `.setBody` 아래 여백도 버튼 높이 이상 |
| F1(설정 스택) | `app/backRules.vitest.ts`(경로 10 결과표) · `settingsFlow.vitest.tsx`(하드웨어 뒤로 가기 한 단계씩 · 시트만 닫기 · 재검사 안 단계 · 유예 화면 = 종료) |

**B1~B18 · F1~F3 전체 21행 (74-8 총정리)** - 번호 · 웹에서 막는 곳 · 시험 파일 또는 확인 방법

| 번호 | 막는 위치 |
|---|---|
| B1 로그인 콜백 404 · PGRST303 | `auth/callback.ts` + `auth/callback.vitest.ts`(주소 해석) · `auth/loginFlow.vitest.tsx`(교환 실패 -> "로그인하지 못했어요" + [다시 시도], 오류 원문 · 코드 화면 0 / 첫 조회 PGRST303 한 번 재시도) · `auth/finalize.vitest.ts`(재시도 1회, 두 번이면 던짐) |
| B2 동의 문장 안 보임 | `screens.vitest.tsx` "A10 약관 동의 (B2 · B18 · E6)" - 항목 문장 · "전체 동의" 라벨 · "(선택)" 표시 |
| B3 Android 글자 칸 폭 | **해당 없음** - RN `Text`가 Android에서 폭을 줄이던 문제. 웹뷰는 CSS 박스라 같은 원인이 없다. 대신 실기기에서 시스템 글자 크기 최대 화면 확인(탐방 안내 7장) |
| B4 채팅 탭 초대 시트 반복 | `features/chat/chat.vitest.tsx`(F02 시트 저절로 0) · `components/components.vitest.tsx` · `app/shell.vitest.tsx` · `stores/stores.vitest.ts` |
| B5 흰 화면 번쩍임 | 시험 아닌 확인 항목 - 단색 `#0A0814` 면. 실기기 녹화로 흰 프레임 0 |
| B6 공유 문구 "온돌로그" | `features/couple/couple.vitest.tsx`(공유 문구 + 옛 이름 0) |
| B7 기존 계정 재온보딩 안내 | `appFlow.vitest.tsx`(알림 원문 · 메인 위 한 번 · 결과 없으면 0) · `auth/loginFlow.vitest.tsx`(로그인 부제 "새로 가입하면 방금 본 결과가 계정에 저장돼요.") |
| B8 간이 MBTI | `quickMbti.vitest.ts`(문항 -> 글자 대응 + 16조합 전수) |
| B9 키보드가 입력 가림 | `couple.vitest.tsx`(코드 칸 대문자 · 포커스) + 실기기 확인(`platform/keyboardFocus`) |
| B10 상태 표시줄 비침 | 실기기 확인 - `.feedTab::before` · `.magazineTab::before` · `.pushHeader` |
| B11 카카오 버튼 진행 표시 | `auth/loginFlow.vitest.tsx`("이동 중"으로 바뀌고 다시 눌리지 않음) |
| B12 카드 시트 한 번 더 | `components.vitest.tsx` · `couple.vitest.tsx` · `main.vitest.tsx`(초대 버튼이 시트를 거치지 않고 초대로) |
| B13 매거진 빈 상태 깜빡임 | `features/magazine/magazine.vitest.tsx`(6건) · `main.vitest.tsx` · `feed.vitest.tsx` |
| B14 설정 값 늦게 채움 | `features/settings/settings.vitest.tsx`(I03 뼈대) · `feed.vitest.tsx` |
| B15 취소 뒤 알림 | `settings.vitest.tsx` · `settingsFlow.vitest.tsx` |
| B16 메인 초대 시트 문구 | `main.vitest.tsx`(초대 버튼 = 초대 화면, 잠금 안내 시트 0) |
| B17 코어 목록 마지막 줄 | `settings.vitest.tsx`(아래 여백 >= 54) |
| B18 마케팅 기본값 | `screens.vitest.tsx`(기본 꺼짐 · 전체 동의 해제 시 꺼짐) |
| F1 뒤로 가기 | `app/backRules.vitest.ts`(41건) · `app/shell.vitest.tsx` · `feedFlow.vitest.tsx` · `magazine.vitest.tsx` · `settingsFlow.vitest.tsx` · `chat.vitest.tsx`(덮개만 닫음) |
| F2 이미지 저장 | `platform/imageSave.vitest.ts`(4) · `chat.vitest.tsx`(저장 이름 · 실패 안내) · `screens.vitest.tsx`(저장 -> 토스트 / 실패 안내). 갤러리 노출은 실기기 확인([74-8] 판단) |
| F3 데모 끝 화면 / 기존 계정 알림 | `appFlow.vitest.tsx`(알림 원문 · 메인 위 한 번 · 결과 없으면 0 · `/end` 없음) |

**뒤로 가기 표** — 원본은 코드의 규칙표(74-1이 만든 파일). 여기에는 파일 경로와 경로 수만.

- `web/src/app/backRules.ts`(`BACK_RULES`) - 19경로(온보딩 12 · 탭 5 · 스택 2: `couple-invite` · `start-date-recheck`; 74-2에서 `share` 삭제 · `start-date` 추가). 시험 `web/src/app/backRules.vitest.ts`(경로별 4조합 결과표 · 라우터 표 = 규칙표 키 일치).
- 74-4: 스택 둘 더함(`date-detail` · `stop-edit`, 둘 다 뒤로 = 앞 화면) -> 21경로(온보딩 12 · 탭 5 · 스택 4). 화면에 실리는 값(데이트 id · 장소 id)은 `nav.push(name, { params })` -> 주소 끝 `?id=&stop=`.
- 74-6: 새 경로 0(뷰어는 `PhoneLayer` 덮개 - `useBackHandler`가 열려 있는 동안 먼저 받아 덮개째 닫는다). 21경로 그대로.
- 74-7: 스택 10경로 더함 -> **31경로**(온보딩 12 · 탭 5 · 스택 14). `settings-profile` · `settings-couple` · `settings-unlink` · `settings-personality` · `settings-result` · `retest` · `settings-privacy` · `settings-about` · `settings-withdraw` = 뒤로 = 앞 화면 / `withdraw-cancel` = **종료**(RN 루트 화면 동작, 화면의 ← 는 로그아웃). 화면 안 단계의 뒤로 가기는 화면이 `useBackHandler`로 받는다: `settings-couple` 입력 모습(날짜 · 닉네임) -> 줄 목록으로 · `retest`의 5문항 첫 문항 -> MBTI 단계, MBTI 단계 -> H05, 저장 중에는 삼킴 · `settings-result`의 A16 -> A14(설정에서 곧바로 연 `?view=override`는 H05로) · H06 확인 시트는 시트만 닫음.

**뒤로 가기 표 펼침 (74-8)** - 원본은 `web/src/app/backRules.ts`의 `BACK_RULES`(**31경로**). 시험은 `web/src/app/backRules.vitest.ts` **41건**(구조 5 + 표 덮음 1 + 경로별 31 + 고정 규칙 4). 경로마다 4조합(계정 없음 / 있음 x 깊이 1 / 2)을 단언한다.

| 경로 | 영역 | 계정 없음 (1 / 2) | 계정 있음 (1 / 2) |
|---|---|---|---|
| intro | 온보딩 | 종료 / 종료 | 종료 / 종료 |
| basic · mbti · quiz · brief · consent · underage · auth · callback | 온보딩 | 종료 / 앞 화면 | 종료 / 종료 |
| detail · invite · start-date | 온보딩(계정 구간) | 종료 / 앞 화면 | 종료 / 종료 |
| couple-invite · start-date-recheck | 스택 | 종료 / 앞 화면 | 메인 / 앞 화면 |
| date-detail · stop-edit | 스택 | 종료 / 앞 화면 | 메인 / 앞 화면 |
| settings-profile · settings-couple · settings-unlink · settings-personality · settings-result · retest · settings-privacy · settings-about · settings-withdraw | 스택 | 종료 / 앞 화면 | 메인 / 앞 화면 |
| withdraw-cancel | 스택(루트) | 종료 / 종료 | 종료 / 종료 (화면의 ← 는 로그아웃) |
| main | 탭 | 종료 / 종료 | 종료 / 종료 |
| chat · feed · magazine · settings | 탭 | 메인 / 메인 | 메인 / 메인 |

(묶음 수 31 = 위 줄의 경로를 하나씩 센 값: 1 + 8 + 3 + 2 + 2 + 9 + 1 + 1 + 4.) 덮개(경로 아님)가 열려 있을 때는 표까지 오지 않는다 - `platform/backStack.ts`의 등록 함수가 먼저 받아 그 덮개만 닫는다:

| 덮개 | 뒤로 가기 결과 | 시험 |
|---|---|---|
| 시트(`Sheet` · `ConfirmDialog` 포함) | 시트만 닫음 | `shell.vitest.tsx` · `feedFlow.vitest.tsx` · `settingsFlow.vitest.tsx` · `components.vitest.tsx` |
| 사진 크게 보기(`PhotoViewer`) | 사진 보기만 닫음 | `feedFlow.vitest.tsx` · `chat.vitest.tsx` |
| 스토리 보기(`StoryViewer` · `PhoneLayer`) | 스토리만 닫음 | `chat.vitest.tsx` |
| 서재 뷰어(`IssueViewer` · `PhoneLayer`) | 덮개째 닫음(앞 화면 · 앱 종료로 안 샘, 경로가 바뀌면 닫힘) | `magazine.vitest.tsx` |
| 화면 안 단계(재검사 · 커플 입력 · A16 -> A14) | 한 단계 앞으로, 표까지 오지 않음 | `settingsFlow.vitest.tsx` |
| 등록 함수 자체 | 가장 나중에 등록한 것부터 | `platform/backStack.vitest.ts` |

**한글 조합 이벤트 시험 목록 (74-8)** - `web/src/platform/chatComposer.vitest.tsx` **18건**(삼성형 · Gboard형 이벤트 순서를 흉내 냄):
1. `judgeResidue` - 같은 글자 = 잔여 · 뒤에 새 글자가 붙음 = 새 글자만 · 관계없음 = 새로 침
2. "ㅋㅋ" 바로 보내기 - 두 번째 ㅋ가 아직 조합 중일 때 바로 보내도 둘 다 간다 · 입력 칸은 빈다
3. "ㅋㅋ" 삼성형 - 보낸 뒤 키보드가 조합 글자를 다시 넣어도 지워진다(빈 말풍선 · 잔여 0)
4. "안녕" 보낸 뒤 0ms "ㅎ" - 삼성형 A(잔여가 다시 들어온 뒤 새 조합)
5. 같은 상황 삼성형 B(묵은 조합이 이어져 "안녕ㅎ")
6. 같은 상황 Gboard형(조합 끝이 "안녕"을 값에 확정, 곧바로 새 조합)
7. 같은 상황 Gboard형 순서 뒤바뀜(새 조합이 먼저 붙고 묵은 조합이 나중에 끝남)
8. 조합 중 엔터는 한 번만 보냄(두 번째 엔터 무시)
9. 잔여 글자만 남은 상태의 엔터는 보내지 않음
10. 공백만 있는 입력은 보내지 않음
11. 연속 세 번 보내기 - 삼성형
12. 연속 세 번 보내기 - Gboard형
13. 엔터와 버튼을 섞어도 순서가 같음
14. 조합이 이미 끝난 뒤 보냈으면 걸어 두지 않음(같은 글자를 바로 다시 쳐도 남음)
15. 보낸 뒤 조합이 아닌 입력(영문 · 붙여넣기)이 오면 묵은 조합을 버림
16. 조합 중이던 글자와 관계없는 조합 글자는 처음부터 받음
17. 보내기 버튼은 누름 시작의 기본 동작을 막아 세 번 보내도 포커스가 입력 칸에 있음
18. 보내는 동안 포커스가 빠졌으면 보낸 뒤 입력 칸으로 돌려놓음(안전망)

### Proteur가 할 일 — 커밋 명령 (메인 세션, 74-8 뒤)

묶음마다 나눠 커밋하지 않고 **두 번**으로 나눈다: 74-1~8은 같은 작업 트리에서 이어서 돌아 여러 묶음이 같은 파일(`App.tsx` · `styles.css` · `routes.ts` 등)을 고쳤으므로, 묶음별 커밋은 중간 상태를 되살릴 수 없다(빌드 안 되는 커밋이 생김). 되돌릴 지점은 ① 74-0만 ② 74-1~8 전체. 저장소 루트 PowerShell에서 한 줄씩. 지운 파일(`web/src/dev/*` 5개)도 `git add`로 지운 것이 올라간다.

커밋 1 (74-0):

```
git add scripts/ops/resetTestAccount.ts
git add scripts/ops/resetTestAccountCheck.ts
git commit -m "74-0 시험 계정 초기화 스크립트"
```

커밋 2 (74-1~8, 상태 파일 포함):

```
git add docs/74-exploration-guide.md
git add web/package.json
git add web/package-lock.json
git add web/public/fonts/MaruBuri-Regular.ttf
git add web/src/App.tsx
git add web/src/app/backRules.ts
git add web/src/app/backRules.vitest.ts
git add web/src/app/inviteEntry.ts
git add web/src/app/routes.ts
git add web/src/app/routeTable.tsx
git add web/src/app/sheets.tsx
git add web/src/app/shell.vitest.tsx
git add web/src/app/useAccountData.ts
git add web/src/app/viewerEntry.ts
git add web/src/appFlow.vitest.tsx
git add web/src/auth/client.ts
git add web/src/auth/finalize.ts
git add web/src/auth/finalize.vitest.ts
git add web/src/auth/useAccountFinalize.ts
git add web/src/auth/useBootSession.ts
git add web/src/codeInput.tsx
git add web/src/components/components.vitest.tsx
git add web/src/components/ConfirmDialog.tsx
git add web/src/components/ConnectionBanner.tsx
git add web/src/components/CoupleGate.tsx
git add web/src/components/EmptyState.tsx
git add web/src/components/PhoneLayer.tsx
git add web/src/components/PhotoViewer.tsx
git add web/src/components/Sheet.tsx
git add web/src/components/Skeleton.tsx
git add web/src/components/ToastHost.tsx
git add web/src/components/zoom.vitest.tsx
git add web/src/components/zoomMath.ts
git add web/src/config/env.ts
git add web/src/connection/chatQueueSignal.ts
git add web/src/connection/connection.vitest.tsx
git add web/src/connection/connectionMonitor.ts
git add web/src/connection/useOfflineProbe.ts
git add web/src/couple/coupleApi.ts
git add web/src/couple/useStartDateRecheck.ts
git add web/src/dev/chatFeel.vitest.tsx
git add web/src/dev/ChatTrial.tsx
git add web/src/dev/chatTrial.vitest.tsx
git add web/src/dev/chatTrialGate.ts
git add web/src/dev/fakeMessages.ts
git add web/src/features/chat/chat.vitest.tsx
git add web/src/features/chat/chatApi.ts
git add web/src/features/chat/chatData.vitest.tsx
git add web/src/features/chat/chatPhotoActions.ts
git add web/src/features/chat/chatTestSupport.ts
git add web/src/features/chat/ChatView.tsx
git add web/src/features/chat/localPreview.ts
git add web/src/features/chat/StoryViewer.tsx
git add web/src/features/chat/textQueueHub.ts
git add web/src/features/chat/useChatMessages.ts
git add web/src/features/chat/useChatQueueResume.ts
git add web/src/features/chat/useSignedMedia.ts
git add web/src/features/couple/CodeBoxes.tsx
git add web/src/features/couple/couple.vitest.tsx
git add web/src/features/couple/coupleApi.vitest.ts
git add web/src/features/couple/InviteScreen.tsx
git add web/src/features/couple/StartDateScreen.tsx
git add web/src/features/feed/DateDetailScreen.tsx
git add web/src/features/feed/exifr.d.ts
git add web/src/features/feed/feed.vitest.tsx
git add web/src/features/feed/feedData.ts
git add web/src/features/feed/feedFlow.vitest.tsx
git add web/src/features/feed/feedTestSupport.ts
git add web/src/features/feed/FeedView.tsx
git add web/src/features/feed/photoPicker.ts
git add web/src/features/feed/photoPicker.vitest.ts
git add web/src/features/feed/RecordSheet.tsx
git add web/src/features/feed/StopEditScreen.tsx
git add web/src/features/magazine/IssueViewer.tsx
git add web/src/features/magazine/libraryData.ts
git add web/src/features/magazine/LibraryView.tsx
git add web/src/features/magazine/magazine.vitest.tsx
git add web/src/features/magazine/magazineTestSupport.ts
git add web/src/features/magazine/viewerData.ts
git add web/src/features/magazine/ViewerHost.tsx
git add web/src/features/main/issueSeen.ts
git add web/src/features/main/main.vitest.tsx
git add web/src/features/main/MainView.tsx
git add web/src/features/main/useMainData.ts
git add web/src/features/settings/AboutScreen.tsx
git add web/src/features/settings/accountActions.ts
git add web/src/features/settings/appInfo.ts
git add web/src/features/settings/CoupleScreen.tsx
git add web/src/features/settings/DissolutionGrace.tsx
git add web/src/features/settings/parts.tsx
git add web/src/features/settings/PersonalityScreen.tsx
git add web/src/features/settings/PhraseConfirm.tsx
git add web/src/features/settings/PrivacyScreen.tsx
git add web/src/features/settings/ProfileScreen.tsx
git add web/src/features/settings/RetestScreen.tsx
git add web/src/features/settings/settings.vitest.tsx
git add web/src/features/settings/settingsData.ts
git add web/src/features/settings/settingsFlow.vitest.tsx
git add web/src/features/settings/SettingsResultScreen.tsx
git add web/src/features/settings/settingsTestSupport.ts
git add web/src/features/settings/SettingsView.tsx
git add web/src/features/settings/UnlinkScreen.tsx
git add web/src/features/settings/useDissolutionNotice.ts
git add web/src/features/settings/useSettingsSummary.ts
git add web/src/features/settings/WithdrawCancelScreen.tsx
git add web/src/features/settings/WithdrawScreen.tsx
git add web/src/navigation.tsx
git add web/src/photoQueue/photoQueue.vitest.tsx
git add web/src/photoQueue/photoQueueHub.ts
git add web/src/photoQueue/photoQueueStore.ts
git add web/src/photoQueue/usePhotoQueueResume.ts
git add web/src/photoQueue/webPhotoFs.ts
git add web/src/platform/bridge.ts
git add web/src/platform/chatComposer.vitest.tsx
git add web/src/platform/imageSave.ts
git add web/src/platform/imageSave.vitest.ts
git add web/src/platform/motion.ts
git add web/src/platform/useChatComposer.ts
git add web/src/platform/useKeyboardOpen.ts
git add web/src/screens.tsx
git add web/src/screens.vitest.tsx
git add web/src/stores/coupleStore.ts
git add web/src/stores/dissolutionStore.ts
git add web/src/stores/profileStore.ts
git add web/src/stores/sheetStore.ts
git add web/src/stores/stores.vitest.ts
git add web/src/stores/toastStore.ts
git add web/src/stores/viewerOpenStore.ts
git add web/src/styles.css
git add web/src/tabs/ChatTab.tsx
git add web/src/tabs/FeedTab.tsx
git add web/src/tabs/MagazineTab.tsx
git add web/src/tabs/MainTab.tsx
git add web/src/tabs/SettingsTab.tsx
git add web/src/tabs/TabBar.tsx
git add web/src/tabs/TabFrame.tsx
git add web/src/tabs/TabIcons.tsx
git add web/src/testSupport.ts
git add web/src/testSupportCouple.ts
git add .claude/state/HANDOFF.md
git add .claude/state/PROGRESS.md
git commit -m "74-1~8 로그인 뒤 앱 전체 웹 이전"
```

### Proteur가 돌릴 것 (관문이 권한 검사에 막힌 경우)

(없음)

### 결정 기록

형식 `[묶음] 무엇을 · 왜 · 다른 길`. 실기기 확인 없이 사전 허가를 쓴 줄은 앞에 `[판단]`.

- [74-h2 ⓪] 웹 A14(`ResultDetailScreen`)를 메모리가 아니라 서버 최신 검사로 그린다: 검사 읽기 -> `ensurePersonalityProfileCore` -> 만들었을 때만 `advanceOnboardingStep(RESULT)`(RN `useResultDetail` onboarding 모드와 같은 순서, 정본 함수를 웹 클라이언트로 부름) · 원인: 가입 직후 `resetSession()`이 메모리 결과를 비운 뒤 A14가 메모리만 읽고 `return null` · 서버(트리거 · RPC · 정책) 변경 0 · 출처: PE 위임문(덧붙임) + R79-1 · 다른 길: 가입 뒤 메모리를 비우지 않기(재실행 때 또 빈 화면이라 불충분)
- [74-h2 ⓪] A16 코어 고치기를 정본 `overrideEnneagramCore`로 서버에 저장(RN과 같음). 이전 웹은 메모리 오버라이드였음 · 범위가 작아 함께 맞춤 · 출처: PE 위임문(덧붙임 b) · 다른 길: 보고만
- [74-h2 ⓪] 빈 화면 0: 안내 화면(`AccountProblemView`: [다시 시도] · [로그아웃])을 세 곳에 둔다 - A14 검사 없음/읽기 오류(화면 안), 부팅 중 서버 상태 읽기 오류(앱 덮개 `AccountProblemHost`, 새 경로 없음), 그리고 화면 그리기 중 예상 못 한 오류(`RenderGuard`) · 덮개로 한 이유: 새 경로는 뒤로 가기 규칙표 · 경로표를 늘리는데 Part 9에 없는 화면 · 출처: PE 위임문(덧붙임 c) + 자체 판단 · 다른 길: 경로로 추가
- [74-h2 ⓪] 세션은 있는데 프로필 행이 없는 계정의 재실행은 첫 화면(온보딩부터)으로 보낸다(안내 화면 아님) · 답 · 동의를 받은 뒤 로그인하면 `finalizeAfterLogin`이 저장하므로 막힌 상태가 아니다 · 출처: 자체 판단 · 다른 길: 안내 화면
- [74-h2 ⓪] 알려진 빈틈(고치지 않음): `ensure`가 성공하고 `advanceOnboardingStep`만 실패하면 다음 읽기에서 `created: false`라 단계가 0에 남는다(RN 동일) - 단계 0이면 다시 결과 상세로 오고 [다음]으로 초대에 갈 수 있어 막히지 않는다 · 출처: 자체 판단 · 다른 길: 항상 호출(위임문은 "만들었을 때만")
- [74-h2 ①] 앱 링크 리스너 등록 deps를 `[bridge]`로 좁힘, `nav`는 ref. 원인: `nav`가 경로가 바뀔 때마다 새 함수(react-router `useNavigate`)라 화면을 옮길 때마다 해제 -> 재등록되고 해제가 비동기라 잠깐 두 리스너가 산다 · 출처: PE 위임문 ① b-1 · 다른 길: 모듈 변수 가드
- [74-h2 ①] 콜백 화면: 실패 화면 전에 `getSession`으로 세션 유효성 확인 -> 유효하면 정상 흐름, 실패 화면 중에도 `onAuthStateChange`로 세션이 생기면 넘어감 · 출처: PE 위임문 ① a
- [74-h2 ①] 진단 표시는 `IS_TRIAL_BUILD`(빌드 때 정해지는 상수) 뒤에만 둠. 실패 단계(링크 받음 / 코드 교환 / 계정 마무리 / 상태 읽기 / 결과 읽기) + 안전한 분류(`code`/`name`만, 메시지 0) + 접수 순번. 운영 번들에서 문자열 0 확인 · 출처: PE 위임문 ① c · 다른 길: `isDevBuild()`(번들 제거 보장 약함)
- [74-h2 ②] 연결 전 + 버튼 · 첫 기록 버튼 · 데이트 상세 [사진 더하기]는 `disabled`를 풀고 눌림이 살아 있음(흐림은 `aria-disabled`), 누르면 h1 기록 시트의 닫힘 안내(이유 + [초대하러 가기])가 열림. 문구 "연인과 연결되면 기록할 수 있어요" · 보조 문장은 지금 것 유지(보드 E13 문구를 이 세션에서 확인하지 못함) · 출처: PE 위임문 ② + R30-3 · R78-3
- [74-h2 ③] 코드 칸 조합: `inputMode="email"`(+ `type="text"`, 기존 `lang="en"` 유지). 근거: Chromium이 inputmode=email을 안드로이드 이메일 입력 형식으로 넘겨 삼성 키보드 · Gboard가 영문(@ . 키) 자판으로 여는 경우가 가장 많음, `type="email"`은 글자 수 제한 · 선택 영역 조작이 막혀 피함. 폰 확인 전 추정 · 출처: PE 위임문 ③ + R78-3(폰 확인 후 확정)
- [74-h2 ③] 키보드 시험 화면은 경로 `keyboard-test`(스택, 뒤로 = 앞 화면, 규칙표 F1에 한 줄). 운영 빌드에서는 줄 · 화면 코드가 빠지고 경로 이름 글자와 CSS 클래스 이름만 남음(그리지 않음) · 출처: PE 위임문 ③
- [74-h2 ④] `--allow-net` 범위: 사람이 ref를 적지 않도록 PowerShell에서 `([Uri]$env:ONDOLOG_SUPABASE_URL).Host`를 읽어 `--allow-net=$h`로 넣는다(스크립트 변경 없이 범위를 한 호스트로 유지) · 공개 키 판별은 `sb_publishable_` 접두어 또는 JWT `role: anon`만(키 값 출력 0 · 74-k2: legacy anon 키는 비활성화되어 JWT 판별은 쓰일 일이 없다) · 출처: PE 위임문 ④ + R78-3
- [74-h2 ⑤] 애착 칸이 빈 이유: 정본 `ATTACHMENT_REFRAME_KO.secure = null`이고 MASTER 10-5-3 표에 안정 항목이 없음 -> 웹이 표를 잘못 읽은 곳 없음(네 값 시험으로 확인), 정본 변경 0 · 출처: PE 위임문 ⑤ + R76-5
- [74-준비] 모션 명세 v2가 저장소에 없음 · 지시서가 "없는 것은 웹 데모 값으로 대신"이라 함 · 다른 길: Proteur에게 파일을 받아 다음 수정 지시서에서 대조
- [74-준비] 캔버스 HTML 4종(`Components` · `N-R31-App-Fixes` · `P1-Cover-Note` · `N-S-D3-Magazine`)이 저장소에 없음 · 해당 화면은 `screens/*.jpg`와 `CURRENT.md`의 바뀐 점 표를 기준으로 함 · 다른 길: 파일을 받아 다시 대조
- [74-0] 초기화 스크립트 시험은 루트 jest가 줍지 않는 이름으로 두고 `deno test`로 파일을 지정해 돌린다 · 루트 jest 101 · 1771이 "그대로"여야 하고 `scripts/ops`는 루트 tsc 밖, 실행 도구 Deno는 이미 `scripts/ops`가 쓰는 것 · 다른 길: jest `.test.ts`로 두면 루트 수가 바뀜
- [74-4 · 메인 세션] 사진 위치(GPS)를 읽지 않아 사진 행 lat/lng가 늘 null — RN은 읽어 `data_entries.lat/lng`에 넣음. "읽지 않는다"는 PM 지시서가 아니라 메인 세션 위임문에서 나온 조건이라 RN 행동과 다름 · 위치를 덜 모으는 쪽이 보수적이고 이 칸을 쓰는 곳이 없어(코너는 `date_stops`만) 그대로 둠, PM 확인 필요 · 다른 길: `features/feed/photoPicker.ts`의 `gps` 두 곳을 켜 RN과 같게
- [74-0] 연결된 커플 판정을 `user_b_id`가 채워진 커플 행이 하나라도 있으면(active · dissolving · dissolved 모두)으로 넓힘 · RN은 active만 connected로 보지만 해제된 행도 상대 데이터가 같은 행 아래라 지우면 상대 것까지 사라짐 · 다른 길: active만 거부
- [74-0] 발행된 호 = 그 사용자 커플 issues의 `published_at`이 있는 것 · 마이그레이션 009 · fn_publish_issue 기준 · 다른 길: 호 존재 전체
- [74-0] 지우는 순서 Storage -> 커플 행(하위 cascade) -> 인증 사용자 · couples가 profiles를 RESTRICT로 막아 커플을 먼저 지워야 하고, Storage는 행이 남아 있어야 중간에 멈춰도 다시 돌릴 수 있음 · 다른 길: 사용자부터(불가)
- [74-0] 시험 파일은 `resetTestAccountCheck.ts`, 순수 흐름과 접속을 port로 분리해 `supabaseOps` 불러오기는 실행 때만(dynamic import) · 시험이 npm 패키지 없이 돎 · 다른 길: 한 파일에 모두
- [74-0] 이메일 조회는 auth admin `listUsers`를 쪽 넘기며 메모리에서 대소문자 무시 비교 · supabase-js에 이메일 직접 조회 없음 · 다른 길: SQL(원격 스키마 조회라 배제)
- [74-1] 파일 구조: 경로 이름 = `web/src/app/routes.ts`(온보딩 · 탭 · 스택 목록) · 그리는 법 = `app/routeTable.tsx` · 뒤로 가기 = `app/backRules.ts`. 탭 화면은 `web/src/tabs/<이름>Tab.tsx`(지금 빈 틀 `TabFrame`), 탭 위 스택 화면은 `web/src/features/<영역>/`(폴더는 첫 화면이 생길 때 만든다 - `screens.tsx` 파일과 이름이 겹치지 않게 `screens/`는 안 씀), 시트는 `stores/sheetStore.ts`의 `SheetId` + `app/sheets.tsx`, 공용 부품은 `components/`, 저장소는 `stores/`, 연결 상태는 `connection/`. **새 화면을 더할 때 할 일: `routes.ts`에 이름 -> `routeTable.tsx`에 그리는 법 -> `backRules.ts`에 규칙 -> 이 표의 화면 대응표 한 줄**(셋 중 하나라도 빠지면 tsc와 `backRules.vitest.ts`가 실패).
- [74-1] 뒤로 가기 규칙표를 새로 `app/backRules.ts`로 쓰고(`resolveBack` 순수 함수) `navigation.tsx`가 그것을 부른다. `platform/backStack.ts`(시트 · 뷰어 등록)는 그대로 - 열린 시트가 표보다 먼저 받는다 · 다른 길: backStack 확장(등록 함수와 규칙이 섞여 시험이 어려움)
- [74-1] 탭 규칙: 메인 = 종료, 다른 탭 = 메인으로(`replace`). RN `(tabs)/_layout.tsx`에 backBehavior 지정이 없어 React Navigation 기본 `firstRoute`와 같아 RN을 따른 것. 탭끼리는 `replace`라 깊이가 늘지 않는다.
- [74-1] 계정이 생긴 뒤(`enterAccount`)에는 "온보딩 경로면 종료"로 바꿨다(전에는 계정 뒤 모든 뒤로 가기가 종료). 이후 스택 화면은 `previous`로 탭에 돌아온다. 앞 화면이 없는 스택 · 알 수 없는 경로는 계정이면 메인, 아니면 종료(아무 동작 없는 화면 0).
- [74-1] `Nav` 타입은 `navigation.tsx`로 옮기고 `screens.tsx`가 다시 내보낸다(`ScreenName`은 `app/routes.ts`). 온보딩 화면 동작은 그대로, `LegalSheet`(A12)만 공용 `Sheet` 부품으로 갈아 끼움(열기/닫기 연출 · 뒤로 가기 동작 동일, 바깥 면 색을 `rgba(10,8,20,.66)`으로 - 보드 I05 값).
- [74-1] 지움: `EndScreen` · `/end` · `web/src/dev/*`(채팅 시험 + 한글 조합 시험 `chatFeel.vitest.tsx`) · 첫 화면 "채팅 시험" 버튼. `useChatComposer.ts` · `useStickToEnd.ts` · `build:trial`은 그대로. 한글 조합 시험은 74-5가 입력 이벤트 방식으로 다시 쓴다. 개발용 안내(`AuthScreen`의 설정 비었음)는 `config/env.ts`의 `isDevBuild()`로 이어짐.
- [74-1] 서버 진행 단계 2 이상 -> `main`(`webRouteForStep`). **자리 남김(해당 화면이 생기면 채운다)**: 커플 연결 + 사귄 날짜 없음 -> 사귄 날짜(74-2) · 닉네임 미설정(74-2) · 탈퇴 유예 `deleted_at`(74-7, 값은 `stores/profileStore`가 이미 읽음). "나중에 할게요" · "솔로예요"(`InviteScreen`)는 지금 `enterAccount('main')`만 한다 - RN의 `completeOnboardingWithoutCouple`(진행 단계 COMPLETE 저장)은 74-2가 채움(그 전에는 앱을 다시 켜면 단계 1이라 초대 화면으로 돌아옴).
- [74-1] I01: 탭 화면은 화면 안 카드(`CoupleNeeded`, 손잡이 없음), 시트(`couple-gate`)는 `useCoupleAction()`으로 사용자가 커플 기능을 누를 때만 **한 번**(시트 한 칸 `sheetStore.open`이 열려 있으면 무시, 경로가 바뀌면 `closeAll`). 두 버튼은 `app/inviteEntry.ts`의 `openInvite('intro'|'enter')` - **74-2가 `setInviteEntry`로 실제 이동을 꽂는다**(그 전에는 토스트 "초대 화면은 곧 열려요"). 보드 I01/I05는 저장소의 PNG만 있어(`N-S-H4-Settings` · `N-S-I-States` HTML 없음) PNG + RN 구현 값으로 만듦.
- [74-1] 탭 바: 보드 `tab_icons.md` 경로 원문(RN 경로는 보드와 달라 보드를 따름), 18px · 선 1.6, 활성 = rose + 글로우 · 글자 text 600, 점 없음. 바탕은 보드의 `rgba(10,8,20,.92)` 대신 `#0A0814` 단색(B5 지시). 탭 바 12px 띄움 · 높이 64 · 반경 22.
- [74-1] 연출 값: 화면 전환 `rise` 260ms ease-out(웹 데모) · 탭 이동 크로스페이드 180ms(`tabIn`) · 시트 열기 380ms `cubic-bezier(.2,.9,.25,1)` / 닫기 260ms(웹 데모 값) · 토스트 떠오름 220ms. 모션 명세 v2는 저장소에 없고 `02_X1-Motion-Main.jpg`는 메인 화면(74-3) 전용 연출이라 여기엔 쓰지 않음. `prefers-reduced-motion`이면 새 부품 연출은 즉시.
- [74-1] I02 연결 상태: `navigator.onLine` · 이벤트 + 확인 요청으로 된다 -> `@capacitor/network` **설치 0**. 끊김 = 감싼 fetch 거부(RN과 같음) + 브라우저 `offline` 이벤트, 풀기 = 확인 요청 응답만(`online`은 증거가 아님). 확인 요청 규칙은 RN 그대로(15초 간격 · 8초 제한 · 헤더 0 · 정리 때 abort · 겹침 0). 웹에서 바꾼 것: AppState `active` 대신 `visibilitychange`(보임), `online` 이벤트는 15초 간격을 기다리지 않고 한 번 시도. `auth/client.ts`의 `createWebClient`가 감싼 fetch와 확인 요청을 등록. 채팅 자리 규칙은 `connection/chatQueueSignal.ts`(`setChatQueueWaiting`) - **74-5가 글 · 사진 큐의 대기 유무를 여기에 알린다**.
- [74-1] 저장소: 세션 = 기존 `auth/stores.ts`의 `useAuthStore`(앱 시작 때 `useBootSession`이 채움), 내 프로필 = `stores/profileStore.ts`(`fetchProfile` 재사용, RN의 생체정보 · 대표사진 부분은 범위 밖이라 안 옮김), 커플 = `stores/coupleStore.ts`(RN `coupleStore.refresh`와 같은 질의 + 미연결 36.5 고정 + 저장 온도는 읽기만). 계정 구간에 들어오면 `app/useAccountData.ts`가 두 곳을 읽고 로그인이 사라지면 비운다. 조회 오류 시 이미 연결로 알던 값은 지우지 않는다(RN은 미연결로 덮음) - 다른 길: RN 그대로.
- [74-1] 토스트(`stores/toastStore.ts` + `ToastHost`) 한 번에 하나, 3초. 새 의존성 0 · `web/android` 변경 0 · 루트 · RN 변경 0.
- [74-2] 파일: `couple/coupleApi.ts`(RN `coupleApi`의 웹판 - 클라이언트를 인자로 받음. 연결은 `@/services/coupleConnectCore`의 `connectCouple`, 진행 단계는 `@/services/onboardingStepCore`의 `advanceOnboardingStep`을 그대로 가져다 씀) · `couple/useStartDateRecheck.ts` · `features/couple/{InviteScreen,CodeBoxes,StartDateScreen}.tsx`. 시험 보조 `testSupportCouple.ts`(상태 있는 가짜 클라이언트). 새 경로: `start-date`(온보딩) · `couple-invite` · `start-date-recheck`(스택, 뒤로 = 앞 화면). 새 의존성 0 · `web/android` 변경 0 · 서버 새 RPC 0.
- [74-2] A17 코드는 서버 코드다: 화면 무작위 코드를 지웠다. RN대로 **열기만 해서는 커플 행을 만들지 않고**(읽기만) [초대 코드 만들기]를 눌러야 발급한다. 단 I01에서 `couple-invite`를 [초대 코드 보내기]로 열었을 때는 이미 요청한 것이라 바로 발급(B12 - RN `InviteSheet`가 같은 문구 시트를 한 번 더 열던 것을 없앰). 보드 A17의 [복사하기]는 RN이 클립보드 의존성 때문에 뺐지만 웹은 `navigator.clipboard`가 되어 보드대로 둠(실패하면 코드를 토스트로). 4초마다 읽어 상대가 입력했는지 확인(RN 그대로), 연결되면 한 번만 A19로.
- [74-2] 공유 글: `bridge.shareText`(`@capacitor/share`의 `text`, 기존 플러그인) 추가 - 문구 "온도록에서 연결해요! 초대 코드: CODE"(B6). 웹 개발 서버는 `navigator.share`, 못 열면 코드를 토스트로 보여 줌. 브랜드 오기: `web/src`에 옛 이름("온돌로그" 등)은 남아 있지 않다(시험이 공유 문구에 `온돌로그|온도로그|ONDOLOG` 0 단언).
- [74-2] 코드 입력(A18, B9): 보드의 6칸 모양을 투명한 `<input>` 하나가 덮는 방식(`CodeBoxes`). `autocapitalize=characters` · `autocorrect=off` · 입력은 `normalizeCodeInput`(대문자 + 영숫자 6자리). 키보드가 칸을 가리지 않는 것은 기존 `platform/keyboardFocus`(창이 키보드만큼 줄고 칸을 가운데로 스크롤)에 기댐 - 실기기 확인 항목.
- [74-2] I01 -> 초대: Shell이 `setInviteEntry`를 꽂아 탭 위에 스택 `couple-invite`를 쌓는다(`openInvite`가 단계 `intro`/`enter`를 `setPendingInviteStep`으로 적어 두고 화면이 그려질 때 한 번 읽음). 온보딩의 `invite` 경로를 탭 위에 쌓으면 규칙표(계정 있으면 온보딩 뒤로 = 종료) 때문에 못 돌아오므로 별도 스택 경로를 만듦(RN은 `couple-gate` 모달). gate에서 연결되면 진행 단계는 건드리지 않고 사귄 날짜로(RN `couple-gate`와 같음). 이미 그 화면이면 다시 쌓지 않음.
- [74-2] "나중에 할게요" · "솔로예요": RN 그대로 둘 다 `completeOnboardingWithoutCouple`(진행 단계 3, 올리기만) 뒤 메인 - **커플 행은 만들지 않는다**(열린 항목 "U2 혼자 기록의 커플 행"은 RN 동작 그대로라 PM 결정 대기 상태 유지, 74-4가 기록 버튼 비활성을 만질 때 이 점을 안다). 다시 켜면 단계 3이라 메인으로 가고 초대로 돌아오지 않는다(시험).
- [74-2] 단계 판정: `webRouteForStep(step, ctx)`(순수, RN `resumePathFor`) + `resolveWebRoute(db, userId, step)`(단계 2일 때만 active 커플을 읽어 `connectedWithoutStartDate`를 채움. 조회 실패는 RN `coupleStore.refresh`처럼 미연결 -> 메인). `useBootSession` · `useAccountFinalize`가 이것을 부름. RN은 단계 3에서도 커플 스토어를 새로 읽지만 갈리는 결과가 없어 읽지 않음(웹은 `useAccountData`가 계정 구간 진입 때 읽음). **닉네임 미설정 -> 별도 화면은 만들지 않음**: RN에도 그런 판정이 없고 닉네임은 A19에서 날짜와 함께 정한다(74-1 주석의 "닉네임 미설정(74-2)"은 이 뜻으로 닫음). 탈퇴 유예(`deleted_at`)는 `resolveWebRoute` 주석에 자리 표시(74-7: RN은 유예면 단계보다 먼저 탈퇴 취소 화면).
- [74-2] 사귄 날짜(A19/A20): 규칙은 RN 그대로(`setOrConfirmStartDate` 먼저 입력한 값 적용, 닉네임은 날짜를 정한 쪽만 씀, 미래 불가 KST). 입력은 "YYYY.MM.DD" 숫자 입력(피커 0, RN 동일). 마무리 = 단계 3 -> `enterAccount('main')`. 재표시(`useStartDateRecheck`): Shell이 탭 화면에서만 켜고(시작 · 탭 진입 · `visibilitychange` visible), 같은 (커플, 정한 사람, 날짜)는 한 번만 열고, `start-date-recheck`로 푸시(`urgent`). 이 길은 확인만 쓰고 단계는 안 쓰며, 끝나면 `reset('main')`(RN `dismissTo('/main')`). 확인 · 저장 뒤 `coupleStore.refresh`로 메인이 바로 새 값을 봄.
- [74-2] F3: 기존 계정 알림 문구는 **바꾸지 않았다**(R65-2 원문 그대로). 문구가 끝 화면을 가리키지 않고("원래 정보로 이어서 보여 드려요. 방금 본 결과는 저장하지 않았어요."), 이제 단계 2 이상 계정은 메인 탭에 내리며 알림이 그 위에 한 번 뜨므로 사실에 맞다. 방금 본 결과가 있었을 때만 보이는 조건 · 6초 자동 닫힘 · 눌러 닫기는 그대로. 시험이 원문 · 메인 위 한 번 · 결과가 없었으면 알림 0 · `/end` 없음을 지킴. 다른 길: 문구를 줄이기(사실이 같아 이득 없음).
- [74-2] R74-10: "전체 동의" 줄 안(`ConsentRow`의 `helper`)에 "선택 항목인 마케팅 정보 수신도 함께 동의돼요."를 고정 노출(누르기 전부터, 눌러도 유지). 옛 후보 문구("...함께 켜져요") 삭제, `ALL_CONSENT_NOTE`를 export해 시험이 정확한 글자와 줄 위치(전체 동의 줄 바로 아래, 다음은 구분선)를 단언. 마케팅 기본 꺼짐(B18)은 `screens.vitest.tsx`가 계속 단언.
- [74-2] A09: 보드 `screens_index.csv`의 A09는 "공유 카드 이미지 · 1080x1920"(화면 틀이 아니라 만들어지는 **이미지**)이고 A08 [공유하기]가 그 이미지를 OS 공유 시트로 보내는 것으로 이미 대체됨(`share/resultCard.ts`). 전체 화면 `ShareCardScreen` · 경로 `share` · 하늘 `share` 설정 · 뒤로 가기 규칙은 어디서도 열리지 않아 **지움**(경로 목록 · 규칙표 · 라우터 표 · 시험 표에서 함께). 다른 길: 되살리기(보드 흐름에 A09를 여는 버튼이 없음).
- [74-3] 파일: `features/main/{MainView,useMainData,issueSeen}` + `tabs/MainTab.tsx`(훅 결과를 `MainView`에 넘기고 버튼 목적지만 정함). 순수 규칙은 루트 `@/utils/mainScreen` · `relationshipDays` · `magazine` · `@/services/mainApi` · `magazineApi`(클라이언트 인자)를 그대로 가져다 씀(사본 0). 새 의존성 0 · `web/android` 변경 0 · 서버 새 RPC 0 · 새 경로 0(규칙표 변경 없음 - 뷰어는 74-6이 경로를 만들 때 `viewerEntry`에 꽂는다).
- [74-3] 버튼 목적지: 채팅 링크 = `nav.replace('chat')` · [연인 초대하기] = `openInvite('intro')`(RN은 `couple-gate` 모달, 웹은 74-2의 `couple-invite`; I01 시트를 한 번 더 거치지 않음 - B12와 같은 원칙) · [읽기] · 지난 호 = `app/viewerEntry.ts`의 `openIssueViewer`. 뷰어(74-6)가 `setViewerEntry`로 실제 이동을 꽂고 **호를 열 때 `features/main/issueSeen.markIssueOpened(userId, issueId)`를 불러야** B06 카드가 사라진다. 꽂기 전에는 토스트 "매거진 뷰어는 곧 열려요". 다음 호 카드는 누르는 곳이 없다(D02 범위 밖).
- [74-3] 안 열어 본 새 호: RN AsyncStorage -> Capacitor Preferences(키 `ondolog.issueOpened.<user>.<issue>` 그대로, 서버 쓰기 0, 실패는 조용히). 로그인 이후 구간이라 영속 저장이 허용되는 편의 표시.
- [74-3] 하늘: `App.tsx skyFor('main')` = offset `viewOffsetPt.main` · 장막 .42 · 하단 장막 · 유성 0 · 이동 1200ms(첫 로그인 직후 인트로 하늘에서 내려옴). 메인 화면 바탕만 투명(`.mainTab`), 다른 탭은 단색 그대로라 B5 흰 프레임 보호 유지(하늘은 불투명도 0 -> 1로만 켜지고 phone 바탕이 `--ink`). 하늘 흐름(40초 24px) · 유성 · 손잡이 숨쉬기는 끌어내리기(C) 쪽 연출이라 넣지 않음 - 다른 길: 24px 흘러가는 연출만 따로 넣기(`SkyLayer`의 이미지 transform 위에 래퍼가 필요해 74-8에서).
- [74-3] 모션: 보드 02_X1-Motion-Main 값 - 등장 ease `cubic-bezier(.2,.8,.2,1)` 720ms, 칸 사이 80ms 간격, 위로 16px에서 떠오름(카운트업 · 블러 0). `prefers-reduced-motion`이면 즉시.
- [74-3] 깜빡임 0: 연결 여부(`unknown`/`loading`) · 활동 · 프로파일 · 호 목록 · "열어 봄"이 **이번 호 목록 기준으로** 다 읽히기 전에는 I03 뼈대(`MainFacts.openedFor === 호 id 키`). 다시 읽을 때(`visibilitychange`)는 값을 비우지 않는다. 미연결(B05)은 연결 전용 조회를 하지 않으므로 뼈대 없이 바로. 조회 오류 처리는 RN 그대로(활동 읽기 실패 = 저장값 유무, 프로파일 읽기 실패 = 완료로 봄, 호 오류 = 호 칸 숨김).
- [74-3] 온도: 계산 0 - `coupleStore`가 읽은 `daily_temperature` 최신 저장값만. 미연결 · 프로파일 미완 = 36.5 고정(`dim`, 발광 없음), 저장값 없음 = B03 문구. patch8의 B01 "시작 온도 보조 문구"(온도가 잘 맞는 유형일수록 시작 온도가 조금 높아요 ...)는 RN 메인에도 없고 74 지시서에 자리가 없어 넣지 않음 - 다른 길: 이 문구를 어느 상태에 둘지 정해 주면 추가.
- [74-3] 자정 경계: 메인이 떠 있는 동안 1분마다 시각을 새로 잡아 날짜 라벨 · D+N이 바뀜(RN은 렌더 때만).
- [74-4] 파일: `features/feed/{feedData(읽기 훅 · 피드 재읽기 신호) · FeedView(E01 · E13 그리기) · DateDetailScreen(E03) · StopEditScreen(E15) · RecordSheet(E11) · photoPicker(웹 입력 + EXIF)}` + `tabs/FeedTab.tsx` + 공용 `components/{PhotoViewer · zoomMath}` + `photoQueue/*`. 서버 조회 · 쓰기는 루트 `@/services/dateRecordApi`(클라이언트를 인자로 받는 순수 파일)를 그대로 가져다 쓴다 - 새 RPC · 테이블 · 정책 0, 사본 0. 새 경로 `date-detail` · `stop-edit`(스택) · 새 시트 `record`.
- [74-4] 화면에 값을 싣는 길: `nav.push(name, { params })`가 `?key=value`를 붙이고 화면은 `useRouteParams()`로 읽는다(`navigation.tsx`). 주소에 실려 있어 뒤로 갔다 돌아와도 같은 데이트가 열린다(RN `useLocalSearchParams`와 같은 성격). 경로 판정(`routeOfPathname`)은 pathname만 보므로 규칙표 · 라우터 표는 그대로 이름 키. 다른 길: 메모리 저장소에 마지막 값을 두는 `inviteEntry` 방식(E03 -> E15 -> 뒤로 때 덮어써질 수 있어 안 씀).
- [74-4] 사진 고르기 = 웹 입력(`<input type="file" accept="image/*" multiple>`, 한 번에 30장). `@capacitor/camera` 설치 0 · `web/android` 변경 0. 웹뷰의 파일 선택기가 원본 바이트 · 촬영 시각(EXIF)을 그대로 주는지는 실기기에서 확인한다 - **[판단]** 웹 입력만으로 두고 실기기에서 EXIF가 비거나 원본이 줄어 오면 그때 `@capacitor/camera`(이미 사전 허가)로 바꾼다(사진 선택기 한 함수 `chooseFiles`만 갈아 끼우면 된다). 취소 이벤트(`cancel`)를 안 주는 웹뷰에서는 선택기가 닫혀도 대기 중 약속이 남을 수 있으나 화면은 기다리지 않는다.
- [74-4] EXIF 라이브러리 = `exifr@7.1.3`(정확한 버전, `--save-exact`, package.json 한 줄 + lock 7줄), **lite 묶음**(JPEG · HEIC만, 가장 작은 쪽 아래 - mini는 HEIC가 없어 삼성 고효율 사진을 놓침). 이유: 파일(`File`)을 그대로 받아 앞부분만 읽고, 사진 선택기가 주는 JPEG · HEIC에서 촬영 시각을 읽는다. 다른 길: `@capacitor/camera`의 EXIF(웹 입력이 안 될 때만). 알아 둘 것 둘(시험으로 고정): ① 옵션 `tiff: true`를 주면 라이브러리가 모든 IFD(위치 포함)를 켜 버린다 - 블록마다(`ifd0` · `exif`는 태그 목록, `gps: false`)만 정한다. ② 태그를 **번호**로 고른다(0x9004는 이름이 `CreateDate`, 0x0132는 `ModifyDate`라 이름 표기에 기대지 않는다). 읽은 값은 우리 이름의 작은 객체로 돌려주고, 시각은 글자 그대로(`reviveValues: false`) 루트 `photoFromPickerAsset`(KST 기본 · `OffsetTimeOriginal` 우선 · 읽을 수 없으면 null)에 넘긴다. 파일 수정 시각은 촬영 시각으로 쓰지 않는다(RN과 같음).
- [74-4] **GPS: 읽지도 보내지도 않는다**(지시). RN은 `exif: true`로 위치도 받아 `data_entries.lat/lng`에 넣었다(56- 지시서) - 지시가 "RN을 확인해 같은 쪽으로"라고도 해서 어긋난다: RN을 따르면 읽는 것이다. **지시의 명시 문장("읽지도 보내지도 않는다")을 따랐다** - 사진 행의 `lat` · `lng`는 늘 null. 근거: 사진의 `lat/lng`는 조판 · 생성 어디에서도 쓰이지 않는다(코너 입력은 `date_stops.lat/lng`만 읽는다 - `_shared/corners/dateArchive.ts` · `inputAssembly.ts`). 시험이 위치가 든 JPEG에서도 null · 읽은 태그에 위치 이름 0을 단언한다. PM이 RN대로 읽기를 원하면 `photoFromFile`의 `exif` 객체에 GPS 칸 네 개와 `readExifTags`의 `gps`만 켜면 된다(루트 `exifGps`가 이미 있다).
- [74-4] E10을 없앴다(CURRENT.md): E03 [사진 더하기]가 바로 시스템 선택기를 열어 고른 사진을 곧바로 올린다. 호출은 RN E10과 같은 `recordDate`(날짜 고정 · 장소 · 메모 없음 -> 그 날짜에 stop이 있으면 사진은 규칙 4로 배치, 없는데 촬영 시각도 없으면 R30-2 문구를 토스트로 알리고 아무것도 쓰지 않는다). 확인 단계(올리기 전 미리보기)는 없다 - 다른 길: 선택 뒤 미리보기 시트(E10 비슷한 화면이 되므로 안 만듦).
- [74-4] **E11 시간 칸(해석 - PM 확인 요청)**: CURRENT.md "시간 칸이 조건부(stop 없음 + 촬영 시각 전무일 때만), 안내 문구 2종"을 이렇게 읽었다. 시간 칸은 `이름 있는 장소 0 && 사진 있음 && 사진에 촬영 시각 0`일 때만 보이고("시간 · 장소와 도착 시각이 필요해요", 누르면 장소 칸이 열림), 그 밖에는 시각이 사진 · 장소에서 정해지므로 칸이 없다(RN은 항상 사진 시각 폭을 보였다). 안내 문구 2종 = 사진 아래 "사진의 촬영 시각으로 날짜를 먼저 채웠어요" / "촬영 시각이 없어 오늘 날짜로 채웠어요"(RN에 있던 것). 이름 없는 stop의 도착 시각을 **직접 입력**하는 칸으로 만들지 않은 이유: 루트 `planStops` · `recordDate`가 이름 없는 stop의 시각 입력을 받지 않는다(루트 수정 금지) - 시각을 정하려면 장소 이름 + 도착 시각을 쓴다(RN 그대로). 디자인이 입력 칸을 뜻했다면 루트 `recordDate`/`planStops`에 "이름 없는 stop의 도착 시각" 입력이 필요하다(PM 판정 후).
- [74-4] E11은 RN처럼 모달이므로 앱 시트(`record`, 전체 높이)로 만들었다(`SheetId`에 더하고 `app/sheets.tsx`에 본문). 시트는 한 번에 하나 · 탭을 옮기면 닫힘 · 뒤로 가기는 시트만 닫음(74-1 규칙). 저장하면 `useFeedSignal.bump()`로 열려 있는 피드 · 상세가 다시 읽는다. 올리는 중에 시트가 닫히면 미리보기 주소는 올리기가 끝난 뒤 놓는다.
- [74-4] E03 `⋯`: 내가 올린 사진(오른쪽 위) · 메모(오른쪽)에만 44px 누름 영역의 `⋯`가 있고, 누르면 아래에서 올라오는 확인 시트(제목 "이 사진을 지울까요?" / "이 메모를 지울까요?" + "지운 사진은 되돌릴 수 없어요. 이미 발행된 호에서는 지워지지 않아요." + [지우기] rose 선 · [취소])가 열린다. RN은 "지우기" 글자 칩 + I05 가운데 카드였다 - CURRENT.md의 "확인 시트"를 따랐다. 서버는 RN과 같은 RPC `fn_delete_own_entry`만(직접 update 0), 확인 전 호출 0. 지운 뒤 화면 · 피드를 다시 읽는다.
- [74-4] **사진 영속 큐 = 채팅(사진 메시지 · 24시간 스토리)이 쓰는 큐**다(RN `chatQueueHub` · `photoQueueFs` · `photoQueueStore`). RN의 데이트 기록(E11)은 큐를 쓰지 않으므로 웹도 쓰지 않는다. 74-4는 큐의 **웹 기반**을 만들었고 채팅 화면(74-5)이 붙는다: `photoQueue/photoQueueHub.ts`의 `photoQueueHub`(`attach` · `detach` · `kick` · `subscribe({onMessage, onStory, onPhotoQueue, onPhotoLost})` · `enqueue(photo, kind)` · `getPhotoQueue()`가 러너 `add/retryNow/cancel`을 줌). 규칙 파일은 루트 것을 그대로 가져다 쓴다(`@/utils/chatPhotoQueueRunner`(백오프 2s->32s · 5회 · 영구 실패 즉시 멈춤 · 같은 항목 겹침 0) · `@/services/chatPhotoCore`(경로 = `clientId`에서 정해짐 · 409 = 성공 · `client_msg_id` 23505 = 이미 전송 · 스토리는 같은 경로 행이 있으면 안 넣음) · `@/utils/chatPhotoQueue`). **74-5가 할 일**: 글 큐는 74-5가 같은 방식으로 옆에 둔다. 채팅 화면은 `photoQueueHub.subscribe`로 확정 행 · 큐 변화를 받고 `enqueue`로 사진을 넣는다(`blob:` 주소 + 확장자 + mime). 큐 대기 유무를 `connection/chatQueueSignal.setChatQueueWaiting`에 알리는 일도 74-5 몫.
- [74-4] 큐 저장소 선택(보수적): 파일 복사본 = `@capacitor/filesystem`의 `Directory.Data`(앱 데이터 폴더 실제 파일 - RN `Paths.document`와 같은 성격, 시스템 정리 · 웹뷰 저장소 비움에 휩쓸리지 않음), 큐 항목 목록 = `@capacitor/preferences`(이미 로그인 세션이 쓰는 곳, 키 `chat_photo_queue:{coupleId}:{userId}` RN과 같음). 다른 길: IndexedDB(Blob을 그대로 저장해 base64 부풀림이 없으나 웹뷰 저장소라 정리 대상이 될 수 있어 안 씀). 대가: 네이티브에서 Filesystem은 base64로 쓰므로 큰 사진은 일시적으로 메모리를 더 쓴다 - 실기기에서 12MP 사진 여러 장을 한꺼번에 넣어 볼 항목(탐방 안내에 추가). 큐는 로그인 이후 구간이라 영속 저장이 허용된다(온보딩 비로그인 구간 규칙과 무관).
- [74-4] 큐 재개 시점(65-): `photoQueue/usePhotoQueueResume`을 Shell에 한 번(`App.tsx`) - 앱 시작(로그인 + 커플 연결 확인 직후 `resolveChatQueueTarget`) 허브에 붙여 저장된 항목을 이어서 보내고, 앱이 다시 보일 때(`visibilitychange` = RN AppState `active`) 바로 이어 보낸다. 로그아웃 · 미연결이면 타이머만 멈추고 **기기 저장은 지우지 않는다**(다음 로그인에 이어 감). 커플 확인이 다시 도는 중(`loading`)에는 큐를 끊지 않는다. 같은 (커플, 사용자)로 `attach`를 여러 번 불러도 큐는 하나(동시 업로드 0).
- [74-4] 사진 크게 보기: `components/PhotoViewer.tsx`(+ 한 장 면 `ZoomableImage`, 계산은 `zoomMath.ts` 순수 함수) - 핀치(1~4배) · 두 번 누르기(2.5배 <-> 처음) · 끌기(면 밖으로 안 나감) · 배율 1에서 옆으로 밀어 앞뒤 사진. 포인터 이벤트 직접 구현, 라이브러리 0. 열려 있는 동안 하드웨어 뒤로 가기는 이것만 닫는다(`useBackHandler`). 사진 목록이 줄어도 없는 칸을 가리키지 않는다. 74-6 서재 뷰어가 `ZoomableImage`(한 장 면)를 가져다 쓰면 된다. 터치로만 만들어 실기기 확인 항목: 핀치 · 두 번 누르기 · 옆으로 넘기기 손맛.
- [74-4] 세리프: 두 사람의 원문(메모 · 인용)은 보드 토큰대로 MaruBuri. 웹에는 이 글꼴이 없어 `assets/fonts/MaruBuri-Regular.ttf`를 `web/public/fonts/`로 **복사**했다(3.3MB, 새 의존성 아님 · RN 파일 변경 0, `font-display: swap`). 다른 길: 시스템 세리프(`serif`)만 쓰기(안드로이드 한글 세리프 보장이 없어 디자인과 달라짐). APK가 3.3MB 커지는 것이 부담이면 이 파일 한 개와 `styles.css`의 `@font-face` 한 줄을 빼면 `serif`로 내려간다(PM 판단).
- [74-4] 피드 재읽기: 마운트 · `visibilitychange` · 기록 · 삭제 · 장소 수정 뒤(`useFeedSignal`)에 다시 읽고, 다시 읽는 동안 이미 받은 값은 지우지 않는다. 피드 맨 위 안전 영역은 `.feedTab::before`로 덮어(B10) 스크롤한 내용이 상태 표시줄 아래로 비치지 않게 했다. 월 바로 가기(오른쪽 숫자)는 둘 이상의 달일 때만, 누르면 그 달로 부드럽게 스크롤.
- [74-4] 혼자 기록의 커플 행(열린 항목): RN 그대로 - 기록할 커플 행(pending · active)이 없으면 + 버튼 · "첫 기록 남기기"가 비활성이고 E13 배너가 이유를 적는다. 커플 행을 만들지 않는다(시험이 `couples` 쓰기 0을 단언). 74-2의 "나중에 · 솔로예요"가 행을 안 만들므로 그 사용자는 초대 코드를 만들기 전에는 기록할 수 없다 - PM 결정 대기 상태 그대로(열린 항목 "U2 혼자 기록의 커플 행").
- [74-4] 새 의존성 `exifr@7.1.3` 하나. `web/android` 변경 0(`cap sync` 변경 없음) · RN · 루트 변경 0 · 서버 새 RPC · 마이그레이션 0.
- [74-5] 한글 조합: `useChatComposer`의 300ms 시간 가드를 **지우고** 입력 이벤트(`compositionstart/update/end` · `beforeinput`/`input`의 `inputType`)로 구분. 보낸 문자열은 입력 칸(DOM) 값에서 읽고, 조합 중에 보냈을 때만 그 조합 글자를 "묵은 조합"(`stale`)으로 적어 같은 글자의 재입력(`insertCompositionText`)은 지우고, 묵은 글자 뒤에 새 글자가 붙으면 새 글자만 남기고, `compositionend` 확정 글자(값 끝 또는 앞)도 지운다. 관계없는 조합 글자 · `insertText` · 지우기는 사용자 입력으로 보고 묵은 조합을 버린다. 잔여만 든 칸의 엔터는 보내지 않는다. **실기기 확인(삼성 키보드 · Gboard)은 탐방 안내 몫** - 키보드 앱이 실제로 이 이벤트 순서로 주는지는 jsdom으로 증명 못 함. 다른 길: 시간 가드(R73-2가 지움).
- [74-5] 파일: `features/chat/{ChatView · useChatMessages · chatApi · textQueueHub · useChatQueueResume · useSignedMedia · localPreview · StoryViewer · chatPhotoActions}` + `platform/useKeyboardOpen` + `components/PhoneLayer`. 전송 · 사진 · 서명은 루트 `@/services/chatCore` · `chatPhotoCore`와 `@/utils/*`를 그대로 씀(사본 0). 글 큐는 `textQueueHub`(RN `chatQueueHub`의 글 쪽, Preferences 키 `chat_queue:{coupleId}` RN과 같음)로 사진 허브 옆에. 새 경로 0 · 새 의존성 0 · 서버 새 RPC 0.
- [74-5] 스토리 · 사진 크게 보기 · 첨부 · 복사 메뉴는 경로가 아니라 `PhoneLayer`(폰 틀에 붙는 포털)로 탭 바 위에 그린다 - 탭 화면이 자기 쌓임 맥락이라 안에서 그리면 탭 바에 가려짐. 뒤로 가기는 `useBackHandler`(열린 것 하나만 닫음). 다른 길: 경로 + 규칙표(RN 모달과 비슷하나 탭 위 스택이라 채팅 상태가 사라짐).
- [74-5] **[판단] F04 [카메라]**: 웹 입력 `capture="environment"`(한 장)로 연다. Capacitor 안드로이드 웹뷰가 이를 카메라 인텐트로 처리하고 앱 매니페스트에 카메라 권한이 없어도 동작해야 하나 **실기기에서 확인 못 함**. 안 열리면 `ChatView.tsx`의 `CHAT_CAMERA_ENABLED`를 false로(버튼 사라짐, 비워 둠). `@capacitor/camera` 설치 0. "최근 사진" 격자는 만들지 않음(사진 라이브러리를 훑지 않는다 R13-2 - 웹 입력으로는 불가능).
- [74-5] F06 [저장] · [공유]: 다리의 `saveImage` · `shareImage` 사용. 파일 이름은 `ondolog-chat-날짜-시각-밀리초.확장자`로 매번 다름. 갤러리 노출 · 재설치 뒤 성공(F2)은 74-8이 `saveChatPhoto` 한 곳을 바꿔 끼움. 실패는 토스트(원인 · 경로 로그 0).
- [74-5] 말풍선 복사: "RN 동작을 따른다"를 이렇게 읽음 - RN 말풍선은 길게 누르면 보내는 중 · 실패 글만 전송 취소, 보낸 글에는 동작 없음. 웹은 PM이 1b에서 남긴 "앱이 직접 그리는 메뉴" 줄(가)을 더해 **보낸 글을 길게 누르면 [복사] 시트**(클립보드), 보내는 중 · 실패는 RN대로 취소. 글자 선택 · 시스템 메뉴는 여전히 0. 다른 길: 복사 메뉴 없이 RN과 완전히 같게(PM 확인).
- [74-5] 미연결 F02: 시트가 아니라 화면 안 카드(`CoupleNeeded`에 `copy` 인자 추가, 문구 "상대만 있으면 돼요 / 채팅은 연인과 연결되면 열려요."). 둘째 문장은 RN처럼 뺌(디자인에 알릴 것 - 열린 항목 ③은 그대로).
- [74-5] 키보드: 채팅에서 키보드가 열리면(글자 칸 포커스 + 창 높이 120px 넘게 줄어듦, `useKeyboardOpen`) 탭 바를 비키고 입력줄 아래 여백을 12로 줄임(RN `keyboardVisible`). 실기기 확인 항목.
- [74-5] 지운 행 거름: 읽음 갱신(`markMessagesRead`)이 돌려주는 행 중 `deleted_at`이 있는 것은 화면 상태에 합치지 않음 - RN은 거르지 않아 지운 메시지가 되살아날 틈이 있었음. 질의 자체는 RN과 같음.
- [74-5] 올리는 중 사진 말풍선 미리보기: 큐의 `localUri`가 앱 데이터 폴더 상대 경로라 `<img>`가 못 읽어, 복사본 파일을 읽어 `blob:` 주소를 만들어 그림(`localPreview`, 화면을 떠나면 놓음). 큰 사진은 base64 읽기로 일시적으로 메모리를 더 씀 - 실기기 확인.
- [74-5] 실시간 첫 수신 지연(열린 항목 ④): 가짜 서버로는 재현 불가(구독 + `SUBSCRIBED` 메우기가 빠진 메시지를 채우는 것까지 시험) - 실기기에서 첫 수신이 늦으면 보고.
- [74-6] 파일: `features/magazine/{libraryData(D01 읽기 훅) · LibraryView(D01 · D14 · D16 그리기) · viewerData(D10 · D11 읽기 훅) · IssueViewer(속표지 · 뷰어 · 덮개) · ViewerHost}` + `stores/viewerOpenStore` + `tabs/MagazineTab`. 서버 조회는 루트 `@/services/magazineApi` · `dateRecordApi.fetchDisplayNames` · `@/utils/magazine` · `@/store/viewerStore`(보던 쪽, 메모리) · `@/constants/magazineCopy` · `@/services/issueManifest`를 그대로 씀(사본 0). 새 RPC · 테이블 · 정책 0. **issues_public 뷰만** 읽고 인쇄용(`magazine-print`) 버킷 · 경로 · 칸은 한 곳도 없음(시험이 호출 수준에서 확인).
- [74-6] 뷰어는 경로가 아니라 `PhoneLayer` 덮개 · `ViewerHost`를 Shell에 한 번(`App.tsx`) - `app/viewerEntry.setViewerEntry`에 `viewerOpenStore.open`을 꽂아 메인 B06 [읽기] · 지난 호 다시 읽기 · 서재 표지가 같은 문을 지남. 이유: 시트 · 채팅 뷰어(74-5)와 같은 방식이라 아래 탭 상태 보존 + 뒤로 가기는 덮개만(`useBackHandler`) + 규칙표 변경 0. 경로가 바뀌면 닫힘(시트와 같음). 다른 길: 스택 경로 `magazine-viewer` + 규칙표(RN 모달과 가깝지만 서재 목록 상태 · 스크롤이 사라짐).
- [74-6] 하드웨어 뒤로 가기: 속표지에서도 뷰어에서도 **덮개째 닫음**(RN 모달 pop과 같음). 화면의 ←는 뷰어 -> 속표지. 다른 길: 뷰어에서 뒤로 가기 = 속표지로(PM 취향 - 지시서의 "뷰어가 열려 있으면 뒤로 가기 = 뷰어만 닫기"는 덮개째 닫기로 읽음).
- [74-6] **[허가 요청] PDF 열기**: RN과 같이 `pdf_digital_path` 서명 주소(10분, `magazine` 버킷, 디지털만)를 시스템에 넘긴다 - 웹은 `bridge.openBrowser`(이미 있는 `@capacitor/browser`, 설치 0). 앱 안에서 PDF를 그리려면 PDF 렌더링 라이브러리(허가 밖)가 필요해 **설치하지 않았다**. 안드로이드 Chrome 커스텀 탭은 PDF를 내려받기로 넘기므로 "내려받기"라는 버튼 이름과 맞다. 실기기 확인: 탭이 열리고 내려받아지는지. 인앱 보기를 원하면 요청할 문장: "서재 뷰어에서 PDF를 앱 안에서 보여 주기 위해 PDF 렌더링 웹 라이브러리 1개(예: pdf.js) 설치를 허가해 주세요. 쪽 이미지(매니페스트) 방식 대안은 이미 [읽기]가 제공합니다." 웹 브라우저 개발 실행(`webBridge.openBrowser` = 현재 창 이동)에서는 앱을 떠나므로 PDF 확인은 앱에서.
- [74-6] D12 목차는 만들지 않음(숨김): 쪽 번호 매니페스트가 없고(R48-1이 지움) RN도 진입 버튼이 없다. 보드의 [목차] 버튼과 아래 쪽 썸네일 띠도 같은 이유로 뺌. D13(정렬 · 검색)과 겹치는 서재 목록 기능은 RN이 쓴 화면 ID 기준으로 **최신순 한 가지 목록**뿐 - D13으로 가는 버튼 0, D02 "제작 현황 →" 0.
- [74-6] 서재 읽기 = RN `useLibrary`와 같은 질의(`fetchPublishedIssues` + `fn_issue_progress` + 기간 안 count) · 표지 서명. **B13**: 한 방향 단계(`idle -> loaded | failed`)로 두고 받은 값은 다시 읽기(마운트 · `visibilitychange`)에서 비우지 않음, 다시 읽기가 실패해도 받아 둔 값이면 오류 화면으로 안 바뀜(RN은 `error`를 켜 값이 있어도 오류 화면). 탭을 옮겼다 돌아와도 직전 값(커플 단위, 표지 서명 주소 유효 시간 안에서만 - 만료 직전이면 버림)을 먼저 보여 뼈대를 안 거침. 다른 길: 매번 뼈대부터(깜빡임이 남음). 메인의 `useLibrary`(`useMainData.ts`)는 그대로 둠 - 메인 카드용이라 `reload` · 기억이 없음(다음 정리에서 합칠 수 있음).
- [74-6] 메인 B06 카드 걷기: 뷰어가 덮개라 메인이 아래에 그대로 떠 있어 `visibilitychange`가 안 옴 -> `issueSeen.markIssueOpened`가 성공하면 `useIssueOpenedSignal` 번호를 올리고 `useMainFacts`가 그 번호가 바뀌면 "열어 봄"(과 사실 두 가지)을 다시 읽음(받은 값은 안 비움). 호를 열자마자(호 읽기가 끝난 시점) 남김 - RN과 같음.
- [74-6] 넘기기: RN은 가로 FlatList 페이징(끌면서 따라옴), 웹은 `ZoomableImage`의 밀기 판정(64px) + 220ms 슬라이드 · 페이드 한 장씩(끌기를 따라오는 연출 0) - 74-4가 만든 한 장 면을 그대로 써 확대 계산 · 손맛이 사진 뷰어와 같음. 이웃 쪽 서명 주소는 지금 쪽 +-1을 받고 이미지도 미리 받아 둠. 쪽 이미지가 안 열리면 그 쪽만 서명 주소를 버리고 한 번 다시 받음(`ZoomableImage`에 `onError` 추가). 터치로만 만들어 **실기기 확인**: 밀기 손맛 · 핀치 · 두 번 누르기 · 슬라이드 연출. 방향키는 PC 개발 확인용.
- [74-6] 이름 줄 "세준 · 서영": RN과 같이 [나, 상대] 순서로 `profiles.display_name`(읽기 실패는 빈 문자열). 닉네임은 `coupleStore.nickname`.
- [74-6] 폰트: 속표지 워드마크 · "N월호" · 코너 제목은 세리프(MaruBuri, 74-4가 들여온 파일 재사용). 보드 토큰의 MaruBuri-Light는 웹에 없어 Regular로(보드와 굵기 차이는 실기기에서 판단).
- [74-6] 루트 관문: 루트 tsc 0 · jest 101파일 1771건 그대로(루트 변경 0).
- [74-7] 파일: `features/settings/{SettingsView · useSettingsSummary(H01) · ProfileScreen(H03) · CoupleScreen + DissolutionGrace(H04 · H14 유예) · PhraseConfirm + UnlinkScreen(H14) + WithdrawScreen(H16) + WithdrawCancelScreen(유예) · PersonalityScreen(H05 · H06 시트) · SettingsResultScreen(A14~A16 설정 모드) · RetestScreen(A04~A07 -> 저장) · PrivacyScreen(H11) · AboutScreen(H19) · useDissolutionNotice · accountActions(로그아웃) · parts(목록 · 토글 · 틀) · settingsData · appInfo}` + `stores/dissolutionStore.ts` + `tabs/SettingsTab.tsx`. 서버 쓰기는 루트 `@/services/settingsCore` · `dissolutionCore` · `personalityCore.overrideEnneagramCore`를 클라이언트 인자로 그대로 가져다 쓴다(사본 0). 새 RPC · 테이블 · 정책 0. 쓰는 칸은 `settingsCore` 머리 표 그대로(profiles 이름 · 성별 · 마케팅 동의 시각 / couples 사귄 날짜 3칸 · 닉네임). `deleted_at` · `purge_scheduled_at` · `birth_date` · `onboarding_step` · `couple_dissolutions` · `retest_used` 등은 앱이 직접 쓰지 않는다.
- [74-7] 새 경로 10개(스택): `settings-profile` · `settings-couple` · `settings-unlink` · `settings-personality` · `settings-result` · `retest` · `settings-privacy` · `settings-about` · `settings-withdraw` · `withdraw-cancel`. 전부 `routes.ts` -> `routeTable.tsx` -> `backRules.ts` -> 시험 표(`backRules.vitest.ts`)에 더했다. RN의 `result-detail?source=settings`는 `settings-result?view=`로, `mbti?retest=1` -> `love-quiz?retest=1` 두 화면은 **경로 하나 `retest`** 안의 두 단계로 옮겼다 - 이유: 웹 이동 층에는 `dismissTo`가 없어 끝난 뒤 H05로 한 번에 돌아오려면 한 경로 안이어야 하고, 온보딩 부품(`MbtiScreen` · `LoveQuizScreen`)은 `nav.push('quiz'/'brief')`로 다음을 부르므로 `RetestScreen`이 가짜 `Nav`를 넘겨 단계 이동 · 저장으로 바꿔 받는다(온보딩 코드는 `nav` 인자만 쓰므로 수정 0). 다른 길: 경로 둘 + 깊이만큼 `back` 반복(연타 대기와 부딪혀 불안정).
- [74-7] 단계 판정 자리 채움: `resolveWebRoute(db, userId, step, deletedAt?)` - 유예 시각(`profiles.deleted_at`)이 있으면 단계와 무관하게 `withdraw-cancel`(RN `resolveResumePath`의 `WITHDRAW_CANCEL_PATH`). `finalizeAfterLogin`의 기존 계정 결과에 `deletedAt`을 더해 로그인 직후(`useAccountFinalize`)와 앱 시작(`useBootSession`) 두 길이 같은 판정을 지난다. 유예 판정은 서버를 더 부르지 않는다(이미 읽은 프로필 값). 취소하면 `resolveWebRoute(..., null)`로 원래 단계를 다시 정해 `enterAccount` + 토스트 "탈퇴를 취소했어요"(B15). 유예 화면 뒤로 가기 = RN 그대로: 하드웨어 뒤로 = 앱 종료(규칙표 `exit`), 화면의 ← = 로그아웃.
- [74-7] 로그아웃: `settingsCore.performLogout`(메모리 스토어 비움 -> `signOut`) + 서버 로그아웃이 오류로 끝나면(끊긴 연결에서 supabase-js는 세션을 안 지운다) `signOut({ scope: 'local' })`로 이 기기의 Preferences 세션을 반드시 지움 - RN에는 없던 보강. 끝나면 어떤 경우에도 `nav.reset('intro')`(첫 화면). 채팅 큐(글 · 사진) 키는 건드리지 않는다(시험이 Preferences 가짜로 확인). `navigation.tsx`: `reset('intro')`는 계정 잠금(`accountLocked`)을 푼다 - 안 풀면 로그아웃 뒤 다시 가입하는 온보딩에서 뒤로 가기가 전부 앱 종료가 된다(기존 코드의 숨은 결함).
- [74-7] 해제 알림: RN `useDissolutionNotice`를 `features/settings/useDissolutionNotice.ts`로 - Shell이 탭 화면에서만 켜고(`useStartDateRecheck`와 같은 자리), 탭이 처음 열릴 때와 `visibilitychange` 보임에 해제 상태를 읽어 **상대가 개시한** 진행 중 해제가 있으면 `settings-couple`을 urgent 푸시. 같은 해제 id는 앱을 켠 동안 한 번. 내가 개시자면 0. 그 화면이 H14 유예 화면(상대 쪽)이다. 푸시 알림 없음. A20 재표시와 같은 순간에 둘 다 열리면 둘 다 쌓인다(드묾, 뒤로 가기로 하나씩).
- [74-7] 해제 · 탈퇴 취소 뒤 토스트(B15): 해제 취소 "해제를 취소했어요"(`fn_cancel_dissolution` 성공 뒤, 화면이 연결 화면으로 바뀐 상태에서) / 탈퇴 취소 "탈퇴를 취소했어요". 둘 다 `showToast`(I06 공용).
- [74-7] 문구 입력(I05): `PhraseConfirm`(웹판) - 확인어 H14 `해제합니다` · H16 `탈퇴합니다`(루트 `isPhraseMatch` 그대로: 앞뒤 공백만 무시, 서로의 확인어로는 안 켜짐). PDF 안내 줄은 `nav.replace('magazine')` - RN은 `push('/(tabs)/magazine')`이라 돌아오면 이 화면이었으나 웹 탭 이동은 `replace`(규칙표: 탭 뒤로 = 메인)라 돌아오지 않고 메인으로 간다. 다른 길: 매거진을 스택으로(범위 밖 변경). 해제 요청 성공 직후 연결 상태를 다시 읽으면 미연결로 바뀌어 안내 카드가 번쩍이므로 요청이 끝난 뒤에는 카드로 바꾸지 않는다.
- [74-7] [판단] H19 문의: 받는 주소는 루트 `@/constants/support`의 `SUPPORT_EMAIL`(`TODO_SUPPORT_EMAIL` 자리표시자 - 이메일 0 원칙과 충돌 없음, RN과 같은 상수라 Proteur가 그 한 줄만 바꾸면 웹도 따라감). 메일 열기는 다리에 `openMail`을 더해(웹뷰를 `mailto:`로 이동 - Capacitor 안드로이드는 http 아닌 주소를 시스템 인텐트로 넘김, 새 의존성 0) 예외가 나면 토스트로 주소를 안내. **메일 앱이 하나도 없을 때 웹뷰가 예외를 주는지는 실기기 확인 항목**(안 주면 토스트 없이 아무 일도 안 일어남). 다른 길: `@capacitor/browser`로 열기(커스텀 탭은 mailto를 못 다룸). OS 줄은 userAgent에서 읽은 "Android 14" 꼴(루트 `osLabel`은 모르는 OS 이름을 그대로 씀, "API"를 붙이지 않음).
- [74-7] 앱 버전: RN은 Expo 설정 값, 웹은 `web/package.json`의 `version`(0.1.0)을 JSON import로 읽는다(package.json 수정 0). 안드로이드 `versionName`("1.0")은 네이티브 파일이라 웹에서 읽을 수 없고 손으로 고치지 않는다 - 둘이 다르면 화면에는 웹 값이 보인다(PM이 출시 때 맞출 것).
- [74-7] patch7 반영: H04 날짜 안내를 날짜 줄 설명으로(ⓓ) · H14 상대 쪽 주어 · 취소 자리 이유(ⓔ) · H16 유예 화면이 먼저(ⓕ) · 확인어 서로 다름 + 두 화면 모두 PDF 안내(ⓖ) · H05 애착 슬롯. **H05 애착 이름**: patch7 H05는 "{attachment} 슬롯"으로 이름을 보이라고 하고 웹 A14도 이미 `ATTACHMENT_LABEL_KO`를 쓰므로 따랐으나, 상수 주석은 "사용자 노출 문구는 아니다(MASTER 10-5-3)"이고 RN은 이 이유로 뺐다 - PM 확인 필요(빼려면 `PersonalityScreen`의 meta 한 곳 + A14 meta 한 곳).
- [74-7] 공통 화면 부품 수정(`screens.tsx`): `DetailBody`를 export하고 `onNext`를 선택으로, `onBack`을 더함(설정 모드는 [다음] 없이 ←) / 온보딩 `ResultDetailScreen`의 A16 본문을 `CoreOverrideView`로 빼 설정 모드가 같이 씀(고른 값 상태는 그 안, 목록 아래 여백 54 = 버튼 높이 이상, B17) / `LegalSheet` export(H11 · H19가 씀). 온보딩 동작은 그대로(`screens.vitest.tsx` 통과).
- [74-7] 목록 값(B14): `useSettingsSummary`가 이름 · 로그인 방식 · 성격 라벨 · 연인 이름을 읽기 전까지 뼈대, 읽은 뒤에는 같은 사용자의 직전 값을 모듈 변수에 기억해 하위 화면에 다녀와도 뼈대로 되돌리지 않는다(사용자가 바뀌면 안 씀). 연인 줄은 해제 유예 중 "해제 예정"(RN은 `status`가 active만 잡아 "연결 전"으로 오해하게 보임).
- [74-7] 시험 보조: `testSupportCouple.ts`에 `is` · `neq` 필터 · 그 밖의 표(`extraTables`) · `failUpdates` · `signOut` 가짜 · `signOutCalls`를 더했다(74-2 시험은 그대로 통과). `testSupport.ts`의 가짜 다리에 `openMail`. 새 의존성 0 · `web/android` 변경 0(cap sync 변경 0) · 루트 · RN 변경 0 · 서버 새 RPC 0 · 마이그레이션 0.
- [74-8] **F2 이미지 저장 한 길**: 결과 공유 카드(`screens.tsx`)와 채팅 사진(`ChatView.tsx` -> `chatPhotoActions.saveChatPhoto`)이 모두 `platform/imageSave.ts`의 `saveImageToDevice`를 지난다. 파일 이름은 이 함수가 매번 새로 정한다: `ondolog-<result|chat>-<날짜>-<시각>-<밀리초>-<무작위 4자>.<확장자>` - 같은 이름 덮어쓰기와 "이전 설치가 만든 파일을 못 쓴다"를 피한다(무작위 칸은 파일 이름에만 쓰이며 채점과 무관). 실패는 `failed`만 돌려주고 호출한 쪽이 토스트로 안내한다(결과 카드 "저장하지 못했어요" · 채팅 사진 "사진을 저장하지 못했어요. 다시 시도해 주세요"). 시트를 닫은 `cancelled` · `shared`는 안내 없음. 원인 · 경로 · 이름은 로그에 남기지 않는다(시험이 console 호출 0 단언). 다른 길: 두 곳이 각자 이름 만들기(F2 재발).
- [74-8] **[판단] F2 갤러리 노출**: 앱(Capacitor)의 `saveImage`를 **공유 시트로 저장**하는 방식으로 정했다(캐시에 새 이름으로 쓰고 `Share.share`). 근거: `@capacitor/filesystem`의 `Documents`/`ExternalStorage`에 직접 쓰면 파일은 생기지만 갤러리가 새 파일을 알아채는 **미디어 스캔(네이티브 MediaStore 등록)**이 있어야 보이는데, 그것은 새 플러그인이나 `web/android` 손수정이 필요하고 허가 목록에 없다. 그리고 Android 10 이상에서 이전 설치가 만든 파일은 새 설치가 덮어쓰지 못해 F2의 원인이 되는 길이다. 공유 시트는 사용자가 사진/갤러리 앱 등 저장할 곳을 고른다. 실기기 확인: ① 시트에서 사진 앱에 저장되는지 ② 재설치 뒤에도 실패하지 않는지(탐방 안내 7장). 사진 앱에 바로 저장되는 한 번에 끝나는 방식을 원하면 요청할 문장: "미디어 스캔(MediaStore 등록)을 위한 Capacitor 저장 플러그인 1개 설치를 허가해 주세요." `SaveResult`에 `cancelled`를 더했다(시트를 닫음).
- [74-8] 탐방 안내 `docs/74-exploration-guide.md`: `51-device-checklist.md` 49항목을 앱 쓰는 순서(첫 사용자 -> 연결 -> 기록 -> 채팅 -> 서재 -> 끊김 띠 -> 설정 -> 해제 · 탈퇴는 맨 끝)로 재배열. 두 번째 계정 항목은 "계정 준비 뒤". 추가 `+` 14항목(Gboard 셋 · 로그인 중 강제 종료 · 재설치 뒤 이미지 저장 · 글자 크기 최대 · EXIF · 큰 사진 큐 · 카메라 capture 등). 51 문서는 고치지 않았다.
- [74-메인 세션] 커밋을 묶음별이 아니라 두 번(74-0 / 74-1~8)으로 나눔 · 여러 묶음이 같은 파일을 고쳐 묶음별 커밋은 빌드되지 않는 중간 상태가 됨 · 다른 길: 묶음마다 작업 트리를 커밋하며 돌리기(사람 커밋이 필요해 R75-1과 맞지 않음)
- [74-2] RN 앱 · 루트 · `web/android` 변경 0. `web/.env` 값 출력 0. `web/src/ui.tsx`의 `Wordmark`는 A09 삭제로 쓰는 곳이 없어졌으나 남겨 둠(다음 묶음이 쓸 수 있음).

- [74-h1 ①] D1 원인: **코드·jsdom 모두에서 재현하지 못함**(진짜 인증 클라이언트 + 가짜 네트워크로 세 순서 통과, 수정 전후 동일). 읽어서 찾은 결함 둘만 고침: (a) 같은 앱 링크가 한 번 더 들어오면(두 번째 콜백 화면이 빈 칸을 보고 "로그인하지 못했어요") (b) 로그아웃이 콜백 칸 · 처리한 코드 표시 · 알림 · 서재 기억 · 설정 요약 기억을 비우지 않음. 실기기 로그가 있어야 확정 · 출처: 자체 판단 · R77-2
- [74-h1 ①] 전체 로그아웃이 던져도(거부) 이 기기 세션을 지우도록 `scope: local` 폴백을 던짐에도 적용 · 출처: 자체 판단 · R77-2
- [74-h1 ②] 연결(active) 전에는 기록 쓰기를 닫음 - 대기(pending) 행이 있어도 닫음 · 판정 한 곳 `isRecordable`(`feedData.ts`) · 출처: PM 지시서 · R30-3 · R77-1
- [74-h1 ②] E13 보드(`E13.jpg`)의 문구 "혼자서도 기록할 수 있어요"는 R30-3과 모순이라 쓰지 않음. 비활성 상태의 보드가 없어 기존 비활성 문구("초대 코드를 만들면 기록할 수 있어요") + 보드의 아래 줄("연결하면 두 사람 기록이 하나로 합쳐져요") 유지 · 대기 행이 있는 사람에게도 같은 문구(보드 없음, PM 확인 필요) · 출처: 자체 판단 · R30-3 · R77-1
- [74-h1 ②] 기록 시트가 직접 열려도(닫힌 상태) 입력 칸 없이 이유 + [초대하러 가기](초대 화면으로)만 보임 · 데이트 상세 [사진 더하기]도 비활성 + 같은 이유 한 줄 · 출처: PM 지시서 · R77-1
- [74-h1 ③] 애착 표시 이름은 정본 `@/constants/attachmentDisplay`(MASTER 10-5-3 표)를 `web/src/attachmentNames.ts` 한 곳에서 씀. 안정은 표에 항목이 없어 **이름을 보이지 않음**(줄에서 칸을 뺌: "INFJ · 애니어그램 4") - 안정형이라는 말도 금지이고 지어내지 않기 위해 · PM 확인 필요 · 출처: 자체 판단 · R76-5 · MASTER 10-5-3
- [74-h1 ④] 코드 칸 "이미 다른 사람과 연결된 코드는 쓸 수 없어요"를 처음부터 깔아 두던 안내 줄에서 빼고 23505 오류일 때만 보임. 이전 시험의 "보드의 안내 문장이 항상 보인다"를 바꿈 · 출처: PM 지시서 · R77-2
- [74-h1 ④] 코드 칸에 `type=text` · `lang=en` 추가(자동 대문자 · 자동 고침 끔 · 영문 키보드는 이미 있었음). 한글 키보드로 열린 기기에서는 속성만으로 영문 키보드가 보장되지 않음(실기기 확인) · 출처: 자체 판단 · R77-2
- [74-h1 ⑤] 알림: 3초 · 탭 이동(도착 화면을 벗어나면) 닫힘 · 위치 `--top`+4px, 글 13px · 로그인 직후의 콜백 -> 계정 화면 이동은 "옮김"으로 세지 않음 · 출처: PM 지시서 · R65-2 · R74-5 · R77-2
- [74-h1 ⑥] 탐방 안내 "녹화에서 빼기"에 문의하기(메일 앱)를 더함, 탈퇴 취소 시험 기한은 "§1-c 결과 뒤 메인 세션이 채움" 자리 · 출처: PE 위임문 · R77-6

## 웹 앱 `web/` (`73-` 묶음 1 · 2, ui-builder) - 원격 쓰기는 실기기 로그인 · 저장뿐

Proteur의 Windows PowerShell 기준. **명령은 한 줄씩 따로 친다**(`;` · `&&` · 파이프 0 - R71-2). 저장소 경로: `C:\Users\sejun\OneDrive\바탕 화면\ONDOLOG\ondolog`

**1. 빌드 · 동기화는 원래 경로에서** (subst 드라이브에서 Vite를 돌리면 `html-proxy` 오류)

```powershell
cd "C:\Users\sejun\OneDrive\바탕 화면\ONDOLOG\ondolog\web"
```
```powershell
npm ci
```
```powershell
npx tsc --noEmit
```
```powershell
npx vitest run
```
```powershell
npm run build:trial
```
```powershell
npx cap sync android
```
- `npm run build:trial`: 시험 빌드(채팅 시험 화면 열림, 원격 값이 비어도 빌드됨). `npm run build`: 운영 빌드 - **`web/.env`의 `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY`가 비면 빌드가 실패한다**(채팅 시험 닫힘). 74-k2: `VITE_SUPABASE_ANON_KEY`는 변수 이름만 그대로이고 값은 publishable 키다(legacy anon 키는 비활성화됨).
- 개발 서버(브라우저에서 보기): `npm run dev`. 브라우저에서는 카카오 앱 링크가 안 돌아오므로 로그인 왕복은 실기기에서 본다.

**2. Android Studio는 ASCII 경로에서** (원래 경로로 열면 Gradle이 "non-ASCII characters"로 실패)

```powershell
subst O: "C:\Users\sejun\OneDrive\바탕 화면\ONDOLOG\ondolog"
```
```powershell
cd O:\web
```
```powershell
npx cap open android
```
- Android Studio에서 ▶ Run(JDK 21 필요: Capacitor 8).
- **subst는 PC를 다시 켜면 사라진다.** 다시 열 때는 `subst O: ...`부터 다시.

- 앱 이름 `com.ondolog.app.web` (Expo 개발 빌드 `com.ondolog.app`과 나란히 설치된다). 앱 링크 scheme `ondolog`은 **Expo 빌드도 쓴다** - 둘이 한 폰에 있으면 로그인 뒤 어느 앱으로 돌아갈지 묻는다. 웹 빌드를 시험할 때는 폰에서 Expo 빌드를 지울 것.
- **Supabase 대시보드 Auth > URL Configuration > Redirect URLs에 `ondolog://auth/callback`이 등록돼 있어야 한다**(RN 앱이 이미 쓰는 값이면 그대로).
- 웹 앱은 정본(`src/engine` · `constants` · `data` · `store` · `utils` · `services/personalityCore` · `services/onboardingStepCore`)을 별칭 `@/`로 가져다 쓴다. `web/` 안에 사본 없음.
- `web/.env`(VITE_ 변수 두 개)는 git 밖. 코드 · 로그 · 보고에 값을 내지 않는다.
- 시험 파일은 `*.vitest.ts(x)`로만 짓는다(루트 jest가 줍지 않게). `web/` 아래 `__tests__` 폴더 · `*.test.*` · `*.spec.*` 금지.
- 내부 결정(묶음 1): 라우터 `react-router-dom` 7.18.5 `MemoryRouter`(주소창 없음 -> 콜백 주소가 기록에 안 남음). 하드웨어 뒤로 가기는 `src/platform/backStack.ts`(시트 -> 화면 안 단계 -> 앱 안 뒤로 -> 첫 화면에서 종료). 바탕색 `#0A0814` 통일. 채팅 시험 목록 가상화 없음, 키보드는 SystemBars(`insetsHandling: native`)가 창을 줄여 주므로 키보드 플러그인 없음.
- 내부 결정(묶음 2): 가입 저장은 RPC가 아니라 **테이블 insert**(`profiles` -> `personality_assessments`, 없을 때만 넣기)이고 RN과 같은 정본 함수 `personalityCore.createProfileAndAssessment`를 웹 클라이언트로 부른다. 로그인 직후 판정도 정본 `decideAfterLogin`.
- 내부 결정(묶음 2): 기존 계정 알림("이미 가입한 계정이에요...")은 **방금 본 결과가 메모리에 있었을 때만** 한 번 보인다("방금 본 결과는 저장하지 않았어요"가 사실일 때). "이미 계정이 있어요" 길로 온 로그인에는 알림이 없다.
- 내부 결정(묶음 2): 서버 진행 단계 -> 웹 화면: 0 = 결과 상세, 1 = 초대, 2 이상 = 끝 화면(웹에 메인이 아직 없음). 탈퇴 유예(`deleted_at`) 확인 · 커플 연결 조회는 웹에 없음 - 메인을 옮길 때 같이.
- 내부 결정(묶음 2): 앱 시작 때 저장된 로그인이 있으면 서버 단계 화면으로 바로 간다(확인이 4초 넘게 걸리면 첫 화면). 계정이 생긴 뒤(`enterAccount`)에는 뒤로 가기 = 앱 종료. 이동은 350ms 안의 연타를 무시한다.
- 내부 결정(묶음 2): "전체 동의" 아래 문장 "선택 항목(마케팅 정보 수신)도 함께 켜져요"는 보드 A10에 없는 **후보 문구**(디자인 확인 필요, R65-4).
- 내부 결정(묶음 2): 이미지 저장은 `Documents/ONDOLOG/`에 쓰고, 못 쓰면(Android 10+ 권한 때문에 가능성 있음) 공유 시트로 대신한다. 갤러리에 바로 뜨는지는 실기기에서 확인 필요.
- (74-2에서 해결 - 초대 코드는 서버 발급, A09 전체 화면은 지움) 열린 문제(묶음 2): 웹 초대 화면(A17)의 코드는 화면에서 만든 무작위 값이고 서버에 저장되지 않는다(RN은 `coupleApi`). 로그인한 계정에게는 거짓 코드다 - 커플 연결을 옮기기 전에 이 화면을 막을지 PM 결정 필요. A09 공유 카드(밤하늘) 화면은 결과 화면의 공유 버튼이 OS 공유 시트로 바뀌어 더 이상 어디서도 열리지 않는다(삭제 여부 PM 결정).

## 열린 항목

> 완료 항목은 `.claude/state/archive/`로 옮긴다. 이 파일에는 열린 것만 둔다.
> 이 표는 원본을 가리키기만 한다. 본문을 옮겨 적지 않는다.

| 항목 | 상태 | 원본 |
|---|---|---|
| 모듈 경로 계약 | 유효 | `__tests__/engine/cornerPipelineStaticRules.test.ts`의 `LLM_CALL_MODULE` · `APP_CONFIG_LOOKUP_MODULE` · `APPROVED_BRAND_CONSTRUCTOR_MODULES` |
| 발행 시 테마 복사 트리거 | 미적용 (Phase 7 발행 묶음) | `docs/ONDOLOG_SCHEMA.md` §9-C-7 |
| 테마 잠금 DB 강제 | 미적용 (Phase 9, 그 전 공개 배포 금지) | `docs/ONDOLOG_SCHEMA.md` §9-C-8 |
| 루트 `include`가 `docs/`의 `.ts`까지 먹음 | 알려진 제약 | `tsconfig.json`의 `include` |
| `TYPE_AFFINITY_ENGINE_VERSION` 도입 + 산출 시 기록 | 미구현 | `docs/ONDOLOG_MASTER.md` §10-7-5 |
| 발행 경로 설계 | 보고 완료(`46`), 승인 대기. 질문 Q1~Q17·문서 어긋남 D1~D7 | 이 파일 "발행 경로 설계 보고 (`46`)" 절 |
| 발행 경로 마이그레이션 `022_publish_path.sql` | 작성 완료(`47`), **원격 미적용**. 적용 전 관문 쿼리·적용·실증은 사람 | 이 파일 "발행 경로 마이그레이션 (`47`)" 절 |
| 022 실증 스크립트 3종 (`scripts/db/verify_022_*.sql`) | 작성 완료(`47b`), **미실행**. 실행은 메인 세션이 적용 확인 뒤 | 이 파일 "022 실증 스크립트 (`47b`)" 절 |
| 테마 복사 트리거 실증 — 원격 couples 0행, 48- C에서 (SCHEMA §9-D-9) | 미실증 | `docs/ONDOLOG_SCHEMA.md` §9-D-9 · 이 파일 "022 적용·실증 결과 (`47b` 실행)" 절 |
| lock 재생성 후 `react-native-worklets` 미설치 (`49`) — reanimated 4.5.1 피어(0.10.x). 이전엔 피어 자동 설치로 들어왔고 `--legacy-peer-deps`는 피어를 안 깐다. jest·tsc는 무관, 재빌드(`51-`) 전 판단 필요. 메인 세션 판단: ui-builder.md 중복은 `추가분` 코드 블록 안 사본을 지웠고 Phase 10은 제목을 두고 본문만 한 줄. db-architect.md 13행 겹침 정리: "마이그레이션은 SCHEMA.md §13의 순서(현재 022까지)를 그대로 따른다" | 열림 | `.claude/state/prompts/phase-7/49-main-session-m0-env-sync.md` · `package.json` |
| 조판 막힌 슬롯 여섯 묶음·README 빈칸 (`55-2`) — v1.2.2 반입·`55-3` 맞춤으로 대부분 해소. **남은 것: 디자인에 넘길 목록 4건**(`da-article` 히어로 사진 틀 · 캡션 라벨 줄 · 하단 한 줄의 `bottom:62px` · `attribution.at` 표기). 시험 호 ①②③은 개발 DB에 있다(① 발행됨) | 열림(디자인) | 이 파일 "조판 v1.2.2 맞춤 (`55-3`)" 절 |
| 조판 `55-3` 원격 실증(시험 호 4권 렌더 · 발행 회귀) — 명령 작성 완료, **실행은 사람**. 실제 커플 발행은 PM 판정 뒤(R29-2) | 대기(사람) | `scripts/ops/out/55-3-run.ps1` · 이 파일 "조판 v1.2.2 맞춤 (`55-3`)" 절 |
| UI 기반 U0 (`53`) — 실기기 확인 대기. `experimental_backgroundImage` 사진 장막·`boxShadow`·폰트·탭 아이콘 발광은 시뮬 불가라 `51-` 재빌드 뒤 확인. 위 worklets 행은 `53`에서 해소(react-native-worklets 0.10.1 설치) | 열림 | 이 파일 "UI 기반 U0 (`53`)" 절 |
| **U2 본인 기록 삭제 막힘 (`56`)** — 클라이언트가 지울 방법이 DB에 없다(data_entries DELETE 정책 없음, 소프트 삭제 UPDATE는 SELECT 정책 때문에 RLS 거부 - 원격에서 확인). PM 결정 필요: RPC 또는 정책 마이그레이션 -> R30-1로 RPC 결정, `023_delete_own_entry.sql` 작성(`57-` A), **원격 적용·실증 완료**, 앱 UI는 `57-` C에서 만듦(실기기 확인 대기) | 앱 쪽 해소 | 이 파일 "본인 기록 삭제 UI · stop 시각 (`57-` C)" 절 |
| **U2 혼자 기록의 커플 행 (`56`, 규칙 6)** — 커플 행은 초대 코드를 발급해야 생긴다(`InvitePanel.handleIssue` -> `getOrCreateInvite`). 온보딩 "나중에"는 행을 안 만든다. 행이 없으면 기록 버튼 비활성 | 열림(PM 결정) - 웹 74-2도 RN 그대로(나중에 · 솔로는 행을 안 만듦), 74-4가 기록 버튼 비활성 처리 시 참고 | 같은 절 |
| **U4 채팅 (`62`)** — 실기기 확인 대기(`51-`). PM 결정 4: ① 사진 보내기의 영속 큐(지금은 앱을 닫으면 올리는 중인 사진이 사라짐) ② F04 [카메라]·"최근 사진"·F06 [저장]·[공유]·F02 [복사하기] 보류(카메라 권한 `app.json`·새 의존성 필요) ③ 보드 F02의 둘째 문장("잡지의 재료")은 규칙 9로 뺌 - 디자인에 알릴 것 ④ 실시간 첫 수신 지연 1회(원인 미확인) | 열림 | 이 파일 "U4 채팅 (`62-`)" 절 |

## 확인 요청 시간 제한 · 헤더 시험 · Python 측정 래퍼 (`72c-`, 2026-11-05, ui-builder) - 원격 0

- 래퍼 실행(저장소 루트): `render/.venv/Scripts/python.exe -B scripts/ops/pyDurations.py` (결과 `scripts/ops/out/py-durations-<시각>.txt`)
- R59-4 기준 기록(`72b-` 2회차): 전체 347.2초
  | 순위 | 시험 | 초 |
  |---|---|---|
  | 1 | test_render_issue.Render.test_all_six_themes_render | 54.23 |
  | 2 | test_render_issue.WholeRender.test_a_clean_issue_renders_with_no_original_clipped_and_the_design_audit_agrees | 39.12 |
  | 3 | test_render_issue.WholeRender.test_clipped_original_stops_the_render_before_upload | 38.23 |
  | 4 | test_render_issue.Render.test_photo_scenario_renders_to_one_pdf_with_matching_pages | 35.86 |
  | 5 | test_render_issue.Render.test_clipped_ondolog_sentence_is_recorded | 32.97 |
  | 6 | test_render_issue.Render.test_audit_catches_overset_when_the_timeline_is_not_split | 20.64 |
  | 7 | test_v122.OriginalOversetGate.test_timeline_overflow_volume_stops_the_render | 18.96 |
  | 8 | test_render_issue.Render.test_clipped_original_is_a_failure | 16.90 |
  | 9 | test_render_issue.Sample.test_every_image_in_a_filled_page_is_a_work_folder_photo | 16.52 |
  | 10 | test_render_issue.Sample.test_a_sample_path_left_in_a_page_is_a_failure | 14.98 |
- 내부 결정: `ConnectionProbe`가 `signal?`을 받는다(확인 요청에만). 기존 u8OfflineBand의 "확인 요청 인자 0" 단언을 "signal 하나만"으로 고침(헤더 0 계약은 새 시험이 등록 함수로 지킨다).
- 내부 결정: 시간 초과 · 거부 · 정리 모두 한 `finish()`로 타이머를 지운다. 정리 단계는 진행 중 요청을 abort 한다.
- 내부 결정: 래퍼는 `discover -s render/tests`와 같은 위치를 절대 경로로 찾는다(작업 폴더 무관). 판정은 unittest 그대로, 종료 코드도 그대로.
- 내부 결정: 정리 시 타이머 개수 0 단언은 뺐다(React · RN 쪽 타이머가 따로 있음). 대신 abort 와 이후 재시도 0을 본다.

## 지역 숫자 · 시드 메모 (`55-3d`, 2026-11-03, corner-pipeline) - 로컬 다섯 권 재렌더, 원격 미실행

- 지역 칸 정의: 이번 기간(재소환 제외) 기사 중 `region`이 값과 같은 기사 수(= 그 지역에서 보낸 날). 경유지 이름이 값과 같은 칸은 예전처럼 경유지 수 · 라벨은 이름 그대로. 지역과 경유지 이름이 같은 글자면 지역이 먼저다.
- 라벨은 `facts.REGION_DAYS_SUFFIX`(`에서 보낸 날`)에서 만들고 compose가 칸의 `value`를 그 라벨로 바꿔 틀(`.value` 슬롯)에 건넨다 - 생성이 준 `value`(지역 이름)는 어떤 칸을 보일지만 정한다.
- 시드 본문: "연남동에서 보낸 날은 이번 달 데이트 기록에 N번 있었고, 그 경유지는 M곳이었습니다." - N은 날 수, M은 경유지 수(둘 다 기록에서 센 값). 기사 제목 "같은 동네, 여러 번"은 날 수 1과 어긋나 "여러 곳"으로.
- vol3 긴 메모(창가 · 커피 · 노을)는 14:20 홍대입구역에서 16:10 연남동 카페로 옮김(그 구간의 짧은 메모를 대체). 타임라인 시험 호는 카페 14:20 -> 16:10, 숲길 17:40 -> 19:10으로 시각만 옮기고, 긴 메모 문장 중 집 · 버스 · 지하철역 문장을 그 구간 안의 문장으로 바꿈(첫 문장 묶음은 그대로라 vol4 멈춤 · 어림 944px 유지).
- 시드 점검 낱말 표(`test_r52.py` `PLACE_WORDS` · `TIME_WORDS`)는 현재 시드의 장소 · 활동만 담는다 - 시드에 장소가 늘면 표도 늘려야 한다.
- 못 고친 것(범위 밖): vol3 p11 대화 시각(19시대 "잘 자") - 메모가 아니라 대화 시드라 그대로, PM 판단 대기.

## 지면 사실 마무리 (`55-3c`, 2026-11-01, corner-pipeline) - 로컬 다섯 권 재렌더 · 쪽 그림, 원격 미실행

내부 결정(항목당 한 줄):
- N1 재소환 줄: `note.html`에 자리가 없고 `render/issue/` 수정은 N3 한 곳뿐이라, 렌더러(`render_issue.add_note_recalled_line`)가 틀의 표(`</table>`) 바로 뒤에 줄을 끼운다. 표가 네 줄이면 아래 블록(`top:520px`)에 닿아 겹치므로 **줄을 끼울 때만** 아래 두 블록을 36px 내린다(520 -> 556, 650 -> 686). 재소환 0이면 틀 그대로. 디자인 v1.2.3 요청에 "note 표 아래 한 줄 자리"를 더하면 이 함수를 지운다.
- 재소환 사진 정의: 재소환 기사로 실린 사진(히어로 + 사진 상위 3장)의 서로 다른 경로 중 이번 기간 게재에 없는 것(`IssueFacts.photos_shown_recalled`). 노트 표의 이번 기간 정합은 섞이지 않아 그대로다.
- N3 원인: 템플릿이다 - `da-opener.html`의 `top:522px` 작은 줄(`Date Archive` + `@da.regionLine`)이 두 변형 밖에 있어 활자 변형의 큰 활자와 겹쳐 두 번 보였다(렌더러는 슬롯마다 한 번씩만 채운다). 그 줄을 `with-photo` 변형 안으로 옮겼다.
- N4 숫자 칸 정의: 이번 기간(재소환 제외) 기사의 경유지 중 `value`가 기사 지역(`region`)과 같으면 그 지역 기사들의 경유지 수 합, 아니면 `value`가 경유지 이름과 같은 경유지 수(`IssueFacts.signal_count`, 장소 신호만). 생성이 준 `count`는 쓰지 않는다. **기록에서 셀 수 없는 칸(`keyword` · `activity`, 이번 기간에 없는 지역 · 장소)은 지면에 보이지 않는다**(`Composition.report.decisions`에 남는다). 실제 생성 신호가 키워드 중심이면 칸이 모자랄 수 있다 - PM 판단 대기(키워드의 정의를 정할지, 칸을 줄일지).
- N4 칸 개수: 셀 수 있는 칸만 모은 뒤 앞에서 3개(`SIGNALS_CAP`) - 생성이 고른 순서는 지킨다.
- N5: 지시한 세 곳(기사 칸 사진 · 메모, 타임라인 `사진 0`, 합계 `사진 0장`) 외에 **오프너 `이날의 기록`의 사진 0 칸도 뺐다**(vol2b 오프너에 `사진 0`이 보였고 같은 규칙이다). 원하지 않으면 `COUNT_CELL_SLOTS`에서 `@da.photoCount`와 `compose`의 `photoCount ... or ''`를 되돌린다.
- N5 구현: 0은 빈 값으로 건네고(`compose`), 빈 칸을 라벨째 빼는 일은 렌더러(`drop_empty_count_cells`, 이전 `drop_empty_caption_cell`의 일반화 - 이전 이름은 별칭으로 남김)가 한다. 지면 HTML에 `data-optional`이 없고 R50-6 허용 자리 밖이다. 합계는 `timeline_totals`가 만든다(0인 조각 없음, 사진이 일부만 실리면 `사진 0 / 4장`처럼 그대로 둔다 - 0이 아니라 4 중 0이다).
- N6 시드: 긴 원문은 `LONG_CONVERSATION_TEXTS`(발화 160~163자, 문장 끝, 두 대화에 같은 문장 없음) · `OVERLONG_CONVERSATION_SENTENCES`(4턴 x 388~406자 - 12줄이라 높이 1337px 그대로) · 긴 메모는 문장 모음에서 문장 끝까지 이어 붙이는 `whole_memo`. 모자라면 문장을 되풀이하지 않고 `ValueError`.
- vol4(긴 타임라인 메모) 메모는 400자 -> 380자 안팎(381 · 387자)으로 줄었다 - 문장 끝에서 끝나게 하면 400자 정확히는 만들 수 없고, 407 · 420자로 늘리면 높이 어림이 두 면으로 나눠 "어림은 한 면에 든다 / 실제로는 넘친다"는 이 권의 뜻이 사라진다. 시험이 351~400자와 어림 한 면을 잡는다. 결과: 내용 1003px / 상자 953px로 여전히 멈춘다(이전 1061px).
- 원문 시험의 기준(`seed_render_tests.chat_messages` · `memo_texts`): 시드가 채팅 기록에 넣는 줄 = 다정한 말들 턴 · 짧은 말 + **이달의 우리 근거 메시지 발췌**(`evidence.excerpt`는 원문 그대로라 기록에 있어야 한다. 시드 스크립트가 채팅 기록에도 넣도록 바꿨다 - 보낸 사람은 content에 없어 첫 사용자). 같은 줄이 두 번 나오지 않게 근거 발췌 `좋은 아침`을 `아침부터 연락 줘서 고마워`로 바꿨다.
- 시드 이달의 우리: 숫자(신호 `count` · 본문 `경유지로 N번`)는 그 호의 데이트 아카이브 기록에서 센다(`standard_this_month`). "다섯 번"은 사라졌다. M1c 판정 항목 "생성 숫자 = 기록 집계"의 시드판 시험이 들어갔다(실제 생성 검증은 M1c).
- 시드 점검에 "대화 본문이 서로 겹치지 않는다"(같은 글 · 한 글이 다른 글 안에 · 같은 문장 없음)를 더했다.
- 스키마: 다섯 호의 content 15개가 저장 스키마(Zod)를 모두 통과한다(Deno `dump` 후 검사, 임시 스크립트).

## 지면 사실 오류 일괄 수정 (`55-3b`, 2026-11-01, corner-pipeline) - 로컬 다섯 권 재렌더 · 쪽 그림, 원격 미실행

내부 결정(항목당 한 줄):
- "호의 사실" 모듈은 `render/facts.py` 하나다. 오프너 · 목차 · 발행 노트 · 타임라인 라벨 · 기사 칸 · 경로 지면 · 출처 날짜의 재소환 날 판정이 모두 `build_facts` 결과를 읽는다. `compose.py`가 지면 높이 · 쪽 나눔 · 문장 수를 세는 것은 그대로다(사실이 아니라 배치).
- 오프너 "함께 보낸 날"은 이번 기간 모은 양(`materials.dates`) -> 없으면 코너 `summary.dateCount` -> 없으면 이번 기간 기사 수 순서로 읽는다. 어느 것을 읽었는지 `report.facts.periodDatesSource`에 남는다.
- 발행 노트 정합: 게재가 모은 양보다 크면 `FactsError` -> `ComposeError`로 렌더를 멈춘다(거짓 숫자를 찍지 않는다). 남는 차이는 줄마다 "기사로 고르지 않은 날 / 기사에 담기지 않았습니다 / 인용으로 고르지 않았습니다"로 싣는다. 시험이 쓰던 임의의 모은 양(`1 · 1 · 1 · 1`)은 `ROOMY`로 바꿨다.
- 노트 사진 · 메모 게재는 이번 기간 기사만 센다(재소환 기사의 것은 뺀다). R49-4가 받은 "오프너 사진 수 != 노트" 차이는 없어졌다(오프너 = 노트 = 지면에 놓인 사진 수, 시험이 채운 지면의 img로 따로 센다).
- 기사 사진 아래 유저 메모는 기사의 첫 사진 아래 하나(기사에서 처음 나오는 글 있는 메모)이고 쓴 사람 이름이 따라간다. 나머지 메모는 "대표가 아닌 기사에는 하나만 싣습니다"로 노트에 적힌다. "첫 사진"을 구간의 첫 사진이 아니라 기사의 첫 사진으로 읽었다 - 아니면 PM이 알려 주면 바꾼다.
- 이름 없는 곳은 경로 목록뿐 아니라 "그날 거친 곳" · 타임라인 아래 경로 줄에도 "이름을 남기지 않은 곳"으로 싣는다(같은 목록을 읽는다). 타임라인 구간 카드의 장소 칸은 그대로 비운다.
- AI 캡션 칸 제거(#6): `da-article.html`에 칸을 뺄 `data-optional`이 없고 R50-6의 여섯 곳에 없어서, HTML은 두고 `render_issue.drop_empty_caption_cell`이 `@da.articleCaptionCount`가 빈 칸을 라벨째 뺀다. 디자인 v1.2.3 요청에 "이 칸에 `data-optional`"을 더하면 이 함수를 지운다.
- 오프너 "남긴 기록 · 메모 N"의 N은 글 있는 메모 수(그림 메모 제외), AI 캡션 수는 타임라인에 실린 구간의 것만 센다.
- 타임라인 "사진 3 / 4" 라벨은 보기 사본 구간에 `photoLabel` 필드를 더해 건넨다(원본 content는 그대로). 아래 합계도 같은 모양(`사진 7 / 8장 · 메모 2`).
- 출처 날짜: `attribution.display`의 앞 날짜 · 시각만 근거 날짜 규칙(`09.22 09:20`, 재소환 날 · 다른 해는 연도)으로 바꾸고 뒤의 정황 말(`, 아침 대화 중`)은 둔다. 짧은 말의 `at`도 같은 함수.
- `sw-opener`의 폴리오는 변형(with-photo / type-only) 안으로 옮겼다(사진 변형만 밝은 잉크). 공통 폴리오를 지웠다.
- 시드: `questions` 근거 문장은 그 기사의 경유지 이름에서만 만든다 · 출처 줄은 첫 발화 시각에서 만든다(`stamped`) · 이달의 우리 마무리 문장은 합니다체 · 시드의 "산책" 낱말을 기록에 있는 것으로 바꿨다(제목 · 캡션 · signals). `비가 와도 우리는 걸었다`(표지 표제 시험용)는 평어체지만 이번 시드 점검 대상(합니다체)에서 뺐다 - 표제다.
- 쪽 그림: `render_pages(with_png=True)`가 같은 렌더 결과에서 PNG를 한 장 더 찍는다. `local_volumes.py`만 켠다.

## 조판 v1.2.2 맞춤 (`55-3`, 2026-10-28, corner-pipeline) - 로컬 시험 호 렌더 통과, 원격 미실행(`55-3-run.ps1`은 사람)

내부 결정(항목당 한 줄):

- 반입 대조: README §8 48파일 = 실제 48파일(빠짐 0 · 남음 0) · 파일명 ASCII · `render/issue/` 수정 0. `contents.html` 속표지 문장(합니다체)은 PM이 받은 변경으로 정한 것(README §10에 없음).
- `data-width`(`slot_fill.parse_width`·`_apply_width`): 숫자 또는 숫자 글자(`34`·`34%`)만 받고 그 밖(None·범위 밖·`abc`·불리언·NaN)은 요소를 지운다(실패 아님). **`34%`도 받는다** - 지면이 같은 경로(`@note.ratioPeople`)로 폭과 `34%` 글자를 함께 맡기기 때문이다(디자인 `resolve.js`는 폭·글자를 따로 받아 `34%`를 지운다 - 알려진 차이, `scripts/ops/out/55-3-data-width.txt`). 폭 칸은 `width:N%;flex:none`으로 바꾸고 박혀 있던 `width`·`flex`만 지운다(`min-width` 등은 둔다). 적용 순서는 variant → repeat → if → optional → width, 폭이 지운 요소의 슬롯도 부모 optional 판정에는 이미 세어진다(`resolve.js`와 같다).
- 문장이 하나도 없으면 출처 비율은 `0% / 100%`가 아니라 빈 값이라 막대 두 칸이 지워진다(없는 값을 만들지 않는다).
- 쪽 번호(README §11 ⑦ "표지를 뺀 본문 기준 1부터")를 **목차 01 · 발행 노트 02 · …**로 읽었다(장 번호 - 1, 표지 2종에는 폴리오 없음, 목차 쪽 번호도 같은 기준). `04`는 두 자리 글자이고 글자 사이 `.3em`은 CSS가 벌린다(`0 4`로 쓰지 않는다). 55-2는 장 번호(표지 1)를 썼다 - 이 해석이 PM 뜻과 다르면 `compose.py` 한 곳(`first_page`·`page`)만 고친다.
- 목차 설명(README §11 ①): 데이트 아카이브는 `summary.dateCount`(없으면 재소환 뺀 기사 수), 이달의 우리는 `theme.headline`이 비면 그 조각만 뺀다.
- 시각 `hhmm`: `9:05`·`14:20:00`·ISO 시각을 `HH:MM`으로, 모양이 아니면 **있는 그대로** 둔다(값을 지어내지 않는다). `.seq`: 가장 작은 `seq`가 0이면 +1, 아니면 그대로(저장된 content는 0부터).
- 근거 날짜 `08.22`: 재소환 기사(`recalled`)의 `dateOn`과 같은 날짜, 또는 이 호의 연도와 다른 해만 `2025.08.20`처럼 연도를 붙인다.
- `@da.openerPhoto` = 대표 기사 전체 stop을 편 첫 사진(`first_photo_any`). `choose_variant`는 `with-photo`/`type-only` 한 쌍을 지면으로 가른다(`da-opener`는 `da.openerPhoto`, `sw-opener`는 `sw.openerPhoto`). 표지 사진 사슬은 그대로.
- 인용면 나눔(`pack_quotes`): 대화 높이 = 113 + 64 x 턴 수 + 35자를 넘는 줄마다 22px(원문 줄바꿈마다 새 줄). README §12 표의 12·30·60·100자 열과 ±2px로 맞고, **160자 열은 표(4줄)보다 크게 잡는다**(35자/줄 규칙으로 5줄 - 실측 렌더는 들여쓴 발화가 5줄, 아닌 발화가 4줄이라 표와 5줄 규칙 사이). 가용 높이 844px, 단문 3개 이상이면 마지막 면만 781px, 한 대화가 가용 높이를 넘으면 `ComposeError`(호 · 대화 · 높이). **`SW_QUOTES_PER_PAGE = 2` 규칙은 없앴다** - 높이로만 나눈다(CORNER_LAYOUT §3-3 "최대 2개"보다 README §12가 새 원본).
- 타임라인(`stop_height`): README §5 표 + 첫 메모가 50자를 넘으면 50자마다 +29px(올림). **README §12 표의 200자 열(506px)은 이 규칙(477px)보다 29px 크다 - 긴 메모는 규칙이 작게 잡는다**(디자인 확인 거리). 한 구간만으로 953px을 넘으면 `ComposeError`(구간을 쪼개지 않는다). 두 면에 못 드는 구간을 노트 "싣지 않은 것"에 적는 55-2 동작은 그대로(원문을 줄이는 것이 아니라 싣지 않는 것).
- 표지 이 달의 말(`render_issue.settle_cover`): 표지를 한 번 열어 이 달의 말 줄이 판면 밖이거나 다른 글자 상자와 겹치면 `quote`·`quoteBy`를 비워 줄째 지운다. **표제가 이 달의 말(원문)로 바뀐 표지**가 `clamp`에 잘리면 원문을 자르지 않고 나뉘지 않은 이달의 우리 표제로 되돌린다(그것도 없으면 비움). 결과는 `compose.json` 보고(`coverQuoteRemoved`·`coverHeadlineFrom`).
- 원문 `clipped`: 검사가 잘린 요소의 `data-slot`을 남기고(`slot`), `.userNotes[0].text`·`.text`·`.evidence`·`@cover.quote`(와 표제가 이 달의 말인 표지의 `@cover.headline`)가 잘렸으면 `render_issue`가 업로드 전에 멈춘다. 온도록 문장이 잘린 것은 `audit.json`의 `recordedClipped`에 기록. v1.2.2 지면에는 원문 칸에 clamp가 없어 실제 렌더에서는 원문 clipped가 0이다.
- 출력: 렌더·시드 출력에서 프로젝트 ref 줄을 뺐다(`접속 대상: 개발 프로젝트 ondolog - 확인됨`). deno 발행 출력은 `55-3-run.ps1`의 필터가 ref를 지운다.
- 시험 호: `render/seed_render_tests.py`에 세트 인수(`run 55-3`)를 더했다(`55-2` 세트는 기본값 그대로). 4권 = photos(basic)·opener(night)·long(ondol)·overlong(ondol, 렌더가 멈춰야 함). 저장 스키마는 Deno로 12개 모두 통과. 로컬은 `render/local_volumes.py`(출력 `render/out/55-3-local/`, git 무시).
- Python 시험: 122 → 173 → 186 (`scripts/ops/out/55-3-python-r48.txt`, R48 추가 수정 뒤; 173은 `55-3-python-tests.txt`). 기존 시험 변경 - `test_clipped_text_is_recorded`(인용 turn이 `clamp3`에 잘려 `clipped`를 기대) → 둘로 나눔: 온도록 문장(이달의 우리 표제)이 넘치면 `clipped` **기록**, 원문 칸이 잘리면 **실패**(`original_clipped`) + 한 대화가 한 면을 넘으면 `ComposeError`; `Order`의 쪽 번호 시험 둘과 `ThisMonth.test_evidence_line_rules`는 확정값(쪽 번호 · `09.12`)으로 갱신.

R48 추가 수정 (2026-11-01) - 디자인 v1.2.3 전 임시 규칙과 확인 거리:

- 임시 ①: `da-article` 히어로 원천(첫 구간 첫 사진)이 없으면 `ComposeError`(호 · 몇 번째 기사 · 사유) -> 렌더 `멈춤`. ②: 사진 캡션 = 그 구간의 첫 유저 메모(첫 사진에만), AI 캡션 안 실음. 이에 따라 비대표 기사 사진 아래 메모도 오프너 메모 수(재소환 제외) · 발행 노트 게재 수(재소환 포함)에 세고 "싣지 않은 것"에서 뺀다. ③ safe 위반은 기록만(기존 동작) ④ 날짜 표기 현 값 유지. v1.2.3에서 디자인이 확정하면 `compose.article_photos`만 고친다.
- R48-6: `data-width` 문자열 `34%`는 요소 제거. 발행 노트 막대는 지면이 폭과 글자를 같은 경로로 맡기므로 `PageSpec.widths`(경로 -> 숫자)를 따로 건넨다(`resolve.js`의 `cfg.width` / `cfg.text` 분리와 같은 역할). 디자인이 막대를 다른 경로로 나누면 이 매핑은 필요 없어진다. 이 해석이 PM 뜻과 다르면 `slot_fill.fill(widths=)` · `compose._note_values` 두 곳.
- R48-4 -> R49-1 결과: 긴 타임라인 메모(400자 둘) 호는 어림 합 944px < 상자 953px라 한 면에 몰렸으나 실제 구간 합 1060px(내용 1061px)라 넘친다. R48 시점에는 렌더가 통과했으나(검사가 overset을 기록만) R49-1로 **원문 필드가 든 상자의 overset은 렌더 실패**가 됐다: `page_audit.mark_original_overset` · `original_overset`(원문 슬롯 목록 `ORIGINAL_SLOTS` 한 곳, 원문 clipped와 같은 표시) + `render_issue.gate_failure`(render_issue와 local_volumes가 같은 함수). 온도록 문장만 든 상자의 overset은 기록만. 로컬 vol4 = 멈춤(5쪽 da-timeline 상자 `ab col` 내용 1061px / 상자 953px, 원문 슬롯 `.userNotes[0].text`), 멈춤 경로는 audit.json을 쓰기 전에 멈춰 audit.json · PDF가 남지 않는다(원문 clipped와 같은 기존 동작; 운영자가 audit을 보고 싶으면 별도 결정). 통과해야 하는 vol1 · vol2 · vol2b · vol3은 원문 상자 overset 0. **남은 것: 원격 memo 호(`test-55-3-memo`)가 종료 코드 2 + 사유로 멈추는지 `55-3-run.ps1` 실행(사람) 확인 - 관문(R29-2)은 2부 통과로 열린다(R49-1).** 어림 규칙 자체(메모 50자 29px)는 디자인 v1.2.3에서 고치되 이 규칙은 안전망으로 남는다. R49-2(`PageSpec.widths`) · R49-4(비대표 기사 메모 게재, 오프너 사진 1장 차이) 받음.
- 시드 `test-55-3-memo`는 `55-3-run.ps1` 3)에서 렌더만 하고 5) 발행에는 넣지 않는다. 실행은 사람.

막힌 슬롯 - 지면 HTML을 고쳐야 한다(`render/issue/`는 고치지 않았다 - 디자인 세션 몫):

1. `da-article.html` 히어로 사진: `payload.articles[i].stops[0].photos[0].path` 한 경로뿐, `data-optional`·변형이 없다. 첫 stop에 사진이 없으면 사진 없는 `<img>`가 빈 회색 틀로 남는다(`broken-image`). 오프너처럼 기사 전체 첫 사진 폴백 + 틀 삭제가 필요하다.
2. `da-article.html` 사진 캡션: README §11 ⑥은 "라벨 한 줄 + 문장 한 줄"인데 지면에는 `AI 캡션` 라벨 줄이 없고 견본 글자에 옛 접두(`AI 캡션 · …`)가 남아 있다. 렌더러는 접두 없이 문장만 넣는다(타임라인은 라벨 줄이 있어 맞다).
3. 하단 한 줄이 판면 하단(1047px)을 넘는다(`safe`): 목차 고지 · 발행 노트 `ONDOLOG` 표시 · 타임라인 경로 줄 · 인용면 고지 · 이달의 우리 마감 문장 · 뒤표지 하단 줄. 지면 HTML의 `bottom:62px`(등)이 판면 하단 여백 안쪽이다. 의도라면 규격 값(CORNER_LAYOUT §0-3b)을 고치거나 검사 예외로 정해 달라.
4. `sw-quotes.html` 단문의 `.attribution.at`(`08.11 23:40`)과 `@da.places .date`(`08.19`) 표기는 README에 규칙이 없다(§11 7건에도 없다). 렌더러는 시각 `HH:MM`·날짜 `MM.DD` 규칙을 따라 임시로 정했다.
5. README 쪽: §5·§12의 메모 보정 문장("50자마다 29px")과 §12 표(200자 506px)가 맞지 않는다. §12 인용 "한 줄 약 35자"와 표의 160자 열(4줄)도 어긋난다(위 결정 참고).

`55-2`에서 넘긴 남은 항목 처리: 막힌 슬롯 1(출처 막대) 해소(`data-width`) · 2(다정 지수) 해소(v1.2 지면) · 3(`da-article` 고정 문구 셋) 해소(러닝헤드 `data-if` · 영문 서수 · 사진 수 문장) · 4 해소(영문 서수 · `@da.openerPhoto` + 변형) 단 `da-article` 히어로는 위 1번 · 5 README 빈칸 중 `@toc.desc` · `.photo` · 근거 날짜 · `.seq` · 폴리오 · 캡션 접두는 §11로 확정, `attribution.at`은 위 4번 · 6 원문 잘림 해소(v1.2.2에서 clamp 제거 + 면 나눔/실패). "목차 매니페스트"라는 항목은 HANDOFF 55-2 절에 없다(지시서 예시로만 적혀 있다).

## PGlite 배치 시험 (`71b-`, 2026-11-04, db-architect) - 로컬 시험만, 원격 접속 0
- 시험 `__tests__/db/dissolutionBatch030.test.ts` · 헬퍼 `createMigratedDb()` (`scripts/db/pgliteMigrations.ts`) + 서버 `scripts/db/pgliteServer.mjs`. **배치 함수 · 마이그레이션 지시서는 이 틀에 시험을 더한다**(R54-2): `createMigratedDb({upTo})`로 001~N을 파일에서 읽어 적용하고 `db.query` / `db.exec`로 결과를 본다.
- 내부 결정: PGlite를 jest 안에서 불러오면 동적 `import()`가 `--experimental-vm-modules` 없이 실패(`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG`). jest 설정 · 실행 옵션을 바꾸지 않으려고 PGlite를 자식 Node 프로세스(`pgliteServer.mjs`)로 돌리고 문장을 표준 입출력(JSON 줄)으로 보낸다. 시험 파일 머리 `@jest-environment node` 주석만 사용. 날짜 값은 JSON을 거쳐 ISO 문자열로 돌아온다.
- 내부 결정: 스텁 = 역할 3개 · `auth`(users · uid · role) · `extensions` · `storage`(buckets · objects · foldername) · `cron`(job · schedule: 기록만, 실행 안 함) · publication `supabase_realtime` · public 기본 권한. 읽은 마이그레이션 본문에서 `create extension ... pg_cron` 한 문장만 메모리에서 뺀다(파일은 그대로). pgcrypto · pg_trgm · btree_gist는 PGlite contrib로 실제 설치.
- 내부 결정: `71-`의 34단언을 34개 `it`로 옮김. (c) 첫 단언은 `cron.job.command`에 `run_due_dissolutions`가 들어 있는지를 한 줄 더 확인(개수는 그대로). (b) 마지막 단언은 날짜를 문자열로 받으므로 `Date`로 바꿔 비교.
- 내부 결정: (d) 마지막 단언(013 · 030 본문이 한 줄만 다름)은 파일 본문을 줄 단위로 비교하는 것이라 SQL 실행 시험이 아니다(R32-3과 긴장). 34단언을 빠짐없이 옮기라는 지시에 따라 남겼다 - PM이 빼라 하면 한 `it`만 지운다.
- `npm test`는 `jest --watchAll`(package.json, 바꾸지 않음)이라 한 번 돌리려면 `npx jest --watchAll=false`.
- `verifyPurge68.ts`: 개시자 `biometric_consent_revoked_at` 기대 = `biometric_consent_at`이 있으면 채워짐, 없으면 null. 출력은 null 여부만. 원격에서 실행하지 않았다(Proteur 몫).

## 해제 배치 결함 030 (`71-` 1부, 2026-11-03, db-architect) - 작성만, 원격 미적용 · 미실증
- 래퍼 함수 선택(`run_due_dissolutions`, DO 블록 아님): cron 이 실행하는 문장이 `select public.run_due_dissolutions();` 한 줄이라 로컬 시험이 `cron.job.command` 를 그대로 실행할 수 있다. 025 분류 1 로 public · anon · authenticated · service_role 모두 회수.
- 새 `ops_alerts.kind` = `dissolution_failed`. 제약 이름 `ops_alerts_kind_check`(022 열 인라인 check 의 기본 이름, 로컬 pg_constraint 로 확인) drop 후 같은 이름으로 세 값 check 추가. 원격 제약 이름은 2부에서 확인.
- 실패 알림 detail 은 dissolution_id · sqlstate · constraint · message(SQLERRM 앞 120자) 네 키만. PG_EXCEPTION_DETAIL 없음. 알림 insert 자체가 실패하면 raise warning 으로 넘어가 다음 건을 계속한다.
- 계속 실패하는 건은 매일 05:00Z 마다 알림 한 행씩 더 쌓인다(중복 제거 안 함, 기록이 곧 재시도 횟수). 필요하면 PM 판단.
- cron 교체는 014 와 같은 `cron.schedule(같은 이름, ...)` 갱신 방식(pg_cron 은 같은 jobname 이면 갱신). 2부에서 `cron.job` 에 이름 하나뿐인지 확인.
- 개시자 철회 시각은 동의 시각 없으면 null(기존 값이 있어도 제약상 null 이었음), 있으면 `coalesce(기존, now())`. 본문 나머지 한 글자도 안 바꿈(로컬에서 013 본문과 줄 비교).
- 로컬 시험은 PGlite 를 저장소 밖 임시 폴더에 설치해 실행(저장소 의존성 추가 0). 실패 장치 = 시험 안에서만 만든 `couples` BEFORE UPDATE 트리거(23514, constraint test_only_boom, DETAIL 에 가짜 행 값).
- `scripts/db/check_cron_failures.sql`(R53-5) 읽기 전용 SELECT. `src/types/database.ts` 에 `run_due_dissolutions` 수동 추가(원격 미조회라 재생성 못 함).

## description_ko 029 (`70-` 1부 이어서, 2026-10-27, db-architect) - 작성만, 원격 미적용 · 미실증
- 029 는 `update … where code` 36줄만(멱등). 문구는 `docs/ONDOLOG_36_descriptions.md` 에서 `**` 만 뺀 것 = 020 과 글자 단위 같음(jest 가 셋을 대조).
- 원격 `schema_migrations` 에는 적용 시각 칸이 없다(version · statements · name). 시각 비교 대신 statements 와 파일 비교(공백 · `;` 제거 md5)만 썼다.
- 로컬 확인은 PGlite(저장소 밖 임시 폴더) - `014_cron.sql` 은 pg_cron 이 없어 하네스에서만 실패(스텁으로 대체), 나머지 001~029 통과.
- 사람 순서: `check_029_preapply.sql` -> `supabase db push` -> `verify_029_privileges.sql`(10번 = 적용 전 9번) -> `verifyDescriptions70.ts` -> get_advisors 저장 -> `compareSecurity.ts`. 명령은 `scripts/ops/out/70-run.ps1`.
- 타입 재생성: `description_ko` 는 이미 `database.ts` 에 있어 스키마 변경 0 기대(새 칸 · 테이블 없음).

## 연애유형 라벨 028 (`69-` 1부, 2026-10-27, db-architect) - 작성만, 원격 미적용 · 미실증

- 028 = `love_type_labels` 36행 upsert + `assessments_insert` with check `seq = 1`. 원격 적용 · 실증은 사람(규칙 6).
- 내부 결정: 시드 파일은 없었다(원인은 "적용된 016 을 나중에 고친 것"). 016 은 고치지 않고 두며, 016 · 028 · MASTER 10-5-2 · `loveTypeLabels.ts` 가 같은 36행인지 `__tests__/constants/loveTypeLabelsSeed.test.ts` 가 대조한다(③ 의 "대조 시험" 쪽 선택, 공용 파서 `scripts/ops/labelsMaster.ts`).
- 내부 결정: 028 은 description_ko 를 건드리지 않는다. **원격 description_ko 는 36행 전부 null 로 남는다**(020 이 0건 갱신된 채) - 채우려면 020 의 UPDATE 를 새 마이그레이션(029 후보)으로 다시 내야 한다. 이번 범위 밖, PM 판단 필요.
- 내부 결정: 보안 점검 비교는 `scripts/ops/securityCompare.ts`(순수) + `compareSecurity.ts`(Deno CLI), 경고 이름 + 대상 이름 기준. `verifyDissolution68.ts` 의 `compare` 는 고치지 않았다(028 뒤에는 이 CLI 를 쓴다).
- 알림: `verifyDissolution68.ts` ⑱ 의 준비(사용자 세션 seq 2 INSERT)는 028 적용 뒤에는 거부된다 - 그 시나리오는 `verifyLabels69.ts` ②(service_role 준비)가 대체한다. 68 스크립트를 028 뒤에 다시 돌리지 않는다.
- 앱(`src/` · `app/`)은 이 표를 읽지 않고 상수 `LOVE_TYPE_LABELS` 를 쓴다. 표를 읽는 곳은 027 `fn_complete_retest` 복구 경로뿐(표가 비면 P0002).
- 사람 순서: `check_028_preapply.sql`(11번 값 적어 두기) -> `supabase db push` -> `verify_028_privileges.sql`(13번이 11번과 같은지) -> `verifyLabels69.ts` -> get_advisors 저장 -> `compareSecurity.ts`.

## 공통 상태 · H19 · 앱 손질 (`72-`, 2026-11-04, ui-builder) - 내부 결정

- 보드 위치: `docs/design/nocturne/screens/{I01..I06,H19,H14,H16,A18}.jpg` · `docs/design/nocturne/nocturne/canvas/N-R43-App-States.dc.html`(patch7) · `docs/design/nocturne/canvas/N-R44-Voice.dc.html` + `CHANGES_patch8.md`(patch8). 보드와 지시서가 다른 곳: H19 보드의 "· 최신"과 "오픈소스 라이선스"는 지시서대로 뺐다.
- I02 감지: 새 의존성 없이 `supabase.ts`의 `global.fetch`를 `trackConnection`으로 감싼다(네트워크 오류로 던지면 끊김 · 응답이 오면 5xx도 풀림 · AbortError 무시). 새 요청을 만들지 않는다 - 풀리는 시점은 다음 요청 성공(앱 복귀 때 `useDissolutionNotice` 읽기, 채팅 큐 재시도).
- I02 띠: `(tabs)/_layout`에 한 개. 채팅 큐에 `pending`이 있는 동안 숨긴다(채팅 F05 문장이 "보낼 것"을 말하고 띠는 "받은 것"을 말한다).
- I05 구성: 대화 상자는 기존 `ConfirmDialog`(기록 삭제 `date/[id]`), 문구 입력은 새 `PhraseConfirm`(H14 · H16). 확인 동작(함수 · 순서 · 지우는 대상)은 그대로.
- H14 한 화면: 보드 ⓖ가 안내 + 문구 입력 한 화면이라 옛 2단계(`unlink-next`)를 없앴다. 안내 문장도 보드 ⓖ 문장으로.
- 확인어: `UNLINK_PHRASE = '해제합니다'`(옛 `연결 해제합니다` 폐기, 입력하는 확인어라 해요체 정리 대상 아님).
- H14 상대 쪽: 주어는 `nameWithSubject`(받침 이/가, 한글 아닌 끝글자는 `님이`) - 옛 `~님이` 대체. 빈 버튼 자리에 "취소는 요청한 사람만 할 수 있어요."(patch7 ⓔ).
- I01: `CoupleGate` 기본 면을 I01 보드 모양(손잡이 · 두 원 · 문구 · 초대 코드 보내기 · 받은 코드 입력하기)으로. 두 버튼은 `/couple-gate?from=gate`(`&step=enter`)로 가고 시트가 I01 문구를 쓴다.
- I04: 피드 빈 상태를 I04 보드(`EmptyState`)로. 버튼은 보드처럼 화면 하단 고정이 아니라 문구 아래 인라인 - 실기기에서 보고 정한다.
- I06: 토스트 알약 = `text` 면 + `ink` 글자, 글자 버튼 색 `#5B4A9A`(보드에서 눈으로 뽑은 값, 토큰 없음 - 디자인 확인 필요). 사라지는 시간 3000ms(보드에 값 없음). 루트 + `(modals)` 층에 한 개씩 붙이고 가장 나중에 붙은 것만 그린다.
- I06 이전 목록: biometric-consent 2 · reference-photo 2 · upload 3 · chat 3 · date 상세 1 · stop 1 · InvitePanel 2. 두 번째 인자(`e.message` 원문)는 토스트에 싣지 않는다. 버튼이 있는 확인(BiometricConsentPanel 철회)은 `Alert` 그대로.
- H19: 버전은 `expo-constants`의 `expoConfig.version`(이미 의존성). 문의는 `Linking.openURL('mailto:')`, 열 수 없으면 토스트에 주소. H01 항목은 보드 H02대로 ETC 그룹 "앱 정보 · 문의"(값 = 버전).
- B01 보조 문구: 앱에 이전 상수도 화면도 없어 `src/constants/mainCopy.ts`에 해요체 상수만 만들었다(화면에는 아직 안 그림 - 노출 조건 판정이 숨어 있음).
- A18: 자기 코드 문구만 patch7로. 보드의 "그 밖의 무효"(`쓸 수 없는 코드예요. 상대에게 코드를 다시 받아 주세요.`)와 앱의 `invalid` 문구(`연결할 수 없어요. 코드를 다시 확인해주세요.`)는 다르다 - 바꾸지 않고 보고.
- `chatPhotoQueue`: 저장소가 비었다고(마이크로태스크) 화면 상태(React가 다음 틱에 반영)를 바로 읽던 시험 3곳을 상태 기다림으로. 앱 코드는 정상. 같은 시험을 40번 되풀이하면 10번 흔들리던 것이 60번 되풀이에서 0.

## U7 해제 · 탈퇴 앱 (`68-` 1부, 2026-10-26, ui-builder) - 원격 미적용(027 대기), 회귀 스크립트 작성만, 실기기 미확인
- 내부 결정: **연결 해제 문구**는 보드 · MASTER에 없어 H16 보드 형식으로 `연결 해제합니다`로 정함(`src/utils/dissolution.ts` `UNLINK_PHRASE`) - PM이 다른 문구를 원하면 한 줄. 탈퇴 문구는 보드 `탈퇴합니다`.
- 내부 결정: **상대가 해제를 처음 보는 곳** = 탭이 열릴 때 · 앱 복귀 때 `useDissolutionNotice`가 상대(개시자 아님)에게 커플 화면(`/settings-couple`)을 한 번 푸시(해제 id당 앱을 켠 동안 한 번). 설정 > 연인 줄로 언제든 다시 본다. 푸시 알림 없음.
- 내부 결정: 상대 쪽 유예 화면은 보드가 없어 개시자 화면에서 [취소]를 뺀 형태 + 문장만 상대 시점(`서영님이 연결 해제를 요청했어요`, 탈퇴로 생긴 해제는 `탈퇴를 요청했어요`). 탈퇴로 생긴 해제(reason = withdrawal)는 개시자 화면에도 [취소]를 두지 않는다(027 22023, 탈퇴 취소로만 되돌림).
- 내부 결정: 탈퇴 유예 화면(`withdraw-cancel`)은 보드가 없어 H14 유예 화면 형식 + [로그아웃] 보조 버튼(나갈 길이 없으면 갇힘 - 보드에 없는 추가이니 PM 확인). 취소 뒤 `resolveResumePath`로 원래 진행 단계.
- 내부 결정: 해제 요청 화면은 보드가 없어 `settings-unlink` 한 화면 안에서 안내 -> 문구 입력 두 단계(H04 힌트 · H14 · H16 문장 재사용). PDF 저장 안내 줄은 매거진 탭으로 간다(`pdf_print_path` 참조 없음).
- 내부 결정: 재검사 복구(`out_recovered = true`)는 안내 화면 `이전에 하던 재검사를 마저 저장했어요 / 방금 답한 내용과 저장된 결과가 다를 수 있어요` + [확인] -> H05.
- 내부 결정: 남은 날짜는 서버 `purge_scheduled_at`의 KST 달력 날짜 차이(요청 직후 7일), 0이면 `오늘`. 보드의 "밤 12시"는 서버 값(요청 시각 + 7일)과 맞지 않아 날짜만 쓴다.
- 내부 결정: H16 보드의 "남는 것" 두 줄 · "연결도 함께 해제돼요"는 커플일 때만 그린다.
- 생체정보 진입점(§5): 조사 0-a대로 앱 코드에 `biometric-consent` · `reference-photo`로 가는 router 호출 · 링크가 없어 숨길 것이 없었다(화면 파일 그대로, 딥링크로만 닿음).
- `src/types/database.ts` Functions에 027 함수 5개를 수동으로 더함(생성 파일이라 원격 적용 뒤 타입 재생성하면 같은 모양으로 덮인다). `scripts/ops/verify67Settings.ts`의 재검사 단계는 새 함수 시그니처로 맞췄고 **027 적용 뒤에만** 맞다.
- 열린 문제(027 파일 - 고치지 않음): `fn_complete_retest` 복구 경로는 원격 `love_type_labels`가 0행이라 라벨 시드 전에는 P0002(db-architect 보고와 같음). 앱은 그 경우 `failed`(다시 시도)로 보인다.
- `51-` 실기기 확인에 더할 것: 25가지 + "연결 해제 요청 -> 양쪽 유예 화면 -> 개시자 취소" + "회원 탈퇴 -> 유예 중 다시 로그인 -> 탈퇴 취소" = **27가지**.

## 해제 · 탈퇴 · 재검사 027 (`68-` 1부, 2026-10-26, db-architect) - 작성만, 원격 미적용 · 미실행
- 내부 결정(SCHEMA 9-G 표에 없던 것, 마이그레이션 주석에도 있음): 함수 이름 `fn_request_dissolution` · `fn_cancel_dissolution(uuid)` · `fn_request_withdrawal` · `fn_cancel_withdrawal` · `fn_complete_retest(21인자)`, 트리거 함수 `tg_profiles_onboarding_step_guard`.
- 해제 요청은 couples를 active · dissolving에서 잠근다 - 진행 중 해제가 있으면 23505, 아니면 active가 아닐 때 P0002(표 그대로 active만 잠그면 재요청이 23505가 아니라 P0002가 된다).
- 해제 취소: 개시자 확인(42501)이 멱등 확인보다 앞, 이미 취소됨은 조용히 반환, 이미 실행됨은 22023, **탈퇴로 생긴 해제(reason withdrawal)는 22023으로 거부**(탈퇴는 그대로인데 커플만 active로 돌아가는 불일치 방지 - 탈퇴 취소 몫). PM 확인 필요.
- 탈퇴 요청: 커플이 dissolving이면 새 해제를 만들지 않는다. 반환 = purge_scheduled_at. 탈퇴 취소: 유예가 끝났으면(purge_scheduled_at <= now) 22023, 탈퇴로 생긴 진행 중 해제만 취소하고 직접 요청한 unlink 해제는 둔다.
- 재검사 반환 = (out_assessment_id, out_recovered). out_recovered true = 기존 seq 2 행으로 마저 끝냄(인자 무시). 복구 경로의 love_type_code는 `love_type_labels`(enneagram_core, attachment)에서 읽는다 - **원격 개발 love_type_labels가 0행이라(016은 적용 기록 있음) 복구 경로는 라벨을 다시 넣기 전에는 P0002.** 정상 경로는 라벨 표를 읽지 않는다. 재검사는 `override_count` · `override_updated_at`을 건드리지 않는다(옛 앱 코드와 같음).
- `personality_assessments`의 INSERT 정책은 그대로라 클라이언트가 seq 2를 직접 넣을 수 있다(그 뒤 함수 복구 경로가 그 값으로 끝낸다). 9-G가 요구하지 않아 안 막았다.
- `marketing_agreed_at`은 칸 단위로 열었지만 앱이 UPDATE하는 곳은 아직 없다(설정 화면 몫).
- 앱 쪽 전환(ui-builder 몫): `src/services/settingsCore.ts` `retestPersonality`(직접 INSERT + UPDATE) -> `fn_complete_retest`. 027 적용 뒤 옛 UPDATE는 거부된다. 해제 · 탈퇴 화면은 함수 호출.
- 조사: 생체동의 화면(`biometric-consent` · `reference-photo`)으로 가는 앱 내 진입점 코드는 없다(파일 기반 라우트라 딥링크로만 닿음). 생성 파이프라인은 MBTI를 읽지 않는다. `generateIssue.ts:155`가 active만 허용, `fn_publish_issue`도 active만(022:123). `scripts/ops`에서 onboarding_step을 낮추는 곳 없음.

## U7 설정 필수 1부 (`67-`, 2026-10-26, ui-builder) - 원격 실증 스크립트 작성만(실행은 사람), 실기기 미확인

내부 결정(항목당 한 줄):
- 설정 하위 화면 경로는 R18-2대로 루트 Stack 평면 파일: `settings-profile` · `settings-couple` · `settings-personality` · `settings-privacy`(`app/settings/` 디렉터리는 탭 `/settings`와 겹쳐 피했다). 확인 시트(H06)는 `RetestConfirm` 모달.
- 목록 표는 `src/utils/settingsRules.ts` `SETTINGS_GROUPS`(갈 곳 있는 항목만) + `HIDDEN_SETTINGS_ITEMS`(숨긴 것과 이유). 보드의 OUR SKY 토글 · 발행물 테마 · 마케팅 토글 · 사진 바꾸기 · 옛 테마 행도 숨겼다(지시서 범위 밖 · 저장할 칸 없음).
- 옛 설정 탭의 생체정보 동의 · 대표사진 행도 숨겼다(지시서가 H12 · H07을 숨기라고 함). `(modals)/biometric-consent` · `reference-photo` 화면은 남아 있으나 **설정에서 들어갈 길이 없다 - 동의 철회 길을 PM이 확인할 것(MASTER 철회 가능 원칙).**
- A20 재표시: 탭 레이아웃 `useStartDateRecheck` - 탭이 열릴 때와 앱 복귀(AppState active)마다 내 커플 행을 읽어 `needsStartDateConfirm`이 참이면 `start-date?recheck=1`을 푸시(같은 값은 한 번만). 그 길은 `start_date_confirmed_by`만 쓰고 `onboarding_step`은 쓰지 않으며 `dismissTo('/main')`으로 돌아간다.
- A20 화면에 보드 문장 "날짜가 다르면 설정 > 커플에서 함께 고칠 수 있어요"를 넣었다(H04가 생겨 사실이 됨). `u6Onboarding2.test.tsx`의 "그 문장이 없다" 단언 한 줄을 "있다"로 바꿨다.
- 재검사 길은 A04~A07(`mbti`·`love-quiz`)에 `?retest=1`만 얹어 재사용: 메모리(`sessionStore`)에서 풀고, 마지막 문항 뒤 A08 대신 `useRetestFinalize` -> `settingsCore.retestPersonality` -> 성공하면 `dismissTo('/settings-personality')`. 화면에 새 결과 화면은 만들지 않았다(H05 카드가 새 결과).
- 재검사 새 행 키: `personality_assessments`의 `unique (user_id, seq)`(`004_personality.sql` 37행) + `seq in (1, 2)`(8행). 재검사는 `seq = 2` 고정 - 이미 2번째 행이 있으면 `23505`이고 **이 경로에서 실패**(`RetestError('duplicate')`, 프로필 UPDATE 안 함). 가입 저장의 "23505 = 성공"은 `createProfileAndAssessment` 안에만 있다.
- 재검사의 `personality_profiles` UPDATE는 `.eq('retest_used', false)`를 걸어 다른 기기가 먼저 썼다면 0행 -> 실패. `override_count` · `override_updated_at`은 쓰지 않는다(이력 보존). `enneagram_effective`는 생성 칸이라 쓰지 않는다.
- **알려진 한계(PM 판단 필요)**: INSERT는 성공했는데 그 뒤 UPDATE가 실패하면(앱 종료 · 네트워크) `retest_used`는 false로 남고 seq 2 행이 이미 있어, 다음 재검사는 `23505`로 영영 막힌다(assessment DELETE 정책 없음). 복구 경로는 서버 함수(027 계열)가 필요하다.
- `profiles.mbti`는 재검사 때 고치지 않는다(`profiles`는 이름 · 성별만 쓰는 표). 앱은 MBTI를 최신 assessment에서 읽어 영향이 없다.
- A14 · A16 설정 모드(`result-detail?source=settings`): `useResultDetail(userId, 'settings')`는 읽기만 하고(프로필 행을 만들지 않아 `onboarding_step`을 올리지 않음), `active_assessment_id`의 검사를 읽는다. `?view=override`면 A16부터, 저장하면 `router.back()`.
- H05 카드는 `MBTI · 애니어그램 N`까지 - 보드의 애착 이름("안정형")은 MASTER 10-5-3과 어긋나 넣지 않았다. H11의 "AI 데이터 활용 동의 - 동의함" 값 표시도 읽기 전용 값을 새로 만들지 않으려 빼고 "AI 활용 안내" 한 줄로 했다. 보드 H11의 "무료에서는 3개월이 지난 사진을…" 안내는 구독(H08)이 없는 지금 사실이 아니라 뺐다.
- H03 성별은 3칸 선택(남/여/기타)으로 고칠 수 있다(보드에 성별이 있어서). 프로필 사진 원(아바타)과 "사진 바꾸기"는 그리지 않았다.
- H04 사귄 날짜 입력 아래 "저장하면 상대가 다음에 앱에 들어올 때 날짜를 확인해요" 한 줄은 이 작업이 쓴 문장(보드에 없음) - 디자인 세션 확인 요청.
- 로그아웃 뒤 `router.replace('/')`로 시작 화면에 간다(옛 설정 탭은 세션만 끊고 이동하지 않았다). 큐 저장은 지우지 않는다.
- `personalityCore.ts`에 `buildAssessmentInsert`(가입 seq 1과 재검사 seq 2가 같은 모양)를 뽑아 냈다 - 동작 같음(`personalityCore.test` 통과).

## 커플 연결 앱 전환 (`66-` 1부, 2026-10-26, ui-builder) - 원격 미실행, 실기기 미확인

- 내부 결정: A18 오류 문구 - 보드에는 "이미 다른 사람과 연결된 코드는 쓸 수 없어요"(23505) 하나뿐이라 그 원문을 쓰고, P0002는 기존 앱 문구 "연결할 수 없어요. 코드를 다시 확인해주세요.", 22023은 보드에 문구가 없어 자리표시자 "내가 만든 코드는 쓸 수 없어요"(PM 확인 필요).
- 내부 결정: `redeemInviteCode` 반환을 `CoupleRow | null`에서 `CoupleRow`(실패는 `ConnectCoupleError` 던짐)로 바꿨다. RPC는 id만 돌려줘 연결 뒤 구성원으로서 행을 읽는다. 호출 화면 셋(A18 `invite.tsx` · `InviteSheet` · `InvitePanel`)의 null 분기를 오류 처리로 교체.
- 내부 결정: `src/types/database.ts`에는 아직 `fn_connect_couple`이 없다(생성 파일, 026 적용 뒤 재생성). 그동안 `ConnectDb`(rpc만 가진 좁은 타입)로 호출. 재생성 뒤 캐스트 제거 가능.
- 내부 결정: `love_type_code`는 저장(오버라이드와 같은 UPDATE) + 표시(A14 · 메인이 실효 코어 + 애착으로 엔진 함수를 다시 계산) 양쪽. 이미 잘못 저장된 원격 시험 데이터(RHF)도 화면에서는 맞게 보인다. 저장값은 다음 오버라이드 때 바로잡힌다.
- 내부 결정: 실증 스크립트 출력 `66-u6-part2.txt`, 시험 계정 접두 `test-66-`, 23505 확인용 계정 C 추가(초대 코드만 만든다). 초대 발급 · 사귄 날짜 저장 두 질의는 여전히 미러(앱 전역 supabase에 묶임).
- 생성 칸 전수: `004_personality.sql:63 personality_profiles.enneagram_effective` 하나뿐. 클라이언트 쓰기에서 쓴 곳은 `personalityApi.ts` `ensurePersonalityProfile` 한 곳(고침). 스크립트의 대체 경로(effective 제외 재삽입) 삭제.
- 026 파일에서 고칠 점은 보이지 않음.

## 커플 연결 026 (`66-` 1부, 2026-10-26, db-architect) - 작성만, 원격 미적용·미실행
- 파일: `supabase/migrations/026_couple_connect.sql` · `scripts/db/check_026_preapply.sql`(적용 전) · `scripts/db/verify_026_privileges.sql`(적용 뒤, 18행) · `scripts/ops/verifyCoupleConnect.ts`(실증 1~11, 출력 `scripts/ops/out/66-couple-connect.txt`, `ONDOLOG_026_APPLIED=1` 없으면 멈춤). 보안 점검 기준선 `scripts/ops/out/66-security-baseline.json`.
- 내부 결정: 함수 이름 `fn_connect_couple(p_invite_code text) returns uuid`. `invite_expires_at` null = "만료 없음"(앱 발급 INSERT가 이 칸을 안 채움 - 사람 결정 R40). 앱이 쓰는 UPDATE 칸 다섯(`relationship_start_date`·`start_date_set_by`·`start_date_confirmed_by`·`nickname`·`reference_photo_path`)만 authenticated에 부여, `magazine_theme`은 부여 안 함(M4-5).
- 내부 결정: 원격은 anon·authenticated에 테이블 단위 UPDATE가 있었다(읽기 조회로 확인) -> 테이블 단위를 먼저 회수하고 칸 단위도 함께 회수한 뒤 다섯 칸 부여. 정책은 `alter policy`로 바꾼다(SELECT 정책 무변경).
- 내부 결정: 직렬화는 초대한 사람을 먼저 읽어(잠금 없이) 두 profiles 행을 id 순으로 잠그고, 잠근 뒤 같은 조건으로 행을 `for update`로 다시 잡는다. 멱등 확인은 잠금 앞뒤 두 번.
- 로컬 확인: PGlite(임시 폴더, 저장소 무변경)에 최소 스키마(005 couples + 기존 정책 + 원격과 같은 anon/authenticated 권한) 위로 026을 적용해 §9-F 경우를 확인했다(전부 기대대로). 두 SQL 파일도 같은 곳에서 실행(verify의 16번 FAIL은 최소 스키마의 profiles에 RLS가 없어서 - 하네스 한정).
- 사람이 할 일: 앱 쪽(`redeemInviteCode` -> rpc, `coupleApi.ts` 6~11줄 주석)은 ui-builder 몫. 앱을 먼저 바꾸고 026을 적용한다(적용하면 옛 직접 UPDATE가 거부됨). 적용 순서: 연결 확인 -> `check_026_preapply.sql` -> `npx supabase migration list` -> `npx supabase db push --dry-run` -> `npx supabase db push` -> `verify_026_privileges.sql`(전부 ok) -> `verifyCoupleConnect.ts run` -> 보안 점검 비교 -> `npx supabase gen types typescript --linked > src/types/database.ts`(함수 1개 추가 예상).
- 알려진 것: 초대 코드 입력 횟수 제한 없음(M4). `scripts/ops`의 service_role INSERT는 정책과 무관(고치지 않음).

## 큐 재개 시점 · U6 온보딩 2부 (`65-`, 2026-10-25, ui-builder) - 원격 실증 미실행(자동 모드 분류기가 원격 쓰기를 막음), 실기기 미확인

- 큐 재개(§0): 텍스트 큐 · 사진 큐 인스턴스를 `src/services/chatQueueHub.ts`(싱글턴 `chatQueueHub`) 한 곳이 갖는다. 루트 `useChatQueueResume`(`app/_layout.tsx`)이 로그인 + 커플 연결 확인 후 `attach`, AppState `active`에서 `kick`, 로그아웃·미연결에서 `detach`(타이머만 멈춤, 기기 저장은 안 지움). 채팅 탭 훅도 같은 `attach`를 부르고(같은 키면 무동작) `subscribe`로 화면 상태만 받는다 - 탭 진입 시 재개는 남았고 한 곳(허브)에서 관리된다. 같은 항목 동시 시도 0: 사진 큐는 원래 `inflight`가 있었고 텍스트 큐(`chatRetryQueue.ts`)에 같은 `inflight`를 새로 넣었다.
- 훅 시험 `chatPhotoQueue.test.tsx`의 "앱 재시작"은 이제 허브를 `detach`하는 것으로 흉내 낸다(프로세스가 죽으면 허브도 사라지기 때문).
- 큐 재개 경계: 커플 확인이 다시 도는 중(`status: loading`)에는 `detach`하지 않는다(`coupleStore.refresh`가 loading을 거치므로).
- A17: 보드는 코드가 처음부터 보이지만, 열기만 해서 커플 행을 만들지 않으려고 **[초대 코드 만들기]를 눌러야 발급**한다(`getOrCreateInvite`). 이유: 열 때마다 대기 코드가 생기면, 받은 코드를 입력하는 쪽에게 대기 코드가 남고(그 코드를 제3자가 쓰면 한 사람이 활성 커플 둘에 속할 수 있다 - 인덱스는 user_a · user_b를 따로만 막는다). 같은 이유로 발급한 사람이 상대 코드도 입력하는 경우의 위험은 기존과 같다(보고).
- A17 대기 쪽은 코드 표시 중 4초마다 `fetchExistingInvite`(읽기만)로 연결을 안다 - 실시간 구독은 새로 안 만들었다.
- A18 코드 칸은 6칸(생성 코드 길이). 오류 문구: 보드의 안내 문장은 항상 보이고, 무효(null) 때는 "연결할 수 없어요. 코드를 다시 확인해주세요."를 더한다.
- A19 날짜 입력은 "YYYY.MM.DD" 텍스트(A03과 같은 방식, 새 의존성 없음). 닉네임은 날짜를 먼저 정한 쪽만 쓴다(`saveStartDateAndNickname`). A20은 `setOrConfirmStartDate`의 기존 규칙(`coupleApi.ts` 133~152행)을 그대로 쓴다. 거의 동시 입력에서 늦은 쪽의 날짜가 적용되지 않으면 적용된 날짜를 A20으로 보여 준다.
- A16 오버라이드: 기존 `overrideEnneagramCore`가 `enneagram_effective`(생성 칸)를 쓰고 있었다 - 서버가 거부하는 쓰기였다. `personalityCore.overrideEnneagramCore`로 옮기면서 쓰는 칸을 override · count · updated_at 셋으로 줄였다.
- 보드와 다르게: A14·A15 고정 문장 MASTER 문장 · 보드의 "안정형"(애착 이름 노출, MASTER 10-5-3) 안 씀 · A14에 보드에 없는 ⑤ 애착 묶음 추가 · A16 부제에 스턴버그 추가 · A17 [복사하기] 없음(R37-4) · A20 "설정 > 커플에서 함께 고칠 수 있어요"는 그 기능이 없어 뺌 · 공유 버튼 없음(M3-6).
- A17 [솔로예요] = [나중에 할게요]와 같다: `completeOnboardingWithoutCouple`(진행 단계 3) 뒤 `/main`. 솔로 기록은 M4. 이미 발급한 코드가 있으면 그 대기 행은 그대로 남는다.
- 옛 코드 정리: `ConsentChecklist.tsx` · `ResultCard.tsx` · `__tests__/components/ConsentChecklist.test.tsx`(8건) 삭제. `LegalDocumentModal.tsx`는 `BiometricConsentPanel.tsx`(생체정보 동의, 출시 후)가 아직 써서 남겼다. 옛 테마를 쓰는 채 아무도 안 쓰는 컴포넌트(`Big5Bars` · `ScoreBar` · `SternbergTriangle` · `TypeLabel` · `CompatibilitySection`(시험 있음) · `InvitePanel` · `DateInput` · `ScreenContainer` · `PageHeader` · `Numeral`)는 범위 밖이라 안 지웠다 - 옛 테마를 지울 때 함께.
- 온보딩 라우트(`app/(onboarding)/`)의 옛 테마 import 0(`_layout.tsx`의 `useTheme`도 뺐다).
- `51-` 확인 목록(본문 파일은 저장소에 없다): 22가지 + "온보딩 2부(초대 -> 연결 -> 사귄 날짜, 두 기기)" + "채팅 탭을 열지 않고 재시작해도 큐 전송" = **24가지**.
- 원격 실증(§0 c `verifyU6Signup.ts` 재실행 · §6 두 계정 실증)은 실행하지 못했다 - 원격 쓰기(시험 계정 생성)를 자동 모드 분류기가 거부했다. 실행 권한을 주면 이어서 한다.

## 기존 계정 · 동의 문장 · 사진 영속 큐 (`64-`, 2026-10-25, ui-builder) - 원격 개발 DB 실증 완료, 실기기 미확인

- 파일: 동의 문장 `src/constants/consent.ts`(`AI_USAGE_HELPER`)·`app/(onboarding)/consent.tsx` · 기존 계정 `app/index.tsx`(A02 링크, 재개 분기)·`app/(onboarding)/{auth,consent}.tsx`·`src/hooks/{useSignupFinalize,resolveResumePath}.ts`·`src/store/sessionStore.ts`(`existingAccountPath`)·`src/utils/{onboardingRules,onboardingResume}.ts`·`src/services/{personalityCore,personalityApi,coupleApi,onboardingStepCore}.ts` · 사진 큐 `src/utils/{chatPhotoQueue,chatPhotoQueueRunner}.ts`·`src/services/{chatPhotoCore,photoQueueFs,photoQueueStore,chatApi}.ts`·`src/hooks/useRealtimeMessages.ts` · 실증 `scripts/ops/verifyExistingAccount.ts`(옛 `verifyU6Signup.ts`의 "다시 부름" 기대값을 r70 동작으로 고침).
- 내부 결정(항목당 한 줄):
  - `npx expo install expo-file-system`은 peer 충돌(`@react-native/jest-preset`)로 npm이 중단했으나 `package.json`에 `~57.0.7`이 이미 적혀 있었고, 알려진 이슈(CLAUDE.md)대로 `npm install --legacy-peer-deps` 한 번으로 `package-lock.json`을 맞췄다. 바뀐 파일은 두 개뿐(각 1줄), `app.json` 플러그인은 필요 없었다. 커밋 전 `npx expo install --check`는 사람.
  - 로그인 직후 분기의 규칙은 순수 함수 `decideAfterLogin`(existing / save / answers / consent). 프로필이 있어도 메모리 답·동의가 온전하고 **검사 행만 없으면** 저장 경로로 끝까지 간다(우리 쪽 저장이 중간에 끊긴 흔적 - R38-3 d의 "일부만 들어간 상태"를 화면 재진입에서도 잇기 위해). 이때만 `fetchLatestAssessment`를 더 읽는다. 완성된 기존 계정은 저장 호출 0.
  - 프로필 없음 + 답은 있는데 동의가 비면 A03이 아니라 A10부터(`/consent`). 답이 비면 A03(`/basic-info`)부터. 둘 다 로그인한 채다.
  - 로그인한 채 A10에서 [동의하고 시작하기]는 A11을 건너뛰고 `useSignupFinalize(auto: false).start()`로 저장한다. 실패하면 A11과 같은 문장 "저장하지 못했어요. 다시 시도해주세요."를 버튼 아래에 보이고, 버튼을 다시 누르면 재시도한다.
  - 이미 계정 길의 A11은 부제를 "이미 가입한 계정으로 로그인해요."로 바꾸고 하단 안내(동의 유지)를 숨긴다 - 기존 문장("방금 본 결과가 계정에 저장돼요")이 사실과 달라서. Part 9 화면 문구라 디자인 세션이 확인할 것.
  - `app/index.tsx`는 앱을 열었을 때 이미 로그인돼 있던 경우에만 재개 분기를 탄다(`startedLoggedInRef`). 스택 아래에 남은 A01이 A11 로그인 직후의 세션 변화를 보고 `/basic-info`로 갈아치우며 저장·분기와 다투는 길을 막았다(63- 때부터 있던 잠재 결함).
  - 진행 단계 갱신은 `advanceOnboardingStep`(`update ... where id and onboarding_step < step`) 하나로 모았다. 같은 값·작은 값은 0행 갱신이고 오류가 아니다. 가입 직후 0은 새 프로필을 넣을 때만 정해진다(이미 있는 프로필은 insert가 23505라 건드리지 않음).
  - `onboarding_step`을 쓰는 곳(클라이언트): `personalityCore.ts:73` 새 프로필 insert의 0(이미 있으면 안 쓰임) · `onboardingStepCore.ts:22-24` 유일한 갱신(`< step` 조건) · `personalityApi.ts:146` `updateOnboardingStep` -> 위 함수(호출: `personalityApi.ts:111` RESULT) · `coupleApi.ts:98·108·113` 세 함수 -> 위 함수. 읽기: `resolveResumePath.ts`·`onboardingResume.ts`. `scripts/ops/` 시험 계정 준비(admin, 클라이언트 아님)의 `onboarding_step: 3`·`update`는 앱 경로가 아니라 그대로 둠.
  - 사진 큐 저장 위치: AsyncStorage 키 `chat_photo_queue:{coupleId}:{userId}`(텍스트 큐 `chat_queue:{coupleId}`와 같은 방식, 사용자별로 나눠 다른 사람의 항목을 보내지 않는다). 복사본은 `Paths.document/chat-photo-queue/{clientId}.{ext}`(성공·취소·사라짐이면 지움).
  - 스토리는 클라이언트 id 열이 없어(마이그레이션 없음) 큐 항목의 `clientId`를 업로드 경로 파일 이름으로 쓰고, **같은 `couple_id`+`media_path` 행이 이미 있으면 insert하지 않는다**(조회 뒤 삽입 - 같은 항목이 겹쳐 시도되지 않도록 러너가 진행 중 표시를 둔다). 만료는 삽입 시각 + 24시간(`expires_at > created_at` 제약 때문에 늦게 올라가도 안전).
  - 첫 시도의 일시 실패는 재시도 횟수를 쓰지 않고 2초부터(텍스트 큐와 같은 백오프), 복원 때의 시도는 재시도 1회로 센다. 5회 소진·영구 실패(4xx, 408·429 제외)는 `failed`: 메시지는 말풍선 [다시 보내기], 스토리는 화면이 없어 앱을 열 때 한 번 다시 시도하게 pending으로 돌린다. `postStory`가 영구 실패로 false를 돌리면 사람에게 알린 것이므로 큐에서 뺀다.
  - 복사본이 사라진 항목(저장공간을 비움 등): 서버를 부르지 않고 큐에서 뺀다. 메시지는 이 세션에서 실패 말풍선으로 보이고(다시 보내기는 동작 안 함, 길게 눌러 지움), 스토리는 조용히 사라진다(보여 줄 자리가 없음). 앱을 다시 열면 말풍선도 없다.
  - `hasQueued`(F05 안내)는 텍스트 큐 또는 사진 큐에 대기 항목이 있으면 true. `postStory`는 올렸거나 큐에서 이어 보내는 중이면 true(실패 알림을 띄우지 않는다), 복사 실패·영구 실패면 false.
  - 사진 큐는 채팅 탭이 붙어야(`useRealtimeMessages` 마운트) 이어 보낸다 - 텍스트 큐와 같은 한계. 탭이 지연 마운트면 앱을 열고 채팅 탭을 열 때 재개된다(`51-`에서 확인).
  - 옛 `u6Onboarding.test.tsx`의 "이미 계정 링크 없음" 단언 한 줄만 "링크가 있음"으로 고쳤다(R38-3이 되살린 것). 나머지 규칙 11 시험은 그대로 통과.
- 실증(원격 개발 DB, 사용자 권한): 기존 시험 계정 `test-63-signup-*`·`test-61-*`(커플 연결) 전후 같음 · 새 계정 저장 2회 행 수 그대로 · 일부만 저장 끝까지 · 진행 단계 감소 0 · 사진 메시지·스토리 각각 객체 1·행 1(끊김 두 종류, 앱 재시작 흉내 포함). 시험 데이터: `test-64-save-*`·`test-64-partial-*` 계정, 시험 커플 `test-62-chat`의 사진 메시지·스토리 행(지우지 않음). 첫 실행에서 "전후 같음"이 한 번 FAIL이었는데 스크립트 결함이었다(단계 0 계정에 `advance(1)`을 불러 정당하게 0->1로 올라감) - 지금 값 이하로만 부르도록 고쳐 다시 돌려 0건. 그 계정(`test-63-signup-20261025101534`)의 단계는 이제 1이다.
- `51-` 확인 목록(본문 파일은 저장소에 없어 목록 파일은 못 고친다): 63-이 센 20가지에 "기존 계정 재로그인(새 기기 · 재설치) - 진행 단계 유지"와 "비행기 모드에서 사진 보내고 앱 재시작 -> 이어 보내기" 둘을 더하면 **22가지**다. 지시서(`64-`)는 21가지라고 적었는데 63-의 20에 사진 항목이 이미 들어 있지 않으면 22가 맞다 - 63- HANDOFF는 사진 항목을 20에서 뺐다("a를 하면 21가지"). 산수 확인 필요(PM). "Android 카카오 왕복 중 앱 종료 -> A03부터 복구"는 온보딩 항목에 묶어 적는다.

## 사진 큐 · U6 온보딩 1부 (`63-`, 2026-10-25, ui-builder) - 원격 개발 DB 실증 완료(저장 경로), 실기기 미확인

- 파일: §0 `src/utils/chatGapFill.ts`·`src/hooks/useRealtimeMessages.ts`·`src/services/chatApi.ts`(`fetchMessagesAfter`)·`src/components/couple/InviteSheet.tsx`(`selectable`). §1 화면 `app/index.tsx`·`app/(onboarding)/{basic-info,mbti,love-quiz,result-brief,consent,underage,auth}.tsx`·`app/(modals)/legal-document.tsx`, 컴포넌트 `src/components/onboarding/`, 규칙 `src/utils/onboardingRules.ts`(+`age.ts`의 `calculateAgeKst`), 훅 `src/hooks/useSignupFinalize.ts`, 저장 알맹이 `src/services/personalityCore.ts`, 토큰 `nocturne.kakao`, 실증 `scripts/ops/verifyU6Signup.ts`.
- 내부 결정(항목당 한 줄):
  - §0 a(사진 영속 큐)는 `expo-file-system`이 없어 시작하지 않았다 - 사진은 여전히 이 세션 메모리 작업이다(Storage 경로는 이미 `client_msg_id`에서 정해져 재시도해도 같은 파일). 의존성 추가 허가가 나면 다음 지시서에서.
  - 메우기는 `sent_at >= 마지막 서버 메시지`(같은 시각 포함)로 읽고 `mergeMessage`가 하나로 합친다. 조회는 최대 500건 한 번(그 이상 놓치면 다음 신호 때 이어서). 처음 로드(`fetchMessages`)의 `limit 200`이 오름차순이라 **가장 오래된 200건**을 읽는 점은 건드리지 않았다(알려진 한계, 대화가 200건을 넘으면 메우기가 그 이후를 채운다).
  - A02의 "이미 계정이 있어요" 링크는 두지 않았다 - 동의(A10)가 로그인 앞이어야 하므로(MASTER 6-1) 동의 없이 로그인으로 가는 길이 된다. 새 기기에서 다시 로그인하는 길은 PM 결정 필요(아래 규칙 12 동작 참고).
  - A11의 구글·애플 버튼은 숨겼다(프로바이더 미설정). 카카오 버튼 색은 보드 값 `#FEE500`을 `nocturne.kakao` 토큰으로 두었다.
  - A08은 공유·이미지 저장 버튼을 숨기고 "더 자세히 보기 ->"(글자 링크)만 둔다. A08 -> A10(`/consent`)으로 간다. A09는 M3-6.
  - A10 항목 ① 만 14세는 체크 칸이 아니라 자동 판정 표시(`생년월일로 확인함`). 만 14세 미만은 A10에 들어오면 A13으로 `replace`. [처음으로]는 메모리를 비우고 `/`로.
  - 보드 A10의 AI 활용 항목 설명 한 줄("대화·사진·메모가 잡지를 만드는 데 쓰이고, 이때 외부 AI로 전송돼요")은 MASTER 6-3 ④의 두 요지와 같아 보드대로 넣었다. 보드 A12의 문장("무엇이 쓰이나요" 등)은 넣지 않았고 A12는 `legalDocuments.ts`의 지금 문장을 그대로 보인다. 보드 A13의 "정보는 저장하지 않았어요"는 사실(메모리뿐 + [처음으로]가 비움)이라 넣었다.
  - 동의 체크 상태는 `sessionStore.consent`(메모리)에 둔다. 로그인 인증이 실패해도 그대로 남는다(MASTER 6-5).
  - MBTI 네 글자가 바뀌면 `sessionStore`가 5문항 답과 결과를 비운다(문항 세트가 유형별로 달라서). 엔진은 안 바꿨다.
  - 로그인 뒤 저장 실패는 화면에 "저장하지 못했어요" + [다시 시도]. 자동 재시도 없음. `createProfileAndAssessment`를 `personalityCore.ts`로 옮겼다(클라이언트를 인자로 - `chatCore.ts`와 같은 방식, 앱은 `personalityApi`가 전역 `supabase`를 넣어 부른다, 동작 같음).
  - 앱 첫 화면(A01·A02)만 이미 로그인된 세션을 복원하느라 `auth.getSession`·`onAuthStateChange`를 부른다(기기 안 세션 읽기). A03~A13은 서버 클라이언트를 한 번도 부르지 않는다(시험). 세션이 없으면 프로필 조회도 없다.
  - 화면 머리는 네이티브 헤더가 아니라 화면이 그리는 ←(`PushHeader`)다. `(onboarding)/_layout.tsx`에서 새 화면만 `headerShown: false` + ink 바탕, 옛 화면(result-detail·invite·start-date)은 옛 헤더 그대로.
- **규칙 12 동작(바꾸지 않음)**: `createProfileAndAssessment`는 profiles upsert(동의 시각 세 칸이 이 호출 시각으로 덮임, `onboarding_step`이 0으로 되돌아감, 이름·생년월일·MBTI 덮임) 뒤 assessment insert를 하는데 `unique(user_id, seq)` 때문에 **이미 답이 있는 계정이면 insert가 23505로 실패**한다 -> 화면은 저장 실패로 보이고 [다시 시도]가 같은 실패를 되풀이한다. 새 기기에서 기존 계정으로 로그인하는 길(그리고 insert는 성공했는데 응답이 끊긴 뒤의 재시도)은 PM 결정이 필요하다. 실증 출력 `scripts/ops/out/63-u6-signup.txt`.
- 시험 데이터(원격 개발, 지우지 않음): 계정 `test-63-signup-<시각>@example.com`(실행마다 새로 생김) + 그 프로필·assessment.
- 로그인 뒤로 이어지는 기존(옛 테마) 화면: A14~A18 자리 `result-detail`·`invite`, A19 자리 `start-date`. 2부에서 교체.
- `51-` 실기기 확인: 지금 19가지 + **"온보딩 1부 끝까지(스플래시 -> 기본정보 -> MBTI -> 5문항 -> 결과 -> 동의 -> 카카오 로그인 -> 계정 생성, 앱을 중간에 닫았다 열면 처음부터 = 답 소멸까지 함께)" 1가지 = 20가지.** "비행기 모드에서 사진 보내고 앱 재시작 -> 이어 보내기"는 §0 a를 하지 않아 지금은 확인할 수 없다(a를 하면 21가지). `51-` 문서 본문은 저장소에 없어(`prompts/phase-7`에 51- 파일 없음) 목록 파일에는 더하지 못했다.

## U4 채팅 (`62-`, 2026-10-25, ui-builder) - 원격 개발 DB 실증 완료, 실기기 미확인

- 파일: 화면 `app/(tabs)/chat.tsx` · 시트 `app/(modals)/{couple-gate,story-viewer,photo-viewer}.tsx` · 컴포넌트 `src/components/chat/{ChatTop,Messages,Composer}.tsx`·`src/components/couple/InviteSheet.tsx`·`src/components/CoupleGate.tsx`(Nocturne으로 교체) · 서버 알맹이 `src/services/chatCore.ts`(저장소 클라이언트를 인자로 받는다 - 빈 본문 거부·사진 올리기·서명·스토리 생성)와 앱용 얇은 껍데기 `chatApi.ts` · 훅 `useSignedMedia`·`useRealtimeMessages`(`sendPhoto`·`hasQueued`·`postStory(photo)` 추가) · 메모리 저장 `src/store/chatViewerStore.ts` · 규칙 `src/utils/chatMessages.ts`(`isBlankBody`·`canSendBody` = 보내기 막음의 단 하나의 함수, 날짜·시각 글자) · 실증 `scripts/ops/verifyU4Chat.ts`(출력 `scripts/ops/out/62-u4-chat.txt`, git 제외). 지운 파일: 옛 `src/components/{ChatBubble,ChatDateDivider,StoryStrip}.tsx`.
- 0절 손질(R36-1~4): 미연결 36.5 색 `textSub` · 다음 호 진행률·재료 수는 이미 한 곳(`useLibrary`의 `periodElapsedPercent` + `materialLines`)이라 코드 무변경 · UTC `computeDaysTogether` 삭제(쓰는 곳은 시험뿐) · `nocturne.ember`(`#C08A64`) 토큰, B05 영문 라벨이 사용. 위 `61-` 절의 열린 항목 셋(36.5 색 · `#C08A64` · 옛 UTC 함수)은 이로써 해소.
- 내부 결정(항목당 한 줄):
  - 채팅 사진 보내기는 텍스트 오프라인 큐(`ChatRetryQueue`, 영속)를 건드리지 않고 **이 세션 메모리 작업**으로 둔다: 올리기(경로 `{couple}/{client_msg_id}.{ext}` - 재시도해도 같은 파일, 이미 있음은 성공으로 본다) -> 멱등 전송. 앱을 닫으면 올리는 중이던 사진은 사라진다(텍스트는 그대로 복원). 영속 큐로 올릴지는 PM.
  - 연결 끊김 안내(F05)는 네트워크 상태 의존성이 없어 "자동 재시도 중인 텍스트가 큐에 있다"(`hasQueued`)로 켠다. 사진 실패와 소진된 텍스트는 안내 없이 말풍선의 "다시 보내기"만.
  - 보내는 중 = 글자 "보내는 중" + 말풍선 .55(정지), 실패 = 테두리만 rose "다시 보내기". 길게 눌러 취소(기존 동작)는 그대로, 보드에 힌트가 없어 접근성 hint로만 둔다.
  - 읽음 표시는 Components 보드대로 내 메시지가 안 읽혔을 때만 시각 위에 rose "1", 읽으면 사라진다(옛 "읽음" 글자는 없앴다).
  - 입력창은 `N-T-Tabs` F01(알약 안 +, rose 보내기 원)을 따랐다(F05 보드는 흰 보내기 버튼·+ 바깥으로 다르다). 말풍선 색은 토큰으로(내 것 `text`, 상대 `inkRaise2`).
  - 입력창 placeholder는 보드의 `#6E6688`(textFaint)이 아니라 `textMute`(R20-5: textFaint는 비활성 컨트롤 글자만).
  - 날짜 구분선 글자는 보드대로 "10월 20일 화요일"(올해), 다른 해는 연도 붙임. `groupMessagesByDate`의 `label`(연월일)은 시험이 있어 그대로 두고 화면은 `chatDateLabel`을 쓴다.
  - 사진 메시지 아래 줄은 보드의 "세준 · 케이크 가게"에서 장소가 메시지에 없어 "보낸 사람 + 시각"만. 사진은 높이 220 고정 cover(원본 비율 크게 보기는 F06).
  - 스토리 줄은 사람별 한 칸(가장 최근 사진 썸네일), 상대는 orchid 고리·내 것은 고리 없음(보드). 본 것 표시는 없다. 스토리 보기는 탭으로 넘기고(오른쪽 다음·왼쪽 이전·끝에서 닫기) 위 막대는 정지 표시 - 자동 넘김·진행률 채움 없음. 올리기는 한 장 고르면 바로 업로드(캡션 없음, `createStory`의 자리표시자 경로는 없앴다).
  - F04 첨부 시트는 [앨범]만. 보드의 [카메라]는 `app.json`의 카메라 권한 설정이, "최근 사진" 격자는 미디어 라이브러리 의존성이 필요해 넣지 않았다(PM). F06의 [저장]·[공유]도 같은 이유로 없다. F02의 [복사하기]는 클립보드 의존성이 필요해 [공유하기]만.
  - F02 초대 시트는 `?from=chat`일 때만 채팅 문구("채팅은 연인과 연결되면 열려요."). **보드의 두 번째 문장 "여기서 나눈 대화가 온도와 잡지의 재료가 돼요"는 넣지 않았다**(채팅이 잡지에 실릴 수 있다는 안내를 새로 두지 않는다 - 규칙 9). 다른 진입(메인·피드·매거진)은 "연인과 연결되면 열려요."(I01의 문구는 피드 전용이라 쓰지 않았다).
  - 코드 발급 뒤·받은 코드 입력은 같은 시트 안의 단계로 줄여 담았다(A17·A18 내용). 온보딩의 `InvitePanel`(화면 8)은 U6에서 바뀌므로 손대지 않았다.
  - `CoupleGate`: `autoOpenInvite`여도 `fallback`이 있으면 그것을 그린다(시트 뒤에 비칠 면). 기본 잠금 카드는 Nocturne `GlassCard`. 초대 시트는 `transparentModal`(`(modals)/_layout.tsx` 옵션 변경).
  - 스토리·사진 크게 보기에 넘기는 값은 라우트 매개변수가 아니라 메모리 스토어(`chatViewerStore`)로. 시트를 닫아도 비우지 않는다(다음 열 때 덮어쓴다).
  - 입력창 위치는 키보드가 없을 때 탭 바 위(보드의 bottom 102), 있을 때 12. 실기기 확인 필요.
- 시험 데이터(원격 개발, 지우지 않음): 커플 `test-62-chat`, 계정 `test-62-chat-{a,b}@example.com`, 메시지(본문 `test-62 ...`)·사진 메시지·스토리 몇 건(스토리는 24시간 뒤 배치가 처리).
- 실증 첫 실행에서 B가 첫 메시지의 실시간 이벤트를 8초 안에 받지 못했다(새 계정·새 커플 직후). 재실행 2회는 219ms·355ms로 통과. 원인 미확인 - 실기기에서 처음 연결한 직후의 첫 수신을 본다.
- `51-` 실기기 확인에 더할 것: `61-`의 12가지(57-의 10가지 + 서재 -> 속표지 -> 넘김·핀치 줌 -> PDF 열기 + 메인 상태 4가지·하늘 장막) + **채팅 양방향(두 기기 실시간, 읽음 1이 사라짐) · 사진 전송(시스템 선택기 -> 한 장씩 -> 눌러 크게 보기·핀치 줌) · 오프라인 뒤 다시 보내기(비행기 모드에서 보내기 -> 안내 줄·"보내는 중" -> 복구 후 이어서, 실패 소진 뒤 "다시 보내기") · 스토리(올리기 -> 상대 기기에서 보기·넘기기·✕) · 초대 시트(미연결에서 채팅 진입 즉시, 코드 발급·공유·받은 코드 입력) · 키보드가 입력창을 가리지 않는지·탭 바 위 위치**. (원래 M0-7의 "채팅 실시간·오프라인 큐·스토리"는 이 항목들에 합쳤다.)

## U1 메인 (`61-`, 2026-10-25, ui-builder) - 원격 개발 DB 실증 완료, 실기기 미확인

- 파일: 화면 `app/(tabs)/main.tsx` · 컴포넌트 `src/components/main/{MainHeader,MainHero,MainBlocks}.tsx` · 순수 규칙 `src/utils/mainScreen.ts`(온도 표시 5상태·우선순위·배치·B06 조건·KST 날짜 문구) · KST D+N `computeDaysTogetherKst`(`src/utils/relationshipDays.ts`) · 읽기 `src/services/mainApi.ts` · 기기 저장 `src/services/issueSeen.ts` · 훅 `src/hooks/useMainData.ts` · 장막 `src/theme/sky.ts`·`nocturne.ts`(`mainBottomVeil`)·`SkyBackground`(`bottomVeil`) · 뷰어 한 줄 `app/(modals)/magazine-viewer.tsx` · 실증 `scripts/ops/verifyU1Main.ts`(출력 `scripts/ops/out/61-u1-main.txt`, git 제외).
- 내부 결정(항목당 한 줄):
  - "활동"은 지우지 않은 대화·기록(`data_entries`)·데이트가 하나라도 있는 것(MASTER 10-7-3 활동 점수는 미확정이라 유무만 본다). 읽기 실패 시 활동 = `저장된 온도 있음`, 프로파일 완비 = true(36.5로 덮지 않는다).
  - 다음 호 카드는 U3 `NextIssueCard`(서재 D01의 큰 실루엣 카드)를 쓰지 않고 `N-B-Main` 보드의 글래스 카드 `IssueProgressCard`를 새로 만들었다. 진행률(`useLibrary`의 경과율)·재료 수(`materialLines`)·문구 상수는 재사용. 노출 조건은 R32-2(발행 1권 이상 + 초안 있을 때, 0권이면 FIRST ISSUE).
  - B06 보드의 압축 "NEXT ISSUE" 행(문구 "시작했어요" · 화살표)은 만들지 않고 새 호가 있어도 같은 다음 호 카드를 쓴다(화살표는 D02로 가는 길을 암시하는데 D02는 U5).
  - B06은 히어로를 바꾸지 않고(보드) 카드 자리를 차지한다. B04 + 새 호처럼 보드에 없는 겹침은 우선순위로 히어로를 정하고 나머지는 카드로 둔다.
  - 활동이 이미 있으면 "02 FIRST STEP"(첫 대화 남기기)은 그리지 않는다(r69 저장값 없음 상태). "오늘 시작했어요" 칩은 D+1에만(보드 B03).
  - (해소, `62-` 0절) 36.5° 색은 `textSub`로 바뀌었다(R36-1).
  - 히어로 숫자는 보드의 168pt. `GlowNumeral`이 토큰(-0.05em, 소수부 .42)을 쓰므로 보드(-0.07em, 소수부 52/168)와 약간 다르다. 기념일 숫자는 보드 값(-0.07em) 그대로 직접 그렸다.
  - 번호 머리글("01")의 번호 색은 `textFaint`가 아니라 `textMute`(textFaint는 비활성 글자 전용).
  - B05 카드: 라벨 영문 색은 `nocturne.ember`(`#C08A64`, `62-` 0절에서 토큰으로 더함 - 디자인 세션에 토큰 보드 추가를 알릴 것). 본문은 `descriptionKo`가 전부 null이라 `copyKo` 한 줄 + "MBTI · 애니어그램 N유형". 보드의 "결과 자세히 보기 →"는 온보딩 화면 7(푸터가 온보딩을 이어 감)로 가는 길이라 만들지 않았다.
  - 아바타는 사진 원천이 없어 mist/orchid 면 두 개(미연결은 점선 빈 슬롯).
  - `computeDaysTogetherKst`를 더했다. (해소, `62-` 0절) 옛 UTC `computeDaysTogether`는 지웠다(R36-3).
  - MASTER 9-2 "온도 히어로 보조 문구"(시작 온도 안내 두 문장)는 `N-B-Main` 보드에 자리가 없어 넣지 않았다(열린 항목, 디자인에 자리를 물을 것).
  - 호 조회가 실패하면 호 칸(새 호·지난 호·다음 호)을 그리지 않는다(0권으로 오해하게 두지 않음).
  - 시험 데이터(원격 개발, 지우지 않음): 커플 `test-61-empty`(기록 없음)·`test-61-active`(메시지 1), 계정 `test-61-{empty,active}-{a,b}@example.com`, 성격 프로파일(`engine_version` `test-61-*`)을 새 계정 4 + 기존 `test-55-2-photo-a/b`·`test-u2-solo`에 추가.
- `51-` 실기기 확인에 더할 것: 위 `57-` 10가지 + 서재 -> 속표지 -> 넘김·핀치 줌 -> PDF 열기 + **메인 상태 4가지(B03·B05·B06·B04) + 하늘 장막(위 별이 보이고 아래 카드 글자가 읽힘)**. 특히 하단 장막 `experimental_backgroundImage`, 세로 날짜 회전, 168pt 숫자가 좁은 폭에서 넘치지 않는지.

## 함수 실행 권한 025 (`60-` 1부, 2026-10-24, db-architect) - 작성만, 원격 미적용·미실행

- 파일: `supabase/migrations/025_function_execute_grants.sql` · `scripts/db/check_025_preapply.sql` · `verify_025_privileges.sql` · `verify_025_owner_run.sql` · `scripts/ops/verifyFunctionGrants.ts`(`ONDOLOG_025_APPLIED=1` 없으면 멈춤).
- 결정(내부): 트리거 함수 4개(`tg_set_updated_at`·`unlock_on_upgrade`·`fn_issues_theme_*`)는 SCHEMA 10-0에 분류가 없어 "배치 전용"과 같게 모든 클라이언트 역할에서 회수 - 트리거 발동은 EXECUTE를 검사하지 않는다. 10-0 표에 "트리거 전용" 행 추가 필요.
- 결정(내부): 배치·헬퍼·클라이언트 RPC·트리거 함수는 `service_role`도 회수(10-0: Edge Function이 REST로 부를 때만 service_role 부여, 부르는 곳 0). `fn_publish_issue`만 service_role.
- 결정(내부): `current_couple_id()`는 부르는 곳이 없지만 SCHEMA 10-1이 헬퍼로 정의하고 011이 authenticated만 줬으므로 헬퍼 분류 유지.
- 알려진 것: 기본 권한 회수는 `postgres` 소유 항목만(`supabase_admin` 소유 항목은 postgres가 못 바꿈, 이 프로젝트 마이그레이션 함수에는 안 걸림). 기본 권한의 `service_role`은 남긴다. 9-E의 `public.` 접두사는 023 본문에 이미 있어 정의 재작성은 글자 그대로 같다.
- 사람이 적용: 연결 확인 -> `check_025_preapply.sql` -> `npx supabase migration list` -> `npx supabase db push --dry-run` -> `npx supabase db push` -> `verify_025_privileges.sql`(전부 ok) -> `verify_025_owner_run.sql` -> `verifyFunctionGrants.ts run` -> 59- B·57- 회귀 -> 보안 점검 기준선 비교.

## 발행물 읽기 열 권한 (`59-` A, 2026-10-24, db-architect) - 작성만, 원격 미적용·미실행

- 파일: `supabase/migrations/024_issues_column_grants.sql` · `scripts/db/check_024_preapply.sql`(적용 전, 읽기 전용) · `scripts/db/verify_024_privileges.sql`(권한, 읽기 전용) · `scripts/ops/verifyIssuesGrant.ts`(실증 (1)~(8), 출력 `scripts/ops/out/59-issues-grant.txt`). 원격에는 읽기 전용 조회만 했다.
- 내부 결정(한 줄씩)
  - 파일명 `024_issues_column_grants.sql`. `grant select (14칸) on public.issues to authenticated` 한 문장. 정책·뷰·버킷 정책 변경 없음, anon 권한 없음.
  - 원격 `issues_public`는 SCHEMA 9-C-4의 14칸과 칸 이름·순서가 같고 `security_invoker=true`. 원격 `issues`에는 17칸이 있고(`pdf_print_path`·`publish_mode`·`updated_at` 포함) 열·테이블 권한이 anon/authenticated 모두 0건.
  - `magazine_storage_select`는 `bucket_id='magazine' and is_couple_member(foldername[1]::uuid)`이다. `issues`·`issues_public`를 조회하지 않고(`is_couple_member`는 security definer) 폴더의 첫 마디(커플 id)만 본다. 그래서 서명 URL은 024와 무관하게 이미 사용자 권한으로 풀려 있었다. 버킷 정책은 바꿀 것이 없다.
  - 관찰(범위 밖, 바꾸지 않음): 뷰 `issues_public`에 anon·authenticated의 INSERT/UPDATE/DELETE/TRUNCATE 권한이 보인다(Supabase 기본 권한). 뒤의 `issues`에 쓰기 권한이 없고 024도 SELECT만 주므로 실제로는 거부된다. 하지만 anon의 뷰 SELECT도 있어 방어가 `issues` 쪽 권한 부재에 기대고 있다 - 필요하면 뷰의 쓰기 권한 회수를 PM이 별도로 결정.
  - `select *`는 열 권한 때문에 사용자 권한으로 거부된다 - 앱 코드가 `issues`를 `*`로 읽으면 안 된다(현재 앱은 `issues_public`만 읽고 칸을 명시한다).
- SCHEMA에 옮길 물리 명세 초안은 이 세션 최종 보고에 있다(위치: 10-7 결함 박스의 "마이그레이션 024" 문구에 파일명 확정, 13장 순서에 024 한 줄, 14장 검증 쿼리에 열 권한 한 줄).
- 사람이 적용: 연결 확인 -> `check_024_preapply.sql` -> `npx supabase migration list` -> `npx supabase db push --dry-run` -> `npx supabase db push` -> `verify_024_privileges.sql` -> `verifyIssuesGrant.ts run`.

## 본인 기록 삭제 UI · stop 시각 (`57-` C, 2026-10-24, ui-builder) - 원격 개발 DB 실증 완료, 실기기 미확인

- 파일: 삭제 확인 `src/components/nocturne/ConfirmDialog.tsx`(I05, `index.ts`에 export) · `src/components/date/StopTimeline.tsx`(지우기 칩) · E03 `app/date/[id]/index.tsx`(사진·메모 지우기 + 확인) · 삭제 RPC 호출 `deleteOwnEntry`·`canDeleteEntry`(`src/services/dateRecordApi.ts`) · stop 시각 규칙 `src/utils/dateRecord.ts`(`planStops`·`resolveStopArrival`·`earliestCaptureOn`·`stopTimeErrorMessage`) · E11 `app/(modals)/upload.tsx` · E15 `app/date/[id]/stop/[stopId]/index.tsx` · 피드 머리 `src/components/feed/MonthChapterHeader.tsx`("메모 N · 사진 N · 데이트 N"). 실증 `scripts/ops/verifyU2Delete.ts`(출력 `scripts/ops/out/57-c-delete-and-stop-time.txt`).
- 지운 코드: `kstMidnightIso` · `isTimeKnown` · `stopTimeLabel` · `buildStops`(이전 `arrivalIso(...) ?? kstMidnightIso(...)`, "시각 모름" 표지로 읽던 E03·E15 화면 코드). `StopTimeline`의 `dateOn` 인자도 뺌.
- 의존성·마이그레이션·docs·app.json·package.json 변경 없음.
- 내부 결정(항목당 한 줄):
  - 삭제 진입: E03에서 내 사진은 사진 위 오른쪽 아래 "지우기" 칩, 내 메모는 메모 아래 "지우기" 글자. 디자인 보드에 E03 삭제 진입 위치가 없어 정함. 상대의 항목에는 렌더하지 않는다(`canDeleteEntry`).
  - I05 문구는 항목별로 "이 사진을 지울까요?" / "이 메모를 지울까요?" + "지운 사진은 되돌릴 수 없어요. 이미 발행된 호에서는 지워지지 않아요."(보드의 "사진 11장과 메모 2개가 함께" 문구는 데이트 단위 삭제용이라 쓰지 않음 - 데이트 삭제는 범위 밖).
  - 삭제 뒤 `useDateDetail.reload()`로 다시 읽는다. 파생 칸은 RPC가 맞추므로 클라이언트는 `refreshDateDerived`를 부르지 않는다. 피드는 화면에 돌아올 때 다시 읽는다.
  - 첫 장소의 "가장 이른 촬영 시각"은 **그 데이트 날짜(KST)에 찍힌 사진**만 본다. 다른 날짜 사진의 시각을 쓰면 stop이 데이트 날짜 밖에 놓인다.
  - 장소 없이 사진이 있으면 이름 없는 stop 하나(시각 = 가장 이른 촬영 시각, 없으면 저장 불가). **메모만 있고 장소가 없으면 stop을 만들지 않는다**(이전엔 00:00 stop). E03 타임라인은 비고 메모는 그대로 보인다.
  - 이미 stop이 있는 날에 장소 없이 사진을 더할 때는 시각 규칙을 적용하지 않는다(새 stop이 없다). stop이 하나도 없는 날(메모만 기록)에 EXIF 없는 사진만 더하면 저장 불가 - E10에는 장소 칸이 없어 길이 막힌다(드문 경우, 열린 판단).
  - E11은 저장 전에 규칙을 검사한다(`recordDate`가 업로드 전에 `planStops` 확인) - 거부되면 업로드·행이 0이다(원격 확인).
  - E15는 "첫 stop"을 저장된 `seq === 0`으로 본다. 첫 stop만 시각을 비울 수 있다.
  - E15 도착 시각 칸에는 저장된 시각을 그대로 채운다(예전 표지 값이면 "00:00"이 채워진다 - 항목 11 결과가 "없음"이라 해당 없음).
- 항목 11: 원격 개발 DB 전체 stop 39건 중 KST 00:00:00 = **0건**(없음). 다시 기록한 것 없음.
- `51-` 실기기 확인에 더할 것(56- 보고 9가지 + 하나): (1) 사진 골라 기록 -> 피드 -> 상세 흐름 (2) EXIF GPS(iOS 시스템 선택기가 GPS를 주는지) (3) HEIC 업로드·표시 (4) 원본 크기 유지(`quality: 1`, 올라간 byte_size) (5) 그레인 128pt 타일 (6) 상세 hero 장막 (7) FAB 위치(탭 바 위) (8) 키보드가 시트 입력을 가리는지 (9) 월 인덱스 탭 이동 (10) **내 사진 삭제 -> 피드·상세에서 사라짐** - 더해서 지우기 칩이 사진 위에서 눌리는지, I05 확인 카드 위치·막(.66), 상대 항목에 칩이 없는지.
- 시험 데이터: 날짜 `2027-01-08`(커플 `test-u2`), A 사진 3장 중 1장 소프트 삭제·B 사진 1장, stop 시각 14:05:40(KST). 지우지 않았다.

## 지운 항목을 생성·발행 경로에서 빼기 (`57-` B, 2026-10-24, corner-pipeline) - 원격 개발 DB 실증 완료

입력 조립과 발행 전 원본 재확인은 이미 `deleted_at is null`을 걸고 있었다(`inputAssembly.ts` 330·336행, `supabaseOps.ts` `entrySourcePaths`). 코드 무변경, 시험·실증만 더했다. 이미 발행된 호의 content·렌더 결과를 바꾸는 코드는 없다.

내부 결정(항목당 한 줄):

- 지운 항목은 제외 건수 사유로 세지 않는다 - 조회 단계에서 읽지 않아 셀 수 없고, 사유를 늘리면 `exclusions` 모양이 바뀐다. 시험이 건수가 0임을 고정한다.
- 발행 재확인의 "없는 원본" 판정은 `entrySourcePaths`가 지운 항목을 돌려주지 않는 것으로 이미 같아서 새 분기를 두지 않았다. 사유는 기존 `source_media_missing` 그대로(4값 불변).
- 실증은 새 파일 `scripts/ops/verifyDeletedEntryGuard.ts`다. 기존 `verifyRenderGuards.ts`는 service_role로 `deleted_at`을 직접 써서 이번 규약(작성자 세션 RPC)과 달라 손대지 않고 남겼다.
- 실증은 `deleted_at`을 되돌리지 않는다(RPC에 되돌림 없음, service_role 직접 쓰기 금지). 시험 호 ③(`22f0c5eb-...`, `test-온기`)의 사진 한 장(`a521f79b-...`)이 소모됐고, 그 호의 date_archive 코너는 `pending`, 렌더 세 필드는 빈 값이다. 다시 쓰려면 재생성·재렌더가 필요하다(지운 사진 없이).
- 발행된 호 불변은 코드가 아니라 시험으로 고정했다: 발행된 호는 `이미 발행` 거부이고 코너·호 행이 그대로(jest), 원격은 발행된 호 ①(`233b1922-...`)의 호·코너 지문 전후 같음.
- jest `inputAssembly.test.ts`·`operatorPath.test.ts`에 시험 추가만 했고 기존 assertion은 고치지 않았다.

## 본인 기록 삭제 RPC (`57-` A, 2026-10-24, db-architect) - 작성만, 원격 미적용·미실행

- 파일: `supabase/migrations/023_delete_own_entry.sql` · `scripts/db/check_023_preapply.sql`(적용 전, 읽기 전용) · `scripts/db/verify_023_privileges_and_settings.sql`(권한·설정, 읽기 전용) · `scripts/ops/verifyDeleteOwnEntry.ts`(다섯 경우 + 추가 3, 사용자 세션으로 RPC 호출, 출력 `scripts/ops/out/57-delete-own-entry.txt`). **전부 작성만 했고 원격에는 아무것도 실행하지 않았다.**
- 내부 결정(한 줄씩)
  - 파일명 `023_delete_own_entry.sql`, 함수 `public.fn_delete_own_entry(p_entry_id uuid) returns boolean` - true=지움, false=이미 지워져 있어 변화 없음(멱등).
  - 확인 순서와 SQLSTATE: 비로그인 `28000` -> 없는 항목 `P0002` -> 커플 아님 `42501` -> 작성자 아님 `42501` -> 이미 지움이면 false. 메시지는 `fn_delete_own_entry: ...`로 넷이 구분된다. 커플 확인이 작성자 확인보다 앞이라 남의 커플 항목은 "커플 아님"으로 나온다.
  - 항목 행을 `for update`로 잠가 같은 항목을 동시에 지우는 두 호출이 겹치지 않게 했다. 데이트 행도 `for update`.
  - `anon`은 권한 회수로 함수 호출 자체가 막힌다(`permission denied`). `auth.uid() is null` 분기는 `service_role` 등 로그인 없는 호출자용 방어선이다. `service_role` 실행 권한은 기본값 그대로 남긴다.
  - 파생 칸 계산은 앱의 `refreshDateDerived`/`deriveDateFields`(`src/utils/dateRecord.ts`)와 같다: `photo_count`=지우지 않은 사진 수, `has_user_note`=지우지 않은 **메모**가 있는가(SCHEMA 칸 주석은 "글/그림"이나 앱이 메모만 세므로 맞췄다. 그림 항목을 쓰게 되면 양쪽을 함께 고칠 것), `duration_minutes`=그 날짜(KST) 촬영 시각 있는 사진이 둘 이상일 때 첫~마지막 폭(분, 반올림) 아니면 null.
  - 앱 쪽은 사용자 권한이라 잠긴(`access_locked`) 항목을 못 세지만 이 함수는 definer라 잠긴 항목도 센다. 무료 티어 잠금(M4-4) 도입 때 같은 값이 나오는지 한 번 볼 것.
  - 항목 종류(`entry_type`)로 제한하지 않았다 - MASTER 9-4의 제한은 "자기가 올린 것"이다. 그림·셋로그도 본인 것이면 지워진다.
  - 사진이 0장이 된 데이트는 지우지 않는다. `date_stop_id`·저장소 원본 파일·`date_stops`는 건드리지 않는다.
  - RLS·정책 변경 없음, DELETE 정책 없음, 새 테이블 없음.
- SCHEMA에 옮길 물리 명세 초안(PM이 §9-D 다음 새 절 또는 §9-E로 옮긴다 - 이 세션은 `docs/`를 고치지 않았다)
  - 위치 제안: §13 마이그레이션 순서에 `023_delete_own_entry.sql` 한 줄, §9에 "9-E. 본인 기록 삭제 RPC" 절, §14 검증 쿼리에 권한 확인 한 줄.
  - 시그니처: `public.fn_delete_own_entry(p_entry_id uuid) returns boolean`, `language plpgsql`, `security definer`, `set search_path = public`. 권한: `revoke all ... from public, anon; grant execute ... to authenticated`.
  - 동작: (1) `auth.uid()` null이면 예외 28000 (2) `data_entries` 행 `for update`, 없으면 P0002 (3) `is_couple_member(couple_id)` 아니면 42501 (4) `author_id <> auth.uid()`면 42501 (5) `deleted_at`이 이미 차 있으면 false로 반환(변화 없음) (6) `deleted_at = now()` (7) `date_id`가 있으면 `dates`의 `photo_count`·`has_user_note`·`duration_minutes`를 남은(`deleted_at is null`) 항목으로 재계산 (8) true 반환.
  - 불변식: 저장소 파일을 지우지 않는다(§11-2). 발행된 호는 건드리지 않는다. 입력 조립과 발행 직전 재확인이 `deleted_at`이 찬 항목을 "없는 원본"으로 보는 것은 `57-` B의 일이다(R30-1).
  - 타입: 적용 뒤 `src/types/database.ts`를 재생성하면 `Functions.fn_delete_own_entry`가 추가만 된다(§9-D-10 기준). 이번엔 건드리지 않았다.
- 사람이 적용할 때(022와 같은 방식, 위 "022 적용·실증 결과" 절 근거): ① 메인 세션이 `check_023_preapply.sql` 실행(Supabase MCP `execute_sql`, 기대: 함수 없음 OK) ② `npx supabase migration list`로 023이 Local에만 있는지 확인 ③ `npx supabase db push --dry-run`이 `023_delete_own_entry.sql` 하나만 보이는지 확인 ④ `npx supabase db push` ⑤ `verify_023_privileges_and_settings.sql` 실행 ⑥ `verifyDeleteOwnEntry.ts run`(위 파일 머리의 deno 명령, `verifyU2Record.ts`와 같은 플래그).
- 023 타입 재생성 때 PostgrestVersion 14.5→14.15 (원격 버전 변경, 1회 허용)

## U2 피드·업로드 (`56`, 2026-10-24, ui-builder) - 원격 개발 DB 실증 완료, 삭제는 막힘, 실기기 미확인

- 파일: 항목 0 `Grain.tsx`(128pt)·`ScreenFrame.tsx`(새, 공통 화면 틀)·`Buttons.tsx`·`ListGroup.tsx`·`Chips.tsx`·`nocturne.ts`(`lilacText`). E01·E13 `app/(tabs)/feed.tsx`. E03 `app/date/[id]/index.tsx`. E15 `app/date/[id]/stop/[stopId]/index.tsx`. E11·E10 `app/(modals)/upload.tsx`(`?dateId=`가 E10). 쓰기·읽기 `src/services/dateRecordApi.ts`, 순수 규칙 `src/utils/dateRecord.ts`, 선택기 `src/services/photoPicker.ts`, 훅 3종, 부품 `src/components/{feed,date}/`. 실증 `scripts/ops/verifyU2Record.ts`.
- 의존성·마이그레이션·docs·app.json 변경 없음. `app/(modals)/_layout.tsx`에 `upload` 화면 한 줄.
- 내부 결정(항목당 한 줄):
  - `arrived_at` 모름 표지 = 그 날짜 KST 00:00:00. E03은 이 값이면 시각을 그리지 않는다. 유저가 "00:00"을 넣어도 같은 값이라 숨는다.
  - `dates.region`은 앱이 채우지 않는다. 비어 있으면 머리에서 지역을 뺀다. 제목이 비면 머리 제목 = 날짜 말("10월 3일 토요일").
  - 같은 시각 stop은 입력 순서, 규칙 4에서 같은 도착 시각이면 seq 큰 쪽. 촬영 시각 없는 사진은 첫 stop.
  - 피드 머리 "기록 N" = 그 달 메모 수(사진·데이트와 같은 범주로 읽음). 디자인 보드의 숫자는 예시라 대조하지 않았다.
  - 상대 사진의 `date_stop_id`는 쓰지 않는다. E03은 저장값이 아니라 규칙 4로 배치를 다시 계산하고, 내 사진의 저장값만 맞춘다(`syncOwnPlacement`, E03 열 때·E15 저장 때).
  - 메모는 데이트 단위라 E03 머리 아래 MEMO 블록에 둔다(E15에 장소별 메모 칸이 없다). 메모 `captured_at`은 비운다.
  - 시간 칸(E11)은 사진 촬영 폭을 보여 줄 뿐 입력이 아니다. 장소별 도착 시각은 장소 칸에서 넣는다.
  - E15에 도착 시각 칸을 더했다(지시 항목 5, 디자인엔 없음). "FROM PHOTO"·검색 목록은 만들지 않았다. `location_verified`·`lat`·`lng`·`place_provider_id`는 쓰지 않는다.
  - 대표 카드 = 그 달 가장 최근 데이트. 카드 사진 = 가장 이른 촬영 시각 사진. `sky_color`·`dates.theme`은 쓰지 않는다.
  - 피드의 얼굴 인식 안내 카드(사진 자동 정리)와 토글은 뺐다. 업로드 재시도는 사진당 3번(채팅 오프라인 큐는 메모리 전용이라 파일 업로드에 못 씀).
  - 미연결 유저의 피드는 `<CoupleGate fallback={SoloBanner}>`. 커플 행이 없으면 배너 문구가 "초대 코드를 만들면 기록할 수 있어요".
  - 잠긴(열람 불가) 항목은 조회되지 않아 `photo_count` 재계산에 안 잡힌다(E12는 M4-4).
- **막힘 1 - 본인 기록 삭제(항목 7)**: 만들지 않았다. 원격에서 A 계정 권한으로 `update data_entries set deleted_at` 실행 -> "new row violates row-level security policy"(SELECT 정책 `deleted_at is null` 때문). DELETE 정책도 없다. 해결은 마이그레이션(예: 본인 행만 지우는 SECURITY DEFINER RPC) - 범위 밖이라 PM 결정. 삭제 뒤 `refreshDateDerived`는 이미 있다.
- **막힘 2 - 규칙 6**: 위 열린 항목. 화면은 지시대로 기록 버튼 비활성.
- `51-` 실기기 확인에 더할 것: 사진 골라 기록 -> 피드 -> 상세 흐름, EXIF GPS(iOS 시스템 선택기가 GPS를 주는지), HEIC 업로드·표시(RN `Image`가 서명 URL의 HEIC를 그리는지), 원본 크기 유지(`quality: 1`이 재인코딩 안 하는지, 올라간 byte_size), 그레인 128pt 타일, 상세 hero 장막, FAB 위치(탭 바 위), 키보드가 시트 입력을 가리는지, 월 인덱스 탭 이동.
- 시험 데이터(원격 개발 DB, 이름에 test): 계정 `test-u2-a`·`test-u2-b`·`test-u2-solo`(@example.com), 커플 닉네임 `test-u2`(초대 코드 TESTU2), 데이트 날짜 2026-10-03. ID·경로는 `scripts/ops/out/56-u2-record.json`, 조회 출력은 `56-u2-record.txt`. 지우지 않았다.

## 조판 슬롯 채우기 (`55-2`, 2026-10-24, corner-pipeline) - 진짜 지면 13종, 원격 개발 DB 실증 완료

0단계(슬롯 문법 대조): `render/issue/README.md` v1.1.1과 `55-1` 모듈이 달랐고, **모듈을 README에 맞췄다**(R28-1). 지면 HTML 구조는 고치지 않았다. 바꾼 점: ① `data-repeat`은 **컨테이너**에 붙고 첫 자식이 틀(55-1은 속성 단 요소 자신을 복제했다) ② `data-variant`는 **형제**가 각자 이름을 가지고 하나만 남는다(55-1은 부모 `data-variant="경로"` + 자식 `data-case`) - 고르는 기준은 README §3이라 `compose.choose_variant`가 한다 ③ 경로: `.`으로 시작하면 항목, `@`는 코너 밖 값, 그 밖은 코너 봉투 기준(반복 안에서도), `[숫자]`·`[featured]`·`[i]`·`.length` 추가 ④ 표시를 출력에서 지우지 않는다(`base.css`가 `[data-repeat=".turns"]`를, `tm-articles.html`이 `[data-variant="grid-2"]`를 선택자로 읽는다) ⑤ 값이 글자 하나인 배열(`@note.notUsed`)은 틀 요소의 글자가 곧 항목 ⑥ 값의 줄바꿈은 `<br>`. 그대로 둔 것: `data-if`·`data-optional`(`data-src`도 센다, R26-2)·해석 순서(R25-2). 멈춤 조건에는 걸리지 않았다.

내부 결정(항목당 한 줄):

- 분담: `render/slot_fill.py`(문법) · `render/compose.py`(어느 지면을 어떤 데이터로 - 네트워크·파일 없음) · `render/page_audit.py`(지면 검사) · `render/romanize.py`(로마자) · `render/render_issue.py`(읽기·렌더·업로드) · `render/seed_render_tests.py`(시험 호 만들기). 55-1의 임시 지면 `render/_placeholder/`는 지웠다.
- PDF는 지면마다 Chromium이 한 쪽씩 내고 `pypdf`(6.21.2, `requirements.txt`에 추가)로 한 권으로 잇는다. 지면 HTML이 `body`·`body.클래스` 선택자에 기대 한 문서로 합칠 수 없다. 지면 하나가 PDF 한 쪽이 아니면 멈춘다.
- 작업 폴더(`render/out/<호>/work/`)에는 `base.css`·`themes/`·`fonts/`만 복사한다. **`images/`(견본 사진)는 복사하지 않고**, 채운 HTML에 `images/sample`이 남거나 `<img>`가 작업 폴더 사진이 아니면 `StopError`.
- 지면 순서: 표지 · 목차 · 발행 노트 · 데이트 아카이브(오프너 → 타임라인 1~2면 → 장소·세 물음 → 대표가 아닌 기사마다 `da-article`) · 다정한 말들(오프너 → 인용: main 1~2개 1면, 3개 2면) · 이달의 우리(저중심면 → 소기사) · 뒤표지. `ready`가 아닌 코너(skipped·pending·failed)는 지면·목차에서 빠지고 쪽 번호를 다시 센다. 대체 지면 없음.
- 쪽 번호 = 표지부터 센 장 번호, 두 자리 `04`(견본의 `0 4`는 글자 사이를 `letter-spacing`이 벌린 모양으로 읽었다). 목차에는 코너만 싣는다(발행 노트는 부속이라 넣지 않았다).
- `@issue.month`·`@back.closing`의 달 = `issues.period_end`의 달(`periodLabel`이 기간의 끝 쪽 달을 쓰는 것과 같다). `@back.nextMonth` = 그 다음 달 영문(12월 → 다음 해 January).
- 표지: 대표 사진 = featured 첫 stop 첫 사진 → featured 기사 안 첫 사진 → 다른 기사 첫 사진. 원본 짧은 변은 content의 `PhotoRef.width·height`로 본다(1170 이상이면 사진 표지, 1169는 활자). 표제의 "3줄·줄당 6자"는 줄 안 띄어쓰기를 포함한 글자 수, 단어는 쪼개지 않는다(앞에서부터 채움). **줄바꿈은 활자 표지에만** 넣는다 - 사진 표지 표제는 `clamp2`라 3줄이면 셋째 줄이 잘린다. 표제가 나뉘지 않으면 이 달의 말(`main[0].turns[0]`)로 대체하고, 그 말은 "이 달의 말" 줄에도 그대로 남는다(둘 다 없으면 표제는 나뉘지 않은 `theme.headline` 그대로).
- 타임라인 분할: README §5 실측표 합이 953px을 넘을 때. 앞에서부터 채워 **최대 2면**(CORNER_LAYOUT §3-1), 둘째 면에도 안 들어가는 stop은 싣지 않고 발행 노트 "싣지 않은 것"에 적는다. 메모도 AI 캡션도 없는 stop은 표에 칸이 없어 'AI 캡션만' 열의 값을 쓴다(실제보다 크게 잡는 쪽). 지면에 놓을 수 있는 메모 = 글이 있는 `memo`뿐(그림 메모는 메모로 세지 않고 노트에 적는다). 템플릿이 `userNotes[0]`만 그리므로 한 구간의 둘째 메모부터는 노트에 "메모 N개 - 한 구간에 하나만 싣습니다".
- `@da.lead`: 재소환을 뺀 이번 기간 기사들의 stop·사진(stop당 3장 상한 뒤)·메모를 센다(R26-5). 지역이 비면 "지역, " 조각을 뺀다. 숫자 외의 틀은 README 그대로. `@da.photoCount`·`@da.records` 등 나머지 합은 README 문장 그대로(상한을 적용하지 않는 합).
- `@toc.desc`(README에 식이 없다 - **README 빈칸**): content에서 세는 사실만 - "기사 N편" · "인용 N개" · "소기사 N편". 견본의 "화보 · …의 두 번의 하루"는 만들 수 없는 말이라 쓰지 않았다.
- 장소 목록(`@da.places`)은 8곳까지(README `tools/sweep.py`가 통과를 확인한 최대 항목 수), 넘는 곳은 노트에 적는다. 이달의 우리 신호는 3개까지(§3-4 "요약 수치 3개"). `.seq`는 `seq + 1`을 두 자리로(content의 `seq`는 0부터). `.evidence` 한 줄은 README §9 규칙 + 근거 `date`는 날짜만(README에 `date` 근거 규칙이 없다 - 저장 스키마엔 `metric`이 없고 `date`가 있다). `.photo`는 README·content에 출처가 없어 바인딩하지 않았다(사진 틀이 삭제된다).
- 다정한 말들 단문의 `attribution.at`은 ISO 문자열이라 지면 견본의 `08.11 23:40`으로 보기 사본에서 포맷한다(README에 형식이 없다). 원본 content는 건드리지 않는다(`compose`는 보기 사본만 만든다 - 시험이 확인).
- 재소환 사유(R26-4): `anniversary`만 `{이번 호 연도 - dateOn 연도}년 전 이맘때`, 나머지는 빈 값이라 라벨째 빠진다. 시험이 세 사유를 지면 HTML에 채워 확인한다.
- 문장 출처(§3-0): "문장" = 마침표·물음표·느낌표·말줄임표·줄바꿈 뒤에서 끊은 조각(글자가 있으면 최소 1). **지면에 실제로 실린 것만, 원천 한 번만**(표지가 다시 보이는 표제·이 달의 말은 따로 세지 않는다). 두 사람: 실린 `userNotes[0].text`·인용 `turns`·`sub`·15자 이하 `evidence.excerpt`. 온도록: 실린 `aiCaption`·기사 제목·`theme.headline`·`theme.lead`·`articles[].body`·`closing`·`context`·`closingQuestions`(+`basis`)와 고정 틀 문장 `@da.lead`(2문장)·`@da.routeHeadline`·`@back.closing`. 집계 수치·고정 문구(HTML에 박힌 것)·`recallReason` 라벨은 세지 않는다. 호별 분류별 수는 `render/out/<호>/compose.json`.
- 재료 집계("모은 양"): DB에서 센다(대화 = 기간 안 본문 있는 메시지 / 데이트 / 사진 = 촬영 시각이 기간 안이거나 이번 기간 데이트·구간에 묶인 것 / 메모 = 그 데이트·구간에 묶인 것). 기간은 KST `[period_start, period_end+1일)`, 미삭제, 무료 커플은 잠기지 않은 것만(`inputAssembly.ts`와 같은 조건, 의미 없는 조각은 빼지 않는다). 0이면 행을 지운다. "실제 게재" = 실린 인용 줄 수 · 실린 사진 수 · 실린 메모 수 · 재소환 뺀 데이트 수.
- 지면 검사: 6항목 + `overset` + `clipped`(`.clamp1~4`가 글자를 잘랐다 - 원문이 지면에서 안 보이는 자리). `safe`(판면 이탈)는 요소 상자가 아니라 **글자 줄 상자**로 판정하고 러닝헤드·폴리오·사진 위는 뺀다. 디자인 `tools/audit.py`의 `AUDIT`을 실행 때 그대로 읽어 같은 지면에서 공통 다섯 항목(overflow·tiny·contrast·overset·overlap)이 같은지 대조한다(`audit.json`의 `designAudit`). 위반은 렌더를 실패시키지 않는다.
- 시험 호 세 권은 Python(`render/seed_render_tests.py`)으로 만들었다 - Deno 진입점을 더하지 않으려고. content는 합성 시험 데이터(`render/tests/fixtures.py`)이고 저장 스키마(Zod)는 Deno로 따로 한 번 검증했다(8개 모두 통과). 복제(P7)가 하는 일(원본 `entries`와 같은 사진을 `magazine` 목적지에 미리 둠)은 시험 스크립트가 직접 한다 - 발행 명령의 원본·목적지 확인이 그대로 돈다. 만든 행·파일 목록: `render/out/seed-55-2.json`(지우지 않는다).
- `render/requirements.txt`: `pypdf==6.21.2` 추가(55-2). 로마자 표기 라이브러리(`korean-romanizer`)는 써 보고 버렸다 - 종로 `jongro`·신라 `sinra` 등 국어의 로마자 표기법과 다른 결과를 낸다.
- 로마자 한계: 복합어의 ㄴ첨가(학여울)는 판정하지 않는다. 시·군·구·읍·면·동·리·가·도로 끝나는 두 음절 이상 단어는 행정 단위로 본다(왕십리 → `Wangsip-ri`). 한글·공백 외 문자가 섞이면 빈 값(줄 삭제).
- Python 시험: `render/.venv/Scripts/python.exe -B -m unittest discover -s render/tests`(실제 Chromium 렌더 포함, 네트워크 없음, 약 2분).
- 파일명 시험: `render/.venv/`만 제외에 더했다(R28-2 1회 허가) - 55-1의 "setuptools 지우기" 우회는 이제 필요 없다.

막힌 슬롯 - 지면 HTML이 값을 받지 못하거나 거짓이 되는 곳(고치지 않았다. 디자인 세션 몫):

1. `note.html` 문장의 출처 막대: 두 사람 쪽 폭이 `style="width:42%"` 인라인 고정이라 비율이 막대에 반영되지 않는다(글자의 %만 슬롯). 시험 호 ①: 글자는 34% / 66%인데 막대는 42%. 이 지면의 핵심 장치다.
2. `sw-opener.html` 두 변형의 "다정 지수 [값] · [기간]" 줄: `payload.warmthIndex`(산출식이 없어 늘 null)와 `header.periodLabel`이 같은 `data-optional` 안에 있어, null이어도 기간이 차 있어 줄이 안 지워지고 "다정 지수  · 2026년 9월"(숫자 없는 라벨)이 남는다. README §7-1의 "null이면 줄째 빠진다"와 다르다.
3. `da-article.html` 고정 문구 셋: 러닝헤드 "그때 그 시절"(재소환이 아닌 기사에도 찍힌다) · "Article Two"(셋째 기사에도, `@da.articleNo`는 실제 번호 "기사 03") · "그날 남은 사진 중 세 장"(사진이 세 장 미만이어도).
4. `da-opener.html` "Article One": featured가 `articles`의 첫 기사가 아니면 타임라인의 `@da.articleNo`("기사 02")와 어긋난다. 사진 틀에 `data-optional`·변형이 없어 featured 첫 stop에 사진이 없으면 빈 회색 상자가 남는다(표지는 사진 사슬로 다른 사진을 쓰는데 오프너·`da-article` 히어로는 `stops[0].photos[0]` 한 경로뿐).
5. README 빈칸: `@toc.desc` 계산식 · `tm-articles`의 `.photo` 출처(§9에 없음, content에도 없음) · `.attribution.at` 표기 형식 · `.seq` 번호 형식 · 근거 `date` 표기 · `da-article`의 `.caption`(견본은 "AI 캡션 · …" 접두, README는 aiCaption 값만) · 폴리오 형식(`04` vs `0 4`). 위 결정은 렌더러가 임시로 정했다.
6. 원문 잘림 위험: 유저 메모(`clamp2`)·인용 turn(`clamp3`)·표지의 이 달의 말·`@da.lead`가 길면 CSS 안전망이 글자를 자른다. 생성 단계 길이 상한은 AI 문장용이고 유저 원문에는 정책이 없다. 검사가 `clipped`로 기록한다.

## 렌더 배관 (`55-1`, 2026-10-23, corner-pipeline) - 임시 지면, 원격 개발 DB 실증 완료

내부 결정(항목당 한 줄):

- 분담: Python(`render/`)이 렌더·업로드·`issues` 세 필드 쓰기(REST, 표준 라이브러리 `urllib`), Deno(`scripts/ops/`)가 발행 가드 ①·②와 원본 재확인. 둘 다 같은 환경변수 두 개만 읽고, Python도 개발 프로젝트·시험 커플 확인을 `opsGuards.ts`와 같은 규칙으로 따로 한다(`render_issue.py`, 시험 있음).
- 의존성 목록: `render/requirements.txt`(`playwright==1.64.0`·`beautifulsoup4==4.15.0`). 가상환경 `render/.venv`, 산출 `render/out/<issue_id>/`(`issue.pdf`·`page-NN.jpg`·`work/`) - 둘 다 `.gitignore`.
- 버킷 경로: `magazine/{couple_id}/{issue_id}/render/issue.pdf`·`render/page-NN.jpg`. 세 단계 밖의 4단 경로라 사진 경로 파서(`parseMagazineMediaPath`, 3단)·`findMissingDestinations`와 섞이지 않는다. `cover_path` = `render/page-01.jpg`. 다시 렌더하면 그 폴더를 비우고 올린다.
- 렌더 순서: 먼저 세 필드를 비우고 -> 업로드 -> 세 필드를 채운다(중간에 멎어도 낡은 값이 남지 않는다). 발행된 호·시험 커플이 아닌 호·ready 코너가 없는 호는 렌더하지 않는다(발행 뒤 재렌더 없음, 9-5).
- 페이지 이미지: 지면 요소(`.page`)마다 요소 스크린샷, 기기 배율 = 1170 / (A4 폭 CSS px)로 가로 1170px 고정(`--image-width`, `--jpeg-quality`로 바꿈, 기본 JPEG 85). PDF 쪽 수(바이트에서 `/Type /Page` 계수)와 지면 수가 다르거나 이미지 가로가 1170이 아니면 멈춘다. PDF는 벡터라 "150DPI"는 사진 해상도에만 해당한다 - 디지털 프로필 설정값화는 M4-3.
- 가드 ① 위치: `publishIssue`에서 원본 재확인·복제 **뒤에** 호를 다시 읽어 판정(재확인이 세 필드를 비울 수 있어서). `isRendered`는 `page_count > 0`까지 본다. SQL 함수(`fn_publish_issue`)는 렌더 필드를 모른다 - 마이그레이션이 범위 밖이라 발행 명령 쪽에서만 막는다(함수를 직접 부르면 통과한다, `verifyPublishPath.ts`가 그렇게 부른다).
- 가드 ② 위치: `OpsStore.clearRender`(발행된 호는 건드리지 않음). 호출 둘 - `mediaCopy.copyIssueMedia`가 코너를 `pending`으로 되돌릴 때, `generateSampleIssue`가 코너 하나라도 (다시) 저장했을 때(성공·실패 모두). 변화 없는 재실행(전부 `kept_ready`)은 비우지 않는다. 배치 경로(P3~P5)는 아직 코드가 없어 거기서 부를 곳이 생기면 같은 함수를 부른다.
- **슬롯 문법은 55-1이 정했다(원본 계약 `PM_request_design_render_issue.md`가 저장소에 없다).** `data-slot="경로"` 글자 · `data-src="경로"` 속성 · `data-repeat="경로"` · `data-if="경로"`(`!경로` 부정) · `data-optional` · `data-variant="경로"` + 자식의 `data-case="값"`. 경로: `.` 자신 / `a.b.0` 내려가기 / `@이름.x` 루트. 없는 경로는 빈 값. 빈 값 = None·빈 문자열·공백뿐·빈 배열·빈 객체(`0`·`False`는 값). **`render/issue/README.md`가 오면 55-2 착수 때 대조해 어긋나면 이 모듈을 맞춘다.** 처리한 표시는 출력에서 지운다(구조는 그대로).
- 슬롯 해석 세부: 반복 항목이 없으면 그 안의 슬롯 수만큼 "빈 슬롯"으로 세어 `optional` 판정에 넘긴다. 슬롯이 하나도 없는 `optional`은 판정하지 않고 둔다. `if`로 지운 가지는 판정에 아예 없다(0·0).
- 임시 지면의 값: 호 이름 = `issues.title`, 없으면 월간은 "N월호"·그 밖은 기간 시작일 / 코너 제목·기간 = content `header` / 사유 = `skip_reason`·`last_error` / 사진 = 지면 순서 앞 4장(`PHOTO_LIMIT`). 사진 경로 추출(`media_paths_of`)은 `mediaCopy.ts`의 `mediaPathsOf`와 같은 규칙의 Python 사본이다 - 저장 스키마가 바뀌면 둘을 함께 고친다.
- Python 시험: `render/.venv/Scripts/python.exe -B -m unittest discover -s render/tests`(40건, 실제 Chromium 렌더 1건 포함, 네트워크 없음). 바이트코드가 추적 폴더에 남지 않게 `-B`·`sys.dont_write_bytecode`.
- **열린 판단 - 규칙 F 파일시스템 대체 수집이 `.venv`를 걷는다.** `fileNameRule.test.ts`의 대체 수집은 `node_modules`·`.git`만 빼서, 새 venv의 setuptools(`launcher manifest.xml`·`script (dev).tmpl`)에서 실패한다. 시험 파일을 고치지 않고 venv에서 setuptools를 지워 통과시켰다(`requirements.txt` 머리말에 절차). 근본 해결은 그 시험의 제외 집합에 `.venv`를 더하는 것이다 - 사람이 판단.
- **`thumbPath` 확인(R21-2):** 렌더 코드(`render/`·`scripts/ops/`)에 읽는 곳이 없다. 나오는 곳은 `src/types/corners/storedContent.ts`(스키마), `inputAssembly.ts` 700행(입력 조립이 싣는 곳)과 그 시험뿐이다.
- 변경한 설정 파일: `.gitignore`에 `render/.venv/`·`render/out/` 두 줄(허가). package.json·app.json·eas.json·tsconfig.json·deno.json 무변경.
- 시험 기댓값 수정: `scripts/ops/operatorPath.test.ts` 두 곳(안전 정지 뒤 발행·정상 발행)에 `store.markRendered(issueId)` 한 줄씩 - 가드 ① 때문에 발행하려면 렌더된 호여야 한다. 원본 삭제 시험은 그대로 통과한다.
- 시험 커플 A의 호(`a791a61a-...`)는 이제 발행됐다(번호 1). `55-2`의 호 세 권은 새 초안이 필요하다.

## 운영자 경로 (`54`, 2026-10-22, corner-pipeline) - 샘플 출력 모드, 원격 개발 DB 실증 완료

내부 결정(항목당 한 줄):

- 명령 이름: 생성 `scripts/ops/generateIssueCli.ts`, 발행 `scripts/ops/publishIssueCli.ts`(로직은 `generateIssue.ts`·`publishIssue.ts`·`mediaCopy.ts`), 시험 데이터 `seedTestData.ts run`, M2-e 실증 `verifyPublishPath.ts snapshot|exceptions|concurrent|theme`. 모두 Deno, 저장소 루트에서 실행.
- 샘플 출력 방식: 고정 파일이 아니라 **그 실행의 입력에서 만드는 생성기**(`sampleOutputs.ts`). `SampleLlmClient`(`LlmClient` 구현, 네트워크 없음)가 응답 자리에 들어가고 검증기·골격·코너는 그대로다. 저장 행은 `engine_version = 'sample-output-v1'`, `generation_attempts = 0`(LLM에 요청을 보내지 않았다).
- 실제 호출 경로: 만들지 않았다. 실행 인수에 모드 선택이 없다(모르는 인수는 멈춘다). **어긋남 보고: 지시서·MASTER §17-0-10-H가 말하는 "모델 `tbd`이면 생성이 돌지 않는 기존 fail-closed"는 코드에 없다** - 모델을 읽는 코드가 없고(`llmClient.createLlmClient`는 호출부가 넘긴 `model` 문자열을 그대로 쓴다) `app_config.llm_provider`의 `tbd`는 시드 값(010)뿐이다. 이번 작업은 그 값을 읽지도 쓰지도 않았고, 검사를 지우지도 더하지도 않았다. M1c에서 실제 호출 경로를 열 때 그 검사를 함께 만들어야 한다(지금은 "열려 있지 않다"가 안전장치다).
- 시험 표시 판정 열: `couples.nickname`(대소문자 무시 `test`). 생성·발행 명령 둘 다 거부한다. 계정 이메일 `test-m2b-*@example.com`, `profiles.display_name` `test-*`.
- 개발 프로젝트 확인 방식: `ONDOLOG_SUPABASE_URL`의 ref가 `supabase/.temp/linked-project.json`의 `ref`와 같고 그 `name`이 `ondolog`여야 클라이언트를 만든다. 파일이 없으면 멈춘다(fail closed). 새 환경에서는 `supabase link` 뒤에 쓴다.
- 권한: `--allow-env`는 두 이름만, `--allow-net`은 프로젝트 호스트 하나, `--allow-read`는 `linked-project.json` 하나, `--allow-write=scripts/ops/out`. LLM 호스트는 허용되지 않는다. npm 모듈은 `npm:@supabase/supabase-js@2.118.0`(lock과 같은 해석 버전)을 `supabaseOps.ts`에서만 직접 쓴다 - `deno.json`은 건드리지 않았다.
- 경로 함수: `_shared/mediaPath.ts` 하나(`magazineMediaPath`·`parseMagazineMediaPath`). `assembleCornerInput(client, context, issueId)`의 세 번째 인자가 필수가 됐다(호출 54곳·하네스 1곳 갱신). `PhotoRef.path`·`PhotoRecord.source.path`가 목적지 경로다. 복제 목록은 content의 경로에서 항목 ID를 읽어 `data_entries.storage_path`를 다시 읽고, 같은 함수로 다시 계산해 대조한다(다르면 던진다, content는 고치지 않는다).
- **열린 판단 - 썸네일·그림 경로**: MASTER §17-0-10-D는 사진 경로만 정한다. `PhotoRef.thumbPath`(입력 조립이 `thumb_path`를 그대로 싣는다)와 그림 유저 기록의 `path`(`drawing_path`)는 `entries` 버킷 원본 경로 그대로이고 복제하지 않는다. 발행물이 원본 버킷을 가리키므로 조판(`55-`)·뷰어(U3) 전에 정해야 한다.
- P7 복제는 사진 경로만(`date_archive`의 `stops[].photos[].path`, `this_month`의 `photoPath`). `dateLevel` 사진은 저장 스키마에 없어 복제 대상이 아니다. 원본이 지워졌으면(항목 삭제·객체 없음) 복제하지 않고 그 코너를 `pending` + `last_error = 'source_media_missing'`로 되돌리고 발행 명령은 "다시 준비 중"으로 거부한다.
- 존재 확인: supabase-js `storage.exists()`가 없는 객체에 400을 오류로 돌려줬다(실측) - 폴더 `list` + 이름 일치로 확인한다.
- `source_date_ids`: 저장 함수가 쓰지 않아 17-1 코너 저장 직후 운영 경로가 저장된 content의 `articles[].dateId`로 채운다(이번 기간·재소환 모두, `fn_publish_issue`가 읽는다). 다른 코너는 비워 둔다.
- 안전 정지 경보: `usage_over`, `detail = { stage: 'input_halt', cornerType, estimatedInputTokens, limit }`. 같은 호에 열린 경보가 있으면 생성 명령도 돌지 않는다(반복 방지). 소속 위반(`CoupleMembershipError`)은 `couple_membership` 경보(`detail`에 위반 레코드 ID)를 남기고 던진다.
- 샘플 코너가 재료 0이면 골격의 선행 검사가 호출 전에 `skipped(insufficient_input)`로 멈춘다. 샘플 17-5는 근거가 둘보다 적으면 `{"kind":"none"}`을 낸다.
- 시험 데이터: `seedTestData.ts`가 커플 A(생성 시험, 초안으로 남김)·B(생성->발행, `magazine_theme='neon'`)·C(해제 유예)·F(예외·동시 발행 호 넷). 목록은 `scripts/ops/out/seed-m2b.json`(gitignore) - **지우지 않는다.** F의 열린 경보 `usage_over`는 시험용으로 열어 둔 채다. 커플 A의 초안 호는 `55-` 조판 시험에 쓸 수 있다(발행은 조판 뒤).
- 테스트 위치: `scripts/ops/operatorPath.test.ts`(메모리 저장소 `opsMemoryStore.ts`, 27건), `supabase/functions/_shared/mediaPath.test.ts`(5건), `inputPrefilter.test.ts`에 R20-1 1건. `scripts/ops`는 두 tsc 모두에서 제외라 이 파일들의 타입은 게이트가 아니라 `deno check --config supabase/functions/deno.json scripts/ops/*.ts`로 확인했다.
- 변경한 설정 파일: 없음(package.json·app.json·eas.json·tsconfig.json·deno.json 무변경). `deno check`가 만든 `supabase/functions/deno.lock`은 지웠다.

## UI 기반 U0 (`53`, 2026-10-21, ui-builder) - 화면 교체 없음, 실기기 미확인

내부 결정(항목당 한 줄):

- 파일 경계: 컴포넌트는 `src/components/nocturne/`(옛 `Button`·`PageHeader`·`Numeral`과 이름이 겹쳐 새 폴더로 분리), 배럴 `index.ts`. 토큰 `src/theme/nocturne.ts`, 훅 `src/hooks/useReducedMotion.ts`. 옛 테마는 건드리지 않았다.
- 시험 위치: `__tests__/components/nocturne.test.tsx` 한 파일(29건). Reanimated 4는 jest에서 `react-native-worklets/lib/module/mock`을 먼저 mock해야 로드된다(시험 파일 안에서 처리, `jest.setup.js`·package.json jest 설정은 건드리지 않음).
- 확인 화면: `app/dev-components.tsx`(라우트, MASTER 11-3 표에 없음) -> 본체 `src/components/nocturne/dev/ComponentGallery.tsx`. 열기: 개발 빌드에서 `ondolog://dev-components`. 본체 require는 `if (__DEV__)` 긍정형 안에만 있다. `expo export --platform android` 출시 번들에서 본체 문자열 0건 확인(`if (!__DEV__) return` 뒤 require는 번들러가 못 지워 처음엔 번들에 들어갔다 — 긍정형으로 고침). 출시 빌드에서 이 경로로 가면 `/`로 되돌린다. 앱 안에 링크는 없다.
- 사진 장막: `experimental_backgroundImage` 선형 그라디언트(`PhotoScrim.tsx`). 장막 PNG 대체는 만들지 않았다 - 실기기(`51-`)에서 안 되면 PhotoScrim 한 파일만 PNG(1x140)로 바꾼다.
- 그레인: `Grain` 컴포넌트만 만들고 루트 레이아웃에는 마운트하지 않았다(마운트하면 옛 화면 전체가 바뀐다). 첫 새 화면(U1) 때 `app/_layout.tsx` 루트에 1회 올린다. 확인 화면은 자체에서 1회 마운트.
- 그레인 타일 크기: 256px 파일이 RN `resizeMode="repeat"`에서 @1x 256pt로 깔린다(보드는 128pt 표시). 실기기에서 거칠어 보이면 `grain@2x.png` 이름 규칙으로 정리 - 파일 이름 변경은 하지 않았다.
- 하늘 높이: 폭 = 화면 폭, 높이 = 화면 높이 x 2.37, 오프셋은 `sky.ts` pt 값 그대로. 화면 비율이 390x844와 다르면 이미지가 약간 늘어난다(`cover`).
- 장막: `sky.ts` `veilOpacity`(main .72)를 그대로 썼다. `Objects-1` 보드의 Veil 설명은 "메인 .42 -> 당김 .14 -> 하늘 0"으로 값이 다르다 - 어느 쪽이 맞는지 디자인 확인 필요. `past`(지난 하늘)는 `sky.ts`에 장막 값이 없어 0(sky와 같게)으로 뒀다.
- 탭 바 활성 표시: `Components` 보드는 별빛 점(lilac), `N-T-Tabs`·지시서는 rose 아이콘 빛. 지시서대로 rose 아이콘 + 반투명 원 + boxShadow. SVG 필터 발광은 RN에 없어 이 방식.
- 탭 바 구성: 그리기 `TabBarView`(확인 화면과 공유) + expo-router 어댑터 `TabBar`. `(tabs)/_layout.tsx`는 `tabBar` 렌더러만 교체, `tabBarStyle`은 두지 않았다(absolute 바라 화면 영역을 줄이지 않음). 옛 화면 하단이 바에 가린다 - 의도된 중간 상태.
- 동작 줄이기: 별 명멸·`RiseIn`은 멈춘다(별은 중간 투명도 고정). 스켈레톤 펄스(.06<->.12)와 누름 scale은 지시 범위 밖이라 그대로 둔다.
- 디자인 보드와 다르게 한 곳: (1) 비활성 버튼 글자는 보드가 textFaint지만 글자 금지 규칙이라 textMute. (2) 비활성 ListRow는 글자색 대신 투명도 .55. (3) 참여 대기 칩 글자는 보드의 연보라(`#D7C9FA`)가 토큰에 없어 mist. (4) ListRow 높이 56(`Components`)과 54(`Objects-2`)가 달라 56. (5) Segmented 높이 34/패딩 16(`Components`)과 32/14(`Objects-1`)가 달라 34/16.
- 색 개수: `nocturne` 객체는 18색(바탕 6 + 활자 4 + 빛 5 + 종이 3). 지시서의 "색 16"과 맞지 않는다 - 원본 Build 보드 객체를 그대로 옮겼다. 종이 3색을 빼면 15, 어느 쪽도 16이 아니다. PM 확인 필요.
- 파생 색: 컴포넌트는 색 리터럴 없이 `withAlpha(nocturne.x, a)`로 같은 색의 투명도만 바꾼다(`nocturne.ts`의 함수). 칩·선·토글 트랙 등.
- 의존성: `react-native-svg` 15.15.4 · `react-native-worklets` 0.10.1(`expo install`이 정확 버전으로 기록). `npx expo install`은 기존 피어 충돌(`@react-native/jest-preset` 0.86.2 고정 vs `jest-expo`의 ^0.86.3)로 ERESOLVE 실패 -> package.json만 갱신된 상태에서 `npm install --legacy-peer-deps`로 마무리(CLAUDE.md 알려진 이슈의 처방). lock은 추가만 232줄, 삭제 0줄. `zod` 4.6.7 · `@supabase/supabase-js` 2.118.0 해석 버전 그대로 -> `supabase/functions/deno.json` 변경 없음. babel 설정 파일은 필요 없다(babel-preset-expo 57.0.16이 `react-native-worklets/plugin`을 자동 추가; `expo export` 번들 성공으로 확인). `npx expo-doctor` 21/21.
- 변경한 설정 파일: `package.json`(dependencies 2줄), `package-lock.json`. `app.json`·`eas.json`·`tsconfig.json`·`jest.setup.js`·babel 무변경.

## sel-a 좁힘 (`52r3`, 2026-10-21, corner-pipeline) - 오프라인, 실행 안 함

- 내부 결정(겹침): `null` 본문은 `messagesWithoutBody`, 본문이 있는데 공백뿐이면 `trivialMessages`로 따로 센다. `null`은 판정 함수에 도달하기 전에 `continue`하므로 이중으로 세지 않는다. 합치지 않았다(필드·건수 의미 유지).
- 열린 판단: 빈 문자열 `''` 본문은 입력 조립 `reqStr`가 `length === 0`을 무결성 오류로 던진다(`52r2` 이전부터). 즉 운영 경로에서 `''`는 sel-a에 닿지 않고 조립이 실패한다. 위임 범위 밖이라 고치지 않았다. `''`를 "본문 없음"으로 세려면 `inputAssembly.ts`의 `body` 읽기 한 곳을 바꿔야 한다 - 결정 필요.
- 링크뿐인 본문도 이제 남는다(판정이 공백뿐으로만 좁아짐).
- 하네스 `m1InputCandidates.ts` 138행 sel-a `rule` 문구를 새 기준으로 고침(판정 함수는 같은 것을 씀).

## M1b 마무리 (`52r2`, 2026-10-21, corner-pipeline) - 오프라인, 실행 안 함

- 내부 결정: sel-a 판정은 `_shared/inputPrefilter.ts`(`isTrivialMessageText`)에 두고 `inputAssembly.ts`가 메시지 레코드를 만들 때(본문 있음·이번 기간 안) 부른다. 하네스 sel-a도 같은 함수를 쓴다(규칙 중복 방지). 뺀 건수는 `InputExclusions.trivialMessages`(신규 필드), `messagesWithoutBody`와 겹치지 않는다.
- 내부 결정: 토큰 추정은 `scripts/ops/`에서 `_shared/tokenEstimate.ts`로 옮겼다(운영 경로가 `scripts/ops/`를 import할 수 없어서). 하네스 `m1InputCandidates.ts`는 거기서 다시 내보낸다. 안전 정지의 비교 구간은 중간값(`INPUT_TOKEN_STOP_BAND = 'mid'`), 상한은 상수 `INPUT_TOKEN_STOP_LIMIT = 40_000`(`app_config` 아님, 임시 - 최종 값은 M3 실데이터·M1c).
- 내부 결정: 안전 정지 결과는 `CornerPipelineResult`의 세 번째 변형 `CornerPipelineHalt`(`outcome: 'halted'`, `haltedFor: 'input_token_limit'`, `estimatedInputTokens`, `limit`, `detail`, `cornerName?`, `llmCallAttempts: 0`)이고 `reason` 필드가 없다. 위치는 `runCornerPipeline`의 선행 검사 직후·계수 조회 앞(`buildRequest`가 이 자리로 당겨졌다). `cornerName`은 `runCornerModule`이 붙인다. 4값 유니온·Zod 스키마·`SKIP_REASON_RETRY_POLICY`는 손대지 않았다. 호출자(발행 경로)는 `'failure'`만 `saveCornerFailure`에 넘기고 `'halted'`는 코너 행에 사유를 쓰지 않고 운영자에게 알려야 한다(`ops_alerts`는 발행 경로 몫, 이번에 안 넣음).
- 내부 결정: 대표 화보 자격은 코드로 강제했다 - `dateArchive.ts` `deriveFor`(파생값 채우기, 기존 단계)에서 "이번 기간 데이트가 있는데 featured가 재소환"이면 실패시킨다. 실패 사유는 같은 단계의 다른 의미 위반과 같은 `schema_invalid`(최대 1회 재시도, 17-0-5-A). 다른 데이트로 바꿔 끼우지 않는다. 프롬프트의 featured 문구도 같은 규칙으로 맞췄다.
- 내부 결정: `dateLine(record, includeRecalled, includeDateLevel = false)` - 17-1만 `true`. dateLevel은 데이트 줄에 `"dateLevel":{"photoCount":N,"userNotes":[...]}`(구간과 같은 모양, 사진 경로·작성자 ID 없음)로 실린다. 저장 쪽 `copy` 선언에 없어 출력에 새지 않는다. dateLevel 사진은 참조 가능 목록에 원래 없었고(17-1 입력은 데이트만 참조) 더하지 않았다.
- 시험 기댓값 수정: `inputAssembly.test.ts` 201행 `exclusions` 기대에 `trivialMessages: 0` 추가(필드 신설). 입력 수정: 같은 파일 320·334행 본문 `'A'`·`'B'`를 `'안녕 A'`·`'안녕 B'`로(한 글자라 sel-a가 빼서 커플 분리 시험의 의도가 사라짐). 기대값은 그대로.
- 열린 판단(PM): sel-a(52 원안 그대로)가 `50-` 데이터셋에서 `콜 🍺`·`응`·`응?`(기호 뺀 본문이 한 글자)도 뺀다 - 짧아도 실제 답인 말이다. 규칙을 좁힐지(예: 한 글자 한글 답 보존) 결정 필요 / 안전 정지의 비교 구간(중간값)과 40,000이 한글 토큰 실제와 맞는지는 M1c `usage`로 확인 / 어긋난 featured가 재시도에서도 반복되면 코너가 `schema_invalid`로 끝난다 - 이 경우를 다른 데이트로 대체할지는 제품 사실.

## M1b 프롬프트 고도화 (`52`, 2026-10-19, corner-pipeline) - 오프라인, 실행 안 함

- 내부 결정: 입력 상한·사전 선별 후보는 `scripts/ops/m1InputCandidates.ts`(신규, 하네스 전용)에 두고 `m1QualityRun.ts dry --cap <none|all|cap-a|cap-b|cap-c> --select <none|all|sel-a|sel-b|sel-c|sel-d>`로만 부른다. `run`·`inputAssembly.ts`·코너 코드에는 연결하지 않았다. 결과는 `scripts/ops/out/candidates.md`(gitignore).
- 내부 결정: 모든 코너가 공유하는 `COMMON_PRINCIPLES_BLOCK`(`cornerCommon.ts`)도 system 블록이라 고쳤다. 허용 범위 해석이 필요하면 PM이 확인.
- 추정 토큰은 글자 종류별 가중치 합(하한/중간/상한 세 벌). 측정값이 아니다. M1c 응답의 `usage`로 보정.
- 열린 판단(PM): 후보 하나로 정하기(M1c 전) / 3-7 표는 "두 분 정말 다정하셨네요"를 허용하나 17-4·17-5는 같은 부류를 금지 - 코너 문서를 따랐다 / 17-5 소기사 예("예산 갈등과 화해")와 톤 정책 충돌 - 다툼 소재는 소기사·근거에서도 뺐다 / `dateLine`이 `dateLevel`(정거장에 안 묶인 사진·유저 기록)을 프롬프트에 싣지 않는다(입력 형식이라 이번 범위 밖).

## M1 품질 하네스 (`50`, 2026-10-19, corner-pipeline) - 작성 완료, 실행 대기

- 내부 결정: 재료는 DB 행 모양(`dataset.ts`)으로 두고 기존 `assembleCornerInput` + 테스트용 `fakeClient`(`testFixtures/inputAssemblyFake.ts`, 하네스가 import)로 레코드를 만든다. 전송 계측은 `createLlmClient`의 `fetchImpl` 주입점, 시도별 검증은 `processCornerResponse`를 한 번 더 호출 - 골격 무변경.
- 재소환 규칙(건수 = max(0, 3 - 이번 기간 데이트 수)) 때문에 이번 기간 데이트는 2건, 재소환 1건(+사진 없어 탈락하는 과거 1건)이다.
- 실행 명령은 `m1QualityRun.ts` 머리 주석. `--no-lock` 사용(deno.lock을 만들지 않는다). 막힌 이유: 공급자 크레딧 부족.
- 출력 잘림(`50r2`, R16-4): `stop_reason=max_tokens`이면 하네스 래퍼 클라이언트가 이후 호출(골격의 `schema_invalid` 1회 재시도)을 네트워크 없이 `generation_failed`로 거부하고, 실행 기록에 `truncated: true`, review·summary에 잘림 표시. `maxTokens` 4096 그대로, 골격 무변경. 이 경우 기록의 `failureReason`은 `generation_failed`, `llmCallAttempts`는 2(실제 전송 1회 - `httpCalls` 기준).

## 발행 경로 마이그레이션 (`47`, 2026-10-11, db-architect) - 작성만, 원격 미적용

근거는 SCHEMA §9-D(9-D-1~8)뿐. 원격 DB 접속·DDL·DML 없음(저장소 안 파일만 읽음). 커밋 없음.

**산출물**: `supabase/migrations/022_publish_path.sql`(001~021 다음 번호), `scripts/db/verify_022_publish_theme_trigger.sql`(실증 SQL, 021 때의 `scripts/db/verify_021_theme_trigger.sql` 옆).

**1. §9-D가 참조하는 기존 객체 - 전부 있음, 이름·타입 일치 (멈춤 조건 해당 없음)**

| 객체 | 위치 |
|---|---|
| `issues.issue_number integer not null check (>0)` · `is_trial boolean` · `published_at timestamptz` · `period_start date` · `couple_id` | 009 |
| `issues.theme text not null default 'basic'` · `couples.magazine_theme text` | 021 |
| 기존 `unique (couple_id, issue_type, issue_number)` (이름 없는 인라인, 자동 명명) | 009 |
| `couples.status couple_status` (값 `active` 있음) | 005 · 002 |
| `corners.source_date_ids uuid[]` · `skip_reason text` · `generation_attempts smallint not null default 0` · `status corner_status` · `corner_type` (값 `date_archive` 있음) · `issue_id` | 009 · 002 |
| enum `issue_type` · `corner_type` · `corner_status` (값 `ready`·`published` 있음) | 002 |
| `dates.last_featured_at timestamptz` · `feature_count integer not null default 0` | 006 |
| `public.is_couple_member(uuid) returns boolean` | 011 |
| `public.fn_issues_theme_immutable()` · `tg_issues_theme_immutable` | 021 |
| 새로 만드는 이름(`corner_batches`·`ops_alerts`·`uq_issues_period`·`chk_*`·`fn_publish_issue`·`fn_issue_progress`·`fn_issues_theme_on_publish`·`batch_id`·`llm_usage`)과 겹치는 기존 정의 | 없음 (migrations·`src/types` grep) |

**2. `magazine` 버킷 정책 (015)**

- 73행 `magazine_storage_select` (SELECT, authenticated): `bucket_id = 'magazine' and public.is_couple_member(((storage.foldername(name))[1])::uuid)` - **유지**.
- 80행 `magazine_storage_insert` (INSERT, authenticated): `with check ( bucket_id = 'magazine' and public.is_couple_member(((storage.foldername(name))[1])::uuid) )` - **022에서 `drop policy if exists`로 삭제** (§9-D-8).
- UPDATE·DELETE 정책: **저장소 어디에도 없음**(015 이후 019도 avatars만). 지운 것 없음. 단 원격이 저장소와 같은지는 확인 못 했다 - 적용 후 `select policyname, cmd from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'magazine%'`로 SELECT 하나만 남는지 본다.

**순서를 바꾼 곳**: 없음. §9-D-1~8 순서 그대로(`ops_alerts`가 `fn_publish_issue`보다 먼저). 더한 객체·제약·인덱스·권한 없음. `drop policy`에 `if exists`만 붙임(원격에 이미 없어도 적용이 실패하지 않게).

**알려둘 것**
- `corner_batches`·`ops_alerts`는 RLS만 켜고 정책이 없다. §9-D-2·5가 정한 대로 service_role 전용이며, 절대 규칙 5의 "정책 함께 작성"은 deny-by-default로 충족한다(`magazine-print`·`avatars` 선례).
- `fn_publish_issue`는 §9-D-6대로 `security invoker`. HANDOFF `46` 절의 "security definer" 권고와 다르다 - SCHEMA가 원본이라 SCHEMA대로 썼다. service_role이 부르므로 RLS를 우회해 동작한다.
- 적용 전 관문 두 쿼리(§9-D 머리)는 파일에 없다. 적용 직전에 사람이 돌린다(둘 다 0).

**4. 테마 트리거 실증 SQL** - `scripts/db/verify_022_publish_theme_trigger.sql`. 실행은 적용 후 사람이.
함수가 `public.couples`를 스키마 한정으로 읽어서 임시 테이블로는 못 가리킨다. 그래서 `pg_get_functiondef`로 **실제 함수 정의를 읽어 `public.couples`만 `pg_temp.t_couples`로 치환**해 임시 함수로 만들고(로직은 원본 그대로), `t_issues`에 immutable 트리거(실제 함수)와 함께 이름 순서대로 건다. 보는 것: (a) 초안 행에 `published_at`을 채우면 `theme` = 그 커플의 `magazine_theme`(`lovely`), 초안으로 남긴 행은 `basic` (b) 발행된 행의 `theme` 변경은 예외(id `...0002`). **이 SQL은 실행해 보지 못했다** - 특히 `pg_temp` 함수를 임시 테이블 트리거에 거는 부분이 첫 실행에서 막힐 수 있다. 막히면 대안: 원격 `public.couples`에 행이 하나라도 있으면 그 `id`를 `couple_id`로 써서 실제 함수를 그대로 건다(읽기만 하므로 `couples`는 바뀌지 않는다).

**5. `fn_publish_issue` 실증 방법 제안 (실행하지 않음)** - 사람이 정한다.
- **A (권장, 원격 `auth.users` 불필요)**: 4와 같은 치환을 확장. `create temp table t_issues (like public.issues including all)`(CHECK·UNIQUE 포함 복사, FK·트리거는 안 따라옴)와 `t_couples`·`t_corners`·`t_dates`·`t_ops_alerts`를 만들고, `pg_get_functiondef`로 읽은 함수 문자열에서 `public.`을 `pg_temp.`로, `set search_path = public`을 `set search_path = pg_temp, public`으로 치환해 임시 함수 생성. 두 테마 트리거도 `t_issues`에 건다. 한 파일, 세션 종료 시 사라짐. 사례: (1) 정상 발행 - 번호 1, `is_trial` true, 코너 `ready`->`published`, `date_archive` 코너의 `source_date_ids`에 든 데이트만 `feature_count`+1·`last_featured_at` 갱신, `theme` 복사 (2) 같은 커플 두 번째 호 - 번호 2, `is_trial` false (3) 다른 `issue_type`은 번호 따로 (4) 예외 4종: 이미 발행됨 / 열린 경보 / `ready` 코너 없음 / 커플이 `active` 아님 / 없는 id (5) 경보 `resolved_at`이 있으면 통과. 못 보는 것: 진짜 FK, 진짜 RLS·권한, 행 잠금의 동시성.
- **B (권한만, 읽기 전용)**: 적용 후 `select has_function_privilege('anon'|'authenticated'|'service_role', 'public.fn_publish_issue(uuid)', 'execute')` -> false·false·true, `fn_issue_progress`는 anon false, authenticated true. `pg_proc.prosecdef`(발행 false, 진행 true)·`proconfig`(`search_path=public`).
- **C (가장 충실, 원격 밖)**: 로컬 `supabase start`(Docker) 또는 Supabase 브랜치에 001~022를 적용하고 실제 `auth.users`부터 픽스처를 넣어 동시 발행(두 세션)까지 본다. 원격 운영 DB는 건드리지 않지만 도구 준비가 필요하다.
- 추천: A + B를 적용 직후, C는 발행 Edge Function 통합 시험 때.

**사람이 할 일(순서)**: 관문 쿼리 2개 -> `022` 적용 -> `verify_022_publish_theme_trigger.sql` 실행 -> B -> 정책 확인 쿼리 -> `src/types/database.ts` 재생성(이번 작업에서는 손대지 않음).

## 022 실증 스크립트 (`47b`, 2026-10-11, db-architect) - 작성만, 실행 안 함

근거는 SCHEMA §9-D-9(r53) 표뿐. 원격 접속·실행 없음(저장소 파일만 읽고 씀). 커밋 없음. 실행은 메인 세션이 사람의 적용 확인 뒤에. `47` 절 4·5번(치환 방식 제안)은 이 절이 대체한다.

| 파일 (`scripts/db/`) | §9-D-9 행 | 확인 항목 |
|---|---|---|
| `verify_022_publish_theme_trigger.sql` (기존 파일 수정) | 테마 복사 트리거 | 진짜 `fn_issues_theme_on_publish`·`fn_issues_theme_immutable`을 `like public.issues` 임시 테이블에 건다. 원격 `couples` 실제 행에서 `couple_id`·`magazine_theme`를 읽는다. (a) 초안 행 theme가 커플 값과 다름(입력 상태) (b) `published_at` 채움 -> theme = 커플 값 (c) 발행된 행 theme 변경 -> 예외, 메시지에 그 issue id. 원격 `couples` 0행이면 `DEFERRED`(48- C)만 출력. 함수 없으면 `STOPPED` |
| `verify_022_publish_logic_copy.sql` (신규) | `fn_publish_issue` 논리 A | `replace(pg_get_functiondef(...), 'public.', 'pg_temp.')` 한 번으로 사본 생성(치환 명령은 파일 머리에 명시). 임시 `issues`·`couples`·`corners`·`dates`·`ops_alerts`. P1 첫 발행(번호 1, `is_trial` true, ready->published, skipped 유지, `date_archive` 날짜만 `feature_count`+1), P2 두 번째(번호 2, `is_trial` false, 누적), P3 유형별 번호, P4 다른 커플 독립·남의 날짜 불변, E1~E5 예외(이미 발행·없는 호·비활성 커플·열린 경보·ready 코너 없음), E4 경보 해소 뒤 발행(번호 3). 사본 치환 자체 점검 2행. 결과에 "논리 확인이며 실제 함수의 증명이 아니다" |
| `verify_022_privileges_and_settings.sql` (신규) | 권한·설정 B | 읽기 전용 SELECT 하나. anon·authenticated 실행 불가, service_role 가능, `prosecdef=false`, `proconfig`의 `search_path=public`, `magazine` 버킷 정책이 `magazine_storage_select`(SELECT) 하나뿐이고 쓰기 정책 0 |

**열린 판단 (PM)**
- 사본의 원본: 지시는 "022 본문에서"인데 SQL은 파일을 읽을 수 없어 **원격에 적용된 함수 정의(`pg_get_functiondef`)**를 치환한다. 022를 그대로 적용했다면 같은 본문이다. 파일 본문을 직접 박아 넣는 방식을 원하면 말해 달라(022 수정 시 어긋날 위험이 있어 택하지 않았다).
- 사본에는 §9-D-4 테마 트리거를 걸지 않았다(범위: 분기·번호·`is_trial`·`feature_count`). `corners`·`issues`는 `including constraints`로 CHECK를 복사하고 FK·UNIQUE는 복사하지 않는다.
- 세 스크립트 모두 한 번에 실행하는 것을 전제로 했고 **실행해 보지 못했다.** 첫 실행에서 구문·타입 문제가 나올 수 있다.

## 022 적용·실증 결과 (`47b` 실행, 2026-10-11, 메인 세션)

022는 `npx supabase db push`로 원격(`ondolog`)에 적용했다. 적용 전 `migration list`에서 001~021은 Local·Remote 일치, 022는 Local에만 있었고, `--dry-run`은 `022_publish_path.sql` 하나만 보였다. 적용 후 022도 양쪽에 있다. 실행 전 읽기 전용으로 `fn_publish_issue`·`fn_issue_progress`·`fn_issues_theme_on_publish`·`corner_batches`·`ops_alerts`가 있는 것을 확인했다. 실행 순서는 B -> 트리거 -> A, 도구는 Supabase MCP `execute_sql`. 첫 실행에서 오류는 없었다. 실행 뒤 원격 `issues`·`corners`·`couples`·`dates`·`ops_alerts`는 모두 0행이어서 원격에 쓴 것이 없다.

**A 스크립트 수정 (SCHEMA §9-D-9 r54)**: 치환을 둘로 늘렸다 — ① `public.`→`pg_temp.` ② `SET search_path TO 'public'`→`'pg_temp'`. ②의 원문은 원격 `pg_get_functiondef` 출력에서 읽어 맞췄다. 확인 행은 "남은 `public.` 수"를 빼고 (가)·(나)로 바꿨다. 둘 중 하나라도 실패하면 사본을 실행하지 않고 `STOPPED`를 남긴다. 사본의 원본은 적용된 정의(`pg_get_functiondef`)다.

**B — 권한·설정 (`verify_022_privileges_and_settings.sql`)**

| # | 확인 | 기대 | 실제 | 판정 |
|---|---|---|---|---|
| 1 | `fn_publish_issue` 존재 | 1개 | 1개 | OK |
| 2 | anon 실행 권한 | false | false | OK |
| 3 | authenticated 실행 권한 | false | false | OK |
| 4 | service_role 실행 권한 | true | true | OK |
| 5 | prosecdef (security invoker) | false | false | OK |
| 6 | proconfig 의 search_path | `search_path=public` 포함 | `search_path=public` | OK |
| 7 | magazine 버킷 정책 목록 | `magazine_storage_select` (SELECT) 하나 | `magazine_storage_select (SELECT)` | OK |
| 8 | magazine 버킷 쓰기 정책 수 | 0 | 0 | OK |

`fn_issue_progress` 권한은 §9-D-9 B에 없는 항목이라 확인하지 않았다.

**테마 복사 트리거 (`verify_022_publish_theme_trigger.sql`)**: 원격 `couples`가 0행이어서 `DEFERRED`로 끝났다(실증하지 않음). `48-` C에서 확인한다 — 열린 항목에 있다.

**A — `fn_publish_issue` 논리 (`verify_022_publish_logic_copy.sql`)** — 논리 확인이며 실제 함수의 증명이 아니다

| # | 확인 | 기대 | 판정 |
|---|---|---|---|
| 1 | 사본 (가) 다섯 테이블 모두 `pg_temp.` | 빠진 테이블 없음 | OK |
| 2 | 사본 (나) proconfig | `search_path=pg_temp` | OK |
| 3 | P1 첫 발행 호출 | no exception | OK |
| 4 | P1 번호·is_trial | `issue_number=1 is_trial=true published=true` | OK |
| 5 | P1 코너 상태 | ready->published 2, skipped 유지 1 | OK |
| 6 | P1 feature_count (date_archive 코너의 날짜만) | `da1=1+ts da2=1+ts da3=0` | OK |
| 7 | P2 번호 증가·is_trial 해제 | `issue_number=2 is_trial=false` | OK |
| 8 | P2 feature_count 누적 | `da1=2 da2=1` | OK |
| 9 | P3 유형별 번호 | `issue_number=1 is_trial=false` | OK |
| 10 | P4 다른 커플 첫 발행 | `issue_number=1 is_trial=true` | OK |
| 11 | P4 날짜는 같은 커플 것만 | `db1=1 da3=0` | OK |
| 12 | E1 이미 발행됨 | `issue … already published` | OK |
| 13 | E2 없는 호 | `issue … not found` | OK |
| 14 | E3 커플이 active 아님 | `couple … is not active` | OK |
| 15 | E4 미해소 경보 | `issue … has an open alert` / published_at null | OK |
| 16 | E5 ready 코너 없음 | `issue … has no ready corner` | OK |
| 17 | E4 경보 해소 뒤 발행 | `issue_number=3 is_trial=false` | OK |
| 18 | 주의 | 논리 확인이며 실제 함수의 증명이 아니다 | NOTE |

실제 함수·FK·RLS·동시 발행 잠금은 `48-` C에서 증명한다.

**타입 재생성 (SCHEMA §9-D-10 r55)**
- 명령 (R56-3): `[Console]::OutputEncoding = [Text.Encoding]::UTF8; npx supabase gen types typescript --linked | Out-File -Encoding utf8 src/types/database.ts` (PowerShell)
- `git diff --stat`에 `Bin`이 나오면 커밋하지 않는다.
- `demo_responses` 보존 시험 = 편입 파일 뒤 모든 마이그레이션에 적용 · 이 테이블을 바꾸는 마이그레이션은 PM의 명시 허가 없이 쓰지 않는다(R56-5).
- 근거: `.claude/state/prompts/phase-7/23-main-session-dispatch-theme.md:221`, `.claude/state/archive/progress-20260928.md:186`. 출력도 기존 파일과 같은 UTF-8 BOM + CRLF였다.
- 먼저 scratchpad에 생성해 판정한 뒤 같은 명령으로 실제 경로에 썼다.
- diff 요약: +108 / −3
  - 바뀐 줄은 `issues.issue_number` 세 곳뿐: Row `number`→`number | null`, Insert `number`→`?: number | null`, Update `?: number`→`?: number | null` (§9-D-10의 허용 예외)
  - 추가: 테이블 `corner_batches`·`ops_alerts`(FK 포함), `corners.batch_id`·`llm_usage`(Row·Insert·Update)와 FK `corners_batch_id_fkey`, 함수 `fn_issue_progress`·`fn_publish_issue`
- 게이트: tsc 0 / functions tsc 0 / jest 986 · 49. 이 변경으로 생긴 tsc 오류는 없다.

## 입력 조립 (`44-r2`, 2026-10-09, corner-pipeline) - 열린 판단 있음

원본은 MASTER §17-0-9. 만든 것: `supabase/functions/_shared/inputAssembly.ts`(`assembleCornerInput(client, context)` -> `{messages, photos, dates, records, exclusions}`), `_shared/kstTime.ts`(시각 변환 모듈 하나, import 없음), 시험 `_shared/inputAssembly.test.ts`·`_shared/testFixtures/inputAssemblyFake.ts`. 시간대 시험(`__tests__/functions/timeOfDayLabelTimezone.test.ts`)에 `kstTime` 케이스를 더했다(기존 케이스 무변경). 바꾼 타입(`corners/cornerCommon.ts`): 머리 주석 교체, `ChatMessageSource.attribution`을 `Attribution & { source: 'chat' }`로 좁힘, `DateSource.dateLevel?` 추가(선택). 멈춘 부분은 없다. 아래는 §17-0-9가 정하지 않아 고른 것이다.

| 판단 | 고른 것 | 근거 / 확인할 것 |
|---|---|---|
| 데이트 단위(`date_id`만 있는) 사진·유저 기록의 자리 | `DateSource.dateLevel?: {photos, userNotes}` 신설(선택 필드) | F "데이트 단위에 붙인다"인데 타입에 자리가 없었다. 코너(17-1)가 이 값을 지면에 쓸지는 기획 몫 |
| `Attribution.source` 1:1 | 메시지 레코드만 `attribution`을 싣고 값은 `'chat'`. 사진·데이트는 `attribution`이 없다 | `'feed'`·`'story'`에 대응하는 레코드 종류가 없다. 값 대응이 필요하면 PM 확인 |
| 유료 커플의 `access_locked=true` 행 | 열람 가능으로 본다(`is_entry_visible`과 같은 결과) | A-3 "같은 결과"와 D "잠긴 항목은 넣지 않는다"가 이 칸에서만 갈린다. D는 유료 전환 시 잠금이 풀린다고 전제 |
| `profiles.deleted_at` | 걸지 않는다 | A-2 "컬럼이 있으면 모두"와 F "탈퇴 유예 중에도 그대로 쓴다"가 충돌 - 구체적인 F를 따름. `profiles`엔 `couple_id`도 없어 `id`로만 읽음 |
| "기간을 N년 앞으로 옮긴 구간" | 과거 방향(`[start-N년, end-N년)`), N은 포함하는 가장 작은 N, 말일 보정(2월 29일 -> 28일) | C-1 "기간 시작 이전"과 한 방향. 일자 보정 규칙은 문서에 없다 |
| 6개월 / `last_featured_at` 비교 | `kstShiftMonths(기간 시작, -6)`, 엄격 `<`(경계 시각은 부적격), 일자가 없으면 말일 | 위와 같음 |
| 후보 4 "열람 가능한 사진" | 크기(width/height) 없는 사진도 센다 | 문자 그대로. 그 사진만 있는 과거 데이트는 후보가 되지만 지면엔 사진 0장 - 엄격히 하려면 PM 결정 |
| 날짜 컬럼 상한 | `lt`에 `kstDateExclusiveUpperBound(end)` (끝이 자정이면 그 날짜, 아니면 다음 날짜) | B "기간보다 좁지 않다". 끝이 자정이 아닌 기간을 시험으로 고정 |
| 잠긴 항목 건수의 범위 | 이번 기간 범위(기간 안 촬영 사진 + 이번 기간 데이트에 묶인 항목)만 센다. 재소환 후보의 잠긴 항목은 세지 않는다 | F가 범위를 정하지 않았다. 보조 쿼리(`access_locked=true`)는 세기만 하고 A-3의 보수다 |
| 시각 없는 독립 사진 건수 | 기간과 무관하게 전체 건수 | 시각이 없어 기간에 귀속할 수 없다 |
| 재소환 데이트의 사진 | `PhotoRecord`로 따로 내지 않고 정거장(`PhotoRef`)에만 싣는다 | 기간 이전이라 `recalled:false` 사진 레코드는 골격의 기간 단언에 걸린다 |
| `kstDisplayStamp`(`"2026.08.22 09:20"`) | `kstTime.ts`에 함수 추가 | 출처 표기 형식은 CORNER_CONTENT §2 예시. E 표에 없지만 "형식 변환 함수" 범위로 봄 |
| 페이지네이션·`in` 쪼개기 | 1000행 단위 `range`, `in` 목록 100개씩 | PostgREST 행 상한·URL 길이. 값은 구현 선택 |
| `last_featured_at` 필터 | 쿼리가 아니라 코드에서 거른다(과거 데이트 전체를 읽음) | `or` 필터를 클라이언트 타입에 넣지 않으려는 것. 데이트 수는 채팅보다 작다 |

발행 경로로 넘긴 것(범위 밖): `last_featured_at`·`feature_count` 갱신, 채팅 입력량 상한, 해제 유예 커플 발행 여부, 17-5 기간 넓히기, 17-1 선별 상한, 실제 `SupabaseClient`가 `InputAssemblyClient`를 구조적으로 만족하는지의 실물 확인(가짜 클라이언트로만 시험).

## 입력 조립 후속 (`45`, 2026-10-09, corner-pipeline, r50 반영)

원본은 MASTER §17-0-9 (r50). 위 `44-r2` 표의 해당 두 행("후보 4"·"잠긴 항목 건수의 범위")은 이 절이 대체한다. 멈춘 부분 없음.

| # | 항목 | 변경 전 | 변경 후 |
|---|---|---|---|
| 1 | 후보 4 (C-4) | 크기(width/height) 없는 사진도 "사진 1장 이상"으로 셌다 | D·F에서 빠지지 않고 남는 사진만 센다(`inputAssembly.ts` 후보 판정 루프에서 크기 null 사진 건너뜀). 이 판정에서 거른 사진은 `photosWithoutSize`에 세지 않는다(후보 판정의 일부). 시험 추가: 크기 없는 사진만 있는 과거 데이트는 후보가 아니다, 크기 있는 사진이 하나라도 있으면 후보다. 잠긴 사진만 있는 과거 데이트 시험은 그대로 통과 |
| 2 | `kstDisplayStamp` (F 출처 표기) | 코드 확인 결과 이미 `"2026.08.22 09:20"` 형식이고 `— `가 없었다 | **코드 무변경.** 시험만 추가: 1월 5일 03:07 KST에 `"2026.01.05 03:07"`, 모든 표기가 `^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}$`이고 `—`로 시작하지 않음(시간대 5곳 자식 프로세스) |
| 3 | 잠긴 건수 범위 (D 마지막 문단) | 확인 결과 이미 이번 기간 조회(기간 안 촬영 사진 + 이번 기간 데이트에 묶인 항목)만 센다. 재소환 후보 조회는 `countLocked=false` | **코드 무변경.** 시험만 추가: 재소환 후보의 잠긴 사진(`lock-old`)은 세지 않아 기존 데이터에서 3, 과거 데이트만 있는 경우 0 |

고친 기댓값 없음(기존 assertion 무수정, 시험 추가만). 바꾼 파일: `supabase/functions/_shared/inputAssembly.ts`(1), `_shared/inputAssembly.test.ts`(1·3), `__tests__/functions/timeOfDayLabelTimezone.test.ts`의 `kstTime` describe(2; 한 자리 시각 순간 하나를 `kstEpochs`에 더하고 it 하나 추가). `kstTime.ts` 무변경.

## 발행 경로 설계 보고 (`46`, 2026-10-09, corner-pipeline) - 코드 없음, 승인 대기

코드·테스트·마이그레이션·docs 변경 없음. DB·외부 API 접속, 비밀값 접근 없음(저장소 안 파일만 읽음). 원본: ROADMAP r10 Phase 7 행, MASTER §17-0-4-B·§17-0-5-B/E/F·§17-0-6·§17-0-8·§17-0-9, §8-3, §6-7, SCHEMA §9-1·§9-2·§9-C·§10-6·§12, 코드 `_shared/` 전부. 아래 "공급자(Anthropic) API 사실"로 표시한 것은 저장소 문서에 없는 내 지식이며 구현 전 공급자 문서로 확인해야 한다.

### 1. 호 하나의 발행 흐름과 상태 전이

새 컬럼 없이 기존 컬럼으로 표현한다. 호의 상태는 `issues.published_at`(null=초안)과 코너 행의 `status`에서 읽는다.

| 단계 | 하는 일 | 코너 `status` | 실패하면 어디로 / 무엇이 남나 |
|---|---|---|---|
| P0 호 준비 | 대상 커플 선별, 기간 산출(발행 주기 config), `issues` 행(`published_at` null)과 대상 코너 3종 행 `pending` 생성 | 없음 -> `pending` | insert 실패는 던지고 그 커플만 건너뛴다. 남는 것: 만들어진 행. 재실행은 같은 `(couple, issue_type, issue_number)` 행을 재사용(issues는 unique로 멱등, corners는 unique 없음 - Q2) |
| P1 입력 조립 | `assembleCornerInput(service_role 클라이언트, context)`. 17-5 기간 넓히기는 호출 전에 `context.period`를 넓혀 넘긴다. 채팅 입력량 상한의 적용 자리는 조립 결과를 코너 입력으로 넘기기 전(값은 실측 후) | `pending` 유지 | DB 오류는 일반 `Error`: 그 커플의 이 호를 이번 실행에서 보류, 행은 `pending`으로 남고 다음 실행이 다시 시도. `CoupleMembershipError`는 P2와 같은 처리 |
| P2 요청 만들기 + 소속 단언 + 선행 검사 (배리어) | 3코너 **전부**에 대해 ⓪ 소속 단언, ① 선행 검사, `buildRequest`를 먼저 끝낸다. 하나라도 `CoupleMembershipError`면 **그 호 전체 중단 + 운영 경보**(r48, 호출자 몫). 전부 통과한 뒤에야 재료 0인 코너를 `skipped`(`insufficient_input`, attempts 0)로 저장 | 통과 후 일부 `pending`->`skipped` | 중단 시: 어떤 코너도 제출·저장되지 않았고 전부 `pending` 그대로, 사유 4값은 기록하지 않는다(17-0-4-B). 배치라서 이 배리어가 자연스럽다(제출 전에 3코너의 단언을 모두 본다). **골격 변경 필요**: 지금 `runCornerPipeline`은 ⓪~⑤를 한 함수에서 부르며 호출이 안에 있다. 배치는 "요청 준비(⓪+①+buildRequest)"와 "응답 마무리(④⑤)"를 나눠야 한다. 코너 코드는 건드리지 않는다(17-0-5-F) |
| P3 배치 제출 | 요청이 있는 코너를 한 배치로 제출(코너 행 ID를 요청 식별자로). 제출 성공 후 배치 ID와 코너의 대응을 보관 | `pending`->`generating` | 제출 실패는 `pending` 유지, 다음 실행이 재제출(이중 제출 방지는 `generating`+보관된 배치 ID로). 배치 ID 보관 위치가 스키마에 없다(Q4) |
| P4 결과 수신 | 배치가 끝나면 결과를 코너별로 받는다. 성공 응답의 사용량(`cache_creation_input_tokens`·`cache_read_input_tokens`)을 읽어 §17-0-8 확인 | `generating` 유지 | 항목이 오류·만료·취소면 전송 수준 실패와 같은 취급(호출 1회 소모). 예산 남음 -> 다음 라운드 재제출, 소진 -> P5의 `generation_failed`. 배치가 안 끝나면 `generating`으로 남아 다음 실행이 이어서 폴링(최대 대기 Q5) |
| P5 검증·저장 | `processCornerResponse`(JSON.parse -> FORBIDDEN_KEYS -> Zod -> 빈 결과 -> ID 해석 -> 원문 채우기 -> 파생값 -> 저장 스키마) 후 `saveCornerSuccess`/`saveCornerFailure` | `generating`->`ready` / `skipped`(`insufficient_input`, attempts>=1) / `failed`(`schema_invalid`·`forbidden_content`·`generation_failed`) | `schema_invalid`는 1회만 다음 라운드(P3)로 되돌린다. `forbidden_content`·빈 결과는 재시도 없음. 호출 예산 3회(17-0-5-A/C)는 **라운드를 넘어 코너 단위**로 세야 하므로(17-0-5-F 마지막 문단) `generation_attempts`에 영속해야 한다. 지금의 `createLlmClient` 예산은 프로세스 메모리 안이라 배치에는 맞지 않는다 |
| P6 발행 판정 | 모든 코너가 `ready`/`skipped`/`failed` 중 하나가 되면 `ready` >= 1을 본다(17-0-6) | 변화 없음 | `ready` 0개면 **발행하지 않는다**: 호는 초안, 코너는 `skipped`/`failed`로 남고 사유가 기록돼 있다. 실패한 코너만 다시 만든다(멱등). 성공한 산출물은 그 달에 귀속된 채 남고 다음 호로 넘기지 않는다 |
| P7 미디어 복제 | `ready` 코너 content의 미디어 경로 필드를 `magazine` 버킷으로 복제(service_role)하고 경로를 치환해 content 갱신 | `ready` 유지 | 복제 실패는 4값에 없다(Q9) -> 코너 상태를 바꾸지 않고 **발행을 중단**, 호는 초안. 이미 복제된 파일은 남는다: 목적지 경로를 결정적으로 정하면 재실행이 같은 경로를 덮어써 멱등. 호가 영영 발행되지 않을 때의 고아 파일 정리는 문서에 없다 |
| P8 발행 확정 | 한 번의 원자적 확정: `issues.published_at` 설정(이 UPDATE에서 테마 복사 트리거 작동, §9-C-7), `ready`->`published`, 실린 데이트의 `last_featured_at`·`feature_count` 갱신 | `ready`->`published` | 전부 롤백되어 P7 직후 상태(초안, 복제 완료, `ready`)로 돌아가고 P8만 재시도한다. 원자성은 Postgres 함수(RPC) 하나로만 문서대로 닿는다(아래 4번 옵션 P) |

`skipped`/`failed` 코너는 `published`로 바뀌지 않는다(`corners_select` RLS는 `published`만 보인다).

### 2. "발행 성공"의 정의 (한 줄)

**한 호의 발행 성공이란, `ready` 코너가 1개 이상인 호에서 그 코너들의 미디어 복제·경로 치환이 끝난 뒤 `issues.published_at` 설정(테마 복사 트리거 포함)·`ready`->`published` 전이·실린 데이트의 `last_featured_at`/`feature_count` 갱신이 한 번에 커밋된 것이다.**

- `last_featured_at` 갱신(r49 §17-0-9-C): 이 커밋의 일부이므로 생성만 되고 발행 안 된 호는 간격 판정을 오염시키지 않는다. 별도 후처리로 두면 "발행은 됐는데 갱신이 안 된" 호가 생겨 감지할 표지가 없다(그래서 옵션 P).
- r48 중단: 발행 **이전**(P2)의 일이라 이 정의에 직접 걸리지 않는다. 중단된 호는 P2에서 아무것도 저장하지 않으므로 발행 후보가 될 수 없다. 걸리는 지점은 "중단 뒤 재개 규칙"(Q7).
- 미디어 복제(8-3): 이 정의의 선행 조건이다. 복제 전에는 발행으로 치지 않는다.

### 3. ROADMAP r10 발행 경로 항목 11개 - 단계 매핑

| # | 항목 | 붙는 단계 |
|---|---|---|
| 1 | 배치 API | P3·P4 (+ P5의 라운드 재제출). 엔드포인트는 규칙 C상 `llmClient.ts` 안에만 둘 수 있다 (Q15) |
| 2 | 미디어 복제 | P7 |
| 3 | 테마 복사 | P8 (DB 트리거, SCHEMA §9-C-7) |
| 4 | `skip_reason` CHECK | P5 저장(DB 강제). 마이그레이션 |
| 5 | Deno import map | 전 단계의 배포 선행 조건(사람 작업) |
| 6 | 캐시 적중 확인 | P4. 지금 `llmClient.call`은 텍스트만 돌려줘 사용량을 못 읽는다 -> 결과 타입 확장 필요 |
| 7 | 소속 단언 실패 -> 호 전체 중단·운영 경보 | P2 (배리어) |
| 8 | 발행 성공 후 `last_featured_at`·`feature_count` 갱신 | P8 |
| 9 | 채팅 입력량 상한 실측 | P1 (적용 자리) / 실측은 P4의 사용량으로 |
| 10 | 해제 유예 커플 발행 여부 | P0 (대상 선별) |
| 11 | 입력 조립의 실제 SupabaseClient 연결 확인 | P1 (쿼리 문법·컬럼명) |

### 4. 마이그레이션이 필요한 것

번호는 예약하지 않는다(SCHEMA §13: 착수 시점의 다음 번호).

| 항목 | SCHEMA 절 | 상태 |
|---|---|---|
| 발행 시 테마 복사 트리거 | §9-C-7 | 골격 SQL만 있다. 함수·트리거 이름과 완전한 DDL 없음 |
| `corners.skip_reason` CHECK + `comment` 갱신 | **SCHEMA에 정의된 절이 없다.** MASTER §17-0-5-B와 SCHEMA §9-C-7 끝 문장("한 묶음")에서만 언급. `db-architect`는 SCHEMA만 근거로 삼으므로 절이 먼저 필요하다 | 4값 + NULL 허용 |
| (옵션 P) 발행 확정 함수 | 없음 | 문서에 없는 제안. 이 함수가 P8의 원자성을 준다 |
| (필요하면) 배치 ID 보관 | 없음 | Q4 |
| (필요하면) 제작 탭이 초안 코너 사유를 읽는 경로 | §10-6와 충돌 (D2) | 뷰 또는 정책 |

원자성 옵션: **P(권장)** `security definer` 함수 하나(service_role 전용 실행, 013의 `revoke execute from public` 선례 - DECISIONS 2026-08-23)가 위 세 가지를 한 트랜잭션에서 한다. PostgREST로는 다중 테이블 트랜잭션이 없고 `feature_count = feature_count + 1` 같은 식 갱신도 못 한다. **Q** 함수 없이 순서 쓰기(코너 `published` -> 데이트 갱신 -> 마지막에 `published_at`)는 커밋 지점이 `published_at`이지만, 데이트 갱신이 앞서면 발행 실패 시 오염이 남고 뒤에 두면 충돌 시 갱신 누락을 감지할 표지가 없다. 이 판단은 PM 몫(Q1과 함께).

두 트리거 순서: `tg_issues_theme_immutable`은 `old.published_at is not null`일 때만 막으므로 발행 전이 UPDATE에서는 통과하고, 새 트리거 이름 순서와 무관하게 충돌하지 않는다.

### 5. 사람 작업

1. **Deno import map**: 현재 맨 import 스펙파이어는 `zod` 하나(7개 파일). `supabase/functions/` 아래에 `zod`를 `npm:` 스펙으로 매핑하는 import map이 없다(저장소에 `deno.json` 없음). 버전은 jest가 도는 설치본과 같아야 한다(설치본 zod 4.4.3, supabase-js 2.112.3). 진입점이 생기면 `@supabase/supabase-js` 매핑도 필요. `../../../src/...` 상대 import가 배포 번들에서 해석되는지는 `supabase functions serve`/배포 드라이런으로 사람이 확인해야 한다(나는 접속하지 않았다). `ambient.d.ts`가 `npm:*`를 `any`로 두므로 tsc는 이 오류를 못 잡는다.
2. **비밀값**(절대 규칙 7): LLM API 키를 Edge Function 비밀로 등록. 이름은 문서에 없다(Q12). service_role 키는 앱 코드·저장소에 넣지 않는다 - Edge Function 환경 변수로만. 기본 주입 여부는 배포 환경에서 확인. (74-k2: legacy service_role 키는 2026-11-12 비활성화 - 지금은 목적별 secret key, 같은 규칙.)
3. **LLM 공급자 계정**: 배치 API 사용 가능 여부, 지출 한도, 학습 미사용·데이터 보존 정책 확인(MASTER §6-7 미해결 ② / Part 16-3 법무). ROADMAP "Phase 7 전: 채팅 데이터 AI 활용 고지 문구(법무, 필수)"가 이 단계의 선행인지 PM 확인 - 실제 채팅을 처음 외부 API로 보내는 단계다.
4. **모델 식별자 값**: `app_config.llm_provider`는 `tbd`(010 시드). 정해서 넣는 것은 사람/PM. ROADMAP "LLM 한국어 품질 실측 비교"도 미해결.
5. **마이그레이션 검토·적용**: `db-architect` 산출물을 사람이 검토 후 적용(절대 규칙 5·6).
6. **스케줄 설정**: SCHEMA §11-4는 "Edge Function 스케줄러"라고만 한다. 어떤 메커니즘으로 부를지(Q17)와 그 설정은 사람.
7. **배포**: 함수 배포는 사람(절대 규칙 6).
8. **실물 확인**: 입력 조립 쿼리가 실제 `SupabaseClient`를 구조적으로 만족하는지, 쿼리 문법·컬럼명(항목 11)은 실제 DB에서만 닿는다.

### 6. 문서에 없는 값 / 질문

번호는 이후 지시에서 가리키기 위한 것이다. 값을 정하지 않았다.

- **Q1** 발행 확정의 트리거: 스케줄(17-0-0, 앱이 꺼져 있어도)인가, 유저의 발행 확인(MASTER §9-7-3 "발행 확인 단계는 항상")인가, 둘의 조합인가. 설계는 "생성 완료(`ready`)"와 "발행 확정(P8)"을 분리해 두었으므로 어느 쪽이든 붙는다.
- **Q2** `issues`/`corners` 행을 누가 언제 만드나, `issue_number` 채번 규칙, `corners`에 `(issue_id, corner_type)` 유일성이 없어 재실행 때 중복 행이 생길 수 있음.
- **Q3** 대상 커플 상태 집합(`active`만인가, `dissolving`·`pending` 포함인가) = 해제 유예 항목.
- **Q4** 배치 ID·재제출 상태를 보관할 곳(컬럼·테이블이 없다. 테이블이면 RLS 필요).
- **Q5** 폴링 주기, 최대 대기, 배치 만료·취소 결과를 4값 중 무엇으로 볼지(`generation_failed`로 보는 것이 자연스러우나 문서 없음), 제출 실패가 호출 예산을 쓰는지.
- **Q6** 라운드 간 재시도 간격과 `generation_attempts`의 의미(누적 호출 횟수로 영속)는 17-0-5-F가 "그 작업에서 정한다"고 남긴 것.
- **Q7** 호 전체 중단: 운영 경보의 저장소·수신처, 중단된 호의 재개 규칙(같은 입력 버그로 매 실행 재중단·재경보하는 것을 어떻게 막나).
- **Q8** 전부 실패한 호의 재시도 횟수·간격·트리거, 제작 탭에 사유 표시하는 경로.
- **Q9** 미디어: 저장 경로 형식(`magazine/{coupleId}/{issueId}/...`의 버킷 접두 포함 여부, D5), 파일명 규칙, 복제 대상 필드 목록(`PhotoRef.path`·`thumbPath`·`UserNote.path`·17-5 `photoPath`), 복제 실패·원본 이미 삭제된 경우, 저해상도 상호작용(CORNER_CONTENT §10 열린 항목), 고아 파일 정리.
- **Q10** `last_featured_at`에 쓸 시각(발행 시각? 기간 끝?), `feature_count` 증분 단위, 갱신 대상을 어떻게 아나(17-1 근거 데이트만인가, 17-5가 인용한 데이트도 "실린" 것인가; `corners.source_date_ids`가 있으나 `saveCornerSuccess`는 `source_*_ids`를 쓰지 않는다).
- **Q11** `ValidatedContent`가 된 content의 경로를 치환해 다시 저장하는 합법 경로. 브랜드 생성자는 `validateCornerResponse` 하나뿐이고(r40) 규칙 E가 지킨다. 선택지: (A) 목적지 경로를 입력 조립 단계에서 미리 정해 content가 처음부터 magazine 경로를 갖게 하고 P7은 파일만 옮김(단 "코너는 하지 않는다" 주석과 조립 계약 §17-0-9 변경 필요), (B) 승인 모듈(`cornerPipeline.ts`) 안에 재검증 후 브랜드를 붙이는 두 번째 공개 경로 추가(r40 취지와 충돌, 규칙 E 시험 변경), (C) 치환을 저장 스키마 검증이 없는 별도 쓰기로 둠(0-2 "검증 없이 저장하지 않는다"와 충돌). 고르지 않았다.
- **Q12** LLM 비밀의 이름, 모델 식별자(위 5-4), 코드에 이미 있는 문서 밖 값: `llmClient`의 `maxTokens` 기본 4096, 백오프 시작 500ms.
- **Q13** 커플당 월 비용 상한을 하드 한도로 강제하는지(6-7의 $0.31은 추정치), 비용·사용량 기록의 저장 위치, 배치에서 캐시 유효시간.
- **Q14** 6-7 "비전 필요(이미지 입력 지원 필수)" vs 현재 `LlmRequest`가 텍스트 블록만 가짐(17-1이 사진 연관성을 읽어야 하는가).
- **Q15** 발행 주기·모델을 `app_config`에서 읽을 자리: 규칙 D는 `.from('app_config')`를 `coeffLookup.ts`에만 허용한다. 읽기 모듈을 늘리면 정적 규칙 상수 변경이 필요. 배치 엔드포인트도 규칙 C로 `llmClient.ts`에만 둘 수 있다(같은 호스트).
- **Q16** `issues.is_trial`(첫 호 무료 체험)을 누가 언제 세팅하나.
- **Q17** 발행을 부르는 스케줄 메커니즘.
- **채팅 입력량 상한 - 값 없음, 실측 방법만**: (1) 읽기 전용 집계로 커플·기간별 메시지 수와 글자 수의 분포를 본다(실제 DB 접속은 사람 허가 후). (2) 대표 입력(17-4·17-5, 월간·일간)으로 공급자가 보고하는 입력 토큰 수를 기록해 글자 수와 토큰 수의 관계를 얻는다(소규모 실호출 또는 토큰 세기 기능 - 공급자 문서 확인). (3) 6-7 가정(월간 5코너 입력 70K 등)과 코너별로 비교해 중앙값·상위 분포·최댓값을 본다. (4) 가장 긴 달에 한 요청의 컨텍스트 한도와 비용이 어떻게 되는지 합성 최악 입력으로 한 번 본다. 상한의 값과 형태(토큰 수/건수/사전 선별)는 그 숫자를 보고 PM이 정한다.

공급자(Anthropic) API 사실, 문서 밖이라 확인 필요: 배치는 항목별 식별자를 주고 결과 순서가 요청 순서와 다를 수 있으며, 항목 결과는 성공/오류/취소/만료로 나뉘고 일정 시간 안에 끝나지 않으면 만료된다. 배치 안에서 프롬프트 캐시 적중은 보장되지 않고 최선 노력이라고 알고 있다 - 맞다면 §17-0-8 확인은 "켜져 있다"가 아니라 "실제 적중률"을 재야 하고 6-7 비용 모델의 캐시 가정이 흔들릴 수 있다.

문서 어긋남(고르지 않고 보고):
- **D1** ROADMAP Phase 7 상세(304~314행)의 "7단계"(6단계 미디어 복제, 대상 6종)는 낡았다. r10 Phase 7 행·MASTER §17-0-5-E(미디어 복제는 발행 묶음)·§17-0 머리말(3종)과 다르다. 또 코드 주석(`saveCornerResult.ts` 63~65행, `pipelineContracts.ts` 46~49행)은 `published` 전이를 "Phase 8(발행 로직)의 몫"이라 쓰는데 ROADMAP r10은 발행 경로를 Phase 7에 둔다(Phase 8은 PDF 조판).
- **D2** MASTER §17-0-6은 전부 실패 시 "제작 탭에 사유를 표시"하라는데 SCHEMA §10-6 `corners_select`는 `status='published'`만 보인다. 초안 코너의 `skip_reason`을 앱이 읽을 길이 없다.
- **D3** MASTER §17-0-0(앱이 꺼져도 배치 발행)과 §9-7-3(발행 확인 단계는 항상) - Q1.
- **D4** SCHEMA §9-C-3은 발행 전 `issues.theme`을 바꿀 수 있다고 하고(제작 현황에서 고르는 구간) §9-C-7은 발행 전이에서 `couples.magazine_theme`로 덮어쓴다. 선택값이 어디에 저장되는지(9-C-2는 `magazine_theme`가 "다음 호에 적용될 테마")가 하나로 읽히지 않는다. 또 이번 지시의 원본 표가 이 트리거를 "MASTER §9-7-1"로 적었으나 실제 트리거 서술은 SCHEMA §9-C-7이다.
- **D5** CORNER_CONTENT `PhotoRef.path` 주석은 `magazine/{coupleId}/{issueId}/...`(버킷 이름 포함)인데 `magazine` 버킷 Storage 정책은 객체 경로 첫 폴더가 `couple_id`여야 접근을 준다(015). 저장 값이 버킷 접두를 포함하는지 하나로 읽히지 않는다. (015는 `magazine` 버킷에 구성원 INSERT 정책도 둔다 - 동결 산출물이라는 8-3과 맞는지 확인 필요.)
- **D6** MASTER §17-0-5-B는 "Phase 7은 마이그레이션 없이 끝낸다 / CHECK는 폰 복귀 후 재빌드 묶음으로 미룬다"인데 ROADMAP r10과 SCHEMA §9-C-7은 CHECK·트리거를 Phase 7 발행 묶음에 둔다.
- **D7** MASTER §6-7 "추상화 레이어는 `src/services/llm/`"와 §17-0-0·규칙 C(`supabase/functions/_shared/llmClient.ts`가 유일한 호출 경로).

### 7. 확인 하나 - 17-4가 대화의 출처 표기로 첫 턴 메시지의 것을 고르는가

**고른다.** 코드: `supabase/functions/_shared/corners/sweetWords.ts` `deriveFor`(133~139행) - 대화 안 턴을 `Date.parse(at)` 오름차순으로 정렬(같은 시각이면 입력 순서 유지)한 뒤 `attribution: turns[0].attribution`. 근거 메시지의 `attribution`은 골격이 원문 채우기에서 선언(`SWEET_WORDS_REFERENCES`, 94행 `copy`)대로 레코드에서 옮긴다. LLM은 쓰지 않는다. 시험: `sweetWords.test.ts` 163~173행(정상 경로에서 입력 순서가 뒤바뀐 두 턴 -> 턴 순서 `['세준','서영']`, 대화 표기 `.at`이 가장 이른 메시지의 것) 및 388~408행(`derive` 직접 호출: 표기 문자열이 `'첫째 표기'`이고 턴 텍스트가 `['첫째','둘째']`). 고친 것 없음.

## node_modules 백업 (2026-09-12, main session)

node_modules 백업: ..\ondolog-node_modules-20260910.zip (219548890 bytes, 2026-09-10)
현재 node_modules는 lock으로 재현 불가 — npm install --legacy-peer-deps로
설치 후 lock만 되돌려진 상태. npm ci는 lock 내부 불일치로 거부됨.
이 백업은 폰 복귀 후 lock 재생성 시 폐기한다. 해결이 아니라 다리다.

## package.json ↔ package-lock.json 정합 — 목표 달성 불가로 중단 (2026-09-12, main session)

Phase 7 위임(`.claude/state/prompts/phase-7/15-main-session-package-align.md`).
**중단 — 목표 자체가 달성 불가능함을 확인.** `package.json`은
`git checkout -- package.json`으로 되돌렸다(`git status --porcelain` 클린
확인 완료). `CLAUDE.md`는 손대지 않았다. 커밋 없음.

1. **`package-lock.json`이 내부적으로 낡았다.** `expo@57.0.17`이 요구하는
   전이 의존 7건의 버전 요구가 lock에 고정된 버전보다 높다. `npm ci`는
   어떤 플래그로도 통과하지 않는다(`--legacy-peer-deps`는 peer 충돌만
   무시할 뿐, 이건 peer 충돌이 아니라 lock 자체 무결성 오류라 무시
   대상이 아니다):
   `expo-updates-interface`(57.0.1→57.0.2 요구), `expo-json-utils`
   (57.0.1→57.0.2), `@expo/metro-runtime`(57.0.14→57.0.15), `@expo/ui`
   (57.0.12→57.0.18), `expo-glass-effect`(57.0.1→57.0.3), `expo-symbols`
   (57.0.2→57.0.3), `@expo-google-fonts/material-symbols`
   (0.4.44→0.4.47).

   별도로, **`package.json` 대 lock 루트 선언 자체의 불일치도 5건** 확인됨
   (`node -e`로 `package.json` vs `package-lock.json`
   `packages[""].dependencies`를 직접 비교, 2026-09-12 확인):

   | 필드 | package.json | lock 루트 선언 |
   |---|---|---|
   | react-native | 0.86.3 | 0.86.2 |
   | expo-router | ~57.0.17 | ~57.0.15 |
   | expo-dev-client | ~57.0.16 | ~57.0.14 |
   | expo-linking | ~57.0.8 | ~57.0.7 |
   | expo-auth-session | ~57.0.10 | ~57.0.9 |

   이 5건은 이번 세션 산출물이 아니다 — `git diff c4e0231 11ce24b --
   package.json`으로 확인한 결과 **commit `11ce24b`("0831 시작 커밋",
   2026-08-31)에서 `package.json`의 이 5개 필드만 올라가고
   `package-lock.json`의 루트 선언은 그대로 남았다.** 그 뒤 `0904`·`0906`·
   `0909`×2·`0912` 커밋 전부 `package.json`/`package-lock.json`을
   건드리지 않아 그대로 이어졌다. `npm ci`를 한 번도 정상 실행하지 않아
   지금까지 발견되지 않았던 것으로 보인다.

2. **`CLAUDE.md` 45행은 여전히 잘못된 명령이다.** `npm install
   --legacy-peer-deps`는 lock을 덮어쓴다(절대 규칙 8 위반 소지). 대체안으로
   시도한 `npm ci`는 위 1번 때문에 작동하지 않는다. 45행은 손대지 않았다 —
   현재 맞는 명령이 없다.

3. **현재 동작 중인 `node_modules`를 만든 절차 — PSReadLine 히스토리로
   재구성(추측 아님, 하지만 불완전)**. 이번 세션(main session, 2026-09-12)
   대화 이전에 있었던 별도 라운드의 명령이라 이 세션은 직접 실행을
   지켜보지 못했다. 출처: `%APPDATA%\Microsoft\Windows\PowerShell\
   PSReadLine\ConsoleHost_history.txt`(줄 396~452 부근). **이 파일은
   타임스탬프를 남기지 않아 정확한 실행 시각은 전부 불명 — 순서(줄 번호
   순)만 확인 가능.**

   - `npm install --legacy-peer-deps` 실행 (416번째 줄 부근) —
     **이 시점에 `package-lock.json`이 다시 쓰였다.** `node_modules`도
     이때 갱신됨(→ 지금 설치돼 있는 `node_modules`의 실제 출처).
   - `Test-Path package-lock.json` / `Select-String package.json` /
     `git log --oneline -3 -- package.json package-lock.json` 등 확인성
     명령 다수.
   - **`git checkout -- package-lock.json`** — **이 시점에 방금 다시
     써진 lock을 커밋 상태로 되돌림.** `node_modules`는 그대로 두었다 —
     즉 이 순간부터 `node_modules`는 디스크상 lock이 선언하는 트리와
     달라졌다(lock으로 재현 불가능한 상태가 됨).
   - `npx jest --ci --watchAll=false` 실행 → 통과(348/26 기준선이 이
     시점 산출물로 추정 — 이 세션이 직접 목격하지 않아 "추정").
   - `Test-Path node_modules/@react-native/jest-preset` 확인.
   - `npx tsc --noEmit -p .` 실행 → 통과 추정(출력 미보존).
   - `package.json` vs lock 루트 선언 비교 PowerShell 스크립트(foreach
     dependencies/devDependencies) 실행 → 위 5건 발견한 것으로 추정.
     **이 스크립트의 실제 출력은 어디에도 저장되지 않아 그 결과 자체는
     불명** — 이번 세션이 2026-09-12에 동일 비교를 `node -e`로 독립
     재실행해 같은 5건을 확인했다(위 표).
   - `npm ci` 재실행 → 실패한 것으로 추정(오늘 이 세션이 동일 실패를
     재현함).

   **결론: 지금 `node_modules`는 그 `npm install --legacy-peer-deps`
   1회 실행의 산출물이고, 그 뒤 되돌려진 lock으로는 `npm ci`로 재현할
   방법이 없다. `node_modules`가 지금 지워지면(디스크 정리, 재클론 등)
   복구 경로가 없다.** 이 세션은 `npm ci`를 2회 실행했으나 둘 다
   의존성 해석 단계에서 실패해 `node_modules`를 건드리지 않았다(설치
   전 단계 실패 확인 — `npx jest`/`npx tsc`가 여전히 348/26·0에러로
   통과하는 것으로 재확인, 2026-09-12).

4. **해소 시점**: 폰 복귀 후 재빌드 때 `expo install --fix` + lock
   재생성 + EAS 빌드 + 실기기 검증을 한 벌로 다룬다(재빌드 대기 5종
   미검증 상태로는 네이티브 스택을 건드릴 수 없음).

## Phase 6 1~2단계(생체정보 동의 + 대표사진 등록) 산출 요약 — Phase 6 3단계(메인 세션)가 가져다 쓰는 용도

- **동의 상태의 단일 진실 소스는 `profiles.biometric_consent_at`/
  `biometric_consent_revoked_at`이다.** "현재 동의가 유효한가"는 어디서도
  직접 두 컬럼을 비교하지 말고 `src/utils/biometricConsent.ts`의
  `isBiometricConsentActive(consentAt, revokedAt)`를 불러 써라 — 재동의 시
  `revoked_at`을 `null`로 되돌리는 규칙(문서에 없는 자체 판단,
  `.claude/state/DECISIONS.md` 2026-08-27 항목 참조)이 이 함수 안에만
  있고 다른 곳에 중복돼 있지 않다.
- **`src/store/profileStore.ts`/`src/store/coupleStore.ts`가 대표사진
  경로(`referencePhotoPath`)까지 함께 들고 있다.**
  `setPersonalReferencePhoto(userId, localUri)`(profileStore)/
  `setReferencePhoto(localUri)`(coupleStore, 연결 상태에서만)가 업로드
  + DB 반영 + 로컬 상태 갱신을 한 번에 한다. 실제 업로드는
  `src/services/referencePhotoApi.ts`(`uploadReferencePhoto`,
  `getReferencePhotoSignedUrl`)에 있다 — Storage 경로 규칙은 아래
  참조.
- **⚠️ `019_avatars_storage_policies.sql`을 원격에 적용해야 대표사진
  업로드가 동작한다.** 개인 `{user_id}/reference`, 커플
  `{couple_id}/reference` 규칙으로 경로를 확정했다(015가 미확정으로
  남겨뒀던 부분). 적용 전까지는 `app/(modals)/reference-photo.tsx`의
  저장이 전부 RLS 거부(42501)로 실패한다 — `.claude/state/PROGRESS.md`
  "막힌 것" 참조.
- **화면 C(대표사진 등록)는 이미 완성돼 재사용 가능하다.**
  `src/components/ReferencePhotoSlot.tsx`(프레젠테이션, 개인/커플 공용) +
  `app/(modals)/reference-photo.tsx`(라우팅/스토어 연결). "사진 선택"만
  플레이스홀더다(`src/constants/referencePhotoPlaceholders.ts`) — 실제
  갤러리 연동 시 이 상수 파일의 소스를 `expo-image-picker` 결과로
  바꾸고, `ReferencePhotoSlot`에 넘기는 `onSave` 콜백 인자(로컬 URI)
  타입만 유지하면 나머지(미리보기·업로드·DB 반영)는 그대로 동작한다.
- **`profiles.photo_sync_enabled`/`photo_scan_completed_at`/
  `photo_scan_cursor`는 여전히 전혀 건드리지 않았다.** 피드 탭 안내
  카드(`app/(tabs)/feed.tsx`의 `PhotoSyncPromptCard`)는 생체정보 동의
  상태만으로 두 상태(미동의/동의완료)를 보여준다 — 화면 B(권한)·SDK
  연동 후에는 이 카드를 "동의 완료 → 권한 미허용 → 대표사진 등록
  완료 → 스캔 중"처럼 더 세분화해야 할 것이다.
- **⚠️ 철회 시 로컬 얼굴 데이터 삭제가 구현되지 않았다.** MASTER.md
  "철회 시 반드시 함께 일어나야 하는 일" 3번 — SDK 연동 시
  `revokeBiometricConsent`(`src/store/profileStore.ts`) 안에 온디바이스
  삭제 호출을 반드시 추가할 것. 자동 테스트로 강제할 수 없는 항목이라
  QA 체크리스트에 수동으로 남아 있다(`.claude/state/PROGRESS.md`
  "막힌 것" 참조).
- **(2026-09-02) `src/engine/faceMatch.ts`의 `threshold` 인자는 다섯 번째
  자리표시자였다** — 어느 문서에도 값이 없었고 자리표시자 목록에도 없었다.
  코드는 규칙을 정확히 지켰지만(인자로 받고 하드코딩하지 않음) 그래서
  아무도 추적하지 않았다. **판정 정책은 확정됐다** — MASTER Part 9-4:
  **오탐 회피 우선**, 판정이 애매한 구간은 매칭하지 않는다. 이중 임계값은
  범위 밖(분포 관측 후 Phase 10과 재검토).
  **값은 실기기 캘리브레이션 대기** → `UNRESOLVED('faceMatch.threshold')`.
  SDK 반환값이 유사도인지 거리인지, 정규화 범위가 무엇인지, 실제 커플
  사진에서 어느 대역에 분포하는지가 재빌드 후에만 관측된다. 측정은
  **온디바이스에서 하고 사람이 화면에서 읽어 손으로 기록한다** — 유사도
  로그나 특징 벡터를 서버로 보내면 절대 규칙 1 위반이다. 실기기
  작업이므로 위임 대상이 아니다.
- **법률 문구는 여전히 자리표시자다** — `src/constants/legalDocuments.ts`
  의 `biometric` 항목. 실제 법무 검토 텍스트로 교체 필요(다른 3개
  문서와 동일한 미해결 상태, "여전히 필요한 처리" 5번 항목에 함께
  추적).

## 여전히 필요한 처리 (사람 작업)

### 2026-09-02 추가

- **`docs/` 5종 교체** — MASTER·DESIGN·ROADMAP·SCHEMA·CORNER_CONTENT.
- **`ui-builder_phase6_guard.md` 내용을 `.claude/agents/ui-builder.md`
  끝에 이어 붙이기** — 새 파일이 아니다. Phase 6(생체정보 동의) +
  Phase 10(매거진 제작 탭) 주의사항.
- **마스터 PM 문서 / 프롬프트 엔지니어 인수인계서를 `docs/`에 넣을지 결정**
  — 현재 저장소 밖이라 버전 관리가 안 된다. 마스터 PM 문서는 "새 세션에서
  문서 하나로 복구"가 존재 이유라 특히 그렇다.
- **`018_realtime_publication.sql` 원격 적용 여부 확인** — 로컬 파일 존재와
  원격 적용은 별개다. 아래 1번과 같은 사안이며, 0831 대조 문서가 "다음
  확인 3가지"로 올렸으나 그 문서는 스냅샷이라 갱신되지 않는다.

### 기존

1. **`supabase_realtime` publication에 `messages`(및 필요 시 `stories`)가
   빠져 있다** — 원격 프로젝트에 직접 쿼리(`select * from
   pg_publication_tables where pubname = 'supabase_realtime'`)해 확인함,
   결과 0행. `alter publication supabase_realtime add table
   public.messages;`를 마이그레이션으로 적용해야 상대방 기기가 채팅을
   실시간으로 수신한다(현재는 화면 재진입 시에만 최신화됨). db-architect
   영역 — Phase 5는 읽기 전용 확인만 하고 적용하지 않았다(작업 지시 준수).
2. **[폐기됨 - 74-k2: legacy anon 키 2026-11-12 비활성화 · RN 앱 동결(R88-4 ①). 공개 키는 publishable뿐]**
   **`.env`의 `EXPO_PUBLIC_SUPABASE_ANON_KEY`가 플레이스홀더 상태** —
   Supabase 대시보드(Project Settings → API)에서 실제 anon public key를
   복사해 채워야 소셜 로그인/DB 저장 코드가 실제로 동작한다. Phase 3
   코드는 이 값이 채워지는 즉시 동작하도록 전부 작성돼 있다(anon
   key는 클라이언트 노출이 전제인 공개 키라 이 세션이 대신 채워도
   되는지 애매해 손대지 않았다 — 필요하면 다음 턴에 MCP로 조회해
   채워 넣을 수 있다).
3. **Supabase Auth 대시보드에 카카오/구글/애플 OAuth 프로바이더가
   설정돼 있는지 미확인** — `mcp__claude_ai_Supabase__list_projects`/
   `get_project`로는 Auth 프로바이더 설정이 노출되지 않아 이 세션에서
   확인 불가했다. Authentication → Providers에서 3종 활성화 + 각
   프로바이더 개발자 콘솔에 리다이렉트 URI
   (`https://<project-ref>.supabase.co/auth/v1/callback`) 등록 필요.
4. **iOS Dev Build 없음** — Apple 로그인은 iOS 실기기가 있어야 검증
   가능(Apple Developer 계정 대기 중). Android에서는 카카오/구글
   웹 리다이렉트 플로우를 안드로이드 Dev Build로 검증 가능할 수 있다.
5. **(2026-08-25 구현 완료) 017 마이그레이션 원격 미적용** — 화면 6
   약관 동의 UI는 구현 완료(`app/(onboarding)/auth.tsx`,
   `src/components/ConsentChecklist.tsx` 등). 단
   `supabase/migrations/017_profiles_marketing_consent.sql`
   (marketing_agreed_at 컬럼 추가 + terms/privacy_agreed_at
   default now() 제거)을 원격에 아직 push하지 않았다 — 사람이
   `npx supabase db push` 실행 후 `supabase gen types`로
   `src/types/database.ts` 재생성 필요(지금은 수동 패치 상태).
   미적용 상태에서는 marketing_agreed_at upsert가 실패한다.
   상세는 `.claude/state/DECISIONS.md` 2026-08-25 항목 참조.
   약관/개인정보처리방침/AI 활용 고지 **본문은 여전히 자리표시자**다
   (`src/constants/legalDocuments.ts`) — 출시 전 법무 검토 본문으로
   교체 필요. **(2026-08-27 추가)** 같은 파일의 `biometric`(생체정보
   동의) 항목도 동일하게 자리표시자 — 아래 "Phase 6 1단계" 절 참조.
6. **(2026-08-27 구현 완료, 원격 미적용) avatars Storage 버킷 정책** —
   경로 규칙을 개인 `{user_id}/reference` / 커플 `{couple_id}/reference`로
   확정하고 `supabase/migrations/019_avatars_storage_policies.sql`
   작성 완료(`app/(modals)/reference-photo.tsx` 대표사진 등록 화면이
   이 정책에 의존한다). **`npx supabase db push`로 원격 적용 필요** —
   적용 전까지는 대표사진 업로드가 전부 RLS 거부(42501)로 실패한다.
   적용 후 `supabase gen types typescript --linked`로
   `src/types/database.ts` 재생성은 불필요(테이블 컬럼이 아니라
   Storage 정책만 추가했다).
7. **연애 온도 결합 공식이 없다** (`src/engine/temperature.ts`) — Part 9-2
   "선행 프로젝트의 연애 일치율 로직 계승"의 원문이 저장소 어디에도
   없다. 기본값(36.5)·클램프만 구현된 상태. **(2026-08-25 갱신)** Phase
   4는 이미 완료됐다 — 메인 탭은 저장값이 없으면 숫자 대신 대기 문구를
   보여주는 방식으로 이 공식 없이도 구현 가능했다(`app/(tabs)/main.tsx`).
   다만 이 공식 자체는 **일 배치 Edge Function을 실제로 만드는 시점에는
   반드시 확정돼야 한다** — 그 전까지는 연결된 커플도 온도가 계속
   "측정 준비 중"으로만 보인다.
8. **DNA base_score 궁합 공식 + 애니어그램 9×9 매트릭스**
   (`src/engine/dnaScore.ts`) — Part 17-2 가중치 미확정. Phase 3의
   `src/constants/compatibility.ts`(애니어그램 코어 궁합, 화면 7용)와는
   **별개**다 — 그건 1인 상태에서 보는 구조적 참고 자료이고, 이건
   커플 연결 후 빅5·스턴버그·애착까지 결합한 실제 DNA 일치율 계산용.
9. **OVR 포지션 가중치 표 + 연애 포지션 네이밍이 없다**
   (`src/engine/leagueStats.ts`). 현재 6개 스탯 단순 평균.
10. **베이지안 수축(shrinkage) 보정 파라미터가 없다**
   (`src/engine/leagueStats.ts`).
11. **`daily_temperature.engine_version` 컬럼 부재** — db-architect 판단
    필요.
12. **화면 5 "이미지로 저장" 미구현** — `react-native-view-shot` 등 뷰
    캡처 라이브러리가 미설치라 안내 alert만 뜬다. 공유하기(OS 공유
    시트)는 실제로 동작한다.



## 72b- (ui-builder, 연결 끊김 띠 바로잡기)
- 확인 요청은 `supabase.ts`가 `registerConnectionProbe`로 등록한 `fetch(url + '/auth/v1/health')` 하나. `global.fetch` 감싸기를 거치지 않는 전역 `fetch`를 직접 쓴다.
- `useOfflineProbe`는 `ConnectionBanner` 안에서 호출한다(탭 레이아웃에 한 번만 마운트). 띠가 내려가면 효과 정리로 타이머와 AppState 구독이 멈춘다.
- 첫 확인은 띠가 뜬 뒤 첫 `active` 이벤트 또는 15초 타이머 중 먼저 오는 쪽. 시도 사이 최소 15초.
- 채팅 화면 판별은 `useSegments()`에 `chat`이 있는지로 한다(`app/(tabs)/_layout.tsx`).
- A18 "그 밖의 무효"는 `CONNECT_ERROR_COPY.invalid`(P0002)로 보았다. `other`(알 수 없는 실패)는 그대로.
- 옛 시험 `u8CommonStates`의 `isNetworkFailure` 단언 삭제, 큐 숨김 시험에 `inChat` 추가, `u6Onboarding2` 문구 갱신.
- 51b- A: 폴리필은 `expo-crypto`를 채울 때만 require한다(import하면 expo-modules-core가 전역 fetch를 바꿔 `u8ProbeTimeout`이 깨졌다).
- 51b- A: jest-expo의 expo-crypto 목은 해시를 0으로 돌려줘 시험에서 digest만 노드 crypto로 바꿨다. 실제 네이티브 SHA-256은 기기 확인 몫.
- 51b- A: 스플래시 바탕 · `android.backgroundColor` = `nocturne.ink` #0A0814(`src/theme/nocturne.ts`). 스플래시 이미지는 기존 `assets/splash-icon.png`(imageWidth 기본 100) - 기기에서 보고 조정.
- 51b- A: 카메라 권한은 `expo-image-picker` 플러그인 옵션 false(매니페스트에 CAMERA · RECORD_AUDIO `tools:node=remove`). 갤러리는 `launchImageLibraryAsync`라 영향 없음.

- 73-1c: 채팅 입력은 비제어 입력 칸 - 보낼 문자열을 DOM 값에서 읽는다(조합 글자 포함). 조합 중에 보냈을 때만 300ms 잔여 가드(조합 입력 · compositionend 비움).
- 73-1c: 연출 값은 보드 motion.screenEnter(translateY 12 · 220ms)를 말풍선에 · 이징 ease-out(데모 `rise`와 같은 계열). 채팅 전용 값은 보드에 없음.
- 73-1c: 부드러운 이동은 rAF로 직접(220ms, easeOut cubic), 창 높이 변화는 ResizeObserver에서 즉시 끝 유지, 손가락 닿으면 이동 중단, 상대 메시지는 붙어 있을 때만 따라감. 새 패키지 0.
