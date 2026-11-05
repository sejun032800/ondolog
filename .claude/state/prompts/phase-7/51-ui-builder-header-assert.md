# 위임 프롬프트 — 헤더 단언 한 줄 (`51-` 사전 작업 ①)

> 대상: `ui-builder`
> 보관 경로: `.claude/state/prompts/phase-7/51-ui-builder-header-assert.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-11-05 (PM 지시 `51-` §3-①, ROADMAP R60-3)
> **시험 파일 한 곳만.** 앱 코드 · 설정 · 의존성 · 원격 0.

---

## 할 일

`__tests__/components/u8ProbeTimeout.test.tsx`의 "헤더 0" 단언을 바꾼다.

- **이전**: `Object.keys(init.headers).length === 0` 계열(헤더 객체의 키 수를 셈)
- **이후**: **`init.headers === undefined`**(옵션에 `headers` 자체가 없음)

이유: `headers`가 `Headers` 객체로 바뀌면 안에 값이 있어도 `Object.keys`가 빈 배열이라 지금 단언이 통과한다(R60-3).

## 지켜야 할 것

- 그 파일의 다른 단언 · 시험은 바꾸지 않는다
- 앱 코드(`src/` · `app/`) 변경 0 — 지금 등록 함수에는 `headers`가 없으니 바뀐 단언도 그대로 통과해야 한다. **통과하지 않으면 고치지 말고 멈춰서 보고한다**
- 커밋 · 푸시는 사람

## 게이트

tsc 0 / 0 · jest(요약 줄 그대로 — 시험 수는 그대로 1765여야 한다) · 실패 0

## 완료 후

`PROGRESS.md` 제목 바로 아래에 한 줄
