import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { TeamConfig, SprintData } from '../types';

// Initialize S3 client lazily to ensure environment variables are loaded
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      ...(process.env.LOCALSTACK_ENDPOINT && {
        endpoint: process.env.LOCALSTACK_ENDPOINT,
        forcePathStyle: true,
        credentials: {
          accessKeyId: 'test',
          secretAccessKey: 'test'
        }
      })
    });
  }
  return s3Client;
}

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'sprint-insights-data';

/**
 * Generate a stable cache key for sprint data
 * Uses sprint index as the stable identifier
 */
function generateSprintCacheKey(teamConfig: TeamConfig, sprintIndex: number, isActive: boolean = false): string {
  const teamSlug = teamConfig.team.toLowerCase().replace(/\W/g, '-');
  
  // For active sprints, include today's date in the cache key for daily caching
  if (isActive) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    return `sprint-data/${teamSlug}_${teamConfig.JIRA_PROJECT}_${teamConfig.JIRA_BOARD_ID}_index-${sprintIndex}_date-${today}.json`;
  }
  
  // For closed sprints, use permanent cache key
  return `sprint-data/${teamSlug}_${teamConfig.JIRA_PROJECT}_${teamConfig.JIRA_BOARD_ID}_index-${sprintIndex}.json`;
}

/**
 * Get cached sprint data using stable sprint index
 * @param teamConfig - Team configuration
 * @param sprintIndex - Resolved sprint index (not fuzzy identifier)
 * @param isActive - Whether the sprint is active (for daily caching)
 */
export async function getCachedSprintData(teamConfig: TeamConfig, sprintIndex: number, isActive: boolean = false): Promise<SprintData | null> {
  try {
    const key = generateSprintCacheKey(teamConfig, sprintIndex, isActive);
    
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });
    
    const response = await getS3Client().send(command);
    const data = await response.Body?.transformToString();
    
    if (data) {
      console.log(`Cache hit: ${key}`);
      return JSON.parse(data);
    }
    
    return null;
  } catch (error) {
    // Expected when cache doesn't exist
    return null;
  }
}

/**
 * Cache sprint data using stable sprint index
 * @param teamConfig - Team configuration
 * @param sprintIndex - Resolved sprint index (not fuzzy identifier)
 * @param data - Sprint data to cache
 */
export async function cacheSprintData(teamConfig: TeamConfig, sprintIndex: number, data: SprintData): Promise<void> {
  try {
    // Determine if sprint is active based on the data
    const isActive = data.sprint.state === 'active';
    const key = generateSprintCacheKey(teamConfig, sprintIndex, isActive);
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: JSON.stringify(data),
      ContentType: 'application/json'
    });
    
    await getS3Client().send(command);
    console.log(`Cached sprint data: ${key}${isActive ? ' (daily cache for active sprint)' : ''}`);
  } catch (error) {
    console.error('Failed to cache sprint data:', error);
  }
}

export async function getTeamConfigs(): Promise<TeamConfig[]> {
  try {
    const key = 'team-configs.json';
    
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });
    
    const response = await getS3Client().send(command);
    const data = await response.Body?.transformToString();
    
    if (data) {
      return JSON.parse(data);
    }
    
    return [];
  } catch (error) {
    console.log('No team configs found:', error);
    return [];
  }
}

export async function saveTeamConfigs(configs: TeamConfig[]): Promise<void> {
  try {
    const key = 'team-configs.json';
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: JSON.stringify(configs),
      ContentType: 'application/json'
    });
    
    await getS3Client().send(command);
    console.log('Saved team configs');
  } catch (error) {
    console.error('Failed to save team configs:', error);
  }
}
