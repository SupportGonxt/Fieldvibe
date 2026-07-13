import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../../services/api.service'
import {
  Box, Stepper, Step, StepLabel, Button, Paper, Typography, Alert,
  TextField, FormControl, InputLabel, Select, MenuItem, CircularProgress,
  Card, CardContent, Chip, IconButton, FormControlLabel, Switch, Divider,
  Grid, Autocomplete, Radio, RadioGroup, Checkbox, FormGroup, FormLabel, FormHelperText,
  Dialog, DialogTitle, DialogContent, DialogActions
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
  Send as SubmitIcon,
  AddBusiness as AddStoreIcon,
  Poll as SurveyIcon
} from '@mui/icons-material'
import { useToast } from '../../../components/ui/Toast'
import { fieldOperationsService } from '../../../services/field-operations.service'
import { idError, isNationalIdKey, type IdType } from '../../../utils/sa-id'

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

// Goldrush player ID must be exactly this many digits and unique per tenant
const GOLDRUSH_ID_LENGTH = 9

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
  { id: 's5', step_key: 'photo', step_label: 'Photo Capture', step_order: 5, is_required: 1, config: '{}' },
  { id: 's6', step_key: 'review', step_label: 'Review & Submit', step_order: 6, is_required: 1, config: '{}' },
]

// Goldrush individuals: the system photo is captured FIRST (so the B-Tag can be
// checked before the agent types any customer details), then Details (incl. the
// Goldrush ID) is filled in afterwards.
const DEFAULT_INDIVIDUAL_STEPS: ProcessFlowStep[] = [
  { id: 'i1', step_key: 'gps', step_label: 'GPS Check-in', step_order: 1, is_required: 1, config: '{}' },
  { id: 'i2', step_key: 'visit_type', step_label: 'Visit Type', step_order: 2, is_required: 1, config: '{}' },
  { id: 'i4b', step_key: 'photo', step_label: 'Goldrush Photo', step_order: 3, is_required: 1, config: '{}' },
  { id: 'i3', step_key: 'details', step_label: 'Details', step_order: 4, is_required: 1, config: '{}' },
  { id: 'i4', step_key: 'survey', step_label: 'Survey', step_order: 5, is_required: 0, config: '{}' },
  { id: 'i5', step_key: 'review', step_label: 'Review & Submit', step_order: 6, is_required: 1, config: '{}' },
]

const DEFAULT_SURVEY_STEPS: ProcessFlowStep[] = [
  { id: 'sv1', step_key: 'gps', step_label: 'GPS Check-in', step_order: 1, is_required: 1, config: '{}' },
  { id: 'sv2', step_key: 'visit_type', step_label: 'Visit Type', step_order: 2, is_required: 1, config: '{}' },
  { id: 'sv3', step_key: 'details', step_label: 'Details', step_order: 3, is_required: 1, config: '{}' },
  { id: 'sv4', step_key: 'survey', step_label: 'Survey', step_order: 4, is_required: 1, config: '{}' },
  { id: 'sv5', step_key: 'photo', step_label: 'Photo Capture', step_order: 5, is_required: 1, config: '{}' },
  { id: 'sv6', step_key: 'review', step_label: 'Review & Submit', step_order: 6, is_required: 1, config: '{}' },
]

// Pick the default step set for a given visit target type
const defaultStepsForType = (t: string): ProcessFlowStep[] =>
  t === 'store' ? DEFAULT_STORE_STEPS : t === 'survey' ? DEFAULT_SURVEY_STEPS : DEFAULT_INDIVIDUAL_STEPS

// Pure helper — defined at module level so it can be used before any component state is initialised
const isGoldrushCompany = (c?: { name?: string; code?: string } | null) =>
  !!c && /goldrush/i.test(`${c.name || ''} ${c.code || ''}`)

// Parse the JSON config string stored on a ProcessFlowStep row
function parseStepConfig(config: string | Record<string, unknown> | undefined): Record<string, unknown> {
  if (!config) return {}
  if (typeof config === 'object') return config as Record<string, unknown>
  try { return JSON.parse(config) } catch { return {} }
}

// Draft persistence: Android kills the PWA during the camera hand-off, the reload
// remounts this all-useState wizard at step 0 and the agent loses everything.
// Persist progress to localStorage so a mid-visit reload restores where they were.
const DRAFT_KEY = 'visit_draft_v1'
const DRAFT_TTL_MS = 60 * 60 * 1000

// ponytail: any-typed draft blob — shape mirrors component state, single writer/reader below
function loadVisitDraft(): any | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (!d?.savedAt || Date.now() - d.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(DRAFT_KEY)
      return null
    }
    return d
  } catch { return null }
}

function clearVisitDraft() {
  try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
}

export default function VisitCreate() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const isMobileContext = location.pathname.startsWith('/agent/')
  const [draft] = useState(loadVisitDraft)
  const [activeStep, setActiveStep] = useState<number>(draft?.activeStep ?? 0)
  const [loading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationWarnings, setValidationWarnings] = useState<{ id_number?: string; goldrush_id?: string; photo_mismatch?: string; no_btag?: string } | null>(null)
  const [photoVerification, setPhotoVerification] = useState<{
    status: 'idle' | 'checking' | 'match' | 'mismatch' | 'unreadable' | 'pending_id'
    extractedId?: string | null
    hasBtag?: boolean | null
    extractedBtag?: string | null
  }>({ status: 'idle' })
  const [photoIdMismatchAcknowledged, setPhotoIdMismatchAcknowledged] = useState(false)
  const [photoNoBtagAcknowledged, setPhotoNoBtagAcknowledged] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [stepDataLoading, setStepDataLoading] = useState(false)
  const submitIdRef = useRef<string | null>(null)
  // Track which company+visitType combo has had custom data loaded to avoid redundant fetches
  const loadedCustomDataKeyRef = useRef<string>('')
  const loadDetailsInvocationRef = useRef(0)
  const [customersLoaded, setCustomersLoaded] = useState(false)

  // Dynamic process flow steps from backend
  const [processFlowSteps, setProcessFlowSteps] = useState<ProcessFlowStep[]>([])
  const [, setProcessFlowLoaded] = useState(false)

  // Step: GPS
  const [gpsLocation, setGpsLocation] = useState<GpsLocation | null>(draft?.gpsLocation ?? null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)

  // Step 2: Visit Type - pre-populate from URL ?type=store or ?type=individual
  const [searchParams] = useSearchParams()
  const preselectedType = searchParams.get('type') as 'individual' | 'store' | 'survey' | null
  const [visitTargetType, setVisitTargetType] = useState<'individual' | 'store' | 'survey' | ''>(draft?.visitTargetType ?? (preselectedType || ''))

  // Sync visitTargetType if URL param changes without unmounting.
  // When the type param is removed (e.g. agent taps "New" from a ?type=store URL),
  // reset to '' so the agent must re-select — prevents the previous type from persisting.
  // Skipped on the very first run when a draft was restored: the draft's type must
  // survive a reload of a URL without ?type= (the camera-kill recovery path).
  const skipTypeResetRef = useRef(!!draft)
  useEffect(() => {
    if (preselectedType) {
      if (preselectedType !== visitTargetType) {
        setVisitTargetType(preselectedType)
      }
    } else if (!skipTypeResetRef.current) {
      setVisitTargetType('')
    }
    skipTypeResetRef.current = false
  }, [preselectedType])

  // Step 3: Details
  const [companies, setCompanies] = useState<Company[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string>(draft?.selectedCompany ?? '')
  const [selectedCustomer, setSelectedCustomer] = useState<string>(draft?.selectedCustomer ?? '')
  const [newStoreName, setNewStoreName] = useState<string>(draft?.newStoreName ?? '')
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>(draft?.customFieldValues ?? {})
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([])
  const [customQuestionValues, setCustomQuestionValues] = useState<Record<string, string>>(draft?.customQuestionValues ?? {})
  const [storeRevisitCheck, setStoreRevisitCheck] = useState<{ can_visit: boolean; message: string; days_since?: number } | null>(null)
  const [duplicateCheck, setDuplicateCheck] = useState<{ has_duplicates: boolean; duplicates: Array<{ field: string; value: string }> } | null>(null)
  const [newStoreDialogOpen, setNewStoreDialogOpen] = useState(false)
  const [newStoreForm, setNewStoreForm] = useState({ name: '', address: '', contact_person: '', contact_phone: '' })
  const [newStoreFormError, setNewStoreFormError] = useState('')
  const [savingNewStore, setSavingNewStore] = useState(false)

  // Individual fields
  const [individualFirstName, setIndividualFirstName] = useState(draft?.individualFirstName ?? '')
  const [individualLastName, setIndividualLastName] = useState(draft?.individualLastName ?? '')
  const [individualIdNumber, setIndividualIdNumber] = useState(draft?.individualIdNumber ?? '')
  const [individualIdType, setIndividualIdType] = useState<IdType>(draft?.individualIdType ?? 'sa_id')
  const [individualPhone, setIndividualPhone] = useState(draft?.individualPhone ?? '')
  // Per-question ID type (SA ID vs passport) for auto-detected national-id company questions
  const [companyIdTypes, setCompanyIdTypes] = useState<Record<string, IdType>>(draft?.companyIdTypes ?? {})
  const [individualEmail, setIndividualEmail] = useState(draft?.individualEmail ?? '')

  // Step: Form Choice (store visits only) — agent picks Questionnaire or Survey
  // Form Type chooser removed — formChoice stays unset so survey step uses generic labels
  const [formChoice] = useState<'questionnaire' | 'survey' | ''>('')

  // Step 4: Survey
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([])
  // Tracks whether a questionnaire fetch has finished, so the "no survey for your
  // company" message/block only shows once we actually know there are none.
  const [questionnairesLoaded, setQuestionnairesLoaded] = useState(false)
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<string>(draft?.selectedQuestionnaire ?? '')
  const [surveyResponses, setSurveyResponses] = useState<Record<string, string>>(draft?.surveyResponses ?? {})
  const [surveyRequired, setSurveyRequired] = useState(false)
  const [skipSurvey, setSkipSurvey] = useState(draft?.skipSurvey ?? false)

  // Step 5: Photo (with board placement questions)
  const [photos, setPhotos] = useState<Array<{ dataUrl: string; hash: string; gps: GpsLocation | null; timestamp: string; boardPlacementLocation?: string; boardPlacementPosition?: string; boardCondition?: string }>>(draft?.photos ?? [])
  const [photoGps, setPhotoGps] = useState<GpsLocation | null>(draft?.photoGps ?? null)
  const [photoDuplicateWarning, setPhotoDuplicateWarning] = useState<string | null>(null)
  // Board placement defaults for the next photo
  const [boardPlacementLocation, setBoardPlacementLocation] = useState<string>(draft?.boardPlacementLocation ?? '')
  const [boardPlacementPosition, setBoardPlacementPosition] = useState<string>(draft?.boardPlacementPosition ?? '')
  const [boardCondition, setBoardCondition] = useState<string>(draft?.boardCondition ?? '')

  // Notes
  const [notes, setNotes] = useState(draft?.notes ?? '')
  // Tracks whether the user attempted to proceed so we can highlight missing required fields
  const [showValidation, setShowValidation] = useState(false)

  // Persist draft on every meaningful change so a mid-visit reload (Android camera
  // hand-off killing the PWA) restores the wizard instead of restarting it.
  useEffect(() => {
    if (!visitTargetType && activeStep === 0) return
    const data = {
      savedAt: Date.now(),
      activeStep, visitTargetType, gpsLocation,
      selectedCompany, selectedCustomer, newStoreName,
      customFieldValues, customQuestionValues, companyIdTypes,
      individualFirstName, individualLastName, individualIdNumber, individualIdType, individualPhone, individualEmail,
      selectedQuestionnaire, surveyResponses, skipSurvey,
      photos, photoGps, boardPlacementLocation, boardPlacementPosition, boardCondition,
      notes,
    }
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
    } catch {
      // ponytail: photo dataUrls can blow the localStorage quota — save everything
      // else so at least the answers survive; agent retakes the photo after restore
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...data, photos: [] })) } catch { /* full — give up */ }
    }
  }, [activeStep, visitTargetType, gpsLocation, selectedCompany, selectedCustomer, newStoreName,
    customFieldValues, customQuestionValues, companyIdTypes,
    individualFirstName, individualLastName, individualIdNumber, individualIdType, individualPhone, individualEmail,
    selectedQuestionnaire, surveyResponses, skipSurvey,
    photos, photoGps, boardPlacementLocation, boardPlacementPosition, boardCondition, notes])

  // One-shot notice that progress was restored
  useEffect(() => {
    if (draft) toast.success('Restored your in-progress visit')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        setProcessFlowSteps(defaultStepsForType(visitTargetType))
      }
      setProcessFlowLoaded(true)
    } catch {
      setProcessFlowSteps(defaultStepsForType(visitTargetType))
      setProcessFlowLoaded(true)
    }
  }

  // Compute active steps: skip photo step for individual visits, skip empty steps
  const activeSteps = useMemo(() => {
    let steps: ProcessFlowStep[]
    if (processFlowSteps.length === 0) {
      // Use full default steps when visit type is known (prevents race condition
      // where user could skip to Submit before process flow API returns)
      if (visitTargetType === 'store') steps = DEFAULT_STORE_STEPS
      else if (visitTargetType === 'individual') steps = DEFAULT_INDIVIDUAL_STEPS
      else if (visitTargetType === 'survey') steps = DEFAULT_SURVEY_STEPS
      else steps = [
        { step_key: 'gps', step_label: 'GPS Check-in', is_required: 1 },
        { step_key: 'visit_type', step_label: 'Visit Type', is_required: 1 },
      ] as ProcessFlowStep[]
    } else {
      steps = processFlowSteps
    }

    const currentCompany = companies.find(c => c.id === selectedCompany)
    const isGoldrush = isGoldrushCompany(currentCompany)

    let filtered = steps.filter(step => {
      // Form Type chooser is no longer used — always hidden
      if (step.step_key === 'form_choice') return false
      // Individual visits: photo required for Goldrush (agent must upload the
      // Goldrush system picture). Non-Goldrush individual visits skip the photo step.
      if (step.step_key === 'photo' && visitTargetType === 'individual' && !isGoldrush) return false
      if (step.step_key === 'survey') {
        // Always show for dedicated survey visits
        if (visitTargetType === 'survey') return true
        // Goldrush: unchanged — survey step only appears on survey visit type
        if (isGoldrush) return false
        // Non-Goldrush store/individual visit: show the survey step only when
        // this step has a specific questionnaire pre-assigned via the process flow.
        return !!parseStepConfig(step.config).questionnaire_id
      }
      // Questionnaire step: show whenever it's in the process flow.
      // It renders the company's custom questions as a dedicated step
      // (visit stays as store/individual, responses saved as visit data).
      if (step.step_key === 'questionnaire') return true
      return true
    })

    // Survey visits MUST include the survey step — it's the entire purpose of the
    // visit. The resolved process flow often omits one: a survey visit looks up a
    // flow assigned to 'survey'/'both', and when the company only has a store flow
    // assigned it falls back to a default flow with no survey step. Inject one
    // immediately before Review so the survey questions always have somewhere to render.
    if (visitTargetType === 'survey' && !filtered.some(s => s.step_key === 'survey')) {
      const surveyStep: ProcessFlowStep = {
        id: 'survey-injected', step_key: 'survey', step_label: 'Survey',
        step_order: 0, is_required: 1, config: '{}'
      }
      const reviewIdx = filtered.findIndex(s => s.step_key === 'review')
      filtered = reviewIdx === -1
        ? [...filtered, surveyStep]
        : [...filtered.slice(0, reviewIdx), surveyStep, ...filtered.slice(reviewIdx)]
    }

    return filtered
  }, [processFlowSteps, visitTargetType, questionnaires, surveyRequired, companies, selectedCompany])

  const stepLabels = useMemo(() => activeSteps.map(s => s.step_label), [activeSteps])
  const currentStepKey = activeSteps[activeStep]?.step_key || ''

  // For non-Goldrush companies, surveys are reached via step assignment rather than
  // a standalone Survey visit type. Hide the Survey option for all mobile agents —
  // Goldrush had it hidden already; non-Goldrush now does too.
  const hideSurveyVisitType = isMobileContext && companies.length > 0

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
    const invocationId = ++loadDetailsInvocationRef.current

    // Loading state is managed here, not inside individual load functions.
    // This avoids desynchronization when background functions' finally blocks
    // decrement a shared counter after a newer invocation has started.
    setStepDataLoading(true)

    // Wrap each call with a 15s timeout to prevent infinite loading.
    // On timeout, resolve (not reject) so Promise.all completes. The original fn()
    // continues in the background and will update state when it finishes.
    const withTimeout = (fn: () => Promise<void>, label: string): Promise<void> => {
      let timer: ReturnType<typeof setTimeout>
      return Promise.race([
        fn().finally(() => clearTimeout(timer)),
        new Promise<void>((resolve) => { timer = setTimeout(() => { console.warn(`${label} timed out after 15s`); resolve(); }, 15000) })
      ])
    }

    // Fire all custom data + customer loading in parallel
    const promises: Promise<void>[] = []
    if (cid) {
      promises.push(withTimeout(() => loadCustomFields(cid), 'loadCustomFields'))
      promises.push(withTimeout(() => loadCustomQuestions(cid, vType), 'loadCustomQuestions'))
      promises.push(withTimeout(() => loadSurveyConfig(cid), 'loadSurveyConfig'))
      promises.push(withTimeout(() => loadQuestionnaires(cid), 'loadQuestionnaires'))
    }
    if (!customersLoaded) {
      promises.push(withTimeout(() => loadCustomersData(), 'loadCustomersData'))
    }
    await Promise.all(promises)

    // Clear loading gate only if this is still the latest invocation.
    // A newer concurrent call (e.g. user switched company) takes ownership.
    if (invocationId === loadDetailsInvocationRef.current) {
      setStepDataLoading(false)
    }
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
      const res = await fieldOperationsService.getBrandCustomFields(companyId, visitTargetType || 'individual')
      const fields = res?.data || res || []
      setCustomFields(Array.isArray(fields) ? fields : [])
    } catch (err) {
      console.error('Failed to load custom fields:', err)
    }
  }

  const loadCustomQuestions = async (companyId: string, visitType?: string) => {
    try {
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

  // When process flow steps load, auto-select any questionnaire that has been
  // pre-assigned to a survey step (non-Goldrush store/individual visits only).
  // The step assignment takes precedence over the visit_survey_config table.
  useEffect(() => {
    if (visitTargetType === 'survey' || processFlowSteps.length === 0) return
    if (!isMobileContext) return
    const company = companies.find(c => c.id === selectedCompany)
    if (isGoldrushCompany(company)) return
    for (const step of processFlowSteps) {
      if (step.step_key !== 'survey') continue
      const qId = parseStepConfig(step.config).questionnaire_id as string | undefined
      if (qId) {
        setSelectedQuestionnaire(qId)
        return
      }
    }
  }, [processFlowSteps, selectedCompany, companies, visitTargetType, isMobileContext])

  // Reload questionnaires when entering survey or questionnaire step (in case they weren't loaded yet)
  useEffect(() => {
    if ((currentStepKey === 'survey' || currentStepKey === 'questionnaire') && questionnaires.length === 0) {
      loadQuestionnaires()
    }
  }, [currentStepKey])

  const loadQuestionnaires = async (companyIdOverride?: string) => {
    setQuestionnairesLoaded(false)
    try {
      // When a survey step has a questionnaire pre-assigned via the process flow,
      // fetch broadly (all field_ops) so the assigned questionnaire is always found —
      // it may have a different target_type than the current visit type.
      const hasStepSurvey = visitTargetType !== 'survey' && processFlowSteps.some(s => {
        if (s.step_key !== 'survey') return false
        return !!parseStepConfig(s.config).questionnaire_id
      })
      // For standalone survey visits, surveys are assigned to companies via the
      // `brand_ids` column (a JSON list of company ids). The backend can't filter
      // inside that array, so fetch all active field_ops surveys and narrow to
      // the agent's company client-side below. A survey's `visit_type` is its
      // survey type (adhoc/customer/...), never the literal 'survey', so we don't
      // filter by visit_type/target_type here.
      const filter = visitTargetType === 'survey' || hasStepSurvey
        ? { module: 'field_ops' }
        : { visit_type: visitTargetType || undefined, company_id: companyIdOverride || selectedCompany || undefined, target_type: visitTargetType || undefined, module: 'field_ops' }
      const res = await fieldOperationsService.getQuestionnaires(filter)
      const data = res?.data || res || []
      let list = Array.isArray(data) ? data : []

      // Survey visits: show only surveys assigned to the agent's company.
      // Assignment lives in `brand_ids` (list of company ids); the legacy
      // single `company_id` column is also honored for older surveys.
      if (visitTargetType === 'survey') {
        const cid = companyIdOverride || selectedCompany
        if (cid) {
          list = list.filter((q: Questionnaire & { brand_ids?: unknown; company_id?: string }) => {
            let companyIds: string[] = []
            try {
              companyIds = Array.isArray(q.brand_ids)
                ? q.brand_ids as string[]
                : (typeof q.brand_ids === 'string' && q.brand_ids ? JSON.parse(q.brand_ids) : [])
            } catch { companyIds = [] }
            if (companyIds.map(String).includes(String(cid))) return true
            if (q.company_id && String(q.company_id) === String(cid)) return true
            return false
          })
        }
      }
      setQuestionnaires(list)
    } catch (err) {
      console.error('Failed to load questionnaires:', err)
    } finally {
      setQuestionnairesLoaded(true)
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
    const goldrushQ = customQuestions.find(q => q.question_key.toLowerCase().includes('goldrush_id'))
    const goldrushId = goldrushQ ? (customQuestionValues[goldrushQ.question_key] || '') : ''
    if (!individualIdNumber && !individualPhone && !goldrushId) return null
    try {
      const res = await fieldOperationsService.checkIndividualDuplicate({
        id_number: individualIdNumber || undefined,
        phone: individualPhone || undefined,
        goldrush_id: goldrushId || undefined
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

      // Add photo immediately so thumbnail + toast are instant. GPS
      // getCurrentPosition can block up to 10s; resolving it inline made
      // agents wait and re-tap. Attach GPS async, patch the entry by hash.
      setPhotos(prev => [...prev, {
        boardPlacementLocation: boardPlacementLocation || undefined,
        boardPlacementPosition: boardPlacementPosition || undefined,
        boardCondition: boardCondition || undefined,
        dataUrl,
        hash,
        gps: null,
        timestamp: new Date().toISOString()
      }])
      toast.success('Photo captured successfully')

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const gps: GpsLocation = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              timestamp: pos.timestamp
            }
            setPhotoGps(gps)
            setPhotos(prev => prev.map(p => (p.hash === hash ? { ...p, gps } : p)))
          },
          () => { /* GPS may fail at photo time, keep photo without it */ },
          { enableHighAccuracy: true, timeout: 10000 }
        )
      }

      // Auto-verify Goldrush ID for Goldrush individual visits
      const currentCompany = companies.find(c => c.id === selectedCompany)
      if (isGoldrushCompany(currentCompany) && visitTargetType === 'individual') {
        verifyGoldrushPhoto(dataUrl)
      }
    }
    reader.readAsDataURL(file)
  }

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
    setPhotoVerification({ status: 'idle' })
    setPhotoIdMismatchAcknowledged(false)
    setPhotoNoBtagAcknowledged(false)
  }

  // Find the Goldrush ID the agent typed across custom fields and questions
  const getTypedGoldrushId = (): string => {
    const all = { ...customFieldValues, ...customQuestionValues } as Record<string, string>
    for (const [k, v] of Object.entries(all)) {
      if (k.toLowerCase().includes('goldrush_id') && !k.toLowerCase().includes('rejected')) {
        return String(v).trim()
      }
    }
    return ''
  }

  // Write the Goldrush ID read off the photo into whichever custom field/question is
  // configured to hold it, so the agent sees it pre-filled on the Details step instead
  // of having to type it in. Returns whether a matching field was found.
  const applyExtractedGoldrushId = (value: string): boolean => {
    const q = customQuestions.find(q => q.question_key.toLowerCase().includes('goldrush_id') && !q.question_key.toLowerCase().includes('rejected'))
    if (q) {
      setCustomQuestionValues(prev => ({ ...prev, [q.question_key]: value }))
      return true
    }
    const f = customFields.find(f => f.field_name.toLowerCase().includes('goldrush_id') && !f.field_name.toLowerCase().includes('rejected'))
    if (f) {
      setCustomFieldValues(prev => ({ ...prev, [f.field_name]: value }))
      return true
    }
    return false
  }

  // Verify the B-Tag and player ID in the uploaded system photo and pre-fill the Goldrush
  // ID from what the AI read off the photo. The photo is captured before Details, so the
  // agent confirms/corrects the ID on the next step. Name is manual entry (individualFirstName
  // /individualLastName), not auto-filled. btag-present is derived from extracted_btag.
  const verifyGoldrushPhoto = async (photoDataUrl: string) => {
    setPhotoVerification({ status: 'checking' })
    try {
      const res = await apiClient.post('/field-ops/verify-goldrush-photo', {
        photo_data: photoDataUrl,
      })
      const { extracted_id, extracted_btag } = res.data || {}
      const hasBtag = !!extracted_btag
      if (!hasBtag) setPhotoNoBtagAcknowledged(false)
      setPhotoIdMismatchAcknowledged(false)
      if (!extracted_id) {
        setPhotoVerification({ status: 'unreadable', extractedId: null, hasBtag, extractedBtag: extracted_btag ?? null })
        return
      }
      const filled = applyExtractedGoldrushId(extracted_id)
      setPhotoVerification({
        status: filled ? 'match' : 'pending_id',
        extractedId: extracted_id, hasBtag, extractedBtag: extracted_btag ?? null,
      })
    } catch {
      setPhotoVerification({ status: 'unreadable' })
    }
  }

  // If the Details step's Goldrush ID/custom fields weren't ready yet at photo-capture
  // time (pending_id), or the agent edits the pre-filled ID afterwards, reconcile it
  // against the ID extracted from the photo.
  useEffect(() => {
    if (photoVerification.status !== 'pending_id' && photoVerification.status !== 'match' && photoVerification.status !== 'mismatch') return
    if (!photoVerification.extractedId) return
    const typedId = getTypedGoldrushId().replace(/\D/g, '')
    if (!typedId) {
      setPhotoVerification(prev => ({ ...prev, status: 'pending_id' }))
      return
    }
    const match = photoVerification.extractedId === typedId
    setPhotoVerification(prev => (prev.status === (match ? 'match' : 'mismatch') ? prev : { ...prev, status: match ? 'match' : 'mismatch' }))
    if (!match) setPhotoIdMismatchAcknowledged(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customFieldValues, customQuestionValues, photoVerification.extractedId])

  // Step validation based on dynamic step key
  const canProceed = (): boolean => {
    switch (currentStepKey) {
      case 'gps': return !!gpsLocation
      case 'visit_type': return visitTargetType === 'individual' || visitTargetType === 'store' || visitTargetType === 'survey'
      case 'details': {
        // Survey visits only need a company/brand selected (to load the right questionnaire)
        if (visitTargetType === 'survey') return true
        if (visitTargetType === 'individual') {
          if (!individualFirstName || !individualLastName) return false
          // Goldrush individuals must have an ID/passport; a phone alone is not enough.
          const goldrushInd = isGoldrushCompany(companies.find(c => c.id === selectedCompany))
          if (goldrushInd ? !individualIdNumber : (!individualIdNumber && !individualPhone)) return false
          if (idError(individualIdType, individualIdNumber)) return false
          if (duplicateCheck?.has_duplicates) return false
          for (const field of customFields) {
            if (field.is_required && !customFieldValues[field.field_name]) return false
          }
          if (!hasQuestionnaireStep) {
            for (const q of customQuestions) {
              if (q.is_required && !customQuestionValues[q.question_key]) return false
              if (isNationalIdKey(q.question_key) && idError(companyIdTypes[q.question_key] || 'sa_id', customQuestionValues[q.question_key] || '')) return false
              if (q.question_key.toLowerCase().includes('goldrush_id')) {
                const gv = customQuestionValues[q.question_key] || ''
                if (gv && gv.length !== GOLDRUSH_ID_LENGTH) return false
              }
            }
          }
          const currentCompany = companies.find(c => c.id === selectedCompany)
          if (isGoldrushCompany(currentCompany) && photoVerification.status === 'mismatch' && !photoIdMismatchAcknowledged) return false
          return true
        }
        if (visitTargetType === 'store') {
          if (!selectedCustomer && !newStoreName) return false
          if (selectedCustomer && storeRevisitCheck && !storeRevisitCheck.can_visit) return false
          for (const field of customFields) {
            if (field.is_required && !customFieldValues[field.field_name]) return false
          }
          if (!hasQuestionnaireStep) {
            for (const q of customQuestions) {
              if (q.is_required && !customQuestionValues[q.question_key]) return false
              if (isNationalIdKey(q.question_key) && idError(companyIdTypes[q.question_key] || 'sa_id', customQuestionValues[q.question_key] || '')) return false
              if (q.question_key.toLowerCase().includes('goldrush_id')) {
                const gv = customQuestionValues[q.question_key] || ''
                if (gv && gv.length !== GOLDRUSH_ID_LENGTH) return false
              }
            }
          }
          return true
        }
        return false
      }
      case 'survey': {
        // Survey visits cannot continue when the agent's company has no survey
        // assigned — block here so they never reach Photo / Review & Submit.
        if (visitTargetType === 'survey' && questionnairesLoaded && questionnaires.length === 0) return false
        if (surveyRequired && !skipSurvey) {
          if (!selectedQuestionnaire) return false
          if (Object.keys(surveyResponses).length === 0) return false
          // Validate all required fields in the selected questionnaire are filled
          const selQ = questionnaires.find(qn => qn.id === selectedQuestionnaire)
          if (selQ) {
            try {
              const qs = typeof selQ.questions === 'string' ? JSON.parse(selQ.questions) : selQ.questions
              if (Array.isArray(qs)) {
                for (const q of qs) {
                  const qKey = q.key || q.id
                  if (q.required && qKey && !surveyResponses[qKey]) return false
                }
              }
            } catch {}
          }
          return true
        }
        // When a questionnaire is selected (manually or step-assigned), required questions must be filled
        if (selectedQuestionnaire && !skipSurvey) {
          const selQ = questionnaires.find(qn => qn.id === selectedQuestionnaire)
          if (selQ) {
            try {
              const qs = typeof selQ.questions === 'string' ? JSON.parse(selQ.questions) : selQ.questions
              if (Array.isArray(qs)) {
                for (const q of qs) {
                  const qKey = q.key || q.id
                  if (q.required && qKey && !surveyResponses[qKey]) return false
                }
              }
            } catch {}
          }
        }
        return true
      }
      case 'questionnaire': {
        for (const q of customQuestions) {
          if (q.is_required && !customQuestionValues[q.question_key]) return false
          if (q.question_key.toLowerCase().includes('goldrush_id')) {
            const gv = customQuestionValues[q.question_key] || ''
            if (gv && gv.length !== GOLDRUSH_ID_LENGTH) return false
          }
        }
        return true
      }
      case 'photo': {
        if (photos.length === 0) return false
        const currentCompany = companies.find(c => c.id === selectedCompany)
        if (isGoldrushCompany(currentCompany) && visitTargetType === 'individual') {
          if (photoVerification.status === 'checking') return false
          if (photoVerification.status === 'mismatch' && !photoIdMismatchAcknowledged) return false
          if (photoVerification.hasBtag !== true && !photoNoBtagAcknowledged) return false
        }
        return true
      }
      case 'review': return visitTargetType === 'individual' || visitTargetType === 'store' || visitTargetType === 'survey'
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
        const goldrushQ = customQuestions.find(q => q.question_key.toLowerCase().includes('goldrush_id'))
        if (visitTargetType === 'individual' || goldrushQ) {
          const result = await checkIndividualDuplicate()
          if (result?.has_duplicates) {
            const dupFields = (result.duplicates || []).map((d: any) => d.field)
            if (dupFields.includes('goldrush_id')) {
              setError('This Goldrush ID has already been used. Goldrush IDs must be unique.')
              return
            }
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
    if (visitTargetType !== 'individual' && visitTargetType !== 'store' && visitTargetType !== 'survey') {
      setError('Please go back and select a visit type (Individual, Store/Business, or Survey).')
      toast.error('Visit type not selected.')
      return
    }
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
        // Include custom field values for store visits too (not just individual)
        if (Object.keys(customFieldValues).length > 0) {
          payload.custom_field_values = customFieldValues
        }
      }

      if (selectedQuestionnaire && Object.keys(surveyResponses).length > 0) {
        payload.questionnaire_id = selectedQuestionnaire
        payload.survey_responses = surveyResponses
      }

      // Survey step assigned on a store/individual visit → save visit as survey type
      // so it appears in survey reports instead of store/individual reports
      const isSurveyStepAssigned = visitTargetType !== 'survey' && !!selectedQuestionnaire &&
        processFlowSteps.some(s => {
          if (s.step_key !== 'survey') return false
          return parseStepConfig(s.config).questionnaire_id === selectedQuestionnaire
        })
      if (isSurveyStepAssigned) {
        payload.visit_target_type = 'survey'
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
          photo_type: visitTargetType === 'individual' ? 'goldrush_individual' : 'board',
          captured_at: p.timestamp
        }))
      }

      // Flag photo issues so backend logs them to goldrush_upload_failures
      if (photoIdMismatchAcknowledged) {
        payload.goldrush_photo_mismatch = true
      }
      if (photoNoBtagAcknowledged) {
        payload.goldrush_no_btag = true
      }

      const result = await fieldOperationsService.createVisitWorkflow(payload as Parameters<typeof fieldOperationsService.createVisitWorkflow>[0])
      // Visit persisted server-side — draft no longer needed (covers both the
      // warnings branch and the success branch below)
      clearVisitDraft()
      // Invalidate performance caches so reports update immediately
      queryClient.invalidateQueries({ queryKey: ['field-ops-performance'] })
      queryClient.invalidateQueries({ queryKey: ['field-ops-kpis'] })
      queryClient.invalidateQueries({ queryKey: ['field-ops-drill-down'] })
      queryClient.invalidateQueries({ queryKey: ['field-ops-agent-perf'] })
      queryClient.invalidateQueries({ queryKey: ['field-ops-conversions'] })
      queryClient.invalidateQueries({ queryKey: ['field-ops-hourly'] })
      queryClient.invalidateQueries({ queryKey: ['field-ops-daily'] })

      const warnings = result?.validation_warnings as { id_number?: string; goldrush_id?: string } | undefined
      if (warnings && Object.keys(warnings).length > 0) {
        // Visit was saved but has data issues — show inline warnings, don't auto-navigate
        setValidationWarnings(warnings)
        toast.error('Visit saved with errors — please review below', 5000)
      } else {
        toast.success('Visit created successfully!')
        const isAgentContext = window.location.pathname.startsWith('/agent/')
        navigate(isAgentContext ? '/agent/visits' : '/field-operations/visits')
      }
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
          <Grid item xs={12} sm={4}>
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
          <Grid item xs={12} sm={4}>
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
          {!hideSurveyVisitType && (
          <Grid item xs={12} sm={4}>
            <Card
              sx={{
                cursor: 'pointer',
                border: visitTargetType === 'survey' ? 2 : 1,
                borderColor: visitTargetType === 'survey' ? 'primary.main' : 'divider',
                bgcolor: visitTargetType === 'survey' ? 'primary.50' : 'background.paper',
                transition: 'all 0.2s',
                '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' }
              }}
              onClick={() => setVisitTargetType('survey')}
            >
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <SurveyIcon sx={{ fontSize: 48, color: visitTargetType === 'survey' ? 'primary.main' : 'text.secondary', mb: 2 }} />
                <Typography variant="h6">Survey</Typography>
                <Typography variant="body2" color="text.secondary">
                  Complete a standalone survey or questionnaire
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          )}
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
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth>
                  <InputLabel>ID Type</InputLabel>
                  <Select
                    label="ID Type"
                    value={individualIdType}
                    onChange={(e) => { setIndividualIdType(e.target.value as IdType); setDuplicateCheck(null); }}
                  >
                    <MenuItem value="sa_id">SA ID</MenuItem>
                    <MenuItem value="passport">Passport</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={3}>
                {(() => {
                  const idErr = idError(individualIdType, individualIdNumber)
                  const isSaId = individualIdType === 'sa_id'
                  // Goldrush individuals: ID/passport is mandatory (phone is not a substitute).
                  const goldrushInd = isGoldrushCompany(companies.find(c => c.id === selectedCompany))
                  const idRequired = goldrushInd || !individualPhone
                  return (
                    <TextField
                      fullWidth
                      label={`${isSaId ? 'SA ID Number' : 'Passport No.'} ${idRequired ? '*' : ''}`}
                      value={individualIdNumber}
                      onChange={(e) => {
                        const v = isSaId ? e.target.value.replace(/\D/g, '') : e.target.value.toUpperCase()
                        setIndividualIdNumber(v)
                        setDuplicateCheck(null)
                      }}
                      inputProps={isSaId ? { inputMode: 'numeric', pattern: '[0-9]*', maxLength: 13 } : { maxLength: 12 }}
                      placeholder={isSaId ? '8001015009087' : 'e.g. A12345678'}
                      helperText={
                        idErr ? idErr
                        : (showValidation && !individualIdNumber && idRequired ? (goldrushInd ? 'ID or passport is required' : 'ID number or phone is required')
                        : 'Must be unique - cannot be duplicated')
                      }
                      error={!!idErr || (showValidation && !individualIdNumber && idRequired) || duplicateCheck?.duplicates?.some(d => d.field === 'id_number') || false}
                    />
                  )
                })()}
              </Grid>
              <Grid item xs={12} sm={6}>
                {(() => {
                  // Goldrush individuals require ID/passport, so phone is never the fallback → never required.
                  const goldrushInd = isGoldrushCompany(companies.find(c => c.id === selectedCompany))
                  const phoneRequired = !goldrushInd && !individualIdNumber
                  return (
                    <TextField
                      fullWidth
                      label={`Phone Number ${phoneRequired ? '*' : ''}`}
                      value={individualPhone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9+]/g, '')
                        setIndividualPhone(val)
                        setDuplicateCheck(null)
                      }}
                      helperText={individualPhone && !/^(\+27|0)[0-9]{9}$/.test(individualPhone) ? 'Enter valid SA number: +27XXXXXXXXX or 0XXXXXXXXX' : (showValidation && !individualPhone && phoneRequired ? 'ID number or phone is required' : 'Must be unique - cannot be duplicated')}
                      error={(showValidation && !individualPhone && phoneRequired) || (!!individualPhone && !/^(\+27|0)[0-9]{9}$/.test(individualPhone)) || duplicateCheck?.duplicates?.some(d => d.field === 'phone') || false}
                      placeholder="+27XXXXXXXXX or 0XXXXXXXXX"
                    />
                  )
                })()}
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

            {/* Goldrush ID is pre-filled below from the system photo. This only fires if the
                agent has since edited it away from what the photo showed, or the field wasn't
                ready yet to auto-fill at photo-capture time. The B-Tag check itself already
                happened (and was gated) on the Photo step. */}
            {(() => {
              const currentCompany = companies.find(c => c.id === selectedCompany)
              if (!isGoldrushCompany(currentCompany) || photos.length === 0) return null
              const goToPhotoStep = () => {
                removePhoto(photos.length - 1)
                const photoStepIndex = activeSteps.findIndex(s => s.step_key === 'photo')
                if (photoStepIndex !== -1) setActiveStep(photoStepIndex)
              }
              if (photoVerification.status === 'mismatch') {
                return (
                  <Alert
                    severity="error"
                    sx={{ mt: 2 }}
                    action={
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 160 }}>
                        <Button size="small" color="inherit" variant="outlined" onClick={goToPhotoStep}>
                          Change Photo
                        </Button>
                        <Button
                          size="small"
                          color="inherit"
                          variant="contained"
                          onClick={() => setPhotoIdMismatchAcknowledged(true)}
                          disabled={photoIdMismatchAcknowledged}
                        >
                          {photoIdMismatchAcknowledged ? 'Proceeding anyway' : 'Submit Anyway'}
                        </Button>
                      </Box>
                    }
                  >
                    <strong>Goldrush ID mismatch.</strong> The Goldrush ID below does not match the ID read from
                    the photo{photoVerification.extractedId ? ` (${photoVerification.extractedId})` : ''}.
                    This will be flagged in the team lead report.
                  </Alert>
                )
              }
              return null
            })()}
          </>
        )}

        {visitTargetType === 'store' && (
          <>
            <Typography variant="h6" gutterBottom>Store / Customer Selection</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              The same store cannot be visited within 30 days.
            </Typography>
            <Typography variant="caption" color="error" sx={{ mb: 2, display: 'block' }}>* Required fields</Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 2 }}>
              <Autocomplete
                freeSolo
                options={customers}
                getOptionLabel={(c) => typeof c === 'string' ? c : (c.name || c.business_name || c.code || 'Unknown')}
                value={selectedCustomer ? (customers.find(c => c.id === selectedCustomer) || null) : (newStoreName || null)}
                onChange={async (_e, newValue) => {
                  if (typeof newValue === 'string') {
                    setSelectedCustomer('')
                    setNewStoreName(newValue)
                    setStoreRevisitCheck(null)
                  } else if (newValue) {
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
                  <TextField {...params} label="Search existing store *" fullWidth required={!newStoreName} helperText={showValidation && !selectedCustomer && !newStoreName ? 'Please select or enter a store' : (newStoreName && !selectedCustomer ? `New store "${newStoreName}" will be created` : 'Search by store name')} error={showValidation && !selectedCustomer && !newStoreName} />
                )}
                sx={{ flex: 1 }}
              />
              <Button
                variant="outlined"
                startIcon={<AddStoreIcon />}
                onClick={() => {
                  setNewStoreForm({ name: newStoreName, address: '', contact_person: '', contact_phone: '' })
                  setNewStoreFormError('')
                  setNewStoreDialogOpen(true)
                }}
                sx={{ mt: 0.5, whiteSpace: 'nowrap', height: 56 }}
              >
                Add New
              </Button>
            </Box>

            {/* Add New Store Dialog */}
            <Dialog open={newStoreDialogOpen} onClose={() => setNewStoreDialogOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle>Add New Store</DialogTitle>
              <DialogContent>
                {newStoreFormError && <Alert severity="error" sx={{ mb: 2 }}>{newStoreFormError}</Alert>}
                <TextField
                  label="Store Name *"
                  value={newStoreForm.name}
                  onChange={e => setNewStoreForm(f => ({ ...f, name: e.target.value }))}
                  fullWidth
                  required
                  sx={{ mt: 1, mb: 2 }}
                  autoFocus
                />
                <TextField
                  label="Address"
                  value={newStoreForm.address}
                  onChange={e => setNewStoreForm(f => ({ ...f, address: e.target.value }))}
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Contact Person"
                  value={newStoreForm.contact_person}
                  onChange={e => setNewStoreForm(f => ({ ...f, contact_person: e.target.value }))}
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Contact Phone"
                  value={newStoreForm.contact_phone}
                  onChange={e => setNewStoreForm(f => ({ ...f, contact_phone: e.target.value }))}
                  fullWidth
                />
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setNewStoreDialogOpen(false)} disabled={savingNewStore}>Cancel</Button>
                <Button
                  variant="contained"
                  disabled={savingNewStore || !newStoreForm.name.trim()}
                  onClick={async () => {
                    if (!newStoreForm.name.trim()) { setNewStoreFormError('Store name is required'); return; }
                    setSavingNewStore(true)
                    setNewStoreFormError('')
                    try {
                      const res = await apiClient.post('/customers', {
                        name: newStoreForm.name.trim(),
                        address: newStoreForm.address.trim() || undefined,
                        contact_person: newStoreForm.contact_person.trim() || undefined,
                        contact_phone: newStoreForm.contact_phone.trim() || undefined,
                        customer_type: 'SHOP',
                        type: 'retail',
                      })
                      const newId = res.data?.data?.id
                      if (!newId) throw new Error('No ID returned')
                      // Add to local list and auto-select
                      const newCustomer = { id: newId, name: newStoreForm.name.trim(), address: newStoreForm.address.trim() || undefined }
                      setCustomers(prev => [newCustomer, ...prev])
                      setSelectedCustomer(newId)
                      setNewStoreName('')
                      setStoreRevisitCheck(null)
                      setNewStoreDialogOpen(false)
                      await checkStoreRevisit(newId)
                    } catch (err: unknown) {
                      setNewStoreFormError(extractErrorMessage(err))
                    } finally {
                      setSavingNewStore(false)
                    }
                  }}
                >
                  {savingNewStore ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
                  {savingNewStore ? 'Saving...' : 'Save Store'}
                </Button>
              </DialogActions>
            </Dialog>

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

        {/* Company-level custom questions — moved to dedicated questionnaire step when one is in the flow */}
        {customQuestions.length > 0 && !hasQuestionnaireStep && (
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
                const isGoldrushId = q.question_key.toLowerCase().includes('goldrush_id')
                const goldrushLenError = isGoldrushId && val.length > 0 && val.length !== GOLDRUSH_ID_LENGTH
                const goldrushDuplicate = isGoldrushId && (duplicateCheck?.duplicates?.some(d => d.field === 'goldrush_id') || false)
                return (
                <Grid item xs={12} sm={6} key={q.id}>
                  {isNationalIdKey(q.question_key) ? (() => {
                    const idType = companyIdTypes[q.question_key] || 'sa_id'
                    const isSaId = idType === 'sa_id'
                    const idErr = idError(idType, val)
                    const requiredMissing = showValidation && !!q.is_required && !val
                    return (
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <FormControl sx={{ minWidth: 110 }}>
                          <InputLabel>ID Type</InputLabel>
                          <Select
                            label="ID Type"
                            value={idType}
                            onChange={(e) => setCompanyIdTypes(prev => ({ ...prev, [q.question_key]: e.target.value as IdType }))}
                          >
                            <MenuItem value="sa_id">SA ID</MenuItem>
                            <MenuItem value="passport">Passport</MenuItem>
                          </Select>
                        </FormControl>
                        <TextField
                          fullWidth
                          required={!!q.is_required}
                          label={`${q.question_label}${q.is_required ? ' *' : ''}`}
                          value={val}
                          onChange={(e) => {
                            const newVal = isSaId ? e.target.value.replace(/\D/g, '') : e.target.value.toUpperCase()
                            setCustomQuestionValues(prev => ({ ...prev, [q.question_key]: newVal }))
                          }}
                          inputProps={isSaId ? { inputMode: 'numeric', pattern: '[0-9]*', maxLength: 13 } : { maxLength: 12 }}
                          placeholder={isSaId ? '8001015009087' : 'e.g. A12345678'}
                          error={!!idErr || requiredMissing}
                          helperText={idErr || (requiredMissing ? 'This field is required' : (isSaId ? 'SA ID — 13 digits' : 'Passport — 6–12 letters/numbers'))}
                        />
                      </Box>
                    )
                  })() : q.field_type === 'select' && opts.length > 0 ? (
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
                        {val ? 'Photo captured' : (isGoldrushCompany(companies.find(c => c.id === selectedCompany)) && visitTargetType === 'individual' ? 'Upload System Photo' : 'Take / Upload Photo')}
                        <input
                          type="file"
                          accept="image/*"
                          {...(!(isGoldrushCompany(companies.find(c => c.id === selectedCompany)) && visitTargetType === 'individual') ? { capture: 'environment' as const } : {})}
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
                      type={isGoldrushId ? 'text' : q.field_type === 'number' ? 'number' : q.field_type === 'email' ? 'email' : q.field_type === 'phone' ? 'tel' : 'text'}
                      value={val}
                      onChange={(e) => {
                        const newVal = isGoldrushId ? e.target.value.replace(/[^0-9]/g, '') : e.target.value
                        setCustomQuestionValues(prev => ({ ...prev, [q.question_key]: newVal }))
                        if (isGoldrushId) setDuplicateCheck(null)
                      }}
                      inputProps={{
                        minLength: q.min_length || undefined,
                        maxLength: isGoldrushId ? GOLDRUSH_ID_LENGTH : (q.max_length || undefined),
                        ...(isGoldrushId ? { inputMode: 'numeric' as const, pattern: '[0-9]*' } : {})
                      }}
                      // Goldrush ID is capture-only: filled from the system photo (OCR), never typed.
                      InputProps={isGoldrushId ? { readOnly: true } : undefined}
                      helperText={
                        showValidation && !!q.is_required && !val ? 'This field is required'
                        : goldrushDuplicate ? 'This Goldrush ID has already been used'
                        : goldrushLenError ? `Goldrush ID must be exactly ${GOLDRUSH_ID_LENGTH} digits`
                        : isGoldrushId ? `Captured from the Goldrush photo — exactly ${GOLDRUSH_ID_LENGTH} digits`
                        : lenHelper
                      }
                      error={lenError || goldrushLenError || goldrushDuplicate || (showValidation && !!q.is_required && !val)}
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
    // True when the questionnaire is pre-assigned via a process flow step (non-Goldrush
    // store/individual visit). The picker is suppressed; the agent just answers questions.
    const isStepAssigned = visitTargetType !== 'survey' && !!selectedQuestionnaire &&
      processFlowSteps.some(s => {
        if (s.step_key !== 'survey') return false
        return parseStepConfig(s.config).questionnaire_id === selectedQuestionnaire
      })
    const assignedQuestionnaire = isStepAssigned
      ? questionnaires.find(qn => qn.id === selectedQuestionnaire) ?? null
      : null

    // When showing the picker, only show surveys assigned to the agent's company.
    // Surveys declare their company assignments in `brand_ids` (JSON array of company ids)
    // or the legacy single `company_id` field.
    const pickerQuestionnaires = isMobileContext && selectedCompany
      ? questionnaires.filter((q: Questionnaire & { brand_ids?: unknown; company_id?: string }) => {
          let companyIds: string[] = []
          try {
            companyIds = Array.isArray(q.brand_ids)
              ? q.brand_ids as string[]
              : (typeof q.brand_ids === 'string' && q.brand_ids ? JSON.parse(q.brand_ids as string) : [])
          } catch { companyIds = [] }
          if (companyIds.map(String).includes(String(selectedCompany))) return true
          if (q.company_id && String(q.company_id) === String(selectedCompany)) return true
          return false
        })
      : questionnaires

    const parsedQuestions: Array<{ id?: string; key?: string; question?: string; label?: string; question_text?: string; question_label?: string; type?: string; question_type?: string; options?: string[]; required?: boolean }> = selectedQuestionnaire
      ? (() => {
          const q = questionnaires.find(qn => qn.id === selectedQuestionnaire)
          if (!q) return []
          try { return typeof q.questions === 'string' ? JSON.parse(q.questions) : q.questions } catch { return [] }
        })()
      : []

    const isQuestionnaireChoice = formChoice === 'questionnaire'
    const stepTitle = formChoice === 'survey' ? 'Survey' : isQuestionnaireChoice ? 'Questionnaire' : 'Survey'
    const selectLabel = formChoice === 'survey' ? 'Select Survey' : isQuestionnaireChoice ? 'Select Questionnaire' : 'Select Survey / Questionnaire'

    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>{stepTitle}</Typography>
          {visitTargetType === 'survey' && pickerQuestionnaires.length === 0 ? (
            !questionnairesLoaded ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">Loading surveys…</Typography>
              </Box>
            ) : (
              <Alert severity="warning">
                There is no survey currently available for your company. You cannot
                continue this survey visit. Please go back and choose a different
                visit type.
              </Alert>
            )
          ) : (
          <>
          {surveyRequired && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {`A ${stepTitle.toLowerCase()} is required for this visit type and brand.`}
            </Alert>
          )}

          {!skipSurvey && (
            <>
              {isStepAssigned ? (
                // Questionnaire was pre-assigned via the process flow step — no picker needed
                <Alert severity="info" sx={{ mb: 2 }}>
                  {assignedQuestionnaire
                    ? <>Survey: <strong>{assignedQuestionnaire.name}</strong></>
                    : !questionnairesLoaded
                      ? 'Loading survey…'
                      : 'Survey not found — please contact your supervisor.'}
                </Alert>
              ) : (
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>{selectLabel}</InputLabel>
                <Select
                  value={selectedQuestionnaire}
                  label={selectLabel}
                  onChange={(e) => {
                    setSelectedQuestionnaire(e.target.value)
                    setSurveyResponses({})
                  }}
                >
                  <MenuItem value="">None</MenuItem>
                  {pickerQuestionnaires.map(q => (
                    <MenuItem key={q.id} value={q.id}>{q.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              )}

              {parsedQuestions.length > 0 && (
                <Box>
                  {parsedQuestions.map((q, idx) => {
                    const qKey = q.key || q.id || String(idx)
                    // Question text and type vary by which builder created the survey:
                    // SurveyBuilderPage uses label/type; the field-ops survey builder
                    // uses question_text/question_type. Support both so the agent never
                    // sees the raw id/key in place of the question.
                    const qLabel = q.label || q.question || q.question_text || q.question_label || qKey
                    const qType = q.type || q.question_type || 'text'
                    const qOptions = Array.isArray(q.options) ? q.options : []
                    const hasOptions = qOptions.length > 0
                    // The field-ops survey builder has no dedicated multi-select type, so a
                    // "tick all that apply" question is authored as multiple_choice. Treat
                    // explicit multi types — and any option question whose text asks to
                    // select multiple — as checkboxes; other option questions are single-select.
                    const isMultiSelect = ['multiselect', 'multi_select', 'checkbox', 'checkboxes'].includes(qType)
                      || /tick all|select all|choose all|all that apply/i.test(qLabel)
                    const selectedOptions = (surveyResponses[qKey] || '').split(',').map(s => s.trim()).filter(Boolean)
                    const isRequired = !!q.required
                    const hasValue = !!surveyResponses[qKey]
                    return (
                    <Box key={qKey} sx={{ mb: 3 }}>
                      <Typography variant="body1" fontWeight="bold" sx={{ mb: 1 }}>
                        {idx + 1}. {qLabel}{isRequired ? ' *' : ''}
                      </Typography>
                      {showValidation && isRequired && !hasValue && (
                        <Typography variant="caption" color="error" sx={{ mb: 0.5, display: 'block' }}>
                          This field is required
                        </Typography>
                      )}
                      {qType === 'image' ? (
                        <Box>
                          {surveyResponses[qKey] ? (
                            <Box sx={{ position: 'relative', display: 'inline-block' }}>
                              <img src={surveyResponses[qKey]} alt={qLabel} style={{ maxWidth: 200, maxHeight: 200, borderRadius: 8 }} />
                              <Button size="small" color="error" onClick={() => setSurveyResponses(prev => { const n = { ...prev }; delete n[qKey]; return n })} sx={{ position: 'absolute', top: 0, right: 0 }}>Remove</Button>
                            </Box>
                          ) : (
                            <Button variant="outlined" component="label" color={showValidation && isRequired && !hasValue ? 'error' : 'primary'}>
                              Upload Photo{isRequired ? ' (Required)' : ''}
                              <input type="file" hidden accept="image/*" capture="environment" onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  const reader = new FileReader()
                                  reader.onload = async () => {
                                    const compressed = await compressImage(reader.result as string)
                                    setSurveyResponses(prev => ({ ...prev, [qKey]: compressed }))
                                  }
                                  reader.readAsDataURL(file)
                                }
                              }} />
                            </Button>
                          )}
                        </Box>
                      ) : hasOptions && isMultiSelect ? (
                        // Multi-select: "tick all that apply" — stored as a comma-separated list
                        <FormGroup>
                          {qOptions.map(opt => (
                            <FormControlLabel
                              key={opt}
                              control={
                                <Checkbox
                                  checked={selectedOptions.includes(opt)}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? [...selectedOptions, opt]
                                      : selectedOptions.filter(o => o !== opt)
                                    setSurveyResponses(prev => ({ ...prev, [qKey]: next.join(',') }))
                                  }}
                                />
                              }
                              label={opt}
                            />
                          ))}
                        </FormGroup>
                      ) : hasOptions && qType === 'select' ? (
                        <FormControl fullWidth error={showValidation && isRequired && !hasValue}>
                          <Select
                            value={surveyResponses[qKey] || ''}
                            onChange={(e) => setSurveyResponses(prev => ({ ...prev, [qKey]: e.target.value }))}
                            displayEmpty
                          >
                            <MenuItem value="">Select an answer</MenuItem>
                            {qOptions.map(opt => (
                              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : hasOptions ? (
                        // Single-select option question (radio / multiple_choice)
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {qOptions.map(opt => (
                            <Button
                              key={opt}
                              variant={surveyResponses[qKey] === opt ? 'contained' : 'outlined'}
                              color={surveyResponses[qKey] === opt ? (opt === 'Yes' ? 'success' : opt === 'No' ? 'error' : 'primary') : 'inherit'}
                              onClick={() => setSurveyResponses(prev => ({ ...prev, [qKey]: opt }))}
                              size="small"
                            >
                              {opt}
                            </Button>
                          ))}
                        </Box>
                      ) : (
                        <TextField
                          fullWidth
                          multiline={qType === 'textarea'}
                          rows={qType === 'textarea' ? 3 : 1}
                          value={surveyResponses[qKey] || ''}
                          onChange={(e) => setSurveyResponses(prev => ({ ...prev, [qKey]: e.target.value }))}
                          placeholder="Enter your answer"
                          error={showValidation && isRequired && !hasValue}
                        />
                      )}
                    </Box>
                  )})}
                </Box>
              )}

              {pickerQuestionnaires.length === 0 && !isStepAssigned && (
                <Typography variant="body2" color="text.secondary">
                  {`No ${stepTitle.toLowerCase()}s available for this visit type.`}
                </Typography>
              )}
            </>
          )}
          </>
          )}
        </CardContent>
      </Card>
    )
  }

  // True when the active process flow has a dedicated questionnaire step —
  // used to move custom questions out of the details step into their own step.
  const hasQuestionnaireStep = activeSteps.some(s => s.step_key === 'questionnaire')

  const renderQuestionnaireStep = () => {
    if (stepDataLoading) {
      return (
        <Card><CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">Loading questions…</Typography>
          </Box>
        </CardContent></Card>
      )
    }
    if (customQuestions.length === 0) {
      return (
        <Card><CardContent>
          <Typography variant="h6" gutterBottom>Questionnaire</Typography>
          <Alert severity="info">No questions configured for this company and visit type.</Alert>
        </CardContent></Card>
      )
    }
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Questionnaire</Typography>
          <Box>
            {customQuestions.map((q, idx) => {
              const qKey = q.question_key
              const qLabel = q.question_label
              const qType = q.field_type
              const rawOptions = q.field_options
              const qOptions: string[] = rawOptions
                ? (() => { try { return Array.isArray(JSON.parse(rawOptions)) ? JSON.parse(rawOptions) : [] } catch { return [] } })()
                : []
              const hasOptions = qOptions.length > 0
              const isMultiSelect = qType === 'checkbox'
              const isRequired = !!q.is_required
              const hasValue = !!customQuestionValues[qKey]
              const isGoldrushId = qKey.toLowerCase().includes('goldrush_id')
              const selectedOptions = (customQuestionValues[qKey] || '').split(',').map(s => s.trim()).filter(Boolean)
              return (
                <Box key={qKey} sx={{ mb: 3 }}>
                  <Typography variant="body1" fontWeight="bold" sx={{ mb: 1 }}>
                    {idx + 1}. {qLabel}{isRequired ? ' *' : ''}
                  </Typography>
                  {showValidation && isRequired && !hasValue && (
                    <Typography variant="caption" color="error" sx={{ mb: 0.5, display: 'block' }}>This field is required</Typography>
                  )}
                  {qType === 'image' ? (
                    <Box>
                      {customQuestionValues[qKey] ? (
                        <Box sx={{ position: 'relative', display: 'inline-block' }}>
                          <img src={customQuestionValues[qKey]} alt={qLabel} style={{ maxWidth: 200, maxHeight: 200, borderRadius: 8 }} />
                          <Button size="small" color="error" onClick={() => setCustomQuestionValues(prev => { const n = { ...prev }; delete n[qKey]; return n })} sx={{ position: 'absolute', top: 0, right: 0 }}>Remove</Button>
                        </Box>
                      ) : (
                        <Button variant="outlined" component="label" color={showValidation && isRequired && !hasValue ? 'error' : 'primary'}>
                          {isGoldrushCompany(companies.find(c => c.id === selectedCompany)) && visitTargetType === 'individual' ? 'Upload System Photo' : 'Upload Photo'}{isRequired ? ' (Required)' : ''}
                          <input type="file" hidden accept="image/*" {...(!(isGoldrushCompany(companies.find(c => c.id === selectedCompany)) && visitTargetType === 'individual') ? { capture: 'environment' as const } : {})} onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              const reader = new FileReader()
                              reader.onload = async () => {
                                const compressed = await compressImage(reader.result as string)
                                setCustomQuestionValues(prev => ({ ...prev, [qKey]: compressed }))
                              }
                              reader.readAsDataURL(file)
                            }
                          }} />
                        </Button>
                      )}
                    </Box>
                  ) : qType === 'toggle' ? (
                    <FormControlLabel
                      control={<Switch checked={customQuestionValues[qKey] === 'Yes'} onChange={(e) => setCustomQuestionValues(prev => ({ ...prev, [qKey]: e.target.checked ? 'Yes' : 'No' }))} />}
                      label={customQuestionValues[qKey] === 'Yes' ? 'Yes' : 'No'}
                    />
                  ) : isMultiSelect && hasOptions ? (
                    <FormGroup>
                      {qOptions.map(opt => (
                        <FormControlLabel key={opt} control={
                          <Checkbox checked={selectedOptions.includes(opt)} onChange={(e) => {
                            const next = e.target.checked ? [...selectedOptions, opt] : selectedOptions.filter(o => o !== opt)
                            setCustomQuestionValues(prev => ({ ...prev, [qKey]: next.join(',') }))
                          }} />
                        } label={opt} />
                      ))}
                    </FormGroup>
                  ) : qType === 'radio' && hasOptions ? (
                    <RadioGroup value={customQuestionValues[qKey] || ''} onChange={(e) => setCustomQuestionValues(prev => ({ ...prev, [qKey]: e.target.value }))}>
                      {qOptions.map(opt => <FormControlLabel key={opt} value={opt} control={<Radio />} label={opt} />)}
                    </RadioGroup>
                  ) : qType === 'select' && hasOptions ? (
                    <FormControl fullWidth error={showValidation && isRequired && !hasValue}>
                      <Select value={customQuestionValues[qKey] || ''} onChange={(e) => setCustomQuestionValues(prev => ({ ...prev, [qKey]: e.target.value }))} displayEmpty>
                        <MenuItem value="">Select an answer</MenuItem>
                        {qOptions.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                      </Select>
                    </FormControl>
                  ) : (
                    <TextField fullWidth multiline={qType === 'textarea'} rows={qType === 'textarea' ? 3 : 1}
                      type={isGoldrushId ? 'text' : qType === 'number' ? 'number' : qType === 'email' ? 'email' : qType === 'phone' ? 'tel' : 'text'}
                      value={customQuestionValues[qKey] || ''} onChange={(e) => setCustomQuestionValues(prev => ({ ...prev, [qKey]: isGoldrushId ? e.target.value.replace(/[^0-9]/g, '') : e.target.value }))}
                      placeholder={isGoldrushId ? 'Captured from the Goldrush photo' : 'Enter your answer'}
                      error={(showValidation && isRequired && !hasValue) || (isGoldrushId && !!customQuestionValues[qKey] && customQuestionValues[qKey].length !== GOLDRUSH_ID_LENGTH)}
                      helperText={isGoldrushId ? `Captured from the Goldrush photo — exactly ${GOLDRUSH_ID_LENGTH} digits` : undefined}
                      // Goldrush ID is capture-only: filled from the system photo (OCR), never typed.
                      InputProps={isGoldrushId ? { readOnly: true } : undefined}
                      inputProps={isGoldrushId ? { inputMode: 'numeric' as const, maxLength: GOLDRUSH_ID_LENGTH } : (q.min_length || q.max_length ? { minLength: q.min_length, maxLength: q.max_length } : undefined)}
                    />
                  )}
                </Box>
              )
            })}
          </Box>
        </CardContent>
      </Card>
    )
  }

  const renderPhotoStep = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {visitTargetType === 'individual'
            ? 'Goldrush System Photo'
            : visitTargetType === 'survey'
            ? 'Shop Picture'
            : 'Board Photo Capture'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {visitTargetType === 'individual' ? (
            <>Upload the individual&apos;s system photo from Goldrush first — we&apos;ll check it for a B-Tag before you enter their details. <strong>A photo is required to complete this capture.</strong></>
          ) : visitTargetType === 'survey' ? (
            <>Take a photo of the shop. Duplicate photos are not allowed. <strong>At least one photo is required.</strong></>
          ) : (
            <>Take a photo of the boards/signage. Answer the placement questions below, then capture a photo.
            Duplicate photos are not allowed. <strong>At least one photo is required.</strong></>
          )}
        </Typography>

        {/* Board Placement Questions — store visits only */}
        {visitTargetType !== 'survey' && visitTargetType !== 'individual' && (
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
        )}

        <Box sx={{ mb: 3, textAlign: 'center' }}>
          <Button
            variant="contained"
            component="label"
            startIcon={<CameraIcon />}
            size="large"
          >
            {visitTargetType === 'individual' ? 'Upload System Photo' : visitTargetType === 'survey' ? 'Take Shop Photo' : 'Take Photo'}
            <input
              type="file"
              hidden
              accept="image/*"
              {...(visitTargetType !== 'individual' ? { capture: 'environment' } : {})}
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

        {/* Goldrush photo ID verification status */}
        {visitTargetType === 'individual' && (() => {
          const currentCompany = companies.find(c => c.id === selectedCompany)
          if (!isGoldrushCompany(currentCompany) || photos.length === 0) return null
          if (photoVerification.status === 'checking') {
            return (
              <Alert severity="info" sx={{ mt: 2 }}>
                Verifying photo...
              </Alert>
            )
          }
          if (photoVerification.status === 'pending_id') {
            return (
              <Alert severity="info" sx={{ mt: 2 }}>
                Player ID {photoVerification.extractedId} read from the photo. It will be filled in
                automatically once you reach the Details step.
              </Alert>
            )
          }
          if (photoVerification.status === 'match') {
            return (
              <Alert severity="success" sx={{ mt: 2 }}>
                Goldrush ID {photoVerification.extractedId} read from the photo and
                pre-filled on the Details step — please confirm it&apos;s correct.
              </Alert>
            )
          }
          if (photoVerification.status === 'mismatch') {
            return (
              <Alert
                severity="error"
                sx={{ mt: 2 }}
                action={
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 160 }}>
                    <Button
                      size="small"
                      color="inherit"
                      variant="outlined"
                      onClick={() => removePhoto(photos.length - 1)}
                    >
                      Go Back &amp; Edit
                    </Button>
                    <Button
                      size="small"
                      color="inherit"
                      variant="contained"
                      onClick={() => setPhotoIdMismatchAcknowledged(true)}
                      disabled={photoIdMismatchAcknowledged}
                    >
                      {photoIdMismatchAcknowledged ? 'Proceeding anyway' : 'Submit Anyway'}
                    </Button>
                  </Box>
                }
              >
                <strong>Goldrush ID mismatch.</strong> The ID read from the photo
                {photoVerification.extractedId ? ` (${photoVerification.extractedId})` : ''} does not match the typed ID.
                This will be flagged in the team lead report.
              </Alert>
            )
          }
          if (photoVerification.status === 'unreadable') {
            return (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Could not read a Goldrush ID from the photo. The visit will still be recorded, but the team lead will be notified.
              </Alert>
            )
          }
          return null
        })()}

        {/* No B-Tag alert — shown independently of the ID mismatch check */}
        {visitTargetType === 'individual' && (() => {
          const currentCompany = companies.find(c => c.id === selectedCompany)
          if (!isGoldrushCompany(currentCompany) || photos.length === 0) return null
          if (photoVerification.status === 'idle' || photoVerification.status === 'checking') return null
          if (photoVerification.hasBtag === true) return null
          return (
            <Alert
              severity="error"
              sx={{ mt: 2 }}
              action={
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 160 }}>
                  <Button
                    size="small"
                    color="inherit"
                    variant="outlined"
                    onClick={() => removePhoto(photos.length - 1)}
                  >
                    Go Back &amp; Edit
                  </Button>
                  <Button
                    size="small"
                    color="inherit"
                    variant="contained"
                    onClick={() => setPhotoNoBtagAcknowledged(true)}
                    disabled={photoNoBtagAcknowledged}
                  >
                    {photoNoBtagAcknowledged ? 'Proceeding anyway' : 'Submit Anyway'}
                  </Button>
                </Box>
              }
            >
              <strong>No B-Tag number found.</strong> The photo URL does not show a Goldrush B-Tag
              (<em>goldrush.co.za/?btag=...</em>). This will be flagged in the team lead report.
            </Alert>
          )
        })()}

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
          <Chip
            label={visitTargetType === 'individual' ? 'Individual' : visitTargetType === 'store' ? 'Store / Business' : visitTargetType === 'survey' ? 'Survey' : '⚠ No type selected'}
            color={visitTargetType === 'individual' || visitTargetType === 'store' || visitTargetType === 'survey' ? 'primary' : 'error'}
            variant="outlined"
          />
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

        {/* Show custom question answers in review — not relevant for survey visits */}
        {Object.keys(customQuestionValues).length > 0 && visitTargetType !== 'survey' && (
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
      case 'questionnaire': return renderQuestionnaireStep()
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

      {validationWarnings && (
        <Alert
          severity="warning"
          sx={{ mb: 3 }}
          onClose={() => setValidationWarnings(null)}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setValidationWarnings(null)
                const isAgentContext = window.location.pathname.startsWith('/agent/')
                navigate(isAgentContext ? '/agent/visits' : '/field-operations/visits')
              }}
            >
              OK, Go Back
            </Button>
          }
        >
          <strong>Visit saved — but there are data errors your team lead can see:</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            {validationWarnings.id_number && <li>SA ID Number: {validationWarnings.id_number}</li>}
            {validationWarnings.goldrush_id && <li>Goldrush ID: {validationWarnings.goldrush_id}</li>}
            {validationWarnings.photo_mismatch && <li>Photo: {validationWarnings.photo_mismatch}</li>}
            {validationWarnings.no_btag && <li>B-Tag: {validationWarnings.no_btag}</li>}
          </ul>
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
            disabled={navigating || (stepDataLoading && (currentStepKey === 'details' || currentStepKey === 'survey')) || (currentStepKey === 'survey' && visitTargetType === 'survey' && questionnairesLoaded && questionnaires.length === 0)}
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
