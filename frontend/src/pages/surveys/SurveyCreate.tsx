import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Alert,
  Grid
} from '@mui/material';
import apiClient from '../../services/api';

interface Brand {
  id: string;
  name: string;
}

interface Company {
  id: string;
  name: string;
  code: string;
}

export default function SurveyCreate() {
  const navigate = useNavigate();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    module: 'field_ops',
    type: 'customer_feedback',
    category: 'general',
    target_type: 'both',
    brand_id: '',
    company_id: '',
    survey_type: 'adhoc',
    status: 'draft'
  });

  useEffect(() => {
    loadBrands();
    loadCompanies();
  }, []);

  const loadBrands = async () => {
    try {
      const response = await apiClient.get('/brands');
      setBrands(response.data?.data?.brands || response.data?.data || []);
    } catch (err) {
      console.error('Failed to load brands:', err);
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await apiClient.get('/field-ops/companies');
      const data = response.data?.data || response.data || [];
      setCompanies(Array.isArray(data) ? data : data.companies || []);
    } catch (err) {
      console.error('Failed to load companies:', err);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        brand_id: formData.brand_id || null,
        company_id: formData.company_id || null
      };

      await apiClient.post('/surveys', payload);
      navigate('/surveys');
    } catch (err: unknown) {
      console.error('Failed to create survey:', err);
      const errObj = err as { response?: { data?: { error?: { message?: string } } } };
      setError(errObj.response?.data?.error?.message || 'Failed to create survey');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Create Survey
      </Typography>

      <Paper sx={{ p: 3, mt: 3 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Survey Title"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="e.g., Customer Satisfaction Survey"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe the purpose of this survey..."
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Module</InputLabel>
                <Select
                  value={formData.module}
                  label="Module"
                  onChange={(e) => handleChange('module', e.target.value)}
                >
                  <MenuItem value="field_ops">Field Operations</MenuItem>
                  <MenuItem value="marketing">Marketing</MenuItem>
                  <MenuItem value="campaigns">Campaigns</MenuItem>
                  <MenuItem value="sales">Sales</MenuItem>
                  <MenuItem value="van_sales">Van Sales</MenuItem>
                  <MenuItem value="trade_marketing">Trade Marketing</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Which module this survey belongs to. Surveys appear in the relevant module's visit flow.
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Target Type</InputLabel>
                <Select
                  value={formData.target_type}
                  label="Target Type"
                  onChange={(e) => handleChange('target_type', e.target.value)}
                >
                  <MenuItem value="both">Both (Store & Individual)</MenuItem>
                  <MenuItem value="store">Store Visits Only</MenuItem>
                  <MenuItem value="individual">Individual Visits Only</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                This survey will appear when creating a visit of the selected type.
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Company / Brand</InputLabel>
                <Select
                  value={formData.company_id}
                  label="Company / Brand"
                  onChange={(e) => handleChange('company_id', e.target.value)}
                >
                  <MenuItem value="">
                    <em>All Companies (General Survey)</em>
                  </MenuItem>
                  {companies.map((company) => (
                    <MenuItem key={company.id} value={company.id}>
                      {company.name} {company.code ? `(${company.code})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Link to a specific company/brand. Company-specific surveys appear when visiting for that company.
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Survey Type</InputLabel>
                <Select
                  value={formData.survey_type}
                  label="Survey Type"
                  onChange={(e) => handleChange('survey_type', e.target.value)}
                >
                  <MenuItem value="adhoc">Adhoc (Assigned on-the-fly)</MenuItem>
                  <MenuItem value="mandatory">Mandatory (Required for all visits)</MenuItem>
                  <MenuItem value="feedback">Feedback</MenuItem>
                  <MenuItem value="audit">Audit</MenuItem>
                  <MenuItem value="brand_specific">Brand Specific</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Brand (Optional)</InputLabel>
                <Select
                  value={formData.brand_id}
                  label="Brand (Optional)"
                  onChange={(e) => handleChange('brand_id', e.target.value)}
                >
                  <MenuItem value="">
                    <em>No Brand (General Survey)</em>
                  </MenuItem>
                  {brands.map((brand) => (
                    <MenuItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Status"
                  onChange={(e) => handleChange('status', e.target.value)}
                >
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={formData.type}
                  label="Type"
                  onChange={(e) => handleChange('type', e.target.value)}
                >
                  <MenuItem value="customer_feedback">Customer Feedback</MenuItem>
                  <MenuItem value="product_feedback">Product Feedback</MenuItem>
                  <MenuItem value="market_research">Market Research</MenuItem>
                  <MenuItem value="compliance">Compliance</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.category}
                  label="Category"
                  onChange={(e) => handleChange('category', e.target.value)}
                >
                  <MenuItem value="general">General</MenuItem>
                  <MenuItem value="product">Product</MenuItem>
                  <MenuItem value="service">Service</MenuItem>
                  <MenuItem value="brand">Brand</MenuItem>
                  <MenuItem value="operations">Operations</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {error && (
              <Grid item xs={12}>
                <Alert severity="error">{error}</Alert>
              </Grid>
            )}

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/surveys')}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create Survey'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>

      <Paper sx={{ p: 2, mt: 3, bgcolor: '#f5f5f5' }}>
        <Typography variant="subtitle2" gutterBottom fontWeight="bold">
          How Surveys Work:
        </Typography>
        <Typography variant="body2" component="div">
          1. Choose the <strong>Module</strong> (Field Ops, Marketing, Sales, etc.)<br />
          2. Select the <strong>Company/Brand</strong> this survey is for<br />
          3. Set <strong>Target Type</strong> to Store, Individual, or Both<br />
          4. The survey will automatically appear during visits matching the module, company, and target type<br />
          <br />
          <strong>Survey Types:</strong><br />
          &bull; <strong>Adhoc:</strong> Assigned on-the-fly during visits by agents<br />
          &bull; <strong>Mandatory:</strong> Required for all matching visits (auto-assigned)<br />
          &bull; <strong>Feedback:</strong> Customer/product feedback surveys<br />
          &bull; <strong>Audit:</strong> Compliance and audit surveys<br />
          &bull; <strong>Brand Specific:</strong> Linked to a specific brand
        </Typography>
      </Paper>
    </Box>
  );
}
