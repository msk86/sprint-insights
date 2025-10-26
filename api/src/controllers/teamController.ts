import { Request, Response } from 'express';
import { TeamConfig } from '../types';
import { getTeamConfigs, saveTeamConfigs } from '../utils/s3';
import { encrypt, decrypt } from '../utils/encryption';

export class TeamController {
  async getTeams(req: Request, res: Response): Promise<void> {
    try {
      const teams = await getTeamConfigs();
      
      // Decrypt sensitive fields for display
      const decryptedTeams = teams.map(team => ({
        ...team,
        JIRA_TOKEN: '***encrypted***',
        BUILDKITE_TOKEN: '***encrypted***'
      }));
      
      res.json(decryptedTeams);
    } catch (error) {
      console.error('Error getting teams:', error);
      res.status(500).json({ error: 'Failed to get teams' });
    }
  }

  async createTeam(req: Request, res: Response): Promise<void> {
    try {
      const teamData: TeamConfig = req.body;
      
      // Encrypt sensitive fields
      const encryptedTeam: TeamConfig = {
        ...teamData,
        JIRA_TOKEN: encrypt(teamData.JIRA_TOKEN),
        BUILDKITE_TOKEN: encrypt(teamData.BUILDKITE_TOKEN)
      };
      
      const existingTeams = await getTeamConfigs();
      const updatedTeams = [...existingTeams, encryptedTeam];
      
      await saveTeamConfigs(updatedTeams);
      
      res.status(201).json({ 
        ...encryptedTeam,
        JIRA_TOKEN: '***encrypted***',
        BUILDKITE_TOKEN: '***encrypted***'
      });
    } catch (error) {
      console.error('Error creating team:', error);
      res.status(500).json({ error: 'Failed to create team' });
    }
  }

  async updateTeam(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;
      const teamData: TeamConfig = req.body;
      
      const existingTeams = await getTeamConfigs();
      const teamIndex = existingTeams.findIndex(t => t.team === teamId);
      
      if (teamIndex === -1) {
        res.status(404).json({ error: 'Team not found' });
        return;
      }
      
      const existingTeam = existingTeams[teamIndex];
      
      // Prepare updated team data
      const updatedTeam: TeamConfig = {
        team: existingTeam.team, // Keep the original team name
        JIRA_EMAIL: teamData.JIRA_EMAIL,
        JIRA_PROJECT: teamData.JIRA_PROJECT,
        JIRA_BOARD_ID: teamData.JIRA_BOARD_ID,
        BUILDKITE_PIPELINES: teamData.BUILDKITE_PIPELINES,
        // Only encrypt tokens if they are not the placeholder value
        JIRA_TOKEN: teamData.JIRA_TOKEN === '***encrypted***' 
          ? existingTeam.JIRA_TOKEN 
          : encrypt(teamData.JIRA_TOKEN),
        BUILDKITE_TOKEN: teamData.BUILDKITE_TOKEN === '***encrypted***' 
          ? existingTeam.BUILDKITE_TOKEN 
          : encrypt(teamData.BUILDKITE_TOKEN)
      };
      
      existingTeams[teamIndex] = updatedTeam;
      await saveTeamConfigs(existingTeams);
      
      res.json({ 
        ...updatedTeam,
        JIRA_TOKEN: '***encrypted***',
        BUILDKITE_TOKEN: '***encrypted***'
      });
    } catch (error) {
      console.error('Error updating team:', error);
      res.status(500).json({ error: 'Failed to update team' });
    }
  }

  async deleteTeam(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;
      
      const existingTeams = await getTeamConfigs();
      const filteredTeams = existingTeams.filter(t => t.team !== teamId);
      
      if (filteredTeams.length === existingTeams.length) {
        res.status(404).json({ error: 'Team not found' });
        return;
      }
      
      await saveTeamConfigs(filteredTeams);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting team:', error);
      res.status(500).json({ error: 'Failed to delete team' });
    }
  }
}
