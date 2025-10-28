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
import { calculateDoraMetrics, calculateReleaseStats, isUsingStoryPoints } from '../services/stats';

interface SprintTrendsProps {
  currentSprint: SprintData;
  historicalSprints: SprintData[];
}

const SprintTrends: React.FC<SprintTrendsProps> = ({ 
  currentSprint, 
  historicalSprints 
}) => {
  // Check if any sprint in the series is using story points
  const allSprints = [currentSprint, ...historicalSprints];
  const usingStoryPoints = allSprints.some(sprint => isUsingStoryPoints(sprint));

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

  // Define all chart cards
  const chartCards = [
    {
      title: 'DORA: Lead Time for Changes',
      yAxisLabel: 'Days',
      lines: [
        {
          dataKey: 'leadTime',
          stroke: '#8884d8',
          name: 'Lead Time (days)',
          formatter: (value: number) => `${value.toFixed(1)} days`
        }
      ]
    },
    {
      title: 'DORA: Deployment Frequency',
      yAxisLabel: 'Per Day',
      lines: [
        {
          dataKey: 'deploymentFrequency',
          stroke: '#4caf50',
          name: 'Deployments/day',
          formatter: (value: number) => `${value.toFixed(2)} per day`
        }
      ]
    },
    {
      title: 'DORA: Change Failure Rate',
      yAxisLabel: '%',
      lines: [
        {
          dataKey: 'changeFailureRate',
          stroke: '#ff6b6b',
          name: 'Failure Rate (%)',
          formatter: (value: number) => `${value.toFixed(1)}%`
        }
      ]
    },
    {
      title: 'DORA: Mean Time to Restore',
      yAxisLabel: 'Hours',
      lines: [
        {
          dataKey: 'mttr',
          stroke: '#ff9800',
          name: 'MTTR (hours)',
          formatter: (value: number) => `${value.toFixed(1)} hours`
        }
      ]
    },
    {
      title: usingStoryPoints ? 'Completed Story Points & Issues' : 'Completed Issues',
      yAxisLabel: '',
      lines: [
        ...(usingStoryPoints ? [{
          dataKey: 'completedPoints',
          stroke: '#82ca9d',
          name: 'Completed Points',
          formatter: (value: number) => `${value} points`
        }] : []),
        {
          dataKey: 'completedIssues',
          stroke: '#8884d8',
          name: 'Completed Issues',
          formatter: (value: number) => `${value} issues`
        }
      ]
    },
    {
      title: 'Issue Completion Metrics',
      yAxisLabel: '',
      lines: [
        {
          dataKey: 'totalIssues',
          stroke: '#8884d8',
          name: 'Total Issues',
          formatter: (value: number) => `${value} issues`
        },
        {
          dataKey: 'completedIssues',
          stroke: '#4caf50',
          name: 'Completed',
          formatter: (value: number) => `${value} issues`
        },
        {
          dataKey: 'closedIssues',
          stroke: '#9e9e9e',
          name: 'Closed',
          formatter: (value: number) => `${value} issues`
        }
      ]
    },
    {
      title: 'Abnormal Issue Metrics',
      yAxisLabel: '',
      lines: [
        {
          dataKey: 'unplannedIssues',
          stroke: '#ff9800',
          name: 'Unplanned Issues',
          formatter: (value: number) => `${value} issues`
        },
        {
          dataKey: 'blockedIssues',
          stroke: '#f44336',
          name: 'Blocked Issues',
          formatter: (value: number) => `${value} issues`
        },
        {
          dataKey: 'backAndForthIssues',
          stroke: '#9c27b0',
          name: 'Back-and-forth Issues',
          formatter: (value: number) => `${value} issues`
        }
      ]
    },
    {
      title: 'Release Metrics',
      yAxisLabel: '',
      lines: [
        {
          dataKey: 'totalReleases',
          stroke: '#2196f3',
          name: 'Total Releases',
          formatter: (value: number) => `${value} releases`
        },
        {
          dataKey: 'successfulReleases',
          stroke: '#4caf50',
          name: 'Successful Releases',
          formatter: (value: number) => `${value} releases`
        }
      ]
    }
  ];

  const renderChartCard = (card: typeof chartCards[0]) => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {card.title}
        </Typography>
        <Box sx={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis label={card.yAxisLabel ? { value: card.yAxisLabel, angle: -90, position: 'insideLeft' } : undefined} />
              <Tooltip 
                formatter={(value: number, name: string) => {
                  const line = card.lines.find(l => l.name === name);
                  return line ? [line.formatter(value), name] : [value, name];
                }}
                labelFormatter={sprintLabelFormatter as any}
              />
              <Legend />
              {card.lines.map((line) => (
                <Line
                  key={line.dataKey}
                  type="monotone"
                  dataKey={line.dataKey}
                  stroke={line.stroke}
                  strokeWidth={2}
                  name={line.name}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );

  // Split cards into left and right columns based on index
  const leftCards = chartCards.filter((_, index) => index % 2 === 0);
  const rightCards = chartCards.filter((_, index) => index % 2 === 1);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Sprint Trends
      </Typography>

      <Grid container spacing={3}>
        {/* Left Column */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {leftCards.map((card, index) => (
              <React.Fragment key={index}>
                {renderChartCard(card)}
              </React.Fragment>
            ))}
          </Box>
        </Grid>

        {/* Right Column */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {rightCards.map((card, index) => (
              <React.Fragment key={index}>
                {renderChartCard(card)}
              </React.Fragment>
            ))}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SprintTrends;
