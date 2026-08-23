# ONDOLOG 개발 로드맵

> 이 문서는 **지금 어디까지 왔고 다음에 무엇을 하는가**를 정의한다.
> 세부 명세는 `docs/` 하위 4개 문서에 있다. 이 문서는 순서와 담당을 정한다.
> 실시간 진행 상황은 `.claude/state/PROGRESS.md`를 본다.

---

## 0. 문서 관계

| 문서 | 역할 |
|---|---|
| `docs/ONDOLOG_MASTER.md` | 기획·설계 단일 원본 (Part 0~17) |
| `docs/ONDOLOG_SCHEMA.md` | DB 물리 스키마 (DDL·RLS·배치·Storage) |
| `docs/ONDOLOG_CORNER_CONTENT.md` | 코너 jsonb 구조 (TS 타입·Zod·금지 키) |
| `docs/ONDOLOG_ORCHESTRATION.md` | 서브에이전트 운영 규약 |
| **`docs/ONDOLOG_ROADMAP.md`** (이 문서) | **Phase 순서와 담당** |
| `CLAUDE.md` | 절대 규칙 + 환경 (전 에이전트 자동 상속) |
| `.claude/state/PROGRESS.md` | 현재 진행 상황 |

**작업 시작 전 반드시**: `.claude/state/PROGRESS.md` → 이 문서의 해당 Phase → 해당 Phase의 참조 문서 순으로 읽는다.

---

## 1. 전체 Phase 개요

| Phase | 작업 | 담당 | 상태 |
|---|---|---|---|
| 0 | 프로젝트 셋업 | 메인 세션 | ✅ 완료 |
| **1** | **DB 마이그레이션 + RLS** | `db-architect` | ⬅ 다음 |
| 2 | 엔진 (채점·스탯·온도·DNA) | `engine-dev` | 대기 |
| 3 | 온보딩 8화면 + 공유 카드 | `ui-builder` | 대기 |
| 4 | 5개 탭 UI + 라우팅 | `ui-builder` | 대기 |
| 5 | 채팅 실시간 | `ui-builder` | 대기 |
| 6 | 피드 + 얼굴 인식 | **메인 세션** | 대기 |
| 7 | 코너 생성 파이프라인 | `corner-pipeline` | 대기 |
| 8 | PDF 조판 + 뷰어 | `corner-pipeline` + 메인 | 대기 |
| 9 | 구독·결제 | `ui-builder` | 대기 |

**각 Phase 종료 시** `rule-auditor`(Haiku)로 절대 규칙 감사를 실행한다.

**의존성 원칙**: 엔진 → 데이터/타입/스토어 → 서비스/훅/유틸

---

## 2. Phase 상세

### Phase 0 — 프로젝트 셋업 ✅

**완료 내역**
- Expo SDK 57 + TypeScript strict + Expo Router
- EAS Dev Build (Android) 실기기 동작 확인
- Supabase 프로젝트 생성(서울 리전) + link + 연결 확인
- `docs/` 기획 문서, `CLAUDE.md`, `.claude/` 골격

**미완**: iOS Dev Build (Apple Developer 계정 필요 — Phase 3 전까지)

---

### Phase 1 — DB 마이그레이션 + RLS

| 항목 | 내용 |
|---|---|
| **담당** | `db-architect` |
| **참조** | `docs/ONDOLOG_SCHEMA.md` 전체 (특히 §13 마이그레이션 순서) |
| **산출물** | `supabase/migrations/001~016_*.sql`, `src/types/database.ts` |

**범위**
- 19개 테이블 (profiles, couples, dates, data_entries, messages, stories, corners, issues 등)
- 36개 RLS 정책 + `is_couple_member` 등 SECURITY DEFINER 헬퍼
- 배치 함수 (스토리 만료, 보관 정책, 7일 유예 파기)
- `issues_public` 뷰 (인쇄용 PDF 차단)
- Storage 버킷 정책 6종

**완료 기준**
- SCHEMA.md §14 검증 쿼리 5개 전부 실행 및 결과 첨부
- RLS 미적용 테이블 탐지 → 0행
- 얼굴 임베딩 컬럼 탐지 → 0행
- `issues_public`에 `pdf_print_path` 없음
- `npx supabase gen types` 로 타입 생성 완료

**주의**
- CLI는 프로젝트 의존성이므로 `npx supabase` 로 실행
- 마이그레이션 중간 실패 시 롤백 처리 필요 → 사람에게 보고

---

### Phase 2 — 엔진

| 항목 | 내용 |
|---|---|
| **담당** | `engine-dev` |
| **참조** | MASTER Part 10 (5문항 시스템), Part 17-3 (6각 스탯) |
| **산출물** | `src/constants/`, `src/data/onboardingQuestions.ts`, `src/engine/*.ts`, `__tests__/engine/*.test.ts` |

**범위**
1. `src/constants/` — 룩업 테이블 (호나이×하모닉 9칸, 애착 2×2, 36종 라벨 코드)
2. `src/data/onboardingQuestions.ts` — 16유형 × 5문항 = 80문항 (Part 10-3 원문 그대로)
3. `src/engine/loveTypeInference.ts` — 채점 (애니어그램 코어, 빅5, 스턴버그, 애착, 3자 코드)
4. `src/engine/leagueStats.ts` — 6각 스탯(PUS/EMP/ATT/DEF/TAC/REA) + OVR 120점
5. `src/engine/temperature.ts` — 연애 온도
6. `src/engine/dnaScore.ts` — DNA 일치율 (절대평가, 하한 50)

**완료 기준 (최우선)**
- **동일 입력 100회 반복 → 100회 동일 결과** 테스트 통과
- 채점 경로에 `Math.random` / `Date.now()` / `new Date()` 없음
- 애니어그램 코어가 호나이×하모닉 룩업 9칸과 정확히 일치
- MBTI "몰라요" 4문항 경로가 반드시 4글자 코드로 수렴

**이 Phase가 중요한 이유**
UI 없이 단독 검증이 가능한 유일한 구간이다. 여기서 로직을 확정해두지 않으면 Phase 3에서 화면과 로직을 동시에 디버깅해야 한다.

---

### Phase 3 — 온보딩 8화면

| 항목 | 내용 |
|---|---|
| **담당** | `ui-builder` |
| **참조** | MASTER Part 9-1 (온보딩), Part 11 (라우팅) |
| **산출물** | `app/(onboarding)/*.tsx`, `src/store/sessionStore.ts` |

**화면 순서**
```
1 로고 → 2 기본정보 → 3 MBTI → 4 연애유형 5문항 → 5 간략결과(공유)
  ↑ 여기까지 비로그인, 메모리 저장, 앱 종료 시 소멸
6 회원가입 → 7 상세결과 → 8 연인초대 → (+) 사귄날짜 입력
  ↑ 여기부터 서버 저장, onboarding_step 세이브포인트
```

**핵심 제약**
- 비로그인 구간(2~5)은 **AsyncStorage 사용 금지**. 메모리(sessionStore)만
- 화면 5 공유 카드에 **유저 이름 등 개인 식별 정보 미포함**
- 화면 5에서 가입 버튼이 공유 버튼보다 강조되지 않을 것
- 소셜 로그인 3종: 카카오 / 구글 / 애플

**선행 필요**
- iOS Dev Build (Apple 로그인 테스트)
- Supabase Auth 프로바이더 설정 + redirect URI 등록
- 36종 상세 설명문 (`description_ko`) — 미작성 상태

---

### Phase 4 — 5개 탭 UI + 라우팅

| 항목 | 내용 |
|---|---|
| **담당** | `ui-builder` |
| **참조** | MASTER Part 9-2~9-6, Part 11 |
| **산출물** | `app/(tabs)/*.tsx`, `app/(modals)/couple-gate.tsx` |

**탭 구성**: 메인 / 채팅 / 피드 / 매거진 / 설정

**핵심 제약**
- 미연결 유저에게도 **5개 탭 전부 표시** (잠긴 문을 보여주는 것이 설계)
- 커플 전용 기능은 `<CoupleGate>` 공통 래퍼 → 탭 시 초대 모달
- 미연결 시 연애 온도 **36.5도 고정**
- 초대 모달은 화면 8과 **동일 컴포넌트 재사용**

---

### Phase 5 — 채팅 실시간

| 항목 | 내용 |
|---|---|
| **담당** | `ui-builder` |
| **참조** | MASTER Part 9-3 |
| **산출물** | `app/(tabs)/chat.tsx`, `src/hooks/useRealtimeMessages.ts` |

**범위**
- Supabase Realtime 양방향 메시지 (지연 3초 이내)
- 오프라인 큐잉 → 복구 시 재전송 (`client_msg_id` 멱등 키)
- 읽음 표시
- 스토리 (24시간 만료, 사진앱 연동 여부에 따라 저장/소멸 분기)

**중요성**
채팅이 연애 온도·다정한 말들·매치 리포트의 **원재료 파이프**다. 여기가 완성돼야 데이터가 쌓이기 시작한다.

---

### Phase 6 — 피드 + 얼굴 인식 ⚠ 최대 난관

| 항목 | 내용 |
|---|---|
| **담당** | **메인 세션** (서브에이전트 위임 금지) |
| **참조** | MASTER Part 9-4 |
| **산출물** | `app/(tabs)/feed.tsx`, 네이티브 모듈 연동 |

**범위**
- 사진 라이브러리 권한 + 백그라운드 스캔 (증분 처리)
- **온디바이스 얼굴 인식** — 대표사진(개인 1 / 커플 1) 기준 선별
- EXIF 시공간 클러스터링 → `dates` / `date_stops` 생성
- AI 데이트 서사 생성
- 피드형 / 지도형 뷰 (카카오맵 API)
- 유저 보정 (위치 수정, 사진 위 감정 기록·드로잉)

**절대 규칙**
- 얼굴 특징 벡터를 **서버로 전송·저장하지 않는다.** 기기 보안저장소 전용
- 생체정보는 일반 약관과 **분리된 별도 동의** 필요 (개인정보보호법)

**왜 메인 세션인가**
네이티브 모듈 빌드 에러와 실기기 테스트가 반복된다. 서브에이전트는 중간 과정을 보여주지 못해 디버깅 왕복에 부적합하다.

**선행 필요**: 생체정보 동의 UI/문구 (법적 필수, 미작성)

---

### Phase 7 — 코너 생성 파이프라인

| 항목 | 내용 |
|---|---|
| **담당** | `corner-pipeline` |
| **참조** | `docs/ONDOLOG_CORNER_CONTENT.md` + MASTER Part 17 (**둘 다**) |
| **산출물** | `src/types/corners/*.ts`, `src/engine/corners/*.ts`, `supabase/functions/generate-corner/` |

**MVP 대상 6종**
`date_archive` / `love_dna` / `league_weekly` / `league_monthly` / `sweet_words` / `this_month`

**파이프라인 7단계**
```
원재료 수집 → 충분성 판정 → LLM 호출 → JSON+Zod 파싱(3회 재시도)
→ 금지 키 검사 + 원문 대조 → 미디어를 magazine 버킷 복제 → 저장
```

**절대 놓치면 안 되는 것**
- 6단계(미디어 복제) 생략 시 원본 삭제하면 발행물이 깨진다
- `sweet_words`는 저장 전 원문과 **문자 단위 대조**
- MVP 외 7개 코너는 **content 구조가 없으므로 생성 코드 작성 금지**

**선행 필요**
- AI 매거진 메이커 캐릭터 설계
- LLM 한국어 품질 실측 비교 (Sonnet 5 기준, 대안과 대조)

---

### Phase 8 — PDF 조판 + 뷰어

| 항목 | 내용 |
|---|---|
| **담당** | `corner-pipeline` + 메인 세션 (뷰어는 네이티브) |
| **참조** | MASTER Part 9-5 |
| **산출물** | HTML 조판 템플릿, PDF 렌더링 함수, `app/(modals)/magazine-viewer.tsx` |

**범위**
- HTML/CSS 조판 → Playwright(Chromium) 렌더링
- **이중 프로필**: `digital`(약 150DPI, 앱 열람) / `print`(300DPI+, 앱 접근 불가)
- 서재형 발행물 목록 + 최신순/오래된순 정렬
- 매호 표지 자동 생성
- RN PDF 뷰어 (`react-native-pdf` vs WebView — 미결정)

**렌더링 규칙**
`print_background=True`, margin `0` + CSS padding, `wait_until='networkidle'`, 파일명 ASCII only

---

### Phase 9 — 구독·결제

| 항목 | 내용 |
|---|---|
| **담당** | `ui-builder` |
| **참조** | MASTER Part 4-2 (티어), Part 9-6 (설정 탭) |
| **산출물** | 페이월 화면, 결제 연동, 구독 관리 |

**범위**
- Free + 단일 유료 티어 (월 9,900원 커플 단위)
- 첫 호 무료 체험 → 유료 전환 페이월
- 유료 전환 시 `access_locked` 자동 해제 (3개월 초과 기록 열람)
- iOS/Android 인앱결제 연동

**선행 필요**: 약관, 개인정보 처리방침, LLM 데이터 정책 명시

---

## 3. Phase 간 병렬 처리 기준

| 조합 | 판단 |
|---|---|
| Phase 1(DB) ↔ Phase 2(엔진) | **순차** — 엔진이 타입에 의존하진 않지만, DB 타입이 먼저 있어야 통합이 쉬움 |
| Phase 2(엔진) ↔ Phase 3(온보딩 UI) | **순차** — UI가 엔진 출력 타입에 의존 |
| Phase 4 내부 서로 다른 탭 화면 | **병렬 가능** — 파일 충돌 없으면 |
| Phase 7(코너) ↔ Phase 8(PDF) | **부분 병렬** — 코너 1개라도 나오면 조판 착수 가능 |

동시에 3~5개를 넘기지 않는다. 항목이 많으면 5~10개씩 배치로 나눈다.

---

## 4. 각 Phase 실행 루프

```
1. .claude/state/PROGRESS.md 읽고 현재 위치 확인
2. 이 문서에서 해당 Phase의 담당·참조·완료기준 확인
3. 위임 프롬프트 작성 (ORCHESTRATION.md §5-1 6요소)
4. 서브에이전트 실행
5. 최종 메시지 검토
6. rule-auditor 실행 (Haiku)
7. 사람이 확인 후 커밋
8. PROGRESS.md 갱신, HANDOFF.md 정리, DECISIONS.md 기록
```

---

## 5. Phase와 무관하게 남은 과제

기획은 확정됐으나 아직 작성되지 않은 것들. **해당 Phase 착수 전까지** 처리해야 한다.

| 시점 | 항목 | 종류 |
|---|---|---|
| Phase 3 전 | iOS Dev Build (Apple Developer 계정) | 인프라 |
| Phase 3 전 | Supabase Auth 프로바이더 3종 설정 + redirect URI | 인프라 |
| Phase 3 전 | 36종 연애유형 상세 설명문 (`description_ko`) | 콘텐츠 |
| Phase 3 전 | 80문항 워딩·톤 최종 다듬기 | 콘텐츠 |
| Phase 6 전 | **생체정보 별도 동의 UI/문구** | 법무 (필수) |
| Phase 6 전 | 얼굴 인식 라이브러리 선정 | 기술 |
| Phase 7 전 | AI 매거진 메이커 캐릭터 설계 | 콘텐츠 |
| Phase 7 전 | LLM 한국어 품질 실측 비교 | 기술 |
| Phase 7 전 | 채팅 데이터 AI 활용 동의 절차 | 법무 (필수) |
| Phase 8 전 | RN PDF 뷰어 라이브러리 선정 | 기술 |
| Phase 8 전 | 매호 표지 자동 생성 로직 | 기술 |
| Phase 9 전 | 약관 · 개인정보 처리방침 | 법무 (필수) |
| Phase 9 전 | 발행 매거진 = 공동 저작물 조항 명시 | 법무 |
| 상시 | Year 1~3 재무모델 재계산 | 사업 |

전체 목록은 MASTER Part 16 참조.

---

## 6. MVP 완료 시점

Phase 9까지 끝나면 MASTER Part 7-5의 Must Have 8개가 모두 구현된 상태가 된다.

1. 온보딩 (기본정보 + MBTI + 5문항)
2. 연인 초대 (1:1 매칭)
3. 채팅 실시간 + 스토리
4. 피드 (사진 자동 연동, 얼굴 인식, 피드형/지도형)
5. AI 코너 생성 (MVP 5개 코너)
6. 매거진 뷰어 (PDF, 서재형 목록)
7. 구독·결제 (Free → 유료)
8. 공유 카드 자동생성

**MVP 발행 정책**: 월간 포맷을 **매일 발행**해 파이프라인 작동을 검증한다. 정식 운영 시 config 변경만으로 `monthly` 전환.
