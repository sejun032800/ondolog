# 서비스 키 교체 계획서 (R87-5) — **PM 승인 요청**

> 작성: 프롬프트 엔지니어 세션 / 2026-11-11
> 근거: Supabase 공식 문서(아래 출처) · Proteur 키 형태 확인(값 출력 0) · 메인 세션 읽기 전용 조사(22:39)
> 키 값은 이 문서 · 보고 · 로그 어디에도 쓰지 않습니다.

---

## 요약

- 노출된 키는 **legacy service_role JWT**입니다(`sb_secret_` 아님 · `eyJ` 시작). → **경로 B**
- 문서가 권하는 길은 **새 API 키(publishable · secret)로 옮기고 legacy를 끄는 것**입니다. legacy JWT 비밀을 다시 만드는 방식은 연결을 즉시 끊고, 마이그레이션 안 한 프로젝트에서는 더 이상 쓸 수 없습니다.
- 저장소 조사 결과 **DB 안(cron · pg_net · Vault · Webhooks)에서 키를 쓰는 곳은 0** → 마이그레이션은 필요 없습니다.
- 바뀌는 곳은 네 군데입니다.
  1. 웹 앱의 공개 키를 publishable로 바꾸고 다시 빌드합니다.
  2. render가 키를 보내는 헤더를 고칩니다(코드).
  3. scripts/ops가 쓰는 supabase-js 판이 새 키를 받는지 확인합니다.
  4. legacy를 끕니다.
- 시점은 **7단계 커플 모드 초기화 직후, 새 계정 첫 가입 전**입니다. 이때는 세션이 어차피 새로 시작되므로 로그아웃 영향이 없습니다.

## ① 문서 확인

| 사실 | 출처 |
|---|---|
| 새 키는 legacy 옆에 추가되고 **둘이 동시에 동작** → 하나씩 옮길 수 있음 | [Migrating to publishable and secret API keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys) |
| 유출 대응: 원인 제거 → 새 secret key 생성 → 모든 구성 요소 이전 · 확인 → 폐기. legacy service_role 유출이면 legacy 폐기가 **anon까지 함께 끔**, 앱은 publishable로. **legacy JWT 비밀도 폐기**해야 유출 키를 믿는 곳이 없어짐 | [Rotate a leaked or compromised API key](https://supabase.com/docs/guides/security/rotate-leaked-api-keys) |
| legacy JWT 비밀 재생성은 즉시 무효 · 연결 끊김. 마이그레이션 안 한 프로젝트는 legacy 회전 불가 → 새 키 권장 | [Rotating Anon, Service, and JWT Secrets](https://supabase.com/docs/guides/troubleshooting/rotating-anon-service-and-jwt-secrets-1Jq6yd) |
| 새 키는 **`apikey` 헤더**로. `Authorization: Bearer`로 보내면 JWT로 해석돼 거부될 수 있음. secret key는 브라우저에서 401. 사용자 로그인 · 세션은 그대로(사용자 토큰은 아직 JWT 비밀로 서명) | 마이그레이션 문서 |
| legacy 비활성화는 되살릴 수 있음(되살리면 유출 키도 살아남) · 새 secret key 삭제는 되돌릴 수 없음 | 두 문서 |

## ② 영향 목록 (메인 세션 조사 — 이름 · 형태만)

| 구성 요소 | 지금 | 교체 때 할 일 |
|---|---|---|
| 웹 앱 `web/.env` | `VITE_SUPABASE_ANON_KEY` = anon JWT(publishable 아님) | 값을 **publishable**로 바꿈(사람이 편집기로, git 밖) → `build:trial` → 두 폰 재설치. 코드 변경은 없을 것으로 예상(supabase-js가 받음 — ③-2에서 확인) |
| Edge Functions | 저장소에 배포용 함수 폴더 없음(`_shared/`와 시험만) · 키 변수 읽지 않음 · verify_jwt 기본 | **콘솔에서 배포된 함수 · 함수 비밀이 있는지만 확인**(저장소 밖에 남은 것이 있을 수 있음) |
| `render/` | `ONDOLOG_SUPABASE_SERVICE_ROLE_KEY`를 **`Authorization: Bearer`**로 보냄(직접 HTTP) | **코드 변경**: secret key를 `apikey` 헤더로 보냄. 작은 위임(`74-k1`) |
| `scripts/ops` 운영 경로 | 같은 변수 · supabase-js가 apikey + Bearer를 보냄 | supabase-js 판이 `sb_secret_`를 받는지 확인(받으면 변경 0) |
| `scripts/ops` 검증 스크립트 | `ONDOLOG_SUPABASE_ANON_KEY` | publishable로 실행되는지 확인 |
| DB(cron 3개 · pg_net · Vault · Webhooks) | 키 사용 0 | 없음 |
| **웹 체험판(Netlify 배포, R89-2)** | 공개 키(legacy anon)를 코드에 직접 적음(`track.ts`, R69-3) · `demo_responses` 수집 | 7 전에 publishable로 바꿔 다시 배포(6.5). 안 하면 7 순간 베타 수집이 **조용히 멈춤** |
| RN 동결 앱 | anon JWT | legacy를 끄면 **동작 정지** — 동결이라 받아들이기를 권함(PM 결정) |
| 저장소 키 모양 문자열 | JWT 0 · `sb_secret_` 모양 1 · `sb_publishable_` 모양 2 — **모두 같은 시험 파일의 가짜 문자열** · 추적되는 `.env` 0 | 없음 |

## ③ 순서

| # | 누가 | 할 일 | 확인 |
|---|---|---|---|
| 0 | Proteur | PC 재시작 · `[bool]$env:...` False(R87-6) | False |
| 1 | Proteur | 7단계 커플 모드 초기화(**지금 legacy 키로**, 보안 입력) | 숫자 출력 · 완료 |
| 2 | 메인 세션 | `74-k1` 위임: render가 secret key를 `apikey` 헤더로 보내게(legacy JWT면 지금 방식 유지 — 둘 다 동작) · scripts/ops supabase-js 판 확인 · 시험. **키 값 없이** 가짜 키로 시험 | Python 수 · 커밋 |
| 3 | Proteur | 콘솔 Settings > API Keys: **publishable 1개 · secret key 2개 생성**(R89-4: 렌더용 `render_2026_11` · 운영 스크립트용 `ops_2026_11`) · Edge Functions 목록 · 비밀 확인. 환경 변수 이름은 그대로, 어떤 키를 넣는지만 HANDOFF에 | 생성됨 |
| 4 | Proteur | `web/.env` 공개 키를 publishable로 → `build:trial` → `cap sync` → 두 폰 설치 | 로그인 화면까지 |
| 5 | Proteur | 새 secret key를 **보안 입력**으로 → 초기화 스크립트 **미리 보기** 1회 · 렌더 미리 보기 1회(읽기) | 숫자 출력 |
| 6 | Proteur | 두 폰 **새 계정 첫 가입**(원래 다음 순서) → 코드 연결(폰 B LG 키보드) → 채팅 1건 | 통과 |
| 6.5 | — | **취소(2026-11-12 Proteur 결정)**: 체험판 응답 수집 종료(`demo_responses` 163건으로 마감 — 데이터는 그대로 보존) · Netlify 사이트는 Proteur가 내림. 아래 원래 계획은 기록용 — **웹 체험판(R89-2)**: ① 체험판 배포본(Netlify, 드래그 앤 드롭 배포)이 쓰는 키 형태 확인(값 출력 0) ② 체험판 원본 폴더에서 공개 키를 publishable로 바꿔 다시 만들고 Netlify에 다시 올림 ③ 체험판에서 응답 1건 → `demo_responses` **행 수 증가로만** 확인(행 내용 읽기 · 수정 0, R56-5) | 행 수 +1 |
| 7 | Proteur | **6.5 통과 뒤에만** 콘솔에서 **legacy 키 비활성화** → 5 · 6을 짧게 다시 | 통과 |
| 8 | Proteur | **6 · 7 통과 뒤에만** **legacy JWT 비밀 폐기**(유출 키를 완전히 무효로). JWT 서명 키 방식으로 옮겨야 할 수 있고, 그러면 **로그인 세션이 끊길 수 있음** → 개발 프로젝트 · 시험 계정뿐이라 다시 로그인으로 충분 | R89-1 · R91-2: 두 폰 다시 로그인 · 채팅 1건 · 초기화 미리 보기 1회 |
| 9 | 메인 세션 | HANDOFF 명령 안내를 새 키 기준으로(변수 이름은 그대로) | — |

**되돌리기**: 7 전까지는 legacy가 살아 있어 언제든 원래대로 돌아갈 수 있습니다. 7 뒤 문제가 생기면 legacy를 되살리지 않고(유출 키도 살아남) 새 키 쪽을 고칩니다. 8은 되돌릴 수 없으니 6 · 7 통과 뒤에만 합니다.

## PM 결정

| # | 항목 | 상태 |
|---|---|---|
| 1 | 이 순서 승인(6 새 계정 첫 가입을 교체 사이에) | **승인(R89-1)** + 6.5 체험판 추가(R89-2) |
| 2 | RN 동결 앱 정지 수용 | **결정됨(R88-4 ①)** — 수용 |
| 3 | 8(legacy JWT 비밀 폐기) | **결정됨(R88-4 ②)** — 이번에 폐기 |
| 4 | 1 커플 모드 초기화는 지금 키로 먼저 | **결정됨(R88-4 ③)** |
| 5 | `74-k1` 위임 허가(render 헤더 · 시험만) | **허가(R89-3)** |
| 6 | secret key 목적별 둘(`render_2026_11` · `ops_2026_11`) | **결정됨(R89-4)** |

## 보완 의견 (PE)

- 메인 세션 보고 일부가 터미널 출력에서 글자가 깨져 전달됐습니다(render 행의 헤더 설명 등). `74-k1` 첫 단계에 **"render · scripts/ops가 지금 보내는 헤더를 파일:줄로 다시 확인"**을 넣어 깨진 부분을 메웁니다.
- 앞으로 운영 키는 **목적별 이름**(예: 렌더용 · 운영 스크립트용)으로 나눠 만들면, 하나가 새도 그것만 지우면 됩니다. 새 secret key는 이름별로 여러 개 만들 수 있습니다(문서의 `default` 등 이름 키). M4 운영 규칙 후보로 올립니다.
