import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as ActivateIcon,
  Pause as SuspendIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { apiClient } from '../../services/api.service'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import LoadingSpinner from '../../components/ui/LoadingSpinner'

interface Tenant {
  id: number;
  name: string;
  code: string;
  domain?: string;
  subscription_plan: string;
  max_users: number;
  status: string;
  created_at: string;
  user_count?: number;
}

interface TenantFormData {
  name: string;
  code: string;
  domain: string;
  subscriptionPlan: string;
  maxUsers: number;
  adminUser: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
}

const TenantManagement: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTenantId, setDeleteTenantId] = useState<number | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  
  const [formData, setFormData] = useState<TenantFormData>({
    name: '',
    code: '',
    domain: '',
    subscriptionPlan: 'basic',
    maxUsers: 10,
    adminUser: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      phone: ''
    }
  });

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/tenants');
      setTenants(response.data.data);
    } catch (error: any) {
      showSnackbar('Failed to fetch tenants: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (tenant?: Tenant) => {
    if (tenant) {
      setEditingTenant(tenant);
      setFormData({
        name: tenant.name,
        code: tenant.code,
        domain: tenant.domain || '',
        subscriptionPlan: tenant.subscription_plan,
        maxUsers: tenant.max_users,
        adminUser: {
          email: '',
          password: '',
          firstName: '',
          lastName: '',
          phone: ''
        }
      });
    } else {
      setEditingTenant(null);
      setFormData({
        name: '',
        code: '',
        domain: '',
        subscriptionPlan: 'basic',
        maxUsers: 10,
        adminUser: {
          email: '',
          password: '',
          firstName: '',
          lastName: '',
          phone: ''
        }
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTenant(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingTenant) {
        await apiClient.put(`/tenants/${editingTenant.id}`, {
          name: formData.name,
          domain: formData.domain,
          subscriptionPlan: formData.subscriptionPlan,
          maxUsers: formData.maxUsers
        });
        showSnackbar('Tenant updated successfully', 'success');
      } else {
        await apiClient.post('/tenants', formData);
        showSnackbar('Tenant created successfully', 'success');
      }
      
      handleCloseDialog();
      fetchTenants();
    } catch (error: any) {
      showSnackbar('Failed to save tenant: ' + error.response?.data?.message || error.message, 'error');
    }
  };

  const handleStatusChange = async (tenantId: number, action: 'activate' | 'suspend' | 'delete') => {
    if (action === 'delete') {
      setDeleteTenantId(tenantId);
      return;
    }
    try {
      await apiClient.post(`/tenants/${tenantId}/${action}`, {});
      showSnackbar(`Tenant ${action}d successfully`, 'success');
      fetchTenants();
    } catch (error: any) {
      showSnackbar(`Failed to ${action} tenant`, 'error');
    }
  };

  const confirmDeleteTenant = async () => {
    if (deleteTenantId === null) return;
    try {
      await apiClient.delete(`/tenants/${deleteTenantId}`);
      showSnackbar('Tenant deleted successfully', 'success');
      fetchTenants();
    } catch (error: any) {
      showSnackbar('Failed to delete tenant', 'error');
    }
    setDeleteTenantId(null);
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'suspended': return 'warning';
      case 'inactive': return 'default';
      case 'deleted': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">Tenant Management</Typography>
        <Box>
          <IconButton onClick={fetchTenants} sx={{ mr: 1 }}><RefreshIcon /></IconButton>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            Create Tenant
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card><CardContent>
            <Typography color="textSecondary" gutterBottom>Total Tenants</Typography>
            <Typography variant="h4">{tenants.length}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card><CardContent>
            <Typography color="textSecondary" gutterBottom>Active</Typography>
            <Typography variant="h4" color="success.main">
              {tenants.filter(t => t.status === 'active').length}
            </Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card><CardContent>
            <Typography color="textSecondary" gutterBottom>Suspended</Typography>
            <Typography variant="h4" color="warning.main">
              {tenants.filter(t => t.status === 'suspended').length}
            </Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card><CardContent>
            <Typography color="textSecondary" gutterBottom>Total Users</Typography>
            <Typography variant="h4">{tenants.reduce((sum, t) => sum + (t.user_count || 0), 0)}</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Tenant Name</TableCell>
              <TableCell>Code</TableCell>
              <TableCell>Plan</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} align="center"><LoadingSpinner size="sm" /></TableCell></TableRow>
            ) : tenants.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center">No tenants found</TableCell></TableRow>
            ) : (
              tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell>{tenant.name}</TableCell>
                  <TableCell><Chip label={tenant.code} size="small" /></TableCell>
                  <TableCell>{tenant.subscription_plan}</TableCell>
                  <TableCell>
                    <Chip label={tenant.status} color={getStatusColor(tenant.status) as any} size="small" />
                  </TableCell>
                  <TableCell>{new Date(tenant.created_at).toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpenDialog(tenant)}><EditIcon fontSize="small" /></IconButton>
                    {tenant.status === 'active' ? (
                      <IconButton size="small" onClick={() => handleStatusChange(tenant.id, 'suspend')} color="warning">
                        <SuspendIcon fontSize="small" />
                      </IconButton>
                    ) : (
                      <IconButton size="small" onClick={() => handleStatusChange(tenant.id, 'activate')} color="success">
                        <ActivateIcon fontSize="small" />
                      </IconButton>
                    )}
                    {tenant.code !== 'SUPERADMIN' && tenant.code !== 'DEMO' && (
                      <IconButton size="small" onClick={() => handleStatusChange(tenant.id, 'delete')} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingTenant ? 'Edit Tenant' : 'Create New Tenant'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Tenant Name" value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Tenant Code" value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  disabled={!!editingTenant} required />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Domain (Optional)" value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })} />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Subscription Plan</InputLabel>
                  <Select value={formData.subscriptionPlan}
                    onChange={(e) => setFormData({ ...formData, subscriptionPlan: e.target.value })}
                    label="Subscription Plan">
                    <MenuItem value="basic">Basic</MenuItem>
                    <MenuItem value="professional">Professional</MenuItem>
                    <MenuItem value="enterprise">Enterprise</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth type="number" label="Max Users" value={formData.maxUsers}
                  onChange={(e) => setFormData({ ...formData, maxUsers: parseInt(e.target.value) })} required />
              </Grid>

              {!editingTenant && (
                <>
                  <Grid item xs={12}><Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Admin User</Typography></Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth label="First Name" value={formData.adminUser.firstName}
                      onChange={(e) => setFormData({ ...formData, adminUser: { ...formData.adminUser, firstName: e.target.value }})} required />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth label="Last Name" value={formData.adminUser.lastName}
                      onChange={(e) => setFormData({ ...formData, adminUser: { ...formData.adminUser, lastName: e.target.value }})} required />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth type="email" label="Email" value={formData.adminUser.email}
                      onChange={(e) => setFormData({ ...formData, adminUser: { ...formData.adminUser, email: e.target.value }})} required />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth label="Phone (Optional)" value={formData.adminUser.phone}
                      onChange={(e) => setFormData({ ...formData, adminUser: { ...formData.adminUser, phone: e.target.value }})} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth type="password" label="Password" value={formData.adminUser.password}
                      onChange={(e) => setFormData({ ...formData, adminUser: { ...formData.adminUser, password: e.target.value }})}
                      required helperText="Minimum 6 characters" />
                  </Grid>
                </>
              )}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">{editingTenant ? 'Update' : 'Create'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <ConfirmDialog
        isOpen={deleteTenantId !== null}
        onClose={() => setDeleteTenantId(null)}
        onConfirm={confirmDeleteTenant}
        title="Delete Tenant"
        message="Are you sure you want to delete this tenant? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </Box>
  );
};

export default TenantManagement;
