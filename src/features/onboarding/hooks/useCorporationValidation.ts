import { useEffect, useRef, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { checkCorporationNumber } from '../api/onboardingApi'
import { onboardingSchema } from '../model/onboardingSchema'
import type { OnboardingValues } from '../model/onboardingSchema'

type Form = Pick<UseFormReturn<OnboardingValues>, 'getValues' | 'setError' | 'clearErrors' | 'getFieldState'>
type Status = 'idle' | 'checking' | 'valid' | 'invalid' | 'unavailable'
type Request = { number: string; controller: AbortController; promise: Promise<boolean> }

export function useCorporationValidation({ getValues, setError, clearErrors, getFieldState }: Form) {
  const [status, setStatus] = useState<Status>('idle')
  const active = useRef<Request | null>(null)
  const verified = useRef<string | null>(null)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      active.current?.controller.abort()
      active.current = null
    }
  }, [])

  function invalidate() {
    active.current?.controller.abort()
    active.current = null
    verified.current = null
    setStatus('idle')
    if (getFieldState('corporationNumber').error?.type === 'remote') {
      clearErrors('corporationNumber')
    }
  }

  function verify(number: string): Promise<boolean> {
    if (!onboardingSchema.shape.corporationNumber.safeParse(number).success ||
        getValues('corporationNumber') !== number || !mounted.current) {
      return Promise.resolve(false)
    }
    if (verified.current === number) return Promise.resolve(true)
    if (active.current?.number === number) return active.current.promise

    active.current?.controller.abort()
    const controller = new AbortController()
    const request: Request = { number, controller, promise: Promise.resolve(false) }
    active.current = request
    setStatus('checking')
    const isCurrent = () => mounted.current && active.current === request &&
      !controller.signal.aborted && getValues('corporationNumber') === number

    request.promise = (async () => {
      try {
        const result = await checkCorporationNumber(number, controller.signal)
        if (!isCurrent()) return false
        if (result.valid) {
          verified.current = number
          clearErrors('corporationNumber')
          setStatus('valid')
          return true
        }
        setError('corporationNumber', { type: 'remote', message: result.message })
        setStatus('invalid')
        return false
      } catch {
        if (!isCurrent()) return false
        setError('corporationNumber', {
          type: 'remote',
          message: 'Unable to verify the corporation number. Please try again.',
        })
        setStatus('unavailable')
        return false
      } finally {
        if (active.current === request) active.current = null
      }
    })()
    return request.promise
  }

  return { status, verify, invalidate }
}
