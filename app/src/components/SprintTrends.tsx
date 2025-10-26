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

interface SprintTrendsProps {
  currentSprint: SprintData;
  historicalSprints: SprintData[];
}

const SprintTrends: React.FC<SprintTrendsProps> = ({ 
  currentSprint, 
  historicalSprints 
}) => {
  const prepareTrendData = () => {
    const allSprints = [...historicalSprints, currentSprint].reverse();
    
    return allSprints.map((sprint, index) => ({
      name: `Sprint ${index + 1}`,
      sprintName: sprint.sprint.name,
      totalIssues: sprint.issues.length,
      totalStoryPoints: sprint.issues.reduce((sum, issue) => sum + issue.storyPoints, 0),
      avgStoryPoints: sprint.issues.length > 0 
        ? sprint.issues.reduce((sum, issue) => sum + issue.storyPoints, 0) / sprint.issues.length 
        : 0,
      categories: Object.keys(
        sprint.issues.reduce((acc, issue) => {
          const category = issue.subCategory || 'Uncategorized';
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).length,
    }));
  };

  const trendData = prepareTrendData();

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Sprint Trends
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Issues and Story Points Trend
              </Typography>
              <Box sx={{ height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [
                        name === 'totalIssues' ? `${value} issues` : 
                        name === 'totalStoryPoints' ? `${value} points` : 
                        `${value} avg points`,
                        name === 'totalIssues' ? 'Total Issues' :
                        name === 'totalStoryPoints' ? 'Total Story Points' :
                        'Avg Story Points'
                      ]}
                      labelFormatter={(label, payload) => {
                        if (payload && payload[0]) {
                          return `Sprint: ${payload[0].payload.sprintName}`;
                        }
                        return label;
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="totalIssues" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      name="Total Issues"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="totalStoryPoints" 
                      stroke="#82ca9d" 
                      strokeWidth={2}
                      name="Total Story Points"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="avgStoryPoints" 
                      stroke="#ffc658" 
                      strokeWidth={2}
                      name="Avg Story Points"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Sprint Summary
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {trendData.map((sprint, index) => (
                  <Card key={index} variant="outlined" sx={{ minWidth: 200 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {sprint.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {sprint.sprintName}
                      </Typography>
                      <Typography variant="body2">
                        Issues: {sprint.totalIssues}
                      </Typography>
                      <Typography variant="body2">
                        Story Points: {sprint.totalStoryPoints}
                      </Typography>
                      <Typography variant="body2">
                        Avg Points: {sprint.avgStoryPoints.toFixed(1)}
                      </Typography>
                      <Typography variant="body2">
                        Categories: {sprint.categories}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SprintTrends;
