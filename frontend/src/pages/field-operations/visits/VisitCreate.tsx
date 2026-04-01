import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../../services/api.service'
import {
  Box, Stepper, Step, StepLabel, Button, Paper, Typography, Alert,
  TextField, FormControl, InputLabel, Select, MenuItem, CircularProgress,
  Card, CardContent, Chip, IconButton, FormControlLabel, Switch, Divider,
  Grid, Autocomplete, Radio, RadioGroup, Checkbox, FormGroup, FormLabel, FormHelperText
} from '@mui/material'
import { CloudUpload as UploadIcon } from '@mui/icons-material'
import {
  MyLocation as GpsIcon,
  Person as PersonIcon,
  Store as StoreIcon,
  CameraAlt as CameraIcon,
  Check as CheckIcon,
  Warning as WarningIcon,
  ArrowBack as BackIcon,
  ArrowForward as NextIcon,
  Send as SubmitIcon
} from '@mui/icons-material'
import { useToast } from '../../../components/ui/Toast'
import { fieldOperationsService } from '../../../services/field-operations.service'

// Haversine distance between two GPS coordinates in meters
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000 // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Extract error message from axios errors or plain Error objects (fixes mobile save bug)
function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const axiosErr = err as { response?: { data?: { message?: string; error?: string } }; message?: string }
    if (axiosErr.response?.data?.message) return axiosErr.response.data.message
    if (axiosErr.response?.data?.error) return axiosErr.response.data.error
    if (axiosErr.message) return axiosErr.message
  }
  if (err instanceof Error) return err.message
  return 'Failed to create visit'
}

interface GpsLocation {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

interface CustomField {
  id: string
  field_name: string
  field_label: string
  field_type: string
  is_required: number
  field_options: string | null
  display_order: number
}

interface CustomQuestion {
  id: string
  question_label: string
  question_key: string
  field_type: string
  field_options: string | null
  is_required: number
  display_order: number
  visit_target_type: string
  check_duplicate?: number
  min_length?: number
  max_length?: number
}

interface Company {
  id: string
  name: string
  code: string
  revisit_radius_meters?: number
}

interface Customer {
  id: string
  name?: string
  business_name?: string
  code?: string
  address?: string
  latitude?: number
  longitude?: number
}

interface Questionnaire {
  id: string
  name: string
  questions: string
  visit_type?: string
  brand_id?: string
}

interface ProcessFlowStep {
  id: string
  step_key: string
  step_label: string
  step_order: number
  is_required: number
  config: string
}

// Built-in flow field keys that are already captured in the standard visit flow
// Questions with check_duplicate flagged that match these keys will be filtered out
const BUILT_IN_FLOW_KEYS = new Set([
  'first_name', 'last_name', 'customer_name', 'individual_name', 'name',
  'id_number', 'phone', 'phone_number', 'cell_number', 'email',
  'store_name', 'shop_name', 'business_name', 'address',
  'gps', 'latitude', 'longitude', 'visit_type', 'photo',
])

function isDuplicateFlowQuestion(q: CustomQuestion): boolean {
  if (!q.check_duplicate) return false
  const normalizedKey = q.question_key.toLowerCase().replace(/[^a-z0-9]/g, '_')
  for (const builtIn of BUILT_IN_FLOW_KEYS) {
    if (normalizedKey === builtIn || normalizedKey.includes(builtIn)) return true
  }
  return false
}

// Default fallback steps if backend doesn't return process flow
const DEFAULT_STORE_STEPS: ProcessFlowStep[] = [
  { id: 's1', step_key: 'gps', step_label: 'GPS Check-in', step_order: 1, is_required: 1, config: '{}' },
  { id: 's2', step_key: 'visit_type', step_label: 'Visit Type', step_order: 2, is_required: 1, config: '{}' },
  { id: 's3', step_key: 'details', step_label: 'Details', step_order: 3, is_required: 1, config: '{}' },
  { id: 's4', step_key: 'survey', step_label: 'Survey', step_order: 4, is_required: 0, config: '{}' },
  { id: 's5', step_key: 'photo', step_label: 'Photo Capture', step_order: 5, is_required: 0, config: '{}' },
  { id: 's6', step_key: 'review', step_label: 'Review & Submit', step_order: 6, is_required: 1, config: '{}' },
]

const DEFAULT_INDIVIDUAL_STEPS: ProcessFlowStep[] = [
  { id: 'i1', step_key: 'gps', step_label: 'GPS Check-in', step_order: 1, is_required: 1, config: '{}' },
  { id: 'i2', step_key: 'visit_type', step_label: 'Visit Type', step_order: 2, is_required: 1, config: '{}' },
  { id: 'i3', step_key: 'details', step_label: 'Details', step_order: 3, is_required: 1, config: '{}' },
  { id: 'i4', step_key: 'survey', step_label: 'Survey', step_order: 4, is_required: 0, config: '{}' },
  { id: 'i5', step_key: 'review', step_label: 'Review & Submit', step_order: 5, is_required: 1, config: '{}' },
]

export default function VisitCreate() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const isMobileContext = location.pathname.startsWith('/agent/')
  const [activeStep, setActiveStep] = useState(0)
  const [loading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const stepDataLoadingRef = useRef(0)
  const [stepDataLoading, setStepDataLoading] = useState(false)
  const submitIdRef = useRef<string | null>(null)
  // Track which company+visitType combo has had custom data loaded to avoid redundant fetches
  const loadedCustomDataKeyRef = useRef<string>('')
  const [customersLoaded, setCustomersLoaded] = useState(false)

  // Dynamic process flow steps from backend
  const [processFlowSteps, setProcessFlowSteps] = useState<ProcessFlowStep[]>([])
  const [, setProcessFlowLoaded] = useState(false)

  // Step: GPS
  const [gpsLocation, setGpsLocation] = useState<GpsLocation | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)

  // Step 2: Visit Type - pre-populate from URL ?type=store or ?type=individual
  const [searchParams] = useSearchParams()
  const preselectedType = searchParams.get('type') as 'individual' | 'store' | null
  const [visitTargetType, setVisitTargetType] = useState<'individual' | 'store' | ''>(preselectedType || '')

  // Sync visitTargetType if URL param changes without unmounting
  useEffect(() => {
    if (preselectedType && preselectedType !== visitTargetType) {
      setVisitTargetType(preselectedType)
    }
  }, [preselectedType])

  // Step 3: Details
  const [companies, setCompanies] = useState<Company[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [selectedCustomer, setSelectedCustomer] = useState<string>('')
  const [newStoreName, setNewStoreName] = useState<string>('')
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({})
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([])
  const [customQuestionValues, setCustomQuestionValues] = useState<Record<string, string>>({})
  const [storeRevisitCheck, setStoreRevisitCheck] = useState<{ can_visit: boolean; message: string; days_since?: number } | null>(null)
  const [duplicateCheck, setDuplicateCheck] = useState<{ has_duplicates: boolean; duplicates: Array<{ field: string; value: string }> } | null>(null)

  // Individual fields
  const [individualFirstName, setIndividualFirstName] = useState('')
  const [individualLastName, setIndividualLastName] = useState('')
  const [individualIdNumber, setIndividualIdNumber] = useState('')
  const [individualPhone, setIndividualPhone] = useState('')
  const [individualEmail, setIndividualEmail] = useState('')

  // Step 4: Survey
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([])
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<string>('')
  const [surveyResponses, setSurveyResponses] = useState<Record<string, string>>({})
  const [surveyRequired, setSurveyRequired] = useState(false)
  const [skipSurvey, setSkipSurvey] = useState(false)

  // Step 5: Photo (with board placement questions)
  const [photos, setPhotos] = useState<Array<{ dataUrl: string; hash: string; gps: GpsLocation | null; timestamp: string; boardPlacementLocation?: string; boardPlacementPosition?: string; boardCondition?: string }>>([])
  const [photoGps, setPhotoGps] = useState<GpsLocation | null>(null)
  const [photoDuplicateWarning, setPhotoDuplicateWarning] = useState<string | null>(null)
  // Board placement defaults for the next photo
  const [boardPlacementLocation, setBoardPlacementLocation] = useState<string>('')
  const [boardPlacementPosition, setBoardPlacementPosition] = useState<string>('')
  const [boardCondition, setBoardCondition] = useState<string>('')

  // Notes
  const [notes, setNotes] = useState('')
  // Tracks whether the user attempted to proceed so we can highlight missing required fields
  const [showValidation, setShowValidation] = useState(false)

  // Load process flow when visit type or company changes
  useEffect(() => {
    if (visitTargetType) {
      loadProcessFlow()
    }
  }, [visitTargetType, selectedCompany])

  const loadProcessFlow = async () => {
    try {
      const res = await fieldOperationsService.getVisitProcessFlow(
        selectedCompany || undefined,
        visitTargetType || undefined
      )
      const flowData = res?.data || res
      if (flowData?.steps && Array.isArray(flowData.steps) && flowData.steps.length > 0) {
        setProcessFlowSteps(
          flowData.steps.sort((a: ProcessFlowStep, b: ProcessFlowStep) => a.step_order - b.step_order)
        )
      } else {
        setProcessFlowSteps(
          visitTargetType === 'store' ? DEFAULT_STORE_STEPS : DEFAULT_INDIVIDUAL_STEPS
        )
      }
      setProcessFlowLoaded(true)
    } catch {
      setProcessFlowSteps(
        visitTargetType === 'store' ? DEFAULT_STORE_STEPS : DEFAULT_INDIVIDUAL_STEPS
      )
      setProcessFlowLoaded(true)
    }
  }

  // Compute active steps: skip photo step for individual visits, skip empty steps
  const activeSteps = useMemo(() => {
    if (processFlowSteps.length === 0) {
      // Use full default steps when visit type is known (prevents race condition
      // where user could skip to Submit before process flow API returns)
      if (visitTargetType === 'store') return DEFAULT_STORE_STEPS
      if (visitTargetType === 'individual') return DEFAULT_INDIVIDUAL_STEPS
      return [
        { step_key: 'gps', step_label: 'GPS Check-in', is_required: 1 },
        { step_key: 'visit_type', step_label: 'Visit Type', is_required: 1 },
      ] as ProcessFlowStep[]
    }
    return processFlowSteps.filter(step => {
      // Individual visits: no photo step
      if (step.step_key === 'photo' && visitTargetType === 'individual') return false
      // Skip survey step if no questionnaires available
      if (step.step_key === 'survey' && questionnaires.length === 0 && !surveyRequired) return false
      return true
    })
  }, [processFlowSteps, visitTargetType, questionnaires, surveyRequired])

  const stepLabels = useMemo(() => activeSteps.map(s => s.step_label), [activeSteps])
  const currentStepKey = activeSteps[activeStep]?.step_key || ''

  // Load form data on mount
  useEffect(() => {
    loadFormData()
  }, [])

  // Auto-select company when visit type changes based on process flow assignments
  useEffect(() => {
    if (isMobileContext && visitTargetType && companies.length > 0 && !selectedCompany) {
      const matchingCompany = companies.find((c: any) =>
        c.process_flow_types && Array.isArray(c.process_flow_types) &&
        (c.process_flow_types.includes(visitTargetType) || c.process_flow_types.includes('both'))
      )
      if (matchingCompany) {
        setSelectedCompany(matchingCompany.id)
      } else if (companies.length === 1) {
        setSelectedCompany(companies[0].id)
      }
    }
  }, [visitTargetType, companies, isMobileContext])

  const loadFormData = async () => {
    try {
      let companiesData: Company[] = []
      if (isMobileContext) {
        // Mobile agents: try localStorage cache first for instant display, then refresh from API
        try {
          const cached = localStorage.getItem('agent_companies')
          if (cached) {
            const parsed = JSON.parse(cached)
            if (Array.isArray(parsed) && parsed.length > 0) {
              companiesData = parsed
            }
          }
        } catch { /* ignore parse errors */ }
        // If cache hit, set companies immediately for fast UI
        if (companiesData.length > 0) {
          setCompanies(companiesData)
        }
        // Fetch fresh data in background (don't await if we have cache)
        const fetchFresh = async () => {
          try {
            const compRes = await apiClient.get('/agent/my-companies')
            const agentCompanies = compRes?.data?.data || compRes?.data || []
            if (Array.isArray(agentCompanies) && agentCompanies.length > 0) {
              return agentCompanies
            }
          } catch { /* */ }
          try {
            const dashRes = await apiClient.get('/agent/dashboard')
            const dashCompanies = dashRes?.data?.data?.companies || dashRes?.data?.companies || []
            if (Array.isArray(dashCompanies) && dashCompanies.length > 0) {
              return dashCompanies
            }
          } catch { /* */ }
          return null
        }
        if (companiesData.length === 0) {
          // No cache — must await
          const fresh = await fetchFresh()
          if (fresh) companiesData = fresh
        } else {
          // Have cache — refresh in background without blocking
          fetchFresh().then(fresh => {
            if (fresh && fresh.length > 0) {
              setCompanies(fresh)
              localStorage.setItem('agent_companies', JSON.stringify(fresh))
            }
          })
        }
      } else {
        // Admin: show all companies
        const companiesRes = await fieldOperationsService.getCompanies()
        const allCompanies = companiesRes?.data || companiesRes || []
        companiesData = Array.isArray(allCompanies) ? allCompanies : []
      }
      setCompanies(companiesData)
      // Auto-select company based on process flow assignment for the current visit type
      let autoSelectedCompanyId = ''
      if (isMobileContext && companiesData.length > 0 && visitTargetType) {
        const matchingCompany = companiesData.find((c: any) =>
          c.process_flow_types && Array.isArray(c.process_flow_types) &&
          (c.process_flow_types.includes(visitTargetType) || c.process_flow_types.includes('both'))
        )
        if (matchingCompany) {
          autoSelectedCompanyId = matchingCompany.id
        } else if (companiesData.length === 1) {
          autoSelectedCompanyId = companiesData[0].id
        }
      } else if (companiesData.length === 1) {
        autoSelectedCompanyId = companiesData[0].id
      }
      if (autoSelectedCompanyId) {
        setSelectedCompany(autoSelectedCompanyId)
        // Custom data loading is deferred to when approaching the details step
        // (see loadDetailsStepData) — don't fire 4 API calls eagerly here
      }
      // NOTE: Customer/store loading is also deferred to loadDetailsStepData
      // to avoid blocking the GPS step with unnecessary API calls
    } catch (err) {
      console.error('Failed to load form data:', err)
    }
  }

  // Load all data needed for the details step in parallel
  // Called when navigating from visit_type → details (or when entering details step)
  const loadDetailsStepData = async (companyId?: string) => {
    const cid = companyId || selectedCompany
    const vType = visitTargetType || undefined
    const dataKey = `${cid}|${vType}`
    // Skip if already loaded for this company+visitType combo
    if (loadedCustomDataKeyRef.current === dataKey && customersLoaded) return
    loadedCustomDataKeyRef.current = dataKey
    // Fire all custom data + customer loading in parallel
    const promises: Promise<void>[] = []
    if (cid) {
      promises.push(loadCustomFields(cid))
      promises.push(loadCustomQuestions(cid, vType))
      promises.push(loadSurveyConfig(cid))
      promises.push(loadQuestionnaires(cid))
    }
    if (!customersLoaded) {
      promises.push(loadCustomersData())
    }
    await Promise.all(promises)
  }

  // Load customers/stores — called lazily when approaching details step
  const loadCustomersData = async () => {
    try {
      if (isMobileContext) {
        try {
          const storeRes = await apiClient.get('/agent/store-search?limit=200')
          const storeData = storeRes?.data?.data || storeRes?.data || []
          setCustomers(Array.isArray(storeData) ? storeData : [])
        } catch {
          const customersRes = await fieldOperationsService.getCustomers()
          const customersData = customersRes?.data?.data || customersRes?.data || customersRes || []
          setCustomers(Array.isArray(customersData) ? customersData : [])
        }
      } else {
        const customersRes = await fieldOperationsService.getCustomers()
        const customersData = customersRes?.data?.data || customersRes?.data || customersRes || []
        setCustomers(Array.isArray(customersData) ? customersData : [])
      }
      setCustomersLoaded(true)
    } catch (err) {
      console.error('Failed to load customers:', err)
    }
  }

  // GPS capture
  const captureGps = useCallback(() => {
    setGpsLoading(true)
    setGpsError(null)
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser')
      setGpsLoading(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        })
        setGpsLoading(false)
      },
      (err) => {
        setGpsError(`GPS error: ${err.message}. Please enable location services.`)
        setGpsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }, [])

  // Auto-capture GPS on GPS step
  useEffect(() => {
    if (currentStepKey === 'gps' && !gpsLocation && !gpsLoading) {
      captureGps()
    }
  }, [currentStepKey, gpsLocation, gpsLoading, captureGps])

  // Deferred loading: load custom data when entering the details step
  // (replaces the eager useEffect on [selectedCompany, visitTargetType] that fired 4 API calls on startup)
  useEffect(() => {
    if (currentStepKey === 'details' && selectedCompany) {
      loadDetailsStepData(selectedCompany)
    }
  }, [currentStepKey, selectedCompany])

  // If company changes while already on details step, reload custom data
  useEffect(() => {
    if (currentStepKey === 'details' && selectedCompany) {
      const dataKey = `${selectedCompany}|${visitTargetType || undefined}`
      if (loadedCustomDataKeyRef.current !== dataKey) {
        loadDetailsStepData(selectedCompany)
      }
    }
  }, [selectedCompany, visitTargetType])

  const loadCustomFields = async (companyId: string) => {
    try {
      stepDataLoadingRef.current++
      setStepDataLoading(true)
      const res = await fieldOperationsService.getBrandCustomFields(companyId, visitTargetType || 'individual')
      const fields = res?.data || res || []
      setCustomFields(Array.isArray(fields) ? fields : [])
    } catch (err) {
      console.error('Failed to load custom fields:', err)
    } finally {
      stepDataLoadingRef.current--
      if (stepDataLoadingRef.current <= 0) {
        stepDataLoadingRef.current = 0
        setStepDataLoading(false)
      }
    }
  }

  const loadCustomQuestions = async (companyId: string, visitType?: string) => {
    try {
      stepDataLoadingRef.current++
      setStepDataLoading(true)
      const res = await fieldOperationsService.getCompanyCustomQuestions(companyId, visitType)
      const questions = res?.data || res || []
      const allQuestions = Array.isArray(questions) ? questions : []
      const filtered = allQuestions.filter((q: CustomQuestion) => !isDuplicateFlowQuestion(q))
      setCustomQuestions(filtered)
      // Initialize toggle questions to 'No' so the visual state matches the stored value
      const toggleDefaults: Record<string, string> = {}
      for (const q of filtered) {
        if (q.field_type === 'toggle') toggleDefaults[q.question_key] = 'No'
      }
      if (Object.keys(toggleDefaults).length > 0) {
        setCustomQuestionValues(prev => ({ ...toggleDefaults, ...prev }))
      }
    } catch (err) {
      console.error('Failed to load custom questions:', err)
    } finally {
      stepDataLoadingRef.current--
      if (stepDataLoadingRef.current <= 0) {
        stepDataLoadingRef.current = 0
        setStepDataLoading(false)
      }
    }
  }

  const loadSurveyConfig = async (companyId: string) => {
    try {
      const res = await fieldOperationsService.getVisitSurveyConfig(companyId)
      const configs = res?.data || res || []
      if (Array.isArray(configs)) {
        const config = configs.find((c: { visit_target_type: string }) => c.visit_target_type === visitTargetType)
        if (config) {
          setSurveyRequired(!!config.survey_required)
          if (config.survey_required) {
            setSkipSurvey(false)
          }
          if (config.questionnaire_id) {
            setSelectedQuestionnaire(config.questionnaire_id)
          }
        } else {
          setSurveyRequired(false)
          setSelectedQuestionnaire('')
        }
      }
    } catch (err) {
      console.error('Failed to load survey config:', err)
    }
  }

  // Reload questionnaires when entering survey step (in case they weren't loaded yet)
  useEffect(() => {
    if (currentStepKey === 'survey' && questionnaires.length === 0) {
      loadQuestionnaires()
    }
  }, [currentStepKey])

  const loadQuestionnaires = async (companyIdOverride?: string) => {
    try {
      const res = await fieldOperationsService.getQuestionnaires({ visit_type: visitTargetType || undefined, company_id: companyIdOverride || selectedCompany || undefined, target_type: visitTargetType || undefined, module: 'field_ops' })
      const data = res?.data || res || []
      setQuestionnaires(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load questionnaires:', err)
    }
  }

  // Check store revisit when customer selected
  const checkStoreRevisit = async (customerId: string) => {
    try {
      const res = await fieldOperationsService.checkStoreRevisit(customerId)
      setStoreRevisitCheck(res)
      return res
    } catch (err) {
      console.error('Failed to check store revisit:', err)
      return null
    }
  }

  // Check individual duplicate
  const checkIndividualDuplicate = async () => {
    if (!individualIdNumber && !individualPhone) return null
    try {
      const res = await fieldOperationsService.checkIndividualDuplicate({
        id_number: individualIdNumber || undefined,
        phone: individualPhone || undefined
      })
      setDuplicateCheck(res)
      return res
    } catch (err) {
      console.error('Failed to check individual duplicate:', err)
      return null
    }
  }

  // Photo hash generation (simple hash for duplicate detection)
  const generatePhotoHash = async (dataUrl: string): Promise<string> => {
    const data = dataUrl.substring(0, 5000)
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  // Compress image using canvas before storing
  const compressImage = (dataUrl: string, maxWidth = 1280, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', quality))
        } else {
          resolve(dataUrl)
        }
      }
      img.onerror = () => resolve(dataUrl)
      img.src = dataUrl
    })
  }

  // Capture photo
  const handlePhotoCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setPhotoDuplicateWarning(null)

    const reader = new FileReader()
    reader.onload = async (e) => {
      const rawDataUrl = e.target?.result as string
      // Compress image to reduce bandwidth and storage
      const dataUrl = await compressImage(rawDataUrl)
      const hash = await generatePhotoHash(dataUrl)

      // Check for duplicate on server
      try {
        const dupCheck = await fieldOperationsService.checkPhotoDuplicate(hash)
        if (dupCheck?.is_duplicate) {
          setPhotoDuplicateWarning(dupCheck.message || 'This photo has already been submitted. Please take a new photo.')
          toast.error('Duplicate photo detected! Please take a new photo.')
          return
        }
      } catch {
        // Continue even if check fails
      }

      // Also check locally
      if (photos.some(p => p.hash === hash)) {
        setPhotoDuplicateWarning('This photo is identical to one already added.')
        toast.error('Duplicate photo detected!')
        return
      }

      // Capture GPS at photo time
      let currentGps: GpsLocation | null = null
      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
          })
          currentGps = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp
          }
          setPhotoGps(currentGps)
        } catch {
          // GPS may fail at photo time, continue without it
        }
      }

      setPhotos(prev => [...prev, {
        boardPlacementLocation: boardPlacementLocation || undefined,
        boardPlacementPosition: boardPlacementPosition || undefined,
        boardCondition: boardCondition || undefined,
        dataUrl,
        hash,
        gps: currentGps,
        timestamp: new Date().toISOString()
      }])
      toast.success('Photo captured successfully')
    }
    reader.readAsDataURL(file)
  }

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  // Step validation based on dynamic step key
  const canProceed = (): boolean => {
    switch (currentStepKey) {
      case 'gps': return !!gpsLocation
      case 'visit_type': return visitTargetType === 'individual' || visitTargetType === 'store'
      case 'details': {
        if (visitTargetType === 'individual') {
          if (!individualFirstName || !individualLastName) return false
          if (!individualIdNumber && !individualPhone) return false
          if (duplicateCheck?.has_duplicates) return false
          for (const field of customFields) {
            if (field.is_required && !customFieldValues[field.field_name]) return false
          }
          for (const q of customQuestions) {
            if (q.is_required && !customQuestionValues[q.question_key]) return false
          }
          return true
        }
        if (visitTargetType === 'store') {
          if (!selectedCustomer && !newStoreName) return false
          if (selectedCustomer && storeRevisitCheck && !storeRevisitCheck.can_visit) return false
          for (const q of customQuestions) {
            if (q.is_required && !customQuestionValues[q.question_key]) return false
          }
          return true
        }
        return false
      }
      case 'survey': {
        if (surveyRequired && !skipSurvey) {
          if (!selectedQuestionnaire) return false
          return Object.keys(surveyResponses).length > 0
        }
        return true
      }
      case 'photo': return photos.length > 0
      case 'review': return true
      default: return true
    }
  }

  const handleNext = async () => {
    // Only block navigation for stepDataLoading on the details step (where custom questions/fields are needed)
    // GPS and visit_type steps should not be blocked by background data loading
    const blockForLoading = stepDataLoading && (currentStepKey === 'details' || currentStepKey === 'survey')
    if (navigating || blockForLoading) return
    setNavigating(true)
    setError(null)
    try {
      // Preload details step data when leaving visit_type step → heading to details
      if (currentStepKey === 'visit_type' && selectedCompany) {
        loadDetailsStepData(selectedCompany)
      }
      // If the user can't proceed, show validation highlights on required fields
      if (!canProceed()) {
        setShowValidation(true)
        return
      }
      setShowValidation(false)
      if (currentStepKey === 'details') {
        if (visitTargetType === 'individual') {
          const result = await checkIndividualDuplicate()
          if (result?.has_duplicates) {
            setError('Duplicate individual detected. ID number and phone must be unique.')
            return
          }
        }
        // GPS radius check: only enforced for store revisits, not for new individual visits
        if (visitTargetType === 'store' && selectedCustomer) {
          const result = await checkStoreRevisit(selectedCustomer)
          if (result && !result.can_visit) {
            setError(result.message)
            return
          }
          // Enforce GPS radius for store revisits
          const customer = customers.find(c => c.id === selectedCustomer)
          if (customer?.latitude && customer?.longitude && gpsLocation) {
            const company = companies.find(c => c.id === selectedCompany)
            const radiusMeters = company?.revisit_radius_meters || 200
            const distance = haversineDistance(
              gpsLocation.latitude, gpsLocation.longitude,
              customer.latitude, customer.longitude
            )
            if (distance > radiusMeters) {
              setError(`You are ${Math.round(distance)}m from the store. Must be within ${radiusMeters}m to check in for a revisit.`)
              return
            }
          }
        }
      }
      setActiveStep(prev => prev + 1)
    } catch (err) {
      console.error('handleNext error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      // Small delay to prevent accidental double-advance after step change
      setTimeout(() => setNavigating(false), 300)
    }
  }

  const handleBack = () => {
    setError(null)
    setShowValidation(false)
    setActiveStep(prev => prev - 1)
  }

  // Final submit
  const handleSubmit = async () => {
    if (submitting) return // Prevent double-click
    setSubmitting(true)
    setError(null)
    try {
      // Generate a stable client_visit_id for idempotency (reuse on retry)
      if (!submitIdRef.current) {
        submitIdRef.current = crypto.randomUUID()
      }
      const payload: Record<string, unknown> = {
        visit_target_type: visitTargetType,
        checkin_latitude: gpsLocation?.latitude,
        checkin_longitude: gpsLocation?.longitude,
        company_id: selectedCompany || undefined,
        client_visit_id: submitIdRef.current,
        notes
      }

      if (visitTargetType === 'individual') {
        payload.individual_first_name = individualFirstName
        payload.individual_last_name = individualLastName
        payload.individual_id_number = individualIdNumber || undefined
        payload.individual_phone = individualPhone || undefined
        payload.individual_email = individualEmail || undefined
        payload.custom_field_values = customFieldValues
      } else if (visitTargetType === 'store') {
        if (selectedCustomer) {
          payload.customer_id = selectedCustomer
        } else if (newStoreName) {
          payload.store_name = newStoreName
        }
      }

      if (selectedQuestionnaire && Object.keys(surveyResponses).length > 0) {
        payload.questionnaire_id = selectedQuestionnaire
        payload.survey_responses = surveyResponses
      }

      // Include custom question values for both visit types
      if (Object.keys(customQuestionValues).length > 0) {
        payload.custom_question_values = customQuestionValues
      }

      if (photos.length > 0) {
        payload.photos = photos.map(p => ({
          photo_url: p.dataUrl,
          photo_hash: p.hash,
          board_placement_location: p.boardPlacementLocation || null,
          board_placement_position: p.boardPlacementPosition || null,
          board_condition: p.boardCondition || null,
          gps_latitude: p.gps?.latitude,
          gps_longitude: p.gps?.longitude,
          photo_type: 'board',
          captured_at: p.timestamp
        }))
      }

      await fieldOperationsService.createVisitWorkflow(payload as Parameters<typeof fieldOperationsService.createVisitWorkflow>[0])
      // Invalidate performance caches so reports update immediately
      queryClient.invalidateQueries({ queryKey: ['field-ops-performance'] })
      queryClient.invalidateQueries({ queryKey: ['field-ops-kpis'] })
      queryClient.invalidateQueries({ queryKey: ['field-ops-drill-down'] })
      queryClient.invalidateQueries({ queryKey: ['field-ops-agent-perf'] })
      queryClient.invalidateQueries({ queryKey: ['field-ops-conversions'] })
      queryClient.invalidateQueries({ queryKey: ['field-ops-hourly'] })
      queryClient.invalidateQueries({ queryKey: ['field-ops-daily'] })
      toast.success('Visit created successfully!')
      // Navigate back to the correct context (agent or admin)
      const isAgentContext = window.location.pathname.startsWith('/agent/')
      navigate(isAgentContext ? '/agent/visits' : '/field-operations/visits')
    } catch (err: unknown) {
      // FIX: Properly extract error messages from axios response objects (fixes mobile save bug)
      const message = extractErrorMessage(err)
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  // ==================== STEP RENDERERS ====================

  const renderGpsStep = () => (
    <Card>
      <CardContent>
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <GpsIcon sx={{ fontSize: 64, color: gpsLocation ? 'success.main' : 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            GPS Check-in
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Your location will be captured to verify the visit location.
          </Typography>

          {gpsLoading && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={40} />
              <Typography variant="body2">Capturing GPS location...</Typography>
            </Box>
          )}

          {gpsLocation && (
            <Box sx={{ mt: 2 }}>
              <Chip icon={<CheckIcon />} label="Location captured" color="success" sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Lat: {gpsLocation.latitude.toFixed(6)}, Lng: {gpsLocation.longitude.toFixed(6)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Accuracy: {gpsLocation.accuracy.toFixed(0)}m
              </Typography>
            </Box>
          )}

          {gpsError && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="warning" sx={{ mb: 2 }}>{gpsError}</Alert>
              <Button variant="outlined" onClick={captureGps} startIcon={<GpsIcon />}>
                Retry GPS
              </Button>
            </Box>
          )}

          {!gpsLoading && !gpsLocation && !gpsError && (
            <Button variant="contained" onClick={captureGps} startIcon={<GpsIcon />}>
              Capture Location
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  )

  const renderVisitTypeStep = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Select Visit Type
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Are you visiting an individual person or a store/business?
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <Card
              sx={{
                cursor: 'pointer',
                border: visitTargetType === 'individual' ? 2 : 1,
                borderColor: visitTargetType === 'individual' ? 'primary.main' : 'divider',
                bgcolor: visitTargetType === 'individual' ? 'primary.50' : 'background.paper',
                transition: 'all 0.2s',
                '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' }
              }}
              onClick={() => setVisitTargetType('individual')}
            >
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <PersonIcon sx={{ fontSize: 48, color: visitTargetType === 'individual' ? 'primary.main' : 'text.secondary', mb: 2 }} />
                <Typography variant="h6">Individual</Typography>
                <Typography variant="body2" color="text.secondary">
                  Visit a person - capture ID, phone, and brand-specific details
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Card
              sx={{
                cursor: 'pointer',
                border: visitTargetType === 'store' ? 2 : 1,
                borderColor: visitTargetType === 'store' ? 'primary.main' : 'divider',
                bgcolor: visitTargetType === 'store' ? 'primary.50' : 'background.paper',
                transition: 'all 0.2s',
                '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' }
              }}
              onClick={() => setVisitTargetType('store')}
            >
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <StoreIcon sx={{ fontSize: 48, color: visitTargetType === 'store' ? 'primary.main' : 'text.secondary', mb: 2 }} />
                <Typography variant="h6">Store / Business</Typography>
                <Typography variant="body2" color="text.secondary">
                  Visit a store - select customer, verify 30-day rule
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )

  const renderDetailsStep = () => (
    <Card>
      <CardContent>
        {/* Company Selection - hide if mobile agent with only 1 company (auto-selected) */}
        {companies.length === 1 && isMobileContext ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            Company: <strong>{companies[0].name}</strong>
          </Alert>
        ) : (
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Company / Brand</InputLabel>
            <Select
              value={selectedCompany}
              label="Company / Brand"
              onChange={(e) => setSelectedCompany(e.target.value)}
            >
              {!isMobileContext && <MenuItem value="">None</MenuItem>}
              {companies.map(c => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {visitTargetType === 'individual' && (
          <>
            <Typography variant="h6" gutterBottom>Individual Details</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              ID number and phone must be unique. Duplicates will be blocked.
            </Typography>
            <Typography variant="caption" color="error" sx={{ mb: 2, display: 'block' }}>* Required fields</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="First Name *"
                  value={individualFirstName}
                  onChange={(e) => setIndividualFirstName(e.target.value)}
                  error={showValidation && !individualFirstName}
                  helperText={showValidation && !individualFirstName ? 'First name is required' : undefined}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Last Name *"
                  value={individualLastName}
                  onChange={(e) => setIndividualLastName(e.target.value)}
                  error={showValidation && !individualLastName}
                  helperText={showValidation && !individualLastName ? 'Last name is required' : undefined}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={`ID Number ${!individualPhone ? '*' : ''}`}
                  value={individualIdNumber}
                  onChange={(e) => { setIndividualIdNumber(e.target.value); setDuplicateCheck(null); }}
                  helperText={showValidation && !individualIdNumber && !individualPhone ? 'ID number or phone is required' : 'Must be unique - cannot be duplicated'}
                  error={(showValidation && !individualIdNumber && !individualPhone) || duplicateCheck?.duplicates?.some(d => d.field === 'id_number') || false}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={`Phone Number ${!individualIdNumber ? '*' : ''}`}
                  value={individualPhone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9+]/g, '')
                    setIndividualPhone(val)
                    setDuplicateCheck(null)
                  }}
                  helperText={individualPhone && !/^(\+27|0)[0-9]{9}$/.test(individualPhone) ? 'Enter valid SA number: +27XXXXXXXXX or 0XXXXXXXXX' : (showValidation && !individualPhone && !individualIdNumber ? 'ID number or phone is required' : 'Must be unique - cannot be duplicated')}
                  error={(showValidation && !individualPhone && !individualIdNumber) || (!!individualPhone && !/^(\+27|0)[0-9]{9}$/.test(individualPhone)) || duplicateCheck?.duplicates?.some(d => d.field === 'phone') || false}
                  placeholder="+27XXXXXXXXX or 0XXXXXXXXX"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={individualEmail}
                  onChange={(e) => setIndividualEmail(e.target.value)}
                />
              </Grid>
            </Grid>

            {duplicateCheck?.has_duplicates && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <Typography variant="body2" fontWeight="bold">Duplicate detected!</Typography>
                {duplicateCheck.duplicates.map((d, i) => (
                  <Typography key={i} variant="body2">
                    {d.field === 'id_number' ? 'ID Number' : 'Phone'}: {d.value} already exists
                  </Typography>
                ))}
              </Alert>
            )}
          </>
        )}

        {visitTargetType === 'store' && (
          <>
            <Typography variant="h6" gutterBottom>Store / Customer Selection</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              The same store cannot be visited within 30 days.
            </Typography>
            <Typography variant="caption" color="error" sx={{ mb: 2, display: 'block' }}>* Required fields</Typography>
            <Autocomplete
              freeSolo
              options={customers}
              getOptionLabel={(c) => typeof c === 'string' ? c : (c.name || c.business_name || c.code || 'Unknown')}
              value={selectedCustomer ? (customers.find(c => c.id === selectedCustomer) || null) : (newStoreName || null)}
              onChange={async (_e, newValue) => {
                if (typeof newValue === 'string') {
                  // User typed a new store name
                  setSelectedCustomer('')
                  setNewStoreName(newValue)
                  setStoreRevisitCheck(null)
                } else if (newValue) {
                  // User selected an existing customer
                  setSelectedCustomer(newValue.id)
                  setNewStoreName('')
                  setStoreRevisitCheck(null)
                  await checkStoreRevisit(newValue.id)
                } else {
                  setSelectedCustomer('')
                  setNewStoreName('')
                  setStoreRevisitCheck(null)
                }
              }}
              onInputChange={(_e, value, reason) => {
                if (reason === 'input' && !customers.find(c => (c.name || c.business_name || '') === value)) {
                  setNewStoreName(value)
                  setSelectedCustomer('')
                }
              }}
              renderInput={(params) => (
                <TextField {...params} label="Search existing store or type new name *" fullWidth required={!newStoreName} helperText={showValidation && !selectedCustomer && !newStoreName ? 'Please select or type a store name' : (newStoreName && !selectedCustomer ? `New store "${newStoreName}" will be created` : 'Search by store name or type a new one')} error={showValidation && !selectedCustomer && !newStoreName} />
              )}
              sx={{ mb: 2 }}
            />

            {storeRevisitCheck && !storeRevisitCheck.can_visit && (
              <Alert severity="error" sx={{ mt: 2 }} icon={<WarningIcon />}>
                <Typography variant="body2" fontWeight="bold">Visit Blocked!</Typography>
                <Typography variant="body2">{storeRevisitCheck.message}</Typography>
                {storeRevisitCheck.days_since !== undefined && (
                  <Typography variant="body2">Days since last visit: {storeRevisitCheck.days_since}</Typography>
                )}
              </Alert>
            )}

            {storeRevisitCheck?.can_visit && (
              <Alert severity="success" sx={{ mt: 2 }}>
                <Typography variant="body2">{storeRevisitCheck.message}</Typography>
              </Alert>
            )}
          </>
        )}

        {/* Brand-Specific Custom Fields */}
        {customFields.length > 0 && (
          <>
            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" gutterBottom>Brand-Specific Fields</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Fields specific to the selected brand/company.
            </Typography>
            <Typography variant="caption" color="error" sx={{ mb: 2, display: 'block' }}>* Required fields</Typography>
            <Grid container spacing={2}>
              {customFields.map(field => {
                const fieldVal = customFieldValues[field.field_name] || ''
                return (
                <Grid item xs={12} sm={6} key={field.id}>
                  {field.field_type === 'select' && field.field_options ? (
                    <FormControl fullWidth required={!!field.is_required} error={showValidation && !!field.is_required && !fieldVal}>
                      <InputLabel>{field.field_label}{field.is_required ? ' *' : ''}</InputLabel>
                      <Select
                        value={fieldVal}
                        label={field.field_label + (field.is_required ? ' *' : '')}
                        onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.field_name]: e.target.value }))}
                      >
                        {(() => { try { return JSON.parse(field.field_options!) as string[] } catch { return [] } })().map((opt: string) => (
                          <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                        ))}
                      </Select>
                      {showValidation && !!field.is_required && !fieldVal && <FormHelperText>This field is required</FormHelperText>}
                    </FormControl>
                  ) : (
                    <TextField
                      fullWidth
                      required={!!field.is_required}
                      label={field.field_label + (field.is_required ? ' *' : '')}
                      type={field.field_type === 'number' ? 'number' : 'text'}
                      value={fieldVal}
                      onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.field_name]: e.target.value }))}
                      error={showValidation && !!field.is_required && !fieldVal}
                      helperText={showValidation && !!field.is_required && !fieldVal ? 'This field is required' : undefined}
                    />
                  )}
                </Grid>
                )
              })}
            </Grid>
          </>
        )}

        {/* Company-level custom questions (for BOTH individual AND store visits) */}
        {customQuestions.length > 0 && (
          <>
            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" gutterBottom>Company Questions</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Answer the following questions for this company.
            </Typography>
            <Typography variant="caption" color="error" sx={{ mb: 2, display: 'block' }}>* Required fields</Typography>
            <Grid container spacing={2}>
              {customQuestions.map(q => {
                const opts: string[] = q.field_options ? (() => { try { return JSON.parse(q.field_options!) as string[] } catch { return [] } })() : []
                const val = customQuestionValues[q.question_key] || ''
                const lenHelper = q.min_length || q.max_length ? `${q.min_length ? `Min ${q.min_length}` : ''}${q.min_length && q.max_length ? ' / ' : ''}${q.max_length ? `Max ${q.max_length}` : ''} characters` : undefined
                const lenError = !!(q.min_length && val.length > 0 && val.length < q.min_length)
                return (
                <Grid item xs={12} sm={6} key={q.id}>
                  {q.field_type === 'select' && opts.length > 0 ? (
                    <FormControl fullWidth required={!!q.is_required} error={showValidation && !!q.is_required && !val}>
                      <InputLabel>{q.question_label}{q.is_required ? ' *' : ''}</InputLabel>
                      <Select
                        value={val}
                        label={q.question_label + (q.is_required ? ' *' : '')}
                        onChange={(e) => setCustomQuestionValues(prev => ({ ...prev, [q.question_key]: e.target.value }))}
                      >
                        {opts.map((opt: string) => (
                          <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                        ))}
                      </Select>
                      {showValidation && !!q.is_required && !val && <FormHelperText>This field is required</FormHelperText>}
                    </FormControl>
                  ) : q.field_type === 'radio' && opts.length > 0 ? (
                    <FormControl component="fieldset" required={!!q.is_required} fullWidth error={showValidation && !!q.is_required && !val}>
                      <FormLabel component="legend">{q.question_label}{q.is_required ? ' *' : ''}</FormLabel>
                      <RadioGroup
                        value={val}
                        onChange={(e) => setCustomQuestionValues(prev => ({ ...prev, [q.question_key]: e.target.value }))}
                      >
                        {opts.map((opt: string) => (
                          <FormControlLabel key={opt} value={opt} control={<Radio />} label={opt} />
                        ))}
                      </RadioGroup>
                      {showValidation && !!q.is_required && !val && <FormHelperText>Please select an option</FormHelperText>}
                    </FormControl>
                  ) : q.field_type === 'checkbox' && opts.length > 0 ? (
                    <FormControl component="fieldset" required={!!q.is_required} fullWidth error={showValidation && !!q.is_required && !val}>
                      <FormLabel component="legend">{q.question_label}{q.is_required ? ' *' : ''}</FormLabel>
                      <FormGroup>
                        {opts.map((opt: string) => {
                          const selected: string[] = val ? val.split(',') : []
                          return (
                            <FormControlLabel
                              key={opt}
                              control={
                                <Checkbox
                                  checked={opt === 'Other' ? selected.some(s => s === 'Other' || s.startsWith('Other:')) : selected.includes(opt)}
                                  onChange={(e) => {
                                    let newSelected: string[]
                                    if (opt === 'Other') {
                                      newSelected = e.target.checked
                                        ? [...selected.filter(s => s !== 'Other' && !s.startsWith('Other:')), 'Other']
                                        : selected.filter(s => s !== 'Other' && !s.startsWith('Other:'))
                                    } else {
                                      newSelected = e.target.checked
                                        ? [...selected, opt]
                                        : selected.filter(s => s !== opt)
                                    }
                                    setCustomQuestionValues(prev => ({ ...prev, [q.question_key]: newSelected.join(',') }))
                                  }}
                                />
                              }
                              label={opt}
                            />
                          )
                        })}
                      </FormGroup>
                      {(() => {
                        const selected: string[] = val ? val.split(',') : []
                        const hasOther = selected.some(s => s === 'Other' || s.startsWith('Other:'))
                        if (!hasOther) return null
                        const otherVal = selected.find(s => s.startsWith('Other:'))?.replace('Other:', '') || ''
                        return (
                          <TextField
                            fullWidth
                            size="small"
                            label="Please specify"
                            value={otherVal}
                            onChange={(e) => {
                              const newVal = e.target.value.replace(/,/g, '')
                              const filtered = selected.filter(s => s !== 'Other' && !s.startsWith('Other:'))
                              filtered.push(newVal ? `Other:${newVal}` : 'Other')
                              setCustomQuestionValues(prev => ({ ...prev, [q.question_key]: filtered.join(',') }))
                            }}
                            sx={{ mt: 1 }}
                            placeholder="Enter name..."
                          />
                        )
                      })()}
                    </FormControl>
                  ) : q.field_type === 'toggle' ? (
                    <FormControl component="fieldset" fullWidth>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={val === 'Yes'}
                            onChange={(e) => setCustomQuestionValues(prev => ({ ...prev, [q.question_key]: e.target.checked ? 'Yes' : 'No' }))}
                          />
                        }
                        label={q.question_label + (q.is_required ? ' *' : '')}
                      />
                      {val && <FormHelperText>{val}</FormHelperText>}
                    </FormControl>
                  ) : q.field_type === 'date' ? (
                    <TextField
                      fullWidth
                      required={!!q.is_required}
                      label={q.question_label + (q.is_required ? ' *' : '')}
                      type="date"
                      error={showValidation && !!q.is_required && !val}
                      value={val}
                      onChange={(e) => setCustomQuestionValues(prev => ({ ...prev, [q.question_key]: e.target.value }))}
                      InputLabelProps={{ shrink: true }}
                    />
                  ) : q.field_type === 'image' ? (
                    <FormControl fullWidth required={!!q.is_required} error={showValidation && !!q.is_required && !val}>
                      <FormLabel sx={{ mb: 1 }}>{q.question_label}{q.is_required ? ' *' : ''}</FormLabel>
                      <Button
                        variant="outlined"
                        component="label"
                        startIcon={<UploadIcon />}
                        fullWidth
                      >
                        {val ? 'Photo captured' : 'Take / Upload Photo'}
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          hidden
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            const reader = new FileReader()
                            reader.onload = async (ev) => {
                              const rawDataUrl = ev.target?.result as string
                              const compressed = await compressImage(rawDataUrl)
                              setCustomQuestionValues(prev => ({ ...prev, [q.question_key]: compressed }))
                            }
                            reader.readAsDataURL(file)
                          }}
                        />
                      </Button>
                      {val && (
                        <Box sx={{ mt: 1 }}>
                          <img src={val} alt={q.question_label} style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }} />
                        </Box>
                      )}
                    </FormControl>
                  ) : q.field_type === 'textarea' ? (
                    <TextField
                      fullWidth
                      required={!!q.is_required}
                      label={q.question_label + (q.is_required ? ' *' : '')}
                      multiline
                      rows={3}
                      value={val}
                      onChange={(e) => setCustomQuestionValues(prev => ({ ...prev, [q.question_key]: e.target.value }))}
                      inputProps={{ minLength: q.min_length || undefined, maxLength: q.max_length || undefined }}
                      helperText={showValidation && !!q.is_required && !val ? 'This field is required' : lenHelper}
                      error={lenError || (showValidation && !!q.is_required && !val)}
                    />
                  ) : (
                    <TextField
                      fullWidth
                      required={!!q.is_required}
                      label={q.question_label + (q.is_required ? ' *' : '')}
                      type={q.field_type === 'number' ? 'number' : q.field_type === 'email' ? 'email' : q.field_type === 'phone' ? 'tel' : 'text'}
                      value={val}
                      onChange={(e) => setCustomQuestionValues(prev => ({ ...prev, [q.question_key]: e.target.value }))}
                      inputProps={{ minLength: q.min_length || undefined, maxLength: q.max_length || undefined }}
                      helperText={showValidation && !!q.is_required && !val ? 'This field is required' : lenHelper}
                      error={lenError || (showValidation && !!q.is_required && !val)}
                    />
                  )}
                </Grid>
                )
              })}
            </Grid>
          </>
        )}
      </CardContent>
    </Card>
  )

  const renderSurveyStep = () => {
    const parsedQuestions: Array<{ id: string; question: string; type: string; options?: string[] }> = selectedQuestionnaire
      ? (() => {
          const q = questionnaires.find(qn => qn.id === selectedQuestionnaire)
          if (!q) return []
          try { return typeof q.questions === 'string' ? JSON.parse(q.questions) : q.questions } catch { return [] }
        })()
      : []

    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Survey</Typography>
          {surveyRequired ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              A survey is required for this visit type and brand.
            </Alert>
          ) : (
            <Box sx={{ mb: 2 }}>
              <FormControlLabel
                control={<Switch checked={skipSurvey} onChange={(e) => setSkipSurvey(e.target.checked)} />}
                label="Skip survey (optional for this visit)"
              />
            </Box>
          )}

          {!skipSurvey && (
            <>
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Select Survey / Questionnaire</InputLabel>
                <Select
                  value={selectedQuestionnaire}
                  label="Select Survey / Questionnaire"
                  onChange={(e) => {
                    setSelectedQuestionnaire(e.target.value)
                    setSurveyResponses({})
                  }}
                >
                  <MenuItem value="">None</MenuItem>
                  {questionnaires.map(q => (
                    <MenuItem key={q.id} value={q.id}>{q.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {parsedQuestions.length > 0 && (
                <Box>
                  {parsedQuestions.map((q, idx) => (
                    <Box key={q.id || idx} sx={{ mb: 3 }}>
                      <Typography variant="body1" fontWeight="bold" sx={{ mb: 1 }}>
                        {idx + 1}. {q.question}
                      </Typography>
                      {q.type === 'select' && q.options ? (
                        <FormControl fullWidth>
                          <Select
                            value={surveyResponses[q.id] || ''}
                            onChange={(e) => setSurveyResponses(prev => ({ ...prev, [q.id]: e.target.value }))}
                            displayEmpty
                          >
                            <MenuItem value="">Select an answer</MenuItem>
                            {q.options.map(opt => (
                              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <TextField
                          fullWidth
                          multiline={q.type === 'textarea'}
                          rows={q.type === 'textarea' ? 3 : 1}
                          value={surveyResponses[q.id] || ''}
                          onChange={(e) => setSurveyResponses(prev => ({ ...prev, [q.id]: e.target.value }))}
                          placeholder="Enter your answer"
                        />
                      )}
                    </Box>
                  ))}
                </Box>
              )}

              {questionnaires.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No surveys available for this visit type.
                </Typography>
              )}
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderPhotoStep = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Board Photo Capture</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Take a photo of the boards/signage. Answer the placement questions below, then capture a photo.
          Duplicate photos are not allowed. <strong>At least one photo is required.</strong>
        </Typography>

        {/* Board Placement Questions */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Board Placement Details</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Board Location</InputLabel>
                <Select
                  value={boardPlacementLocation}
                  label="Board Location"
                  onChange={(e) => setBoardPlacementLocation(e.target.value)}
                >
                  <MenuItem value=""><em>Select...</em></MenuItem>
                  <MenuItem value="inside_store">Inside Store</MenuItem>
                  <MenuItem value="outside_store">Outside Store</MenuItem>
                  <MenuItem value="window">Window Display</MenuItem>
                  <MenuItem value="entrance">Entrance</MenuItem>
                  <MenuItem value="counter">Counter/Till Area</MenuItem>
                  <MenuItem value="aisle">In-Aisle</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Board Position</InputLabel>
                <Select
                  value={boardPlacementPosition}
                  label="Board Position"
                  onChange={(e) => setBoardPlacementPosition(e.target.value)}
                >
                  <MenuItem value=""><em>Select...</em></MenuItem>
                  <MenuItem value="front">Front</MenuItem>
                  <MenuItem value="side">Side</MenuItem>
                  <MenuItem value="back">Back</MenuItem>
                  <MenuItem value="above">Above Eye Level</MenuItem>
                  <MenuItem value="eye_level">Eye Level</MenuItem>
                  <MenuItem value="below">Below Eye Level</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Board Condition</InputLabel>
                <Select
                  value={boardCondition}
                  label="Board Condition"
                  onChange={(e) => setBoardCondition(e.target.value)}
                >
                  <MenuItem value=""><em>Select...</em></MenuItem>
                  <MenuItem value="good">Good</MenuItem>
                  <MenuItem value="fair">Fair</MenuItem>
                  <MenuItem value="damaged">Damaged</MenuItem>
                  <MenuItem value="faded">Faded</MenuItem>
                  <MenuItem value="missing">Missing</MenuItem>
                  <MenuItem value="obstructed">Obstructed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>

        <Box sx={{ mb: 3, textAlign: 'center' }}>
          <Button
            variant="contained"
            component="label"
            startIcon={<CameraIcon />}
            size="large"
          >
            Take Photo
            <input
              type="file"
              hidden
              accept="image/*"
              capture="environment"
              onChange={handlePhotoCapture}
            />
          </Button>
        </Box>

        {photoDuplicateWarning && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {photoDuplicateWarning}
          </Alert>
        )}

        {photos.length > 0 && (
          <Grid container spacing={2}>
            {photos.map((photo, idx) => (
              <Grid item xs={6} sm={4} key={idx}>
                <Card variant="outlined">
                  <Box sx={{ position: 'relative' }}>
                    <img
                      src={photo.dataUrl}
                      alt={`Board photo ${idx + 1}`}
                      style={{ width: '100%', height: 150, objectFit: 'cover' }}
                    />
                    <IconButton
                      size="small"
                      sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(255,0,0,0.7)', color: 'white', '&:hover': { bgcolor: 'red' } }}
                      onClick={() => removePhoto(idx)}
                    >
                      ✕
                    </IconButton>
                  </Box>
                  <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {photo.gps ? `GPS: ${photo.gps.latitude.toFixed(4)}, ${photo.gps.longitude.toFixed(4)}` : 'No GPS'}
                    </Typography>
                    {photo.boardPlacementLocation && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Location: {photo.boardPlacementLocation.replace(/_/g, ' ')}
                      </Typography>
                    )}
                    {photo.boardPlacementPosition && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Position: {photo.boardPlacementPosition.replace(/_/g, ' ')}
                      </Typography>
                    )}
                    {photo.boardCondition && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Condition: {photo.boardCondition}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {photoGps && (
          <Box sx={{ mt: 2 }}>
            <Chip icon={<GpsIcon />} label={`Photo GPS: ${photoGps.latitude.toFixed(6)}, ${photoGps.longitude.toFixed(6)}`} color="info" variant="outlined" />
          </Box>
        )}
      </CardContent>
    </Card>
  )

  const renderReviewStep = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Review & Submit</Typography>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary">GPS Check-in</Typography>
          <Typography variant="body2">
            {gpsLocation ? `${gpsLocation.latitude.toFixed(6)}, ${gpsLocation.longitude.toFixed(6)} (±${gpsLocation.accuracy.toFixed(0)}m)` : 'Not captured'}
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary">Visit Type</Typography>
          <Chip label={visitTargetType === 'individual' ? 'Individual' : 'Store / Business'} color="primary" variant="outlined" />
        </Box>

        {selectedCompany && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary">Company / Brand</Typography>
            <Typography variant="body2">{companies.find(c => c.id === selectedCompany)?.name || selectedCompany}</Typography>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {visitTargetType === 'individual' && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary">Individual Details</Typography>
            <Typography variant="body2">Name: {individualFirstName} {individualLastName}</Typography>
            {individualIdNumber && <Typography variant="body2">ID: {individualIdNumber}</Typography>}
            {individualPhone && <Typography variant="body2">Phone: {individualPhone}</Typography>}
            {individualEmail && <Typography variant="body2">Email: {individualEmail}</Typography>}
            {Object.keys(customFieldValues).length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">Custom Fields:</Typography>
                {Object.entries(customFieldValues).map(([key, value]) => (
                  <Typography key={key} variant="body2">{key}: {value}</Typography>
                ))}
              </Box>
            )}
          </Box>
        )}

        {visitTargetType === 'store' && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary">Store</Typography>
            <Typography variant="body2">
              {selectedCustomer
                ? (customers.find(c => c.id === selectedCustomer)?.name || customers.find(c => c.id === selectedCustomer)?.business_name || selectedCustomer)
                : newStoreName ? `${newStoreName} (new store)` : 'Not selected'
              }
            </Typography>
          </Box>
        )}

        {/* Show custom question answers in review */}
        {Object.keys(customQuestionValues).length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary">Company Questions</Typography>
              {Object.entries(customQuestionValues).map(([key, value]) => {
                const cq = customQuestions.find(q => q.question_key === key)
                const isImage = cq?.field_type === 'image' || (typeof value === 'string' && value.startsWith('data:image/'))
                return isImage ? (
                  <Box key={key} sx={{ mb: 1 }}>
                    <Typography variant="body2" fontWeight="medium">{cq?.question_label || key}:</Typography>
                    <img src={value} alt={cq?.question_label || key} style={{ maxWidth: '100%', maxHeight: 120, borderRadius: 4, marginTop: 4 }} />
                  </Box>
                ) : (
                  <Typography key={key} variant="body2">{cq?.question_label || key}: {value}</Typography>
                )
              })}
            </Box>
          </>
        )}

        <Divider sx={{ my: 2 }} />

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary">Survey</Typography>
          {skipSurvey || !selectedQuestionnaire ? (
            <Typography variant="body2">No survey completed</Typography>
          ) : (
            <Typography variant="body2">
              {questionnaires.find(q => q.id === selectedQuestionnaire)?.name || 'Survey completed'} — {Object.keys(surveyResponses).length} response(s)
            </Typography>
          )}
        </Box>

        {/* Only show photos section if photo step exists in flow */}
        {activeSteps.some(s => s.step_key === 'photo') && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary">Photos</Typography>
              <Typography variant="body2">{photos.length} photo(s) captured</Typography>
              {photos.length > 0 && (
                <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                  {photos.map((p, i) => (
                    <img key={i} src={p.dataUrl} alt={`Photo ${i + 1}`} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }} />
                  ))}
                </Box>
              )}
            </Box>
          </>
        )}

        <TextField
          fullWidth
          multiline
          rows={3}
          label="Visit Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          sx={{ mt: 2 }}
        />
      </CardContent>
    </Card>
  )

  // Render step content based on dynamic step key
  const renderStepContent = () => {
    switch (currentStepKey) {
      case 'gps': return renderGpsStep()
      case 'visit_type': return renderVisitTypeStep()
      case 'details': return renderDetailsStep()
      case 'survey': return renderSurveyStep()
      case 'photo': return renderPhotoStep()
      case 'review': return renderReviewStep()
      default: return null
    }
  }

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 }, maxWidth: 900, mx: 'auto' }}>
      {/* Hide header on mobile - AgentLayout already provides back navigation */}
      {!isMobileContext && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => navigate('/field-operations/visits')} sx={{ mr: 1 }}>
            <BackIcon />
          </IconButton>
          <Typography variant="h5">Create Field Visit</Typography>
        </Box>
      )}

      {/* Compact stepper on mobile to prevent overflow */}
      <Stepper
        activeStep={activeStep}
        sx={{
          mb: { xs: 2, sm: 4 },
          '& .MuiStepLabel-label': {
            fontSize: { xs: '0.65rem', sm: '0.875rem' },
          },
          '& .MuiStepLabel-iconContainer': {
            '& .MuiSvgIcon-root': {
              fontSize: { xs: '1.2rem', sm: '1.5rem' },
            },
          },
        }}
        alternativeLabel
      >
        {stepLabels.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        renderStepContent()
      )}

      {/* Navigation - add bottom padding on mobile so it doesn't overlap bottom nav */}
      <Paper sx={{ mt: { xs: 2, sm: 3 }, p: { xs: 1.5, sm: 2 }, mb: isMobileContext ? 10 : 0, display: 'flex', justifyContent: 'space-between' }}>
        <Button
          disabled={activeStep === 0}
          onClick={handleBack}
          startIcon={<BackIcon />}
          size={isMobileContext ? 'medium' : 'large'}
        >
          Back
        </Button>

        {activeStep < activeSteps.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={navigating || (stepDataLoading && (currentStepKey === 'details' || currentStepKey === 'survey'))}
            endIcon={navigating || (stepDataLoading && (currentStepKey === 'details' || currentStepKey === 'survey')) ? <CircularProgress size={16} color="inherit" /> : <NextIcon />}
            size={isMobileContext ? 'medium' : 'large'}
          >
            {(stepDataLoading && (currentStepKey === 'details' || currentStepKey === 'survey')) ? 'Loading...' : 'Next'}
          </Button>
        ) : (
          <Button
            variant="contained"
            color="success"
            onClick={handleSubmit}
            disabled={submitting || !canProceed()}
            startIcon={submitting ? <CircularProgress size={20} /> : <SubmitIcon />}
            size={isMobileContext ? 'medium' : 'large'}
          >
            {submitting ? 'Creating...' : 'Submit Visit'}
          </Button>
        )}
      </Paper>
    </Box>
  )
}
