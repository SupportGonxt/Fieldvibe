import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Mail, ArrowLeft } from 'lucide-react'
import { authService } from '../../services/auth.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

interface ForgotPasswordFormData {
  email: string
}

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<ForgotPasswordFormData>()

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true)
    try {
      await authService.forgotPassword(data)
      setIsSubmitted(true)
      toast.success('Password reset email sent!')
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reset email')
    } finally {
      setIsLoading(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="space-y-6 text-center">
        <div>
          <div className="mx-auto h-12 w-12 bg-[#00E87B]/20 rounded-full flex items-center justify-center">
            <Mail className="h-6 w-6 text-[#00E87B]" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-white">
            Check your email
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            We've sent a password reset link to{' '}
            <span className="font-medium">{getValues('email')}</span>
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Didn't receive the email? Check your spam folder or try again.
          </p>
          
          <button
            onClick={() => setIsSubmitted(false)}
            className="btn-outline w-full"
          >
            Try again
          </button>
          
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
          Forgot your password?
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          No worries! Enter your email address and we'll send you a link to reset your password.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
            Email address
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
              placeholder="Enter your email"
              autoComplete="email"
            />
          </div>
          {errors.email && (
            <p className="mt-1.5 text-sm text-red-400">{errors.email.message}</p>
          )}
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
                Sending...
              </>
            ) : (
              'Send reset link'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
