/**
 * "이 호를 뷰어에서 열어 봤다" 표시(U1 B06) - **기기 저장**(AsyncStorage), 사용자·호 단위. 서버에 쓰지 않는다.
 *
 * 로그인 이후 구간의 편의 표시이며(비로그인 온보딩 데이터가 아니다), 지워져도 기록이 잃는 것은 없다:
 * 7일 안에서 "꽂혔어요" 카드가 다시 보일 뿐이다. 읽기·쓰기 실패는 조용히 넘긴다(화면이 이 때문에 멈추지 않는다).
 */
import AsyncStorage from '@react-native-async-storage/async-storage'

export const ISSUE_OPENED_KEY_PREFIX = 'ondolog.issueOpened'

export function issueOpenedKey(userId: string, issueId: string): string {
  return `${ISSUE_OPENED_KEY_PREFIX}.${userId}.${issueId}`
}

/** 이 사용자가 이 호를 열었다고 남긴다. 실패하면 false. */
export async function markIssueOpened(userId: string, issueId: string): Promise<boolean> {
  try {
    await AsyncStorage.setItem(issueOpenedKey(userId, issueId), '1')
    return true
  } catch {
    return false
  }
}

/** 주어진 호들 중 이 사용자가 열어 본 호의 id 집합. 읽기에 실패하면 빈 집합(= 아직 안 열어 봄). */
export async function loadOpenedIssueIds(userId: string, issueIds: readonly string[]): Promise<Set<string>> {
  if (issueIds.length === 0) return new Set()
  try {
    const pairs = await AsyncStorage.multiGet(issueIds.map((id) => issueOpenedKey(userId, id)))
    const opened = new Set<string>()
    pairs.forEach(([, value], index) => {
      if (value !== null) opened.add(issueIds[index])
    })
    return opened
  } catch {
    return new Set()
  }
}
