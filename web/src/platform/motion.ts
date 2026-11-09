/** `prefers-reduced-motion`이면 연출 없이 즉시. 시험(jsdom)에는 `matchMedia`가 없어 false. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
