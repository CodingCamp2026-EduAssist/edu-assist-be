import { AppError } from '../errors/app-error';
import { z } from 'zod';
import { InferenceRequestDto, InferenceResponseDto } from '../dtos/inference.dto';
import { env } from '../config/env';
import { Citation, TokenUsage } from '../types';

export type InferenceRequest = z.infer<typeof InferenceRequestDto>;
export type InferenceResponse = z.infer<typeof InferenceResponseDto>;

const InferenceUpstreamContentDto = z.union([
  z.string().min(1).max(8000),
  z
    .object({
      text: z.string().min(1).max(8000),
    })
    .passthrough(),
]);

const InferenceUpstreamResponseDto = z
  .object({
    content: InferenceUpstreamContentDto,
    citations: Citation.array().nullish(),
    tokenUsage: TokenUsage,
  })
  .strict();

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

function normalizeInferenceContent(content: z.infer<typeof InferenceUpstreamContentDto>): string {
  return typeof content === 'string' ? content : content.text;
}

export async function callInference(payload: InferenceRequest): Promise<InferenceResponse> {
  const requestResult = InferenceRequestDto.safeParse(payload);

  if (!requestResult.success) {
    throw new AppError(
      500,
      'Invalid inference request payload',
      'INFERENCE_REQUEST_INVALID',
      requestResult.error.issues,
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.inferenceRequestTimeoutMs);

  try {
    const response = await fetch(env.inferenceApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(requestResult.data),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const message = errorText
        ? `Inference service request failed with ${response.status}: ${errorText.slice(0, 500)}`
        : `Inference service request failed with ${response.status}`;

      throw new AppError(502, message, 'INFERENCE_UPSTREAM_ERROR');
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new AppError(
        502,
        'Inference service returned a non-JSON response',
        'INFERENCE_BAD_CONTENT_TYPE',
      );
    }

    const data: unknown = await response.json().catch(() => {
      throw new AppError(502, 'Inference service returned invalid JSON', 'INFERENCE_INVALID_JSON');
    });

    const responseResult = InferenceUpstreamResponseDto.safeParse(data);
    if (!responseResult.success) {
      throw new AppError(
        502,
        'Inference service returned an invalid response shape',
        'INFERENCE_INVALID_RESPONSE',
        responseResult.error.issues,
      );
    }

    const normalizedResponse = InferenceResponseDto.safeParse({
      content: normalizeInferenceContent(responseResult.data.content),
      citations: responseResult.data.citations ?? [],
      tokenUsage: responseResult.data.tokenUsage,
    });

    if (!normalizedResponse.success) {
      throw new AppError(
        502,
        'Inference service returned an invalid normalized response',
        'INFERENCE_INVALID_RESPONSE',
        normalizedResponse.error.issues,
      );
    }

    return normalizedResponse.data;
  } catch (error) {
    if (error instanceof AppError) throw error;

    if (isAbortError(error)) {
      throw new AppError(504, 'Inference service request timed out', 'INFERENCE_TIMEOUT');
    }

    throw new AppError(503, 'Inference service unavailable', 'INFERENCE_UNAVAILABLE');
  } finally {
    clearTimeout(timeoutId);
  }
}
