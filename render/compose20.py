"""매거진 2.0 지면 짜기 - 두 사람의 결 · 어림짐작 · 부록 · 사진 한 장 · 다음 달 · 판권과 정오 (위임 m20-a1 ⑥ ⑦ ⑧ · 2.0-D F3 F6 F7).

**디자인 v2.0.0 틀(`render/issue/pages/`)용**이다(2.0-D에서 A1 임시 틀을 바꿈). 틀이 읽는 경로(README §2 v2.0.0 표 · §13)에 맞춰
**지면용 보기(view)**를 만든다 - 저장된 content(계약 `docs/magazine-2-0/contracts/`)는 바꾸지 않고, 렌더러가 틀의 모양으로 옮겨 담기만 한다.
(예: 저장 `bigFive[]{key, a, b}` -> 틀 `payload.partners[i].bigFive.{o c e a n}` · 저장 `items[]` -> 틀 `payload.estimates` · `payload.measured`)

켜지는 조건: 호에 `appendix` 코너가 ready다(= 2.0 파이프라인이 만든 호). 그 행이 없는 호(2.0 전 호 · 시드 11권)는 이 파일을
지나지 않는다.

없는 값을 만들지 않는다: 숫자 · 날짜는 content의 것(엔진이 계산), 문장은 content의 LLM 칸 · 사용자 원문 · 틀의 고정 문구뿐이다.
content에 없는 판권 줄(글 · 사진 · 조판)은 빈 값 -> 틀이 줄째 뺀다(`data-optional`). 원문(사진에 남긴 글)은 자르지 않는다(R29-3).
"""

from __future__ import annotations

import calendar
import datetime as _dt
import sys
from typing import Any

sys.dont_write_bytecode = True

from facts import as_dict, as_list  # noqa: E402

CORNER20_ORDER = ('love_dna', 'rough_guess', 'appendix')
# 코너 이름 · 지면 제목 - `src/types/corners/cornerTitles.ts` `NEW_PAGE_TITLES`와 같다(시험이 대조)
LABELS20 = {
    'love_dna': ('우리의 연애 DNA', '두 사람의 결'),
    'rough_guess': ('얼렁뚱땅 어림짐작', '어림짐작'),
    'appendix': ('잡지 부록', '부록'),
    'photo_break': ('사진 한 장', '사진 한 장'),
    'next_month': ('다음 달', '다음 달'),
    'colophon': ('판권과 정오', '판권과 정오'),   # R158-3의 6 - 제목 표 · 러닝헤드 모두
}
# 빠진 코너 문장 - 기획서 2절 4. 그대로(두 사람의 결). 어림짐작의 채팅 부족 문장은 A1 메인 세션 안(R158-3 수락).
SKIP20_NO_PERSONALITY = '성격 정보가 아직 없어 싣지 않았습니다'
SKIP20_LITTLE_CHAT = '이번 달 대화가 적어 싣지 않았습니다'
CHAT_NOT_APPLIED = '채팅 반영 전'
WEEKDAYS = ('일', '월', '화', '수', '목', '금', '토')
MONTHS_EN = ('JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER')
MINUS = '−'   # README §2 `@dna.chatDeltaText` - 마이너스는 U+2212

# 애착 유형 이름 - 어느 지면에도 싣지 않는다(R158-8 ① · MASTER 10-5-3 재프레이밍). 두 사람의 결 문장 칸 검사 · 시험이 같은 목록을 쓴다
ATTACHMENT_TYPE_NAMES = ('안정형', '불안형', '회피형', '혼란형', '공포회피형', '불안정형', '거부회피형', '몰입형')

# 판권 고정 줄(틀 · 렌더러가 아는 사실만)
COLOPHON_FONTS = 'Pretendard · 마루부리'   # `render/issue/fonts/` 그대로


def ready20(b: Any) -> dict:
    return {t: c['content'] for t, c in b.corner_rows.items()
            if t in CORNER20_ORDER and c.get('status') == 'ready' and isinstance(c.get('content'), dict)}


def is_issue20(b: Any) -> bool:
    return 'appendix' in ready20(b)


def _md(date: Any) -> str:
    """'2026-10-13' -> '10월 13일'."""
    if isinstance(date, str) and len(date) >= 10:
        return f'{int(date[5:7])}월 {int(date[8:10])}일'
    return ''


def _md_weekday(date: Any) -> str:
    """'2026-10-13' -> '10월 13일 화요일'."""
    if not (isinstance(date, str) and len(date) >= 10):
        return ''
    d = _dt.date(int(date[0:4]), int(date[5:7]), int(date[8:10]))
    return f'{d.month}월 {d.day}일 {WEEKDAYS[(d.weekday() + 1) % 7]}요일'


def _kst_mmdd(iso: Any) -> str:
    """ISO 시각(오프셋 포함) -> KST 'MM.DD'(엔진 `kstMmDd`와 같은 꼴 - README §2 `@appendix.postcards` 캡션)."""
    if not isinstance(iso, str):
        return ''
    t = _dt.datetime.fromisoformat(iso.replace('Z', '+00:00'))
    if t.tzinfo is None:
        return ''
    k = t.astimezone(_dt.timezone(_dt.timedelta(hours=9)))
    return f'{k.month:02d}.{k.day:02d}'


def _num(n: Any) -> str:
    if isinstance(n, float) and n.is_integer():
        n = int(n)
    return str(n)


def signed_delta_text(v: Any) -> str:
    """README §2 `@dna.chatDeltaText` - "+6.4" · "−3.0" · "0.0". 저장값 정밀도(소수 2자리)를 줄이지 않는다 - 숫자 대조가 저장값과 같게."""
    if not isinstance(v, (int, float)):
        return ''
    body = f'{abs(v):.2f}'.rstrip('0')
    if body.endswith('.'):
        body += '0'
    return ('+' if v > 0 else MINUS if v < 0 else '') + body


def attachment_names_in(text: Any) -> list:
    if not isinstance(text, str):
        return []
    return [n for n in ATTACHMENT_TYPE_NAMES if n in text]


class Pages20:
    """2.0 지면 묶음. 사진 한 장 후보는 쪽 수 규칙이 몇 면을 쓸지 정한 뒤에 `photo_break_pages(k)`로 꺼낸다."""

    def __init__(self, b: Any) -> None:
        from compose import PageSpec  # noqa: E402  (순환 import 피함)
        self.PageSpec = PageSpec
        self.b = b
        self.r = ready20(b)
        self.appendix_content = self.r['appendix']
        self.appendix = as_dict(self.appendix_content.get('payload'))
        self.header = as_dict(self.appendix_content.get('header'))
        self.period_label = self.header.get('periodLabel')
        self.toc: list = []
        self.postcards_shown = 0

    def _corner(self, payload: dict) -> dict:
        """부속 지면(사진 한 장 · 다음 달 · 판권)의 코너 봉투 - 머리(`header.periodLabel`)는 부록 행의 것."""
        return {'header': dict(self.header), 'payload': payload}

    # -- 두 사람의 결 ------------------------------------------------------

    def dna_pages(self) -> list:
        if 'love_dna' not in self.r:
            return []
        b, c = self.b, self.r['love_dna']
        p = as_dict(c.get('payload'))
        s = as_dict(p.get('score'))
        axes = {as_dict(x).get('key'): as_dict(x) for x in as_list(p.get('bigFive'))}
        partners = []
        for i, x in enumerate(as_list(p.get('partners'))[:2]):
            side = 'a' if i == 0 else 'b'
            partners.append({**as_dict(x), 'bigFive': {k: axes.get(k, {}).get(side) for k in ('o', 'c', 'e', 'a', 'n')}})
        stern = as_dict(p.get('sternberg'))
        combo = as_dict(p.get('attachmentCombo'))
        view = {
            **p,
            'partners': partners,
            # 저장 `sternberg{k:{a,b,shared}}` -> 틀 `sternbergOverlap{k:{a,b}}`(세 축의 점 - README §13-2). note(AI)는 계약에 없어 빈 값(줄째 빠짐)
            'sternbergOverlap': {k: {'a': as_dict(stern.get(k)).get('a'), 'b': as_dict(stern.get(k)).get('b')} for k in ('intimacy', 'passion', 'commitment')},
            # R158-8 ① - 짝 이름은 엔진의 조합 문장(`attachment.pairLabel`). 애착 유형 이름은 싣지 않는다
            'attachmentCombo': {**combo, 'pairLabel': as_dict(p.get('attachment')).get('pairLabel') or ''},
        }
        corner = {'header': as_dict(c.get('header')), 'payload': view}
        # R158-8 ① ② - AI · 엔진 문장 칸에 애착 유형 이름이 있으면 싣지 않고 멈춘다(원문 칸은 이 지면에 없다)
        ai_texts = [p.get('explain'), combo.get('headline'), combo.get('body'), view['attachmentCombo']['pairLabel'],
                    *as_list(p.get('strengths')), *as_list(p.get('complements')), *as_list(p.get('actionTips'))]
        for t in ai_texts:
            if attachment_names_in(t):
                from compose import ComposeError  # noqa: E402
                raise ComposeError(f'두 사람의 결 - 애착 유형 이름을 싣지 않는다(R158-8): {attachment_names_in(t)}')
        # 문장 출처 막대 - 두 사람의 결 AI 문장(설명 · 해설 · 강점 · 보완 · 팁)
        b.say('ondolog', 'dna', 'love_dna.explain', p.get('explain'))
        b.say('ondolog', 'dna', 'love_dna.attachmentCombo.headline', combo.get('headline'))
        b.say('ondolog', 'dna', 'love_dna.attachmentCombo.body', combo.get('body'))
        for k in ('strengths', 'complements', 'actionTips'):
            for t in as_list(p.get(k)):
                b.say('ondolog', 'dna', f'love_dna.{k}', t)
        self.toc.append(('love_dna', f"지표 · 일치율 {_num(s.get('total'))}" + ('' if s.get('chatApplied') else f' · {CHAT_NOT_APPLIED}')))
        computed = {'dna': {'chatDeltaText': signed_delta_text(s.get('chatDelta')) if s.get('chatApplied') else ''}}
        tips = [{'text': t} for t in as_list(p.get('actionTips'))]
        axes_corner = {'header': corner['header'], 'payload': {**view, 'actionTips': tips}}
        return [self.PageSpec('dna-figure', corner, computed, {}, 'love_dna'),
                self.PageSpec('dna-axes', axes_corner, dict(computed), {}, 'love_dna')]

    # -- 어림짐작 ----------------------------------------------------------

    def rough_pages(self) -> list:
        if 'rough_guess' not in self.r:
            return []
        b, c = self.b, self.r['rough_guess']
        p = as_dict(c.get('payload'))
        items = [as_dict(x) for x in as_list(p.get('items'))]
        # R158-9 - 짐작(◇)과 셈(◆)을 나눈 틀 모양. 저장은 `items[]` 그대로(계약 갱신은 2.0-D · 저장 모양은 다음 엔진 위임)
        estimates = [{'key': x.get('key'), 'label': x.get('label'), 'subject': x.get('subject'), 'percent': x.get('percent'),
                      'similar': bool(x.get('similar'))} for x in items if x.get('source') == 'estimate']
        by_key = {x.get('key'): x for x in items if x.get('source') == 'measured'}

        def pair(key: str, percent: bool) -> dict:
            x = by_key.get(key)
            if x is None:
                return {}
            a, bb = as_dict(x.get('a')), as_dict(x.get('b'))
            if percent:
                return {'a': {'name': a.get('name'), 'percent': a.get('value'), 'percentText': a.get('display')},
                        'b': {'name': bb.get('name'), 'percentText': bb.get('display')}, 'similar': bool(x.get('similar'))}
            return {'a': {'name': a.get('name'), 'text': a.get('display')}, 'b': {'name': bb.get('name'), 'text': bb.get('display')},
                    'similar': bool(x.get('similar'))}

        day = as_dict(p.get('busiestDay'))
        topic = as_dict(p.get('monthlyTopic'))
        view = {
            'disclaimer': p.get('disclaimer'),
            'estimates': estimates,
            'measured': {'reply': pair('reply_speed', False), 'talkFirst': pair('talk_first', True), 'emoji': pair('emoji_more', True)},
            'busiestDay': {'dateText': _md(day.get('date')), 'line': day.get('line') or ''},
            'monthlyTopic': {'title': topic.get('title'), 'text': as_dict(topic.get('item')).get('line')},
        }
        b.say('ondolog', 'roughGuess', 'rough_guess.busiestDay.line', day.get('line'))   # 7번 한 줄(LLM)만 - 1~6 · 8번 줄은 계산 결과(집계 수치)
        n = len(items) + (1 if day else 0) + (1 if topic else 0)
        self.toc.append(('rough_guess', f'재미 · {n}항목'))
        return [self.PageSpec('rough-guess', {'header': as_dict(c.get('header')), 'payload': view}, {}, {}, 'rough_guess')]

    # -- 부록 · 부속 ----------------------------------------------------------

    def postcard_cards(self) -> list:
        return [x for x in as_list(self.appendix.get('postcards')) if isinstance(x, dict) and isinstance(x.get('path'), str)]

    def has_next_month(self) -> bool:
        return bool(as_dict(self.appendix.get('nextMonth')))

    def calendar_values(self) -> dict:
        cal = as_dict(self.appendix.get('calendar'))
        month = str(cal.get('month') or '')
        marks = {m.get('date'): m.get('label') for m in as_list(cal.get('marks')) if isinstance(m, dict)}
        first = int(cal.get('firstWeekday') or 0)
        days = int(cal.get('days') or 0)
        cells = [{'day': '', 'mark': ''} for _ in range(first)]
        for d in range(1, days + 1):
            cells.append({'day': str(d), 'mark': marks.get(f'{month}-{d:02d}') or ''})
        while len(cells) % 7:
            cells.append({'day': '', 'mark': ''})
        mn = int(cal.get('monthNumber') or 0)
        return {
            'monthNum': str(mn), 'yearText': str(cal.get('year') or ''), 'monthEn': MONTHS_EN[mn - 1] if 1 <= mn <= 12 else '',
            'milestoneLine': ', '.join(f'{_md(d)} · {lab}' for d, lab in marks.items()),
            # 사귄 날이 없는지는 content에 없다(기념일 0과 구별 못 함) - 지어내지 않고 빈 값(줄째 빠짐)
            'noStartNote': '',
            'weeks': [{'days': cells[i:i + 7]} for i in range(0, len(cells), 7)],
        }

    def appendix_pages(self, postcards: bool = True) -> list:
        """달력 1면 + 엽서 1면(사진이 있을 때). `postcards=False`면 엽서 면을 뺀다(쪽 수 규칙 ④ - 36쪽 넘을 때)."""
        b = self.b
        cal = as_dict(self.appendix.get('calendar'))
        pages = [self.PageSpec('appendix-calendar', self.appendix_content, {'calendar': self.calendar_values()}, {}, 'appendix')]
        cards = self.postcard_cards() if postcards else []
        for x in cards:
            b.show(x['path'])
        if cards:
            pc = [{'path': x['path'], 'caption': _kst_mmdd(x.get('capturedAt'))} for x in cards]
            pages.append(self.PageSpec('appendix-postcard', self.appendix_content, {'appendix': {'postcards': pc}}, {}, 'appendix'))
        self.toc.append(('appendix', f"달력 · {cal.get('monthNumber')}월" + (f' · 사진 엽서 {len(cards)}장' if cards else '')))
        self.postcards_shown = len(cards)
        return pages

    def next_month_pages(self) -> list:
        nm = as_dict(self.appendix.get('nextMonth'))
        if not nm:
            return []
        month = str(nm.get('month') or '')
        miles = [{'dateText': _md_weekday(m.get('date')), 'label': m.get('label')} for m in as_list(nm.get('milestones')) if isinstance(m, dict)]
        opening = [{'text': t} for t in as_list(nm.get('openingCorners')) if isinstance(t, str) and t]
        y, mo = int(month[0:4]), int(month[5:7])
        days = calendar.monthrange(y, mo)[1]
        sundays = sum(1 for d in range(1, days + 1) if _dt.date(y, mo, d).weekday() == 6)
        computed = {'next': {'monthNum': str(mo), 'monthLine': f'{y}년 {mo}월 · {days}일 · 일요일 {sundays}번',
                             # 기념일 · 열 코너가 모두 없을 때만(README §2) - 지금은 기념일이 없으면 면째 빠지므로 늘 빈 값
                             'emptyLine': '' if (miles or opening) else '다음 달에는 표시할 기념일이 없습니다'}}
        self.toc.append(('next_month', f'기념일 {len(miles)}'))
        return [self.PageSpec('next', self._corner({'milestones': miles, 'openingCorners': opening}), computed, {}, 'next_month')]

    def colophon_pages(self, theme: str, versions: list, template_version: str) -> list:
        """판권과 정오 1면(디자인 v2.0.0 틀은 한 면 - 정오를 다음 면으로 나누는 변형이 없다)."""
        c = as_dict(self.appendix.get('colophon'))
        corr = as_dict(c.get('correction'))
        number = c.get('editionNumber')
        # R158-3의 6 - "○○○○년 ○월호 · 제 n호"만(발행일은 찍지 않는다). 호 번호가 없으면 호 라벨만(지어내지 않음)
        issue_label = f"{c.get('editionLabel')}" + (f' · 제 {number}호' if isinstance(number, int) else '')
        computed = {'colophon': {
            'issueLabel': issue_label,
            'names': ' · '.join(x for x in [c.get('nickname'), c.get('names')] if x),
            'writers': '', 'photographers': '',   # content에 없는 사실 - 빈 값(줄째 빠짐)
            'maker': c.get('maker') or '',
            'typeset': f'틀 {template_version}' if template_version else '',
            'fonts': COLOPHON_FONTS,
            'themeLabel': theme or '',
            'versions': ' · '.join(v for v in versions if v),
        }}
        payload = {'correction': f"바로잡을 내용은 {corr.get('path')}로 알려 주세요. {corr.get('email')}", 'errata': []}
        self.toc.append(('colophon', '발행 정보 · 정정 창구'))
        return [self.PageSpec('colophon', self._corner(payload), computed, {}, 'colophon')]

    # -- 사진 한 장 --------------------------------------------------------

    def photo_break_candidates(self) -> list:
        return [x for x in as_list(self.appendix.get('photoBreaks')) if isinstance(x, dict) and isinstance(as_dict(x.get('photo')).get('path'), str)]

    def photo_break_pages(self, k: int) -> list:
        pages = []
        for x in self.photo_break_candidates()[:k]:
            photo = as_dict(x.get('photo'))
            self.b.show(photo['path'])
            if x.get('captionSource') == 'note':
                self.b.say('people', 'photoBreak', 'appendix.photoBreaks.caption', x.get('caption'))   # 사용자 원문
            # corner_type 없음 - 쉼 지면은 목차에 들지 않는다. 변형 land/port는 사진 비율(compose.choose_variant)
            payload = {'photo': {'path': photo['path'], 'width': photo.get('width'), 'height': photo.get('height')}, 'caption': x.get('caption')}
            pages.append(self.PageSpec('photo-break', self._corner(payload), {}, {}, None))
        return pages

    # -- 발행 노트 ----------------------------------------------------------

    def note_rows(self, photo_breaks: int) -> list:
        """재료 표 새 줄(⑥) - 성격 정보 · 대화 묶음 · 부록 사진. 발행 노트 `@note.materials`에 그대로 더한다(README v2.0.0 §10 ③ 발행 노트)."""
        m = as_dict(self.appendix.get('noteMaterials'))
        pers = as_dict(m.get('personality'))
        have = sum(1 for k in ('a', 'b') if pers.get(k) is True)
        used_people = 2 if ('love_dna' in self.r or 'rough_guess' in self.r) else 0
        sessions = int(m.get('chatSessions') or 0)
        return [
            {'label': '성격 정보', 'collected': f'{have}명', 'used': f'{used_people}명'},
            {'label': '대화 묶음', 'collected': f'{sessions}개', 'used': f"지표 {sessions if 'rough_guess' in self.r else 0}개"},
            {'label': '부록 사진', 'collected': f"{int(m.get('photosCollected') or 0)}장", 'used': f'엽서 {self.postcards_shown}장 · 사진 한 장 {photo_breaks}장'},
        ]

    def empty_lines(self) -> list:
        pers = as_dict(as_dict(self.appendix.get('noteMaterials')).get('personality'))
        both = pers.get('a') is True and pers.get('b') is True
        out = []
        for t in ('love_dna', 'rough_guess'):
            row = self.b.corner_rows.get(t)
            if row is None or t in self.r:
                continue
            if row.get('status') == 'skipped':
                reason = SKIP20_NO_PERSONALITY if not both else (SKIP20_LITTLE_CHAT if t == 'rough_guess' else None)
            else:
                reason = None
            from compose import SKIP_REASON_OTHER  # noqa: E402
            out.append(f'{LABELS20[t][0]} — {reason or SKIP_REASON_OTHER}')
        return out

    def coeff_versions(self) -> list:
        """판권 '계산 기준' - 이 호에 쓴 계수 · 지표 판(content에 있는 것만)."""
        out = []
        dna = as_dict(as_dict(self.r.get('love_dna')).get('payload'))
        v = as_dict(dna.get('score')).get('coeffVersion')
        if v:
            out.append(str(v))
        mv = as_dict(self.appendix.get('noteMaterials')).get('chatMetricsVersion')
        if mv and 'rough_guess' in self.r:
            out.append(str(mv))
        return out
