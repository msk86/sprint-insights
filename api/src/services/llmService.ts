import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { LLMAnalysisRequest, LLMAnalysisResponse } from '../types';
import { 
  buildSprintAnalysisSystemMessage,
  buildSprintAnalysisPrompt,
  buildSprintDataSystemMessage,
  buildVisualizationSystemMessage,
  buildVisualizationPrompt, 
  buildQuestionPrompt 
} from '../utils/llmPrompts';

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
    const { sprintData, stats } = request;
    
    // Build system message with sprint data (no historical data)
    const systemMessage = buildSprintAnalysisSystemMessage(sprintData, stats);
    
    // Build analysis prompt (just the task - data is in system message)
    const prompt = buildSprintAnalysisPrompt();
    
    const response = await this.invokeModel(prompt, systemMessage);
    return this.parseAnalysisResponse(response);
  }

  async freeChat(request: LLMAnalysisRequest): Promise<LLMAnalysisResponse> {
    const { chatHistory, userMessage, sprintData, stats, historicalStats } = request;
    
    // Always build system message with sprint data context (for prompt caching and consistency)
    const systemMessage = buildSprintDataSystemMessage(sprintData, stats, historicalStats, true);
    
    // Build question prompt (no need to distinguish - system prompt is always present)
    const prompt = buildQuestionPrompt(userMessage || '');
    
    const response = await this.invokeModel(prompt, systemMessage, chatHistory);
    return this.parseAnalysisResponse(response);
  }

  async visualize(request: LLMAnalysisRequest): Promise<LLMAnalysisResponse> {
    const { chatHistory, userMessage, sprintData, stats, historicalStats } = request;
    
    // Always build system message with sprint data + interface specs (for prompt caching and consistency)
    const systemMessage = buildVisualizationSystemMessage(sprintData, stats, historicalStats);
    
    // Build visualization prompt (just the user request - interface specs are in system message)
    const prompt = buildVisualizationPrompt(userMessage || '');
    
    const response = await this.invokeModel(prompt, systemMessage, chatHistory);
    return this.parseAnalysisResponse(response);
  }

  /**
   * Unified method to invoke Bedrock model with system message and optional chat history.
   * Supports both single-turn (sprint analysis, visualization) and multi-turn (chat) interactions.
   */
  private async invokeModel(
    prompt: string,
    systemMessage: string,
    chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    
    // Add previous chat history if available (for multi-turn conversations)
    if (chatHistory && chatHistory.length > 0) {
      messages.push(...chatHistory);
    }
    
    // Add the current user message
    messages.push({
      role: 'user',
      content: prompt
    });

    const requestBody: any = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4000,
      system: systemMessage,  // Always include system message for prompt caching
      messages
    };

    const input = {
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody)
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
