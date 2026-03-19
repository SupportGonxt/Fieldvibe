import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box, Stepper, Step, StepLabel, Button, Paper, Typography, Alert,
  TextField, FormControl, InputLabel, Select, MenuItem, CircularProgress,
  Card, CardContent, Chip, IconButton, FormControlLabel, Switch, Divider,
  Grid, Autocomplete
} from '@mui/material'
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

const STEPS = [
  'GPS Check-in',
  'Visit Type',
  'Details',
  'Survey',
  'Photo Capture',
  'Review & Submit'
]

export default function VisitCreate() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [activeStep, setActiveStep] = useState(0)
  const [loading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Step 1: GPS
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

  // Step 5: Photo
  const [photos, setPhotos] = useState<Array<{ dataUrl: string; hash: string; gps: GpsLocation | null; timestamp: string }>>([])
  const [photoGps, setPhotoGps] = useState<GpsLocation | null>(null)
  const [photoDuplicateWarning, setPhotoDuplicateWarning] = useState<string | null>(null)

  // Notes
  const [notes, setNotes] = useState('')

  // Load form data on mount
  useEffect(() => {
    loadFormData()
  }, [])

  const loadFormData = async () => {
    try {
      const [companiesRes, customersRes] = await Promise.all([
        fieldOperationsService.getCompanies(),
        fieldOperationsService.getCustomers()
      ])
      const companiesData = companiesRes?.data || companiesRes || []
      const customersData = customersRes?.data?.data || customersRes?.data || customersRes || []
      setCompanies(Array.isArray(companiesData) ? companiesData : [])
      setCustomers(Array.isArray(customersData) ? customersData : [])
    } catch (err) {
      console.error('Failed to load form data:', err)
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

  // Auto-capture GPS on step 1
  useEffect(() => {
    if (activeStep === 0 && !gpsLocation && !gpsLoading) {
      captureGps()
    }
  }, [activeStep, gpsLocation, gpsLoading, captureGps])

  // Load custom fields when company changes
  useEffect(() => {
    if (selectedCompany) {
      loadCustomFields(selectedCompany)
      loadSurveyConfig(selectedCompany)
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

  // Load questionnaires
  useEffect(() => {
    if (activeStep === 3) {
      loadQuestionnaires()
    }
  }, [activeStep])

  const loadQuestionnaires = async () => {
    try {
      const res = await fieldOperationsService.getQuestionnaires({ visit_type: visitTargetType || undefined, brand_id: selectedCompany || undefined, target_type: visitTargetType || undefined, module: 'field_ops' })
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

  // Capture photo
  const handlePhotoCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setPhotoDuplicateWarning(null)

    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
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

  // Step validation
  const canProceed = (): boolean => {
    switch (activeStep) {
      case 0: return !!gpsLocation
      case 1: return visitTargetType === 'individual' || visitTargetType === 'store'
      case 2: {
        if (visitTargetType === 'individual') {
          if (!individualFirstName || !individualLastName) return false
          if (!individualIdNumber && !individualPhone) return false
          if (duplicateCheck?.has_duplicates) return false
          for (const field of customFields) {
            if (field.is_required && !customFieldValues[field.field_name]) return false
          }
          return true
        }
        if (visitTargetType === 'store') {
          if (!selectedCustomer && !newStoreName) return false
          if (selectedCustomer && storeRevisitCheck && !storeRevisitCheck.can_visit) return false
          return true
        }
        return false
      }
      case 3: {
        if (surveyRequired && !skipSurvey) {
          if (!selectedQuestionnaire) return false
          return Object.keys(surveyResponses).length > 0
        }
        return true
      }
      case 4: return photos.length > 0
      case 5: return true
      default: return false
    }
  }

  const handleNext = async () => {
    setError(null)
    if (activeStep === 2) {
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
  }

  const handleBack = () => {
    setError(null)
    setActiveStep(prev => prev - 1)
  }

  // Final submit
  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        visit_target_type: visitTargetType,
        checkin_latitude: gpsLocation?.latitude,
        checkin_longitude: gpsLocation?.longitude,
        company_id: selectedCompany || undefined,
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

      if (photos.length > 0) {
        payload.photos = photos.map(p => ({
          photo_url: p.dataUrl,
          photo_hash: p.hash,
          gps_latitude: p.gps?.latitude,
          gps_longitude: p.gps?.longitude,
          photo_type: 'board',
          captured_at: p.timestamp
        }))
      }

      await fieldOperationsService.createVisitWorkflow(payload as Parameters<typeof fieldOperationsService.createVisitWorkflow>[0])
      toast.success('Visit created successfully!')
      navigate('/field-operations/visits')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create visit'
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
        {/* Company Selection */}
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Company / Brand</InputLabel>
          <Select
            value={selectedCompany}
            label="Company / Brand"
            onChange={(e) => setSelectedCompany(e.target.value)}
          >
            <MenuItem value="">None</MenuItem>
            {companies.map(c => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {visitTargetType === 'individual' && (
          <>
            <Typography variant="h6" gutterBottom>Individual Details</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              ID number and phone must be unique. Duplicates will be blocked.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="First Name"
                  value={individualFirstName}
                  onChange={(e) => setIndividualFirstName(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="Last Name"
                  value={individualLastName}
                  onChange={(e) => setIndividualLastName(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="ID Number"
                  value={individualIdNumber}
                  onChange={(e) => { setIndividualIdNumber(e.target.value); setDuplicateCheck(null); }}
                  helperText="Must be unique - cannot be duplicated"
                  error={duplicateCheck?.duplicates?.some(d => d.field === 'id_number') || false}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  value={individualPhone}
                  onChange={(e) => { setIndividualPhone(e.target.value); setDuplicateCheck(null); }}
                  helperText="Must be unique - cannot be duplicated"
                  error={duplicateCheck?.duplicates?.some(d => d.field === 'phone') || false}
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
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              The same store cannot be visited within 30 days.
            </Typography>
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
                <TextField {...params} label="Search existing store or type new name" fullWidth required={!newStoreName} helperText={newStoreName && !selectedCustomer ? `New store "${newStoreName}" will be created` : 'Search by store name or type a new one'} />
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
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Fields specific to the selected brand/company.
            </Typography>
            <Grid container spacing={2}>
              {customFields.map(field => (
                <Grid item xs={12} sm={6} key={field.id}>
                  {field.field_type === 'select' && field.field_options ? (
                    <FormControl fullWidth required={!!field.is_required}>
                      <InputLabel>{field.field_label}</InputLabel>
                      <Select
                        value={customFieldValues[field.field_name] || ''}
                        label={field.field_label}
                        onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.field_name]: e.target.value }))}
                      >
                        {(() => { try { return JSON.parse(field.field_options!) as string[] } catch { return [] } })().map((opt: string) => (
                          <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <TextField
                      fullWidth
                      required={!!field.is_required}
                      label={field.field_label}
                      type={field.field_type === 'number' ? 'number' : 'text'}
                      value={customFieldValues[field.field_name] || ''}
                      onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.field_name]: e.target.value }))}
                    />
                  )}
                </Grid>
              ))}
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
          Take a photo of the boards/signage. GPS will be captured again at this point.
          Duplicate photos are not allowed.
        </Typography>

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
                    <Typography variant="caption" color="text.secondary">
                      {photo.gps ? `GPS: ${photo.gps.latitude.toFixed(4)}, ${photo.gps.longitude.toFixed(4)}` : 'No GPS'}
                    </Typography>
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

  const renderStepContent = () => {
    switch (activeStep) {
      case 0: return renderGpsStep()
      case 1: return renderVisitTypeStep()
      case 2: return renderDetailsStep()
      case 3: return renderSurveyStep()
      case 4: return renderPhotoStep()
      case 5: return renderReviewStep()
      default: return null
    }
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/field-operations/visits')} sx={{ mr: 1 }}>
          <BackIcon />
        </IconButton>
        <Typography variant="h5">Create Field Visit</Typography>
      </Box>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }} alternativeLabel>
        {STEPS.map((label) => (
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

      {/* Navigation */}
      <Paper sx={{ mt: 3, p: 2, display: 'flex', justifyContent: 'space-between' }}>
        <Button
          disabled={activeStep === 0}
          onClick={handleBack}
          startIcon={<BackIcon />}
        >
          Back
        </Button>

        {activeStep < STEPS.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={!canProceed()}
            endIcon={<NextIcon />}
          >
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            color="success"
            onClick={handleSubmit}
            disabled={submitting || !canProceed()}
            startIcon={submitting ? <CircularProgress size={20} /> : <SubmitIcon />}
          >
            {submitting ? 'Creating Visit...' : 'Submit Visit'}
          </Button>
        )}
      </Paper>
    </Box>
  )
}
