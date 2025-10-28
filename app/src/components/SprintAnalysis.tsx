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
        // use history to calculate cycle time
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

    return {
      throughput,
      velocity,
      avgCycleTime,
      avgStoryPoints,
      categories,
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
        {/* Sprint Statistics */}
        <Grid item xs={12} md={6}>
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
        </Grid>

        {/* Release Statistics */}
        <Grid item xs={12} md={6}>
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
        </Grid>

        {/* Category Breakdown */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Issues by Category
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {Object.entries(stats.categories).map(([category, count]) => (
                  <Chip
                    key={category}
                    label={`${category}: ${count}`}
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* LLM Analysis */}
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
