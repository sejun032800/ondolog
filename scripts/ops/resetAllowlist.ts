/**
 * 초기화 스크립트 잠금 (75- 0-6, R76-9 · R78-5) - 순수 함수. Deno · 네트워크 · 파일을 쓰지 않는다(읽은 본문만 받는다).
 *
 * 허용 목록 파일은 **저장소 밖**에 둔다. 저장소에는 값이 하나도 없다.
 *   위치: 환경변수 `ONDOLOG_RESET_ALLOWLIST`(파일 경로)가 있으면 그것, 없으면 `<사용자 홈>/.ondolog/reset-allowlist.txt`
 *         (홈 = `USERPROFILE`, 없으면 `HOME`).
 *   형식: UTF-8 텍스트, 한 줄에 하나.
 *     - `#`로 시작하는 줄과 빈 줄은 무시한다(줄 중간의 `#` 뒤도 주석).
 *     - `project=<개발 프로젝트 ref>` 줄이 **하나 이상** 있어야 한다 - 접속 URL의 ref가 이 중 하나여야 한다(개발 프로젝트 표시).
 *     - 나머지 줄은 초기화를 허용할 이메일 하나씩(앞뒤 공백 무시, 대소문자 무시).
 *     - 그 밖의 모양(`@`가 없는 줄 · 빈 project 값)은 형식 오류로 거부한다.
 *
 * 판정 순서(모두 접속 전 · 네트워크 0): 목록 파일 없음 -> 형식 오류 -> project 줄 없음 -> 접속 URL 없음/모양 틀림
 *   -> URL의 ref가 목록의 project가 아님(= 개발 프로젝트 아님) -> 목록 밖 이메일(미리 보기도 거부).
 * 거부 문구에는 이메일 · ref · 경로 · 줄 내용을 넣지 않는다(줄 번호만).
 */

import { OpsStopError, projectRefFromUrl } from './opsGuards.ts'

/** 허용 목록 파일 경로를 덮어쓰는 환경변수 이름. */
export const RESET_ALLOWLIST_ENV = 'ONDOLOG_RESET_ALLOWLIST'
/** 홈 아래 기본 위치(경로 조각). */
export const DEFAULT_ALLOWLIST_SEGMENTS = ['.ondolog', 'reset-allowlist.txt'] as const
/** 개발 프로젝트 표시 줄의 앞머리. */
export const PROJECT_LINE_PREFIX = 'project='

export interface ResetAllowlist {
  readonly emails: ReadonlySet<string>
  readonly projects: ReadonlySet<string>
}

/** 허용 목록 파일 경로. 환경변수 우선, 없으면 홈 아래 기본 위치. 홈도 모르면 null(-> 거부). */
export function resolveAllowlistPath(env: (name: string) => string | undefined): string | null {
  const explicit = env(RESET_ALLOWLIST_ENV)?.trim()
  if (explicit) return explicit
  const home = env('USERPROFILE')?.trim() || env('HOME')?.trim()
  if (!home) return null
  const sep = home.includes('\\') && !home.includes('/') ? '\\' : '/'
  return [home.replace(/[\\/]+$/, ''), ...DEFAULT_ALLOWLIST_SEGMENTS].join(sep)
}

/** 본문 -> 허용 목록. 모양이 틀리면 멈춘다(줄 번호만 알린다). */
export function parseAllowlist(text: string): ResetAllowlist {
  const emails = new Set<string>()
  const projects = new Set<string>()
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  lines.forEach((raw, i) => {
    const line = raw.replace(/#.*$/, '').trim()
    if (line.length === 0) return
    if (line.toLowerCase().startsWith(PROJECT_LINE_PREFIX)) {
      const ref = line.slice(PROJECT_LINE_PREFIX.length).trim()
      if (!/^[a-z0-9]{10,32}$/.test(ref)) throw new OpsStopError(`허용 목록 파일 형식 오류 (${i + 1}번째 줄)`)
      projects.add(ref)
      return
    }
    if (!/^[^\s@]+@[^\s@]+$/.test(line)) throw new OpsStopError(`허용 목록 파일 형식 오류 (${i + 1}번째 줄)`)
    emails.add(line.toLowerCase())
  })
  return { emails, projects }
}

export interface ResetGateInput {
  /** 허용 목록 파일 본문. 파일이 없거나 읽을 수 없으면 null. */
  readonly allowlistText: string | null
  /** 접속 URL(환경변수 값). */
  readonly url: string | undefined
}

/** 초기화 문(gate): 이메일들을 받아 거부 이유(한 줄) 또는 null(통과). 접속 전에 부른다. */
export type ResetGate = (emails: readonly string[]) => string | null

/** 허용 목록 · 접속 URL로 문을 만든다. 판정은 순수하다(같은 입력 -> 같은 결과). */
export function makeResetGate(input: ResetGateInput): ResetGate {
  return (emails) => {
    if (input.allowlistText === null) return '허용 목록 파일이 없거나 읽을 수 없다(저장소 밖 로컬 파일이 필요하다)'
    let list: ResetAllowlist
    try {
      list = parseAllowlist(input.allowlistText)
    } catch (error) {
      if (error instanceof OpsStopError) return error.message
      throw error
    }
    if (list.projects.size === 0) return '허용 목록에 개발 프로젝트 표시(project= 줄)가 없다'
    if (input.url === undefined || input.url.trim().length === 0) return '접속 URL 환경변수가 없다'
    let ref: string
    try {
      ref = projectRefFromUrl(input.url)
    } catch {
      return '접속 URL 모양이 틀렸다'
    }
    if (!list.projects.has(ref)) return '개발 프로젝트가 아니다(허용 목록의 project와 다르다)'
    if (emails.length === 0) return '이메일이 없다'
    if (emails.some((e) => !list.emails.has(e.trim().toLowerCase()))) return '허용 목록에 없는 이메일이다'
    return null
  }
}
