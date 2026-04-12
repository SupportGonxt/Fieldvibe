/**
 * Advanced DataTable Component
 * Features: Sorting, Filtering, Grouping, Export, Inline Editing, Bulk Actions
 */

import React, { useState } from 'react';
import {
  DataGrid,
  GridColDef,
  GridRowsProp,
  GridToolbar,
  GridActionsCellItem,
  GridRowId,
  GridRowModesModel,
  GridRowModes,
  GridEventListener,
  GridRowEditStopReasons,
} from '@mui/x-data-grid';
import {
  Box,
  Button,
  IconButton,
  Chip,
  Stack,
  Paper,
  Typography,
  Menu,
  MenuItem,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  MoreVert as MoreVertIcon,
  FileDownload as ExportIcon,
  Add as AddIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';

interface AdvancedDataTableProps {
  rows: GridRowsProp;
  columns: GridColDef[];
  title?: string;
  loading?: boolean;
  onEdit?: (id: GridRowId, updatedRow: any) => Promise<void>;
  onDelete?: (id: GridRowId) => Promise<void>;
  onAdd?: (newRow: any) => Promise<void>;
  onBulkDelete?: (ids: GridRowId[]) => Promise<void>;
  onExport?: (format: 'csv' | 'excel') => void;
  enableEdit?: boolean;
  enableDelete?: boolean;
  enableAdd?: boolean;
  enableBulkActions?: boolean;
  enableExport?: boolean;
  pageSize?: number;
}

export const AdvancedDataTable: React.FC<AdvancedDataTableProps> = ({
  rows: initialRows,
  columns: initialColumns,
  title,
  loading = false,
  onEdit,
  onDelete,
  onAdd,
  onBulkDelete,
  onExport,
  enableEdit = true,
  enableDelete = true,
  enableAdd = true,
  enableBulkActions = true,
  enableExport = true,
  pageSize = 25,
}) => {
  const [rows, setRows] = useState<GridRowsProp>(initialRows);
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const [selectedRows, setSelectedRows] = useState<GridRowId[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newRowData, setNewRowData] = useState<any>({});

  // Update rows when initialRows change
  React.useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const handleEditClick = (id: GridRowId) => () => {
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } });
  };

  const handleSaveClick = (id: GridRowId) => () => {
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View } });
  };

  const handleDeleteClick = (id: GridRowId) => async () => {
    if (onDelete) {
      await onDelete(id);
      setRows(rows.filter((row) => row.id !== id));
    }
  };

  const handleCancelClick = (id: GridRowId) => () => {
    setRowModesModel({
      ...rowModesModel,
      [id]: { mode: GridRowModes.View, ignoreModifications: true },
    });
  };

  const processRowUpdate = async (newRow: any) => {
    if (onEdit) {
      await onEdit(newRow.id, newRow);
    }
    const updatedRow = { ...newRow, isNew: false };
    setRows(rows.map((row) => (row.id === newRow.id ? updatedRow : row)));
    return updatedRow;
  };

  const handleRowModesModelChange = (newRowModesModel: GridRowModesModel) => {
    setRowModesModel(newRowModesModel);
  };

  const handleRowEditStop: GridEventListener<'rowEditStop'> = (params, event) => {
    if (params.reason === GridRowEditStopReasons.rowFocusOut) {
      event.defaultMuiPrevented = true;
    }
  };

  const handleBulkDelete = async () => {
    if (onBulkDelete && selectedRows.length > 0) {
      await onBulkDelete(selectedRows);
      setRows(rows.filter((row) => !selectedRows.includes(row.id)));
      setSelectedRows([]);
    }
  };

  const handleExport = (format: 'csv' | 'excel') => {
    if (onExport) {
      onExport(format);
    } else {
      // Default CSV export
      const csvContent = exportToCSV(rows as any[], columns);
      downloadFile(csvContent, `${title || 'data'}.csv`, 'text/csv');
    }
    setAnchorEl(null);
  };

  const handleAddRow = async () => {
    if (onAdd) {
      await onAdd(newRowData);
      setAddDialogOpen(false);
      setNewRowData({});
    }
  };

  const exportToCSV = (data: any[], cols: GridColDef[]) => {
    const headers = cols.map((col) => col.headerName || col.field).join(',');
    const csvRows = data.map((row) =>
      cols.map((col) => {
        const value = row[col.field];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value;
      }).join(',')
    );
    return [headers, ...csvRows].join('\n');
  };

  const downloadFile = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Add action columns if edit/delete enabled
  const columns: GridColDef[] = [
    ...initialColumns,
    ...(enableEdit || enableDelete
      ? [{
          field: 'actions',
          type: 'actions' as const,
          headerName: 'Actions',
          width: 100,
          cellClassName: 'actions',
          getActions: ({ id }: any) => {
            const isInEditMode = rowModesModel[id]?.mode === GridRowModes.Edit;

            if (isInEditMode) {
              return [
                <GridActionsCellItem
                  icon={<SaveIcon />}
                  label="Save"
                  sx={{ color: 'primary.main' }}
                  onClick={handleSaveClick(id)}
                />,
                <GridActionsCellItem
                  icon={<CancelIcon />}
                  label="Cancel"
                  onClick={handleCancelClick(id)}
                  color="inherit"
                />,
              ];
            }

            return [
              ...(enableEdit ? [
                <GridActionsCellItem
                  icon={<EditIcon />}
                  label="Edit"
                  onClick={handleEditClick(id)}
                  color="inherit"
                />
              ] : []),
              ...(enableDelete ? [
                <GridActionsCellItem
                  icon={<DeleteIcon />}
                  label="Delete"
                  onClick={handleDeleteClick(id)}
                  color="inherit"
                />
              ] : []),
            ];
          },
        }]
      : []),
  ];

  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">{title || 'Data Table'}</Typography>
        
        <Stack direction="row" spacing={1}>
          {enableBulkActions && selectedRows.length > 0 && (
            <>
              <Chip 
                label={`${selectedRows.length} selected`} 
                color="primary" 
                size="small" 
              />
              <Button
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleBulkDelete}
              >
                Delete Selected
              </Button>
            </>
          )}
          
          {enableAdd && (
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
            >
              Add New
            </Button>
          )}
          
          {enableExport && (
            <>
              <Tooltip title="Export options">
                <IconButton
                  size="small"
                  onClick={(e) => setAnchorEl(e.currentTarget)}
                >
                  <MoreVertIcon />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
              >
                <MenuItem onClick={() => handleExport('csv')}>
                  <ExportIcon fontSize="small" sx={{ mr: 1 }} />
                  Export as CSV
                </MenuItem>
                <MenuItem onClick={() => handleExport('excel')}>
                  <ExportIcon fontSize="small" sx={{ mr: 1 }} />
                  Export as Excel
                </MenuItem>
              </Menu>
            </>
          )}
        </Stack>
      </Box>

      <Box sx={{ flexGrow: 1 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          editMode="row"
          rowModesModel={rowModesModel}
          onRowModesModelChange={handleRowModesModelChange}
          onRowEditStop={handleRowEditStop}
          processRowUpdate={processRowUpdate}
          slots={{
            toolbar: GridToolbar,
          }}
          slotProps={{
            toolbar: {
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 500 },
            },
          }}
          checkboxSelection={enableBulkActions}
          disableRowSelectionOnClick
          onRowSelectionModelChange={(newSelection: any) => {
            setSelectedRows(newSelection as GridRowId[]);
          }}
          pageSizeOptions={[10, 25, 50, 100]}
          initialState={{
            pagination: {
              paginationModel: { pageSize, page: 0 },
            },
          }}
          sx={{
            '& .MuiDataGrid-cell:focus': {
              outline: 'none',
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: 'action.hover',
            },
          }}
        />
      </Box>

      {/* Add Row Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Row</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {initialColumns
              .filter((col) => col.field !== 'id' && col.field !== 'actions')
              .map((col) => (
                <TextField
                  key={col.field}
                  label={col.headerName || col.field}
                  fullWidth
                  value={newRowData[col.field] || ''}
                  onChange={(e) =>
                    setNewRowData({ ...newRowData, [col.field]: e.target.value })
                  }
                />
              ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddRow} variant="contained">
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default AdvancedDataTable;
