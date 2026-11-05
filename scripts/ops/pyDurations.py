"""Python test timing wrapper (72c-, R59-4). Standard library only.

Finds and runs render/tests the same way as the plain command
(`render/.venv/Scripts/python.exe -B -m unittest discover -s render/tests`),
and only measures time per test. Pass/fail verdicts are unchanged.

Run from the repository root:
    render/.venv/Scripts/python.exe -B scripts/ops/pyDurations.py

Prints total seconds, pass/fail counts and the slowest 10 tests; writes the same
text to scripts/ops/out/py-durations-<timestamp>.txt (git-ignored).
"""
import os
import sys
import time
import unittest

sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
TESTS = os.path.join(ROOT, 'render', 'tests')
OUT_DIR = os.path.join(HERE, 'out')


class TimedResult(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.times = []
        self._t0 = None

    def startTest(self, test):
        self._t0 = time.perf_counter()
        super().startTest(test)

    def stopTest(self, test):
        super().stopTest(test)
        self.times.append((time.perf_counter() - self._t0, test.id()))


def main():
    started = time.perf_counter()
    suite = unittest.defaultTestLoader.discover(TESTS)
    runner = unittest.TextTestRunner(resultclass=TimedResult, verbosity=1)
    result = runner.run(suite)
    total = time.perf_counter() - started

    failed = len(result.failures) + len(result.errors)
    passed = result.testsRun - failed - len(result.skipped)
    lines = [
        '',
        f'TOTAL {total:.1f}s  RUN {result.testsRun}  PASS {passed}  FAIL {failed}  SKIP {len(result.skipped)}',
        'SLOWEST 10',
    ]
    for secs, name in sorted(result.times, reverse=True)[:10]:
        lines.append(f'{secs:8.2f}s  {name}')
    report = '\n'.join(lines)
    print(report)

    os.makedirs(OUT_DIR, exist_ok=True)
    stamp = time.strftime('%Y%m%d-%H%M%S')
    with open(os.path.join(OUT_DIR, f'py-durations-{stamp}.txt'), 'w', encoding='utf-8') as fh:
        fh.write(report.lstrip('\n') + '\n')
    sys.exit(0 if result.wasSuccessful() else 1)


if __name__ == '__main__':
    main()
