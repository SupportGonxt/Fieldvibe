import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Check, Loader2, X, Zap, ArrowLeft, Flame } from 'lucide-react'
import { apiClient } from '../../services/api.service'
import { fieldOperationsService } from '../../services/field-operations.service'
import { useToast } from '../../components/ui/Toast'
import { useAuthStore } from '../../store/auth.store'
import { idError, type IdType } from '../../utils/sa-id'

// Goldrush single-screen fast-entry: snap the system photo, OCR auto-fills the
// Goldrush ID + name, agent confirms phone + conversion, submit. Optimised for
// banging out signups back-to-back — form resets and keeps a session counter so
// the hero can see their run climb. Reuses the proven /visits/workflow path and
// the server-side /field-ops/verify-goldrush-photo OCR (no on-device model).

type PhotoState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'done'; hasBtag: boolean | null; extractedId: string | null }
  | { status: 'unreadable' }

// ponytail: hash first 5KB only — matches VisitCreate's dup-detection hash, good enough
async function photoHash(dataUrl: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dataUrl.slice(0, 5000)))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function compress(dataUrl: string, maxWidth = 1280, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const scale = Math.min(1, maxWidth / img.width)
        const canvas = document.createElement('canvas')
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(dataUrl)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch { resolve(dataUrl) }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

function errMessage(err: unknown): string {
  const e = err as { response?: { data?: { message?: string; error?: string } }; message?: string }
  return e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Could not save signup'
}

export default function GoldrushFastEntry() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const authUser = useAuthStore(s => s.user)

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyReady, setCompanyReady] = useState(false)

  const [photo, setPhoto] = useState<{ dataUrl: string; hash: string } | null>(null)
  const [photoState, setPhotoState] = useState<PhotoState>({ status: 'idle' })
  const [btagAck, setBtagAck] = useState(false)      // agent confirmed "no B-Tag" issue
  const [mismatchAck, setMismatchAck] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [idType, setIdType] = useState<IdType>('sa_id')
  const [idNumber, setIdNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [goldrushId, setGoldrushId] = useState('')
  const [converted, setConverted] = useState<'Yes' | 'No' | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dupField, setDupField] = useState<'id_number' | 'phone' | 'goldrush_id' | null>(null)
  const submitIdRef = useRef<string>('')
  const gpsRef = useRef<{ latitude: number; longitude: number } | null>(null)

  const [sessionCount, setSessionCount] = useState(0)

  // Find the Goldrush company for this agent (exception-branch gate).
  useEffect(() => {
    let mounted = true
    const findGoldrush = (list: unknown): string | null => {
      if (!Array.isArray(list)) return null
      const g = list.find((c: { name?: string }) => (c?.name || '').toLowerCase().includes('goldrush'))
      return g?.id || null
    }
    ;(async () => {
      try {
        const res = await apiClient.get('/agent/my-companies')
        let id = findGoldrush(res?.data?.data || res?.data)
        if (!id) {
          const dash = await apiClient.get('/agent/dashboard')
          id = findGoldrush(dash?.data?.data?.companies || dash?.data?.companies)
        }
        if (mounted) { setCompanyId(id); setCompanyReady(true) }
      } catch {
        if (mounted) setCompanyReady(true)
      }
    })()
    return () => { mounted = false }
  }, [])

  // Grab GPS in the background — nice to have, never blocks the signup.
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      p => { gpsRef.current = { latitude: p.coords.latitude, longitude: p.coords.longitude } },
      () => {}, { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [])

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBtagAck(false); setMismatchAck(false)
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = await compress(reader.result as string)
      const hash = await photoHash(dataUrl)
      setPhoto({ dataUrl, hash })
      setPhotoState({ status: 'checking' })
      try {
        const res = await apiClient.post('/field-ops/verify-goldrush-photo', { photo_data: dataUrl })
        const { extracted_id, has_btag, extracted_first_name, extracted_last_name } = res.data || {}
        if (extracted_first_name && !firstName) setFirstName(extracted_first_name)
        if (extracted_last_name && !lastName) setLastName(extracted_last_name)
        if (extracted_id) setGoldrushId(String(extracted_id).replace(/\D/g, '').slice(0, 9))
        setPhotoState(extracted_id
          ? { status: 'done', hasBtag: has_btag ?? null, extractedId: String(extracted_id) }
          : { status: 'unreadable' })
      } catch {
        setPhotoState({ status: 'unreadable' })
      }
    }
    reader.readAsDataURL(file)
    e.target.value = '' // allow re-pick of same file
  }

  const idErr = idNumber ? idError(idType, idNumber) : null
  const grErr = goldrushId && goldrushId.length !== 9 ? 'Goldrush ID must be exactly 9 digits' : null
  const photoIdMismatch = photoState.status === 'done' && photoState.extractedId != null &&
    goldrushId.length === 9 && photoState.extractedId.replace(/\D/g, '') !== goldrushId
  const noBtag = photoState.status === 'done' && photoState.hasBtag === false

  const canSubmit = !!firstName.trim() && !!lastName.trim() && goldrushId.length === 9 &&
    !idErr && converted !== null && !submitting &&
    (!photoIdMismatch || mismatchAck) && (!noBtag || btagAck)

  const resetForm = () => {
    setPhoto(null); setPhotoState({ status: 'idle' })
    setFirstName(''); setLastName(''); setIdNumber(''); setPhone(''); setGoldrushId('')
    setConverted(null); setBtagAck(false); setMismatchAck(false)
    setError(null); setDupField(null)
    submitIdRef.current = ''
  }

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true); setError(null); setDupField(null)
    if (!submitIdRef.current) submitIdRef.current = crypto.randomUUID()
    try {
      const payload: Parameters<typeof fieldOperationsService.createVisitWorkflow>[0] & Record<string, unknown> = {
        visit_target_type: 'individual',
        company_id: companyId || undefined,
        client_visit_id: submitIdRef.current,
        checkin_latitude: gpsRef.current?.latitude,
        checkin_longitude: gpsRef.current?.longitude,
        individual_first_name: firstName.trim(),
        individual_last_name: lastName.trim(),
        individual_id_number: idNumber.trim() || undefined,
        individual_phone: phone.trim() || undefined,
        custom_field_values: {
          goldrush_id_entry: goldrushId,
          consumer_converted: converted as string,
        },
      }
      if (photo) {
        payload.photos = [{
          photo_url: photo.dataUrl,
          photo_hash: photo.hash,
          photo_type: 'goldrush_individual',
          gps_latitude: gpsRef.current?.latitude,
          gps_longitude: gpsRef.current?.longitude,
        }]
      }
      if (photoIdMismatch && mismatchAck) payload.goldrush_photo_mismatch = true
      if (noBtag && btagAck) payload.goldrush_no_btag = true

      const result = await fieldOperationsService.createVisitWorkflow(payload)
      const warnings = result?.validation_warnings as Record<string, string> | undefined
      if (warnings && Object.keys(warnings).length > 0) {
        toast.error('Saved with errors — check the ID/photo', 5000)
      } else {
        toast.success('Signup captured! 🎉')
      }
      setSessionCount(c => c + 1)
      resetForm()
    } catch (err: unknown) {
      const df = (err as { response?: { data?: { duplicate_field?: string } } })?.response?.data?.duplicate_field
      const status = (err as { response?: { status?: number } })?.response?.status
      if (df === 'id_number' || df === 'phone') setDupField(df)
      else if (status === 409) setDupField('goldrush_id')
      const msg = errMessage(err)
      setError(msg)
      toast.error(msg)
      submitIdRef.current = '' // let the next attempt get a fresh id
    } finally {
      setSubmitting(false)
    }
  }

  if (companyReady && !companyId) {
    return (
      <div className="min-h-screen bg-[#06090F] text-white flex flex-col items-center justify-center px-8 text-center">
        <Zap className="w-10 h-10 text-gray-600 mb-4" />
        <p className="text-gray-400">Fast signup is only available for Goldrush agents.</p>
        <button onClick={() => navigate('/agent/dashboard')} className="mt-6 text-[#00E87B] font-semibold">Back to dashboard</button>
      </div>
    )
  }

  const inputCls = 'w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3.5 text-white text-base placeholder-gray-600 focus:outline-none focus:border-[#00E87B]/50'

  return (
    <div className="min-h-screen bg-[#06090F] text-white pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#06090F]/90 backdrop-blur border-b border-white/5 px-5 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/agent/dashboard')} className="p-1 -ml-1 text-gray-400"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1">
          <h1 className="text-lg font-bold leading-tight">Fast Signup</h1>
          <p className="text-[11px] text-gray-500">Snap the photo — we fill the rest</p>
        </div>
        {sessionCount > 0 && (
          <div className="flex items-center gap-1.5 bg-[#00E87B]/10 border border-[#00E87B]/30 rounded-full px-3 py-1.5">
            <Flame className="w-4 h-4 text-[#00E87B]" />
            <span className="text-sm font-bold text-[#00E87B] tabular-nums">{sessionCount}</span>
          </div>
        )}
      </div>

      <div className="px-5 pt-5 space-y-5">
        {sessionCount > 0 && (
          <p className="text-center text-sm text-[#00E87B] font-semibold">
            🔥 {sessionCount} signup{sessionCount > 1 ? 's' : ''} this session — keep the streak going!
          </p>
        )}

        {/* Photo capture */}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-3xl border-2 border-dashed border-white/15 bg-white/[0.03] py-7 flex flex-col items-center gap-2 active:scale-[0.99] transition-transform"
        >
          {photo ? (
            <img src={photo.dataUrl} alt="Goldrush signup" className="h-28 rounded-xl object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-[#00E87B]/15 flex items-center justify-center">
              <Camera className="w-7 h-7 text-[#00E87B]" />
            </div>
          )}
          <span className="text-sm font-semibold">{photo ? 'Retake photo' : 'Snap the Goldrush screen'}</span>
        </button>

        {photoState.status === 'checking' && (
          <div className="flex items-center gap-2 text-sm text-gray-400 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Reading the photo…
          </div>
        )}
        {photoState.status === 'unreadable' && photo && (
          <p className="text-center text-sm text-amber-400">Couldn't read it — type the details below.</p>
        )}

        {/* Form */}
        <div className="grid grid-cols-2 gap-3">
          <input className={inputCls} placeholder="First name" value={firstName} onChange={e => setFirstName(e.target.value)} autoCapitalize="words" />
          <input className={inputCls} placeholder="Surname" value={lastName} onChange={e => setLastName(e.target.value)} autoCapitalize="words" />
        </div>

        {/* ID type toggle + number */}
        <div>
          <div className="flex gap-2 mb-2">
            {(['sa_id', 'passport'] as IdType[]).map(t => (
              <button key={t} type="button" onClick={() => setIdType(t)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${idType === t ? 'bg-[#00E87B]/15 border-[#00E87B]/40 text-[#00E87B]' : 'bg-white/[0.03] border-white/10 text-gray-400'}`}>
                {t === 'sa_id' ? 'SA ID' : 'Passport'}
              </button>
            ))}
          </div>
          <input
            className={`${inputCls} ${dupField === 'id_number' ? 'border-red-500/60' : ''}`}
            placeholder={idType === 'sa_id' ? 'ID number (13 digits)' : 'Passport number'}
            inputMode={idType === 'sa_id' ? 'numeric' : 'text'}
            value={idNumber}
            onChange={e => { setDupField(null); setIdNumber(idType === 'sa_id' ? e.target.value.replace(/\D/g, '').slice(0, 13) : e.target.value.toUpperCase()) }}
          />
          {idErr && <p className="text-xs text-amber-400 mt-1.5">{idErr}</p>}
          {dupField === 'id_number' && <p className="text-xs text-red-400 mt-1.5">This ID is already registered.</p>}
        </div>

        <div>
          <input
            className={`${inputCls} ${dupField === 'phone' ? 'border-red-500/60' : ''}`}
            placeholder="Phone (optional)" inputMode="tel" value={phone}
            onChange={e => { setDupField(null); setPhone(e.target.value) }}
          />
          {dupField === 'phone' && <p className="text-xs text-red-400 mt-1.5">This phone is already registered.</p>}
        </div>

        {/* Goldrush ID */}
        <div>
          <input
            className={`${inputCls} tracking-widest font-mono ${grErr || dupField === 'goldrush_id' ? 'border-red-500/60' : goldrushId.length === 9 ? 'border-[#00E87B]/50' : ''}`}
            placeholder="Goldrush ID (9 digits)" inputMode="numeric" value={goldrushId}
            onChange={e => { setDupField(null); setGoldrushId(e.target.value.replace(/\D/g, '').slice(0, 9)) }}
          />
          {grErr && <p className="text-xs text-amber-400 mt-1.5">{grErr}</p>}
          {dupField === 'goldrush_id' && <p className="text-xs text-red-400 mt-1.5">This Goldrush ID is already used.</p>}
        </div>

        {/* Conversion — the money question */}
        <div>
          <p className="text-sm font-semibold text-gray-300 mb-2">Did they buy a first voucher?</p>
          <div className="flex gap-3">
            {(['Yes', 'No'] as const).map(v => (
              <button key={v} type="button" onClick={() => setConverted(v)}
                className={`flex-1 py-3.5 rounded-2xl text-base font-bold border transition-colors ${
                  converted === v
                    ? v === 'Yes' ? 'bg-[#00E87B] border-[#00E87B] text-[#06090F]' : 'bg-white/10 border-white/30 text-white'
                    : 'bg-white/[0.03] border-white/10 text-gray-400'}`}>
                {v === 'Yes' ? '✅ Converted' : 'Not yet'}
              </button>
            ))}
          </div>
        </div>

        {/* Photo issue acknowledgements */}
        {photoIdMismatch && (
          <label className="flex items-start gap-2.5 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
            <input type="checkbox" checked={mismatchAck} onChange={e => setMismatchAck(e.target.checked)} className="mt-0.5 accent-amber-400" />
            <span>The ID in the photo ({photoState.status === 'done' ? photoState.extractedId : ''}) doesn't match what I typed. Submit anyway (will be flagged).</span>
          </label>
        )}
        {noBtag && (
          <label className="flex items-start gap-2.5 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
            <input type="checkbox" checked={btagAck} onChange={e => setBtagAck(e.target.checked)} className="mt-0.5 accent-amber-400" />
            <span>No B-Tag found in the photo. Submit anyway (will be flagged in the team-lead report).</span>
          </label>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
            <X className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}
      </div>

      {/* Sticky submit */}
      <div className="fixed bottom-0 inset-x-0 bg-[#06090F]/95 backdrop-blur border-t border-white/5 px-5 py-4">
        <button
          onClick={submit}
          disabled={!canSubmit}
          className={`w-full py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-2 transition-colors ${
            canSubmit ? 'bg-[#00E87B] text-[#06090F] active:scale-[0.99]' : 'bg-white/[0.06] text-gray-600'}`}
        >
          {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving…</> : <><Check className="w-5 h-5" /> Capture signup</>}
        </button>
      </div>
    </div>
  )
}
