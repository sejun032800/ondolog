# Proteur 안내 — C3 시험 계정 정리 실행 (+ 그 전에 90- 두 폰 확인)

> 작성: 프롬프트 엔지니어 세션 / 2026-11-24 · 원문: HANDOFF "C3 정리" 절(91-)을 한 줄씩 풀어 씀 · ROADMAP r153 R153-2 · R153-3
> 순서: **0부 커밋 → 1부 사전 숫자 확인(읽기) → 2부 90- 두 폰 확인(덮어 설치) → 3부 C3 미리 보기 → PE 확인 → 4부 apply → 5부 확인 질의 → 6부 허용 목록 정리**
> 키 · 주소 · 이메일 값은 PE에게 보내지 않아요. 숫자 · 종류 줄만 보내요.

---

## 0부 — 90- · 91- 커밋 (저장소 맨 위 · 블록째 붙여 넣어도 됨)

    git add web/src/features/settings/useDissolutionNotice.ts web/src/features/settings/CoupleScreen.tsx web/src/platform/useChatComposer.ts
    git add web/src/features/settings/dissolutionNotice90.vitest.tsx web/smoke/entry.tsx web/smoke/screens.smoke.ts
    git commit -m "fix(web): 90- 해제 받은 쪽 유예 화면 한 번 - 앱이 켜진 동안 상태 변경에도"

    git add .claude/state/HANDOFF.md .claude/state/PROGRESS.md
    git commit -m "docs(ops): 90- 결정 기록 · 91- C3 정리 절"

    git log --oneline -4

→ 위에서부터 "docs(ops): 90- …", "fix(web): 90- …"이 보이면 돼요.

    git status --short

→ 비어 있으면 끝이에요. 남는 줄이 있으면 목록만 보내 주세요.

---

## 1부 — 사전 숫자 확인 (Supabase SQL Editor · 읽기만)

1. Supabase 대시보드 → 온도록 **개발** 프로젝트 → 왼쪽 **SQL Editor** → **+**
2. **Q0** — `demo_responses` 수(나중에 대조용):

        select count(*) as demo_responses from public.demo_responses;

   → 숫자를 적어 둬요.
3. 새 칸(+)에 **Q1**을 붙여 넣고 Run:

        select
          (select count(*) from auth.users where email like 'test-m2b-%@example.com') as seed_users,
          (select count(*) from auth.users where email like 'test-%@example.com' and email not like 'test-m2b-%') as other_test_users,
          (select count(*) from auth.users where email is null or email not like 'test-%@example.com') as non_test_users,
          (select count(*) from public.couples where nickname like 'test-m2b-%') as seed_couples,
          (select count(*) from public.couples where nickname is null or nickname not like 'test%') as non_test_couples,
          (select count(*) from public.demo_responses) as demo_responses;

4. 지금(정리 전) 기대값:
   - `seed_users`: 10 안팎(시드 A · B · C · F · G 두 명씩)
   - `non_test_users`: **2**(두 폰 카카오 계정). **3 이상이면 멈추고 알려 주세요** — 모르는 실제 사용자가 있을 수 있어요
   - `other_test_users`: 범위 밖 시험 계정 수(PM 결정 대상)
5. **여섯 숫자를 그대로 보내 주세요.** 여기서 2부로 넘어가도 돼요(읽기만 했으니 기다릴 필요 없음).

---

## 2부 — 90- 두 폰 확인 (C3으로 두 폰 계정을 지우기 **전에** 해야 해요)

### 2-0. 덮어 설치

    subst O: "C:\Users\sejun\OneDrive\바탕 화면\ONDOLOG\ondolog"

    cd O:\web

    npx cap open android

Android Studio에서 **S21 ▶ Run** → **V40 ▶ Run**(앱 지우지 않음). 끝나면 맨 위 폴더에서 `git status --short` — `web/android/app/build.gradle`이 보이면 `git checkout -- web/android/app/build.gradle`.

### 2-1 ~ 2-5 (폰 A = 요청하는 쪽, 폰 B = 받는 쪽)

| # | 할 일 | 정상 |
|---|---|---|
| 2-1 | B를 **메인 탭에 켜 둔 채** A가 설정 → 연결 해제 → `해제합니다` → [해제 요청하기]. B에서 **탭을 한 번 바꾸거나**, 폰을 잠갔다 풀어요 | B에 H14 유예 화면이 **한 번** 떠요 |
| 2-2 | B에서 H14를 뒤로 닫고, 홈으로 나갔다 앱으로 돌아오기를 두 번 | **다시 뜨지 않아요** |
| 2-3 | A가 [취소]로 해제를 되돌려요. B는 바탕에 갔다 돌아와요 | B 설정 → 커플 화면이 **연결 상태**(커플 카드 · 날짜 · 별명)로 보이고 유예 카드가 없어요 |
| 2-4 | B 채팅 입력칸에 "보내지 않은 글"을 **치기만** 하고 보내지 않아요 → A가 다시 해제 요청 → B에서 탭을 바꿔요 | H14가 한 번 떠요 → 뒤로 가면 채팅은 잠긴 상태 → A가 [취소] → B가 바탕에 갔다 돌아와 채팅을 열면 **입력칸에 "보내지 않은 글"이 그대로** |
| 2-5 | B에서 데이트 기록 시트(사진 · 메모 쓰는 창)를 연 채로 A가 해제 요청 → B에서 잠갔다 풀기 | 시트가 열려 있는 동안은 **H14가 안 떠요** → 시트를 닫는 순간 **한 번** 떠요. 끝나면 A가 [취소] |

- **⛔ A의 [취소]가 안 되면 그 자리에서 멈추고 바로 알려 주세요**(7일 뒤 배치가 지워요).
- 끝나면 두 폰 모두 설정에 **유예 표시가 없는지** 봐요.
- 녹화는 안 해도 돼요. 결과는 "2-1~2-5 다 정상" 또는 "2-n 이상 + 한 줄".

---

## 3부 — C3 미리 보기 (아무것도 지우지 않음)

### 3-0. 허용 목록에 시드 10줄 더하기

1. PowerShell에서 실행해요(메모장이 열려요).

        notepad "$env:USERPROFILE\.ondolog\reset-allowlist.txt"

2. **맨 아래**에 아래 10줄을 붙여 넣어요. 위에 있는 `project=` 줄과 두 폰 이메일 줄은 **그대로** 둬요.

        test-m2b-a1@example.com
        test-m2b-a2@example.com
        test-m2b-b1@example.com
        test-m2b-b2@example.com
        test-m2b-c1@example.com
        test-m2b-c2@example.com
        test-m2b-f1@example.com
        test-m2b-f2@example.com
        test-m2b-g1@example.com
        test-m2b-g2@example.com

   (붙여 넣을 때 앞 공백은 빼고 줄마다 이메일만 있게 해요.)
3. **파일 → 저장**(Ctrl+S) → 메모장을 닫아요. 인코딩을 물으면 UTF-8.

### 3-1. 새 창 · 값 넣기 · 확인

1. 시작 메뉴에서 PowerShell을 **새로** 열고 저장소 맨 위로 가요.

        cd "C:\Users\sejun\OneDrive\바탕 화면\ONDOLOG\ondolog"

2. 주소 → 입력 칸에 **오른쪽 클릭**으로 개발 프로젝트 주소(끝에 `/rest/v1/` 없음):

        $env:ONDOLOG_SUPABASE_URL = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString)).Password

3. 키 → **`ops_2026_11`**:

        $env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString)).Password

4. 확인 줄 — 하나씩 쳐서 모두 **True**:

        $env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY.StartsWith('sb_secret_')

        $env:ONDOLOG_SUPABASE_URL.StartsWith('https://')

        $env:ONDOLOG_SUPABASE_URL.EndsWith('.supabase.co')

   (셋째가 False면 `$env:ONDOLOG_SUPABASE_URL = ([Uri]$env:ONDOLOG_SUPABASE_URL).GetLeftPart('Authority')` 후 다시 확인)

5. 변수 정하기 · 확인:

        $h = ([Uri]$env:ONDOLOG_SUPABASE_URL).Host

        $al = Join-Path $env:USERPROFILE '.ondolog\reset-allowlist.txt'

        Test-Path $al

   → True.

6. 두 폰 이메일(입력이 화면에 보이지만 명령 기록에는 남지 않아요):

        $e1 = Read-Host '폰 A 카카오 이메일'

        $e2 = Read-Host '폰 B 카카오 이메일'

### 3-2. 미리 보기 — 묶음 ① 두 폰 커플

    deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_RESET_ALLOWLIST,USERPROFILE,HOME --allow-net=$h --allow-read="supabase/.temp/linked-project.json,$al" scripts/ops/resetTestAccount.ts $e1 $e2 --with-issues

### 3-3. 미리 보기 — 묶음 ② · ③ 시드 다섯 커플 (한 줄)

    foreach ($k in 'a','b','c','f','g') { "== 시드 커플 $($k.ToUpper())"; deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_RESET_ALLOWLIST,USERPROFILE,HOME --allow-net=$h --allow-read="supabase/.temp/linked-project.json,$al" scripts/ops/resetTestAccount.ts "test-m2b-${k}1@example.com" "test-m2b-${k}2@example.com" --with-issues }

- 정상: 여섯 묶음 모두 "미리 보기(커플 모드, 지우지 않음)" + 종류별 건수 + `auth 사용자: 2`
- 대략 기대: A · B 각 메시지 302 · 기록 18 · 데이트 4 / C 호 1 / F 호 4 · 경보 1 / G 메시지 302 · 발행 호 1(생성 · 발행으로 더 늘었을 수 있음)
- "거부: …"가 나오면 그 문장만 보내요.

### 3-4. 여기서 멈춤 → PE 확인

- 보낼 것: 3-2 · 3-3의 **"== 시드 커플 X" 줄과 종류 · 건수 줄**(이메일이 보이는 줄은 지우고)
- **창은 닫지 말고 그대로 둬요.**
- PE가 **"진행"**이라고 하면 4부로 가요.

---

## 4부 — apply (PE "진행" 뒤에만 · 같은 창)

    deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_RESET_ALLOWLIST,USERPROFILE,HOME --allow-net=$h --allow-read="supabase/.temp/linked-project.json,$al" scripts/ops/resetTestAccount.ts $e1 $e2 --with-issues --apply

    foreach ($k in 'a','b','c','f','g') { "== 시드 커플 $($k.ToUpper())"; deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_RESET_ALLOWLIST,USERPROFILE,HOME --allow-net=$h --allow-read="supabase/.temp/linked-project.json,$al" scripts/ops/resetTestAccount.ts "test-m2b-${k}1@example.com" "test-m2b-${k}2@example.com" --with-issues --apply }

- 정상: 여섯 묶음 모두 "실행(커플 모드): 지운 수" · 미리 보기와 같은 건수 · 끝 줄 "완료"
- "중단: …"이 나오면 그 줄만 보내요(같은 명령을 다시 쳐도 남은 것만 지워서 안전하지만, PE 확인 뒤에).
- 끝나면 **창을 닫고**, 새 창에서:

        [bool]$env:ONDOLOG_SUPABASE_SERVICE_ROLE_KEY; [bool]$env:ONDOLOG_SUPABASE_URL

  → False 두 줄.

---

## 5부 — 확인 질의 (SQL Editor · 읽기만)

1. **Q1 다시**(1부와 같은 질의) → 정상: `seed_users` 0 · `non_test_users` 0 · `seed_couples` 0 · `demo_responses` = 1부 Q0 숫자 · `other_test_users`는 1부와 같은 수(PM 결정 전까지 남김)
2. **Q2** — 표별 남은 행:

        select t, n from (
          select 'profiles' t, count(*) n from public.profiles union all
          select 'couples', count(*) from public.couples union all
          select 'issues', count(*) from public.issues union all
          select 'corners', count(*) from public.corners union all
          select 'messages', count(*) from public.messages union all
          select 'data_entries', count(*) from public.data_entries union all
          select 'stories', count(*) from public.stories union all
          select 'dates', count(*) from public.dates union all
          select 'date_stops', count(*) from public.date_stops union all
          select 'couple_dissolutions', count(*) from public.couple_dissolutions union all
          select 'ops_alerts', count(*) from public.ops_alerts union all
          select 'personality_profiles', count(*) from public.personality_profiles union all
          select 'personality_assessments', count(*) from public.personality_assessments union all
          select 'push_tokens', count(*) from public.push_tokens union all
          select 'notification_settings', count(*) from public.notification_settings union all
          select 'demo_responses (남김)', count(*) from public.demo_responses union all
          select 'push_daily (남김)', count(*) from public.push_daily union all
          select 'app_error_daily (남김)', count(*) from public.app_error_daily
        ) x order by t;

3. **Q3** — Storage 버킷별 남은 파일:

        select bucket_id, count(*) as n from storage.objects group by bucket_id order by bucket_id;

- 정상(`other_test_users`가 0일 때): Q2의 `(남김)` 세 줄 밖은 모두 0 · Q3은 행 0. `other_test_users`가 0이 아니면 그 계정들 몫이 남는 것이 정상이에요.
- **Q1 · Q2 · Q3 결과(숫자)를 보내 주세요.** 캡처도 괜찮아요(이름 · 이메일 칸이 없어요).

---

## 6부 — 허용 목록 정리 · 확인

### 6-1. 정리

1. 실행:

        notepad "$env:USERPROFILE\.ondolog\reset-allowlist.txt"

2. **`project=`로 시작하는 줄만 남기고 이메일 줄을 모두 지워요** — 두 폰 이메일(**특히 Proteur 본인 카카오 이메일은 반드시**)과 3-0의 시드 10줄.
3. 저장(Ctrl+S) → 닫기.

### 6-2. 확인 (새 창 · **키는 넣지 않아요** — 잠금은 접속 전에 판정)

1. 시작 메뉴 새 PowerShell → `cd "C:\Users\sejun\OneDrive\바탕 화면\ONDOLOG\ondolog"`
2. 주소만 넣어요:

        $env:ONDOLOG_SUPABASE_URL = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString)).Password

        $h = ([Uri]$env:ONDOLOG_SUPABASE_URL).Host

        $al = Join-Path $env:USERPROFILE '.ondolog\reset-allowlist.txt'

        $e1 = Read-Host '폰 A 카카오 이메일'

        $e2 = Read-Host '폰 B 카카오 이메일'

3. 세 번 확인(한 줄):

        foreach ($e in @($e1, $e2, 'test-m2b-a1@example.com')) { deno run --no-check --no-lock --unstable-sloppy-imports --config supabase/functions/deno.json --allow-env=ONDOLOG_SUPABASE_URL,ONDOLOG_SUPABASE_SERVICE_ROLE_KEY,ONDOLOG_RESET_ALLOWLIST,USERPROFILE,HOME --allow-net=$h --allow-read="supabase/.temp/linked-project.json,$al" scripts/ops/resetTestAccount.ts $e }

   → 정상: 세 번 모두 **`거부: 허용 목록에 없는 이메일이다`**. 다른 거부 문장(예: "project= 줄이 없다")이면 6-1에서 `project=` 줄까지 지운 것 — 메모장으로 되살려요(값은 PE가 모르니 51-③ 때 적은 줄 그대로).
4. 창을 닫고 새 창에서 `[bool]$env:ONDOLOG_SUPABASE_URL` → False.

**6부 끝나면 보낼 것**: "거부 3번 · False" 한 줄.

이걸로 C3이 끝나요(범위 밖 시험 계정은 PM 결정에 따라 따로).
