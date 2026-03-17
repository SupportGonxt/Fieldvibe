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

export async function compressToThumbnail(file: File): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: 0.05,
    maxWidthOrHeight: 200,
    useWebWorker: true,
    fileType: 'image/jpeg',
  })
}
