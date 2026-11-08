/**
 * 하드웨어 뒤로 가기 처리.
 * 화면 안에서 뒤로 가기로 닫을 것(시트 · 하위 단계)이 있으면 그것을 먼저 처리하고,
 * 없으면 앱 안 뒤로 가기, 첫 화면이면 앱 종료.
 */
import { useEffect, useRef } from 'react'

type BackHandler = () => void

const handlers: BackHandler[] = []

/** 가장 나중에 등록한 것이 먼저 받는다. 돌려준 함수로 등록을 푼다. */
export function pushBackHandler(handler: BackHandler): () => void {
  handlers.push(handler)
  return () => {
    const i = handlers.lastIndexOf(handler)
    if (i >= 0) handlers.splice(i, 1)
  }
}

export interface BackActions {
  canGoBack: () => boolean
  goBack: () => void
  exitApp: () => void
}

export function handleHardwareBack(actions: BackActions): void {
  const top = handlers[handlers.length - 1]
  if (top) {
    top()
    return
  }
  if (actions.canGoBack()) actions.goBack()
  else actions.exitApp()
}

/** 이 화면(또는 시트)이 떠 있는 동안 뒤로 가기를 받는다. `undefined`면 등록하지 않는다. */
export function useBackHandler(handler: BackHandler | undefined): void {
  const latest = useRef(handler)
  latest.current = handler
  const active = handler !== undefined
  useEffect(() => {
    if (!active) return
    return pushBackHandler(() => latest.current?.())
  }, [active])
}
