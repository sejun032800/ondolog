/**
 * 화면 C. 대표사진 등록 — Phase 6 얼굴 인식 아키텍처 보강분 "구현 순서" 3번.
 *
 * 근거: docs/ONDOLOG_MASTER.md "연인 인식용 대표사진"
 *   "등록: 개인 1장 + 커플 1장, 프로필처럼 관리" / "수정: 설정 탭에서
 *   언제든 교체". 화면 순서상 화면 A(생체정보 동의) 다음이지만, 이
 *   화면 자체는 동의 여부를 강제하지 않는다 — 화면 B(사진 라이브러리
 *   권한)가 아직 없어 "동의 → 권한 → 등록"의 순차 네비게이션을 만들
 *   수 없기 때문이다. 대신 설정 탭에서도 언제든 독립적으로 재진입
 *   가능해야 한다는 요구사항("언제든 교체")과 이 화면이 어차피 겸해야
 *   함을 그대로 반영한다.
 *
 * **이번 작업 범위는 사진 선택·미리보기·저장 UI까지다.** 실제 얼굴
 * 탐지·인식 SDK 연동은 다음 단계(메인 세션)다 — 이 파일은 얼굴 인식
 * 관련 코드를 전혀 import하지 않는다. "사진 선택"은 실제 OS 갤러리가
 * 아니라 번들 자산 중 하나를 고르는 방식이다(2026-08-27 코디네이터
 * 결정 — `src/constants/referencePhotoPlaceholders.ts` 참조). 저장
 * (Supabase Storage 업로드 + DB 반영)은 실제로 동작한다.
 *
 * 개인 대표사진은 로그인한 유저 기준(`profileStore`), 커플 대표사진은
 * 연결 상태 기준(`coupleStore`)이다 — 커플 대표사진은 연결 전에는
 * 등록할 대상 자체가 없으므로(MASTER.md "혼자서도 기록 가능. 개인
 * 대표사진만으로 자동 인식 동작") 미연결이면 잠근다(`<CoupleGate>`와
 * 같은 "게이팅, 진입 차단 아님" 원칙 — 화면 자체는 열려 있고 커플
 * 섹션만 잠긴다).
 */
import { useEffect, useState } from 'react'
import { Alert, View } from 'react-native'
import { ReferencePhotoSlot } from '../../src/components/ReferencePhotoSlot'
import { ScreenContainer } from '../../src/components/ScreenContainer'
import { useSession } from '../../src/hooks/useSession'
import { getReferencePhotoSignedUrl } from '../../src/services/referencePhotoApi'
import { useCoupleStore } from '../../src/store/coupleStore'
import { useProfileStore } from '../../src/store/profileStore'
import { useTheme } from '../../src/theme'

/** Storage 경로(비공개 버킷)를 화면에 그릴 서명 URL로 바꾼다. 실패/미등록이면 null. */
function useSignedPreviewUrl(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!path) {
      setUrl(null)
      return
    }
    let cancelled = false
    getReferencePhotoSignedUrl(path).then((signed) => {
      if (!cancelled) setUrl(signed)
    })
    return () => {
      cancelled = true
    }
  }, [path])

  return url
}

export default function ReferencePhotoModal() {
  const { session } = useSession()

  const profileStatus = useProfileStore((s) => s.status)
  const personalPhotoPath = useProfileStore((s) => s.referencePhotoPath)
  const refreshProfile = useProfileStore((s) => s.refresh)
  const setPersonalReferencePhoto = useProfileStore((s) => s.setPersonalReferencePhoto)

  const coupleStatus = useCoupleStore((s) => s.status)
  const couplePhotoPath = useCoupleStore((s) => s.referencePhotoPath)
  const refreshCouple = useCoupleStore((s) => s.refresh)
  const setCoupleReferencePhoto = useCoupleStore((s) => s.setReferencePhoto)

  const { colors, lines, spacing } = useTheme()

  useEffect(() => {
    if (session) {
      refreshProfile(session.user.id)
      refreshCouple(session.user.id)
    }
  }, [session, refreshProfile, refreshCouple])

  const personalSignedUrl = useSignedPreviewUrl(personalPhotoPath)
  const coupleSignedUrl = useSignedPreviewUrl(couplePhotoPath)

  const loading =
    !session ||
    profileStatus === 'unknown' ||
    profileStatus === 'loading' ||
    coupleStatus === 'unknown' ||
    coupleStatus === 'loading'

  if (loading) return <View style={{ backgroundColor: colors.paper, flex: 1 }} />

  const handleSavePersonal = async (localUri: string) => {
    try {
      await setPersonalReferencePhoto(session!.user.id, localUri)
    } catch (e) {
      Alert.alert('저장에 실패했어요', e instanceof Error ? e.message : '다시 시도해주세요.')
    }
  }

  const handleSaveCouple = async (localUri: string) => {
    try {
      await setCoupleReferencePhoto(localUri)
    } catch (e) {
      Alert.alert('저장에 실패했어요', e instanceof Error ? e.message : '다시 시도해주세요.')
    }
  }

  return (
    <ScreenContainer
      title="대표사진 등록"
      subtitle="우리 커플이 찍힌 사진만 찾아낼 기준 사진이에요."
    >
      <ReferencePhotoSlot
        title="개인 대표사진"
        description="이 기기가 나를 알아보는 기준이에요."
        currentPhotoUrl={personalSignedUrl}
        onSave={handleSavePersonal}
        testIDPrefix="reference-photo-personal"
      />

      <View
        style={{
          borderTopColor: colors.rule,
          borderTopWidth: lines.section,
          marginTop: spacing.s2,
          paddingTop: spacing.s6,
        }}
      >
        <ReferencePhotoSlot
          title="커플 대표사진"
          description="두 사람이 함께 있는 사진만 찾아낼 기준이에요."
          currentPhotoUrl={coupleSignedUrl}
          locked={coupleStatus !== 'connected'}
          lockedMessage="연인과 연결하면 등록할 수 있어요."
          onSave={handleSaveCouple}
          testIDPrefix="reference-photo-couple"
        />
      </View>
    </ScreenContainer>
  )
}
