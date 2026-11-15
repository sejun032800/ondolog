/**
 * 동의 상수 파일 - 개인정보 처리방침 · 이용약관 · AI 활용 안내와 동의 화면 한 줄을 **한 곳**에 둔다(R38-2 · R64-6 · R77-4 · A-13 · 51- C13).
 * 온보딩 동의 화면의 [보기] 시트와 설정 > 개인정보 & 약관 · 앱 정보가 모두 이 파일의 같은 문서를 읽는다.
 *
 * 문장은 PM 최소판 v1(`.claude/state/prompts/phase-7/PM_legal_minimal_v1.md` §1~§3)을 **그대로** 옮겼다(띄어쓰기 · 줄바꿈 · 굵은 표시만 구조로 바꿈).
 * 실제 커플 시험 운영(베타 전)용 최소판이며 법무 검토판은 M4-7이다 - 출시 전 법무 검토를 대신하지 않는다.
 *
 * 아래 네 값은 **사람이 채운다**(운영자 · 문의 메일 · 저장 지역 · 시행일). 지금은 비어 있고, 값이 비어 있으면 `LEGAL_CHECK=1 npx vitest run src/legal`(PowerShell: `$env:LEGAL_CHECK='1'; npx vitest run src/legal`)이 실패해 빌드 관문이 된다.
 * 값은 이 파일에만 두고 로그 · 보고 · 다른 파일에 옮겨 적지 않는다. 문의 메일은 설정 > 앱 정보 > 문의하기의 받는 사람과 같은 상수다.
 */
export const LEGAL_OPERATOR = '정세준'
export const LEGAL_CONTACT_EMAIL = 'ondologqna@gmail.com'
export const LEGAL_STORAGE_REGION = '대한민국 서울'
export const LEGAL_EFFECTIVE_DATE = '2026년 11월 15일'

export type LegalDocumentKey = 'terms' | 'privacy' | 'aiUsage' | 'marketing'

export interface LegalTable {
  head: string[]
  rows: string[][]
}

export interface LegalSection {
  heading?: string
  paragraphs?: string[]
  bullets?: string[]
  table?: LegalTable
  /** 표 아래 문단. */
  after?: string[]
}

export interface LegalDocument {
  key: LegalDocumentKey
  title: string
  /** 제목 아래 한 줄(시행일 · 운영자 · 문의). */
  meta?: string
  intro?: string[]
  sections: LegalSection[]
}

/** `{운영자}` 같은 자리를 위 상수 값으로 채운다. 문서 문장에 `{ }`가 남지 않게 한다. */
export function fillLegalPlaceholders(text: string): string {
  return text
    .split('{운영자}').join(LEGAL_OPERATOR)
    .split('{문의 이메일}').join(LEGAL_CONTACT_EMAIL)
    .split('{저장 지역}').join(LEGAL_STORAGE_REGION)
    .split('{시행일}').join(LEGAL_EFFECTIVE_DATE)
}

function fillSection(s: LegalSection): LegalSection {
  return {
    heading: s.heading === undefined ? undefined : fillLegalPlaceholders(s.heading),
    paragraphs: s.paragraphs?.map(fillLegalPlaceholders),
    bullets: s.bullets?.map(fillLegalPlaceholders),
    table: s.table ? { head: s.table.head.map(fillLegalPlaceholders), rows: s.table.rows.map((r) => r.map(fillLegalPlaceholders)) } : undefined,
    after: s.after?.map(fillLegalPlaceholders),
  }
}

function fillDocument(d: LegalDocument): LegalDocument {
  return {
    key: d.key,
    title: fillLegalPlaceholders(d.title),
    meta: d.meta === undefined ? undefined : fillLegalPlaceholders(d.meta),
    intro: d.intro?.map(fillLegalPlaceholders),
    sections: d.sections.map(fillSection),
  }
}

const META = '시행일: {시행일} · 운영자: {운영자} · 문의: {문의 이메일}'

const PRIVACY_TEMPLATE: LegalDocument = {
  key: 'privacy',
  title: '온도록 개인정보 처리방침',
  meta: META,
  sections: [
    {
      heading: '1. 모으는 정보',
      bullets: [
        '카카오 로그인으로 받는 정보: 카카오계정 이메일. 카카오가 함께 보내는 닉네임·프로필 사진은 저장하지 않습니다.',
        '직접 입력하는 정보: 이름, 생년월일, 성별, 성격 검사 응답과 결과, 사귄 날짜, 커플 닉네임, 마케팅 정보 수신 동의 여부',
        '서비스를 쓰며 남기는 기록: 두 사람의 대화, 사진, 메모, 데이트 장소 이름과 시각, 스토리',
        '사진의 촬영 시각: 기기에서 읽어 날짜를 채우는 데 씁니다. 사진의 위치(GPS) 정보는 읽지도 저장하지도 않습니다.',
        '서비스 운영 중 자동으로 생기는 기록: 로그인·접속 기록',
      ],
      after: ['얼굴 인식 등 생체정보는 모으지 않습니다.'],
    },
    {
      heading: '2. 쓰는 목적',
      bullets: [
        '계정을 만들고 본인을 확인합니다(이메일은 계정 식별과 연락에만 쓰고, 잡지·공유·외부 AI에는 쓰지 않습니다).',
        '두 사람을 커플로 연결하고 대화·기록 기능을 제공합니다.',
        '두 사람의 기록으로 매달 잡지를 만듭니다.',
        '문의에 답하고, 마케팅 수신에 동의한 경우에만 소식을 보냅니다.',
      ],
    },
    {
      heading: '3. 외부 AI 서비스로 보내는 정보',
      paragraphs: [
        '잡지 문장을 쓰기 위해 글로 된 기록(대화, 메모, 장소 이름과 시각, 사진 장수)을 Anthropic의 Claude API로 보냅니다. 사진 자체는 보내지 않습니다. 자세한 내용은 "AI 활용 안내"에 있습니다.',
      ],
    },
    {
      heading: '4. 맡기는 곳과 국외 이전',
      table: {
        head: ['받는 곳', '하는 일', '옮겨지는 정보', '나라', '보관'],
        rows: [
          ['Supabase Inc.', '데이터 저장·로그인·파일 보관', '1번의 모든 정보', '저장 위치: {저장 지역} (회사 소재: 미국)', '아래 5번 기간 동안'],
          ['Anthropic PBC', '잡지 문장 생성(Claude API)', '3번의 글 기록', '미국', '받은 날부터 30일 안에 삭제(아래 AI 활용 안내)'],
        ],
      },
      after: ['옮기는 방법: 서비스를 쓸 때 암호화된 통신으로 보냅니다. 이전을 원하지 않으면 탈퇴할 수 있고, 그 경우 서비스를 쓸 수 없습니다.'],
    },
    {
      heading: '5. 보관 기간과 삭제',
      bullets: [
        '탈퇴하면 7일 동안 취소할 수 있고, 7일이 지나면 그 사람의 계정 정보와 그 사람이 올린 기록을 지웁니다.',
        '커플 연결을 해제하면 7일 동안 취소할 수 있고, 7일이 지나면 요청한 사람이 남긴 기록을 지웁니다. 상대가 남긴 기록은 상대에게 남습니다.',
        '이미 발행된 잡지는 두 사람이 함께 만든 결과물이라, 두 사람이 모두 떠날 때 지웁니다.',
        '내가 올린 사진·메모는 앱에서 언제든 지울 수 있습니다.',
        '법령이 보관을 정한 정보는 그 기간 동안만 따로 보관합니다.',
        '무료 이용자의 오래된 기록을 잠그는 보관 정책은 시험 운영 기간에는 적용하지 않습니다. 적용하기 전에 미리 알립니다.',
      ],
    },
    {
      heading: '6. 이용자의 권리',
      paragraphs: ['내 정보를 보거나, 고치거나, 지우거나, 처리를 멈추라고 요청할 수 있습니다. 앱의 설정에서 직접 하거나 {문의 이메일}로 요청하면 지체 없이 처리합니다.'],
    },
    {
      heading: '7. 만 14세 미만',
      paragraphs: ['만 14세 미만은 가입할 수 없습니다.'],
    },
    {
      heading: '8. 안전 조치',
      paragraphs: ['통신 암호화, 접근 권한 제한(두 사람만 자기 커플의 기록을 볼 수 있음), 관리자 키 분리 보관을 합니다.'],
    },
    {
      heading: '9. 개인정보 보호책임자',
      paragraphs: ['{운영자} · {문의 이메일}'],
    },
    {
      heading: '10. 바뀔 때',
      paragraphs: ['이 방침이 바뀌면 시행 7일 전에 앱에서 알립니다.'],
    },
  ],
}

const TERMS_TEMPLATE: LegalDocument = {
  key: 'terms',
  title: '온도록 이용약관',
  meta: META,
  sections: [
    { paragraphs: ['1. 서비스: 온도록은 연인 두 사람의 대화와 기록으로 매달 잡지를 만들어 주는 서비스입니다. 지금은 시험 운영 기간이며 요금을 받지 않습니다. 기능과 화면은 바뀌거나 멈출 수 있습니다.'] },
    { paragraphs: ['2. 가입: 만 14세 이상이 카카오 계정으로 가입할 수 있습니다. 한 사람은 한 번에 한 커플에만 연결됩니다.'] },
    { paragraphs: ['3. 내 기록의 권리: 이용자가 올린 대화·사진·메모의 권리는 올린 사람에게 있습니다. 이용자는 온도록이 두 사람의 잡지를 만들고 두 사람에게 보여 주는 데 필요한 범위에서만 이를 쓰는 것을 허락합니다. 온도록은 이를 광고나 다른 사람에게 보여 주는 데 쓰지 않습니다.'] },
    { paragraphs: ['4. 발행된 잡지: 발행된 잡지는 두 사람이 함께 만든 결과물입니다. 두 사람 모두 앱에서 보고 내려받을 수 있습니다. 한 사람이 떠나도 남은 사람은 볼 수 있고, 두 사람이 모두 떠나면 지웁니다.'] },
    { paragraphs: ['5. 하지 말아야 할 것: 다른 사람의 계정을 쓰는 일, 상대의 동의 없이 상대의 사진·대화를 다른 곳에 퍼뜨리는 일, 법을 어기는 내용을 올리는 일, 서비스를 망가뜨리려는 일. 이를 어기면 이용을 멈출 수 있습니다.'] },
    { paragraphs: ['6. 해제와 탈퇴: 언제든 커플 연결을 해제하거나 탈퇴할 수 있고, 7일 안에는 취소할 수 있습니다. 지워지는 범위는 개인정보 처리방침 5번을 따릅니다.'] },
    { paragraphs: ['7. AI가 만든 문장: 잡지의 문장 일부는 AI가 씁니다. 사실과 다른 문장이 있을 수 있으며, 발견하면 알려 주세요.'] },
    { paragraphs: ['8. 책임: 운영자의 고의나 중대한 잘못이 없는 한, 시험 운영 중 서비스 중단이나 기록 표시 오류로 생긴 손해에 대해서는 책임이 제한됩니다. 다만 이용자의 기록을 지키기 위해 최선을 다합니다.'] },
    { paragraphs: ['9. 약관이 바뀔 때: 시행 7일 전에 앱에서 알립니다.'] },
    { paragraphs: ['10. 문의: {문의 이메일}'] },
  ],
}

const AI_USAGE_TEMPLATE: LegalDocument = {
  key: 'aiUsage',
  title: 'AI 콘텐츠 생성을 위한 데이터 활용 안내',
  intro: ['온도록은 두 사람의 기록으로 잡지 문장을 쓰기 위해 외부 AI 서비스를 씁니다.'],
  sections: [
    {
      bullets: [
        '보내는 것: 대화, 메모, 데이트 장소 이름과 시각, 사진 장수 같은 글로 된 기록',
        '보내지 않는 것: 사진 자체, 사진 위치 정보, 카카오계정 이메일',
        '받는 곳: Anthropic PBC(미국)의 Claude API',
        '받는 곳의 보존: Anthropic은 API로 받은 입력과 출력을 받은 날부터 30일 안에 지웁니다. 다만 Anthropic의 이용 정책 위반으로 표시된 내용은 더 오래(최대 2년) 보관될 수 있습니다.',
        '학습: Anthropic은 API로 받은 내용을 기본적으로 AI 학습에 쓰지 않습니다. 온도록은 학습 참여 프로그램에 가입하지 않습니다.',
        '잡지에 실리는 것: AI가 쓴 문장은 두 사람의 잡지에만 실리고, 다른 사람에게 보여 주지 않습니다.',
        '이 활용에 동의하지 않으면 잡지를 만들 수 없어 서비스를 쓸 수 없습니다. 동의 뒤에도 탈퇴하면 이후로는 보내지 않습니다.',
      ],
    },
  ],
}

/** 마케팅 정보 수신 동의(선택 ⑤) 전문 - PM 최소판 v1.1 §5(R94-9) 문장 그대로. */
const MARKETING_TEMPLATE: LegalDocument = {
  key: 'marketing',
  title: '마케팅 정보 수신 동의(선택)',
  intro: ['온도록의 새 기능과 이벤트 소식을 앱 알림이나 카카오계정 이메일로 받습니다.'],
  sections: [
    {
      bullets: [
        '동의하지 않아도 온도록의 모든 기능을 쓸 수 있습니다.',
        '동의한 뒤에도 언제든 {문의 이메일}로 철회할 수 있고, 철회하면 그날부터 보내지 않습니다.',
        '이 동의로 모으는 새 정보는 없습니다(처리방침 1번의 "마케팅 정보 수신 동의 여부"만 기록합니다).',
      ],
    },
  ],
}

/** 네 문서(자리 채움 끝). 온보딩 [보기]와 설정이 같은 객체를 읽는다. */
export const LEGAL_DOCUMENTS: Record<LegalDocumentKey, LegalDocument> = {
  privacy: fillDocument(PRIVACY_TEMPLATE),
  terms: fillDocument(TERMS_TEMPLATE),
  aiUsage: fillDocument(AI_USAGE_TEMPLATE),
  marketing: fillDocument(MARKETING_TEMPLATE),
}

/** 동의 화면 AI 항목 아래 한 줄(기존 R38-2 문장을 대체). */
export const AI_USAGE_CONSENT_LINE =
  '두 사람의 대화·메모 같은 글 기록은 잡지 문장을 쓰기 위해 Anthropic의 Claude API(미국)로 보내지고, 30일 안에 지워져요. 사진 자체는 보내지 않아요.'

export function isLegalDocumentKey(k: string): k is LegalDocumentKey {
  return k === 'terms' || k === 'privacy' || k === 'aiUsage' || k === 'marketing'
}

/** 문서 전문을 한 덩어리 글로(시험 · 점검용). */
export function legalPlainText(doc: LegalDocument): string {
  const out: string[] = [doc.title]
  if (doc.meta) out.push(doc.meta)
  out.push(...(doc.intro ?? []))
  for (const s of doc.sections) {
    if (s.heading) out.push(s.heading)
    out.push(...(s.paragraphs ?? []), ...(s.bullets ?? []))
    if (s.table) {
      out.push(s.table.head.join(' | '))
      for (const r of s.table.rows) out.push(r.join(' | '))
    }
    out.push(...(s.after ?? []))
  }
  return out.join('\n')
}
