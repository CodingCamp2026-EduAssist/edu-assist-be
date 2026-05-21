import { Request, Response, NextFunction } from 'express';
import passport from '../auth/passport';

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  passport.authenticate('jwt', { session: false }, (err: Error, user: Express.User) => {
    if (err) {
      next(err);
      return;
    }
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.user = user;
    next();
  })(req, res, next);
}

export function optionalAuthenticate(req: Request, res: Response, next: NextFunction): void {
  passport.authenticate('jwt', { session: false }, (err: Error, user: Express.User) => {
    if (err) {
      next(err);
      return;
    }
    if (user) {
      req.user = user;
    }
    next();
  })(req, res, next);
}
