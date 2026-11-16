/**
 * 76-r F5(R102-4) 오프라인 채팅 머리의 마지막 상대 이름 + F3 · F4 · F5 저장분의 지우는 때(로그아웃 · 탈퇴 요청 · 해제 요청(유예 시작) · 해제 완료 · 계정 전환).
 * 서버는 가짜(`chatTestSupport.ts`) - 원격 0.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { setSupabaseForTest } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import { clearCoupleCache, purgeOtherUsers, readCache, writeCache } from '../../cache/deviceCache'
import { useCoupleStore } from '../../stores/coupleStore'
import { makeFakeBridge } from '../../testSupport'
import { ChatTab } from '../../tabs/ChatTab'
import { resetAccountMemory } from '../settings/accountActions'
import { readChatHeadName, writeChatHeadName } from './chatCache'
import { CHAT_PROFILES, makeChatWorld } from './chatTestSupport'

const COUPLES = [{ id: 'c1', status: 'active', user_a_id: 'me', user_b_id: 'you', nickname: null, relationship_start_date: '2025-12-28', reference_photo_path: null }]

beforeEach(() => {
  localStorage.clear()
  useAuthStore.getState().setUserId('me')
  useCoupleStore.setState({ status: 'connected', coupleId: 'c1', partnerId: 'you', relationshipStartDate: '2025-12-28' })
})
afterEach(() => {
  cleanup()
  setSupabaseForTest(undefined)
  useAuthStore.getState().setUserId(null)
  useCoupleStore.getState().reset()
})

const head = () => screen.getByTestId('chat-header').querySelector('.chatName')?.textContent

describe('F5 채팅 머리 이름', () => {
  it('온라인에서 받은 상대 이름을 채팅 저장분에 남긴다', async () => {
    const w = makeChatWorld({ profiles: CHAT_PROFILES, couples: COUPLES })
    render(<ChatTab bridge={makeFakeBridge()} hubs={w.hubs} />)
    const name = CHAT_PROFILES.find((p) => p.id === 'you')?.display_name as string
    await waitFor(() => expect(head()).toBe(name))
    // 76-j: 저장은 이름을 그린 뒤의 effect(ChatView)라 화면보다 늦을 수 있다 - 저장분도 기다린다(바로 읽으면 가끔 null).
    await waitFor(() => expect(readChatHeadName('me', 'c1')).toBe(name))
  })

  it('오프라인 · 이름 저장분 없음 · 상대 id 모름이어도 머리에 마지막 상대 이름(빈칸 · "상대" 0)', async () => {
    writeChatHeadName('me', 'c1', '서영')
    useCoupleStore.setState({ partnerId: null })
    const w = makeChatWorld({ profiles: CHAT_PROFILES, couples: COUPLES, offline: true })
    render(<ChatTab bridge={makeFakeBridge()} hubs={w.hubs} />)
    expect(head()).toBe('서영') // 첫 프레임
    await act(async () => {})
    expect(head()).toBe('서영')
  })

  it('다른 커플의 저장분은 쓰지 않는다', () => {
    writeChatHeadName('me', 'c-old', '옛사람')
    expect(readChatHeadName('me', 'c1')).toBeNull()
  })
})

describe('F3 · F4 · F5 저장분 - 지우는 때(같은 장치 · 범주 main/chat)', () => {
  const seed = (user: string) => {
    writeCache(user, 'main', { coupleId: 'c1', partnerId: 'you' })
    writeCache(user, 'main', { coupleId: 'c1', issues: [], next: null }, 'library')
    writeCache(user, 'main', { coupleId: 'c1', hasActivity: true, profilesComplete: true, openedIssueIds: [], openedFor: '' }, 'facts')
    writeCache(user, 'main', { coupleId: 'c1', value: 44.7, hasActivity: true }, 'start')
    writeCache(user, 'main', { key: 'c1:you:2025-12-19' }, 'dateNotice')
    writeChatHeadName(user, 'c1', '서영')
  }
  const left = (user: string) => [
    readCache(user, 'main', 'library'), readCache(user, 'main', 'facts'), readCache(user, 'main', 'start'), readCache(user, 'main', 'dateNotice'), readChatHeadName(user, 'c1'),
  ].filter((v) => v !== null)

  it('로그아웃 · 탈퇴 요청(resetAccountMemory)', () => {
    seed('me')
    resetAccountMemory()
    expect(left('me')).toEqual([])
  })

  it('해제 완료(clearCoupleCache)', () => {
    seed('me')
    clearCoupleCache('me')
    expect(left('me')).toEqual([])
  })

  it('계정 전환(purgeOtherUsers)', () => {
    seed('user-A')
    purgeOtherUsers('user-B')
    expect(left('user-A')).toEqual([])
  })

  it('해제 요청(유예 시작): 커플 조회가 dissolving 을 보면 커플 자료를 지운다', async () => {
    seed('me')
    makeChatWorld({ profiles: CHAT_PROFILES, couples: [{ ...COUPLES[0], status: 'dissolving' }] })
    await act(async () => { await useCoupleStore.getState().refresh('me') })
    expect(useCoupleStore.getState().grace).toBe(true)
    expect(left('me')).toEqual([])
  })
})
