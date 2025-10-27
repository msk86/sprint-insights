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
function generateSprintCacheKey(teamConfig: TeamConfig, sprintIndex: number): string {
  const teamSlug = teamConfig.team.toLowerCase().replace(/\W/g, '-');
  return `sprint-data/${teamSlug}_${teamConfig.JIRA_PROJECT}_${teamConfig.JIRA_BOARD_ID}_index-${sprintIndex}.json`;
}

/**
 * Get cached sprint data using stable sprint index
 * @param teamConfig - Team configuration
 * @param sprintIndex - Resolved sprint index (not fuzzy identifier)
 */
export async function getCachedSprintData(teamConfig: TeamConfig, sprintIndex: number): Promise<SprintData | null> {
  try {
    const key = generateSprintCacheKey(teamConfig, sprintIndex);
    
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
    const key = generateSprintCacheKey(teamConfig, sprintIndex);
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: JSON.stringify(data),
      ContentType: 'application/json'
    });
    
    await getS3Client().send(command);
    console.log(`Cached sprint data: ${key}`);
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
