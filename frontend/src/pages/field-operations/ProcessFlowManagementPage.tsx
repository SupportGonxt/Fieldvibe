import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fieldOperationsService } from '../../services/field-operations.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import SearchableSelect from '../../components/ui/SearchableSelect'
import { toast } from 'react-hot-toast'
import {
  Workflow,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Building2,
  Link2,
  Unlink,
  AlertCircle,
  MessageSquare,
  Database,
  CheckCircle,
  Target,
  FileText,
} from 'lucide-react'
import { surveysService } from '../../services/surveys.service'

// ── Types ──

interface ProcessFlowStep {
  id?: string
  step_key: string
  step_label: string
  step_order: number
  is_required: boolean | number
  config?: Record<string, unknown>
}

interface ProcessFlow {
  id: string
  tenant_id: string
  name: string
  description: string
  is_default: number | boolean
  is_active: number | boolean
  created_at: string
  updated_at?: string
  steps?: ProcessFlowStep[]
}

interface CompanyProcessFlow {
  id: string
  company_id: string
  process_flow_id: string
  visit_target_type: string
  flow_name?: string
  flow_description?: string
}

interface CustomQuestion {
  id: string
  company_id: string
  question_label: string
  question_key: string
  field_type: string
  field_options?: string[]
  is_required: boolean | number
  display_order: number
  visit_target_type: string
  check_duplicate?: boolean | number
  min_length?: number
  max_length?: number
}

// ── Built-in flow fields already captured in the standard visit flow ──
const BUILT_IN_FLOW_FIELDS: Record<string, { label: string; appliesTo: 'individual' | 'store' | 'both' }> = {
  first_name: { label: 'First Name', appliesTo: 'individual' },
  last_name: { label: 'Last Name', appliesTo: 'individual' },
  customer_name: { label: 'Customer Name', appliesTo: 'individual' },
  individual_name: { label: 'Individual Name', appliesTo: 'individual' },
  name: { label: 'Name', appliesTo: 'both' },
  id_number: { label: 'ID Number', appliesTo: 'individual' },
  phone: { label: 'Phone Number', appliesTo: 'individual' },
  phone_number: { label: 'Phone Number', appliesTo: 'individual' },
  cell_number: { label: 'Cell Number', appliesTo: 'individual' },
  email: { label: 'Email', appliesTo: 'individual' },
  store_name: { label: 'Store Name', appliesTo: 'store' },
  shop_name: { label: 'Shop Name', appliesTo: 'store' },
  business_name: { label: 'Business Name', appliesTo: 'store' },
  address: { label: 'Address', appliesTo: 'store' },
  gps: { label: 'GPS Location', appliesTo: 'both' },
  latitude: { label: 'Latitude', appliesTo: 'both' },
  longitude: { label: 'Longitude', appliesTo: 'both' },
  visit_type: { label: 'Visit Type', appliesTo: 'both' },
  photo: { label: 'Photo', appliesTo: 'store' },
}

function checkDuplicateFlowField(questionKey: string, questionLabel: string, visitTargetType: string): string | null {
  const normalizedKey = questionKey.toLowerCase().replace(/[^a-z0-9]/g, '_')
  const normalizedLabel = questionLabel.toLowerCase().replace(/[^a-z0-9]/g, '_')
  for (const [key, info] of Object.entries(BUILT_IN_FLOW_FIELDS)) {
    if (info.appliesTo !== 'both' && visitTargetType !== 'both' && info.appliesTo !== visitTargetType) continue
    if (normalizedKey === key || normalizedLabel === key ||
        normalizedKey.includes(key) || normalizedLabel.includes(key)) {
      return `This question may duplicate the built-in "${info.label}" field already captured in the ${info.appliesTo === 'both' ? 'standard' : info.appliesTo} flow.`
    }
  }
  return null
}

// ── Available step definitions ──
const AVAILABLE_STEPS = [
  { key: 'gps', label: 'GPS Check-in', description: 'Capture GPS coordinates for visit location' },
  { key: 'visit_type', label: 'Visit Type', description: 'Select individual or store visit type' },
  { key: 'details', label: 'Details', description: 'Capture visit details, individual/store info' },
  { key: 'survey', label: 'Survey', description: 'Complete survey/questionnaire' },
  { key: 'photo', label: 'Photo', description: 'Capture photos (store visits only)' },
  { key: 'board', label: 'Board Placement', description: 'Verify board placement' },
  { key: 'review', label: 'Review & Submit', description: 'Review all data and submit visit' },
]

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'select', label: 'Dropdown' },
  { value: 'radio', label: 'Radio Buttons' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'toggle', label: 'Yes / No Toggle' },
  { value: 'date', label: 'Date' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'image', label: 'Photo Upload' },
]

// ── Main Page Component ──

export default function ProcessFlowManagementPage() {
  const [activeTab, setActiveTab] = useState<'flows' | 'assignments' | 'questions' | 'surveys' | 'targets' | 'migration'>('flows')

  const tabs = [
    { key: 'flows' as const, label: 'Process Flows', icon: Workflow },
    { key: 'assignments' as const, label: 'Company Assignments', icon: Link2 },
    { key: 'questions' as const, label: 'Custom Questions', icon: MessageSquare },
    { key: 'surveys' as const, label: 'Surveys', icon: FileText },
    { key: 'targets' as const, label: 'Target Rules', icon: Target },
    { key: 'migration' as const, label: 'Database Setup', icon: Database },
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Process Flow Management</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Create and manage visit workflow steps, assign flows to companies, and configure custom questions
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-4" aria-label="Tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'flows' && <ProcessFlowsTab />}
      {activeTab === 'assignments' && <CompanyAssignmentsTab />}
      {activeTab === 'questions' && <CustomQuestionsTab />}
      {activeTab === 'surveys' && <SurveysTab />}
      {activeTab === 'targets' && <CompanyTargetRulesTab />}
      {activeTab === 'migration' && <MigrationTab />}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// Tab 1: Process Flows
// ══════════════════════════════════════════════════════════

function ProcessFlowsTab() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editingFlow, setEditingFlow] = useState<ProcessFlow | null>(null)
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null)

  const { data: flowsResp, isLoading, isError } = useQuery({
    queryKey: ['process-flows'],
    queryFn: () => fieldOperationsService.getProcessFlows(),
  })

  const flows: ProcessFlow[] = Array.isArray(flowsResp?.data) ? flowsResp.data :
    Array.isArray(flowsResp?.results) ? flowsResp.results :
    Array.isArray(flowsResp) ? flowsResp : []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fieldOperationsService.deleteProcessFlow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['process-flows'] })
      toast.success('Process flow deactivated')
    },
    onError: () => toast.error('Failed to deactivate process flow'),
  })

  if (isLoading) return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>

  if (isError) {
    return (
      <div className="card p-8 text-center">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <p className="text-lg font-medium text-gray-900 dark:text-white">Process flow tables not found</p>
        <p className="text-gray-500 mt-1">Go to the "Database Setup" tab to run the migration first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{flows.length} process flow(s)</p>
        <button
          onClick={() => { setShowCreate(true); setEditingFlow(null) }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Process Flow</span>
        </button>
      </div>

      {(showCreate || editingFlow) && (
        <ProcessFlowForm
          flow={editingFlow}
          onClose={() => { setShowCreate(false); setEditingFlow(null) }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['process-flows'] })
            setShowCreate(false)
            setEditingFlow(null)
          }}
        />
      )}

      {/* Flow cards */}
      {flows.length === 0 && !showCreate && (
        <div className="card p-12 text-center">
          <Workflow className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg font-medium">No process flows configured</p>
          <p className="text-gray-400 text-sm">Create your first process flow to define visit workflow steps</p>
        </div>
      )}

      {flows.map((flow: ProcessFlow) => (
        <div key={flow.id} className="card overflow-hidden">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Workflow className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{flow.name}</h3>
                  {flow.is_default ? (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Default</span>
                  ) : null}
                </div>
                <p className="text-sm text-gray-500">{flow.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setExpandedFlow(expandedFlow === flow.id ? null : flow.id)} className="p-1 text-gray-400 hover:text-gray-600">
                {expandedFlow === flow.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
              <button onClick={() => { setEditingFlow(flow); setShowCreate(false) }} className="text-blue-600 hover:text-blue-800 p-1">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => deleteMutation.mutate(flow.id)} className="text-red-600 hover:text-red-800 p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {expandedFlow === flow.id && <FlowStepsPreview flowId={flow.id} />}
        </div>
      ))}
    </div>
  )
}

function FlowStepsPreview({ flowId }: { flowId: string }) {
  const { data: flowResp, isLoading } = useQuery({
    queryKey: ['process-flow', flowId],
    queryFn: () => fieldOperationsService.getProcessFlow(flowId),
  })

  const flowData = flowResp?.data || flowResp
  const steps: ProcessFlowStep[] = Array.isArray(flowData?.steps) ? flowData.steps :
    Array.isArray(flowData?.results) ? flowData.results : []

  if (isLoading) return <div className="px-4 pb-4"><LoadingSpinner size="sm" /></div>

  return (
    <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3">
      <p className="text-xs font-medium text-gray-500 uppercase mb-2">Steps ({steps.length})</p>
      <div className="flex flex-wrap gap-2">
        {steps.sort((a, b) => a.step_order - b.step_order).map((step, idx) => (
          <div key={step.id || idx} className="flex items-center gap-1">
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-500 text-white text-xs mr-2">{step.step_order}</span>
              {step.step_label}
              {step.is_required ? <span className="text-red-500 ml-1">*</span> : null}
            </span>
            {idx < steps.length - 1 && <span className="text-gray-300 dark:text-gray-600 mx-1">&rarr;</span>}
          </div>
        ))}
        {steps.length === 0 && <p className="text-sm text-gray-400">No steps configured</p>}
      </div>
    </div>
  )
}

// ── Process Flow Create/Edit Form ──

interface ProcessFlowFormProps {
  flow: ProcessFlow | null
  onClose: () => void
  onSuccess: () => void
}

function ProcessFlowForm({ flow, onClose, onSuccess }: ProcessFlowFormProps) {
  const [name, setName] = useState(flow?.name || '')
  const [description, setDescription] = useState(flow?.description || '')
  const [isDefault, setIsDefault] = useState(flow?.is_default ? true : false)
  const [steps, setSteps] = useState<ProcessFlowStep[]>([])
  const [stepsLoaded, setStepsLoaded] = useState(!flow) // if creating new, no steps to load

  // Load steps if editing
  const { } = useQuery({
    queryKey: ['process-flow', flow?.id],
    queryFn: () => fieldOperationsService.getProcessFlow(flow!.id),
    enabled: !!flow?.id && !stepsLoaded,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    select: (data: any) => {
      const flowData = data?.data || data
      if (flowData?.steps && !stepsLoaded) {
        setSteps(flowData.steps.sort((a: ProcessFlowStep, b: ProcessFlowStep) => a.step_order - b.step_order))
        setStepsLoaded(true)
      }
      return flowData
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        description,
        is_default: isDefault,
        steps: steps.map((s, i) => ({
          step_key: s.step_key,
          step_label: s.step_label,
          step_order: i + 1,
          is_required: !!s.is_required,
          config: s.config || {},
        })),
      }
      if (flow) {
        return fieldOperationsService.updateProcessFlow(flow.id, payload)
      }
      return fieldOperationsService.createProcessFlow(payload)
    },
    onSuccess: () => {
      toast.success(flow ? 'Process flow updated' : 'Process flow created')
      onSuccess()
    },
    onError: () => toast.error('Failed to save process flow'),
  })

  function addStep(stepKey: string) {
    const def = AVAILABLE_STEPS.find(s => s.key === stepKey)
    if (!def) return
    if (steps.some(s => s.step_key === stepKey)) {
      toast.error(`Step "${def.label}" is already added`)
      return
    }
    setSteps([...steps, { step_key: stepKey, step_label: def.label, step_order: steps.length + 1, is_required: true }])
  }

  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index))
  }

  function moveStep(index: number, direction: 'up' | 'down') {
    const newSteps = [...steps]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newSteps.length) return
    const temp = newSteps[targetIndex]
    newSteps[targetIndex] = newSteps[index]
    newSteps[index] = temp
    setSteps(newSteps)
  }

  function toggleRequired(index: number) {
    const newSteps = [...steps]
    newSteps[index] = { ...newSteps[index], is_required: !newSteps[index].is_required }
    setSteps(newSteps)
  }

  const usedKeys = new Set(steps.map(s => s.step_key))

  return (
    <div className="card p-6 border-2 border-blue-200 dark:border-blue-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {flow ? 'Edit Process Flow' : 'Create New Process Flow'}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Flow Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="input w-full"
            placeholder="e.g. Standard Store Visit"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="input w-full"
            placeholder="Brief description of this workflow"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 mb-4 cursor-pointer">
        <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="rounded border-gray-300" />
        <span className="text-sm text-gray-700 dark:text-gray-300">Set as default flow (used when no company-specific flow is assigned)</span>
      </label>

      {/* Steps Section */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Workflow Steps</h4>
          <div className="flex items-center gap-2">
            <SearchableSelect
              options={AVAILABLE_STEPS.filter(s => !usedKeys.has(s.key)).map(s => ({ value: s.key, label: s.label }))}
              value={null}
              onChange={(val: string) => addStep(val)}
              placeholder="+ Add Step"
            />
          </div>
        </div>

        {steps.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
            No steps added yet. Use the dropdown above to add workflow steps.
          </div>
        ) : (
          <div className="space-y-2">
            {steps.map((step, index) => (
              <div key={step.step_key} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold flex-shrink-0">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <span className="font-medium text-gray-900 dark:text-white text-sm">{step.step_label}</span>
                  <span className="text-xs text-gray-400 ml-2">({step.step_key})</span>
                </div>
                <label className="flex items-center gap-1 cursor-pointer text-xs">
                  <input type="checkbox" checked={!!step.is_required} onChange={() => toggleRequired(index)} className="rounded border-gray-300" />
                  <span className="text-gray-600 dark:text-gray-400">Required</span>
                </label>
                <div className="flex gap-1">
                  <button onClick={() => moveStep(index, 'up')} disabled={index === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button onClick={() => moveStep(index, 'down')} disabled={index === steps.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button onClick={() => removeStep(index)} className="p-1 text-red-400 hover:text-red-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!name || steps.length === 0 || saveMutation.isPending}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? 'Saving...' : flow ? 'Update Flow' : 'Create Flow'}
        </button>
        <button onClick={onClose} className="btn-outline flex items-center gap-2">
          <X className="w-4 h-4" /> Cancel
        </button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// Tab 2: Company Assignments
// ══════════════════════════════════════════════════════════

function CompanyAssignmentsTab() {
  const queryClient = useQueryClient()
  const [showAssign, setShowAssign] = useState(false)
  const [assignForm, setAssignForm] = useState({ company_id: '', process_flow_id: '', visit_target_type: 'both' })

  const { data: assignmentsResp, isLoading: loadingAssignments, isError: assignError } = useQuery({
    queryKey: ['company-process-flows'],
    queryFn: () => fieldOperationsService.getCompanyProcessFlows(),
  })

  const { data: flowsResp } = useQuery({
    queryKey: ['process-flows'],
    queryFn: () => fieldOperationsService.getProcessFlows(),
  })

  const { data: companiesResp } = useQuery({
    queryKey: ['field-companies'],
    queryFn: () => fieldOperationsService.getCompanies(),
  })

  const assignments: CompanyProcessFlow[] = Array.isArray(assignmentsResp?.data) ? assignmentsResp.data :
    Array.isArray(assignmentsResp?.results) ? assignmentsResp.results :
    Array.isArray(assignmentsResp) ? assignmentsResp : []

  const flows: ProcessFlow[] = Array.isArray(flowsResp?.data) ? flowsResp.data :
    Array.isArray(flowsResp?.results) ? flowsResp.results :
    Array.isArray(flowsResp) ? flowsResp : []

  const companies = Array.isArray(companiesResp?.data) ? companiesResp.data :
    Array.isArray(companiesResp) ? companiesResp : []

  const assignMutation = useMutation({
    mutationFn: () => fieldOperationsService.assignProcessFlowToCompany(assignForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-process-flows'] })
      toast.success('Process flow assigned to company')
      setShowAssign(false)
      setAssignForm({ company_id: '', process_flow_id: '', visit_target_type: 'both' })
    },
    onError: () => toast.error('Failed to assign process flow'),
  })

  const unassignMutation = useMutation({
    mutationFn: (id: string) => fieldOperationsService.unassignProcessFlowFromCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-process-flows'] })
      toast.success('Process flow unassigned')
    },
    onError: () => toast.error('Failed to unassign'),
  })

  if (loadingAssignments) return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>

  if (assignError) {
    return (
      <div className="card p-8 text-center">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <p className="text-lg font-medium text-gray-900 dark:text-white">Tables not found</p>
        <p className="text-gray-500 mt-1">Go to the "Database Setup" tab to run the migration first.</p>
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getCompanyName = (companyId: string) => companies.find((c: any) => c.id === companyId)?.name || companyId
  const getFlowName = (flowId: string) => flows.find(f => f.id === flowId)?.name || flowId

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{assignments.length} assignment(s)</p>
        <button onClick={() => setShowAssign(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>Assign Flow to Company</span>
        </button>
      </div>

      {showAssign && (
        <div className="card p-6 border-2 border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Assign Process Flow</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company *</label>
              <SearchableSelect
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                options={companies.map((c: any) => ({ value: c.id, label: c.name }))}
                value={assignForm.company_id || null}
                onChange={(val: string) => setAssignForm(prev => ({ ...prev, company_id: val }))}
                placeholder="Select Company"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Process Flow *</label>
              <SearchableSelect
                options={flows.map(f => ({ value: f.id, label: f.name }))}
                value={assignForm.process_flow_id || null}
                onChange={(val: string) => setAssignForm(prev => ({ ...prev, process_flow_id: val }))}
                placeholder="Select Flow"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Visit Type</label>
              <SearchableSelect
                options={[
                  { value: 'both', label: 'Both (Store & Individual)' },
                  { value: 'store', label: 'Store Visits Only' },
                  { value: 'individual', label: 'Individual Visits Only' },
                ]}
                value={assignForm.visit_target_type}
                onChange={(val: string) => setAssignForm(prev => ({ ...prev, visit_target_type: val }))}
                placeholder="Select Type"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => assignMutation.mutate()}
              disabled={!assignForm.company_id || !assignForm.process_flow_id || assignMutation.isPending}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <Link2 className="w-4 h-4" />
              {assignMutation.isPending ? 'Assigning...' : 'Assign'}
            </button>
            <button onClick={() => setShowAssign(false)} className="btn-outline flex items-center gap-2">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Assignment Table */}
      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Process Flow</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Visit Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {assignments.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                  <Link2 className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p>No company assignments</p>
                  <p className="text-sm mt-1">Assign process flows to companies to customize their visit workflows</p>
                </td>
              </tr>
            ) : (
              assignments.map(a => (
                <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      {a.flow_name ? getCompanyName(a.company_id) : getCompanyName(a.company_id)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{a.flow_name || getFlowName(a.process_flow_id)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      a.visit_target_type === 'store' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                      a.visit_target_type === 'individual' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {a.visit_target_type === 'both' ? 'Both' : a.visit_target_type === 'store' ? 'Store' : 'Individual'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={() => unassignMutation.mutate(a.id)} className="text-red-600 hover:text-red-800 flex items-center gap-1 text-sm">
                      <Unlink className="w-3 h-3" /> Unassign
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// Tab 3: Custom Questions
// ══════════════════════════════════════════════════════════

function CustomQuestionsTab() {
  const queryClient = useQueryClient()
  const [filterCompany, setFilterCompany] = useState<string>('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<CustomQuestion | null>(null)
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false)
  const [form, setForm] = useState({
    company_id: '',
    question_label: '',
    question_key: '',
    field_type: 'text',
    field_options: '' as string,
    is_required: false,
    display_order: 1,
    visit_target_type: 'both',
    check_duplicate: false,
    min_length: undefined as number | undefined,
    max_length: undefined as number | undefined,
  })

  const { data: companiesResp } = useQuery({
    queryKey: ['field-companies'],
    queryFn: () => fieldOperationsService.getCompanies(),
  })

  const companies = Array.isArray(companiesResp?.data) ? companiesResp.data :
    Array.isArray(companiesResp) ? companiesResp : []

  const { data: questionsResp, isLoading, isError } = useQuery({
    queryKey: ['custom-questions', filterCompany],
    queryFn: () => fieldOperationsService.getCompanyCustomQuestions(filterCompany || undefined),
  })

  const questions: CustomQuestion[] = Array.isArray(questionsResp?.data) ? questionsResp.data :
    Array.isArray(questionsResp?.results) ? questionsResp.results :
    Array.isArray(questionsResp) ? questionsResp : []

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        field_options: (form.field_type === 'select' || form.field_type === 'radio' || form.field_type === 'checkbox') ? form.field_options.split(',').map(o => o.trim()).filter(Boolean) : undefined,
        is_required: form.is_required,
        check_duplicate: form.check_duplicate,
        min_length: (form.field_type === 'text' || form.field_type === 'number' || form.field_type === 'textarea' || form.field_type === 'email' || form.field_type === 'phone') ? (form.min_length ?? null) : null,
        max_length: (form.field_type === 'text' || form.field_type === 'number' || form.field_type === 'textarea' || form.field_type === 'email' || form.field_type === 'phone') ? (form.max_length ?? null) : null,
      }
      if (editingQuestion) {
        return fieldOperationsService.updateCompanyCustomQuestion(editingQuestion.id, payload)
      }
      return fieldOperationsService.createCompanyCustomQuestion(payload as Parameters<typeof fieldOperationsService.createCompanyCustomQuestion>[0])
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-questions'] })
      toast.success(editingQuestion ? 'Question updated' : 'Question created')
      resetForm()
    },
    onError: () => toast.error('Failed to save question'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fieldOperationsService.deleteCompanyCustomQuestion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-questions'] })
      toast.success('Question deleted')
    },
    onError: () => toast.error('Failed to delete question'),
  })

  function resetForm() {
    setShowCreate(false)
    setEditingQuestion(null)
    setKeyManuallyEdited(false)
    setForm({ company_id: '', question_label: '', question_key: '', field_type: 'text', field_options: '', is_required: false, display_order: 1, visit_target_type: 'both', check_duplicate: false, min_length: undefined, max_length: undefined })
  }

  function startEdit(q: CustomQuestion) {
    setEditingQuestion(q)
    setShowCreate(true)
    setKeyManuallyEdited(true)
    setForm({
      company_id: q.company_id,
      question_label: q.question_label,
      question_key: q.question_key,
      field_type: q.field_type,
      field_options: Array.isArray(q.field_options) ? q.field_options.join(', ') : '',
      is_required: !!q.is_required,
      display_order: q.display_order,
      visit_target_type: q.visit_target_type,
      check_duplicate: !!q.check_duplicate,
      min_length: q.min_length,
      max_length: q.max_length,
    })
  }

  function autoGenerateKey(label: string) {
    return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  }

  if (isLoading) return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>

  if (isError) {
    return (
      <div className="card p-8 text-center">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <p className="text-lg font-medium text-gray-900 dark:text-white">Tables not found</p>
        <p className="text-gray-500 mt-1">Go to the "Database Setup" tab to run the migration first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600 dark:text-gray-400">Filter by company:</label>
          <SearchableSelect
            options={[
              { value: '', label: 'All Companies' },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ...companies.map((c: any) => ({ value: c.id, label: c.name })),
            ]}
            value={filterCompany || null}
            onChange={(val: string) => setFilterCompany(val)}
            placeholder="All Companies"
          />
        </div>
        <button onClick={() => { setShowCreate(true); setEditingQuestion(null) }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>New Question</span>
        </button>
      </div>

      {showCreate && (
        <div className="card p-6 border-2 border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {editingQuestion ? 'Edit Custom Question' : 'Create Custom Question'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Custom questions appear on the visit Details step. Write clear, concise questions that agents can answer quickly in the field.
            Avoid questions that duplicate data already captured (e.g. name, phone, GPS).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company *</label>
              <SearchableSelect
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                options={companies.map((c: any) => ({ value: c.id, label: c.name }))}
                value={form.company_id || null}
                onChange={(val: string) => setForm(prev => ({ ...prev, company_id: val }))}
                placeholder="Select Company"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Question Label *</label>
              <input
                type="text"
                value={form.question_label}
                onChange={e => {
                  const label = e.target.value
                  setForm(prev => ({
                    ...prev,
                    question_label: label,
                    question_key: keyManuallyEdited ? prev.question_key : autoGenerateKey(label),
                  }))
                }}
                className="input w-full"
                placeholder="e.g. How many units were sold this week?"
              />
              <p className="text-xs text-gray-400 mt-1">Write as a clear question the agent will answer during the visit.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Question Key</label>
              <input
                type="text"
                value={form.question_key}
                onChange={e => { setKeyManuallyEdited(true); setForm(prev => ({ ...prev, question_key: e.target.value })) }}
                className="input w-full"
                placeholder="Auto-generated from label"
              />
              <p className="text-xs text-gray-400 mt-1">Unique identifier used in data exports. Auto-generated from the label.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Field Type</label>
              <SearchableSelect
                options={FIELD_TYPES}
                value={form.field_type}
                onChange={(val: string) => setForm(prev => ({ ...prev, field_type: val }))}
                placeholder="Text"
              />
            </div>
            {(form.field_type === 'select' || form.field_type === 'radio' || form.field_type === 'checkbox') && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Options (comma-separated)</label>
                <input
                  type="text"
                  value={form.field_options}
                  onChange={e => setForm(prev => ({ ...prev, field_options: e.target.value }))}
                  className="input w-full"
                  placeholder="Option 1, Option 2, Option 3"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Visit Type</label>
              <SearchableSelect
                options={[
                  { value: 'both', label: 'Both (Store & Individual)' },
                  { value: 'store', label: 'Store Visits Only' },
                  { value: 'individual', label: 'Individual Visits Only' },
                ]}
                value={form.visit_target_type}
                onChange={(val: string) => setForm(prev => ({ ...prev, visit_target_type: val }))}
                placeholder="Both"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Order</label>
              <input
                type="number"
                min={1}
                value={form.display_order}
                onChange={e => setForm(prev => ({ ...prev, display_order: parseInt(e.target.value) || 1 }))}
                className="input w-full"
              />
            </div>
          </div>
          {(form.field_type === 'text' || form.field_type === 'number' || form.field_type === 'textarea' || form.field_type === 'email' || form.field_type === 'phone') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Length</label>
                <input
                  type="number"
                  min={0}
                  value={form.min_length ?? ''}
                  onChange={e => setForm(prev => ({ ...prev, min_length: e.target.value ? parseInt(e.target.value) : undefined }))}
                  className="input w-full"
                  placeholder="No minimum"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Length</label>
                <input
                  type="number"
                  min={0}
                  value={form.max_length ?? ''}
                  onChange={e => setForm(prev => ({ ...prev, max_length: e.target.value ? parseInt(e.target.value) : undefined }))}
                  className="input w-full"
                  placeholder="No maximum"
                />
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2 mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_required} onChange={e => setForm(prev => ({ ...prev, is_required: e.target.checked }))} className="rounded border-gray-300" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Required field</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.check_duplicate} onChange={e => setForm(prev => ({ ...prev, check_duplicate: e.target.checked }))} className="rounded border-gray-300" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Check for duplicate (flags if similar question exists in the flow)</span>
            </label>
          </div>
          {/* Duplicate flow field warning */}
          {form.check_duplicate && form.question_key && (() => {
            const warning = checkDuplicateFlowField(form.question_key, form.question_label, form.visit_target_type)
            return warning ? (
              <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Potential Duplicate Detected</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">{warning}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Consider removing this question to avoid asking the same information twice.</p>
                </div>
              </div>
            ) : null
          })()}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!form.company_id || !form.question_label || !form.question_key || saveMutation.isPending}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'Saving...' : editingQuestion ? 'Update' : 'Create'}
            </button>
            <button onClick={resetForm} className="btn-outline flex items-center gap-2">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Question Packs - grouped by company and visit type */}
      {questions.length === 0 ? (
        <div className="card p-12 text-center">
          <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-2" />
          <p className="text-gray-500">No custom questions configured</p>
          <p className="text-sm text-gray-400 mt-1">Add company-specific questions that appear on the visit Details step</p>
        </div>
      ) : (
        (() => {
          // Group questions into packs: company -> visit_type -> questions[]
          const packs: Record<string, Record<string, CustomQuestion[]>> = {}
          for (const q of questions) {
            const cName = getCompanyName(q.company_id)
            if (!packs[cName]) packs[cName] = {}
            const vt = q.visit_target_type || 'both'
            if (!packs[cName][vt]) packs[cName][vt] = []
            packs[cName][vt].push(q)
          }
          const vtLabel = (vt: string) => vt === 'store' ? 'Store Pack' : vt === 'individual' ? 'Individual Pack' : 'Both (Store & Individual)'
          const vtBadge = (vt: string) => vt === 'store' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
            : vt === 'individual' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          return Object.entries(packs).map(([companyName, vtGroups]) => (
            <div key={companyName} className="card overflow-hidden">
              <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-500" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{companyName}</h3>
                  <span className="text-xs text-gray-400">({Object.values(vtGroups).flat().length} questions)</span>
                </div>
              </div>
              {Object.entries(vtGroups).map(([vt, qs]) => (
                <div key={vt}>
                  <div className="px-6 py-2 bg-gray-25 dark:bg-gray-850 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${vtBadge(vt)}`}>{vtLabel(vt)}</span>
                    <span className="text-xs text-gray-400">{qs.length} question{qs.length !== 1 ? 's' : ''}</span>
                  </div>
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase">Question</th>
                        <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase">Required</th>
                        <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase">Validation</th>
                        <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                      {qs.map(q => (
                        <tr key={q.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-6 py-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{q.question_label}</div>
                            <div className="text-xs text-gray-400">{q.question_key}</div>
                            {q.check_duplicate && (
                              <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                <AlertCircle className="w-3 h-3" /> Duplicate check
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">{FIELD_TYPES.find(f => f.value === q.field_type)?.label || q.field_type}</td>
                          <td className="px-6 py-3 text-sm">{q.is_required ? <span className="text-red-500 font-medium">Yes</span> : 'No'}</td>
                          <td className="px-6 py-3 text-xs text-gray-500">
                            {q.min_length != null && <span>Min: {q.min_length}</span>}
                            {q.min_length != null && q.max_length != null && <span> / </span>}
                            {q.max_length != null && <span>Max: {q.max_length}</span>}
                            {q.min_length == null && q.max_length == null && <span className="text-gray-400">&mdash;</span>}
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex gap-2">
                              <button onClick={() => startEdit(q)} className="text-blue-600 hover:text-blue-800">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => deleteMutation.mutate(q.id)} className="text-red-600 hover:text-red-800">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ))
        })()
      )}
    </div>
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getCompanyName(companyId: string) { return companies.find((c: any) => c.id === companyId)?.name || companyId }
}

// ══════════════════════════════════════════════════════════
// Tab 4: Company Target Rules
// ══════════════════════════════════════════════════════════

interface TargetRuleForm {
  company_id: string
  target_visits_per_day: number
  target_registrations_per_day: number
  target_conversions_per_day: number
  team_lead_own_target_visits: number
  team_lead_own_target_registrations: number
  team_lead_own_target_conversions: number
}

const EMPTY_TARGET_FORM: TargetRuleForm = {
  company_id: '',
  target_visits_per_day: 20,
  target_registrations_per_day: 10,
  target_conversions_per_day: 5,
  team_lead_own_target_visits: 20,
  team_lead_own_target_registrations: 10,
  team_lead_own_target_conversions: 5,
}

function CompanyTargetRulesTab() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<TargetRuleForm>(EMPTY_TARGET_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: companiesResp } = useQuery({
    queryKey: ['field-ops-companies'],
    queryFn: () => fieldOperationsService.getCompanies(),
  })
  const companies: { id: string; name: string; code: string }[] = Array.isArray(companiesResp) ? companiesResp : (companiesResp?.data || [])

  const { data: rulesResp, isLoading, isError } = useQuery({
    queryKey: ['company-target-rules'],
    queryFn: () => fieldOperationsService.getCompanyTargetRules(),
  })
  const rules: (TargetRuleForm & { id: string; company_name: string; company_code: string })[] = Array.isArray(rulesResp) ? rulesResp : (rulesResp?.data || [])

  const saveMutation = useMutation({
    mutationFn: (data: TargetRuleForm) => fieldOperationsService.saveCompanyTargetRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-target-rules'] })
      toast.success(editingId ? 'Target rules updated' : 'Target rules created')
      setForm(EMPTY_TARGET_FORM)
      setEditingId(null)
    },
    onError: () => toast.error('Failed to save target rules'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fieldOperationsService.deleteCompanyTargetRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-target-rules'] })
      toast.success('Target rules deleted')
    },
    onError: () => toast.error('Failed to delete'),
  })

  function startEdit(rule: typeof rules[0]) {
    setEditingId(rule.id)
    setForm({
      company_id: rule.company_id,
      target_visits_per_day: rule.target_visits_per_day,
      target_registrations_per_day: rule.target_registrations_per_day,
      target_conversions_per_day: rule.target_conversions_per_day,
      team_lead_own_target_visits: rule.team_lead_own_target_visits,
      team_lead_own_target_registrations: rule.team_lead_own_target_registrations,
      team_lead_own_target_conversions: rule.team_lead_own_target_conversions,
    })
  }

  // Companies that don't already have rules
  const companiesWithoutRules = companies.filter(c => !rules.some(r => r.company_id === c.id))

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {editingId ? 'Edit Target Rules' : 'Create Target Rules'}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Set daily targets per company. These apply to all agents linked to the company. Team leads have their own individual targets as well as responsibility for their team&apos;s aggregated performance. All levels must hit targets for commission eligibility.
        </p>

        <div className="space-y-4">
          {/* Company select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company</label>
            {editingId ? (
              <p className="text-gray-900 dark:text-white font-medium">{rules.find(r => r.id === editingId)?.company_name || form.company_id}</p>
            ) : (
              <SearchableSelect
                options={companiesWithoutRules.map(c => ({ value: c.id, label: c.name }))}
                value={form.company_id || null}
                onChange={(val) => setForm(f => ({ ...f, company_id: val || '' }))}
                placeholder="Select company..."
              />
            )}
          </div>

          {/* Agent Targets */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Agent Daily Targets</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Visits/Day</label>
                <input type="number" min={0} value={form.target_visits_per_day} onChange={(e) => setForm(f => ({ ...f, target_visits_per_day: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#0F1420] text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Registrations/Day</label>
                <input type="number" min={0} value={form.target_registrations_per_day} onChange={(e) => setForm(f => ({ ...f, target_registrations_per_day: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#0F1420] text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Conversions/Day</label>
                <input type="number" min={0} value={form.target_conversions_per_day} onChange={(e) => setForm(f => ({ ...f, target_conversions_per_day: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#0F1420] text-gray-900 dark:text-white" />
              </div>
            </div>
          </div>

          {/* Team Lead Own Targets */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Team Lead Own Daily Targets</h4>
            <p className="text-xs text-gray-400 mb-2">Team leads must also hit their own individual targets in addition to their team hitting the agent targets above.</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Visits/Day</label>
                <input type="number" min={0} value={form.team_lead_own_target_visits} onChange={(e) => setForm(f => ({ ...f, team_lead_own_target_visits: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#0F1420] text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Registrations/Day</label>
                <input type="number" min={0} value={form.team_lead_own_target_registrations} onChange={(e) => setForm(f => ({ ...f, team_lead_own_target_registrations: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#0F1420] text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Conversions/Day</label>
                <input type="number" min={0} value={form.team_lead_own_target_conversions} onChange={(e) => setForm(f => ({ ...f, team_lead_own_target_conversions: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#0F1420] text-gray-900 dark:text-white" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => { if (!form.company_id && !editingId) { toast.error('Select a company'); return; } saveMutation.mutate(form); }}
              disabled={saveMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'Saving...' : editingId ? 'Update Rules' : 'Create Rules'}
            </button>
            {editingId && (
              <button onClick={() => { setEditingId(null); setForm(EMPTY_TARGET_FORM); }} className="text-gray-500 hover:text-gray-700 text-sm">
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Existing Rules List */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Existing Target Rules</h3>
        {isLoading && <LoadingSpinner />}
        {isError && <p className="text-red-500">Failed to load target rules</p>}
        {!isLoading && rules.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No target rules configured yet. Create one above.</p>
          </div>
        )}
        {rules.length > 0 && (
          <div className="space-y-3">
            {rules.map(rule => (
              <div key={rule.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                    <span className="font-semibold text-gray-900 dark:text-white">{rule.company_name}</span>
                    <span className="text-xs text-gray-400">({rule.company_code})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEdit(rule)} className="text-blue-600 hover:text-blue-700 p-1" title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteMutation.mutate(rule.id)} className="text-red-500 hover:text-red-600 p-1" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1">Agent Targets</p>
                    <div className="flex gap-4 text-sm">
                      <span className="text-gray-700 dark:text-gray-300"><strong>{rule.target_visits_per_day}</strong> visits</span>
                      <span className="text-gray-700 dark:text-gray-300"><strong>{rule.target_registrations_per_day}</strong> regs</span>
                      <span className="text-gray-700 dark:text-gray-300"><strong>{rule.target_conversions_per_day}</strong> conv</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1">Team Lead Own Targets</p>
                    <div className="flex gap-4 text-sm">
                      <span className="text-gray-700 dark:text-gray-300"><strong>{rule.team_lead_own_target_visits}</strong> visits</span>
                      <span className="text-gray-700 dark:text-gray-300"><strong>{rule.team_lead_own_target_registrations}</strong> regs</span>
                      <span className="text-gray-700 dark:text-gray-300"><strong>{rule.team_lead_own_target_conversions}</strong> conv</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  All levels (agent + team lead + manager) must hit targets for commission payout
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// Tab 4b: Surveys (full CRUD + company allocation)
// ══════════════════════════════════════════════════════════

interface SurveyQuestion {
  id: string
  question_text: string
  question_type: 'text' | 'multiple_choice' | 'rating' | 'yes_no' | 'date'
  options?: string[]
  required: boolean
}

interface SurveyFormData {
  id: string | null
  title: string
  description: string
  module: string
  target_type: string
  company_id: string
  is_mandatory: boolean
  questions: SurveyQuestion[]
}

const EMPTY_SURVEY_FORM: SurveyFormData = {
  id: null,
  title: '',
  description: '',
  module: 'field_ops',
  target_type: 'both',
  company_id: '',
  is_mandatory: false,
  questions: [],
}

const QUESTION_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'rating', label: 'Rating (1-5)' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'date', label: 'Date' },
]

function SurveysTab() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<SurveyFormData>({ ...EMPTY_SURVEY_FORM })
  const [expandedSurvey, setExpandedSurvey] = useState<string | null>(null)

  const { data: companiesResp } = useQuery({
    queryKey: ['companies'],
    queryFn: () => fieldOperationsService.getCompanies(),
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const companies: Array<{ id: string; name: string }> = Array.isArray(companiesResp?.data) ? companiesResp.data : Array.isArray(companiesResp) ? companiesResp : []

  const { data: surveysResp, isLoading, isError } = useQuery({
    queryKey: ['surveys-list'],
    queryFn: () => surveysService.getSurveys({}),
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const surveys: Array<any> = Array.isArray(surveysResp?.surveys) ? surveysResp.surveys :
    Array.isArray(surveysResp?.data) ? surveysResp.data :
    Array.isArray(surveysResp) ? surveysResp : []

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        name: form.title,
        description: form.description,
        module: form.module,
        target_type: form.target_type,
        company_id: form.company_id || null,
        is_mandatory: form.is_mandatory,
        questions: form.questions,
      }
      if (form.id) {
        return surveysService.updateSurvey(form.id, payload as Record<string, unknown>)
      }
      return surveysService.createSurvey(payload as Record<string, unknown>)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys-list'] })
      toast.success(form.id ? 'Survey updated' : 'Survey created')
      setForm({ ...EMPTY_SURVEY_FORM })
      setShowForm(false)
    },
    onError: () => toast.error('Failed to save survey'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => surveysService.deleteSurvey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys-list'] })
      toast.success('Survey deleted')
    },
    onError: () => toast.error('Failed to delete survey'),
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function startEdit(survey: any) {
    const questions = Array.isArray(survey.questions) ? survey.questions : []
    setForm({
      id: survey.id,
      title: survey.title || survey.name || '',
      description: survey.description || '',
      module: survey.module || 'field_ops',
      target_type: survey.target_type || 'both',
      company_id: survey.company_id || '',
      is_mandatory: !!survey.is_mandatory,
      questions: questions.map((q: SurveyQuestion, i: number) => ({
        id: q.id || crypto.randomUUID(),
        question_text: q.question_text || '',
        question_type: q.question_type || 'text',
        options: q.options || [],
        required: q.required !== undefined ? q.required : true,
      })),
    })
    setShowForm(true)
  }

  function addQuestion() {
    setForm(prev => ({
      ...prev,
      questions: [...prev.questions, {
        id: crypto.randomUUID(),
        question_text: '',
        question_type: 'text' as const,
        options: [],
        required: true,
      }],
    }))
  }

  function removeQuestion(index: number) {
    setForm(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
    }))
  }

  function updateQuestion(index: number, updates: Partial<SurveyQuestion>) {
    setForm(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => i === index ? { ...q, ...updates } : q),
    }))
  }

  function resetForm() {
    setForm({ ...EMPTY_SURVEY_FORM })
    setShowForm(false)
  }

  if (isLoading) return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>

  const getCompanyName = (companyId: string) => companies.find(c => c.id === companyId)?.name || 'All Companies'

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{surveys.length} survey(s)</p>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Survey</span>
        </button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="card p-6 border-2 border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {form.id ? 'Edit Survey' : 'Create New Survey'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Survey Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                className="input w-full"
                placeholder="e.g. Customer Satisfaction Survey"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                className="input w-full"
                placeholder="Brief description"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company</label>
              <SearchableSelect
                options={[{ value: '', label: 'All Companies (Global)' }, ...companies.map(c => ({ value: c.id, label: c.name }))]}
                value={form.company_id}
                onChange={(val: string) => setForm(prev => ({ ...prev, company_id: val }))}
                placeholder="Select company..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Type</label>
              <select
                value={form.target_type}
                onChange={e => setForm(prev => ({ ...prev, target_type: e.target.value }))}
                className="input w-full"
              >
                <option value="both">Both (Individual & Store)</option>
                <option value="individual">Individual Only</option>
                <option value="store">Store Only</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Module</label>
              <select
                value={form.module}
                onChange={e => setForm(prev => ({ ...prev, module: e.target.value }))}
                className="input w-full"
              >
                <option value="field_ops">Field Ops</option>
                <option value="marketing">Marketing</option>
                <option value="promotions">Promotions</option>
                <option value="van_sales">Van Sales</option>
                <option value="general">General</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input type="checkbox" checked={form.is_mandatory} onChange={e => setForm(prev => ({ ...prev, is_mandatory: e.target.checked }))} className="rounded border-gray-300" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Mandatory survey (required for visit completion)</span>
          </label>

          {/* Questions Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Questions ({form.questions.length})</h4>
              <button onClick={addQuestion} className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Question
              </button>
            </div>

            {form.questions.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                No questions added yet. Click "Add Question" to start building your survey.
              </div>
            ) : (
              <div className="space-y-3">
                {form.questions.map((q, index) => (
                  <div key={q.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold flex-shrink-0 mt-1">
                        {index + 1}
                      </span>
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={q.question_text}
                          onChange={e => updateQuestion(index, { question_text: e.target.value })}
                          className="input w-full"
                          placeholder="Enter question text..."
                        />
                        <div className="flex items-center gap-3">
                          <select
                            value={q.question_type}
                            onChange={e => updateQuestion(index, { question_type: e.target.value as SurveyQuestion['question_type'] })}
                            className="input text-sm"
                          >
                            {QUESTION_TYPES.map(qt => (
                              <option key={qt.value} value={qt.value}>{qt.label}</option>
                            ))}
                          </select>
                          <label className="flex items-center gap-1 cursor-pointer text-xs">
                            <input type="checkbox" checked={q.required} onChange={e => updateQuestion(index, { required: e.target.checked })} className="rounded border-gray-300" />
                            <span className="text-gray-600 dark:text-gray-400">Required</span>
                          </label>
                        </div>
                        {q.question_type === 'multiple_choice' && (
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Options (comma-separated)</label>
                            <input
                              type="text"
                              value={(q.options || []).join(', ')}
                              onChange={e => updateQuestion(index, { options: e.target.value.split(',').map(o => o.trim()).filter(Boolean) })}
                              className="input w-full text-sm"
                              placeholder="Option 1, Option 2, Option 3"
                            />
                          </div>
                        )}
                      </div>
                      <button onClick={() => removeQuestion(index)} className="p-1 text-red-400 hover:text-red-600 flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!form.title || saveMutation.isPending}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'Saving...' : form.id ? 'Update Survey' : 'Create Survey'}
            </button>
            <button onClick={resetForm} className="btn-outline flex items-center gap-2">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Survey List */}
      {surveys.length === 0 && !showForm && (
        <div className="card p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg font-medium">No surveys configured</p>
          <p className="text-gray-400 text-sm">Create your first survey to start collecting data during visits</p>
        </div>
      )}

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {surveys.map((survey: any) => (
        <div key={survey.id} className="card overflow-hidden">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{survey.title || survey.name}</h3>
                  {survey.is_mandatory ? (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Required</span>
                  ) : null}
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    survey.target_type === 'individual' ? 'bg-green-100 text-green-800' :
                    survey.target_type === 'store' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {survey.target_type === 'both' ? 'All Types' : survey.target_type}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                    {getCompanyName(survey.company_id)}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{survey.description || 'No description'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setExpandedSurvey(expandedSurvey === survey.id ? null : survey.id)} className="p-1 text-gray-400 hover:text-gray-600">
                {expandedSurvey === survey.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
              <button onClick={() => startEdit(survey)} className="text-blue-600 hover:text-blue-800 p-1">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => deleteMutation.mutate(survey.id)} className="text-red-600 hover:text-red-800 p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {expandedSurvey === survey.id && (
            <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                Questions ({Array.isArray(survey.questions) ? survey.questions.length : 0})
              </p>
              {Array.isArray(survey.questions) && survey.questions.length > 0 ? (
                <div className="space-y-2">
                  {survey.questions.map((q: SurveyQuestion, idx: number) => (
                    <div key={q.id || idx} className="flex items-center gap-2 text-sm">
                      <span className="w-5 h-5 flex items-center justify-center rounded-full bg-purple-500 text-white text-xs">{idx + 1}</span>
                      <span className="text-gray-800 dark:text-gray-200">{q.question_text}</span>
                      <span className="text-xs text-gray-400">({q.question_type})</span>
                      {q.required && <span className="text-red-500 text-xs">*</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No questions configured</p>
              )}
            </div>
          )}
        </div>
      ))}

      {isError && (
        <div className="card p-8 text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <p className="text-lg font-medium text-gray-900 dark:text-white">Failed to load surveys</p>
          <p className="text-gray-500 mt-1">Check that the questionnaires table exists in the database.</p>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// Tab 5: Database Setup (Migration)
// ══════════════════════════════════════════════════════════

function MigrationTab() {
  const [migrationResult, setMigrationResult] = useState<string[] | null>(null)

  const migrationMutation = useMutation({
    mutationFn: () => fieldOperationsService.runProcessFlowsMigration(),
    onSuccess: (resp) => {
      const data = resp?.data || resp
      setMigrationResult(data?.results || ['Migration completed successfully'])
      toast.success('Migration completed!')
    },
    onError: () => {
      toast.error('Migration failed')
      setMigrationResult(['Migration failed - check server logs'])
    },
  })

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <Database className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Database Migration</h3>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              This will create the required database tables for process flows, company assignments, and custom questions.
              It also seeds default process flows for store and individual visits.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              <strong>Tables created:</strong> process_flows, process_flow_steps, company_process_flows, company_custom_questions
            </p>
            <p className="text-sm text-gray-500 mt-1">
              <strong>Seed data:</strong> Standard Store Visit flow (6 steps), Standard Individual Visit flow (5 steps, no photo)
            </p>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={() => migrationMutation.mutate()}
            disabled={migrationMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            <Database className="w-4 h-4" />
            {migrationMutation.isPending ? 'Running Migration...' : 'Run Migration'}
          </button>
        </div>

        {migrationResult && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Migration Results
            </h4>
            <ul className="space-y-1">
              {migrationResult.map((result, i) => (
                <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                  {result}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
