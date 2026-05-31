import { Router } from 'express';
import { showProfile, updateProfile } from '../controllers/profile.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/me', authenticate, showProfile);
router.patch('/me', authenticate, updateProfile);

export { router as profileRoutes };
