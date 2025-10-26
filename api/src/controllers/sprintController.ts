import { Request, Response } from 'express';
import { TeamConfig, SprintData } from '../types';
import { getTeamConfigs } from '../utils/s3';
import { getCachedSprintData, cacheSprintData } from '../utils/s3';
import { JiraService } from '../services/jiraService';
import { BuildkiteService } from '../services/buildkiteService';
import { decrypt } from '../utils/encryption';

export class SprintController {
  async getSprintData(req: Request, res: Response): Promise<void> {
    try {
      const { team, sprintIdentifier } = req.query;
      
      if (!team || !sprintIdentifier) {
        res.status(400).json({ error: 'Team and sprintIdentifier are required' });
        return;
      }
      
      // Get team configuration
      const teams = await getTeamConfigs();
      const teamConfig = teams.find(t => t.team === team);
      
      if (!teamConfig) {
        res.status(404).json({ error: 'Team not found' });
        return;
      }
      
      // Decrypt tokens for API calls
      const decryptedTeamConfig: TeamConfig = {
        ...teamConfig,
        JIRA_TOKEN: decrypt(teamConfig.JIRA_TOKEN),
        BUILDKITE_TOKEN: decrypt(teamConfig.BUILDKITE_TOKEN)
      };
      
      // Check cache first
      const cachedData = await getCachedSprintData(decryptedTeamConfig, sprintIdentifier as string);
      if (cachedData) {
        res.json(cachedData);
        return;
      }
      
      // Fetch fresh data
      const jiraService = new JiraService(decryptedTeamConfig);
      const buildkiteService = new BuildkiteService(decryptedTeamConfig);
      
      const sprintData = await jiraService.getSprintData(sprintIdentifier as string | number);
      
      // Add build data if available
      if (decryptedTeamConfig.BUILDKITE_TOKEN) {
        const builds = await buildkiteService.getBuilds(sprintData.sprint.start, sprintData.sprint.end);
        sprintData.builds = builds;
      }
      
      // Cache the data
      await cacheSprintData(decryptedTeamConfig, sprintIdentifier as string, sprintData);
      
      res.json(sprintData);
    } catch (error) {
      console.error('Error getting sprint data:', error);
      res.status(500).json({ error: 'Failed to get sprint data' });
    }
  }

  async getHistoricalSprintData(req: Request, res: Response): Promise<void> {
    try {
      const { team, sprintIdentifier, historyCount } = req.query;
      
      if (!team || !sprintIdentifier) {
        res.status(400).json({ error: 'Team and sprintIdentifier are required' });
        return;
      }
      
      const count = parseInt(historyCount as string) || 0;
      
      // Get team configuration
      const teams = await getTeamConfigs();
      const teamConfig = teams.find(t => t.team === team);
      
      if (!teamConfig) {
        res.status(404).json({ error: 'Team not found' });
        return;
      }
      
      // Decrypt tokens for API calls
      const decryptedTeamConfig: TeamConfig = {
        ...teamConfig,
        JIRA_TOKEN: decrypt(teamConfig.JIRA_TOKEN),
        BUILDKITE_TOKEN: decrypt(teamConfig.BUILDKITE_TOKEN)
      };
      
      const jiraService = new JiraService(decryptedTeamConfig);
      
      // Get current sprint data
      const currentSprint = await jiraService.getSprintData(sprintIdentifier as string | number);
      
      // Get historical sprint data
      const historicalSprints: SprintData[] = [];
      for (let i = 1; i <= count; i++) {
        try {
          const historicalSprint = await jiraService.getSprintData(
            typeof sprintIdentifier === 'number' 
              ? (sprintIdentifier as number) - i 
              : `HISTORICAL_${i}`
          );
          historicalSprints.push(historicalSprint);
        } catch (error) {
          console.warn(`Failed to get historical sprint ${i}:`, error);
        }
      }
      
      res.json({
        currentSprint,
        historicalSprints
      });
    } catch (error) {
      console.error('Error getting historical sprint data:', error);
      res.status(500).json({ error: 'Failed to get historical sprint data' });
    }
  }
}
