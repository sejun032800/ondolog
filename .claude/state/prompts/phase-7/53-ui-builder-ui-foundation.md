# 위임 프롬프트 — UI 기반 U0 (Nocturne v5)

> 대상: `ui-builder`
> 보관 경로: `.claude/state/prompts/phase-7/53-ui-builder-ui-foundation.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-21
> 기준선: MASTER r61 · ROADMAP r19 · `52-r3` 커밋됨 · 디자인 묶음 반입됨

---

## 목표 (PM) — 시연 가능한 결과 하나

**새 탭 바와 공통 컴포넌트가 Nocturne v5 그대로 그려지는 것.** 화면(메인·피드·서재…)은 이번 범위가 아니다.
(ROADMAP r19 §3-UI U0, 결정 R18-1~8 · R19-5)

**원본 (직접 읽는다)**
- `docs/design/nocturne/README.md` — 읽는 순서를 따른다
- `docs/design/nocturne/canvas/` — `Tokens.dc.html` · `Build.dc.html` · `Components.dc.html` · `Objects-1~3` · `N-T-Tabs.dc.html`
- `docs/design/nocturne/screens/` (`E01.jpg` 등)
- `docs/ONDOLOG_ROADMAP.md` §3-UI · §9 "앱 UI 구현 메모(r18)"

색·서체·빛·모션·배치는 디자인이, 화면의 존재·필드·숫자·법적 사실은 MASTER가 정한다(R18-1).

## 범위

| # | 할 일 | 원본 |
|---|---|---|
| 1 | **`src/theme/nocturne.ts` 신설** — 색 16 · 빛 3(`glow`) · 활자 10단(웨이트는 fontFamily) · 형태(모서리·여백·터치 48) · 모션 상수(진입 8px/260ms, 누름 .98/120ms, 시트 스프링 damping 18, 배경 별 명멸 9–12초 .35↔.75, 스켈레톤 펄스 .06↔.12/1.6초). **`ink()` 위계(metric·narrative·verbatim) 시그니처 유지** | `Tokens` · `Build` |
| 2 | `app/_layout.tsx`의 `useFonts`에 `Pretendard-Medium`·`Pretendard-Bold` 키 추가 (파일은 이미 있다) | `Build` |
| 3 | **의존성 — 아래 "1회 허가"** | R18-3 · R19-5 |
| 4 | **공통 컴포넌트** — SkyBackground(하늘 `Image` 1장 + `translateY(-viewOffsetPt)`, 기존 `sky.ts` 값 그대로 · 장막 · 그레인 루트 1회 · 배경 별 명멸) · GlowNumeral(정수/소수 42%, 카운트업 없음) · GlassCard · ProgressRule(2px, 정지) · PrimaryButton/GhostButton · StatusChip · MilestoneChip · VolBadge · LockBadge(글자) · Segmented · Toggle · ListGroup/ListRow · 나가기 머리 두 종(푸시 `←` / 시트 손잡이+`✕`) · QuoteText · Skeleton · DateCard(사진 아래 장막 140) | `Components` · `Objects-1~3` |
| 5 | **TabBar** — 아이콘 + 글자, 떠 있는 섬(bottom = `insets.bottom + 12`), 활성 = rose 빛. **아이콘 5종은 `canvas/N-T-Tabs.dc.html`의 인라인 SVG 경로를 그대로 옮긴다.** `(tabs)/_layout.tsx`의 탭 바를 교체한다 — **옛 화면 위에 새 탭 바가 뜨는 것은 의도된 중간 상태** | `N-T-Tabs` · `screens/E01.jpg` 등 |
| 6 | **사진 장막** — `experimental_backgroundImage`를 먼저 쓴다. 실기기에서 안 되면 장막 PNG(1×140)로 간다(실기기 확인은 `51-`). 어느 쪽인지는 내부 결정 — HANDOFF에 한 줄 | R18-7 |
| 7 | 배경 별 명멸·진입 모션은 **OS "동작 줄이기"가 켜져 있으면 멈춘다** | 조정표 |
| 8 | **확인 화면** — 컴포넌트를 한 화면에 모은 개발 빌드 전용(`__DEV__`) 화면. 위치·이름은 내부 결정. **출시 빌드에서 닿지 않아야 한다** | 원칙 4 |

### 3. 의존성 — 1회 허가

- **`npx expo install react-native-svg react-native-worklets` 한 번**으로 넣는다
- **`package.json`·`package-lock.json` 변경을 이 두 의존성에 한해 1회 허가한다** (CLAUDE.md 규칙 8). 다른 패키지를 더하거나 올리지 않는다
- worklets는 Reanimated 4의 필수 동반 패키지다. **babel 설정이 따로 필요한지 확인해 보고한다.** babel 설정 파일은 이 허가에 들어 있지 않다 — 바꿔야 한다면 바꾸지 말고 보고한다
- lock에서 `zod`·`@supabase/supabase-js`의 해석 버전이 바뀌면, **같은 변경 안에서 `supabase/functions/deno.json`을 맞춘다**(MASTER r58, 범위 기호 없음). 이 경우에 한해 `deno.json` 변경을 허가한다. 바뀌지 않았으면 그렇다고 보고한다

## 범위 밖

- 메인·피드·서재·채팅·설정 등 **화면 교체**(U1~). **옛 화면의 색·서체를 고치지 않는다**
- Skia · expo-blur · 그라디언트·아이콘 라이브러리 · 그 밖의 새 의존성
- MVP 조정표의 숨김 요소 구현 (각 화면 단계에서 한다)
- 옛 테마·`docs/design/{app,ui-kit,tokens}` 삭제 (마지막 옛 화면과 함께)

## 지켜야 할 것

- **CLAUDE.md 절대 규칙 8개 그대로.** 커밋·푸시는 사람이 한다
- 새 파일명은 ASCII, basename이 `^[A-Za-z0-9._-]+$`(규칙 F). **동적 라우트는 디렉터리에**(`date/[id]/index.tsx`)
- **색은 `nocturne.ts`에서만.** 새로 만든·바꾼 파일에
  - 하드코딩 색 0건
  - `textFaint` 글자색 0건
  - `fontWeight` 0건 (웨이트는 fontFamily)
  - `lilac` 12pt 이하 글자 0건
  
  이 넷은 **완료 보고의 확인 항목이다. 새 정적 규칙·검사 도구로 만들지 않는다**(ROADMAP §5)
- **블러 없음.** 금지 모션: **카운트업 · 진행률 채움 · 스피너**
- 내부 결정(파일 경계·시험 위치·확인 화면 위치·장막 방식)은 PM에게 올리지 않는다 — HANDOFF에 한 줄

## 게이트

- `npx tsc --noEmit -p .` 0
- `npx tsc --noEmit -p supabase/functions/tsconfig.json` 0
- jest 전부 통과, 기준선(`52-r3` 숫자) 대비 감소 없음. **마지막 요약 줄(`Test Suites:`·`Tests:`)을 그대로 붙인다**

## 산출 — 완료 보고에 붙인다

1. 항목 1~8별 파일과 원본 보드
2. **확인 화면의 에뮬레이터 또는 기기 화면 녹화**(가능한 범위) — 경로. 할 수 없으면 **무엇이 막았는지** 적는다. 최종 실기기 확인은 `51-`에서 한다
3. **하드코딩 색·`textFaint`·`fontWeight`·`lilac` 확인 결과** — 쓴 명령과 출력
4. 의존성: `react-native-svg`·`react-native-worklets` 버전, lock 변경 범위, babel 설정 필요 여부, `deno.json` 영향 유무
5. `nocturne.ts`의 값 개수 (색 16 · 빛 3 · 활자 10단)와 원본 보드에서 다른 점이 있으면 그 목록

## 완료 후

- `PROGRESS.md` 제목 바로 아래에 한 줄
- 내부 결정(파일 경계·시험 위치·확인 화면 위치·장막 방식 등)은 HANDOFF에 항목당 한 줄 (끝에 붙이지 말고 "열린 항목"이나 새 섹션에)
