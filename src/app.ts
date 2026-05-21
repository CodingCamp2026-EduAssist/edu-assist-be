import express, { Router } from 'express';
import { router as userRoutes } from './routes/user.routes';
import { authRoutes } from './routes/auth.routes';
import { chatRoutes } from './routes/chat.routes';
import passport from './auth/passport';
import cookieParser from 'cookie-parser';

const app = express();
app.disable('x-powered-by');

const apiV1 = Router();
apiV1.use('/users', userRoutes);
apiV1.use('/auth', authRoutes);
apiV1.use('/chat', chatRoutes);

app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());
app.use('/api/v1', apiV1);

app.get('/', (req, res) => {
  res.json({ message: "Miley, what's good?" });
});

export default app;
