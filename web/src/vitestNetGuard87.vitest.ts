/**
 * 87-(R148-4) 시험 환경에서 원격 쓰기 0 - Vitest가 `web/.env`의 실제 접속 값을 읽어도 시험은 실제 주소로 나가지 않는다.
 * 11/18 `app_error_daily`의 `unknown · upload_fail · web` 17건이 나온 길(시험 중 오류 기록 보내기 -> 실제 `log_app_error`)을 막았는지 고정한다.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readRemoteEnv } from './config/env'
import { getSupabase, setSupabaseForTest } from './auth/client'
import { flushAppErrors, reportAppError, setErrorScreen } from './errorLog/errorLog'
import { vitestBlockedFetches } from './vitestSetup'

afterEach(() => setSupabaseForTest(undefined))

describe('87- 시험 = 원격 0', () => {
  it('접속 값은 시험마다 빈 값 -> 실제 클라이언트를 만들지 않는다(setSupabaseForTest(undefined) 뒤에도)', () => {
    expect(readRemoteEnv()).toBeNull()
    setSupabaseForTest(undefined)
    expect(getSupabase()).toBeNull()
  })

  it('화면 이름 없이(unknown) 업로드 실패를 세고 보내도 바깥 요청 0', async () => {
    const before = vitestBlockedFetches()
    setSupabaseForTest(undefined)
    setErrorScreen(null)
    reportAppError('upload_fail')
    await flushAppErrors()
    expect(vitestBlockedFetches()).toBe(before)
  })

  it('그물: 바깥 주소 fetch는 막히고 수만 센다(data: 는 통과)', async () => {
    const before = vitestBlockedFetches()
    await expect(fetch('https://remote.invalid/rest/v1/rpc/log_app_error', { method: 'POST' })).rejects.toThrow(/network blocked/)
    expect(vitestBlockedFetches()).toBe(before + 1)
    const ok = await fetch('data:text/plain,ok')
    expect(await ok.text()).toBe('ok')
  })
})
