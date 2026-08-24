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

## 2026-08-23 | Phase 1(DB) — .env 파일이 PowerShell 히어독 사고의 4번째 피해자였음

- **사건**: `npx supabase migration list` 실행 시
  `LegacyDbConfigLoadError: failed to parse environment file: .env` 발생.
  원인 조사 결과 `.env` 파일 내용 자체가 `@'\nEXPO_PUBLIC_SUPABASE_URL=...\n'@ |
  Set-Content -Path .env -Encoding utf8` 형태로, PowerShell 히어독 명령문이
  실행되지 않고 파일 내용으로 그대로 기록되어 있었다. 기존에 기록된 3건
  (supabase/.gitignore, repair.ps1, eas.json)에 이은 4번째 사례.
  또한 `EXPO_PUBLIC_SUPABASE_ANON_KEY` 값이 `eyJhbGci...`로 잘려 있어
  유효한 JWT가 아님(플레이스홀더 상태)도 함께 발견.
- **조치**: `.env`를 `KEY=VALUE` 두 줄로 재작성(Write 도구 사용)하여
  파싱 에러 해결. anon key는 원문이 이미 손상되어 있어 실제 값을 복원할
  방법이 없으므로 플레이스홀더를 그대로 유지 — **실제 anon key로 교체 필요**
  (HANDOFF.md 기록, git에는 커밋되지 않는 파일이라 이력 복구 불가).
- **확인**: `.env`는 `.gitignore`에 등재되어 있고 git 커밋 이력에도 없음
  (`git log --all -- .env` 결과 없음) → 이 손상판이 원격에 노출된 적은 없음.
- **참고**: supabase CLI의 `migration list`/`db push`/`db query` 자체는 anon
  key를 쓰지 않는다(access token + DB 비밀번호 기반). `.env` 파싱 실패가
  이 명령들을 막은 것은 CLI가 프로젝트 루트의 `.env`를 무조건 먼저 읽고
  파싱하기 때문이며, 내용의 유효성과 무관하게 문법 자체가 깨져 있으면 즉시
  실패한다.

## 2026-08-23 | Phase 1(DB) — RLS "테이블 생성 시 즉시 활성화 + 정책은 011/012에서 일괄 작성" 패턴 채택

- **배경**: 최상위 지시("RLS 정책을 같은 마이그레이션 파일에 함께 작성")와
  SCHEMA.md §13 마이그레이션 파일 분할(003~010에서 테이블 생성, 011에서
  헬퍼 함수, 012에서 정책 일괄 생성)이 문자 그대로는 충돌한다.
- **결정**: 001~012 기존 파일이 이미 채택한 절충안을 그대로 유지한다 —
  각 테이블 생성 직후 `alter table ... enable row level security`를
  **같은 파일에서 즉시 실행**하여 정책이 없는 동안에도 전면 차단(deny-by-default)
  상태를 보장하고, `is_couple_member()` 등 헬퍼에 의존하는 실제 정책 본문은
  SCHEMA.md 원문 순서 그대로 011/012에서 작성한다.
- **사유**: "RLS 없이 테이블 생성 금지"의 실질적 목적(정책 공백 구간에 데이터
  노출 금지)은 정책 부재 상태의 RLS 활성화만으로도 완전히 충족된다(정책 없는
  RLS 테이블은 service_role 외 전원에게 전면 차단). SCHEMA.md 자체의 파일
  순서를 임의로 재배치하면 오히려 원문 대조 검증이 어려워진다.

## 2026-08-23 | Phase 1(DB) — 013 배치 함수에 `revoke execute ... from public` 추가

- **배경**: SCHEMA.md §11의 `expire_stories` / `apply_retention_policy` /
  `execute_dissolution` 함수 정의 원문에는 revoke/grant 구문이 없다.
- **결정**: 세 함수 모두 `security definer`(RLS 우회)이며 PostgreSQL은 함수
  생성 시 기본적으로 PUBLIC에 EXECUTE를 부여한다. Supabase는 EXECUTE 권한이
  있는 함수를 PostgREST RPC(`/rest/v1/rpc/...`)로 자동 노출하므로, revoke하지
  않으면 임의의 인증된 클라이언트가 `execute_dissolution(다른_커플의_id)`
  같은 호출로 RLS를 우회해 타인 데이터를 삭제할 수 있는 심각한 취약점이 된다.
  같은 원리로 SCHEMA.md §10-1 자체도 RLS 헬퍼 함수에 동일한 revoke/grant
  패턴을 이미 명시하고 있어, 이 추가는 SCHEMA.md의 기존 원칙을 §11 함수에도
  일관 적용한 것이다.
- **영향**: 배치 함수는 이제 pg_cron(내부적으로 postgres 슈퍼유저 컨텍스트)과
  향후 Edge Function(service_role)만 실행 가능. 클라이언트 grant 없음.
- **문서 반영 필요**: docs/ONDOLOG_SCHEMA.md §11 예시 코드에 revoke 구문 추가 검토.

## 2026-08-23 | Phase 1(DB) — 014_cron.sql에 pg_cron 확장 생성 구문 추가

- **배경**: SCHEMA.md §11-4는 `cron.schedule(...)` 호출만 있고 확장 활성화
  구문이 없다(§1 확장 목록에도 pg_cron 없음).
- **결정**: `create extension if not exists pg_cron with schema extensions;`를
  cron.schedule 호출 앞에 추가. 확장 없이는 `cron` 스키마/함수가 존재하지
  않아 마이그레이션이 실패한다.
- **결과**: 실제 push 성공, `cron.job`에 3개 작업(expire-stories,
  retention-policy, execute-dissolutions) 등록 확인.

## 2026-08-23 | Phase 1(DB) — 015 Storage 정책을 entries 예시에서 messages/stories/magazine으로 확장

- **배경**: SCHEMA.md §12는 entries 버킷 정책만 "예시"로 제공하고
  "Storage 정책도 동일 원칙"이라고만 명시한다. 나머지 4개 비공개 버킷의
  실제 정책 SQL은 문서에 없다.
- **결정**: 버킷 목록표의 "접근" 열이 동일하게 "커플 구성원"이고 경로
  모호성이 없는 messages/stories/magazine에는 entries와 동일한
  `{couple_id}/...` + `is_couple_member()` 패턴을 그대로 적용했다.
  반면 avatars는 개인 대표사진(couple 매칭 이전에도 존재)과 커플 대표사진이
  같은 버킷을 공유해 경로 규칙(`{user_id}/...` vs `{couple_id}/...`)이
  SCHEMA.md에 없으므로 **정책을 만들지 않았다**(RLS는 이미 활성화되어 있어
  정책 부재 = 전면 차단, 안전한 기본값). magazine-print는 SCHEMA.md 원문대로
  정책 없음을 유지.
- **후속 조치 필요**: avatars 경로 규칙 확정 후 정책 추가 (HANDOFF.md 기록).

## 2026-08-23 | Phase 1(DB) — 016 love_type_labels 시드를 비워둠 (콘텐츠 미확정)

- **배경**: SCHEMA.md §4-3은 love_type_labels **테이블 구조**만 정의한다.
  36종(애니어그램 9 × 애착 4) 코드 네이밍 규칙과 label_ko/copy_ko/
  description_ko 실제 카피는 문서 어디에도 원문으로 없다(예시 코드 2건뿐:
  KLE, MSF). docs/ONDOLOG_ROADMAP.md §5도 이를 "Phase 3 전" 미작성 콘텐츠로
  이미 추적 중이다.
- **결정**: CLAUDE.md "문서에 없는 내용을 지어내지 말 것" 원칙에 따라 36종
  라벨/카피를 임의로 창작해 INSERT하지 않는다. 016 파일은 존재하되(마이그레이션
  순서 계약 충족) 실제 데이터 없이 사유만 기록한다. 테이블/RLS(전체 공개 읽기)는
  이미 준비되어 있어 콘텐츠 확정 즉시 INSERT만 추가하면 된다.
- **후속 조치 필요**: Phase 3 착수 전 콘텐츠팀이 36종 네이밍·카피 확정
  (HANDOFF.md 기록, ROADMAP §5와 동일 항목).

## 2026-08-24 | Phase 2(엔진) — 문서에 없는 공식은 지어내지 않고 자리표시자로 남긴다

- **배경**: 5문항 채점(Part 10-2)·36종 라벨(Part 10-5)·6각 스탯 가중합
  (Part 17-3)은 마스터 문서에 수치가 원문 그대로 있어 그대로 구현했다.
  반면 아래 4곳은 마스터·SCHEMA·ORCHESTRATION·ROADMAP 문서 전체를 grep
  대조했으나 실제 공식/파라미터 원문이 어디에도 없었다.
- **결정**: 값을 지어내 코드로 굳히는 대신, 문서에 확정된 부분(범위·기본값·
  클램프·소수 자릿수·구조적 조합식 등)만 구현하고 핵심 공식은 미구현
  자리표시자로 남긴다. 각 자리표시자는 해당 파일 상단 docblock에 "문서
  어디에 없는지"와 "무엇으로 대체했는지"를 명시했다.
- **사유**: CLAUDE.md "문서에 없는 내용을 지어내지 말 것. 불명확하면
  작업을 멈추고 물어볼 것" 원칙. 특히 채점·스탯·온도·DNA는 전부 결정론
  계약이 걸린 영역이라, 근거 없는 가중치를 코드에 굳히면 나중에 "왜 이
  숫자냐"는 질문에 답할 근거가 없어지고, 결정론 계약(동일 입력→동일
  출력)의 "출력"이 자의적 값이 되어 감사 가능성이 깨진다.
- **영향받는 파일 4개**:
  1. `src/engine/temperature.ts` — 연애 온도 결합 공식(대화량/응답속도/
     감정 톤 → 온도값). Part 9-2 "선행 프로젝트의 연애 일치율 로직
     계승"이라고만 되어 있고 그 선행 프로젝트 로직 원문이 없음.
  2. `src/engine/dnaScore.ts` — DNA base_score 궁합 공식(빅5·애니어그램·
     스턴버그·애착 조합 가중치) + 애니어그램 9×9 best/worst 매트릭스
     (Part 16-1 미확정).
  3. `src/engine/leagueStats.ts`의 `computeOvrRawScore` — OVR 처리 순서
     ②(연애 포지션별 가중치, 피파 포지션 로직 차용). 포지션 네이밍 자체가
     Part 16-1 미확정이라 가중치 표가 성립할 수 없음. 6개 스탯 단순
     평균으로 대체.
  4. `src/engine/leagueStats.ts`의 `computeSixStats` — 베이지안 수축
     (shrinkage) 보정. "설계 원칙"으로만 언급되고 사전평균·수축 강도 등
     구체 파라미터가 없어 미구현(원점수를 보정 없이 그대로 사용).
- **승인**: 코디네이터가 2026-08-24 검토 후 4곳 모두 자리표시자 상태로
  Phase 2 완료 처리를 승인함. 후속 조치는 HANDOFF.md "Phase 3 착수 전
  처리 필요한 것" 3~6번 참조.