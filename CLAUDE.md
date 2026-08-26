# ONDOLOG

커플의 기록을 AI가 잡지로 발행하는 아카이브 + 매거진 앱.

## 참조 문서
- `docs/ONDOLOG_MASTER.md` — 기획·설계 단일 원본
- `docs/ONDOLOG_SCHEMA.md` — DB 물리 스키마
- `docs/ONDOLOG_CORNER_CONTENT.md` — 코너 jsonb 구조
- `docs/ONDOLOG_ORCHESTRATION.md` — 개발 운영 규약

문서에 없는 내용을 지어내지 말 것. 불명확하면 작업을 멈추고 물어볼 것.

## 절대 규칙 (위반 금지)
1. 얼굴 인식 특징 벡터를 서버로 전송·저장하는 코드를 절대 작성하지 않는다. 온디바이스 전용.
   DB 컬럼에 embedding / face_vector / descriptor 류를 추가하지 않는다.
2. 연애유형 채점 로직에 랜덤·시간·세션 기반 요소를 절대 넣지 않는다.
   순수 함수로만 구현하고 단위 테스트를 붙인다. 동일 입력 → 동일 출력이 계약이다.
3. 인쇄용(300DPI) PDF는 앱 클라이언트에서 접근 불가능해야 한다.
   issues 테이블 직접 노출 금지. issues_public 뷰만 사용.
4. 모든 산출물 파일명은 ASCII(영문+숫자)만 사용한다. 한글 파일명 금지.
5. Supabase 테이블 생성 시 RLS 정책을 반드시 함께 작성한다.
6. 커밋·푸시·배포를 스스로 실행하지 않는다. 사람이 검토 후 직접 한다.
7. service_role key를 앱 코드에 넣지 않는다. Edge Function 환경변수 전용.
8. 지시받지 않은 파일을 변경하지 않는다. 특히 package.json의 scripts,
   app.json, eas.json, tsconfig.json은 명시적 지시 없이 손대지 않는다.
   불가피하게 변경했다면 최종 보고서에 반드시 명시한다.

## 코너 생성 원칙
원문 우선, AI는 맥락만. 없는 걸 지어내지 않는다.
- 유저 원본(대화·글·그림·사진)이 지면의 주인공이다
- AI는 상황·맥락을 담백하게 서술할 뿐, 평가·감상을 넣지 않는다
- 데이터가 없으면 스킵하거나 분량을 줄인다. 억지로 만들지 않는다

## 환경
- Expo SDK 57 (Managed) + TypeScript + Expo Router + Zustand + Supabase
- **EAS Dev Build 사용** (얼굴 인식 네이티브 모듈 → Expo Go 불가)
- 지도: 카카오맵 API (구글맵 교체 가능하도록 추상화)
- LLM: Sonnet 5 (코너 생성) / Haiku 4.5 (채팅 태깅). 배치 API + 프롬프트 캐싱 필수

## 알려진 이슈 (반복 금지)
- `create-expo-app`에 SDK별 dist-tag 없음 → latest 스캐폴딩 후 expo만 sdk-57 태그로 재조정
- SDK 56은 Hermes V1 메모리 회귀로 reanimated 사용 시 문제. SDK 57 이상 사용.
- `expo install --fix`가 autoAddConfigPlugins.js에서 크래시 가능
  → 크래시 로그에서 권장 버전 추출 후 `npm install --legacy-peer-deps`
- `expo install` 실행 후 package.json diff 항상 확인 (react 버전이 조용히 bump되는 사례)
- `--tunnel` 실패 이력 → `--lan` 우선 사용

## 디렉토리 구조
```
src/
  engine/     # loveTypeInference.ts, 스탯 계산, 온도 계산, corners/
  types/      # corners/ 하위에 Zod 스키마
  data/       # onboardingQuestions.ts (80문항)
  services/   # supabase, llm/, map/
  hooks/ utils/ constants/ lib/ store/
app/          # Expo Router
supabase/     # migrations/, functions/
docs/         # 기획 문서 4종
```

개발 순서: 엔진 → 데이터/타입/스토어 → 서비스/훅/유틸 (의존성 순서)

## config화 필수 (하드코딩 금지)
- 발행 주기: MVP `daily` → 정식 `monthly`
- PDF 프로필: `digital`(150DPI) / `print`(300DPI+)
- 지도·LLM 프로바이더

## 상태 파일
작업 시작 전 `.claude/state/PROGRESS.md`를 읽고, 작업 후 갱신한다.

- `docs/ONDOLOG_ROADMAP.md` — Phase 계획과 현재 위치