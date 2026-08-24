import * as fs from 'fs'
import * as path from 'path'

/**
 * 이 파일들 스스로가 "enneagramPrevalence를 import하지 않는다"는 계약을
 * TSDoc 주석으로 설명하면서 그 이름을 인용한다. 주석을 제거한 실행
 * 코드(실제 import/참조 여부)만 검사해야 오탐이 없다.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

/**
 * 물리적 경계 검증: src/engine/loveTypeInference.ts(채점 로직)는
 * MBTI별 애니어그램 사전분포(src/constants/enneagramPrevalence.ts)를
 * import하면 안 된다. Part 10-2-6은 그 분포를 "희귀 조합" 배지 표시와
 * 선택지 노출 순서에만 쓰라고 못박고, 채점에는 "일절 관여하지 않는다"고
 * 명시한다.
 *
 * enneagram.ts(HORNEVIAN_HARMONIC_TABLE)와 enneagramPrevalence.ts는
 * 서로 재수출하지 않는 별개 파일이므로, loveTypeInference.ts의 소스
 * 문자열에 'enneagramPrevalence' 또는 'MBTI_ENNEAGRAM_PREVALENCE'가
 * 전혀 등장하지 않으면 import가 물리적으로 불가능하다는 뜻이다.
 */
describe('import 경계 — loveTypeInference.ts는 사전분포를 참조할 수 없다', () => {
  const rawSource = fs.readFileSync(
    path.join(__dirname, '../../src/engine/loveTypeInference.ts'),
    'utf8',
  )
  // 이 파일의 TSDoc 주석 자체가 경계를 설명하며 이름을 인용하므로,
  // 실행 코드(주석 제거 후)만 검사한다.
  const source = stripComments(rawSource)

  it("실행 코드에 'enneagramPrevalence' 문자열이 없다 (주석의 설명 문구는 제외)", () => {
    expect(source).not.toContain('enneagramPrevalence')
  })

  it("실행 코드에 'MBTI_ENNEAGRAM_PREVALENCE' 식별자가 없다 (주석의 설명 문구는 제외)", () => {
    expect(source).not.toContain('MBTI_ENNEAGRAM_PREVALENCE')
  })

  it('실제로 이 테스트가 실패를 잡아낼 수 있는지 자체 검증한다 — 사전분포를 import하는 예시 소스는 걸린다', () => {
    const contaminated = `
      import { MBTI_ENNEAGRAM_PREVALENCE } from '../constants/enneagramPrevalence'
      export function scoreWithPrevalence() { return MBTI_ENNEAGRAM_PREVALENCE }
    `
    expect(contaminated).toContain('enneagramPrevalence')
    expect(contaminated).toContain('MBTI_ENNEAGRAM_PREVALENCE')
  })
})

describe('src/engine 전체 — enneagramPrevalence 미참조 (전체 엔진 모듈 스윕)', () => {
  const engineDir = path.join(__dirname, '../../src/engine')
  const files = fs
    .readdirSync(engineDir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))

  it('엔진 디렉터리에서 최소 한 개 이상의 .ts 파일을 스캔했다', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const file of files) {
    it(`${file}은 enneagramPrevalence를 참조하지 않는다`, () => {
      const source = stripComments(
        fs.readFileSync(path.join(engineDir, file), 'utf8'),
      )
      expect(source).not.toContain('enneagramPrevalence')
      expect(source).not.toContain('MBTI_ENNEAGRAM_PREVALENCE')
    })
  }
})
