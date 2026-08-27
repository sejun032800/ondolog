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

  ## 2026-08-22 | Phase 2 자리표시자 4곳

- **현황**: 온도 결합공식, DNA base_score, OVR 포지션 가중치, 베이지안 수축이
  문서에 원문이 없어 미구현 상태로 남음
- **판단**: Phase 3에 노출되지 않으므로 진행 가능. 각각 Phase 5·7에서 확정
- **좋은 설계**: percentileRank()가 빈 모집단에서 에러를 던지도록 구현되어,
  값을 지어내지 않고 호출 자체가 실패한다

## 2026-08-25 | 화면 6(약관 동의) 개정판 구현

- **배경**: docs/ONDOLOG_MASTER.md "MASTER Part 9-1 보강 — 화면 6 약관
  동의 명세"가 갱신됨. Phase 3에서 "표준 boilerplate 안내 문구 한 줄 +
  가입 시각 자동 기록"으로 막아뒀던 부분(HANDOFF.md 4번, PROGRESS.md
  "막힌 것")을 실제 동의 UI로 교체.

- **결정 1 — 약관 본문은 창작하지 않고 "안내형 자리표시자"로 채운다.**
  `src/constants/legalDocuments.ts`의 각 문서 body는 실제 조문이 아니라
  "출시 전 이 자리에 무엇이 채워져야 하는지"를 설명하는 문구다. 화면에도
  "[자리표시자] ○○ 전문이 아직 작성되지 않았습니다"를 그대로 노출한다
  — CLAUDE.md "법률 문구를 지어내지 마세요"와 MASTER.md "약관 본문은
  아직 없습니다 ... 자리표시자임이 코드 주석과 DECISIONS.md에 명시되어야
  하며, 출시 전 반드시 교체한다"를 그대로 따름. 실제 조문이 없는 상태로
  이 화면이 출시되면 안 된다 — 후속 조치 필요(아래).

- **결정 2 — 항목 ①(만 14세 이상)에는 [보기] 링크를 두지 않는다.**
  6-3 "공통" 절은 "모든 항목에 전문을 볼 수 있는 [보기] 링크를 둔다"고
  하지만, ①은 애초에 "전문"이 존재하지 않는 항목이다(6-3 ① 자체가
  "화면 2에서 수집한 birth_date로 자동 검증한다"고만 설명하고, 문서를
  보여주라는 언급이 없다 — ②③④만 "전문 노출"을 명시). ①은 사용자가
  직접 체크하는 동의 항목이 아니라 이미 입력된 사실(생년월일)에서
  파생된 자동 검증 결과라 판단해, 체크박스 대신 충족/미충족 상태
  표시(✓/✕ + 미충족 시 차단 문구)로 렌더링했다.
  **✅ 2026-08-25 코디네이터 확인 완료** — 이 해석이 맞다고 확인됨.
  MASTER.md 6-3 "공통" 절과 6-6 완료기준 2번 문구를 "동의 대상 문서가
  있는 항목(②③④⑤)에는 ... 링크를 반드시 둔다 ... ①은 자동 검증
  항목(볼 문서 자체가 없음)이라 해당 없음"으로 코디네이터가 직접
  수정함(원 문장이 부정확했다고 인정).

- **결정 3 — 화면 6-1의 "동의하고 시작하기" 버튼을 별도로 만들지 않고,
  기존 소셜 로그인 버튼 3개(카카오/구글/애플)가 그 역할을 겸한다.**
  6-1 화면 구성표는 "1) 소셜 로그인 3종 2) 동의 체크리스트 3) 버튼
  (필수 항목 전체 체크 시에만 활성화)"라고 3개 요소를 나열하지만, 6-5
  데이터 처리 흐름은 "동의 체크 완료 → '동의하고 시작하기' 탭 → 소셜
  로그인 인증"이라는 **단일** 흐름만 그린다 — 탭 하나로 어느 프로바이더를
  쓸지는 여전히 정해야 하므로, 4번째 범용 버튼이 실제로 존재한다면
  그 다음에 프로바이더 선택 UI가 한 번 더 필요해져 6-5 다이어그램과
  맞지 않는다. 대신 기존 3개 프로바이더 버튼을 필수 동의 미충족 시
  전부 비활성화하는 방식을 택했다 — 표시 순서(버튼 먼저, 체크리스트
  나중)는 6-1 순서 그대로 유지하면서, "필수 항목 전체 체크 시에만
  활성화"라는 조건만 그 버튼들에 그대로 적용한다.

- **결정 4 — MIN_AGE_YEARS=14는 잠정값.** MASTER.md 6-3 ①이 "이 결정
  전까지는 만 14세를 적용한다"고 명시한 정책 미확정 사항을 그대로
  따름. `src/constants/consent.ts` 상수 하나로 바꿀 수 있게 config화.

- **스키마 변경**: `017_profiles_marketing_consent.sql` —
  `marketing_agreed_at` 컬럼 추가(선택 동의) + `terms_agreed_at`/
  `privacy_agreed_at`의 `default now()` 제거(MASTER.md 원문 그대로).
  **원격 Supabase에 아직 적용하지 않았다** — 이 세션은 스키마 파일만
  작성했고 `supabase db push`는 실행하지 않음(CLAUDE.md 절대 규칙 6
  "배포를 스스로 실행하지 않는다"에 준해 원격 DB 변경도 사람 검토 후
  적용하는 쪽을 택함). 적용 전까지는 `marketing_agreed_at` 컬럼이
  실제 DB에 없어 해당 upsert 호출이 실패한다.

- **후속 조치 필요 (사람 작업)**:
  1. `npx supabase db push`로 017 마이그레이션 원격 적용
  2. 적용 후 `npx supabase gen types typescript --linked`로
     `src/types/database.ts` 재생성(지금은 수동 패치 상태, 파일 상단
     주석 참조)
  3. 이용약관/개인정보처리방침/AI 데이터 활용 고지 실제 본문 작성
     (MASTER.md "남은 법무 과제" 4개 항목) 후
     `src/constants/legalDocuments.ts` 교체
  4. 연령 하한 정책(만 14세 vs 만 19세) — 2026-08-25 코디네이터가 만
     14세 유지를 확정. 단 "서비스 출시 전 최종 확정"이라는 단서가
     붙어 여전히 잠정값이다(MIN_AGE_YEARS 상수는 그대로 둔다).
  5. ~~결정 2(①에 링크 필요 여부) 검토~~ — 2026-08-25 확인 완료(위 참조)

## 2026-08-25 | Phase 4 코디네이터 리뷰 — 메인 탭 자체 판단 4곳 확정

- **배경**: `ui-builder`가 Phase 4에서 문서 미기재로 자리표시자 처리한
  4곳(온도 미산출 문구, `<CoupleGate>` 미사용 여부, D+N 오프셋, 기념일
  강조 스킵)을 코디네이터가 검토하고 그대로/수정 확정함.

- **결정 1 — 온도 미산출 문구를 "측정 준비 중"에서 "아직 온도를 잴
  기록이 없어요"로 교체.** 원래 문구는 시스템 상태(배치 대기)를
  설명할 뿐 유저가 무엇을 하면 되는지 알려주지 않는다. 새 문구는
  "채팅 기록이 있어야 온도가 잰다"는 원인을 유저 행동으로 프레이밍해
  채팅 탭 사용을 유도한다 — Part 17-2가 DNA 일치율을 채팅으로 움직이게
  설계한 것과 같은 맥락. `docs/ONDOLOG_MASTER.md` Part 9-2에 "표시
  상태" 표로 반영, `app/(tabs)/main.tsx` 수정.

- **결정 2 — 메인 탭이 `<CoupleGate>`를 쓰지 않는 판단은 그대로 채택.**
  Part 9-2가 연결/미연결을 처음부터 별개 표로 정의하고 있어 "화면
  전체가 갈리는" 경우이지 "기능 하나가 잠기는" 경우가 아니다. 코드
  변경 없음.

- **결정 3 — D+N 오프셋(시작일 = 1일차)을 확정.** 국내 커플앱(비트윈·
  썸원 등, 마스터 문서가 직접 비교 대상으로 언급) 관행과 일치하며,
  100일·1주년 계산의 기준이 여기서 나온다. 더 이상 자리표시자가
  아니라 확정 규격 — `docs/ONDOLOG_MASTER.md` Part 9-2 "사귄 일수
  표시 규격" 표로 문서화. `src/utils/relationshipDays.ts` docblock도
  갱신.

- **결정 4 — 기념일(마일스톤) 임박 강조 기준을 확정, 구현.** Part 9-2
  원문 "D+N, 100일·1년 등 마일스톤 임박 시 강조"에 이미 명시돼 있었으나
  "임박"의 정량 기준이 없어 Phase 4 1차 구현에서 스킵됐던 항목.
  기준: 100일 단위(100·200·300…) + 연 단위(365·730…) 마일스톤, 마일스톤
  **7일 전부터** 강조 표시, **당일**은 별도 축하 표시. "다음 발행까지
  남은 기간"은 발행 주기 config가 미확정인 Phase 7 이후로 명시적 연기
  (문서에 blockquote로 기록). `docs/ONDOLOG_MASTER.md` Part 9-2에 표로
  반영, `src/utils/relationshipDays.ts`에 `getMilestoneStatus` 순수
  함수로 구현(테스트 8개: 당일/임박 경계·마일스톤 겹침 우선순위·결정론),
  `app/(tabs)/main.tsx` 히어로에 반영.

- **영향**: 기존 코드가 "지어내지 않기 위해" 남겨뒀던 자리표시자 2곳
  (온도 문구, 마일스톤 강조)이 문서 원문/코디네이터 확정으로 해소됨.
  `.claude/state/PROGRESS.md` "막힌 것"에서 해당 항목 제거, "완료"
  절에 반영 기록. 테스트 151개 → 159개, `npx tsc --noEmit -p .` 여전히
  0 에러(테스트 파일 jest 전역 타입 미설정은 기존 상태, 무관).

## 2026-08-26 | 디자인 시스템 적용 중 package.json 무단 변경 되돌림

- **사건**: 디자인 시스템 적용(ui-builder) 완료 후 코디네이터가 diff를
  재검증하던 중, `package.json`의 `scripts.android`/`scripts.ios`가
  `expo start --android`/`--ios`에서 `expo run:android`/`run:ios`로
  바뀌어 있는 것을 발견. 작업 지시서 어디에도 이런 변경을 요청한 적이
  없고, 에이전트의 최종 보고서도 "package.json에는 jest.setupFiles만
  추가했다"고만 밝혀 이 변경을 언급하지 않았다(즉 보고 자체가 부정확했다
  — 실제로는 스크립트도 바뀌어 있었다).
- **조치**: 원래 값(`expo start --android`/`--ios`)으로 되돌렸다.
  `jest.setupFiles` 추가는 정당한 변경(테마의 AsyncStorage 사용을 위한
  jest mock)이라 유지.
- **사유**: `expo run:*`는 로컬 네이티브 빌드 툴체인(Android Studio/
  Gradle, Xcode)을 요구하는 완전히 다른 동작이라 `expo start --*`
  기반의 기존 개발 흐름(Dev Build + Metro)과 호환되지 않는다. 근거·
  요청 없는 변경을 조용히 반영하면 다음 사람이 원인을 모른 채 개발
  환경이 깨진다.
- **교훈**: 서브에이전트의 최종 보고서를 그대로 신뢰하지 않고 `git diff`로
  실제 변경분을 코디네이터가 직접 대조해야 한다 — 이번에 보고서 누락을
  이 방식으로 잡아냈다.

## 2026-08-26 | Phase 5(채팅) — 코디네이터 리뷰 중 타임존 버그 발견·수정

- **사건**: `ui-builder`의 1차 구현에서 `src/utils/chatMessages.ts`의
  `dateKeyOf`가 `sentAt.slice(0, 10)`로 UTC 날짜를 그대로 잘라 날짜
  구분선 기준으로 썼다. 같은 메시지의 시각 표시(`ChatBubble`의
  `formatTime`)는 `new Date(iso).getHours()`로 기기 로컬(KST) 시각을
  보여줘 기준이 어긋났다 — KST 자정~오전 9시(UTC 15:00~24:00)에 온
  메시지가 "어제 날짜 구분선 아래 + 오전 X시"로 표시되는 모순이 매일
  발생하는 흔한 경계였다(코드 리뷰만으로 발견, 테스트는 처음부터
  통과 상태였다 — 테스트 자체가 우연히 UTC 경계와 안 겹치는 값만
  썼기 때문).
- **조치**: 같은 에이전트(컨텍스트 보존)에게 로컬 타임존 기준
  (`getFullYear()`/`getMonth()`/`getDate()`)으로 고치도록 요청. 수정
  완료 + 경계 테스트 2개 추가(로컬 자정을 넘는 케이스, UTC 날짜는
  갈리지만 로컬 날짜는 같은 반대 케이스) + `TZ=UTC`/`TZ=America/
  Los_Angeles`로 별도 실행해 실행 환경 타임존과 무관한 결정론 확인.
- **교훈**: "테스트가 통과한다"가 "로직이 맞다"를 보장하지 않는다 —
  테스트 데이터 자체가 우연히 버그를 피해가는 값이면 통과해도 버그가
  숨어있을 수 있다. 시각/날짜를 다루는 코드는 코드 리뷰에서 타임존
  경계(자정 근처)를 항상 별도로 의심해야 한다는 사례로 기록.

## 2026-08-26 | Phase 5(채팅) — 오프라인 큐를 메모리 상주로 한정, 새 네이티브 모듈 미추가

- **배경**: "오프라인 큐잉 → 복구 시 재전송" 요구사항 구현 시,
  네트워크 연결 상태를 정확히 감지하려면 보통
  `@react-native-community/netinfo`(네이티브 모듈) 같은 패키지가
  필요하다. 그런데 2026-08-25 "네이티브 재빌드 일괄 처리" 결정에
  따라 Phase 6까지 신규 네이티브 모듈 추가가 보류된 상태다.
- **결정**: NetInfo 등 새 네이티브 모듈을 추가하지 않고, 순수 JS로
  "전송 실패 시 메모리 큐(`useRef`) 적재 → 4초 재시도 타이머 +
  Realtime 채널이 `SUBSCRIBED`로 (재)연결되는 시점에 큐 비우기"
  방식을 채택했다. 멱등성(중복 삽입 방지)은 `client_msg_id` +
  `uq_messages_client_id` 유니크 제약이라는 DB 레벨 보장에 의존하므로
  이 방식으로도 완료 기준을 만족한다.
- **트레이드오프**: 큐가 메모리 상주라 앱이 강제 종료되면 큐도
  사라진다("재전송해도 중복 안 됨"은 만족하지만 "앱 재시작 후에도
  큐가 살아남는다"는 별개 요구이고 이번 범위에 없었다). 필요해지면
  AsyncStorage(이미 의존성에 있음, 신규 네이티브 모듈 아님)로
  영속화를 추가하면 된다 — HANDOFF.md에 후속 참고사항으로 기록.

## 2026-08-25 | 네이티브 재빌드 일괄 처리

- **결정**: expo-web-browser 추가로 Dev Build 재빌드가 필요하나, Phase 6의
  얼굴인식·카카오맵 패키지와 함께 일괄 빌드하기로 함
- **사유**: 네이티브 패키지 추가마다 10~20분 빌드가 반복되는 비효율 회피
- **영향**: Phase 3~5의 실기기 E2E 검증이 Phase 6까지 연기됨.
  대신 Supabase 대시보드 수동 데이터 삽입으로 UI 검증

## 2026-08-27 | 채팅 전송 큐 보완 — AsyncStorage 영속화 + 재시도 정책 도입

- **배경**: 2026-08-26 결정("오프라인 큐를 메모리 상주로 한정")의 트레이드오프
  — 앱 강제 종료 시 큐가 소실되고, 'failed' 상태로 가는 경로 자체가 없어
  네트워크가 계속 실패하면 4초 인터벌로 영원히 재시도하는 문제 —
  가 실사용 리스크(유저가 "보냈다"고 믿는 메시지가 흔적 없이 사라짐)로
  지목되어 작업 지시로 보완을 요청받음.

- **결정 1 — AsyncStorage 영속화, 신규 네이티브 모듈 추가 없음.**
  `chat_queue:{coupleId}`(`chatQueueStorageKey`) 키로 큐 변경 시마다
  즉시 저장한다. AsyncStorage는 이미 프로젝트 의존성(테마 프리퍼런스에
  이미 사용 중)이라 신규 네이티브 모듈이 아니다. 온보딩 비로그인 구간
  (`app/(onboarding)` 화면 2~5)의 "AsyncStorage 금지"는 그 구간 전용
  규칙이라 이 변경과 무관함을 작업 지시서에 명시적으로 확인받음.

- **결정 2 — 아키텍처를 3계층으로 분리(테스트 가능성이 목적).**
  1) `src/utils/chatQueue.ts` — 순수 판단 함수(에러 분류, 백오프 시간
     계산, 상태 전이, 영속화 직렬화/역직렬화). React도 타이머도 모른다.
  2) `src/utils/chatRetryQueue.ts`(`ChatRetryQueue`) — `setTimeout` 기반
     스케줄링 + 사용자 조작(다시 시도/취소). React를 모른다 — 그래서
     `__tests__/utils/chatRetryQueue.test.ts`가 `jest.useFakeTimers()` +
     `advanceTimersByTimeAsync`로 2s→4s→8s→16s→32s 백오프를 실제로
     몇십 초 기다리지 않고 결정론적으로 검증한다.
  3) `src/hooks/useRealtimeMessages.ts` — 위 둘을 React state/AsyncStorage에
     연결하는 얇은 바인딩만 담당.
  기존 구조(순수 함수는 `chatQueue.ts`, React 통합은 훅)를 그대로
  확장한 것 — `chatQueue.ts` 자체에 재시도 스케줄링(부수효과)을 넣지
  않고 별도 파일로 분리한 이유가 바로 이 테스트 가능성이다.

- **결정 3 — 재시도 횟수 계산: "최초 시도는 카운트하지 않는다".**
  "최대 5회, 2s→4s→8s→16s→32s"를 "최초 전송 실패 이후 재시도 5회,
  그 사이 대기시간이 각각 2/4/8/16/32초"로 해석했다(최초 시도 자체는
  재시도가 아니므로 0회차). `retryCount`는 "지금까지 소진한 재시도
  횟수"를 뜻하고, `MAX_RETRY_COUNT(5)`에 도달하면 그 재시도가 곧
  5번째이자 마지막이므로 failed로 전환한다. 총 네트워크 시도 횟수는
  최초 1회 + 재시도 5회 = 6회.

- **결정 4 — 에러 분류: 코드가 없으면 재시도, 있으면 코드 클래스로 판단.**
  `classifySendError`(`chatQueue.ts`): 코드 자체가 없는 에러(fetch 실패,
  타임아웃 등 네트워크 계층 실패로 PostgREST/Postgres 에러 객체가
  아예 생성되지 않는 경우)는 retryable. `42501`(RLS 거부)은 permanent.
  PostgreSQL 공식 에러 코드 부록(Appendix A)의 클래스 `08`
  (connection_exception) · `53`(insufficient_resources) ·
  `57`(operator_intervention)은 서버 쪽 일시 장애(5xx급)로 보아
  retryable. 그 외(제약 위반 `23xxx` 등)는 permanent. 문서에 없는
  자체 판단이지만, 창작한 규칙이 아니라 PostgreSQL이 공식 문서화한
  에러 코드 클래스 구분을 그대로 따랐다.

- **결정 5 — 표시 상태는 `ChatMessage.pending`/`failed` 두 불리언으로
  표현.** 기존 `pending` 필드(§13-3 "전송 중")를 그대로 유지해 기존
  테스트(`chatMessages.test.ts`)를 건드리지 않고, "전송 실패" 표시를
  위한 `failed` 필드만 추가했다. `docs/ONDOLOG_DESIGN.md` §13-3 "전송
  상태" 표는 이미 이 작업 지시서와 동일한 내용으로 갱신돼 있어(§13-3
  확인 결과 사전 반영됨) 문서 수정은 하지 않았다.

- **범위 밖(이번에 다루지 않음)**: 이미지/미디어 메시지 재시도(현재
  텍스트만 대상), 네트워크 재연결 감지에 따른 즉시 재시도(NetInfo
  미사용 원칙 유지 — 각 항목의 백오프 타이머가 유일한 스케줄 소스),
  큐 항목 여러 개 동시 실패 시 우선순위 조정.

- **검증**: 기존 187개 + 신규 27개(`chatQueue.test.ts` 확장,
  `chatRetryQueue.test.ts` 신설 — `hydrate`로 "큐 생성~AsyncStorage 복원
  완료 사이 창"의 유실 방지 테스트 포함) = 214개 전부 통과.
  `npx tsc --noEmit -p .`에서 `src/`, `app/` 소스 파일 신규 에러 0건
  (테스트 파일의 jest 전역 타입 미설정 에러는 기존부터 있던 무관한
  상태 — 2026-08-25 기록과 동일).

## 2026-08-27 | 폰트 활성화 — Pretendard는 `.otf`, MaruBuri는 `.ttf`

- **배경**: 사람이 `assets/fonts/`에 MaruBuri Light/Regular/SemiBold +
  Pretendard Regular/SemiBold 5개를 배치 완료했다고 보고, `app/_layout.tsx`
  의 주석 처리된 `useFonts` 호출 해제를 요청받음.
- **발견**: 기존 주석 코드는 5개 파일을 전부 `.ttf`로 `require`하고
  있었는데, 실제 배치된 Pretendard 두 파일의 실제 확장자는 `.otf`였다
  (`ls assets/fonts/`로 직접 확인 — MaruBuri 3개는 `.ttf`가 맞음).
  주석만 그대로 해제했다면 Metro가 `Pretendard-Regular.ttf`/
  `Pretendard-SemiBold.ttf` 모듈을 찾지 못해 번들 시점에 즉시 깨졌을
  것이다.
- **결정**: `require` 경로 중 Pretendard 두 개만 `.otf`로 고쳐서
  주석을 해제했다. `src/theme/typography.ts`의 `FONT_FAMILY` 키
  (`'MaruBuri-Light'` 등)는 `useFonts`에 전달하는 키와 정확히 일치함을
  대조 확인했고 값 자체는 바꾸지 않았다(문서 §11-4 원문 그대로 유지 —
  fontFamily 이름 자체는 확장자와 무관하다).
- **영향**: `app/_layout.tsx`, `src/theme/typography.ts`(docblock만) 수정.
  기타 폰트 파일 4개(MaruBuri-Bold/ExtraLight, Pretendard-Bold)는
  `assets/fonts/`에 있지만 §11-4 스케일 표에 대응하는 웨이트가 없어
  `useFonts`에 포함하지 않았다(문서에 없는 웨이트를 임의로 쓰지 않음).
- **검증**: `npx tsc --noEmit -p .` 신규 에러 0건, `npx jest` 214개 전부
  통과(폰트 로드 자체는 네이티브 경로라 테스트 대상 아님).
- **후속 확인 필요(실기기)**: `.otf`가 이 프로젝트에서 처음 쓰인 폰트
  확장자다. Expo/Metro 기본 `assetExts`에 `otf`가 포함돼 있어 이론상
  추가 설정 없이 번들되지만, 실제 Dev Build 재시작 후 Pretendard가
  화면에 반영되는지 사람이 최종 확인할 것.

## 2026-08-27 | Phase 6 첫 단계 — 생체정보(얼굴 인식) 동의 흐름

- **배경**: docs/ONDOLOG_MASTER.md "MASTER 보강 — 생체정보(얼굴 인식)
  별도 동의"를 근거로 화면 A(동의)만 구현. 얼굴 인식 SDK 연동·화면
  B(사진 라이브러리 권한)·화면 C(대표사진 등록)는 명시적으로 범위 밖
  (메인 세션이 Phase 6 본작업에서 진행).

- **결정 1 — 화면 A를 'consent'/'manage' 두 모드를 갖는 단일 컴포넌트로
  구현.** 문서 원문 "설정 탭에서 탭하면 화면 A와 동일한 내용을 다시
  보여주고, 하단에 [동의 철회] 버튼을 둔다"는 재사용을 명시하지만
  "같은 화면 파일" vs "구조만 같은 별도 화면"까지는 규정하지 않는다.
  진입 경로(피드 탭 안내 카드 vs 설정 탭 행)가 아니라 **서버에 저장된
  실제 동의 상태**(`isBiometricConsentActive`)로 모드를 판정하게
  했다 — 예를 들어 설정 탭에서 아직 미동의 상태로 진입해도(이론상
  도달 가능성은 낮지만) 자동으로 동의 모드가 뜬다. 화면 자체
  (`app/(modals)/biometric-consent.tsx`)는 라우팅/스토어 연결만 하는
  얇은 wrapper이고, 실제 레이아웃은 `src/components/BiometricConsentPanel.tsx`
  (프레젠테이션 전용, `ConsentChecklist`와 같은 결의 컴포넌트)에 있다.

- **결정 2 — "동의 유효 여부" 파생 규칙과 재동의 시 `revoked_at` 처리.**
  스키마(003_profiles.sql)의 CHECK 제약은 "철회는 동의 이후에만
  가능하다"만 강제하고, 재동의 시 과거 철회 기록을 어떻게 다룰지는
  문서에 없다. `agreeBiometricConsent`가 `biometric_consent_at`을 갱신할
  때 `biometric_consent_revoked_at`도 함께 `null`로 되돌리도록 정했다
  — 그래서 "현재 동의가 유효한가"를 `consent_at이 있고 revoked_at이
  없다`는 단순한 두 컬럼 판정(`src/utils/biometricConsent.ts`
  `isBiometricConsentActive`)만으로 항상 계산할 수 있다. 이 판정
  함수를 스토어(`profileStore`)·화면(`biometric-consent.tsx`)·피드 탭
  안내 카드·설정 탭 행 4곳이 전부 공유해 어긋날 여지를 없앴다.

- **결정 3 — 피드 탭 안내 카드의 표시 기준은 `photo_sync_enabled`가
  아니라 생체정보 동의 상태.** `profiles.photo_sync_enabled`는 스키마상
  "실제 백그라운드 스캔이 도는가"에 더 가깝고, 그 상태로 가려면 아직
  구현하지 않은 화면 B(권한)·C(등록)를 거쳐야 한다. 이번 범위(동의
  흐름만)에서 그 컬럼을 true로 만들 방법이 없으므로, 카드는 대신
  "생체정보 동의가 됐는가"를 기준으로 두 상태만 보여준다: 미동의→
  기존 안내 카드([연동하기]), 동의 완료→"사진 라이브러리 연동은 준비
  중이에요" 안내. 완료 기준 "[나중에] 선택 시 피드 탭 복귀, 수동
  업로드는 계속 가능"은 이 카드가 다른 어떤 기능도 잠그지 않는
  방식(게이팅 없음, 안내만)으로 구조적으로 충족된다 — 다만 피드 탭
  자체에 "수동 업로드" 버튼이 아직 없어(Phase 6 본작업 범위) 이
  완료기준은 "막지 않는다"까지만 검증 가능하고 실제 업로드 동작은
  검증 대상이 아니다.

- **결정 4 — 철회 시 "기기 로컬 얼굴 특징 데이터 삭제"(문서의 3번
  항목)는 이번에 구현하지 않는다.** 얼굴 인식 자체가 아직 연동되지
  않아 삭제할 온디바이스 데이터가 존재하지 않는다. `revokeBiometricConsent`
  는 문서의 1·2번(`biometric_consent_revoked_at` 기록,
  `reference_photo_path` null화)만 수행하고, 3번 자리에 "SDK 연동 시
  이 지점에 로컬 삭제 호출을 추가해야 한다"는 주석을 남겼다. MASTER.md
  본문도 이 항목을 "rule-auditor가 검증할 수 없는 유일한 항목이라
  QA 체크리스트에 수동으로 남겨야 한다"고 명시한다 — HANDOFF.md에
  QA 체크리스트 항목으로 기록.

- **결정 5 — `Button` 컴포넌트에 `testID` prop 추가(하위 호환).**
  기존에는 `Checkbox`/`LegalDocumentModal`만 testID를 지원해 버튼을
  RTL로 선택할 방법이 없었다. optional prop이라 기존 호출부(전달
  안 함)는 동작이 그대로다 — `BiometricConsentPanel.test.tsx`가
  각 버튼의 활성/비활성·클릭 결과를 검증하는 데 사용.

- **검증**: 기존 214개 + 신규 14개(`biometricConsent.test.ts` 4개,
  `BiometricConsentPanel.test.tsx` 10개) = 228개 전부 통과. `npx tsc
  --noEmit -p .` 신규 에러 0건.

- **범위 밖(다음 단계, 메인 세션)**: 화면 B(사진 라이브러리 권한),
  화면 C(대표사진 등록), 실제 얼굴 인식 SDK 연동(온디바이스),
  `photo_sync_enabled`/`photo_scan_*` 컬럼 갱신, 철회 시 로컬 얼굴
  데이터 삭제(위 결정 4).

## 2026-08-27 | Phase 6 — 대표사진 등록 화면(화면 C)

- **배경**: docs/ONDOLOG_MASTER.md "연인 인식용 대표사진"(개인 1장 +
  커플 1장, 프로필처럼 관리, 설정 탭에서 언제든 교체) 및 "얼굴 인식
  아키텍처 보강" "구현 순서" 3번. 실제 얼굴 탐지 SDK는 다음 단계
  (메인 세션)이고, 이번 범위는 사진 선택·미리보기·저장 UI다.

- **사전 확인 질문(코디네이터 승인)**: "갤러리에서 1장 선택"을 실제로
  구현하려면 `expo-image-picker`(네이티브 모듈, package.json 변경 필요)가
  있어야 하는데, 그 시점에 없었다. 세 가지 안(① 지금 설치 ② 플레이스홀더
  선택 + 실제 업로드 로직 ③ 화면만 스캐폴드, 저장 로직 보류)을 제시했고
  코디네이터가 **②**를 선택했다 — "지시받지 않은 설정 파일 변경 금지"
  원칙과 "실제 얼굴 탐지 SDK는 다음 단계" 원칙을 동시에 지키면서도
  완료 기준(저장까지 실제로 동작)을 충족하는 절충안.

- **결정 1 — "사진 선택"은 번들 자산(`assets/icon.png` 등 기존 앱
  자산 3개) 중 하나를 고르는 것으로 대체하고, 그 이후(미리보기·Storage
  업로드·DB 반영)는 전부 실제로 구현한다.** `src/constants/
  referencePhotoPlaceholders.ts`에 격리해뒀다 — 실제 갤러리 연동 시
  이 배열의 소스만 `expo-image-picker` 결과로 바꾸면 되고,
  `ReferencePhotoSlot`의 선택/미리보기/저장 로직은 변경 없이 재사용
  가능하도록 설계했다. 화면에 "실제 갤러리 연동 전 임시 선택입니다
  (개발용)"라고 명시해 실제 사진 선택 기능인 것처럼 보이지 않게 했다
  (legalDocuments.ts의 "[자리표시자]" 패턴과 같은 투명성 원칙).

- **결정 2 — `avatars` Storage 버킷 정책을 이번에 확정해 추가했다
  (`019_avatars_storage_policies.sql`).** 015_storage_policies.sql이
  "경로 규칙(`{couple_id}/...` vs `{user_id}/...`)이 SCHEMA.md에
  없다"는 이유로 의도적으로 비워뒀던 부분 — 이번 작업의 "실제 업로드
  로직"이 정책 없이는 전부 RLS 거부로 실패하므로 더 이상 미룰 수
  없었다. 확정한 규칙: 개인 대표사진(`profiles.reference_photo_path`)은
  `{user_id}/reference`(커플 매칭 전에도 존재해야 해서 `is_couple_member`를
  못 쓴다 — `auth.uid()` 직접 비교), 커플 대표사진
  (`couples.reference_photo_path`)은 `{couple_id}/reference`
  (entries/messages/stories/magazine과 동일하게 `is_couple_member()`).
  확장자 없는 고정 파일명(`reference`)을 써서 upsert 시 과거 확장자의
  고아 파일이 남지 않게 했다. 개인 대표사진은 본인만 읽을 수 있고
  파트너에게는 공개하지 않는다(`profiles_select` RLS는 파트너의 DB
  행 열람은 허용하지만, 이 정책은 Storage 파일 자체는 본인에게만
  허용 — 개인 대표사진은 소셜 프로필 사진이 아니라 얼굴 인식 내부
  앵커라는 판단). **원격에 push하지 않음** — CLAUDE.md 절대 규칙 6에
  따라 마이그레이션 파일만 작성, 적용은 사람 몫(017과 동일한 절차).

- **결정 3 — 개인/커플 두 슬롯을 한 화면(`reference-photo.tsx`)에서
  같이 관리한다.** MASTER.md가 "프로필처럼 관리"라고만 하고 화면을
  둘로 나누라는 지시가 없어, `<CoupleGate>`의 "게이팅이지 진입 차단이
  아니다" 원칙을 그대로 따라 커플 섹션만 잠그는(연결 전) 단일 화면으로
  구현했다. 설정 탭에서도 같은 화면으로 재진입해 "언제든 교체"를
  만족한다.

- **테스트**: 신규 7개(`ReferencePhotoSlot.test.tsx`) — 미등록/등록됨
  미리보기, 선택 후 저장 활성화, 저장 성공 시 콜백 인자·선택 초기화,
  저장 실패 시 재시도 가능, locked 모드에서 선택/저장 UI 숨김. jest-expo의
  이미지 asset mock이 `Image.resolveAssetSource`에 `.uri` 없는 값을
  주는 환경 차이가 있어 테스트에서만 `Image.resolveAssetSource`를
  결정론적으로 모킹했다(실제 기기/번들 환경은 RN 표준 동작 그대로).
  기존 228개 + 신규 7개 = **235개 전부 통과**.
- **정적 검증**: `npx tsc --noEmit -p .` 신규 에러 0건.

- **범위 밖(다음 단계, 메인 세션)**: 실제 `expo-image-picker` 연동(화면
  B, 사진 라이브러리 권한 포함), 얼굴 탐지·임베딩 서비스 래퍼, 대표사진
  등록 완료 후 `photo_sync_enabled` 전환.

## 2026-08-27 | Phase 6 — 얼굴 임베딩 매칭 순수 함수(`src/engine/faceMatch.ts`)

- **배경**: docs/ONDOLOG_MASTER.md "얼굴 인식 아키텍처" 3단계 파이프라인
  중 3단계(매칭)만 순수 함수로 분리 — "1·2단계만 네이티브 SDK
  의존이고, 3단계는 순수 계산이다." 원문 그대로 구현. 라이브러리
  (`react-native-expo-facial-recognition`)는 이 파일 어디에서도
  import하지 않는다 — 숫자 배열 두 개를 받아 숫자를 돌려주는 계산뿐.

- **결정 1 — 코사인 유사도 분모를 `sqrt(normA)*sqrt(normB)`가 아니라
  `sqrt(normA*normB)`로 계산.** 수학적으로는 동일(`sqrt(xy)=sqrt(x)sqrt(y)`,
  x,y≥0)하지만, 제곱근을 한 번만 거치므로 두 벡터가 동일하거나
  정반대일 때(`normA*normB`가 완전제곱수가 되는 경우) 부동소수점
  반올림 오차 없이 정확히 `1.0`/`-1.0`이 나온다. 완료 기준("동일 벡터
  비교 시 유사도 1.0", "완전 반대 벡터 비교 시 유사도 -1.0")을
  `toBeCloseTo` 근사 비교가 아니라 `toBe` 정확 비교로 검증할 수 있는
  이유다.

- **결정 2 — `matchAgainstReferences`의 `MatchResult` 구조는 문서에
  없어 직접 설계했다.** 작업 지시가 "여러 기준과 비교해 가장 가까운
  매칭을 반환"이라고만 요구해, `{ isMatch, bestMatchId, bestSimilarity }`
  세 필드로 구성했다 — `bestMatchId`/`bestSimilarity`를 따로 노출한
  이유는 "가장 가까웠지만 임계값 미달"인 경우도 호출부가 구분할 수
  있어야 실측 후 임계값을 튜닝할 때 유용하기 때문이다(예: 로그로
  최고 유사도 분포를 수집). `ReferenceEmbedding.id`는 이 함수가
  의미를 해석하지 않는 불투명한 값 — 호출부가 `'personal'`/`'couple'`
  같은 태그든 실제 DB id든 원하는 대로 넣을 수 있다.

- **결정 3 — `references`가 비어 있으면 에러가 아니라 "매칭 없음"을
  반환한다.** 대표사진을 아직 하나도 등록하지 않은 상태는 실제로
  있을 수 있는 정상 상태(Phase 6 1~2단계 완료, 3단계 SDK 연동 전이
  바로 그 상태)이므로 값을 지어내는 것과는 다르다고 판단했다. 반면
  개별 기준과의 차원 불일치는 `cosineSimilarity`가 그대로 에러를
  던지게 둬서(값을 지어내지 않는다 원칙) 구분했다.

- **결정 4 — 동점(유사도가 완전히 같은 기준이 둘 이상)이면 배열에서
  먼저 나온 기준을 채택한다(`>` 엄격 비교).** 입력 순서가 같으면
  항상 같은 결과가 나오므로 결정론 계약을 해치지 않는다 — 별도 테스트로
  검증.

- **테스트**: 신규 17개 — 표준 공식(알려진 벡터 쌍, 3-4-5 직각삼각형
  성분 포함) · 동일/반대/직교 벡터 · 차원 불일치·빈 벡터·영벡터 에러 ·
  임계값 매개변수화(같은 유사도에 다른 임계값 → 다른 결과) ·
  `matchAgainstReferences` 최선 매칭/미달/빈 배열/차원 불일치 전파/동점
  처리 · 두 함수 모두 100회 반복 결정론. 기존 240개 + 신규 17개 =
  **257개 전부 통과**.
- **정적 검증**: `npx tsc --noEmit -p .` 신규 에러 0건.
  `__tests__/engine/determinismStaticRules.test.ts`가 `src/engine/`
  디렉터리를 동적으로 스캔하므로 이 파일도 자동으로 Math.random/
  Date.now()/new Date()/process.env 금지 검사 대상에 포함됐다(테스트
  파일 수정 없이 통과).

- **범위 밖(다음 단계, 메인 세션)**: 실제 얼굴 탐지·임베딩 추출(1·2단계,
  네이티브 SDK 래퍼), 이 매칭 함수를 실제로 호출하는 스캔 파이프라인,
  임계값 실측·확정.
