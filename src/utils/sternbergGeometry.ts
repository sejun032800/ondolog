/**
 * 스턴버그 삼각형의 도형 좌표 - 순수 함수(표시 전용, 값은 엔진 결과 그대로).
 *
 * 바깥 삼각형은 세 값이 모두 100일 때의 모양이고, 안쪽 삼각형은 각 꼭짓점을 무게중심에서 값(0~100)만큼의 비율로 당긴 것이다.
 * 꼭짓점 순서는 위 = 친밀 · 왼쪽 아래 = 열정 · 오른쪽 아래 = 헌신(디자인 `N-S-A3-Onboarding` A14).
 */
export interface Point {
  x: number
  y: number
}

export interface SternbergGeometry {
  outer: [Point, Point, Point]
  inner: [Point, Point, Point]
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v / 100))
}

export function sternbergGeometry(
  values: { intimacy: number; passion: number; commitment: number },
  width: number,
  height: number,
): SternbergGeometry {
  const outer: [Point, Point, Point] = [
    { x: width / 2, y: 0 },
    { x: 0, y: height },
    { x: width, y: height },
  ]
  const center: Point = {
    x: (outer[0].x + outer[1].x + outer[2].x) / 3,
    y: (outer[0].y + outer[1].y + outer[2].y) / 3,
  }
  const ratios = [clamp01(values.intimacy), clamp01(values.passion), clamp01(values.commitment)]
  const inner = outer.map((p, i) => ({
    x: round2(center.x + (p.x - center.x) * ratios[i]),
    y: round2(center.y + (p.y - center.y) * ratios[i]),
  })) as [Point, Point, Point]
  return { outer, inner }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
