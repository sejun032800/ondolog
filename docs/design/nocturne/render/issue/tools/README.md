# `tools/` — 참고용. 조판에는 쓰이지 않는다

디자인 세션이 v1.1을 검증할 때 쓴 스크립트다. **지면 HTML은 이것들 없이 동작한다**
(지면에는 JS가 없다). 개발의 채움 모듈이 같은 결과를 내는지 대조하는 데만 쓴다.
실행 환경이 달라 그대로 돌지 않아도 괜찮다.

| 파일 | 하는 일 |
|---|---|
| `resolve.js` | **슬롯 해석기.** 계약을 `variant` → `repeat` → `if` → `optional` 순으로 적용한다. 개발 채움 모듈의 기준 구현으로 보면 된다 |
| `audit.py` | **지면 감사기.** 종이 밖 넘침 · **판면 초과**(`overset`) · 형제 겹침 · 저대비 · 과소 활자 |
| `preview.py` | 13지면 × 6테마 미리보기 PNG |
| `sweep.py` | 변형과 배열 길이를 바꿔 가며 쓸어보는 검사 |

## 꼭 보셔야 할 두 가지

**① `resolve.js`의 처리 순서.** 이 순서를 어기면 조용히 틀립니다.
`repeat`이 먼저면 지워질 변형 안에서도 항목이 복제되고, `if`가 나중이면
`optional` 판정이 이미 지워질 가지의 빈 슬롯에 걸립니다.
실제로 `if`를 빠뜨려 메모와 AI 캡션이 함께 그려졌고, stop마다 52px이 더 붙어
타임라인 분할 판정이 통째로 어긋났습니다.

**② `audit.py`의 `overset` 검사.** 종이(1123px)에 들어가는 것과 판면(953px)에
들어가는 것은 다릅니다. `getBoundingClientRect`만 보면 판면을 넘고 폴리오를 덮는
지면이 통과합니다. 상자의 `scrollHeight > clientHeight`로 따로 봅니다.

```
python3 tools/audit.py     # 13지면 × 6테마
python3 tools/sweep.py     # 변형·배열 길이 쓸기
python3 tools/preview.py   # 미리보기 PNG
```

경로는 `/home/claude/render/issue` 기준으로 박혀 있다. 저장소에서 돌리려면 `R` 값만 바꾼다.

## `__pycache__`

세 스크립트 모두 첫 줄에 `sys.dont_write_bytecode = True`를 둬서 `tools/`에 캐시를 남기지 않는다.
v1.1 묶음에 `__pycache__`가 섞여 들어간 것은 이것이 없어서였다. 저장소의 `.gitignore`에도
`__pycache__/` 한 줄을 두기를 권한다.
