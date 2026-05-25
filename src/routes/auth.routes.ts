import { Router } from 'express';
import {
  googleLogin,
  googleCallback,
  refresh,
  logout,
  me,
  failure,
} from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import {
  googleLoginLimiter,
  googleCallbackLimiter,
  refreshLimiter,
  logoutLimiter,
} from '../middlewares/rate-limit.middleware';

const router = Router();

router.get('/google', googleLoginLimiter, googleLogin);
router.get('/google/callback', googleCallbackLimiter, ...googleCallback);
router.post('/refresh', refreshLimiter, refresh);
router.get('/failure', failure);

router.post('/logout', logoutLimiter, authenticate, logout);
router.get('/me', authenticate, me);

export { router as authRoutes };
