# 인수인계

> 서브에이전트는 컨텍스트가 격리되어 서로 대화할 수 없다.
> 이 파일이 유일한 인수인계 수단이다.
> **완료된 항목은 즉시 삭제할 것** — 누적되면 컨텍스트가 오염된다.
> (예외: 아래 "DEF 애착 항 갱신" 작업 프롬프트는 선행 작업의 진단
> 수치를 보존하라고 명시해, 이번 세션은 완료 항목을 삭제하지 않았다.)

## DEF 애착 항 갱신(회피축 제거) + 규준집단 `synthetic-v3` — 완료 (2026-09-03, engine-dev)

Phase 7 선행 #7(`.claude/state/prompts/phase-7/08-engine-dev-def-neutral-avoidance.md`).
MASTER Part 17-3이 재갱신돼 DEF 애착 항이 **`75 − 불안축/2`**(폐기된
`100 − 불안축`이 불안축을 −1.0으로 증폭시킨 부작용을 정정)가 됐다.
회피축만 DEF에서 빠지고 불안축 계수는 −0.5로 보존된다. 규준집단을
재열거해 `norm-synthetic-v3.json`을 추가했다. **직전(폐기된) 시도의
코드는 저장소에 없었고 처음부터 새로 구현했다.**

### DEF 공식 — 변경 전/후 (`src/engine/leagueStats.ts`, `computeSixStats`)

| | DEF 세 번째 항 | 항 내부 불안 계수 | 항 내부 회피 계수 | DEF 순계수(불안/회피) |
|---|---|---|---|---|
| **변경 전** (v2.0.0) | `computeAttachmentStability(anx, avoid) * 0.3` = `(100 − (anx+avoid)/2) * 0.3` | −0.5 | −0.5 | −0.15 / −0.15 |
| **변경 후** (v3.0.0, Part 17-3 그대로) | `computeDefAnxietyStability(anx) * 0.3` = `(75 − anx/2) * 0.3` | **−0.5 (유지)** | **0 (제거)** | **−0.15 / 0** |

첫 항(정서안정성 `(100−N)·0.4`)과 둘째 항(긍정형 보너스 `·0.3`)은 손대지 않았다.
가중치(0.4/0.3/0.3)도 그대로. 문서 값을 조정·반올림하지 않았다.

### 애착 항의 불안축 계수가 유지됨을 보인 근거 (세 가지)

1. **해석적**: `∂/∂anx (75 − anx/2) = −0.5`, `∂/∂anx (100 − (anx+avoid)/2) = −0.5` → 동일.
   `100 − 불안축`이었다면 −1.0이 됐을 지점(폐기된 조치의 오류)을 `75 − 불안축/2`가 피한다.
2. **항 평균**: anx,avoid ∈ {20,50,85} 균등에서 변경 전 항 평균 `100 − (51.667+51.667)/2 = 48.333`,
   변경 후 `75 − 51.667/2 = 49.167`. Part 17-3 예측(`48.33 → 49.17`)과 정확히 일치 — 항 값 범위 보존.
3. **합성값 실측(규준 재열거 + 진단 스크립트)**: 불안축 3수준 합성값 **총차(high−low)가
   v2 `1.074074` → v3 `1.074074`로 완전히 동일**. (Part 17-3이 "핵심 판정 기준"으로 지목한 수치.)
   합성값 순계수도 ATT +0.35 / EMP −0.10 / DEF −0.15 = **+0.10 유지**(회피는 −0.25 → −0.10).

### EMP 무변경 — 확인 방법과 결과

- `computeAttachmentStability` **본문 무수정**(`return 100 - (attachAnxiety + attachAvoidance) / 2`
  그대로). docblock에 "EMP 전용" 주석만 추가. `computeSixStats`의 `emp` 산출 줄
  (`bigA*0.35 + attachmentStability*0.2 + intimacy*0.2 + compliantBonus*0.25`)도 무수정.
- **실측**: `norm-synthetic-v3.json`의 `stats.emp` (그리고 pus·att·tac·rea) `mean`/`stdDev`가
  `norm-synthetic-v2.json`과 **바이트 동일**(EMP 48.925926 / 15.211089 등). 바뀐 것은 DEF와
  composite뿐. 에니어그램 코어 9종은 전부 균일하게 +0.074074만 이동(코어는 (Q1,Q2)만으로
  정해져 Q3/Q5와 독립 → DEF 변경이 코어별로 갈리지 않음), **코어 간 폭 1.75463 그대로**.
- `__tests__/engine/leagueStats.test.ts`의 `computeAttachmentStability` 단위 테스트
  (`(20,20)→80` 등) 무수정·통과.

### DEF 전용 함수 — 이름·시그니처·분리 방식

- **`export function computeDefAnxietyStability(attachAnxiety: number): number`** — `return 75 - attachAnxiety / 2`
- `src/engine/leagueStats.ts`에 공용 `computeAttachmentStability` **바로 아래** 별도 함수로 추가.
- **회피축 인자를 아예 받지 않는다**(arity 1). 공용 헬퍼(arity 2)와 시그니처를 다르게 둬
  회피축이 DEF에 다시 섞여 들어오는 것을 컴파일 단계에서 구조적으로 차단.
- `computeSixStats` 안에서 `attachmentStability`(EMP용)와 `defAnxietyStability`(DEF용) 두
  지역 변수를 각각 만들어, `emp`는 전자를 `def`는 후자를 소비하도록 분리.
- 단위 테스트 신규 5개(`computeDefAnxietyStability` describe): 공식(손계산 65/50/32.5),
  `100 − (anx+50)/2` 동치, 기울기 −0.5, arity 1, 결정론 100회.

### `LEAGUE_STATS_ENGINE_VERSION`: `2.0.0` → `3.0.0`

동일 입력에 대해 이전 버전과 다른 DEF 수치를 내는 **호환 불가 변경**이므로 메이저.
(EMP 변경이 1.0.0→2.0.0이었던 것과 같은 근거. 부가 함수 추가였던
`TEMPERATURE_ENGINE_VERSION` 1.0.0→1.1.0의 minor 패턴과 다름.)
`norm-synthetic-v3.json`의 `engineVersions.leagueStats`가 이 값을 자동으로 담는다
(`enumerateNormData()`가 상수를 읽어 넣음 — 문자열 직접 타이핑 없음).

### 깨진 기존 테스트 — DEF/드리프트로 한정, 각각 열거

| 파일 | 테스트/지점 | 기존 | 신규 | 근거 |
|---|---|---|---|---|
| `__tests__/engine/normDrift.test.ts` | `커밋된 파일: version이 synthetic-v2이다` → assertion `expect(committed.version).toBe('synthetic-v2')` | `'synthetic-v2'` | `'synthetic-v3'` | 규준 버전 문자열 규격(Part 10-8-3 `{출처}-v{정수}`, "새 버전 파일 추가")에서 도출 — 코드 출력 복사 아님 |
| `__tests__/engine/normDrift.test.ts` | `열거를 다시 돌린 직렬화 결과가 커밋된 파일과 바이트 단위로 동일하다` | v2 파일과 바이트 일치 | v3 파일과 바이트 일치(대조 대상 파일 경로는 `NORM_VERSION` import로 자동 추종, 열거 재호출 방식 유지) | 채점이 바뀌면 반드시 깨지도록 설계된 드리프트 감지 테스트 — 설계대로 |
| `__tests__/engine/normDrift.test.ts` | docblock의 v2 언급 | — | v2→v3 경위 문단 추가 | 주석 정확성(비-assertion) |

- **DEF 절대값을 검증하던 단위 테스트는 애초에 없었다** — `leagueStats.test.ts`는
  `computeSixStats`를 범위(0~100)·상대비교(PUS)·결정론(100회)만 확인하고 DEF 수치를
  assert하지 않아, 공식이 바뀌어도 그대로 통과했다.
- **EMP 테스트·그 외 테스트는 깨지지 않았다.** `npx jest` 25 suites / **324 tests** 전부 통과
  (기존 318 + 신규 6: normDrift 애착축 요약 점검 1 + `computeDefAnxietyStability` 5). 회귀 0.
- 신규로 **추가**한 것: normDrift에 애착축 요약 섹션 구조 점검 1개(v3부터 존재, 회피·불안 각
  3수준·표본 합 3888), leagueStats에 `computeDefAnxietyStability` 5개. 기존 테스트 본문 수정은
  위 표의 normDrift 3지점뿐.

### 규준집단 `synthetic-v3` — 재열거

- 출력: `src/engine/data/norm-synthetic-v3.json`, `version` = `synthetic-v3`,
  `engineVersions` = `{loveTypeInference: "1.0.0", leagueStats: "3.0.0"}`, `sampleSize` 3888.
- **파일 크기: 354,838 bytes.** (v2 352,914 / v1 352,336 — 증가분은 신규 `attachmentAxisSummary` 섹션.)
- **배열 7개 각각 정확히 3,888**: `composite.sorted` + `stats.{pus,emp,att,def,tac,rea}.sorted`.
- **재실행 시 바이트 동일** 확인(SHA-256 `47e620dc…`, 2회 재생성 일치).
- **`v1`·`v2` 무수정**: `git status`에 `norm-synthetic-v1.json`/`v2.json` `M` 없음, v3만 신규(`??`).
- **열거 로직·채점 재구현 없음**: `scripts/norm/enumerate.ts`는 `NORM_VERSION` 문자열
  `'synthetic-v2'`→`'synthetic-v3'`, 축 수준 필드(`Q3_ANXIETY_AXIS`/`Q5_AVOIDANCE_AXIS` 룩업
  그대로)와 `summarizeAttachmentAxes()` 추가뿐. `computeSixStats`가 갱신돼 같은 코드가 다른
  결과를 낸 것.
- **드리프트 테스트**: v3 대조로 갱신, `serializeNormData(enumerateNormData())` vs 커밋 파일
  **바이트 비교 형태 유지**(파일끼리 비교·샘플링으로 바꾸지 않음).

### v3 애착축 요약 섹션 (규준 파일에 신규 포함 — 코어 9종 요약과 같은 위치·형식)

`norm-synthetic-v3.json` → `attachmentAxisSummary: { avoidance: [low,mid,high], anxiety: [low,mid,high] }`,
각 원소 `{ level, mean, stdDev, min, max, count }`. 값은 아래 "점검 ①②"와 동일(교차검증됨 —
독립 진단 스크립트와 바이트 일치).

### v2 → v3 분포 비교 (관측 보고, 판단 없음)

**회피축 3수준 합성값 평균** (v2 → v3):

| 회피 수준 | v2 | v3 | 이동 |
|---|---|---|---|
| low  | 49.435185 | 48.712963 | −0.722222 |
| mid  | 48.212963 | 48.212963 | ±0 |
| high | 46.675926 | 47.620370 | +0.944444 |
| **총차(high−low)** | **−2.759259** | **−1.092593** | 회피축 감점 폭 축소 (계수 −0.25 → −0.10) |

단계별 차이 v3: mid−low −0.500000, high−mid −0.592593. Part 17-3 예측(총차 −1.08 안팎,
단계 −0.50/−0.58)과 부합.

**불안축 3수준 합성값 평균** (v2 → v3):

| 불안 수준 | v2 | v3 | 이동 |
|---|---|---|---|
| low  | 47.546296 | 47.657407 | +0.111111 |
| mid  | 48.157407 | 48.157407 | ±0 |
| high | 48.620370 | 48.731481 | +0.111111 |
| **총차(high−low)** | **1.074074** | **1.074074** | **완전 동일 — 불안축 보존 확인(핵심 판정 기준)** |

**에니어그램 코어 9종 평균** (v2 → v3): 9종 전부 균일하게 **+0.074074** 이동.
코어 간 평균 폭 v2 1.75463 → v3 **1.75463 (불변)**. 오름차순 순위도 불변
(3<1<8<6<5<4<7<2<9). DEF 변경이 코어(=(Q1,Q2))와 독립임을 확인.

**6종 스탯 mean/stdDev** (v2 → v3): PUS·EMP·ATT·TAC·REA 바이트 동일.
DEF `44.222222 / 19.423799` → `44.666667 / 18.979521` (평균 +0.44, sd 감소 — 항 산포가
회피축이 빠져 줄어듦, Part 17-3 예측 "sd < 19.4" 부합). ATT sd 21.489015가 분산 1위 유지.
합성값 `48.108025 / 2.827228` → `48.182099 / 2.629861`.

### 점검 ①~⑤ (진단 스크립트 무수정 재실행 + v3 파일 판독, 판단 없음 — 수치만)

**진단 스크립트 무수정** 확인: `git status`에 `scripts/norm/attachment-diagnostic.ts` 변경 없음.
`v2` 때와 동일한 스크립트·동일한 1회용 컴파일 방식. 3회 재실행 바이트 동일.

**① 회피축 3수준별 합성값 분포** (min/max는 소수 10자리 반올림, mean/sd는 6자리, 모표준편차)

| 회피 수준 | 평균 | 표준편차 | 최소 | 최대 | n |
|---|---|---|---|---|---|
| low  | 48.712963 | 2.590674 | 42.3333333333 | 55.6666666667 | 1296 |
| mid  | 48.212963 | 2.590674 | 41.8333333333 | 55.1666666667 | 1296 |
| high | 47.620370 | 2.593651 | 41.1666666667 | 54.6666666667 | 1296 |

단계별 차이: mid−low **−0.500000**, high−mid **−0.592593**. 총차(high−low) **−1.092593**.

**② 불안축 3수준별 합성값 분포**

| 불안 수준 | 평균 | 표준편차 | 최소 | 최대 | n |
|---|---|---|---|---|---|
| low  | 47.657407 | 2.594642 | 41.1666666667 | 54.6666666667 | 1296 |
| mid  | 48.157407 | 2.594642 | 41.6666666667 | 55.1666666667 | 1296 |
| high | 48.731481 | 2.589681 | 42.3333333333 | 55.6666666667 | 1296 |

단계별 차이: mid−low **+0.500000**, high−mid **+0.574074**. 총차(high−low) **+1.074074**
(v2와 동일).

**③ 회피 × 불안 교차표 (3×3, 평균 / n)**

| 회피 \ 불안 | low | mid | high |
|---|---|---|---|
| **low**  | 48.194444 (n=432) | 48.694444 (n=432) | 49.250000 (n=432) |
| **mid**  | 47.694444 (n=432) | 48.194444 (n=432) | 48.750000 (n=432) |
| **high** | 47.083333 (n=432) | 47.583333 (n=432) | 48.194444 (n=432) |

(참고: 진단 스크립트가 함께 낸 애착 4유형별 합성값 — secure 48.194444 / anxious 49.000000 /
avoidant 47.333333 / fearful 48.194444, n 1728/864/864/432.)

**④ 에니어그램 코어 9종별 합성값 분포** (v3, 각 n=432)

| 코어 | 평균 | 표준편차 | 최소 | 최대 |
|---|---|---|---|---|
| 1 | 47.597222 | 2.558535 | 41.3333333333 | 54.0000000000 |
| 2 | 48.888889 | 2.575556 | 42.6666666667 | 55.3333333333 |
| 3 | 47.513889 | 2.555669 | 41.1666666667 | 54.0000000000 |
| 4 | 48.143519 | 2.544507 | 41.8333333333 | 54.5000000000 |
| 5 | 47.976852 | 2.544507 | 41.6666666667 | 54.3333333333 |
| 6 | 47.763889 | 2.558535 | 41.5000000000 | 54.1666666667 |
| 7 | 48.805556 | 2.572708 | 42.5000000000 | 55.3333333333 |
| 8 | 47.680556 | 2.555669 | 41.3333333333 | 54.1666666667 |
| 9 | 49.268519 | 2.561621 | 43.0000000000 | 55.6666666667 |

코어 간 평균 폭 **1.754630** (최저 3: 47.513889 ~ 최고 9: 49.268519).
오름차순 순위: **3 < 1 < 8 < 6 < 5 < 4 < 7 < 2 < 9**.

**⑤ 스탯 6종 및 합성값 mean / stdDev** (v3, 3,888 전수, 모표준편차)

| 항목 | 평균 | 표준편차 |
|---|---|---|
| PUS | 49.750000 | 17.020209 |
| EMP | 48.925926 | 15.211089 |
| ATT | 47.000000 | 21.489015 |
| DEF | 44.666667 | 18.979521 |
| TAC | 45.416667 | 16.359460 |
| REA | 53.333333 | 13.707257 |
| 합성값 | 48.182099 | 2.629861 |

PUS·EMP·ATT·TAC·REA는 v2와 바이트 동일. DEF·합성값만 변동.

> **판단하지 않음.** 위 수치의 해석·추가 조정 필요 여부는 마스터 PM 결정이다.
> 17-3 값이 확정 사항이며 수치를 목표에 맞춘 가중치 조정은 하지 않았다.

### `v1`·`v2`를 보존하는 이유 — 삭제 금지

**과거 발행물 재현.** `stat_snapshots.inputs.normVersion`에 규준 버전이 기록되므로,
`synthetic-v1`/`v2`로 산출된 발행물은 그 버전 파일이 있어야 재현된다(Part 10-8-3
"이전 버전으로 산출된 발행물은 그 버전으로 재현 가능해야 한다"). `norm-{version}.json`은
인자로 주입되는 동결 산출물이라 엔진 코드가 특정 버전을 정적 import하지도 않는다.

### 파일 (git status)

| 상태 | 경로 | 내용 |
|---|---|---|
| M | `src/engine/leagueStats.ts` | `computeDefAnxietyStability` 신설, `computeSixStats`의 `def` 항 교체, `LEAGUE_STATS_ENGINE_VERSION` 3.0.0, docblock |
| M | `src/engine/normPercentile.ts` | `NormAttachmentAxisLevelSummary`/`NormAttachmentAxisSummary` 타입 + `NormData.attachmentAxisSummary?` 옵셔널 필드(v1·v2 재현 호환) |
| M | `scripts/norm/enumerate.ts` | `NORM_VERSION` v3, 축 수준 필드 + `summarizeAttachmentAxes()` |
| M | `__tests__/engine/normDrift.test.ts` | v2→v3 대조, 애착축 요약 점검 1개 추가 |
| M | `__tests__/engine/leagueStats.test.ts` | `computeDefAnxietyStability` describe 5개 추가(기존 테스트 무수정) |
| ?? | `src/engine/data/norm-synthetic-v3.json` | 재열거 규준 (354,838 bytes) |

미변경: `src/engine/data/norm-synthetic-v1.json`·`v2.json`, `scripts/norm/attachment-diagnostic.ts`,
`scripts/norm/distribution.ts`·`serialize.ts`, `scripts/generate-norm.ts`,
`src/engine/temperature.ts`, `src/engine/constants/unresolved.ts`, 모든 설정 파일.

### 검증 상태

- `npx jest` : 25 suites / **324 tests** 전부 pass (기존 318 + 신규 6, 회귀 0)
- `npx tsc --noEmit -p .` : **0 에러**
- `norm-synthetic-v3.json` 2회 재생성 SHA-256 동일 (바이트 결정론)
- 진단 스크립트 3회 재실행 바이트 동일
- `grep -rn "UNRESOLVED(" src/engine/ --include=*.ts | grep -vE "^[^:]*:[0-9]+:[[:space:]]*\*"` → **2건**
  (`unresolved.ts:135` 정의 + `temperature.ts:234` 소비), 이번 작업으로 늘지도 줄지도 않음.
  UNRESOLVED 키 등록·해소 없음. `leagueStats.shrinkage`는 그대로 미소비(원점수 기준 열거).

## 애착축 진단 집계 — 완료 (2026-09-03, engine-dev)

Phase 7 선행 #6(`.claude/state/prompts/phase-7/06-engine-dev-attachment-diagnostic.md`).
`synthetic-v2` 전수 열거 3,888개를 대상으로 회피축·불안축 수준별 및
애착 4유형별 **합성값**(6각 스탯 산술평균 = `computeOvrRawScore`) 분포를
관측했다. **규준집단 파일·엔진 코드·6각 스탯 공식은 건드리지 않았다** —
`git status`에 `scripts/norm/attachment-diagnostic.ts` 신규 1건뿐,
`src/engine/` 및 `src/engine/data/` 변경 0.

### 진단 스크립트 — 재실행 가능 (회피축 조치 후 전후 비교에 다시 쓴다)

- 경로: `scripts/norm/attachment-diagnostic.ts` (파일 I/O 없음, stdout JSON 출력)
- 실행 (Windows / PowerShell, `scripts/generate-norm.ts`와 동일한 1회용 컴파일 방식 — ts-node/tsx 없음):

  ```
  npx tsc scripts/norm/attachment-diagnostic.ts --ignoreConfig --ignoreDeprecations "6.0" `
    --outDir .norm-build --module commonjs --moduleResolution node `
    --target es2022 --esModuleInterop --skipLibCheck --resolveJsonModule --types node
  node .norm-build/scripts/norm/attachment-diagnostic.js
  Remove-Item -Recurse -Force .norm-build
  ```

- 결정론 확인: 3회 실행 바이트 동일(SHA-256 일치).
- **일회성 조사가 아니다.** 회피축 공식 조정 등 조치 후 같은 스크립트로
  전후 수치를 대조해야 진단이 확정된다.

### 재사용한 함수 (재구현 없음 — 전부 import만)

| 함수 / 상수 | 시그니처 또는 형태 | 경로 |
|---|---|---|
| `inferLoveType` | `(input: LoveTypeInput) => LoveTypeInferenceResult` | `src/engine/loveTypeInference.ts` |
| `computeSixStats` | `(input: SixStatsInput) => SixStats` | `src/engine/leagueStats.ts` |
| `computeOvrRawScore` | `(stats: SixStats) => number` (6각 산술평균 = 합성값) | `src/engine/leagueStats.ts` |
| `roundTo` | `(value: number, decimals: number) => number` (유일 반올림 지점) | `src/engine/numeric.ts` |
| `Q3_ANXIETY_AXIS` / `Q5_AVOIDANCE_AXIS` | `Record<QuizChoice, 'low'\|'mid'\|'high'>` (축 수준 룩업) | `src/constants/attachment.ts` |
| `ATTACHMENT_LABEL_KO` | `Record<AttachmentType, string>` (제품 언어 표기) | `src/constants/attachment.ts` |
| `MBTI_TYPES` | `readonly MbtiType[]` (열거 순서 고정) | `src/constants/quizTypes.ts` |
| `RAW_SCORE_DECIMALS`(10) / `SUMMARY_DECIMALS`(6) | 반올림 자리수 | `scripts/norm/distribution.ts` |

열거 루프 구조(MBTI_TYPES → Q1..Q5 각 A,B,C)와 합성값 산출 경로
(`inferLoveType` → `computeSixStats` → `computeOvrRawScore`)는
`scripts/norm/enumerate.ts`의 `enumerateProfiles()`와 완전히 동일하다.
축 수준·애착 4유형도 기존 룩업/함수 출력을 읽기만 했다(재판정 없음).
교차검증: 회피축 3수준 평균의 균등가중 평균 =
(49.435185+48.212963+46.675926)/3 = **48.108025**, 커밋된
`norm-synthetic-v2.json`의 `composite.mean`과 정확히 일치.

### 문서 대조 — 축 판정 기준

위임 프롬프트의 축 판정 기준을 MASTER Part 10-2-3과 대조: **일치**.
`anxiety = Q3==='C'?high:(Q3==='B'?mid:low)`,
`avoidance = Q5` 동형, 4유형 = (안정: 둘 다 not-high / 불안: 불안만 high /
회피: 회피만 high / 혼란: 둘 다 high). 어긋남 없음. 축 수치 수준은
Part 17-3 "애착 축 수치화" {A:20, B:50, C:85} — `ATTACHMENT_AXIS_SCORE`가
그대로 구현. 어긋남 없음.

### 집계 ① 회피축 3수준별 합성값 분포 (진단 본체)

| 회피 수준 | 평균 | 표준편차 | 최소 | 최대 | n |
|---|---|---|---|---|---|
| low  | 49.435185 | 2.591468 | 43.0000000000 | 56.3333333333 | 1296 |
| mid  | 48.212963 | 2.590674 | 41.8333333333 | 55.1666666667 | 1296 |
| high | 46.675926 | 2.594047 | 40.1666666667 | 53.6666666667 | 1296 |

### 집계 ② 불안축 3수준별 합성값 분포 (대조군)

| 불안 수준 | 평균 | 표준편차 | 최소 | 최대 | n |
|---|---|---|---|---|---|
| low  | 47.546296 | 2.796909 | 40.1666666667 | 55.3333333333 | 1296 |
| mid  | 48.157407 | 2.795070 | 40.8333333333 | 56.0000000000 | 1296 |
| high | 48.620370 | 2.786406 | 41.3333333333 | 56.3333333333 | 1296 |

### 집계 ③ 애착 4유형별 합성값 분포

| 유형 | 표기 | 평균 | 표준편차 | 최소 | 최대 | n |
|---|---|---|---|---|---|---|
| secure   | 안정형 | 48.569444 | 2.647318 | 41.8333333333 | 56.0000000000 | 1728 |
| anxious  | 불안형 | 49.333333 | 2.618341 | 42.8333333333 | 56.3333333333 | 864 |
| avoidant | 회피형 | 46.416667 | 2.574207 | 40.1666666667 | 53.1666666667 | 864 |
| fearful  | 혼란형 | 47.194444 | 2.555556 | 41.3333333333 | 53.6666666667 | 432 |

### 집계 ④ 회피 × 불안 교차표 (3 × 3 = 9칸, 평균과 n)

| 회피 \ 불안 | low | mid | high |
|---|---|---|---|
| **low**  | 48.861111 (n=432) | 49.527778 (n=432) | 49.916667 (n=432) |
| **mid**  | 47.694444 (n=432) | 48.194444 (n=432) | 48.750000 (n=432) |
| **high** | 46.083333 (n=432) | 46.750000 (n=432) | 47.194444 (n=432) |

### 각 집계의 n 균등 여부

- 회피축 3수준: **1296 / 1296 / 1296 — 균등**
- 불안축 3수준: **1296 / 1296 / 1296 — 균등**
- 교차표 9칸: **전부 432 — 균등**
- 애착 4유형: 1728 / 864 / 864 / 432 — 균등 아님(구조상 당연 — 절단점이
  `high` 하나뿐이라 secure가 4/9, fearful이 1/9. 프롬프트는 이 집계의
  균등을 요구하지 않음)
- 합계: ①②③④ 전부 **3,888** (allEqual3888 = true)

Q5(회피축)·Q3(불안축)이 다른 문항·MBTI와 독립이라는 전제가 전수 열거에서
확인됐다 — 축 수준별 n이 완전히 동일하므로 수준별로 다른 항의 분포가
치우쳐 있지 않다.

### 판단 안 함

프롬프트 지시대로 수치만 보고한다. 회피축 효과의 크기·조치 필요 여부·
공식 조정은 마스터 PM 결정 사항이라 다루지 않았다.

### 검증 상태

- `npx jest` : 25 suites / **318 tests** 전부 pass (회귀 0, 테스트 추가/수정 없음)
- `npx tsc --noEmit -p .` : **0 에러**
- 3회 재실행 바이트 동일 (SHA-256 일치)
- `git status --short` : `scripts/norm/attachment-diagnostic.ts` 신규 1건뿐,
  `src/engine/` · `src/engine/data/` 변경 없음

## EMP 공식 갱신 + 규준집단 재열거 (`synthetic-v2`) — 완료 (2026-09-02, engine-dev)

Phase 7 선행 #4(`.claude/state/prompts/phase-7/05-engine-dev-emp-requeue.md`).
`synthetic-v1` 전수 열거(위 섹션)가 밝힌 문제 — 호나이 삼분법 세 그룹 중
순응형(1·2·6)에만 대응 스탯이 없어 이 세 코어가 삼분법 보너스를 하나만
받고, 나머지 여섯 코어는 둘씩 받아 OVR이 사실상 "보너스를 몇 개 받았는가"가
되던 문제(코어 간 폭 5.75, MASTER Part 17-3 "왜 순응형 보너스를
신설했는가" 절 참조) — 를 해소했다. MASTER Part 17-3에 EMP 공식이
갱신됐고, 그 갱신을 코드에 반영한 뒤 규준집단을 재열거했다.

### EMP 공식 — 변경 전/후

| | 공식 | 가중치 합 |
|---|---|---|
| **변경 전** (`LEAGUE_STATS_ENGINE_VERSION` 1.0.0) | 우호성 A(0.4) + 애착 안정성(0.3) + 스턴버그 친밀(0.3) | 1.0 |
| **변경 후** (2.0.0, MASTER Part 17-3 그대로) | 우호성 A(0.35) + 애착 안정성(0.2) + 스턴버그 친밀(0.2) + **애니어그램 순응형 보너스(1·2·6, 0.25)** | 1.0 |

가중치는 문서 값을 그대로 옮겼다(조정·반올림 없음). 순응형 그룹 판정은
`src/engine/leagueStats.ts`의 기존 `groupBonus(q1 === 'A')`(주장형→PUS)/
`groupBonus(q1 === 'C')`(후퇴형→TAC) 패턴을 그대로 재사용해
`groupBonus(q1 === 'B')`(순응형→EMP) 한 줄만 추가했다 — 호나이 그룹 판정
로직 재구현 없음.

### `LEAGUE_STATS_ENGINE_VERSION`: `1.0.0` → `2.0.0`

기존 저장소의 유일한 선례(`TEMPERATURE_ENGINE_VERSION` 1.0.0→1.1.0)는
**부가 함수 추가**(기존 출력 불변)라 minor였다. 이번 변경은 **동일 입력에
대해 이전 버전과 다른 EMP 수치를 내는 호환 불가 변경**이므로 major를
올렸다(1.x.y가 아니라 2.0.0).

### `computeSixStats` 소비 모듈 조사

| 모듈 | 관계 | 영향 |
|---|---|---|
| `scripts/norm/enumerate.ts` | `computeSixStats`/`computeOvrRawScore`를 직접 import해 3,888개 전수 열거 | **영향 있음** — 이번 작업의 2부(규준 재열거)가 바로 이 모듈을 재호출한 결과다. 열거 로직 자체는 수정하지 않았다(문서 그대로) |
| `__tests__/engine/leagueStats.test.ts` | `computeSixStats` 직접 호출 | 범위 검사(0~100)·결정론(100회)·PUS 보너스 비교만 하고 **EMP 수치를 하드코딩한 테스트가 없어 깨지지 않았다** |
| `src/engine/normPercentile.ts` | `leagueStats.percentileRank`만 import (`computeSixStats` 아님) | 무관 — 백분위 조회 함수는 규준 데이터를 인자로만 받아 EMP 공식 변경과 독립 |
| `src/engine/dnaScore.ts` | docblock 주석에 `leagueStats.ts`를 대조 언급할 뿐 **import 없음** | 무관 — 6각 스탯을 실제로 소비하지 않는다 |
| `src/constants/attachment.ts` | 주석에서 leagueStats의 애착 안정성 정의를 언급할 뿐 import 없음 | 무관 |

### 깨진 기존 테스트 — 전수 조사 결과 1건뿐

| 파일 | 테스트명 | 기존 기댓값 | 새 기댓값 | 근거 |
|---|---|---|---|---|
| `__tests__/engine/normDrift.test.ts` | `열거를 다시 돌린 직렬화 결과가 커밋된 파일과 바이트 단위로 동일하다` | `norm-synthetic-v1.json`과 바이트 단위 일치 | `norm-synthetic-v2.json`과 바이트 단위 일치(대조 대상 파일 자체를 교체, 열거 재호출 방식은 유지) | 이 테스트는 채점 로직이 바뀌면 반드시 깨지도록 설계된 드리프트 감지 테스트 — 설계대로 깨졌다 |
| `__tests__/engine/normDrift.test.ts` | `커밋된 파일: version이 synthetic-v1이다` | `'synthetic-v1'` | `'synthetic-v2'` | 규준 버전 문자열 자체가 바뀌었으므로 리터럴 갱신(코드 출력 복사가 아니라 Part 10-8-3 버전 규격에서 직접 도출) |

**EMP 값을 직접 검증하던 테스트는 존재하지 않았다** — `leagueStats.test.ts`가
`fixedInput`으로 6개 스탯을 계산하는 곳은 범위(0~100)·상대 비교(PUS만)·
결정론(100회 반복 동일성)만 확인하고 EMP 절대값을 assert하지 않아서
공식이 바뀌어도 그대로 통과했다. **EMP·드리프트 외에 깨진 테스트는 없다**
— `npx jest` 318/318 전부 통과(회귀 0).

### 산출물 경로

| 경로 | 내용 |
|---|---|
| `src/engine/leagueStats.ts` | EMP 공식 갱신, `LEAGUE_STATS_ENGINE_VERSION` 2.0.0, `compliantBonus` 추가 |
| `src/engine/data/norm-synthetic-v2.json` | 재열거 규준 데이터. **352,914 bytes.** `norm-synthetic-v1.json`(352,336 bytes)은 **무수정 보존**(과거 발행물 재현용, Part 10-8-3) |
| `scripts/norm/enumerate.ts` | `NORM_VERSION` `'synthetic-v1'` → `'synthetic-v2'`만 변경. 열거 로직(`enumerateProfiles`/`enumerateNormData`) 자체는 수정 없음 — 같은 코드가 갱신된 `computeSixStats`를 통해 다른 결과를 낸 것 |
| `__tests__/engine/normDrift.test.ts` | v2를 대조하도록 갱신(파일 경로는 `NORM_VERSION` import로 자동 추종, 하드코딩된 버전 문자열 리터럴 1곳만 수정). 열거를 실제로 재호출하는 형태 유지 — 파일 비교·샘플링으로 바꾸지 않았다 |

### v1 vs v2 — 에니어그램 코어 9종별 합성값 분포 비교

각 코어 표본 수 432로 균등(변화 없음 — 코어 분류 자체는 안 바뀌었다).

| 코어 | v1 평균 | v2 평균 | 변화 |
|---|---|---|---|
| 1 (순응) | 45.800926 | 47.523148 | +1.72 |
| 2 (순응) | 47.092593 | 48.814815 | +1.72 |
| 3 | 49.717593 | 47.439815 | −2.28 |
| 4 | 50.427469 | 48.069444 | −2.36 |
| 5 | 50.260802 | 47.902778 | −2.36 |
| 6 (순응) | 45.967593 | 47.689815 | +1.72 |
| 7 | 51.009259 | 48.731481 | −2.28 |
| 8 | 49.884259 | 47.606481 | −2.28 |
| 9 | 51.552469 | 49.194444 | −2.36 |

- **코어 간 평균 폭**: v1 **5.75**(45.80~51.55) → v2 **1.75**(47.44~49.19)
- **평균 기준 오름차순 순위**:
  - v1: 1위 코어1(45.80) · 2위 코어6(45.97) · 3위 코어2(47.09) · 4위 코어3 · 5위 코어8 · 6위 코어5 · 7위 코어4 · 8위 코어7 · 9위 코어9(51.55) — **하위 3종이 순응형(1·6·2) 전원**
  - v2: 1위 코어3(47.44) · 2위 코어1(47.52) · 3위 코어8(47.61) · 4위 코어6(47.69) · 5위 코어5(47.90) · 6위 코어4(48.07) · 7위 코어7(48.73) · 8위 코어2(48.81) · 9위 코어9(49.19) — **순응형(1·6)이 최하위권에서 빠지고 혼합됐다.** 코어2는 여전히 중상위(8위)이나 코어1·6은 각각 2위·4위로 이동
- **판단하지 않음** — 이 비교는 관측 보고이며, 결과 해석·추가 조정 여부는
  마스터 PM 결정이다(문서 지시대로 가중치를 목표에 맞춰 조정하지 않았다).

### v1 vs v2 — 분산 지배 점검 (판단 없음, 수치만)

| 스탯 | v1 평균 / 표준편차 | v2 평균 / 표준편차 |
|---|---|---|
| PUS | 49.750000 / 17.020209 | 49.75 / 17.020209 (불변 — EMP만 바뀜) |
| EMP | 54.753086 / **9.107087**(v1 최소) | 48.925926 / **15.211089** |
| ATT | 47.000000 / 21.489015 | 47 / 21.489015 (불변) |
| DEF | 44.222222 / 19.423799 | 44.222222 / 19.423799 (불변) |
| TAC | 45.416667 / 16.359460 | 45.416667 / 16.35946 (불변) |
| REA | 53.333333 / 13.707257 | 53.333333 / 13.707257 (불변) |
| 합성값 | 49.079218 / 3.540467 | 48.108025 / 2.827228 |

EMP만 공식이 바뀌었으므로 나머지 5개 스탯 분포는 v1과 완전히 동일하다
(같은 3,888개 입력, 같은 함수). EMP 표준편차는 9.11 → 15.21로 커져
ATT(21.49)와의 격차가 2.36배 → 1.41배로 좁혀졌다. 합성값 표준편차는
3.54 → 2.83으로 줄었다(코어 간 폭이 좁아진 것과 같은 방향).

### 검증 상태

- `npx jest` : 25 suites / **318 tests** 전부 pass (변경 전과 동일 개수, 회귀 0)
- `npx tsc --noEmit -p .` : **0 에러**
- 재실행 바이트 동일 : `norm-synthetic-v2.json` 재생성 전후 `diff` 동일 확인
- `git status --short src/engine/data/` : `norm-synthetic-v1.json`에 `M` 없음(무수정), `norm-synthetic-v2.json`만 신규(`??`)
- `grep -rn "UNRESOLVED(" src/engine/ --include=*.ts | grep -v "^\s*\*"` 결과 6건, 변경 전후 동일(늘지도 줄지도 않음). ⚠️ 완료 기준 문구의 "2건"과 실측이 다르다 — 원인은 `grep -rn`이 붙이는 `파일:줄번호:` 접두사 때문에 `grep -v "^\s*\*"`가 독스트링 안의 `UNRESOLVED(` 언급(주석 4곳)을 걸러내지 못하는 **커맨드 자체의 사전 존재 결함**이다. 실제 호출부는 여전히 2곳(정의 1건 `unresolved.ts:135` + 소비 1건 `temperature.ts:234`)이고 이번 작업은 어느 쪽도 건드리지 않았다. 코드를 이 수치에 맞추는 시도는 하지 않았다(수치 목표 조정 금지 원칙) — 코디네이터 확인 필요

### v1을 보존하는 이유

**과거 발행물 재현.** `stat_snapshots.inputs.normVersion`에 규준 버전이
기록되므로, 이전에 `synthetic-v1`로 산출된 발행물은 그 버전 파일이 있어야
재현 가능하다(Part 10-8-3 "이전 버전으로 산출된 발행물은 그 버전으로
재현 가능해야 한다"). `norm-{version}.json`은 인자로 주입되는 동결
산출물이라 엔진 코드가 어떤 버전을 정적 import하지도 않는다 — 삭제 금지.

## 연애 온도 — 기저·활동 변동분·결합 (Part 10-7) — 완료 (2026-09-03, engine-dev)

Phase 7 선행 #3(`.claude/state/prompts/phase-7/03-engine-dev-temperature.md`).
`src/engine/temperature.ts`(기존 파일, 새로 쓰지 않고 이어서 구현)에
Part 10-7 "연애 온도 계산 규격 (확정)"의 세 부분을 추가했다.

### 변경 전 상태 (Phase 2 자리표시자)

- **완전 구현돼 있던 것**: `resolveDisconnectedTemperature()`(미연결
  36.5 고정), `clampTemperature()`(0~100, 소수 1자리 반올림+클램프),
  상수 4개(`DISCONNECTED_TEMPERATURE`/`TEMPERATURE_MIN`/`TEMPERATURE_MAX`/
  `TEMPERATURE_DECIMALS`).
- **자리표시자였던 것(=존재하지 않았던 것)**: 기저 온도, 활동 변동분,
  결합 공식 전부. 구 docblock이 "핵심 결합 공식이 문서 어디에도 없다"고
  명시하고 있었다(Part 10-7 신설 전 상태). `TEMPERATURE_ENGINE_VERSION`은
  `"1.0.0"`이었고 이 범위(미연결값·클램프)만 반영한 버전이었다.

### 이번에 추가한 것 — Part 10-7 세 부분

| 부분 | 함수 | 상태 |
|---|---|---|
| ① 기저 온도 | `computeBaselineTemperature(coreA, coreB, coefficients)` | 완전 구현, 순수 함수, **throw 없음**. 프로파일 미비 시 `undefined` 반환(에러 아님) |
| ① 보조 | `resolveTypeAffinity(coreA, coreB)` / `TypeAffinityCategory` | 완전 구현. 비대칭(잘맞음) 시 높은 쪽 채택 |
| ② 활동 변동분 식 | `computeActivityDeltaFromScores(dailyScores, coefficients)` | 완전 구현 + 완전 테스트 (UNRESOLVED 없음 — 이미 숫자인 점수를 가정) |
| ② 원시 입력 진입점 | `computeActivityDelta(dailyActivities, coefficients)` / `computeDailyActivityScore(raw)` | 식은 구현, "하루치 활동 점수" 정의는 `UNRESOLVED('temperature.activityScore')` 소비. 실활동(`DailyActivityRaw`)이 하나라도 있으면 throw. `null`(데이터 없음)만 있으면 0 반환, throw 없음 |
| ③ 결합 | `computeDailyTemperature(coreA, coreB, dailyActivities, coefficients)` | 구현됨. 실활동 데이터가 있는 현실적 호출은 `UnresolvedConstantError`로 실패 — **의도된 정상 상태** |

### 재사용한 궁합 판정 로직 (재작성 없음)

| 항목 | 경로 | 시그니처/형태 |
|---|---|---|
| `COMPATIBILITY` | `src/constants/compatibility.ts` | `Readonly<Record<EnneagramCore, { best: readonly {core,reason}[]; contrast: readonly {core,reason,tip}[] }>>` — Part 10-6-5 매트릭스, 기존 파일 그대로 import만 함 |
| `EnneagramCore` | `src/constants/enneagram.ts` | `1\|2\|...\|9` 타입만 import (값 룩업인 `HORNEVIAN_HARMONIC_TABLE`은 건드리지 않음) |

`resolveTypeAffinity`는 이 `COMPATIBILITY`를 양방향(coreA→coreB 관점,
coreB→coreA 관점)으로 조회해 `best`/`contrast`/`neutral` 중 하나를 정하고,
어긋나면(비대칭 잘맞음) 높은 쪽을 채택한다(Part 10-7-2 "양방향 판정이
어긋나면 높은 쪽을 커플 기저로 삼는다"). 매트릭스 값 자체는 한 글자도
다시 옮겨 적지 않았다.

### 최종 온도 함수가 throw하는 이유 / 해소 시 무엇을 바꿔야 하는가

`computeDailyTemperature`는 내부에서 `computeActivityDelta`를 호출하고,
그 함수는 `null`이 아닌 각 날짜에 `computeDailyActivityScore(raw)`를
호출한다. 이 함수 본문이 `UNRESOLVED({ key: 'temperature.activityScore' })`
하나뿐이라 즉시 `UnresolvedConstantError`를 던진다 — "채팅·피드 건수를
몇 점으로 환산하는가"가 실사용 데이터 없이 정할 수 없는 값이기 때문이다
(Part 10-7-3, Part 16-2). 활동 데이터가 전혀 없는 날(`null`)만 있는
극단 케이스(신규 연결 직후)는 throw하지 않고 기저 온도를 그대로 반환한다
— 이는 "없는 날은 0으로 계산" 규칙이 자명하게 적용되는 경우라 점수
환산식이 필요 없기 때문이다.

**해소되면** (`temperature.activityScore` 캘리브레이션 완료 시)
`computeDailyActivityScore` 함수 **본문만** 실제 환산식으로 교체한다.
`computeActivityDelta`/`computeActivityDeltaFromScores`/
`computeDailyTemperature`는 이미 최종 식대로 구현돼 있으므로 손댈 필요가
없다 — 이 분리가 이번 설계의 핵심이다(집계 식과 "점수를 어떻게
만드는가"를 처음부터 별도 함수로 나눠, 해소 시 변경 범위를 함수 하나로
좁혔다).

### `TEMPERATURE_ENGINE_VERSION`: `1.0.0` → `1.1.0`

daily_temperature 테이블에는 `engine_version` 컬럼이 없어 DB에 직접
쓰이진 않지만(파일 docblock이 이미 명시), 감사 추적용 모듈 버전이라
Part 10-7의 세 부분(①②③)이 새로 추가된 만큼 마이너 버전을 올렸다.

### 계수는 전부 인자 — 하드코딩 없음

`BaselineTemperatureCoefficients`(`contrast`/`neutral`/`best`,
문서 기본값 36.5/39/42), `ActivityDeltaCoefficients`(`windowDays`/
`widthCap`/`min`, 문서 기본값 14/55/0), `DailyTemperatureCoefficients`
(위 둘을 묶음) 전부 인자로만 받는다. `src/engine/temperature.ts` 안에
이 수치들을 상수로 박아두지 않았다 — 유일한 예외는 기저 하한
`DISCONNECTED_TEMPERATURE`(36.5)인데, 이는 "계수"가 아니라 Part 9-2에서
이미 확정된 별개의 구조적 상수(미연결 기본 체온)를 재사용한 것이고
Part 10-7-2가 명시적으로 이 값을 하한으로 지정했다. `daily_temperature.factors`
기록 코드는 작성하지 않았다(호출부 책임, Part 10-7-5).

### 판단이 필요했던 지점 (질문 목록)

- **활동 변동분의 "없는 날"(null) 처리 경계.** Part 10-7-3은 "창이 차기
  전에도 분모는 14, 없는 날은 0으로 계산"이라고만 한다. 나는 이를
  "커플이 아직 존재하지 않았던 날짜(데이터 자체가 없음)"로 해석해
  `null`로 표현하고 0으로 계산했으며, "커플은 존재했지만 그날 채팅/피드가
  0건"인 경우는 `DailyActivityRaw{chatMessageCount:0, feedPostCount:0}`로
  표현해 여전히 `computeDailyActivityScore`(UNRESOLVED)를 거치도록
  했다 — 0건이 0점으로 환산된다는 것도 아직 확정된 공식이 없으므로
  지어내지 않기 위함이다. 이 경계 해석이 맞는지 재확인 필요.
- ②의 식(`computeActivityDeltaFromScores`)과 "점수를 어떻게 만드는가"
  (`computeDailyActivityScore`)를 별도 함수로 분리한 것은 위임 프롬프트에
  명시된 요구는 아니고, "식은 구현·테스트되지만 점수 정의는 미확정"을
  더 명확히 분리해 표현하려는 내 설계 판단이다. 문제가 있다면 지적 바람.

### "없는 날"(null) 처리 경계 — 코디네이터 판정 (2026-09-03)

위 첫 번째 판단 지점에 대한 답: **에이전트의 구현(건수 층위 해석)이 옳다.**
단 근거를 다시 잡는다 — 문제는 "0건을 0점으로 볼 것인가"가 아니라 Part
10-7-3의 "없는 날은 0으로 계산한다"가 **건수 층위**(없는 날의 채팅·피드
건수를 0으로 둔다 → 그 0건도 점수로 환산해야 하므로 `UNRESOLVED` 경유,
throw)인지 **점수 층위**(없는 날의 활동 점수 자체를 0으로 둔다 → 환산을
건너뛰므로 throw 없음)인지의 문제다. 지금 구현은 건수 층위로 읽었고,
그게 더 보수적이라 맞다.

**오늘은 관측 차이가 없다** — `computeDailyTemperature`는 실활동이
하나라도 있으면 어차피 throw하므로 이 경계의 두 해석이 지금 당장
갈리는 지점이 없다. 차이는 `temperature.activityScore`가 **확정된 뒤**
드러난다.

**처방 — `temperature.activityScore` 정의를 작성/확정할 때 반드시
"채팅 0건·피드 0건인 날"을 명시적으로 다룰 것.** 다루지 않으면 이
질문이 그때 다시 올라온다. 그리고 확정 시점에 현재
`__tests__/engine/temperatureBaseline.test.ts`의
`{ chatMessageCount: 5, feedPostCount: 0 }` → `UnresolvedConstantError`를
기대하는 테스트가 깨질 것이다 — **그건 버그가 아니라 정상 신호다**
(`__tests__/engine/normDrift.test.ts`의 드리프트 감지 테스트와 같은
성격: "값이 채워졌으니 이 경로가 더 이상 throw하지 않는다"는 것을
테스트가 스스로 알려주는 것). 그 시점에 이 테스트를 고치는 것은 "기존
테스트 수정 금지" 규칙의 예외다 — `activityScore` 자체를 해소하는
작업의 일부이지, 미확정 상태를 우회하려는 수정이 아니기 때문이다.

### 궁합 매트릭스 재현성 — 마스터 PM 확인 필요 (2026-09-03, 코디네이터 에스컬레이션)

`COMPATIBILITY`(`src/constants/compatibility.ts`)를 엔진이 직접 정적
import한다 — 이번 위임 프롬프트가 명시적으로 허용한 형태이고 위반은
아니다. 다만 규준 데이터(`normPercentile.ts`)에서 인자 주입으로 막았던
문제(Part 10-8-3)가 여기 절반만 막혀 있다: 기저값 세 개(36.5/39/42)는
`coefficients` 인자로 주입되지만, **어느 유형쌍이 어느 값을 받는지
정하는 매트릭스 자체는 코드에 정적으로 고정**돼 있다. 매트릭스가
바뀌면(콘텐츠팀 교정 등) 과거에 발행된 매거진의 온도를 재현할 수
없고, `daily_temperature.factors`에 계수 버전을 기록해도 매트릭스
버전은 남지 않는다. **PM 판단 대기** — 이번 작업(#3)을 되돌릴 사안은
아니다(문서가 요구하지 않았고 매트릭스가 규준집단처럼 자주 바뀌는
것도 아니다). 필요하면 Part 10-6-5 또는 10-7-5에 매트릭스 버전 필드를
추가하는 별도 작업으로 처리.

### 파일

- 변경: `src/engine/temperature.ts` (기존 파일 이어서 구현, 기존 export
  4개는 시그니처·동작 그대로 유지)
- 신규: `__tests__/engine/temperatureBaseline.test.ts` (기존
  `__tests__/engine/temperature.test.ts`는 **수정하지 않음** — 그 파일의
  기존 4개 테스트 그대로 통과)

`npx jest`: 기존 289개 + 신규 29개 = **318개 전부 통과**.
`npx tsc --noEmit -p .`: **0에러**. `grep -rn "UNRESOLVED" src/engine/`는
`unresolved.ts`(선언, 불변) 외에 `temperature.ts` 3곳에서 신규 소비
(`computeDailyActivityScore` 정의 1곳 + 그 문서화 참조들은 카운트 아님,
실제 호출 지점은 `computeDailyActivityScore` 함수 본문 1곳).

## 규준집단 전수 열거 (`synthetic-v1`) — 완료 (2026-09-02, engine-dev)

Phase 7 선행 #2. 응답 공간 3,888개(Q1~Q5 3지선다 3⁵=243 × MBTI 16)를
전수 열거해 규준집단 데이터 파일을 생성하고, 백분위 조회 함수를 추가했다.

### 재사용한 기존 채점·스탯 함수 (재구현 없음)

전부 그대로 import만 했다. 열거용 재구현은 하지 않았다.

| 함수 | 시그니처 | 파일 |
|---|---|---|
| `inferLoveType` | `(input: LoveTypeInput) => LoveTypeInferenceResult` | `src/engine/loveTypeInference.ts` |
| `computeSixStats` | `(input: SixStatsInput) => SixStats` | `src/engine/leagueStats.ts` |
| `computeOvrRawScore` | `(stats: SixStats) => number` (6각 스탯 산술평균 = 합성값) | `src/engine/leagueStats.ts` |
| `percentileRank` | `(rawScore: number, population: readonly number[]) => number` | `src/engine/leagueStats.ts` (신규 조회 함수가 내부에서 호출) |
| `roundTo` | `(value: number, decimals: number) => number` | `src/engine/numeric.ts` (열거 통계의 유일 반올림 지점) |

문서 대조: `loveTypeInference`/`leagueStats`의 채점·스탯 로직을 MASTER
Part 10-2 / 10-1-3 / 17-3과 대조했고 어긋남 없음(호나이·하모닉 삼분법 매핑,
빅5 보정, 애착 축 20/50/85, 6각 가중합 전부 문서와 일치).

### `engineVersions` 맵 (파일에 기록됨, 기존 상수를 읽어 넣음)

| 키 | 값 | 상수 | 파일 경로 |
|---|---|---|---|
| `loveTypeInference` | `"1.0.0"` | `LOVE_TYPE_ENGINE_VERSION` | `src/engine/loveTypeInference.ts:52` |
| `leagueStats` | `"1.0.0"` | `LEAGUE_STATS_ENGINE_VERSION` | `src/engine/leagueStats.ts:34` |

문자열을 직접 타이핑하지 않았다 — `enumerateNormData()`가 두 상수를
import해 그대로 넣는다. 열거가 직접 import하는 엔진 모듈은 이 둘뿐이며,
`numeric.ts`는 버전 상수가 없는 순수 반올림 유틸(설계상)이라 맵에서 제외했다.

### 산출물 경로

| 경로 | 내용 |
|---|---|
| `src/engine/normPercentile.ts` | 백분위 조회 순수 함수 + `NormData` 스키마 타입. **규준 JSON을 정적 import하지 않는다** — `lookupCompositePercentile(compositeRawScore, norm)`처럼 데이터를 인자로 받는다. `lookupStatPercentile`는 기각된 (b) 방식 대조용으로 함께 노출(파이프라인 미사용). |
| `src/engine/data/norm-synthetic-v1.json` | 규준 데이터. **352,336 bytes (약 344 KB)** — 번들 영향. 커진다면 지연 로딩 검토(Part 10-8-3). |
| `scripts/norm/enumerate.ts` | 열거 순수 함수 `enumerateNormData()` / `enumerateProfiles()`. **파일 I/O 없음.** 드리프트 테스트가 재호출. |
| `scripts/norm/distribution.ts` | 결정론적 분포 요약(모표준편차 = N으로 나눔, nearest-rank 분위수). |
| `scripts/norm/serialize.ts` | `serializeNormData()` — 생성기·드리프트 테스트 공용 정규 직렬화. |
| `scripts/generate-norm.ts` | 파일 쓰기 담당. 실행법은 파일 상단 docblock(1회용 `npx tsc` 컴파일 후 `node`; ts-node/tsx 없음, Node 네이티브 TS는 확장자 없는 import 미해석). |
| `__tests__/engine/normDrift.test.ts` | **드리프트 감지 테스트.** 열거를 재호출→직렬화→커밋 파일과 **바이트 단위** 대조. 채점을 고치고 엔진 버전 상수를 안 올려도 이 테스트가 깨진다. 깨지면 "규준 재산출 + (채점이 바뀌었으면) 버전 상수 올리기" 신호. |
| `__tests__/engine/normPercentile.test.ts` | 조회 함수 순수성·단조성·데이터 주입·결정론(100회 반복) 검증. |

**기존 파일 수정 없음** — `git status`에 `M` 없음(전부 신규). `leagueStats.ts`,
`loveTypeInference.ts`, `constants/unresolved.ts`, 설정 파일 전부 미변경.
`grep -c` 레지스트리 엔트리 여전히 3(`temperature.activityScore` /
`leagueStats.shrinkage` / `faceMatch.threshold`). `leagueStats.shrinkage`는
`UNRESOLVED` 그대로 — 수축은 적용하지 않았다(원점수 기준 열거, Part 10-8-1).

### 점검 ① 분산 지배 (스탯별 표준편차 — `leagueStats.shrinkage` 확정 입력)

원점수(수축 전) 기준, 3,888개 전수.

| 스탯 | 평균 | 표준편차 |
|---|---|---|
| PUS | 49.750000 | **17.020209** |
| EMP | 54.753086 | **9.107087** (최소) |
| ATT | 47.000000 | **21.489015** (최대) |
| DEF | 44.222222 | **19.423799** |
| TAC | 45.416667 | **16.359460** |
| REA | 53.333333 | **13.707257** |

최대/최소 비 ≈ 2.36배 (ATT 21.49 / EMP 9.11). 합성값(6개 산술평균) 분포는
평균 49.079218 · 표준편차 3.540467. **판단은 하지 않음** — 평균 전 표준화
도입 여부는 마스터 PM 결정(Part 10-8-2).

### 점검 ② 에니어그램 코어 9종별 합성값 분포 (Part 10-8-2 검증 조건)

각 코어 표본 수 432로 균등(코어는 (Q1,Q2)만으로 결정 → 9쌍이 9코어에 전단사).

| 코어 | 평균 | 표준편차 | 최소 | 최대 | n |
|---|---|---|---|---|---|
| 1 | 45.800926 | 2.869455 | 38.333333 | 53.000000 | 432 |
| 2 | 47.092593 | 2.884642 | 39.666667 | 54.333333 | 432 |
| 3 | 49.717593 | 2.869411 | 42.166667 | 56.833333 | 432 |
| 4 | 50.427469 | 2.867197 | 42.833333 | 57.666667 | 432 |
| 5 | 50.260802 | 2.867197 | 42.666667 | 57.500000 | 432 |
| 6 | 45.967593 | 2.869455 | 38.500000 | 53.166667 | 432 |
| 7 | 51.009259 | 2.884597 | 43.500000 | 58.166667 | 432 |
| 8 | 49.884259 | 2.869411 | 42.333333 | 57.000000 | 432 |
| 9 | 51.552469 | 2.882395 | 44.000000 | 58.833333 | 432 |

코어 평균의 폭: 최저 45.80(코어 1) ~ 최고 51.55(코어 9), 약 5.75점 차
(합성값 전체 표준편차 3.54 대비 약 1.6σ). 코어 1·6이 구조적으로 하위,
코어 7·9가 상위. **판단은 하지 않음** — 가중치 도입은 마스터 PM 결정.

### 검증 상태

- `npx jest` : 24 suites / **289 tests** 전부 pass (기존 267 + 신규 22, 회귀 0)
- `npx tsc --noEmit -p .` : **0 에러**
- 재실행 바이트 동일 : `norm-synthetic-v1.json` SHA-256 재생성 전후 동일 확인
- 드리프트 테스트 : `__tests__/engine/normDrift.test.ts` pass

## `tsconfig.json` `types` 배열 신설 (2026-09-02, 코디네이터 지시) — CLAUDE.md 절대 규칙 8 명시

**변경 전**: `compilerOptions`에 `types`/`typeRoots` 키 없음(로컬·`expo/tsconfig.base`
병합본 `--showConfig`로 확인 — 둘 다 부재).
**변경 후**: `"types": ["jest", "node"]` 추가.

**원인**: 자동 `@types/*` 스캔이 jest뿐 아니라 node(`fs`/`path`/`__dirname`)까지
전부 안 되고 있었다(baseline 720에러 중 8건이 이미 `TS2591` node 관련 —
jest 전용 문제라는 최초 라벨이 부정확했음). `npx tsc --noEmit --types jest`
단독 시험 720→15, `--types jest,node` 시험 720→0으로 원인을 확정한 뒤 반영.
`node_modules/@types/jest`·`node`는 원래도 정상 설치돼 있었다(호이스팅
문제 아님) — 그저 아무 것도 자동 로드되지 않고 있었을 뿐.

**검증**: `npx tsc --noEmit -p .` 전체 0에러(신규 파일 포함), `npx jest` 267/267
그대로 pass(회귀 없음). `unresolved.test.ts`의 `@ts-expect-error` 2곳도
이제 유효성이 증명됐다 — tsc가 "Unused '@ts-expect-error' directive"를
전혀 보고하지 않았으므로(0에러에 포함되려면 이 경고도 없어야 한다) 두
디렉티브 모두 실제로 타입 에러를 억제하고 있다는 뜻이다.

## `UNRESOLVED` 규격 1단계 — 완료 확정 (2026-09-02) — 2단계는 승인 대기

`src/engine/constants/unresolved.ts` + `__tests__/engine/unresolved.test.ts`
작성 완료. **2단계(호출부 적용)는 이 인수인계 이후 별도 지시가 있어야
착수한다 — 아직 진행하지 않았다.**

- **등록된 키 3종과 소비 예정 Phase** (Part 16-2 목록과 1:1):
  - `temperature.activityScore` — Phase 7 (`MASTER Part 10-7-3`)
  - `leagueStats.shrinkage` — Phase 7 (`MASTER Part 10-8-3`)
  - `faceMatch.threshold` — Phase 6 (`MASTER Part 9-4`)
- **`faceMatch.ts` 호출부 존재 여부 조사 결과: 없음.** `isMatch`/
  `matchAgainstReferences`를 참조하는 코드는 저장소 전체에서
  `src/engine/faceMatch.ts` 자신과 `__tests__/engine/faceMatch.test.ts`뿐
  (`app/`, `src/services/`, `src/hooks/` 등 어디에도 caller 없음).
  프롬프트 지시대로 **호출부를 새로 만들지 않았다** — `faceMatch.ts`
  파일 자체도 이번 작업에서 전혀 건드리지 않았다. **2단계(호출부 적용)는
  진행하지 않는다** — 없는 호출부를 새로 만드는 것은 Phase 6 스캔
  파이프라인 설계를 이 세션이 선점하는 것이 되어, 별도 지시 없이 하지
  않는다(CLAUDE.md 절대 규칙 8과 같은 성격). `faceMatch.threshold`는
  레지스트리에 등록된 채 소비자를 기다리는 것이 이 규격이 의도한
  정상 상태다.
  > ⚠️ **Phase 6 스캔 파이프라인 구현 시 반드시 지킬 것**: `isMatch`의
  > `threshold` 인자는 `UNRESOLVED('faceMatch.threshold')`를 통해
  > 주입한다. 숫자를 직접 넣지 않는다. 값은 실기기 캘리브레이션 후
  > 확정된다.
- **이 변경으로 영향받은 기존 테스트: 없음.** `__tests__/engine/unresolved.test.ts`는
  신규 파일이고, 기존 파일은 하나도 수정하지 않았다. `npx jest` 전체
  실행 결과 22 suites / 267 tests 전부 pass(기존 257 + 신규 10).
- **`npx tsc --noEmit -p .`: 0에러 (위 `tsconfig.json` `types` 배열 신설 항목
  참조).** 신규 파일 포함 전체 통과, `@ts-expect-error` 2곳 유효성도 확인됨.

## Phase 2(엔진) 산출 타입 요약 — 여전히 유효, 그대로 참조

전부 `src/engine/*.ts`에서 export. 상세는 각 파일 상단 docblock 참조.

- `src/engine/loveTypeInference.ts` — `inferLoveType`, `resolveMbtiFromQuickQuiz`,
  개별 `compute*` 함수들, `LOVE_TYPE_ENGINE_VERSION`. Phase 3에서 그대로
  소비했다(`src/store/sessionStore.ts`, `src/services/personalityApi.ts`).
- `src/engine/leagueStats.ts` — `computeSixStats`/`computeOvrRawScore`/
  `percentileRank`/`mapPercentileToOvr`. Phase 3에서는 미사용(메인 탭 범위).
  **(2026-09-02)** `computeOvrRawScore`는 **더 이상 자리표시자가 아니다.**
  OVR은 6각 스탯의 산술평균(반올림)으로 확정됐고(MASTER Part 10-8-2)
  현행 구현이 이미 그 형태다 — 포지션 가중치 단계 자체가 삭제됐다.
  `percentileRank`가 쓸 규준집단도 확정(전수 열거 3,888, Part 10-8-1).
  **남은 미확정은 베이지안 수축 강도 하나** →
  `UNRESOLVED('leagueStats.shrinkage')`.
- `src/engine/temperature.ts` — `resolveDisconnectedTemperature`(36.5 고정),
  `clampTemperature`.
  **(2026-09-02)** 계산 규격이 **MASTER Part 10-7**로 확정됐다 —
  `baselineTemperature`(성격 기저) + `activityDelta`(14일 이동창).
  **다만 두 함수는 아직 구현되지 않았다.** 구현 시 제약:
  계수를 **인자로만** 받고, 이 파일에서 DB·네트워크·환경변수에
  접근하지 않는다(계수 조회는 호출부 책임). 엔진 안에서 supabase
  클라이언트를 import하면 함수가 비동기가 되어 순수성이 사라지는데
  기존 결정론 grep에는 걸리지 않는 **조용한 실패**다.
  식별자: `temperature`(최종) / `baselineTemperature`(기저) /
  `activityDelta`(변동) / `typeAffinity`(유형 궁합 — **온도 어근을 쓰지
  않는다**). **앱 클라이언트에서 이 파일의 함수를 호출하지
  않는다**(파일 상단 계약) — Phase 3의 `src/store/coupleStore.ts`는
  `DISCONNECTED_TEMPERATURE` **상수**만 재노출하고 함수는 호출하지 않는
  방식으로 이 계약을 지켰다. Phase 4(메인 탭)도 동일 원칙 유지할 것.
- `src/engine/dnaScore.ts` — `clampDnaScore`/`computeTotalScore`. base_score
  궁합 공식 없음(아래 "미확정" 참조).
  **(2026-09-02)** 여전히 미확정이지만 범위가 좁아졌다 — 궁합 매트릭스는
  MASTER **Part 10-6-5**에 이미 있고 **범주형**(잘 맞음 / 중립 / 온도차)이다.
  없는 것은 **범주 → 점수 변환 규칙** 하나. 마스터 PM 확정 대기.

## Phase 3(온보딩 UI) 산출 요약 — 이후 Phase가 가져다 쓰는 용도

- **세션 분기**: `app/index.tsx`가 앱 실행 시 세션 유무 +
  `profiles.onboarding_step`로 라우팅을 전부 결정한다. 새 Phase가 메인
  탭 진입 로직을 따로 만들 필요 없음 — `onboarding_step`이
  `ONBOARDING_STEP.COMPLETE`(3)면 이미 `/main`으로 보낸다.
- **`src/constants/onboardingStep.ts`**: `profiles.onboarding_step`은
  DB CHECK 제약으로 **0~3 범위 고정**(`supabase/migrations/003_profiles.sql`).
  Part 11-1 문서는 "완료/미완료"만 규정하고 구체 정수는 스키마 쪽
  원문(주석 "0=가입직후 … 3=온보딩완료")을 따랐다 — 새 화면을 끼워
  넣더라도 이 범위를 벗어나면 DB insert/update가 즉시 실패한다.
- **`src/services/coupleApi.ts`**: 초대 코드 발급(`getOrCreateInvite`)/
  참여(`redeemInviteCode`)/스킵(`completeOnboardingWithoutCouple`)/
  사귄날짜(`setOrConfirmStartDate`) 전부 RLS 정책만으로 클라이언트
  직접 호출(RPC 불필요) — `couples_update` 정책이 "빈 슬롯에 들어가는"
  참여를 이미 허용하도록 db-architect가 설계해둔 덕분.
- **소셜 로그인 구현 방식**(`src/services/socialAuth.ts`): 카카오/구글/
  애플 네이티브 SDK 대신 `supabase.auth.signInWithOAuth` +
  `expo-web-browser` 리다이렉트 방식을 선택했다(이유는 파일 상단
  docblock). Provider 문자열은 `'kakao' | 'google' | 'apple'`
  (`@supabase/auth-js`의 `Provider` 타입에 이미 포함돼 있음 확인함).
  이 방식이 최종 채택인지는 사람 검토 필요 — 네이티브 SDK로 바꾸기로
  하면 이 파일과 `app/(onboarding)/auth.tsx`만 교체하면 되고 나머지
  (profiles/personality_assessments 저장 로직)는 영향 없다.
- **애니어그램 코어 "후보 2개"**(화면 7): `src/utils/enneagramCandidates.ts`
  — Part 10-1-2 Q1/Q2 산출물 표에서 구조적으로 도출(Q1이 같은 호나이
  그룹 3개로 좁히고 Q2가 그중 1개를 확정 → 나머지 2개가 후보). MBTI
  사전분포(enneagramPrevalence.ts)와는 무관 — 그건 화면 5 "희귀 조합"
  배지 전용으로 그대로 분리 유지했다.

## Phase 4(5개 탭 UI) 산출 요약 — Phase 5+가 가져다 쓰는 용도

- **`src/store/coupleStore.ts`** (`isConnected` 등가 상태, Part 9-1 화면 8
  "전역 상태 coupleStore.isConnected" 원문 명명 그대로 — 실제 필드명은
  `status: 'unknown'|'loading'|'disconnected'|'connected'`). 이번
  Phase에서 필드 확장:
  - `partnerId: string | null` — 연결 시 상대 profiles.id
  - `nickname: string | null` — 커플 닉네임(`couples.nickname`)
  - `temperature: number | null` — **타입이 `number`에서 바뀌었다.**
    미연결이면 항상 `DISCONNECTED_TEMPERATURE`(36.5), 연결이면
    `daily_temperature` 최신 저장값(없으면 `null` — 아직 배치가 한
    번도 안 돎). **null을 절대로 임의 숫자로 대체하지 말 것** — 화면은
    null일 때 숫자 대신 대기 상태 문구를 보여줘야 한다(작업 지시
    "미연결 36.5도 외에는 노출 금지" 계약, `app/(tabs)/main.tsx`
    docblock 참조).
  - `temperatureDateOn: string | null` — 위 temperature가 계산된 날짜.
  - `refresh(userId)`가 이제 `daily_temperature`도 실제로 조회한다
    (기존엔 36.5 기본값만 유지했었음).
- **`src/components/CoupleGate.tsx`**: 변경 없음(Phase 3 그대로). 단
  **메인 탭은 이 컴포넌트를 쓰지 않는다** — Part 9-2가 연결/미연결을
  "같은 화면의 잠긴 기능"이 아니라 처음부터 별개 표로 정의해서다.
  `<CoupleGate>`는 "같은 화면 안에서 기능 하나만 잠기는" 경우
  전용으로 남겨뒀다 — 실제 사용처: 채팅 탭(`autoOpenInvite`), 피드
  탭(통합 타임라인 섹션만), 매거진 탭(발행물 영역 전체). 새 Phase가
  커플 전용 기능을 추가할 때 이 두 패턴(전용 화면 vs 부분 잠금) 중
  어느 쪽인지 먼저 판단할 것.
- **`src/utils/relationshipDays.ts`** (`computeDaysTogether`): 사귄
  일수 D+N 계산 순수 함수, `now` 인자 주입 가능(테스트 결정론용).
  시작일을 1일차로 세는 관행을 채택했다(원문에 오프셋 명시 없음,
  파일 상단 docblock에 근거 기록) — 원문이 다르게 확정되면 이 파일만
  교체.
- **탭 하나 새로 열 때 잊지 말 것**: `<CoupleGate>`를 쓰는 화면은
  마운트 시 `useCoupleStore.getState().refresh(userId)`를 직접
  호출하거나 `useEffect`로 트리거해야 한다 — 하지 않으면 store가
  `status: 'unknown'`에 멈춰 `<CoupleGate>`가 계속 빈 화면(`null`)을
  반환한다(피드 탭에서 실제로 이 버그를 발견해 고쳤다 — Phase 4
  완료 절 참조).

## 문서 불일치 발견 — 콘텐츠팀/코디네이터 확인 필요

**Part 10-6-5 "8 · IRON" 온도차 표가 Part 10-6-4 순환 고리와 모순된다.**
Part 10-6-4는 온도차 9쌍이 `1-8-7-3-2-5-9-4-6-1` 순환 고리를 이룬다고
명시하고("상호 대칭 필수"), 실제로 8을 제외한 8개 코어의 온도차 목록은
전부 이 고리와 정확히 일치한다. 그런데 "8 · IRON" 항목만 온도차 상대로
{1 KEEL, 6 OATH}를 적어놨다 — 고리대로면 {1, 7}이어야 한다("7 · RUSH"
쪽 목록에는 이미 8이 온도차 상대로 명시돼 있어 8 쪽에서 7이 빠지면
상호성이 깨진다). `src/constants/compatibility.ts`는 순환 고리를
기준으로 8의 두 번째 항목을 7로 교정하고, 문구는 "7 · RUSH" 목록에
이미 있던 원문(이유: "주장형끼리, 주도권 충돌", 팁: "밀어붙이기 전에
한 박자 쉬어보세요")을 그대로 재사용했다(새 문구 창작 없음) —
`compatibility.ts` 파일 상단 docblock에 상세 근거 기록. **콘텐츠팀
확인 후 원문이 다르게 확정되면 이 항목만 교체할 것.**

## Phase 5(채팅 실시간) 산출 요약 — Phase 6+가 가져다 쓰는 용도

- **`src/hooks/useRealtimeMessages.ts`**가 채팅 화면의 유일한 데이터 소스다.
  `messages`/`stories` 조회·전송·읽음처리 로직은 전부 `src/services/chatApi.ts`에
  있다 — 다른 Phase가 채팅 데이터를 건드릴 일이 있으면(예: Phase 7 AI 감정
  태깅 배치가 `warmth_score`를 채우는 쪽) 이 파일들의 쿼리 패턴을 참고할 것.
  `warmth_score`/`sentiment`/`analyzed_at`은 Phase 5 어디에서도 읽거나 쓰지
  않는다(의도적 — Phase 7 전용).
- **(2026-08-27 해소)** 오프라인 큐가 AsyncStorage로 영속화됐다
  (`chat_queue:{coupleId}`, `src/utils/chatQueue.ts`
  `chatQueueStorageKey`/`parseQueuedMessages`) — 앱 강제 종료 후
  재실행해도 미전송 메시지가 pending으로 복원되고 재시도가 재개된다.
  재시도 정책(최대 5회, 지수 백오프 2s→4s→8s→16s→32s, 에러 유형별
  즉시 실패 분기)과 사용자 조작("다시 시도"/취소)도 함께 구현됨 —
  스케줄링은 `src/utils/chatRetryQueue.ts`(`ChatRetryQueue`, React
  비의존이라 fake timer로 테스트됨), 상세 판단 근거는
  `.claude/state/DECISIONS.md` 2026-08-27 항목 참조.
- **`client_msg_id` 멱등 재전송 패턴**: insert 시도 → 유니크 제약 위반(23505)이면
  기존 행을 재조회해 성공으로 간주(`src/services/chatApi.ts` `sendMessage`).
  다른 테이블에도 같은 멱등 재전송이 필요해지면(예: 피드 업로드) 이 패턴을
  재사용할 수 있다.

## Phase 6 1~2단계(생체정보 동의 + 대표사진 등록) 산출 요약 — Phase 6 3단계(메인 세션)가 가져다 쓰는 용도

- **동의 상태의 단일 진실 소스는 `profiles.biometric_consent_at`/
  `biometric_consent_revoked_at`이다.** "현재 동의가 유효한가"는 어디서도
  직접 두 컬럼을 비교하지 말고 `src/utils/biometricConsent.ts`의
  `isBiometricConsentActive(consentAt, revokedAt)`를 불러 써라 — 재동의 시
  `revoked_at`을 `null`로 되돌리는 규칙(문서에 없는 자체 판단,
  `.claude/state/DECISIONS.md` 2026-08-27 항목 참조)이 이 함수 안에만
  있고 다른 곳에 중복돼 있지 않다.
- **`src/store/profileStore.ts`/`src/store/coupleStore.ts`가 대표사진
  경로(`referencePhotoPath`)까지 함께 들고 있다.**
  `setPersonalReferencePhoto(userId, localUri)`(profileStore)/
  `setReferencePhoto(localUri)`(coupleStore, 연결 상태에서만)가 업로드
  + DB 반영 + 로컬 상태 갱신을 한 번에 한다. 실제 업로드는
  `src/services/referencePhotoApi.ts`(`uploadReferencePhoto`,
  `getReferencePhotoSignedUrl`)에 있다 — Storage 경로 규칙은 아래
  참조.
- **⚠️ `019_avatars_storage_policies.sql`을 원격에 적용해야 대표사진
  업로드가 동작한다.** 개인 `{user_id}/reference`, 커플
  `{couple_id}/reference` 규칙으로 경로를 확정했다(015가 미확정으로
  남겨뒀던 부분). 적용 전까지는 `app/(modals)/reference-photo.tsx`의
  저장이 전부 RLS 거부(42501)로 실패한다 — `.claude/state/PROGRESS.md`
  "막힌 것" 참조.
- **화면 C(대표사진 등록)는 이미 완성돼 재사용 가능하다.**
  `src/components/ReferencePhotoSlot.tsx`(프레젠테이션, 개인/커플 공용) +
  `app/(modals)/reference-photo.tsx`(라우팅/스토어 연결). "사진 선택"만
  플레이스홀더다(`src/constants/referencePhotoPlaceholders.ts`) — 실제
  갤러리 연동 시 이 상수 파일의 소스를 `expo-image-picker` 결과로
  바꾸고, `ReferencePhotoSlot`에 넘기는 `onSave` 콜백 인자(로컬 URI)
  타입만 유지하면 나머지(미리보기·업로드·DB 반영)는 그대로 동작한다.
- **`profiles.photo_sync_enabled`/`photo_scan_completed_at`/
  `photo_scan_cursor`는 여전히 전혀 건드리지 않았다.** 피드 탭 안내
  카드(`app/(tabs)/feed.tsx`의 `PhotoSyncPromptCard`)는 생체정보 동의
  상태만으로 두 상태(미동의/동의완료)를 보여준다 — 화면 B(권한)·SDK
  연동 후에는 이 카드를 "동의 완료 → 권한 미허용 → 대표사진 등록
  완료 → 스캔 중"처럼 더 세분화해야 할 것이다.
- **⚠️ 철회 시 로컬 얼굴 데이터 삭제가 구현되지 않았다.** MASTER.md
  "철회 시 반드시 함께 일어나야 하는 일" 3번 — SDK 연동 시
  `revokeBiometricConsent`(`src/store/profileStore.ts`) 안에 온디바이스
  삭제 호출을 반드시 추가할 것. 자동 테스트로 강제할 수 없는 항목이라
  QA 체크리스트에 수동으로 남아 있다(`.claude/state/PROGRESS.md`
  "막힌 것" 참조).
- **(2026-09-02) `src/engine/faceMatch.ts`의 `threshold` 인자는 다섯 번째
  자리표시자였다** — 어느 문서에도 값이 없었고 자리표시자 목록에도 없었다.
  코드는 규칙을 정확히 지켰지만(인자로 받고 하드코딩하지 않음) 그래서
  아무도 추적하지 않았다. **판정 정책은 확정됐다** — MASTER Part 9-4:
  **오탐 회피 우선**, 판정이 애매한 구간은 매칭하지 않는다. 이중 임계값은
  범위 밖(분포 관측 후 Phase 10과 재검토).
  **값은 실기기 캘리브레이션 대기** → `UNRESOLVED('faceMatch.threshold')`.
  SDK 반환값이 유사도인지 거리인지, 정규화 범위가 무엇인지, 실제 커플
  사진에서 어느 대역에 분포하는지가 재빌드 후에만 관측된다. 측정은
  **온디바이스에서 하고 사람이 화면에서 읽어 손으로 기록한다** — 유사도
  로그나 특징 벡터를 서버로 보내면 절대 규칙 1 위반이다. 실기기
  작업이므로 위임 대상이 아니다.
- **법률 문구는 여전히 자리표시자다** — `src/constants/legalDocuments.ts`
  의 `biometric` 항목. 실제 법무 검토 텍스트로 교체 필요(다른 3개
  문서와 동일한 미해결 상태, "여전히 필요한 처리" 5번 항목에 함께
  추적).

## 여전히 필요한 처리 (사람 작업)

### 2026-09-02 추가

- **`docs/` 5종 교체** — MASTER·DESIGN·ROADMAP·SCHEMA·CORNER_CONTENT.
- **`ui-builder_phase6_guard.md` 내용을 `.claude/agents/ui-builder.md`
  끝에 이어 붙이기** — 새 파일이 아니다. Phase 6(생체정보 동의) +
  Phase 10(매거진 제작 탭) 주의사항.
- **마스터 PM 문서 / 프롬프트 엔지니어 인수인계서를 `docs/`에 넣을지 결정**
  — 현재 저장소 밖이라 버전 관리가 안 된다. 마스터 PM 문서는 "새 세션에서
  문서 하나로 복구"가 존재 이유라 특히 그렇다.
- **`018_realtime_publication.sql` 원격 적용 여부 확인** — 로컬 파일 존재와
  원격 적용은 별개다. 아래 1번과 같은 사안이며, 0831 대조 문서가 "다음
  확인 3가지"로 올렸으나 그 문서는 스냅샷이라 갱신되지 않는다.

### 기존

1. **`supabase_realtime` publication에 `messages`(및 필요 시 `stories`)가
   빠져 있다** — 원격 프로젝트에 직접 쿼리(`select * from
   pg_publication_tables where pubname = 'supabase_realtime'`)해 확인함,
   결과 0행. `alter publication supabase_realtime add table
   public.messages;`를 마이그레이션으로 적용해야 상대방 기기가 채팅을
   실시간으로 수신한다(현재는 화면 재진입 시에만 최신화됨). db-architect
   영역 — Phase 5는 읽기 전용 확인만 하고 적용하지 않았다(작업 지시 준수).
2. **`.env`의 `EXPO_PUBLIC_SUPABASE_ANON_KEY`가 플레이스홀더 상태** —
   Supabase 대시보드(Project Settings → API)에서 실제 anon public key를
   복사해 채워야 소셜 로그인/DB 저장 코드가 실제로 동작한다. Phase 3
   코드는 이 값이 채워지는 즉시 동작하도록 전부 작성돼 있다(anon
   key는 클라이언트 노출이 전제인 공개 키라 이 세션이 대신 채워도
   되는지 애매해 손대지 않았다 — 필요하면 다음 턴에 MCP로 조회해
   채워 넣을 수 있다).
3. **Supabase Auth 대시보드에 카카오/구글/애플 OAuth 프로바이더가
   설정돼 있는지 미확인** — `mcp__claude_ai_Supabase__list_projects`/
   `get_project`로는 Auth 프로바이더 설정이 노출되지 않아 이 세션에서
   확인 불가했다. Authentication → Providers에서 3종 활성화 + 각
   프로바이더 개발자 콘솔에 리다이렉트 URI
   (`https://<project-ref>.supabase.co/auth/v1/callback`) 등록 필요.
4. **iOS Dev Build 없음** — Apple 로그인은 iOS 실기기가 있어야 검증
   가능(Apple Developer 계정 대기 중). Android에서는 카카오/구글
   웹 리다이렉트 플로우를 안드로이드 Dev Build로 검증 가능할 수 있다.
5. **(2026-08-25 구현 완료) 017 마이그레이션 원격 미적용** — 화면 6
   약관 동의 UI는 구현 완료(`app/(onboarding)/auth.tsx`,
   `src/components/ConsentChecklist.tsx` 등). 단
   `supabase/migrations/017_profiles_marketing_consent.sql`
   (marketing_agreed_at 컬럼 추가 + terms/privacy_agreed_at
   default now() 제거)을 원격에 아직 push하지 않았다 — 사람이
   `npx supabase db push` 실행 후 `supabase gen types`로
   `src/types/database.ts` 재생성 필요(지금은 수동 패치 상태).
   미적용 상태에서는 marketing_agreed_at upsert가 실패한다.
   상세는 `.claude/state/DECISIONS.md` 2026-08-25 항목 참조.
   약관/개인정보처리방침/AI 활용 고지 **본문은 여전히 자리표시자**다
   (`src/constants/legalDocuments.ts`) — 출시 전 법무 검토 본문으로
   교체 필요. **(2026-08-27 추가)** 같은 파일의 `biometric`(생체정보
   동의) 항목도 동일하게 자리표시자 — 아래 "Phase 6 1단계" 절 참조.
6. **(2026-08-27 구현 완료, 원격 미적용) avatars Storage 버킷 정책** —
   경로 규칙을 개인 `{user_id}/reference` / 커플 `{couple_id}/reference`로
   확정하고 `supabase/migrations/019_avatars_storage_policies.sql`
   작성 완료(`app/(modals)/reference-photo.tsx` 대표사진 등록 화면이
   이 정책에 의존한다). **`npx supabase db push`로 원격 적용 필요** —
   적용 전까지는 대표사진 업로드가 전부 RLS 거부(42501)로 실패한다.
   적용 후 `supabase gen types typescript --linked`로
   `src/types/database.ts` 재생성은 불필요(테이블 컬럼이 아니라
   Storage 정책만 추가했다).
7. **연애 온도 결합 공식이 없다** (`src/engine/temperature.ts`) — Part 9-2
   "선행 프로젝트의 연애 일치율 로직 계승"의 원문이 저장소 어디에도
   없다. 기본값(36.5)·클램프만 구현된 상태. **(2026-08-25 갱신)** Phase
   4는 이미 완료됐다 — 메인 탭은 저장값이 없으면 숫자 대신 대기 문구를
   보여주는 방식으로 이 공식 없이도 구현 가능했다(`app/(tabs)/main.tsx`).
   다만 이 공식 자체는 **일 배치 Edge Function을 실제로 만드는 시점에는
   반드시 확정돼야 한다** — 그 전까지는 연결된 커플도 온도가 계속
   "측정 준비 중"으로만 보인다.
8. **DNA base_score 궁합 공식 + 애니어그램 9×9 매트릭스**
   (`src/engine/dnaScore.ts`) — Part 17-2 가중치 미확정. Phase 3의
   `src/constants/compatibility.ts`(애니어그램 코어 궁합, 화면 7용)와는
   **별개**다 — 그건 1인 상태에서 보는 구조적 참고 자료이고, 이건
   커플 연결 후 빅5·스턴버그·애착까지 결합한 실제 DNA 일치율 계산용.
9. **OVR 포지션 가중치 표 + 연애 포지션 네이밍이 없다**
   (`src/engine/leagueStats.ts`). 현재 6개 스탯 단순 평균.
10. **베이지안 수축(shrinkage) 보정 파라미터가 없다**
   (`src/engine/leagueStats.ts`).
11. **`daily_temperature.engine_version` 컬럼 부재** — db-architect 판단
    필요.
12. **화면 5 "이미지로 저장" 미구현** — `react-native-view-shot` 등 뷰
    캡처 라이브러리가 미설치라 안내 alert만 뜬다. 공유하기(OS 공유
    시트)는 실제로 동작한다.

## Phase 2(엔진) 산출물 요약 (참고용)

- `src/constants/*.ts`, `src/data/onboardingQuestions.ts`, `src/engine/*.ts`
- `__tests__/engine/*.test.ts` — 94개 전부 통과
- love_type_labels 36종 네이밍·카피 확보(`src/constants/loveTypeLabels.ts`).
  `description_ko`만 Part 16 열린 과제로 미확정(null) — 화면 7은 null이면
  해당 섹션을 조건부로 숨기는 방식으로 대응 완료.
