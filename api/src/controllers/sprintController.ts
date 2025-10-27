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
      const { team, sprintIdentifier, identifierType } = req.query;
      
      if (!team || !sprintIdentifier || !identifierType) {
        res.status(400).json({ error: 'Team, sprintIdentifier, and identifierType are required' });
        return;
      }
      
      // Validate identifierType
      if (identifierType !== 'index' && identifierType !== 'name') {
        res.status(400).json({ error: 'identifierType must be either "index" or "name"' });
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
      
      // Resolve sprint identifier to stable sprint index
      const jiraService = new JiraService(decryptedTeamConfig);
      const type = identifierType as 'index' | 'name';
      const sprintIndex = await jiraService.resolveSprintIdentifier(sprintIdentifier as string | number, type);
      
      console.log(`Resolved sprint identifier "${sprintIdentifier}" (type: ${type}) to index ${sprintIndex}`);
      
      // Get sprint metadata to determine if it's active (for cache key generation)
      const sprintMetadata = await jiraService.getSprintMetadata(sprintIndex);
      const isActive = sprintMetadata.state === 'active';
      
      // Check cache using stable sprint index and active state
      const cachedData = await getCachedSprintData(decryptedTeamConfig, sprintIndex, isActive);
      if (cachedData) {
        console.log(`Cache hit for sprint index ${sprintIndex}${isActive ? ' (active sprint - daily cache)' : ''}`);
        res.json(cachedData);
        return;
      }
      
      console.log(`Cache miss for sprint index ${sprintIndex}, fetching fresh data`);
      
      // Fetch fresh data using resolved sprint index
      const buildkiteService = new BuildkiteService(decryptedTeamConfig);
      const sprintData = await jiraService.getSprintData(sprintIndex);
      
      // Add build data if available
      if (decryptedTeamConfig.BUILDKITE_TOKEN) {
        const builds = await buildkiteService.getBuilds(sprintData.sprint.start, sprintData.sprint.end);
        sprintData.builds = builds;
      }
      
      // Cache the data using stable sprint index
      await cacheSprintData(decryptedTeamConfig, sprintIndex, sprintData);
      
      res.json(sprintData);
    } catch (error) {
      console.error('Error getting sprint data:', error);
      res.status(500).json({ error: 'Failed to get sprint data' });
    }
  }

}
