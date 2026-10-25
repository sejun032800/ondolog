/**
 * A12 약관 전문 보기 - A10의 [보기]가 여는 시트(손잡이 + ✕). 디자인 `N-S-A2-Onboarding`.
 *
 * **문장은 `src/constants/legalDocuments.ts`에 지금 있는 것 그대로** 보여준다 - 이 파일은 약관·동의 문장을 쓰지 않는다
 * (실제 문장은 M3-7, 사람 + PM). 지금 문서는 자리표시자라 화면에도 "[자리표시자]"가 그대로 보인다.
 * 서버를 부르지 않는다(로그인 전에 열린다). [확인]은 닫기만 한다 - 체크는 A10에서 사람이 한다.
 */
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PrimaryButton } from '../../src/components/nocturne/Buttons'
import { SheetHeader } from '../../src/components/nocturne/ExitHeader'
import { ScreenFrame } from '../../src/components/nocturne/ScreenFrame'
import { LEGAL_DOCUMENTS, type LegalDocumentKey } from '../../src/constants/legalDocuments'
import { nocturne, shape, type } from '../../src/theme/nocturne'

function isLegalKey(key: string | undefined): key is LegalDocumentKey {
  return !!key && Object.prototype.hasOwnProperty.call(LEGAL_DOCUMENTS, key)
}

export default function LegalDocumentSheet() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ key?: string }>()
  const doc = isLegalKey(params.key) ? LEGAL_DOCUMENTS[params.key] : null
  const close = () => router.back()

  return (
    <ScreenFrame style={styles.sheet}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <SheetHeader onClose={close} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {doc ? (
          <>
            <Text style={styles.title} testID="legal-title">{doc.title}</Text>
            <View style={styles.body}>
              {doc.body.map((paragraph, i) => (
                <Text key={i} style={styles.paragraph}>
                  {paragraph}
                </Text>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.paragraph}>문서를 찾을 수 없어요.</Text>
        )}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <PrimaryButton label="확인" onPress={close} testID="legal-confirm" />
      </View>
    </ScreenFrame>
  )
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: nocturne.inkRaise },
  header: { paddingHorizontal: shape.space.screen },
  content: { paddingHorizontal: shape.space.screen, paddingTop: 16, paddingBottom: 24 },
  title: { ...type.display, color: nocturne.text },
  body: { marginTop: 24, gap: 10 },
  paragraph: { ...type.body, color: nocturne.textSub },
  footer: { paddingHorizontal: 20 },
})
