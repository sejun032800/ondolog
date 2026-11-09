/** `exifr`의 lite 묶음(JPEG · HEIC, 작은 쪽)에서 우리가 쓰는 `parse`만 선언한다. 본 선언은 패키지 루트 타입(`index.d.ts`)과 같은 모양이다. */
declare module 'exifr/dist/lite.esm.mjs' {
  export function parse(input: Blob | ArrayBuffer | Uint8Array | string, options?: Record<string, unknown>): Promise<Record<string, unknown> | undefined>
}
