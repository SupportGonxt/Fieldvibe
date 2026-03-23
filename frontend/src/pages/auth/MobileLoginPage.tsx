import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, Lock, Eye, EyeOff, Loader2, AlertCircle, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { API_CONFIG } from '../../config/api.config'

const MobileLoginPage: React.FC = () => {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const pinRef = useRef<HTMLInputElement>(null)

  // PIN change state
  const [mustChangePin, setMustChangePin] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showNewPin, setShowNewPin] = useState(false)
  const [pinChangeLoading, setPinChangeLoading] = useState(false)
  const [pinChangeError, setPinChangeError] = useState('')

  useEffect(() => {
    const { isAuthenticated, user } = useAuthStore.getState()
    if (isAuthenticated && user) {
      const role = user.role
      if (role && ['agent', 'team_lead', 'field_agent', 'sales_rep', 'manager'].includes(role)) {
        navigate('/agent/dashboard')
        return
      }
    }
  }, [navigate])

  const formatPhone = (value: string): string => {
    const cleaned = value.replace(/[^\d+]/g, '')
    if (!cleaned.startsWith('+27') && cleaned.length > 0) {
      if (cleaned.startsWith('0')) return '+27' + cleaned.substring(1)
      if (cleaned.startsWith('27')) return '+' + cleaned
      return '+27' + cleaned
    }
    return cleaned
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value))
    setError('')
  }

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, 6)
    setPin(value)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!phone || phone.length < 10) {
      setError('Please enter a valid phone number')
      setLoading(false)
      triggerShake()
      return
    }
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits')
      setLoading(false)
      triggerShake()
      return
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/mobile-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin })
      })

      const data = await response.json()

      if (data.success && data.data) {
        const { user, token, access_token, must_change_pin } = data.data
        const accessToken = token || access_token
        localStorage.setItem('token', accessToken)
        // Cache companies from login response so VisitCreate can use them as fallback
        const loginCompanies = data.data.companies || []
        if (Array.isArray(loginCompanies) && loginCompanies.length > 0) {
          localStorage.setItem('agent_companies', JSON.stringify(loginCompanies))
        }
        // Update zustand auth store so ProtectedRoute recognizes the session
        useAuthStore.setState({
          user: {
            id: user.id,
            email: user.email || '',
            first_name: user.firstName || '',
            last_name: user.lastName || '',
            role: user.role,
            phone: user.phone,
            status: user.status || 'active',
            permissions: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any,
          tokens: data.data.tokens || { access_token: accessToken, refresh_token: '', expires_in: 86400, token_type: 'Bearer' },
          isAuthenticated: true,
        })

        if (must_change_pin) {
          // Show PIN change screen before allowing access
          setMustChangePin(true)
          return
        }

        navigate('/agent/dashboard')
      } else {
        setError(data.message || 'Login failed')
        triggerShake()
      }
    } catch (err) {
      setError('Unable to connect. Check your internet connection.')
      triggerShake()
      console.error('Login error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePinChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPinChangeError('')

    if (newPin.length < 4 || newPin.length > 6) {
      setPinChangeError('New PIN must be 4-6 digits')
      triggerShake()
      return
    }
    if (newPin === '12345') {
      setPinChangeError('Please choose a different PIN from the default')
      triggerShake()
      return
    }
    if (newPin !== confirmPin) {
      setPinChangeError('PINs do not match')
      triggerShake()
      return
    }

    setPinChangeLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_CONFIG.BASE_URL}/agent/change-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ current_pin: '12345', new_pin: newPin })
      })

      const data = await response.json()
      if (data.success) {
        navigate('/agent/dashboard')
      } else {
        setPinChangeError(data.message || 'Failed to change PIN')
        triggerShake()
      }
    } catch (err) {
      setPinChangeError('Unable to connect. Check your internet connection.')
      triggerShake()
      console.error('PIN change error:', err)
    } finally {
      setPinChangeLoading(false)
    }
  }

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 600)
  }

  // PIN Change Screen
  if (mustChangePin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A1628] via-[#0F2140] to-[#162D50] flex flex-col">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#00E87B]/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full translate-y-1/3 -translate-x-1/4 blur-2xl" />

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 relative z-10">
          <div className="mb-6 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Set Your PIN</h1>
            <p className="text-sm text-gray-400 mt-2 max-w-xs mx-auto">
              Welcome! For your security, please set a new PIN to replace the default.
            </p>
          </div>

          <div className={`w-full max-w-sm ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-2xl">
              {pinChangeError && (
                <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{pinChangeError}</p>
                </div>
              )}

              <form onSubmit={handlePinChangeSubmit} className="space-y-5">
                {/* New PIN */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">New PIN</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type={showNewPin ? 'text' : 'password'}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={newPin}
                      onChange={(e) => { setNewPin(e.target.value.replace(/\D/g, '').substring(0, 6)); setPinChangeError('') }}
                      placeholder="Enter new PIN"
                      autoFocus
                      className="w-full pl-11 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#00E87B]/50 focus:ring-1 focus:ring-[#00E87B]/30 transition-all text-base tracking-[0.3em]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPin(!showNewPin)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showNewPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">4-6 digits, must be different from 12345</p>
                </div>

                {/* Confirm PIN */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Confirm PIN</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type={showNewPin ? 'text' : 'password'}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={confirmPin}
                      onChange={(e) => { setConfirmPin(e.target.value.replace(/\D/g, '').substring(0, 6)); setPinChangeError('') }}
                      placeholder="Confirm new PIN"
                      className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#00E87B]/50 focus:ring-1 focus:ring-[#00E87B]/30 transition-all text-base tracking-[0.3em]"
                    />
                  </div>
                </div>

                {/* PIN match indicator */}
                {newPin.length >= 4 && confirmPin.length >= 4 && (
                  <div className={`text-xs font-medium ${newPin === confirmPin ? 'text-[#00E87B]' : 'text-red-400'}`}>
                    {newPin === confirmPin ? 'PINs match' : 'PINs do not match'}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={pinChangeLoading || newPin.length < 4 || confirmPin.length < 4 || newPin !== confirmPin}
                  className="w-full py-3.5 bg-gradient-to-r from-[#00E87B] to-[#00D06E] text-[#0A1628] font-semibold rounded-xl shadow-lg shadow-[#00E87B]/20 hover:shadow-[#00E87B]/30 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed transition-all active:scale-[0.98] text-base"
                >
                  {pinChangeLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Setting PIN...
                    </span>
                  ) : (
                    'Set New PIN'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="pb-6 text-center relative z-10">
          <p className="text-xs text-gray-600">A Product of <span className="text-gray-500">GONXT</span></p>
        </div>

        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
            20%, 40%, 60%, 80% { transform: translateX(4px); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A1628] via-[#0F2140] to-[#162D50] flex flex-col">
      {/* Decorative blurs */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#00E87B]/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full translate-y-1/3 -translate-x-1/4 blur-2xl" />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 relative z-10">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-[#00E87B] to-[#00B86B] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#00E87B]/20">
            <span className="text-2xl font-black text-[#0A1628]">FV</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">FieldVibe</h1>
          <p className="text-sm text-gray-400 mt-1">Agent Login</p>
        </div>

        {/* Login Card */}
        <div className={`w-full max-w-sm ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-2xl">
            {error && (
              <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Phone */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="+27 82 000 0001"
                    autoFocus
                    autoComplete="tel"
                    className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#00E87B]/50 focus:ring-1 focus:ring-[#00E87B]/30 transition-all text-base"
                  />
                </div>
              </div>

              {/* PIN */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">PIN Code</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    ref={pinRef}
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={pin}
                    onChange={handlePinChange}
                    placeholder="Enter PIN"
                    autoComplete="one-time-code"
                    className="w-full pl-11 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#00E87B]/50 focus:ring-1 focus:ring-[#00E87B]/30 transition-all text-base tracking-[0.3em]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1.5">4-6 digit PIN from your manager</p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !phone || pin.length < 4}
                className="w-full py-3.5 bg-gradient-to-r from-[#00E87B] to-[#00D06E] text-[#0A1628] font-semibold rounded-xl shadow-lg shadow-[#00E87B]/20 hover:shadow-[#00E87B]/30 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed transition-all active:scale-[0.98] text-base"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-gray-500 hover:text-[#00E87B] transition-colors"
            >
              Admin / Manager Login
            </button>
          </div>
        </div>
      </div>

      {/* Bottom branding */}
      <div className="pb-6 text-center relative z-10">
        <p className="text-xs text-gray-600">A Product of <span className="text-gray-500">GONXT</span></p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  )
}

export default MobileLoginPage
