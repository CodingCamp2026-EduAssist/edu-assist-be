import { Router } from 'express';
import {
  createSession,
  listHistory,
  listSessions,
  resumeSession,
  sendMessage,
} from '../controllers/chat.controller';
import { optionalAuthenticate } from '../middlewares/auth.middleware';
import {
  chatCreateLimiter,
  chatReadLimiter,
  chatMessageLimiter,
} from '../middlewares/rate-limit.middleware';

const router = Router();

router.post('/sessions', chatCreateLimiter, optionalAuthenticate, createSession);
router.get('/sessions', chatReadLimiter, listSessions);
router.get('/sessions/:sessionId', chatReadLimiter, resumeSession);
router.get('/sessions/:sessionId/messages', chatReadLimiter, listHistory);
router.post('/sessions/:sessionId/messages', chatMessageLimiter, sendMessage);

export { router as chatRoutes };
