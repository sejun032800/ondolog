"""조판 시험용 초안 호 - 원격 **개발** DB·스토리지에 시험 커플과 호 하나씩을 만든다 (위임: 55-2, 55-3). 운영자 PC에서 돈다.

`55-1`·`55-2`의 호는 발행됐거나 낡았다 - 조판 시험은 새 호를 쓴다. 코너 content는 **LLM이 쓴 것이 아니라** `tests/fixtures.py`의 **합성 시험 데이터**다
(실제 사람의 기록이 아니다 - 실제 LLM 호출 0회). 저장 스키마(`src/types/corners/storedContent.ts`)는 이 파일을 쓰기 전에 Deno로 따로 검증한다(`dump`).

세트 `55-2` (기본)
  ① `test-55-2-photo`  basic  사진 표지 · 타임라인 2면 분할 · 재소환 기사 · 다정한 말들 main 2
  ② `test-55-2-type`   neon   활자 표지(사진 짧은 변 900px) · 다정한 말들 main 3(인용 2면) · 이달의 우리 4편
  ③ `test-55-2-skip`   lovely 다정한 말들 `skipped`(insufficient_input) - 목차·쪽 번호가 다시 매겨진다
세트 `55-3` (디자인 v1.2.2)
  ① `test-55-3-photos`   basic 사진 많은 달 · 타임라인 2면 분할 · 출처 막대 두 칸 · 이달의 우리 한 단
  ② `test-55-3-opener`   night 대표 기사 첫 stop에 사진이 없다 - 오프너가 다음 stop 사진으로 폴백
  ③ `test-55-3-long`     ondol 160자 4턴 대화 둘(인용 2면) + 긴 메모 - 렌더가 통과해야 한다
  ④ `test-55-3-overlong` ondol ③에 한 면을 넘는 대화 하나를 더한 것 - **렌더가 멈춰야 한다**(자르지 않는다, R29-3)
  ⑤ `test-55-3-memo`     basic 긴 타임라인 메모(380자 안팎, 문장 단위) 둘 - 높이 어림이 실제보다 작아 한 면에 몰린다(R48-4). **렌더만 한다, 발행하지 않는다**.
                         지면 검사가 넘침을 렌더 실패로 잡는지 보려는 호다(잡든 못 잡든 결과를 그대로 본다)

규칙 (R13-7 · 54와 같다): 이름에 `test`. 개발 프로젝트가 아니면 쓰기 전에 멈춘다. **만든 행·파일은 목록으로 남기고 지우지 않는다**
(`render/out/seed-<세트>.json`). service_role 키는 환경변수로만 읽고 어디에도 쓰지 않는다. 계정에는 비밀번호가 없다.
복제(P7)가 하는 일 - 원본(`entries`)과 같은 사진을 목적지(`magazine/{couple}/{issue}/{entry}.png`)에 미리 둔다. 발행 명령이 목적지 존재를 다시 확인한다.

사용 (저장소 루트에서):
    render/.venv/Scripts/python.exe render/seed_render_tests.py dump <폴더> [세트]   # 검증용 content JSON만 쓴다(원격 접속 없음)
    render/.venv/Scripts/python.exe render/seed_render_tests.py run [세트]          # 원격 개발 DB에 만든다
"""

from __future__ import annotations

import sys

sys.dont_write_bytecode = True

import json
import re
import uuid
import urllib.parse
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / 'tests'))

import fixtures as fx  # noqa: E402
import render_issue as r  # noqa: E402

NOW = datetime.now().astimezone().isoformat()

# 세트 -> [(라벨, 테마, 커플 닉네임(이름에 test), 시나리오 만들기, 사진 크기)]
SETS = {
    '55-2': [
        ('photo', 'basic', 'test-늘봄', fx.photo_scenario, (1200, 1600)),
        ('type', 'neon', 'test-봄볕', fx.type_scenario, (900, 1200)),
        ('skip', 'lovely', 'test-온기', fx.skipped_scenario, (1200, 1600)),
    ],
    '55-3': [
        ('photos', 'basic', 'test-늘봄-55-3', fx.many_photos_scenario, (1200, 1600)),
        ('opener', 'night', 'test-봄볕-55-3', fx.opener_fallback_scenario, (1200, 1600)),
        ('long', 'ondol', 'test-온기-55-3', fx.long_original_scenario, (1200, 1600)),
        ('overlong', 'ondol', 'test-긴말-55-3', lambda theme: fx.long_original_scenario(theme, with_overlong=True), (1200, 1600)),
        ('memo', 'basic', 'test-55-3-memo', fx.timeline_overflow_scenario, (1200, 1600)),
    ],
}
DEFAULT_SET = '55-2'


def log_file(set_name: str) -> Path:
    return HERE / 'out' / f'seed-{set_name}.json'


class SeedApi(r.Api):
    def insert(self, table: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        status, data = self._request('POST', f'/rest/v1/{table}', json.dumps(rows).encode(),
                                     {'Content-Type': 'application/json', 'Prefer': 'return=representation'})
        if status not in (200, 201):
            raise RuntimeError(f'{table} 삽입 실패 (HTTP {status}{self.failure_note(status)}): {data[:200]!r}')
        return json.loads(data)

    def create_user(self, email: str) -> str:
        status, data = self._request('POST', '/auth/v1/admin/users',
                                     json.dumps({'email': email, 'email_confirm': True, 'user_metadata': {'test': True}}).encode(),
                                     {'Content-Type': 'application/json'})
        if status in (200, 201):
            return json.loads(data)['id']
        # 앞선 실행이 도중에 멈춰 계정만 남았다면 그 계정을 잇는다(이름이 test인 시험 계정만 찾는다)
        status, data = self._request('GET', '/auth/v1/admin/users?page=1&per_page=200')
        if status == 200:
            for u in json.loads(data).get('users', []):
                if u.get('email') == email:
                    return u['id']
        raise RuntimeError(f'계정 생성 실패 ({email}, HTTP {status}{self.failure_note(status)})')


# ---------------------------------------------------------------------------
# content - 합성 시험 데이터를 실제 ID·목적지 경로로 바꾼다
# ---------------------------------------------------------------------------

def realize(scenario: dict, couple_id: str, issue_id: str, ids: dict[str, str]) -> list[dict]:
    """시험 재료의 자리표시 ID(`eNN`·`d-날짜`)를 실제 UUID·목적지 경로로 바꾼 코너 행 목록."""
    text = json.dumps(scenario['corners'], ensure_ascii=False)
    for name in sorted(set(re.findall(r'/(e\d+)\.png', text))):
        text = text.replace(f'{fx.COUPLE}/{fx.ISSUE}/{name}.png', f'{couple_id}/{issue_id}/{ids[name]}.png')
    for key in sorted(set(re.findall(r'"(d-\d{4}-\d{2}-\d{2})"', text))):
        text = text.replace(f'"{key}"', f'"{ids[key]}"')
    return json.loads(text)


def chat_messages(rows: list[dict]) -> list[tuple]:
    """시드가 채팅 기록(`messages`)에 넣는 원문 줄 - (보낸 사람 이름 또는 None, 본문, 시각).

    지면에 실리는 두 사람의 말 줄은 모두 여기서 나온다: 다정한 말들의 인용 턴 · 그 밖의 짧은 말 · 이달의 우리 근거에 든 메시지 발췌(`evidence.excerpt`, 원문 그대로).
    근거 발췌는 보낸 사람이 content에 없으므로 이름은 None이다(호출부가 정한다). "지면에 실린 원문 = 기록의 메시지 하나와 글자 단위로 같다" 시험이 이 함수를 기준으로 삼는다 (R51-7).
    """
    out: list[tuple] = []
    for c in rows:
        if c['status'] != 'ready':
            continue
        if c['corner_type'] == 'sweet_words':
            for m in c['content']['payload']['main']:
                for t in m['turns']:
                    out.append((t['speaker'], t['text'], t['at']))
            for sub in c['content']['payload']['sub']:
                out.append((sub['speaker'], sub['text'], sub['attribution']['at']))
        if c['corner_type'] == 'this_month':
            for a in c['content']['payload']['articles']:
                for ev in a['evidence']:
                    if ev['type'] == 'message' and isinstance(ev.get('excerpt'), str):
                        out.append((None, ev['excerpt'], ev['at']))
    return out


def memo_texts(rows: list[dict]) -> list[str]:
    """시드가 `data_entries`(메모)에 넣는 글 - 데이트 아카이브 구간의 유저 메모 원문."""
    out: list[str] = []
    for c in rows:
        if c['corner_type'] == 'date_archive' and c['status'] == 'ready':
            for article in c['content']['payload']['articles']:
                for stop in article['stops']:
                    out.extend(n['text'] for n in stop['userNotes'] if n.get('type', 'memo') == 'memo' and n.get('text'))
    return out


def entry_names(scenario: dict) -> list[str]:
    return sorted(set(re.findall(r'/(e\d+)\.png', json.dumps(scenario['corners'], ensure_ascii=False))))


def new_ids(scenario: dict) -> dict[str, str]:
    ids = {name: str(uuid.uuid4()) for name in entry_names(scenario)}
    text = json.dumps(scenario['corners'], ensure_ascii=False)
    for key in set(re.findall(r'"(d-\d{4}-\d{2}-\d{2})"', text)):
        ids[key] = str(uuid.uuid4())
    return ids


def dump(folder: Path, set_name: str = DEFAULT_SET) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    for label, theme, nickname, build, _ in SETS[set_name]:
        scenario = build(theme)
        couple_id, issue_id = str(uuid.uuid4()), str(uuid.uuid4())
        for row in realize(scenario, couple_id, issue_id, new_ids(scenario)):
            if row['status'] == 'ready':
                (folder / f"{label}-{row['corner_type']}.json").write_text(json.dumps(row['content'], ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'content JSON {len(list(folder.glob("*.json")))}개 -> {folder}')


# ---------------------------------------------------------------------------
# 원격 쓰기
# ---------------------------------------------------------------------------

def kst(date_on: str, hhmm: str, plus_minutes: int = 0) -> str:
    base = datetime.fromisoformat(f'{date_on}T{hhmm}:00+09:00') + timedelta(minutes=plus_minutes)
    return base.isoformat()


def seed_one(api: SeedApi, log: dict, set_name: str, label: str, theme: str, nickname: str, build, size: tuple[int, int], say) -> None:
    scenario = build(theme)
    ids = new_ids(scenario)
    users = []
    for tag, name, gender in (('a', fx.A, 'male'), ('b', fx.B, 'female')):
        email = f'test-{set_name}-{label}-{tag}@example.com'
        uid = api.create_user(email)
        api.insert('profiles', [{'id': uid, 'display_name': name, 'gender': gender, 'birth_date': '1999-01-01', 'onboarding_step': 3,
                                 'terms_agreed_at': NOW, 'privacy_agreed_at': NOW, 'ai_usage_agreed_at': NOW}])
        users.append(uid)
        log['users'].append({'id': uid, 'email': email})
    by_name = {fx.A: users[0], fx.B: users[1]}
    couple = api.insert('couples', [{'user_a_id': users[0], 'user_b_id': users[1], 'invite_code': f"T{set_name.replace('-', '')}{label[:2].upper()}{uuid.uuid4().hex[:2].upper()}",
                                      'nickname': nickname, 'status': 'active', 'connected_at': NOW, 'magazine_theme': theme}])[0]
    couple_id = couple['id']
    log['couples'].append({'label': label, 'id': couple_id, 'nickname': nickname, 'theme': theme})
    issue = api.insert('issues', [{'couple_id': couple_id, 'issue_type': 'monthly', 'period_start': '2026-09-01', 'period_end': '2026-09-30',
                                    'publish_mode': 'compressed'}])[0]
    issue_id = issue['id']
    log['issues'].append({'label': label, 'id': issue_id, 'coupleId': couple_id})
    say(f'{label}: 커플 {couple_id} · 호 {issue_id} (테마 {theme})')

    rows = realize(scenario, couple_id, issue_id, ids)
    article_rows = [c for c in rows if c['corner_type'] == 'date_archive' and c['status'] == 'ready']
    date_ids: list[str] = []
    photo_for_entry: dict[str, tuple[str, str]] = {}  # entry uuid -> (원본 경로, 목적지 경로)

    # 원재료 행 - 데이트·구간·사진·메모. 내용은 content와 같은 사실이다(발행 노트의 "모은 양"이 이 행들을 센다).
    if article_rows:
        for article in article_rows[0]['content']['payload']['articles']:
            date_id = ids[f"d-{article['dateOn']}"]
            api.insert('dates', [{'id': date_id, 'couple_id': couple_id, 'date_on': article['dateOn'], 'region': article['region'],
                                  'photo_count': sum(len(s['photos']) for s in article['stops'])}])
            if not article['recalled']:
                date_ids.append(date_id)
            for stop in article['stops']:
                stop_id = str(uuid.uuid4())
                api.insert('date_stops', [{'id': stop_id, 'date_id': date_id, 'couple_id': couple_id, 'seq': stop['seq'],
                                           'arrived_at': kst(article['dateOn'], stop['time']), 'place_name': stop['placeName'],
                                           'lat': stop['lat'], 'lng': stop['lng']}])
                for photo in stop['photos']:
                    entry_id = photo['path'].split('/')[-1].split('.')[0]
                    api.insert('data_entries', [{
                        'id': entry_id, 'couple_id': couple_id, 'author_id': users[0], 'date_id': date_id, 'date_stop_id': stop_id,
                        'entry_type': 'photo', 'storage_path': f'{couple_id}/{entry_id}.png', 'width': photo['width'], 'height': photo['height'],
                        'captured_at': kst(article['dateOn'], stop['time'], 2), 'created_at': kst(article['dateOn'], stop['time'], 3),
                        'access_locked': False}])
                    photo_for_entry[entry_id] = (f'{couple_id}/{entry_id}.png', photo['path'])
                for note in stop['userNotes']:
                    api.insert('data_entries', [{
                        'id': str(uuid.uuid4()), 'couple_id': couple_id, 'author_id': by_name[note['authorName']], 'date_id': date_id,
                        'date_stop_id': stop_id, 'entry_type': 'memo', 'text_content': note.get('text'),
                        'captured_at': kst(article['dateOn'], stop['time'], 5), 'created_at': kst(article['dateOn'], stop['time'], 6),
                        'access_locked': False}])
    # 이달의 우리 근거 사진 - 데이트에 묶이지 않은 독립 사진
    for c in rows:
        if c['corner_type'] == 'this_month' and c['status'] == 'ready':
            for a in c['content']['payload']['articles']:
                for ev in a['evidence']:
                    if ev['type'] == 'photo':
                        entry_id = ev['photoPath'].split('/')[-1].split('.')[0]
                        api.insert('data_entries', [{
                            'id': entry_id, 'couple_id': couple_id, 'author_id': users[0], 'entry_type': 'photo',
                            'storage_path': f'{couple_id}/{entry_id}.png', 'width': size[0], 'height': size[1],
                            'captured_at': ev['at'], 'created_at': ev['at'], 'access_locked': False}])
                        photo_for_entry[entry_id] = (f'{couple_id}/{entry_id}.png', ev['photoPath'])
    # 채팅 - 지면에 실린 원문과 같은 줄(`chat_messages`) + 배경 대화
    messages = [(by_name[speaker] if speaker else users[0], text, at) for speaker, text, at in chat_messages(rows)]
    for i in range(10):
        messages.append((users[i % 2], f'시험용 대화 {i + 1}', kst('2026-09-05', '12:00', i * 7)))
    api.insert('messages', [{'id': str(uuid.uuid4()), 'couple_id': couple_id, 'sender_id': s, 'body': b, 'sent_at': at} for s, b, at in messages])

    # 사진 - 원본(entries)과 목적지 사본(magazine). 복제(P7)가 하는 일을 미리 해 둔다
    bytes_cache: dict[str, bytes] = {}
    for entry_id, (source, dest) in photo_for_entry.items():
        data = bytes_cache.setdefault(entry_id, fx.png(size[0], size[1], hue=sum(map(ord, entry_id)) % 80))
        api.storage_put('entries', source, data, 'image/png')
        api.storage_put(r.MAGAZINE_BUCKET, dest, data, 'image/png')
        log['storage'].append({'bucket': 'entries', 'path': source})
        log['storage'].append({'bucket': r.MAGAZINE_BUCKET, 'path': dest})

    for c in rows:
        inserted = api.insert('corners', [{
            'couple_id': couple_id, 'issue_id': issue_id, 'corner_type': c['corner_type'], 'seq': c['seq'],
            'period_start': '2026-09-01', 'period_end': '2026-09-30', 'status': c['status'], 'content': c['content'],
            'skip_reason': c['skip_reason'], 'source_date_ids': date_ids if c['corner_type'] == 'date_archive' else [],
            'engine_version': f'fixture-{set_name}'}])[0]
        log['corners'].append({'id': inserted['id'], 'issueLabel': label, 'cornerType': c['corner_type'], 'status': c['status']})
    say(f'{label}: 사진 {len(photo_for_entry)}장 · 채팅 {len(messages)}줄 · 코너 {len(rows)}')


def run(set_name: str = DEFAULT_SET) -> int:
    sys.stdout.reconfigure(encoding='utf-8')
    LOG_FILE = log_file(set_name)
    api0, ref, secrets = r.connect()
    api = SeedApi(api0.base, secrets[0])

    def say(line: str) -> None:
        print(r.redact(line, secrets))

    say(f'접속 대상: 개발 프로젝트 {r.DEVELOPMENT_PROJECT_NAME} - 확인됨 (프로젝트 ref는 출력하지 않는다)')
    log: dict[str, list] = {'users': [], 'couples': [], 'issues': [], 'corners': [], 'storage': []}
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    try:
        for label, theme, nickname, build, size in SETS[set_name]:
            seed_one(api, log, set_name, label, theme, nickname, build, size, say)
    finally:  # 도중에 실패해도 그때까지 만든 행·파일의 목록은 남긴다(지우지 않는다)
        LOG_FILE.write_text(r.redact(json.dumps(log, ensure_ascii=False, indent=2), secrets) + '\n', encoding='utf-8')
        say(f'목록 파일: {LOG_FILE}')
    return 0


if __name__ == '__main__':
    args = sys.argv[1:]
    chosen = args[-1] if args and args[-1] in SETS else DEFAULT_SET
    if len(args) >= 2 and args[0] == 'dump':
        dump(Path(args[1]), chosen)
    elif args[:1] == ['run'] and len(args) in (1, 2):
        try:
            sys.exit(run(chosen))
        except r.StopError as e:
            print(f'멈춤: {e}', file=sys.stderr)
            sys.exit(2)
    else:
        sys.exit('사용: dump <폴더> [세트] | run [세트]   (세트: ' + ' | '.join(SETS) + ')')
