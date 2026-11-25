"""매거진 2.0-A1 지면 짜기 - 두 사람의 결 · 어림짐작 · 부록 · 사진 한 장 · 다음 달 · 판권 정오 (위임 m20-a1 ⑥ ⑦ ⑧).

**임시 틀(`render/temp_pages/`)용**이다 - 디자인 v2.0.0 반입 때 틀과 함께 다시 짠다. 계약 필드(`docs/magazine-2-0/contracts/`)만 싣는다.

켜지는 조건: 호에 `appendix` 코너가 ready다(= 2.0-A1 파이프라인이 만든 호). 그 행이 없는 호(2.0 전 호 · 지금 시드 11권)는 이 파일을
지나지 않아 지면 · 바이트가 그대로다.

없는 값을 만들지 않는다: 숫자 · 날짜는 content의 것(엔진이 계산), 문장은 content의 LLM 칸 · 사용자 원문 · 아래 고정 틀 문장뿐이다.
원문(사진에 남긴 글)은 자르지 않는다(R29-3) - 넘치면 지면 검사가 실패로 멈춘다(R152-2).
"""

from __future__ import annotations

import sys
from typing import Any, Optional

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
    'colophon': ('판권 · 정오', '판권 정오'),
}
# 빠진 코너 문장 - 기획서 2절 4. 그대로(두 사람의 결). 어림짐작의 채팅 부족 문장은 기획서에 없어 메인 세션 제안(PM 확인 대상).
SKIP20_NO_PERSONALITY = '성격 정보가 아직 없어 싣지 않았습니다'
SKIP20_LITTLE_CHAT = '이번 달 대화가 적어 싣지 않았습니다'
CHAT_NOT_APPLIED = '채팅 반영 전'
SOURCE_LABEL = {'estimate': '추정', 'measured': '실측'}
RELATION_LABEL = {'close': '가까움', 'apart': '다름'}
WEEKDAYS = ('일', '월', '화', '수', '목', '금', '토')


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


def _num(n: Any) -> str:
    if isinstance(n, float) and n.is_integer():
        n = int(n)
    return str(n)


def _base(b: Any, key: str, period_label: Any) -> dict:
    name, title = LABELS20[key]
    return {'cornerName': name, 'pageTitle': title, 'periodLabel': period_label or ''}


class Pages20:
    """2.0 지면 묶음. 사진 한 장 후보는 쪽 수 규칙이 몇 면을 쓸지 정한 뒤에 `photo_break_pages(k)`로 꺼낸다."""

    def __init__(self, b: Any) -> None:
        from compose import PageSpec  # noqa: E402  (순환 import 피함)
        self.PageSpec = PageSpec
        self.b = b
        self.r = ready20(b)
        self.appendix = as_dict(self.r['appendix'].get('payload'))
        self.period_label = as_dict(self.r['appendix'].get('header')).get('periodLabel')
        self.toc: list = []

    # -- 코너 -------------------------------------------------------------

    def dna_pages(self) -> list:
        if 'love_dna' not in self.r:
            return []
        b, c = self.b, self.r['love_dna']
        p = as_dict(c.get('payload'))
        s = as_dict(p.get('score'))
        delta = s.get('delta')
        delta_line = '첫 호' if s.get('firstIssue') else (f'지난 호 {_num(s.get("previousTotal"))} → 이번 호 {_num(s.get("total"))}' if delta is not None else '')
        partners = [{'line': f"{x.get('name')} · {x.get('labelKo')}" if x.get('labelKo') else str(x.get('name'))} for x in as_list(p.get('partners')) if isinstance(x, dict)]
        tp1 = {**_base(b, 'love_dna', self.period_label), 'total': _num(s.get('total')), 'baseLine': f"성격 기저 {_num(s.get('base'))}",
               'chatMark': '' if s.get('chatApplied') else CHAT_NOT_APPLIED, 'deltaLine': delta_line, 'partners': partners, 'explain': p.get('explain')}
        stern = as_dict(p.get('sternberg'))
        tp2 = {**_base(b, 'love_dna', self.period_label),
               'axes': [{'line': f"{x.get('label')} {_num(x.get('a'))} · {_num(x.get('b'))} · {RELATION_LABEL.get(x.get('relation'), '')}"} for x in as_list(p.get('bigFive')) if isinstance(x, dict)],
               'sternberg': [{'line': f"{label} {_num(as_dict(stern.get(k)).get('a'))} · {_num(as_dict(stern.get(k)).get('b'))} · 겹침 {_num(as_dict(stern.get(k)).get('shared'))}"}
                             for k, label in (('intimacy', '친밀감'), ('passion', '열정'), ('commitment', '헌신'))],
               'attachmentHeadline': as_dict(p.get('attachmentCombo')).get('headline'), 'attachmentBody': as_dict(p.get('attachmentCombo')).get('body'),
               'strengths': as_list(p.get('strengths')), 'complements': as_list(p.get('complements')), 'actionTips': as_list(p.get('actionTips'))}
        # 문장 출처 막대 - 두 사람의 결 AI 문장(설명 · 해설 · 강점 · 보완 · 팁)
        b.say('ondolog', 'dna', 'love_dna.explain', p.get('explain'))
        b.say('ondolog', 'dna', 'love_dna.attachmentCombo.headline', tp2['attachmentHeadline'])
        b.say('ondolog', 'dna', 'love_dna.attachmentCombo.body', tp2['attachmentBody'])
        for k in ('strengths', 'complements', 'actionTips'):
            for t in tp2[k]:
                b.say('ondolog', 'dna', f'love_dna.{k}', t)
        self.toc.append(('love_dna', f"지표 · 일치율 {_num(s.get('total'))}" + ('' if s.get('chatApplied') else f' · {CHAT_NOT_APPLIED}')))
        return [self.PageSpec('tp-dna-score', None, {'tp': tp1}, {}, 'love_dna'), self.PageSpec('tp-dna-axes', None, {'tp': tp2}, {}, 'love_dna')]

    def rough_pages(self) -> list:
        if 'rough_guess' not in self.r:
            return []
        b, p = self.b, as_dict(self.r['rough_guess'].get('payload'))
        items = [{'label': x.get('label'), 'line': x.get('line'), 'sourceLabel': SOURCE_LABEL.get(x.get('source'), '')} for x in as_list(p.get('items')) if isinstance(x, dict)]
        day = as_dict(p.get('busiestDay'))
        topic = as_dict(p.get('monthlyTopic'))
        tp = {**_base(b, 'rough_guess', self.period_label), 'disclaimer': p.get('disclaimer'), 'footnote': p.get('footnote'), 'items': items,
              'busiestDate': _md(day.get('date')), 'busiestLine': day.get('line') or '',
              'topicTitle': topic.get('title'), 'topicLine': as_dict(topic.get('item')).get('line')}
        b.say('ondolog', 'roughGuess', 'rough_guess.busiestDay.line', day.get('line'))   # 7번 한 줄(LLM)만 - 1~6 · 8번 줄은 계산 결과(집계 수치)
        n = len(items) + (1 if day else 0) + (1 if topic else 0)
        self.toc.append(('rough_guess', f'재미 · {n}항목'))
        return [self.PageSpec('tp-rough-guess', None, {'tp': tp}, {}, 'rough_guess')]

    def appendix_pages(self) -> list:
        b, p = self.b, self.appendix
        cal = as_dict(p.get('calendar'))
        marks = {m.get('date'): m.get('label') for m in as_list(cal.get('marks')) if isinstance(m, dict)}
        month = cal.get('month') or ''
        cells = [{'label': w} for w in WEEKDAYS] + [{'label': ''} for _ in range(int(cal.get('firstWeekday') or 0))]
        for d in range(1, int(cal.get('days') or 0) + 1):
            key = f'{month}-{d:02d}'
            cells.append({'label': f'{d} {marks[key]}' if key in marks else str(d)})
        tp_cal = {**_base(b, 'appendix', self.period_label), 'monthTitle': f"{cal.get('year')}년 {cal.get('monthNumber')}월",
                  'cells': cells, 'marks': [{'line': f"{_md(d)} · {lab}"} for d, lab in marks.items()]}
        pages = [self.PageSpec('tp-appendix-calendar', None, {'tp': tp_cal}, {}, 'appendix')]
        cards = [x for x in as_list(p.get('postcards')) if isinstance(x, dict) and isinstance(x.get('path'), str)]
        for x in cards:
            b.show(x['path'])
        if cards:
            pages.append(self.PageSpec('tp-appendix-postcards', None, {'tp': {**_base(b, 'appendix', self.period_label), 'postcards': cards}}, {}, 'appendix'))
        self.toc.append(('appendix', f"달력 · {cal.get('monthNumber')}월" + (f' · 사진 엽서 {len(cards)}장' if cards else '')))
        self.postcards_shown = len(cards)
        return pages

    def next_month_pages(self) -> list:
        nm = p_nm = as_dict(self.appendix.get('nextMonth'))
        if not p_nm:
            return []
        miles = [{'line': f"{_md(m.get('date'))} · {m.get('label')}"} for m in as_list(nm.get('milestones')) if isinstance(m, dict)]
        tp = {**_base(self.b, 'next_month', self.period_label), 'monthTitle': f"{nm.get('monthNumber')}월", 'milestones': miles}
        self.toc.append(('next_month', f'기념일 {len(miles)}'))
        return [self.PageSpec('tp-next-month', None, {'tp': tp}, {}, 'next_month')]

    def colophon_pages(self, split: bool) -> list:
        c = as_dict(self.appendix.get('colophon'))
        corr = as_dict(c.get('correction'))
        number = c.get('editionNumber')
        edition = f"{c.get('editionLabel')}" + (f' · 제{number}호' if isinstance(number, int) else '')
        ps, pe = str(c.get('periodStart') or ''), str(c.get('periodEnd') or '')
        tp = {**_base(self.b, 'colophon', self.period_label), 'editionLine': edition,
              'periodLine': f'수집 기간 {_md(ps)} ~ {_md(pe)}', 'namesLine': ' · '.join(x for x in [c.get('nickname'), c.get('names')] if x),
              'makerLine': f"만든 곳 {c.get('maker')}",
              'correctionLine': f"바로잡을 내용은 {corr.get('path')}로 알려 주세요. {corr.get('email')}", 'split': split}
        pages = [self.PageSpec('tp-colophon', None, {'tp': tp}, {}, 'colophon')]
        if split:   # 판권 여백(쪽 수 규칙) - 정오를 다음 면으로
            pages.append(self.PageSpec('tp-colophon-errata', None, {'tp': tp}, {}, 'colophon'))
        self.toc.append(('colophon', '발행 정보 · 정정 창구'))
        return pages

    # -- 사진 한 장 --------------------------------------------------------

    def photo_break_candidates(self) -> list:
        return [x for x in as_list(self.appendix.get('photoBreaks')) if isinstance(x, dict) and isinstance(as_dict(x.get('photo')).get('path'), str)]

    def photo_break_pages(self, k: int) -> list:
        pages = []
        for x in self.photo_break_candidates()[:k]:
            path = as_dict(x.get('photo'))['path']
            self.b.show(path)
            if x.get('captionSource') == 'note':
                self.b.say('people', 'photoBreak', 'appendix.photoBreaks.caption', x.get('caption'))   # 사용자 원문
            # corner_type 없음 - 쉼 지면은 목차에 들지 않는다
            pages.append(self.PageSpec('tp-photo-break', None, {'tp': {**_base(self.b, 'photo_break', self.period_label), 'photo': path, 'caption': x.get('caption')}}, {}, None))
        return pages

    # -- 발행 노트 ----------------------------------------------------------

    def note_more_page(self) -> Any:
        """「발행 노트 · 이어서」(임시) - 새 재료 줄. 줄은 쪽 수 규칙 뒤에 `note_rows`로 채운다."""
        return self.PageSpec('tp-note-more', None, {'tp': {**_base(self.b, 'appendix', self.period_label), 'cornerName': '발행 노트', 'rows': []}}, {}, None)

    def note_rows(self, photo_breaks: int) -> list:
        """재료 표 새 줄(⑥) - 성격 정보 · 대화 묶음 · 부록 사진. 셋로그 · 인터뷰 · 게스트는 자리만(2.0-B · C) - 지금 줄 0."""
        m = as_dict(self.appendix.get('noteMaterials'))
        pers = as_dict(m.get('personality'))
        have = sum(1 for k in ('a', 'b') if pers.get(k) is True)
        used_people = 2 if ('love_dna' in self.r or 'rough_guess' in self.r) else 0
        sessions = int(m.get('chatSessions') or 0)
        rows = [
            {'label': '성격 정보', 'collected': f'{have}명', 'used': f'{used_people}명'},
            {'label': '대화 묶음', 'collected': f'{sessions}개', 'used': f"지표 {sessions if 'rough_guess' in self.r else 0}개"},
            {'label': '부록 사진', 'collected': f"{int(m.get('photosCollected') or 0)}장", 'used': f'엽서 {getattr(self, "postcards_shown", 0)}장 · 사진 한 장 {photo_breaks}장'},
        ]
        rows.extend(PLACEHOLDER_ROWS_20B_C)
        return rows

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


# 셋로그 · 인터뷰 · 게스트 재료 줄 - 자리만(2.0-B · C에서 채움). 지금은 줄 0(표가 한 면을 넘지 않게 - R152-2).
PLACEHOLDER_ROWS_20B_C: list = []
