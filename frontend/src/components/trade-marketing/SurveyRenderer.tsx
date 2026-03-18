import { useState } from 'react'
import { Star, Camera, MapPin } from 'lucide-react'
import { compressPhoto } from '../../utils/photo-compression'

export type QuestionType = 'boolean' | 'rating' | 'text' | 'number' | 'select' | 'multi_select' | 'photo' | 'barcode_scan' | 'gps' | 'signature' | 'slider' | 'date'

export interface SurveyQuestion {
  id: string
  type: QuestionType
  label: string
  required?: boolean
  options?: string[]
  min?: number
  max?: number
  step?: number
  placeholder?: string
  score_weight?: number
}

interface SurveyRendererProps {
  questions: SurveyQuestion[]
  onSubmit: (answers: Record<string, any>) => void
  onCancel?: () => void
  loading?: boolean
}

export default function SurveyRenderer({ questions, onSubmit, onCancel, loading }: SurveyRendererProps) {
  const [answers, setAnswers] = useState<Record<string, any>>({})

  const updateAnswer = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  const handleSubmit = () => {
    const missingRequired = questions.filter(q => q.required && (answers[q.id] === undefined || answers[q.id] === '' || answers[q.id] === null))
    if (missingRequired.length > 0) return
    onSubmit(answers)
  }

  const renderQuestion = (q: SurveyQuestion) => {
    switch (q.type) {
      case 'boolean':
        return (
          <div className="flex gap-3">
            {['Yes', 'No'].map(opt => (
              <button key={opt} onClick={() => updateAnswer(q.id, opt === 'Yes')}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium ${answers[q.id] === (opt === 'Yes') ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700'}`}>
                {opt}
              </button>
            ))}
          </div>
        )

      case 'rating':
        return (
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(star => (
              <button key={star} onClick={() => updateAnswer(q.id, star)}>
                <Star className={`w-8 h-8 ${(answers[q.id] || 0) >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
              </button>
            ))}
          </div>
        )

      case 'text':
        return <textarea rows={3} value={answers[q.id] || ''} onChange={(e) => updateAnswer(q.id, e.target.value)}
          placeholder={q.placeholder || 'Enter your answer...'} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />

      case 'number':
        return <input type="number" value={answers[q.id] || ''} onChange={(e) => updateAnswer(q.id, parseFloat(e.target.value))}
          min={q.min} max={q.max} step={q.step || 1} placeholder={q.placeholder || '0'}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />

      case 'select':
        return (
          <div className="space-y-2">
            {(q.options || []).map(opt => (
              <button key={opt} onClick={() => updateAnswer(q.id, opt)}
                className={`w-full text-left px-3 py-2 rounded-lg border text-sm ${answers[q.id] === opt ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-300 text-gray-700'}`}>
                {opt}
              </button>
            ))}
          </div>
        )

      case 'multi_select':
        return (
          <div className="space-y-2">
            {(q.options || []).map(opt => {
              const selected = (answers[q.id] || []).includes(opt)
              return (
                <button key={opt} onClick={() => {
                  const current = answers[q.id] || []
                  updateAnswer(q.id, selected ? current.filter((v: string) => v !== opt) : [...current, opt])
                }} className={`w-full text-left px-3 py-2 rounded-lg border text-sm ${selected ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-300 text-gray-700'}`}>
                  {opt}
                </button>
              )
            })}
          </div>
        )

      case 'photo':
        return (
          <button onClick={() => {
            const input = document.createElement('input')
            input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment'
            input.onchange = async (e: any) => {
              const file = e.target.files?.[0]
              if (file) {
                try {
                  const { compressed } = await compressPhoto(file)
                  const reader = new FileReader()
                  reader.onload = (ev) => updateAnswer(q.id, ev.target?.result)
                  reader.readAsDataURL(compressed)
                } catch {
                  const reader = new FileReader()
                  reader.onload = (ev) => updateAnswer(q.id, ev.target?.result)
                  reader.readAsDataURL(file)
                }
              }
            }
            input.click()
          }} className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-500">
            {answers[q.id] ? <img src={answers[q.id]} alt="Photo" className="max-h-32 rounded" /> : <><Camera className="w-5 h-5 mr-2" /> Take Photo</>}
          </button>
        )

      case 'gps':
        return (
          <button onClick={() => {
            navigator.geolocation.getCurrentPosition(
              (pos) => updateAnswer(q.id, { lat: pos.coords.latitude, lng: pos.coords.longitude }),
              () => updateAnswer(q.id, { lat: null, lng: null, error: 'GPS unavailable' }),
              { enableHighAccuracy: true }
            )
          }} className="w-full py-3 border border-gray-300 rounded-lg flex items-center justify-center text-sm text-gray-700">
            <MapPin className="w-4 h-4 mr-2" />
            {answers[q.id] ? (answers[q.id].lat != null ? `${answers[q.id].lat.toFixed(4)}, ${answers[q.id].lng.toFixed(4)}` : (answers[q.id].error || 'GPS unavailable')) : 'Capture GPS Location'}
          </button>
        )

      case 'slider':
        return (
          <div>
            <input type="range" min={q.min || 0} max={q.max || 100} step={q.step || 1} value={answers[q.id] || q.min || 0}
              onChange={(e) => updateAnswer(q.id, parseInt(e.target.value))} className="w-full" />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{q.min || 0}</span><span className="font-bold text-gray-900">{answers[q.id] || q.min || 0}</span><span>{q.max || 100}</span>
            </div>
          </div>
        )

      case 'date':
        return <input type="date" value={answers[q.id] || ''} onChange={(e) => updateAnswer(q.id, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />

      case 'barcode_scan':
        return <input type="text" value={answers[q.id] || ''} onChange={(e) => updateAnswer(q.id, e.target.value)}
          placeholder="Scan or enter barcode..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />

      case 'signature':
        return (
          <div className="border border-gray-300 rounded-lg p-4 text-center text-sm text-gray-500">
            <p>Signature capture</p>
            <input type="text" value={answers[q.id] || ''} onChange={(e) => updateAnswer(q.id, e.target.value)}
              placeholder="Type name as signature" className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm italic" />
          </div>
        )

      default:
        return <input type="text" value={answers[q.id] || ''} onChange={(e) => updateAnswer(q.id, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
    }
  }

  return (
    <div className="space-y-4">
      {questions.map((q, idx) => (
        <div key={q.id} className="bg-white border border-gray-100 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            {idx + 1}. {q.label} {q.required && <span className="text-red-500">*</span>}
          </label>
          {renderQuestion(q)}
        </div>
      ))}

      <div className="flex gap-3 pt-4">
        {onCancel && <button onClick={onCancel} className="flex-1 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700">Cancel</button>}
        <button onClick={handleSubmit} disabled={loading}
          className="flex-1 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400">
          {loading ? 'Submitting...' : 'Submit Survey'}
        </button>
      </div>
    </div>
  )
}
