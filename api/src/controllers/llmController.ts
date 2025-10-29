import { Request, Response } from 'express';
import { LLMAnalysisRequest, LLMAnalysisResponse } from '../types';
import { LLMService } from '../services/llmService';

export class LLMController {
  async analyzeSprint(req: Request, res: Response): Promise<void> {
    try {
      const request: LLMAnalysisRequest = {
        sprintData: req.body.sprintData,
        historicalData: req.body.historicalData,
        analysisType: 'sprint_analysis',
        stats: req.body.stats,
        historicalStats: req.body.historicalStats
      };

      const llmService = new LLMService();
      const analysis = await llmService.analyzeSprint(request);
      res.json(analysis);
    } catch (error) {
      console.error('Error analyzing sprint:', error);
      res.status(500).json({ error: 'Failed to analyze sprint' });
    }
  }

  async freeChat(req: Request, res: Response): Promise<void> {
    try {
      const request: LLMAnalysisRequest = {
        sprintData: req.body.sprintData,
        historicalData: req.body.historicalData,
        userMessage: req.body.userMessage,
        analysisType: 'free_chat',
        stats: req.body.stats,
        chatHistory: req.body.chatHistory,
        historicalStats: req.body.historicalStats
      };

      const llmService = new LLMService();
      const response = await llmService.freeChat(request);
      res.json(response);
    } catch (error) {
      console.error('Error in free chat:', error);
      res.status(500).json({ error: 'Failed to process chat request' });
    }
  }

  async visualize(req: Request, res: Response): Promise<void> {
    try {
      const request: LLMAnalysisRequest = {
        sprintData: req.body.sprintData,
        historicalData: req.body.historicalData,
        userMessage: req.body.userMessage,
        analysisType: 'free_chat',
        stats: req.body.stats,
        chatHistory: req.body.chatHistory,
        historicalStats: req.body.historicalStats
      };

      const llmService = new LLMService();
      const response = await llmService.visualize(request);
      res.json(response);
    } catch (error) {
      console.error('Error in visualization:', error);
      res.status(500).json({ error: 'Failed to process visualization request' });
    }
  }
}
