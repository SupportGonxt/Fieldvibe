import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, Lock, ArrowLeft } from 'lucide-react'
import { authService } from '../../services/auth.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

interface ResetPasswordFormData {
  password: string
  password_confirmation: string
}

export default function ResetPasswordPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const token = searchParams.get('token')

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ResetPasswordFormData>()

  const password = watch('password')

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      toast.error('Invalid reset token')
      return
    }

    setIsLoading(true)
    try {
      await authService.resetPassword({
        token,
        password: data.password,
        password_confirmation: data.password_confirmation,
      })
      toast.success('Password reset successfully!')
      navigate('/auth/login')
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset password')
    } finally {
      setIsLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="space-y-6 text-center">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Invalid Reset Link
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            This password reset link is invalid or has expired.
          </p>
        </div>

        <div className="space-y-4">
          <Link
            to="/auth/forgot-password"
            className="block text-center w-full bg-[#00E87B] hover:bg-[#1DFFB2] text-[#06090F] font-semibold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-[#00E87B]/25"
          >
            Request new reset link
          </Link>
          
          <Link
            to="/auth/login"
            className="flex items-center justify-center text-sm text-[#00E87B] hover:text-[#4BFFB5] transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/auth/login"
          className="flex items-center text-sm text-[#00E87B] hover:text-[#4BFFB5] transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to sign in
        </Link>
        
        <h2 className="text-2xl font-bold text-white">
          Reset your password
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Enter your new password below.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        {/* New password field */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
            New password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-slate-500" />
            </div>
            <input
              {...register('password', {
                required: 'Password is required',
                minLength: {
                  value: 8,
                  message: 'Password must be at least 8 characters',
                },
                pattern: {
                  value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                  message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
                },
              })}
              type={showPassword ? 'text' : 'password'}
              className="w-full pl-10 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-[#00E87B] focus:border-[#00E87B] transition-all"
              placeholder="Enter new password"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5 text-slate-500" />
              ) : (
                <Eye className="h-5 w-5 text-slate-500" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1.5 text-sm text-red-400">{errors.password.message}</p>
          )}
        </div>

        {/* Confirm password field */}
        <div>
          <label htmlFor="password_confirmation" className="block text-sm font-medium text-slate-300 mb-2">
            Confirm new password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-slate-500" />
            </div>
            <input
              {...register('password_confirmation', {
                required: 'Please confirm your password',
                validate: (value) =>
                  value === password || 'Passwords do not match',
              })}
              type={showConfirmPassword ? 'text' : 'password'}
              className="w-full pl-10 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-[#00E87B] focus:border-[#00E87B] transition-all"
              placeholder="Confirm new password"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-5 w-5 text-slate-500" />
              ) : (
                <Eye className="h-5 w-5 text-slate-500" />
              )}
            </button>
          </div>
          {errors.password_confirmation && (
            <p className="mt-1.5 text-sm text-red-400">{errors.password_confirmation.message}</p>
          )}
        </div>

        {/* Password requirements */}
        <div className="text-sm text-slate-400">
          <p className="font-medium mb-1">Password requirements:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>At least 8 characters long</li>
            <li>Contains at least one uppercase letter</li>
            <li>Contains at least one lowercase letter</li>
            <li>Contains at least one number</li>
          </ul>
        </div>

        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#00E87B] hover:bg-[#1DFFB2] text-[#06090F] font-semibold py-3.5 px-4 rounded-xl transition-all flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#00E87B]/25"
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" color="white" className="mr-2" />
                Resetting...
              </>
            ) : (
              'Reset password'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
