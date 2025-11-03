import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Chip,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Visibility as VisibilityIcon } from '@mui/icons-material';
import { SprintData, Build } from '../types';
import { formatDateTime } from '../utils/dateFormat';

interface SprintReleasesProps {
  sprintData: SprintData;
}

interface PipelineStats {
  id: string;
  pipelineName: string;
  repository: string;
  totalBuilds: number;
  successBuilds: number;
  avgBuildDuration: string;
  totalReleases: number;
  successReleases: number;
  latestBuildTimestamp: string;
  builds: Build[];
}

// Helper function to format duration
const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
};

const SprintReleases: React.FC<SprintReleasesProps> = ({ sprintData }) => {
  const [selectedPipeline, setSelectedPipeline] = useState<PipelineStats | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Aggregate builds by pipeline and repository
  const pipelineStats: PipelineStats[] = useMemo(() => {
    const statsMap = new Map<string, PipelineStats>();

    sprintData.builds.forEach(build => {
      const key = `${build.pipelineName}_${build.repository}`;
      
      if (!statsMap.has(key)) {
        statsMap.set(key, {
          id: key,
          pipelineName: build.pipelineName,
          repository: build.repository,
          totalBuilds: 0,
          successBuilds: 0,
          avgBuildDuration: '0s',
          totalReleases: 0,
          successReleases: 0,
          latestBuildTimestamp: '',
          builds: []
        });
      }

      const stats = statsMap.get(key)!;
      stats.builds.push(build);
      
      // Only count builds that occurred during the sprint for statistics
      if (build.inSprint) {
        stats.totalBuilds++;
        
        if (build.status === 'passed') {
          stats.successBuilds++;
        }
        
        if (build.isRelease) {
          stats.totalReleases++;
          if (build.isReleaseSuccess) {
            stats.successReleases++;
          }
        }
      }
    });

    // Calculate average build duration and find latest build timestamp
    statsMap.forEach(stats => {
      // Only calculate average duration for builds in sprint
      const inSprintBuilds = stats.builds.filter(b => b.inSprint);
      const totalDuration = inSprintBuilds.reduce((sum, build) => sum + build.duration, 0);
      const avgSeconds = inSprintBuilds.length > 0 ? totalDuration / inSprintBuilds.length : 0;
      stats.avgBuildDuration = formatDuration(avgSeconds);
      
      // Find the latest build timestamp (most recent startedAt) from ALL builds (including pre-sprint)
      if (stats.builds.length > 0) {
        const latestBuild = stats.builds.reduce((latest, current) => {
          return new Date(current.startedAt) > new Date(latest.startedAt) ? current : latest;
        });
        stats.latestBuildTimestamp = latestBuild.startedAt;
      }
    });

    // Sort by latest build timestamp (most recent first)
    return Array.from(statsMap.values()).sort((a, b) => {
      // If both have timestamps, sort by date
      if (a.latestBuildTimestamp && b.latestBuildTimestamp) {
        return new Date(b.latestBuildTimestamp).getTime() - new Date(a.latestBuildTimestamp).getTime();
      }
      // If only one has a timestamp, prioritize the one with a timestamp
      if (a.latestBuildTimestamp) return -1;
      if (b.latestBuildTimestamp) return 1;
      // If neither has a timestamp, maintain original order
      return 0;
    });
  }, [sprintData.builds]);

  const columns: GridColDef[] = [
    {
      field: 'pipelineName',
      headerName: 'Pipeline Name',
      width: 250,
      renderCell: (params) => (
        <Typography variant="body2" noWrap>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'repository',
      headerName: 'Repository',
      width: 500,
      renderCell: (params) => (
        <Typography variant="body2" noWrap>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'totalBuilds',
      headerName: 'Total Builds',
      width: 120,
      type: 'number',
      align: 'center',
      headerAlign: 'center',
    },
    {
      field: 'successBuilds',
      headerName: 'Success Builds',
      width: 130,
      type: 'number',
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const total = params.row.totalBuilds;
        const success = params.value as number;
        const rate = total > 0 ? ((success / total) * 100).toFixed(0) : null;
        return (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2">{success}</Typography>
            {rate !== null && (
              <Typography variant="caption" color="text.secondary">
                ({rate}%)
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      field: 'avgBuildDuration',
      headerName: 'Avg Duration',
      width: 120,
      align: 'center',
      headerAlign: 'center',
    },
    {
      field: 'latestBuildTimestamp',
      headerName: 'Latest Build',
      width: 180,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        if (!params.value) return '-';
        
        const latestBuildDate = new Date(params.value as string);
        const sprintEndDate = new Date(sprintData.sprint.end);
        const daysDiff = Math.floor((sprintEndDate.getTime() - latestBuildDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Determine color based on days difference
        let colorStyle = {};
        if (daysDiff >= 90) {
          colorStyle = { color: 'error.main' }; // Red if 90+ days old
        } else if (daysDiff >= 30) {
          colorStyle = { color: 'warning.main' }; // Amber if 30+ days old
        }
        
        return (
          <Typography variant="body2" sx={colorStyle}>
            {formatDateTime(latestBuildDate)}
          </Typography>
        );
      },
    },
    {
      field: 'totalReleases',
      headerName: 'Total Releases',
      width: 130,
      type: 'number',
      align: 'center',
      headerAlign: 'center',
    },
    {
      field: 'successReleases',
      headerName: 'Success Releases',
      width: 140,
      type: 'number',
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const total = params.row.totalReleases;
        const success = params.value as number;
        const rate = total > 0 ? ((success / total) * 100).toFixed(0) : null;
        return (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2">{success}</Typography>
            {rate !== null && (
              <Typography variant="caption" color="text.secondary">
                ({rate}%)
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        // Only show action button if pipeline has builds in sprint
        if (params.row.totalBuilds === 0) {
          return '-';
        }
        
        return (
          <IconButton
            size="small"
            onClick={() => {
              setSelectedPipeline(params.row);
              setDialogOpen(true);
            }}
          >
            <VisibilityIcon />
          </IconButton>
        );
      },
    },
  ];

  const buildColumns: GridColDef[] = [
    {
      field: 'buildNumber',
      headerName: 'Build #',
      width: 100,
      align: 'center',
      headerAlign: 'center',
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const status = params.value as string;
        const color = status === 'passed' ? 'success' : status === 'failed' ? 'error' : 'default';
        return <Chip label={status} size="small" color={color} />;
      },
    },
    {
      field: 'branch',
      headerName: 'Branch',
      width: 200,
    },
    {
      field: 'duration',
      headerName: 'Duration',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Typography variant="body2">
          {formatDuration(params.value as number)}
        </Typography>
      ),
    },
    {
      field: 'isRelease',
      headerName: 'Release',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const build = params.row as Build;
        if (!build.isRelease) return '-';
        return (
          <Chip 
            label={build.isReleaseSuccess ? 'Success' : 'Failed'} 
            size="small" 
            color={build.isReleaseSuccess ? 'success' : 'error'}
            variant="outlined"
          />
        );
      },
    },
    {
      field: 'startedAt',
      headerName: 'Started At',
      width: 180,
      renderCell: (params) => (
        <Typography variant="body2">
          {formatDateTime(new Date(params.value as string))}
        </Typography>
      ),
    },
  ];

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedPipeline(null);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Release Pipeline Statistics ({pipelineStats.length} pipelines, {sprintData.builds.filter(b => b.inSprint).length} builds)
      </Typography>
      
      <Box sx={{ width: '100%' }}>
        <DataGrid
          rows={pipelineStats}
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
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Pipeline Builds: {selectedPipeline?.pipelineName}
        </DialogTitle>
        <DialogContent>
          {selectedPipeline && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Repository: {selectedPipeline.repository}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
                Total Builds in Sprint: {selectedPipeline.totalBuilds}
              </Typography>
              
              <Box sx={{ height: 600, width: '100%' }}>
                <DataGrid
                  rows={selectedPipeline.builds
                    .filter(build => build.inSprint)
                    .map((build, index) => ({
                      id: `${build.pipelineName}-${build.buildNumber}-${index}`,
                      ...build
                    }))}
                  columns={buildColumns}
                  pageSizeOptions={[30, 50]}
                  initialState={{
                    pagination: {
                      paginationModel: { page: 0, pageSize: 30 },
                    },
                    sorting: {
                      sortModel: [{ field: 'buildNumber', sort: 'desc' }],
                    },
                  }}
                  disableRowSelectionOnClick
                />
              </Box>
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

export default SprintReleases;

