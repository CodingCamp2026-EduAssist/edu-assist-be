import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { db } from '../db/db';
import { users } from '../models/users';
import { sessions } from '../models/sessions';
import { env } from '../config/env';
import type { JwtPayload } from '../types';
import { createHmac } from 'crypto';

function hashRefreshToken(token: string): string {
  return createHmac('sha256', env.refreshTokenSecret).update(token).digest('hex');
}

export async function findOrCreateUserByGoogle(profile: {
  id: string;
  emails?: { value: string }[];
  displayName: string;
  photos?: { value: string }[];
}) {
  const email = profile.emails?.[0]?.value;
  if (!email) throw new Error('Google profile missing email');

  const [existing] = await db.select().from(users).where(eq(users.providerId, profile.id)).limit(1);

  if (existing) return existing;

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      name: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value ?? null,
      provider: 'google',
      providerId: profile.id,
    })
    .returning();

  return newUser;
}

export function generateAccessToken(user: { id: string; email: string; name: string }): string {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
  };

  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtAccessExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export async function createSession(userId: string, meta: { ip?: string; userAgent?: string }) {
  const refreshToken = uuidv4();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + env.jwtRefreshExpiresIn);

  await db.insert(sessions).values({
    userId,
    refreshTokenHash,
    expiresAt,
    ipAddress: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
  });

  return { refreshToken, expiresAt };
}

export async function rotateSession(
  oldRefreshToken: string,
  meta: { ip?: string; userAgent?: string },
) {
  const oldRefreshTokenHash = hashRefreshToken(oldRefreshToken);

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.refreshTokenHash, oldRefreshTokenHash))
    .limit(1);

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await db.delete(sessions).where(eq(sessions.userId, session.userId));
    }
    return null;
  }

  await db.delete(sessions).where(eq(sessions.id, session.id));

  const newSession = await createSession(session.userId, meta);

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);

  if (!user) return null;

  return {
    user,
    refreshToken: newSession.refreshToken,
    expiresAt: newSession.expiresAt,
  };
}

export async function revokeSession(refreshToken: string) {
  const refreshTokenHash = hashRefreshToken(refreshToken);
  await db.delete(sessions).where(eq(sessions.refreshTokenHash, refreshTokenHash));
}

export async function revokeAllUserSessions(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
