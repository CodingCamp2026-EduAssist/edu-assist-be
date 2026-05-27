import multer from 'multer';
import { Router } from 'express';
import { env } from '../config/env';
import { authenticate } from '../middlewares/auth.middleware';
import { listDocuments, uploadDocument } from '../controllers/document.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.storageMaxUploadSizeBytes,
    files: 1,
  },
});

const router = Router();

router.get('/', authenticate, listDocuments);
router.post('/', authenticate, upload.single('file'), uploadDocument);

export { router as documentRoutes };
