import imageCompression from 'browser-image-compression'

export async function compressPhoto(file: File, options?: {
  maxWidth?: number; quality?: number; maxSizeMB?: number;
}): Promise<{ compressed: File; originalSize: number; compressedSize: number }> {
  const originalSize = file.size
  const compressed = await imageCompression(file, {
    maxSizeMB: options?.maxSizeMB || 1,
    maxWidthOrHeight: options?.maxWidth || 1200,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: options?.quality || 0.75,
  })
  return { compressed, originalSize, compressedSize: compressed.size }
}

// Canvas-compress a data URI down to a bounded JPEG. Used where a photo has to
// travel inside a form value rather than as its own upload (e.g. the per-product
// audit photos, several of which ride along in one questionnaire answer), so the
// defaults are tighter than a standalone visit photo's. Returns the input
// unchanged if the image can't be decoded — a photo is never dropped silently.
export function compressDataUrl(dataUrl: string, maxWidth = 800, quality = 0.6): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(dataUrl); return }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export async function compressToThumbnail(file: File): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: 0.05,
    maxWidthOrHeight: 200,
    useWebWorker: true,
    fileType: 'image/jpeg',
  })
}
