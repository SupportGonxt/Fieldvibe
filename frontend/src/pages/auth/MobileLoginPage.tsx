import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Container, 
  TextField, 
  Button, 
  Typography, 
  Paper,
  Alert,
  CircularProgress,
  InputAdornment
} from '@mui/material';
import { Phone, LockOpen } from '@mui/icons-material';

const MobileLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/mobile-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Code': 'DEMO'
        },
        body: JSON.stringify({ mobile, pin })
      });

      const data = await response.json();

      if (data.success) {
        // Store auth token
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.agent));
        localStorage.setItem('tenant', JSON.stringify(data.tenant));
        
        // Navigate to agent dashboard
        navigate('/agent/dashboard');
      } else {
        setError(data.error?.message || 'Login failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatMobile = (value: string) => {
    // Auto-format mobile number
    const cleaned = value.replace(/[^\d+]/g, '');
    if (!cleaned.startsWith('+27') && cleaned.length > 0) {
      if (cleaned.startsWith('0')) {
        return '+27' + cleaned.substring(1);
      }
      return '+27' + cleaned;
    }
    return cleaned;
  };

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatMobile(e.target.value);
    setMobile(formatted);
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, 6);
    setPin(value);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={10}
          sx={{
            p: 4,
            borderRadius: 3,
            background: 'rgba(255, 255, 255, 0.95)'
          }}
        >
          <Box textAlign="center" mb={3}>
            <Typography variant="h4" fontWeight="bold" color="primary" gutterBottom>
              FieldVibe
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Agent Mobile Login
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Mobile Number"
              value={mobile}
              onChange={handleMobileChange}
              placeholder="+27820000001"
              margin="normal"
              required
              autoFocus
              type="tel"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Phone color="primary" />
                  </InputAdornment>
                ),
              }}
              helperText="Enter mobile number (format: +27820000001)"
            />

            <TextField
              fullWidth
              label="PIN"
              value={pin}
              onChange={handlePinChange}
              placeholder="123456"
              margin="normal"
              required
              type="password"
              inputProps={{
                inputMode: 'numeric',
                pattern: '[0-9]*',
                maxLength: 6
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOpen color="primary" />
                  </InputAdornment>
                ),
              }}
              helperText="Enter your 6-digit PIN"
            />

            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              disabled={loading || !mobile || pin.length !== 6}
              sx={{ 
                mt: 3, 
                py: 1.5,
                background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #5568d3 30%, #65418b 90%)',
                }
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Login'}
            </Button>

            <Box mt={3} textAlign="center">
              <Typography variant="body2" color="text.secondary">
                Demo Credentials:
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                Mobile: +27820000001 to +27820000007
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                PIN: 123456
              </Typography>
            </Box>

            <Box mt={2} textAlign="center">
              <Button
                variant="text"
                onClick={() => navigate('/login')}
                sx={{ textTransform: 'none' }}
              >
                Admin/Manager Login
              </Button>
            </Box>
          </form>
        </Paper>
      </Container>
    </Box>
  );
};

export default MobileLoginPage;
