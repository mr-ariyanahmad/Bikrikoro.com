export type ImageQualityReport = {
  warnings: string[]
  luminance: number
  sharpness: number
}

const SAMPLE_EDGE = 280

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(url); resolve(image) }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image cannot be decoded')) }
    image.src = url
  })
}

/**
 * Checks light level and edge detail entirely in the browser. It never sends
 * identity images anywhere and deliberately returns guidance, not an approval.
 */
export async function inspectVerificationImageQuality(file: File): Promise<ImageQualityReport | null> {
  if (!file.type.startsWith('image/')) return null
  try {
    const image = await loadImage(file)
    const scale = Math.min(1, SAMPLE_EDGE / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(48, Math.round(image.naturalWidth * scale))
    const height = Math.max(48, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null
    context.drawImage(image, 0, 0, width, height)
    const pixels = context.getImageData(0, 0, width, height).data
    const grayscale = new Float32Array(width * height)
    let totalLuminance = 0
    for (let pixel = 0, offset = 0; pixel < grayscale.length; pixel += 1, offset += 4) {
      const luminance = (pixels[offset] * 0.299) + (pixels[offset + 1] * 0.587) + (pixels[offset + 2] * 0.114)
      grayscale[pixel] = luminance
      totalLuminance += luminance
    }
    const luminance = totalLuminance / grayscale.length
    let laplacianTotal = 0
    let laplacianSamples = 0
    for (let y = 1; y < height - 1; y += 2) {
      for (let x = 1; x < width - 1; x += 2) {
        const current = grayscale[(y * width) + x]
        const laplacian = (4 * current) - grayscale[(y * width) + x - 1] - grayscale[(y * width) + x + 1] - grayscale[((y - 1) * width) + x] - grayscale[((y + 1) * width) + x]
        laplacianTotal += laplacian * laplacian
        laplacianSamples += 1
      }
    }
    const sharpness = laplacianSamples ? laplacianTotal / laplacianSamples : 0
    const warnings: string[] = []
    if (luminance < 58) warnings.push('ছবিটি বেশ অন্ধকার মনে হচ্ছে। আলো বাড়িয়ে আবার ছবি তুললে NID-এর লেখা পরিষ্কার দেখা যাবে।')
    if (luminance > 232) warnings.push('ছবিটি বেশি উজ্জ্বল বা overexposed মনে হচ্ছে। flash/glare এড়িয়ে আবার ছবি তুলুন।')
    if (luminance >= 58 && luminance <= 232 && sharpness < 32) warnings.push('ছবিটি কিছুটা ঝাপসা মনে হচ্ছে। ফোন স্থির রেখে বা camera focus করে আবার ছবি তুলুন।')
    return { warnings, luminance, sharpness }
  } catch {
    return null
  }
}
