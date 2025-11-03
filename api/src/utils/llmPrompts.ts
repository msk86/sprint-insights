import { LLMAnalysisRequest } from '../types';

// Helper function to format sprint metadata
function formatSprintMetadata(sprintData: any, stats: any): string {
  const totalIssues = stats?.totalIssues ?? sprintData.issues.length;
  const totalPoints = stats?.totalPoints ?? sprintData.issues.reduce((sum: number, issue: any) => sum + issue.storyPoints, 0);
  const completedIssues = stats?.completedIssues ?? 0;
  const completedPoints = stats?.completedPoints ?? 0;
  const completionRate = totalIssues > 0 ? ((completedIssues / totalIssues) * 100).toFixed(1) : '0';
  const pointsCompletionRate = totalPoints > 0 ? ((completedPoints / totalPoints) * 100).toFixed(1) : '0';
  
  return `<section name="CURRENT SPRINT">
Name: ${sprintData.sprint.name} (Index: ${sprintData.sprint.index})
State: ${sprintData.sprint.state}
Duration: ${new Date(sprintData.sprint.start).toLocaleDateString()} - ${new Date(sprintData.sprint.end).toLocaleDateString()}
</section>`;
}

// Helper function to format statistics
function formatStatistics(stats: any, sprintData: any): string {
  const totalIssues = stats?.totalIssues ?? sprintData.issues.length;
  const totalPoints = stats?.totalPoints ?? sprintData.issues.reduce((sum: number, issue: any) => sum + issue.storyPoints, 0);
  const completedIssues = stats?.completedIssues ?? 0;
  const completedPoints = stats?.completedPoints ?? 0;
  const backAndForthIssues = stats?.backAndForthIssues ?? 0;
  const incidentIssues = stats?.incidentIssues ?? 0;
  const completionRate = totalIssues > 0 ? ((completedIssues / totalIssues) * 100).toFixed(1) : '0';
  const pointsCompletionRate = totalPoints > 0 ? ((completedPoints / totalPoints) * 100).toFixed(1) : '0';
  
  return `<section name="STATISTICS">
- Total Issues: ${totalIssues} (${totalPoints} story points)
- Completed: ${completedIssues} issues (${completedPoints} points)
- Completion Rate: ${completionRate}% of issues, ${pointsCompletionRate}% of points
- Back-and-forth Issues: ${backAndForthIssues}
- Incidents: ${incidentIssues}
</section>`;
}

// Helper function to format build & release statistics
function formatBuildReleaseStats(stats: any, sprintData: any): string {
  const totalBuilds = stats?.totalBuilds ?? sprintData.builds.length;
  const totalReleases = stats?.totalReleases ?? 0;
  const successfulBuilds = stats?.successfulBuilds ?? 0;
  const successfulReleases = stats?.successfulReleases ?? 0;
  const avgBuildDuration = stats?.avgBuildDuration ?? 0;
  const buildSuccessRate = totalBuilds > 0 ? ((successfulBuilds / totalBuilds) * 100).toFixed(1) : '0';
  const releaseSuccessRate = totalReleases > 0 ? ((successfulReleases / totalReleases) * 100).toFixed(1) : '0';
  
  return `<section name="BUILD & RELEASE STATISTICS">
- Total Builds: ${totalBuilds} (${successfulBuilds} successful = ${buildSuccessRate}%)
- Total Releases: ${totalReleases} (${successfulReleases} successful = ${releaseSuccessRate}%)
- Average Build Duration: ${avgBuildDuration.toFixed(1)} minutes
</section>`;
}

// Helper function to format build summary by pipeline
function formatBuildSummaryByPipeline(stats: any): string {
  if (!stats?.buildSummaryByPipeline || stats.buildSummaryByPipeline.length === 0) {
    return '';
  }
  
  const pipelineSummaries = stats.buildSummaryByPipeline.map((pipeline: any) => {
    const pipelineBuildSuccessRate = pipeline.totalBuilds > 0 
      ? ((pipeline.successfulBuilds / pipeline.totalBuilds) * 100).toFixed(1) 
      : '0';
    const pipelineReleaseSuccessRate = pipeline.totalReleases > 0 
      ? ((pipeline.successfulReleases / pipeline.totalReleases) * 100).toFixed(1) 
      : '0';
    return `- ${pipeline.pipelineName} (${pipeline.repository}):
  Builds: ${pipeline.totalBuilds} (${pipeline.successfulBuilds} successful = ${pipelineBuildSuccessRate}%)
  Releases: ${pipeline.totalReleases} (${pipeline.successfulReleases} successful = ${pipelineReleaseSuccessRate}%)
  Avg Duration: ${pipeline.avgBuildDuration.toFixed(1)} min`;
  }).join('\n');
  
  return `
<section name="BUILD & RELEASE BY PIPELINE">
${pipelineSummaries}
</section>`;
}

// Helper function to format DORA metrics
function formatDoraMetrics(stats: any): string {
  const deploymentFrequency = stats?.deploymentFrequency ?? 0;
  const medianLeadTime = stats?.medianLeadTime ?? 0;
  const changeFailureRate = stats?.changeFailureRate ?? 0;
  const medianMTTR = stats?.medianMTTR ?? 0;
  
  return `<section name="DORA METRICS">
- Deployment Frequency: ${deploymentFrequency.toFixed(2)} releases/day
- Lead Time for Changes: ${medianLeadTime.toFixed(1)} days (median cycle time)
- Change Failure Rate: ${changeFailureRate.toFixed(1)}% (incidents per successful release)
- Mean Time to Restore: ${medianMTTR.toFixed(1)} hours (median incident resolution time)
</section>`;
}

// Helper function to format board columns
function formatBoardColumns(sprintData: any): string {
  return `<section name="BOARD COLUMNS">
${sprintData.columns.map((col: any) => col.name).join(' → ')}
</section>`;
}

// Helper function to format issues
function formatIssues(sprintData: any, includeTimeSpent: boolean = false): string {
  return sprintData.issues.map((issue: any) => {
    const statusChanges = issue.history.filter((h: any) => h.inSprint);
    const flow = statusChanges.length > 0 
      ? statusChanges.map((h: any) => `${h.toString} (${new Date(h.at).toLocaleDateString()})`).join(' -> ')
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
    
    let result = `[${issue.key}] ${issue.summary}
  Points: ${issue.storyPoints} | Category: ${issue.subCategory || 'None'}${flagsText}
  Created: ${createdDate} | Started: ${startedDate} | Completed: ${completedDate}`;
    
    // Add time spent if requested
    if (includeTimeSpent && issue.timeSpent) {
      const timeSpentText = Object.entries(issue.timeSpent).map(([col, time]) => `${col}: ${(time as number).toFixed(1)}d`).join(', ');
      result += `\n  Time Spent in Columns: { ${timeSpentText} }`;
    }
    
    result += `\n  Flow: ${flow} (NOTE: Flow shows only status changes within the sprint)`;
    
    return result;
  }).join('\n\n');
}

// Helper function to format historical context
function formatHistoricalContext(historicalStats: any[] | undefined): string {
  if (!historicalStats || historicalStats.length === 0) {
    return 'No historical data available';
  }
  
  return historicalStats.map((hist: any) => {
    const completionRate = hist.totalIssues > 0 
      ? ((hist.completedIssues / hist.totalIssues) * 100).toFixed(1) 
      : '0';
    const buildSuccessRate = hist.totalBuilds > 0 
      ? ((hist.successfulBuilds / hist.totalBuilds) * 100).toFixed(1) 
      : '0';
    const releaseSuccessRate = hist.totalReleases > 0 
      ? ((hist.successfulReleases / hist.totalReleases) * 100).toFixed(1) 
      : '0';
    
    let sprintSummary = `Sprint ${hist.sprintIndex} (${hist.sprintName}):
  - Issues: ${hist.totalIssues} (${hist.totalPoints} points) → ${hist.completedIssues} completed (${hist.completedPoints} points) = ${completionRate}% completion
  - Builds: ${hist.totalBuilds} (${hist.successfulBuilds} successful = ${buildSuccessRate}%)
  - Releases: ${hist.totalReleases} (${hist.successfulReleases} successful = ${releaseSuccessRate}%)
  - DORA: DF=${hist.deploymentFrequency.toFixed(2)} releases/day, LT=${hist.medianLeadTime.toFixed(1)} days, CFR=${hist.changeFailureRate.toFixed(1)}%, MTTR=${hist.medianMTTR.toFixed(1)} hours`;
    
    // Add build summary by pipeline if available
    if (hist.buildSummaryByPipeline && hist.buildSummaryByPipeline.length > 0) {
      sprintSummary += '\n  Build/Release by Pipeline:';
      hist.buildSummaryByPipeline.forEach((pipeline: any) => {
        const pipelineBuildSuccessRate = pipeline.totalBuilds > 0 
          ? ((pipeline.successfulBuilds / pipeline.totalBuilds) * 100).toFixed(1) 
          : '0';
        const pipelineReleaseSuccessRate = pipeline.totalReleases > 0 
          ? ((pipeline.successfulReleases / pipeline.totalReleases) * 100).toFixed(1) 
          : '0';
        sprintSummary += `\n    - ${pipeline.pipelineName} (${pipeline.repository}): ${pipeline.totalBuilds} builds (${pipelineBuildSuccessRate}% success), ${pipeline.totalReleases} releases (${pipelineReleaseSuccessRate}% success), ${pipeline.avgBuildDuration.toFixed(1)} min avg`;
      });
    }
    
    return sprintSummary;
  }).join('\n\n');
}

// Helper function to build complete sprint context
function buildSprintContext(sprintData: any, stats: any, historicalStats: any[] | undefined, includeTimeSpent: boolean = false): string {
  const totalIssues = stats?.totalIssues ?? sprintData.issues.length;
  
  return `${formatSprintMetadata(sprintData, stats)}

${formatStatistics(stats, sprintData)}

${formatBuildReleaseStats(stats, sprintData)}${formatBuildSummaryByPipeline(stats)}

${formatDoraMetrics(stats)}

${formatBoardColumns(sprintData)}

<section name="ISSUES" count="${totalIssues}">
${formatIssues(sprintData, includeTimeSpent)}
</section>

<section name="HISTORICAL TRENDS">
${formatHistoricalContext(historicalStats)}
</section>`;
}

/**
 * Build the system message containing sprint data context (for questions).
 * This should be provided as the system message in the Messages API.
 */
export function buildSprintDataSystemMessage(
  sprintData: any, 
  stats: any, 
  historicalStats: any[] | undefined,
  includeTimeSpent: boolean = false
): string {
  const sprintContext = buildSprintContext(sprintData, stats, historicalStats, includeTimeSpent);
  
  return `<section name="SPRINT DATA FOR REFERENCE">
${sprintContext}

<section name="NOTE">
The data in <section name="SPRINT DATA FOR REFERENCE"> is provided as REFERENCE ONLY.
Use it to answer user questions accurately with specific data from above.
DO NOT fabricate data not present in <section name="SPRINT DATA FOR REFERENCE">.
</section>
</section>`;
}

/**
 * Build the system message for visualization (sprint data + interface specs).
 * This includes all the data structure, examples, and rules for generating charts/tables.
 */
export function buildVisualizationSystemMessage(
  sprintData: any, 
  stats: any, 
  historicalStats: any[] | undefined
): string {
  const sprintContext = buildSprintContext(sprintData, stats, historicalStats, false);
  
  return `<section name="SPRINT DATA FOR REFERENCE">
${sprintContext}

<section name="NOTE">
The data in <section name="SPRINT DATA FOR REFERENCE"> is provided as REFERENCE ONLY to help you:
- Match fuzzy sprint name or issue key to actual values (e.g., "PX 19" → sprint name)

DO NOT extract or use actual data values from <section name="SPRINT DATA FOR REFERENCE">.
Write JavaScript code that will access "allSprints" at runtime in the frontend.
</section>
</section>

<section name="VISUALIZATION INTERFACE SPECIFICATION">

<section name="DATA STRUCTURE">

Data Structure:
\`\`\`typescript
interface Issue {
  key: string; summary: string; created: Date; storyPoints: number; subCategory: string;
  workStartedAt?: Date; completedAt?: Date;
  timeSpent: Record<string, number>; // Time spent in each board column (in business days) - e.g., { "In Progress": 2.5, "Review": 1.2 }
  flags: { isBlocked, isIncidentResponse, isBackAndForth, isUnplanned, isInherited, isSpillover, isCompleted, isClosed }; // Boolean flags
  history: Array<{ fromString: string; toString: string; at: Date; inSprint: boolean }>; // Status change history
}
interface Build {
  pipelineName: string; repository: string; status: string; startedAt: string; finishedAt: string; duration: number; isRelease: boolean; isReleaseSuccess: boolean; inSprint: boolean;
}
interface SprintData { 
  sprint: { index: number; name: string; state: string; start: Date; end: Date; };
  columns: Array<{ name: string; }>;
  issues: Issue[]; 
  builds: Build[]; 
}
// Explaination for the inSprint field: It is to provide reference info about other sprints when do single sprint analysis, ideally you should filter the data by inSprint === true

// Available data:
const allSprints: SprintData[];  // Array of all sprints (current sprint is LAST)

// Access patterns:
const currentSprint = allSprints[0];  // Current sprint (MOST COMMON)
const recent2Sprints = allSprints.slice(-2);  // Recent 2 sprints (including current sprint)
const historicalSprints = allSprints.slice(0, -1);  // All previous sprints (excluding current sprint)
const currentIssues = currentSprint.issues;  // Issues in current sprint

// Filter sprints by sprint name (ONLY if user explicitly mentions a sprint name):
const specificSprint = allSprints.find(s => s.sprint.name.toLowerCase().includes('PX 19'.toLowerCase()));  // Find by name

// Find an Issue and its history by key (Issue might across multiple sprints so you must not pick only one item in the array):
const issues = allSprints.map(s => s.issues.find(i => i.key.toLowerCase() === 'PX-123'.toLowerCase()));  // Find by key
const histories = issues.map(i => i.history).flat().filter(h => h.inSprint);  // Get the history of the issue

// Find All Builds
const builds = allSprints.map(s => s.builds).flat().filter(b => b.inSprint);
\`\`\`

</section>

<section name="CHART GENERATION">

Chart Response Structure:
{
  "analysis": "Title of the chart",
  "chart": {
    "type": "pie",  // or "line", "bar", "area"
    "title": "Title of the chart",
    "dataTransform": "Javascript code that MUST include a return statement",
    "config": {
      "xAxisKey": "name",
      "dataKeys": [{ "key": "value", "name": "Issues" }]
    }
  }
}

Chart Examples:

1. Sub-category distribution (PIE) - Current sprint (MOST COMMON):
dataTransform: "const currentSprint = allSprints[0]; const categories = {}; currentSprint.issues.forEach(i => { const cat = i.subCategory || 'Uncategorized'; categories[cat] = (categories[cat] || 0) + 1; }); return Object.entries(categories).map(([name, value]) => ({ name, value }));"

2. Completion trend across all sprints (LINE):
dataTransform: "return allSprints.map(s => ({ name: s.sprint.name, completed: s.issues.filter(i => i.flags?.isCompleted).length }));"

3. Story points by category (BAR) - Current sprint:
dataTransform: "const currentSprint = allSprints[0]; const categories = {}; currentSprint.issues.forEach(i => { const cat = i.subCategory || 'Uncategorized'; categories[cat] = (categories[cat] || 0) + i.storyPoints; }); return Object.entries(categories).map(([name, points]) => ({ name, points }));"

4. Issue flags distribution (PIE) - Specific sprint by name:
dataTransform: "const sprint = allSprints.find(s => s.sprint.name.includes('PX 19')) || allSprints[0]; const flags = { Blocked: 0, Incident: 0, Spillover: 0, Completed: 0 }; sprint.issues.forEach(i => { if (i.flags?.isBlocked) flags.Blocked++; if (i.flags?.isIncidentResponse) flags.Incident++; if (i.flags?.isSpillover) flags.Spillover++; if (i.flags?.isCompleted) flags.Completed++; }); return Object.entries(flags).map(([name, value]) => ({ name, value }));"

5. Build success rate trend (LINE) - All sprints:
dataTransform: "return allSprints.map(s => { const builds = s.builds.filter(b => b.inSprint); const total = builds.length; const passed = builds.filter(b => b.status === 'passed').length; return { name: s.sprint.name, successRate: total > 0 ? (passed / total * 100) : 0 }; });"

6. Compare specific sprints (BAR) - Filter by name pattern:
dataTransform: "const targetSprints = allSprints.filter(s => s.sprint.name.match(/PX (19|20|21)/)); return targetSprints.map(s => ({ name: s.sprint.name, completed: s.issues.filter(i => i.flags?.isCompleted).length, total: s.issues.length }));"

7. Average time spent by column (BAR) - Current sprint using timeSpent:
dataTransform: "const currentSprint = allSprints[0]; const columnTimes = {}; currentSprint.issues.forEach(i => { Object.entries(i.timeSpent || {}).forEach(([col, time]) => { if (!columnTimes[col]) columnTimes[col] = []; columnTimes[col].push(time); }); }); return Object.entries(columnTimes).map(([col, times]) => ({ name: col, avgTime: times.reduce((a, b) => a + b, 0) / times.length }));"

8. Cross-sprint blocked issues trend (LINE) - Filter issues across sprints:
dataTransform: "return allSprints.map(s => ({ name: s.sprint.name, blockedIssues: s.issues.filter(i => i.flags?.isBlocked).length, totalIssues: s.issues.length }));"

9. Incident issues across sprints (PIE) - Aggregate filtered issues:
dataTransform: "const incidents = allSprints.map(s => s.issues.filter(i => i.flags?.isIncidentResponse)).flat(); const byCategory = {}; incidents.forEach(i => { const cat = i.subCategory || 'Uncategorized'; byCategory[cat] = (byCategory[cat] || 0) + 1; }); return Object.entries(byCategory).map(([name, value]) => ({ name, value }));"

</section>

<section name="TABLE GENERATION">

Table structure:
{
  "analysis": "Title of the table",
  "table": {
    "title": "Title of the table",
    "dataTransform": "JavaScript code that MUST include a return statement",
    "columns": [
      { "field": "key", "headerName": "Issue Key", "width": 120, "type": "string" },
      { "field": "summary", "headerName": "Summary", "width": 300, "type": "string" },
      { "field": "points", "headerName": "Points", "width": 100, "type": "number" }
    ]
  }
}

Table Examples:

1. Top 10 issues by cycle time (TABLE):
dataTransform: "const currentSprint = allSprints[0]; const issuesWithCycleTime = currentSprint.issues.filter(i => i.workStartedAt && i.completedAt).map(i => ({ key: i.key, summary: i.summary, cycleTime: Math.round((new Date(i.completedAt).getTime() - new Date(i.workStartedAt).getTime()) / (1000 * 60 * 60 * 24) * 10) / 10 })).sort((a, b) => b.cycleTime - a.cycleTime).slice(0, 10); return issuesWithCycleTime;"
columns: [{ field: "key", headerName: "Issue", width: 120 }, { field: "summary", headerName: "Summary", width: 300 }, { field: "cycleTime", headerName: "Cycle Time (days)", width: 150, type: "number" }]

2. Blocked issues across all sprints (TABLE):
dataTransform: "const blocked = allSprints.map(s => s.issues.filter(i => i.flags?.isBlocked).map(i => ({ sprint: s.sprint.name, key: i.key, summary: i.summary, category: i.subCategory }))).flat(); return blocked;"
columns: [{ field: "sprint", headerName: "Sprint", width: 120 }, { field: "key", headerName: "Issue", width: 120 }, { field: "summary", headerName: "Summary", width: 250 }, { field: "category", headerName: "Category", width: 150 }]

3. Issues with most time in specific column (TABLE):
dataTransform: "const currentSprint = allSprints[0]; const issues = currentSprint.issues.map(i => ({ key: i.key, summary: i.summary, ...i.timeSpent })).sort((a, b) => (b['In Progress'] || 0) - (a['In Progress'] || 0)).slice(0, 10); return issues;"
columns: [{ field: "key", headerName: "Issue", width: 120 }, { field: "summary", headerName: "Summary", width: 250 }, { field: "In Progress", headerName: "Time In Progress (days)", width: 180, type: "number" }]

</section>

<section name="RESPONSE FORMAT">

For chart requests:
{
  "analysis": "Title of the chart",
  "chart": {
    "type": "pie" | "line" | "bar" | "area",
    "title": "Clear descriptive title",
    "dataTransform": "JavaScript code (MUST include return statement)",
    "config": { /* ... */ }
  }
}

For table requests:
{
  "analysis": "Title of the table",
  "table": {
    "title": "Clear descriptive title",
    "dataTransform": "JavaScript code (MUST include return statement)",
    "columns": [ /* ... */ ]
  }
}

</section>

<section name="CRITICAL RULES">

1. Write JavaScript code that operates on "allSprints" variable (available at runtime)
2. Default to current sprint: allSprints[0]
3. Filter by sprint name/index ONLY if user explicitly mentions it (e.g., "PX 19", "sprint 19")
4. Use allSprints.find() or .filter() to find specific sprints
5. DO NOT check for data availability - app handles this automatically
6. Return ONLY valid JSON (no markdown, no code blocks, no extra text)
7. Chart/table titles should describe WHAT is shown, not data availability
8. NO "analysis" field needed if chart/table is present - visualization speaks for itself
9. Data in <section name="SPRINT DATA FOR REFERENCE"> is REFERENCE ONLY - use it to understand structure/names, not extract values
10. Your dataTransform code will execute in frontend - focus on correct logic, not data extraction
11. CRITICAL: dataTransform MUST always include a "return" statement

</section>

</section>`;
}

/**
 * Build system message for sprint analysis (sprint data only).
 * This is the same as buildSprintDataSystemMessage but kept separate for clarity.
 */
export function buildSprintAnalysisSystemMessage(
  sprintData: any, 
  stats: any, 
  historicalStats: any[] | undefined
): string {
  return buildSprintDataSystemMessage(sprintData, stats, historicalStats, false);
}

/**
 * Build the sprint analysis prompt (simplified - sprint data is in system message).
 */
export function buildSprintAnalysisPrompt(): string {
  return `<section name="YOUR TASK">
You are an expert agile coach and sprint analyst. Analyze the sprint data provided in the SYSTEM PROMPT and provide insights and recommendations.
</section>

<section name="ANALYSIS FOCUS">
1. Sprint performance metrics (throughput, velocity, completion rate)
2. Quality indicators (back-and-forth issues, incidents)
3. Issue flow patterns and bottlenecks (status changes, time in columns)
4. Work distribution (story points, sub-categories)
5. Trends compared to historical data
6. Actionable recommendations for improvement
</section>

<section name="RESPONSE FORMAT">
You must respond with a valid JSON object (not markdown, no code blocks):
{
  "analysis": "Your comprehensive analysis in plain text (2-3 paragraphs)",
  "insights": [
    "1st key insight in plain text",
    "2nd key insight in plain text",
    "3rd key insight in plain text"
  ],
  "recommendations": [
    "1st actionable recommendation in plain text",
    "2nd actionable recommendation in plain text",
    "3rd actionable recommendation in plain text",
    "4th actionable recommendation in plain text",
    "5th actionable recommendation in plain text"
  ]
}

CRITICAL: Return ONLY the JSON object. No markdown code blocks. All text fields are plain text without markdown formatting.
</section>`;
}

/**
 * Build visualization prompt (simplified - interface specs are in system message).
 * Sprint data and all interface specifications are in the system message.
 */
export function buildVisualizationPrompt(userMessage: string): string {
  return `<section name="USER REQUEST">
${userMessage}
</section>

<section name="YOUR TASK">
You are an expert agile coach. Generate a chart or table configuration to visualize the requested data.

→ Sprint data is in the SYSTEM PROMPT for reference
→ Interface specifications (data structure, examples, rules) are in the SYSTEM PROMPT
→ DEFAULT: When user doesn't specify a sprint, use CURRENT SPRINT (allSprints[0])
→ DEFAULT: When user specify a issue, get issue across multiple sprints (allSprints.map(s => s.issues.find(i => i.key.toLowerCase() === 'PX-123'.toLowerCase())))
→ Return ONLY the JSON configuration, NO analysis text needed
</section>`;
}

/**
 * Build question prompt (simplified - sprint data is in system message).
 * Sprint data is always provided in the system message.
 */
export function buildQuestionPrompt(userMessage: string): string {
  return `<section name="USER QUESTION">
${userMessage}
</section>

<section name="CONTEXT">
→ Sprint data is in the SYSTEM PROMPT (current sprint + historical sprints)
→ Previous chart/table configurations (if any) are in the CHAT HISTORY
→ You can reference previous visualizations when answering questions
→ DEFAULT: When user doesn't specify a sprint, use the CURRENT SPRINT as context
</section>

<section name="YOUR TASK">
You are an expert agile coach with deep knowledge of sprint metrics and team dynamics.

Answer the user's question about the sprint data provided in the SYSTEM PROMPT.
- If user asks about "this sprint" or doesn't specify: use the CURRENT SPRINT
- If user mentions a specific sprint name/number: use that sprint
- If user asks about trends or comparisons: compare current sprint to historical data
- If user asks about a previously generated chart/table: reference the configuration from chat history
</section>

<section name="RESPONSE FORMAT">
Return a JSON object with:
{
  "analysis": "Your answer to the user's question in plain text (no markdown)"
}
</section>

<section name="CRITICAL GUIDELINES">
1. Answer concisely and directly based ONLY on the data provided in the SYSTEM PROMPT
2. Use specific numbers and metrics when relevant
3. Provide context from historical data when applicable
4. If asked about trends, compare current sprint to historical data
5. Use plain text only (no markdown formatting)
6. NEVER fabricate or make up data (dates, numbers, names, etc.)
7. If specific information is not available in the SYSTEM PROMPT, explicitly state that you don't have that information
8. When referencing previous charts/tables, refer to the configuration in the chat history
</section>`;
}
