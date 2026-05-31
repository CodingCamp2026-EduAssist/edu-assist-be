import { desc, eq } from 'drizzle-orm';
import { db } from '../db/db';
import { studentProfiles, type StudentProfileInput } from '../models/studentProfiles';

export const DEFAULT_STUDENT_PROFILE: StudentProfileInput = {
  educationLevel: 'undergraduate',
  difficultyPreference: 'adaptive',
  favouriteSubjects: [],
  pace: 'medium',
  explanationStyle: 'concise',
};

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

function normalizeStudentProfile(profile: StudentProfileInput): StudentProfileInput {
  return {
    educationLevel: profile.educationLevel,
    difficultyPreference: profile.difficultyPreference,
    favouriteSubjects: [...profile.favouriteSubjects],
    pace: profile.pace,
    explanationStyle: profile.explanationStyle,
  };
}

function toStudentProfileInput(profile: typeof studentProfiles.$inferSelect): StudentProfileInput {
  return normalizeStudentProfile({
    educationLevel: profile.educationLevel,
    difficultyPreference: profile.difficultyPreference,
    favouriteSubjects: profile.favouriteSubjects,
    pace: profile.pace,
    explanationStyle: profile.explanationStyle,
  });
}

export async function resolveStudentProfileForUser(userId: string): Promise<StudentProfileInput> {
  const [profile] = await db
    .select()
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, userId))
    .orderBy(desc(studentProfiles.updatedAt))
    .limit(1);

  if (!profile) {
    return normalizeStudentProfile(DEFAULT_STUDENT_PROFILE);
  }

  return toStudentProfileInput(profile);
}

export async function createStudentProfileForUser(
  userId: string,
  profile: StudentProfileInput,
): Promise<StudentProfileInput> {
  const [created] = await db
    .insert(studentProfiles)
    .values({
      userId,
      ...profile,
    })
    .returning();

  return toStudentProfileInput(created);
}

export async function upsertStudentProfileForUser(
  userId: string,
  profile: Partial<StudentProfileInput>,
): Promise<StudentProfileInput> {
  const cleanedProfile = stripUndefined(profile);
  const currentProfile = await resolveStudentProfileForUser(userId);
  const nextProfile = normalizeStudentProfile({
    ...currentProfile,
    ...cleanedProfile,
    favouriteSubjects: cleanedProfile.favouriteSubjects
      ? [...cleanedProfile.favouriteSubjects]
      : currentProfile.favouriteSubjects,
  });

  await db
    .insert(studentProfiles)
    .values({
      userId,
      ...nextProfile,
    })
    .onConflictDoUpdate({
      target: studentProfiles.userId,
      set: {
        ...nextProfile,
        updatedAt: new Date(),
      },
    });

  return nextProfile;
}
