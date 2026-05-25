import { type ZodTypeAny } from 'zod';
import { AppError } from '../errors/app-error';

export function parseSchema<T extends ZodTypeAny>(schema: T, input: unknown, message: string) {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new AppError(400, message, 'VALIDATION_ERROR', result.error.issues);
  }

  return result.data;
}
