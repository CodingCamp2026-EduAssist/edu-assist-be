import { Router } from 'express';
import {
  createSession,
  listHistory,
  listSessions,
  resumeSession,
  sendMessage,
} from '../controllers/chat.controller';
import { optionalAuthenticate } from '../middlewares/auth.middleware';

const router = Router();

router.post('/sessions', optionalAuthenticate, createSession);
router.get('/sessions', listSessions);
router.get('/sessions/:sessionId', resumeSession);
router.get('/sessions/:sessionId/messages', listHistory);
router.post('/sessions/:sessionId/messages', sendMessage);

export { router as chatRoutes };
