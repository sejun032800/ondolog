import * as fs from 'fs'
import * as path from 'path'
import { useSessionStore } from '../../src/store/sessionStore'

/**
 * 정적 검사: 비로그인 구간(화면 2~5) 스토어는 영속 저장소를 쓰지 않는다.
 * 근거: docs/ONDOLOG_MASTER.md Part 9-1 "데이터 생명주기 2구간 정책" —
 * "비로그인 구간의 소멸은 의도된 설계다. 영속 저장소(AsyncStorage) 사용 금지."
 */
/**
 * TSDoc 주석이 계약을 설명하려고 금지 패턴 자체를 인용한다(이 파일
 * 스스로 "AsyncStorage를 쓰지 않는다"고 문서화하는 문장 등) — 주석을
 * 제거한 실행 코드만 검사한다(__tests__/engine/determinismStaticRules.test.ts
 * 와 동일 기법).
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

describe('sessionStore.ts — 영속 저장소 미사용 정적 검사', () => {
  const source = stripComments(
    fs.readFileSync(
      path.join(__dirname, '../../src/store/sessionStore.ts'),
      'utf8',
    ),
  )

  it('AsyncStorage를 import하지 않는다', () => {
    expect(source).not.toMatch(/AsyncStorage/)
    expect(source).not.toMatch(/@react-native-async-storage/)
  })

  it('zustand persist 미들웨어를 쓰지 않는다', () => {
    expect(source).not.toMatch(/persist\(/)
    expect(source).not.toMatch(/from ['"]zustand\/middleware['"]/)
  })
})

describe('useSessionStore — 화면 2~5 메모리 상태', () => {
  beforeEach(() => {
    useSessionStore.getState().resetSession()
  })

  it('초기 상태는 전부 비어있다', () => {
    const state = useSessionStore.getState()
    expect(state.name).toBe('')
    expect(state.gender).toBeNull()
    expect(state.mbti).toBeNull()
    expect(state.result).toBeNull()
  })

  it('setBasicInfo — 화면 2 값을 저장한다', () => {
    useSessionStore
      .getState()
      .setBasicInfo({ name: '온돌', gender: 'female', birthDate: '2000-01-01' })
    const state = useSessionStore.getState()
    expect(state.name).toBe('온돌')
    expect(state.gender).toBe('female')
    expect(state.birthDate).toBe('2000-01-01')
  })

  it('setMbtiSelfReported — "알아요" 경로는 즉시 mbti를 확정한다', () => {
    useSessionStore.getState().setMbtiSelfReported('INTJ')
    const state = useSessionStore.getState()
    expect(state.mbti).toBe('INTJ')
    expect(state.mbtiSelfReported).toBe(true)
  })

  it('setQuickMbtiAnswer — "몰라요" 경로는 4개 축이 모두 채워져야 mbti가 확정된다', () => {
    const store = useSessionStore.getState()
    store.setQuickMbtiAnswer('ei', 'A')
    expect(useSessionStore.getState().mbti).toBeNull()
    store.setQuickMbtiAnswer('sn', 'B')
    expect(useSessionStore.getState().mbti).toBeNull()
    store.setQuickMbtiAnswer('ft', 'A')
    expect(useSessionStore.getState().mbti).toBeNull()
    store.setQuickMbtiAnswer('jp', 'B')
    expect(useSessionStore.getState().mbti).toBe('ENFP')
  })

  it('computeResult — q1~q5, mbti가 모두 채워지지 않으면 null', () => {
    useSessionStore.getState().setMbtiSelfReported('INTJ')
    expect(useSessionStore.getState().computeResult()).toBeNull()
  })

  it('computeResult — 전부 채워지면 결정론적으로 결과를 산출하고 저장한다', () => {
    const store = useSessionStore.getState()
    store.setMbtiSelfReported('INTJ')
    store.setQuizAnswer(1, 'A')
    store.setQuizAnswer(2, 'B')
    store.setQuizAnswer(3, 'C')
    store.setQuizAnswer(4, 'A')
    store.setQuizAnswer(5, 'B')

    const result = useSessionStore.getState().computeResult()
    expect(result).not.toBeNull()
    expect(useSessionStore.getState().result).toEqual(result)

    // 동일 입력 재실행 시 동일 결과(엔진의 결정론 계약 전제)
    const again = useSessionStore.getState().computeResult()
    expect(again).toEqual(result)
  })

  it('resetSession — 모든 필드를 초기값으로 되돌린다(앱 종료 시 소멸을 흉내)', () => {
    const store = useSessionStore.getState()
    store.setBasicInfo({ name: '온돌', gender: 'male', birthDate: '1999-05-05' })
    store.setMbtiSelfReported('ENFP')
    store.resetSession()

    const state = useSessionStore.getState()
    expect(state.name).toBe('')
    expect(state.gender).toBeNull()
    expect(state.mbti).toBeNull()
    expect(state.result).toBeNull()
  })
})
