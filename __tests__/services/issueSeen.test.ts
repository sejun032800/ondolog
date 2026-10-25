/**
 * "열어 본 호" 기기 저장 시험 - 사용자·호 단위, 서버 쓰기 없음(AsyncStorage만).
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { issueOpenedKey, loadOpenedIssueIds, markIssueOpened } from '../../src/services/issueSeen'

beforeEach(async () => {
  await AsyncStorage.clear()
})

describe('issueSeen', () => {
  it('열었다고 남기면 그 사용자·그 호만 열린 것으로 읽힌다', async () => {
    expect(await markIssueOpened('u1', 'i1')).toBe(true)
    const opened = await loadOpenedIssueIds('u1', ['i1', 'i2'])
    expect([...opened]).toEqual(['i1'])
  })

  it('사용자 단위: 다른 사용자가 열었다고 내 표시가 되지 않는다', async () => {
    await markIssueOpened('u1', 'i1')
    expect((await loadOpenedIssueIds('u2', ['i1'])).size).toBe(0)
  })

  it('호가 없으면 저장소를 읽지 않고 빈 집합', async () => {
    const spy = jest.spyOn(AsyncStorage, 'multiGet')
    spy.mockClear()
    expect((await loadOpenedIssueIds('u1', [])).size).toBe(0)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('저장소가 실패해도 던지지 않는다(읽기 -> 빈 집합, 쓰기 -> false)', async () => {
    const get = jest.spyOn(AsyncStorage, 'multiGet').mockRejectedValueOnce(new Error('boom'))
    expect((await loadOpenedIssueIds('u1', ['i1'])).size).toBe(0)
    get.mockRestore()
    const set = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('boom'))
    expect(await markIssueOpened('u1', 'i1')).toBe(false)
    set.mockRestore()
  })

  it('키는 사용자·호를 담는다', () => {
    expect(issueOpenedKey('u1', 'i1')).toBe('ondolog.issueOpened.u1.i1')
  })
})
