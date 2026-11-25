"""약속 문장 금지 검사 (ROADMAP R157-7 · MASTER r63 "다음 호를 약속하지 말 것", 위임 m20-a1 ⑤).

뜻: **사실(날짜 · 기념일 · 열릴 수 있는 코너 이름)은 허용, 약속 문장은 금지.** 호가 나오지 않을 수 있으므로 "다음 호에서 …"처럼
다음 호를 약속하는 문장을 지면에 두지 않는다. 뒤표지 · 「다음 달」 · 발행 노트에 건다(compose가 지면의 보이는 글을 넘긴다).
순수 함수 - 부분 문자열(공백 무시)로 찾는다.
"""

from __future__ import annotations

import re
import sys

sys.dont_write_bytecode = True

# 금지 꼴(위임 ⑤ 예 그대로 + 같은 뜻의 영어 줄 "NEXT ISSUE" - R50-5에서 뺀 줄).
PROMISE_PATTERNS = (
    '다음 호에서',
    '다음 호에 실',
    '다음 호를 기대',
    '다음 달에 만나',
    '다음 호에 만나',
    '기대해 주세요',
    '기대해주세요',
    '찾아오겠습니다',
    '찾아갈게요',
)
_NEXT_ISSUE_EN = re.compile(r'(?i)next\s*issue')


def _squash(text: str) -> str:
    return re.sub(r'\s+', '', text)


def promise_violations(text: str) -> list:
    """보이는 글에서 약속 꼴을 찾는다. 빈 목록이면 통과."""
    if not isinstance(text, str) or not text:
        return []
    flat = _squash(text)
    found = [p for p in PROMISE_PATTERNS if _squash(p) in flat]
    if _NEXT_ISSUE_EN.search(text):
        found.append('NEXT ISSUE')
    return found


def visible_strings(value) -> list:
    """계산 값(dict · list · str)에서 글자만 모은다 - 지면에 들어갈 글."""
    out = []
    if isinstance(value, str):
        out.append(value)
    elif isinstance(value, dict):
        for v in value.values():
            out.extend(visible_strings(v))
    elif isinstance(value, (list, tuple)):
        for v in value:
            out.extend(visible_strings(v))
    return out
