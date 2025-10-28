export interface TeamConfig {
  team: string;
  JIRA_EMAIL: string;
  JIRA_TOKEN: string;
  JIRA_PROJECT: string;
  JIRA_BOARD_ID: string;
  BUILDKITE_TOKEN: string;
  BUILDKITE_PIPELINES: string;
}

export interface SprintMeta {
  name: string;
  index: number;
  state: string;
  start: Date;
  end: Date;
}

export interface SprintColumn {
  name: string;
}

export interface IssueHistory {
  inSprint: boolean;
  status: string;
  statusId?: string;  // Status ID for mapping to board columns
  fromString: string;
  fromStatusId?: string;  // Previous status ID
  toString: string;
  at: Date;
}

export interface Issue {
  id: string;
  key: string;
  summary: string;
  created: Date;
  storyPoints: number;
  subCategory: string;
  history: IssueHistory[];
  workStartedAt?: Date;  // When work actually began (moved out of first column)
  completedAt?: Date;     // When work was completed (moved to last column)
}

export interface Build {
  pipelineName: string;
  buildNumber: number;
  status: string;
  startedAt: string;
  finishedAt: string;
  duration: number;
  branch: string;
  commit: string;
  repository: string;
  deployments: Deployment[];
  isRelease: boolean;
  isReleaseSuccess: boolean;
}

export interface Deployment {
  deployedAt: string;
  name: string;
  status: string;
}

export interface SprintData {
  sprint: SprintMeta;
  columns: SprintColumn[];
  issues: Issue[];
  builds: Build[];
}

export interface SprintStats {
  total: number;
  completed: number;
  closed: number;
  spillover: number;
  notStarted: number;
  unplanned: number;
  backAndForth: number;
  blocked: number;
  incidents: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  closedStoryPoints: number;
  avgCycleTime: number;
  meanLeadTimeForChange: number;
  meanIncidentResolveTime: number;
}

export interface LLMAnalysisRequest {
  sprintData: SprintData;
  historicalData?: SprintData[];
  analysisType: 'sprint_analysis' | 'free_chat';
  userMessage?: string;
}

export interface LLMAnalysisResponse {
  analysis: string;
  insights: string[];
  recommendations: string[];
}
