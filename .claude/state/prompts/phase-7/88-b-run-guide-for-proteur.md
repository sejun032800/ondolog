# Proteur 안내 — 88-b 읽기 전용 로컬 렌더 2번 (C2 2부 · 초기화 전에)

> 작성: 프롬프트 엔지니어 세션 / 2026-11-24 · 원문: HANDOFF "88-b 실행 명령"(22~59줄) 그대로, 한 줄씩 풀어 씀
> 이 작업은 **원격에 아무것도 쓰지 않아요**(읽기만). LLM도 0이에요. 결과 파일은 저장소 밖 `%USERPROFILE%\ondolog-local-render\`에만 생겨요.
> 명령은 한 줄씩 붙여 넣고 Enter를 눌러요. 다음 입력 표시(`PS ...>`)가 다시 나오면 다음 줄로 가요.

---

## 1. 창 준비 · 키 넣기

1. 시작 메뉴에서 PowerShell을 **새로** 열어요.
2. 저장소 맨 위로 가요.

        cd "C:\Users\sejun\OneDrive\바탕 화면\ONDOLOG\ondolog"

3. 한글이 깨지지 않게 해요(화면에 아무것도 안 나와요).

        [Console]::OutputEncoding = [Text.Encoding]::UTF8

4. 출력에 id · 이메일이 섞여도 가려 주는 함수를 만들어요(화면에 아무것도 안 나와요).

        function m { process { "$_" -replace '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}','<id>' -replace '[\w.+-]+@[\w-]+\.[\w.-]+','<email>' } }

5. 접속 주소를 넣어요. 입력 칸이 나오면 **마우스 오른쪽 클릭**으로 붙여 넣고 Enter를 눌러요(글자는 안 보이는 게 정상).

        $env:ONDOLOG_SUPABASE_URL = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString)).Password

   → **개발 프로젝트 주소**를 넣어요(`https://…supabase.co`, 끝에 `/rest/v1/` 없음).

6. 키를 넣어요. 이번에는 렌더용 secret key **`render_2026_11`**이에요. `ops_2026_11`이 아니에요.

        $env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString)).Password

7. 확인 세 줄. **모두 True**여야 다음으로 가요.

        $env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY.StartsWith('sb_secret_')

        $env:ONDOLOG_SUPABASE_URL.StartsWith('https://')

        $env:ONDOLOG_SUPABASE_URL.EndsWith('.supabase.co')

   - 셋째 줄이 False면 아래 한 줄을 실행하고 셋째 줄을 다시 확인해요(11/23 첫 정리 때와 같은 경우예요).

            $env:ONDOLOG_SUPABASE_URL = ([Uri]$env:ONDOLOG_SUPABASE_URL).GetLeftPart('Authority')

8. 결과를 놓을 폴더 이름을 변수에 담아요(화면에 아무것도 안 나와요).

        $out = Join-Path $env:USERPROFILE 'ondolog-local-render'

---

## 2. 그릴 호 두 개 고르기 (id는 화면에 안 찍혀요)

1. 발행 때 남은 결과 파일들을 읽어요.

        $pub = Get-ChildItem scripts\ops\out\publish-*.json | Sort-Object LastWriteTime | ForEach-Object { Get-Content $_ -Raw -Encoding UTF8 | ConvertFrom-Json }

2. 시드 G 커플을 찾아요.

        $gcid = ((Get-Content scripts\ops\out\seed-m2b-2025.json -Raw -Encoding UTF8 | ConvertFrom-Json).couples | Where-Object { $_.label -eq 'G' -and $_.nickname -eq 'test-m2b-G' }).id

3. G 1호(2025년 9월호)를 골라요.

        $gid = @($pub | Where-Object { $_.issue.couple_id -eq $gcid -and $_.issue.period_start -like '2025-09*' })[-1].issueId

4. 두 폰 11월호(2026년 11월호 중 가장 최근)를 골라요.

        $pid2 = @($pub | Where-Object { $_.issue.period_start -like '2026-11*' })[-1].issueId

5. 둘 다 골랐는지 확인해요.

        [bool]$gid; [bool]$pid2

   → **True가 두 줄** 나와야 해요.
   - 하나라도 False면 멈추고 "2-5에서 False(몇째 줄)"라고만 알려 주세요.
   - 빨간 오류(파일을 찾을 수 없음 등)가 나면 그 오류 첫 줄만 보내 주세요. 경로에 이메일 · id는 없어요.

---

## 3. 렌더 두 번

1. G 1호를 그려요. 1~3분쯤 걸려요.

        render\.venv\Scripts\python.exe render\render_issue.py --local-only --issue-id $gid --out "$out\g1" 2>&1 | m

2. 두 폰 11월호를 그려요.

        render\.venv\Scripts\python.exe render\render_issue.py --local-only --issue-id $pid2 --out "$out\phone-nov" 2>&1 | m

- 정상: 렌더마다 **숫자 요약 한 줄**이 나와요. `pageCount` · `publishedPageCount` · `timelinePages` · `quotePages` · `quotesShown` · `notUsedLines` · `coverHeadlineFrom` · `coverQuoteRemoved` · `renderFeedback` · `originalOverset` · `originalClipped` · `seconds`가 들어 있어요.
- **이 두 줄을 그대로 PE에게 보내 주세요.** 숫자와 이름뿐이라 보내도 돼요. `<id>` · `<email>`로 가려진 부분이 있으면 그대로 두면 돼요.
- 멈추면 `멈춤: <종류>` 한 줄이 나와요. 그 한 줄만 보내 주세요.

**PE가 볼 곳**
- `renderFeedback`: 되받기가 몇 번 돌았는지예요.
- `originalOverset`: 되받기 전 처음 그림에서 넘친 것이에요. 발행된 옛 호에도 같은 넘침이 있었는지 보는 단서예요.
- `pageCount`와 `publishedPageCount`: 새로 그린 쪽 수와 발행된 쪽 수예요. 차이가 나는지 봐요.

---

## 4. 눈으로 보기 (PE에게 보내지 않아요)

1. 두 PDF를 열어요.

        Invoke-Item "$out\g1\issue.pdf"

        Invoke-Item "$out\phone-nov\issue.pdf"

2. 볼 것:
   - 제목과 본문이 **낱말 중간에서 끊기지 않는지**(v1.2.4)
   - 넘치거나 잘린 글이 없는지
   - 표지 아래가 "이 달의 말 · 이름" 한 줄인 경우가 있는지(표제와 인용이 같을 때만 그래요)
3. 휴지통에서 옛 `render\out`을 찾았다면, 그 안의 옛 PDF와 쪽 수 · 표지 · 근거 줄을 눈으로 비교해요.
4. 결과는 "눈으로 봐도 이상 없음" 또는 "n쪽에 이런 점" 한 줄로 알려 주세요. PDF 파일은 보내지 않아요.

---

## 5. 끝내기

1. 이 PowerShell 창을 **닫아요**(창 안에 키가 남아 있어요).
2. 시작 메뉴에서 새 PowerShell을 열고 실행해요.

        [bool]$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY; [bool]$env:ONDOLOG_SUPABASE_URL

   → **False가 두 줄** 나와야 해요.
3. `%USERPROFILE%\ondolog-local-render` 폴더는 PM 판정이 끝날 때까지 그대로 둬요. 지우는 시점은 따로 알려 드릴게요.

---

## PE에게 보낼 것

1. 3번의 숫자 요약 두 줄(또는 `멈춤: …` 한 줄)
2. 4번 눈으로 본 결과 한 줄
3. 5번 False 두 줄 확인

이게 끝나면 **C2 3부(초기화)**로 가요.
