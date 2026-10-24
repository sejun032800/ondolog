/**
 * D10 속표지 - 밤에서 종이로 넘어가는 순간(디자인 `N-D10-Front-Matter`). 종이 바탕(`paper`·`paperInk`·`paperMute`).
 *
 * 워드마크 · 닉네임 · 표지 이미지 · "N월호" · 이름 · 실린 코너(지면 제목, MASTER 17-0-7) · [읽기] · [PDF 내려받기] · 고지.
 * 고지 문구는 PM 문장(R31-9)이고 한 곳(`FRONT_MATTER_NOTICE`)에 있다 - 디자인 보드의 문장은 쓰지 않는다.
 * 나가는 길은 시트의 ✕(R18-2). 호 번호(Vol)는 이 면에 없다(표지 이미지에도 없다, R21-3).
 */
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { FRONT_MATTER_NOTICE } from '../../constants/magazineCopy'
import type { FrontMatterCorner, PublishedIssue } from '../../services/magazineApi'
import { fontFamily, nocturne, shape, withAlpha } from '../../theme/nocturne'
import { issueMonthLabel } from '../../utils/magazine'
import { COVER_ASPECT } from './LibraryShelf'
import { PressScale } from '../nocturne/PressScale'

const COVER_HEIGHT = 220

export interface FrontMatterProps {
  issue: Pick<PublishedIssue, 'issueType' | 'periodStart' | 'title' | 'pdfDigitalPath'>
  coverUri: string | undefined
  /** 커플 닉네임. 없으면 그리지 않는다. */
  nickname: string | null
  /** "세준 · 서영". 이름을 못 읽었으면 빈 문자열. */
  names: string
  corners: readonly FrontMatterCorner[]
  onClose: () => void
  onRead: () => void
  onPdf: () => void
  /** PDF 서명 URL을 받는 중. */
  pdfBusy: boolean
  /** PDF를 열지 못했다. */
  pdfFailed: boolean
}

export function FrontMatter({
  issue,
  coverUri,
  nickname,
  names,
  corners,
  onClose,
  onRead,
  onPdf,
  pdfBusy,
  pdfFailed,
}: FrontMatterProps) {
  const month = issueMonthLabel({ periodStart: issue.periodStart, issueType: issue.issueType, title: issue.title })
  const canPdf = !!issue.pdfDigitalPath && !pdfBusy
  return (
    <View style={styles.sheet} testID="front-matter">
      <View style={styles.closeRow}>
        <PressScale onPress={onClose} accessibilityLabel="닫기" style={styles.close} testID="front-matter-close">
          <Text style={styles.closeMark}>{'✕'}</Text>
        </PressScale>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.wordmarkBlock}>
          <Text style={styles.wordmark}>ONDOLOG</Text>
          {nickname ? <Text style={styles.nickname}>{nickname}</Text> : null}
        </View>
        <View style={styles.cover} testID="front-matter-cover">
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={styles.coverImage} resizeMode="contain" accessibilityIgnoresInvertColors />
          ) : null}
        </View>
        <View style={styles.titleRow}>
          <Text style={styles.month}>{month}</Text>
          {names ? <Text style={styles.names}>{names}</Text> : null}
        </View>
        <View style={styles.rule} />
        <View style={styles.corners} testID="front-matter-corners">
          {corners.map((c) => (
            <View key={c.id} style={styles.cornerRow}>
              <Text style={styles.cornerTitle}>{c.pageTitle}</Text>
              {c.cornerName ? <Text style={styles.cornerName}>{c.cornerName}</Text> : null}
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <PressScale onPress={onRead} accessibilityLabel="읽기" style={styles.read} testID="front-matter-read">
          <Text style={styles.readLabel}>읽기</Text>
        </PressScale>
        <PressScale
          onPress={onPdf}
          disabled={!canPdf}
          accessibilityLabel="PDF 내려받기"
          style={[styles.pdf, !canPdf && styles.pdfDisabled]}
          testID="front-matter-pdf"
        >
          <Text style={[styles.pdfLabel, !canPdf && styles.pdfLabelDisabled]}>PDF 내려받기</Text>
        </PressScale>
        {pdfFailed ? (
          <Text style={styles.pdfError} testID="front-matter-pdf-error">
            PDF를 열지 못했어요. 잠시 뒤에 다시 눌러 주세요
          </Text>
        ) : null}
        <Text style={styles.notice} testID="front-matter-notice">
          {FRONT_MATTER_NOTICE}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: nocturne.paper },
  closeRow: { alignItems: 'flex-end', paddingTop: 14, paddingRight: 10 },
  close: { width: shape.touch, height: shape.touch, alignItems: 'center', justifyContent: 'center' },
  closeMark: { fontFamily: fontFamily.regular, fontSize: 15, color: nocturne.paperMute },
  scroll: { paddingHorizontal: 24, paddingBottom: 16, gap: 22 },
  wordmarkBlock: { alignItems: 'center', gap: 10 },
  wordmark: {
    fontFamily: fontFamily.serif,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 11,
    paddingLeft: 11,
    color: nocturne.paperInk,
  },
  nickname: {
    fontFamily: fontFamily.semiBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 3,
    paddingLeft: 3,
    color: nocturne.paperMute,
  },
  cover: {
    alignSelf: 'center',
    width: Math.round(COVER_HEIGHT * COVER_ASPECT),
    height: COVER_HEIGHT,
    backgroundColor: withAlpha(nocturne.paperInk, 0.06),
  },
  coverImage: { width: '100%', height: '100%' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  month: { fontFamily: fontFamily.serifLight, fontSize: 44, lineHeight: 48, letterSpacing: -0.9, color: nocturne.paperInk },
  names: { fontFamily: fontFamily.regular, fontSize: 12.5, color: nocturne.paperMute },
  rule: { height: 1, backgroundColor: nocturne.paperInk, marginTop: -8 },
  corners: { gap: 6 },
  cornerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cornerTitle: { fontFamily: fontFamily.serif, fontSize: 15, lineHeight: 24, color: nocturne.paperInk },
  cornerName: { fontFamily: fontFamily.regular, fontSize: 12, color: nocturne.paperMute },
  footer: { paddingHorizontal: 24, paddingBottom: 40, gap: 10 },
  read: {
    height: shape.buttonHeight,
    borderRadius: shape.radius.button,
    backgroundColor: nocturne.paperInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readLabel: { fontFamily: fontFamily.semiBold, fontSize: 15.5, color: nocturne.paper },
  pdf: {
    height: 50,
    borderRadius: shape.radius.button,
    borderWidth: 1,
    borderColor: withAlpha(nocturne.paperInk, 0.25),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfDisabled: { borderColor: withAlpha(nocturne.paperInk, 0.12) },
  pdfLabel: { fontFamily: fontFamily.medium, fontSize: 14.5, color: nocturne.paperInk },
  pdfLabelDisabled: { color: nocturne.paperMute },
  pdfError: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: nocturne.paperMute, textAlign: 'center' },
  notice: {
    marginTop: 6,
    fontFamily: fontFamily.regular,
    fontSize: 11,
    lineHeight: 17,
    color: nocturne.paperMute,
    textAlign: 'center',
  },
})
