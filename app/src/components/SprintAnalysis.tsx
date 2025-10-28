import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Tooltip as MuiTooltip,
  IconButton,
} from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { SprintData, LLMAnalysisResponse } from '../types';
import { formatDays } from '../utils/timeCalculation';
import {
  calculateSprintStats,
  calculateReleaseStats,
  calculateDoraMetrics,
  getSuccessRateColor,
  formatDuration,
  getDeploymentFrequencyLevel,
  getLeadTimeLevel,
  getChangeFailureRateLevel,
  getMTTRLevel,
  CATEGORY_COLORS,
  COMPLETION_COLORS,
  PLAN_COLORS,
} from '../services/stats';

interface SprintAnalysisProps {
  sprintData: SprintData;
  llmAnalysis: LLMAnalysisResponse | null;
  loading: boolean;
}

const SprintAnalysis: React.FC<SprintAnalysisProps> = ({ 
  sprintData, 
  llmAnalysis, 
  loading 
}) => {
  const stats = calculateSprintStats(sprintData);
  const releaseStats = calculateReleaseStats(sprintData);
  const doraMetrics = calculateDoraMetrics(sprintData);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Sprint Analysis
      </Typography>

      <Grid container spacing={3}>
        {/* Left Column */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* DORA Metrics */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  DORA Metrics
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        Deployment Frequency
                      </Typography>
                      <MuiTooltip title="Successful releases per business day" arrow>
                        <IconButton size="small" sx={{ p: 0 }}>
                          <InfoIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </MuiTooltip>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography variant="h4">
                        {doraMetrics.deploymentFrequency.toFixed(2)}
                      </Typography>
                      <Chip
                        size="small"
                        label={getDeploymentFrequencyLevel(doraMetrics.deploymentFrequency).label}
                        color={getDeploymentFrequencyLevel(doraMetrics.deploymentFrequency).color}
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        Lead Time for Changes
                      </Typography>
                      <MuiTooltip title="Median cycle time from work start to completion" arrow>
                        <IconButton size="small" sx={{ p: 0 }}>
                          <InfoIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </MuiTooltip>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography variant="h4">
                        {doraMetrics.avgLeadTime > 0 ? formatDays(doraMetrics.avgLeadTime) : 'N/A'}
                      </Typography>
                      <Chip
                        size="small"
                        label={getLeadTimeLevel(doraMetrics.avgLeadTime).label}
                        color={getLeadTimeLevel(doraMetrics.avgLeadTime).color}
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        Change Failure Rate
                      </Typography>
                      <MuiTooltip title="Number of incidents per successful release" arrow>
                        <IconButton size="small" sx={{ p: 0 }}>
                          <InfoIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </MuiTooltip>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography variant="h4">
                        {doraMetrics.changeFailureRate.toFixed(1)}%
                      </Typography>
                      <Chip
                        size="small"
                        label={getChangeFailureRateLevel(doraMetrics.changeFailureRate).label}
                        color={getChangeFailureRateLevel(doraMetrics.changeFailureRate).color}
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        Mean Time to Restore
                      </Typography>
                      <MuiTooltip title="Median time to resolve incidents from creation to completion" arrow>
                        <IconButton size="small" sx={{ p: 0 }}>
                          <InfoIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </MuiTooltip>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography variant="h4">
                        {doraMetrics.mttr > 0 ? formatDuration(doraMetrics.mttr) : 'N/A'}
                      </Typography>
                      <Chip
                        size="small"
                        label={getMTTRLevel(doraMetrics.mttr).label}
                        color={getMTTRLevel(doraMetrics.mttr).color}
                      />
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
            
            {/* Sprint Statistics */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Sprint Statistics
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        Throughput
                      </Typography>
                      <MuiTooltip title="Number of completed issues" arrow>
                        <IconButton size="small" sx={{ p: 0 }}>
                          <InfoIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </MuiTooltip>
                    </Box>
                    <Typography variant="h4">
                      {stats.throughput}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        Velocity
                      </Typography>
                      <MuiTooltip title="Total story points completed" arrow>
                        <IconButton size="small" sx={{ p: 0 }}>
                          <InfoIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </MuiTooltip>
                    </Box>
                    <Typography variant="h4">
                      {stats.velocity}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        Avg Cycle Time
                      </Typography>
                      <MuiTooltip title="Average time from work start to completion" arrow>
                        <IconButton size="small" sx={{ p: 0 }}>
                          <InfoIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </MuiTooltip>
                    </Box>
                    <Typography variant="h4">
                      {formatDays(stats.avgCycleTime)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        Avg Points per Issue
                      </Typography>
                      <MuiTooltip title="Average story points across all issues" arrow>
                        <IconButton size="small" sx={{ p: 0 }}>
                          <InfoIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </MuiTooltip>
                    </Box>
                    <Typography variant="h4">
                      {stats.avgStoryPoints.toFixed(1)}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Completion Distribution */}
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Typography variant="h6">
                    Completion Status
                  </Typography>
                  <MuiTooltip title="Distribution of issues by completion status: Completed, Closed, Spillover, or Not Started" arrow>
                    <IconButton size="small" sx={{ p: 0 }}>
                      <InfoIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </MuiTooltip>
                </Box>
                {stats.completionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={stats.completionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {stats.completionData.map((entry) => (
                          <Cell key={`cell-${entry.name}`} fill={COMPLETION_COLORS[entry.name as keyof typeof COMPLETION_COLORS]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `${value} issues`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography color="text.secondary">No data available</Typography>
                )}
              </CardContent>
            </Card>

          </Box>
        </Grid>

        {/* Right Column */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Release Statistics */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Release Statistics
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        Total Releases
                      </Typography>
                      <MuiTooltip title="Total number of production deployments" arrow>
                        <IconButton size="small" sx={{ p: 0 }}>
                          <InfoIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </MuiTooltip>
                    </Box>
                    <Typography variant="h4">
                      {releaseStats.totalReleases}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        Successful Releases
                      </Typography>
                      <MuiTooltip title="Number of successful production deployments" arrow>
                        <IconButton size="small" sx={{ p: 0 }}>
                          <InfoIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </MuiTooltip>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography variant="h4">
                        {releaseStats.successfulReleases}
                      </Typography>
                      {releaseStats.totalReleases > 0 && (
                        <Chip
                          label={`${releaseStats.releaseSuccessRate.toFixed(0)}%`}
                          size="small"
                          color={getSuccessRateColor(releaseStats.releaseSuccessRate, releaseStats.totalReleases > 0)}
                        />
                      )}
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        Total Builds
                      </Typography>
                      <MuiTooltip title="Total number of CI/CD builds" arrow>
                        <IconButton size="small" sx={{ p: 0 }}>
                          <InfoIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </MuiTooltip>
                    </Box>
                    <Typography variant="h4">
                      {releaseStats.totalBuilds}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        Successful Builds
                      </Typography>
                      <MuiTooltip title="Number of successful CI/CD builds" arrow>
                        <IconButton size="small" sx={{ p: 0 }}>
                          <InfoIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </MuiTooltip>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography variant="h4">
                        {releaseStats.successfulBuilds}
                      </Typography>
                      {releaseStats.totalBuilds > 0 && (
                        <Chip
                          label={`${releaseStats.buildSuccessRate.toFixed(0)}%`}
                          size="small"
                          color={getSuccessRateColor(releaseStats.buildSuccessRate, releaseStats.totalBuilds > 0)}
                        />
                      )}
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        Avg Build Duration
                      </Typography>
                      <MuiTooltip title="Average time to complete a build" arrow>
                        <IconButton size="small" sx={{ p: 0 }}>
                          <InfoIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </MuiTooltip>
                    </Box>
                    <Typography variant="h4">
                      {formatDuration(releaseStats.avgBuildDuration)}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Category Distribution */}
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Typography variant="h6">
                    Issues by Category
                  </Typography>
                  <MuiTooltip title="Distribution of issues across different sub-categories or work types" arrow>
                    <IconButton size="small" sx={{ p: 0 }}>
                      <InfoIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </MuiTooltip>
                </Box>
                {stats.categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={stats.categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {stats.categoryData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `${value} issues`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography color="text.secondary">No data available</Typography>
                )}
              </CardContent>
            </Card>

            {/* Plan Distribution */}
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Typography variant="h6">
                    Planned vs Unplanned
                  </Typography>
                  <MuiTooltip title="Distribution of issues created before sprint (Planned) vs during sprint (Unplanned)" arrow>
                    <IconButton size="small" sx={{ p: 0 }}>
                      <InfoIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </MuiTooltip>
                </Box>
                {stats.planData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={stats.planData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {stats.planData.map((entry) => (
                          <Cell key={`cell-${entry.name}`} fill={PLAN_COLORS[entry.name as keyof typeof PLAN_COLORS]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `${value} issues`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography color="text.secondary">No data available</Typography>
                )}
              </CardContent>
            </Card>
          </Box>
        </Grid>

        {/* AI Analysis - Full Width at Bottom */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                AI Analysis
              </Typography>
              {loading ? (
                <Box display="flex" justifyContent="center" py={2}>
                  <CircularProgress />
                </Box>
              ) : llmAnalysis ? (
                <Box>
                  <Typography variant="body1" paragraph>
                    {llmAnalysis.analysis}
                  </Typography>
                  
                  {llmAnalysis.insights && llmAnalysis.insights.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Key Insights
                      </Typography>
                      {llmAnalysis.insights.map((insight, index) => (
                        <Alert key={index} severity="info" sx={{ mb: 1 }}>
                          {insight}
                        </Alert>
                      ))}
                    </Box>
                  )}

                  {llmAnalysis.recommendations && llmAnalysis.recommendations.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Recommendations
                      </Typography>
                      {llmAnalysis.recommendations.map((recommendation, index) => (
                        <Alert key={index} severity="success" sx={{ mb: 1 }}>
                          {recommendation}
                        </Alert>
                      ))}
                    </Box>
                  )}
                </Box>
              ) : (
                <Typography color="text.secondary">
                  No analysis available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SprintAnalysis;
