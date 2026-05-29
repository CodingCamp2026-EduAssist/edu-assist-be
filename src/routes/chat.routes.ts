import { Router } from 'express';
import {
  createSession,
  listHistory,
  listSessions,
  resumeSession,
  sendMessage,
} from '../controllers/chat.controller';
import { authenticate } from '../middlewares/auth.middleware';
import {
  chatCreateLimiter,
  chatReadLimiter,
  chatMessageLimiter,
} from '../middlewares/rate-limit.middleware';

const router = Router();

router.post('/sessions', chatCreateLimiter, authenticate, createSession);
router.get('/sessions', chatReadLimiter, authenticate, listSessions);
router.get('/sessions/:sessionId', chatReadLimiter, authenticate, resumeSession);
router.get('/sessions/:sessionId/messages', chatReadLimiter, authenticate, listHistory);
router.post('/sessions/:sessionId/messages', chatMessageLimiter, authenticate, sendMessage);

export { router as chatRoutes };
