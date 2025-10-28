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
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from 'recharts';
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
  calculateDailyCumulativePoints,
  calculateDailyCumulativeIssues,
  isUsingStoryPoints,
  CATEGORY_COLORS,
  COMPLETION_COLORS,
  PLAN_COLORS,
} from '../services/stats';

interface SprintAnalysisProps {
  sprintData: SprintData;
  llmAnalysis: LLMAnalysisResponse | null;
  loading: boolean;
}

type CardType = 'metrics-grid' | 'pie-chart' | 'area-chart' | 'ai-analysis';

interface MetricItem {
  label: string;
  value: string | number;
  tooltip: string;
  chip?: {
    label: string;
    color: 'success' | 'warning' | 'error' | 'default';
  };
  xs?: number;
}

interface CardConfig {
  type: CardType;
  title: string;
  tooltip?: string;
  render?: () => React.ReactNode;
  metrics?: MetricItem[];
  chartData?: any[];
  chartConfig?: any;
}

const SprintAnalysis: React.FC<SprintAnalysisProps> = ({ 
  sprintData, 
  llmAnalysis, 
  loading 
}) => {
  const stats = calculateSprintStats(sprintData);
  const releaseStats = calculateReleaseStats(sprintData);
  const doraMetrics = calculateDoraMetrics(sprintData);
  const usingStoryPoints = isUsingStoryPoints(sprintData);
  const dailyCumulativeData = usingStoryPoints 
    ? calculateDailyCumulativePoints(sprintData)
    : calculateDailyCumulativeIssues(sprintData);
  
  // Generate colors for each column
  const columnColors = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff8042', 
    '#0088fe', '#00c49f', '#ffbb28', '#a4de6c'
  ];

  // Define all cards configuration
  const cards: CardConfig[] = [
    // DORA Metrics
    {
      type: 'metrics-grid',
      title: 'DORA Metrics',
      metrics: [
        {
          label: 'Deployment Frequency',
          value: doraMetrics.deploymentFrequency.toFixed(2),
          tooltip: 'Successful releases per business day',
          chip: getDeploymentFrequencyLevel(doraMetrics.deploymentFrequency),
          xs: 6
        },
        {
          label: 'Lead Time for Changes',
          value: doraMetrics.avgLeadTime > 0 ? formatDays(doraMetrics.avgLeadTime) : 'N/A',
          tooltip: 'Median cycle time from work start to completion',
          chip: getLeadTimeLevel(doraMetrics.avgLeadTime),
          xs: 6
        },
        {
          label: 'Change Failure Rate',
          value: `${doraMetrics.changeFailureRate.toFixed(1)}%`,
          tooltip: 'Number of incidents per successful release. An incident is an unplanned issue with incident response type (sub-category contains \'incident\').',
          chip: getChangeFailureRateLevel(doraMetrics.changeFailureRate),
          xs: 6
        },
        {
          label: 'Mean Time to Restore',
          value: doraMetrics.mttr > 0 ? formatDuration(doraMetrics.mttr) : 'N/A',
          tooltip: 'Median time to resolve incidents from creation to completion',
          chip: getMTTRLevel(doraMetrics.mttr),
          xs: 6
        }
      ]
    },
    // Release Statistics
    {
      type: 'metrics-grid',
      title: 'Release Statistics',
      metrics: [
        {
          label: 'Total Releases',
          value: releaseStats.totalReleases,
          tooltip: 'Total number of production deployments',
          xs: 6
        },
        {
          label: 'Successful Releases',
          value: releaseStats.successfulReleases,
          tooltip: 'Number of successful production deployments',
          chip: releaseStats.totalReleases > 0 ? {
            label: `${releaseStats.releaseSuccessRate.toFixed(0)}%`,
            color: getSuccessRateColor(releaseStats.releaseSuccessRate, releaseStats.totalReleases > 0)
          } : undefined,
          xs: 6
        },
        {
          label: 'Total Builds',
          value: releaseStats.totalBuilds,
          tooltip: 'Total number of builds',
          xs: 6
        },
        {
          label: 'Successful Builds',
          value: releaseStats.successfulBuilds,
          tooltip: 'Number of successful builds',
          chip: releaseStats.totalBuilds > 0 ? {
            label: `${releaseStats.buildSuccessRate.toFixed(0)}%`,
            color: getSuccessRateColor(releaseStats.buildSuccessRate, releaseStats.totalBuilds > 0)
          } : undefined,
          xs: 6
        },
        {
          label: 'Avg Build Duration',
          value: formatDuration(releaseStats.avgBuildDuration),
          tooltip: 'Average duration of builds',
          xs: 6
        }
      ]
    },
    // Sprint Statistics
    {
      type: 'metrics-grid',
      title: 'Sprint Statistics',
      metrics: [
        {
          label: 'Throughput',
          value: stats.throughput,
          tooltip: 'Number of completed issues',
          xs: usingStoryPoints ? 6 : 12
        },
        ...(usingStoryPoints ? [{
          label: 'Velocity',
          value: stats.velocity,
          tooltip: 'Total story points completed',
          xs: 6
        }] : []),
        {
          label: 'Avg Cycle Time',
          value: formatDays(stats.avgCycleTime),
          tooltip: 'Average time from work start to completion',
          xs: usingStoryPoints ? 6 : 12
        },
        ...(usingStoryPoints ? [{
          label: 'Avg Points per Issue',
          value: stats.avgStoryPoints.toFixed(1),
          tooltip: 'Average story points across all issues',
          xs: 6
        }] : [])
      ]
    },
    // Category Distribution
    {
      type: 'pie-chart',
      title: 'Category Distribution',
      tooltip: 'Distribution of issues by sub-category',
      chartData: stats.categoryData,
      chartConfig: {
        colors: CATEGORY_COLORS,
        label: (entry: any, percent: number) => `${entry.name}: ${(percent * 100).toFixed(0)}%`,
        tooltipFormatter: (value: number) => `${value} issues`
      }
    },
    // Completion Distribution
    {
      type: 'pie-chart',
      title: 'Completion Status',
      tooltip: 'Distribution of issues by completion status: Completed, Closed, or Spillover',
      chartData: stats.completionData,
      chartConfig: {
        colors: COMPLETION_COLORS,
        label: (entry: any, percent: number) => `${entry.name}: ${(percent * 100).toFixed(0)}%`,
        tooltipFormatter: (value: number) => `${value} issues`
      }
    },
    // Plan Distribution
    {
      type: 'pie-chart',
      title: 'Planned vs Unplanned',
      tooltip: 'Distribution of issues created before sprint (Planned) vs during sprint (Unplanned)',
      chartData: stats.planData,
      chartConfig: {
        colors: PLAN_COLORS,
        label: (entry: any, percent: number) => `${entry.name}: ${(percent * 100).toFixed(0)}%`,
        tooltipFormatter: (value: number) => `${value} issues`
      }
    },
    // Daily Cumulative Chart
    {
      type: 'area-chart',
      title: usingStoryPoints ? 'Daily Cumulative Story Points' : 'Daily Cumulative Issues',
      tooltip: usingStoryPoints 
        ? 'Cumulative story points by board column over the sprint duration. Shows how work progresses through different stages.'
        : 'Cumulative issue count by board column over the sprint duration. Shows how work progresses through different stages.',
      render: () => (
        <Box sx={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyCumulativeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                label={{ value: 'Date', position: 'insideBottom', offset: -5 }}
                tick={{ fontSize: 10 }}
              />
              <YAxis 
                label={{ value: usingStoryPoints ? 'Story Points' : 'Issues', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                formatter={(value: number) => usingStoryPoints ? `${value} points` : `${value} issues`}
              />
              <Legend />
              {sprintData.columns.map((column, index) => (
                <Area
                  key={column.name}
                  type="monotone"
                  dataKey={column.name}
                  stackId="1"
                  stroke={columnColors[index % columnColors.length]}
                  fill={columnColors[index % columnColors.length]}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      )
    }
  ];

  const renderMetricsGridCard = (card: CardConfig) => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {card.title}
        </Typography>
        <Grid container spacing={2}>
          {card.metrics?.map((metric, index) => (
            <Grid item xs={metric.xs || 6} key={index}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  {metric.label}
                </Typography>
                <MuiTooltip title={metric.tooltip} arrow>
                  <IconButton size="small" sx={{ p: 0 }}>
                    <InfoIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </MuiTooltip>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <Typography variant="h4">
                  {metric.value}
                </Typography>
                {metric.chip && (
                  <Chip
                    size="small"
                    label={metric.chip.label}
                    color={metric.chip.color}
                  />
                )}
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );

  const renderPieChartCard = (card: CardConfig) => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="h6">
            {card.title}
          </Typography>
          {card.tooltip && (
            <MuiTooltip title={card.tooltip} arrow>
              <IconButton size="small" sx={{ p: 0 }}>
                <InfoIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </MuiTooltip>
          )}
        </Box>
        {card.chartData && card.chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={card.chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => card.chartConfig?.label({ name }, percent)}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                isAnimationActive={false}
              >
                {card.chartData.map((entry, index) => {
                  const colors = card.chartConfig?.colors;
                  const color = Array.isArray(colors)
                    ? colors[index % colors.length]
                    : colors[entry.name as keyof typeof colors];
                  return <Cell key={`cell-${entry.name}`} fill={color} />;
                })}
              </Pie>
              <Tooltip formatter={card.chartConfig?.tooltipFormatter} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <Typography color="text.secondary">No data available</Typography>
        )}
      </CardContent>
    </Card>
  );

  const renderAreaChartCard = (card: CardConfig) => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="h6">
            {card.title}
          </Typography>
          {card.tooltip && (
            <MuiTooltip title={card.tooltip} arrow>
              <IconButton size="small" sx={{ p: 0 }}>
                <InfoIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </MuiTooltip>
          )}
        </Box>
        {card.render?.()}
      </CardContent>
    </Card>
  );

  const renderCard = (card: CardConfig) => {
    switch (card.type) {
      case 'metrics-grid':
        return renderMetricsGridCard(card);
      case 'pie-chart':
        return renderPieChartCard(card);
      case 'area-chart':
        return renderAreaChartCard(card);
      default:
        return null;
    }
  };

  // Split cards into left and right columns based on index
  const leftCards = cards.filter((_, index) => index % 2 === 0);
  const rightCards = cards.filter((_, index) => index % 2 === 1);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Sprint Analysis
      </Typography>

      <Grid container spacing={3}>
        {/* Left Column */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {leftCards.map((card, index) => (
              <React.Fragment key={index}>
                {renderCard(card)}
              </React.Fragment>
            ))}
          </Box>
        </Grid>

        {/* Right Column */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {rightCards.map((card, index) => (
              <React.Fragment key={index}>
                {renderCard(card)}
              </React.Fragment>
            ))}
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
                  {llmAnalysis.analysis && (
                    <Typography variant="body1" paragraph>
                      {llmAnalysis.analysis}
                    </Typography>
                  )}
                  
                  {llmAnalysis.insights && llmAnalysis.insights.length > 0 && (
                    <Box mb={2}>
                      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        Key Insights:
                      </Typography>
                      <ul>
                        {llmAnalysis.insights.map((insight, index) => (
                          <li key={index}>
                            <Typography variant="body2">{insight}</Typography>
                          </li>
                        ))}
                      </ul>
                    </Box>
                  )}
                  
                  {llmAnalysis.recommendations && llmAnalysis.recommendations.length > 0 && (
                    <Box>
                      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        Recommendations:
                      </Typography>
                      <ul>
                        {llmAnalysis.recommendations.map((rec, index) => (
                          <li key={index}>
                            <Typography variant="body2">{rec}</Typography>
                          </li>
                        ))}
                      </ul>
                    </Box>
                  )}
                </Box>
              ) : (
                <Alert severity="info">
                  Click "Analyze with AI" to get insights and recommendations
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SprintAnalysis;
