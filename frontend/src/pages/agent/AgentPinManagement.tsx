import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Paper, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  Chip, IconButton, Alert, CircularProgress, Tooltip
} from '@mui/material'
import { Refresh, LockReset, CheckCircle, Cancel } from '@mui/icons-material'
import { toast } from 'react-hot-toast'
import { useAuthStore } from '../../store/auth.store'
import { API_CONFIG } from '../../config/api.config'

function getToken(): string | null {
  return useAuthStore.getState().tokens?.access_token || localStorage.getItem('token')
}

interface AgentPinInfo {
  id: string
  first_name: string
  last_name: string
  phone: string
  role: string
  has_pin: number
  team_lead_id: string | null
}

export default function AgentPinManagement() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState<AgentPinInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<AgentPinInfo | null>(null)
  const [newPin, setNewPin] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchAgents = async () => {
    setLoading(true)
    try {
      const token = getToken()
      if (!token) return
      const res = await fetch(`${API_CONFIG.BASE_URL}/agent/pin-status`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        setAgents(Array.isArray(data.data) ? data.data : [])
      }
    } catch (err) {
      console.error('Fetch agents error:', err)
      toast.error('Failed to load agents')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAgents() }, [])

  const handleSetPin = async () => {
    if (!selectedAgent || !newPin) return
    if (!/^\d{4,6}$/.test(newPin)) {
      toast.error('PIN must be 4-6 digits')
      return
    }

    setSaving(true)
    try {
      const token = getToken()
      const res = await fetch(`${API_CONFIG.BASE_URL}/agent/set-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ agent_id: selectedAgent.id, pin: newPin })
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`PIN ${selectedAgent.has_pin ? 'reset' : 'set'} for ${selectedAgent.first_name} ${selectedAgent.last_name}`)
        setDialogOpen(false)
        setNewPin('')
        setSelectedAgent(null)
        fetchAgents()
      } else {
        toast.error(data.message || 'Failed to set PIN')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  const openDialog = (agent: AgentPinInfo) => {
    setSelectedAgent(agent)
    setNewPin('')
    setDialogOpen(true)
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">Agent PIN Management</Typography>
        <Button startIcon={<Refresh />} onClick={fetchAgents} variant="outlined" size="small">Refresh</Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        Set or reset PINs for field agents. Agents use their phone number + PIN to login on mobile devices.
      </Alert>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : agents.length === 0 ? (
        <Alert severity="warning">No agents found. Create agents in User Management first.</Alert>
      ) : (
        <Paper sx={{ overflow: 'hidden' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Role</TableCell>
                <TableCell align="center">PIN Set</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {agent.first_name} {agent.last_name}
                    </Typography>
                  </TableCell>
                  <TableCell>{agent.phone || 'N/A'}</TableCell>
                  <TableCell>
                    <Chip
                      label={agent.role.replace('_', ' ')}
                      size="small"
                      color={agent.role === 'team_lead' ? 'primary' : 'default'}
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    {agent.has_pin ? (
                      <CheckCircle color="success" fontSize="small" />
                    ) : (
                      <Cancel color="error" fontSize="small" />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={agent.has_pin ? 'Reset PIN' : 'Set PIN'}>
                      <IconButton size="small" onClick={() => openDialog(agent)} color="primary">
                        <LockReset />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Set/Reset PIN Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {selectedAgent?.has_pin ? 'Reset' : 'Set'} PIN for {selectedAgent?.first_name} {selectedAgent?.last_name}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Phone: {selectedAgent?.phone}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="New PIN (4-6 digits)"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').substring(0, 6))}
            type="password"
            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6 }}
            helperText="The agent will use this PIN to login on their mobile device"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSetPin} variant="contained" disabled={saving || newPin.length < 4}>
            {saving ? <CircularProgress size={20} /> : (selectedAgent?.has_pin ? 'Reset PIN' : 'Set PIN')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
