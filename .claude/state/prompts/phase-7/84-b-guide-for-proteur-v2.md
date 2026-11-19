# Proteur 안내 — `84-b` 2차 실측 (R131-3 반영)

> 작성: 프롬프트 엔지니어 세션 / 2026-11-19 · 1차 안내서를 대신함
> **84-a2를 커밋한 뒤에** 진행합니다. 84-a2 보고에서 실행 명령이 바뀌었다고 하면, PE가 이 안내서의 해당 줄을 고쳐서 다시 드립니다.
>
> **복사하는 법**: 아래 명령은 앞에 빈칸이 있는 회색 줄입니다. **한 줄씩만** 복사해서 붙여 넣고 Enter를 누르세요. 앞의 빈칸은 같이 복사돼도 괜찮습니다. 줄 위아래에 있는 설명 글이나 기호는 복사하지 않습니다.

---

## 0. 준비

1. console.anthropic.com → API Keys → **Create Key**
   - 이름 예: `ondolog_84b2_2026_11`
   - **키는 실행할 때마다 새로 만들고, 끝나면 삭제합니다.**
   - 키는 복사 버튼으로만 옮깁니다. 채팅 · 메모장 · 파일에는 붙이지 않습니다.
2. **시작 메뉴**에서 PowerShell을 엽니다. VS Code나 Android Studio 안의 터미널, 다른 창에서 띄운 창은 쓰지 않습니다.
3. 맨 위 폴더로 갑니다.

        cd "C:\Users\sejun\OneDrive\바탕 화면\ONDOLOG\ondolog"

## 1. 키 넣기 (이 창 안에서만 살아 있음)

아래 줄을 붙여 넣고 Enter를 누르면 `key:`가 뜹니다. 키를 **오른쪽 클릭으로 붙여 넣고** Enter를 누르세요. 화면에 아무것도 안 보이는 게 정상입니다.

        $k = Read-Host -AsSecureString "key"

        $env:ONDOLOG_LLM_API_KEY = [System.Net.NetworkCredential]::new('', $k).Password; Remove-Variable k

        $env:ONDOLOG_LLM_API_KEY.StartsWith('sk-ant-')

→ **True**일 때만 다음으로 갑니다. False이면 창을 닫고 1부터 다시 합니다.

## 2. 실행 (Sonnet → Opus → review 순서)

        deno run --no-lock --config supabase/functions/deno.json --allow-env=ONDOLOG_LLM_API_KEY --allow-net=api.anthropic.com --allow-read=. --allow-write=scripts/ops/out scripts/ops/m1QualityRun.ts run --model claude-sonnet-5-5 --runs 3 --tag 84b

- 첫 줄에 `failure`가 나오면 **Ctrl+C로 멈추고**, 그 줄만 PE에게 보내 주세요. 키는 가려서 보냅니다.
- 끝까지 가면 다음 줄로 넘어갑니다.

        deno run --no-lock --config supabase/functions/deno.json --allow-env=ONDOLOG_LLM_API_KEY --allow-net=api.anthropic.com --allow-read=. --allow-write=scripts/ops/out scripts/ops/m1QualityRun.ts run --model claude-opus-5-5 --runs 3 --tag 84b

        deno run --no-lock --config supabase/functions/deno.json --allow-read=. --allow-write=scripts/ops/out scripts/ops/m1QualityRun.ts review

- 각 줄 끝의 `(누적 $… / 상한 $10)`을 보면 비용을 알 수 있습니다.
- "상한" 때문에 멈췄다는 줄이 나오면 그대로 PE에게 보내 주세요.

## 3. 끝내기

1. 이 PowerShell **창을 닫습니다**.
2. **시작 메뉴**에서 PowerShell을 새로 열고 확인합니다.

        [bool]$env:ONDOLOG_LLM_API_KEY

   → **False**
3. console에서 이번 키를 **삭제**합니다.

## 4. 판정 — `scripts/ops/out/review.md` (사람 칸만 채움)

| 칸 | 기준 | 반드시 |
|---|---|---|
| 사실 오류 | 입력에 **없는** 장소 · 날짜 · 숫자 · 사람이 문장에 나옴 | 0 |
| 원문 노출 위반 | 원문이 드러나면 안 되는 자리에 실림(기계 표시 참고) | 0 |
| 금지 표현 | 진단 · 평가 · 점수 · 순위 · 애착 유형 이름 · 잘잘못 · 편들기 · 훈수 | 0 |
| 말투 | 온도록이 쓴 문장이 **합니다체**인가(원문 인용은 제외) | 0 |
| 다시 쓰고 싶은 문장 | 어색 · 과장 · 뻔함 · 두 사람답지 않음 | 코너 · 실행당 1개 이하 |

- 통과: 반드시 0인 칸이 모두 0 + 다시 쓰고 싶은 문장 1개 이하 + 코너 빠짐이 9개 중 1개 이하
- 맨 끝 체크리스트(MASTER 3-7)도 같이 봅니다. 특히 다툰 날(09-16 · 09-17)은 실리지 않아야 합니다.

## 5. PE에게 보낼 것

1. 판정표(숫자만): 모델 · 실행 · 코너 · 사실 오류 · 원문 노출 · 금지 표현 · 말투 · 다시 쓰고 싶은 · 코너 빠짐 · R19-2 · 비용
2. `summary.md` 파일
3. 메인 세션 집계 답: 실측이 끝나면 아래 글을 메인 세션에 그대로 넣고, 받은 답을 보내 주세요.

        84-b 2차 실측이 끝났습니다. scripts/ops/out/ 의 이번 실행 결과(Sonnet 3회 · Opus 3회)를 읽기만 해서 숫자로 집계해 주세요. 코드 변경 0 · LLM 호출 0 · 원격 0 · 커밋 0. 보고에는 숫자만 넣고 생성 문장 · 원문은 넣지 않습니다.
        1) 모델 × 코너 × 실행별: 성공/빠짐 · 실제 보낸 호출 수 · 재요청 · 빠짐 사유별 횟수 — ① 길이 초과(어느 칸) ② 금지 표현(어느 단어 · 금지 뜻으로 쓰였는지, 뜻과 무관하게 걸린 오탐인지) ③ 형식 오류(stop_reason max_tokens 포함) ④ 시간 · 비용 정지 · R19-2 위반 수
        2) 임시 길이 3칸(맞춤 질문 60 · 근거 100 · 소기사 본문 240)과 나머지 길이 칸의 실제 글자 수 분포(최소 · 중간 · 최대 · 상한 넘은 수)
        3) 모델별 토큰(입력 · 출력(사고 포함) · 캐시 쓰기 · 캐시 읽기) · 캐시 적중률 · 호출당 지연(최소 · 중간 · 최대) · 비용(실행별 · 모델별 · 합계, USD)
        4) review.md의 자동 표시(원문 노출 기계 표시) 건수
