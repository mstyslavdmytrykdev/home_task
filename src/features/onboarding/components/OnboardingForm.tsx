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
  const successHeading = useRef<HTMLHeadingElement>(null)
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

  useEffect(() => {
    if (success) successHeading.current?.focus()
  }, [success])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    clearErrors('root')
    try {
      await handleSubmit(async (values) => {
        if (!await corporation.verify(values.corporationNumber)) {
          if (mounted.current) setFocus('corporationNumber')
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
          if (failure.kind === 'validation' && failure.message === 'Invalid phone number') {
            setError('phone', { type: 'server', message: failure.message }, { shouldFocus: true })
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

  if (success) {
    return (
      <section className="onboarding-form" aria-labelledby="success-title">
        <h1 id="success-title" ref={successHeading} tabIndex={-1}>Details submitted</h1>
        <p>Your personal and business details have been submitted successfully.</p>
      </section>
    )
  }

  return (
    <form
      className="onboarding-form"
      aria-labelledby="onboarding-title"
      noValidate
      onSubmit={(event) => { void onSubmit(event) }}
    >
      <h1 id="onboarding-title">Onboarding Form</h1>
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
        <p className="onboarding-form__status" role="status">
          {posting ? 'Submitting…' : corporation.status === 'checking' ? 'Checking corporation number…' : ''}
        </p>
      </div>
      {errors.root?.server && <p className="text-field__error" role="alert">{errors.root.server.message}</p>}
      <button className="onboarding-form__submit" type="submit" disabled={busy}>
        {busy ? 'Submitting…' : errors.root?.server ? 'Try again' : 'Submit'} <span aria-hidden="true">→</span>
      </button>
    </form>
  )
}
