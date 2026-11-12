# 메인 세션 위임 프롬프트 — `74-k2` 키 교체 마무리: HANDOFF 키 안내 정리 (계획서 9단계)

> 보관 경로: `.claude/state/prompts/phase-7/74-k2-dispatch-handoff-keys.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-11-12 (계획서 `74-key-rotation-plan.md` 9단계 · R87-6 · R89-4)
> **범위: `.claude/state/HANDOFF.md`와 `.claude/state/PROGRESS.md`만 편집한다.** 코드 · 문서(`docs/`) · 설정 · `web/` · `render/` · `scripts/` · `supabase/` 변경 0.
> 원격 0(읽기도 0) · 키 값 · 주소 · ref · id · 이메일을 쓰지 않는다.

---

## 0. 지금 상태 (Proteur 콘솔 작업으로 확정)

- legacy API 키(anon · service_role) **비활성화**
- legacy JWT 비밀(HS256) **폐기(Revoked)** · 현재 서명 키는 ECC P-256
- 새 키: publishable 1 · secret 2(`render_2026_11` 렌더용 · `ops_2026_11` 운영 스크립트용)
- `web/.env`의 `VITE_SUPABASE_ANON_KEY`는 **변수 이름은 그대로, 값은 publishable**
- 웹 체험판 수집 종료(R91) · RN 동결 앱은 legacy를 끈 뒤 동작 안 함(R88-4 ①, 수용)

## 1. 할 일

| # | HANDOFF에서 |
|---|---|
| ① | 키 안내 표(74-k1에서 만든 것)를 **현재 상태로 갱신**: legacy 꺼짐 · 폐기 완료 · 어떤 실행에 어떤 secret key를 넣는지 · `web/.env` 이름과 값의 관계 |
| ② | 키를 넣는 모든 안내 바로 아래에 **확인 줄** 상시 추가: `$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY.StartsWith('sb_secret_')` → `True`여야 진행(publishable을 넣으면 오류 없이 빈 결과만 나옴 — 74-s2에서 실제로 일어남) |
| ③ | 키를 쓴 작업 끝에 **환경 변수 확인 줄**: 창을 닫고 새 창에서 `[bool]$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY` → `False`. 사용자 · 시스템 범위 영구 저장 금지 문장(R87-6) |
| ④ | HANDOFF 안의 **legacy 키를 전제로 한 문장**(service_role JWT · `eyJ` · anon 키 붙여넣기 등)을 찾아 현재 방식으로 고치거나 "폐기됨"으로 표시. 고친 곳 목록(절 이름 · 줄)을 보고 |
| ⑤ | 실행 위치 주의 한 줄: deno 명령은 **저장소 맨 위 폴더**에서(`O:\web`에서 실행해 `deno.json`을 못 찾은 일이 있었음) |
| ⑥ | PROGRESS 맨 위에 한 줄: "키 교체 완료(2026-11-12) — legacy 비활성화 · JWT 비밀 폐기 · 목적별 secret 2" |

## 2. 완료 기준 · 보고

1. 변경 파일은 HANDOFF · PROGRESS 둘뿐
2. 두 파일에 키 모양 문자열 · 주소 · ref · id · 이메일 0(R87-6 — 건수로 확인)
3. 보고: ①~⑥ 각각 고친 위치 · ④ 목록 · 커밋 명령(맨 위 폴더에서 · 이름 하나씩 · 영어 메시지) · 여기서 멈춤

## 넘어온 보류 항목 (R79-2)

| 항목 | 다음 |
|---|---|
| `docs/74-exploration-guide.md` 옛 스크립트 안내(A-8) · 생성 · 발행 CLI의 ref 출력(A-27) | 최종 수정 지시서 |
| 탐방 2차 전체 판독 · PM 분류 | 74-k2 커밋 뒤 |
