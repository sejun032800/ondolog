/**
 * 84-c 내용 검사(순수) - 칸별 말투 · 숫자/시각 · 요일 (ROADMAP r133 R133-4 · R133-5).
 * 위임: .claude/state/prompts/phase-7/84-c-dispatch-auto-checks.md
 * 예문은 시험용 짧은 문장이다(생성 문장 아님).
 */
import {
  classifyEnding,
  createNumberFacts,
  kstParts,
  numberViolations,
  retryHintText,
  runContentChecks,
  stripQuoted,
  toneViolations,
  weekdayOf,
  weekdayViolations,
  type NumberFacts,
} from '../../../src/engine/corners/contentChecks'

function facts(build: (f: ReturnType<typeof createNumberFacts>) => void): NumberFacts {
  const f = createNumberFacts()
  build(f)
  return f.build()
}

describe('84-c ① 칸별 말투 - 글 칸(합니다체)', () => {
  it.each([
    ['9월 13일에는 성수에 다녀왔습니다.'],
    ['두 날 모두 기록이 남아 있습니다. 사진도 있습니다.'],
    ['좋았습니다만, 비가 왔습니다.'], // "~습니다만,"은 문장 끝이 아니다
    ["'고마워'라는 말이 오갔습니다."], // 문장 중간 인용
    ['케이크를 먹었습니다 🍰'], // 이모지로 끝남
    ['기록이 남았습니다(사진 3장).'], // 끝의 괄호 덧말
    ['"오늘 진짜 좋았다"'], // 통째로 인용 - 검사 대상 아님
  ])('통과: %s', (text) => {
    expect(toneViolations(text, 'text')).toEqual([])
  })

  it.each([
    ['성수에 다녀왔다.', 'da'],
    ['일정이 이어진다.', 'da'],
    ['성수에 다녀왔어요.', 'haeyo'],
    ['성수에 다녀왔어.', 'banmal'],
    ['성수 나들이.', 'noun'],
    ['처음 간 곳은 Layered.', 'noun'], // 영어로 끝나는 글 칸 문장은 합니다체가 아니다
  ])('실패: %s -> %s', (text, cls) => {
    expect(toneViolations(text, 'text')).toEqual([cls])
  })
})

describe('84-c ① 칸별 말투 - 라벨 칸(명사형 · 연결형 · 합니다체)', () => {
  it.each([
    ['양평역 앞 시장'],
    ['오후 4시'], // 숫자로 끝나는 라벨
    ['오후 4시, 양평역 앞 시장'],
    ['성수에서 보낸 날'],
    ['롯데월드를 방문한 구간이 있어서.'], // 연결형
    ['성수에서 하루를 보내서.'],
    ['Cafe Layered'], // 영어로 끝남
    ['속초 바다'], // "~다"로 끝나는 명사
    ['점심시간에 오간 대화'],
    ['양평역 앞 시장으로 이어짐'],
    ['기록이 남아 있습니다.'], // 합니다체도 허용
  ])('통과: %s', (text) => {
    expect(toneViolations(text, 'label')).toEqual([])
  })

  it.each([
    ['오전에 공원을 걸었다', 'da'],
    ['두물머리에서 시작했다.', 'da'],
    ['이어진 하루였다', 'da'],
    ['같이 걸었어', 'banmal'],
    ['다음엔 어디 갈까?', 'banmal'],
    ['시장에서 마무리했어요.', 'haeyo'],
  ])('실패: %s -> %s', (text, cls) => {
    expect(toneViolations(text, 'label')).toEqual([cls])
  })
})

describe('84-c ① 칸별 말투 - 질문 칸(해요체)', () => {
  it.each([
    ['다음에 롯데월드 갈 때 교복 데이트 해볼까요?'],
    ['다음에 롯데월드 갈 때 교복 데이트 해볼까요'], // 물음표 없는 해요체
    ['가보고 싶은 곳이 있나요?'],
    ['가장 기억에 남는 건 무엇인가요?'],
    ['다음엔 조금 일찍 가봐요.'],
  ])('통과: %s', (text) => {
    expect(toneViolations(text, 'question')).toEqual([])
  })

  it.each([
    ['다음에 강릉 가면 시장에 들러볼까?', 'banmal'],
    ['교복 데이트 해볼 의향은?', 'banmal'],
    ['꼭 해보고 싶은 것 하나를 꼽는다면?', 'banmal'],
    ['다음에도 가보시겠습니까?', 'hapnida'],
    ['다음에도 가본다.', 'da'],
  ])('실패: %s -> %s', (text, cls) => {
    expect(toneViolations(text, 'question')).toEqual([cls])
  })
})

describe('84-c 문장 끝 분류 · 인용', () => {
  it('인용은 지운다 - 큰따옴표 · 작은따옴표 · 꺾쇠', () => {
    expect(stripQuoted('그날 "가자"와 \'좋아\', 「응」이 오갔습니다.').includes('가자')).toBe(false)
  })
  it('빈 문장(부호뿐)은 empty', () => {
    expect(classifyEnding('...')).toBe('empty')
  })
})

describe('84-c ② 숫자 · 시각 - 입력값 그대로 · 오전/오후 형식', () => {
  const f = facts((b) => {
    b.addClock('13:10')
    b.addClock('11:00')
    b.addClock('12:00')
    b.addDate('2025-09-13')
    b.addPhotoCount(2)
  })

  it('13:10 -> "오후 1시"는 반올림이라 실패', () => {
    expect(numberViolations('카페에서 나와 오후 1시 서울숲', f)).toEqual(['입력에 없는 시각 「오후 1시」(13:00)'])
  })
  it('"오후 1시 10분"은 통과', () => {
    expect(numberViolations('오후 1시 10분 서울숲', f)).toEqual([])
  })
  it('"13시 10분" · "13:10"은 24시 표기라 실패', () => {
    expect(numberViolations('13시 10분 서울숲', f)).toEqual(['시각 24시 표기 「13시 10분」'])
    expect(numberViolations('13:10 서울숲', f)).toEqual(['시각 숫자 표기 「13:10」(오전/오후 h시 m분으로)'])
  })
  it('정각은 "오전 11시" · 정오 · 오후 12시는 같은 값', () => {
    expect(numberViolations('오전 11시 카페', f)).toEqual([])
    expect(numberViolations('정오 무렵', f)).toEqual([])
    expect(numberViolations('오후 12시', f)).toEqual([])
  })
  it('자정 - 입력에 00:00이 있을 때만', () => {
    expect(numberViolations('자정에 오간 대화', f)).toEqual(['입력에 없는 시각 「자정」'])
    const g = facts((b) => b.addClock('00:00'))
    expect(numberViolations('자정에 오간 대화', g)).toEqual([])
    expect(numberViolations('오전 12시', g)).toEqual([])
  })
  it('오전/오후 없는 시각 · "반"은 형식 위반', () => {
    expect(numberViolations('7시에 만났습니다.', f)).toEqual(['시각 형식 「7시」(오전/오후 없음)'])
    expect(numberViolations('낮 12시 30분 사진', f)).toEqual(['시각 형식 「낮 12시 30분」(오전/오후 없음)'])
    expect(numberViolations('오후 12시 반', f)[0]).toContain('"반" 대신 30분')
  })
  it('입력에 없는 날짜 · 달은 실패', () => {
    expect(numberViolations('9월 13일에는', f)).toEqual([])
    expect(numberViolations('13일에는', f)).toEqual([])
    expect(numberViolations('9월 14일에는', f)).toEqual(['입력에 없는 날짜 「9월 14일」'])
    expect(numberViolations('14일에는', f)).toEqual(['입력에 없는 날짜 「14일」'])
    expect(numberViolations('10월에는', f)).toEqual(['입력에 없는 달 「10월」'])
  })
  it('사진 장수 - 아라비아 숫자와 한글 수사(1~10)', () => {
    expect(numberViolations('사진 두 장이 남았습니다.', f)).toEqual([])
    expect(numberViolations('사진 2장', f)).toEqual([])
    expect(numberViolations('사진도 세 장 남았습니다.', f)).toEqual(['입력에 없는 사진 장수 「세장」'])
    expect(numberViolations('이달의 한 장면', f)).toEqual([]) // "장면"은 장수가 아니다
  })
  it('검사하지 않는 범위 - 상대 기간 · 한글 수사(사진 장수 밖)', () => {
    expect(numberViolations('1년 전 오늘 합정 공원 방문', f)).toEqual([])
    expect(numberViolations('엿새 전 대화에서 세 번 이야기가 오갔습니다.', f)).toEqual([])
  })
  it('그 밖의 숫자는 입력에 나온 숫자만', () => {
    expect(numberViolations('5번째 방문', f)).toEqual(['입력에 없는 숫자 「5」'])
  })
  it('인용 안의 숫자 · 시각은 보지 않는다', () => {
    expect(numberViolations('"7시에 거기서 보자"라는 말이 남았습니다.', f)).toEqual([])
  })
  it('원문(메시지)의 시각은 오전 · 오후 두 쪽 다 입력값', () => {
    const g = facts((b) => b.addText('좋아 7시에 거기서 보자'))
    expect(numberViolations('오후 7시에 만났습니다.', g)).toEqual([])
    expect(numberViolations('오전 7시에 만났습니다.', g)).toEqual([])
  })
})

describe('84-c ③ 요일 - 날짜의 실제 요일과 맞는가', () => {
  // 2025-09-13 = 토요일, 2026-09-13 = 일요일
  const known = ['2025-09-13', '2025-09-05', '2025-09-28']

  it('weekdayOf', () => {
    expect(weekdayOf('2025-09-13')).toBe('토요일')
    expect(weekdayOf('2026-09-13')).toBe('일요일')
    expect(weekdayOf('2024-02-29')).toBe('목요일')
    expect(weekdayOf('1970-01-01')).toBe('목요일')
  })
  it('kstParts - UTC 시각도 KST 날짜 · 분으로(자정 넘김 포함)', () => {
    expect(kstParts('2025-09-12T23:30:00+09:00')).toEqual({ date: '2025-09-12', minute: 1410 })
    expect(kstParts('2025-09-12T15:30:00Z')).toEqual({ date: '2025-09-13', minute: 30 })
    expect(kstParts('2024-12-31T15:00:00Z')).toEqual({ date: '2025-01-01', minute: 0 })
    expect(kstParts('없음')).toBeNull()
  })
  it('같은 문장의 날짜와 맞으면 통과 · 틀리면 실패', () => {
    expect(weekdayViolations('9월 13일 토요일에 성수에 다녀왔습니다.', [], known)).toEqual([])
    expect(weekdayViolations('9월 13일 일요일에 성수에 다녀왔습니다.', [], known)).toEqual(['요일 「일요일」≠ 2025-09-13(토요일)'])
    expect(weekdayViolations('5일 금요일 저녁', [], known)).toEqual([])
  })
  it('문장에 날짜가 없으면 근거 날짜(하나일 때)', () => {
    expect(weekdayViolations('토요일 오후의 산책', ['2025-09-13'], known)).toEqual([])
    expect(weekdayViolations('일요일 낮에 오간 대화', ['2025-09-28', '2025-09-28'], known)).toEqual([])
    expect(weekdayViolations('평일 점심시간에 오간 대화', ['2025-09-13'], known)).toEqual(['요일 「평일」≠ 2025-09-13(토요일)'])
    expect(weekdayViolations('주말 저녁', ['2025-09-13'], known)).toEqual([])
  })
  it('날짜를 하나로 정할 수 없는 요일 낱말은 실패', () => {
    expect(weekdayViolations('금요일 저녁에 식사했습니다.', [], known)).toEqual(['요일 「금요일」의 날짜를 정할 수 없음'])
    expect(weekdayViolations('평일 사이의 한 끼', ['2025-09-05', '2025-09-13'], known)).toEqual(['요일 「평일」의 날짜를 정할 수 없음'])
  })
  it('메시지 인용 안의 요일은 검사 제외', () => {
    expect(weekdayViolations("9월 7일 대화에 '다음 주 토요일'이라는 말이 남았습니다.", [], known)).toEqual([])
  })
})

describe('84-c 칸 묶음 · 재요청 안내', () => {
  it('위반은 칸 · 규칙만(문장 0)', () => {
    const f = facts((b) => b.addClock('13:10'))
    const out = runContentChecks([
      { field: 'articles[0].body', tone: 'text', text: '서울숲에 다녀왔다. 오후 1시에 도착했다.', facts: f, contextDates: [], knownDates: [] },
    ])
    expect(out).toEqual([
      'articles[0].body: 말투 ~다체 (글 칸 허용: 합니다체)',
      'articles[0].body: 입력에 없는 시각 「오후 1시」(13:00)',
    ])
    const hint = retryHintText(out)
    expect(hint).toContain('- articles[0].body: 말투 ~다체')
    expect(hint).not.toContain('서울숲에 다녀왔다')
  })
})
