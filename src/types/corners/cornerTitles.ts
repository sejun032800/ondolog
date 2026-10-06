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

/** 지면 제목이 지켜야 하는 형식(r41). 라틴 문자·숫자 금지, 7자 이내. */
export const PAGE_TITLE_PATTERN = /^[가-힣 ]{1,7}$/
