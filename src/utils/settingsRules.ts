/**
 * 설정 탭(U7, H01~H06 · H11)의 순수 규칙 - 화면과 시험이 같은 함수·표를 쓴다.
 *
 * - 목록 표(`SETTINGS_GROUPS`)에는 **이번에 갈 곳이 있는 항목만** 있다. 갈 곳이 없는 항목은 표에 넣지 않고
 *   `HIDDEN_SETTINGS_ITEMS`에 이유와 함께 적는다(보고용 목록이자 "숨김 항목이 목록에 없음" 시험의 기준).
 * - 재검사 가능 여부(`canRetest`)는 버튼 비활성 판정 하나다. 화면도 쓰기 함수도 이 함수를 거친다.
 * - A20 재표시 판정(`needsStartDateConfirm`)은 커플 행 한 줄만 보고 정한다.
 */
import type { LegalDocumentKey } from '../constants/legalDocuments'
import type { Database } from '../types/database'

/** DB `gender_type` enum(male/female/other). */
type Gender = Database['public']['Enums']['gender_type']

/** 설정 하위 화면 경로(루트 Stack의 푸시 화면, R18-2). 모두 `app/` 바로 아래 파일이다. */
export const SETTINGS_ROUTES = {
  profile: '/settings-profile',
  couple: '/settings-couple',
  personality: '/settings-personality',
  privacy: '/settings-privacy',
} as const

export type SettingsItemKey = 'profile' | 'social' | 'partner' | 'nickname' | 'personality' | 'privacy'

export interface SettingsItem {
  key: SettingsItemKey
  label: string
  href: (typeof SETTINGS_ROUTES)[keyof typeof SETTINGS_ROUTES]
}

export interface SettingsGroup {
  /** 보드의 영문 대문자 그룹 제목(kicker). */
  kicker: string
  items: readonly SettingsItem[]
}

/** H01 · H02 설정 목록 - 갈 곳이 있는 항목만. 순서는 보드(`N-H01-Settings`)대로다. */
export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  {
    kicker: 'ACCOUNT',
    items: [
      { key: 'profile', label: '프로필', href: SETTINGS_ROUTES.profile },
      { key: 'social', label: '연결된 계정', href: SETTINGS_ROUTES.profile },
    ],
  },
  {
    kicker: 'COUPLE',
    items: [
      { key: 'partner', label: '연인', href: SETTINGS_ROUTES.couple },
      { key: 'nickname', label: '커플 닉네임', href: SETTINGS_ROUTES.couple },
    ],
  },
  {
    kicker: 'PERSONALITY',
    items: [{ key: 'personality', label: '성격 프로필', href: SETTINGS_ROUTES.personality }],
  },
  {
    kicker: 'PRIVACY',
    items: [{ key: 'privacy', label: '개인정보 & 약관', href: SETTINGS_ROUTES.privacy }],
  },
]

/** 보드에는 있지만 이번에 갈 곳이 없어 숨긴 항목. 라벨은 보드 글자 그대로. */
export const HIDDEN_SETTINGS_ITEMS: readonly { label: string; reason: string }[] = [
  { label: '유성 떨어뜨리기', reason: '보드 OUR SKY 토글 - 지시서 범위 밖, 저장할 칸 없음' },
  { label: '별 반짝임', reason: '보드 OUR SKY 토글 - 지시서 범위 밖, 저장할 칸 없음' },
  { label: '발행물 테마', reason: '보드 MAGAZINE - 지시서 범위 밖(갈 화면 없음)' },
  { label: '구독', reason: 'H08 - 지시서 범위 밖' },
  { label: '사진 앱 연동', reason: 'H07 - 지시서 범위 밖' },
  { label: '대표사진', reason: 'H07 - 지시서 범위 밖' },
  { label: '사진 찾기', reason: 'H07 - 지시서 범위 밖' },
  { label: '알림', reason: 'H10 - 푸시 발송을 만들 때로 미룸(R42-5)' },
  { label: '데이터 내려받기 · 삭제', reason: 'H17 - 지시서 범위 밖' },
  { label: '앱 정보 · 문의', reason: 'H19 - 지시서 범위 밖' },
  { label: '매거진 - 빠진 지면 기본값', reason: 'H18 - 지시서 범위 밖' },
  { label: '생체정보(얼굴 인식) 동의', reason: 'H12 - 지시서가 숨기라고 함(설정 목록 · H11 모두)' },
  { label: '마케팅 정보 수신', reason: 'H11 보드 토글 - 동의 시각 칸을 써야 해서 지시서 쓰는 칸 밖' },
  { label: '[연결 해제]', reason: 'H14 - `68-`' },
  { label: '[회원 탈퇴]', reason: 'H16 - `68-`' },
  { label: '사진 바꾸기', reason: 'H03 보드 - 지시서 범위 밖(프로필 사진 칸 없음)' },
  { label: '테마(라이트/다크)', reason: '옛 화면 항목 - 보드에 없음' },
]

/** H11 보이는 줄 - 라벨과 여는 문서 키(A12 `legal-document`). 생체정보 · 데이터 내려받기 · 마케팅 줄은 없다. */
export const PRIVACY_DOCUMENT_ROWS: ReadonlyArray<{ key: LegalDocumentKey; label: string }> = [
  { key: 'privacy', label: '개인정보 처리방침' },
  { key: 'terms', label: '이용약관' },
  { key: 'aiUsage', label: 'AI 활용 안내' },
]

// ── 프로필(H03) ──

export const DISPLAY_NAME_MAX = 20

export const GENDER_OPTIONS: ReadonlyArray<{ key: Gender; label: string }> = [
  { key: 'male', label: '남' },
  { key: 'female', label: '여' },
  { key: 'other', label: '기타' },
]

export function genderLabel(gender: Gender | string | null | undefined): string {
  return GENDER_OPTIONS.find((o) => o.key === gender)?.label ?? ''
}

/** 글자 수는 서버 `char_length`와 같게 코드 포인트로 센다(앞뒤 공백 제외). */
export function isValidDisplayName(raw: string): boolean {
  const n = [...raw.trim()].length
  return n >= 1 && n <= DISPLAY_NAME_MAX
}

/** 로그인 방식 이름(`session.user.app_metadata.provider`). 모르는 값은 그대로 두지 않고 빈 글자다. */
export function socialProviderLabel(provider: string | null | undefined): string {
  switch (provider) {
    case 'kakao':
      return '카카오'
    case 'google':
      return '구글'
    case 'apple':
      return '애플'
    default:
      return ''
  }
}

// ── 커플(H04) ──

/** 'YYYY-MM-DD' -> 'YYYY.MM.DD'. 비었으면 빈 글자. */
export function dotDate(iso: string | null | undefined): string {
  return iso ? iso.replace(/-/g, '.') : ''
}

export interface StartDateConfirmFacts {
  relationship_start_date: string | null
  start_date_set_by: string | null
  start_date_confirmed_by: string | null
}

/**
 * A20(상대가 정한 날짜 확인)을 다시 보여야 하는가 - 날짜가 있고, 정한 사람이 내가 아니고(= 상대), 확인한 사람이 아직 없다.
 * 상대가 설정에서 사귄 날짜를 고치면(`start_date_set_by` = 상대, `start_date_confirmed_by` = null) 내가 다음에 앱에 들어올 때 참이 된다.
 */
export function needsStartDateConfirm(couple: StartDateConfirmFacts | null | undefined, myId: string | null): boolean {
  if (!couple || !myId) return false
  if (!couple.relationship_start_date) return false
  if (!couple.start_date_set_by || couple.start_date_set_by === myId) return false
  return couple.start_date_confirmed_by == null
}

// ── 성격 프로필(H05 · H06) ──

/** 재검사 버튼이 눌릴 수 있는가 - 계정당 1회(`retest_used`). 프로필 행이 없으면 아직 검사 전이라 누를 수 없다. */
export function canRetest(profile: { retest_used: boolean } | null | undefined): boolean {
  return !!profile && !profile.retest_used
}

/** H05 재검사 행의 설명 글. */
export function retestRowDescription(profile: { retest_used: boolean } | null | undefined): string {
  return canRetest(profile) ? '계정당 한 번 · 아직 쓰지 않았어요' : '계정당 한 번 · 이미 썼어요'
}
