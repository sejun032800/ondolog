# 메인 세션에 붙여 넣을 승인 문장 — 2.0-D 덧붙임 (PM r159 · R159-2 · R159-5)

먼저 할 것: `interview-question-pool-r157.md`를 저장소 `docs/magazine-2-0/` 폴더에 끌어다 놓습니다.
그다음 아래 상자 안을 **통째로 복사해서** 2.0-D 보고가 나온 같은 메인 세션 창에 붙여 넣습니다.

```
PM 승인(ROADMAP r159) — 2.0-D 덧붙임. 시작 전에 ROADMAP DOC_REVISION r159 · MASTER r86인지 확인(아니면 한 줄로 알려 줘). 2.0-D 커밋이 들어왔는지도 git log로 확인.

1) 어림짐작 12주제(R159-2): 1~9 · 11은 그대로. 10 · 12만 바꿈.
   10 = title「처음 가는 동네에서」 · phrase "골목으로 먼저 들어가 볼 확률"
   12 = title「비 오는 주말」 · phrase "집에서 볼 영화를 고를 확률"
   지면 꼴은 "{이름}님이 {phrase} {n}%쯤"(R159-2 — "쯤" 유지). 지금 출력에 "쯤"이 붙는지 확인하고, 없으면 붙여 줘.
   시험: 12주제 문자열 고정 · 겹침 없음.

2) 어림짐작 짐작 2번 라벨(R158-10 수락분): "갈등 회피 지수" → "한발 먼저 물러서는 쪽". 표시 이름만, 계산 그대로.
   (리그 ATT "애정 확인"은 A2에서 — 이번에 손대지 않음)

3) 정정 4(R158-8 ③): 승인된 인터뷰 풀 원문을 docs/magazine-2-0/interview-question-pool-r157.md에 넣었음(R157-9 승인본).
   - render/issue/pages/interview.html:43 견본 질문("혼자 있고 싶을 때…")을 풀 안의 질문 하나로 바꿔 줘. 틀 문구는 그 한 곳만. 바꾼 줄을 보고.
   - 렌더 견본 데이터 · 시험 fixture에 인터뷰 질문이 있으면 모두 풀 문장으로. 풀 밖 질문이 견본에 0인지 시험 하나.
   - 보드 그림(L01~L04)은 그대로(다음 디자인 묶음 정정 항목으로 HANDOFF에 기록).

4) zip 추적 해제(R151-3 "zip 커밋 0"):
   - git ls-files "*.zip"로 추적 중인 zip을 모두 찾아 목록으로 보고.
   - 루트 .gitignore가 .claude/state/prompts/ 아래 zip을 무시하는지 git check-ignore -v로 확인하고, 아니면 한 줄 더함.
   - 커밋 명령에 git rm --cached --quiet "<경로>"를 zip마다 한 줄씩 넣어 줘(로컬 파일은 남음). 히스토리 재작성은 하지 않음.

5) 보고에 꼭 넣을 것:
   ① 애착 짝 문장 ATTACHMENT_PAIR_LABELS 10개 원문(조합 → 문장 표 · PM 승인용)
   ② 위 1~4의 파일:줄 · 시험 이름
   ③ 검증 숫자(jest · 렌더 시험 · gate)
   ④ 커밋 명령: git add 경로 하나씩(docs/magazine-2-0/interview-question-pool-r157.md 포함) · 메시지 "feat(engine): r159 어림짐작 10·12 교체 · 짐작 2번 라벨 · 인터뷰 견본 풀 질문 · zip 추적 해제" · 끝에 git log --oneline -4 · git status --short
```
