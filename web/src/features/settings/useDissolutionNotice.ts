/**
 * 상대의 해제 알림(RN `useDissolutionNotice`의 웹판, 앱 안 표시뿐 - 푸시 없음) - 상대가 연결 해제(또는 탈퇴)를 요청했으면 커플 화면(H14 유예 화면)을 한 번 보인다.
 *
 * 어디서: Shell이 탭 화면에 있을 때만 켠다(`enabled`, `useStartDateRecheck`와 같은 자리 · 같은 방식). 설정 > 연인 줄로도 언제든 볼 수 있다.
 *   온보딩 · 로그인 · 탭 밖 전체 화면(쓰는 흐름 포함) 중이면 꺼져 있다가, 탭으로 돌아온 첫 순간(`enabled` 거짓 -> 참)에 다시 읽고 판단한다.
 * 언제:
 *  - 탭이 처음 열릴 때(앱 시작 · 로그인 직후)와 앱이 다시 보일 때(`visibilitychange` - RN의 AppState `active`) 직접 다시 읽는다.
 *  - 90-(R153-2): 앱이 켜져 있는 동안 해제 상태가 **바뀌는 순간**에도 본다 - 해제 상태(`dissolutionStore`)를 누가 새로 읽었든
 *    (탭 진입 · 앱 복귀의 `useCoupleRefresh`, 연결 회복, 설정 화면) 바뀐 값을 그대로 판단한다. 커플 쪽만 먼저 유예(`grace`)로 바뀌면 해제 상태를 한 번 더 읽는다.
 * 누구에게: 내가 개시자면 열지 않는다(스스로 한 일).
 * 몇 번: 같은 해제 행(id)은 앱을 켠 동안 한 번만 연다(메모리만 - 기기 저장 0). 여러 때가 겹쳐도 같은 id면 한 번.
 * 입력 보호(90-): 시트(데이트 기록 등)가 열려 있으면 띄우지 않고 미룬다 - 경로가 바뀌면 시트가 닫혀(Shell `closeAll`, B4) 쓰던 것이 사라지기 때문이다.
 *   시트가 닫힌 첫 순간에 한 번 연다. 채팅 입력칸의 글은 화면을 떠나도 메모리에 남는다(`platform/useChatComposer`).
 * 읽기만 한다. 실패하면 조용히 넘어간다(다음 복귀 때 다시 본다).
 */
import { useEffect, useRef } from 'react'
import { useAuthStore } from '../../auth/stores'
import type { Nav } from '../../navigation'
import { useCoupleStore } from '../../stores/coupleStore'
import { useDissolutionStore } from '../../stores/dissolutionStore'
import { useSheetStore } from '../../stores/sheetStore'

export function useDissolutionNotice(nav: Nav, enabled: boolean): void {
  const userId = useAuthStore((s) => s.userId)
  const navRef = useRef(nav)
  navRef.current = nav
  const shownRef = useRef<string | null>(null)
  const checkingRef = useRef(false)

  useEffect(() => {
    if (!enabled || !userId) return
    let cancelled = false

    // 지금 해제 상태로 판단한다(읽지 않는다). 같은 id 한 번 · 개시자 0 · 시트가 열려 있으면 미룸.
    const consider = () => {
      if (cancelled) return
      const { dissolution } = useDissolutionStore.getState()
      if (!dissolution || dissolution.initiatedByMe) return
      if (shownRef.current === dissolution.dissolutionId) return
      if (useSheetStore.getState().current !== null) return // 쓰는 중 - 시트가 닫힐 때 다시 본다
      shownRef.current = dissolution.dissolutionId
      navRef.current.push('settings-couple', { urgent: true })
    }

    const check = async () => {
      if (checkingRef.current) return
      checkingRef.current = true
      try {
        await useDissolutionStore.getState().refresh(userId)
        consider()
      } catch {
        // 다음 복귀 때 다시 본다.
      } finally {
        checkingRef.current = false
      }
    }

    void check()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    // 해제 상태가 바뀌면(다른 곳의 다시 읽기 포함) 바로 판단한다.
    const offDissolution = useDissolutionStore.subscribe((s, prev) => {
      if (s.dissolution !== prev.dissolution) consider()
    })
    // 커플 쪽만 먼저 유예로 바뀌었으면(예: 변경 안내 알림의 커플 다시 읽기) 해제 상태도 읽는다.
    const offCouple = useCoupleStore.subscribe((s, prev) => {
      if (s.grace && !prev.grace) void check()
    })
    // 미뤄 둔 것: 시트가 닫히면 한 번 판단한다.
    const offSheet = useSheetStore.subscribe((s, prev) => {
      if (s.current === null && prev.current !== null) consider()
    })
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      offDissolution()
      offCouple()
      offSheet()
    }
  }, [enabled, userId])
}
