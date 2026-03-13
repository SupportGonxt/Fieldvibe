import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper
} from '@mui/material';
import {
  Person,
  ExitToApp,
  Assignment,
  LocalShipping,
  Inventory,
  Payment,
  TrendingUp,
  Phone,
  Business
} from '@mui/icons-material';

interface Agent {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: string;
  status: string;
}

interface Tenant {
  id: string;
  code: string;
  name: string;
}

const AgentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/auth/mobile-login');
      return;
    }

    const agentData = localStorage.getItem('user');
    const tenantData = localStorage.getItem('tenant');

    if (agentData) setAgent(JSON.parse(agentData));
    if (tenantData) setTenant(JSON.parse(tenantData));
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('tenant');
    navigate('/auth/mobile-login');
  };

  if (!agent || !tenant) {
    return <Box>Loading...</Box>;
  }

  const menuItems = [
    { icon: <Assignment />, text: 'My Orders', path: '/agent/orders' },
    { icon: <LocalShipping />, text: 'Van Sales', path: '/van-sales' },
    { icon: <Inventory />, text: 'Inventory', path: '/van-sales/inventory' },
    { icon: <Payment />, text: 'Payments', path: '/agent/payments' },
    { icon: <TrendingUp />, text: 'Performance', path: '/agent/performance' },
  ];

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', py: 3 }}>
      <Container maxWidth="md">
        {/* Header Card */}
        <Paper elevation={3} sx={{ mb: 3, borderRadius: 2 }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box display="flex" alignItems="center" gap={2}>
                <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main' }}>
                  {agent.name.charAt(0)}
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight="bold">
                    {agent.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <Phone sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                    {agent.mobile}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <Business sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                    {tenant.name}
                  </Typography>
                </Box>
              </Box>
              <Button
                variant="outlined"
                color="error"
                startIcon={<ExitToApp />}
                onClick={handleLogout}
              >
                Logout
              </Button>
            </Box>
          </CardContent>
        </Paper>

        {/* Quick Stats */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="primary" fontWeight="bold">
                  12
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Today's Orders
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6}>
            <Card>
              <CardContent>
                <Typography variant="h4" color="success.main" fontWeight="bold">
                  R 45,890
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Today's Sales
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Menu Items */}
        <Paper elevation={3} sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" mb={2}>
              Quick Actions
            </Typography>
            <List>
              {menuItems.map((item, index) => (
                <React.Fragment key={index}>
                  <ListItem
                    button
                    onClick={() => navigate(item.path)}
                    sx={{
                      borderRadius: 1,
                      mb: 1,
                      '&:hover': {
                        bgcolor: 'primary.light',
                        color: 'white',
                        '& .MuiListItemIcon-root': { color: 'white' }
                      }
                    }}
                  >
                    <ListItemIcon sx={{ color: 'primary.main' }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.text} />
                  </ListItem>
                  {index < menuItems.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Paper>

        {/* Footer Info */}
        <Box mt={3} textAlign="center">
          <Typography variant="caption" color="white">
            FieldVibe Mobile v1.0 • {tenant.code}
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default AgentDashboard;
