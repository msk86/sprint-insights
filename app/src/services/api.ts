import axios from 'axios';
import { TeamConfig, SprintData, LLMAnalysisResponse } from '../types';

// Use VITE_API_URL environment variable in production, fallback to /api for local dev
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 90000, // 60 seconds for long-running requests like sprint data fetching
});

// Team management API
export const teamApi = {
  getTeams: async (): Promise<TeamConfig[]> => {
    const response = await api.get('/teams');
    return response.data;
  },

  createTeam: async (team: Omit<TeamConfig, 'JIRA_TOKEN' | 'BUILDKITE_TOKEN'> & { 
    JIRA_TOKEN: string; 
    BUILDKITE_TOKEN: string; 
  }): Promise<TeamConfig> => {
    const response = await api.post('/teams', team);
    return response.data;
  },

  updateTeam: async (teamId: string, team: Omit<TeamConfig, 'JIRA_TOKEN' | 'BUILDKITE_TOKEN'> & { 
    JIRA_TOKEN: string; 
    BUILDKITE_TOKEN: string; 
  }): Promise<TeamConfig> => {
    const response = await api.put(`/teams/${teamId}`, team);
    return response.data;
  },

  deleteTeam: async (teamId: string): Promise<void> => {
    await api.delete(`/teams/${teamId}`);
  }
};

// Helper to wait for a specified time
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Sprint data API
export const sprintApi = {
  getSprintData: async (
    team: string, 
    sprintIdentifier: string | number, 
    identifierType: 'index' | 'name'
  ): Promise<SprintData> => {
    try {
      // First, try the main endpoint with a timeout
      const response = await api.get('/sprints', {
        params: { 
          team, 
          sprintIdentifier,
          identifierType
        },
        timeout: 110000 // 110 seconds (slightly longer than Lambda timeout of 120s)
      });
      
      return response.data;
    } catch (error: any) {
      // Check if this is a 504 Gateway Timeout error
      const isTimeout = error.response?.status === 504 || 
                       error.code === 'ERR_NETWORK' || 
                       error.message?.includes('timeout') ||
                       error.message?.includes('Network');
      
      if (!isTimeout) {
        // Not a timeout error, rethrow
        throw error;
      }
      
      console.log('Main request timed out (504 or timeout), falling back to polling...');
      
      // Poll /sprints/wait endpoint every 10 seconds until data is ready
      const maxAttempts = 10; // 100 seconds max (10 * 10 seconds)
      let attempt = 0;
      
      while (attempt < maxAttempts) {
        attempt++;
        
        // Wait 10 seconds before polling
        await sleep(10000);
        
        console.log(`Polling attempt ${attempt}/${maxAttempts}...`);
        
        try {
          const pollResponse = await api.get('/sprints/wait', {
            params: { 
              team, 
              sprintIdentifier,
              identifierType
            }
          });
          
          const pollData = pollResponse.data;
          
          // Check if data is ready
          if (!pollData.status || pollData.status !== 'processing') {
            console.log(`Sprint data ready after ${attempt} polling attempts (${attempt * 10}s)`);
            return pollData;
          }
          
          console.log('Data still processing, will retry...');
        } catch (pollError) {
          console.warn(`Polling attempt ${attempt} failed:`, pollError);
          // Continue polling even if one request fails
        }
      }
      
      // If we reach here, we've exceeded max attempts
      throw new Error(`Timeout waiting for sprint data after ${maxAttempts * 10} seconds. The data may still be processing.`);
    }
  }
};

// LLM analysis API
export const llmApi = {
  analyzeSprint: async (
    sprintData: SprintData, 
    stats?: any
  ): Promise<LLMAnalysisResponse> => {
    const response = await api.post('/llm/analyze', {
      sprintData,
      stats
    });
    return response.data;
  },

  freeChat: async (
    sprintData: SprintData, 
    userMessage: string,
    stats?: any,
    chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    historicalData?: SprintData[],
    historicalStats?: any[]
  ): Promise<LLMAnalysisResponse> => {
    const response = await api.post('/llm/chat', {
      sprintData,
      userMessage,
      stats,
      chatHistory,
      historicalData,
      historicalStats
    });
    return response.data;
  },

  visualize: async (
    sprintData: SprintData, 
    userMessage: string,
    stats?: any,
    chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    historicalData?: SprintData[],
    historicalStats?: any[]
  ): Promise<LLMAnalysisResponse> => {
    const response = await api.post('/llm/visualize', {
      sprintData,
      userMessage,
      stats,
      chatHistory,
      historicalData,
      historicalStats
    });
    return response.data;
  }
};

export default api;
