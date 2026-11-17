/**
 * 스모크 전용 만든 데이터(79- ③). 이름 · 별칭 · 문장 · 그림은 모두 지어낸 값이다 - 실제 이름 · 이메일 · 사진 0.
 * 날짜는 "오늘(KST)"에서 거꾸로 센다 - D+ · 이번 달 하늘 · 매거진 %가 언제 돌려도 비지 않게.
 */
import type { Row } from './fakeClient'

export const ME = 'smoke-user-a'
export const YOU = 'smoke-user-b'
export const COUPLE = 'smoke-couple'
export const NAME_ME = '가온'
export const NAME_YOU = '나래'
export const NICKNAME = '솜사탕'

const DAY = 86_400_000
/** KST 기준 n일 전 날짜(YYYY-MM-DD). */
export function kstDay(daysAgo: number, now = Date.now()): string {
  return new Date(now + 9 * 3_600_000 - daysAgo * DAY).toISOString().slice(0, 10)
}
let micro = 0
/**
 * KST n일 전 그날 hh:mm을 **서버(PostgREST timestamptz)가 돌려주는 모양**으로: UTC · 소수 6자리 · `+00:00`(예: `2026-11-16T04:07:00.123457+00:00`).
 * WebKit `Date.parse`가 이 모양을 읽는지가 스모크의 볼거리 중 하나다(앱은 서버 문자열을 그대로 `Date.parse`한다).
 */
function kstAt(daysAgo: number, hh: number, mm = 0): string {
  const iso = new Date(`${kstDay(daysAgo)}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+09:00`).toISOString()
  micro = (micro + 123_457) % 1_000_000
  return `${iso.slice(0, 19)}.${String(micro).padStart(6, '0')}+00:00`
}

const MEMOS = ['비 온 뒤라 길이 반짝였다', '창가 자리가 비어 있었다', '다음엔 아침에 오자고 했다']
const PLACES = ['호숫가 산책로', '골목 끝 빵집', '언덕 위 전망대', '작은 서점', '강변 벤치']
const LINES = ['오늘 몇 시에 끝나?', '여섯 시쯤!', '그럼 역 앞에서 보자', '좋아 우산 챙겨', '사진 보낼게', '도착했어', '천천히 와', '저녁 뭐 먹을까', '국수 어때', '좋지']

export function makeSeed(withSession: boolean): { me: string | null; tables: Record<string, Row[]> } {
  if (!withSession) return { me: null, tables: {} }
  const profiles: Row[] = [
    { id: ME, display_name: NAME_ME, gender: 'female', birth_date: '1997-03-14', mbti: 'ENFP', onboarding_step: 3, marketing_agreed_at: null, deleted_at: null, purge_scheduled_at: null, biometric_consent_at: null, biometric_consent_revoked_at: null, reference_photo_path: null },
    { id: YOU, display_name: NAME_YOU, gender: 'male', birth_date: '1996-08-02', mbti: 'ISTJ', onboarding_step: 3, marketing_agreed_at: null, deleted_at: null, purge_scheduled_at: null },
  ]
  const couples: Row[] = [{
    id: COUPLE, user_a_id: ME, user_b_id: YOU, status: 'active', relationship_start_date: kstDay(210),
    start_date_set_by: ME, start_date_confirmed_by: YOU, nickname: NICKNAME, invite_code: 'QW7RT9', reference_photo_path: null, created_at: kstAt(215, 12),
  }]
  const personality_profiles: Row[] = [
    { user_id: ME, active_assessment_id: 'smoke-assess-a', enneagram_inferred: 7, enneagram_override: null, enneagram_effective: 7, override_count: 0, attachment: 'secure', retest_used: false, love_type_code: 'x' },
    { user_id: YOU, active_assessment_id: 'smoke-assess-b', enneagram_inferred: 1, enneagram_override: null, enneagram_effective: 1, override_count: 0, attachment: 'secure', retest_used: false, love_type_code: 'x' },
  ]
  const personality_assessments: Row[] = [
    { id: 'smoke-assess-a', user_id: ME, seq: 1, mbti: 'ENFP', q1: 'A', q2: 'B', q3: 'A', q4: 'B', q5: 'A', big_e: 70, big_o: 75, big_a: 65, big_c: 45, big_n: 40, stern_intimacy: 60, stern_passion: 65, stern_commitment: 55 },
  ]

  const dates: Row[] = []
  const date_stops: Row[] = []
  const data_entries: Row[] = []
  ;[2, 6, 11, 19, 33].forEach((ago, i) => {
    const id = `smoke-date-${i}`
    dates.push({ id, couple_id: COUPLE, date_on: kstDay(ago), title: null, deleted_at: null, hidden_at: null, created_at: kstAt(ago, 21) })
    for (let s = 0; s < 2; s++) {
      date_stops.push({ id: `${id}-stop-${s}`, date_id: id, couple_id: COUPLE, seq: s + 1, arrived_at: kstAt(ago, 13 + s * 3), place_name: PLACES[(i + s) % PLACES.length], deleted_at: null })
    }
    for (let p = 0; p < 3; p++) {
      data_entries.push({ id: `${id}-photo-${p}`, couple_id: COUPLE, date_id: id, date_stop_id: `${id}-stop-${p % 2}`, author_id: p % 2 ? YOU : ME, entry_type: 'photo', storage_path: `${COUPLE}/${id}/p${p}.jpg`, thumb_path: null, drawing_path: null, text_content: null, captured_at: kstAt(ago, 13 + p), created_at: kstAt(ago, 21), access_locked: false, deleted_at: null })
    }
    data_entries.push({ id: `${id}-memo`, couple_id: COUPLE, date_id: id, date_stop_id: null, author_id: ME, entry_type: 'memo', storage_path: null, text_content: MEMOS[i % MEMOS.length], captured_at: kstAt(ago, 20), created_at: kstAt(ago, 21), access_locked: false, deleted_at: null })
  })

  const messages: Row[] = []
  for (let i = 0; i < 40; i++) {
    const ago = Math.floor((40 - i) / 8)
    const sender = i % 3 === 0 ? YOU : ME
    const photo = i % 13 === 5
    messages.push({
      id: `smoke-msg-${i}`, couple_id: COUPLE, sender_id: sender, body: photo ? null : LINES[i % LINES.length], media_path: photo ? `${COUPLE}/chat/m${i}.jpg` : null,
      message_type: photo ? 'photo' : 'text', sent_at: kstAt(ago, 9 + (i % 12), (i * 7) % 60), created_at: kstAt(ago, 9 + (i % 12), (i * 7) % 60), read_at: kstAt(0, 22), client_msg_id: `smoke-cm-${i}`, deleted_at: null,
    })
  }

  const daily_temperature: Row[] = []
  for (let ago = 1; ago <= 30; ago++) daily_temperature.push({ couple_id: COUPLE, date_on: kstDay(ago), temperature: 36.5 + ((ago * 37) % 20) / 10 })

  const lastMonthStart = (() => { const d = new Date(Date.now() + 9 * 3_600_000); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 10) })()
  const lastMonthEnd = (() => { const d = new Date(`${lastMonthStart}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return d.toISOString().slice(0, 10) })()
  const issues_public: Row[] = [{
    id: 'smoke-issue-1', couple_id: COUPLE, issue_type: 'monthly', issue_number: 1, title: null, cover_path: `${COUPLE}/smoke-issue-1/render/page-01.jpg`,
    period_start: lastMonthStart, period_end: lastMonthEnd, pdf_digital_path: `${COUPLE}/smoke-issue-1/render/issue.pdf`, page_count: 6,
    published_at: `${kstDay(new Date().getUTCDate())}T00:00:00Z`, theme: 'basic',
  }]

  return {
    me: ME,
    tables: {
      profiles, couples, personality_profiles, personality_assessments, dates, date_stops, data_entries, messages, daily_temperature, issues_public,
      stories: [], corners: [], couple_dissolutions: [], push_tokens: [],
      notification_settings: [{ user_id: ME, messages: true, changes: true }],
    },
  }
}

/** `fn_issue_progress` - 이번 달 초안 하나(메인 매거진 % 칸이 보이게). 칸 이름은 `IssueProgressRow`. */
export function issueProgressRows(now = Date.now()): Row[] {
  const d = new Date(now + 9 * 3_600_000)
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10)
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
  return ['cover', 'chat_highlight', 'date_story'].map((corner_type, i) => ({
    issue_id: 'smoke-issue-2', issue_type: 'monthly', period_start: start, period_end: end, corner_type, status: i === 0 ? 'done' : 'pending', skip_reason: null,
  }))
}
