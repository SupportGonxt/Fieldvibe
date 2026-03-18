import { useState, useRef } from 'react'
import { Camera, X, Check, Loader2 } from 'lucide-react'
import MobileButton from './MobileButton'
import { compressPhoto } from '../../utils/photo-compression'

interface CameraCaptureProps {
  onPhotoCapture: (photoDataUrl: string) => void
  label?: string
  required?: boolean
}

export default function CameraCapture({
  onPhotoCapture,
  label = 'Take Photo',
  required = false,
}: CameraCaptureProps) {
  const [photo, setPhoto] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)

    try {
      // Compress the photo before reading
      const { compressed } = await compressPhoto(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        setPhoto(result)
        onPhotoCapture(result)
        setLoading(false)
      }
      reader.readAsDataURL(compressed)
    } catch (error) {
      console.error('Error compressing file:', error)
      // Fallback to uncompressed if compression fails
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        setPhoto(result)
        onPhotoCapture(result)
        setLoading(false)
      }
      reader.onerror = () => {
        console.error('FileReader error in fallback path')
        setLoading(false)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCapture = () => {
    fileInputRef.current?.click()
  }

  const handleRemove = () => {
    setPhoto(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      </div>

      {photo ? (
        <div className="relative">
          <img
            src={photo}
            alt="Captured"
            className="w-full h-64 object-cover rounded-lg border-2 border-gray-100"
          />
          <div className="absolute top-2 right-2 flex gap-2">
            <button
              onClick={handleRemove}
              className="p-2 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 active:bg-red-800 transition-colors touch-manipulation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="absolute bottom-2 left-2 right-2 bg-green-600 text-white px-3 py-2 rounded-lg flex items-center gap-2">
            <Check className="h-5 w-5" />
            <span className="text-sm font-medium">Photo captured</span>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <Camera className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600 mb-4">
            {required ? 'Photo required' : 'No photo captured'}
          </p>
          <MobileButton
            onClick={handleCapture}
            loading={loading}
            icon={<Camera className="h-5 w-5" />}
          >
            {loading ? 'Processing...' : 'Take Photo'}
          </MobileButton>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}
