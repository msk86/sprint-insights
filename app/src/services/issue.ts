import { Issue, SprintData } from '../types';

export interface IssueFlags {
  isBlocked: boolean;
  isIncidentResponse: boolean;
  isNotStarted: boolean;
  isBackAndForth: boolean;
  isUnplanned: boolean;
  isSpillover: boolean;
  isCompleted: boolean;
  isClosed: boolean;
}

/**
 * Determines if an issue is incident response based on sub-category
 */
export function isIncidentResponse(issue: Issue): boolean {
  return !!(issue.subCategory && issue.subCategory.toLowerCase().includes('incident'));
}

/**
 * Determines if an issue was blocked during the sprint
 */
export function isIssueBlocked(issue: Issue, sprintData: SprintData): boolean {
  const blockRegex = /block/i;
  const historiesInSprint = getHistoriesInSprint(issue, sprintData);
  return historiesInSprint.some(h => blockRegex.test(h.toString));
}

/**
 * Determines if an issue was not started during the sprint
 */
export function isIssueNotStarted(issue: Issue, sprintData: SprintData): boolean {
  const columns = sprintData.columns;
  const startStatuses = [
    columns[0]?.name.toLowerCase(),
    'to do',
    'backlog',
    'selected for development'
  ].filter(Boolean);
  
  const historiesInSprint = getHistoriesInSprint(issue, sprintData);
  
  return (
    historiesInSprint.length === 0 ||
    startStatuses.includes(historiesInSprint[0].toString.toLowerCase())
  );
}

/**
 * Determines if an issue moved back and forth between statuses during the sprint
 */
export function isIssueBackAndForth(issue: Issue, sprintData: SprintData): boolean {
  const historiesInSprint = getHistoriesInSprint(issue, sprintData);
  const uniqueStatuses = new Set(historiesInSprint.map(h => h.toString));
  const repeatedStatuses = [...uniqueStatuses].filter(status =>
    historiesInSprint.filter(h => h.toString === status).length > 1
  );
  const blockRegex = /block/i;
  return repeatedStatuses.filter(status => !blockRegex.test(status)).length > 0;
}

/**
 * Determines if an issue was created during this sprint (unplanned)
 */
export function isIssueUnplanned(issue: Issue, sprintData: SprintData): boolean {
  const createdDate = new Date(issue.created);
  const sprintStart = new Date(sprintData.sprint.start);
  const sprintEnd = new Date(sprintData.sprint.end);
  return createdDate >= sprintStart && createdDate <= sprintEnd;
}

/**
 * Determines if an issue carried over to the next sprint (spillover)
 */
export function isIssueSpillover(issue: Issue, sprintData: SprintData): boolean {
  const columns = sprintData.columns;
  const endStatuses = [
    columns[columns.length - 1]?.name.toLowerCase(),
    'done',
    'closed',
    'resolved',
    'complete'
  ].filter(Boolean);
  
  const historiesInSprint = getHistoriesInSprint(issue, sprintData);
  const historiesAfterSprint = issue.history.filter(h =>
    new Date(h.at) > new Date(sprintData.sprint.end)
  );

  return (
    historiesAfterSprint.length > 0 ||
    (historiesInSprint.length !== 0 &&
      !endStatuses.includes(historiesInSprint[historiesInSprint.length - 1].toString.toLowerCase()))
  );
}

/**
 * Determines if an issue was completed during this sprint
 */
export function isIssueCompleted(issue: Issue, sprintData: SprintData): boolean {
  const columns = sprintData.columns;
  const completedStatuses = [
    columns[columns.length - 1]?.name.toLowerCase(),
    'done',
    'complete'
  ].filter(Boolean);
  
  const historiesInSprint = getHistoriesInSprint(issue, sprintData);

  return (
    historiesInSprint.length > 0 &&
    completedStatuses.includes(historiesInSprint[historiesInSprint.length - 1].toString.toLowerCase())
  );
}

/**
 * Determines if an issue was closed during this sprint
 */
export function isIssueClosed(issue: Issue, sprintData: SprintData): boolean {
  const closedStatuses = ['closed', 'resolved'];
  const historiesInSprint = getHistoriesInSprint(issue, sprintData);

  return (
    historiesInSprint.length > 0 &&
    closedStatuses.includes(historiesInSprint[historiesInSprint.length - 1].toString.toLowerCase())
  );
}

/**
 * Helper function to get issue histories within a sprint timeframe
 */
function getHistoriesInSprint(issue: Issue, sprintData: SprintData) {
  const sprintStart = new Date(sprintData.sprint.start);
  const sprintEnd = new Date(sprintData.sprint.end);
  
  return issue.history.filter(h => {
    const timestamp = new Date(h.at);
    return timestamp >= sprintStart && timestamp <= sprintEnd;
  });
}

/**
 * Calculate flags for an issue
 */
export function calculateIssueFlags(issue: Issue, sprintData: SprintData): IssueFlags {
  return {
    isBlocked: isIssueBlocked(issue, sprintData),
    isIncidentResponse: isIncidentResponse(issue),
    isNotStarted: isIssueNotStarted(issue, sprintData),
    isBackAndForth: isIssueBackAndForth(issue, sprintData),
    isUnplanned: isIssueUnplanned(issue, sprintData),
    isSpillover: isIssueSpillover(issue, sprintData),
    isCompleted: isIssueCompleted(issue, sprintData),
    isClosed: isIssueClosed(issue, sprintData)
  };
}

/**
 * Apply flags to all issues in sprint data
 */
export function applyIssueFlagsToSprintData(sprintData: SprintData): SprintData {
  return {
    ...sprintData,
    issues: sprintData.issues.map(issue => ({
      ...issue,
      flags: calculateIssueFlags(issue, sprintData)
    }))
  };
}

/**
 * Get available flag filters
 */
export const FLAG_FILTERS = [
  { key: 'isBlocked', label: 'Blocked' },
  { key: 'isIncidentResponse', label: 'Incident Response' },
  { key: 'isNotStarted', label: 'Not Started' },
  { key: 'isBackAndForth', label: 'Back-and-forth' },
  { key: 'isUnplanned', label: 'Unplanned' },
  { key: 'isSpillover', label: 'Spillover' },
  { key: 'isCompleted', label: 'Completed' },
  { key: 'isClosed', label: 'Closed' }
] as const;

