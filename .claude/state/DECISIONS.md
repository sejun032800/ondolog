# 개발 중 결정

> 기획서에 없던 결정이 개발 중 발생하면 여기 기록한다.
> Phase 종료 시 사람이 검토하고, 채택된 것만 docs/ 문서에 반영한 뒤 여기서 제거한다.

## 2026-08-22 | Expo SDK 버전

- **결정**: SDK 57
- **사유**: SDK 56에 Hermes V1 메모리 회귀가 있어 react-native-reanimated /
  react-native-worklets 사용 앱에 영향. SDK 57에서 해결됨. ONDOLOG는 reanimated를
  쓰므로 57이 강제.
- **영향**: MASTER Part 6 개발환경에 SDK 버전 명시 필요

## 2026-08-22 | react-dom 버전 고정

- **결정**: react-dom을 react와 동일 버전으로 고정
- **사유**: SDK 57 + expo-router 조합에서 expo-router가 웹 지원용으로 radix-ui/vaul을
  끌고 오면서 react-dom이 react보다 상위 버전(19.2.8 vs 19.2.3)으로 해석되어
  ERESOLVE 발생.
- **조치**: `npm pkg set dependencies.react-dom="<react와 동일 버전>"` 후 클린 재설치
- **영향**: CLAUDE.md 알려진 이슈에 추가 완료

## 2026-08-22 | Windows/PowerShell 개발 환경

- **결정**: 개발 환경이 Windows PowerShell
- **영향**: bash `\` 줄바꿈이 동작하지 않음(패키지명으로 인식됨). 문서의 명령어를
  한 줄로 실행하거나 백틱 사용. CLAUDE.md 알려진 이슈에 추가 완료

## 2026-08-22 | PowerShell 히어독 금지

- **사건**: @'...'@ 히어독을 터미널에 붙여넣을 때 명령어가 파일 내용으로 기록되는
  사고가 3회 발생 (supabase/.gitignore, repair.ps1, eas.json)
- **원칙**: 파일 내용 작성은 에디터에서 직접 한다.
  터미널로 파일을 만들 때는 한 줄 명령만 사용한다.
- **검증**: JSON 작성 후 반드시 `Get-Content x.json -Raw | ConvertFrom-Json` 실행

## 2026-08-22 | .gitignore 선행 원칙

- **사건**: .gitignore 없이 git add를 실행해 node_modules가 커밋됨.
  supabase.exe(121MB)가 GitHub 100MB 제한을 넘겨 푸시 거부.
- **조치**: .git 삭제 후 .gitignore부터 작성하고 재초기화
- **원칙**: git init 직후 .gitignore를 먼저 만들고,
  `git status --short`로 node_modules/.env가 안 잡히는지 확인한 뒤에 add한다

  ## 2026-08-22 | PowerShell 히어독 금지

- **사건**: @'...'@ 히어독을 터미널에 붙여넣을 때 명령어가 파일 내용으로 기록되는
  사고가 3회 발생 (supabase/.gitignore, repair.ps1, eas.json)
- **원칙**: 파일 내용 작성은 에디터에서 직접 한다. 터미널로 만들 때는 한 줄 명령만.
- **검증**: JSON 작성 후 `Get-Content x.json -Raw | ConvertFrom-Json` 필수

## 2026-08-22 | Windows 방화벽 8081

- **사건**: Dev Build에서 "Unable to load script" — Metro(8081)로 접속 불가
- **원인**: Windows Defender가 Node.js 인바운드 차단
- **조치**: New-NetFirewallRule -DisplayName "Metro 8081" -Direction Inbound
  -LocalPort 8081 -Protocol TCP -Action Allow
- **대안**: adb reverse tcp:8081 tcp:8081 (USB, 네트워크 무관)

## 2026-08-22 | .gitignore 선행 원칙

- **사건**: .gitignore 없이 git add로 node_modules 커밋 → supabase.exe(121MB)가
  GitHub 100MB 제한 초과로 푸시 거부
- **원칙**: git init 직후 .gitignore부터 작성하고,
  git status로 node_modules/.env가 안 잡히는지 확인한 뒤 add한다