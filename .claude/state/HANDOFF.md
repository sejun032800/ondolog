# 인수인계

> 서브에이전트는 컨텍스트가 격리되어 서로 대화할 수 없다.
> 이 파일이 유일한 인수인계 수단이다.
> **완료 항목은 `.claude/state/archive/`로 옮긴다** — 누적되면 컨텍스트가 오염된다.
> (예외: 아래 "DEF 애착 항 갱신" 작업 프롬프트는 선행 작업의 진단
> 수치를 보존하라고 명시해, 이번 세션은 완료 항목을 삭제하지 않았다.
> 프롬프트 #13도 상태 파일 기록 삭제·이동·재편을 금지해 유지한다.
> `#13-r4`(브랜드 생성자 이전)도 같은 이유로 `#13` 절을 그대로 두고
> 위에 새 절만 추가한다.)
HANDOFF에 무언가를 더할 때는 끝에 붙이지 말고 "열린 항목"이나 새 섹션에 넣는다.

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

시작 지점: 커밋 `17222d1`(작업 트리 깨끗, ROADMAP `2026-11-09-r75`, PM 지시서 · 두 프롬프트 커밋됨 확인).

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
```

1. 11-11 ready 초안을 **다시 렌더만** 한다(생성 재실행 0 · LLM 0). 호 id는 `scripts/ops/out/`의 11-11 생성 결과 파일 이름(`generate-<id>.json`)에서 읽고, 출력 파일 · 보고에 적지 않는다.
   `render\.venv\Scripts\python.exe render\render_issue.py --issue-id <11-11 초안 id>`
2. 렌더 보고: 성공/실패 · `compose.droppedArticles` · `compose.heroFallbackArticles` · `pageCount`
3. 성공하면 발행: `deno run --no-lock --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY --allow-net="<ref>.supabase.co" --allow-read=supabase/.temp/linked-project.json --allow-write=scripts/ops/out scripts/ops/publishIssueCli.ts --issue-id <같은 id>` (`<ref>`는 `supabase/.temp/project-ref`, 출력에서 지운다)
4. 보고: "발행됨 · 매거진 파일 수 N · 인쇄용 PDF 앱 노출 경로 0" - 렌더는 디지털 PDF + 쪽 이미지만 `magazine` 버킷 `render/`에 올린다(인쇄용 PDF를 만들지 않는다). 호 id · 커플 id · 주소 0

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
```

   (줄을 칠 때마다 입력 칸이 나온다. 첫 줄에는 프로젝트 주소, 둘째 줄에는 **서비스 키**(대시보드의 service_role 또는 Secret 키)를 넣는다. 공개 키(anon / publishable)를 넣으면 "서비스 키가 아니에요" 안내가 나온다.)

2. 네트워크 허용 범위를 주소에서 읽는다(ref를 직접 적지 않는다):

```
$h = ([Uri]$env:ONDOLOG_SUPABASE_URL).Host
```

3. 미리 보기(아무것도 지우지 않음):

```
deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY --allow-net=$h --allow-read=supabase/.temp/linked-project.json scripts/ops/resetTestAccount.ts <카카오 이메일>
```

4. 실제 삭제:

```
deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY --allow-net=$h --allow-read=supabase/.temp/linked-project.json scripts/ops/resetTestAccount.ts <카카오 이메일> --apply
```
5. 커플 모드(시험 커플 두 계정을 함께 지움 — R81-1). 이메일 2개를 주면 커플 모드다:

미리 보기(아무것도 지우지 않음):

deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY --allow-net=$h --allow-read=supabase/.temp/linked-project.json scripts/ops/resetTestAccount.ts <이메일1> <이메일2>


실제 삭제:

deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY --allow-net=$h --allow-read=supabase/.temp/linked-project.json scripts/ops/resetTestAccount.ts <이메일1> <이메일2> --apply


발행 호까지 지울 때(발행 호가 있으면 이 플래그 없이는 거부된다):

deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY --allow-net=$h --allow-read=supabase/.temp/linked-project.json scripts/ops/resetTestAccount.ts <이메일1> <이메일2> --with-issues --apply


잠금 메모: 실제 커플 시작 전 스크립트 잠금(R76-9 · R78-5)에 **커플 모드도 포함**한다.
끝나면 **PowerShell 창을 닫는다**(창 안의 환경 변수에 키가 남아 있다).

시험(원격 없음): `deno test --no-check --no-lock --unstable-sloppy-imports scripts/ops/resetTestAccountCheck.ts` (24개 통과)

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
- [74-h2 ④] `--allow-net` 범위: 사람이 ref를 적지 않도록 PowerShell에서 `([Uri]$env:ONDOLOG_SUPABASE_URL).Host`를 읽어 `--allow-net=$h`로 넣는다(스크립트 변경 없이 범위를 한 호스트로 유지) · 공개 키 판별은 `sb_publishable_` 접두어 또는 JWT `role: anon`만(키 값 출력 0) · 출처: PE 위임문 ④ + R78-3
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
- `npm run build:trial`: 시험 빌드(채팅 시험 화면 열림, 원격 값이 비어도 빌드됨). `npm run build`: 운영 빌드 - **`web/.env`의 `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY`가 비면 빌드가 실패한다**(채팅 시험 닫힘).
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
2. **비밀값**(절대 규칙 7): LLM API 키를 Edge Function 비밀로 등록. 이름은 문서에 없다(Q12). service_role 키는 앱 코드·저장소에 넣지 않는다 - Edge Function 환경 변수로만. 기본 주입 여부는 배포 환경에서 확인.
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
2. **`.env`의 `EXPO_PUBLIC_SUPABASE_ANON_KEY`가 플레이스홀더 상태** —
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
