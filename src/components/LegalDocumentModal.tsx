/**
 * 화면 6 동의 항목 [보기] 링크가 여는 전문 뷰어.
 * 근거: docs/ONDOLOG_MASTER.md 6-3 "공통: 모든 항목에 전문을 볼 수 있는
 * [보기] 링크를 둔다. 링크 없이 체크박스만 두면 동의로 인정되지 않는다."
 */
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { COLORS, SPACING } from '../constants/theme'
import type { LegalDocument } from '../constants/legalDocuments'

interface LegalDocumentModalProps {
  document: LegalDocument | null
  onClose: () => void
}

export function LegalDocumentModal({ document, onClose }: LegalDocumentModalProps) {
  return (
    <Modal visible={!!document} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="legal-document-sheet">
          {document && (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>{document.title}</Text>
                <Pressable onPress={onClose} hitSlop={8} testID="legal-document-close">
                  <Text style={styles.close}>닫기</Text>
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.body}>
                {document.body.map((paragraph, i) => (
                  <Text key={i} style={styles.paragraph}>
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
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    padding: SPACING.lg,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  title: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  close: { color: COLORS.accent, fontSize: 14, fontWeight: '700' },
  body: { gap: SPACING.sm, paddingBottom: SPACING.lg },
  paragraph: { color: COLORS.textMuted, fontSize: 14, lineHeight: 21 },
})
