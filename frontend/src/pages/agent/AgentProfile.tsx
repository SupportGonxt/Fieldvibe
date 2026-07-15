import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Phone, Building2, Shield, Lock, LogOut, ChevronRight, AlertCircle, CheckCircle2, Eye, EyeOff, LayoutGrid, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore, hasRole } from '../../store/auth.store'
import { apiClient } from '../../services/api.service'
import { APP_VERSION, checkForUpdate } from '../../lib/appUpdate'

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
    // Fetch companies from backend dashboard endpoint (authUser.companies is never populated)
    const fetchCompanies = async () => {
      try {
        const res = await apiClient.get('/agent/dashboard')
        const data = res?.data?.data || res?.data || {}
        const companiesList = data.companies || []
        if (Array.isArray(companiesList) && companiesList.length > 0) {
          setCompanies(companiesList)
        }
      } catch {
        // Fallback: try authUser.companies
        const u = authUser as unknown as Record<string, unknown>
        if (Array.isArray(u?.companies)) setCompanies(u.companies as Array<{ id: string; name: string }>)
      }
    }
    fetchCompanies()
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
      const res = await apiClient.post('/agent/change-pin', { current_pin: currentPin, new_pin: newPin })
      const data = res.data
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
    <div className="min-h-screen bg-bg pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-surface to-[#0F2140] px-5 pt-8 pb-6 text-center">
        <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-primary/30">
          <User className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-token">{authUser?.first_name && authUser?.last_name ? authUser.first_name + ' ' + authUser.last_name : (authUser as any)?.name || 'Agent'}</h1>
        <p className="text-sm text-token-muted capitalize">{(authUser?.role || 'agent').replace('_', ' ')}</p>
      </div>

      <div className="px-5 pt-4 space-y-3">
        {/* Info Cards */}
        <div className="bg-white/5 border border-token rounded-xl divide-y divide-token">
          <InfoRow icon={<Phone className="w-4 h-4 text-primary" />} label="Phone" value={authUser?.phone || 'Not set'} />
          <InfoRow icon={<Shield className="w-4 h-4 text-primary" />} label="Role" value={(authUser?.role || 'agent').replace('_', ' ')} />
          <InfoRow icon={<Building2 className="w-4 h-4 text-primary" />} label="Companies" value={companies.length > 0 ? companies.map(c => c.name).join(', ') : 'None assigned'} />
        </div>

        {/* My Earnings — own commission/incentive pay, the one rand view every role gets */}
        <button
          onClick={() => navigate('/agent/earnings')}
          className="w-full bg-white/5 border border-token rounded-xl p-4 flex items-center justify-between active:bg-white/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Wallet className="w-5 h-5 text-primary" />
            <div className="text-left">
              <span className="block text-sm text-token font-medium">My Earnings</span>
              <span className="block text-[11px] text-token-faint">Commission &amp; incentive pay history</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-token-faint" />
        </button>

        {/* Change PIN */}
        <button
          onClick={() => setShowChangePin(!showChangePin)}
          className="w-full bg-white/5 border border-token rounded-xl p-4 flex items-center justify-between active:bg-white/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-amber-400" />
            <span className="text-sm text-token font-medium">Change PIN</span>
          </div>
          <ChevronRight className={`w-4 h-4 text-token-faint transition-transform ${showChangePin ? 'rotate-90' : ''}`} />
        </button>

        {showChangePin && (
          <div className="bg-white/5 border border-token rounded-xl p-4 space-y-3">
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
              className="w-full min-h-[44px] py-2.5 bg-primary text-on-primary font-semibold rounded-xl text-sm disabled:opacity-50"
            >
              {pinLoading ? 'Updating...' : 'Update PIN'}
            </button>
          </div>
        )}

        {/* Admin bridge: tenant-admin functions (users, settings, audit) live in the
            desktop console — hasRole covers all admin-equivalent roles, not just 'admin' */}
        {hasRole('admin') && (
          <button
            onClick={() => navigate('/more')}
            className="w-full bg-white/5 border border-token rounded-xl p-4 flex items-center justify-between active:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <LayoutGrid className="w-5 h-5 text-primary" />
              <div className="text-left">
                <span className="block text-sm text-token font-medium">More</span>
                <span className="block text-[11px] text-token-faint">Admin console — users, settings, audit</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-token-faint" />
          </button>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 active:bg-red-500/20 transition-colors"
        >
          <LogOut className="w-5 h-5 text-red-400" />
          <span className="text-sm text-red-400 font-medium">Sign Out</span>
        </button>

        {/* Release version — tap to pull the latest build (SW reloads if one exists) */}
        <button
          onClick={() => { checkForUpdate(); toast('Checking for updates…') }}
          className="w-full text-center py-2 text-[11px] text-gray-600 active:text-token-muted transition-colors"
        >
          FieldVibe v{APP_VERSION} · tap to check for updates
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
        <p className="text-[10px] text-token-faint uppercase tracking-wider">{label}</p>
        <p className="text-sm text-token capitalize">{value}</p>
      </div>
    </div>
  )
}

function PinInput({ label, value, onChange, show, toggle }: { label: string; value: string; onChange: (v: string) => void; show: boolean; toggle: () => void }) {
  return (
    <div>
      <label className="block text-xs text-token-muted mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').substring(0, 6))}
          className="w-full pl-3 pr-10 py-2.5 bg-white/5 border border-token rounded-lg text-token text-sm tracking-[0.3em] focus:outline-none focus:border-primary/50"
        />
        <button type="button" onClick={toggle} className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-token-faint">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
