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
    const response = await this.invokeModel(prompt);
    return this.parseAnalysisResponse(response);
  }

  private buildSprintAnalysisPrompt(request: LLMAnalysisRequest): string {
    const { sprintData, historicalData } = request;
    
    let prompt = `You are an expert agile coach and sprint analyst. Analyze the following sprint data and provide insights, recommendations, and identify potential issues.

SPRINT DATA:
- Sprint Name: ${sprintData.sprint.name}
- Sprint State: ${sprintData.sprint.state}
- Sprint Period: ${sprintData.sprint.start} to ${sprintData.sprint.end}
- Total Issues: ${sprintData.issues.length}
- Total Story Points: ${sprintData.issues.reduce((sum, issue) => sum + issue.storyPoints, 0)}

ISSUES BREAKDOWN:
${sprintData.issues.map(issue => 
  `- ${issue.key}: ${issue.summary} (${issue.storyPoints} points, ${issue.subCategory})`
).join('\n')}

HISTORICAL CONTEXT:
${historicalData ? historicalData.map((sprint, index) => 
  `Sprint ${index + 1}: ${sprint.sprint.name} - ${sprint.issues.length} issues, ${sprint.issues.reduce((sum, issue) => sum + issue.storyPoints, 0)} points`
).join('\n') : 'No historical data available'}

Please provide:
1. Key insights about this sprint's performance
2. Areas of concern or improvement
3. Specific recommendations for the next sprint
4. Any patterns you notice compared to historical data

Focus on actionable insights that can help improve team performance.`;

    return prompt;
  }

  private buildFreeChatPrompt(request: LLMAnalysisRequest): string {
    const { sprintData, userMessage } = request;
    
    let prompt = `You are an expert agile coach helping with sprint analysis. You have access to the following sprint data:

SPRINT DATA:
- Sprint Name: ${sprintData.sprint.name}
- Sprint State: ${sprintData.sprint.state}
- Sprint Period: ${sprintData.sprint.start} to ${sprintData.sprint.end}
- Total Issues: ${sprintData.issues.length}
- Total Story Points: ${sprintData.issues.reduce((sum, issue) => sum + issue.storyPoints, 0)}

ISSUES:
${sprintData.issues.map(issue => 
  `- ${issue.key}: ${issue.summary} (${issue.storyPoints} points, ${issue.subCategory})`
).join('\n')}

IMPORTANT: You must stay focused on sprint analysis, agile practices, and team performance. Do not provide information outside of these topics.

User Question: ${userMessage}

Please provide a helpful response related to sprint analysis and agile practices.`;

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

  private parseAnalysisResponse(response: string): LLMAnalysisResponse {
    // Simple parsing - in a real implementation, you might want more sophisticated parsing
    const lines = response.split('\n');
    const analysis = lines.join('\n');
    
    // Extract insights and recommendations (simple heuristic)
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
