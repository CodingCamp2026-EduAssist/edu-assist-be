import express, { Router } from 'express';
import cookieParser from 'cookie-parser';
import passport from './auth/passport';
import { router as userRoutes } from './routes/user.routes';
import { authRoutes } from './routes/auth.routes';
import { chatRoutes } from './routes/chat.routes';
import { env } from './config/env';
import { securityHeaders } from './middlewares/security.middleware';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';

const app = express();

if (env.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');
app.use(securityHeaders);
app.use(express.json({ limit: env.requestBodyLimit }));
app.use(express.urlencoded({ extended: false, limit: env.requestBodyLimit }));
app.use(cookieParser());
app.use(passport.initialize());

const apiV1 = Router();
apiV1.use('/users', userRoutes);
apiV1.use('/auth', authRoutes);
apiV1.use('/chat', chatRoutes);

app.use('/api/v1', apiV1);

app.get('/', (_req, res) => {
  res.json({ message: "Miley, what's good?" });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
