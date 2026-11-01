"""시험 재료 - 코너 content(저장 스키마 `CORNER_CONTENT` §2·§6·§7)와 합성 사진. 시험용이고 실제 사람의 기록이 아니다 (위임: 55-2).

`seed_render_tests.py`(원격 개발 DB 시험 호)와 단위 시험이 같은 재료를 쓴다.
"""

from __future__ import annotations

import struct
import sys
import zlib
from typing import Optional

sys.dont_write_bytecode = True

COUPLE = 'c0000000-0000-4000-8000-0000000000c1'
ISSUE = 'a0000000-0000-4000-8000-0000000000a1'
A, B = 'test-세준', 'test-서영'


def png(width: int, height: int, hue: int = 0) -> bytes:
    """합성 사진 - 대각 그라데이션 한 장(의존성 없이). 실제 사진이 아니다."""
    rows = []
    for y in range(height):
        row = bytearray([0])
        for x in range(width):
            t = (x / width + y / height) / 2
            r = int(120 + 100 * t) % 256
            g = int(150 + 70 * (1 - t) + hue) % 256
            b = int(180 - 60 * t + hue // 2) % 256
            row += bytes((r, g, b))
        rows.append(bytes(row))
    raw = b''.join(rows)

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xFFFFFFFF)

    ihdr = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw, 6)) + chunk(b'IEND', b'')


def dest(entry: str, couple: str = COUPLE, issue: str = ISSUE, ext: str = 'png') -> str:
    return f'{couple}/{issue}/{entry}.{ext}'


def photo(entry: str, width: int = 1200, height: int = 1600, **ids) -> dict:
    return {'path': dest(entry, **ids), 'width': width, 'height': height, 'capturedAt': '2026-09-12T14:22:11+09:00'}


def memo(text: str, by: str = A) -> dict:
    return {'authorId': 'u1', 'authorName': by, 'type': 'memo', 'text': text}


def stop(seq: int, time: str, place: Optional[str], photos: list, notes: list, caption: Optional[str]) -> dict:
    return {'seq': seq, 'time': time, 'placeName': place, 'lat': None, 'lng': None, 'photos': photos,
            'userNotes': notes, 'aiCaption': None if notes else caption}


def questions(basis: str = '오후 영화 관람 후 저녁 식사로 이어진 동선') -> list:
    return [
        {'type': 'rating', 'text': '이날의 데이트는 10점 만점에 몇 점?'},
        {'type': 'recall', 'text': '이날 중 가장 기억에 남는 건?'},
        {'type': 'suggestion', 'text': '다음에도 같은 동네에서 만난다면 어디에 가볼까?', 'basis': basis},
    ]


def article(date_on: str, title: str, region: Optional[str], stops: list, featured: bool = False,
            recalled: bool = False, reason: Optional[str] = None) -> dict:
    a = {'dateId': f'd-{date_on}', 'dateOn': date_on, 'region': region, 'title': title, 'featured': featured,
         'recalled': recalled, 'stops': stops, 'closingQuestions': questions()}
    if reason:
        a['recallReason'] = reason
    return a


def date_archive(articles: list, regions: Optional[list] = None, label: str = '2026년 9월') -> dict:
    regions = regions if regions is not None else ['연남동', '성수동']
    return {'schemaVersion': '1.0',
            'header': {'cornerName': '데이트 아카이브', 'title': '함께한 하루', 'periodLabel': label},
            'payload': {'summary': {'dateCount': len([a for a in articles if not a['recalled']]),
                                    'regionCount': len(regions), 'regions': regions},
                        'articles': articles, 'mapInfographic': None}}


def attribution(display: str, at: str) -> dict:
    return {'display': display, 'at': at, 'source': 'chat'}


def turn(speaker: str, text: str, at: str) -> dict:
    return {'speaker': speaker, 'text': text, 'at': at}


def excerpt(context: str, day: str, turns: list) -> dict:
    return {'context': context, 'attribution': attribution(f'2026.09.{day} 09:20, 아침 대화 중', f'2026-09-{day}T09:20:00+09:00'),
            'turns': turns}


def sweet_words(mains: list, subs: Optional[list] = None, label: str = '2026년 9월') -> dict:
    return {'schemaVersion': '1.0',
            'header': {'cornerName': '다정한 말들', 'title': '다정한 말들', 'periodLabel': label},
            'payload': {'warmthIndex': None, 'main': mains, 'sub': subs or []}}


def sub(speaker: str, text: str, at: str = '2026-09-11T23:40:00+09:00') -> dict:
    return {'attribution': attribution('2026.09.11 23:40, 밤 대화 중', at), 'speaker': speaker, 'text': text}


def this_month(headline: str, articles: list, signals: Optional[list] = None, closing: str = '10월에도 같은 동네를 걸어 보자.',
               label: str = '2026년 9월') -> dict:
    return {'schemaVersion': '1.0',
            'header': {'cornerName': '이달의 우리', 'title': '이달의 우리', 'periodLabel': label},
            'payload': {'theme': {'headline': headline, 'lead': '이번 달 두 사람이 남긴 기록에는 같은 동네의 장소가 여러 번 나왔습니다.',
                                  'polarity': 'positive',
                                  'signals': signals or [{'kind': 'place', 'value': '연남동', 'count': 5},
                                                         {'kind': 'activity', 'value': '산책', 'count': 3}]},
                        'articles': articles, 'closing': closing}}


def tm_article(seq: int, title: str, body: str, evidence: list) -> dict:
    return {'seq': seq, 'title': title, 'body': body, 'evidence': evidence}


def ev_message(text: str, day: str = '2026-09-03') -> dict:
    return {'type': 'message', 'at': f'{day}T20:10:00+09:00', 'excerpt': text,
            'attribution': attribution(f'{day.replace("-", ".")} 20:10, 밤 대화 중', f'{day}T20:10:00+09:00')}


def ev_photo(entry: str) -> dict:
    return {'type': 'photo', 'at': '2026-09-12T14:22:11+09:00', 'photoPath': dest(entry)}


def ev_date(day: str) -> dict:
    return {'type': 'date', 'at': day}


def corner_row(corner_type: str, content: Optional[dict], status: str = 'ready', skip_reason: Optional[str] = None, seq: int = 1) -> dict:
    return {'corner_type': corner_type, 'status': status, 'content': content or {}, 'skip_reason': skip_reason,
            'last_error': None, 'seq': seq}


ISSUE_ROW = {'id': ISSUE, 'couple_id': COUPLE, 'issue_type': 'monthly', 'period_start': '2026-09-01',
             'period_end': '2026-09-30', 'title': None, 'published_at': None}
COUPLE_ROW = {'id': COUPLE, 'nickname': 'test-늘봄', 'magazine_theme': 'basic', 'user_a_id': None, 'user_b_id': None}


def photo_scenario(theme: str = 'basic', short_side: int = 1200) -> dict:
    """① 사진 표지 · 타임라인 2면 분할(사진 3장 stop 포함) · 재소환 기사 있음 · 다정한 말들 main 2."""
    w, h = short_side, short_side * 4 // 3
    featured = article('2026-09-12', '비 오는 날의 연남동', '연남동', [
        stop(0, '14:20', '홍대입구역', [photo('e01', w, h)], [memo('역 앞에서 만났다. 우산이 하나뿐이었다.')], None),
        stop(1, '16:10', '연남동 카페', [photo('e02', w, h), photo('e03', w, h), photo('e04', w, h), photo('e05', w, h)],
             [memo('창가 자리가 비어 있었다.\n케이크를 반씩 나눠 먹었다.', B)], None),
        stop(2, '19:00', '연남동 식당', [photo('e06', w, h), photo('e07', w, h)], [], '저녁을 먹은 식당'),
    ], featured=True)
    second = article('2026-09-21', '성수동 산책', '성수동', [
        stop(0, '13:00', '성수동 서점', [photo('e08', w, h)], [], '서점에서 책을 골랐다'),
        stop(1, '15:30', None, [photo('e09', w, h), photo('e10', w, h)], [memo('오래 걸었다.')], None),
    ])
    recalled = article('2025-09-20', '일 년 전 이맘때', '합정동', [
        stop(0, '12:00', '합정동 공원', [photo('e11', w, h)], [], '공원 벤치'),
    ], recalled=True, reason='anniversary')
    da = date_archive([featured, second, recalled], ['연남동', '성수동'])
    sw = sweet_words([
        excerpt('아침 출근길에 오간 대화', '22', [turn(A, '오늘 비 온대. 우산 챙겼어?', '2026-09-22T09:20:00+09:00'),
                                          turn(B, '응 챙겼어. 너도 감기 조심해', '2026-09-22T09:21:30+09:00')]),
        excerpt('저녁 약속을 정하던 대화', '24', [turn(B, '내일 뭐 먹을까', '2026-09-24T18:02:00+09:00'),
                                         turn(A, '네가 좋아하는 거 먹자', '2026-09-24T18:03:10+09:00')]),
    ], [sub(B, '오늘 고생했어 진짜'), sub(A, '집에 잘 들어갔어?', '2026-09-15T22:10:00+09:00')])
    tm = this_month('연남동을 자주 걸은 달', [
        tm_article(0, '같은 동네, 여러 번', '연남동은 이번 달 다섯 번 기록에 나왔습니다.', [ev_message('연남동 또 가자'), ev_date('2026-09-12')]),
        tm_article(1, '비 오는 날의 기록', '비가 온 날의 대화와 사진이 함께 남았습니다.', [ev_message('우산 챙겼어? 오늘 정말 비가 많이 온대'), ev_photo('e12')]),
        tm_article(2, '산책이 늘었다', '성수동에서 오래 걸은 날이 있었습니다.', [ev_date('2026-09-21')]),
    ])
    return {'theme': theme, 'corners': [corner_row('date_archive', da, seq=1), corner_row('sweet_words', sw, seq=2),
                                         corner_row('this_month', tm, seq=3)]}


def type_scenario(theme: str = 'neon') -> dict:
    """② 활자 표지(사진 짧은 변 1170 미만) · 표제가 3줄·6자로 나뉨 · 다정한 말들 main 3(인용 2면) · 이달의 우리 4편."""
    s = photo_scenario(theme, short_side=900)
    sw = sweet_words([
        excerpt('아침 출근길에 오간 대화', '22', [turn(A, '오늘 비 온대. 우산 챙겼어?', '2026-09-22T09:20:00+09:00'),
                                          turn(B, '응 챙겼어. 너도 감기 조심해', '2026-09-22T09:21:30+09:00')]),
        excerpt('저녁 약속을 정하던 대화', '24', [turn(B, '내일 뭐 먹을까', '2026-09-24T18:02:00+09:00'),
                                         turn(A, '네가 좋아하는 거 먹자', '2026-09-24T18:03:10+09:00'),
                                         turn(B, '그럼 칼국수', '2026-09-24T18:03:40+09:00')]),
        excerpt('밤늦게 오간 대화', '27', [turn(A, '오늘 하루 어땠어', '2026-09-27T23:01:00+09:00'),
                                       turn(B, '길었는데 네 연락 받고 좋아졌어', '2026-09-27T23:02:30+09:00')]),
    ], [sub(B, '오늘 고생했어 진짜'), sub(A, '집에 잘 들어갔어?', '2026-09-15T22:10:00+09:00'),
        sub(B, '다음 주에 또 보자', '2026-09-16T08:30:00+09:00'), sub(A, '좋은 아침', '2026-09-17T07:50:00+09:00'),
        sub(B, '비 그쳤다', '2026-09-18T12:10:00+09:00'), sub(A, '밥 먹었어?', '2026-09-19T13:00:00+09:00')])
    tm = this_month('비가 와도 우리는 걸었다', [
        tm_article(0, '같은 동네, 여러 번', '연남동은 이번 달 다섯 번 기록에 나왔습니다.', [ev_message('연남동 또 가자'), ev_date('2026-09-12')]),
        tm_article(1, '비 오는 날의 기록', '비가 온 날의 대화와 사진이 함께 남았습니다.', [ev_message('우산 챙겼어? 오늘 정말 비가 많이 온대'), ev_photo('e12')]),
        tm_article(2, '산책이 늘었다', '성수동에서 오래 걸은 날이 있었습니다.', [ev_date('2026-09-21')]),
        tm_article(3, '밤에 오간 말', '늦은 밤 대화가 이어진 날이 있었습니다.', [ev_message('좋은 아침', '2026-09-17')]),
    ])
    rows = [corner_row('date_archive', s['corners'][0]['content'], seq=1), corner_row('sweet_words', sw, seq=2),
            corner_row('this_month', tm, seq=3)]
    return {'theme': theme, 'corners': rows}


def skipped_scenario(theme: str = 'lovely') -> dict:
    """③ 다정한 말들이 `skipped` - 지면·목차에서 빠지고 쪽 번호가 다시 매겨진다."""
    s = photo_scenario(theme)
    rows = [s['corners'][0], corner_row('sweet_words', None, status='skipped', skip_reason='insufficient_input', seq=2), s['corners'][2]]
    return {'theme': theme, 'corners': rows}


# ---------------------------------------------------------------------------
# 55-3 - 디자인 v1.2.2 지면 시험 호 (로컬 세 권 + 변형). 모두 합성 시험 데이터이고 실제 사람의 기록이 아니다.
# ---------------------------------------------------------------------------

def exact_text(seed: str, length: int) -> str:
    """정확히 `length`자인 시험 문장(코드포인트). 시험 재료의 글자 수를 맞추려는 것이다 - 사람이 쓴 원문이 아니다."""
    out = ''
    while len(out) < length:
        out += seed + ' '
    out = out[:length]
    return out[:-1] + '.' if out.endswith(' ') else out


LONG_SEED = '비 오는 날에는 우산을 챙기라고 말해 주던 목소리가 오래 남아서 오늘도 그 말을 다시 꺼내어 읽어 본다'


def long_conversation(day: str, turns: int = 4, chars: int = 160, context: str = '긴 이야기를 나눈 대화') -> dict:
    """`turns`개 발화, 발화마다 정확히 `chars`자인 대화 하나."""
    speakers = [A, B]
    words = LONG_SEED.split(' ')
    return excerpt(context, day, [
        turn(speakers[i % 2], exact_text(' '.join(words[i:] + words[:i]), chars), f'2026-09-{day}T21:{10 + i}:00+09:00') for i in range(turns)])


def many_photos_scenario(theme: str = 'basic') -> dict:
    """① 사진 많은 달 - basic · 타임라인 2면 분할(사진 3장 stop 포함) · 출처 막대 두 칸 · 이달의 우리 3편(사진 없이 한 단)."""
    w, h = 1200, 1600
    featured = article('2026-09-12', '비 오는 날의 연남동', '연남동', [
        stop(0, '09:05', '홍대입구역', [photo('e01', w, h)], [memo('역 앞에서 만났다. 우산이 하나뿐이었다.')], None),
        stop(1, '14:20', '연남동 카페', [photo('e02', w, h), photo('e03', w, h), photo('e04', w, h), photo('e05', w, h)],
             [memo('창가 자리가 비어 있었다.\n케이크를 반씩 나눠 먹었다.', B)], None),
        stop(2, '19:00', '연남동 식당', [photo('e06', w, h), photo('e07', w, h)], [], '저녁을 먹은 식당'),
        stop(3, '21:30', '경의선숲길', [photo('e13', w, h)], [], '밤 산책길'),
    ], featured=True)
    second = article('2026-09-21', '성수동 산책', '성수동', [
        stop(0, '13:00', '성수동 서점', [photo('e08', w, h)], [], '서점에서 책을 골랐다'),
        stop(1, '15:30', None, [photo('e09', w, h), photo('e10', w, h), photo('e14', w, h), photo('e15', w, h)], [memo('오래 걸었다.')], None),
    ])
    recalled = article('2025-09-20', '일 년 전 이맘때', '합정동', [
        stop(0, '12:00', '합정동 공원', [photo('e11', w, h)], [], '공원 벤치'),
    ], recalled=True, reason='anniversary')
    da = date_archive([featured, second, recalled], ['연남동', '성수동'])
    base = photo_scenario(theme)
    return {'theme': theme, 'corners': [corner_row('date_archive', da, seq=1), base['corners'][1], base['corners'][2]]}


def opener_fallback_scenario(theme: str = 'night') -> dict:
    """② 대표 기사 첫 stop에 사진이 없다 - 오프너는 같은 기사의 다음 stop 사진으로 폴백한다. basic 아닌 테마."""
    w, h = 1200, 1600
    featured = article('2026-09-12', '비 오는 날의 연남동', '연남동', [
        stop(0, '14:20', '홍대입구역', [], [memo('역 앞에서 만났다. 우산이 하나뿐이었다.')], None),
        stop(1, '16:10', '연남동 카페', [photo('e02', w, h), photo('e03', w, h)], [memo('창가 자리가 비어 있었다.', B)], None),
    ], featured=True)
    second = article('2026-09-21', '성수동 산책', '성수동', [stop(0, '13:00', '성수동 서점', [photo('e08', w, h)], [], '서점에서 책을 골랐다')])
    base = photo_scenario(theme)
    return {'theme': theme, 'corners': [corner_row('date_archive', date_archive([featured, second]), seq=1), base['corners'][1], base['corners'][2]]}


def opener_type_only_scenario(theme: str = 'hip') -> dict:
    """② 대표 기사 전체 stop에 사진이 하나도 없다 - 오프너는 type-only. (다른 기사에는 사진이 있고, 짧은 변 900px이라 활자 표지가 된다)"""
    w, h = 900, 1200
    featured = article('2026-09-12', '사진 없이 남긴 하루', '연남동', [
        stop(0, '14:20', '홍대입구역', [], [memo('사진은 못 찍었다. 비가 너무 왔다.')], None),
        stop(1, '16:10', '연남동 카페', [], [memo('창가 자리가 비어 있었다.', B)], None),
    ], featured=True)
    second = article('2026-09-21', '성수동 산책', '성수동', [stop(0, '13:00', '성수동 서점', [photo('e08', w, h)], [], '서점에서 책을 골랐다')])
    base = photo_scenario(theme)
    return {'theme': theme, 'corners': [corner_row('date_archive', date_archive([featured, second]), seq=1), base['corners'][1], base['corners'][2]]}


def long_original_scenario(theme: str = 'ondol', with_overlong: bool = False) -> dict:
    """③ 긴 원문 - 160자 4턴 대화 둘(각 한 면 안에 들어가지만 둘은 한 면에 못 든다 -> 인용 2면) + 긴 메모.
    `with_overlong`이면 한 면을 넘는 대화(4턴 x 400자) 하나를 더한다 - 렌더가 실패해야 한다. 그 대화를 빼면 나뉘어 통과한다."""
    base = photo_scenario(theme)
    mains = [long_conversation('22'), long_conversation('24', context='저녁 약속을 두고 길게 이어진 대화')]
    if with_overlong:
        mains.append(long_conversation('27', chars=400, context='밤새 이어진 가장 긴 대화'))
    sw = sweet_words(mains, [sub(B, '오늘 고생했어 진짜'), sub(A, '집에 잘 들어갔어?', '2026-09-15T22:10:00+09:00')])
    da = base['corners'][0]['content']
    long_memo = exact_text('창가 자리에서 오래 이야기했다 해가 질 때까지 앉아 있었다', 120)
    da['payload']['articles'][0]['stops'][0]['userNotes'] = [memo(long_memo)]
    return {'theme': theme, 'corners': [corner_row('date_archive', da, seq=1), corner_row('sweet_words', sw, seq=2), base['corners'][2]]}


def timeline_overflow_scenario(theme: str = 'basic', memo_chars: int = 400) -> dict:
    """R48-4 - 긴 타임라인 메모(200자 이상)로 **높이 어림이 실제보다 작게** 나와 한 면에 몰리는 호.
    대표 기사 구간 둘: 사진 1장 + 긴 메모, 사진 없음 + 긴 메모. 어림(`stop_height`)은 메모 50자마다 29px을 더하지만 실제 지면은 한 줄(약 32자)마다 29px이라
    메모가 길수록 어림이 작아진다. 어림 합이 953px 안이라 한 면에 같이 놓이고, 실제로는 판면을 넘는다. 렌더가 이 넘침을 실패로 잡는지 보려는 시험 호다."""
    base = many_photos_scenario(theme)
    da = base['corners'][0]['content']
    seeds = ('창가 자리에 앉아 오래 이야기했다 해가 질 때까지 아무 말 없이 있어도 좋았다',
             '골목을 따라 걷다가 문 닫은 가게 앞에서 한참을 서 있었다 그날의 공기가 오래 남았다')
    featured = da['payload']['articles'][0]
    featured['stops'] = [
        stop(0, '14:20', '연남동 카페', [photo('e02', 1200, 1600)], [memo(exact_text(seeds[0], memo_chars))], None),
        stop(1, '17:40', '경의선숲길', [], [memo(exact_text(seeds[1], memo_chars), B)], None),
    ]
    return {'theme': theme, 'corners': [corner_row('date_archive', da, seq=1), base['corners'][1], base['corners'][2]]}
