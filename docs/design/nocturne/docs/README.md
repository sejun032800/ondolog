# Nocturne v5 — 앱 UI 디자인 원본

> 2026-10-21 반입. 디자인 세션 캔버스 "온도록 앱 UI — Nocturne"의 **v5 적용본(109화면)**.
> 이 폴더가 **앱 화면의 시각 원본**이다. 구현 순서·범위·MVP 조정은 `docs/ONDOLOG_ROADMAP.md` §3-UI가 정한다.

## 무엇이 무엇을 정하는가

| 정하는 것 | 원본 |
|---|---|
| 색·서체·간격·모서리·빛·모션·배치 | **이 폴더** (값은 `canvas/Tokens.dc.html`·`canvas/Build.dc.html`) |
| 화면의 존재·순서·필드, 숫자·등급·법적 사실 | `docs/ONDOLOG_MASTER.md` |
| 어느 화면을 언제 만드는가, MVP에서 숨기는 요소 | `docs/ONDOLOG_ROADMAP.md` §3-UI · R18 결정 |

둘이 다르면 위 표의 원본을 따른다. 표 밖이면 PM에게 올린다.

**대체한 것** — 디자인 v5 101화면 묶음(`ONDOLOG_APP_SCREENS_v5.md`·`04_src`)은 반입하지 않는다. `docs/ONDOLOG_APP_UI_PLAN_v3.md`,
`docs/design/{app,ui-kit,tokens}`는 옛 화면용이며 **마지막 옛 화면이 사라질 때 옛 테마와 함께 지운다**(R13-10).

## 폴더

| 경로 | 내용 |
|---|---|
| `screens/A01.jpg` … `I08.jpg` | 화면 109장, 390×844pt @2x. 목록 `screens_index.csv`. 모든 애니메이션이 3.2초 시점에 멈춘 상태 |
| `boards/` | 디자인 기준 보드 3장(에디토리얼 믹스·메인 모션·우리의 하늘) + 109장 한 장 보기 |
| `canvas/*.dc.html` | 캔버스 원본 HTML. **수치(px·색·자간)를 여기서 읽는다.** `/_blob/` 경로의 폰트·이미지는 열리지 않는다 — 폰트는 `assets/fonts`, 하늘·그레인은 `assets/` |
| `canvas/canvas.json` | 보드 목록·페이지 구분 |

**읽는 순서** — `Main`(원칙 4) → `Tokens` → `Components` → `Build`(RN 매핑·라우트·만드는 순서) → 만들 화면의 `N-*` 보드와 `screens/` 그림.
`Objects-1~3`은 컴포넌트 상세, `X1-Motion-Main`·`Y1-Our-Sky`는 모션·하늘(하늘은 출시 후).

`V-Common`은 **제안 보드**다(후보 페이지). v5 적용본에 들어간 것은 탭 아이콘 하나이며, 나머지는 ROADMAP R18이 정한 것만 따른다.

## 구현 규칙 (요약)

- **색 값은 그림에서 뽑지 않는다.** `src/theme/nocturne.ts`가 원본이다. 새로 만들거나 바꾼 파일에 하드코딩 색 0건.
- `textFaint`는 글자 색으로 쓰지 않는다. `lilac`은 12pt 이하 글자에 쓰지 않는다. `moon`은 발행된 호·Vol·종이로 넘어가는 순간에만.
- 웨이트는 `fontFamily`로만 구분한다(`fontWeight` 금지). MaruBuri는 두 사람의 원문 인용에만.
- 블러·그라디언트 글자 없음. 금지 모션: 온도 카운트업, 진행률 채움, 스피너(→ 스켈레톤 펄스).
- 나가는 길: 푸시 화면은 왼쪽 위 `←`, 아래에서 올라온 시트는 손잡이 + `✕`.
- 탭 바는 컴포넌트 하나(아이콘 + 글자). 일부 그림(D14·D16 등)의 글자만 탭은 따르지 않는다.

## 자산

- `assets/grain.png` — 256px 타일, 루트에 1회.
- `assets/sky_world.jpg` — **재보정 잠정본(780×4000, @2x 상당).** 원본(1170×6000)과 비율·구도가 같아 `sky.ts` 오프셋은 그대로다.
  @3x 최종본은 디자인 세션이 M3 전까지 넘긴다.
