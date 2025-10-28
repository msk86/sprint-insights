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

  private normaliseIssueHistory(data: any, statusColumnMapping: Record<string, string>): IssueHistory[] {
    return data.values
      .filter((v: any) => v.items.find((i: any) => i.field === "status"))
      .map((v: any) => v.items.filter((i: any) => i.field === "status").map((i: any) => {
        // Map status IDs to column names immediately
        const toColumn = statusColumnMapping[i.to] || i.toString;
        const fromColumn = statusColumnMapping[i.from] || i.fromString;
        
        return {
          status: toColumn,  // Use column name
          statusId: i.to,    // Keep status ID for reference
          fromString: fromColumn,  // Use column name
          fromStatusId: i.from,    // Keep status ID for reference
          toString: toColumn,      // Use column name
          at: new Date(v.created)
        };
      }))
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
      end: new Date(sprint.completeDate || sprint.endDate)
    };
  }

  async getBoardColumns(boardId: string): Promise<{ columns: SprintColumn[], statusColumnMapping: Record<string, string> }> {
    const data = await this.makeJiraApiRequest(
      `${this.baseUrl}/rest/agile/1.0/board/${boardId}/configuration`
    );

    // Build mapping from status ID to column name
    const statusColumnMapping: Record<string, string> = {};
    for (const column of data.columnConfig.columns) {
      for (const status of column.statuses) {
        statusColumnMapping[status.id] = column.name;
      }
    }

    const columns = data.columnConfig.columns.map((c: any) => ({ name: c.name }));
    
    return {
      columns,
      statusColumnMapping
    };
  }


  /**
   * Filter issue history to only include events within sprint boundaries
   * and add boundary events for issues that were already in progress.
   * Note: toString already contains column names (mapped during normalizeIssueHistory).
   */
  private filterHistoryToSprint(
    allHistory: IssueHistory[], 
    sprintStart: Date, 
    sprintEnd: Date
  ): IssueHistory[] {
    // Get histories within sprint time boundary
    const historiesInSprint = allHistory.filter(h => 
      h.at >= sprintStart && h.at <= sprintEnd
    );

    // Get last event before sprint start (to know the starting state)
    const lastEventBeforeSprint = allHistory
      .filter(h => h.at < sprintStart)
      .sort((a, b) => b.at.getTime() - a.at.getTime())[0];

    // Get first event after sprint end (to know if issue was still in progress)
    const firstEventAfterSprint = allHistory
      .filter(h => h.at > sprintEnd)
      .sort((a, b) => a.at.getTime() - b.at.getTime())[0];

    // Build timeline with sprint boundaries
    const timelineEvents: IssueHistory[] = [];

    // Add boundary event at sprint start if issue was already in a status before sprint
    if (lastEventBeforeSprint) {
      timelineEvents.push({
        inSprint: false,
        status: lastEventBeforeSprint.toString,
        statusId: lastEventBeforeSprint.statusId,
        fromString: lastEventBeforeSprint.fromString,
        fromStatusId: lastEventBeforeSprint.fromStatusId,
        toString: lastEventBeforeSprint.toString,
        at: sprintStart
      });
    }

    // Add all events that happened during the sprint
    timelineEvents.push(...historiesInSprint.map(h => ({
      ...h,
      inSprint: true
    })));

    // Add boundary event at sprint end if issue was still in progress
    // (either there's an event after sprint, or last event in sprint is not a completed status)
    if (firstEventAfterSprint) {
      const previousColumn = historiesInSprint.length > 0 
        ? historiesInSprint[historiesInSprint.length - 1].toString
        : (lastEventBeforeSprint ? lastEventBeforeSprint.toString : '');
      
      timelineEvents.push({
        inSprint: false,
        status: firstEventAfterSprint.toString,
        statusId: firstEventAfterSprint.statusId,
        fromString: previousColumn,
        fromStatusId: historiesInSprint.length > 0 
          ? historiesInSprint[historiesInSprint.length - 1].statusId
          : lastEventBeforeSprint?.statusId,
        toString: firstEventAfterSprint.toString,
        at: sprintEnd
      });
    } else if (historiesInSprint.length > 0) {
      const lastEvent = historiesInSprint[historiesInSprint.length - 1];
      const isCompleted = this.issueStatuses.END_STATUSES.some(s => lastEvent.toString.toLowerCase() === s);
      
      if (!isCompleted) {
        // Issue was still in progress at sprint end
        timelineEvents.push({
          inSprint: false,
          status: lastEvent.toString,
          statusId: lastEvent.statusId,
          fromString: lastEvent.toString,
          fromStatusId: lastEvent.statusId,
          toString: lastEvent.toString,
          at: sprintEnd
        });
      }
    }

    return timelineEvents;
  }

  async getSprintIssues(sprintIndex: number, columns: SprintColumn[], statusColumnMapping: Record<string, string>): Promise<{ sprint: SprintMeta; issues: Issue[] }> {
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
    
    const firstColumnName = columns[0].name;
    const lastColumnName = columns[columns.length - 1].name;
    
    // Fetch histories for all issues and calculate timestamps
    for (const issue of sprintData.issues) {
      const allHistory = await this.getIssueHistory(issue.key, statusColumnMapping);
      
      // Calculate work timestamps from full history
      // Note: toString already contains column names (mapped during normalizeIssueHistory)
      let workStartedAt: Date | undefined;
      let completedAt: Date | undefined;

      if (allHistory.length > 0) {
        // Find when work started (moved out of first column)
        for (const event of allHistory) {
          if (event.fromString === firstColumnName) {
            workStartedAt = event.at;
            break;
          }
        }

        // If no move out of first column was found, check if issue was created in a non-first column
        if (!workStartedAt && allHistory[0].fromString !== firstColumnName) {
          // Issue was created directly in a non-first column, use creation time
          workStartedAt = issue.created;
        }

        // Find when work completed (moved to last column)
        for (const event of allHistory) {
          if (event.toString === lastColumnName) {
            completedAt = event.at;
            // Don't break - keep looking for the last time it moved to the last column
          }
        }
      }

      issue.workStartedAt = workStartedAt;
      issue.completedAt = completedAt;
      
      // Filter history to sprint boundaries
      issue.history = this.filterHistoryToSprint(allHistory, sprintMeta.start, sprintMeta.end);
    }
    
    return sprintData;
  }

  async getIssueHistory(issueKey: string, statusColumnMapping: Record<string, string>): Promise<IssueHistory[]> {
    const data = await this.makeJiraApiRequest(
      `${this.baseUrl}/rest/api/3/issue/${issueKey}/changelog`
    );
    return this.normaliseIssueHistory(data, statusColumnMapping);
  }

  /**
   * Resolve a sprint identifier to a stable sprint index
   * This should be called BEFORE checking cache to ensure consistent cache keys
   * 
   * @param sprintIdentifier - Sprint name or index
   * @param type - Required type: 'index' for numeric index, 'name' for fuzzy name search
   */
  async resolveSprintIdentifier(
    sprintIdentifier: string | number, 
    type: 'index' | 'name'
  ): Promise<number> {
    // If type is 'index', treat as numeric index
    if (type === 'index') {
      const index = typeof sprintIdentifier === 'number' 
        ? sprintIdentifier 
        : parseInt(sprintIdentifier as string, 10);
      
      if (isNaN(index)) {
        throw new Error(`Invalid sprint index: ${sprintIdentifier}`);
      }
      return index;
    }
    
    // If type is 'name', treat as fuzzy name search
    const indexResult = await this.getSprintIndex(sprintIdentifier as string);
    return indexResult.current;
  }

  /**
   * Get sprint metadata without fetching full issue data
   * Useful for cache key generation
   */
  async getSprintMetadata(sprintIndex: number): Promise<SprintMeta> {
    return await this.getSprint(this.teamConfig.JIRA_BOARD_ID, sprintIndex);
  }

  /**
   * Get full sprint data including issues and history
   * Uses sprintIndex directly (should be resolved beforehand)
   */
  async getSprintData(sprintIndex: number): Promise<SprintData> {
    console.log(`Loading Sprint Data for Project: ${this.teamConfig.JIRA_PROJECT}, Board: ${this.teamConfig.JIRA_BOARD_ID}, SprintIndex: ${sprintIndex}`);

    // Get board columns and status mapping first
    const boardColumnsData = await this.getBoardColumns(this.teamConfig.JIRA_BOARD_ID);
    
    // Get sprint issues with filtered history (using status-to-column mapping)
    const sprintData = await this.getSprintIssues(sprintIndex, boardColumnsData.columns, boardColumnsData.statusColumnMapping);

    return {
      sprint: sprintData.sprint,
      columns: boardColumnsData.columns,
      issues: sprintData.issues,
      builds: [] // Will be populated by Buildkite service
    };
  }
}
