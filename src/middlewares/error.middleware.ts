import type { ErrorRequestHandler, RequestHandler } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { isAppError } from '../errors/app-error';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
  });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (typeof error === 'object' && error && 'type' in error && error.type === 'entity.too.large') {
    res.status(413).json({ error: 'Payload too large' });
    return;
  }

  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({ error: 'Invalid JSON payload' });
    return;
  }

  if (error instanceof MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'Payload too large' });
      return;
    }

    res.status(400).json({
      error: error.message,
      code: error.code,
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      issues: error.issues,
    });
    return;
  }

  if (isAppError(error)) {
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      details: error.statusCode < 500 ? error.details : undefined,
    });
    return;
  }

  console.error(error);

  res.status(500).json({
    error: env.nodeEnv === 'production' ? 'Internal server error' : 'Internal server error',
  });
};
