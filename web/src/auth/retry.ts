/** 로그인 직후 첫 조회가 만료 토큰(PGRST303)으로 거부되면 **한 번** 다시 한다. 다른 오류는 그대로 던진다. */
export const JWT_EXPIRED_CODE = 'PGRST303'

function isJwtExpired(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === JWT_EXPIRED_CODE
}

export async function withJwtRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (err) {
    if (!isJwtExpired(err)) throw err
    return run()
  }
}
