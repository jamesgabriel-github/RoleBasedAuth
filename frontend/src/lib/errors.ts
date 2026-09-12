import { isAxiosError } from 'axios'
import type { ApiErrorResponse } from '@/types/api'

export function getErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (isAxiosError<ApiErrorResponse>(error)) {
    const data = error.response?.data
    if (data?.errors) {
      const firstError = Object.values(data.errors)[0]?.[0]
      if (firstError) return firstError
    }
    if (data?.message) return data.message
  }
  return fallback
}
