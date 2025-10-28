import { Issue, SprintData } from '../types';
import { calculateBusinessDays } from '../utils/timeCalculation';

interface TimelineEvent {
  timestamp: Date;
  to?: string;
  toStatus?: string;
}

export interface IssueFlags {
  isBlocked: boolean;
  isIncidentResponse: boolean;
  isBackAndForth: boolean;
  isUnplanned: boolean;
  isInherited: boolean;
  isSpillover: boolean;
  isCompleted: boolean;
  isClosed: boolean;
}

/**
 * Determines if an issue is incident response based on sub-category
 */
export function isIncidentResponse(issue: Issue, _: SprintData): boolean {
  return !!(issue.subCategory && issue.subCategory.toLowerCase().includes('incident'));
}

/**
 * Determines if an issue was blocked during the sprint
 */
export function isIssueBlocked(issue: Issue, _: SprintData): boolean {
  const blockRegex = /block/i;
  const historiesInSprint = getHistoriesInSprint(issue);
  return historiesInSprint.some(h => blockRegex.test(h.toString));
}

/**
 * Determines if an issue moved back and forth between statuses during the sprint
 */
export function isIssueBackAndForth(issue: Issue, _: SprintData): boolean {
  const historiesInSprint = getHistoriesInSprint(issue);
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
 * Determines if an issue was inherited from the previous sprint
 * An issue is inherited if:
 * 1. It was created before this sprint started, AND
 * 2. The first move in this sprint is NOT from the first column (meaning it was already in progress)
 */
export function isIssueInherited(issue: Issue, sprintData: SprintData): boolean {
  const createdDate = new Date(issue.created);
  const sprintStart = new Date(sprintData.sprint.start);
  
  // If issue was created during or after this sprint, it's not inherited
  if (createdDate >= sprintStart) {
    return false;
  }
  
  // Issue was created before this sprint
  // If there are no moves in this sprint, including boundary, it is a planned issue
  if (issue.history.length === 0) {
    return false;
  }
  
  // Check the first event in sprint - if it's from a non-first column, it's inherited
  const historiesInSprint = getHistoriesInSprint(issue, true);
  const firstEventInSprint = historiesInSprint[0];
  return historiesInSprint.length > 0 && firstEventInSprint.fromString.toLowerCase() !== sprintData.columns[0].name.toLowerCase();
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
  
  const historiesInSprint = getHistoriesInSprint(issue, true);
  const historiesAfterSprint = historiesInSprint.filter(h =>
    new Date(h.at) >= new Date(sprintData.sprint.end)
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
  
  const historiesInSprint = getHistoriesInSprint(issue);

  return (
    historiesInSprint.length > 0 &&
    completedStatuses.includes(historiesInSprint[historiesInSprint.length - 1].toString.toLowerCase())
  );
}

/**
 * Determines if an issue was closed during this sprint
 */
export function isIssueClosed(issue: Issue, _: SprintData): boolean {
  const closedStatuses = ['closed', 'resolved'];
  const historiesInSprint = getHistoriesInSprint(issue);

  return (
    historiesInSprint.length > 0 &&
    closedStatuses.includes(historiesInSprint[historiesInSprint.length - 1].toString.toLowerCase())
  );
}

/**
 * Helper function to get issue histories within a sprint timeframe
 */
function getHistoriesInSprint(issue: Issue, withBoundary: boolean = false) {
  return issue.history.filter(h => withBoundary ? true : h.inSprint === true);
}

/**
 * Calculate flags for an issue
 */
export function calculateIssueFlags(issue: Issue, sprintData: SprintData): IssueFlags {
  return {
    isBlocked: isIssueBlocked(issue, sprintData),
    isIncidentResponse: isIncidentResponse(issue, sprintData),
    isBackAndForth: isIssueBackAndForth(issue, sprintData),
    isUnplanned: isIssueUnplanned(issue, sprintData),
    isInherited: isIssueInherited(issue, sprintData),
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
  { key: 'isBackAndForth', label: 'Back-and-forth' },
  { key: 'isUnplanned', label: 'Unplanned' },
  { key: 'isInherited', label: 'Inherited' },
  { key: 'isSpillover', label: 'Spillover' },
  { key: 'isCompleted', label: 'Completed' },
  { key: 'isClosed', label: 'Closed' }
] as const;

/**
 * Calculate time spent on each column for an issue during a sprint
 * The backend already handles boundary events, so we just process the timeline
 */
export function calculateIssueTimeSpentOnColumns(
  issue: Issue,
  sprintData: SprintData
): Record<string, number> {
  const columns = sprintData.columns;
  
  // Build timeline from all history events (backend already added boundary events)
  const timelineEvents: TimelineEvent[] = issue.history.map(h => ({
    timestamp: new Date(h.at),
    to: h.statusId,
    toStatus: h.toString
  }));

  const timeSpentOnColumnsInSprint: Record<string, number> = {};
  
  // Calculate time spent between consecutive events
  for (let i = 0; i < timelineEvents.length - 1; i++) {
    const currentEvent = timelineEvents[i];
    const nextEvent = timelineEvents[i + 1];
    const columnName = currentEvent.toStatus || 'Unknown';
    
    // Initialize column tracking if not exists
    if (!timeSpentOnColumnsInSprint[columnName]) {
      timeSpentOnColumnsInSprint[columnName] = 0;
    }
    
    const timeSpent = calculateBusinessDays(currentEvent.timestamp, nextEvent.timestamp);
    timeSpentOnColumnsInSprint[columnName] += timeSpent;
  }

  // Remove first and last columns (as per requirement)
  if (columns.length > 0) {
    delete timeSpentOnColumnsInSprint[columns[0].name];
    delete timeSpentOnColumnsInSprint[columns[columns.length - 1].name];
  }

  return timeSpentOnColumnsInSprint;
}
