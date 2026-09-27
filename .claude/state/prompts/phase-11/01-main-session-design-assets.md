# 메인 세션 작업 — 디자인 산출물 재배치

**이것은 위임 작업이 아닙니다. 메인 세션이 직접 수행합니다.** 파일 이동과 정리이며, 지시받은 작업이므로 절대 규칙 8의 예외입니다. **커밋은 하지 않습니다(절대 규칙 6).**

## 배경

디자인 산출물이 저장소에 들어왔으나 배치에 다섯 가지 문제가 있습니다. 이번 작업은 **참조 자산을 `assets/` 밖으로 빼고, 코드 변경은 되돌리는 것**입니다. 토큰·폰트 교체는 이번 범위가 아니며 `ui-builder` 위임으로 처리됩니다.

## 0단계 — 현재 상태 기록

```powershell
git status --porcelain -uall
git log --oneline -3
du -sh assets 2>$null; (Get-ChildItem assets -Recurse -File | Measure-Object Length -Sum).Sum
```

**어느 파일이 커밋됐고 어느 것이 워킹트리에만 있는지 기록하십시오.** 3단계의 명령이 갈립니다.

## 1단계 — 파일명 정리 (절대 규칙 4)

```powershell
git ls-files | Select-String -Pattern '\(\d\)| '
Get-ChildItem assets, docs -Recurse -File | Where-Object { $_.Name -match '\(\d\)| ' } | Select-Object FullName
```

공백·괄호가 든 파일명을 전부 정리합니다. **커밋된 것은 `git mv`, 미추적은 `Rename-Item`**을 쓰십시오.

```powershell
# 예시 — 실제 경로로 바꿔 실행
git mv "assets/components/01_color (1).png" "assets/components/01_color.png"
```

**확인**: 위 두 명령의 출력이 **비어야** 합니다. `app/(modals)`·`app/(tabs)` 같은 Expo Router 라우트 그룹은 정상이며 대상이 아닙니다.

## 2단계 — 참조 자산을 `docs/design/`으로 이동

**`assets/`는 앱 번들 대상입니다.** 런타임에 `require()`되는 것만 거기 있어야 합니다.

```
docs/design/app/screens/      ← assets/screens/*.png (continuity.png 포함)
docs/design/ui-kit/           ← assets/components/*.png
                                 assets/ondolog_ui_kit.png
                                 assets/ondolog_ui_kit.html
                                 assets/06_card_row.png   (루트에 흩어진 것)
docs/design/theme_compare_6.png  ← assets/magazine/ONDOLOG_theme_compare_6.png
docs/design/app/                 ← docs/ondolog_app_21_*.png
                                   docs/ondolog_app_v3_overview.png
```

**커밋 여부에 따라 명령이 다릅니다.**

```powershell
New-Item -ItemType Directory -Force docs/design/app/screens, docs/design/ui-kit
# 커밋된 파일
git mv assets/screens/<파일> docs/design/app/screens/<파일>
# 미추적 파일
Move-Item assets/screens/<파일> docs/design/app/screens/<파일>
```

### 커밋하지 않을 것 — 발행물 PDF 6종

`assets/magazine/*.pdf`는 **22MB 출력 샘플이며 규격이 아닙니다.** 규격은 `docs/ONDOLOG_CORNER_LAYOUT.md`가 갖습니다.

```powershell
# 커밋돼 있으면
git rm --cached assets/magazine/*.pdf
# 그리고 작업 트리에서도 제거 (사람이 별도 보관)
Remove-Item assets/magazine/*.pdf
```

**PDF를 지우기 전에 사람에게 확인하십시오.** 저장소 밖에 사본이 있는지 물어보고, 없다고 하면 **지우지 말고 보고하십시오.**

### 이동 후 `assets/`에 남아야 할 것

```
assets/sky_world.jpg
assets/fonts/*
assets/icon.png · favicon.png · splash-icon.png · android-icon-*.png
```

**그 밖의 것이 남아 있으면 보고하십시오.**

## 3단계 — `scripts/design/` 추가

`gen_world.py`와 `shot_kit.py`가 저장소에 없습니다. **산출물만 있고 생성 경로가 없으면 재현이 안 됩니다.**

두 파일이 워킹트리 어디에도 없으면 **사람에게 요청하고 이 단계는 보류하십시오.** 임의로 만들지 마십시오.

```powershell
New-Item -ItemType Directory -Force scripts/design
```

## 4단계 — `src/theme/palette.ts` 되돌리기

**새 `palette.ts`가 `src/theme/index.ts`를 깨뜨립니다.** `index.ts`가 `LIGHT_PALETTE`·`DARK_PALETTE`·`BROADSHEET_ON_LIGHT`·`BROADSHEET_ON_DARK`·`CLIMATE_LIGHT`·`CLIMATE_DARK`·`ATTACHMENT_CLIMATE`·`BroadsheetPalette` 등을 import하는데 새 파일은 그것들을 export하지 않습니다. `radius`가 `spacing.ts`와 충돌하기도 합니다.

```powershell
git status --porcelain src/theme/palette.ts
```

| 출력 | 조치 |
|---|---|
| `M` (미커밋 수정) | `git checkout -- src/theme/palette.ts` |
| 출력 없음 (이미 커밋) | **되돌리지 말고 보고하십시오** — 되돌릴 시점 판단이 필요합니다 |

**`sky.ts`와 `tokens.json`은 그대로 둡니다.** 신규 파일이고 기존 코드가 import하지 않아 아무것도 깨지 않습니다.

## 5단계 — 게이트

```powershell
npx tsc --noEmit -p .
npx tsc --noEmit -p supabase/functions/tsconfig.json
npx jest --ci --watchAll=false
```

**두 `tsc` 모두 0 에러, jest는 직전 기준선 유지.** 하나라도 다르면 **멈추고 보고하십시오.**

## 6단계 — 보고

```
## 0단계 현재 상태
- git status 전문: {그대로}
- 최근 커밋 3개: {그대로}
- assets 총 용량: {값}

## 1단계 파일명
- 정리한 파일: {목록, 전/후}
- git ls-files 재확인: {빈 출력 / 잔존}

## 2단계 이동
- docs/design/ 트리: {목록}
- assets/ 잔존 목록: {목록}
- PDF 처리: {사람 확인함 — 삭제 / 보류 — 사유}
- assets 총 용량 (이동 후): {값}

## 3단계 스크립트
- gen_world.py · shot_kit.py: {배치함 / 없어서 보류}

## 4단계 palette.ts
- git status 출력: {그대로}
- 조치: {되돌림 / 커밋돼 있어 보고}
- sky.ts · tokens.json: {유지함}

## 5단계 게이트
- tsc -p . : {N}에러
- tsc -p supabase/functions : {N}에러
- jest: {N} tests / {N} suites

## git status --porcelain -uall (최종)
{전문}

## 판단이 필요한 지점
- {있으면}
```

## 하지 말 것

- **커밋·푸시** — 사람이 직접 실행합니다
- **PDF를 사람 확인 없이 삭제하는 것** — 저장소 밖 사본 여부를 먼저 물어보십시오
- **`src/theme/`의 다른 파일을 고치는 것** — `index.ts`·`typography.ts`·`inkHierarchy.ts`·`spacing.ts` 전부 이번 범위 밖
- **폰트를 추가하는 것** — `Pretendard-Black`·`Pretendard-Medium`은 `ui-builder` 위임 범위
- **`app/_layout.tsx`의 `useFonts`를 고치는 것** — 위와 같음
- **`app.json`·`tsconfig.json`·`package.json` 수정**
- **`docs/` 아래 마크다운 문서를 편집하는 것**
- **파일을 새로 만들어 채우는 것** — 없으면 보고하십시오
- `git rm` 대신 `Remove-Item`으로 추적 파일을 지우는 것 — 이력이 깨집니다
- 게이트가 실패했는데 진행하는 것
