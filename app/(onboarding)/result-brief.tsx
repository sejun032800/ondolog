/**
 * 화면 5. 간략 결과(공유용) — 바이럴 핵심.
 *
 * 근거: docs/ONDOLOG_MASTER.md Part 9-1 화면 5 —
 *   목적: ① 비가입 유저에게도 완결된 재미 ② SNS 바이럴 ③ 가입 유도
 *   연산: 클라이언트 로컬 순수 함수 — 서버 호출 없음
 *   설계 원칙: 공유 가치 > 가입 유도. 가입 버튼이 공유 버튼보다
 *     시각적 우선순위가 높지 않을 것.
 *
 * 여기서는 "공유하기"를 PrimaryButton(채워진 버튼), "더 자세히
 * 보기"(=가입 유도)를 SecondaryButton(테두리만)으로 둬서 가입 버튼이
 * 공유 버튼보다 강조되지 않게 한다 — 완료 기준을 스타일 코드로
 * 확인 가능하게 하기 위한 의도적 배치다.
 *
 * "이미지 저장"은 뷰를 이미지로 캡처해야 하는데(`react-native-view-shot`
 * 류) 현재 package.json에 해당 네이티브 의존성이 없다(Phase 3 산출물
 * 범위 밖의 신규 의존성 추가라 이번엔 설치하지 않음) — 버튼은 두되
 * 안내만 띄운다. 실제 구현은 후속 작업으로 남긴다.
 */
import { useRouter } from 'expo-router'
import { Alert, Share, Text } from 'react-native'
import { PrimaryButton } from '../../src/components/PrimaryButton'
import { ResultCard } from '../../src/components/ResultCard'
import { ScreenContainer } from '../../src/components/ScreenContainer'
import { SecondaryButton } from '../../src/components/SecondaryButton'
import { LOVE_TYPE_LABEL_BY_CODE } from '../../src/constants/loveTypeLabels'
import { MBTI_ENNEAGRAM_PREVALENCE } from '../../src/constants/enneagramPrevalence'
import { COLORS } from '../../src/constants/theme'
import { useSessionStore } from '../../src/store/sessionStore'

export default function ResultBriefScreen() {
  const router = useRouter()
  const result = useSessionStore((s) => s.result)
  const mbti = useSessionStore((s) => s.mbti)

  if (!result || !mbti) {
    // 정상 플로우라면 화면 4에서 계산을 마치고 들어온다.
    return (
      <ScreenContainer title="결과를 계산하는 중이에요">
        <Text style={{ color: COLORS.textMuted }}>이전 화면으로 돌아가 질문을 완료해주세요.</Text>
      </ScreenContainer>
    )
  }

  const isRare = MBTI_ENNEAGRAM_PREVALENCE[mbti]?.rare.includes(result.enneagramCore) ?? false
  const label = LOVE_TYPE_LABEL_BY_CODE[result.loveTypeCode]

  const handleShare = async () => {
    const summary = `${label?.labelKo ?? result.loveTypeCode} · ${mbti} · 애니어그램 ${result.enneagramCore}유형\n${label?.copyKo ?? ''}\n\n온돌로그에서 우리의 온도를 기록해보세요.`
    try {
      await Share.share({ message: summary })
    } catch {
      // 공유 시트를 사용자가 취소한 경우 등 — 별도 처리 불필요.
    }
  }

  const handleSaveImage = () => {
    Alert.alert(
      '이미지 저장 준비 중',
      '카드를 이미지로 저장하는 기능은 곧 추가돼요. 지금은 공유하기를 이용해주세요.',
    )
  }

  return (
    <ScreenContainer
      title="결과가 나왔어요"
      subtitle="가입하지 않아도 결과는 그대로예요. 공유만 해도 충분해요."
      footer={
        <SecondaryButton label="더 자세히 보기" onPress={() => router.push('/auth')} />
      }
    >
      <ResultCard
        mbti={mbti}
        enneagramCore={result.enneagramCore}
        loveTypeCode={result.loveTypeCode}
        isRare={isRare}
      />
      <PrimaryButton label="공유하기" onPress={handleShare} />
      <SecondaryButton label="이미지로 저장" onPress={handleSaveImage} />
    </ScreenContainer>
  )
}
