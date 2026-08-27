/**
 * 얼굴 임베딩 벡터 매칭 — 순수 함수, 라이브러리 의존 없음.
 *
 * 근거: docs/ONDOLOG_MASTER.md "MASTER 보강 — 얼굴 인식 아키텍처 (Phase 6)"
 * "3단계 파이프라인":
 *   1단계 — 얼굴 탐지 (네이티브 SDK)
 *   2단계 — 임베딩 추출 (네이티브 SDK)
 *   3단계 — 매칭: "벡터 간 유사도(코사인 거리)를 계산해 대표사진과
 *           비교, 임계값 이내면 '우리 커플'로 판정"
 * "설계상 중요한 지점: 1·2단계만 네이티브 SDK 의존이고, 3단계(매칭)는
 * 순수 계산이다. 벡터 두 개를 받아 유사도를 반환하는 함수는 engine-dev가
 * 짜는 채점 로직과 성격이 같다 — 입력이 같으면 출력이 같은 결정론적
 * 순수 함수로 만들 수 있다. 이렇게 나누면 ... 나중에 라이브러리를
 * 교체해도 매칭 함수는 그대로 유지된다."
 *
 * 결정론 계약(Part 17-3과 동일 원칙 — `src/engine/leagueStats.ts` 등
 * 기존 엔진 모듈과 같은 계약): 이 파일 전체가 순수 함수다. Math.random /
 * Date.now() / new Date() / process.env를 쓰지 않고, 인자로 받은 값만
 * 사용한다. `__tests__/engine/determinismStaticRules.test.ts`가
 * `src/engine/` 하위 파일을 자동으로 스캔하므로 이 파일도 정적으로
 * 강제된다.
 *
 * 이 파일은 `react-native-expo-facial-recognition`이든 어떤 얼굴 인식
 * 라이브러리든 import하지 않는다 — 숫자 배열(벡터) 두 개를 받아 숫자를
 * 돌려주는 계산만 한다. 그래서 라이브러리를 나중에 교체해도(MASTER.md
 * "1차 채택 후 교체 전략") 이 파일은 손대지 않아도 된다.
 *
 * 임계값(threshold)은 이 파일 어디에도 하드코딩하지 않는다 — 문서가
 * "ONNX Runtime 구동 성능 기준을 §Part 16-2 열린 과제로 남김 — 실측
 * 후 확정"이라고 명시할 만큼 실측 전 수치이므로, 값을 지어내지 않는다는
 * CLAUDE.md 원칙에 따라 항상 호출부가 매개변수로 공급해야 한다.
 */

/**
 * 코사인 유사도 — 표준 공식 `(A·B) / (‖A‖ ‖B‖)`.
 *
 * 분모를 `Math.sqrt(normA) * Math.sqrt(normB)`가 아니라
 * `Math.sqrt(normA * normB)` 하나로 계산한다 — 수학적으로는 동일하지만
 * (`sqrt(xy) = sqrt(x)·sqrt(y)`, x,y ≥ 0), 제곱근 연산을 한 번만 거치므로
 * 두 벡터가 동일하거나 정반대일 때(`normA * normB`가 완전제곱수가 되는
 * 경우) 부동소수점 반올림 오차 없이 정확히 `1.0`/`-1.0`이 나온다 —
 * 완료 기준("동일 벡터 1.0, 반대 벡터 -1.0")을 근사값 비교 없이 만족
 * 시키기 위한 구현 선택.
 *
 * 벡터 차원이 다르면 값을 지어내지 않고 명시적으로 에러를 던진다.
 * 빈 벡터나 영벡터(모든 성분이 0)도 코사인 유사도가 수학적으로
 * 정의되지 않으므로(분모가 0) 같은 이유로 던진다.
 */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `cosineSimilarity: vector dimensions must match (a.length=${a.length}, b.length=${b.length}).`,
    )
  }
  if (a.length === 0) {
    throw new Error('cosineSimilarity: vectors must not be empty.')
  }

  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) {
    throw new Error('cosineSimilarity: cosine similarity is undefined for a zero vector.')
  }

  return dot / Math.sqrt(normA * normB)
}

/**
 * 유사도가 임계값 "이내"(MASTER.md 원문)면 매칭으로 판정한다 — 경계값
 * 포함(`>=`). `threshold`는 이 함수도 하드코딩하지 않고 항상 인자로
 * 받는다.
 */
export function isMatch(similarity: number, threshold: number): boolean {
  return similarity >= threshold
}

/**
 * `matchAgainstReferences`가 비교하는 기준 임베딩 하나.
 *
 * `id`는 이 함수가 의미를 해석하지 않고 결과에 그대로 되돌려주는
 * 불투명한 값이다 — 호출부가 "개인 대표사진"/"커플 대표사진"을
 * 구분하고 싶으면 `'personal'`/`'couple'` 같은 문자열을, DB 행을
 * 구분하고 싶으면 실제 id를 넣으면 된다(MASTER.md가 정한 구조가
 * 아니라 이 함수의 사용을 편하게 하려는 설계 — 여러 기준과 비교해
 * "가장 가까운 매칭"을 반환하라는 요구사항을 만족시키는 최소 구조다).
 */
export interface ReferenceEmbedding {
  id: string
  embedding: readonly number[]
}

export interface MatchResult {
  /** 기준 중 하나라도 threshold를 넘었으면 true. */
  isMatch: boolean
  /** 가장 유사도가 높았던 기준의 id. `references`가 비어 있으면 null. */
  bestMatchId: string | null
  /** `bestMatchId`와 비교했을 때의 유사도. `references`가 비어 있으면 null. */
  bestSimilarity: number | null
}

/**
 * 임베딩 하나를 여러 기준(개인 대표사진, 커플 대표사진 등)과 비교해
 * 가장 유사도가 높은 기준을 찾는다.
 *
 * `references`가 비어 있으면(예: 아직 대표사진을 하나도 등록하지 않은
 * 상태) 에러를 던지지 않고 "매칭 없음"을 반환한다 — 이건 값을 지어내는
 * 것이 아니라 실제로 있을 수 있는 정상 상태이기 때문이다. 반면
 * `embedding`과 개별 `references[i].embedding`의 차원이 다르면
 * `cosineSimilarity`가 그대로 에러를 던지게 둔다(값을 지어내지 않는다
 * — 차원 불일치는 호출부 버그이지 이 함수가 조용히 넘어갈 상황이
 * 아니다).
 *
 * 동점(유사도가 완전히 같은 기준이 둘 이상)이면 `references` 배열에서
 * 먼저 나온 쪽이 채택된다(`>` 엄격 비교) — 입력 순서가 같으면 항상
 * 같은 결과가 나오므로 결정론 계약을 해치지 않는다.
 */
export function matchAgainstReferences(
  embedding: readonly number[],
  references: readonly ReferenceEmbedding[],
  threshold: number,
): MatchResult {
  if (references.length === 0) {
    return { isMatch: false, bestMatchId: null, bestSimilarity: null }
  }

  let bestMatchId: string | null = null
  let bestSimilarity = -Infinity

  for (const reference of references) {
    const similarity = cosineSimilarity(embedding, reference.embedding)
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity
      bestMatchId = reference.id
    }
  }

  return {
    isMatch: isMatch(bestSimilarity, threshold),
    bestMatchId,
    bestSimilarity,
  }
}
