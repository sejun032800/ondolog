import {
  UNRESOLVED,
  UNRESOLVED_REGISTRY,
  UnresolvedConstantError,
  UnknownUnresolvedKeyError,
  type UnresolvedKey,
} from '../../src/engine/constants/unresolved'
import { computeChatDelta } from '../../src/engine/dnaScore'
import { DNA_CHAT_DELTA_V0 } from '../../src/engine/loveDna'

describe('UNRESOLVED — 등록된 키 2종은 값이 아니라 throw를 낸다', () => {
  it('leagueStats.shrinkage는 UnresolvedConstantError를 던지고 메시지에 phase(7)와 doc(MASTER Part 10-8-3)을 싣는다', () => {
    try {
      UNRESOLVED({ key: 'leagueStats.shrinkage' })
      throw new Error('여기 도달하면 안 된다 — UNRESOLVED는 반드시 throw한다')
    } catch (e) {
      expect(e).toBeInstanceOf(UnresolvedConstantError)
      const err = e as UnresolvedConstantError
      expect(err.message).toContain('7')
      expect(err.message).toContain('MASTER Part 10-8-3')
      expect(err.phase).toBe(7)
      expect(err.doc).toBe('MASTER Part 10-8-3')
    }
  })

  it('faceMatch.threshold는 UnresolvedConstantError를 던지고 메시지에 phase(6)와 doc(MASTER Part 9-4)을 싣는다', () => {
    try {
      UNRESOLVED({ key: 'faceMatch.threshold' })
      throw new Error('여기 도달하면 안 된다 — UNRESOLVED는 반드시 throw한다')
    } catch (e) {
      expect(e).toBeInstanceOf(UnresolvedConstantError)
      const err = e as UnresolvedConstantError
      expect(err.message).toContain('6')
      expect(err.message).toContain('MASTER Part 9-4')
      expect(err.phase).toBe(6)
      expect(err.doc).toBe('MASTER Part 9-4')
    }
  })

  it('dnaScore.chatDelta는 ROADMAP r158 R158-2 v0(A′ · dna_v0) 확정으로 해소돼 레지스트리에 없다 — 호출하면 UnknownUnresolvedKeyError · computeChatDelta는 값을 낸다', () => {
    expect(Object.keys(UNRESOLVED_REGISTRY)).not.toContain('dnaScore.chatDelta')
    expect(() => {
      // @ts-expect-error — 해소·제거된 키는 UnresolvedKey에 속하지 않는다.
      UNRESOLVED({ key: 'dnaScore.chatDelta' })
    }).toThrow(UnknownUnresolvedKeyError)
    // v0 동작: 답장 중앙값 60초 · 주고받기 0.6 -> +25 / 3시간 · 0.2 -> −10 (계수는 호출부 상수)
    expect(computeChatDelta({ replyGapMedianSeconds: 60, turnTakingRatio: 0.6 }, DNA_CHAT_DELTA_V0)).toBe(25)
    expect(computeChatDelta({ replyGapMedianSeconds: 10800, turnTakingRatio: 0.2 }, DNA_CHAT_DELTA_V0)).toBe(-10)
  })

  it('temperature.activityScore는 r74 v0 확정으로 해소돼 레지스트리에 없다 — 호출하면 UnknownUnresolvedKeyError', () => {
    expect(Object.keys(UNRESOLVED_REGISTRY)).not.toContain('temperature.activityScore')
    expect(() => {
      // @ts-expect-error — 해소·제거된 키는 UnresolvedKey에 속하지 않는다.
      UNRESOLVED({ key: 'temperature.activityScore' })
    }).toThrow(UnknownUnresolvedKeyError)
  })

  it('레지스트리에 정확히 이 2개 키만 등록돼 있다 (Part 16-2 목록과 1:1 대응 · chatDelta는 r158 해소)', () => {
    expect(Object.keys(UNRESOLVED_REGISTRY).sort()).toEqual(
      [
        'leagueStats.shrinkage',
        'faceMatch.threshold',
      ].sort(),
    )
  })
})

describe('UNRESOLVED — 결정론 계약', () => {
  it('동일 키로 100회 반복 호출 → 100회 모두 동일한 에러 메시지(결정론)', () => {
    const messages = Array.from({ length: 100 }, () => {
      try {
        UNRESOLVED({ key: 'leagueStats.shrinkage' })
        return null
      } catch (e) {
        return (e as Error).message
      }
    })
    expect(messages.every((m) => m !== null)).toBe(true)
    expect(new Set(messages).size).toBe(1)
  })

  it('등록 키 모두 100회 반복해도 매번 throw하며 메시지가 흔들리지 않는다', () => {
    const keys: readonly UnresolvedKey[] = [
      'leagueStats.shrinkage',
      'faceMatch.threshold',
    ]
    for (const key of keys) {
      const messages = Array.from({ length: 100 }, () => {
        try {
          UNRESOLVED({ key })
          return null
        } catch (e) {
          return (e as Error).message
        }
      })
      expect(messages.every((m) => m !== null)).toBe(true)
      expect(new Set(messages).size).toBe(1)
    }
  })
})

describe('UNRESOLVED — 미등록 키는 등록 키와 다른 에러 타입으로 실패한다', () => {
  it('등록되지 않은 키 리터럴은 컴파일 타임에 거부되고(ts-expect-error), 런타임에서는 UnknownUnresolvedKeyError를 던진다(등록 키의 UnresolvedConstantError와 다른 타입)', () => {
    expect(() => {
      // @ts-expect-error — 'not.a.real.key'는 UNRESOLVED_REGISTRY에 없는 키라 UnresolvedKey에 속하지 않는다.
      UNRESOLVED({ key: 'not.a.real.key' })
    }).toThrow(UnknownUnresolvedKeyError)
  })

  it('UnknownUnresolvedKeyError는 UnresolvedConstantError의 인스턴스가 아니고, 그 반대도 아니다(서로 다른 에러 타입)', () => {
    let unknownErr: unknown
    try {
      // @ts-expect-error — 미등록 키
      UNRESOLVED({ key: 'does.not.exist' })
    } catch (e) {
      unknownErr = e
    }
    expect(unknownErr).toBeInstanceOf(UnknownUnresolvedKeyError)
    expect(unknownErr).not.toBeInstanceOf(UnresolvedConstantError)

    let registeredErr: unknown
    try {
      UNRESOLVED({ key: 'faceMatch.threshold' })
    } catch (e) {
      registeredErr = e
    }
    expect(registeredErr).toBeInstanceOf(UnresolvedConstantError)
    expect(registeredErr).not.toBeInstanceOf(UnknownUnresolvedKeyError)
  })

  it('미등록 키 호출도 100회 반복하면 항상 동일한 에러 타입·메시지로 실패한다(결정론)', () => {
    const results = Array.from({ length: 100 }, () => {
      try {
        // @ts-expect-error — 미등록 키
        UNRESOLVED({ key: 'totally.unregistered' })
        return null
      } catch (e) {
        return {
          isUnknownType: e instanceof UnknownUnresolvedKeyError,
          message: (e as Error).message,
        }
      }
    })
    expect(results.every((r) => r !== null && r.isUnknownType)).toBe(true)
    const messages = new Set(results.map((r) => r?.message))
    expect(messages.size).toBe(1)
  })
})

describe('UNRESOLVED — 값을 지어내지 않는다', () => {
  it('UNRESOLVED는 절대 값을 반환하지 않는다 — 반환되면(throw하지 않으면) 이 테스트가 실패해야 한다', () => {
    for (const key of Object.keys(UNRESOLVED_REGISTRY) as UnresolvedKey[]) {
      let threw = false
      try {
        const result = UNRESOLVED({ key })
        // 여기 도달했다는 것은 UNRESOLVED가 값을 반환했다는 뜻 — 규격 위반.
        void result
      } catch {
        threw = true
      }
      expect(threw).toBe(true)
    }
  })
})
