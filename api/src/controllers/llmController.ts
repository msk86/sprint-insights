import { Request, Response } from 'express';
import { LLMAnalysisRequest, LLMAnalysisResponse } from '../types';
import { LLMService } from '../services/llmService';

export class LLMController {
  async analyzeSprint(req: Request, res: Response): Promise<void> {
    res.json({});
    try {
      const request: LLMAnalysisRequest = {
        sprintData: req.body.sprintData,
        historicalData: req.body.historicalData,
        analysisType: 'sprint_analysis'
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
    res.json({});
    try {
      const request: LLMAnalysisRequest = {
        sprintData: req.body.sprintData,
        userMessage: req.body.userMessage,
        analysisType: 'free_chat'
      };

      const llmService = new LLMService();
      const response = await llmService.freeChat(request);
      res.json(response);
    } catch (error) {
      console.error('Error in free chat:', error);
      res.status(500).json({ error: 'Failed to process chat request' });
    }
  }
}
