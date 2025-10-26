import { TeamConfig, SprintData, SprintMeta, Issue, IssueHistory, SprintColumn } from '../types';

export class JiraService {
  private baseUrl: string;
  private customFields = {
    STORY_POINTS: 'customfield_10004',
    WORK_SUBCATEGORY: ['customfield_25138', 'customfield_22453']
  };

  private issueStatuses = {
    COMPLETED: ['done', 'fixed', 'finished'],
    CLOSED: ['closed', 'cancelled'],
    START_STATUSES: ['to do', 'todo', 'backlog'],
    END_STATUSES: ['done', 'fixed', 'finished', 'closed', 'cancelled']
  };

  private businessHours = {
    START_HOUR: 6,
    END_HOUR: 18,
    WORKING_HOURS: 8 * 60 * 60 * 1000,
    MS_PER_DAY: 12 * 60 * 60 * 1000
  };

  constructor(private teamConfig: TeamConfig) {
    this.baseUrl = process.env.JIRA_BASE_URL || 'https://www.atlassian.net';
  }

  private async makeJiraApiRequest(url: string, options: RequestInit = {}): Promise<any> {
    const auth = Buffer.from(`${this.teamConfig.JIRA_EMAIL}:${this.teamConfig.JIRA_TOKEN}`).toString('base64');
    
    const defaultOptions: RequestInit = {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const response = await fetch(url, { ...defaultOptions, ...options });
    return await response.json();
  }

  private normaliseSprintIssues(data: any): Issue[] {
    return data.issues.map((issue: any) => ({
      id: issue.id,
      key: issue.key,
      summary: issue.fields.summary,
      created: new Date(issue.fields.created),
      storyPoints: issue.fields[this.customFields.STORY_POINTS] || 0,
      subCategory: this.customFields.WORK_SUBCATEGORY
        .map(c => issue.fields[c])
        .find(c => c)?.value || '',
      history: []
    }));
  }

  private normaliseIssueHistory(data: any): IssueHistory[] {
    return data.values
      .filter((v: any) => v.items.find((i: any) => i.field === "status"))
      .map((v: any) => v.items.filter((i: any) => i.field === "status").map((i: any) => ({
        status: i.toString,
        fromString: i.fromString,
        toString: i.toString,
        at: new Date(v.created)
      })))
      .flat();
  }

  async getSprintIndex(sprint: string | number): Promise<{ current: number; total: number }> {
    console.log(`Getting Sprint Index for Project: ${this.teamConfig.JIRA_PROJECT}, Board: ${this.teamConfig.JIRA_BOARD_ID}, Sprint: ${sprint}`);
    
    // Get total sprint count
    const totalParams = new URLSearchParams({
      state: "active,closed",
      maxResults: "1"
    });
    const totalData = await this.makeJiraApiRequest(
      `${this.baseUrl}/rest/agile/1.0/board/${this.teamConfig.JIRA_BOARD_ID}/sprint?${totalParams}`
    );
    const total = totalData.total;

    // Get recent sprints to find the target sprint
    const recentParams = new URLSearchParams({
      state: "active,closed",
      startAt: (total - 10).toString(),
      maxResults: "10"
    });
    const recentData = await this.makeJiraApiRequest(
      `${this.baseUrl}/rest/agile/1.0/board/${this.teamConfig.JIRA_BOARD_ID}/sprint?${recentParams}`
    );
    
    let targetSprint;
    if (sprint === 'LATEST_CLOSED') {
      targetSprint = recentData.values.findLast((v: any) => v.state === 'closed');
    } else if (typeof sprint === 'number') {
      targetSprint = recentData.values[sprint];
    } else {
      targetSprint = recentData.values.find((v: any) => 
        v.name.toLowerCase().replace(/\W/g, '-').includes(sprint.toLowerCase().replace(/\W/g, '-'))
      );
    }
    
    const index = recentData.values.findIndex((v: any) => v.name === targetSprint.name);
    const sprintIndex = total - 10 + index;
    
    console.log(`Sprint Index for Project: ${this.teamConfig.JIRA_PROJECT}, Board: ${this.teamConfig.JIRA_BOARD_ID}, Sprint: ${targetSprint.name} is: ${sprintIndex}`);
    return { current: sprintIndex, total: total };
  }

  async getSprint(boardId: string, index: number): Promise<SprintMeta> {
    const params = new URLSearchParams({
      state: "active,closed",
      startAt: index.toString(),
      maxResults: "1"
    });
    const data = await this.makeJiraApiRequest(
      `${this.baseUrl}/rest/agile/1.0/board/${boardId}/sprint?${params}`
    );

    const sprint = data.values[0];
    return {
      name: sprint.name,
      index: index,
      state: sprint.state,
      start: new Date(sprint.startDate),
      end: new Date(sprint.endDate)
    };
  }

  async getBoardColumns(boardId: string): Promise<SprintColumn[]> {
    const data = await this.makeJiraApiRequest(
      `${this.baseUrl}/rest/agile/1.0/board/${boardId}/configuration`
    );

    return data.columnConfig.columns.map((c: any) => ({ name: c.name }));
  }

  async getSprintIssues(sprintIndex: number): Promise<{ sprint: SprintMeta; issues: Issue[] }> {
    const sprintMeta = await this.getSprint(this.teamConfig.JIRA_BOARD_ID, sprintIndex);
    const jqlQuery = `project=${this.teamConfig.JIRA_PROJECT} AND Sprint in ("${sprintMeta.name}")`;
    
    const requiredFields = [
      'summary', 
      'created', 
      this.customFields.STORY_POINTS,
      ...this.customFields.WORK_SUBCATEGORY
    ];
    
    const data = await this.makeJiraApiRequest(
      `${this.baseUrl}/rest/api/3/search/jql`,
      {
        method: 'POST',
        body: JSON.stringify({
          jql: jqlQuery,
          fields: requiredFields
        })
      }
    );

    const normalizedData = this.normaliseSprintIssues(data);
    const sprintData = {
      sprint: sprintMeta,
      issues: normalizedData
    };
    
    // Fetch histories for all issues
    for (const issue of sprintData.issues) {
      issue.history = await this.getIssueHistory(issue.key);
    }
    
    return sprintData;
  }

  async getIssueHistory(issueKey: string): Promise<IssueHistory[]> {
    const data = await this.makeJiraApiRequest(
      `${this.baseUrl}/rest/api/3/issue/${issueKey}/changelog`
    );
    return this.normaliseIssueHistory(data);
  }

  async getSprintData(sprintIdentifier: string | number): Promise<SprintData> {
    console.log(`Loading Sprint Data for Project: ${this.teamConfig.JIRA_PROJECT}, Board: ${this.teamConfig.JIRA_BOARD_ID}, SprintIdentifier: ${sprintIdentifier}`);
    
    let sprintIndex: number;
    if (typeof sprintIdentifier === 'number') {
      sprintIndex = sprintIdentifier;
    } else {
      const indexResult = await this.getSprintIndex(sprintIdentifier);
      sprintIndex = indexResult.current;
    }

    const [sprintData, boardColumns] = await Promise.all([
      this.getSprintIssues(sprintIndex),
      this.getBoardColumns(this.teamConfig.JIRA_BOARD_ID)
    ]);

    return {
      sprint: sprintData.sprint,
      columns: boardColumns,
      issues: sprintData.issues,
      builds: [] // Will be populated by Buildkite service
    };
  }
}
