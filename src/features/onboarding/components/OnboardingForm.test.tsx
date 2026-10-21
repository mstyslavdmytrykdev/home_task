import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { ApiError } from '../../../shared/api/errors'
import { checkCorporationNumber, submitProfile } from '../api/onboardingApi'
import OnboardingForm from './OnboardingForm'

vi.mock('../api/onboardingApi', () => ({ checkCorporationNumber: vi.fn(), submitProfile: vi.fn() }))

beforeEach(() => {
  vi.mocked(submitProfile).mockReset()
  vi.mocked(submitProfile).mockResolvedValue(undefined)
  vi.mocked(checkCorporationNumber).mockReset()
  vi.mocked(checkCorporationNumber).mockResolvedValue({ valid: true, corporationNumber: '012345678' })
})

function setupForm() {
  const user = userEvent.setup()
  return { user, ...render(<OnboardingForm />) }
}

test('validates untouched fields on submit and focuses the first invalid field', async () => {
  const { user } = setupForm()
  await user.click(screen.getByRole('button', { name: 'Submit' }))

  for (const [label, message] of [
    ['First Name', 'First name is required'],
    ['Last Name', 'Last name is required'],
    ['Phone Number', 'Phone number is required'],
    ['Corporation Number', 'Corporation number is required'],
  ]) {
    expect(await screen.findByText(message)).toBeVisible()
    expect(screen.getByRole('textbox', { name: label })).toHaveAccessibleDescription(message)
    expect(screen.getByRole('textbox', { name: label })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('textbox', { name: label })).toBeRequired()
  }
  expect(screen.getByRole('textbox', { name: 'First Name' })).toHaveFocus()
  expect(screen.getAllByText(/^Please review:/)).toHaveLength(1)
  expect(screen.getByText(/^Please review:/)).toHaveTextContent('First name is required. Last name is required. Phone number is required. Corporation number is required')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(checkCorporationNumber).not.toHaveBeenCalled()
  expect(submitProfile).not.toHaveBeenCalled()
})

test('shows name errors on blur and clears them only after correction is blurred', async () => {
  const { user } = setupForm()
  const input = screen.getByRole('textbox', { name: 'First Name' })
  await user.type(input, '   ')
  expect(screen.queryByText('First name is required')).not.toBeInTheDocument()
  await user.tab()
  expect(await screen.findByText('First name is required')).toBeVisible()
  const announcement = screen.getByText('Please review: First name is required')
  expect(announcement).toHaveAttribute('aria-live', 'polite')
  expect(announcement).toHaveAttribute('aria-atomic', 'true')
  await user.clear(input)
  await user.type(input, 'Jane')
  expect(screen.getByText('First name is required')).toBeVisible()
  await user.tab()
  await waitFor(() => expect(screen.queryByText('First name is required')).not.toBeInTheDocument())
  expect(announcement).not.toHaveTextContent('First name is required')
})

test.each(['First Name', 'Last Name'])('caps pasted %s at 50 characters', async (label) => {
  const { user } = setupForm()
  const input = screen.getByRole('textbox', { name: label })
  await user.click(input)
  await user.paste('a'.repeat(51))
  expect(input).toHaveValue('a'.repeat(50))
})

test('rejects a US phone on blur and accepts a corrected Canadian number', async () => {
  const { user } = setupForm()
  const phone = screen.getByRole('textbox', { name: 'Phone Number' })
  await user.type(phone, '+14155552671')
  expect(screen.queryByText(/^Enter a valid Canadian/)).not.toBeInTheDocument()
  await user.tab()
  expect(await screen.findByText(/^Enter a valid Canadian/)).toBeVisible()
  await user.clear(phone)
  await user.type(phone, '+13062776103')
  await user.tab()
  await waitFor(() => expect(screen.queryByText(/^Enter a valid Canadian/)).not.toBeInTheDocument())
})

test('validates corporation length on blur and preserves leading zeros', async () => {
  const { user } = setupForm()
  const corporation = screen.getByRole('textbox', { name: 'Corporation Number' })
  await user.type(corporation, '01234567')
  await user.tab()
  expect(await screen.findByText('Corporation number must be exactly 9 digits')).toBeVisible()
  await user.type(corporation, '8')
  await user.tab()
  await waitFor(() => expect(screen.queryByText('Corporation number must be exactly 9 digits')).not.toBeInTheDocument())
  expect(corporation).toHaveValue('012345678')
})

test.each([
  ['Phone Number', 'Phone number is required'],
  ['Corporation Number', 'Corporation number is required'],
])('shows the required error for %s on blur', async (label, message) => {
  const { user } = setupForm()
  const input = screen.getByRole('textbox', { name: label })
  await user.click(input)
  expect(screen.queryByText(message)).not.toBeInTheDocument()
  await user.tab()
  expect(await screen.findByText(message)).toBeVisible()
  expect(input).toHaveAccessibleDescription(message)
})

test('caps pasted corporation input at nine characters while retaining leading zeros', async () => {
  const { user } = setupForm()
  const input = screen.getByRole('textbox', { name: 'Corporation Number' })
  expect(input).toHaveAttribute('type', 'text')
  expect(input).toHaveAttribute('inputmode', 'numeric')
  await user.click(input)
  await user.paste('0123456789')
  expect(input).toHaveValue('012345678')
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

test.each(['12345678', 'ABC123456', '         '])('does not verify malformed corporation input %j', async (value) => {
  const { user } = setupForm()
  await user.type(screen.getByRole('textbox', { name: 'Corporation Number' }), value)
  await user.tab()
  expect(await screen.findByText('Corporation number must be exactly 9 digits')).toBeVisible()
  expect(screen.getByRole('textbox', { name: 'Corporation Number' })).toHaveAttribute('aria-invalid', 'true')
  expect(checkCorporationNumber).not.toHaveBeenCalled()
})

test('keeps business invalidity in the RHF field error across submit validation', async () => {
  vi.mocked(checkCorporationNumber).mockResolvedValue({ valid: false, message: 'Invalid corporation number' })
  const { user } = setupForm()
  const input = screen.getByRole('textbox', { name: 'Corporation Number' })
  await user.type(input, '000000000')
  await user.tab()
  expect(await screen.findByText('Invalid corporation number')).toBeVisible()
  expect(input).toHaveAccessibleDescription('Invalid corporation number')
  await user.click(screen.getByRole('button', { name: 'Submit' }))
  expect(await screen.findByText('Invalid corporation number')).toBeVisible()
  await user.clear(input)
  expect(screen.queryByText('Invalid corporation number')).not.toBeInTheDocument()
})

test('distinguishes verification failure and permits retry on blur', async () => {
  vi.mocked(checkCorporationNumber).mockRejectedValueOnce(new Error('Offline'))
  const { user } = setupForm()
  const input = screen.getByRole('textbox', { name: 'Corporation Number' })
  await user.type(input, '012345678')
  await user.tab()
  expect(await screen.findByText('Unable to verify the corporation number. Please try again.')).toBeVisible()
  await user.click(input)
  await user.tab()
  await waitFor(() => expect(screen.queryByText(/Unable to verify/)).not.toBeInTheDocument())
  expect(checkCorporationNumber).toHaveBeenCalledTimes(2)
})

test.each(['invalid', 'failure'] as const)('ignores a stale %s response even after abort', async (outcome) => {
  const old = deferred<{ valid: false; message: string }>()
  vi.mocked(checkCorporationNumber).mockReturnValueOnce(old.promise)
  const { user } = setupForm()
  const input = screen.getByRole('textbox', { name: 'Corporation Number' })
  await user.type(input, '000000000')
  await user.tab()
  await waitFor(() => expect(checkCorporationNumber).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(checkCorporationNumber).mock.calls[0][1]
  await user.clear(input)
  expect(signal?.aborted).toBe(true)
  await user.type(input, '012345678')
  await user.tab()
  await waitFor(() => expect(checkCorporationNumber).toHaveBeenCalledTimes(2))
  await act(async () => {
    if (outcome === 'invalid') old.resolve({ valid: false, message: 'Stale invalid result' })
    else old.reject(new Error('Stale failure'))
  })
  expect(input).not.toHaveAttribute('aria-invalid', 'true')
  expect(screen.queryByText('Stale invalid result')).not.toBeInTheDocument()
  expect(screen.queryByText(/Unable to verify/)).not.toBeInTheDocument()
  expect(input).toHaveValue('012345678')
})

test('aborts pending verification on unmount', async () => {
  const pending = deferred<{ valid: true; corporationNumber: string }>()
  vi.mocked(checkCorporationNumber).mockReturnValueOnce(pending.promise)
  const { user, unmount } = setupForm()
  await user.type(screen.getByRole('textbox', { name: 'Corporation Number' }), '012345678')
  await user.tab()
  await waitFor(() => expect(checkCorporationNumber).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(checkCorporationNumber).mock.calls[0][1]
  unmount()
  expect(signal?.aborted).toBe(true)
  await act(async () => pending.resolve({ valid: true, corporationNumber: '012345678' }))
})

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox', { name: 'First Name' }), ' Jane ')
  await user.type(screen.getByRole('textbox', { name: 'Last Name' }), ' Smith ')
  await user.type(screen.getByRole('textbox', { name: 'Phone Number' }), '+13062776103')
  await user.type(screen.getByRole('textbox', { name: 'Corporation Number' }), '012345678')
}

test('shares blur verification with submit and sends the exact payload before inline success', async () => {
  const verification = deferred<{ valid: true; corporationNumber: string }>()
  vi.mocked(checkCorporationNumber).mockReturnValueOnce(verification.promise)
  const { user } = setupForm()
  await fillValidForm(user)
  await user.click(screen.getByRole('button', { name: 'Submit' }))
  expect(await screen.findByRole('button', { name: 'Verifying…' })).toBeDisabled()
  expect(submitProfile).not.toHaveBeenCalled()
  await act(async () => verification.resolve({ valid: true, corporationNumber: '012345678' }))
  expect(await screen.findByText('Details submitted successfully.')).toBeVisible()
  expect(screen.getByRole('form', { name: 'Onboarding Form' })).toBeVisible()
  expect(screen.getByRole('textbox', { name: 'First Name' })).toHaveValue(' Jane ')
  expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
  expect(checkCorporationNumber).toHaveBeenCalledTimes(1)
  expect(submitProfile).toHaveBeenCalledExactlyOnceWith({
    firstName: 'Jane', lastName: 'Smith', phone: '+13062776103', corporationNumber: '012345678',
  }, expect.any(AbortSignal))
})

test.each([
  { valid: false as const, message: 'Invalid corporation number' },
  new ApiError('network', 'Offline'),
])('blocks POST when corporation verification fails (%j)', async (result) => {
  if (result instanceof Error) vi.mocked(checkCorporationNumber).mockRejectedValue(result)
  else vi.mocked(checkCorporationNumber).mockResolvedValue(result)
  const { user } = setupForm()
  await fillValidForm(user)
  await user.click(screen.getByRole('button', { name: 'Submit' }))
  await screen.findByText(result instanceof Error
    ? 'Unable to verify the corporation number. Please try again.'
    : result.message)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled())
  expect(submitProfile).not.toHaveBeenCalled()
  expect(screen.getByRole('textbox', { name: 'Corporation Number' })).toHaveFocus()
})

test.each(['server', 'validation'] as const)('preserves values after %s failure and retries only on request', async (kind) => {
  vi.mocked(submitProfile).mockRejectedValueOnce(new ApiError(kind, 'Please try again later'))
  const { user } = setupForm()
  await fillValidForm(user)
  await user.click(screen.getByRole('button', { name: 'Submit' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Please try again later')
  expect(screen.getByRole('textbox', { name: 'First Name' })).toHaveValue(' Jane ')
  expect(screen.getByRole('textbox', { name: 'Corporation Number' })).toHaveValue('012345678')
  expect(submitProfile).toHaveBeenCalledTimes(1)
  await user.click(screen.getByRole('button', { name: 'Submit' }))
  expect(await screen.findByText('Details submitted successfully.')).toBeVisible()
  expect(submitProfile).toHaveBeenCalledTimes(2)
  expect(checkCorporationNumber).toHaveBeenCalledTimes(1)
})

test('prevents duplicate POST and editing while submission is pending', async () => {
  const pending = deferred<void>()
  vi.mocked(submitProfile).mockReturnValueOnce(pending.promise)
  const { user } = setupForm()
  await fillValidForm(user)
  await user.dblClick(screen.getByRole('button', { name: 'Submit' }))
  await waitFor(() => expect(submitProfile).toHaveBeenCalledTimes(1))
  expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled()
  await user.type(screen.getByRole('textbox', { name: 'First Name' }), 'changed')
  expect(screen.getByRole('textbox', { name: 'First Name' })).toHaveValue(' Jane ')
  await act(async () => pending.resolve())
  expect(await screen.findByText('Details submitted successfully.')).toBeVisible()
  expect(submitProfile).toHaveBeenCalledTimes(1)
})

test('aborts pending POST on unmount and ignores its eventual completion', async () => {
  const pending = deferred<void>()
  vi.mocked(submitProfile).mockReturnValueOnce(pending.promise)
  const { user, unmount } = setupForm()
  await fillValidForm(user)
  await user.click(screen.getByRole('button', { name: 'Submit' }))
  await waitFor(() => expect(submitProfile).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(submitProfile).mock.calls[0][1]
  unmount()
  expect(signal?.aborted).toBe(true)
  await act(async () => pending.resolve())
})

test('late success for an edited number cannot authorize submission of an invalid number', async () => {
  const stale = deferred<{ valid: true; corporationNumber: string }>()
  vi.mocked(checkCorporationNumber)
    .mockReturnValueOnce(stale.promise)
    .mockResolvedValue({ valid: false, message: 'Invalid corporation number' })
  const { user } = setupForm()
  await fillValidForm(user)
  const input = screen.getByRole('textbox', { name: 'Corporation Number' })
  await user.tab()
  await screen.findByText('Checking corporation number…')
  const oldSignal = vi.mocked(checkCorporationNumber).mock.calls[0][1]
  await user.clear(input)
  await user.type(input, '000000000')
  await user.tab()
  await screen.findByText('Invalid corporation number')
  expect(oldSignal?.aborted).toBe(true)
  await act(async () => stale.resolve({ valid: true, corporationNumber: '012345678' }))
  expect(input).toHaveAccessibleDescription('Invalid corporation number')
  await user.click(screen.getByRole('button', { name: 'Submit' }))
  await waitFor(() => expect(input).toHaveFocus())
  expect(submitProfile).not.toHaveBeenCalled()
  expect(input).toHaveValue('000000000')
})

test('retries unavailable verification on submit and completes without re-entering values', async () => {
  vi.mocked(checkCorporationNumber).mockRejectedValueOnce(new ApiError('timeout', 'Timed out'))
  const { user } = setupForm()
  await fillValidForm(user)
  await user.tab()
  await screen.findByText('Unable to verify the corporation number. Please try again.')
  await user.click(screen.getByRole('button', { name: 'Submit' }))
  expect(await screen.findByText('Details submitted successfully.')).toBeVisible()
  expect(checkCorporationNumber).toHaveBeenCalledTimes(2)
  expect(submitProfile).toHaveBeenCalledTimes(1)
})

test('invalidates the successful cache after editing, including returning to the original number', async () => {
  const { user } = setupForm()
  const input = screen.getByRole('textbox', { name: 'Corporation Number' })
  await user.type(input, '012345678')
  await user.tab()
  await waitFor(() => expect(checkCorporationNumber).toHaveBeenCalledTimes(1))
  await user.click(input)
  await user.tab()
  expect(checkCorporationNumber).toHaveBeenCalledTimes(1)
  await user.clear(input)
  await user.type(input, '012345678')
  await user.tab()
  await waitFor(() => expect(checkCorporationNumber).toHaveBeenCalledTimes(2))
})

test('repeated keyboard submit while verification is pending shares one GET and one POST', async () => {
  const pending = deferred<{ valid: true; corporationNumber: string }>()
  vi.mocked(checkCorporationNumber).mockReturnValueOnce(pending.promise)
  const { user } = setupForm()
  await fillValidForm(user)
  const input = screen.getByRole('textbox', { name: 'Corporation Number' })
  await user.keyboard('{Enter}{Enter}')
  await screen.findByText('Checking corporation number…')
  await user.keyboard('{Enter}')
  expect(input).toHaveAttribute('readonly')
  expect(checkCorporationNumber).toHaveBeenCalledTimes(1)
  expect(submitProfile).not.toHaveBeenCalled()
  await act(async () => pending.resolve({ valid: true, corporationNumber: '012345678' }))
  expect(await screen.findByText('Details submitted successfully.')).toBeVisible()
  expect(submitProfile).toHaveBeenCalledTimes(1)
})

test.each([
  ['First Name', 'firstName is required'],
  ['Last Name', 'Last name must be shorter'],
  ['Phone Number', 'Phone number is invalid'],
  ['Corporation Number', 'Invalid corporation number'],
])('maps backend validation to %s and preserves values', async (label, message) => {
  vi.mocked(submitProfile).mockRejectedValueOnce(new ApiError('validation', message))
  const { user } = setupForm()
  await fillValidForm(user)
  await user.click(screen.getByRole('button', { name: 'Submit' }))
  const input = screen.getByRole('textbox', { name: label })
  expect(await screen.findByText(message)).toBeVisible()
  expect(input).toHaveAccessibleDescription(message)
  expect(input).toHaveFocus()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'First Name' })).toHaveValue(' Jane ')
  expect(screen.getByRole('textbox', { name: 'Corporation Number' })).toHaveValue('012345678')
  if (label === 'Phone Number') {
    await user.clear(input)
    await user.type(input, '+14165551234')
  }
  await user.click(screen.getByRole('button', { name: 'Submit' }))
  expect(await screen.findByText('Details submitted successfully.')).toBeVisible()
  expect(checkCorporationNumber).toHaveBeenCalledTimes(label === 'Corporation Number' ? 2 : 1)
  if (label === 'Phone Number') {
    expect(vi.mocked(submitProfile).mock.calls[1][0].phone).toBe('+14165551234')
  }
})

test('keeps ambiguous backend validation at form level', async () => {
  vi.mocked(submitProfile).mockRejectedValueOnce(new ApiError('validation', 'First name and last name are invalid'))
  const { user } = setupForm()
  await fillValidForm(user)
  await user.click(screen.getByRole('button', { name: 'Submit' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('First name and last name are invalid')
  expect(screen.getByRole('textbox', { name: 'First Name' })).not.toHaveAttribute('aria-invalid', 'true')
})

test('retains submitted values and clears the success message when the user edits', async () => {
  const { user } = setupForm()
  await fillValidForm(user)
  await user.click(screen.getByRole('button', { name: 'Submit' }))
  expect(await screen.findByText('Details submitted successfully.')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Submit' }))
  expect(submitProfile).toHaveBeenCalledTimes(1)
  const firstName = screen.getByRole('textbox', { name: 'First Name' })
  await user.type(firstName, 'Updated')
  expect(screen.queryByText('Details submitted successfully.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled()
  expect(screen.getByRole('textbox', { name: 'Corporation Number' })).toHaveValue('012345678')
})

test.each(['blur', 'submit'] as const)('rechecks an unchanged invalid number on %s and accepts an updated backend result', async (retry) => {
  vi.mocked(checkCorporationNumber).mockResolvedValueOnce({ valid: false, message: 'Invalid corporation number' })
  const { user } = setupForm()
  await fillValidForm(user)
  const input = screen.getByRole('textbox', { name: 'Corporation Number' })
  await user.tab()
  expect(await screen.findByText('Invalid corporation number', { exact: true })).toBeVisible()
  expect(input).toHaveAccessibleDescription('Invalid corporation number')
  expect(submitProfile).not.toHaveBeenCalled()

  if (retry === 'blur') {
    await user.click(input)
    await user.tab()
    await waitFor(() => expect(input).not.toHaveAttribute('aria-invalid', 'true'))
  }
  await user.click(screen.getByRole('button', { name: 'Submit' }))
  expect(await screen.findByText('Details submitted successfully.')).toBeVisible()
  expect(checkCorporationNumber).toHaveBeenCalledTimes(2)
  expect(submitProfile).toHaveBeenCalledTimes(1)
  expect(input).toHaveValue('012345678')
})
