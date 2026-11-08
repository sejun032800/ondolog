/** 가짜 대화. 결정론(같은 개수 -> 같은 목록). 원격 호출 없음. */
export interface FakeMessage {
  id: number
  mine: boolean
  text: string
  time: string
}

const SAMPLES = [
  '오늘 뭐 먹을까?',
  '퇴근하고 만나서 저녁 같이 먹자. 요즘 새로 생긴 국숫집이 있던데 거기 가볼래?',
  '응',
  '좋아!',
  '조금 늦을 것 같아. 십 분만 기다려줄 수 있어?',
  '천천히 와. 나도 방금 도착했어.',
  '주말에 비 온대. 우산 챙기자.',
  '그날 찍은 사진 보내줄게',
  '고마워 ㅎㅎ',
  '내일은 일찍 일어나서 산책이라도 할까. 날씨가 풀려서 아침 공기가 좋을 것 같아.',
]

export function makeFakeMessages(count: number): FakeMessage[] {
  return Array.from({ length: count }, (_, i) => {
    const minutes = (i * 3) % 60
    const hour = (9 + Math.floor((i * 3) / 60)) % 24
    return {
      id: i + 1,
      mine: (i * 7 + Math.floor(i / 3)) % 3 !== 0,
      text: `${i + 1}. ${SAMPLES[(i * 5 + Math.floor(i / 4)) % SAMPLES.length]}`,
      time: `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    }
  })
}
