import { Router } from 'express';
import { TeamController } from '../controllers/teamController';
import { SprintController } from '../controllers/sprintController';
import { LLMController } from '../controllers/llmController';

const router = Router();

// Initialize controllers
const teamController = new TeamController();
const sprintController = new SprintController();
const llmController = new LLMController();

// Team management routes
router.get('/teams', (req, res) => teamController.getTeams(req, res));
router.post('/teams', (req, res) => teamController.createTeam(req, res));
router.put('/teams/:teamId', (req, res) => teamController.updateTeam(req, res));
router.delete('/teams/:teamId', (req, res) => teamController.deleteTeam(req, res));

// Sprint data routes
router.get('/sprints', (req, res) => sprintController.getSprintData(req, res));

// LLM analysis routes
router.post('/llm/analyze', (req, res) => llmController.analyzeSprint(req, res));
router.post('/llm/chat', (req, res) => llmController.freeChat(req, res));
router.post('/llm/visualize', (req, res) => llmController.visualize(req, res));

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
