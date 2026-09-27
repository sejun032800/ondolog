/**
 * 색 토큰 — docs/ONDOLOG_DESIGN.md §1 그대로.
 *
 * 본지(라이트/다크) + 별지(연애리그 전용, 본지와 반대 지질) + 4기후(36종
 * 라벨 배지 전용) 4개 팔레트를 정의한다. 여기 없는 색을 코드 다른 곳에서
 * 새로 만들지 않는다(§9-3 절대 규칙).
 *
 * "다크는 라이트의 반전이 아니다"(§1-2) — 액센트가 세이지→샴페인으로
 * 바뀌므로 라이트 값에 산술 변환을 가하지 않고 각 모드를 개별 정의한다.
 */

export interface BroadsheetPalette {
  /** 배경. 따뜻한 미색 종이(라이트) / 깊은 감청(다크). */
  paper: string
  /** 인용 지면, 모달. */
  paperAlt: string
  /** 먹 — AI가 쓴 서사, 제목. */
  inkFull: string
  /** 담묵 — 원문 인용. */
  inkWash: string
  /** 캡션, 메타데이터. */
  inkMute: string
  /** 비활성, 페이지 번호. */
  inkFaint: string
  /** 세이지(라이트) / 샴페인(다크) — 지표·수치 전용. UI 크롬 금지(§1-5). */
  accent: string
  /** 헤어라인. */
  rule: string
  /** 지면 상단 굵은 선. */
  ruleStrong: string
}

/** §1-1 본지 · 라이트 */
export const LIGHT_PALETTE: BroadsheetPalette = {
  paper: '#F0EDE6',
  paperAlt: '#F5F2EC',
  inkFull: '#3A3732',
  inkWash: '#5E5952',
  inkMute: '#8A857C',
  inkFaint: '#B0AAA0',
  accent: '#6E7F68',
  rule: '#D6D1C7',
  ruleStrong: '#3A3732',
}

/** §1-2 본지 · 다크 */
export const DARK_PALETTE: BroadsheetPalette = {
  paper: '#151B2D',
  paperAlt: '#111728',
  inkFull: '#EDE9DE',
  inkWash: '#B5B0A5',
  inkMute: '#83879A',
  inkFaint: '#5E6379',
  accent: '#C6B183',
  rule: '#2A3145',
  ruleStrong: '#C6B183',
}

/**
 * §1-3 별지(연애리그). 본지 모드와 반대 지질을 쓴다 — 라이트 모드에서는
 * 어두운 지면, 다크 모드에서는 밝은 지면이 된다. 두 값만 있으면 되므로
 * 완전한 BroadsheetPalette가 아니라 지면/잉크 2색만 정의한다(연애리그
 * 화면은 본지 팔레트의 나머지 토큰 — rule 등 — 을 함께 참조해 조합한다).
 */
export interface BroadsheetInsert {
  paper: string
  ink: string
}

/** 본지가 라이트일 때 쓰는 별지(어두운 지면). */
export const BROADSHEET_ON_LIGHT: BroadsheetInsert = {
  paper: '#2E2B26',
  ink: '#EDE9DE',
}

/** 본지가 다크일 때 쓰는 별지(밝은 지면). */
export const BROADSHEET_ON_DARK: BroadsheetInsert = {
  paper: '#EFEDE3',
  ink: '#3A3732',
}

/** §1-4 4기후 — 36종 라벨 배지·결과 카드 전용. 본문·크롬에 쓰지 않는다. */
export type ClimateKey = 'ember' | 'flare' | 'frost' | 'tide'

export interface ClimatePalette {
  ember: string
  flare: string
  frost: string
  tide: string
}

export const CLIMATE_LIGHT: ClimatePalette = {
  ember: '#A0664A',
  flare: '#A6505E',
  frost: '#5B7285',
  tide: '#3F6B64',
}

export const CLIMATE_DARK: ClimatePalette = {
  ember: '#C08A64',
  flare: '#C97785',
  frost: '#8098AC',
  tide: '#5E9187',
}

/**
 * 애착 유형 → 4기후 매핑 (§1-4 표: ember 안정 · flare 불안 · frost 회피 ·
 * tide 혼란). `src/constants/attachment.ts`의 `AttachmentType`
 * (secure/anxious/avoidant/fearful)과 1:1 대응한다.
 */
export const ATTACHMENT_CLIMATE: Record<
  'secure' | 'anxious' | 'avoidant' | 'fearful',
  ClimateKey
> = {
  secure: 'ember',
  anxious: 'flare',
  avoidant: 'frost',
  fearful: 'tide',
}
