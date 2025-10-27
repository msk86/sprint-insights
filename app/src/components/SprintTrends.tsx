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
      return {
        name: `Sprint ${sprintIndex}`,
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
      };
    });
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
                      labelFormatter={((label: any, payload: any) => {
                        if (payload && payload.length > 0 && payload[0]?.payload) {
                          return `Sprint: ${payload[0].payload.sprintName}`;
                        }
                        return label;
                      }) as any}
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
      </Grid>
    </Box>
  );
};

export default SprintTrends;
