import { Build } from '../types';

export interface BuildSummaryByPipeline {
  pipelineName: string;
  repository: string;
  totalBuilds: number;
  successfulBuilds: number;
  avgBuildDuration: number;
  totalReleases: number;
  successfulReleases: number;
}

/**
 * Calculate build/release summary grouped by pipeline and repository
 */
export function calculateBuildSummaryByPipeline(builds: Build[]): BuildSummaryByPipeline[] | undefined {
  if (builds.length === 0) {
    return undefined;
  }

  const summaryMap = builds.reduce((acc, build) => {
    const key = `${build.pipelineName}|${build.repository}`;
    if (!acc[key]) {
      acc[key] = {
        pipelineName: build.pipelineName,
        repository: build.repository,
        totalBuilds: 0,
        successfulBuilds: 0,
        totalDuration: 0,
        totalReleases: 0,
        successfulReleases: 0,
      };
    }
    acc[key].totalBuilds++;
    if (build.status === 'passed') acc[key].successfulBuilds++;
    acc[key].totalDuration += build.duration;
    if (build.isRelease) {
      acc[key].totalReleases++;
      if (build.status === 'passed') acc[key].successfulReleases++;
    }
    return acc;
  }, {} as Record<string, {
    pipelineName: string;
    repository: string;
    totalBuilds: number;
    successfulBuilds: number;
    totalDuration: number;
    totalReleases: number;
    successfulReleases: number;
  }>);

  return Object.values(summaryMap).map(summary => ({
    pipelineName: summary.pipelineName,
    repository: summary.repository,
    totalBuilds: summary.totalBuilds,
    successfulBuilds: summary.successfulBuilds,
    avgBuildDuration: summary.totalBuilds > 0 ? summary.totalDuration / summary.totalBuilds / 60 : 0,
    totalReleases: summary.totalReleases,
    successfulReleases: summary.successfulReleases,
  }));
}

