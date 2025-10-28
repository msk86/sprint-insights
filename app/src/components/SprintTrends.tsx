import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { SprintData } from '../types';
import { calculateDoraMetrics, calculateReleaseStats } from '../services/stats';

interface SprintTrendsProps {
  currentSprint: SprintData;
  historicalSprints: SprintData[];
}

const SprintTrends: React.FC<SprintTrendsProps> = ({ 
  currentSprint, 
  historicalSprints 
}) => {
  const extractSprintIndex = (sprintName: string, sprintIndex: number): string => {
    // Extract sprint index using regex pattern
    const match = sprintName.match(/(^|\D)(\d{1,4})(\D|$)/);
    if (match && match[2]) {
      return match[2];
    }
    // Fallback to sprint.index if available
    return `${sprintIndex}`;
  };

  const prepareTrendData = () => {
    // Combine all sprints and sort by index in ascending order
    const allSprints = [...historicalSprints, currentSprint].sort((a, b) => {
      const indexA = a.sprint.index ?? 0;
      const indexB = b.sprint.index ?? 0;
      return indexA - indexB;
    });
    
    return allSprints.map((sprint) => {
      const sprintIndex = extractSprintIndex(sprint.sprint.name, sprint.sprint.index);
      const doraMetrics = calculateDoraMetrics(sprint);
      const releaseStats = calculateReleaseStats(sprint);
      
      // Calculate completion metrics
      const completedIssues = sprint.issues.filter(issue => issue.flags?.isCompleted).length;
      const closedIssues = sprint.issues.filter(issue => issue.flags?.isClosed).length;
      const completedPoints = sprint.issues
        .filter(issue => issue.flags?.isCompleted || issue.flags?.isClosed)
        .reduce((sum, issue) => sum + issue.storyPoints, 0);
      
      // Calculate abnormal issue metrics
      const unplannedIssues = sprint.issues.filter(issue => issue.flags?.isUnplanned).length;
      const blockedIssues = sprint.issues.filter(issue => issue.flags?.isBlocked).length;
      const backAndForthIssues = sprint.issues.filter(issue => issue.flags?.isBackAndForth).length;
      
      return {
        name: `Sprint ${sprintIndex}`,
        sprintName: sprint.sprint.name,
        
        // DORA metrics
        deploymentFrequency: doraMetrics.deploymentFrequency,
        leadTime: doraMetrics.avgLeadTime,
        changeFailureRate: doraMetrics.changeFailureRate,
        mttr: doraMetrics.mttr / 3600, // Convert to hours
        
        // Story points and issues
        completedPoints,
        completedIssues,
        
        // Completion metrics
        totalIssues: sprint.issues.length,
        closedIssues,
        
        // Abnormal issue metrics
        unplannedIssues,
        blockedIssues,
        backAndForthIssues,
        
        // Release metrics
        totalReleases: releaseStats.totalReleases,
        successfulReleases: releaseStats.successfulReleases,
      };
    });
  };

  const trendData = prepareTrendData();

  const sprintLabelFormatter = (label: any, payload: any) => {
    if (payload && payload.length > 0 && payload[0]?.payload) {
      return `Sprint: ${payload[0].payload.sprintName}`;
    }
    return label;
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Sprint Trends
      </Typography>

      <Grid container spacing={3}>
        {/* Left Column */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* DORA: Lead Time for Changes */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Lead Time for Changes
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis label={{ value: 'Days', angle: -90, position: 'insideLeft' }} />
                      <Tooltip 
                        formatter={(value: number) => [`${value.toFixed(1)} days`, 'Lead Time']}
                        labelFormatter={sprintLabelFormatter as any}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="leadTime" 
                        stroke="#8884d8" 
                        strokeWidth={2}
                        name="Lead Time (days)"
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>

            {/* DORA: Change Failure Rate */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Change Failure Rate
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis label={{ value: '%', angle: -90, position: 'insideLeft' }} />
                      <Tooltip 
                        formatter={(value: number) => [`${value.toFixed(1)}%`, 'Failure Rate']}
                        labelFormatter={sprintLabelFormatter as any}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="changeFailureRate" 
                        stroke="#ff6b6b" 
                        strokeWidth={2}
                        name="Failure Rate (%)"
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>

            {/* Story Points & Issues */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Completed Story Points & Issues
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: number, name: string) => [
                          name === 'Completed Issues' ? `${value} issues` : `${value} points`,
                          name
                        ]}
                        labelFormatter={sprintLabelFormatter as any}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="completedPoints" 
                        stroke="#82ca9d" 
                        strokeWidth={2}
                        name="Completed Points"
                        isAnimationActive={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="completedIssues" 
                        stroke="#8884d8" 
                        strokeWidth={2}
                        name="Completed Issues"
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>

            {/* Abnormal Issue Metrics */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Abnormal Issue Metrics
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: number) => [`${value} issues`]}
                        labelFormatter={sprintLabelFormatter as any}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="unplannedIssues" 
                        stroke="#ff9800" 
                        strokeWidth={2}
                        name="Unplanned Issues"
                        isAnimationActive={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="blockedIssues" 
                        stroke="#f44336" 
                        strokeWidth={2}
                        name="Blocked Issues"
                        isAnimationActive={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="backAndForthIssues" 
                        stroke="#9c27b0" 
                        strokeWidth={2}
                        name="Back-and-forth Issues"
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Grid>

        {/* Right Column */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* DORA: Deployment Frequency */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Deployment Frequency
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis label={{ value: 'Per Day', angle: -90, position: 'insideLeft' }} />
                      <Tooltip 
                        formatter={(value: number) => [`${value.toFixed(2)} per day`, 'Deployment Frequency']}
                        labelFormatter={sprintLabelFormatter as any}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="deploymentFrequency" 
                        stroke="#4caf50" 
                        strokeWidth={2}
                        name="Deployments/day"
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>

            {/* DORA: Mean Time to Restore */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Mean Time to Restore
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                      <Tooltip 
                        formatter={(value: number) => [`${value.toFixed(1)} hours`, 'MTTR']}
                        labelFormatter={sprintLabelFormatter as any}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="mttr" 
                        stroke="#ff9800" 
                        strokeWidth={2}
                        name="MTTR (hours)"
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>

            {/* Issue Completion Metrics */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Issue Completion Metrics
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: number) => [`${value} issues`]}
                        labelFormatter={sprintLabelFormatter as any}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="totalIssues" 
                        stroke="#8884d8" 
                        strokeWidth={2}
                        name="Total Issues"
                        isAnimationActive={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="completedIssues" 
                        stroke="#4caf50" 
                        strokeWidth={2}
                        name="Completed"
                        isAnimationActive={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="closedIssues" 
                        stroke="#9e9e9e" 
                        strokeWidth={2}
                        name="Closed"
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>

            {/* Release Metrics */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Release Metrics
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: number) => [`${value} releases`]}
                        labelFormatter={sprintLabelFormatter as any}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="totalReleases" 
                        stroke="#2196f3" 
                        strokeWidth={2}
                        name="Total Releases"
                        isAnimationActive={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="successfulReleases" 
                        stroke="#4caf50" 
                        strokeWidth={2}
                        name="Successful Releases"
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SprintTrends;
