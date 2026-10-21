import axios from 'axios'

export type ApiErrorKind = 'cancelled' | 'timeout' | 'network' | 'validation' | 'server' | 'protocol'

export class ApiError extends Error {
  readonly kind: ApiErrorKind

  constructor(kind: ApiErrorKind, message: string) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
  }
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (axios.isCancel(error)) return new ApiError('cancelled', 'Request cancelled')
  if (axios.isAxiosError<unknown>(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError('timeout', 'The request timed out. Please try again.')
    }
    if (!error.response) {
      return new ApiError('network', 'Unable to connect. Check your connection and try again.')
    }
    if (error.response.status === 400) {
      const data: unknown = error.response.data
      if (typeof data === 'object' && data !== null && 'message' in data &&
          typeof data.message === 'string' && data.message.trim()) {
        return new ApiError('validation', data.message)
      }
      return new ApiError('protocol', 'The service returned an unexpected response. Please try again.')
    }
    return new ApiError('server', 'The service is unavailable. Please try again.')
  }
  return new ApiError('protocol', 'The service returned an unexpected response. Please try again.')
}
