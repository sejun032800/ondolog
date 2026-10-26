/**
 * 설정 탭 순수 규칙 (`67-`) - 목록 표 · A20 재표시 판정 · 재검사 가능 판정 · 입력 규칙.
 */
import {
  HIDDEN_SETTINGS_ITEMS,
  PRIVACY_DOCUMENT_ROWS,
  SETTINGS_GROUPS,
  SETTINGS_ROUTES,
  canRetest,
  dotDate,
  isValidDisplayName,
  needsStartDateConfirm,
  retestRowDescription,
  socialProviderLabel,
} from '../../src/utils/settingsRules'

describe('설정 목록 표', () => {
  const labels = SETTINGS_GROUPS.flatMap((g) => g.items.map((i) => i.label))

  it('숨긴 항목은 목록에 없다', () => {
    for (const hidden of HIDDEN_SETTINGS_ITEMS) expect(labels).not.toContain(hidden.label)
    expect(HIDDEN_SETTINGS_ITEMS.map((h) => h.label)).toEqual(
      expect.arrayContaining(['구독', '알림', '앱 정보 · 문의', '데이터 내려받기 · 삭제', '[연결 해제]', '[회원 탈퇴]', '생체정보(얼굴 인식) 동의']),
    )
  })

  it('남은 항목은 모두 갈 곳(비지 않은 경로)이 있다', () => {
    const known = Object.values(SETTINGS_ROUTES) as string[]
    expect(labels.length).toBeGreaterThan(0)
    for (const g of SETTINGS_GROUPS) {
      for (const item of g.items) {
        expect(item.href).toMatch(/^\/[a-z-]+$/)
        expect(known).toContain(item.href)
      }
    }
  })

  it('H11은 처리방침 · 약관 · AI 안내만 - 생체정보 · 내려받기 · 마케팅 줄이 없다', () => {
    expect(PRIVACY_DOCUMENT_ROWS.map((r) => r.key)).toEqual(['privacy', 'terms', 'aiUsage'])
  })
})

describe('A20 재표시 판정', () => {
  const base = { relationship_start_date: '2025-12-27', start_date_set_by: 'p', start_date_confirmed_by: null }

  it('확인자가 null이고 정한 사람이 상대면 뜬다', () => {
    expect(needsStartDateConfirm(base, 'me')).toBe(true)
  })

  it('내가 정했으면 뜨지 않는다', () => {
    expect(needsStartDateConfirm({ ...base, start_date_set_by: 'me' }, 'me')).toBe(false)
  })

  it('이미 확인했으면 뜨지 않는다', () => {
    expect(needsStartDateConfirm({ ...base, start_date_confirmed_by: 'me' }, 'me')).toBe(false)
  })

  it('날짜가 없거나 정한 사람이 없거나 커플 · 사용자가 없으면 뜨지 않는다', () => {
    expect(needsStartDateConfirm({ ...base, relationship_start_date: null }, 'me')).toBe(false)
    expect(needsStartDateConfirm({ ...base, start_date_set_by: null }, 'me')).toBe(false)
    expect(needsStartDateConfirm(null, 'me')).toBe(false)
    expect(needsStartDateConfirm(base, null)).toBe(false)
  })
})

describe('재검사 가능 판정', () => {
  it('아직 안 썼으면 가능, 썼거나 프로필이 없으면 불가', () => {
    expect(canRetest({ retest_used: false })).toBe(true)
    expect(canRetest({ retest_used: true })).toBe(false)
    expect(canRetest(null)).toBe(false)
    expect(retestRowDescription({ retest_used: false })).toBe('계정당 한 번 · 아직 쓰지 않았어요')
    expect(retestRowDescription({ retest_used: true })).toBe('계정당 한 번 · 이미 썼어요')
  })
})

describe('입력 규칙', () => {
  it('이름 1~20자', () => {
    expect(isValidDisplayName('')).toBe(false)
    expect(isValidDisplayName('   ')).toBe(false)
    expect(isValidDisplayName('가')).toBe(true)
    expect(isValidDisplayName('가'.repeat(20))).toBe(true)
    expect(isValidDisplayName('가'.repeat(21))).toBe(false)
  })

  it('로그인 방식 이름 · 날짜 모양', () => {
    expect(socialProviderLabel('kakao')).toBe('카카오')
    expect(socialProviderLabel('unknown')).toBe('')
    expect(socialProviderLabel(undefined)).toBe('')
    expect(dotDate('2025-12-27')).toBe('2025.12.27')
    expect(dotDate(null)).toBe('')
  })
})
