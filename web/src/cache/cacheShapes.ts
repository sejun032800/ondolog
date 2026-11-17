/**
 * 81-(R117-2) 기기 저장 범주별 **모양 버전 + 읽을 때 모양 검사**. 가벼운 손 검사(새 패키지 0).
 *
 * - 범주(kind)마다 버전 번호(`CACHE_VERSION`)를 두고, 저장은 `{ __v, d }`로 감싼다(`deviceCache.ts`).
 * - 읽을 때 `checkFor(kind, scope)`가 고른 검사를 통과해야 쓴다. 못 지나가면 그 키만 버리고 서버에서 다시 읽는다.
 * - **범주 모양을 바꾸면 그 범주의 버전을 올린다**(옛 값은 버려지고 서버에서 다시 채워진다). 대기열은 버리지 않으므로 `queueShapes.ts`의 변환 함수를 함께 고친다.
 * - 검사는 "그리기가 깨지지 않을 만큼" - 화면이 그 값으로 바로 그리는 칸의 타입을 본다. 의미 검사(지금 커플과 같은가 등)는 읽는 곳이 그대로 한다.
 */

export type Check = (v: unknown) => boolean

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const strOrNull = (v: unknown) => v === null || isStr(v)
const numOrNull = (v: unknown) => v === null || isNum(v)
/** 칸이 없거나(옛 저장분에 없던 선택 칸) 규칙에 맞음. */
const opt = (c: Check) => (v: unknown) => v === undefined || c(v)
const arrayOf = (c: Check) => (v: unknown) => Array.isArray(v) && v.every(c)
const recordOf = (c: Check) => (v: unknown) => isObj(v) && Object.values(v).every(c)
const shape = (fields: Record<string, Check>): Check => (v) => isObj(v) && Object.entries(fields).every(([k, c]) => c(v[k]))

// ---- main ----------------------------------------------------------------
const mainSummary = shape({
  coupleId: isStr, partnerId: strOrNull, nickname: strOrNull, temperature: numOrNull,
  temperatureDateOn: strOrNull, relationshipStartDate: strOrNull, referencePhotoPath: strOrNull,
})
const publishedIssue = shape({
  id: isStr, coupleId: isStr, issueType: isStr, issueNumber: isNum, title: strOrNull, coverPath: strOrNull,
  periodStart: isStr, periodEnd: isStr, pdfDigitalPath: strOrNull, pageCount: numOrNull, publishedAt: isStr, theme: strOrNull,
})
const counts = shape({ messages: isNum, photos: isNum, dates: isNum })
const nextIssue = shape({ monthLabel: isStr, percent: isNum, counts: (v) => v === null || counts(v) })
const mainLibrary = shape({ coupleId: isStr, issues: arrayOf(publishedIssue), next: (v) => v === null || v === undefined || nextIssue(v) })
const mainFacts = shape({ coupleId: isStr, hasActivity: isBool, profilesComplete: isBool, openedIssueIds: arrayOf(isStr), openedFor: isStr })
const mainStart = shape({ coupleId: isStr, value: isNum, hasActivity: isBool })
const noticeKey = shape({ key: isStr })

// ---- name ----------------------------------------------------------------
const nameValue = shape({ name: isStr })

// ---- chat ----------------------------------------------------------------
const chatMessage = shape({
  id: isStr, clientMsgId: strOrNull, coupleId: isStr, senderId: isStr, body: strOrNull, mediaPath: strOrNull, sentAt: isStr, readAt: strOrNull,
  pending: opt(isBool), failed: opt(isBool), localUri: opt(strOrNull),
})
const chatValue = shape({ coupleId: isStr, messages: arrayOf(chatMessage) })
const chatHead = shape({ coupleId: isStr, name: isStr })

// ---- feed ----------------------------------------------------------------
const feedQuote = shape({ text: isStr, authorId: isStr })
const feedEntry = shape({
  id: isStr, dateOn: isStr, date_on: isStr, region: opt(strOrNull), title: opt(strOrNull), photoCount: isNum, memoCount: isNum,
  coverPath: strOrNull, quote: (v) => v === null || feedQuote(v),
})
const feedChapter = shape({ key: isStr, month: isNum, year: isNum, dates: arrayOf(feedEntry), photoTotal: isNum, memoTotal: isNum })
const feedValue = shape({ chapters: arrayOf(feedChapter), names: recordOf(isStr) })
const feedTrash = shape({ paths: arrayOf(isStr) })

// ---- sky -----------------------------------------------------------------
const dayStop = shape({ id: isStr, seq: isNum, arrivedAt: isStr, placeName: strOrNull })
const dayPhoto = shape({ id: isStr, authorId: isStr, storagePath: isStr, capturedAt: strOrNull, createdAt: isStr, dateStopId: strOrNull, accessLocked: isBool })
const dayMemo = shape({ id: isStr, authorId: isStr, text: isStr, createdAt: isStr, dateStopId: strOrNull })
const dayRecord = shape({
  id: isStr, date: isStr, stops: arrayOf(dayStop), photos: arrayOf(dayPhoto), memos: arrayOf(dayMemo),
  counts: shape({ stops: isNum, photos: isNum, memos: isNum }),
})
const skyValue = shape({
  coupleId: isStr, records: arrayOf(dayRecord), allLoaded: isBool, temps: recordOf(numOrNull),
  tempStatus: recordOf((v) => v === 'ok' || v === 'failed'), moons: arrayOf(shape({ periodStart: isStr, issueNumber: isNum })),
  draftPeriodStart: strOrNull,
})

// ---- route · push · qkeep ------------------------------------------------
const routeValue = shape({ route: isStr, at: isNum })
/** 81-b: 마지막으로 서버가 정해 준 계정 화면(오프라인 첫 실행에 그 화면으로). */
const bootRoute = shape({ route: isStr })
const pushAsked = shape({ asked: isBool })
/** 보존한 대기열 원본(81-). 원본은 글자 그대로(`raw`) - 다시 해석하지 않는다. */
export const queueKeepValue = shape({ entries: arrayOf(shape({ at: isStr, raw: isStr })) })

/**
 * 범주별 모양 버전. **모양을 바꾸면 올린다.** 버전 없는 값(81- 이전에 쓴 것)은 지금 버전이 1일 때만 검사를 거쳐 받아들인다
 * (81- 직전 모양 = 지금 모양 1이라서. 버전이 2가 되면 버전 없는 값도 옛 버전으로 버려진다).
 */
export const CACHE_VERSION = {
  chat: 1, main: 1, feed: 1, sky: 1, name: 1, route: 1, push: 1, qkeep: 1,
} as const

/** 범주 + scope -> 검사. 모르는 scope면 null(시작 때 훑기는 건드리지 않고, 읽기는 버린다). */
export function checkFor(kind: keyof typeof CACHE_VERSION, scope?: string): Check | null {
  switch (kind) {
    case 'main':
      if (scope === undefined) return mainSummary
      if (scope === 'library') return mainLibrary
      if (scope === 'facts') return mainFacts
      if (scope === 'start') return mainStart
      if (scope === 'nickNotice' || scope === 'dateNotice') return noticeKey
      return null
    case 'name':
      return scope ? nameValue : null
    case 'chat':
      if (!scope) return null
      return scope.endsWith(':head') ? chatHead : chatValue
    case 'feed':
      if (scope === undefined) return feedValue
      if (scope === 'trash') return feedTrash
      return null
    case 'sky':
      return scope ? skyValue : null
    case 'route':
      if (scope === 'boot') return bootRoute
      return scope === undefined ? routeValue : null
    case 'push':
      return scope === 'asked' ? pushAsked : null
    case 'qkeep':
      return queueKeepValue
    default:
      return null
  }
}
