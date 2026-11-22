# Proteur 안내 — `51- ③` 실행: 자기 점검 1회 + 두 폰 커플 1호 (R143-4 · R141-3)

> 작성: 프롬프트 엔지니어 세션 / 2026-11-22
> 실행 명령의 **정본은 HANDOFF "51- ③ 실행 명령" 절** — 이 안내는 순서 · 확인점 · 판정
> 예상 비용 약 $0.27(자기 점검 $0.07 + 1호 $0.2) → 누적 약 $2.65 / $30
>
> **복사하는 법**: 명령은 앞에 빈칸이 있는 회색 줄 · 한 줄씩만

---

## 0. 먼저 (키 없음)

1. **커밋**(51- ③ 길) — 메시지는 아래 그대로(형식 R121-5)

        git add scripts/ops/phoneTestCouple.ts scripts/ops/phonePreview.ts scripts/ops/phoneOpsAdapter.ts scripts/ops/sweetSubDates.ts scripts/ops/phoneCouple513.test.ts

        git add scripts/ops/generateIssue.ts scripts/ops/generateIssueCli.ts .claude/state/HANDOFF.md .claude/state/PROGRESS.md

        git commit -m "feat(ops): 51-3 phone test couple live path (allowlist + explicit flag)"

        git status --short

2. **75- 허용 목록 확인** — 저장소 밖 그 파일을 메모장으로 열어 **두 폰 계정 이메일이 둘 다** 있는지 눈으로만 봅니다(파일 내용은 PE에게 보내지 않음)
3. **두 폰에 최신 빌드 덮어 설치**(유성 · C03 · 85- 하늘 2단계가 들어간 판) — 실제 경로에서:

        cd "C:\Users\sejun\OneDrive\바탕 화면\ONDOLOG\ondolog\web"

        npm run build:trial

        npx cap sync android

   → `subst O: "C:\Users\sejun\OneDrive\바탕 화면\ONDOLOG\ondolog"` → `cd O:\web` → `npx cap open android` → 두 폰에 각각 Run(덮어 설치 · 데이터 그대로)
   → 끝나면 `git status --short`에 `web/android/app/build.gradle`이 보이면 `git checkout -- web/android/app/build.gradle`(R124-11)

## 1. 실행 (한 창 · HANDOFF "51- ③ 실행 명령" 1 → 5)

1. console에서 **새 LLM 키** → **시작 메뉴**에서 PowerShell → 맨 위 폴더
2. HANDOFF 절 **1)** 창 준비 · 키 · 접속 값 보안 입력 · 가리개 `m` · 허용 목록 위치 → `True` 확인
3. **2)** 자기 점검 하네스 1회 → review → recheck
4. **3)** 미리 보기 → 날짜별 개수가 나옴
   - **두 폰에 3일치 기록을 쌓은 달**을 `$ps` · `$pe`로(HANDOFF 설명대로)
   - 기록이 두 달에 걸쳐 있거나 "선행 검사 미달"이 나오면 **여기서 멈추고** 미리 보기 출력만 PE에게(키는 창에 둔 채 기다려도 되고, 오래 걸리면 창을 닫고 나중에 새 키로)
5. **4)** 생성 → 렌더 → 발행 → **한 줄 선택 날짜** 출력
   - 발행하면 두 폰 앱 서재에 호가 보입니다(정상)
6. **5)** 끝내기: 창 닫기 → 시작 메뉴 새 창에서 환경 변수 셋 `False` → console Usage 금액 적기 → 키 **삭제**

중간에 `failure` · 멈춤 줄이 나오면 그 줄만(가려진 채로) PE에게.

## 2. PE에게 보낼 것

1. 자기 점검 집계 3칸(review 또는 하네스 끝 줄): **고른 다툼 · 화해 줄 수 / 그중 표시된 수 / 표시 없이 실린 수**
2. `recheck.md` · `summary.md`
3. 미리 보기에서 고른 기간(YYYY-MM)
4. **한 줄 선택 날짜 목록**(YYYY-MM-DD · 개수)
5. 두 폰 커플 1호 PDF(렌더 결과)
6. Usage 금액

## 3. PE 판정 기준

- **자기 점검**: "표시 없이 실린 다툼 · 화해 줄" = **0**이어야 통과. 0이 아니면 실제 커플 첫 호 전에 고침(PM 보고)
- **두 폰 커플 1호**: 최종 실측 체크리스트 5-2와 같음(다툰 날 · 진단 · 원문 3항목 반드시)
- **유성 확인 날짜**: 한 줄 선택 날짜 중 가장 이른 날 + 7일부터 유성이 떨어집니다. 이미 7일이 지났으면 **발행 바로 다음 하늘 화면부터**. PE가 날짜를 받아 그날의 **합친 폰 확인 목록**(유성 · C03 · 85- 7항목 · 84-e 폰 전용 5항목 · 가능하면 82- · 83-)을 드립니다
