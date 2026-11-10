/**
 * 설정에서 부르는 서버 일 · 로그아웃 · 문의 메일(74-7). **쓰기는 RN이 부르던 같은 함수만** 부른다.
 *  - 해제 요청 · 취소 · 탈퇴 요청 · 취소: 027 RPC(`@/services/dissolutionCore`) 호출 하나씩. `execute_dissolution` · `apply_retention_policy` · `run_due_dissolutions`는 이 앱 어디에도 없다(R34-3).
 *  - 이름 · 성별 · 사귄 날짜 · 닉네임 · 마케팅 수신 · 재검사: `@/services/settingsCore`(쓰는 칸 표가 그 파일 머리에 있다).
 *  - 로그아웃: 메모리 스토어를 비우고 세션을 끝낸다 - 저장소(Preferences)의 로그인 세션이 지워진다. **채팅 큐는 지우지 않는다**(R39-5 b).
 */
import { useSessionStore } from '@/store/sessionStore'
import { performLogout } from '@/services/settingsCore'
import { resetCallbackState } from '../../auth/callback'
import { getSupabase } from '../../auth/client'
import { useAuthStore, useNoticeStore } from '../../auth/stores'
import type { Nav } from '../../navigation'
import { forgetLibrary } from '../magazine/libraryData'
import { useCoupleStore } from '../../stores/coupleStore'
import { useDissolutionStore } from '../../stores/dissolutionStore'
import { useProfileStore } from '../../stores/profileStore'
import { useSheetStore } from '../../stores/sheetStore'
import { useViewerOpenStore } from '../../stores/viewerOpenStore'
import { resetSettingsSummaryCache } from './useSettingsSummary'

/**
 * 로그아웃 · 탈퇴 요청 때 이 실행의 메모리에 남는 계정 상태를 모두 비운다(D1 - 같은 실행에서 다시 로그인할 때 이전 로그인의 표시를 물려받지 않게).
 * 기기에 저장된 채팅 큐는 건드리지 않는다. 로그인 세션 저장소(Preferences)는 `signOut`이 지운다.
 *   zustand: 커플 · 프로필 · 해제 · 온보딩 답(결과 메모리) · 시트 · 서재 뷰어 · 알림(기존 계정 안내)
 *   모듈 메모리: 콜백 코드 칸 + 처리한 코드 표시(`resetCallbackState`) · 서재 기억(`forgetLibrary`) · 설정 요약 기억
 */
export function resetAccountMemory(): void {
  useCoupleStore.getState().reset()
  useProfileStore.getState().reset()
  useDissolutionStore.getState().reset()
  useSessionStore.getState().resetSession()
  useSheetStore.getState().closeAll()
  useViewerOpenStore.getState().close()
  useNoticeStore.getState().clear()
  resetCallbackState()
  forgetLibrary()
  resetSettingsSummaryCache()
}

/**
 * 로그아웃 -> 첫 화면. 서버 로그아웃이 실패해도(끊긴 연결) 이 기기의 세션은 반드시 지운다(`scope: 'local'`) - 안 그러면 다음에 앱을 켤 때 다시 로그인돼 있다.
 * 끝나면 어떤 경우에도 첫 화면으로 간다(RN `finally { router.replace('/') }`).
 */
export async function logoutToStart(nav: Nav): Promise<void> {
  const db = getSupabase()
  try {
    await performLogout({
      resetMemory: resetAccountMemory,
      signOut: async () => {
        if (!db) return
        // 전체 로그아웃이 오류로 끝나거나 던져도 이 기기의 세션은 지운다.
        let failed = false
        try {
          failed = !!(await db.auth.signOut()).error
        } catch {
          failed = true
        }
        if (failed) await db.auth.signOut({ scope: 'local' })
      },
    })
  } catch {
    // 아래 finally가 첫 화면으로 보낸다. 오류 내용은 남기지 않는다.
  } finally {
    // 세션이 끝난 뒤에도 한 번 더 - 로그아웃이 도는 사이 들어온 표시(앱 링크 · 알림)를 남기지 않는다.
    resetCallbackState()
    useNoticeStore.getState().clear()
    useAuthStore.getState().setUserId(null)
    nav.reset('intro')
  }
}
