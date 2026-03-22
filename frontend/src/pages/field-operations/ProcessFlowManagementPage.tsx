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
} from 'lucide-react'

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
  { value: 'select', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
  { value: 'textarea', label: 'Long Text' },
]

// ── Main Page Component ──

export default function ProcessFlowManagementPage() {
  const [activeTab, setActiveTab] = useState<'flows' | 'assignments' | 'questions' | 'migration'>('flows')

  const tabs = [
    { key: 'flows' as const, label: 'Process Flows', icon: Workflow },
    { key: 'assignments' as const, label: 'Company Assignments', icon: Link2 },
    { key: 'questions' as const, label: 'Custom Questions', icon: MessageSquare },
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
  const [form, setForm] = useState({
    company_id: '',
    question_label: '',
    question_key: '',
    field_type: 'text',
    field_options: '' as string,
    is_required: false,
    display_order: 1,
    visit_target_type: 'both',
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
        field_options: form.field_type === 'select' ? form.field_options.split(',').map(o => o.trim()).filter(Boolean) : undefined,
        is_required: form.is_required,
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
    setForm({ company_id: '', question_label: '', question_key: '', field_type: 'text', field_options: '', is_required: false, display_order: 1, visit_target_type: 'both' })
  }

  function startEdit(q: CustomQuestion) {
    setEditingQuestion(q)
    setShowCreate(true)
    setForm({
      company_id: q.company_id,
      question_label: q.question_label,
      question_key: q.question_key,
      field_type: q.field_type,
      field_options: Array.isArray(q.field_options) ? q.field_options.join(', ') : '',
      is_required: !!q.is_required,
      display_order: q.display_order,
      visit_target_type: q.visit_target_type,
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {editingQuestion ? 'Edit Custom Question' : 'Create Custom Question'}
          </h3>
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
                    question_key: prev.question_key || autoGenerateKey(label),
                  }))
                }}
                className="input w-full"
                placeholder="e.g. How many units were sold?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Question Key</label>
              <input
                type="text"
                value={form.question_key}
                onChange={e => setForm(prev => ({ ...prev, question_key: e.target.value }))}
                className="input w-full"
                placeholder="Auto-generated from label"
              />
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
            {form.field_type === 'select' && (
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
          <label className="flex items-center gap-2 mt-4 cursor-pointer">
            <input type="checkbox" checked={form.is_required} onChange={e => setForm(prev => ({ ...prev, is_required: e.target.checked }))} className="rounded border-gray-300" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Required field</span>
          </label>
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

      {/* Questions Table */}
      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Question</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Visit Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Required</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {questions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p>No custom questions configured</p>
                  <p className="text-sm mt-1">Add company-specific questions that appear on the visit Details step</p>
                </td>
              </tr>
            ) : (
              questions.map(q => (
                <tr key={q.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{getCompanyName(q.company_id)}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{q.question_label}</div>
                    <div className="text-xs text-gray-400">{q.question_key}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{FIELD_TYPES.find(f => f.value === q.field_type)?.label || q.field_type}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      q.visit_target_type === 'store' ? 'bg-blue-100 text-blue-800' :
                      q.visit_target_type === 'individual' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {q.visit_target_type === 'both' ? 'Both' : q.visit_target_type === 'store' ? 'Store' : 'Individual'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">{q.is_required ? <span className="text-red-500 font-medium">Yes</span> : 'No'}</td>
                  <td className="px-6 py-4">
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getCompanyName(companyId: string) { return companies.find((c: any) => c.id === companyId)?.name || companyId }
}

// ══════════════════════════════════════════════════════════
// Tab 4: Database Setup (Migration)
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
