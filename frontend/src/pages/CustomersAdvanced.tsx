/**
 * Advanced Customers Page with DataGrid
 */

import React, { useEffect, useState } from 'react';
import { Container, Typography, Box, Alert } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import AdvancedDataTable from '../components/AdvancedDataTable';
import api from '../services/api';

const CustomersAdvanced: React.FC = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/customers');
      setCustomers(response.data.customers || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (id: string, updatedRow: any) => {
    try {
      await api.put(`/customers/${id}`, updatedRow);
      setCustomers(customers.map((c: any) => (c.id === id ? updatedRow : c)));
    } catch (err: any) {
      console.error('Failed to update customer:', err);
      throw err;
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/customers/${id}`);
      setCustomers(customers.filter((c: any) => c.id !== id));
    } catch (err: any) {
      console.error('Failed to delete customer:', err);
      throw err;
    }
  };

  const handleAdd = async (newCustomer: any) => {
    try {
      const response = await api.post('/customers', newCustomer);
      setCustomers([...customers, response.data]);
    } catch (err: any) {
      console.error('Failed to add customer:', err);
      throw err;
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => api.delete(`/customers/${id}`)));
      setCustomers(customers.filter((c: any) => !ids.includes(c.id)));
    } catch (err: any) {
      console.error('Failed to bulk delete:', err);
      throw err;
    }
  };

  const handleExport = (format: 'csv' | 'excel') => {
    // Custom export logic can be added here
  };

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 100 },
    { field: 'name', headerName: 'Name', width: 200, editable: true },
    { field: 'email', headerName: 'Email', width: 250, editable: true },
    { field: 'phone', headerName: 'Phone', width: 150, editable: true },
    { field: 'company', headerName: 'Company', width: 200, editable: true },
    { field: 'address', headerName: 'Address', width: 250, editable: true },
    {
      field: 'created_at',
      headerName: 'Created',
      width: 150,
      valueFormatter: (params) =>
        params ? new Date(params).toLocaleDateString() : '',
    },
  ];

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Customers Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Advanced data table with sorting, filtering, and inline editing
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <AdvancedDataTable
        rows={customers}
        columns={columns}
        title="Customers"
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAdd={handleAdd}
        onBulkDelete={handleBulkDelete}
        onExport={handleExport}
        enableEdit={true}
        enableDelete={true}
        enableAdd={true}
        enableBulkActions={true}
        enableExport={true}
        pageSize={25}
      />
    </Container>
  );
};

export default CustomersAdvanced;
