/**
 * 매거진 탭 — Part 11-2: "매거진 | 미연결 시: 진입 가능하나 발행물 없음
 * → 초대 유도". `issues_public` 뷰만 조회한다는 원칙(CLAUDE.md 절대
 * 규칙 3)은 실제 발행물 조회를 붙이는 Phase 7+에서 지킨다 — 이 화면은
 * 아직 아무 것도 조회하지 않는다(issues/issues_public 어느 쪽도 참조 X).
 */
import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { CoupleGate } from '../../src/components/CoupleGate'
import { COLORS, SPACING } from '../../src/constants/theme'
import { useSession } from '../../src/hooks/useSession'
import { useCoupleStore } from '../../src/store/coupleStore'

export default function MagazineTab() {
  const { session } = useSession()
  const refresh = useCoupleStore((s) => s.refresh)

  useEffect(() => {
    if (session) refresh(session.user.id)
  }, [session, refresh])

  return (
    <View style={styles.container}>
      <CoupleGate
        fallback={<Text style={styles.text}>연결되면 우리만의 매거진이 발행돼요.</Text>}
      >
        <Text style={styles.text}>아직 발행된 매거진이 없어요. (Phase 7 범위)</Text>
      </CoupleGate>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.bg, flex: 1, padding: SPACING.lg },
  text: { color: COLORS.textMuted, fontSize: 14 },
})
