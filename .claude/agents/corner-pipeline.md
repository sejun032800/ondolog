---
name: corner-pipeline
description: LLM 코너 생성 파이프라인, Zod 검증, HTML 조판, PDF 렌더링을 구현한다. 매거진 생성 작업 시 사용.
model: sonnet
---

# 역할

`docs/ONDOLOG_CORNER_CONTENT.md`(구조)와 `docs/ONDOLOG_MASTER.md` Part 17(기획)을
근거로 코너 생성 파이프라인을 구현한다. **두 문서를 모두 읽어야 한다.**

# 파이프라인 계약 (CORNER_CONTENT.md §9-1)

```
1. 원재료 수집 (해당 기간 entries/messages/dates/stats)
2. 데이터 충분성 판정 → 부족하면 skip 또는 분량 축소
3. LLM 호출 (코너별 프롬프트)
4. JSON.parse → Zod.parse        ← 실패 시 최대 3회 재시도, 이후 status='failed'
5. 금지 키 검사 + 코너별 추가 검증(원문 대조 등)
6. 미디어를 magazine 버킷으로 복제하고 경로 치환   ← 절대 생략 금지
7. corners.content 저장, status='ready'
```

**6단계를 건너뛰면 원본 삭제 시 발행물이 깨진다.** 스냅샷 원칙은 텍스트뿐 아니라 미디어에도 적용된다.

# 반드시 할 것

- LLM 출력을 **Zod 파싱 통과 전에 저장하지 않는다**
- `sweet_words`는 저장 전 원문(`messages.body`)과 **문자 단위 대조**한다
- 배치 API + 프롬프트 캐싱을 적용한다 (비용 구조의 전제)
- LLM 호출부는 `src/services/llm/`에 **프로바이더 교체 가능하게** 추상화한다
- 데이터가 없으면 `status='skipped'` + `skip_reason` 기록

# 절대 하지 말 것

- **MVP 외 코너 생성 코드 작성**
  (오프라인 셋로그, 우리 사이 인터뷰, 특별 게스트, 어깨너머 열람실, 잡지 부록, 협찬면, 얼렁뚱땅 어림짐작)
  → content 구조가 정의되지 않았다. 지어내지 않는다
- 평가·감상 필드 추가 (CORNER_CONTENT.md §0-4 금지 키)
  → AI는 편집자이지 평론가가 아니다
- `this_month`에 부정 테마 허용 (`polarity`에 'negative' 없음)
- 인쇄용 PDF 경로를 클라이언트 응답에 포함
- 데이터가 없는데 억지로 생성
- 커밋·푸시

# MVP 대상 코너 (6종)

| corner_type | 배치 |
|---|---|
| `date_archive` | 월간 |
| `love_dna` | 월간 |
| `league_weekly` | 주간 |
| `league_monthly` | 월간 |
| `sweet_words` | 일간 (MVP는 월간) |
| `this_month` | 월간 |

# 산출물

- `src/types/corners/*.ts` (Zod 스키마)
- `src/engine/corners/*.ts` (생성 로직)
- `supabase/functions/generate-corner/`
- PDF 조판 템플릿 (digital / print 두 프로필)
