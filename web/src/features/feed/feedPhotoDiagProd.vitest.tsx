/**
 * 74-h4 진단은 운영 빌드에서 0 - `IS_TRIAL_BUILD`가 false일 때 사진이 실패해도 단계가 기록되지 않고 진단 줄이 그려지지 않는다.
 * (번들에서 코드째 빠지는지는 `npm run build` 산출물 검색으로 따로 확인한다 - 보고서 참고.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { setSupabaseForTest } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { ToastHost } from '../../components/ToastHost'
import { useTrialDiag } from '../../platform/trialDiag'
import { useCoupleStore } from '../../stores/coupleStore'
import { COUPLE_ROW, PROFILES, makeFeedDb } from './feedTestSupport'
import { saveFeedRecord } from './feedSave'
import { stageFiles } from './feedPhotoStage'
import { RecordSheetBody } from './RecordSheet'

vi.mock('../../config/env', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../config/env')>()), IS_TRIAL_BUILD: false }))
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE', Data: 'DATA' },
  Filesystem: { writeFile: async () => {}, readFile: async () => ({ data: '' }), deleteFile: async () => {}, stat: async () => ({}) },
}))

beforeEach(() => {
  useAuthStore.getState().setUserId('me')
  useCoupleStore.setState({ status: 'connected', coupleId: 'c1', partnerId: 'you' })
  useTrialDiag.getState().clearPhoto()
})
afterEach(() => {
  cleanup()
  setSupabaseForTest(undefined)
  useAuthStore.getState().setUserId(null)
  useCoupleStore.getState().reset()
})

describe('운영 빌드(IS_TRIAL_BUILD = false)', () => {
  it('읽기 실패 · 업로드 실패가 나도 진단 기록 0 · 진단 줄 0', async () => {
    const db = makeFeedDb({ me: 'me', couples: [COUPLE_ROW], profiles: PROFILES, uploadFailures: 99 })
    setSupabaseForTest(db.client)
    render(<><RecordSheetBody /><ToastHost aboveTabBar={false} /></>)
    await waitFor(() => expect(screen.getByRole('button', { name: '기록 남기기' })).toBeTruthy())
    const bad = { name: 'x.jpg', type: 'image/jpeg', size: 1, lastModified: 1, arrayBuffer: async () => { throw new Error('x') } } as unknown as File
    const out = await stageFiles([bad], false)
    expect(out[0].failed).toBe(true)
    await expect(saveFeedRecord(db.client as never, { coupleId: 'c1', userId: 'me', dateOn: '2026-10-03', places: [], photos: [{ uri: 'blob:none', width: null, height: null, byteSize: 1, mimeType: 'image/jpeg', ext: 'jpg', capturedAt: '2026-10-03T10:00:00+09:00', lat: null, lng: null }], memo: 'm' })).resolves.toBeTruthy()
    expect(useTrialDiag.getState().photo).toBeNull()
    expect(screen.queryByTestId('photo-diag')).toBeNull()
    expect(screen.queryByTestId('photo-diag-toast')).toBeNull()
  })
})
