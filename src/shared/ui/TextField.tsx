import { useId } from 'react'
import type { ComponentPropsWithRef } from 'react'
import './TextField.scss'

type TextFieldProps = ComponentPropsWithRef<'input'> & {
  label: string
  hint?: string
  error?: string
}

export default function TextField({
  label,
  hint,
  error,
  id,
  className,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  ...inputProps
}: TextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const descriptionIds = [
    describedBy,
    hint ? `${inputId}-hint` : undefined,
    error ? `${inputId}-error` : undefined,
  ].filter(Boolean).join(' ') || undefined

  return (
    <div className="text-field">
      <label className="text-field__label" htmlFor={inputId}>{label}</label>
      <input
        {...inputProps}
        id={inputId}
        className={['text-field__input', className].filter(Boolean).join(' ')}
        aria-invalid={error ? true : invalid}
        aria-describedby={descriptionIds}
      />
      {hint && <p className="text-field__hint" id={`${inputId}-hint`}>{hint}</p>}
      <p className="text-field__error" id={`${inputId}-error`}>{error}</p>
    </div>
  )
}
