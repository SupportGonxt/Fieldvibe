import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

interface LoginFormData {
  email: string
  password: string
  remember_me: boolean
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [isFormVisible, setIsFormVisible] = useState(false)
  const { login, isLoading, error, clearError } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const from = location.state?.from?.pathname || '/dashboard'

  useEffect(() => {
    setIsFormVisible(true)
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    defaultValues: {
      email: '',
      password: '',
      remember_me: false,
    },
  })

  const onSubmit = async (data: LoginFormData) => {
    try {
      clearError()
      await login(data)
      toast.success('Welcome back!')
      navigate(from, { replace: true })
    } catch (error: any) {
      toast.error(error.message || 'Login failed')
    }
  }

  return (
    <div className={`space-y-6 transition-all duration-500 ease-out ${isFormVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white">
          Welcome Back
        </h2>
        <p className="mt-3 text-base text-slate-400">
          Sign in to your account
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        {/* Email field */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-slate-500" />
            </div>
            <input
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address',
                },
              })}
              type="email"
              className="w-full pl-10 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-[#00E87B] focus:border-[#00E87B] transition-all"
              placeholder="you@company.com"
              autoComplete="email"
            />
          </div>
          {errors.email && (
            <p className="mt-1.5 text-sm text-red-400">{errors.email.message}</p>
          )}
        </div>

        {/* Password field */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-slate-500" />
            </div>
            <input
              {...register('password', {
                required: 'Password is required',
                minLength: {
                  value: 6,
                  message: 'Password must be at least 6 characters',
                },
              })}
              type={showPassword ? 'text' : 'password'}
              className="w-full pl-10 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-[#00E87B] focus:border-[#00E87B] transition-all"
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1.5 text-sm text-red-400">{errors.password.message}</p>
          )}
        </div>

        {/* Remember me and forgot password */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              {...register('remember_me')}
              id="remember-me"
              type="checkbox"
              className="h-4 w-4 bg-white/5 border-white/10 rounded text-[#00E87B] focus:ring-[#00E87B] focus:ring-offset-[#06090F] transition-colors"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-400 hover:text-slate-300 transition-colors">
              Remember me
            </label>
          </div>

          <div className="text-sm">
            <Link
              to="/auth/forgot-password"
              className="font-medium text-[#00E87B] hover:text-[#4BFFB5] transition-colors"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
            <div className="text-sm text-red-400">{error}</div>
          </div>
        )}

        {/* Submit button */}
        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#00E87B] hover:bg-[#1DFFB2] text-[#06090F] font-semibold py-3.5 px-4 rounded-xl transition-all flex justify-center items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#00E87B]/25 hover:shadow-[#00E87B]/40"
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" color="white" className="mr-2" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Mobile Login Link */}
      <div className="mt-6 text-center">
        <Link
          to="/auth/mobile-login"
          className="text-sm text-[#00E87B] hover:text-[#4BFFB5] font-medium transition-colors"
        >
          Agent? Login with mobile number →
        </Link>
      </div>
    </div>
  )
}
