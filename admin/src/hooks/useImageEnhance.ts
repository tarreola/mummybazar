/**
 * useImageEnhance
 *
 * Pipeline (client-side, 100% free, no external API):
 *   1. Remove background via @imgly/background-removal (WASM / ONNX)
 *   2. Render on white canvas in 4:5 ratio (800×1000 px) — centered + padded
 *   3. Add MommyBazar watermark (bottom-right corner)
 *   4. Return as a File (JPEG, 90% quality) ready for upload
 */


const OUTPUT_W = 800
const OUTPUT_H = 1000   // 4:5 ratio (Instagram / marketplace standard)
const PADDING = 40      // px of white padding around the subject
const WATERMARK_TEXT = 'El Ropero de Mar'

export type EnhanceStatus = 'idle' | 'removing-bg' | 'compositing' | 'done' | 'error'

export interface EnhanceResult {
  file: File
  preview: string   // object URL for preview
}

/** Load an image element from a File */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Draw the subject centered on a white 4:5 canvas with padding */
function compositeOnWhite(subjectImg: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_W
  canvas.height = OUTPUT_H
  const ctx = canvas.getContext('2d')!

  // White background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, OUTPUT_W, OUTPUT_H)

  // Scale subject to fit inside padded area maintaining aspect ratio
  const maxW = OUTPUT_W - PADDING * 2
  const maxH = OUTPUT_H - PADDING * 2
  const scale = Math.min(maxW / subjectImg.width, maxH / subjectImg.height)
  const drawW = subjectImg.width * scale
  const drawH = subjectImg.height * scale
  const dx = (OUTPUT_W - drawW) / 2
  const dy = (OUTPUT_H - drawH) / 2

  ctx.drawImage(subjectImg, dx, dy, drawW, drawH)

  return canvas
}

/** Add a subtle watermark to a canvas (in-place) */
function addWatermark(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  const fontSize = 18
  const margin = 14

  ctx.save()
  ctx.font = `600 ${fontSize}px 'Segoe UI', Arial, sans-serif`
  ctx.fillStyle = 'rgba(26, 58, 107, 0.28)'  // rosa MommyBazar, semi-transparente
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'

  // Optional: add a subtle logo circle behind text
  const textW = ctx.measureText(WATERMARK_TEXT).width
  const cx = canvas.width - margin - textW / 2
  const cy = canvas.height - margin - fontSize / 2
  ctx.beginPath()
  ctx.arc(cx - 4, cy, fontSize * 0.9, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fill()

  ctx.fillStyle = 'rgba(196, 29, 127, 0.35)'
  ctx.font = `700 ${fontSize}px 'Segoe UI', Arial, sans-serif`
  ctx.fillText(WATERMARK_TEXT, canvas.width - margin, canvas.height - margin)
  ctx.restore()
}

/** Canvas → JPEG File */
function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Canvas to blob failed'))
        resolve(new File([blob], name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.9,
    )
  })
}

/**
 * Main entry point.
 * @param file    Original photo File from the user
 * @param onStatus  Progress callback
 */
export async function enhanceImage(
  file: File,
  onStatus?: (s: EnhanceStatus) => void,
): Promise<EnhanceResult> {
  onStatus?.('removing-bg')

  // Dynamic import avoids top-level type issues with this package's declarations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { removeBackground } = await import('@imgly/background-removal') as any

  // 1. Remove background → returns a Blob with transparent PNG
  const bgRemovedBlob = await removeBackground(file, {
    output: { format: 'image/png', quality: 1 },
    // Use the public CDN for the ONNX model — no self-hosting needed
    publicPath: 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.5/dist/',
  })

  onStatus?.('compositing')

  // 2. Load the transparent subject
  const subjectUrl = URL.createObjectURL(bgRemovedBlob)
  const subjectImg = await loadImage(subjectUrl)
  URL.revokeObjectURL(subjectUrl)

  // 3. Composite on white + watermark
  const canvas = compositeOnWhite(subjectImg)
  addWatermark(canvas)

  // 4. Export as JPEG File
  const outFile = await canvasToFile(canvas, file.name)
  const preview = URL.createObjectURL(outFile)

  onStatus?.('done')
  return { file: outFile, preview }
}
