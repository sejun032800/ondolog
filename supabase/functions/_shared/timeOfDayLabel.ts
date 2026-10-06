/**
 * 시간대 라벨 — 메시지 시각에서 "아침"·"저녁" 같은 라벨을 만든다
 * (docs/ONDOLOG_MASTER.md §17-0-7 "17-4 시간대 라벨", r45).
 *
 * 예: "— 2026.08.22 09:20, 아침 대화 중"의 "아침". **파이프라인이 결정론적으로 만든다. LLM이 쓰지 않는다.**
 * 이 함수는 라벨 하나만 만든다. 표기 문자열 전체를 조립하는 것은 입력 조립의 일이고, 그때 같은 함수를
 * 부른다(기간 판정을 한 함수에 둔 것과 같은 이유). 3단계에서는 코너 픽스처가 이 함수로 표기값을 만들어
 * 표기 형식을 입력 조립 전에 시험한다.
 *
 * ── 한국 시간은 고정 오프셋 +09:00으로 계산한다 ──────────────────────────
 * 실행 환경의 시간대에 기대지 않는다. Edge Function은 UTC로, 개발 기기는 한국 시간으로 돌아 같은 코드가
 * 다른 라벨을 낼 수 있기 때문이다. 한국은 일광 절약 시간이 없어 고정 오프셋이 정확하다. 그래서 이
 * 파일은 `getHours()`·`toLocale*`·`Intl` 같은 **실행 환경 시간대를 읽는 호출을 쓰지 않는다** - 순간(밀리초)에
 * 오프셋을 더한 뒤 `getUTC*`만 읽는다.
 *
 * 위치는 `supabase/functions/_shared/`다. `src/engine/`에 두지 않는다 - 시각을 날짜로 읽는 일이 정적
 * 규칙 A(결정론 금지 식별자)와 부딪힌다(r45).
 *
 * ── 라벨과 경계 (§17-0-7 표 그대로) ───────────────────────────────────────
 * | 라벨 | 한국 시간 |
 * |---|---|
 * | 새벽 | 00:00 – 05:00 |
 * | 아침 | 05:00 – 11:00 |
 * | 낮 | 11:00 – 17:00 |
 * | 저녁 | 17:00 – 21:00 |
 * | 밤 | 21:00 – 24:00 |
 *
 * 경계는 앞쪽 포함·뒤쪽 배타다(05:00은 아침, 04:59:59.999는 새벽). 라벨 문구는 디자인이 바꿀 수 있다 -
 * 문구는 `TIME_OF_DAY_LABELS` 한 곳에만 둔다.
 */

export type TimeOfDayLabel = '새벽' | '아침' | '낮' | '저녁' | '밤'

/** 한국 표준시 고정 오프셋(분). 일광 절약 시간이 없다. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * 시작 시각(한국 시간, 시)이 작은 것부터. 각 구간은 `[startHour, 다음 startHour)`.
 * 문구를 바꿀 때는 `label`만 고친다.
 */
export const TIME_OF_DAY_LABELS: readonly { readonly startHour: number; readonly label: TimeOfDayLabel }[] = [
  { startHour: 0, label: '새벽' },
  { startHour: 5, label: '아침' },
  { startHour: 11, label: '낮' },
  { startHour: 17, label: '저녁' },
  { startHour: 21, label: '밤' },
]

/**
 * 순간 `at`의 한국 시간 시각으로 라벨을 정한다. 실행 환경의 시간대와 무관하다.
 * 날짜가 아닌 값은 추측하지 않고 던진다(`RangeError`).
 */
export function timeOfDayLabel(at: Date): TimeOfDayLabel {
  const ms = at.getTime()
  if (Number.isNaN(ms)) {
    throw new RangeError('timeOfDayLabel: 날짜가 아닌 값')
  }
  // 오프셋을 더한 가상의 UTC 시각에서 `getUTCHours`를 읽는다 - 이 값은 한국 시간의 시(時)다.
  const hourInKorea = new Date(ms + KST_OFFSET_MS).getUTCHours()
  let label: TimeOfDayLabel = TIME_OF_DAY_LABELS[0].label
  for (const band of TIME_OF_DAY_LABELS) {
    if (hourInKorea >= band.startHour) label = band.label
  }
  return label
}
