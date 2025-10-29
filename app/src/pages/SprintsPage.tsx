import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Chip,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Chat as ChatIcon,
  Analytics as AnalyticsIcon,
  Info as InfoIcon,
  ChevronRight as ChevronRightIcon,
  ChevronLeft as ChevronLeftIcon,
  RocketLaunch as RocketLaunchIcon,
} from '@mui/icons-material';
import { TeamConfig, SprintData, LLMAnalysisResponse } from '../types';
import { teamApi, sprintApi, llmApi } from '../services/api';
import SprintIssuesTable from '../components/SprintIssuesTable';
import SprintAnalysis from '../components/SprintAnalysis';
import SprintTrends from '../components/SprintTrends';
import SprintReleases from '../components/SprintReleases';
import LLMChat from '../components/LLMChat';
import { formatDate, formatDateRange } from '../utils/dateFormat';
import { applyIssueFlagsToSprintData, FLAG_FILTERS } from '../services/issue';
import { calculateSprintStats, calculateDoraMetrics } from '../services/stats';
import { calculateBuildSummaryByPipeline } from '../utils/buildStats';

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
  const [historyCount, setHistoryCount] = useState<number>(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sprintData, setSprintData] = useState<SprintData | null>(null);
  const [historicalData, setHistoricalData] = useState<{ currentSprint: SprintData; historicalSprints: SprintData[] } | null>(null);
  const [historicalStats, setHistoricalStats] = useState<any[] | null>(null);
  const [llmAnalysis, setLlmAnalysis] = useState<LLMAnalysisResponse | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([]);
  const [selectedFlags, setSelectedFlags] = useState<string[]>([]);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [chatPanelHeight, setChatPanelHeight] = useState<number>(0);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // Get unique sub-categories from sprint data
  const subCategories = useMemo(() => {
    if (!sprintData) return [];
    const categories = Array.from(new Set(sprintData.issues.map(issue => issue.subCategory)));
    return categories.sort();
  }, [sprintData]);

  // Filter issues by selected sub-categories and flags
  const filteredIssues = useMemo(() => {
    if (!sprintData) return [];
    
    let issues = sprintData.issues;
    
    // Filter by sub-categories
    if (selectedSubCategories.length > 0) {
      issues = issues.filter(issue => selectedSubCategories.includes(issue.subCategory));
    }
    
    // Filter by flags
    if (selectedFlags.length > 0) {
      issues = issues.filter(issue => {
        if (!issue.flags) return false;
        return selectedFlags.some(flagKey => 
          issue.flags![flagKey as keyof typeof issue.flags] === true
        );
      });
    }
    
    return issues;
  }, [sprintData, selectedSubCategories, selectedFlags]);

  // Create filtered sprint data for the table
  const filteredSprintData = useMemo(() => {
    if (!sprintData) return null;
    return {
      ...sprintData,
      issues: filteredIssues
    };
  }, [sprintData, filteredIssues]);

  useEffect(() => {
    loadTeams();
  }, []);

  // Smooth dynamic chat panel height calculation
  useEffect(() => {
    const calculateHeight = () => {
      if (!chatPanelRef.current || isChatCollapsed) return;

      const rect = chatPanelRef.current.getBoundingClientRect();
      const topPosition = rect.top;
      const viewportHeight = window.innerHeight;
      const bottomPadding = 16;
      
      // Calculate available height from current position to bottom of viewport
      const availableHeight = viewportHeight - topPosition - bottomPadding;
      const newHeight = Math.max(400, Math.min(availableHeight, viewportHeight - 40));

      setChatPanelHeight(prev => {
        // Only update if difference is significant (reduces re-renders)
        if (Math.abs(prev - newHeight) >= 5) {
          return newHeight;
        }
        return prev;
      });
    };

    // Initial calculation
    calculateHeight();

    // Smooth scroll handler with requestAnimationFrame
    const handleScroll = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(calculateHeight);
    };

    // Resize handler
    const handleResize = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(calculateHeight);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [isChatCollapsed, sprintData]);

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
      
      // Apply issue flags to the sprint data
      const currentSprintWithFlags = applyIssueFlagsToSprintData(currentSprint);
      setSprintData(currentSprintWithFlags);

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
        historicalSprints = results
          .filter((s): s is SprintData => s !== null)
          .map(sprint => applyIssueFlagsToSprintData(sprint));
      }

      setHistoricalData(historicalSprints.length > 0 ? { currentSprint: currentSprintWithFlags, historicalSprints } : null);

      // Calculate stats for LLM context
      const sprintStats = calculateSprintStats(currentSprintWithFlags);
      const doraMetrics = calculateDoraMetrics(currentSprintWithFlags);
      
      // Calculate build/release summary per pipeline
      const buildSummaryByPipeline = calculateBuildSummaryByPipeline(currentSprintWithFlags.builds);
      
      const stats = {
        totalIssues: currentSprintWithFlags.issues.length,
        totalPoints: currentSprintWithFlags.issues.reduce((sum, issue) => sum + issue.storyPoints, 0),
        completedIssues: sprintStats.throughput,
        completedPoints: sprintStats.velocity,
        backAndForthIssues: currentSprintWithFlags.issues.filter(issue => issue.flags?.isBackAndForth).length,
        incidentIssues: currentSprintWithFlags.issues.filter(issue => issue.flags?.isIncidentResponse).length,
        totalBuilds: currentSprintWithFlags.builds.length,
        totalReleases: currentSprintWithFlags.builds.filter(b => b.isRelease).length,
        successfulBuilds: currentSprintWithFlags.builds.filter(b => b.status === 'passed').length,
        successfulReleases: currentSprintWithFlags.builds.filter(b => b.isRelease && b.status === 'passed').length,
        avgBuildDuration: currentSprintWithFlags.builds.length > 0 
          ? currentSprintWithFlags.builds.reduce((sum, b) => sum + b.duration, 0) / currentSprintWithFlags.builds.length / 60
          : 0,
        deploymentFrequency: doraMetrics.deploymentFrequency,
        medianLeadTime: doraMetrics.avgLeadTime,
        changeFailureRate: doraMetrics.changeFailureRate,
        medianMTTR: doraMetrics.mttr,
        buildSummaryByPipeline,
      };

      // Calculate stats for historical sprints
      const historicalStats = historicalSprints.map(sprint => {
        const histStats = calculateSprintStats(sprint);
        const histDora = calculateDoraMetrics(sprint);
        
        // Calculate build/release summary per pipeline for historical sprint
        const buildSummaryByPipeline = calculateBuildSummaryByPipeline(sprint.builds);
        
        return {
          sprintIndex: sprint.sprint.index,
          sprintName: sprint.sprint.name,
          totalIssues: sprint.issues.length,
          totalPoints: sprint.issues.reduce((sum, issue) => sum + issue.storyPoints, 0),
          completedIssues: histStats.throughput,
          completedPoints: histStats.velocity,
          backAndForthIssues: sprint.issues.filter(issue => issue.flags?.isBackAndForth).length,
          incidentIssues: sprint.issues.filter(issue => issue.flags?.isIncidentResponse).length,
          totalBuilds: sprint.builds.length,
          totalReleases: sprint.builds.filter(b => b.isRelease).length,
          successfulBuilds: sprint.builds.filter(b => b.status === 'passed').length,
          successfulReleases: sprint.builds.filter(b => b.isRelease && b.status === 'passed').length,
          avgBuildDuration: sprint.builds.length > 0 
            ? sprint.builds.reduce((sum, b) => sum + b.duration, 0) / sprint.builds.length / 60
            : 0,
          deploymentFrequency: histDora.deploymentFrequency,
          medianLeadTime: histDora.avgLeadTime,
          changeFailureRate: histDora.changeFailureRate,
          medianMTTR: histDora.mttr,
          buildSummaryByPipeline,
        };
      });

      // Store historical stats in state for LLM chat
      setHistoricalStats(historicalStats.length > 0 ? historicalStats : null);

      // Prepare sprint data without builds for LLM
      const currentSprintForLLM = { ...currentSprintWithFlags, builds: [] };
      const historicalSprintsForLLM = historicalSprints.map(sprint => ({ ...sprint, builds: [] }));

      // Get LLM analysis
      const analysis = await llmApi.analyzeSprint(currentSprintForLLM, historicalSprintsForLLM, stats, historicalStats);
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

  const handleSubCategoryToggle = (subCategory: string) => {
    setSelectedSubCategories(prev => 
      prev.includes(subCategory)
        ? prev.filter(c => c !== subCategory)
        : [...prev, subCategory]
    );
  };

  const handleClearFilters = () => {
    setSelectedSubCategories([]);
    setSelectedFlags([]);
  };

  const handleFlagToggle = (flagKey: string) => {
    setSelectedFlags(prev => 
      prev.includes(flagKey)
        ? prev.filter(f => f !== flagKey)
        : [...prev, flagKey]
    );
  };

  // Reset filters when sprint data changes
  useEffect(() => {
    setSelectedSubCategories([]);
    setSelectedFlags([]);
  }, [sprintData]);

  return (
    <Box>
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
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Paper sx={{ width: '100%' }}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={tabValue} onChange={handleTabChange}>
                  <Tab label="Sprint" icon={<InfoIcon />} />
                  {sprintData.builds.length > 0 && (
                    <Tab label="Releases" icon={<RocketLaunchIcon />} />
                  )}
                  <Tab label="Analysis" icon={<ChatIcon />} />
                  <Tab 
                    label="Trends" 
                    icon={<AnalyticsIcon />} 
                    disabled={!historicalData || historicalData.historicalSprints.length === 0}
                  />
                </Tabs>
              </Box>

              {error && (
                <Alert severity="error" sx={{ m: 2 }} onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}

              <TabPanel value={tabValue} index={0}>
                {sprintData.sprint.state === 'active' && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    This sprint is currently active. Data may change as the sprint progresses. 
                    The data is cached daily and may not reflect real-time updates.
                  </Alert>
                )}
                <Card sx={{ mb: 2 }}>
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
                        <strong>Start Date:</strong> {formatDate(sprintData.sprint.start)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        <strong>End Date:</strong> {formatDate(sprintData.sprint.end)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        <strong>Duration:</strong> {formatDateRange(sprintData.sprint.start, sprintData.sprint.end)}
                      </Typography>
                      {sprintData.sprint.goal && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          <strong>Goal:</strong> {sprintData.sprint.goal}
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="h6">
                        Issues {(selectedSubCategories.length > 0 || selectedFlags.length > 0) && `(${filteredIssues.length} of ${sprintData.issues.length})`}
                      </Typography>
                      {(selectedSubCategories.length > 0 || selectedFlags.length > 0) && (
                        <Button size="small" onClick={handleClearFilters}>
                          Clear Filters
                        </Button>
                      )}
                    </Box>
                    
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      {/* Flag Filters */}
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Filter by Flags:
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {FLAG_FILTERS.map((flag) => (
                            <Chip
                              key={flag.key}
                              label={flag.label}
                              onClick={() => handleFlagToggle(flag.key)}
                              color={selectedFlags.includes(flag.key) ? 'secondary' : 'default'}
                              variant={selectedFlags.includes(flag.key) ? 'filled' : 'outlined'}
                              sx={{ mb: 1 }}
                            />
                          ))}
                        </Stack>
                      </Grid>

                      {/* Sub-Category Filters */}
                      {subCategories.length > 0 && (
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Filter by Sub-Category:
                          </Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            {subCategories.map(category => (
                              <Chip
                                key={category}
                                label={category}
                                onClick={() => handleSubCategoryToggle(category)}
                                color={selectedSubCategories.includes(category) ? 'primary' : 'default'}
                                variant={selectedSubCategories.includes(category) ? 'filled' : 'outlined'}
                                sx={{ mb: 1 }}
                              />
                            ))}
                          </Stack>
                        </Grid>
                      )}
                    </Grid>
                    
                    {filteredSprintData && <SprintIssuesTable sprintData={filteredSprintData} />}
                  </CardContent>
                </Card>
              </TabPanel>

              {sprintData.builds.length > 0 && (
                <TabPanel value={tabValue} index={1}>
                  <SprintReleases sprintData={sprintData} />
                </TabPanel>
              )}

              <TabPanel value={tabValue} index={sprintData.builds.length > 0 ? 2 : 1}>
                <SprintAnalysis 
                  sprintData={sprintData} 
                  llmAnalysis={llmAnalysis}
                  loading={loading}
                />
              </TabPanel>

              <TabPanel value={tabValue} index={sprintData.builds.length > 0 ? 3 : 2}>
                {historicalData && historicalData.historicalSprints.length > 0 ? (
                  <SprintTrends 
                    currentSprint={sprintData}
                    historicalSprints={historicalData.historicalSprints}
                  />
                ) : (
                  <Box sx={{ textAlign: 'center', py: 8 }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No Historical Data Available
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Increase the "Historical Sprints" count and search again to view trend analysis.
                    </Typography>
                  </Box>
                )}
              </TabPanel>
            </Paper>
          </Box>

          {/* Chat Panel with Collapse/Expand */}
          <Box 
            sx={{ 
              width: isChatCollapsed ? 0 : 420, 
              maxWidth: 420, 
              flexShrink: 0,
              opacity: isChatCollapsed ? 0 : 1,
              visibility: isChatCollapsed ? 'hidden' : 'visible',
              transition: 'width 0.3s ease-in-out, opacity 0.2s ease-in-out',
              overflow: isChatCollapsed ? 'hidden' : 'visible'
            }} 
            ref={chatPanelRef}
          >
            <Paper 
              sx={{ 
                position: 'sticky',
                top: 16,
                height: chatPanelHeight > 0 ? `${chatPanelHeight}px` : 'calc(100vh - 232px)',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: 'height 0.15s ease-out'
              }}
            >
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  p: 2,
                  pb: 1,
                  borderBottom: 1,
                  borderColor: 'divider'
                }}>
                  <Typography variant="h6">AI Assistant</Typography>
                  <Tooltip title={isChatCollapsed ? "Show chat" : "Hide chat"}>
                    <IconButton 
                      size="small" 
                      onClick={() => setIsChatCollapsed(!isChatCollapsed)}
                    >
                      {isChatCollapsed ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <Box sx={{ flex: 1, overflow: 'hidden', p: 2, pt: 1 }}>
                  <LLMChat 
                    sprintData={sprintData} 
                    historicalData={historicalData?.historicalSprints}
                    historicalStats={historicalStats || undefined}
                  />
                </Box>
              </Paper>
            </Box>

          {/* Floating Expand Button when Chat is Collapsed */}
          {isChatCollapsed && (
            <Box sx={{ position: 'fixed', right: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 1000 }}>
              <Tooltip title="Show AI Assistant" placement="left">
                <IconButton 
                  color="primary"
                  onClick={() => setIsChatCollapsed(false)}
                  sx={{
                    bgcolor: 'primary.main',
                    color: 'white',
                    boxShadow: 3,
                    '&:hover': {
                      bgcolor: 'primary.dark',
                      boxShadow: 6,
                    }
                  }}
                >
                  <ChevronLeftIcon />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>
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
