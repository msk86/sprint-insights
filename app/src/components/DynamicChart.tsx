import React, { useMemo, useState } from 'react';
import { Box, Typography, Paper, Alert, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { OpenInFull as OpenInFullIcon } from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { ChartConfiguration } from '../types';
import { calculateIssueTimeSpentOnColumns } from '../services/issue';

interface DynamicChartProps {
  chartConfig: ChartConfiguration;
  sprintData: any;
  historicalData?: any[];
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0'];

const DynamicChart: React.FC<DynamicChartProps> = ({ chartConfig, sprintData, historicalData }) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { chartData, error } = useMemo(() => {
    try {
      // Enrich all sprints with timeSpent and filter out boundary events
      const enrichSprint = (sprint: any) => {
        const enrichedIssues = sprint.issues.map((issue: any) => {
          const timeSpent = issue.timeSpent || calculateIssueTimeSpentOnColumns(issue, sprint);
          // Filter out boundary events (inSprint: false) from history
          const filteredHistory = issue.history.filter((h: any) => h.inSprint);
          return {
            ...issue,
            timeSpent,
            history: filteredHistory
          };
        });
        return { ...sprint, issues: enrichedIssues };
      };

      // Create allSprints array (current sprint is LAST)
      const enrichedHistorical = historicalData?.map(enrichSprint) || [];
      const enrichedCurrent = enrichSprint(sprintData);
      const allSprints = [...enrichedHistorical, enrichedCurrent];

      // Execute the data transformation function
      // Only allSprints is available to match LLM prompt
      // eslint-disable-next-line no-new-func
      const transformFn = new Function('allSprints', `
        ${chartConfig.dataTransform}
      `);

      const result = transformFn(allSprints);
      return { chartData: result, error: null };
    } catch (err) {
      console.error('Chart data transformation error:', err);
      return { chartData: null, error: String(err) };
    }
  }, [chartConfig, sprintData, historicalData]);

  if (error) {
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        Failed to generate chart: {error}
      </Alert>
    );
  }

  if (!chartData || (Array.isArray(chartData) && chartData.length === 0)) {
    return (
      <Alert severity="info" sx={{ my: 2 }}>
        No data available for this chart
      </Alert>
    );
  }

  const renderChart = () => {
    switch (chartConfig.type) {
      case 'line':
        return (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            {chartConfig.config.xAxisKey && (
              <XAxis
                dataKey={chartConfig.config.xAxisKey}
                label={chartConfig.config.xAxisLabel ? { value: chartConfig.config.xAxisLabel, position: 'insideBottom', offset: -5 } : undefined}
              />
            )}
            <YAxis label={chartConfig.config.yAxisLabel ? { value: chartConfig.config.yAxisLabel, angle: -90, position: 'insideLeft' } : undefined} />
            <Tooltip />
            <Legend />
            {chartConfig.config.dataKeys.map((dataKey, index) => (
              <Line
                key={dataKey.key}
                type="monotone"
                dataKey={dataKey.key}
                name={dataKey.name}
                stroke={dataKey.color || COLORS[index % COLORS.length]}
                strokeWidth={2}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        );

      case 'bar':
        return (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            {chartConfig.config.xAxisKey && (
              <XAxis
                dataKey={chartConfig.config.xAxisKey}
                label={chartConfig.config.xAxisLabel ? { value: chartConfig.config.xAxisLabel, position: 'insideBottom', offset: -5 } : undefined}
              />
            )}
            <YAxis label={chartConfig.config.yAxisLabel ? { value: chartConfig.config.yAxisLabel, angle: -90, position: 'insideLeft' } : undefined} />
            <Tooltip />
            <Legend />
            {chartConfig.config.dataKeys.map((dataKey, index) => (
              <Bar
                key={dataKey.key}
                dataKey={dataKey.key}
                name={dataKey.name}
                fill={dataKey.color || COLORS[index % COLORS.length]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        );

      case 'pie':
        return (
          <PieChart>
            <Pie
              data={chartData}
              dataKey={chartConfig.config.dataKeys[0]?.key || 'value'}
              nameKey={chartConfig.config.xAxisKey || 'name'}
              cx="50%"
              cy="50%"
              outerRadius={100}
              label
              isAnimationActive={false}
            >
              {chartData.map((_: any, index: number) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        );

      case 'area':
        return (
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            {chartConfig.config.xAxisKey && (
              <XAxis
                dataKey={chartConfig.config.xAxisKey}
                label={chartConfig.config.xAxisLabel ? { value: chartConfig.config.xAxisLabel, position: 'insideBottom', offset: -5 } : undefined}
              />
            )}
            <YAxis label={chartConfig.config.yAxisLabel ? { value: chartConfig.config.yAxisLabel, angle: -90, position: 'insideLeft' } : undefined} />
            <Tooltip />
            <Legend />
            {chartConfig.config.dataKeys.map((dataKey, index) => (
              <Area
                key={dataKey.key}
                type="monotone"
                dataKey={dataKey.key}
                name={dataKey.name}
                stroke={dataKey.color || COLORS[index % COLORS.length]}
                fill={dataKey.color || COLORS[index % COLORS.length]}
                fillOpacity={0.6}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        );

      default:
        return <Alert severity="warning">Unsupported chart type: {chartConfig.type}</Alert>;
    }
  };

  return (
    <>
      <Paper sx={{ p: 2, my: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6">
            {chartConfig.title}
          </Typography>
          <IconButton size="small" onClick={() => setDialogOpen(true)} title="Expand chart">
            <OpenInFullIcon />
          </IconButton>
        </Box>
        <Box sx={{ width: '100%', height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </Box>
      </Paper>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>{chartConfig.title}</DialogTitle>
        <DialogContent>
          <Box sx={{ width: '100%', height: 600 }}>
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DynamicChart;

