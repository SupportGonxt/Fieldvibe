/**
 * Orders Kanban Board Page
 */

import React, { useEffect, useState } from 'react';
import { Container, Typography, Box, Alert, CircularProgress } from '@mui/material';
import KanbanBoard, { KanbanCard, KanbanColumn } from '../components/KanbanBoard';
import api from '../services/api';

const OrdersKanban: React.FC = () => {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/orders');
      const orders = response.data.orders || [];

      // Group orders by status
      const statusGroups = {
        draft: { title: 'Draft', color: '#9e9e9e', cards: [] as KanbanCard[] },
        pending: { title: 'Pending', color: '#ff9800', cards: [] as KanbanCard[], limit: 10 },
        processing: { title: 'Processing', color: '#2196f3', cards: [] as KanbanCard[], limit: 5 },
        shipped: { title: 'Shipped', color: '#4caf50', cards: [] as KanbanCard[] },
        delivered: { title: 'Delivered', color: '#8bc34a', cards: [] as KanbanCard[] },
        cancelled: { title: 'Cancelled', color: '#f44336', cards: [] as KanbanCard[] },
      };

      orders.forEach((order: any) => {
        const status = order.status || 'draft';
        if (statusGroups[status as keyof typeof statusGroups]) {
          statusGroups[status as keyof typeof statusGroups].cards.push({
            id: order.id,
            title: `Order #${order.order_number || order.id}`,
            description: order.customer_name || 'No customer',
            status: status,
            value: parseFloat(order.total_amount) || 0,
            dueDate: order.delivery_date,
            assignee: order.assigned_to,
            priority: order.priority || 'normal',
            tags: order.tags ? order.tags.split(',') : [],
            metadata: order,
          });
        }
      });

      const kanbanColumns: KanbanColumn[] = Object.entries(statusGroups).map(
        ([id, group]) => ({
          id,
          title: group.title,
          color: group.color,
          cards: group.cards,
          limit: group.limit,
        })
      );

      setColumns(kanbanColumns);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const handleCardMove = async (cardId: string, fromColumn: string, toColumn: string) => {
    try {
      await api.put(`/orders/${cardId}`, { status: toColumn });
    } catch (err: any) {
      console.error('Failed to move card:', err);
      throw err;
    }
  };

  const handleCardClick = (card: KanbanCard) => {
    // Navigate to order details or open modal
  };

  const handleCardEdit = (card: KanbanCard) => {
    // Open edit dialog
  };

  const handleCardDelete = async (cardId: string) => {
    try {
      await api.delete(`/orders/${cardId}`);
      fetchOrders(); // Refresh
    } catch (err: any) {
      console.error('Failed to delete order:', err);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Orders Pipeline
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Drag and drop orders to update their status
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <KanbanBoard
        columns={columns}
        onCardMove={handleCardMove}
        onCardClick={handleCardClick}
        onCardEdit={handleCardEdit}
        onCardDelete={handleCardDelete}
      />
    </Container>
  );
};

export default OrdersKanban;
