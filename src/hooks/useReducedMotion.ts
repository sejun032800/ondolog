/**
 * OS "동작 줄이기" 설정을 따른다. 켜져 있으면 true.
 * 배경 별 명멸·진입 모션은 true일 때 멈춘다(ROADMAP MVP 조정표).
 *
 * 첫 렌더에는 false로 시작해 비동기로 실제 값을 읽는다. 읽기에 실패하면 false(모션 허용).
 */
import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    let alive = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) setReduced(v)
      })
      .catch(() => {})
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      if (alive) setReduced(v)
    })
    return () => {
      alive = false
      sub.remove()
    }
  }, [])

  return reduced
}
