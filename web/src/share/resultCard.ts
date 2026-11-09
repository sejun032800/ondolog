/**
 * 간략 결과(A08)를 이미지 한 장으로 그린다(공유 · 이미지 저장용). 캔버스에 직접 그린다 - 새 패키지 0.
 *
 * **카드에는 이름 등 개인 식별 정보가 없다**(MASTER 9-1 화면 5). 이 함수는 그런 값을 받는 자리가 없다:
 * 유형 라벨 · 한 줄 설명 · MBTI · 애니어그램 코어 · 희귀 여부 · 브랜드 글자표만 그린다.
 */
import type { ImageFile } from '../platform/bridge'

export interface ResultCardData {
  labelEn: string
  labelKo: string
  copyKo?: string
  mbti: string
  enneagramCore: number
  isRare: boolean
}

export const CARD_W = 1080
export const CARD_H = 1350
export const RESULT_CARD_FILE_NAME = 'ondolog-result.png'

const INK = '#0A0814'
const TEXT = '#F3EFF7'
const ORCHID = '#E3A0C8'
const FONT = "'Pretendard', -apple-system, 'Apple SD Gothic Neo', sans-serif"

/** 글자 수가 아니라 실제 폭으로 줄을 나눈다. 공백이 없는 긴 덩어리는 글자 단위로 자른다. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  const push = (t: string) => {
    if (t) lines.push(t)
  }
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth) {
      line = next
      continue
    }
    push(line)
    line = ''
    if (ctx.measureText(word).width <= maxWidth) {
      line = word
      continue
    }
    for (const ch of word) {
      const tryLine = line + ch
      if (ctx.measureText(tryLine).width > maxWidth && line) {
        push(line)
        line = ch
      } else line = tryLine
    }
  }
  push(line)
  return lines
}

function setSpacing(ctx: CanvasRenderingContext2D, px: number) {
  ;(ctx as unknown as { letterSpacing?: string }).letterSpacing = `${px}px`
}

export function drawResultCard(ctx: CanvasRenderingContext2D, d: ResultCardData): void {
  const cx = CARD_W / 2
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  const glow = ctx.createLinearGradient(0, 0, 0, CARD_H)
  glow.addColorStop(0, 'rgba(110,86,190,0.28)')
  glow.addColorStop(1, 'rgba(10,8,20,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  ctx.font = `500 28px ${FONT}`
  ctx.fillStyle = 'rgba(243,239,247,0.5)'
  setSpacing(ctx, 9)
  ctx.fillText('MY LOVE TYPE', cx, 330)

  ctx.font = `600 36px ${FONT}`
  ctx.fillStyle = ORCHID
  setSpacing(ctx, 11)
  ctx.fillText(d.labelEn, cx, 420)

  setSpacing(ctx, -1)
  ctx.font = `600 92px ${FONT}`
  ctx.fillStyle = TEXT
  let y = 540
  for (const line of wrap(ctx, d.labelKo, 820)) {
    ctx.fillText(line, cx, y)
    y += 112
  }

  if (d.copyKo) {
    setSpacing(ctx, 0)
    ctx.font = `400 38px ${FONT}`
    ctx.fillStyle = 'rgba(243,239,247,0.72)'
    y += 10
    for (const line of wrap(ctx, d.copyKo, 780)) {
      ctx.fillText(line, cx, y)
      y += 58
    }
  }

  ctx.fillStyle = 'rgba(243,239,247,0.2)'
  ctx.fillRect(cx - 40, y + 20, 80, 2)
  y += 90

  setSpacing(ctx, 0)
  ctx.font = `400 38px ${FONT}`
  ctx.fillStyle = 'rgba(243,239,247,0.72)'
  ctx.fillText(`${d.mbti} · 애니어그램 ${d.enneagramCore}`, cx, y)
  if (d.isRare) {
    ctx.font = `400 32px ${FONT}`
    ctx.fillText('희귀 조합', cx, y + 56)
  }

  ctx.font = `500 30px ${FONT}`
  ctx.fillStyle = 'rgba(243,239,247,0.5)'
  setSpacing(ctx, 14)
  ctx.fillText('ONDOLOG', cx, 1170)
}

/** 결과 카드 PNG. 캔버스를 쓸 수 없으면 null. */
export async function renderResultCardImage(d: ResultCardData): Promise<ImageFile | null> {
  try {
    await Promise.all(
      ['400 38px Pretendard', '500 30px Pretendard', '600 92px Pretendard'].map((f) => document.fonts?.load(f).catch(() => [])),
    )
    const canvas = document.createElement('canvas')
    canvas.width = CARD_W
    canvas.height = CARD_H
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    drawResultCard(ctx, d)
    return { dataUrl: canvas.toDataURL('image/png'), fileName: RESULT_CARD_FILE_NAME }
  } catch {
    return null
  }
}
