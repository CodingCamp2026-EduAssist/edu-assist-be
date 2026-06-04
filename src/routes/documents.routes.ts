import multer from 'multer';
import { Router } from 'express';
import { env } from '../config/env';
import { authenticate } from '../middlewares/auth.middleware';
import {
  deleteDocument,
  listDocuments,
  uploadBatchDocuments,
  uploadDocument,
} from '../controllers/document.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.storageMaxUploadSizeBytes,
    files: 10,
  },
});

const router = Router();

router.get('/', authenticate, listDocuments);
router.post('/', authenticate, upload.single('file'), uploadDocument);
router.post('/batch', authenticate, upload.array('files', 10), uploadBatchDocuments);
router.delete('/', authenticate, deleteDocument);

export { router as documentRoutes };
