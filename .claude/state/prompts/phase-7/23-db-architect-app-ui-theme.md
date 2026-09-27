# 위임 프롬프트 — 마이그레이션 021: 앱 UI 테마

> 대상: `db-architect`
> 보관 경로: `.claude/state/prompts/phase-7/23-db-architect-app-ui-theme.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-09-27

---

## 목표

`supabase/migrations/021_app_ui_theme.sql` **파일 하나**를 작성한다.

## 근거

**`docs/ONDOLOG_SCHEMA.md` §9-C가 유일한 근거다.** DDL이 전부 거기 있다.

**DDL을 이 프롬프트에 옮겨 적지 않았다.** §9-C를 직접 읽고 그대로 쓸 것.
프롬프트와 문서가 어긋나 보이면 **문서가 원본**이며, 차이를 발견하면
멈추고 보고한다.

> 에이전트 정의에 "001~016 순서"가 적혀 있지만, 이번 작업은
> **021 하나**다. §13의 순서표에 021이 등재돼 있다.

## 입력

- 개발 환경: Windows / PowerShell
- 적용된 마이그레이션: 001~020
- 현재 기준선
  ```
  npx tsc --noEmit -p .                                  → 0 에러
  npx tsc --noEmit -p supabase/functions/tsconfig.json   → 0 에러
  npx jest --ci --watchAll=false                         → 550 tests / 34 suites
  ```

---

## 1부 — 착수 전 보고

§9-C를 읽고 아래를 보고한 뒤 작성한다.

- §9-C의 하위 절 목록과 각각이 무엇을 하는지
- 테마 식별자 6종
- 대상 테이블 셋과 각 테이블이 **몇 번 마이그레이션에서 만들어졌는지**
- `issues_public` 뷰의 **현재 컬럼 목록** (009에서 확인)
- `app_config`의 `pdf_profiles` **현재 값** (010에서 확인)

---

## 2부 — 작성

§9-C의 네 부분을 **한 파일에** 담는다.

| 순서 | 내용 | 절 |
|---|---|---|
| 1 | 컬럼 셋 추가 | 9-C-2 |
| 2 | `issues.theme` 불변 트리거 | 9-C-3 |
| 3 | `issues_public` 뷰 재생성 | 9-C-4 |
| 4 | `pdf_profiles` 정리 | 9-C-5 |

**컬럼 추가가 트리거보다 먼저**여야 한다. 트리거가 참조하는 컬럼이
있어야 하고, 기존 행을 `default`로 채우는 것은 UPDATE가 아니라
트리거를 발동시키지 않는다.

### 반드시 지킬 것 셋

**① 뷰의 새 컬럼은 목록 끝에 둔다.** `create or replace view`는 기존
컬럼의 순서·이름을 바꿀 수 없다. 중간에 넣으면 적용이 실패한다.
`pdf_print_path`는 여전히 제외한다.

**② `pdf_profiles`에서는 `scale`만 제거한다.** 색공간 키를 넣지 않는다.
Chromium의 PDF 출력은 RGB이고 CMYK를 낼 수 없어, 넣으면 **조정했다고
믿는 사람이 생기는 키**가 된다. `scale`을 폐기한 이유와 같다.

**③ 테마 컬럼은 ENUM이 아니라 `text` + `check`다.** §9-C-1이 그 이유를
적고 있다.

---

## 3부 — 파일 자체 검증

**원격 적용은 이 작업의 범위가 아니다.** 사람이 `npx supabase db push`로
한다(절대 규칙 6).

파일 수준에서 아래를 확인해 보고한다.

- §9-C의 DDL과 **문자 단위로 대조**해 차이가 없는지. 차이가 있으면
  그 차이와 이유를 보고
- 뷰의 컬럼 목록이 **009의 목록 + 끝에 `theme`** 인지
- `pdf_profiles`의 새 값에 **`scale`이 없고 색공간 키도 없는지**
- 트리거가 `published_at is not null`일 때만 막는지

---

## 완료 기준

- `supabase/migrations/021_app_ui_theme.sql`이 존재한다
- §9-C의 네 부분이 **순서대로 한 파일에** 있다
- §9-C DDL과 **문자 단위로 일치**한다 (차이가 있으면 보고됨)
- 뷰 컬럼이 **기존 목록 + 끝에 `theme`**
- `pdf_profiles`에 **`scale`과 색공간 키가 없다**
- **001~020 파일이 변경되지 않았다**
- 두 게이트 0 에러, jest 550 / 34 suites 유지

## 하지 말 것

- **001~020 마이그레이션 파일 수정** — 적용된 것이다. 021은 `alter`로 얹는다
- **원격 적용(`db push`)** — 사람이 한다
- **`src/types/database.ts`를 손으로 고치는 것** — 원격 적용 후
  `gen types`로 재생성하는 별도 단계다
- **색공간 키 추가**
- **ENUM 타입 생성**
- **뷰의 새 컬럼을 중간에 넣는 것**
- **§9-C에 없는 컬럼·인덱스·정책 추가** — 필요해 보이면 멈추고 보고
- **RLS 정책 변경** — 이번 범위 밖이다
- `docs/` 편집
- 커밋·푸시, 설정 파일 변경
- 문서에 없는 값을 지어내는 것 — 판단이 서지 않으면 **멈추고 물어볼 것**

## 완료 후

`PROGRESS.md`와 `.claude/state/HANDOFF.md`에 기록한다.

- 021 파일 경로와 네 부분 구성
- §9-C 대조 결과
- **원격 미적용 상태** — 사람이 `npx supabase db push` 후
  `supabase gen types typescript --linked`로 `database.ts` 재생성 필요
