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
} from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { SprintData, LLMAnalysisResponse } from '../types';
import { calculateBusinessDays, formatDays } from '../utils/timeCalculation';

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
  // Define colors for pie charts
  const CATEGORY_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B9D'];
  const COMPLETION_COLORS = {
    'Completed': '#4CAF50',
    'Closed': '#9E9E9E',
    'Spillover': '#FF9800',
    'Not Started': '#F44336'
  };
  const PLAN_COLORS = {
    'Planned': '#2196F3',
    'Unplanned': '#FF5722'
  };

  const calculateStats = () => {
    const completedIssues = sprintData.issues.filter(issue => issue.flags?.isCompleted || issue.flags?.isClosed);
    
    const throughput = completedIssues.length;
    const velocity = completedIssues.reduce((sum, issue) => sum + issue.storyPoints, 0);
    
    // Calculate average cycle time for completed issues using workStartedAt and completedAt
    let totalCycleTime = 0;
    let cycleTimeCount = 0;
    completedIssues.forEach(issue => {
      if (issue.workStartedAt && issue.completedAt) {
        const startTime = new Date(issue.workStartedAt);
        const endTime = new Date(issue.completedAt);
        const cycleTime = calculateBusinessDays(startTime, endTime);
        totalCycleTime += cycleTime;
        cycleTimeCount++;
      } else {
        const inSprintHistory = issue.history.filter(h => h.inSprint);
        if (inSprintHistory.length >= 2) {
          const firstEvent = new Date(inSprintHistory[0].at);
          const lastEvent = new Date(inSprintHistory[inSprintHistory.length - 1].at);
          const cycleTime = calculateBusinessDays(firstEvent, lastEvent);
          totalCycleTime += cycleTime;
          cycleTimeCount++;
        }
      }
    });
    const avgCycleTime = cycleTimeCount > 0 ? totalCycleTime / cycleTimeCount : 0;
    
    const totalIssues = sprintData.issues.length;
    const totalStoryPoints = sprintData.issues.reduce((sum, issue) => sum + issue.storyPoints, 0);
    const avgStoryPoints = totalIssues > 0 ? totalStoryPoints / totalIssues : 0;
    
    const categories = sprintData.issues.reduce((acc, issue) => {
      const category = issue.subCategory || 'Uncategorized';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const categoryData = Object.entries(categories).map(([name, value]) => ({ name, value }));

    // Completion distribution
    const completionCounts = {
      'Completed': 0,
      'Closed': 0,
      'Spillover': 0,
      'Not Started': 0
    };
    
    sprintData.issues.forEach(issue => {
      if (issue.flags?.isCompleted) {
        completionCounts['Completed']++;
      } else if (issue.flags?.isClosed) {
        completionCounts['Closed']++;
      } else if (issue.flags?.isSpillover) {
        completionCounts['Spillover']++;
      } else if (issue.flags?.isNotStarted) {
        completionCounts['Not Started']++;
      }
    });
    
    const completionData = Object.entries(completionCounts)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));

    // Plan distribution
    const plannedCount = sprintData.issues.filter(issue => !issue.flags?.isUnplanned).length;
    const unplannedCount = sprintData.issues.filter(issue => issue.flags?.isUnplanned).length;
    
    const planData = [
      { name: 'Planned', value: plannedCount },
      { name: 'Unplanned', value: unplannedCount }
    ].filter(item => item.value > 0);

    return {
      throughput,
      velocity,
      avgCycleTime,
      avgStoryPoints,
      categories,
      categoryData,
      completionData,
      planData,
    };
  };

  const calculateReleaseStats = () => {
    const totalBuilds = sprintData.builds.length;
    const successfulBuilds = sprintData.builds.filter(b => b.status === 'passed').length;
    const buildSuccessRate = totalBuilds > 0 ? (successfulBuilds / totalBuilds) * 100 : 0;
    
    const totalReleases = sprintData.builds.filter(b => b.isRelease).length;
    const successfulReleases = sprintData.builds.filter(b => b.isRelease && b.status === 'passed').length;
    const releaseSuccessRate = totalReleases > 0 ? (successfulReleases / totalReleases) * 100 : 0;
    
    const totalBuildDuration = sprintData.builds.reduce((sum, b) => sum + b.duration, 0);
    const avgBuildDuration = totalBuilds > 0 ? totalBuildDuration / totalBuilds : 0;
    
    return {
      totalBuilds,
      successfulBuilds,
      buildSuccessRate,
      totalReleases,
      successfulReleases,
      releaseSuccessRate,
      avgBuildDuration,
    };
  };

  const stats = calculateStats();
  const releaseStats = calculateReleaseStats();

  const getSuccessRateColor = (rate: number, hasData: boolean): 'success' | 'warning' | 'error' | 'default' => {
    if (!hasData) return 'default';
    if (rate >= 90) return 'success';
    if (rate >= 50) return 'warning';
    return 'error';
  };

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

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Sprint Analysis
      </Typography>

      <Grid container spacing={3}>
        {/* Left Column */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Sprint Statistics */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Sprint Statistics
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Throughput
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      (completed issues)
                    </Typography>
                    <Typography variant="h4">
                      {stats.throughput}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Velocity
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      (completed points)
                    </Typography>
                    <Typography variant="h4">
                      {stats.velocity}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Avg Cycle Time
                    </Typography>
                    <Typography variant="h4">
                      {formatDays(stats.avgCycleTime)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Avg Points per Issue
                    </Typography>
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
                <Typography variant="h6" gutterBottom>
                  Completion Status
                </Typography>
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


            {/* Plan Distribution */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Planned vs Unplanned
                </Typography>
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
                    <Typography variant="body2" color="text.secondary">
                      Total Releases
                    </Typography>
                    <Typography variant="h4">
                      {releaseStats.totalReleases}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Successful Releases
                    </Typography>
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
                    <Typography variant="body2" color="text.secondary">
                      Total Builds
                    </Typography>
                    <Typography variant="h4">
                      {releaseStats.totalBuilds}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Successful Builds
                    </Typography>
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
                    <Typography variant="body2" color="text.secondary">
                      Avg Build Duration
                    </Typography>
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
                <Typography variant="h6" gutterBottom>
                  Issues by Category
                </Typography>
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
