import { TeamConfig, Build, Deployment } from '../types';

export class BuildkiteService {
  private baseUrl = 'https://api.buildkite.com/v2';
  private orgSlug: string;
  private deploymentRegex = /deploy/;
  private prodRegex = /prod|production/;

  constructor(private teamConfig: TeamConfig) {
    this.orgSlug = process.env.BUILDKITE_ORG_SLUG || 'o';
    this.teamConfig = teamConfig;
  }

  async getBuilds(startDate: Date, endDate: Date): Promise<Build[]> {
    console.log(`Fetching builds for pipelines: ${this.teamConfig.BUILDKITE_PIPELINES} from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    const builds: Build[] = [];
    if (!this.teamConfig.BUILDKITE_TOKEN) {
      return builds;
    }
    
    const pipelines = this.teamConfig.BUILDKITE_PIPELINES.split(',').map(p => p.trim());
    
    for (const pipelineName of pipelines) {
      try {
        const pipelineBuilds = await this.fetchPipelineBuilds(pipelineName, startDate, endDate);
        builds.push(...pipelineBuilds);
      } catch (error) {
        console.error(`Error fetching builds for pipeline ${pipelineName}:`, error);
      }
    }
    
    return builds;
  }

  private async fetchPipelineBuilds(pipelineName: string, startDate: Date, endDate: Date): Promise<Build[]> {
    const url = `${this.baseUrl}/organizations/${this.orgSlug}/pipelines/${pipelineName}/builds`;
    const params = new URLSearchParams({
      created_from: startDate.toISOString(),
      created_to: endDate.toISOString(),
      per_page: '200'
    });

    const response = await fetch(`${url}?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.teamConfig.BUILDKITE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn(`HTTP ${response.status}: ${response.statusText} when getting builds for ${pipelineName}`);
      return [];
    }

    const buildsData = await response.json() as any[];
    return buildsData.map((build: any) => this.transformBuild(build, pipelineName));
  }

  private transformBuild(buildData: any, pipelineName: string): Build {
    const deployments = this.extractProductionDeployments(buildData.jobs || []);
    
    return {
      pipelineName,
      buildNumber: buildData.number,
      status: buildData.state,
      startedAt: buildData.started_at,
      finishedAt: buildData.finished_at,
      duration: this.calculateDuration(buildData.started_at, buildData.finished_at),
      branch: buildData.branch,
      commit: buildData.commit,
      repository: buildData.pipeline?.repository || '',
      deployments,
      isRelease: deployments.length > 0,
      isReleaseSuccess: deployments.length > 0 && deployments.every(deployment => deployment.status === 'success')
    };
  }

  private extractProductionDeployments(jobs: any[]): Deployment[] {
    return jobs
      .filter(job => 
        job.type === 'script' && 
        this.deploymentRegex.test(job.name?.toLowerCase()) && 
        this.prodRegex.test(job.name?.toLowerCase())
      )
      .map(job => ({
        deployedAt: job.finished_at || job.started_at,
        name: job.name,
        status: job.state === 'passed' ? 'success' : job.state === 'failed' ? 'failed' : 'pending'
      }))
      .filter(deployment => deployment.status !== 'pending');
  }

  private calculateDuration(startedAt: string, finishedAt: string): number {
    if (!startedAt || !finishedAt) return 0;
    return Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000);
  }
}
