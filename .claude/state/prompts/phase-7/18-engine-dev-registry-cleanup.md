# 위임 프롬프트 — 레지스트리 정리 + 재-export 제거

> 대상: `engine-dev`
> 보관 경로: `.claude/state/prompts/phase-7/18-engine-dev-registry-cleanup.md`
> 작성: 프롬프트 엔지니어 세션 / 2026-09-10

---

engine-dev 에이전트로 아래 작업을 진행해주세요.

## 목표

두 가지 정리입니다.

1. `UNRESOLVED` 레지스트리에서 `resolutionCondition` 필드를 제거한다
2. `src/engine/temperature.ts`의 궁합 판정 **하위 호환 재-export**를 제거한다

## 참조 문서

| 절 | 내용 |
|---|---|
| `docs/ONDOLOG_MASTER.md` **Part 16-2** | 레지스트리 필드 규정 — `key`·`phase`·`doc` 셋뿐 |

---

## 1부 — `resolutionCondition` 제거

### 근거

r11에서 레지스트리 필드를 **`key`·`phase`·`doc` 셋으로 확정**했습니다.
`해소 조건`은 MASTER 16-2 표의 열이며 **문서 전용**입니다.

같은 산문이 문서와 코드 두 곳에 있으면 반드시 어긋납니다. 실제로 두 번
드리프트가 났고, 두 번째는 방향이 틀린 내용이었습니다.

### 조사 결과 (위임 전에 확인됨)

`resolutionCondition`은 **`src/engine/constants/unresolved.ts` 안에서만
쓰입니다.**

```
:42        타입 선언
:56 62 68 74   네 키의 값
:98        에러 메시지 조립
```

`src/`·`__tests__`·`scripts` 어디에도 외부 소비가 없습니다.
`scripts/norm/unresolvedInventory.ts`도 이 필드를 읽지 않습니다.

**착수 전에 이 사실을 직접 확인해 보고할 것.** 조사 시점 이후 늘었을
수 있습니다.

### 할 것

- 타입 선언에서 `resolutionCondition` 제거
- 네 키의 값에서 제거
- **에러 메시지에서 그 문장만 뺀다.** 나머지는 유지한다

`doc`이 남으므로 정보 손실이 없습니다 — 해소 조건은 `doc`이 가리키는
절에서 읽습니다(r11 규정).

### 에러 메시지를 검사하는 기존 테스트가 있다

`__tests__/engine/unresolved.test.ts`가 네 키 각각에 대해 메시지 내용을
assert합니다. 다만 **`phase`와 `doc`만 확인하고 `해소 조건` 문장은
검사하지 않습니다.**

```
expect(err.message).toContain('7')
expect(err.message).toContain('MASTER Part 10-7-3')
```

**그 문장을 제거해도 이 assertion은 수정 없이 그대로 통과해야 합니다.**
통과하지 않으면 멈추고 보고하십시오.

같은 파일의 결정론 테스트가 **메시지 동일성**도 봅니다(100회 호출의
메시지가 전부 같은지). 메시지 조립을 건드리므로 이것도 통과 확인
대상입니다. 문장 하나를 빼는 것뿐이라 영향이 없어야 합니다.

> **이것이 1부의 증거입니다.** 메시지에서 한 문장이 빠져도 `phase`·`doc`
> 검사가 그대로 통과하는 것이, "해소 조건을 지워도 정보 손실이 없다"는
> r11 판단의 실증입니다.

### 건드리지 말 것

- **`UNRESOLVED` 함수의 시그니처·본문·반환 타입**
- **`UnresolvedConstantError`의 필드** — 이미 `key`·`phase`·`doc` 셋뿐
- **`UnknownUnresolvedKeyError`** 및 에러 타입 2종 구분
- **키 유니온이 레지스트리에서 파생되는 구조**
- **등록된 키 4개** — 추가도 삭제도 하지 않는다

---

## 2부 — 재-export 제거

### 근거

궁합 판정이 `src/engine/typeAffinity.ts`로 분리됐을 때, 이동이
**순수했음을 증명하기 위해** `temperature.ts`에 하위 호환 재-export를
남겼습니다. 그 덕에 기존 온도 테스트가 한 줄도 안 바뀌고 통과했습니다.

증명이 끝났으므로 제거합니다. 남겨두면 새 코드가 계속 `temperature.ts`를
통해 궁합을 가져갈 수 있고, 모듈 경계가 흐려집니다.

### 조사 결과 (위임 전에 확인됨)

`temperature.ts`에서 **궁합 심볼을 가져가는 곳은 한 파일뿐**입니다.

```
__tests__/engine/temperatureBaseline.test.ts:29   resolveTypeAffinity
```

`src/store/coupleStore.ts`는 `temperature.ts`에서 가져가지만
**`DISCONNECTED_TEMPERATURE`만** 씁니다. 궁합과 무관합니다.

**착수 전에 이 사실을 직접 확인해 보고할 것.**

### 할 것

- `temperature.ts`에서 `resolveTypeAffinity`·`TypeAffinityCategory`의
  **재-export만 제거**한다
- `temperatureBaseline.test.ts`의 import를
  `src/engine/typeAffinity`로 **경로만 갱신**한다

### ⚠️ import 정리를 넓게 하지 말 것

**`temperature.ts`에서 가져가는 다른 심볼은 그대로 둔다.**

`src/store/coupleStore.ts`의 `DISCONNECTED_TEMPERATURE` import는
**건드리지 않는다.** 그것은 온도 모듈의 정당한 export이며 이번
작업과 무관하다.

이번에 제거하는 것은 **궁합 판정 심볼의 재-export 두 개뿐**입니다.

### 기존 테스트 — 이번에 한해 수정이 허용된다

`temperatureBaseline.test.ts`의 **import 경로 갱신만** 허용합니다.

- [ ] **assertion과 기댓값을 수정하지 않는다**
- [ ] 수정 후 그 파일이 **전부 통과해야 한다**
- [ ] 통과하지 않으면 **고치지 말고 멈추고 보고한다**

> **이것이 순수 이동의 새 증거입니다.** 지금까지는 재-export가 증거였고,
> 그것을 제거하므로 증거를 갈아끼웁니다. **경로만 바꾸고 assertion이
> 그대로인 채 전부 통과하는 것**이 새 증거입니다.

### 온도 산출이 바뀌면 안 된다

- **`TEMPERATURE_ENGINE_VERSION`을 올리지 않는다.** 공식이 바뀌지 않는다
- `temperature.ts`의 계산 로직·상수를 건드리지 않는다
- `computeAttachmentStability` 본문을 건드리지 않는다 — EMP가 쓰고 있고
  그 바이트 동일성이 여러 판정의 근거였다

---

## 완료 기준

- `resolutionCondition`이 타입·값·에러 메시지에서 전부 제거됐다
- 에러 메시지에 **`doc`이 그대로 나온다**
- **`unresolved.test.ts`의 메시지 assertion이 수정 없이 전부 통과한다**
  — 이것이 1부의 증거다
- **같은 파일의 메시지 결정론 테스트가 통과한다**
- `UNRESOLVED` 함수의 시그니처·본문·에러 클래스 2종·키 유니온 파생
  구조가 **변하지 않았다**
- 등록된 키가 **여전히 4개**다
- `temperature.ts`에서 궁합 심볼 재-export **두 개만** 제거됐다
- `coupleStore.ts`가 **변경되지 않았다**
- `temperatureBaseline.test.ts`가 **import 경로만 바뀌고 assertion은
  그대로이며 전부 통과한다**
- `TEMPERATURE_ENGINE_VERSION`이 **오르지 않았다**
- 34번에서 추가된 정적 규칙 A·B가 **여전히 통과한다**
- `scripts/norm/unresolvedInventory.ts` 실행 결과가
  **정의 4 / 소비 2**로 유지된다
- 기존 테스트 415개 전부 통과 (감소 없음)
- `npx tsc --noEmit -p .` 통과 (**0 에러**)

## 하지 말 것

- **`UNRESOLVED` 함수·에러 클래스·키 유니온 구조 수정**
- **키 추가·삭제·해소**
- **`temperature.ts`의 계산 로직·상수·버전 상수 수정**
- **`coupleStore.ts` 수정** — `DISCONNECTED_TEMPERATURE`는 무관하다
- **`temperature.ts`에서 가져가는 다른 심볼의 import 정리**
- **`computeAttachmentStability` 본문 수정**
- **`typeAffinity.ts` 수정** — 이동은 이미 끝났다
- **기존 테스트의 assertion·기댓값 수정** — import 경로 갱신만 허용.
  깨지면 멈추고 보고
- **34번 정적 규칙이나 집계 스크립트 수정**
- **기존 진단 스크립트 5개 수정**
- **상태 파일의 기록을 삭제·이동하거나 구조를 재편하는 것** — 항목
  추가와 이번 작업이 바꾼 사실의 갱신만 허용
- 커밋·푸시, 라이브러리 의존성 추가, 설정 파일 변경
- 문서에 없는 값을 지어내는 것 — 판단이 서지 않으면 **멈추고 물어볼 것**

## 완료 후

`PROGRESS.md`와 `.claude/state/HANDOFF.md`에 기록한다.

- 착수 전 조사 결과 (`resolutionCondition` 소비처, 재-export 소비처)
- 에러 메시지 변경 전/후
- `unresolved.test.ts`의 메시지 assertion이 **수정 없이 통과**했다는 사실
- `temperatureBaseline.test.ts`의 import 변경 전/후, assertion 무변경 확인
- **순수 이동의 증거가 재-export에서 "경로만 바꿔 전부 통과"로
  갈아끼워졌다**는 사실
