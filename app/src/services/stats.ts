import { SprintData } from '../types';
import { calculateBusinessDays } from '../utils/timeCalculation';

// Color constants for pie charts
export const CATEGORY_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B9D'];
export const COMPLETION_COLORS = {
  'Completed': '#4CAF50',
  'Closed': '#9E9E9E',
  'Spillover': '#FF9800'
};
export const PLAN_COLORS = {
  'Planned': '#2196F3',
  'Unplanned': '#FF5722'
};

export interface SprintStats {
  throughput: number;
  velocity: number;
  avgCycleTime: number;
  avgStoryPoints: number;
  categories: Record<string, number>;
  categoryData: Array<{ name: string; value: number }>;
  completionData: Array<{ name: string; value: number }>;
  planData: Array<{ name: string; value: number }>;
}

export interface ReleaseStats {
  totalBuilds: number;
  successfulBuilds: number;
  buildSuccessRate: number;
  totalReleases: number;
  successfulReleases: number;
  releaseSuccessRate: number;
  avgBuildDuration: number;
}

export interface DoraMetrics {
  deploymentFrequency: number;
  avgLeadTime: number;
  changeFailureRate: number;
  mttr: number;
}

/**
 * Calculate sprint statistics including throughput, velocity, cycle time, and distributions
 */
export function calculateSprintStats(sprintData: SprintData): SprintStats {
  const completedIssues = sprintData.issues.filter(issue => issue.flags?.isCompleted || issue.flags?.isClosed);
  
  const throughput = completedIssues.length;
  const velocity = completedIssues.reduce((sum, issue) => sum + issue.storyPoints, 0);
  
  // Calculate average cycle time for completed issues using workStartedAt and completedAt
  let totalCycleTime = 0;
  let cycleTimeCount = 0;
  completedIssues.forEach(issue => {
    if (issue.workStartedAt && issue.completedAt) {
      const startTime = new Date(issue.workStartedAt);
      const endTime = new Date(issue.completedAt);
      const cycleTime = calculateBusinessDays(startTime, endTime);
      totalCycleTime += cycleTime;
      cycleTimeCount++;
    } else {
      const inSprintHistory = issue.history.filter(h => h.inSprint);
      if (inSprintHistory.length >= 2) {
        const firstEvent = new Date(inSprintHistory[0].at);
        const lastEvent = new Date(inSprintHistory[inSprintHistory.length - 1].at);
        const cycleTime = calculateBusinessDays(firstEvent, lastEvent);
        totalCycleTime += cycleTime;
        cycleTimeCount++;
      }
    }
  });
  const avgCycleTime = cycleTimeCount > 0 ? totalCycleTime / cycleTimeCount : 0;
  
  const totalIssues = sprintData.issues.length;
  const totalStoryPoints = sprintData.issues.reduce((sum, issue) => sum + issue.storyPoints, 0);
  const avgStoryPoints = totalIssues > 0 ? totalStoryPoints / totalIssues : 0;
  
  const categories = sprintData.issues.reduce((acc, issue) => {
    const category = issue.subCategory || 'Uncategorized';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const categoryData = Object.entries(categories).map(([name, value]) => ({ name, value }));

  // Completion distribution
  const completionCounts = {
    'Completed': 0,
    'Closed': 0,
    'Spillover': 0
  };
  
  sprintData.issues.forEach(issue => {
    if (issue.flags?.isCompleted) {
      completionCounts['Completed']++;
    } else if (issue.flags?.isClosed) {
      completionCounts['Closed']++;
    } else if (issue.flags?.isSpillover) {
      completionCounts['Spillover']++;
    }
  });
  
  const completionData = Object.entries(completionCounts)
    .filter(([_, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));

  // Plan distribution
  const plannedCount = sprintData.issues.filter(issue => !issue.flags?.isUnplanned).length;
  const unplannedCount = sprintData.issues.filter(issue => issue.flags?.isUnplanned).length;
  
  const planData = [
    { name: 'Planned', value: plannedCount },
    { name: 'Unplanned', value: unplannedCount }
  ].filter(item => item.value > 0);

  return {
    throughput,
    velocity,
    avgCycleTime,
    avgStoryPoints,
    categories,
    categoryData,
    completionData,
    planData,
  };
}

/**
 * Calculate release statistics including build success rates and durations
 */
export function calculateReleaseStats(sprintData: SprintData): ReleaseStats {
  const totalBuilds = sprintData.builds.length;
  const successfulBuilds = sprintData.builds.filter(b => b.status === 'passed').length;
  const buildSuccessRate = totalBuilds > 0 ? (successfulBuilds / totalBuilds) * 100 : 0;
  
  const totalReleases = sprintData.builds.filter(b => b.isRelease).length;
  const successfulReleases = sprintData.builds.filter(b => b.isRelease && b.status === 'passed').length;
  const releaseSuccessRate = totalReleases > 0 ? (successfulReleases / totalReleases) * 100 : 0;
  
  const totalBuildDuration = sprintData.builds.reduce((sum, b) => sum + b.duration, 0);
  const avgBuildDuration = totalBuilds > 0 ? totalBuildDuration / totalBuilds : 0;
  
  return {
    totalBuilds,
    successfulBuilds,
    buildSuccessRate,
    totalReleases,
    successfulReleases,
    releaseSuccessRate,
    avgBuildDuration,
  };
}

/**
 * Calculate DORA metrics (DevOps Research and Assessment)
 * - Deployment Frequency: How often we deploy to production
 * - Lead Time for Changes: Time from code commit to production (using issue cycle time as proxy)
 * - Change Failure Rate: Percentage of deployments causing incidents
 * - Mean Time to Restore: Time to recover from incidents
 */
export function calculateDoraMetrics(sprintData: SprintData): DoraMetrics {
  const successfulReleases = sprintData.builds.filter(b => b.isRelease && b.status === 'passed');
  
  // Calculate business days in sprint
  const sprintStart = new Date(sprintData.sprint.start);
  const sprintEnd = new Date(sprintData.sprint.end);
  const businessDays = calculateBusinessDays(sprintStart, sprintEnd);
  
  // 1. Deployment Frequency: successful releases per business day
  const deploymentFrequency = businessDays > 0 ? successfulReleases.length / businessDays : 0;
  
  // 2. Lead Time for Changes: MEDIAN cycle time of completed issues (time from work start to completion)
  const completedIssues = sprintData.issues.filter(issue => issue.flags?.isCompleted || issue.flags?.isClosed);
  const leadTimes: number[] = [];
  
  completedIssues.forEach(issue => {
    if (issue.workStartedAt && issue.completedAt) {
      const startTime = new Date(issue.workStartedAt);
      const endTime = new Date(issue.completedAt);
      const leadTime = calculateBusinessDays(startTime, endTime);
      leadTimes.push(leadTime);
    } else {
      const inSprintHistory = issue.history.filter(h => h.inSprint);
      if (inSprintHistory.length >= 2) {
        const firstEvent = new Date(inSprintHistory[0].at);
        const lastEvent = new Date(inSprintHistory[inSprintHistory.length - 1].at);
        const leadTime = calculateBusinessDays(firstEvent, lastEvent);
        leadTimes.push(leadTime);
      }
    }
  });
  
  // Calculate median lead time
  let avgLeadTime = 0;
  if (leadTimes.length > 0) {
    leadTimes.sort((a, b) => a - b);
    const medianIndex = Math.floor(leadTimes.length / 2);
    avgLeadTime = leadTimes[medianIndex];
  }
  
  // 3. Change Failure Rate: incidents per successful release (not percentage of failed releases)
  // An incident is an unplanned issue created during the sprint
  const incidents = sprintData.issues.filter(issue => 
    issue.flags?.isIncidentResponse && issue.flags?.isUnplanned
  ).length;
  
  const changeFailureRate = successfulReleases.length > 0 
    ? (incidents / successfulReleases.length) * 100 
    : 0;
  
  // 4. Mean Time to Restore: MEDIAN time to resolve incidents (from creation to completion)
  const incidentResolveTimes: number[] = [];
  
  sprintData.issues
    .filter(issue => issue.flags?.isIncidentResponse && issue.flags?.isUnplanned)
    .forEach(issue => {
      const createdTime = new Date(issue.created);
      
      if (issue.completedAt) {
        const completedTime = new Date(issue.completedAt);
        const resolveTime = calculateBusinessDays(createdTime, completedTime);
        incidentResolveTimes.push(resolveTime);
      } else {
        // If not completed, use the last event time
        const inSprintHistory = issue.history.filter(h => h.inSprint);
        if (inSprintHistory.length > 0) {
          const lastEvent = new Date(inSprintHistory[inSprintHistory.length - 1].at);
          const resolveTime = calculateBusinessDays(createdTime, lastEvent);
          incidentResolveTimes.push(resolveTime);
        }
      }
    });
  
  // Calculate median MTTR in business days, then convert to seconds for display
  let mttr = 0;
  if (incidentResolveTimes.length > 0) {
    incidentResolveTimes.sort((a, b) => a - b);
    const medianIndex = Math.floor(incidentResolveTimes.length / 2);
    const mttrDays = incidentResolveTimes[medianIndex];
    // Convert business days to approximate seconds (8 hours per business day)
    mttr = mttrDays * 8 * 60 * 60;
  }
  
  return {
    deploymentFrequency,
    avgLeadTime,
    changeFailureRate,
    mttr,
  };
}

/**
 * Get DORA performance level for Deployment Frequency
 * @param frequency - Deployments per business day
 */
export function getDeploymentFrequencyLevel(frequency: number): { label: string; color: 'success' | 'warning' | 'error' | 'default' } {
  if (frequency === 0) return { label: 'N/A', color: 'default' };
  if (frequency > 1) return { label: 'Elite', color: 'success' };
  if (frequency >= 0.14) return { label: 'High', color: 'success' };
  if (frequency >= 0.03) return { label: 'Medium', color: 'warning' };
  return { label: 'Low', color: 'error' };
}

/**
 * Get DORA performance level for Lead Time for Changes
 * @param leadTime - Lead time in business days
 */
export function getLeadTimeLevel(leadTime: number): { label: string; color: 'success' | 'warning' | 'error' | 'default' } {
  if (leadTime === 0) return { label: 'N/A', color: 'default' };
  if (leadTime < 1) return { label: 'Elite', color: 'success' };
  if (leadTime <= 7) return { label: 'High', color: 'success' };
  if (leadTime <= 30) return { label: 'Medium', color: 'warning' };
  return { label: 'Low', color: 'error' };
}

/**
 * Get DORA performance level for Change Failure Rate
 * @param rate - Failure rate percentage
 */
export function getChangeFailureRateLevel(rate: number): { label: string; color: 'success' | 'warning' | 'error' | 'default' } {
  if (rate === 0) return { label: 'Elite', color: 'success' };
  if (rate <= 15) return { label: 'High', color: 'success' };
  if (rate <= 30) return { label: 'Medium', color: 'warning' };
  return { label: 'Low', color: 'error' };
}

/**
 * Get DORA performance level for Mean Time to Restore
 * @param mttr - MTTR in seconds
 */
export function getMTTRLevel(mttr: number): { label: string; color: 'success' | 'warning' | 'error' | 'default' } {
  if (mttr === 0) return { label: 'N/A', color: 'default' };
  const oneHour = 60 * 60;
  const oneDay = 24 * 60 * 60;
  const oneWeek = 7 * 24 * 60 * 60;
  
  if (mttr < oneHour) return { label: 'Elite', color: 'success' };
  if (mttr < oneDay) return { label: 'High', color: 'success' };
  if (mttr <= oneWeek) return { label: 'Medium', color: 'warning' };
  return { label: 'Low', color: 'error' };
}

/**
 * Get color based on success rate for visual indicators
 */
export function getSuccessRateColor(rate: number, hasData: boolean): 'success' | 'warning' | 'error' | 'default' {
  if (!hasData) return 'default';
  if (rate >= 90) return 'success';
  if (rate >= 50) return 'warning';
  return 'error';
}

/**
 * Format duration in seconds to human-readable format
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

export interface DailyCumulativeData {
  date: string;
  dateObj: Date;
  total: number;
  [columnName: string]: number | string | Date;
}

/**
 * Check if the team is using story point estimation
 */
export function isUsingStoryPoints(sprintData: SprintData): boolean {
  return sprintData.issues.some(issue => issue.storyPoints > 0);
}

/**
 * Calculate daily cumulative story points by board column
 * Returns data for stacked area/bar chart showing how story points accumulate over the sprint
 * Excludes weekends (Saturday and Sunday)
 */
export function calculateDailyCumulativePoints(sprintData: SprintData): DailyCumulativeData[] {
  const startDate = new Date(sprintData.sprint.start);
  const endDate = new Date(sprintData.sprint.end);
  
  // Generate all dates in the sprint, excluding weekends
  const dates: Date[] = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      dates.push(new Date(currentDate));
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Calculate cumulative points for each date
  const dailyData: DailyCumulativeData[] = dates.map(date => {
    const data: DailyCumulativeData = {
      date: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      dateObj: date,
      total: 0
    };
    
    // Initialize all columns to 0
    sprintData.columns.forEach(column => {
      data[column.name] = 0;
    });
    
    // For each issue, determine which column it was in on this date
    sprintData.issues.forEach(issue => {
      // Skip if issue was created after this date
      const issueCreated = new Date(issue.created);
      if (issueCreated > date) {
        return;
      }
      
      // Find the status of the issue on this date
      let currentColumn = sprintData.columns[0].name; // Default to first column
      
      // Check if issue was created directly in a non-first column
      if (issue.history.length > 0) {
        const firstHistory = issue.history[0];
        if (firstHistory.fromString) {
          currentColumn = firstHistory.fromString;
        }
      }
      
      // Go through history to find the status on this date
      for (const history of issue.history) {
        const historyDate = new Date(history.at);
        if (historyDate <= date) {
          currentColumn = history.toString;
        } else {
          break;
        }
      }
      
      // Add story points to the current column
      if (data[currentColumn] !== undefined) {
        data[currentColumn] = (data[currentColumn] as number) + issue.storyPoints;
        data.total += issue.storyPoints;
      }
    });
    
    return data;
  });
  
  return dailyData;
}

/**
 * Calculate daily cumulative issue count by board column
 * Returns data for stacked area/bar chart showing how issue count accumulates over the sprint
 * Excludes weekends (Saturday and Sunday)
 * Used as a fallback when story points are not available
 */
export function calculateDailyCumulativeIssues(sprintData: SprintData): DailyCumulativeData[] {
  const startDate = new Date(sprintData.sprint.start);
  const endDate = new Date(sprintData.sprint.end);
  
  // Generate all dates in the sprint, excluding weekends
  const dates: Date[] = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      dates.push(new Date(currentDate));
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Calculate cumulative issue count for each date
  const dailyData: DailyCumulativeData[] = dates.map(date => {
    const data: DailyCumulativeData = {
      date: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      dateObj: date,
      total: 0
    };
    
    // Initialize all columns to 0
    sprintData.columns.forEach(column => {
      data[column.name] = 0;
    });
    
    // For each issue, determine which column it was in on this date
    sprintData.issues.forEach(issue => {
      // Skip if issue was created after this date
      const issueCreated = new Date(issue.created);
      if (issueCreated > date) {
        return;
      }
      
      // Find the status of the issue on this date
      let currentColumn = sprintData.columns[0].name; // Default to first column
      
      // Check if issue was created directly in a non-first column
      if (issue.history.length > 0) {
        const firstHistory = issue.history[0];
        if (firstHistory.fromString) {
          currentColumn = firstHistory.fromString;
        }
      }
      
      // Go through history to find the status on this date
      for (const history of issue.history) {
        const historyDate = new Date(history.at);
        if (historyDate <= date) {
          currentColumn = history.toString;
        } else {
          break;
        }
      }
      
      // Add 1 issue to the current column
      if (data[currentColumn] !== undefined) {
        data[currentColumn] = (data[currentColumn] as number) + 1;
        data.total += 1;
      }
    });
    
    return data;
  });
  
  return dailyData;
}

