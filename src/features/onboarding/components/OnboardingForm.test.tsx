import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import OnboardingForm from './OnboardingForm'

test('validates untouched fields on submit and focuses the first invalid field', async () => {
  const user = userEvent.setup()
  render(<OnboardingForm />)
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
})

test('shows name errors on blur and clears them only after correction is blurred', async () => {
  const user = userEvent.setup()
  render(<OnboardingForm />)
  const input = screen.getByRole('textbox', { name: 'First Name' })
  await user.type(input, '   ')
  expect(screen.queryByText('First name is required')).not.toBeInTheDocument()
  await user.tab()
  expect(await screen.findByText('First name is required')).toBeVisible()
  await user.clear(input)
  await user.type(input, 'Jane')
  expect(screen.getByText('First name is required')).toBeVisible()
  await user.tab()
  await waitFor(() => expect(screen.queryByText('First name is required')).not.toBeInTheDocument())
})

test.each(['First Name', 'Last Name'])('caps pasted %s at 50 characters', async (label) => {
  const user = userEvent.setup()
  render(<OnboardingForm />)
  const input = screen.getByRole('textbox', { name: label })
  await user.click(input)
  await user.paste('a'.repeat(51))
  expect(input).toHaveValue('a'.repeat(50))
})

test('rejects a US phone on blur and accepts a corrected Canadian number', async () => {
  const user = userEvent.setup()
  render(<OnboardingForm />)
  const phone = screen.getByRole('textbox', { name: 'Phone Number' })
  await user.type(phone, '+14155552671')
  expect(screen.queryByText(/Enter a valid Canadian/)).not.toBeInTheDocument()
  await user.tab()
  expect(await screen.findByText(/Enter a valid Canadian/)).toBeVisible()
  await user.clear(phone)
  await user.type(phone, '+13062776103')
  await user.tab()
  await waitFor(() => expect(screen.queryByText(/Enter a valid Canadian/)).not.toBeInTheDocument())
})

test('validates corporation length on blur and preserves leading zeros', async () => {
  const user = userEvent.setup()
  render(<OnboardingForm />)
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
  const user = userEvent.setup()
  render(<OnboardingForm />)
  const input = screen.getByRole('textbox', { name: label })
  await user.click(input)
  expect(screen.queryByText(message)).not.toBeInTheDocument()
  await user.tab()
  expect(await screen.findByText(message)).toBeVisible()
  expect(input).toHaveAccessibleDescription(message)
})

test.each(['         ', 'ABC123456'])('rejects non-digit corporation input on blur: %j', async (value) => {
  const user = userEvent.setup()
  render(<OnboardingForm />)
  const input = screen.getByRole('textbox', { name: 'Corporation Number' })
  await user.type(input, value)
  await user.tab()
  expect(await screen.findByText('Corporation number must be exactly 9 digits')).toBeVisible()
  expect(input).toHaveAttribute('aria-invalid', 'true')
})

test('caps pasted corporation input at nine characters while retaining leading zeros', async () => {
  const user = userEvent.setup()
  render(<OnboardingForm />)
  const input = screen.getByRole('textbox', { name: 'Corporation Number' })
  expect(input).toHaveAttribute('type', 'text')
  expect(input).toHaveAttribute('inputmode', 'numeric')
  await user.click(input)
  await user.paste('0123456789')
  expect(input).toHaveValue('012345678')
})
