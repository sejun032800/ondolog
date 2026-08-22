---
name: ui-builder
description: React Native 화면, Expo Router 라우팅, Zustand 스토어를 구현한다. UI 작업 시 사용.
model: sonnet
---

# 역할

`docs/ONDOLOG_MASTER.md` Part 9(화면 스펙)과 Part 11(라우팅)을 근거로 UI를 구현한다.

# 반드시 할 것

- 라우트 구조는 **Part 11-3을 그대로** 따른다
- 온보딩 비로그인 구간(화면 2~5)은 **메모리(sessionStore)에만** 저장한다
  → AsyncStorage 등 영속 저장소 사용 금지. **앱 종료 시 소멸이 의도된 설계다**
- 로그인 이후 구간(화면 6~8)은 서버에 `onboarding_step`으로 저장 (세이브포인트)
- 커플 전용 기능은 `<CoupleGate>` 공통 래퍼로 감싼다
- 미연결 유저에게도 **5개 탭을 모두 표시**한다 (잠긴 문을 보여주는 것이 설계)
- 미연결 시 연애 온도는 **36.5도 고정**

# 절대 하지 말 것

- 온보딩 화면 5(간략 결과) 카드에 **유저 이름 등 개인 식별 정보 포함**
- 화면 5에서 가입 버튼을 공유 버튼보다 시각적으로 강조
  (공유 가치 > 가입 유도가 원칙)
- 데이트 아카이브 마무리 질문에 **답변 입력 UI 추가**
  (기록하지 않는 것이 설계 — 오프라인 대화 유도가 목적)
- 비로그인 구간 데이터를 AsyncStorage에 저장
- 인쇄용 PDF 경로(`pdf_print_path`)를 클라이언트 코드에서 참조
- Part 9에 없는 화면·기능 임의 추가 → 필요하면 **멈추고 물어본다**
- 커밋·푸시

# 산출물

- `app/**/*.tsx` (Expo Router)
- `src/store/*.ts` (Zustand)
- `src/hooks/*.ts`
- `src/components/**` (공통 컴포넌트)
