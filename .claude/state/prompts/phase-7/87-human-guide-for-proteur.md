# 87- Proteur 할 일 — 커밋 · db push · 함수 배포 · 확인 질의 (11/23)

순서: **1 커밋 → 2 db push 미리 보기 → 3 db push → 4 함수 배포 → 5 예약 확인 질의 → 6 월요일 새 질의(시험 삼아 1번)**
명령은 한 줄씩 붙여 넣고 Enter를 눌러요. 한 줄이 끝나고 다음 줄 입력 표시(`PS ...>`)가 다시 나오면 다음 줄로 가요.
이번에는 키를 넣는 단계가 없어요. 빌드 · 설치 · 폰 확인도 없어요(앱 코드 변경 0).

---

## 0. 창 준비

1. 시작 메뉴에서 PowerShell을 새로 열어요.
2. 저장소 맨 위 폴더로 가요.

        cd "C:\Users\sejun\OneDrive\바탕 화면\ONDOLOG\ondolog"

3. 지금 바뀐 파일 목록을 봐요.

        git status --short

   - 정상: 아래 13개 안팎이 보여요(` M`은 고친 파일, `??`는 새 파일).
     `supabase/migrations/20261123120000_m1_push_daily.sql` · `__tests__/db/pushDaily87m1.test.ts` · `__tests__/db/retentionUnschedule76m2.test.ts` · `supabase/functions/_shared/pushSend.ts` · `supabase/functions/_shared/pushSend.test.ts` · `supabase/functions/push-send/index.ts` · `scripts/ops/purgeWithdrawn.ts` · `scripts/ops/purgeWithdrawn.test.ts` · `web/src/vitestSetup.ts` · `web/src/vitestNetGuard87.vitest.ts` · `web/src/features/feed/feedCache76.vitest.tsx` · `.claude/state/HANDOFF.md` · `.claude/state/PROGRESS.md`
   - 85-b 파일(`web/src/features/sky/...`)도 보이면, 85-b 커밋을 아직 안 한 거예요. 이 안내 1번 전에 지난번 85-b 커밋부터 해 주세요.
   - `supabase/functions/deno.lock`이 보이면 메인 세션이 지웠다고 했던 파일이에요. 커밋하지 말고 PE에게 알려 주세요.

---

## 1. 커밋 4개 (메인 세션이 준 그대로)

### 1-1. DB 표

    git add supabase/migrations/20261123120000_m1_push_daily.sql

    git add __tests__/db/pushDaily87m1.test.ts

    git add __tests__/db/retentionUnschedule76m2.test.ts

    git commit -m "feat(db): 87- 알림 날짜별 숫자 표 push_daily · pg_net 응답 1시간 세기"

### 1-2. 함수 · 정리 스크립트

    git add supabase/functions/_shared/pushSend.ts

    git add supabase/functions/_shared/pushSend.test.ts

    git add supabase/functions/push-send/index.ts

    git add scripts/ops/purgeWithdrawn.ts

    git add scripts/ops/purgeWithdrawn.test.ts

    git commit -m "feat(ops): 87- push-send 날짜별 숫자 기록 · 알림 숫자 90일 정리"

### 1-3. 시험 환경 원격 막기

    git add web/src/vitestSetup.ts

    git add web/src/vitestNetGuard87.vitest.ts

    git add web/src/features/feed/feedCache76.vitest.tsx

    git commit -m "fix(web): 87- 시험 환경 원격 0 - 접속 값 비움 · fetch 그물"

### 1-4. 문서

    git add .claude/state/HANDOFF.md

    git add .claude/state/PROGRESS.md

    git commit -m "docs(ops): 87- 결정 기록 · 월요일 8번 SQL 질의 · 로그 7일 정정"

### 1-5. 확인

    git log --oneline -6

- 정상: 위에서부터 docs(ops) 87- → fix(web) 87- → feat(ops) 87- → feat(db) 87- 순서로 4줄이 보여요. 그 아래 어딘가(85-b 줄 아래)에 **"docs: ROADMAP r148"** 줄이 보여야 해요.

    git status --short

- 정상: 아무것도 안 나와요. 무언가 남으면 그 목록만 PE에게 보내 주세요(값이 아니라 파일 이름이라 보내도 돼요).

---

## 2. db push 미리 보기 (실제로는 안 바뀜)

    npx supabase db push --dry-run

- 정상: 올라갈 마이그레이션 목록에 **`20261123120000_m1_push_daily.sql` 한 줄만** 나와요. "Would push these migrations" 같은 문장 아래에 보여요.
- 다른 파일 이름이 하나라도 더 보이거나, 하나도 안 보이면 **멈추고** 그 화면 글자를 PE에게 보내 주세요(파일 이름만 있고 비밀 값은 없어요).
- 화면에 접속 주소나 프로젝트 ref가 찍혀 있으면 그 부분은 지우고 보내 주세요.

## 3. db push (실제로 올림)

    npx supabase db push

- 한 번 더 목록이 나오고 `Do you want to push these migrations to the remote database?` 같은 질문이 나와요. 목록이 2번과 같은 **한 줄**인지 다시 보고 `Y`를 누르고 Enter.
- 비밀번호를 물으면 평소 db push 때와 똑같이 넣어요(입력해도 화면에 안 보이는 게 정상).
- 정상: `Applying migration 20261123120000_m1_push_daily.sql...` 다음에 `Finished supabase db push.`가 나와요.
- 빨간 `ERROR`가 나오면 멈추고, 오류 문장만 PE에게 보내 주세요.

올라갔는지 확인해요.

    npx supabase migration list

- 정상: 맨 아래 줄에 `20261123120000`이 **Local과 Remote 두 칸 모두에** 보여요.

## 4. 함수 배포

    npx supabase functions deploy push-send --no-verify-jwt

- `--no-verify-jwt`는 꼭 붙여요. push-send는 처음부터 이 방식으로 배포했어요(HANDOFF의 push-send 배포 명령과 같아요). 빠뜨리면 DB가 보내는 알림 요청이 401로 막혀요.
- 정상: `Deployed Functions on project ...: push-send` 같은 줄이 나와요. 이 줄에 프로젝트 ref가 같이 찍히는데, **그 줄은 PE에게 보내지 마세요.** "배포 됨"만 알려 주면 돼요.

---

## 5. 예약 확인 질의 (Supabase 웹 화면)

1. 브라우저에서 Supabase 대시보드에 들어가 온도록 개발 프로젝트를 열어요(11/23 첫 정리 때 오류 표를 본 그 프로젝트).
2. 왼쪽 메뉴에서 **SQL Editor**를 눌러요.
3. 위쪽의 **+ (New query)**를 눌러 빈 칸을 만들어요.
4. 아래 한 줄을 붙여 넣고 오른쪽 아래 **Run**(또는 Ctrl+Enter)을 눌러요.

        select jobname, schedule, active from cron.job order by jobname;

5. 아래 결과 칸에 **3줄**이 나와야 해요.

   | jobname | schedule | active |
   |---|---|---|
   | execute-dissolutions | (그대로) | true |
   | expire-stories | (그대로) | true |
   | **push-net-count** | **7 \* \* \* \*** | **true** |

   - `push-net-count`가 없거나 `active`가 false면 멈추고 PE에게 알려 주세요.
   - 이 결과에는 비밀 값이 없어서 화면 캡처를 보내도 돼요.

## 6. 월요일 새 질의 (지금 시험 삼아 1번)

같은 SQL Editor에서 새 칸(+)을 열고 붙여 넣고 Run.

    select day, kind, status, count from public.push_daily
    where day >= (now() at time zone 'Asia/Seoul')::date - 6 order by day, kind, status;

- 지금은 **0줄(No rows)이 정상**이에요. 방금 표를 만들었고 그 뒤로 알림이 안 나갔기 때문이에요.
- 오류(`relation "public.push_daily" does not exist`)가 나면 3번 db push가 안 된 거예요. PE에게 알려 주세요.
- 표에 숫자가 실제로 쌓이는지는 C2(두 폰 진행) 때 알림 1번을 보내고 이 질의로 봐요. 함수 안에서 센 것은 바로, DB가 센 것(`http_200` 등)은 매시 7분에 들어와요.

---

## 끝나면 PE에게 보낼 것 (짧게)

1. `git status --short` 결과(비었음 / 남은 목록)
2. dry-run 목록이 한 줄이었는지
3. db push · 배포 됨 / 안 됨
4. 5번 결과 3줄 맞음 / 다름
5. 6번 0줄 / 오류

## 다음 월요일(11/30)부터 달라지는 점

- 월요일 점검 8번(옛 Logs 화면 보기)은 **6번 질의 하나**로 바뀌어요.
- 결과에서 `sent` · `http_200` · `no_tokens` · `ring` · `collapse` 말고 다른 status 줄이 있으면 **그 status 이름과 건수만** PE에게 보내 주세요. (`dropped`는 지워진 기기 토큰을 정리한 것이라 가끔 있어도 괜찮지만, 그래도 건수는 알려 주세요.)
- purgeWithdrawn 미리 보기에 "알림 숫자 90일" 줄이 하나 새로 생겨요. 처음 몇 달은 0이 정상이에요.
