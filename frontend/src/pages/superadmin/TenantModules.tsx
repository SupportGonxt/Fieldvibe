import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Button, Card, CardContent, Typography, Switch, FormControlLabel,
  Grid, Chip, IconButton, Alert, Snackbar, Divider, Paper
} from '@mui/material'
import { ArrowBack as ArrowBackIcon, Save as SaveIcon, Refresh as RefreshIcon } from '@mui/icons-material'
import { apiClient } from '../../services/api.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

interface ModuleConfig {
  key: string
  label: string
  description: string
  category: string
  enabled: boolean
}

const ALL_MODULES: Omit<ModuleConfig, 'enabled'>[] = [
  { key: 'field_operations', label: 'Field Operations', description: 'Field visits, board placements, GPS tracking, agent management', category: 'Operations' },
  { key: 'van_sales', label: 'Van Sales', description: 'Van routes, van loads, mobile sales, cash reconciliation', category: 'Sales' },
  { key: 'orders', label: 'Orders & Deliveries', description: 'Order management, deliveries, returns, order lifecycle', category: 'Sales' },
  { key: 'inventory', label: 'Inventory', description: 'Stock management, transfers, adjustments, batch tracking', category: 'Operations' },
  { key: 'finance', label: 'Finance', description: 'Invoices, payments, cash reconciliation, commission payouts', category: 'Finance' },
  { key: 'commissions', label: 'Commissions', description: 'Commission rules, calculations, approvals, payouts', category: 'Finance' },
  { key: 'marketing', label: 'Marketing', description: 'Campaigns, events, activations, promotions', category: 'Marketing' },
  { key: 'trade_marketing', label: 'Trade Marketing', description: 'Brand activations, merchandising compliance, promoter management', category: 'Marketing' },
  { key: 'surveys', label: 'Surveys', description: 'Survey builder, responses, analytics', category: 'Data Collection' },
  { key: 'kyc', label: 'KYC / Compliance', description: 'Customer verification, document management, compliance reports', category: 'Data Collection' },
  { key: 'insights', label: 'Insights & Analytics', description: 'Executive dashboard, anomaly detection, competitor insights', category: 'Analytics' },
  { key: 'reports', label: 'Reports & Exports', description: 'Report builder, templates, PDF/Excel exports', category: 'Analytics' },
  { key: 'brands', label: 'Brand Management', description: 'Brand profiles, brand-specific analytics, board management', category: 'Marketing' },
  { key: 'customers', label: 'Customer Management', description: 'Customer profiles, credit management, customer analytics', category: 'Sales' },
  { key: 'products', label: 'Product Management', description: 'Product catalog, pricing, hierarchy, import/export', category: 'Sales' },
]

const TenantModules: React.FC = () => {
  const { tenantId } = useParams<{ tenantId: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tenantName, setTenantName] = useState('')
  const [modules, setModules] = useState<Record<string, boolean>>({})
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' })

  useEffect(() => {
    fetchTenantModules()
  }, [tenantId])

  const fetchTenantModules = async () => {
    try {
      setLoading(true)
      const [tenantRes, modulesRes] = await Promise.all([
        apiClient.get(`/tenants/${tenantId}`),
        apiClient.get(`/tenants/${tenantId}/modules`).catch(() => ({ data: { data: {} } }))
      ])
      setTenantName(tenantRes.data.data?.name || tenantRes.data.name || 'Unknown Tenant')
      const enabledModules = modulesRes.data.data || {}
      const moduleState: Record<string, boolean> = {}
      ALL_MODULES.forEach(m => {
        moduleState[m.key] = enabledModules[m.key] !== undefined ? enabledModules[m.key] : true
      })
      setModules(moduleState)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      setSnackbar({ open: true, message: 'Failed to load tenant: ' + msg, severity: 'error' })
      const moduleState: Record<string, boolean> = {}
      ALL_MODULES.forEach(m => { moduleState[m.key] = true })
      setModules(moduleState)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = (key: string) => {
    setModules(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleEnableAll = () => {
    const newModules: Record<string, boolean> = {}
    ALL_MODULES.forEach(m => { newModules[m.key] = true })
    setModules(newModules)
  }

  const handleDisableAll = () => {
    const newModules: Record<string, boolean> = {}
    ALL_MODULES.forEach(m => { newModules[m.key] = false })
    setModules(newModules)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await apiClient.put(`/tenants/${tenantId}/modules`, { modules })
      setSnackbar({ open: true, message: 'Modules saved successfully', severity: 'success' })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      setSnackbar({ open: true, message: 'Failed to save: ' + msg, severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const categories = [...new Set(ALL_MODULES.map(m => m.category))]
  const enabledCount = Object.values(modules).filter(Boolean).length

  if (loading) return <Box sx={{ p: 3 }}><LoadingSpinner size="lg" /></Box>

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <IconButton onClick={() => navigate('/superadmin/tenants')}><ArrowBackIcon /></IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" fontWeight="bold">Module Configuration</Typography>
          <Typography color="textSecondary">{tenantName} — {enabledCount} of {ALL_MODULES.length} modules enabled</Typography>
        </Box>
        <Button variant="outlined" size="small" onClick={handleEnableAll} sx={{ mr: 1 }}>Enable All</Button>
        <Button variant="outlined" size="small" color="warning" onClick={handleDisableAll} sx={{ mr: 1 }}>Disable All</Button>
        <IconButton onClick={fetchTenantModules} sx={{ mr: 1 }}><RefreshIcon /></IconButton>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </Box>

      {categories.map(category => (
        <Box key={category} sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>{category}</Typography>
          <Grid container spacing={2}>
            {ALL_MODULES.filter(m => m.category === category).map(mod => (
              <Grid item xs={12} md={6} lg={4} key={mod.key}>
                <Card variant="outlined" sx={{ opacity: modules[mod.key] ? 1 : 0.6 }}>
                  <CardContent sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="subtitle1" fontWeight="bold">{mod.label}</Typography>
                        <Chip
                          label={modules[mod.key] ? 'Enabled' : 'Disabled'}
                          color={modules[mod.key] ? 'success' : 'default'}
                          size="small"
                        />
                      </Box>
                      <Typography variant="body2" color="textSecondary">{mod.description}</Typography>
                    </Box>
                    <Switch
                      checked={modules[mod.key] || false}
                      onChange={() => handleToggle(mod.key)}
                      color="primary"
                    />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          <Divider sx={{ mt: 2 }} />
        </Box>
      ))}

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default TenantModules
