import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Grid,
  CircularProgress
} from '@mui/material';
import apiClient from '../../services/api';

interface Brand {
  id: string;
  name: string;
}

export default function SurveyEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'customer_feedback',
    category: 'general',
    target_type: 'both',
    brand_id: '',
    survey_type: 'adhoc',
    status: 'draft'
  });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [surveyRes, brandsRes] = await Promise.all([
        apiClient.get(`/surveys/${id}`),
        apiClient.get('/brands')
      ]);

      const survey = surveyRes.data?.data || surveyRes.data;
      if (survey && survey.id) {
        setFormData({
          title: survey.title || survey.name || '',
          description: survey.description || '',
          type: survey.type || 'customer_feedback',
          category: survey.category || 'general',
          target_type: survey.target_type || 'both',
          brand_id: survey.brand_id || '',
          survey_type: survey.survey_type || survey.visit_type || 'adhoc',
          status: survey.is_active === 0 ? 'archived' : (survey.status || 'draft')
        });
      }

      const brandsData = brandsRes.data?.data?.brands || brandsRes.data?.data || [];
      setBrands(Array.isArray(brandsData) ? brandsData : []);
    } catch (err) {
      console.error('Failed to load survey:', err);
      setError('Failed to load survey');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        brand_id: formData.brand_id || null
      };

      await apiClient.put(`/surveys/${id}`, payload);
      navigate('/surveys');
    } catch (err: any) {
      console.error('Failed to update survey:', err);
      setError(err.response?.data?.error?.message || 'Failed to update survey');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Edit Survey
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
              <FormControl fullWidth required>
                <InputLabel>Target Type</InputLabel>
                <Select
                  value={formData.target_type}
                  label="Target Type"
                  onChange={(e) => handleChange('target_type', e.target.value)}
                >
                  <MenuItem value="both">Both (Business & Individual)</MenuItem>
                  <MenuItem value="business">Business Only (Spaza Shop)</MenuItem>
                  <MenuItem value="individual">Individual Only (People)</MenuItem>
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
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Link this survey to a specific brand. Brand-specific surveys will be auto-suggested when visiting customers of that brand.
              </Typography>
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
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>

      <Paper sx={{ p: 2, mt: 3, bgcolor: '#f5f5f5' }}>
        <Typography variant="subtitle2" gutterBottom fontWeight="bold">
          Survey Type Guide:
        </Typography>
        <Typography variant="body2" component="div">
          • <strong>Adhoc:</strong> Assigned on-the-fly during visits by agents<br />
          • <strong>Mandatory:</strong> Required for all visits (auto-assigned)<br />
          • <strong>Feedback:</strong> Customer/product feedback surveys<br />
          • <strong>Audit:</strong> Compliance and audit surveys<br />
          • <strong>Brand Specific:</strong> Linked to a specific brand
        </Typography>
      </Paper>
    </Box>
  );
}
