import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { TeamConfig } from '../types';
import { teamApi } from '../services/api';
import TeamForm from '../components/TeamForm';

const TeamsPage: React.FC = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<TeamConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamConfig | null>(null);

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      setLoading(true);
      const teamsData = await teamApi.getTeams();
      setTeams(teamsData);
    } catch (err) {
      setError('Failed to load teams');
      console.error('Error loading teams:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = () => {
    setEditingTeam(null);
    setDialogOpen(true);
  };

  const handleEditTeam = (team: TeamConfig) => {
    setEditingTeam(team);
    setDialogOpen(true);
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (window.confirm('Are you sure you want to delete this team?')) {
      try {
        await teamApi.deleteTeam(teamId);
        await loadTeams();
      } catch (err) {
        setError('Failed to delete team');
        console.error('Error deleting team:', err);
      }
    }
  };

  const handleSaveTeam = async (teamData: Omit<TeamConfig, 'JIRA_TOKEN' | 'BUILDKITE_TOKEN'> & {
    JIRA_TOKEN: string;
    BUILDKITE_TOKEN: string;
  }) => {
    try {
      if (editingTeam) {
        await teamApi.updateTeam(editingTeam.team, teamData);
      } else {
        await teamApi.createTeam(teamData);
      }
      setDialogOpen(false);
      await loadTeams();
    } catch (err) {
      setError('Failed to save team');
      console.error('Error saving team:', err);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/sprints')}
          >
            Back
          </Button>
          <Typography variant="h4" component="h1">
            Team Management
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateTeam}
        >
          Add Team
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {teams.map((team) => (
          <Grid item xs={12} sm={6} md={4} key={team.team}>
            <Card>
              <CardContent>
                <Typography variant="h6" component="h2" gutterBottom>
                  {team.team}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  JIRA Project: {team.JIRA_PROJECT}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Board ID: {team.JIRA_BOARD_ID}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Pipelines: {team.BUILDKITE_PIPELINES.split(',').length} configured
                </Typography>
              </CardContent>
              <CardActions>
                <IconButton
                  color="primary"
                  onClick={() => handleEditTeam(team)}
                >
                  <EditIcon />
                </IconButton>
                <IconButton
                  color="error"
                  onClick={() => handleDeleteTeam(team.team)}
                >
                  <DeleteIcon />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {teams.length === 0 && (
        <Box textAlign="center" py={4}>
          <Typography variant="h6" color="text.secondary">
            No teams configured yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Click "Add Team" to get started
          </Typography>
        </Box>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingTeam ? 'Edit Team' : 'Add New Team'}
        </DialogTitle>
        <DialogContent>
          <TeamForm
            team={editingTeam}
            onSave={handleSaveTeam}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default TeamsPage;
