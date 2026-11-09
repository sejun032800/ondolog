/**
 * 설정에서 부르는 서버 일 · 로그아웃 · 문의 메일(74-7). **쓰기는 RN이 부르던 같은 함수만** 부른다.
 *  - 해제 요청 · 취소 · 탈퇴 요청 · 취소: 027 RPC(`@/services/dissolutionCore`) 호출 하나씩. `execute_dissolution` · `apply_retention_policy` · `run_due_dissolutions`는 이 앱 어디에도 없다(R34-3).
 *  - 이름 · 성별 · 사귄 날짜 · 닉네임 · 마케팅 수신 · 재검사: `@/services/settingsCore`(쓰는 칸 표가 그 파일 머리에 있다).
 *  - 로그아웃: 메모리 스토어를 비우고 세션을 끝낸다 - 저장소(Preferences)의 로그인 세션이 지워진다. **채팅 큐는 지우지 않는다**(R39-5 b).
 */
import { useSessionStore } from '@/store/sessionStore'
import { performLogout } from '@/services/settingsCore'
import { getSupabase } from '../../auth/client'
import { useAuthStore } from '../../auth/stores'
import type { Nav } from '../../navigation'
import { useCoupleStore } from '../../stores/coupleStore'
import { useDissolutionStore } from '../../stores/dissolutionStore'
import { useProfileStore } from '../../stores/profileStore'
import { useSheetStore } from '../../stores/sheetStore'

/** 화면 메모리(커플 · 프로필 · 해제 상태 · 온보딩 답)를 비운다. 기기에 저장된 채팅 큐는 건드리지 않는다. */
export function resetAccountMemory(): void {
  useCoupleStore.getState().reset()
  useProfileStore.getState().reset()
  useDissolutionStore.getState().reset()
  useSessionStore.getState().resetSession()
  useSheetStore.getState().closeAll()
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
        const result = await db.auth.signOut()
        if (result.error) await db.auth.signOut({ scope: 'local' })
      },
    })
  } catch {
    // 아래 finally가 첫 화면으로 보낸다. 오류 내용은 남기지 않는다.
  } finally {
    useAuthStore.getState().setUserId(null)
    nav.reset('intro')
  }
}
