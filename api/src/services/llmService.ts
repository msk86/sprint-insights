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

IMPORTANT: You must respond with a valid JSON object (not markdown, no code blocks) in exactly this format:
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

CRITICAL: Return ONLY the JSON object. Do not use markdown code blocks or any other formatting. All text fields should be plain text without markdown formatting.`;

    return prompt;
  }

  private buildFreeChatPrompt(request: LLMAnalysisRequest): string {
    const { sprintData, userMessage, stats, chatHistory, historicalStats } = request;
    
    // If there's chat history, only send the user message (context was sent in first message)
    if (chatHistory && chatHistory.length > 0) {
      return userMessage || '';
    }
    
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
    
    let prompt = `You are an expert agile coach helping with sprint analysis. You have access to comprehensive sprint data.

${sprintMetadata}

ISSUES (${totalIssues} total):
${issuesFormatted}

HISTORICAL TRENDS (for comparison):
${historicalContext}

User Question: ${userMessage}

IMPORTANT: 
1. You must stay focused on sprint analysis, agile practices, and team performance. Do not provide information outside of these topics.
2. You must respond with a valid JSON object (not markdown, no code blocks) in exactly this format:
{
  "analysis": "Your response to the user's question in plain text",
  "insights": ["Insight 1", "Insight 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}

If the user's question is a simple query, you can provide shorter insights/recommendations arrays (even empty if not applicable).

CRITICAL: Return ONLY the JSON object. Do not use markdown code blocks or any other formatting. All text fields should be plain text without markdown formatting.`;

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
      
      return {
        analysis: parsed.analysis || 'No analysis provided',
        insights: Array.isArray(parsed.insights) && parsed.insights.length > 0 
          ? parsed.insights 
          : ['No specific insights identified'],
        recommendations: Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0 
          ? parsed.recommendations 
          : ['No specific recommendations provided']
      };
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

    return {
      analysis,
      insights: insights.length > 0 ? insights : ['No specific insights identified'],
      recommendations: recommendations.length > 0 ? recommendations : ['No specific recommendations provided']
    };
    }
  }
}
