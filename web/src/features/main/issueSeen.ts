/**
 * "이 호를 뷰어에서 열어 봤다" 표시(B06) - **기기 저장**(Capacitor Preferences, 웹에서는 localStorage), 사용자 · 호 단위. 서버에 쓰지 않는다.
 * RN `services/issueSeen`(AsyncStorage)과 같은 행동: 키 이름도 같다. 로그인 이후 구간의 편의 표시이며(비로그인 온보딩 데이터가 아니다),
 * 지워져도 잃는 기록은 없다 - 7일 안에서 "꽂혔어요" 카드가 다시 보일 뿐이다. 읽기 · 쓰기 실패는 조용히 넘긴다.
 * 호를 여는 뷰어(74-6)가 `markIssueOpened`를 부른다.
 */
import { Preferences } from '@capacitor/preferences'
import { create } from 'zustand'

/**
 * "열어 봤다"를 남기면 번호를 올린다 - 아래에 깔려 있는 메인 탭이 B06 카드를 바로 걷도록(덮개 뒤에서는 `visibilitychange`가 오지 않는다). 번호만, 기기 저장과 무관.
 */
export const useIssueOpenedSignal = create<{ version: number }>(() => ({ version: 0 }))

export const ISSUE_OPENED_KEY_PREFIX = 'ondolog.issueOpened'

export function issueOpenedKey(userId: string, issueId: string): string {
  return `${ISSUE_OPENED_KEY_PREFIX}.${userId}.${issueId}`
}

/** 이 사용자가 이 호를 열었다고 남긴다. 실패하면 false. */
export async function markIssueOpened(userId: string, issueId: string): Promise<boolean> {
  try {
    await Preferences.set({ key: issueOpenedKey(userId, issueId), value: '1' })
    useIssueOpenedSignal.setState((s) => ({ version: s.version + 1 }))
    return true
  } catch {
    return false
  }
}

/** 주어진 호들 중 이 사용자가 열어 본 호의 id 집합. 읽기에 실패한 호는 아직 안 열어 본 것으로 본다. */
export async function loadOpenedIssueIds(userId: string, issueIds: readonly string[]): Promise<Set<string>> {
  const opened = new Set<string>()
  if (issueIds.length === 0) return opened
  try {
    const values = await Promise.all(issueIds.map((id) => Preferences.get({ key: issueOpenedKey(userId, id) })))
    values.forEach((v, i) => {
      if (v.value !== null) opened.add(issueIds[i])
    })
    return opened
  } catch {
    return new Set()
  }
}
