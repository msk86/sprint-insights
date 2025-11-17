import React, { useMemo, useState } from 'react';
import { Box, Typography, Paper, Alert, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { OpenInFull as OpenInFullIcon } from '@mui/icons-material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { TableConfiguration } from '../types';

interface DynamicTableProps {
  tableConfig: TableConfiguration;
  allSprints: any[];  // Pre-enriched sprint data with timeSpent, builds, and stats
}

const DynamicTable: React.FC<DynamicTableProps> = ({ tableConfig, allSprints }) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { tableData, error } = useMemo(() => {
    try {
      // Execute the data transformation function using pre-enriched allSprints
      // eslint-disable-next-line no-new-func
      const transformFn = new Function('allSprints', `
        ${tableConfig.dataTransform}
      `);

      // Export transform function to window for debugging
      (window as any).dataTransform = transformFn;
      (window as any).allSprints = allSprints;

      const result = transformFn(allSprints);
      
      // Add id field if not present
      const dataWithIds = Array.isArray(result) 
        ? result.map((row, index) => ({ ...row, id: row.id || index }))
        : [];
      
      return { tableData: dataWithIds, error: null };
    } catch (err) {
      console.error('Table data transformation error:', err);
      return { tableData: null, error: String(err) };
    }
  }, [tableConfig, allSprints]);

  if (error) {
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        Failed to generate table: {error}
      </Alert>
    );
  }

  if (!tableData || tableData.length === 0) {
    return (
      <Alert severity="info" sx={{ my: 2 }}>
        No data available for this table
      </Alert>
    );
  }

  // Convert table configuration to DataGrid columns
  const columns: GridColDef[] = tableConfig.columns.map(col => ({
    field: col.field,
    headerName: col.headerName,
    width: col.width || 150,
    type: col.type || 'string',
  }));

  return (
    <>
      <Paper sx={{ p: 2, my: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6">
            {tableConfig.title}
          </Typography>
          <IconButton size="small" onClick={() => setDialogOpen(true)} title="Expand table">
            <OpenInFullIcon />
          </IconButton>
        </Box>
        <Box sx={{ width: '100%', height: Math.min(400, (tableData.length + 1) * 52 + 56) }}>
          <DataGrid
            rows={tableData}
            columns={columns}
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
            }}
            disableRowSelectionOnClick
          />
        </Box>
      </Paper>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>{tableConfig.title}</DialogTitle>
        <DialogContent>
          <Box sx={{ width: '100%', height: 600 }}>
            <DataGrid
              rows={tableData}
              columns={columns}
              pageSizeOptions={[10, 25, 50, 100]}
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
              }}
              disableRowSelectionOnClick
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DynamicTable;

