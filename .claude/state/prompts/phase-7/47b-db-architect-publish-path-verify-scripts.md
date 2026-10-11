# 위임 프롬프트 — 022 실증 스크립트 (SCHEMA §9-D-9)

> 대상: `db-architect`
> 보관 경로: `.claude/state/prompts/phase-7/47b-db-architect-publish-path-verify-scripts.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-11
> 기준선: MASTER r53 · ROADMAP r11 · jest 986 · 49

---

## 배경

`47-` A에서 `022_publish_path.sql`을 썼고, PM이 그대로 적용하기로 했다. 적용 직후의 실증 방식을 PM이
**SCHEMA §9-D-9**(r53)에 확정했다. 이번 작업은 그 표대로 **스크립트를 쓰는 것까지**다. 실행은 메인
세션이 사람의 적용 확인 뒤에 한다.

## 범위 — §9-D-9의 "적용 직후" 세 줄

규칙은 여기 옮겨 적지 않았다. **§9-D-9 표를 직접 읽고 그대로** 쓴다.

| # | 대상 | 할 일 |
|---|---|---|
| 1 | 테마 복사 트리거 | `47-`에서 쓴 `scripts/db/verify_022_publish_theme_trigger.sql`을 §9-D-9대로 **고친다.** 진짜 `public.fn_issues_theme_on_publish`를 `like public.issues` 임시 테이블에 건다. `couple_id`는 원격 `couples` 실제 행에서 **읽어서** 쓴다. 초안 행의 `theme`를 그 커플의 `magazine_theme`와 **다른 값**으로 먼저 넣는다. **원격 `couples`가 0행이면** 실증하지 않고 그 사실을 출력하고 끝나게 쓴다(§9-D-9: `48-` C로 미룸) |
| 2 | `fn_publish_issue` 논리 (A) | 임시 테이블 + `pg_temp` 사본. **사본은 022 본문에서 `public.`→`pg_temp.` 기계적 치환으로만** 만들고, **치환 명령을 스크립트에 남긴다.** 손으로 고친 사본은 금지. 스크립트와 결과에 **"논리 확인이며 실제 함수의 증명이 아니다"**를 적는다 |
| 3 | 권한·설정 (B) | `has_function_privilege`(anon·authenticated 불가, service_role 가능), `pg_proc.prosecdef = false`, `proconfig`의 `search_path`, `magazine` 버킷 정책이 SELECT 하나만 남았는지 — **읽기 전용 SELECT만** |

**1에서 임시 `couples`를 만들어 함수 사본을 거는 방식은 쓰지 않는다** (§9-D-9).

## 스크립트가 지킬 것 — §9-D-9 "원격에는 픽스처를 쓰지 않는다"

- 쓰기는 **임시 테이블과 `pg_temp`에만** 한다. 원격 실제 행은 **읽기만** 한다
- 각 확인이 **무엇을 기대하고 실제로 무엇이 나왔는지** 사람이 읽을 수 있게 출력한다
- 파일은 `scripts/db/` 아래, ASCII 파일명. 1은 기존 파일을 고치고, 2·3은 새 파일이면 이름을 보고한다

## 하지 말 것

- **스크립트를 원격에서 실행하는 것** — 실행은 메인 세션이 사람의 적용 확인 뒤에 한다
- `022_publish_path.sql`과 기존 마이그레이션을 고치는 것
- §9-D-9에 없는 확인을 넣는 것, 2의 사본을 손으로 고치는 것
- `docs/`, `src/types/database.ts`, 설정 파일 수정, 의존성 추가
- 문서에 없는 값을 지어내는 것 — **멈추고 물어볼 것**
- 커밋·푸시

## 완료 후

- HANDOFF: **끝에 붙이지 말고 "열린 항목"이나 새 섹션에 넣는다.** 스크립트 셋의 위치와 각 확인 항목
- `PROGRESS.md` 제목 바로 아래에 한 줄
