import { useEffect, useState, type ComponentType } from 'react'

// qrcode.react is a runtime dependency (declared in package.json) loaded lazily so the
// visit bundle only pulls the QR renderer when an agent actually reaches a QR step.
type QrProps = { value: string; size?: number; level?: string; marginSize?: number }
let cached: ComponentType<QrProps> | null = null

export function QrImage({ value, size = 220 }: { value: string; size?: number }) {
  const [Comp, setComp] = useState<ComponentType<QrProps> | null>(cached)

  useEffect(() => {
    if (cached) return
    // @ts-ignore -- module types resolve after `npm install qrcode.react`
    import('qrcode.react')
      .then((m) => {
        cached = m.QRCodeSVG as ComponentType<QrProps>
        setComp(() => cached)
      })
      .catch(() => {})
  }, [])

  if (!Comp) {
    return (
      <div
        style={{ width: size, height: size }}
        className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg"
        aria-label="Generating QR code"
      />
    )
  }
  return (
    <div className="bg-white p-3 rounded-lg inline-block">
      <Comp value={value} size={size} level="M" marginSize={2} />
    </div>
  )
}
