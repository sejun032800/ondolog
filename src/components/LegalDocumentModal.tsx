/**
 * 화면 6 동의 항목 [보기] 링크가 여는 전문 뷰어.
 * 근거: docs/ONDOLOG_MASTER.md 6-3 "공통: 모든 항목에 전문을 볼 수 있는
 * [보기] 링크를 둔다. 링크 없이 체크박스만 두면 동의로 인정되지 않는다."
 */
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme'
import type { LegalDocument } from '../constants/legalDocuments'

interface LegalDocumentModalProps {
  document: LegalDocument | null
  onClose: () => void
}

export function LegalDocumentModal({ document, onClose }: LegalDocumentModalProps) {
  const { colors, typography, spacing, lines } = useTheme()

  return (
    <Modal visible={!!document} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[styles.sheet, { backgroundColor: colors.paper, padding: spacing.s5 }]}
          testID="legal-document-sheet"
        >
          {document && (
            <>
              <View
                style={[
                  styles.header,
                  { borderBottomColor: colors.rule, borderBottomWidth: lines.hairline, marginBottom: spacing.s4, paddingBottom: spacing.s3 },
                ]}
              >
                <Text style={[typography.headline, { color: colors.inkFull }]}>{document.title}</Text>
                <Pressable onPress={onClose} hitSlop={8} testID="legal-document-close">
                  <Text
                    style={[typography.title, { color: colors.inkFull, textDecorationLine: 'underline' }]}
                  >
                    닫기
                  </Text>
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={{ gap: spacing.s2, paddingBottom: spacing.s5 }}>
                {document.body.map((paragraph, i) => (
                  <Text key={i} style={[typography.body, { color: colors.inkMute }]}>
                    {paragraph}
                  </Text>
                ))}
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.4)', flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderRadius: 0,
    maxHeight: '80%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
})
