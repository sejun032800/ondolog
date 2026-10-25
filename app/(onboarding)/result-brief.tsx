/**
 * A08 간략 결과 - 연애유형 카드 한 장. 디자인 `N-S-A2-Onboarding`.
 *
 * MASTER 9-1 화면 5: 서버 호출 없이 메모리의 답과 로컬 순수 함수 결과만 쓴다. **카드에 이름 등 개인 식별 정보가 없다**
 * (`LoveTypeCard`는 그런 props를 받지 않는다).
 *
 * 이번 단계(U6 1부)에서는 **공유 버튼·이미지 저장을 숨긴다** - 공유 카드 이미지(A09)는 M3-6이다. 공유가 생기면
 * "공유 가치 > 가입 유도"(가입 버튼이 공유 버튼보다 눈에 띄지 않을 것)에 따라 이 아래의 "더 자세히 보기"는 지금처럼 글자 링크로 둔다.
 * "더 자세히 보기"는 약관 동의(A10)로 간다 - 동의가 로그인 앞이다(MASTER 6-1).
 */
import { useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LoveTypeCard } from '../../src/components/onboarding/LoveTypeCard'
import { PushHeader } from '../../src/components/nocturne/ExitHeader'
import { PressScale } from '../../src/components/nocturne/PressScale'
import { RiseIn } from '../../src/components/nocturne/RiseIn'
import { ScreenFrame } from '../../src/components/nocturne/ScreenFrame'
import { SkyBackground } from '../../src/components/nocturne/SkyBackground'
import { MBTI_ENNEAGRAM_PREVALENCE } from '../../src/constants/enneagramPrevalence'
import { LOVE_TYPE_LABEL_BY_CODE } from '../../src/constants/loveTypeLabels'
import { useSessionStore } from '../../src/store/sessionStore'
import { nocturne, shape, type } from '../../src/theme/nocturne'

/** 이 화면은 별이 보이되 카드 글자가 읽히게 하늘을 어둡게 덮는다. */
const BRIEF_SKY_VEIL = 0.7

export default function ResultBriefScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const result = useSessionStore((s) => s.result)
  const mbti = useSessionStore((s) => s.mbti)

  const goBack = () => router.back()

  if (!result || !mbti) {
    // 정상 길이라면 A07에서 채점을 마치고 들어온다.
    return (
      <ScreenFrame>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <PushHeader onBack={goBack} />
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>질문을 마치면 결과가 나와요.</Text>
        </View>
      </ScreenFrame>
    )
  }

  const label = LOVE_TYPE_LABEL_BY_CODE[result.loveTypeCode]
  const isRare = MBTI_ENNEAGRAM_PREVALENCE[mbti]?.rare.includes(result.enneagramCore) ?? false

  return (
    <ScreenFrame>
      <SkyBackground view="sky" veil={BRIEF_SKY_VEIL}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <PushHeader onBack={goBack} />
        </View>
        <View style={styles.center}>
          <RiseIn>
            <LoveTypeCard
              labelEn={label?.labelEn ?? result.loveTypeCode}
              labelKo={label?.labelKo ?? result.loveTypeCode}
              copyKo={label?.copyKo}
              mbti={mbti}
              enneagramCore={result.enneagramCore}
              isRare={isRare}
            />
          </RiseIn>
        </View>
        <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
          <PressScale
            onPress={() => router.push('/consent')}
            accessibilityLabel="더 자세히 보기"
            style={styles.more}
            testID="brief-more"
          >
            <Text style={styles.moreLabel}>{'더 자세히 보기 →'}</Text>
          </PressScale>
        </View>
      </SkyBackground>
    </ScreenFrame>
  )
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: shape.space.screen },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  footer: { alignItems: 'center' },
  more: { minHeight: shape.touch, justifyContent: 'center', paddingHorizontal: 16 },
  moreLabel: { ...type.body, fontSize: 15.5, color: nocturne.mist },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...type.body, color: nocturne.textMute },
})
