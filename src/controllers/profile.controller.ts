import { Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { StudentProfileSchema } from '../models/studentProfiles';
import {
  resolveStudentProfileForUser,
  upsertStudentProfileForUser,
} from '../services/profile.service';
import { parseSchema } from '../utils/validation';

const UpdateStudentProfileDto = StudentProfileSchema.partial().strict();

function requireAuthenticatedUser(req: Request): string {
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
  }

  return userId;
}

export async function showProfile(req: Request, res: Response): Promise<void> {
  const userId = requireAuthenticatedUser(req);
  const profile = await resolveStudentProfileForUser(userId);

  res.json({ profile });
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const payload = parseSchema(UpdateStudentProfileDto, req.body, 'Invalid student profile payload');
  const userId = requireAuthenticatedUser(req);

  const profile = await upsertStudentProfileForUser(userId, payload);

  res.json({ profile });
}
