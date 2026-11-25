/**
 * 2.0-A1 두 사람의 결 (코너 `love_dna`) — 요청 만들기 · 응답 처리 (MASTER 17-2 · 기획서 2절 4. · 계약 `docs/magazine-2-0/contracts/love_dna.json`).
 * 위임: .claude/state/prompts/phase-7/m20-a1-dispatch-engines.md ②.
 *
 * ── 이 코너가 하는 것 ───────────────────────────────────────────────────
 * 지면의 **숫자 칸**(일치율 · 기저 · 지난 호 대비 · 빅5 · 스턴버그)은 엔진(`src/engine/loveDna.ts`)이 이미 정해 입력으로 들어온다.
 * LLM은 **1회** 그 숫자를 설명하는 문장만 쓴다: 산출 설명(`explain`) · 애착 조합 해설(`attachmentCombo`) · 강점 · 보완 지점 ·
 * (일치율 60 이하일 때만) 실행 팁. 숫자는 쓰지 않거나, 쓰면 입력의 숫자와 같아야 한다(숫자 대조).
 *
 * ── 검사 (지금 3코너와 같은 것 + 코너 규칙) ──────────────────────────────
 * - 길이 · 금지어(`LOVE_DNA_VALUE_RULES` · 정책어 · "유저/사용자") — 84-a/84-g 그대로.
 * - 칸별 말투 · 숫자 대조 · 요일(84-c `runContentChecks`): 설명 · 해설 본문 · 강점 · 보완 = 글 칸(합니다체) · 해설 제목 = 라벨 칸 ·
 *   실행 팁 = 질문 칸(해요체 - 계약 tone 해요체).
 * - 판정 낱말(`LOVE_DNA_JUDGEMENT_WORDS` - "부족" · "안 맞음" 등)과, 일치율 60 초과인데 실행 팁을 쓴 경우.
 * 어기면 골격이 재요청 1회 → 그래도 어기면 실패(지금 규칙).
 *
 * ── 이 파일이 하지 않는 것 ────────────────────────────────────────────────
 * 엔진을 부르지 않는다(Deno 경로 - 확장자 없는 import를 갖는 `src/engine/` 파일을 가져오지 않는다). 숫자는 호출부가 넣는다.
 * 원문 · 레코드 id 참조 0(`NO_ID_REFERENCES`).
 */

import { z } from 'zod'
import type { CornerContext, CornerModule, CornerResponseSpec, DerivedValues } from '../cornerPipeline.ts'
import { NO_ID_REFERENCES } from '../cornerPipeline.ts'
import type { LlmRequest, PromptBlock } from '../llmRequest.ts'
import { periodLabelOf } from '../periodLabel.ts'
import { NEW_PAGE_TITLES } from '../../../../src/types/corners/cornerTitles.ts'
import {
  CORNER_SCHEMA_VERSION,
  LoveDnaStoredSchema,
  stringMaxCodePoints,
  type LoveDnaPayload,
  type LoveDnaStored,
} from '../../../../src/types/corners/storedContent.ts'
import { COMMON_PRINCIPLES_BLOCK, jsonLine } from './cornerCommon.ts'
import { LOVE_DNA_JUDGEMENT_WORDS, LOVE_DNA_VALUE_RULES, findJudgementWords } from '../../../../src/engine/corners/valueChecks.ts'
import { createNumberFacts, runContentChecks, type ContentTarget, type NumberFacts } from '../../../../src/engine/corners/contentChecks.ts'

/** 엔진이 정한 숫자 칸 + 실행 팁 허용 여부. */
export type LoveDnaFactsInput = Pick<LoveDnaPayload, 'score' | 'partners' | 'bigFive' | 'sternberg' | 'attachment'> & {
  readonly actionTipsAllowed: boolean
}

export interface LoveDnaInput {
  /** null = 두 사람 중 한 명이라도 성격 데이터가 없다 → 호출 전 빠짐(`insufficient_input`). */
  readonly facts: LoveDnaFactsInput | null
}

export const loveDnaLlmSchema = z.object({
  explain: stringMaxCodePoints(120),
  attachmentCombo: z.object({ headline: stringMaxCodePoints(30), body: stringMaxCodePoints(120) }),
  strengths: z.array(stringMaxCodePoints(40)).min(2).max(4),
  complements: z.array(stringMaxCodePoints(40)).min(2).max(4),
  /** 실행 팁(저장 칸 `actionTips`). LLM 출력 키는 `tryTogether` - 금지 키 갈래 "훈수"의 `tip`이 키 이름에 들어가지 않게(17-0-4). */
  tryTogether: z.array(stringMaxCodePoints(40)).max(2),
})
export type LoveDnaLlmOutput = z.infer<typeof loveDnaLlmSchema>

/** 애착 축 재프레이밍(MASTER 10-5-3 · `src/constants/attachmentDisplay.ts` `ATTACHMENT_REFRAME_KO` 값 그대로 - Deno 경로라 옮겨 적음, 시험이 두 표를 대조). */
export const ATTACHMENT_REFRAME_FOR_PROMPT: Readonly<Record<string, string | null>> = {
  secure: null,
  anxious: '애틋함, 온 마음',
  avoidant: '조용함, 자기 세계',
  fearful: '파도, 밀물썰물',
}

const CORNER_INSTRUCTION_BLOCK: PromptBlock = {
  text: [
    '코너: 두 사람의 결',
    '',
    '두 사람의 성격 검사 결과로 계산한 숫자가 입력에 있다(일치율 · 기저 · 빅5 다섯 축 · 스턴버그 세 성분 · 애착). 숫자는 이미 정해졌다. 너는 그 숫자를 설명하는 짧은 문장만 쓴다.',
    '이 지면은 관계를 평가하지 않는다. 두 사람의 성향이 어디서 가깝고 어디서 다른지를 특성으로 쓴다. 다른 점은 결핍이 아니라 서로 다른 결이다.',
    '',
    '쓰는 것',
    '- explain(글 칸, 120자 이내): 일치율이 어떻게 나왔는지 한두 문장. 입력의 coeffNote를 따른다. 모든 문장을 합니다체로 끝낸다.',
    '- attachmentCombo.headline(라벨 칸, 30자 이내): 두 사람의 애착 결을 이름 붙이는 말. 명사형으로 끝낸다.',
    '- attachmentCombo.body(글 칸, 120자 이내): 그 조합이 일상에서 어떻게 드러날 수 있는지 담백하게. 합니다체.',
    '- strengths(글 칸, 2~4개, 각 40자 이내): 두 사람이 가까운 축에서 보이는 공통점. 합니다체.',
    '- complements(글 칸, 2~4개, 각 40자 이내): 두 사람이 다른 축에서 서로를 채우는 방식. "부족", "안 맞음", "맞지 않음", "문제" 같은 말은 쓰지 않는다. 합니다체.',
    '- tryTogether(질문 칸, 0~2개, 각 40자 이내): 입력의 actionTipsAllowed가 true일 때만 쓴다. 대화에서 해 볼 수 있는 작은 일 하나를 해요체(~해 보세요)로. false면 빈 배열이다.',
    '',
    '지키는 것',
    '- 애착 유형 이름(불안형 · 회피형 · 혼란형 등)을 쓰지 않는다. 입력의 attachmentWords(결을 부르는 말)가 있으면 그 말로 쓴다.',
    '- 숫자를 쓰면 입력에 있는 숫자 그대로 쓴다. 입력에 없는 숫자, 백분위, "상위 몇 %"를 만들지 않는다.',
    '- 점수, 평가, 판정, 진단, 궁합의 좋고 나쁨을 말하지 않는다. 한쪽을 문제 삼지 않는다.',
    '',
    '출력 형식(JSON 하나)',
    '{"explain":"...","attachmentCombo":{"headline":"...","body":"..."},"strengths":["...","..."],"complements":["...","..."],"tryTogether":[]}',
  ].join('\n'),
  cacheBreakpoint: true,
}

function coeffNote(facts: LoveDnaFactsInput): string {
  return facts.score.chatApplied
    ? '일치율은 성격 검사로 정한 기저에 이번 달 대화의 결(답장 간격 · 주고받기)을 더했다.'
    : '이번 일치율은 성격 검사로 정한 기저만으로 냈다. 대화는 아직 반영하지 않았다(채팅 반영 전). 대화가 숫자를 움직였다고 쓰지 않는다.'
}

function promptFacts(facts: LoveDnaFactsInput): Record<string, unknown> {
  return {
    partners: facts.partners.map((p) => ({ name: p.name, typeLabel: p.labelKo })),
    score: {
      total: facts.score.total,
      base: facts.score.base,
      previousTotal: facts.score.previousTotal,
      delta: facts.score.delta,
      firstIssue: facts.score.firstIssue,
    },
    coeffNote: coeffNote(facts),
    bigFive: facts.bigFive.map((x) => ({ axis: x.label, a: x.a, b: x.b, gap: x.gap, relation: x.relation === 'close' ? '가까움' : '다름' })),
    sternberg: {
      친밀감: facts.sternberg.intimacy,
      열정: facts.sternberg.passion,
      헌신: facts.sternberg.commitment,
    },
    attachmentWords: [ATTACHMENT_REFRAME_FOR_PROMPT[facts.attachment.a] ?? null, ATTACHMENT_REFRAME_FOR_PROMPT[facts.attachment.b] ?? null],
    actionTipsAllowed: facts.actionTipsAllowed,
  }
}

function buildRequest(input: LoveDnaInput, context: CornerContext): LlmRequest {
  if (input.facts === null) throw new Error('loveDna.buildRequest: 재료 없음 - hasMaterial이 먼저 막는다')
  return {
    system: [COMMON_PRINCIPLES_BLOCK, CORNER_INSTRUCTION_BLOCK],
    user: [{ text: `기간: ${periodLabelOf(context)}` }, { text: `계산된 숫자(JSON):\n${jsonLine(promptFacts(input.facts))}` }],
  }
}

/** 지면 숫자 - 문장 속 숫자는 이 값들 가운데 하나여야 한다(84-c 숫자 대조). */
export function loveDnaNumberFacts(facts: LoveDnaFactsInput): NumberFacts {
  const b = createNumberFacts()
  const add = (n: number | null) => {
    if (n === null) return
    b.addNumber(n)
    b.addNumber(Math.abs(n))
    b.addNumber(Math.round(n))
  }
  add(facts.score.total)
  add(facts.score.base)
  add(facts.score.previousTotal)
  add(facts.score.delta)
  add(facts.score.chatDelta)
  for (const x of facts.bigFive) {
    add(x.a)
    add(x.b)
    add(x.gap)
  }
  for (const part of [facts.sternberg.intimacy, facts.sternberg.passion, facts.sternberg.commitment]) {
    add(part.a)
    add(part.b)
    add(part.shared)
  }
  add(5) // 빅5 · 다섯 축
  add(3) // 세 성분
  add(2) // 두 사람
  return b.build()
}

function contentChecksFor(input: LoveDnaInput): (llm: LoveDnaLlmOutput) => string[] {
  return (llm) => {
    if (input.facts === null) return []
    const facts = loveDnaNumberFacts(input.facts)
    const t: ContentTarget[] = []
    const add = (field: string, tone: ContentTarget['tone'], text: string) => t.push({ field, tone, text, facts, contextDates: [], knownDates: [] })
    add('explain', 'text', llm.explain)
    add('attachmentCombo.headline', 'label', llm.attachmentCombo.headline)
    add('attachmentCombo.body', 'text', llm.attachmentCombo.body)
    llm.strengths.forEach((s, i) => add(`strengths[${i}]`, 'text', s))
    llm.complements.forEach((s, i) => add(`complements[${i}]`, 'text', s))
    llm.tryTogether.forEach((s, i) => add(`tryTogether[${i}]`, 'question', s))
    const out = runContentChecks(t)
    out.push(
      ...findJudgementWords(
        llm,
        ['explain', 'attachmentCombo.headline', 'attachmentCombo.body', 'strengths[]', 'complements[]', 'tryTogether[]'],
        LOVE_DNA_JUDGEMENT_WORDS,
      ),
    )
    if (!input.facts.actionTipsAllowed && llm.tryTogether.length > 0) out.push('tryTogether: 일치율이 60을 넘으면 비워야 한다')
    return out
  }
}

function deriveFor(input: LoveDnaInput, context: CornerContext) {
  const titles = NEW_PAGE_TITLES.love_dna
  return (value: unknown): DerivedValues => {
    const parsed = loveDnaLlmSchema.safeParse(value)
    if (!parsed.success) return { ok: false, detail: parsed.error.message }
    if (input.facts === null) return { ok: false, detail: '재료 없음' }
    const { actionTipsAllowed: _allowed, ...numbers } = input.facts
    const llm = parsed.data
    return {
      ok: true,
      value: {
        schemaVersion: CORNER_SCHEMA_VERSION,
        header: { cornerName: titles.cornerName, title: titles.pageTitle, periodLabel: periodLabelOf(context) },
        payload: {
          ...numbers,
          explain: llm.explain,
          attachmentCombo: llm.attachmentCombo,
          strengths: llm.strengths,
          complements: llm.complements,
          actionTips: _allowed ? llm.tryTogether : [],
        },
      },
    }
  }
}

function responseSpec(input: LoveDnaInput, context: CornerContext): CornerResponseSpec<LoveDnaLlmOutput, LoveDnaStored> {
  return {
    llmSchema: loveDnaLlmSchema,
    isExplicitEmpty: () => false,
    references: NO_ID_REFERENCES,
    derive: deriveFor(input, context),
    storedSchema: LoveDnaStoredSchema,
    valueRules: LOVE_DNA_VALUE_RULES,
    contentChecks: contentChecksFor(input),
  }
}

export const loveDnaModule: CornerModule<LoveDnaInput, LoveDnaLlmOutput, LoveDnaStored> = {
  cornerName: NEW_PAGE_TITLES.love_dna.cornerName,
  pageTitle: NEW_PAGE_TITLES.love_dna.pageTitle,
  // 기획서 2절 4.: 두 사람 모두 성격 데이터가 있어야 한다. 없으면 호출 전 insufficient_input(빠짐 + 발행 노트 한 줄).
  hasMaterial: (input) => input.facts !== null,
  scopedRecords: () => [],
  buildRequest,
  responseSpec,
}
