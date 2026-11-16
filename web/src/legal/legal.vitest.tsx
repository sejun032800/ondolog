/**
 * 동의 상수 파일(`legal/consent.ts`) 시험 - PM 최소판 v1 반영 규칙(PM_legal_minimal_v1.md §4).
 * 값(운영자 · 문의 메일 · 저장 지역 · 시행일)은 출력하지 않는다. 비었는지만 본다.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MIN_AGE_YEARS } from '@/constants/consent'
import { useSessionStore } from '@/store/sessionStore'
import { setSupabaseForTest } from '../auth/client'
import { useAuthStore } from '../auth/stores'
import { PrivacyScreen } from '../features/settings/PrivacyScreen'
import { settingsDb } from '../features/settings/settingsTestSupport'
import { AI_USAGE_HELPER_BOARD, ConsentScreen } from '../screens'
import { makeFakeNav } from '../testSupport'
import {
  AI_USAGE_CONSENT_LINE, LEGAL_CONTACT_EMAIL, LEGAL_DOCUMENTS, LEGAL_EFFECTIVE_DATE, LEGAL_OPERATOR, LEGAL_STORAGE_REGION, legalPlainText, type LegalDocumentKey,
} from './consent'

const KEYS: LegalDocumentKey[] = ['privacy', 'terms', 'aiUsage', 'marketing']

beforeEach(() => {
  useSessionStore.getState().resetSession()
  useAuthStore.getState().setUserId('me')
})
afterEach(() => {
  cleanup()
  setSupabaseForTest(undefined)
  useAuthStore.getState().setUserId(null)
})

describe('네 문서 전문', () => {
  it('자리표시자가 남지 않는다 - `{` · `[자리표시자]` · `TODO` 0', () => {
    for (const k of KEYS) {
      const text = legalPlainText(LEGAL_DOCUMENTS[k])
      expect(text.length).toBeGreaterThan(100)
      expect(text).not.toContain('{')
      expect(text).not.toContain('}')
      expect(text).not.toContain('[자리표시자]')
      expect(text).not.toContain('TODO')
    }
    expect(AI_USAGE_CONSENT_LINE).not.toMatch(/[{}]|\[자리표시자\]|TODO/)
  })

  it('만 14세 하한이 동의 화면(MIN_AGE_YEARS) · 처리방침 7번 · 약관 2번에서 같다', () => {
    expect(MIN_AGE_YEARS).toBe(14)
    const privacy = LEGAL_DOCUMENTS.privacy.sections.find((s) => s.heading?.startsWith('7.'))!
    expect(privacy.heading).toBe(`7. 만 ${MIN_AGE_YEARS}세 미만`)
    expect(privacy.paragraphs?.[0]).toBe(`만 ${MIN_AGE_YEARS}세 미만은 가입할 수 없습니다.`)
    expect(legalPlainText(LEGAL_DOCUMENTS.terms)).toContain(`2. 가입: 만 ${MIN_AGE_YEARS}세 이상이`)
  })

  it('R94-9 마케팅 수신 동의 전문 - v1.1 §5 문장 그대로 · 문의 메일은 같은 상수', () => {
    const text = legalPlainText(LEGAL_DOCUMENTS.marketing)
    expect(text).toContain('마케팅 정보 수신 동의(선택)')
    expect(text).toContain('온도록의 새 기능과 이벤트 소식을 앱 알림이나 카카오계정 이메일로 받습니다.')
    expect(text).toContain('동의하지 않아도 온도록의 모든 기능을 쓸 수 있습니다.')
    expect(text).toContain(`동의한 뒤에도 언제든 ${LEGAL_CONTACT_EMAIL}로 철회할 수 있고, 철회하면 그날부터 보내지 않습니다.`)
    expect(text).toContain('이 동의로 모으는 새 정보는 없습니다(처리방침 1번의 "마케팅 정보 수신 동의 여부"만 기록합니다).')
  })

  it('v1.2(78- · R109-3) - 원본(PM_legal_minimal_v1.md)의 "(v1.2)" 줄이 처리방침에 그대로 있다(굵은 표시 · 판 표시만 뺌)', () => {
    const md = readFileSync(join(__dirname, '..', '..', '..', '.claude', 'state', 'prompts', 'phase-7', 'PM_legal_minimal_v1.md'), 'utf8')
    const privacyPart = md.slice(md.indexOf('## 1. 개인정보 처리방침'), md.indexOf('## 2. 이용약관'))
    const v12 = privacyPart.split(/\r?\n/).filter((l) => l.includes('(v1.2)'))
    expect(v12).toHaveLength(3) // 1번 · 4번 표 · 5번
    const text = legalPlainText(LEGAL_DOCUMENTS.privacy)
    const clean = (l: string) => l.replace(/\*\*/g, '').replace(/\s*\(v1\.2\)\s*/, '').replace(/^- /, '').trim()
    // 1번 · 5번: 글머리 줄 그대로
    expect(text).toContain(clean(v12[0]))
    expect(text).toContain(clean(v12[2]))
    // 4번 표: 칸을 " | "로 이은 줄 그대로
    const row = clean(v12[1]).replace(/^\|\s*/, '').replace(/\s*\|$/, '').split(/\s*\|\s*/).join(' | ')
    expect(text).toContain(row)
    expect(text).not.toContain('v1.2')
  })

  it('동의 화면 한 줄이 R38-2 문장을 대체했다', () => {
    expect(AI_USAGE_HELPER_BOARD).toBe(AI_USAGE_CONSENT_LINE)
    expect(AI_USAGE_CONSENT_LINE).toBe('두 사람의 대화·메모 같은 글 기록은 잡지 문장을 쓰기 위해 Anthropic의 Claude API(미국)로 보내지고, 30일 안에 지워져요. 사진 자체는 보내지 않아요.')
    useSessionStore.getState().setBirthDate('1995-05-05')
    render(<MemoryRouter><ConsentScreen nav={makeFakeNav()} /></MemoryRouter>)
    expect(screen.getByText(AI_USAGE_CONSENT_LINE)).toBeTruthy()
    expect(document.body.textContent).not.toContain('외부 AI로 전송돼요')
    expect(screen.getByText(`만 ${MIN_AGE_YEARS}세 이상입니다`)).toBeTruthy()
  })
})

describe('온보딩 [보기]와 설정 > 개인정보 & 약관이 같은 문장을 보인다(51- C13)', () => {
  async function consentSheetText(index: number): Promise<string> {
    useSessionStore.getState().setBirthDate('1995-05-05')
    render(<MemoryRouter><ConsentScreen nav={makeFakeNav()} /></MemoryRouter>)
    fireEvent.click(screen.getAllByText('보기')[index])
    const body = await screen.findByTestId('legal-body')
    const text = body.textContent ?? ''
    cleanup()
    return text
  }
  async function settingsSheetText(rowKey: string): Promise<string> {
    settingsDb({})
    render(<MemoryRouter><PrivacyScreen nav={makeFakeNav()} /></MemoryRouter>)
    fireEvent.click(await screen.findByTestId(`privacy-row-${rowKey}`))
    const body = await screen.findByTestId('legal-body')
    const text = body.textContent ?? ''
    cleanup()
    return text
  }

  it('이용약관 · 처리방침 · AI 활용 안내', async () => {
    // 동의 화면의 [보기] 순서: 이용약관, 처리방침, AI, 마케팅(R94-9)
    const onboarding = [await consentSheetText(0), await consentSheetText(1), await consentSheetText(2), await consentSheetText(3)]
    const settings = [await settingsSheetText('terms'), await settingsSheetText('privacy'), await settingsSheetText('aiUsage'), await settingsSheetText('marketing')]
    expect(settings).toEqual(onboarding)
    for (const text of onboarding) expect(text).not.toMatch(/[{}]|\[자리표시자\]|TODO/)
    expect(onboarding[1]).toContain(LEGAL_DOCUMENTS.privacy.title)
    expect(onboarding[2]).toContain('Anthropic')
    expect(onboarding[3]).toContain(LEGAL_DOCUMENTS.marketing.title)
  })

  it('동의 화면 [보기]는 네 문서(이용약관 · 처리방침 · AI · 마케팅) - R94-9', () => {
    useSessionStore.getState().setBirthDate('1995-05-05')
    render(<MemoryRouter><ConsentScreen nav={makeFakeNav()} /></MemoryRouter>)
    expect(screen.getAllByText('보기')).toHaveLength(4)
  })
})

describe.skipIf(!process.env.LEGAL_CHECK)('legal values are filled (빌드 관문 - 평소 실행에서는 건너뜀)', () => {
  it('운영자 · 문의 메일 · 저장 지역 · 시행일 네 값이 모두 채워졌다', () => {
    expect(LEGAL_OPERATOR.trim()).not.toBe('')
    expect(LEGAL_CONTACT_EMAIL.trim()).not.toBe('')
    expect(LEGAL_STORAGE_REGION.trim()).not.toBe('')
    expect(LEGAL_EFFECTIVE_DATE.trim()).not.toBe('')
  })
})
