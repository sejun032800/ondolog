"""높이 표를 잰 환경 기록 · 비교 (위임: 84-d2, ROADMAP R138-2 ①).

높이 표(`render/issue/measure.json`)는 "글자가 이 환경에서 몇 줄로 그려지나"라는 **환경의 사실**이다(R138-2). 같은 표라도 OS · Chromium 판 ·
글꼴 파일이 다르면 줄 수가 달라진다(84-d: 디자인 환경 표를 이 PC에서 다시 재면 줄 수가 한 줄씩 컸다).
디자인 도구(`render/issue/tools/measure.py`)의 출력 형식은 바꾸지 않고, 잰 환경은 **옆 파일** `render/issue/measure.env.json`에 둔다.

  - 기록: 표를 다시 잰 직후 저장소 루트에서 `render/.venv/Scripts/python.exe -B render/measure_env.py --write`
  - 비교: 렌더러가 렌더를 시작할 때 `env_warnings()` - 다르면 **경고만**(멈추지 않는다. 넘친 지면은 렌더 뒤 지면 검사가 따로 막는다)
  - 렌더가 다른 곳(서버)으로 옮겨 가면 그 환경에서 표를 다시 재고 이 파일도 다시 쓴다(R138-2 ③ · M4)

네트워크를 모른다. 파일만 읽는다(브라우저를 띄우지 않는다 - Chromium 판은 Playwright 꾸러미의 `browsers.json`에서 읽는다).
"""

from __future__ import annotations

import hashlib
import json
import platform
import sys
from pathlib import Path
from typing import Any, Optional

sys.dont_write_bytecode = True

ISSUE_DIR = Path(__file__).resolve().parent / 'issue'
MEASURE_PATH = ISSUE_DIR / 'measure.json'
ENV_PATH = ISSUE_DIR / 'measure.env.json'
FONTS_DIR = ISSUE_DIR / 'fonts'
COMPARED = ('os', 'osRelease', 'chromium', 'fonts', 'measureJson')   # 줄 수를 바꿀 수 있는 것 + 표 파일 자체
LABELS = {'os': 'OS', 'osRelease': 'OS 판', 'chromium': 'Chromium(Playwright) 판', 'fonts': '글꼴 파일', 'measureJson': '높이 표 파일(measure.json)'}


def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def chromium_version() -> str:
    """Playwright가 쓰는 Chromium 판 - 꾸러미의 `browsers.json`(`browserVersion`). 읽지 못하면 'unknown'."""
    try:
        import playwright
        data = json.loads((Path(playwright.__file__).resolve().parent / 'driver' / 'package' / 'browsers.json').read_text(encoding='utf-8'))
        return next(b['browserVersion'] for b in data['browsers'] if b.get('name') == 'chromium')
    except Exception:   # noqa: BLE001 - 판을 모르면 그렇게 적는다(지어내지 않는다)
        return 'unknown'


def playwright_version() -> str:
    try:
        from importlib.metadata import version
        return version('playwright')
    except Exception:   # noqa: BLE001
        return 'unknown'


def current_env() -> dict[str, Any]:
    """지금 환경 - 비교하는 칸(`COMPARED`)과 참고 칸(platform 전체 문자열 · Playwright 판)."""
    return {
        'os': platform.system(),
        'osRelease': platform.release(),
        'chromium': chromium_version(),
        'fonts': {p.name: sha256_of(p) for p in sorted(FONTS_DIR.glob('*.otf'))},
        'measureJson': hashlib.sha256(MEASURE_PATH.read_bytes().replace(b'\r\n', b'\n')).hexdigest(),   # 줄끝(git autocrlf)과 무관하게
        'info': {'platform': platform.platform(), 'machine': platform.machine(), 'playwright': playwright_version()},
    }


def read_recorded(path: Path = ENV_PATH) -> Optional[dict]:
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None


def env_warnings(recorded: Optional[dict] = None, current: Optional[dict] = None, path: Path = ENV_PATH) -> list:
    """잰 환경과 지금 환경이 다른 칸마다 경고 한 줄. 같으면 빈 목록. 기록 파일이 없으면 그 사실 한 줄."""
    recorded = read_recorded(path) if recorded is None else recorded
    current = current_env() if current is None else current
    if not isinstance(recorded, dict):
        return [f'높이 표를 잰 환경 기록이 없다({path.name}) - 표가 이 환경의 줄 수와 맞는지 알 수 없다']
    out = []
    for key in COMPARED:
        if recorded.get(key) != current.get(key):
            if key == 'fonts':
                a, b = recorded.get(key) or {}, current.get(key) or {}
                names = sorted(n for n in set(a) | set(b) if a.get(n) != b.get(n))
                detail = ', '.join(names)
            elif key == 'measureJson':
                detail = '표를 다시 잰 뒤 환경 기록을 다시 쓰지 않았다'
            else:
                detail = f'{recorded.get(key)} -> {current.get(key)}'
            out.append(f'높이 표를 잰 환경과 {LABELS[key]}이(가) 다르다 ({detail}) - 줄 수 어림이 실제와 다를 수 있다(넘친 지면은 지면 검사가 막는다)')
    return out


def write_env(path: Path = ENV_PATH, note: str = '') -> dict:
    env = current_env()
    env['note'] = note or ('render/issue/tools/measure.py(디자인 도구, 고치지 않음)를 이 환경에서 그대로 돌린 표의 환경. '
                           '렌더가 다른 환경(서버)으로 옮겨 가면 그곳에서 다시 재고 이 파일을 다시 쓴다(R138-2 ③ · M4)')
    path.write_text(json.dumps(env, ensure_ascii=False, indent=1) + '\n', encoding='utf-8', newline='\n')
    return env


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    if sys.argv[1:] == ['--write']:
        print(json.dumps(write_env(), ensure_ascii=False, indent=1))
    else:
        print('\n'.join(env_warnings()) or '같은 환경 - 경고 0')
