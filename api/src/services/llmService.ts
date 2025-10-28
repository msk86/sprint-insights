import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { LLMAnalysisRequest, LLMAnalysisResponse, SprintData } from '../types';

export class LLMService {
  private client: BedrockRuntimeClient;
  private modelId: string;
  private region: string;

  constructor() {
    this.region = process.env.BEDROCK_REGION || 'us-east-1';
    this.modelId = process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-4-20250514-v1:0';

    // Always use real AWS Bedrock service (LocalStack doesn't support Bedrock)
    this.client = new BedrockRuntimeClient({
      region: this.region
    });
  }

  async analyzeSprint(request: LLMAnalysisRequest): Promise<LLMAnalysisResponse> {
    const prompt = this.buildSprintAnalysisPrompt(request);
    const response = await this.invokeModel(prompt);
    return this.parseAnalysisResponse(response);
  }

  async freeChat(request: LLMAnalysisRequest): Promise<LLMAnalysisResponse> {
    const prompt = this.buildFreeChatPrompt(request);
    const response = await this.invokeModelWithHistory(prompt, request.chatHistory);
    return this.parseAnalysisResponse(response);
  }

  private buildSprintAnalysisPrompt(request: LLMAnalysisRequest): string {
    const { sprintData, historicalData, stats, historicalStats } = request;
    
    // Use provided stats from frontend if available, otherwise calculate
    const totalIssues = stats?.totalIssues ?? sprintData.issues.length;
    const totalPoints = stats?.totalPoints ?? sprintData.issues.reduce((sum, issue) => sum + issue.storyPoints, 0);
    const completedIssues = stats?.completedIssues ?? 0;
    const completedPoints = stats?.completedPoints ?? 0;
    const backAndForthIssues = stats?.backAndForthIssues ?? 0;
    const incidentIssues = stats?.incidentIssues ?? 0;
    const totalBuilds = stats?.totalBuilds ?? sprintData.builds.length;
    const totalReleases = stats?.totalReleases ?? 0;
    const successfulBuilds = stats?.successfulBuilds ?? 0;
    const successfulReleases = stats?.successfulReleases ?? 0;
    const avgBuildDuration = stats?.avgBuildDuration ?? 0;
    const deploymentFrequency = stats?.deploymentFrequency ?? 0;
    const medianLeadTime = stats?.medianLeadTime ?? 0;
    const changeFailureRate = stats?.changeFailureRate ?? 0;
    const medianMTTR = stats?.medianMTTR ?? 0;
    
    // Calculate rates for display
    const buildSuccessRate = totalBuilds > 0 ? ((successfulBuilds / totalBuilds) * 100).toFixed(1) : '0';
    const releaseSuccessRate = totalReleases > 0 ? ((successfulReleases / totalReleases) * 100).toFixed(1) : '0';
    
    // Format sprint metadata and statistics
    const completionRate = totalIssues > 0 ? ((completedIssues / totalIssues) * 100).toFixed(1) : '0';
    const pointsCompletionRate = totalPoints > 0 ? ((completedPoints / totalPoints) * 100).toFixed(1) : '0';
    
    const sprintMetadata = `CURRENT SPRINT:
Name: ${sprintData.sprint.name} (Index: ${sprintData.sprint.index})
State: ${sprintData.sprint.state}
Duration: ${new Date(sprintData.sprint.start).toLocaleDateString()} - ${new Date(sprintData.sprint.end).toLocaleDateString()}

STATISTICS:
- Total Issues: ${totalIssues} (${totalPoints} story points)
- Completed: ${completedIssues} issues (${completedPoints} story points)
- Completion Rate: ${completionRate}% of issues, ${pointsCompletionRate}% of points
- Throughput: ${completedIssues} issues
- Velocity: ${completedPoints} story points
- Back-and-forth Issues: ${backAndForthIssues}
- Incidents: ${incidentIssues}

BUILD & RELEASE STATISTICS:
- Total Builds: ${totalBuilds} (${successfulBuilds} successful = ${buildSuccessRate}%)
- Total Releases: ${totalReleases} (${successfulReleases} successful = ${releaseSuccessRate}%)
- Average Build Duration: ${avgBuildDuration.toFixed(1)} minutes
${stats?.buildSummaryByPipeline && stats.buildSummaryByPipeline.length > 0 ? `
BUILD & RELEASE BY PIPELINE:
${stats.buildSummaryByPipeline.map(pipeline => {
  const pipelineBuildSuccessRate = pipeline.totalBuilds > 0 ? ((pipeline.successfulBuilds / pipeline.totalBuilds) * 100).toFixed(1) : '0';
  const pipelineReleaseSuccessRate = pipeline.totalReleases > 0 ? ((pipeline.successfulReleases / pipeline.totalReleases) * 100).toFixed(1) : '0';
  return `- ${pipeline.pipelineName} (${pipeline.repository}):
  Builds: ${pipeline.totalBuilds} (${pipeline.successfulBuilds} successful = ${pipelineBuildSuccessRate}%)
  Releases: ${pipeline.totalReleases} (${pipeline.successfulReleases} successful = ${pipelineReleaseSuccessRate}%)
  Avg Duration: ${pipeline.avgBuildDuration.toFixed(1)} min`;
}).join('\n')}` : ''}

DORA METRICS:
- Deployment Frequency: ${deploymentFrequency.toFixed(2)} releases/day
- Lead Time for Changes: ${medianLeadTime.toFixed(1)} days (median cycle time)
- Change Failure Rate: ${changeFailureRate.toFixed(1)}% (incidents per successful release)
- Mean Time to Restore: ${medianMTTR.toFixed(1)} hours (median incident resolution time)

BOARD COLUMNS:
${sprintData.columns.map(col => col.name).join(' → ')}`;

    // Format issues as readable text
    const issuesFormatted = sprintData.issues.map(issue => {
      const statusChanges = issue.history.filter(h => h.inSprint);
      const flow = statusChanges.length > 0 
        ? statusChanges.map(h => `${h.toString} (${new Date(h.at).toLocaleDateString()})`).join(' -> ')
        : 'No status changes';
      
      const createdDate = new Date(issue.created).toLocaleDateString();
      const startedDate = issue.workStartedAt ? new Date(issue.workStartedAt).toLocaleDateString() : 'Not started';
      const completedDate = issue.completedAt ? new Date(issue.completedAt).toLocaleDateString() : 'Not completed';
      
      // Format flags
      const flags = [];
      if (issue.flags?.isCompleted) flags.push('Completed');
      if (issue.flags?.isClosed) flags.push('Closed');
      if (issue.flags?.isBlocked) flags.push('Blocked');
      if (issue.flags?.isIncidentResponse) flags.push('Incident');
      if (issue.flags?.isBackAndForth) flags.push('Back-and-forth');
      if (issue.flags?.isUnplanned) flags.push('Unplanned');
      if (issue.flags?.isInherited) flags.push('Inherited');
      if (issue.flags?.isSpillover) flags.push('Spillover');
      const flagsText = flags.length > 0 ? ` | Flags: ${flags.join(', ')}` : '';
      
      return `[${issue.key}] ${issue.summary}
  Points: ${issue.storyPoints} | Category: ${issue.subCategory || 'None'}${flagsText}
  Created: ${createdDate} | Started: ${startedDate} | Completed: ${completedDate}
  Flow: ${flow} (NOTE: Flow shows only status changes within the sprint)`;
    }).join('\n\n');
    
    // Build historical context using historicalStats
    const historicalContext = historicalStats && historicalStats.length > 0 ? historicalStats.map(hist => {
      const completionRate = hist.totalIssues > 0 ? ((hist.completedIssues / hist.totalIssues) * 100).toFixed(1) : '0';
      const buildSuccessRate = hist.totalBuilds > 0 ? ((hist.successfulBuilds / hist.totalBuilds) * 100).toFixed(1) : '0';
      const releaseSuccessRate = hist.totalReleases > 0 ? ((hist.successfulReleases / hist.totalReleases) * 100).toFixed(1) : '0';
      
      let sprintSummary = `Sprint ${hist.sprintIndex} (${hist.sprintName}):
  - Issues: ${hist.totalIssues} (${hist.totalPoints} points) → ${hist.completedIssues} completed (${hist.completedPoints} points) = ${completionRate}% completion
  - Builds: ${hist.totalBuilds} (${hist.successfulBuilds} successful = ${buildSuccessRate}%)
  - Releases: ${hist.totalReleases} (${hist.successfulReleases} successful = ${releaseSuccessRate}%)
  - DORA: DF=${hist.deploymentFrequency.toFixed(2)} releases/day, LT=${hist.medianLeadTime.toFixed(1)} days, CFR=${hist.changeFailureRate.toFixed(1)}%, MTTR=${hist.medianMTTR.toFixed(1)} hours`;
      
      // Add build summary by pipeline if available
      if (hist.buildSummaryByPipeline && hist.buildSummaryByPipeline.length > 0) {
        sprintSummary += '\n  Build/Release by Pipeline:';
        hist.buildSummaryByPipeline.forEach(pipeline => {
          const pipelineBuildSuccessRate = pipeline.totalBuilds > 0 ? ((pipeline.successfulBuilds / pipeline.totalBuilds) * 100).toFixed(1) : '0';
          const pipelineReleaseSuccessRate = pipeline.totalReleases > 0 ? ((pipeline.successfulReleases / pipeline.totalReleases) * 100).toFixed(1) : '0';
          sprintSummary += `\n    - ${pipeline.pipelineName} (${pipeline.repository}): ${pipeline.totalBuilds} builds (${pipelineBuildSuccessRate}% success), ${pipeline.totalReleases} releases (${pipelineReleaseSuccessRate}% success), ${pipeline.avgBuildDuration.toFixed(1)} min avg`;
        });
      }
      
      return sprintSummary;
    }).join('\n\n') : 'No historical data available';
    
    let prompt = `You are an expert agile coach and sprint analyst. Analyze the following sprint data and provide insights and recommendations.

${sprintMetadata}

ISSUES (${totalIssues} total):
${issuesFormatted}

HISTORICAL TRENDS (for comparison):
${historicalContext}

RESPONSE FORMAT:
You must respond with a valid JSON object (not markdown, no code blocks):
{
  "analysis": "Your comprehensive analysis in plain text (2-3 paragraphs)",
  "insights": [
    "First key insight in plain text",
    "Second key insight in plain text",
    "Third key insight in plain text"
  ],
  "recommendations": [
    "First actionable recommendation in plain text",
    "Second actionable recommendation in plain text",
    "Third actionable recommendation in plain text"
  ]
}

Focus on:
1. Sprint performance metrics (throughput, velocity, completion rate)
2. Quality indicators (back-and-forth issues, incidents)
3. Issue flow patterns and bottlenecks (status changes, time in columns)
4. Work distribution (story points, sub-categories)
5. Trends compared to historical data
6. Actionable recommendations for improvement

CRITICAL: Return ONLY the JSON object. No markdown code blocks. All text fields are plain text without markdown formatting.`;

    return prompt;
  }

  private buildFreeChatPrompt(request: LLMAnalysisRequest): string {
    const { userMessage, chatHistory } = request;
    
    // Check if this is a visualization request
    const visualizationKeywords = ['chart', 'graph', 'visualize', 'show me', 'plot', 'distribution', 'table', 'list'];
    const isVisualizationRequest = visualizationKeywords.some(keyword => 
      userMessage?.toLowerCase().includes(keyword)
    );
    
    // If there's chat history, send condensed prompts
    if (chatHistory && chatHistory.length > 0) {
      if (isVisualizationRequest) {
        return this.buildVisualizationReminderPrompt(userMessage || '');
      } else {
        return userMessage || '';
      }
    }
    
    // First message - send full context based on request type
    if (isVisualizationRequest) {
      return this.buildVisualizationPrompt(request);
    } else {
      return this.buildQuestionPrompt(request);
    }
  }

  private buildVisualizationReminderPrompt(userMessage: string): string {
    return `${userMessage}

REMINDER - You have access to allSprints data (already provided in first message):
- Use "chart" for visual graphs (line, bar, pie, area)  
- Use "table" for tabular data display
- Current sprint: allSprints[allSprints.length - 1]
- Filter by sprint name if mentioned: allSprints.find(s => s.sprint.name.includes('PX 19'))
- All data structures remain the same (Issue, SprintData, etc.)
- Return JSON with "chart" or "table" field only (no "analysis" needed for visualizations)`;
  }

  private buildVisualizationPrompt(request: LLMAnalysisRequest): string {
    const { sprintData, userMessage, stats, historicalStats } = request;
    
    // Use provided stats from frontend if available, otherwise calculate
    const totalIssues = stats?.totalIssues ?? sprintData.issues.length;
    const totalPoints = stats?.totalPoints ?? sprintData.issues.reduce((sum, issue) => sum + issue.storyPoints, 0);
    const completedIssues = stats?.completedIssues ?? 0;
    const completedPoints = stats?.completedPoints ?? 0;
    const backAndForthIssues = stats?.backAndForthIssues ?? 0;
    const incidentIssues = stats?.incidentIssues ?? 0;
    const totalBuilds = stats?.totalBuilds ?? sprintData.builds.length;
    const totalReleases = stats?.totalReleases ?? 0;
    const successfulBuilds = stats?.successfulBuilds ?? 0;
    const successfulReleases = stats?.successfulReleases ?? 0;
    const avgBuildDuration = stats?.avgBuildDuration ?? 0;
    const deploymentFrequency = stats?.deploymentFrequency ?? 0;
    const medianLeadTime = stats?.medianLeadTime ?? 0;
    const changeFailureRate = stats?.changeFailureRate ?? 0;
    const medianMTTR = stats?.medianMTTR ?? 0;
    
    // Calculate rates for display
    const buildSuccessRate = totalBuilds > 0 ? ((successfulBuilds / totalBuilds) * 100).toFixed(1) : '0';
    const releaseSuccessRate = totalReleases > 0 ? ((successfulReleases / totalReleases) * 100).toFixed(1) : '0';
    
    // Format sprint metadata and statistics
    const completionRate = totalIssues > 0 ? ((completedIssues / totalIssues) * 100).toFixed(1) : '0';
    const pointsCompletionRate = totalPoints > 0 ? ((completedPoints / totalPoints) * 100).toFixed(1) : '0';
    
    const sprintMetadata = `CURRENT SPRINT:
Name: ${sprintData.sprint.name} (Index: ${sprintData.sprint.index})
State: ${sprintData.sprint.state}
Duration: ${new Date(sprintData.sprint.start).toLocaleDateString()} - ${new Date(sprintData.sprint.end).toLocaleDateString()}

STATISTICS:
- Total Issues: ${totalIssues} (${totalPoints} story points)
- Completed: ${completedIssues} issues (${completedPoints} story points)
- Completion Rate: ${completionRate}% of issues, ${pointsCompletionRate}% of points
- Back-and-forth Issues: ${backAndForthIssues}
- Incidents: ${incidentIssues}

BUILD & RELEASE STATISTICS:
- Total Builds: ${totalBuilds} (${successfulBuilds} successful = ${buildSuccessRate}%)
- Total Releases: ${totalReleases} (${successfulReleases} successful = ${releaseSuccessRate}%)
- Average Build Duration: ${avgBuildDuration.toFixed(1)} minutes
${stats?.buildSummaryByPipeline && stats.buildSummaryByPipeline.length > 0 ? `
BUILD & RELEASE BY PIPELINE:
${stats.buildSummaryByPipeline.map(pipeline => {
  const pipelineBuildSuccessRate = pipeline.totalBuilds > 0 ? ((pipeline.successfulBuilds / pipeline.totalBuilds) * 100).toFixed(1) : '0';
  const pipelineReleaseSuccessRate = pipeline.totalReleases > 0 ? ((pipeline.successfulReleases / pipeline.totalReleases) * 100).toFixed(1) : '0';
  return `- ${pipeline.pipelineName} (${pipeline.repository}):
  Builds: ${pipeline.totalBuilds} (${pipeline.successfulBuilds} successful = ${pipelineBuildSuccessRate}%)
  Releases: ${pipeline.totalReleases} (${pipeline.successfulReleases} successful = ${pipelineReleaseSuccessRate}%)
  Avg Duration: ${pipeline.avgBuildDuration.toFixed(1)} min`;
}).join('\n')}` : ''}

DORA METRICS:
- Deployment Frequency: ${deploymentFrequency.toFixed(2)} releases/day
- Lead Time for Changes: ${medianLeadTime.toFixed(1)} days (median cycle time)
- Change Failure Rate: ${changeFailureRate.toFixed(1)}% (incidents per successful release)
- Mean Time to Restore: ${medianMTTR.toFixed(1)} hours (median incident resolution time)

BOARD COLUMNS:
${sprintData.columns.map(col => col.name).join(' → ')}`;

    // Format issues as readable text
    const issuesFormatted = sprintData.issues.map(issue => {
      const statusChanges = issue.history.filter(h => h.inSprint);
      const flow = statusChanges.length > 0 
        ? statusChanges.map(h => `${h.toString} (${new Date(h.at).toLocaleDateString()})`).join(' -> ')
        : 'No status changes';
      
      const createdDate = new Date(issue.created).toLocaleDateString();
      const startedDate = issue.workStartedAt ? new Date(issue.workStartedAt).toLocaleDateString() : 'Not started';
      const completedDate = issue.completedAt ? new Date(issue.completedAt).toLocaleDateString() : 'Not completed';
      
      // Format flags
      const flags = [];
      if (issue.flags?.isCompleted) flags.push('Completed');
      if (issue.flags?.isClosed) flags.push('Closed');
      if (issue.flags?.isBlocked) flags.push('Blocked');
      if (issue.flags?.isIncidentResponse) flags.push('Incident');
      if (issue.flags?.isBackAndForth) flags.push('Back-and-forth');
      if (issue.flags?.isUnplanned) flags.push('Unplanned');
      if (issue.flags?.isInherited) flags.push('Inherited');
      if (issue.flags?.isSpillover) flags.push('Spillover');
      const flagsText = flags.length > 0 ? ` | Flags: ${flags.join(', ')}` : '';
      
      return `[${issue.key}] ${issue.summary}
  Points: ${issue.storyPoints} | Category: ${issue.subCategory || 'None'}${flagsText}
  Created: ${createdDate} | Started: ${startedDate} | Completed: ${completedDate}
  Flow: ${flow} (NOTE: Flow shows only status changes within the sprint)`;
    }).join('\n\n');
    
    // Build historical context using historicalStats
    const historicalContext = historicalStats && historicalStats.length > 0 ? historicalStats.map(hist => {
      const completionRate = hist.totalIssues > 0 ? ((hist.completedIssues / hist.totalIssues) * 100).toFixed(1) : '0';
      const buildSuccessRate = hist.totalBuilds > 0 ? ((hist.successfulBuilds / hist.totalBuilds) * 100).toFixed(1) : '0';
      const releaseSuccessRate = hist.totalReleases > 0 ? ((hist.successfulReleases / hist.totalReleases) * 100).toFixed(1) : '0';
      
      let sprintSummary = `Sprint ${hist.sprintIndex} (${hist.sprintName}):
  - Issues: ${hist.totalIssues} (${hist.totalPoints} points) → ${hist.completedIssues} completed (${hist.completedPoints} points) = ${completionRate}% completion
  - Builds: ${hist.totalBuilds} (${hist.successfulBuilds} successful = ${buildSuccessRate}%)
  - Releases: ${hist.totalReleases} (${hist.successfulReleases} successful = ${releaseSuccessRate}%)
  - DORA: DF=${hist.deploymentFrequency.toFixed(2)} releases/day, LT=${hist.medianLeadTime.toFixed(1)} days, CFR=${hist.changeFailureRate.toFixed(1)}%, MTTR=${hist.medianMTTR.toFixed(1)} hours`;
      
      // Add build summary by pipeline if available
      if (hist.buildSummaryByPipeline && hist.buildSummaryByPipeline.length > 0) {
        sprintSummary += '\n  Build/Release by Pipeline:';
        hist.buildSummaryByPipeline.forEach(pipeline => {
          const pipelineBuildSuccessRate = pipeline.totalBuilds > 0 ? ((pipeline.successfulBuilds / pipeline.totalBuilds) * 100).toFixed(1) : '0';
          const pipelineReleaseSuccessRate = pipeline.totalReleases > 0 ? ((pipeline.successfulReleases / pipeline.totalReleases) * 100).toFixed(1) : '0';
          sprintSummary += `\n    - ${pipeline.pipelineName} (${pipeline.repository}): ${pipeline.totalBuilds} builds (${pipelineBuildSuccessRate}% success), ${pipeline.totalReleases} releases (${pipelineReleaseSuccessRate}% success), ${pipeline.avgBuildDuration.toFixed(1)} min avg`;
        });
      }
      
      return sprintSummary;
    }).join('\n\n') : 'No historical data available';
    
    let prompt = `You are an expert agile coach analyzing sprint data.

USER REQUEST: ${userMessage}

YOUR TASK: Generate a chart or table configuration to visualize the requested data.

======================================
WHAT YOU NEED TO DO:
======================================

→ This is NOT your job to generate actual charts/tables - the frontend app handles rendering
→ YOU generate a JSON configuration that tells the app WHAT to display
→ Use "chart" field for visual graphs (line, bar, pie, area)
→ Use "table" field for tabular data displays
→ Return ONLY the configuration, NO analysis text needed

======================================
AVAILABLE DATA (YOU HAVE FULL ACCESS):
======================================

${sprintMetadata}

ISSUES (${totalIssues} total) - ALL DATA IS HERE:
${issuesFormatted}

HISTORICAL TRENDS:
${historicalContext}

======================================
CHART GENERATION:
======================================

Data Structure:
\`\`\`typescript
interface Issue {
  key: string; summary: string; created: Date; storyPoints: number; subCategory: string;
  workStartedAt?: Date; completedAt?: Date;
  timeSpent: Record<string, number>; // Time spent in each board column (in business days) - e.g., { "In Progress": 2.5, "Review": 1.2 }
  flags?: { isBlocked, isIncidentResponse, isBackAndForth, isUnplanned, isInherited, isSpillover, isCompleted, isClosed };
  history: Array<{ inSprint: boolean; status: string; toString: string; at: Date; }>; // Status change history
}
interface SprintData { 
  sprint: { index: number; name: string; state: string; start: Date; end: Date; };
  columns: Array<{ name: string; }>;
  issues: Issue[]; 
  builds: Build[]; 
}

// Available data:
const allSprints: SprintData[];  // Array of all sprints (current sprint is LAST)

// Access patterns:
const currentSprint = allSprints[allSprints.length - 1];  // Current sprint (MOST COMMON)
const currentIssues = currentSprint.issues;  // Issues in current sprint
const historicalSprints = allSprints.slice(0, -1);  // All previous sprints

// Filter by sprint name (ONLY if user explicitly mentions a sprint name):
const specificSprint = allSprints.find(s => s.sprint.name.includes('PX 19'));  // Find by name
const specificSprint2 = allSprints.find(s => s.sprint.index === 19);  // Find by index

// Filter by sprint name pattern:
const matchingSprints = allSprints.filter(s => s.sprint.name.match(/PX \d+/));
\`\`\`

Chart Response Structure:
{
  "analysis": "Brief description of what the chart shows",
  "chart": {
    "type": "pie",  // or "line", "bar", "area"
    "title": "Issue Sub-Category Distribution",
    "dataTransform": "const currentSprint = allSprints[allSprints.length - 1]; const categories = {}; currentSprint.issues.forEach(i => { const cat = i.subCategory || 'Uncategorized'; categories[cat] = (categories[cat] || 0) + 1; }); return Object.entries(categories).map(([name, value]) => ({ name, value }));",
    "config": {
      "xAxisKey": "name",
      "dataKeys": [{ "key": "value", "name": "Issues" }]
    }
  }
}

Chart Examples:

1. Sub-category distribution (PIE) - Current sprint (MOST COMMON):
dataTransform: "const currentSprint = allSprints[allSprints.length - 1]; const categories = {}; currentSprint.issues.forEach(i => { const cat = i.subCategory || 'Uncategorized'; categories[cat] = (categories[cat] || 0) + 1; }); return Object.entries(categories).map(([name, value]) => ({ name, value }));"

2. Completion trend across all sprints (LINE):
dataTransform: "return allSprints.map(s => ({ name: s.sprint.name, completed: s.issues.filter(i => i.flags?.isCompleted).length }));"

3. Story points by category (BAR) - Current sprint:
dataTransform: "const currentSprint = allSprints[allSprints.length - 1]; const categories = {}; currentSprint.issues.forEach(i => { const cat = i.subCategory || 'Uncategorized'; categories[cat] = (categories[cat] || 0) + i.storyPoints; }); return Object.entries(categories).map(([name, points]) => ({ name, points }));"

4. Issue flags distribution (PIE) - Specific sprint by name:
dataTransform: "const sprint = allSprints.find(s => s.sprint.name.includes('PX 19')) || allSprints[allSprints.length - 1]; const flags = { Blocked: 0, Incident: 0, Spillover: 0, Completed: 0 }; sprint.issues.forEach(i => { if (i.flags?.isBlocked) flags.Blocked++; if (i.flags?.isIncidentResponse) flags.Incident++; if (i.flags?.isSpillover) flags.Spillover++; if (i.flags?.isCompleted) flags.Completed++; }); return Object.entries(flags).map(([name, value]) => ({ name, value }));"

5. Build success rate trend (LINE) - All sprints:
dataTransform: "return allSprints.map(s => { const total = s.builds.length; const passed = s.builds.filter(b => b.status === 'passed').length; return { name: s.sprint.name, successRate: total > 0 ? (passed / total * 100) : 0 }; });"

6. Compare specific sprints (BAR) - Filter by name pattern:
dataTransform: "const targetSprints = allSprints.filter(s => s.sprint.name.match(/PX (19|20|21)/)); return targetSprints.map(s => ({ name: s.sprint.name, completed: s.issues.filter(i => i.flags?.isCompleted).length, total: s.issues.length }));"

7. Average time spent by column (BAR) - Current sprint using timeSpent:
dataTransform: "const currentSprint = allSprints[allSprints.length - 1]; const columnTimes = {}; currentSprint.issues.forEach(i => { Object.entries(i.timeSpent || {}).forEach(([col, time]) => { if (!columnTimes[col]) columnTimes[col] = []; columnTimes[col].push(time); }); }); return Object.entries(columnTimes).map(([col, times]) => ({ name: col, avgTime: times.reduce((a, b) => a + b, 0) / times.length }));"

8. Cross-sprint blocked issues trend (LINE) - Filter issues across sprints:
dataTransform: "return allSprints.map(s => ({ name: s.sprint.name, blockedIssues: s.issues.filter(i => i.flags?.isBlocked).length, totalIssues: s.issues.length }));"

9. Incident issues across sprints (PIE) - Aggregate filtered issues:
dataTransform: "const incidents = allSprints.map(s => s.issues.filter(i => i.flags?.isIncidentResponse)).flat(); const byCategory = {}; incidents.forEach(i => { const cat = i.subCategory || 'Uncategorized'; byCategory[cat] = (byCategory[cat] || 0) + 1; }); return Object.entries(byCategory).map(([name, value]) => ({ name, value }));"

======================================
TABLE GENERATION:
======================================

Table structure:
{
  "title": "Table Title",
  "dataTransform": "JavaScript code here",
  "columns": [
    { "field": "key", "headerName": "Issue Key", "width": 120, "type": "string" },
    { "field": "summary", "headerName": "Summary", "width": 300, "type": "string" },
    { "field": "points", "headerName": "Points", "width": 100, "type": "number" }
  ]
}

Table Examples:

1. Top 10 issues by cycle time (TABLE):
dataTransform: "const currentSprint = allSprints[allSprints.length - 1]; const issuesWithCycleTime = currentSprint.issues.filter(i => i.workStartedAt && i.completedAt).map(i => ({ key: i.key, summary: i.summary, cycleTime: Math.round((new Date(i.completedAt).getTime() - new Date(i.workStartedAt).getTime()) / (1000 * 60 * 60 * 24) * 10) / 10 })).sort((a, b) => b.cycleTime - a.cycleTime).slice(0, 10); return issuesWithCycleTime;"
columns: [{ field: "key", headerName: "Issue", width: 120 }, { field: "summary", headerName: "Summary", width: 300 }, { field: "cycleTime", headerName: "Cycle Time (days)", width: 150, type: "number" }]

2. Blocked issues across all sprints (TABLE):
dataTransform: "const blocked = allSprints.map(s => s.issues.filter(i => i.flags?.isBlocked).map(i => ({ sprint: s.sprint.name, key: i.key, summary: i.summary, category: i.subCategory }))).flat(); return blocked;"
columns: [{ field: "sprint", headerName: "Sprint", width: 120 }, { field: "key", headerName: "Issue", width: 120 }, { field: "summary", headerName: "Summary", width: 250 }, { field: "category", headerName: "Category", width: 150 }]

3. Issues with most time in specific column (TABLE):
dataTransform: "const currentSprint = allSprints[allSprints.length - 1]; const issues = currentSprint.issues.map(i => ({ key: i.key, summary: i.summary, ...i.timeSpent })).sort((a, b) => (b['In Progress'] || 0) - (a['In Progress'] || 0)).slice(0, 10); return issues;"
columns: [{ field: "key", headerName: "Issue", width: 120 }, { field: "summary", headerName: "Summary", width: 250 }, { field: "In Progress", headerName: "Time In Progress (days)", width: 180, type: "number" }]

======================================
RESPONSE FORMAT:
======================================

For chart requests:
{
  "chart": {
    "type": "pie" | "line" | "bar" | "area",
    "title": "Clear descriptive title",
    "dataTransform": "JavaScript code",
    "config": { /* ... */ }
  }
}

For table requests:
{
  "table": {
    "title": "Clear descriptive title",
    "dataTransform": "JavaScript code",
    "columns": [ /* ... */ ]
    // NO rows field needed, the table will be generated based on the dataTransform
  }
}

CRITICAL RULES:
1. ONLY use allSprints variable - no other data available
2. Default to current sprint: allSprints[allSprints.length - 1]
3. Filter by sprint name/index ONLY if user explicitly mentions it (e.g., "PX 19", "sprint 19")
4. Use allSprints.find() or .filter() to find specific sprints
5. DO NOT check for data availability - app handles this automatically
6. Return ONLY valid JSON (no markdown, no code blocks, no extra text)
7. Chart/table titles should describe WHAT is shown, not data availability
8. NO "analysis" field needed - visualization speaks for itself
9. NEVER provide data by yourself, the data in the prompt is only used for better javascript code generation`;

    return prompt;
  }

  private buildQuestionPrompt(request: LLMAnalysisRequest): string {
    const { sprintData, userMessage, stats, historicalStats } = request;
    
    // Use provided stats from frontend if available, otherwise calculate
    const totalIssues = stats?.totalIssues ?? sprintData.issues.length;
    const totalPoints = stats?.totalPoints ?? sprintData.issues.reduce((sum, issue) => sum + issue.storyPoints, 0);
    const completedIssues = stats?.completedIssues ?? 0;
    const completedPoints = stats?.completedPoints ?? 0;
    const backAndForthIssues = stats?.backAndForthIssues ?? 0;
    const incidentIssues = stats?.incidentIssues ?? 0;
    const totalBuilds = stats?.totalBuilds ?? sprintData.builds.length;
    const totalReleases = stats?.totalReleases ?? 0;
    const successfulBuilds = stats?.successfulBuilds ?? 0;
    const successfulReleases = stats?.successfulReleases ?? 0;
    const avgBuildDuration = stats?.avgBuildDuration ?? 0;
    const deploymentFrequency = stats?.deploymentFrequency ?? 0;
    const medianLeadTime = stats?.medianLeadTime ?? 0;
    const changeFailureRate = stats?.changeFailureRate ?? 0;
    const medianMTTR = stats?.medianMTTR ?? 0;
    
    // Calculate rates for display
    const buildSuccessRate = totalBuilds > 0 ? ((successfulBuilds / totalBuilds) * 100).toFixed(1) : '0';
    const releaseSuccessRate = totalReleases > 0 ? ((successfulReleases / totalReleases) * 100).toFixed(1) : '0';
    
    // Format sprint metadata and statistics
    const completionRate = totalIssues > 0 ? ((completedIssues / totalIssues) * 100).toFixed(1) : '0';
    const pointsCompletionRate = totalPoints > 0 ? ((completedPoints / totalPoints) * 100).toFixed(1) : '0';
    
    const sprintMetadata = `CURRENT SPRINT:
Name: ${sprintData.sprint.name} (Index: ${sprintData.sprint.index})
State: ${sprintData.sprint.state}
Duration: ${new Date(sprintData.sprint.start).toLocaleDateString()} - ${new Date(sprintData.sprint.end).toLocaleDateString()}

STATISTICS:
- Total Issues: ${totalIssues} (${totalPoints} story points)
- Completed: ${completedIssues} issues (${completedPoints} story points)
- Completion Rate: ${completionRate}% of issues, ${pointsCompletionRate}% of points
- Back-and-forth Issues: ${backAndForthIssues}
- Incidents: ${incidentIssues}

BUILD & RELEASE STATISTICS:
- Total Builds: ${totalBuilds} (${successfulBuilds} successful = ${buildSuccessRate}%)
- Total Releases: ${totalReleases} (${successfulReleases} successful = ${releaseSuccessRate}%)
- Average Build Duration: ${avgBuildDuration.toFixed(1)} minutes
${stats?.buildSummaryByPipeline && stats.buildSummaryByPipeline.length > 0 ? `
BUILD & RELEASE BY PIPELINE:
${stats.buildSummaryByPipeline.map(pipeline => {
  const pipelineBuildSuccessRate = pipeline.totalBuilds > 0 ? ((pipeline.successfulBuilds / pipeline.totalBuilds) * 100).toFixed(1) : '0';
  const pipelineReleaseSuccessRate = pipeline.totalReleases > 0 ? ((pipeline.successfulReleases / pipeline.totalReleases) * 100).toFixed(1) : '0';
  return `- ${pipeline.pipelineName} (${pipeline.repository}):
  Builds: ${pipeline.totalBuilds} (${pipeline.successfulBuilds} successful = ${pipelineBuildSuccessRate}%)
  Releases: ${pipeline.totalReleases} (${pipeline.successfulReleases} successful = ${pipelineReleaseSuccessRate}%)
  Avg Duration: ${pipeline.avgBuildDuration.toFixed(1)} min`;
}).join('\n')}` : ''}

DORA METRICS:
- Deployment Frequency: ${deploymentFrequency.toFixed(2)} releases/day
- Lead Time for Changes: ${medianLeadTime.toFixed(1)} days (median cycle time)
- Change Failure Rate: ${changeFailureRate.toFixed(1)}% (incidents per successful release)
- Mean Time to Restore: ${medianMTTR.toFixed(1)} hours (median incident resolution time)

BOARD COLUMNS:
${sprintData.columns.map(col => col.name).join(' → ')}`;

    // Format issues as readable text
    const issuesFormatted = sprintData.issues.map(issue => {
      const statusChanges = issue.history.filter(h => h.inSprint);
      const flow = statusChanges.length > 0 
        ? statusChanges.map(h => `${h.toString} (${new Date(h.at).toLocaleDateString()})`).join(' -> ')
        : 'No status changes';
      
      const createdDate = new Date(issue.created).toLocaleDateString();
      const startedDate = issue.workStartedAt ? new Date(issue.workStartedAt).toLocaleDateString() : 'Not started';
      const completedDate = issue.completedAt ? new Date(issue.completedAt).toLocaleDateString() : 'Not completed';
      
      // Format flags
      const flags = [];
      if (issue.flags?.isCompleted) flags.push('Completed');
      if (issue.flags?.isClosed) flags.push('Closed');
      if (issue.flags?.isBlocked) flags.push('Blocked');
      if (issue.flags?.isIncidentResponse) flags.push('Incident');
      if (issue.flags?.isBackAndForth) flags.push('Back-and-forth');
      if (issue.flags?.isUnplanned) flags.push('Unplanned');
      if (issue.flags?.isInherited) flags.push('Inherited');
      if (issue.flags?.isSpillover) flags.push('Spillover');
      const flagsText = flags.length > 0 ? ` | Flags: ${flags.join(', ')}` : '';
      
      const timeSpentText = Object.entries(issue.timeSpent || {}).map(([col, time]) => `${col}: ${(time as number).toFixed(1)}d`).join(', ');
      
      return `[${issue.key}] ${issue.summary}
  Points: ${issue.storyPoints} | Category: ${issue.subCategory || 'None'}${flagsText}
  Created: ${createdDate} | Started: ${startedDate} | Completed: ${completedDate}
  Time Spent in Columns: { ${timeSpentText} }
  Flow: ${flow} (NOTE: Flow shows only status changes within the sprint)`;
    }).join('\n\n');
    
    // Build historical context using historicalStats
    const historicalContext = historicalStats && historicalStats.length > 0 ? historicalStats.map(hist => {
      const completionRate = hist.totalIssues > 0 ? ((hist.completedIssues / hist.totalIssues) * 100).toFixed(1) : '0';
      const buildSuccessRate = hist.totalBuilds > 0 ? ((hist.successfulBuilds / hist.totalBuilds) * 100).toFixed(1) : '0';
      const releaseSuccessRate = hist.totalReleases > 0 ? ((hist.successfulReleases / hist.totalReleases) * 100).toFixed(1) : '0';
      
      let sprintSummary = `Sprint ${hist.sprintIndex} (${hist.sprintName}):
  - Issues: ${hist.totalIssues} (${hist.totalPoints} points) → ${hist.completedIssues} completed (${hist.completedPoints} points) = ${completionRate}% completion
  - Builds: ${hist.totalBuilds} (${hist.successfulBuilds} successful = ${buildSuccessRate}%)
  - Releases: ${hist.totalReleases} (${hist.successfulReleases} successful = ${releaseSuccessRate}%)
  - DORA: DF=${hist.deploymentFrequency.toFixed(2)} releases/day, LT=${hist.medianLeadTime.toFixed(1)} days, CFR=${hist.changeFailureRate.toFixed(1)}%, MTTR=${hist.medianMTTR.toFixed(1)} hours`;
      
      // Add build summary by pipeline if available
      if (hist.buildSummaryByPipeline && hist.buildSummaryByPipeline.length > 0) {
        sprintSummary += '\n  Build/Release by Pipeline:';
        hist.buildSummaryByPipeline.forEach(pipeline => {
          const pipelineBuildSuccessRate = pipeline.totalBuilds > 0 ? ((pipeline.successfulBuilds / pipeline.totalBuilds) * 100).toFixed(1) : '0';
          const pipelineReleaseSuccessRate = pipeline.totalReleases > 0 ? ((pipeline.successfulReleases / pipeline.totalReleases) * 100).toFixed(1) : '0';
          sprintSummary += `\n    - ${pipeline.pipelineName} (${pipeline.repository}): ${pipeline.totalBuilds} builds (${pipelineBuildSuccessRate}% success), ${pipeline.totalReleases} releases (${pipelineReleaseSuccessRate}% success), ${pipeline.avgBuildDuration.toFixed(1)} min avg`;
        });
      }
      
      return sprintSummary;
    }).join('\n\n') : 'No historical data available';
    
    let prompt = `You are an expert agile coach with deep knowledge of sprint metrics and team dynamics.

USER QUESTION: ${userMessage}

YOUR TASK: Answer the user's question about the sprint data using the information provided below.

======================================
SPRINT DATA:
======================================

${sprintMetadata}

ISSUES (${totalIssues} total):
${issuesFormatted}

HISTORICAL TRENDS:
${historicalContext}

======================================
RESPONSE FORMAT:
======================================

Return a JSON object with:
{
  "analysis": "Your answer to the user's question in plain text (no markdown)"
}

GUIDELINES:
1. Answer concisely and directly based on the data provided
2. Use specific numbers and metrics when relevant
3. Provide context from historical data when applicable
4. If asked about trends, compare current sprint to historical data
5. Use plain text only (no markdown formatting)`;

    return prompt;
  }

  private async invokeModel(prompt: string): Promise<string> {
    const input = {
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    };

    const command = new InvokeModelCommand(input);
    const response = await this.client.send(command);
    
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.content[0].text;
  }

  private async invokeModelWithHistory(
    prompt: string, 
    chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    // Build messages array with chat history
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    
    // Add previous chat history if available
    if (chatHistory && chatHistory.length > 0) {
      messages.push(...chatHistory);
    }
    
    // Add the current user message with context
    messages.push({
      role: 'user',
      content: prompt
    });

    const input = {
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4000,
        messages
      })
    };

    const command = new InvokeModelCommand(input);
    const response = await this.client.send(command);
    
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.content[0].text;
  }

  private parseAnalysisResponse(response: string): LLMAnalysisResponse {
    try {
      // Try to parse as JSON first
      // Remove potential markdown code blocks if present
      let cleanedResponse = response.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const parsed = JSON.parse(cleanedResponse);
      
      const result: any = {};
      
      // Analysis is optional (especially for chart-only responses)
      if (parsed.analysis) {
        result.analysis = parsed.analysis;
      }
      
      // Insights and recommendations are optional (only for sprint analysis)
      if (Array.isArray(parsed.insights) && parsed.insights.length > 0) {
        result.insights = parsed.insights;
      } else if (parsed.insights !== undefined) {
        // Only provide defaults if explicitly present but empty
        result.insights = ['No specific insights identified'];
      }
      
      if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
        result.recommendations = parsed.recommendations;
      } else if (parsed.recommendations !== undefined) {
        // Only provide defaults if explicitly present but empty
        result.recommendations = ['No specific recommendations provided'];
      }
      
        // Include chart if present
        if (parsed.chart) {
          result.chart = parsed.chart;
        }
        
        // Include table if present
        if (parsed.table) {
          result.table = parsed.table;
        }
        
        return result;
    } catch (error) {
      // Fallback to heuristic parsing if JSON parsing fails
      console.warn('Failed to parse JSON response, falling back to heuristic parsing:', error);
    const lines = response.split('\n');
    const analysis = lines.join('\n');
    
    const insights: string[] = [];
    const recommendations: string[] = [];
    
    lines.forEach(line => {
      if (line.includes('insight') || line.includes('pattern') || line.includes('trend')) {
        insights.push(line.trim());
      }
      if (line.includes('recommend') || line.includes('suggest') || line.includes('should')) {
        recommendations.push(line.trim());
      }
    });

    // Note: Chart field is not supported in fallback parsing as it requires structured JSON
    return {
      analysis,
      insights: insights.length > 0 ? insights : ['No specific insights identified'],
      recommendations: recommendations.length > 0 ? recommendations : ['No specific recommendations provided']
    };
    }
  }
}
