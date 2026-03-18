import { ApiService } from './api.service'

export interface KYCSubmission {
  id: string
  tenant_id: string
  customer_id: string
  customer_name: string
  customer_code: string
  agent_id: string
  agent_name: string
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'requires_update'
  submission_date: string
  review_date?: string
  reviewed_by?: string
  documents: KYCDocument[]
  personal_info: PersonalInfo
  business_info?: BusinessInfo
  financial_info: FinancialInfo
  references: Reference[]
  verification_status: VerificationStatus
  notes?: string
  rejection_reason?: string
  created_at: string
  updated_at: string
}

export interface KYCDocument {
  id: string
  type: 'id_document' | 'proof_of_address' | 'business_registration' | 'tax_certificate' | 'bank_statement' | 'other'
  name: string
  file_url: string
  file_size: number
  mime_type: string
  status: 'pending' | 'verified' | 'rejected'
  uploaded_at: string
  verified_at?: string
  verified_by?: string
  rejection_reason?: string
}

export interface PersonalInfo {
  first_name: string
  last_name: string
  id_number: string
  date_of_birth: string
  nationality: string
  phone_number: string
  email: string
  address: Address
  employment_status: 'employed' | 'self_employed' | 'unemployed' | 'retired'
  occupation?: string
  employer?: string
}

export interface BusinessInfo {
  business_name: string
  registration_number: string
  tax_number: string
  business_type: 'sole_proprietorship' | 'partnership' | 'corporation' | 'llc' | 'other'
  industry: string
  years_in_business: number
  number_of_employees: number
  annual_revenue: number
  business_address: Address
}

export interface FinancialInfo {
  monthly_income: number
  annual_income: number
  credit_score?: number
  existing_credit_facilities: CreditFacility[]
  bank_accounts: BankAccount[]
  requested_credit_limit: number
  purpose_of_credit: string
}

export interface Address {
  street: string
  city: string
  state: string
  postal_code: string
  country: string
}

export interface Reference {
  name: string
  relationship: string
  phone_number: string
  email?: string
  address?: string
  years_known: number
}

export interface CreditFacility {
  institution: string
  type: 'credit_card' | 'loan' | 'overdraft' | 'other'
  limit: number
  outstanding_balance: number
  monthly_payment: number
}

export interface BankAccount {
  bank_name: string
  account_type: 'checking' | 'savings' | 'business'
  account_number: string
  years_with_bank: number
}

export interface VerificationStatus {
  identity_verified: boolean
  address_verified: boolean
  income_verified: boolean
  credit_check_completed: boolean
  references_verified: boolean
  overall_score: number
  risk_level: 'low' | 'medium' | 'high'
}

export interface KYCFilter {
  search?: string
  status?: string
  agent_id?: string
  customer_id?: string
  risk_level?: string
  start_date?: string
  end_date?: string
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface KYCStats {
  total_submissions: number
  pending_submissions: number
  approved_submissions: number
  rejected_submissions: number
  approval_rate: number
  average_processing_time: number
  submissions_by_risk_level: RiskLevelBreakdown[]
  recent_submissions: KYCSubmission[]
}

export interface RiskLevelBreakdown {
  risk_level: string
  count: number
  percentage: number
}

export interface KYCTemplate {
  id: string
  name: string
  description: string
  required_documents: string[]
  required_fields: string[]
  approval_criteria: ApprovalCriteria
  is_default: boolean
  created_at: string
}

export interface ApprovalCriteria {
  minimum_credit_score?: number
  minimum_income?: number
  maximum_debt_to_income_ratio?: number
  required_references: number
  blacklist_check: boolean
  manual_review_required: boolean
}

class KYCService extends ApiService {
  private baseUrl = '/kyc'
  private casesUrl = '/kyc/cases'

  async getKYCSubmissions(filter: KYCFilter = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}?${params.toString()}`)
    return response.data
  }

  async getKYCSubmission(id: string) {
    const response = await this.get(`${this.baseUrl}/${id}`)
    return response.data
  }

  async createKYCSubmission(submission: Partial<KYCSubmission>) {
    const response = await this.post(this.baseUrl, submission)
    return response.data
  }

  async updateKYCSubmission(id: string, submission: Partial<KYCSubmission>) {
    const response = await this.put(`${this.baseUrl}/${id}`, submission)
    return response.data
  }

  async deleteKYCSubmission(id: string) {
    const response = await this.delete(`${this.baseUrl}/${id}`)
    return response.data
  }

  async uploadKYCDocument(submissionId: string, file: File, documentType: string) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('document_type', documentType)

    const response = await this.post(`${this.baseUrl}/${submissionId}/documents`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }

  async deleteKYCDocument(submissionId: string, documentId: string) {
    const response = await this.delete(`${this.baseUrl}/${submissionId}/documents/${documentId}`)
    return response.data
  }

  async verifyKYCDocument(submissionId: string, documentId: string, verified: boolean, reason?: string) {
    const response = await this.post(`${this.baseUrl}/${submissionId}/documents/${documentId}/verify`, {
      verified,
      reason
    })
    return response.data
  }

  async approveKYCSubmission(id: string, notes?: string) {
    const response = await this.post(`${this.baseUrl}/${id}/approve`, { notes })
    return response.data
  }

  async rejectKYCSubmission(id: string, reason: string, notes?: string) {
    const response = await this.post(`${this.baseUrl}/${id}/reject`, { reason, notes })
    return response.data
  }

  async requestKYCUpdate(id: string, requiredUpdates: string[], notes?: string) {
    const response = await this.post(`${this.baseUrl}/${id}/request-update`, {
      required_updates: requiredUpdates,
      notes
    })
    return response.data
  }



  async runCreditCheck(submissionId: string) {
    const response = await this.post(`${this.baseUrl}/${submissionId}/credit-check`)
    return response.data
  }

  async verifyReferences(submissionId: string) {
    const response = await this.post(`${this.baseUrl}/${submissionId}/verify-references`)
    return response.data
  }

  async getKYCTemplates() {
    const response = await this.get(`${this.baseUrl}/templates`)
    return response.data
  }

  async createKYCTemplate(template: Partial<KYCTemplate>) {
    const response = await this.post(`${this.baseUrl}/templates`, template)
    return response.data
  }

  async updateKYCTemplate(id: string, template: Partial<KYCTemplate>) {
    const response = await this.put(`${this.baseUrl}/templates/${id}`, template)
    return response.data
  }

  async deleteKYCTemplate(id: string) {
    const response = await this.delete(`${this.baseUrl}/templates/${id}`)
    return response.data
  }

  async setDefaultKYCTemplate(id: string) {
    const response = await this.post(`${this.baseUrl}/templates/${id}/set-default`)
    return response.data
  }

  async exportKYCReport(format: 'pdf' | 'excel' = 'pdf', filter: KYCFilter = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })
    params.append('format', format)

    const response = await this.get(`${this.baseUrl}/export?${params.toString()}`, {
      responseType: 'blob'
    })
    
    const blob = new Blob([response.data])
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `kyc-report-${Date.now()}.${format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  async getCustomerKYCHistory(customerId: string) {
    const response = await this.get(`${this.baseUrl}/customer/${customerId}/history`)
    return response.data
  }

  async getAgentKYCSubmissions(agentId: string, filter: KYCFilter = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/agent/${agentId}?${params.toString()}`)
    return response.data
  }

  async bulkApproveKYC(submissionIds: string[], notes?: string) {
    const response = await this.post(`${this.baseUrl}/bulk-approve`, {
      submission_ids: submissionIds,
      notes
    })
    return response.data
  }

  async bulkRejectKYC(submissionIds: string[], reason: string, notes?: string) {
    const response = await this.post(`${this.baseUrl}/bulk-reject`, {
      submission_ids: submissionIds,
      reason,
      notes
    })
    return response.data
  }

  // Additional missing methods
  async getKYCStats(dateRange?: any) {
    const params = new URLSearchParams()
    if (dateRange?.start_date) params.append('start_date', dateRange.start_date)
    if (dateRange?.end_date) params.append('end_date', dateRange.end_date)

    const response = await this.get(`${this.baseUrl}/stats?${params.toString()}`)
    return response.data
  }

  async getKYCAnalytics(dateRange?: any) {
    const params = new URLSearchParams()
    if (dateRange?.start_date) params.append('start_date', dateRange.start_date)
    if (dateRange?.end_date) params.append('end_date', dateRange.end_date)

    const response = await this.get(`${this.baseUrl}/analytics?${params.toString()}`)
    return response.data
  }

  async getKYCTrends(dateRange?: any) {
    const params = new URLSearchParams()
    if (dateRange?.start_date) params.append('start_date', dateRange.start_date)
    if (dateRange?.end_date) params.append('end_date', dateRange.end_date)

    const response = await this.get(`${this.baseUrl}/trends?${params.toString()}`)
    return response.data
  }

  async getKYCReports(filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })

    const response = await this.get(`${this.baseUrl}/reports?${params.toString()}`)
    return response.data
  }

  async getKYCAgents() {
    const response = await this.get(`${this.baseUrl}/agents`)
    return response.data
  }

  // KYC Cases - New lifecycle methods matching backend
  async getKYCCases(filter: any = {}) {
    const params = new URLSearchParams()
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value))
      }
    })
    const response = await this.get(`${this.casesUrl}?${params.toString()}`)
    return response.data
  }

  async getKYCCase(id: string) {
    const response = await this.get(`${this.casesUrl}/${id}`)
    return response.data
  }

  async createKYCCase(data: {
    customer_id?: string
    case_type?: string
    business_name?: string
    registration_number?: string
    tax_id?: string
    contact_person?: string
    contact_phone?: string
    contact_email?: string
    address?: string
    notes?: string
  }) {
    const response = await this.post(this.casesUrl, data)
    return response.data
  }

  async updateKYCCase(id: string, data: any) {
    const response = await this.put(`${this.casesUrl}/${id}`, data)
    return response.data
  }

  async uploadKYCCaseDocument(id: string, data: {
    document_type: string
    document_name?: string
    file_url: string
    expiry_date?: string
  }) {
    const response = await this.post(`${this.casesUrl}/${id}/documents`, data)
    return response.data
  }

  async startKYCReview(id: string) {
    const response = await this.post(`${this.casesUrl}/${id}/start-review`)
    return response.data
  }

  async requestKYCDocuments(id: string, data: { documents_requested: string; notes?: string }) {
    const response = await this.post(`${this.casesUrl}/${id}/request-documents`, data)
    return response.data
  }

  async approveKYCCase(id: string, notes?: string) {
    const response = await this.post(`${this.casesUrl}/${id}/approve`, { notes })
    return response.data
  }

  async rejectKYCCase(id: string, reason: string, notes?: string) {
    const response = await this.post(`${this.casesUrl}/${id}/reject`, { rejection_reason: reason, notes })
    return response.data
  }

  async getKYCCaseStats() {
    const response = await this.get(`${this.baseUrl}/stats`)
    return response.data
  }
}

export const kycService = new KYCService()
