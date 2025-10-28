import React, { useState, useMemo } from 'react';
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
import { formatDays } from '../utils/timeCalculation';
import { calculateIssueTimeSpentOnColumns } from '../services/issue';

interface SprintIssuesTableProps {
  sprintData: SprintData;
}

interface EnrichedIssue extends Issue {
  timeSpent: Record<string, number>;
  completion: string;
  notes: string;
}

const SprintIssuesTable: React.FC<SprintIssuesTableProps> = ({ sprintData }) => {
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Enrich issues with calculated time spent and computed fields
  const enrichedIssues: EnrichedIssue[] = useMemo(() => {
    return sprintData.issues.map(issue => {
      const timeSpent = calculateIssueTimeSpentOnColumns(issue, sprintData);
      
      // Determine completion status
      let completion = 'No';
      if (issue.flags?.isClosed) {
        completion = 'Closed';
      } else if (issue.flags?.isCompleted) {
        completion = 'Yes';
      }
      
      // Build notes from flags
      const notes: string[] = [];
      if (issue.flags?.isBlocked) notes.push('Blocked');
      if (issue.flags?.isUnplanned) notes.push('Unplanned');
      if (issue.flags?.isNotStarted) notes.push('Not Started');
      if (issue.flags?.isBackAndForth) notes.push('Back-and-forth');
      
      return {
        ...issue,
        timeSpent,
        completion,
        notes: notes.join(', ') || '-'
      };
    });
  }, [sprintData]);

  // Get middle columns (exclude first and last)
  const middleColumns = useMemo(() => {
    if (sprintData.columns.length <= 2) return [];
    return sprintData.columns.slice(1, -1);
  }, [sprintData.columns]);

  // Build dynamic columns
  const columns: GridColDef[] = useMemo(() => {
    const baseColumns: GridColDef[] = [
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
        align: 'center',
        headerAlign: 'center',
      },
      {
        field: 'subCategory',
        headerName: 'Category',
        width: 150,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params) => (
          <Chip
            label={params.value || 'N/A'}
            size="small"
            color={params.value ? 'primary' : 'default'}
          />
        ),
      },
    ];

    // Add dynamic board column time spent columns
    const boardColumns: GridColDef[] = middleColumns.map(column => ({
      field: `timeSpent_${column.name}`,
      headerName: column.name,
      width: 120,
      type: 'number',
      align: 'center',
      headerAlign: 'center',
      valueGetter: (params) => {
        const issue = params.row as EnrichedIssue;
        return issue.timeSpent[column.name] || 0;
      },
      renderCell: (params) => {
        const issue = params.row as EnrichedIssue;
        const days = issue.timeSpent[column.name] || 0;
        return (
          <Typography variant="body2">
            {formatDays(days)}
          </Typography>
        );
      },
    }));

    // Add Completion column
    const completionColumn: GridColDef = {
      field: 'completion',
      headerName: 'Completion',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const value = params.value as string;
        const color = 
          value === 'Yes' ? 'success' : 
          value === 'Closed' ? 'default' : 
          'warning';
        return (
          <Chip
            label={value}
            size="small"
            color={color}
            variant="outlined"
          />
        );
      },
    };

    // Add Notes column
    const notesColumn: GridColDef = {
      field: 'notes',
      headerName: 'Notes',
      width: 200,
      renderCell: (params) => (
        <Typography variant="body2" noWrap>
          {params.value}
        </Typography>
      ),
    };

    // Add Actions column
    const actionsColumn: GridColDef = {
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
    };

    return [...baseColumns, ...boardColumns, completionColumn, notesColumn, actionsColumn];
  }, [middleColumns]);

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedIssue(null);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Sprint Issues ({enrichedIssues.length} total)
      </Typography>
      
      <Box sx={{ width: '100%' }}>
        <DataGrid
          rows={enrichedIssues}
          columns={columns}
          pageSizeOptions={[30, 50]}
          initialState={{
            pagination: {
              paginationModel: { page: 0, pageSize: 30 },
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
