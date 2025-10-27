import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import {
  Search as SearchIcon,
  Chat as ChatIcon,
  Analytics as AnalyticsIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { TeamConfig, SprintData, LLMAnalysisResponse } from '../types';
import { teamApi, sprintApi, llmApi } from '../services/api';
import SprintIssuesTable from '../components/SprintIssuesTable';
import SprintAnalysis from '../components/SprintAnalysis';
import SprintTrends from '../components/SprintTrends';
import LLMChat from '../components/LLMChat';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`sprint-tabpanel-${index}`}
      aria-labelledby={`sprint-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const SprintsPage: React.FC = () => {
  const [teams, setTeams] = useState<TeamConfig[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [sprintIdentifier, setSprintIdentifier] = useState<string>('');
  const [historyCount, setHistoryCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sprintData, setSprintData] = useState<SprintData | null>(null);
  const [historicalData, setHistoricalData] = useState<{ currentSprint: SprintData; historicalSprints: SprintData[] } | null>(null);
  const [llmAnalysis, setLlmAnalysis] = useState<LLMAnalysisResponse | null>(null);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      const teamsData = await teamApi.getTeams();
      setTeams(teamsData);
    } catch (err) {
      setError('Failed to load teams');
      console.error('Error loading teams:', err);
    }
  };

  const handleSearch = async () => {
    if (!selectedTeam || !sprintIdentifier) {
      setError('Please select a team and enter a sprint identifier');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get current sprint data (use 'name' since user enters sprint name)
      const currentSprint = await sprintApi.getSprintData(selectedTeam, sprintIdentifier, 'name');
      setSprintData(currentSprint);

      // Get historical data if requested - make parallel calls for each historical sprint
      let historicalSprints: SprintData[] = [];
      if (historyCount > 0 && currentSprint.sprint.index !== undefined) {
        const historicalPromises = Array.from({ length: historyCount }, (_, i) => {
          const historicalIndex = currentSprint.sprint.index! - (i + 1);
          return sprintApi.getSprintData(selectedTeam, historicalIndex, 'index').catch(err => {
            console.warn(`Failed to get historical sprint at index ${historicalIndex}:`, err);
            return null;
          });
        });

        const results = await Promise.all(historicalPromises);
        historicalSprints = results.filter((s): s is SprintData => s !== null);
      }

      setHistoricalData(historicalSprints.length > 0 ? { currentSprint, historicalSprints } : null);

      // Get LLM analysis
      const analysis = await llmApi.analyzeSprint(currentSprint, historicalSprints);
      setLlmAnalysis(analysis);

    } catch (err) {
      setError('Failed to load sprint data');
      console.error('Error loading sprint data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Sprint Analysis
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth>
                <InputLabel>Team</InputLabel>
                <Select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  label="Team"
                >
                  {teams.map((team) => (
                    <MenuItem key={team.team} value={team.team}>
                      {team.team}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Sprint Identifier"
                value={sprintIdentifier}
                onChange={(e) => setSprintIdentifier(e.target.value)}
                placeholder="Sprint name or number"
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <Box>
                <Typography gutterBottom>Historical Sprints: {historyCount}</Typography>
                <Slider
                  value={historyCount}
                  onChange={(_e, value) => setHistoryCount(value as number)}
                  min={0}
                  max={12}
                  step={1}
                  marks
                  valueLabelDisplay="auto"
                />
              </Box>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<SearchIcon />}
                onClick={handleSearch}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Search'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {sprintData && (
        <Grid container spacing={2}>
          <Grid item xs={12} lg={8}>
            <Paper sx={{ width: '100%' }}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={tabValue} onChange={handleTabChange}>
                  <Tab label="Sprint" icon={<InfoIcon />} />
                  <Tab label="Issues" icon={<AnalyticsIcon />} />
                  <Tab label="Analysis" icon={<ChatIcon />} />
                  <Tab label="Trends" icon={<AnalyticsIcon />} />
                </Tabs>
              </Box>

              {error && (
                <Alert severity="error" sx={{ m: 2 }} onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}

              <TabPanel value={tabValue} index={0}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Sprint Information
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Name:</strong> {sprintData.sprint.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        <strong>Index:</strong> {sprintData.sprint.index}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        <strong>State:</strong> {sprintData.sprint.state}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        <strong>Start Date:</strong> {new Date(sprintData.sprint.start).toLocaleDateString()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        <strong>End Date:</strong> {new Date(sprintData.sprint.end).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <SprintIssuesTable sprintData={sprintData} />
              </TabPanel>

              <TabPanel value={tabValue} index={2}>
                <SprintAnalysis 
                  sprintData={sprintData} 
                  llmAnalysis={llmAnalysis}
                  loading={loading}
                />
              </TabPanel>

              <TabPanel value={tabValue} index={3}>
                <SprintTrends 
                  currentSprint={sprintData}
                  historicalSprints={historicalData?.historicalSprints || []}
                />
              </TabPanel>
            </Paper>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Paper 
              sx={{ 
                position: 'sticky',
                top: 16,
                height: 'calc(100vh - 232px)',
                width: '100%',
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              <LLMChat sprintData={sprintData} />
            </Paper>
          </Grid>
        </Grid>
      )}

      {!sprintData && !loading && (
        <Box textAlign="center" py={4}>
          <Typography variant="h6" color="text.secondary">
            Select a team and sprint to get started
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default SprintsPage;
