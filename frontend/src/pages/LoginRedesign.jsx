import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
  Alert,
  Fade,
  Slide,
  useTheme,
  useMediaQuery,
  Divider,
  Link as MuiLink,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Person,
  Lock,
  LoginRounded,
  Business,
  TrendingUp,
  Inventory,
  LocalShipping,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/auth.store';

const LoginRedesign = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [features] = useState([
    { icon: <Business />, text: 'Complete Business Management', color: '#3b82f6' },
    { icon: <TrendingUp />, text: 'Real-time Analytics & Insights', color: '#10b981' },
    { icon: <Inventory />, text: 'Smart Inventory Control', color: '#f59e0b' },
    { icon: <LocalShipping />, text: 'Field Operations Tracking', color: '#8b5cf6' },
  ]);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [features.length]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Use the auth store login function
      await login({
        email: formData.username,
        password: formData.password,
        tenantCode: 'demo'
      });
      
      // Login successful - navigate to dashboard
      console.log('Login successful, navigating to dashboard...');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated Background Circles */}
      <Box
        sx={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          zIndex: 0,
        }}
      >
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              x: [0, 100, 0],
              y: [0, -50, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 10 + i * 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{
              position: 'absolute',
              width: `${200 + i * 100}px`,
              height: `${200 + i * 100}px`,
              borderRadius: '50%',
              background: `rgba(255, 255, 255, ${0.05 + i * 0.02})`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
            }}
          />
        ))}
      </Box>

      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            py: 4,
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{ width: '100%' }}
          >
            <Paper
              elevation={24}
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                overflow: 'hidden',
                borderRadius: 4,
                maxWidth: 1000,
                mx: 'auto',
              }}
            >
              {/* Left Side - Login Form */}
              <Box
                sx={{
                  flex: 1,
                  p: { xs: 4, md: 6 },
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                >
                  <Box sx={{ textAlign: 'center', mb: 4 }}>
                    <Box
                      sx={{
                        width: 80,
                        height: 80,
                        mx: 'auto',
                        mb: 2,
                        borderRadius: '20px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 10px 40px rgba(102, 126, 234, 0.4)',
                      }}
                    >
                      <Business sx={{ fontSize: 40, color: 'white' }} />
                    </Box>
                    <Typography
                      variant="h4"
                      fontWeight="bold"
                      sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        mb: 1,
                      }}
                    >
                      FieldVibe
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Enterprise Business Management Platform
                    </Typography>
                  </Box>
                </motion.div>

                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <Alert severity="error" sx={{ mb: 3 }}>
                        {error}
                      </Alert>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSubmit}>
                  <TextField
                    fullWidth
                    name="username"
                    label="Username"
                    variant="outlined"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    sx={{ mb: 2 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Person color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <TextField
                    fullWidth
                    name="password"
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    variant="outlined"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    sx={{ mb: 3 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock color="action" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />

                  <Button
                    fullWidth
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={loading}
                    endIcon={<LoginRounded />}
                    sx={{
                      py: 1.5,
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #5568d3 0%, #6a4193 100%)',
                        boxShadow: '0 6px 30px rgba(102, 126, 234, 0.6)',
                      },
                    }}
                  >
                    {loading ? 'Signing In...' : 'Sign In'}
                  </Button>
                </form>

                <Box sx={{ mt: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    <MuiLink href="#" underline="hover">
                      Forgot password?
                    </MuiLink>
                    {' · '}
                    <MuiLink href="#" underline="hover">
                      Need help?
                    </MuiLink>
                  </Typography>
                </Box>

                <Divider sx={{ my: 3 }} />

                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    Demo Credentials: admin / admin123
                  </Typography>
                </Box>
              </Box>

              {/* Right Side - Features Showcase */}
              {!isMobile && (
                <Box
                  sx={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    p: 6,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    color: 'white',
                  }}
                >
                  <Typography variant="h5" fontWeight="bold" gutterBottom>
                    Complete Business Solution
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 4, opacity: 0.9 }}>
                    Streamline your operations with our comprehensive enterprise platform
                  </Typography>

                  <Box sx={{ space: 3 }}>
                    <AnimatePresence mode="wait">
                      {features.map(
                        (feature, index) =>
                          index === activeFeature && (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -20 }}
                              transition={{ duration: 0.5 }}
                            >
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  p: 3,
                                  borderRadius: 3,
                                  background: 'rgba(255, 255, 255, 0.1)',
                                  backdropFilter: 'blur(10px)',
                                  mb: 2,
                                }}
                              >
                                <Box
                                  sx={{
                                    width: 60,
                                    height: 60,
                                    borderRadius: 2,
                                    background: feature.color,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    mr: 2,
                                  }}
                                >
                                  {React.cloneElement(feature.icon, { sx: { fontSize: 30 } })}
                                </Box>
                                <Typography variant="h6">{feature.text}</Typography>
                              </Box>
                            </motion.div>
                          )
                      )}
                    </AnimatePresence>
                  </Box>

                  <Box sx={{ mt: 4 }}>
                    {features.map((_, index) => (
                      <Box
                        key={index}
                        sx={{
                          display: 'inline-block',
                          width: 40,
                          height: 4,
                          borderRadius: 2,
                          background:
                            index === activeFeature
                              ? 'white'
                              : 'rgba(255, 255, 255, 0.3)',
                          mr: 1,
                          transition: 'all 0.3s',
                        }}
                      />
                    ))}
                  </Box>

                  <Box sx={{ mt: 'auto', pt: 4 }}>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      ✓ 15+ Enterprise Modules
                      <br />
                      ✓ Real-time Sync & Analytics
                      <br />
                      ✓ Mobile & Web Access
                      <br />
                      ✓ 24/7 Support
                    </Typography>
                  </Box>
                </Box>
              )}
            </Paper>
          </motion.div>
        </Box>
      </Container>
    </Box>
  );
};

export default LoginRedesign;
