import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Phone, Building2, Shield, Lock, LogOut, ChevronRight, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { API_CONFIG } from '../../config/api.config'

export default function AgentProfile() {
  const navigate = useNavigate()
  const authUser = useAuthStore((s) => s.user)
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([])
  const [showChangePin, setShowChangePin] = useState(false)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [pinError, setPinError] = useState('')
  const [pinSuccess, setPinSuccess] = useState('')
  const [pinLoading, setPinLoading] = useState(false)

  useEffect(() => {
    // Companies may be stored as extra data on the user object
    const u = authUser as any
    if (u?.companies) setCompanies(u.companies)
  }, [authUser])

  const handleLogout = () => {
    useAuthStore.getState().logout()
    localStorage.removeItem('token')
    navigate('/auth/mobile-login')
  }

  const handleChangePin = async () => {
    setPinError('')
    setPinSuccess('')

    if (currentPin.length < 4) { setPinError('Enter your current PIN (4-6 digits)'); return }
    if (newPin.length < 4) { setPinError('New PIN must be 4-6 digits'); return }
    if (newPin !== confirmPin) { setPinError('PINs do not match'); return }

    setPinLoading(true)
    try {
      const token = useAuthStore.getState().tokens?.access_token || localStorage.getItem('token')
      const res = await fetch(`${API_CONFIG.BASE_URL}/agent/change-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_pin: currentPin, new_pin: newPin })
      })
      const data = await res.json()
      if (data.success) {
        setPinSuccess('PIN changed successfully')
        setCurrentPin('')
        setNewPin('')
        setConfirmPin('')
        setTimeout(() => { setShowChangePin(false); setPinSuccess('') }, 2000)
      } else {
        setPinError(data.message || 'Failed to change PIN')
      }
    } catch {
      setPinError('Network error')
    } finally {
      setPinLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#06090F] pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#0A1628] to-[#0F2140] px-5 pt-8 pb-6 text-center">
        <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-[#00E87B]/30">
          <User className="w-10 h-10 text-[#00E87B]" />
        </div>
        <h1 className="text-xl font-bold text-white">{authUser?.first_name && authUser?.last_name ? authUser.first_name + ' ' + authUser.last_name : (authUser as any)?.name || 'Agent'}</h1>
        <p className="text-sm text-gray-400 capitalize">{(authUser?.role || 'agent').replace('_', ' ')}</p>
      </div>

      <div className="px-5 pt-4 space-y-3">
        {/* Info Cards */}
        <div className="bg-white/5 border border-white/10 rounded-xl divide-y divide-white/5">
          <InfoRow icon={<Phone className="w-4 h-4 text-blue-400" />} label="Phone" value={authUser?.phone || 'Not set'} />
          <InfoRow icon={<Shield className="w-4 h-4 text-purple-400" />} label="Role" value={(authUser?.role || 'agent').replace('_', ' ')} />
          <InfoRow icon={<Building2 className="w-4 h-4 text-emerald-400" />} label="Companies" value={companies.length > 0 ? companies.map(c => c.name).join(', ') : 'None assigned'} />
        </div>

        {/* Change PIN */}
        <button
          onClick={() => setShowChangePin(!showChangePin)}
          className="w-full bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between active:bg-white/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-amber-400" />
            <span className="text-sm text-white font-medium">Change PIN</span>
          </div>
          <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${showChangePin ? 'rotate-90' : ''}`} />
        </button>

        {showChangePin && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
            {pinError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-300">{pinError}</p>
              </div>
            )}
            {pinSuccess && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                <p className="text-xs text-green-300">{pinSuccess}</p>
              </div>
            )}
            <PinInput label="Current PIN" value={currentPin} onChange={setCurrentPin} show={showCurrent} toggle={() => setShowCurrent(!showCurrent)} />
            <PinInput label="New PIN" value={newPin} onChange={setNewPin} show={showNew} toggle={() => setShowNew(!showNew)} />
            <PinInput label="Confirm New PIN" value={confirmPin} onChange={setConfirmPin} show={showNew} toggle={() => setShowNew(!showNew)} />
            <button
              onClick={handleChangePin}
              disabled={pinLoading}
              className="w-full py-2.5 bg-[#00E87B] text-[#0A1628] font-semibold rounded-xl text-sm disabled:opacity-50"
            >
              {pinLoading ? 'Updating...' : 'Update PIN'}
            </button>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 active:bg-red-500/20 transition-colors"
        >
          <LogOut className="w-5 h-5 text-red-400" />
          <span className="text-sm text-red-400 font-medium">Sign Out</span>
        </button>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      {icon}
      <div className="flex-1">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-white capitalize">{value}</p>
      </div>
    </div>
  )
}

function PinInput({ label, value, onChange, show, toggle }: { label: string; value: string; onChange: (v: string) => void; show: boolean; toggle: () => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').substring(0, 6))}
          className="w-full pl-3 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm tracking-[0.3em] focus:outline-none focus:border-[#00E87B]/50"
        />
        <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
