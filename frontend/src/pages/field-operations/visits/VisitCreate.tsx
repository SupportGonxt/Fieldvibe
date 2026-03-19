import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Stepper, Step, StepLabel, Button, Paper, Typography, Alert } from '@mui/material'
import TransactionForm from '../../../components/transactions/TransactionForm'
import SurveyAssignmentStep from '../../../components/surveys/SurveyAssignmentStep'
import { fieldOperationsService } from '../../../services/field-operations.service'
import visitSurveysService, { SurveyAssignment } from '../../../services/visitSurveys.service'

export default function VisitCreate() {
  const navigate = useNavigate()
  const [activeStep, setActiveStep] = useState(0)
  const [agents, setAgents] = useState([])
  const [customers, setCustomers] = useState([])
  const [visitData, setVisitData] = useState<any>(null)
  const [surveyAssignments, setSurveyAssignments] = useState<SurveyAssignment[]>([])
  const [error, setError] = useState<string | null>(null)

  const steps = ['Visit Details', 'Assign Surveys', 'Review & Create']

  useEffect(() => {
    loadFormData()
  }, [])

  const loadFormData = async () => {
    try {
      const [agentsRes, customersRes] = await Promise.all([
        fieldOperationsService.getAgents(),
        fieldOperationsService.getCustomers()
      ])
      const agentsData = agentsRes?.data?.data || agentsRes?.data || []
      const customersData = customersRes?.data?.data || customersRes?.data || []
      setAgents(Array.isArray(agentsData) ? agentsData : [])
      setCustomers(Array.isArray(customersData) ? customersData : [])
    } catch (error) {
      console.error('Failed to load form data:', error)
    }
  }

  const fields = [
    {
      name: 'visit_date',
      label: 'Visit Date',
      type: 'date' as const,
      required: true
    },
    {
      name: 'agent_id',
      label: 'Agent',
      type: 'select' as const,
      required: true,
      options: (agents || []).map((a: any) => ({
        value: String(a.id || ''),
        label: a.name || a.first_name ? `${a.first_name || ''} ${a.last_name || ''}`.trim() : 'Unknown'
      }))
    },
    {
      name: 'customer_id',
      label: 'Customer',
      type: 'select' as const,
      required: true,
      options: (customers || []).map((c: any) => ({
        value: String(c.id || ''),
        label: c.name || c.business_name || 'Unknown'
      }))
    },
    {
      name: 'visit_type',
      label: 'Visit Type',
      type: 'select' as const,
      required: true,
      options: [
        { value: 'sales', label: 'Sales Visit' },
        { value: 'survey', label: 'Survey' },
        { value: 'board_placement', label: 'Board Placement' },
        { value: 'product_distribution', label: 'Product Distribution' },
        { value: 'follow_up', label: 'Follow Up' }
      ]
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea' as const,
      placeholder: 'Add visit notes or objectives...'
    }
  ]

  const handleVisitDetailsSubmit = async (data: any) => {
    setVisitData(data)
    setActiveStep(1)
  }

  const handleNext = () => {
    setActiveStep((prev) => prev + 1)
  }

  const handleBack = () => {
    setActiveStep((prev) => prev - 1)
  }

  const handleFinalSubmit = async () => {
    try {
      setError(null)
      
      const visitResponse = await fieldOperationsService.createVisit(visitData)
      const visitId = visitResponse.data?.id || visitResponse.data?.visit?.id
      
      if (!visitId) {
        throw new Error('Failed to get visit ID from response')
      }

      if (surveyAssignments.length > 0) {
        await visitSurveysService.assignSurveys(visitId, surveyAssignments)
      }

      navigate('/field-operations/visits')
    } catch (error: any) {
      console.error('Failed to create visit:', error)
      setError(error.message || 'Failed to create visit')
    }
  }

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <TransactionForm
            title="Visit Details"
            fields={fields}
            onSubmit={handleVisitDetailsSubmit}
            onCancel={() => navigate('/field-operations/visits')}
            submitLabel="Next: Assign Surveys"
          />
        )
      
      case 1:
        return (
          <Paper sx={{ p: 3 }}>
            <SurveyAssignmentStep
              customerId={visitData?.customer_id}
              onAssignmentsChange={setSurveyAssignments}
              initialAssignments={surveyAssignments}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
              <Button onClick={handleBack}>
                Back
              </Button>
              <Button variant="contained" onClick={handleNext}>
                Next: Review
              </Button>
            </Box>
          </Paper>
        )
      
      case 2:
        return (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Review & Create Visit
            </Typography>
            
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Visit Details
              </Typography>
              <Typography variant="body2">Date: {visitData?.visit_date}</Typography>
              <Typography variant="body2">Agent: {agents.find((a: any) => a.id === visitData?.agent_id)?.name}</Typography>
              <Typography variant="body2">Customer: {customers.find((c: any) => c.id === visitData?.customer_id)?.name}</Typography>
              <Typography variant="body2">Type: {visitData?.visit_type}</Typography>
              {visitData?.notes && <Typography variant="body2">Notes: {visitData.notes}</Typography>}
            </Box>

            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Survey Assignments
              </Typography>
              {surveyAssignments.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No surveys assigned
                </Typography>
              ) : (
                <Box>
                  <Typography variant="body2">
                    {surveyAssignments.filter(a => a.subject_type === 'business').length} business survey(s)
                  </Typography>
                  <Typography variant="body2">
                    {surveyAssignments.filter(a => a.subject_type === 'individual').length} individual survey(s)
                  </Typography>
                  <Typography variant="body2">
                    {surveyAssignments.filter(a => a.required).length} required survey(s)
                  </Typography>
                </Box>
              )}
            </Box>

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
              <Button onClick={handleBack}>
                Back
              </Button>
              <Button variant="contained" color="primary" onClick={handleFinalSubmit}>
                Create Visit
              </Button>
            </Box>
          </Paper>
        )
      
      default:
        return null
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Create Field Visit
      </Typography>
      
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {renderStepContent()}
    </Box>
  )
}
