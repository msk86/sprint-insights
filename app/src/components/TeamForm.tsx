import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Grid,
} from '@mui/material';
import { TeamConfig } from '../types';

interface TeamFormProps {
  team?: TeamConfig | null;
  onSave: (teamData: Omit<TeamConfig, 'JIRA_TOKEN' | 'BUILDKITE_TOKEN'> & {
    JIRA_TOKEN: string;
    BUILDKITE_TOKEN: string;
  }) => void;
  onCancel: () => void;
}

const TeamForm: React.FC<TeamFormProps> = ({ team, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    team: '',
    JIRA_EMAIL: '',
    JIRA_TOKEN: '',
    JIRA_PROJECT: '',
    JIRA_BOARD_ID: '',
    BUILDKITE_TOKEN: '',
    BUILDKITE_PIPELINES: '',
  });

  useEffect(() => {
    if (team) {
      setFormData({
        team: team.team,
        JIRA_EMAIL: team.JIRA_EMAIL,
        JIRA_TOKEN: team.JIRA_TOKEN, // Keep the encrypted placeholder
        JIRA_PROJECT: team.JIRA_PROJECT,
        JIRA_BOARD_ID: team.JIRA_BOARD_ID,
        BUILDKITE_TOKEN: team.BUILDKITE_TOKEN, // Keep the encrypted placeholder
        BUILDKITE_PIPELINES: team.BUILDKITE_PIPELINES,
      });
    }
  }, [team]);

  const handleChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    
    // Prepare data for submission
    const submitData = {
      ...formData,
      // If token fields are empty (user cleared them), send empty string
      // If they contain '***encrypted***', keep that value for backend to handle
      JIRA_TOKEN: formData.JIRA_TOKEN === '' ? '' : formData.JIRA_TOKEN,
      BUILDKITE_TOKEN: formData.BUILDKITE_TOKEN === '' ? '' : formData.BUILDKITE_TOKEN,
    };
    
    onSave(submitData);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Team Name"
            value={formData.team}
            onChange={handleChange('team')}
            required
            disabled={!!team}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="JIRA Email"
            type="email"
            value={formData.JIRA_EMAIL}
            onChange={handleChange('JIRA_EMAIL')}
            required
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="JIRA API Token"
            type="password"
            value={formData.JIRA_TOKEN}
            onChange={handleChange('JIRA_TOKEN')}
            required={!team}
            placeholder={team ? '***encrypted***' : 'Enter JIRA API token'}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="JIRA Project Key"
            value={formData.JIRA_PROJECT}
            onChange={handleChange('JIRA_PROJECT')}
            required
            placeholder="e.g., PROJ"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="JIRA Board ID"
            type="number"
            value={formData.JIRA_BOARD_ID}
            onChange={handleChange('JIRA_BOARD_ID')}
            required
            placeholder="e.g., 123"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Buildkite API Token"
            type="password"
            value={formData.BUILDKITE_TOKEN}
            onChange={handleChange('BUILDKITE_TOKEN')}
            placeholder={team ? '***encrypted***' : 'Enter Buildkite API token'}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Buildkite Pipeline Names"
            value={formData.BUILDKITE_PIPELINES}
            onChange={handleChange('BUILDKITE_PIPELINES')}
            placeholder="pipeline1,pipeline2,pipeline3"
          />
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="contained">
          {team ? 'Update Team' : 'Create Team'}
        </Button>
      </Box>
    </Box>
  );
};

export default TeamForm;
