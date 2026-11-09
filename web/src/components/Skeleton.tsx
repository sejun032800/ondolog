/** I03 불러오는 중 - 스피너 대신 뼈대. text 색 막대의 투명도가 .06 <-> .12로 1.6초 숨쉰다(`prefers-reduced-motion`이면 정지). */
export function Skeleton({ width = '100%', height = 10, radius, style }: {
  width?: number | string
  height?: number
  radius?: number
  style?: React.CSSProperties
}) {
  return <span className="skeleton" aria-hidden="true" data-testid="skeleton" style={{ width, height, borderRadius: radius ?? 999, ...style }} />
}
