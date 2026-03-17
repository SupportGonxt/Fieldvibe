import { useState, useRef, useCallback } from 'react'
import { Camera, Upload, X, RefreshCw, CheckCircle } from 'lucide-react'
import { compressPhoto, compressToThumbnail } from '../../utils/photo-compression'
import { tradeMarketingService } from '../../services/insights.service'

interface PhotoCaptureProps {
  visitId: string
  photoType?: string
  onPhotoUploaded?: (photoData: { id: string; r2_key: string }) => void
  onError?: (error: string) => void
}

export default function PhotoCaptureWithCompression({ visitId, photoType = 'general', onPhotoUploaded, onError }: PhotoCaptureProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadedId, setUploadedId] = useState<string | null>(null)
  const [compressionInfo, setCompressionInfo] = useState<{ original: number; compressed: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      onError?.('Please select an image file')
      return
    }

    let objectUrl: string | undefined
    try {
      setUploading(true)
      objectUrl = URL.createObjectURL(file)
      setPreview(objectUrl)

      const { compressed, originalSize, compressedSize } = await compressPhoto(file)
      setCompressionInfo({ original: originalSize, compressed: compressedSize })

      const thumbnail = await compressToThumbnail(file)

      let latitude: number | null = null
      let longitude: number | null = null
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        )
        latitude = pos.coords.latitude
        longitude = pos.coords.longitude
      } catch { /* GPS unavailable */ }

      const formData = new FormData()
      formData.append('photo', compressed, 'photo.jpg')
      formData.append('thumbnail', thumbnail, 'thumb.jpg')
      formData.append('visit_id', visitId)
      formData.append('photo_type', photoType)
      formData.append('original_size', String(originalSize))
      if (latitude !== null) formData.append('latitude', String(latitude))
      if (longitude !== null) formData.append('longitude', String(longitude))

      const result = await tradeMarketingService.uploadPhoto(formData)
      setUploadedId(result.id)
      onPhotoUploaded?.(result)
    } catch (err: any) {
      onError?.(err.message || 'Upload failed')
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setPreview(null)
    } finally {
      setUploading(false)
    }
  }, [visitId, photoType, onPhotoUploaded, onError])

  const handleCapture = () => fileInputRef.current?.click()

  const handleReset = () => {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setUploadedId(null)
    setCompressionInfo(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const formatSize = (bytes: number) => bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`

  return (
    <div className="space-y-3">
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />

      {!preview ? (
        <button onClick={handleCapture} disabled={uploading}
          className="w-full py-8 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:border-blue-500 hover:text-blue-600 transition-colors">
          <Camera className="w-8 h-8 mb-2" />
          <span className="text-sm font-medium">Capture Photo</span>
          <span className="text-xs text-gray-400 mt-1">Auto-compressed for upload</span>
        </button>
      ) : (
        <div className="relative">
          <img src={preview} alt="Captured" className="w-full rounded-xl" />

          {uploading && (
            <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
              <div className="text-white text-center">
                <Upload className="w-8 h-8 mx-auto mb-2 animate-bounce" />
                <p className="text-sm">Uploading & analyzing...</p>
              </div>
            </div>
          )}

          {uploadedId && (
            <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded-lg text-xs flex items-center">
              <CheckCircle className="w-3 h-3 mr-1" /> Uploaded
            </div>
          )}

          <div className="absolute top-2 right-2 flex gap-2">
            <button onClick={handleReset} className="bg-red-500 text-white p-2 rounded-lg">
              <X className="w-4 h-4" />
            </button>
            {uploadedId && (
              <button onClick={() => tradeMarketingService.reanalyzePhoto(uploadedId)} className="bg-blue-500 text-white p-2 rounded-lg">
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>

          {compressionInfo && (
            <div className="mt-2 text-xs text-gray-500 flex justify-between">
              <span>Original: {formatSize(compressionInfo.original)}</span>
              <span>Compressed: {formatSize(compressionInfo.compressed)}</span>
              <span className="text-green-600">Saved {Math.round((1 - compressionInfo.compressed / compressionInfo.original) * 100)}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
