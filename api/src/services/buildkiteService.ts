import { TeamConfig, Build, Deployment } from '../types';

export class BuildkiteService {
  private baseUrl = 'https://api.buildkite.com/v2';
  private orgSlug: string;
  private deploymentRegex = /deploy|release/;
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
    
    type PipelineCfg = { name: string; rawName: string; regex?: RegExp | null };
    const parsePipelineToken = (token: string): PipelineCfg => {
      const raw = token.trim();
      // pattern: name:regex  (assume later part is the regex)
      const parts = raw.split(':');
      if (parts.length < 2) {
        return { name: raw, rawName: raw, regex: null };
      }
      const namePart = parts[0];
      const regexPart = parts[1];
      let regex: RegExp | null = null;
      try {
        // Support either /regex/flags or bare regex string
        const m = regexPart.match(/^\/(.+)\/([gimsuy]*)$/);
        regex = m ? new RegExp(m[1], m[2]) : new RegExp(regexPart);
      } catch {
        regex = null;
      }
      return { name: namePart, rawName: raw, regex };
    };
    const pipelines = this.teamConfig.BUILDKITE_PIPELINES.split(',').map(p => parsePipelineToken(p));
    const pipelinesWithoutBuilds: string[] = [];
    
    for (const pipelineCfg of pipelines) {
      const pipelineName = pipelineCfg.name; // pure name for API and data
      try {
        const pipelineBuilds = await this.fetchPipelineBuilds(pipelineName, startDate, endDate, pipelineCfg);
        if (pipelineBuilds.length > 0) {
          builds.push(...pipelineBuilds);
        } else {
          pipelinesWithoutBuilds.push(pipelineName);
        }
      } catch (error) {
        console.error(`Error fetching builds for pipeline ${pipelineName}:`, error);
      }
    }
    
    // For pipelines without builds in the sprint, fetch the latest build before sprint start
    for (const pipelineName of pipelinesWithoutBuilds) {
      try {
        const latestBuild = await this.fetchLatestBuildBeforeDate(pipelineName, startDate);
        if (latestBuild) {
          builds.push(latestBuild);
        }
      } catch (error) {
        console.error(`Error fetching latest build before sprint for pipeline ${pipelineName}:`, error);
      }
    }
    
    return builds;
  }

  private async fetchPipelineBuilds(pipelineName: string, startDate: Date, endDate: Date, pipelineCfg: { name: string; regex?: RegExp | null }): Promise<Build[]> {
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
    return buildsData.map((build: any) => this.transformBuild(build, pipelineCfg, true));
  }

  private async fetchLatestBuildBeforeDate(pipelineName: string, beforeDate: Date): Promise<Build | null> {
    console.log(`Fetching latest build before ${beforeDate.toISOString()} for pipeline: ${pipelineName}`);
    
    const url = `${this.baseUrl}/organizations/${this.orgSlug}/pipelines/${pipelineName}/builds`;
    const params = new URLSearchParams({
      created_to: beforeDate.toISOString(),
      per_page: '1',
      page: '1'
    });

    const response = await fetch(`${url}?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.teamConfig.BUILDKITE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn(`HTTP ${response.status}: ${response.statusText} when getting latest build before date for ${pipelineName}`);
      return null;
    }

    const buildsData = await response.json() as any[];
    if (buildsData.length === 0) {
      console.log(`No builds found before ${beforeDate.toISOString()} for pipeline: ${pipelineName}`);
      return null;
    }

    // No regex application for latest-before date; still transform with no sprint
    return this.transformBuild(buildsData[0], { name: pipelineName, regex: null }, false);
  }

  private transformBuild(buildData: any, pipelineCfg: { name: string; regex?: RegExp | null }, inSprint: boolean): Build {
    const deployments = this.extractProductionDeployments(buildData, pipelineCfg);
    
    return {
      pipelineName: pipelineCfg.name, // ensure pure name is stored
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
      isReleaseSuccess: deployments.length > 0 && deployments.every(deployment => deployment.status === 'success'),
      inSprint
    };
  }

  private extractProductionDeployments(buildData: any, pipelineCfg: { regex?: RegExp | null }): Deployment[] {
    // Resolve regex from pipeline config (applies to job.name only)
    const releaseRegex: RegExp | null = pipelineCfg.regex || null;

    // 1) Extract deployments from jobs using legacy prod/deploy heuristics,
    // or include jobs whose names match provided regex
    const jobs: any[] = buildData.jobs || [];
    const jobDeployments: Deployment[] = jobs
      .filter((job: any, idx: number) => {
        const defaultMatch =
          job.type === 'script' &&
          this.deploymentRegex.test(job.name?.toLowerCase()) &&
          this.prodRegex.test(job.name?.toLowerCase());
        if (!releaseRegex) return defaultMatch;
        return releaseRegex.test(job.name || '');
      })
      .map((job: any) => ({
        deployedAt: job.finished_at || job.started_at,
        name: job.name,
        status: job.state === 'passed' ? 'success' : job.state === 'failed' ? 'failed' : 'pending'
      }))
      .filter((deployment: Deployment) => deployment.status !== 'pending');

    return jobDeployments;
  }

  private calculateDuration(startedAt: string, finishedAt: string): number {
    if (!startedAt || !finishedAt) return 0;
    return Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000);
  }
}
