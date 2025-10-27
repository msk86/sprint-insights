import axios from 'axios';
import { TeamConfig, SprintData, LLMAnalysisResponse } from '../types';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 seconds for long-running requests like sprint data fetching
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

// Sprint data API
export const sprintApi = {
  getSprintData: async (
    team: string, 
    sprintIdentifier: string | number, 
    identifierType: 'index' | 'name'
  ): Promise<SprintData> => {
    const response = await api.get('/sprints', {
      params: { 
        team, 
        sprintIdentifier,
        identifierType
      },
      timeout: 60000 // 60 seconds for sprint data fetching
    });
    return response.data;
  }
};

// LLM analysis API
export const llmApi = {
  analyzeSprint: async (sprintData: SprintData, historicalData?: SprintData[]): Promise<LLMAnalysisResponse> => {
    const response = await api.post('/llm/analyze', {
      sprintData,
      historicalData
    });
    return response.data;
  },

  freeChat: async (sprintData: SprintData, userMessage: string): Promise<LLMAnalysisResponse> => {
    const response = await api.post('/llm/chat', {
      sprintData,
      userMessage
    });
    return response.data;
  }
};

export default api;
