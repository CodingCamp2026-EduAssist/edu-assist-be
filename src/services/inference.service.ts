import { z } from 'zod';
import { InferenceRequestDto, InferenceResponseDto } from '../dtos/inference.dto';
import { env } from '../config/env';

export type InferenceRequest = z.infer<typeof InferenceRequestDto>;
export type InferenceResponse = z.infer<typeof InferenceResponseDto>;

export async function callInference(payload: InferenceRequest): Promise<InferenceResponse> {
  const requestBody = InferenceRequestDto.parse(payload);

  const response = await fetch(env.inferenceApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const message = errorText
      ? `Inference service request failed with ${response.status}: ${errorText}`
      : `Inference service request failed with ${response.status}`;
    throw new Error(message);
  }

  const data = await response.json();
  return InferenceResponseDto.parse(data);
}
