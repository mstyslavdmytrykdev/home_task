import { z } from 'zod'
import { apiClient } from '../../../shared/api/client'
import { ApiError, normalizeApiError } from '../../../shared/api/errors'
import type { OnboardingValues } from '../model/onboardingSchema'

const corporationResponseSchema = z.discriminatedUnion('valid', [
  z.object({ valid: z.literal(true), corporationNumber: z.string() }),
  z.object({
    valid: z.literal(false),
    message: z.string().trim().min(1),
    corporationNumber: z.string().optional(),
  }),
])

export type CorporationValidationResult =
  | { valid: true; corporationNumber: string }
  | { valid: false; message: string }

export async function checkCorporationNumber(
  number: string,
  signal?: AbortSignal,
): Promise<CorporationValidationResult> {
  try {
    const response = await apiClient.get<unknown>(`/corporation-number/${encodeURIComponent(number)}`, {
      signal,
      validateStatus: (status) => (status >= 200 && status < 300) || status === 404,
    })
    const parsed = corporationResponseSchema.safeParse(response.data)
    if (!parsed.success ||
        (parsed.data.corporationNumber !== undefined && parsed.data.corporationNumber !== number) ||
        (response.status === 404 && parsed.data.valid)) {
      throw new ApiError('protocol', 'Unable to verify the corporation number. Please try again.')
    }
    return parsed.data.valid
      ? { valid: true, corporationNumber: parsed.data.corporationNumber }
      : { valid: false, message: parsed.data.message }
  } catch (error: unknown) {
    throw normalizeApiError(error)
  }
}

export async function submitProfile(values: OnboardingValues, signal?: AbortSignal): Promise<void> {
  try {
    const { firstName, lastName, corporationNumber, phone } = values
    const response = await apiClient.post<unknown>('/profile-details', {
      firstName, lastName, corporationNumber, phone,
    }, { signal })
    if (response.status !== 200) {
      throw new ApiError('protocol', 'The service returned an unexpected response. Please try again.')
    }
  } catch (error: unknown) {
    throw normalizeApiError(error)
  }
}
