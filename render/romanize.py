"""국어의 로마자 표기법(2000, 문화관광부 고시) - 지명용 결정론 변환 (`@da.regionEn`, README §9-②).

소리 나는 대로 적는다(된소리되기는 표기에 반영하지 않는다). 반영하는 음운 변화는 연음·비음화·유음화·구개음화·ㅎ 축약이다.
행정 구역 단위(시·군·구·읍·면·동·리·가·도)는 앞 이름과 붙임표로 잇고, 붙임표 앞뒤의 음운 변화는 반영하지 않는다
(`연남동` -> `Yeonnam-dong`, `도봉구` -> `Dobong-gu`).

**하지 못하는 것은 빈 값으로 돌려준다** - 한글 음절과 공백만 받는다. 숫자·영문·기호가 섞이면 None이다(README: 실패하면 빈 값).
복합어의 ㄴ첨가(`학여울`)는 형태소를 알아야 해서 판정하지 않는다.
"""

from __future__ import annotations

import sys
from typing import Optional

sys.dont_write_bytecode = True

_CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
_JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
_JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']

_CHO_RR = {'ㄱ': 'g', 'ㄲ': 'kk', 'ㄴ': 'n', 'ㄷ': 'd', 'ㄸ': 'tt', 'ㄹ': 'r', 'ㅁ': 'm', 'ㅂ': 'b', 'ㅃ': 'pp', 'ㅅ': 's',
           'ㅆ': 'ss', 'ㅇ': '', 'ㅈ': 'j', 'ㅉ': 'jj', 'ㅊ': 'ch', 'ㅋ': 'k', 'ㅌ': 't', 'ㅍ': 'p', 'ㅎ': 'h'}
_JUNG_RR = {'ㅏ': 'a', 'ㅐ': 'ae', 'ㅑ': 'ya', 'ㅒ': 'yae', 'ㅓ': 'eo', 'ㅔ': 'e', 'ㅕ': 'yeo', 'ㅖ': 'ye', 'ㅗ': 'o', 'ㅘ': 'wa',
            'ㅙ': 'wae', 'ㅚ': 'oe', 'ㅛ': 'yo', 'ㅜ': 'u', 'ㅝ': 'wo', 'ㅞ': 'we', 'ㅟ': 'wi', 'ㅠ': 'yu', 'ㅡ': 'eu',
            'ㅢ': 'ui', 'ㅣ': 'i'}
_JONG_RR = {'ㄱ': 'k', 'ㄴ': 'n', 'ㄷ': 't', 'ㄹ': 'l', 'ㅁ': 'm', 'ㅂ': 'p', 'ㅇ': 'ng'}

# 받침 -> 대표음(자음 앞·말에서)
_REPRESENT = {'ㄱ': 'ㄱ', 'ㄲ': 'ㄱ', 'ㅋ': 'ㄱ', 'ㄳ': 'ㄱ', 'ㄺ': 'ㄱ',
              'ㄴ': 'ㄴ', 'ㄵ': 'ㄴ', 'ㄶ': 'ㄴ',
              'ㄷ': 'ㄷ', 'ㅅ': 'ㄷ', 'ㅆ': 'ㄷ', 'ㅈ': 'ㄷ', 'ㅊ': 'ㄷ', 'ㅌ': 'ㄷ', 'ㅎ': 'ㄷ',
              'ㄹ': 'ㄹ', 'ㄼ': 'ㄹ', 'ㄽ': 'ㄹ', 'ㄾ': 'ㄹ', 'ㅀ': 'ㄹ',
              'ㅁ': 'ㅁ', 'ㄻ': 'ㅁ',
              'ㅂ': 'ㅂ', 'ㅍ': 'ㅂ', 'ㅄ': 'ㅂ', 'ㄿ': 'ㅂ',
              'ㅇ': 'ㅇ'}
# 겹받침 -> (남는 앞 자음, 뒤 모음 앞으로 넘어가는 자음)
_DOUBLE = {'ㄳ': ('ㄱ', 'ㅅ'), 'ㄵ': ('ㄴ', 'ㅈ'), 'ㄶ': ('ㄴ', 'ㅎ'), 'ㄺ': ('ㄹ', 'ㄱ'), 'ㄻ': ('ㄹ', 'ㅁ'), 'ㄼ': ('ㄹ', 'ㅂ'),
           'ㄽ': ('ㄹ', 'ㅅ'), 'ㄾ': ('ㄹ', 'ㅌ'), 'ㄿ': ('ㄹ', 'ㅍ'), 'ㅀ': ('ㄹ', 'ㅎ'), 'ㅄ': ('ㅂ', 'ㅅ')}

_UNITS = ('시', '군', '구', '읍', '면', '동', '리', '가', '도')


def _is_syllable(ch: str) -> bool:
    return '가' <= ch <= '힣'


def _split(ch: str) -> tuple[str, str, str]:
    code = ord(ch) - 0xAC00
    return _CHO[code // 588], _JUNG[(code % 588) // 28], _JONG[code % 28]


def _word_to_rr(word: str) -> str:
    """붙임표 없는 한 덩어리(공백 없음)를 소리 나는 대로 적는다."""
    syllables = [list(_split(c)) for c in word]  # [초, 중, 종]
    n = len(syllables)

    # 음운 변화는 앞 음절의 받침(`final`)과 뒤 음절의 초성(`initial`) 사이에서 일어난다.
    for k in range(n - 1):
        cur, nxt = syllables[k], syllables[k + 1]
        final, initial = cur[2], nxt[0]
        if final == '':
            continue

        if initial == 'ㅇ':
            # 연음 - 받침이 뒤 음절의 초성으로 넘어간다(ㅇ받침은 넘어가지 않는다).
            if final == 'ㅇ':
                continue
            # 구개음화: ㄷ·ㅌ 받침 + '이' -> ㅈ·ㅊ
            if final in ('ㄷ', 'ㅌ') and nxt[1] == 'ㅣ':
                cur[2], nxt[0] = '', 'ㅈ' if final == 'ㄷ' else 'ㅊ'
                continue
            if final in _DOUBLE:
                keep, moved = _DOUBLE[final]
                cur[2] = keep
                nxt[0] = '' if moved == 'ㅎ' else moved
            else:
                cur[2] = ''
                nxt[0] = '' if final == 'ㅎ' else final
            continue

        rep = _REPRESENT[final]
        # ㅎ 받침 + ㄱ·ㄷ·ㅈ -> ㅋ·ㅌ·ㅊ (좋고 joko, 놓다 nota, 좋지 jochi)
        if final in ('ㅎ', 'ㄶ', 'ㅀ') and initial in ('ㄱ', 'ㄷ', 'ㅈ'):
            nxt[0] = {'ㄱ': 'ㅋ', 'ㄷ': 'ㅌ', 'ㅈ': 'ㅊ'}[initial]
            cur[2] = {'ㅎ': '', 'ㄶ': 'ㄴ', 'ㅀ': 'ㄹ'}[final]
            continue

        # 유음화: ㄴ+ㄹ -> ㄹㄹ (신라 silla), ㄹ+ㄴ -> ㄹㄹ (칼날 kallal)
        if rep == 'ㄴ' and initial == 'ㄹ':
            cur[2] = 'ㄹ'
            continue
        if rep == 'ㄹ' and initial == 'ㄴ':
            nxt[0] = 'ㄹ'
            cur[2] = 'ㄹ'
            continue

        # ㄹ의 비음화: ㅁ·ㅇ·ㄱ·ㄷ·ㅂ 받침 뒤의 ㄹ -> ㄴ (종로 jongno)
        if initial == 'ㄹ' and rep in ('ㅁ', 'ㅇ', 'ㄱ', 'ㄷ', 'ㅂ'):
            nxt[0] = initial = 'ㄴ'

        # 비음화: ㄱ·ㄷ·ㅂ 받침 + ㄴ·ㅁ -> ㅇ·ㄴ·ㅁ
        if initial in ('ㄴ', 'ㅁ') and rep in ('ㄱ', 'ㄷ', 'ㅂ'):
            cur[2] = {'ㄱ': 'ㅇ', 'ㄷ': 'ㄴ', 'ㅂ': 'ㅁ'}[rep]
            continue

        cur[2] = rep  # 그 밖은 받침을 대표음으로만 바꾼다(ㄱ·ㄷ·ㅂ + ㅎ은 그대로 - 묵호 Mukho)

    out = []
    for k, (cho, jung, jong) in enumerate(syllables):
        if cho == 'ㄹ':
            # ㄹ은 모음 앞에서 r, 앞 음절 받침이 ㄹ이면 ll
            prev_final = syllables[k - 1][2] if k > 0 else ''
            out.append('l' if prev_final == 'ㄹ' else 'r')
        else:
            out.append(_CHO_RR[cho])
        out.append(_JUNG_RR[jung])
        if jong != '':
            out.append(_JONG_RR[_REPRESENT[jong]])
    return ''.join(out)


def romanize_place(name: str) -> Optional[str]:
    """지명 -> 로마자. 한글 음절과 공백만 받는다. 못 하면 None(빈 값으로 쓴다)."""
    if not isinstance(name, str):
        return None
    words = name.split()
    if not words:
        return None
    result = []
    for word in words:
        if not all(_is_syllable(c) for c in word):
            return None
        if len(word) >= 2 and word[-1] in _UNITS:
            stem, unit = word[:-1], word[-1]
            text = f'{_word_to_rr(stem).capitalize()}-{_word_to_rr(unit)}'
        else:
            text = _word_to_rr(word).capitalize()
        result.append(text)
    return ' '.join(result)
