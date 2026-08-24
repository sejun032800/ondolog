/**
 * 온보딩 화면 4 — 연애 유형 5문항 (16 MBTI 유형 × 5문항 = 80문항).
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 10-3 (16유형별 문항, 원문 그대로).
 * 요약·의역 없이 옮겼다. 문항 내용을 임의로 수정하지 말 것(CLAUDE.md, 지시사항).
 *
 * 시나리오·표현은 유형별로 다르지만, 각 문항이 측정하는 구인과 선택지
 * A/B/C가 가리키는 값은 16유형 전부 동일하다 (Part 10-1-3 선택지 의미
 * 규격). 채점(src/engine/loveTypeInference.ts)은 이 고정된 A/B/C 값만
 * 사용하며, 이 파일의 prompt/text는 오직 UI 렌더링용이다.
 *
 * Q# → 측정 구인 (Part 10-1-2):
 *   Q1: 호나이 삼분법 (욕구 충족 전략)
 *   Q2: 하모닉 삼분법 (좌절 대처)
 *   Q3: 신경성(빅5 N) = 애착 불안 축
 *   Q4: 스턴버그 우세 성분
 *   Q5: 애착 회피 축
 */

import type { MbtiType, QuizChoice } from '../constants/quizTypes'

export interface OnboardingQuestionOption {
  choice: QuizChoice
  text: string
}

export interface OnboardingQuestion {
  q: 1 | 2 | 3 | 4 | 5
  prompt: string
  options: readonly [
    OnboardingQuestionOption,
    OnboardingQuestionOption,
    OnboardingQuestionOption,
  ]
}

export type OnboardingQuestionSet = readonly [
  OnboardingQuestion,
  OnboardingQuestion,
  OnboardingQuestion,
  OnboardingQuestion,
  OnboardingQuestion,
]

export const ONBOARDING_QUESTIONS: Readonly<
  Record<MbtiType, OnboardingQuestionSet>
> = {
  INTJ: [
    {
      q: 1,
      prompt: '오래 눈여겨본 사람이 있다. 관계를 진전시켜야 할 때, 당신은?',
      options: [
        { choice: 'A', text: '판을 짠다. 언제 어떻게 움직일지 정하고 실행한다' },
        {
          choice: 'B',
          text: '신뢰부터 쌓는다. 내가 어떤 사람인지 충분히 보여준 다음이 순서다',
        },
        { choice: 'C', text: '일단 관찰한다. 확신이 설 때까지는 굳이 나서지 않는다' },
      ],
    },
    {
      q: 2,
      prompt: '공들인 계획이 상대의 변덕 하나로 틀어졌다.',
      options: [
        { choice: 'A', text: '감정은 나중. 대안부터 다시 짠다' },
        { choice: 'B', text: '어차피 완벽한 계획은 없다고 생각하고 넘긴다' },
        { choice: 'C', text: '왜 그랬는지 납득될 때까지 짚고 넘어간다' },
      ],
    },
    {
      q: 3,
      prompt: '답장이 평소보다 반나절 늦었다.',
      options: [
        { choice: 'A', text: '바쁜가 보다 하고 신경 안 쓴다' },
        { choice: 'B', text: '잠깐 신경 쓰이지만 다른 일 하면 잊는다' },
        {
          choice: 'C',
          text: '이유를 계속 추론하게 되고, 최악의 시나리오까지 가본다',
        },
      ],
    },
    {
      q: 4,
      prompt: '이 관계가 진짜라고 느껴지는 순간은?',
      options: [
        { choice: 'A', text: '말 안 해도 상대가 내 사고 흐름을 따라올 때' },
        { choice: 'B', text: '그 사람 생각만으로 하루가 달라질 때' },
        { choice: 'C', text: '5년 뒤에도 이 사람일 거라는 계산이 설 때' },
      ],
    },
    {
      q: 5,
      prompt: '관계가 깊어질수록 당신은?',
      options: [
        { choice: 'A', text: '내 세계 안으로 더 들이고 싶어진다' },
        { choice: 'B', text: '가까움과 내 시간의 균형점을 찾으려 한다' },
        { choice: 'C', text: '혼자 생각할 시간이 더 절실해진다' },
      ],
    },
  ],
  INTP: [
    {
      q: 1,
      prompt: '마음에 드는 사람이 생겼다. 어떻게 하는 편인가?',
      options: [
        { choice: 'A', text: '흥미로운 화제를 던져서 상대가 반응하게 만든다' },
        { choice: 'B', text: '상대가 필요로 할 때 도움이 되는 사람이 된다' },
        {
          choice: 'C',
          text: '머릿속으로 수십 번 시뮬레이션을 돌리고, 실제로는 잘 안 움직인다',
        },
      ],
    },
    {
      q: 2,
      prompt: '상대가 내 논리를 이해 못 하고 서운해한다.',
      options: [
        { choice: 'A', text: '어디서 어긋났는지 분해해서 설명한다' },
        { choice: 'B', text: '뭐 그럴 수도 있지, 하고 화제를 돌린다' },
        { choice: 'C', text: '이해받지 못한 게 답답해서 그 감정을 드러낸다' },
      ],
    },
    {
      q: 3,
      prompt: '상대가 애매한 말 한마디를 남기고 대화가 끊겼다.',
      options: [
        { choice: 'A', text: '별 뜻 없겠거니 하고 넘어간다' },
        { choice: 'B', text: '조금 걸리지만 다른 데 몰두하면 사라진다' },
        { choice: 'C', text: '그 문장 하나를 며칠씩 해석하고 있다' },
      ],
    },
    {
      q: 4,
      prompt: '이 사람이 특별하다고 느끼는 지점은?',
      options: [
        { choice: 'A', text: '아무 필터 없이 생각을 던져도 되는 유일한 상대라는 것' },
        { choice: 'B', text: '이 사람 앞에서만 이상하게 심장이 반응한다는 것' },
        { choice: 'C', text: '흐지부지되지 않을 거라는 드문 확신이 든다는 것' },
      ],
    },
    {
      q: 5,
      prompt: '상대가 매일 붙어 있고 싶어 한다면?',
      options: [
        { choice: 'A', text: '좋다. 나도 그 정도는 원한다' },
        { choice: 'B', text: '며칠은 좋고 며칠은 혼자, 그 리듬이면 괜찮다' },
        { choice: 'C', text: '숨 쉴 틈이 필요해진다' },
      ],
    },
  ],
  ENTJ: [
    {
      q: 1,
      prompt: '관계에서 원하는 걸 얻어내야 할 때 당신의 방식은?',
      options: [
        { choice: 'A', text: '직접 말한다. 원하는 걸 명확히 요구하는 게 가장 빠르다' },
        { choice: 'B', text: '내가 먼저 책임을 다한다. 그러면 받을 자격이 생긴다' },
        { choice: 'C', text: '조건이 갖춰질 때까지 기다린다. 무리하게 밀지 않는다' },
      ],
    },
    {
      q: 2,
      prompt: '상대가 내 방식을 통제라고 느낀다며 반발했다.',
      options: [
        { choice: 'A', text: '효율과 통제는 다르다는 걸 근거로 설명한다' },
        { choice: 'B', text: '좋은 의도였으니 시간이 지나면 알아줄 거라 본다' },
        { choice: 'C', text: '그렇게 받아들인 게 서운해서 감정을 드러낸다' },
      ],
    },
    {
      q: 3,
      prompt: '관계가 예상대로 흘러가지 않고 있다.',
      options: [
        { choice: 'A', text: '변수는 늘 있는 거라 크게 동요하지 않는다' },
        { choice: 'B', text: '잠깐 스트레스받지만 곧 다음 수를 찾는다' },
        { choice: 'C', text: '통제가 안 된다는 사실 자체가 계속 신경 쓰인다' },
      ],
    },
    {
      q: 4,
      prompt: '"우리 잘되고 있다"고 느낄 때는?',
      options: [
        { choice: 'A', text: '서로의 진짜 생각을 숨기지 않고 꺼내놓을 때' },
        { choice: 'B', text: '아직도 이 사람이 눈에 띄게 좋을 때' },
        { choice: 'C', text: '함께 세운 계획이 실제로 굴러갈 때' },
      ],
    },
    {
      q: 5,
      prompt: '관계가 가까워질수록 나는?',
      options: [
        { choice: 'A', text: '삶의 영역을 더 많이 공유하려 한다' },
        { choice: 'B', text: '함께하는 시간과 내 영역을 분명히 나눈다' },
        { choice: 'C', text: '내 페이스를 지킬 공간을 확보하려 한다' },
      ],
    },
  ],
  ENTP: [
    {
      q: 1,
      prompt: '썸 단계에서 판을 움직이는 당신의 방식은?',
      options: [
        { choice: 'A', text: '계속 새로운 자극을 던져서 관계를 굴러가게 만든다' },
        { choice: 'B', text: '상대가 원하는 걸 캐치해서 맞춰준다' },
        { choice: 'C', text: '반응을 보면서 발을 얼마나 담글지 재본다' },
      ],
    },
    {
      q: 2,
      prompt: '상대가 "너는 진지하지 않은 것 같아"라고 말했다.',
      options: [
        { choice: 'A', text: '진지함의 정의부터 다시 정리해서 반박한다' },
        { choice: 'B', text: '웃기게 받아치고 분위기를 바꾼다' },
        { choice: 'C', text: '그렇게 보였다는 게 억울해서 바로 감정을 드러낸다' },
      ],
    },
    {
      q: 3,
      prompt: '상대와 사소하게 부딪혔다. 그날 밤 당신은?',
      options: [
        { choice: 'A', text: '이미 잊었다. 내일은 내일의 대화가 있다' },
        { choice: 'B', text: '잠깐 걸리지만 자고 나면 리셋된다' },
        { choice: 'C', text: '대화를 되감기하며 계속 재생한다' },
      ],
    },
    {
      q: 4,
      prompt: '이 관계가 좋은 이유를 하나만 고르면?',
      options: [
        { choice: 'A', text: '무슨 얘기를 해도 받아주는 사람이라서' },
        { choice: 'B', text: '아직도 예측이 안 되고 재미있어서' },
        { choice: 'C', text: '이 사람이면 오래 갈 것 같아서' },
      ],
    },
    {
      q: 5,
      prompt: '상대가 관계를 더 밀착시키려 한다면?',
      options: [
        { choice: 'A', text: '환영이다. 더 깊게 얽히는 게 좋다' },
        { choice: 'B', text: '적당한 선에서 조절하려 한다' },
        { choice: 'C', text: '답답해지고 여지가 필요해진다' },
      ],
    },
  ],
  INFJ: [
    {
      q: 1,
      prompt: '마음에 둔 사람과 가까워지고 싶을 때 당신은?',
      options: [
        { choice: 'A', text: '결정적인 순간을 만들어서 내 쪽에서 선을 넘는다' },
        { choice: 'B', text: '상대에게 필요한 사람이 되어 자연스럽게 자리를 잡는다' },
        { choice: 'C', text: '마음속에서만 몇 달째 관계를 진전시키고 있다' },
      ],
    },
    {
      q: 2,
      prompt: '상대가 내 진심을 오해했다.',
      options: [
        { choice: 'A', text: '오해의 구조를 차분히 짚어서 바로잡는다' },
        { choice: 'B', text: '결국엔 알아줄 거라 믿고 기다린다' },
        { choice: 'C', text: '오해받았다는 사실 자체가 아파서 그대로 드러난다' },
      ],
    },
    {
      q: 3,
      prompt: '상대의 말투가 평소와 조금 달랐다.',
      options: [
        { choice: 'A', text: '컨디션 문제겠거니 하고 넘긴다' },
        { choice: 'B', text: '신경은 쓰이지만 확인하면 풀린다' },
        { choice: 'C', text: '어떤 의미인지 계속 되짚고, 내 탓인가 싶어진다' },
      ],
    },
    {
      q: 4,
      prompt: '이 사람과의 관계에서 가장 중요한 건?',
      options: [
        { choice: 'A', text: '서로의 가장 깊은 부분까지 닿아 있다는 감각' },
        { choice: 'B', text: '이 사람에게만 반응하는 강렬한 끌림' },
        { choice: 'C', text: '무슨 일이 있어도 떠나지 않을 거라는 약속' },
      ],
    },
    {
      q: 5,
      prompt: '상대가 매일 연락하고 매일 보고 싶어 한다면?',
      options: [
        { choice: 'A', text: '나도 그만큼 원한다' },
        { choice: 'B', text: '좋지만 혼자 충전할 시간은 지키고 싶다' },
        { choice: 'C', text: '벅차서 조금 물러나게 된다' },
      ],
    },
  ],
  INFP: [
    {
      q: 1,
      prompt: '좋아하는 감정이 생겼을 때 당신은?',
      options: [
        { choice: 'A', text: '티를 내고 먼저 다가간다. 흘려보내면 후회한다' },
        { choice: 'B', text: '상대를 세심하게 챙기며 마음을 전한다' },
        { choice: 'C', text: '혼자 오래 간직한다. 표현은 한참 뒤에나' },
      ],
    },
    {
      q: 2,
      prompt: '상대가 내 감정을 대수롭지 않게 넘겼다.',
      options: [
        { choice: 'A', text: '왜 그게 중요한지 조목조목 말한다' },
        { choice: 'B', text: '그럴 수도 있다고 스스로를 달랜다' },
        { choice: 'C', text: '서운함이 그대로 얼굴과 말에 드러난다' },
      ],
    },
    {
      q: 3,
      prompt: '상대가 며칠째 조금 무심하다.',
      options: [
        { choice: 'A', text: '각자 사정이 있으니 신경 안 쓴다' },
        { choice: 'B', text: '마음이 가라앉지만 대화하면 풀린다' },
        { choice: 'C', text: '내가 부담이었나 싶어서 계속 되뇐다' },
      ],
    },
    {
      q: 4,
      prompt: '사랑한다고 느끼는 순간은?',
      options: [
        { choice: 'A', text: '꾸미지 않은 나를 그대로 봐줄 때' },
        { choice: 'B', text: '이 사람 앞에서 감정이 크게 흔들릴 때' },
        { choice: 'C', text: '오래 함께할 거라는 말이 진심으로 들릴 때' },
      ],
    },
    {
      q: 5,
      prompt: '관계가 아주 가까워졌을 때 당신은?',
      options: [
        { choice: 'A', text: '더 붙어 있고 싶어진다' },
        { choice: 'B', text: '가까움과 혼자만의 세계를 오간다' },
        { choice: 'C', text: '나만의 공간이 없어지는 게 두려워진다' },
      ],
    },
  ],
  ENFJ: [
    {
      q: 1,
      prompt: '관계를 원하는 방향으로 이끌 때 당신의 방식은?',
      options: [
        { choice: 'A', text: '내가 주도해서 분위기와 흐름을 만든다' },
        { choice: 'B', text: '상대를 챙기고 맞춰주면서 신뢰를 쌓는다' },
        { choice: 'C', text: '상대의 속도에 맞춰 한 발 물러나 있는다' },
      ],
    },
    {
      q: 2,
      prompt: '그렇게 챙겼는데 상대가 몰라준다.',
      options: [
        { choice: 'A', text: '무엇이 문제였는지 짚어서 다시 설계한다' },
        { choice: 'B', text: '언젠간 알아줄 거라 생각하고 계속한다' },
        { choice: 'C', text: '서운함을 숨기지 못하고 표현한다' },
      ],
    },
    {
      q: 3,
      prompt: '상대가 요즘 나에게 시큰둥한 것 같다.',
      options: [
        { choice: 'A', text: '오르내림은 당연하다고 보고 넘어간다' },
        { choice: 'B', text: '신경 쓰이지만 대화로 확인하면 괜찮아진다' },
        { choice: 'C', text: '내가 뭘 잘못했는지 밤새 되짚는다' },
      ],
    },
    {
      q: 4,
      prompt: '이 관계에서 가장 놓치고 싶지 않은 건?',
      options: [
        { choice: 'A', text: '서로를 진심으로 이해하고 있다는 감각' },
        { choice: 'B', text: '여전히 설레는 마음' },
        { choice: 'C', text: '함께 그리는 미래가 있다는 것' },
      ],
    },
    {
      q: 5,
      prompt: '상대가 개인 시간을 더 원한다고 말한다면?',
      options: [
        { choice: 'A', text: '서운하다. 나는 더 함께이고 싶다' },
        { choice: 'B', text: '이해한다. 각자 시간도 필요하다' },
        { choice: 'C', text: '오히려 편하다. 나도 숨 돌릴 틈이 필요했다' },
      ],
    },
  ],
  ENFP: [
    {
      q: 1,
      prompt: '마음이 가는 사람이 생기면 당신은?',
      options: [
        { choice: 'A', text: '바로 표현하고 판을 벌인다. 망설이는 성격이 아니다' },
        { choice: 'B', text: '상대가 좋아할 만한 걸 챙기며 다가간다' },
        { choice: 'C', text: '혼자 상상 속에서 이미 몇 번의 연애를 끝냈다' },
      ],
    },
    {
      q: 2,
      prompt: '신나서 얘기했는데 상대의 반응이 미지근하다.',
      options: [
        { choice: 'A', text: '왜 안 통했는지 분석하고 다르게 설명해본다' },
        { choice: 'B', text: '다음엔 통하겠지 하고 금방 털어낸다' },
        { choice: 'C', text: '김이 새는 게 그대로 드러난다' },
      ],
    },
    {
      q: 3,
      prompt: '상대가 갑자기 연락이 뜸해졌다.',
      options: [
        { choice: 'A', text: '바쁜가 보다 하고 내 일에 몰두한다' },
        { choice: 'B', text: '신경 쓰이지만 다른 재미를 찾으면 잊는다' },
        { choice: 'C', text: '식은 건가 싶어서 하루 종일 그 생각뿐이다' },
      ],
    },
    {
      q: 4,
      prompt: '연애에서 가장 중요한 건?',
      options: [
        { choice: 'A', text: '어떤 얘기든 다 꺼낼 수 있는 사이라는 것' },
        { choice: 'B', text: '심장이 뛰는 순간이 계속 있다는 것' },
        { choice: 'C', text: '이 사람과 계속 갈 거라는 확신' },
      ],
    },
    {
      q: 5,
      prompt: '관계가 안정기에 접어들면 당신은?',
      options: [
        { choice: 'A', text: '더 깊이 들어가고 싶어진다' },
        { choice: 'B', text: '함께와 각자의 리듬을 맞춘다' },
        { choice: 'C', text: '답답해져서 혼자만의 자극을 찾게 된다' },
      ],
    },
  ],
  ISTJ: [
    {
      q: 1,
      prompt: '관계를 진전시켜야 할 때 당신의 방식은?',
      options: [
        { choice: 'A', text: '명확하게 의사를 밝히고 다음 단계로 넘어간다' },
        { choice: 'B', text: '약속을 지키고 성실함을 보여주며 신뢰를 쌓는다' },
        { choice: 'C', text: '확실해질 때까지 지켜본다. 섣불리 움직이지 않는다' },
      ],
    },
    {
      q: 2,
      prompt: '상대가 약속을 반복해서 어긴다.',
      options: [
        { choice: 'A', text: '왜 문제인지 짚고 규칙을 다시 정한다' },
        { choice: 'B', text: '사정이 있었겠거니 하고 넘어간다' },
        { choice: 'C', text: '쌓인 게 터져서 그대로 표현한다' },
      ],
    },
    {
      q: 3,
      prompt: '계획했던 일정이 상대 때문에 어그러졌다.',
      options: [
        { choice: 'A', text: '그럴 수도 있다고 보고 조정한다' },
        { choice: 'B', text: '짜증이 잠깐 나지만 정리하면 괜찮다' },
        { choice: 'C', text: '계속 신경 쓰이고 다음도 그럴까 걱정된다' },
      ],
    },
    {
      q: 4,
      prompt: '이 관계가 잘 굴러간다고 느낄 때는?',
      options: [
        { choice: 'A', text: '말없이도 서로를 아는 편안함이 있을 때' },
        { choice: 'B', text: '오래됐는데도 여전히 좋을 때' },
        { choice: 'C', text: '서로에 대한 약속이 지켜지고 있을 때' },
      ],
    },
    {
      q: 5,
      prompt: '상대가 더 가까워지길 원한다면?',
      options: [
        { choice: 'A', text: '나도 원한다. 더 가까워도 좋다' },
        { choice: 'B', text: '지금의 거리가 적당하다고 본다' },
        { choice: 'C', text: '내 루틴과 공간은 지켜졌으면 한다' },
      ],
    },
  ],
  ISFJ: [
    {
      q: 1,
      prompt: '좋아하는 마음이 생겼을 때 당신은?',
      options: [
        { choice: 'A', text: '확실하게 표현해서 관계를 진전시킨다' },
        { choice: 'B', text: '세심하게 챙기고 배려하며 자연스레 가까워진다' },
        { choice: 'C', text: '티 안 내고 마음속에 오래 담아둔다' },
      ],
    },
    {
      q: 2,
      prompt: '그만큼 챙겼는데 상대가 당연하게 여긴다.',
      options: [
        { choice: 'A', text: '무엇이 부족했는지 짚고 방식을 바꿔본다' },
        { choice: 'B', text: '원래 그런 사람이려니 하고 계속 챙긴다' },
        { choice: 'C', text: '서운함이 쌓여서 결국 드러난다' },
      ],
    },
    {
      q: 3,
      prompt: '상대의 표정이 평소와 달랐다.',
      options: [
        { choice: 'A', text: '별일 아니겠거니 하고 지나간다' },
        { choice: 'B', text: '걱정되지만 물어보면 해결된다' },
        { choice: 'C', text: '나 때문인가 싶어 계속 마음이 쓰인다' },
      ],
    },
    {
      q: 4,
      prompt: '연애에서 가장 소중한 건?',
      options: [
        { choice: 'A', text: '서로를 편하게 기댈 수 있는 사이라는 것' },
        { choice: 'B', text: '여전히 두근거리는 순간들' },
        { choice: 'C', text: '곁에 계속 있어줄 거라는 믿음' },
      ],
    },
    {
      q: 5,
      prompt: '관계가 아주 밀착되면 당신은?',
      options: [
        { choice: 'A', text: '그게 가장 편하고 좋다' },
        { choice: 'B', text: '적당한 거리도 필요하다고 느낀다' },
        { choice: 'C', text: '내 시간이 사라지는 게 부담스럽다' },
      ],
    },
  ],
  ESTJ: [
    {
      q: 1,
      prompt: '관계에서 원하는 바를 얻는 당신의 방식은?',
      options: [
        { choice: 'A', text: '직접적으로 요구한다. 돌려 말하는 건 비효율이다' },
        { choice: 'B', text: '내 몫을 확실히 해내고 정당하게 기대한다' },
        { choice: 'C', text: '상황을 보고 판단한다. 무리하게 밀지 않는다' },
      ],
    },
    {
      q: 2,
      prompt: '상대가 내 방식이 답답하다고 말했다.',
      options: [
        { choice: 'A', text: '왜 이 방식이 나은지 근거를 들어 설명한다' },
        { choice: 'B', text: '서로 다른 거니까, 하고 넘긴다' },
        { choice: 'C', text: '그 말이 서운해서 바로 반응한다' },
      ],
    },
    {
      q: 3,
      prompt: '관계가 내 예상과 다르게 흘러간다.',
      options: [
        { choice: 'A', text: '원래 사람 일은 그런 거라 크게 개의치 않는다' },
        { choice: 'B', text: '신경 쓰이지만 정리하면 괜찮아진다' },
        { choice: 'C', text: '계속 마음에 걸리고 자꾸 확인하게 된다' },
      ],
    },
    {
      q: 4,
      prompt: '"이 사람이다" 싶은 순간은?',
      options: [
        { choice: 'A', text: '서로 솔직하게 다 말할 수 있을 때' },
        { choice: 'B', text: '오래 만났는데도 여전히 끌릴 때' },
        { choice: 'C', text: '함께 정한 약속이 그대로 지켜질 때' },
      ],
    },
    {
      q: 5,
      prompt: '관계가 깊어질수록 당신은?',
      options: [
        { choice: 'A', text: '더 많은 걸 공유하고 싶어진다' },
        { choice: 'B', text: '함께와 각자의 선을 명확히 한다' },
        { choice: 'C', text: '내 페이스를 지킬 시간이 필요해진다' },
      ],
    },
  ],
  ESFJ: [
    {
      q: 1,
      prompt: '마음에 드는 사람에게 다가갈 때 당신은?',
      options: [
        { choice: 'A', text: '먼저 적극적으로 표현하고 자리를 만든다' },
        { choice: 'B', text: '잘 챙겨주고 배려하면서 마음을 얻는다' },
        { choice: 'C', text: '상대가 먼저 신호를 줄 때까지 기다린다' },
      ],
    },
    {
      q: 2,
      prompt: '정성껏 했는데 상대가 시큰둥하다.',
      options: [
        { choice: 'A', text: '뭐가 어긋났는지 파악하고 방법을 바꾼다' },
        { choice: 'B', text: '원래 표현이 서툰 사람이려니 한다' },
        { choice: 'C', text: '서운함이 그대로 드러난다' },
      ],
    },
    {
      q: 3,
      prompt: '상대가 요즘 연락이 뜸하다.',
      options: [
        { choice: 'A', text: '바쁜가 보다 하고 넘긴다' },
        { choice: 'B', text: '신경 쓰이지만 확인하면 풀린다' },
        { choice: 'C', text: '마음이 식었나 싶어 계속 곱씹는다' },
      ],
    },
    {
      q: 4,
      prompt: '연애에서 가장 중요한 건?',
      options: [
        { choice: 'A', text: '서로에게 편안한 사람이 되는 것' },
        { choice: 'B', text: '계속 설레는 관계인 것' },
        { choice: 'C', text: '오래 함께할 사이라는 확신' },
      ],
    },
    {
      q: 5,
      prompt: '상대가 각자의 시간을 더 원한다면?',
      options: [
        { choice: 'A', text: '서운하다. 나는 더 함께이고 싶다' },
        { choice: 'B', text: '그럴 수 있다고 받아들인다' },
        { choice: 'C', text: '오히려 나도 그게 편할 때가 있다' },
      ],
    },
  ],
  ISTP: [
    {
      q: 1,
      prompt: '관심 있는 사람이 생겼을 때 당신은?',
      options: [
        { choice: 'A', text: '직접적으로 움직인다. 재는 시간이 아깝다' },
        { choice: 'B', text: '필요할 때 실질적으로 도움을 주며 가까워진다' },
        { choice: 'C', text: '별 티 안 내고 상황을 지켜본다' },
      ],
    },
    {
      q: 2,
      prompt: '상대가 감정적으로 몰아붙인다.',
      options: [
        { choice: 'A', text: '문제를 분리해서 해결 가능한 것만 처리한다' },
        { choice: 'B', text: '지나가는 감정이려니 하고 흘린다' },
        { choice: 'C', text: '나도 감정이 올라와서 그대로 나간다' },
      ],
    },
    {
      q: 3,
      prompt: '관계에 애매한 기류가 생겼다.',
      options: [
        { choice: 'A', text: '흘러가는 대로 두고 신경 쓰지 않는다' },
        { choice: 'B', text: '조금 걸리지만 오래가진 않는다' },
        { choice: 'C', text: '계속 신경 쓰이고 자꾸 생각난다' },
      ],
    },
    {
      q: 4,
      prompt: '이 관계가 괜찮다고 느끼는 지점은?',
      options: [
        { choice: 'A', text: '굳이 설명 안 해도 통할 때' },
        { choice: 'B', text: '아직 이 사람에게 끌릴 때' },
        { choice: 'C', text: '흔들려도 안 무너질 거라는 감이 있을 때' },
      ],
    },
    {
      q: 5,
      prompt: '상대가 계속 붙어 있으려 한다면?',
      options: [
        { choice: 'A', text: '나도 그게 좋다' },
        { choice: 'B', text: '적당히 조절하면 괜찮다' },
        { choice: 'C', text: '혼자 있는 시간이 반드시 필요해진다' },
      ],
    },
  ],
  ISFP: [
    {
      q: 1,
      prompt: '좋아하는 감정이 생겼을 때 당신은?',
      options: [
        { choice: 'A', text: '표현한다. 마음은 타이밍을 놓치면 끝이다' },
        { choice: 'B', text: '조용히 챙겨주면서 마음을 전한다' },
        { choice: 'C', text: '혼자 간직한 채로 오래 둔다' },
      ],
    },
    {
      q: 2,
      prompt: '상대가 내 감정을 가볍게 넘겼다.',
      options: [
        { choice: 'A', text: '왜 그게 중요했는지 정리해서 말한다' },
        { choice: 'B', text: '그럴 수도 있지 하고 스스로 넘긴다' },
        { choice: 'C', text: '서운함을 그대로 드러낸다' },
      ],
    },
    {
      q: 3,
      prompt: '상대의 태도가 미묘하게 달라졌다.',
      options: [
        { choice: 'A', text: '별거 아니겠거니 하고 넘어간다' },
        { choice: 'B', text: '마음에 걸리지만 확인하면 괜찮다' },
        { choice: 'C', text: '계속 신경 쓰이고 혼자 상상하게 된다' },
      ],
    },
    {
      q: 4,
      prompt: '연애에서 가장 소중한 건?',
      options: [
        { choice: 'A', text: '있는 그대로의 나로 있을 수 있는 사이' },
        { choice: 'B', text: '순간순간의 강렬한 감정' },
        { choice: 'C', text: '계속 함께할 거라는 안정감' },
      ],
    },
    {
      q: 5,
      prompt: '관계가 아주 가까워지면 당신은?',
      options: [
        { choice: 'A', text: '더 붙어 있고 싶어진다' },
        { choice: 'B', text: '가까움과 혼자를 오간다' },
        { choice: 'C', text: '내 공간이 없어지는 게 힘들어진다' },
      ],
    },
  ],
  ESTP: [
    {
      q: 1,
      prompt: '마음에 드는 상대가 생기면 당신은?',
      options: [
        { choice: 'A', text: '바로 움직인다. 기회는 만드는 것이다' },
        { choice: 'B', text: '상대에게 실질적으로 도움이 되는 걸 해준다' },
        { choice: 'C', text: '반응을 보면서 얼마나 갈지 가늠한다' },
      ],
    },
    {
      q: 2,
      prompt: '상대가 내 방식에 불만을 표했다.',
      options: [
        { choice: 'A', text: '뭐가 문제인지 짚고 바로 고친다' },
        { choice: 'B', text: '웃어넘기고 분위기를 바꾼다' },
        { choice: 'C', text: '나도 할 말이 있어서 바로 맞받는다' },
      ],
    },
    {
      q: 3,
      prompt: '관계가 삐걱대는 신호가 보인다.',
      options: [
        { choice: 'A', text: '그러다 말겠지 하고 신경 안 쓴다' },
        { choice: 'B', text: '잠깐 신경 쓰이지만 금방 잊는다' },
        { choice: 'C', text: '계속 걸리고 확인하고 싶어진다' },
      ],
    },
    {
      q: 4,
      prompt: '이 관계가 좋은 이유는?',
      options: [
        { choice: 'A', text: '서로 편하게 다 말할 수 있어서' },
        { choice: 'B', text: '여전히 짜릿하고 재미있어서' },
        { choice: 'C', text: '오래 갈 것 같다는 감이 와서' },
      ],
    },
    {
      q: 5,
      prompt: '관계가 깊어지면 당신은?',
      options: [
        { choice: 'A', text: '더 많이 함께하고 싶어진다' },
        { choice: 'B', text: '만날 때 만나고 각자일 땐 각자다' },
        { choice: 'C', text: '매여 있는 느낌이 들면 답답해진다' },
      ],
    },
  ],
  ESFP: [
    {
      q: 1,
      prompt: '좋아하는 사람이 생겼을 때 당신은?',
      options: [
        { choice: 'A', text: '바로 표현하고 분위기를 만든다' },
        { choice: 'B', text: '상대가 좋아할 걸 챙기면서 가까워진다' },
        { choice: 'C', text: '티를 내는 듯 안 내는 듯 반응을 살핀다' },
      ],
    },
    {
      q: 2,
      prompt: '상대가 내 기분을 알아주지 않는다.',
      options: [
        { choice: 'A', text: '뭐가 문제인지 정리해서 말한다' },
        { choice: 'B', text: '금방 다른 재미를 찾아 기분을 바꾼다' },
        { choice: 'C', text: '서운한 티가 그대로 난다' },
      ],
    },
    {
      q: 3,
      prompt: '상대의 연락이 눈에 띄게 줄었다.',
      options: [
        { choice: 'A', text: '바쁜가 보다 하고 넘긴다' },
        { choice: 'B', text: '신경 쓰이지만 다른 데 집중하면 잊는다' },
        { choice: 'C', text: '식은 건가 싶어 계속 생각난다' },
      ],
    },
    {
      q: 4,
      prompt: '연애에서 가장 중요한 건?',
      options: [
        { choice: 'A', text: '뭐든 다 털어놓을 수 있는 사이인 것' },
        { choice: 'B', text: '계속 설레고 재미있는 것' },
        { choice: 'C', text: '이 사람과 오래 갈 거라는 확신' },
      ],
    },
    {
      q: 5,
      prompt: '상대가 더 밀착되길 원한다면?',
      options: [
        { choice: 'A', text: '좋다. 나도 붙어 있는 게 좋다' },
        { choice: 'B', text: '적당한 선이 서로에게 낫다' },
        { choice: 'C', text: '숨 쉴 공간이 필요해진다' },
      ],
    },
  ],
} as const
