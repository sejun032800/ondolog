# Nocturne v5 — 변경 기록

## patch1 (2026-10-22) — 디자인 R20 요청 반영

캔버스 HTML만 바뀌었다. **화면 그림(`screens/`)은 아직 이전 판이다** — patch2에서 바뀐다(ROADMAP R22-7).
그림과 HTML이 다르면 **HTML을 따른다.**

| 파일 | 바뀐 것 |
|---|---|
| `canvas/P1-Cover-Note.dc.html` | **신규.** 표지(사진·활자) · 발행 노트 템플릿. 호 번호·발행일 없음. `55-` 조판의 표지·발행 노트 원본 |
| `canvas/Tokens.dc.html` | `lilacText #D7C9FA` 추가, 장막 값 |
| `canvas/Objects-1.dc.html` | 하늘 장막 값(main .42 / pullStart .30 / pullRelease .14 / sky 0) + 메인 하단 장막 |
| `canvas/Objects-3.dc.html` | 속표지 오브젝트에서 호 번호 제거 |
| `canvas/N-D10-Front-Matter.dc.html` | 속표지 — 호 번호 제거 |
| `canvas/N-S-D2-Magazine.dc.html` | D09 발행 완료·D13 서재 — 표지 안 호 번호 제거(표지 밖 라벨은 유지) |
| `canvas/N-S-D3-Magazine.dc.html` | D15 공유 카드 — 호 번호 제거 |
| `canvas/N-T-Tabs.dc.html` | D01 서재 표지 — 호 번호 제거 |
| `canvas/M1-Editorial-Mix.dc.html` · `canvas/canvas.json` | 위에 맞춘 갱신 |

**PM 결정과 다른 곳(디자인 세션에 요청함, R22)** — 두 표지 모두 "N월호" 필수(R22-3), 활자 표지 네온 테마 추가(R22-6),
D15 공유 카드는 본인 원문만(R22-5). 이 셋은 patch2에서 그림과 함께 바뀐다. 그 전에는 MASTER 9-5 r64를 따른다.

## patch2 (2026-10-22) — PM R22 요청 반영 + 화면 그림 갱신

**화면 그림을 이번 판으로 모두 바꾼다.** `screens/`의 109장은 이 판의 캔버스 HTML과 같다.

| 파일 | 바뀐 것 |
|---|---|
| `canvas/P1-Cover-Note.dc.html` | **R22-3** 사진 · 활자 표지 둘 다 하단 이름 줄 왼쪽에 "N월호"(필수). 호 번호 · 발행일은 계속 없음 · 활자 표지의 우리의 온도 자리는 줄째 비움(M3-3 전) · **R22-6** 활자 표지 6테마(`basic` `hip` `neon` `lovely` `night` `ondol`) — 네온핑크 값은 디자인 제안값, 반입 소스에 네온 잉크 값이 있으면 그 값 우선 · 발행 노트: 인터뷰 답 · 셋로그 줄 삭제, 정정 요청 안내 → "설정 › 문의" |
| `canvas/N-S-D3-Magazine.dc.html` | **R22-5** D15 공유 카드 — 공유하는 사람 본인의 원문만("내가 한 말 · 1 / 3"), 안내 문구 변경 |
| `canvas/canvas.json` | 위에 맞춘 갱신 |
| `screens/` | 109장 전부 다시 렌더(@2x). D01 · D09 · D10 · D13 · D15 반영. 목록 `screens/screens_index.csv` |
| `boards/` | 보드 그림 — 디자인 기준 4장(M1 · X1 · Y1 · P1) + 시스템 8장 |

네온핑크 활자 표지 제안값: 배경 `#12060E` · 글자 `#FFEFF6` · 보조 `#C59AB2` · 강조 `#FF4FA3` · 상단 바 `#FF4FA3 → #FB7185 → #FFA4A4`.

> **PM 반입 판 (2026-10-22).** 디자인 세션의 patch2를 저장소용으로 맞췄다 — 화면·보드 그림을 PNG에서 JPG(q90/q88)로 바꿔 기존 `screens/*.jpg`를
> 덮어쓰고, `screens_index.csv`의 `file` 열(`01_screens/…png`)을 `screens/…jpg`로 고쳤으며, `boards/contact_sheet.jpg`를 새 그림으로 다시 만들었다.
> 그림 내용은 디자인 세션 판과 같다.
