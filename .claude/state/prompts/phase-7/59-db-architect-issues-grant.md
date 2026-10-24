# 위임 프롬프트 — 마이그레이션 024 · 발행물 읽기 열 권한 (`59-` A)

> 대상: `db-architect`
> 보관 경로: `.claude/state/prompts/phase-7/59-db-architect-issues-grant.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-10-24
> 기준선: MASTER r68 · ROADMAP r32 · `58-` 커밋됨 · 원격에는 023까지 적용됨

---

## 목표 (PM)

**사용자 권한으로 발행물(`issues_public`)을 읽을 수 있게 하되, 인쇄 PDF 경로(`pdf_print_path`)는 어떤 클라이언트 경로로도 읽히지 않게 한다.** (ROADMAP R32-1 · 절대 규칙 3 · 5)
이번 위임은 **파일을 쓰고 원격을 읽는 데까지**다. 원격 적용은 사람이 하고(절대 규칙 6), 실증은 적용 뒤 메인 세션이 한다.

**배경 (SCHEMA §10-7 결함 기록).** `issues_public`은 `security_invoker = true` 뷰라서 **호출자의 권한으로** `issues`를 읽는데, 009가 `issues`의 `authenticated` 권한을 모두 회수했다. 그래서 사용자 권한으로는 한 줄도 읽히지 않았다. 지금까지의 실증은 모두 service_role이었다.

**근거 (원본을 직접 읽는다)**
- `docs/ONDOLOG_SCHEMA.md` **§10-7**(결함과 고친 방식) · **§9-C-4**(뷰 칸 목록) · **§9-D-8**(`magazine` 버킷) · **§9-D-10**(타입 재생성 — 메타데이터 예외 R31-3) · §9-E(023 작성 방식)
- `docs/ONDOLOG_ROADMAP.md` 결정 **R32-1 · R32-4 · R31-3 · R31-7 · R13-7**

## 범위

| # | 할 일 |
|---|---|
| 1 | **원격 카탈로그에서 현재 `issues_public` 정의를 읽어**(읽기 전용) 내보내는 칸 목록을 확정한다. SCHEMA §9-C-4 기준 **14칸**: `id, couple_id, issue_type, issue_number, title, cover_path, period_start, period_end, pdf_digital_path, page_count, is_trial, published_at, created_at, theme`. **다르면 멈추고 보고한다** |
| 2 | 마이그레이션 024: `grant select (그 칸들) on public.issues to authenticated;` — **`pdf_print_path`와 목록 밖 칸은 주지 않는다. `anon`에는 아무것도 주지 않는다. 정책·뷰는 바꾸지 않는다.** definer 뷰를 쓰지 않는다 |
| 3 | **`magazine` 버킷 SELECT 정책**(`storage.objects`)을 원격에서 읽는다(읽기 전용). 그 정책이 `issues`·`issues_public`를 **어떤 권한으로** 조회하는지 본다. 사용자 권한으로 `issues`를 읽는 식이면 1~2로 풀리는지 판단하고, 그래도 막히면 고칠 방법을 **적용 전에 보고한다 — 정책을 새로 쓰는 일은 PM 확인 뒤**다. 이번 마이그레이션에 정책 변경을 넣지 않는다 |
| 4 | **적용 전 확인 SQL**(같은 이름의 권한·객체 상태) · **권한 확인 SQL**(`information_schema.column_privileges` — `pdf_print_path`에 `authenticated` 권한 없음, 허용 14칸에만 있음, `anon` 0건) · **실증 스크립트**(아래 B ①~⑧, 사용자 권한) — **쓰기만 하고 실행하지 않는다** |
| 5 | 사람이 적용할 명령 — **023과 같은 순서**: 연결 확인 → `npx supabase migration list` → `npx supabase db push --dry-run` → `npx supabase db push` |

### 실증 스크립트가 다룰 경우 (B — 원격 개발, anon 키 + 시험 계정 로그인)

| # | 경우 | 기대 |
|---|---|---|
| ① | 발행 호가 있는 커플 계정으로 `issues_public` 조회 | 발행 호만 · 14칸 |
| ② | 같은 계정으로 `issues` 직접 조회, `pdf_print_path`를 고름 | **거부**(열 권한 없음) |
| ③ | 같은 계정으로 `issues` 직접 조회, 허용 칸만 | 발행 호만(RLS) — 초안 0건 |
| ④ | 다른 커플 계정 | 그 커플의 호 0건 |
| ⑤ | 비로그인 | 0건 또는 거부 |
| ⑥ | 표지·쪽 이미지·디지털 PDF 서명 URL 만들기 → 받기 | 200 |
| ⑦ | 다른 커플 계정으로 같은 경로 서명 URL | 거부 |
| ⑧ | `app/(tabs)/main.tsx` "최근 발행물"이 쓰는 조회(코드를 읽고 같은 조회를 재현) | 동작 |

- **출력 원문을 파일로 남기게** 쓴다. **서명 URL 값은 출력하지 않고 HTTP 상태만** 적는다. 키 값은 어디에도 쓰지 않는다
- 시험 데이터 이름에 `test`(R13-7). Deno는 `--no-lock`(R31-7)

## 범위 밖

뷰 정의 변경 · `issues_select` 정책 변경 · `magazine` 버킷 정책 변경(3에서 필요해 보이면 보고만) · definer 뷰 · 앱 코드 · 다른 테이블 권한

## 하지 말 것

- **원격 DB에 DDL·DML을 실행하는 것** — 마이그레이션 적용과 실증 스크립트 실행을 포함한다(절대 규칙 6). 원격은 1·3의 **읽기 전용 조회**만
- 기존 마이그레이션 파일을 고치는 것
- `docs/`, `src/types/database.ts`, 설정 파일 수정, 의존성 추가
- 문서에 없는 값을 지어내는 것 — **멈추고 보고**
- 커밋·푸시

## 게이트

- tsc 0 / 0 · jest 전부 통과(마지막 요약 줄 그대로)

## 산출 — 완료 보고에 붙인다

1. 원격 `issues_public` 정의에서 읽은 칸 목록 — 14칸과 같음 / 다름(멈춤)
2. 마이그레이션 파일 경로와 **전문**
3. `magazine` 버킷 SELECT 정책 원문과 판단 — 1~2로 풀림 / 따로 고쳐야 함(방법 제안, 적용 전 PM 확인)
4. 적용 전 확인 SQL · 권한 확인 SQL · 실증 스크립트 경로와 실행 방법
5. 사람이 쓸 적용 명령(023과 같은 순서)
6. SCHEMA에 옮길 물리 명세 초안(위치)

## 완료 후

- `PROGRESS.md` 제목 바로 아래에 한 줄
- 내부 결정은 HANDOFF에 항목당 한 줄 (끝에 붙이지 말고 "열린 항목"이나 새 섹션에)
