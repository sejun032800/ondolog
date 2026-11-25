/**
 * 코너 이름·지면 제목 상수 (docs/ONDOLOG_MASTER.md §17-0-7, r41·r45).
 *
 * 코너 3종(#14 3단계)의 값만 둔다. 다른 코너의 값은 그 코너를 다루는 작업이 더한다.
 *
 * - `cornerName`: 코너 이름 — 앱 화면·목차용, 길이 제한 없음.
 * - `pageTitle`: 지면 제목 — 지면 머리용, 한글과 공백만, 7자 이내 (`^[가-힣 ]{1,7}$`).
 *   온돌 테마 세로쓰기의 물리적 한계라 상수여도 지켜야 한다(§9-7-2). 코너 이름과 하나로 두지 않는다.
 *
 * 두 값 모두 **코너별 고정 상수**다. LLM이 쓰지 않는다. 문구는 디자인 세션이 정하며 바꿀 때도
 * 디자인이 정한다. 17-4의 코너 이름은 "다정한 말들"이다("이달의 다정한 말들"은 월간판의 지면 헤드
 * 문구이지 코너 이름이 아니다 - r45).
 *
 * 이 파일은 다른 파일을 import하지 않는 leaf다 - 앱(루트 tsc)과 Edge Function(전용 tsconfig)이
 * 둘 다 읽는다(MASTER 17-0-3-A, r22 "배타적").
 */

export type CornerTypeId = 'date_archive' | 'sweet_words' | 'this_month'

export interface CornerTitles {
  readonly cornerName: string
  readonly pageTitle: string
}

export const CORNER_TITLES: Readonly<Record<CornerTypeId, CornerTitles>> = {
  date_archive: { cornerName: '데이트 아카이브', pageTitle: '함께한 하루' },
  sweet_words: { cornerName: '다정한 말들', pageTitle: '다정한 말들' },
  this_month: { cornerName: '이달의 우리', pageTitle: '이달의 우리' },
}

/**
 * 매거진 2.0-A1 새 지면의 이름 · 제목(기획서 1절 · ROADMAP R157-7 「다음 달」). 위 3코너 표(`CORNER_TITLES`)와 따로 둔다 —
 * 앱(`magazineApi.ts`)이 읽는 3코너 표와 그 시험을 바꾸지 않기 위해서다.
 * - 코너(`corner_type` 값이 있는 것): `love_dna` · `rough_guess` · `appendix`.
 * - 부속(DB 코너 값 0 - `appendix` 행에 함께 실림): `photo_break` · `next_month` · `colophon`.
 * - 「판권 · 정오」는 가운뎃점이 지면 제목 형식(`^[가-힣 ]{1,7}$`)에 걸려 지면 제목을 "판권 정오"로 둔다(코너 이름은 기획서 그대로 - PM 확인 대상).
 */
export type NewPageId = 'love_dna' | 'rough_guess' | 'appendix' | 'photo_break' | 'next_month' | 'colophon'

export const NEW_PAGE_TITLES: Readonly<Record<NewPageId, CornerTitles>> = {
  love_dna: { cornerName: '우리의 연애 DNA', pageTitle: '두 사람의 결' },
  rough_guess: { cornerName: '얼렁뚱땅 어림짐작', pageTitle: '어림짐작' },
  appendix: { cornerName: '잡지 부록', pageTitle: '부록' },
  photo_break: { cornerName: '사진 한 장', pageTitle: '사진 한 장' },
  next_month: { cornerName: '다음 달', pageTitle: '다음 달' },
  colophon: { cornerName: '판권 · 정오', pageTitle: '판권 정오' },
}

/** 지면 제목이 지켜야 하는 형식(r41). 라틴 문자·숫자 금지, 7자 이내. */
export const PAGE_TITLE_PATTERN = /^[가-힣 ]{1,7}$/
