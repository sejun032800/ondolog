# 메인 세션 전달 겸 위임 프롬프트 — `74-k1` 새 secret key 대응: render 헤더 · scripts/ops 확인

> 보관 경로: `.claude/state/prompts/phase-7/74-k1-dispatch-render-key-header.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-11-11 (PM 결정 ROADMAP r89 · R89-3 · R89-4 · 계획서 `74-key-rotation-plan.md`)
> 대상: 메인 세션. 코드 수정은 담당 서브에이전트에게 위임해도 된다.
> **범위: `render/` Python과 그 시험, `scripts/ops/` 확인(코드 변경은 필요할 때만 — §2). HANDOFF · PROGRESS 기재는 예외로 허가한다**(결정 기록 · 커밋 명령 · 키 넣는 안내).
> 마이그레이션 0 · 원격 0(읽기도 0) · 새 패키지 0 · `web/` · `supabase/` · 보호 파일 0 · **시험은 가짜 키로만** · 실제 키 값을 묻거나 출력하지 않는다.

---

## 0. 배경 (한 줄씩)

- 유출됐을 수 있는 legacy service_role 키를 새 API 키로 바꾼다. 새 secret key(`sb_secret_…`)는 **`apikey` 헤더**로 보내야 하고, `Authorization: Bearer`로 보내면 JWT로 해석돼 거부될 수 있다(Supabase 마이그레이션 문서).
- secret key는 목적별 둘: 렌더용 `render_2026_11` · 운영 스크립트용 `ops_2026_11`(R89-4). **환경 변수 이름은 그대로**(`ONDOLOG_SUPABASE_SERVICE_ROLE_KEY`) — 실행할 때 어떤 키를 넣는지만 다르다.
- legacy 키는 교체 7단계까지 살아 있으므로, **두 형태가 모두 동작해야** 한다.

## 1. 먼저 확인 (보고 맨 앞 — 이전 조사 보고 글자가 깨져서 다시)

| 대상 | 적을 것 |
|---|---|
| `render/`가 Storage · REST · RPC에 보내는 헤더 | 파일:줄 · 헤더 이름(`apikey` / `Authorization`) · 넣는 값(키 / 사용자 토큰) |
| `scripts/ops/` 운영 경로(`supabaseOps.ts` 등) | supabase-js **판(정확한 버전)** · 그 판이 `sb_secret_` · `sb_publishable_` 키를 받는지(문서 · 변경 기록 근거) · 직접 쓴 헤더 유무 |
| `scripts/ops/` 검증 스크립트(`verify*.ts`) | 공개 키를 어떻게 쓰는지 · publishable로 동작할지 |

## 2. 고칠 것

| # | 할 일 |
|---|---|
| ① | **render**: 키가 `sb_`로 시작하면 `apikey` 헤더에만 키를 넣고 `Authorization: Bearer <키>`는 보내지 않는다. legacy JWT(`eyJ`)면 **지금 방식 그대로**. 형태 판정은 접두어로만 하고 값은 어디에도 출력하지 않는다 |
| ② | **scripts/ops**: §1에서 supabase-js 판이 새 키를 받으면 **변경 0**. 받지 않으면 **멈추고 보고**(패키지 판 올리기는 새 패키지 허가가 필요) |
| ③ | 오류 문구 · 로그에 키 · 키 접두어 뒤 글자 0. 실패 시 "키 형태: legacy / new"만 |
| ④ | **HANDOFF 키 안내**: 렌더 실행 때는 `render_2026_11`, 운영 스크립트(초기화 · 생성 · 발행) 때는 `ops_2026_11`을 같은 변수 이름으로 **보안 입력**한다는 표 한 개. 키 값 · 프로젝트 주소 0 |

## 3. 시험 (가짜 키로만)

- 가짜 `sb_secret_test…` → 요청 헤더에 `apikey`만 · `Authorization`에 키 없음
- 가짜 legacy JWT 모양 → 지금과 같은 헤더(회귀)
- 사용자 토큰을 쓰는 경로가 있으면 그대로
- 오류 문구에 키 문자열 0
- 기존 Python 시험 전체 회귀 0(기준 **305**)

## 4. 완료 기준 · 보고

1. Python 수(305 → 늘어난 수) · 루트 `tsc` · `jest` 회귀 0
2. 커밋 대상에 키 · 주소 · ref · 이메일 0 · 저장소 키 모양 문자열 건수 변화 0(R87-6)
3. 보고 순서: §1 표 → 바꾼 곳(파일:줄) → scripts/ops 판정 → 시험 → 결정 기록(출처: R89-3 · R89-4 · Supabase 마이그레이션 문서) → 커밋 명령(맨 위 폴더에서 · 이름 하나씩 · 영어 메시지) → 여기서 멈춤

## 넘어온 보류 항목 (R79-2)

| 항목 | 다음 확인 |
|---|---|
| 계획서 3~9(키 생성 · 새 빌드 · 첫 가입 · 체험판 · legacy 끄기 · JWT 비밀 폐기) | 74-k1 커밋 뒤 Proteur |
| 최종 수정 지시서 대기 목록 전체 | 전체 판독 뒤 |
