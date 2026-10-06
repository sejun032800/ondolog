/// <reference types="jest" />
import { z } from 'zod'
import { findMissingReferencePaths, type ReferenceMapping } from './cornerPipeline.ts'
import { dateArchiveLlmSchema, DATE_ARCHIVE_REFERENCES } from './corners/dateArchive.ts'
import { sweetWordsLlmSchema, SWEET_WORDS_REFERENCES } from './corners/sweetWords.ts'
import { thisMonthLlmSchema, THIS_MONTH_REFERENCES } from './corners/thisMonth.ts'

/**
 * Zod 카나리아 (MASTER §17-0-4 r45).
 * 위임: .claude/state/prompts/phase-7/38-corner-pipeline-three-corners.md 범위 6.
 *
 * `findMissingReferencePaths`는 `schema._zod.def`(Zod 내부 구조)를 읽는다. Zod를 올리면 그 구조가 바뀔 수 있다.
 * 판정은 **거짓 실패 쪽으로 기울어** 오타를 놓치지는 않지만, 멀쩡한 선언이 실패할 수 있고 그때 원인이 엉뚱한
 * 곳(코너 선언)으로 보인다. 이 파일은 그 경우 **Zod가 바뀌었다고 말하는** 테스트다.
 *
 * ── 셋 ──────────────────────────────────────────────────────────────────
 * 1. **기준 스키마**: 경로를 알고 있는 스키마(함수가 따라가는 모든 구성 요소를 담았다)에서 모든 경로가 "있다"고
 *    판정되는지. 실패 메시지는 "코너 선언이 틀렸다"가 아니라 "Zod 내부 구조가 바뀌었다"를 가리킨다.
 * 2. **음성 대조**: 알고 있는 없는 경로가 전부 "없다"고 판정되는지(모두 있다고 하는 퇴화를 막는다).
 * 3. **공개 변환과의 교차 검증**: 같은 질문을 Zod의 공개 변환(`z.toJSONSchema`)으로 풀어 본 판정과 비교한다. 두 판정이
 *    갈리면 내부 구조 쪽이 바뀐 것이다. 이 교차 검증은 "공개 변환으로 같은 판정이 되는가"의 검토 결과이기도 하다
 *    (아래 REVIEW 주석 참조).
 */

const zodVersion = (() => {
  const v = (z.core as { version?: { major: number; minor: number; patch: number } }).version
  return v === undefined ? '(버전을 읽지 못함)' : `${v.major}.${v.minor}.${v.patch}`
})()

const CHANGED_MESSAGE = (detail: string) =>
  `Zod 내부 구조가 바뀌었다 (Zod ${zodVersion}). ${detail}\n` +
  '코너의 path 선언이 틀린 것이 아니라 `findMissingReferencePaths`가 읽는 `schema._zod.def` 구조가 달라졌을 가능성이 크다. ' +
  '`cornerPipeline.ts`의 `unwrapSchema`·`schemaHasPath`를 새 구조에 맞추거나, 공개 변환(`z.toJSONSchema`)으로 옮기는 것을 검토한다 (MASTER 17-0-4 r45).'

function mapping(paths: readonly string[]): ReferenceMapping {
  const [first, ...rest] = paths.map((path) => ({ path, kind: 'message' as const, copy: {} }))
  if (first === undefined) throw new Error('mapping: path가 하나 이상 필요하다')
  return { kind: 'fields', fields: [first, ...rest] }
}

// ---------------------------------------------------------------------------
// 기준 스키마 - 함수가 따라가는 모든 구성 요소
// ---------------------------------------------------------------------------

const Leaf = z.object({ id: z.string() })

const ReferenceSchema = z.object({
  // 평범한 객체·중첩 객체
  top: z.string(),
  nested: z.object({ inner: z.object({ id: z.string() }) }),
  // 배열 - 객체 배열, 배열 안의 배열
  list: z.array(z.object({ id: z.string(), sub: z.array(z.object({ deepId: z.string() })) })),
  // 래퍼 - 모양을 바꾸지 않고 감싼다
  optionalObj: z.object({ id: z.string() }).optional(),
  nullableObj: z.object({ id: z.string() }).nullable(),
  optionalNullableObj: z.object({ id: z.string() }).nullable().optional(),
  defaultObj: z.object({ id: z.string() }).default({ id: 'x' }),
  prefaultObj: z.object({ id: z.string() }).prefault({ id: 'x' }),
  readonlyObj: z.object({ id: z.string() }).readonly(),
  catchObj: z.object({ id: z.string() }).catch({ id: 'x' }),
  nonoptionalObj: z.object({ id: z.string() }).optional().nonoptional(),
  // 검사 추가 - 모양은 그대로
  refinedObj: z.object({ id: z.string() }).refine(() => true),
  superRefinedObj: z.object({ id: z.string() }).superRefine(() => undefined),
  // 파이프·변환 - 입력 쪽 모양을 따른다
  pipedObj: z.object({ id: z.string() }).transform((v) => v).pipe(z.object({ id: z.string() })),
  // 지연
  lazyObj: z.lazy(() => Leaf),
  // 유니온 - 갈래 어디든 있으면 있다
  unionObj: z.union([z.object({ a: z.string() }), z.object({ b: z.object({ id: z.string() }) })]),
  discriminated: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('x'), xId: z.string() }),
    z.object({ kind: z.literal('y'), yItems: z.array(z.object({ yId: z.string() })) }),
  ]),
  // 교차
  intersected: z.intersection(z.object({ left: z.string() }), z.object({ right: z.object({ id: z.string() }) })),
  // 확장·느슨한 객체
  extended: Leaf.extend({ extra: z.object({ id: z.string() }) }),
  loose: z.looseObject({ looseId: z.string() }),
})

/** 기준 스키마에서 있는 것으로 알려진 경로 - 전부 "있다"고 판정되어야 한다. */
const KNOWN_PRESENT: readonly string[] = [
  'top',
  'nested.inner.id',
  'list[].id',
  'list[].sub[].deepId',
  'optionalObj.id',
  'nullableObj.id',
  'optionalNullableObj.id',
  'defaultObj.id',
  'prefaultObj.id',
  'readonlyObj.id',
  'catchObj.id',
  'nonoptionalObj.id',
  'refinedObj.id',
  'superRefinedObj.id',
  'pipedObj.id',
  'lazyObj.id',
  'unionObj.a',
  'unionObj.b.id',
  'discriminated.xId',
  'discriminated.yItems[].yId',
  'intersected.left',
  'intersected.right.id',
  'extended.id',
  'extended.extra.id',
  'loose.looseId',
]

/** 기준 스키마에 없는 것으로 알려진 경로 - 전부 "없다"고 판정되어야 한다(오타·모양 불일치). */
const KNOWN_ABSENT: readonly string[] = [
  'tpo',
  'nested.inner.idd',
  'nested.innr.id',
  'list.id', // 배열인데 [] 없음
  'list[].sub.deepId', // 배열인데 [] 없음
  'list[].sbu[].deepId',
  'top[].id', // 배열이 아님
  'optionalObj.idd',
  'unionObj.c',
  'discriminated.zId',
  'discriminated.yItems[].yid',
  'intersected.middle',
  'extended.extra.idd',
  'noSuchField',
]

describe('Zod 카나리아 - 기준 스키마', () => {
  it('경로를 알고 있는 기준 스키마에서 모든 경로가 있다고 판정된다', () => {
    const missing = findMissingReferencePaths(ReferenceSchema, mapping(KNOWN_PRESENT))
    if (missing.length > 0) {
      throw new Error(CHANGED_MESSAGE(`기준 스키마에 분명히 있는 경로가 없다고 판정됐다: ${missing.join(', ')}`))
    }
    expect(missing).toEqual([])
  })

  it('경로마다 따로 물어도 같다 - 하나씩 판정해 어느 구성 요소에서 깨지는지 드러난다', () => {
    const broken = KNOWN_PRESENT.filter((p) => findMissingReferencePaths(ReferenceSchema, mapping([p])).length > 0)
    if (broken.length > 0) {
      throw new Error(CHANGED_MESSAGE(`다음 구성 요소를 따라가지 못한다: ${broken.join(', ')}`))
    }
    expect(broken).toEqual([])
  })

  it('음성 대조 - 없는 경로는 전부 없다고 판정된다(모두 있다고 하는 퇴화가 아니다)', () => {
    const found = KNOWN_ABSENT.filter((p) => findMissingReferencePaths(ReferenceSchema, mapping([p])).length === 0)
    if (found.length > 0) {
      throw new Error(CHANGED_MESSAGE(`없는 경로를 있다고 판정했다: ${found.join(', ')}`))
    }
    expect(found).toEqual([])
  })

  it('기준 스키마는 비어 있지 않다 - 알려진 경로가 실제로 25개 이상이고 스키마가 객체다', () => {
    expect(KNOWN_PRESENT.length).toBeGreaterThanOrEqual(25)
    expect(ReferenceSchema instanceof z.ZodObject).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 공개 변환(`z.toJSONSchema`)과의 교차 검증
// ---------------------------------------------------------------------------

/**
 * REVIEW (r45 "공개 API 검토") - Zod의 공개 변환으로 같은 판정이 되는가.
 *
 * 된다. `z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' })`는 객체를 `properties`로, 배열을 `items`로,
 * 유니온을 `anyOf`/`oneOf`로, 교차를 `allOf`로 내보내고, 선택·nullable·default·readonly·catch·pipe(입력 쪽)·
 * lazy(재귀가 아니면)는 안쪽 모양으로 풀어 준다. 아래 `publicHasPath`가 그 결과를 따라가며, 기준 스키마와
 * 세 코너의 LLM 출력 스키마에서 내부 구조 판정과 **같은 답**을 내는지를 비교한다.
 *
 * 그럼에도 `findMissingReferencePaths`를 공개 변환으로 옮기지는 않았다(위임: "검토하고 보고"). 옮기면 (1) 재귀
 * 스키마의 `$ref` 해석이 필요하고, (2) `io`·`unrepresentable` 옵션에 판정이 기대며, (3) 이 판정이 PM이 검토한
 * 기존 구현에서 달라진다. 이 테스트가 두 판정을 계속 맞대어 보므로, 옮기기로 결정하면 이 함수가 그대로 구현의
 * 뼈대가 된다.
 */
type JsonSchemaNode = {
  properties?: Record<string, JsonSchemaNode>
  items?: JsonSchemaNode
  anyOf?: JsonSchemaNode[]
  oneOf?: JsonSchemaNode[]
  allOf?: JsonSchemaNode[]
}

function publicHasPath(schema: z.ZodType, path: string): boolean {
  const segments = path.split('.')
  if (!segments.every((s) => /^[A-Za-z_][A-Za-z0-9_]*(\[\])?$/.test(s)) || segments[segments.length - 1].endsWith('[]')) {
    return false
  }
  const root = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonSchemaNode

  const branches = (node: JsonSchemaNode): JsonSchemaNode[] => {
    const variants = [...(node.anyOf ?? []), ...(node.oneOf ?? []), ...(node.allOf ?? [])]
    return variants.length === 0 ? [node] : variants.flatMap(branches)
  }
  // allOf는 "모두"이지만 이 판정은 "어느 갈래에든 있으면 있다"로 읽는다 - 내부 구조 판정과 같은 규칙이다.
  const walk = (node: JsonSchemaNode, rest: readonly string[]): boolean => {
    if (rest.length === 0) return true
    const [segment, ...tail] = rest
    const isArray = segment.endsWith('[]')
    const key = isArray ? segment.slice(0, -2) : segment
    for (const candidate of branches(node)) {
      const field = candidate.properties?.[key]
      if (field === undefined) continue
      if (!isArray) {
        if (walk(field, tail)) return true
        continue
      }
      for (const arrayNode of branches(field)) {
        if (arrayNode.items !== undefined && walk(arrayNode.items, tail)) return true
      }
    }
    return false
  }
  return walk(root, segments)
}

describe('Zod 카나리아 - 공개 변환(z.toJSONSchema)과의 교차 검증', () => {
  const internalHas = (schema: z.ZodType, path: string) => findMissingReferencePaths(schema, mapping([path])).length === 0

  function expectSameJudgement(label: string, schema: z.ZodType, paths: readonly string[]) {
    const disagreements = paths.filter((p) => internalHas(schema, p) !== publicHasPath(schema, p))
    if (disagreements.length > 0) {
      throw new Error(
        CHANGED_MESSAGE(
          `${label}: 내부 구조 판정과 공개 변환 판정이 갈린다 - ${disagreements
            .map((p) => `${p} (내부 ${internalHas(schema, p)}, 공개 ${publicHasPath(schema, p)})`)
            .join(', ')}`,
        ),
      )
    }
    expect(disagreements).toEqual([])
  }

  it('기준 스키마 - 있는 경로·없는 경로 모두 같은 답이다', () => {
    expectSameJudgement('기준 스키마', ReferenceSchema, [...KNOWN_PRESENT, ...KNOWN_ABSENT])
  })

  function declaredPaths(mappingValue: ReferenceMapping): string[] {
    return mappingValue.kind === 'fields' ? mappingValue.fields.map((f) => f.path) : []
  }
  /** 선언된 path에서 만든 오타 변형 - 마지막 글자를 바꾼 것, 배열 표시를 뺀 것. */
  function typos(paths: readonly string[]): string[] {
    return paths.flatMap((p) => [`${p}x`, p.replace('[]', ''), p.replace(/^[a-z]/i, 'z')])
  }

  it.each([
    ['17-1 데이트 아카이브', dateArchiveLlmSchema, DATE_ARCHIVE_REFERENCES],
    ['17-4 다정한 말들(월간)', sweetWordsLlmSchema('monthly'), SWEET_WORDS_REFERENCES],
    ['17-4 다정한 말들(일간)', sweetWordsLlmSchema('daily'), SWEET_WORDS_REFERENCES],
    ['17-5 이달의 우리', thisMonthLlmSchema, THIS_MONTH_REFERENCES],
  ] as const)('%s - 선언된 path와 그 오타 변형에서 같은 답이다', (label, schema, refs) => {
    const declared = declaredPaths(refs)
    expectSameJudgement(label, schema, [...declared, ...typos(declared)])
    // 선언된 path는 전부 있다(둘 다 같은 답이고, 그 답이 "있다"다).
    expect(declared.every((p) => publicHasPath(schema, p))).toBe(true)
  })
})
