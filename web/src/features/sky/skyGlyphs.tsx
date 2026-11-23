/**
 * 89- 별 · 기념일 고리 · 달 모양(보드 `N-R17b-Our-Sky-3` patch10 2-2 "모양 명세"). C01(달 지면)과 C08(둘러보기 띠)이 같은 부품을 쓴다.
 *  - 빛살 · 후광은 SVG를 **한 번** 그려 두고 transform · opacity만 바꾼다(CSS). 그림자 · 블러 · filter 애니메이션 0(V40).
 *  - 그라데이션은 화면에 한 번만(`SkyGlyphDefs`) - 별마다 정의를 되풀이하지 않는다.
 *  - 중심 점은 늘 켜져 있다(기록은 꺼지지 않는다). 숨 쉬는 것은 빛살 · 후광(`.glow`)뿐이고 가운데 · 위 단계만.
 */
import { STAR_GLYPH, ringRadius, starBreathes, type StarSize } from './skyMath'

const HALO_ID = (size: StarSize) => `skyHalo${size}`

/** 그라데이션 정의 - 하늘 화면에 한 번. */
export function SkyGlyphDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        {([4, 5, 8] as const).map((size) => {
          const g = STAR_GLYPH[size]
          return (
            <radialGradient key={size} id={HALO_ID(size)}>
              <stop offset="0" stopColor={g.warm ? '#F7D6E2' : '#D7C9FA'} stopOpacity={g.haloAlpha} />
              <stop offset=".55" stopColor={g.warm ? '#E3A0C8' : '#B9A2F0'} stopOpacity={g.haloAlpha * 0.45} />
              <stop offset="1" stopColor="#B9A2F0" stopOpacity="0" />
            </radialGradient>
          )
        })}
        <linearGradient id="skyRayX"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".9" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <linearGradient id="skyRayY" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".9" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <radialGradient id="skyMoonHalo"><stop offset=".35" stopColor="#E7D9C3" stopOpacity=".18" /><stop offset="1" stopColor="#E7D9C3" stopOpacity="0" /></radialGradient>
      </defs>
    </svg>
  )
}

/** 별 하나 - 후광 + 빛살(.glow, 숨) + 중심 점(.core, 늘 켜짐). 켜짐 연출은 `.glowWrap`(크기 .4 -> 1)이 받는다(숨과 겹치지 않게). */
export function StarGlyph({ size }: { size: StarSize }) {
  const g = STAR_GLYPH[size]
  const d = g.halo * 2
  const c = g.halo
  return (
    <>
      <span className="glowWrap" aria-hidden="true">
        <svg className={`glow ${starBreathes(size) ? 'breathe' : ''}`} width={d} height={d} viewBox={`0 0 ${d} ${d}`} data-tier={size}>
          <circle cx={c} cy={c} r={g.halo} fill={`url(#${HALO_ID(size)})`} />
          {g.ray > 0 ? (
            <>
              <rect x={c - g.ray} y={c - 0.5} width={g.ray * 2} height="1" fill="url(#skyRayX)" />
              <rect x={c - 0.5} y={c - g.ray} width="1" height={g.ray * 2} fill="url(#skyRayY)" />
            </>
          ) : null}
          {g.diag > 0 ? (
            <g transform={`rotate(45 ${c} ${c})`} opacity=".5">
              <rect x={c - g.diag} y={c - 0.4} width={g.diag * 2} height=".8" fill="url(#skyRayX)" />
              <rect x={c - 0.4} y={c - g.diag} width=".8" height={g.diag * 2} fill="url(#skyRayY)" />
            </g>
          ) : null}
        </svg>
      </span>
      <i className="core" style={{ width: g.core, height: g.core, boxShadow: `0 0 ${g.core}px ${g.core / 3}px rgba(255,250,245,.6)` }} aria-hidden="true" />
    </>
  )
}

/** 기념일 고리 - 장밋빛 점선 원(rose .6 · 점선 2/4) · 60초에 한 바퀴(CSS `.ringMark`). */
export function RingGlyph({ size }: { size: StarSize | null }) {
  const r = ringRadius(size)
  return (
    <svg className="ringMark" width={r * 2 + 2} height={r * 2 + 2} viewBox={`0 0 ${r * 2 + 2} ${r * 2 + 2}`} aria-hidden="true">
      <circle cx={r + 1} cy={r + 1} r={r} fill="none" stroke="#F4B9C8" strokeOpacity=".6" strokeDasharray="2 4" strokeLinecap="round" />
    </svg>
  )
}

/** 달 - 초승달 + 어두운 쪽 지구빛(.12) + 숨 쉬는 후광(r 22 · .10 <-> .18, CSS `.moonHalo`). */
export function MoonGlyph() {
  return (
    <svg className="moonGlyph" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
      <circle className="moonHalo" cx="22" cy="22" r="22" fill="url(#skyMoonHalo)" />
      <circle cx="22" cy="22" r="13" fill="#E7D9C3" opacity=".12" />
      <path d="M19 9 A13 13 0 1 1 19 35 A5.5 13 0 0 0 19 9Z" fill="#E7D9C3" />
    </svg>
  )
}
