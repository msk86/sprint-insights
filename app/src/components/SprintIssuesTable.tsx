import React, { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Visibility as VisibilityIcon } from '@mui/icons-material';
import { SprintData, Issue } from '../types';
import { formatDate, formatDateTime } from '../utils/dateFormat';

interface SprintIssuesTableProps {
  sprintData: SprintData;
}

const SprintIssuesTable: React.FC<SprintIssuesTableProps> = ({ sprintData }) => {
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const columns: GridColDef[] = [
    {
      field: 'key',
      headerName: 'Key',
      width: 120,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'summary',
      headerName: 'Summary',
      width: 300,
      renderCell: (params) => (
        <Typography variant="body2" noWrap>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'storyPoints',
      headerName: 'Points',
      width: 80,
      type: 'number',
    },
    {
      field: 'subCategory',
      headerName: 'Category',
      width: 150,
      renderCell: (params) => (
        <Chip
          label={params.value || 'N/A'}
          size="small"
          color={params.value ? 'primary' : 'default'}
        />
      ),
    },
    {
      field: 'created',
      headerName: 'Created',
      width: 120,
      type: 'date',
      valueGetter: (params) => new Date(params.value),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      renderCell: (params) => (
        <IconButton
          size="small"
          onClick={() => {
            setSelectedIssue(params.row);
            setDialogOpen(true);
          }}
        >
          <VisibilityIcon />
        </IconButton>
      ),
    },
  ];

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedIssue(null);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Sprint Issues ({sprintData.issues.length} total)
      </Typography>
      
      <Box sx={{ height: 480, width: '100%' }}>
        <DataGrid
          rows={sprintData.issues}
          columns={columns}
          pageSizeOptions={[15, 30, 50]}
          initialState={{
            pagination: {
              paginationModel: { page: 0, pageSize: 15 },
            },
          }}
          disableRowSelectionOnClick
        />
      </Box>

      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Issue Details: {selectedIssue?.key}
        </DialogTitle>
        <DialogContent>
          {selectedIssue && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {selectedIssue.summary}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Created: {formatDate(selectedIssue.created)}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Story Points: {selectedIssue.storyPoints}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Category: {selectedIssue.subCategory || 'N/A'}
              </Typography>
              
              {selectedIssue.history && selectedIssue.history.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Status History
                  </Typography>
                  {selectedIssue.history
                    .filter(history => history.inSprint)
                    .map((history, index) => (
                      <Box key={index} sx={{ mb: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="body2">
                          <strong>{history.fromString}</strong> → <strong>{history.toString}</strong>
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDateTime(history.at)}
                        </Typography>
                      </Box>
                    ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SprintIssuesTable;
