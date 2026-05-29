import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error';
import passport from '../auth/passport';

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  passport.authenticate(
    'jwt',
    { session: false },
    (err: unknown, user: Express.User | false | null) => {
      if (err) {
        next(err);
        return;
      }

      if (!user) {
        next(new AppError(401, 'Unauthorized', 'UNAUTHORIZED'));
        return;
      }

      req.user = user;
      next();
    },
  )(req, res, next);
}
