/**
 * M1 합성 데이터셋 - 가상 커플 세준·서영의 2026년 9월(KST). 전부 지어낸 값이다.
 *
 * DB 행 모양(messages·dates·date_stops·data_entries·profiles·couples)으로 만든다. 입력 레코드 변환은
 * 기존 입력 조립(`assembleCornerInput`)이 한다 - 이 파일이 레코드를 직접 만들지 않는다.
 *
 * 데이트 구성 (입력 조립의 재소환 규칙 §17-0-9-C: 재소환 건수 = max(0, 3 - 이번 기간 데이트 수))
 * - 2026-09-13 성수 (이번 기간): 정거장 3, 사진·유저 메모(서영)·그림(세준) 있음
 * - 2026-09-27 양평 (이번 기간): 정거장 3, 사진 한 장뿐 / 유저 메모 없음 / 이름·좌표 없는 정거장 포함
 * - 2025-09-20 강릉 (재소환 후보, 기념일 근접 1년 전): 사진·메모 있음
 * - 2026-03-08 근교 (재소환 탈락 후보): 사진이 없어 후보 4번 조건에 걸려 빠진다
 */

import { CHAT_SCRIPT } from './chat.ts'

export const COUPLE_ID = 'couple-m1'
export const SEJUN_ID = 'user-sejun'
export const SEOYOUNG_ID = 'user-seoyoung'

/** 생성 기간: 2026-09-01 00:00 ~ 2026-10-01 00:00 (KST, 반열린 구간). */
export const PERIOD = {
  start: new Date('2026-09-01T00:00:00+09:00'),
  end: new Date('2026-10-01T00:00:00+09:00'),
}

type Row = Record<string, unknown>

function parseChat(): Row[] {
  const rows: Row[] = []
  let day = ''
  let n = 0
  for (const rawLine of CHAT_SCRIPT.split('\n')) {
    const line = rawLine.trimEnd()
    if (line.trim() === '') continue
    const header = /^## (\d{2})-(\d{2})$/.exec(line)
    if (header !== null) {
      day = `2026-${header[1]}-${header[2]}`
      continue
    }
    const m = /^(\d{2}:\d{2}) (준|영) (.+)$/.exec(line)
    if (m === null || day === '') throw new Error(`채팅 줄 형식 오류: ${line}`)
    n += 1
    rows.push({
      id: `msg-${String(n).padStart(4, '0')}`,
      couple_id: COUPLE_ID,
      sender_id: m[2] === '준' ? SEJUN_ID : SEOYOUNG_ID,
      body: m[3],
      sent_at: `${day}T${m[1]}:00+09:00`,
      deleted_at: null,
    })
  }
  return rows
}

function photo(
  id: string,
  dateId: string | null,
  stopId: string | null,
  at: string | null,
  author: string,
  size: [number, number] | null = [3024, 4032],
): Row {
  return {
    id,
    couple_id: COUPLE_ID,
    author_id: author,
    date_id: dateId,
    date_stop_id: stopId,
    entry_type: 'photo',
    storage_path: `${COUPLE_ID}/${id}.jpg`,
    thumb_path: `${COUPLE_ID}/${id}_thumb.jpg`,
    width: size?.[0] ?? null,
    height: size?.[1] ?? null,
    text_content: null,
    drawing_path: null,
    captured_at: at,
    created_at: at ?? '2026-09-30T23:00:00+09:00',
    deleted_at: null,
    access_locked: false,
  }
}

function memo(id: string, dateId: string, stopId: string | null, author: string, text: string, createdAt: string): Row {
  return {
    id,
    couple_id: COUPLE_ID,
    author_id: author,
    date_id: dateId,
    date_stop_id: stopId,
    entry_type: 'memo',
    storage_path: null,
    thumb_path: null,
    width: null,
    height: null,
    text_content: text,
    drawing_path: null,
    captured_at: null,
    created_at: createdAt,
    deleted_at: null,
    access_locked: false,
  }
}

function drawing(id: string, dateId: string, stopId: string | null, author: string, createdAt: string): Row {
  return {
    id,
    couple_id: COUPLE_ID,
    author_id: author,
    date_id: dateId,
    date_stop_id: stopId,
    entry_type: 'drawing',
    storage_path: null,
    thumb_path: null,
    width: null,
    height: null,
    text_content: null,
    drawing_path: `${COUPLE_ID}/${id}.png`,
    captured_at: null,
    created_at: createdAt,
    deleted_at: null,
    access_locked: false,
  }
}

function stop(id: string, dateId: string, seq: number, at: string, name: string | null, lat: number | null, lng: number | null): Row {
  return { id, couple_id: COUPLE_ID, date_id: dateId, seq, arrived_at: at, place_name: name, lat, lng }
}

export function buildTables(): Record<string, readonly Row[]> {
  const dates: Row[] = [
    { id: 'date-0913', couple_id: COUPLE_ID, date_on: '2026-09-13', region: '성수', photo_count: 4, last_featured_at: null, deleted_at: null },
    { id: 'date-0927', couple_id: COUPLE_ID, date_on: '2026-09-27', region: '양평', photo_count: 1, last_featured_at: null, deleted_at: null },
    // 재소환 후보: 이번 기간을 정확히 1년 과거로 옮긴 구간 안(기념일 근접), 한 번도 실리지 않음.
    { id: 'date-2025-0920', couple_id: COUPLE_ID, date_on: '2025-09-20', region: '강릉', photo_count: 3, last_featured_at: null, deleted_at: null },
    // 재소환 탈락: 사진 없음(후보 4번 조건).
    { id: 'date-2026-0308', couple_id: COUPLE_ID, date_on: '2026-03-08', region: '파주', photo_count: 0, last_featured_at: null, deleted_at: null },
  ]

  const stops: Row[] = [
    stop('stop-0913-1', 'date-0913', 1, '2026-09-13T11:00:00+09:00', '성수동 카페 모퉁이', 37.5446, 127.0557),
    stop('stop-0913-2', 'date-0913', 2, '2026-09-13T13:10:00+09:00', '서울숲', 37.5444, 127.0374),
    stop('stop-0913-3', 'date-0913', 3, '2026-09-13T17:30:00+09:00', '뚝섬 저녁집', 37.5473, 127.0447),
    stop('stop-0927-1', 'date-0927', 1, '2026-09-27T11:20:00+09:00', '양평 두물머리', 37.5446, 127.3086),
    stop('stop-0927-2', 'date-0927', 2, '2026-09-27T13:40:00+09:00', null, null, null),
    stop('stop-0927-3', 'date-0927', 3, '2026-09-27T16:00:00+09:00', '양평역 앞 시장', 37.4921, 127.4876),
    stop('stop-2025-1', 'date-2025-0920', 1, '2025-09-20T10:30:00+09:00', '안목해변', 37.7727, 128.9478),
    stop('stop-2025-2', 'date-2025-0920', 2, '2025-09-20T15:00:00+09:00', '강릉 중앙시장', 37.7515, 128.8997),
    stop('stop-0308-1', 'date-2026-0308', 1, '2026-03-08T13:00:00+09:00', '헤이리 마을', 37.7924, 126.6955),
  ]

  const entries: Row[] = [
    // 09-13 성수: 사진 + 서영 메모(첫 정거장) + 세준 그림(셋째 정거장) + 데이트 단위 메모
    photo('ph-0913-1', 'date-0913', 'stop-0913-1', '2026-09-13T11:20:00+09:00', SEOYOUNG_ID),
    photo('ph-0913-2', 'date-0913', 'stop-0913-1', '2026-09-13T11:35:00+09:00', SEJUN_ID),
    photo('ph-0913-3', 'date-0913', 'stop-0913-2', '2026-09-13T14:00:00+09:00', SEJUN_ID),
    photo('ph-0913-4', 'date-0913', null, '2026-09-13T20:05:00+09:00', SEOYOUNG_ID),
    memo('memo-0913-1', 'date-0913', 'stop-0913-1', SEOYOUNG_ID, '창가 자리에서 케이크 사진을 오래 찍었다. 촛불은 하나만 꽂았다.', '2026-09-13T21:30:00+09:00'),
    drawing('draw-0913-1', 'date-0913', 'stop-0913-3', SEJUN_ID, '2026-09-13T22:10:00+09:00'),
    memo('memo-0913-2', 'date-0913', null, SEJUN_ID, '생일 계획 성공.', '2026-09-13T23:00:00+09:00'),
    // 09-27 양평: 사진 한 장, 메모 없음
    photo('ph-0927-1', 'date-0927', 'stop-0927-1', '2026-09-27T12:30:00+09:00', SEOYOUNG_ID),
    // 2025-09-20 강릉(재소환)
    photo('ph-2025-1', 'date-2025-0920', 'stop-2025-1', '2025-09-20T10:50:00+09:00', SEJUN_ID),
    photo('ph-2025-2', 'date-2025-0920', 'stop-2025-1', '2025-09-20T11:10:00+09:00', SEOYOUNG_ID),
    photo('ph-2025-3', 'date-2025-0920', 'stop-2025-2', '2025-09-20T15:20:00+09:00', SEJUN_ID),
    memo('memo-2025-1', 'date-2025-0920', 'stop-2025-1', SEOYOUNG_ID, '바람이 너무 세서 머리가 엉망이었다. 그래도 파도 소리가 좋았다.', '2025-09-20T22:00:00+09:00'),
    // 독립 사진(데이트에 묶이지 않음): 17-5 사진 근거 재료
    photo('ph-solo-0905', null, null, '2026-09-05T19:48:00+09:00', SEOYOUNG_ID, [4032, 3024]),
    photo('ph-solo-0905b', null, null, '2026-09-05T19:51:00+09:00', SEJUN_ID, [4032, 3024]),
    photo('ph-solo-0911', null, null, '2026-09-11T19:20:00+09:00', SEOYOUNG_ID),
    photo('ph-solo-0914', null, null, '2026-09-14T18:40:00+09:00', SEJUN_ID),
    photo('ph-solo-0920', null, null, '2026-09-20T18:15:00+09:00', SEOYOUNG_ID),
    photo('ph-solo-0928', null, null, '2026-09-28T14:30:00+09:00', SEJUN_ID),
  ]

  return {
    couples: [{ id: COUPLE_ID, subscription_tier: 'paid' }],
    profiles: [
      { id: SEJUN_ID, display_name: '세준' },
      { id: SEOYOUNG_ID, display_name: '서영' },
    ],
    messages: parseChat(),
    dates,
    date_stops: stops,
    data_entries: entries,
  }
}
