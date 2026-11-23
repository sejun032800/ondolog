# patch9b 변경 내역 — R17 하늘 2단계, 현재 앱 기준 조정

> 2026-11-18 · 근거 `PM_request_design_patch9b_2026-11-18.md` · refs `ONDOLOG_patch9b_refs.zip`
> patch9(1판·2판)를 대체합니다. 보드 파일 이름은 그대로(`N-R17-Our-Sky-2.dc.html`), 9b로 덮어씁니다.

## 현재 앱과 다르던 6곳 — 모두 현재 앱으로

| # | 항목 | patch9b |
|---|---|---|
| 1 | 배경 | `sky_world.jpg`(C01과 같은 구간, 위에서 620pt). 둘러보기는 **사진 층 고정(시차 0)**, 하늘 층(별·달·라벨·30° 보조선) 회전, 방위 층 가로 이동 |
| 2 | C01 | 현재 C01 그대로 + [둘러보기]를 ✕ 왼쪽 같은 줄에(높이 40, 세로 중심 72, 간격 8) |
| 3 | 떨어진 말 | 기존 C03 전체 화면. 유성 = 오른쪽 위 → 왼쪽 아래, 흰 꼬리 · rose빛 머리 |
| 4 | 설정 | H01 `OUR SKY` 묶음(COUPLE 다음), 기존 문구, 지금 앱에 있는 줄 |
| 5 | 버튼 | C09 [움직임 사용하기] · C10 [알겠어요] = 흰 알약 |
| 6 | 납품 | 글꼴 동봉 없음(`../../../assets/fonts/`에서 읽음) · 780×1688 · 색인 4열 |

## 요청서와 다르게 정한 곳 (PM 확인 필요)

1. **[둘러보기] 칩: 화면 폭 380pt 미만이면 아이콘만**(✕와 같은 40pt 원, 접근성 이름 "하늘 둘러보기").
   글자 칩은 360pt 폭에서 부제 "우리가 함께한 하루가 별이 됐어요"와 9pt 겹칩니다. 머리·부제는 현재 앱이라 바꾸지 않고 칩 쪽을 줄였습니다. 실측은 보드 맨 아래 표(390 · 375 · 360 · 320pt 모두 겹침 0).
2. **반짝임 끔 범위**: 데이트 별 반짝임(1단계 2.8~5.2초)도 함께 멈춥니다. 2판은 배경 별 숨만 멈춘다고 했으나, 1단계 보드에 데이트 별 반짝임이 있다는 것을 refs로 처음 확인했습니다. 줄 이름이 "별 반짝임"이라 둘 다 멈추는 쪽으로 정했습니다.

## 화면 12장 (`screens/`, 각각 주석 판 `__anno` 포함)

C01 · C01_meteor · C01_meteor_reduced · C01_twinkle_off · C09 · C10 · C08 · C08_offscreen · C08_alt · C03_caught · H01_oursky · H01_reduced

- **C01은 기존 `screens/C01.jpg`와 색인의 C01 줄을 덮어씁니다**(칩이 더해진 화면). 나머지 11개는 새 줄입니다.
- 현재 H01 보드(유성 떨어뜨리기 + 별 반짝임 두 줄)는 유성 연결 이후 모습으로 그대로 둡니다. 다시 그리지 않았습니다.

## 넘기는 것

```
docs/design/nocturne/
  N-R17-Our-Sky-2.dc.html          보드(9b로 덮어씀)
  screens/*.jpg                    12장 + __anno 12장, 780×1688
  screens_index_patch9b_rows.csv   기존 screens_index.csv에 붙일 줄(C01은 기존 줄 교체)
CHANGES_patch9b.md
CURRENT_patch9b_rows.md
```

## 보드가 읽는 저장소 파일(이름 확인 필요)

- 글꼴: `assets/fonts/Pretendard-Regular|Medium|SemiBold|Bold` · `MaruBuri-Light` (`.otf` → `.ttf` → `.woff2` 순서로 찾음)
- 하늘 사진: `assets/images/sky_world.jpg` · `assets/sky_world.jpg` · `assets/images/sky/sky_world.jpg` · `assets/sky/sky_world.jpg` 중 있는 것
- 이름이 다르면 보드만 시스템 글꼴·단색 배경으로 보입니다. JPG에는 영향이 없습니다.
