import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { fieldOperationsService } from '../../services/field-operations.service'
import { Building2, Lock, Mail, LogIn } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

export default function CompanyLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const loginMutation = useMutation({
    mutationFn: () => fieldOperationsService.companyLogin(email, password),
    onSuccess: (data: any) => {
      const companyId = data?.company_id || data?.data?.company_id
      if (companyId) {
        localStorage.setItem('company_token', data?.token || data?.data?.token || '')
        localStorage.setItem('company_id', companyId)
        localStorage.setItem('company_name', data?.company_name || data?.data?.company_name || '')
        toast.success(`Logged in as ${data?.company_name || data?.data?.company_name || 'Company'}`)
        navigate(`/company-portal/${companyId}`)
      } else {
        toast.error('Login failed: no company ID returned')
      }
    },
    onError: () => toast.error('Invalid credentials'),
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Company Portal</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Sign in to view your company data and insights</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <form onSubmit={(e) => { e.preventDefault(); if (email && password) loginMutation.mutate() }}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input w-full pl-10"
                    placeholder="company@example.com"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input w-full pl-10"
                    placeholder="Enter your password"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={!email || !password || loginMutation.isPending}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3"
              >
                <LogIn className="w-5 h-5" />
                {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/auth/login')}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              Back to main login
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
