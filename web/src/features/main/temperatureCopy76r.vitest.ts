/**
 * 76-r F2(R102-2) 온도 아래 문장 - 옛 문구 0(정적 검색) · 고르기 규칙.
 * 옛 문구는 이 파일에도 그대로 적지 않는다(조각을 이어 만든다 - 검색이 이 파일을 잡지 않게).
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { TEMPERATURE_CAPTION, temperatureCaption } from './startTemperature'

const OLD = ['첫 온도는', '기록한'].join(' ')
const SRC = join(__dirname, '..', '..')

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) files(p, out)
    else if (/\.(ts|tsx|css|json)$/.test(name)) out.push(p)
  }
  return out
}

describe('옛 문구 0', () => {
  it('web/src 전체(앱 코드 · 시험 · 문구 상수)에 옛 문구가 없다', () => {
    const hits = files(SRC).filter((p) => readFileSync(p, 'utf8').replace(/\s+/g, ' ').includes(OLD))
    expect(hits).toEqual([])
  })
})

describe('temperatureCaption', () => {
  it('활동분 0 -> 시작 온도 문장 · 활동분 > 0 -> 최근 2주 문장 · 저장값 있음 -> 최근 2주 문장', () => {
    expect(temperatureCaption({ stored: false, activityShare: false })).toBe('시작 온도예요. 기록이 쌓이면 다음 날부터 움직여요.')
    expect(temperatureCaption({ stored: false, activityShare: true })).toBe('최근 2주의 대화와 기록으로 하루에 한 번 바뀌어요.')
    expect(temperatureCaption({ stored: true, activityShare: false })).toBe(TEMPERATURE_CAPTION.moving)
  })
})
