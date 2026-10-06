/**
 * 코너 3종 테스트 픽스처 — 입력 조립이 만들어 줄 입력을 흉내 낸다
 * (docs/ONDOLOG_MASTER.md §17-0-5-E: `#14`는 입력을 픽스처로 시험한다).
 *
 * 테스트 전용이다. 운영 코드가 이 파일을 import하지 않는다.
 *
 * 출처 표기(`attribution.display`)는 **시간대 라벨 함수(`timeOfDayLabel`)로 만든다**(r45) - 입력 조립이 나중에
 * 같은 함수를 부르므로, 표기 형식이 입력 조립 전에 시험된다. 날짜·시각 문자열은 한국 시간 리터럴에서 잘라 쓴다
 * (실행 환경의 시간대를 읽지 않는다).
 */

import type { CornerContext } from '../cornerPipeline.ts'
import type { LlmCallResult, LlmClient } from '../llmClient.ts'
import type { LlmRequest } from '../llmRequest.ts'
import type {
  ChatMessageRecord,
  DateRecord,
  DateStopSource,
  PhotoRecord,
} from '../corners/cornerCommon.ts'
import { timeOfDayLabel } from '../timeOfDayLabel.ts'

export const COUPLE_A = 'couple-a'
export const COUPLE_B = 'couple-b'

/** 2026년 8월(한국 시간) `[start, end)`. */
export const AUG_START = new Date('2026-08-01T00:00:00+09:00')
export const AUG_END = new Date('2026-09-01T00:00:00+09:00')

export const MONTHLY_CONTEXT: CornerContext = {
  coupleId: COUPLE_A,
  period: { start: AUG_START, end: AUG_END },
  cadence: 'monthly',
  periodLabel: '2026년 8월',
}

/** 일간판 - 어제 하루. */
export const DAILY_CONTEXT: CornerContext = {
  coupleId: COUPLE_A,
  period: { start: new Date('2026-08-22T00:00:00+09:00'), end: new Date('2026-08-23T00:00:00+09:00') },
  cadence: 'daily',
  periodLabel: '2026년 8월 22일',
}

/** `"2026-08-22T09:20:00"`(한국 시간) -> `"2026-08-22T09:20:00+09:00"`. */
function kstIso(localIso: string): string {
  return `${localIso}+09:00`
}

/** `"2026-08-22T09:20:00"` -> `"2026.08.22 09:20"`. 문자열만 자른다(시간대를 읽지 않는다). */
function displayStamp(localIso: string): string {
  const [date, time] = localIso.split('T')
  return `${date.replaceAll('-', '.')} ${time.slice(0, 5)}`
}

export function message(
  id: string,
  localIso: string,
  speaker: string,
  text: string,
  over: Partial<Pick<ChatMessageRecord, 'coupleId'>> = {},
): ChatMessageRecord {
  const at = new Date(kstIso(localIso))
  return {
    id,
    coupleId: COUPLE_A,
    kind: 'message',
    occurredAt: at,
    source: {
      speaker,
      text,
      at: kstIso(localIso),
      attribution: {
        display: `${displayStamp(localIso)}, ${timeOfDayLabel(at)} 대화 중`,
        at: kstIso(localIso),
        source: 'chat',
      },
    },
    ...over,
  }
}

export function photo(id: string, localIso: string, path: string, over: Partial<Pick<PhotoRecord, 'coupleId'>> = {}): PhotoRecord {
  return {
    id,
    coupleId: COUPLE_A,
    kind: 'photo',
    occurredAt: new Date(kstIso(localIso)),
    source: { path, at: kstIso(localIso) },
    ...over,
  }
}

export function dateRecord(
  id: string,
  dateOn: string,
  region: string | null,
  stops: readonly DateStopSource[],
  over: Partial<Pick<DateRecord, 'coupleId' | 'recalled'>> & { recallReason?: DateRecord['source']['recallReason'] } = {},
): DateRecord {
  const { recallReason = null, ...rest } = over
  return {
    id,
    coupleId: COUPLE_A,
    kind: 'date',
    occurredAt: new Date(kstIso(`${dateOn}T00:00:00`)),
    source: { dateOn, region, recallReason, stops },
    ...rest,
  }
}

// ---------------------------------------------------------------------------
// 채팅 - 다정한 대화·다툼·새벽 한 줄
// ---------------------------------------------------------------------------

export const CHAT_MESSAGES: readonly ChatMessageRecord[] = [
  message('m-1', '2026-08-22T09:20:00', '세준', '오늘 비 온대. 우산 챙겼어?'),
  message('m-2', '2026-08-22T09:21:30', '서영', '응 챙겼어. 너도 감기 조심해'),
  message('m-3', '2026-08-11T23:40:00', '서영', '오늘 고생했어 진짜'),
  message('m-4', '2026-08-15T14:00:00', '세준', '야 왜 답장 안 해'),
  message('m-5', '2026-08-15T14:05:00', '서영', '몰라'),
  message('m-6', '2026-08-03T03:30:00', '세준', '자? ㅎㅎ 보고 싶다  \n(개행·공백 그대로)'),
]

// ---------------------------------------------------------------------------
// 데이트 - 이번 달 둘 + 재소환 하나
// ---------------------------------------------------------------------------

const D1_STOPS: readonly DateStopSource[] = [
  {
    seq: 0,
    time: '14:20',
    placeName: '홍대 CGV',
    lat: 37.5551,
    lng: 126.9236,
    photos: [{ path: 'photos/couple-a/aa01.jpg', width: 3024, height: 4032, capturedAt: '2026-08-19T14:22:11+09:00' }],
    userNotes: [{ authorId: 'u1', authorName: '세준', type: 'memo', text: '스파이더맨 봤다. 서영이는 중간에 졸았음' }],
  },
  {
    seq: 1,
    time: '16:40',
    placeName: 'OO식당',
    lat: 37.5602,
    lng: 126.9251,
    photos: [{ path: 'photos/couple-a/aa02.jpg', width: 3024, height: 4032 }],
    userNotes: [],
  },
]

const D2_STOPS: readonly DateStopSource[] = [
  { seq: 0, time: '13:00', placeName: '성수 OO카페', lat: 37.5446, lng: 127.0559, photos: [], userNotes: [] },
  // 장소명이 없는 구간 - 좌표가 있어도 핀을 만들지 않는다.
  { seq: 1, time: '15:00', placeName: null, lat: 37.5447, lng: 127.056, photos: [], userNotes: [] },
]

const D_OLD_STOPS: readonly DateStopSource[] = [
  { seq: 0, time: '11:00', placeName: '합정 OO공원', lat: 37.5496, lng: 126.9139, photos: [], userNotes: [] },
]

export const DATE_THIS_1 = dateRecord('d-1', '2026-08-19', '연남동', D1_STOPS)
export const DATE_THIS_2 = dateRecord('d-2', '2026-08-26', '성수동', D2_STOPS)
/** 재소환 - 기간 이전(2025-08-19). */
export const DATE_RECALLED = dateRecord('d-old', '2025-08-19', '합정동', D_OLD_STOPS, {
  recalled: true,
  recallReason: 'anniversary',
})

export const PHOTOS: readonly PhotoRecord[] = [
  photo('p-1', '2026-08-19T14:22:11', 'photos/couple-a/aa01.jpg'),
  photo('p-2', '2026-08-26T13:40:00', 'photos/couple-a/bb01.jpg'),
]

// ---------------------------------------------------------------------------
// 가짜 LlmClient
// ---------------------------------------------------------------------------

/** 미리 정한 응답을 순서대로 돌려주는 가짜 클라이언트. 받은 요청을 기록한다. 마지막 응답은 반복된다. */
export function scriptedLlmClient(texts: readonly string[]): LlmClient & { requests: LlmRequest[] } {
  const requests: LlmRequest[] = []
  return {
    requests,
    call: (request: LlmRequest): Promise<LlmCallResult> => {
      const text = texts[Math.min(requests.length, texts.length - 1)]
      requests.push(request)
      return Promise.resolve({ ok: true, text })
    },
  }
}
