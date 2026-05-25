import { AppError } from '../errors/app-error';
import { z } from 'zod';
import { InferenceRequestDto, InferenceResponseDto } from '../dtos/inference.dto';
import { env } from '../config/env';

export type InferenceRequest = z.infer<typeof InferenceRequestDto>;
export type InferenceResponse = z.infer<typeof InferenceResponseDto>;

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
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

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

    const responseResult = InferenceResponseDto.safeParse(data);
    if (!responseResult.success) {
      throw new AppError(
        502,
        'Inference service returned an invalid response shape',
        'INFERENCE_INVALID_RESPONSE',
        responseResult.error.issues,
      );
    }

    return responseResult.data;
  } catch (error) {
    if (error instanceof AppError) throw error;

    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError(504, 'Inference service request timed out', 'INFERENCE_TIMEOUT');
    }

    throw new AppError(503, 'Inference service unavailable', 'INFERENCE_UNAVAILABLE');
  } finally {
    clearTimeout(timeoutId);
  }
}
