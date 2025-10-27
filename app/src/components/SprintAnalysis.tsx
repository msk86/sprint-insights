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
    const totalIssues = sprintData.issues.length;
    const totalStoryPoints = sprintData.issues.reduce((sum, issue) => sum + issue.storyPoints, 0);
    const avgStoryPoints = totalIssues > 0 ? totalStoryPoints / totalIssues : 0;
    
    const categories = sprintData.issues.reduce((acc, issue) => {
      const category = issue.subCategory || 'Uncategorized';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalIssues,
      totalStoryPoints,
      avgStoryPoints,
      categories,
    };
  };

  const stats = calculateStats();

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
                    Total Issues
                  </Typography>
                  <Typography variant="h4">
                    {stats.totalIssues}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Total Story Points
                  </Typography>
                  <Typography variant="h4">
                    {stats.totalStoryPoints}
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
