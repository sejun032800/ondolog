"""호의 사실 - 지면에 찍히는 모든 수치와 목록을 **한 곳에서 한 번** 계산한다 (위임: 55-3b, ROADMAP R50-2 · R50-3 · R50-4).

네트워크·파일을 모른다. 입력은 이미 읽어 온 코너 content와 타임라인 분할 결과(실린 구간 · 못 실은 구간)이고, 출력은 `IssueFacts`다.
오프너 · 목차 · 발행 노트 · 타임라인 라벨 · 기사 칸 · 경로 지면이 **모두 이 값을 읽는다.** 지면 쪽에 따로 세는 코드를 두지 않는다.

규칙 (R50-2)
  - 이번 기간 데이트(모은 양) · 실은 기사(이번 기간) · 재소환 기사는 **따로** 센다. 재소환 기사의 사진 · 메모 · 장소는 이번 기간 수치에 섞지 않는다.
  - 발행 노트의 각 줄은 `모은 양 - 실제 게재 = 싣지 않은 것의 합`이 맞는다. 맞지 않으면(게재가 모은 양보다 크다) `FactsError` - 거짓 숫자를 찍지 않는다.
  - 이름 없는 경유지는 빈 줄이 아니라 `UNNAMED_PLACE`로 싣고 센다 (R50-3). 재소환 장소는 이번 달 경로에서 뺀다.
  - AI 캡션 수는 **지면에 실린 수**만 센다 (R50-4).
  - 재소환 기사로 실린 사진은 이번 기간 게재에 섞지 않고 따로 센다 (R51-2) - `이번 기간 게재 + 재소환 = 지면에 실린 사진 전체`.
  - 이달의 우리 리드의 숫자 칸은 생성 콘텐츠가 준 `count`가 아니라 여기서 계산한다 (R51-4, `IssueFacts.signal`). 지역 칸은 그 지역에서 보낸 날(데이트) 수이고 라벨도 여기서 만든다 (R52-2).

없는 값을 만들지 않는다 - 입력에 없는 것은 세지 않는다. 이 파일의 숫자 상수(`PHOTOS_PER_STOP` 등)는 `compose.py`가 문서에서 가져온 값과 같은 것이다(출처는 compose 쪽에 적었다).
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from typing import Any, Optional

sys.dont_write_bytecode = True

UNNAMED_PLACE = '이름을 남기지 않은 곳'   # R50-3
PHOTOS_PER_STOP = 3                       # CORNER_LAYOUT §3-1 "4 이상은 상위 3장만"
ARTICLE_PHOTOS = 3                        # README §9-② `@da.articlePhotos` 상위 3장
REGION_DAYS_SUFFIX = '에서 보낸 날'            # R52-2 - 이달의 우리 지역 칸의 라벨 `{지역}에서 보낸 날`
PLACES_CAP = 8                            # 장소 목록 상한 - README 쓸기 검사가 통과를 확인한 최대 항목 수


class FactsError(ValueError):
    """호의 사실이 서로 맞지 않는다 - 예: 발행 노트 한 줄의 게재 수가 모은 양보다 크다. 고치지 않고 알린다."""


# ---------------------------------------------------------------------------
# 작은 도구 (compose.py 가 가져다 쓴다)
# ---------------------------------------------------------------------------

def as_list(v: Any) -> list:
    return v if isinstance(v, list) else []


def as_dict(v: Any) -> dict:
    return v if isinstance(v, dict) else {}


def is_blank(v: Any) -> bool:
    return v is None or (isinstance(v, str) and v.strip() == '') or (isinstance(v, (list, dict)) and len(v) == 0)


def ymd_dot(value: Any) -> str:
    """`2026-08-19`(또는 ISO 시각) -> `2026.08.19`. 모양이 아니면 빈 값."""
    if isinstance(value, str):
        m = re.match(r'^(\d{4})-(\d{2})-(\d{2})', value)
        if m:
            return f'{m.group(1)}.{m.group(2)}.{m.group(3)}'
    return ''


def mmdd_dot(value: Any) -> str:
    s = ymd_dot(value)
    return s[5:] if s else ''


def memo_notes(stop: dict) -> list:
    """지면에 놓을 수 있는 메모 - 글이 있는 메모만. 그림 메모는 이 지면에 놓지 못한다."""
    return [n for n in as_list(stop.get('userNotes'))
            if isinstance(n, dict) and n.get('type', 'memo') == 'memo' and not is_blank(n.get('text'))]


def valid_photos(stop: dict) -> list:
    return [p for p in as_list(stop.get('photos')) if isinstance(p, dict) and isinstance(p.get('path'), str)]


def shown_photos_of_stop(stop: dict) -> list:
    return valid_photos(stop)[:PHOTOS_PER_STOP]


def stop_photo_counts(stop: dict) -> tuple:
    """(실린 수, 전체 수) - 한 구간의 사진. 타임라인 라벨 `사진 3 / 4`의 원천이다 (기사의 `그날 남은 사진 5장 중 3장`과 같은 규칙)."""
    return len(shown_photos_of_stop(stop)), len(valid_photos(stop))


def ratio_label(shown: int, total: int) -> str:
    """`3 / 4`(일부만 실림) 또는 `3`(전부 실림)."""
    return f'{shown} / {total}' if shown < total else str(shown)


def place_label(stop: dict) -> str:
    """경유지 이름 - 이름을 남기지 않았으면 `UNNAMED_PLACE`(R50-3)."""
    name = stop.get('placeName')
    return name if isinstance(name, str) and name.strip() else UNNAMED_PLACE


def first_photo_path(article: dict) -> Optional[str]:
    stops = as_list(article.get('stops'))
    if stops and isinstance(stops[0], dict):
        photos = as_list(stops[0].get('photos'))
        if photos and isinstance(photos[0], dict) and isinstance(photos[0].get('path'), str):
            return photos[0]['path']
    return None


def first_photo_any(article: dict) -> Optional[str]:
    """README §10 `@da.openerPhoto` - 기사의 **전체 stop**을 순서대로 편 뒤 첫 사진(§3-1 폴백). 하나도 없으면 None -> `type-only`."""
    for stop in as_list(article.get('stops')):
        for photo in as_list(as_dict(stop).get('photos')):
            if isinstance(photo, dict) and isinstance(photo.get('path'), str):
                return photo['path']
    return None


def article_photos(article: dict) -> list:
    """README §9 `@da.articlePhotos` - 그 기사의 사진을 편 뒤 상위 3장. 항목: path · caption · authorName.

    **임시 규칙 R48-3 ② + R50-4(디자인 v1.2.3 전까지)**: 캡션에는 AI 캡션을 싣지 않고 유저 메모만 싣는다. 메모는 **기사의 첫 사진 아래 하나**,
    기사의 첫 유저 메모(구간 순서대로 처음 나오는 글 있는 메모) 원문 그대로이고, 쓴 사람 이름을 같이 건넨다(지면이 `— ○○의 메모`로 적는다). 메모가 없으면 빈 값.
    """
    first_memo = None
    for stop in as_list(article.get('stops')):
        if isinstance(stop, dict):
            memos = memo_notes(stop)
            if memos:
                first_memo = memos[0]
                break
    out = []
    for stop in as_list(article.get('stops')):
        if isinstance(stop, dict):
            for photo in valid_photos(stop):
                out.append({'path': photo['path'], 'caption': '', 'authorName': ''})
    out = out[:ARTICLE_PHOTOS]
    if out and first_memo is not None:
        out[0]['caption'] = first_memo['text']
        author = first_memo.get('authorName')
        out[0]['authorName'] = author if isinstance(author, str) else ''
    return out


def caption_memo_count(articles: list) -> int:
    """기사들의 사진 아래에 실린 유저 메모 수."""
    return sum(1 for a in articles for p in article_photos(a) if p['caption'])


def _distinct(paths: list) -> list:
    return list(dict.fromkeys(p for p in paths if p))


# ---------------------------------------------------------------------------
# 결과
# ---------------------------------------------------------------------------

@dataclass
class ArticleFacts:
    index: int
    recalled: bool
    featured: bool
    date_on: str
    stop_count: int
    region: str                  # 기사의 지역(`region`) - 없으면 빈 글자
    place_names: list            # 전체 경유지 이름 - 이름 없는 곳은 UNNAMED_PLACE
    route: str                   # `A → B → C`
    photos_total: int
    photos_shown_paths: list     # 이 기사로 지면에 실린 사진(경로, 중복 없음)
    memos_total: int             # 글 있는 메모
    memos_shown: int
    ai_captions_shown: int       # 지면에 실린 AI 캡션 (R50-4)
    timeline_photos_shown: int = 0   # 대표 기사만 - 타임라인에 실린 구간들의 사진

    @property
    def photos_shown(self) -> int:
        return len(self.photos_shown_paths)


@dataclass
class IssueFacts:
    articles: list                         # [ArticleFacts] - 기사 순서
    featured: int
    period_dates: int                      # 이번 기간 데이트 (모은 양) - 오프너가 읽는다
    period_dates_source: str               # 'materials' | 'summary.dateCount' | 'articles'
    articles_period: int                   # 실은 기사 (이번 기간)
    articles_recalled: int                 # 재소환 기사 (따로)
    recalled_days: set                     # 재소환 기사의 dateOn
    places: list                           # 이번 달 경로 목록(재소환 제외, 이름 없는 곳 포함, 상한 전) [{'date','placeName'}]
    place_count: int
    regions: list
    region_count: int
    photos_shown_period: list              # 이번 기간 기사로 실린 사진(경로)
    memos_shown_period: int
    chat_used: int
    this_month_articles: int
    photos_shown_recalled: list = field(default_factory=list)   # 재소환 기사로 실린 사진(경로) - 이번 기간 게재와 겹치지 않는다 (R51-2)
    rows: list = field(default_factory=list)   # 발행 노트 표 - [{'key','collected','used','items','residual'}]
    info: list = field(default_factory=list)   # 줄에 묶이지 않는 안내 - [{'kind','n'}]
    dropped_stops: int = 0

    def article(self, index: int) -> ArticleFacts:
        return self.articles[index]

    def signal(self, kind: Any, value: Any) -> Optional[tuple]:
        """이달의 우리 리드의 숫자 칸 하나 - 생성 콘텐츠가 신호(`kind` · `value`)만 고르고 **숫자와 라벨은 여기서 만든다** (R51-4 · R52-2). `(숫자, 라벨)` 또는 None.

        정의 (장소 신호 `kind == 'place'`만), **이번 기간(재소환 제외) 기사들 중**
          - `value`가 기사의 지역(`region`)과 같으면 **그 지역 데이트(날) 수** - 데이트 단위 지역 속성으로 센다(경유지 이름으로 세지 않는다). 라벨 `"{지역}에서 보낸 날"`,
          - 아니면 `value`가 경유지 이름과 같은 경유지의 수 - 라벨은 그 이름 그대로(장소 칸의 정의는 그대로다).
        기록에서 셀 수 없는 신호(`keyword` · `activity`, 이번 기간 기록에 없는 지역 · 장소)는 None - 호출부가 그 칸을 보이지 않는다(없는 숫자를 만들지 않는다).
        """
        if kind != 'place' or not isinstance(value, str) or not value.strip():
            return None
        name = value.strip()
        period = [f for f in self.articles if not f.recalled]
        days_in_region = len([f for f in period if f.region == name])
        if days_in_region:
            return days_in_region, f'{name}{REGION_DAYS_SUFFIX}'
        by_name = sum(f.place_names.count(name) for f in period)
        return (by_name, name) if by_name > 0 else None

    def signal_count(self, kind: Any, value: Any) -> Optional[int]:
        found = self.signal(kind, value)
        return found[0] if found else None

    def signal_label(self, kind: Any, value: Any) -> Optional[str]:
        found = self.signal(kind, value)
        return found[1] if found else None

    @property
    def lead(self) -> ArticleFacts:
        return self.articles[self.featured]   # 데이트 아카이브가 없으면(articles 비어 있음) 부르지 않는다

    def to_report(self) -> dict:
        return {
            'periodDates': self.period_dates, 'periodDatesSource': self.period_dates_source,
            'articlesPeriod': self.articles_period, 'articlesRecalled': self.articles_recalled,
            'placeCount': self.place_count, 'regionCount': self.region_count,
            'photosShownPeriod': len(self.photos_shown_period), 'photosShownRecalled': len(self.photos_shown_recalled),
            'memosShownPeriod': self.memos_shown_period,
            'chatUsed': self.chat_used,
            'noteRows': [{'key': r['key'], 'collected': r['collected'], 'used': r['used'],
                          'notUsed': sum(i['n'] for i in r['items']) + r['residual'], 'balanced': True} for r in self.rows],
        }


# ---------------------------------------------------------------------------
# 계산
# ---------------------------------------------------------------------------

def build_facts(*, articles: list, fi: int, kept_stops: list, dropped_stops: list, materials: Optional[dict] = None,
                summary: Optional[dict] = None, sweet_payload: Optional[dict] = None, this_month_payload: Optional[dict] = None) -> IssueFacts:
    """호의 사실을 계산한다. `kept_stops` / `dropped_stops`는 대표 기사 타임라인에 실린 구간 / 실리지 못한 구간(`compose.split_timeline`의 결과)이다."""
    mats = materials or {}
    summary = as_dict(summary)
    afs: list = []
    for i, a in enumerate(articles):
        stops = [s for s in as_list(a.get('stops')) if isinstance(s, dict)]
        names = [place_label(s) for s in stops]
        photos_total = sum(len(valid_photos(s)) for s in stops)
        memos_total = sum(len(memo_notes(s)) for s in stops)
        timeline_shown = 0
        if i == fi:
            opener = first_photo_any(a)
            kept_paths = [p['path'] for s in kept_stops for p in shown_photos_of_stop(s)]
            shown_paths = _distinct(([opener] if opener else []) + kept_paths)
            memos_shown = sum(1 for s in kept_stops if memo_notes(s))
            ai_shown = sum(1 for s in kept_stops if not is_blank(s.get('aiCaption')))
            timeline_shown = len(kept_paths)
        else:
            hero = first_photo_path(a)
            shown_paths = _distinct(([hero] if hero else []) + [p['path'] for p in article_photos(a)])
            memos_shown = caption_memo_count([a])
            ai_shown = 0                     # 기사 지면은 AI 캡션을 싣지 않는다 (R48-3 ②)
        afs.append(ArticleFacts(
            index=i, recalled=a.get('recalled') is True, featured=(i == fi), date_on=str(a.get('dateOn') or ''),
            stop_count=len(stops), region=(a.get('region').strip() if isinstance(a.get('region'), str) else ''), place_names=names, route=' → '.join(names),
            photos_total=photos_total, photos_shown_paths=shown_paths, memos_total=memos_total, memos_shown=memos_shown,
            ai_captions_shown=ai_shown, timeline_photos_shown=timeline_shown))

    period = [f for f in afs if not f.recalled]
    recalled = [f for f in afs if f.recalled]
    lead = afs[fi] if afs else None      # 데이트 아카이브가 없으면 None - 기사에서 오는 줄은 게재 0이다
    lead_in_period = lead is not None and not lead.recalled

    # 이번 기간 데이트 (R50-2) - 모은 양이 있으면 그것, 없으면 코너의 요약 수, 그것도 없으면 이번 기간 기사 수
    collected_dates = mats.get('dates')
    if isinstance(collected_dates, int) and not isinstance(collected_dates, bool) and collected_dates > 0:
        period_dates, source = collected_dates, 'materials'
    elif isinstance(summary.get('dateCount'), int) and not isinstance(summary.get('dateCount'), bool):
        period_dates, source = summary['dateCount'], 'summary.dateCount'
    else:
        period_dates, source = len(period), 'articles'

    # 이번 달 경로 (R50-3) - 재소환 장소는 뺀다, 이름 없는 곳은 싣고 센다
    places = []
    for f in period:
        date = mmdd_dot(f.date_on)
        places.extend({'date': date, 'placeName': n} for n in f.place_names)
    regions = [r for r in as_list(summary.get('regions')) if isinstance(r, str) and r.strip()]
    region_count = summary.get('regionCount') if isinstance(summary.get('regionCount'), int) else len(regions)

    shown_period = _distinct([p for f in period for p in f.photos_shown_paths])
    shown_recalled = [p for p in _distinct([p for f in recalled for p in f.photos_shown_paths]) if p not in set(shown_period)]
    memos_shown_period = sum(f.memos_shown for f in period)

    sw = as_dict(sweet_payload)
    chat_used = sum(len(as_list(as_dict(m).get('turns'))) for m in as_list(sw.get('main'))) + len(as_list(sw.get('sub')))
    tm = as_dict(this_month_payload)
    tm_articles = as_list(tm.get('articles'))

    facts = IssueFacts(
        articles=afs, featured=fi, period_dates=period_dates, period_dates_source=source,
        articles_period=len(period), articles_recalled=len(recalled), recalled_days={f.date_on for f in recalled},
        places=places, place_count=len(places), regions=regions, region_count=region_count,
        photos_shown_period=shown_period, photos_shown_recalled=shown_recalled, memos_shown_period=memos_shown_period, chat_used=chat_used,
        this_month_articles=len(tm_articles), dropped_stops=len(dropped_stops) if lead_in_period else 0)

    # --- 발행 노트 표 (R50-2) - 줄마다 모은 양 - 실제 게재 = 싣지 않은 것의 합
    others = [f for f in period if not f.featured]

    def row(key: str, used: int, items: list) -> Optional[dict]:
        collected = mats.get(key)
        if not (isinstance(collected, int) and not isinstance(collected, bool) and collected > 0):
            return None
        explained = sum(i['n'] for i in items)
        residual = collected - used - explained
        if residual < 0:
            raise FactsError(f'발행 노트 정합 실패 - {key}: 모은 양 {collected} < 게재 {used} + 싣지 않은 것 {explained}')
        return {'key': key, 'collected': collected, 'used': used, 'items': [i for i in items if i['n'] > 0 or i.get('stops')], 'residual': residual}

    # 데이트 - 이번 기간 기사만 센다 (재소환은 따로)
    dates_row = row('dates', len(period), [])
    # 사진
    kept_over_cap = sum(len(valid_photos(s)) - len(shown_photos_of_stop(s)) for s in kept_stops) if lead_in_period else 0
    lead_unshown = lead.photos_total - lead.photos_shown if lead_in_period else 0
    dropped_unshown = lead_unshown - kept_over_cap
    other_unshown = sum(f.photos_total - f.photos_shown for f in others)
    photo_items = [{'kind': 'over_cap', 'n': kept_over_cap},
                   {'kind': 'dropped_stops', 'n': dropped_unshown, 'stops': len(dropped_stops) if lead_in_period else 0},
                   {'kind': 'other_cap', 'n': other_unshown}]
    photos_row = row('photos', len(shown_period), photo_items)
    # 메모
    lead_extra = sum(max(0, len(memo_notes(s)) - 1) for s in kept_stops) if lead_in_period else 0
    lead_dropped = sum(len(memo_notes(s)) for s in dropped_stops) if lead_in_period else 0
    other_memos = sum(f.memos_total - f.memos_shown for f in others)
    memo_items = [{'kind': 'extra_in_stop', 'n': lead_extra}, {'kind': 'dropped_stops', 'n': lead_dropped},
                  {'kind': 'other_cap', 'n': other_memos}]
    memos_row = row('memos', memos_shown_period, memo_items)
    # 대화
    messages_row = row('messages', chat_used, [])

    for r in (dates_row, photos_row, memos_row, messages_row):
        if r is not None:
            if r['residual'] > 0:
                r['items'].append({'kind': 'unpicked', 'n': r['residual']})
                r['residual'] = 0
            facts.rows.append(r)

    drawings = sum(1 for f in period for s in as_list(articles[f.index].get('stops')) if isinstance(s, dict)
                   for n in as_list(s.get('userNotes')) if isinstance(n, dict) and n.get('type') == 'drawing')
    if drawings:
        facts.info.append({'kind': 'drawings', 'n': drawings})
    omitted = max(0, len(places) - PLACES_CAP)
    if omitted:
        facts.info.append({'kind': 'omitted_places', 'n': omitted})
    return facts
