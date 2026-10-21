import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { submitProfile } from '../api/onboardingApi'
import { normalizeApiError } from '../../../shared/api/errors'
import { useForm } from 'react-hook-form'
import { onboardingSchema } from '../model/onboardingSchema'
import type { OnboardingValues } from '../model/onboardingSchema'
import { useCorporationValidation } from '../hooks/useCorporationValidation'
import TextField from '../../../shared/ui/TextField'
import './onboarding.scss'

function backendField(message: string): keyof OnboardingValues | undefined {
  const text = message.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  const matches = ([
    ['firstName', /\bfirst[ _-]?name\b/],
    ['lastName', /\blast[ _-]?name\b/],
    ['phone', /\bphone(?:[ _-]?number)?\b/],
    ['corporationNumber', /\bcorporation[ _-]?number\b/],
  ] as const).filter(([, pattern]) => pattern.test(text))
  return matches.length === 1 ? matches[0][0] : undefined
}

export default function OnboardingForm() {
  const { register, handleSubmit, getValues, getFieldState, setError, clearErrors, setFocus, formState: { errors } } = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: { firstName: '', lastName: '', phone: '', corporationNumber: '' },
  })

  const corporation = useCorporationValidation({ getValues, getFieldState, setError, clearErrors })
  const firstNameField = register('firstName')
  const lastNameField = register('lastName')
  const phoneField = register('phone')
  const corporationField = register('corporationNumber')

  const submitting = useRef(false)
  const postController = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  const [busy, setBusy] = useState(false)
  const [posting, setPosting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      postController.current?.abort()
    }
  }, [])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || success) return
    submitting.current = true
    setBusy(true)
    clearErrors('root')
    try {
      await handleSubmit(async (values) => {
        if (!await corporation.verify(values.corporationNumber)) {
          if (mounted.current) {
            setFocus('corporationNumber')
          }
          return
        }
        if (!mounted.current) return
        const controller = new AbortController()
        postController.current = controller
        setPosting(true)
        try {
          await submitProfile(values, controller.signal)
          if (mounted.current && !controller.signal.aborted) setSuccess(true)
        } catch (error: unknown) {
          if (!mounted.current || controller.signal.aborted) return
          const failure = normalizeApiError(error)
          const field = failure.kind === 'validation' ? backendField(failure.message) : undefined
          if (field) {
            if (field === 'corporationNumber') corporation.invalidate()
            setError(field, { type: 'server', message: failure.message }, { shouldFocus: true })
          } else {
            setError('root.server', { type: 'server', message: failure.message })
          }
        } finally {
          postController.current = null
          if (mounted.current) setPosting(false)
        }
      })(event)
    } finally {
      submitting.current = false
      if (mounted.current) {
        corporation.restoreError()
        setBusy(false)
      }
    }
  }

  const fieldErrorMessages = [errors.firstName, errors.lastName, errors.phone, errors.corporationNumber]
    .map((error) => error?.message)
    .filter(Boolean)

  return (
    <form
      className="onboarding-form"
      aria-labelledby="onboarding-title"
      noValidate
      onChange={() => { if (success) setSuccess(false) }}
      onSubmit={(event) => { void onSubmit(event) }}
    >
      <h1 id="onboarding-title">Onboarding Form</h1>
      <p className="onboarding-form__announcement" aria-live="polite" aria-atomic="true">
        {fieldErrorMessages.length > 0 ? `Please review: ${fieldErrorMessages.join('. ')}` : ''}
      </p>
      <div className="onboarding-form__fields">
        <div className="onboarding-form__names">
          <TextField
            label="First Name"
            autoComplete="given-name"
            readOnly={busy}
            maxLength={50}
            required
            error={errors.firstName?.message}
            {...firstNameField}
          />
          <TextField
            label="Last Name"
            autoComplete="family-name"
            readOnly={busy}
            maxLength={50}
            required
            error={errors.lastName?.message}
            {...lastNameField}
          />
        </div>
        <TextField
          label="Phone Number"
          type="tel"
          autoComplete="tel"
          readOnly={busy}
          required
          error={errors.phone?.message}
          {...phoneField}
        />
        <TextField
          label="Corporation Number"
          type="text"
          inputMode="numeric"
          readOnly={busy}
          maxLength={9}
          required
          error={errors.corporationNumber?.message}
          {...corporationField}
          onChange={(event) => {
            corporation.invalidate()
            void corporationField.onChange(event)
          }}
          onBlur={(event) => {
            const number = getValues('corporationNumber')
            void corporationField.onBlur(event).then(() => corporation.verify(number))
          }}
        />
      </div>
      <div className="onboarding-form__feedback">
        <p className={`onboarding-form__status${success ? ' onboarding-form__status--success' : ''}`} role="status">
          {errors.root?.server ? '' : success ? 'Details submitted successfully.' : posting ? 'Submitting…' : corporation.status === 'checking' ? 'Checking corporation number…' : ''}
        </p>
        {errors.root?.server && <p className="text-field__error" role="alert">{errors.root.server.message}</p>}
      </div>
      <button className="onboarding-form__submit" type="submit" disabled={busy || success}>
        {posting ? 'Submitting…' : busy || corporation.status === 'checking' ? 'Verifying…' : 'Submit'}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
          <path d="M4 12h16m-7-7 7 7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </form>
  )
}
