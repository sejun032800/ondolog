/**
 * 메인 탭 (Part 9-2).
 *
 * 연결 상태별로 완전히 다른 화면을 보여준다(문서 원문 두 표 그대로):
 *
 *   커플 연결 | 상단 양측 프로필+커플 닉네임 / 히어로 연애 온도(일 단위
 *     갱신) / 히어로 하단 사귄 일수 D+N / 하단 최근 발행물·매거진 진입점
 *   미연결   | 상단 본인 프로필+빈 슬롯 / 히어로 36.5도 고정 / 중앙
 *     온보딩 결과 요약(연애유형 라벨·애니어그램 코어·간단 설명) /
 *     하단 연인 초대 CTA
 *
 * ⚠️ 이 화면은 두 상태의 콘텐츠 자체가 원문에서부터 다르게 정의돼
 * 있어(위 두 표), 커플 전용 "기능"을 잠가서 보여주는 `<CoupleGate>`의
 * 일반 잠금 카드를 쓰지 않는다 — `<CoupleGate>`는 채팅(진입 즉시 모달),
 * 피드의 통합 뷰처럼 "같은 화면인데 기능 하나가 잠긴" 경우를 위한
 * 것이고, 메인 탭은 애초에 두 화면이 다르다(Part 9-2 원문 설계).
 *
 * 연애 온도:
 *   - 미연결: 36.5 고정(`useCoupleStore`가 이미 이 값으로 초기화·유지).
 *   - 연결: `daily_temperature` 최신 저장값을 읽기만 한다(`coupleStore.
 *     refresh` 참조). 일 배치(Edge Function)가 아직 없어 대부분 null —
 *     이 경우 숫자를 지어내지 않고 문구로 대체한다. Part 9-2 "표시 상태"
 *     표(2026-08-25 확정)에 따라 "아직 온도를 잴 기록이 없어요"를
 *     보여준다 — 시스템 상태("측정 준비 중")가 아니라 유저 행동으로
 *     프레이밍해 채팅 탭 사용을 유도한다(Part 17-2 DNA 일치율이 채팅으로
 *     움직이는 것과 같은 맥락, DECISIONS.md 동일 날짜 항목 참조).
 *
 * 마일스톤 임박 강조는 Part 9-2 "사귄 일수 표시 규격"(2026-08-25 확정)
 * 그대로 구현한다 — 100일 단위/연 단위, 마일스톤 7일 전부터 강조,
 * 당일은 별도 축하 표시(`src/utils/relationshipDays.ts` `getMilestoneStatus`).
 *
 * "하단 최근 발행물 / 다음 발행까지 남은 기간"은 발행 파이프라인이
 * Phase 7~8 범위라 이번엔 최근 발행물 유무만 `issues_public` 뷰로
 * 읽어 매거진 탭 진입점으로 연결한다(CLAUDE.md 절대 규칙 3: `issues`
 * 원본 테이블이 아니라 `issues_public` 뷰만 조회). "다음 발행까지
 * 남은 기간"은 발행 주기 config가 아직 앱에 연결돼 있지 않아 만들지
 * 않는다.
 */
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '../../src/components/Button'
import { Numeral } from '../../src/components/Numeral'
import { PageHeader } from '../../src/components/PageHeader'
import { ResultCard } from '../../src/components/ResultCard'
import { useTheme } from '../../src/theme'
import { MBTI_ENNEAGRAM_PREVALENCE } from '../../src/constants/enneagramPrevalence'
import type { EnneagramCore } from '../../src/constants/enneagram'
import type { MbtiType } from '../../src/constants/quizTypes'
import { useSession } from '../../src/hooks/useSession'
import {
  fetchLatestAssessment,
  fetchPersonalityProfile,
  fetchProfile,
} from '../../src/services/personalityApi'
import { supabase } from '../../src/services/supabase'
import { useCoupleStore } from '../../src/store/coupleStore'
import { computeDaysTogether, getMilestoneStatus } from '../../src/utils/relationshipDays'

interface DisconnectedSummary {
  mbti: MbtiType
  enneagramCore: EnneagramCore
  loveTypeCode: string
  isRare: boolean
}

interface LatestIssue {
  title: string | null
  issueNumber: number | null
}

export default function MainTab() {
  const router = useRouter()
  const { session } = useSession()

  const status = useCoupleStore((s) => s.status)
  const coupleId = useCoupleStore((s) => s.coupleId)
  const partnerId = useCoupleStore((s) => s.partnerId)
  const nickname = useCoupleStore((s) => s.nickname)
  const temperature = useCoupleStore((s) => s.temperature)
  const relationshipStartDate = useCoupleStore((s) => s.relationshipStartDate)
  const refresh = useCoupleStore((s) => s.refresh)

  const [selfName, setSelfName] = useState<string | null>(null)
  const [partnerName, setPartnerName] = useState<string | null>(null)
  const [summary, setSummary] = useState<DisconnectedSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [latestIssue, setLatestIssue] = useState<LatestIssue | null>(null)
  const [issueLoading, setIssueLoading] = useState(false)

  useEffect(() => {
    if (session) refresh(session.user.id)
  }, [session, refresh])

  // 본인 표시 이름
  useEffect(() => {
    if (!session) return
    let cancelled = false
    fetchProfile(session.user.id).then((p) => {
      if (!cancelled) setSelfName(p?.display_name ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [session])

  // 상대 표시 이름 (연결 상태에서만)
  useEffect(() => {
    if (status !== 'connected' || !partnerId) {
      setPartnerName(null)
      return
    }
    let cancelled = false
    fetchProfile(partnerId).then((p) => {
      if (!cancelled) setPartnerName(p?.display_name ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [status, partnerId])

  // 온보딩 결과 요약 (미연결 상태에서만)
  useEffect(() => {
    if (status !== 'disconnected' || !session) {
      setSummary(null)
      return
    }
    let cancelled = false
    setSummaryLoading(true)
    ;(async () => {
      try {
        const assessment = await fetchLatestAssessment(session.user.id)
        if (!assessment || cancelled) return
        const profile = await fetchPersonalityProfile(session.user.id)
        if (!profile || cancelled) return
        const effectiveCore = (profile.enneagram_effective ??
          profile.enneagram_inferred) as EnneagramCore
        const mbti = assessment.mbti as MbtiType
        const isRare =
          MBTI_ENNEAGRAM_PREVALENCE[mbti]?.rare.includes(effectiveCore) ?? false
        setSummary({
          mbti,
          enneagramCore: effectiveCore,
          loveTypeCode: profile.love_type_code,
          isRare,
        })
      } finally {
        if (!cancelled) setSummaryLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status, session])

  // 최근 발행물 (연결 상태에서만, issues_public 뷰만 조회)
  useEffect(() => {
    if (status !== 'connected' || !coupleId) {
      setLatestIssue(null)
      return
    }
    let cancelled = false
    setIssueLoading(true)
    ;(async () => {
      try {
        const { data } = await supabase
          .from('issues_public')
          .select('title, issue_number')
          .eq('couple_id', coupleId)
          .order('published_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (cancelled) return
        setLatestIssue(data ? { title: data.title, issueNumber: data.issue_number } : null)
      } finally {
        if (!cancelled) setIssueLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status, coupleId])

  const { colors, typography, spacing, lines, ink } = useTheme()

  const isConnected = status === 'connected'
  const daysTogether = isConnected && relationshipStartDate
    ? computeDaysTogether(relationshipStartDate)
    : null
  const milestone = daysTogether !== null ? getMilestoneStatus(daysTogether) : null

  // 연결 여부 조회가 끝나기 전에는 미연결/연결 어느 쪽 레이아웃도
  // 섣불리 확정하지 않는다(`<CoupleGate>`가 `status === 'unknown' |
  // 'loading'`일 때 아무것도 렌더링하지 않는 것과 같은 원칙).
  if (status === 'unknown' || status === 'loading') {
    return (
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.paper, flex: 1 }}>
        <PageHeader left="메 인" />
        <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={colors.inkFull} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.paper, flex: 1 }}>
      <PageHeader left="메 인" right={daysTogether !== null ? `D+${daysTogether}` : undefined} />
      <ScrollView
        contentContainerStyle={{
          gap: spacing.s7,
          paddingBottom: spacing.s8,
          paddingHorizontal: 24,
        }}
      >
        {/* §5-5 온도 히어로 */}
        <View style={{ alignItems: 'center', gap: spacing.s2, paddingVertical: spacing.s6 }}>
          <Text style={[typography.kickerEn, { color: colors.inkMute }]}>O U R  T E M P E R A T U R E</Text>
          {temperature !== null ? (
            <Numeral value={temperature} suffix="°" style={ink('metric')} />
          ) : (
            <Text style={[typography.headline, { color: colors.inkMute, marginTop: spacing.s3 }]}>
              아직 온도를 잴 기록이 없어요
            </Text>
          )}
          <Text style={[typography.caption, { color: colors.inkMute }]}>
            {isConnected
              ? temperature !== null
                ? '오늘의 온도'
                : '채팅이 쌓이면 다음 배치에 반영돼요'
              : '아직 아무 데이터도 없는 평온한 기본 체온이에요'}
          </Text>
          {milestone?.isToday && (
            <Text style={[typography.title, { color: colors.inkFull, marginTop: spacing.s2 }]}>
              🎉 {milestone.label} 축하해요!
            </Text>
          )}
          {milestone?.isUpcoming && (
            <Text style={[typography.caption, { color: colors.inkMute, marginTop: spacing.s2 }]}>
              {milestone.label}까지 {milestone.daysUntil}일 남았어요
            </Text>
          )}
        </View>

        {isConnected ? (
          <>
            <View style={{ borderTopColor: colors.rule, borderTopWidth: lines.section, paddingTop: spacing.s5 }}>
              <ProfileRow selfName={selfName} partnerName={partnerName} nickname={nickname} />
            </View>

            <View style={{ borderTopColor: colors.rule, borderTopWidth: lines.section, gap: spacing.s3, paddingTop: spacing.s5 }}>
              <Text style={[typography.title, { color: colors.inkFull }]}>매거진</Text>
              {issueLoading ? (
                <ActivityIndicator color={colors.inkFull} />
              ) : (
                <Pressable onPress={() => router.push('/magazine')}>
                  {latestIssue ? (
                    <>
                      <Text style={[typography.headline, { color: colors.inkFull }]}>
                        {latestIssue.issueNumber != null ? `${latestIssue.issueNumber}호 · ` : ''}
                        {latestIssue.title ?? '제목 없음'}
                      </Text>
                      <Text style={[typography.caption, { color: colors.inkMute, marginTop: spacing.s1 }]}>
                        읽기 →
                      </Text>
                    </>
                  ) : (
                    <Text style={[typography.caption, { color: colors.inkMute }]}>
                      아직 발행된 매거진이 없어요
                    </Text>
                  )}
                </Pressable>
              )}
            </View>
          </>
        ) : (
          <>
            <View style={{ borderTopColor: colors.rule, borderTopWidth: lines.section, paddingTop: spacing.s5 }}>
              <ProfileRow selfName={selfName} partnerName={null} nickname={null} />
            </View>

            <View style={{ gap: spacing.s3 }}>
              <Text style={[typography.title, { color: colors.inkFull }]}>온보딩 결과 요약</Text>
              {summaryLoading || !summary ? (
                <ActivityIndicator color={colors.inkFull} />
              ) : (
                <ResultCard
                  mbti={summary.mbti}
                  enneagramCore={summary.enneagramCore}
                  loveTypeCode={summary.loveTypeCode}
                  isRare={summary.isRare}
                />
              )}
            </View>

            <View>
              <Button label="연인 초대하기" onPress={() => router.push('/couple-gate')} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function ProfileRow({
  selfName,
  partnerName,
  nickname,
}: {
  selfName: string | null
  partnerName: string | null
  nickname: string | null
}) {
  const { colors, typography, spacing } = useTheme()
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.s3, justifyContent: 'center' }}>
      {/* §4-5 "두 사람" — 나는 항상 왼쪽, 상대는 항상 오른쪽. */}
      <Text style={[typography.title, { color: colors.inkFull }]}>{selfName ?? '나'}</Text>
      <Text style={[typography.caption, { color: colors.inkMute }]}>{nickname ? `· ${nickname} ·` : '♥'}</Text>
      {partnerName ? (
        <Text style={[typography.title, { color: colors.inkFull }]}>{partnerName}</Text>
      ) : (
        <Text style={[typography.title, { color: colors.inkFaint }]}>빈 슬롯</Text>
      )}
    </View>
  )
}
