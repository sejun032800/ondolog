# ONDOLOG AI 오케스트레이션 설계

> 클로드 코드에게 개발을 위임하기 위한 운영 규약
> 앞선 세 문서가 **무엇을 만드는가**를 다룬다면, 이 문서는 **어떻게 만들게 하는가**를 다룬다
> 이 문서의 산출물은 실제 저장소에 들어가는 파일들이다 (`CLAUDE.md`, `.claude/agents/*.md`)

---

## 0. 설계 전제 — 클로드 코드의 실제 동작

설계 전에 서브에이전트가 **실제로 어떻게 동작하는지** 못 박는다. 여기를 오해하면 구조 전체가 틀어진다.

| 사실 | 설계에 미치는 영향 |
|---|---|
| 서브에이전트는 **부모와 완전히 격리된 컨텍스트**에서 시작한다 | 대화 맥락을 물려받지 못한다. 필요한 건 전부 위임 프롬프트에 써야 한다 |
| 부모→자식으로 가는 유일한 통로는 **위임 프롬프트** | 파일 경로·에러 메시지·이전 결정을 명시적으로 넣어야 한다 |
| 서브에이전트는 **CLAUDE.md와 메모리 계층, 지정된 스킬 전문**을 받는다 | **절대 규칙을 CLAUDE.md에 넣으면 모든 에이전트가 자동 상속**한다 |
| 자식→부모로 오는 것은 **최종 메시지 하나뿐** | 중간 과정(파일 읽기, 도구 호출)은 부모가 못 본다 |
| 에이전트 간 조율은 **공유 파일 + 오케스트레이터**로만 가능 | 실시간 메시지 버스가 없다. 상태 공유는 파일 경로를 규칙으로 정해야 한다 |
| Anthropic 권장 규모는 **3~5개** | "가상 AI 회사" 식 10명 조직도는 실제 아키텍처와 맞지 않는다 |
| 모델 믹싱으로 **비용 40~60% 절감** 가능 | 검증·리뷰는 Haiku, 설계·오케스트레이션은 상위 모델 |

### 0-1. 이전 구상(Twin.me 시절)에서 폐기하는 것

| 폐기 | 사유 |
|---|---|
| ~~Supabase `agents`/`tasks`/`logs` 테이블로 실시간 상태 공유~~ | 클로드 코드에는 메시지 버스가 없다. **파일 기반 조율**로 대체 |
| ~~5개 부서 · 10명 named agent 조직도~~ | 권장 규모(3~5)를 크게 초과. 컨텍스트 낭비이자 조율 비용만 늘어난다 |
| ~~에이전트가 서로 호출하는 구조~~ | 불가능하다. 오케스트레이터만 호출한다 |

### 0-2. 유지하는 것

| 유지 | 사유 |
|---|---|
| **사람이 오케스트레이터** | 라이브 앱에서 자동 커밋을 막기 위함. 이 원칙은 그대로 간다 |
| 에이전트별 스코프 가드 | 단 `CLAUDE.md`가 아니라 **에이전트 정의 파일**에 둔다 |

---

## 1. 조직 구조 — 5 에이전트

> 조직도가 아니라 **작업 경계**다. 각 에이전트는 "격리된 컨텍스트에 참조 문서 하나만 주면 일이 끝나는가"를 기준으로 나눴다.

```
        [사람 = 오케스트레이터]
                 │
        [메인 세션 — 계획·위임·통합]
                 │
   ┌─────────┬───┴───┬─────────┬──────────┐
   │         │       │         │          │
db-architect │  ui-builder  corner-    rule-auditor
        engine-dev          pipeline
```

| 에이전트 | 모델 | 담당 | 유일한 참조 문서 |
|---|---|---|---|
| **`db-architect`** | Sonnet | 마이그레이션, RLS, 배치 함수, Storage 정책 | `ONDOLOG_SCHEMA.md` |
| **`engine-dev`** | Sonnet | 순수 함수 엔진 (5문항 채점, 스탯, 온도) | MASTER Part 10 |
| **`ui-builder`** | Sonnet | RN 화면, 라우팅, 상태관리 | MASTER Part 9 + 11 |
| **`corner-pipeline`** | Sonnet | LLM 코너 생성, Zod 검증, PDF 조판 | `ONDOLOG_CORNER_CONTENT.md` + Part 17 |
| **`rule-auditor`** | **Haiku** | 절대 규칙 위반 검사, 완료 기준 대조 | `CLAUDE.md` 절대 규칙 + Part 13 |

**왜 정확히 5개인가**: 우리가 만든 문서 체계가 그대로 작업 경계가 된다. 각 에이전트에게 문서 하나씩 주면 컨텍스트가 자족적으로 닫힌다. 이게 격리 컨텍스트 환경에서 가장 중요한 성질이다.

### 1-1. 서브에이전트에 위임하지 **않는** 작업

에이전트는 중간 과정을 보여주지 못하므로, **반복 디버깅이 필요한 작업에는 부적합**하다.

| 작업 | 담당 | 사유 |
|---|---|---|
| 프로젝트 초기 셋업 (Expo, EAS, 의존성) | **메인 세션** | 버전 충돌·크래시 우회가 반복 시행착오라 격리 컨텍스트에 안 맞음 |
| 네이티브 모듈 (얼굴 인식, 카카오맵, PDF 뷰어) | **메인 세션** | 빌드 에러·기기 테스트가 왕복 대화를 요구함 |
| 실기기 디버깅 | **메인 세션** | 화면을 보고 판단해야 함 |
| 커밋·푸시·배포 | **사람** | 라이브 앱 보호. 에이전트에게 절대 위임하지 않음 |

---

## 2. 파일 기반 조율

에이전트끼리 말을 못 하므로, **공유 파일이 유일한 인수인계 수단**이다. 파일을 늘리면 관리 비용만 커지므로 3개로 제한한다.

```
.claude/
├── agents/
│   ├── db-architect.md
│   ├── engine-dev.md
│   ├── ui-builder.md
│   ├── corner-pipeline.md
│   └── rule-auditor.md
└── state/
    ├── PROGRESS.md     # 현재 단계와 완료 항목
    ├── HANDOFF.md      # 에이전트 간 인수인계
    └── DECISIONS.md    # 개발 중 발생한 결정 기록
CLAUDE.md               # 절대 규칙 + 환경 (전 에이전트 자동 상속)
```

### 2-1. `PROGRESS.md`

새 세션이 열렸을 때 "지금 어디까지 왔나"를 파악하는 유일한 근거.

```markdown
# 진행 상황
최종 갱신: 2026-09-xx

## 현재 Phase
Phase 2 — 엔진 레이어

## 완료
- [x] Phase 0 프로젝트 셋업 (Expo SDK xx, Dev Build 동작 확인)
- [x] Phase 1 DB (마이그레이션 001~016 적용, RLS 검증 통과)

## 진행 중
- [ ] loveTypeInference.ts — 결정론 단위 테스트 작성 중

## 막힌 것
- (없음)
```

### 2-2. `HANDOFF.md`

에이전트 A의 산출물을 에이전트 B가 이어받을 때만 쓴다. **완료된 인수인계는 즉시 지운다** (누적되면 컨텍스트 오염).

```markdown
# 인수인계

## db-architect → engine-dev
- 생성된 타입: `src/types/database.ts` (supabase gen types 결과)
- 주의: `personality_profiles.enneagram_effective`는 generated column이라 INSERT 대상 아님
- 미해결: `stat_snapshots.position_code`는 nullable로 뒀음 (네이밍 체계 미확정)
```

### 2-3. `DECISIONS.md`

기획서에 없던 결정이 개발 중 발생하면 여기 남긴다. **나중에 MASTER 문서로 승격**시킬 후보 목록이기도 하다.

```markdown
# 개발 중 결정

## 2026-09-xx | PDF 뷰어 라이브러리
- 결정: react-native-pdf 채택
- 사유: WebView 방식은 페이지 넘김 인터랙션 구현 비용이 큼
- 영향: MASTER Part 16 열린 과제 해소 → 문서 갱신 필요
```

---

## 3. `CLAUDE.md` — 전 에이전트 상속 규칙

MASTER Part 15의 내용을 실제 파일로 옮긴 것. **절대 규칙을 여기 두는 것이 핵심**이다. 서브에이전트가 CLAUDE.md를 자동 상속하므로, 여기 있는 규칙은 모든 에이전트에게 전파된다.

````markdown
# ONDOLOG

커플의 기록을 AI가 잡지로 발행하는 아카이브 + 매거진 앱.

## 참조 문서
- `docs/ONDOLOG_MASTER.md` — 기획·설계 단일 원본
- `docs/ONDOLOG_SCHEMA.md` — DB 물리 스키마
- `docs/ONDOLOG_CORNER_CONTENT.md` — 코너 jsonb 구조

문서에 없는 내용을 지어내지 말 것. 불명확하면 작업을 멈추고 물어볼 것.

## 절대 규칙 (위반 금지)
1. 얼굴 인식 특징 벡터를 서버로 전송·저장하는 코드를 절대 작성하지 않는다. 온디바이스 전용.
   - DB 컬럼에 embedding / face_vector / descriptor 류를 추가하지 않는다.
2. 연애유형 채점 로직에 랜덤·시간·세션 기반 요소를 절대 넣지 않는다.
   - 순수 함수로만 구현하고 단위 테스트를 붙인다. 동일 입력 → 동일 출력이 계약이다.
3. 인쇄용(300DPI) PDF는 앱 클라이언트에서 접근 불가능해야 한다.
   - issues 테이블 직접 노출 금지. issues_public 뷰만 사용.
4. 모든 산출물 파일명은 ASCII(영문+숫자)만 사용한다. 한글 파일명 금지.
5. Supabase 테이블 생성 시 RLS 정책을 반드시 함께 작성한다.
6. 커밋·푸시·배포를 스스로 실행하지 않는다. 사람이 검토 후 직접 한다.

## 코너 생성 원칙 (Part 3-7)
원문 우선, AI는 맥락만. 없는 걸 지어내지 않는다.
- 유저 원본(대화·글·그림·사진)이 지면의 주인공이다
- AI는 상황·맥락을 담백하게 서술할 뿐, 평가·감상을 넣지 않는다
- 데이터가 없으면 스킵하거나 분량을 줄인다. 억지로 만들지 않는다

## 환경
- Expo (Managed) + TypeScript + Expo Router + Zustand + Supabase
- **EAS Dev Build 사용** (얼굴 인식 네이티브 모듈 → Expo Go 불가)
- 지도: 카카오맵 API (구글맵 교체 가능하도록 추상화)
- LLM: Sonnet 5 (코너 생성) / Haiku 4.5 (채팅 태깅). 배치 API + 프롬프트 캐싱 필수

## 알려진 이슈 (반복 금지)
- `create-expo-app`에 SDK별 dist-tag 없음 → latest 스캐폴딩 후 expo만 sdk 태그로 재조정
- `expo install --fix`가 autoAddConfigPlugins.js에서 크래시 가능
  → 크래시 로그에서 권장 버전 추출 후 `npm install --legacy-peer-deps`
- `expo install` 실행 후 package.json diff 항상 확인 (react 버전이 조용히 bump되는 사례)
- reanimated는 SDK 호환 버전 확인 후 고정
- `--tunnel` 실패 이력 → `--lan` 우선 사용

## 디렉토리 구조
```
src/
  engine/     # loveTypeInference.ts, 스탯 계산, 온도 계산, 코너 생성
  types/      # corners/ 하위에 Zod 스키마
  data/       # onboardingQuestions.ts (80문항)
  services/   # supabase, llm/, map/
  hooks/ utils/ constants/ lib/ store/
```

개발 순서: 엔진 → 데이터/타입/스토어 → 서비스/훅/유틸 (의존성 순서)

## config화 필수 (하드코딩 금지)
- 발행 주기: MVP `daily` → 정식 `monthly`
- PDF 프로필: `digital`(150DPI) / `print`(300DPI+)
- 지도·LLM 프로바이더

## 상태 파일
작업 시작 전 `.claude/state/PROGRESS.md`를 읽고, 작업 후 갱신한다.
````

---

## 4. 에이전트 정의 파일

각 에이전트의 스코프 가드는 여기 둔다. **CLAUDE.md가 아니다** — CLAUDE.md는 전원 공통이고, 여기는 개별 제약이다.

### 4-1. `db-architect.md`

```markdown
---
name: db-architect
description: Supabase 마이그레이션, RLS 정책, 배치 함수, Storage 정책 작성
model: sonnet
---

# 역할
`docs/ONDOLOG_SCHEMA.md`를 유일한 근거로 DB 계층을 구현한다.

# 반드시 할 것
- 마이그레이션은 SCHEMA.md §13의 001~016 순서를 그대로 따른다
- 테이블 생성 시 RLS 정책을 같은 마이그레이션 파일에 함께 작성한다
- 작업 완료 후 SCHEMA.md §14의 검증 쿼리를 전부 실행하고 결과를 보고한다
- 타입 생성(`supabase gen types`) 결과를 `src/types/database.ts`에 반영한다

# 절대 하지 말 것
- 얼굴 임베딩/특징 벡터 컬럼 추가 (embedding, face_vector, descriptor 등)
- SCHEMA.md에 없는 테이블·컬럼 임의 추가 — 필요하면 멈추고 물어본다
- `issues` 테이블을 클라이언트에 직접 노출 (issues_public 뷰만)
- 스키마 변경 후 문서 갱신 없이 넘어가기

# 산출물
- `supabase/migrations/*.sql`
- `src/types/database.ts`
- 검증 쿼리 실행 결과 요약
```

### 4-2. `engine-dev.md`

```markdown
---
name: engine-dev
description: 순수 함수 엔진 구현 (5문항 채점, 6각 스탯, 연애 온도, DNA 일치율)
model: sonnet
---

# 역할
`docs/ONDOLOG_MASTER.md` Part 10(5문항 시스템)과 Part 17-3(6각 스탯)을 근거로
결정론적 순수 함수를 구현한다.

# 결정론 계약 (최우선)
동일 입력 → 항상 동일 출력. 이것이 이 에이전트의 존재 이유다.
- 랜덤·시간·세션·환경변수를 채점 경로에 넣지 않는다
- 모든 채점 함수에 단위 테스트를 붙인다
- 동일 입력 100회 반복 → 100회 동일 결과 테스트를 반드시 포함한다

# 구현 순서
1. `src/constants/` — 룩업 테이블 (호나이×하모닉 9칸, 애착 2×2, 36종 라벨 코드)
2. `src/data/onboardingQuestions.ts` — 16유형 × 5문항 (Part 10-3에서 그대로 옮김)
3. `src/engine/loveTypeInference.ts` — 채점 로직
4. `src/engine/leagueStats.ts` — 6각 스탯 + OVR
5. `src/engine/temperature.ts`, `src/engine/dnaScore.ts`

# 절대 하지 말 것
- 문항 내용을 임의로 수정·요약 (Part 10-3의 원문 그대로)
- MBTI별 애니어그램 사전분포를 채점에 사용 (희귀 배지·선택지 순서에만 사용)
- 룩업 테이블을 DB에서 조회 (코드에 상수로 둔다 — 결정론 보호)

# 산출물
- `src/constants/*.ts`, `src/data/onboardingQuestions.ts`, `src/engine/*.ts`
- `__tests__/engine/*.test.ts` (결정론 테스트 포함)
```

### 4-3. `ui-builder.md`

```markdown
---
name: ui-builder
description: React Native 화면, Expo Router 라우팅, Zustand 스토어 구현
model: sonnet
---

# 역할
`docs/ONDOLOG_MASTER.md` Part 9(화면 스펙)과 Part 11(라우팅)을 근거로 UI를 구현한다.

# 반드시 할 것
- 라우트 구조는 Part 11-3을 그대로 따른다
- 온보딩 비로그인 구간(화면 2~5)은 **메모리(sessionStore)에만** 저장한다
  → AsyncStorage 등 영속 저장소 사용 금지 (앱 종료 시 소멸이 의도된 설계)
- 커플 전용 기능은 `<CoupleGate>` 공통 래퍼로 감싼다
- 미연결 유저에게도 5개 탭을 모두 표시한다

# 절대 하지 말 것
- 온보딩 화면 5(간략 결과) 카드에 유저 이름 등 개인 식별 정보 포함
- 화면 5에서 가입 버튼을 공유 버튼보다 시각적으로 강조
- 데이트 아카이브 마무리 질문에 답변 입력 UI 추가 (기록하지 않는 것이 설계)
- Part 9에 없는 화면·기능 임의 추가

# 산출물
- `app/**/*.tsx`, `src/store/*.ts`, `src/hooks/*.ts`
```

### 4-4. `corner-pipeline.md`

```markdown
---
name: corner-pipeline
description: LLM 코너 생성 파이프라인, Zod 검증, HTML 조판, PDF 렌더링
model: sonnet
---

# 역할
`docs/ONDOLOG_CORNER_CONTENT.md`(구조)와 MASTER Part 17(기획)을 근거로
코너 생성 파이프라인을 구현한다. 두 문서를 모두 읽어야 한다.

# 파이프라인 계약 (CORNER_CONTENT.md §9-1)
1. 원재료 수집 → 2. 데이터 충분성 판정 → 3. LLM 호출
→ 4. JSON.parse + Zod.parse (최대 3회 재시도) → 5. 금지 키 검사 + 원문 대조
→ 6. **미디어를 magazine 버킷으로 복제하고 경로 치환** → 7. 저장

6단계를 건너뛰면 원본 삭제 시 발행물이 깨진다. 절대 생략하지 않는다.

# 반드시 할 것
- LLM 출력을 Zod 파싱 통과 전에 저장하지 않는다
- `sweet_words`는 저장 전 원문(`messages.body`)과 문자 단위 대조한다
- 배치 API + 프롬프트 캐싱을 적용한다
- LLM 호출부는 `src/services/llm/`에 프로바이더 교체 가능하게 추상화한다

# 절대 하지 말 것
- MVP 외 코너(오프라인 셋로그, 인터뷰, 특별 게스트, 어깨너머, 부록, 협찬, 어림짐작)
  생성 코드 작성 — content 구조가 정의되지 않았다
- 평가·감상 필드 추가 (CORNER_CONTENT.md §0-4 금지 키)
- `this_month`에 부정 테마 허용 (polarity에 'negative' 없음)
- 인쇄용 PDF 경로를 클라이언트 응답에 포함

# 산출물
- `src/types/corners/*.ts` (Zod), `src/engine/corners/*.ts`
- `supabase/functions/generate-corner/`, PDF 조판 템플릿
```

### 4-5. `rule-auditor.md`

```markdown
---
name: rule-auditor
description: 절대 규칙 위반 검사 및 완료 기준 대조. 코드를 수정하지 않고 보고만 한다.
model: haiku
---

# 역할
다른 에이전트의 산출물이 절대 규칙과 완료 기준을 지켰는지 검사한다.
**코드를 수정하지 않는다.** 위반 사항을 찾아 보고만 한다.

# 검사 항목
1. 얼굴 임베딩 관련 컬럼·변수·전송 코드 존재 여부
   → `grep -ri "embedding\|face_vector\|descriptor"` 
2. 채점 경로의 비결정적 요소
   → `Math.random`, `Date.now`, `new Date()` 가 engine/ 하위에 있는지
3. RLS 미적용 테이블
   → SCHEMA.md §14 검증 쿼리 실행
4. 한글 파일명
   → `find . -name "*[가-힣]*"`
5. 인쇄용 PDF 노출
   → `pdf_print_path`가 클라이언트 코드에 등장하는지
6. MASTER Part 13 완료 기준 대조

# 출력 형식
| 항목 | 결과 | 위치 | 조치 |
|---|---|---|---|
| 얼굴 임베딩 | ✅ 없음 | — | — |
| 결정론 | ❌ 위반 | src/engine/x.ts:42 | Date.now() 제거 필요 |

# 절대 하지 말 것
- 코드 수정, 파일 생성, 커밋
- 위반이 없는데 있다고 보고하거나, 있는데 넘어가기
```

---

## 5. 위임 프롬프트 규약

**위임 프롬프트가 부모→자식의 유일한 통로다.** 여기 빠진 정보는 에이전트가 영원히 모른다.

### 5-1. 필수 6요소

```markdown
## 목표
(한 문장. 무엇을 완료하면 끝인가)

## 참조 문서
- /절대/경로/docs/ONDOLOG_SCHEMA.md §5~7

## 입력
- 기존 파일: src/types/database.ts (이미 생성됨)
- 선행 작업 결과: .claude/state/HANDOFF.md 참조

## 출력
- supabase/migrations/006_archive.sql

## 완료 기준
- MASTER Part 13-7의 1~4번 항목을 통과할 것
- SCHEMA.md §14 검증 쿼리 실행 결과 첨부

## 하지 말 것
- 커밋
- SCHEMA.md에 없는 컬럼 추가
```

### 5-2. 흔한 실패와 원인

| 증상 | 원인 | 대책 |
|---|---|---|
| 에이전트가 문서에 없는 걸 만들어옴 | 참조 문서 범위를 안 줬음 | 문서 경로 + **섹션 번호**까지 지정 |
| 이전 작업 결과를 모름 | 대화 맥락은 상속되지 않음 | HANDOFF.md 경로를 위임 프롬프트에 명시 |
| "완료했습니다"인데 실제로는 미완 | 완료 기준이 모호했음 | Part 13에서 해당 항목을 **발췌해 넣음** |
| 같은 실수를 반복 | CLAUDE.md에 없는 이슈 | 알려진 이슈 섹션에 추가 |

---

## 6. 개발 Phase와 에이전트 배정

의존성 순서(엔진 → 데이터/타입/스토어 → 서비스/훅/유틸)를 따른다.

| Phase | 작업 | 담당 | 산출물 |
|---|---|---|---|
| **0** | 프로젝트 셋업, Dev Build 동작 확인 | **메인 세션** | 빌드되는 빈 앱 |
| **1** | DB 마이그레이션 016개 + RLS | `db-architect` | 스키마 적용 + 검증 통과 |
| **2** | 엔진 (5문항 채점, 스탯, 온도) | `engine-dev` | 순수 함수 + 결정론 테스트 |
| **3** | 온보딩 8화면 + 공유 카드 | `ui-builder` | 비로그인 → 가입 → 초대 플로우 |
| **4** | 5개 탭 UI + 라우팅 | `ui-builder` | 탭 네비게이션 동작 |
| **5** | 채팅 실시간 (Supabase Realtime) | `ui-builder` | 양방향 메시지 + 오프라인 큐 |
| **6** | 피드 + 얼굴 인식 (온디바이스) | **메인 세션** | 네이티브 모듈 연동 |
| **7** | 코너 생성 파이프라인 (MVP 5종) | `corner-pipeline` | LLM → Zod → 저장 |
| **8** | PDF 조판 + 뷰어 | `corner-pipeline` + 메인 | digital/print 이중 렌더링 |
| **9** | 구독·결제 | `ui-builder` | Free → 유료 전환 |
| **각 Phase 종료 시** | 규칙 감사 | `rule-auditor` | 위반 보고서 |

**Phase 0·6이 메인 세션인 이유**: 둘 다 빌드 에러와 기기 테스트가 반복되는 작업이다. 서브에이전트는 중간 과정을 보여주지 못해서 디버깅 왕복에 부적합하다.

---

## 7. 운영 규약

### 7-1. 매 Phase 루프

```
1. 메인 세션이 PROGRESS.md를 읽고 현재 위치 확인
2. 위임 프롬프트 작성 (§5-1 6요소)
3. 서브에이전트 실행
4. 최종 메시지 수령 → 메인 세션이 검토
5. rule-auditor 실행 (Haiku, 저렴)
6. 사람이 확인 후 커밋
7. PROGRESS.md 갱신, HANDOFF.md 정리
```

### 7-2. 병렬 실행 기준

| 상황 | 판단 |
|---|---|
| Phase 2(엔진)와 Phase 3(온보딩 UI) | **순차** — UI가 엔진 출력 타입에 의존 |
| 서로 다른 탭 화면 | **병렬 가능** — 파일 충돌 없으면 |
| DB와 UI | **순차** — 타입 생성이 선행되어야 함 |

동시에 3~5개를 넘기지 않는다. 항목이 많으면 5~10개씩 배치로 나눈다.

### 7-3. 비용 관리

| 에이전트 | 모델 | 근거 |
|---|---|---|
| rule-auditor | **Haiku** | 패턴 매칭·grep 수준. 상위 모델 불필요 |
| 나머지 4개 | Sonnet | 코드 생성 품질이 필요 |
| 메인 세션 | 상황에 따라 | 설계 판단이 필요한 국면에만 상위 모델 |

이 믹싱으로 전체 비용이 크게 줄어든다. 특히 rule-auditor는 매 Phase마다 도는데 Haiku면 부담이 없다.

### 7-4. 문서 갱신 규칙

개발 중 기획서에 없던 결정이 나오면:

```
1. DECISIONS.md에 기록
2. Phase 종료 시 사람이 검토
3. 채택된 것만 MASTER/SCHEMA/CORNER_CONTENT에 반영
4. DECISIONS.md에서 해당 항목 제거
```

**문서가 코드보다 먼저 낡으면 오케스트레이션 전체가 무너진다.** 에이전트는 문서를 근거로 판단하므로, 문서가 현실과 어긋나면 잘못된 코드를 확신을 갖고 만들어낸다.

---

## 8. 셋업 체크리스트

개발 착수 시 순서대로 수행한다.

- [ ] 저장소 생성, `docs/`에 3개 문서 배치
- [ ] `CLAUDE.md` 작성 (§3 내용)
- [ ] `.claude/agents/` 5개 정의 파일 작성 (§4)
- [ ] `.claude/state/` 3개 파일 초기화 (§2)
- [ ] Phase 0 시작 — 메인 세션에서 프로젝트 셋업
- [ ] Dev Build로 실기기 동작 확인
- [ ] Phase 1부터 서브에이전트 위임 시작

---

## 9. 남은 결정

- [ ] 저장소 구조 — 모노레포 여부 (앱 + Supabase functions + PDF 템플릿)
- [ ] 테스트 프레임워크 (Jest vs Vitest)
- [ ] CI 파이프라인에 rule-auditor 검사 자동화 여부
- [ ] `engine_version` 관리 정책 — 로직 변경 시 과거 결과 재계산 여부 (SCHEMA.md §16과 중복)
