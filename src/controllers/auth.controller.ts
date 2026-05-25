import { Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import passport from '../auth/passport';
import {
  generateAccessToken,
  createSession,
  rotateSession,
  revokeSession,
} from '../services/auth.service';
import { env } from '../config/env';

const REFRESH_COOKIE = 'refresh_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: 'lax' as const,
  path: '/api/v1/auth',
  maxAge: env.jwtRefreshExpiresIn,
};

export const googleLogin = passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false,
});

export const googleCallback = [
  passport.authenticate('google', { session: false, failureRedirect: '/api/v1/auth/failure' }),
  async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) {
      throw new AppError(401, 'Google authentication failed', 'GOOGLE_AUTH_FAILED');
    }

    const accessToken = generateAccessToken(user);
    const { refreshToken } = await createSession(user.id, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.setHeader('Cache-Control', 'no-store');
    res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);

    res.redirect(`${env.clientUrl}/auth/callback?token=${encodeURIComponent(accessToken)}`);
  },
];

export async function refresh(req: Request, res: Response) {
  const oldToken = req.cookies?.[REFRESH_COOKIE];
  if (!oldToken) {
    throw new AppError(401, 'No refresh token provided', 'REFRESH_TOKEN_MISSING');
  }

  const result = await rotateSession(oldToken, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  if (!result) {
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    throw new AppError(401, 'Invalid or expired refresh token', 'REFRESH_TOKEN_INVALID');
  }

  const accessToken = generateAccessToken(result.user);

  res.setHeader('Cache-Control', 'no-store');
  res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS);
  res.json({ accessToken });
}

export async function logout(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    await revokeSession(token);
  }

  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ message: 'Logged out successfully' });
}

export function me(req: Request, res: Response) {
  res.json({ user: req.user });
}

export function failure(_req: Request, res: Response) {
  res.status(401).json({ error: 'Google authentication failed' });
}
