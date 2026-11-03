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


def basis_of(stops: list) -> Optional[str]:
    """'제안' 물음의 근거 문장 - 그 기사의 경유지 이름에서만 만든다(R50-8: 시드 기록에 없는 장소 · 활동을 쓰지 않는다)."""
    names = [s['placeName'] for s in stops if s.get('placeName')]
    if len(names) >= 2:
        return f'{names[0]}에서 {names[-1]}까지 이어진 동선'
    if names:
        return f'{names[0]}에서 보낸 하루'
    return None


def questions(basis: Optional[str] = None) -> list:
    suggestion = {'type': 'suggestion', 'text': '다음에도 같은 동네에서 만난다면 어디에 가볼까?'}
    if basis:
        suggestion['basis'] = basis
    return [
        {'type': 'rating', 'text': '이날의 데이트는 10점 만점에 몇 점?'},
        {'type': 'recall', 'text': '이날 중 가장 기억에 남는 건?'},
        suggestion,
    ]


def article(date_on: str, title: str, region: Optional[str], stops: list, featured: bool = False,
            recalled: bool = False, reason: Optional[str] = None) -> dict:
    a = {'dateId': f'd-{date_on}', 'dateOn': date_on, 'region': region, 'title': title, 'featured': featured,
         'recalled': recalled, 'stops': stops, 'closingQuestions': questions(basis_of(stops))}
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


def time_of_day(at: str) -> str:
    """시각 -> 때 이름(출처 줄의 `아침 대화 중`). 시드의 출처 줄은 첫 발화 시각에서 만든다 - 제목 · 시각이 서로 어긋나지 않게(R50-8)."""
    hour = int(at[11:13])
    return '아침' if hour < 12 else '낮' if hour < 18 else '저녁' if hour < 22 else '밤'


def stamped(at: str) -> dict:
    return attribution(f'{at[0:4]}.{at[5:7]}.{at[8:10]} {at[11:16]}, {time_of_day(at)} 대화 중', at)


def excerpt(context: str, day: str, turns: list) -> dict:
    return {'context': context, 'attribution': stamped(turns[0]['at']), 'turns': turns}


def sweet_words(mains: list, subs: Optional[list] = None, label: str = '2026년 9월') -> dict:
    return {'schemaVersion': '1.0',
            'header': {'cornerName': '다정한 말들', 'title': '다정한 말들', 'periodLabel': label},
            'payload': {'warmthIndex': None, 'main': mains, 'sub': subs or []}}


def sub(speaker: str, text: str, at: str = '2026-09-11T23:40:00+09:00') -> dict:
    return {'attribution': stamped(at), 'speaker': speaker, 'text': text}


def stops_in_region(da: dict, region: str) -> int:
    """이번 기간(재소환 제외) 기사 중 지역이 `region`인 기사들의 경유지 수 - 시드 문장의 숫자는 기록에서 센 이 값이다 (R51-4, `facts.IssueFacts.signal_count`와 같은 정의)."""
    return sum(len(a['stops']) for a in da['payload']['articles'] if not a['recalled'] and a.get('region') == region)


def region_signals(da: dict) -> list:
    """이달의 우리 리드의 신호 - 지역마다 한 칸, 숫자는 기록에서 센 값이다."""
    return [{'kind': 'place', 'value': region, 'count': stops_in_region(da, region)} for region in da['payload']['summary']['regions']]


def this_month(headline: str, articles: list, signals: Optional[list] = None, closing: str = '연남동의 장소가 가장 많이 나온 달이었습니다.',
               label: str = '2026년 9월') -> dict:
    return {'schemaVersion': '1.0',
            'header': {'cornerName': '이달의 우리', 'title': '이달의 우리', 'periodLabel': label},
            'payload': {'theme': {'headline': headline, 'lead': '이번 달 두 사람이 남긴 기록에는 같은 동네의 장소가 여러 번 나왔습니다.',
                                  'polarity': 'positive',
                                  'signals': signals or []},
                        'articles': articles, 'closing': closing}}


def tm_article(seq: int, title: str, body: str, evidence: list) -> dict:
    return {'seq': seq, 'title': title, 'body': body, 'evidence': evidence}


def ev_message(text: str, day: str = '2026-09-03') -> dict:
    return {'type': 'message', 'at': f'{day}T20:10:00+09:00', 'excerpt': text,
            'attribution': stamped(f'{day}T20:10:00+09:00')}


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


def standard_this_month(da: dict, headline: str = '연남동을 자주 걸은 달', night_article: bool = False) -> dict:
    """이달의 우리 시험 content - 숫자(신호 · 본문의 `N번`)는 `da`(데이트 아카이브 content)의 기록에서 센 값이다 (R51-4)."""
    n = stops_in_region(da, '연남동')
    articles = [
        tm_article(0, '같은 동네, 여러 번', f'연남동은 이번 달 데이트 기록에서 경유지로 {n}번 나왔습니다.', [ev_message('연남동 또 가자'), ev_date('2026-09-12')]),
        tm_article(1, '비 오는 날의 기록', '비가 온 날의 대화와 사진이 함께 남았습니다.', [ev_message('우산 챙겼어? 오늘 정말 비가 많이 온대'), ev_photo('e12')]),
        tm_article(2, '오래 걸은 날', '성수동에서 오래 걸은 날이 있었습니다.', [ev_date('2026-09-21')]),
    ]
    if night_article:
        articles.append(tm_article(3, '밤에 오간 말', '늦은 밤 대화가 이어진 날이 있었습니다.', [ev_message('아침부터 연락 줘서 고마워', '2026-09-17')]))
    return this_month(headline, articles, signals=region_signals(da))


def photo_scenario(theme: str = 'basic', short_side: int = 1200) -> dict:
    """① 사진 표지 · 타임라인 2면 분할(사진 3장 stop 포함) · 재소환 기사 있음 · 다정한 말들 main 2."""
    w, h = short_side, short_side * 4 // 3
    featured = article('2026-09-12', '비 오는 날의 연남동', '연남동', [
        stop(0, '14:20', '홍대입구역', [photo('e01', w, h)], [memo('역 앞에서 만났다. 우산이 하나뿐이었다.')], None),
        stop(1, '16:10', '연남동 카페', [photo('e02', w, h), photo('e03', w, h), photo('e04', w, h), photo('e05', w, h)],
             [memo('창가 자리가 비어 있었다.\n케이크를 반씩 나눠 먹었다.', B)], None),
        stop(2, '19:00', '연남동 식당', [photo('e06', w, h), photo('e07', w, h)], [], '저녁을 먹은 식당'),
    ], featured=True)
    second = article('2026-09-21', '성수동에서 걸은 하루', '성수동', [
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
    tm = standard_this_month(da)
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
    tm = standard_this_month(s['corners'][0]['content'], '비가 와도 우리는 걸었다', night_article=True)
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


# 긴 원문 시드 (R51-7) - 모두 **온전한 메시지**다: 문장이 끝나는 곳에서 끝나고, 어디서도 잘리지 않았으며, 서로 겹치지 않는다.
# 한 발화는 160자 안팎(35자 한 줄 기준 5줄) - 4턴 대화 하나는 한 면에 들어가고 둘은 한 면에 못 든다(README §12).
LONG_CONVERSATION_TEXTS = (
    ('긴 이야기를 나눈 대화', '22', 21, (
        '오늘 퇴근길에 비가 너무 많이 와서 우산을 쓰고도 바짓단이 다 젖었어. 그래도 네가 가방에 넣어 준 작은 우산이 있어서 끝까지 마음이 놓였고, 집에 와서야 고맙다는 말이 떠올랐어. 늦게 말해서 미안해. 오늘 하루 어땠는지도 궁금해. 저녁은 먹었어? 나는 방금 들어와서 이제 씻으려고 해.',
        '젖은 건 괜찮고 감기만 안 걸리면 돼. 따뜻한 물로 오래 씻고 양말도 꼭 갈아 신어. 나는 오늘 하루 종일 네가 우산을 챙겼는지 신경이 쓰여서 일이 손에 잘 안 잡혔어. 무사히 들어왔다니 이제 안심이야. 나는 오늘 평범했고 조금 졸렸어. 회의가 길어서 점심도 늦게 먹었거든. 많이 배고프다.',
        '그 얘기를 들으니까 오히려 내가 더 미안해지네. 다음에는 내가 먼저 일기예보를 보고 우산을 두 개 챙길게. 주말에 만나면 따뜻한 국물부터 먹으러 가자, 이번에는 내가 살게. 약속한 거다. 그리고 네가 좋아하는 반찬도 꼭 시키자, 알았지? 먹고 나서 천천히 걸어도 좋겠다. 날이 개면 좋겠어.',
        '좋아, 국물 있는 걸로 먹자. 이번 주말은 일정을 비워 둘 테니까 하고 싶은 게 있으면 미리 말해 줘. 네가 고른 곳이면 어디든 괜찮고, 같이 가는 게 제일 중요하니까 편하게 생각해도 돼. 그럼 오늘은 이만 쉬자, 잘 자. 내일 또 연락할게. 이불 꼭 덮고 자야 해. 정말 따뜻하게 자.',
    )),
    ('저녁 약속을 두고 길게 이어진 대화', '24', 19, (
        '내일 저녁은 어떻게 할까? 요즘 네가 일이 많아서 피곤해 보여서, 멀리 가지 말고 집 근처에서 조용히 먹으면 어떨까 해. 먹고 싶은 게 있으면 편하게 말해 줘, 나는 다 좋으니까 걱정하지 말고. 시간은 네가 정해도 돼. 나는 일곱 시 이후면 언제든 괜찮아. 일찍 끝나면 미리 알려 줄게.',
        '나도 내일은 멀리 나가기가 조금 힘들 것 같았는데 마침 잘됐다. 얼마 전에 지나가다 봐 둔 칼국수집이 있는데, 국물이 진하다고 해서 한번 가 보고 싶었어. 거기로 가도 괜찮을까? 웨이팅은 없대. 지도는 이따 보내 줄게. 메뉴는 가서 같이 고르자. 만두도 하나 시켜서 나눠 먹으면 좋겠어.',
        '칼국수 좋지, 날씨도 쌀쌀해져서 딱 맞는 메뉴야. 일곱 시쯤 만나서 천천히 먹고, 소화도 시킬 겸 근처 골목을 한 바퀴 돌고 들어가자. 도착하면 바로 연락 줄게, 너도 출발할 때 알려 줘. 우산은 이번에는 내가 챙길게. 걱정은 하지 마. 겉옷은 조금 두껍게 입고 나와. 감기 꼭 조심하자.',
        '알겠어, 일곱 시에 가게 앞에서 보자. 먼저 도착하면 자리를 잡아 놓을게. 오늘 하루도 고생 많았고, 푹 자고 내일 보자. 잘 자라는 인사도 미리 해 둘게, 잘 자. 꿈에서도 비는 안 왔으면 좋겠다. 내일 보면 말해 줄 게 있어. 기대해도 좋아. 그럼 진짜 이만 잘게. 그럼 내일 봐, 안녕.',
    )),
)

# 한 면을 넘는 대화 (4턴 x 386~420자 = 12줄) - 렌더가 멈춰야 하는 시드. 문장 단위로만 이어 붙였다.
OVERLONG_CONVERSATION_SENTENCES = (
    ('오늘은 이상하게 잠이 오지 않아서 누워 있다가 결국 다시 휴대전화를 집어 들었어.',
     '아까 낮에 네가 해 준 이야기를 계속 생각하다가 내가 하고 싶었던 말이 이제야 겨우 정리가 됐거든.',
     '그동안 바쁘다는 핑계로 제대로 묻지 못했던 것들이 많아서 오늘은 조금 길게 써 보려고 해.',
     '읽다가 지루하면 나중에 천천히 봐도 괜찮으니까 부담 갖지 말고 편한 시간에 답해 줘.',
     '나는 요즘 네가 웃을 때 눈가에 생기는 작은 주름이 자꾸 눈에 들어와서 혼자 웃곤 해.',
     '별것 아닌 일인데도 하루가 끝날 때쯤 그 얼굴이 떠오르면 피곤했던 마음이 슬그머니 풀리더라.',
     '그래서 고맙다는 말을 한 번쯤은 제대로 해야겠다고 생각했는데 막상 하려니 자꾸 쑥스러워져.',
     '이 말을 끝까지 쓰고 나면 아마 잠이 올 것 같으니까 조금만 더 들어 줘.'),
    ('답장이 늦어서 미안해, 사실 읽자마자 한참 동안 아무 말도 못 하고 화면만 바라보고 있었어.',
     '네가 그렇게 생각하고 있었다는 걸 알고 나니까 나도 숨기고 있던 마음을 꺼내고 싶어졌어.',
     '우리가 처음 만난 날부터 지금까지 있었던 일들을 하나씩 떠올려 봤는데 좋았던 날이 훨씬 많더라.',
     '힘든 날에도 서로 연락을 놓지 않았던 것이 지금 돌아보면 가장 큰 힘이었다는 생각이 들어.',
     '나는 표현이 서툴러서 네가 서운했던 순간이 분명히 있었을 텐데 그걸 말해 줘서 오히려 고마워.',
     '앞으로는 불편한 마음이 생기면 하루를 넘기지 않고 이렇게 바로 이야기하는 사람이 되어 볼게.',
     '그리고 네가 말해 준 것처럼 주말 하루는 아무 계획 없이 그냥 같이 쉬는 날로 비워 두자.',
     '생각만 해도 마음이 편해지는 걸 보니 아마 나도 그런 날이 필요했던 모양이야.'),
    ('나도 사실은 같은 생각을 하고 있었어, 그래서 네 글을 읽는 내내 고개를 몇 번이나 끄덕였는지 몰라.',
     '계획 없이 쉬는 날이라니 상상만 해도 좋다, 늦잠을 자고 일어나서 느긋하게 밥을 먹고 싶어.',
     '창문을 열어 두고 오래된 노래를 틀어 놓은 채로 각자 책을 읽다가 졸리면 그냥 자도 좋겠다.',
     '그런 하루를 보내고 나면 다음 한 주를 버틸 힘이 생길 것 같은 기분이 들어.',
     '물론 네가 먼저 지쳐서 쓰러지지 않게 평소에도 틈틈이 쉬는 것부터 약속해 줬으면 좋겠어.',
     '나는 네가 괜찮다고 말하는 날에도 목소리만 들으면 지친 날인지 아닌지 대충 알아챌 수 있거든.',
     '그러니까 힘들 때는 괜찮다고 하지 말고 그냥 힘들다고 말해 줘, 그 말을 들으면 내가 더 편해.',
     '대신 나도 그렇게 할게, 우리 서로에게만큼은 괜찮은 척하지 않기로 하자.'),
    ('그래, 서로에게는 괜찮은 척하지 않기로 약속하자, 오늘 밤에 한 이야기 중에서 이게 제일 마음에 들어.',
     '이렇게 길게 이야기하고 나니 아까까지 무겁던 가슴이 한결 가벼워진 것 같아서 신기하다.',
     '내일 아침에 일어나면 이 대화를 다시 읽어 볼 텐데 그때도 지금과 같은 마음이면 좋겠어.',
     '그리고 주말에는 정말로 아무 계획 없이 만나자, 나는 간식만 조금 사서 갈게.',
     '네가 좋아하는 귤도 한 봉지 챙길 테니까 껍질 까는 건 네가 맡아 줘, 그건 네가 더 잘하잖아.',
     '이제 정말 눈이 감기니까 이쯤에서 마무리할게, 따뜻하게 이불 덮고 푹 자고 일어나서 보자.',
     '좋은 꿈 꾸고, 내일은 오늘보다 조금 더 가벼운 하루가 되기를 바라면서 먼저 잘게.',
     '오늘 이야기해 줘서 정말 고마워, 정말로 많이 고마워, 잘 자.'),
)

# 긴 메모 (R51-7) - 문장 단위로만 이어 붙인 온전한 메모. `whole_memo(문장들, 최소 글자 수)`는 문장을 끝까지 채운 뒤 멈춘다(문장 중간에서 자르지 않는다).
MEMO_SENTENCES_WINDOW = (
    '창가 자리에 앉아 오래 이야기했다.', '해가 질 때까지 아무 말 없이 있어도 좋았다.', '커피가 식는 줄도 모르고 창밖만 한참 바라보았다.',
    '건너편 건물 유리에 노을이 번지는 것을 둘이 같이 보았다.', '나가기 전에 한 잔씩 더 시켜서 천천히 마셨다.', '계산하고 나오니 비가 그쳐 있었다.',
    '젖은 길 위로 가로등 불빛이 길게 늘어져 있었다.', '집에 가는 길에는 서로 말이 별로 없었는데 그게 불편하지 않았다.',
    '헤어지기 전에 손을 한 번 더 잡았다.', '오늘 하루가 오래 기억에 남을 것 같다.',
    '돌아서는 뒷모습이 보이지 않을 때까지 서 있었다.', '버스 창가에 앉아 오늘 찍은 사진을 하나씩 넘겨 보았다.', '사진 속 우리는 생각보다 더 많이 웃고 있었다.',
    '집에 도착해서 불을 켜기 전에 잠깐 현관에 서 있었다.', '내일도 비슷한 하루였으면 좋겠다고 적어 둔다.')
MEMO_SENTENCES_ALLEY = (
    '골목을 따라 걷다가 문 닫은 가게 앞에서 한참을 서 있었다.', '셔터에 붙은 오래된 안내문의 글씨가 반쯤 바래 있었다.', '그날의 공기가 오래 남았다.',
    '한 블록쯤 더 걸어가니 작은 공원이 나왔다.', '벤치에 앉아 사 온 빵을 반으로 나눠 먹었다.', '근처 놀이터에서 아이들 웃음소리가 들렸다.',
    '바람이 불어서 나뭇잎이 발 앞까지 굴러왔다.', '한참 앉아 있다가 날이 어두워져서 일어났다.', '돌아오는 길에 편의점에 들러 따뜻한 차를 샀다.',
    '손에 쥔 컵이 따뜻해서 오래 놓지 않았다.',
    '지하철역 입구에서 마지막으로 뒤를 돌아보았다.', '개찰구 너머로 손을 흔드는 모습이 작게 보였다.', '플랫폼에 서서 오늘 걸은 길을 천천히 되짚어 보았다.',
    '열차가 들어오는 소리에 생각이 끊겼다.', '창에 비친 얼굴이 조금 웃고 있는 것 같았다.', '내릴 역에 도착해서 계단을 오르는데 바람이 한결 차가웠다.')


def whole_memo(sentences: tuple, min_chars: int) -> str:
    """문장을 앞에서부터 이어 붙여 `min_chars`자 이상이 되는 첫 문장에서 멈춘다 - 항상 문장 끝에서 끝나는 온전한 메모."""
    out: list = []
    for sentence in sentences:
        out.append(sentence)
        if len(' '.join(out)) >= min_chars:
            return ' '.join(out)
    raise ValueError(f'문장 모음이 {min_chars}자에 모자란다 - 문장을 더하거나 같은 문장을 되풀이하지 않는다')


def long_conversation(day: str, texts: tuple, context: str, hour: int) -> dict:
    """`texts`의 발화로 이루어진 대화 하나(발화는 A, B 번갈아). 첫 발화 시각 = `hour`시 10분. 글은 그대로 쓴다 - 길이를 맞추려고 자르지 않는다."""
    speakers = [A, B]
    return excerpt(context, day, [turn(speakers[i % 2], text, f'2026-09-{day}T{hour:02d}:{10 + i}:00+09:00') for i, text in enumerate(texts)])


def many_photos_scenario(theme: str = 'basic') -> dict:
    """① 사진 많은 달 - basic · 타임라인 2면 분할(사진 3장 stop 포함) · 출처 막대 두 칸 · 이달의 우리 3편(사진 없이 한 단)."""
    w, h = 1200, 1600
    featured = article('2026-09-12', '비 오는 날의 연남동', '연남동', [
        stop(0, '09:05', '홍대입구역', [photo('e01', w, h)], [memo('역 앞에서 만났다. 우산이 하나뿐이었다.')], None),
        stop(1, '14:20', '연남동 카페', [photo('e02', w, h), photo('e03', w, h), photo('e04', w, h), photo('e05', w, h)],
             [memo('창가 자리가 비어 있었다.\n케이크를 반씩 나눠 먹었다.', B)], None),
        stop(2, '19:00', '연남동 식당', [photo('e06', w, h), photo('e07', w, h)], [], '저녁을 먹은 식당'),
        stop(3, '21:30', '경의선숲길', [photo('e13', w, h)], [], '밤의 숲길'),
    ], featured=True)
    second = article('2026-09-21', '성수동에서 걸은 하루', '성수동', [
        stop(0, '13:00', '성수동 서점', [photo('e08', w, h)], [], '서점에서 책을 골랐다'),
        stop(1, '15:30', None, [photo('e09', w, h), photo('e10', w, h), photo('e14', w, h), photo('e15', w, h)], [memo('오래 걸었다.')], None),
    ])
    recalled = article('2025-09-20', '일 년 전 이맘때', '합정동', [
        stop(0, '12:00', '합정동 공원', [photo('e11', w, h)], [], '공원 벤치'),
    ], recalled=True, reason='anniversary')
    da = date_archive([featured, second, recalled], ['연남동', '성수동'])
    base = photo_scenario(theme)
    return {'theme': theme, 'corners': [corner_row('date_archive', da, seq=1), base['corners'][1], corner_row('this_month', standard_this_month(da), seq=3)]}


def opener_fallback_scenario(theme: str = 'night') -> dict:
    """② 대표 기사 첫 stop에 사진이 없다 - 오프너는 같은 기사의 다음 stop 사진으로 폴백한다. basic 아닌 테마."""
    w, h = 1200, 1600
    featured = article('2026-09-12', '비 오는 날의 연남동', '연남동', [
        stop(0, '14:20', '홍대입구역', [], [memo('역 앞에서 만났다. 우산이 하나뿐이었다.')], None),
        stop(1, '16:10', '연남동 카페', [photo('e02', w, h), photo('e03', w, h)], [memo('창가 자리가 비어 있었다.', B)], None),
    ], featured=True)
    second = article('2026-09-21', '성수동에서 걸은 하루', '성수동', [stop(0, '13:00', '성수동 서점', [photo('e08', w, h)], [], '서점에서 책을 골랐다')])
    base = photo_scenario(theme)
    da = date_archive([featured, second])
    return {'theme': theme, 'corners': [corner_row('date_archive', da, seq=1), base['corners'][1], corner_row('this_month', standard_this_month(da), seq=3)]}


def opener_type_only_scenario(theme: str = 'hip') -> dict:
    """② 대표 기사 전체 stop에 사진이 하나도 없다 - 오프너는 type-only. (다른 기사에는 사진이 있고, 짧은 변 900px이라 활자 표지가 된다)"""
    w, h = 900, 1200
    featured = article('2026-09-12', '사진 없이 남긴 하루', '연남동', [
        stop(0, '14:20', '홍대입구역', [], [memo('사진은 못 찍었다. 비가 너무 왔다.')], None),
        stop(1, '16:10', '연남동 카페', [], [memo('창가 자리가 비어 있었다.', B)], None),
    ], featured=True)
    second = article('2026-09-21', '성수동에서 걸은 하루', '성수동', [stop(0, '13:00', '성수동 서점', [photo('e08', w, h)], [], '서점에서 책을 골랐다')])
    base = photo_scenario(theme)
    da = date_archive([featured, second])
    return {'theme': theme, 'corners': [corner_row('date_archive', da, seq=1), base['corners'][1], corner_row('this_month', standard_this_month(da), seq=3)]}


def long_original_scenario(theme: str = 'ondol', with_overlong: bool = False) -> dict:
    """③ 긴 원문 - 160자 안팎 4턴 대화 둘(각 한 면 안에 들어가지만 둘은 한 면에 못 든다 -> 인용 2면) + 긴 메모. 글은 모두 온전한 메시지다(R51-7).
    `with_overlong`이면 한 면을 넘는 대화(4턴 x 386~420자) 하나를 더한다 - 렌더가 실패해야 한다. 그 대화를 빼면 나뉘어 통과한다."""
    base = photo_scenario(theme)
    mains = [long_conversation(day, texts, context, hour) for context, day, hour, texts in LONG_CONVERSATION_TEXTS]
    if with_overlong:
        mains.append(long_conversation('27', tuple(' '.join(group) for group in OVERLONG_CONVERSATION_SENTENCES), '밤새 이어진 가장 긴 대화', 23))
    sw = sweet_words(mains, [sub(B, '오늘 고생했어 진짜'), sub(A, '집에 잘 들어갔어?', '2026-09-15T22:10:00+09:00')])
    da = base['corners'][0]['content']
    da['payload']['articles'][0]['stops'][0]['userNotes'] = [memo(whole_memo(MEMO_SENTENCES_WINDOW, 120))]
    return {'theme': theme, 'corners': [corner_row('date_archive', da, seq=1), corner_row('sweet_words', sw, seq=2), base['corners'][2]]}


def timeline_overflow_scenario(theme: str = 'basic', memo_chars: int = 370) -> dict:
    """R48-4 - 긴 타임라인 메모(200자 이상)로 **높이 어림이 실제보다 작게** 나와 한 면에 몰리는 호.
    대표 기사 구간 둘: 사진 1장 + 긴 메모, 사진 없음 + 긴 메모. 어림(`stop_height`)은 메모 50자마다 29px을 더하지만 실제 지면은 한 줄(약 32자)마다 29px이라
    메모가 길수록 어림이 작아진다. 어림 합이 953px 안이라 한 면에 같이 놓이고, 실제로는 판면을 넘는다. 렌더가 이 넘침을 실패로 잡는지 보려는 시험 호다."""
    base = many_photos_scenario(theme)
    da = base['corners'][0]['content']
    featured = da['payload']['articles'][0]
    featured['stops'] = [
        stop(0, '14:20', '연남동 카페', [photo('e02', 1200, 1600)], [memo(whole_memo(MEMO_SENTENCES_WINDOW, memo_chars))], None),
        stop(1, '17:40', '경의선숲길', [], [memo(whole_memo(MEMO_SENTENCES_ALLEY, memo_chars), B)], None),
    ]
    return {'theme': theme, 'corners': [corner_row('date_archive', da, seq=1), base['corners'][1], corner_row('this_month', standard_this_month(da), seq=3)]}
